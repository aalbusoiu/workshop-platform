<template>
  <TextField
      ref="field"
      :model-value="modelValue"
      @update:modelValue="onInput"
      :disabled="disabled"
      :error="error"
      :type="revealed ? 'text' : 'password'"
      placeholder="••••••••"
      inputmode="text"
      autocomplete="current-password"
      autocapitalize="off"
      spellcheck="false"
      @clear-error="$emit('clear-error')"
      v-bind="$attrs"
  >
    <template #suffix>
      <span
          :aria-label="revealed ? 'Hide password' : 'Show password'"
          :aria-pressed="revealed ? 'true' : 'false'"
          @mousedown.prevent
          @click="toggleReveal"
          style="position: relative; display: inline-flex; align-items: center; padding-inline: 0px; color: var(--colorText);"
      >
    <Icon :name="revealed ? 'lucide:eye-off' : 'lucide:eye'" size="18"/>
    <Pressable animation="fade"/>
      </span>
    </template>
  </TextField>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import TextField from '~/components/text-fields/TextField.vue'
import Pressable from '~/components/interaction/Pressable.vue'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'clear-error'): void
}>()

const revealed = ref(false)
const field = ref<InstanceType<typeof TextField> | null>(null)
const toggleReveal = async () => {
  const el = field.value?.inputEl as HTMLInputElement | undefined
  const s = el?.selectionStart ?? null
  const e = el?.selectionEnd ?? null
  const hadFocus = !!el && document.activeElement === el
  revealed.value = !revealed.value
  await nextTick()
  const el2 = field.value?.inputEl as HTMLInputElement | undefined
  if (el2) {
    if (hadFocus) el2.focus({ preventScroll: true })
    if (s !== null && e !== null) {
      el2.setSelectionRange(s, e)
    } else {
      const len = el2.value.length
      el2.setSelectionRange(len, len)
    }
  }
}
const onInput = (v: string) => emit('update:modelValue', v)
</script>