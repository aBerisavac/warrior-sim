<script setup>
import SpeakerPortrait from './SpeakerPortrait.vue'
import { computed, provide } from 'vue'
const props = defineProps({ speaker: { type: String, default: 'player' }, thought: Boolean, mixed: Boolean, narration: Boolean, variant: { type: String, default: 'dark' } })
provide('dialogueSpeaking', computed(() => !props.thought && !props.mixed && !props.narration && props.speaker !== 'notice'))
</script>
<template>
  <div class="dialogue-bubble" :class="'dialogue-bubble--' + variant"><SpeakerPortrait :speaker="speaker" :thought="thought" /><component :is="thought ? 'em' : mixed || narration || speaker === 'notice' ? 'div' : 'q'" class="dialogue-bubble-copy"><slot /></component></div>
</template>
<style scoped>
.dialogue-bubble{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:10px;margin:10px 0;padding:10px;background:#1d2b2366;border-left:2px solid #9a825455;color:#cbd3bf;font-size:12px;line-height:1.6}.dialogue-bubble :deep(.speaker-identity){flex-direction:column;gap:4px;max-width:68px;text-align:center}.dialogue-bubble-copy{min-width:0}.dialogue-bubble-copy :deep(.typed-text){display:inline}.dialogue-bubble:deep(.speaker-name){font-size:9px}.dialogue-bubble:deep(.speaker-name small){font-size:8px}@media(max-width:570px){.dialogue-bubble{gap:8px;padding:7px;font-size:11px}}
.dialogue-bubble--parchment{background:transparent;border-left:0;padding:6px 0;color:#493d2a;--speaker-color:#6b4c2c;--speaker-thought-color:#827052}
q.dialogue-bubble-copy{quotes:"“" "”" "‘" "’"}.dialogue-bubble-copy{font-style:normal}em.dialogue-bubble-copy{font-style:italic}
</style>
