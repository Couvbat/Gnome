<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiService } from '../../services/api';
import { DICE_CONFIG, GAME_CONFIG } from '../../constants';
import Button from '../atoms/Button.vue';
import Card from '../atoms/Card.vue';
import BetControls from '../molecules/BetControls.vue';
import ResultDisplay from '../molecules/ResultDisplay.vue';
import type { ResultType } from '../molecules/ResultDisplay.vue';
import GameHeader from '../organisms/GameHeader.vue';

const emit = defineEmits<{ leave: []; balanceChange: [] }>();

const dice = ref([1, 1]);
const rolling = ref(false);
const bet = ref(GAME_CONFIG.MIN_BET);
const prediction = ref<number | null>(null);
const result = ref<{ type: ResultType; message: string; details?: string } | null>(null);
const userBalance = ref(0);

const dieFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const getDieFace = (v: number) => dieFaces[v - 1] ?? '⚀';

onMounted(fetchBalance);

async function fetchBalance() {
  try {
    const user = await apiService.getCurrentUser();
    userBalance.value = user.coins;
  } catch (e) {
    console.error('Failed to fetch balance:', e);
  }
}

async function handleRoll() {
  if (!prediction.value || rolling.value) return;
  rolling.value = true;
  result.value = null;

  let counter = 0;
  const interval = setInterval(() => {
    dice.value = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    counter++;
    if (counter >= 10) {
      clearInterval(interval);
      rollBackend();
    }
  }, 100);
}

async function rollBackend() {
  try {
    const data = await apiService.rollDice(bet.value, prediction.value!);
    dice.value = data.result.dice;
    rolling.value = false;
    if (data.result.outcome === 'win') {
      result.value = { type: 'win', message: `🎉 Gagné! +${data.result.payout} 💰 (${data.result.payoutMultiplier}x)`, details: `+${data.result.xpGained} XP` };
    } else {
      result.value = { type: 'lose', message: `Perdu! Le total était ${data.result.total}`, details: `+${data.result.xpGained} XP` };
    }
    await fetchBalance();
    emit('balanceChange');
  } catch (e) {
    console.error('Failed to roll dice:', e);
    rolling.value = false;
    alert(e instanceof Error ? e.message : 'Failed to roll dice');
  }
}

const canRoll = computed(
  () => !rolling.value && prediction.value !== null && bet.value <= userBalance.value && userBalance.value >= GAME_CONFIG.MIN_BET
);

const diceNumbers = Array.from({ length: 11 }, (_, i) => i + 2);

const rules = [
  { description: '2 ou 12 (très rare)', multiplier: 'x36' },
  { description: '3 ou 11 (rare)', multiplier: 'x18' },
  { description: '4 ou 10 (peu commun)', multiplier: 'x12' },
  { description: 'Autres totaux', multiplier: 'x6' },
];
</script>

<template>
  <div class="w-full max-w-5xl mx-auto px-4 py-8">
    <GameHeader emoji="🎲" title="Jeu de Dés" @leave="emit('leave')" />

    <Card variant="default" padding="lg" :bordered="true">
      <div class="flex justify-center gap-8 mb-8">
        <div
          v-for="(die, index) in dice"
          :key="index"
          :class="[
            'w-32 h-32 bg-white rounded-2xl flex items-center justify-center text-7xl shadow-2xl border-4 border-gnome-gold/30',
            rolling ? 'animate-spin' : '',
          ]"
        >
          {{ getDieFace(die) }}
        </div>
      </div>

      <div class="text-center mb-6">
        <h3 class="text-3xl font-bold text-gnome-gold">Total: {{ dice[0] + dice[1] }}</h3>
      </div>

      <ResultDisplay v-if="result" :result="result.type" :message="result.message" :details="result.details" />

      <div class="mb-8">
        <h4 class="text-xl font-bold text-white mb-4 text-center">Prédisez le total des dés:</h4>
        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2">
          <button
            v-for="num in diceNumbers"
            :key="num"
            :class="[
              'flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all',
              prediction === num
                ? 'bg-gnome-gold text-gnome-dark border-gnome-gold shadow-lg scale-110'
                : 'bg-white/10 text-white border-white/20 hover:border-gnome-gold/50 hover:bg-white/20',
              rolling ? 'opacity-50 cursor-not-allowed' : '',
            ]"
            :disabled="rolling"
            @click="!rolling && (prediction = num)"
          >
            <span class="text-2xl font-bold">{{ num }}</span>
            <span class="text-xs mt-1">x{{ DICE_CONFIG.MULTIPLIERS[num] || 6 }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 mt-8">
        <BetControls v-model:bet="bet" :user-balance="userBalance" :disabled="rolling" :show-all-in="true" :show-reset="true" />

        <Button variant="primary" size="lg" :full-width="true" :disabled="!canRoll" class="py-6 text-2xl" @click="handleRoll">
          {{ rolling ? 'LANCEMENT...' : bet > userBalance ? 'FONDS INSUFFISANTS' : !prediction ? 'CHOISISSEZ UNE PRÉDICTION' : '🎲 LANCER LES DÉS' }}
        </Button>
      </div>

      <div class="mt-8 bg-black/40 rounded-2xl p-6 border border-white/20">
        <h4 class="text-xl font-bold text-gnome-gold mb-3 flex items-center gap-2">📋 Règles</h4>
        <p class="text-white/90 mb-3">Prédisez le total des deux dés. Plus c'est rare, plus vous gagnez!</p>
        <ul class="space-y-2 text-white/80">
          <li v-for="(rule, i) in rules" :key="i" class="flex justify-between items-center py-1 px-3 bg-white/5 rounded">
            <span>{{ rule.description }}</span>
            <span class="font-bold text-gnome-gold">{{ rule.multiplier }}</span>
          </li>
        </ul>
      </div>
    </Card>
  </div>
</template>
