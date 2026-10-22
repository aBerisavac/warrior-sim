export const WILDLIFE_TILE = { squirrel: 'F', eagle: 'M', mole: 'A', fish: '~' }
export const WILDLIFE_DEFAULTS = {
  squirrel: { chancePerSecond: .01, maxActive: 3 },
  eagle: { chancePerSecond: .004, maxActive: 1 },
  mole: { chancePerSecond: .005, maxActive: 2 },
  fish: { chancePerSecond: .03, maxActive: 20 },
}

const point = cell => ({ x: cell.x + .5, y: cell.y + .5 })
const choose = (items, random) => items[Math.floor(random() * items.length)]
const neighbors = (map, cell, tile) => [[0, -1], [1, 0], [0, 1], [-1, 0]]
  .map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }))
  .filter(next => map.terrain[next.y]?.[next.x] === tile)

export function wildlifeCells(map, kind) {
  const tile = WILDLIFE_TILE[kind]
  if (!tile) return []
  const cells = []
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.columns; x++) {
    if (map.terrain[y]?.[x] === tile) cells.push({ x, y })
  }
  return cells
}

export function squirrelPath(map, origin, random = Math.random) {
  if (map.terrain[origin.y]?.[origin.x] !== 'F') return []
  const path = [origin], visited = new Set([`${origin.x},${origin.y}`])
  const steps = 2 + Math.floor(random() * 4)
  for (let index = 0; index < steps; index++) {
    const options = neighbors(map, path.at(-1), 'F')
    if (!options.length) break
    const fresh = options.filter(cell => !visited.has(`${cell.x},${cell.y}`))
    const next = choose(fresh.length ? fresh : options, random)
    path.push(next)
    visited.add(`${next.x},${next.y}`)
  }
  return path.length > 1 ? path : []
}

export function createWildlifeEvent(map, kind, random = Math.random, id = 0, chosenOrigin = null) {
  const cells = wildlifeCells(map, kind).filter(cell => kind !== 'squirrel' || neighbors(map, cell, 'F').length)
  if (!cells.length) return null
  const origin = chosenOrigin && map.terrain[chosenOrigin.y]?.[chosenOrigin.x] === WILDLIFE_TILE[kind] ? chosenOrigin : choose(cells, random)
  if (kind === 'squirrel') {
    const path = squirrelPath(map, origin, random)
    if (!path.length) return null
    const timeline = [{ phase: 'emerge', from: point(origin), to: point(origin), start: 0, end: .7 }]
    let time = .7, facing = 1
    for (let index = 1; index < path.length; index++) {
      const duration = .8 + random() * .5
      if (path[index].x !== path[index - 1].x) facing = Math.sign(path[index].x - path[index - 1].x)
      timeline.push({ phase: 'run', from: point(path[index - 1]), to: point(path[index]), start: time, end: time + duration, direction: facing })
      time += duration
      const pause = .7 + random() * .8
      timeline.push({ phase: 'nibble', from: point(path[index]), to: point(path[index]), start: time, end: time + pause, direction: facing })
      time += pause
    }
    timeline.push({ phase: 'leave', from: point(path.at(-1)), to: point(path.at(-1)), start: time, end: time + .75, direction: facing })
    return { id, kind, origin, path, timeline, duration: time + .75, scratchAt: time }
  }
  if (kind === 'eagle') {
    const destinations = cells.filter(cell => cell.x !== origin.x || cell.y !== origin.y)
    if (!destinations.length) return null
    return { id, kind, origin, destination: choose(destinations, random), duration: 7 + random() * 4 }
  }
  if (kind === 'mole') return { id, kind, origin, duration: 4.5 + random() * 2 }
  if (kind === 'fish') return { id, kind, origin, duration: 2.1 + random() * .5 }
  return null
}

