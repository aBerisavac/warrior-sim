# How to Become a General — Briarwick prototype

A local Vue/Vite prototype of the opening town. The map is the main interface.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Playable now

- Select a town location, then walk there. Travel follows connected road, bridge, and gate cells. Crossing one cell costs one game minute; the pawn advances up to three cells per real second, so travel time updates when the map changes. Choose Walk at another unlocked location to reroute from the pawn’s current position.

- The first market trip triggers the planned bandit defeat on the second travel tick. Each travel tick also rolls for a small ambient road event. Health and money change, and injury lowers available stamina.

- Work placeholder shifts at the tavern or town square to earn money and advance time.

- Make an offer for iron stock. Seller opinion affects the lowest accepted offer and future asking price; bad offers can cause a temporary refusal.

- Return to the forge, make a dagger, sleep, and reach the birthday draft scene.

- Save data stays in browser local storage. Use **Restart** in Field Notes to start over.

## Rules and scope

Fatigue begins after 16 hours awake and reduces the stamina cap linearly to 50% at 48 hours. Injury multiplies the available stamina within that fatigue cap. Activities will begin at the resulting available stamina once their mini games are built. Sleep resets fatigue and restores 12 health; health otherwise carries over.

Combat, detailed woodcutting, dishwashing, blacksmithing, and skill purchases are intentionally represented as placeholders for the next design passes. The map has four playable locations and additional visible future locations. Firewood and dishes are both tavern jobs. Its road layout leaves space for Briarwick to grow toward a capital.

## Map interface

The town map is the game window. Its header holds the pawn and coin display, counterclockwise health/stamina/sleep-need rings, and objective and journal controls. Hover or click a town marker to open its radial actions. Enter the blacksmith from its marker to use the separate forge interior; the door returns to the town map. Side cards provide detail without being required for gameplay.

Radial action circles unfold quickly from each location marker. They are icon-only and slightly smaller than the marker. Hover or focus on Walk to see the travel time; Hover or click Work to open a second circle layer for jobs. Unlocked actions remain clickable from anywhere, with travel performed when needed.

## Project structure

- src/data/places.json defines the town locations, availability, and action/job IDs. Map positions come from the town grid.

- src/data/actions.json defines shared action and job icons and translation keys.

- src/data/quests.json defines quest IDs, prerequisites, priorities, display keys, objectives, and tutorial clouds. src/data/unlocks.json maps each playable place, action, job, forge station, and HUD control to required completed quests.

- src/data/town-map.json holds the 30x30 cell grid and road network, road tiles and optional image paths, 2x2 to 4x4 building footprints (including optional L-shaped `shape` rows), door coordinates, one-cell or rectangular multi-cell gates, and decoration. Drag the gate tool across cells to size a gate; older gate entries without dimensions remain one cell. src/routes.js calculates paths and reroutes. src/data/travel-events.json defines travel event chances and the scripted bandit tick.

- src/progression.js evaluates those requirements and derives the current story stage from quest progress.

- src/i18n/en.json holds the current English copy. Vue I18n is installed in src/main.js; add another locale file and register it in src/i18n/index.js to translate the game.

- src/game.js contains the save model and numerical game rules. Journal entries store translation keys and parameters instead of finished English sentences.

- src/components/ separates the town map, forge map, HUD, side panels, and game dialogs. src/App.vue coordinates game state and events.

## Quest progress and saves

The local save key is `briarwick-demo-v1`. Version 7 saves contain `completedQuests`, an array of quest IDs, plus the pawn’s in-progress `travel` state when walking. Completing a quest records its ID; active quest cards, the story stage, and unlocks are then derived from that array. Quests can have independent prerequisites, so parallel objectives can be added later. Older saves migrate their stage to the equivalent completed quests on load.

For example, adding `"iron_errand_accepted"` to `completedQuests` and reloading unlocks the market. Adding `"bandit_ambush_survived"` unlocks the town square, tavern, basic forge stations, and sleep. Current quest IDs and required unlocks are listed in the two JSON files above. Places marked `available: false` are still future content and stay closed until implemented.

## Editing the town map

Use **Edit town map** above the game window to paint cells or drag a 2x2 to 4x4 building footprint. The footprint selector supports rectangles and L shapes. Place an entrance by selecting a neighboring road cell. The editor keeps a browser draft until you save or reset it, and it flags disconnected roads or missing entrances.

