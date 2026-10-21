<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { audioGroups, audioCatalog } from '../audio'
const props = defineProps({ settings: Object, status: Object })
const emit = defineEmits(['change', 'close', 'preview'])
const { t } = useI18n()
const panel = ref(null)
let previousFocus
const examples = { music: 'innMusic', ambience: 'birds', woodcutting: 'axeHit', forge: 'hammer', dishes: 'plate', travel: 'footstep', interface: 'coins', dialogue: 'speech', encounters: 'encounterGood' }
const percent = value => Math.round(value * 100)
function update(key, value) { emit('change', { ...props.settings, [key]: value }) }
function group(id, event) { update('groups', { ...props.settings.groups, [id]: Number(event.target.value) / 100 }) }
function sound(id, key, value) { update('sounds', { ...props.settings.sounds, [id]: { ...props.settings.sounds[id], [key]: value } }) }
function trap(event) {
  if (event.key !== 'Tab') return
  const controls = [...panel.value.querySelectorAll('button,input,summary')].filter(el => !el.disabled && el.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(() => { previousFocus = document.activeElement; panel.value.querySelector('button').focus() })
onBeforeUnmount(() => previousFocus?.focus?.())
</script>
<template>
  <div class="audio-settings-scrim" @click.self="emit('close')" @keydown.esc.stop.prevent="emit('close')" @keydown="trap">
    <section ref="panel" class="audio-settings" role="dialog" aria-modal="true" aria-labelledby="audio-settings-title">
      <header><h2 id="audio-settings-title">{{ t('audio.settings') }}</h2><button type="button" :aria-label="t('modal.close')" @click="emit('close')">×</button></header>
      <div role="tablist" :aria-label="t('audio.settings')"><button id="audio-sound-tab" role="tab" aria-selected="true" aria-controls="audio-sound-panel">♫ {{ t('audio.soundTab') }}</button></div>
      <div id="audio-sound-panel" role="tabpanel" aria-labelledby="audio-sound-tab" class="audio-settings-body">
        <button class="audio-master-toggle" type="button" :aria-pressed="settings.muted" @click="update('muted', !settings.muted)"><span aria-hidden="true">{{ settings.muted ? '♩̸' : '♫' }}</span>{{ t(settings.muted ? 'audio.unmute' : 'audio.mute') }}</button>
        <p class="audio-state" role="status">{{ t(status.unavailable ? 'audio.unavailable' : !status.unlocked ? 'audio.startHint' : settings.muted ? 'audio.muted' : 'audio.saved') }}</p>
        <label class="audio-master-volume"><span>{{ t('audio.master') }}</span><input type="range" min="0" max="100" :value="percent(settings.master)" @input="update('master', Number($event.target.value) / 100)"/><output>{{ percent(settings.master) }}%</output></label>
        <div class="audio-volume-list"><div v-for="id in audioGroups" :key="id" class="audio-volume-row"><label :for="'audio-group-' + id">{{ t('audio.groups.' + id) }}</label><input :id="'audio-group-' + id" type="range" min="0" max="100" :value="percent(settings.groups[id])" @input="group(id, $event)"/><output>{{ percent(settings.groups[id]) }}%</output><button type="button" :aria-label="t('audio.previewNamed', { sound: t('audio.groups.' + id) })" :disabled="settings.muted" @click="emit('preview', examples[id])">▷</button></div></div>
        <details><summary>{{ t('audio.individual') }}</summary><div v-for="(cue, id) in audioCatalog" :key="id" class="audio-volume-row audio-volume-row--specific"><button type="button" class="audio-cue-toggle" :aria-pressed="settings.sounds[id].muted" :aria-label="t(settings.sounds[id].muted ? 'audio.enableNamed' : 'audio.disableNamed', { sound: t('audio.sounds.' + id) })" @click="sound(id, 'muted', !settings.sounds[id].muted)">{{ settings.sounds[id].muted ? '○' : '●' }}</button><label :for="'audio-cue-' + id">{{ t('audio.sounds.' + id) }}</label><input :id="'audio-cue-' + id" type="range" min="0" max="100" :value="percent(settings.sounds[id].volume)" @input="sound(id, 'volume', Number($event.target.value) / 100)"/><output>{{ percent(settings.sounds[id].volume) }}%</output><button type="button" :disabled="settings.muted || settings.sounds[id].muted" :aria-label="t('audio.previewNamed', { sound: t('audio.sounds.' + id) })" @click="emit('preview', id)">▷</button></div></details>
        <p v-if="status.failed.length" class="audio-state" role="status">{{ t('audio.loadFailed') }}</p>
        <p class="audio-credits">{{ t('audio.credits') }} <a href="/audio/CREDITS.md" target="_blank" rel="noopener">{{ t('audio.viewCredits') }}</a></p>
      </div>
    </section>
  </div>
</template>
<style scoped>
.audio-settings-scrim{position:absolute;inset:0;z-index:140;display:grid;place-items:center;padding:10px;background:#142119c9;box-sizing:border-box}.audio-settings{width:min(490px,100%);max-height:96%;display:flex;flex-direction:column;box-sizing:border-box;border:2px solid #ae9258;border-radius:8px;padding:14px;background:radial-gradient(ellipse at top,#56604455,transparent 55%),#28382b;color:#e1d5b6;box-shadow:0 12px 30px #101b14b0}.audio-settings header{display:flex;align-items:center;justify-content:space-between}.audio-settings h2{font:25px Georgia,serif;margin:0 0 10px;color:#e8cf95}.audio-settings button{padding:5px 8px;background:#3b4e37;border:1px solid #9d8755;border-radius:5px;color:#e4ce98;cursor:pointer}.audio-settings header button{font-size:20px;background:none;border:0}.audio-settings [role=tablist]{border-bottom:1px solid #a38e5a66;padding-bottom:7px}.audio-settings [role=tab]{background:#b3995e;color:#203727}.audio-settings-body{overflow:auto;min-height:0;padding:9px 3px}.audio-master-toggle{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;border-radius:20px!important;padding:9px!important}.audio-master-toggle[aria-pressed=true]{background:#253127;color:#929d83}.audio-master-toggle span{font-size:19px}.audio-state{font-size:10px;color:#bfc4a5;line-height:1.4;margin:8px 0}.audio-master-volume{display:grid;grid-template-columns:110px 1fr 36px;gap:8px;align-items:center;font-size:12px;padding:9px 0;border-bottom:1px solid #a38e5a44}.audio-volume-list{padding:8px 0}.audio-volume-row{display:grid;grid-template-columns:minmax(85px,1fr) minmax(60px,1.1fr) 34px 28px;gap:7px;align-items:center;font-size:11px;min-height:32px}.audio-volume-row button{padding:3px;font-size:16px}.audio-volume-row--specific{grid-template-columns:20px minmax(80px,1fr) minmax(45px,.8fr) 34px 26px;font-size:10px}.audio-settings input[type=range]{width:100%;min-width:0;accent-color:#cbb078;cursor:pointer}.audio-settings output{text-align:right;font-size:10px;font-variant-numeric:tabular-nums}.audio-settings summary{cursor:pointer;color:#cfba83;font-size:11px;padding:10px 0}.audio-settings .audio-cue-toggle{font-size:11px;border:0;background:none;color:#d4b873}.audio-cue-toggle[aria-pressed=true]{color:#7f8977}.audio-credits{font-size:9px;line-height:1.5;color:#a5b296;margin:12px 0 0}.audio-credits a{color:#cfba83}.audio-settings button:disabled{opacity:.4;cursor:default}.audio-settings :focus-visible{outline:2px solid #f1d89e;outline-offset:2px}@media(max-width:450px){.audio-settings{padding:9px}.audio-master-volume{grid-template-columns:85px 1fr 32px}.audio-volume-row{gap:5px}.audio-settings h2{font-size:21px}}
</style>

<style scoped>.audio-settings header{position:sticky;top:0;z-index:20;background:#28382b;flex:none}.audio-settings button:hover:not(:disabled){background:#dec18a;color:#203428}</style>
