// Velora Bay — HUD (vanilla JS + DOM + canvas).
// Mission card, money/REP, wanted stars, minimap (cropped live map),
// HP/armor bars, weapon bar, speedometer, dialogue, toasts, K-9 panel,
// radio label, GTA-style weapon wheel (Tab, slow-mo), 3-column map screen,
// title screen, win screen. No debug nav buttons anywhere.
import * as L from './layout.js';
import { MISSIONS, CREW, SKILLS } from './missions.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export const HUD = {
  wheelOpen: false, wheelSel: 1, mapOpen: false, titleOpen: true,
  time: 0,
};

const WEAPONS = [
  { id: 'fists', name: 'FISTS', icon: '\u270A', ammo: '\u221E', dmg: 22 },
  { id: 'hammer', name: 'HAMMER', icon: '\u2692', ammo: '\u221E', dmg: 35 },
  { id: 'pistol', name: 'PISTOL', icon: '\uD83D\uDD2B', ammo: '12/48', dmg: 34 },
  { id: 'rifle', name: 'RIFLE', icon: '\uD83C\uDFAF', ammo: '0/90', dmg: 55, locked: true },
];

export function buildHUD(G) {
  const root = el('div', 'hud-root');
  root.innerHTML = `
  <div id="mission-card" class="panel"><div class="mc-act" id="mc-act"></div><div class="mc-title" id="mc-title"></div><div class="mc-obj" id="mc-obj"></div><div class="mc-stage" id="mc-stage"></div><div class="mc-bar"><div id="mc-fill"></div></div></div>
  <div id="money-panel" class="panel"><div id="money">$4,120</div><div id="rep-line">REP 1240 · LV 4 FIXER</div><div id="next-line">NEXT AT: ARMORED TRUCK</div></div>
  <div id="wanted-panel" class="panel"><div id="stars"></div><div id="vbpd">VBPD RESPONSE · 0 UNITS IN PURSUIT</div><div id="dispatch"></div></div>
  <div id="minimap-wrap"><canvas id="minimap" width="220" height="220"></canvas><div id="hp-armor"><div class="bar-row"><span>HP</span><div class="bar"><div id="hp-fill"></div></div><b id="hp-num">100</b></div><div class="bar-row"><span>ARMOR</span><div class="bar"><div id="armor-fill"></div></div><b id="armor-num">0</b></div><div id="gold-line">GOLD <b id="gold-num">9/20</b> <span id="income">+$50/min</span></div></div></div>
  <div id="weapon-bar"></div>
  <div id="speedo"><div id="speed-num">0</div><div id="speed-unit">KM/H</div><div id="car-name">THE GOLDEN SAW</div><div id="car-cond">CONDITION 100% · FUEL 62%</div></div>
  <div id="dialogue"><div id="dlg-name"></div><div id="dlg-text"></div></div>
  <div id="toasts"></div>
  <div id="k9-panel">\uD83D\uDC15 BARNABY <span id="k9-state">FOLLOWING</span></div>
  <div id="radio">\u266A VELORA FM 101.2 — GOLDEN HOUR MIX</div>
  <div id="hint">WASD move · Shift run · Space jump · F enter/exit · E interact · 1-4 weapons · Tab wheel · M map · Esc pause</div>
  <div id="interact-prompt"></div>
  <div id="slowmo-chip">SLOW-MO</div>
  <div id="wheel"><svg id="wheel-svg" viewBox="0 0 300 300"></svg><div id="wheel-center"></div></div>
  <div id="map-screen"></div>
  <div id="title-screen"></div>
  <div id="win-screen"></div>
  <div id="pause-screen"><div class="pause-box"><h2>PAUSED</h2><p>ESC to resume · M for map</p></div></div>`;
  document.body.appendChild(root);
  buildWeaponBar(G);
  buildWheel();
  buildTitle(G);
  updateHUD(G, 0);
}

