// VELORA BAY — LAYOUT (single source of truth)
// One data model for roads, blocks, districts, POIs, buildings, traffic and
// pedestrian routes. The world builder, minimap, map screen and traffic all
// read from this file — nothing is hardcoded anywhere else.
// Units are metres. +x east, +z south. The island spans x -200..200,
// z -150..150. Water lies west of x -200, east of x 200, south of z 150.

export const WORLD = { minX: -200, maxX: 200, minZ: -150, maxZ: 150 };

// ---- Roads: axis-aligned rects. half = half width (asphalt), side = sidewalk.
// Traffic drives on the centreline; pedestrians walk on the sidewalks.
export const ROADS = [
  // vertical (north-south), z from -130 to 110
  { id: 'V1', name: 'Portside Ave',  axis: 'v', at: -140, from: -130, to: 110, half: 5,  side: 2 },
  { id: 'V2', name: 'Harbor St',    axis: 'v', at: -70,  from: -130, to: 110, half: 5,  side: 2 },
  { id: 'V3', name: 'Central Ave',  axis: 'v', at: 0,    from: -130, to: 110, half: 6,  side: 2 },
  { id: 'V4', name: 'Marina Blvd',  axis: 'v', at: 70,   from: -130, to: 110, half: 5,  side: 2 },
  { id: 'V5', name: 'Heights Rd',   axis: 'v', at: 140,  from: -130, to: 110, half: 5,  side: 2 },
  // horizontal (east-west), x from -190 to 190
  { id: 'H1', name: 'North Rd',     axis: 'h', at: -120, from: -190, to: 190, half: 5,  side: 2 },
  { id: 'H2', name: 'Foundry St',   axis: 'h', at: -60,  from: -190, to: 190, half: 5,  side: 2 },
  { id: 'H3', name: 'Market St',    axis: 'h', at: 0,    from: -190, to: 190, half: 5,  side: 2 },
  { id: 'H4', name: 'Palm St',      axis: 'h', at: 50,   from: -190, to: 190, half: 5,  side: 2 },
  { id: 'H5', name: 'Beach Blvd',   axis: 'h', at: 100,  from: -190, to: 190, half: 6,  side: 2 },
];

// Road rect (asphalt only) for a road entry.
export function roadRect(r) {
  if (r.axis === 'v') return { x0: r.at - r.half, x1: r.at + r.half, z0: r.from, z1: r.to };
  return { x0: r.from, x1: r.to, z0: r.at - r.half, z1: r.at + r.half };
}

// ---- Districts: geographic rectangles, lookup priority order.
export const DISTRICTS = [
  { id: 'portside', name: 'Portside',       color: 0xc98a4b, standing: 58, x0: -200, x1: -70,  z0: -150, z1: 150 },
  { id: 'beach',    name: 'Velora Beach',   color: 0x2fb3a3, standing: 44, x0: -70,  x1: 200,  z0: 60,   z1: 150 },
  { id: 'neon',     name: 'Neon Row',       color: 0xe86a92, standing: 37, x0: -70,  x1: 200,  z0: -150, z1: -60 },
  { id: 'marina',   name: 'Marina Heights', color: 0x7fb3e8, standing: 62, x0: 70,   x1: 200,  z0: -60,  z1: 60 },
  { id: 'center',   name: 'Velora Center',  color: 0xe8c25a, standing: 71, x0: -70,  x1: 70,   z0: -60,  z1: 60 },
];
export function districtAt(x, z) {
  if (x < -70) return DISTRICTS[0];
  if (z >= 60) return DISTRICTS[1];
  if (z < -60) return DISTRICTS[2];
  if (x >= 70) return DISTRICTS[3];
  return DISTRICTS[4];
}

