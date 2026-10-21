import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
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
  assert.equal(isUnlocked([QUEST.BANDIT_AMBUSH_SURVIVED], 'jobs', 'square.wood'), true)
  assert.equal(isUnlocked([QUEST.IRON_STOCK_BOUGHT], 'forgeStations', 'anvil'), true)
  assert.equal(isUnlocked([QUEST.IRON_STOCK_BOUGHT], 'forgeStations', 'oil'), false)
  assert.equal(stageFromQuests([QUEST.FATHER_CALLED, QUEST.FATHER_MET]), 'fatherTalk')
  assert.equal(progression.activeQuests([QUEST.FATHER_CALLED])[0].id, QUEST.FATHER_MET)
  assert.equal(progression.activeQuests([QUEST.FATHER_CALLED, QUEST.FATHER_MET])[0].id, QUEST.IRON_ERRAND_ACCEPTED)
  const marketRoute = routes.routeBetween('smithy', 'market')
  assert(marketRoute.minutes > 0)
  assert.equal(marketRoute.minutes, Math.ceil(routes.pathLength(marketRoute.points) / 14))
  assert(marketRoute.points.slice(1).every((point, index) => point.x === marketRoute.points[index].x || point.y === marketRoute.points[index].y), 'Road travel must turn at right angles')
  const halfway = routes.pointOnRoute(marketRoute.points, 0.5)
  const rerouted = routes.routeFromPoint(halfway, 'square')
  assert.deepEqual(rerouted.points[0], halfway)
  assert(rerouted.minutes > 0)
  assert.deepEqual(rerouted.points.at(-1), routes.placePoint('square'))
  const scriptedJourney = { destinationId: 'market', secondsElapsed: 2, elapsedMinutes: 6, totalMinutes: 9 }
  assert.equal(travelEvents.eventForTravelTick(scriptedJourney, [QUEST.IRON_ERRAND_ACCEPTED], () => 1), 'bandits')
  assert.equal(travelEvents.eventForTravelTick(scriptedJourney, [QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED], () => 1), null)
  assert.equal(travelEvents.eventForTravelTick(scriptedJourney, [QUEST.BANDIT_AMBUSH_SURVIVED], () => 0), 'roadTraveler')

  let saved
  globalThis.localStorage = { getItem: () => JSON.stringify(saved) }
  saved = { ...game.initialState(), version: 3, stage: 'robbed' }
  delete saved.completedQuests
  let loaded = game.readSave()
  assert.equal(loaded.version, 7)
  assert(loaded.completedQuests.includes(QUEST.BANDIT_AMBUSH_SURVIVED))
  assert.equal(isUnlocked(loaded.completedQuests, 'jobs', 'tavern.dishes'), true)

  saved = { ...game.initialState(), stage: 'intro', completedQuests: [QUEST.FATHER_CALLED, QUEST.FATHER_MET, QUEST.IRON_ERRAND_ACCEPTED, QUEST.BANDIT_AMBUSH_SURVIVED, QUEST.IRON_STOCK_BOUGHT] }
  loaded = game.readSave()
  assert.equal(loaded.stage, 'materials')
  assert.equal(loaded.materials, true)
  assert.equal(isUnlocked(loaded.completedQuests, 'forgeStations', 'anvil'), true)
  saved.travel = { destinationId: 'market', route: marketRoute.points, position: halfway, totalMinutes: marketRoute.minutes, elapsedMinutes: 3, secondsElapsed: 1, pending: null }
  loaded = game.readSave()
  assert.equal(loaded.travel.elapsedMinutes, 3)
  assert.deepEqual(loaded.travel.position, halfway)
  saved.mapRevision -= 1
  loaded = game.readSave()
  assert.equal(loaded.travel, null, 'A changed town map invalidates saved travel')
  saved.mapRevision += 1
  saved.version = 6
  loaded = game.readSave()
  assert.equal(loaded.travel, null, 'Old grid routes must be discarded during migration')
  console.log('Quest progression, routing, travel events, and save migration valid')
} finally {
  await server.close()
}
