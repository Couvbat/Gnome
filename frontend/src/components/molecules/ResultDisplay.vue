<script setup lang="ts">
export type ResultType = 'win' | 'lose' | 'push' | 'jackpot';

const props = defineProps<{ result: ResultType; message: string; details?: string }>();

const resultStyles: Record<ResultType, string> = {
  win: 'bg-green-500/20 text-green-300 border-green-500',
  jackpot: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
  lose: 'bg-red-500/20 text-red-300 border-red-500',
  push: 'bg-blue-500/20 text-blue-300 border-blue-500',
};
</script>

<template>
  <div :class="['text-center p-4 rounded-xl mb-6 border-2', resultStyles[props.result]]">
    <p class="text-xl font-bold">{{ message }}</p>
    <p v-if="details" class="text-sm mt-1 opacity-80">{{ details }}</p>
  </div>
</template>
