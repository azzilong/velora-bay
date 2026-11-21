// Velora Bay — missions.js
// 8 fixed missions (3 acts), dialogue, stages, rewards, win screen.
// Written fresh in-session.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;
  var THREE = window.THREE;

  var sceneRef;
  var dialogue = null; // {lines:[{who,text}], idx, onDone}
  var stageTimer = 0, pendingStage = null;
  var missionStartT = 0;
  var fireFx = null;
  var crateMesh = null, ledgerMesh = null, ballotMeshes = [];
  var rallyCrowds = [];

  var MISSIONS = [
    {
      name: 'ASHES', act: 'ACT 1 — ASH', loc: 'Portside',
      reward: 300, rep: 100, par: 120, unlock: 'PISTOL',
      intro: [
        { who: 'TOMMY — Foreman', text: 'Eli! Hale\'s men torched the workshop! Grab the tool crate by the yard gate — it\'s all we have left!' },
        { who: 'ELI — Carpenter', text: 'Not my father\'s tools. Not today.' }
      ],
      stages: [
        { text: 'Grab the tool crate by the yard gate', type: 'goto', x: -58, z: -20, r: 3 },
        { text: 'Pick up the tool crate  [E]', type: 'interact', x: -58, z: -20, r: 3 },
        { text: 'Escape to Beach Blvd', type: 'goto', x: -40, z: 0, r: 4 }
      ]
    },
    {
      name: 'RECLAIM THE PIER', act: 'ACT 1 — ASH', loc: 'Portside',
      reward: 500, rep: 150, par: 180, unlock: 'GARAGE',
      intro: [
        { who: 'ROSA — Journalist', text: 'Hale controls the city through bribes, Eli. His men hold Pier 9 — take it back and the harbor listens.' },
        { who: 'TOMMY — Foreman', text: 'I\'m with you. Hammer out, let\'s go.' }
      ],
      stages: [
        { text: 'Reach Pier 9', type: 'goto', x: -72, z: 24, r: 4 },
        { text: 'Run Hale\'s men off Pier 9', type: 'defeat', n: 3, x: -72, z: 24 },
        { text: 'Talk to Tommy  [E]', type: 'interact', x: -70, z: 22, r: 3 }
      ]
    },
    {
      name: 'TIMBER RUN', act: 'ACT 2 — WOOD & CONCRETE', loc: 'Portside → Neon Row',
      reward: 800, rep: 150, par: 240, unlock: 'GOLD PAINT',
      intro: [
        { who: 'DINA — Driver', text: 'Lumber\'s loaded. We run it past the checkpoint at night — don\'t stop for anyone, Eli.' },
        { who: 'ELI — Carpenter', text: 'Then let\'s roll. Keep it quiet.' }
      ],
      stages: [
        { text: 'Get in the lumber truck  [E]', type: 'vehicle', x: -70, z: -22, r: 4 },
        { text: 'Smuggle the lumber past the checkpoint — don\'t stop', type: 'driveThru', x: -10, z: 0, r: 5 },
        { text: 'Deliver the lumber to the Neon Row warehouse', type: 'driveTo', x: 5, z: 24, r: 5 }
      ]
    },
    {
      name: 'CRANE DOWN', act: 'ACT 2 — WOOD & CONCRETE', loc: 'Neon Row',
      reward: 1200, rep: 200, par: 240, unlock: 'RIFLE',
      intro: [
        { who: 'ROSA — Journalist', text: 'Hale\'s crane is the symbol of his takeover. Cut the cable — bring it down on his own site.' },
        { who: 'ELI — Carpenter', text: 'One cable. One crane. One message.' }
      ],
      stages: [
        { text: 'Reach the construction site', type: 'goto', x: 5, z: 24, r: 4 },
        { text: 'Clear the site guards', type: 'defeat', n: 2, x: 5, z: 24 },
        { text: 'Cut the crane cable  [E]', type: 'interact', x: 8, z: 30, r: 3 },
        { text: 'Get clear of the falling crane', type: 'goto', x: 20, z: 0, r: 4 }
      ]
    },
    {
      name: 'PAPER TRAIL', act: 'ACT 2 — WOOD & CONCRETE', loc: 'Marina Heights',
      reward: 1500, rep: 250, par: 300, unlock: 'SAFEHOUSE',
      intro: [
        { who: 'ROSA — Journalist', text: 'The bribe ledger is in Hale Tower. It names Hale AND Mayor Vance. Stay quiet — guards patrol the lobby.' },
        { who: 'ELI — Carpenter', text: 'In and out. Nobody sees me.' }
      ],
      stages: [
        { text: 'Reach Hale Tower', type: 'goto', x: 35, z: -18, r: 4 },
        { text: 'Slip past the guards — stay quiet', type: 'stealth', x: 35, z: -24, r: 4 },
        { text: 'Steal the bribe ledger  [E]', type: 'interact', x: 35, z: -24, r: 3 },
        { text: 'Escape to the Safehouse', type: 'goto', x: 35, z: 18, r: 4 }
      ]
    },
    {
      name: 'RALLY THE BAY', act: 'ACT 3 — CITY HALL', loc: 'Velora Center → Beach',
      reward: 2000, rep: 300, par: 300, unlock: 'CREW — DINA',
      intro: [
        { who: 'NADIA — Campaign', text: 'Three districts before sundown, Eli. Win the streets and the city follows.' },
        { who: 'ELI — Carpenter', text: 'Then let\'s win them. One rally at a time.' }
      ],
      stages: [
        { text: 'Rally Velora Center  [E]', type: 'rally', x: -27, z: 0, r: 4, district: 'center' },
        { text: 'Rally Marina Heights  [E]', type: 'rally', x: 35, z: 0, r: 4, district: 'marina' },
        { text: 'Rally Velora Beach  [E]', type: 'rally', x: 64, z: 0, r: 4, district: 'beach' }
      ]
    },
    {
      name: 'DEBATE NIGHT', act: 'ACT 3 — CITY HALL', loc: 'Velora Center → Beach',
      reward: 2500, rep: 300, par: 300, unlock: 'ARMORED TRUCK',
      intro: [
        { who: 'NADIA — Campaign', text: 'Debate tonight, City Hall. Hale will lie to the whole city — don\'t let him.' },
        { who: 'ELI — Carpenter', text: 'I\'ve got the ledger. Let him try.' }
      ],
      stages: [
        { text: 'Win the debate  [ENTER]', type: 'dialogue', x: -27, z: -24, r: 4, lines: [
          { who: 'MAYOR VANCE', text: 'Mr. Braddock, a carpenter, wants to run our city? Laughable.' },
          { who: 'ELI — Carpenter', text: 'A carpenter built this city. A developer sold it. Here\'s the ledger that proves it.' },
          { who: 'CROWD', text: 'The ledger! Hale paid them all! ELI! ELI! ELI!' }
        ] },
        { text: 'Lose the cops — reach the marina', type: 'chase', x: 60, z: 0, r: 6 }
      ]
    },
    {
      name: 'ELECTION NIGHT', act: 'ACT 3 — CITY HALL', loc: 'Portside → Center → Marina',
      reward: 4000, rep: 400, par: 360, unlock: 'CITY HALL',
      intro: [
        { who: 'TOMMY — Foreman', text: 'Hale\'s men are hitting the ballot boxes — Portside, Center, Marina. We guard all three.' },
        { who: 'NADIA — Campaign', text: 'Hold the boxes till midnight and you\'re the mayor, Eli.' }
      ],
      stages: [
        { text: 'Guard the ballot box — Portside', type: 'defend', n: 2, x: -63, z: 0 },
        { text: 'Guard the ballot box — Velora Center', type: 'defend', n: 2, x: -27, z: 0 },
        { text: 'Guard the ballot box — Marina Heights', type: 'defend', n: 2, x: 35, z: 0 },
        { text: 'Reach City Hall — inauguration', type: 'goto', x: -27, z: -24, r: 4 }
      ]
    }
  ];

  function init(scene) {
    sceneRef = scene;
    // tool crate (M1)
    crateMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0xa8763e, roughness: 0.85 }));
    crateMesh.position.set(-58, 0.4, -20);
    crateMesh.castShadow = true;
    scene.add(crateMesh);
    // fire glow at the workshop (M1)
    var fireLight = new THREE.PointLight(0xff6622, 30, 25, 1.5);
    fireLight.position.set(-63, 3, -24);
    scene.add(fireLight);
    fireFx = { light: fireLight };
    // ledger (M5)
    ledgerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.45), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.5, emissive: 0x223366, emissiveIntensity: 0.6 }));
    ledgerMesh.position.set(35, 1.0, -24);
    ledgerMesh.visible = false;
    scene.add(ledgerMesh);
    // ballot boxes (M8)
    [[-63, 0], [-27, 0], [35, 0]].forEach(function (p) {
      var bb = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.6, emissive: 0xd4a017, emissiveIntensity: 0.25 }));
      bb.position.set(p[0], 0.6, p[1]);
      bb.visible = false;
      scene.add(bb);
      ballotMeshes.push(bb);
    });
  }

  function cur() {
    var S = VB.state;
    if (S.missionIdx >= MISSIONS.length) return null;
    return MISSIONS[S.missionIdx];
  }
  function curStage() {
    var m = cur();
    if (!m) return null;
    return m.stages[VB.state._stage || 0] || null;
  }
  function stageIdx() { return VB.state._stage || 0; }

  function showDialogue(lines, onDone) {
    dialogue = { lines: lines, idx: 0, onDone: onDone };
    renderDialogue();
  }
  function dialogueActive() { return !!dialogue; }
  function renderDialogue() {
    var box = document.getElementById('dialogue');
    if (!box) return;
    if (!dialogue) { box.style.display = 'none'; return; }
    var line = dialogue.lines[dialogue.idx];
    box.style.display = 'block';
    box.innerHTML = '<div class="dlg-who">' + U.escapeHtml(line.who) + '</div><div class="dlg-text">' + U.escapeHtml(line.text) + '</div><div class="dlg-hint">ENTER ▸</div>';
  }
  function advanceDialogue() {
    if (!dialogue) return false;
    dialogue.idx++;
    if (dialogue.idx >= dialogue.lines.length) {
      var done = dialogue.onDone;
      dialogue = null;
      renderDialogue();
      if (done) done();
      return true;
    }
    renderDialogue();
    return false;
  }
  function clearDialogue() { dialogue = null; renderDialogue(); }

  function setStage(mIdx, sIdx) {
    var S = VB.state;
    S.missionIdx = mIdx;
    S._stage = sIdx;
    clearDialogue();
    stageTimer = 0; pendingStage = null;
    var m = MISSIONS[mIdx];
    var st = m.stages[sIdx];
    // stage setup
    if (st.type === 'defeat' || st.type === 'defend') {
      // spawn thugs at the stage point (only if none alive for this stage)
      if (VB.combat.thugsAlive() === 0) {
        for (var i = 0; i < st.n; i++) {
          VB.combat.spawnThug(st.x + (i - 1) * 3, st.z + (i % 2 ? 3 : -3), i % 2 ? 'pistol' : 'bat', 'm' + mIdx);
        }
      }
    }
    if (mIdx === 4 && sIdx === 1) {
      // M5 guards
      VB.combat.spawnThug(33, -20, 'bat', 'guard');
      VB.combat.spawnThug(37, -28, 'bat', 'guard');
    }
    if (mIdx === 7) {
      ballotMeshes.forEach(function (b, i) { b.visible = (i === sIdx); });
    }
    if (mIdx === 0 && sIdx === 0) {
      if (fireFx) fireFx.light.visible = true;
    }
    if (mIdx === 2 && sIdx === 0) VB.world.setTimeOfDay('night');
    if (mIdx === 4) VB.world.setTimeOfDay('night');
    if (mIdx === 6 && sIdx === 1) {
      VB.ai.addWanted(5, 'chase');
    }
    if (mIdx === 5) {
      // rally crowds at each rally point
      rallyCrowds.forEach(function (c) { if (c.group.parent) c.group.parent.remove(c.group); });
      rallyCrowds = [];
      [[-27, 0], [35, 0], [64, 0]].forEach(function (p) {
        for (var ci = 0; ci < 5; ci++) {
          var h = VB.player.makeHumanoid({
            height: 1.65 + Math.random() * 0.2,
            shirt: [0x2e6b8a, 0xc0392b, 0xd4a017, 0x3a6b4f][ci % 4],
            pants: 0x2a3242, hair: 0x1a1a1a, hairStyle: 'normal'
          });
          h.group.position.set(p[0] + (ci - 2) * 1.6, 0, p[1] + (ci % 2 ? 3 : -3));
          h.setPose('cheer');
          sceneRef.add(h.group);
          rallyCrowds.push({ group: h.group });
        }
      });
    }
    VB.hud.refresh();
  }

  function startMission(idx) {
    var S = VB.state;
    S.missionIdx = idx;
    S._stage = 0;
    missionStartT = S.timePlayed;
    var m = MISSIONS[idx];
    if (m.intro) showDialogue(m.intro, function () { setStage(idx, 0); });
    else setStage(idx, 0);
    VB.hud.refresh();
  }

  function preview(mIdx, sIdx) {
    // staging helper: set mission/stage without intro dialogue
    var S = VB.state;
    S.missionIdx = mIdx;
    S._stage = sIdx;
    clearDialogue();
    stageTimer = 0; pendingStage = null;
    VB.hud.refresh();
  }

  function ratingFor(mIdx) {
    var S = VB.state;
    var elapsed = S.timePlayed - missionStartT;
    var par = MISSIONS[mIdx].par;
    if (elapsed <= par) return 'G';
    if (elapsed <= par * 1.6) return 'S';
    return 'B';
  }

  function completeMission() {
    var S = VB.state;
    var m = MISSIONS[S.missionIdx];
    var rating = ratingFor(S.missionIdx);
    S.ratings[S.missionIdx] = rating;
    if (S.completed.indexOf(S.missionIdx) < 0) S.completed.push(S.missionIdx);
    S.money += m.reward;
    S.rep += m.rep;
    // unlocks
    if (S.missionIdx === 0) { S.weapons.pistol.unlocked = true; S.nextMilestone = 'GARAGE'; }
    if (S.missionIdx === 1) { S.properties.garage = true; S.properties.workshop = true; S.nextMilestone = 'GOLD PAINT'; }
    if (S.missionIdx === 2) { S.nextMilestone = 'RIFLE'; }
    if (S.missionIdx === 3) { S.weapons.rifle.unlocked = true; S.nextMilestone = 'SAFEHOUSE'; }
    if (S.missionIdx === 4) { S.properties.safehouse = true; S.nextMilestone = 'CREW — DINA'; }
    if (S.missionIdx === 5) {
      S.crew.dina = true; S.crew.marv = true; S.crew.kofi = true;
      S.standing.center = 'FRIENDLY'; S.standing.marina = 'FRIENDLY'; S.standing.beach = 'FRIENDLY';
      S.nextMilestone = 'ARMORED TRUCK';
    }
    if (S.missionIdx === 6) { S.nextMilestone = 'CITY HALL'; }
    VB.audio.sfx('mission');
    VB.toast('MISSION COMPLETE · ' + m.name + '  +$' + m.reward + '  +' + m.rep + ' REP  ·  RATING ' + rating);
    VB.save.write(1);
    // advance or win
    if (S.missionIdx >= MISSIONS.length - 1) {
      win();
      return;
    }
    var next = S.missionIdx + 1;
    S.missionIdx = next;
    startMission(next);
  }

  function win() {
    var S = VB.state;
    S.mode = 'win';
    S.money += 8888;
    VB.audio.sfx('win');
    VB.hud.showWin();
  }

  function playerDown() {
    var S = VB.state;
    S.health = 100;
    S.money = Math.max(0, S.money - 100);
    VB.toast('BUSTED — you wake up at the Workshop (-$100)');
    VB.player.resetTo(-63, -20, 0);
    VB.ai.clearWanted();
    setStage(S.missionIdx, S._stage || 0);
    VB.hud.refresh();
  }

  function checkStage(dt) {
    var S = VB.state;
    if (S.mode !== 'playing' || S.frozen) return;
    var m = cur();
    if (!m) return;
    var st = curStage();
    if (!st) return;
    // pending stage advance (in-update timer, never setTimeout)
    if (pendingStage != null) {
      stageTimer -= dt;
      if (stageTimer <= 0) {
        var ps = pendingStage; pendingStage = null;
        if (ps >= m.stages.length) completeMission();
        else setStage(S.missionIdx, ps);
      }
      return;
    }
    var px = VB.player.pos.x, pz = VB.player.pos.z;
    var done = false;
    if (st.type === 'goto' || st.type === 'interact' || st.type === 'rally' || st.type === 'stealth') {
      if (U.dist2(px, pz, st.x, st.z) <= st.r) {
        if (st.type === 'interact' || st.type === 'rally') {
          if (VB.input.consume('KeyE')) done = true;
        } else if (st.type === 'stealth') {
          // stealth: if a guard is within 6m, alarm — defeat them instead
          var spotted = false;
          for (var gi = 0; gi < VB.combat.thugs.length; gi++) {
            var gth = VB.combat.thugs[gi];
            if (!gth.dead && U.dist2(px, pz, gth.x, gth.z) < 6) { spotted = true; break; }
          }
          if (spotted) {
            VB.toast('Spotted! The alarm is up — grab the ledger and run!');
            VB.audio.sfx('alarm');
            VB.ai.addWanted(2, 'alarm');
          }
          done = true;
        } else done = true;
      }
    } else if (st.type === 'defeat' || st.type === 'defend') {
      var killed = 0;
      for (var ti = 0; ti < VB.combat.thugs.length; ti++) {
        var th = VB.combat.thugs[ti];
        if (th.tag === 'm' + S.missionIdx && th.dead) killed++;
      }
      if (killed >= st.n) done = true;
    } else if (st.type === 'vehicle') {
      if (VB.player.currentVehicle) done = true;
    } else if (st.type === 'driveThru') {
      if (VB.player.currentVehicle && U.dist2(px, pz, st.x, st.z) <= st.r && Math.abs(VB.state.speedKmh) > 10) done = true;
    } else if (st.type === 'driveTo') {
      if (VB.player.currentVehicle && U.dist2(px, pz, st.x, st.z) <= st.r) done = true;
    } else if (st.type === 'dialogue') {
      if (U.dist2(px, pz, st.x, st.z) <= st.r) {
        showDialogue(st.lines, function () {
          pendingStage = stageIdx() + 1; stageTimer = 0.5;
        });
        // prevent re-trigger: move to a waiting pseudo-stage
        st.type = '_dialogueShown';
      }
    } else if (st.type === 'chase') {
      if (U.dist2(px, pz, st.x, st.z) <= st.r) done = true;
    }
    if (done) {
      if (st.type === 'interact' && S.missionIdx === 0) {
        if (crateMesh) crateMesh.visible = false;
        if (fireFx) fireFx.light.visible = false;
      }
      if (st.type === 'interact' && S.missionIdx === 4) {
        if (ledgerMesh) ledgerMesh.visible = false;
        VB.toast('BRIBE LEDGER — SECURED');
      }
      if (st.type === 'interact' && S.missionIdx === 3) {
        // crane falls
        VB.emit('craneDown');
        VB.audio.sfx('crash');
        VB.toast('CRANE DOWN!');
      }
      if (st.type === 'rally') {
        S.standing[st.district] = 'FRIENDLY';
        S.rep += 50;
        VB.audio.sfx('mission');
        VB.toast(st.district.toUpperCase() + ' RALLIED +50 REP');
      }
      pendingStage = stageIdx() + 1;
      stageTimer = 0.6;
    }
  }

  function update(dt, t) {
    var S = VB.state;
    // dialogue advance
    if (dialogue && VB.input.consume('Enter')) advanceDialogue();
    if (S.mode !== 'playing' || S.frozen) return;
    checkStage(dt);
    // fire flicker
    if (fireFx && fireFx.light.visible) {
      fireFx.light.intensity = 24 + Math.sin(t * 9) * 8 + Math.random() * 4;
    }
  }

  VB.missions = {
    init: init, update: update, startMission: startMission, setStage: setStage,
    preview: preview, completeMission: completeMission, win: win,
    playerDown: playerDown, dialogueActive: dialogueActive,
    advanceDialogue: advanceDialogue, showDialogue: showDialogue,
    currentStage: curStage, current: cur, stageIdx: stageIdx,
    get list() { return MISSIONS; },
    get dialogue() { return dialogue; }
  };
})();