**Save to project** writes the 30x30 layout to `src/data/town-map.json` while the local Vite dev server is running. **Download JSON** exports a copy. Put image files in `public/images/` and enter paths such as `/images/town/roof.png` in the editor. `tileImages` applies an image to every cell of a terrain type, `cellImages` overrides individual cells, and each building has its own `imageSrc`. Saving a revised layout clears travel routes that were recorded on an older map.

## Map art and upgrades

The town editor can paint bushes, trees, rocks, barrels, and carts. Select a gate and enter an image path to override its default art. Saved structure tiers live in the game save as `buildingTiers` keyed by building or gate ID. Tiers progress from straw to mud to wood to stone; `/images/straw/<name>.png` paths resolve to the matching tier folder. The upgrade action is displayed but disabled until its gameplay rules are designed. Map layout and art sources remain in `src/data/town-map.json`; route generation lives in reusable `src/map-routing.js` and can be used with another map object.

## Inventory and item art

The backpack diamond in the map's bottom-right corner opens equipment and carried items. New and migrated saves start with a leather apron, leather shoes, and a crude hammer equipped. Equipped and bag items both count toward the fixed 30 kg capacity. Select an equipment slot to inspect or unequip it; select a bag item to equip it. Two-handed weapons and bows reserve the right and left hands, returning shields to the bag. Waist quivers require a bow. Backpacks and javelin bundles share the back slot. Backpacks currently do not increase capacity.

`src/data/items.json` is the shared item catalog, and `src/data/merchants.json` defines initial merchant stock. Owned item stacks, equipment references, and merchant quantities are persisted as `inventory`, `equipment`, and `merchantInventories` in the game save. Father’s errand requires four iron ore, four coal, and one wooden guard, handle and pommel; all must be carried to complete the objective. The workshop uses these materials across smelting and forge fuel. Old iron-stock saves migrate to the new materials while preserving completed progression. Trading offers copper ore, copper ingots, iron ore, iron ingots, coal, bread, dagger guards, handles and pommels through two inventories with staged transfers. Merchant supplies refill to the configured quantities every three in-game days (days 4, 7, 10, and so on). Restock cycles and depleted stock persist in the save and catch up when time skips. Purchased coal is carried in inventory and can fuel the furnace. `src/inventory.js` owns equipment, weight, and save-validation rules.

Replace individual SVG files in `public/images/items/` to change equipment art, or update each item's `imageSrc`. The illustrations are ordinary editable SVGs. Item names and descriptions are in the i18n catalog.

## Dialogue portraits

`src/data/characters.json` maps speaker IDs to localized names, portrait images, and optional scene artwork. `SpeakerPortrait.vue` renders identities and `DialogueBubble.vue` pairs them with dialogue or inner thoughts. The merchant uses the illustration and profile from `public/images/briarwick-merchant/`. Father and the innkeeper use the supplied portraits in `public/images/briarwick-blacksmith/` and `public/images/briarwick-innkeeper/`. Their full character illustrations are also registered as `sceneSrc` for future scene layouts. Player replies use the same profile as the map pawn.

## Trading flow

Your inventory is on the left and the merchant’s is on the right. Use the inward-pointing arrows to stage transfers. Incoming items are highlighted at the top of the destination inventory; use their quantity fields or return arrows to change or undo them. Both columns reserve equal space for incoming and current items. Equipped items must first be put in the bag. Inventory, gold, and stock remain unchanged while staging transfers and negotiating. The exchange summary shows the net gold payment or receipt, resulting purse balance, and weight after both sides transfer. Close the dialog or clear the exchange to discard the draft.

Make an offer for the whole exchange, then confirm the accepted agreement. Any change to quantities or terms requires a new offer. The final exchange rechecks stock, owned items, equipment restrictions, gold, capacity, reputation, and the agreement; failures transfer nothing. An agreement can be used only once.

At neutral terms (100%), purchases use catalog market prices and sales use 50% of catalog value. The offer slider spans 75–150%: purchase prices use that factor, and selling credit uses its inverse (`2 - factor`). Lower terms favor the player on both sides. Net gold rounds once, at the whole-basket level. Seller reputation determines which terms are accepted, and overly aggressive offers worsen the relationship. Tips improve it. Three-day deliveries replenish the five supplies without removing surplus resold stock or other items the merchant bought.

Run `npm run check:trading` for component rendering checks; `check:progression` also covers atomic exchanges, weight, restocking, and legacy material migration.

## Daily work

