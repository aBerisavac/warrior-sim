<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { bladeGeometry, componentItems, METALS } from '../weapon-design'
import { scoreWork } from '../workshop'

const props = defineProps({ blade: { type: Object, required: true }, page: { type: Number, default: 0 }, working: Boolean, striking: Boolean, power: { type: Number, default: 0 } })
const emit = defineEmits(['begin', 'stop', 'cancel', 'abort'])
const { t } = useI18n()
const clipId = useId()
const textureId = useId()
const sheenId = useId()
const bevelId = useId()
const hoveredCell = ref(null)
const pointer = ref(null)
const impact = ref(false)
const returning = ref(false)
const returnTransform = ref('none')
const hammerSprite = ref(null)
const impactWindupAngle = ref(22)
const impactWindupX = ref(24)
const impactWindupY = ref(-38)
const pointerInside = ref(false)
let impactTimer, returnTimer
let strikeTarget, strikePointerId
function trackPointer(event) {
  if (props.striking || impact.value || returning.value) return
  const bounds = event.currentTarget.getBoundingClientRect()
  pointer.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}
function beginStrike(event, cell) {
  if (impact.value || returning.value || (event.button !== undefined && event.button !== 0)) return
  const bounds = event.currentTarget.closest('.hammer-blank').getBoundingClientRect()
  pointer.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  strikeTarget = event.currentTarget
  strikePointerId = event.pointerId
  emit('begin', event, cell)
}
function cancelOnSecondary(event) {
  if (event.button !== 1 && event.button !== 2) return
  event.preventDefault()
  event.stopPropagation()
  if (returning.value) return
  const wasSwinging = props.striking || impact.value
  returnTransform.value = hammerSprite.value ? getComputedStyle(hammerSprite.value).transform : 'none'
  impact.value = false
  clearTimeout(impactTimer)
  if (wasSwinging) {
    returning.value = true
    clearTimeout(returnTimer)
    returnTimer = setTimeout(() => { returning.value = false; if (!pointerInside.value) pointer.value = null }, 300)
  }
  hoveredCell.value = null
  if (strikeTarget?.hasPointerCapture?.(strikePointerId)) strikeTarget.releasePointerCapture(strikePointerId)
  strikeTarget = null
  emit('abort')
}
function endStrike(event) {
  if (returning.value || (event?.button !== undefined && event.button !== 0)) return
  strikeTarget = null
  if (props.striking) {
    const strength = Math.max(0, Math.min(1, props.power))
    impactWindupAngle.value = 22 + strength * 10
    impactWindupX.value = 24 + strength * 18
    impactWindupY.value = -(38 + strength * 28)
    impact.value = true
    clearTimeout(impactTimer)
    impactTimer = setTimeout(() => { impact.value = false; if (!pointerInside.value) pointer.value = null }, 800)
  }
  emit('stop', props.power)
}
onBeforeUnmount(() => { clearTimeout(impactTimer); clearTimeout(returnTimer) })
const geometry = computed(() => bladeGeometry(props.blade.design))
const sections = computed(() => props.blade.design.sections)
const pageSamples = computed(() => {
  const first = props.page * 3, last = first + 2
  const selected = geometry.value.samples.filter(sample => sample.section >= first && sample.section <= last)
  if (!selected.length) return []
  const start = selected[0], end = selected.at(-1)
  const points = [{ ...start, x: props.page ? start.x : 0 }, ...selected]
  if (last === sections.value.length - 1) points.push({ ...end, ...geometry.value.points.at(-1), width: props.blade.design.point === 'flat' ? end.width : 0 })
  return points
})
const pageLength = computed(() => Math.max(1, pageSamples.value.at(-1).x - pageSamples.value[0].x))
const ingotHalf = computed(() => Math.max(1.8, Math.max(...pageSamples.value.map(sample => sample.width)) * .72))
const tangMax = computed(() => {
  if (props.page !== 0) return 0
  const handle = componentItems('handle').find(item => item.id === props.blade.design.handle)?.component.length || 12
  const pommel = componentItems('pommel').find(item => item.id === props.blade.design.pommel)?.component.length || 3
  return handle + pommel * .5
})
const extent = computed(() => Math.max(ingotHalf.value, ...pageSamples.value.map(sample => Math.abs(sample.y) + sample.width / 2)) + 2)
const viewBox = computed(() => `${-tangMax.value - 2} ${-extent.value} ${pageLength.value + tangMax.value + 4} ${extent.value * 2}`)
const progressFor = (sample, side) => scoreWork(props.blade.work[side * sections.value.length + sample.section] || 0) / 100
const heat = computed(() => {
  const metal = METALS[props.blade.design.material] || METALS.iron
  const temperature = Number.isFinite(props.blade.temperature) ? props.blade.temperature : metal.workMin
  const amount = Math.max(0, Math.min(1, (temperature - metal.workMin) / (metal.workMax - metal.workMin)))
  const base = metal.color.match(/[\da-f]{2}/gi).map(part => parseInt(part, 16))
  return `rgb(${base.map((channel, index) => Math.round(channel + ([244, 177, 64][index] - channel) * amount)).join(',')})`
})
const averageProgress = computed(() => props.blade.work.reduce((sum, value) => sum + scoreWork(value), 0) / Math.max(1, props.blade.work.length) / 100)
const shaped = computed(() => {
  const origin = pageSamples.value[0].x
  const top = pageSamples.value.map(sample => {
    const progress = progressFor(sample, 0)
    return [sample.x - origin - Math.sin(sample.angle) * sample.width / 2 * progress, -ingotHalf.value * (1 - progress) - (sample.y + Math.cos(sample.angle) * sample.width / 2) * progress]
  })
  const bottom = pageSamples.value.map(sample => {
    const progress = progressFor(sample, 1)
    return [sample.x - origin + Math.sin(sample.angle) * sample.width / 2 * progress, ingotHalf.value * (1 - progress) - (sample.y - Math.cos(sample.angle) * sample.width / 2) * progress]
  })
  const tangLength = tangMax.value * averageProgress.value
  const shoulderHalf = Math.max(.08, ingotHalf.value * .19 * averageProgress.value)
  const shaftHalf = shoulderHalf * .65
  const outline = tangLength ? [
    [-tangLength, 0], [-tangLength * .93, -shaftHalf * .48], [-tangLength * .78, -shaftHalf],
    [-tangLength * .12, -shaftHalf], [0, -shoulderHalf], ...top, ...bottom.slice().reverse(),
    [0, shoulderHalf], [-tangLength * .12, shaftHalf], [-tangLength * .78, shaftHalf],
    [-tangLength * .93, shaftHalf * .48],
  ] : [...top, ...bottom.slice().reverse()]
  const trace = (points, close = false) => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + (close ? ' Z' : '')
  const ridge = top.map(([x, y], index) => [x, (y + bottom[index][1]) / 2])
  return {
    outline: trace(outline, true),
    upper: trace([...top, ...ridge.slice().reverse()], true),
    lower: trace([...ridge, ...bottom.slice().reverse()], true),
    ridge: trace(ridge),
    upperEdge: trace(top),
    lowerEdge: trace(bottom),
  }
})
const path = computed(() => shaped.value.outline)
const zones = computed(() => {
  const boundaries = geometry.value.boundaries
  const start = boundaries[props.page * 3], end = boundaries[props.page * 3 + 3]
  return [0, 1].flatMap(side => [0, 1, 2].map(column => {
    const section = props.page * 3 + column
    const cell = side * sections.value.length + section
    const left = pageLength.value * (boundaries[section] - start) / (end - start)
    const right = pageLength.value * (boundaries[section + 1] - start) / (end - start)
    const middle = (left + right) / 2
    const sample = pageSamples.value.reduce((nearest, point) => Math.abs(point.x - pageSamples.value[0].x - middle) < Math.abs(nearest.x - pageSamples.value[0].x - middle) ? point : nearest)
    const progress = progressFor(sample, side)
    const edge = side
      ? ingotHalf.value * (1 - progress) - (sample.y - Math.cos(sample.angle) * sample.width / 2) * progress
      : -ingotHalf.value * (1 - progress) - (sample.y + Math.cos(sample.angle) * sample.width / 2) * progress
    return { cell, side, left, right, labelX: middle, labelY: edge * .58, quality: Math.round(scoreWork(props.blade.work[cell])) }
  }))
})
</script>

