<script setup>
import { useI18n } from 'vue-i18n'
import { isUnlocked } from '../progression'
import CircleIcon from './CircleIcon.vue'
defineProps({ mapName: String, town: Boolean, day: Number, clock: String, fullscreen: Boolean, mobile: Boolean, muted: Boolean, busy: Boolean, canEdit: Boolean, editing: Boolean, completedQuests: { type: Array, required: true } })
const emit = defineEmits(['modal', 'fullscreen', 'mute', 'settings', 'editor', 'export', 'import'])
const { t } = useI18n()
</script>
<template>
  <header class="game-toolbar">
    <div class="game-toolbar-place"><div class="game-toolbar-title"><strong>{{ mapName }}</strong><span v-if="town" class="game-toolbar-chapter">{{ t('app.chapter') }}</span></div><small>{{ t('sidebar.day', { day }) }} · {{ clock }}</small></div>
    <nav :aria-label="t('interface.toolbar')">
      <CircleIcon icon="☷" size="job" :disabled="busy || !isUnlocked(completedQuests, 'hud', 'journal')" :aria-label="t('interface.journal')" :title="t('interface.journal')" @click="emit('modal', 'journal')" />
      <CircleIcon icon="skills" size="job" :disabled="busy || !isUnlocked(completedQuests, 'hud', 'pawn')" :aria-label="t('sidebar.skillTree')" :title="t('sidebar.skillTree')" @click="emit('modal', 'skills')" />
      <CircleIcon icon="?" size="job" :disabled="busy" :aria-label="t('sidebar.howToPlay')" :title="t('sidebar.howToPlay')" @click="emit('modal', 'help')" />
      <CircleIcon icon="↺" size="job" :disabled="busy" :aria-label="t('modal.restartAction')" :title="t('modal.restartAction')" @click="emit('modal', 'restart')" />
      <CircleIcon icon="download" size="job" :aria-label="t('interface.exportSave')" :title="t('interface.exportSave')" @click="emit('export')" />
      <CircleIcon icon="upload" size="job" :aria-label="t('interface.importSave')" :title="t('interface.importSave')" @click="emit('import')" />
      <CircleIcon v-if="canEdit" icon="✎" size="job" :disabled="busy && !editing" :aria-label="t(editing ? 'mapEditor.close' : 'mapEditor.open')" :title="t(editing ? 'mapEditor.close' : 'mapEditor.open')" @click="emit('editor')" />
      <CircleIcon size="job" :icon="muted ? 'muted' : 'sound'" :aria-pressed="muted" :aria-label="t(muted ? 'audio.unmute' : 'audio.mute')" :title="t(muted ? 'audio.unmute' : 'audio.mute')" data-audio-ui="off" @click="emit('mute')" />
      <CircleIcon icon="⚙" size="job" :aria-label="t('audio.settings')" :title="t('audio.settings')" @click="emit('settings')" />
      <CircleIcon v-if="!mobile" :icon="fullscreen ? '⊡' : '⛶'" size="job" :aria-pressed="fullscreen" :aria-label="t(fullscreen ? 'map.exitFullscreen' : 'map.enterFullscreen')" :title="t(fullscreen ? 'map.exitFullscreen' : 'map.enterFullscreen')" @click="emit('fullscreen')" />
    </nav>
  </header>
</template>
<style scoped>
.game-toolbar{position:relative;z-index:19;display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:7px 10px;background:#203126ed;border-bottom:1px solid #9e885b99;color:#edddba}
.game-toolbar-place{min-width:0}.game-toolbar-title{display:flex;align-items:baseline;gap:9px;min-width:0}.game-toolbar-place strong{display:block;font:18px Georgia,serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.game-toolbar-chapter{font-size:9px;letter-spacing:.08em;color:#cdb77e;white-space:nowrap}.game-toolbar-place small{display:block;margin-top:3px;font-size:10px;color:#cfbd92;font-variant-numeric:tabular-nums}
nav{display:flex;gap:7px;align-items:center;flex-shrink:0}nav .circle-icon{box-shadow:none;border-width:1px}nav .circle-icon:hover:not(:disabled){background:#8d2630}nav .circle-icon:focus-visible{outline:2px solid #efd39a;outline-offset:2px}
@media(max-width:570px){.game-toolbar{padding:5px;gap:5px;flex-wrap:wrap}.game-toolbar-place{display:flex;align-items:baseline;justify-content:space-between;gap:8px;width:100%}.game-toolbar-place strong{font-size:14px}.game-toolbar-place small{margin:0;font-size:9px}nav{width:100%;justify-content:space-between;gap:4px}}
</style>
