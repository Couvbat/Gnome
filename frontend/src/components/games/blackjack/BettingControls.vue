<script setup lang="ts">
import Button from '../../atoms/Button.vue';

const props = defineProps<{
  betAmount: number;
  userBalance: number;
  isProcessing: boolean;
}>();

const emit = defineEmits<{
  'update:betAmount': [value: number];
  placeBet: [];
}>();

const adjust = (delta: number) => {
  const next = Math.max(10, Math.min(props.userBalance, props.betAmount + delta));
  emit('update:betAmount', next);
};
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-bold text-gnome-gold text-center">Placer votre mise</h3>
    <div class="flex items-center justify-center gap-3">
      <Button variant="danger" size="sm" :disabled="betAmount <= 10 || isProcessing" @click="adjust(-50)">-50</Button>
      <Button variant="danger" size="sm" :disabled="betAmount <= 10 || isProcessing" @click="adjust(-10)">-10</Button>
      <div class="text-3xl font-bold text-gnome-gold px-4">{{ betAmount }} 💰</div>
      <Button variant="success" size="sm" :disabled="betAmount >= userBalance || isProcessing" @click="adjust(10)">+10</Button>
      <Button variant="success" size="sm" :disabled="betAmount >= userBalance || isProcessing" @click="adjust(50)">+50</Button>
    </div>
    <p class="text-white/50 text-sm text-center">Solde: {{ userBalance }} 💰</p>
    <Button
      variant="primary"
      size="lg"
      :full-width="true"
      :loading="isProcessing"
      :disabled="betAmount > userBalance || isProcessing"
      @click="emit('placeBet')"
    >
      🎲 Miser {{ betAmount }} pièces
    </Button>
  </div>
</template>
