<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ambienceFor, birdPose, dustPatches, groundAccents, vegetationMotion } from '../map-ambience'
const props = defineProps({ map: Object, paused: Boolean })
const config = computed(() => ambienceFor(props.map))
const accents = computed(() => groundAccents(props.map))
const patches = computed(() => dustPatches(props.map))
const seconds = ref(0)
const birds = computed(() => (config.value?.birds || []).map(route => ({ id: route.id, pose: birdPose(props.map, route, seconds.value) })).filter(bird => bird.pose))
let frame, previous, pending = 0
function animate(now) {
  if (previous !== undefined) pending += Math.min(.1, (now - previous) / 1000)
  if (pending >= 1 / 30) { seconds.value += pending; pending = 0 }
  previous = now
  frame = requestAnimationFrame(animate)
}
watch(() => [props.paused, !!config.value], ([paused, enabled]) => {
  globalThis.cancelAnimationFrame?.(frame); previous = undefined; pending = 0
  if (!paused && enabled && typeof requestAnimationFrame !== 'undefined') frame = requestAnimationFrame(animate)
}, { immediate: true })
watch(() => props.map.id, () => { seconds.value = 0 })
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
  </g>
</template>

<style scoped>
.map-ambience{pointer-events:none}.ambience-dust{fill:#cbb57c;opacity:.2}.dust-drift{animation:dust-drift 16s ease-in-out infinite;opacity:0}.bird-wing{transform-origin:0 0;animation:bird-flap .32s ease-in-out infinite alternate}.ambience-bird--flying{filter:drop-shadow(3px 6px 1px #24352c22)}@keyframes dust-drift{0%,30%,100%{opacity:0;transform:translate(-12px,3px)}45%{opacity:.65}80%{opacity:.3;transform:translate(28px,-6px)}}@keyframes bird-flap{from{transform:scaleY(.35)}to{transform:scaleY(1)}}@media(prefers-reduced-motion:reduce){.ambience-bird,.ambience-dust{display:none}.dust-drift,.bird-wing{animation:none}}
</style>
