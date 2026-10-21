<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ text: { type: String, default: '' }, speed: { type: Number, default: 24 } })
const emit = defineEmits(['complete'])
const shown = ref(0)
const finished = computed(() => shown.value >= [...props.text].length)
let timer
function stop() { if (timer) clearInterval(timer); timer = null }
function reveal() {
  if (finished.value) return
  stop()
  shown.value = [...props.text].length
  emit('complete')
}
function start() {
  stop()
  shown.value = 0
  const count = [...props.text].length
  if (!count || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { shown.value = count; emit('complete'); return }
  timer = setInterval(() => {
    shown.value = Math.min(count, shown.value + 1)
    if (shown.value === count) { stop(); emit('complete') }
  }, props.speed)
}
watch(() => props.text, start)
onMounted(start)
onBeforeUnmount(stop)
defineExpose({ reveal })
</script>

<template>
  <span class="typed-text" role="text" :aria-label="text" tabindex="0" @click.stop="reveal" @keydown.enter.prevent="reveal" @keydown.space.prevent="reveal"><span aria-hidden="true">{{ [...text].slice(0, shown).join('') }}</span><span v-if="!finished" class="typed-cursor" aria-hidden="true">▍</span></span>
</template>
