// Velora Bay — tools/playtest.mjs
// Headless end-to-end playtest via Chrome DevTools Protocol.
// Launches Chrome (small window so SwiftShader stays fast), loads the game
// from serve.ts (http://localhost:8080 — start it first), and drives all
// 8 missions to completion with simulated frames.
// Usage: node tools/playtest.mjs [--url http://localhost:8080/]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/opt/meta-chromium/chrome';
const DOMAINS_FILE = '/home/hatch/workspace/makefun/webgl-domains.txt';
const DOMAINS_SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';
const PORT = 9333;
const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://localhost:8080/';

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=' + PORT,
  '--window-size=480,270',
  '--hatch-webgl-allowed-domains-file=' + DOMAINS_FILE,
  '--hatch-webgl-allowed-domains-sha256=' + DOMAINS_SHA,
  '--allow-file-access-from-files',
  '--enable-unsafe-swiftshader',
  'about:blank'
], { stdio: 'ignore' });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(500);
  }
  throw new Error('Chrome DevTools not reachable');
}

// Minimal CDP client over Node's built-in WebSocket
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    };
  }
  call(method, params) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async eval(expr) {
    const r = await this.call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result ? r.result.value : undefined;
  }
}

const TEST_SCRIPT = `
(function () {
  const R = [];
  function check(name, cond, extra) { R.push({ name, pass: !!cond, extra: extra || '' }); }
  function step(n) { for (let i = 0; i < n; i++) __game.step(1 / 60); }
  function walkTo(x, z, timeoutS) {
    const maxSteps = (timeoutS || 30) * 60;
    for (let i = 0; i < maxSteps; i++) {
      const dx = x - VB.player.pos.x, dz = z - VB.player.pos.z;
      if (Math.hypot(dx, dz) < 2.5) { VB.input.release('KeyW'); return true; }
      VB.player.setCamera(Math.atan2(dx, dz), 0.32, 7.5);
      VB.input.press('KeyW');
      __game.step(1 / 60);
    }
    VB.input.release('KeyW');
    return false;
  }
  function driveTo(x, z, timeoutS) {
    const maxSteps = (timeoutS || 40) * 60;
    for (let i = 0; i < maxSteps; i++) {
      const car = VB.player.currentVehicle;
      if (!car) return false;
      const dx = x - car.group.position.x, dz = z - car.group.position.z;
      if (Math.hypot(dx, dz) < 4) { VB.input.release('KeyW'); VB.input.release('KeyA'); VB.input.release('KeyD'); return true; }
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      VB.input.press('KeyW');
      if (diff > 0.15) { VB.input.press('KeyA'); VB.input.release('KeyD'); }
      else if (diff < -0.15) { VB.input.press('KeyD'); VB.input.release('KeyA'); }
      else { VB.input.release('KeyA'); VB.input.release('KeyD'); }
      __game.step(1 / 60);
    }
    VB.input.release('KeyW'); VB.input.release('KeyA'); VB.input.release('KeyD');
    return false;
  }
  function killAllThugsWithPistol() {
    VB.combat.setWeapon('pistol');
    let guard = 0;
    while (VB.combat.thugsAlive() > 0 && guard++ < 40) {
      const th = VB.combat.thugs.find((t) => !t.dead);
      if (!th) break;
      if (!walkTo(th.x, th.z, 20)) break;
      for (let s = 0; s < 6 && !th.dead; s++) { VB.combat.fire(); step(20); }
    }
    return VB.combat.thugsAlive() === 0;
  }
  try {
    VB.state.headless = true;
    // 1. boot
    check('boot: title mode', VB.state.mode === 'title');
    check('layout: 0 violations', VB.world.layoutViolations.length === 0, JSON.stringify(VB.world.layoutViolations));
    check('layout: 33 buildings + 12 skyline', VB.world.LAYOUT.buildings.length === 33 && VB.world.LAYOUT.skyline.length === 12);
    // 2. new game + M1 intro
    __game.start();
    step(5);
    check('new game: mode playing, M1', VB.state.mode === 'playing' && VB.state.missionIdx === 0);
    check('M1 intro dialogue shows', VB.missions.dialogueActive());
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue();
    check('M1 intro dismissed', !VB.missions.dialogueActive());
    // 3. driving: enter Saw, drive 3s
    VB.player.resetTo(-10, 2.5, Math.PI / 2);
    VB.input.press('KeyE'); step(5);
    check('enter Saw', !!VB.player.currentVehicle);
    const sx0 = VB.player.currentVehicle.group.position.x;
    VB.input.press('KeyW'); step(180); VB.input.release('KeyW');
    const sx1 = VB.player.currentVehicle.group.position.x;
    check('driving: Saw moved 40m+ east', (sx1 - sx0) > 40, 'dx=' + (sx1 - sx0).toFixed(1));
    check('driving: speed > 60 km/h', VB.state.speedKmh > 60, 'kmh=' + VB.state.speedKmh);
    VB.input.press('KeyF'); step(5);
    check('exit vehicle', !VB.player.currentVehicle);
    // 4. weapon wheel
    VB.combat.openWheel();
    check('wheel opens, slow-mo 0.16x', VB.combat.wheelOpen && VB.state.timeScale === 0.16);
    VB.combat.closeWheel();
    check('wheel closes, timescale 1', !VB.combat.wheelOpen && VB.state.timeScale === 1);
    // 5. M1: crate
    VB.player.resetTo(-63, -20, 0);
    check('M1 goto crate', walkTo(-58, -20, 25));
    step(60);
    VB.input.press('KeyE'); step(5);
    step(60);
    check('M1 crate picked, stage 2', VB.missions.stageIdx() === 2 || VB.state.missionIdx === 1, 'stage=' + VB.missions.stageIdx() + ' m=' + VB.state.missionIdx);
    check('M1 escape to Blvd', walkTo(-40, 0, 25));
    step(90);
    check('M1 complete -> M2', VB.state.missionIdx === 1, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    check('pistol unlocked after M1', VB.state.weapons.pistol.unlocked);
    // 6. pistol shoot + reload
    VB.combat.setWeapon('pistol');
    const ammo0 = VB.state.weapons.pistol.ammo;
    VB.combat.fire(); step(5);
    check('pistol fires, ammo 12->11', VB.state.weapons.pistol.ammo === ammo0 - 1, 'ammo=' + VB.state.weapons.pistol.ammo);
    VB.combat.reload();
    check('reload restores ammo', VB.state.weapons.pistol.ammo === 12, 'ammo=' + VB.state.weapons.pistol.ammo);
    // 7. gold bar pickup
    const g0 = VB.state.goldBars;
    VB.player.resetTo(-63, -18, 0);
    step(30);
    check('gold bar pickup', VB.state.goldBars === g0 + 1, 'gold=' + VB.state.goldBars);
    // 8. map open/close
    VB.hud.openMap('map'); step(5);
    check('map opens', VB.state.mode === 'map');
    VB.hud.closeMap(); step(5);
    check('map closes', VB.state.mode === 'playing');
    // 9. M2: pier + 3 thugs + Tommy
    check('M2 goto pier', walkTo(-72, 24, 30));
    step(60);
    check('M2 thugs spawned', VB.combat.thugsAlive() === 3, 'alive=' + VB.combat.thugsAlive());
    check('M2 defeat 3 thugs', killAllThugsWithPistol());
    step(90);
    check('M2 talk to Tommy', walkTo(-70, 22, 20));
    VB.input.press('KeyE'); step(5); step(90);
    check('M2 complete -> M3', VB.state.missionIdx === 2, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    // 10. M3: truck, checkpoint, warehouse
    check('M3 goto truck', walkTo(-70, -22, 30));
    VB.input.press('KeyE'); step(5);
    check('M3 in truck', !!VB.player.currentVehicle);
    step(30);
    check('M3 driveThru checkpoint', driveTo(-10, 0, 40));
    step(90);
    check('M3 stage 2 (driveTo warehouse)', VB.missions.stageIdx() === 2 || VB.state.missionIdx === 3, 'stage=' + VB.missions.stageIdx());
    check('M3 driveTo warehouse', driveTo(5, 24, 40));
    step(90);
    check('M3 complete -> M4', VB.state.missionIdx === 3, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    VB.input.press('KeyF'); step(5);
    // 11. M4: site, guards, cable, escape
    check('M4 goto site', walkTo(5, 24, 30));
    step(60);
    check('M4 defeat 2 guards', killAllThugsWithPistol());
    step(90);
    check('M4 goto cable', walkTo(8, 30, 20));
    VB.input.press('KeyE'); step(5); step(90);
    check('M4 escape', walkTo(20, 0, 25));
    step(90);
    check('M4 complete -> M5', VB.state.missionIdx === 4, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    check('rifle unlocked after M4', VB.state.weapons.rifle.unlocked);
    // 12. M5: tower, stealth, ledger, safehouse
    check('M5 goto tower', walkTo(35, -18, 30));
    step(60);
    check('M5 stealth to tower door', walkTo(35, -24, 20));
    step(60);
    VB.input.press('KeyE'); step(5); step(90);
    check('M5 escape to safehouse', walkTo(35, 18, 25));
    step(90);
    check('M5 complete -> M6', VB.state.missionIdx === 5, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    check('safehouse owned after M5', VB.state.properties.safehouse);
    // 13. M6: rally 3 districts
    check('M6 rally Center', walkTo(-27, 0, 30));
    VB.input.press('KeyE'); step(5); step(90);
    check('M6 rally Marina', walkTo(35, 0, 30));
    VB.input.press('KeyE'); step(5); step(90);
    check('M6 rally Beach', walkTo(64, 0, 30));
    VB.input.press('KeyE'); step(5); step(90);
    check('M6 complete -> M7', VB.state.missionIdx === 6, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    check('M6 crew recruited (Dina/Marv/Kofi)', VB.state.crew.dina && VB.state.crew.marv && VB.state.crew.kofi);
    // 14. M7: debate + chase
    check('M7 goto debate', walkTo(-27, -24, 30));
    step(60);
    check('M7 debate dialogue shows', VB.missions.dialogueActive());
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(60);
    check('M7 chase stage, wanted 5', VB.missions.stageIdx() === 1 && VB.state.wanted === 5, 'stage=' + VB.missions.stageIdx() + ' wanted=' + VB.state.wanted);
    check('M7 heli visible', !!(VB.ai.heli && VB.ai.heli.visible));
    check('M7 6 police units', VB.ai.units.length === 6, 'units=' + VB.ai.units.length);
    check('M7 goto Saw', walkTo(-10, 2.5, 30));
    VB.input.press('KeyE'); step(5);
    check('M7 in Saw', !!VB.player.currentVehicle);
    check('M7 chase to marina', driveTo(60, 0, 45));
    step(90);
    check('M7 complete -> M8', VB.state.missionIdx === 7, 'm=' + VB.state.missionIdx);
    VB.missions.advanceDialogue(); VB.missions.advanceDialogue(); step(10);
    VB.input.press('KeyF'); step(5);
    // 15. M8: defend 3 boxes + City Hall -> win
    check('M8 box 1 Portside', walkTo(-63, 0, 30));
    step(60);
    check('M8 defend box 1', killAllThugsWithPistol());
    step(90);
    check('M8 box 2 Center', walkTo(-27, 0, 30));
    step(60);
    check('M8 defend box 2', killAllThugsWithPistol());
    step(90);
    check('M8 box 3 Marina', walkTo(35, 0, 30));
    step(60);
    check('M8 defend box 3', killAllThugsWithPistol());
    step(90);
    check('M8 goto City Hall', walkTo(-27, -24, 30));
    step(120);
    check('WIN screen', VB.state.mode === 'win', 'mode=' + VB.state.mode);
    check('win: 8/8 missions', VB.state.completed.length === 8, 'done=' + VB.state.completed.length);
    // 16. save/load
    VB.save.write(1);
    const sum = VB.save.summary(1);
    check('save slot 1 written', !!sum && sum.missions === 8, JSON.stringify(sum));
    const d = VB.save.read(1);
    check('save round-trips money', d && d.money === VB.state.money, 'saved=' + (d && d.money) + ' now=' + VB.state.money);
  } catch (e) {
    R.push({ name: 'EXCEPTION', pass: false, extra: String(e && e.stack || e).slice(0, 500) });
  }
  return JSON.stringify({ results: R, state: __game.state() });
})()
`;

