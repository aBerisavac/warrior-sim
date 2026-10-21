import { buildingCells, gateCells } from './town-grid.js'

const requiredBuildings = ['smithy', 'market', 'square', 'tavern', 'chapel', 'barracks']
const requiredGates = ['northGate', 'eastGate', 'gate', 'westGate']
const roadTiles = new Set(['R', 'G', 'B'])
const validTiles = new Set(['.', 'R', 'G', 'B', 'W', 'H', 'F', 'M', 'A', '~'])
const cellKey = (x, y) => `${x},${y}`

export function validateTownMap(map) {
  const errors = []
  if (map?.revision != null && (!Number.isInteger(map.revision) || map.revision < 0)) errors.push('Invalid map revision')
  if (map?.columns !== 30 || map?.rows !== 30 || !Number.isInteger(map?.cellSize) || map.cellSize < 16) return ['Map must be a 30x30 grid with a cell size.']
  if (!Array.isArray(map.terrain) || map.terrain.length !== 30 || map.terrain.some((row) => typeof row !== 'string' || [...row].length !== 30 || [...row].some((tile) => !validTiles.has(tile)))) return ['Map terrain must contain 30 rows of 30 valid cells.']
  const at = (x, y) => map.terrain[y]?.[x]
  const buildings = Array.isArray(map.buildings) ? map.buildings : []
  const gates = Array.isArray(map.gates) ? map.gates : []
  const occupied = new Set()
  const ids = new Set()
  for (const building of buildings) {
    if (ids.has(building.id)) errors.push(`Duplicate building: ${building.id}`)
    ids.add(building.id)
    const { x, y, width, height, shape, door } = building
    if (![x, y, width, height].every(Number.isInteger) || width < 2 || height < 2 || width > 4 || height > 4 || x < 0 || y < 0 || x + width > 30 || y + height > 30 || shape && (shape.length !== height || shape.some((row) => row.length !== width || !/^[.#]+$/.test(row)))) {
      errors.push(`Invalid footprint: ${building.id}`)
      continue
    }
    const cells = buildingCells(building)
    const own = new Set(cells.map(({ x: cx, y: cy }) => cellKey(cx, cy)))
    if (cells.length < 4) errors.push(`Building too small: ${building.id}`)
    if (cells.length) {
      const connected = new Set([cellKey(cells[0].x, cells[0].y)])
      const queue = [cells[0]]
      for (let index = 0; index < queue.length; index++) {
        const cell = queue[index]
        for (const [nx, ny] of [[cell.x+1,cell.y],[cell.x-1,cell.y],[cell.x,cell.y+1],[cell.x,cell.y-1]]) {
          const key = cellKey(nx, ny)
          if (own.has(key) && !connected.has(key)) { connected.add(key); queue.push({ x: nx, y: ny }) }
        }
      }
      if (connected.size !== cells.length) errors.push(`Building shape disconnected: ${building.id}`)
    }
    for (const { x: cx, y: cy } of cells) {
      const key = cellKey(cx, cy)
      if (occupied.has(key)) errors.push(`Buildings overlap at ${key}`)
      occupied.add(key)
      if (at(cx, cy) !== 'H') errors.push(`Building cell missing: ${building.id}`)
    }
    if (!door || !roadTiles.has(at(door.x, door.y))) errors.push(`Door needs a road: ${building.id}`)
    else {
      const neighbor = door.side === 'north' ? [door.x, door.y + 1]
        : door.side === 'south' ? [door.x, door.y - 1]
        : door.side === 'west' ? [door.x + 1, door.y]
        : door.side === 'east' ? [door.x - 1, door.y] : null
      if (!neighbor || !own.has(cellKey(...neighbor))) errors.push(`Door does not touch building: ${building.id}`)
    }
    if (building.imageSrc != null && typeof building.imageSrc !== 'string') errors.push(`Invalid image source: ${building.id}`)
  }
  for (const id of requiredBuildings) if (!ids.has(id)) errors.push(`Missing building: ${id}`)
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (at(x, y) === 'H' && !occupied.has(cellKey(x, y))) errors.push(`Unassigned building cell: ${x},${y}`)
  const gateIds = new Set()
  const gateOccupied = new Set()
  for (const gate of gates) {
    if (gateIds.has(gate.id)) errors.push(`Duplicate gate: ${gate.id}`)
    gateIds.add(gate.id)
    const width = gate.width ?? 1, height = gate.height ?? 1
    if (![gate.x, gate.y, width, height].every(Number.isInteger) || width < 1 || height < 1 || gate.x < 0 || gate.y < 0 || gate.x + width > 30 || gate.y + height > 30) {
      errors.push(`Invalid gate footprint: ${gate.id}`)
      continue
    }
    for (const cell of gateCells(gate)) {
      const key = cellKey(cell.x, cell.y)
      if (gateOccupied.has(key) || occupied.has(key)) errors.push(`Gate overlap at ${key}`)
      gateOccupied.add(key)
      if (at(cell.x, cell.y) !== 'G') errors.push(`Gate tile missing: ${gate.id}`)
    }
    if (gate.imageSrc != null && typeof gate.imageSrc !== 'string') errors.push(`Invalid gate image source: ${gate.id}`)
    if (gate.underTiles != null && (!Array.isArray(gate.underTiles) || gate.underTiles.some((cell) => !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || typeof cell.tile !== 'string' || !validTiles.has(cell.tile)))) errors.push(`Invalid gate backing tiles: ${gate.id}`)
  }
  for (const id of requiredGates) if (!gateIds.has(id)) errors.push(`Missing gate: ${id}`)
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (at(x, y) === 'G' && !gateOccupied.has(cellKey(x, y))) errors.push(`Unassigned gate cell: ${x},${y}`)
  const decorTypes = new Set(['well', 'crates', 'flowers', 'bush', 'tree', 'rock', 'barrel', 'cart'])
  if (!Array.isArray(map.decor) || map.decor.some((item) => !decorTypes.has(item.type) || !Number.isInteger(item.x) || !Number.isInteger(item.y) || item.x < 0 || item.x >= 30 || item.y < 0 || item.y >= 30)) errors.push('Invalid decorations')
  if (!map.tileImages || Object.values(map.tileImages).some((src) => src != null && typeof src !== 'string')) errors.push('Invalid tile image sources')
  if (!Array.isArray(map.cellImages) || map.cellImages.some((image) => !Number.isInteger(image.x) || !Number.isInteger(image.y) || image.x < 0 || image.x >= 30 || image.y < 0 || image.y >= 30 || typeof image.src !== 'string')) errors.push('Invalid cell image sources')
  const roads = new Set()
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) if (roadTiles.has(at(x, y))) roads.add(cellKey(x, y))
  const first = roads.values().next().value
  if (first) {
    const seen = new Set([first]), queue = [first]
    for (let index = 0; index < queue.length; index++) {
      const [x, y] = queue[index].split(',').map(Number)
      for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        const key = cellKey(nx, ny)
        if (roads.has(key) && !seen.has(key)) { seen.add(key); queue.push(key) }
      }
    }
    if (seen.size !== roads.size) errors.push('Roads and bridge must form one connected network')
  } else errors.push('The town needs roads')
  return [...new Set(errors)]
}
