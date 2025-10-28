import {
  SlashCommandBuilder,
  CommandInteraction,
  MessageCollector,
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
    .setDescription("Start a conversation with Mistral."),

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    const user = interaction.user.username;

    try {
      if (!interaction.channel || !("threads" in interaction.channel)) {
        await interaction.editReply({
          content: "This command must be used in a text channel that supports threads.",
        });
        return;
      }

      // Start a new thread for the conversation
      const threadChannel = await interaction.channel.threads.create({
        name: `Conversation with ${user}`,
        autoArchiveDuration: 60, // The thread will be automatically archived after 60 minutes.
      });

      // Create a message collector for the thread
      const collector = new MessageCollector(threadChannel as any, {
        filter: (m) => m.author.id === interaction.user.id,
        time: 900000, // The collector will run for 15 minutes.
      });

      // Handle collected messages
      collector.on("collect", async (m) => {
        await handleMessage(m, threadChannel, user);
      });

      // Handle the end of the message collector
      collector.on("end", (collected) => {
        console.log(`Collected ${collected.size} messages`);
      });

      await interaction.editReply({
        content: `Conversation started in ${threadChannel.toString()}`,
      });
    } catch (error) {
      console.error("Error occurred while creating the thread:", error);
      await interaction.editReply({
        content:
          "An error occurred while creating the thread. Please try again later.",
      });
    }
  },

  cooldown: 5,
};

// Function to handle a message in the conversation
async function handleMessage(
  m: Message,
  threadChannel: ThreadChannel,
  user: string
): Promise<void> {
  const userPrompt = m.content;

  try {
    // Fetch the conversation history
    const conversationHistory = await getConversationHistory(threadChannel);

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

    // Parse the response body as JSON
    const body = (await response.body.json()) as MistralResponse;

    // Extract the reply from the response body
    const reply = body.choices[0].message.content;

    // Format the prompt and reply
    const formatedPrompt = `${user} demande : ${userPrompt} `;
    const formatedReply = `reponse : ${reply}`;

    // Add the bot's message to the conversation history
    conversationHistory.push({
      role: "assistant",
      content: reply,
    });

    // Send the bot's response to the thread
    await threadChannel.send(formatedPrompt + formatedReply);
  } catch (error) {
    console.error("Error occurred while making the Mistral API request:", error);
    await threadChannel.send(
      "An error occurred while processing your request. Please try again later."
    );
  }
}

// Function to get the conversation history
async function getConversationHistory(
  threadChannel: ThreadChannel
): Promise<MistralMessage[]> {
  const messages: Collection<string, Message> =
    await threadChannel.messages.fetch();
  const conversationHistory: MistralMessage[] = [
    {
      role: "system",
      content: `Tu es "Le Gnome", un bot discord dans "La zone". Ton rôle est de répondre aux questions que les membres te poseront, principalement à propos de jeux videos, de developpement web ou sur les IA génératrices. Tu es un bot amical mais qui sais faire preuve de sarcasme.`,
    },
  ];

  messages.forEach((message) => {
    if (message.author.id !== threadChannel.client.user?.id) {
      conversationHistory.push({
        role: "user",
        content: message.content,
      });
    } else {
      conversationHistory.push({
        role: "assistant",
        content: message.content,
      });
    }
  });

  return conversationHistory;
}

// For backward compatibility with CommonJS
module.exports = command;
