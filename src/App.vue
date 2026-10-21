<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import PlayerSidebar from './components/PlayerSidebar.vue'
import DetailsSidebar from './components/DetailsSidebar.vue'
import MapHud from './components/MapHud.vue'
import TownMap from './components/TownMap.vue'
import MapEditor from './components/MapEditor.vue'
import ForgeMap from './components/ForgeMap.vue'
import GameModal from './components/GameModal.vue'
import TutorialCloud from './components/TutorialCloud.vue'
import { dayNumber, fatigueFactor, FORGE_COAL_CAPACITY, formatTime, initialState, injuryFactor, places, readSave, SAVE_KEY, staminaCap } from './game'
import { hasQuest, isUnlocked, questById, QUEST, stageFromQuests } from './progression'
import { placePoint, pointAtDistance, routeFromPoint, travelMinutesFromPoint, mapGrid } from './routes'
import { eventForTravelTick } from './travel-events'

const { t } = useI18n()
const game = reactive(readSave())
const offerPercent = ref(115)
const mapView = ref('town')
const editingMap = ref(false)
const gameFrame = ref(null)
const expandedGame = ref(false)
const fullscreenGame = ref(false)
const displayError = ref('')
let gameSizeObserver
function fitGameSquare() {
  const frame = gameFrame.value
  if (!frame) return
  const occupied = [...frame.children].filter(child => !child.classList.contains('map-canvas'))
    .reduce((height, child) => height + child.getBoundingClientRect().height, 0)
  frame.style.setProperty('--game-square', `${Math.max(0, Math.min(frame.clientWidth, frame.clientHeight - occupied))}px`)
}
function syncFullscreen() { fullscreenGame.value = document.fullscreenElement === gameFrame.value }
function handleDisplayKey(event) {
  if (event.key === 'Escape' && !document.fullscreenElement) expandedGame.value = false
}
async function toggleGameFullscreen() {
  displayError.value = ''
  try {
    if (document.fullscreenElement === gameFrame.value) await document.exitFullscreen()
    else await gameFrame.value.requestFullscreen()
  } catch { displayError.value = t('map.fullscreenUnavailable') }
}
const modal = ref(null)
const tradeFeedback = ref(null)
const townMenu = ref(null)
const cloudVisible = ref(true)
const cloudReady = ref(true)
const tavernReply = ref(null)
const tutorialQuest = computed(() => game.stage === 'fatherCall' || game.stage === 'fatherTalk' && mapView.value === 'town'
  ? questById(QUEST.FATHER_MET) : game.stage === 'fatherTalk' ? questById(QUEST.IRON_ERRAND_ACCEPTED) : null)
watch(() => tutorialQuest.value?.id, (id) => { cloudVisible.value = true; cloudReady.value = !id }, { immediate: true })
const tutorialStage = computed(() => hasQuest(game.completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED)
  ? null : ['intro', 'fatherCall', 'fatherTalk'].includes(game.stage) ? game.stage : 'restricted')
function placeUnlocked(id) {
  return !!places.find((place) => place.id === id)?.available && isUnlocked(game.completedQuests, 'places', id)
}
function actionUnlocked(placeId, actionId) {
  return placeUnlocked(placeId) && isUnlocked(game.completedQuests, 'actions', placeId + '.' + actionId)
}
function jobUnlocked(placeId, jobId) {
  return placeUnlocked(placeId) && isUnlocked(game.completedQuests, 'jobs', placeId + '.' + jobId)
}
function stationUnlocked(id) {
  return isUnlocked(game.completedQuests, 'forgeStations', id)
}
function completeQuest(id) {
  if (hasQuest(game.completedQuests, id)) return
  game.completedQuests.push(id)
  game.stage = stageFromQuests(game.completedQuests)
  game.materials = hasQuest(game.completedQuests, QUEST.IRON_STOCK_BOUGHT)
  game.dagger = hasQuest(game.completedQuests, QUEST.DAGGER_FORGED)
}
watch(() => game.completedQuests, () => {
  game.stage = stageFromQuests(game.completedQuests)
  game.materials = hasQuest(game.completedQuests, QUEST.IRON_STOCK_BOUGHT)
  game.dagger = hasQuest(game.completedQuests, QUEST.DAGGER_FORGED)
}, { deep: true })
const selectedTutorialLocked = computed(() => !placeUnlocked(game.selected))
let introTimer
let travelTimer
const selectedPlace = computed(() => places.find((place) => place.id === game.selected) || places[0])
const currentPlace = computed(() => places.find((place) => place.id === game.location) || places[0])
const pawnPosition = computed(() => game.travel?.position || placePoint(game.location))
const tripMinutes = computed(() => selectedPlace.value.available ? travelMinutesFromPoint(pawnPosition.value, game.selected) : 0)
const stamina = computed(() => staminaCap(game))
const fatigue = computed(() => Math.round(fatigueFactor(game) * 100))
const injury = computed(() => Math.round(injuryFactor(game) * 100))
const day = computed(() => dayNumber(game.minutes))
const clock = computed(() => formatTime(game.minutes))
const awakeHours = computed(() => Math.floor((game.minutes - game.awakeSince) / 60))
const sleepNeed = computed(() => Math.min(100, Math.round((game.minutes - game.awakeSince) / (48 * 60) * 100)))
const askingPrice = computed(() => Math.round(10 * (1.5 + Math.max(0, -game.reputation) * 0.1 - Math.max(0, game.reputation) * 0.04)))
const offeredPrice = computed(() => Math.round(10 * offerPercent.value / 100))
const moodKey = computed(() => game.reputation <= -3 ? 'refuses' : game.reputation < 0 ? 'irritated' : game.reputation > 1 ? 'friendly' : 'neutral')

