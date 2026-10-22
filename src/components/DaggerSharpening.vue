<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { bladeGeometry, customGrindingCells, designPaths, cellNeedsEdge, componentItems, METALS } from '../weapon-design'
import { items } from '../inventory'
import { GRINDING_WHEEL as wheel, grindingWidth, grindingContactCells } from '../grinding'
const props = defineProps({ blade: Object, paused: Boolean })
const emit = defineEmits(['command'])
const { t } = useI18n()
const bladeClipId = useId()
const surfaceClipId = useId()
const upperBevelId = useId()
const lowerBevelId = useId()
const glintId = useId()
const grainId = useId()
const guardSheenId = useId()
const polishClipId = useId()
const x = ref(.3), depth = ref(.4), side = ref(0), holding = ref(false), flipping = ref(false)
const sparkActive = ref(false)
let nextSparkAt = 0, sparkEndsAt = 0
const contact = computed(() => props.blade.design ? customGrindingCells(props.blade.design, x.value, depth.value, side.value) : grindingContactCells(x.value, depth.value, side.value))
const polishFor = section => Math.max(0, Math.min(1, (props.blade.sharpness[side.value * props.blade.design.sections.length + section] || 0) / 100))
const sparkPoint = computed(() => {
  if (!holding.value || !contact.value.length) return null
  if (!props.blade.design) return { x: Math.max(wheel.x, Math.min(wheel.x + wheel.width, x.value * 400)), y: 190 }
  const geometry = bladeGeometry(props.blade.design)
  const sectionCount = props.blade.design.sections.length
  const activeSections = new Set(contact.value.map(index => index % sectionCount))
  const scaleX = 170 / props.blade.design.length
  const scaleY = scaleX * (1 - depth.value * .65)
  const candidates = geometry.samples
    .filter(sample => activeSections.has(sample.section))
    .map(sample => ({
      x: x.value * 400 - 85 + sample.x * scaleX,
      y: 190 - sample.y * scaleY + sample.width * scaleY * .4,
    }))
    .filter(point => point.x >= wheel.x && point.x <= wheel.x + wheel.width)
  return candidates.reduce((nearest, point) => !nearest || Math.abs(point.x - (wheel.x + wheel.width / 2)) < Math.abs(nearest.x - (wheel.x + wheel.width / 2)) ? point : nearest, null)
})
const handleLength = computed(() => componentItems('handle').find(i => i.id === props.blade.design?.handle)?.component.length || 12)
const scale = computed(() => grindingWidth(depth.value))
const bladePaths = computed(() => props.blade.design ? designPaths(props.blade.design) : [])
const bladeFaces = computed(() => {
  if (!props.blade.design) return null
  const geometry = bladeGeometry(props.blade.design)
  const first = geometry.samples[0], last = geometry.samples.at(-1)
  const tip = geometry.points.at(-1)
  const samples = [{ ...first, x: 0, y: 0 }, ...geometry.samples, { ...last, x: tip.x, y: tip.y, width: props.blade.design.point === 'flat' ? last.width : 0 }]
  const upper = samples.map(p => [p.x - Math.sin(p.angle) * p.width / 2, -p.y - Math.cos(p.angle) * p.width / 2])
  const centre = samples.map(p => [p.x, -p.y])
  const lower = samples.map(p => [p.x + Math.sin(p.angle) * p.width / 2, -p.y + Math.cos(p.angle) * p.width / 2])
  const trace = (points, closed = false) => points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ') + (closed ? ' Z' : '')
  return { upper: trace([...upper, ...centre.slice().reverse()], true), lower: trace([...centre, ...lower.slice().reverse()], true), ridge: trace(centre), upperEdge: trace(upper), lowerEdge: trace(lower) }
})
const sharpnessLabels = computed(() => {
  if (!props.blade.design) return []
  const geometry = bladeGeometry(props.blade.design)
  const count = props.blade.design.sections.length
  return props.blade.design.sections.flatMap((_, section) => {
    const index = side.value * count + section
    if (!cellNeedsEdge(props.blade.design, index)) return []
    const start = geometry.boundaries[section], end = geometry.boundaries[section + 1]
    const midpoint = (start + end) / 2 * props.blade.design.length
    const sample = geometry.samples.reduce((nearest, point) => Math.abs(point.x - midpoint) < Math.abs(nearest.x - midpoint) ? point : nearest)
    return [{ section, x: sample.x, y: -sample.y, angle: -sample.angle * 180 / Math.PI, fontSize: Math.max(.7, Math.min(1.4, (end - start) * props.blade.design.length / 4.5)), quality: Math.round(props.blade.sharpness[index] || 0) }]
  })
})
let timer, previous, flipMidTimer, flipEndTimer
function move(event) {
  if (props.paused || flipping.value) return
  const r = event.currentTarget.getBoundingClientRect()
  const width = Math.min(r.width, r.height * 4 / 3), height = width * 3 / 4
  const left = r.left + (r.width - width) / 2, top = r.top + (r.height - height) / 2
  x.value = Math.max(.08, Math.min(.92, (event.clientX - left) / width))
  depth.value = Math.max(0, Math.min(1, (event.clientY - top) / height))
}
function begin(event) {
  if (props.paused || flipping.value || props.blade.stage !== 'assembled' || event.button !== 0) return
  move(event); event.currentTarget.setPointerCapture?.(event.pointerId); holding.value = true
}
function stop() { holding.value = false; sparkActive.value = false; nextSparkAt = 0 }
function flipBlade() {
  if (holding.value || flipping.value || props.paused) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { side.value = 1 - side.value; return }
  flipping.value = true
  flipMidTimer = setTimeout(() => { side.value = 1 - side.value }, 210)
  flipEndTimer = setTimeout(() => { flipping.value = false }, 420)
}
function tick(seconds) {
  if (holding.value && !flipping.value && !props.paused && contact.value.length) emit('command', 'grind', { seconds, x: x.value, depth: depth.value, side: side.value })
  const now = performance.now()
  if (!holding.value || !sparkPoint.value || props.paused) { sparkActive.value = false; nextSparkAt = 0; return }
  if (sparkActive.value && now >= sparkEndsAt) sparkActive.value = false
  if (!nextSparkAt) nextSparkAt = now + 250 + Math.random() * 900
  if (now >= nextSparkAt) {
    sparkActive.value = true
    sparkEndsAt = now + 90 + Math.random() * 130
    nextSparkAt = now + 450 + Math.random() * 1600
  }
}
watch(() => props.paused, value => { if (value) stop() })
onMounted(() => {
  window.addEventListener('blur', stop); previous = performance.now()
  timer = setInterval(() => { const now = performance.now(), dt = Math.min(.1, (now - previous) / 1000); previous = now; tick(dt) }, 40)
})
onBeforeUnmount(() => { stop(); clearInterval(timer); clearTimeout(flipMidTimer); clearTimeout(flipEndTimer); window.removeEventListener('blur', stop) })
</script>
<template>
  <div class="dagger-sharpening">
    <p>{{ t('workshop.grindHelp') }}</p>

    <div class="grinding-arena" :class="{ 'grinding-arena--contact': holding && contact.length }" @pointermove="move" @pointerdown.prevent="begin" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop" :aria-label="t('workshop.grindHelp')">
      <svg viewBox="0 0 400 300" aria-hidden="true">
        <defs>
          <pattern id="grinding-grit" width="7" height="12" patternUnits="userSpaceOnUse"><rect width="7" height="12" fill="#686b60"/><path d="M0 2h5M2 8h5" stroke="#929587" stroke-width="2"/></pattern>
          <clipPath :id="bladeClipId"><rect x="0" y="-200" width="200" height="400"/></clipPath>
          <clipPath :id="surfaceClipId"><path v-for="(path, i) in bladePaths" :key="i" :d="path"/></clipPath>
          <clipPath v-for="(path, i) in bladePaths" :id="`${polishClipId}-${i}`" :key="`polish-${i}`"><path :d="path"/></clipPath>
          <linearGradient :id="upperBevelId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f8e7" stop-opacity=".62"/><stop offset=".36" stop-color="#e9f2e7" stop-opacity=".32"/><stop offset="1" stop-color="#263630" stop-opacity=".13"/></linearGradient>
          <linearGradient :id="lowerBevelId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9e6" stop-opacity=".2"/><stop offset=".52" stop-color="#32433e" stop-opacity=".16"/><stop offset="1" stop-color="#182725" stop-opacity=".54"/></linearGradient>
          <linearGradient v-if="blade.design" :id="glintId" gradientUnits="userSpaceOnUse" :x1="blade.design.length * (.05 + depth * .52)" :x2="blade.design.length * (.35 + depth * .52)" y1="0" y2="0"><stop offset="0" stop-color="#fffde5" stop-opacity="0"/><stop offset=".5" stop-color="#fffde5" stop-opacity=".18"/><stop offset="1" stop-color="#fffde5" stop-opacity="0"/></linearGradient>
          <linearGradient :id="guardSheenId" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e8b5"/><stop offset=".38" stop-color="#bca872"/><stop offset="1" stop-color="#514b39"/></linearGradient>
          <pattern :id="grainId" patternUnits="userSpaceOnUse" width="5" height="3.5" patternTransform="rotate(-5)"><path d="M.3 .6h2.4M2.9 1.9h1.8M.9 3h3" stroke="#f7f7df" stroke-opacity=".22" stroke-width=".12"/><path d="M1.4 1.4h2.5" stroke="#172b29" stroke-opacity=".25" stroke-width=".12"/></pattern>
        </defs>
        <rect x="163" y="100" width="74" height="191" rx="8" fill="#343e35" stroke="#a18b5e" stroke-width="3"/>
        <rect :x="wheel.x" :y="wheel.y" :width="wheel.width" :height="wheel.height" rx="4" fill="url(#grinding-grit)"/>
        <g class="wheel-streaks"><path v-for="row in 12" :key="row" :d="'M172 ' + (111 + row * 13) + 'h56'" stroke="#b5b6a5" stroke-opacity=".25"/></g>
        <ellipse :cx="x * 400 - 35 + (holding ? 2 : 12)" cy="218" :rx="holding ? 106 : 115" ry="6" fill="#101b16" :opacity="holding ? .4 : .65"/>
        <g v-if="!blade.design" :transform="'translate(' + (x * 400 - 200) + ' ' + (holding ? 0 : -9) + ')'">
          <g class="grinding-turn" :class="{ 'grinding-turn--flipping': flipping }"><g :transform="'translate(200 190) rotate(-90) scale(' + (holding ? scale : Math.min(1, scale + .13)) + ' 1) translate(-200 -190)'" class="grinding-dagger" :class="{ 'grinding-dagger--back': side === 1 }">
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
        <g v-if="blade.design" :transform="`translate(${x * 400 - 85} ${holding ? 190 : 181}) scale(${170 / blade.design.length} ${(170 / blade.design.length) * (1 - depth * .65)})`"><g class="grinding-turn" :class="{ 'grinding-turn--flipping': flipping, 'grinding-dagger--back': side === 1 }">
          <g :clip-path="`url(#${bladeClipId})`">
            <g :transform="`translate(0 ${side ? -(.55 + depth * .7) : .55 + depth * .7})`"><path v-for="(path, i) in bladePaths" :key="`rim-${i}`" :d="path" fill="#3b4c47" stroke="#293933" stroke-width=".16"/></g>
            <path v-for="(path, i) in bladePaths" :key="i" :d="path" :fill="holding && contact.includes(side * blade.design.sections.length + i) ? '#e7b565' : METALS[blade.design.material].color" stroke="#36453d" stroke-width=".3"/>
            <path v-if="bladeFaces" :d="bladeFaces.upper" :fill="`url(#${upperBevelId})`" opacity=".18"/>
            <path v-if="bladeFaces" :d="bladeFaces.lower" :fill="`url(#${lowerBevelId})`" opacity=".18"/>
            <rect x="0" y="-100" width="200" height="200" :fill="`url(#${grainId})`" :clip-path="`url(#${surfaceClipId})`"/>
            <g v-for="(_, i) in bladePaths" :key="`shine-${i}`" :clip-path="`url(#${polishClipId}-${i})`" :opacity="polishFor(i)">
              <path v-if="bladeFaces" :d="bladeFaces.upper" :fill="`url(#${upperBevelId})`"/>
              <path v-if="bladeFaces" :d="bladeFaces.lower" :fill="`url(#${lowerBevelId})`"/>
              <rect x="0" y="-100" width="200" height="200" :fill="`url(#${glintId})`"/>
            </g>
            <path v-if="bladeFaces" :d="bladeFaces.ridge" fill="none" stroke="#f5f5dc" :stroke-opacity=".18 + blade.sharpness.reduce((sum, value) => sum + value, 0) / Math.max(1, blade.sharpness.length) / 100 * .3" stroke-width=".18"/>
            <path v-if="bladeFaces" :d="bladeFaces.upperEdge" fill="none" stroke="#fff8db" stroke-opacity=".24" stroke-width=".12"/>
            <path v-if="bladeFaces" :d="bladeFaces.lowerEdge" fill="none" stroke="#20312e" stroke-opacity=".6" stroke-width=".17"/>
          </g>
          <g :clip-path="`url(#${bladeClipId})`"><text v-for="label in sharpnessLabels" :key="label.section" :transform="`translate(${label.x} ${label.y}) rotate(${label.angle})`" text-anchor="middle" dominant-baseline="middle" :font-size="label.fontSize" fill="#fff1d0" stroke="#27342f" stroke-width=".18" paint-order="stroke">{{ label.quality }}%</text></g>
          <rect :x="-handleLength" y="-2" :width="handleLength" height="4" rx="1" fill="#6b432c" stroke="#3a3028" stroke-width=".25"/>
          <path :d="`M${-handleLength + 2} -1.15H-1.7`" fill="none" stroke="#c18b59" stroke-opacity=".72" stroke-width=".34"/>
          <path :d="`M${-handleLength + 2} 1.35H-1.7`" fill="none" stroke="#33291f" stroke-opacity=".6" stroke-width=".28"/>
          <rect x="-1" y="-6" width="2" height="12" rx=".45" :fill="`url(#${guardSheenId})`" stroke="#514a37" stroke-width=".22"/>
          <circle :cx="-handleLength" cy="0" r="3" fill="#a99872" stroke="#4b493a" stroke-width=".28"/>
          <ellipse :cx="-handleLength - .5" cy="-.8" rx="1.15" ry=".6" fill="#f6e3b4" opacity=".55"/>
        </g></g><g v-if="sparkPoint && sparkActive" :transform="`translate(${sparkPoint.x} ${sparkPoint.y})`"><g class="grinding-sparks" stroke="#ffd183" stroke-width="1.2" stroke-linecap="round"><circle r="1.5" fill="#fff2c1" stroke="none"/><path d="M-2 -1l-5-4M2 -1l4-5M2 1l6 2"/></g></g>
      </svg>
    </div>
    <div class="grinding-buttons"><button :disabled="holding || flipping" @click="flipBlade">{{ t('workshop.flip') }}</button><button :disabled="holding || flipping" @click="emit('command', 'finish')">{{ t('workshop.finish') }}</button></div>
  </div>
