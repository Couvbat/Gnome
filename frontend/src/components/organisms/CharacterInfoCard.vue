<script setup lang="ts">
import { computed } from 'vue';
import type { Character } from '../../types';
import { CHARACTER_CLASSES, GAME_CONFIG } from '../../constants';
import Card from '../atoms/Card.vue';
import Button from '../atoms/Button.vue';
import QuickStats from '../molecules/QuickStats.vue';

interface EnergyInfo {
  current: number;
  max: number;
  regenRate: number;
  lastRegen: string;
  minutesUntilFull: number;
}

const props = defineProps<{
  character: Character;
  userCoins: number;
  energy?: EnergyInfo | null;
}>();

const emit = defineEmits<{ profileClick: [] }>();

const classInfo = computed(() => CHARACTER_CLASSES[props.character.className]);
const currentEnergy = computed(
  () => props.energy?.current ?? props.character.energy ?? GAME_CONFIG.BASE_ENERGY
);
const maxEnergy = computed(
  () => props.energy?.max ?? props.character.maxEnergy ?? GAME_CONFIG.MAX_ENERGY
);
</script>

<template>
  <Card variant="default" padding="md" :bordered="true">
    <div class="flex items-start justify-between mb-4">
      <h3 class="text-2xl font-bold text-gnome-gold flex items-center gap-2">
        {{ classInfo?.emoji || '👤' }}
        <span>{{ character.name }}</span>
      </h3>
      <Button variant="gold" size="sm" @click="emit('profileClick')">
        <span>👤</span>
        <span>Voir Profil</span>
      </Button>
    </div>
    <QuickStats
      :level="character.level"
      :energy="Math.round(currentEnergy * 10) / 10"
      :max-energy="maxEnergy"
      :coins="userCoins"
    />
  </Card>
</template>
