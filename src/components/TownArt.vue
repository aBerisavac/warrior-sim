<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MapAmbience from './MapAmbience.vue'
import { ambienceFor, ambienceSeed, vegetationMotion } from '../map-ambience'
import { buildingOutline } from '../town-grid'
import { structureImage } from '../map-upgrades'
const { t } = useI18n()
const props = defineProps({ ambienceEnabled: { type: Boolean, default: true }, paused: Boolean, map: { type: Object, required: true }, tiers: { type: Object, default: () => ({}) }, markedEntrances: { type: Array, default: () => [] } })
const motionUnavailable = ref(false)
let media
function updateMotion() { motionUnavailable.value = document.hidden || !!media?.matches }
onMounted(() => { media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); updateMotion(); media?.addEventListener('change', updateMotion); document.addEventListener('visibilitychange', updateMotion) })
onBeforeUnmount(() => { media?.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateMotion) })
const config = computed(() => props.ambienceEnabled ? ambienceFor(props.map) : null)
const motionStyle = decor => config.value ? vegetationMotion(props.map, decor) : null
const tileMotionStyle = (x, y) => ({ '--water-delay': -ambienceSeed(props.map, x, y, 'water') * 12 + 's' })
const artFor = (structure) => structureImage(structure, props.tiers)
const mapSize = computed(() => ({ width: props.map.columns * props.map.cellSize, height: props.map.rows * props.map.cellSize }))
</script>

