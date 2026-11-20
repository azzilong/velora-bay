// Velora Bay — world builder (Three.js, vanilla JS).
// Builds the whole city from layout.js: ground, water, beach, roads,
// sidewalks, buildings (varied, with lit windows at night), palms,
// streetlights, props, cranes, boats, billboards, sky + lighting.
// Night mode: windows glow warm, lamps + neon turn on, moonlight replaces sun.
import * as L from './layout.js';

let T = null; // THREE namespace, set by init()
const MAT = {};
function mat(name, color, opts = {}) {
  if (!MAT[name]) MAT[name] = new T.MeshLambertMaterial({ color, ...opts });
  return MAT[name];
}
function box(w, h, d, color, x, y, z, opts) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color + JSON.stringify(opts || ''), color, opts));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, color, x, y, z, seg = 8) {
  const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat('c' + color, color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

export const world = {
  colliders: [], // {x0,z0,x1,z1} building footprints (for movement + traffic)
  windowMats: [], // emissive window materials (brighten at night)
  lampHeads: [], // emissive lamp materials
  neonMats: [], // neon sign materials
  lampPools: [],
  water: null, sun: null, hemi: null, moon: null, sky: null,
  playerLights: [], // point lights that follow the player at night
  timeOfDay: 17.0, // golden hour by default
  isNight: false,
};

function makeCanvasTexture(draw, w = 256, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene, THREE) {
  T = THREE;
  // --- sky: big gradient dome with a low sun disc ---
  const skyTex = makeCanvasTexture((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#7ec8ee'); gr.addColorStop(0.55, '#ffd9a0'); gr.addColorStop(1, '#ffe9c4');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff8e0'; g.beginPath(); g.arc(w * 0.72, h * 0.42, 26, 0, 7); g.fill();
  }, 512, 256);
  world.sky = new T.Mesh(new T.SphereGeometry(900, 16, 12), new T.MeshBasicMaterial({ side: T.BackSide, map: skyTex }));
  scene.add(world.sky);

  // --- lights ---
  world.sun = new T.DirectionalLight(0xffd9a0, 2.2);
  world.sun.position.set(140, 160, 60);
  world.sun.castShadow = true;
  world.sun.shadow.mapSize.set(2048, 2048);
  const sc = world.sun.shadow.camera;
  sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.far = 500;
  world.sun.shadow.bias = -0.0004;
  scene.add(world.sun); scene.add(world.sun.target);
  world.hemi = new T.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9);
  scene.add(world.hemi);
  world.fog = scene.fog;
  world.moon = new T.DirectionalLight(0x8fa8ff, 0.0);
  world.moon.position.set(-80, 120, -40);
  scene.add(world.moon); scene.add(world.moon.target);
  // 2 point lights that follow the player at night (cheap local glow)
  for (let i = 0; i < 2; i++) {
    const p = new T.PointLight(0xffc46a, 0, 26, 1.6);
    scene.add(p); world.playerLights.push(p);
  }

  // --- ground: land + beach + water ---
  const land = new T.Mesh(new T.PlaneGeometry(400, 300), mat('land', 0x7fae62));
  land.rotation.x = -Math.PI / 2; land.position.set(0, 0, 0); land.receiveShadow = true;
  scene.add(land);
  const beach = new T.Mesh(new T.PlaneGeometry(400, 40), mat('sand', 0xe8d9a0));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.02, 130); beach.receiveShadow = true;
  scene.add(beach);
  const waterMat = new T.MeshPhongMaterial({ color: 0x2a9db5, shininess: 120, specular: 0x99ddff, transparent: true, opacity: 0.94 });
  world.water = new T.Mesh(new T.PlaneGeometry(900, 900), waterMat);
  world.water.rotation.x = -Math.PI / 2; world.water.position.set(0, -0.4, 380);
  scene.add(world.water);
  // harbour water strip on the west edge
  const westWater = new T.Mesh(new T.PlaneGeometry(60, 300), waterMat);
  westWater.rotation.x = -Math.PI / 2; westWater.position.set(-230, -0.35, 0);
  scene.add(westWater);

  buildRoads(scene);
  buildBuildings(scene);
  buildPalms(scene);
  buildStreetlights(scene);
  buildProps(scene);
  buildWaterfront(scene);
  return world;
}

