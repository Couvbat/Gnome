<script setup lang="ts">
export type SpinnerSize = 'sm' | 'md' | 'lg';

const props = withDefaults(defineProps<{ size?: SpinnerSize }>(), { size: 'md' });

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-4',
};
</script>

<template>
  <div
    :class="[
      sizeClasses[props.size],
      'border-gnome-gold/30 border-t-gnome-gold rounded-full animate-spin',
    ]"
  />
</template>
