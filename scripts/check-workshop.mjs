import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createServer } from 'vite'
import { createSSRApp, createRenderer, h, markRaw, nextTick, reactive, ssrContextKey } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createI18n } from 'vue-i18n'
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
try {
  const { initialState, readSave } = await server.ssrLoadModule('/src/game.js')
  const { workshopAction: action, tickWorkshop: tick, normalizeWorkshop, queueWorkshopLoad, readyToPour, readyForAnvil, readyForQuench, pouringTemperature, scoreWork, bladeQuality, COAL_BURN_SECONDS, clampAssemblyPosition, assemblyAccuracy } = await server.ssrLoadModule('/src/workshop.js')
  const { canEnterSmithy, robPlayer } = await server.ssrLoadModule('/src/errand.js')
  const { itemQuantity, normalizeInventory, carriedWeight } = await server.ssrLoadModule('/src/inventory.js')
  const { forgeFloor, forgeAisles, stationFloor, newForgePawn, routeForgePawn, tickForgePawn, stationPoint, floorDistance, actionStation } = await server.ssrLoadModule('/src/forge-navigation.js')
  const { nextWorkshopLesson, workshopLessons } = await server.ssrLoadModule('/src/workshop-lesson.js')
  const { default: Dialog } = await server.ssrLoadModule('/src/components/WorkshopDialog.vue')
  const { default: Map } = await server.ssrLoadModule('/src/components/ForgeMap.vue')
  const { default: Lesson } = await server.ssrLoadModule('/src/components/ForgeLesson.vue')
  const { default: Assembly } = await server.ssrLoadModule('/src/components/DaggerAssembly.vue')
  const { default: Sharpening } = await server.ssrLoadModule('/src/components/DaggerSharpening.vue')
  const { grindingContactCells, grindingWidth } = await server.ssrLoadModule('/src/grinding.js')
  const { default: Town } = await server.ssrLoadModule('/src/components/TownMap.vue')
  const { places: townPlaces } = await server.ssrLoadModule('/src/game.js')
  const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)))
  const missing = []
  const render = (component, props) => renderToString(createSSRApp({ render: () => h(component, props) }).use(createI18n({ legacy: false, locale: 'en', messages: { en }, missing: (_, key) => missing.push(key) })))
  const timed = initialState(); timed.workshop.working = true
  timed.inventory.push({ id: 'loading-coal', itemId: 'coal', quantity: 2 }, { id: 'loading-ore', itemId: 'iron_ore', quantity: 2 })
  timed.storehouse = [{ id: 'stored-ore', itemId: 'iron_ore', quantity: 2 }, { id: 'stored-coal', itemId: 'coal', quantity: 2 }]
  assert(queueWorkshopLoad(timed, 'coal').loading)
  assert.equal(timed.workshop.fuel, 0); assert.equal(itemQuantity(timed.inventory, 'coal'), 2)
  assert.equal(queueWorkshopLoad(timed, 'coal').error, 'loadingBusy')
  tick(timed, .5); assert.equal(timed.workshop.fuel, 0)
  timed.workshop = normalizeWorkshop(JSON.parse(JSON.stringify(timed.workshop)))
  assert.equal(timed.workshop.loading.remaining, .5)
  tick(timed, .5); assert(timed.workshop.fuel > 479); assert.equal(itemQuantity(timed.inventory, 'coal'), 1)
  for (const [command, from, duration] of [['loadOre', 'bag', 1], ['loadOre', 'storehouse', 3], ['loadCarbon', 'storehouse', 3]]) {
    const field = command === 'loadOre' ? 'count' : 'carbon', before = timed.workshop.crucible[field]
    assert(queueWorkshopLoad(timed, command, { from, itemId: 'iron_ore' }).loading)
    for (let elapsed = .5; elapsed < duration; elapsed += .5) { tick(timed, .5); assert.equal(timed.workshop.crucible[field], before) }
    assert.equal(action(timed, 'smelt').error, 'loadingBusy')
    tick(timed, .5); assert.equal(timed.workshop.crucible[field], before + 1)
  }
  const inventoryBeforeCancel = JSON.stringify(timed.inventory)
  queueWorkshopLoad(timed, 'loadOre', { from: 'bag', itemId: 'iron_ore' }); action(timed, 'stop'); tick(timed, .5)
  assert.equal(timed.workshop.loading, null); assert.equal(JSON.stringify(timed.inventory), inventoryBeforeCancel, 'Cancelling a load never consumes its item')
  const game = initialState()
  game.inventory.push({ id: 'ore', itemId: 'iron_ore', quantity: 4 }, { id: 'coal', itemId: 'coal', quantity: 4 }, { id: 'guard', itemId: 'dagger_guard', quantity: 1 }, { id: 'handle', itemId: 'dagger_handle', quantity: 1 }, { id: 'pommel', itemId: 'dagger_pommel', quantity: 1 })
  assert(carriedWeight(game.inventory) < 30)
  const ok = (command, params) => assert.equal(action(game, command, params).error, undefined, command)
  assert.equal(action(game, 'transfer', { id: 'starter-crude_hammer', from: 'bag' }).error, 'materialsOnly')
  const stored = itemQuantity(game.storehouse, 'coal')
  ok('transfer', { id: 'ore', from: 'bag' }); assert.equal(itemQuantity(game.storehouse, 'iron_ore'), 1)
  ok('start')
  ok('loadOre', { from: 'storehouse', itemId: 'iron_ore' })
  for (let i = 0; i < 3; i++) ok('loadOre', { from: 'bag', itemId: 'iron_ore' })
  assert.equal(itemQuantity(game.inventory, 'iron_ore'), 0)
  ok('loadCarbon', { from: 'bag' }); ok('coal')
  assert.equal(itemQuantity(game.storehouse, 'coal'), stored, 'Fuel never silently draws from storage')
  ok('smelt')
  assert.equal(action(game, 'pour').error, 'mouldBusy')
  assert.equal(game.workshop.fuel, COAL_BURN_SECONDS)
  for (let i = 0; i < 2000 && game.workshop.crucible.stage !== 'molten'; i++) { if (i % 6 === 0) ok('bellows'); tick(game, .2) }
  assert.equal(game.workshop.crucible.stage, 'molten', 'Ore must reduce, then melt')
  assert(game.workshop.crucible.reduction === 100 && game.workshop.crucible.melt === 100)
  ok('pour'); assert(game.workshop.pour)
  ok('pourControl', { holding: true, height: .65 })
  for (let i = 0; i < 28 && game.workshop.pour; i++) tick(game, .2)
  if (game.workshop.pour) ok('finishPour')
  assert(!game.workshop.mould.ruined)
  assert.equal(action(game, 'pour').error, 'mouldBusy')
  assert.equal(action(game, 'collect').error, 'notReady')
  for (let i = 0; i < 80; i++) tick(game, .2)
  ok('collect'); assert.equal(game.workshop.rack.length, 1)
  ok('heatIngot', { id: game.workshop.rack[0].id })
  assert.equal(action(game, 'strike', { cell: 0, power: 1 }).error, 'workingHeat')
  const b = game.workshop.blade
  b.temperature = 900; ok('anvil')
  for (let cell = 0; cell < 16; cell++) { ok('strike', { cell, power: 1 }); ok('strike', { cell, power: 1 }); ok('strike', { cell, power: .5 }) }
  assert(b.work.every(v => v === 100)); assert.equal(scoreWork(100), 100)
  ok('strike', { cell: 0, power: 1 }); assert.equal(scoreWork(b.work[0]), 60)
  const ruined = JSON.parse(JSON.stringify(game))
  for (let i = 0; i < 2; i++) assert(!action(ruined, 'strike', { cell: 0, power: 1 }).error)
  assert.equal(ruined.workshop.blade.stage, 'ruined')
  assert.equal(action(ruined, 'heat').error, 'bladeRuined')
  assert.equal(action(ruined, 'shapeDone').error, 'bladeRuined')
  assert(!action(ruined, 'discardBlade').error); assert.equal(ruined.workshop.blade, null)
  assert.equal(itemQuantity(ruined.inventory, 'iron_ingot'), 0, 'Discarding never recovers metal')
  b.temperature = 900; ok('anvil'); ok('shapeDone')
  b.temperature = 600; assert.equal(action(game, 'quenchStart').error, 'quenchHeat')
  b.temperature = 820; ok('quenchStart')
  for (let i = 0; i < 10; i++) ok('quenchTick', { seconds: .25, medium: 'water' })
  assert.equal(b.quenchWork, 100); ok('quenchEnd'); assert.equal(b.quench, 100)
  const badQuench = JSON.parse(JSON.stringify(game))
  badQuench.workshop.blade.temperature = 820
  action(badQuench, 'quenchStart')
  for (let i = 0; i < 30; i++) action(badQuench, 'quenchTick', { seconds: .25, medium: 'water' })
  action(badQuench, 'quenchEnd')
  assert.equal(badQuench.workshop.blade.stage, 'ruined')
  assert.equal(action(badQuench, 'quenchStart').error, 'bladeRuined')
  ok('assemble', { position: .5 }); assert.equal(itemQuantity(game.inventory, 'dagger_guard'), 0)
  ok('assemble', { position: .5 }); assert.equal(itemQuantity(game.inventory, 'dagger_handle'), 0)
  assert.equal(b.stage, 'quenched', 'The pommel is still required after the handle'); ok('assemble', { position: .5 }); assert.equal(itemQuantity(game.inventory, 'dagger_pommel'), 0)
  assert.equal(b.stage, 'assembled'); assert.deepEqual(b.assembly, [100, 100, 100])
  const refit = initialState(); refit.workshop.working = true
  refit.workshop.blade = JSON.parse(JSON.stringify(b))
  assert(!action(refit, 'reseat').error); assert.equal(refit.workshop.blade.assemblyCeiling, 90)
  assert(!action(refit, 'assemble', { offsetPx: 0 }).error); assert(!action(refit, 'assemble', { offsetPx: 0 }).error); assert(!action(refit, 'assemble', { offsetPx: 0 }).error)
  assert.deepEqual(refit.workshop.blade.assembly, [90, 90, 90], 'A perfect refit cannot exceed the lowered ceiling')
  assert(!action(refit, 'reseat').error); assert.equal(refit.workshop.blade.assemblyCeiling, 80)
  assert.equal(normalizeWorkshop(refit.workshop).blade.assemblyCeiling, 80)
  action(refit, 'assemble', { offsetPx: 0 }); action(refit, 'assemble', { offsetPx: 0 }); action(refit, 'assemble', { offsetPx: 0 }); action(refit, 'finish')
  const refitDagger = refit.inventory.find(e => e.itemId === 'dagger')
  assert.equal(normalizeInventory(refit.inventory).find(e => e.id === refitDagger.id).craft.assemblyCeiling, 80)
  action(refit, 'regrind', { id: refitDagger.id }); assert.equal(refit.workshop.blade.assemblyCeiling, 80, 'Regrinding preserves the refitting penalty')
  const overlap = initialState(); overlap.workshop.working = true; overlap.workshop.blade = JSON.parse(JSON.stringify(b))
  const cells = grindingContactCells(.6, .4, 0)
  assert(cells.length > 1 && cells.length < 8, 'Partial wheel overlap can sharpen several, but not all, cells')
  action(overlap, 'grind', { x: .6, depth: .4, side: 0, seconds: .1 })
  overlap.workshop.blade.sharpness.forEach((v, i) => assert.equal(v > 0, cells.includes(i), 'Only geometrically overlapping cells change'))
  const noContact = [...overlap.workshop.blade.sharpness]
  assert.equal(action(overlap, 'grind', { x: .1, depth: .4, side: 0, seconds: .1 }).error, 'noGrindingContact')
  assert.deepEqual(overlap.workshop.blade.sharpness, noContact)
  action(overlap, 'grind', { x: .5, depth: .4, side: 1, seconds: .1 })
  overlap.workshop.blade.sharpness.slice(8).forEach((v, i) => assert.equal(v > 0, grindingContactCells(.5, .4, 1).includes(i + 8)))
  action(overlap, 'grind', { x: .5, depth: 1, side: 1, seconds: .1 })
  assert(overlap.workshop.blade.sharpness[grindingContactCells(.5, .4, 1)[0]] < 2.2, 'An incorrect height/angle lowers contacted cells')
  assert(grindingWidth(1) < grindingWidth(0), 'Lowering the dagger visibly narrows it along its lengthwise axis')
  const sharpenedHtml = await render(Sharpening, { blade: b })
  assert(sharpenedHtml.includes('/images/items/dagger_handle.svg') && sharpenedHtml.includes('/images/items/dagger_guard.svg'))
  for (let cell = 0; cell < 16; cell++) for (let i = 0; i < 20; i++) ok('grind', { cell, seconds: .25, angle: 15 })
  assert(b.sharpness.every(v => v === 100))
  ok('grind', { cell: 0, seconds: .25, angle: 25 }); assert.equal(b.sharpness[0], 97.5)
  ok('grind', { cell: 0, seconds: .25, angle: 15 }); assert.equal(b.sharpness[0], 100)
  for (const station of ['warehouse', 'crucible', 'furnace', 'mould', 'rack', 'anvil', 'water', 'oil', 'workbench', 'grinder']) {
    const html = await render(Dialog, { game, station, feedback: null }); assert(html.includes('Father’s workshop')); assert(!html.includes('workshop.no'))
  }
  for (const stage of ['hammering', 'shaped', 'quenched', 'assembled']) { b.stage = stage; await render(Dialog, { game, station: stage === 'hammering' ? 'anvil' : stage === 'shaped' ? 'water' : stage === 'quenched' ? 'workbench' : 'grinder' }) }
  b.stage = 'assembled'
  const expected = bladeQuality(b)
  assert.equal(action(game, 'finish').finished, true)
  const dagger = game.inventory.find(e => e.itemId === 'dagger'); assert.equal(dagger.craft.quality, expected)
  assert.deepEqual(normalizeInventory(game.inventory).find(e => e.id === dagger.id).craft, dagger.craft)
  ok('regrind', { id: dagger.id }); ok('finish'); assert.equal(game.inventory.filter(e => e.itemId === 'dagger').length, 1, 'Regrinding never duplicates weapons')
  const before = JSON.stringify(game.workshop)
  assert.deepEqual(normalizeWorkshop(JSON.parse(before)), JSON.parse(before))
  for (const from of Object.keys(forgeFloor)) for (const station of Object.keys(stationFloor)) {
    const pawn = newForgePawn(from); routeForgePawn(pawn, station)
    let previous = from
    for (const waypoint of pawn.route) { assert(forgeAisles.some(edge => edge.includes(previous) && edge.includes(waypoint.id)), `${from} to ${station} follows an aisle`); previous = waypoint.id }
    for (let i = 0; i < 500 && pawn.route.length; i++) tickForgePawn(pawn, .1)
    assert(floorDistance(pawn, stationPoint(station)) < .001, `${station} is reachable`)
  }
  for (const target of ['crucible', 'water']) {
    const frontApproach = newForgePawn('furnace')
    routeForgePawn(frontApproach, target)
    const ids = frontApproach.route.map(point => point.id)
    assert(frontApproach.route.at(-1).y <= 44, `${target} is approached from the clear floor above`)
    assert(!ids.some(id => ['west', 'shopDoor', 'westLower', 'anvil', 'hall'].includes(id)), `${target} avoids the long western detour`)
    const distance = frontApproach.route.reduce((total, point, index) => total + floorDistance(index ? frontApproach.route[index - 1] : frontApproach, point), 0)
    assert(distance < 45, `${target} stays close to the furnace`)
    for (let i = 0; i < 500 && frontApproach.route.length; i++) tickForgePawn(frontApproach, .04)
    assert(floorDistance(frontApproach, stationPoint(target)) < .001)
  }
  const walker = newForgePawn('entry'); routeForgePawn(walker, 'furnace'); tickForgePawn(walker, .1)
  assert(walker.route.length && floorDistance(walker, stationPoint('furnace')) > 1.5, 'Actions cannot open immediately from the entrance')
  const lastAnchor = walker.id, nextAnchor = walker.route[0].id
  routeForgePawn(walker, 'warehouse'); assert([lastAnchor, nextAnchor].includes(walker.route[0].id), 'Rerouting stays on the current aisle')
  assert.equal(actionStation('coal'), 'furnace'); assert.equal(actionStation('loadCarbon'), 'crucible'); assert.equal(actionStation('strike'), 'anvil'); assert.equal(actionStation('assemble'), 'workbench'); assert.equal(actionStation('pourControl'), null)
  const furniture = [[38, 47, 48, 61], [49, 47, 55, 59], [56, 49, 60, 60], [62, 42, 74, 64]]
  for (const from of ['entry', 'centre', 'furnace', 'rack']) for (const station of ['anvil', 'water', 'oil', 'crucible', 'mould']) {
    const pawn = newForgePawn(from); routeForgePawn(pawn, station)
    let last = pawn
    for (const next of pawn.route) {
      for (let i = 0; i <= 100; i++) {
        const x = last.x + (next.x - last.x) * i / 100, y = last.y + (next.y - last.y) * i / 100
        assert(!furniture.some(([left, top, right, bottom]) => x > left && x < right && y > top && y < bottom), `${from} to ${station} must not cross the anvil, barrels or table`)
      }
      last = next
    }
    assert(stationPoint(station).y <= 44, `${station} is accessible from above`)
  }
  assert.equal(pouringTemperature('iron_ore'), 1638); assert.equal(pouringTemperature('copper_ore'), 1185)
  const hotCharge = { ore: 'iron_ore', melt: 100, temperature: 1638, vesselTemperature: 1638 }
  assert(readyToPour(hotCharge))
  assert(!readyToPour({ ...hotCharge, temperature: 1538 }), 'Melting point alone is not enough travel heat')
  assert(!readyToPour({ ...hotCharge, vesselTemperature: 1600 }), 'The crucible must also have heat in reserve')
  assert(!readyToPour({ ...hotCharge, melt: 90 }), 'A partial melt is allowed manually but never recommended')
  assert(!readyForAnvil({ temperature: 750, heating: true })); assert(!readyForAnvil({ temperature: 899, heating: true }))
  assert(readyForAnvil({ temperature: 900, heating: true })); assert(readyForAnvil({ temperature: 875, heating: false }))
  assert(!readyForQuench({ temperature: 750 })); assert(readyForQuench({ temperature: 850 }))
  const legacyFittings = normalizeWorkshop({ ...initialState().workshop, blade: { stage: 'assembled', parts: 2, assembly: [80, 100] } }).blade
  assert.equal(legacyFittings.parts, 3); assert.deepEqual(legacyFittings.assembly, [80, 100, 90], 'Finished legacy daggers keep their assembly quality')
  const lessonGame = initialState(); lessonGame.completedQuests.push('iron_stock_bought'); lessonGame.workshop.working = true
  assert.equal(nextWorkshopLesson(lessonGame).id, 'ore')
  const returningApprentice = initialState(); returningApprentice.completedQuests.push('iron_stock_bought'); returningApprentice.leftHomeForErrand = true; returningApprentice.workshop.working = true
  assert.equal(nextWorkshopLesson(returningApprentice).id, 'welcomeBack')
  returningApprentice.workshop.lessonSeen.push('welcomeBack'); assert.equal(nextWorkshopLesson(returningApprentice).id, 'ore')
  lessonGame.workshop.lessonSeen.push('ore'); assert.equal(nextWorkshopLesson(lessonGame), null)
  Object.assign(lessonGame.workshop.crucible, { count: 4, stage: 'loaded' }); assert.equal(nextWorkshopLesson(lessonGame).id, 'reducer')
  lessonGame.workshop.crucible.carbon = 1; assert.equal(nextWorkshopLesson(lessonGame).id, 'fuel')
  lessonGame.workshop.fuel = 480; assert.equal(nextWorkshopLesson(lessonGame).id, 'crucible')
  lessonGame.workshop.crucible.stage = 'reducing'; assert.equal(nextWorkshopLesson(lessonGame).id, 'bellows')
  lessonGame.workshop.crucible.stage = 'melting'; assert.equal(nextWorkshopLesson(lessonGame).id, 'melting')
  Object.assign(lessonGame.workshop.crucible, { stage: 'molten', ore: 'iron_ore', melt: 100, temperature: 1638, vesselTemperature: 1638 }); assert.equal(nextWorkshopLesson(lessonGame).id, 'pour')
  lessonGame.workshop.crucible.temperature = 1538
  assert.equal(nextWorkshopLesson(lessonGame).id, 'melting')
  lessonGame.workshop.lessonSeen.push('melting'); assert.equal(nextWorkshopLesson(lessonGame), null)
  lessonGame.workshop.crucible.temperature = 1638; lessonGame.workshop.crucible.vesselTemperature = 1637
  assert.equal(nextWorkshopLesson(lessonGame), null)
  lessonGame.workshop.crucible.vesselTemperature = 1638; assert.equal(nextWorkshopLesson(lessonGame).id, 'pour')
  lessonGame.workshop.pour = {}; assert.equal(nextWorkshopLesson(lessonGame), null, 'Never interrupt a live pour with dialogue')
  lessonGame.workshop.pour = null; lessonGame.completedQuests.push('dagger_forged'); assert.equal(nextWorkshopLesson(lessonGame), null, 'Later daggers are independent')
  lessonGame.workshop.lessonFinishPending = true; assert.equal(nextWorkshopLesson(lessonGame).id, 'finished')
  lessonGame.workshop.lessonSeen.push('finished'); assert.equal(nextWorkshopLesson(lessonGame), null)
  assert.deepEqual(normalizeWorkshop(lessonGame.workshop).lessonSeen, lessonGame.workshop.lessonSeen)
  for (const lesson of Object.values(workshopLessons)) {
    const html = await render(Lesson, { lesson })
    assert(html.includes('At Father’s forge')); assert(html.includes('Workshop time pauses'))
    for (const line of lesson.lines) {
      const text = line.key.split('.').reduce((value, key) => value?.[key], en)
      assert.equal(typeof text, 'string', line.key)
    }
  }
  globalThis.localStorage = { getItem: () => JSON.stringify(game) }
  const loaded = readSave(); assert.equal(loaded.workshop.temperature, game.workshop.temperature, 'Reload does not advance time')
  assert.deepEqual(loaded.inventory.find(e => e.id === dagger.id).craft, dagger.craft)
  const beforePommel = initialState()
  beforePommel.merchantInventories.market_smith_supplies = beforePommel.merchantInventories.market_smith_supplies.filter(item => item.itemId !== 'dagger_pommel')
  beforePommel.workshop.crucible.temperature = 1600; delete beforePommel.workshop.crucible.vesselTemperature
  globalThis.localStorage = { getItem: () => JSON.stringify(beforePommel) }
  const pommelMigration = readSave()
  assert.equal(pommelMigration.merchantInventories.market_smith_supplies.find(item => item.itemId === 'dagger_pommel').quantity, 8, 'Existing saves get the newly stocked fitting immediately')
  assert.equal(pommelMigration.workshop.crucible.vesselTemperature, 1600, 'Legacy crucible heat migrates without suddenly chilling the metal')
  const old = { ...initialState(), version: 11, coalStock: 7, forgeCoal: 2 }; delete old.storehouse; delete old.workshop
  globalThis.localStorage = { getItem: () => JSON.stringify(old) }
  const migrated = readSave(); assert.equal(itemQuantity(migrated.storehouse, 'coal'), 7); assert.equal(migrated.workshop.fuel, 240)
  const full = initialState(); full.inventory = [{ id: 'heavy', itemId: 'coal', quantity: 30 }]
  const storageBefore = JSON.stringify(full.storehouse)
  assert.equal(action(full, 'transfer', { from: 'storehouse', id: 'store-coal' }).error, 'capacity')
  assert.equal(JSON.stringify(full.storehouse), storageBefore, 'Rejected withdrawal consumes nothing')
  const thermal = initialState()
  thermal.workshop = normalizeWorkshop({ blade: { stage: 'hammering', temperature: 1400, heating: false, work: Array(16).fill(100) } })
  tick(thermal, .2); assert(thermal.workshop.blade.heatDamage > 0)
  thermal.workshop.blade.temperature = 900
  for (let i = 0; i < 10; i++) tick(thermal, .2)
  assert.equal(thermal.workshop.blade.heatDamage, 0, 'Working heat recovers heat penalties')
  thermal.workshop.blade.stage = 'shaped'; thermal.workshop.blade.temperature = 820
  thermal.workshop.working = true
  assert(!action(thermal, 'quenchStart').error)
  for (let i = 0; i < 5; i++) action(thermal, 'quenchTick', { seconds: .25, medium: 'water' })
  const interrupted = normalizeWorkshop(JSON.parse(JSON.stringify(thermal.workshop)))
  assert.equal(interrupted.blade.stage, 'quenched'); assert.equal(interrupted.blade.quench, 50)
  const map = await render(Map, { completedQuests: ['bandit_ambush_survived'], workshop: game.workshop })
  assert(map.includes('/images/interior/')); assert.deepEqual(missing, [])
  const stable = initialState(); stable.workshop.temperature = 1600; stable.workshop.fuel = 480
  stable.workshop.working = true
  assert(!action(stable, 'coolForge').error)
  const previousHeat = stable.workshop.temperature
  tick(stable, .5)
  assert(stable.workshop.temperature < previousHeat && stable.workshop.temperature >= previousHeat - 3, 'Cooling is gradual')
  assert(stable.workshop.damping > 0, 'Water damping persists between ticks')
  const savedDamping = normalizeWorkshop(stable.workshop); assert(savedDamping.damping > 0)
  for (const roll of [0, .5, .999]) { const robbed = initialState(), amount = robPlayer(robbed, () => roll); assert(amount >= 40 && amount <= 50); assert.equal(robbed.coins, 120 - amount); assert(robbed.coins + 40 >= 98, 'One dishwashing shift covers the errand shortfall') }
  const poor = initialState(); poor.coins = 20; robPlayer(poor, () => 1); assert.equal(poor.coins, 1)
  const errand = initialState(); assert(canEnterSmithy(errand)); errand.leftHomeForErrand = true; assert(!canEnterSmithy(errand))
  errand.inventory.push({ id: 'ore', itemId: 'iron_ore', quantity: 4 }, { id: 'coal', itemId: 'coal', quantity: 3 }); assert(!canEnterSmithy(errand))
  errand.inventory.find(e => e.itemId === 'coal').quantity++; assert(!canEnterSmithy(errand)); errand.inventory.push({ id: 'guard', itemId: 'dagger_guard', quantity: 1 }, { id: 'handle', itemId: 'dagger_handle', quantity: 1 }, { id: 'pommel', itemId: 'dagger_pommel', quantity: 1 }); assert(canEnterSmithy(errand))
  errand.completedQuests.push('iron_stock_bought'); errand.inventory = []; assert(canEnterSmithy(errand), 'Later crafting consumption never locks home again')
  const embedded = await render(Dialog, { game, station: 'reference', embedded: true })
  assert(embedded.includes('1,538')); assert(embedded.includes('1,085')); assert(!embedded.includes('aria-modal="true"')); assert(!embedded.includes('<nav'))
  const directMap = await render(Map, { completedQuests: ['bandit_ambush_survived'], workshop: stable.workshop, inventory: stable.inventory })
  for (const label of ['Dampen the fire', 'Read workshop notes', 'Add coal', 'Work bellows']) assert(directMap.includes(label), label)
  for (const label of ['Sleep', 'Storehouse', 'Back to town']) assert(!directMap.includes('title="' + label + '"'), 'Working mode hides ' + label)
  stable.workshop.working = false
  const idleMap = await render(Map, { completedQuests: ['bandit_ambush_survived'], workshop: stable.workshop, inventory: stable.inventory })
  assert(idleMap.includes('START BLACKSMITHING')); assert(!idleMap.includes('title="Work bellows"')); assert(!idleMap.includes('title="Add coal"'))
  const empty = initialState(); empty.inventory = []; empty.storehouse = []
  assert.equal(action(empty, 'start').error, 'noSupplies'); assert(!empty.workshop.working)
  assert.equal(action(empty, 'coal').error, 'startFirst')
  const hot = initialState(); hot.workshop.working = true; hot.workshop.fuel = 480; hot.workshop.temperature = 1800
  tick(hot, .5); assert(hot.workshop.temperature < 1800, 'Fuel alone cannot make heat climb')
  const cold = initialState(); cold.workshop.working = true; cold.workshop.fuel = 480
  action(cold, 'bellows'); const firstBoost = cold.workshop.air
  assert(firstBoost >= 150 && firstBoost <= 200)
  assert.equal(action(cold, 'bellows').error, 'bellowsRecovering')
  tick(cold, .5); const queued = cold.workshop.air; action(cold, 'bellows')
  assert(cold.workshop.air - queued < firstBoost, 'Queued combustion also reduces the next impulse')
  action(hot, 'bellows'); assert(hot.workshop.air < firstBoost / 5, 'Hotter fires gain much less from a pump')
  const once = initialState(); once.workshop.working = true; once.workshop.fuel = 480; action(once, 'bellows')
  for (let i = 0; i < 40; i++) tick(once, .5)
  assert(once.workshop.temperature > 175 && once.workshop.temperature < 225, 'A cold press gives about 150–200 degrees over time')
  const peak = once.workshop.temperature
  for (let i = 0; i < 200; i++) tick(once, .5)
  assert(once.workshop.temperature < peak && once.workshop.temperature >= 25)

  const pourGame = (melt = 100, temperature = 1600) => {
    const g = initialState(); g.workshop.working = true
    Object.assign(g.workshop.crucible, { ore: 'iron_ore', count: 4, carbon: 1, stage: melt === 100 ? 'molten' : 'melting', reduction: 100, melt, temperature, vesselTemperature: temperature })
    assert(action(g, 'pour').pouring); return g
  }
  const pourFor = (g, height, seconds) => {
    assert(!action(g, 'pourControl', { holding: true, height }).error)
    for (let elapsed = 0; elapsed < seconds && g.workshop.pour; elapsed += .05) tick(g, .05)
    if (g.workshop.pour) action(g, 'pourControl', { holding: false })
  }
  const clean = pourGame(); pourFor(clean, .65, 5.6)
  assert(!clean.workshop.pour); assert(clean.workshop.mould.fill >= .99); assert.equal(clean.workshop.mould.castingQuality, 100)
  const pausedPour = pourGame(); pourFor(pausedPour, .65, 2)
  const beforePause = pausedPour.workshop.mould.fill, oldHeat = pausedPour.workshop.crucible.temperature
  for (let i = 0; i < 5; i++) tick(pausedPour, .1)
  assert.equal(pausedPour.workshop.mould.fill, beforePause); assert(pausedPour.workshop.crucible.temperature < oldHeat)
  pourFor(pausedPour, .65, 4); assert(!pausedPour.workshop.mould.ruined, 'Releasing and resuming while liquid does not ruin a casting')
  const frozen = pourGame(); pourFor(frozen, .65, 1)
  for (let i = 0; i < 300 && frozen.workshop.pour; i++) tick(frozen, .1)
  assert(frozen.workshop.mould.ruined); assert.equal(frozen.workshop.crucible.stage, 'residue')
  assert.equal(action(frozen, 'collect').error, 'notReady')
  assert.equal(action(frozen, 'dumpResidue').error, 'residueCold')
  assert(!action(frozen, 'discardCasting').error)
  frozen.workshop.fuel = 480; assert(!action(frozen, 'reheatResidue').error)
  frozen.workshop.temperature = 1800
  for (let i = 0; i < 300 && (frozen.workshop.crucible.melt < 99 || frozen.workshop.crucible.temperature < 1538); i++) { frozen.workshop.temperature = 1800; tick(frozen, .2) }
  assert(!action(frozen, 'dumpResidue').error); assert.equal(frozen.workshop.crucible.stage, 'empty')
  const underfilled = pourGame(); pourFor(underfilled, .65, 3); action(underfilled, 'finishPour')
  assert(underfilled.workshop.mould.fill < .95 && underfilled.workshop.mould.ruined)
  underfilled.completedQuests.push('iron_stock_bought')
  const practiceOre = itemQuantity(underfilled.inventory, 'iron_ore')
  assert(!action(underfilled, 'discardCasting').error)
  assert.equal(itemQuantity(underfilled.inventory, 'iron_ore'), practiceOre + 4, 'Father replaces four iron ore after a failed tutorial ingot')
  assert.equal(action(underfilled, 'discardCasting').error, 'notReady')
  assert.equal(itemQuantity(underfilled.inventory, 'iron_ore'), practiceOre + 4, 'The same casting cannot grant ore twice')
  const marginal = pourGame(); pourFor(marginal, .65, 5.25); action(marginal, 'finishPour')
  assert(marginal.workshop.mould.fill >= .95); assert(!marginal.workshop.mould.ruined); assert(marginal.workshop.mould.castingQuality < 85)
  const spilled = pourGame(); pourFor(spilled, .76, 6)
  assert(spilled.workshop.mould.ruined || spilled.workshop.mould.castingQuality < 50, 'Large spills drastically penalize the ingot')
  const partial = pourGame(60, 1700); pourFor(partial, .65, 1)
  assert(partial.workshop.mould.fill > 0 && partial.workshop.crucible.melt > 0, 'Partial charges can pour using retained heat')
  assert.equal(action(partial, 'stop').error, 'finishPourFirst')
  const resumed = normalizeWorkshop(JSON.parse(JSON.stringify(partial.workshop)))
  assert(resumed.pour && !resumed.pour.holding); assert.equal(resumed.mould.fill, partial.workshop.mould.fill, 'Reload pauses the flow without advancing cooling offline')
  const { default: Pouring } = await server.ssrLoadModule('/src/components/PouringGame.vue')
  const pouringHtml = await render(Pouring, { workshop: partial.workshop })
  assert(pouringHtml.includes('role="dialog"')); assert(pouringHtml.includes('Hold and lift crucible')); assert(pouringHtml.includes('Mould filled'))
  const castBlade = { work: Array(16).fill(100), quench: 100, assembly: [100, 100, 100], sharpness: Array(16).fill(100), castingQuality: 40 }
  assert.equal(bladeQuality(castBlade), 40, 'Later perfect work cannot erase casting defects')
  const castingItem = { id: 'cast-ingot', itemId: 'iron_ingot', quantity: 1, castingQuality: 40 }
  assert.equal(normalizeInventory([castingItem])[0].castingQuality, 40)
  assert.equal(clampAssemblyPosition(-1), .44); assert.equal(clampAssemblyPosition(2), .56)
  assert.equal(assemblyAccuracy(.5), 100); assert(assemblyAccuracy(.44) < .001); assert(assemblyAccuracy(.56) < .001)
  assert(Math.abs(assemblyAccuracy(.47) - 50) < .001, 'Accuracy remains challenging within the narrower movement range')
  const moved = initialState(); moved.inventory.push(castingItem)
  assert(!action(moved, 'transfer', { from: 'bag', id: castingItem.id }).error)
  const storedCasting = moved.storehouse.find(e => e.itemId === 'iron_ingot')
  assert.equal(storedCasting.castingQuality, 40)
  assert(!action(moved, 'transfer', { from: 'storehouse', id: storedCasting.id }).error)
  assert(!action(moved, 'start').error); assert(!action(moved, 'rackIngot', { itemId: 'iron_ingot' }).error)
  assert(!action(moved, 'heatIngot', { id: moved.workshop.rack[0].id }).error)
  assert.equal(moved.workshop.blade.castingQuality, 40)
  // Drive the actual pointer/keyboard handlers against the workshop model.
  const node = type => ({ type, children: [], parent: null })
  const renderer = createRenderer({
    createElement: node, createText: node, createComment: node, setText() {}, setElementText() {}, patchProp() {},
    parentNode: n => n.parent, nextSibling: () => null,
    insert(n, parent) { n.parent = parent; parent.children.push(n) }, remove() {}
  })
  const oldWindow = globalThis.window, oldDocument = globalThis.document
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.document = { pointerLockElement: null, addEventListener() {}, removeEventListener() {}, exitPointerLock() { this.pointerLockElement = null } }
  try {
    const oldTimeout = globalThis.setTimeout, oldClearTimeout = globalThis.clearTimeout, oldRandom = Math.random
    Math.random = () => .75
    const timeouts = new globalThis.Map(); let timerSerial = 0, now = 0
    globalThis.setTimeout = (callback, delay) => { timeouts.set(++timerSerial, { callback, due: now + delay }); return timerSerial }
    globalThis.clearTimeout = id => timeouts.delete(id)
    try {
      const assemblyGame = reactive(initialState())
      assemblyGame.workshop.working = true
      assemblyGame.workshop.blade = { stage: 'quenched', parts: 0, temperature: 20, work: Array(16).fill(100), quench: 100, assembly: [0, 0, 0], sharpness: Array(16).fill(0) }
      assemblyGame.inventory.push({ id: 'test-guard', itemId: 'dagger_guard', quantity: 1 }, { id: 'test-handle', itemId: 'dagger_handle', quantity: 1 }, { id: 'test-pommel', itemId: 'dagger_pommel', quantity: 1 })
      const config = reactive({ paused: false }), contacts = [], busy = []
      const AssemblyView = { ...Assembly, render: () => h('div') }
      const assemblyApp = renderer.createApp({ render: () => h(AssemblyView, { blade: assemblyGame.workshop.blade, inventory: assemblyGame.inventory, paused: config.paused, onCommand: (command, p) => { contacts.push(command); action(assemblyGame, command, p) }, onBusy: value => busy.push(value) }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
      assemblyApp.mount(node('root'))
      const fitting = assemblyApp._instance.subTree.component.setupState, captured = new Set()
      let lockRequests = 0
      fitting.scene = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 190 }), setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id), requestPointerLock() { lockRequests++; globalThis.document.pointerLockElement = fitting.scene } }
      const pointer = (x = 200, button = 0, pointerType = 'mouse') => ({ clientX: x, clientY: 90, button, pointerType, pointerId: 1 })
      assert.equal(fitting.offset, 10, 'Each new part starts randomly within +/-20 CSS pixels')
      fitting.enter(pointer()); fitting.lockChanged()
      assert.equal(lockRequests, 1); assert.equal(globalThis.document.pointerLockElement, fitting.scene, 'Entering requests and keeps capture without holding any button')
      assert(Math.abs((fitting.position - .5) * fitting.artWidth - 10) < .0001, 'Start offset is physical pixels at compact view sizes')
      fitting.lockedMove({ type: 'mousemove', movementX: -1000 }); assert.equal(fitting.offset, -30)
      fitting.lockedMove({ type: 'mousemove', movementX: 1 }); assert.equal(fitting.offset, -29, 'Reversing moves immediately without a dead zone')
      fitting.lockedMove({ type: 'mousemove', movementX: 1000 }); assert.equal(fitting.offset, 30)
      assert(Math.abs((fitting.position - .5) * fitting.artWidth - 30) < .0001, 'Travel limit is 30 CSS pixels, independent of SVG scaling')
      fitting.lockedMove({ type: 'mousemove', movementX: -30 }); assert.equal(fitting.offset, 0)
      fitting.lockedPress({ button: 0 }); fitting.lockedPress({ button: 0 })
      assert.equal(fitting.phase, 'falling'); assert.equal(globalThis.document.pointerLockElement, null, 'Click drops and releases capture')
      const advance = milliseconds => { now += milliseconds; for (const [id, timer] of [...timeouts]) if (timer.due <= now) { timeouts.delete(id); timer.callback() } }
      advance(699); assert.equal(contacts.length, 0)
      advance(1); assert.deepEqual(contacts, ['assemble']); assert.equal(assemblyGame.workshop.blade.assembly[0], 100)
      assert.equal(fitting.phase, 'contact'); assert.equal(busy.at(-1), true)
      Math.random = () => 0; advance(1000); assert.equal(fitting.offset, -20); assert.equal(busy.at(-1), false)
      Math.random = () => 1; fitting.enter(pointer(200, 0, 'touch')); assert.equal(fitting.offset, -20, 'Re-entry does not reroll a part that has already appeared')
      for (let i = 0; i < 5; i++) fitting.nudge(1)
      fitting.beginDrag(pointer(200, 0, 'touch')); assert(captured.has(1))
      fitting.endDrag(pointer(9000, 0, 'touch')); assert.equal(fitting.phase, 'aiming', 'Touch release outside the frame is ignored')
      fitting.beginDrag(pointer(200, 0, 'touch')); fitting.endDrag(pointer(200, 0, 'touch')); advance(700)
      assert.equal(assemblyGame.workshop.blade.stage, 'quenched'); assert.equal(assemblyGame.workshop.blade.assembly[1], 50)
      advance(1000); fitting.enter(pointer()); fitting.mousePress(pointer()); advance(700)
      assert.equal(assemblyGame.workshop.blade.stage, 'assembled'); assert(Number.isFinite(assemblyGame.workshop.blade.assembly[2]))
      const result = await render(Assembly, { blade: assemblyGame.workshop.blade, inventory: assemblyGame.inventory })
      assert(result.includes('Guard fit: 100%') && result.includes('Handle fit: 50%')); assert(!result.includes('assembly-drop'))
      advance(1000); assemblyApp.unmount(); assert.equal(timeouts.size, 0)
      assemblyGame.workshop.blade.stage = 'quenched'; assemblyGame.workshop.blade.parts = 0
      assemblyGame.inventory.push({ id: 'replacement', itemId: 'dagger_guard', quantity: 1 })
      const cancelApp = renderer.createApp({ render: () => h(AssemblyView, { blade: assemblyGame.workshop.blade, inventory: assemblyGame.inventory, paused: config.paused, onCommand: command => contacts.push(command) }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
      cancelApp.mount(node('root'))
      const cancelled = cancelApp._instance.subTree.component.setupState
      cancelled.scene = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 190 }), requestPointerLock() { throw new Error('User activation required') } }
      cancelled.enter(pointer()); assert.equal(cancelled.captureState, 'blocked', 'Denied hover capture has an explicit activation prompt')
      const oldOffset = cancelled.offset; cancelled.move(pointer(9000)); assert.equal(cancelled.offset, oldOffset)
      cancelled.beginDrag(pointer()); assert.equal(cancelled.phase, 'falling', 'First click drops even when hover capture was denied')
      cancelled.mousePress({ ...pointer(), button: 0 }); assert.equal(timeouts.size, 1, 'Companion mouse events cannot schedule duplicate drops')
      config.paused = true; await nextTick(); advance(1000)
      config.paused = false; await nextTick()
      cancelled.mousePress({ ...pointer(), button: 2 }); assert.equal(cancelled.phase, 'falling', 'Right-click MouseEvents also drop without Pointer Lock')
      config.paused = true; await nextTick(); advance(1000)
      assert.equal(contacts.length, 3); assert.equal(timeouts.size, 0)
      cancelApp.unmount()
    } finally { globalThis.setTimeout = oldTimeout; globalThis.clearTimeout = oldClearTimeout; Math.random = oldRandom }
    // Compile and drive the actual client template: earlier setup-only tests
    // could pass without proving that the visible fitting changed position.
    const clientPath = new URL('../.tmp/assembly-client-check.js', import.meta.url)
    mkdirSync(new URL('../.tmp/', import.meta.url), { recursive: true })
    const descriptor = parse(readFileSync(new URL('../src/components/DaggerAssembly.vue', import.meta.url), 'utf8')).descriptor
    const clientCode = compileScript(descriptor, { id: 'assembly-client-check', inlineTemplate: true }).content.replace("from '../inventory'", "from '/src/inventory'").replace("from '../workshop'", "from '/src/workshop'").replace("from '../weapon-design'", "from '/src/weapon-design'")
    writeFileSync(clientPath, clientCode)
    const previousDocument = globalThis.document
    const listeners = new globalThis.Map()
    globalThis.document = {
      pointerLockElement: null,
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback) },
      exitPointerLock() { this.pointerLockElement = null; for (const callback of listeners.get('pointerlockchange') || []) callback() }
    }
    try {
      const { default: ClientAssembly } = await server.ssrLoadModule('/.tmp/assembly-client-check.js')
      const element = type => markRaw({ type, props: {}, children: [], parent: null,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 190 }),
        requestPointerLock() { globalThis.document.pointerLockElement = this; for (const callback of listeners.get('pointerlockchange') || []) callback() }
      })
      const realRenderer = createRenderer({
        createElement: element, createText: text => ({ ...element('text'), text }), createComment: text => ({ ...element('comment'), text }),
        setText(n, text) { n.text = text }, setElementText(n, text) { n.text = text }, patchProp(n, key, old, value) { n.props[key] = value },
        parentNode: n => n.parent, nextSibling: () => null,
        insert(n, parent) { n.parent = parent; parent.children.push(n) }, remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1) }
      })
      const fixture = reactive(initialState()); fixture.workshop.working = true; fixture.workshop.blade = { stage: 'quenched', parts: 0, assembly: [0, 0, 0] }
      fixture.inventory.push({ id: 'client-guard', itemId: 'dagger_guard', quantity: 1 })
      const root = element('root')
      const clientApp = realRenderer.createApp({ render: () => h(ClientAssembly, { blade: fixture.workshop.blade, inventory: fixture.inventory, onCommand: (command, params) => action(fixture, command, params) }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
      clientApp.mount(root)
      const find = (n, className) => String(n.props?.class || '').split(' ').includes(className) ? n : n.children?.map(child => find(child, className)).find(Boolean)
      const arena = find(root, 'assembly-arena'), sprite = find(root, 'assembly-flight')
      assert(arena && sprite)
      arena.props.onPointerenter({ pointerType: 'mouse', clientX: 200, clientY: 90 })
      assert.equal(globalThis.document.pointerLockElement, arena)
      const beforeMove = sprite.props.style.left
      for (const callback of listeners.get('mousemove')) callback({ type: 'mousemove', movementX: 5, movementY: 0, clientX: 200, timeStamp: 100 })
      await nextTick(); assert.notEqual(sprite.props.style.left, beforeMove, 'Mouse events must visibly move the actual rendered fitting')
      const beforePointer = sprite.props.style.left
      const pointerEvent = { type: 'pointermove', movementX: -7, movementY: 0, clientX: 200, timeStamp: 200 }
      arena.props.onPointermove(pointerEvent)
      for (const callback of listeners.get('pointermove')) callback(pointerEvent)
      await nextTick(); assert.notEqual(sprite.props.style.left, beforePointer, 'Pointer-only browsers must visibly move the fitting too')
      const afterPointer = sprite.props.style.left
      for (const callback of listeners.get('mousemove')) callback({ ...pointerEvent, type: 'mousemove' })
      await nextTick(); assert.equal(sprite.props.style.left, afterPointer, 'Companion mouse/pointer events must not count the same motion twice')
      globalThis.document.exitPointerLock()
      fixture.inventory = []; await nextTick()
      const missingBefore = sprite.props.style.left
      arena.props.onPointermove({ pointerType: 'mouse', clientX: 190, clientY: 90, pointerId: 1 })
      await nextTick(); assert.notEqual(sprite.props.style.left, missingBefore, 'Missing stock must not silently disable aiming')
      fixture.inventory.push({ id: 'restocked-guard', itemId: 'dagger_guard', quantity: 1 }); await nextTick()
      arena.props.onMousedown({ button: 0, clientX: 190, clientY: 90, preventDefault() {} })
      await nextTick(); assert(find(root, 'assembly-part--falling'), 'Clicking the actual rendered frame starts the fall without mouse capture')
      await new Promise(resolve => setTimeout(resolve, 730))
      assert.equal(fixture.workshop.blade.parts, 1, 'Real mouse input must commit the guard through the actual inventory model')
      assert.equal(itemQuantity(fixture.inventory, 'dagger_guard'), 0)
      await new Promise(resolve => setTimeout(resolve, 1010))
      fixture.inventory.push({ id: 'client-handle', itemId: 'dagger_handle', quantity: 1 }); await nextTick()
      const touchEvent = { changedTouches: [{ identifier: 5, clientX: 200, clientY: 90 }], preventDefault() {} }
      arena.props.onTouchstart(touchEvent)
      arena.props.onTouchmove({ ...touchEvent, changedTouches: [{ identifier: 5, clientX: 205, clientY: 90 }] })
      arena.props.onTouchend(touchEvent)
      await nextTick(); assert(find(root, 'assembly-part--falling'), 'Native touch release starts the fall')
      await new Promise(resolve => setTimeout(resolve, 730))
      assert.equal(fixture.workshop.blade.parts, 2); assert.equal(fixture.workshop.blade.stage, 'quenched', 'The handle leaves the pommel step pending')
      await new Promise(resolve => setTimeout(resolve, 1010))
      fixture.inventory.push({ id: 'client-pommel', itemId: 'dagger_pommel', quantity: 1 }); await nextTick()
      arena.props.onTouchstart(touchEvent); arena.props.onTouchend(touchEvent); await nextTick()
      await new Promise(resolve => setTimeout(resolve, 730))
      assert.equal(fixture.workshop.blade.parts, 3); assert.equal(fixture.workshop.blade.stage, 'assembled', 'Native touch commits the pommel as the final fitting')
      clientApp.unmount(); assert.equal(globalThis.document.pointerLockElement, null)
      assert([...listeners.values()].every(set => set.size === 0), 'All real client event listeners are cleaned up')
      const grindingPath = new URL('../.tmp/grinding-client-check.js', import.meta.url)
      const grindingDescriptor = parse(readFileSync(new URL('../src/components/DaggerSharpening.vue', import.meta.url), 'utf8')).descriptor
      const grindingCode = compileScript(grindingDescriptor, { id: 'grinding-client-check', inlineTemplate: true }).content.replace("from '../inventory'", "from '/src/inventory'").replace("from '../workshop'", "from '/src/workshop'").replace("from '../weapon-design'", "from '/src/weapon-design'").replace("from '../grinding'", "from '/src/grinding'")
      writeFileSync(grindingPath, grindingCode)
      try {
        const { default: ClientSharpening } = await server.ssrLoadModule('/.tmp/grinding-client-check.js')
        fixture.workshop.blade.sharpness = Array(16).fill(0)
        const grindingRoot = element('root')
        const sharpeningApp = realRenderer.createApp({ render: () => h(ClientSharpening, { blade: fixture.workshop.blade, onCommand: (command, params) => action(fixture, command, params) }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
        sharpeningApp.mount(grindingRoot)
        const grindingArena = find(grindingRoot, 'grinding-arena')
        const point = { button: 0, pointerId: 7, clientX: 200, clientY: 76, currentTarget: grindingArena, preventDefault() {} }
        grindingArena.props.onPointerdown(point); await nextTick()
        const widthBefore = find(grindingRoot, 'grinding-dagger').props.transform
        await new Promise(resolve => setTimeout(resolve, 110))
        fixture.workshop.blade.sharpness.slice(0, 8).forEach((v, i) => assert.equal(v > 0, grindingContactCells(.5, .4, 0).includes(i), 'Actual input sharpens overlapping horizontal blade cells'))
        assert(fixture.workshop.blade.sharpness.slice(8).every(v => v === 0))
        grindingArena.props.onPointermove({ ...point, clientY: 190 }); await nextTick()
        assert.notEqual(find(grindingRoot, 'grinding-dagger').props.transform, widthBefore, 'Vertical mouse movement changes the displayed dagger width')
        grindingArena.props.onPointerup()
        const released = [...fixture.workshop.blade.sharpness]
        await new Promise(resolve => setTimeout(resolve, 100))
        assert.deepEqual(fixture.workshop.blade.sharpness, released, 'Releasing stops every contacted cell')
        const buttons = find(grindingRoot, 'grinding-buttons').children.filter(n => n.type === 'button')
        buttons[0].props.onClick(); await nextTick()
        grindingArena.props.onPointerdown(point); await new Promise(resolve => setTimeout(resolve, 100))
        fixture.workshop.blade.sharpness.slice(8).forEach((v, i) => assert.equal(v > 0, grindingContactCells(.5, .4, 1).includes(i + 8), 'Flipping works the opposite contacted cells'))
        sharpeningApp.unmount()
      } finally { unlinkSync(grindingPath) }
    } finally { globalThis.document = previousDocument; unlinkSync(clientPath) }
    const TownView = { ...Town, render: () => h('div') }, jobs = []
    const townApp = renderer.createApp({ render: () => h(TownView, { currentLocation: 'tavern', selectedId: 'tavern', pawnPosition: { x: 0, y: 0 }, completedQuests: ['market_job_notice_read', 'tavern_work_offered'], onJob: (...args) => jobs.push(args) }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
    townApp.mount(node('root'))
    const town = townApp._instance.subTree.component.setupState, tavern = townPlaces.find(p => p.id === 'tavern'), smithy = townPlaces.find(p => p.id === 'smithy')
    const workAction = town.actions(tavern).find(a => a.id === 'work')
    assert(workAction, 'Tavern keeps its jobs button')
    assert(town.actions(tavern).some(a => a.id === 'trade')); assert(!town.actions(smithy).some(a => a.id === 'work'))
    town.handleAction(workAction, tavern); assert.equal(town.workMenu, 'tavern')
    assert.deepEqual(town.jobs(tavern).map(j => j.id), ['wood', 'dishes'])
    town.handleJob(town.jobs(tavern)[0], tavern); assert.deepEqual(jobs, [['wood', 'tavern']])
    townApp.unmount()
    const interactive = reactive(pourGame()), config = reactive({ paused: false })
    const View = { ...Pouring, render: () => h('div') }
    const app = renderer.createApp({ render: () => h(View, { workshop: interactive.workshop, paused: config.paused, onCommand: (a, p) => action(interactive, a, p) }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
    app.mount(node('root'))
    const state = app._instance.subTree.component.setupState
    state.arena = { getBoundingClientRect: () => ({ bottom: 250, height: 250 }) }
    let captured = false
    state.start({ preventDefault() {}, pointerId: 1, clientY: 105, currentTarget: { setPointerCapture() { captured = true } } })
    assert(captured && interactive.workshop.pour.holding)
    assert(interactive.workshop.pour.height > .7, 'Dragging higher maps to faster flow')
    state.lower(); assert(!interactive.workshop.pour.holding); assert.equal(interactive.workshop.pour.height, 0)
    assert(interactive.workshop.pour, 'Releasing lowers the crucible without ending the pour')
    state.key({ key: ' ', repeat: false, preventDefault() {} })
    const keyboardHeight = interactive.workshop.pour.height
    state.key({ key: 'ArrowUp', preventDefault() {} }); assert(interactive.workshop.pour.height > keyboardHeight)
    config.paused = true; await nextTick(); assert(!interactive.workshop.pour.holding, 'Settings pause lowers the crucible')
    app.unmount()
    const realInterval = globalThis.setInterval, realClear = globalThis.clearInterval
    const performanceDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance')
    let clock = 0, frame
    globalThis.setInterval = callback => { frame = callback; return 1 }
    globalThis.clearInterval = () => { frame = null }
    Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } })
    try {
      const ui = reactive({ paused: false, guiding: true, occupied: false })
      const MapView = { ...Map, render: () => h('div') }
      const mapApp = renderer.createApp({ render: () => h(MapView, { ...ui, completedQuests: ['bandit_ambush_survived'], workshop: initialState().workshop }) }).provide(ssrContextKey, { modules: new Set() }).use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
      mapApp.mount(node('root'))
      const instance = mapApp._instance.subTree.component, navigation = instance.exposed, actors = instance.setupState
      const advance = frames => { for (let i = 0; i < frames; i++) { clock += 40; frame?.() } }
      const arrived = []
      navigation.approach('furnace', () => arrived.push('command'))
      navigation.approach('furnace', () => arrived.push('panel'))
      advance(10); assert.equal(arrived.length, 0)
      ui.paused = true; await nextTick(); const position = [actors.player.x, actors.player.y]
      advance(20); assert.deepEqual([actors.player.x, actors.player.y], position, 'Settings freeze interior movement')
      ui.paused = false; await nextTick(); advance(250)
      assert.deepEqual(arrived, ['command', 'panel'], 'Opening a panel after an action at the same destination preserves both callbacks')
      assert(navigation.isNear('furnace'))
      assert.equal(actors.father.x, forgeFloor.fatherNook[0], 'Father stands still while explaining')
      navigation.approach('mould', () => arrived.push('cancelled'))
      advance(5); navigation.approach('grinder', () => arrived.push('latest')); advance(300)
      assert(!arrived.includes('cancelled') && arrived.includes('latest'), 'A new destination replaces the previous action')
      ui.guiding = false; await nextTick(); advance(150)
      assert(actors.father.x !== forgeFloor.fatherNook[0], 'Father uses the aisle graph while idle')
      mapApp.unmount(); assert.equal(frame, null)
    } finally { globalThis.setInterval = realInterval; globalThis.clearInterval = realClear; Object.defineProperty(globalThis, 'performance', performanceDescriptor) }
  } finally { globalThis.window = oldWindow; globalThis.document = oldDocument }
  assert.deepEqual(missing, [])
  console.log('Workshop: full recipe, thermal stages, manual storage, irreversible ruined blades, quench timing, assembly, both grinding sides, saves, migration and localized UI passed')
} finally { await server.close() }

