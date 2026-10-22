<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { designPaths, METALS } from '../weapon-design'
import { itemQuantity, items } from '../inventory'
import { ASSEMBLY_TRAVEL_PX, ASSEMBLY_START_OFFSET_PX, DAGGER_FITTINGS } from '../workshop'
const props = defineProps({ blade: Object, inventory: Array, storehouse: { type: Array, default: () => [] }, paused: Boolean })
const emit = defineEmits(['command', 'busy'])
const { t } = useI18n()
const scene = ref(null), phase = ref('aiming'), droppedPart = ref(0), landing = ref(.5)
const offset = ref(0), inside = ref(false), artWidth = ref(300), captureState = ref('idle')
const dropError = ref(false)
const position = computed(() => .5 + offset.value / artWidth.value)
const fittings = computed(() => props.blade.design ? [props.blade.design.guard, props.blade.design.handle, props.blade.design.pommel] : DAGGER_FITTINGS)
const part = computed(() => fittings.value[props.blade.parts])
const canAim = computed(() => !props.paused && phase.value === 'aiming' && props.blade.stage === 'quenched' && props.blade.parts < 3)
const ready = computed(() => canAim.value && itemQuantity([...props.inventory, ...props.storehouse], part.value) > 0)
const contactHeight = index => [156, 125, 94][index] ?? 94
const successKey = index => ['workshop.guardSuccess', 'workshop.handleSuccess', 'workshop.pommelSuccess'][index]
const visiblePart = computed(() => phase.value === 'aiming' ? props.blade.parts : droppedPart.value)
let fetchTimer, impactTimer, settleTimer, resizeObserver, dragId = null, nativeTouchId = null, lastX = 0, mounted = false, inputKind = 'mouse', lastMotion = null
const locked = () => !!scene.value && typeof document !== 'undefined' && document.pointerLockElement === scene.value
function measure() {
  if (!scene.value) return
  const r = scene.value.getBoundingClientRect()
  artWidth.value = Math.max(1, Math.min(r.width, r.height * 300 / 250))
}
function contains(event) {
  if (!scene.value) return false
  const r = scene.value.getBoundingClientRect()
  return event.clientX >= r.left && event.clientX <= r.left + r.width && event.clientY >= r.top && event.clientY <= r.top + r.height
}
function resetAim() { offset.value = (Math.random() * 2 - 1) * ASSEMBLY_START_OFFSET_PX }
resetAim()
function captureFailed() { if (mounted && !locked()) captureState.value = 'blocked' }
function requestCapture() {
  if (!canAim.value || locked() || captureState.value === 'pending') return
  if (!scene.value?.requestPointerLock) { captureState.value = 'unsupported'; return }
  captureState.value = 'pending'
  const target = scene.value
  try {
    target.requestPointerLock()?.then?.(() => {
      if ((!mounted || !canAim.value) && document.pointerLockElement === target) document.exitPointerLock?.()
    }).catch(captureFailed)
  } catch { captureFailed() }
}
function enter(event) {
  inputKind = event.pointerType || 'mouse'
  inside.value = true; lastX = event.clientX; measure()
  if (canAim.value && event.pointerType !== 'touch' && event.pointerType !== 'pen') requestCapture()
}
function leave() { if (!locked()) inside.value = false }
function move(event) {
  if (!canAim.value || !locked() && dragId !== null && event.pointerId !== dragId) return
  if (!locked() && !contains(event)) return
  if (locked() && Number.isFinite(event.timeStamp)) {
    const motion = [event.timeStamp, event.movementX || 0, event.movementY || 0]
    if (lastMotion && motion.every((value, i) => value === lastMotion[i])) return
    lastMotion = motion
  }
  inside.value = true
  const delta = locked() ? event.movementX || 0 : event.clientX - lastX
  lastX = event.clientX; measure()
  offset.value = Math.max(-ASSEMBLY_TRAVEL_PX, Math.min(ASSEMBLY_TRAVEL_PX, offset.value + delta))
}
function beginDrag(event) {
  if (!canAim.value || ![0, 2].includes(event.button)) return
  if (locked()) { drop(); return }
  if (!contains(event)) return
  inside.value = true; lastX = event.clientX
  if (event.pointerType === 'touch' || event.pointerType === 'pen') {
    if (dragId !== null) return
    dragId = event.pointerId
    if (!event.nativeTouch) scene.value.setPointerCapture?.(event.pointerId)
  } else drop()
}
function releaseDrag() {
  const id = dragId; dragId = null
  if (id !== null && scene.value?.hasPointerCapture?.(id)) scene.value.releasePointerCapture(id)
}
function unlock() { if (locked()) document.exitPointerLock?.() }
function endDrag(event) {
  if (dragId === null || dragId !== event.pointerId) return
  const valid = ready.value && inside.value && contains(event)
  if (valid) move(event)
  releaseDrag()
  if (valid) drop()
}
function lostCapture() { releaseDrag() }
function lockChanged() {
  if (locked()) {
    if (!mounted || !canAim.value) { unlock(); return }
    captureState.value = 'captured'; inside.value = true; lastMotion = null
  } else { captureState.value = 'idle'; inside.value = false }
}
// Locked mice may dispatch only MouseEvents, without PointerEvents.
function lockedMove(event) { if (locked()) move(event) }
function lockedPress(event) {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') return
  if ([0, 2].includes(event.button) && (locked() || contains(event))) drop()
}
function capturedRelease(event) { if (dragId !== null) endDrag(event) }
function mousePress(event) {
  if (dragId !== null || ![0, 2].includes(event.button)) return
  if (locked() || contains(event)) drop()
}
function nudge(direction) {
  if (canAim.value) offset.value = Math.max(-ASSEMBLY_TRAVEL_PX, Math.min(ASSEMBLY_TRAVEL_PX, offset.value + direction))
}
function drop() {
  if (!canAim.value) return
  const from = itemQuantity(props.inventory, part.value) ? 'bag' : 'storehouse'
  if (!ready.value) { dropError.value = true; emit('command', 'assemble', { from, position: position.value, offsetPx: offset.value }); return }
  dropError.value = false
  measure(); const impactOffset = offset.value
  droppedPart.value = props.blade.parts; landing.value = position.value
  phase.value = from === 'storehouse' ? 'fetching' : 'falling'; releaseDrag(); unlock(); emit('busy', true)
  const startFall = () => {
    phase.value = 'falling'
    impactTimer = setTimeout(() => {
      impactTimer = null
      emit('command', 'assemble', { from, position: landing.value, offsetPx: impactOffset })
      if (props.blade.parts !== droppedPart.value + 1) { cancel(); return }
      phase.value = 'contact'
      settleTimer = setTimeout(() => {
        settleTimer = null; phase.value = 'aiming'; resetAim(); emit('busy', false)
        nextTick(() => { if (mounted && ready.value && inputKind === 'mouse' && scene.value?.matches?.(':hover')) requestCapture() })
      }, 1000)
    }, 700)
  }
  if (from === 'storehouse') fetchTimer = setTimeout(() => { fetchTimer = null; startFall() }, 3000)
  else startFall()
}
function cancel() {
  nativeTouchId = null; releaseDrag(); unlock(); inside.value = false
  clearTimeout(fetchTimer); clearTimeout(impactTimer); clearTimeout(settleTimer)
  fetchTimer = null; impactTimer = null; settleTimer = null; phase.value = 'aiming'; emit('busy', false)
}
function blur() { if (phase.value === 'aiming') { releaseDrag(); unlock(); inside.value = false } }
function startTouch(event) {
  if (!canAim.value) return
  const touch = event.changedTouches?.[0]
  if (!touch) return
  nativeTouchId = touch.identifier
  if (dragId !== null) return
  beginDrag({ pointerType: 'touch', button: 0, pointerId: -1 - touch.identifier, nativeTouch: true, clientX: touch.clientX, clientY: touch.clientY })
}
function moveTouch(event) {
  const touch = [...event.changedTouches || []].find(touch => touch.identifier === nativeTouchId)
  if (touch && dragId !== null) move({ pointerId: dragId, clientX: touch.clientX, clientY: touch.clientY })
}
function endTouch(event) {
  const touch = [...event.changedTouches || []].find(touch => touch.identifier === nativeTouchId)
  if (!touch) return
  nativeTouchId = null
  if (dragId !== null) endDrag({ pointerId: dragId, clientX: touch.clientX, clientY: touch.clientY })
  else if (canAim.value && inside.value && contains(touch)) drop()
}
function cancelTouch() { nativeTouchId = null; releaseDrag() }
watch(() => props.paused, value => { if (value) cancel() })
onMounted(() => {
  mounted = true; measure()
  window.addEventListener('blur', blur); window.addEventListener('resize', measure)
  document.addEventListener('pointerlockchange', lockChanged); document.addEventListener('pointerlockerror', captureFailed)
  document.addEventListener('mousemove', lockedMove); document.addEventListener('pointermove', lockedMove); document.addEventListener('mousedown', lockedPress, true); document.addEventListener('pointerdown', lockedPress, true); document.addEventListener('pointerup', capturedRelease, true)
  if (typeof ResizeObserver !== 'undefined') { resizeObserver = new ResizeObserver(measure); resizeObserver.observe(scene.value) }
  if (scene.value?.matches?.(':hover')) requestCapture()
})
onBeforeUnmount(() => {
  mounted = false; cancel(); resizeObserver?.disconnect()
  window.removeEventListener('blur', blur); window.removeEventListener('resize', measure)
  document.removeEventListener('pointerlockchange', lockChanged); document.removeEventListener('pointerlockerror', captureFailed)
  document.removeEventListener('mousemove', lockedMove); document.removeEventListener('pointermove', lockedMove); document.removeEventListener('mousedown', lockedPress, true); document.removeEventListener('pointerdown', lockedPress, true); document.removeEventListener('pointerup', capturedRelease, true)
})
</script>
<template>
  <div class="dagger-assembly">
    <p class="assembly-instructions">{{ t('workshop.assemblyHelp') }}</p>
    <p v-if="ready && captureState === 'blocked'" class="assembly-capture-hint" role="status">{{ t('workshop.assemblyCapture') }}</p>
    <p v-else-if="ready && captureState === 'unsupported'" class="assembly-capture-hint" role="status">{{ t('workshop.assemblyNoCapture') }}</p>
    <p v-if="canAim && !ready" :class="{ 'assembly-drop-error': dropError }" role="status">{{ t('workshop.assemblyMissing', { item: t(items[part].nameKey) }) }}</p>
    <p v-if="phase === 'fetching' && !itemQuantity(inventory, fittings[droppedPart])" role="status">{{ t('workshop.assemblyFetching', { item: t(items[fittings[droppedPart]].nameKey) }) }}</p>
    <div ref="scene" class="assembly-arena" :class="{ 'assembly-arena--aiming': canAim, 'assembly-arena--contact': phase === 'contact' }" tabindex="0" :aria-label="t('workshop.assemblyAim')" @pointerenter="enter" @pointerleave="leave" @pointermove="move" @pointerdown.prevent="beginDrag" @pointerup.prevent="endDrag" @pointercancel="releaseDrag" @touchstart.prevent="startTouch" @touchmove.prevent="moveTouch" @touchend.prevent="endTouch" @touchcancel="cancelTouch" @lostpointercapture="lostCapture" @mousedown.prevent="mousePress" @click.prevent="mousePress" @auxclick.prevent="mousePress" @contextmenu.prevent @keydown.left.prevent="nudge(-1)" @keydown.right.prevent="nudge(1)" @keydown.enter.prevent="drop" @keydown.space.prevent="drop">
      <svg viewBox="0 0 300 250" aria-hidden="true">
        <ellipse cx="150" cy="241" rx="40" ry="4" fill="#101d18" opacity=".5"/>
        <g v-if="blade.design" :transform="`translate(150 156) rotate(90) scale(${80 / blade.design.length})`"><path v-for="(path, i) in designPaths(blade.design)" :key="i" :d="path" :fill="METALS[blade.design.material].color" stroke="#515a50" stroke-width="0.4"/></g><path v-else d="M144 103h12v53h18l-24 82-24-82h18Z" fill="#a8afa3" stroke="#515a50" stroke-width="2"/>
        <path v-if="!blade.design" d="M150 157v67" stroke="#d7dbcd" stroke-width="2"/>
        <image v-if="blade.parts > 0 && !(phase !== 'aiming' && droppedPart === 0)" :href="items[fittings[0]].imageSrc" x="110" y="116" width="80" height="80"/>
        <image v-if="blade.parts > 1 && !(phase !== 'aiming' && droppedPart === 1)" :href="items[fittings[1]].imageSrc" x="110" y="85" width="80" height="80"/>
        <image v-if="blade.parts > 2 && phase === 'aiming'" :href="items[fittings[2]].imageSrc" x="110" y="54" width="80" height="80"/>
        <circle v-if="phase === 'contact'" :cx="landing * 300" :cy="contactHeight(droppedPart)" r="18" class="assembly-impact"/>
      </svg>
      <div v-if="phase !== 'aiming' || blade.parts < 3" class="assembly-flight" :style="{ left: 'calc(50% + ' + (phase === 'aiming' ? offset : (landing - .5) * artWidth) + 'px)', '--start-y': 38 * artWidth / 300 + 'px', '--contact-y': (contactHeight(visiblePart)) * artWidth / 300 + 'px' }">
        <div class="assembly-part" :class="{ 'assembly-part--falling': phase === 'falling', 'assembly-part--contact': phase === 'contact' }"><img :src="items[fittings[visiblePart]].imageSrc" alt="" :style="{ width: 80 * artWidth / 300 + 'px', height: 80 * artWidth / 300 + 'px' }" /></div>
      </div>
      <output v-if="phase === 'contact'" class="assembly-contact-score" role="status">{{ t(successKey(droppedPart), { quality: Math.round(blade.assembly[droppedPart]) }) }}</output>
    </div>
    <div class="assembly-controls">
      <div class="assembly-results" aria-live="polite">
        <span v-if="blade.parts > 0">{{ t('workshop.guardSuccess', { quality: Math.round(blade.assembly[0]) }) }}</span>
        <span v-if="blade.parts > 1">{{ t('workshop.handleSuccess', { quality: Math.round(blade.assembly[1]) }) }}</span>
        <span v-if="blade.parts > 2">{{ t('workshop.pommelSuccess', { quality: Math.round(blade.assembly[2]) }) }}</span>
      </div>
    </div>
    <p v-if="blade.stage === 'assembled'">{{ t('workshop.nextGrind') }}</p>
  </div>