function buildRoads(scene) {
  const asphalt = mat('asphalt', 0x3a3f4a);
  const sidewalk = mat('sidewalk', 0xb8b0a0);
  const dash = mat('dash', 0xe8c25a);
  for (const r of L.ROADS) {
    const rr = L.roadRect(r);
    const w = rr.x1 - rr.x0, d = rr.z1 - rr.z0;
    const m = new T.Mesh(new T.BoxGeometry(w, 0.12, d), asphalt);
    m.position.set((rr.x0 + rr.x1) / 2, 0.06, (rr.z0 + rr.z1) / 2);
    m.receiveShadow = true; scene.add(m);
    // sidewalks: two strips just outside the asphalt
    const sw = 3;
    if (r.axis === 'h') {
      for (const s of [-1, 1]) {
        const sm = new T.Mesh(new T.BoxGeometry(w, 0.1, sw), sidewalk);
        sm.position.set((rr.x0 + rr.x1) / 2, 0.05, rr.z0 + (s < 0 ? -sw / 2 : d + sw / 2));
        sm.receiveShadow = true; scene.add(sm);
      }
      const n = Math.floor(w / 8);
      for (let i = 0; i < n; i++) {
        const dm = new T.Mesh(new T.BoxGeometry(3, 0.05, 0.5), dash);
        dm.position.set(rr.x0 + 4 + i * 8, 0.13, (rr.z0 + rr.z1) / 2);
        scene.add(dm);
      }
    } else {
      for (const s of [-1, 1]) {
        const sm = new T.Mesh(new T.BoxGeometry(sw, 0.1, d), sidewalk);
        sm.position.set(rr.x0 + (s < 0 ? -sw / 2 : w + sw / 2), 0.05, (rr.z0 + rr.z1) / 2);
        sm.receiveShadow = true; scene.add(sm);
      }
      const n = Math.floor(d / 8);
      for (let i = 0; i < n; i++) {
        const dm = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 3), dash);
        dm.position.set((rr.x0 + rr.x1) / 2, 0.13, rr.z0 + 4 + i * 8);
        scene.add(dm);
      }
    }
  }
}

function windowMaterial() {
  const m = new T.MeshLambertMaterial({ color: 0x2a3a55, emissive: 0xffc46a, emissiveIntensity: 0.12 });
  world.windowMats.push(m);
  return m;
}

