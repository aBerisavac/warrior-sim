<script setup>
import { computed, useId } from 'vue'
const props = defineProps({ depth: { type: Number, default: 0 }, fraction: { type: Number, default: 1 }, ready: { type: Boolean, default: false }, marked: { type: Boolean, default: false }, angle: { type: Number, default: 0 }, cutOffset: { type: Number, default: 0 }, branchMarks: { type: Array, default: () => [] } })
const clipId = useId()
const shape = computed(() => {
  if (props.depth === 0) return 'M 50 3 A 47 47 0 1 1 49.99 3 Z'
  const sweep = Math.min(.95, props.fraction) * Math.PI * 2
  const start = -Math.PI / 2 - sweep / 2
  const end = start + sweep
  const point = angle => `${50 + 46 * Math.cos(angle)} ${50 + 46 * Math.sin(angle)}`
  return `M 50 50 L ${point(start)} A 46 46 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(end)} Z`
})
</script>

<template>
  <svg viewBox="0 0 100 100" aria-hidden="true" class="woodcut-piece-art">
    <defs><clipPath :id="clipId"><path :d="shape" /></clipPath></defs>
    <path :d="shape" fill="#ba8754" stroke="#e4b97d" stroke-width="4" stroke-linejoin="round" />
    <path v-if="ready" :d="shape" class="woodcut-ready-outline" fill="none" stroke="#ffe99a" stroke-width="6" stroke-dasharray="7 4" stroke-linejoin="round" />
    <g :clip-path="`url(#${clipId})`" fill="none" stroke="#895d35" stroke-width="2" opacity=".65">
      <circle v-for="radius in [12, 24, 36]" :key="radius" cx="50" cy="50" :r="radius" />
    </g>
    <g v-if="marked && !ready" :clip-path="`url(#${clipId})`">
      <g :transform="`rotate(${angle} 50 50)`">
        <path class="woodcut-mark" d="M50 -20 L48.5 23 L51 40 L49 53 L51.5 68 L50 120" :transform="`translate(${cutOffset / 1.3} 0)`" />
        <path v-for="(branch, index) in branchMarks" :key="index" class="woodcut-mark woodcut-mark--branch" :d="`M ${branch.side ? 120 : -20} ${branch.join - 12} L ${branch.side ? 76 : 24} ${branch.join - 5} L ${50 + cutOffset / 1.3 + (branch.join < 40 ? 0 : -1)} ${branch.join}`" />
      </g>
    </g>
  </svg>
</template>
