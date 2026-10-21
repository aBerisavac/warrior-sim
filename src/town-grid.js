// Building shapes are defined in grid cells; omitted shapes fill their rectangle.
export function buildingCells(building) {
  const cells = []
  for (let row = 0; row < building.height; row++) {
    for (let col = 0; col < building.width; col++) {
      if (!building.shape || building.shape[row][col] === '#') {
        cells.push({ x: building.x + col, y: building.y + row })
      }
    }
  }
  return cells
}

export function buildingOutline(building, cellSize) {
  const cells = buildingCells(building)
  const filled = new Set(cells.map(({ x, y }) => `${x},${y}`))
  const edges = []
  for (const { x, y } of cells) {
    if (!filled.has(`${x},${y - 1}`)) edges.push([[x, y], [x + 1, y]])
    if (!filled.has(`${x + 1},${y}`)) edges.push([[x + 1, y], [x + 1, y + 1]])
    if (!filled.has(`${x},${y + 1}`)) edges.push([[x + 1, y + 1], [x, y + 1]])
    if (!filled.has(`${x - 1},${y}`)) edges.push([[x, y + 1], [x, y]])
  }
  const remaining = new Map(edges.map(([from, to]) => [from.join(','), to]))
  const start = edges[0][0]
  const points = [start]
  let current = start
  do {
    current = remaining.get(current.join(','))
    if (!current) return ''
    points.push(current)
  } while (current[0] !== start[0] || current[1] !== start[1])
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x * cellSize} ${y * cellSize}`).join(' ') + ' Z'
}
