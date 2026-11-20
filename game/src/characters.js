// Velora Bay — characters (Three.js, vanilla JS).
// Low-poly people with proper proportions, hairstyles, clothing, separate
// limbs and walk animation; Barnaby the German Shepherd with follow/bark.
let T = null;
const MAT = {};
function mat(name, color) {
  if (!MAT[name]) MAT[name] = new T.MeshLambertMaterial({ color });
  return MAT[name];
}
function part(w, h, d, color, x, y, z, parent) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, color));
  m.position.set(x, y, z); m.castShadow = true;
  parent.add(m);
  return m;
}

// opts: { skin, hair, hairStyle, shirt, pants, shoes, height, cap }
// Returns { group, armL, armR, legL, legR, head, walk(phase, amp), face(yaw) }
export function makePerson(THREE, opts = {}) {
  T = THREE;
  const o = Object.assign({
    skin: 0xd8a077, hair: 0x2a1a0a, hairStyle: 'short', shirt: 0x2a4a7a,
    pants: 0x3a3f4a, shoes: 0x222222, height: 1.8, cap: null, jacket: null,
  }, opts);
  const g = new T.Group();
  const s = o.height / 1.8; // scale factor
  // legs (pivot at hip)
  const legL = new T.Group(); legL.position.set(-0.11 * s, 0.82 * s, 0);
  part(0.2 * s, 0.82 * s, 0.22 * s, o.pants, 0, -0.41 * s, 0, legL);
  part(0.22 * s, 0.1 * s, 0.32 * s, o.shoes, 0, -0.82 * s, 0.05 * s, legL);
  const legR = legL.clone(); legR.position.x = 0.11 * s;
  g.add(legL); g.add(legR);
  // torso
  part(0.62 * s, 0.62 * s, 0.34 * s, o.shirt, 0, 1.13 * s, 0, g);
  if (o.jacket) part(0.66 * s, 0.4 * s, 0.38 * s, o.jacket, 0, 1.28 * s, 0, g);
  // arms (pivot at shoulder)
  const armL = new T.Group(); armL.position.set(-0.38 * s, 1.4 * s, 0);
  part(0.16 * s, 0.62 * s, 0.18 * s, o.shirt, 0, -0.3 * s, 0, armL);
  part(0.15 * s, 0.14 * s, 0.16 * s, o.skin, 0, -0.62 * s, 0, armL);
  const armR = armL.clone(); armR.position.x = 0.38 * s;
  g.add(armL); g.add(armR);
  // head + hair
  const head = new T.Group(); head.position.set(0, 1.62 * s, 0);
  part(0.34 * s, 0.34 * s, 0.32 * s, o.skin, 0, 0.1 * s, 0, head);
  if (o.hairStyle === 'cap' || o.cap) {
    part(0.38 * s, 0.12 * s, 0.36 * s, o.cap || 0xe8c25a, 0, 0.3 * s, 0, head);
    part(0.38 * s, 0.06 * s, 0.2 * s, o.cap || 0xe8c25a, 0, 0.26 * s, 0.22 * s, head);
  } else if (o.hairStyle === 'long') {
    part(0.38 * s, 0.3 * s, 0.36 * s, o.hair, 0, 0.28 * s, -0.02 * s, head);
    part(0.36 * s, 0.4 * s, 0.1 * s, o.hair, 0, 0.05 * s, -0.18 * s, head);
  } else if (o.hairStyle === 'bun') {
    part(0.36 * s, 0.16 * s, 0.34 * s, o.hair, 0, 0.32 * s, 0, head);
    const bun = new T.Mesh(new T.SphereGeometry(0.1 * s, 8, 6), mat(o.hair, o.hair));
    bun.position.set(0, 0.36 * s, -0.18 * s); head.add(bun);
  } else { // short
    part(0.36 * s, 0.14 * s, 0.34 * s, o.hair, 0, 0.3 * s, 0, head);
  }
  g.add(head);
  return {
    group: g, armL, armR, legL, legR, head,
    walk(phase, amp = 0.6) {
      const sw = Math.sin(phase) * amp;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.8; armR.rotation.x = sw * 0.8;
    },
    idle(t) {
      const b = Math.sin(t * 2) * 0.03;
      armL.rotation.x = b; armR.rotation.x = -b;
      legL.rotation.x = 0; legR.rotation.x = 0;
    },
  };
}

export function makeEli(THREE) {
  const p = makePerson(THREE, {
    skin: 0xd8a077, hair: 0x3a2410, hairStyle: 'short', shirt: 0x2a4a7a,
    pants: 0x4a3a28, shoes: 0x3a2410, height: 1.85, cap: 0xe8c25a, jacket: 0x8a5a2a,
  });
  // hammer in right hand
  const hammer = new T.Group();
  const handle = new T.Mesh(new T.BoxGeometry(0.07, 0.5, 0.07), mat(0x8a5a2a, 0x8a5a2a));
  handle.position.y = 0.1; hammer.add(handle);
  const headM = new T.Mesh(new T.BoxGeometry(0.22, 0.12, 0.12), mat(0x888888, 0x888888));
  headM.position.y = 0.36; hammer.add(headM);
  hammer.position.set(0, -0.68, 0.05);
  hammer.rotation.x = 0.5;
  p.armR.add(hammer);
  p.hammer = hammer;
  // pistol + rifle meshes (swapped by setWeapon)
  const pistol = new T.Group();
  const pb = new T.Mesh(new T.BoxGeometry(0.06, 0.1, 0.3), mat(0x222222, 0x222222));
  pistol.add(pb);
  pistol.position.set(0, -0.68, 0.1);
  pistol.visible = false;
  p.armR.add(pistol);
  p.pistol = pistol;
  const rifle = new T.Group();
  const rb = new T.Mesh(new T.BoxGeometry(0.08, 0.12, 0.85), mat(0x333333, 0x333333));
  rifle.add(rb);
  const rs = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.2), mat(0x555555, 0x555555));
  rs.position.set(0, 0.05, -0.2); rifle.add(rs);
  rifle.position.set(0, -0.68, 0.15);
  rifle.visible = false;
  p.armR.add(rifle);
  p.rifle = rifle;
  p.setWeapon = (w) => {
    p.hammer.visible = w === 'hammer';
    p.pistol.visible = w === 'pistol';
    p.rifle.visible = w === 'rifle';
  };
  p.setWeapon('hammer');
  return p;
}

