// Velora Bay — main.js
// Renderer, scene, game loop, modes, demo save, staging API.
// The demo save is ONE canonical state shared by every staged screenshot so
// money / REP / GOLD / mission / crew / stats are identical across shots:
// $4,120 · REP 1240 · day 4 · M7 · GOLD 7/20 · 12 cars · 14 takedowns ·
// 3 escapes · 8.4 km · wanted 5 · 00:20:40 played.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;
  var THREE = window.THREE;

  var renderer, scene, camera, clock;
  var frames = 0, titleAngle = 0.35;
  var stagedExtras = [];
  var tAcc = 0;

  // One fixed update tick (used by the headless playtest to simulate frames
  // without waiting on SwiftShader's slow requestAnimationFrame).
  function stepOnce(dt) {
    var S = VB.state;
    tAcc += dt;
    if (S.mode === 'playing' && !S.frozen) {
      S.timePlayed += dt;
      VB.player.update(dt, tAcc);
      VB.ai.update(dt, tAcc);
      VB.combat.update(dt, tAcc);
      VB.missions.update(dt, tAcc);
      VB.world.update(dt, tAcc);
      VB.hud.update(dt);
    } else {
      VB.world.update(dt, tAcc);
    }
    // headless playtests skip the (slow SwiftShader) render per step;
    // screenshots are verified separately by the capture tool.
    if (!S.headless) renderer.render(scene, camera);
  }

  VB.freeze = function (on) { VB.state.frozen = !!on; };

  function boot() {
    var canvas = document.getElementById('c');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87b5d6);
    scene.fog = new THREE.Fog(0xc98a6a, 90, 280);
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(-30, 10, 15);
    VB.camera = camera;

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    VB.world.init(scene, renderer);
    VB.player.init(scene, camera);
    VB.ai.init(scene);
    VB.combat.init(scene, camera);
    VB.missions.init(scene);
    VB.hud.init();

    VB.hud.setMode('title');
    VB.world.setTimeOfDay('sunset');
    VB.audio.applyVolumes();

    clock = new THREE.Clock();
    requestAnimationFrame(loop);
  }

  function loop() {
    requestAnimationFrame(loop);
    var rawDt = Math.min(clock.getDelta(), 0.1);
    var S = VB.state;
    var dt = rawDt * (S.timeScale || 1);
    var t = clock.elapsedTime;

    if (S.mode === 'title' || S.mode === 'win') {
      titleAngle += rawDt * 0.03;
      camera.position.set(Math.sin(titleAngle) * 60, 26, Math.cos(titleAngle) * 60);
      camera.lookAt(0, 2, 0);
      VB.world.update(rawDt, t);
    } else if (S.mode === 'playing' && !S.frozen) {
      S.timePlayed += rawDt;
      VB.player.update(dt, t);
      VB.ai.update(dt, t);
      VB.combat.update(dt, t);
      VB.missions.update(dt, t);
      VB.world.update(dt, t);
      VB.hud.update(dt);
      if (VB.input.consume('KeyM')) VB.hud.openMap('map');
      else if (VB.input.consume('Escape')) VB.hud.setMode('paused');
      if (VB.input.consume('Enter') && VB.missions.dialogueActive()) VB.missions.advanceDialogue();
    } else if (S.mode === 'map') {
      VB.hud.drawMap();
      if (VB.input.consume('KeyM') || VB.input.consume('Escape')) VB.hud.closeMap();
    } else if (S.mode === 'paused') {
      if (VB.input.consume('Escape')) VB.hud.setMode('playing');
    }
    renderer.render(scene, camera);
    frames++;
    if (frames === 3) {
      window.__ready = true;
      window.__stats = {
        mode: S.mode,
        mission: S.missionIdx + 1,
        money: S.money,
        goldBars: S.goldBars,
        thugs: VB.combat.thugs.length,
        traffic: VB.ai.traffic.length,
        peds: VB.ai.peds.length,
        timeOfDay: S.timeOfDay,
        layoutViolations: VB.world.layoutViolations ? VB.world.layoutViolations.length : -1
      };
    }
  }

  function demoSave() {
    var S = VB.state;
    S.money = 4120; S.rep = 1240; S.day = 4;
    S.missionIdx = 6; S.completed = [0, 1, 2, 3, 4, 5];
    S.ratings = { 0: 'G', 1: 'S', 2: 'G', 3: 'S', 4: 'G', 5: 'S' };
    S.skills = { Driving: 4, Combat: 3, Stamina: 3, Stealth: 2, Charisma: 3, Mechanic: 2 };
    S.weapons.pistol.unlocked = true; S.weapons.pistol.ammo = 12; S.weapons.pistol.reserve = 48;
    S.weapons.rifle.unlocked = true; S.weapons.rifle.ammo = 30; S.weapons.rifle.reserve = 90;
    S.crew.tommy = true; S.crew.rosa = true; S.crew.nadia = true; S.crew.marv = true;
    S.crew.dina = false; S.crew.kofi = false;
    S.properties.workshop = true; S.properties.garage = true; S.properties.safehouse = false;
    S.goldBars = 7; S.carsStolen = 12; S.takedowns = 14; S.escapes = 3;
    S.kmDriven = 8.4; S.bestWanted = 5; S.timePlayed = 1240;
    S.nextMilestone = 'CITY HALL';
  }

  function clearStaged() {
    stagedExtras.forEach(function (g) { if (g.parent) g.parent.remove(g); });
    stagedExtras = [];
    // Every stage starts UNFROZEN: the previous stage (e.g. the chase)
    // leaves the game frozen, and actions like fire() refuse to run while
    // frozen — the night shot's shot never fired, so no tracer, no damage
    // number, and the ammo never dropped. Each stage re-freezes at its end.
    VB.freeze(false);
    VB.player.camTilt = 0;
    var wheel = document.getElementById('wheel');
    if (wheel) wheel.style.transform = '';
    var dlg = document.getElementById('dialogue');
    if (dlg) dlg.style.bottom = '';
  }

  function addStaged(group) {
    scene.add(group);
    stagedExtras.push(group);
    return group;
  }

  window.__game = {
    step: stepOnce,
    state: function () {
      var S = VB.state;
      return {
        mode: S.mode, mission: S.missionIdx + 1, stage: VB.missions.currentStage() ? VB.missions.currentStage().text : null,
        px: Math.round(VB.player.pos.x), pz: Math.round(VB.player.pos.z),
        wanted: S.wanted, health: Math.round(S.health), money: S.money, rep: S.rep,
        goldBars: S.goldBars, weapon: S.weapon,
        thugsAlive: VB.combat.thugsAlive(),
        timeOfDay: S.timeOfDay, completed: S.completed.slice(), frozen: !!S.frozen,
        layoutViolations: VB.world.layoutViolations ? VB.world.layoutViolations.length : -1,
        heliVisible: !!(VB.ai.heli && VB.ai.heli.visible),
        heliPos: VB.ai.heli ? [Math.round(VB.ai.heli.position.x), Math.round(VB.ai.heli.position.y), Math.round(VB.ai.heli.position.z)] : null,
        units: VB.ai.units.length
      };
    },
    start: function () { VB.hud.newGame(); },
    freeze: function (on) { VB.freeze(on); },
    stageChase: function () {
      clearStaged();
      VB.hud.setMode('playing');
      demoSave();
      VB.world.setTimeOfDay('sunset'); // cover = chase at golden hour
      var saw = VB.player.heroSaw;
      saw.x = -10; saw.z = 2.5; saw.heading = Math.PI / 2; saw.speed = 30;
      saw.group.position.set(-10, 0, 2.5);
      saw.group.rotation.y = Math.PI / 2;
      VB.player.resetTo(-10, 2.5, Math.PI / 2);
      VB.player.enterVehicle(saw, true);
      // Spread traffic along the road, clear of the Saw and of the roadblock
      var txs = [-70, -55, -40, -25, 40, 28, 55, 60, 70, -60, 48, 50, -45];
      VB.ai.traffic.forEach(function (t, i) {
        var nx = txs[i % txs.length], nz = (i % 2 === 0) ? 2.5 : -2.5;
        t.x = nx; t.z = nz;
        t.group.position.set(nx, 0, nz);
      });
      VB.ai.addWanted(5, 'chase');
      VB.missions.setStage(6, 1); // M7 chase stage
      // Police convoy IN FRAME: ahead and alongside the Saw, not behind the camera
      var convoy = [[6, 2.5], [0, -2.5], [12, -2.5], [14, 2.5], [18, -2.5], [24, 2.5]];
      VB.ai.units.forEach(function (u, i) {
        var c = convoy[i % convoy.length];
        u.x = c[0]; u.z = c[1];
        u.group.position.set(u.x, 0, u.z);
        u.heading = Math.PI / 2; u.group.rotation.y = Math.PI / 2;
        u.dist = Math.round(Math.hypot(u.x - VB.player.pos.x, u.z - VB.player.pos.z));
      });
      // Roadblock ahead spanning BOTH lanes (x=30, two cars across the road)
      [-1.8, 1.8].forEach(function (off) {
        var g = VB.player.makeCar({ color: 0xf2f2f2, police: true });
        g.group.position.set(30, 0, off);
        g.group.rotation.y = Math.PI / 2;
        addStaged(g.group);
      });
      // BIG helicopter: placeHeli(12,6.5,0), scale 1.8, side profile to the camera.
      // The chase camera sits 9.5 m behind the Saw, so a heli 22 m ahead of the
      // Saw is ~41 m from the camera and reads small (~19% of frame width);
      // at 12 m ahead, scale 1.8, it is ~32 m from the camera and reads ~28%
      // — big and clear. z=0 puts it over the road centre (on the camera axis);
      // y=6.5 keeps the rotor inside the frame. The airframe must lie
      // north-south (rotation.y = PI/2, nose left) for body + tail + rotor
      // to read in profile.
      VB.ai.placeHeli(12, 6.5, 0);
      VB.ai.heli.scale.set(1.8, 1.8, 1.8);
      VB.ai.heli.rotation.y = Math.PI / 2;
      // Densify: +8 extra vehicles (incl. Red GT + 1 police) and +10 pedestrians
      var extraCars = [
        [-32, 2.5, 'sedan', 0xdddddd], [-18, -2.5, 'sedan', 0x2e6b8a], [34, -2.5, 'gt', 0xc0392b],
        [44, 2.5, 'sedan', 0xe8b13c], [-48, 2.5, 'van', 0x222831], [52, -2.5, 'sedan', 0x7b5cff],
        [36, 2.5, 'police', 0xf2f2f2], [-62, -2.5, 'sedan', 0x3a6b4f]
      ];
      extraCars.forEach(function (ec) {
        var car = ec[2] === 'gt' ? VB.player.makeCar({ color: ec[3], sport: true, plate: 'GT-77' })
          : ec[2] === 'van' ? VB.player.makeVan(ec[3])
          : ec[2] === 'police' ? VB.player.makeCar({ color: ec[3], police: true })
          : VB.player.makeCar({ color: ec[3] });
        car.group.position.set(ec[0], 0, ec[1]);
        addStaged(car.group);
      });
      for (var pi = 0; pi < 10; pi++) {
        var h = VB.player.makeHumanoid({
          height: 1.65 + Math.random() * 0.2,
          shirt: [0x2e6b8a, 0xc0392b, 0xd4a017, 0x3a6b4f][pi % 4],
          pants: 0x2a3242, hair: 0x1a1a1a, hairStyle: 'normal'
        });
        h.group.position.set(-24 + pi * 5, 0, pi % 2 ? 6.5 : -6.5);
        h.setPose('walk');
        addStaged(h.group);
      }
      // Extra street props so nothing reads empty
      addStaged(VB.world.makeLamp(-34, 5.4));
      addStaged(VB.world.makeLamp(-16, -5.4));
      addStaged(VB.world.makePalm(-28, 6.5, 1));
      addStaged(VB.world.makePalm(20, -6.5, 1));
      addStaged(VB.world.makePalm(44, 6.5, 1));
      addStaged(VB.world.makePalm(-44, -6.5, 1));
      // Pedestrians fleeing on the sidewalks
      VB.ai.peds.forEach(function (p, i) {
        p.x = -20 + i * 6; p.z = i % 2 ? 6.5 : -6.5;
        p.group.position.set(p.x, 0, p.z);
        p.fleeing = true;
      });
      // Tommy dialogue — raised so it does not cover the Saw's plate
      VB.missions.showDialogue([
        { who: 'TOMMY — Foreman', text: 'They\'re on us! Stay on Beach Blvd — lose them at the marina!' }
      ], null);
      var dlg = document.getElementById('dialogue');
      if (dlg) dlg.style.bottom = '170px';
      VB.player.heroSaw.speed = 30;
      VB.state.speedKmh = 108; // 30 m/s — the speedo reads the state, and
      // driveVehicle (which normally sets it) never runs while frozen
      VB.hud.refresh();
      VB.hud.drawMinimap(); // frozen staging never runs hud.update, so the
      // minimap canvas would stay blank (transparent) without this
      VB.player.updateCamera(camera, 1);
      VB.player.updateCamera(camera, 1);
      // Tilt the chase camera up ~5° so the heli sits in the upper-centre frame
      VB.player.camTilt = 0.08;
      VB.player.updateCamera(camera, 1);
      VB.freeze(true);
    },
    stageNight: function () {
      clearStaged();
      VB.hud.setMode('playing');
      demoSave();
      VB.world.setTimeOfDay('night');
      VB.player.setCamera(Math.PI, 0.22, 6.5);
      // Eli on the north side of the street (z=-1), facing north toward the
      // thugs; camera sits south of him looking north, thugs beyond him.
      VB.player.resetTo(-64, -1, Math.PI);
      // Park the lumber truck out of frame (it sat 4 m from Eli and filled
      // the foreground as a huge red box in the first night capture).
      var mt = VB.player.missionTruck;
      mt.x = -88; mt.z = -22; mt.group.position.set(-88, 0, -22);
      // Clear traffic away from Eli (a parked car was crowding the right edge)
      var ntx = [-70, -55, -40, 40, 55, 70, -30, 30, 48, 60, -48, 20, -38];
      VB.ai.traffic.forEach(function (t, i) {
        var nx = ntx[i % ntx.length], nz = (i % 2 === 0) ? 2.5 : -2.5;
        t.x = nx; t.z = nz;
        t.group.position.set(nx, 0, nz);
      });
      // Fill the frame: market tents on the north sidewalk (z -7..-8, just
      // in front of the building faces), clustered west of centre so the
      // weapon wheel (right side) covers none of them.
      var tentSpots = [[-69, -7, 0xd94f4f], [-66, -8, 0xd4a017], [-63, -7, 0x2e6b8a]];
      tentSpots.forEach(function (ts) {
        var tent = new THREE.Group();
        var base = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }));
        base.position.y = 0.8;
        tent.add(base);
        var roofT = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), new THREE.MeshStandardMaterial({ color: ts[2], roughness: 0.8, emissive: ts[2], emissiveIntensity: 0.35 }));
        roofT.position.y = 2.3; roofT.rotation.y = Math.PI / 4;
        tent.add(roofT);
        tent.position.set(ts[0], 0, ts[1]);
        addStaged(tent);
      });
      VB.combat.setWeapon('pistol');
      // Three thugs mid-fight ON THE NORTH SIDEWALK, 4-6 m north of Eli,
      // clustered west of centre so they project into the open frame
      // between the VBPD panel (left) and the weapon wheel (right).
      // (Earlier spots at x -58..-60 / z -8..-12 projected behind the
      // wheel, behind the VBPD panel, or inside the north-side buildings,
      // so the fight was invisible.)
      VB.combat.spawnThug(-67, -5, 'pistol', 'night');
      VB.combat.spawnThug(-65, -6, 'bat', 'night');
      VB.combat.spawnThug(-64, -7, 'pistol', 'night');
      VB.missions.preview(6, 1);
      VB.hud.refresh();
      VB.player.updateCamera(camera, 1);
      // Mid-fight: Eli fires (tracer + flash from the camera ray)
      VB.combat.aiming = true;
      VB.combat.fire();
      // Keep ammo consistent across shots (12/48 everywhere): reset BEFORE
      // opening the wheel, so the wheel segment and the HUD bar agree
      // (the wheel renders its ammo text when it opens).
      VB.state.weapons.pistol.ammo = 12;
      VB.combat.openWheel();
      // Shift the wheel right AND down so Eli + the thugs stay visible left of
      // it and its top segment clears the HUD weapon bar (the 420 px wheel
      // used to cover them completely at screen centre).
      document.getElementById('wheel').style.transform = 'translate(calc(-50% + 260px), calc(-50% + 60px))';
      VB.hud.refresh();
      VB.hud.drawMinimap(); // frozen staging never runs hud.update, so the
      // minimap canvas would stay blank (transparent) without this
      VB.freeze(true);
      // Frozen-frame combat FX: the west pistol thug's tracer toward Eli,
      // and the damage number on the bat thug Eli just hit — both in the
      // open centre-left of the frame, clear of the wheel.
      VB.combat.stageCombatFX(
        new THREE.Vector3(-67, 1.4, -5), new THREE.Vector3(-64, 1.3, -1),
        '-34', new THREE.Vector3(-65, 1.8, -6));
    },
    stageMap: function () {
      clearStaged();
      VB.hud.setMode('playing');
      demoSave();
      VB.world.setTimeOfDay('day');
      VB.player.resetTo(-30, 4, 0);
      VB.missions.preview(6, 1);
      VB.hud.refresh();
      VB.hud.openMap('map');
      VB.freeze(true);
    },
    stageTitle: function () {
      clearStaged();
      demoSave();
      VB.save.write(1); // title slots show the same canonical save as the other shots
      VB.hud.showTitle();
      VB.freeze(true);
    },
    stageWin: function () {
      clearStaged();
      VB.missions.win();
      VB.freeze(true);
    }
  };

  window.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
})();
