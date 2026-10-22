const shift = (point, cells) => point ? { ...point, x: point.x + cells, y: point.y + cells } : point

// Keep every existing tile and placed object together when growing the editable town.
export function expandTownMap(source, cells = 5) {
  const map = structuredClone(source)
  const emptyRow = '.'.repeat(map.columns + cells * 2)
  map.terrain = [
    ...Array(cells).fill(emptyRow),
    ...map.terrain.map(row => '.'.repeat(cells) + row + '.'.repeat(cells)),
    ...Array(cells).fill(emptyRow),
  ]
  map.columns += cells * 2
  map.rows += cells * 2
  map.revision = Math.max(map.revision || 0, 7) + 1
  map.buildings = map.buildings.map(building => ({ ...shift(building, cells), door: shift(building.door, cells) }))
  map.gates = map.gates.map(gate => ({ ...shift(gate, cells), underTiles: gate.underTiles?.map(tile => shift(tile, cells)) }))
  map.decor = map.decor.map(item => shift(item, cells))
  map.cellImages = map.cellImages.map(item => shift(item, cells))
  if (map.ambience) {
    map.ambience.accents = map.ambience.accents?.map(item => shift(item, cells))
    map.ambience.dust = map.ambience.dust?.map(patch => ({ ...patch, tiles: patch.tiles.map(tile => shift(tile, cells)) }))
    map.ambience.birds = map.ambience.birds?.map(bird => ({
      ...bird,
      arrival: { ...bird.arrival, from: shift(bird.arrival.from, cells), control: shift(bird.arrival.control, cells) },
      departure: { ...bird.departure, control: shift(bird.departure.control, cells), to: shift(bird.departure.to, cells) },
    }))
  }
  return map
}
