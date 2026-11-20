// Velora Bay — main game (Three.js global + vanilla JS modules).
// Third-person on-foot + driving, carjacking, combat, police, missions,
// Barnaby, collectibles, skills, crew, properties, saves, HUD, demos.
// Demo staging via URL: ?demo=chase | night | map | win (consistent
// demo save: M7, $4,120, REP 1240, DAY 4, 80% complete, crew 6/6).
import * as L from './layout.js';
import { buildWorld, setTimeOfDay, updateWorld, world } from './world.js';
import { makeEli, makeThug, makePedestrian, makeBarnaby } from './characters.js';
import { makeCar, makeDriveState, stepDrive, makeTrafficCar, stepTraffic } from './vehicles.js';
import { makePolice, updatePolice } from './police.js';
import { MISSIONS, CREW, SKILLS, startMission, updateMissions } from './missions.js';
import { buildHUD, updateHUD, openWheel, closeWheel, toast, buildMapScreen, buildWin, HUD } from './hud.js';
import { initAudio, sfx, setEngine } from './audio.js';

const THREE = window.THREE;
const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') || null;

// ---------- game state ----------
const G = {
  money: 0, rep: 0, hp: 100, armor: 0, weapon: 'hammer',
  ammo: { pistol: { mag: 12, reserve: 48 }, rifle: { mag: 0, reserve: 90 } },
  goldCollected: new Set(), completed: [], rating: {},
  skills: { driving: 2, stamina: 2, influence: 2, shooting: 2, stealth: 1, street: 2 },
  day: 1, time: 8 * 60,
  incomePerMin: 50,
  stats: { carsStolen: 0, takedowns: 0, escapes: 0, timePlayed: '00:00:00', bestWanted: 0, kmDriven: 0 },
  player: { x: L.SPAWN.x, z: L.SPAWN.z, yaw: 0, vy: 0, y: 0, onGround: true, inCar: false, car: null, drive: null, walkPhase: 0, speed: 0 },
  mission: null, currentMission: -1, objective: null, dialogue: null,
  police: null, enemies: [], enemiesLeft: 0,
  interactPressed: false, rallyPressed: false, chaseDone: false,
  interactLabel: null, barnabyAlert: false, barnabyGold: false,
  win: false, started: false, paused: false,
  carSpeedKmh: 0, carFuel: 100, carCondition: 100,
  toast(t) { toast(G, t); },
  sfx(n) { sfx(n); },
  setWeapon(w) { setWeapon(w); },
  save() { saveGame(); },
};
window.__game = G;

// ---------- three setup ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffd9a0, 220, 620);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
buildWorld(scene, THREE);

// ---------- player ----------
const eli = makeEli(THREE);
scene.add(eli.group);
const barnaby = makeBarnaby(THREE);
barnaby.group.position.set(G.player.x + 2, 0, G.player.z + 2);
scene.add(barnaby.group);

// ---------- vehicles ----------
const goldenSaw = makeCar(THREE, { color: 0xd8a018, type: 'convertible' });
goldenSaw.position.set(L.GOLDEN_SAW.x, 0, L.GOLDEN_SAW.z);
goldenSaw.rotation.y = Math.PI;
scene.add(goldenSaw);
const sawDrive = makeDriveState(goldenSaw, { maxSpeed: 48, accel: 20, fuel: 62, condition: 100 });
sawDrive.yaw = Math.PI;
const truck = makeCar(THREE, { color: 0x8a5a2a, type: 'truck' });
truck.position.set(-60, 0, 92); scene.add(truck);
const truckDrive = makeDriveState(truck, { maxSpeed: 30, accel: 12, fuel: 80 });

