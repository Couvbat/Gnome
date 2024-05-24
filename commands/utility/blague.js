const { SlashCommandBuilder } = require("discord.js");
const { request } = require("undici");
const { blagueApiKey } = require("../../config.json");

module.exports = {
  cooldown: "5", // seconds
  data: new SlashCommandBuilder()
    .setName("blague")
    .setDescription("Dit une blague."),
  async execute(interaction) {
    const apiRequest = await request("https://www.blagues-api.fr/api/random", {
      headers: {
        Authorization: "Bearer " + blagueApiKey,
      },
    });

    // Parse the response body as JSON
    const body = await apiRequest.body.json();

    // Extract the joke from the response
    const joke = body.joke;
    const answer = body.answer;

    // Reply to the interaction with the joke
    await interaction.editReply({ content: joke });

    setTimeout(async () => {
      await interaction.followUp({ content: answer });
    }, 5000);
  },
};