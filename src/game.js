import { normalizeDailyJobs } from './daily-jobs'
import { newWorkshop, normalizeWorkshop } from './workshop'
import { initialRestockCycles, refreshMerchantStock } from './merchants'
import { startingInventory, startingEquipment, normalizeInventory, normalizeEquipment, merchantInventory, items } from './inventory'
import placesData from './data/places.json'
import { hasQuest, isUnlocked, migrateCompletedQuests, QUEST, stageFromQuests } from './progression'
import { placePoint, placeMarkerPoint, routeBetween, mapGrid } from './routes'

export const SAVE_KEY = 'briarwick-demo-v1'
export const places = placesData.map((place) => ({ ...place, ...placeMarkerPoint(place.id) }))
export const FORGE_COAL_CAPACITY = 6

export const initialState = () => ({
  version: 12,
  leftHomeForErrand: false,
  workshop: newWorkshop(),
  storehouse: [{ id: 'store-coal', itemId: 'coal', quantity: 12 }],
  hunger: 20,
  hungerUpdatedAt: 480,
  currencyVersion: 1,
  inventory: startingInventory(),
  equipment: startingEquipment(),
  merchantInventories: merchantInventory(),
  merchantRestockCycles: initialRestockCycles(),
  mapRevision: mapGrid.revision,
  mapId: 'town',
  buildingTiers: {},
  skipWoodcuttingIntro: false,
  dailyJobs: {},
  location: 'smithy',
  selected: 'smithy',
  travel: null,
  minutes: 8 * 60,
  awakeSince: 8 * 60,
  health: 100,
  coins: 120,
  forgeCoal: 0,
  coalStock: 0,
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
    if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(saved?.version) && places.some((place) => place.id === saved.location)) {
      const pristineOpening = saved.version < 3 && saved.stage === 'errand' && saved.location === 'smithy' && saved.minutes === 480 && saved.health === 100 && saved.coins === 12 && !saved.materials && !saved.dagger && (!saved.forgeCoal || saved.forgeCoal === 0)
      if (pristineOpening) return initialState()
      const completedQuests = migrateCompletedQuests(saved)
      const state = { ...initialState(), ...saved, version: 12, completedQuests }
      state.leftHomeForErrand = saved.leftHomeForErrand === true || hasQuest(completedQuests, QUEST.IRON_ERRAND_ACCEPTED) && (saved.location !== 'smithy' || !!saved.travel || hasQuest(completedQuests, QUEST.BANDIT_AMBUSH_SURVIVED))
      state.workshop = normalizeWorkshop(saved.workshop)
      state.storehouse = saved.version >= 12 ? normalizeInventory(saved.storehouse || []).filter(e => items[e.itemId]?.category === 'materials') : (saved.coalStock > 0 ? [{ id: 'store-coal', itemId: 'coal', quantity: Math.floor(saved.coalStock) }] : [])
      state.coalStock = 0
      if (saved.version < 12) state.workshop.fuel = Math.max(0, Math.min(6, saved.forgeCoal || 0)) * 120
      state.coins = Number.isFinite(saved.coins) ? Math.max(0, Math.round(saved.coins * (saved.currencyVersion === 1 ? 1 : 10))) : 120
      state.currencyVersion = 1
      if (saved.currencyVersion !== 1) {
        const convertEntry = entry => {
          if (!entry || typeof entry !== 'object') return entry
          const params = { ...entry.params }
          for (const key of ['coins', 'price', 'paid', 'received']) if (Number.isFinite(params[key])) params[key] = Math.round(params[key] * 10)
          return { ...entry, params }
        }
        state.event = convertEntry(state.event)
        if (Array.isArray(state.journal)) state.journal = state.journal.map(convertEntry)
      }
      state.dailyJobs = normalizeDailyJobs(saved.dailyJobs, state.minutes)
      state.skipWoodcuttingIntro = saved.skipWoodcuttingIntro === true
      state.inventory = normalizeInventory(Array.isArray(saved.inventory) ? saved.inventory.map(entry => entry?.itemId === 'iron_stock' ? { ...entry, itemId: 'iron_ore', quantity: entry.quantity * 4 } : entry) : saved.inventory)
      state.hunger = Number.isFinite(saved.hunger) ? Math.max(0, Math.min(100, saved.hunger)) : 20
      state.hungerUpdatedAt = Number.isFinite(saved.hungerUpdatedAt) && saved.hungerUpdatedAt <= state.minutes ? saved.hungerUpdatedAt : state.minutes
      if (saved.version < 11 && Array.isArray(saved.inventory) && !state.inventory.some(entry => entry.itemId === 'bread')) state.inventory.push({ id: 'starter-bread', itemId: 'bread', quantity: 3 })
      state.equipment = normalizeEquipment(state.inventory, saved.equipment ?? startingEquipment())
      state.merchantInventories = merchantInventory()
      for (const [id, stock] of Object.entries(state.merchantInventories)) {
        const savedStock = Array.isArray(saved.merchantInventories?.[id]) ? saved.merchantInventories[id] : []
        state.merchantInventories[id] = stock.map(entry => {
          const quantity = savedStock.find(item => item?.itemId === entry.itemId || (entry.itemId === 'iron_ore' && item?.itemId === 'iron_stock'))?.quantity
          return { ...entry, quantity: Number.isInteger(quantity) && quantity >= 0 ? quantity : entry.quantity }
        })
        for (const entry of savedStock) {
          if (items[entry?.itemId] && Number.isInteger(entry.quantity) && entry.quantity >= 0 && !state.merchantInventories[id].some(item => item.itemId === entry.itemId)) state.merchantInventories[id].push({ itemId: entry.itemId, quantity: entry.quantity })
        }
      }
      for (const [id, stock] of Object.entries(state.merchantInventories)) {
        for (const supply of stock) {
          const savedSupply = saved.merchantInventories?.[id]?.find(entry => entry.itemId === supply.itemId)
          const lots = normalizeInventory(Array.isArray(savedSupply?.lots) ? savedSupply.lots : [])
          let remaining = supply.quantity
          supply.lots = lots.map(lot => { const quantity = Math.min(remaining, lot.quantity); remaining -= quantity; return { ...lot, quantity } }).filter(lot => lot.quantity > 0)
          if (supply.itemId === 'custom_weapon') supply.quantity = supply.lots.reduce((n, lot) => n + lot.quantity, 0)
        }
      }
      state.merchantRestockCycles = { ...initialRestockCycles(state.minutes) }
      for (const id of Object.keys(state.merchantRestockCycles)) {
        const cycle = saved.merchantRestockCycles?.[id]
        if (Number.isInteger(cycle) && cycle >= 0) state.merchantRestockCycles[id] = cycle
      }
      refreshMerchantStock(state)
      delete state.gameplayUnlocked
      delete state.marketUnlocked
      const journey = state.travel
      if (journey && saved.mapRevision === 7 && [8, 9].includes(mapGrid.revision)) {
        const offset = 5 * mapGrid.cellSize
        journey.route = journey.route?.map(point => ({ x: point.x + offset, y: point.y + offset }))
        if (journey.position) journey.position = { x: journey.position.x + offset, y: journey.position.y + offset }
      }
      if (journey && journey.minutesPerCell !== (mapGrid.minutesPerCell || 1) && Number.isFinite(journey.totalMinutes) && Number.isFinite(journey.elapsedMinutes)) {
        const timeRatio = (mapGrid.minutesPerCell || 1) / (journey.minutesPerCell || 1)
        journey.totalMinutes *= timeRatio
        journey.elapsedMinutes *= timeRatio
        journey.minutesPerCell = mapGrid.minutesPerCell || 1
      }
      if (saved.version < 8 || (saved.mapRevision !== mapGrid.revision && !(saved.mapRevision === 7 && [8, 9].includes(mapGrid.revision)) && !(saved.mapRevision === 8 && mapGrid.revision === 9)) || !journey?.destinationId || !places.some((place) => place.id === journey.destinationId && place.available)
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
      if (!Array.isArray(saved.inventory)) {
        if (state.dagger) state.inventory.push({ id: 'quest-dagger', itemId: 'dagger', quantity: 1 })

      }
      if (saved.version < 9 && state.materials && !state.dagger) {
        for (const itemId of ['iron_ore', 'coal']) {
          const owned = state.inventory.filter(entry => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0)
          if (owned < 4) {
            const existing = state.inventory.find(entry => entry.itemId === itemId)
            if (existing) existing.quantity += 4 - owned
            else state.inventory.push({ id: 'migrated-' + itemId, itemId, quantity: 4 - owned })
          }
        }
      }
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
