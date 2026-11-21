// Velora Bay — hud.js
// HUD, minimap, GTA-style map screen, title / pause / win screens.
// Written fresh in-session.
(function () {
  'use strict';
  var VB = window.VB;
  var U = VB.util;

  var minimapCtx = null, mapCtx = null;
  var currentTab = 'map';

  function init() {
    var mm = U.el('minimap');
    if (mm) minimapCtx = mm.getContext('2d');
    var mc = U.el('map-canvas');
    if (mc) mapCtx = mc.getContext('2d');
    wireButtons();
    refresh();
  }

  function wireButtons() {
    var on = function (id, fn) { var e = U.el(id); if (e) e.addEventListener('click', fn); };
    on('btn-continue', function () { VB.audio.sfx('click'); continueGame(); });
    on('btn-newgame', function () { VB.audio.sfx('click'); newGame(); });
    on('btn-loadgame', function () { VB.audio.sfx('click'); loadGame(); });
    on('btn-settings', function () { VB.audio.sfx('click'); toggleSettings(); });
    on('btn-settings-close', function () { toggleSettings(); });
    on('btn-resume', function () { VB.audio.sfx('click'); setMode('playing'); });
    on('btn-pause-map', function () { VB.audio.sfx('click'); openMap('map'); });
    on('btn-pause-save', function () { VB.audio.sfx('click'); VB.save.write(1); VB.toast('SAVED — SLOT 1'); });
    on('btn-pause-quit', function () { VB.audio.sfx('click'); showTitle(); });
    on('btn-map-continue', function () { VB.audio.sfx('click'); closeMap(); });
    on('btn-win-again', function () { VB.audio.sfx('click'); newGame(); });
    on('btn-win-title', function () { VB.audio.sfx('click'); showTitle(); });
    on('btn-radio', function () { var on2 = VB.audio.toggleRadio(); VB.toast(on2 ? 'RADIO ON — ' + VB.state.radio : 'RADIO OFF'); refresh(); });
    on('hud-weapon', function () { if (VB.combat) VB.combat.openWheel(); });
    // volume sliders
    ['vol-master', 'vol-music', 'vol-sfx'].forEach(function (id) {
      var e = U.el(id);
      if (e) e.addEventListener('input', function () {
        VB.audio.setVolume(id.replace('vol-', ''), parseFloat(e.value));
      });
    });
    // map tabs
    document.querySelectorAll('.map-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { openMap(tab.getAttribute('data-tab')); });
    });
  }

  function setMode(mode) {
    var S = VB.state;
    S.mode = mode;
    U.show('title-screen', mode === 'title');
    U.show('map-screen', mode === 'map');
    U.show('pause-screen', mode === 'paused');
    U.show('win-screen', mode === 'win');
    U.show('hud', mode === 'playing' || mode === 'map');
    U.show('settings-panel', false);
    if (mode === 'title') { fillTitle(); }
    if (mode === 'map') { fillMapSide(); drawMap(); }
    if (mode === 'playing') { refresh(); }
  }

  function newGame() {
    var fresh = VB.freshState();
    for (var k in fresh) VB.state[k] = fresh[k];
    VB.state.mode = 'playing';
    VB.player.resetTo(-63, -20, 0);
    VB.world.setTimeOfDay('sunset');
    VB.ai.clearWanted();
    VB.missions.startMission(0);
    VB.audio.unlock();
    setMode('playing');
    VB.toast('VELORA BAY — From sawdust to City Hall');
  }

  function continueGame() {
    var d = VB.save.read(1);
    if (!d) { newGame(); return; }
    VB.save.apply(d);
    VB.state.mode = 'playing';
    VB.player.resetTo(-40, 0, 0);
    VB.world.setTimeOfDay('sunset');
    VB.missions.setStage(VB.state.missionIdx, VB.state._stage || 0);
    setMode('playing');
    VB.toast('CONTINUED — MISSION ' + (VB.state.missionIdx + 1));
  }

  function loadGame() {
    var d = VB.save.read(1);
    if (!d) { VB.toast('SLOT 1 IS EMPTY'); return; }
    continueGame();
  }

  function toggleSettings() {
    var p = U.el('settings-panel');
    if (!p) return;
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
  }

  // ---------------- HUD refresh ----------------
  function refresh() {
    var S = VB.state;
    if (!S) return;
    U.setText('hud-money', U.money(S.money));
    var lv = VB.repLevel();
    U.setText('hud-rep', 'REP ' + S.rep + ' · LV ' + lv.lv + ' ' + lv.name + ' · NEXT AT: ' + S.nextMilestone);
    U.setText('hud-gold', 'GOLD ' + S.goldBars + '/20');
    U.setText('hud-income', '+$' + (S.properties.workshop ? 12 : 0) + (S.properties.garage ? 8 : 0) + (S.properties.safehouse ? 5 : 0) + '/min');
    U.setText('hud-radio', '♪ ' + S.radio + ' — ' + S.radioTrack);
    // health / armor
    var hp = U.el('hud-hp-fill'); if (hp) hp.style.width = S.health + '%';
    var ar = U.el('hud-armor-fill'); if (ar) ar.style.width = S.armor + '%';
    U.setText('hud-hp-num', Math.round(S.health) + '');
    // wanted stars
    var stars = U.el('hud-stars');
    if (stars) {
      var s = '';
      for (var i = 0; i < 5; i++) s += i < S.wanted ? '★' : '☆';
      stars.textContent = s;
      stars.style.color = S.wanted >= 4 ? '#ff4444' : '#ffd34d';
    }
    // district standing
    var dist = VB.world.districtAt(VB.player.pos.x);
    U.setText('hud-district', dist.toUpperCase() + ' · ' + (S.standing[districtKey(dist)] || 'NEUTRAL'));
    // mission card
    var m = VB.missions.current();
    var st = VB.missions.currentStage();
    if (m && st) {
      U.setText('hud-mission-act', m.act);
      U.setText('hud-mission-name', 'MISSION ' + (S.missionIdx + 1) + ' · ' + m.name);
      U.setText('hud-mission-obj', st.text);
      U.setText('hud-mission-stage', 'STAGE ' + (VB.missions.stageIdx() + 1) + '/' + m.stages.length);
      var bar = U.el('hud-mission-bar');
      if (bar) bar.style.width = Math.round(((VB.missions.stageIdx()) / m.stages.length) * 100) + '%';
      var obj = objectiveDistance();
      U.setText('hud-mission-next', obj ? 'NEXT: ' + obj : '');
    }
    // VBPD panel
    var units = VB.ai.units;
    var panel = U.el('vbpd-list');
    if (panel) {
      if (!units || units.length === 0) {
        panel.innerHTML = '<div class="vbpd-empty">NO ACTIVE PURSUIT</div>';
      } else {
        var html = '';
        // Show at most 4 units; the rest collapse into a "+N more" line.
        // (Rendering all 6 AND the "+2 more" line double-counted the pursuit.)
        units.slice(0, 4).forEach(function (u) {
          html += '<div class="vbpd-row"><span class="vbpd-name">' + U.escapeHtml(u.unitName) + '</span>' +
            '<span class="vbpd-role ' + (u.unitRole === 'RAMMING' ? 'role-ram' : '') + '">' + u.unitRole + '</span>' +
            '<span class="vbpd-dist">' + u.dist + 'm</span></div>';
        });
        if (units.length > 4) html += '<div class="vbpd-more">+' + (units.length - 4) + ' more</div>';
        panel.innerHTML = html;
      }
    }
    var air = U.el('vbpd-air');
    if (air) air.style.display = (VB.ai.heli && VB.ai.heli.visible) ? 'block' : 'none';
    var rb = U.el('vbpd-roadblock');
    if (rb) rb.style.display = S.wanted >= 5 ? 'block' : 'none';
    U.show('vbpd-panel', S.wanted > 0);
    // weapon bar
    var wb = U.el('hud-weapon');
    if (wb) {
      var html2 = '';
      VB.combat.weapons.forEach(function (w) {
        var st2 = S.weapons[w.id];
        html2 += '<div class="wslot ' + (S.weapon === w.id ? 'active' : '') + ' ' + (st2.unlocked ? '' : 'locked') + '">' +
          '<div class="wslot-key">' + w.key + '</div>' +
          '<div class="wslot-name">' + w.name + '</div>' +
          '<div class="wslot-ammo">' + (st2.unlocked ? (w.id === 'fists' || w.id === 'hammer' ? '∞' : st2.ammo + '/' + st2.reserve) : 'LOCKED') + '</div>' +
          '</div>';
      });
      wb.innerHTML = html2;
    }
    // speed
    U.show('hud-speed', S.inVehicle);
    U.setText('hud-speed-num', String(S.speedKmh || 0));
    U.setText('hud-vehicle', S.vehicleName || '');
    U.setText('hud-fuel', 'FUEL ' + Math.round(S.fuel) + '%');
    U.setText('hud-cond', 'CONDITION ' + Math.round(S.vehicleCond) + '%');
  }

  function districtKey(name) {
    var map = { 'Portside': 'portside', 'Velora Center': 'center', 'Neon Row': 'neon', 'Marina Heights': 'marina', 'Velora Beach': 'beach' };
    return map[name] || 'center';
  }

  function objectiveDistance() {
    var st = VB.missions.currentStage();
    if (!st || st.x == null) return null;
    var d = Math.round(U.dist2(VB.player.pos.x, VB.player.pos.z, st.x, st.z));
    return d + 'm';
  }

  // ---------------- map drawing (GTA geography, gold dashed boundaries) ----------------
  function mapTransform(canvasW, canvasH) {
    var scale = Math.min(canvasW, canvasH) / 165;
    var ox = (canvasW - 150 * scale) / 2;
    var oy = (canvasH - 150 * scale) / 2;
    return {
      scale: scale, ox: ox, oy: oy,
      X: function (x) { return ox + (x + 75) * scale; },
      Y: function (z) { return oy + (z + 75) * scale; }
    };
  }

  function drawMapInto(ctx, W, H, forMinimap) {
    var t = mapTransform(W, H);
    ctx.clearRect(0, 0, W, H);
    // slate base
    ctx.fillStyle = '#22304a';
    ctx.fillRect(0, 0, W, H);
    // subtle checker
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (var gx = 0; gx < 15; gx++) for (var gz = 0; gz < 15; gz++) {
      if ((gx + gz) % 2 === 0) ctx.fillRect(t.ox + gx * 10 * t.scale, t.oy + gz * 10 * t.scale, 10 * t.scale, 10 * t.scale);
    }
    // sea east + harbor west
    ctx.fillStyle = '#2fa8b8';
    ctx.fillRect(t.X(68), t.oy, W - t.X(68), 150 * t.scale);
    ctx.fillStyle = '#e8d9a8';
    ctx.fillRect(t.X(68), t.oy, 7 * t.scale, 150 * t.scale);
    ctx.fillStyle = '#2a7a94';
    ctx.fillRect(0, t.oy, t.X(-75), 150 * t.scale);
    // roads: dark asphalt bands with gold centre lines
    var L = VB.world.LAYOUT;
    L.roads.forEach(function (r) {
      ctx.fillStyle = '#33363e';
      ctx.fillRect(t.X(r[0]), t.Y(r[1]), (r[2] - r[0]) * t.scale, (r[3] - r[1]) * t.scale);
    });
    ctx.strokeStyle = '#d4a017'; ctx.lineWidth = Math.max(1, t.scale * 0.5);
    ctx.setLineDash([4, 4]);
    L.roads.forEach(function (r) {
      ctx.beginPath();
      if (r[2] - r[0] > r[3] - r[1]) {
        ctx.moveTo(t.X(r[0]), t.Y((r[1] + r[3]) / 2)); ctx.lineTo(t.X(r[2]), t.Y((r[1] + r[3]) / 2));
      } else {
        ctx.moveTo(t.X((r[0] + r[2]) / 2), t.Y(r[1])); ctx.lineTo(t.X((r[0] + r[2]) / 2), t.Y(r[3]));
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // district boundaries: gold dashed lines
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = Math.max(1.5, t.scale * 0.8);
    ctx.setLineDash([6, 4]);
    VB.world.boundaries.forEach(function (bx) {
      ctx.beginPath();
      ctx.moveTo(t.X(bx), t.oy); ctx.lineTo(t.X(bx), t.oy + 150 * t.scale);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // district labels (big map only — at minimap scale the five names
    // collide into one unreadable strip)
    if (!forMinimap) {
    ctx.font = 'bold ' + Math.max(10, Math.round(13 * t.scale / 2.5)) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,17,32,0.85)';
    VB.world.districts.forEach(function (d) {
      var cx = (d.x1 + d.x2) / 2;
      var label = d.name.toUpperCase();
      var words = label.split(' ');
      var ly = t.Y(-52);
      ctx.fillStyle = '#ffffff';
      if (words.length > 1) {
        ctx.strokeText(words[0], t.X(cx), ly);
        ctx.fillText(words[0], t.X(cx), ly);
        ctx.strokeText(words[1], t.X(cx), ly + 15);
        ctx.fillText(words[1], t.X(cx), ly + 15);
      } else {
        ctx.strokeText(label, t.X(cx), ly);
        ctx.fillText(label, t.X(cx), ly);
      }
    });
    }
    // POI markers + labels (each with its own anchor so nothing stacks).
    // The dots draw on the minimap too; the label text is big-map only.
    var pois = VB.world.pois;
    ctx.font = 'bold ' + Math.max(9, Math.round(11 * t.scale / 2.5)) + 'px Arial';
    Object.keys(pois).forEach(function (key) {
      var p = pois[key];
      var px = t.X(p.x), py = t.Y(p.z);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(px, py, Math.max(3, 3.5 * t.scale / 2.5), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0a1120'; ctx.lineWidth = 1.5; ctx.stroke();
      if (forMinimap) return;
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,17,32,0.9)';
      var lx = px, ly2 = py;
      if (p.anchor === 'right') { ctx.textAlign = 'left'; lx = px + 7; }
      else if (p.anchor === 'left') { ctx.textAlign = 'right'; lx = px - 7; }
      else if (p.anchor === 'below') { ctx.textAlign = 'center'; ly2 = py + 14; }
      else if (p.anchor === 'above') { ctx.textAlign = 'center'; ly2 = py - 10; }
      else { ctx.textAlign = 'center'; ly2 = py - 10; }
      ctx.strokeText(p.label, lx, ly2);
      ctx.fillText(p.label, lx, ly2);
      ctx.textAlign = 'center';
    });
    // GPS route: player -> current objective (purple dashed)
    var st = VB.missions.currentStage();
    if (st && st.x != null && !forMinimap) {
      ctx.strokeStyle = '#b06fd4'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(t.X(VB.player.pos.x), t.Y(VB.player.pos.z));
      ctx.lineTo(t.X(st.x), t.Y(st.z));
      ctx.stroke();
      ctx.setLineDash([]);
      var midX = (t.X(VB.player.pos.x) + t.X(st.x)) / 2;
      var midY = (t.Y(VB.player.pos.z) + t.Y(st.z)) / 2 + 14;
      ctx.font = 'bold 11px Arial';
      ctx.fillStyle = '#d9a0f2';
      ctx.fillText((Math.round(U.dist2(VB.player.pos.x, VB.player.pos.z, st.x, st.z) / 1000 * 10) / 10) + ' km', midX, midY);
      // objective marker
      ctx.fillStyle = '#ff2e88';
      ctx.beginPath(); ctx.arc(t.X(st.x), t.Y(st.z), 5, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    var pax = t.X(VB.player.pos.x), pay = t.Y(VB.player.pos.z);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a1120'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pax, pay - 7); ctx.lineTo(pax + 5, pay + 5); ctx.lineTo(pax - 5, pay + 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // grid edge labels A-F / 1-6
    if (!forMinimap) {
      ctx.font = '10px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      var cols = ['A', 'B', 'C', 'D', 'E', 'F'];
      for (var ci = 0; ci < 6; ci++) {
        ctx.fillText(cols[ci], t.ox + (ci + 0.5) * 25 * t.scale, t.oy - 4);
      }
      for (var ri = 0; ri < 6; ri++) {
        ctx.fillText(String(ri + 1), t.ox - 6, t.oy + (ri + 0.5) * 25 * t.scale);
      }
      // north arrow
      ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#ffffff';
      ctx.fillText('N ↑', W - 18, 16);
    }
  }

  function drawMap() {
    if (!mapCtx) return;
    var c = U.el('map-canvas');
    drawMapInto(mapCtx, c.width, c.height, false);
  }

  function drawMinimap() {
    if (!minimapCtx) return;
    var c = U.el('minimap');
    drawMapInto(minimapCtx, c.width, c.height, true);
  }

  // ---------------- title / map side panels ----------------
  function fillTitle() {
    var sum = VB.save.summary(1);
    var slot = U.el('slot-1');
    if (slot) {
      if (sum) {
        slot.innerHTML = '<b>SLOT 1</b> — ' + sum.pct + '% complete · ' + sum.missions + '/8 missions · ' + U.money(sum.money) + ' · REP ' + sum.rep;
      } else {
        slot.innerHTML = '<b>SLOT 1</b> — EMPTY';
      }
    }
    var cont = U.el('btn-continue');
    if (cont) cont.style.opacity = sum ? '1' : '0.5';
  }

  function fillMapSide() {
    var S = VB.state;
    U.setText('map-complete', VB.completion() + '% COMPLETE');
    // missions list
    var list = U.el('map-missions');
    if (list) {
      var html = '';
      VB.missions.list.forEach(function (m, i) {
        var done = S.completed.indexOf(i) >= 0;
        var cur = i === S.missionIdx;
        var rating = S.ratings[i] || '';
        html += '<div class="map-mission ' + (done ? 'done' : '') + ' ' + (cur ? 'current' : '') + '">' +
          '<span class="mm-num">' + (i + 1) + '.</span> ' + m.name +
          ' <span class="mm-reward">$' + m.reward + '</span>' +
          ' <span class="mm-state">' + (done ? 'DONE ' + rating : (cur ? 'NOW' : 'LOCKED')) + '</span></div>';
      });
      list.innerHTML = html;
    }
    // current job
    var m = VB.missions.current();
    var st = VB.missions.currentStage();
    U.setText('map-job', m ? (m.name + ' — ' + (st ? st.text : '')) : '—');
    // skills
    var sk = U.el('map-skills');
    if (sk) {
      var html2 = '';
      Object.keys(S.skills).forEach(function (name) {
        var pips = '';
        for (var i = 0; i < 6; i++) pips += i < S.skills[name] ? '●' : '○';
        html2 += '<div class="skill-row"><span>' + name.toUpperCase() + '</span><span class="pips">' + pips + '</span></div>';
      });
      sk.innerHTML = html2;
    }
    // stats
    var stats = U.el('map-stats');
    if (stats) {
      var crewN = 0; for (var k in S.crew) if (S.crew[k]) crewN++;
      var propN = 0; for (var q in S.properties) if (S.properties[q]) propN++;
      stats.innerHTML =
        '<div class="stat"><b>' + S.carsStolen + '</b><span>Cars stolen</span></div>' +
        '<div class="stat"><b>' + S.takedowns + '</b><span>Takedowns</span></div>' +
        '<div class="stat"><b>' + S.escapes + '</b><span>Escapes</span></div>' +
        '<div class="stat"><b>' + S.kmDriven.toFixed(1) + ' km</b><span>Driven</span></div>' +
        '<div class="stat"><b>' + S.bestWanted + '★</b><span>Best wanted</span></div>' +
        '<div class="stat"><b>' + U.timeStr(S.timePlayed) + '</b><span>Time played</span></div>' +
        '<div class="stat"><b>' + crewN + '/6</b><span>Crew</span></div>' +
        '<div class="stat"><b>' + propN + '/3</b><span>Properties</span></div>' +
        '<div class="stat"><b>' + S.goldBars + '/20</b><span>Gold Bars</span></div>' +
        '<div class="stat"><b>' + U.money(S.money) + '</b><span>Cash</span></div>' +
        '<div class="stat"><b>' + S.rep + '</b><span>REP</span></div>' +
        '<div class="stat"><b>DAY ' + S.day + '</b><span>Day</span></div>';
    }
    // crew cards
    var crew = U.el('map-crew');
    if (crew) {
      var html3 = '';
      Object.keys(VB.player.crewDefs).forEach(function (key) {
        var def = VB.player.crewDefs[key];
        var rec = S.crew[key];
        html3 += '<div class="crew-card ' + (rec ? 'recruited' : 'locked') + '">' +
          '<div class="crew-dot" style="background:#' + def.color.toString(16).padStart(6, '0') + '"></div>' +
          '<div class="crew-name">' + def.name + '</div>' +
          '<div class="crew-role">' + def.role + '</div>' +
          '<div class="crew-state">' + (rec ? 'RECRUITED' : 'NOT RECRUITED') + '</div></div>';
      });
      crew.innerHTML = html3;
      var ch = U.el('map-crew-head');
      if (ch) {
        var cn = 0; for (var k2 in S.crew) if (S.crew[k2]) cn++;
        ch.textContent = 'CREW ' + cn + '/6';
      }
    }
    // ratings line
    var ratings = ['G', 'S', 'B'];
    var rHtml = '';
    for (var i = 0; i < 8; i++) {
      var r = S.ratings[i];
      rHtml += '<span class="rating ' + (r === 'G' ? 'gold' : (r === 'S' ? 'silver' : (r === 'B' ? 'bronze' : 'none'))) + '">' + (r || '–') + '</span>';
    }
    U.el('map-ratings') && (U.el('map-ratings').innerHTML = 'MISSION RATINGS ' + rHtml);
  }

  function openMap(tab) {
    currentTab = tab || 'map';
    document.querySelectorAll('.map-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === currentTab);
    });
    setMode('map');
  }
  function closeMap() {
    if (VB.state.mode === 'map') setMode('playing');
  }
  function showTitle() {
    VB.state.mode = 'title';
    VB.world.setTimeOfDay('sunset');
    setMode('title');
  }
  function showWin() {
    var S = VB.state;
    U.setText('win-payout', U.money(S.money));
    U.setText('win-rep', 'REP ' + S.rep + ' · ' + VB.repLevel().name);
    U.setText('win-stats', 'MISSIONS 8/8 · GOLD ' + S.goldBars + '/20 · CREW 6/6 · ' + U.timeStr(S.timePlayed));
    setMode('win');
  }

  function update(dt) {
    if (VB.state.mode === 'playing' || VB.state.mode === 'map') {
      if (!VB.state.headless) drawMinimap();
      refresh();
    }
  }

  VB.hud = {
    init: init, refresh: refresh, update: update, setMode: setMode,
    newGame: newGame, continueGame: continueGame, loadGame: loadGame,
    openMap: openMap, closeMap: closeMap, showTitle: showTitle, showWin: showWin,
    drawMap: drawMap, drawMinimap: drawMinimap, fillTitle: fillTitle
  };
})();
