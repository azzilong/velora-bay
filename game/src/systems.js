// VELORA BAY — SYSTEMS
// Save/load (localStorage slots), six skills with real gameplay effects,
// crew roster, three properties + income ticker, side jobs (taxi + street
// race) with real objectives and rewards, gold-bar collection.
import * as THREE from '../vendor/three.module.min.js';
import { GOLD_BARS } from './layout.js';

export const SKILL_LIST = [
  { id: 'driving', name: 'DRIVING', effect: '+4% top speed / level' },
  { id: 'stamina', name: 'STAMINA', effect: '+10 max HP / level' },
  { id: 'influence', name: 'INFLUENCE', effect: '+10% cash rewards / level' },
  { id: 'shooting', name: 'SHOOTING', effect: '+8% weapon damage / level' },
  { id: 'stealth', name: 'STEALTH', effect: '-15% guard detection / level' },
  { id: 'street', name: 'STREET SENSE', effect: '+10% property income / level' },
];
export const CREW_LIST = [
  { id: 'tommy', name: 'Tommy Reyes', role: 'COMBAT · BACKUP DRIVER', cut: 15 },
  { id: 'rosa', name: 'Rosa Delgado', role: 'INTELLIGENCE · SCOUTING', cut: 15 },
  { id: 'nadia', name: 'Nadia Kline', role: 'CAMPAIGN MANAGER', cut: 15 },
  { id: 'marv', name: 'Big Marv Okafor', role: 'UNION LEADER · MUSCLE', cut: 15 },
  { id: 'dina', name: 'Dina Santos', role: 'ESCAPE DRIVER', cut: 20 },
  { id: 'kofi', name: 'Old Man Kofi', role: 'FISHING · HARBOR EXPERT', cut: 20 },
];

