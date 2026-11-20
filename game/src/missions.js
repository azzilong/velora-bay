// VELORA BAY — MISSIONS (3 acts, 8 fixed missions)
// Stage machine: each mission is a list of stages. A stage completes by
// reaching a target, defeating enemies, holding E to interact, or a timer.
// Rewards grant cash + REP + unlocks; completing M8 triggers the win.
// Enemy AI: thugs chase and melee; guards raise the alarm in M5.
import * as THREE from '../vendor/three.module.min.js';
import { makeThug, makeTommy, makeRosa, makeNadia, makeDina, makeMarv, makeKofi, animateWalk } from './characters.js';
import { makeCar } from './vehicles.js';
import { makeDriveable } from './driving.js';
import { poi } from './layout.js';

export const MISSION_LIST = [
  { name: 'Ashes', act: 'ACT 1 — ASH', blurb: "Hale's men burn the workshop. Save the tools, then run.", where: 'Portside · Workshop', reward: 300, rep: 120, unlock: 'PISTOL' },
  { name: 'Reclaim the Pier', act: 'ACT 1 — ASH', blurb: 'Take Pier 9 back from Hale’s men — the cops are already here.', where: 'Portside · Pier 9', reward: 500, rep: 160, unlock: 'GARAGE' },
  { name: 'Timber Run', act: 'ACT 2 — WOOD & CONCRETE', blurb: 'Smuggle the lumber past the checkpoint — don’t stop.', where: 'Portside → Neon Row', reward: 800, rep: 200, unlock: 'GOLD PAINT' },
  { name: 'Crane Down', act: 'ACT 2 — WOOD & CONCRETE', blurb: "Cut the crane cable — bring it down on Hale's site.", where: 'Neon Row · Construction', reward: 1200, rep: 240, unlock: 'RIFLE' },
  { name: 'Paper Trail', act: 'ACT 2 — WOOD & CONCRETE', blurb: 'Steal the bribe ledger from Hale Tower. Stay quiet.', where: 'Marina Heights · Hale Tower', reward: 1500, rep: 300, unlock: 'SAFEHOUSE' },
  { name: 'Rally the Bay', act: 'ACT 3 — CITY HALL', blurb: 'Win the streets — rally 3 districts before sundown.', where: 'Center · Marina · Beach', reward: 2500, rep: 400, unlock: 'CREW — DINA' },
  { name: 'Debate Night', act: 'ACT 3 — CITY HALL', blurb: 'Win the debate — then lose the cops on the coastal highway.', where: 'Center → Velora Beach', reward: 4000, rep: 500, unlock: 'ARMORED TRUCK' },
  { name: 'Election Night', act: 'ACT 3 — CITY HALL', blurb: 'Guard the ballot boxes — Portside → Center → Marina.', where: 'Portside · Center · Marina', reward: 8888, rep: 800, unlock: 'CITY HALL' },
];

