import { normalizeDesign, weaponStats, statsForEntry } from './weapon-design'
import catalog from './data/items.json'
import merchants from './data/merchants.json'
export const items = Object.fromEntries(catalog.map(item => [item.id, item]))
export const equipmentSlots = ['helmet', 'amulet', 'weapon', 'shield', 'armor', 'shoes', 'back', 'waist', 'tool']
export const CARRY_CAPACITY_KG = 30
export function startingInventory() {
  return [...['leather_apron', 'leather_shoes', 'crude_hammer'].map(itemId => ({ id: 'starter-' + itemId, itemId, quantity: 1 })), { id: 'starter-bread', itemId: 'bread', quantity: 3 }]
}
export function startingEquipment() { return { armor: 'starter-leather_apron', shoes: 'starter-leather_shoes', tool: 'starter-crude_hammer' } }
export function merchantInventory() { return Object.fromEntries(merchants.map(merchant => [merchant.id, merchant.stock.map(entry => ({ ...entry }))])) }
export const entryWeight = entry => weaponStats(entry.craft?.design, entry.craft)?.weight ?? entry.mass ?? items[entry.itemId]?.weightKg ?? 0
export function carriedWeight(inventory) { return Math.round(inventory.reduce((sum, entry) => sum + entryWeight(entry) * entry.quantity, 0) * 1000) / 1000 }
export function canCarry(inventory, itemId, quantity = 1) {
  return !!items[itemId] && Number.isInteger(quantity) && quantity > 0
    && carriedWeight(inventory) + items[itemId].weightKg * quantity <= CARRY_CAPACITY_KG
}
export function equippedItem(inventory, equipment, slot) { const entry = inventory.find(entry => entry.id === equipment[slot]); return entry ? { ...items[entry.itemId], hands: statsForEntry(entry)?.hands ?? items[entry.itemId].hands } : undefined }
export function slotBlocked(inventory, equipment, slot) {
  const weapon = equippedItem(inventory, equipment, 'weapon')
  return slot === 'shield' && weapon?.hands === 2 || slot === 'waist' && weapon?.weaponType !== 'bow'
}
export function equipItem(inventory, equipment, instanceId, slot) {
  const entry = inventory.find(entry => entry.id === instanceId)
  const item = entry ? { ...items[entry.itemId], hands: statsForEntry(entry)?.hands ?? items[entry.itemId].hands } : null
  if (!item || item.equipSlot !== slot || !equipmentSlots.includes(slot) || slotBlocked(inventory, equipment, slot)) return null
  const next = { ...equipment, [slot]: instanceId }
  if (slot === 'weapon' && item.hands === 2) delete next.shield
  if (slot === 'weapon' && item.weaponType !== 'bow') delete next.waist
  return next
}
export function unequipItem(equipment, slot) {
  const next = { ...equipment }; delete next[slot]
  if (slot === 'weapon') delete next.waist
  return next
}
export function normalizeInventory(saved) {
  if (!Array.isArray(saved)) return startingInventory()
  const ids = new Set()
  return saved.filter(entry => entry && typeof entry.id === 'string' && !ids.has(entry.id) && items[entry.itemId] && Number.isInteger(entry.quantity) && entry.quantity > 0 && (ids.add(entry.id), true))
    .map(({ id, itemId, quantity, craft, castingQuality, design, units, mass }) => {
      const entry = { id, itemId, quantity }
      if (['iron_ingot', 'copper_ingot'].includes(itemId) && Number.isFinite(castingQuality)) entry.castingQuality = Math.max(0, Math.min(100, castingQuality))
      if (['iron_ingot', 'copper_ingot'].includes(itemId) && normalizeDesign(design)) Object.assign(entry, { design: normalizeDesign(design), units: Math.max(1, Math.min(12, units || 1)), mass: Math.max(.1, Math.min(20, mass || 1)) })
      if (['dagger', 'custom_weapon'].includes(itemId) && craft && [craft.work, craft.assembly, craft.sharpness].every(Array.isArray)) {
        const design = normalizeDesign(craft.design), count = design ? design.sections.length * 2 : 16
        const cells = (values, count, max) => Array.from({ length: count }, (_, i) => Math.max(0, Math.min(max, Number.isFinite(values[i]) ? values[i] : 0)))
        entry.craft = { work: cells(craft.work, count, 200), assembly: cells(craft.assembly, 3, 100), sharpness: cells(craft.sharpness, count, 100), quench: Math.max(0, Math.min(100, Number(craft.quench) || 0)), quality: Math.max(0, Math.min(100, Number(craft.quality) || 0)) }
        if (design) Object.assign(entry.craft, { design, mass: Math.max(.1, Math.min(20, craft.mass || design.ingots)) })
        if (craft.assembly.length === 2) entry.craft.assembly[2] = (entry.craft.assembly[0] + entry.craft.assembly[1]) / 2
        entry.craft.assemblyCeiling = Number.isFinite(craft.assemblyCeiling) ? Math.max(0, Math.min(100, craft.assemblyCeiling)) : 100
        entry.craft.castingQuality = Number.isFinite(craft.castingQuality) ? Math.max(0, Math.min(100, craft.castingQuality)) : 100
        entry.craft.heatDamage = Math.max(0, Math.min(20, Number(craft.heatDamage) || 0))
      }
      return entry
    })
}
export function normalizeEquipment(inventory, saved) {
  let next = {}
  for (const slot of equipmentSlots) {
    if (saved?.[slot]) next = equipItem(inventory, next, saved[slot], slot) || next
  }
  return next
}

export function itemQuantity(inventory, itemId) { return inventory.filter(entry => entry.itemId === itemId).reduce((sum, entry) => sum + entry.quantity, 0) }
export function hasRequiredItems(inventory, requirements) { return requirements.every(entry => itemQuantity(inventory, entry.itemId) >= entry.quantity) }
export function consumeItems(inventory, requirements) {
  if (!hasRequiredItems(inventory, requirements)) return null
  const remaining = inventory.map(entry => ({ ...entry }))
  for (const requirement of requirements) {
    let needed = requirement.quantity
    for (const entry of remaining.filter(entry => entry.itemId === requirement.itemId)) {
      const amount = Math.min(needed, entry.quantity); entry.quantity -= amount; needed -= amount
    }
  }
  return remaining.filter(entry => entry.quantity > 0)
}