// traffic + pedestrians
const traffic = [];
const loopColors = [0x8a9aaa, 0xc96a3a, 0x5a9e4a, 0xe8e0c8, 0x7fb3e8, 0x3a3f4a, 0xe86a92, 0xb8a03a];
L.TRAFFIC_LOOPS.forEach((loop, i) => {
  traffic.push(makeTrafficCar(THREE, loop, i * 0.13, loopColors[i % loopColors.length]));
  if (i < 2) traffic.push(makeTrafficCar(THREE, loop, i * 0.13 + 0.5, loopColors[(i + 3) % loopColors.length]));
});
traffic.forEach((t) => scene.add(t.car));
const peds = [];
for (let i = 0; i < 14; i++) {
  const p = makePedestrian(THREE, i);
  const loop = L.PED_LOOPS[i % L.PED_LOOPS.length];
  const wp = loop[i % loop.length];
  p.group.position.set(wp.x, 0, wp.z);
  scene.add(p.group);
  peds.push({ m: p, loop, seg: 0, speed: 1.2 + (i % 3) * 0.4, phase: i, flee: false });
}

// ---------- police ----------
G.police = makePolice(THREE, scene);

// ---------- gold bars ----------
const goldMeshes = [];
{
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xaa8800, emissiveIntensity: 0.7 });
  for (const gb of L.GOLD_BARS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), goldMat);
    m.position.set(gb.x, 0.5, gb.z);
    m.userData.key = gb.x + ',' + gb.z;
    scene.add(m); goldMeshes.push(m);
  }
}

// ---------- input ----------
const keys = {};
let camYaw = Math.PI, camPitch = 0.32, pointerLocked = false;
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); if (!HUD.wheelOpen) openWheel(G); }
  keys[e.code] = true;
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'Escape') { G.paused = !G.paused; document.getElementById('pause-screen').style.display = G.paused ? 'flex' : 'none'; }
  if (e.code === 'KeyE') G.interactPressed = true;
  if (e.code === 'KeyR') reloadWeapon();
  if (e.code === 'Digit1') setWeapon('fists');
  if (e.code === 'Digit2') setWeapon('hammer');
  if (e.code === 'Digit3') setWeapon('pistol');
  if (e.code === 'Digit4') setWeapon('rifle');
  if (e.code === 'KeyF') tryEnterExitCar();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Tab') closeWheel(G, true);
});
addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    if (HUD.wheelOpen) { closeWheel(G, true); return; }
    if (!pointerLocked && !HUD.titleOpen) renderer.domElement.requestPointerLock?.();
    attack();
  }
});
addEventListener('mousemove', (e) => {
  if (pointerLocked) {
    camYaw -= e.movementX * 0.0028;
    camPitch = Math.max(0.05, Math.min(0.9, camPitch + e.movementY * 0.002));
  }
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === renderer.domElement; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- weapons ----------
const WEAPON_DEF = {
  fists: { dmg: 22, range: 2.2, cd: 0.35, melee: true },
  hammer: { dmg: 35, range: 2.4, cd: 0.5, melee: true },
  pistol: { dmg: 34, range: 40, cd: 0.28, melee: false },
  rifle: { dmg: 55, range: 70, cd: 0.12, melee: false },
};
let attackCd = 0;
function setWeapon(w) {
  if (w === 'rifle' && !G.completed.includes(4)) { toast(G, 'RIFLE locked — complete CRANE DOWN (M4)'); return; }
  if (w === 'pistol' && !G.completed.includes(1)) { toast(G, 'PISTOL locked — complete ASHES (M1)'); return; }
  G.weapon = w;
  eli.setWeapon(w);
  sfx('click');
}
function reloadWeapon() {
  const a = G.ammo[G.weapon];
  if (!a || a.mag >= 12 || a.reserve <= 0) return;
  const need = 12 - a.mag, take = Math.min(need, a.reserve);
  a.mag += take; a.reserve -= take;
  sfx('click');
}
const dmgLayer = document.createElement('div');
dmgLayer.id = 'dmg-layer';
document.body.appendChild(dmgLayer);
function damageNumber(worldPos, text, color = '#ffd700', persist = false) {
  const v = new THREE.Vector3(worldPos.x, worldPos.y + 2, worldPos.z).project(camera);
  if (v.z > 1) return;
  const d = document.createElement('div');
  d.className = 'dmg-num'; d.textContent = text; d.style.color = color;
  d.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
  d.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
  if (persist) d.style.animation = 'none';
  dmgLayer.appendChild(d);
  if (!persist) setTimeout(() => d.remove(), 900);
}
// muzzle flash + tracer
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0 });
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), flashMat);
scene.add(flash);
let flashUntil = 0;
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 });
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const tracer = new THREE.Line(tracerGeo, tracerMat);
scene.add(tracer);
let tracerUntil = 0;

