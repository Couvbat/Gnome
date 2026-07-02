import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ComponentType,
  ButtonInteraction
} from 'discord.js';
import { Command } from '../types/command';
import { userLevelsDb } from '../database/db';

// Card suits and values
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Card {
  rank: string;
  suit: string;
  value: number; // Primary value
  isAce: boolean;
}

interface GameState {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  gameOver: boolean;
  result?: string;
  bet: number;
  userId: string;
  guildId: string;
}

/**
 * Create a shuffled deck of 52 cards
 */
function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let value: number;
      const isAce = rank === 'A';
      
      if (rank === 'A') {
        value = 11; // Aces start as 11
      } else if (['J', 'Q', 'K'].includes(rank)) {
        value = 10;
      } else {
        value = parseInt(rank);
      }
      
      deck.push({ rank, suit, value, isAce });
    }
  }
  
  // Shuffle using Fisher-Yates algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

/**
 * Deal a card from the deck, reshuffling a fresh deck in if it runs out
 */
function dealCard(deck: Card[]): Card {
  if (deck.length === 0) {
    const fresh = createShuffledDeck();
    deck.push(...fresh);
  }
  return deck.pop()!;
}

/**
 * Calculate hand value, adjusting for aces
 */
function calculateHandValue(hand: Card[]): number {
  let value = hand.reduce((sum, card) => sum + card.value, 0);
  let aces = hand.filter(card => card.isAce).length;
  
  // Convert aces from 11 to 1 if needed
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

/**
 * Format a card for display
 */
function formatCard(card: Card): string {
  return `${card.rank}${card.suit}`;
}

/**
 * Format a hand for display
 */
function formatHand(hand: Card[], hideFirst: boolean = false): string {
  if (hideFirst && hand.length > 0) {
    return `🂠 ${hand.slice(1).map(formatCard).join(' ')}`;
  }
  return hand.map(formatCard).join(' ');
}

/**
 * Create game embed
 */
function createGameEmbed(state: GameState, showDealerCards: boolean = false): EmbedBuilder {
  const playerValue = calculateHandValue(state.playerHand);
  const dealerValue = calculateHandValue(state.dealerHand);
  
  const embed = new EmbedBuilder()
    .setColor(state.gameOver ? (state.result?.includes('gagne') ? 0x00ff00 : state.result?.includes('égalité') ? 0xffff00 : 0xff0000) : 0x0099ff)
    .setTitle('🎰 Blackjack')
    .setDescription(`💰 **Mise:** ${state.bet} pièces`)
    .addFields(
      {
        name: '🎴 Votre main',
        value: `${formatHand(state.playerHand)}\n**Valeur: ${playerValue}**`,
        inline: false
      },
      {
        name: '🎴 Main du croupier',
        value: showDealerCards 
          ? `${formatHand(state.dealerHand)}\n**Valeur: ${dealerValue}**`
          : `${formatHand(state.dealerHand, true)}\n**Valeur: ?**`,
        inline: false
      }
    );
  
  if (state.gameOver && state.result) {
    embed.addFields({
      name: '🎯 Résultat',
      value: state.result,
      inline: false
    });
  }
  
  return embed;
}

/**
 * Create action buttons
 */
function createButtons(disabled: boolean = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('hit')
        .setLabel('Tirer (Hit)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎴')
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('stand')
        .setLabel('Rester (Stand)')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✋')
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('newgame')
        .setLabel('Nouvelle partie')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );
}

/**
 * Dealer plays their hand
 */
function dealerPlay(state: GameState): void {
  // Dealer must hit until they reach 17 or higher
  while (calculateHandValue(state.dealerHand) < 17) {
    state.dealerHand.push(dealCard(state.deck));
  }
}

/**
 * Determine game result and handle payouts
 */
async function determineWinner(state: GameState): Promise<string> {
  const playerValue = calculateHandValue(state.playerHand);
  const dealerValue = calculateHandValue(state.dealerHand);
  
  let payout = 0;
  let xpGain = 0;
  let resultMessage = '';
  
  if (playerValue > 21) {
    // Player busts - loses bet
    resultMessage = `💥 Bust! Vous avez dépassé 21. Le croupier gagne!\n💸 Vous perdez **${state.bet}** pièces.`;
  } else if (dealerValue > 21) {
    // Dealer busts - player wins (2:1 payout)
    payout = state.bet * 2;
    xpGain = Math.floor(state.bet / 3);
    resultMessage = `🎉 Le croupier a fait bust! Vous gagnez!\n💰 Vous gagnez **${payout}** pièces!\n⭐ +${xpGain} XP!`;
  } else if (playerValue === 21 && state.playerHand.length === 2 && dealerValue !== 21) {
    // Natural blackjack (2.5:1 payout)
    payout = Math.floor(state.bet * 2.5);
    xpGain = Math.floor(state.bet / 2);
    resultMessage = `🎉 BLACKJACK! Vous gagnez avec un naturel!\n💰 Vous gagnez **${payout}** pièces!\n⭐ +${xpGain} XP!`;
  } else if (playerValue > dealerValue) {
    // Player wins (2:1 payout)
    payout = state.bet * 2;
    xpGain = Math.floor(state.bet / 3);
    resultMessage = `🎉 Vous gagnez! Votre main est meilleure!\n💰 Vous gagnez **${payout}** pièces!\n⭐ +${xpGain} XP!`;
  } else if (playerValue < dealerValue) {
    // Player loses
    resultMessage = `😞 Le croupier gagne. Meilleure chance la prochaine fois!\n💸 Vous perdez **${state.bet}** pièces.`;
  } else {
    // Tie - return bet
    payout = state.bet;
    resultMessage = `🤝 Égalité! Vous récupérez votre mise de **${state.bet}** pièces.`;
  }
  
  // Handle coin payout
  if (payout > 0) {
    await userLevelsDb.addCoins(state.userId, state.guildId, payout);
  }
  
  // Handle XP gain
  if (xpGain > 0) {
    await userLevelsDb.addXp(state.userId, state.guildId, xpGain);
  }
  
  return resultMessage;
}

