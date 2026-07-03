<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onBeforeUnmount } from 'vue';
import type { GameTable } from '../../types';
import { apiService } from '../../services/api';
import { wsService } from '../../services/websocket';
import { getRouletteNumberColor } from '../../constants';
import Button from '../atoms/Button.vue';
import Card from '../atoms/Card.vue';
import Badge from '../atoms/Badge.vue';
import Spinner from '../atoms/Spinner.vue';
import ResultDisplay from '../molecules/ResultDisplay.vue';
import RouletteNumberGrid from '../molecules/RouletteNumberGrid.vue';
import RouletteBetButtons from '../molecules/RouletteBetButtons.vue';
import type { RouletteBetType } from '../molecules/RouletteBetButtons.vue';
import GameHeader from '../organisms/GameHeader.vue';

const props = defineProps<{ table: GameTable | null }>();
const emit = defineEmits<{ leave: []; balanceChange: [] }>();

interface PlayerBet { userId: string; bets: Array<{ type: string; value?: number; amount: number }>; totalWagered: number }

const currentUserId = ref('');
const bets = ref<Record<string, number>>({});
const gamePhase = ref<'waiting' | 'betting' | 'spinning' | 'payouts'>('waiting');
const secondsLeft = ref(0);
const spinning = ref(false);
const result = ref<number | null>(null);
const resultMessage = ref<string | null>(null);
const resultType = ref<'win' | 'lose'>('lose');
const betAmount = ref(10);
const userBalance = ref(0);
const otherPlayers = ref<Map<string, PlayerBet>>(new Map());
let countdownTimer: ReturnType<typeof setInterval> | null = null;
// Snapshot of `bets` right before the most recent optimistic update, so a
// server rejection (the generic 'error' event) can roll the local state back
// instead of leaving a bet displayed that the server never accepted.
let previousBetsSnapshot: Record<string, number> | null = null;

const balanceError = ref(false);

async function fetchBalance() {
  try {
    const user = await apiService.getCurrentUser();
    userBalance.value = user.coins;
    currentUserId.value = user.id;
    balanceError.value = false;
  } catch (e) {
    console.error('Failed to fetch balance:', e);
    balanceError.value = true;
  }
}

function startCountdown(seconds: number) {
  secondsLeft.value = seconds;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value -= 1;
  }, 1000);
}

function betsToArray(): Array<{ type: string; value?: number; amount: number }> {
  return Object.entries(bets.value).map(([position, amount]) => {
    if (position.startsWith('number-')) {
      return { type: 'straight', value: parseInt(position.replace('number-', ''), 10), amount };
    }
    return { type: position, amount };
  });
}

function sendBets() {
  if (props.table?.id) wsService.placeRouletteBet(props.table.id, betsToArray());
}

function handleTableState(data: { gamePhase: string; timeRemaining: number } | null) {
  if (!data) return;
  gamePhase.value = data.gamePhase as typeof gamePhase.value;
  if (data.gamePhase === 'betting') startCountdown(data.timeRemaining);
}

function handleBettingOpened(data: { timeRemaining: number }) {
  gamePhase.value = 'betting';
  bets.value = {};
  previousBetsSnapshot = null;
  otherPlayers.value = new Map();
  result.value = null;
  resultMessage.value = null;
  startCountdown(data.timeRemaining);
}

function handleBettingClosing(data: { countdown: number }) {
  secondsLeft.value = data.countdown;
}

function handlePlayerBet(data: PlayerBet) {
  if (data.userId === currentUserId.value) return;
  const updated = new Map(otherPlayers.value);
  updated.set(data.userId, data);
  otherPlayers.value = updated;
}

function handleBettingClosed() {
  gamePhase.value = 'spinning';
  if (countdownTimer) clearInterval(countdownTimer);
}

function handleSpinStarted() {
  spinning.value = true;
}

function handleSpinResult(data: { number: number; color: 'red' | 'black' | 'green'; winners: Array<{ userId: string; payout: number }>; totalPayouts: number }) {
  gamePhase.value = 'payouts';
  spinning.value = false;
  result.value = data.number;
  const myWin = data.winners.find((w) => w.userId === currentUserId.value);
  const totalBet = Object.values(bets.value).reduce((s, a) => s + a, 0);
  if (myWin) {
    resultMessage.value = `🎉 Gagné ${myWin.payout} pièces!`;
    resultType.value = 'win';
  } else if (totalBet > 0) {
    resultMessage.value = `Perdu ${totalBet} pièces! Aucun pari gagnant.`;
    resultType.value = 'lose';
  } else {
    resultMessage.value = null;
  }
  fetchBalance();
  emit('balanceChange');
}

function handlePlayerLeft(data: { userId: string }) {
  const updated = new Map(otherPlayers.value);
  updated.delete(data.userId);
  otherPlayers.value = updated;
}

// Server ack for our own bet placement ('roulette:bet_placed' is sent only to
// the placing socket). Once confirmed, the pre-bet snapshot must be discarded
// so a later, unrelated error can't roll back a bet the server has accepted.
function handleBetConfirmed() {
  previousBetsSnapshot = null;
}