function buildWeaponBar(G) {
  const bar = $('weapon-bar');
  bar.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const d = el('div', 'wslot' + (G.weapon === w.id ? ' sel' : '') + (w.locked ? ' locked' : ''));
    d.innerHTML = `<span class="wicon">${w.icon}</span> ${w.name} <b>${w.ammo}</b>${w.locked ? ' · LOCKED' : ''}${G.weapon === w.id ? ' <span class="dot">●</span>' : ''}`;
    d.onclick = () => { if (!w.locked) { G.setWeapon(w.id); updateHUD(G, 0); } };
    bar.appendChild(d);
  });
}

function buildWheel() {
  const svg = $('wheel-svg');
  const cx = 150, cy = 150, R = 120, r = 52;
  let html = '';
  WEAPONS.forEach((w, i) => {
    const a0 = (i * 90 - 45) * Math.PI / 180, a1 = (i * 90 + 45) * Math.PI / 180;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a0) * R, y1 = cy + Math.sin(a0) * R;
    const x2 = cx + Math.cos(a1) * R, y2 = cy + Math.sin(a1) * R;
    const x3 = cx + Math.cos(a1) * r, y3 = cy + Math.sin(a1) * r;
    html += `<path class="wseg" data-i="${i}" d="M${x0},${y0} L${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 0 0 ${x0},${y0} Z" fill="${w.locked ? '#1a2233' : '#22304a'}" stroke="#e8c25a" stroke-width="1.5"/>`;
    const mx = cx + Math.cos((a0 + a1) / 2) * 86, my = cy + Math.sin((a0 + a1) / 2) * 86;
    html += `<text class="wseg-t" data-i="${i}" x="${mx}" y="${my - 4}" text-anchor="middle" fill="${w.locked ? '#5a6a80' : '#ffe9b0'}" font-size="22">${w.icon}</text>`;
    html += `<text class="wseg-t" data-i="${i}" x="${mx}" y="${my + 16}" text-anchor="middle" fill="${w.locked ? '#5a6a80' : '#ffffff'}" font-size="11">${w.name}${w.locked ? ' · LOCKED' : ''}</text>`;
    html += `<text class="wseg-t" data-i="${i}" x="${mx}" y="${my + 30}" text-anchor="middle" fill="#e8c25a" font-size="10">${w.ammo}</text>`;
  });
  svg.innerHTML = html;
  svg.querySelectorAll('.wseg, .wseg-t').forEach((n) => {
    n.addEventListener('mousemove', () => { HUD.wheelSel = +n.dataset.i; paintWheel(); });
    n.addEventListener('click', () => { confirmWheel(G_REF); });
  });
}
let G_REF = null;
function paintWheel() {
  const svg = $('wheel-svg');
  svg.querySelectorAll('.wseg').forEach((p) => {
    const i = +p.dataset.i;
    p.setAttribute('fill', i === HUD.wheelSel ? '#e8c25a' : (WEAPONS[i].locked ? '#1a2233' : '#22304a'));
  });
  const w = WEAPONS[HUD.wheelSel];
  $('wheel-center').innerHTML = `<b>${w.name}</b><span>DMG ${w.dmg}${w.locked ? ' · UNLOCKS M4' : ''}</span>`;
}
export function openWheel(G) {
  G_REF = G;
  HUD.wheelOpen = true; HUD.wheelSel = WEAPONS.findIndex((w) => w.id === G.weapon);
  $('wheel').style.display = 'block'; $('slowmo-chip').style.display = 'block';
  paintWheel();
}
export function closeWheel(G, confirm) {
  if (!HUD.wheelOpen) return;
  HUD.wheelOpen = false;
  $('wheel').style.display = 'none'; $('slowmo-chip').style.display = 'none';
  if (confirm) confirmWheel(G);
}
function confirmWheel(G) {
  const w = WEAPONS[HUD.wheelSel];
  if (w && !w.locked && G) G.setWeapon(w.id);
  buildWeaponBar(G);
}