watch(game, () => localStorage.setItem(SAVE_KEY, JSON.stringify(game)), { deep: true })
watchEffect(() => { document.title = t('app.title') + ' — ' + t('map.townName') })

function scheduleIntro() {
  clearTimeout(introTimer)
  if (game.stage !== 'intro') return
  introTimer = setTimeout(() => {
    if (game.stage !== 'intro') return
    completeQuest(QUEST.FATHER_CALLED)
    note('events.fatherCall')
  }, 3000)
}
onMounted(() => {
  gameSizeObserver = new ResizeObserver(fitGameSquare)
  gameSizeObserver.observe(gameFrame.value)
  for (const child of gameFrame.value.children) {
    if (child.classList.contains('map-hud') || child.classList.contains('game-display-controls') || child.classList.contains('map-footer')) gameSizeObserver.observe(child)
  }
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('keydown', handleDisplayKey)
  scheduleIntro()
  if (game.travel?.pausedForEvent) modal.value = 'event'
  else if (!game.travel && needsMarketNotice(game.location)) modal.value = 'marketNotice'
  else if (!game.travel && game.location === 'tavern' && hasQuest(game.completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED) && !hasQuest(game.completedQuests, QUEST.TAVERN_WORK_OFFERED)) modal.value = 'tavern'
  travelTimer = setInterval(tickTravel, 1000 / 3)
})
onBeforeUnmount(() => {
  gameSizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('keydown', handleDisplayKey)
  clearTimeout(introTimer)
  clearInterval(travelTimer)
})

function note(key, params = {}) {
  const entry = { key, params }
  game.event = entry
  if (modal.value === 'trade') tradeFeedback.value = entry
  game.journal.unshift(entry)
  game.journal = game.journal.slice(0, 5)
}

function selectPlace(id) {
  if (!placeUnlocked(id)) return
  game.selected = id
  modal.value = null
}

function performAction(actionId, placeId) {
  if (!actionUnlocked(placeId, actionId)) return
  if (actionId === 'enter') {
    mapView.value = 'forge'
    if (game.stage === 'fatherCall') {
      completeQuest(QUEST.FATHER_MET)
      note('events.fatherTalk')
    }
  } else if (actionId === 'talk') {
    tavernReply.value = null
    modal.value = 'tavern'
  } else if (actionId === 'trade') {
    if (needsMarketNotice(placeId)) { modal.value = 'marketNotice'; return }
    tradeFeedback.value = null
    modal.value = 'trade'
  }
}

function performJob(jobId, placeId) {
  if (!jobUnlocked(placeId, jobId)) return
  if (placeId === 'smithy') mapView.value = 'forge'
  modal.value = jobId
}

function startTravel(destinationId, pending = null) {
  if (!placeUnlocked(destinationId)) return
  if (game.travel?.destinationId === destinationId && !pending) return
  const route = routeFromPoint(pawnPosition.value, destinationId)
  if (!route.points.length) return
  if (route.minutes === 0) {
    game.travel = null
    game.location = destinationId
    if (pending?.kind === 'action') performAction(pending.id, destinationId)
    if (pending?.kind === 'job') performJob(pending.id, destinationId)
    if (needsMarketNotice(destinationId)) modal.value = 'marketNotice'
    else offerTavernWork(destinationId)
    return
  }
  game.travel = {
    destinationId,
    route: route.points,
    position: { ...pawnPosition.value },
    totalMinutes: route.minutes,
    elapsedMinutes: 0,
    secondsElapsed: 0,
    pending,
  }
  modal.value = null
}

