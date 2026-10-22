<script setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import characters from '../data/characters.json'
const props = defineProps({ speaker: { type: String, default: 'player' }, compact: Boolean, thought: Boolean })
const { t } = useI18n()
const character = computed(() => characters[props.speaker] || characters.player)
const playerIdentity = inject('playerIdentity', null)
const portrait = computed(() => props.speaker === 'player' ? playerIdentity?.value?.avatarSrc || character.value.portraitSrc : character.value.portraitSrc)
const name = computed(() => props.speaker === 'player' ? playerIdentity?.value?.playerName || t(character.value.nameKey) : t(character.value.nameKey))
</script>
<template>
  <span class="speaker-identity" :class="{ 'speaker-identity--compact': compact }">
    <img :src="portrait" :alt="compact ? name : ''" />
    <span v-if="!compact" class="speaker-name">{{ name }}<small v-if="thought">{{ t('speakers.thought') }}</small></span>
  </span>
</template>
<style scoped>
.speaker-identity{display:inline-flex;align-items:center;gap:8px;flex:none;color:var(--speaker-color,#dbc38d);vertical-align:middle}.speaker-identity img{display:block;width:38px;height:38px;object-fit:cover;object-position:center 25%;border:1px solid #aa925d;border-radius:50%;background:#344437;box-shadow:0 1px 3px #13201799;flex:none}.speaker-name{font-size:11px;font-weight:700;letter-spacing:.3px}.speaker-name small{display:block;font-size:9px;font-style:italic;font-weight:400;color:var(--speaker-thought-color,#aebaa1);margin-top:2px}.speaker-identity--compact img{width:23px;height:23px}.speaker-identity--compact{margin-right:6px}
</style>