// --- minimap + map drawing (same geographic map, cropped for minimap) ---
function drawMapBase(ctx, W, H, view, G) {
  // view: {x0,z0,x1,z1} world rect mapped onto the canvas
  const X = (x) => ((x - view.x0) / (view.x1 - view.x0)) * W;
  const Z = (z) => ((z - view.z0) / (view.z1 - view.z0)) * H;
  ctx.fillStyle = '#1d2f45'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2a7f9e'; ctx.fillRect(0, Z(150), W, H - Z(150)); // sea south
  ctx.fillStyle = '#e8d9a0'; ctx.fillRect(0, Z(110), W, Z(150) - Z(110)); // beach
  // district tints
  for (const d of L.DISTRICTS) {
    ctx.fillStyle = d.color + '22';
    ctx.fillRect(X(d.x0), Z(d.z0), X(d.x1) - X(d.x0), Z(d.z1) - Z(d.z0));
  }
  // roads
  ctx.fillStyle = '#3a3f4a';
  for (const r of L.ROADS) {
    const rr = L.roadRect(r);
    ctx.fillRect(X(rr.x0), Z(rr.z0), X(rr.x1) - X(rr.x0), Z(rr.z1) - Z(rr.z0));
  }
  // GPS route to mission target
  if (G && G.objective && G.objective.target) {
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(X(G.player.x), Z(G.player.z));
    ctx.lineTo(X(G.objective.target.x), Z(G.objective.target.z));
    ctx.stroke(); ctx.setLineDash([]);
  }
  // POIs
  for (const p of L.POIS) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(X(p.x), Z(p.z), 3, 0, 7); ctx.fill();
  }
  // gold bars
  if (G) {
    ctx.fillStyle = '#fff200';
    for (const g of L.GOLD_BARS) {
      if (G.goldCollected.has(g.x + ',' + g.z)) continue;
      ctx.fillRect(X(g.x) - 2, Z(g.z) - 2, 4, 4);
    }
  }
  // police
  if (G && G.police) {
    ctx.fillStyle = '#ff4444';
    for (const u of G.police.units) {
      if (!u.active) continue;
      ctx.beginPath(); ctx.arc(X(u.x), Z(u.z), 3.5, 0, 7); ctx.fill();
    }
  }
  // player arrow (north up, rotated by facing)
  if (G) {
    ctx.save();
    ctx.translate(X(G.player.x), Z(G.player.z));
    ctx.rotate(G.player.yaw || 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return { X, Z };
}

export function drawMinimap(G) {
  const c = $('minimap');
  if (!c) return;
  const ctx = c.getContext('2d');
  const R = 70; // world units visible around the player
  const view = { x0: G.player.x - R, x1: G.player.x + R, z0: G.player.z - R, z1: G.player.z + R };
  drawMapBase(ctx, c.width, c.height, view, G);
  // circular mask border
  ctx.strokeStyle = '#e8c25a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(110, 110, 108, 0, 7); ctx.stroke();
  ctx.fillStyle = '#e8c25a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('N', 110, 16);
}

export function drawFullMap(G) {
  const c = $('fullmap');
  if (!c) return;
  const ctx = c.getContext('2d');
  const view = { x0: -200, x1: 200, z0: -150, z1: 150 };
  const { X, Z } = drawMapBase(ctx, c.width, c.height, view, G);
  // grid A-F / 1-6
  ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1;
  ctx.fillStyle = '#ffffff88'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 6; i++) {
    const gx = X(-200 + i * 66.7);
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, c.height); ctx.stroke();
    ctx.fillText('ABCDEF'[i], gx + 33, 12);
    const gz = Z(-150 + i * 50);
    ctx.beginPath(); ctx.moveTo(0, gz); ctx.lineTo(c.width, gz); ctx.stroke();
    ctx.fillText(String(i + 1), 10, gz + 25);
  }
  // district labels on dark pills
  ctx.font = 'bold 12px sans-serif';
  for (const d of L.DISTRICTS) {
    const cx = X((d.x0 + d.x1) / 2), cz = Z((d.z0 + d.z1) / 2);
    const w = ctx.measureText(d.name.toUpperCase()).width + 14;
    ctx.fillStyle = '#0f1c2bcc'; ctx.fillRect(cx - w / 2, cz - 10, w, 20);
    ctx.fillStyle = '#ffd700'; ctx.fillText(d.name.toUpperCase(), cx, cz + 4);
  }
  // POI labels (flip left near the right edge)
  ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
  for (const p of L.POIS) {
    const px = X(p.x), pz = Z(p.z);
    const flip = px > c.width - 110;
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(p.name, flip ? px - 108 : px + 7, pz + 3);
  }
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('N \u2191', c.width - 8, 16);
}

