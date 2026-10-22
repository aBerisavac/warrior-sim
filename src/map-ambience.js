import { buildingCells, gateCells } from './town-grid.js'
import { WILDLIFE_DEFAULTS } from './wildlife.js'

export function ambienceFor(map) {
  return map?.id && map.ambience?.enabled && map.ambience.mapId === map.id ? map.ambience : null
}

// Stable variations keep each plant independent without changing on rerender.
export function ambienceSeed(map, x, y, salt = '') {
  let hash = 2166136261
  for (const char of `${map.id}:${x}:${y}:${salt}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) / 4294967296
}

export function vegetationMotion(map, decor) {
  const profile = ambienceFor(map)?.vegetation?.[decor.type]
  if (!profile || decor.animation === false) return null
  const seed = ambienceSeed(map, decor.x, decor.y, decor.type)
  return { '--sway-time': `${profile.seconds + seed * 3}s`, '--sway-delay': `${-seed * 17}s`, '--sway-angle': `${profile.degrees}deg` }
}

export function clearGround(map, tile) {
  if (map.terrain[tile.y]?.[tile.x] !== '.') return false
  const occupied = [...(map.buildings || []).flatMap(buildingCells), ...(map.gates || []).flatMap(gateCells), ...(map.decor || []), ...(map.cellImages || [])]
  return !occupied.some(cell => cell.x === tile.x && cell.y === tile.y)
}

export function groundAccents(map) {
  return (ambienceFor(map)?.accents || []).filter(tile => ['grass', 'flowers'].includes(tile.type) && clearGround(map, tile))
}

export function dustPatches(map) {
  return (ambienceFor(map)?.dust || []).map(patch => ({ ...patch, tiles: (patch.tiles || []).filter(tile => map.terrain[tile.y]?.[tile.x] === 'R') })).filter(patch => patch.tiles.length)
}

// A perch must name a real exposed footprint edge, never an interior roof cell.
export function roofPerch(map, anchor) {
  const building = map.buildings?.find(b => b.id === anchor?.buildingId)
  if (!building || !Number.isInteger(anchor.cell?.x) || !Number.isInteger(anchor.cell?.y)) return null
  const cells = buildingCells(building)
  const x = building.x + anchor.cell.x, y = building.y + anchor.cell.y
  const neighbors = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }
  const neighbor = neighbors[anchor.edge]
  if (!neighbor || !cells.some(c => c.x === x && c.y === y) || cells.some(c => c.x === x + neighbor[0] && c.y === y + neighbor[1])) return null
  const offset = Math.max(.15, Math.min(.85, Number.isFinite(anchor.offset) ? anchor.offset : .5))
  return { x: x + (anchor.edge === 'east' ? 1 : anchor.edge === 'west' ? 0 : offset), y: y + (anchor.edge === 'south' ? 1 : anchor.edge === 'north' ? 0 : offset) }
}

const curve = (from, control, to, t) => ({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t * t * to.x, y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t * t * to.y })
export function birdPose(map, route, seconds) {
  if (!ambienceFor(map)) return null
  if (![route.period, route.phase, route.arrival?.seconds, route.restSeconds, route.departure?.seconds].every(Number.isFinite) || route.period <= 0 || route.arrival.seconds <= 0 || route.departure.seconds <= 0) return null
  if (![route.arrival.from, route.arrival.control, route.departure.control, route.departure.to].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return null
  const perch = roofPerch(map, route.perch)
  if (!perch) return null
  const phase = ((seconds + route.phase) % route.period + route.period) % route.period
  const arrive = route.arrival.seconds, rest = route.restSeconds, depart = route.departure.seconds
  if (phase >= arrive + rest + depart) return null
  let point, flying = true, direction = 1
  if (phase < arrive) {
    const t = phase / arrive
    // Ease into the exact perch, with a short glide before touchdown.
    point = curve(route.arrival.from, route.arrival.control, perch, 1 - (1 - t) ** 1.4)
    direction = Math.sign(perch.x - route.arrival.control.x) || 1
  } else if (phase < arrive + rest) { point = perch; flying = false; direction = route.facing ?? 1 }
  else {
    point = curve(perch, route.departure.control, route.departure.to, (phase - arrive - rest) / depart)
    direction = Math.sign(route.departure.control.x - perch.x) || 1
  }
  return { x: point.x * map.cellSize, y: point.y * map.cellSize, flying, direction }
}

export function validateMapAmbience(map) {
  const config = map?.ambience
  if (!config) return []
  const errors = []
  if (!/^[a-z0-9-]+$/.test(map.id || '') || config.mapId !== map.id) errors.push('Ambience must name its owning map')
  for (const [kind, rule] of Object.entries(config.wildlife || {})) {
    if (!WILDLIFE_DEFAULTS[kind] || !Number.isFinite(rule?.chancePerSecond) || rule.chancePerSecond < 0 || rule.chancePerSecond > 1 || !Number.isInteger(rule.maxActive) || rule.maxActive < 1 || kind === 'squirrel' && rule.maxActive > 3) errors.push(`Invalid wildlife settings: ${kind}`)
  }
  const point = p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
  const ids = new Set()
  for (const bird of config.birds || []) {
    if (!bird.id || ids.has(bird.id)) errors.push('Bird routes need unique IDs')
    ids.add(bird.id)
    if (!roofPerch(map, bird.perch)) errors.push(`Invalid roof-edge perch: ${bird.id}`)
    if (![bird.arrival?.from, bird.arrival?.control, bird.departure?.control, bird.departure?.to].every(point)) errors.push(`Invalid flight points: ${bird.id}`)
    if (![bird.period, bird.arrival?.seconds, bird.restSeconds, bird.departure?.seconds].every(v => Number.isFinite(v) && v > 0) || bird.period <= bird.arrival.seconds + bird.restSeconds + bird.departure.seconds || !Number.isFinite(bird.phase)) errors.push(`Invalid bird timing: ${bird.id}`)
  }
  for (const patch of config.dust || []) {
    if (!patch.tiles?.length || patch.tiles.some(tile => !Number.isInteger(tile.x) || !Number.isInteger(tile.y) || map.terrain[tile.y]?.[tile.x] !== 'R')) errors.push(`Dust must stay on road tiles: ${patch.id}`)
    if (!Number.isFinite(patch.seconds) || patch.seconds <= 0 || !Number.isFinite(patch.phase)) errors.push(`Invalid dust timing: ${patch.id}`)
  }
  for (const tile of config.accents || []) if (!clearGround(map, tile)) errors.push(`Ground accent needs clear terrain: ${tile.x},${tile.y}`)
  return errors
}
