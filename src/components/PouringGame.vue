<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { castingQuality } from '../workshop'
const props = defineProps({ workshop: Object, paused: Boolean })
const emit = defineEmits(['command', 'close'])
const { t } = useI18n()
const arena = ref(null), closeButton = ref(null), height = ref(0), held = ref(false)
const c = computed(() => props.workshop.crucible), p = computed(() => props.workshop.pour), m = computed(() => props.workshop.mould)
const quality = computed(() => m.value ? m.value.ruined ? 0 : p.value ? castingQuality(m.value.fill, p.value.spilled) : m.value.castingQuality : 0)
function control() { if (p.value) emit('command', 'pourControl', { holding: held.value, height: height.value }) }
function move(event) {
  if (!held.value || props.paused) return
  const r = arena.value.getBoundingClientRect()
  height.value = Math.max(0, Math.min(1, (r.bottom - r.height * .24 - event.clientY) / (r.height * .46)))
  control()
}
function start(event) {
  if (!p.value || props.paused) return
  event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
  held.value = true; move(event)
}
function lower() { held.value = false; height.value = 0; control() }
function key(event) {
  if (!p.value || props.paused) return
  if (event.key === ' ' && !event.repeat) { event.preventDefault(); held.value = true; height.value = .4; control() }
  if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); height.value = Math.max(0, Math.min(1, height.value + (event.key === 'ArrowUp' ? .05 : -.05))); control() }
}
function close() { lower(); emit('close') }
function trap(event) {
  if (event.key !== 'Tab') return
  const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
  if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
  else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
}
watch(() => props.paused, value => { if (value) lower() })
watch(p, value => { if (!value) { held.value = false; height.value = 0 } })
onMounted(() => { closeButton.value?.focus(); window.addEventListener('blur', lower) })
onBeforeUnmount(() => { lower(); window.removeEventListener('blur', lower) })
</script>
<template>
  <div class="pouring-scrim" :inert="paused" @keydown.esc.stop="close" @click.self="close">
    <section class="pouring-game" role="dialog" aria-modal="true" :aria-label="t('workshop.pouringTitle')" @keydown="trap">
      <header><h2>{{ t('workshop.pouringTitle') }}</h2><button ref="closeButton" @click="close" :aria-label="t('modal.close')">×</button></header>
      <p>{{ t('workshop.pouringHelp') }}</p>
      <div class="pouring-stats"><span>{{ t('workshop.crucibleLeft', { percent: c.stage === 'empty' ? 0 : (c.remaining * 100).toFixed(1) }) }}</span><span v-if="c.stage !== 'empty'">{{ t('workshop.melt', { progress: Math.round(c.melt) }) }}</span><span v-if="c.stage !== 'empty'">{{ t('workshop.metalHeat', { temperature: Math.round(c.temperature) }) }}</span><span v-if="c.stage !== 'empty'">{{ t('workshop.crucibleHeat', { temperature: Math.round(c.vesselTemperature ?? c.temperature) }) }}</span><span>{{ t('workshop.mouldHeat', { temperature: Math.round(m?.temperature || 25) }) }}</span><span>{{ t('workshop.mouldFill', { percent: Math.round((m?.fill || 0) * 100) }) }}</span><span>{{ t('workshop.spilled', { percent: ((p?.spilled || m?.spilled || 0) * 100).toFixed(1) }) }}</span></div>
      <div ref="arena" class="pouring-arena" :class="{ 'pouring-arena--danger': held && height > .72, 'pouring-arena--ruined': m?.ruined }" :style="{ '--lift': height }">
        <div v-if="held && p && c.melt > 0" class="metal-stream" aria-hidden="true"/>
        <button class="pouring-crucible" :class="{ 'pouring-crucible--tilted': held }" :disabled="!p" :aria-label="t('workshop.dragCrucible')" @pointerdown="start" @pointermove="move" @pointerup="lower" @pointercancel="lower" @lostpointercapture="lower" @keydown="key" @keyup.space.prevent="lower">
          <svg viewBox="0 0 100 90" aria-hidden="true"><path d="M12 21Q50 5 88 21L76 73Q50 85 24 73Z" fill="#695544" stroke="#bca27c" stroke-width="4"/><ellipse cx="50" cy="21" rx="38" ry="12" fill="#df752c" stroke="#c4a078" stroke-width="4"/><ellipse cx="50" cy="19" rx="26" ry="6" fill="#ffc85f"/><path d="M12 25 2 14M88 25l10-11" stroke="#bca27c" stroke-width="5"/></svg>
        </button>
        <div class="pouring-mould"><div class="mould-metal" :style="{ height: (m?.fill || 0) * 100 + '%' }"/><span v-if="m?.ruined">{{ t('workshop.ruinedCasting') }}</span></div>
        <span v-if="held && height > .72" class="spill-warning">{{ t('workshop.tooHigh') }}</span>
      </div>
      <footer><strong>{{ t('workshop.castingScore', { quality }) }}</strong><button v-if="p" @click="lower(); emit('command', 'finishPour')">{{ t('workshop.finishPour') }}</button><button v-else @click="close">{{ t('workshop.returnWorkshop') }}</button></footer>
      <p v-if="!p" role="status">{{ t(m?.ruined ? 'workshop.castingFailed' : 'workshop.castingFinished') }}</p>
    </section>
  </div>
