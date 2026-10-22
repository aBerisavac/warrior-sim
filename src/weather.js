// Forecasts use game minutes. The saved seed makes each two-hour interval
// stable across reloads without storing every past shower.
export const WEATHER_CYCLE_MINUTES = 120
const hash = (cycle, seed, salt) => {
  let value = (Math.imul(cycle, 0x9e3779b1) + seed + salt) | 0
  value = Math.imul(value ^ value >>> 16, 0x85ebca6b)
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35)
  return ((value ^ value >>> 16) >>> 0) / 4294967296
}
export function rainWindow(cycle, seed = 0) {
  const start = cycle * WEATHER_CYCLE_MINUTES + Math.floor(hash(cycle, seed, 17) * WEATHER_CYCLE_MINUTES)
  const duration = 10 + Math.floor(hash(cycle, seed, 53) * 11)
  return { start, end: start + duration, duration }
}
export function weatherAt(minutes, seed = 0) {
  const cycle = Math.floor(minutes / WEATHER_CYCLE_MINUTES)
  const windows = [cycle - 1, cycle, cycle + 1].map(index => rainWindow(index, seed))
  if (windows.some(window => minutes >= window.start && minutes < window.end)) return { kind: 'rain', cover: .7 }
  const next = windows.filter(window => window.start > minutes).sort((a, b) => a.start - b.start)[0]
  const last = windows.filter(window => window.end <= minutes).sort((a, b) => b.end - a.end)[0]
  if (next && next.start - minutes <= 5) return { kind: 'approaching', cover: .4 + (5 - next.start + minutes) / 5 * .25 }
  if (last && minutes - last.end <= 3) return { kind: 'clearing', cover: .56 - (minutes - last.end) / 3 * .32 }
  if (next && next.start - minutes <= 15) return { kind: 'streaks', cover: .22 }
  return { kind: 'fair', cover: .16 }
}

export function daylightAt(minutes) {
  const hour = ((minutes / 60) % 24 + 24) % 24
  const stops = [
    [0, 11, 16, 37, .50], [5, 24, 32, 49, .36],
    [8, 207, 166, 111, .13], [12, 255, 255, 255, 0],
    [16, 255, 255, 255, 0], [19, 151, 84, 37, .24],
    [22, 24, 29, 48, .43], [24, 11, 16, 37, .50],
  ]
  const right = stops.findIndex(stop => stop[0] >= hour)
  const a = stops[Math.max(0, right - 1)], b = stops[Math.max(0, right)]
  const t = a === b ? 0 : (hour - a[0]) / (b[0] - a[0])
  const values = a.slice(1).map((value, index) => value + (b[index + 1] - value) * t)
  return `rgba(${values.slice(0, 3).map(Math.round).join(',')},${values[3].toFixed(3)})`
}
