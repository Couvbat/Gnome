import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

// Roulette numbers and colors
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

interface RouletteGame {
  bet: number;
  betType: string;
  betValue?: number | string;
  userId: string;
  guildId: string;
  winningNumber?: number;
  result?: string;
}

/**
 * Get the color of a number
 */
function getNumberColor(num: number): string {
  if (num === 0) return '🟢';
  if (RED_NUMBERS.includes(num)) return '🔴';
  if (BLACK_NUMBERS.includes(num)) return '⚫';
  return '';
}

/**
 * Calculate payout based on bet type and winning number
 */
async function calculatePayout(game: RouletteGame): Promise<{ won: boolean; payout: number; xpGain: number; message: string }> {
  const { bet, betType, betValue, winningNumber } = game;
  let won = false;
  let multiplier = 0;
  let description = '';

  if (winningNumber === undefined) {
    return { won: false, payout: 0, xpGain: 0, message: 'Erreur: numéro gagnant non défini' };
  }

  switch (betType) {
    case 'number':
      // Straight up bet (35:1)
      won = winningNumber === betValue;
      multiplier = won ? 36 : 0; // 35:1 + original bet
      description = won ? `Numéro exact! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Numéro perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;

    case 'red':
      // Red bet (1:1)
      won = RED_NUMBERS.includes(winningNumber);
      multiplier = won ? 2 : 0; // 1:1 + original bet
      description = won ? `Rouge gagnant! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Rouge perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;

    case 'black':
      // Black bet (1:1)
      won = BLACK_NUMBERS.includes(winningNumber);
      multiplier = won ? 2 : 0; // 1:1 + original bet
      description = won ? `Noir gagnant! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Noir perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;

    case 'even':
      // Even bet (1:1)
      won = winningNumber !== 0 && winningNumber % 2 === 0;
      multiplier = won ? 2 : 0;
      description = won ? `Pair gagnant! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Pair perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;

    case 'odd':
      // Odd bet (1:1)
      won = winningNumber !== 0 && winningNumber % 2 === 1;
      multiplier = won ? 2 : 0;
      description = won ? `Impair gagnant! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Impair perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;

    case 'low':
      // Low bet 1-18 (1:1)
      won = winningNumber >= 1 && winningNumber <= 18;
      multiplier = won ? 2 : 0;
      description = won ? `Manque (1-18) gagnant! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Manque perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;

    case 'high':
      // High bet 19-36 (1:1)
      won = winningNumber >= 19 && winningNumber <= 36;
      multiplier = won ? 2 : 0;
      description = won ? `Passe (19-36) gagnant! ${getNumberColor(winningNumber)} **${winningNumber}**` : `Passe perdant: ${getNumberColor(winningNumber)} **${winningNumber}**`;
      break;
  }

  const payout = Math.floor(bet * multiplier);
  const xpGain = won ? Math.floor(bet / 3) : 0;

  let message = `🎯 **Résultat:** ${description}\n`;
  if (won) {
    message += `💰 Vous gagnez **${payout}** pièces!\n⭐ +${xpGain} XP!`;
  } else {
    message += `💸 Vous perdez **${bet}** pièces.`;
  }

  return { won, payout, xpGain, message };
}

/**
 * Create bet selection buttons
 */
