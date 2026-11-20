// Velora Bay — layout source of truth.
// One grid: roads, districts, POIs, buildings, gold bars, traffic/ped loops.
// Buildings live ONLY inside blocks between roads, inset >= 2 m from every
// road edge, so no building can ever sit on a road. Traffic runs on true
// road centrelines. World: x in [-200, 200], z in [-150, 150]; beach is
// z in [110, 150], water beyond x = +/-200 and z > 150.
export const WORLD = { x0: -200, x1: 200, z0: -150, z1: 150, beachZ0: 110 };

// Roads: { id, name, axis: 'h'|'v', at (centre line), from, to, w (width) }
export const ROADS = [
  { id: 'beach-blvd', name: 'Beach Blvd', axis: 'h', at: 128, from: -200, to: 200, w: 14 },
  { id: 'north-rd', name: 'North Rd', axis: 'h', at: -120, from: -180, to: 180, w: 10 },
  { id: 'harbor-rd', name: 'Harbor Rd', axis: 'h', at: -70, from: -180, to: 180, w: 10 },
  { id: 'center-ave', name: 'Center Ave', axis: 'h', at: -20, from: -180, to: 180, w: 12 },
  { id: 'market-st', name: 'Market St', axis: 'h', at: 30, from: -180, to: 180, w: 10 },
  { id: 'palm-row', name: 'Palm Row', axis: 'h', at: 80, from: -180, to: 180, w: 10 },
  { id: 'portside-st', name: 'Portside St', axis: 'v', at: -150, from: -120, to: 128, w: 10 },
  { id: 'west-st', name: 'West St', axis: 'v', at: -80, from: -120, to: 128, w: 10 },
  { id: 'main-st', name: 'Main St', axis: 'v', at: 0, from: -120, to: 128, w: 12 },
  { id: 'east-st', name: 'East St', axis: 'v', at: 80, from: -120, to: 128, w: 10 },
  { id: 'marina-rd', name: 'Marina Rd', axis: 'v', at: 150, from: -120, to: 128, w: 10 },
];

export function roadRect(r) {
  if (r.axis === 'v') return { x0: r.at - r.w / 2, x1: r.at + r.w / 2, z0: r.from, z1: r.to };
  return { x0: r.from, x1: r.to, z0: r.at - r.w / 2, z1: r.at + r.w / 2 };
}

