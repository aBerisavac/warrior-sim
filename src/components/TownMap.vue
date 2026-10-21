<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { places } from '../game'
import catalog from '../data/actions.json'
import { travelMinutesFromPoint, mapGrid, mapSize } from '../routes'
import TownArt from './TownArt.vue'
import CircleIcon from './CircleIcon.vue'
import MapLegend from './MapLegend.vue'
import { isUnlocked } from '../progression'

const props = defineProps({
  currentLocation: { type: String, required: true },
  selectedId: { type: String, required: true },
  tutorialStage: { type: String, default: null },
  completedQuests: { type: Array, required: true },
  pawnPosition: { type: Object, required: true },
  travel: { type: Object, default: null },
  buildingTiers: { type: Object, default: () => ({}) },
  dialogueBlocked: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'action', 'job', 'menu'])
const { t } = useI18n()
const activeMenu = ref(null)
const workMenu = ref(null)
const pinnedMenu = ref(null)
let closeTimer = null
watch(activeMenu, (id) => emit('menu', id))

function placeUnlocked(place) {
  return place.available && isUnlocked(props.completedQuests, 'places', place.id)
}
function tutorialLocked(id) {
  const place = places.find((item) => item.id === id)
  return !place || !placeUnlocked(place)
}
function actionUnlocked(placeId, actionId) {
  return !tutorialLocked(placeId) && isUnlocked(props.completedQuests, 'actions', placeId + '.' + actionId)
}
function jobUnlocked(placeId, jobId) {
  return !tutorialLocked(placeId) && isUnlocked(props.completedQuests, 'jobs', placeId + '.' + jobId)
}

function cancelMenuClose() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}
function clearMenus() {
  cancelMenuClose()
  activeMenu.value = null
  workMenu.value = null
  pinnedMenu.value = null
}
function hoverOpen(id, event) {
  if (props.dialogueBlocked || tutorialLocked(id)) return
  if (event.pointerType === 'touch') return
  cancelMenuClose()
  if (activeMenu.value !== id) workMenu.value = null
  activeMenu.value = id
  emit('select', id)
}
function scheduleMenuClose(id, event) {
  if (event.pointerType === 'touch' || pinnedMenu.value === id) return
  cancelMenuClose()
  closeTimer = setTimeout(() => {
    if (activeMenu.value === id && pinnedMenu.value !== id) {
      activeMenu.value = null
      workMenu.value = null
    }
  }, 700)
}
function hoverWork(id, event) {
  if (props.dialogueBlocked) return
  if (event.pointerType === 'touch') return
  cancelMenuClose()
  activeMenu.value = id
  workMenu.value = id
}
function select(id) {
  if (props.dialogueBlocked || tutorialLocked(id)) return
  cancelMenuClose()
  if (pinnedMenu.value === id) clearMenus()
  else {
    activeMenu.value = id
    workMenu.value = null
    pinnedMenu.value = id
  }
  emit('select', id)
}
function focusPlace(id) {
  if (props.dialogueBlocked || tutorialLocked(id)) return
  cancelMenuClose()
  activeMenu.value = id
  workMenu.value = null
  pinnedMenu.value = id
  emit('select', id)
}
function actions(place) {
  const available = place.actions.filter((id) => actionUnlocked(place.id, id)).map((id) => ({ id, ...catalog.actions[id] }))
  if (place.available && placeUnlocked(place)) available.push({ id: 'upgrade', ...catalog.actions.upgrade, disabled: true })
  return available
}
function jobs(place) {
  return place.jobs.filter((id) => jobUnlocked(place.id, id)).map((id) => ({ id, ...catalog.jobs[id] }))
}
function actionLabel(action, place) {
  if (action.id === 'walk') {
    if (!place.available) return t('actions.unavailable')
    if (!props.travel && props.currentLocation === place.id) return t('actions.here')
    return t('actions.walk', { minutes: travelMinutesFromPoint(props.pawnPosition, place.id) })
  }
  return t(action.labelKey)
}
function handleAction(action, place) {
  if (props.dialogueBlocked || action.disabled || !actionUnlocked(place.id, action.id)) return
  if (action.id === 'work') {
    cancelMenuClose()
    activeMenu.value = place.id
    workMenu.value = place.id
    pinnedMenu.value = place.id
    return
  }
  clearMenus()
  emit('action', action.id, place.id)
}
function handleJob(job, place) {
  if (props.dialogueBlocked || !jobUnlocked(place.id, job.id)) return
  clearMenus()
  emit('job', job.id, place.id)
}
onBeforeUnmount(cancelMenuClose)
</script>

