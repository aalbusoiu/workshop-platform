<template>
  <ButtonStyle :buttonStyle="props.buttonStyle" v-slot="{ height }">
    <button
        class="app-btn btn-text"
        type="button"
        :disabled="isDisabled"
        :aria-disabled="isDisabled ? 'true' : 'false'"
        :aria-busy="props.loading ? 'true' : 'false'"
        :style="{
        height: height + 'px',
        paddingLeft: (height * .75) + 'px',
        paddingRight: (height * .75) + 'px'
      }"
        v-bind="$attrs"
        @click="onClick"
    >
      <span
        v-if="props.loading"
        class="btn-spinner"
        :style="{
          width: (height * 0.5) + 'px',
          height: (height * 0.5) + 'px',
          borderWidth: Math.max(2, Math.round(height * 0.08)) + 'px'
        }"
      />
      <span v-else class="btn-label"><slot>Button</slot></span>
      <Pressable :disabled="isDisabled" />
    </button>
  </ButtonStyle>
</template>

<script setup lang="ts">
import ButtonStyle from '~/components/buttons/ButtonStyle.vue'
import Pressable from '~/components/interaction/Pressable.vue'
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

type ButtonSize = 'xs' | 's' | 'm' | 'l'
interface ButtonStyleProps { size: ButtonSize }

const props = withDefaults(
    defineProps<{ buttonStyle: ButtonStyleProps; disabled?: boolean; loading?: boolean }>(),
    { disabled: false, loading: false }
)

const isDisabled = computed(() => props.disabled || props.loading)

const emit = defineEmits<{ (e: 'click', event: MouseEvent): void }>()

function onClick(e: MouseEvent) {
  if (isDisabled.value) return
  emit('click', e)
}
</script>

<style scoped>
.app-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  background: var(--colorAccent);
  color: var(--colorText);
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
  line-height: 1;
}
.app-btn:hover:not([disabled]) { box-shadow: inset 0 0 0 3px var(--colorAccentHover); }
.app-btn[disabled] { color: var(--colorTextDisabled); cursor: not-allowed; }

.btn-label { display: inline-flex; align-items: center; }

.btn-spinner {
  display: inline-block;
  border-style: solid;
  border-color: var(--colorTextDisabled);
  border-top-color: var(--colorText);
  border-radius: 50%;
  animation: btn-spin 0.8s linear infinite;
}

.app-btn[aria-busy="true"] .btn-label { opacity: 0.9; }

@keyframes btn-spin { to { transform: rotate(360deg) } }
</style>