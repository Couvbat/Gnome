import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('template')
    .setDescription('Template command description'),
  
  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Template response');
  },
  
  // Optional: cooldown in seconds (default is 3)
  cooldown: 5,
  
  // Optional: defer reply for long operations
  // defer: true,
};

// For backward compatibility with CommonJS require()
module.exports = command;
