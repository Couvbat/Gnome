<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiService } from '../../services/api';
import { SLOT_SYMBOLS, GAME_CONFIG } from '../../constants';
import Button from '../atoms/Button.vue';
import Card from '../atoms/Card.vue';
import BetControls from '../molecules/BetControls.vue';
import ResultDisplay from '../molecules/ResultDisplay.vue';
import type { ResultType } from '../molecules/ResultDisplay.vue';
import GameHeader from '../organisms/GameHeader.vue';

const emit = defineEmits<{ leave: []; balanceChange: [] }>();

const reels = ref(['🍒', '🍋', '🍊']);
const spinning = ref(false);
const bet = ref(GAME_CONFIG.MIN_BET);
const result = ref<{ type: ResultType; message: string; details?: string } | null>(null);
const userBalance = ref(0);

onMounted(fetchBalance);

async function fetchBalance() {
  try {
    const user = await apiService.getCurrentUser();
    userBalance.value = user.coins;
  } catch (e) {
    console.error('Failed to fetch balance:', e);
  }
}

async function handleSpin() {
  if (spinning.value) return;
  spinning.value = true;
  result.value = null;

  let counter = 0;
  const interval = setInterval(() => {
    reels.value = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
    counter++;
    if (counter >= 15) {
      clearInterval(interval);
      spinBackend();
    }
  }, 100);
}

async function spinBackend() {
  try {
    const data = await apiService.spinSlots(bet.value, 'dragon');
    reels.value = data.result.reels;
    spinning.value = false;
    if (data.result.outcome === 'jackpot') {
      result.value = { type: 'jackpot', message: `🎉 Jackpot! +${data.result.payout} 💰`, details: `+${data.result.xpGained} XP` };
    } else if (data.result.outcome === 'win') {
      result.value = { type: 'win', message: `Gagné! +${data.result.payout} 💰`, details: `+${data.result.xpGained} XP` };
    } else {
      result.value = { type: 'lose', message: 'Perdu!', details: `+${data.result.xpGained} XP` };
    }
    await fetchBalance();
    emit('balanceChange');
  } catch (e) {
    console.error('Failed to spin:', e);
    spinning.value = false;
    alert(e instanceof Error ? e.message : 'Failed to spin slots');
  }
}

const canSpin = computed(
  () => !spinning.value && bet.value <= userBalance.value && userBalance.value >= GAME_CONFIG.MIN_BET
);

const payouts = [
  { symbols: '3x 7️⃣', multiplier: 'x10' },
  { symbols: '3x 💎', multiplier: 'x8' },
  { symbols: '3x identiques', multiplier: 'x5' },
  { symbols: '2x identiques', multiplier: 'x2' },
];
</script>

<template>
  <div class="w-full max-w-4xl mx-auto px-4 py-8">
    <GameHeader emoji="🎰" title="Machine à Sous" @leave="emit('leave')" />

    <Card
      variant="glass"
      padding="lg"
      :bordered="true"
      class="bg-gradient-to-br from-yellow-900/20 via-purple-900/20 to-red-900/20 border-4 border-gnome-gold"
    >
      <div class="text-center mb-8 bg-black/40 rounded-2xl p-6 border-2 border-gnome-gold/50">
        <h3 class="text-xl font-bold text-gnome-gold mb-2">💰 Jackpot Progressif</h3>
        <p class="text-4xl font-bold text-white animate-pulse">
          {{ GAME_CONFIG.JACKPOT_AMOUNT.toLocaleString() }} 💰
        </p>
      </div>

      <div class="flex justify-center gap-4 mb-8">
        <div
          v-for="(symbol, index) in reels"
          :key="index"
          :class="[
            'w-32 h-32 bg-white rounded-2xl flex items-center justify-center text-6xl shadow-2xl border-4 border-gnome-gold/30',
            spinning ? 'animate-bounce' : '',
          ]"
        >
          {{ symbol }}
        </div>
      </div>

      <ResultDisplay v-if="result" :result="result.type" :message="result.message" :details="result.details" />

      <div class="space-y-6">
        <BetControls
          v-model:bet="bet"
          :user-balance="userBalance"
          :disabled="spinning"
          :show-all-in="true"
          :show-reset="true"
        />

        <Button
          variant="primary"
          size="lg"
          :full-width="true"
          :disabled="!canSpin"
          class="py-6 text-2xl shadow-xl hover:shadow-2xl transform hover:scale-105"
          @click="handleSpin"
        >
          {{ spinning ? 'ROTATION...' : bet > userBalance ? 'FONDS INSUFFISANTS' : 'TOURNER' }}
        </Button>
      </div>

      <div class="mt-8 bg-black/40 rounded-2xl p-6 border border-white/20">
        <h4 class="text-xl font-bold text-gnome-gold mb-4 text-center">Table des gains</h4>
        <div class="space-y-2 text-white">
          <div
            v-for="(payout, i) in payouts"
            :key="i"
            class="flex justify-between items-center py-2 px-4 bg-white/5 rounded-lg"
          >
            <span :class="payout.symbols.startsWith('3x ') && payout.symbols.length < 10 ? 'text-2xl' : 'text-lg'">
              {{ payout.symbols }}
            </span>
            <span class="font-bold text-gnome-gold">{{ payout.multiplier }}</span>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
