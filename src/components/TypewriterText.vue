<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { playSound } from '../audio'

const props = defineProps({ text: { type: String, default: '' }, speed: { type: Number, default: 24 }, delay: { type: Number, default: 0 }, spoken: { type: Boolean, default: undefined } })
const speaking = inject('dialogueSpeaking', false)
const emit = defineEmits(['complete'])
const shown = ref(0)
const waiting = ref(false)
const finished = computed(() => !waiting.value && shown.value >= [...props.text].length)
let timer, replyTimer
function stop() { if (timer) clearInterval(timer); clearTimeout(replyTimer); timer = null; replyTimer = null }
function reveal() {
  if (finished.value || waiting.value) return
  stop()
  shown.value = [...props.text].length
  emit('complete')
}
function start() {
  stop()
  shown.value = 0
  waiting.value = props.delay > 0
  if (waiting.value) replyTimer = setTimeout(() => { waiting.value = false; type() }, props.delay)
  else type()
}
function type() {
  const count = [...props.text].length
  if (!count || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { shown.value = count; emit('complete'); return }
  timer = setInterval(() => {
    shown.value = Math.min(count, shown.value + 1)
    if ((props.spoken ?? unref(speaking)) && shown.value % 4 === 0 && /[\p{L}\p{N}]/u.test([...props.text][shown.value - 1])) playSound('speech')
    if (shown.value === count) { stop(); emit('complete') }
  }, props.speed)
}
watch(() => props.text, start)
onMounted(start)
onBeforeUnmount(stop)
defineExpose({ reveal })
</script>

<template>
  <span class="typed-text" role="text" :aria-label="text" tabindex="0" @click.stop="reveal" @keydown.enter.prevent="reveal" @keydown.space.prevent="reveal"><span aria-hidden="true">{{ waiting ? '…' : [...text].slice(0, shown).join('') }}</span><span v-if="!finished && !waiting" class="typed-cursor" aria-hidden="true">▍</span></span>
</template>
