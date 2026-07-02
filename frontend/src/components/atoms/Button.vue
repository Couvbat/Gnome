<script setup lang="ts">
import { computed } from 'vue';
import Spinner from './Spinner.vue';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    disabled?: boolean;
  }>(),
  { variant: 'primary', size: 'md', loading: false, fullWidth: false, disabled: false }
);

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gnome-gold text-gnome-dark hover:bg-yellow-400 border-gnome-gold',
  secondary: 'bg-white/10 text-white hover:bg-white/20 border-white/20 hover:border-white/40',
  ghost: 'bg-transparent text-white hover:bg-white/10 border-transparent',
  danger: 'bg-red-600/20 text-red-300 hover:bg-red-600/40 border-red-500',
  gold: 'bg-gnome-gold/20 text-gnome-gold hover:bg-gnome-gold/30 border-gnome-gold/40',
  success: 'bg-green-600/20 text-green-300 hover:bg-green-600/40 border-green-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs rounded',
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2 text-base rounded-lg',
  lg: 'px-6 py-3 text-lg rounded-xl',
};

const isDisabled = computed(() => props.disabled || props.loading);

const classes = computed(() =>
  [
    'inline-flex items-center justify-center gap-2 font-medium border transition-all duration-200',
    variantClasses[props.variant],
    sizeClasses[props.size],
    props.fullWidth ? 'w-full' : '',
    isDisabled.value ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
  ]
    .filter(Boolean)
    .join(' ')
);
</script>

<template>
  <button :class="classes" :disabled="isDisabled">
    <Spinner v-if="loading" size="sm" />
    <span v-if="!loading && $slots.leftIcon" class="flex-shrink-0">
      <slot name="leftIcon" />
    </span>
    <slot />
    <span v-if="!loading && $slots.rightIcon" class="flex-shrink-0">
      <slot name="rightIcon" />
    </span>
  </button>
</template>
