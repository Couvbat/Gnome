import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { birthdaysDb } from '../database/db';

/**
 * Initialize birthday checker that runs daily at 9:00 AM
 * Sends birthday messages to a designated channel
 */
export function initBirthdayChecker(client: Client): void {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('[Birthday Checker] Running daily birthday check...');
    
    const today = new Date();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed
    const day = today.getDate();

    try {
      // Check all guilds the bot is in
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const birthdays = await birthdaysDb.getTodayBirthdays(guildId, month, day);
          
          if (birthdays.length === 0) continue;

          // Find a suitable channel (look for #anniversaires or #general or first text channel)
          const channel = 
            guild.channels.cache.find(ch => ch.name === 'anniversaires' && ch.isTextBased()) ||
            guild.channels.cache.find(ch => ch.name === 'general' && ch.isTextBased()) ||
            guild.channels.cache.find(ch => ch.isTextBased());

          if (!channel || !channel.isTextBased()) {
            console.log(`[Birthday Checker] No suitable channel found in guild ${guild.name}`);
            continue;
          }

          // Send birthday messages
          for (const birthday of birthdays) {
            try {
              // Validate birthday data
              if (!birthday.userId) {
                console.error('[Birthday Checker] Invalid birthday entry - missing userId');
                continue;
              }

              const user = await client.users.fetch(birthday.userId).catch(() => null);
              
              if (!user) {
                console.error(`[Birthday Checker] Could not fetch user ${birthday.userId}`);
                continue;
              }
              
              let message = `🎉🎂 Joyeux anniversaire <@${user.id}> ! 🎂🎉`;
              
              if (birthday.birthYear) {
                const age = today.getFullYear() - birthday.birthYear;
                const MAX_REASONABLE_AGE = 150; // Sanity check to prevent absurd ages from data errors
                if (age > 0 && age < MAX_REASONABLE_AGE) {
                  message += `\nTu fêtes tes ${age} ans aujourd'hui !`;
                }
              }

              await (channel as TextChannel).send(message);
              console.log(`[Birthday Checker] Sent birthday message for ${user.username} in ${guild.name}`);
            } catch (error) {
              console.error(`[Birthday Checker] Error sending birthday message:`, error);
            }
          }
        } catch (guildError) {
          console.error(`[Birthday Checker] Error processing guild ${guild.name}:`, guildError);
        }
      }
    } catch (error) {
      console.error('[Birthday Checker] Error during birthday check:', error);
    }
  });

  console.log('[Birthday Checker] Daily birthday checker initialized (runs at 9:00 AM)');
}
