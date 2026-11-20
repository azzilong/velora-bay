// VELORA BAY — WANTED + POLICE AI
// Five wanted levels. Police states: PATROL (loop the roads), PURSUIT
// (chase + ram the player), SEARCH (sweep the last known position),
// ESCAPE (heat decays when no unit sees the player). Wanted 4+ adds a
// helicopter with a searchlight; wanted 5 adds roadblocks ahead.
// Units are named VBPD dispatch entries shown in the HUD panel.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';
import { TRAFFIC_LOOPS } from './layout.js';

const UNIT_NAMES = ['UNIT 12 · RAMIREZ', 'UNIT 07 · CHEN', 'UNIT 23 · OKAFOR', 'UNIT 31 · VOSS', 'UNIT 05 · DELGADO', 'UNIT 18 · KANE'];
const UNIT_ROLES = ['PURSUIT', 'RAMMING', 'ROADBLOCK', 'PURSUIT', 'INTERCEPT', 'SPOTLIGHT'];

function collideCircle(pos, r, colliders) {
  let { x, z } = pos;
  for (const c of colliders) {
    const cx = Math.max(c.x0, Math.min(x, c.x1));
    const cz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    }
  }
  return { x, z };
}

export function createPolice(scene, world, G) {
  const P = {
    wanted: 0,
    heat: 0,              // 0..100, drives wanted level
    units: [],            // { d, state, name, role, lastSeen }
    heli: null,           // { group, angle, light }
    roadblocks: [],
    unseenTimer: 0,
    lastKnown: new THREE.Vector3(),
  };

  function spawnUnit(i) {
    const car = makeCar({ color: 0x1a2a4a, type: 'police' });
    const loop = TRAFFIC_LOOPS[i % TRAFFIC_LOOPS.length];
    car.group.position.set(loop[0][0], 0, loop[0][1]);
    scene.add(car.group);
    const d = { car, speed: 0, steer: 0, fuel: 100, condition: 100, maxSpeed: 46, accel: 17, isPlayer: false, drift: 0 };
    const unit = { d, state: 'PATROL', name: UNIT_NAMES[i % UNIT_NAMES.length], role: UNIT_ROLES[i % UNIT_ROLES.length], loop, seg: 0, t: Math.random(), lastSeen: new THREE.Vector3(), searchT: 0 };
    P.units.push(unit);
    return unit;
  }
  function spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), new THREE.MeshStandardMaterial({ color: 0x2f5a8a, roughness: 0.5, metalness: 0.4 }));
    body.castShadow = true;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x6a8aaa, roughness: 0.15, metalness: 0.7 }));
    glass.position.set(0, 0.1, -1.6);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.4), new THREE.MeshStandardMaterial({ color: 0x2f5a8a, roughness: 0.5, metalness: 0.4 }));
    tail.position.set(0, 0.2, 3.6);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5 }));
    rotor.position.y = 0.9;
    const light = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 0.4, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    light.position.y = -15;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
    bulb.position.set(0, -0.6, -1.6);
    g.add(body, glass, tail, rotor, light, bulb);
    g.userData.rotor = rotor;
    scene.add(g);
    P.heli = { group: g, angle: 0 }; // start ahead of the player (east), in view
  }
  function removeHeli() {
    if (!P.heli) return;
    scene.remove(P.heli.group);
    P.heli = null;
  }
  function clearRoadblocks() {
    for (const rb of P.roadblocks) scene.remove(rb.group);
    P.roadblocks = [];
  }
  function spawnRoadblock(playerPos, playerYaw) {
    clearRoadblocks();
    for (const s of [-1, 1]) {
      const car = makeCar({ color: 0x1a2a4a, type: 'police' });
      const fx = -Math.sin(playerYaw), fz = -Math.cos(playerYaw);
      const rx = -fz, rz = fx;
      car.group.position.set(playerPos.x + fx * 26 + rx * s * 3.4, 0, playerPos.z + fz * 26 + rz * s * 3.4);
      car.group.rotation.y = playerYaw + Math.PI / 2;
      scene.add(car.group);
      P.roadblocks.push({ group: car.group });
    }
  }

  function addHeat(n, reason) {
    P.heat = Math.min(100, P.heat + n);
    if (reason) G.hud.toast(reason, 'bad');
    updateWanted();
  }
  function updateWanted() {
    const w = P.heat < 12 ? 0 : P.heat < 30 ? 1 : P.heat < 48 ? 2 : P.heat < 66 ? 3 : P.heat < 84 ? 4 : 5;
    if (w !== P.wanted) {
      P.wanted = w;
      G.hud.setWanted(w);
      if (w >= 1 && P.units.length < w + 1) {
        while (P.units.length < w + 1) spawnUnit(P.units.length);
      }
      if (w >= 4 && !P.heli) spawnHeli();
      if (w < 4) removeHeli();
      if (w >= 5) G.hud.toast('VBPD: ROADBLOCKS AHEAD — MAXIMUM RESPONSE', 'bad');
      if (w === 0) { clearRoadblocks(); for (const u of P.units) u.state = 'PATROL'; }
    }
  }

  function update(dt, playerPos, playerDriving, playerSpeed) {
    // heat decay when unseen
    let anySees = false;
    for (const u of P.units) {
      const p = u.d.car.group.position;
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d < 42 && P.wanted > 0) anySees = true;
    }
    if (P.wanted > 0) {
      if (anySees) { P.unseenTimer = 0; P.lastKnown.copy(playerPos); }
      else {
        P.unseenTimer += dt;
        if (P.unseenTimer > 6) P.heat = Math.max(0, P.heat - dt * 4);
        if (P.unseenTimer > 14 && P.heat <= 0) { P.wanted = 0; G.hud.setWanted(0); G.hud.toast('YOU LOST THE COPS', 'good'); G.stats.escapes++; }
      }
      updateWanted();
    }
    // units
    for (const u of P.units) {
      const p = u.d.car.group.position;
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (P.wanted === 0) { u.state = 'PATROL'; }
      else if (d < 46) { u.state = 'PURSUIT'; u.lastSeen.copy(playerPos); u.searchT = 0; }
      else if (u.state === 'PURSUIT' && d > 70) { u.state = 'SEARCH'; u.searchT = 0; }
      if (u.state === 'PATROL') {
        // loop the roads
        const a = u.loop[u.seg], b = u.loop[(u.seg + 1) % u.loop.length];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        u.t += (9 * dt) / Math.max(1, len);
        if (u.t >= 1) { u.t = 0; u.seg = (u.seg + 1) % u.loop.length; }
        const x = a[0] + dx * u.t, z = a[1] + dz * u.t;
        p.set(x, 0, z);
        u.d.car.group.rotation.y = Math.atan2(-dx, -dz); // car front is -z
        u.d.car.setSpeed(9 * 3.6, 0);
      } else if (u.state === 'PURSUIT') {
        // chase: steer toward the player, ram (collide with buildings)
        const targetYaw = Math.atan2(-(playerPos.x - p.x), -(playerPos.z - p.z));
        let dy = targetYaw - u.d.car.group.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        u.d.car.group.rotation.y += dy * Math.min(1, dt * 2.2);
        const sp = Math.min(20, 13 + P.wanted * 1.6);
        const fx = -Math.sin(u.d.car.group.rotation.y), fz = -Math.cos(u.d.car.group.rotation.y);
        const c = collideCircle({ x: p.x + fx * sp * dt, z: p.z + fz * sp * dt }, 1.7, world.colliders);
        p.x = Math.max(-198, Math.min(198, c.x));
        p.z = Math.max(-148, Math.min(148, c.z));
        u.d.speed = sp;
        u.d.car.setSpeed(sp * 3.6, 0);
        // ram the player (with a cooldown so it does not spam)
        if (d < 3.2) {
          u.ramCd = (u.ramCd || 0) - dt;
          if (u.ramCd <= 0) {
            u.ramCd = 2.5;
            if (playerDriving) {
              playerDriving.speed *= 0.55;
              playerDriving.condition = Math.max(0, playerDriving.condition - 4);
              G.audio.crash();
              G.hud.toast('RAMMED BY VBPD', 'bad');
            } else {
              G.playerDamage(12, p.x, p.z);
            }
          }
        }
      } else if (u.state === 'SEARCH') {
        u.searchT += dt;
        const tx = u.lastSeen.x + Math.sin(u.searchT * 0.8) * 18;
        const tz = u.lastSeen.z + Math.cos(u.searchT * 0.6) * 18;
        const targetYaw = Math.atan2(-(tx - p.x), -(tz - p.z));
        let dy = targetYaw - u.d.car.group.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        u.d.car.group.rotation.y += dy * Math.min(1, dt * 1.6);
        const fx = -Math.sin(u.d.car.group.rotation.y), fz = -Math.cos(u.d.car.group.rotation.y);
        const c = collideCircle({ x: p.x + fx * 8 * dt, z: p.z + fz * 8 * dt }, 1.7, world.colliders);
        p.x = c.x; p.z = c.z;
        u.d.car.setSpeed(8 * 3.6, 0);
        if (u.searchT > 12) u.state = 'PATROL';
      }
    }
    // helicopter circles the player (low enough to stay in the chase camera's frame)
    if (P.heli) {
      P.heli.angle += dt * 0.22;
      const r = 34;
      P.heli.group.position.set(
        playerPos.x + Math.cos(P.heli.angle) * r,
        16 + Math.sin(P.heli.angle * 0.7) * 2,
        playerPos.z + Math.sin(P.heli.angle) * r,
      );
      P.heli.group.lookAt(playerPos.x, 0, playerPos.z);
      P.heli.group.userData.rotor.rotation.y += dt * 22;
      P.lastKnown.copy(playerPos);
    }
    // roadblock at wanted 5: place ahead of the player every 12s
    if (P.wanted >= 5) {
      P._rbT = (P._rbT || 0) + dt;
      if (P._rbT > 12) {
        P._rbT = 0;
        spawnRoadblock(playerPos, G.playerYaw || 0);
      }
    } else if (P.roadblocks.length) clearRoadblocks();
  }

  return { P, addHeat, updateWanted, update, spawnUnit };
}
