<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MapAmbience from './MapAmbience.vue'
import { ambienceFor, ambienceSeed, vegetationMotion } from '../map-ambience'
import { buildingOutline } from '../town-grid'
import { structureImage } from '../map-upgrades'
import { decorationVariant } from '../map-decorations'
const { t } = useI18n()
const props = defineProps({ ambienceEnabled: { type: Boolean, default: true }, paused: Boolean, raining: Boolean, map: { type: Object, required: true }, tiers: { type: Object, default: () => ({}) }, markedEntrances: { type: Array, default: () => [] } })
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
const wallNeighbor = (x, y) => props.map.terrain[y]?.[x] === 'W' || props.map.gates?.some(gate => x >= gate.x && x < gate.x + (gate.width ?? 1) && y >= gate.y && y < gate.y + (gate.height ?? 1))
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
        <template v-else-if="tile === 'F'"><g v-if="ambienceSeed(map, x, y, 'forest-tree') < .62" :class="{ 'town-vegetation': !!config }" :style="motionStyle({ type: 'forest', x, y })" style="transform-origin:20px 35px"><path d="M20 5l-11 16h5l-9 12h30l-9-12h5z" fill="#56725a" stroke="#3d5847" stroke-width="1.5" /><path d="M20 30v7" stroke="#6b5138" stroke-width="3" /></g><path v-else d="m8 32 3-8 2 8m14 1 4-11 2 11" fill="none" stroke="#6f8c64" stroke-width="2" /></template>
        <template v-else-if="tile === 'S'"><path d="m6 33 2-9 2 8m13 2 3-11 3 10m-13-4 2-6 2 6" fill="none" stroke="#819c6e" stroke-width="2" /><circle cx="32" cy="13" r="2" fill="#cfb971" /></template>
        <template v-else-if="tile === 'M'"><path :d="ambienceSeed(map,x,y,'peak') < .5 ? 'M2 33 13 8l7 15 5-10 13 20z' : 'M1 33 17 6l7 17 5-9 10 19z'" fill="#8c8c7d" stroke="#5b655f" stroke-width="1.5" /><path d="m9 17 4-9 4 9m5 4 3-8 5 8" fill="none" stroke="#ded9be" stroke-width="2" /></template>
        <template v-else-if="tile === 'K'"><path d="m3 29 8-9 8 8 8-15 10 18z" fill="#999a84" stroke="#7b806f" stroke-width="1.2" /><path d="m7 9 4-3 4 3m17 4 4-2" fill="none" stroke="#bfc1ae" stroke-width="2" /></template>
        <template v-else-if="tile === 'A'"><path d="M5 2v36m9-36v36m9-36v36m9-36v36" stroke="#ad9a66" stroke-width="2" opacity=".65" /><path :class="{ 'town-vegetation': config?.crops }" :style="motionStyle({ type: 'grass', x, y })" style="transform-origin:20px 35px" d="m4 14 4-6m6 18 4-6m6-7 4-6m5 24 4-6" stroke="#7f915d" stroke-width="2" /></template>
        <template v-else-if="tile === '~' || tile === 'P'"><path :class="{ 'town-water-ripple': config?.water }" :style="tileMotionStyle(x, y)" d="M4 11q7-5 14 0t16 0M3 28q7-5 14 0t17 0" fill="none" stroke="#b6d1bc" stroke-width="2" opacity=".75" /><path v-if="tile === 'P'" d="M27 29a7 7 0 1 1-7-7l7 7-7-1" fill="#74977a" stroke="#58775e" stroke-width="1" /></template>
        <template v-else-if="tile === 'B'"><rect x="0" y="8" width="40" height="24" fill="#9f7950" stroke="#694f35" stroke-width="2" /><rect x="0" y="8" width="40" height="24" fill="url(#bridge-planks)" /><path d="M0 5h40M0 35h40" stroke="#624931" stroke-width="3" /></template>
        <template v-else-if="tile === 'D'"><rect x="0" y="6" width="40" height="28" fill="#997047" stroke="#463d32" stroke-width="3" /><rect x="0" y="6" width="40" height="28" fill="url(#bridge-planks)" /><path d="M0 4h40M0 36h40" stroke="#554634" stroke-width="4" /><circle cx="5" cy="20" r="2" fill="#d2be8a" /><circle cx="35" cy="20" r="2" fill="#d2be8a" /></template>
        <template v-else-if="tile === 'W'"><g fill="#806a4d" stroke="none"><rect x="8" y="8" width="24" height="24"/><rect v-if="wallNeighbor(x - 1, y)" x="0" y="8" width="9" height="24"/><rect v-if="wallNeighbor(x + 1, y)" x="31" y="8" width="9" height="24"/><rect v-if="wallNeighbor(x, y - 1)" x="8" y="0" width="24" height="9"/><rect v-if="wallNeighbor(x, y + 1)" x="8" y="31" width="24" height="9"/></g><path v-if="wallNeighbor(x - 1, y) || wallNeighbor(x + 1, y)" d="M4 11h32M4 29h32" stroke="#b0976d" stroke-width="1.5" opacity=".75"/><path v-else d="M11 4v32m18-32v32" stroke="#b0976d" stroke-width="1.5" opacity=".75"/></template>
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
      <template v-if="decor.type === 'well'"><rect v-if="decorationVariant(decor) === 2" x="-13" y="-13" width="26" height="26" rx="3" fill="#b4a37e" stroke="#675e4c" stroke-width="3" /><circle v-else :r="decorationVariant(decor) === 3 ? 11 : 13" fill="#b1a57b" stroke="#675e4c" stroke-width="3" /><circle :r="decorationVariant(decor) === 3 ? 5 : 7" fill="#6b9b9d" /><path v-if="decorationVariant(decor) === 3" d="M-13-12V-20H13v8" fill="none" stroke="#71583c" stroke-width="3" /></template>
      <template v-else-if="decor.type === 'crates'"><rect x="-12" y="-9" :width="decorationVariant(decor) === 3 ? 23 : 11" height="11" fill="#a17d50" stroke="#6d5338" /><rect v-if="decorationVariant(decor) !== 3" x="2" y="-4" width="11" height="11" fill="#a17d50" stroke="#6d5338" /><rect v-if="decorationVariant(decor) === 2" x="-4" y="-16" width="10" height="8" fill="#b08b57" stroke="#6d5338" /><path v-if="decorationVariant(decor) === 3" d="m-12-9 23 11m0-11L-12 2" stroke="#6d5338" /></template>
      <template v-else-if="decor.type === 'flowers'"><path d="M-7 9V-2M5 10V1" stroke="#63845a" stroke-width="2" /><circle cx="-7" cy="-3" r="4" :fill="['#c7a5a0','#e6c36e','#b6a3d0'][decorationVariant(decor)-1]" /><circle cx="5" cy="1" r="4" :fill="['#dab3a0','#f0d88a','#d2b6df'][decorationVariant(decor)-1]" /><circle v-if="decorationVariant(decor) > 1" cx="12" cy="-7" r="3" fill="#eee1c2" /></template>
      <template v-else-if="decor.type === 'bush'"><circle cx="-8" cy="3" :r="decorationVariant(decor) === 3 ? 6 : 8" fill="#59754d" /><circle cy="-3" :r="decorationVariant(decor) === 2 ? 12 : 10" fill="#6e8a55" /><circle cx="9" cy="3" r="8" fill="#4c6c48" /><circle v-if="decorationVariant(decor) === 3" cx="1" cy="-5" r="2" fill="#bb8a65" /></template>
      <template v-else-if="decor.type === 'tree'"><rect x="-3" y="2" width="6" height="15" fill="#705338" /><g :class="{ 'town-vegetation': !!motionStyle(decor) }" :style="motionStyle(decor)"><path v-if="decorationVariant(decor) === 2" d="M0-24-14 6h28z" fill="#4e7051" stroke="#405d42" stroke-width="2" /><template v-else-if="decorationVariant(decor) === 3"><circle cx="-7" cy="-7" r="11" fill="#6b8450" /><circle cx="6" cy="-10" r="11" fill="#557448" /></template><circle v-else cy="-6" r="14" fill="#55764f" stroke="#405d42" stroke-width="2" /></g></template>
      <template v-else-if="decor.type === 'rock'"><path :d="decorationVariant(decor) === 2 ? 'M-13 10-5-12 9-8 14 10Z' : decorationVariant(decor) === 3 ? 'M-14 10-11 1-2-5 6-2 14 9Z' : 'M-12 10-8-5 4-11 13-2 11 11Z'" :fill="decorationVariant(decor) === 2 ? '#a9a99a' : '#93988a'" stroke="#626b60" stroke-width="2" /></template>
      <template v-else-if="decor.type === 'barrel'"><ellipse cy="-9" :rx="decorationVariant(decor) === 2 ? 11 : 9" ry="4" fill="#6e5137" /><path :d="decorationVariant(decor) === 2 ? 'M-11-9v18q11 6 22 0V-9' : 'M-9-9v18q9 6 18 0V-9'" fill="#8b6642" stroke="#5d452f" stroke-width="2" /><path v-if="decorationVariant(decor) === 3" d="M-9 1H9" stroke="#c5ad72" stroke-width="3" /></template>
      <template v-else-if="decor.type === 'cart'"><rect x="-12" y="-8" width="24" height="13" fill="#9b7549" stroke="#644a32" stroke-width="2" /><path v-if="decorationVariant(decor) === 2" d="M-10-8 0-16 10-8" fill="#b8a37a" stroke="#644a32" /><path v-if="decorationVariant(decor) === 3" d="M-8-9v-8m8 8v-8m8 8v-8" stroke="#6e553a" stroke-width="3" /><circle cx="-7" cy="9" r="4" fill="#443b2d" /><circle cx="8" cy="9" r="4" fill="#443b2d" /></template>
      <template v-else-if="decor.type === 'grass'"><path :d="decorationVariant(decor) === 2 ? 'M-10 11-14-4m4 15L-4-8M2 11l1-17m7 17 5-12' : decorationVariant(decor) === 3 ? 'M-12 11-9-9m-2 20L-2-2M4 11l7-18m-7 18L0-5' : 'M-10 11-8-3m-2 14 7-8M3 11l2-17m4 17 5-8'" fill="none" stroke="#6f8e5e" stroke-width="2.5" stroke-linecap="round" /></template>
      </g>
    </g>
    <MapAmbience v-if="config" :map="map" :paused="paused || motionUnavailable" :raining="raining" />
  </svg>
</template>

<style>
.town-art .town-vegetation{transform-origin:0px 12px;animation:town-plant-sway var(--sway-time,8s) ease-in-out var(--sway-delay,0s) infinite alternate}.town-water-ripple{animation:town-water-breathe 5.7s ease-in-out var(--water-delay,0s) infinite alternate}.town-art--paused *{animation-play-state:paused!important}@keyframes town-plant-sway{0%{transform:rotate(calc(var(--sway-angle,1deg) * -.65))}65%{transform:rotate(var(--sway-angle,1deg))}100%{transform:rotate(calc(var(--sway-angle,1deg) * .25))}}@keyframes town-water-breathe{from{opacity:.45;transform:translateX(-1px)}to{opacity:.85;transform:translateX(1px)}}@media(prefers-reduced-motion:reduce){.town-art .town-vegetation,.town-water-ripple{animation:none!important}}
</style>
