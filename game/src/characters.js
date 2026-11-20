// VELORA BAY — CHARACTERS
// Articulated low-poly figures: separate head, torso, arms, legs, hands,
// feet, hair/hat. Walk/run animation by swinging limbs. Eli is the
// protagonist: carpenter outfit (navy shirt, brown apron, gold cap),
// hammer on his back. Barnaby is a German Shepherd: tan body, dark back,
// pointed ears, tail.
import * as THREE from '../vendor/three.module.min.js';

const MAT = {};
function mat(color, rough = 0.85, metal = 0.0) {
  const k = `${color}_${rough}_${metal}`;
  if (!MAT[k]) MAT[k] = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  return MAT[k];
}
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function sph(r, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

// Build a humanoid. opts: skin, shirt, pants, hair, hairStyle ('cap','long','bun','mohawk','none','helmet','bandana'), apron, vest, jacket, skirt, scale, female.
// Returns { group, head, armL, armR, legL, legR, torso, handR }.
// Limbs pivot at the shoulder/hip: each limb group is positioned at the
// joint and the mesh hangs below it, so rotation.x swings it naturally.
export function makeHumanoid(o = {}) {
  const s = o.scale || 1;
  const skin = mat(o.skin || 0xd9a066);
  const shirt = mat(o.shirt || 0x2a4a6a);
  const pants = mat(o.pants || 0x3a3f4a);
  const hairM = mat(o.hair || 0x2a1a0e);
  const g = new THREE.Group();
  const torso = box(0.62, 0.72, 0.36, shirt, 0, 1.18, 0);
  g.add(torso);
  if (o.apron) g.add(box(0.5, 0.6, 0.06, mat(0x8a6a4a, 0.9), 0, 1.12, 0.2));
  if (o.vest) g.add(box(0.66, 0.5, 0.4, mat(o.vest, 0.85), 0, 1.3, 0));
  if (o.jacket) g.add(box(0.68, 0.74, 0.42, mat(o.jacket, 0.85), 0, 1.18, 0));
  // belt
  g.add(box(0.64, 0.08, 0.38, mat(0x1a1a1a, 0.8), 0, 0.86, 0));
  // head
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0);
  head.add(sph(0.26, skin, 0, 0.06, 0, 0.95, 1.05, 0.95));
  head.add(sph(0.05, mat(0x1a1a1a), -0.09, 0.08, 0.22));
  head.add(sph(0.05, mat(0x1a1a1a), 0.09, 0.08, 0.22));
  head.add(box(0.1, 0.05, 0.08, skin, 0, -0.02, 0.26));
  const hs = o.hairStyle || 'short';
  if (hs === 'short') head.add(sph(0.27, hairM, 0, 0.16, -0.02, 1, 0.6, 1));
  if (hs === 'cap') {
    head.add(sph(0.27, hairM, 0, 0.14, -0.02, 1, 0.55, 1));
    head.add(box(0.4, 0.05, 0.3, mat(o.capColor || 0xffd76a, 0.7), 0, 0.24, 0.28));
    head.add(sph(0.28, mat(o.capColor || 0xffd76a, 0.7), 0, 0.18, 0, 1, 0.5, 1));
  }
  if (hs === 'long') {
    head.add(sph(0.27, hairM, 0, 0.14, -0.04, 1, 0.7, 1));
    head.add(box(0.3, 0.5, 0.16, hairM, 0, -0.14, -0.2));
  }
  if (hs === 'bun') {
    head.add(sph(0.27, hairM, 0, 0.14, -0.02, 1, 0.6, 1));
    head.add(sph(0.12, hairM, 0, 0.36, -0.1));
  }
  if (hs === 'bandana') {
    head.add(sph(0.27, hairM, 0, 0.14, -0.02, 1, 0.55, 1));
    head.add(box(0.54, 0.1, 0.54, mat(0xc23a2a, 0.85), 0, 0.22, 0));
  }
  if (hs === 'helmet') {
    head.add(sph(0.3, mat(0x1a2a4a, 0.5, 0.3), 0, 0.08, 0, 1, 0.95, 1));
    head.add(box(0.5, 0.06, 0.3, mat(0x1a2a4a, 0.5, 0.3), 0, 0.1, 0.28));
  }
  if (hs === 'mohawk') {
    head.add(box(0.1, 0.22, 0.4, mat(0xc23a2a, 0.85), 0, 0.3, 0));
  }
  if (hs === 'afro') head.add(sph(0.32, hairM, 0, 0.14, 0, 1, 0.9, 1));
  g.add(head);
  // arms (pivot at shoulder y=1.5)
  function arm(side) {
    const a = new THREE.Group();
    a.position.set(side * 0.38, 1.5, 0);
    a.add(box(0.2, 0.62, 0.22, shirt, 0, -0.28, 0));
    const hand = new THREE.Group();
    hand.position.set(0, -0.6, 0);
    hand.add(sph(0.11, skin, 0, 0, 0));
    a.add(hand);
    g.add(a);
    return { pivot: a, hand };
  }
  const armL = arm(-1), armR = arm(1);
  // legs (pivot at hip y=0.82)
  function leg(side) {
    const l = new THREE.Group();
    l.position.set(side * 0.17, 0.84, 0);
    l.add(box(0.22, 0.78, 0.24, pants, 0, -0.4, 0));
    l.add(box(0.24, 0.12, 0.36, mat(0x2a2118, 0.85), 0, -0.82, 0.05));
    g.add(l);
    return l;
  }
  const legL = leg(-1), legR = leg(1);
  g.scale.setScalar(s);
  return { group: g, head, torso, armL, armR, legL, legR };
}

