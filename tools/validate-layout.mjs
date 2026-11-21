// Velora Bay — tools/validate-layout.mjs
// Node-only layout assertion: reads the layout source of truth from
// game/src/world.js and proves no building footprint intersects any road rect.
// Usage: node tools/validate-layout.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'game', 'src', 'world.js'), 'utf8');

function extract(name) {
  const re = new RegExp('var ' + name + ' = (\\[[\\s\\S]*?\\]);');
  const m = src.match(re);
  if (!m) throw new Error('could not find ' + name + ' in world.js');
  return Function('"use strict"; return (' + m[1] + ');')();
}

const ROADS = extract('ROADS');
const BUILDINGS = extract('BUILDINGS');
const SKYLINE = extract('SKYLINE');

function overlap(a, b) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

const violations = [];
const all = BUILDINGS.concat(SKYLINE);
for (let i = 0; i < all.length; i++) {
  const b = all[i];
  const fp = [b[0] - b[2] / 2, b[1] - b[3] / 2, b[0] + b[2] / 2, b[1] + b[3] / 2];
  for (let j = 0; j < ROADS.length; j++) {
    const r = ROADS[j];
    if (overlap(fp, r)) { violations.push({ building: i, road: j, kind: 'overlap', fp }); continue; }
    // margin: separation along the axis where the two rects do NOT overlap
    const gapX = Math.max(r[0] - fp[2], fp[0] - r[2]); // >=0 when separated in x
    const gapZ = Math.max(r[1] - fp[3], fp[1] - r[3]); // >=0 when separated in z
    const overlapsZ = fp[1] < r[3] && fp[3] > r[1];
    const overlapsX = fp[0] < r[2] && fp[2] > r[0];
    if (overlapsZ && gapX >= 0 && gapX < 2) violations.push({ building: i, road: j, kind: 'marginX', gap: gapX, fp });
    if (overlapsX && gapZ >= 0 && gapZ < 2) violations.push({ building: i, road: j, kind: 'marginZ', gap: gapZ, fp });
  }
}

console.log('roads:', ROADS.length, 'buildings:', BUILDINGS.length, 'skyline:', SKYLINE.length);
if (violations.length === 0) {
  console.log('LAYOUT OK — 0 violations');
  process.exit(0);
} else {
  console.log('VIOLATIONS:', JSON.stringify(violations, null, 2));
  process.exit(1);
}
