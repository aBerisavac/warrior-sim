import stumps from './data/woodcutting.json'

export const WOOD_STUMPS = stumps

export function firstPiece(stump) {
  return { id: stump.id, piecesNeeded: stump.expectedPieces, angle: stump.initialAngle, marked: true, onBlock: true, depth: 0 }
}

export function cutScore(piece, rotation, offset) {
  const alignedAngle = ((piece.angle + rotation + 90) % 180 + 180) % 180 - 90
  const angleError = piece.marked ? Math.abs(alignedAngle) : 0
  const error = angleError * 0.9 + Math.abs(offset) * 1.4
  return Math.max(0, Math.round(100 - error * 1.7))
}

export function splitPiece(piece, rotation, offset, roll = Math.random()) {
  if (piece.piecesNeeded < 2) throw new Error('This piece is already firewood')
  const left = Math.floor(piece.piecesNeeded / 2)
  const right = piece.piecesNeeded - left
  const landings = Math.min(2, Math.floor(roll * 3)) // zero, one, or both pieces stay on the block
  const children = [left, right].map((piecesNeeded, index) => ({
    id: piece.id + '-' + index,
    piecesNeeded,
    depth: piece.depth + 1,
    angle: ((piece.angle + (index ? 55 : -45) + 90) % 180 + 180) % 180 - 90,
    marked: (piece.depth + index) % 2 === 0,
    onBlock: index < landings,
  }))
  return { children, score: cutScore(piece, rotation, offset), landings }
}

export function woodcutPay(scores) {
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
  return 3 + Math.round(average * 6 / 100)
}