// --- map screen (3-column Velmara layout, GTA geographic map) ---
export function buildMapScreen(G) {
  const ms = $('map-screen');
  const m = G.mission ? MISSIONS[G.mission.index] : null;
  const done = G.completed.length;
  const pct = Math.round((done / 8) * 100);
  const crewHtml = CREW.map((c) => `<div class="crew-row"><span class="crew-ini">${c.initial}</span><div><b>${c.name}</b><span>${c.role}</span></div></div>`).join('');
  const skillHtml = SKILLS.map((s) => `<div class="skill-row"><span>${s.name}</span><span class="pips">${'●'.repeat(G.skills[s.id] || 1)}${'○'.repeat(6 - (G.skills[s.id] || 1))}</span></div>`).join('');
  const storyHtml = MISSIONS.map((mm) => `<div class="story-row"><span>${mm.id}. ${mm.name}</span><b>$${mm.payout.toLocaleString()} ${G.completed.includes(mm.id) ? '✓ DONE' : (m && m.id === mm.id ? '▶ NOW' : '· LOCKED')}</b></div>`).join('');
  ms.innerHTML = `<div class="map-cols">
    <div class="map-col left">
      <h1>VELORA BAY</h1><div class="tagline">FROM SAWDUST TO CITY HALL — ONE CITY. ONE CREW. ONE LAST STAND.</div>
      <div class="panel"><h3>CONTINUE</h3><div class="big">${m ? 'MISSION ' + m.id + ' · ' + m.name.toUpperCase() : 'FREE ROAM'}</div><div>$${G.money.toLocaleString()} · REP ${G.rep} · DAY ${G.day}</div><div>${pct}% COMPLETE</div><button class="gold-btn" id="btn-continue">▶ CONTINUE</button><button class="dark-btn" id="btn-start">START ENGINE</button></div>
      <div class="panel"><h3>CURRENT JOB</h3><div><b>${m ? m.name.toUpperCase() : '—'}</b> — ${m ? m.intro : 'Explore Velora Bay.'}</div><div>${m ? '$' + m.payout.toLocaleString() : ''}</div></div>
      <div class="panel"><h3>STORY · ${done}/8 MISSIONS</h3>${storyHtml}</div>
    </div>
    <div class="map-col centre">
      <h3>VELORA BAY · CITY MAP</h3>
      <canvas id="fullmap" width="560" height="380"></canvas>
      <div class="legend">◆ Mission &nbsp; ▲ You — Eli &nbsp; ● Location &nbsp; ■ Gold Bar &nbsp; H Safehouse &nbsp; G Garage &nbsp; P VBPD HQ &nbsp; $ Property income</div>
      <div class="panel"><h3>DISTRICT CONTROL · ${Math.round(L.DISTRICTS.reduce((a, d) => a + d.standing, 0) / 5)}% OVERALL</h3>${L.DISTRICTS.map((d) => `<div class="dc-row"><span>${d.name}</span><div class="dc-bar"><div style="width:${d.standing}%"></div></div><b>${d.standing}%</b><span class="${d.standing >= 70 ? 'friendly' : d.standing >= 55 ? 'wary' : 'neutral'}">${d.standing >= 70 ? 'FRIENDLY' : d.standing >= 55 ? 'WARY' : 'NEUTRAL'}</span></div>`).join('')}</div>
    </div>
    <div class="map-col right">
      <div class="panel"><h3>CREW · 6/6</h3>${crewHtml}</div>
      <div class="panel"><h3>SKILLS</h3>${skillHtml}</div>
      <div class="panel"><h3>HEIST BOARD</h3><div>ELECTION NIGHT · City Hall — $8,888</div><div class="cuts">Eli — Mayor 40% · Tommy 15% · Rosa 10% · Nadia 10% · Marv 10% · Dina 10% · Kofi 5%</div></div>
      <div class="panel"><h3>CAREER STATS</h3><div>Cars stolen ${G.stats.carsStolen} · Takedowns ${G.stats.takedowns} · Escapes ${G.stats.escapes} · Time ${G.stats.timePlayed} · Best wanted ${'★'.repeat(G.stats.bestWanted)}${'☆'.repeat(5 - G.stats.bestWanted)}</div></div>
    </div>
  </div>`;
  $('btn-continue').onclick = () => { HUD.mapOpen = false; ms.style.display = 'none'; };
  $('btn-start').onclick = () => { HUD.mapOpen = false; ms.style.display = 'none'; };
  drawFullMap(G);
}

