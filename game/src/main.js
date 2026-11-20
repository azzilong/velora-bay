// VELORA BAY — MAIN
// Bootstrap, game loop, state machine (title / game / map / pause / win),
// third-person + chase cameras, input, carjacking, drive-by shooting,
// Barnaby, day/night, saves, unlocks. All systems plug in here.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { makeBarnaby, makePedestrian, animateWalk } from './characters.js';
import { makeCar, makeGoldenSaw } from './vehicles.js';
import { SPAWN, GOLDEN_SAW, PED_LOOPS, DISTRICTS, poi } from './layout.js';
import { createPlayer } from './player.js';
import { makeDriveable, updateDriveable, createTraffic, updateTraffic, tryCarjack } from './driving.js';
import { createPolice } from './police.js';
import { createMissions, MISSION_LIST } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createSystems, SKILL_LIST, CREW_LIST } from './systems.js';

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo');
const STAGE = params.get('stage');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 2000);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const world = buildWorld(scene);
window.__world = world;const audio = createAudio();

// ---------- game state ----------
const G = {
  state: 'title',
  money: 500, rep: 0, level: 1,
  goldBars: 0,
  weapons: { pistol: { unlocked: false }, rifle: { unlocked: false } },
  skills: { driving: 1, stamina: 1, influence: 1, shooting: 1, stealth: 1, street: 1 },
  skillXp: {},
  crew: { tommy: false, rosa: false, nadia: false, marv: false, dina: false, kofi: false },
  districtStanding: { portside: 58, center: 71, marina: 62, neon: 37, beach: 44 },
  properties: { workshop: false, garage: false, safehouse: false },
  missionsDone: [],
  currentMission: 0,
  missionList: MISSION_LIST,
  skillList: SKILL_LIST,
  crewList: CREW_LIST,
  stats: { carsStolen: 0, kmDriven: 0, escapes: 0, takedowns: 0, jumps: 0, timePlayed: 0, bestWanted: 0 },
  time: { day: 1, hour: 16, minute: 20 },
  incomePerMin: 0,
  spawn: SPAWN,
  input: { keys: {}, mouseDX: 0, mouseDY: 0, attack: false, reload: false, weaponKey: null },
  playerYaw: SPAWN.rotY,
  nightTarget: 0,
  nightFactor: 0,
  timeScale: 1,
  camMode: 0,
};
G.rankName = () => (G.rep >= 2000 ? 'MAYOR-IN-WAITING' : G.rep >= 1400 ? 'MADE MAN' : G.rep >= 900 ? 'FIXER' : G.rep >= 500 ? 'HUSTLER' : G.rep >= 200 ? 'STREET' : 'ROOKIE');
G.nextUnlock = () => MISSION_LIST[Math.min(G.currentMission, 7)].unlock;
G.crewCount = () => Object.values(G.crew).filter(Boolean).length;
G.propertyCount = () => Object.values(G.properties).filter(Boolean).length;
G.completion = () => Math.min(100, Math.round((G.missionsDone.length / 8) * 60 + (G.goldBars / 20) * 10 + (G.crewCount() / 6) * 15 + (G.propertyCount() / 3) * 15));
G.playTime = () => {
  const s = Math.floor(G.stats.timePlayed);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
G.addCash = (n, label) => {
  const mult = 1 + (G.skills.influence - 1) * 0.1;
  const amount = Math.round(n * mult);
  G.money += amount;
  if (label) G.hud.toast(label, 'good');
  G.hud.refreshMoney();
};
G.project = (v) => {
  const p = v.clone().project(camera);
  if (p.z > 1) return null;
  return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, z: p.z };
};
G.setNight = (b) => { G.nightTarget = b ? 1 : 0; };
G.setWeapon = (w) => G.playerCtrl.setWeapon(w);
G.saveGame = (slot) => G.systems.save(slot);
G.playerDamage = (n, x, z) => G.playerCtrl.damage(n, x, z);
G.onEnemyDown = (e) => G.missions.onEnemyDown(e);
G.onPlayerDown = () => {
  G.hud.toast('ELI IS DOWN — THE CREW DRAGS YOU TO THE SAFEHOUSE. -$100', 'bad');
  G.money = Math.max(0, G.money - 100);
  G.player.hp = 50;
  G.player.dead = false;
  G.player.pos.set(G.properties.safehouse ? 170 : -105, 0, G.properties.safehouse ? 25 : -30);
  G.police.P.heat = 0;
  G.police.updateWanted();
  G.hud.refreshMoney();
};
G.applyUnlock = (name) => {
  if (name === 'PISTOL') { G.weapons.pistol.unlocked = true; G.player.ammo.pistol = 12; G.player.reserve.pistol = 48; }
  if (name === 'RIFLE') { G.weapons.rifle.unlocked = true; G.player.ammo.rifle = 30; G.player.reserve.rifle = 90; }
  if (name === 'GARAGE') G.properties.garage = true;
  if (name === 'SAFEHOUSE') G.properties.safehouse = true;
  if (name === 'CREW — DINA') { G.crew.dina = true; G.crew.marv = true; G.crew.kofi = true; }
  if (name === 'CITY HALL') G.properties.cityhall = true;
  if (name === 'GOLD PAINT') G.hud.toast('THE GOLDEN SAW — FRESH GOLD PAINT', 'good');
  G.incomePerMin = G.systems.incomePerMin();
  G.hud.refreshWeapons();
  G.hud.refreshMoney();
};
G.winGame = () => {
  G.state = 'win';
  document.exitPointerLock?.();
  $('hud').style.display = 'none';
  $('win-screen').style.display = 'block';
  $('win-stats').innerHTML = `Missions 8/8 · Gold Bars ${G.goldBars}/20 · Crew ${G.crewCount()}/6<br>Cars stolen ${G.stats.carsStolen} · Takedowns ${G.stats.takedowns} · Escapes ${G.stats.escapes}<br>Time played ${G.playTime()} · Best wanted ${'★'.repeat(G.stats.bestWanted)}`;
  $('win-crew').innerHTML = CREW_LIST.map((c) => `<div class="crewrow"><div class="face">${c.name[0]}</div><div><b>${c.name}</b><div class="role">${c.role}</div></div></div>`).join('');
  audio.mission();
};

