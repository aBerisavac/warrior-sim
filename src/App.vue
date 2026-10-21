<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { dayNumber, fatigueFactor, formatTime, initialState, injuryFactor, places, readSave, SAVE_KEY, staminaCap, travelMinutes } from './game'

const game = reactive(readSave())
const offerPercent = ref(115)
const selectedPlace = computed(() => places.find((place) => place.id === game.selected))
const currentPlace = computed(() => places.find((place) => place.id === game.location))
const tripMinutes = computed(() => selectedPlace.value?.available ? travelMinutes(game.location, game.selected) : 0)
const stamina = computed(() => staminaCap(game))
const fatigue = computed(() => Math.round(fatigueFactor(game) * 100))
const injury = computed(() => Math.round(injuryFactor(game) * 100))
const day = computed(() => dayNumber(game.minutes))
const clock = computed(() => formatTime(game.minutes))
const awakeHours = computed(() => Math.floor((game.minutes - game.awakeSince) / 60))
const askingPrice = computed(() => Math.round(10 * (1.5 + Math.max(0, -game.reputation) * 0.1 - Math.max(0, game.reputation) * 0.04)))
const offeredPrice = computed(() => Math.round(10 * offerPercent.value / 100))
const mood = computed(() => game.reputation <= -3 ? 'Refuses to trade' : game.reputation < 0 ? 'Irritated' : game.reputation > 1 ? 'Friendly' : 'Neutral')
const objective = computed(() => ({
  errand: 'Go to the market for iron stock.',
  robbed: 'Earn enough coin, then buy iron stock.',
  materials: 'Return to the smithy and forge your dagger.',
  sleep: 'Sleep at the smithy. Tomorrow is your birthday.',
  drafted: 'The draft has come to Briarwick.',
})[game.stage])

watch(game, () => localStorage.setItem(SAVE_KEY, JSON.stringify(game)), { deep: true })

function note(message) {
  game.event = message
  game.journal.unshift(message)
  game.journal = game.journal.slice(0, 5)
}

function select(id) { game.selected = id }

function travel() {
  if (!selectedPlace.value?.available || game.selected === game.location) return
  const destination = selectedPlace.value
  const duration = tripMinutes.value
  game.minutes += duration
  game.location = destination.id
  if (game.stage === 'errand' && destination.id === 'market') {
    game.health = 68
    game.coins = 0
    game.stage = 'robbed'
    note(`On the ${duration}-minute walk to the market, bandits stop you. You fight, lose your coin, and arrive wounded. Combat will be built in the next phase.`)
  } else {
    note(`You walk to the ${destination.name.toLowerCase()}. The journey takes ${duration} minutes.`)
  }
}

function work(kind) {
  if (kind === 'wood') {
    game.minutes += 90
    game.coins += 5
    note('You split firewood for 90 minutes and earn 5 coins. Precise cutting will become a playable mini game.')
  } else {
    game.minutes += 60
    game.coins += 3
    note('You wash dishes for an hour and earn 3 coins. The washing mini game is planned for a later pass.')
  }
}

function bargain() {
  if (game.stage !== 'robbed' || game.materials) return
  if (game.reputation <= -3) {
    note('The merchant has had enough of your offers and refuses to sell to you today.')
    return
  }
  const minimum = Math.max(75, 100 - game.reputation * 10)
  if (offerPercent.value < minimum) {
    game.reputation = Math.max(-3, game.reputation - 1)
    note('The merchant calls that offer insulting. His opinion of you worsens, and future asking prices rise.')
    return
  }
  if (game.coins < offeredPrice.value) {
    note(`You need ${offeredPrice.value} coins for that offer. Earn more before returning.`)
    return
  }
  game.coins -= offeredPrice.value
  game.materials = true
  game.stage = 'materials'
  if (offerPercent.value >= 130) game.reputation = Math.min(3, game.reputation + 1)
  note(`The merchant accepts ${offeredPrice.value} coins. You have the iron stock your father requested.`)
}

function tip() {
  if (game.coins < 1 || game.reputation <= -3) return
  game.coins -= 1
  game.reputation = Math.min(3, game.reputation + 1)
  note('You leave a coin for the merchant. He remembers the gesture.')
}

function forge() {
  if (!game.materials || game.dagger) return
  game.minutes += 120
  game.dagger = true
  game.stage = 'sleep'
  note('Under your father’s guidance, you forge your first dagger. The deeper forging game will come later. He sends you to bed.')
}

