import definitions from './data/merchants.json'
import { items, carriedWeight, CARRY_CAPACITY_KG } from './inventory'
import { designRecipe } from './weapon-design'
export const MARKET_MERCHANT = 'market_smith_supplies'
export const INN_MERCHANT = 'oswin_inn'
export const merchantAt = placeId => definitions.find(m => m.placeId === placeId)?.id || MARKET_MERCHANT
export const merchantSpeaker = id => definitions.find(m => m.id === id)?.speaker || 'merchant'
export function buyUnitPrice(itemId, merchantId = MARKET_MERCHANT) {
  const item = items[itemId], merchant = definitions.find(m => m.id === merchantId)
  return item ? Math.max(1, Math.round(item.basePrice * (merchant?.buyModifiers?.[item.category] ?? 1))) : 0
}
export function craftedMaterialCost(entry) {
  if (!entry?.craft || !['dagger', 'custom_weapon'].includes(entry.itemId)) return null
  const recipe = designRecipe(entry.craft.design) || { ore: 'iron_ore', oreCount: 4, carbon: 1, fuel: 1, fittings: ['dagger_guard', 'dagger_handle', 'dagger_pommel'] }
  return recipe.oreCount * buyUnitPrice(recipe.ore) + (recipe.carbon + recipe.fuel) * buyUnitPrice('coal')
    + recipe.fittings.reduce((total, itemId) => total + buyUnitPrice(itemId), 0)
}
export function saleUnitPrice(itemOrId, merchantId = MARKET_MERCHANT) {
  const entry = typeof itemOrId === 'string' ? null : itemOrId
  const itemId = entry?.itemId || itemOrId
  const materials = craftedMaterialCost(entry)
  if (materials !== null) {
    const quality = Number.isFinite(entry.craft.quality) ? Math.max(0, Math.min(100, entry.craft.quality)) : 100
    return Math.round(materials * 1.2 * quality / 100)
  }
  const item = items[itemId], merchant = definitions.find(m => m.id === merchantId)
  return item ? Math.floor(item.basePrice * .5 * (merchant?.sellModifiers?.[item.category] ?? 1)) : 0
}
const cycleAt = (merchant, minutes) => Math.floor(Math.max(0, minutes) / (merchant.restockDays * 1440))
export function initialRestockCycles(minutes = 0) {
  return Object.fromEntries(definitions.map(merchant => [merchant.id, cycleAt(merchant, minutes)]))
}
export function refreshMerchantStock(state) {
  for (const merchant of definitions) {
    const current = cycleAt(merchant, state.minutes)
    const last = state.merchantRestockCycles[merchant.id]
    if (!Number.isInteger(last) || last > current) state.merchantRestockCycles[merchant.id] = current
    else if (current > last) {
      state.merchantInventories[merchant.id] = [...merchant.stock.map(entry => ({ ...entry, lots: state.merchantInventories[merchant.id].find(current => current.itemId === entry.itemId)?.lots || [], quantity: Math.max(entry.quantity, state.merchantInventories[merchant.id].find(current => current.itemId === entry.itemId)?.quantity || 0) })), ...state.merchantInventories[merchant.id].filter(entry => !merchant.stock.some(supply => supply.itemId === entry.itemId))]
      state.merchantRestockCycles[merchant.id] = current
    }
  }
}
export function nextRestockDay(id, minutes) {
  const merchant = definitions.find(merchant => merchant.id === id)
  return (cycleAt(merchant, minutes) + 1) * merchant.restockDays + 1
}
export function offerFingerprint(draft) {
  return JSON.stringify({ buy: [...draft.buy].sort((a,b) => a.itemId.localeCompare(b.itemId)), sell: [...draft.sell].sort((a,b) => a.instanceId.localeCompare(b.instanceId)), percent: draft.percent })
}
export function quoteTrade(state, merchantId, draft) {
  const fail = error => ({ error })
  if (!draft || !Array.isArray(draft.buy) || !Array.isArray(draft.sell) || !Number.isInteger(draft.percent) || draft.percent < 75 || draft.percent > 150) return fail('invalidBasket')
  if (!draft.buy.length && !draft.sell.length) return fail('emptyBasket')
  const stock = state.merchantInventories[merchantId]
  if (!Array.isArray(stock)) return fail('invalidBasket')
  let buying = 0, selling = 0
  const inventory = state.inventory.map(entry => ({ ...entry }))
  const used = new Set()
  for (const entry of draft.sell) {
    if (!entry || used.has(entry.instanceId) || !Number.isInteger(entry.quantity) || entry.quantity < 1) return fail('invalidBasket')
    used.add(entry.instanceId)
    const owned = inventory.find(item => item.id === entry.instanceId)
    if (!owned || !items[owned.itemId] || owned.quantity < entry.quantity) return fail('itemsChanged')
    if (Object.values(state.equipment).includes(owned.id)) return fail('equippedItem')
    selling += saleUnitPrice(owned, merchantId) * entry.quantity
    owned.quantity -= entry.quantity
  }
  used.clear()
  for (const entry of draft.buy) {
    if (!entry || used.has(entry.itemId) || !items[entry.itemId] || !Number.isInteger(entry.quantity) || entry.quantity < 1) return fail('invalidBasket')
    used.add(entry.itemId)
    if (!stock.some(item => item.itemId === entry.itemId && item.quantity >= entry.quantity)) return fail('soldOut')
    if (draft.sell.some(sale => state.inventory.find(item => item.id === sale.instanceId)?.itemId === entry.itemId)) return fail('sameItem')
    buying += buyUnitPrice(entry.itemId, merchantId) * entry.quantity
    let remaining = entry.quantity
    // Unique crafted weapons and cast blanks retain their provenance on resale.
    for (const lot of stock.find(item => item.itemId === entry.itemId).lots || []) {
      if (!remaining) break
      const quantity = Math.min(remaining, lot.quantity)
      let id = 'trade-' + entry.itemId
      while (inventory.some(item => item.id === id)) id += '-new'
      inventory.push({ ...JSON.parse(JSON.stringify(lot)), id, quantity }); remaining -= quantity
    }
    if (remaining) {
      const stack = inventory.find(item => item.itemId === entry.itemId && !item.craft && !item.design && item.castingQuality === undefined)
      if (stack) stack.quantity += remaining
      else {
        let id = 'trade-' + entry.itemId
        while (inventory.some(item => item.id === id)) id += '-new'
        inventory.push({ id, itemId: entry.itemId, quantity: remaining })
      }
    }
  }
  const net = Math.round(buying * draft.percent / 100 - selling * (2 - draft.percent / 100))
  const weight = carriedWeight(inventory)
  const error = weight > CARRY_CAPACITY_KG ? 'inventoryFull' : state.coins < net ? 'needCoins' : null
  return { error, buying, selling, net, weight, inventory: inventory.filter(item => item.quantity > 0) }
}
export function merchantMinimum(reputation) { return Math.max(75, 100 - reputation * 10) }
export function executeTrade(state, merchantId, draft, agreement) {
  refreshMerchantStock(state)
  const quote = quoteTrade(state, merchantId, draft)
  if (quote.error) return quote
  if (state.reputation <= -3) return { error: 'refuse' }
  if (draft.percent < merchantMinimum(state.reputation)) return { error: 'offerRejected' }
  if (!agreement || (agreement.merchantId || MARKET_MERCHANT) !== merchantId || agreement.used || agreement.fingerprint !== offerFingerprint(draft) || agreement.net !== quote.net) return { error: 'offerChanged' }
  const stock = state.merchantInventories[merchantId].map(entry => ({ ...entry }))
  for (const entry of draft.buy) {
    const supply = stock.find(item => item.itemId === entry.itemId); supply.quantity -= entry.quantity
    let remaining = entry.quantity
    supply.lots = (supply.lots || []).map(lot => { const taken = Math.min(remaining, lot.quantity); remaining -= taken; return { ...lot, quantity: lot.quantity - taken } }).filter(lot => lot.quantity > 0)
  }
  for (const sale of draft.sell) {
    const sold = state.inventory.find(entry => entry.id === sale.instanceId), itemId = sold.itemId
    const existing = stock.find(entry => entry.itemId === itemId)
    if (existing) existing.quantity += sale.quantity
    else stock.push({ itemId, quantity: sale.quantity })
    if (sold.craft || sold.design || sold.castingQuality !== undefined) {
      const supply = stock.find(entry => entry.itemId === itemId)
      supply.lots = [...(supply.lots || []), { ...JSON.parse(JSON.stringify(sold)), quantity: sale.quantity }]
    }
  }
  agreement.used = true
  state.inventory = quote.inventory
  state.merchantInventories[merchantId] = stock
  state.coins -= quote.net
  if (draft.percent >= 130) state.reputation = Math.min(3, state.reputation + 1)
  return quote
}