<template>
<svg class="town-art" :class="{ 'town-art--paused': paused || motionUnavailable, 'town-art--animated': !!config }" :viewBox="'0 0 ' + mapSize.width + ' ' + mapSize.height" preserveAspectRatio="none" role="img" :aria-label="t('map.townAria')">
    <defs>
      <pattern id="town-grid" :width="map.cellSize" :height="map.cellSize" patternUnits="userSpaceOnUse"><path :d="'M ' + map.cellSize + ' 0 H 0 V ' + map.cellSize" fill="none" stroke="#675d44" stroke-width="1" opacity=".22" /></pattern>
      <pattern id="bridge-planks" width="8" height="40" patternUnits="userSpaceOnUse"><path d="M0 0V40" stroke="#5f472d" stroke-width="1.5" opacity=".65" /></pattern>
      <clipPath v-for="building in map.buildings" :id="'town-building-clip-' + building.id" :key="building.id" clipPathUnits="userSpaceOnUse"><path :d="buildingOutline(building, map.cellSize)" /></clipPath>
    </defs>
    <g v-for="(row, y) in map.terrain" :key="'row-' + y">
      <g v-for="(tile, x) in [...row]" :key="x" :transform="'translate(' + x * map.cellSize + ' ' + y * map.cellSize + ') scale(' + map.cellSize / 40 + ')'">
        <rect width="40" height="40" :class="'town-tile town-tile-' + tile" />
        <template v-if="tile === 'R'"><path d="m7 9 4-1m15 21 5-2m-20 6 3-1" stroke="#a89471" stroke-width="1.2" opacity=".6" /></template>
        <template v-else-if="tile === 'F'"><g :class="{ 'town-vegetation': !!config }" :style="motionStyle({ type: 'forest', x, y })" style="transform-origin:20px 35px"><path d="M20 5l-11 16h5l-9 12h30l-9-12h5z" fill="#56725a" stroke="#3d5847" stroke-width="1.5" /><path d="M20 30v7" stroke="#6b5138" stroke-width="3" /></g></template>
        <template v-else-if="tile === 'M'"><path d="M2 33 13 8l7 15 5-10 13 20z" fill="#8c8c7d" stroke="#5b655f" stroke-width="1.5" /><path d="m9 17 4-9 4 9m5 4 3-8 5 8" fill="none" stroke="#ded9be" stroke-width="2" /></template>
        <template v-else-if="tile === 'A'"><path d="M5 2v36m9-36v36m9-36v36m9-36v36" stroke="#ad9a66" stroke-width="2" opacity=".65" /><path :class="{ 'town-vegetation': config?.crops }" :style="motionStyle({ type: 'grass', x, y })" style="transform-origin:20px 35px" d="m4 14 4-6m6 18 4-6m6-7 4-6m5 24 4-6" stroke="#7f915d" stroke-width="2" /></template>
        <template v-else-if="tile === '~'"><path :class="{ 'town-water-ripple': config?.water }" :style="tileMotionStyle(x, y)" d="M4 11q7-5 14 0t16 0M3 28q7-5 14 0t17 0" fill="none" stroke="#b6d1bc" stroke-width="2" opacity=".75" /></template>
        <template v-else-if="tile === 'B'"><rect x="0" y="8" width="40" height="24" fill="#9f7950" stroke="#694f35" stroke-width="2" /><rect x="0" y="8" width="40" height="24" fill="url(#bridge-planks)" /><path d="M0 5h40M0 35h40" stroke="#624931" stroke-width="3" /></template>
        <template v-else-if="tile === 'W'"><rect x="5" y="5" width="30" height="30" rx="2" fill="#806a4d" stroke="#5e4d3b" stroke-width="2" /><path d="M13 6v28m14-28v28" stroke="#b0976d" stroke-width="2" /></template>
        <image v-if="map.tileImages?.[tile]" :href="map.tileImages[tile]" width="40" height="40" preserveAspectRatio="xMidYMid slice" />
      </g>
    </g>
    <image v-for="(image, index) in map.cellImages || []" :key="'cell-image-' + index" :href="image.src" :x="image.x * map.cellSize" :y="image.y * map.cellSize" :width="map.cellSize" :height="map.cellSize" preserveAspectRatio="xMidYMid slice" />
    <rect :width="mapSize.width" :height="mapSize.height" fill="url(#town-grid)" pointer-events="none" />
    <g v-for="building in map.buildings" :key="building.id" :class="['town-building', 'town-building-' + building.kind]">
      <path v-if="artFor(building)" class="town-art-ground" :d="buildingOutline(building, map.cellSize)" />
      <path v-if="!artFor(building)" class="town-roof" :d="buildingOutline(building, map.cellSize)" />
      <image v-if="artFor(building)" :href="artFor(building)" :x="building.x * map.cellSize" :y="building.y * map.cellSize" :width="building.width * map.cellSize" :height="building.height * map.cellSize" :clip-path="'url(#town-building-clip-' + building.id + ')'" preserveAspectRatio="xMidYMid slice" />
      <circle v-if="building.door && !markedEntrances.includes(building.id)" class="town-entrance-marker" :cx="(building.door.x + .5) * map.cellSize" :cy="(building.door.y + .5) * map.cellSize" r="3" />
    </g>
    <g v-for="gate in map.gates" :key="gate.id" :transform="'translate(' + gate.x * map.cellSize + ' ' + gate.y * map.cellSize + ')'" class="town-gate">
      <rect v-if="artFor(gate)" :width="(gate.width ?? 1) * map.cellSize" :height="(gate.height ?? 1) * map.cellSize" class="town-art-ground" />
      <template v-if="!artFor(gate)">
        <rect x="4" y="4" :width="(gate.width ?? 1) * map.cellSize - 8" :height="(gate.height ?? 1) * map.cellSize - 8" fill="#a08458" stroke="#5d4c37" stroke-width="2" />
        <path v-if="gate.direction === 'north' || gate.direction === 'south'" :d="`M${(gate.width ?? 1) * map.cellSize / 2 - 4} 4V${(gate.height ?? 1) * map.cellSize - 4} M${(gate.width ?? 1) * map.cellSize / 2 + 4} 4V${(gate.height ?? 1) * map.cellSize - 4}`" stroke="#55422e" stroke-width="3" />
        <path v-else :d="`M4 ${(gate.height ?? 1) * map.cellSize / 2 - 4}H${(gate.width ?? 1) * map.cellSize - 4} M4 ${(gate.height ?? 1) * map.cellSize / 2 + 4}H${(gate.width ?? 1) * map.cellSize - 4}`" stroke="#55422e" stroke-width="3" />
      </template>
      <image v-else :href="artFor(gate)" x="0" y="0" :width="(gate.width ?? 1) * map.cellSize" :height="(gate.height ?? 1) * map.cellSize" preserveAspectRatio="xMidYMid meet" />
    </g>
    <g v-for="(decor, index) in map.decor" :key="'decor-' + index" :transform="'translate(' + (decor.x + .5) * map.cellSize + ' ' + (decor.y + .5) * map.cellSize + ') scale(' + map.cellSize / 40 + ')'" class="town-decor">
      <g :class="{ 'town-vegetation': !!motionStyle(decor) && decor.type !== 'tree' }" :style="decor.type !== 'tree' ? motionStyle(decor) : null">
      <template v-if="decor.type === 'well'"><circle r="13" fill="#b1a57b" stroke="#675e4c" stroke-width="3" /><circle r="7" fill="#6b9b9d" /></template>
      <template v-else-if="decor.type === 'crates'"><rect x="-12" y="-9" width="11" height="11" fill="#a17d50" stroke="#6d5338" /><rect x="2" y="-4" width="11" height="11" fill="#a17d50" stroke="#6d5338" /></template>
      <template v-else-if="decor.type === 'flowers'"><circle cx="-6" r="4" fill="#9b9271" /><circle cx="6" cy="4" r="4" fill="#9b9271" /></template>
      <template v-else-if="decor.type === 'bush'"><circle cx="-8" cy="3" r="8" fill="#59754d" /><circle cy="-3" r="10" fill="#6e8a55" /><circle cx="9" cy="3" r="8" fill="#4c6c48" /></template>
      <template v-else-if="decor.type === 'tree'"><rect x="-3" y="2" width="6" height="15" fill="#705338" /><g :class="{ 'town-vegetation': !!motionStyle(decor) }" :style="motionStyle(decor)"><circle cy="-6" r="14" fill="#55764f" stroke="#405d42" stroke-width="2" /></g></template>
      <template v-else-if="decor.type === 'rock'"><path d="M-12 10-8-5 4-11 13-2 11 11Z" fill="#93988a" stroke="#626b60" stroke-width="2" /></template>
      <template v-else-if="decor.type === 'barrel'"><ellipse cy="-9" rx="9" ry="4" fill="#6e5137" /><path d="M-9-9v18q9 6 18 0V-9" fill="#8b6642" stroke="#5d452f" stroke-width="2" /></template>
      <template v-else-if="decor.type === 'cart'"><rect x="-12" y="-8" width="24" height="13" fill="#9b7549" stroke="#644a32" stroke-width="2" /><circle cx="-7" cy="9" r="4" fill="#443b2d" /><circle cx="8" cy="9" r="4" fill="#443b2d" /></template>
      </g>
    </g>
    <MapAmbience v-if="config" :map="map" :paused="paused || motionUnavailable" />
  </svg>
</template>

<style>
.town-art .town-vegetation{transform-origin:0px 12px;animation:town-plant-sway var(--sway-time,8s) ease-in-out var(--sway-delay,0s) infinite alternate}.town-water-ripple{animation:town-water-breathe 5.7s ease-in-out var(--water-delay,0s) infinite alternate}.town-art--paused *{animation-play-state:paused!important}@keyframes town-plant-sway{0%{transform:rotate(calc(var(--sway-angle,1deg) * -.65))}65%{transform:rotate(var(--sway-angle,1deg))}100%{transform:rotate(calc(var(--sway-angle,1deg) * .25))}}@keyframes town-water-breathe{from{opacity:.45;transform:translateX(-1px)}to{opacity:.85;transform:translateX(1px)}}@media(prefers-reduced-motion:reduce){.town-art .town-vegetation,.town-water-ripple{animation:none!important}}
</style>