function sleep() {
  const nextMorning = Math.floor(game.minutes / 1440 + 1) * 1440 + 7 * 60
  game.minutes = nextMorning
  game.awakeSince = nextMorning
  game.health = Math.min(100, game.health + 12)
  if (game.reputation <= -3) game.reputation = -2
  if (game.stage === 'sleep') {
    game.stage = 'drafted'
    note('Your sixteenth birthday begins. Father says he has a surprise for you—but the town bell rings before he can explain. Every man aged sixteen or older has been called to the army.')
  } else {
    note('You sleep until morning. Fatigue clears; your wounds improve a little, but remain.')
  }
}

function reset() {
  Object.assign(game, initialState())
  offerPercent.value = 115
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-seal">✣</span>
        <div><span class="eyebrow">A life before the legend</span><h1>How to Become a General</h1></div>
      </div>
      <div class="top-meta"><span class="chapter">CHAPTER I <i></i> THE SMITH’S SON</span><span class="save-indicator"><span></span> Saved locally</span></div>
    </header>

    <main class="layout">
      <aside class="left-panel">
        <section class="profile panel">
          <div class="panel-kicker">YOUR PAWN <span>AGE {{ game.stage === 'drafted' ? 16 : 15 }}</span></div>
          <div class="profile-main"><div class="portrait"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="44" fill="#b8aa83"/><path d="M15 84q6-29 30-29t30 29" fill="#4b5644"/><path d="M30 45q-2-26 15-28 19 0 16 27l-5 15H35z" fill="#3e3029"/><ellipse cx="45" cy="43" rx="18" ry="24" fill="#d9b88c"/><path d="M26 39q2-25 20-25 17 0 20 23-9-3-14-12-8 11-26 14" fill="#3c2d25"/><path d="M38 44h2m10 0h2" stroke="#332c25" stroke-width="3" stroke-linecap="round"/><path d="M42 55q4 3 8 0" fill="none" stroke="#865c49" stroke-width="2"/></svg></div><div><div class="profile-name">The smith’s son</div><div class="profile-role">Peasant · Briarwick</div><div class="profile-coins">◈ <strong>{{ game.coins }}</strong> coins</div></div></div>
          <div class="stat"><div class="stat-top"><span>Health <small>Wounds carry over</small></span><strong>{{ game.health }} / 100</strong></div><div class="meter"><div class="meter-fill health-fill" :style="{ width: game.health + '%' }"></div></div></div>
          <div class="stat"><div class="stat-top"><span>Stamina <small>Available at activity start</small></span><strong>{{ stamina }} / 100</strong></div><div class="meter"><div class="meter-fill stamina-fill" :style="{ width: stamina + '%' }"></div></div></div>
          <div class="modifier-row"><span>Fatigue cap <b>{{ fatigue }}%</b></span><span>Injury effect <b>{{ injury }}%</b></span></div>
        </section>

        <section class="clock-panel panel"><div class="panel-kicker">TOWN TIME</div><div class="clock-row"><div><strong>Day {{ day }}</strong><span>{{ clock }} · {{ awakeHours }}h awake</span></div><span class="sun-icon">☼</span></div><p>Walking and work move the clock forward. Sleep removes fatigue; wounds heal only a little.</p></section>

        <section class="objective-panel panel"><div class="panel-kicker">CURRENT OBJECTIVE</div><div class="objective-icon">✧</div><h2>{{ objective }}</h2><p>{{ game.stage === 'drafted' ? 'The opening chapter ends here. Briarwick remains open for exploring.' : 'Follow the marked locations on the town map.' }}</p></section>
        <section class="rules-panel panel"><div class="panel-kicker">SURVIVAL RULES</div><p><b>Stay awake:</b> after 16 hours, your stamina cap begins to fall. At 48 hours awake it reaches half.</p><p><b>Get hurt:</b> wounds lower available stamina further. Sleep clears fatigue and heals 12 health; injuries still carry over.</p></section>
        <section class="skills-panel panel"><div class="panel-kicker">SKILL TREE <span>COMING NEXT</span></div><div class="skill-node">♡ <span>Vitality</span><i>LOCKED</i></div><div class="skill-node">◈ <span>Endurance</span><i>LOCKED</i></div><div class="skill-node">⚔ <span>Melee proficiency</span><i>LOCKED</i></div><div class="skill-node">⬡ <span>Defense</span><i>LOCKED</i></div></section>
      </aside>

      <section class="map-column">
        <div class="map-heading"><div><span class="eyebrow">THE BEGINNING OF A KINGDOM</span><h2>Briarwick</h2><p>A small market town with room to become something greater.</p></div><div class="map-scale"><span class="dot green"></span> OPEN <span class="dot hollow"></span> FUTURE</div></div>
        <div class="map-frame">
          <div class="map-canvas">
            <svg class="town-art" viewBox="0 0 820 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Illustrated map of Briarwick, a small town with market, blacksmith, tavern, and town square">
              <defs>
                <pattern id="paper" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M8 27h22m64 54h11M54 111h16" stroke="#b7ae8c" stroke-width="1" opacity=".2"/><circle cx="84" cy="20" r="1.3" fill="#9e9b77" opacity=".2"/></pattern>
                <pattern id="field" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M2 13l3-8m5 8 3-8" stroke="#8b9a72" stroke-width="1" opacity=".5"/></pattern>
              </defs>
              <rect width="820" height="600" fill="#d9cfaa"/><rect width="820" height="600" fill="url(#paper)"/>
              <path d="M0 0h820v150q-74-27-157-9-83 18-128-14-61-42-139-6-98 45-179-9Q120 81 0 125z" fill="#c9c99f" opacity=".55"/>
              <path d="M0 482q112-73 200-39 63 24 135 16 108-11 188 32 97 51 297-18v127H0z" fill="#bbc59a" opacity=".5"/>
              <path d="M0 80q64 36 99 91 23 36 35 95 11 58-8 88-35 56-97 78L0 456" fill="none" stroke="#8da9a6" stroke-width="38" opacity=".75"/><path d="M0 80q64 36 99 91 23 36 35 95 11 58-8 88-35 56-97 78L0 456" fill="none" stroke="#bbd1c1" stroke-width="16" opacity=".7"/>
              <path d="M152 104q151-90 306-48 182-3 268 98 80 90 37 257-40 120-157 144-173 36-316-6-148-17-185-122-32-97 13-218" fill="none" stroke="#7c7d64" stroke-width="8" stroke-dasharray="14 8" opacity=".65"/>
              <path d="M147 109q150-88 311-50 182-1 266 97 80 92 38 254-40 120-157 143-173 36-315-6-150-17-185-123" fill="none" stroke="#eee5c8" stroke-width="18" opacity=".5"/>
              <g fill="url(#field)" stroke="#a7ad88" opacity=".7"><path d="M634 391l104 17-33 94-109-10z"/><path d="M170 466l100 10 6 78-111-5z"/></g>
              <g fill="none" stroke="#ad9d7c" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" opacity=".85">
                <path d="M136 360Q238 326 381 418Q421 365 428 306L552 328Q614 347 650 190"/>
                <path d="M382 418Q479 459 538 527"/><path d="M428 306Q334 250 184 207"/><path d="M261 352q-20 48-73 68"/>
              </g>
              <g fill="none" stroke="#e9d8b2" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".9"><path d="M136 360Q238 326 381 418Q421 365 428 306L552 328Q614 347 650 190"/><path d="M382 418Q479 459 538 527"/><path d="M428 306Q334 250 184 207"/><path d="M261 352q-20 48-73 68"/></g>
              <g class="map-building" fill="#a69b75" stroke="#746e59" stroke-width="2"><path d="M309 266l21-15 31 16-19 16z"/><path d="M314 277l28 7v17l-28-6z"/><path d="M458 261l24-18 32 11-22 21z"/><path d="M475 274l35-17v25l-34 18z"/><path d="M495 373l25-10 28 20-26 11z"/><path d="M500 384l25 12v20l-25-11z"/><path d="M316 487l25-12 26 16-20 14z"/><path d="M316 487l31 19v15l-31-16z"/><path d="M235 258l19-13 28 13-22 16z"/><path d="M585 453l21-15 29 16-21 14z"/></g>
              <g fill="#7d9475" opacity=".9"><circle cx="210" cy="490" r="19"/><circle cx="225" cy="505" r="13"/><circle cx="577" cy="469" r="16"/><circle cx="610" cy="497" r="20"/><circle cx="695" cy="296" r="15"/><circle cx="699" cy="320" r="11"/><circle cx="287" cy="169" r="16"/><circle cx="304" cy="177" r="12"/><circle cx="144" cy="269" r="15"/><circle cx="162" cy="278" r="10"/><circle cx="742" cy="230" r="17"/></g>
              <g fill="#d9c891" stroke="#8f805e" stroke-width="2"><circle cx="381" cy="417" r="20"/><circle cx="381" cy="417" r="12"/><path d="M376 409h10v17h-10z" fill="#97a9a0"/></g>
              <g fill="#7e8768" font-family="Georgia,serif" font-size="14" font-style="italic" opacity=".85"><text x="34" y="532" transform="rotate(-76 34 532)">THE BRACKEN RUN</text><text x="638" y="566">SOUTH ROAD  →</text><text x="47" y="53">N</text></g><path d="M54 63v35m-8-27 8-12 8 12" stroke="#79765f" stroke-width="2" fill="none"/>
            </svg>
            <button v-for="place in places" :key="place.id" class="map-pin" :class="{ active: game.selected === place.id, locked: !place.available, current: game.location === place.id }" :style="{ left: (place.x / 820 * 100) + '%', top: (place.y / 600 * 100) + '%' }" @click="select(place.id)" :aria-label="place.name + (place.available ? '' : ', coming later')">
              <span class="pin-icon">{{ place.icon }}</span><span class="pin-label">{{ place.name }}</span>
            </button>
            <div class="map-stamp">BRIARWICK <span>EST. 1268</span></div>
          </div>
          <div class="map-footer"><span><i class="location-dot"></i> You are at the <strong>{{ currentPlace.name }}</strong></span><span>Distances determine walking time</span></div>
        </div>
        <div class="growth-banner"><div class="growth-icon">♜</div><div><strong>From a small town to a capital</strong><span>Future chapters can add districts, walls, civic projects, and your own seat of rule.</span></div><span class="growth-tag">LONG-TERM VISION</span></div>
      </section>

      <aside class="right-panel">
        <section class="place-panel panel"><div class="panel-kicker">SELECTED LOCATION <span>{{ selectedPlace.available ? 'OPEN' : 'FUTURE' }}</span></div><div class="place-art"><span>{{ selectedPlace.icon }}</span><div class="place-hill hill-one"></div><div class="place-hill hill-two"></div></div><h2>{{ selectedPlace.name }}</h2><div class="place-sub">{{ selectedPlace.sub }}</div><p>{{ selectedPlace.description }}</p>
          <button v-if="selectedPlace.available && game.location !== game.selected" class="primary-button" @click="travel">Walk here <span>{{ tripMinutes }} min →</span></button>
          <div v-else-if="!selectedPlace.available" class="closed-note">This location opens in a later chapter.</div>
          <div v-else class="here-note">✧ You are here</div>
        </section>

        <section v-if="game.location === 'market'" class="action-panel panel"><div class="panel-kicker">MARKET · IRON STOCK</div><template v-if="game.stage === 'robbed'"><div class="price-line"><span>Seller asks</span><strong>{{ askingPrice }} coins</strong></div><label class="offer-label" for="offer">Your offer <strong>{{ offeredPrice }} coins · {{ offerPercent }}%</strong></label><input id="offer" v-model.number="offerPercent" type="range" min="75" max="150" step="5" /><div class="range-ends"><span>75% market value</span><span>150%</span></div><div class="action-buttons"><button @click="bargain">Make offer</button><button class="quiet-button" @click="tip" :disabled="game.coins < 1 || game.reputation <= -3">Tip 1 coin</button></div><p>Merchant: <b>{{ mood }}</b>. Hard offers can sour the relationship.</p></template><p v-else-if="game.materials">Iron stock purchased. Bring it to your father.</p><p v-else>Father asked you to buy iron stock here.</p></section>
        <section v-if="game.location === 'tavern'" class="action-panel panel"><div class="panel-kicker">ODD JOB · TAVERN</div><h3>Wash dishes</h3><p>Reliable work, modest pay. The hands-on washing game is still to come.</p><button @click="work('dishes')">Work 1 hour <span>+3 coins</span></button></section>
        <section v-if="game.location === 'square'" class="action-panel panel"><div class="panel-kicker">ODD JOB · TOWN SQUARE</div><h3>Split firewood</h3><p>The cutting game will reward accurate splits and limited cuts.</p><button @click="work('wood')">Work 90 min <span>+5 coins</span></button></section>
        <section v-if="game.location === 'smithy'" class="action-panel panel"><div class="panel-kicker">AT YOUR FATHER’S FORGE</div><template v-if="game.stage === 'materials'"><h3>Make your first dagger</h3><p>Father will guide you through the forging process.</p><button @click="forge">Forge dagger <span>2 hours</span></button></template><template v-else><h3>{{ game.dagger ? 'Your dagger is ready' : 'Home and hearth' }}</h3><p>{{ game.dagger ? 'Father insists you rest. Tomorrow is your birthday.' : 'Return here with iron stock. You can also sleep to recover.' }}</p></template><button class="quiet-button sleep-button" @click="sleep">Sleep until morning <span>☾</span></button></section>
        <section class="journal-panel panel"><div class="panel-kicker">FIELD NOTES <button @click="reset" title="Restart the demo">↺ Restart</button></div><p class="latest-event">{{ game.event }}</p><details><summary>Recent events</summary><ul><li v-for="(entry, i) in game.journal" :key="i">{{ entry }}</li></ul></details></section>
      </aside>
    </main>
    <footer class="footer"><span>BRIARWICK · OPENING CHAPTER PROTOTYPE</span><span>Map, travel, and survival rules are playable. Combat and detailed mini games come next.</span></footer>
  </div>
</template>
