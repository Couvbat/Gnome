import {
  SlashCommandBuilder,
  CommandInteraction,
  ThreadChannel,
  Message,
  Collection,
} from "discord.js";
import { request } from "undici";
import { Command } from "../types/command";

interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("conversation")
    .setDescription("Commence une conversation avec Mistral dans un thread éphémère."),

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    const user = interaction.user.username;
    const userId = interaction.user.id;

    try {
      if (!interaction.channel || !("threads" in interaction.channel)) {
        await interaction.editReply({
          content: "Cette commande doit être utilisée dans un salon textuel qui supporte les threads.",
        });
        return;
      }

      // Start a new thread for the conversation
      const threadChannel = await interaction.channel.threads.create({
        name: `Conversation avec ${user}`,
        autoArchiveDuration: 60, // The thread will be automatically archived after 60 minutes.
      });

      // Create a message collector for the thread
      const collector = threadChannel.createMessageCollector({
        filter: (m: Message) => m.author.id === interaction.user.id && !m.author.bot,
        time: 900000, // The collector will run for 15 minutes.
      });

      console.log(`[Conversation] Thread created: ${threadChannel.id} for user ${user}`);

      // Serialize message processing: each new message waits for the previous to finish
      // before calling Mistral, preventing duplicate/interleaved replies from concurrent calls.
      let processingChain = Promise.resolve();

      // Handle collected messages
      collector.on("collect", (m: Message) => {
        console.log(`[Conversation] Message collected from ${m.author.username}: ${m.content}`);
        processingChain = processingChain
          .then(() => handleMessage(m, threadChannel, user, userId))
          .catch(err => console.error('[Conversation] handleMessage error:', err));
      });

      // Handle the end of the message collector
      collector.on("end", (collected, reason) => {
        console.log(`[Conversation] Collector ended. Collected ${collected.size} messages. Reason: ${reason}`);
        threadChannel
          .send("⏰ La conversation a expiré après 15 minutes d'inactivité.")
          .then(() => { void threadChannel.setArchived(true); })
          .catch(console.error);
      });

      await interaction.editReply({
        content: `🧵 Conversation démarrée dans ${threadChannel.toString()} ! Envoie tes messages dans le thread.`,
      });
    } catch (error) {
      console.error("Error occurred while creating the thread:", error);
      await interaction.editReply({
        content:
          "Une erreur est survenue lors de la création du thread. Réessayez plus tard.",
      });
    }
  },

  cooldown: 5,
};

// Function to handle a message in the conversation
async function handleMessage(
  m: Message,
  threadChannel: ThreadChannel,
  user: string,
  userId: string
): Promise<void> {
  const userPrompt = m.content;

  try {
    // Fetch the conversation history
    const conversationHistory = await getConversationHistory(threadChannel, userId);

    // Add the user's message to the conversation history
    conversationHistory.push({
      role: "user",
      content: userPrompt,
    });

    // Make the Mistral API request
    const response = await request(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.MISTRAL_API_KEY,
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: conversationHistory,
          temperature: 0.7,
          top_p: 1,
          max_tokens: 4096,
        }),
      }
    );

    // Check for rate limiting or other errors
    if (response.statusCode === 429) {
      await threadChannel.send(
        "⏱️ Trop de requêtes à l'API Mistral. Attends quelques secondes et réessaie."
      );
      return;
    }

    if (response.statusCode !== 200) {
      console.error(`[Conversation] Mistral API error: ${response.statusCode}`);
      await threadChannel.send(
        `❌ Erreur API (${response.statusCode}). Réessaie dans un moment.`
      );
      return;
    }

    // Parse the response body as JSON
    const body = (await response.body.json()) as MistralResponse;

    // Validate response structure
    if (!body.choices || !body.choices[0]?.message?.content) {
      console.error('[Conversation] Invalid response structure from Mistral API');
      await threadChannel.send(
        "❌ Réponse invalide de l'API. Réessaie."
      );
      return;
    }

    // Extract the reply from the response body
    const reply = body.choices[0].message.content;

    // Send the bot's response to the thread (just the reply, no formatting)
    await threadChannel.send(reply);
    
    console.log(`[Conversation] Sent response to ${user} in thread ${threadChannel.id}`);
  } catch (error) {
    console.error("Error occurred while making the Mistral API request:", error);
    await threadChannel.send(
      "Une erreur est survenue. Réessaie plus tard."
    );
  }
}

// Function to get the conversation history
async function getConversationHistory(
  threadChannel: ThreadChannel,
  invokerId: string
): Promise<MistralMessage[]> {
  // Limit to last 20 messages to reduce API load and keep context relevant
  // This is more efficient than loading all 100 messages every time
  const messages: Collection<string, Message> =
    await threadChannel.messages.fetch({ limit: 20 });

  const conversationHistory: MistralMessage[] = [
    {
      role: "system",
      content: `Tu es "Le Gnome", un bot Discord dans "La zone". Tu réponds de manière concise et directe. Tu peux aider avec les jeux vidéos (surtout LoL), le développement web, les IA, la musique, et tu gères un système de pièces/niveaux/paris. Reste amical mais avec un sarcasme léger. Évite les réponses trop longues.`,
    },
  ];

  // Convert to array and reverse to get chronological order (oldest first)
  const sortedMessages = Array.from(messages.values()).reverse();

  sortedMessages.forEach((message) => {
    // Skip empty messages or system messages
    if (!message.content || message.system) return;

    if (message.author.id === threadChannel.client.user?.id) {
      // Clean up the bot's formatted response to extract just the actual reply
      const content = message.content.replace(/^.*reponse : /, '');
      conversationHistory.push({
        role: "assistant",
        content: content,
      });
    } else if (message.author.id === invokerId) {
      // Only fold in messages from the user who started this conversation —
      // the collector already only reacts to the invoker's messages, but
      // message *history* fetched from the thread can still contain messages
      // from other users who happen to have posted in it. Without this check
      // they'd leak into Mistral's context as if they were the person having
      // the conversation.
      conversationHistory.push({
        role: "user",
        content: message.content,
      });
    }
    // else: message from a different, non-invoking user — ignore it.
  });

  console.log(`[Conversation] Loaded ${sortedMessages.length} messages from history`);
  return conversationHistory;
}

// For backward compatibility with CommonJS
module.exports = command;