export function buildTitle(G) {
  const ts = $('title-screen');
  ts.innerHTML = `<div class="title-bg"></div><div class="title-box">
    <h1>VELORA BAY</h1><div class="tagline">FROM SAWDUST TO CITY HALL</div>
    <p class="title-story">A carpenter versus a greedy developer. Reclaim your city. Become its mayor.</p>
    <div class="title-btns"><button class="gold-btn" id="btn-play">▶ START ENGINE</button><button class="dark-btn" id="btn-continue2">CONTINUE — MISSION ${G.currentMission >= 0 ? G.currentMission + 1 : 1}</button></div>
    <div class="title-save">SAVE 01 · DAY ${G.day} · $${G.money.toLocaleString()} · REP ${G.rep} · AUTOSAVE ON</div>
    <div class="title-crew">${CREW.map((c) => `<span class="crew-ini" title="${c.name}">${c.initial}</span>`).join('')}</div>
  </div>`;
  $('btn-play').onclick = () => { HUD.titleOpen = false; ts.style.display = 'none'; G.started = true; };
  $('btn-continue2').onclick = () => { HUD.titleOpen = false; ts.style.display = 'none'; G.started = true; };
}

export function buildWin(G) {
  const ws = $('win-screen');
  ws.innerHTML = `<div class="win-box">
    <h1>ELI BRADDOCK IS MAYOR<br>OF VELORA BAY!</h1>
    <div class="tagline">FROM SAWDUST TO CITY HALL — THE BAY IS YOURS</div>
    <div class="win-cols">
      <div class="panel"><h3>FINAL PAYOUT</h3><div class="big-gold">$8,888</div><div>Missions 8/8 · Gold Bars ${G.goldCollected.size}/20 · Crew 6/6</div><div>Cars stolen ${G.stats.carsStolen} · Takedowns ${G.stats.takedowns} · Escapes ${G.stats.escapes}</div><div>Time played ${G.stats.timePlayed} · Best wanted ${'★'.repeat(Math.max(1, G.stats.bestWanted))}</div></div>
      <div class="panel"><h3>UNLOCKED</h3><div>🏛 CITY HALL — YOUR OFFICE</div><div>🚗 THE GOLDEN SAW — FULLY RESTORED</div><div>👥 CREW 6/6 — THE COALITION STANDS</div><div>🐕 BARNABY — FIRST DOG OF VELORA BAY</div></div>
      <div class="panel"><h3>THE CREW</h3>${CREW.map((c) => `<div class="crew-row"><span class="crew-ini">${c.initial}</span><div><b>${c.name}</b><span>${c.role}</span></div></div>`).join('')}</div>
    </div>
    <div class="title-btns"><button class="gold-btn" id="btn-freeroam">KEEP EXPLORING — FREE ROAM</button><button class="dark-btn" id="btn-totitle">BACK TO TITLE</button></div>
  </div>`;
  $('btn-freeroam').onclick = () => { ws.style.display = 'none'; G.win = false; };
  $('btn-totitle').onclick = () => { ws.style.display = 'none'; buildTitle(G); $('title-screen').style.display = 'flex'; HUD.titleOpen = true; };
}

