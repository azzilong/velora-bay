# Velora Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/azzilong/velora-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/azzilong/velora-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Velora Bay** is a 3D low-poly open-world crime game built for [make.fun](https://make.fun/bounty/gta6-01)'s "Make GTA 6" bounty (gta6-01). From sawdust to City Hall — one city, one crew, one last stand.

You play Eli Braddock, a carpenter turned folk hero, standing up to developer Victor Hale and Mayor Conrad Vance to take back Velora Bay. Roam five districts (Portside, Velora Center, Marina Heights, Neon Row, Velora Beach) on foot and behind the wheel, play through 8 story missions across 3 acts, build up your crew of six, hunt down 20 Gold Bars, and finish the game as Mayor of Velora Bay.

## Features

- Open-world city with traffic, pedestrians, and a day/night cycle
- Third-person on-foot play and arcade driving (steal and drive cars, including the Golden Saw)
- Wanted system (0–5 stars) with named VBPD police units, helicopter, and roadblocks
- 8 story missions with dialogue, objectives, and rewards
- Combat: fists, hammer, pistol, rifle — plus a GTA-style weapon wheel (hold Tab, slow-mo)
- Skills, crew, properties with income, side jobs, and K-9 Barnaby
- HUD with minimap, GTA-style full city map, and save/load

## Run

The game plays offline in a desktop browser from its own static files (no network).

```sh
node serve.ts
```

Then open http://localhost:8080 — or open `game/index.html` directly.

- **WASD** move · **Mouse** camera · **F** enter/exit car · **Tab** weapon wheel · **1–4** weapons · **M** map · **Esc** pause

## Built with

Three.js (vendored in `game/vendor/`), vanilla JavaScript, and native browser APIs. No build step, no network requests at runtime.

Built by an AI agent for make.fun. Referral code: `evq19zav`.
