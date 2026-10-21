# How to Become a General — Briarwick prototype

A local Vue/Vite prototype of the opening town. The map is the main interface.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Playable now

- Select a town location, then walk there. Travel time is calculated from map distance.
- The first market trip triggers the planned bandit defeat. Health and money change, and injury lowers available stamina.
- Work placeholder shifts at the tavern or town square to earn money and advance time.
- Make an offer for iron stock. Seller opinion affects the lowest accepted offer and future asking price; bad offers can cause a temporary refusal.
- Return to the forge, make a dagger, sleep, and reach the birthday draft scene.
- Save data stays in browser local storage. Use **Restart** in Field Notes to start over.

## Rules and scope

Fatigue begins after 16 hours awake and reduces the stamina cap linearly to 50% at 48 hours. Injury multiplies the available stamina within that fatigue cap. Activities will begin at the resulting available stamina once their mini games are built. Sleep resets fatigue and restores 12 health; health otherwise carries over.

Combat, detailed woodcutting, dishwashing, blacksmithing, and skill purchases are intentionally represented as placeholders for the next design passes. The map has four open locations and three visible future locations. Its road layout leaves space for Briarwick to grow toward a capital.