export function toast(G, text) {
  const t = el('div', 'toast', text);
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

export function updateHUD(G, dt) {
  HUD.time += dt;
  const m = G.mission ? MISSIONS[G.mission.index] : null;
  $('mc-act').textContent = m ? 'ACT ' + m.act + ' — ' + (m.act === 1 ? 'ASH' : m.act === 2 ? 'WOOD & CONCRETE' : 'CITY HALL') : 'FREE ROAM';
  $('mc-title').textContent = m ? 'MISSION ' + m.id + ' · ' + m.name.toUpperCase() : 'VELORA BAY';
  $('mc-obj').textContent = G.objective ? G.objective.text : (m ? m.intro : 'Explore the city.');
  $('mc-stage').textContent = G.objective ? 'STAGE ' + G.objective.stage + '/' + G.objective.total + ' · ' + G.objective.dist + 'm' : '';
  $('mc-fill').style.width = G.objective ? Math.round((G.objective.stage / G.objective.total) * 100) + '%' : '0%';
  $('money').textContent = '$' + G.money.toLocaleString();
  $('rep-line').textContent = 'REP ' + G.rep + ' · LV ' + (1 + Math.floor(G.rep / 400)) + ' ' + (G.rep < 200 ? 'ROOKIE' : G.rep < 800 ? 'FIXER' : G.rep < 2000 ? 'MADE MAN' : 'KING OF THE BAY');
  $('next-line').textContent = 'NEXT AT: ' + (m ? m.unlock.replace(/^NEXT: /, '') : 'CITY HALL');
  const w = G.police ? G.police.wanted : 0;
  $('stars').innerHTML = '★'.repeat(w) + '☆'.repeat(5 - w);
  const units = G.police ? G.police.units.filter((u) => u.active) : [];
  $('vbpd').textContent = 'VBPD RESPONSE · ' + units.length + ' UNIT' + (units.length === 1 ? '' : 'S') + ' IN PURSUIT';
  $('dispatch').innerHTML = units.slice(0, 3).map((u) => `<div>${u.info.name} · ${u.info.role} · ${Math.round(Math.hypot(u.x - G.player.x, u.z - G.player.z))}m</div>`).join('');
  $('hp-fill').style.width = G.hp + '%';
  $('hp-num').textContent = Math.round(G.hp);
  $('armor-fill').style.width = G.armor + '%';
  $('armor-num').textContent = Math.round(G.armor);
  $('gold-num').textContent = G.goldCollected.size + '/20';
  $('income').textContent = '+$' + G.incomePerMin + '/min';
  buildWeaponBar(G);
  const sp = $('speedo');
  if (G.player.inCar) {
    sp.style.display = 'block';
    $('speed-num').textContent = Math.round(G.carSpeedKmh || 0);
    $('car-cond').textContent = 'CONDITION ' + Math.round(G.carCondition || 100) + '% · FUEL ' + Math.round(G.carFuel || 0) + '%';
  } else sp.style.display = 'none';
  // dialogue
  const dlg = $('dialogue');
  if (G.dialogue && G.time < G.dialogue.until) {
    dlg.style.display = 'block';
    $('dlg-name').textContent = G.dialogue.name;
    $('dlg-text').textContent = G.dialogue.text;
  } else dlg.style.display = 'none';
  $('k9-state').textContent = G.barnabyAlert ? 'K-9 ALERT!' : (G.barnabyGold ? 'GOLD NEARBY!' : 'FOLLOWING');
  $('k9-panel').style.color = G.barnabyAlert ? '#ff6666' : (G.barnabyGold ? '#ffd700' : '#ffe9b0');
  // interact prompt
  const ip = $('interact-prompt');
  if (G.interactLabel) { ip.style.display = 'block'; ip.textContent = G.interactLabel; }
  else ip.style.display = 'none';
  drawMinimap(G);
}
