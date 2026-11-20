// VELORA BAY — MAIN BOOTSTRAP (inspection build)
// Renders the world with an orbit / top-down / street camera so the city
// can be inspected before gameplay systems are wired in.
// ?view=orbit (default) | top | street
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { makeEli, makeBarnaby, makePedestrian, animateWalk } from './characters.js';
import { makeCar, makeGoldenSaw } from './vehicles.js';
import { SPAWN, GOLDEN_SAW, PED_LOOPS, TRAFFIC_LOOPS, DISTRICTS } from './layout.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'orbit';

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

const world = buildWorld(scene);

// Eli + Barnaby at spawn
const eli = makeEli();
eli.group.position.set(SPAWN.x, 0, SPAWN.z);
eli.group.rotation.y = SPAWN.rotY;
scene.add(eli.group);
const barnaby = makeBarnaby();
barnaby.group.position.set(SPAWN.x + 2, 0, SPAWN.z + 2);
scene.add(barnaby.group);

// The Golden Saw
const saw = makeGoldenSaw();
saw.group.position.set(GOLDEN_SAW.x, 0, GOLDEN_SAW.z);
saw.group.rotation.y = GOLDEN_SAW.rotY;
scene.add(saw.group);

// a few parked cars around the city
const parked = [
  { x: -60, z: -55, color: 0x7fb3e8, type: 'sedan' },
  { x: 10, z: 55, color: 0xd86a2a, type: 'sedan' },
  { x: 80, z: -55, color: 0x2fb3a3, type: 'taxi' },
  { x: 150, z: 55, color: 0xf5f2e8, type: 'sedan' },
  { x: -130, z: 95, color: 0xe86a92, type: 'sedan' },
  { x: 60, z: 95, color: 0x4a8a4a, type: 'van' },
];
for (const p of parked) {
  const c = makeCar({ color: p.color, type: p.type });
  c.group.position.set(p.x, 0, p.z);
  c.group.rotation.y = (p.x * 7 + p.z * 3) % (Math.PI * 2);
  scene.add(c.group);
}

// pedestrians walking their loops
const peds = [];
for (let i = 0; i < PED_LOOPS.length; i++) {
  const ped = makePedestrian(i);
  ped.group.position.set(PED_LOOPS[i][0][0], 0, PED_LOOPS[i][0][1]);
  scene.add(ped.group);
  peds.push({ fig: ped, loop: PED_LOOPS[i], seg: 0, t: 0, speed: 1.4 + (i % 3) * 0.3, phase: i * 1.7 });
}
// traffic cars driving their loops
const traffic = [];
const trafficColors = [0xd8d2c4, 0x7fb3e8, 0xd86a2a, 0x2fb3a3, 0xe86a92, 0x4a8a4a];
for (let i = 0; i < TRAFFIC_LOOPS.length; i++) {
  const car = makeCar({ color: trafficColors[i % trafficColors.length], type: i === 2 ? 'van' : 'sedan' });
  scene.add(car.group);
  traffic.push({ car, loop: TRAFFIC_LOOPS[i], seg: 0, t: 0, speed: 9 + (i % 3) * 2 });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let frames = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  world.animate(t);
  // pedestrians
  for (const p of peds) {
    const a = p.loop[p.seg];
    const b = p.loop[(p.seg + 1) % p.loop.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    p.t += (p.speed * dt) / len;
    if (p.t >= 1) { p.t = 0; p.seg = (p.seg + 1) % p.loop.length; continue; }
    const x = a[0] + dx * p.t, z = a[1] + dz * p.t;
    p.fig.group.position.set(x, 0, z);
    p.fig.group.rotation.y = Math.atan2(dx, dz);
    p.phase += dt * 6;
    animateWalk(p.fig, p.phase, 0.8);
  }
  // traffic
  for (const tr of traffic) {
    const a = tr.loop[tr.seg];
    const b = tr.loop[(tr.seg + 1) % tr.loop.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) { tr.seg = (tr.seg + 1) % tr.loop.length; continue; }
    tr.t += (tr.speed * dt) / len;
    if (tr.t >= 1) { tr.t = 0; tr.seg = (tr.seg + 1) % tr.loop.length; continue; }
    const x = a[0] + dx * tr.t, z = a[1] + dz * tr.t;
    tr.car.group.position.set(x, 0, z);
    tr.car.group.rotation.y = Math.atan2(dx, dz);
    tr.car.setSpeed(tr.speed * 3.6, 0);
  }
  // Barnaby idle near Eli
  barnaby.animate(t * 2, 0.3);
  // camera
  if (view === 'top') {
    camera.position.set(0, 340, 0.01);
    camera.lookAt(0, 0, 0);
  } else if (view === 'street') {
    const e = eli.group.position;
    camera.position.set(e.x - Math.sin(eli.group.rotation.y) * 7, 3.2, e.z - Math.cos(eli.group.rotation.y) * 7);
    camera.lookAt(e.x, 1.6, e.z);
  } else {
    const a = t * 0.05;
    camera.position.set(Math.sin(a) * 230, 120, Math.cos(a) * 230);
    camera.lookAt(0, 10, 0);
  }
  renderer.render(scene, camera);
  frames++;
  if (frames === 5) {
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').remove(), 500);
    window.__ready = true;
    window.__stats = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, districts: DISTRICTS.length };
  }
}
animate();
