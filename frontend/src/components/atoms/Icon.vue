<script setup lang="ts">
const sizeClasses: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-4xl',
  '2xl': 'text-6xl',
};

withDefaults(defineProps<{ emoji: string; size?: string }>(), { size: 'md' });
</script>

<template>
  <span :class="[sizeClasses[size] ?? sizeClasses.md, $attrs.class]">{{ emoji }}</span>
</template>