export function wildlifePose(event, age, cellSize = 40) {
  if (!event || age < 0 || age >= event.duration) return null
  const center = point(event.origin)
  if (event.kind === 'squirrel') {
    const segment = event.timeline.find(part => age >= part.start && age < part.end) || event.timeline.at(-1)
    const t = Math.max(0, Math.min(1, (age - segment.start) / (segment.end - segment.start)))
    const x = segment.from.x + (segment.to.x - segment.from.x) * t
    const y = segment.from.y + (segment.to.y - segment.from.y) * t
    return { x: x * cellSize, y: y * cellSize + (segment.phase === 'run' ? Math.sin(t * Math.PI * 6) * -1.5 : segment.phase === 'leave' ? -t * cellSize * .65 : segment.phase === 'emerge' ? (1 - t) * cellSize * .2 : 0), phase: segment.phase, direction: segment.direction || 1,
      opacity: segment.phase === 'leave' ? 1 - t : 1, scale: .8 * (segment.phase === 'emerge' ? .2 + .8 * t : segment.phase === 'leave' ? 1 - .7 * t : 1) }
  }
  if (event.kind === 'eagle') {
    const t = age / event.duration, from = point(event.origin), to = point(event.destination)
    return { x: (from.x + (to.x - from.x) * t) * cellSize, y: (from.y + (to.y - from.y) * t) * cellSize - Math.sin(Math.PI * t) * cellSize * 2.2,
      phase: 'fly', direction: to.x < from.x ? -1 : 1, opacity: Math.min(1, t * 5, (1 - t) * 5), scale: 1 }
  }
  if (event.kind === 'mole') {
    const t = age / event.duration
    const rise = Math.min(1, t * 4, (1 - t) * 4)
    return { x: center.x * cellSize, y: (center.y + .2) * cellSize, phase: 'peek', direction: Math.sin(age * 2.2) < 0 ? -1 : 1, opacity: rise, scale: rise, nose: Math.sin(age * 8) * 1.5 }
  }
  if (event.kind === 'fish') {
    const t = age / event.duration
    return { x: (center.x + Math.sin(Math.PI * t) * .22) * cellSize, y: center.y * cellSize - Math.sin(Math.PI * t) * cellSize * .85,
      phase: 'jump', direction: t < .5 ? 1 : -1, opacity: Math.min(1, t * 10, (1 - t) * 10), scale: .65, angle: t < .5 ? -45 : 45,
      splash: (1 - Math.sin(Math.PI * t)) * .85 }
  }
  return null
}


// Fish and moles roll once per free habitat tile each second; the other animals roll per region.
export function spawnWildlife(map, active, random = Math.random, nextId = 0, raining = false) {
  const config = map.ambience?.wildlife || WILDLIFE_DEFAULTS
  const spawned = []
  for (const kind of Object.keys(WILDLIFE_TILE)) {
    const rule = config[kind] || WILDLIFE_DEFAULTS[kind]
    const chance = Math.min(1, rule.chancePerSecond * (raining ? kind === 'fish' ? 2 : ['mole', 'squirrel'].includes(kind) ? 1 / 3 : 1 : 1))
    const cap = kind === 'squirrel' ? Math.min(3, rule.maxActive) : rule.maxActive
    if (active.filter(event => event.kind === kind).length + spawned.filter(event => event.kind === kind).length >= cap) continue
    if (kind === 'fish' || kind === 'mole') {
      const occupied = new Set(active.filter(event => event.kind === kind).map(event => `${event.origin.x},${event.origin.y}`))
      for (const cell of wildlifeCells(map, kind)) {
        if (occupied.size >= cap) break
        const key = `${cell.x},${cell.y}`
        if (occupied.has(key) || random() >= chance) continue
        const event = createWildlifeEvent(map, kind, random, nextId++, cell)
        if (event) { spawned.push(event); occupied.add(key) }
      }
      continue
    }
    if (random() >= chance) continue
    const event = createWildlifeEvent(map, kind, random, nextId++)
    if (event) spawned.push(event)
  }
  return spawned
}
