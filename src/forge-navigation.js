// Coordinates follow the clear floor and doorways in the 3:2 interior artwork.
export const forgeFloor = {
  entry: [48, 94], hall: [48, 74], shopDoorSouth: [28, 74], shopDoor: [28, 63],
  westLower: [34, 63], anvil: [43, 44], water: [52, 44], oil: [58, 44],
  west: [28, 47], benchAisle: [18, 47], grinder: [23, 47],
  centre: [43, 43], father: [56, 42], fatherNook: [59, 39], east: [66, 38], furnace: [77, 43],
  crucibleAisle: [61, 39],
  eastLower: [76, 64], bellows: [79, 61], mould: [71, 39], crucible: [65, 39],
  rack: [72, 36], storageDoor: [65, 32], storage: [65, 24],
  bedroomDoor: [55, 32], bedroom: [53, 26], sonBed: [49, 26]
}
export const forgeAisles = [
  ['entry', 'hall'], ['hall', 'shopDoorSouth'], ['shopDoorSouth', 'shopDoor'],
  ['shopDoor', 'westLower'], ['centre', 'anvil'], ['anvil', 'water'], ['water', 'oil'],
  ['oil', 'crucibleAisle'], ['shopDoor', 'west'], ['west', 'grinder'], ['grinder', 'benchAisle'],
  ['west', 'centre'], ['centre', 'father'], ['father', 'fatherNook'], ['father', 'east'], ['east', 'furnace'],
  ['furnace', 'eastLower'], ['eastLower', 'bellows'], ['east', 'mould'], ['mould', 'furnace'], ['mould', 'crucible'],
  // Work positions stay on the clear floor above the anvil, barrels and bench.
  // No station requires crossing its furniture to reach a far-side anchor.
  ['centre', 'crucibleAisle'], ['east', 'crucibleAisle'], ['crucibleAisle', 'crucible'],
  ['east', 'rack'], ['east', 'storageDoor'], ['storageDoor', 'storage'],
  ['father', 'bedroomDoor'], ['bedroomDoor', 'bedroom'], ['bedroom', 'sonBed']
]
export const stationFloor = { door: 'entry', warehouse: 'storage', workbench: 'benchAisle', reference: 'benchAisle', design: 'benchAisle', sonBed: 'sonBed', furnace: 'furnace', bellows: 'bellows', crucible: 'crucible', mould: 'mould', rack: 'rack', anvil: 'anvil', water: 'water', oil: 'oil', idle: 'west' }
export const floorDistance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 2 / 3)
const point = id => ({ id, x: forgeFloor[id][0], y: forgeFloor[id][1] })
export const stationPoint = station => point(stationFloor[station] || 'west')
export const newForgePawn = id => ({ ...point(id), route: [], destination: null })
export function routeForgePawn(pawn, station) {
  const goal = stationFloor[station] || 'west'
  // A moving pawn may turn back along its current aisle, never cut to another aisle.
  const anchors = [pawn.id, pawn.route[0]?.id].filter(id => forgeFloor[id])
  const start = anchors.sort((a, b) => floorDistance(pawn, point(a)) - floorDistance(pawn, point(b)))[0] || 'entry'
  const costs = { [start]: 0 }, previous = {}, pending = new Set(Object.keys(forgeFloor))
  while (pending.size) {
    const current = [...pending].sort((a, b) => (costs[a] ?? Infinity) - (costs[b] ?? Infinity))[0]
    if (!Number.isFinite(costs[current])) break
    pending.delete(current)
    if (current === goal) break
    for (const edge of forgeAisles.filter(e => e.includes(current))) {
      const next = edge.find(id => id !== current), cost = costs[current] + floorDistance(point(current), point(next))
      if (cost < (costs[next] ?? Infinity)) { costs[next] = cost; previous[next] = current }
    }
  }
  const ids = [goal]
  while (ids[0] !== start && previous[ids[0]]) ids.unshift(previous[ids[0]])
  pawn.route = ids.map(point).filter((p, i) => i || floorDistance(pawn, p) > .01)
  pawn.destination = station
}
export function tickForgePawn(pawn, seconds, speed = 18) {
  let distance = Math.max(0, Math.min(.1, seconds)) * speed
  while (pawn.route.length && distance > 0) {
    const target = pawn.route[0], gap = floorDistance(pawn, target)
    if (gap <= distance) { Object.assign(pawn, target); pawn.route.shift(); distance -= gap }
    else { pawn.x += (target.x - pawn.x) * distance / gap; pawn.y += (target.y - pawn.y) * distance / gap; distance = 0 }
  }
  return !pawn.route.length
}
export function actionStation(action, params = {}, panel = 'crucible') {
  if (action === 'start') return null
  if (['coal', 'bellows', 'coolForge', 'heat', 'removeHeat', 'heatIngot'].includes(action)) return action === 'bellows' ? 'bellows' : action === 'coolForge' ? 'water' : 'furnace'
  if (['loadOre', 'loadCarbon', 'unload', 'smelt', 'pour', 'reheatResidue', 'dumpResidue'].includes(action)) return 'crucible'
  if (['collect', 'discardCasting'].includes(action)) return 'mould'
  if (['rackIngot', 'takeIngot'].includes(action)) return 'rack'
  if (['anvil', 'strike', 'shapeDone', 'discardBlade'].includes(action)) return 'anvil'
  if (['assemble', 'reseat', 'regrind', 'saveDesign'].includes(action)) return 'workbench'
  if (['grind', 'finish'].includes(action)) return 'grinder'
  if (action === 'transfer') return 'warehouse'
  if (action === 'quenchStart') return params.medium || panel
  return null
}