Woodcutting and dishwashing each allow one attempt per in-game calendar day. `dailyJobs` records each job's starting day and status (`started`, `completed`, or `cancelled`) in the save. Woodcutting reserves its attempt when the job opens. Closing it asks for confirmation: leaving awards no gold and consumes that day's attempt. The confirmation pauses movement/charging; staying preserves the current job. Dishwashing consumes its attempt when its work action is confirmed. Reopening used jobs shows a first-person message; a new game day permits them again. An unpaid `started` attempt can be reopened after a reload; because the cutting scene is not saved, it restarts from its first log. This never restores a completed or explicitly cancelled attempt, and cannot award a second payment.

## Currency and current balance

Money is stored as integer copper in the existing `coins` field. `currencyVersion: 1` identifies the new unit: 1,000 copper = 1 silver and 1,000 silver = 1 gold. Purses display separate copper, silver, and gold coins; textual prices and journal entries use the same denomination formatter. Older balances and historical monetary event parameters are converted at 10 copper per old coin once on load, without resetting progression.

Market prices before haggling: copper ore 10 copper, copper ingot 40 copper, iron ore 17 copper, iron ingot 65 copper, coal 5 copper. Father's 4 ore + 4 coal order is 88 copper. Other equipment prices were scaled by ten. The starting purse is 120 copper, dishwashing pays 40 copper, and merchant tips cost 5 copper. Firewood below the quality thresholds remains worthless; acceptable pieces pay 5–8 copper each according to combined quality. Sales use half market value rounded down to whole copper; the net haggled exchange rounds once to whole copper.

## Hunger, food, and passing time

Hunger is saved on a 0–100 scale and rises by 4 points per in-game hour, including travel, jobs, rest, and sleep. It is a basic food need for now, without food-specific buffs or starvation damage. Each bread loaf reduces hunger by 35 points, weighs 0.35 kg, and costs 3 copper before haggling. New saves start with three loaves; pre-food saves receive them once on migration. Consumed food does not return on reload.

Click or right-click an inventory item to open its contextual actions: Eat for food, Equip/Put in bag for equipment, and Inspect for all items. Equipped items also have this menu. The hunger ring shows the current need and opens the inventory.

Sleep at home is disabled below 60% sleep need. At home, the same dialog offers 1, 2, 4, or 8 hours of rest; rest skips time without clearing fatigue or healing. The sleep ring is disabled away from the blacksmith, and the rest handler also rejects away-from-home actions. Hunger still rises. The existing 48-hour sleep-need scale is unchanged. Daily jobs and merchant deliveries follow the advanced game clock.

The merchant's bread provision is 576 loaves per three-day delivery: 16 houses × 4 people per house × 3 loaves per person per day × 3 days. Household assumptions live in `merchants.json`; no separate NPC food-consumption simulation is implemented yet.

## Blacksmith workshop

The supplied interior is contained at its original 3:2 aspect ratio inside the square map. Station coordinates are relative to the image, so fullscreen does not change their alignment. Both quench barrels are available with the other workshop utilities after the ambush. The anvil still follows the material quest unlock.

The instant dagger lesson is replaced by `src/workshop.js` and `WorkshopDialog.vue`. The route is crucible → furnace → mould → ingot rack → anvil → quench → workbench → grinder. Finishing at the grinder adds the actual crafted dagger and completes the quest. Buy a wooden guard and handle (5 copper each) and a wooden pommel (4 copper) for assembly. Purchased ingots can also be placed on the rack. Small action buttons sit directly over the interior for fueling, bellows, cooling, charging, pouring, blade heating, collecting castings, and holding either quench barrel. Material selection and detailed minigames use a small nonmodal work panel; the rest of the interior stays clickable. The workbench’s information button opens ore temperatures and process notes in that same panel.

The separate storehouse accepts only `materials`, has unlimited storage, and requires explicit one-item transfers. Withdrawal checks the bag’s 30 kg capacity. The crucible shows bag and storehouse separately and consumes only the source explicitly selected by the player. A charge is four matching ore plus one reducing coal; forge fuel is separate. Unheated charges can be returned to storage. Item `category` now uses broad groups; `equipSlot` independently controls equipment compatibility.

The normal interior shows storage, sleep, workshop notes, and the building exit. START BLACKSMITHING reveals the forging controls and hides storage, sleep, and exit; End blacksmithing restores them without clearing work. Starting requires a resumable workpiece, an iron ingot, or four matching ore plus reducing coal and fuel. Forge fuel must be in the bag. Available next actions pulse with a Byzantine-red background; unavailable actions are disabled.

