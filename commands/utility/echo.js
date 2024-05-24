const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  cooldown: "5", // seconds
  data: new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Echo ce que l'utilisateur a dit.")
    .addStringOption((option) =>
      option
        .setName("echo")
        .setDescription("Le texte à répéter.")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.reply(interaction.options.getString("echo"));
  },
};
