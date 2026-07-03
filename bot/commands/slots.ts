import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

// Slot machine symbols and their values
const SYMBOL_VALUES = {
  '🍒': 2,   // Cherry - common (x2)
  '🍋': 3,   // Lemon - common (x3)
  '🍊': 4,   // Orange - common (x4)
  '🍇': 5,   // Grape - uncommon (x5)
  '⭐': 10,  // Star - rare (x10)
  '💎': 25,  // Diamond - very rare (x25)
  '7️⃣': 50  // Lucky 7 - jackpot (x50)
};

// Symbol weights for probability (higher = more common)
const SYMBOL_WEIGHTS = {
  '🍒': 30,
  '🍋': 25,
  '🍊': 20,
  '🍇': 15,
  '⭐': 7,
  '💎': 2,
  '7️⃣': 1
};

/**
 * Get a random symbol based on weights
 */
function getRandomSymbol(): string {
  const totalWeight = Object.values(SYMBOL_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      return symbol;
    }
  }
  
  return '🍒'; // Fallback
}

/**
 * Calculate slot machine result
 */
function calculateSlotResult(reels: string[], bet: number): { won: boolean; payout: number; xpGain: number; message: string } {
  const [reel1, reel2, reel3] = reels;
  let multiplier = 0;
  let resultType = '';

  // Check for three matching symbols (jackpot)
  if (reel1 === reel2 && reel2 === reel3) {
    multiplier = SYMBOL_VALUES[reel1 as keyof typeof SYMBOL_VALUES];
    resultType = 'JACKPOT! Trois symboles identiques!';
  }
  // Check for two matching symbols
  else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
    const matchingSymbol = reel1 === reel2 ? reel1 : (reel2 === reel3 ? reel2 : reel1);
    multiplier = Math.floor(SYMBOL_VALUES[matchingSymbol as keyof typeof SYMBOL_VALUES] / 2);
    resultType = 'Deux symboles identiques!';
  }
  // Special case: any two 7s
  else if ((reel1 === '7️⃣' && reel2 === '7️⃣') || (reel2 === '7️⃣' && reel3 === '7️⃣') || (reel1 === '7️⃣' && reel3 === '7️⃣')) {
    multiplier = 10;
    resultType = 'Deux 7! Chance spéciale!';
  }

  const won = multiplier > 0;
  const payout = won ? bet * multiplier : 0;
  const xpGain = won ? Math.floor(bet / 3) : 0;

  let message = `🎰 **${reels.join(' | ')}**\n\n`;
  if (won) {
    message += `🎉 **${resultType}**\n💰 Vous gagnez **${payout}** pièces! (x${multiplier})\n⭐ +${xpGain} XP!`;
  } else {
    message += `😞 **Aucune combinaison gagnante.**\n💸 Vous perdez **${bet}** pièces.`;
  }

  return { won, payout, xpGain, message };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Jouer à la machine à sous')
    .addIntegerOption(option =>
      option
        .setName('bet')
        .setDescription('Montant à parier (minimum 10 pièces)')
        .setRequired(true)
        .setMinValue(10)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const bet = interaction.options.getInteger('bet', true);
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

    // Show spinning animation first
    const spinningEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle('🎰 Machine à Sous')
      .setDescription(`💰 **Mise:** ${bet} pièces\n\n🎰 **🎲 | 🎲 | 🎲**\n\n🔄 Les rouleaux tournent...`);

    await interaction.reply({ embeds: [spinningEmbed] });

    // Spin and settle the result immediately — the setTimeout below only
    // delays the *visual* reveal for suspense. The payout itself must already
    // be credited/debited before the delay starts so a crash during that
    // window can never lose (or duplicate) coins that were charged up front.
    const reels = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const result = calculateSlotResult(reels, bet);

    try {
      if (result.won && result.payout > 0) {
        await userLevelsDb.addCoins(userId, guildId, result.payout);
      }
      if (result.xpGain > 0) {
        await userLevelsDb.addXp(userId, guildId, result.xpGain);
      }
    } catch (error) {
      console.error('[Slots] Error crediting payout:', error);
    }

    // Simulate spinning delay (cosmetic only — the payout above is already settled)
    setTimeout(async () => {
      try {
        const resultEmbed = new EmbedBuilder()
          .setColor(result.won ? 0x00ff00 : 0xff0000)
          .setTitle('🎰 Machine à Sous')
          .setDescription(`💰 **Mise:** ${bet} pièces\n\n${result.message}`)
          .addFields(
            {
              name: '🎰 Tableau des gains',
              value: `🍒🍒🍒 x2  |  🍋🍋🍋 x3  |  🍊🍊🍊 x4\n🍇🍇🍇 x5  |  ⭐⭐⭐ x10  |  💎💎💎 x25\n7️⃣7️⃣7️⃣ x50  |  Deux identiques x1-2`,
              inline: false
            }
          );

        await interaction.editReply({ embeds: [resultEmbed] });

      } catch (error) {
        console.error('[Slots] Error revealing result:', error);
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors du traitement du résultat.',
          embeds: []
        });
      }
    }, 2000); // 2 second delay for spinning animation
  },

  cooldown: 3
};