// ---- Points of interest. pos is the building/marker centre.
// Every POI sits inside a block, never on a road (validated below).
export const POIS = [
  { id: 'workshop',  name: "Braddock & Sons Workshop", kind: 'property', district: 'portside', x: -105, z: -30, w: 26, d: 18, h: 9 },
  { id: 'pier9',     name: 'Pier 9',                   kind: 'landmark', district: 'portside', x: -196, z: 0,   w: 10, d: 60, h: 2 },
  { id: 'garage',    name: 'Crew Garage',              kind: 'property', district: 'portside', x: -105, z: 75,  w: 30, d: 16, h: 8 },
  { id: 'cityhall',  name: 'City Hall',                kind: 'civic',    district: 'center',   x: -35,  z: 17,  w: 34, d: 18, h: 18 },
  { id: 'fountain',  name: 'City Hall Fountain',       kind: 'plaza',    district: 'center',   x: -35,  z: 38,  w: 8,  d: 8,  h: 2 },
  { id: 'debate',    name: 'Debate Hall',              kind: 'civic',    district: 'center',   x: 35,   z: 25,  w: 28, d: 18, h: 14 },
  { id: 'policehq',  name: 'VBPD Headquarters',        kind: 'civic',    district: 'center',   x: 35,   z: -30, w: 26, d: 16, h: 12 },
  { id: 'market',    name: 'Night Market',             kind: 'market',   district: 'center',   x: -35,  z: 75,  w: 40, d: 20, h: 6 },
  { id: 'haletower', name: 'Hale Tower',               kind: 'tower',    district: 'marina',   x: 105,  z: -30, w: 24, d: 24, h: 58 },
  { id: 'safehouse', name: 'Marina Safehouse',         kind: 'property', district: 'marina',   x: 170,  z: 25,  w: 20, d: 14, h: 10 },
  { id: 'marina',    name: 'Marina Docks',             kind: 'landmark', district: 'marina',   x: 196,  z: 20,  w: 8,  d: 50, h: 2 },
  { id: 'lumber',    name: 'Lumber Yard',              kind: 'industrial', district: 'neon',   x: -35,  z: -90, w: 34, d: 22, h: 8 },
  { id: 'construct', name: 'Hale Construction Site',   kind: 'industrial', district: 'neon',   x: 35,   z: -90, w: 40, d: 24, h: 10 },
  { id: 'warehouse', name: 'Neon Warehouse',           kind: 'industrial', district: 'neon',   x: 170,  z: -90, w: 30, d: 20, h: 11 },
  { id: 'beachbar',  name: 'Coral Bar',                kind: 'shop',     district: 'beach',    x: 105,  z: 80,  w: 18, d: 12, h: 7 },
];
export function poi(id) { return POIS.find((p) => p.id === id); }

// ---- Blocks: the cells between roads. Buildings live only in blocks,
// inset by road half-width + 2 m margin, so no footprint can touch a road.
const VERTICALS = [-200, -140, -70, 0, 70, 140, 200];
const HORIZONTALS = [-150, -120, -60, 0, 50, 100, 150];
const ROAD_HALF = { '-140': 5, '-70': 5, 0: 6, 70: 5, 140: 5 };
const ROAD_HALF_H = { '-120': 5, '-60': 5, 0: 5, 50: 5, 100: 6 };

