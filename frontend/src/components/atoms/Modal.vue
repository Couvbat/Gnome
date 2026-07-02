<script setup lang="ts">
import Dialog from 'primevue/dialog';

withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    titleIcon?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showCloseButton?: boolean;
  }>(),
  { size: 'md', showCloseButton: true }
);

const emit = defineEmits<{ close: [] }>();

const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};
</script>

<template>
  <Dialog
    :visible="isOpen"
    :modal="true"
    :closable="showCloseButton"
    :draggable="false"
    :class="['w-full', sizeClasses[size]]"
    :pt="{
      root: { class: 'bg-gradient-to-br from-gnome-dark to-gnome-blue border-2 border-gnome-gold/40 rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden' },
      header: { class: 'bg-white/5 border-b border-white/10 p-4' },
      title: { class: 'text-xl font-bold text-gnome-gold flex items-center gap-3' },
      closeButton: { class: 'w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors' },
      content: { class: 'overflow-y-auto max-h-[calc(90vh-80px)] p-0' },
    }"
    @update:visible="(v) => !v && emit('close')"
  >
    <template #header>
      <span class="text-xl font-bold text-gnome-gold flex items-center gap-3">
        <span v-if="titleIcon" class="text-2xl">{{ titleIcon }}</span>
        {{ title }}
      </span>
    </template>
    <slot />
  </Dialog>
</template>