// Walk/run cycle: phase advances with distance; amplitude scales with speed.
export function animateWalk(fig, phase, amount = 1) {
  const s = Math.sin(phase) * 0.55 * amount;
  const c = Math.sin(phase + Math.PI) * 0.55 * amount;
  fig.legL.rotation.x = s;
  fig.legR.rotation.x = c;
  fig.armL.pivot.rotation.x = c * 0.8;
  fig.armR.pivot.rotation.x = s * 0.8;
  fig.group.position.y = Math.abs(Math.sin(phase)) * 0.05 * amount;
}

// Eli Braddock — carpenter, navy shirt, brown apron, gold cap, hammer on back.
export function makeEli() {
  const fig = makeHumanoid({ shirt: 0x2a4a6a, pants: 0x4a3a28, hair: 0x3a2410, hairStyle: 'cap', capColor: 0xffd76a, apron: true, skin: 0xd9a066 });
  // hammer slung on the back
  const hammer = new THREE.Group();
  hammer.add(box(0.09, 0.62, 0.09, mat(0x8a6a4a, 0.85), 0, 0, 0));
  hammer.add(box(0.34, 0.14, 0.14, mat(0x5a5f66, 0.6, 0.5), 0, 0.34, 0));
  hammer.rotation.z = 0.5;
  hammer.position.set(0.1, 1.25, -0.26);
  fig.group.add(hammer);
  fig.hammer = hammer;
  // held-weapon meshes (swapped by setWeapon): hammer / pistol / rifle
  const held = {};
  const h2 = new THREE.Group();
  h2.add(box(0.08, 0.55, 0.08, mat(0x8a6a4a, 0.85), 0, 0.1, 0));
  h2.add(box(0.3, 0.12, 0.12, mat(0x5a5f66, 0.6, 0.5), 0, 0.4, 0));
  h2.rotation.x = -Math.PI / 2.4;
  held.hammer = h2;
  const p = new THREE.Group();
  p.add(box(0.07, 0.16, 0.26, mat(0x2a2f38, 0.5, 0.5), 0, 0.02, 0.08));
  p.add(box(0.06, 0.12, 0.08, mat(0x2a2f38, 0.5, 0.5), 0, -0.08, 0));
  p.rotation.x = -Math.PI / 2;
  held.pistol = p;
  const r = new THREE.Group();
  r.add(box(0.07, 0.1, 0.85, mat(0x3a2f28, 0.7), 0, 0, 0.1));
  r.add(box(0.06, 0.14, 0.3, mat(0x2a2f38, 0.5, 0.5), 0, 0.02, -0.28));
  r.rotation.x = -Math.PI / 2;
  held.rifle = r;
  for (const k of Object.keys(held)) {
    held[k].position.set(0, -0.05, 0.08);
    held[k].visible = false;
    fig.armR.hand.add(held[k]);
  }
  held.hammer.visible = true;
  fig.held = held;
  fig.setWeapon = (w) => {
    for (const k of Object.keys(held)) held[k].visible = false;
    if (w === 'hammer') held.hammer.visible = true;
    if (w === 'pistol') held.pistol.visible = true;
    if (w === 'rifle') held.rifle.visible = true;
    fig.hammer.visible = w !== 'hammer';
  };
  return fig;
}

