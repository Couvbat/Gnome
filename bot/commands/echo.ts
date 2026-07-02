import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { Command } from "../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Echo ce que l'utilisateur a dit.")
    .addStringOption((option) =>
      option
        .setName("echo")
        .setDescription("Le texte à répéter.")
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    
    const echoText = interaction.options.getString("echo", true);
    await interaction.reply(echoText);
  },

  cooldown: 5,
};

// For backward compatibility with CommonJS
module.exports = command;
