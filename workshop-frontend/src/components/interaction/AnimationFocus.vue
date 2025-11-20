<template>
  <div class="af" :style="style"><slot /></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ durationMs?: number; timing?: string }>(), { durationMs: 150, timing: 'ease' })
const style = computed(() => ({ '--af-dur': props.durationMs + 'ms', '--af-ease': props.timing }))
</script>

<style scoped>
.af {
  display: contents;
  --af-dur: 125ms;
  --af-ease: ease;
}
.af > * {
  transition-property: border-color, outline-color, box-shadow;
  transition-duration: var(--af-dur, 125ms);
  transition-timing-function: var(--af-ease, ease);
}
</style>
