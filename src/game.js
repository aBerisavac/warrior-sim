import placesData from './data/places.json'
import { hasQuest, isUnlocked, migrateCompletedQuests, QUEST, stageFromQuests } from './progression'
import { placePoint, placeMarkerPoint, routeBetween, mapGrid } from './routes'

export const SAVE_KEY = 'briarwick-demo-v1'
export const places = placesData.map((place) => ({ ...place, ...placeMarkerPoint(place.id) }))
export const FORGE_COAL_CAPACITY = 6

export const initialState = () => ({
  version: 8,
  mapRevision: mapGrid.revision,
  mapId: 'town',
  buildingTiers: {},
  location: 'smithy',
  selected: 'smithy',
  travel: null,
  minutes: 8 * 60,
  awakeSince: 8 * 60,
  health: 100,
  coins: 12,
  forgeCoal: 0,
  coalStock: 12,
  reputation: 0,
  materials: false,
  dagger: false,
  stage: 'intro',
  completedQuests: [],
  event: { key: 'events.intro' },
  journal: [],
})

export function travelMinutes(fromId, toId) {
  return routeBetween(fromId, toId).minutes
}

export function fatigueFactor(state) {
  const awakeHours = (state.minutes - state.awakeSince) / 60
  return Math.max(0.5, 1 - Math.max(0, awakeHours - 16) / 64)
}

export function injuryFactor(state) {
  return 0.7 + 0.3 * state.health / 100
}

export function staminaCap(state) {
  return Math.round(100 * fatigueFactor(state) * injuryFactor(state))
}

export function formatTime(minutes) {
  const hour = Math.floor(minutes / 60) % 24
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function dayNumber(minutes) {
  return Math.floor(minutes / (24 * 60)) + 1
}

export function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY))
    if ([1, 2, 3, 4, 5, 6, 7, 8].includes(saved?.version) && places.some((place) => place.id === saved.location)) {
      const pristineOpening = saved.version < 3 && saved.stage === 'errand' && saved.location === 'smithy' && saved.minutes === 480 && saved.health === 100 && saved.coins === 12 && !saved.materials && !saved.dagger && (!saved.forgeCoal || saved.forgeCoal === 0)
      if (pristineOpening) return initialState()
      const completedQuests = migrateCompletedQuests(saved)
      const state = { ...initialState(), ...saved, version: 8, completedQuests }
      delete state.gameplayUnlocked
      delete state.marketUnlocked
      const journey = state.travel
      if (saved.version < 8 || saved.mapRevision !== mapGrid.revision || !journey?.destinationId || !places.some((place) => place.id === journey.destinationId && place.available)
        || !isUnlocked(completedQuests, 'places', journey.destinationId)
        || !Array.isArray(journey.route) || journey.route.length < 2
        || !journey.route.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        || !Number.isFinite(journey.position?.x) || !Number.isFinite(journey.position?.y)
        || !Number.isFinite(journey.totalMinutes) || journey.totalMinutes <= 0
        || !Number.isFinite(journey.elapsedMinutes) || journey.elapsedMinutes < 0 || journey.elapsedMinutes >= journey.totalMinutes
        || !Number.isFinite(journey.secondsElapsed)) state.travel = null
      state.mapRevision = mapGrid.revision
      state.mapId = 'town'
      const structureIds = new Set([...mapGrid.buildings, ...mapGrid.gates].map((item) => item.id))
      state.buildingTiers = Object.fromEntries(Object.entries(saved.buildingTiers || {})
        .filter(([id, tier]) => structureIds.has(id) && ['straw', 'mud', 'wood', 'stone'].includes(tier)))
      state.stage = stageFromQuests(completedQuests)
      state.materials = hasQuest(completedQuests, QUEST.IRON_STOCK_BOUGHT)
      state.dagger = hasQuest(completedQuests, QUEST.DAGGER_FORGED)
      if (saved.version === 1 || typeof state.event === 'string') {
        const eventKey = {
          errand: 'events.start',
          robbed: 'events.migratedRobbed',
          materials: 'events.migratedMaterials',
          sleep: 'events.forged',
          drafted: 'events.draft',
        }[state.stage] || 'events.start'
        state.event = { key: eventKey }
        state.journal = [state.event]
      }
      if (!Array.isArray(state.journal)) state.journal = [state.event]
      return state
    }
  } catch { /* Ignore broken local saves. */ }
  return initialState()
}
