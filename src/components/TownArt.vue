<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildingOutline } from '../town-grid'
const { t } = useI18n()
const props = defineProps({ map: { type: Object, required: true } })
const mapSize = computed(() => ({ width: props.map.columns * props.map.cellSize, height: props.map.rows * props.map.cellSize }))
</script>

<template>
<svg class="town-art" :viewBox="'0 0 ' + mapSize.width + ' ' + mapSize.height" preserveAspectRatio="none" role="img" :aria-label="t('map.townAria')">
    <defs>
      <pattern id="town-grid" :width="map.cellSize" :height="map.cellSize" patternUnits="userSpaceOnUse"><path :d="'M ' + map.cellSize + ' 0 H 0 V ' + map.cellSize" fill="none" stroke="#675d44" stroke-width="1" opacity=".22" /></pattern>
      <pattern id="bridge-planks" width="8" height="40" patternUnits="userSpaceOnUse"><path d="M0 0V40" stroke="#5f472d" stroke-width="1.5" opacity=".65" /></pattern>
      <clipPath v-for="building in map.buildings" :id="'town-building-clip-' + building.id" :key="building.id" clipPathUnits="userSpaceOnUse"><path :d="buildingOutline(building, map.cellSize)" /></clipPath>
    </defs>
    <g v-for="(row, y) in map.terrain" :key="'row-' + y">
      <g v-for="(tile, x) in [...row]" :key="x" :transform="'translate(' + x * map.cellSize + ' ' + y * map.cellSize + ')'">
        <rect width="40" height="40" :class="'town-tile town-tile-' + tile" />
        <template v-if="tile === 'R'"><path d="m7 9 4-1m15 21 5-2m-20 6 3-1" stroke="#a89471" stroke-width="1.2" opacity=".6" /></template>
        <template v-else-if="tile === 'F'"><path d="M20 5l-11 16h5l-9 12h30l-9-12h5z" fill="#56725a" stroke="#3d5847" stroke-width="1.5" /><path d="M20 30v7" stroke="#6b5138" stroke-width="3" /></template>
        <template v-else-if="tile === 'M'"><path d="M2 33 13 8l7 15 5-10 13 20z" fill="#8c8c7d" stroke="#5b655f" stroke-width="1.5" /><path d="m9 17 4-9 4 9m5 4 3-8 5 8" fill="none" stroke="#ded9be" stroke-width="2" /></template>
        <template v-else-if="tile === 'A'"><path d="M5 2v36m9-36v36m9-36v36m9-36v36" stroke="#ad9a66" stroke-width="2" opacity=".65" /><path d="m4 14 4-6m6 18 4-6m6-7 4-6m5 24 4-6" stroke="#7f915d" stroke-width="2" /></template>
        <template v-else-if="tile === '~'"><path d="M4 11q7-5 14 0t16 0M3 28q7-5 14 0t17 0" fill="none" stroke="#b6d1bc" stroke-width="2" opacity=".75" /></template>
        <template v-else-if="tile === 'B'"><rect x="0" y="8" width="40" height="24" fill="#9f7950" stroke="#694f35" stroke-width="2" /><rect x="0" y="8" width="40" height="24" fill="url(#bridge-planks)" /><path d="M0 5h40M0 35h40" stroke="#624931" stroke-width="3" /></template>
        <template v-else-if="tile === 'W'"><rect x="5" y="5" width="30" height="30" rx="2" fill="#806a4d" stroke="#5e4d3b" stroke-width="2" /><path d="M13 6v28m14-28v28" stroke="#b0976d" stroke-width="2" /></template>
        <image v-if="map.tileImages?.[tile]" :href="map.tileImages[tile]" width="40" height="40" preserveAspectRatio="xMidYMid slice" />
      </g>
    </g>
    <image v-for="(image, index) in map.cellImages || []" :key="'cell-image-' + index" :href="image.src" :x="image.x * map.cellSize" :y="image.y * map.cellSize" :width="map.cellSize" :height="map.cellSize" preserveAspectRatio="xMidYMid slice" />
    <rect :width="mapSize.width" :height="mapSize.height" fill="url(#town-grid)" pointer-events="none" />
    <g v-for="building in map.buildings" :key="building.id" :class="['town-building', 'town-building-' + building.kind]">
      <path v-if="!building.imageSrc" class="town-roof" :d="buildingOutline(building, map.cellSize)" />
      <image v-if="building.imageSrc" :href="building.imageSrc" :x="building.x * map.cellSize" :y="building.y * map.cellSize" :width="building.width * map.cellSize" :height="building.height * map.cellSize" :clip-path="'url(#town-building-clip-' + building.id + ')'" preserveAspectRatio="xMidYMid slice" />
      <circle v-if="building.door" class="town-entrance-marker" :cx="(building.door.x + .5) * map.cellSize" :cy="(building.door.y + .5) * map.cellSize" r="5" />
    </g>
    <g v-for="gate in map.gates" :key="gate.id" :transform="'translate(' + gate.x * map.cellSize + ' ' + gate.y * map.cellSize + ')'" class="town-gate">
      <rect x="4" y="4" :width="(gate.width ?? 1) * map.cellSize - 8" :height="(gate.height ?? 1) * map.cellSize - 8" fill="#a08458" stroke="#5d4c37" stroke-width="2" />
      <path v-if="gate.direction === 'north' || gate.direction === 'south'" :d="`M${(gate.width ?? 1) * map.cellSize / 2 - 4} 4V${(gate.height ?? 1) * map.cellSize - 4} M${(gate.width ?? 1) * map.cellSize / 2 + 4} 4V${(gate.height ?? 1) * map.cellSize - 4}`" stroke="#55422e" stroke-width="3" />
      <path v-else :d="`M4 ${(gate.height ?? 1) * map.cellSize / 2 - 4}H${(gate.width ?? 1) * map.cellSize - 4} M4 ${(gate.height ?? 1) * map.cellSize / 2 + 4}H${(gate.width ?? 1) * map.cellSize - 4}`" stroke="#55422e" stroke-width="3" />
    </g>
    <g v-for="(decor, index) in map.decor" :key="'decor-' + index" :transform="'translate(' + (decor.x + .5) * 40 + ' ' + (decor.y + .5) * 40 + ')'" class="town-decor">
      <template v-if="decor.type === 'well'"><circle r="13" fill="#b1a57b" stroke="#675e4c" stroke-width="3" /><circle r="7" fill="#6b9b9d" /></template>
      <template v-else-if="decor.type === 'crates'"><rect x="-12" y="-9" width="11" height="11" fill="#a17d50" stroke="#6d5338" /><rect x="2" y="-4" width="11" height="11" fill="#a17d50" stroke="#6d5338" /></template>
      <template v-else><circle cx="-6" r="4" fill="#9b9271" /><circle cx="6" cy="4" r="4" fill="#9b9271" /></template>
    </g>
  </svg>
</template>