function buildBuildings(scene) {
  const roofMat = mat('roof', 0x6b4a3a);
  for (const b of L.BUILDINGS) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.d), mat('b' + b.color, b.color));
    body.position.y = b.h / 2; body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const roof = new T.Mesh(new T.BoxGeometry(b.w + 0.6, 0.5, b.d + 0.6), roofMat);
    roof.position.y = b.h + 0.25; roof.castShadow = true; g.add(roof);
    // lit window panes (front + side) — segmented, so they read as windows,
    // not one glowing slab. Warm emissive at night.
    const wm = windowMaterial();
    const cols = Math.max(2, Math.min(4, Math.floor(b.w / 5)));
    const rows = b.h > 9 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pane = new T.Mesh(new T.BoxGeometry(1.5, 1.1, 0.12), wm);
        pane.position.set(-((cols - 1) * 2.6) / 2 + c * 2.6, b.h * (0.35 + r * 0.35), b.d / 2 + 0.07);
        g.add(pane);
      }
    }
    const sideCols = Math.max(1, Math.min(3, Math.floor(b.d / 5)));
    for (let c = 0; c < sideCols; c++) {
      const pane = new T.Mesh(new T.BoxGeometry(0.12, 1.1, 1.5), wm);
      pane.position.set(b.w / 2 + 0.07, b.h * 0.5, -((sideCols - 1) * 2.6) / 2 + c * 2.6);
      g.add(pane);
    }
    if (b.kind === 'tower') {
      const crown = new T.Mesh(new T.BoxGeometry(b.w * 0.5, 3, b.d * 0.5), mat('towercrown', 0x2a4a7a));
      crown.position.y = b.h + 2; crown.castShadow = true; g.add(crown);
      const beacon = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), new T.MeshBasicMaterial({ color: 0xff4444 }));
      beacon.position.y = b.h + 4; g.add(beacon);
    }
    if (b.kind === 'civic' && b.name === 'City Hall') {
      for (let i = -1; i <= 1; i++) {
        const col = cyl(0.7, 0.8, 6, 0xe8e0c8, i * 5, 3, b.d / 2 + 1.2, 10);
        g.add(col);
      }
      const dome = new T.Mesh(new T.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('dome', 0xd8b25a));
      dome.position.y = b.h + 0.5; dome.castShadow = true; g.add(dome);
      const pole = cyl(0.08, 0.08, 7, 0x888888, 0.4, b.h + 3.5, 0, 6);
      g.add(pole);
      const flag = new T.Mesh(new T.BoxGeometry(2.4, 1.4, 0.1), mat('flag', 0xffd700));
      flag.position.set(1.6, b.h + 6.4, 0); g.add(flag);
    }
    if (b.kind === 'workshop') {
      const sign = new T.Mesh(new T.BoxGeometry(b.w * 0.7, 1.6, 0.3), mat('signwood', 0x8a5a2a));
      sign.position.set(0, b.h - 1, b.d / 2 + 0.2); g.add(sign);
    }
    if (b.kind === 'market') {
      const awn = new T.Mesh(new T.BoxGeometry(b.w * 0.8, 0.4, 3), mat('awn', 0xe86a92));
      awn.position.set(0, 3.2, b.d / 2 + 1.4); g.add(awn);
    }
    if (b.kind === 'gas') {
      const canopy = new T.Mesh(new T.BoxGeometry(10, 0.6, 8), mat('canopy', 0xe8c25a));
      canopy.position.set(0, 5, b.d / 2 + 5); canopy.castShadow = true; g.add(canopy);
    }
    g.position.set(b.x, 0, b.z);
    scene.add(g);
    world.colliders.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
  }
  // City Hall fountain (in the block in front of City Hall, NOT on a road)
  const basin = cyl(4, 4.4, 0.8, 0xcfd8e0, -40, 0.4, -28, 16);
  scene.add(basin);
  const fwater = new T.Mesh(new T.CylinderGeometry(3.6, 3.6, 0.3, 16), mat('fwater', 0x4ab8d8));
  fwater.position.set(-40, 0.8, -28); scene.add(fwater);
  world.colliders.push({ x0: -44, x1: -36, z0: -32, z1: -24 });
}

function buildPalms(scene) {
  const trunkM = mat('trunk', 0x8a6a4a);
  const leafM = mat('leaf', 0x3a9e4a);
  const leaf2M = mat('leaf2', 0x2a7e3a);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const spots = [];
  for (let x = -190; x <= 190; x += 20) { spots.push([x, 121]); spots.push([x + 10, 135]); }
  for (let x = -170; x <= 170; x += 30) { spots.push([x, 73]); spots.push([x + 15, 87]); }
  for (let x = -180; x <= 180; x += 45) { spots.push([x, 142]); }
  for (const [x, z] of spots) {
    const g = new T.Group();
    const h = 5 + rnd() * 2;
    const trunk = new T.Mesh(new T.CylinderGeometry(0.25, 0.4, h, 6), trunkM);
    trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
    const crown = new T.Mesh(new T.ConeGeometry(2.6, 2.2, 6), leafM);
    crown.position.y = h + 0.8; crown.scale.y = 0.55; crown.castShadow = true; g.add(crown);
    const c2 = new T.Mesh(new T.ConeGeometry(1.8, 1.6, 6), leaf2M);
    c2.position.y = h + 0.2; c2.scale.y = 0.5; g.add(c2);
    g.position.set(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 2);
    g.rotation.y = rnd() * 6.28;
    scene.add(g);
  }
}

