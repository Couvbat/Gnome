<script setup lang="ts">
import InputText from 'primevue/inputtext';

defineProps<{
  modelValue?: string | number;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  fullWidth?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  input: [event: Event];
  change: [event: Event];
}>();
</script>

<template>
  <div :class="['flex flex-col gap-1', fullWidth ? 'w-full' : '']">
    <InputText
      :value="String(modelValue ?? '')"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      :min="min"
      :max="max"
      :class="[
        'input-field',
        fullWidth ? 'w-full' : '',
        error ? 'border-red-500' : '',
        $attrs.class,
      ]"
      :unstyled="true"
      @input="emit('input', $event); emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @change="emit('change', $event)"
    />
    <span v-if="error" class="text-red-400 text-xs">{{ error }}</span>
  </div>
</template>
