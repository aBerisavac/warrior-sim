<script setup>
import { formatCurrency, MERCHANT_TIP } from '../currency'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { items, carriedWeight, itemQuantity } from '../inventory'
import { MARKET_MERCHANT, nextRestockDay, quoteTrade, offerFingerprint, buyUnitPrice, saleUnitPrice } from '../merchants'
import TradeInventoryColumn from './TradeInventoryColumn.vue'
const props = defineProps({ game: Object, agreement: Object, feedback: Object, ready: Boolean, merchantId: { type: String, default: MARKET_MERCHANT } })
const emit = defineEmits(['offer', 'confirm', 'tip'])
const { t } = useI18n()
const buy = ref({})
const sell = ref({})
const percent = ref(100)
const stock = computed(() => props.game.merchantInventories[props.merchantId])
const equipped = id => Object.values(props.game.equipment).includes(id)
const sellingType = itemId => props.game.inventory.some(entry => entry.itemId === itemId && sell.value[entry.id])
function changeBuy(itemId, quantity) {
  const max = stock.value.find(entry => entry.itemId === itemId)?.quantity || 0
  if (sellingType(itemId)) return
  buy.value = { ...buy.value, [itemId]: Math.max(0, Math.min(max, Math.floor(quantity) || 0)) }
}
function changeSell(instanceId, quantity) {
  const entry = props.game.inventory.find(item => item.id === instanceId)
  if (!entry || equipped(instanceId) || buy.value[entry.itemId]) return
  sell.value = { ...sell.value, [instanceId]: Math.max(0, Math.min(entry.quantity, Math.floor(quantity) || 0)) }
}
const draft = computed(() => ({ buy: Object.entries(buy.value).filter(([,quantity]) => quantity > 0).map(([itemId,quantity]) => ({ itemId, quantity })), sell: Object.entries(sell.value).filter(([,quantity]) => quantity > 0).map(([instanceId,quantity]) => ({ instanceId, quantity })), percent: percent.value }))
const quote = computed(() => quoteTrade(props.game, props.merchantId, draft.value))
const agreed = computed(() => (props.agreement?.merchantId || MARKET_MERCHANT) === props.merchantId && props.agreement?.fingerprint === offerFingerprint(draft.value))
const buyRows = computed(() => draft.value.buy.map(entry => ({ ...entry, key: entry.itemId, max: stock.value.find(item => item.itemId === entry.itemId)?.quantity || 0 })))
const sellRows = computed(() => draft.value.sell.map(entry => ({ ...entry, key: entry.instanceId, itemId: props.game.inventory.find(item => item.id === entry.instanceId)?.itemId, max: props.game.inventory.find(item => item.id === entry.instanceId)?.quantity || 0 })))
const playerRows = computed(() => props.game.inventory.map(entry => ({ key: entry.id, itemId: entry.itemId, quantity: entry.quantity - (sell.value[entry.id] || 0), price: saleUnitPrice(entry, props.merchantId), equipped: equipped(entry.id), blocked: equipped(entry.id) || !!buy.value[entry.itemId] })))
const merchantRows = computed(() => stock.value.map(entry => ({ key: entry.itemId, itemId: entry.itemId, quantity: entry.quantity - (buy.value[entry.itemId] || 0), price: buyUnitPrice(entry.itemId, props.merchantId), blocked: sellingType(entry.itemId) })))
function clear() { buy.value = {}; sell.value = {}; percent.value = 100 }
watch(() => props.feedback, value => { if (value?.key === 'events.tradeCompleted') clear() })
</script>
<template>
  <div class="trading-panel">
    <div class="trade-status-strip" :title="t('currency.conversion')"><span>{{ t('trade.wallet', { coins: formatCurrency(game.coins, t) }) }}</span><span>{{ t('trade.restock', { day: nextRestockDay(merchantId, game.minutes) }) }}</span></div>
    <div v-if="!game.dagger && merchantId === MARKET_MERCHANT" class="trade-errand">{{ t('trade.errand', { iron: itemQuantity(game.inventory, 'iron_ore'), coal: itemQuantity(game.inventory, 'coal'), guard: itemQuantity(game.inventory, 'dagger_guard'), handle: itemQuantity(game.inventory, 'dagger_handle'), pommel: itemQuantity(game.inventory, 'dagger_pommel') }) }}</div>
    <div class="trade-columns">
      <TradeInventoryColumn side="player" :title="t('trade.yourGoods')" :rows="playerRows" :pending="buyRows" :disabled="!ready" @transfer="id => changeSell(id, (sell[id] || 0) + 1)" @pending="changeBuy" />
      <TradeInventoryColumn side="merchant" :title="t(merchantId === MARKET_MERCHANT ? 'trade.merchantGoods' : 'trade.innGoods')" :rows="merchantRows" :pending="sellRows" :disabled="!ready" @transfer="id => changeBuy(id, (buy[id] || 0) + 1)" @pending="changeSell" />
    </div>
    <section class="trade-checkout">
      <div class="trade-totals"><span>{{ t('trade.buyValue', { coins: formatCurrency(quote.buying ?? 0, t) }) }}</span><span>{{ t('trade.sellValue', { coins: formatCurrency(quote.selling ?? 0, t) }) }}</span></div>
      <label class="trade-offer-label" for="basket-offer" :title="t('trade.haggleHint')">{{ t('trade.wholeOffer', { percent }) }}<input id="basket-offer" type="range" min="75" max="150" step="5" v-model.number="percent" :disabled="!ready || (!buyRows.length && !sellRows.length)" /></label>
      <p class="trade-muted">{{ t('trade.haggleHint') }}</p>
      <div class="trade-settlement"><strong>{{ t((quote.net ?? 0) > 0 ? 'trade.youPay' : (quote.net ?? 0) < 0 ? 'trade.youReceive' : 'trade.evenExchange', { coins: formatCurrency(Math.abs(quote.net ?? 0), t) }) }}</strong><span>{{ t('trade.afterWeight', { weight: (quote.weight ?? carriedWeight(game.inventory)).toFixed(2) }) }}</span><span>{{ t('trade.afterWallet', { coins: formatCurrency(game.coins - (quote.net ?? 0), t) }) }}</span></div>
      <p v-if="quote.error && quote.error !== 'emptyBasket'" class="trade-error" role="status">{{ t('trade.errors.' + quote.error) }}</p>
      <div class="trade-checkout-actions"><button v-if="!agreed" class="modal-primary" type="button" :disabled="!ready || !!quote.error" @click="emit('offer', draft)">{{ t('trade.makeOffer') }}</button><button v-else class="modal-primary" type="button" :disabled="!ready || !!quote.error" @click="emit('confirm', draft)">{{ t('trade.confirm') }}</button><button class="modal-secondary" type="button" :disabled="!ready || game.coins < MERCHANT_TIP" @click="emit('tip')">{{ t('modal.tip') }}</button><button class="trade-clear" type="button" @click="clear">{{ t('trade.clear') }}</button></div>
      <p class="trade-muted">{{ t(agreed ? 'trade.agreed' : 'trade.noTransfer') }}</p>
    </section>
  </div>
</template>


