<script setup lang="ts">
export type BadgeVariant = 'default' | 'gold' | 'success' | 'danger' | 'info' | 'warning';

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
  }>(),
  { variant: 'default', size: 'md' }
);

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-white border-white/10',
  gold: 'bg-gnome-gold/20 text-gnome-gold border-gnome-gold/40',
  success: 'bg-green-500/20 text-green-300 border-green-500/40',
  danger: 'bg-red-500/20 text-red-300 border-red-500/40',
  info: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
};

const sizeClasses = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1.5 text-sm' };
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1 backdrop-blur-md border rounded-lg font-medium',
      variantClasses[props.variant],
      sizeClasses[props.size],
    ]"
  >
    <slot />
  </span>
</template>
