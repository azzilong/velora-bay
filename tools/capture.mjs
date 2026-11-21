// Velora Bay — tools/capture.mjs
// Captures the 4 submission screenshots via Chrome DevTools Protocol.
// Usage:
//   node tools/capture.mjs [--url http://localhost:8080/] [--width 1280] [--height 720] [--outdir screenshots]
//   node tools/capture.mjs --url file:///home/hatch/workspace/makefun/repos/velora-bay/game/index.html --width 768 --height 480 --outdir screenshots/768
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = '/opt/meta-chromium/chrome';
const DOMAINS_FILE = '/home/hatch/workspace/makefun/webgl-domains.txt';
const DOMAINS_SHA = '8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6';
const PORT = 9334;

const args = process.argv.slice(2);
const get = (name, def) => {
  const a = args.find((x) => x.startsWith('--' + name + '='));
  return a ? a.slice(name.length + 3) : def;
};
const url = get('url', 'http://localhost:8080/');
const width = Number(get('width', '1280'));
const height = Number(get('height', '720'));
const outdir = get('outdir', 'screenshots');

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=' + PORT,
  `--window-size=${width},${height}`,
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

const SHOTS = [
  { name: '1-chase.jpg', stage: '__game.stageChase()' },
  { name: '2-night.jpg', stage: '__game.stageNight()' },
  { name: '3-map.jpg', stage: '__game.stageMap()' },
  { name: '4-title.jpg', stage: '__game.stageTitle()' }
];

async function main() {
  try {
    const wsUrl = await getWsUrl();
    const cdp = new CDP(wsUrl);
    await cdp.ready;
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    // Force the exact viewport: --window-size alone left the headless
    // viewport at 1280x583 (the screenshots came out short, cutting the
    // map screen's bottom row). The override makes the capture truly WxH.
    await cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await cdp.call('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 120; i++) {
      await sleep(1000);
      try { ready = await cdp.eval('window.__ready === true'); if (ready) break; } catch (e) { /* not ready */ }
    }
    if (!ready) {
      console.log('GAME DID NOT BOOT');
      process.exitCode = 2;
      return;
    }
    console.log('game booted at ' + width + 'x' + height + ', capturing...');
    mkdirSync(outdir, { recursive: true });
    for (const shot of SHOTS) {
      await cdp.eval(shot.stage + '; "ok"');
      await sleep(4000); // let SwiftShader render a few frames of the frozen stage
      const state = await cdp.eval('JSON.stringify(__game.state())');
      const img = await cdp.call('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      const buf = Buffer.from(img.data, 'base64');
      const out = join(outdir, shot.name);
      writeFileSync(out, buf);
      console.log(shot.name + '  ' + buf.length + ' bytes  ' + state);
    }
    process.exitCode = 0;
  } catch (e) {
    console.error('CAPTURE ERROR:', e);
    process.exitCode = 2;
  } finally {
    chrome.kill();
  }
}
main();
