import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
try {
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
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'jobs', 'tavern.wood'), false)
  assert.equal(isUnlocked([QUEST.TAVERN_WORK_OFFERED], 'jobs', 'tavern.wood'), true)
  assert.equal(isUnlocked([QUEST.TAVERN_WORK_OFFERED], 'jobs', 'tavern.dishes'), true)
  assert.equal(isUnlocked([QUEST.IRON_STOCK_BOUGHT], 'forgeStations', 'anvil'), true)
  assert.equal(isUnlocked([QUEST.IRON_STOCK_BOUGHT], 'forgeStations', 'oil'), false)
  assert.equal(stageFromQuests([QUEST.FATHER_CALLED, QUEST.FATHER_MET]), 'fatherTalk')
  assert.equal(progression.activeQuests([QUEST.FATHER_CALLED])[0].id, QUEST.FATHER_MET)
  assert.equal(progression.activeQuests([QUEST.FATHER_CALLED, QUEST.FATHER_MET])[0].id, QUEST.IRON_ERRAND_ACCEPTED)
  const woodcut = await server.ssrLoadModule('/src/woodcutting.js')
  const rootLog = woodcut.firstPiece(woodcut.WOOD_STUMPS[0])
  const cleanSplit = woodcut.splitPiece(rootLog, 35, 0, 0.9)
  assert.equal(cleanSplit.score, 100)
  assert.equal(woodcut.cutScore({ marked: true, angle: 80 }, 100, 0), 100, 'A split line is symmetric after half a turn')
  assert.equal(woodcut.cutScore({ marked: false, angle: 40 }, 70, 0), 100, 'Unmarked wood is scored by centering')
  assert.equal(cleanSplit.children.reduce((sum, piece) => sum + piece.piecesNeeded, 0), rootLog.piecesNeeded)
  assert.equal(cleanSplit.landings, 2)
  assert(woodcut.woodcutPay([100, 100]) > woodcut.woodcutPay([0, 0]))
  for (const stump of woodcut.WOOD_STUMPS) {
    let pieces = [woodcut.firstPiece(stump)]
    let cuts = 0
    while (pieces.some((piece) => piece.piecesNeeded > 1)) {
      const piece = pieces.find((item) => item.piecesNeeded > 1)
      const result = woodcut.splitPiece(piece, -piece.angle, 0, 0)
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
  assert.equal(loaded.version, 8)
  assert.deepEqual(loaded.buildingTiers, {})
  assert(loaded.completedQuests.includes(QUEST.BANDIT_AMBUSH_SURVIVED))
  assert.equal(isUnlocked(loaded.completedQuests, 'jobs', 'tavern.dishes'), false)

  saved = { ...game.initialState(), buildingTiers: { market: 'wood', ghost: 'stone' }, stage: 'intro', completedQuests: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED, QUEST.IRON_STOCK_BOUGHT] }
  loaded = game.readSave()
  assert.equal(loaded.stage, 'materials')
  assert.equal(loaded.materials, true)
  assert.deepEqual(loaded.buildingTiers, { market: 'wood' })
  assert.equal(isUnlocked(loaded.completedQuests, 'forgeStations', 'anvil'), true)
  saved.travel = { destinationId: 'market', route: marketRoute.points, position: halfway, totalMinutes: marketRoute.minutes, elapsedMinutes: 3, secondsElapsed: 1, pending: null }
  loaded = game.readSave()
  assert.equal(loaded.travel.elapsedMinutes, 3)
  assert.deepEqual(loaded.travel.position, halfway)
  saved.mapRevision -= 1
  loaded = game.readSave()
  assert.equal(loaded.travel, null, 'A changed town map invalidates saved travel')
  saved.mapRevision += 1
  saved.version = 7
  loaded = game.readSave()
  assert.equal(loaded.travel, null, 'Old travel timing must be discarded during migration')
  console.log('Quest progression, routing, travel events, and save migration valid')
} finally {
  await server.close()
}