</template>
<style scoped>
.pouring-scrim{position:absolute;inset:0;z-index:35;display:grid;place-items:center;padding:12px;background:#111c18b8}.pouring-game{width:min(480px,100%);max-height:100%;overflow:auto;border:2px solid #b59b64;border-radius:10px;background:#25382c;color:#ead6a8;padding:16px;box-shadow:0 10px 35px #0008}.pouring-game header,.pouring-game footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.pouring-game h2{margin:0;font-size:22px}.pouring-game p{font-size:12px;line-height:1.5}.pouring-game button{border:1px solid #b49a61;border-radius:5px;background:#3d5037;color:#efdaa5;padding:6px 10px;cursor:pointer}.pouring-stats{display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px}.pouring-arena{height:250px;position:relative;margin:10px 0;background:radial-gradient(ellipse at 50% 95%,#79523766,transparent 65%);border:1px solid #8c794a;border-radius:8px;overflow:hidden}.pouring-game .pouring-crucible{position:absolute;left:50%;bottom:calc(24% + var(--lift)*46%);width:74px;height:67px;transform:translateX(-50%);background:transparent;border:0;padding:0;touch-action:none;z-index:3;transition:transform .15s,bottom .08s}.pouring-crucible svg{width:100%;height:100%}.pouring-game .pouring-crucible--tilted{transform:translateX(-50%) rotate(22deg)}.pouring-crucible:disabled{cursor:default}.pouring-mould{position:absolute;bottom:15px;left:50%;width:128px;height:39px;transform:translateX(-50%);border:7px solid #777467;border-top-width:3px;background:#342a22;overflow:hidden;box-shadow:0 5px 0 #454c43}.mould-metal{position:absolute;bottom:0;left:0;width:100%;background:#f8a14d;box-shadow:0 0 12px #ffa849}.metal-stream{position:absolute;left:50%;width:5px;bottom:48px;top:calc(68% - var(--lift)*46%);background:#ffbd53;box-shadow:0 0 8px #f86c24;z-index:2}.pouring-arena--danger .metal-stream{width:11px;box-shadow:14px 12px 0 -3px #f99b40,-18px 27px 0 -3px #f99b40}.pouring-arena--ruined .mould-metal{background:#797366;box-shadow:none}.pouring-mould span{position:relative;font-size:9px;color:#fff}.spill-warning{position:absolute;right:6px;top:8px;color:#ffbaa4;font-size:11px}.pouring-game footer{font-size:12px}@media(max-height:600px){.pouring-arena{height:180px}.pouring-game{padding:10px}}
</style>

<style scoped>.pouring-game{height:calc(100% - 8px);max-height:620px;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box}.pouring-game header{position:sticky;top:0;z-index:10;background:#25382c;flex:none}.pouring-arena{flex:1;min-height:85px;height:auto}.pouring-game footer,.pouring-stats,.pouring-game>p{flex:none}.pouring-game button:hover:not(:disabled){background:#dec18a;color:#203428}</style>

<style scoped>
.pouring-scrim{padding:0;z-index:40;box-sizing:border-box}.pouring-game{width:100%;height:100%;max-width:none;max-height:none;border-radius:0;padding:12px}.pouring-arena{min-height:65px}.pouring-game header{flex:none}@media(max-width:570px){.pouring-game{padding:8px}.pouring-game>p{font-size:10px;margin:5px 0}.pouring-stats{font-size:10px}}
</style>
