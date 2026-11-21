// Velora Bay — core.js
// Central state, utilities, save system. Written fresh in-session.
(function () {
  'use strict';
  var VB = window.VB || (window.VB = {});
  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(U.rand(a, b + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
  U.angleLerp = function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  U.money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  U.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  U.timeStr = function (secs) {
    secs = Math.floor(secs);
    var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return U.pad2(h) + ':' + U.pad2(m) + ':' + U.pad2(s);
  };
  U.el = function (id) { return document.getElementById(id); };
  U.show = function (id, on) { var e = U.el(id); if (e) e.style.display = on ? '' : 'none'; };
  U.setText = function (id, txt) { var e = U.el(id); if (e) e.textContent = txt; };
  U.escapeHtml = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  // ---- canonical game state ----
  function freshState() {
    return {
      mode: 'title', timeOfDay: 'sunset', frozen: false, timeScale: 1,
      money: 250, rep: 0, level: 1, day: 1, timePlayed: 0,
      missionIdx: 0, completed: [], ratings: {},
      skills: { Driving: 0, Combat: 0, Stamina: 0, Stealth: 0, Charisma: 0, Mechanic: 0 },
      weapons: {
        fists: { unlocked: true, ammo: Infinity, reserve: Infinity, dmg: 22 },
        hammer: { unlocked: true, ammo: Infinity, reserve: Infinity, dmg: 34 },
        pistol: { unlocked: false, ammo: 12, reserve: 48, dmg: 34 },
        rifle: { unlocked: false, ammo: 30, reserve: 90, dmg: 52 }
      },
      weapon: 'hammer',
      crew: { tommy: false, rosa: false, nadia: false, marv: false, dina: false, kofi: false },
      properties: { workshop: false, garage: false, safehouse: false },
      goldBars: 0, goldCollected: {},
      carsStolen: 0, takedowns: 0, escapes: 0, kmDriven: 0, bestWanted: 0,
      health: 100, armor: 0, wanted: 0, fuel: 100, vehicleCond: 100,
      standing: { portside: 'NEUTRAL', center: 'NEUTRAL', neon: 'NEUTRAL', marina: 'NEUTRAL', beach: 'NEUTRAL' },
      inVehicle: false, vehicleName: '', speedKmh: 0,
      radio: 'VELORA FM 101.2', radioTrack: 'Golden Hour Mix',
      nextMilestone: 'PISTOL'
    };
  }

  var S = freshState();
  VB.state = S;
  VB.util = U;
  VB.freshState = freshState;

  // Weighted completion — ONE definition used by title slots AND map screen.
  // missions 55% + gold 20% + crew 15% + properties 10%.
  VB.completion = function () {
    var m = (S.completed.length / 8) * 55;
    var g = (S.goldBars / 20) * 20;
    var crewN = 0; for (var k in S.crew) if (S.crew[k]) crewN++;
    var c = (crewN / 6) * 15;
    var pN = 0; for (var q in S.properties) if (S.properties[q]) pN++;
    var p = (pN / 3) * 10;
    return Math.round(m + g + c + p);
  };

  VB.repLevel = function () {
    if (S.rep >= 2000) return { lv: 5, name: 'KINGMAKER' };
    if (S.rep >= 1200) return { lv: 4, name: 'SHOT CALLER' };
    if (S.rep >= 600) return { lv: 3, name: 'STREET BOSS' };
    if (S.rep >= 200) return { lv: 2, name: 'FIXER' };
    return { lv: 1, name: 'NOBODY' };
  };

  // ---- saves (3 slots, localStorage) ----
  VB.save = {
    key: function (slot) { return 'velora-bay-save-' + slot; },
    write: function (slot) {
      try {
        var data = {
          money: S.money, rep: S.rep, day: S.day, timePlayed: S.timePlayed,
          missionIdx: S.missionIdx, completed: S.completed.slice(), ratings: JSON.parse(JSON.stringify(S.ratings)),
          skills: JSON.parse(JSON.stringify(S.skills)),
          weapons: JSON.parse(JSON.stringify(S.weapons)),
          crew: JSON.parse(JSON.stringify(S.crew)),
          properties: JSON.parse(JSON.stringify(S.properties)),
          goldBars: S.goldBars, goldCollected: JSON.parse(JSON.stringify(S.goldCollected)),
          carsStolen: S.carsStolen, takedowns: S.takedowns, escapes: S.escapes,
          kmDriven: S.kmDriven, bestWanted: S.bestWanted,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(this.key(slot), JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    read: function (slot) {
      try {
        var raw = localStorage.getItem(this.key(slot));
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    apply: function (data) {
      if (!data) return false;
      var keep = { mode: S.mode, timeOfDay: S.timeOfDay, frozen: S.frozen, timeScale: S.timeScale };
      var fresh = freshState();
      for (var k in fresh) S[k] = fresh[k];
      for (var j in data) { if (j !== 'savedAt' && data.hasOwnProperty(j)) S[j] = data[j]; }
      S.mode = keep.mode; S.timeOfDay = keep.timeOfDay; S.frozen = keep.frozen; S.timeScale = keep.timeScale;
      return true;
    },
    summary: function (slot) {
      var d = this.read(slot);
      if (!d) return null;
      // snapshot without a JSON round-trip (JSON turns Infinity ammo into null)
      var saved = {};
      for (var k in S) {
        var v = S[k];
        saved[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
      }
      this.apply(d);
      var pct = VB.completion();
      var out = {
        pct: pct, missions: d.completed.length, money: d.money, rep: d.rep,
        day: d.day, savedAt: d.savedAt
      };
      this.apply(saved);
      // restore infinite melee ammo (JSON snapshot nulled it)
      if (S.weapons.fists.ammo == null) S.weapons.fists.ammo = Infinity;
      if (S.weapons.hammer.ammo == null) S.weapons.hammer.ammo = Infinity;
      return out;
    }
  };

  // ---- tiny event bus ----
  var listeners = {};
  VB.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  VB.emit = function (ev, data) {
    var arr = listeners[ev] || [];
    for (var i = 0; i < arr.length; i++) { try { arr[i](data); } catch (e) { /* ignore */ } }
  };

  // ---- toasts ----
  VB.toast = function (msg, ms) {
    var t = U.el('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.style.opacity = '0'; }, ms || 2600);
  };
})();
