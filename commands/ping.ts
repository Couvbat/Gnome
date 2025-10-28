import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  
  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Pong!');
  },
};

// For backward compatibility with CommonJS require()
module.exports = command;
