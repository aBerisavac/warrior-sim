import { buildingCells, gateCells } from './town-grid.js'

const walkable = new Set(['R', 'G', 'B', 'D'])
const key = (x, y) => `${x},${y}`
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const samePoint = (a, b) => distance(a, b) < 0.001

export function pathLength(points) {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0)
}

export function pointAtDistance(points, target) {
  if (!points?.length) return null
  let travelled = 0
  for (let index = 1; index < points.length; index++) {
    const length = distance(points[index - 1], points[index])
    if (travelled + length >= target) {
      const fraction = length ? (target - travelled) / length : 0
      return { x: points[index - 1].x + (points[index].x - points[index - 1].x) * fraction,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * fraction }
    }
    travelled += length
  }
  return points.at(-1)
}

export function pointOnRoute(points, progress) {
  return pointAtDistance(points, pathLength(points) * Math.max(0, Math.min(1, progress)))
}

// Every map provides its own terrain and entrances. Nothing here depends on Briarwick.
export function createMapRoutes(map) {
  const size = map.cellSize
  const mapSize = { width: map.columns * size, height: map.rows * size }
  const cellPoint = (x, y) => ({ x: (x + 0.5) * size, y: (y + 0.5) * size })
  const insideGates = (x, y) => map.gates.every(gate => {
    if (gate.direction === 'north') return y >= gate.y
    if (gate.direction === 'south') return y < gate.y + (gate.height ?? 1)
    if (gate.direction === 'west') return x >= gate.x
    if (gate.direction === 'east') return x < gate.x + (gate.width ?? 1)
    return true
  })
  const nodes = new Map()
  const neighbors = new Map()
  for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.columns; x++) {
    if (!walkable.has(map.terrain[y]?.[x]) || !insideGates(x, y)) continue
    const id = key(x, y)
    nodes.set(id, cellPoint(x, y))
    neighbors.set(id, [])
  }
  const roadSegments = []
  for (const [id, point] of nodes) {
    const [x, y] = id.split(',').map(Number)
    for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
      const next = key(nx, ny)
      if (!nodes.has(next)) continue
      neighbors.get(id).push(next)
      neighbors.get(next).push(id)
      roadSegments.push({ from: point, to: nodes.get(next), id: `${id}-${next}` })
    }
  }
  const entrances = new Map(map.buildings.filter((building) => building.kind !== 'house').map((building) => [building.id, building.door]))
  for (const gate of map.gates) {
    const cells = gateCells(gate)
    // Pick a central gate cell that joins the road, even for an even-sized gate.
    const centerX = gate.x + ((gate.width ?? 1) - 1) / 2
    const centerY = gate.y + ((gate.height ?? 1) - 1) / 2
    cells.sort((a, b) => {
      const score = (cell) => {
        const roadNeighbor = [[cell.x + 1, cell.y], [cell.x - 1, cell.y], [cell.x, cell.y + 1], [cell.x, cell.y - 1]]
          .some(([x, y]) => ['R', 'B', 'D'].includes(map.terrain[y]?.[x]))
        return (roadNeighbor ? 0 : 100) + Math.abs(cell.x - centerX) + Math.abs(cell.y - centerY)
      }
      return score(a) - score(b)
    })
    entrances.set(gate.id, cells[0])
  }
  const placePoint = (id) => {
    const entrance = entrances.get(id)
    return entrance ? cellPoint(entrance.x, entrance.y) : null
  }
  const placeMarkerPoint = (id) => {
    const building = map.buildings.find((item) => item.id === id)
    if (building?.door) return placePoint(id)
    if (building) {
      const cells = buildingCells(building)
      return { x: cells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / cells.length * size,
        y: cells.reduce((sum, cell) => sum + cell.y + 0.5, 0) / cells.length * size }
    }
    const gate = map.gates.find((item) => item.id === id)
    if (gate) return placePoint(id)
    return placePoint(id)
  }
  function pathsToCell(x, y) {
    const target = key(x, y)
    if (!nodes.has(target)) return null
    const next = new Map([[target, null]])
    const queue = [target]
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index]
      for (const neighbor of neighbors.get(id) || []) {
        if (next.has(neighbor)) continue
        next.set(neighbor, id)
        queue.push(neighbor)
      }
    }
    return next
  }
  function projectedPoint(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y
    const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
    return { x: a.x + dx * fraction, y: a.y + dy * fraction }
  }
  function routeToCellFromPoint(point, x, y) {
    const destination = nodes.get(key(x, y))
    if (!point || !destination) return { points: [], minutes: 0 }
    if (samePoint(point, destination)) return { points: [point], minutes: 0 }
    const next = pathsToCell(x, y)
    if (!next) return { points: [], minutes: 0 }
    let best = null
    for (const segment of roadSegments) {
      const projection = projectedPoint(point, segment.from, segment.to)
      if (!samePoint(point, projection)) continue // Never jump across non-road cells.
      for (const endpoint of [segment.from, segment.to]) {
        const endpointId = key(Math.floor(endpoint.x / size), Math.floor(endpoint.y / size))
        if (!next.has(endpointId)) continue
        const points = [point]
        if (!samePoint(point, endpoint)) points.push(endpoint)
        let node = endpointId
        while (next.get(node)) {
          node = next.get(node)
          points.push(nodes.get(node))
        }
        const length = pathLength(points)
        if (!best || length < best.length) best = { points, length }
      }
    }
    return best ? { points: best.points, minutes: Math.ceil(best.length / size) * (map.minutesPerCell || 1) } : { points: [], minutes: 0 }
  }
  function routeFromPoint(point, destinationId) {
    const entrance = entrances.get(destinationId)
    return entrance ? routeToCellFromPoint(point, entrance.x, entrance.y) : { points: [], minutes: 0 }
  }
  return {
    mapSize, roadSegments, placePoint, placeMarkerPoint, routeFromPoint, routeToCellFromPoint,
    routeBetween: (fromId, toId) => routeFromPoint(placePoint(fromId), toId),
    travelMinutesFromPoint: (point, destinationId) => routeFromPoint(point, destinationId).minutes,
  }
}
