<script setup lang="ts">
import { getRouletteNumberColor } from '../../constants';

const props = defineProps<{
  selectedNumbers: Set<number>;
  onNumberClick: (num: number) => void;
  disabled?: boolean;
}>();

const rows = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

const getNumberStyle = (num: number) => {
  const color = getRouletteNumberColor(num);
  const isSelected = props.selectedNumbers.has(num);
  const colorMap: Record<string, string> = {
    green: 'bg-green-600 hover:bg-green-500',
    red: 'bg-red-600 hover:bg-red-500',
    black: 'bg-gray-900 hover:bg-gray-800',
  };
  return [
    'relative font-bold text-white transition-all duration-200',
    colorMap[color] ?? colorMap.black,
    isSelected ? 'ring-2 ring-gnome-gold ring-offset-2 ring-offset-gnome-dark scale-110' : '',
  ].join(' ');
};
</script>

<template>
  <div class="space-y-2">
    <div class="flex justify-center">
      <button
        :class="['w-16 h-12 rounded-lg flex items-center justify-center text-lg', getNumberStyle(0), disabled ? 'opacity-50 cursor-not-allowed' : '']"
        :disabled="disabled"
        @click="!disabled && onNumberClick(0)"
      >
        0
      </button>
    </div>
    <div class="space-y-1">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="flex gap-1 justify-center">
        <button
          v-for="num in row"
          :key="num"
          :class="['w-10 h-10 rounded flex items-center justify-center text-sm', getNumberStyle(num), disabled ? 'opacity-50 cursor-not-allowed' : '']"
          :disabled="disabled"
          @click="!disabled && onNumberClick(num)"
        >
          {{ num }}
        </button>
      </div>
    </div>
  </div>
</template>
