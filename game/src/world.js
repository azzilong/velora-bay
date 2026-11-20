// VELORA BAY — WORLD BUILDER
// Builds the whole 3D city from layout.js (the single source of truth).
// Golden-hour lighting, stylised low-poly models, canvas-texture signage.
// Exports buildWorld(scene) -> { colliders, animate }.
import * as THREE from '../vendor/three.module.min.js';
import { ROADS, BUILDINGS, POIS, GOLD_BARS, roadRect, districtAt, poi } from './layout.js';

const MAT = {};
function mat(color, rough = 0.85, metal = 0.0) {
  const k = `${color}_${rough}_${metal}`;
  if (!MAT[k]) MAT[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return MAT[k];
}
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, material, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Canvas texture for signs / billboards (generated at runtime, no network).
export function textTexture(lines, { w = 512, h = 256, bg = '#0f1c2b', fg = '#ffd76a', font = 'bold 64px Arial' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font;
  const n = lines.length;
  lines.forEach((line, i) => g.fillText(line, w / 2, h * (i + 0.5) / n));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene) {
  const colliders = [];
  const animated = { water: [] };

  // ---------- sky, sun, fog ----------
  scene.background = new THREE.Color(0xf6c98a);
  scene.fog = new THREE.Fog(0xf2d3a0, 320, 900);
  const skyGeo = new THREE.SphereGeometry(880, 24, 16);
  const skyPos = skyGeo.attributes.position;
  const skyCol = new Float32Array(skyPos.count * 3);
  const top = new THREE.Color(0x6fa8dc), mid = new THREE.Color(0xf6c98a), low = new THREE.Color(0xff9d5c);
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 880;
    const c = y > 0.25 ? top.clone().lerp(mid, 1 - (y - 0.25) / 0.75) : mid.clone().lerp(low, 1 - (y + 0.2) / 0.45);
    skyCol[i * 3] = c.r; skyCol[i * 3 + 1] = c.g; skyCol[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  // sun disc low over the ocean (south-west)
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
  sun.position.set(-420, 130, 620);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  // clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  const cloudSpots = [[-260, 210, -260], [60, 230, -330], [300, 200, 180], [-120, 240, 320], [240, 220, -140]];
  for (const [x, y, z] of cloudSpots) {
    const cl = new THREE.Group();
    cl.add(box(70, 12, 26, cloudMat, 0, 0, 0));
    cl.add(box(46, 10, 20, cloudMat, 26, 4, 6));
    cl.add(box(40, 9, 18, cloudMat, -28, 3, -4));
    cl.position.set(x, y, z);
    scene.add(cl);
  }

  // ---------- lights ----------
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sunLight.position.set(-180, 190, 260);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260; sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260; sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 900;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0x9ec8e8, 0x8a6f4d, 0.85);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xbfd9ff, 0.35);
  fill.position.set(200, 120, -180);
  scene.add(fill);

  // ---------- ground / water / beach ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(460, 340), mat(0x4a7a45, 0.95));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0); ground.receiveShadow = true;
  scene.add(ground);
  // district-tinted ground patches (subtle)
  for (const d of [{ x0: -200, x1: -70, z0: -150, z1: 150, c: 0x6b5a44 }, { x0: 70, x1: 200, z0: -150, z1: -60, c: 0x5a5f66 }, { x0: 70, x1: 200, z0: -60, z1: 60, c: 0x4d6b52 }, { x0: -70, x1: 70, z0: -60, z1: 60, c: 0x556b43 }]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0), mat(d.c, 0.95));
    p.rotation.x = -Math.PI / 2; p.position.set((d.x0 + d.x1) / 2, 0.0, (d.z0 + d.z1) / 2); p.receiveShadow = true;
    scene.add(p);
  }
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a7f9e, roughness: 0.25, metalness: 0.35, transparent: true, opacity: 0.92 });
  for (const [x, z, w, d] of [[-230, 0, 60, 340], [230, 0, 60, 340], [0, 180, 520, 60]]) {
    const wtr = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMat);
    wtr.rotation.x = -Math.PI / 2; wtr.position.set(x, -0.4, z);
    scene.add(wtr);
    animated.water.push(wtr);
  }
  // beach sand
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 42), mat(0xe8d9a0, 0.95));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 131); sand.receiveShadow = true;
  scene.add(sand);
  const sandWest = new THREE.Mesh(new THREE.PlaneGeometry(12, 300), mat(0xe8d9a0, 0.95));
  sandWest.rotation.x = -Math.PI / 2; sandWest.position.set(-196, 0.02, 0); sandWest.receiveShadow = true;
  scene.add(sandWest);

  // ---------- roads + sidewalks + markings ----------
  const asphalt = mat(0x484d59, 0.95);
  const walkMat = mat(0xb8b0a0, 0.95);
  const dashMat = mat(0xe8c25a, 0.8);
  const whiteMat = mat(0xf5f2e8, 0.8);
  for (const r of ROADS) {
    const rr = roadRect(r);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(rr.x1 - rr.x0, rr.z1 - rr.z0), asphalt);
    road.rotation.x = -Math.PI / 2; road.position.set((rr.x0 + rr.x1) / 2, 0.03, (rr.z0 + rr.z1) / 2);
    road.receiveShadow = true;
    scene.add(road);
    // sidewalks both sides
    if (r.axis === 'v') {
      for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(r.side, r.to - r.from), walkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(r.at + s * (r.half + r.side / 2), 0.05, (r.from + r.to) / 2);
        sw.receiveShadow = true;
        scene.add(sw);
      }
    } else {
      for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(r.to - r.from, r.side), walkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set((r.from + r.to) / 2, 0.05, r.at + s * (r.half + r.side / 2));
        sw.receiveShadow = true;
        scene.add(sw);
      }
    }
    // dashed centre line
    const len = r.to - r.from;
    const n = Math.floor(len / 9);
    for (let i = 0; i < n; i++) {
      const t = r.from + 4.5 + i * 9;
      const dash = box(r.axis === 'v' ? 0.35 : 4, 0.02, r.axis === 'v' ? 4 : 0.35, dashMat);
      dash.position.set(r.axis === 'v' ? r.at : t, 0.05, r.axis === 'v' ? t : r.at);
      dash.castShadow = false;
      scene.add(dash);
    }
  }
  // crosswalks at every V x H intersection
  const crossGeo = new THREE.BoxGeometry(0.9, 0.02, 3.4);
  const crossMesh = new THREE.InstancedMesh(crossGeo, whiteMat, 25 * 4 * 4);
  {
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
    let idx = 0;
    for (const v of ROADS.filter((r) => r.axis === 'v')) {
      for (const h of ROADS.filter((r) => r.axis === 'h')) {
        for (let k = -2; k <= 1; k++) {
          q.setFromAxisAngle(up, 0);
          m4.compose(new THREE.Vector3(v.at + k * 2.2, 0.05, h.at - v.half - 1.2), q, new THREE.Vector3(1, 1, 1));
          crossMesh.setMatrixAt(idx++, m4);
          m4.compose(new THREE.Vector3(v.at + k * 2.2, 0.05, h.at + v.half + 1.2), q, new THREE.Vector3(1, 1, 1));
          crossMesh.setMatrixAt(idx++, m4);
          q.setFromAxisAngle(up, Math.PI / 2);
          m4.compose(new THREE.Vector3(v.at - h.half - 1.2, 0.05, h.at + k * 2.2), q, new THREE.Vector3(1, 1, 1));
          crossMesh.setMatrixAt(idx++, m4);
          m4.compose(new THREE.Vector3(v.at + h.half + 1.2, 0.05, h.at + k * 2.2), q, new THREE.Vector3(1, 1, 1));
          crossMesh.setMatrixAt(idx++, m4);
        }
      }
    }
    crossMesh.count = idx;
    crossMesh.receiveShadow = true;
    scene.add(crossMesh);
  }

  // ---------- buildings ----------
  const windowGeo = new THREE.BoxGeometry(1.4, 1.8, 0.15);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.25, metalness: 0.5, emissive: 0x1a2a3a, emissiveIntensity: 0.4 });
  const winTransforms = [];
  const roofGeo = new THREE.ConeGeometry(1, 1, 4);
  const roofMat = mat(0x8a4a3a, 0.9);
  const darkRoof = mat(0x4a4f58, 0.9);
  for (const b of BUILDINGS) {
    const g = new THREE.Group();
    const bodyMat = b.type === 'tower'
      ? new THREE.MeshStandardMaterial({ color: 0x9fc4e8, roughness: 0.25, metalness: 0.6 })
      : (b.color ? mat(b.color, 0.85) : mat(0xe8dcc3, 0.85));
    const body = box(b.w, b.h, b.d, bodyMat, 0, b.h / 2, 0);
    g.add(body);
    if (b.type === 'tower') {
      // Hale Tower: gold crown + antenna + sign (body is already glass)
      g.add(box(b.w * 0.5, 2, b.d * 0.5, mat(0xffd76a, 0.4, 0.7), 0, b.h + 1, 0));
      g.add(cyl(0.3, 0.3, 14, mat(0x666666, 0.6, 0.5), 0, b.h + 9, 0));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4), new THREE.MeshBasicMaterial({ map: textTexture(['HALE TOWER'], { w: 512, h: 128, bg: '#101820', fg: '#9fc4e8', font: 'bold 72px Arial' }) }));
      sign.position.set(0, b.h - 4, b.d / 2 + 0.2);
      g.add(sign);
    } else if (b.type === 'civic') {
      // columns + pediment for City Hall / Debate Hall / VBPD
      const colMat = mat(0xf5efe0, 0.8);
      const n = Math.max(3, Math.floor(b.w / 7));
      for (let i = 0; i < n; i++) {
        const cx = -b.w / 2 + 3 + (i * (b.w - 6)) / (n - 1);
        g.add(cyl(0.7, 0.8, b.h * 0.7, colMat, cx, b.h * 0.35, b.d / 2 + 0.6, 10));
      }
      g.add(box(b.w + 2, 1.2, b.d + 1.4, mat(0xd8cba8, 0.85), 0, b.h + 0.4, 0));
      if (b.poi === 'cityhall') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffd76a, 0.35, 0.6));
        dome.position.set(0, b.h + 1, 0); dome.castShadow = true;
        g.add(dome);
        g.add(cyl(0.2, 0.2, 5, mat(0x8a6a2a, 0.5, 0.5), 0, b.h + 8, 0));
      }
    } else if (b.type === 'house' || b.type === 'hut') {
      // pitched pyramid roof
      const roof = new THREE.Mesh(roofGeo, b.type === 'hut' ? mat(0xd8b878, 0.9) : roofMat);
      const s = (b.type === 'hut' ? Math.max(b.w, b.d) * 0.62 : Math.max(b.w, b.d) * 0.78);
      roof.scale.set(s, b.h * 0.32 + 1.5, s);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = b.h + (b.h * 0.32 + 1.5) / 2;
      roof.castShadow = true;
      g.add(roof);
    } else {
      // flat roof slab + AC boxes
      g.add(box(b.w * 0.9, 0.8, b.d * 0.9, darkRoof, 0, b.h + 0.4, 0));
      g.add(box(2.4, 1.2, 2.4, mat(0x9aa2ab, 0.7, 0.3), b.w * 0.22, b.h + 1.4, -b.d * 0.18));
    }
    // shopfront awning for ground-floor shops in the centre
    if (b.district === 'center' && b.type === 'house' && b.h < 14) {
      const awn = box(b.w * 0.7, 0.3, 3, mat(0xe86a92, 0.85), 0, 3.4, b.d / 2 + 1.2);
      awn.rotation.x = 0.25;
      g.add(awn);
    }
    // windows on front and back faces
    const floors = Math.max(1, Math.floor(b.h / 4));
    const cols = Math.max(1, Math.floor(b.w / 4.5));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wx = -b.w / 2 + 2.4 + (c * (b.w - 4.8)) / Math.max(1, cols - 1);
        const wy = 3.2 + f * 3.6;
        if (wy > b.h - 1.2) continue;
        for (const s of [1, -1]) {
          winTransforms.push({ x: wx, y: wy, z: (b.d / 2 + 0.1) * s, ry: s > 0 ? 0 : Math.PI, bx: b.x, bz: b.z });
        }
      }
    }
    g.position.set(b.x, 0, b.z);
    scene.add(g);
    colliders.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
  }
  const winMesh = new THREE.InstancedMesh(windowGeo, windowMat, winTransforms.length);
  {
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
    winTransforms.forEach((w, i) => {
      q.setFromAxisAngle(up, w.ry);
      m4.compose(new THREE.Vector3(w.bx + w.x, w.y, w.bz + w.z), q, new THREE.Vector3(1, 1, 1));
      winMesh.setMatrixAt(i, m4);
    });
  }
  scene.add(winMesh);

  // ---------- POI structures ----------
  // City Hall fountain (plaza, not a building)
  {
    const f = poi('fountain');
    const base = cyl(4.2, 4.6, 1.1, mat(0xd8d2c4, 0.8), f.x, 0.55, f.z, 16);
    const water = cyl(3.6, 3.6, 0.3, new THREE.MeshStandardMaterial({ color: 0x4db3cc, roughness: 0.2, metalness: 0.3 }), f.x, 1.05, f.z, 16);
    const spout = cyl(0.5, 0.7, 2.2, mat(0xd8d2c4, 0.8), f.x, 2, f.z, 8);
    scene.add(base, water, spout);
    colliders.push({ x0: f.x - 4.6, x1: f.x + 4.6, z0: f.z - 4.6, z1: f.z + 4.6 });
  }
  // Pier 9: wooden deck into the harbour + posts + crates
  {
    const p = poi('pier9');
    const deck = box(8, 0.8, 62, mat(0x8a6a4a, 0.9), p.x, 0.6, p.z);
    scene.add(deck);
    for (let i = 0; i < 8; i++) {
      scene.add(cyl(0.35, 0.35, 3.4, mat(0x6e5238, 0.9), p.x - 3.4, -0.6, p.z - 28 + i * 8, 6));
      scene.add(cyl(0.35, 0.35, 3.4, mat(0x6e5238, 0.9), p.x + 3.4, -0.6, p.z - 28 + i * 8, 6));
    }
    scene.add(box(2.2, 2.2, 2.2, mat(0xc9a06a, 0.9), p.x - 1.5, 1.9, p.z - 24));
    scene.add(box(1.8, 1.8, 1.8, mat(0x9a7b5f, 0.9), p.x + 1.8, 1.7, p.z - 20));
    colliders.push({ x0: p.x - 4, x1: p.x + 4, z0: p.z - 31, z1: p.z + 31 });
  }
  // Marina docks + yachts
  {
    const m = poi('marina');
    const dock = box(6, 0.8, 50, mat(0xd8d2c4, 0.85), m.x, 0.6, m.z);
    scene.add(dock);
    const yacht = (x, z, ry) => {
      const y = new THREE.Group();
      const hull = box(3.4, 1.6, 9, mat(0xf5f2e8, 0.6), 0, 0.6, 0);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.4, 4), mat(0xf5f2e8, 0.6));
      bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.5);
      bow.position.set(0, 0.6, -6); bow.castShadow = true;
      const cabin = box(2.4, 1.6, 4, mat(0xe8eef2, 0.5), 0, 2, 0.5);
      const mast = cyl(0.12, 0.12, 7, mat(0x8a8f96, 0.5, 0.4), 0, 5.5, 0);
      y.add(hull, bow, cabin, mast);
      y.position.set(x, -0.2, z); y.rotation.y = ry;
      scene.add(y);
    };
    yacht(206, -2, Math.PI / 2); yacht(206, 22, Math.PI / 2); yacht(206, 44, Math.PI / 2);
  }
  // Construction site: 2 cranes, scaffolding, containers, dirt patch
  {
    const c = poi('construct');
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), mat(0x9a7b52, 0.95));
    dirt.rotation.x = -Math.PI / 2; dirt.position.set(c.x, 0.06, c.z); dirt.receiveShadow = true;
    scene.add(dirt);
    const crane = (x, z, h) => {
      const g = new THREE.Group();
      const yellow = mat(0xf2b32c, 0.7, 0.2);
      g.add(box(2, h, 2, yellow, 0, h / 2, 0));
      g.add(box(16, 1.4, 1.4, yellow, 6, h, 0));
      g.add(box(7, 1.4, 1.4, yellow, -6.5, h, 0));
      g.add(box(2.6, 2.6, 2.6, mat(0x3a3f4a, 0.8), 0, h + 1.6, 0));
      g.add(box(2, 2, 2, mat(0x6e5238, 0.8), -8.5, h - 2.4, 0));
      const cable = cyl(0.06, 0.06, 9, mat(0x222222, 0.6), 12, h - 4.5, 0, 4);
      g.add(cable);
      g.add(box(1.6, 1.2, 1.6, mat(0x8a4a3a, 0.8), 12, h - 9.6, 0));
      g.position.set(x, 0, z);
      scene.add(g);
      colliders.push({ x0: x - 1.4, x1: x + 1.4, z0: z - 1.4, z1: z + 1.4 });
    };
    crane(c.x - 12, c.z - 4, 26);
    crane(c.x + 14, c.z + 6, 30);
    for (const [x, z, col] of [[c.x - 6, c.z + 10, 0x2a6ea8], [c.x + 2, c.z + 10, 0xd86a2a], [c.x + 10, c.z - 8, 0x4a8a4a]]) {
      scene.add(box(6, 2.6, 2.6, mat(col, 0.8), x, 1.3, z));
    }
    // scaffolding frame
    const scaf = new THREE.Group();
    for (let i = 0; i < 4; i++) scaf.add(cyl(0.18, 0.18, 12, mat(0xc9a13a, 0.6, 0.3), -8 + i * 5.4, 6, 0, 6));
    scaf.add(box(18, 0.3, 3, mat(0x8a6a4a, 0.85), 0, 6, 0));
    scaf.add(box(18, 0.3, 3, mat(0x8a6a4a, 0.85), 0, 11.5, 0));
    scaf.position.set(c.x + 2, 0, c.z - 10);
    scene.add(scaf);
  }
  // Lumber yard: stacked timber + containers
  {
    const l = poi('lumber');
    for (let i = 0; i < 5; i++) {
      scene.add(box(8, 0.9, 1.4, mat(0xc9a06a, 0.9), l.x - 8, 0.9 + i * 0.95, l.z - 6));
      scene.add(box(8, 0.9, 1.4, mat(0xb98a5e, 0.9), l.x + 6, 0.9 + i * 0.95, l.z + 4));
    }
    scene.add(box(6, 2.6, 2.6, mat(0x2a6ea8, 0.8), l.x + 10, 1.3, l.z - 8));
  }
  // Night market: stalls with striped awnings + string lights
  {
    const m = poi('market');
    const stallCols = [0xe86a92, 0x2fb3a3, 0xf2b32c, 0x7fb3e8];
    for (let i = 0; i < 8; i++) {
      const sx = m.x - 16 + (i % 4) * 10.5;
      const sz = m.z - 5 + Math.floor(i / 4) * 11;
      const g = new THREE.Group();
      g.add(box(6, 2.4, 4, mat(0x8a6a4a, 0.9), 0, 1.2, 0));
      const awn = box(6.6, 0.25, 4.6, mat(stallCols[i % 4], 0.85), 0, 2.9, 0);
      awn.rotation.x = 0.12;
      g.add(awn);
      for (let k = 0; k < 3; k++) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
        bulb.position.set(-2 + k * 2, 2.7, 2.2);
        g.add(bulb);
      }
      g.position.set(sx, 0, sz);
      scene.add(g);
      colliders.push({ x0: sx - 3.3, x1: sx + 3.3, z0: sz - 2.3, z1: sz + 2.3 });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.4), new THREE.MeshBasicMaterial({ map: textTexture(['NIGHT MARKET'], { w: 512, h: 128, bg: '#241a2e', fg: '#ff9ecf', font: 'bold 64px Arial' }) }));
    sign.position.set(m.x, 6.5, m.z - 11.5);
    scene.add(sign);
  }
  // Workshop sign + yard crates
  {
    const w = poi('workshop');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshBasicMaterial({ map: textTexture(["BRADDOCK & SONS"], { w: 512, h: 128, bg: '#3a2a1a', fg: '#ffd76a', font: 'bold 56px Arial' }) }));
    sign.position.set(w.x + w.w / 2 + 0.2, 7.5, w.z);
    sign.rotation.y = Math.PI / 2;
    scene.add(sign);
    scene.add(box(2, 2, 2, mat(0xc9a06a, 0.9), w.x + 8, 1, w.z + 12));
    scene.add(box(1.6, 1.6, 1.6, mat(0xb98a5e, 0.9), w.x + 10.4, 0.8, w.z + 11));
  }
  // Billboards: VELORA FM 101.2 on Beach Blvd, HALE CASINO in Marina
  const billboard = (x, z, ry, lines, bg, fg) => {
    const g = new THREE.Group();
    g.add(box(0.8, 9, 0.8, mat(0x4a4f58, 0.8), -5, 4.5, 0));
    g.add(box(0.8, 9, 0.8, mat(0x4a4f58, 0.8), 5, 4.5, 0));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: textTexture(lines, { w: 512, h: 256, bg, fg, font: 'bold 72px Arial' }) }));
    panel.position.set(0, 11.5, 0.3);
    g.add(panel);
    const back = box(14, 7, 0.3, mat(0x2a2f38, 0.85), 0, 11.5, 0);
    g.add(back);
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g);
    colliders.push({ x0: x - 5.6, x1: x + 5.6, z0: z - 0.8, z1: z + 0.8 });
  };
  billboard(-60, 92, 0, ['VELORA FM', '101.2'], '#0f1c2b', '#ffd76a');
  billboard(120, -108, Math.PI, ['HALE', 'CASINO'], '#101820', '#9fc4e8');

  // ---------- palms ----------
  const palmTrunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 7, 7);
  const palmTrunkMat = mat(0x8a6a4a, 0.9);
  const palmFrondGeo = new THREE.ConeGeometry(0.9, 5.4, 4);
  palmFrondGeo.scale(1, 1, 0.22);
  const palmFrondMat = mat(0x3f9a4d, 0.9);
  const palmSpots = [];
  for (let x = -180; x <= 180; x += 24) {
    palmSpots.push([x + 4, 93]); palmSpots.push([x + 16, 107]);
  }
  for (let x = -180; x <= 180; x += 30) palmSpots.push([x, 120 + ((x * 7) % 13)]);
  for (let x = 80; x <= 190; x += 26) palmSpots.push([x, -40 + ((x * 3) % 7)]);
  for (let i = 0; i < 14; i++) palmSpots.push([-190 + (i % 7) * 8, -120 + Math.floor(i / 7) * 60]);
  const trunks = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmSpots.length);
  const fronds = new THREE.InstancedMesh(palmFrondGeo, palmFrondMat, palmSpots.length * 6);
  {
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1); const up = new THREE.Vector3(0, 1, 0);
    palmSpots.forEach(([x, z], i) => {
      const lean = Math.sin(i * 2.3) * 0.06;
      q.setFromAxisAngle(zAxis, lean);
      m4.compose(new THREE.Vector3(x, 3.5, z), q, new THREE.Vector3(1, 1, 1));
      trunks.setMatrixAt(i, m4);
      for (let f = 0; f < 6; f++) {
        const fq = new THREE.Quaternion().setFromAxisAngle(up, (f / 6) * Math.PI * 2 + i * 0.7);
        fq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.35));
        m4.compose(new THREE.Vector3(x, 7.2, z), fq, new THREE.Vector3(1.5, 1.5, 1.5));
        fronds.setMatrixAt(i * 6 + f, m4);
      }
    });
  }
  trunks.castShadow = true; fronds.castShadow = true;
  scene.add(trunks, fronds);

  // ---------- streetlights (instanced) ----------
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.5, 6);
  const poleMat = mat(0x2f3540, 0.7, 0.3);
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  const lightSpots = [];
  for (const r of ROADS) {
    const len = r.to - r.from;
    const n = Math.floor(len / 34);
    for (let i = 0; i <= n; i++) {
      const t = r.from + 10 + (i * (len - 20)) / Math.max(1, n);
      const side = i % 2 === 0 ? 1 : -1;
      if (r.axis === 'v') lightSpots.push([r.at + side * (r.half + 1.6), t]);
      else lightSpots.push([t, r.at + side * (r.half + r.side / 2 + 0.6)]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lightSpots.length);
  {
    const m4 = new THREE.Matrix4();
    lightSpots.forEach(([x, z], i) => {
      m4.makeTranslation(x, 3.25, z); poles.setMatrixAt(i, m4);
      m4.makeTranslation(x, 6.6, z); lamps.setMatrixAt(i, m4);
    });
  }
  poles.castShadow = true;
  scene.add(poles, lamps);

  // ---------- round trees in the centre plaza ----------
  const treeSpots = [[-52, 38], [-18, 40], [-52, 8], [-18, 6], [52, 40], [18, 42], [52, 8], [120, 40], [150, 10]];
  for (const [x, z] of treeSpots) {
    const g = new THREE.Group();
    g.add(cyl(0.3, 0.45, 3.2, mat(0x6e5238, 0.9), 0, 1.6, 0, 7));
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), mat(0x4d8a3f, 0.9));
    canopy.position.set(0, 4.6, 0); canopy.castShadow = true;
    g.add(canopy);
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 });
  }

  // ---------- gold bars (collectibles) ----------
  const barGeo = new THREE.BoxGeometry(0.9, 0.28, 0.5);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.25, metalness: 0.9, emissive: 0x7a5c00, emissiveIntensity: 0.5 });
  const bars = new THREE.InstancedMesh(barGeo, barMat, GOLD_BARS.length);
  {
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const up = new THREE.Vector3(0, 1, 0);
    GOLD_BARS.forEach((g, i) => {
      q.setFromAxisAngle(up, i * 0.7);
      m4.compose(new THREE.Vector3(g.x, 0.9 + Math.sin(i) * 0.15, g.z), q, new THREE.Vector3(1, 1, 1));
      bars.setMatrixAt(i, m4);
    });
  }
  scene.add(bars);

  return {
    colliders,
    goldBarMesh: bars,
    sunLight,
    hemi,
    sky,
    sunDisc: sun,
    cloudMat,
    animate(t) {
      for (const w of animated.water) w.position.y = -0.4 + Math.sin(t * 0.5 + w.position.x) * 0.08;
    },
  };
}
