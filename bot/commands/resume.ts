import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reprendre la lecture de la musique'),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply('❌ Cette commande ne peut être utilisée que dans un serveur.');
      return;
    }

    const queue = musicService.getQueue(guildId);
    if (!queue) {
      await interaction.reply('❌ Aucune musique dans la file d\'attente.');
      return;
    }

    if (queue.playing) {
      await interaction.reply('❌ La musique est déjà en cours de lecture.');
      return;
    }

    const success = musicService.resume(guildId);
    if (success) {
      await interaction.reply('▶️ Lecture reprise.');
    } else {
      await interaction.reply('❌ Impossible de reprendre la lecture.');
    }
  },

  cooldown: 2
};