function buildStreetlights(scene) {
  const poleM = mat('lampole', 0x2a2f3a);
  for (const r of L.ROADS) {
    const len = r.to - r.from;
    const n = Math.floor(len / 40);
    for (let i = 0; i < n; i++) {
      const t = r.from + 20 + i * 40;
      const x = r.axis === 'h' ? t : r.at + r.w / 2 + 2.2;
      const z = r.axis === 'h' ? r.at + r.w / 2 + 2.2 : t;
      const g = new T.Group();
      const pole = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 6, 6), poleM);
      pole.position.y = 3; pole.castShadow = true; g.add(pole);
      const headM = new T.MeshLambertMaterial({ color: 0x666666, emissive: 0xffd9a0, emissiveIntensity: 0.15 });
      world.lampHeads.push(headM);
      const head = new T.Mesh(new T.BoxGeometry(0.7, 0.3, 0.4), headM);
      head.position.y = 6; g.add(head);
      const pool = new T.Mesh(new T.CircleGeometry(3.2, 12), new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
      pool.rotation.x = -Math.PI / 2; pool.position.y = 0.16;
      g.add(pool);
      world.lampPools.push(pool);
      g.position.set(x, 0, z);
      scene.add(g);
    }
  }
  // Neon Row signs — glowing shop fronts
  const neonColors = [0xff4a8a, 0x4ad8ff, 0xffd24a, 0x7aff6a];
  const neonSpots = [[-40, 55], [20, 55], [20, 95], [-40, 12], [5, 95]];
  neonSpots.forEach(([x, z], i) => {
    const m = new T.MeshLambertMaterial({ color: 0x222222, emissive: neonColors[i % neonColors.length], emissiveIntensity: 0.4 });
    world.neonMats.push(m);
    const sign = new T.Mesh(new T.BoxGeometry(6, 1.2, 0.3), m);
    sign.position.set(x, 5.5, z + 7); scene.add(sign);
  });
}

function buildProps(scene) {
  // shipping containers (Portside)
  const contCols = [0xc96a3a, 0x3a7ab8, 0x5a9e4a, 0xb8a03a];
  let ci = 0;
  for (const [x, z] of [[-185, -60], [-175, -60], [-185, -50], [-170, -110], [-160, -105], [150, 45], [160, 45]]) {
    const c = box(6, 2.6, 2.6, contCols[ci++ % 4], x, 1.3, z);
    c.rotation.y = (ci % 2) * 0.4; scene.add(c);
    world.colliders.push({ x0: x - 3, x1: x + 3, z0: z - 1.5, z1: z + 1.5 });
  }
  // construction cranes (Neon Row)
  for (const [x, z] of [[20, 62], [-10, 48]]) {
    const g = new T.Group();
    g.add(box(2, 18, 2, 0xe8a03a, 0, 9, 0));
    g.add(box(16, 1, 1, 0xe8a03a, 6, 17.5, 0));
    g.add(box(5, 1, 1, 0xe8a03a, -3.5, 17.5, 0));
    g.add(box(2, 2, 2, 0x2a2f3a, 0, 16, 0));
    g.position.set(x, 0, z); scene.add(g);
    world.colliders.push({ x0: x - 1.5, x1: x + 1.5, z0: z - 1.5, z1: z + 1.5 });
  }
  // benches
  for (const [x, z] of [[-70, -14], [10, -14], [90, 35], [-140, 35], [160, 85]]) {
    scene.add(box(2.4, 0.5, 0.8, 0x8a6a4a, x, 0.6, z));
  }
  // VELORA FM billboard on Beach Blvd
  const bbTex = makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#12233d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c25a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center';
    g.fillText('VELORA FM 101.2', w / 2, 58);
    g.fillStyle = '#ffffff'; g.font = '28px sans-serif';
    g.fillText('GOLDEN HOUR MIX', w / 2, 100);
  }, 512, 128);
  const bb = new T.Mesh(new T.BoxGeometry(14, 3.5, 0.4), new T.MeshLambertMaterial({ map: bbTex }));
  bb.position.set(60, 9, 118); bb.rotation.y = Math.PI; scene.add(bb);
  scene.add(cyl(0.25, 0.25, 8, 0x444444, 54, 4, 118, 6));
  scene.add(cyl(0.25, 0.25, 8, 0x444444, 66, 4, 118, 6));
}

