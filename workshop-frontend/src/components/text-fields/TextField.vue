<template>
  <AnimationFocus>
    <AnimationBounds ref="animationBounds">
      <div class="textfield" :class="{ focused: isFocused, disabled, error, 'has-suffix': hasSuffix }" @click="focusInput" :aria-invalid="error ? 'true' : 'false'">
        <input
            ref="inputEl"
            :type="type"
            :placeholder="placeholder"
            :value="modelValue"
            :disabled="disabled"
            @input="onInput"
            @focus="onFocus"
            @blur="isFocused = false"
            v-bind="$attrs"
        />
        <div v-if="hasSuffix" class="suffix">
          <slot name="suffix" />
        </div>
      </div>
    </AnimationBounds>
  </AnimationFocus>
</template>

<script setup lang="ts">
import AnimationFocus from '~/components/interaction/AnimationFocus.vue'
import AnimationBounds from '~/components/interaction/AnimationBounds.vue'
import { ref, computed, watch, useSlots } from 'vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  maxLength?: number;
  error?: boolean;
}>(), {
  placeholder: 'text',
  disabled: false,
  type: 'text',
  error: false
})
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'clear-error'): void }>()

const animationBounds = ref<{ shake: (duration?: number) => void } | null>(null)
const isFocused = ref(false)
const modelValue = computed(() => props.modelValue)
const placeholder = computed(() => props.placeholder)
const disabled = computed(() => props.disabled)
const type = computed(() => props.type)
const maxLength = computed(() => props.maxLength)
const error = computed(() => props.error)

const slots = useSlots()
const hasSuffix = computed(() => !!slots.suffix)

watch(error, (isErr) => {
  if (isErr) {
    animationBounds.value?.shake(90)
  }
})

const inputEl = ref<HTMLInputElement | null>(null)
function focusInput() {
  if (disabled.value) return
  inputEl.value?.focus()
}

function onFocus() {
  isFocused.value = true
  if (error.value) {
    emit('clear-error')
  }
}

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  const value = target.value
  if (maxLength.value && value.length > maxLength.value) {
    animationBounds.value?.shake(70)
    const slicedValue = value.slice(0, maxLength.value)
    emit('update:modelValue', slicedValue)
    target.value = slicedValue
  } else {
    emit('update:modelValue', value)
  }
}
defineExpose({ inputEl })
</script>

<style scoped>
.textfield {
  position: relative;
  height: 35px;
  background: var(--colorTextField);
  border: 2px solid var(--colorTextDisabled);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  cursor: text;
  transition: border-color 0.2s ease;
}
.textfield.has-suffix input {
  padding-right: 40px;
}
.textfield .suffix {
  position: absolute;
  right: 6px;
  padding-inline: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}
.textfield.focused {
  border-color: var(--colorAccent);
}
.textfield.error {
  border-color: var(--colorError);
}
.textfield input {
  appearance: none;
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--colorText);
  width: 100%;
  height: 100%;
  display: block;
  padding-left: 12px;
  padding-right: 12px;
}
.textfield input::placeholder {
  color: var(--colorPlaceholder);
  opacity: 1;
}
.textfield.disabled input {
  color: var(--colorTextDisabled);
  cursor: not-allowed;
  user-select: none;
}
</style>