<script setup>
import { advanceTravelClock } from './travel-clock'
import { canSleep, sleepNeedPercent, updateHunger, eatItem, nextMorningMinutes } from './needs'
import { DISHES_PAY, MERCHANT_TIP } from './currency'
import { canStartDailyJob, canResumeDailyJob, startDailyJob, endDailyJob } from './daily-jobs'
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, toRaw, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import GameToolbar from './components/GameToolbar.vue'
import MapLoadingScreen from './components/MapLoadingScreen.vue'
import MapHud from './components/MapHud.vue'
import TownMap from './components/TownMap.vue'
import MapEditor from './components/MapEditor.vue'
import ForgeMap from './components/ForgeMap.vue'
import { actionStation } from './forge-navigation'
import ForgeLesson from './components/ForgeLesson.vue'
import { nextWorkshopLesson } from './workshop-lesson'
import WorkshopDialog from './components/WorkshopDialog.vue'
import PouringGame from './components/PouringGame.vue'
import { tickWorkshop, queueWorkshopLoad } from './workshop'
import { canEnterSmithy, robPlayer } from './errand'
import GameModal from './components/GameModal.vue'
import AudioSettings from './components/AudioSettings.vue'
import CharacterSetup from './components/CharacterSetup.vue'
import MapWeather from './components/MapWeather.vue'
import { weatherAt } from './weather'
import { encounterCue, createAudioEngine, readAudioSettings, AUDIO_SETTINGS_KEY, sceneSounds, useGameAudio } from './audio'
import TutorialCloud from './components/TutorialCloud.vue'
import { dayNumber, formatTime, initialState, places, readSave, restoreSave, SAVE_KEY, staminaCap } from './game'
import { hasQuest, isUnlocked, questById, QUEST, stageFromQuests } from './progression'
import { placePoint, pointAtDistance, routeFromPoint, routeToCellFromPoint, travelMinutesFromPoint, mapGrid } from './routes'
import { hasRequiredItems, items } from './inventory'
import { merchantAt, quoteTrade, offerFingerprint, merchantMinimum, executeTrade, refreshMerchantStock } from './merchants'
import { eventForTravelTick } from './travel-events'
import { preloadMapAssets } from './map-loading'

