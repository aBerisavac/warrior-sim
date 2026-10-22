<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAP_LOADING } from '../map-loading'

const props = defineProps({ mapId: String, returning: Boolean, firstVisit: Boolean, completed: Number, total: Number })
const { t } = useI18n()
const title = computed(() => {
  const config = MAP_LOADING[props.mapId]
  return t(props.firstVisit ? props.returning && config?.returnKey ? config.returnKey : config?.titleKey || 'loading.preparing' : config?.arrivalKey || config?.titleKey || 'loading.preparing')
})
</script>

<template>
  <div class="map-loading-screen" role="status" aria-live="polite" :aria-label="title">
    <div class="map-loading-emblem" aria-hidden="true">✦</div>
    <h1>{{ title }}</h1>
    <p>{{ t('loading.preparing') }}</p>
    <div class="map-loading-track" role="progressbar" :aria-valuenow="completed" :aria-valuemax="total || 1" aria-valuemin="0"><span :style="{ width: (total ? completed / total * 100 : 0) + '%' }"></span></div>
    <small>{{ t('loading.progress', { completed, total }) }}</small>
  </div>
</template>

<style scoped>
.map-loading-screen{position:fixed;inset:0;z-index:3000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;padding:24px;text-align:center;color:#ead9b1;background:radial-gradient(circle at 50% 42%,#394b37,#18271e 64%,#101b16);box-sizing:border-box}
.map-loading-emblem{display:grid;place-items:center;width:74px;height:74px;border:2px solid #bca374;border-radius:50%;font-size:35px;color:#e5cc91;box-shadow:0 0 0 8px #ad91541a,0 0 35px #bca37433}
h1{margin:10px 0 0;font:clamp(28px,6vw,48px)/1.1 'IM Fell English',Georgia,serif}
p{margin:0;color:#c1c9b2;font-size:13px}
.map-loading-track{width:min(320px,80vw);height:6px;margin-top:12px;border-radius:5px;background:#0d1d14;border:1px solid #8d7950;overflow:hidden}
.map-loading-track span{display:block;height:100%;background:#bc9b62;transition:width .15s ease}
small{color:#c8b88f;font-size:11px;font-variant-numeric:tabular-nums}
</style>