function createBetButtons(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bet_red')
        .setLabel('Rouge')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔴'),
      new ButtonBuilder()
        .setCustomId('bet_black')
        .setLabel('Noir')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚫'),
      new ButtonBuilder()
        .setCustomId('bet_even')
        .setLabel('Pair')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('2️⃣'),
      new ButtonBuilder()
        .setCustomId('bet_odd')
        .setLabel('Impair')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('1️⃣')
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('bet_low')
        .setLabel('Manque (1-18)')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⬇️'),
      new ButtonBuilder()
        .setCustomId('bet_high')
        .setLabel('Passe (19-36)')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⬆️'),
      new ButtonBuilder()
        .setCustomId('bet_number')
        .setLabel('Numéro exact')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎯')
    );

  return [row1, row2];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Jouer à la roulette européenne')
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

    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('🎰 Roulette Européenne')
      .setDescription(`💰 **Mise:** ${bet} pièces\n\n🎯 Choisissez votre type de pari:`)
      .addFields(
        {
          name: '🔴⚫ Couleurs (x2)',
          value: 'Rouge, Noir',
          inline: true
        },
        {
          name: '1️⃣2️⃣ Parité (x2)',
          value: 'Pair, Impair',
          inline: true
        },
        {
          name: '⬇️⬆️ Position (x2)',
          value: 'Manque (1-18), Passe (19-36)',
          inline: true
        },
        {
          name: '🎯 Numéro exact (x36)',
          value: 'Choisir un numéro spécifique (0-36)',
          inline: false
        }
      );

    const response = await interaction.reply({
      embeds: [embed],
      components: createBetButtons(),
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000
    });

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      if (buttonInteraction.user.id !== userId) {
        await buttonInteraction.reply({
          content: 'Cette partie ne vous appartient pas!',
          ephemeral: true
        });
        return;
      }

      let game: RouletteGame = {
        bet,
        betType: '',
        userId,
        guildId
      };

      // Handle bet type selection
      if (buttonInteraction.customId === 'bet_number') {
        const modal = new ModalBuilder()
          .setCustomId('roulette_number_modal')
          .setTitle('Choisissez votre numéro');
        const input = new TextInputBuilder()
          .setCustomId('number_input')
          .setLabel('Numéro (0-36)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(2)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await buttonInteraction.showModal(modal);

        const modalSubmit = await buttonInteraction.awaitModalSubmit({ time: 30000 }).catch(() => null);
        if (!modalSubmit) {
          // Timeout — do nothing; the outer collector will handle the refund on its own timeout
          return;
        }

        const chosenNumber = parseInt(modalSubmit.fields.getTextInputValue('number_input'));
        if (isNaN(chosenNumber) || chosenNumber < 0 || chosenNumber > 36) {
          await modalSubmit.reply({ content: '❌ Numéro invalide (0-36).', ephemeral: true });
          return;
        }

        game.betType = 'number';
        game.betValue = chosenNumber;

        await modalSubmit.deferUpdate();
        await interaction.editReply({
          content: `🎯 Vous pariez sur le numéro **${chosenNumber}**!\n🎲 La roulette tourne...`,
          embeds: [],
          components: []
        });
      } else {
        // Handle other bet types
        const betTypeMap: { [key: string]: string } = {
          'bet_red': 'red',
          'bet_black': 'black',
          'bet_even': 'even',
          'bet_odd': 'odd',
          'bet_low': 'low',
          'bet_high': 'high'
        };

        game.betType = betTypeMap[buttonInteraction.customId];

        const componentLabel = 'label' in buttonInteraction.component ? buttonInteraction.component.label : 'Bet';
        await buttonInteraction.update({
          content: `🎰 Vous avez choisi: **${componentLabel}**!\n🎲 La roulette tourne...`,
          embeds: [],
          components: []
        });
      }

      // Simulate roulette spin with delay
      setTimeout(async () => {
        try {
          // Generate winning number
          game.winningNumber = Math.floor(Math.random() * 37);
          
          // Calculate result
          const result = await calculatePayout(game);
          
          // Handle payout
          if (result.won && result.payout > 0) {
            await userLevelsDb.addCoins(userId, guildId, result.payout);
          }
          
          // Handle XP gain
          if (result.xpGain > 0) {
            await userLevelsDb.addXp(userId, guildId, result.xpGain);
          }

          const resultEmbed = new EmbedBuilder()
            .setColor(result.won ? 0x00ff00 : 0xff0000)
            .setTitle('🎰 Résultat de la Roulette')
            .setDescription(result.message);

          await interaction.editReply({
            content: null,
            embeds: [resultEmbed],
            components: []
          });
          
        } catch (error) {
          console.error('[Roulette] Error processing result:', error);
          await interaction.editReply({
            content: '❌ Une erreur est survenue lors du traitement du résultat.',
            embeds: [],
            components: []
          });
        }
      }, 3000); // 3 second delay for suspense
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        try {
          await userLevelsDb.addCoins(userId, guildId, bet);
          await interaction.editReply({
            content: '⏱️ Temps écoulé ! Votre mise a été remboursée.',
            embeds: [],
            components: []
          });
        } catch (error) {
          console.error('[Roulette] Error refunding coins on timeout:', error);
        }
      } else {
        try {
          await interaction.editReply({
            components: []
          });
        } catch (error) {
          console.log('Could not disable buttons:', error);
        }
      }
    });
  },

  cooldown: 5
};