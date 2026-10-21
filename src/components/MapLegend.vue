<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isUnlocked } from '../progression'
import CircleIcon from './CircleIcon.vue'

const props = defineProps({
  places: { type: Array, required: true },
  completedQuests: { type: Array, required: true },
  currentLocation: { type: String, required: true },
  selectedId: { type: String, required: true },
  dialogueBlocked: { type: Boolean, default: false },
})
const emit = defineEmits(['focus'])
const { t } = useI18n()
const open = ref(false)

function locked(place) {
  return !place.available || !isUnlocked(props.completedQuests, 'places', place.id)
}
function focus(place) {
  if (props.dialogueBlocked || locked(place)) return
  open.value = false
  emit('focus', place.id)
}
</script>

<template>
  <aside class="map-legend" :class="{ 'map-legend--open': open }" :aria-label="t('map.legendTitle')">
    <button class="map-legend-toggle" type="button" :aria-expanded="open"
      :aria-label="t(open ? 'map.hideLegend' : 'map.showLegend')" @click="open = !open">
      <span class="map-legend-toggle-icon" aria-hidden="true">☷</span>
      <span v-if="open">{{ t('map.legendTitle') }}</span>
    </button>
    <div v-if="open" class="map-legend-list">
      <button v-for="place in places" :key="place.id" class="map-legend-item" type="button"
        :class="{ 'map-legend-item--locked': locked(place), 'map-legend-item--selected': selectedId === place.id, 'map-legend-item--current': currentLocation === place.id }"
        :disabled="dialogueBlocked || locked(place)" :title="t('places.' + place.id + '.name')"
        @click="focus(place)">
        <CircleIcon as="span" size="guide" :icon="place.icon" />
        <span class="map-legend-name">{{ t('places.' + place.id + '.name') }}</span>
        <span v-if="currentLocation === place.id" class="map-legend-current" :aria-label="t('sidebar.youAreHere')">●</span>
      </button>
    </div>
  </aside>
</template>
