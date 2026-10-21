export const SAVE_KEY = 'briarwick-demo-v1'

export const places = [
  { id: 'smithy', name: 'Blacksmith', sub: 'Your father’s forge', x: 552, y: 328, available: true, icon: '⚒', description: 'The forge is warm even before dawn. Your father works here, a few steps from the market.' },
  { id: 'market', name: 'Market', sub: 'Stalls & merchants', x: 428, y: 306, available: true, icon: '◈', description: 'Traders fill the little market lane. Prices depend on patience and the seller’s opinion of you.' },
  { id: 'square', name: 'Town Square', sub: 'Work & notices', x: 382, y: 418, available: true, icon: '✧', description: 'Briarwick’s meeting place. Notices, odd jobs, and the woodpile gather here.' },
  { id: 'tavern', name: 'Tavern', sub: 'The Copper Cup', x: 260, y: 351, available: true, icon: '✦', description: 'The Copper Cup always has dishes to wash. The work is reliable, even if the pay is poor.' },
  { id: 'barracks', name: 'Barracks', sub: 'Coming later', x: 648, y: 188, available: false, icon: '◇', description: 'A modest watch post that will matter when war reaches Briarwick.' },
  { id: 'chapel', name: 'Chapel', sub: 'Coming later', x: 183, y: 206, available: false, icon: '◇', description: 'A quiet place on the northern rise.' },
  { id: 'gate', name: 'South Gate', sub: 'Coming later', x: 538, y: 527, available: false, icon: '◇', description: 'The road beyond town leads into a much larger world.' },
]

export const initialState = () => ({
  version: 1,
  location: 'smithy',
  selected: 'smithy',
  minutes: 8 * 60,
  awakeSince: 8 * 60,
  health: 100,
  coins: 12,
  reputation: 0,
  materials: false,
  dagger: false,
  stage: 'errand',
  event: 'Father needs iron stock from the market. It is a short walk from the forge.',
  journal: ['Father sent you to the market for iron stock.'],
})

export function travelMinutes(fromId, toId) {
  if (fromId === toId) return 0
  const from = places.find((place) => place.id === fromId)
  const to = places.find((place) => place.id === toId)
  if (!from || !to) return 0
  return Math.max(5, Math.ceil(Math.hypot(from.x - to.x, from.y - to.y) / 70) * 3)
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
    if (saved?.version === 1 && places.some((place) => place.id === saved.location)) {
      return { ...initialState(), ...saved }
    }
  } catch { /* Ignore broken local saves. */ }
  return initialState()
}
