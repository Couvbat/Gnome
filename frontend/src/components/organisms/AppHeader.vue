<script setup lang="ts">
import { computed } from 'vue';
import type { User, Character } from '../../types';
import Badge from '../atoms/Badge.vue';
import { GAME_CONFIG } from '../../constants';

interface EnergyInfo {
  current: number;
  max: number;
  regenRate: number;
  lastRegen: string;
  minutesUntilFull: number;
}

const props = defineProps<{
  user: User | null;
  character?: Character | null;
  energy?: EnergyInfo | null;
}>();

const emit = defineEmits<{ profileClick: [] }>();

const currentEnergy = computed(
  () => props.energy?.current ?? props.character?.energy ?? GAME_CONFIG.BASE_ENERGY
);
const maxEnergy = computed(
  () => props.energy?.max ?? props.character?.maxEnergy ?? GAME_CONFIG.MAX_ENERGY
);
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-gnome-gold/20"
    style="background: linear-gradient(135deg, #130B05 0%, #2A1A0E 50%, #1A0E06 100%); box-shadow: 0 4px 32px rgba(0,0,0,0.7), 0 1px 0 rgba(200,146,42,0.12);"
  >
    <div class="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
      <h1
        class="text-xl md:text-2xl font-semibold italic tracking-wide drop-shadow-lg"
        style="font-family: var(--font-display); color: #C8922A; text-shadow: 0 0 20px rgba(200,146,42,0.35);"
      >
        🏰 La Taverne Dorée du Gnome
      </h1>
      <div v-if="user" class="flex flex-wrap items-center gap-2 md:gap-4">
        <button
          class="flex items-center gap-2 px-3 py-1.5 backdrop-blur-md rounded-lg text-sm md:text-base transition-all duration-200 cursor-pointer"
          style="background: rgba(200,146,42,0.08); border: 1px solid rgba(200,146,42,0.2); color: #E5C57C;"
          title="Voir le profil"
          @click="emit('profileClick')"
        >
          <img
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            :alt="user.discordUsername || user.username"
            class="w-6 h-6 rounded-full"
            style="border: 1px solid rgba(200,146,42,0.5);"
          />
          <span v-else>👤</span>
          {{ user.discordGlobalName || user.username }}
        </button>
        <Badge variant="gold">
          <span style="font-family: var(--font-mono);">💰 {{ user.coins }}</span>
          <span class="text-gnome-gold/60 ml-1 text-xs" style="font-family: var(--font-body);">pièces</span>
        </Badge>
        <Badge v-if="character" variant="default">
          ⚡ <span style="font-family: var(--font-mono);">{{ Math.round(currentEnergy * 10) / 10 }}/{{ maxEnergy }}</span>
        </Badge>
        <Badge variant="default">⭐ Niv. <span style="font-family: var(--font-mono);">{{ user.level }}</span></Badge>
      </div>
    </div>
  </header>
</template>
