import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Lancer deux dés et parier sur le résultat')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('Montant à parier (minimum 10 pièces)')
        .setRequired(true)
        .setMinValue(10)
    )
    .addIntegerOption(option =>
      option
        .setName('prediction')
        .setDescription('Prédisez la somme des dés (2-12)')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(12)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const bet = interaction.options.getInteger('bet', true);
    const prediction = interaction.options.getInteger('prediction', true);
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    // Check if user has enough coins
    const userCoins = await userLevelsDb.getCoins(userId, guildId);
    if (userCoins < bet) {
      await interaction.reply({
        content: `❌ Vous n'avez pas assez de pièces! Vous avez **${userCoins}** pièces, mais vous voulez parier **${bet}** pièces.`,
        ephemeral: true
      });
      return;
    }

    // Deduct the bet amount
    const success = await userLevelsDb.spendCoins(userId, guildId, bet);
    if (!success) {
      await interaction.reply({
        content: `❌ Erreur lors de la déduction des pièces. Réessayez.`,
        ephemeral: true
      });
      return;
    }

    // Show rolling animation first
    const rollingEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle('🎲 Jeu de Dés')
      .setDescription(`💰 **Mise:** ${bet} pièces\n🎯 **Prédiction:** ${prediction}\n\n🎲 🎲\n\n🔄 Les dés roulent...`);

    await interaction.reply({ embeds: [rollingEmbed] });

    // Roll and settle the result immediately — the setTimeout below only
    // delays the *visual* reveal for suspense. The payout must already be
    // credited/debited before the delay starts so a crash during that window
    // can never lose (or duplicate) coins that were charged up front.

    // Roll two dice
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;

    // Calculate payout based on difficulty
    // Harder predictions (2, 12) have higher payouts
    // Easier predictions (6, 7, 8) have lower payouts
    const probabilities = {
      2: 36,  // 1/36 chance - x36 payout
      3: 18,  // 2/36 chance - x18 payout
      4: 12,  // 3/36 chance - x12 payout
      5: 9,   // 4/36 chance - x9 payout
      6: 7,   // 5/36 chance - x7 payout
      7: 6,   // 6/36 chance - x6 payout
      8: 7,   // 5/36 chance - x7 payout
      9: 9,   // 4/36 chance - x9 payout
      10: 12, // 3/36 chance - x12 payout
      11: 18, // 2/36 chance - x18 payout
      12: 36  // 1/36 chance - x36 payout
    };

    const won = total === prediction;
    const multiplier = probabilities[prediction as keyof typeof probabilities];
    const payout = won ? bet * multiplier : 0;
    const xpGain = won ? Math.floor(bet / 2) : 0;

    try {
      if (won && payout > 0) {
        await userLevelsDb.addCoins(userId, guildId, payout);
      }
      if (xpGain > 0) {
        await userLevelsDb.addXp(userId, guildId, xpGain);
      }
    } catch (error) {
      console.error('[Dice] Error crediting payout:', error);
    }

    // Simulate rolling delay (cosmetic only — the payout above is already settled)
    setTimeout(async () => {
      try {
        // Create dice emojis
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const die1Emoji = diceEmojis[die1 - 1];
        const die2Emoji = diceEmojis[die2 - 1];

        let resultMessage = `🎲 **Résultat:** ${die1Emoji} ${die2Emoji} = **${total}**\n\n`;
        if (won) {
          resultMessage += `🎉 **Bravo! Prédiction exacte!**\n💰 Vous gagnez **${payout}** pièces! (x${multiplier})\n⭐ +${xpGain} XP!`;
        } else {
          resultMessage += `😞 **Dommage!** Vous aviez prédit **${prediction}**.\n💸 Vous perdez **${bet}** pièces.`;
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(won ? 0x00ff00 : 0xff0000)
          .setTitle('🎲 Jeu de Dés')
          .setDescription(`💰 **Mise:** ${bet} pièces\n🎯 **Prédiction:** ${prediction}\n\n${resultMessage}`)
          .addFields(
            {
              name: '📊 Multiplicateurs',
              value: `**2, 12:** x36  |  **3, 11:** x18  |  **4, 10:** x12\n**5, 9:** x9  |  **6, 8:** x7  |  **7:** x6`,
              inline: false
            }
          );

        await interaction.editReply({ embeds: [resultEmbed] });

      } catch (error) {
        console.error('[Dice] Error revealing result:', error);
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors du traitement du résultat.',
          embeds: []
        });
      }
    }, 2000); // 2 second delay for rolling animation
  },

  cooldown: 3
};