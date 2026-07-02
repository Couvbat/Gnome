<script setup lang="ts">
import { computed } from 'vue';
import PrimeProgressBar from 'primevue/progressbar';

export type ProgressBarColor =
  | 'gold' | 'red' | 'blue' | 'green' | 'purple' | 'pink' | 'yellow' | 'cyan';

const props = withDefaults(
  defineProps<{
    value: number;
    max: number;
    color?: ProgressBarColor;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    labelFormat?: 'percentage' | 'value' | 'both';
  }>(),
  { color: 'gold', size: 'md', showLabel: false, labelFormat: 'value' }
);

const colorClasses: Record<ProgressBarColor, string> = {
  gold: 'bg-gradient-to-r from-gnome-gold to-yellow-400',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  yellow: 'bg-yellow-500',
  cyan: 'bg-cyan-500',
};

const sizeClasses = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

const percentage = computed(() =>
  Math.min(100, Math.max(0, (props.value / props.max) * 100))
);

const label = computed(() => {
  if (!props.showLabel) return '';
  switch (props.labelFormat) {
    case 'percentage': return `${Math.round(percentage.value)}%`;
    case 'both': return `${props.value}/${props.max} (${Math.round(percentage.value)}%)`;
    default: return `${props.value}/${props.max}`;
  }
});
</script>

<template>
  <div class="w-full">
    <div v-if="showLabel" class="flex justify-between text-xs mb-1">
      <span class="text-white/70">Progress</span>
      <span class="text-white">{{ label }}</span>
    </div>
    <PrimeProgressBar
      :value="percentage"
      :show-value="false"
      :unstyled="true"
      :pt="{
        root: { class: ['bg-white/10 rounded-full overflow-hidden', sizeClasses[size]] },
        value: { class: ['h-full transition-all duration-500', colorClasses[color]] },
      }"
    />
  </div>
</template>