</template>
<style scoped>
.dagger-sharpening p{font-size:11px;line-height:1.5;margin:6px 0}.grinding-readings{display:flex;flex-wrap:wrap;gap:8px;color:#ddc991;font-size:10px}.grinding-arena{height:260px;background:radial-gradient(#49513c,#17261f);border:1px solid #9e8a5655;border-radius:6px;touch-action:none;cursor:crosshair;overflow:hidden}.grinding-arena svg{width:100%;height:100%;display:block;pointer-events:none}.wheel-streaks{animation:wheel-travel .16s linear infinite}.grinding-turn{transform-box:fill-box;transform-origin:center}.grinding-turn--flipping{animation:blade-turn .42s ease-in-out both}.grinding-dagger{transition:filter .2s}.grinding-dagger--back{filter:brightness(.88)}.grinding-sparks{animation:grinding-sparks .15s ease-in-out alternate infinite}.grinding-buttons{display:flex;gap:8px}.grinding-buttons button{flex:1;padding:7px;border:1px solid #b29b62;background:#485038;border-radius:5px;color:#eed5a1;font-size:11px}.grinding-buttons button:disabled{opacity:.4}@keyframes blade-turn{0%{transform:scaleY(1)}48%{transform:scaleY(.04)}52%{transform:scaleY(.04)}100%{transform:scaleY(1)}}@keyframes wheel-travel{to{transform:translateY(13px)}}@keyframes grinding-sparks{to{opacity:.35;transform:translate(2px,3px)}}@media(prefers-reduced-motion:reduce){.wheel-streaks,.grinding-sparks,.grinding-turn--flipping{animation:none}}
</style>

<style scoped>
.dagger-sharpening{height:100%;min-height:0;display:flex;flex-direction:column}.grinding-arena{flex:1;min-height:90px;height:auto}.grinding-buttons,.dagger-sharpening>p{flex:none}
</style>