export function makeThug(THREE, variant = 0) {
  const looks = [
    { shirt: 0x7a2a2a, pants: 0x2a2a2a, hair: 0x111111, hairStyle: 'short', cap: 0x7a2a2a },
    { shirt: 0x2a2a2a, pants: 0x3a3a3a, hair: 0x111111, hairStyle: 'short' },
    { shirt: 0x4a2a6a, pants: 0x2a2a2a, hair: 0x3a2410, hairStyle: 'long' },
  ];
  return makePerson(THREE, looks[variant % looks.length]);
}

export function makePedestrian(THREE, seed = 0) {
  const shirts = [0xc96a3a, 0x3a7ab8, 0x5a9e4a, 0xe8c25a, 0xe86a92, 0x7fb3e8, 0xd8d0c0];
  const pants = [0x3a3f4a, 0x4a3a28, 0x2a2a2a, 0x5a6a7a];
  const hairStyles = ['short', 'long', 'bun'];
  const i = seed % shirts.length;
  return makePerson(THREE, {
    shirt: shirts[i], pants: pants[seed % pants.length],
    hair: [0x111111, 0x3a2410, 0x6a4a2a, 0x888888][seed % 4],
    hairStyle: hairStyles[seed % 3], height: 1.65 + (seed % 5) * 0.05,
  });
}

export function makeCrewMember(THREE, name) {
  const looks = {
    'Tommy Reyes': { shirt: 0x8a5a2a, pants: 0x3a3f4a, hair: 0x111111, hairStyle: 'short', cap: 0x8a5a2a },
    'Rosa Delgado': { shirt: 0xe8e0c8, pants: 0x2a2a2a, hair: 0x111111, hairStyle: 'long' },
    'Nadia Kline': { shirt: 0x2a4a7a, pants: 0x2a2a2a, hair: 0x6a4a2a, hairStyle: 'bun' },
    'Big Marv Okafor': { shirt: 0x5a9e4a, pants: 0x2a2a2a, hair: 0x111111, hairStyle: 'short', height: 1.95 },
    'Dina Santos': { shirt: 0xe86a92, pants: 0x2a2a2a, hair: 0x111111, hairStyle: 'long' },
    'Old Man Kofi': { shirt: 0xd8d0c0, pants: 0x4a3a28, hair: 0xdddddd, hairStyle: 'short', height: 1.7 },
  };
  return makePerson(THREE, looks[name] || {});
}

// Barnaby — German Shepherd: tan body, black saddle, pointed ears, tail.
export function makeBarnaby(THREE) {
  T = THREE;
  const g = new T.Group();
  const tan = 0xc98a4b, black = 0x2a2a2a;
  const body = part(0.5, 0.42, 1.0, tan, 0, 0.55, 0, g);
  part(0.52, 0.2, 0.7, black, 0, 0.68, -0.05, g); // saddle
  const head = new T.Group(); head.position.set(0, 0.85, 0.55);
  part(0.3, 0.28, 0.34, tan, 0, 0, 0, head);
  part(0.18, 0.12, 0.3, black, 0, -0.04, 0.28, head); // snout
  const earL = part(0.1, 0.22, 0.06, black, -0.1, 0.24, 0, head);
  const earR = part(0.1, 0.22, 0.06, black, 0.1, 0.24, 0, head);
  earL.rotation.z = 0.25; earR.rotation.z = -0.25;
  g.add(head);
  const legs = [];
  for (const [x, z] of [[-0.16, 0.35], [0.16, 0.35], [-0.16, -0.35], [0.16, -0.35]]) {
    const leg = new T.Group(); leg.position.set(x, 0.36, z);
    part(0.1, 0.36, 0.1, tan, 0, -0.18, 0, leg);
    g.add(leg); legs.push(leg);
  }
  const tail = new T.Group(); tail.position.set(0, 0.68, -0.5);
  part(0.08, 0.08, 0.4, black, 0, 0.05, -0.18, tail);
  tail.rotation.x = -0.5; g.add(tail);
  // "!" alert marker (hidden unless Gold Bar nearby)
  const alert = new T.Mesh(new T.SphereGeometry(0.14, 8, 6), new T.MeshBasicMaterial({ color: 0xffd700 }));
  alert.position.set(0, 1.5, 0); alert.visible = false; g.add(alert);
  return {
    group: g, head, legs, tail, alert,
    run(phase) {
      const sw = Math.sin(phase) * 0.5;
      legs[0].rotation.x = sw; legs[3].rotation.x = sw;
      legs[1].rotation.x = -sw; legs[2].rotation.x = -sw;
      tail.rotation.y = Math.sin(phase * 0.7) * 0.4;
    },
    idle(t) {
      for (const l of legs) l.rotation.x = 0;
      tail.rotation.y = Math.sin(t * 3) * 0.5;
      head.rotation.y = Math.sin(t * 0.8) * 0.3;
    },
  };
}
