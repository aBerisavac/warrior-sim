<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { firstPiece, splitPiece, WOOD_STUMPS, woodcutPay } from '../woodcutting'

const emit = defineEmits(['finish'])
const { t } = useI18n()
const stumpIndex = ref(0)
const pieces = ref([firstPiece(WOOD_STUMPS[0])])
const selectedId = ref(WOOD_STUMPS[0].id)
const rotation = ref(0)
const offset = ref(0)
const scores = ref([])
const roundCuts = ref(0)
const stackedPieces = ref(0)
const finished = ref(false)
const impact = ref(false)
const feedback = ref('')
const stump = computed(() => WOOD_STUMPS[stumpIndex.value])
const selected = computed(() => pieces.value.find((piece) => piece.id === selectedId.value))
const firewood = computed(() => pieces.value.filter((piece) => piece.piecesNeeded === 1).length)
const onBlock = computed(() => pieces.value.filter((piece) => piece.onBlock))
const fallen = computed(() => pieces.value.filter((piece) => !piece.onBlock))
const earned = computed(() => woodcutPay(scores.value))
const totalExpected = WOOD_STUMPS.reduce((sum, item) => sum + item.expectedPieces, 0)
const totalCut = computed(() => stackedPieces.value + firewood.value)
let frameId
let impactTimer
let lastFrame
let motionTime = 0
let rotatePhase = -0.7
let shiftPhase = 0.9

function resetMotion() {
  rotatePhase = Math.random() * Math.PI * 2
  shiftPhase = Math.random() * Math.PI * 2
  rotation.value = Math.sin(rotatePhase) * 78
  offset.value = Math.sin(shiftPhase) * 32
}
function animate(now) {
  if (lastFrame !== undefined && selected.value && !impact.value && !finished.value) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05)
    motionTime += dt
    const rotateSpeed = 2.4 + 0.65 * Math.sin(motionTime * 1.17) + 0.28 * Math.sin(motionTime * 2.71 + 1.2)
    const shiftSpeed = 3.0 + 0.75 * Math.sin(motionTime * 0.83 + 2) + 0.32 * Math.sin(motionTime * 2.29)
    rotatePhase += dt * rotateSpeed
    shiftPhase += dt * shiftSpeed
    rotation.value = Math.sin(rotatePhase) * 78
    offset.value = Math.sin(shiftPhase) * 32
  }
  lastFrame = now
  frameId = requestAnimationFrame(animate)
}
onMounted(() => { frameId = requestAnimationFrame(animate) })
onBeforeUnmount(() => { cancelAnimationFrame(frameId); clearTimeout(impactTimer) })

function choose(piece) {
  if (impact.value || piece.piecesNeeded < 2) return
  piece.onBlock = true
  selectedId.value = piece.id
  feedback.value = ''
  resetMotion()
}
function chop() {
  const piece = selected.value
  if (!piece || finished.value || impact.value || roundCuts.value >= stump.value.expectedPieces - 1) return
  const struckRotation = rotation.value
  const struckOffset = offset.value
  impact.value = true
  clearTimeout(impactTimer)
  impactTimer = setTimeout(() => {
    const { children, score, landings } = splitPiece(piece, struckRotation, struckOffset)
    pieces.value = [...pieces.value.filter((item) => item.id !== piece.id), ...children]
    scores.value.push(score)
    roundCuts.value += 1
    feedback.value = t(score >= 80 ? 'woodcut.excellent' : score >= 50 ? 'woodcut.fair' : 'woodcut.rough', { score }) + ' ' + t('woodcut.landing.' + landings)
    selectedId.value = null
    if (pieces.value.every((item) => item.piecesNeeded === 1)) {
      if (stumpIndex.value === WOOD_STUMPS.length - 1) finished.value = true
      else {
        stackedPieces.value += stump.value.expectedPieces
        stumpIndex.value += 1
        pieces.value = [firstPiece(WOOD_STUMPS[stumpIndex.value])]
        selectedId.value = WOOD_STUMPS[stumpIndex.value].id
        roundCuts.value = 0
        resetMotion()
      }
    }
    impact.value = false
  }, 190)
}
function finish() {
  if (!finished.value) return
  emit('finish', { coins: earned.value, minutes: 90, pieces: totalExpected, average: Math.round(scores.value.reduce((sum, score) => sum + score, 0) / scores.value.length) })
}
</script>

