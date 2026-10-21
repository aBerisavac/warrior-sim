import townMap from './data/town-map.json'
import { buildingCells, gateCells } from './town-grid'

export const mapSize = { width: townMap.columns * townMap.cellSize, height: townMap.rows * townMap.cellSize }
export const mapGrid = townMap
export const mapDecor = townMap.decor
const walkable = new Set(['R', 'G', 'B'])
const key = (x, y) => `${x},${y}`
const cellPoint = (x, y) => ({ x: (x + 0.5) * townMap.cellSize, y: (y + 0.5) * townMap.cellSize })
const roadNodes = {}
const adjacency = {}
for (let y = 0; y < townMap.rows; y++) {
  for (let x = 0; x < townMap.columns; x++) {
    if (!walkable.has(townMap.terrain[y][x])) continue
    roadNodes[key(x, y)] = cellPoint(x, y)
    adjacency[key(x, y)] = []
  }
}
export const roadSegments = []
for (const id of Object.keys(roadNodes)) {
  const [x, y] = id.split(',').map(Number)
  for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) {
    const next = key(nx, ny)
    if (!roadNodes[next]) continue
    adjacency[id].push(next)
    adjacency[next].push(id)
    roadSegments.push({ from: roadNodes[id], to: roadNodes[next], id: `${id}-${next}` })
  }
}
const entrances = Object.fromEntries([
  ...townMap.buildings.filter((building) => building.kind !== 'house').map((building) => [building.id, building.door]),
  ...townMap.gates.map((gate) => {
    const cells = gateCells(gate)
    return [gate.id, cells[Math.floor(cells.length / 2)]]
  }),
])
export const placePoint = (id) => entrances[id] ? cellPoint(entrances[id].x, entrances[id].y) : null
export const placeMarkerPoint = (id) => {
  const building = townMap.buildings.find((item) => item.id === id)
  if (building) {
    const cells = buildingCells(building)
    return {
      x: cells.reduce((sum, cell) => sum + cell.x + 0.5, 0) / cells.length * townMap.cellSize,
      y: cells.reduce((sum, cell) => sum + cell.y + 0.5, 0) / cells.length * townMap.cellSize,
    }
  }
  const gate = townMap.gates.find((item) => item.id === id)
  if (gate) return { x: (gate.x + (gate.width ?? 1) / 2) * townMap.cellSize, y: (gate.y + (gate.height ?? 1) / 2) * townMap.cellSize }
  return placePoint(id)
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const samePoint = (a, b) => distance(a, b) < 0.001

export function pathLength(points) {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0)
}

function pathsTo(destinationId) {
  const destination = entrances[destinationId]
  if (!destination) return {}
  const target = key(destination.x, destination.y)
  const next = { [target]: null }
  const queue = [target]
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]
    for (const neighbor of adjacency[node] || []) {
      if (neighbor in next) continue
      next[neighbor] = node
      queue.push(neighbor)
    }
  }
  return next
}
function projectedPoint(point, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const fraction = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)))
  return { x: a.x + dx * fraction, y: a.y + dy * fraction }
}
export function routeFromPoint(point, destinationId) {
  const destination = placePoint(destinationId)
  if (!point || !destination) return { points: [], minutes: 0 }
  if (samePoint(point, destination)) return { points: [point], minutes: 0 }
  const next = pathsTo(destinationId)
  let best = null
  // Start on the nearest road segment. Otherwise a distant segment can make
  // a diagonal shortcut look shorter than following the street grid.
  const nearest = Math.min(...roadSegments.map((segment) => distance(point, projectedPoint(point, segment.from, segment.to))))
  for (const segment of roadSegments) {
    const projection = projectedPoint(point, segment.from, segment.to)
    if (distance(point, projection) > nearest + 0.001) continue
    for (const endpoint of [segment.from, segment.to]) {
      const endpointId = key(Math.floor(endpoint.x / townMap.cellSize), Math.floor(endpoint.y / townMap.cellSize))
      if (!(endpointId in next)) continue
      const points = [point]
      if (!samePoint(point, projection)) points.push(projection)
      if (!samePoint(points.at(-1), endpoint)) points.push(endpoint)
      let node = endpointId
      while (next[node]) {
        node = next[node]
        points.push(roadNodes[node])
      }
      const length = pathLength(points)
      if (!best || length < best.length) best = { points, length }
    }
  }
  return best ? { points: best.points, minutes: Math.max(1, Math.ceil(best.length / 14)) } : { points: [], minutes: 0 }
}
export function routeBetween(fromId, toId) {
  return routeFromPoint(placePoint(fromId), toId)
}

export function pointOnRoute(points, progress) {
  if (!points?.length) return null
  const target = pathLength(points) * Math.max(0, Math.min(1, progress))
  let travelled = 0
  for (let index = 1; index < points.length; index++) {
    const length = distance(points[index - 1], points[index])
    if (travelled + length >= target) {
      const fraction = length ? (target - travelled) / length : 0
      return { x: points[index - 1].x + (points[index].x - points[index - 1].x) * fraction, y: points[index - 1].y + (points[index].y - points[index - 1].y) * fraction }
    }
    travelled += length
  }
  return points.at(-1)
}

export function travelMinutesFromPoint(point, destinationId) {
  return routeFromPoint(point, destinationId).minutes
}
