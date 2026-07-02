<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { GameTable, BlackjackPlayerState } from '../../types';
import { wsService } from '../../services/websocket';
import { apiService } from '../../services/api';
import { fromBackendCard, type Card } from '../../utils/cardUtils';
import Button from '../atoms/Button.vue';
import Badge from '../atoms/Badge.vue';
import CardComponent from '../atoms/Card.vue';
import DealerSection from './blackjack/DealerSection.vue';
import PlayerSeat from './blackjack/PlayerSeat.vue';
import BettingControls from './blackjack/BettingControls.vue';
import GameControls from './blackjack/GameControls.vue';

const props = defineProps<{ table: GameTable | null; characterClass?: string }>();
const emit = defineEmits<{ leave: []; balanceChange: [] }>();

interface BlackjackHand { cards: Card[]; total: number; isBust: boolean; isBlackjack: boolean }
interface PlayerSeatData {
  userId: string; username: string; bet: number; hand: BlackjackHand;
  status: 'empty' | 'waiting' | 'betting' | 'playing' | 'standing' | 'bust' | 'blackjack' | 'won' | 'lost' | 'push';
  isCurrentPlayer?: boolean; payout?: number;
}

const MAX_SEATS = 6;
const emptyHand = (): BlackjackHand => ({ cards: [], total: 0, isBust: false, isBlackjack: false });
const emptySeat = (): PlayerSeatData => ({ userId: '', username: '', bet: 0, hand: emptyHand(), status: 'empty' });
const handFromCards = (cards: Card[]): BlackjackHand => {
  const total = cards.reduce((sum, c) => sum + c.value, 0);
  return { cards, total, isBust: total > 21, isBlackjack: total === 21 && cards.length === 2 };
};

const currentUserId = ref('');
const seats = ref<PlayerSeatData[]>(Array.from({ length: MAX_SEATS }, emptySeat));
const dealerHand = ref<BlackjackHand>(emptyHand());
const dealerHiddenCard = ref(true);
const gamePhase = ref<'waiting' | 'betting' | 'dealing' | 'playing' | 'dealer-turn' | 'finished'>('betting');
const currentPlayerId = ref<string | null>(null);
const betAmount = ref(10);
const userBalance = ref(0);
const mySeatIndex = ref(-1);
const isProcessing = ref(false);

async function fetchUserData() {
  try {
    const user = await apiService.getCurrentUser();
    userBalance.value = user.coins;
    currentUserId.value = user.id;
  } catch (e) { console.error('Failed to fetch user data:', e); }
}

function seatFromPlayerState(p: BlackjackPlayerState): PlayerSeatData {
  const cards = p.hand.map(fromBackendCard);
  return {
    userId: p.userId,
    username: p.userId === currentUserId.value ? 'You' : p.userId,
    bet: p.bet,
    hand: cards.length > 0 ? handFromCards(cards) : emptyHand(),
    status: p.isBusted ? 'bust' : p.isStanding ? 'standing' : p.hasPlacedBet ? (cards.length > 0 ? 'playing' : 'betting') : 'waiting',
  };
}

function handleJoined(data: { message: string; tableState: any }) {
  const state = data.tableState;
  if (!state) return;
  const nextSeats = Array.from({ length: MAX_SEATS }, emptySeat);
  state.players.forEach((p: BlackjackPlayerState, i: number) => {
    if (i < MAX_SEATS) nextSeats[i] = seatFromPlayerState(p);
  });
  seats.value = nextSeats;
  mySeatIndex.value = state.players.findIndex((p: BlackjackPlayerState) => p.userId === currentUserId.value);
  currentPlayerId.value = state.currentPlayer;
  gamePhase.value = state.gamePhase === 'playing' ? 'playing' : 'betting';
  if (state.dealer?.hand?.length) {
    dealerHand.value = handFromCards(state.dealer.hand.map(fromBackendCard));
    dealerHiddenCard.value = false;
  } else if (state.dealer?.upCard) {
    dealerHand.value = handFromCards([fromBackendCard(state.dealer.upCard)]);
    dealerHiddenCard.value = true;
  }
}

