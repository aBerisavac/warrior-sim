const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
export const GRINDING_WHEEL = { x: 170, y: 108, width: 60, height: 176 }
export const grindingAngle = depth => 5 + unit(depth) * 25
export const grindingWidth = depth => 1 - unit(depth) * .6
export function grindingCellBounds(x, depth, row) {
  const half = (14 - Math.max(0, row - 5) * 5) * grindingWidth(depth)
  return { x: unit(x) * 400 + 126 + row * 19 - 190, y: 190 - half, width: 19, height: half * 2 }
}
// Exact alignment is quick; the rest of the acceptable band rewards patience.
export const grindingRate = angle => Math.abs(angle - 15) <= .25 ? 22 : Math.abs(angle - 15) <= 3 ? 3 + 4 * (1 - Math.abs(angle - 15) / 3) : -10
export function grindingContactCells(x, depth, side) {
  if (![0, 1].includes(side)) return []
  const wheel = GRINDING_WHEEL
  return Array.from({ length: 8 }, (_, row) => ({ row, rect: grindingCellBounds(x, depth, row) }))
    .filter(({ rect }) => rect.x < wheel.x + wheel.width && rect.x + rect.width > wheel.x && rect.y < wheel.y + wheel.height && rect.y + rect.height > wheel.y)
    .map(({ row }) => side * 8 + row)
}
