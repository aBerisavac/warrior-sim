import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createI18n } from 'vue-i18n'
import { readFileSync } from 'node:fs'
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
try {
  const { initialState } = await server.ssrLoadModule('/src/game.js')
  const merchants = await server.ssrLoadModule('/src/merchants.js')
  const { items } = await server.ssrLoadModule('/src/inventory.js')
  const { default: TradingPanel } = await server.ssrLoadModule('/src/components/TradingPanel.vue')
  const { default: TradeInventoryColumn } = await server.ssrLoadModule('/src/components/TradeInventoryColumn.vue')
  const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'))
  const render = (component, props) => renderToString(createSSRApp({ render: () => h(component, props) }).use(createI18n({ legacy: false, locale: 'en', messages: { en } })))
  const html = await render(TradingPanel, { game: initialState(), ready: true, agreement: null, feedback: null })
  for (const name of ['Copper ore', 'Copper ingot', 'Iron ore', 'Iron ingot', 'Coal', 'My belongings', 'Merchant’s goods', 'Incoming', 'Make exchange offer']) assert(html.includes(name), name)
  assert(/id="basket-offer"[^>]*value="100"/.test(html), 'Haggling starts at the asking price')
  assert(html.includes('Iron ore 0/4'))
  assert(html.includes('Coal 0/4')); assert(html.includes('Wooden pommel 0/1')); assert(html.includes('Wooden dagger pommel'))
  assert(html.includes('30 kg'))
  assert(html.indexOf('My belongings') < html.indexOf('Merchant’s goods'), 'Player is on the left, merchant on the right')
  const column = await render(TradeInventoryColumn, { title: 'My belongings', side: 'player', rows: [], pending: [{ key: 'iron_ore', itemId: 'iron_ore', quantity: 4, max: 12 }], disabled: false })
  assert(column.includes('value="4"'))
  assert(column.includes('Undo transfer of one Iron ore'))
  assert(column.indexOf('Iron ore') < column.indexOf('Current inventory'), 'Pending items are above current inventory')
  const inn = initialState(); inn.location = 'tavern'
  assert.equal(merchants.buyUnitPrice('bread', merchants.MARKET_MERCHANT), 6)
  assert.equal(merchants.buyUnitPrice('bread', merchants.INN_MERCHANT), 3)
  assert.equal(merchants.buyUnitPrice('iron_ore', merchants.MARKET_MERCHANT), 17)
  assert(merchants.saleUnitPrice('iron_ore', merchants.INN_MERCHANT) < merchants.saleUnitPrice('iron_ore', merchants.MARKET_MERCHANT))
  const foodDraft = { buy: [{ itemId: 'bread', quantity: 2 }, { itemId: 'ale', quantity: 1 }, { itemId: 'stew', quantity: 1 }], sell: [], percent: 100 }
  const foodQuote = merchants.quoteTrade(inn, merchants.INN_MERCHANT, foodDraft)
  assert.equal(foodQuote.buying, 18)
  const agreement = { merchantId: merchants.INN_MERCHANT, fingerprint: merchants.offerFingerprint(foodDraft), net: foodQuote.net }
  assert.equal(merchants.executeTrade(inn, merchants.INN_MERCHANT, foodDraft, agreement).error, null)
  assert.equal(inn.coins, 102); assert(inn.inventory.some(e => e.itemId === 'ale'))
  const replay = merchants.executeTrade(inn, merchants.INN_MERCHANT, foodDraft, agreement); assert.equal(replay.error, 'offerChanged')
  const marketAgreement = { fingerprint: merchants.offerFingerprint(foodDraft), net: foodQuote.net }
  assert.equal(merchants.executeTrade(inn, merchants.INN_MERCHANT, foodDraft, marketAgreement).error, 'offerChanged', 'An offer cannot move between sellers')
  const innHTML = await render(TradingPanel, { game: inn, merchantId: merchants.INN_MERCHANT, ready: true })
  for (const value of ['Oswin’s food and drink', 'Vegetable stew', 'Small ale']) assert(innHTML.includes(value), value)
  assert(!innHTML.includes('Father’s supplies'))
  const { default: GameModal } = await server.ssrLoadModule('/src/components/GameModal.vue')
  const props = { game: inn, selectedPlace: { id: 'tavern', available: true }, tripMinutes: 0, stamina: 100, sleepNeed: 70, moodKey: 'neutral' }
  const tradeHTML = await render(GameModal, { ...props, modal: 'trade', merchantId: merchants.INN_MERCHANT })
  const closeButton = tradeHTML.match(/<button[^>]*aria-label="Close dialog"[^>]*>/)?.[0] || tradeHTML.split('class="modal-top"')[1].split('</button>')[0]
  assert(tradeHTML.includes('merchant-modal-art')); assert(tradeHTML.includes('merchant-portrait-toggle')); assert(tradeHTML.includes('aria-pressed="false"'))
  assert(!closeButton.includes('disabled'), 'Trade can close while the greeting is still typing')
  const awaySleep = await render(GameModal, { ...props, modal: 'sleep' })
  assert(!awaySleep.includes('class="rest-actions"'))
  inn.location = 'smithy'
  const homeSleep = await render(GameModal, { ...props, modal: 'sleep' }); assert(homeSleep.includes('class="rest-actions"'))
  const { default: CircleIcon } = await server.ssrLoadModule('/src/components/CircleIcon.vue')
  for (const icon of ['beer', 'scales', 'chat', 'woodcutting']) assert((await render(CircleIcon, { icon })).includes('<svg'))
  for (const itemId of ['ale', 'stew']) assert(items[itemId].category === 'food')
  console.log('Trading components render with localized stock, pending transfers, quest counts, and quantity controls')
} finally { await server.close() }
