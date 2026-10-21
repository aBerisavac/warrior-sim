import { items } from './inventory'
export const HUNGER_PER_HOUR = 4
export const SLEEP_THRESHOLD = 60
export function sleepNeedPercent(state) { return Math.min(100, Math.max(0, (state.minutes - state.awakeSince) / 2880 * 100)) }
export function canSleep(state) { return sleepNeedPercent(state) >= SLEEP_THRESHOLD }
export function updateHunger(state) {
  const elapsed = Math.max(0, state.minutes - state.hungerUpdatedAt)
  state.hunger = Math.max(0, Math.min(100, state.hunger + elapsed / 60 * HUNGER_PER_HOUR))
  state.hungerUpdatedAt = state.minutes
}
export function eatItem(state, instanceId) {
  updateHunger(state)
  const entry = state.inventory.find(item => item.id === instanceId)
  const food = items[entry?.itemId]
  if (!food || food.category !== 'food' || !food.hungerRestore || !entry.quantity || state.hunger <= 0 && food.useAction !== 'drink') return false
  state.hunger = Math.max(0, state.hunger - food.hungerRestore)
  entry.quantity -= 1
  state.inventory = state.inventory.filter(item => item.quantity > 0)
  return true
}
export function nextMorningMinutes(minutes) {
  const morning = Math.floor(minutes / 1440) * 1440 + 7 * 60
  return morning > minutes ? morning : morning + 1440
}