async function main() {
  try {
    const wsUrl = await getWsUrl();
    const cdp = new CDP(wsUrl);
    await cdp.ready;
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Page.navigate', { url });
    // wait for __ready
    let ready = false;
    for (let i = 0; i < 120; i++) {
      await sleep(1000);
      try {
        ready = await cdp.eval('window.__ready === true');
        if (ready) break;
      } catch (e) { /* page not ready */ }
    }
    if (!ready) {
      const err = await cdp.eval('document.title + " | " + (window.__error || "no __ready")');
      console.log('GAME DID NOT BOOT:', err);
      const logs = await cdp.eval('window.__errors ? window.__errors.join("\\n") : "n/a"');
      console.log('errors:', logs);
      process.exitCode = 2;
      return;
    }
    console.log('game booted, running playtest (this takes a few minutes)...');
    const out = await cdp.eval(TEST_SCRIPT);
    const data = JSON.parse(out);
    let pass = 0, fail = 0;
    for (const r of data.results) {
      if (r.pass) { pass++; console.log('PASS  ' + r.name); }
      else { fail++; console.log('FAIL  ' + r.name + (r.extra ? '  [' + r.extra + ']' : '')); }
    }
    console.log(`\n${pass}/${pass + fail} PASS`);
    console.log('final state:', JSON.stringify(data.state));
    writeFileSync('/tmp/velora-playtest.json', JSON.stringify(data, null, 2));
    process.exitCode = fail === 0 ? 0 : 1;
  } catch (e) {
    console.error('PLAYTEST ERROR:', e);
    process.exitCode = 2;
  } finally {
    chrome.kill();
  }
}
main();
