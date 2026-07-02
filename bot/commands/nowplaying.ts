import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Afficher la chanson actuellement en cours de lecture'),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply('❌ Cette commande ne peut être utilisée que dans un serveur.');
      return;
    }

    const queue = musicService.getQueue(guildId);
    if (!queue || !queue.playing) {
      await interaction.reply('❌ Aucune musique n\'est en cours de lecture.');
      return;
    }

    const currentTrack = musicService.getCurrentTrack(guildId);
    if (!currentTrack) {
      await interaction.reply('❌ Aucune piste trouvée.');
      return;
    }

    const embed = musicService.createNowPlayingEmbed(currentTrack);
    await interaction.reply({ embeds: [embed] });
  },

  cooldown: 3
};