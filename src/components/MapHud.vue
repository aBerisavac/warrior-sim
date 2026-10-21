<script setup>
import { useI18n } from 'vue-i18n'
import StatusRing from '../StatusRing.vue'
import { isUnlocked } from '../progression'
defineProps({
  health: { type: Number, required: true },
  stamina: { type: Number, required: true },
  sleepNeed: { type: Number, required: true },
  coins: { type: Number, required: true },
  completedQuests: { type: Array, required: true },
  traveling: { type: Boolean, default: false },
})
const emit = defineEmits(['modal'])
const { t } = useI18n()
</script>

<template>
  <div class="map-hud">
    <button class="hud-pawn" :disabled="!isUnlocked(completedQuests, 'hud', 'pawn')" @click="emit('modal', 'pawn')" :aria-label="t('hud.openPawn')">
      <span class="hud-avatar"><img src="/images/profile/blacksmith.png" alt="" /></span>
      <span class="hud-pawn-copy"><b>{{ t('app.chapterName') }}</b><small>◈ {{ t('app.coins', { count: coins }) }}</small></span>
    </button>
    <div class="hud-vitals">
      <StatusRing :percent="health" :label="t('sidebar.health')" glyph="♥" tone="health-ring" />
      <StatusRing :percent="stamina" :label="t('sidebar.stamina')" glyph="ϟ" tone="stamina-ring" />
      <StatusRing :percent="sleepNeed" :label="t('hud.sleep')" glyph="☾" tone="sleep-ring" :clickable="!traveling && isUnlocked(completedQuests, 'hud', 'sleep')" @click="!traveling && isUnlocked(completedQuests, 'hud', 'sleep') && emit('modal', 'sleep')" />
    </div>
    <div class="hud-tools">
      <button :disabled="!isUnlocked(completedQuests, 'hud', 'objective')" @click="emit('modal', 'objective')" :aria-label="t('hud.openObjective')" :title="t('sidebar.currentObjective')"><b>✧</b><span>{{ t('hud.objective') }}</span></button>
      <button :disabled="!isUnlocked(completedQuests, 'hud', 'journal')" @click="emit('modal', 'journal')" :aria-label="t('hud.openJournal')" :title="t('sidebar.fieldNotes')"><b>☷</b><span>{{ t('hud.journal') }}</span></button>
    </div>
  </div>
</template>
