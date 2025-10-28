import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { Command } from "../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Provides information about the user."),

  async execute(interaction: CommandInteraction): Promise<void> {
    // interaction.user is the object representing the User who ran the command
    // interaction.member is the GuildMember object, which represents the user in the specific guild
    if (interaction.member && "joinedAt" in interaction.member) {
      await interaction.reply(
        `Cette commande a été utilisé par ${interaction.user.username}, qui a rejoint le : ${interaction.member.joinedAt}.`
      );
    } else {
      await interaction.reply(
        `Cette commande a été utilisé par ${interaction.user.username}.`
      );
    }
  },
};

// For backward compatibility with CommonJS
module.exports = command;