const $ = (id) => document.getElementById(id);
G.hud = createHud(G);
G.audio = audio;

// ---------- player / vehicles / police / missions / systems ----------
const playerCtrl = createPlayer(scene, world, G);
G.playerCtrl = playerCtrl;
G.player = playerCtrl.P;

const sawCar = makeGoldenSaw();
sawCar.group.position.set(GOLDEN_SAW.x, 0, GOLDEN_SAW.z);
sawCar.group.rotation.y = GOLDEN_SAW.rotY;
scene.add(sawCar.group);
const saw = makeDriveable(sawCar, { maxSpeed: 48, accel: 19, fuel: 62 });
saw.isPlayer = false;

const parkedCars = [];
for (const [x, z, color, type] of [
  [-60, -55, 0x7fb3e8, 'sedan'], [10, 55, 0xd86a2a, 'sedan'], [80, -55, 0x2fb3a3, 'taxi'],
  [150, 55, 0xf5f2e8, 'sedan'], [-130, 95, 0xe86a92, 'sedan'], [60, 95, 0x4a8a4a, 'van'],
]) {
  const c = makeCar({ color, type });
  c.group.position.set(x, 0, z);
  c.group.rotation.y = (x * 7 + z * 3) % (Math.PI * 2);
  scene.add(c.group);
  parkedCars.push(makeDriveable(c, { maxSpeed: 38, accel: 13, fuel: 40 + ((x + z) % 30) }));
}

let traffic = createTraffic(scene, world, makeCar, 8);
const police = createPolice(scene, world, G);
G.police = police;
const missions = createMissions(scene, world, G);
G.missions = missions;
const systems = createSystems(scene, world, G);
G.systems = systems;

