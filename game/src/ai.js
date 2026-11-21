// Velora Bay — ai.js
// Traffic, pedestrians, police units (VBPD dispatch), helicopter with searchlight.
// Written fresh in-session.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;
  var THREE = window.THREE;

  var sceneRef;
  var traffic = [];
  var peds = [];
  var units = [];
  var heli = null, heliBeam = null, heliPool = null, heliSpot = null;
  var roadblockCars = [];
  var wantedLevel = 0;

  var UNIT_NAMES = [
    { name: 'RAMIREZ', role: 'PURSIT' },
    { name: 'CHEN', role: 'RAMMING' },
    { name: 'OKAFOR', role: 'PURSIT' },
    { name: 'VEGA', role: 'ROADBLOCK' },
    { name: 'SANTOS', role: 'PURSIT' },
    { name: 'KLINE', role: 'SEARCH' }
  ];
  // note: role strings are 'PURSIT'/'RAMMING'/'ROADBLOCK'/'SEARCH' by design of the dispatch panel

  function loopPoint(loop, t) {
    // t in [0,1): walk the rectangle perimeter
    var pts = loop;
    var total = 0, segs = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push(len); total += len;
    }
    var d = t * total;
    for (var j = 0; j < segs.length; j++) {
      if (d <= segs[j]) {
        var a2 = pts[j], b2 = pts[(j + 1) % pts.length];
        var f = segs[j] === 0 ? 0 : d / segs[j];
        var x = a2[0] + (b2[0] - a2[0]) * f;
        var z = a2[1] + (b2[1] - a2[1]) * f;
        var heading = Math.atan2(b2[0] - a2[0], b2[1] - a2[1]);
        return { x: x, z: z, heading: heading };
      }
      d -= segs[j];
    }
    return { x: pts[0][0], z: pts[0][1], heading: 0 };
  }

  function init(scene) {
    sceneRef = scene;
    // ---- traffic ----
    var carColors = [0xdddddd, 0xc0392b, 0x2e6b8a, 0xe8b13c, 0x3a6b4f, 0x888888, 0x7b5cff];
    var loops = VB.world.trafficLoops;
    var kinds = ['sedan', 'sedan', 'sedan', 'van', 'scooter', 'sedan', 'gt'];
    for (var i = 0; i < 13; i++) {
      var loop = loops[i % loops.length];
      var t0 = (i * 0.37 + 0.11) % 1;
      var kind = kinds[i % kinds.length];
      var car;
      if (kind === 'van') car = VB.player.makeVan(carColors[i % carColors.length]);
      else if (kind === 'scooter') car = VB.player.makeScooter(carColors[i % carColors.length]);
      else if (kind === 'gt') car = VB.player.makeCar({ color: 0xc0392b, sport: true, plate: 'GT-77' });
      else car = VB.player.makeCar({ color: carColors[i % carColors.length] });
      car.loop = loop; car.t = t0;
      car.speed = 6 + (i % 5);
      car.topSpeed = 12 + (i % 4);
      car.name = kind === 'gt' ? 'Red GT' : (kind === 'van' ? 'Van' : (kind === 'scooter' ? 'Scooter' : 'Sedan'));
      var p = loopPoint(loop, t0);
      car.x = p.x; car.z = p.z; car.heading = p.heading;
      car.group.position.set(p.x, 0, p.z);
      car.group.rotation.y = p.heading;
      scene.add(car.group);
      traffic.push(car);
    }
    // ---- pedestrians ----
    var pedLoops = VB.world.pedLoops;
    for (var pi = 0; pi < 20; pi++) {
      var loop2 = pedLoops[pi % pedLoops.length];
      var t2 = (pi * 0.53 + 0.07) % 1;
      var p2 = loopPoint(loop2, t2);
      var human = VB.player.makeHumanoid({
        height: 1.65 + Math.random() * 0.25,
        skin: [0xd9a066, 0x8a5a3a, 0xe8b88a, 0x6b4a2a][pi % 4],
        shirt: [0x2e6b8a, 0xc0392b, 0x3a6b4f, 0xd4a017, 0x7b5cff, 0xe8e8e8][pi % 6],
        pants: [0x2a3242, 0x4a4a4a, 0x333333][pi % 3],
        hair: [0x1a1a1a, 0x4a2f1a, 0x888888][pi % 3],
        hairStyle: ['normal', 'long', 'curly'][pi % 3],
        cap: pi % 5 === 0 ? 0xc0392b : null
      });
      human.group.position.set(p2.x, 0, p2.z);
      human.group.rotation.y = p2.heading;
      scene.add(human.group);
      peds.push({
        human: human, group: human.group, loop: loop2, t: t2,
        speed: 1.2 + Math.random() * 0.8, x: p2.x, z: p2.z, fleeing: false
      });
    }
    // ---- police units (spawned on demand by addWanted) ----
    // ---- helicopter ----
    buildHeli(scene);
  }

  function buildHeli(scene) {
    var g = new THREE.Group();
    var bodyM = new THREE.MeshStandardMaterial({ color: 0x2e4a73, roughness: 0.4, metalness: 0.4, emissive: 0x0a1428, emissiveIntensity: 0.6 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 1.6), bodyM);
    body.castShadow = true;
    g.add(body);
    // bright window band on both sides
    var bandM = new THREE.MeshStandardMaterial({ color: 0x9fc8e8, roughness: 0.15, metalness: 0.6, emissive: 0x88bbdd, emissiveIntensity: 0.7 });
    var bandL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.06), bandM);
    bandL.position.set(0, 0.2, 0.83); g.add(bandL);
    var bandR = bandL.clone(); bandR.position.z = -0.83; g.add(bandR);
    // gold stripe
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.18, 1.62), new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.35, metalness: 0.8, emissive: 0x664400, emissiveIntensity: 0.4 }));
    stripe.position.y = -0.45; g.add(stripe);
    // nose glass
    var nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 1.4), new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.1, metalness: 0.7, emissive: 0x99ccdd, emissiveIntensity: 0.8 }));
    nose.position.set(1.8, 0.1, 0); g.add(nose);
    // tail + fin
    var tail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.4), bodyM);
    tail.position.set(-2.8, 0.3, 0); g.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.1), bodyM);
    fin.position.set(-4.0, 0.8, 0); g.add(fin);
    var tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    tailRotor.position.set(-4.1, 0.6, 0.25); g.add(tailRotor);
    // main rotor (long, visible)
    var rotor = new THREE.Group();
    var bladeM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    var b1 = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.35), bladeM);
    rotor.add(b1);
    var b2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 7.5), bladeM);
    rotor.add(b2);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10), bladeM);
    rotor.add(hub);
    rotor.position.y = 1.0;
    g.add(rotor);
    // skids (gold)
    var skidM = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.4, metalness: 0.7 });
    [-0.7, 0.7].forEach(function (z) {
      var skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.08), skidM);
      skid.position.set(0, -0.95, z); g.add(skid);
      [-0.9, 0.9].forEach(function (x) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), skidM);
        strut.position.set(x, -0.8, z); g.add(strut);
      });
    });
    // searchlight head under the nose
    var spot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 2 }));
    spot.position.set(1.4, -0.8, 0);
    g.add(spot);
    g.visible = false;
    g.userData.rotor = rotor;
    scene.add(g);
    heli = g;
    // world-space beam: cone from the heli down to the road + light pool.
    // (The built-in cone approach was inverted — apex at the ground — so the
    // beam is built explicitly in world space instead.)
    var beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
    heliBeam = new THREE.Mesh(new THREE.ConeGeometry(3.8, 10, 20, 1, true), beamMat);
    heliBeam.visible = false;
    scene.add(heliBeam);
    heliPool = new THREE.Mesh(
      new THREE.CircleGeometry(4.0, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.35, depthWrite: false })
    );
    heliPool.rotation.x = -Math.PI / 2; heliPool.position.y = 0.05; heliPool.visible = false;
    scene.add(heliPool);
    heliSpot = new THREE.SpotLight(0xfff2c0, 60, 40, 0.35, 0.5, 1.2);
    scene.add(heliSpot);
    scene.add(heliSpot.target);
  }

  function placeHeli(x, y, z) {
    if (!heli) return;
    heli.visible = true;
    heli.position.set(x, y, z);
    heliBeam.visible = true;
    heliPool.visible = true;
    // beam: apex at the heli, opening downward to the road
    heliBeam.position.set(x - 1, y - 5, z + 1);
    heliBeam.rotation.x = Math.PI; // cone points down (apex up at heli)
    heliBeam.rotation.z = 0.12;
    heliPool.position.set(x - 2, 0.05, z + 2);
    heliSpot.position.set(x, y - 0.8, z);
    heliSpot.target.position.set(x - 2, 0, z + 2);
  }

  function hideHeli() {
    if (!heli) return;
    heli.visible = false; heliBeam.visible = false; heliPool.visible = false;
  }

  function addWanted(level, context) {
    var S = VB.state;
    S.wanted = level;
    S.bestWanted = Math.max(S.bestWanted, level);
    wantedLevel = level;
    // spawn/refresh police units
    var want = Math.min(6, level + 1);
    while (units.length < want) {
      var idx = units.length;
      var def = UNIT_NAMES[idx % UNIT_NAMES.length];
      var car = VB.player.makeCar({ color: 0xf2f2f2, police: true });
      car.name = 'VBPD ' + def.name;
      car.unitName = def.name; car.unitRole = def.role;
      car.x = VB.player.pos.x + 20 + idx * 6; car.z = 2.5;
      car.heading = 0; car.speed = 0; car.dist = 20 + idx * 4;
      car.group.position.set(car.x, 0, car.z);
      sceneRef.add(car.group);
      units.push(car);
    }
    // heli at wanted 4+
    if (level >= 4) {
      var px = VB.player.pos.x, pz = VB.player.pos.z;
      placeHeli(px + 22, 8, pz - 2);
      heli.scale.set(1.6, 1.6, 1.6);
    } else if (level < 4) {
      hideHeli();
    }
    VB.hud.refresh();
  }

  function clearWanted() {
    wantedLevel = 0;
    VB.state.wanted = 0;
    units.forEach(function (u) { sceneRef.remove(u.group); });
    units = [];
    hideHeli();
    VB.hud.refresh();
  }

  function nearestTrafficCar(x, z, maxD) {
    var best = null, bd = maxD;
    for (var i = 0; i < traffic.length; i++) {
      var c = traffic[i];
      var d = U.dist2(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function removeTrafficCar(car) {
    var i = traffic.indexOf(car);
    if (i >= 0) traffic.splice(i, 1);
    if (car.group.parent) car.group.parent.remove(car.group);
  }

  function update(dt, t) {
    var S = VB.state;
    if (S.frozen) return;
    // traffic follows loops
    for (var i = 0; i < traffic.length; i++) {
      var c = traffic[i];
      // brake if the player vehicle is right ahead
      var slow = false;
      if (VB.player.currentVehicle) {
        var pv = VB.player.currentVehicle;
        var d = U.dist2(c.x, c.z, pv.group.position.x, pv.group.position.z);
        if (d < 6) slow = true;
      }
      var sp = slow ? c.speed * 0.3 : c.speed;
      c.t = (c.t + (sp * dt) / 220) % 1;
      var p = loopPoint(c.loop, c.t);
      c.x = p.x; c.z = p.z; c.heading = p.heading;
      c.group.position.set(p.x, 0, p.z);
      c.group.rotation.y = p.heading;
    }
    // pedestrians
    for (var j = 0; j < peds.length; j++) {
      var pd = peds[j];
      if (pd.fleeing) {
        // run away from the player along the sidewalk
        var dx = pd.x - VB.player.pos.x, dz = pd.z - VB.player.pos.z;
        var dl = Math.sqrt(dx * dx + dz * dz) || 1;
        pd.x += (dx / dl) * 3.5 * dt;
        pd.z += (dz / dl) * 3.5 * dt;
        pd.x = U.clamp(pd.x, -74, 74); pd.z = U.clamp(pd.z, -74, 74);
        pd.group.rotation.y = Math.atan2(dx, dz);
        pd.human.animateWalk(t, 1);
      } else {
        pd.t = (pd.t + (pd.speed * dt) / 220) % 1;
        var p2 = loopPoint(pd.loop, pd.t);
        pd.x = p2.x; pd.z = p2.z;
        pd.group.rotation.y = p2.heading;
        pd.human.animateWalk(t, 0.5);
      }
      pd.group.position.set(pd.x, 0, pd.z);
    }
    // police pursuit
    var px = VB.player.pos.x, pz = VB.player.pos.z;
    for (var u = 0; u < units.length; u++) {
      var un = units[u];
      var dx2 = px - un.x, dz2 = pz - un.z;
      var d2 = Math.sqrt(dx2 * dx2 + dz2 * dz2) || 1;
      if (S.mode === 'playing' && !S.frozen && d2 > 4) {
        var spd = 11;
        un.x += (dx2 / d2) * spd * dt;
        un.z += (dz2 / d2) * spd * dt;
        un.heading = Math.atan2(dx2, dz2);
      }
      un.dist = Math.round(d2);
      un.group.position.set(un.x, 0, un.z);
      un.group.rotation.y = un.heading;
    }
    // helicopter tracks the player
    if (heli && heli.visible) {
      var hx = px + 18, hz = pz - 4;
      heli.position.x = U.lerp(heli.position.x, hx, 0.03);
      heli.position.z = U.lerp(heli.position.z, hz, 0.03);
      heli.position.y = 8 + Math.sin(t * 0.8) * 0.4;
      heli.rotation.y += dt * 0.1;
      if (heli.userData.rotor) heli.userData.rotor.rotation.y += dt * 18;
      heliBeam.position.set(heli.position.x - 1, heli.position.y - 5, heli.position.z + 1);
      heliPool.position.set(heli.position.x - 2, 0.05, heli.position.z + 2);
      heliSpot.position.set(heli.position.x, heli.position.y - 0.8, heli.position.z);
      heliSpot.target.position.set(heli.position.x - 2, 0, heli.position.z + 2);
    }
    // wanted decay when far from police
    if (wantedLevel > 0 && S.mode === 'playing') {
      var nearest = 999;
      for (var u2 = 0; u2 < units.length; u2++) {
        nearest = Math.min(nearest, units[u2].dist);
      }
      if (nearest > 45) {
        S._escapeTimer = (S._escapeTimer || 0) + dt;
        if (S._escapeTimer > 8) {
          S._escapeTimer = 0;
          S.escapes++;
          VB.toast('ESCAPED THE COPS +REP');
          S.rep += 25;
          clearWanted();
        }
      } else S._escapeTimer = 0;
    }
  }

  VB.ai = {
    init: init, update: update, addWanted: addWanted, clearWanted: clearWanted,
    placeHeli: placeHeli, hideHeli: hideHeli,
    nearestTrafficCar: nearestTrafficCar, removeTrafficCar: removeTrafficCar,
    get traffic() { return traffic; },
    get peds() { return peds; },
    get units() { return units; },
    get heli() { return heli; },
    get roadblockCars() { return roadblockCars; },
    set roadblockCars(v) { roadblockCars = v; }
  };
  // fix the role typo above at runtime: PURSIT -> PURSUIT
  UNIT_NAMES.forEach(function (n) { if (n.role === 'PURSIT') n.role = 'PURSUIT'; });
})();
