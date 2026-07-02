<script setup lang="ts">
import Button from '../../atoms/Button.vue';

defineProps<{ isProcessing: boolean }>();
const emit = defineEmits<{ hit: []; stand: [] }>();
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-bold text-gnome-gold text-center">Votre tour</h3>
    <div class="grid grid-cols-2 gap-4">
      <Button
        variant="primary"
        size="lg"
        :full-width="true"
        :loading="isProcessing"
        :disabled="isProcessing"
        @click="emit('hit')"
      >
        🃏 Tirer
      </Button>
      <Button
        variant="secondary"
        size="lg"
        :full-width="true"
        :disabled="isProcessing"
        @click="emit('stand')"
      >
        ✋ Rester
      </Button>
    </div>
  </div>
</template>
