// Velora Bay — audio (WebAudio, fully procedural, no assets).
// SFX: footsteps, engine hum, shots, hammer, siren, bark, pickup,
// mission complete. Radio: a soft pad loop under "VELORA FM 101.2".
let AC = null, master = null, radioGain = null, engineOsc = null, engineGain = null;

export function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    radioGain = AC.createGain(); radioGain.gain.value = 0.05; radioGain.connect(master);
    // engine: two detuned saws through a lowpass, gain by speed
    engineOsc = AC.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    const o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 58;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    engineGain = AC.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(lp); o2.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); o2.start();
    // radio pad: slow chord arpeggio
    const notes = [220, 261.6, 329.6, 392];
    notes.forEach((f, i) => {
      const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = AC.createGain(); g.gain.value = 0.25;
      const lfo = AC.createOscillator(); lfo.frequency.value = 0.11 + i * 0.05;
      const lg = AC.createGain(); lg.gain.value = 0.12;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(radioGain); o.start();
    });
  } catch (e) { /* audio unavailable — game still works */ }
}

function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(AC.currentTime + dur);
}
function noise(dur, vol = 0.3, filterFreq = 1200) {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}

export function sfx(name) {
  if (!AC) return;
  try {
    if (AC.state === 'suspended') AC.resume();
    switch (name) {
      case 'shot': noise(0.12, 0.5, 2400); tone(180, 0.08, 'square', 0.2, 60); break;
      case 'hammer': noise(0.08, 0.4, 900); tone(120, 0.1, 'triangle', 0.3, 70); break;
      case 'hit': tone(220, 0.08, 'square', 0.2, 110); break;
      case 'pickup': tone(660, 0.12, 'sine', 0.25); setTimeout(() => tone(990, 0.15, 'sine', 0.25), 90); break;
      case 'complete': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.25), i * 110)); break;
      case 'stage': tone(440, 0.15, 'sine', 0.25); setTimeout(() => tone(660, 0.15, 'sine', 0.25), 120); break;
      case 'bark': tone(300, 0.09, 'square', 0.3, 180); setTimeout(() => tone(320, 0.09, 'square', 0.3, 180), 130); break;
      case 'siren': tone(700, 0.4, 'sine', 0.12, 950); setTimeout(() => tone(950, 0.4, 'sine', 0.12, 700), 400); break;
      case 'carjack': tone(330, 0.1, 'square', 0.25, 220); break;
      case 'click': tone(880, 0.05, 'sine', 0.15); break;
      case 'engine-start': tone(60, 0.5, 'sawtooth', 0.2, 160); break;
      case 'alarm': tone(1200, 0.2, 'square', 0.15, 900); break;
    }
  } catch (e) { /* ignore */ }
}

export function setEngine(running, speedNorm) {
  if (!engineGain || !engineOsc) return;
  engineGain.gain.value = running ? 0.05 + speedNorm * 0.09 : 0;
  engineOsc.frequency.value = 55 + speedNorm * 90;
}