// pedestrians
const peds = [];
for (let i = 0; i < PED_LOOPS.length; i++) {
  const ped = makePedestrian(i);
  ped.group.position.set(PED_LOOPS[i][0][0], 0, PED_LOOPS[i][0][1]);
  scene.add(ped.group);
  peds.push({ fig: ped, loop: PED_LOOPS[i], seg: 0, t: (i * 0.31) % 1, speed: 1.4 + (i % 3) * 0.3, phase: i * 1.7 });
}

// Barnaby
const barnaby = makeBarnaby();
barnaby.group.position.set(SPAWN.x + 2, 0, SPAWN.z + 2);
scene.add(barnaby.group);
let barnabyPhase = 0;
let barkCd = 0;
window.__traffic = traffic;
window.__barnaby = barnaby.group;

// ---------- input ----------
const input = G.input;
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); if (G.state === 'game' && !G.hud.wheelOpen) G.hud.openWheel(); return; }
  input.keys[e.code] = true;
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'Digit1') input.weaponKey = 'fists';
  if (e.code === 'Digit2') input.weaponKey = 'hammer';
  if (e.code === 'Digit3') input.weaponKey = 'pistol';
  if (e.code === 'Digit4') input.weaponKey = 'rifle';
  if (e.code === 'KeyM') toggleMap();
  if (e.code === 'KeyC' && G.state === 'game') G.camMode = (G.camMode + 1) % 3;
  if (e.code === 'Escape') {
    if (G.state === 'game') pauseGame();
    else if (G.state === 'pause') resumeGame();
    else if (G.state === 'map') toggleMap();
  }
  if (e.code === 'KeyF' && G.state === 'game') tryEnterExitVehicle();
});
addEventListener('keyup', (e) => {
  input.keys[e.code] = false;
  if (e.code === 'Tab' && G.hud.wheelOpen) G.hud.closeWheel();
});
renderer.domElement.addEventListener('click', () => {
  audio.unlock();
  if (G.state === 'game' && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock?.();
  }
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  }
});
addEventListener('mousedown', (e) => {
  if (e.button === 0 && G.state === 'game') {
    if (G.hud.wheelOpen) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const seg = el?.closest?.('.seg');
      if (seg) G.hud.wheelSelect(seg.dataset.w);
      G.hud.closeWheel();
    } else {
      input.attack = true;
    }
  }
  if (e.button === 2) G._rDrag = true;
});
addEventListener('mouseup', (e) => { if (e.button === 2) G._rDrag = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (G._rDrag && G.state === 'game') {
    input.mouseDX += e.movementX;
    input.mouseDY += e.movementY;
  }
});
// wheel mouse hover select
document.querySelectorAll('#wheel .seg').forEach((el) => {
  el.addEventListener('mouseenter', () => { if (G.hud.wheelOpen) G.hud.wheelSelect(el.dataset.w); });
});
document.querySelectorAll('#weapon-bar .wslot').forEach((el) => {
  el.addEventListener('click', () => { if (G.state === 'game') G.setWeapon(el.dataset.w); });
});

