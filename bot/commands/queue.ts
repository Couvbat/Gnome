import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types/command';
import { musicService } from '../services/musicService';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Afficher la file d\'attente musicale')
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Numéro de page à afficher')
        .setMinValue(1)
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply('❌ Cette commande ne peut être utilisée que dans un serveur.');
      return;
    }

    const queue = musicService.getQueue(guildId);
    if (!queue || queue.tracks.length === 0) {
      await interaction.reply('❌ La file d\'attente est vide. Utilisez `/play` pour ajouter de la musique.');
      return;
    }

    const page = interaction.options.getInteger('page') || 1;
    const embed = musicService.createQueueEmbed(guildId, page);

    if (!embed) {
      await interaction.reply('❌ Impossible d\'afficher la file d\'attente.');
      return;
    }

    await interaction.reply({ embeds: [embed] });
  },

  cooldown: 3
};