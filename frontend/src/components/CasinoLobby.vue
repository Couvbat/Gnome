<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Character, GameTable, GameType } from '../types';
import { apiService } from '../services/api';
import { isDiscordSdkReady } from '../services/discordSdk';
import { CHARACTER_CLASSES, GAME_CONFIG } from '../constants';
import type { EnergyInfo } from '../composables/useEnergy';
import Card from './atoms/Card.vue';
import CharacterInfoCard from './organisms/CharacterInfoCard.vue';
import GamesGrid from './organisms/GamesGrid.vue';
import CharacterProfile from './CharacterProfile.vue';
import VoiceParticipants from './VoiceParticipants.vue';
import BlackjackTable from './games/BlackjackTable.vue';
import RouletteWheel from './games/RouletteWheel.vue';
import SlotMachine from './games/SlotMachine.vue';
import DiceGame from './games/DiceGame.vue';

const props = defineProps<{
  character: Character;
  userCoins: number;
  energy?: EnergyInfo | null;
}>();

const emit = defineEmits<{ balanceChange: [] }>();

type View = 'lobby' | 'blackjack' | 'roulette' | 'slots' | 'dice';

const view = ref<View>('lobby');
const activeTables = ref<GameTable[]>([]);
const selectedTable = ref<GameTable | null>(null);
const showProfile = ref(false);
const lobbyError = ref<string | null>(null);
const isInDiscordActivity = isDiscordSdkReady();

async function refreshActiveTables() {
  try {
    const [blackjackTables, rouletteTables] = await Promise.all([
      apiService.getActiveTables('blackjack'),
      apiService.getActiveTables('roulette'),
    ]);
    activeTables.value = [...blackjackTables, ...rouletteTables];
    lobbyError.value = null;
  } catch (e) {
    console.error('Failed to load tables:', e);
    lobbyError.value = 'Impossible de charger les tables actives.';
  }
}

onMounted(refreshActiveTables);

// Joining/leaving the table itself happens over WebSocket inside
// BlackjackTable.vue/RouletteWheel.vue - this only picks or creates one to play at.
async function handleJoinGame(gameType: GameType) {
  try {
    if (gameType === 'slots' || gameType === 'dice') {
      view.value = gameType;
      return;
    }
    const availableTable = activeTables.value.find(
      (t) => t.gameType === gameType && (t.maxPlayers === null || t.playerCount < t.maxPlayers)
    );
    if (availableTable) {
      selectedTable.value = availableTable;
    } else if (gameType === 'blackjack') {
      selectedTable.value = await apiService.createBlackjackTable(GAME_CONFIG.MIN_BET, GAME_CONFIG.MAX_BET);
    } else {
      selectedTable.value = await apiService.createRouletteTable(GAME_CONFIG.MIN_BET, GAME_CONFIG.MAX_BET);
    }
    lobbyError.value = null;
    view.value = gameType;
  } catch (e) {
    console.error('Failed to join game:', e);
    lobbyError.value = 'Impossible de rejoindre la partie. Réessayez.';
  }
}

async function handleLeaveGame() {
  selectedTable.value = null;
  view.value = 'lobby';
  await refreshActiveTables();
}

const classInfo = CHARACTER_CLASSES[props.character.className];
</script>

<template>
  <div v-if="view !== 'lobby'" class="min-h-screen p-4">
    <BlackjackTable v-if="view === 'blackjack'" :table="selectedTable" :character-class="character.className" @leave="handleLeaveGame" @balance-change="emit('balanceChange')" />
    <RouletteWheel v-else-if="view === 'roulette'" :table="selectedTable" @leave="handleLeaveGame" @balance-change="emit('balanceChange')" />
    <SlotMachine v-else-if="view === 'slots'" @leave="handleLeaveGame" @balance-change="emit('balanceChange')" />
    <DiceGame v-else-if="view === 'dice'" @leave="handleLeaveGame" @balance-change="emit('balanceChange')" />
  </div>

  <div v-else class="max-w-7xl mx-auto space-y-8">
    <CharacterProfile v-if="showProfile" :character="character" :energy="energy" @close="showProfile = false" />
    <VoiceParticipants v-if="isInDiscordActivity" />
    <CharacterInfoCard :character="character" :user-coins="userCoins" :energy="energy" @profile-click="showProfile = true" />
    <div v-if="lobbyError" class="px-4 py-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-400 text-center text-sm">
      {{ lobbyError }}
      <button class="underline font-semibold ml-1" @click="refreshActiveTables">Réessayer</button>
    </div>
    <GamesGrid :active-tables="activeTables" @join-game="handleJoinGame" />

    <Card variant="default" padding="md" :bordered="true">
      <h3 class="text-2xl font-bold text-gnome-gold mb-3">Vos Bonus de Classe</h3>
      <p class="text-white/80">
        En tant que <strong class="text-gnome-gold capitalize">{{ classInfo?.name || character.className }}</strong>,
        vous bénéficiez de bonus spéciaux dans les jeux de casino. Consultez votre profil pour plus de détails.
      </p>
    </Card>
  </div>
</template>