<template>
  <div class="woodcut-game">
    <div class="woodcut-topline">
      <strong>{{ t('woodcut.round', { current: stumpIndex + 1, total: WOOD_STUMPS.length, wood: t(stump.nameKey) }) }}</strong>
      <span>{{ t('woodcut.pay', { coins: earned }) }}</span>
    </div>
    <div class="woodcut-stats">
      <span>{{ t('woodcut.yield', { current: firewood, expected: stump.expectedPieces }) }}</span>
      <span>{{ t('woodcut.cuts', { current: roundCuts, limit: stump.expectedPieces - 1 }) }}</span>
    </div>
    <div class="woodcut-arena">
    <svg class="woodcut-stage" :class="{ 'woodcut-stage--impact': impact }" viewBox="0 0 300 210" role="img" :aria-label="t('woodcut.illustration')">
      <ellipse class="woodcut-block" cx="150" cy="112" rx="102" ry="87" />
      <ellipse class="woodcut-block-ring" cx="150" cy="112" rx="80" ry="67" />
      <g v-if="selected" class="woodcut-moving-log" :transform="`translate(${offset} 0) rotate(${rotation} 150 112)`">
        <circle class="woodcut-log" cx="150" cy="112" :r="selected.depth ? 51 : 65" />
        <circle class="woodcut-grain" cx="150" cy="112" :r="selected.depth ? 36 : 47" />
        <path v-if="selected.marked" class="woodcut-mark" d="M150 68 L148 82 L151 99 L149 115 L152 131 L150 155" :transform="`rotate(${selected.angle} 150 112)`" />
      </g>
      <path class="woodcut-axe" d="M150 18 V194" />
      <path class="woodcut-axe-head" d="M138 21 H162 L157 39 H143 Z" />
      <g v-if="impact" class="woodcut-impact-splinters" aria-hidden="true">
        <path d="M145 101 l-22 -16 M155 103 l23 -21 M144 119 l-25 17 M155 123 l27 16" />
        <circle cx="150" cy="111" r="9" />
      </g>
    </svg>
    <button v-if="!finished" class="modal-primary woodcut-chop" type="button" :disabled="!selected || impact || roundCuts >= stump.expectedPieces - 1" @click.stop="chop">{{ t('woodcut.chop') }}</button>
    </div>
    <div class="woodcut-stack" role="img" :aria-label="t('woodcut.totalYield', { current: totalCut, total: totalExpected })">
      <span v-for="n in totalExpected" :key="n" :class="{ filled: n <= totalCut }" aria-hidden="true"></span>
    </div>
    <p v-if="!selected && !finished" class="woodcut-prompt">{{ t('woodcut.choosePiece') }}</p>
    <p v-if="feedback" class="woodcut-feedback" role="status">{{ feedback }}</p>
    <template v-if="!finished">
      <div class="woodcut-pieces">
        <div v-for="group in [{ label: 'woodcut.onBlock', items: onBlock }, { label: 'woodcut.fallen', items: fallen }]" :key="group.label">
          <small>{{ t(group.label) }}</small>
          <div class="woodcut-piece-list">
            <template v-for="piece in group.items" :key="piece.id">
              <button v-if="piece.piecesNeeded > 1" type="button" :disabled="impact" :class="{ selected: selectedId === piece.id }" @click.stop="choose(piece)">
                {{ t('woodcut.piece', { count: piece.piecesNeeded }) }} <span>{{ piece.marked ? '╱' : '○' }}</span>
              </button>
              <span v-else class="woodcut-ready-piece">{{ t('woodcut.ready') }}</span>
            </template>
            <em v-if="!group.items.length">{{ t('woodcut.none') }}</em>
          </div>
        </div>
      </div>
      <p class="woodcut-motion-hint">{{ t('woodcut.timingHint') }}</p>
    </template>
    <div v-else class="woodcut-summary">
      <strong>{{ t('woodcut.finished', { pieces: totalExpected, coins: earned }) }}</strong>
      <button class="modal-primary" type="button" @click.stop="finish">{{ t('woodcut.collect') }}</button>
    </div>
  </div>
</template>
