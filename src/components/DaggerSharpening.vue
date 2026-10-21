<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { customGrindingCells, designPaths, cellNeedsEdge, componentItems, METALS } from '../weapon-design'
import { items } from '../inventory'
import { average } from '../workshop'
import { GRINDING_WHEEL as wheel, grindingWidth, grindingContactCells } from '../grinding'
const props = defineProps({ blade: Object, paused: Boolean })
const emit = defineEmits(['command'])
const { t } = useI18n()
const x = ref(.3), depth = ref(.4), side = ref(0), holding = ref(false)
const contact = computed(() => props.blade.design ? customGrindingCells(props.blade.design, x.value, depth.value, side.value) : grindingContactCells(x.value, depth.value, side.value))
const edgeScores = computed(() => props.blade.sharpness.filter((_, i) => !props.blade.design || cellNeedsEdge(props.blade.design, i)))
const handleLength = computed(() => componentItems('handle').find(i => i.id === props.blade.design?.handle)?.component.length || 12)
const scale = computed(() => grindingWidth(depth.value))
let timer, previous
function move(event) {
  if (props.paused) return
  const r = event.currentTarget.getBoundingClientRect()
  const width = Math.min(r.width, r.height * 4 / 3), height = width * 3 / 4
  const left = r.left + (r.width - width) / 2, top = r.top + (r.height - height) / 2
  x.value = Math.max(.08, Math.min(.92, (event.clientX - left) / width))
  depth.value = Math.max(0, Math.min(1, (event.clientY - top) / height))
}
function begin(event) {
  if (props.paused || props.blade.stage !== 'assembled' || event.button !== 0) return
  move(event); event.currentTarget.setPointerCapture?.(event.pointerId); holding.value = true
}
function stop() { holding.value = false }
function tick(seconds) {
  if (holding.value && !props.paused && contact.value.length) emit('command', 'grind', { seconds, x: x.value, depth: depth.value, side: side.value })
}
watch(() => props.paused, value => { if (value) stop() })
onMounted(() => {
  window.addEventListener('blur', stop); previous = performance.now()
  timer = setInterval(() => { const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now; tick(dt) }, 40)
})
onBeforeUnmount(() => { stop(); clearInterval(timer); window.removeEventListener('blur', stop) })
</script>
<template>
  <div class="dagger-sharpening">
    <p>{{ t('workshop.grindHelp') }}</p>

    <div class="grinding-arena" :class="{ 'grinding-arena--contact': holding && contact.length }" @pointermove="move" @pointerdown.prevent="begin" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop" :aria-label="t('workshop.grindHelp')">
      <svg viewBox="0 0 400 300" aria-hidden="true">
        <defs><pattern id="grinding-grit" width="7" height="12" patternUnits="userSpaceOnUse"><rect width="7" height="12" fill="#686b60"/><path d="M0 2h5M2 8h5" stroke="#929587" stroke-width="2"/></pattern></defs>
        <rect x="163" y="100" width="74" height="191" rx="8" fill="#343e35" stroke="#a18b5e" stroke-width="3"/>
        <rect :x="wheel.x" :y="wheel.y" :width="wheel.width" :height="wheel.height" rx="4" fill="url(#grinding-grit)"/>
        <g class="wheel-streaks"><path v-for="row in 12" :key="row" :d="'M172 ' + (111 + row * 13) + 'h56'" stroke="#b5b6a5" stroke-opacity=".25"/></g>
        <ellipse :cx="x * 400 - 35 + (holding ? 2 : 12)" cy="218" :rx="holding ? 106 : 115" ry="6" fill="#101b16" :opacity="holding ? .4 : .65"/>
        <g v-if="!blade.design" :transform="'translate(' + (x * 400 - 200) + ' ' + (holding ? 0 : -9) + ')'">
          <g :key="side" class="grinding-turn"><g :transform="'translate(200 190) rotate(-90) scale(' + (holding ? scale : Math.min(1, scale + .13)) + ' 1) translate(-200 -190)'" class="grinding-dagger" :class="{ 'grinding-dagger--back': side === 1 }">
            <path d="M186 120h28v114l-14 44-14-44Z" fill="#b7c0b0" stroke="#46514a" stroke-width="2"/>
            <g v-for="row in 8" :key="row">
              <rect :x="186 + Math.max(0, row - 6) * 5" :y="126 + (row - 1) * 19" :width="28 - Math.max(0, row - 6) * 10" height="18" :fill="holding && contact.includes(side * 8 + row - 1) ? '#e7b565' : '#e4e9d9'" :opacity=".2 + blade.sharpness[side * 8 + row - 1] / 145"/>
              <text :transform="'rotate(90 200 ' + (139 + (row - 1) * 19) + ')'" x="200" :y="139 + (row - 1) * 19" text-anchor="middle" font-size="8" fill="#1c3127">{{ Math.round(blade.sharpness[side * 8 + row - 1]) }}</text>
            </g>
            <image :href="items.dagger_guard.imageSrc" x="160" y="86" width="80" height="80"/>
            <image :href="items.dagger_handle.imageSrc" x="160" y="50" width="80" height="80"/>
            <image :href="items.dagger_pommel.imageSrc" x="160" y="12" width="80" height="80"/>
          </g></g>
        </g>
        <g v-if="blade.design" :key="side" :transform="`translate(${x * 400 - 85} ${holding ? 190 : 181}) scale(${170 / blade.design.length} ${(170 / blade.design.length) * (1 - depth * .65)})`"><rect :x="-handleLength" y="-2" :width="handleLength" height="4" rx="1" fill="#865c38"/><rect x="-1" y="-6" width="2" height="12" fill="#b29d70"/><circle :cx="-handleLength" cy="0" r="3" fill="#b29d70"/><path v-for="(path, i) in designPaths(blade.design)" :key="i" :d="path" :fill="holding && contact.includes(side * blade.design.sections.length + i) ? '#e7b565' : METALS[blade.design.material].color" stroke="#36453d" stroke-width=".3"/></g><g v-if="holding && contact.length" class="grinding-sparks" stroke="#ffd183" stroke-width="2"><path :d="'M' + (x * 400) + ' 180l-24-16m24 16 30-9m-30 9 20 24'"/></g>
      </svg>
    </div>
    <p role="status">{{ t('workshop.grindContacts', { count: holding ? contact.length : 0 }) }} · {{ t('workshop.sharpness', { quality: Math.round((edgeScores.length ? average(edgeScores) : 100)) }) }}</p>
    <div class="grinding-buttons"><button :disabled="holding" @click="side = 1 - side">{{ t('workshop.flip') }}</button><button :disabled="holding" @click="emit('command', 'finish')">{{ t('workshop.finish') }}</button></div>
  </div>
