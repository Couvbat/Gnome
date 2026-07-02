<script setup lang="ts">
import { getCardImage, getCardBack, type Card } from '../../../utils/cardUtils';

interface BlackjackHand {
  cards: Card[];
  total: number;
  isBust: boolean;
  isBlackjack: boolean;
}

defineProps<{ dealerHand: BlackjackHand; dealerHiddenCard: boolean }>();
</script>

<template>
  <div class="relative bg-dealer-red backdrop-blur-sm border-4 border-red-700/50 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
    <div class="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-red-800 to-red-900 px-6 py-2 rounded-full border-2 border-red-600 shadow-lg">
      <h3 class="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
        <span class="text-2xl">🎩</span>
        <span>Croupier</span>
      </h3>
    </div>

    <div class="text-center mt-4 mb-3">
      <div v-if="dealerHand.cards.length > 0 && !dealerHiddenCard" class="inline-block bg-black/50 px-4 py-2 rounded-lg border-2 border-gnome-gold/50">
        <p class="text-gnome-gold font-bold text-xl sm:text-2xl">{{ dealerHand.total }}</p>
      </div>
    </div>

    <div class="flex gap-0 justify-center items-center relative" style="min-height: 110px">
      <div v-if="dealerHand.cards.length === 0" class="text-white/50 text-sm sm:text-base italic flex items-center gap-2">
        <span class="text-2xl">⏳</span>
        <span>En attente de paris...</span>
      </div>
      <template v-else>
        <div
          v-for="(card, idx) in dealerHand.cards"
          :key="idx"
          class="transform hover:-translate-y-2 transition-transform relative"
          :style="{ animationDelay: `${idx * 0.15}s`, marginLeft: idx > 0 ? '-30px' : '0', zIndex: idx + 1 }"
        >
          <img
            :src="getCardImage(card.suit, card.rank)"
            :alt="`${card.rank} of ${card.suit}`"
            class="w-12 h-16 sm:w-14 sm:h-20 object-contain drop-shadow-2xl animate-card-deal rounded-sm"
            style="min-width: 48px; min-height: 64px"
          />
        </div>
        <div
          v-if="dealerHiddenCard"
          class="transform hover:scale-105 transition-transform relative"
          :style="{ animationDelay: `${dealerHand.cards.length * 0.15}s`, marginLeft: '-30px', zIndex: dealerHand.cards.length + 1 }"
        >
          <img
            :src="getCardBack()"
            alt="Hidden card"
            class="w-12 h-16 sm:w-14 sm:h-20 object-contain drop-shadow-2xl animate-card-deal rounded-sm"
            style="min-width: 48px; min-height: 64px"
          />
        </div>
      </template>
    </div>

    <div v-if="dealerHand.isBust" class="text-center mt-3">
      <span class="inline-block bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-red-800 animate-pulse">
        💥 CROUPIER BUST
      </span>
    </div>
    <div v-if="dealerHand.isBlackjack" class="text-center mt-3">
      <span class="inline-block bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-yellow-700 animate-pulse">
        🎩 BLACKJACK CROUPIER
      </span>
    </div>
  </div>
</template>