export function createSystems(scene, world, G) {
  const S = {
    jobs: [],           // side-job markers { kind, x, z, state, ... }
    goldLeft: GOLD_BARS.map((g) => ({ ...g, taken: false })),
  };

  // ---------- skills ----------
  S.skillLevel = (id) => G.skills[id] || 1;
  S.gainXp = (id, n) => {
    G.skillXp[id] = (G.skillXp[id] || 0) + n;
    const lv = Math.min(6, 1 + Math.floor(G.skillXp[id] / 100));
    if (lv > G.skills[id]) {
      G.skills[id] = lv;
      G.hud.toast(`SKILL UP — ${id.toUpperCase()} LV ${lv}`, 'good');
      G.audio.reward();
      if (id === 'stamina') G.player.hp = Math.min(G.player.hp + 10, 100 + (lv - 1) * 10);
    }
  };
  S.maxHp = () => 100 + (S.skillLevel('stamina') - 1) * 10;
  S.cashMult = () => 1 + (S.skillLevel('influence') - 1) * 0.1;
  S.dmgMult = () => 1 + (S.skillLevel('shooting') - 1) * 0.08;

  // ---------- properties + income ----------
  S.incomePerMin = () => {
    let base = 0;
    if (G.properties.workshop) base += 10;
    if (G.properties.garage) base += 20;
    if (G.properties.safehouse) base += 15;
    return Math.round(base * (1 + (S.skillLevel('street') - 1) * 0.1));
  };
  S.incomeTick = (dt) => {
    S._incomeAcc = (S._incomeAcc || 0) + dt;
    if (S._incomeAcc >= 60) {
      S._incomeAcc = 0;
      const inc = S.incomePerMin();
      if (inc > 0) {
        G.money += inc;
        G.hud.toast(`PROPERTY INCOME +$${inc}`, 'good');
        G.hud.refreshMoney();
      }
    }
  };

  // ---------- gold bars ----------
  S.collectGold = () => {
    const p = G.player.pos;
    for (let i = 0; i < S.goldLeft.length; i++) {
      const g = S.goldLeft[i];
      if (g.taken) continue;
      if (Math.hypot(p.x - g.x, p.z - g.z) < 2.2) {
        g.taken = true;
        G.goldBars++;
        G.rep += 5;
        G.addCash(25, 'GOLD BAR +$25');
        G.audio.pickup();
        S.gainXp('street', 8);
        // hide the bar instance
        const m4 = new THREE.Matrix4();
        m4.makeScale(0, 0, 0);
        world.goldBarMesh.setMatrixAt(i, m4);
        world.goldBarMesh.instanceMatrix.needsUpdate = true;
        G.hud.toast(`GOLD BAR ${G.goldBars}/20 — BARNABY FOUND IT`, 'good');
      }
    }
  };
  S.nearestGold = () => {
    const p = G.player.pos;
    let best = null, bestD = 1e9;
    for (const g of S.goldLeft) {
      if (g.taken) continue;
      const d = Math.hypot(p.x - g.x, p.z - g.z);
      if (d < bestD) { best = g; bestD = d; }
    }
    return best ? { g: best, d: bestD } : null;
  };

  // ---------- side jobs ----------
  function jobMarker(x, z, color) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, 2.2, z);
    scene.add(m);
    return m;
  }
  function addTaxiJob() {
    const marker = jobMarker(-35, 62, 0xf2b32c);
    S.jobs.push({ kind: 'taxi', state: 'idle', x: -35, z: 62, marker, dest: null });
  }
  function addRaceJob() {
    const marker = jobMarker(-160, 100, 0xe86a92);
    S.jobs.push({ kind: 'race', state: 'idle', x: -160, z: 100, marker, gates: [], gateIdx: 0, timer: 0 });
  }
  addTaxiJob();
  addRaceJob();

  S.updateJobs = (dt) => {
    const p = G.player.pos;
    for (const j of S.jobs) {
      if (j.kind === 'taxi') {
        if (j.state === 'idle') {
          const d = Math.hypot(p.x - j.x, p.z - j.z);
          if (d < 3.5) { G._promptSet = true; G.hud.setInteract('E — TAXI JOB: PICK UP THE FARE'); }
          if (d < 3.5 && G.input.keys['KeyE']) {
            j.state = 'driving';
            const dests = [[150, 25], [105, 80], [-35, 25], [170, -90]];
            const dest = dests[Math.floor(Math.random() * dests.length)];
            j.dest = { x: dest[0], z: dest[1] };
            j.destMarker = jobMarker(dest[0], dest[1], 0x7fd08a);
            G.hud.toast('TAXI JOB — DRIVE THE FARE TO THE MARKER', 'good');
            G.hud.say('FARE', 'Take me across town, quick — and no cops!', 4000);
          }
        } else if (j.state === 'driving') {
          const d = Math.hypot(p.x - j.dest.x, p.z - j.dest.z);
          if (d < 5 && G.player.vehicle) {
            j.state = 'idle';
            scene.remove(j.destMarker);
            G.addCash(150, 'TAXI FARE +$150');
            G.rep += 8;
            S.gainXp('driving', 15);
            G.hud.toast('TAXI JOB DONE +$150', 'good');
          }
        }
      } else if (j.kind === 'race') {
        if (j.state === 'idle') {
          const d = Math.hypot(p.x - j.x, p.z - j.z);
          if (d < 3.5) { G._promptSet = true; G.hud.setInteract('E — STREET RACE: BEACH BLVD SPRINT'); }
          if (d < 3.5 && G.input.keys['KeyE'] && G.player.vehicle) {
            j.state = 'racing';
            j.gateIdx = 0;
            j.timer = 0;
            j.gates = [[-100, 100], [-20, 100], [60, 100], [140, 100], [190, 100]];
            j.gateMarkers = j.gates.map(([x, z]) => jobMarker(x, z, 0xe86a92));
            G.hud.toast('RACE START — 5 GATES, BEACH BLVD EAST', 'good');
          }
        } else if (j.state === 'racing') {
          j.timer += dt;
          const gate = j.gates[j.gateIdx];
          const d = Math.hypot(p.x - gate[0], p.z - gate[1]);
          if (d < 6) {
            scene.remove(j.gateMarkers[j.gateIdx]);
            j.gateIdx++;
            G.audio.reward();
            if (j.gateIdx >= j.gates.length) {
              j.state = 'idle';
              const bonus = j.timer < 45 ? 300 : 150;
              G.addCash(bonus, `RACE WON +$${bonus} (${Math.round(j.timer)}s)`);
              G.rep += 15;
              S.gainXp('driving', 25);
            }
          }
          if (!G.player.vehicle) { j.state = 'idle'; j.gateMarkers.forEach((m) => scene.remove(m)); G.hud.toast('RACE ABANDONED — YOU LEFT THE CAR', 'bad'); }
        }
      }
    }
  };

  // ---------- save / load ----------
  S.save = (slot = 1) => {
    const data = {
      money: G.money, rep: G.rep, level: G.level,
      goldBars: G.goldBars, goldTaken: S.goldLeft.map((g) => g.taken),
      skills: G.skills, skillXp: G.skillXp,
      crew: G.crew, districtStanding: G.districtStanding,
      properties: G.properties,
      weapons: G.weapons, ammo: { pistol: G.player.ammo.pistol, rifle: G.player.ammo.rifle },
      reserve: { pistol: G.player.reserve.pistol, rifle: G.player.reserve.rifle },
      missionsDone: G.missionsDone, currentMission: G.missions.current,
      stats: G.stats, time: G.time,
      pos: { x: G.player.pos.x, z: G.player.pos.z },
    };
    try { localStorage.setItem(`velora-bay-save-${slot}`, JSON.stringify(data)); } catch { /* storage unavailable */ }
    G.hud.toast(`GAME SAVED — SLOT ${slot}`, 'good');
  };
  S.load = (slot = 1) => {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(`velora-bay-save-${slot}`) || 'null'); } catch { /* ignore */ }
    if (!data) return false;
    G.money = data.money; G.rep = data.rep; G.level = data.level || 1;
    G.goldBars = data.goldBars;
    data.goldTaken.forEach((t, i) => {
      S.goldLeft[i].taken = t;
      if (t) {
        const m4 = new THREE.Matrix4();
        m4.makeScale(0, 0, 0);
        world.goldBarMesh.setMatrixAt(i, m4);
      }
    });
    world.goldBarMesh.instanceMatrix.needsUpdate = true;
    G.skills = data.skills; G.skillXp = data.skillXp || {};
    G.crew = data.crew; G.districtStanding = data.districtStanding;
    G.properties = data.properties;
    G.weapons = data.weapons;
    G.player.ammo.pistol = data.ammo.pistol; G.player.ammo.rifle = data.ammo.rifle;
    G.player.reserve.pistol = data.reserve.pistol; G.player.reserve.rifle = data.reserve.rifle;
    G.missionsDone = data.missionsDone;
    G.currentMission = data.currentMission || 0;
    G.stats = data.stats;
    G.time = data.time;
    G.player.pos.set(data.pos.x, 0, data.pos.z);
    return true;
  };
  S.hasSave = (slot = 1) => {
    try { return !!localStorage.getItem(`velora-bay-save-${slot}`); } catch { return false; }
  };

  return S;
}