function handleAction(actionId, placeId) {
  if (!actionUnlocked(placeId, actionId)) return
  game.selected = placeId
  if (actionId === 'info') {
    modal.value = 'info'
    return
  }
  if (actionId === 'walk') {
    if (!game.travel && game.location === placeId) modal.value = 'info'
    else startTravel(placeId)
    return
  }
  if (game.travel || game.location !== placeId) startTravel(placeId, { kind: 'action', id: actionId })
  else performAction(actionId, placeId)
}

function handleJob(jobId, placeId) {
  if (!jobUnlocked(placeId, jobId)) return
  game.selected = placeId
  if (game.travel || game.location !== placeId) startTravel(placeId, { kind: 'job', id: jobId })
  else performJob(jobId, placeId)
}

function tickTravel() {
  const journey = game.travel
  if (!journey || modal.value) return
  journey.elapsedMinutes += 1
  game.minutes += 1
  journey.position = pointAtDistance(journey.route, journey.elapsedMinutes * mapGrid.cellSize)

  const eventBeat = journey.elapsedMinutes % 3 === 0 || journey.elapsedMinutes >= journey.totalMinutes
  if (eventBeat) journey.secondsElapsed += 1
  const event = eventBeat ? eventForTravelTick(journey, game.completedQuests) : null
  if (event === 'bandits') {
    game.health = 68
    game.coins = 0
    completeQuest(QUEST.BANDIT_AMBUSH_SURVIVED)
    journey.pausedForEvent = true
    modal.value = 'event'
    note('events.bandits')
    return
  }
  if (event === 'roadTraveler') note('events.roadTraveler')

  if (journey.elapsedMinutes >= journey.totalMinutes) {
    const { destinationId, totalMinutes, pending } = journey
    game.location = destinationId
    game.travel = null
    note('events.travel', { placeId: destinationId, duration: totalMinutes })
    if (pending?.kind === 'action') performAction(pending.id, destinationId)
    if (pending?.kind === 'job') performJob(pending.id, destinationId)
    if (needsMarketNotice(destinationId)) modal.value = 'marketNotice'
    else offerTavernWork(destinationId)
  }
}

function needsMarketNotice(placeId) {
  return placeId === 'market' && hasQuest(game.completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED)
    && !hasQuest(game.completedQuests, QUEST.MARKET_JOB_NOTICE_READ)
}
function readMarketNotice() {
  if (modal.value !== 'marketNotice' || !needsMarketNotice(game.location)) return
  completeQuest(QUEST.MARKET_JOB_NOTICE_READ)
  note('events.marketJobNotice')
  modal.value = null
}

function offerTavernWork(destinationId) {
  if (destinationId !== 'tavern' || !hasQuest(game.completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED) || hasQuest(game.completedQuests, QUEST.TAVERN_WORK_OFFERED)) return
  tavernReply.value = null
  modal.value = 'tavern'
}

function answerInnkeeper(reason) {
  if (modal.value !== 'tavern' || tavernReply.value || !['bandits', 'father', 'work'].includes(reason)) return
  tavernReply.value = reason
  completeQuest(QUEST.TAVERN_WORK_OFFERED)
  note('events.tavernWork')
}

function finishWoodcutting(result) {
  if (modal.value !== 'wood' || game.location !== 'tavern' || !jobUnlocked('tavern', 'wood')) return
  game.minutes += result.minutes
  game.coins += result.coins
  note('events.wood', { coins: result.coins, pieces: result.pieces, quality: result.average })
  modal.value = null
}

function closeModal() {
  modal.value = null
  if (game.travel?.pausedForEvent) game.travel.pausedForEvent = false
}

function work(kind) {
  if (!jobUnlocked('tavern', kind)) return
  if (kind !== 'dishes') return
  game.minutes += 60
  game.coins += 3
  note('events.dishes')
  modal.value = null
}

