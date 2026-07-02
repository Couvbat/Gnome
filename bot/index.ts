import fs from "node:fs";
import path from "node:path";
import { Client, Collection, Events, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { Command } from "./types/command";
import { connectDatabase } from "./database/db";
import { initBirthdayChecker } from "./services/birthdayChecker";
import { initXpTracking } from "./services/xpTracking";

dotenv.config();

// Process error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception:', error);
  // Don't exit immediately, try to gracefully shutdown
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // Log but don't exit, most unhandled rejections aren't fatal
});

process.on('SIGTERM', () => {
  console.log('[INFO] Received SIGTERM, shutting down gracefully...');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[INFO] Received SIGINT, shutting down gracefully...');
  gracefulShutdown('SIGINT');
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`[INFO] Graceful shutdown initiated by ${signal}`);
  
  try {
    if (client && client.isReady()) {
      console.log('[INFO] Destroying Discord client...');
      client.destroy();
    }
    
    // Give some time for cleanup
    setTimeout(() => {
      console.log(`[INFO] Shutdown complete due to ${signal}`);
      process.exit(signal === 'uncaughtException' ? 1 : 0);
    }, 5000);
  } catch (error) {
    console.error('[ERROR] Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Extend Client to include custom properties
declare module "discord.js" {
  export interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
  }
}

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // Required for voice channel features
    GatewayIntentBits.GuildMessages, // Required for XP tracking
    GatewayIntentBits.MessageContent, // Required to read message content
  ] 
});

client.cooldowns = new Collection();
client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const commandModule = require(filePath) as Command | { default: Command } | { command: Command };
  
  // Handle different export patterns
  let cmd: Command;
  if ("command" in commandModule) {
    // Named export: export const command = { ... }
    cmd = commandModule.command;
  } else if ("default" in commandModule) {
    // Default export: export default { ... }
    cmd = commandModule.default;
  } else {
    // Direct export (shouldn't happen with TypeScript but handle it)
    cmd = commandModule as Command;
  }
  
  if ("data" in cmd && "execute" in cmd) {
    client.commands.set(cmd.data.name, cmd);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  
  // Initialize database connection
  try {
    await connectDatabase();
  } catch (error) {
    console.error('[Error] Failed to connect to database:', error);
  }
  
  // Initialize services
  initBirthdayChecker(client);
  initXpTracking(client);
});

// Discord client error handling
client.on(Events.Error, (error) => {
  console.error('[Discord] Client error:', error);
});

client.on(Events.Warn, (warning) => {
  console.warn('[Discord] Client warning:', warning);
});

client.on('disconnect' as any, () => {
  console.warn('[Discord] Client disconnected');
});

client.on('reconnecting', () => {
  console.log('[Discord] Client reconnecting...');
});

client.on('resumed', () => {
  console.log('[Discord] Client connection resumed');
});

// Handle rate limit events
client.rest.on('rateLimited', (info) => {
  console.warn('[Discord] Rate limited:', info);
});

// Handle autocomplete interactions
client.on(Events.InteractionCreate, async (interaction): Promise<void> => {
  if (!interaction.isAutocomplete()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  if (!command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    console.error('[Autocomplete Error]', error);
  }
});

client.on(Events.InteractionCreate, async (interaction): Promise<void> => {
  if (!interaction.isChatInputCommand()) return;
  
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  const { cooldowns } = interaction.client;

  if (!cooldowns.has(command.data.name)) {
    cooldowns.set(command.data.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.data.name)!;
  const defaultCooldownDuration = 3;
  const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

  // Skip cooldown for listen command with "stop" action
  const isListenStop = command.data.name === 'listen' && 
    interaction.isChatInputCommand() && 
    interaction.options.getString('action') === 'stop';

  if (timestamps.has(interaction.user.id) && !isListenStop) {
    const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

    if (now < expirationTime) {
      const expiredTimestamp = Math.round(expirationTime / 1000);
      await interaction.reply({
        content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:t>.`,
        flags: 64, // Ephemeral flag
      });
      return;
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  try {
    if (command.defer) {
      await interaction.deferReply();
      await command.execute(interaction);
    } else {
      await command.execute(interaction);
    }
  } catch (error) {
    console.error(error);
    // Check if we can still respond
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "There was an error while executing this command!",
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          flags: 64, // Ephemeral flag
        });
      }
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
});

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  try {
    // Clean up old cooldowns (older than 2 minutes to be safe, as max cooldown is typically < 1 minute)
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    let cleanedCooldowns = 0;
    
    client.cooldowns.forEach((commandCooldowns, commandName) => {
      commandCooldowns.forEach((timestamp, userId) => {
        if (timestamp < twoMinutesAgo) {
          commandCooldowns.delete(userId);
          cleanedCooldowns++;
        }
      });
      
      // If the command's cooldown map is empty, remove it entirely
      if (commandCooldowns.size === 0) {
        client.cooldowns.delete(commandName);
      }
    });
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memoryUsage = process.memoryUsage();
    console.log(`[Memory] Cleanup completed. Cleared ${cleanedCooldowns} old cooldowns. Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  } catch (error) {
    console.error('[Memory] Error during cleanup:', error);
  }
}, CLEANUP_INTERVAL);

// Simple HTTP server for Passenger (cPanel requirement)
// Passenger expects Node.js apps to listen on a port
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      bot: client.isReady() ? 'connected' : 'connecting',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Discord Bot - Not Found');
  }
});

// Start both bot and minimal web server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`[Web] Passenger interface running on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);
