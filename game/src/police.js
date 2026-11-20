// Velora Bay — police (Three.js, vanilla JS).
// Wanted 0-5 from heat. Named VBPD units with PATROL / PURSUIT / SEARCH
// states, ramming, heat decay, escape timer, helicopter (wanted >= 4)
// with searchlight, roadblocks (wanted 5).
import { makeCar } from './vehicles.js';

export const VBPD_NAMES = [
  { name: 'Ramirez', role: 'PURSUIT' }, { name: 'Chen', role: 'RAMMING' },
  { name: 'Okafor', role: 'ROADBLOCK' }, { name: 'Voss', role: 'PURSUIT' },
  { name: 'Delgado', role: 'FLANK' }, { name: 'Kane', role: 'PURSUIT' },
  { name: 'Reyes', role: 'PATROL' }, { name: 'Kowalski', role: 'PATROL' },
];

export function wantedLevel(heat) {
  if (heat < 10) return 0;
  if (heat < 25) return 1;
  if (heat < 45) return 2;
  if (heat < 70) return 3;
  if (heat < 100) return 4;
  return 5;
}

export function makePolice(THREE, scene) {
  const units = [];
  for (let i = 0; i < 8; i++) {
    const car = makeCar(THREE, { color: 0x1a2a4a, type: 'police' });
    car.visible = false;
    scene.add(car);
    units.push({
      car, info: VBPD_NAMES[i], state: 'PATROL', active: false,
      x: 0, z: 0, yaw: 0, speed: 0, patrolTarget: null, searchTimer: 0,
    });
  }
  // helicopter
  const heli = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
  body.castShadow = true; heli.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 1.2), new THREE.MeshLambertMaterial({ color: 0x1a2a3a, emissive: 0x0a1a2a }));
  glass.position.set(0, 0.2, -1.8); heli.add(glass);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 0.9; heli.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3), new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
  tail.position.set(0, 0.1, 3.4); heli.add(tail);
  // searchlight cone
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4, 18, 12, 1, true), coneMat);
  cone.position.y = -9; heli.add(cone);
  const spot = new THREE.PointLight(0xfff2c0, 0, 30, 1.4);
  spot.position.y = -2; heli.add(spot);
  heli.visible = false;
  scene.add(heli);
  // roadblock cars (parked across the road when wanted 5)
  const roadblock = [];
  for (let i = 0; i < 3; i++) {
    const car = makeCar(THREE, { color: 0x1a2a4a, type: 'police' });
    car.visible = false; scene.add(car);
    roadblock.push(car);
  }
  return {
    units, heli, rotor, cone, spot, roadblock,
    wanted: 0, heat: 0, escapeTimer: 0, heliActive: false,
  };
}