const { t } = useI18n()
const mapEditingAvailable = import.meta.env.DEV
const game = reactive(readSave())
provide('playerIdentity', computed(() => ({ playerName: game.playerName, avatarSrc: game.avatarSrc })))
const returningPlayer = (() => { try { const saved = JSON.parse(localStorage.getItem(SAVE_KEY)); return saved?.version >= 1 && saved?.version <= 12 && places.some(place => place.id === saved.location) } catch { return false } })()
const audioSettings = reactive(readAudioSettings(localStorage))
const audio = createAudioEngine({ settings: audioSettings })
useGameAudio(audio)
const settingsOpen = ref(false)
watch(audioSettings, settings => {
  audio.configure(settings)
  try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings)) } catch { /* Keep settings usable if storage is full. */ }
}, { deep: true })
function unlockAudio(event) { if (event.isTrusted && (event.type !== 'keydown' || !event.ctrlKey && !event.altKey && !event.metaKey)) void audio.unlock() }
function interfaceSound(event) { if (event.target.closest?.('button:not(:disabled)') && !event.target.closest('[data-audio-ui="off"]')) audio.play('click') }
function audioVisibility() { refreshAudioScene(); audio.visibilityChanged() }
const tradeAgreement = ref(null)
const activeMerchant = computed(() => merchantAt(game.location))
const mapView = ref('town')
const loadingMap = ref('town')
const loadingFirstVisit = ref(true)
const loadingProgress = reactive({ completed: 0, total: 0 })
let loadingSequence = 0
async function showMapLoading(id, firstVisit = false) {
  const sequence = ++loadingSequence
  loadingMap.value = id
  loadingFirstVisit.value = firstVisit
  loadingProgress.completed = 0; loadingProgress.total = 0
  const minimumTime = new Promise(resolve => setTimeout(resolve, firstVisit ? 650 : 350))
  await Promise.all([preloadMapAssets(id, game.buildingTiers, (completed, total) => {
    if (sequence === loadingSequence) { loadingProgress.completed = completed; loadingProgress.total = total }
  }), minimumTime])
  if (sequence === loadingSequence) { loadingMap.value = null; if (firstVisit) scheduleIntro() }
}
watch(mapView, id => { void showMapLoading(id) }, { flush: 'sync' })
const editingMap = ref(false)
const gameFrame = ref(null)
const importInput = ref(null)
const townMap = ref(null)
const gameHeader = ref(null)
const gameFooter = ref(null)
const fullscreenGame = ref(false)
const mobileGame = ref(false)
const displayError = ref('')
let gameSizeObserver
let mobileQuery
function syncMobileGame() { mobileGame.value = mobileQuery.matches }
function fitGameSquare() {
  const frame = gameFrame.value
  if (!frame) return
  const headerHeight = gameHeader.value?.offsetHeight || 0
  const footerHeight = gameFooter.value?.offsetHeight || 0
  const reserved = headerHeight + footerHeight
  frame.style.setProperty('--game-header-height', `${headerHeight}px`)
  frame.style.setProperty('--game-footer-height', `${footerHeight}px`)
  frame.style.setProperty('--game-square', `${Math.max(0, Math.min(frame.clientWidth, frame.clientHeight - reserved))}px`)
}
function syncFullscreen() { fullscreenGame.value = document.fullscreenElement === gameFrame.value }
function handleDisplayKey(event) {
  if (event.key.toLowerCase() === 'r' && !event.repeat && mapView.value === 'forge' && (!modal.value || modal.value === 'workshop') && game.workshop.working && ['melting', 'molten', 'pouring'].includes(game.workshop.crucible.stage) && !['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) { event.preventDefault(); workshopCommand('pour') }
}
async function toggleGameFullscreen() {
  if (mobileGame.value) return
  displayError.value = ''
  try {
    if (document.fullscreenElement === gameFrame.value) await document.exitFullscreen()
    else await gameFrame.value.requestFullscreen()
  } catch { displayError.value = t('map.fullscreenUnavailable') }
}
const modal = ref(null)
function refreshAudioScene(weatherKind = weatherAt(game.minutes, game.weatherSeed).kind) {
  audio.setScene(sceneSounds({ mapView: mapView.value, location: game.location, traveling: !!game.travel, walking: mapView.value === 'town' && !!game.travel && (typeof document === 'undefined' || !document.hidden) && !modal.value && !settingsOpen.value, woodcutting: modal.value === 'wood', fuel: game.workshop.fuel, raining: weatherKind === 'rain' }))
}
watch([mapView, () => game.location, () => !!game.travel, () => game.workshop.fuel > 0, () => weatherAt(game.minutes, game.weatherSeed).kind, modal, settingsOpen], () => refreshAudioScene(), { immediate: true })
watch(modal, (value, old) => {
  if (value === 'trade' && old !== 'trade') { tradeAgreement.value = null; tradeFeedback.value = null }
  if (value === 'inventory') audio.play('inventory'); else if (['journal', 'objective'].includes(value)) audio.play('page')
})
const forgeMap = ref(null)
const forgeLesson = ref(null)
const assemblyBusy = ref(false)
watch(() => mapView.value === 'forge' && !assemblyBusy.value && !settingsOpen.value && modal.value !== 'pouring' ? nextWorkshopLesson(game) : null, lesson => { if (!forgeLesson.value && lesson) forgeLesson.value = lesson })
function completeForgeLesson(id) {
  if (!game.workshop.lessonSeen.includes(id)) game.workshop.lessonSeen.push(id)
  if (id === 'finished') game.workshop.lessonFinishPending = false
  forgeLesson.value = null
}
watch(mapView, view => { if (view !== 'forge') forgeLesson.value = null })
watch(forgeLesson, lesson => { if (!lesson && !assemblyBusy.value && mapView.value === 'forge' && modal.value !== 'pouring') forgeLesson.value = nextWorkshopLesson(game) })
const workshopStation = ref('crucible')
const workshopFeedback = ref(null)
function openWorkshop(station, arrived = false) {
  if (forgeLesson.value || game.workshop.loading) return
  if (!stationUnlocked(['reference', 'design'].includes(station) ? 'workbench' : station)) return
  if (station === 'warehouse' ? game.workshop.working : !['reference', 'design', 'workbench'].includes(station) && !game.workshop.working) return
  if (!arrived && forgeMap.value && !forgeMap.value.isNear(station)) { closeModal(); forgeMap.value.approach(station, () => openWorkshop(station, true)); return }
  if (station === 'reference') audio.play('page')
  else if (station === 'warehouse') audio.play('inventory')
  workshopStation.value = station
  workshopFeedback.value = null
  modal.value = 'workshop'
}
function leaveForge(arrived = false) {
  if (forgeLesson.value) return
  if (game.workshop.working) return
  if (!arrived && forgeMap.value && !forgeMap.value.isNear('door')) { closeModal(); forgeMap.value.approach('door', () => leaveForge(true)); return }
  if (hasQuest(game.completedQuests, QUEST.IRON_ERRAND_ACCEPTED)) game.leftHomeForErrand = true
  closeModal()
  mapView.value = 'town'
  audio.play('door')
}
function workshopCommand(action, params, arrived = false) {
  if (forgeLesson.value || game.workshop.loading && action !== 'stop') return
  if (mapView.value !== 'forge' || game.location !== 'smithy' || !stationUnlocked('furnace')) return
  const station = actionStation(action, params, workshopStation.value)
  if (!arrived && station && forgeMap.value && !forgeMap.value.isNear(station)) {
    if (['strike', 'grind', 'transfer', 'assemble'].includes(action)) return
    closeModal(); forgeMap.value.approach(station, () => workshopCommand(action, params, true)); return
  }
  const wasPouring = game.workshop.pour?.holding
  const result = queueWorkshopLoad(game, action, params)
  if (result.pouring) modal.value = 'pouring'
  if (['designRequired', 'designMaterials', 'invalidDesign'].includes(result.error)) { closeModal(); openWorkshop('design') }
  if (result.error === 'noSupplies') modal.value = 'smithingUnavailable'
  if (!result.error && ['start', 'stop'].includes(action)) { closeModal(); audio.release('steam'); audio.release('grind') }
  if (!result.error) {
    const cues = { coal: 'coal', bellows: 'bellows', coolForge: 'pour', loadOre: 'metal', loadCarbon: 'coal', smelt: 'metal', dumpResidue: 'pour', discardCasting: 'metal', collect: 'metal', rackIngot: 'metal', heatIngot: 'metal', takeIngot: 'metal', heat: 'metal', removeHeat: 'metal', anvil: 'metal', strike: 'hammer', assemble: 'assembly', finish: 'metal', transfer: 'inventory' }
    if (action === 'pourControl' && params?.holding && !wasPouring) audio.play('pour')
    if (cues[action]) audio.play(cues[action], action === 'strike' ? { scale: .35 + (params?.power || 0) * .65 } : undefined)
    if (action === 'grind') audio.hold('grind')
    if (action === 'quenchStart' || action === 'quenchTick') audio.hold('steam')
    if (action === 'quenchEnd') audio.release('steam')
  }
  workshopFeedback.value = result.error || (result.designSaved ? 'designSaved' : null)
  if (result.finished) {
    if (!hasQuest(game.completedQuests, QUEST.DAGGER_FORGED)) game.workshop.lessonFinishPending = true
    completeQuest(QUEST.DAGGER_FORGED)
    note('events.forged')
    workshopFeedback.value = 'finished'
  }
}
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
  return (id !== 'smithy' || canEnterSmithy(game)) && !!places.find((place) => place.id === id)?.available && isUnlocked(game.completedQuests, 'places', id)
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
let introTimer
let travelTimer
let lastTravelTick
let marketPassing = 18 + Math.random() * 15, marketCallout = 55 + Math.random() * 40
let workshopTimer
let lastWorkshopTick
let idleClockSeconds = 0
const selectedPlace = computed(() => places.find((place) => place.id === game.selected) || places[0])
const currentPlace = computed(() => places.find((place) => place.id === game.location) || places[0])
const pawnPosition = computed(() => game.travel?.position || game.townPosition || placePoint(game.location))
const atPlace = id => {
  const point = placePoint(id), pawn = pawnPosition.value
  return !!point && !!pawn && Math.hypot(point.x - pawn.x, point.y - pawn.y) < .01 && !game.travel
}
const tripMinutes = computed(() => selectedPlace.value.available ? travelMinutesFromPoint(game.travel ? toRaw(game.travel).position : pawnPosition.value, game.selected) : 0)
const stamina = computed(() => staminaCap(game))
const day = computed(() => dayNumber(game.minutes))
const clock = computed(() => formatTime(game.minutes))
const sleepNeed = computed(() => Math.floor(sleepNeedPercent(game)))
const moodKey = computed(() => game.reputation <= -3 ? 'refuses' : game.reputation < 0 ? 'irritated' : game.reputation > 1 ? 'friendly' : 'neutral')
let importPending = false

watch(() => game.minutes, () => { refreshMerchantStock(game); updateHunger(game) }, { immediate: true, flush: 'sync' })
watch(game, () => { if (!importPending) localStorage.setItem(SAVE_KEY, JSON.stringify(game)) }, { deep: true })
watchEffect(() => { document.title = t('app.title') + ' — ' + t('map.townName') })

function scheduleIntro() {
  clearTimeout(introTimer)
  if (game.stage !== 'intro' || !game.profileChosen) return
  introTimer = setTimeout(() => {
    if (game.stage !== 'intro') return
    completeQuest(QUEST.FATHER_CALLED)
    note('events.fatherCall')
  }, 3000)
}
function finishCharacterSetup(identity) {
  game.playerName = identity.playerName
  game.avatarSrc = identity.avatarSrc
  game.profileChosen = true
  scheduleIntro()
}
onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 570px)')
  syncMobileGame()
  mobileQuery.addEventListener('change', syncMobileGame)
  document.addEventListener('pointerdown', unlockAudio, true)
  document.addEventListener('touchend', unlockAudio, true)
  document.addEventListener('click', unlockAudio, true)
  document.addEventListener('keydown', unlockAudio, true)
  document.addEventListener('click', interfaceSound)
  document.addEventListener('visibilitychange', audioVisibility)
  audio.tryAutoplay()
  gameSizeObserver = new ResizeObserver(fitGameSquare)
  gameSizeObserver.observe(gameFrame.value)
  gameSizeObserver.observe(gameHeader.value)
  gameSizeObserver.observe(gameFooter.value)
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('keydown', handleDisplayKey)
  void showMapLoading(mapView.value, true)
  if (game.travel?.pausedForEvent) modal.value = 'event'
  else if (!game.travel && needsMarketNotice(game.location)) modal.value = 'marketNotice'
  else if (atPlace('tavern') && hasQuest(game.completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED) && !hasQuest(game.completedQuests, QUEST.TAVERN_WORK_OFFERED)) modal.value = 'tavern'
  lastTravelTick = performance.now()
  travelTimer = requestAnimationFrame(animateTravel)
  lastWorkshopTick = performance.now()
  workshopTimer = setInterval(() => {
    const now = performance.now(), realDt = Math.max(0, (now - lastWorkshopTick) / 1000), dt = Math.min(.25, realDt)
    lastWorkshopTick = now
    if (!game.travel) {
      idleClockSeconds += realDt * 5
      while (idleClockSeconds >= 60) { game.minutes += 1; idleClockSeconds -= 60 }
    }
    if (mapView.value === 'town' && atPlace('market') && !settingsOpen.value) {
      marketPassing -= dt; marketCallout -= dt
      if (marketPassing <= 0) { audio.play('marketHorse'); audio.play('marketCart'); marketPassing = 30 + Math.random() * 35 }
      if (marketCallout <= 0) { audio.play('marketCallout', { rate: 1 }); marketCallout = 60 + Math.random() * 45 }
    }
    if (!forgeLesson.value || mapView.value !== 'forge') tickWorkshop(game, dt)
  }, 200)
})
onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', syncMobileGame)
  document.removeEventListener('pointerdown', unlockAudio, true)
  document.removeEventListener('touchend', unlockAudio, true)
  document.removeEventListener('click', unlockAudio, true)
  document.removeEventListener('keydown', unlockAudio, true)
  document.removeEventListener('click', interfaceSound)
  document.removeEventListener('visibilitychange', audioVisibility)
  useGameAudio(null)
  void audio.dispose()
  gameSizeObserver?.disconnect()
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('keydown', handleDisplayKey)
  clearTimeout(introTimer)
  cancelAnimationFrame(travelTimer)
  clearInterval(workshopTimer)
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
    audio.play('door')
    if (game.stage === 'fatherCall') {
      completeQuest(QUEST.FATHER_MET)
      note('events.fatherTalk')
    } else if (game.leftHomeForErrand && hasQuest(game.completedQuests, QUEST.IRON_STOCK_BOUGHT)
      && !hasQuest(game.completedQuests, QUEST.DAGGER_FORGED) && !game.workshop.working
      && !game.workshop.lessonSeen.includes('welcomeBack')
      && hasRequiredItems(game.inventory, questById(QUEST.IRON_STOCK_BOUGHT).requiredItems)) {
      workshopCommand('start')
    }
  } else if (actionId === 'talk') {
    tavernReply.value = null
    modal.value = 'tavern'
  } else if (actionId === 'trade') {
    if (needsMarketNotice(placeId)) { modal.value = 'marketNotice'; return }
    tradeAgreement.value = null
    tradeFeedback.value = null
    modal.value = 'trade'
  }
}

