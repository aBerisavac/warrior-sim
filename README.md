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
