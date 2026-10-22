<script setup>
import CurrencyAmount from './CurrencyAmount.vue'
import { useI18n } from 'vue-i18n'
import StatusRing from '../StatusRing.vue'
import { isUnlocked } from '../progression'
defineProps({
  busy: { type: Boolean, default: false },
  avatarSrc: { type: String, default: '/images/profile/blacksmith.png' },
  playerName: { type: String, default: '' },
  health: { type: Number, required: true },
  stamina: { type: Number, required: true },
  sleepNeed: { type: Number, required: true },
  hunger: { type: Number, default: 0 },
  coins: { type: Number, required: true },
  completedQuests: { type: Array, required: true },
  traveling: { type: Boolean, default: false },
  atHome: { type: Boolean, default: false },
})
const emit = defineEmits(['modal'])
const { t } = useI18n()
</script>

<template>
  <div class="map-hud">
    <button class="hud-pawn" :disabled="busy || !isUnlocked(completedQuests, 'hud', 'pawn')" @click="emit('modal', 'pawn')" :aria-label="t('hud.openPawn')">
      <span class="hud-avatar"><img :src="avatarSrc" alt="" /></span>
      <span class="hud-pawn-copy"><b>{{ playerName || t('app.chapterName') }}</b><small><CurrencyAmount :amount="coins" /></small></span>
    </button>
    <div class="hud-vitals">
      <StatusRing :percent="health" :label="t('sidebar.health')" glyph="♥" tone="health-ring" />
      <StatusRing :percent="stamina" :label="t('sidebar.stamina')" glyph="ϟ" tone="stamina-ring" />
      <StatusRing :percent="sleepNeed" :label="t('hud.sleep')" glyph="☾" tone="sleep-ring" :clickable="!busy && !traveling && atHome && isUnlocked(completedQuests, 'hud', 'sleep')" @click="!busy && !traveling && atHome && isUnlocked(completedQuests, 'hud', 'sleep') && emit('modal', 'sleep')" />
      <StatusRing :percent="hunger" :label="t('needs.hunger')" glyph="♨" tone="hunger-ring" :clickable="!busy" @click="!busy && emit('modal', 'inventory')" />
    </div>
  </div>
</template>