export function blocks() {
  const out = [];
  for (let i = 0; i < VERTICALS.length - 1; i++) {
    for (let j = 0; j < HORIZONTALS.length - 1; j++) {
      const x0 = VERTICALS[i], x1 = VERTICALS[i + 1];
      const z0 = HORIZONTALS[j], z1 = HORIZONTALS[j + 1];
      const mL = (i === 0 ? 0 : ROAD_HALF[x0]) + 2;
      const mR = (i === VERTICALS.length - 2 ? 0 : ROAD_HALF[x1]) + 2;
      const mT = (j === 0 ? 0 : ROAD_HALF_H[z0]) + 2;
      const mB = (j === HORIZONTALS.length - 2 ? 0 : ROAD_HALF_H[z1]) + 2;
      out.push({ x0: x0 + mL, x1: x1 - mR, z0: z0 + mT, z1: z1 - mB, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
    }
  }
  return out;
}

// ---- Deterministic RNG (mulberry32) so the city is identical every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Buildings: POI buildings + procedurally filled blocks.
// A building is {x, z, w, d, h, type, color, district, poi?}.
// Filled blocks are split into a 2x2 slot grid; at most one building per slot,
// inset so neighbours never touch. Beach blocks (z0 >= 100) get only huts.
export function generateBuildings() {
  const rng = mulberry32(20261120);
  const list = [];
  const used = new Set();
  const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;

  for (const p of POIS) {
    if (p.kind === 'landmark' || p.kind === 'plaza') continue; // piers/docks/fountain are flat, not buildings
    list.push({ x: p.x, z: p.z, w: p.w, d: p.d, h: p.h, type: p.kind, district: p.district, poi: p.id });
    used.add(key(p.x, p.z));
  }

  const palette = {
    portside: [0xd8b48a, 0xb98a5e, 0x9a7b5f, 0xc9a06a],
    center: [0xf2e3c6, 0xe8d3a8, 0xd9c193, 0xe6dcc3, 0xf0c98f],
    marina: [0xe8eef2, 0xdfe8f0, 0xcfe0ea, 0xf5f0e6, 0xd8e4ee],
    neon: [0x8f9aa3, 0x7a8894, 0xa8b0b8, 0x6e7c88],
    beach: [0xf5e6c8, 0xeed9a8, 0xf2d8b0, 0xe8c98f],
  };
  const heights = { portside: [7, 12], center: [9, 18], marina: [12, 26], neon: [8, 14], beach: [5, 9] };

  for (const b of blocks()) {
    const district = districtAt(b.cx, b.cz);
    const isBeach = b.z0 >= 100;
    const bw = b.x1 - b.x0, bd = b.z1 - b.z0;
    if (bw < 14 || bd < 12) continue;
    const cols = bw > 44 ? 2 : 1;
    const rows = bd > 34 ? 2 : 1;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const sx0 = b.x0 + (c * bw) / cols, sx1 = b.x0 + ((c + 1) * bw) / cols;
        const sz0 = b.z0 + (r * bd) / rows, sz1 = b.z0 + ((r + 1) * bd) / rows;
        // skip slots that a POI building's footprint touches
        let clash = false;
        for (const p of POIS) {
          if (p.kind === 'landmark' || p.kind === 'plaza') continue;
          const px0 = p.x - p.w / 2 - 2, px1 = p.x + p.w / 2 + 2;
          const pz0 = p.z - p.d / 2 - 2, pz1 = p.z + p.d / 2 + 2;
          if (px0 < sx1 && px1 > sx0 && pz0 < sz1 && pz1 > sz0) { clash = true; break; }
        }
        if (clash) continue;
        if (rng() < 0.18) continue; // leave some slots as yards / parking
        const [hMin, hMax] = heights[district.id];
        const w = Math.min(sx1 - sx0 - 6, 10 + rng() * 14);
        const d = Math.min(sz1 - sz0 - 6, 9 + rng() * 11);
        const h = isBeach ? 4 + rng() * 3 : hMin + rng() * (hMax - hMin);
        const x = (sx0 + sx1) / 2 + (rng() - 0.5) * 3;
        const z = (sz0 + sz1) / 2 + (rng() - 0.5) * 3;
        const colors = palette[district.id];
        list.push({
          x, z, w, d, h,
          type: isBeach ? 'hut' : (district.id === 'neon' || district.id === 'portside' ? 'industrial' : 'house'),
          district: district.id,
          color: colors[Math.floor(rng() * colors.length)],
        });
      }
    }
  }
  return list;
}
export const BUILDINGS = generateBuildings();

// ---- 20 Gold Bars: hand-placed, reachable on foot, never on a road.
export const GOLD_BARS = [
  { x: -118, z: -18 }, { x: -92, z: -44 }, { x: -186, z: -40 }, { x: -150, z: 60 },
  { x: -112, z: 88 }, { x: -60, z: -110 }, { x: -20, z: -110 }, { x: -60, z: -8 },
  { x: -8, z: 30 }, { x: -52, z: 62 }, { x: 20, z: -110 }, { x: 60, z: -70 },
  { x: 60, z: 12 }, { x: 90, z: 42 }, { x: 130, z: -44 }, { x: 150, z: -8 },
  { x: 180, z: 62 }, { x: 120, z: 118 }, { x: 30, z: 118 }, { x: -30, z: 118 },
];