<template>
  <div class="hammer-blank" :class="{ 'hammer-blank--working': working }" @pointerenter="pointerInside = true" @pointermove="trackPointer" @pointerdown.capture="cancelOnSecondary" @mousedown.capture="cancelOnSecondary" @auxclick.prevent="cancelOnSecondary" @contextmenu.prevent="cancelOnSecondary" @pointerleave="pointerInside = false; hoveredCell = null; if (!striking && !impact && !returning) pointer = null">
    <svg :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath :id="clipId"><path :d="path" /></clipPath>
        <linearGradient :id="sheenId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8df" stop-opacity=".24"/><stop offset=".4" stop-color="#fff8df" stop-opacity=".04"/><stop offset="1" stop-color="#0e1b1e" stop-opacity=".25"/></linearGradient>
        <linearGradient :id="bevelId" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff5d3" stop-opacity=".28"/><stop offset=".48" stop-color="#fff5d3" stop-opacity=".03"/><stop offset="1" stop-color="#101e1f" stop-opacity=".34"/></linearGradient>
        <pattern :id="textureId" patternUnits="userSpaceOnUse" width="3.4" height="2.7" patternTransform="rotate(-7)"><path d="M.2 .5h1.8M1.3 1.8h1.5M2.7 2.4h.5" stroke="#f6ead0" stroke-opacity=".17" stroke-width=".1"/><path d="M.7 1.2h2.1M.1 2.3h1" stroke="#1b292c" stroke-opacity=".24" stroke-width=".12"/></pattern>
      </defs>
      <path :d="path" :fill="heat" stroke="#38413e" :stroke-width="Math.max(.12, pageLength / 200)" />
      <path :d="shaped.upper" :fill="`url(#${bevelId})`" pointer-events="none" />
      <path :d="shaped.lower" fill="#152726" fill-opacity=".12" pointer-events="none" />
      <path :d="path" :fill="`url(#${sheenId})`" pointer-events="none" />
      <path :d="path" :fill="`url(#${textureId})`" pointer-events="none" />
      <path :d="shaped.ridge" fill="none" stroke="#fff4d2" stroke-opacity=".26" :stroke-width="Math.max(.035, pageLength / 2500)" pointer-events="none" />
      <path :d="shaped.upperEdge" fill="none" stroke="#fff2d6" stroke-opacity=".35" :stroke-width="Math.max(.04, pageLength / 2100)" pointer-events="none" />
      <path :d="shaped.lowerEdge" fill="none" stroke="#172827" stroke-opacity=".55" :stroke-width="Math.max(.05, pageLength / 1900)" pointer-events="none" />
      <rect v-if="hoveredCell !== null" :x="zones.find(zone => zone.cell === hoveredCell)?.left" :y="zones.find(zone => zone.cell === hoveredCell)?.side ? 0 : -extent" :width="zones.find(zone => zone.cell === hoveredCell)?.right - zones.find(zone => zone.cell === hoveredCell)?.left" :height="extent" :clip-path="`url(#${clipId})`" fill="#ffe8a4" fill-opacity=".38" pointer-events="none" />
      <g v-for="zone in zones" :key="zone.cell">
        <rect :x="zone.left" :y="zone.side ? 0 : -extent" :width="zone.right - zone.left" :height="extent" fill="transparent" role="button" tabindex="0" :aria-label="t('workshop.cell', { cell: zone.cell + 1, quality: zone.quality })" :aria-disabled="!working" @pointerenter="hoveredCell = zone.cell" @focus="hoveredCell = zone.cell" @blur="hoveredCell = null" @pointerdown.prevent="working && beginStrike($event, zone.cell)" @pointerup="endStrike" @pointercancel="emit('cancel')" @lostpointercapture="emit('cancel')" @keydown.space.prevent="working && emit('begin', $event, zone.cell)" @keyup.space.prevent="endStrike" />
        <text :x="zone.labelX" :y="zone.labelY" text-anchor="middle" dominant-baseline="middle" :font-size="Math.max(.75, Math.min(1.35, (zone.right - zone.left) / 5))" fill="#fff1ce" stroke="#26302b" stroke-width=".17" paint-order="stroke" pointer-events="none">{{ zone.quality }}%</text>
      </g>
    </svg>
    <img v-if="pointer || impact" ref="hammerSprite" class="hammer-cursor" :class="{ 'hammer-cursor--impact': impact, 'hammer-cursor--raised': striking && !returning, 'hammer-cursor--returning': returning }" :style="{ left: `${pointer?.x ?? 0}px`, top: `${pointer?.y ?? 0}px`, '--return-from': returnTransform, '--windup-angle': `${impact ? impactWindupAngle : 22 + Math.max(0, Math.min(1, power)) * 10}deg`, '--windup-x': `${impact ? impactWindupX : 24 + Math.max(0, Math.min(1, power)) * 18}px`, '--windup-y': `${impact ? impactWindupY : -(38 + Math.max(0, Math.min(1, power)) * 28)}px` }" src="/images/blacksmith-hammer.png" alt="" draggable="false" />
  </div>
