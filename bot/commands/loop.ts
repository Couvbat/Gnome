import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Activer/désactiver la répétition de la chanson actuelle'),

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

    const isLooping = musicService.toggleLoop(guildId);
    const status = isLooping ? 'activée' : 'désactivée';
    const emoji = isLooping ? '🔂' : '▶️';
    
    await interaction.reply(`${emoji} Répétition ${status}.`);
  },

  cooldown: 2
};