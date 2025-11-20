<template>
  <div class="pressable-overlay" ref="overlay"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{ disabled?: boolean; durationMs?: number; animation?: 'ripple' | 'fade' }>(), { disabled: false, animation: 'ripple' })
const overlay = ref<HTMLDivElement | null>(null)
let host: HTMLElement | null = null

const spawnRipple = (x: number, y: number, rect: DOMRect) => {
  if (!overlay.value) return
  const rx = Math.max(x, rect.width - x)
  const ry = Math.max(y, rect.height - y)
  const r = Math.sqrt(rx * rx + ry * ry)
  const d = r * 2
  const el = document.createElement('span')
  el.className = 'ripple'
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  el.style.width = d + 'px'
  el.style.height = d + 'px'
  const adaptive = Math.round(d * 0.8)
  const duration = Math.min(1000, Math.max(200, adaptive))
  el.style.animationDuration = ((props.durationMs ?? duration)) + 'ms'
  const stroke = Math.min(30, Math.max(3, d / 2))
  el.style.borderWidth = stroke + 'px'
  overlay.value.appendChild(el)
  el.addEventListener('animationend', () => { el.remove() })
}

const spawnFade = (x: number, y: number) => {
  if (!overlay.value) return
  const el = document.createElement('span')
  el.className = 'fade-dot'
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  const duration = props.durationMs ?? 180
  el.style.animationDuration = duration + 'ms'
  overlay.value.appendChild(el)
  el.addEventListener('animationend', () => { el.remove() })
}

const onPointerDown = (e: PointerEvent) => {
  if (props.disabled || !overlay.value || !host) return
  const rect = host.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  if (props.animation === 'fade') {
    spawnFade(x, y)
  } else {
    spawnRipple(x, y, rect)
  }
}

onMounted(() => {
  host = overlay.value?.parentElement as HTMLElement | null
  if (!host) return
  host.addEventListener('pointerdown', onPointerDown)
})

onBeforeUnmount(() => {
  if (host) host.removeEventListener('pointerdown', onPointerDown)
})
</script>

<style scoped>
.pressable-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  overflow: hidden;
}
:deep(.ripple) {
  position: absolute;
  border-radius: 50%;
  border: 12px solid var(--colorAccentActive);
  transform: translate(-50%, -50%) scale(0);
  opacity: 0.6;
  animation: ripple-scale cubic-bezier(.09,.61,.31,.95) forwards;
}
:deep(.fade-dot) {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--colorAccentActive);
  transform: translate(-50%, -50%);
  opacity: 0;
  animation: fade-pop ease-out forwards;
}
@keyframes ripple-scale {
  to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
@keyframes fade-pop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  30% { opacity: 0.25; }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
</style>