function attack() {
  if (!G.started || G.paused || attackCd > 0) return;
  const def = WEAPON_DEF[G.weapon];
  attackCd = def.cd;
  const p = G.player;
  const mx = p.x - Math.sin(p.yaw) * 0.4, mz = p.z - Math.cos(p.yaw) * 0.4;
  if (def.melee) {
    sfx(G.weapon === 'hammer' ? 'hammer' : 'hit');
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < def.range + 0.6) {
        e.hp -= def.dmg;
        damageNumber({ x: e.x, y: 1, z: e.z }, '-' + def.dmg);
        sfx('hit');
        if (e.hp <= 0) killEnemy(e);
      }
    }
  } else {
    const a = G.ammo[G.weapon];
    if (!a || a.mag <= 0) { sfx('click'); return; }
    a.mag--;
    sfx('shot');
    flash.position.set(mx, 1.4, mz);
    flash.lookAt(camera.position);
    flashMat.opacity = 1; flashUntil = performance.now() + 70;
    let best = null, bestD = def.range;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > def.range) continue;
      const ang = Math.atan2(-dx, -dz);
      let da = ang - p.yaw;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 0.22 && d < bestD) { best = e; bestD = d; }
    }
    const endX = best ? best.x : p.x - Math.sin(p.yaw) * def.range;
    const endZ = best ? best.z : p.z - Math.cos(p.yaw) * def.range;
    tracerGeo.setFromPoints([new THREE.Vector3(mx, 1.4, mz), new THREE.Vector3(endX, 1.3, endZ)]);
    tracerMat.opacity = 0.9; tracerUntil = performance.now() + 90;
    if (best) {
      const dmg = def.dmg + (G.skills.shooting - 1) * 4;
      best.hp -= dmg;
      damageNumber({ x: best.x, y: 1, z: best.z }, '-' + Math.round(dmg));
      best.flashUntil = performance.now() + 120;
      if (best.hp <= 0) killEnemy(best);
    }
    G.police.heat = Math.min(120, G.police.heat + 3);
  }
}
function killEnemy(e) {
  e.hp = 0;
  e.group.visible = false;
  G.stats.takedowns++;
  G.enemiesLeft = G.enemies.filter((x) => x.hp > 0).length;
  toast(G, 'TAKEDOWN +$50');
  G.money += 50;
}

// ---------- enemies ----------
function spawnThugs(points, count) {
  for (let i = 0; i < count; i++) {
    const pt = points[i % points.length];
    const m = makeThug(THREE, i);
    m.group.position.set(pt.x + (i - 1) * 2, 0, pt.z + (i % 2) * 2);
    scene.add(m.group);
    G.enemies.push({ m, group: m.group, x: pt.x + (i - 1) * 2, z: pt.z + (i % 2) * 2, hp: 60, phase: i * 2, flashUntil: 0, attackCd: 0 });
  }
  G.enemiesLeft = G.enemies.filter((e) => e.hp > 0).length;
}
function clearEnemies() {
  for (const e of G.enemies) scene.remove(e.group);
  G.enemies = []; G.enemiesLeft = 0;
}
function missionThugs() {
  const m = G.mission ? MISSIONS[G.mission.index] : null;
  if (!m) return;
  const t = m.stages[G.mission.stage].target;
  if (m.id === 2 && G.mission.stage === 1) spawnThugs([{ x: t.x, z: t.z }], 3);
  if (m.id === 4 && G.mission.stage === 0) spawnThugs([{ x: t.x, z: t.z }], 2);
  if (m.id === 5 && G.mission.stage === 0) spawnThugs([{ x: t.x, z: t.z }], 2);
  if (m.id === 7 && G.mission.stage === 0) spawnThugs([{ x: t.x, z: t.z }], 3);
  if (m.id === 8) spawnThugs([{ x: t.x, z: t.z }], 2);
}