Coal provides 480 seconds (eight minutes) of fuel per piece, up to six pieces. Fuel enables bellows combustion but never drives passive warming. Ambient temperature is 25°C. Each press queues a finite boost of `190 * exp(-(effectiveTemperature - 25) / 800)` degrees, released with a three-second exponential time constant. Effective temperature includes queued heat, so successive cold presses also diminish. Presses have a 0.3-second recovery; queued heat is capped at 500°C and forge temperature at 2,500°C. Cooling continuously follows `dT/dt = -0.0015 * (T - 25)`, slowing near ambient. Water removes 75% of queued combustion and briefly raises cooling to 0.0035. These are tuned gameplay values, not a calibrated combustion simulation. Crucibles and blades exchange heat more slowly. Ore reduction precedes melting (iron: reduction at 1,000°C, melting at 1,538°C; copper: 800°C and 1,085°C).

Press R or Lift and pour once reduction is complete, even if melting is unfinished. In the pouring modal, hold and lift the crucible; higher means faster flow. Height 65% empties a liquid charge in about 5.5 real seconds. Heights above 72% spill increasingly. Release lowers the crucible and pauses flow, without ending the casting. Keyboard users hold Space and adjust height with Up/Down. Closing, losing pointer capture, opening settings, or losing window focus also lowers it. The forge and mould continue their thermal simulation during play.

The off-forge crucible cools and can continue melting solids only with sufficient retained heat. The mould has its own temperature, mixes incoming liquid heat, and ruins the casting if it hardens during an unfinished pour. Finish pouring is explicit when leftovers remain; an empty crucible finishes automatically. Less than 95% in the mould is ruined and must be discarded there. A 95–98% fill is usable but severely penalized; 98–100% allows up to 2% incidental spill. Larger spills impose another strong penalty. Residue cannot make a second casting: reheat it to full liquidity and discard it before loading fresh ore. Valid castings cool for 15 seconds; multiple ingots accumulate beside the forge.

