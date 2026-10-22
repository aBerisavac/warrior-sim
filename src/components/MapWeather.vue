<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { daylightAt, weatherAt } from '../weather'
const props = defineProps({ minutes: Number, seed: Number, outdoor: Boolean })
const weather = computed(() => weatherAt(props.minutes, props.seed))
const daylight = computed(() => daylightAt(props.minutes))
const fairShapes = [
  { shadow: 'M30 69 Q9 64 19 48 Q29 39 44 42 Q47 22 70 20 Q84 9 105 24 Q125 13 142 31 Q163 26 177 43 Q198 43 202 61 Q200 79 177 79 H44 Q33 78 30 69Z', body: 'M27 62 Q8 56 21 43 Q31 35 46 40 Q48 22 69 20 Q81 5 105 21 Q124 10 143 28 Q162 23 178 41 Q198 41 203 57 Q202 72 179 72 H42 Q28 71 27 62Z', ridge: 'M40 49 Q50 43 61 44 M77 27 Q89 20 102 29 M128 33 Q141 28 151 38' },
  { shadow: 'M9 71 Q8 54 31 51 Q39 25 64 31 Q78 13 98 24 Q114 29 119 42 Q146 20 166 39 Q194 38 211 56 Q219 79 188 82 H33 Q13 82 9 71Z', body: 'M6 63 Q11 45 32 45 Q39 19 65 25 Q79 7 100 18 Q115 23 122 36 Q149 14 168 33 Q199 32 214 51 Q218 72 188 75 H31 Q10 75 6 63Z', ridge: 'M29 52 Q48 43 62 48 M75 29 Q93 22 105 33 M141 41 Q164 31 181 42' },
  { shadow: 'M17 72 Q1 57 30 49 Q45 47 52 52 Q63 24 92 26 Q105 10 125 22 Q137 20 148 35 Q183 31 200 50 Q218 58 207 74 Q197 82 166 80 H44 Q20 82 17 72Z', body: 'M13 65 Q3 50 30 43 Q45 41 54 46 Q65 18 92 20 Q107 3 127 17 Q140 13 152 29 Q183 24 203 44 Q220 54 209 66 Q196 74 164 73 H41 Q18 74 13 65Z', ridge: 'M40 48 Q53 42 67 49 M79 27 Q101 17 116 27 M153 39 Q177 31 190 46' },
]
const stormShapes = [
  { shadow: 'M8 67 Q23 48 51 53 Q59 30 91 36 Q111 19 141 34 Q161 29 181 47 Q205 46 217 67 Q198 84 160 81 H43 Q16 82 8 67Z', body: 'M4 59 Q19 41 49 46 Q60 23 88 30 Q109 11 141 27 Q165 23 184 41 Q207 41 219 61 Q206 76 169 74 H42 Q16 76 4 59Z', ridge: 'M26 54 Q52 45 73 53 M100 37 Q127 28 151 39 M162 50 Q185 44 204 56' },
  { shadow: 'M4 69 Q10 49 33 49 Q52 31 75 42 Q92 18 116 27 Q139 15 159 36 Q188 34 213 57 Q224 80 189 83 H32 Q10 82 4 69Z', body: 'M2 60 Q13 41 36 42 Q54 24 77 35 Q91 10 117 21 Q140 8 163 29 Q191 27 218 51 Q224 74 187 76 H31 Q8 74 2 60Z', ridge: 'M22 52 Q45 41 68 46 M91 34 Q113 25 131 34 M156 42 Q180 36 200 51' },
  { shadow: 'M14 72 Q4 55 31 49 Q46 36 70 43 Q87 24 108 32 Q131 13 150 32 Q179 30 202 52 Q220 63 209 77 Q196 84 165 81 H41 Q18 82 14 72Z', body: 'M10 63 Q4 47 32 42 Q47 29 72 36 Q86 17 110 25 Q133 6 154 25 Q182 23 205 46 Q223 55 211 69 Q198 76 164 74 H40 Q17 76 10 63Z', ridge: 'M36 51 Q55 42 76 48 M99 31 Q120 22 139 33 M166 42 Q186 37 199 50' },
]
const streakShapes = ['M15 51 C60 43 106 45 171 48 M53 65 C105 59 165 62 208 57 M78 34 C115 30 151 34 188 32', 'M7 41 Q64 35 127 39 T216 35 M33 58 Q93 54 148 57 T208 52 M71 72 Q129 67 183 69', 'M13 58 Q55 49 103 53 T205 46 M24 38 Q89 34 153 37 M82 70 Q145 65 213 66']
const clouds = ref([])
let nextCloudId = 0
let spawnTimer
const removalTimers = new Set()
function spawnCloud(inFlight = false) {
  const storm = ['approaching', 'rain'].includes(weather.value.kind)
  const size = storm ? 36 + Math.random() * 34 : 12 + Math.random() * 27
  const duration = 44 + Math.random() * 42
  const progress = inFlight ? .22 + Math.random() * .56 : 0
  const cloud = {
    id: nextCloudId++, top: Math.random() * 76, size, shape: Math.floor(Math.random() * 3),
    duration, delay: -duration * progress,
    start: -size - 5,
    restingLeft: Math.random() * 76,
  }
  clouds.value.push(cloud)
  const timer = setTimeout(() => {
    clouds.value = clouds.value.filter(item => item.id !== cloud.id)
    removalTimers.delete(timer)
  }, duration * (1 - progress) * 1000)
  removalTimers.add(timer)
}
function startClouds() {
  if (spawnTimer) return
  for (let i = 0; i < 4; i++) spawnCloud(true)
  spawnTimer = setInterval(() => {
    const maximum = ['approaching', 'rain'].includes(weather.value.kind) ? 7 : 6
    if (clouds.value.length < maximum && Math.random() < .9) spawnCloud()
  }, 3500)
}
function stopClouds() {
  clearInterval(spawnTimer)
  spawnTimer = null
  for (const timer of removalTimers) clearTimeout(timer)
  removalTimers.clear()
  clouds.value = []
}
onMounted(() => { if (props.outdoor) startClouds() })
watch(() => props.outdoor, outdoor => outdoor ? startClouds() : stopClouds())
onBeforeUnmount(stopClouds)
const cloudTone = computed(() => {
  const hour = ((props.minutes / 60) % 24 + 24) % 24
  const darkness = hour < 6 ? .48 + hour / 6 * .52 : hour > 18 ? Math.max(.48, 1 - (hour - 18) / 6 * .52) : 1
  const warmth = hour > 16 && hour < 21 ? Math.sin((hour - 16) / 5 * Math.PI) * .65 : 0
  return `brightness(${darkness.toFixed(2)}) sepia(${warmth.toFixed(2)})`
})
</script>