function handlePlayerJoined(data: { userId: string; characterClass?: string }) {
  if (data.userId === currentUserId.value) return;
  const idx = seats.value.findIndex((s) => s.status === 'empty');
  if (idx !== -1) seats.value[idx] = { userId: data.userId, username: data.userId, bet: 0, hand: emptyHand(), status: 'waiting' };
}

function handleBetPlaced(data: { userId: string; betAmount: number }) {
  const idx = seats.value.findIndex((s) => s.userId === data.userId);
  if (idx !== -1) {
    seats.value[idx].bet = data.betAmount;
    seats.value[idx].status = 'betting';
  }
}

function handleGameStarted(data: { players: Array<{ userId: string; hand: any[]; handValue: number }>; dealerUpCard: any; currentPlayer: string }) {
  data.players.forEach((p) => {
    const idx = seats.value.findIndex((s) => s.userId === p.userId);
    if (idx !== -1) {
      seats.value[idx].hand = handFromCards(p.hand.map(fromBackendCard));
      seats.value[idx].status = 'playing';
    }
  });
  dealerHand.value = handFromCards([fromBackendCard(data.dealerUpCard)]);
  dealerHiddenCard.value = true;
  currentPlayerId.value = data.currentPlayer;
  gamePhase.value = 'playing';
}

function handlePlayerHit(data: { userId: string; card: any; handValue: number; isBusted: boolean }) {
  const idx = seats.value.findIndex((s) => s.userId === data.userId);
  if (idx === -1) return;
  const cards = [...seats.value[idx].hand.cards, fromBackendCard(data.card)];
  seats.value[idx].hand = handFromCards(cards);
  if (data.isBusted) seats.value[idx].status = 'bust';
}

function handlePlayerStand(data: { userId: string }) {
  const idx = seats.value.findIndex((s) => s.userId === data.userId);
  if (idx !== -1) seats.value[idx].status = 'standing';
}

function handleTurnChanged(data: { currentPlayer: string }) {
  currentPlayerId.value = data.currentPlayer;
}

function handleDealerReveal(data: { dealerHand: any[]; dealerValue: number }) {
  dealerHand.value = handFromCards(data.dealerHand.map(fromBackendCard));
  dealerHiddenCard.value = false;
}

function handleGameComplete(data: { dealerHand: any[]; dealerValue: number; results: Array<{ userId: string; outcome: string; payout: number }> }) {
  dealerHand.value = handFromCards(data.dealerHand.map(fromBackendCard));
  dealerHiddenCard.value = false;
  data.results.forEach((r) => {
    const idx = seats.value.findIndex((s) => s.userId === r.userId);
    if (idx !== -1) {
      seats.value[idx].status = r.outcome === 'win' || r.outcome === 'blackjack' ? 'won' : r.outcome === 'push' ? 'push' : 'lost';
      seats.value[idx].payout = r.payout;
    }
  });
  gamePhase.value = 'finished';
  fetchUserData();
  emit('balanceChange');
}

function handleNewRound() {
  seats.value = seats.value.map((s) => (s.status === 'empty' ? s : { ...s, bet: 0, hand: emptyHand(), status: 'waiting', payout: undefined }));
  dealerHand.value = emptyHand();
  dealerHiddenCard.value = true;
  gamePhase.value = 'betting';
}

function handlePlayerLeft(data: { userId: string }) {
  const idx = seats.value.findIndex((s) => s.userId === data.userId);
  if (idx !== -1) seats.value[idx] = emptySeat();
}

function handleError(data: { message: string }) {
  alert(data.message);
  isProcessing.value = false;
}