</template>
<style scoped>
.assembly-capture-hint{padding:5px 7px;background:#755b3344;border:1px solid #a68b55;color:#f1d79b;font-size:11px}.assembly-drop-error{padding:8px;border:1px solid #c88a69;background:#713d2c;color:#ffe3c4;font-weight:700}.assembly-instructions{font-size:11px;line-height:1.5;margin:5px 0}.assembly-arena{height:190px;position:relative;background:radial-gradient(ellipse at 50% 65%,#75573777,#1b2923);border:1px solid #a68b5544;border-radius:5px;touch-action:none;overflow:hidden}.assembly-arena--aiming,.assembly-arena--aiming *{cursor:none}.assembly-arena *{pointer-events:none}.assembly-arena:focus-visible{outline:1px solid #d6b671;outline-offset:2px}.assembly-arena svg{display:block;width:100%;height:100%}.assembly-flight{position:absolute;top:0;width:0;height:0;pointer-events:none}.assembly-part{transform:translateY(var(--start-y))}.assembly-part img{display:block;max-width:none;transform:translate(-50%,-50%)}.assembly-part--falling{animation:fitting-fall .7s cubic-bezier(.42,0,.9,.64) forwards}.assembly-part--contact{transform:translateY(var(--contact-y))}.assembly-impact{fill:none;stroke:#d4b36e;stroke-width:2;animation:fitting-impact .35s ease-out forwards}.assembly-contact-score{position:absolute;left:0;right:0;top:5px;text-align:center;color:#f1db9c;font-size:12px;font-weight:700;text-shadow:0 1px 3px #000}.assembly-controls{position:sticky;bottom:-4px;z-index:3;padding:4px 0;background:#25362bf5}.assembly-results{display:flex;flex-wrap:wrap;justify-content:space-between;gap:5px;margin-top:7px;font-size:11px;color:#e4cb8e;font-variant-numeric:tabular-nums}@keyframes fitting-fall{from{transform:translateY(var(--start-y))}to{transform:translateY(var(--contact-y))}}@keyframes fitting-impact{from{opacity:.8;stroke-width:3;r:6}to{opacity:0;stroke-width:0;r:25}}
</style>

<style scoped>.dagger-assembly{height:100%;min-height:0;display:flex;flex-direction:column}.assembly-arena{flex:1;min-height:90px;height:auto}.assembly-controls,.assembly-instructions,.assembly-results{flex:none}</style>