export function makeTommy() {
  return makeHumanoid({ shirt: 0x4a6a2a, pants: 0x2a2f38, hair: 0x1a1a1a, hairStyle: 'bandana', skin: 0x8a5a34, scale: 1.06 });
}
export function makeRosa() {
  return makeHumanoid({ shirt: 0xd86a2a, pants: 0x2a2f38, hair: 0x1a0e08, hairStyle: 'long', skin: 0xc98a5e, scale: 0.96 });
}
export function makeNadia() {
  return makeHumanoid({ shirt: 0xf5efe0, pants: 0x1a2a4a, hair: 0x4a2a10, hairStyle: 'bun', skin: 0xe8b88a, scale: 0.97, jacket: 0x1a2a4a });
}
export function makeMarv() {
  return makeHumanoid({ shirt: 0x8a2a2a, pants: 0x2a2f38, hair: 0x0e0e0e, hairStyle: 'afro', skin: 0x5a3a22, scale: 1.14, vest: 0x2a2f38 });
}
export function makeDina() {
  return makeHumanoid({ shirt: 0x2fb3a3, pants: 0x1a1a1a, hair: 0x0e0e0e, hairStyle: 'long', skin: 0xb87a4e, scale: 0.95 });
}
export function makeKofi() {
  return makeHumanoid({ shirt: 0xe8dcc3, pants: 0x5a5f66, hair: 0xd8d2c4, hairStyle: 'short', skin: 0x6a4a2e, scale: 0.98 });
}
export function makeHale() {
  return makeHumanoid({ shirt: 0xf5efe0, pants: 0x1a1a1a, hair: 0x8a8a8a, hairStyle: 'short', skin: 0xe8b88a, scale: 1.02, jacket: 0x1a1a1a });
}
export function makePolice() {
  return makeHumanoid({ shirt: 0x1a2a4a, pants: 0x1a2a4a, hair: 0x1a1a1a, hairStyle: 'helmet', skin: 0xd9a066, vest: 0x0f1c2b });
}
export function makeThug() {
  return makeHumanoid({ shirt: 0x2a2f38, pants: 0x1a1a1a, hair: 0x0e0e0e, hairStyle: 'mohawk', skin: 0xc98a5e });
}
export function makePedestrian(seed = 0) {
  const palettes = [
    { shirt: 0xe86a92, pants: 0x3a3f4a, hair: 0x2a1a0e, hairStyle: 'long', skin: 0xd9a066, scale: 0.95 },
    { shirt: 0x2fb3a3, pants: 0x6a5a3a, hair: 0x0e0e0e, hairStyle: 'short', skin: 0x8a5a34, scale: 1.0 },
    { shirt: 0xf2b32c, pants: 0x2a4a6a, hair: 0x8a8a8a, hairStyle: 'short', skin: 0xe8b88a, scale: 1.02 },
    { shirt: 0x7fb3e8, pants: 0x1a1a1a, hair: 0x4a2a10, hairStyle: 'bun', skin: 0xc98a5e, scale: 0.94 },
    { shirt: 0x4a8a4a, pants: 0x3a3f4a, hair: 0x1a1a1a, hairStyle: 'cap', capColor: 0xe86a92, skin: 0x5a3a22, scale: 1.05 },
    { shirt: 0xd86a2a, pants: 0x2a2f38, hair: 0xd8d2c4, hairStyle: 'short', skin: 0xe8b88a, scale: 0.98 },
  ];
  return makeHumanoid(palettes[seed % palettes.length]);
}

// Barnaby — German Shepherd: tan body, dark saddle, pointed ears, tail.
// Returns { group, head, legFL, legFR, legBL, legBR, tail, bark }.
export function makeBarnaby() {
  const tan = mat(0xc98a4b, 0.9);
  const dark = mat(0x3a2a1a, 0.9);
  const g = new THREE.Group();
  const body = box(0.55, 0.5, 1.05, tan, 0, 0.62, 0);
  g.add(body);
  g.add(box(0.56, 0.24, 0.7, dark, 0, 0.82, -0.05)); // saddle
  const head = new THREE.Group();
  head.position.set(0, 0.92, 0.62);
  head.add(sph(0.24, tan, 0, 0, 0, 0.9, 0.9, 1));
  head.add(box(0.2, 0.16, 0.34, tan, 0, -0.06, 0.26)); // snout
  head.add(box(0.08, 0.06, 0.08, mat(0x1a1a1a, 0.8), 0, -0.03, 0.44)); // nose
  head.add(sph(0.045, mat(0x1a1a1a), -0.09, 0.06, 0.2));
  head.add(sph(0.045, mat(0x1a1a1a), 0.09, 0.06, 0.2));
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), dark);
  earL.position.set(-0.13, 0.26, 0); earL.rotation.z = 0.2; earL.castShadow = true;
  const earR = earL.clone(); earR.position.x = 0.13; earR.rotation.z = -0.2;
  head.add(earL, earR);
  g.add(head);
  const tail = new THREE.Group();
  tail.position.set(0, 0.78, -0.55);
  const tailMesh = box(0.12, 0.12, 0.5, dark, 0, 0.12, -0.2);
  tailMesh.rotation.x = -0.7;
  tail.add(tailMesh);
  g.add(tail);
  function leg(x, z) {
    const l = new THREE.Group();
    l.position.set(x, 0.42, z);
    l.add(box(0.13, 0.42, 0.13, tan, 0, -0.2, 0));
    g.add(l);
    return l;
  }
  const legFL = leg(-0.2, 0.36), legFR = leg(0.2, 0.36), legBL = leg(-0.2, -0.38), legBR = leg(0.2, -0.38);
  return {
    group: g, head, legFL, legFR, legBL, legBR, tail,
    animate(phase, amount = 1) {
      legFL.rotation.x = Math.sin(phase) * 0.5 * amount;
      legBR.rotation.x = Math.sin(phase) * 0.5 * amount;
      legFR.rotation.x = Math.sin(phase + Math.PI) * 0.5 * amount;
      legBL.rotation.x = Math.sin(phase + Math.PI) * 0.5 * amount;
      tail.rotation.y = Math.sin(phase * 0.7) * 0.5;
      g.position.y = Math.abs(Math.sin(phase)) * 0.03 * amount;
    },
    bark() {
      head.rotation.x = -0.35;
      setTimeout(() => { head.rotation.x = 0; }, 180);
    },
  };
}
