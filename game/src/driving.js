// VELORA BAY — DRIVING
// Arcade vehicle physics (custom, no engine): acceleration, braking,
// steering that tightens at low speed, reverse, handbrake drift,
// collision vs building AABBs (circle + slide) and vs other cars,
// fuel drain, condition damage on hard hits, near-miss + drift rewards.
// Traffic cars follow layout loops; carjacking pulls the driver out.
import * as THREE from '../vendor/three.module.min.js';
import { TRAFFIC_LOOPS } from './layout.js';

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

// Wrap a car group (from vehicles.js) with driving state.
export function makeDriveable(car, opts = {}) {
  return {
    car,
    speed: 0,                 // m/s, forward positive
    steer: 0,
    fuel: opts.fuel ?? 62,
    condition: 100,
    maxSpeed: opts.maxSpeed ?? 42,
    accel: opts.accel ?? 15,
    driver: opts.driver || null, // pedestrian figure inside, or null
    isPlayer: false,
    drift: 0,
  };
}

export function updateDriveable(d, dt, input, world, G, others) {
  const car = d.car;
  const pos = car.group.position;
  const fwd = new THREE.Vector3(-Math.sin(car.group.rotation.y), 0, -Math.cos(car.group.rotation.y));
  // steering
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  d.steer += (steerTarget - d.steer) * Math.min(1, dt * 8);
  const speedFactor = Math.max(0.25, 1 - Math.abs(d.speed) / (d.maxSpeed * 1.6));
  const steerAngle = d.steer * 0.55 * speedFactor;
  car.group.rotation.y += (d.speed / 2.6) * Math.tan(steerAngle) * dt * (d.speed >= 0 ? 1 : -1);
  // throttle / brake / reverse
  if (input.up) d.speed += d.accel * dt;
  else if (input.down) {
    if (d.speed > 0.5) d.speed -= 26 * dt;
    else d.speed -= 9 * dt;
  } else {
    d.speed -= Math.sign(d.speed) * Math.min(Math.abs(d.speed), 6 * dt);
  }
  // handbrake drift
  const drifting = input.handbrake && Math.abs(d.speed) > 6;
  if (drifting) {
    d.speed -= Math.sign(d.speed) * Math.min(Math.abs(d.speed), 10 * dt);
    d.drift += Math.abs(d.speed) * dt;
    if (d.drift > 25) { G.addCash(50, 'DRIFT +$50'); d.drift = 0; }
  } else d.drift = Math.max(0, d.drift - dt * 10);
  d.speed = Math.max(-9, Math.min(d.maxSpeed, d.speed));
  // move
  const f2 = new THREE.Vector3(-Math.sin(car.group.rotation.y), 0, -Math.cos(car.group.rotation.y));
  const step = d.speed * dt;
  let nx = pos.x + f2.x * step;
  let nz = pos.z + f2.z * step;
  const before = { x: pos.x, z: pos.z };
  const c = collideCircle({ x: nx, z: nz }, 1.7, world.colliders);
  nx = Math.max(-198, Math.min(198, c.x));
  nz = Math.max(-148, Math.min(148, c.z));
  const hitWall = Math.hypot(nx - before.x, nz - before.z) < Math.abs(step) * 0.55;
  if (hitWall && Math.abs(d.speed) > 4) {
    const impact = Math.abs(d.speed);
    d.condition = Math.max(0, d.condition - impact * 0.55);
    if (impact > 12) G.audio.crash();
    if (d.condition <= 0) { d.speed = 0; if (d.isPlayer) G.hud.toast('THE GOLDEN SAW IS WRECKED — GET OUT', 'bad'); }
  }
  if (hitWall) d.speed *= 0.35;
  pos.x = nx; pos.z = nz;
  // car vs car (simple push + damage)
  for (const o of others) {
    if (o === d) continue;
    const op = o.car.group.position;
    const dx = pos.x - op.x, dz = pos.z - op.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.4 && dist > 0.01) {
      const push = (3.4 - dist) / 2;
      pos.x += (dx / dist) * push; pos.z += (dz / dist) * push;
      op.x -= (dx / dist) * push; op.z -= (dz / dist) * push;
      const rel = Math.abs(d.speed - o.speed);
      if (rel > 6) {
        d.condition = Math.max(0, d.condition - rel * 0.3);
        o.condition = Math.max(0, o.condition - rel * 0.3);
        if (d.isPlayer) G.audio.crash();
      }
      d.speed *= 0.7;
    }
  }
  // wheels
  car.setSpeed(d.speed * 3.6, steerAngle);
  // fuel
  if (Math.abs(d.speed) > 1) d.fuel = Math.max(0, d.fuel - dt * 0.12);
  if (d.fuel <= 0 && d.speed > 0) d.speed = Math.max(0, d.speed - 8 * dt);
  if (d.isPlayer) {
    G.stats.kmDriven += Math.abs(step) / 1000;
    // near-miss reward vs traffic
    for (const o of others) {
      if (o.isPlayer) continue;
      const op = o.car.group.position;
      const dist = Math.hypot(pos.x - op.x, pos.z - op.z);
      if (dist < 4.2 && Math.abs(d.speed) > 15 && !o._nearMissed) {
        o._nearMissed = true;
        G.addCash(100, 'NEAR MISS +$100');
        G.audio.reward();
      }
      if (dist > 8) o._nearMissed = false;
    }
  }
  return { hitWall };
}

// Traffic: cars that loop the road network on true centrelines.
export function createTraffic(scene, world, makeCar, count = 8) {
  const list = [];
  const colors = [0xd8d2c4, 0x7fb3e8, 0xd86a2a, 0x2fb3a3, 0xe86a92, 0x4a8a4a, 0xf5f2e8, 0x8a6a4a];
  for (let i = 0; i < count; i++) {
    const loop = TRAFFIC_LOOPS[i % TRAFFIC_LOOPS.length];
    const car = makeCar({ color: colors[i % colors.length], type: i % 5 === 0 ? 'taxi' : 'sedan' });
    car.group.position.set(loop[0][0], 0, loop[0][1]);
    scene.add(car.group);
    const d = makeDriveable(car, { maxSpeed: 11 + (i % 3) * 1.5, accel: 8 });
    list.push({ d, loop, seg: 0, t: (i * 0.37) % 1 });
  }
  return list;
}

export function updateTraffic(list, dt, world) {
  for (const tr of list) {
    if (tr.d.driver === 'gone') continue; // carjacked, waits for respawn
    const a = tr.loop[tr.seg];
    const b = tr.loop[(tr.seg + 1) % tr.loop.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) { tr.seg = (tr.seg + 1) % tr.loop.length; continue; }
    const speed = 10;
    tr.t += (speed * dt) / len;
    if (tr.t >= 1) { tr.t = 0; tr.seg = (tr.seg + 1) % tr.loop.length; continue; }
    const x = a[0] + dx * tr.t, z = a[1] + dz * tr.t;
    tr.d.car.group.position.set(x, 0, z);
    tr.d.car.group.rotation.y = Math.atan2(-dx, -dz); // car front is -z
    tr.d.speed = speed;
    tr.d.car.setSpeed(speed * 3.6, 0);
  }
}

// Carjacking: pull the driver out of a traffic car, player takes the wheel.
export function tryCarjack(playerPos, traffic, scene, G) {
  let best = null, bestD = 4.2;
  for (const tr of traffic) {
    const p = tr.d.car.group.position;
    const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
    if (d < bestD) { best = tr; bestD = d; }
  }
  return best;
}
