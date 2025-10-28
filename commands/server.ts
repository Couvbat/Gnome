import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { Command } from "../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("Provides information about the server."),

  async execute(interaction: CommandInteraction): Promise<void> {
    // interaction.guild is the object representing the Guild in which the command was run
    if (interaction.guild) {
      await interaction.reply(
        `Ce serveur est ${interaction.guild.name} et a ${interaction.guild.memberCount} membres.`
      );
    } else {
      await interaction.reply("Cette commande doit être utilisée dans un serveur.");
    }
  },
};

// For backward compatibility with CommonJS
module.exports = command;
