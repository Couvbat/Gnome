import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Passer à la prochaine chanson'),

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

    const currentTrack = musicService.getCurrentTrack(guildId);
    const success = musicService.skip(guildId);
    
    if (success) {
      await interaction.reply(`⏭️ **${currentTrack?.title || 'Piste inconnue'}** ignorée.`);
    } else {
      await interaction.reply('❌ Impossible d\'ignorer la piste.');
    }
  },

  cooldown: 2
};