// ---------- vehicles: enter / exit / carjack ----------
function tryEnterExitCar() {
  const p = G.player;
  if (p.inCar) {
    p.inCar = false;
    p.x = p.car.position.x + 2.5; p.z = p.car.position.z + 1;
    p.car = null; p.drive = null;
    eli.group.visible = true;
    return;
  }
  for (const [car, drive] of [[goldenSaw, sawDrive], [truck, truckDrive]]) {
    const d = Math.hypot(car.position.x - p.x, car.position.z - p.z);
    if (d < 3.5) { enterCar(car, drive); return; }
  }
  for (const t of traffic) {
    const d = Math.hypot(t.car.position.x - p.x, t.car.position.z - p.z);
    if (d < 3.5) {
      const car = t.car;
      traffic.splice(traffic.indexOf(t), 1);
      const drive = makeDriveState(car, { maxSpeed: 38, accel: 15, fuel: 70 });
      drive.yaw = t.yaw;
      enterCar(car, drive);
      const drv = makePedestrian(THREE, 9);
      drv.group.position.set(p.x + 1, 0, p.z + 1);
      scene.add(drv.group);
      peds.push({ m: drv, loop: L.PED_LOOPS[0], seg: 0, speed: 4, phase: 0, flee: true });
      G.money += 200; G.stats.carsStolen++;
      G.police.heat = Math.min(120, G.police.heat + 14);
      toast(G, 'CARJACKED +$200');
      sfx('carjack');
      return;
    }
  }
}
function enterCar(car, drive) {
  const p = G.player;
  p.inCar = true; p.car = car; p.drive = drive;
  p.yaw = drive.yaw;
  eli.group.visible = false;
  sfx('engine-start');
}