function performJob(jobId, placeId) {
  if (!jobUnlocked(placeId, jobId)) return
  if (['wood', 'dishes'].includes(jobId) && !canStartDailyJob(game, jobId) && !canResumeDailyJob(game, jobId)) { modal.value = jobId + 'Done'; return }
  if (jobId === 'wood' && !canResumeDailyJob(game, 'wood') && !startDailyJob(game, 'wood')) return
  if (placeId === 'smithy') { mapView.value = 'forge'; openWorkshop('crucible'); return }
  modal.value = jobId
}

function startTravel(destinationId, pending = null) {
  if (!placeUnlocked(destinationId)) return
  if (game.travel?.destinationId === destinationId && !pending) return
  const route = routeFromPoint(game.travel ? toRaw(game.travel).position : pawnPosition.value, destinationId)
  if (!route.points.length) return
  if (route.minutes === 0) {
    game.travel = null
    game.location = destinationId
    game.townPosition = placePoint(destinationId)
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
    minutesPerCell: mapGrid.minutesPerCell || 1,
    elapsedMinutes: 0,
    secondsElapsed: 0,
    cellSeconds: 0,
    pending,
  }
  modal.value = null
}
function startRoadTravel(cell) {
  if (mapView.value !== 'town' || settingsOpen.value || modal.value || editingMap.value) return
  const route = routeToCellFromPoint(game.travel ? toRaw(game.travel).position : pawnPosition.value, cell.x, cell.y)
  if (!route.points.length) return
  if (!route.minutes) { game.travel = null; game.townPosition = route.points.at(-1); return }
  game.travel = {
    destinationId: 'road', targetCell: { x: cell.x, y: cell.y }, route: route.points,
    position: { ...pawnPosition.value }, totalMinutes: route.minutes,
    minutesPerCell: mapGrid.minutesPerCell || 1, elapsedMinutes: 0,
    secondsElapsed: 0, cellSeconds: 0, pending: null,
  }
}