function bargain() {
  if (!actionUnlocked('market', 'trade')) return
  if (!hasQuest(game.completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED) || hasQuest(game.completedQuests, QUEST.IRON_STOCK_BOUGHT)) return
  if (game.reputation <= -3) {
    note('events.refuse')
    return
  }
  const minimum = Math.max(75, 100 - game.reputation * 10)
  if (offerPercent.value < minimum) {
    game.reputation = Math.max(-3, game.reputation - 1)
    note('events.insult')
    return
  }
  if (game.coins < offeredPrice.value) {
    note('events.needCoins', { price: offeredPrice.value })
    return
  }
  game.coins -= offeredPrice.value
  completeQuest(QUEST.IRON_STOCK_BOUGHT)
  modal.value = null
  if (offerPercent.value >= 130) game.reputation = Math.min(3, game.reputation + 1)
  note('events.accepted', { price: offeredPrice.value })
}

function tip() {
  if (!actionUnlocked('market', 'trade')) return
  if (game.coins < 1) {
    note('events.needTip')
    return
  }
  if (game.reputation <= -3) {
    note('events.refuseTip')
    return
  }
  game.coins -= 1
  game.reputation = Math.min(3, game.reputation + 1)
  note('events.tipped')
}

function addCoal() {
  if (!stationUnlocked('furnace') || game.coalStock <= 0 || game.forgeCoal >= FORGE_COAL_CAPACITY) return
  game.coalStock -= 1
  game.forgeCoal += 1
}

function forge() {
  if (!stationUnlocked('anvil') || !game.materials || game.dagger) return
  game.minutes += 120
  completeQuest(QUEST.DAGGER_FORGED)
  modal.value = null
  note('events.forged')
}

function sleep() {
  if (game.travel || !isUnlocked(game.completedQuests, 'hud', 'sleep')) return
  const nextMorning = Math.floor(game.minutes / 1440 + 1) * 1440 + 7 * 60
  game.minutes = nextMorning
  game.awakeSince = nextMorning
  game.health = Math.min(100, game.health + 12)
  if (game.reputation <= -3) game.reputation = -2
  const draftToday = hasQuest(game.completedQuests, QUEST.DAGGER_FORGED) && !hasQuest(game.completedQuests, QUEST.DRAFTED)
  if (draftToday) {
    completeQuest(QUEST.DRAFTED)
    note('events.draft')
  } else {
    note('events.rested')
  }
  modal.value = draftToday ? 'event' : null
}

function acceptFatherErrand() {
  if (!hasQuest(game.completedQuests, QUEST.FATHER_MET) || hasQuest(game.completedQuests, QUEST.IRON_ERRAND_ACCEPTED)) return
  completeQuest(QUEST.IRON_ERRAND_ACCEPTED)
  note('events.start')
}

