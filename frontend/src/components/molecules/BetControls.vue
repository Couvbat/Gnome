<script setup lang="ts">
import { GAME_CONFIG } from '../../constants';
import Button from '../atoms/Button.vue';
import Input from '../atoms/Input.vue';

const props = withDefaults(
  defineProps<{
    bet: number;
    userBalance: number;
    disabled?: boolean;
    minBet?: number;
    showAllIn?: boolean;
    showReset?: boolean;
  }>(),
  { disabled: false, minBet: GAME_CONFIG.MIN_BET, showAllIn: true, showReset: true }
);

const emit = defineEmits<{ 'update:bet': [value: number] }>();

const handleBetChange = (value: number) => {
  const newBet = Math.max(props.minBet, Math.min(value, props.userBalance));
  emit('update:bet', newBet);
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <div class="flex gap-1">
        <Button variant="danger" size="xs" :disabled="bet <= minBet || disabled" @click="handleBetChange(bet - 100)">-100</Button>
        <Button variant="danger" size="xs" :disabled="bet <= minBet || disabled" @click="handleBetChange(bet - 50)">-50</Button>
        <Button variant="danger" size="xs" :disabled="bet <= minBet || disabled" @click="handleBetChange(bet - 10)">-10</Button>
      </div>

      <div class="flex-1">
        <Input
          :model-value="bet"
          type="number"
          :min="minBet"
          :max="userBalance"
          :disabled="disabled"
          full-width
          class="text-xl"
          @input="handleBetChange(parseInt(($event.target as HTMLInputElement).value) || minBet)"
        />
      </div>

      <div class="flex gap-1">
        <Button variant="success" size="xs" :disabled="bet >= userBalance || disabled" @click="handleBetChange(bet + 10)">+10</Button>
        <Button variant="success" size="xs" :disabled="bet >= userBalance || disabled" @click="handleBetChange(bet + 50)">+50</Button>
        <Button variant="success" size="xs" :disabled="bet >= userBalance || disabled" @click="handleBetChange(bet + 100)">+100</Button>
      </div>
    </div>

    <p class="text-white/50 text-xs text-center">Solde: {{ userBalance }} 💰</p>

    <div class="flex gap-2">
      <Button
        v-if="showAllIn"
        variant="gold"
        size="sm"
        full-width
        :disabled="userBalance <= 0 || disabled"
        @click="handleBetChange(userBalance)"
      >
        💰 ALL IN ({{ userBalance }} 💰)
      </Button>
      <Button
        v-if="showReset"
        variant="secondary"
        size="sm"
        full-width
        :disabled="disabled"
        @click="handleBetChange(minBet)"
      >
        ↺ Reset ({{ minBet }} 💰)
      </Button>
    </div>
  </div>
</template>
