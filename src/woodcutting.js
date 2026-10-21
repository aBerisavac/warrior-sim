import stumps from './data/woodcutting.json'

export const WOOD_STUMPS = stumps

export function createWoodcuttingJob(random = Math.random) {
  const target = 7 + Math.floor(random() * 9)
  const reachable = Array(target + 1).fill(false)
  reachable[0] = true
  for (let total = 1; total <= target; total += 1) {
    reachable[total] = stumps.some(log => total >= log.expectedPieces && reachable[total - log.expectedPieces])
  }
  const logs = []
  let remaining = target
  while (remaining > 0) {
    const options = stumps.filter(log => remaining >= log.expectedPieces && reachable[remaining - log.expectedPieces])
    const log = options[Math.floor(random() * options.length)]
    const marked = random() >= .2
    const left = log.splitPlan?.[0] || Math.floor(log.expectedPieces / 2)
    const sizes = [left, log.expectedPieces - left]
    const branchMarks = marked ? sizes.flatMap((size, side) => size > 1 && random() < .7
      ? [{ side, join: 32 + random() * 36 }] : []) : []
    logs.push({ ...log, id: `${log.id}-${logs.length}`, marked, branchMarks, cutOffset: marked ? log.cutOffset : 0 })
    remaining -= log.expectedPieces
  }
  // Shuffle to keep the final, constrained choices from always appearing last.
  for (let index = logs.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[logs[index], logs[other]] = [logs[other], logs[index]]
  }
  return logs
}

export function firstPiece(stump) {
  return { id: stump.id, piecesNeeded: stump.expectedPieces, angle: stump.initialAngle, marked: stump.marked ?? true, branchMarks: stump.branchMarks || [], onBlock: true, depth: 0, splitPlan: stump.splitPlan, cutOffset: stump.marked === false ? 0 : stump.cutOffset || 0, fraction: 1 }
}

export function cutScore(piece, rotation, offset) {
  const alignedAngle = ((piece.angle + rotation + 90) % 180 + 180) % 180 - 90
  const angleError = piece.marked ? Math.abs(alignedAngle) : 0
  const error = angleError * 0.9 + Math.abs(offset + (piece.cutOffset || 0) * Math.cos(rotation * Math.PI / 180)) * 1.4
  return Math.max(0, Math.round(100 - error * 1.7))
}

export function splitPiece(piece, rotation, offset, roll = Math.random()) {
  if (piece.piecesNeeded < 2) throw new Error('This piece is already firewood')
  const left = piece.splitPlan?.[0] || Math.floor(piece.piecesNeeded / 2)
  const right = piece.piecesNeeded - left
  const landings = Math.min(2, Math.floor(roll * 3)) // zero, one, or both pieces stay on the block
  const children = [left, right].map((piecesNeeded, index) => ({
    id: piece.id + '-' + index,
    piecesNeeded,
    depth: piece.depth + 1,
    fraction: (piece.fraction || 1) * piecesNeeded / piece.piecesNeeded,
    cutOffset: 0,
    // Wedges are drawn around the upward radius. Keep their next split
    // inside the middle third of their own arc, rather than inheriting
    // an arbitrary angle from the original round log.
    angle: (piece.fraction || 1) * piecesNeeded / piece.piecesNeeded * 360
      * (Math.max(1 / 3, Math.min(2 / 3, Math.floor(piecesNeeded / 2) / piecesNeeded)) - .5),
    marked: piecesNeeded > 1 && (piece.branchMarks?.length
      ? piece.branchMarks.some(branch => branch.side === index)
      : (piece.depth + index) % 2 === 0),
    branchMarks: [],
    onBlock: index < landings,
  }))
  return { children, score: cutScore(piece, rotation, offset), landings }
}

export function woodcutPay(scores) {
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0
  return 3 + Math.round(average * 6 / 100)
}

export function strengthQuality(strength) {
  return Math.max(0, Math.round(100 - Math.abs(Math.max(0, Math.min(100, strength)) - 85) * 2))
}

export function firewoodValue(precision, quality) {
  const combined = precision < 50 || quality < 50 ? 0
    : Math.max(0, Math.min(100, precision)) * .6 + Math.max(0, Math.min(100, quality)) * .4
  return { combined, coins: combined < 50 ? 0 : .2 + .6 * combined / 100 }
}

export function chargeDuration(progress, random = Math.random) {
  const fatigue = Math.max(0, Math.min(1, (progress - .6) / .4))
  return (1.1 + random() * .35) * (1 - fatigue) + (1.7 + random() * .3) * fatigue
}
