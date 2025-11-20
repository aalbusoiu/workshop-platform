<template>
  <slot :height="h"></slot>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ButtonSize = 'xs' | 's' | 'm' | 'l'
interface ButtonStyle { size: ButtonSize }

const props = defineProps<{ buttonStyle: ButtonStyle }>()
const heightMap: Record<ButtonSize, number> = { xs: 30, s: 35, m: 40, l: 45 }
const h = computed(() => heightMap[props.buttonStyle.size])
</script>