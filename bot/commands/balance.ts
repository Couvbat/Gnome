import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Affiche votre solde de pièces')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Utilisateur dont vous voulez voir le solde')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId!;

    const userLevel = await userLevelsDb.get(targetUser.id, guildId);
    const coins = userLevel?.coins || 0;
    const coinsAllTimeHigh = userLevel?.coinsAllTimeHigh || coins;
    const level = userLevel?.level || 0;
    const xp = userLevel?.xp || 0;

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('💰 Solde de pièces')
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: '🪙 Pièces',
          value: `**${coins.toLocaleString()}** pièces`,
          inline: true
        },
        {
          name: '📈 Record',
          value: `**${coinsAllTimeHigh.toLocaleString()}** pièces`,
          inline: true
        },
        {
          name: '⭐ Niveau',
          value: `**${level}**`,
          inline: true
        },
        {
          name: '✨ XP',
          value: `**${xp.toLocaleString()}** XP`,
          inline: true
        }
      );

    if (targetUser.id === interaction.user.id) {
      embed.setDescription('Voici votre solde actuel:');
    } else {
      embed.setDescription(`Solde de ${targetUser.displayName}:`);
    }

    await interaction.reply({ 
      embeds: [embed],
      ephemeral: targetUser.id !== interaction.user.id 
    });
  },

  cooldown: 3
};