onMounted(async () => {
  await fetchUserData();
  if (props.table?.id) {
    wsService.on('blackjack:joined', handleJoined);
    wsService.on('blackjack:player_joined', handlePlayerJoined);
    wsService.on('blackjack:bet_placed', handleBetPlaced);
    wsService.on('blackjack:game_started', handleGameStarted);
    wsService.on('blackjack:player_hit', handlePlayerHit);
    wsService.on('blackjack:player_stand', handlePlayerStand);
    wsService.on('blackjack:turn_changed', handleTurnChanged);
    wsService.on('blackjack:dealer_reveal', handleDealerReveal);
    wsService.on('blackjack:game_complete', handleGameComplete);
    wsService.on('blackjack:new_round', handleNewRound);
    wsService.on('blackjack:player_left', handlePlayerLeft);
    wsService.on('error', handleError);
    wsService.joinBlackjackTable(props.table.id, props.characterClass);
  }
});

onUnmounted(() => {
  wsService.off('blackjack:joined', handleJoined);
  wsService.off('blackjack:player_joined', handlePlayerJoined);
  wsService.off('blackjack:bet_placed', handleBetPlaced);
  wsService.off('blackjack:game_started', handleGameStarted);
  wsService.off('blackjack:player_hit', handlePlayerHit);
  wsService.off('blackjack:player_stand', handlePlayerStand);
  wsService.off('blackjack:turn_changed', handleTurnChanged);
  wsService.off('blackjack:dealer_reveal', handleDealerReveal);
  wsService.off('blackjack:game_complete', handleGameComplete);
  wsService.off('blackjack:new_round', handleNewRound);
  wsService.off('blackjack:player_left', handlePlayerLeft);
  wsService.off('error', handleError);
  if (props.table?.id) wsService.leaveBlackjackTable(props.table.id);
});

function placeBet() {
  if (!props.table || mySeatIndex.value === -1 || isProcessing.value) return;
  isProcessing.value = true;
  wsService.placeBlackjackBet(props.table.id, betAmount.value);
  isProcessing.value = false;
}

function hit() {
  if (!props.table || mySeatIndex.value === -1 || isProcessing.value) return;
  isProcessing.value = true;
  wsService.hitBlackjack(props.table.id);
  isProcessing.value = false;
}

function stand() {
  if (!props.table || mySeatIndex.value === -1 || isProcessing.value) return;
  isProcessing.value = true;
  wsService.standBlackjack(props.table.id);
  isProcessing.value = false;
}

function getSeatPosition(index: number) {
  const arcSpan = 140;
  const startAngle = -70;
  const angleStep = arcSpan / (MAX_SEATS - 1);
  const angle = startAngle + index * angleStep;
  const radians = (angle * Math.PI) / 180;
  const radiusX = 420;
  const radiusY = 200;
  const x = radiusX * Math.sin(radians);
  const y = radiusY * Math.cos(radians) - 80 - (index === 0 || index === 5 ? 60 : 0) + (index === 2 || index === 3 ? 30 : 0);
  return { left: '50%', top: '0%', transform: `translate(calc(-50% + ${x}px), ${y}px)` };
}
</script>

