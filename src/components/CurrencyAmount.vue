<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { currencyParts, formatCurrency } from '../currency'
const props = defineProps({ amount: { type: Number, default: 0 } })
const { t } = useI18n()
const parts = computed(() => currencyParts(props.amount))
</script>
<template><span class="currency-amount" :aria-label="formatCurrency(amount, t)" :title="formatCurrency(amount, t)"><span v-if="amount < 0" aria-hidden="true">−</span><span v-for="part in parts" :key="part.unit" class="currency-denomination" :class="'currency-denomination--' + part.unit" aria-hidden="true"><i></i>{{ part.count }}</span></span></template>
<style scoped>
.currency-amount{display:inline-flex;flex-wrap:wrap;align-items:center;gap:.4em;vertical-align:middle;font-variant-numeric:tabular-nums}.currency-denomination{display:inline-flex;align-items:center;gap:.2em;white-space:nowrap;color:var(--metal)}.currency-denomination i{display:inline-block;width:.65em;height:.65em;border-radius:50%;border:1px solid var(--metal);background:var(--metal);box-shadow:inset 0 0 0 1px #302b2355,0 1px 1px #10170e88}.currency-denomination--copper{--metal:#cf986c}.currency-denomination--silver{--metal:#c2ced0}.currency-denomination--gold{--metal:#e1bf70}
</style>