// ---- Traffic loops: rectangular circuits on true road centrelines.
// Each loop is a list of [x, z] intersection waypoints, driven in order.
export const TRAFFIC_LOOPS = [
  // outer ring
  [[-140, -120], [140, -120], [140, 100], [-140, 100]],
  // inner ring
  [[-70, -60], [70, -60], [70, 50], [-70, 50]],
  // centre cross north-south + east-west
  [[0, -120], [0, 100], [0, -120]],
  // beach boulevard cruise
  [[-190, 100], [190, 100], [190, 100]],
  // portside loop
  [[-140, -60], [-70, -60], [-70, 50], [-140, 50]],
  // marina loop
  [[70, -60], [140, -60], [140, 50], [70, 50]],
];

// ---- Pedestrian loops: sidewalk circuits around blocks (offset off the asphalt).
export const PED_LOOPS = [
  [[-133, -53], [-77, -53], [-77, -7], [-133, -7]],
  [[-63, -53], [-7, -53], [-7, -7], [-63, -7]],
  [[7, -53], [63, -53], [63, -7], [7, -7]],
  [[77, -53], [133, -53], [133, -7], [77, -7]],
  [[-133, 7], [-77, 7], [-77, 43], [-133, 43]],
  [[-63, 57], [-7, 57], [-7, 93], [-63, 93]],
  [[77, 57], [133, 57], [133, 93], [77, 93]],
  [[-133, 107], [133, 107], [133, 143], [-133, 143]],
];

// ---- Spawn: Eli starts in the workshop yard, Golden Saw parked beside him.
export const SPAWN = { x: -92, z: -18, rotY: Math.PI / 2 };
export const GOLDEN_SAW = { x: -88, z: -8, rotY: Math.PI / 2 };

// ---- Validation: no building footprint may intersect any road rect
// expanded by a 2 m safety margin. Returns a list of violations (empty = OK).
export function rectsOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}
export function validateLayout() {
  const violations = [];
  const margin = 2;
  for (const b of BUILDINGS) {
    const fb = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 };
    for (const r of ROADS) {
      const rr = roadRect(r);
      const expanded = { x0: rr.x0 - margin, x1: rr.x1 + margin, z0: rr.z0 - margin, z1: rr.z1 + margin };
      if (rectsOverlap(fb, expanded)) {
        violations.push(`BUILDING ${b.type}@(${b.x},${b.z}) ${b.w}x${b.d} intersects road ${r.id} ${r.name} (margin ${margin}m)`);
      }
    }
  }
  // POI flat structures (piers, fountain) must also stay off the asphalt.
  for (const p of POIS) {
    if (p.kind !== 'landmark' && p.kind !== 'plaza') continue;
    const fb = { x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 };
    for (const r of ROADS) {
      if (rectsOverlap(fb, roadRect(r))) violations.push(`POI ${p.id} intersects road ${r.id}`);
    }
  }
  // Gold bars must not sit on a road.
  for (const g of GOLD_BARS) {
    for (const r of ROADS) {
      const rr = roadRect(r);
      if (g.x > rr.x0 && g.x < rr.x1 && g.z > rr.z0 && g.z < rr.z1) violations.push(`GOLD BAR (${g.x},${g.z}) on road ${r.id}`);
    }
  }
  // Traffic waypoints must lie on road centrelines.
  for (let li = 0; li < TRAFFIC_LOOPS.length; li++) {
    for (const [x, z] of TRAFFIC_LOOPS[li]) {
      const onRoad = ROADS.some((r) => {
        if (r.axis === 'v') return Math.abs(x - r.at) < 0.01 && z >= r.from && z <= r.to;
        return Math.abs(z - r.at) < 0.01 && x >= r.from && x <= r.to;
      });
      if (!onRoad) violations.push(`TRAFFIC loop ${li} waypoint (${x},${z}) is not on a road centreline`);
    }
  }
  // Buildings must not overlap each other.
  for (let i = 0; i < BUILDINGS.length; i++) {
    const a = BUILDINGS[i];
    const fa = { x0: a.x - a.w / 2, x1: a.x + a.w / 2, z0: a.z - a.d / 2, z1: a.z + a.d / 2 };
    for (let j = i + 1; j < BUILDINGS.length; j++) {
      const b = BUILDINGS[j];
      const fb = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 };
      if (rectsOverlap(fa, fb)) violations.push(`BUILDINGS overlap: ${a.type}@(${a.x},${a.z}) vs ${b.type}@(${b.x},${b.z})`);
    }
  }
  return violations;
}