<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-gnome-dark via-gnome-purple to-gnome-dark px-2 sm:px-4 py-4 sm:py-8">
    <div class="max-w-7xl mx-auto flex items-center justify-between mb-4 sm:mb-6">
      <div class="flex items-center gap-3">
        <CardComponent variant="glass" padding="sm" class="border-gnome-gold/50">
          <h2 class="text-xl sm:text-2xl font-bold text-gnome-gold flex items-center gap-2">
            <span class="text-2xl">🃏</span>
            <span>Table de Blackjack</span>
          </h2>
        </CardComponent>
        <Badge variant="success" size="md">💰 {{ userBalance }}</Badge>
      </div>
      <Button variant="danger" size="sm" @click="emit('leave')">← Lobby</Button>
    </div>

    <div class="max-w-7xl mx-auto">
      <div class="relative mx-auto" style="max-width: 1100px">
        <div class="relative bg-wood-border rounded-b-full border-8 border-amber-950 shadow-2xl overflow-hidden">
          <div class="relative bg-felt-pattern rounded-b-full p-8 sm:p-12">
            <div class="absolute inset-6 border-4 border-amber-900/60 rounded-b-full pointer-events-none" />
            <div class="relative pt-4 pb-8">
              <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-4 bg-black/40 rounded border border-black/60" />
              <div class="mb-8 sm:mb-12 mt-8 h-48 flex items-center justify-center">
                <DealerSection :dealer-hand="dealerHand" :dealer-hidden-card="dealerHiddenCard" />
              </div>
              <div class="text-center mb-8 pointer-events-none">
                <div class="text-red-500 font-bold text-xl sm:text-2xl tracking-wider drop-shadow-lg" style="text-shadow: 0 0 10px rgba(239,68,68,0.5)">BLACKJACK PAYS 3:2</div>
                <div class="text-yellow-400 font-bold text-lg sm:text-xl tracking-widest mt-1" style="text-shadow: 0 0 10px rgba(250,204,21,0.5)">INSURANCE</div>
              </div>
              <div class="relative h-48 sm:h-56">
                <div
                  v-for="(seat, index) in seats"
                  :key="index"
                  class="absolute transition-all duration-300"
                  :style="getSeatPosition(index)"
                >
                  <PlayerSeat
                    :seat="seat"
                    :index="index"
                    :is-me="mySeatIndex === index"
                    :is-active="gamePhase === 'playing' && seat.userId === currentPlayerId && seat.status === 'playing'"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="mySeatIndex !== -1" class="mt-6 sm:mt-8 max-w-2xl mx-auto bg-black/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border-4 border-gnome-gold/40 shadow-2xl">
          <BettingControls
            v-if="gamePhase === 'betting' && seats[mySeatIndex].status === 'waiting'"
            v-model:bet-amount="betAmount"
            :user-balance="userBalance"
            :is-processing="isProcessing"
            @place-bet="placeBet"
          />
          <GameControls
            v-else-if="gamePhase === 'playing' && seats[mySeatIndex].status === 'playing' && !seats[mySeatIndex].hand.isBust && currentPlayerId === currentUserId"
            :is-processing="isProcessing"
            @hit="hit"
            @stand="stand"
          />
          <p v-else-if="gamePhase === 'playing'" class="text-center text-white/70">
            {{ currentPlayerId === currentUserId ? 'À vous de jouer !' : "En attente du tour d'un autre joueur..." }}
          </p>
          <p v-else-if="gamePhase === 'finished'" class="text-center text-gnome-gold font-bold">
            🔄 Nouvelle partie dans quelques secondes...
          </p>
        </div>

        <CardComponent v-else variant="glass" padding="lg" class="mt-6 sm:mt-8 max-w-2xl mx-auto text-center">
          <div class="text-5xl sm:text-6xl mb-4 animate-pulse">🃏</div>
          <p class="text-white/90 text-lg sm:text-xl font-semibold">Connexion à la table...</p>
        </CardComponent>

        <CardComponent variant="glass" class="mt-6 max-w-4xl mx-auto">
          <h4 class="text-lg sm:text-xl font-bold text-gnome-gold mb-4 flex items-center gap-2">
            <span class="text-2xl">📋</span>
            <span>Règles du Blackjack</span>
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-white/80 text-sm sm:text-base">
            <div class="flex items-start gap-2"><span class="text-xl">🎯</span><span>Battez le croupier sans dépasser 21</span></div>
            <div class="flex items-start gap-2"><span class="text-xl">🃏</span><span>Figures (J/Q/K) = 10 points</span></div>
            <div class="flex items-start gap-2"><span class="text-xl">🅰️</span><span>As = 1 ou 11 points (automatique)</span></div>
            <div class="flex items-start gap-2"><span class="text-xl">🎰</span><span>Blackjack = paiement 3:2 (bonus)</span></div>
          </div>
        </CardComponent>
      </div>
    </div>
  </div>
</template>