</template>

<style scoped>
.hammer-blank{position:relative;flex:1;min-height:120px;margin:7px 0;background:radial-gradient(ellipse,#57594e,#303a35);border:1px solid #8d8b70;border-radius:8px;overflow:hidden}
.hammer-blank>svg:first-child{width:100%;height:100%;position:absolute;inset:0;filter:drop-shadow(0 4px 3px #101511aa)}
.hammer-blank svg rect{cursor:pointer;touch-action:none;outline:none;-webkit-tap-highlight-color:transparent}
.hammer-blank svg rect:focus-visible{outline:none}
.hammer-blank--working{cursor:none}
.hammer-blank--working svg rect{cursor:none}
.hammer-cursor{position:absolute;width:170px;height:170px;right:auto;bottom:auto;margin-left:-37px;margin-top:-138px;z-index:4;pointer-events:none;user-select:none;transform:rotate(0deg);transform-origin:85px 85px;filter:drop-shadow(0 5px 4px #141b18dd)}
.hammer-cursor--raised{transform:translate(var(--windup-x),var(--windup-y)) rotate(var(--windup-angle));transition:transform .12s ease-out}
.hammer-cursor--impact{animation:hammer-impact .78s forwards}
.hammer-cursor--returning{animation:hammer-return .3s cubic-bezier(.18,.8,.27,1) forwards}
@keyframes hammer-return{from{transform:var(--return-from)}to{transform:rotate(0deg)}}
@keyframes hammer-impact{0%{transform:translate(var(--windup-x),var(--windup-y)) rotate(var(--windup-angle))}16%{transform:translate(calc(var(--windup-x) + 4px),calc(var(--windup-y) - 10px)) rotate(calc(var(--windup-angle) + 3deg));animation-timing-function:cubic-bezier(.48,0,.92,.72)}60%{transform:translate(-15px,18px) rotate(-55deg);animation-timing-function:cubic-bezier(.17,.75,.28,1)}72%{transform:translate(8px,-22px) rotate(-18deg);animation-timing-function:ease-in-out}87%{transform:translate(-3px,3px) rotate(3deg)}95%{transform:translate(1px,-2px) rotate(-1deg)}100%{transform:rotate(0deg)}}
@media(prefers-reduced-motion:reduce){.hammer-cursor--impact{animation:none}}
</style>