This is an accelerated gameplay model, not a complete historical metallurgy simulation: reduction, carbon uptake, slag removal, alloy composition, and tempering are abstracted. In particular the carbon-containing iron charge stands in for forgeable blade stock; the iron melting threshold is a reference value rather than a calculated alloy phase diagram. Background: [Cambridge steel heat-treatment practical](https://www.phase-trans.msm.cam.ac.uk/2000/practicals/AP3/AP3.html), [iron-oxide reduction study](https://arxiv.org/abs/2208.00661).

Hammering uses sixteen cells in two rows. Hold a cell for up to 1.2 seconds and release: a full blow adds 40 work. Score is `max(0, 100 - abs(100 - work))`, with accumulated work capped at 200 forever. Reheating never resets it. All cells must receive some work before shaping is finished. Hammering needs the equipped crude hammer and a blade at 750–1,150°C. Cooling and reheating continue between blows.

Quenching requires 750–900°C. Holding water reaches peak quality in 2.5 seconds, oil in about 4.17 seconds; continuing reaches zero permanently for that attempt. A new heat treatment can retry the quench. Assembly consumes the guard and then handle, scoring horizontal alignment on each falling fitting. Fittings can be removed and reused before finishing if bag capacity permits. Grinding splits sixteen cells across two sides; contact at 15° ±3° raises local sharpness and other angles lower it. Release to flip the blade or finish. Existing daggers can be sharpened again at the workbench without duplicating the item.

Quality weights are hammering 50%, quench 25%, assembly 20%, sharpness 5%. Casting quality multiplies this result, so later perfect work cannot erase poor casting. Fill and spill penalties, plus prolonged crucible overheating more than 180°C above melting, permanently lower casting quality; small overheating is tolerated. Blade temperatures above 1,250°C separately add a recoverable penalty of up to 20 points, with working heat gradually recovering it. Hammering overshoot remains permanent. Crafted instances preserve the per-cell work, sharpness, assembly, quench, casting quality, blade heat penalty, and final quality. Casting quality survives taking ingots into the bag, storage transfers, saves, and reheating.

Version 12 saves preserve all workshop progress, rack ingots, storage, temperatures, fuel and timers. Old warehouse coal and loaded furnace fuel migrate once. Thermal simulation ticks during play, including other dialogs; reload does not apply offline elapsed time. An interrupted quench saves its current result. An interrupted pour saves the liquid state and fill, resumes with the crucible lowered, and applies no offline cooling. Legacy bellows airflow is discarded when migrating to the finite-impulse heat model. Each five seconds spent working in the interior with a panel, fuel, or blade advances one game minute. Run `npm run check:workshop` for the complete recipe, boundary rules, component rendering, save round-trips, and migration checks.

The road robbery takes a random 40–50 copper, capped to leave at least one copper when possible. A fresh 120-copper purse therefore retains 70–80 copper; one 40-copper dishwashing shift covers the shortfall for the 98-copper ore/coal/fittings shopping list. `leftHomeForErrand` records leaving home after accepting Father’s errand. Until the player carries four iron ore and four coal, both the town marker and action handlers block returning to the blacksmith. Buying those supplies completes the existing quest; consuming them later never relocks home. Existing completed saves remain accessible. Father’s initial request now mentions the wooden guard and handle as well.

## Sound and music

The cog beside the map’s display controls opens Settings → Sound. A speaker button alongside it toggles master mute. Music, ambience, woodcutting, forge actions, dishwashing, footsteps/doors, and interface sounds each have a volume slider. Expand Individual sounds to adjust or mute any of the 24 cues, with two-second preview buttons. Master mute preserves all volume levels. Preferences save automatically in `briarwick-audio-v1`, independently of the adventure save, and survive restarting the demo.

`src/audio.js` owns the Web Audio mixer. The first real pointer or keyboard interaction unlocks audio; unsupported browsers and failed downloads do not block play. Only needed files load, decoded clips are cached, and location loops fade between scenes. Hidden tabs stop playback and held effects. Music and bird ambience play outdoors; the inn and workshop use medieval music, with crackling fire in the inn and at a fueled forge. Woodcutting uses outdoor birds. Axe impacts align with the existing hit animation, moving and stacked wood have separate effects, hammer strikes scale with charged strength, and grinding/steam play only while the corresponding action is held. Coins, doors, footsteps, pages, and inventory handling also have cues. Opening Sound settings preserves the currently open minigame and pauses its input controls; forge heat still follows its normal simulation.

`src/data/audio.json` maps cues to files, groups, and mixing trims. Replace a file in `public/audio/` or edit that catalog to change the sound. Twenty-four downloaded recordings are CC0 assets from Kenney, TinyWorlds, RandomMind, isaiah658, AntumDeluge, and rubberduck; some recordings are reused for related actions. Bellows, steam and grinding use original procedural noise textures. `public/audio/CREDITS.md` records original filenames, source pages, licence links, and adaptations; the settings menu links to it. Kenney’s original licence notices are retained beside the clips. Download archives and unused source clips remain outside the shipped audio folder in ignored `.tmp/audio-import/`.

Run `npm run check:audio` to check complete audio file containers, catalog/localization coverage, saved preference normalization, gain calculation, gesture gating, loop replacement, per-cue/master mute, held-effect cleanup, background visibility, preview limits, and settings rendering. Mixer tests use a fake audio device; final loudness and timbre should be checked by listening in the browser.

## Village dialogue, vendors, and travel

Father’s opening conversation is an ordered `cloud.conversation` in the quest data. The ore-and-coal errand comes first; his offer to let the son make his first real weapon follows as a separate exchange, with an eager spoken reply and an italic inner thought. The final fitting request mentions the wooden guard and handle. The errand is accepted after the conversation finishes. Robbery text sends the player on toward the market; only reading the posted notice introduces work at the inn. The market reflection refers to materials and a shortfall in coin, rather than only iron or an empty purse.

Oswin is the named innkeeper. His `oswin_inn` inventory holds bread, vegetable stew and small ale and restocks every three days. Its food prices use catalog bases; the market merchant applies a ×2 food markup. `items.json` remains the common item/base-price list. `merchants.json` supplies each seller’s `placeId`, `speaker`, stock, `buyModifiers` (what the player pays by category), and `sellModifiers` (the player’s selling credit by category). Missing category modifiers default to ×1. Unit purchase prices round the base × modifier; selling credit floors base × 0.5 × modifier, then basket haggling applies as before. Offers are bound to the seller that accepted them.

| Item | Catalog base | Oswin, before haggling | Market, before haggling |
| --- | ---: | ---: | ---: |
| Bread | 3 copper | 3 copper | 6 copper |
| Vegetable stew | 8 copper | 8 copper | Not normally stocked |
| Small ale | 4 copper | 4 copper | Not normally stocked |
| Iron ore | 17 copper | Not normally stocked | 17 copper |

Stew restores 55 hunger, small ale restores 5; drinks use the Drink context action and can be consumed even when not hungry. There is no separate thirst or alcohol simulation. Trading now keeps its close button, terms slider, totals and exchange buttons fixed inside the map, with independent scrolling for incoming goods and each current inventory. The general merchant’s illustration becomes compact on smaller displays.

Town icons use drawn beer-mug, scales, chat-bubble, and axe-in-stump SVGs. Smithy markers offer entry and travel, with no town-map forging job. Briarwick uses `minutesPerCell: 1` and `secondsPerCell: 1`: crossing one road tile advances one game minute over one real second, without changing route geometry. Saved journeys migrate elapsed and total time together, preserving their current position; other maps retain their own travel-cost setting.

Spoken typewriter lines play a quiet, non-vocal letter tone. Dialogue bubbles provide speech context; inner thoughts, narration, notices and mixed thought segments remain silent. The Sound menu has a separate Speaking text group and Dialogue letter tones control. Revealing a whole line immediately skips its remaining tones.


## Guided workshop and interior movement

The first dagger has a saved, state-based Father-and-son lesson in `src/workshop-lesson.js`. Each exchange appears when its instruction becomes relevant, with quoted speech, italic thoughts, portraits, and the existing speech typing cue. Workshop heat and the workshop clock pause while guidance is open; inputs are blocked until the exchange finishes. Pouring and active quenching are never interrupted. The closing exchange plays once after the first finished dagger; later daggers receive no guidance. Seen lessons and a pending conclusion survive saves.

`src/forge-navigation.js` defines a floor graph fitted to the interior illustration: the entrance hall reaches the workshop through the left doorway, rooms use their actual doors, and routes go around the anvil, barrels, work table, wheel, and hearth. Portrait pawns move along this graph in real time. A station panel or command waits for arrival; repeated requests at the same destination preserve command-then-panel ordering, while choosing a different destination replaces the pending action. Interior movement pauses in Settings. Father stands aside during dialogue and walks between work areas during idle time. His routes also use the floor graph. Pawn positions reset to the entrance on re-entry; workshop progress remains saved.

The tavern keeps separate work and trade positions in its radial menu; the blacksmith retains no town-map job shortcut. The work submenu still follows the innkeeper’s work-offer unlock.

Encounter sounds have an independent settings group with per-cue controls. `encounterCue('bad' | 'good' | 'neutral')` selects one of three original synthesized musical stings, with neutral as the fallback. Bandit theft plays the bad cue; the passing traveler plays neutral. The positive cue is ready for future good encounters and can be previewed in Sound settings. Existing saved audio settings acquire the new controls automatically.


Dagger assembly measures placement in CSS pixels. Each fitting appears at a random offset from −20 to +20 px relative to the dagger’s centre and can travel between −30 and +30 px. The offset does not reroll on re-entry. Entering the frame requests Pointer Lock immediately; once captured, moving the mouse changes the fitting position without holding a button, and a left or right click drops it. If the browser denies capture on hover, movement inside the frame still works and a click immediately drops the fitting; it is never consumed as a capture-only click. Unsupported browsers retain bounded movement and clicks inside the frame. Touch users drag then release inside; outside releases do nothing. Esc exits mouse capture. Placement quality is 100% at centre, 50% at 15 px error, and 0% at 30 px error, independent of display scaling. Legacy normalized-position commands and saved scores remain supported.

The centred assembly panel retains its 0.7-second fall, sound and model update at contact, both result percentages, and a one-second result interval before tutorial guidance. Closing, pausing, or losing focus cancels an unlanded fitting without consuming it and releases mouse capture.

The moving assembly fitting is an HTML sprite positioned directly in CSS pixels over the SVG blade. Aim is not disabled by missing inventory; a missing-part notice explains why a drop is unavailable. Cursor hiding applies only while aiming. Both locked pointer and mouse event streams are accepted, with matching companion events deduplicated. The workshop check compiles the actual client template, sends events through its rendered handlers, and verifies that the visible sprite’s `left` style changes, rather than testing setup state alone.


### Workshop and interface refinements

The grinder shows a horizontal complete dagger over an upright wheel. Geometric overlap applies work to all contacted cells on the selected face (eight per face, sixteen total). The exact angle band (15° ±0.25°) gains 22 points per second; the wider ±3° band gains only 3–7 points per second; incorrect angles lose 10 points per second. Depth changes the visible thickness; numeric angle/depth readouts are hidden. The shadow remains visible when lifting the weapon. Haggling opens at 100% of the asking price. Removing fitted parts lowers the assembly ceiling by ten percentage points each time, persists through saves and regrinding, and never resets on refitting.

The first shopping objective requires four iron ore, four coal, a wooden dagger guard, a wooden dagger handle, and a wooden dagger pommel. Home entry and first blacksmithing honor the complete list; completed errands and active workshop pieces remain resumable. Automatic exchanges between different speakers pause 1.5 seconds; clicking Continue, choosing an answer, or submitting a trade starts the response immediately. The opening automatic Father-to-son exchange retains its pause. Clicking cannot skip an automatic reply pause. Father’s first-dagger invitation now mentions the son’s chores and birthday tomorrow.

Modal close bars stay above scrolling content. Woodcutting, assembly, sharpening and pouring use flexible scenes inside expanded panels. Text selection is disabled globally. Merchant art fills the trade dialog background; clicking the header portrait toggles a clear full illustration while preserving the current trade selections.

At the market, quiet CC0 crowd audio plays under music, with occasional hoofbeats and procedural cart wheels every 30–65 seconds and brief callouts every 60–105 seconds (first call after 55–95 seconds). Callouts are locally synthesized speech, not recorded actors. All four market sound layers have individual ambience controls and obey mute, master volume and tab visibility. Sources are listed in `public/audio/CREDITS.md`.

Workshop loading uses a progress indicator: one real second per furnace fuel or crucible item from the bag, three seconds per crucible item from storage. The item is validated at start and consumed once on completion; further actions are blocked during loading. Pending loads save their remaining duration and resume without offline progress. Stopping cancels without consumption. Town markers and action buttons are green at rest; highlighted/hovered nodes use Byzantine red, with nested job hover/focus highlighting its work parent and location.


### Map ambience

`src/map-ambience.js` supplies reusable, map-independent placement and movement helpers; `MapAmbience.vue` renders decorative grass/flowers, road dust, and sparrows. Town-only configuration lives under `src/data/town-map.json` → `ambience`, explicitly bound to its `id` (`briarwick-town`). A map with no configuration or a different ID gets no inherited ambience. Coordinates are in grid cells, so animations scale with the map and fullscreen view.

Existing tree canopies, bushes and flower decorations sway independently using stable per-map/per-cell duration and phase variations. Tree trunks stay still. Individual decorations may set `animation: false`. Forest and crop tiles move gently and river ripples breathe. New grass/flower accents are restricted to explicitly listed clear ground cells, excluding buildings, gates, decorations and cell images. Dust is clipped to its listed road cells; edited non-road cells stop emitting it.

Each bird route contains arrival and departure curves, a cycle period/phase, a rest duration, and a named building perch: `buildingId`, local footprint `cell`, exposed `edge` and an offset along that edge. Interior roof positions are rejected. Perches follow building movements and disappear if their building or edge becomes invalid. Birds glide into a perch, fold their wings while resting, then take off; they can cross buildings in the air but only land on valid configured edges. The two current routes have different schedules and long quiet intervals.

Ambience is decorative, does not capture input, change time, block paths or enter the save file. Motion pauses in hidden tabs and sound settings, honors reduced-motion preferences, and is disabled in the map editor. Animation frames are limited to about 30 updates per second and cleaned up on leaving the map. Map validation checks road dust, ground accents and roof perches. Run `npm run check:ambience` for placement, flight, map isolation and component rendering checks.

The map editor retains ambience metadata in existing drafts and prunes invalid accent/dust/perch bindings when exporting or saving edited terrain, so map changes do not leave birds perched over deleted buildings. Editing ambience routes themselves is currently done in map JSON.

The forge walking graph includes the clear aisle above the barrels and the narrow floor to the left of the crucible bench. Crucible and dampening-water actions can reach their front work positions from the furnace without taking the long route around the western anvil; actions still wait for the pawn to arrive.

The earlier individual-step version used TinyWorlds’ recorded gravel and stone footsteps (CC0; see audio credits), at a quieter gain of 0.3. Consecutive steps avoid repeating the same sample and vary playback speed from 0.93–1.08 and volume from 75–100% of that gain. The existing Footsteps control still governs these sounds.

Road walking now uses a continuous outdoor-path recording from BigSoundBank (CC0; see credits), replacing individually triggered steps. It loops with a 180ms overlap seam, fades in over 250ms and out over 180ms, and smoothly ramps playback speed between 0.96–1.04 and relative volume between 82–100% over randomized 2–4-second intervals. It plays only while town travel is actively moving, stopping for dialogs, encounters, Sound settings, arrival and hidden tabs. It retains the saved travel/footstep volume controls, now labelled Road walking.


### Pommel and safer hot-work guidance

Dagger assembly now fits guard → handle → pommel, consuming each from the bag and recording three independent alignment scores. Their mean remains the assembly component of total quality (20%; hammering 50%, quenching 25%, sharpening 5%). Removing fittings returns all three if capacity permits and still lowers the assembly ceiling by ten percentage points. The merchant stocks eight wooden pommels at 4 copper, and Father’s shopping request/objective includes one. Completed legacy daggers receive the mean of their prior two fitting scores as the third score, preserving quality; unfinished daggers continue to the new pommel step. Existing merchant saves acquire the new stock without waiting for a restock.

Father and action highlights use conservative recommendations separate from the existing permissive action limits: take a forging ingot off the coal at about 900°C, retain at least 850°C for an anvil recommendation, and aim around 850°C before quenching (the manual range remains 750–900°C). Pouring is recommended only for a fully molten charge when both the metal and crucible vessel are at least 100°C above melting: iron 1,638°C, copper 1,185°C. Manual early/partial pouring is still possible. Metal and vessel now track separate temperatures, exchange heat while on/off the forge, and appear alongside mould temperature in the pour view. Old saves initialize vessel temperature from the former metal/crucible reading.

Anvil, oil, water, crucible and mould interaction anchors now occupy the clear aisle above the furniture. Updated connections avoid crossing the anvil, barrels or table, while retaining arrival checks before actions open. Workshop checks sample these approach paths against furniture footprints and verify temperature margins, all three fittings, refitting, saves and the actual mouse/touch assembly flow.


### Custom weapon design

After Father's fixed dagger lesson, use the pencil at the workbench to plan a weapon. The design screen has an overall cubic Bézier curve (fixed tang origin and three draggable or keyboard-adjustable controls), a separate point selector, and three physical sections per stock unit. Each section has relative length, width, thickness, a cutting/diamond/wedge/rounded cross-section, and independently selectable edges. Both faces are worked, giving six hammering/sharpening regions per stock unit. Long jobs show one stock unit's six hammering regions at a time. Metal length is limited to 180 cm and 20 cm per stock unit; handles reach 180 cm. Invalid volume, excessive combined curvature, folded geometry, and grip collisions block saving. Abrupt section changes and thin long blades warn and reduce durability.

Save the design before starting. A new job requires all ore, reducing coal, minimum fuel and its actual chosen guard, handle and pommel. Ore/reducing coal may be deliberately loaded from bag or storehouse; fittings and furnace fuel must be carried. The design locks when work begins. The charge creates one large blank, with its batch mass, casting quality and design retained through storage, crafting, save/reload and resale. Larger masses heat, melt, cool and quench more slowly. Discarded ruined blades have no material recovery. Overworking any hammer cell to 200, overquenching to 200, or accumulating maximum overheating damage ruins the blade; it cannot be forged, assembled, sharpened or repaired afterward. Partially overworked cells still retain their reduced score, and ordinary edge maintenance remains available via the workbench diamond icon without requiring a new ore charge.

One stock unit is 127.06 cm³ (the volume of 1 kg iron). Copper is denser: the same stock volume weighs about 1.139 kg. Iron uses 4 sorted ore and 1 reducing coal per unit; copper uses 6 sorted ore and 1 reducing coal. These sorted-ore yields are explicit game assumptions, not universal geological grades. New jobs additionally require ceil(stock units / 2) furnace coal less any coal already burning. Excess stock volume beyond the finished design represents scale, trimming and forging waste; finished inventory mass follows the designed volume and fittings. Oak/ash handle weights use cylindrical volume and representative dry-wood densities; metal fittings use metal density and fixed fitting volumes. Metal densities/melting points: [Royal Society of Chemistry iron](https://periodic-table.rsc.org/element/26/Iron), [copper](https://periodic-table.rsc.org/element/29/Copper). This remains a deliberately compressed crucible/reduction game, not an industrial smelting simulation; copper quenching is controlled cooling, not hardening.

Live stats integrate sampled blade volume and distributed handle mass to calculate centre of mass and rotational inertia about the grip. Curvature, cross-section, point, configured edges, current sharpness, metal properties and craftsmanship determine a normalized cut/pierce/blunt split, total damage, attack speed, durability and reach. Intentional rounded/no-edge striking surfaces retain full striking efficiency; dull cutting edges do not. Curvature increases cutting emphasis and reduces thrust efficiency. Copper is heavier at equal volume but softer and less durable, with lower edge retention. Numerical damage, speed and durability are tunable RPG values derived from physical dimensions, not experimentally calibrated combat predictions. The game has no combat resolution yet; these stats are saved/recomputed for inventory and future combat integration. Quality weights are hammering 50%, controlled quench/cooling 25%, fitting alignment 20%, sharpening 5%, multiplied by casting quality and reduced by overheating. Unedged sections do not need sharpening. Hands are derived from total length/grip and disable the shield slot when two hands are needed.

Run `npm.cmd run check:weapons` for the custom-design workflow, plus the existing workshop/progression/trading/content checks.
