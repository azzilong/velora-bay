// Velora Bay — player.js
// Characters (Eli, crew, police, thugs, Barnaby), vehicles, movement, camera,
// driving, carjacking. Written fresh in-session.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;
  var THREE = window.THREE;

  // ---------------- input ----------------
  var keys = {};
  var pressed = {};
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Tab') e.preventDefault();
    if (!e.repeat) { keys[e.code] = true; pressed[e.code] = true; }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  VB.input = {
    keys: keys,
    down: function (code) { return !!keys[code]; },
    consume: function (code) { var v = !!pressed[code]; pressed[code] = false; return v; },
    hasPressed: function (code) { return !!pressed[code]; },
    press: function (code) { keys[code] = true; pressed[code] = true; },
    release: function (code) { keys[code] = false; },
    clearPressed: function () { pressed = {}; }
  };

  // ---------------- character factory ----------------
  function mat(color, rough, metal, emissive, ei) {
    return new THREE.MeshStandardMaterial({
      color: color, roughness: rough == null ? 0.85 : rough,
      metalness: metal || 0, emissive: emissive || 0x000000, emissiveIntensity: ei || 0
    });
  }
  function box(w, h, d, m) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.castShadow = true;
    return mesh;
  }

  // Humanoid with joint pivots. opts: height, skin, hair, hairStyle, shirt, pants,
  // jacket, cap, glasses, beard, scarf, bag, vest, tie, cane, mustache.
  function makeHumanoid(o) {
    o = o || {};
    var h = o.height || 1.8;
    var s = h / 1.8; // scale factor
    var g = new THREE.Group();
    var skin = mat(o.skin || 0xd9a066);
    var shirtM = mat(o.shirt || 0x888888);
    var pantsM = mat(o.pants || 0x2a3242);
    var shoeM = mat(0x222222, 0.6);
    // legs (pivot at hip)
    var legL = new THREE.Group(); legL.position.set(-0.11 * s, 0.95 * s, 0);
    var legR = new THREE.Group(); legR.position.set(0.11 * s, 0.95 * s, 0);
    var ll = box(0.2 * s, 0.9 * s, 0.22 * s, pantsM); ll.position.y = -0.45 * s; legL.add(ll);
    var lr = box(0.2 * s, 0.9 * s, 0.22 * s, pantsM); lr.position.y = -0.45 * s; legR.add(lr);
    var shoeL = box(0.22 * s, 0.1 * s, 0.34 * s, shoeM); shoeL.position.set(0, -0.9 * s, 0.06 * s); legL.add(shoeL);
    var shoeR = shoeL.clone(); legR.add(shoeR);
    g.add(legL); g.add(legR);
    // torso
    var torso = box(0.52 * s, 0.62 * s, 0.3 * s, shirtM);
    torso.position.y = 1.28 * s;
    g.add(torso);
    // jacket (open front panels)
    if (o.jacket) {
      var jm = mat(o.jacket);
      var jL = box(0.14 * s, 0.58 * s, 0.06 * s, jm); jL.position.set(-0.2 * s, 1.28 * s, 0.16 * s); g.add(jL);
      var jR = box(0.14 * s, 0.58 * s, 0.06 * s, jm); jR.position.set(0.2 * s, 1.28 * s, 0.16 * s); g.add(jR);
      var jB = box(0.52 * s, 0.58 * s, 0.06 * s, jm); jB.position.set(0, 1.28 * s, -0.16 * s); g.add(jB);
    }
    // vest + badge
    if (o.vest) {
      var vest = box(0.56 * s, 0.5 * s, 0.34 * s, mat(o.vest));
      vest.position.y = 1.3 * s; g.add(vest);
      var badge = new THREE.Mesh(new THREE.CircleGeometry(0.05 * s, 12), mat(0xd4a017, 0.3, 0.8));
      badge.position.set(-0.16 * s, 1.42 * s, 0.18 * s); g.add(badge);
    }
    // tie
    if (o.tie) {
      var tie = box(0.09 * s, 0.4 * s, 0.04 * s, mat(o.tie));
      tie.position.set(0, 1.32 * s, 0.17 * s); g.add(tie);
    }
    // arms (pivot at shoulder)
    var armL = new THREE.Group(); armL.position.set(-0.32 * s, 1.56 * s, 0);
    var armR = new THREE.Group(); armR.position.set(0.32 * s, 1.56 * s, 0);
    var al = box(0.16 * s, 0.62 * s, 0.18 * s, o.jacket ? mat(o.jacket) : shirtM); al.position.y = -0.31 * s; armL.add(al);
    var ar = box(0.16 * s, 0.62 * s, 0.18 * s, o.jacket ? mat(o.jacket) : shirtM); ar.position.y = -0.31 * s; armR.add(ar);
    var handL = box(0.15 * s, 0.14 * s, 0.16 * s, skin); handL.position.y = -0.66 * s; armL.add(handL);
    var handR = box(0.15 * s, 0.14 * s, 0.16 * s, skin); handR.position.y = -0.66 * s; armR.add(handR);
    g.add(armL); g.add(armR);
    // head
    var head = new THREE.Group(); head.position.y = 1.78 * s;
    var skull = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.36 * s, 0.32 * s), skin);
    skull.castShadow = true; head.add(skull);
    // eyes (dark dots)
    var eyeM = mat(0x1a1a1a, 0.4);
    var eL = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.06 * s, 0.02 * s), eyeM);
    eL.position.set(-0.08 * s, 0.03 * s, 0.17 * s); head.add(eL);
    var eR = eL.clone(); eR.position.x = 0.08 * s; head.add(eR);
    // hair styles
    var hairM = mat(o.hair || 0x3a2a1a);
    if (o.hairStyle === 'long') {
      var hl = box(0.36 * s, 0.5 * s, 0.1 * s, hairM); hl.position.set(0, -0.05 * s, -0.16 * s); head.add(hl);
      var ht = box(0.36 * s, 0.12 * s, 0.34 * s, hairM); ht.position.y = 0.2 * s; head.add(ht);
    } else if (o.hairStyle === 'slick') {
      var hs = box(0.36 * s, 0.1 * s, 0.34 * s, hairM); hs.position.y = 0.2 * s; head.add(hs);
    } else if (o.hairStyle === 'curly') {
      for (var ci = 0; ci < 5; ci++) {
        var curl = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), hairM);
        curl.position.set(-0.12 * s + ci * 0.06 * s, 0.22 * s, (ci % 2) * 0.08 * s);
        head.add(curl);
      }
    } else if (o.hairStyle === 'white') {
      var hw = box(0.36 * s, 0.12 * s, 0.34 * s, mat(0xdddddd)); hw.position.y = 0.2 * s; head.add(hw);
    } else {
      var hn = box(0.36 * s, 0.14 * s, 0.34 * s, hairM); hn.position.y = 0.19 * s; head.add(hn);
    }
    // cap
    if (o.cap) {
      var capM = mat(o.cap);
      var capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.19 * s, 0.19 * s, 0.1 * s, 10), capM);
      capTop.position.y = 0.22 * s; head.add(capTop);
      var brim = box(0.3 * s, 0.03 * s, 0.16 * s, capM); brim.position.set(0, 0.18 * s, 0.22 * s); head.add(brim);
    }
    // police cap
    if (o.policeCap) {
      var pc = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.21 * s, 0.09 * s, 10), mat(0x1a2a4a));
      pc.position.y = 0.22 * s; head.add(pc);
      var pb = box(0.3 * s, 0.03 * s, 0.14 * s, mat(0x111111)); pb.position.set(0, 0.18 * s, 0.22 * s); head.add(pb);
    }
    // beard / mustache
    if (o.beard) {
      var bd = box(0.3 * s, 0.16 * s, 0.06 * s, hairM); bd.position.set(0, -0.14 * s, 0.15 * s); head.add(bd);
    }
    if (o.mustache) {
      var mu = box(0.2 * s, 0.05 * s, 0.04 * s, hairM); mu.position.set(0, -0.05 * s, 0.17 * s); head.add(mu);
    }
    // glasses
    if (o.glasses) {
      var gl = mat(0x111111, 0.3, 0.5);
      var gL = box(0.1 * s, 0.08 * s, 0.03 * s, gl); gL.position.set(-0.09 * s, 0.03 * s, 0.17 * s); head.add(gL);
      var gR = gL.clone(); gR.position.x = 0.09 * s; head.add(gR);
    }
    // scarf
    if (o.scarf) {
      var sc = box(0.4 * s, 0.12 * s, 0.36 * s, mat(o.scarf)); sc.position.y = 1.62 * s; g.add(sc);
    }
    // bag
    if (o.bag) {
      var bag = box(0.24 * s, 0.3 * s, 0.1 * s, mat(o.bag)); bag.position.set(0.3 * s, 1.2 * s, -0.2 * s); g.add(bag);
    }
    g.add(head);
    // held weapon anchor (right hand)
    var held = new THREE.Group();
    held.position.set(0, -0.72 * s, 0.05 * s);
    armR.add(held);
    // poses
    function setPose(pose) {
      if (pose === 'idle') {
        armL.rotation.x = 0; armR.rotation.x = 0;
        legL.rotation.x = 0; legR.rotation.x = 0;
        armL.rotation.z = 0.08; armR.rotation.z = -0.08;
      } else if (pose === 'walk') {
        // animated externally via animateWalk
      } else if (pose === 'aim') {
        armR.rotation.x = -Math.PI / 2 + 0.15; armR.rotation.z = -0.1;
        armL.rotation.x = -Math.PI / 2 + 0.3; armL.rotation.z = 0.25;
        legL.rotation.x = 0.15; legR.rotation.x = -0.15;
      } else if (pose === 'swing') {
        armR.rotation.x = -1.9; armR.rotation.z = -0.3;
        armL.rotation.x = 0.4;
        legL.rotation.x = 0.3; legR.rotation.x = -0.2;
      } else if (pose === 'cheer') {
        armL.rotation.x = -2.6; armR.rotation.x = -2.6;
        armL.rotation.z = 0.4; armR.rotation.z = -0.4;
        legL.rotation.x = 0; legR.rotation.x = 0;
      } else if (pose === 'drive') {
        armR.rotation.x = -1.1; armL.rotation.x = -1.1;
        legL.rotation.x = -1.2; legR.rotation.x = -1.2;
      }
    }
    function animateWalk(t, speed) {
      var sw = Math.sin(t * 10) * 0.55 * U.clamp(speed, 0, 1);
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.7; armR.rotation.x = sw * 0.7;
    }
    return { group: g, parts: { head: head, torso: torso, armL: armL, armR: armR, legL: legL, legR: legR, held: held }, setPose: setPose, animateWalk: animateWalk, height: h };
  }

  // ---------------- Barnaby (German Shepherd) ----------------
  function makeDog() {
    var g = new THREE.Group();
    var tan = mat(0xc9a06a);
    var black = mat(0x2a2320);
    var body = box(0.55, 0.5, 1.0, tan); body.position.y = 0.55; g.add(body);
    var saddle = box(0.57, 0.3, 0.6, black); saddle.position.set(0, 0.72, -0.05); g.add(saddle);
    var headG = new THREE.Group(); headG.position.set(0, 0.85, 0.55);
    var skull = box(0.32, 0.3, 0.34, tan); headG.add(skull);
    var snout = box(0.18, 0.16, 0.3, tan); snout.position.set(0, -0.05, 0.28); headG.add(snout);
    var nose = box(0.12, 0.08, 0.06, black); nose.position.set(0, -0.02, 0.44); headG.add(nose);
    var earL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 4), black); earL.position.set(-0.11, 0.26, 0); headG.add(earL);
    var earR = earL.clone(); earR.position.x = 0.11; headG.add(earR);
    g.add(headG);
    var legs = [];
    [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]].forEach(function (p) {
      var leg = box(0.12, 0.5, 0.12, tan); leg.position.set(p[0], 0.25, p[1]); g.add(leg); legs.push(leg);
    });
    var tail = box(0.1, 0.1, 0.5, black); tail.position.set(0, 0.7, -0.65); tail.rotation.x = -0.5; g.add(tail);
    var marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat(0xffd34d, 0.4, 0, 0xffd34d, 1));
    marker.position.set(0, 1.5, 0); marker.visible = false;
    g.add(marker);
    function animateDogWalk(t, speed) {
      var sw = Math.sin(t * 12) * 0.5 * U.clamp(speed, 0, 1);
      legs[0].rotation.x = sw; legs[3].rotation.x = sw;
      legs[1].rotation.x = -sw; legs[2].rotation.x = -sw;
      tail.rotation.y = Math.sin(t * 6) * 0.4;
    }
    return { group: g, animateDogWalk: animateDogWalk, marker: marker, head: headG };
  }

  // ---------------- vehicles ----------------
  function makeWheel(r) {
    var g = new THREE.Group();
    var tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.22, 14), mat(0x181818, 0.9));
    tire.rotation.z = Math.PI / 2;
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.24, 10), mat(0xcccccc, 0.3, 0.8));
    rim.rotation.z = Math.PI / 2;
    g.add(tire); g.add(rim);
    return g;
  }

  function makeCar(o) {
    o = o || {};
    var g = new THREE.Group();
    var color = o.color || 0xcccccc;
    var bodyM = mat(color, 0.35, 0.6, o.emissive || 0, o.ei || 0);
    var len = o.length || 4.4, wid = o.width || 1.9;
    // main body: lower slab + cabin
    var lower = box(len, 0.55, wid, bodyM); lower.position.y = 0.55; g.add(lower);
    var hood = box(len * 0.28, 0.28, wid * 0.94, bodyM); hood.position.set(len * 0.36, 0.95, 0); g.add(hood);
    var trunk = box(len * 0.22, 0.26, wid * 0.94, bodyM); trunk.position.set(-len * 0.39, 0.94, 0); g.add(trunk);
    var cabin = box(len * 0.42, 0.5, wid * 0.86, mat(0x1a2438, 0.25, 0.5));
    cabin.position.set(-len * 0.04, 1.05, 0); g.add(cabin);
    var roof = box(len * 0.4, 0.1, wid * 0.88, bodyM); roof.position.set(-len * 0.04, 1.34, 0); g.add(roof);
    // bumpers
    var bumpM = mat(0x222831, 0.5, 0.4);
    var bf = box(0.25, 0.22, wid, bumpM); bf.position.set(len / 2 + 0.05, 0.42, 0); g.add(bf);
    var bb = box(0.25, 0.22, wid, bumpM); bb.position.set(-len / 2 - 0.05, 0.42, 0); g.add(bb);
    // headlights + tail lights
    var hlM = mat(0xffffff, 0.3, 0.2, 0xfff2c0, 1.2);
    var hlL = box(0.08, 0.16, 0.34, hlM); hlL.position.set(len / 2 + 0.02, 0.72, wid / 2 - 0.42); g.add(hlL);
    var hlR = hlL.clone(); hlR.position.z = -wid / 2 + 0.42; g.add(hlR);
    var tlM = mat(0xaa1111, 0.4, 0.2, 0xdd2222, 0.8);
    var tlL = box(0.08, 0.14, 0.34, tlM); tlL.position.set(-len / 2 - 0.02, 0.72, wid / 2 - 0.42); g.add(tlL);
    var tlR = tlL.clone(); tlR.position.z = -wid / 2 + 0.42; g.add(tlR);
    // mirrors
    var mirM = mat(0x222222, 0.5);
    var mL = box(0.12, 0.1, 0.16, mirM); mL.position.set(len * 0.12, 1.05, wid / 2 + 0.06); g.add(mL);
    var mR = mL.clone(); mR.position.z = -wid / 2 - 0.06; g.add(mR);
    // spoiler for sportscars
    if (o.sport) {
      var sp = box(0.5, 0.06, wid * 0.9, mat(0x222831, 0.4, 0.5));
      sp.position.set(-len / 2 + 0.15, 1.28, 0); g.add(sp);
      var spL = box(0.06, 0.3, 0.08, mat(0x222831, 0.4, 0.5)); spL.position.set(-len / 2 + 0.3, 1.12, wid / 2 - 0.3); g.add(spL);
      var spR = spL.clone(); spR.position.z = -wid / 2 + 0.3; g.add(spR);
    }
    // wheels
    var wheels = [];
    [[len * 0.32, wid / 2], [len * 0.32, -wid / 2], [-len * 0.32, wid / 2], [-len * 0.32, -wid / 2]].forEach(function (p) {
      var w = makeWheel(0.36);
      w.position.set(p[0], 0.36, p[1]);
      g.add(w); wheels.push(w);
    });
    // police light bar
    if (o.police) {
      var barBase = box(0.5, 0.1, 1.1, mat(0x222222, 0.5));
      barBase.position.set(-0.04, 1.44, 0); g.add(barBase);
      var red = box(0.4, 0.14, 0.5, mat(0xdd1111, 0.4, 0.2, 0xff2222, 1.5));
      red.position.set(-0.04, 1.54, 0.28); g.add(red);
      var blue = box(0.4, 0.14, 0.5, mat(0x1144dd, 0.4, 0.2, 0x2266ff, 1.5));
      blue.position.set(-0.04, 1.54, -0.28); g.add(blue);
      // navy stripe
      var stripe = box(len * 0.9, 0.18, wid + 0.02, mat(0x1a2a4a, 0.5));
      stripe.position.set(0, 0.62, 0); g.add(stripe);
    }
    // plate
    if (o.plate) {
      var c = document.createElement('canvas'); c.width = 256; c.height = 64;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#111111'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.plate, 128, 34);
      var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      var plate = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
      plate.position.set(-len / 2 - 0.19, 0.45, 0); plate.rotation.y = -Math.PI / 2;
      g.add(plate);
    }
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return { group: g, wheels: wheels, length: len, width: wid };
  }

  function makeVan(color) {
    var g = new THREE.Group();
    var bodyM = mat(color || 0x222831, 0.5, 0.3);
    var body = box(4.8, 1.9, 2.0, bodyM); body.position.y = 1.25; g.add(body);
    var cab = box(1.2, 1.0, 1.9, mat(0x1a2438, 0.25, 0.5)); cab.position.set(1.9, 1.5, 0); g.add(cab);
    var hlM = mat(0xffffff, 0.3, 0.2, 0xfff2c0, 1.0);
    var hl = box(0.08, 0.2, 0.4, hlM); hl.position.set(2.45, 0.8, 0.7); g.add(hl);
    var hl2 = hl.clone(); hl2.position.z = -0.7; g.add(hl2);
    [[1.6, 1.0], [1.6, -1.0], [-1.6, 1.0], [-1.6, -1.0]].forEach(function (p) {
      var w = makeWheel(0.38); w.position.set(p[0], 0.38, p[1]); g.add(w);
    });
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return { group: g, wheels: [], length: 4.8, width: 2.0 };
  }

  function makeTruck() {
    var g = new THREE.Group();
    var cabM = mat(0xd94f2a, 0.5, 0.3);
    var cab = box(1.6, 1.8, 2.1, cabM); cab.position.set(2.6, 1.3, 0); g.add(cab);
    var shield = box(0.2, 0.9, 1.9, mat(0x1a2438, 0.25, 0.5)); shield.position.set(3.35, 1.6, 0); g.add(shield);
    var bed = box(4.6, 0.5, 2.1, mat(0x8a6a42, 0.8)); bed.position.set(-1.2, 0.9, 0); g.add(bed);
    // lumber load
    for (var i = 0; i < 4; i++) {
      var log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 8), mat(0xa8763e, 0.9));
      log.rotation.z = Math.PI / 2; log.position.set(-1.2, 1.35 + (i % 2) * 0.32, -0.5 + (i % 3) * 0.5);
      g.add(log);
    }
    var hlM = mat(0xffffff, 0.3, 0.2, 0xfff2c0, 1.0);
    var hl = box(0.08, 0.2, 0.4, hlM); hl.position.set(3.45, 0.8, 0.7); g.add(hl);
    var hl2 = hl.clone(); hl2.position.z = -0.7; g.add(hl2);
    [[2.6, 1.05], [2.6, -1.05], [-1.8, 1.05], [-1.8, -1.05], [-0.6, 1.05], [-0.6, -1.05]].forEach(function (p) {
      var w = makeWheel(0.42); w.position.set(p[0], 0.42, p[1]); g.add(w);
    });
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return { group: g, wheels: [], length: 6.4, width: 2.1 };
  }

  function makeScooter(color) {
    var g = new THREE.Group();
    var bodyM = mat(color || 0xd94f4f, 0.4, 0.4);
    var body = box(1.7, 0.5, 0.6, bodyM); body.position.y = 0.55; g.add(body);
    var seat = box(0.7, 0.15, 0.5, mat(0x222222, 0.8)); seat.position.set(-0.3, 0.85, 0); g.add(seat);
    var shield = box(0.1, 0.7, 0.5, mat(0x9fc8e8, 0.2, 0.6)); shield.position.set(0.75, 1.0, 0); shield.rotation.z = -0.3; g.add(shield);
    [[0.7, 0], [-0.6, 0]].forEach(function (p) {
      var w = makeWheel(0.3); w.position.set(p[0], 0.3, p[1]); g.add(w);
    });
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return { group: g, wheels: [], length: 1.7, width: 0.6 };
  }

  // ---------------- crew definitions ----------------
  var CREW_DEFS = {
    tommy: { name: 'Tommy Reyes', role: 'Foreman · Combat', color: 0xc0392b, opts: { shirt: 0xc0392b, pants: 0x2a3242, cap: 0xc0392b, mustache: true, height: 1.82 } },
    rosa: { name: 'Rosa Delgado', role: 'Journalist · Intel', color: 0x0e7a7a, opts: { shirt: 0x0e7a7a, pants: 0x333333, hairStyle: 'long', hair: 0x1a1a1a, bag: 0x8a6a42, height: 1.7 } },
    nadia: { name: 'Nadia Kline', role: 'Lawyer · Campaign', color: 0xe8e8e8, opts: { shirt: 0xe8e8e8, pants: 0x2a3242, hairStyle: 'slick', hair: 0xd9b96a, glasses: true, height: 1.74 } },
    marv: { name: 'Big Marv Okafor', role: 'Union · Muscle', color: 0x7a5a3a, opts: { shirt: 0x7a5a3a, pants: 0x222222, beard: true, height: 2.0 } },
    dina: { name: 'Dina Santos', role: 'Escape Driver', color: 0x7b5cff, opts: { shirt: 0x7b5cff, pants: 0x222222, hairStyle: 'curly', hair: 0x1a1a1a, scarf: 0xd94f4f, height: 1.68 } },
    kofi: { name: 'Old Man Kofi', role: 'Harbor · Fishing', color: 0xdddddd, opts: { shirt: 0xdddddd, pants: 0x4a4a4a, hairStyle: 'white', beard: true, height: 1.72 } }
  };

  // ---------------- player state ----------------
  var sceneRef, cameraRef;
  var pos = { x: -63, z: -20 };
  var heading = 0, camYaw = 0, camPitch = 0.32, camDist = 7.5, eHeld = 0;
  var vy = 0, onGround = true, walkPhase = 0, moving = false;
  var eli, eliHeld = {};
  var barnaby = null, barnabyPos = { x: -61, z: -18 };
  var heroSaw = null, currentVehicle = null, vehicleSpeed = 0;
  var camTiltExtra = 0; // staging tilt (heli shot)

  function makeWeaponMesh(kind) {
    if (kind === 'hammer') {
      var g = new THREE.Group();
      var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), mat(0x8a6a42, 0.8));
      g.add(handle);
      var head = box(0.22, 0.12, 0.12, mat(0x888888, 0.4, 0.8));
      head.position.y = 0.3; g.add(head);
      g.rotation.x = 0.5;
      return g;
    }
    if (kind === 'pistol') {
      var g2 = new THREE.Group();
      var barrel = box(0.06, 0.08, 0.34, mat(0x222222, 0.4, 0.7));
      g2.add(barrel);
      var grip = box(0.06, 0.2, 0.1, mat(0x333333, 0.7));
      grip.position.set(0, -0.1, -0.1); g2.add(grip);
      return g2;
    }
    if (kind === 'rifle') {
      var g3 = new THREE.Group();
      var barrel3 = box(0.07, 0.09, 0.8, mat(0x222222, 0.4, 0.7));
      g3.add(barrel3);
      var stock = box(0.07, 0.14, 0.3, mat(0x5a4a32, 0.8));
      stock.position.set(0, -0.03, -0.45); g3.add(stock);
      var mag = box(0.05, 0.18, 0.08, mat(0x444444, 0.5));
      mag.position.set(0, -0.12, 0.05); g3.add(mag);
      return g3;
    }
    return null;
  }

  function init(scene, camera) {
    sceneRef = scene; cameraRef = camera;
    // Eli — gold jacket, navy shirt panel, jeans, boots, brown hair, hammer
    eli = makeHumanoid({
      height: 1.85, skin: 0xd9a066, hair: 0x4a2f1a, hairStyle: 'normal',
      shirt: 0x1a2a4a, pants: 0x2a4a6b, jacket: 0xd4a017
    });
    eli.group.position.set(pos.x, 0, pos.z);
    scene.add(eli.group);
    eliHeld.hammer = makeWeaponMesh('hammer');
    eliHeld.pistol = makeWeaponMesh('pistol');
    eliHeld.rifle = makeWeaponMesh('rifle');
    eli.parts.held.add(eliHeld.hammer);
    // Barnaby
    barnaby = makeDog();
    barnaby.group.position.set(barnabyPos.x, 0, barnabyPos.z);
    scene.add(barnaby.group);
    // hero Golden Saw
    heroSaw = makeCar({ color: 0xe8a91c, emissive: 0x8a6d1a, ei: 0.65, sport: true, plate: 'VELM 001' });
    heroSaw.name = 'THE GOLDEN SAW'; // shown in the speedo (was 'Car': makeCar sets no name)
    heroSaw.x = -10; heroSaw.z = 2.5; heroSaw.heading = Math.PI / 2; heroSaw.speed = 0;
    heroSaw.group.position.set(-10, 0, 2.5);
    heroSaw.group.rotation.y = Math.PI / 2;
    scene.add(heroSaw.group);
    // mission lumber truck (M3)
    var truck = makeTruck();
    truck.name = 'LUMBER TRUCK';
    truck.x = -70; truck.z = -22; truck.heading = 0; truck.speed = 0;
    truck.group.position.set(-70, 0, -22);
    scene.add(truck.group);
    VB.player.missionTruck = truck;
  }

  function resetTo(x, z, head) {
    // Exit the vehicle FIRST: exitVehicle() overwrites pos with the exit
    // spot, so setting pos before it would be clobbered (the player would
    // respawn at the car's door instead of the requested point — e.g. a
    // busted driver respawning at the car instead of the Workshop).
    if (currentVehicle) exitVehicle();
    pos.x = x; pos.z = z; heading = head == null ? 0 : head; camYaw = heading;
    eli.group.position.set(x, 0, z);
    eli.group.rotation.y = heading;
    barnabyPos.x = x + 1.5; barnabyPos.z = z + 1.5;
    barnaby.group.position.set(barnabyPos.x, 0, barnabyPos.z);
  }

  function setCamera(yaw, pitch, dist) {
    camYaw = yaw; camPitch = pitch; camDist = dist;
  }

  function updateCamera(camera, snap) {
    var target;
    if (currentVehicle) {
      target = currentVehicle.group.position;
      var back = 9.5, up = 3.6;
      var cx = target.x - Math.sin(currentVehicle.heading) * back;
      var cz = target.z - Math.cos(currentVehicle.heading) * back;
      if (snap) { camera.position.set(cx, up, cz); }
      else {
        camera.position.x = U.lerp(camera.position.x, cx, 0.12);
        camera.position.z = U.lerp(camera.position.z, cz, 0.12);
        camera.position.y = U.lerp(camera.position.y, up, 0.12);
      }
      camera.lookAt(target.x + Math.sin(currentVehicle.heading) * 8, 1.2, target.z + Math.cos(currentVehicle.heading) * 8);
      if (camTiltExtra) {
        camera.rotateX(camTiltExtra);
      }
    } else {
      target = eli.group.position;
      var bx = target.x - Math.sin(camYaw) * camDist;
      var bz = target.z - Math.cos(camYaw) * camDist;
      var by = 2.2 + Math.sin(camPitch) * camDist;
      if (snap) { camera.position.set(bx, by, bz); }
      else {
        camera.position.x = U.lerp(camera.position.x, bx, 0.18);
        camera.position.z = U.lerp(camera.position.z, bz, 0.18);
        camera.position.y = U.lerp(camera.position.y, by, 0.18);
      }
      camera.lookAt(target.x, 1.5, target.z);
    }
  }

  function enterVehicle(car, silent) {
    if (!car) return false;
    currentVehicle = car;
    VB.state.inVehicle = true;
    VB.state.vehicleName = car.name || 'Car';
    vehicleSpeed = 0;
    eli.group.visible = false;
    if (!silent) VB.audio.sfx('engine');
    return true;
  }
  function exitVehicle() {
    if (!currentVehicle) return;
    var c = currentVehicle;
    pos.x = c.group.position.x + Math.sin(c.heading + Math.PI / 2) * 2.5;
    pos.z = c.group.position.z + Math.cos(c.heading + Math.PI / 2) * 2.5;
    eli.group.position.set(pos.x, 0, pos.z);
    eli.group.visible = true;
    currentVehicle = null;
    VB.state.inVehicle = false;
    VB.state.vehicleName = '';
    VB.state.speedKmh = 0;
  }

  function driveVehicle(dt, car) {
    var S = VB.state;
    var accel = 0;
    if (keys['KeyW'] || keys['ArrowUp']) accel = 1;
    if (keys['KeyS'] || keys['ArrowDown']) accel = -0.6;
    var steer = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) steer = 1;
    if (keys['KeyD'] || keys['ArrowRight']) steer = -1;
    var maxSpeed = (car.topSpeed || 30);
    car.speed = U.clamp(car.speed + accel * 22 * dt - car.speed * 0.35 * dt, -8, maxSpeed);
    if (Math.abs(car.speed) > 0.5) {
      car.heading += steer * 1.5 * dt * (car.speed > 0 ? 1 : -1) * U.clamp(Math.abs(car.speed) / 10, 0.3, 1);
    }
    car.group.position.x += Math.sin(car.heading) * car.speed * dt;
    car.group.position.z += Math.cos(car.heading) * car.speed * dt;
    car.group.position.x = U.clamp(car.group.position.x, -74, 74);
    car.group.position.z = U.clamp(car.group.position.z, -74, 74);
    car.group.rotation.y = car.heading;
    car.wheels.forEach(function (w) { w.rotation.x += car.speed * dt * 2; });
    S.speedKmh = Math.round(Math.abs(car.speed) * 3.6);
    S.kmDriven += Math.abs(car.speed) * dt / 1000;
    if (Math.abs(car.speed) > 0.5) S.fuel = Math.max(0, S.fuel - dt * 0.25);
    return car.speed;
  }

  function update(dt, t) {
    var S = VB.state;
    if (S.mode !== 'playing' || S.frozen) return;
    // mouse-look drag (hold right mouse or drag)
    // keyboard camera: Q/E rotate — but a quick E tap is an action (enter /
    // interact), so E only rotates the camera once it has been HELD > 0.15 s.
    if (keys['KeyE']) eHeld += dt; else eHeld = 0;
    if (keys['KeyQ']) camYaw += 1.8 * dt;
    if (keys['KeyE'] && eHeld > 0.15 && !VB.missions.dialogueActive()) camYaw -= 1.8 * dt;

    if (currentVehicle) {
      driveVehicle(dt, currentVehicle);
      // the player's position IS the vehicle while driving — mission
      // driveThru / driveTo / chase stages measure VB.player.pos
      pos.x = currentVehicle.group.position.x;
      pos.z = currentVehicle.group.position.z;
      // exit vehicle
      if (VB.input.consume('KeyF') || VB.input.consume('KeyE')) exitVehicle();
      updateCamera(cameraRef, 0);
      return;
    }

    // on-foot movement (camera-relative)
    var fwd = 0, strafe = 0;
    if (keys['KeyW'] || keys['ArrowUp']) fwd += 1;
    if (keys['KeyS'] || keys['ArrowDown']) fwd -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) strafe -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) strafe += 1;
    var run = keys['ShiftLeft'] || keys['ShiftRight'];
    var speed = run ? 7.5 : 4.2;
    moving = (fwd !== 0 || strafe !== 0);
    if (moving) {
      var len = Math.sqrt(fwd * fwd + strafe * strafe);
      fwd /= len; strafe /= len;
      var mx = Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
      var mz = Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
      pos.x += mx * speed * dt;
      pos.z += mz * speed * dt;
      pos.x = U.clamp(pos.x, -74, 74);
      pos.z = U.clamp(pos.z, -74, 74);
      heading = U.angleLerp(heading, Math.atan2(mx, mz), 0.25);
      walkPhase += dt * speed;
      eli.animateWalk(t, run ? 1 : 0.6);
    } else {
      eli.setPose(VB.combat && VB.combat.aiming ? 'aim' : 'idle');
    }
    // jump
    if (VB.input.consume('Space') && onGround) { vy = 6; onGround = false; }
    if (!onGround) {
      vy -= 18 * dt;
      eli.group.position.y += vy * dt;
      if (eli.group.position.y <= 0) { eli.group.position.y = 0; onGround = true; vy = 0; }
    }
    eli.group.position.set(pos.x, eli.group.position.y, pos.z);
    eli.group.rotation.y = heading;

    // gold bar pickup (<=1.6m)
    var gold = VB.world.goldBars;
    for (var i = 0; i < gold.length; i++) {
      var g = gold[i];
      if (g.taken) continue;
      if (U.dist2(pos.x, pos.z, g.x, g.z) <= 1.6) {
        g.taken = true; g.mesh.visible = false;
        S.goldBars++; S.goldCollected[g.idx] = true; S.money += 50;
        VB.audio.sfx('coin');
        VB.toast('GOLD BAR +$50  (' + S.goldBars + '/20)');
        VB.hud.refresh();
      }
    }

    // Barnaby follows + functions
    var bdx = pos.x - barnabyPos.x, bdz = pos.z - barnabyPos.z;
    var bd = Math.sqrt(bdx * bdx + bdz * bdz);
    // nearest gold bar: Barnaby runs toward it
    var nearest = null, nd = 999;
    for (var j = 0; j < gold.length; j++) {
      if (gold[j].taken) continue;
      var dd = U.dist2(pos.x, pos.z, gold[j].x, gold[j].z);
      if (dd < nd) { nd = dd; nearest = gold[j]; }
    }
    var bTarget = null;
    if (nearest && nd < 25) {
      bTarget = { x: nearest.x, z: nearest.z };
      barnaby.marker.visible = true;
    } else {
      barnaby.marker.visible = false;
      if (bd > 2.5) bTarget = { x: pos.x, z: pos.z };
    }
    if (bTarget) {
      var bx = bTarget.x - barnabyPos.x, bz = bTarget.z - barnabyPos.z;
      var bl = Math.sqrt(bx * bx + bz * bz) || 1;
      var bSpeed = 6;
      barnabyPos.x += (bx / bl) * bSpeed * dt;
      barnabyPos.z += (bz / bl) * bSpeed * dt;
      barnaby.group.rotation.y = Math.atan2(bx, bz);
      barnaby.animateDogWalk(t, 1);
    } else {
      barnaby.animateDogWalk(t, 0);
    }
    barnaby.group.position.set(barnabyPos.x, 0, barnabyPos.z);
    // K-9 ALERT: police within 12m
    var policeNear = false;
    if (VB.ai && VB.ai.units) {
      for (var u = 0; u < VB.ai.units.length; u++) {
        if (U.dist2(pos.x, pos.z, VB.ai.units[u].x, VB.ai.units[u].z) < 12) { policeNear = true; break; }
      }
    }
    if (policeNear && !barnaby._alerted) {
      barnaby._alerted = true;
      VB.audio.sfx('bark');
      VB.toast('K-9 ALERT — police closing in!');
    } else if (!policeNear) { barnaby._alerted = false; }

    // enter hero Saw / nearby vehicle with E — only CONSUME the press when a
    // vehicle is actually there to enter. If E is consumed here unconditionally,
    // mission interact / rally stages (checked later in missions.update) never
    // see the press and the player is stuck on M1 forever.
    // Priority: a mission interact / rally point under the player's feet wins
    // over vehicle entry — otherwise a passing traffic car at a rally point
    // swallows the E press and the player drives off in a Red GT instead of
    // rallying (reproduced in the M6 probe: traffic 3 m away at Center).
    if (!VB.missions.dialogueActive() && VB.input.hasPressed('KeyE')) {
      var st = VB.missions.currentStage ? VB.missions.currentStage() : null;
      var onMissionPoint = st && (st.type === 'interact' || st.type === 'rally')
        && U.dist2(pos.x, pos.z, st.x, st.z) <= st.r;
      if (!onMissionPoint) {
        var dSaw = U.dist2(pos.x, pos.z, heroSaw.x, heroSaw.z);
        var enterCar = null;
        if (dSaw < 3.5) { enterCar = heroSaw; }
        else if (VB.player.missionTruck && U.dist2(pos.x, pos.z, VB.player.missionTruck.x, VB.player.missionTruck.z) < 4) {
          enterCar = VB.player.missionTruck;
        }
        else if (VB.ai) {
          enterCar = VB.ai.nearestTrafficCar(pos.x, pos.z, 3.5);
        }
        if (enterCar) { VB.input.consume('KeyE'); enterVehicle(enterCar); }
      }
    }
    // carjack with F (traffic car with driver)
    if (VB.input.consume('KeyF')) {
      if (VB.ai) {
        var cj = VB.ai.nearestTrafficCar(pos.x, pos.z, 3.5);
        if (cj && cj !== heroSaw) {
          VB.ai.removeTrafficCar(cj);
          S.carsStolen++; S.money += 200;
          VB.audio.sfx('carjack');
          VB.toast('CARJACKED +$200');
          enterVehicle(cj);
        }
      }
    }
    updateCamera(cameraRef, 0);
  }

  function setWeaponVisual(kind) {
    var held = eli.parts.held;
    while (held.children.length) held.remove(held.children[0]);
    if (kind === 'fists') return;
    var mesh = eliHeld[kind];
    if (mesh) held.add(mesh);
    eli.setPose(kind === 'hammer' ? 'idle' : 'aim');
  }

  VB.player = {
    init: init, update: update, resetTo: resetTo, setCamera: setCamera,
    updateCamera: updateCamera, enterVehicle: enterVehicle, exitVehicle: exitVehicle,
    setWeaponVisual: setWeaponVisual,
    makeHumanoid: makeHumanoid, makeDog: makeDog, makeCar: makeCar,
    makeVan: makeVan, makeTruck: makeTruck, makeScooter: makeScooter,
    crewDefs: CREW_DEFS,
    get pos() { return pos; },
    get heading() { return heading; },
    get heroSaw() { return heroSaw; },
    get eli() { return eli; },
    get barnaby() { return barnaby; },
    get currentVehicle() { return currentVehicle; },
    set camTilt(v) { camTiltExtra = v; },
    get camTilt() { return camTiltExtra; }
  };
})();
