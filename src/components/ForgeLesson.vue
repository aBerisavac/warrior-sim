<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogueBubble from './DialogueBubble.vue'
import TypewriterText from './TypewriterText.vue'
const props = defineProps({ lesson: Object, paused: Boolean })
const emit = defineEmits(['complete'])
const { t } = useI18n()
const index = ref(0), ready = ref(false), writer = ref(null)
watch(() => props.lesson.id, () => { index.value = 0; ready.value = false })
function advance() {
  if (!ready.value) { writer.value?.reveal(); return }
  if (index.value + 1 < props.lesson.lines.length) { index.value++; ready.value = false }
  else emit('complete', props.lesson.id)
}
</script>
<template>
  <section class="forge-lesson" :inert="paused" role="region" :aria-label="t('forgeLesson.title')">
    <small>{{ t('forgeLesson.title') }}</small>
    <DialogueBubble :speaker="lesson.lines[index].speaker" :thought="lesson.lines[index].thought" variant="parchment">
      <TypewriterText :key="lesson.id + index" ref="writer" :text="t(lesson.lines[index].key)" @complete="ready = true" />
    </DialogueBubble>
    <button @click="advance">{{ t(ready ? 'forgeLesson.continue' : 'forgeLesson.reveal') }} <span aria-hidden="true">→</span></button>
    <small class="forge-lesson-time">{{ t('forgeLesson.timePaused') }}</small>
  </section>
</template>
<style scoped>
.forge-lesson{position:absolute;z-index:29;left:12px;bottom:12px;width:min(370px,calc(100% - 24px));padding:12px 15px;background:#f1e4c0;color:#493d2a;border:2px solid #8b724d;border-radius:12px;box-shadow:0 8px 25px #111b18a0}.forge-lesson>small{font-size:10px;letter-spacing:.7px;color:#815f37}.forge-lesson :deep(.dialogue-bubble){font-size:12px;line-height:1.6;margin:8px 0}.forge-lesson button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 10px;background:#354938;border:1px solid #8d794b;color:#f4e2b5;border-radius:5px;font-size:11px}.forge-lesson .forge-lesson-time{display:block;text-align:right;font-size:9px;letter-spacing:0;margin-top:6px;color:#887451}@media(max-height:600px){.forge-lesson{bottom:6px;padding:8px 10px}.forge-lesson :deep(.dialogue-bubble){font-size:11px;line-height:1.35}}
</style>
