<script setup>
import { formatCurrency } from '../currency'
import { playSound } from '../audio'
import CurrencyAmount from './CurrencyAmount.vue'

import { computed, onBeforeUnmount, onMounted, nextTick, reactive, ref, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import WoodPiece from './WoodPiece.vue'
import CoinPouch from './CoinPouch.vue'

import { firstPiece, splitPiece, createWoodcuttingJob, strengthQuality, firewoodValue, chargeDuration } from '../woodcutting'

const props = defineProps({ showOpeningTutorial: { type: Boolean, default: false }, paused: { type: Boolean, default: false } })

const emit = defineEmits(['finish', 'completed'])

const { t } = useI18n()

const jobLogs = createWoodcuttingJob()

const stumpIndex = ref(0)

const pieces = ref([{ ...firstPiece(jobLogs[0]), onBlock: false }])

const selectedId = ref(null)

const rotation = ref(0)

const offset = ref(0)

const scores = ref([])
const qualityScores = ref([])

const roundCuts = ref(0)

const storedFirewood = ref([])

const finished = ref(false)
watch(finished, value => emit('completed', value))

const impact = ref(false)

const feedback = ref('')

const stageElement = ref(null)

const fallenPileElement = ref(null)
const pileElements = new Map()

const flights = ref([])
const loadingPiece = ref(null)
const striking = ref(false)
const cutContact = ref(false)
let swingTimer
let loadTimer
let dragOrigin = null

let fallTimer

const stump = computed(() => jobLogs[stumpIndex.value])

const selected = computed(() => pieces.value.find((piece) => piece.id === selectedId.value))

const firewood = ref(0)

const onBlock = computed(() => pieces.value.filter((piece) => piece.onBlock && !piece.falling))

const fallen = computed(() => pieces.value.filter((piece) => !piece.onBlock && !piece.falling))

const averageQuality = computed(() => qualityScores.value.length ? Math.round(qualityScores.value.reduce((sum, score) => sum + score, 0) / qualityScores.value.length) : null)

const earned = computed(() => Math.round(storedFirewood.value.reduce((sum, wood) => sum + wood.coins, 0)))
const hoveredWood = ref(null)
const canChop = computed(() => !!selected.value && onBlock.value.length === 1 && !loadingPiece.value && !impact.value && !striking.value)
const strength = ref(0)
const charging = ref(false)
let chargeStarted = 0
let chargeSeconds = 2
const totalCuts = jobLogs.reduce((sum, log) => sum + log.expectedPieces - 1, 0)
function startCharge(event) {
  if (props.paused) return
  if (!canChop.value || finished.value || charging.value || (event?.button !== undefined && event.button !== 0)) return
  event?.preventDefault()
  if (event?.pointerId !== undefined) event.currentTarget.setPointerCapture(event.pointerId)
  charging.value = true
  strength.value = 0
  chargeStarted = performance.now()
  chargeSeconds = chargeDuration(scores.value.length / totalCuts)
}
function releaseCharge() {
  if (!charging.value) return
  strength.value = Math.min(100, (performance.now() - chargeStarted) / (chargeSeconds * 1000) * 100)
  charging.value = false
  chop(strengthQuality(strength.value))
}
function cancelCharge() { if (!charging.value) return; charging.value = false; strength.value = 0 }

const totalExpected = jobLogs.reduce((sum, item) => sum + item.expectedPieces, 0)

const totalCut = computed(() => storedFirewood.value.length)

let frameId

let impactTimer

let lastFrame

const heldKeys = reactive(new Set())
const touchKeys = reactive(new Map())
const controlVisibility = ref(window.matchMedia?.('(pointer: coarse)').matches ? true : null)
const controlsShown = computed(() => controlVisibility.value ?? showControlHints.value)
const controlButtons = [
  { code: 'KeyQ', key: 'Q', x: 47, y: 27, path: 'M25 10 A21 21 0 0 0 -9 20 M-9 10 V20 H1', label: 'rotateLeft' },
  { code: 'KeyE', key: 'E', x: 253, y: 27, path: 'M-25 10 A21 21 0 0 1 9 20 M9 10 V20 H-1', label: 'rotateRight' },
  { code: 'KeyA', key: 'A', x: 23, y: 116, path: 'M14 0 H-10 M-2 -8 L-10 0 L-2 8', label: 'shiftLeft' },
  { code: 'KeyD', key: 'D', x: 277, y: 116, path: 'M-14 0 H10 M2 -8 L10 0 L2 8', label: 'shiftRight' },
]
const keyHeld = code => heldKeys.has(code) || [...touchKeys.values()].includes(code)
function pressControl(event, code) {
  if (event.button !== 0 || finished.value) return
  event.preventDefault()
  event.currentTarget.setPointerCapture(event.pointerId)
  touchKeys.set(event.pointerId, code)
  clearTimeout(hintTimer)
}
function releaseControl(event) {
  touchKeys.delete(event.pointerId)
  scheduleHints()
}
function toggleControls() {
  controlVisibility.value = !controlsShown.value
  touchKeys.clear()
}

const showControlHints = ref(props.showOpeningTutorial)

let hintTimer

let hasPressedKey = false

function scheduleHints() {

  clearTimeout(hintTimer)

  if (heldKeys.size || touchKeys.size || finished.value) return

  hintTimer = setTimeout(() => { showControlHints.value = true }, hasPressedKey ? 5000 : 3000)

}

const draggedId = ref(null)

const dropTarget = ref(false)

const remainingLogs = computed(() => jobLogs.slice(stumpIndex.value + (pieces.value.some(piece => piece.depth === 0 && !piece.onBlock) ? 0 : 1)))

function startDrag(event, piece) {

  if (impact.value || !piece || piece.piecesNeeded < 2) { event.preventDefault(); return }

  dragOrigin = event.currentTarget.getBoundingClientRect()
  draggedId.value = piece.id

  event.dataTransfer.effectAllowed = 'move'

  event.dataTransfer.setData('text/plain', piece.id)

}

function endDrag() { draggedId.value = null; dropTarget.value = false }

function dropPiece(event) {

  const piece = pieces.value.find(piece => piece.id === draggedId.value)

  if (piece) choose(piece, null, dragOrigin)

  endDrag()

}

const nextAction = computed(() => {
  if (finished.value || impact.value || striking.value || loadingPiece.value || charging.value
    || draggedId.value || flights.value.length) return null
  if (onBlock.value.length > 1) return { type: 'aside' }
  if (selected.value) return { type: 'axe' }
  const blockPiece = onBlock.value.find(piece => piece.piecesNeeded === 1) || onBlock.value[0]
  if (blockPiece) return { type: 'block', id: blockPiece.id }
  const fallenPiece = fallenToCut.value[0]
  return fallenPiece ? { type: 'pile', id: fallenPiece.id } : { type: 'log' }
})
const fallenToCut = computed(() => pieces.value.filter(piece => !piece.onBlock && piece.depth > 0))

function resetMotion() {

  rotation.value = Math.random() * 150 - 75

  offset.value = Math.random() * 70 - 35

}

function handleKey(event) {
  if (props.paused) return

  hasPressedKey = true

  showControlHints.value = false

  clearTimeout(hintTimer)

  scheduleHints()

  if (!['KeyQ', 'KeyE', 'KeyA', 'KeyD'].includes(event.code) || event.ctrlKey || event.metaKey || event.altKey || event.target?.closest('input, textarea, select, [contenteditable="true"]')) return

  event.preventDefault()

  heldKeys.add(event.code)

  clearTimeout(hintTimer)

}

function releaseKey(event) { heldKeys.delete(event.code); scheduleHints() }

watch(() => props.paused, paused => { if (paused) clearKeys() })
function clearKeys() { heldKeys.clear(); touchKeys.clear(); cancelCharge(); scheduleHints() }

function animate(now) {
  if (props.paused) { lastFrame = now; frameId = requestAnimationFrame(animate); return }
  if (charging.value) strength.value = Math.min(100, (now - chargeStarted) / (chargeSeconds * 1000) * 100)

  if (lastFrame !== undefined && selected.value && !impact.value && !charging.value && !loadingPiece.value && !finished.value) {

    const dt = Math.min((now - lastFrame) / 1000, 0.05)

    rotation.value = (rotation.value + (Number(keyHeld('KeyE')) - Number(keyHeld('KeyQ'))) * 100 * dt) % 360

    offset.value = Math.max(-45, Math.min(45, offset.value + (Number(keyHeld('KeyD')) - Number(keyHeld('KeyA'))) * 55 * dt))

  }

  lastFrame = now

  frameId = requestAnimationFrame(animate)

}

onMounted(() => {

  scheduleHints()

  window.addEventListener('keydown', handleKey)

  window.addEventListener('keyup', releaseKey)

  window.addEventListener('blur', clearKeys)

  frameId = requestAnimationFrame(animate)

})

onBeforeUnmount(() => {

  cancelAnimationFrame(frameId)

  clearTimeout(impactTimer)

  clearTimeout(fallTimer)
  clearTimeout(loadTimer)
  clearTimeout(swingTimer)

  clearTimeout(hintTimer)

  window.removeEventListener('keydown', handleKey)

  window.removeEventListener('keyup', releaseKey)

  window.removeEventListener('blur', clearKeys)

})

function choose(piece, event, origin = null) {
  if (!piece || impact.value || charging.value || loadingPiece.value || piece.piecesNeeded < 2) return
  playSound('logMove')
  const wasOnBlock = piece.onBlock
  const source = origin || event?.currentTarget?.getBoundingClientRect() || fallenPileElement.value?.getBoundingClientRect()
  piece.onBlock = true
  selectedId.value = piece.id
  feedback.value = ''
  resetMotion()
  const matrix = stageElement.value?.getScreenCTM()
  if (!wasOnBlock && source && matrix) {
    const target = new DOMPoint(150 + offset.value, 112).matrixTransform(matrix)
    loadingPiece.value = { ...piece, startX: source.left, startY: source.top,
      endX: target.x - 30 - source.left, endY: target.y - 30 - source.top,
      scale: 130 * matrix.a / 60, rotation: rotation.value, startRotation: piece.depth === 0 ? -8 : 0 }
    loadTimer = setTimeout(() => { loadingPiece.value = null }, 320)
  }
}
async function setOtherPiecesAside() {
  if (impact.value || charging.value || loadingPiece.value) return
  const others = onBlock.value.filter(piece => piece.id !== selectedId.value)
  if (!others.length) return
  playSound('logMove')
  const matrix = stageElement.value?.getScreenCTM()
  impact.value = true
  others.forEach(piece => { piece.onBlock = false; piece.falling = true })
  // Hidden destination pieces reserve their final positions before we measure them.
  await nextTick()
  if (!stageElement.value) return
  others.forEach(piece => {
    const targetMatrix = pileElements.get(piece.id)?.querySelector('svg')?.getScreenCTM()
    if (!matrix || !targetMatrix) return
    const start = new DOMPoint(piece.x || 150, piece.y || 112).matrixTransform(matrix)
    const target = new DOMPoint(50, 50).matrixTransform(targetMatrix)
    flights.value.push({ ...piece, settingAside: true,
      startX: start.x - 30, startY: start.y - 30,
      endX: target.x - start.x, endY: target.y - start.y,
      startScale: 76 * matrix.a / 60, endScale: 100 * targetMatrix.a / 60 })
  })
  fallTimer = setTimeout(() => {
    playSound('logMove', { scale: .6 })
    others.forEach(piece => { piece.falling = false })
    flights.value = []
    impact.value = false
  }, 340)
}

function chop(quality) {

  const piece = selected.value

  if (!canChop.value || !piece || finished.value || roundCuts.value >= stump.value.expectedPieces - 1) return
  playSound('axeSwing')

  const struckRotation = rotation.value

  const struckOffset = offset.value

  impact.value = true
  striking.value = true
  cutContact.value = false
  swingTimer = setTimeout(() => {
    striking.value = false
    cutContact.value = false
  }, 380)

  clearTimeout(impactTimer)

  impactTimer = setTimeout(() => {
    cutContact.value = true
    playSound('axeHit')

    const { children, score } = splitPiece(piece, struckRotation, struckOffset)

    children.forEach((child, index) => {

      child.precision = ((piece.precision || 0) * piece.depth + score) / (piece.depth + 1)
      child.quality = ((piece.quality || 0) * piece.depth + quality) / (piece.depth + 1)

      child.x = Math.max(55, Math.min(245, 150 + struckOffset + (index ? 45 : -45)))

      child.y = 108 + (index ? 18 : -18)

      child.turn = struckRotation + (index ? 18 : -18)

    })

    const matrix = stageElement.value?.getScreenCTM()

    const pile = fallenPileElement.value?.getBoundingClientRect()

    children.forEach((child, index) => {

      if (child.onBlock || !matrix || !pile) return

      child.falling = true

      const start = new DOMPoint(150 + struckOffset, 112).matrixTransform(matrix)

      flights.value.push({ ...child, startX: start.x - 30, startY: start.y - 30,

        endX: pile.left + 4 + index * 12 - start.x + 30,

        endY: pile.top + 4 - start.y + 30 })

    })

    pieces.value = [...pieces.value.filter((item) => item.id !== piece.id), ...children]

    scores.value.push(score)
    qualityScores.value.push(firewoodValue(score, quality).combined)

    roundCuts.value += 1

    feedback.value = t('woodcut.cutResults', { precision: score, strength: quality, total: Math.round(firewoodValue(score, quality).combined) })

    selectedId.value = null

    if (flights.value.length) {

      fallTimer = setTimeout(() => {
        playSound('logMove', { scale: .7 })

        pieces.value.forEach(item => { item.falling = false })

        flights.value = []

        impact.value = false

      }, 440)

    } else impact.value = false

  }, 235)

}

function activatePiece(piece, event) {

  if (impact.value) return

  if (piece.piecesNeeded > 1) { choose(piece, event); return }
  playSound('logStack')

  pieces.value = pieces.value.filter(item => item.id !== piece.id)

  storedFirewood.value.push({ id: piece.id, precision: Math.round(piece.precision ?? 0), quality: Math.round(piece.quality ?? 0), ...firewoodValue(Math.round(piece.precision ?? 0), Math.round(piece.quality ?? 0)) })

  firewood.value += 1

  if (!pieces.value.length) {

    if (stumpIndex.value === jobLogs.length - 1) finished.value = true

    else {

      firewood.value = 0

      stumpIndex.value += 1

      roundCuts.value = 0

      pieces.value = [{ ...firstPiece(stump.value), onBlock: false }]

    }

  }

}

function woodColor(quality, surface) {

  const palettes = {

    face: [[65, 47, 34], [175, 133, 86]],

    side: [[50, 37, 28], [139, 101, 63]],

    bark: [[36, 30, 24], [91, 67, 44]],

    grain: [[30, 24, 19], [112, 78, 47]],

  }

  const [dark, natural] = palettes[surface]

  const amount = Math.max(0, Math.min(100, quality)) / 100

  return `rgb(${dark.map((value, index) => Math.round(value + (natural[index] - value) * amount)).join(',')})`

}

function finish() {

  if (!finished.value) return

  emit('finish', { coins: earned.value, minutes: 90, pieces: totalExpected, average: averageQuality.value ?? 0 })

}

</script>

<template>

  <div class="woodcut-game">

    <div class="woodcut-topline">

      <strong>{{ t('woodcut.round', { current: stumpIndex + 1, total: jobLogs.length, wood: t(stump.nameKey) }) }}</strong>

      <span>{{ t('woodcut.pay', { coins: formatCurrency(earned, t) }) }}</span>

    </div>

    <div class="woodcut-stats">

      <span>{{ t('woodcut.averageQuality', { quality: averageQuality === null ? '—' : `${averageQuality}%` }) }}</span>

      <span>{{ t('woodcut.yield', { current: firewood, expected: stump.expectedPieces }) }}</span>

      <span>{{ t('woodcut.cuts', { current: roundCuts, limit: stump.expectedPieces - 1 }) }}</span>

    </div>

    <Teleport to="#game-animation-layer">
      <div v-if="loadingPiece" class="woodcut-loading-flight" :style="{ left: `${loadingPiece.startX}px`, top: `${loadingPiece.startY}px`, '--load-x': `${loadingPiece.endX}px`, '--load-y': `${loadingPiece.endY}px`, '--load-scale': loadingPiece.scale, '--load-rotation': `${loadingPiece.rotation}deg`, '--load-start-rotation': `${loadingPiece.startRotation}deg` }" aria-hidden="true">
        <WoodPiece :depth="loadingPiece.depth" :fraction="loadingPiece.fraction" :marked="loadingPiece.marked" :branch-marks="loadingPiece.branchMarks || []" :angle="loadingPiece.angle" :cut-offset="loadingPiece.cutOffset || 0" />
      </div>

      <div v-for="flight in flights" :key="flight.id" class="woodcut-falling-flight" :class="{ 'woodcut-falling-flight--aside': flight.settingAside }" :style="{ left: `${flight.startX}px`, top: `${flight.startY}px`, '--fall-x': `${flight.endX}px`, '--fall-y': `${flight.endY}px`, '--fall-turn': `${flight.turn - 100}deg`, '--aside-angle': `${flight.turn || 0}deg`, '--aside-scale': flight.startScale || 1, '--aside-end-scale': flight.endScale || .65 }" aria-hidden="true">

        <WoodPiece :depth="flight.depth" :fraction="flight.fraction" :marked="flight.marked" :branch-marks="flight.branchMarks || []" :angle="flight.angle" :cut-offset="flight.cutOffset || 0" :ready="flight.piecesNeeded === 1" />

      </div>

    </Teleport>

    <div class="woodcut-workspace">

    <aside class="woodcut-stock">

      <small>{{ t('woodcut.remaining') }}</small>

      <div class="woodcut-log-pile">

        <button v-for="log in remainingLogs" :key="log.id" class="woodcut-stock-log" :class="{ 'woodcut-next-action': nextAction?.type === 'log' && log.id === stump.id }" type="button" :disabled="impact || log.id !== stump.id" :draggable="log.id === stump.id && !impact" :aria-label="t('woodcut.loadLog', { wood: t(log.nameKey) })" @dragstart="startDrag($event, pieces.find(piece => piece.id === log.id))" @dragend="endDrag" @click.stop="choose(pieces.find(piece => piece.id === log.id), $event)"><WoodPiece :marked="log.marked !== false" :branch-marks="log.branchMarks || []" :angle="log.initialAngle" :cut-offset="log.cutOffset || 0" /></button>

        <em v-if="!remainingLogs.length">{{ t('woodcut.none') }}</em>

      </div>

      <small>{{ t('woodcut.fallen') }}</small>

      <div ref="fallenPileElement" class="woodcut-fallen-pile">

        <button v-for="piece in fallenToCut" :key="piece.id" class="woodcut-half" :class="{ 'woodcut-pile-placeholder': piece.falling, 'woodcut-next-action': nextAction?.type === 'pile' && nextAction.id === piece.id }" :ref="element => element ? pileElements.set(piece.id, element) : pileElements.delete(piece.id)" type="button" :disabled="impact" :draggable="!impact" @dragstart="startDrag($event, piece)" @dragend="endDrag" :aria-label="piece.piecesNeeded === 1 ? t('woodcut.collectPiece') : t('woodcut.piece', { count: piece.piecesNeeded })" @click.stop="activatePiece(piece, $event)"><WoodPiece :depth="piece.depth" :fraction="piece.fraction" :marked="piece.marked" :branch-marks="piece.branchMarks || []" :angle="piece.angle" :cut-offset="piece.cutOffset || 0" :ready="piece.piecesNeeded === 1" /></button>

        <em v-if="!fallenToCut.length">{{ t('woodcut.none') }}</em>

      </div>

    </aside>

    <div class="woodcut-arena" :class="{ 'woodcut-arena--drop': dropTarget }" @dragover.prevent="dropTarget = !!draggedId" @dragleave="dropTarget = false" @drop.prevent.stop="dropPiece">

    <button v-if="!finished" type="button" class="woodcut-controls-toggle" :aria-pressed="!!controlsShown" :aria-label="t(controlsShown ? 'woodcut.hideControls' : 'woodcut.showControls')" :title="t(controlsShown ? 'woodcut.hideControls' : 'woodcut.showControls')" @click.stop="toggleControls">✥</button>
    <svg ref="stageElement" class="woodcut-stage" :class="{ 'woodcut-stage--impact': cutContact }" viewBox="0 0 300 210" role="group" :aria-label="t('woodcut.illustration')">

      <ellipse class="woodcut-block" cx="150" cy="112" rx="102" ry="87" />

      <ellipse class="woodcut-block-ring" cx="150" cy="112" rx="80" ry="67" />

      <g v-for="piece in onBlock.filter(item => item.id !== selectedId)" :key="piece.id" class="woodcut-resting-piece" role="button" tabindex="0" :aria-label="piece.piecesNeeded === 1 ? t('woodcut.collectPiece') : t('woodcut.piece', { count: piece.piecesNeeded })" :transform="`translate(${piece.x || 150} ${piece.y || 112})`" @click.stop="activatePiece(piece, $event)" @keydown.enter.prevent="activatePiece(piece)" @keydown.space.prevent="activatePiece(piece)">

        <g class="woodcut-separated-piece" :style="{ '--split-x': `${150 - piece.x}px`, '--split-y': `${112 - piece.y}px` }">

          <circle r="35" fill="transparent" />

          <WoodPiece :depth="piece.depth" :fraction="piece.fraction" :marked="piece.marked" :branch-marks="piece.branchMarks || []" :angle="piece.angle" :cut-offset="piece.cutOffset || 0" :ready="piece.piecesNeeded === 1" x="-38" y="-38" width="76" height="76" :style="{ transform: `rotate(${piece.turn || 0}deg)` }" />

        </g>

      </g>

      <g v-if="selected && !loadingPiece" class="woodcut-moving-log" :transform="`translate(${offset} 0) rotate(${rotation} 150 112)`">

        <WoodPiece :depth="selected.depth" :fraction="selected.fraction" :marked="selected.marked" :branch-marks="selected.branchMarks || []" :angle="selected.angle" :cut-offset="selected.cutOffset || 0" x="85" y="47" width="130" height="130" />


      </g>

      <g v-if="controlsShown && !finished" class="woodcut-control-hints" role="group" :aria-label="t('woodcut.controlsLabel')">
        <g v-for="control in controlButtons" :key="control.code" class="woodcut-control-button" :class="{ 'woodcut-control-button--active': keyHeld(control.code) }" :transform="`translate(${control.x} ${control.y})`" role="button" tabindex="0" :aria-label="t('woodcut.' + control.label)" :aria-pressed="keyHeld(control.code)" @pointerdown.stop="pressControl($event, control.code)" @pointerup.stop="releaseControl" @pointercancel="releaseControl" @lostpointercapture="releaseControl" @keydown.space.prevent="heldKeys.add(control.code)" @keyup.space.prevent="heldKeys.delete(control.code)" @keydown.enter.prevent="heldKeys.add(control.code)" @keyup.enter.prevent="heldKeys.delete(control.code)" @blur="heldKeys.delete(control.code)" @click.stop>
          <circle cx="0" cy="0" r="23" class="woodcut-control-hit" />
          <path :d="control.path" />
          <text x="0" :y="control.key === 'Q' || control.key === 'E' ? 0 : -17">{{ control.key }}</text>
        </g>
      </g>

      <path class="woodcut-axe" d="M150 18 V194" />

      <g v-if="selected || striking" class="woodcut-axe-tool" :class="{ 'woodcut-axe-tool--strike': striking }" :style="{ '--axe-x': `${14 + strength * .06}px`, '--axe-lift': `${-4 - strength * .06}px`, '--axe-angle': `${18 + strength * .47}deg`, transform: striking ? undefined : `translate(${14 + strength * .06}px, ${-4 - strength * .06}px) rotate(${18 + strength * .47}deg)` }" aria-hidden="true">
        <path d="M222 169 L174 101" stroke="#34251a" stroke-width="10" stroke-linecap="round" />
        <path d="M222 169 L174 101" stroke="#a77c48" stroke-width="6" stroke-linecap="round" />
        <path d="M145 101 Q154 96 164 96 L172 97 L182 91 L190 103 L180 110 L174 110 Q169 114 160 122 Q147 121 145 101 Z" fill="#89958f" stroke="#303b35" stroke-width="2" stroke-linejoin="round" />
        <path d="M145 101 Q149 101 152 104 Q153 113 163 118 L160 122 Q147 121 145 101 Z" fill="#d0d6ce" />
        <path d="M145 101 Q147 121 160 122" fill="none" stroke="#eef0e4" stroke-width="2" stroke-linecap="round" />
        <path d="M173 98 L180 107" stroke="#56615a" stroke-width="4" stroke-linecap="round" />
        <path d="M183 94 L188 102" stroke="#b6beb5" stroke-width="2" stroke-linecap="round" />
      </g>

      <g v-if="cutContact" class="woodcut-impact-splinters" aria-hidden="true">

        <path d="M145 101 l-22 -16 M155 103 l23 -21 M144 119 l-25 17 M155 123 l27 16" />

        <circle cx="150" cy="111" r="9" />

      </g>

      <g aria-hidden="true" pointer-events="none">
        <template v-for="piece in onBlock" :key="piece.id">
          <g v-if="nextAction?.type === 'block' && nextAction.id === piece.id" :transform="`translate(${piece.x || 150} ${piece.y || 112})`">
            <g class="woodcut-piece-arrow"><path d="M-47 -48 L-23 -25 M-33 -25 H-23 V-35" /></g>
          </g>
        </template>
      </g>
    </svg>

    <div v-if="!finished" class="woodcut-strength-control">
      <div class="woodcut-clear-space" :class="{ 'woodcut-clear-space--hidden': onBlock.length <= 1 }">
        <span aria-hidden="true"></span>
        <button type="button" class="modal-secondary" :class="{ 'woodcut-next-action': nextAction?.type === 'aside' }" :disabled="impact || charging || !!loadingPiece" @click.stop="setOtherPiecesAside">{{ t(selected ? 'woodcut.setAside' : 'woodcut.setOutside') }}</button>
      </div>
      <div class="woodcut-strength-meter" role="progressbar" :aria-label="t('woodcut.strength')" :aria-valuenow="Math.round(strength)" aria-valuemin="0" aria-valuemax="100"><div :style="{ width: `${strength}%` }"></div><i></i></div>
      <button class="modal-primary woodcut-chop" :class="{ 'woodcut-next-action': nextAction?.type === 'axe' }" type="button" :disabled="!canChop" @pointerdown.stop="startCharge" @pointerup.stop="releaseCharge" @pointercancel="cancelCharge" @lostpointercapture="cancelCharge" @keydown.space.prevent="!$event.repeat && startCharge()" @keyup.space.prevent="releaseCharge" @keydown.enter.prevent="!$event.repeat && startCharge()" @keyup.enter.prevent="releaseCharge" @blur="cancelCharge" @click.stop>{{ t(charging ? 'woodcut.releaseAxe' : 'woodcut.holdAxe') }}</button>
    </div>
    </div>

    <aside class="woodcut-output">

      <small>{{ t('woodcut.cutFirewood') }}</small>

      <svg class="woodcut-stored-stack" viewBox="0 0 100 190" role="img" :aria-label="t('woodcut.totalYield', { current: totalCut, total: totalExpected })">

        <ellipse cx="50" cy="177" rx="46" ry="6" fill="#17291f" opacity=".65" />

        <path d="M5 177 H95 M9 177 V168 M91 177 V168" fill="none" stroke="#6c6146" stroke-width="4" />

        <g v-for="(wood, index) in storedFirewood" :key="wood.id" :transform="`translate(${8 + (index % 3) * 27 + (Math.floor(index / 3) % 2 ? 4 : 0)} ${173 - Math.floor(index / 3) * 23})`">

          <g class="woodcut-stored-piece" :class="{ 'woodcut-stored-piece--hovered': hoveredWood?.id === wood.id }" tabindex="0" role="img" :aria-label="t('woodcut.pieceDetails', { precision: wood.precision, quality: wood.quality, total: Math.round(wood.combined), coins: formatCurrency(wood.coins, t) })" @mouseenter="hoveredWood = wood" @mouseleave="hoveredWood = null" @focus="hoveredWood = wood" @blur="hoveredWood = null">

            <title>{{ t('woodcut.pieceDetails', { precision: wood.precision, quality: wood.quality, total: Math.round(wood.combined), coins: formatCurrency(wood.coins, t) }) }}</title>

            <path d="M0 -2 L3 -18 L15 -24 L26 -18 L24 -3 Z" :fill="woodColor(wood.combined, 'bark')" stroke="#30281d" stroke-width="1.5" />

            <path d="M0 -2 L3 -18 L15 -24 L17 -8 L12 0 Z" :fill="woodColor(wood.combined, 'side')" />

            <path d="M0 -2 L5 -15 L17 -18 L24 -12 L24 -3 L12 1 Z" :fill="woodColor(wood.combined, 'face')" :stroke="woodColor(wood.combined, 'grain')" stroke-width="1.3" />

            <path d="M5 -4 Q7 -12 15 -12 Q20 -12 20 -5 M10 -4 Q11 -8 16 -7 M4 -14 L7 -11" fill="none" :stroke="woodColor(wood.combined, 'grain')" stroke-width="1.2" opacity=".7" />

          </g>

        </g>

      </svg>

      <small>{{ totalCut }}/{{ totalExpected }}</small>
      <div v-if="hoveredWood" class="woodcut-quality-tooltip" role="tooltip">
        <strong>{{ t('woodcut.precisionValue', { value: hoveredWood.precision }) }}</strong>
        <span>{{ t('woodcut.qualityValue', { value: hoveredWood.quality }) }}</span>
        <span>{{ t('woodcut.totalQualityValue', { value: Math.round(hoveredWood.combined) }) }}</span>
        <span>{{ t('woodcut.piecePrice', { coins: formatCurrency(hoveredWood.coins, t) }) }}</span>
      </div>

    </aside>

    </div>

    <span class="woodcut-prompt" aria-hidden="true"></span>

    <p class="woodcut-feedback" role="status">{{ feedback || '\u00a0' }}</p>

    <div v-if="finished" class="woodcut-summary" role="region" :aria-label="t('woodcut.rewardTitle')">
      <div class="woodcut-reward-card">
        <span class="woodcut-reward-kicker">{{ t('woodcut.rewardTitle') }}</span>
        <div class="woodcut-reward-coins" aria-hidden="true"><i></i><i></i><i></i></div>
        <strong class="woodcut-reward-amount">+<CurrencyAmount :amount="earned" /></strong>
        <span class="woodcut-reward-label">{{ t('woodcut.goldEarned') }}</span>
        <p>{{ t('woodcut.rewardDetails', { pieces: totalExpected, quality: averageQuality ?? 0 }) }}</p>
        <button class="woodcut-collect-gold" type="button" @click.stop="finish" :aria-label="t('woodcut.collectGold', { coins: formatCurrency(earned, t) })">
          <CoinPouch />
          <span>{{ t('woodcut.collect') }}</span>
        </button>
      </div>
    </div>

  </div>

</template>
