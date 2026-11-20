// VELORA BAY — HUD
// All DOM interface: mission card, money/REP, wanted stars, minimap
// (a live top-down canvas of layout.js data), vitals, weapon bar,
// speedometer, dialogue, toasts, K-9 alert, weapon wheel, title screen
// and the GTA-style geographic map screen.
import { ROADS, DISTRICTS, POIS, GOLD_BARS, roadRect, districtAt, poi } from './layout.js';

const $ = (id) => document.getElementById(id);

export function createHud(G) {
  const H = {
    wheelOpen: false,
    wheelSel: null,
    minimapCtx: $('minimap').getContext('2d'),
    mapCtx: $('map-canvas').getContext('2d'),
    dmgLayer: null,
  };
  // damage numbers layer (absolute-positioned divs over the 3D view)
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:11;overflow:hidden';
  document.body.appendChild(layer);
  H.dmgLayer = layer;

  function money(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

  H.refreshMoney = () => {
    G.level = Math.min(10, 1 + Math.floor(G.rep / 400));
    $('hud-money').textContent = money(G.money); $('hud-rep').textContent = `REP ${G.rep} · LV ${G.level} ${G.rankName()}`; $('hud-next').textContent = `NEXT AT: ${G.nextUnlock()}`;
  };
  H.refreshVitals = () => {
    $('hp-fill').style.width = `${Math.max(0, G.player.hp)}%`;
    $('hp-num').textContent = Math.ceil(Math.max(0, G.player.hp));
    $('armor-fill').style.width = `${Math.min(100, G.player.armor)}%`;
    $('armor-num').textContent = Math.ceil(G.player.armor);
    $('hud-gold').textContent = `${G.goldBars}/20`;
    $('hud-income').textContent = `+$${G.incomePerMin}/min`;
  };
  H.refreshWeapons = () => {
    const w = G.player.weapon;
    const icons = { fists: '✊ FISTS', hammer: '🔨 HAMMER', pistol: '🔫 PISTOL', rifle: '🎯 RIFLE' };
    document.querySelectorAll('#weapon-bar .wslot').forEach((el) => {
      const k = el.dataset.w;
      el.classList.toggle('active', k === w);
      const locked = (k === 'pistol' && !G.weapons.pistol.unlocked) || (k === 'rifle' && !G.weapons.rifle.unlocked);
      el.classList.toggle('locked', locked);
      let ammo;
      if (k === 'fists' || k === 'hammer') ammo = '∞';
      else if (locked) ammo = k === 'pistol' ? '0/48 · LOCKED' : '0/90 · LOCKED';
      else ammo = k === 'pistol' ? `${G.player.ammo.pistol}/${G.player.reserve.pistol}` : `${G.player.ammo.rifle}/${G.player.reserve.rifle}`;
      el.innerHTML = `${icons[k]} <span class="ammo">${ammo}</span>`;
    });
    document.querySelectorAll('#wheel .seg').forEach((el) => {
      const k = el.dataset.w;
      el.classList.toggle('sel', H.wheelSel === k);
      el.classList.toggle('locked', (k === 'pistol' && !G.weapons.pistol.unlocked) || (k === 'rifle' && !G.weapons.rifle.unlocked));
    });
  };
  H.setMission = (act, name, obj, stage, progress) => {
    $('mc-act').textContent = act;
    $('mc-name').textContent = name;
    $('mc-obj').textContent = obj;
    $('mc-stage').textContent = stage;
    $('mc-progress').style.width = `${Math.round(progress * 100)}%`;
  };
  H.setWanted = (w) => {
    $('hud-stars').textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
    $('hud-police').textContent = w === 0 ? 'VBPD PATROL · ALL QUIET' : `VBPD RESPONSE · ${G.police.P.units.filter((u) => u.state === 'PURSUIT').length} UNITS IN PURSUIT`;
  };
  H.toast = (text, kind = '') => {
    const t = document.createElement('div');
    t.className = 'toast panel';
    t.textContent = text;
    if (kind === 'bad') t.style.color = '#ff8a7a';
    if (kind === 'good') t.style.color = '#7fd08a';
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  };
  H.say = (who, line, ms = 4200) => {
    $('dlg-who').textContent = who;
    $('dlg-line').textContent = line;
    $('dialogue').style.display = 'block';
    clearTimeout(H._dlgT);
    H._dlgT = setTimeout(() => { $('dialogue').style.display = 'none'; }, ms);
  };
  H.setInteract = (text) => {
    if (!text) { $('interact').style.display = 'none'; return; }
    $('interact-text').textContent = text;
    $('interact').style.display = 'block';
  };
  H.flashDamage = () => {
    const f = document.createElement('div');
    f.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:12;background:radial-gradient(ellipse at center, transparent 55%, rgba(200,30,20,0.45) 100%);transition:opacity .5s';
    document.body.appendChild(f);
    requestAnimationFrame(() => { f.style.opacity = '0'; });
    setTimeout(() => f.remove(), 550);
  };
  H.muzzle = () => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;left:50%;top:50%;width:14px;height:14px;margin:-7px;border-radius:50%;background:#ffe9a0;box-shadow:0 0 24px 8px #ffd76a;pointer-events:none;z-index:12';
    document.body.appendChild(m);
    setTimeout(() => m.remove(), 70);
  };
  H.damageNumber = (worldPos, text) => {
    const v = worldPos.clone ? worldPos.clone() : new (worldPos.constructor)(worldPos.x, 1.6, worldPos.z);
    v.y = 1.8;
    const s = G.project(v);
    if (!s || s.z > 1) return;
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `position:absolute;left:${s.x}px;top:${s.y}px;color:#ff8a7a;font-weight:800;font-size:18px;text-shadow:0 1px 3px #000;transition:all .8s;pointer-events:none`;
    H.dmgLayer.appendChild(d);
    requestAnimationFrame(() => { d.style.top = (s.y - 46) + 'px'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 850);
  };
  H.setK9 = (on, text) => {
    $('k9').style.display = on ? 'block' : 'none';
    if (text) $('k9').textContent = text;
  };
  H.setSpeedo = (show, kmh, name, cond, fuel) => {
    $('speedo').style.display = show ? 'block' : 'none';
    if (!show) return;
    $('hud-speed').textContent = Math.round(kmh);
    $('hud-car').textContent = name;
    $('hud-cond').textContent = `CONDITION ${Math.round(cond)}% · FUEL ${Math.round(fuel)}%`;
  };
  H.openWheel = () => {
    H.wheelOpen = true;
    H.wheelSel = G.player.weapon;
    $('wheel').style.display = 'flex';
    $('slowmo').style.display = 'block';
    H.refreshWeapons();
  };
  H.closeWheel = () => {
    H.wheelOpen = false;
    $('wheel').style.display = 'none';
    $('slowmo').style.display = 'none';
    if (H.wheelSel) G.setWeapon(H.wheelSel);
  };
  H.wheelSelect = (w) => { H.wheelSel = w; H.refreshWeapons(); };

  // ---------- minimap: live top-down canvas from layout data ----------
  H.drawMinimap = (playerPos, playerYaw, objective, enemies, goldLeft) => {
    const c = H.minimapCtx, S = 380;
    const scale = S / 440;
    const X = (x) => (x + 220) * scale;
    const Z = (z) => (z + 170) * scale;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#1e3a52'; c.fillRect(0, 0, S, S);
    // water
    c.fillStyle = '#2a7f9e';
    c.fillRect(0, 0, X(-200), S); c.fillRect(X(200), 0, S - X(200), S); c.fillRect(0, Z(150), S, S - Z(150));
    // district tints
    for (const d of DISTRICTS) {
      c.fillStyle = '#' + d.color.toString(16).padStart(6, '0') + '55';
      c.fillRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
    }
    // beach
    c.fillStyle = '#e8d9a0'; c.fillRect(0, Z(110), S, Z(150) - Z(110));
    // roads
    c.fillStyle = '#4a5568';
    for (const r of ROADS) {
      const rr = roadRect(r);
      c.fillRect(X(rr.x0), Z(rr.z0), (rr.x1 - rr.x0) * scale, (rr.z1 - rr.z0) * scale);
    }
    // POIs
    for (const p of POIS) {
      c.fillStyle = '#ffd76a';
      c.beginPath(); c.arc(X(p.x), Z(p.z), 3, 0, Math.PI * 2); c.fill();
    }
    // gold bars left
    c.fillStyle = '#fff200';
    for (const g of goldLeft) c.fillRect(X(g.x) - 2, Z(g.z) - 2, 4, 4);
    // enemies (red)
    c.fillStyle = '#ff5a4a';
    for (const e of enemies) { if (e.hp > 0) { c.beginPath(); c.arc(X(e.pos.x), Z(e.pos.z), 4, 0, Math.PI * 2); c.fill(); } }
    // police (blue)
    c.fillStyle = '#7fb3e8';
    for (const u of G.police.P.units) { const p = u.d.car.group.position; c.beginPath(); c.arc(X(p.x), Z(p.z), 4, 0, Math.PI * 2); c.fill(); }
    // objective (gold diamond + route line)
    if (objective) {
      c.strokeStyle = '#ffd76a'; c.lineWidth = 2; c.setLineDash([6, 4]);
      c.beginPath(); c.moveTo(X(playerPos.x), Z(playerPos.z)); c.lineTo(X(objective.x), Z(objective.z)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#ffd76a';
      c.save(); c.translate(X(objective.x), Z(objective.z)); c.rotate(Math.PI / 4); c.fillRect(-6, -6, 12, 12); c.restore();
    }
    // player arrow (rotates with facing, north-up map)
    c.save();
    c.translate(X(playerPos.x), Z(playerPos.z));
    c.rotate(playerYaw);
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(-6, 7); c.closePath(); c.fill();
    c.restore();
    // north
    c.fillStyle = '#f5ead0'; c.font = 'bold 14px Arial'; c.textAlign = 'center';
    c.fillText('N', S / 2, 16);
    c.restore();
  };

  // ---------- big map screen (GTA-style geographic map) ----------
  H.drawMap = (playerPos, objective) => {
    const c = H.mapCtx, W = 760, Hh = 560;
    const scale = W / 440;
    const X = (x) => (x + 220) * scale;
    const Z = (z) => (z + 170) * (Hh / 340);
    c.clearRect(0, 0, W, Hh);
    c.fillStyle = '#1e3a52'; c.fillRect(0, 0, W, Hh);
    c.fillStyle = '#2a7f9e';
    c.fillRect(0, 0, X(-200), Hh); c.fillRect(X(200), 0, W - X(200), Hh); c.fillRect(0, Z(150), W, Hh - Z(150));
    for (const d of DISTRICTS) {
      c.fillStyle = '#' + d.color.toString(16).padStart(6, '0') + '44';
      c.fillRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * (Hh / 340));
    }
    c.fillStyle = '#e8d9a0'; c.fillRect(0, Z(110), W, Z(150) - Z(110));
    c.fillStyle = '#4a5568';
    for (const r of ROADS) {
      const rr = roadRect(r);
      c.fillRect(X(rr.x0), Z(rr.z0), (rr.x1 - rr.x0) * scale, (rr.z1 - rr.z0) * (Hh / 340));
    }
    // grid A–F / 1–6 overlay
    c.strokeStyle = 'rgba(245,234,208,0.18)'; c.lineWidth = 1;
    c.font = '11px Arial'; c.fillStyle = 'rgba(245,234,208,0.6)';
    for (let i = 0; i < 6; i++) {
      const gx = (i + 0.5) * (W / 6);
      c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, Hh); c.stroke();
      c.fillText('ABCDEF'[i], gx, 12);
      const gz = (i + 0.5) * (Hh / 6);
      c.beginPath(); c.moveTo(0, gz); c.lineTo(W, gz); c.stroke();
      c.fillText(String(i + 1), 8, gz);
    }
    // district labels on dark pills (readable over POI labels)
    const labelAt = { portside: [-160, -95], neon: [150, -105], center: [0, 42], marina: [150, 5], beach: [0, 128] };
    c.font = 'bold 15px Arial'; c.textAlign = 'center';
    for (const d of DISTRICTS) {
      const [lx, lz] = labelAt[d.id];
      const name = d.name.toUpperCase();
      const w = c.measureText(name).width + 16;
      c.fillStyle = 'rgba(8,16,28,0.72)';
      c.fillRect(X(lx) - w / 2, Z(lz) - 12, w, 22);
      c.fillStyle = '#ffd76a';
      c.fillText(name, X(lx), Z(lz) + 4);
    }
    // POI markers + small labels (right-edge POIs label to the left)
    c.font = '10px Arial';
    for (const p of POIS) {
      c.fillStyle = '#ffd76a';
      c.beginPath(); c.arc(X(p.x), Z(p.z), 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8e0cc';
      if (p.x > 150) { c.textAlign = 'right'; c.fillText(p.name, X(p.x) - 7, Z(p.z) + 3); }
      else { c.textAlign = 'left'; c.fillText(p.name, X(p.x) + 7, Z(p.z) + 3); }
    }
    // GPS route to objective
    if (objective) {
      c.strokeStyle = '#ffd76a'; c.lineWidth = 3; c.setLineDash([10, 7]);
      c.beginPath(); c.moveTo(X(playerPos.x), Z(playerPos.z)); c.lineTo(X(objective.x), Z(objective.z)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#ffd76a';
      c.save(); c.translate(X(objective.x), Z(objective.z)); c.rotate(Math.PI / 4); c.fillRect(-9, -9, 18, 18); c.restore();
    }
    // player arrow
    c.save(); c.translate(X(playerPos.x), Z(playerPos.z));
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(-8, 9); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#f5ead0'; c.font = 'bold 16px Arial'; c.textAlign = 'right';
    c.fillText('N ↑', W - 12, Hh - 12);
  };

  H.fillTitle = () => {
    const done = G.missionsDone.length;
    $('title-story-count').textContent = `${done}/8`;
    $('title-continue').innerHTML = `MISSION ${G.currentMission + 1} · ${G.missionList[G.currentMission].name.toUpperCase()}<br>$${Math.floor(G.money).toLocaleString()} · REP ${G.rep} · DAY ${G.time.day}<br>${Math.round(G.completion())}% COMPLETE`;
    $('title-job').innerHTML = `<b style="color:#ffd76a">${G.missionList[G.currentMission].name.toUpperCase()}</b> — ${G.missionList[G.currentMission].blurb}<br>$${G.missionList[G.currentMission].reward.toLocaleString()} · ${G.missionList[G.currentMission].where}`;
    $('title-missions').innerHTML = G.missionList.map((m, i) => {
      const cls = G.missionsDone.includes(i) ? 'done' : i === G.currentMission ? 'now' : 'locked';
      const st = G.missionsDone.includes(i) ? '✓ DONE' : i === G.currentMission ? '▶ NOW' : '🔒 LOCKED';
      return `<div class="mrow ${cls}"><span>${i + 1}. ${m.name}</span><span>$${m.reward.toLocaleString()} · ${st}</span></div>`;
    }).join('');
    const control = Math.round(DISTRICTS.reduce((a, d) => a + G.districtStanding[d.id], 0) / DISTRICTS.length);
    $('title-control').textContent = `${control}%`;
    $('title-districts').innerHTML = DISTRICTS.map((d) => {
      const v = G.districtStanding[d.id];
      const st = v >= 60 ? 'FRIENDLY' : v >= 40 ? 'NEUTRAL' : 'HOSTILE';
      const col = v >= 60 ? '#7fd08a' : v >= 40 ? '#ffd76a' : '#ff8a7a';
      return `<div class="dbar"><span class="nm">${d.name}</span><div class="track"><div style="width:${v}%;background:${col}"></div></div><span>${v}%</span><span class="st" style="color:${col}">${st}</span></div>`;
    }).join('');
    $('title-crew-count').textContent = `${G.crewCount()}/6`;
    $('title-crew').innerHTML = G.crewList.map((c) => {
      const got = G.crew[c.id];
      return `<div class="crewrow"><div class="face" style="background:${got ? '#ffd76a' : '#3a4a5a'}">${c.name[0]}</div><div><b>${c.name}</b> ${got ? '' : '· NOT RECRUITED'}<div class="role">${c.role}</div></div></div>`;
    }).join('');
    $('title-skills').innerHTML = G.skillList.map((s) => {
      const lv = G.skills[s.id];
      return `<div class="mrow"><span>${s.name}</span><span class="pips">${'●'.repeat(lv)}${'○'.repeat(6 - lv)}</span></div>`;
    }).join('');
    $('title-heist').innerHTML = `ELECTION NIGHT · City Hall — $8,888<br>` + G.crewList.map((c) => `${c.name} · ${c.role} — ${c.cut}%`).join('<br>');
    $('title-stats').innerHTML = `
      <span>Cars stolen</span><b>${G.stats.carsStolen}</b>
      <span>Takedowns</span><b>${G.stats.takedowns}</b>
      <span>Escapes</span><b>${G.stats.escapes}</b>
      <span>Time played</span><b>${G.playTime()}</b>
      <span>Stunt jumps</span><b>${G.stats.jumps}</b>
      <span>Best wanted</span><b>${'★'.repeat(G.stats.bestWanted)}${'☆'.repeat(5 - G.stats.bestWanted)}</b>
      <span>Gold Bars</span><b>${G.goldBars}/20</b>
      <span>Properties</span><b>${G.propertyCount()}/3</b>`;
    $('map-legend').innerHTML = `<span><b>◆</b> Mission</span><span><b>▲</b> You — Eli</span><span><b>●</b> Location</span><span><b>■</b> Gold Bar</span><span><b>H</b> Safehouse</span><span><b>G</b> Garage</span><span><b>P</b> VBPD HQ</span><span><b>$</b> Property income</span>`;
  };

  return H;
}