function handleAction(actionId, placeId) {
  if (!actionUnlocked(placeId, actionId)) return
  game.selected = placeId
  if (actionId === 'info') {
    modal.value = 'info'
    return
  }
  if (actionId === 'walk') {
    if (atPlace(placeId)) modal.value = 'info'
    else startTravel(placeId)
    return
  }
  if (!atPlace(placeId)) startTravel(placeId, { kind: 'action', id: actionId })
  else performAction(actionId, placeId)
}

function handleJob(jobId, placeId) {
  if (!jobUnlocked(placeId, jobId)) return
  game.selected = placeId
  if (!atPlace(placeId)) startTravel(placeId, { kind: 'job', id: jobId })
  else performJob(jobId, placeId)
}

function animateTravel() {
  tickTravel()
  travelTimer = requestAnimationFrame(animateTravel)
}
function tickTravel() {
  const now = performance.now()
  const seconds = Math.min(.15, (now - lastTravelTick) / 1000)
  lastTravelTick = now
  const journey = game.travel && toRaw(game.travel)
  if (!journey || modal.value || settingsOpen.value || document.hidden) return
  const crossedCell = advanceTravelClock(journey, seconds, mapGrid)
  townMap.value?.setPawnPosition(journey.position)
  if (!crossedCell) return
  game.minutes += 1
  journey.position = pointAtDistance(journey.route, journey.elapsedMinutes * mapGrid.cellSize / (mapGrid.minutesPerCell || 1))

  journey.secondsElapsed += 1
  const event = eventForTravelTick(journey, game.completedQuests)
  if (event === 'bandits') {
    audio.play(encounterCue('bad'))
    game.health = 68
    const stolen = robPlayer(game)
    completeQuest(QUEST.BANDIT_AMBUSH_SURVIVED)
    journey.pausedForEvent = true
    modal.value = 'event'
    note('events.bandits', { coins: stolen })
    return
  }
  if (event === 'roadTraveler') { audio.play(encounterCue('neutral')); note('events.roadTraveler') }

  if (journey.elapsedMinutes >= journey.totalMinutes) {
    const { destinationId, totalMinutes, pending } = journey
    game.townPosition = journey.route.at(-1)
    if (destinationId === 'road') { game.travel = null; return }
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
  if (!endDailyJob(game, 'wood')) return
  game.minutes += result.minutes
  game.coins += result.coins
  if (result.coins > 0) audio.play('coins')
  note('events.wood', { coins: result.coins, pieces: result.pieces, quality: result.average })
  modal.value = null
}

function closeModal() {
  if (modal.value === 'wood') endDailyJob(game, 'wood', 'cancelled')
  modal.value = null
  if (game.travel?.pausedForEvent) game.travel.pausedForEvent = false
}

function work(kind) {
  if (!jobUnlocked('tavern', kind)) return
  if (kind !== 'dishes' || modal.value !== 'dishes' || game.location !== 'tavern') return
  if (!startDailyJob(game, 'dishes')) { modal.value = 'dishesDone'; return }
  endDailyJob(game, 'dishes')
  game.minutes += 60
  game.coins += DISHES_PAY
  audio.play('dishes')
  audio.play('plate')
  audio.play('coins')
  note('events.dishes', { coins: DISHES_PAY })
  modal.value = null
}

function makeTradeOffer(draft) {
  tradeAgreement.value = null
  if (modal.value !== 'trade' || !['market', 'tavern'].includes(game.location) || !actionUnlocked(game.location, 'trade')) return
  refreshMerchantStock(game)
  const quote = quoteTrade(game, activeMerchant.value, draft)
  if (quote.error) { note('events.tradeError', { reason: t('trade.errors.' + quote.error) }); return }
  if (game.reputation <= -3) { note('events.refuse'); return }
  if (draft.percent < merchantMinimum(game.reputation)) {
    game.reputation = Math.max(-3, game.reputation - 1)
    note('events.insult')
    return
  }
  tradeAgreement.value = { merchantId: activeMerchant.value, fingerprint: offerFingerprint(draft), net: quote.net }
  note('events.tradeOfferAccepted')
}
function confirmTrade(draft) {
  if (modal.value !== 'trade' || !['market', 'tavern'].includes(game.location) || !actionUnlocked(game.location, 'trade')) return
  const agreement = tradeAgreement.value
  tradeAgreement.value = null
  const result = executeTrade(game, activeMerchant.value, draft, agreement)
  if (result.error) { note('events.tradeError', { reason: t('trade.errors.' + result.error) }); return }
  audio.play('coins')
  const supplies = questById(QUEST.IRON_STOCK_BOUGHT).requiredItems
  if (!hasQuest(game.completedQuests, QUEST.IRON_STOCK_BOUGHT) && hasRequiredItems(game.inventory, supplies)) completeQuest(QUEST.IRON_STOCK_BOUGHT)
  note('events.tradeCompleted', { paid: Math.max(0, result.net), received: Math.max(0, -result.net) })
}

function tip() {
  tradeAgreement.value = null
  if (!['market', 'tavern'].includes(game.location) || !actionUnlocked(game.location, 'trade')) return
  if (game.coins < MERCHANT_TIP) {
    note('events.needTip')
    return
  }
  if (game.reputation <= -3) {
    note('events.refuseTip')
    return
  }
  game.coins -= MERCHANT_TIP
  audio.play('coins')
  game.reputation = Math.min(3, game.reputation + 1)
  note('events.tipped')
}

function forge() {
  openWorkshop('crucible')
}

function openHomeModal(name) {
  if (forgeLesson.value) return
  if (name === 'sleep' && mapView.value === 'town' && !atPlace('smithy')) return
  if (name === 'sleep' && mapView.value === 'forge' && forgeMap.value && !forgeMap.value.isNear('sonBed')) { closeModal(); forgeMap.value.approach('sonBed', () => { modal.value = name }); return }
  modal.value = name
}

function rest(hours) {
  if (game.workshop.working) return
  if (!atPlace('smithy') || !isUnlocked(game.completedQuests, 'hud', 'sleep') || ![1, 2, 4, 8].includes(hours)) return
  game.minutes += hours * 60
  note('events.waited', { hours })
  modal.value = null
}
function eat(instanceId) {
  const food = game.inventory.find(entry => entry.id === instanceId)
  if (modal.value !== 'inventory' || !food || !eatItem(game, instanceId)) return
  note('events.consumed', { item: t(items[food.itemId].nameKey) })
}

function sleep() {
  if (game.workshop.working) return
  if (!atPlace('smithy') || !isUnlocked(game.completedQuests, 'hud', 'sleep') || !canSleep(game)) return
  const nextMorning = nextMorningMinutes(game.minutes, sleepNeedPercent(game))
  // Resolve the new day's forecast before jumping the clock, including long sleeps.
  const wakeWeather = weatherAt(nextMorning, game.weatherSeed)
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
  refreshAudioScene(wakeWeather.kind)
}

function acceptFatherErrand() {
  if (!hasQuest(game.completedQuests, QUEST.FATHER_MET) || hasQuest(game.completedQuests, QUEST.IRON_ERRAND_ACCEPTED)) return
  completeQuest(QUEST.IRON_ERRAND_ACCEPTED)
  note('events.start')
}

function reset() {
  Object.assign(game, initialState())
  idleClockSeconds = 0
  mapView.value = 'town'
  tradeFeedback.value = null
  townMenu.value = null
  cloudVisible.value = true
  tavernReply.value = null
  modal.value = null
}
function exportSave() {
  displayError.value = ''
  try {
    const blob = new Blob([JSON.stringify(game, null, 2) + '\n'], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `briarwick-save-day-${dayNumber(game.minutes)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  } catch {
    displayError.value = t('interface.exportFailed')
  }
}
function openImportPicker() {
  displayError.value = ''
  importInput.value?.click()
}
async function importSaveFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  displayError.value = ''
  if (file.size > 10 * 1024 * 1024) { displayError.value = t('interface.importTooLarge'); return }
  try {
    const text = await file.text()
    let parsed
    try { parsed = JSON.parse(text) }
    catch { displayError.value = t('interface.importInvalid'); return }
    const imported = restoreSave(parsed)
    if (!imported) { displayError.value = t('interface.importInvalid'); return }
    importPending = true
    localStorage.setItem(SAVE_KEY, JSON.stringify(imported))
    window.location.reload()
  } catch {
    importPending = false
    displayError.value = t('interface.importFailed')
  }
}
</script>

<template>
  <main class="game-shell">
    <MapLoadingScreen v-if="loadingMap" :map-id="loadingMap" :returning="returningPlayer" :first-visit="loadingFirstVisit" :completed="loadingProgress.completed" :total="loadingProgress.total" />
    <section ref="gameFrame" class="map-frame game-window map-frame--expanded" :class="{ 'map-frame--fullscreen': fullscreenGame }" :aria-label="t('app.title')">
      <div id="game-animation-layer" class="game-animation-layer" aria-hidden="true"></div>
      <div ref="gameHeader" class="game-header">
        <GameToolbar :map-name="t(mapView === 'town' ? 'map.townName' : 'map.forgeName')" :town="mapView === 'town'" :day="day" :clock="clock" :fullscreen="fullscreenGame" :mobile="mobileGame" :muted="audioSettings.muted" :busy="!!forgeLesson || !!modal || settingsOpen || editingMap || !game.profileChosen" :completed-quests="game.completedQuests" :can-edit="mapEditingAvailable && mapView === 'town'" :editing="editingMap" @modal="openHomeModal" @fullscreen="toggleGameFullscreen" @mute="audioSettings.muted = !audioSettings.muted" @settings="settingsOpen = !settingsOpen" @editor="editingMap = !editingMap" @export="exportSave" @import="openImportPicker" />
        <input ref="importInput" type="file" accept=".json,application/json" hidden :aria-label="t('interface.importSave')" @change="importSaveFile" />
      </div>
      <div class="map-canvas">
        <span v-if="displayError" class="game-display-error" role="status">{{ displayError }}</span>
        <MapEditor v-if="editingMap && mapView === 'town'" @close="editingMap = false" />
        <template v-else>
            <TownMap v-if="mapView === 'town'" ref="townMap" :avatar-src="game.avatarSrc" :ambience-paused="settingsOpen" :raining="weatherAt(game.minutes, game.weatherSeed).kind === 'rain'" :smithy-entry-locked="!canEnterSmithy(game)" :current-location="atPlace(game.location) ? game.location : ''" :pawn-position="pawnPosition" :travel="game.travel" :building-tiers="game.buildingTiers" :dialogue-blocked="!!tutorialQuest && !cloudReady" :selected-id="game.selected" :tutorial-stage="tutorialStage" :completed-quests="game.completedQuests" @menu="townMenu = $event" @select="selectPlace" @action="handleAction" @job="handleJob" @road="startRoadTravel" />
            <ForgeMap v-else ref="forgeMap" :avatar-src="game.avatarSrc" :guiding="!!forgeLesson || !!tutorialQuest" :occupied="!!modal" :paused="settingsOpen" :dialogue-blocked="!!forgeLesson || !!tutorialQuest && !cloudReady" :completed-quests="game.completedQuests" :workshop="game.workshop" :storehouse="game.storehouse" :inventory="game.inventory" :feedback="workshopFeedback" @command="workshopCommand" @station="openWorkshop" @town="leaveForge()" @modal="openHomeModal" />
            <MapWeather :minutes="game.minutes" :seed="game.weatherSeed" :outdoor="mapView === 'town'" />
            <button v-if="tutorialQuest" class="cloud-toggle" type="button" :aria-label="t(cloudVisible ? 'map.hideCloud' : 'map.showCloud')" :title="t(cloudVisible ? 'map.hideCloud' : 'map.showCloud')" @click="cloudVisible = !cloudVisible">{{ cloudVisible ? '−' : '+' }}</button>
            <TutorialCloud :hidden="!cloudVisible" :quest="tutorialQuest" :marker-open="townMenu === 'smithy'" @ready="cloudReady = $event" @accept="acceptFatherErrand" />
            <button class="inventory-map-button" type="button" :disabled="!!forgeLesson || !!modal || (!!tutorialQuest && !cloudReady)" :aria-label="t('inventory.open')" :title="t('inventory.open')" @click="modal = 'inventory'"><svg viewBox="0 0 84 60" aria-hidden="true"><path d="M42 2 81 30 42 58 3 30Z" fill="#394535" stroke="#c3aa70" stroke-width="2" /><image href="/images/items/leather_backpack.svg" x="23" y="10" width="38" height="40" /></svg></button>
            <ForgeLesson v-if="forgeLesson && mapView === 'forge'" :lesson="forgeLesson" :paused="settingsOpen" @complete="completeForgeLesson" />
            <WorkshopDialog v-if="!forgeLesson && modal === 'workshop' && mapView === 'forge'" embedded @assembly-busy="assemblyBusy = $event" :paused="settingsOpen" :game="game" :station="workshopStation" :feedback="workshopFeedback" @command="workshopCommand" @station="openWorkshop" @close="closeModal" />
            <PouringGame v-if="modal === 'pouring'" :workshop="game.workshop" :paused="settingsOpen" @command="workshopCommand" @close="closeModal" />
            <GameModal :merchant-id="activeMerchant" :audio-paused="settingsOpen" :modal="['workshop', 'pouring'].includes(modal) ? null : modal" :game="game" :selected-place="selectedPlace" :trip-minutes="tripMinutes"
              :trade-agreement="tradeAgreement" :stamina="stamina" :sleep-need="sleepNeed"
              :mood-key="moodKey" :trade-feedback="tradeFeedback" :tavern-reply="tavernReply"
              @eat="eat" @rest="rest" @equip="game.equipment = $event" @market-notice-read="readMarketNotice" @close="closeModal" @modal="modal = $event" @reset="reset" @trade-offer="makeTradeOffer" @trade-confirm="confirmTrade" @tip="tip"
              @update:skip-woodcutting-intro="game.skipWoodcuttingIntro = $event" @work="work" @wood-finished="finishWoodcutting" @tavern-answer="answerInnkeeper" @forge="forge" @sleep="sleep" />            <CharacterSetup v-if="!game.profileChosen && !loadingMap" @complete="finishCharacterSetup" />
        </template>
      </div>
      <AudioSettings v-if="settingsOpen" :settings="audioSettings" :status="audio.status" @change="Object.assign(audioSettings, $event)" @enable="audio.unlock()" @preview="audio.preview($event)" @close="settingsOpen = false" />
      <footer ref="gameFooter" class="game-footer">
        <MapHud :avatar-src="game.avatarSrc" :player-name="game.playerName" :at-home="atPlace('smithy') && !game.workshop.working" :busy="!!forgeLesson || !!modal && modal !== 'workshop' || settingsOpen || !game.profileChosen" :health="game.health" :stamina="stamina" :sleep-need="sleepNeed" :coins="game.coins" :hunger="Math.round(game.hunger)" :completed-quests="game.completedQuests" :traveling="!!game.travel" @modal="openHomeModal" />
        <span class="game-location-caption"><i class="location-dot"></i>{{ game.travel?.destinationId === 'road' || !game.travel && !atPlace(game.location) ? t('map.onRoadCell') : game.travel ? t('map.onRoad', { place: t('places.' + game.travel.destinationId + '.name') }) : t('places.' + currentPlace.id + '.name') }}</span>
      </footer>
    </section>
  </main>
</template>
