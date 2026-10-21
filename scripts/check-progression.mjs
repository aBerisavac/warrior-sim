import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
try {
  const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const appBindings = compileScript(parse(appSource).descriptor, { id: 'app-check' }).bindings
  for (const name of ['canStartDailyJob', 'canResumeDailyJob', 'startDailyJob', 'endDailyJob', 'canSleep', 'updateHunger', 'eatItem']) {
    assert(Object.hasOwn(appBindings, name), name + ' must be imported inside App.vue script setup')
  }
  const progression = await server.ssrLoadModule('/src/progression.js')
  const game = await server.ssrLoadModule('/src/game.js')
  const routes = await server.ssrLoadModule('/src/routes.js')
  const travelEvents = await server.ssrLoadModule('/src/travel-events.js')
  const { QUEST, isUnlocked, stageFromQuests } = progression
  assert.equal(isUnlocked([], 'places', 'smithy'), false)
  assert.equal(isUnlocked([QUEST.FATHER_CALLED], 'places', 'smithy'), true)
  assert.equal(isUnlocked([QUEST.FATHER_CALLED], 'actions', 'smithy.enter'), true)
  assert.equal(isUnlocked([QUEST.FATHER_CALLED], 'actions', 'smithy.info'), false)
  assert.equal(isUnlocked([QUEST.IRON_ERRAND_ACCEPTED], 'places', 'market'), true)
  assert.equal(isUnlocked([QUEST.IRON_ERRAND_ACCEPTED], 'places', 'square'), false)
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'places', 'tavern'), false)
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'actions', 'tavern.walk'), false)
  assert.equal(isUnlocked([QUEST.MARKET_JOB_NOTICE_READ], 'places', 'tavern'), true)
  assert.equal(isUnlocked([QUEST.MARKET_JOB_NOTICE_READ], 'actions', 'tavern.walk'), true)
  assert.equal(isUnlocked([QUEST.MARKET_JOB_NOTICE_READ], 'jobs', 'tavern.wood'), false)
  assert(progression.migrateCompletedQuests({ completedQuests: [QUEST.TAVERN_WORK_OFFERED] }).includes(QUEST.MARKET_JOB_NOTICE_READ))
  assert(!progression.migrateCompletedQuests({ completedQuests: [QUEST.BANDIT_AMBUSH_SURVIVED] }).includes(QUEST.MARKET_JOB_NOTICE_READ))
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'jobs', 'tavern.wood'), false)
  assert.equal(isUnlocked([QUEST.TAVERN_WORK_OFFERED], 'jobs', 'tavern.wood'), true)
  assert.equal(isUnlocked([QUEST.TAVERN_WORK_OFFERED], 'jobs', 'tavern.dishes'), true)
  assert.equal(isUnlocked([QUEST.IRON_STOCK_BOUGHT], 'forgeStations', 'anvil'), true)
  assert.equal(isUnlocked([QUEST.IRON_STOCK_BOUGHT], 'forgeStations', 'oil'), false)
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'forgeStations', 'oil'), true)
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'forgeStations', 'water'), true)
  assert.equal(stageFromQuests([QUEST.FATHER_CALLED, QUEST.FATHER_MET]), 'fatherTalk')
  assert.equal(progression.activeQuests([QUEST.FATHER_CALLED])[0].id, QUEST.FATHER_MET)
  assert.equal(progression.activeQuests([QUEST.FATHER_CALLED, QUEST.FATHER_MET])[0].id, QUEST.IRON_ERRAND_ACCEPTED)
  const woodcut = await server.ssrLoadModule('/src/woodcutting.js')
  const yields = new Set()
  const counts = new Set()
  for (let seed = 1; seed <= 200; seed += 1) {
    let state = seed
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
    random()
    random()
    const job = woodcut.createWoodcuttingJob(random)
    const total = job.reduce((sum, log) => sum + log.expectedPieces, 0)
    assert(total >= 7 && total <= 15)
    assert.equal(new Set(job.map(log => log.id)).size, job.length)
    assert(job.every(log => woodcut.WOOD_STUMPS.some(type => type.nameKey === log.nameKey && type.expectedPieces === log.expectedPieces)))
    yields.add(total)
    counts.add(job.length)
  }
  for (let target = 7; target <= 15; target += 1) {
    const job = woodcut.createWoodcuttingJob(() => (target - 7 + .5) / 9)
    assert.equal(job.reduce((sum, log) => sum + log.expectedPieces, 0), target)
  }
  assert(yields.size > 1 && counts.size > 1, 'Jobs vary in yield and number of logs')
  assert.equal(woodcut.strengthQuality(85), 100)
  assert.equal(woodcut.strengthQuality(0), 0)
  assert(woodcut.strengthQuality(100) < woodcut.strengthQuality(85))
  assert.equal(woodcut.firewoodValue(0, 0).coins, 0)
  assert.equal(woodcut.firewoodValue(100, 100).coins, 8)
  assert.equal(woodcut.firewoodValue(49, 49).coins, 0)
  assert.deepEqual(woodcut.firewoodValue(49.99, 100), { combined: 0, coins: 0 })
  assert.deepEqual(woodcut.firewoodValue(100, 49.99), { combined: 0, coins: 0 })
  assert.equal(woodcut.firewoodValue(100, 50).combined, 80)
  assert.equal(woodcut.firewoodValue(50, 100).combined, 70)
  assert.equal(woodcut.firewoodValue(50, 50).coins, 5)
  assert.equal(woodcut.firewoodValue(0, 100).coins, 0)
  assert.equal(woodcut.firewoodValue(100, 0).combined, 0)
  assert.equal(woodcut.firewoodValue(0, 100).combined, 0)
  for (const speed of [0, .5, .999999]) {
    const fresh = woodcut.chargeDuration(0, () => speed)
    const tired = woodcut.chargeDuration(1, () => speed)
    assert(fresh > 0 && tired <= 2 && tired > fresh)
    assert.equal(woodcut.chargeDuration(.6, () => speed), fresh)
  }
  const branched = woodcut.firstPiece({ ...woodcut.WOOD_STUMPS[1], branchMarks: [{ side: 0, join: 40 }, { side: 1, join: 60 }] })
  assert.equal(branched.branchMarks.length, 2)
  const branchSplit = woodcut.splitPiece(branched, -branched.angle, 0, .9)
  assert(branchSplit.children.every(piece => piece.marked && piece.branchMarks.length === 0), 'Branch marks become child targets after the main split')
  assert(woodcut.cutScore(branched, -branched.angle, 0) > woodcut.cutScore(branched, 90 - branched.angle, 0), 'The main mark is the first target')
  const blankLog = woodcut.firstPiece({ ...woodcut.WOOD_STUMPS[0], marked: false })
  assert.equal(blankLog.marked, false)
  assert.equal(blankLog.cutOffset, 0)
  const inventoryRules = await server.ssrLoadModule('/src/inventory.js')
  const starterItems = inventoryRules.startingInventory()
  const starterGear = inventoryRules.startingEquipment()
  assert.equal(inventoryRules.carriedWeight(starterItems), 5.75)
  assert.equal(inventoryRules.equippedItem(starterItems, starterGear, 'armor').id, 'leather_apron')
  const kit = [...starterItems, ...['greatsword', 'wooden_shield', 'hunting_bow', 'quiver', 'arming_sword', 'javelins', 'leather_backpack'].map(itemId => ({ id: itemId, itemId, quantity: 1 }))]
  let gear = inventoryRules.equipItem(kit, starterGear, 'wooden_shield', 'shield')
  gear = inventoryRules.equipItem(kit, gear, 'greatsword', 'weapon')
  assert(!gear.shield)
  assert.equal(inventoryRules.equipItem(kit, gear, 'wooden_shield', 'shield'), null)
  assert.equal(inventoryRules.slotBlocked(kit, gear, 'shield'), true)
  gear = inventoryRules.equipItem(kit, gear, 'hunting_bow', 'weapon')
  gear = inventoryRules.equipItem(kit, gear, 'quiver', 'waist')
  assert.equal(gear.waist, 'quiver')
  gear = inventoryRules.equipItem(kit, gear, 'arming_sword', 'weapon')
  assert(!gear.waist)
  gear = inventoryRules.equipItem(kit, gear, 'wooden_shield', 'shield')
  assert.equal(gear.shield, 'wooden_shield')
  gear = inventoryRules.equipItem(kit, gear, 'javelins', 'back')
  gear = inventoryRules.equipItem(kit, gear, 'leather_backpack', 'back')
  assert.equal(gear.back, 'leather_backpack')
  assert.equal(kit.length, 11, 'Equipping must not remove owned items')
  assert.equal(inventoryRules.equipItem(kit, gear, 'crude_hammer', 'helmet'), null)
  assert.equal(inventoryRules.canCarry([{ id: 'heavy', itemId: 'coal', quantity: 30 }], 'coal'), false)
  assert.equal(inventoryRules.canCarry([{ id: 'heavy', itemId: 'coal', quantity: 29 }], 'coal'), true)
  const rootLog = woodcut.firstPiece(woodcut.WOOD_STUMPS[0])
  const cleanSplit = woodcut.splitPiece(rootLog, 35, -rootLog.cutOffset * Math.cos(35 * Math.PI / 180), 0.9)
  assert.equal(cleanSplit.score, 100)
  assert.equal(woodcut.cutScore({ marked: true, angle: 80 }, 100, 0), 100, 'A split line is symmetric after half a turn')
  assert.equal(woodcut.cutScore({ marked: false, angle: 40 }, 70, 0), 100, 'Unmarked wood is scored by centering')
  assert.equal(cleanSplit.children.reduce((sum, piece) => sum + piece.piecesNeeded, 0), rootLog.piecesNeeded)
  assert.equal(cleanSplit.landings, 2)
  assert.deepEqual(cleanSplit.children.map(piece => piece.piecesNeeded), [1, 2], 'Ash starts with a one-third split')
  assert(Math.abs(cleanSplit.children.reduce((sum, piece) => sum + piece.fraction, 0) - 1) < 1e-9)
  assert(woodcut.WOOD_STUMPS.some(stump => stump.expectedPieces - 1 === 5), 'Include a five-cut log')
  assert(woodcut.woodcutPay([100, 100]) > woodcut.woodcutPay([0, 0]))
  for (const stump of woodcut.WOOD_STUMPS) {
    let pieces = [woodcut.firstPiece(stump)]
    let cuts = 0
    while (pieces.some((piece) => piece.piecesNeeded > 1)) {
      const piece = pieces.find((item) => item.piecesNeeded > 1)
      const result = woodcut.splitPiece(piece, -piece.angle, 0, 0)
      for (const child of result.children.filter(item => item.piecesNeeded > 1)) {
        const relativeCut = .5 + child.angle / (child.fraction * 360)
        assert(relativeCut >= 1 / 3 - 1e-9 && relativeCut <= 2 / 3 + 1e-9, 'Wedge targets must stay away from either edge')
        assert.equal(child.cutOffset, 0, 'Wedge marks pass through the center instead of skimming an edge')
        assert.equal(woodcut.cutScore(child, -child.angle, 0), 100)
      }
      pieces = [...pieces.filter((item) => item !== piece), ...result.children]
      cuts += 1
    }
    assert.equal(cuts, stump.expectedPieces - 1)
    assert.equal(pieces.length, stump.expectedPieces)
  }
  const marketRoute = routes.routeBetween('smithy', 'market')
  assert(marketRoute.minutes > 0)
  assert.equal(marketRoute.minutes, Math.ceil(routes.pathLength(marketRoute.points) / routes.mapGrid.cellSize))
  assert(marketRoute.points.slice(1).every((point, index) => point.x === marketRoute.points[index].x || point.y === marketRoute.points[index].y), 'Road travel must turn at right angles')
  const { advanceTravelClock } = await server.ssrLoadModule('/src/travel-clock.js')
  assert.equal(routes.mapGrid.secondsPerCell, 1)
  const walking = { route: [{ x: 0, y: 0 }, { x: 3 * routes.mapGrid.cellSize, y: 0 }], totalMinutes: 3, elapsedMinutes: 0, cellSeconds: 0 }
  let minutesCrossed = 0
  for (let i = 0; i < 10; i++) minutesCrossed += Number(advanceTravelClock(walking, .05, routes.mapGrid))
  assert.equal(minutesCrossed, 0); assert.equal(walking.elapsedMinutes, 0)
  assert(Math.abs(walking.position.x - routes.mapGrid.cellSize / 2) < .000001, 'Half a real second moves halfway across a tile without advancing the game minute')
  const resumedWalking = JSON.parse(JSON.stringify(walking))
  for (let i = 0; i < 10; i++) minutesCrossed += Number(advanceTravelClock(resumedWalking, .05, routes.mapGrid))
  assert.equal(minutesCrossed, 1); assert.equal(resumedWalking.elapsedMinutes, 1)
  assert(Math.abs(resumedWalking.position.x - routes.mapGrid.cellSize) < .000001, 'One real second completes exactly one tile, including after a save round-trip')
  const halfway = routes.pointOnRoute(marketRoute.points, 0.5)
  const rerouted = routes.routeFromPoint(halfway, 'square')
  assert.deepEqual(rerouted.points[0], halfway)
  assert(rerouted.minutes > 0)
  assert.deepEqual(rerouted.points.at(-1), routes.placePoint('square'))
  assert.equal(marketRoute.minutes, marketRoute.points.length - 1, 'Each road cell crossed costs one minute')
  const { createMapRoutes } = await server.ssrLoadModule('/src/map-routing.js')
  const secondMap = { columns: 4, rows: 3, cellSize: 20, terrain: ['GGR.', '.RR.', '.RG.'], buildings: [], gates: [
    { id: 'start', x: 0, y: 0, width: 2, height: 1 }, { id: 'end', x: 2, y: 2 },
  ] }
  const otherRoutes = createMapRoutes(secondMap)
  const otherJourney = otherRoutes.routeBetween('start', 'end')
  assert.equal(otherJourney.minutes, 3)
  assert(otherJourney.points.slice(1).every((point, index) => point.x === otherJourney.points[index].x || point.y === otherJourney.points[index].y))
  const { structureImage } = await server.ssrLoadModule('/src/map-upgrades.js')
  assert.equal(structureImage({ id: 'market', imageSrc: '/images/straw/Market.png' }, { market: 'stone' }), '/images/stone/Market.png')
  assert.equal(structureImage({ id: 'northGate' }, { northGate: 'mud' }), '/images/mud/North_Gate.png')
  const scriptedJourney = { destinationId: 'market', secondsElapsed: 2, elapsedMinutes: 6, totalMinutes: 9 }
  assert.equal(travelEvents.eventForTravelTick(scriptedJourney, [QUEST.IRON_ERRAND_ACCEPTED], () => 1), 'bandits')
  assert.equal(travelEvents.eventForTravelTick(scriptedJourney, [QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED], () => 1), null)
  assert.equal(travelEvents.eventForTravelTick(scriptedJourney, [QUEST.BANDIT_AMBUSH_SURVIVED], () => 0), 'roadTraveler')

  let saved
  globalThis.localStorage = { getItem: () => JSON.stringify(saved) }
  saved = { ...game.initialState(), version: 3, stage: 'robbed' }
  delete saved.completedQuests
  let loaded = game.readSave()
  assert.equal(loaded.version, 12)
  assert.deepEqual(loaded.buildingTiers, {})
  assert(loaded.completedQuests.includes(QUEST.BANDIT_AMBUSH_SURVIVED))
  assert.equal(isUnlocked(loaded.completedQuests, 'jobs', 'tavern.dishes'), false)

  saved = { ...game.initialState(), buildingTiers: { market: 'wood', ghost: 'stone' }, stage: 'intro', completedQuests: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED, QUEST.IRON_STOCK_BOUGHT] }
  loaded = game.readSave()
  assert.equal(loaded.stage, 'materials')
  assert.equal(loaded.materials, true)
  assert.deepEqual(loaded.buildingTiers, { market: 'wood' })
  assert.equal(isUnlocked(loaded.completedQuests, 'forgeStations', 'anvil'), true)
  saved.travel = { destinationId: 'market', route: marketRoute.points, position: halfway, totalMinutes: marketRoute.minutes, minutesPerCell: 3, elapsedMinutes: 3, secondsElapsed: 1, pending: null }
  loaded = game.readSave()
  assert.equal(loaded.travel.elapsedMinutes, 1)
  assert.deepEqual(loaded.travel.position, halfway)
  saved.travel.minutesPerCell = 1; saved.travel.totalMinutes = marketRoute.minutes
  loaded = game.readSave()
  assert.equal(loaded.travel.elapsedMinutes, 3)
  assert.equal(loaded.travel.totalMinutes, marketRoute.minutes)
  assert.deepEqual(loaded.travel.position, halfway)
  saved.mapRevision -= 1
  loaded = game.readSave()
  assert.equal(loaded.travel, null, 'A changed town map invalidates saved travel')
  saved.mapRevision += 1
  saved.version = 7
  loaded = game.readSave()
  assert.equal(loaded.travel, null, 'Old travel timing must be discarded during migration')
  saved = { ...game.initialState(), skipWoodcuttingIntro: true }
  assert.equal(game.readSave().skipWoodcuttingIntro, true, 'Remember the intro preference')
  delete saved.skipWoodcuttingIntro
  assert.equal(game.readSave().skipWoodcuttingIntro, false, 'Older saves show the intro by default')
  saved.skipWoodcuttingIntro = 'true'
  assert.equal(game.readSave().skipWoodcuttingIntro, false, 'Only an explicit boolean enables skipping')
  saved = { ...game.initialState(), equipment: {}, inventory: starterItems, merchantInventories: { market_smith_supplies: [{ itemId: 'coal', quantity: 7 }] } }
  assert.deepEqual(game.readSave().equipment, {})
  assert.equal(game.readSave().merchantInventories.market_smith_supplies.find(item => item.itemId === 'coal').quantity, 7)
  delete saved.inventory; delete saved.equipment
  assert.equal(game.readSave().inventory.length, 4)
  assert.equal(game.readSave().equipment.tool, 'starter-crude_hammer')
  const merchantRules = await server.ssrLoadModule('/src/merchants.js')
  const merchantId = merchantRules.MARKET_MERCHANT
  const stockOf = (state, id) => state.merchantInventories[merchantId].find(entry => entry.itemId === id)
  const agreementFor = (state, draft) => ({ fingerprint: merchantRules.offerFingerprint(draft), net: merchantRules.quoteTrade(state, merchantId, draft).net })
  const trading = game.initialState()
  trading.coins = 1000
  const order = { buy: [{ itemId: 'iron_ore', quantity: 4 }, { itemId: 'coal', quantity: 4 }], sell: [], percent: 100 }
  const untouched = JSON.stringify(trading)
  assert.equal(merchantRules.quoteTrade(trading, merchantId, order).net, 88)
  assert.equal(JSON.stringify(trading), untouched, 'Quoting must not transfer goods or gold')
  assert.equal(merchantRules.executeTrade(trading, merchantId, order, null).error, 'offerChanged')
  assert.equal(JSON.stringify(trading), untouched, 'Unconfirmed exchanges do not mutate the save')
  const deal = agreementFor(trading, order)
  assert.equal(merchantRules.executeTrade(trading, merchantId, order, deal).error, null)
  assert.equal(trading.coins, 912)
  assert.equal(merchantRules.executeTrade(trading, merchantId, order, deal).error, 'offerChanged', 'A confirmed agreement cannot be reused')
  assert.equal(inventoryRules.itemQuantity(trading.inventory, 'iron_ore'), 4)
  assert.equal(inventoryRules.itemQuantity(trading.inventory, 'coal'), 4)
  assert.equal(stockOf(trading, 'iron_ore').quantity, 44)
  const requirements = progression.questById(QUEST.IRON_STOCK_BOUGHT).requiredItems
  assert(!inventoryRules.hasRequiredItems(trading.inventory, requirements), 'Ore and coal alone do not finish the errand')
  const fittings = { buy: [{ itemId: 'dagger_guard', quantity: 1 }, { itemId: 'dagger_handle', quantity: 1 }, { itemId: 'dagger_pommel', quantity: 1 }], sell: [], percent: 100 }
  assert.equal(merchantRules.executeTrade(trading, merchantId, fittings, agreementFor(trading, fittings)).error, null)
  assert(inventoryRules.hasRequiredItems(trading.inventory, requirements))
  assert(!inventoryRules.hasRequiredItems(trading.inventory.filter(entry => entry.itemId !== 'coal'), requirements))
  const consumed = inventoryRules.consumeItems(trading.inventory, requirements)
  assert.equal(inventoryRules.itemQuantity(consumed, 'coal'), 0)
  const coalId = trading.inventory.find(entry => entry.itemId === 'coal').id
  const mixed = { buy: [{ itemId: 'copper_ingot', quantity: 1 }], sell: [{ instanceId: coalId, quantity: 2 }], percent: 100 }
  assert.equal(merchantRules.executeTrade(trading, merchantId, mixed, agreementFor(trading, mixed)).net, 36)
  assert.equal(inventoryRules.itemQuantity(trading.inventory, 'coal'), 2)
  assert.equal(inventoryRules.itemQuantity(trading.inventory, 'copper_ingot'), 1)
  assert.equal(stockOf(trading, 'coal').quantity, 46, 'Sold goods enter merchant stock')
  const sellOnly = { buy: [], sell: [{ instanceId: coalId, quantity: 2 }], percent: 100 }
  const beforeSale = trading.coins
  assert.equal(merchantRules.executeTrade(trading, merchantId, sellOnly, agreementFor(trading, sellOnly)).net, -4)
  assert.equal(trading.coins, beforeSale + 4)
  const failures = [
    { buy: [], sell: [], percent: 100 },
    { buy: [{ itemId: 'coal', quantity: 999 }], sell: [], percent: 100 },
    { buy: [{ itemId: 'coal', quantity: -1 }], sell: [], percent: 100 },
    { buy: [{ itemId: 'coal', quantity: 1.5 }], sell: [], percent: 100 },
    { buy: [{ itemId: 'coal', quantity: 1 }, { itemId: 'coal', quantity: 1 }], sell: [], percent: 100 },
    { buy: [], sell: [{ instanceId: 'starter-crude_hammer', quantity: 1 }], percent: 100 },
    { buy: [], sell: [{ instanceId: 'missing', quantity: 1 }], percent: 100 },
  ]
  for (const draft of failures) {
    const before = JSON.stringify(trading)
    assert(merchantRules.executeTrade(trading, merchantId, draft, {}).error)
    assert.equal(JSON.stringify(trading), before, 'Failed trades are atomic')
  }
  const changed = { ...order, percent: 105 }
  assert.equal(merchantRules.executeTrade(trading, merchantId, changed, deal).error, 'offerChanged')
  trading.reputation = -3
  assert.equal(merchantRules.executeTrade(trading, merchantId, order, agreementFor(trading, order)).error, 'refuse')
  trading.reputation = 0
  trading.coins = 0
  assert.equal(merchantRules.quoteTrade(trading, merchantId, order).error, 'needCoins')
  trading.coins = 100
  trading.inventory = [{ id: 'heavy', itemId: 'coal', quantity: 30 }]
  const extraCoal = { buy: [{ itemId: 'coal', quantity: 1 }], sell: [], percent: 100 }
  assert.equal(merchantRules.quoteTrade(trading, merchantId, extraCoal).error, 'inventoryFull')
  const exchangeWeight = { buy: [{ itemId: 'iron_ingot', quantity: 1 }], sell: [{ instanceId: 'heavy', quantity: 6 }], percent: 100 }
  assert(!merchantRules.quoteTrade(trading, merchantId, exchangeWeight).error, 'Selling can free capacity within the same exchange')
  stockOf(trading, 'iron_ore').quantity = 0
  trading.minutes = 3 * 1440 - 1
  merchantRules.refreshMerchantStock(trading)
  assert.equal(stockOf(trading, 'iron_ore').quantity, 0)
  trading.minutes += 1
  merchantRules.refreshMerchantStock(trading)
  assert.equal(stockOf(trading, 'iron_ore').quantity, 48)
  assert.equal(stockOf(trading, 'coal').quantity, 48)
  stockOf(trading, 'iron_ore').quantity = 2
  merchantRules.refreshMerchantStock(trading)
  assert.equal(stockOf(trading, 'iron_ore').quantity, 2)
  saved = JSON.parse(JSON.stringify(trading))
  assert.equal(game.readSave().merchantInventories[merchantId].find(entry => entry.itemId === 'iron_ore').quantity, 2)
  saved.minutes = 12 * 1440
  assert.equal(game.readSave().merchantInventories[merchantId].find(entry => entry.itemId === 'iron_ore').quantity, 48)
  const resaleState = game.initialState()
  resaleState.merchantInventories[merchantId].push({ itemId: 'crude_hammer', quantity: 1 })
  stockOf(resaleState, 'coal').quantity = 52
  saved = JSON.parse(JSON.stringify(resaleState))
  assert.equal(stockOf(game.readSave(), 'coal').quantity, 52, 'Resold quantities persist above the delivery baseline')
  resaleState.minutes = 3 * 1440
  merchantRules.refreshMerchantStock(resaleState)
  assert.equal(stockOf(resaleState, 'coal').quantity, 52)
  assert.equal(stockOf(resaleState, 'crude_hammer').quantity, 1)
  saved = { ...game.initialState(), version: 8, completedQuests: [QUEST.IRON_STOCK_BOUGHT], inventory: [...starterItems, { id: 'old-iron', itemId: 'iron_stock', quantity: 1 }] }
  const migratedSupplies = game.readSave()
  assert.equal(inventoryRules.itemQuantity(migratedSupplies.inventory, 'iron_ore'), 4)
  assert.equal(inventoryRules.itemQuantity(migratedSupplies.inventory, 'coal'), 4)
  assert(!migratedSupplies.inventory.some(entry => entry.itemId === 'iron_stock'))
  saved = { ...game.initialState(), version: 9, completedQuests: [QUEST.IRON_STOCK_BOUGHT], inventory: starterItems }
  assert.equal(inventoryRules.itemQuantity(game.readSave().inventory, 'coal'), 0, 'New saves do not duplicate sold or consumed quest supplies')
  const daily = await server.ssrLoadModule('/src/daily-jobs.js')
  const workday = game.initialState()
  assert(daily.startDailyJob(workday, 'wood'))
  assert(!daily.startDailyJob(workday, 'wood'), 'A started job cannot be started twice')
  saved = JSON.parse(JSON.stringify(workday))
  assert(daily.canResumeDailyJob(game.readSave(), 'wood'), 'Reloaded unpaid work can be reopened')
  assert(daily.endDailyJob(workday, 'wood', 'cancelled'))
  assert(!daily.endDailyJob(workday, 'wood'), 'Cancelled work cannot be paid later')
  assert(!daily.canStartDailyJob(workday, 'wood'))
  assert(!daily.canResumeDailyJob(workday, 'wood'), 'Explicitly abandoned work cannot be resumed')
  assert(daily.canStartDailyJob(workday, 'dishes'), 'Jobs have independent daily limits')
  assert(daily.startDailyJob(workday, 'dishes'))
  assert(daily.endDailyJob(workday, 'dishes'))
  assert(!daily.endDailyJob(workday, 'dishes'), 'Completed jobs cannot pay twice')
  saved = JSON.parse(JSON.stringify(workday))
  assert(!daily.canStartDailyJob(game.readSave(), 'wood'))
  assert(!daily.canStartDailyJob(game.readSave(), 'dishes'))
  workday.minutes = 1440
  assert(daily.canStartDailyJob(workday, 'wood'))
  assert(daily.canStartDailyJob(workday, 'dishes'))
  assert(daily.startDailyJob(workday, 'wood'))
  workday.minutes = 2880
  assert(daily.endDailyJob(workday, 'wood'))
  assert(daily.canStartDailyJob(workday, 'wood'), 'A shift finishing after midnight uses its starting day')
  saved = { ...game.initialState(), dailyJobs: { wood: { day: 99, status: 'completed' }, dishes: { day: 1, status: 'broken' } } }
  assert.deepEqual(game.readSave().dailyJobs, {})
  delete saved.dailyJobs
  assert.deepEqual(game.readSave().dailyJobs, {}, 'Old saves receive empty daily-job history')
  const currency = await server.ssrLoadModule('/src/currency.js')
  assert.deepEqual(currency.currencyParts(999), [{ unit: 'copper', count: 999 }])
  assert.deepEqual(currency.currencyParts(1000), [{ unit: 'silver', count: 1 }])
  assert.deepEqual(currency.currencyParts(1000000), [{ unit: 'gold', count: 1 }])
  assert.deepEqual(currency.currencyParts(2003004), [{ unit: 'gold', count: 2 }, { unit: 'silver', count: 3 }, { unit: 'copper', count: 4 }])
  assert.deepEqual(currency.currencyParts(0), [{ unit: 'copper', count: 0 }])
  assert.equal(inventoryRules.items.iron_ore.basePrice, 17)
  saved = { ...game.initialState(), version: 9, coins: 12, journal: [{ key: 'events.wood', params: { coins: 8 } }] }
  delete saved.currencyVersion
  let oldMoney = game.readSave()
  assert.equal(oldMoney.coins, 120)
  assert.equal(oldMoney.journal[0].params.coins, 80)
  saved = oldMoney
  assert.equal(game.readSave().coins, 120, 'Currency migration runs only once')
  const needs = await server.ssrLoadModule('/src/needs.js')
  const hungry = game.initialState()
  assert.equal(inventoryRules.itemQuantity(hungry.inventory, 'bread'), 3)
  hungry.hunger = 10
  hungry.minutes += 120
  needs.updateHunger(hungry)
  assert.equal(hungry.hunger, 18)
  needs.updateHunger(hungry)
  assert.equal(hungry.hunger, 18, 'Elapsed hunger is applied once')
  hungry.hunger = 70
  const breadId = hungry.inventory.find(entry => entry.itemId === 'bread').id
  assert(needs.eatItem(hungry, breadId))
  assert.equal(hungry.hunger, 35)
  assert.equal(inventoryRules.itemQuantity(hungry.inventory, 'bread'), 2)
  assert(!needs.eatItem(hungry, 'starter-crude_hammer'))
  hungry.hunger = 0
  assert(!needs.eatItem(hungry, breadId), 'Do not waste food when full')
  hungry.minutes = hungry.awakeSince + 2880 * .6 - 1
  assert(!needs.canSleep(hungry))
  hungry.minutes += 1
  assert(needs.canSleep(hungry))
  assert.equal(needs.nextMorningMinutes(2 * 60), 7 * 60)
  assert.equal(needs.nextMorningMinutes(8 * 60), 1440 + 7 * 60)
  const supplies = game.initialState().merchantInventories[merchantId]
  assert.equal(supplies.find(entry => entry.itemId === 'bread').quantity, 16 * 4 * 3 * 3)
  saved = { ...game.initialState(), version: 10, inventory: starterItems.filter(entry => entry.itemId !== 'bread') }
  delete saved.hunger
  delete saved.hungerUpdatedAt
  const breadMigration = game.readSave()
  assert.equal(inventoryRules.itemQuantity(breadMigration.inventory, 'bread'), 3)
  assert.equal(breadMigration.hunger, 20)
  saved = { ...breadMigration, inventory: breadMigration.inventory.filter(entry => entry.itemId !== 'bread') }
  assert.equal(inventoryRules.itemQuantity(game.readSave().inventory, 'bread'), 0, 'Consumed bread must not respawn on reload')
  console.log('Quest progression, routing, travel events, and save migration valid')
} finally {
  await server.close()
}
