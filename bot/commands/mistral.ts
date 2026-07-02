import { SlashCommandBuilder, CommandInteraction } from "discord.js";
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
    .setName("mistral")
    .setDescription("Posez une question à Mistral.")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Prompt").setRequired(true)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt", true);
    const user = interaction.user.username;

    try {
      const apiRequest = await request(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + process.env.MISTRAL_API_KEY,
          },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [
              {
                role: "system",
                content:
                  'Tu es "Le Gnome", un bot Discord dans "La zone". Tu réponds de manière concise et directe. Tu peux aider avec les jeux vidéos (surtout LoL), le développement web, les IA, la musique, et tu gères un système de pièces/niveaux/paris. Reste amical mais avec un sarcasme léger. Évite les réponses trop longues.',
              },
              {
                role: "user",
                content: prompt,
              },
            ] as MistralMessage[],
            temperature: 0.7,
            top_p: 1,
            max_tokens: 1800,
          }),
        }
      );

      // Check for rate limiting or other errors
      if (apiRequest.statusCode === 429) {
        await interaction.editReply({
          content: "⏱️ Trop de requêtes à l'API Mistral. Attends quelques secondes et réessaie."
        });
        return;
      }

      if (apiRequest.statusCode !== 200) {
        console.error(`[Mistral] API error: ${apiRequest.statusCode}`);
        await interaction.editReply({
          content: `❌ Erreur API (${apiRequest.statusCode}). Réessaie dans un moment.`
        });
        return;
      }

      // Parse the response body as JSON
      const body = (await apiRequest.body.json()) as MistralResponse;

      // Validate response structure
      if (!body.choices || !body.choices[0]?.message?.content) {
        console.error('[Mistral] Invalid response structure from Mistral API');
        await interaction.editReply({
          content: "❌ Réponse invalide de l'API. Réessaie."
        });
        return;
      }

      // Extract the reply from the response body
      const reply = body.choices[0].message.content;

      // Format the prompt and reply
      const formatedPrompt = `${user} demande : ${prompt} `;
      const formatedReply = `reponse : ${reply}`;

      // Edit the deferred reply with the bot's response
      await interaction.editReply({ content: formatedPrompt + formatedReply });
    } catch (error) {
      console.error(
        "Error occurred while making the Mistral API request:",
        error
      );
      await interaction.editReply({
        content:
          "Une erreur est survenue. Réessaie plus tard.",
      });
    }
  },

  cooldown: 5,
};

// For backward compatibility with CommonJS
module.exports = command;