function handleError(data: { message: string }) {
  // Bets are applied optimistically (placeBet/clearBets below) before the
  // server confirms them. On rejection, roll back to the snapshot taken right
  // before that optimistic update instead of leaving a phantom bet on screen.
  if (previousBetsSnapshot) {
    bets.value = previousBetsSnapshot;
    previousBetsSnapshot = null;
  }
  alert(data.message);
}

onMounted(async () => {
  await fetchBalance();
  if (props.table?.id) {
    wsService.on('roulette:table_state', handleTableState);
    wsService.on('roulette:betting_opened', handleBettingOpened);
    wsService.on('roulette:betting_closing', handleBettingClosing);
    wsService.on('roulette:bet_placed', handleBetConfirmed);
    wsService.on('roulette:player_bet', handlePlayerBet);
    wsService.on('roulette:betting_closed', handleBettingClosed);
    wsService.on('roulette:spin_started', handleSpinStarted);
    wsService.on('roulette:spin_result', handleSpinResult);
    wsService.on('table:player_left', handlePlayerLeft);
    wsService.on('error', handleError);
    wsService.joinRouletteTable(props.table.id);
  }
});

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});

onUnmounted(() => {
  wsService.off('roulette:table_state', handleTableState);
  wsService.off('roulette:betting_opened', handleBettingOpened);
  wsService.off('roulette:betting_closing', handleBettingClosing);
  wsService.off('roulette:bet_placed', handleBetConfirmed);
  wsService.off('roulette:player_bet', handlePlayerBet);
  wsService.off('roulette:betting_closed', handleBettingClosed);
  wsService.off('roulette:spin_started', handleSpinStarted);
  wsService.off('roulette:spin_result', handleSpinResult);
  wsService.off('table:player_left', handlePlayerLeft);
  wsService.off('error', handleError);
  if (props.table?.id) wsService.leaveRouletteTable(props.table.id);
});

function placeBet(position: string, amount: number) {
  if (gamePhase.value !== 'betting') return;
  const totalBets = Object.values(bets.value).reduce((a, b) => a + b, 0);
  if (totalBets + amount > userBalance.value) { alert('Fonds insuffisants!'); return; }
  previousBetsSnapshot = { ...bets.value };
  bets.value = { ...bets.value, [position]: (bets.value[position] || 0) + amount };
  sendBets();
}

function handleNumberClick(num: number) { placeBet(`number-${num}`, betAmount.value); }
function handleSpecialBet(betType: RouletteBetType, amount: number) { placeBet(betType, amount); }

function clearBets() {
  previousBetsSnapshot = { ...bets.value };
  bets.value = {};
  sendBets();
}

function formatBetLabel(position: string): string {
  if (position.startsWith('number-')) return `#${position.replace('number-', '')}`;
  const labels: Record<string, string> = { red: 'Rouge', black: 'Noir', even: 'Pair', odd: 'Impair', low: '1-18', high: '19-36' };
  return labels[position] ?? position;
}

function formatBackendBet(bet: { type: string; value?: number }): string {
  if (bet.type === 'straight') return `#${bet.value}`;
  return formatBetLabel(bet.type);
}

const totalBetsAmount = computed(() => Object.values(bets.value).reduce((a, b) => a + b, 0));
const availableBalance = computed(() => userBalance.value - totalBetsAmount.value);

const selectedNumbers = computed(
  () => new Set(Object.keys(bets.value).filter((k) => k.startsWith('number-')).map((k) => parseInt(k.replace('number-', ''))))
);

const wheelBgClass = computed(() => {
  if (result.value === null || spinning.value) return 'bg-gradient-to-br from-red-900 via-black to-green-900';
  const color = getRouletteNumberColor(result.value);
  if (color === 'red') return 'bg-red-600';
  if (color === 'green') return 'bg-green-600';
  return 'bg-black';
});

const resultColorClass = computed(() => {
  if (result.value === null) return '';
  const color = getRouletteNumberColor(result.value);
  if (color === 'red') return 'text-red-400';
  if (color === 'green') return 'text-green-400';
  return 'text-gray-300';
});

const resultColorLabel = computed(() => {
  if (result.value === null) return '';
  const color = getRouletteNumberColor(result.value);
  if (color === 'red') return 'Rouge';
  if (color === 'green') return 'Vert';
  return 'Noir';
});
</script>

