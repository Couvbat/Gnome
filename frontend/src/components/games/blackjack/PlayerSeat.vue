<script setup lang="ts">
import { getCardImage, getCardBack, type Card } from '../../../utils/cardUtils';

interface BlackjackHand {
  cards: Card[];
  total: number;
  isBust: boolean;
  isBlackjack: boolean;
}

interface PlayerSeatData {
  userId: string;
  username: string;
  bet: number;
  hand: BlackjackHand;
  status: 'empty' | 'waiting' | 'betting' | 'playing' | 'standing' | 'bust' | 'blackjack' | 'won' | 'lost' | 'push';
  isCurrentPlayer?: boolean;
  payout?: number;
}

const props = defineProps<{
  seat: PlayerSeatData;
  index: number;
  isMe: boolean;
  isActive: boolean;
}>();

const emit = defineEmits<{ joinSeat: [index: number] }>();

const isEmpty = () => props.seat.status === 'empty';
const isTerminal = (status: string) => ['won', 'lost', 'push', 'bust', 'blackjack'].includes(status);
</script>

<template>
  <div class="relative w-32 sm:w-36 flex-shrink-0">
    <div
      :class="[
        'w-full h-32 sm:h-36 border-4 rounded-full flex items-center justify-center relative',
        isEmpty() ? 'border-yellow-500/50' : 'border-yellow-400',
        isActive ? 'border-yellow-300 shadow-lg shadow-yellow-400/50 animate-pulse' : '',
      ]"
    >
      <div class="absolute inset-2 border-2 border-yellow-500/30 rounded-full pointer-events-none" />

      <div class="absolute -top-3 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-gradient-to-br from-gnome-gold to-yellow-600 rounded-full flex items-center justify-center font-bold text-gnome-dark shadow-lg border-2 border-yellow-900 z-50">
        {{ index + 1 }}
      </div>

      <div
        :class="[
          'w-full h-full rounded-full p-1.5 flex flex-col items-center justify-center transition-all duration-300',
          isEmpty() ? 'hover:bg-yellow-500/10 cursor-pointer' : 'bg-black/20 backdrop-blur-sm cursor-default',
          isMe && !isEmpty() ? 'bg-blue-900/30 border-2 border-blue-400/50 rounded-full' : '',
        ]"
        @click="isEmpty() && emit('joinSeat', index)"
      >
        <div v-if="isEmpty()" class="flex-1 flex items-center justify-center">
          <div class="text-center opacity-50 hover:opacity-100 transition-opacity">
            <div class="text-5xl sm:text-6xl mb-2">💺</div>
            <p class="text-white/70 text-xs sm:text-sm font-semibold">Place libre</p>
          </div>
        </div>
        <template v-else>
          <div class="absolute top-2 left-1/2 transform -translate-x-1/2 text-center w-full px-2 pointer-events-none">
            <div class="flex items-center justify-center gap-1 mb-1">
              <span class="text-base">{{ isMe ? '👤' : '👥' }}</span>
              <p class="text-white font-bold text-xs truncate max-w-[80px]">{{ isMe ? 'Vous' : seat.username }}</p>
            </div>
            <div v-if="seat.bet > 0" class="inline-flex items-center gap-1 bg-gnome-gold/20 px-2 py-0.5 rounded-full border border-gnome-gold/50">
              <span class="text-gnome-gold font-bold text-xs">{{ seat.bet }}💰</span>
            </div>
          </div>

          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="flex gap-0.5 justify-center items-center relative">
              <div
                v-for="(card, cardIdx) in seat.hand.cards"
                :key="`${card.suit}-${card.rank}-${cardIdx}`"
                class="transform transition-transform relative"
                :style="{ animationDelay: `${cardIdx * 0.1}s`, marginLeft: cardIdx > 0 ? '-24px' : '0', zIndex: cardIdx + 1 }"
              >
                <img
                  v-if="card.suit && card.rank && card.value !== 0"
                  :src="getCardImage(card.suit, card.rank)"
                  :alt="`${card.rank} of ${card.suit}`"
                  class="w-12 h-16 sm:w-14 sm:h-20 object-contain drop-shadow-2xl animate-card-deal rounded-sm"
                  style="min-width: 48px; min-height: 64px"
                />
                <img
                  v-else
                  :src="getCardBack()"
                  alt="Hidden card"
                  class="w-12 h-16 sm:w-14 sm:h-20 object-contain drop-shadow-2xl animate-card-deal rounded-sm"
                  style="min-width: 48px; min-height: 64px"
                />
              </div>
            </div>
          </div>

          <div v-if="seat.hand.cards.length > 0 && isMe && !isTerminal(seat.status)" class="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none">
            <div class="inline-block bg-black/80 px-2 py-0.5 rounded-lg border border-white/30">
              <span class="text-white font-bold text-sm">{{ seat.hand.total }}</span>
            </div>
          </div>

          <div class="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex justify-center pointer-events-none">
            <span v-if="seat.status === 'bust'" class="bg-gradient-to-r from-red-600 to-red-700 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg border border-red-800 animate-pulse whitespace-nowrap">💥 BUST</span>
            <span v-else-if="seat.status === 'blackjack'" class="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-2 py-1 rounded-full text-xs font-bold shadow-lg border border-yellow-700 animate-pulse whitespace-nowrap">🎉 BJ!</span>
            <span v-else-if="seat.status === 'won'" class="bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg border border-green-700 whitespace-nowrap">✅ +{{ seat.payout }}</span>
            <span v-else-if="seat.status === 'lost'" class="bg-gradient-to-r from-red-600 to-red-700 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg border border-red-800 whitespace-nowrap">❌ -{{ seat.bet }}</span>
            <span v-else-if="seat.status === 'push'" class="bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg border border-yellow-800 whitespace-nowrap">🤝 Push</span>
            <span v-else-if="seat.status === 'standing'" class="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg border border-blue-700 whitespace-nowrap">✋ Stand</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
