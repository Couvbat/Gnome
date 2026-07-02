<script setup lang="ts">
import type { GameType, GameTable } from '../../types';
import { GAME_CONFIG } from '../../constants';
import GameCard from '../molecules/GameCard.vue';

withDefaults(defineProps<{
  activeTables: GameTable[];
  disabled?: boolean;
}>(), { disabled: false });

const emit = defineEmits<{ joinGame: [gameType: GameType] }>();

const GAMES = [
  {
    gameType: 'blackjack' as GameType,
    emoji: '🃏',
    title: 'Blackjack',
    description: 'Le classique du casino. Battez le croupier sans dépasser 21 !',
    getStats: (tables: GameTable[]) => [
      { label: 'Tables actives', value: tables.filter((t) => t.gameType === 'blackjack').length },
      { label: 'Mise min', value: `${GAME_CONFIG.MIN_BET} 💰` },
    ],
  },
  {
    gameType: 'roulette' as GameType,
    emoji: '🎡',
    title: 'Roulette',
    description: 'Faites vos jeux ! Roulette européenne avec des cotes équitables.',
    getStats: (tables: GameTable[]) => [
      { label: 'Tables actives', value: tables.filter((t) => t.gameType === 'roulette').length },
      { label: 'Mise min', value: `${GAME_CONFIG.MIN_BET} 💰` },
    ],
  },
  {
    gameType: 'slots' as GameType,
    emoji: '🎰',
    title: 'Machines à Sous',
    description: 'Jackpot progressif ! Tentez votre chance aux machines à sous.',
    getStats: () => [
      { label: 'Jackpot', value: `${GAME_CONFIG.JACKPOT_AMOUNT} 💰` },
      { label: 'Mise min', value: `${GAME_CONFIG.MIN_BET} 💰` },
    ],
  },
  {
    gameType: 'dice' as GameType,
    emoji: '🎲',
    title: 'Dés',
    description: 'Lancez les dés et pariez sur le résultat. Simple et addictif !',
    getStats: () => [
      { label: 'Multiplicateur', value: 'x2 - x36' },
      { label: 'Mise min', value: `${GAME_CONFIG.MIN_BET} 💰` },
    ],
  },
];
</script>

<template>
  <div>
    <h2 class="text-4xl font-semibold text-gnome-gold mb-6 text-center tracking-wide" style="letter-spacing: 0.03em;">🎰 Jeux de Casino</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <GameCard
        v-for="game in GAMES"
        :key="game.gameType"
        :emoji="game.emoji"
        :title="game.title"
        :description="game.description"
        :stats="game.getStats(activeTables)"
        :disabled="disabled"
        :game-type="game.gameType"
        @click="emit('joinGame', game.gameType)"
      />
    </div>
  </div>
</template>
