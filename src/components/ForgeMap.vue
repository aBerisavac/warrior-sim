<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BlacksmithHouseArt from './BlacksmithHouseArt.vue'
import CircleIcon from './CircleIcon.vue'
import stations from '../data/forge-stations.json'
import { isUnlocked } from '../progression'

const props = defineProps({
  completedQuests: { type: Array, required: true },
  forgeCoal: { type: Number, required: true },
  coalStock: { type: Number, required: true },
  coalCapacity: { type: Number, required: true },
})
const emit = defineEmits(['town', 'modal', 'add-coal'])
const { t } = useI18n()
const loading = ref(false)
const selected = ref('furnace')
let coalTimer

const stationMessage = computed(() => {
  if (loading.value) return t('forgeHouse.loadingCoal')
  if (selected.value === 'furnace') {
    if (props.forgeCoal >= props.coalCapacity) return t('forgeHouse.furnaceFull')
    if (props.coalStock <= 0) return t('forgeHouse.noCoal')
    return t('forgeHouse.furnaceHelp')
  }
  return t('forgeHouse.details.' + selected.value)
})

function activate(station) {
  if (!isUnlocked(props.completedQuests, 'forgeStations', station.id)) return
  selected.value = station.id
  if (station.action === 'addCoal') {
    if (loading.value || props.forgeCoal >= props.coalCapacity || props.coalStock <= 0) return
    loading.value = true
    coalTimer = setTimeout(() => {
      emit('add-coal')
      loading.value = false
      coalTimer = undefined
    }, 3000)
  } else if (station.action === 'forge') emit('modal', 'forge')
  else if (station.action === 'workbench') emit('modal', 'workbench')
  else if (station.action === 'sleep') emit('modal', 'sleep')
  else if (station.action === 'town') emit('town')
}

onBeforeUnmount(() => clearTimeout(coalTimer))
</script>

<template>
  <BlacksmithHouseArt />
  <button class="interior-back" type="button" @click="emit('town')">← {{ t('map.backTown') }}</button>

  <CircleIcon
    v-for="station in stations"
    :key="station.id"
    size="forge"
    :icon="station.icon"
    class="forge-hotspot"
    :class="{ active: selected === station.id, loading: loading && station.id === 'furnace' }"
    :style="{ left: station.x + '%', top: station.y + '%' }"
    :aria-label="t('forgeHouse.actions.' + station.id)"
    :title="t('forgeHouse.actions.' + station.id)"
    :aria-busy="station.id === 'furnace' && loading"
    :disabled="!isUnlocked(completedQuests, 'forgeStations', station.id)"
    @click="activate(station)"
  />

  <div v-if="isUnlocked(completedQuests, 'forgeStations', 'furnace')" class="forge-status" role="status" aria-live="polite">
    <div class="forge-status-top">
      <strong>{{ t('forgeHouse.station.' + selected) }}</strong>
      <span>{{ t('forgeHouse.coalCount', { count: forgeCoal, capacity: coalCapacity }) }}</span>
    </div>
    <p>{{ stationMessage }}</p>
    <div v-if="loading" class="forge-load-track"><span></span></div>
    <small>{{ t('forgeHouse.reserve', { count: coalStock }) }}</small>
  </div>
</template>
