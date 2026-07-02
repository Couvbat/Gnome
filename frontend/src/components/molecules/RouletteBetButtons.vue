<script setup lang="ts">
export type RouletteBetType = 'red' | 'black' | 'even' | 'odd' | 'low' | 'high';

defineProps<{
  betAmount: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{ betPlaced: [type: RouletteBetType, amount: number] }>();

const betOptions: Array<{ type: RouletteBetType; label: string; color: string }> = [
  { type: 'red', label: 'Rouge (x2)', color: 'bg-red-600 hover:bg-red-500 border-red-500' },
  { type: 'black', label: 'Noir (x2)', color: 'bg-gray-900 hover:bg-gray-800 border-gray-700' },
  { type: 'even', label: 'Pair (x2)', color: 'bg-white/10 hover:bg-white/20 border-white/30' },
  { type: 'odd', label: 'Impair (x2)', color: 'bg-white/10 hover:bg-white/20 border-white/30' },
  { type: 'low', label: '1-18 (x2)', color: 'bg-white/10 hover:bg-white/20 border-white/30' },
  { type: 'high', label: '19-36 (x2)', color: 'bg-white/10 hover:bg-white/20 border-white/30' },
];
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
    <button
      v-for="opt in betOptions"
      :key="opt.type"
      :class="[
        'px-4 py-3 rounded-lg font-medium text-white border transition-all duration-200',
        opt.color,
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ]"
      :disabled="disabled"
      @click="emit('betPlaced', opt.type, betAmount)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
