import { normalizeDesign, designIssues, designRecipe, customUnlocked, METALS, weaponStats, cellNeedsEdge, customGrindingCells } from './weapon-design'
import { grindingContactCells, grindingAngle, grindingRate } from './grinding'
import { questById } from './progression'
import { items, canCarry, consumeItems, itemQuantity, hasRequiredItems, carriedWeight, entryWeight } from './inventory'

export const DAGGER_FITTINGS = ['dagger_guard', 'dagger_handle', 'dagger_pommel']
export const FORGING_TARGET = 900
export const QUENCH_TARGET = 850
export const scoreWork = work => Math.max(0, 100 - Math.abs(100 - work))
export const average = values => values.reduce((a, b) => a + b, 0) / (values.length || 1)
export const COAL_BURN_SECONDS = 480
export const AMBIENT_TEMPERATURE = 25
export const ASSEMBLY_TRAVEL_PX = 30
export const ASSEMBLY_START_OFFSET_PX = 20
export const assemblyPixelAccuracy = offset => Math.max(0, 100 - Math.abs(offset) / ASSEMBLY_TRAVEL_PX * 100)
export const ASSEMBLY_MIN_POSITION = .44
export const ASSEMBLY_MAX_POSITION = .56
export const clampAssemblyPosition = position => Math.max(ASSEMBLY_MIN_POSITION, Math.min(ASSEMBLY_MAX_POSITION, Number.isFinite(position) ? position : .5))
export const assemblyAccuracy = position => Math.max(0, 100 - Math.abs(clampAssemblyPosition(position) - .5) / (ASSEMBLY_MAX_POSITION - .5) * 100)
export const bellowsBoost = temperature => 190 * Math.exp(-Math.max(0, temperature - AMBIENT_TEMPERATURE) / 800)
export function canStartBlacksmithing(game) {
  const w = game.workshop
  if (w.crucible.stage === 'residue') return true
  if (customUnlocked(game)) return !designStartError(game)
  if (w.blade || w.mould || w.crucible.stage !== 'empty') return true
  if (game.completedQuests.includes('iron_errand_accepted') && !game.completedQuests.includes('iron_stock_bought') && !hasRequiredItems(game.inventory, questById('iron_stock_bought').requiredItems)) return false
  if (w.rack.some(i => i.itemId === 'iron_ingot') || itemQuantity(game.inventory, 'iron_ingot')) return true
  const sources = [...game.inventory, ...game.storehouse]
  return ['iron', 'copper'].some(m => itemQuantity(sources, METALS[m].ore) >= METALS[m].orePerUnit)
    && itemQuantity(sources, 'coal') >= (w.fuel > 0 ? 1 : 2)
    && (w.fuel > 0 || itemQuantity(sources, 'coal') > 0)
}
export function designStartError(game) {
  const w = game.workshop
  if (w.crucible.stage === 'residue') return null
  if (!customUnlocked(game) || w.blade?.sourceId || w.blade && !w.blade.design) return null
  const design = w.activeDesign || w.design
  if (!design) return 'designRequired'
  if (designIssues(design).errors.length) return 'invalidDesign'
  const recipe = designRecipe(design)
  const inProgress = w.blade || w.mould || !['empty', 'loaded'].includes(w.crucible.stage) || w.rack.some(i => i.design) || game.inventory.some(i => i.design && JSON.stringify(i.design) === JSON.stringify(design))
  if (w.blade?.stage === 'ruined' || w.mould?.ruined || w.crucible.stage === 'residue') return null
  const neededFittings = recipe.fittings.slice(w.blade?.parts || 0)
  if (neededFittings.some(id => !itemQuantity([...game.inventory, ...game.storehouse], id))) return 'designMaterials'
  if (inProgress) return null
  const entries = [...game.inventory, ...game.storehouse]
  if (itemQuantity(entries, recipe.ore) + w.crucible.count < recipe.oreCount || itemQuantity(entries, 'coal') + w.crucible.carbon < recipe.carbon + Math.max(0, recipe.fuel - Math.ceil(w.fuel / COAL_BURN_SECONDS))) return 'designMaterials'
  return null
}
export function workshopRecipe(game) {
  const design = game.workshop.activeDesign || (customUnlocked(game) ? game.workshop.design : null)
  const metal = METALS[game.workshop.crucible.ore === 'copper_ore' ? 'copper' : 'iron']
  return designRecipe(design) || { ore: null, oreCount: metal.orePerUnit, carbon: 1, fuel: 1, units: 1, blankMass: metal.density / 7.87, fittings: DAGGER_FITTINGS }
}
export const bladeMetal = blade => METALS[blade?.design?.material || 'iron']
export const bladeWorking = blade => !!blade && blade.temperature >= bladeMetal(blade).workMin && blade.temperature <= bladeMetal(blade).workMax
export const bladeQuenchable = blade => !!blade && blade.temperature >= bladeMetal(blade).workMin && blade.temperature <= bladeMetal(blade).quench + 50
export const bladeQuality = blade => Math.max(0, Math.round((average(blade.work.map(scoreWork)) * .5 + blade.quench * .25 + Math.min(average(blade.assembly), blade.assemblyCeiling ?? 100) * .2 + (blade.design ? average(blade.sharpness.filter((_, i) => cellNeedsEdge(blade.design, i))) || (blade.design.sections.every(s => s.edge === 'none' || s.profile === 'rounded') ? 100 : 0) : average(blade.sharpness)) * .05 - (blade.heatDamage || 0)) * (blade.castingQuality ?? 100) / 100))
export const meltingPoint = ore => ore === 'iron_ore' ? 1538 : 1085
export const pouringTemperature = ore => meltingPoint(ore) + 100
export const readyToPour = c => c.melt >= 99.99 && c.temperature >= pouringTemperature(c.ore) && (c.vesselTemperature ?? c.temperature) >= pouringTemperature(c.ore)
export const readyForAnvil = b => b.temperature >= (b.heating ? bladeMetal(b).target : bladeMetal(b).target - 50) && b.temperature <= bladeMetal(b).workMax
export const readyForQuench = b => b.temperature >= bladeMetal(b).quench && b.temperature <= bladeMetal(b).quench + 50
export const pouringRate = height => .035 + Math.max(0, Math.min(1, height)) * .145
export const castingQuality = (fill, spill) => Math.round(Math.max(0, 100 - Math.max(0, .98 - fill) * 1800 - Math.max(0, spill - .02) * 1800))
function finishPour(w) {
  const p = w.pour, c = w.crucible, m = w.mould
  if (!p) return
  if (m) {
    m.ruined ||= m.fill < .95
    m.castingQuality = m.ruined ? 0 : Math.max(0, castingQuality(m.fill, p.spilled) - m.heatDamage)
    m.heatDamage = 0
    m.remaining = 15 * Math.cbrt(m.mass || 1)
    m.spilled = p.spilled
  }
  if (c.remaining > .000001) { c.stage = 'residue'; c.onForge = false }
  else w.crucible = newWorkshop().crucible
  w.pour = null
}
export function newWorkshop() {
  return { design: null, activeDesign: null, working: false, loading: null, lessonSeen: [], lessonFinishPending: false, heatModelVersion: 2, temperature: AMBIENT_TEMPERATURE, fuel: 0, air: 0, damping: 0, bellowsRecovery: 0, serial: 0, crucible: { ore: null, count: 0, carbon: 0, stage: 'empty', units: 1, mass: 1, design: null, temperature: AMBIENT_TEMPERATURE, vesselTemperature: AMBIENT_TEMPERATURE, reduction: 0, melt: 0, heatDamage: 0, remaining: 1, onForge: false }, pour: null, mould: null, rack: [], blade: null }
}
const clamp = (value, max) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0))
export function normalizeWorkshop(saved) {
  const w = newWorkshop()
  if (!saved || typeof saved !== 'object') return w
  w.design = normalizeDesign(saved.design)
  w.activeDesign = normalizeDesign(saved.activeDesign)
  w.working = saved.working === true
  w.lessonSeen = Array.isArray(saved.lessonSeen) ? [...new Set(saved.lessonSeen.filter(id => typeof id === 'string'))].slice(0, 64) : []
  w.lessonFinishPending = saved.lessonFinishPending === true
  for (const [key, max] of Object.entries({ temperature: 2500, fuel: COAL_BURN_SECONDS * 6, air: 2100, serial: 1e9 })) w[key] = clamp(saved[key], max)
  w.temperature = Math.max(AMBIENT_TEMPERATURE, w.temperature)
  w.air = saved.heatModelVersion === 2 ? clamp(saved.air, 500) : 0
  w.damping = clamp(saved.damping, 12)
  w.bellowsRecovery = clamp(saved.bellowsRecovery, .3)
  const c = saved.crucible
  if (c && ['empty', 'loaded', 'reducing', 'melting', 'molten', 'pouring', 'residue'].includes(c.stage)) w.crucible = { ore: ['iron_ore', 'copper_ore'].includes(c.ore) ? c.ore : null, count: Math.floor(clamp(c.count, 72)), carbon: Math.floor(clamp(c.carbon, 12)), stage: c.stage, temperature: clamp(c.temperature, 2500), reduction: clamp(c.reduction, 100), melt: clamp(c.melt, 100), remaining: c.remaining === undefined ? 1 : clamp(c.remaining, 1), onForge: c.onForge === true }
  w.crucible.units = Math.max(1, Math.floor(clamp(c?.units ?? 1, 12)))
  w.crucible.mass = Math.max(.1, clamp(c?.mass ?? 1, 20))
  w.crucible.design = normalizeDesign(c?.design)
  w.crucible.vesselTemperature = Number.isFinite(c?.vesselTemperature) ? clamp(c.vesselTemperature, 2500) : w.crucible.temperature
  w.crucible.heatDamage = clamp(c?.heatDamage, 20)
  if (saved.pour && w.crucible.stage === 'pouring') w.pour = { holding: false, height: 0, spilled: clamp(saved.pour.spilled, 1) }
  if (saved.mould && ['iron_ingot', 'copper_ingot'].includes(saved.mould.itemId)) w.mould = { itemId: saved.mould.itemId, remaining: clamp(saved.mould.remaining, 100), heatDamage: clamp(saved.mould.heatDamage, 20) }
  if (w.mould) Object.assign(w.mould, { spilled: clamp(saved.mould.spilled, 1), fill: saved.mould.fill === undefined ? 1 : clamp(saved.mould.fill, 1), temperature: saved.mould.temperature === undefined ? 200 : clamp(saved.mould.temperature, 2500), ruined: saved.mould.ruined === true, castingQuality: saved.mould.castingQuality === undefined ? 100 : clamp(saved.mould.castingQuality, 100) })
  if (w.mould) Object.assign(w.mould, { units: Math.max(1, Math.floor(clamp(saved.mould.units ?? 1, 12))), design: normalizeDesign(saved.mould.design), mass: Math.max(.1, clamp(saved.mould.mass ?? 1, 20)) })
  if (Array.isArray(saved.rack)) w.rack = saved.rack.filter(e => e && ['iron_ingot', 'copper_ingot'].includes(e.itemId)).map(e => ({ id: String(e.id), itemId: e.itemId, temperature: clamp(e.temperature, 2500), heatDamage: clamp(e.heatDamage, 20) }))
  w.rack.forEach((e, i) => { const source = saved.rack.filter(e => e && ['iron_ingot', 'copper_ingot'].includes(e.itemId))[i]; Object.assign(e, { units: Math.max(1, Math.floor(clamp(source.units ?? 1, 12))), mass: Math.max(.1, clamp(source.mass ?? 1, 20)), design: normalizeDesign(source.design) }); const savedQuality = saved.rack.filter(e => e && ['iron_ingot', 'copper_ingot'].includes(e.itemId))[i].castingQuality; e.castingQuality = savedQuality === undefined ? 100 : clamp(savedQuality, 100) })
  const b = saved.blade
  if (b && ['hammering', 'shaped', 'quenched', 'assembled', 'ruined'].includes(b.stage)) {
    const design = normalizeDesign(b.design), count = design ? design.sections.length * 2 : 16
    const cells = (v, count, max) => Array.from({ length: count }, (_, i) => clamp(v?.[i], max))
    w.blade = { stage: b.quenching ? (b.quenchWork >= 200 ? 'ruined' : 'quenched') : b.stage, temperature: b.quenching ? 20 : clamp(b.temperature, 2500), heating: b.heating === true && !b.quenching, design, mass: Math.max(.1, clamp(b.mass ?? 1, 20)), work: cells(b.work, count, 200), quench: b.quenching ? scoreWork(clamp(b.quenchWork, 200)) : clamp(b.quench, 100), quenchWork: clamp(b.quenchWork, 200), quenching: false, assembly: cells(b.assembly, 3, 100), parts: Math.floor(clamp(b.parts, 3)), sharpness: cells(b.sharpness, count, 100), sourceId: typeof b.sourceId === 'string' ? b.sourceId : null }
    if (b.stage === 'assembled' && b.assembly?.length === 2) { w.blade.assembly[2] = average(w.blade.assembly.slice(0, 2)); w.blade.parts = 3 }
    w.blade.assemblyCeiling = Number.isFinite(b.assemblyCeiling) ? clamp(b.assemblyCeiling, 100) : 100
    w.blade.heatDamage = clamp(b.heatDamage, 20)
    w.blade.castingQuality = b.castingQuality === undefined ? 100 : clamp(b.castingQuality, 100)
    if (!w.blade.sourceId && (w.blade.work.some(v => v >= 200) || w.blade.quenchWork >= 200 || w.blade.heatDamage >= 20)) { w.blade.stage = 'ruined'; w.blade.heating = false }
  }
  if (w.working && saved.loading && ['coal', 'loadOre', 'loadCarbon'].includes(saved.loading.action)) {
    const from = saved.loading.params?.from === 'storehouse' ? 'storehouse' : 'bag'
    const duration = from === 'storehouse' ? 3 : 1
    w.loading = { action: saved.loading.action, params: { from, itemId: saved.loading.params?.itemId }, duration, remaining: clamp(saved.loading.remaining, duration) }
  }
  return w
}
export function queueWorkshopLoad(game, action, params = {}) {
  if (!['coal', 'loadOre', 'loadCarbon'].includes(action)) return workshopAction(game, action, params)
  if (game.workshop.loading) return { error: 'loadingBusy' }
  const preview = workshopAction(JSON.parse(JSON.stringify(game)), action, params)
  if (preview.error) return preview
  const duration = params.from === 'storehouse' ? 3 : 1
  game.workshop.loading = { action, params: { ...params }, duration, remaining: duration }
  return { loading: true }
}
export function tickWorkshop(game, seconds) {
  const w = game.workshop
  if (!w || seconds <= 0) return
  const dt = Math.min(seconds, .5)
  if (w.loading) {
    w.loading.remaining = Math.max(0, w.loading.remaining - dt)
    if (w.loading.remaining <= .000001) {
      const pending = w.loading; w.loading = null
      workshopAction(game, pending.action, pending.params)
    }
  }
  w.fuel = Math.max(0, w.fuel - dt)
  w.bellowsRecovery = Math.max(0, w.bellowsRecovery - dt)
  w.damping = Math.max(0, w.damping - dt)
  // Fuel permits combustion; only a finite bellows impulse supplies additional heat.
  const heatReleased = w.fuel > 0 ? w.air * (1 - Math.exp(-dt / 3)) : 0
  w.air = w.fuel > 0 ? Math.max(0, w.air - heatReleased) : 0
  const cooling = .0015 + (w.damping > 0 ? .002 : 0)
  w.temperature = Math.min(2500, AMBIENT_TEMPERATURE + (Math.max(AMBIENT_TEMPERATURE, w.temperature) - AMBIENT_TEMPERATURE) * Math.exp(-cooling * dt) + heatReleased)
  game.forgeCoal = Math.ceil(w.fuel / COAL_BURN_SECONDS)
  const c = w.crucible, thermalMass = Math.cbrt(c.mass || 1), meltMass = Math.max(1, c.mass || 1)
  if (['reducing', 'melting', 'molten', 'pouring', 'residue'].includes(c.stage)) {
    const vessel = c.vesselTemperature ?? c.temperature
    c.vesselTemperature = c.onForge || ['reducing', 'melting', 'molten'].includes(c.stage) ? vessel + (w.temperature - vessel) * Math.min(1, dt * .07 / thermalMass) : AMBIENT_TEMPERATURE + (vessel - AMBIENT_TEMPERATURE) * Math.exp(-dt * .0025 / thermalMass)
    c.temperature += (c.vesselTemperature - c.temperature) * Math.min(1, dt * .035 / thermalMass)
  }
  if (['pouring', 'residue'].includes(c.stage)) {
    if (!c.onForge) c.temperature = AMBIENT_TEMPERATURE + (c.temperature - AMBIENT_TEMPERATURE) * Math.exp(-dt * .001 / thermalMass)
    if (c.temperature >= meltingPoint(c.ore)) c.melt = Math.min(100, c.melt + dt * 8 / meltMass)
    else c.melt = Math.max(0, c.melt - dt * .5)
    if (c.temperature > meltingPoint(c.ore) + 180) c.heatDamage = clamp(c.heatDamage + dt * .4, 20)
  }
  if (['reducing', 'melting', 'molten'].includes(c.stage)) {
    if (c.stage === 'reducing' && c.temperature >= (c.ore === 'iron_ore' ? 1000 : 800)) {
      c.reduction = Math.min(100, c.reduction + dt * 5 / meltMass)
      if (c.reduction === 100) c.stage = 'melting'
    }
    if (c.stage === 'melting' && c.temperature >= (c.ore === 'iron_ore' ? 1538 : 1085)) {
      c.melt = Math.min(100, c.melt + dt * 8 / meltMass)
      if (c.melt === 100) c.stage = 'molten'
    }
    if (c.stage === 'molten' && c.temperature < (c.ore === 'iron_ore' ? 1500 : 1050)) { c.stage = 'melting'; c.melt = 90 }
    if (c.stage === 'molten' && c.temperature > meltingPoint(c.ore) + 180) c.heatDamage = clamp(c.heatDamage + dt * .4, 20)
  }
  if (w.pour && w.mould) {
    const p = w.pour, m = w.mould
    m.temperature = AMBIENT_TEMPERATURE + (m.temperature - AMBIENT_TEMPERATURE) * Math.exp(-dt * .0025 / thermalMass)
    if (m.fill > 0 && m.temperature < meltingPoint(c.ore) - 90) { m.ruined = true; finishPour(w) }
    else if (p.holding) {
      const amount = Math.min(c.remaining, c.remaining * c.melt / 100, pouringRate(p.height) * dt / Math.sqrt(c.units || 1))
      const spill = amount * Math.max(0, p.height - .78) * 1.25
      const caught = amount - spill
      if (caught > 0) m.temperature = (m.temperature * m.fill + c.temperature * caught) / (m.fill + caught)
      m.fill = Math.min(1, m.fill + caught); p.spilled += spill
      const liquid = c.remaining * c.melt / 100 - amount
      c.remaining = Math.max(0, c.remaining - amount)
      c.melt = c.remaining > .000001 ? clamp(liquid / c.remaining * 100, 100) : 100
      m.heatDamage = Math.max(m.heatDamage, c.heatDamage)
      if (c.remaining <= .000001) finishPour(w)
    }
  } else if (w.mould) { w.mould.remaining = Math.max(0, w.mould.remaining - dt); w.mould.temperature = 25 + (w.mould.temperature - 25) * Math.exp(-dt * .09) }
  for (const ingot of w.rack) ingot.temperature = Math.max(20, ingot.temperature - dt * 1.5)
  if (w.blade) {
    const b = w.blade
    b.temperature = b.heating ? b.temperature + (w.temperature - b.temperature) * Math.min(1, dt * .045 / Math.cbrt(b.mass || 1)) : Math.max(20, b.temperature - dt * 2 / Math.cbrt(b.mass || 1))
    if (b.stage !== 'assembled' && b.stage !== 'ruined') b.heatDamage = clamp((b.heatDamage || 0) + (b.temperature > bladeMetal(b).workMax + 100 ? dt : bladeWorking(b) ? -dt * .5 : 0), 20)
    if (b.heatDamage >= 20 && b.stage !== 'assembled') { b.stage = 'ruined'; b.heating = false; b.quenching = false }
  }
}
function add(inventory, itemId, quantity, id, castingQuality) {
  const existing = inventory.find(e => e.itemId === itemId && !e.design && !e.craft && e.castingQuality === castingQuality)
  if (existing) existing.quantity += quantity
  else inventory.push({ id, itemId, quantity, ...(castingQuality === undefined ? {} : { castingQuality }) })
}
// Commands validate before consuming anything; timers never use offline wall-clock time.
export function workshopAction(game, action, p = {}) {
  const w = game.workshop, b = w.blade, c = w.crucible
  const recipe = workshopRecipe(game)
  const fail = key => ({ error: key })
  if (w.loading && action !== 'stop') return fail('loadingBusy')
  if (w.pour && !['pourControl', 'finishPour', 'pour'].includes(action)) return fail('finishPourFirst')
  if (action === 'saveDesign') {
    if (!customUnlocked(game)) return fail('designLockedTutorial')
    if (w.design || w.activeDesign || w.blade || w.mould || w.rack.length || c.stage !== 'empty') return fail('designLocked')
    const design = normalizeDesign(p.design)
    if (!design || designIssues(design).errors.length) return fail('invalidDesign')
    w.design = design
    if (w.working) w.activeDesign = JSON.parse(JSON.stringify(design))
    return { designSaved: true }
  }
  if (action === 'clearDesign') {
    if (!customUnlocked(game) || !w.design) return fail('notReady')
    if (w.pour) return fail('finishPourFirst')
    w.loading = null
    w.blade = null
    w.mould = null
    w.rack = []
    if (c.stage !== 'empty') {
      c.stage = 'residue'
      c.onForge = false
      c.remaining = Math.max(c.remaining || 0, .01)
      c.melt = Math.min(c.melt || 0, 100)
    }
    w.design = null
    w.activeDesign = null
    return { designCleared: true }
  }
  if (action === 'discardBlade') {
    if (b?.stage !== 'ruined') return fail('notReady')
    w.blade = null; w.activeDesign = null
    return {}
  }
  if (b?.stage === 'ruined' && !['stop'].includes(action)) return fail('bladeRuined')
  if (action === 'start') {
    const designError = designStartError(game)
    if (designError) return fail(designError)
    if (!canStartBlacksmithing(game)) return fail('noSupplies')
    if (customUnlocked(game) && w.design && !w.activeDesign && !w.blade?.sourceId && !w.blade) w.activeDesign = JSON.parse(JSON.stringify(w.design))
    w.working = true
    return {}
  }
  if (action === 'stop') {
    w.loading = null
    if (b?.quenching) { b.quench = scoreWork(b.quenchWork); b.temperature = 20; b.stage = b.quenchWork >= 200 ? 'ruined' : 'quenched'; b.quenching = false }
    w.working = false
    return {}
  }
  if (!w.working && action === 'regrind' && !w.activeDesign && !w.mould && c.stage === 'empty' && game.inventory.some(e => e.id === p.id && ['dagger','custom_weapon'].includes(e.itemId))) w.working = true
  if (!w.working && action !== 'transfer') return fail('startFirst')
  if (w.working && action === 'transfer') return fail('stopForStorage')
  if (customUnlocked(game) && !w.activeDesign && !b && !['transfer','regrind'].includes(action) && !(c.stage === 'residue' && ['coal','bellows','coolForge','reheatResidue','dumpResidue'].includes(action))) return fail('designRequired')
  if (action === 'transfer') {
    const from = p.from === 'storehouse' ? game.storehouse : game.inventory
    const to = p.from === 'storehouse' ? game.inventory : game.storehouse
    const entry = from.find(e => e.id === p.id)
    if (!entry || items[entry.itemId]?.category !== 'materials') return fail('materialsOnly')
    if (p.from === 'storehouse' && carriedWeight(to) + entryWeight(entry) > 30) return fail('capacity')
    if (entry.design) to.push({ ...JSON.parse(JSON.stringify(entry)), id: 'transfer-' + (++w.serial), quantity: 1 })
    else add(to, entry.itemId, 1, 'transfer-' + (++w.serial), entry.castingQuality)
    entry.quantity--
    game.inventory = game.inventory.filter(e => e.quantity > 0); game.storehouse = game.storehouse.filter(e => e.quantity > 0)
  } else if (action === 'coal') {
    const from = p.from === 'storehouse' ? 'storehouse' : 'bag'
    const source = from === 'storehouse' ? game.storehouse : game.inventory
    if (w.fuel > COAL_BURN_SECONDS * 5 || !itemQuantity(source, 'coal')) return fail('coalNeeded')
    if (from === 'storehouse') game.storehouse = consumeItems(source, [{ itemId: 'coal', quantity: 1 }])
    else game.inventory = consumeItems(source, [{ itemId: 'coal', quantity: 1 }])
    w.fuel += COAL_BURN_SECONDS
  } else if (action === 'bellows') {
    if (!w.fuel) return fail('coalNeeded')
    if (w.bellowsRecovery > 0) return fail('bellowsRecovering')
    w.air = Math.min(500, w.air + bellowsBoost(w.temperature + w.air))
    w.bellowsRecovery = .3
  } else if (action === 'coolForge') {
    w.air *= .25
    w.damping = Math.min(12, w.damping + 5)
  } else if (action === 'loadOre' || action === 'loadCarbon') {
    if (w.activeDesign && (b || w.mould || w.rack.some(i => i.design) || game.inventory.some(i => i.design && JSON.stringify(i.design) === JSON.stringify(w.activeDesign)))) return fail('finishProject')
    const source = p.from === 'storehouse' ? game.storehouse : game.inventory
    const itemId = action === 'loadCarbon' ? 'coal' : p.itemId
    if (!['empty', 'loaded'].includes(c.stage) || !itemQuantity(source, itemId)) return fail('notReady')
    if (action === 'loadOre' && (!['iron_ore', 'copper_ore'].includes(itemId) || c.count >= recipe.oreCount || recipe.ore && recipe.ore !== itemId || c.ore && c.ore !== itemId)) return fail('sameOre')
    if (action === 'loadCarbon' && c.carbon >= recipe.carbon) return fail('notReady')
    const remaining = consumeItems(source, [{ itemId, quantity: 1 }])
    if (p.from === 'storehouse') game.storehouse = remaining; else game.inventory = remaining
    if (action === 'loadCarbon') c.carbon++; else { c.ore = itemId; c.count++ }
    c.stage = 'loaded'
  } else if (action === 'unload') {
    if (c.stage !== 'loaded') return fail('notReady')
    if (c.count) add(game.storehouse, c.ore, c.count, 'returned-ore-' + (++w.serial))
    if (c.carbon) add(game.storehouse, 'coal', c.carbon, 'returned-coal-' + (++w.serial))
    w.crucible = newWorkshop().crucible
  } else if (action === 'smelt') {
    if (c.stage !== 'loaded' || c.count !== recipe.oreCount || c.carbon !== recipe.carbon || !w.fuel) return fail('chargeNeeded')
    c.units = recipe.units; c.mass = recipe.blankMass; c.design = w.activeDesign ? JSON.parse(JSON.stringify(w.activeDesign)) : null
    c.stage = 'reducing'
  } else if (action === 'pour') {
    if (w.pour) return { pouring: true }
    if (!['melting', 'molten'].includes(c.stage) || w.mould || c.reduction < 100) return fail('mouldBusy')
    c.stage = 'pouring'; c.onForge = false
    w.pour = { holding: false, height: 0, spilled: 0 }
    w.mould = { itemId: c.ore === 'iron_ore' ? 'iron_ingot' : 'copper_ingot', remaining: 15, heatDamage: c.heatDamage, fill: 0, spilled: 0, temperature: c.temperature, ruined: false, castingQuality: 100, units: c.units || 1, mass: c.mass || 1, design: c.design }
    return { pouring: true }
  } else if (action === 'pourControl') {
    if (!w.pour) return fail('notReady')
    w.pour.holding = p.holding === true; w.pour.height = w.pour.holding ? clamp(p.height, 1) : 0
  } else if (action === 'finishPour') {
    if (!w.pour) return fail('notReady')
    finishPour(w)
  } else if (action === 'reheatResidue') {
    if (c.stage !== 'residue' || !w.fuel) return fail('notReady')
    c.onForge = true
  } else if (action === 'dumpResidue') {
    if (c.stage !== 'residue' || c.temperature < meltingPoint(c.ore) || c.melt < 99) return fail('residueCold')
    w.crucible = newWorkshop().crucible
    if (!w.mould && !w.blade && !w.rack.some(i => i.design)) w.activeDesign = null
  } else if (action === 'discardCasting') {
    if (!w.mould?.ruined) return fail('notReady')
    const fatherHelps = w.mould.itemId === 'iron_ingot' && game.completedQuests.includes('iron_stock_bought') && !game.completedQuests.includes('dagger_forged')
    w.mould = null
    if (c.stage === 'empty') w.activeDesign = null
    if (fatherHelps) add(game.inventory, 'iron_ore', 4, 'father-practice-ore-' + (++w.serial))
  } else if (action === 'collect') {
    if (!w.mould || w.mould.ruined || w.mould.remaining > 0) return fail('notReady')
    w.rack.push({ id: 'ingot-' + (++w.serial), itemId: w.mould.itemId, temperature: 200, heatDamage: w.mould.heatDamage, castingQuality: w.mould.castingQuality, units: w.mould.units || 1, mass: w.mould.mass || 1, design: w.mould.design }); w.mould = null
  } else if (action === 'rackIngot') {
    if (!['iron_ingot', 'copper_ingot'].includes(p.itemId) || !itemQuantity(game.inventory, p.itemId)) return fail('notReady')
    const source = game.inventory.find(e => e.itemId === p.itemId && (!p.id || e.id === p.id))
    if (!source) return fail('notReady')
    if (customUnlocked(game) && JSON.stringify(source.design) !== JSON.stringify(w.activeDesign)) return fail('ironOnly')
    game.inventory = game.inventory.map(e => e.id === source.id ? { ...e, quantity: e.quantity - 1 } : e).filter(e => e.quantity > 0)
    w.rack.push({ id: 'ingot-' + (++w.serial), itemId: p.itemId, temperature: 20, heatDamage: 0, castingQuality: source.castingQuality ?? 100, design: source.design, units: source.units || 1, mass: source.mass || items[p.itemId].weightKg })
  } else if (action === 'heatIngot') {
    const ingot = w.rack.find(i => i.id === p.id)
    if (b || !ingot || (!ingot.design && ingot.itemId !== 'iron_ingot') || customUnlocked(game) && JSON.stringify(ingot.design) !== JSON.stringify(w.activeDesign)) return fail('ironOnly')
    const design = normalizeDesign(ingot.design), cellCount = design ? design.sections.length * 2 : 16
    w.blade = { design, mass: ingot.mass || 1, stage: 'hammering', temperature: ingot.temperature, heating: true, heatDamage: ingot.heatDamage || 0, castingQuality: ingot.castingQuality ?? 100, work: Array(cellCount).fill(0), quench: 0, quenchWork: 0, assembly: [0, 0, 0], assemblyCeiling: 100, parts: 0, sharpness: Array(cellCount).fill(0), sourceId: null }
    w.rack = w.rack.filter(i => i.id !== p.id)
  } else if (action === 'takeIngot') {
    const ingot = w.rack.find(i => i.id === p.id)
    if (!ingot || carriedWeight(game.inventory) + (ingot.mass || items[ingot.itemId].weightKg) > 30) return fail('capacity')
    game.inventory.push({ id: 'rack-take-' + (++w.serial), itemId: ingot.itemId, quantity: 1, castingQuality: Math.max(0, (ingot.castingQuality ?? 100) - (ingot.heatDamage || 0)), ...(ingot.design ? { design: ingot.design, units: ingot.units, mass: ingot.mass } : {}) })
    w.rack = w.rack.filter(i => i.id !== p.id)
  } else if (action === 'heat') {
    if (!b || b.stage === 'assembled' || b.quenching) return fail('notReady')
    b.heating = true
  } else if (action === 'removeHeat') {
    if (!b) return fail('notReady')
    b.heating = false
  } else if (action === 'anvil') {
    if (!b || b.stage !== 'hammering' || !bladeWorking(b)) return fail('workingHeat')
    b.heating = false
  } else if (action === 'strike') {
    if (!b || b.stage !== 'hammering' || b.heating || !bladeWorking(b) || !Number.isInteger(p.cell) || p.cell < 0 || p.cell >= b.work.length) return fail('workingHeat')
    if (!game.inventory.some(e => e.id === game.equipment.tool && e.itemId === 'crude_hammer')) return fail('hammerNeeded')
    b.work[p.cell] = Math.min(200, b.work[p.cell] + clamp(p.power, 1) * 40)
    if (b.work[p.cell] >= 200) { b.stage = 'ruined'; b.heating = false }
  } else if (action === 'shapeDone') {
    if (!b || b.stage !== 'hammering' || !b.work.every(v => v > 0)) return fail('allCells')
    b.stage = 'shaped'; b.heating = false
  } else if (action === 'quenchStart') {
    if (!b || !['shaped', 'quenched'].includes(b.stage) || !bladeQuenchable(b)) return fail('quenchHeat')
    b.heating = false; b.stage = 'shaped'; b.quenchWork = 0; b.quench = 0; b.quenching = true
  } else if (action === 'quenchTick') {
    if (!b || b.stage !== 'shaped' || !b.quenching || !['water', 'oil'].includes(p.medium)) return fail('notReady')
    b.quenchWork = Math.min(200, b.quenchWork + clamp(p.seconds, .25) * (p.medium === 'water' ? 40 : 24) / Math.sqrt(b.mass || 1))
  } else if (action === 'quenchEnd') {
    if (!b || b.stage !== 'shaped' || !b.quenching) return fail('notReady')
    b.quench = scoreWork(b.quenchWork); b.temperature = 20; b.stage = b.quenchWork >= 200 ? 'ruined' : 'quenched'; b.quenching = false
  } else if (action === 'assemble') {
    if (!b || b.stage !== 'quenched' || b.parts >= DAGGER_FITTINGS.length) return fail('notReady')
    const itemId = b.design ? [b.design.guard, b.design.handle, b.design.pommel][b.parts] : DAGGER_FITTINGS[b.parts]
    const from = p.from === 'storehouse' ? 'storehouse' : 'bag'
    const source = from === 'storehouse' ? game.storehouse : game.inventory
    if (!itemQuantity(source, itemId)) return fail('partsNeeded')
    if (from === 'storehouse') game.storehouse = consumeItems(source, [{ itemId, quantity: 1 }])
    else game.inventory = consumeItems(source, [{ itemId, quantity: 1 }])
    b.assembly[b.parts++] = Math.min(b.assemblyCeiling ?? 100, Number.isFinite(p.offsetPx) ? assemblyPixelAccuracy(p.offsetPx) : assemblyAccuracy(p.position))
    if (b.parts === DAGGER_FITTINGS.length) b.stage = 'assembled'
  } else if (action === 'grind') {
    if (!b || b.stage !== 'assembled') return fail('notReady')
    const geometric = Number.isFinite(p.x) && Number.isFinite(p.depth) && [0, 1].includes(p.side)
    const cells = geometric ? (b.design ? customGrindingCells(b.design, p.x, p.depth, p.side) : grindingContactCells(p.x, p.depth, p.side)) : Number.isInteger(p.cell) && p.cell >= 0 && p.cell < b.sharpness.length ? [p.cell] : []
    if (!cells.length) return fail('noGrindingContact')
    const angle = geometric ? grindingAngle(p.depth) : p.angle
    if (!Number.isFinite(angle)) return fail('notReady')
    const delta = grindingRate(angle)
    for (const cell of cells.filter(i => i < b.sharpness.length && (!b.design || cellNeedsEdge(b.design, i)))) b.sharpness[cell] = clamp(b.sharpness[cell] + delta * clamp(p.seconds, .25), 100)
  } else if (action === 'reseat') {
    if (!b || b.stage !== 'assembled' || b.sourceId) return fail('notReady')
    const fittings = b.design ? [b.design.guard, b.design.handle, b.design.pommel] : DAGGER_FITTINGS
    const returned = fittings.map(itemId => ({ itemId, quantity: 1 }))
    if (returned.some((item, index) => !canCarry([...game.inventory, ...returned.slice(0, index)], item.itemId))) return fail('capacity')
    b.stage = 'quenched'; b.parts = 0; b.assembly = [0, 0, 0]; b.assemblyCeiling = Math.max(0, (b.assemblyCeiling ?? 100) - 10)
    fittings.forEach(itemId => add(game.inventory, itemId, 1, 'reused-fitting-' + (++w.serial)))
  } else if (action === 'finish') {
    if (!b || b.stage !== 'assembled') return fail('notReady')
    if (!b.sourceId && (weaponStats(b.design)?.weight || items.dagger.weightKg) + carriedWeight(game.inventory) > 30) return fail('capacity')
    const entry = b.sourceId ? game.inventory.find(e => e.id === b.sourceId) : { id: 'crafted-dagger-' + (++w.serial), itemId: b.design ? 'custom_weapon' : 'dagger', quantity: 1 }
    if (!entry) return fail('notReady')
    entry.craft = { ...(b.design ? { design: JSON.parse(JSON.stringify(b.design)), mass: b.mass } : {}), assemblyCeiling: b.assemblyCeiling ?? 100, work: [...b.work], quench: b.quench, assembly: [...b.assembly], sharpness: [...b.sharpness], heatDamage: b.heatDamage || 0, castingQuality: b.castingQuality ?? 100, quality: bladeQuality(b) }
    if (!b.sourceId) game.inventory.push(entry)
    w.blade = null; w.activeDesign = null; w.design = null
    return { finished: true }
  } else if (action === 'regrind') {
    const entry = game.inventory.find(e => e.id === p.id && ['dagger', 'custom_weapon'].includes(e.itemId))
    if (b || !entry || w.activeDesign || w.mould || c.stage !== 'empty') return fail('notReady')
    const craft = entry.craft || { work: Array(16).fill(100), quench: 100, assembly: [100, 100, 100], sharpness: Array(16).fill(0) }
    w.blade = { ...JSON.parse(JSON.stringify(craft)), stage: 'assembled', parts: 3, heating: false, temperature: 20, quenchWork: 0, sourceId: entry.id }
  } else return fail('notReady')
  return {}
}
