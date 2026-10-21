<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { mapGrid } from '../routes'
import { structureImage, structureTier } from '../map-upgrades'
import { translateEntry } from '../i18n/messages'
const props = defineProps({
  selectedPlace: { type: Object, required: true },
  tutorialLocked: { type: Boolean, default: false },
  currentLocation: { type: String, required: true },
  tripMinutes: { type: Number, required: true },
  event: { type: Object, required: true },
  journal: { type: Array, required: true },
  buildingTiers: { type: Object, default: () => ({}) },
})
const { t } = useI18n()
const selectedStructure = computed(() => [...mapGrid.buildings, ...mapGrid.gates].find((item) => item.id === props.selectedPlace.id))
const selectedArt = computed(() => selectedStructure.value ? structureImage(selectedStructure.value, props.buildingTiers) : null)
const selectedTier = computed(() => structureTier(props.buildingTiers, props.selectedPlace.id))
const placeText = (place, field) => t('places.' + place.id + '.' + field)
const entryText = (entry) => translateEntry(t, entry)
</script>

<template>
  <aside class="right-panel">
    <section class="place-panel panel" :class="{ 'tutorial-card-locked': tutorialLocked }">
      <div class="panel-kicker">{{ t('sidebar.selectedLocation') }} <span>{{ t(tutorialLocked ? 'map.locked' : selectedPlace.available ? 'sidebar.open' : 'sidebar.future') }}</span></div>
      <div class="place-art"><img v-if="selectedArt" :src="selectedArt" :alt="t('places.' + selectedPlace.id + '.name')" /><span v-else>{{ selectedPlace.icon }}</span><div class="place-hill hill-one"></div><div class="place-hill hill-two"></div></div>
      <h2>{{ placeText(selectedPlace, 'name') }}</h2>
      <div class="place-sub">{{ placeText(selectedPlace, 'sub') }} <span v-if="selectedArt">· {{ t('sidebar.buildingTier', { tier: t('tiers.' + selectedTier) }) }}</span></div>
      <p>{{ tutorialLocked ? t('tutorial.lockedPlace') : placeText(selectedPlace, 'description') }}</p>
      <div v-if="tutorialLocked" class="closed-note">{{ t('tutorial.lockedPlace') }}</div>
      <div v-else-if="!selectedPlace.available" class="closed-note">{{ t('sidebar.opensLater') }}</div>
      <div v-else-if="currentLocation === selectedPlace.id" class="here-note">✧ {{ t('sidebar.youAreHere') }}</div>
      <div v-else class="here-note">{{ t('sidebar.walkingTime', { minutes: tripMinutes }) }}</div>
    </section>
    <section class="journal-panel panel">
      <div class="panel-kicker">{{ t('sidebar.fieldNotes') }}</div>
      <p class="latest-event">{{ entryText(event) }}</p>
      <details><summary>{{ t('sidebar.recentEvents') }}</summary><ul><li v-for="(entry, i) in journal" :key="i">{{ entryText(entry) }}</li></ul></details>
    </section>
    <section class="rules-panel panel">
      <div class="panel-kicker">{{ t('sidebar.howToPlay') }}</div>
      <p>{{ t('sidebar.howToPlay1') }}</p>
      <p>{{ t('sidebar.howToPlay2a') }} <b>{{ t('sidebar.townMap') }}</b> {{ t('sidebar.howToPlay2b') }}</p>
    </section>
  </aside>
</template>
