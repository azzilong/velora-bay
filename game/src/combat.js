// Velora Bay — combat.js
// Weapons, weapon wheel, thugs, shooting, damage numbers, tracers.
// Written fresh in-session.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;
  var THREE = window.THREE;

  var sceneRef, cameraRef;
  var thugs = [];
  var aiming = false, wheelOpen = false, wheelSel = 1;
  var tracers = [];
  var dmgNumbers = [];
  var fireCooldown = 0;
  var wheelEl = null;

  var WEAPONS = [
    { id: 'fists', name: 'FISTS', key: '1', unlock: '—', dmg: 22 },
    { id: 'hammer', name: 'HAMMER', key: '2', unlock: '—', dmg: 34 },
    { id: 'pistol', name: 'PISTOL', key: '3', unlock: 'M1', dmg: 34 },
    { id: 'rifle', name: 'RIFLE', key: '4', unlock: 'M4', dmg: 52 }
  ];

  function init(scene, camera) {
    sceneRef = scene; cameraRef = camera;
    wheelEl = document.getElementById('wheel');
    buildWheel();
  }

  function buildWheel() {
    if (!wheelEl) return;
    var svg = {
      fists: '<svg viewBox="0 0 40 40"><path d="M14 8h12v10H14z M12 18h16v6H12z M14 24h12v8H14z" fill="currentColor"/></svg>',
      hammer: '<svg viewBox="0 0 40 40"><rect x="18" y="12" width="4" height="22" fill="currentColor"/><rect x="8" y="6" width="24" height="8" rx="2" fill="currentColor"/></svg>',
      pistol: '<svg viewBox="0 0 40 40"><path d="M8 12h24v6H18v4h-6v8H8z" fill="currentColor"/></svg>',
      rifle: '<svg viewBox="0 0 40 40"><rect x="6" y="16" width="28" height="5" fill="currentColor"/><rect x="24" y="12" width="4" height="12" fill="currentColor"/><rect x="12" y="21" width="4" height="8" fill="currentColor"/></svg>'
    };
    var html = '<div class="wheel-title">WEAPON WHEEL</div>';
    var positions = [
      { id: 'fists', x: '50%', y: '8%', label: 'top' },
      { id: 'hammer', x: '88%', y: '50%', label: 'right' },
      { id: 'pistol', x: '50%', y: '88%', label: 'bottom' },
      { id: 'rifle', x: '8%', y: '50%', label: 'left' }
    ];
    positions.forEach(function (p, i) {
      var w = WEAPONS[i];
      html += '<div class="wheel-seg" data-w="' + w.id + '" style="left:' + p.x + ';top:' + p.y + '">' +
        '<div class="wheel-icon">' + svg[w.id] + '</div>' +
        '<div class="wheel-name">' + w.key + ' ' + w.name + '</div>' +
        '<div class="wheel-ammo" id="wheel-ammo-' + w.id + '"></div>' +
        '<div class="wheel-lock" id="wheel-lock-' + w.id + '"></div>' +
        '</div>';
    });
    html += '<div class="wheel-center" id="wheel-center"></div>';
    wheelEl.innerHTML = html;
    wheelEl.querySelectorAll('.wheel-seg').forEach(function (seg) {
      seg.addEventListener('click', function () {
        setWeapon(seg.getAttribute('data-w'));
        closeWheel();
      });
      seg.addEventListener('mouseenter', function () { wheelSel = WEAPONS.findIndex(function (w) { return w.id === seg.getAttribute('data-w'); }); paintWheel(); });
    });
  }

  function paintWheel() {
    if (!wheelEl) return;
    var S = VB.state;
    WEAPONS.forEach(function (w, i) {
      var seg = wheelEl.querySelector('.wheel-seg[data-w="' + w.id + '"]');
      if (!seg) return;
      var st = S.weapons[w.id];
      var ammoEl = document.getElementById('wheel-ammo-' + w.id);
      var lockEl = document.getElementById('wheel-lock-' + w.id);
      seg.classList.toggle('selected', i === wheelSel);
      seg.classList.toggle('equipped', S.weapon === w.id);
      seg.classList.toggle('locked', !st.unlocked);
      if (ammoEl) ammoEl.textContent = st.unlocked ? (w.id === 'fists' || w.id === 'hammer' ? '∞' : st.ammo + '/' + st.reserve) : '';
      if (lockEl) lockEl.textContent = st.unlocked ? '' : 'LOCKED · ' + w.unlock;
    });
    var cur = WEAPONS[wheelSel];
    var center = document.getElementById('wheel-center');
    if (center) {
      var st = S.weapons[cur.id];
      center.innerHTML = '<b>' + cur.name + '</b><br>DMG ' + cur.dmg + (st.unlocked ? '' : '<br>LOCKED');
    }
  }

  function openWheel() {
    if (wheelOpen) return;
    wheelOpen = true;
    wheelSel = WEAPONS.findIndex(function (w) { return w.id === VB.state.weapon; });
    if (wheelSel < 0) wheelSel = 0;
    VB.state.timeScale = 0.16;
    paintWheel();
    wheelEl.style.display = 'block';
    var chip = document.getElementById('slowmo-chip');
    if (chip) chip.style.display = 'block';
  }
  function closeWheel() {
    if (!wheelOpen) return;
    wheelOpen = false;
    VB.state.timeScale = 1;
    if (wheelEl) wheelEl.style.display = 'none';
    var chip = document.getElementById('slowmo-chip');
    if (chip) chip.style.display = 'none';
    setWeapon(WEAPONS[wheelSel].id);
  }

  function setWeapon(id) {
    var S = VB.state;
    var st = S.weapons[id];
    if (!st || !st.unlocked) return false;
    S.weapon = id;
    VB.player.setWeaponVisual(id);
    VB.hud.refresh();
    return true;
  }

  function spawnThug(x, z, kind, tag) {
    var human = VB.player.makeHumanoid({
      height: 1.78, skin: 0x8a5a3a,
      shirt: kind === 'pistol' ? 0x333333 : 0x4a1a1a,
      pants: 0x222222, hair: 0x111111, hairStyle: 'normal',
      cap: kind === 'pistol' ? null : 0x8a1a1a
    });
    // red bandana marker for thugs
    var band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.34), new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.8 }));
    band.position.y = 0.2;
    human.parts.head.add(band);
    var marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2.2 }));
    marker.position.y = 2.3;
    human.group.add(marker);
    human.group.position.set(x, 0, z);
    sceneRef.add(human.group);
    var thug = {
      human: human, group: human.group, kind: kind, tag: tag || '',
      x: x, z: z, hp: kind === 'pistol' ? 60 : 80, dead: false,
      speed: 2.2 + Math.random(), attackCd: 0, marker: marker
    };
    thugs.push(thug);
    return thug;
  }

  function damageNumber(worldPos, text, color) {
    var el = document.createElement('div');
    el.className = 'dmg-num';
    el.textContent = text;
    el.style.color = color || '#ffd34d';
    document.getElementById('fx-layer').appendChild(el);
    // Position immediately: the per-frame update that normally places the
    // element never runs while the game is frozen for a staged shot, so a
    // number created for staging would otherwise sit at the top-left corner.
    var sp = projectToScreen(worldPos);
    el.style.display = sp.behind ? 'none' : 'block';
    el.style.left = sp.x + 'px';
    el.style.top = sp.y + 'px';
    dmgNumbers.push({ el: el, pos: worldPos.clone(), life: 1.0 });
  }

  function spawnTracer(from, to, color) {
    var dir = new THREE.Vector3().subVectors(to, from);
    var len = dir.length();
    var geo = new THREE.CylinderGeometry(0.03, 0.03, len, 6);
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color || 0xffe9a0, transparent: true, opacity: 0.9 }));
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    m.rotateX(Math.PI / 2);
    sceneRef.add(m);
    tracers.push({ mesh: m, life: 0.18 });
    // muzzle flash
    var flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95 })
    );
    flash.position.copy(from);
    sceneRef.add(flash);
    tracers.push({ mesh: flash, life: 0.08, flash: true });
  }

  function projectToScreen(v3) {
    // Force the camera matrices current: when a staging function snaps the
    // camera and then projects a point in the same synchronous JS turn (no
    // renderer.render has run since the snap), the matrixWorldInverse is
    // still the PREVIOUS camera's, and the point projects far off-screen
    // (the chase-then-night capture put '-34' at x=9514, y=-1084).
    cameraRef.updateMatrixWorld();
    var v = v3.clone().project(cameraRef);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      behind: v.z > 1
    };
  }

  function fire() {
    var S = VB.state;
    if (S.mode !== 'playing' || S.frozen) return false;
    if (fireCooldown > 0) return false;
    var w = S.weapons[S.weapon];
    if (!w) return false;
    if (S.weapon === 'fists' || S.weapon === 'hammer') {
      // melee swing
      VB.player.eli.setPose('swing');
      VB.audio.sfx(S.weapon === 'hammer' ? 'hammer' : 'hit');
      fireCooldown = S.weapon === 'fists' ? 0.35 : 0.55;
      var hit = null, bd = 2.6;
      for (var i = 0; i < thugs.length; i++) {
        var th = thugs[i];
        if (th.dead) continue;
        var d = U.dist2(VB.player.pos.x, VB.player.pos.z, th.x, th.z);
        if (d < bd) { bd = d; hit = th; }
      }
      if (hit) {
        hit.hp -= w.dmg;
        damageNumber(new THREE.Vector3(hit.x, 1.8, hit.z), '-' + w.dmg, '#ffd34d');
        VB.audio.sfx('hit');
        if (hit.hp <= 0) killThug(hit);
      }
      return true;
    }
    // ranged
    if (w.ammo <= 0) {
      if (w.reserve > 0) { reload(); return false; }
      VB.toast('NO AMMO — press R to reload when you have reserve');
      return false;
    }
    w.ammo--;
    fireCooldown = S.weapon === 'pistol' ? 0.28 : 0.14;
    VB.audio.sfx('shot');
    var from = new THREE.Vector3(VB.player.pos.x, 1.4, VB.player.pos.z);
    // aim: nearest thug in front within 40m, else forward ray
    var target = null, best = 40;
    var fx = Math.sin(VB.player.heading), fz = Math.cos(VB.player.heading);
    for (var j = 0; j < thugs.length; j++) {
      var th2 = thugs[j];
      if (th2.dead) continue;
      var dx = th2.x - VB.player.pos.x, dz = th2.z - VB.player.pos.z;
      var d2 = Math.sqrt(dx * dx + dz * dz);
      if (d2 > 40) continue;
      var dot = (dx * fx + dz * fz) / (d2 || 1);
      if (dot > 0.5 && d2 < best) { best = d2; target = th2; }
    }
    var to;
    if (target) {
      to = new THREE.Vector3(target.x, 1.3, target.z);
      target.hp -= w.dmg;
      damageNumber(new THREE.Vector3(target.x, 1.9, target.z), '-' + w.dmg, '#ffd34d');
      if (target.hp <= 0) killThug(target);
    } else {
      to = new THREE.Vector3(VB.player.pos.x + fx * 30, 1.2, VB.player.pos.z + fz * 30);
    }
    spawnTracer(from, to);
    VB.player.eli.setPose('aim');
    VB.hud.refresh();
    return true;
  }

  function reload() {
    var S = VB.state;
    var w = S.weapons[S.weapon];
    if (!w || w.reserve <= 0) return;
    var need = (S.weapon === 'pistol' ? 12 : 30) - w.ammo;
    var take = Math.min(need, w.reserve);
    w.ammo += take; w.reserve -= take;
    VB.audio.sfx('reload');
    VB.hud.refresh();
  }

  function killThug(thug) {
    thug.dead = true;
    thug.group.visible = false;
    if (thug.marker) thug.marker.visible = false;
    VB.state.takedowns++;
    VB.state.rep += 15;
    VB.audio.sfx('hit');
    VB.toast('TAKEDOWN +15 REP');
    VB.emit('thugDown', thug);
    VB.hud.refresh();
  }

  function thugsAlive() {
    var n = 0;
    for (var i = 0; i < thugs.length; i++) if (!thugs[i].dead) n++;
    return n;
  }

  function stageCombatFX(from, to, dmgText, dmgPos) {
    spawnTracer(from, to, 0xff8866);
    if (dmgText && dmgPos) damageNumber(dmgPos, dmgText, '#ff8866');
  }

  function update(dt, t) {
    var S = VB.state;
    if (fireCooldown > 0) fireCooldown -= dt;
    // wheel input
    if (S.mode === 'playing' && !S.frozen) {
      if (VB.input.down('Tab') && !wheelOpen) openWheel();
      if (!VB.input.down('Tab') && wheelOpen) closeWheel();
      if (wheelOpen) {
        if (VB.input.consume('ArrowLeft')) { wheelSel = (wheelSel + 3) % 4; paintWheel(); }
        if (VB.input.consume('ArrowRight')) { wheelSel = (wheelSel + 1) % 4; paintWheel(); }
        if (VB.input.consume('ArrowUp')) { wheelSel = (wheelSel + 3) % 4; paintWheel(); }
        if (VB.input.consume('ArrowDown')) { wheelSel = (wheelSel + 1) % 4; paintWheel(); }
      }
      // number keys
      if (VB.input.consume('Digit1')) setWeapon('fists');
      if (VB.input.consume('Digit2')) setWeapon('hammer');
      if (VB.input.consume('Digit3')) setWeapon('pistol');
      if (VB.input.consume('Digit4')) setWeapon('rifle');
      if (VB.input.consume('KeyR')) reload();
      // mouse aim / fire
      aiming = !!VB.input.down('MouseRight') || !!VB.input.down('MouseLeft');
      if (VB.input.down('MouseLeft') && !wheelOpen) fire();
      if (VB.input.consume('MouseLeft') && !wheelOpen) fire();
    }
    // thug AI: chase + attack the player
    if (S.mode === 'playing' && !S.frozen) {
      for (var i = 0; i < thugs.length; i++) {
        var th = thugs[i];
        if (th.dead) continue;
        var dx = VB.player.pos.x - th.x, dz = VB.player.pos.z - th.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        if (d > 2.2) {
          th.x += (dx / d) * th.speed * dt;
          th.z += (dz / d) * th.speed * dt;
          th.group.rotation.y = Math.atan2(dx, dz);
          th.human.animateWalk(t, 0.8);
        } else {
          th.attackCd -= dt;
          if (th.attackCd <= 0) {
            th.attackCd = 1.2;
            S.health = Math.max(0, S.health - (th.kind === 'pistol' ? 12 : 8));
            VB.audio.sfx('hit');
            if (S.health <= 0) {
              VB.missions.playerDown();
            }
          }
          th.human.setPose('swing');
        }
        th.group.position.set(th.x, 0, th.z);
        if (th.marker) th.marker.rotation.y += dt * 3;
      }
    }
    // tracer fade
    for (var tr = tracers.length - 1; tr >= 0; tr--) {
      tracers[tr].life -= dt;
      if (tracers[tr].life <= 0) {
        sceneRef.remove(tracers[tr].mesh);
        tracers.splice(tr, 1);
      }
    }
    // damage numbers float up
    for (var dn = dmgNumbers.length - 1; dn >= 0; dn--) {
      var dno = dmgNumbers[dn];
      dno.life -= dt * 0.9;
      dno.pos.y += dt * 1.2;
      if (dno.life <= 0) {
        dno.el.remove();
        dmgNumbers.splice(dn, 1);
        continue;
      }
      var sp = projectToScreen(dno.pos);
      if (sp.behind) { dno.el.style.display = 'none'; continue; }
      dno.el.style.display = 'block';
      dno.el.style.left = sp.x + 'px';
      dno.el.style.top = sp.y + 'px';
      dno.el.style.opacity = String(U.clamp(dno.life, 0, 1));
    }
  }

  VB.combat = {
    init: init, update: update, fire: fire, reload: reload,
    setWeapon: setWeapon, openWheel: openWheel, closeWheel: closeWheel,
    spawnThug: spawnThug, killThug: killThug, thugsAlive: thugsAlive,
    stageCombatFX: stageCombatFX, weapons: WEAPONS,
    get thugs() { return thugs; },
    get aiming() { return aiming; },
    set aiming(v) { aiming = v; },
    get wheelOpen() { return wheelOpen; }
  };
})();
