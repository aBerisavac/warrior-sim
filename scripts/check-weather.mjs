import assert from 'node:assert/strict'
import { weatherAt, rainWindow, daylightAt } from '../src/weather.js'

const seed = 417
for (let cycle = 0; cycle < 20; cycle++) {
  const window = rainWindow(cycle, seed)
  assert(window.start >= cycle * 120 && window.start < (cycle + 1) * 120)
  assert(window.duration >= 10 && window.duration <= 20)
  assert.equal(weatherAt(window.start, seed).kind, 'rain')
  assert(['approaching', 'rain'].includes(weatherAt(window.start - 1, seed).kind))
  assert(weatherAt(window.start - 1, seed).cover > 1 / 3)
  assert.equal(rainWindow(cycle, seed).start, window.start, 'Forecast survives a reload')
}
const overlapping = Array.from({ length: 1000 }, (_, cycle) => cycle).find(cycle => rainWindow(cycle + 1, seed).start < rainWindow(cycle, seed).end)
assert.notEqual(overlapping, undefined)
const first = rainWindow(overlapping, seed), second = rainWindow(overlapping + 1, seed)
assert.equal(weatherAt(second.start, seed).kind, 'rain')
assert.equal(weatherAt(Math.max(first.end, second.end) - 1, seed).kind, 'rain', 'Overlapping showers remain continuous')
assert.equal(daylightAt(720), 'rgba(255,255,255,0.000)')
assert.notEqual(daylightAt(480), daylightAt(1140))
console.log('Seeded two-hour showers, overlap, cloud warning, and daylight tint valid')