function reset() {
  Object.assign(game, initialState())
  scheduleIntro()
  offerPercent.value = 115
  mapView.value = 'town'
  tradeFeedback.value = null
  townMenu.value = null
  cloudVisible.value = true
  tavernReply.value = null
  modal.value = null
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-seal">✣</span>
        <div><span class="eyebrow">{{ t('app.tagline') }}</span><h1>{{ t('app.title') }}</h1></div>
      </div>
      <div class="top-meta">
        <span class="chapter">{{ t('app.chapter') }} <i></i> {{ t('app.chapterName') }}</span>
        <span class="save-indicator"><span></span> {{ t('app.saved') }}</span>
      </div>
    </header>

    <main class="layout">
      <PlayerSidebar :game="game" :map-view="mapView" :stamina="stamina" :fatigue="fatigue" :injury="injury" :day="day" :clock="clock" :awake-hours="awakeHours" />

      <section class="map-column">
        <div class="map-heading">
          <div>
            <span class="eyebrow">{{ t(mapView === 'town' ? 'map.townEyebrow' : 'map.forgeEyebrow') }}</span>
            <h2>{{ t(mapView === 'town' ? 'map.townName' : 'map.forgeName') }}</h2>
            <p>{{ t(mapView === 'town' ? 'map.townDescription' : 'map.forgeDescription') }}</p>
          </div>
          <div v-if="mapView === 'town'" class="map-scale"><span class="dot" :class="game.stage === 'intro' ? 'hollow' : 'green'"></span> {{ t(game.stage === 'intro' ? 'map.locked' : tutorialStage && !placeUnlocked('market') ? 'map.tutorialOpen' : 'map.open') }} <span class="dot hollow"></span> {{ t('map.future') }}</div>
        </div>

        <div ref="gameFrame" class="map-frame" :class="{ 'map-frame--playing': !editingMap, 'map-frame--expanded': expandedGame, 'map-frame--fullscreen': fullscreenGame }">
          <div id="game-animation-layer" class="game-animation-layer" aria-hidden="true"></div>
          <div class="game-display-controls">
            <button type="button" :aria-pressed="expandedGame" :disabled="fullscreenGame" @click="expandedGame = !expandedGame">{{ t(expandedGame ? 'map.restoreWindow' : 'map.expandWindow') }}</button>
            <button type="button" :aria-pressed="fullscreenGame" @click="toggleGameFullscreen">{{ t(fullscreenGame ? 'map.exitFullscreen' : 'map.enterFullscreen') }}</button>
            <span v-if="displayError" role="status">{{ displayError }}</span>
          </div>
          <div v-if="mapView === 'town' && !editingMap" class="map-edit-toggle"><button type="button" @click="editingMap = !editingMap">{{ t(editingMap ? 'mapEditor.close' : 'mapEditor.open') }}</button></div>
          <MapEditor v-if="editingMap && mapView === 'town'" @close="editingMap = false" />
          <template v-else>
          <MapHud :health="game.health" :stamina="stamina" :sleep-need="sleepNeed" :coins="game.coins" :completed-quests="game.completedQuests" :traveling="!!game.travel" @modal="modal = $event" />
          <div class="map-canvas">
            <TownMap v-if="mapView === 'town'" :current-location="game.location" :pawn-position="pawnPosition" :travel="game.travel" :building-tiers="game.buildingTiers" :dialogue-blocked="!!tutorialQuest && !cloudReady" :selected-id="game.selected" :tutorial-stage="tutorialStage" :completed-quests="game.completedQuests" @menu="townMenu = $event" @select="selectPlace" @action="handleAction" @job="handleJob" />
            <ForgeMap v-else :dialogue-blocked="!!tutorialQuest && !cloudReady" :completed-quests="game.completedQuests" :forge-coal="game.forgeCoal" :coal-stock="game.coalStock" :coal-capacity="FORGE_COAL_CAPACITY" @add-coal="addCoal" @town="mapView = 'town'" @modal="modal = $event" />
            <button v-if="tutorialQuest" class="cloud-toggle" type="button" :aria-label="t(cloudVisible ? 'map.hideCloud' : 'map.showCloud')" :title="t(cloudVisible ? 'map.hideCloud' : 'map.showCloud')" @click="cloudVisible = !cloudVisible">{{ cloudVisible ? '−' : '+' }}</button>
            <TutorialCloud :hidden="!cloudVisible" :quest="tutorialQuest" :marker-open="townMenu === 'smithy'" @ready="cloudReady = $event" @accept="acceptFatherErrand" />
            <GameModal :modal="modal" :game="game" :selected-place="selectedPlace" :trip-minutes="tripMinutes"
              :stamina="stamina" :sleep-need="sleepNeed" :asking-price="askingPrice" :offered-price="offeredPrice"
              v-model:offer-percent="offerPercent" :mood-key="moodKey" :trade-feedback="tradeFeedback" :tavern-reply="tavernReply"
              @market-notice-read="readMarketNotice" @close="closeModal" @modal="modal = $event" @reset="reset" @bargain="bargain" @tip="tip"
              @update:skip-woodcutting-intro="game.skipWoodcuttingIntro = $event" @work="work" @wood-finished="finishWoodcutting" @tavern-answer="answerInnkeeper" @forge="forge" @sleep="sleep" />
          </div>
          </template>
          <div class="map-footer">
            <span><i class="location-dot"></i> {{ game.travel ? t('map.onRoad', { place: t('places.' + game.travel.destinationId + '.name') }) : t(mapView === 'town' ? 'map.youAt' : 'map.inside') }} <strong v-if="!game.travel">{{ t('places.' + currentPlace.id + '.name') }}</strong></span>
            <span>{{ t(mapView === 'town' ? 'map.hoverHint' : 'map.doorHint') }}</span>
          </div>
        </div>

        <div class="growth-banner">
          <div class="growth-icon">♜</div>
          <div><strong>{{ t('map.growthTitle') }}</strong><span>{{ t('map.growthDescription') }}</span></div>
          <span class="growth-tag">{{ t('map.growthTag') }}</span>
        </div>
      </section>

      <DetailsSidebar :building-tiers="game.buildingTiers" :tutorial-locked="!!selectedTutorialLocked" :selected-place="selectedPlace" :current-location="game.travel ? '' : game.location" :trip-minutes="tripMinutes" :event="game.event" :journal="game.journal" />
    </main>

    <footer class="footer"><span>{{ t('map.footerTitle') }}</span><span>{{ t('map.footerDescription') }}</span></footer>
  </div>
</template>
