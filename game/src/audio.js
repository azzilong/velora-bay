// VELORA BAY — AUDIO
// Procedural WebAudio sound effects (no audio assets, no network):
// engine hum, shots, melee swing, hits, siren, bark, rewards, crashes.
// A tiny radio: VELORA FM 101.2 plays a looping golden-hour chord pad.
export function createAudio() {
  let ctx = null;
  let master = null;
  let radioOn = false;
  let radioNodes = null;
  let engineNodes = null;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch { ctx = null; }
  }
  function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol = 0.25, freq = 1200, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const A = {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setVolume(v) { if (master) master.gain.value = v; },
    swing() { noise(0.16, 0.16, 2400); },
    hit() { tone(180, 0.12, 'square', 0.22, 90); noise(0.08, 0.2, 700); },
    shot(w) {
      if (w === 'pistol') { noise(0.14, 0.5, 900); tone(220, 0.1, 'square', 0.25, 60); }
      else { noise(0.2, 0.55, 700); tone(160, 0.14, 'square', 0.3, 50); }
    },
    click() { tone(1200, 0.05, 'square', 0.12); },
    reload() { tone(500, 0.06, 'square', 0.12); tone(700, 0.06, 'square', 0.12, null, 0.12); },
    crash() { noise(0.4, 0.5, 300); tone(90, 0.35, 'sawtooth', 0.25, 40); },
    reward() { tone(880, 0.12, 'sine', 0.2); tone(1318, 0.18, 'sine', 0.2, null, 0.1); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.2, null, i * 0.11)); },
    bark() { tone(300, 0.09, 'square', 0.25, 180); tone(300, 0.09, 'square', 0.25, 180, 0.14); },
    siren() { tone(700, 0.5, 'sine', 0.07, 950); tone(950, 0.5, 'sine', 0.07, 700, 0.5); },
    pickup() { tone(1046, 0.1, 'sine', 0.2); tone(1568, 0.16, 'sine', 0.2, null, 0.08); },
    engine(on) {
      if (!ctx) return;
      if (on && !engineNodes) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        const g = ctx.createGain(); g.gain.value = 0.05;
        o.connect(f); f.connect(g); g.connect(master); o.start();
        engineNodes = { o, f, g };
      } else if (!on && engineNodes) {
        try { engineNodes.o.stop(); } catch { /* already stopped */ }
        engineNodes = null;
      }
    },
    engineSpeed(rpm01) {
      if (engineNodes) {
        engineNodes.o.frequency.value = 50 + rpm01 * 130;
        engineNodes.g.gain.value = 0.03 + rpm01 * 0.05;
      }
    },
    radio(on) {
      if (!ctx) return;
      if (on && !radioOn) {
        radioOn = true;
        const g = ctx.createGain(); g.gain.value = 0.06; g.connect(master);
        const oscs = [];
        // golden-hour pad: Cmaj7 arpeggio loop, slow
        const notes = [261.6, 329.6, 392.0, 493.9, 329.6, 392.0];
        notes.forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
          const og = ctx.createGain(); og.gain.value = 0;
          const LFO = ctx.createOscillator(); LFO.frequency.value = 0.11 + i * 0.03;
          const lg = ctx.createGain(); lg.gain.value = 0.5;
          LFO.connect(lg); lg.connect(og.gain);
          o.connect(og); og.connect(g);
          o.start(); LFO.start();
          oscs.push(o, LFO);
        });
        radioNodes = { g, oscs };
      } else if (!on && radioOn) {
        radioOn = false;
        if (radioNodes) {
          radioNodes.oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
          radioNodes = null;
        }
      }
    },
  };
  return A;
}