<template>
  <div class="map-weather" :class="'map-weather--' + weather.kind" aria-hidden="true">
    <div class="map-weather-light" :style="{ background: daylight }"></div>
    <div v-if="outdoor" class="map-weather-clouds" :style="{ filter: cloudTone }">
      <svg v-for="cloud in clouds" :key="cloud.id" class="map-cloud" :style="{ top: cloud.top + '%', width: cloud.size + '%', animationDuration: cloud.duration + 's', animationDelay: cloud.delay + 's', '--cloud-start': cloud.start + '%', '--static-left': cloud.restingLeft + '%' }" viewBox="0 0 220 100" preserveAspectRatio="xMidYMid meet">
        <template v-if="weather.kind === 'streaks'">
          <path class="map-cloud-streak" :d="streakShapes[cloud.shape]" />
        </template>
        <template v-else-if="weather.kind === 'approaching' || weather.kind === 'rain'">
          <path class="map-cloud-shadow" :d="stormShapes[cloud.shape].shadow" />
          <path class="map-cloud-body" :d="stormShapes[cloud.shape].body" />
          <path class="map-cloud-ridge" :d="stormShapes[cloud.shape].ridge" />
        </template>
        <template v-else>
          <path class="map-cloud-shadow" :d="fairShapes[cloud.shape].shadow" />
          <path class="map-cloud-body" :d="fairShapes[cloud.shape].body" />
          <path class="map-cloud-ridge" :d="fairShapes[cloud.shape].ridge" />
        </template>
      </svg>
    </div>
    <div v-if="outdoor && weather.kind === 'rain'" class="map-weather-rain"></div>
  </div>
</template>

<style scoped>
.map-weather{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2}
.map-weather-light{position:absolute;inset:0;transition:background 5s linear;mix-blend-mode:multiply}
.map-weather-clouds{position:absolute;inset:0;transition:filter 5s linear}
.map-cloud{position:absolute;width:27%;height:auto;overflow:visible;opacity:.62;animation-name:cloud-cross;animation-timing-function:linear;animation-fill-mode:both;transition:width 8s,opacity 8s}
.map-cloud:nth-child(2){opacity:.49}
.map-cloud:nth-child(3){opacity:.54}
.map-cloud-body{fill:#f6f4e7d9;stroke:#f9f7e9a8;stroke-width:1.5;transition:fill 8s,stroke 8s}
.map-cloud-shadow{fill:#87999c67;transition:fill 8s}
.map-cloud-ridge{fill:none;stroke:#fffdf0af;stroke-width:3;stroke-linecap:round;transition:stroke 8s}
.map-weather--streaks .map-cloud{opacity:.56}
.map-cloud-streak{fill:none;stroke:#edece1be;stroke-width:7;stroke-linecap:round;stroke-linejoin:round}
.map-weather--approaching .map-cloud,.map-weather--rain .map-cloud{opacity:.7}
.map-weather--approaching .map-cloud:nth-child(2),.map-weather--rain .map-cloud:nth-child(2){opacity:.62}
.map-weather--approaching .map-cloud-body{fill:#89949ac9;stroke:#bac1c3a1}
.map-weather--approaching .map-cloud-shadow{fill:#424f5c84}
.map-weather--rain .map-cloud-body{fill:#414d59e0;stroke:#727f85ad}
.map-weather--rain .map-cloud-shadow{fill:#273542b0}
.map-weather--approaching .map-cloud-ridge,.map-weather--rain .map-cloud-ridge{stroke:#bdc5c77a}
.map-weather-rain{position:absolute;inset:-20%;background:repeating-linear-gradient(108deg,transparent 0 14px,#cfdeef52 15px,transparent 17px 34px);background-size:140px 220px;opacity:.6;animation:rain-fall .55s linear infinite}
@keyframes cloud-cross{from{left:var(--cloud-start)}to{left:105%}}
@keyframes rain-fall{to{background-position:-48px 220px}}
@media(prefers-reduced-motion:reduce){.map-cloud{animation:none;left:var(--static-left)}.map-weather-rain{animation:none}}
</style>
