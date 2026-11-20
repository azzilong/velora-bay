// Velora Bay — vehicles (Three.js, vanilla JS).
// Recognisable low-poly cars: hood, trunk, roof, doors, windows, lights,
// wheels with tires + rims, bumpers, mirrors. Arcade driving physics
// (accel / brake / steer / drift, fuel, condition) + traffic following
// true road-centreline loops.
let T = null;
const MAT = {};
function mat(name, color, opts = {}) {
  if (!MAT[name]) MAT[name] = new T.MeshLambertMaterial({ color, ...opts });
  return MAT[name];
}

// Build a car mesh. opts: { color, type: 'sedan'|'truck'|'police'|'taxi'|'convertible', gold }
export function makeCar(THREE, opts = {}) {
  T = THREE;
  const o = Object.assign({ color: 0x8a9aaa, type: 'sedan' }, opts);
  const g = new T.Group();
  const bodyM = mat('car' + o.color, o.color, { emissive: o.color, emissiveIntensity: 0.08 });
  const glassM = mat('glass', 0x1a2a3a, { emissive: 0x0a1a2a, emissiveIntensity: 0.4 });
  const darkM = mat('dark', 0x1a1a1a);
  const chromeM = mat('chrome', 0xcccccc);
  const isTruck = o.type === 'truck';
  const L = isTruck ? 5.4 : 4.2, W = 1.9, H = 0.62;
  // lower body
  const body = new T.Mesh(new T.BoxGeometry(W, H, L), bodyM);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  // hood (front, -z) + trunk (rear, +z) — slightly lower slabs
  const hood = new T.Mesh(new T.BoxGeometry(W * 0.94, 0.22, L * 0.22), bodyM);
  hood.position.set(0, 0.8, -L * 0.38); hood.castShadow = true; g.add(hood);
  const trunk = new T.Mesh(new T.BoxGeometry(W * 0.94, 0.22, L * 0.18), bodyM);
  trunk.position.set(0, 0.8, L * 0.4); trunk.castShadow = true; g.add(trunk);
  // cabin / roof
  if (o.type === 'convertible') {
    // open top: low windshield + roll bar
    const shield = new T.Mesh(new T.BoxGeometry(W * 0.9, 0.5, 0.12), glassM);
    shield.position.set(0, 1.05, -L * 0.12); shield.rotation.x = -0.25; g.add(shield);
    const bar = new T.Mesh(new T.BoxGeometry(W * 0.9, 0.12, 0.12), darkM);
    bar.position.set(0, 1.15, L * 0.22); g.add(bar);
  } else if (isTruck) {
    const cab = new T.Mesh(new T.BoxGeometry(W * 0.96, 0.9, 1.2), bodyM);
    cab.position.set(0, 1.25, -L * 0.32); cab.castShadow = true; g.add(cab);
    const shield = new T.Mesh(new T.BoxGeometry(W * 0.8, 0.6, 0.1), glassM);
    shield.position.set(0, 1.3, -L * 0.32 - 0.62); shield.rotation.x = -0.15; g.add(shield);
    const bed = new T.Mesh(new T.BoxGeometry(W * 0.9, 0.5, L * 0.45), mat('bed', 0x6a5a3a));
    bed.position.set(0, 1.0, L * 0.2); g.add(bed);
  } else {
    const cabin = new T.Mesh(new T.BoxGeometry(W * 0.86, 0.62, L * 0.42), glassM);
    cabin.position.set(0, 1.12, L * 0.05); cabin.castShadow = true; g.add(cabin);
    const roof = new T.Mesh(new T.BoxGeometry(W * 0.88, 0.1, L * 0.4), bodyM);
    roof.position.set(0, 1.46, L * 0.05); roof.castShadow = true; g.add(roof);
  }
  // doors (thin panels on the sides)
  for (const s of [-1, 1]) {
    const door = new T.Mesh(new T.BoxGeometry(0.06, 0.5, L * 0.3), bodyM);
    door.position.set(s * (W / 2 + 0.01), 0.62, 0); g.add(door);
    const mirror = new T.Mesh(new T.BoxGeometry(0.12, 0.1, 0.18), darkM);
    mirror.position.set(s * (W / 2 + 0.08), 1.0, -L * 0.2); g.add(mirror);
  }
  // headlights + taillights
  const headM = new T.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const s of [-1, 1]) {
    const h = new T.Mesh(new T.BoxGeometry(0.34, 0.16, 0.08), headM);
    h.position.set(s * 0.6, 0.62, -L / 2 - 0.02); g.add(h);
    const t = new T.Mesh(new T.BoxGeometry(0.34, 0.16, 0.08), new T.MeshBasicMaterial({ color: 0xff2a2a }));
    t.position.set(s * 0.6, 0.62, L / 2 + 0.02); g.add(t);
  }
  // bumpers
  const bumpF = new T.Mesh(new T.BoxGeometry(W + 0.06, 0.18, 0.18), chromeM);
  bumpF.position.set(0, 0.32, -L / 2 - 0.05); g.add(bumpF);
  const bumpR = bumpF.clone(); bumpR.position.z = L / 2 + 0.05; g.add(bumpR);
  // wheels: tire (dark torus-ish cylinder) + rim
  const wheels = [];
  const tireM = mat('tire', 0x161616);
  const rimM = mat('rim', 0xdddddd);
  for (const [x, z] of [[-W / 2, -L * 0.32], [W / 2, -L * 0.32], [-W / 2, L * 0.32], [W / 2, L * 0.32]]) {
    const wg = new T.Group();
    const tire = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.26, 12), tireM);
    tire.rotation.z = Math.PI / 2; tire.castShadow = true; wg.add(tire);
    const rim = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.28, 8), rimM);
    rim.rotation.z = Math.PI / 2; wg.add(rim);
    wg.position.set(x + (x < 0 ? -0.06 : 0.06), 0.36, z);
    g.add(wg); wheels.push(wg);
  }
  // police light bar
  if (o.type === 'police') {
    const bar = new T.Mesh(new T.BoxGeometry(1.1, 0.16, 0.4), darkM);
    bar.position.set(0, 1.56, 0); g.add(bar);
    const r = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.42), new T.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.set(-0.28, 1.56, 0); g.add(r);
    const b = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 0.42), new T.MeshBasicMaterial({ color: 0x2266ff }));
    b.position.set(0.28, 1.56, 0); g.add(b);
    g.userData.lightBar = { r, b };
  }
  // license plate
  const plate = new T.Mesh(new T.BoxGeometry(0.6, 0.18, 0.04), new T.MeshBasicMaterial({ color: 0xffffff }));
  plate.position.set(0, 0.5, L / 2 + 0.06); g.add(plate);
  g.userData.wheels = wheels;
  g.userData.length = L;
  return g;
}

