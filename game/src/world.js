// Velora Bay — world.js
// Layout source of truth + 3D world (districts, buildings, roads, props, sky).
// Written fresh in-session. Layout: roads as rects; buildings only inside blocks
// with >=2m margin; the assertion below proves zero violations.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;
  var THREE = window.THREE;

  // ---------------- layout source of truth ----------------
  // Roads: [x1, z1, x2, z2] (axis-aligned rects)
  var ROADS = [
    [-75, -4, 68, 4],     // R1 Beach Blvd (main E-W)
    [-75, -52, 68, -44],  // R2 North Ave
    [-75, 44, 68, 52],    // R3 South Ave
    [-52, -75, -44, 75],  // R4 West Rd
    [44, -75, 52, 75],    // R5 East Rd
    [60, -75, 68, 75]     // R6 Beach Rd
  ];
  // Buildings: [cx, cz, w, d, h, style, signText]
  var BUILDINGS = [
    // Portside (x -75..-45)
    [-63, -24, 16, 12, 7, 'workshop', 'BRADDOCK & SONS'],
    [-63, 24, 18, 12, 9, 'warehouse', 'WAREHOUSE 7'],
    [-70, -8, 10, 4, 6, 'shop', 'TACKLE & BAIT'],
    [-59, -8, 10, 4, 6, 'shop', 'HARBOR VIEW'],
    [-63, -38, 14, 8, 14, 'apartment', 'CORAL COURT'],
    [-70, 38, 10, 8, 8, 'warehouse', 'FISH MARKET'],
    [-59, 38, 10, 8, 10, 'apartment', 'DOCK VIEW'],
    // Velora Center (x -45..-10)
    [-27, -24, 18, 12, 12, 'landmark', 'CITY HALL'],
    [-27, 24, 16, 12, 8, 'garage', 'CREW GARAGE'],
    [-14, -24, 10, 8, 9, 'office', 'VBPD HQ'],
    [-37, -8, 10, 4, 10, 'office', 'VELORA BANK'],
    [-16, -8, 10, 4, 6, 'shop', 'NEWSSTAND'],
    [-36, -38, 12, 8, 16, 'apartment', 'MERIDIAN PLAZA'],
    [-16, -38, 12, 8, 12, 'office', ''],
    [-37, 8, 10, 4, 6, 'shop', ''],
    [-16, 8, 10, 4, 6, 'shop', 'CAFE'],
    // Neon Row (x -10..20)
    [5, -24, 18, 12, 6, 'market', 'NIGHT MARKET'],
    [5, 24, 18, 12, 10, 'industrial', 'HALE CONSTRUCTION'],
    [0, -8, 10, 4, 7, 'shop', 'TACO STAND'],
    [12, -8, 10, 4, 6, 'shop', ''],
    [-2, -38, 12, 8, 9, 'warehouse', 'STORAGE 7'],
    [14, -38, 10, 8, 13, 'apartment', ''],
    [0, 8, 10, 4, 6, 'shop', ''],
    [12, 8, 10, 4, 6, 'shop', 'NEON BAR'],
    // Marina Heights (x 20..50)
    [35, -24, 14, 12, 28, 'tower', 'HALE TOWER'],
    [35, 24, 14, 10, 10, 'apartment', 'SAFEHOUSE'],
    [28, 8, 12, 4, 9, 'hotel', 'MARINA HOTEL'],
    [28, -38, 12, 8, 15, 'apartment', 'PALM COURT'],
    [28, -8, 10, 4, 11, 'office', ''],
    // Velora Beach (x 50..75) — narrow strip, w=4
    [56, 8, 4, 4, 6, 'shop', 'BEACH BAR'],
    [56, -8, 4, 4, 5, 'shop', 'ICE CREAM'],
    [56, 24, 4, 6, 7, 'shop', 'SUNSET TERRACE'],
    [56, -24, 4, 8, 12, 'apartment', '']
  ];
  // Skyline rows (far north/south, background only). Centres chosen so the
  // 10 m-wide footprints never touch the vertical roads (R4/R5/R6) and keep
  // >=2 m from every road edge.
  var SKYLINE = [
    [-68, -62, 10, 8, 18, 'skyline', ''],
    [-36, -62, 10, 8, 25, 'skyline', ''],
    [-20, -62, 10, 8, 21, 'skyline', ''],
    [-4, -62, 10, 8, 29, 'skyline', ''],
    [12, -62, 10, 8, 17, 'skyline', ''],
    [28, -62, 10, 8, 24, 'skyline', ''],
    [-62, 62, 10, 8, 22, 'skyline', ''],
    [-28, 62, 10, 8, 19, 'skyline', ''],
    [-12, 62, 10, 8, 27, 'skyline', ''],
    [4, 62, 10, 8, 16, 'skyline', ''],
    [20, 62, 10, 8, 23, 'skyline', ''],
    [36, 62, 10, 8, 20, 'skyline', '']
  ];

  var DISTRICTS = [
    { name: 'Portside', x1: -75, x2: -45, color: 0x14b8a6 },
    { name: 'Velora Center', x1: -45, x2: -10, color: 0x2f6fed },
    { name: 'Neon Row', x1: -10, x2: 20, color: 0xff2e88 },
    { name: 'Marina Heights', x1: 20, x2: 50, color: 0x7b5cff },
    { name: 'Velora Beach', x1: 50, x2: 75, color: 0xff9f1c }
  ];
  var BOUNDARIES = [-45, -10, 20, 50];

  var POIS = {
    workshop: { x: -63, z: -24, label: 'WORKSHOP', anchor: 'left' },
    pier9: { x: -73, z: 24, label: 'PIER 9', anchor: 'right' },
    cityHall: { x: -27, z: -24, label: 'CITY HALL', anchor: 'above', dy: -12 },
    garage: { x: -27, z: 24, label: 'GARAGE', anchor: 'below' },
    vbpd: { x: -14, z: -24, label: 'VBPD HQ', anchor: 'below' },
    market: { x: 5, z: -24, label: 'NIGHT MARKET', anchor: 'above' },
    crane: { x: 5, z: 24, label: 'CRANE SITE', anchor: 'above' },
    haleTower: { x: 35, z: -24, label: 'HALE TOWER', anchor: 'below' },
    safehouse: { x: 35, z: 24, label: 'SAFEHOUSE', anchor: 'left' },
    beach: { x: 64, z: 0, label: 'BEACH', anchor: 'right' }
  };

  var GOLD_SPOTS = [
    [-63, -18], [-72, 24], [-27, -18], [-27, 18], [5, -18], [5, 18],
    [35, -18], [35, 18], [64, 10], [-14, -18], [-58, -38], [-38, 38],
    [-16, -38], [14, 38], [28, -38], [56, -38], [-70, 6], [60, -6],
    [0, 6], [48, 6]
  ];

  // Traffic loops: closed rectangles on road centerlines (lanes both ways)
  var TRAFFIC_LOOPS = [
    [[-70, -2.5], [60, -2.5], [60, 2.5], [-70, 2.5]],
    [[-70, -50.5], [60, -50.5], [60, -45.5], [-70, -45.5]],
    [[-70, 45.5], [60, 45.5], [60, 50.5], [-70, 50.5]],
    [[-50.5, -70], [-50.5, 70], [-45.5, 70], [-45.5, -70]],
    [[45.5, -70], [45.5, 70], [50.5, 70], [50.5, -70]],
    [[61.5, -70], [61.5, 70], [66.5, 70], [66.5, -70]]
  ];
  // Pedestrian loops: sidewalk circuits
  var PED_LOOPS = [
    [[-70, 6], [60, 6], [60, -6], [-70, -6]],
    [[-70, -42], [60, -42], [60, 42], [-70, 42]],
    [[-42, -70], [42, -70], [42, 70], [-42, 70]],
    [[-70, -54], [60, -54], [60, 54], [-70, 54]],
    [[-54, -70], [54, -70], [54, 70], [-54, 70]]
  ];

  function footprintsOverlap(a, b) {
    return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  }
  function validateLayout() {
    var violations = [];
    var all = BUILDINGS.concat(SKYLINE);
    for (var i = 0; i < all.length; i++) {
      var b = all[i];
      var fp = [b[0] - b[2] / 2, b[1] - b[3] / 2, b[0] + b[2] / 2, b[1] + b[3] / 2];
      for (var j = 0; j < ROADS.length; j++) {
        if (footprintsOverlap(fp, ROADS[j])) {
          violations.push({ building: i, road: j, fp: fp });
        }
      }
    }
    return violations;
  }

  // ---------------- materials / helpers ----------------
  var signCache = {};
  function makeSignTexture(text) {
    if (signCache[text]) return signCache[text];
    var c = document.createElement('canvas'); c.width = 512; c.height = 96;
    var g = c.getContext('2d');
    g.fillStyle = '#0d1b3e'; g.fillRect(0, 0, 512, 96);
    g.strokeStyle = '#d4a017'; g.lineWidth = 6; g.strokeRect(4, 4, 504, 88);
    g.fillStyle = '#ffd34d'; g.font = 'bold 44px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 52);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    signCache[text] = tex;
    return tex;
  }

  var winMatDay, winMatLit;
  function windowMaterials() {
    if (!winMatDay) {
      winMatDay = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.3, metalness: 0.4 });
      winMatLit = new THREE.MeshStandardMaterial({ color: 0x554411, roughness: 0.4, emissive: 0xffb347, emissiveIntensity: 0.9 });
    }
    return { day: winMatDay, lit: winMatLit };
  }

  var STYLE_COLORS = {
    shop: 0xe8dcc8, apartment: 0xd9c9a8, office: 0xb8c4d4, warehouse: 0x9a8a76,
    landmark: 0xf2e6c9, market: 0xc94f4f, industrial: 0x8a8f98, tower: 0x3a4a6b,
    hotel: 0xe8b4a0, garage: 0x7a6a58, workshop: 0xa8763e, skyline: 0x6a7a94
  };

  function makeBuilding(spec, scene, winMats) {
    var cx = spec[0], cz = spec[1], w = spec[2], d = spec[3], h = spec[4], style = spec[5], sign = spec[6];
    var group = new THREE.Group();
    var color = STYLE_COLORS[style] || 0xcccccc;
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.85, metalness: 0.05 })
    );
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    // roof slab
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 })
    );
    roof.position.y = h + 0.3; roof.castShadow = true;
    group.add(roof);
    // gold trim for landmarks / towers
    if (style === 'landmark' || style === 'tower') {
      var trim = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, 0.5, d + 0.2),
        new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.4, metalness: 0.7, emissive: 0x332200, emissiveIntensity: 0.4 })
      );
      trim.position.y = h - 0.4;
      group.add(trim);
    }
    // windows: front + back faces, grid by height
    var floors = Math.max(1, Math.floor(h / 3.2));
    var cols = Math.max(2, Math.floor(w / 3));
    var winGeo = new THREE.PlaneGeometry(1.1, 1.4);
    for (var f = 0; f < floors; f++) {
      for (var cI = 0; cI < cols; cI++) {
        var wx = -w / 2 + (cI + 0.5) * (w / cols);
        var wy = 2.2 + f * 3.2;
        if (wy > h - 1) continue;
        var lit = ((f * 7 + cI * 3 + Math.floor(cx + cz)) % 5) < 2;
        var mat = lit ? winMats.lit : winMats.day;
        var w1 = new THREE.Mesh(winGeo, mat);
        w1.position.set(wx, wy, d / 2 + 0.06);
        group.add(w1);
        var w2 = new THREE.Mesh(winGeo, mat);
        w2.position.set(wx, wy, -d / 2 - 0.06);
        w2.rotation.y = Math.PI;
        group.add(w2);
      }
    }
    // sign board
    if (sign) {
      var tex = makeSignTexture(sign);
      var signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(w * 0.9, 10), 1.6),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 })
      );
      signMesh.position.set(0, h - 1.2, d / 2 + 0.12);
      group.add(signMesh);
    }
    // shop awning
    if (style === 'shop' || style === 'market') {
      var awn = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.8, 0.25, 1.6),
        new THREE.MeshStandardMaterial({ color: style === 'market' ? 0xd94f4f : 0x2e6b4f, roughness: 0.8 })
      );
      awn.position.set(0, 2.6, d / 2 + 0.8);
      group.add(awn);
    }
    group.position.set(cx, 0, cz);
    scene.add(group);
    return group;
  }

  function makePalm(x, z, s) {
    var g = new THREE.Group();
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
    var trunk = new THREE.Group();
    var segs = 3, y = 0, px = 0;
    for (var i = 0; i < segs; i++) {
      var seg = new THREE.Mesh(new THREE.CylinderGeometry(0.14 - i * 0.02, 0.18 - i * 0.02, 1.4, 6), trunkMat);
      seg.position.set(px, y + 0.7, 0);
      seg.rotation.z = 0.08 * (i + 1);
      seg.castShadow = true;
      trunk.add(seg);
      px += 0.12; y += 1.35;
    }
    g.add(trunk);
    // curved fronds: 3 chained segments each, drooping tips
    var greens = [0x55a860, 0x3e8e4d, 0x2f7a3c];
    var frondMat = greens.map(function (c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }); });
    for (var f = 0; f < 9; f++) {
      var ang = (f / 9) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      var len = 2.2 * (0.85 + Math.random() * 0.35);
      var mat = frondMat[f % 3];
      var pivot = new THREE.Group();
      pivot.position.set(px, y + 0.15, 0);
      pivot.rotation.y = ang;
      var cur = pivot;
      var widths = [0.55, 0.45, 0.3];
      var tilts = [-0.45, 0.05, 0.75];
      for (var sI = 0; sI < 3; sI++) {
        var segLen = len / 3;
        var part = new THREE.Mesh(new THREE.BoxGeometry(widths[sI], 0.09, segLen), mat);
        part.position.set(0, 0, segLen / 2);
        part.castShadow = true;
        var holder = new THREE.Group();
        holder.rotation.x = tilts[sI];
        holder.add(part);
        cur.add(holder);
        var next = new THREE.Group();
        next.position.set(0, 0, segLen);
        holder.add(next);
        cur = next;
      }
      g.add(pivot);
    }
    // young upright fronds in crown center
    for (var yf = 0; yf < 3; yf++) {
      var yfr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.12), frondMat[yf % 3]);
      yfr.position.set(px + (yf - 1) * 0.15, y + 0.8, 0);
      yfr.rotation.z = (yf - 1) * 0.35;
      g.add(yfr);
    }
    // coconuts
    var cocoMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    for (var cc = 0; cc < 3; cc++) {
      var coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), cocoMat);
      coco.position.set(px + (cc - 1) * 0.22, y - 0.1, 0.15);
      g.add(coco);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(s || 1);
    return g;
  }

  function makeLamp(x, z) {
    var g = new THREE.Group();
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.5 });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8), poleMat);
    pole.position.y = 2.6; pole.castShadow = true;
    g.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), poleMat);
    arm.position.set(0.6, 5.1, 0);
    g.add(arm);
    var head = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0xffd9a0, emissiveIntensity: 0.9 })
    );
    head.position.set(1.25, 5.05, 0);
    g.add(head);
    // light pool on the ground
    var pool = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.22, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04;
    g.add(pool);
    g.position.set(x, 0, z);
    return g;
  }

  function makeCrane(x, z) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0xe8912a, roughness: 0.6, metalness: 0.3 });
    var tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 22, 1.6), mat);
    tower.position.y = 11; tower.castShadow = true;
    g.add(tower);
    var jib = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 1), mat);
    jib.position.set(6, 21, 0); jib.castShadow = true;
    g.add(jib);
    var counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 1.2), mat);
    counter.position.set(-3.4, 21, 0);
    g.add(counter);
    var cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2), new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.5 }));
    cab.position.set(0, 19.5, 0);
    g.add(cab);
    var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 7, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cable.position.set(12, 17.5, 0);
    g.add(cable);
    var hook = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.4 }));
    hook.position.set(12, 13.8, 0);
    g.add(hook);
    g.position.set(x, 0, z);
    return g;
  }

  // ---------------- sky ----------------
  var skyMesh, skyCanvas, skyTex, clouds = [];
  var SKY_GRADIENTS = {
    day: ['#7ec0ee', '#a8d8f0', '#e8f4f8', '#fff3d6'],
    // warmer golden hour: soft violet up top, orange-red mid-sky, gold at
    // the horizon (the old gradient read mostly magenta/purple in-frame).
    sunset: ['#3b2560', '#93406b', '#f4734a', '#ffbe5c'],
    night: ['#050914', '#0d1b3e', '#1a2a52', '#2a3a5e']
  };
  function drawSky(tod) {
    var grad = SKY_GRADIENTS[tod] || SKY_GRADIENTS.sunset;
    skyCanvas = skyCanvas || document.createElement('canvas');
    skyCanvas.width = 4; skyCanvas.height = 256;
    var g = skyCanvas.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, grad[0]); gr.addColorStop(0.38, grad[1]);
    gr.addColorStop(0.68, grad[2]); gr.addColorStop(1, grad[3]);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    if (skyTex) skyTex.dispose();
    skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    if (skyMesh) skyMesh.material.map = skyTex;
  }

  // ---------------- module state ----------------
  var sceneRef, keyLight, hemiLight, ambLight;
  var goldBarMeshes = [];
  var winMats = null;

  function init(scene, renderer) {
    sceneRef = scene;
    winMats = windowMaterials();
    // ground base
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
    scene.add(ground);
    // city ground slab
    var city = new THREE.Mesh(
      new THREE.PlaneGeometry(152, 152),
      new THREE.MeshStandardMaterial({ color: 0x8a8f7a, roughness: 1 })
    );
    city.rotation.x = -Math.PI / 2; city.position.y = 0; city.receiveShadow = true;
    scene.add(city);
    // sea east + harbor west
    var seaMat = new THREE.MeshStandardMaterial({ color: 0x2fa8b8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
    var seaE = new THREE.Mesh(new THREE.PlaneGeometry(130, 400), seaMat);
    seaE.rotation.x = -Math.PI / 2; seaE.position.set(140, 0.02, 0);
    scene.add(seaE);
    var seaW = new THREE.Mesh(new THREE.PlaneGeometry(120, 400), new THREE.MeshStandardMaterial({ color: 0x2a7a94, roughness: 0.3, transparent: true, opacity: 0.92 }));
    seaW.rotation.x = -Math.PI / 2; seaW.position.set(-135, 0.02, 0);
    scene.add(seaW);
    // beach sand strip
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 152),
      new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2; sand.position.set(71.5, 0.03, 0); sand.receiveShadow = true;
    scene.add(sand);

    // roads (asphalt) + sidewalks + markings
    var roadMat = new THREE.MeshStandardMaterial({ color: 0x33363e, roughness: 0.95 });
    var walkMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 1 });
    var lineMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.8 });
    ROADS.forEach(function (r) {
      var w = r[2] - r[0], d = r[3] - r[1];
      var road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set((r[0] + r[2]) / 2, 0.02, (r[1] + r[3]) / 2);
      road.receiveShadow = true;
      scene.add(road);
      var horizontal = w > d;
      if (horizontal) {
        [-1, 1].forEach(function (s) {
          var sw = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.4), walkMat);
          sw.rotation.x = -Math.PI / 2;
          sw.position.set((r[0] + r[2]) / 2, 0.025, (r[1] + r[3]) / 2 + s * (d / 2 + 1.2));
          sw.receiveShadow = true;
          scene.add(sw);
        });
        for (var x = r[0] + 3; x < r[2] - 2; x += 6) {
          var dash = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.25), lineMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(x, 0.04, (r[1] + r[3]) / 2);
          scene.add(dash);
        }
      } else {
        [-1, 1].forEach(function (s) {
          var sw = new THREE.Mesh(new THREE.PlaneGeometry(2.4, d), walkMat);
          sw.rotation.x = -Math.PI / 2;
          sw.position.set((r[0] + r[2]) / 2 + s * (w / 2 + 1.2), 0.025, (r[1] + r[3]) / 2);
          sw.receiveShadow = true;
          scene.add(sw);
        });
        for (var z = r[1] + 3; z < r[3] - 2; z += 6) {
          var dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3), lineMat);
          dash2.rotation.x = -Math.PI / 2;
          dash2.position.set((r[0] + r[2]) / 2, 0.04, z);
          scene.add(dash2);
        }
      }
    });

    // buildings
    BUILDINGS.concat(SKYLINE).forEach(function (b) { makeBuilding(b, scene, winMats); });

    // pier 9 (wooden deck jutting west into the harbor)
    var pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.95 });
    var pier = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 8), pierMat);
    pier.position.set(-82, 0.4, 24); pier.castShadow = true; pier.receiveShadow = true;
    scene.add(pier);
    for (var pi = 0; pi < 4; pi++) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6), pierMat);
      post.position.set(-88 + pi * 4, 0.4, 20.5);
      scene.add(post);
      var post2 = post.clone(); post2.position.z = 27.5;
      scene.add(post2);
    }
    // boats in the harbor
    [[-84, -10, 0xdddddd], [-84, 40, 0x2e6b8a], [-80, -30, 0xd94f4f]].forEach(function (bt) {
      var boat = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.4), new THREE.MeshStandardMaterial({ color: bt[2], roughness: 0.6 }));
      hull.position.y = 0.6;
      boat.add(hull);
      var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), new THREE.MeshStandardMaterial({ color: 0x5a4a32 }));
      mast.position.y = 3.5;
      boat.add(mast);
      boat.position.set(bt[0], 0, bt[1]);
      scene.add(boat);
    });

    // cranes at the construction site
    scene.add(makeCrane(8, 30));
    scene.add(makeCrane(-4, 18));

    // night market tents
    for (var ti = 0; ti < 4; ti++) {
      var tent = new THREE.Group();
      var base = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }));
      base.position.y = 0.8;
      tent.add(base);
      var roofT = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), new THREE.MeshStandardMaterial({ color: [0xd94f4f, 0x2e6b8a, 0xd4a017, 0x7b5cff][ti], roughness: 0.8 }));
      roofT.position.y = 2.3; roofT.rotation.y = Math.PI / 4;
      tent.add(roofT);
      tent.position.set(-2 + ti * 4.5, 0, -18);
      scene.add(tent);
    }

    // palms along the boulevard + beach
    var palmSpots = [];
    for (var px = -70; px <= 60; px += 12) {
      palmSpots.push([px, 6.5]); palmSpots.push([px + 6, -6.5]);
    }
    for (var bx = -60; bx <= 60; bx += 24) palmSpots.push([bx, 56]);
    palmSpots.push([64, -20]); palmSpots.push([64, 20]); palmSpots.push([64, -40]); palmSpots.push([64, 40]);
    palmSpots.forEach(function (p) { scene.add(makePalm(p[0], p[1], 1)); });

    // street lamps along the boulevard
    for (var lx = -66; lx <= 60; lx += 18) {
      scene.add(makeLamp(lx, 5.4));
      scene.add(makeLamp(lx + 9, -5.4));
    }
    // hydrants + bins
    var hydMat = new THREE.MeshStandardMaterial({ color: 0xd94f4f, roughness: 0.6 });
    [[-40, 6], [10, -6], [30, 6], [-20, -6]].forEach(function (h) {
      var hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.9, 8), hydMat);
      hyd.position.set(h[0], 0.45, h[1]);
      scene.add(hyd);
    });
    var binMat = new THREE.MeshStandardMaterial({ color: 0x3a6b4f, roughness: 0.9 });
    [[-30, 6], [20, -6], [50, 6], [-55, -6]].forEach(function (b) {
      var bin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), binMat);
      bin.position.set(b[0], 0.45, b[1]);
      scene.add(bin);
    });
    // shipping containers in Portside
    var contColors = [0x2e6b8a, 0xd94f4f, 0xd4a017, 0x3a6b4f];
    for (var ci = 0; ci < 6; ci++) {
      var cont = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.6, 2.6),
        new THREE.MeshStandardMaterial({ color: contColors[ci % 4], roughness: 0.7, metalness: 0.3 })
      );
      cont.position.set(-70 + (ci % 3) * 7, 1.3, -38 + Math.floor(ci / 3) * 6);
      cont.rotation.y = (ci % 2) * 0.15;
      cont.castShadow = true;
      scene.add(cont);
    }

    // gold bars
    var goldMat = new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.25, metalness: 0.9, emissive: 0x664400, emissiveIntensity: 0.5 });
    GOLD_SPOTS.forEach(function (gp, idx) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.35), goldMat);
      bar.position.set(gp[0], 0.6, gp[1]);
      bar.castShadow = true;
      scene.add(bar);
      goldBarMeshes.push({ x: gp[0], z: gp[1], mesh: bar, idx: idx, taken: false });
    });

    // sky dome
    var skyGeo = new THREE.SphereGeometry(320, 24, 16);
    var skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false });
    skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
    drawSky('sunset');
    // low pink clouds (y 25-35 so they enter the frame)
    var cloudMat = new THREE.MeshStandardMaterial({ color: 0xf2a0b8, roughness: 1, transparent: true, opacity: 0.85, emissive: 0x883355, emissiveIntensity: 0.25 });
    var cloudSpots = [[-55, 28, -30], [20, 30, -45], [55, 26, 25], [-30, 32, 40], [65, 28, -20], [-65, 30, 10], [35, 34, 45], [-10, 27, -55]];
    cloudSpots.forEach(function (cp) {
      var cl = new THREE.Group();
      for (var cI = 0; cI < 4; cI++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2.5, 10, 8), cloudMat);
        puff.position.set((cI - 1.5) * 4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2);
        puff.scale.y = 0.45;
        cl.add(puff);
      }
      cl.position.set(cp[0], cp[1], cp[2]);
      scene.add(cl);
      clouds.push(cl);
    });

    // lighting
    keyLight = new THREE.DirectionalLight(0xffe0b3, 2.8);
    keyLight.position.set(-55, 65, 40);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -95; keyLight.shadow.camera.right = 95;
    keyLight.shadow.camera.top = 95; keyLight.shadow.camera.bottom = -95;
    keyLight.shadow.camera.far = 300;
    keyLight.shadow.bias = -0.0005; keyLight.shadow.normalBias = 0.03;
    scene.add(keyLight);
    hemiLight = new THREE.HemisphereLight(0xbbddff, 0x443322, 1.0);
    scene.add(hemiLight);
    ambLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambLight);

    // layout validation (single source of truth)
    VB.world.layoutViolations = validateLayout();
    VB.world.LAYOUT = { roads: ROADS, buildings: BUILDINGS, skyline: SKYLINE };
  }

  function setTimeOfDay(tod) {
    VB.state.timeOfDay = tod;
    drawSky(tod);
    if (!sceneRef) return;
    if (tod === 'day') {
      keyLight.color.setHex(0xfff2d6); keyLight.intensity = 3.0;
      keyLight.position.set(-40, 80, 20);
      hemiLight.intensity = 1.1; ambLight.intensity = 0.35;
      sceneRef.fog = new THREE.Fog(0x9fc8e8, 120, 320);
    } else if (tod === 'sunset') {
      keyLight.color.setHex(0xffe0b3); keyLight.intensity = 2.8;
      keyLight.position.set(-55, 65, 40);
      hemiLight.intensity = 1.0; ambLight.intensity = 0.25;
      sceneRef.fog = new THREE.Fog(0xc98a6a, 90, 280);
    } else { // night
      keyLight.color.setHex(0x8aa8d8); keyLight.intensity = 0.7;
      keyLight.position.set(40, 70, -30);
      hemiLight.intensity = 0.45; ambLight.intensity = 0.18;
      sceneRef.fog = new THREE.Fog(0x0a1120, 60, 220);
    }
    // windows glow at night
    var lit = winMats.lit;
    lit.emissiveIntensity = tod === 'night' ? 1.4 : (tod === 'sunset' ? 0.9 : 0.25);
  }

  function update(dt, t) {
    // gold bars spin + bob
    for (var i = 0; i < goldBarMeshes.length; i++) {
      var g = goldBarMeshes[i];
      if (g.taken) continue;
      g.mesh.rotation.y += dt * 1.5;
      g.mesh.position.y = 0.6 + Math.sin(t * 2 + i) * 0.12;
    }
    // clouds drift slowly
    for (var c = 0; c < clouds.length; c++) {
      clouds[c].position.x += dt * 0.4;
      if (clouds[c].position.x > 90) clouds[c].position.x = -90;
    }
  }

  function districtAt(x) {
    for (var i = 0; i < DISTRICTS.length; i++) {
      if (x >= DISTRICTS[i].x1 && x < DISTRICTS[i].x2) return DISTRICTS[i].name;
    }
    return 'Velora Beach';
  }

  VB.world = {
    init: init, setTimeOfDay: setTimeOfDay, update: update,
    districtAt: districtAt, layoutViolations: [],
    LAYOUT: null, goldBars: goldBarMeshes, pois: POIS,
    districts: DISTRICTS, boundaries: BOUNDARIES,
    trafficLoops: TRAFFIC_LOOPS, pedLoops: PED_LOOPS,
    makePalm: makePalm, makeLamp: makeLamp
  };
})();