<template>
<TownArt :map="mapGrid" :tiers="buildingTiers" :marked-entrances="places.filter((place) => place.actions.length).map((place) => place.id)" @click="clearMenus" />
  <svg v-if="travel" class="town-route" :viewBox="'0 0 ' + mapSize.width + ' ' + mapSize.height" preserveAspectRatio="none" aria-hidden="true">
    <polyline :points="travel.route.map((point) => point.x + ',' + point.y).join(' ')" />
  </svg>
  <div class="pawn-walker" :style="{ left: pawnPosition.x / mapSize.width * 100 + '%', top: pawnPosition.y / mapSize.height * 100 + '%' }" aria-hidden="true">♟</div>
  <div v-if="travel" class="travel-banner" role="status" aria-live="polite">
    <strong>{{ t('map.walkingTo', { place: t('places.' + travel.destinationId + '.name') }) }}</strong>
    <span>{{ t('map.walkingTimeLeft', { seconds: Math.ceil((travel.totalMinutes - travel.elapsedMinutes) / 3), minutes: travel.totalMinutes - travel.elapsedMinutes }) }}</span>
    <small>{{ t('map.rerouteHint') }}</small>
  </div>

  <div v-for="place in places" :key="place.id" class="map-node"
    :class="{ 'menu-open': activeMenu === place.id, 'tutorial-guide-pin': (tutorialStage === 'fatherCall' || tutorialStage === 'fatherTalk') && place.id === 'smithy' }"
    :style="{ left: (place.x / mapSize.width * 100) + '%', top: (place.y / mapSize.height * 100) + '%' }"
    @pointerenter="hoverOpen(place.id, $event)"
    @pointerleave="scheduleMenuClose(place.id, $event)">
    <button class="map-pin"
      :class="{ active: !tutorialLocked(place.id) && (activeMenu === place.id || selectedId === place.id), locked: !place.available || tutorialLocked(place.id), current: !travel && !tutorialLocked(place.id) && currentLocation === place.id }"
      :aria-label="tutorialLocked(place.id) ? t('places.' + place.id + '.name') + ' · ' + t('tutorial.lockedPlace') : t('actions.placeActions', { place: t('places.' + place.id + '.name') })"
      :aria-expanded="activeMenu === place.id" :disabled="dialogueBlocked || tutorialLocked(place.id)" @click="select(place.id)">
      <CircleIcon as="span" size="main" class="pin-icon" :icon="place.icon" />
    </button>
    <Transition name="radial-menu" :duration="{ enter: 320, leave: 260 }">
      <div v-if="activeMenu === place.id" class="radial-actions" @pointerenter="cancelMenuClose">
        <CircleIcon v-for="action in actions(place)" :key="action.id" size="action" :icon="action.icon"
          :class="['radial-' + action.id, { 'tutorial-guide-action': (tutorialStage === 'fatherCall' || tutorialStage === 'fatherTalk') && place.id === 'smithy' && action.id === 'enter' }]"
          :title="actionLabel(action, place)" :aria-label="action.id === 'walk' ? t('actions.walkTo', { place: t('places.' + place.id + '.name') }) : actionLabel(action, place)"
          @pointerenter="action.id === 'work' && hoverWork(place.id, $event)"
          :disabled="dialogueBlocked || action.disabled" @click="handleAction(action, place)">
          <em v-if="action.id === 'walk'" class="walk-time">{{ place.available ? t('actions.travelBadge', { minutes: travelMinutesFromPoint(pawnPosition, place.id) }) : '—' }}</em>
        </CircleIcon>
        <Transition name="job-menu" :duration="{ enter: 270, leave: 230 }">
          <div v-if="workMenu === place.id" class="job-orbit" @pointerenter="cancelMenuClose">
            <CircleIcon v-for="(job, index) in jobs(place)" :key="job.id" size="job" :icon="job.icon"
              :style="{ '--job-x': (index - (jobs(place).length - 1) / 2) * 37 + 'px' }"
              :title="t(job.labelKey)" :aria-label="t(job.labelKey)" :disabled="dialogueBlocked"
              @click="handleJob(job, place)" />
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
  <MapLegend :places="places" :completed-quests="completedQuests"
    :current-location="travel ? '' : currentLocation" :selected-id="selectedId"
    :dialogue-blocked="dialogueBlocked" @focus="focusPlace" />
  <div class="map-stamp">{{ t('map.townName').toUpperCase() }} <span>{{ t('map.established') }}</span></div>
</template>
