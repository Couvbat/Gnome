const { SlashCommandBuilder } = require("discord.js");
const { request } = require("undici");
const { mistralApiKey } = require("../../config.json");

module.exports = {
  cooldown: "5", // seconds
  data: new SlashCommandBuilder()
    .setName("mistral")
    .setDescription("Posez une question à Mistral.")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Prompt").setRequired(true)
    ),
  async execute(interaction) {
    const prompt = interaction.options.getString("prompt");
    const user = interaction.user.username;

    const apiRequest = await request(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + mistralApiKey,
        },
        body: JSON.stringify({
          model: "mistral-medium",
          messages: [
            {
              role: "system",
              content:
                'Tu es "Le Gnome", un bot discord dans "La zone". Ton rôle est de répondre aux questions que les membres te poseront, principalement à propos de jeux videos, de developpement web ou sur les IA génératrices. Tu es un bot amical mais qui sais faire preuve de sarcasme.',
            },
            {
              role: "user",
              content: `${prompt}`,
            },
          ],
          temperature: 0.7,
          top_p: 1,
          max_tokens: 1800,
        }),
      }
    );

    // Parse the response body as JSON
    const body = await apiRequest.body.json();

    // Extract the reply from the response body
    const reply = body.choices[0].message.content;

    // Format the prompt and reply
    const formatedPrompt = `${user} demande : ${prompt} `;
    const formatedReply = `reponse : ${reply}`;

    // Reply to the interaction with the bot
    await interaction.editReply({ content: formatedPrompt + formatedReply });
  },
};
