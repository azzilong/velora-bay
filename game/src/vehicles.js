// VELORA BAY — VEHICLES
// Detailed stylised low-poly cars: proper body shape with hood, trunk,
// cabin, glass, bumpers, mirrors, headlights and tail lights, wheels with
// tyres + rims + hubs. Front wheels steer, all wheels spin. Types:
// sedan, taxi, police, truck (lumber), van, convertible (The Golden Saw),
// armored (money truck). Returns { group, wheels, steerL, steerR, setSpeed }.
import * as THREE from '../vendor/three.module.min.js';

const MAT = {};
function mat(color, rough = 0.55, metal = 0.35) {
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
const GLASS = new THREE.MeshStandardMaterial({ color: 0x1e2e3e, roughness: 0.15, metalness: 0.7 });
const TYRE = mat(0x1a1a1a, 0.95, 0);
const RIM = mat(0xc8ccd2, 0.35, 0.8);
const CHROME = mat(0xd8dde2, 0.25, 0.9);
const LIGHT_F = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe9a0, emissiveIntensity: 0.9, roughness: 0.3 });
const LIGHT_R = new THREE.MeshStandardMaterial({ color: 0xc23a2a, emissive: 0xa02020, emissiveIntensity: 0.7, roughness: 0.3 });

function makeWheel(r = 0.36, w = 0.28) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), TYRE);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10), RIM);
  rim.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.06, 8), mat(0x8a8f96, 0.4, 0.6));
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, rim, hub);
  g.userData.spin = tyre;
  return g;
}