function dist(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

export function updatePolice(P, dt, playerPos, playerSpeed, onSpotted) {
  const w = wantedLevel(P.heat);
  if (w !== P.wanted) {
    P.wanted = w;
    // activate/deactivate units by wanted level
    const need = w === 0 ? 2 : Math.min(8, 1 + w);
    P.units.forEach((u, i) => {
      if (i < need) {
        if (!u.active) {
          u.active = true; u.car.visible = true;
          // spawn on a nearby road, behind the player
          const ang = (i / need) * Math.PI * 2;
          u.x = playerPos.x + Math.cos(ang) * (30 + i * 8);
          u.z = playerPos.z + Math.sin(ang) * (30 + i * 8);
          u.car.position.set(u.x, 0, u.z);
          u.state = 'PATROL';
        }
      } else { u.active = false; u.car.visible = false; }
    });
  }
  // heat decay when calm
  if (P.wanted > 0) {
    P.escapeTimer += dt;
    if (P.escapeTimer > 14) { P.heat = Math.max(0, P.heat - dt * 3); P.escapeTimer = 0; }
  }
  // helicopter
  const wantHeli = P.wanted >= 4;
  if (wantHeli && !P.heliActive) { P.heliActive = true; P.heli.visible = true; }
  if (!wantHeli && P.heliActive) { P.heliActive = false; P.heli.visible = false; }
  if (P.heliActive) {
    // demo override (chase demo only): P.heliDX/heliY/heliDZ set by the
    // demo staging; otherwise the default hover (6 ahead, 16 high, -4 side)
    P.heli.position.set(playerPos.x + (P.heliDX ?? 6), P.heliY ?? 16, playerPos.z + (P.heliDZ ?? -4));
    P.rotor.rotation.y += dt * 22;
    P.spot.intensity = 30;
  }
  // roadblock at wanted 5 — park across Beach Blvd ahead of the player
  const wantBlock = P.wanted >= 5;
  P.roadblock.forEach((car, i) => {
    if (wantBlock) {
      car.visible = true;
      car.position.set(playerPos.x - 20 + i * 7, 0, 128);
      car.rotation.y = Math.PI / 2;
    } else car.visible = false;
  });
  // units
  for (const u of P.units) {
    if (!u.active) continue;
    const d = dist(u.x, u.z, playerPos.x, playerPos.z);
    if (u.state === 'PATROL') {
      // wander on a slow loop near spawn
      if (!u.patrolTarget || dist(u.x, u.z, u.patrolTarget.x, u.patrolTarget.z) < 3) {
        u.patrolTarget = { x: u.x + (Math.random() - 0.5) * 40, z: u.z + (Math.random() - 0.5) * 40 };
      }
      moveToward(u, u.patrolTarget.x, u.patrolTarget.z, 8, dt);
      if (d < 26) { u.state = 'PURSUIT'; if (onSpotted) onSpotted(u); }
    } else if (u.state === 'PURSUIT') {
      const targetSpeed = 30 + P.wanted * 3;
      moveToward(u, playerPos.x, playerPos.z, targetSpeed, dt);
      if (d < 3.2) {
        // ram: push heat + slow the player a touch
        P.heat = Math.min(120, P.heat + 2);
      }
      if (d > 55) { u.state = 'SEARCH'; u.searchTimer = 8; }
    } else if (u.state === 'SEARCH') {
      u.searchTimer -= dt;
      moveToward(u, playerPos.x + Math.sin(u.searchTimer * 2) * 10, playerPos.z + Math.cos(u.searchTimer * 2) * 10, 10, dt);
      if (d < 20) u.state = 'PURSUIT';
      if (u.searchTimer <= 0) { u.state = 'PATROL'; P.heat = Math.max(0, P.heat - 15); }
    }
    u.car.position.set(u.x, 0, u.z);
    u.car.rotation.y = u.yaw;
    // light bar flash
    const lb = u.car.userData.lightBar;
    if (lb) {
      const on = Math.floor(performance.now() / 180) % 2 === 0;
      lb.r.material.color.setHex(on ? 0xff2222 : 0x441111);
      lb.b.material.color.setHex(on ? 0x112266 : 0x2266ff);
    }
  }
  return P.wanted;
}

function moveToward(u, tx, tz, speed, dt) {
  const dx = tx - u.x, dz = tz - u.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.5) return;
  const targetYaw = Math.atan2(-dx, -dz);
  let dy = targetYaw - u.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  u.yaw += dy * Math.min(1, 3.5 * dt);
  u.speed += (speed - u.speed) * Math.min(1, 2 * dt);
  u.x -= Math.sin(u.yaw) * u.speed * dt;
  u.z -= Math.cos(u.yaw) * u.speed * dt;
}

// snapshot for the HUD dispatch panel: active units with role + distance
export function dispatchSnapshot(P, playerPos) {
  return P.units.filter((u) => u.active).map((u) => ({
    name: u.info.name, role: u.info.role,
    dist: Math.round(dist(u.x, u.z, playerPos.x, playerPos.z)),
    state: u.state,
  }));
}