function buildWaterfront(scene) {
  // pier at Pier 9 — wooden deck into the water (west edge)
  const pier = new T.Mesh(new T.BoxGeometry(8, 0.6, 30), mat('pierwood', 0x8a6a4a));
  pier.position.set(-212, 0.4, 95); pier.castShadow = true; pier.receiveShadow = true;
  scene.add(pier);
  // boats in the water
  for (const [x, z, c] of [[-225, 60, 0xe8e0c8], [-225, 120, 0x7fb3e8], [120, 175, 0xe8c25a], [-60, 170, 0xc96a3a]]) {
    const g = new T.Group();
    g.add(box(3, 1.2, 8, c, 0, 0.4, 0));
    g.add(cyl(0.08, 0.08, 5, 0x8a6a4a, 0, 3, 0, 6));
    g.position.set(x, 0, z); scene.add(g);
  }
  // beach umbrellas
  for (const [x, z] of [[-120, 138], [-40, 142], [40, 136], [150, 140]]) {
    scene.add(cyl(0.08, 0.08, 2.4, 0xcccccc, x, 1.2, z, 6));
    const top = new T.Mesh(new T.ConeGeometry(2.2, 1, 8), mat('umb' + x, 0xe86a92));
    top.position.set(x, 2.8, z); top.castShadow = true; scene.add(top);
  }
}

// --- day / night ---
export function setTimeOfDay(hour, playerPos) {
  world.timeOfDay = hour;
  const night = hour >= 19.5 || hour < 6.5;
  world.isNight = night;
  const t = night ? 1 : (hour >= 17 ? (hour - 17) / 2.5 : 0); // dusk blend 17:00->19:30
  const k = Math.max(0, Math.min(1, t));
  world.sun.intensity = 2.2 * (1 - k * 0.92);
  world.sun.color.setHex(k > 0.6 ? 0x8fa8ff : 0xffc27a);
  world.moon.intensity = k * 0.55;
  world.hemi.intensity = 0.9 * (1 - k * 0.62);
  for (const m of world.windowMats) m.emissiveIntensity = 0.12 + k * 1.5;
  for (const m of world.lampHeads) m.emissiveIntensity = 0.15 + k * 2.2;
  for (const m of world.neonMats) m.emissiveIntensity = 0.4 + k * 1.8;
  for (const p of world.lampPools) p.material.opacity = k * 0.22;
  for (let i = 0; i < world.playerLights.length; i++) {
    const pl = world.playerLights[i];
    pl.intensity = k * 22;
    if (playerPos) pl.position.set(playerPos.x + (i === 0 ? 2 : -2), 4, playerPos.z + (i === 0 ? 1 : -1));
  }
  if (world.sky) world.sky.material.color.setHex(night ? 0x1a2440 : 0xffffff);
  if (world.fog) world.fog.color.setHex(night ? 0x0a1428 : 0xffd9a0);
}

export function updateWorld(dt, t, playerPos) {
  if (world.water) world.water.position.y = -0.4 + Math.sin(t * 0.7) * 0.08;
  if (playerPos && world.sun) {
    world.sun.position.set(playerPos.x + 90, 150, playerPos.z + 50);
    world.sun.target.position.set(playerPos.x, 0, playerPos.z);
  }
  if (world.isNight && playerPos) setTimeOfDay(world.timeOfDay, playerPos);
}