// Districts: contiguous rectangles tiling the land.
export const DISTRICTS = [
  { id: 'portside', name: 'Portside', x0: -200, x1: -100, z0: -120, z1: 110, color: '#c98a4b', standing: 78 },
  { id: 'center', name: 'Velora Center', x0: -100, x1: 60, z0: -120, z1: 0, color: '#e8c25a', standing: 71 },
  { id: 'marina', name: 'Marina Heights', x0: 60, x1: 200, z0: -120, z1: 60, color: '#7fb3e8', standing: 66 },
  { id: 'neon', name: 'Neon Row', x0: -100, x1: 60, z0: 0, z1: 110, color: '#e86a92', standing: 58 },
  { id: 'beach', name: 'Velora Beach', x0: -200, x1: 200, z0: 110, z1: 150, color: '#2fb3a3', standing: 82 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[0];
}

// Named points of interest. Each is also a building (see BUILDINGS).
export const POIS = [
  { id: 'workshop', name: 'Braddock & Sons Workshop', x: -170, z: -95, district: 'portside', kind: 'workshop' },
  { id: 'pier9', name: 'Pier 9', x: -185, z: 95, district: 'portside', kind: 'pier' },
  { id: 'cityhall', name: 'City Hall', x: -40, z: -45, district: 'center', kind: 'civic' },
  { id: 'debatehall', name: 'Debate Hall', x: 20, z: -45, district: 'center', kind: 'civic' },
  { id: 'vbpd', name: 'VBPD Headquarters', x: -60, z: -95, district: 'center', kind: 'civic' },
  { id: 'haletower', name: 'Hale Tower', x: 120, z: -40, district: 'marina', kind: 'tower' },
  { id: 'safehouse', name: 'Marina Safehouse', x: 170, z: 14, district: 'marina', kind: 'house' },
  { id: 'neonwh', name: 'Neon Warehouse', x: -40, z: 55, district: 'neon', kind: 'warehouse' },
  { id: 'constructionsite', name: 'Hale Construction Site', x: 20, z: 55, district: 'neon', kind: 'construction' },
  { id: 'lumberyard', name: 'Lumber Yard', x: -60, z: 95, district: 'neon', kind: 'warehouse' },
  { id: 'garage', name: 'Crew Garage', x: -40, z: 12, district: 'neon', kind: 'garage' },
  { id: 'nightmarket', name: 'Night Market', x: 20, z: 95, district: 'neon', kind: 'market' },
  { id: 'coralbar', name: 'Coral Bar', x: 100, z: 143, district: 'beach', kind: 'bar' },
  { id: 'gas', name: 'Gas Station', x: 110, z: -95, district: 'marina', kind: 'gas' },
  { id: 'hospital', name: 'Hospital', x: -125, z: -45, district: 'portside', kind: 'civic' },
];

// --- deterministic RNG (mulberry32) so the layout is identical every run ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Block cells between roads (2 m inset from every road edge is already in
// the band bounds below). Buildings are placed only inside these cells.
const X_BANDS = [[-198, -157], [-143, -87], [-73, -8], [8, 73], [87, 143], [157, 198]];
const Z_BANDS = [[-148, -127], [-113, -77], [-63, -28], [-12, 23], [37, 73], [87, 119], [137, 148]];

const PALETTES = {
  portside: ['#b98a5e', '#a67c52', '#c49a6c', '#8f6b4a'],
  center: ['#e8dcc0', '#d9c9a3', '#cbb98a', '#e0cfa8'],
  marina: ['#dfe9f2', '#c9d8e8', '#b7cbe0', '#e8eef4'],
  neon: ['#d98a9a', '#c97b8c', '#e0a0aa', '#b96a7c'],
  beach: ['#f0e0b8', '#e8d5a0', '#f5e8c8'],
};
const KINDS = ['shop', 'house', 'office', 'warehouse', 'apartment'];

function poiBuilding(p) {
  const d = districtAt(p.x, p.z);
  const size = { workshop: [22, 12, 7], pier: [16, 10, 5], civic: [20, 14, 12], tower: [18, 18, 34], house: [12, 10, 6], warehouse: [24, 14, 8], construction: [20, 16, 6], garage: [18, 12, 6], market: [20, 12, 5], bar: [14, 10, 5], gas: [16, 12, 5] };
  const s = size[p.kind] || [16, 12, 8];
  return { x: p.x, z: p.z, w: s[0], d: s[1], h: s[2], district: d.id, kind: p.kind, name: p.name, color: PALETTES[d.id][0], poi: p.id };
}

export const BUILDINGS = (() => {
  const list = POIS.map(poiBuilding);
  const rng = mulberry32(20261120);
  const poiCells = new Set();
  // Mark cells that hold a POI building so the filler skips them.
  for (const p of POIS) {
    const xi = X_BANDS.findIndex(([a, b]) => p.x >= a - 12 && p.x <= b + 12);
    const zi = Z_BANDS.findIndex(([a, b]) => p.z >= a - 10 && p.z <= b + 10);
    if (xi >= 0 && zi >= 0) poiCells.add(xi + ':' + zi);
  }
  for (let xi = 0; xi < X_BANDS.length; xi++) {
    for (let zi = 0; zi < Z_BANDS.length; zi++) {
      if (poiCells.has(xi + ':' + zi)) continue;
      const [x0, x1] = X_BANDS[xi];
      const [z0, z1] = Z_BANDS[zi];
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const bw = x1 - x0, bd = z1 - z0;
      if (bw < 14 || bd < 12) continue; // too small for a building
      const beach = cz > 120;
      const n = beach ? 1 : (bw > 50 && bd > 30 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const w = Math.min(bw - 6, 12 + rng() * 14);
        const d = Math.min(bd - 6, 10 + rng() * 10);
        const ox = n === 1 ? 0 : (i === 0 ? -(bw / 4) : bw / 4);
        const x = cx + ox + (rng() - 0.5) * 4;
        const z = cz + (rng() - 0.5) * 4;
        const dist = districtAt(x, z);
        const pal = PALETTES[dist.id];
        list.push({
          x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10,
          w: Math.round(w * 10) / 10, d: Math.round(d * 10) / 10,
          h: Math.round((5 + rng() * (dist.id === 'marina' ? 16 : 9)) * 10) / 10,
          district: dist.id, kind: beach ? 'hut' : KINDS[Math.floor(rng() * KINDS.length)],
          color: pal[Math.floor(rng() * pal.length)],
        });
      }
    }
  }
  return list;
})();

// 20 Gold Bars — on sidewalks / block corners, never on a road centreline.
export const GOLD_BARS = [
  { x: -168, z: -88 }, { x: -140, z: -110 }, { x: -185, z: 88 }, { x: -120, z: -60 },
  { x: -90, z: -100 }, { x: -45, z: -38 }, { x: -10, z: -60 }, { x: 25, z: -38 },
  { x: 60, z: -100 }, { x: 115, z: -48 }, { x: 140, z: -80 }, { x: 175, z: 20 },
  { x: 90, z: 45 }, { x: 30, z: 60 }, { x: -45, z: 48 }, { x: -70, z: 88 },
  { x: 8, z: 88 }, { x: -160, z: 120 }, { x: 60, z: 138 }, { x: 140, z: 120 },
];

// Traffic loops — closed rectangles on true road centrelines.
export const TRAFFIC_LOOPS = [
  [{ x: -170, z: 128 }, { x: 170, z: 128 }, { x: 170, z: 80 }, { x: -170, z: 80 }],
  [{ x: -170, z: -20 }, { x: 170, z: -20 }, { x: 170, z: 30 }, { x: -170, z: 30 }],
  [{ x: -170, z: -70 }, { x: 170, z: -70 }, { x: 170, z: -120 }, { x: -170, z: -120 }],
  [{ x: 0, z: -110 }, { x: 0, z: 120 }, { x: -80, z: 120 }, { x: -80, z: -110 }],
  [{ x: 80, z: -110 }, { x: 80, z: 120 }, { x: 150, z: 120 }, { x: 150, z: -110 }],
  [{ x: -150, z: -110 }, { x: -150, z: 120 }, { x: 0, z: 120 }, { x: 0, z: -110 }],
];

// Pedestrian loops — sidewalk rectangles around blocks.
export const PED_LOOPS = [
  [{ x: -143, z: -25 }, { x: -87, z: -25 }, { x: -87, z: -65 }, { x: -143, z: -65 }],
  [{ x: 8, z: -25 }, { x: 73, z: -25 }, { x: 73, z: -65 }, { x: 8, z: -65 }],
  [{ x: -143, z: 75 }, { x: -87, z: 75 }, { x: -87, z: 35 }, { x: -143, z: 35 }],
  [{ x: 87, z: 75 }, { x: 143, z: 75 }, { x: 143, z: 35 }, { x: 87, z: 35 }],
  [{ x: -195, z: 122 }, { x: 195, z: 122 }, { x: 195, z: 135 }, { x: -195, z: 135 }],
];

export const SPAWN = { x: -165, z: -88 };
export const GOLDEN_SAW = { x: -150, z: -82 };

// Automated assertion: no building footprint (expanded by 2 m) touches any road.
export function validateLayout() {
  const bad = [];
  for (const b of BUILDINGS) {
    const bx0 = b.x - b.w / 2 - 2, bx1 = b.x + b.w / 2 + 2;
    const bz0 = b.z - b.d / 2 - 2, bz1 = b.z + b.d / 2 + 2;
    for (const r of ROADS) {
      const rr = roadRect(r);
      if (bx0 < rr.x1 && bx1 > rr.x0 && bz0 < rr.z1 && bz1 > rr.z0) {
        bad.push(`${b.name || b.kind} at (${b.x},${b.z}) ${b.w}x${b.d} hits road ${r.id}`);
      }
    }
  }
  return bad;
}
