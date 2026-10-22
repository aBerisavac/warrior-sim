<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ambienceFor, birdPose, dustPatches, groundAccents, vegetationMotion } from '../map-ambience'
import { playSound } from '../audio'
import { spawnWildlife, wildlifePose } from '../wildlife'
const props = defineProps({ map: Object, paused: Boolean, raining: Boolean })
const config = computed(() => ambienceFor(props.map))
const accents = computed(() => groundAccents(props.map))
const patches = computed(() => dustPatches(props.map))
const seconds = ref(0)
const birds = computed(() => (config.value?.birds || []).map(route => ({ id: route.id, pose: birdPose(props.map, route, seconds.value) })).filter(bird => bird.pose))
const wildlife = ref([])
const animals = computed(() => wildlife.value.map(event => ({ ...event, pose: wildlifePose(event, seconds.value - event.startedAt, props.map.cellSize) })).filter(event => event.pose))
let frame, previous, pending = 0, lastWildlifeTick = 0, nextWildlifeId = 0
function animate(now) {
  if (previous !== undefined) pending += Math.min(.1, (now - previous) / 1000)
  if (pending >= 1 / 30) {
    seconds.value += pending; pending = 0
    for (const event of wildlife.value) {
      if (event.kind === 'squirrel' && !event.scratchPlayed && seconds.value - event.startedAt >= event.scratchAt) {
        event.scratchPlayed = true
        playSound('squirrelScratch', { scale: .7, duration: 2 })
      }
    }
    wildlife.value = wildlife.value.filter(event => seconds.value - event.startedAt < event.duration)
    while (lastWildlifeTick < Math.floor(seconds.value)) {
      lastWildlifeTick++
      const newEvents = spawnWildlife(props.map, wildlife.value, Math.random, nextWildlifeId, props.raining)
      if (newEvents.some(event => event.kind === 'eagle')) playSound('eagle', { duration: 2 })
      wildlife.value.push(...newEvents.map(event => ({ ...event, id: nextWildlifeId++, startedAt: seconds.value, scratchPlayed: false })))
    }
  }
  previous = now
  frame = requestAnimationFrame(animate)
}
watch(() => [props.paused, !!config.value], ([paused, enabled]) => {
  globalThis.cancelAnimationFrame?.(frame); previous = undefined; pending = 0
  if (!paused && enabled && typeof requestAnimationFrame !== 'undefined') frame = requestAnimationFrame(animate)
}, { immediate: true })
watch(() => props.map.id, () => { seconds.value = 0; wildlife.value = []; lastWildlifeTick = 0; nextWildlifeId = 0 })
onBeforeUnmount(() => globalThis.cancelAnimationFrame?.(frame))
</script>

