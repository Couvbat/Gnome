<script setup lang="ts">
import Spinner from '../atoms/Spinner.vue';

defineProps<{ message?: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] gap-6">
    <div class="text-7xl animate-bounce">🏰</div>
    <Spinner size="lg" />
    <p class="text-white/70 text-xl">{{ message ?? 'Chargement...' }}</p>
  </div>
</template>
