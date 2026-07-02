<script setup lang="ts">
import { computed } from 'vue';
import Card from '../atoms/Card.vue';
import ProgressBar from '../atoms/ProgressBar.vue';

const props = defineProps<{
  current: number;
  max: number;
  regenRate: number;
  minutesUntilFull: number;
}>();

const percentage = computed(() => Math.min(100, (props.current / props.max) * 100));
</script>

<template>
  <Card variant="default" padding="md" :bordered="true">
    <h3 class="text-xl font-bold text-gnome-gold mb-4">⚡ Système d'Énergie</h3>
    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-white/70">Énergie Actuelle</span>
        <span class="text-white font-bold">{{ Math.round(current * 10) / 10 }} / {{ max }}</span>
      </div>
      <ProgressBar :value="percentage" :max="100" color="gold" size="lg" />
      <div class="flex justify-between text-sm text-white/50">
        <span>Régénération: {{ regenRate }}/min</span>
        <span v-if="minutesUntilFull > 0">Plein dans ~{{ minutesUntilFull }} min</span>
        <span v-else class="text-green-400">Énergie pleine !</span>
      </div>
    </div>
  </Card>
</template>