// ---------- movement / collision ----------
function collideCircle(x, z, r) {
  for (const c of world.colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
function stepPlayer(dt) {
  const p = G.player;
  if (p.inCar) return;
  const run = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = (run ? 8.5 : 5) * (1 + (G.skills.stamina - 1) * 0.08);
  let ix = 0, iz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) iz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
  const len = Math.hypot(ix, iz) || 1;
  ix /= len; iz /= len;
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  const wx = (ix * cos - iz * sin) * speed * dt;
  const wz = (ix * sin + iz * cos) * speed * dt;
  const nx = p.x + wx, nz = p.z + wz;
  if (!collideCircle(nx, p.z, 0.45)) p.x = nx;
  if (!collideCircle(p.x, nz, 0.45)) p.z = nz;
  p.x = Math.max(-198, Math.min(198, p.x));
  p.z = Math.max(-148, Math.min(148, p.z));
  if (ix !== 0 || iz !== 0) {
    p.yaw = Math.atan2(-(ix * cos - iz * sin), -(ix * sin + iz * cos));
    p.walkPhase += dt * speed * 1.6;
    p.speed = speed;
    eli.walk(p.walkPhase, run ? 0.75 : 0.55);
  } else {
    p.speed = 0;
    eli.idle(G.time);
  }
  if (keys['Space'] && p.onGround) { p.vy = 7; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 22 * dt;
    p.y = (p.y || 0) + p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  eli.group.position.set(p.x, p.y || 0, p.z);
  eli.group.rotation.y = p.yaw;
  for (const gm of goldMeshes) {
    if (gm.visible && Math.hypot(gm.position.x - p.x, gm.position.z - p.z) < 1.6) {
      gm.visible = false;
      G.goldCollected.add(gm.userData.key);
      G.money += 25; G.rep += 5;
      toast(G, 'GOLD BAR +$25');
      sfx('pickup');
    }
  }
}

// ---------- camera ----------
function updateCamera(dt) {
  const p = G.player;
  const focus = p.inCar ? p.car.position : new THREE.Vector3(p.x, 1.2, p.z);
  const dist = p.inCar ? 8 : 6.5;
  const h = p.inCar ? 3.2 : 2.6;
  const yaw = p.inCar ? p.yaw : camYaw;
  const tx = focus.x + Math.sin(yaw) * dist;
  const tz = focus.z + Math.cos(yaw) * dist;
  camera.position.x += (tx - camera.position.x) * Math.min(1, 6 * dt);
  camera.position.y += (h - camera.position.y) * Math.min(1, 6 * dt);
  camera.position.z += (tz - camera.position.z) * Math.min(1, 6 * dt);
  const lo = G.camLookOffset || { x: 0, y: 0, z: 0 };
  camera.lookAt(focus.x + lo.x, focus.y + 0.6 + lo.y, focus.z + lo.z);
}

// ---------- map / title ----------
function toggleMap() {
  HUD.mapOpen = !HUD.mapOpen;
  const ms = document.getElementById('map-screen');
  if (HUD.mapOpen) { buildMapScreen(G); ms.style.display = 'block'; }
  else ms.style.display = 'none';
}

// ---------- save / load ----------
function saveGame() {
  try {
    localStorage.setItem('velora-bay-save-1', JSON.stringify({
      money: G.money, rep: G.rep, gold: [...G.goldCollected], completed: G.completed,
      rating: G.rating, skills: G.skills, day: G.day, currentMission: G.currentMission,
      stats: G.stats, x: G.player.x, z: G.player.z,
    }));
  } catch (e) { /* ignore */ }
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('velora-bay-save-1') || 'null');
    if (!s) return false;
    G.money = s.money; G.rep = s.rep; G.goldCollected = new Set(s.gold);
    G.completed = s.completed; G.rating = s.rating || {}; G.skills = s.skills;
    G.day = s.day; G.stats = Object.assign(G.stats, s.stats);
    G.player.x = s.x; G.player.z = s.z;
    return true;
  } catch (e) { return false; }
}