<template>
  <g v-if="config" class="map-ambience" aria-hidden="true" pointer-events="none" :data-ambience-map="map.id">
    <defs><clipPath v-for="patch in patches" :id="map.id + '-dust-' + patch.id" :key="patch.id"><rect v-for="tile in patch.tiles" :key="tile.x + ',' + tile.y" :x="tile.x * map.cellSize" :y="tile.y * map.cellSize" :width="map.cellSize" :height="map.cellSize" /></clipPath></defs>
    <g v-for="tile in accents" :key="'accent-' + tile.x + ',' + tile.y" :transform="`translate(${(tile.x + .5) * map.cellSize} ${(tile.y + .5) * map.cellSize}) scale(${map.cellSize / 40})`">
      <g class="town-vegetation ambience-grass" :style="vegetationMotion(map, { ...tile, type: 'grass' })"><path d="M-7 7q1-7-3-11M-2 8q3-9 1-15M3 8q0-7 5-11" fill="none" stroke="#7c8c5a" stroke-width="1.4" opacity=".65"/><g v-if="tile.type === 'flowers'" fill="#b9a576" opacity=".8"><circle cx="-10" cy="-4" r="2.2"/><circle cx="-1" cy="-7" r="2"/></g></g>
    </g>
    <g v-for="patch in patches" :key="patch.id" :clip-path="`url(#${map.id}-dust-${patch.id})`" class="ambience-dust">
      <g v-for="(tile, index) in patch.tiles" :key="tile.x + ',' + tile.y" :transform="`translate(${tile.x * map.cellSize} ${tile.y * map.cellSize})`"><g class="dust-drift" :style="{ animationDuration: patch.seconds + index * 1.7 + 's', animationDelay: -(patch.phase + index * 3.7) + 's' }"><ellipse cx="8" cy="24" rx="12" ry="2.5"/><circle cx="16" cy="19" r=".9"/><circle cx="4" cy="27" r=".7"/></g></g>
    </g>
    <g v-for="bird in birds" :key="bird.id" class="ambience-bird" :class="{ 'ambience-bird--flying': bird.pose.flying }" :transform="`translate(${bird.pose.x} ${bird.pose.y}) scale(${map.cellSize / 40 * bird.pose.direction} ${map.cellSize / 40})`">
      <ellipse v-if="!bird.pose.flying" cx="0" cy="1" rx="5" ry="1" fill="#302f2740"/>
      <g transform="translate(0 -3)"><path d="M-3 1-7 3-4-1" fill="#494b3d"/><ellipse rx="3.4" ry="2.2" fill="#515746"/><circle cx="2.5" cy="-1.5" r="1.7" fill="#424a3e"/><path d="m4-1 2 .6-2 .4" fill="#9b8251"/>
        <g v-if="bird.pose.flying" class="bird-wings" fill="none" stroke="#414b3c" stroke-width="2" stroke-linecap="round"><path class="bird-wing" d="M0 0Q-5-8-11-5M0 0Q4-8 10-5"/></g>
        <path v-else d="M-2 0 1 1M-1 2v1m3-1v1" stroke="#353f33" stroke-width=".7"/>
      </g>
    </g>
    <g v-for="animal in animals" :key="'animal-' + animal.id" class="ambience-animal" :class="'ambience-animal--' + animal.kind" :opacity="animal.pose.opacity" :transform="`translate(${animal.pose.x} ${animal.pose.y}) scale(${map.cellSize / 40 * animal.pose.scale * animal.pose.direction} ${map.cellSize / 40 * animal.pose.scale})`">
      <template v-if="animal.kind === 'squirrel'">
        <ellipse cx="0" cy="10" rx="11" ry="2" fill="#25342255" />
        <path d="M-8 3C-23 0-18-19-9-15C-15-10-10-6-6-5" fill="#9a613c" stroke="#6c422f" stroke-width="2" />
        <ellipse cx="-1" cy="3" rx="9" ry="7" fill="#9c6540" stroke="#714a31" stroke-width="1.5" />
        <circle cx="8" cy="-3" r="5" fill="#a66b45" /><path d="m4-7-1-6 5 3" fill="#9b5e3a" />
        <circle cx="10" cy="-5" r="1" fill="#221d19" /><circle cx="13" cy="-2" r="1.2" fill="#e0a7a0" />
        <path d="M1 9v3m6-2v3" stroke="#63452f" stroke-width="2" />
        <g v-if="animal.pose.phase === 'nibble'" class="squirrel-nibble"><ellipse cx="8" cy="4" rx="2.7" ry="3.5" fill="#a9864b" stroke="#694a2d" /><path d="M5 3 9 0" stroke="#d4b77c" /><path d="M4 3 7 4" stroke="#68452c" stroke-width="1.5" /></g>
      </template>
      <template v-else-if="animal.kind === 'eagle'">
        <ellipse cy="4" rx="9" ry="4" fill="#654932" /><path class="eagle-wing" d="M-1 0Q-13-13-25-7L-12 2M1 0Q13-13 25-7L12 2" fill="#66513c" stroke="#473b32" stroke-width="2" />
        <circle cx="7" cy="-2" r="4" fill="#d3c5a3" /><path d="m10-2 7 2-6 2" fill="#d5a24f" /><circle cx="8" cy="-3" r=".8" fill="#251f1b" /><path d="M-7 5-12 11M4 6l-2 6" stroke="#55402e" stroke-width="2" />
      </template>
      <template v-else-if="animal.kind === 'mole'">
        <ellipse cy="10" rx="13" ry="4" fill="#61513b" stroke="#8a7653" /><ellipse cy="5" rx="8" ry="9" fill="#735c4b" /><ellipse cx="-7" cy="6" rx="3" ry="2" fill="#927665" /><ellipse cx="7" cy="6" rx="3" ry="2" fill="#927665" />
        <circle cx="-4" cy="1" r=".9" fill="#211b1a" /><circle cx="4" cy="1" r=".9" fill="#211b1a" /><circle :cx="animal.pose.nose" cy="5" r="2.3" fill="#d3979a" />
      </template>
      <template v-else-if="animal.kind === 'fish'">
        <g :transform="`rotate(${animal.pose.angle})`"><path d="M-9 0-18-7v14z" fill="#668a91" stroke="#315c66" stroke-width="1.5" /><ellipse cx="0" rx="11" ry="6" fill="#bacdd0" stroke="#315c66" stroke-width="1.8" /><circle cx="6" cy="-2" r="1.3" fill="#203b45" /><path d="M-3-5 1-11 5-5" fill="#799fa5" stroke="#4a727b" /></g>
      </template>
    </g>
    <g v-for="fish in animals.filter(animal => animal.kind === 'fish')" :key="'splash-' + fish.id" :transform="`translate(${(fish.origin.x + .5) * map.cellSize} ${(fish.origin.y + .5) * map.cellSize}) scale(${map.cellSize / 40})`" :opacity="fish.pose.splash" class="ambience-fish-splash">
      <ellipse cy="3" rx="14" ry="4" fill="none" stroke="#e5f4ed" stroke-width="2" />
      <path d="m-9-1-3-5m20 5 3-5M0-2V-9" stroke="#e5f4ed" stroke-width="2" stroke-linecap="round" />
    </g>
  </g>
</template>

<style scoped>
.map-ambience{pointer-events:none}.ambience-dust{fill:#cbb57c;opacity:.2}.dust-drift{animation:dust-drift 16s ease-in-out infinite;opacity:0}.bird-wing{transform-origin:0 0;animation:bird-flap .32s ease-in-out infinite alternate}.eagle-wing{transform-origin:0 0;animation:bird-flap .7s ease-in-out infinite alternate}.squirrel-nibble{transform-origin:7px 4px;animation:squirrel-nibble .22s ease-in-out infinite alternate}.ambience-bird--flying{filter:drop-shadow(3px 6px 1px #24352c22)}@keyframes dust-drift{0%,30%,100%{opacity:0;transform:translate(-12px,3px)}45%{opacity:.65}80%{opacity:.3;transform:translate(28px,-6px)}}@keyframes bird-flap{from{transform:scaleY(.35)}to{transform:scaleY(1)}}@keyframes squirrel-nibble{from{transform:rotate(-7deg)}to{transform:rotate(8deg)}}@media(prefers-reduced-motion:reduce){.ambience-bird,.ambience-dust,.ambience-animal{display:none}.dust-drift,.bird-wing,.eagle-wing,.squirrel-nibble{animation:none}}
</style>