// opts: color, type, plate (string, drawn on a canvas texture)
export function makeCar(o = {}) {
  const color = o.color ?? 0xd8d2c4;
  const type = o.type || 'sedan';
  const paint = mat(color, 0.45, 0.4);
  const g = new THREE.Group();
  const isTruck = type === 'truck';
  const isVan = type === 'van';
  const isArmored = type === 'armored';
  const L = isTruck ? 6.4 : isVan || isArmored ? 5.6 : 4.4; // length (z axis, front = -z)
  const W = isTruck || isArmored ? 2.3 : 1.9;
  // lower body
  g.add(box(W, 0.55, L, paint, 0, 0.62, 0));
  // hood (front, lower) + trunk (rear, lower)
  g.add(box(W * 0.92, 0.22, L * 0.24, paint, 0, 0.98, -L * 0.36));
  g.add(box(W * 0.92, 0.22, L * 0.2, paint, 0, 0.98, L * 0.38));
  // cabin
  if (type === 'convertible') {
    // open top: low windshield frame + seats + roll bar
    g.add(box(W * 0.9, 0.12, 0.1, paint, 0, 1.28, -0.55));
    const glass = box(W * 0.86, 0.5, 0.06, GLASS, 0, 1.5, -0.55);
    glass.rotation.x = -0.25;
    g.add(glass);
    g.add(box(0.7, 0.5, 0.7, mat(0x6e3a1a, 0.9), -0.42, 1.05, 0.35));
    g.add(box(0.7, 0.5, 0.7, mat(0x6e3a1a, 0.9), 0.42, 1.05, 0.35));
    g.add(box(W * 0.9, 0.1, 0.12, CHROME, 0, 1.62, 0.95)); // roll bar
  } else if (isTruck) {
    // cab + flatbed with lumber
    g.add(box(W * 0.94, 1.1, 1.5, paint, 0, 1.42, -L * 0.32));
    g.add(box(W * 0.8, 0.7, 0.1, GLASS, 0, 1.55, -L * 0.32 - 0.72));
    g.add(box(W * 0.9, 0.28, L * 0.5, mat(0x8a6a4a, 0.9), 0, 1.05, L * 0.2));
    for (let i = 0; i < 3; i++) g.add(box(W * 0.8, 0.22, 0.5, mat(0xc9a06a, 0.9), 0, 1.3 + i * 0.24, L * 0.2));
  } else {
    const cab = box(W * 0.86, 0.62, L * 0.46, paint, 0, 1.2, L * 0.04);
    g.add(cab);
    const glassF = box(W * 0.8, 0.5, 0.06, GLASS, 0, 1.22, -L * 0.19);
    glassF.rotation.x = 0.18;
    g.add(glassF);
    const glassR = box(W * 0.8, 0.5, 0.06, GLASS, 0, 1.22, L * 0.27);
    glassR.rotation.x = -0.18;
    g.add(glassR);
    g.add(box(0.06, 0.44, L * 0.4, GLASS, -W * 0.44, 1.2, L * 0.04));
    g.add(box(0.06, 0.44, L * 0.4, GLASS, W * 0.44, 1.2, L * 0.04));
    if (!isVan) g.add(box(W * 0.88, 0.08, L * 0.44, paint, 0, 1.55, L * 0.04)); // roof
  }
  // bumpers
  g.add(box(W * 0.98, 0.18, 0.18, CHROME, 0, 0.42, -L / 2 - 0.02));
  g.add(box(W * 0.98, 0.18, 0.18, CHROME, 0, 0.42, L / 2 + 0.02));
  // headlights + tail lights + grille
  g.add(box(0.42, 0.16, 0.08, LIGHT_F, -W * 0.32, 0.82, -L / 2 - 0.04));
  g.add(box(0.42, 0.16, 0.08, LIGHT_F, W * 0.32, 0.82, -L / 2 - 0.04));
  g.add(box(0.4, 0.14, 0.08, LIGHT_R, -W * 0.32, 0.82, L / 2 + 0.04));
  g.add(box(0.4, 0.14, 0.08, LIGHT_R, W * 0.32, 0.82, L / 2 + 0.04));
  g.add(box(W * 0.4, 0.18, 0.06, mat(0x2a2f38, 0.5, 0.5), 0, 0.68, -L / 2 - 0.03));
  // mirrors
  g.add(box(0.16, 0.1, 0.22, paint, -W / 2 - 0.1, 1.08, -L * 0.14));
  g.add(box(0.16, 0.1, 0.22, paint, W / 2 + 0.1, 1.08, -L * 0.14));
  // door seams (thin dark boxes) + handles
  for (const s of [-1, 1]) {
    g.add(box(0.02, 0.5, 0.9, mat(0x000000, 0.9), s * (W / 2 + 0.01), 0.78, 0.1));
    g.add(box(0.04, 0.05, 0.3, CHROME, s * (W / 2 + 0.02), 1.0, -0.15));
  }
  // type extras
  if (type === 'police') {
    g.add(box(W * 0.5, 0.16, 1.1, mat(0xf5f2e8, 0.7), 0, 1.56, L * 0.04)); // roof light bar base
    g.add(box(0.5, 0.14, 0.3, new THREE.MeshStandardMaterial({ color: 0x2a6ea8, emissive: 0x2a6ea8, emissiveIntensity: 0.8 }), -0.4, 1.68, L * 0.04));
    g.add(box(0.5, 0.14, 0.3, new THREE.MeshStandardMaterial({ color: 0xc23a2a, emissive: 0xc23a2a, emissiveIntensity: 0.8 }), 0.4, 1.68, L * 0.04));
    const star = box(0.02, 0.5, 0.9, mat(0xf5f2e8, 0.7), -W / 2 - 0.01, 0.8, 0.1);
    g.add(star);
  }
  if (type === 'taxi') {
    g.add(box(W * 0.4, 0.22, 0.7, mat(0xf2b32c, 0.7), 0, 1.66, L * 0.04));
  }
  if (isArmored) {
    g.add(box(W * 0.7, 0.3, 0.4, mat(0x5a5f66, 0.5, 0.6), 0, 1.0, L * 0.3));
  }
  // licence plate
  if (o.plate) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f5f2e8'; ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 250, 58);
    ctx.fillStyle = '#1a2a4a'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.plate, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.18), new THREE.MeshBasicMaterial({ map: tex }));
    plate.position.set(0, 0.42, L / 2 + 0.12);
    g.add(plate);
    const plateF = plate.clone();
    plateF.position.set(0, 0.42, -L / 2 - 0.12);
    plateF.rotation.y = Math.PI;
    g.add(plateF);
  }
  // wheels: front steer pivots, rear fixed
  const wheels = [];
  const mkWheel = (x, z, steer) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const w = makeWheel();
    pivot.add(w);
    g.add(pivot);
    wheels.push({ pivot, wheel: w, steer });
    return pivot;
  };
  const wz = L * 0.32;
  const steerL = mkWheel(-W / 2 - 0.06, -wz, true);
  const steerR = mkWheel(W / 2 + 0.06, -wz, true);
  mkWheel(-W / 2 - 0.06, wz, false);
  mkWheel(W / 2 + 0.06, wz, false);
  return {
    group: g,
    wheels,
    steerL,
    steerR,
    length: L,
    width: W,
    setSpeed(kmh, steerAngle) {
      for (const w of wheels) w.wheel.rotation.x += (kmh / 3.6) * 0.016 * 2.4;
      steerL.rotation.y = steerAngle;
      steerR.rotation.y = steerAngle;
    },
  };
}

// The Golden Saw — Eli's gold convertible, plate VELM 001.
export function makeGoldenSaw() {
  return makeCar({ color: 0xffc93a, type: 'convertible', plate: 'VELM 001' });
}