<template>
  <div class="w-full max-w-6xl mx-auto px-4 py-8">
    <GameHeader emoji="🎡" title="Roulette Européenne" @leave="emit('leave')">
      <template #right>
        <Badge variant="success" size="md">💰 {{ userBalance }}</Badge>
      </template>
    </GameHeader>

    <div v-if="balanceError" class="mb-4 px-4 py-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-400 text-center text-sm">
      Impossible de récupérer votre solde.
      <button class="underline font-semibold ml-1" @click="fetchBalance">Réessayer</button>
    </div>

    <Card variant="glass" class="mb-6 text-center">
      <p v-if="gamePhase === 'betting'" class="text-xl font-bold text-gnome-gold">
        ⏱️ Paris ouverts - {{ secondsLeft }}s restantes
      </p>
      <p v-else-if="gamePhase === 'spinning'" class="text-xl font-bold text-gnome-gold animate-pulse">
        La roue tourne...
      </p>
      <p v-else-if="gamePhase === 'payouts'" class="text-xl font-bold text-white">
        Prochain tour dans quelques secondes...
      </p>
      <p v-else class="text-white/70">Connexion à la table...</p>
    </Card>

    <Card v-if="otherPlayers.size > 0" variant="glass" class="mb-6">
      <h3 class="text-lg font-bold text-gnome-gold mb-3">👥 Joueurs à la table ({{ otherPlayers.size }})</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card v-for="[, player] in otherPlayers" :key="player.userId" variant="glass" padding="sm">
          <div class="flex justify-between items-center mb-2">
            <span class="font-bold text-white">{{ player.userId }}</span>
            <Badge variant="gold">{{ player.totalWagered }}💰</Badge>
          </div>
          <div v-if="player.bets.length > 0" class="text-xs text-white/60 flex flex-wrap gap-1">
            <Badge v-for="(bet, i) in player.bets" :key="i" variant="default" size="sm">
              {{ formatBackendBet(bet) }}: {{ bet.amount }}
            </Badge>
          </div>
        </Card>
      </div>
    </Card>

    <Card variant="glass" padding="lg" class="mb-6">
      <div class="flex flex-col items-center gap-4">
        <div :class="['relative w-48 h-48 rounded-full border-8 border-gnome-gold flex items-center justify-center shadow-2xl', spinning ? 'animate-spin' : '', wheelBgClass]">
          <div class="text-5xl font-bold text-white drop-shadow-lg">
            <Spinner v-if="spinning" size="lg" />
            <template v-else>{{ result !== null ? result : '?' }}</template>
          </div>
        </div>
        <p v-if="spinning" class="text-xl text-gnome-gold animate-pulse">La roue tourne...</p>
        <p v-else-if="result !== null" class="text-xl font-bold text-white">
          {{ result }} - <span :class="resultColorClass">{{ resultColorLabel }}</span>
        </p>
        <ResultDisplay v-if="resultMessage && !spinning" :result="resultType" :message="resultMessage" />
      </div>
    </Card>

    <Card variant="glass" class="mb-6">
      <h3 class="text-2xl font-bold text-gnome-gold mb-6 text-center">Table de Paris</h3>

      <div class="mb-6 flex flex-col items-center gap-3">
        <div class="flex items-center gap-4">
          <label class="text-white font-bold">Montant par pari:</label>
          <div class="flex gap-2">
            <Button v-for="amount in [10, 25, 50, 100]" :key="amount" :variant="betAmount === amount ? 'gold' : 'ghost'" size="sm" @click="betAmount = amount">{{ amount }}</Button>
            <Button variant="danger" size="sm" :disabled="availableBalance <= 0" @click="betAmount = availableBalance">🔥 All In</Button>
          </div>
        </div>
        <p class="text-white/70 text-sm">Solde disponible: <span class="text-gnome-gold font-bold">{{ availableBalance }} 💰</span></p>
      </div>

      <div class="mb-6">
        <RouletteNumberGrid :selected-numbers="selectedNumbers" :on-number-click="handleNumberClick" :disabled="gamePhase !== 'betting'" />
        <div v-if="Object.entries(bets).filter(([k]) => k.startsWith('number-')).length > 0" class="mt-4 flex flex-wrap justify-center gap-2">
          <Badge v-for="[pos, amount] in Object.entries(bets).filter(([k]) => k.startsWith('number-'))" :key="pos" variant="gold" size="sm">
            #{{ pos.replace('number-', '') }}: {{ amount }}💰
          </Badge>
        </div>
      </div>

      <div class="mb-6">
        <RouletteBetButtons :bet-amount="betAmount" :disabled="gamePhase !== 'betting'" @bet-placed="handleSpecialBet" />
        <div v-if="Object.entries(bets).filter(([k]) => !k.startsWith('number-')).length > 0" class="mt-4 flex flex-wrap justify-center gap-2">
          <Badge v-for="[pos, amount] in Object.entries(bets).filter(([k]) => !k.startsWith('number-'))" :key="pos" variant="gold" size="sm">
            {{ formatBetLabel(pos) }}: {{ amount }}💰
          </Badge>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/20">
        <div class="flex-1">
          <h4 class="text-xl font-bold text-white mb-2">Total des paris: <span class="text-gnome-gold">{{ totalBetsAmount }} 💰</span></h4>
          <div v-if="Object.keys(bets).length > 0" class="text-sm text-white/70 flex flex-wrap gap-2">
            <Badge v-for="[pos, amount] in Object.entries(bets)" :key="pos" variant="default" size="sm">
              {{ formatBetLabel(pos) }}: {{ amount }}💰
            </Badge>
          </div>
        </div>
        <div class="flex gap-3">
          <Button variant="secondary" :disabled="gamePhase !== 'betting' || Object.keys(bets).length === 0" @click="clearBets">Effacer</Button>
        </div>
      </div>
    </Card>
  </div>
</template>