// ---------- vehicle enter / exit / carjack ----------
let playerVehicle = null;
G.playerVehicle = null;
function nearestDriveable(maxD = 4.2) {
  const p = G.player.pos;
  const cands = [{ d: saw, label: 'ENTER THE GOLDEN SAW' }];
  if (G.missions.truckD) cands.push({ d: G.missions.truckD, label: 'ENTER THE LUMBER TRUCK' });
  for (const pc of parkedCars) cands.push({ d: pc, label: 'ENTER VEHICLE' });
  for (const tr of traffic) cands.push({ d: tr.d, label: 'CARJACK — PRESS F', traffic: tr });
  let best = null, bestD = maxD;
  for (const c of cands) {
    const cp = c.d.car.group.position;
    const d = Math.hypot(cp.x - p.x, cp.z - p.z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}
function tryEnterExitVehicle() {
  if (playerVehicle) {
    // exit: place Eli beside the car
    const cp = playerVehicle.car.group.position;
    const ry = playerVehicle.car.group.rotation.y;
    const sx = cp.x + Math.cos(ry) * 2.6, sz = cp.z - Math.sin(ry) * 2.6;
    G.player.pos.set(sx, 0, sz);
    G.player.fig.group.visible = true;
    playerVehicle.isPlayer = false;
    playerVehicle.speed = 0;
    playerVehicle = null;
    G.playerVehicle = null;
    G.player.vehicle = null;
    audio.engine(false);
    G.hud.setSpeedo(false);
    return;
  }
  const near = nearestDriveable();
  if (!near) return;
  if (near.traffic) {
    // carjack: driver flees, wanted rises
    const tr = near.traffic;
    traffic = traffic.filter((t) => t !== tr);
    G.stats.carsStolen++;
    G.addCash(200, 'CARJACKED +$200');
    police.addHeat(14, 'CARJACKING — VBPD ALERTED');
    audio.reward();
    // driver runs away on foot
    const drv = makePedestrian(3);
    const cp = tr.d.car.group.position;
    drv.group.position.set(cp.x + 2, 0, cp.z + 2);
    scene.add(drv.group);
    peds.push({ fig: drv, loop: [[cp.x + 2, cp.z + 2], [cp.x + 30, cp.z + 20], [cp.x + 2, cp.z + 2]], seg: 0, t: 0, speed: 5, phase: 0, flee: true });
  } else {
    G.hud.toast(near.d === saw ? 'THE GOLDEN SAW — YOUR FATHER’S CAR' : 'VEHICLE TAKEN', 'good');
  }
  playerVehicle = near.d;
  G.playerVehicle = playerVehicle;
  playerVehicle.isPlayer = true;
  G.player.vehicle = playerVehicle;
  G.player.fig.group.visible = false;
  audio.engine(true);
  G.player.camYaw = playerVehicle.car.group.rotation.y;
}

// ---------- state machine ----------
function showScreen(name) {
  $('title-screen').style.display = name === 'title' || name === 'map' ? 'block' : 'none';
  $('win-screen').style.display = name === 'win' ? 'block' : 'none';
  $('pause').style.display = name === 'pause' ? 'flex' : 'none';
  $('hud').style.display = name === 'game' ? 'block' : 'none';
}
function startGame(fresh) {
  if (fresh) {
    // reset to a new game
    G.money = 500; G.rep = 0; G.level = 1; G.goldBars = 0;
    G.missionsDone = []; G.currentMission = 0;
    G.crew = { tommy: false, rosa: false, nadia: false, marv: false, dina: false, kofi: false };
    G.districtStanding = { portside: 58, center: 71, marina: 62, neon: 37, beach: 44 };
    G.properties = { workshop: false, garage: false, safehouse: false };
    G.weapons = { pistol: { unlocked: false }, rifle: { unlocked: false } };
    G.stats = { carsStolen: 0, kmDriven: 0, escapes: 0, takedowns: 0, jumps: 0, timePlayed: 0, bestWanted: 0 };
    G.time = { day: 1, hour: 16, minute: 20 };
    G.player.pos.set(SPAWN.x, 0, SPAWN.z);
    G.player.hp = 100; G.player.armor = 0; G.player.dead = false;
    G.player.ammo = { pistol: 0, rifle: 0 };
    G.player.reserve = { pistol: 48, rifle: 90 };
    G.setWeapon('hammer');
    missions.startMission(0);
  }
  G.state = 'game';
  showScreen('game');
  G.hud.refreshMoney();
  G.hud.refreshVitals();
  G.hud.refreshWeapons();
  G.hud.setWanted(police.P.wanted);
  audio.radio(true);
  renderer.domElement.requestPointerLock?.();
}
function toggleMap() {
  if (G.state === 'game') {
    G.state = 'map';
    G.hud.fillTitle();
    G.hud.drawMap(G.player.pos, missions.objective);
    showScreen('map');
    document.exitPointerLock?.();
  } else if (G.state === 'map') {
    G.state = 'game';
    showScreen('game');
  }
}
function pauseGame() {
  G.state = 'pause';
  showScreen('pause');
  document.exitPointerLock?.();
}
function resumeGame() {
  G.state = 'game';
  showScreen('game');
}
$('btn-continue').addEventListener('click', () => {
  audio.unlock();
  if (G.state === 'map') { toggleMap(); return; }
  if (systems.hasSave(1)) {
    systems.load(1);
    missions.startMission(G.currentMission);
    startGame(false);
  } else startGame(true);
});
$('btn-new').addEventListener('click', () => { audio.unlock(); startGame(true); });
$('btn-resume').addEventListener('click', resumeGame);
$('btn-save').addEventListener('click', () => systems.save(1));
$('btn-quit').addEventListener('click', () => { systems.save(1); G.state = 'title'; G.hud.fillTitle(); showScreen('title'); });
$('btn-free-roam').addEventListener('click', () => { G.state = 'game'; showScreen('game'); });
$('btn-title').addEventListener('click', () => { G.state = 'title'; G.hud.fillTitle(); showScreen('title'); });

// ---------- demo staging (screenshots) ----------
function applyDemo() {
  if (DEMO !== 'mid') return;
  G.money = 4120; G.rep = 1240; G.level = 4;
  G.missionsDone = [0, 1, 2, 3, 4, 5];
  G.currentMission = 6;
  G.goldBars = 9;
  G.crew = { tommy: true, rosa: true, nadia: true, marv: true, dina: true, kofi: true };
  G.districtStanding = { portside: 78, center: 82, marina: 71, neon: 58, beach: 66 };
  G.properties = { workshop: true, garage: true, safehouse: true };
  G.weapons = { pistol: { unlocked: true }, rifle: { unlocked: false } };
  G.player.ammo = { pistol: 12, rifle: 0 };
  G.player.reserve = { pistol: 48, rifle: 90 };
  G.skills = { driving: 3, stamina: 2, influence: 3, shooting: 2, stealth: 2, street: 2 };
  G.stats = { carsStolen: 41, kmDriven: 48.2, escapes: 12, takedowns: 23, jumps: 9, timePlayed: 6 * 3600 + 42 * 60 + 15, bestWanted: 5 };
  G.time = { day: 4, hour: 16, minute: 20 };
  G.incomePerMin = systems.incomePerMin();
}
function stageScene() {
  if (!STAGE) return;
  applyDemo();
  if (STAGE === 'chase') {
    // M7 chase on Beach Blvd: Eli in the Golden Saw at speed, wanted 4, heli, pursuit
    missions.startMission(6);
    missions.setStage(1); // enter the chase stage (armored truck + heat)
    G.state = 'game';
    showScreen('game');
    sawCar.group.position.set(69, 0, 100);
    sawCar.group.rotation.y = -Math.PI / 2; // east along Beach Blvd
    playerVehicle = saw;
    G.playerVehicle = saw;
    saw.isPlayer = true;
    G.player.vehicle = saw;
    G.player.fig.group.visible = false;
    saw.speed = 46;
    saw.fuel = 62; saw.condition = 100;
    G.player.camYaw = -Math.PI / 2; // chase cam starts behind the car, looking east
    G.input.keys['KeyW'] = true; // hold the throttle so the chase keeps its speed
    // armored truck ahead on the boulevard (mission spawns it at 40 — move it into view, far lane)
    if (missions.armored) missions.armored.group.position.set(100, 0, 90);
    police.P.heat = 72;
    police.updateWanted(); // spawns 5 patrol units at wanted 4
    // take the first 3, put them in the shot as pursuers; the other 2 patrol far away
    for (let i = 0; i < 3; i++) {
      const u = police.P.units[i];
      u.d.maxSpeed = 44; // trail the Saw for the shot instead of ramming it
      u.state = 'PURSUIT';
    }
    // pursuers trail well behind (in the HUD count, not blocking the frame)
    police.P.units[0].d.car.group.position.set(55, 0, 105);
    police.P.units[1].d.car.group.position.set(47, 0, 95);
    police.P.units[2].d.car.group.position.set(39, 0, 105);
    G.player.pos.set(69, 0, 100);
    G.hud.say('TOMMY', 'They’re on us! Stay on Beach Blvd — lose them at the marina!', 60000);
    G.hud.refreshMoney(); G.hud.refreshVitals(); G.hud.refreshWeapons();
  } else if (STAGE === 'night') {
    // M7 debate aftermath on foot, night, pistol out, thugs closing in
    G.setNight(true);
    G.nightFactor = 1;
    missions.startMission(6);
    G.state = 'game';
    showScreen('game');
    G.player.pos.set(30, 0, 48);
    G.player.fig.group.position.set(30, 0, 48);
    G.player.yaw = Math.PI;
    G.player.camYaw = Math.PI;
    G.setWeapon('pistol');
    G.player.ammo.pistol = 12;
    police.P.heat = 26;
    police.updateWanted();
    missions.debugSpawn(35, 44);
    missions.debugSpawn(42, 44);
    missions.debugSpawn(26, 44);
    G.hud.say('NADIA', 'Hale’s men are coming down the steps — hold them off, Eli!', 60000);
    G.hud.refreshMoney(); G.hud.refreshVitals(); G.hud.refreshWeapons();
  } else if (STAGE === 'map' || STAGE === 'title') {
    G.state = 'title';
    G.hud.fillTitle();
    G.hud.drawMap(G.player.pos, null);
    showScreen('title');
  } else if (STAGE === 'win') {
    applyDemo();
    G.missionsDone = [0, 1, 2, 3, 4, 5, 6, 7];
    G.winGame();
  }
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const playerLight = new THREE.PointLight(0xbfd4ff, 0, 30, 1.2);
scene.add(playerLight);
let orbitAngle = 0;
function updateCamera(dt) {
  if (G.state === 'title' || G.state === 'map' || G.state === 'win') {
    orbitAngle += dt * 0.03;
    const r = STAGE === 'title' ? 150 : 230;
    camera.position.set(Math.sin(orbitAngle) * r, 110, Math.cos(orbitAngle) * r);
    camera.lookAt(0, 8, 0);
    return;
  }
  if (G.state !== 'game') return;
  const P = G.player;
  const dists = [7.5, 5.2, 10.5];
  const dist = playerVehicle ? 11 : dists[G.camMode];
  const height = playerVehicle ? 4.2 : 3.1 + G.camMode * 0.4;
  let anchor, yaw;
  if (playerVehicle) {
    anchor = playerVehicle.car.group.position;
    // chase cam follows the car's heading with lag
    const carYaw = playerVehicle.car.group.rotation.y;
    let dy = carYaw - P.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    P.camYaw += dy * Math.min(1, dt * 2.4);
    yaw = P.camYaw;
  } else {
    anchor = P.pos;
    yaw = P.camYaw;
  }
  const desired = new THREE.Vector3(
    anchor.x + Math.sin(yaw) * dist,
    height,
    anchor.z + Math.cos(yaw) * dist,
  );
  // keep the camera out of buildings: clamp height above ground is fine (open world)
  const k = 1 - Math.exp(-dt * 7);
  camPos.lerp(desired, k);
  camera.position.copy(camPos);
  const look = new THREE.Vector3(anchor.x, 1.6, anchor.z);
  if (playerVehicle) {
    const f = new THREE.Vector3(-Math.sin(P.camYaw), 0, -Math.cos(P.camYaw));
    look.addScaledVector(f, 6);
  }
  camTarget.lerp(look, 1 - Math.exp(-dt * 10));
  camera.lookAt(camTarget);
  camera.position.y = Math.max(camera.position.y, 1.2);
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let frames = 0;
let hudTick = 0;
function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = rawDt * G.timeScale;
  const t = clock.elapsedTime;
  world.animate(t);
  // slow-mo while the weapon wheel is open
  G.timeScale = G.hud.wheelOpen ? 0.16 : 1;

  if (G.state === 'game') {
    G.stats.timePlayed += dt;
    G.stats.bestWanted = Math.max(G.stats.bestWanted, police.P.wanted);
    // player / driving
    if (playerVehicle) {
      const dInput = {
        up: input.keys['KeyW'], down: input.keys['KeyS'],
        left: input.keys['KeyA'], right: input.keys['KeyD'],
        handbrake: input.keys['Space'],
      };
      updateDriveable(playerVehicle, dt, dInput, world, G, [...traffic.map((tr) => tr.d), ...parkedCars, saw].filter((d) => d !== playerVehicle));
      G.player.pos.copy(playerVehicle.car.group.position);
      G.playerYaw = playerVehicle.car.group.rotation.y;
      audio.engineSpeed(Math.abs(playerVehicle.speed) / playerVehicle.maxSpeed);
      G.hud.setSpeedo(true, Math.abs(playerVehicle.speed) * 3.6, playerVehicle === saw ? 'THE GOLDEN SAW' : 'STOLEN CAR', playerVehicle.condition, playerVehicle.fuel);
      $('help').style.display = 'none';
      systems.gainXp('driving', dt * 0.6);
      // drive-by shooting (M7 / pistol unlocked)
      if (input.attack && G.weapons.pistol.unlocked && G.player.ammo.pistol > 0) {
        input.attack = false;
        G.player.ammo.pistol--;
        audio.shot('pistol');
        G.hud.muzzle();
        const p = playerVehicle.car.group.position;
        let best = null, bestD = 40;
        for (const u of police.P.units) {
          const up = u.d.car.group.position;
          const d = Math.hypot(up.x - p.x, up.z - p.z);
          if (d < bestD) { best = u; bestD = d; }
        }
        if (best) {
          best.d.condition = Math.max(0, best.d.condition - 20);
          G.hud.damageNumber(best.d.car.group.position, '-34');
          if (best.d.condition <= 0) {
            best.d.car.group.position.set(0, -50, 0);
            G.hud.toast('POLICE UNIT DISABLED', 'good');
          }
        }
        G.hud.refreshWeapons();
      }
      input.attack = false;
    } else {
      playerCtrl.update(dt, input, missions.enemies);
      G.playerYaw = G.player.yaw;
      G.hud.setSpeedo(false);
      $('help').style.display = 'block';
      systems.collectGold();
    }
    // traffic + pedestrians
    updateTraffic(traffic, dt, world);
    for (const p of peds) {
      const a = p.loop[p.seg];
      const b = p.loop[(p.seg + 1) % p.loop.length];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      p.t += (p.speed * dt) / Math.max(1, len);
      if (p.t >= 1) { p.t = 0; p.seg = (p.seg + 1) % p.loop.length; continue; }
      const x = a[0] + dx * p.t, z = a[1] + dz * p.t;
      p.fig.group.position.set(x, 0, z);
      p.fig.group.rotation.y = Math.atan2(dx, dz);
      p.phase += dt * 6;
      animateWalk(p.fig, p.phase, 0.8);
    }
    // police
    police.update(dt, G.player.pos, playerVehicle, playerVehicle ? playerVehicle.speed : G.player.speed);
    // missions + systems (they own the E-interact prompt via G._promptSet)
    G._promptSet = false;
    missions.update(dt);
    systems.updateJobs(dt);
    systems.incomeTick(dt);
    // vehicle prompt only when no mission/job prompt is showing
    if (!playerVehicle && !G._promptSet) {
      const near = nearestDriveable();
      G.hud.setInteract(near ? (near.traffic ? 'CARJACK — STEAL THE CAR' : near.d === saw ? 'ENTER THE GOLDEN SAW' : 'ENTER VEHICLE') : null);
    }
    // Barnaby
    barkCd = Math.max(0, barkCd - dt);
    barnabyPhase += dt * 5;
    const bp = barnaby.group.position;
    const nearGold = systems.nearestGold();
    const policeNear = police.P.units.some((u) => {
      const up = u.d.car.group.position;
      return Math.hypot(up.x - G.player.pos.x, up.z - G.player.pos.z) < 26;
    });
    if (playerVehicle) {
      barnaby.group.visible = false;
    } else {
      barnaby.group.visible = true;
      if (police.P.wanted > 0 && policeNear) {
        G.hud.setK9(true, '🐕 K-9 ALERT — BARNABY SENSES POLICE');
        if (barkCd <= 0) { barkCd = 3; audio.bark(); barnaby.bark(); }
      } else if (nearGold && nearGold.d < 30) {
        G.hud.setK9(true, '🐕 BARNABY SMELLS GOLD NEARBY — FOLLOW HIM!');
        // run toward the gold
        const dx = nearGold.g.x - bp.x, dz = nearGold.g.z - bp.z;
        const d = Math.hypot(dx, dz);
        if (d > 2) {
          bp.x += (dx / d) * 5 * dt; bp.z += (dz / d) * 5 * dt;
          barnaby.group.rotation.y = Math.atan2(dx, dz);
          barnaby.animate(barnabyPhase, 1);
        }
      } else {
        G.hud.setK9(false);
        const dx = G.player.pos.x - bp.x, dz = G.player.pos.z - bp.z;
        const d = Math.hypot(dx, dz);
        if (d > 3.5) {
          bp.x += (dx / d) * 6 * dt; bp.z += (dz / d) * 6 * dt;
          barnaby.group.rotation.y = Math.atan2(dx, dz);
          barnaby.animate(barnabyPhase, 1);
        } else {
          barnaby.animate(t * 2, 0.25);
        }
      }
    }
    // HUD refresh (10 Hz)
    hudTick += dt;
    if (hudTick > 0.1) {
      hudTick = 0;
      G.hud.refreshVitals();
      G.hud.drawMinimap(G.player.pos, G.playerYaw, missions.objective, missions.enemies, systems.goldLeft.filter((g) => !g.taken));
      if (police.P.wanted > 0) G.hud.setWanted(police.P.wanted);
    }
  }

  // day / night lerp
  G.nightFactor += (G.nightTarget - G.nightFactor) * Math.min(1, rawDt * 0.8);
  const nf = G.nightFactor;
  world.sunLight.intensity = 2.4 - nf * 2.15;
  world.sunLight.color.setHex(nf > 0.5 ? 0x8aa8d8 : 0xffd9a0);
  world.hemi.intensity = 0.85 - nf * 0.73;
  world.sky.material.color.setScalar(1 - nf * 0.98);
  world.sunDisc.visible = nf < 0.4;
  world.cloudMat.color.setScalar(1 - nf * 0.97);
  // night player light: a soft moon halo that keeps Eli and nearby thugs readable
  playerLight.position.set(G.player.pos.x, 7, G.player.pos.z);
  playerLight.intensity = nf * 1.4;
  scene.background.lerpColors(new THREE.Color(0xf6c98a), new THREE.Color(0x0e1a2e), nf);
  scene.fog.color.lerpColors(new THREE.Color(0xf2d3a0), new THREE.Color(0x141f30), nf);

  updateCamera(rawDt);
  renderer.render(scene, camera);
  frames++;
  if (frames === 5) {
    const loading = document.getElementById('loading');
    if (loading) { loading.style.opacity = '0'; setTimeout(() => loading.remove(), 500); }
    window.__ready = true;
    window.__game = G;
    window.__stats = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, state: G.state };
  }
}

// ---------- boot ----------
applyDemo();
if (STAGE) stageScene();
else {
  G.hud.fillTitle();
  G.hud.drawMap(G.player.pos, null);
  showScreen('title');
}
animate();
