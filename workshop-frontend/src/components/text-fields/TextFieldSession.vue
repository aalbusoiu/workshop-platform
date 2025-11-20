<script setup lang="ts">
import { computed } from 'vue'
import TextField from '~/components/text-fields/TextField.vue'

const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string; disabled?: boolean; error?: boolean }>(), {
  placeholder: 'KTRLM',
  disabled: false,
  error: false
})
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'clear-error'): void }>()

const uppercaseValue = computed({
  get: () => (props.modelValue || '').toUpperCase().slice(0, 5),
  set: (v: string) => emit('update:modelValue', (v || '').toUpperCase().slice(0, 5))
})

const placeholder = computed(() => props.placeholder)
const disabled = computed(() => props.disabled)
const error = computed(() => props.error)
</script>

<template>
  <TextField
    v-model="uppercaseValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :maxLength="5"
    :error="error"
    @clear-error="emit('clear-error')"
  />
</template>

<style scoped>
</style>