// ---------- demo staging ----------
function applyDemo() {
  // consistent demo save: M7, $4,120, REP 1240, DAY 4, 80% complete, crew 6/6
  G.money = 4120; G.rep = 1240; G.day = 4;
  G.completed = [1, 2, 3, 4, 5, 6];
  G.rating = { 1: 'gold', 2: 'gold', 3: 'silver', 4: 'gold', 5: 'silver', 6: 'gold' };
  G.goldCollected = new Set(L.GOLD_BARS.slice(0, 9).map((g) => g.x + ',' + g.z));
  G.stats = { carsStolen: 41, takedowns: 23, escapes: 12, timePlayed: '06:42:15', bestWanted: 5, kmDriven: 48.2 };
  G.skills = { driving: 4, stamina: 3, influence: 4, shooting: 3, stealth: 2, street: 3 };
  G.incomePerMin = 50;
  G.started = true;
  HUD.titleOpen = false;
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('hint').style.display = 'none';
  if (DEMO === 'chase') {
    setTimeOfDay(17.2, null);
    startMission(G, 6); // M7
    G.mission.stage = 1; // chase stage
    G.police.heat = 70;
    const p = G.player;
    p.inCar = true; p.car = goldenSaw; p.drive = sawDrive;
    goldenSaw.position.set(-30, 0, 128);
    sawDrive.yaw = -Math.PI / 2; // facing +x (east)
    sawDrive.speed = 48;
    p.yaw = sawDrive.yaw;
    eli.group.visible = false;
    // police convoy: 6 units in pursuit — alongside + just ahead, IN FRAME
    G.police.units.forEach((u, i) => {
      u.active = true; u.car.visible = true; u.state = 'PURSUIT';
      const offs = [[-6, -6], [0, 6], [10, -5], [16, 5], [6, -7], [24, 0]];
      const [dx, dz] = offs[i % offs.length];
      u.x = -30 + dx; u.z = 128 + dz; u.yaw = -Math.PI / 2; u.speed = 44;
      u.car.position.set(u.x, 0, u.z);
    });
    G.police.wanted = 4;
    G.police.heliActive = true; G.police.heli.visible = true;
    G.police.heli.position.set(-24, 16, 124);
    G.police.roadblock.forEach((car, i) => {
      car.visible = true;
      car.position.set(80 + i * 7, 0, 128);
      car.rotation.y = Math.PI / 2;
    });
    // pedestrians fleeing across the boulevard (spread along the street)
    peds.forEach((pd, i) => {
      pd.flee = true;
      pd.m.group.position.set(-50 + i * 9, 0, 122 + (i % 4) * 3);
    });
    traffic[0].pos.x = 60; traffic[0].pos.z = 128; traffic[0].car.position.set(60, 0, 128);
    traffic[1].pos.x = 90; traffic[1].pos.z = 128; traffic[1].car.position.set(90, 0, 128);
    G.dialogue = { name: 'TOMMY', text: 'They\u2019re on us! Stay on Beach Blvd — lose them at the marina!', until: 1e9 };
    G.carFuel = 62; G.carCondition = 100;
    updateCamera(1); // snap camera behind the Saw (headless runs ~0.3 fps; the lerp never converges)
  }
  if (DEMO === 'night') {
    setTimeOfDay(21.5, null);
    startMission(G, 6); // M7
    G.mission.stage = 0;
    const p = G.player;
    p.x = 14; p.z = -30; p.yaw = 0; // facing north, toward the Debate Hall + thugs
    eli.group.position.set(p.x, 0, p.z);
    eli.group.rotation.y = p.yaw;
    G.camLookOffset = { x: 3.5, y: 0, z: 0 }; // look east of Eli: Eli left, thugs right, wheel centre
    camYaw = 0; // camera south of Eli on Center Ave, looking north at his back + the hall
    setWeapon('pistol');
    G.ammo.pistol = { mag: 12, reserve: 48 };
    spawnThugs([{ x: 10, z: -38 }, { x: 20, z: -40 }, { x: 14, z: -44 }], 3);
    G.enemies[0].hp = 26; // hit, recoiling
    damageNumber({ x: 10, y: 1, z: -38 }, '-34', '#ffd700', true); // persistent for the shot
    flash.position.set(p.x - Math.sin(p.yaw) * 0.5, 1.4, p.z - Math.cos(p.yaw) * 0.5);
    flash.lookAt(camera.position);
    flashMat.opacity = 1; flashUntil = 1e12;
    tracerGeo.setFromPoints([new THREE.Vector3(p.x, 1.4, p.z), new THREE.Vector3(10, 1.3, -38)]);
    tracerMat.opacity = 0.9; tracerUntil = 1e12;
    openWheel(G);
    updateCamera(1); // snap camera to its target (headless runs ~0.3 fps; the lerp never converges)
    G.dialogue = { name: 'NADIA', text: 'Hale\u2019s men are coming down the steps — hold them off, Eli!', until: 1e9 };
    document.getElementById('hint').style.display = 'none';
  }
  if (DEMO === 'map') {
    setTimeOfDay(16.5, null);
    startMission(G, 6);
    G.player.x = -40; G.player.z = -45;
    eli.group.position.set(-40, 0, -45);
    camera.position.set(-40, 90, 40);
    camera.lookAt(-40, 0, -45);
    buildMapScreen(G);
    document.getElementById('map-screen').style.display = 'block';
    HUD.mapOpen = true;
  }
  if (DEMO === 'win') {
    setTimeOfDay(20.0, null); // night — the city lights up: glowing windows, lamps, neon
    G.completed = [1, 2, 3, 4, 5, 6, 7, 8];
    G.money = 8888; G.rep = 2500;
    G.win = true;
    camera.position.set(0, 70, 180);
    camera.lookAt(0, 0, 0);
    buildWin(G);
    document.getElementById('win-screen').style.display = 'flex';
  }
  for (const gm of goldMeshes) if (G.goldCollected.has(gm.userData.key)) gm.visible = false;
}

