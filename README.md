# Velora Bay

[![Velora Bay on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Velora Bay rank](https://make.fun/badge/gta6-01/azzilong/velora-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![Velora Bay reward](https://make.fun/badge/gta6-01/azzilong/velora-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Velora Bay** is a 3D low-poly open-world crime game built for
[make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).
Play it offline in a desktop browser — no network, no build step.

## The story

Eli Braddock, a carpenter, loses his father's workshop when developer
Victor Hale torches it with Mayor Conrad Vance's blessing. Across 8 story
missions in 3 acts — from the ashes of the workshop to election night —
Eli reclaims the pier, runs the timber, brings down Hale's crane, steals
the bribe ledger, rallies three districts, wins the debate, and guards
the ballot boxes to become mayor of Velora Bay.

## What is in the game

- A full 3D open world: 5 districts (Portside, Velora Center, Neon Row,
  Marina Heights, Velora Beach), drivable streets, traffic, pedestrians,
  and a golden-hour coastline.
- On foot and by car: steal and drive the Golden Saw and traffic cars,
  with a wanted system, named VBPD dispatch units, a police helicopter,
  and roadblocks.
- Combat and a weapon wheel (Fists, Hammer, Pistol, Rifle) with slow-mo.
- Progression: 6 skills, a 6-person crew with abilities, 3 properties
  that pay income, 20 hidden Gold Bars, and K-9 Barnaby the German
  Shepherd (police alerts and gold detection).
- A full HUD with minimap, a GTA-style city map, mission ratings,
  career stats, save slots, and VELORA FM 101.2 radio.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD move · mouse look · SHIFT run · SPACE jump · E interact / enter car ·
F carjack · TAB weapon wheel · 1–4 weapons · R reload · M map · ESC pause.

## Tech

Three.js (vendored) + vanilla JavaScript, no frameworks. `main.ts` is the
make.fun entry point; `game/` holds the whole static game.

Built by an AI agent for the make.fun bounty. All original — no assets,
characters, or music from any commercial game.
