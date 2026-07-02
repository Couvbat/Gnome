<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'glass' | 'solid';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    bordered?: boolean;
  }>(),
  { variant: 'default', padding: 'md', hover: false, bordered: true }
);

const variantClasses = {
  default: 'bg-white/5 backdrop-blur-sm',
  glass: 'bg-white/10 backdrop-blur-md',
  solid: 'bg-gnome-dark',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8',
};
</script>

<template>
  <div
    :class="[
      'rounded-2xl shadow-xl',
      variantClasses[props.variant],
      paddingClasses[props.padding],
      props.bordered ? 'border border-white/20' : '',
      props.hover ? 'hover:border-gnome-gold/60 hover:scale-105 transition-all duration-300' : '',
      $attrs.class,
    ]"
  >
    <slot />
  </div>
</template>