export function createMissions(scene, world, G) {
  const M = {
    list: MISSION_LIST,
    current: 0,
    stage: 0,
    objective: null,      // { x, z, r, label }
    timer: 0,             // mission countdown (0 = none)
    enemies: [],          // { fig, pos, hp, maxHp, speed, dmg, cd, flash, kind, guard }
    companions: [],       // { fig, pos, followDist }
    interact: null,       // { x, z, r, hold, need, label, done }
    killsNeeded: 0,
    killsDone: 0,
    fireFx: null,
    stageDone: false,
  };

  function addEnemy(x, z, kind = 'thug') {
    const fig = makeThug();
    fig.group.position.set(x, 0, z);
    scene.add(fig.group);
    const e = { fig, pos: fig.group.position, hp: kind === 'guard' ? 80 : 60, maxHp: 80, speed: 3.4, dmg: 8, cd: 0, flash: 0, kind, phase: Math.random() * 6 };
    M.enemies.push(e);
    return e;
  }
  function clearEnemies() {
    for (const e of M.enemies) scene.remove(e.fig.group);
    M.enemies = [];
  }
  function addCompanion(makeFn, x, z) {
    const fig = makeFn();
    fig.group.position.set(x, 0, z);
    scene.add(fig.group);
    const c = { fig, pos: fig.group.position, phase: 0 };
    M.companions.push(c);
    return c;
  }
  function clearCompanions() {
    for (const c of M.companions) scene.remove(c.fig.group);
    M.companions = [];
  }
  function setObjective(x, z, r, label) {
    M.objective = { x, z, r, label };
  }
  function say(who, line, ms) { G.hud.say(who, line, ms); }

  // ---- fire effect for M1 (emissive cones + point light at the workshop)
  function startFire() {
    const g = new THREE.Group();
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 9; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.9 + Math.random() * 0.7, 2.6 + Math.random() * 2.4, 5), fireMat);
      f.position.set(-118 + Math.random() * 24, 1.6, -38 + Math.random() * 14);
      g.add(f);
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random(), 6, 5), smokeMat);
      s.position.set(f.position.x, 5 + Math.random() * 3, f.position.z);
      g.add(s);
    }
    const light = new THREE.PointLight(0xff7a1a, 60, 40);
    light.position.set(-105, 6, -30);
    g.add(light);
    scene.add(g);
    M.fireFx = g;
  }
  function stopFire() {
    if (M.fireFx) { scene.remove(M.fireFx); M.fireFx = null; }
  }

  function startMission(i) {
    M.current = i;
    G.currentMission = i; // keep the HUD/title/save in sync with the live mission
    M.stage = 0;
    M.killsDone = 0;
    M.interact = null;
    M.timer = 0;
    clearEnemies();
    clearCompanions();
    stopFire();
    const m = MISSION_LIST[i];
    G.hud.toast(`MISSION ${i + 1} — ${m.name.toUpperCase()}`, 'good');
    G.audio.mission();
    if (i === 0) {
      startFire();
      say('TOMMY', 'The workshop is on fire! Grab the tool crate by the yard gate — NOW!', 5200);
      setObjective(-88, -30, 4, 'Grab the tool crate by the yard gate');
      addCompanion(makeTommy, -100, -22);
    } else if (i === 1) {
      say('ROSA', 'Hale’s men hold Pier 9. Tommy’s with you — run them off, then watch for the cops.', 5200);
      setObjective(-190, 0, 6, 'Reach Pier 9');
      addCompanion(makeTommy, -100, -22);
      addCompanion(makeRosa, -98, -18);
    } else if (i === 2) {
      G.setNight(true);
      say('DINA', 'Lumber’s loaded. Drive the truck past the checkpoint — don’t stop, don’t look back.', 5200);
      setObjective(-35, -90, 5, 'Get in the lumber truck');
      addCompanion(makeDina, -30, -84);
      // spawn the lumber truck (driveable)
      const truck = makeCar({ color: 0x8a6a4a, type: 'truck' });
      truck.group.position.set(-35, 0, -90);
      truck.group.rotation.y = -Math.PI / 2; // east along Foundry St
      scene.add(truck.group);
      M.truck = truck;
      M.truckD = makeDriveable(truck, { maxSpeed: 34, accel: 10, fuel: 80 });
    } else if (i === 3) {
      say('ROSA', 'The crane is the heart of Hale’s site. Cut the cable and the whole thing comes down.', 5200);
      setObjective(35, -90, 6, 'Reach the construction site');
      addCompanion(makeRosa, 28, -80);
    } else if (i === 4) {
      G.setNight(true);
      say('ROSA', 'The ledger is on the top floor of Hale Tower. Guards patrol the lobby — stay out of their light.', 5600);
      setObjective(105, -30, 6, 'Reach Hale Tower');
      addEnemy(96, -22, 'guard'); addEnemy(112, -38, 'guard');
      addCompanion(makeRosa, 96, -14);
    } else if (i === 5) {
      G.setNight(false);
      M.timer = 240;
      say('NADIA', 'Three districts before sundown. Rally the plaza, the marina, then the beach — the city is watching.', 5600);
      setObjective(-35, 25, 6, 'Rally Velora Center — hold E');
      M.interact = { x: -35, z: 25, r: 6, hold: 0, need: 2, label: 'RALLY THE PLAZA' };
      addCompanion(makeNadia, -30, 20);
      addCompanion(makeMarv, -40, 30);
      addCompanion(makeKofi, -28, 30);
    } else if (i === 6) {
      say('NADIA', 'Debate first. Then they’ll come for you — take the Golden Saw and lose them on Beach Blvd.', 5600);
      setObjective(35, 25, 6, 'Reach the Debate Hall');
      addCompanion(makeNadia, 30, 20);
      addCompanion(makeDina, 40, 20);
    } else if (i === 7) {
      say('TOMMY', 'They’ll try to steal the election tonight. Guard the boxes — Portside, Center, Marina. Then City Hall.', 5600);
      setObjective(-105, -30, 6, 'Guard the ballot box — Portside');
      addCompanion(makeTommy, -100, -24);
      addCompanion(makeMarv, -110, -24);
      addCompanion(makeRosa, -100, -36);
    }
    M.refreshHud();
  }

  M.refreshHud = () => {
    const m = MISSION_LIST[M.current];
    const total = M.stageCount();
    const label = M.objective ? M.objective.label : m.name;
    const dist = M.objective ? Math.round(Math.hypot(G.player.pos.x - M.objective.x, G.player.pos.z - M.objective.z)) : 0;
    const stageTxt = `STAGE ${Math.min(M.stage + 1, total)}/${total} · ${dist}m${M.timer > 0 ? ` · ${Math.ceil(M.timer)}s LEFT` : ''}`;
    G.hud.setMission(m.act, `MISSION ${M.current + 1} · ${m.name.toUpperCase()}`, label, stageTxt, M.stage / total);
  };
  M.stageCount = () => {
    return [2, 3, 3, 3, 3, 3, 3, 4][M.current];
  };

  function nextStage() {
    M.stage++;
    M.interact = null;
    const i = M.current;
    if (i === 0) {
      if (M.stage === 1) {
        stopFire();
        say('ELI', 'Got the tools. The workshop is gone — but we’re not. Meet me on Harbor St.', 4600);
        setObjective(-70, -30, 5, 'Escape to Harbor St');
      } else completeMission();
    } else if (i === 1) {
      if (M.stage === 1) {
        say('ROSA', 'They’re here! Run Hale’s men off the pier!', 4200);
        for (const [x, z] of [[-186, -8], [-188, 6], [-182, -14], [-190, 12]]) addEnemy(x, z);
        M.killsNeeded = 4; M.killsDone = 0;
        setObjective(-188, 0, 10, 'Run Hale’s men off Pier 9 (0/4)');
      } else if (M.stage === 2) {
        say('TOMMY', 'Cops! We’ve got heat — lose them or get back to the workshop.', 4600);
        G.police.addHeat(30, 'WANTED LEVEL 1 — VBPD ON SCENE');
        setObjective(-105, -30, 6, 'Get back to the workshop');
      } else completeMission();
    } else if (i === 2) {
      if (M.stage === 1) {
        say('DINA', 'Checkpoint ahead on Foundry St. Keep rolling — do NOT stop.', 4600);
        setObjective(0, -60, 7, 'Smuggle the lumber past the checkpoint');
      } else if (M.stage === 2) {
        say('DINA', 'You’re through! Now the warehouse in Neon Row — east end.', 4200);
        setObjective(170, -90, 7, 'Deliver the lumber to the Neon Warehouse');
      } else completeMission();
    } else if (i === 3) {
      if (M.stage === 1) {
        say('ELI', 'There’s the crane. Hold E at the base to cut the cable.', 4600);
        setObjective(23, -94, 4, 'Cut the crane cable — hold E');
        M.interact = { x: 23, z: -94, r: 4, hold: 0, need: 3, label: 'CUT THE CABLE' };
        for (const [x, z] of [[28, -84], [42, -96], [30, -100]]) addEnemy(x, z);
      } else if (M.stage === 2) {
        // crane comes down: fallen jib + dust
        const jib = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 22), new THREE.MeshStandardMaterial({ color: 0xf2b32c, roughness: 0.7 }));
        jib.position.set(35, 1, -78);
        jib.rotation.x = 0.06; jib.rotation.z = 0.1;
        jib.castShadow = true;
        scene.add(jib);
        M.fallenJib = jib;
        for (let k = 0; k < 6; k++) {
          const dust = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 2, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9a8a7a, transparent: true, opacity: 0.4 }));
          dust.position.set(30 + Math.random() * 12, 1 + Math.random() * 3, -82 + Math.random() * 8);
          scene.add(dust);
          setTimeout(() => scene.remove(dust), 6000);
        }
        G.audio.crash();
        G.hud.toast('CRANE DOWN!', 'good');
        say('ROSA', 'It’s down! The whole site is buried — now get out of Neon Row!', 4600);
        setObjective(-70, -90, 6, 'Escape the construction site');
      } else completeMission();
    } else if (i === 4) {
      if (M.stage === 1) {
        say('ROSA', 'Inside — the ledger is by the top-floor desk. Stay quiet.', 4200);
        setObjective(105, -20, 3, 'Steal the bribe ledger (stay quiet)');
        M.interact = { x: 105, z: -20, r: 3, hold: 0, need: 2, label: 'STEAL THE LEDGER' };
      } else if (M.stage === 2) {
        say('ROSA', 'You have it! The ledger names Hale AND Vance. Run — the safehouse!', 4600);
        setObjective(170, 25, 6, 'Escape to the Marina Safehouse');
      } else completeMission();
    } else if (i === 5) {
      const spots = [
        { x: -35, z: 25, label: 'Rally Velora Center — hold E', name: 'RALLY THE PLAZA' },
        { x: 170, z: 25, label: 'Rally Marina Heights — hold E', name: 'RALLY THE MARINA' },
        { x: 105, z: 80, label: 'Rally Velora Beach — hold E', name: 'RALLY THE BEACH' },
      ];
      if (M.stage <= 2) {
        const s = spots[M.stage - 1];
        setObjective(s.x, s.z, 6, s.label);
        M.interact = { x: s.x, z: s.z, r: 6, hold: 0, need: 2, label: s.name };
        const d = ['center', 'marina', 'beach'][M.stage - 1];
        G.districtStanding[d] = Math.min(100, G.districtStanding[d] + 18);
        say('NADIA', `One district rallied! ${3 - M.stage} to go before sundown.`, 3800);
      } else completeMission();
    } else if (i === 6) {
      if (M.stage === 1) {
        say('NADIA', 'Debate won. Now RUN — Hale’s men are coming down Beach Blvd!', 4600);
        G.police.addHeat(70, 'WANTED LEVEL 4 — VBPD IN FULL PURSUIT');
        setObjective(190, 100, 8, 'Lose the cops — drive Beach Blvd east');
        // armored truck ahead on the boulevard
        const truck = makeCar({ color: 0x9aa5b0, type: 'armored' });
        truck.group.position.set(40, 0, 100);
        truck.group.rotation.y = -Math.PI / 2; // east along Beach Blvd
        scene.add(truck.group);
        M.armored = truck;
      } else if (M.stage === 2) {
        say('DINA', 'You’re clear of the roadblocks. Lose the tail and we’re home.', 4200);
        setObjective(-60, 100, 8, 'Lose the cops (wanted 0)');
      } else completeMission();
    } else if (i === 7) {
      const boxes = [
        { x: -105, z: -30, label: 'Guard the ballot box — Portside' },
        { x: -35, z: 17, label: 'Guard the ballot box — Center' },
        { x: 105, z: -30, label: 'Guard the ballot box — Marina' },
      ];
      if (M.stage <= 2) {
        const b = boxes[M.stage - 1];
        say('TOMMY', `Ballot box ${M.stage} of 3 — hold the line!`, 4200);
        setObjective(b.x, b.z, 8, b.label);
        const base = b;
        for (let k = 0; k < 3; k++) addEnemy(base.x + (k - 1) * 6, base.z + 8);
        M.killsNeeded = 3; M.killsDone = 0;
      } else {
        say('NADIA', 'All three boxes are safe. To City Hall — it’s inauguration time!', 4800);
        setObjective(-35, 17, 6, 'Reach City Hall for the inauguration');
      }
    }
    M.refreshHud();
  }

  function completeMission() {
    const m = MISSION_LIST[M.current];
    G.money += m.reward;
    G.rep += m.rep;
    G.missionsDone.push(M.current);
    G.hud.toast(`MISSION COMPLETE — ${m.name.toUpperCase()} +$${m.reward.toLocaleString()} +${m.rep} REP`, 'good');
    G.hud.toast(`NEXT: ${m.unlock}`, 'good');
    G.audio.mission();
    G.applyUnlock(m.unlock);
    G.saveGame(1);
    clearEnemies();
    if (M.current === 7) {
      G.winGame();
      return;
    }
    startMission(M.current + 1);
  }

  M.onEnemyDown = (e) => {
    G.stats.takedowns++;
    G.addCash(50, 'TAKEDOWN +$50');
    M.killsDone++;
    if (M.killsNeeded > 0) {
      const m = MISSION_LIST[M.current];
      if (M.objective) M.objective.label = M.objective.label.replace(/\(\d+\/\d+\)/, `(${M.killsDone}/${M.killsNeeded})`);
      if (M.killsDone >= M.killsNeeded) {
        M.killsNeeded = 0;
        nextStage();
      }
    }
  };

  M.update = (dt) => {
    if (G.state !== 'game') return;
    // timer (M6 sundown)
    if (M.timer > 0) {
      M.timer -= dt;
      if (M.timer <= 0) {
        M.timer = 0;
        G.hud.toast('SUNDOWN — THE RALLY FAILED. TRY AGAIN.', 'bad');
        startMission(M.current);
        return;
      }
    }
    const p = G.player.pos;
    // reach objective
    if (M.objective && !M.interact) {
      const d = Math.hypot(p.x - M.objective.x, p.z - M.objective.z);
      if (d < M.objective.r) {
        // M7 stage 2 needs wanted 0 as well
        if (M.current === 6 && M.stage === 2 && G.police.P.wanted > 0) { /* wait */ }
        else nextStage();
      }
    }
    // hold-E interact
    if (M.interact) {
      const d = Math.hypot(p.x - M.interact.x, p.z - M.interact.z);
      if (d < M.interact.r && G.input.keys['KeyE']) {
        M.interact.hold += dt;
        G._promptSet = true;
        G.hud.setInteract(`${M.interact.label}… ${Math.ceil(M.interact.need - M.interact.hold)}s`);
        if (M.interact.hold >= M.interact.need) {
          G.hud.setInteract(null);
          nextStage();
        }
      } else {
        M.interact.hold = Math.max(0, M.interact.hold - dt * 2);
        if (d < M.interact.r) { G._promptSet = true; G.hud.setInteract(`HOLD E — ${M.interact.label}`); }
        else G.hud.setInteract(null);
      }
    }
    // enemies AI
    for (const e of M.enemies) {
      if (e.hp <= 0) continue;
      e.cd = Math.max(0, e.cd - dt);
      e.flash = Math.max(0, e.flash - dt);
      const dx = p.x - e.pos.x, dz = p.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      // guards in M5 raise the alarm when the player gets close
      if (e.kind === 'guard' && d < 11 && M.current === 4 && M.stage <= 1 && !M.alarm) {
        M.alarm = true;
        say('ROSA', 'Spotted! The alarm is up — grab the ledger and run!', 4600);
        G.police.addHeat(45, 'ALARM — VBPD RESPONDING');
      }
      if (d < 20 && d > 1.6) {
        const sp = e.speed * dt;
        e.pos.x += (dx / d) * sp;
        e.pos.z += (dz / d) * sp;
        e.fig.group.rotation.y = Math.atan2(dx, dz);
        e.phase += dt * 7;
        animateWalk(e.fig, e.phase, 0.9);
      } else if (d <= 1.6 && e.cd <= 0) {
        e.cd = 1.1;
        e.fig.armR.pivot.rotation.x = -1.6;
        setTimeout(() => { e.fig.armR.pivot.rotation.x = 0; }, 220);
        G.playerDamage(e.dmg, e.pos.x, e.pos.z);
      }
      // hit flash
      e.fig.group.traverse((o) => {
        if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(e.flash > 0 ? 0x881111 : 0x000000);
      });
    }
    // companions follow
    for (const c of M.companions) {
      const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 4.5) {
        const sp = Math.min(7.2, 4 + d * 0.3) * dt;
        c.pos.x += (dx / d) * sp;
        c.pos.z += (dz / d) * sp;
        c.fig.group.rotation.y = Math.atan2(dx, dz);
        c.phase += dt * 7;
        animateWalk(c.fig, c.phase, 0.9);
      }
    }
    // remove dead enemies from the scene after a beat
    for (let i = M.enemies.length - 1; i >= 0; i--) {
      const e = M.enemies[i];
      if (e.hp <= 0) {
        e.pos.y -= dt * 1.2;
        if (e.pos.y < -2.5) { scene.remove(e.fig.group); M.enemies.splice(i, 1); }
      }
    }
    M.refreshHud();
  };

  M.startMission = startMission;
  M.clearEnemies = clearEnemies;
  M.clearCompanions = clearCompanions;
  M.stopFire = stopFire;
  // Jump to stage n (1-based) by entering it through nextStage.
  M.setStage = (n) => { M.stage = n - 1; nextStage(); };
  // Spawn extra enemies (used by screenshot staging).
  M.debugSpawn = (x, z, kind = 'thug') => addEnemy(x, z, kind);
  return M;
}
