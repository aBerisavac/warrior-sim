<script setup>
import { computed } from 'vue'
import { bladeGeometry, designPaths, METALS, componentItems } from '../weapon-design'
const props = defineProps({ design: Object, highlight: Number, bladeOnly: Boolean })
const geometry = computed(() => bladeGeometry(props.design))
const paths = computed(() => designPaths(props.design))
const handle = computed(() => componentItems('handle').find(i => i.id === props.design.handle)?.component.length || 12)
const bounds = computed(() => { const g = geometry.value; const xs = g.samples.map(s => s.x + s.width), ys = g.samples.map(s => Math.abs(s.y) + s.width); return `${-handle.value - 8} ${-Math.max(12, ...ys)} ${handle.value + Math.max(...xs) + 16} ${Math.max(12, ...ys) * 2}` })
</script>
<template><svg v-if="geometry" class="weapon-preview" :viewBox="bounds" aria-hidden="true"><path v-for="(path, i) in paths" :key="i" :d="path" :fill="i === highlight ? '#e4bd69' : METALS[design.material].color" stroke="#45514a" stroke-width=".18"/><g v-if="!bladeOnly"><rect :x="-handle" y="-1.7" :width="handle" height="3.4" rx="1" fill="#795135"/><rect x="-1" y="-5" width="2" height="10" rx="1" :fill="design.guard.includes('copper') ? '#bd855b' : design.guard.includes('iron') ? '#a3aaa1' : '#a87c47'"/><circle :cx="-handle" cy="0" r="2.3" :fill="design.pommel.includes('iron') ? '#a3aaa1' : '#aa7950'"/></g><circle :cx="0" cy="0" r=".65" fill="#f0d79d"/></svg></template>
<style scoped>.weapon-preview{display:block;width:100%;height:130px;overflow:visible;filter:drop-shadow(0 5px 3px #0006)}</style>
