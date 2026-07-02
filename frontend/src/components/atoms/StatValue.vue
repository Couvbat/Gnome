<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    icon?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'gold' | 'success';
  }>(),
  { size: 'md', variant: 'default' }
);

const valueClasses: Record<string, string> = {
  default: 'text-white',
  gold: 'text-gnome-gold',
  success: 'text-green-300',
};

const textSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
</script>

<template>
  <div class="bg-white/5 rounded-lg p-3 border border-white/10 text-center">
    <div class="text-white/60 text-xs mb-1">{{ label }}</div>
    <div :class="['font-bold', textSizes[props.size], valueClasses[props.variant]]">
      <span v-if="icon" class="mr-1">{{ icon }}</span>{{ value }}
    </div>
  </div>
</template>
