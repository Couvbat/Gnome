import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Mettre en pause la musique actuelle'),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply('❌ Cette commande ne peut être utilisée que dans un serveur.');
      return;
    }

    const queue = musicService.getQueue(guildId);
    if (!queue) {
      await interaction.reply('❌ Aucune musique n\'est en cours de lecture.');
      return;
    }

    if (!queue.playing) {
      await interaction.reply('❌ Aucune musique n\'est en cours de lecture.');
      return;
    }

    const success = musicService.pause(guildId);
    if (success) {
      await interaction.reply('⏸️ Musique mise en pause.');
    } else {
      await interaction.reply('❌ Impossible de mettre en pause la musique.');
    }
  },

  cooldown: 2
};