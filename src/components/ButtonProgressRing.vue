<script setup>
import { computed } from 'vue'

const props = defineProps({ duration: { type: Number, required: true }, remaining: { type: Number, required: true } })
const progress = computed(() => Math.max(0, Math.min(1, (props.duration - props.remaining) / Math.max(props.duration, 0.001))))
const dashOffset = computed(() => 100 * (1 - progress.value))
</script>

<template>
  <svg class="button-progress-ring" viewBox="0 0 48 48" aria-hidden="true">
    <circle class="button-progress-track" cx="24" cy="24" r="20" pathLength="100" />
    <circle class="button-progress-fill" cx="24" cy="24" r="20" pathLength="100" :stroke-dashoffset="dashOffset" />
  </svg>
</template>

<style scoped>
.button-progress-ring{position:absolute;inset:-6px;width:calc(100% + 12px);height:calc(100% + 12px);overflow:visible;pointer-events:none;transform:rotate(-90deg)}
.button-progress-track,.button-progress-fill{fill:none;stroke-width:4}
.button-progress-track{stroke:#574b2b}
.button-progress-fill{stroke:#efd06f;stroke-linecap:round;stroke-dasharray:100;transition:stroke-dashoffset .08s linear;transform:scaleY(-1);transform-origin:24px 24px}
@media(prefers-reduced-motion:reduce){.button-progress-fill{transition:none}}
</style>