// --- arcade driving state ---
export function makeDriveState(car, opts = {}) {
  return {
    car, speed: 0, steer: 0, fuel: opts.fuel ?? 100, condition: opts.condition ?? 100,
    maxSpeed: opts.maxSpeed ?? 42, accel: opts.accel ?? 16, pos: car.position, yaw: 0,
  };
}

// step the car: input {fwd, back, left, right, drift}, dt seconds
// returns { speedKmh, drifted }
export function stepDrive(st, input, dt, colliders) {
  const d = st;
  if (input.fwd) d.speed += d.accel * dt * (d.speed < 0 ? 2.2 : 1);
  if (input.back) d.speed -= d.accel * 0.9 * dt;
  if (!input.fwd && !input.back) d.speed -= Math.sign(d.speed) * 8 * dt;
  if (input.drift) d.speed *= (1 - 0.25 * dt);
  d.speed = Math.max(-12, Math.min(d.maxSpeed, d.speed));
  if (Math.abs(d.speed) < 0.2 && !input.fwd && !input.back) d.speed = 0;
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerRate = input.drift ? 2.6 : 1.9;
  d.steer += (steerTarget * 0.55 - d.steer) * Math.min(1, 8 * dt);
  const turn = d.steer * steerRate * dt * Math.min(1, Math.abs(d.speed) / 8) * Math.sign(d.speed || 1);
  d.yaw += turn;
  const nx = d.pos.x - Math.sin(d.yaw) * d.speed * dt;
  const nz = d.pos.z - Math.cos(d.yaw) * d.speed * dt;
  // circle vs AABB collision — slide along
  let hit = false;
  for (const c of colliders) {
    if (nx > c.x0 - 1 && nx < c.x1 + 1 && nz > c.z0 - 1 && nz < c.z1 + 1) { hit = true; break; }
  }
  if (!hit) { d.pos.x = nx; d.pos.z = nz; }
  else {
    d.speed *= 0.4;
    d.condition = Math.max(0, d.condition - 0.4);
  }
  d.car.position.set(d.pos.x, 0, d.pos.z);
  d.car.rotation.y = d.yaw;
  for (const w of d.car.userData.wheels) w.rotation.x += d.speed * dt * 2;
  if (input.fwd && d.fuel > 0) d.fuel = Math.max(0, d.fuel - dt * 0.55);
  return { speedKmh: Math.abs(d.speed) * 3.6, drifted: input.drift && Math.abs(d.speed) > 15 };
}

// --- traffic: cars following a loop of waypoints on road centrelines ---
export function makeTrafficCar(THREE, loop, offset, color) {
  const car = makeCar(THREE, { color });
  const st = {
    car, loop, seg: 0, t: offset, speed: 9 + (offset % 3), yaw: 0,
    pos: car.position,
  };
  const p0 = loop[0];
  car.position.set(p0.x, 0, p0.z);
  return st;
}

export function stepTraffic(st, dt, colliders) {
  const a = st.loop[st.seg];
  const b = st.loop[(st.seg + 1) % st.loop.length];
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const targetYaw = Math.atan2(-dx, -dz);
  // ease yaw toward target
  let dy = targetYaw - st.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  st.yaw += dy * Math.min(1, 4 * dt);
  st.pos.x -= Math.sin(st.yaw) * st.speed * dt;
  st.pos.z -= Math.cos(st.yaw) * st.speed * dt;
  // advance segment when close to the next waypoint
  const ddx = b.x - st.pos.x, ddz = b.z - st.pos.z;
  if (Math.hypot(ddx, ddz) < 2.5) st.seg = (st.seg + 1) % st.loop.length;
  // keep inside the loop rectangle (safety)
  st.car.position.set(st.pos.x, 0, st.pos.z);
  st.car.rotation.y = st.yaw;
  for (const w of st.car.userData.wheels) w.rotation.x += st.speed * dt * 2;
}
