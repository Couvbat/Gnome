<script setup lang="ts">
import Button from '../atoms/Button.vue';

defineProps<{ emoji: string; title: string }>();
const emit = defineEmits<{ leave: [] }>();
</script>

<template>
  <div class="flex items-center justify-between mb-8">
    <h2 class="text-3xl font-bold text-gnome-gold">{{ emoji }} {{ title }}</h2>
    <div class="flex items-center gap-4">
      <slot name="right" />
      <Button variant="secondary" @click="emit('leave')">← Retour au lobby</Button>
    </div>
  </div>
</template>