/**
 * Initialize a new game
 */
function initializeGame(bet: number, userId: string, guildId: string): GameState {
  const deck = createShuffledDeck();
  const playerHand = [dealCard(deck), dealCard(deck)];
  const dealerHand = [dealCard(deck), dealCard(deck)];
  
  return {
    playerHand,
    dealerHand,
    deck,
    gameOver: false,
    bet,
    userId,
    guildId
  };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Jouer au Blackjack contre le croupier')
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
    
    let gameState = initializeGame(bet, userId, guildId);
    
    // Check for natural blackjack (21 on first two cards)
    const playerValue = calculateHandValue(gameState.playerHand);
    const dealerValue = calculateHandValue(gameState.dealerHand);
    
    if (playerValue === 21 || dealerValue === 21) {
      gameState.gameOver = true;
      if (playerValue === 21 && dealerValue === 21) {
        gameState.result = `🤝 Double Blackjack! Égalité!\n💰 Vous récupérez votre mise de **${bet}** pièces.`;
        await userLevelsDb.addCoins(userId, guildId, bet); // Return bet
      } else if (playerValue === 21) {
        gameState.result = await determineWinner(gameState);
      } else {
        gameState.result = `😞 Le croupier a un Blackjack naturel. Il gagne.\n💸 Vous perdez **${bet}** pièces.`;
      }
    }
    
    const embed = createGameEmbed(gameState, gameState.gameOver);
    const buttons = createButtons(gameState.gameOver);
    
    const response = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true
    });
    
    // Create collector for button interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000 // 5 minutes
    });
    
    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      // Only allow the original user to interact
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'Ce n\'est pas votre partie!',
          ephemeral: true
        });
        return;
      }
      
      if (buttonInteraction.customId === 'newgame') {
        // Check if user has enough coins for another game
        const userCoins = await userLevelsDb.getCoins(userId, guildId);
        if (userCoins < bet) {
          await buttonInteraction.reply({
            content: `❌ Vous n'avez pas assez de pièces pour une nouvelle partie! Vous avez **${userCoins}** pièces.`,
            ephemeral: true
          });
          return;
        }
        
        // Deduct the bet amount
        const success = await userLevelsDb.spendCoins(userId, guildId, bet);
        if (!success) {
          await buttonInteraction.reply({
            content: `❌ Erreur lors de la déduction des pièces. Réessayez.`,
            ephemeral: true
          });
          return;
        }
        
        // Start a new game
        gameState = initializeGame(bet, userId, guildId);
        
        // Check for natural blackjack again
        const newPlayerValue = calculateHandValue(gameState.playerHand);
        const newDealerValue = calculateHandValue(gameState.dealerHand);
        
        if (newPlayerValue === 21 || newDealerValue === 21) {
          gameState.gameOver = true;
          if (newPlayerValue === 21 && newDealerValue === 21) {
            gameState.result = `🤝 Double Blackjack! Égalité!\n💰 Vous récupérez votre mise de **${bet}** pièces.`;
            await userLevelsDb.addCoins(userId, guildId, bet); // Return bet
          } else if (newPlayerValue === 21) {
            gameState.result = await determineWinner(gameState);
          } else {
            gameState.result = `😞 Le croupier a un Blackjack naturel. Il gagne.\n💸 Vous perdez **${bet}** pièces.`;
          }
        }
        
        await buttonInteraction.update({
          embeds: [createGameEmbed(gameState, gameState.gameOver)],
          components: [createButtons(gameState.gameOver)]
        });
        return;
      }
      
      if (gameState.gameOver) {
        await buttonInteraction.reply({
          content: 'La partie est terminée! Cliquez sur "Nouvelle partie" pour recommencer.',
          ephemeral: true
        });
        return;
      }
      
      if (buttonInteraction.customId === 'hit') {
        // Player takes another card
        gameState.playerHand.push(dealCard(gameState.deck));
        const playerValue = calculateHandValue(gameState.playerHand);
        
        if (playerValue > 21) {
          // Player busts
          gameState.gameOver = true;
          gameState.result = await determineWinner(gameState);
          
          await buttonInteraction.update({
            embeds: [createGameEmbed(gameState, true)],
            components: [createButtons(true)]
          });
        } else if (playerValue === 21) {
          // Player hits 21, dealer's turn
          gameState.gameOver = true;
          dealerPlay(gameState);
          gameState.result = await determineWinner(gameState);
          
          await buttonInteraction.update({
            embeds: [createGameEmbed(gameState, true)],
            components: [createButtons(true)]
          });
        } else {
          // Continue playing
          await buttonInteraction.update({
            embeds: [createGameEmbed(gameState, false)],
            components: [createButtons(false)]
          });
        }
      } else if (buttonInteraction.customId === 'stand') {
        // Player stands, dealer plays
        gameState.gameOver = true;
        dealerPlay(gameState);
        gameState.result = await determineWinner(gameState);
        
        await buttonInteraction.update({
          embeds: [createGameEmbed(gameState, true)],
          components: [createButtons(true)]
        });
      }
    });
    
    collector.on('end', async () => {
      try {
        // Disable all buttons when collector expires
        await interaction.editReply({
          components: [createButtons(true)]
        });
      } catch (error) {
        // Message might have been deleted
        console.log('Could not disable buttons:', error);
      }
    });
  },
  
  cooldown: 3
};

// For backward compatibility with CommonJS require()
module.exports = command;
