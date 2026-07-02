import { SlashCommandBuilder, CommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

// Daily bonus constants
const BASE_DAILY_BONUS = 50;
const LEVEL_BONUS_MULTIPLIER = 5;
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclamer votre bonus quotidien de pièces'),

  async execute(interaction: CommandInteraction): Promise<void> {
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;
    const now = Date.now();

    try {
      // Read level first to compute the reward (read-only, no race risk)
      const existing = await userLevelsDb.get(userId, guildId);
      const level = existing?.level || 0;
      const levelBonus = level * LEVEL_BONUS_MULTIPLIER;
      const totalBonus = BASE_DAILY_BONUS + levelBonus;

      // Atomic claim: only succeeds if the cooldown has elapsed
      const updatedUser = await userLevelsDb.claimDaily(userId, guildId, totalBonus, DAILY_COOLDOWN);

      if (!updatedUser) {
        // Cooldown has not elapsed — read remaining time
        const lastClaim = existing?.lastDailyTimestamp || 0;
        const timeRemaining = lastClaim + DAILY_COOLDOWN - now;
        const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutesRemaining = Math.ceil((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

        const embed = new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle('⏰ Bonus quotidien déjà réclamé')
          .setDescription(`Vous avez déjà réclamé votre bonus quotidien!\n\n⏳ Prochain bonus dans: **${hoursRemaining}h ${minutesRemaining}m**`);

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const currentCoins = updatedUser.coins || 0;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎁 Bonus quotidien réclamé!')
        .setDescription(
          `**+${totalBonus}** pièces ajoutées à votre compte!\n\n` +
          `💰 **Nouveau solde:** ${currentCoins} pièces\n\n` +
          `📊 **Détail du bonus:**\n` +
          `   • Bonus de base: ${BASE_DAILY_BONUS} pièces\n` +
          `   • Bonus de niveau ${level}: +${levelBonus} pièces\n\n` +
          `⏰ Revenez dans 24h pour votre prochain bonus!`
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'Astuce: Plus votre niveau est élevé, plus votre bonus quotidien est important!' });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('[Daily] Error processing daily bonus:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la réclamation de votre bonus quotidien.',
        ephemeral: true
      });
    }
  },

  cooldown: 5
};