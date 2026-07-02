<script setup lang="ts">
import type { GameType } from '../../types';
import Icon from '../atoms/Icon.vue';

defineProps<{
  emoji: string;
  title: string;
  description: string;
  stats: Array<{ label: string; value: string | number }>;
  disabled?: boolean;
  gameType?: GameType;
}>();

const emit = defineEmits<{ click: [] }>();

const surfaceClass: Record<string, string> = {
  blackjack: 'game-surface-blackjack',
  roulette: 'game-surface-roulette',
  slots: 'game-surface-slots',
  dice: 'game-surface-dice',
};
</script>

<template>
  <button
    :class="[
      'w-full text-left border-2 rounded-2xl p-6 shadow-xl group transition-all duration-300',
      gameType ? surfaceClass[gameType] : 'bg-white/5 backdrop-blur-sm border-white/20',
      'hover:scale-[1.03]',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    :disabled="disabled"
    @click="emit('click')"
  >
    <Icon :emoji="emoji" size="xl" class="block text-center mb-4 transform group-hover:scale-110 transition-transform duration-300" />
    <h3
      class="text-xl font-semibold mb-2 tracking-wide"
      style="font-family: var(--font-display); color: #C8922A;"
    >
      {{ title }}
    </h3>
    <p
      class="text-sm mb-4 min-h-[2.5rem] leading-relaxed"
      style="font-family: var(--font-body); color: rgba(229, 197, 124, 0.6);"
    >
      {{ description }}
    </p>
    <div
      class="flex flex-col gap-1 pt-3"
      style="border-top: 1px solid rgba(200, 146, 42, 0.12);"
    >
      <span
        v-for="(stat, i) in stats"
        :key="i"
        class="text-xs"
        style="font-family: var(--font-mono); color: rgba(229, 197, 124, 0.5);"
      >
        <span style="color: rgba(255,255,255,0.3);">{{ stat.label }}:</span> {{ stat.value }}
      </span>
    </div>
  </button>
</template>
