<script setup>
import { useI18n } from 'vue-i18n'
import CircleIcon from './CircleIcon.vue'
const { t } = useI18n()
const skills = [{ id: 'vitality', icon: '♡' }, { id: 'endurance', icon: 'ϟ' }, { id: 'melee', icon: '⚔' }, { id: 'defense', icon: '⬡' }]
</script>
<template>
  <div class="skills-content">
    <h3>{{ t('sidebar.skillTree') }}</h3>
    <p>{{ t('interface.skillsPending') }}</p>
    <div class="skill-cards"><button v-for="skill in skills" :key="skill.id" disabled><CircleIcon as="span" :icon="skill.icon" size="main" /><strong>{{ t('sidebar.' + skill.id) }}</strong><small>{{ t('sidebar.locked') }}</small></button></div>
  </div>
</template>
<style scoped>
.skill-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.skill-cards button{display:flex;align-items:center;flex-direction:column;gap:12px;padding:20px 8px;border:1px solid #8a7852;border-radius:6px;background:#23352a;color:#dfc990}.skill-cards small{font-size:10px}.skill-cards .circle-icon{box-shadow:none}
</style>
