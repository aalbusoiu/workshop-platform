<template>
  <div ref="root" class="ab"><slot /></div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const root = ref<HTMLElement | null>(null)

/**
 * Trigger a quick shake highlight on the immediate child element.
 * While shaking, the child's border-color is forced to var(--colorError).
 * @param duration duration of the shake animation in milliseconds (default: 70ms)
 */
function shake(duration = 70) {
  const el = root.value
  if (!el) return
  el.classList.remove('ab-shaking')
  // Force reflow to restart animation if called repeatedly
  void el.offsetWidth
  el.classList.add('ab-shaking')
  window.setTimeout(() => el.classList.remove('ab-shaking'), duration)
}

defineExpose({ shake })
</script>

<style>
.ab { display: contents; }
/* Not scoped on purpose so styles can reach slotted child elements */
.ab > * {
  transition: border-color 150ms ease;
}
.ab.ab-shaking > * {
  border-color: var(--colorError) !important;
  animation: ab-shake 0.07s;
}
@keyframes ab-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
</style>
