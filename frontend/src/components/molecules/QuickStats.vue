<script setup lang="ts">
import StatValue from '../atoms/StatValue.vue';

defineProps<{
  level: number;
  energy: number;
  maxEnergy: number;
  coins: number;
}>();
</script>

<template>
  <div class="grid grid-cols-3 gap-4">
    <StatValue label="Niveau" :value="level" size="md" />
    <StatValue label="Énergie" :value="`${energy}/${maxEnergy}`" size="md" />
    <StatValue label="Pièces" :value="coins" icon="💰" size="md" variant="gold" />
  </div>
</template>