// ---------- boot ----------
buildHUD(G);
initAudio();
if (!DEMO) {
  const had = loadGame();
  if (had && G.completed.length > 0) startMission(G, G.completed.length);
  else startMission(G, 0);
}
applyDemo();
if (DEMO === 'chase' || DEMO === 'night') missionThugs();

// expose test hooks for the headless playtest
window.__velora = {
  G, keys, setWeapon, tryEnterExitCar, attack, eli, camera, world, scene,
  barnaby, goldenSaw, goldMeshes, traffic, peds,
  press(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code })); },
  release(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code })); },
  click() { attack(); },
};

// ---------- main loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0, elapsed = 0;
let readySent = false;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  if (HUD.wheelOpen) dt *= 0.16; // slow-mo while the wheel is open
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  if (!G.paused) {
    G.time += dt;
    G.stats.timePlayed = fmtTime(elapsed);
    const hour = (8 + elapsed / 1200 * 24) % 24;
    if (!DEMO) setTimeOfDay(hour, G.player);
    attackCd = Math.max(0, attackCd - dt);
    if (G.player.inCar && G.player.drive) {
      const d = G.player.drive;
      const input = {
        fwd: keys['KeyW'] || keys['ArrowUp'] || DEMO === 'chase',
        back: keys['KeyS'] || keys['ArrowDown'],
        left: keys['KeyA'] || keys['ArrowLeft'],
        right: keys['KeyD'] || keys['ArrowRight'],
        drift: keys['Space'],
      };
      const r = stepDrive(d, input, dt, world.colliders);
      G.carSpeedKmh = r.speedKmh;
      G.carFuel = d.fuel; G.carCondition = d.condition;
      G.player.x = d.pos.x; G.player.z = d.pos.z; G.player.yaw = d.yaw;
      G.stats.kmDriven += Math.abs(d.speed) * dt / 1000;
      setEngine(true, Math.abs(d.speed) / d.maxSpeed);
      if (r.drifted && Math.random() < dt * 2) { G.money += 15; toast(G, 'DRIFT +$15'); }
      if (DEMO === 'chase' && d.pos.x > 150) { d.pos.x = -30; d.pos.z = 128; }
    } else {
      stepPlayer(dt);
      setEngine(false, 0);
    }
    for (const t of traffic) stepTraffic(t, dt, world.colliders);
    for (const pd of peds) {
      const loop = pd.loop;
      const a = loop[pd.seg], b = loop[(pd.seg + 1) % loop.length];
      const dx = b.x - pd.m.group.position.x, dz = b.z - pd.m.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) pd.seg = (pd.seg + 1) % loop.length;
      else {
        const sp = pd.flee ? 5 : pd.speed;
        pd.m.group.position.x += (dx / d) * sp * dt;
        pd.m.group.position.z += (dz / d) * sp * dt;
        pd.m.group.rotation.y = Math.atan2(-dx, -dz);
        pd.phase += dt * sp * 1.8;
        pd.m.walk(pd.phase, 0.5);
      }
    }
    // Barnaby
    {
      const bp = barnaby.group.position;
      const dx = G.player.x - bp.x, dz = G.player.z - bp.z;
      const d = Math.hypot(dx, dz);
      let nearest = null, nd = 15;
      for (const gm of goldMeshes) {
        if (!gm.visible) continue;
        const gd = Math.hypot(gm.position.x - G.player.x, gm.position.z - G.player.z);
        if (gd < nd) { nd = gd; nearest = gm; }
      }
      G.barnabyGold = !!nearest;
      barnaby.alert.visible = !!nearest;
      if (d > 3) {
        bp.x += (dx / d) * 7 * dt; bp.z += (dz / d) * 7 * dt;
        barnaby.group.rotation.y = Math.atan2(-dx, -dz);
        barnaby.run(elapsed * 10);
      } else barnaby.idle(elapsed);
      const nearCop = G.police.units.some((u) => u.active && Math.hypot(u.x - G.player.x, u.z - G.player.z) < 20);
      if (nearCop && !G.barnabyAlert) { G.barnabyAlert = true; sfx('bark'); toast(G, 'K-9 ALERT — police closing in!'); }
      if (!nearCop) G.barnabyAlert = false;
    }
    // enemies AI
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const dx = G.player.x - e.x, dz = G.player.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d < 18 && d > 1.8) {
        e.x += (dx / d) * 3.2 * dt; e.z += (dz / d) * 3.2 * dt;
        e.phase += dt * 6;
        e.m.walk(e.phase, 0.6);
      } else if (d <= 1.8) {
        e.attackCd -= dt;
        if (e.attackCd <= 0) {
          e.attackCd = 1.1;
          G.hp = Math.max(0, G.hp - 8);
          sfx('hit');
          if (G.hp <= 0) { G.hp = 100; G.player.x = L.SPAWN.x; G.player.z = L.SPAWN.z; toast(G, 'You were taken down — back at the workshop.'); }
        }
        e.m.idle(elapsed);
      } else e.m.idle(elapsed);
      e.group.position.set(e.x, 0, e.z);
      e.group.rotation.y = Math.atan2(-dx, -dz);
    }
    G.enemiesLeft = G.enemies.filter((e) => e.hp > 0).length;
    // police
    const w = updatePolice(G.police, dt, G.player, G.player.speed || 0, () => { if (G.police.wanted === 0) sfx('siren'); });
    G.stats.bestWanted = Math.max(G.stats.bestWanted, w);
    if (w >= 1 && G.player.inCar && Math.hypot(G.player.x - 170, G.player.z - 128) < 12) G.chaseDone = true;
    // missions
    updateMissions(G, dt);
    if (G.mission && G.mission.index !== (G._lastMission ?? -99)) {
      G._lastMission = G.mission.index;
      clearEnemies();
      missionThugs();
    }
    // income ticker
    G._incomeAcc = (G._incomeAcc || 0) + dt;
    if (G._incomeAcc >= 60) { G._incomeAcc = 0; G.money += G.incomePerMin; }
    // interact prompt
    G.interactLabel = null;
    if (!G.player.inCar) {
      for (const [car] of [[goldenSaw], [truck]]) {
        if (Math.hypot(car.position.x - G.player.x, car.position.z - G.player.z) < 3.5) G.interactLabel = '[F] ENTER ' + (car === goldenSaw ? 'THE GOLDEN SAW' : 'TRUCK');
      }
      for (const t of traffic) {
        if (Math.hypot(t.car.position.x - G.player.x, t.car.position.z - G.player.z) < 3.5) G.interactLabel = '[F] CARJACK';
      }
      const m = G.mission ? MISSIONS[G.mission.index] : null;
      if (m && G.objective) {
        const st = m.stages[G.mission.stage];
        if (st && (st.need === 'interact' || st.need === 'rally') && G.objective.dist < st.radius) {
          G.interactLabel = '[E] ' + (st.need === 'rally' ? 'RALLY THE CROWD' : 'INTERACT');
          if (G.interactPressed) { G.rallyPressed = true; G.interactPressed = false; }
        }
      }
    }
    G.interactPressed = false;
    updateWorld(dt, elapsed, G.player);
    updateCamera(dt);
    if (G.win && document.getElementById('win-screen').style.display !== 'flex') {
      buildWin(G);
      document.getElementById('win-screen').style.display = 'flex';
    }
  }
  if (performance.now() > flashUntil) flashMat.opacity = 0;
  if (performance.now() > tracerUntil) tracerMat.opacity = 0;
  updateHUD(G, dt);
  renderer.render(scene, camera);
  if (!readySent) {
    readySent = true;
    window.__ready = true;
    window.__stats = { fps, demo: DEMO, money: G.money, mission: G.currentMission };
  }
}
function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  return [h, m, ss].map((n) => String(n).padStart(2, '0')).join(':');
}
requestAnimationFrame(loop);
