<template>
  <TextField
      :model-value="modelValue"
      @update:modelValue="onInput"
      :disabled="disabled"
      :error="error"
      placeholder="email@domain.nl"
      type="email"
      inputmode="email"
      autocomplete="email"
      autocapitalize="off"
      spellcheck="false"
      @clear-error="$emit('clear-error')"
      v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import TextField from '~/components/text-fields/TextField.vue'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'clear-error'): void
}>()

const onInput = (v: string) => emit('update:modelValue', v)
</script>