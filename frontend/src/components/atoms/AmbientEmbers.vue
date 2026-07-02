<script setup lang="ts">
const embers = [
  { left: '7%', delay: '0s', duration: '9s', drift: '12px', size: '3px' },
  { left: '21%', delay: '2.3s', duration: '7s', drift: '-18px', size: '2px' },
  { left: '40%', delay: '1.1s', duration: '11s', drift: '10px', size: '4px' },
  { left: '58%', delay: '3.7s', duration: '8s', drift: '-14px', size: '2px' },
  { left: '75%', delay: '0.7s', duration: '10s', drift: '16px', size: '3px' },
  { left: '91%', delay: '4.5s', duration: '7.5s', drift: '-9px', size: '2px' },
]
</script>

<template>
  <div class="ember-field" aria-hidden="true">
    <div
      v-for="(e, i) in embers"
      :key="i"
      class="ember"
      :style="{
        left: e.left,
        bottom: '8%',
        animationDelay: e.delay,
        animationDuration: e.duration,
        width: e.size,
        height: e.size,
        '--ember-drift': e.drift,
      }"
    />
  </div>
</template>
