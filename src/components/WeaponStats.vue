<script setup>
import { useI18n } from 'vue-i18n'
defineProps({ stats: Object })
const { t } = useI18n()
</script>
<template><dl v-if="stats" class="weapon-stats"><div><dt>{{ t('design.damage') }}</dt><dd>{{ stats.damage }}</dd></div><div v-for="kind in ['cut', 'pierce', 'blunt']" :key="kind"><dt>{{ t('design.' + kind) }}</dt><dd>{{ stats.ratios[kind] }}%</dd></div><div><dt>{{ t('design.weight') }}</dt><dd>{{ stats.weight.toFixed(3) }} kg</dd></div><div><dt>{{ t('design.speed') }}</dt><dd>{{ stats.speed }}</dd></div><div><dt>{{ t('design.durability') }}</dt><dd>{{ stats.durability }}</dd></div><div><dt>{{ t('design.reach') }}</dt><dd>{{ stats.reach }} cm</dd></div><div><dt>{{ t('design.balance') }}</dt><dd>{{ stats.centre.x.toFixed(1) }}, {{ stats.centre.y.toFixed(1) }} cm</dd></div><div><dt>{{ t('design.hands') }}</dt><dd>{{ stats.hands }}</dd></div></dl></template>
<style scoped>.weapon-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:5px;font-size:11px;margin:6px 0}.weapon-stats div{background:#17251d66;padding:5px;border:1px solid #ad956733;border-radius:3px}.weapon-stats dt{color:#baa77e}.weapon-stats dd{color:#eed7a4;margin:3px 0 0;font-weight:bold}</style>
