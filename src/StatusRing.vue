<script setup>
import { computed } from 'vue'
import CircleIcon from './components/CircleIcon.vue'

const props = defineProps({
  percent: { type: Number, required: true },
  label: { type: String, required: true },
  glyph: { type: String, required: true },
  tone: { type: String, required: true },
  clickable: { type: Boolean, default: false },
})

const path = computed(() => {
  const percent = Math.max(0, Math.min(100, props.percent))
  if (percent === 0) return ''
  if (percent === 100) return 'M 24 6 A 18 18 0 1 0 24 42 A 18 18 0 1 0 24 6'
  const angle = (-90 - percent * 3.6) * Math.PI / 180
  const x = 24 + 18 * Math.cos(angle)
  const y = 24 + 18 * Math.sin(angle)
  return `M 24 6 A 18 18 0 ${percent > 50 ? 1 : 0} 0 ${x} ${y}`
})
</script>

<template>
  <component :is="clickable ? 'button' : 'div'" class="hud-ring" :class="{ 'ring-button': clickable }" :title="`${label}: ${percent}%`" :aria-label="`${label}: ${percent}%`">
    <svg viewBox="0 0 48 48" aria-hidden="true"><defs v-if="tone === 'stamina-ring'"><linearGradient id="stamina-burnt-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8e783e"/><stop offset="100%" stop-color="#594826"/></linearGradient></defs><circle cx="24" cy="24" r="18" class="ring-track" :class="{ 'stamina-burnt-track': tone === 'stamina-ring' }"/><path v-if="path" :d="path" class="ring-progress" :class="tone" /></svg>
    <CircleIcon as="span" size="ring" class="ring-glyph" :icon="glyph" /><span class="ring-label">{{ label }}</span><strong>{{ percent }}%</strong>
  </component>
</template>
