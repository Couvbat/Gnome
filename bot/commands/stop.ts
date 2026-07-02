import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrêter la musique et vider la file d\'attente'),

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

    const success = musicService.stop(guildId);
    if (success) {
      // Also disconnect from voice channel
      musicService.deleteQueue(guildId);
      await interaction.reply('⏹️ Musique arrêtée et file d\'attente vidée. Déconnexion du salon vocal.');
    } else {
      await interaction.reply('❌ Impossible d\'arrêter la musique.');
    }
  },

  cooldown: 3
};