</template>
<style scoped>
.dagger-sharpening p{font-size:11px;line-height:1.5;margin:6px 0}.grinding-readings{display:flex;flex-wrap:wrap;gap:8px;color:#ddc991;font-size:10px}.grinding-arena{height:260px;background:radial-gradient(#49513c,#17261f);border:1px solid #9e8a5655;border-radius:6px;touch-action:none;cursor:crosshair;overflow:hidden}.grinding-arena svg{width:100%;height:100%;display:block;pointer-events:none}.wheel-streaks{animation:wheel-travel .16s linear infinite}.grinding-turn{transform-box:fill-box;transform-origin:center;animation:blade-turn .28s ease-out}.grinding-dagger{transition:filter .2s}.grinding-dagger--back{filter:brightness(.88)}.grinding-sparks{animation:grinding-sparks .15s ease-in-out alternate infinite}.grinding-buttons{display:flex;gap:8px}.grinding-buttons button{flex:1;padding:7px;border:1px solid #b29b62;background:#485038;border-radius:5px;color:#eed5a1;font-size:11px}.grinding-buttons button:disabled{opacity:.4}@keyframes blade-turn{from{transform:rotateY(180deg)}to{transform:rotateY(0)}}@keyframes wheel-travel{to{transform:translateY(13px)}}@keyframes grinding-sparks{to{opacity:.35;transform:translate(2px,3px)}}@media(prefers-reduced-motion:reduce){.wheel-streaks,.grinding-sparks,.grinding-turn{animation:none}}
</style>

<style scoped>
.dagger-sharpening{height:100%;min-height:0;display:flex;flex-direction:column}.grinding-arena{flex:1;min-height:90px;height:auto}.grinding-buttons,.dagger-sharpening>p{flex:none}
</style>
