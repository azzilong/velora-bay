// Velora Bay — audio.js
// WebAudio sound effects + radio. All synthesized, no audio files.
(function () {
  'use strict';
  var VB = window.VB;
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var volumes = { master: 0.7, music: 0.4, sfx: 0.8, radio: 0.5 };
  var radioOn = true, radioTimer = null, radioOsc = null, radioOsc2 = null;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = volumes.master; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = volumes.music; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = volumes.sfx; sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(sfxGain);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noise(dur, vol, freq) {
    if (!ensure()) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      var g = ctx.createGain(); g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(sfxGain);
      src.start();
    } catch (e) { /* ignore */ }
  }

  var SFX = {
    shot: function () { noise(0.14, 0.5, 900); tone(160, 0.1, 'square', 0.25, 60); },
    hit: function () { tone(220, 0.08, 'triangle', 0.3, 140); },
    hammer: function () { noise(0.1, 0.4, 500); tone(90, 0.12, 'sine', 0.4, 50); },
    pickup: function () { tone(660, 0.09, 'sine', 0.25); setTimeout(function () { tone(990, 0.14, 'sine', 0.25); }, 90); },
    coin: function () { tone(880, 0.08, 'sine', 0.22); setTimeout(function () { tone(1320, 0.16, 'sine', 0.22); }, 80); },
    mission: function () { tone(523, 0.14, 'triangle', 0.3); setTimeout(function () { tone(659, 0.14, 'triangle', 0.3); }, 130); setTimeout(function () { tone(784, 0.28, 'triangle', 0.3); }, 260); },
    fail: function () { tone(220, 0.25, 'sawtooth', 0.2, 110); },
    click: function () { tone(700, 0.05, 'square', 0.12); },
    siren: function () { tone(700, 0.45, 'sine', 0.1, 950); setTimeout(function () { tone(950, 0.45, 'sine', 0.1, 700); }, 450); },
    bark: function () { tone(300, 0.09, 'square', 0.3, 180); setTimeout(function () { tone(320, 0.09, 'square', 0.3, 170); }, 120); },
    engine: function () { tone(70, 0.3, 'sawtooth', 0.12, 110); },
    crash: function () { noise(0.3, 0.5, 400); tone(60, 0.3, 'sine', 0.4, 35); },
    reload: function () { tone(400, 0.06, 'square', 0.15); setTimeout(function () { tone(500, 0.06, 'square', 0.15); }, 120); },
    carjack: function () { tone(440, 0.1, 'triangle', 0.25); setTimeout(function () { tone(660, 0.18, 'triangle', 0.25); }, 100); },
    alarm: function () { tone(880, 0.2, 'square', 0.15); setTimeout(function () { tone(660, 0.2, 'square', 0.15); }, 200); },
    win: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (n, i) { setTimeout(function () { tone(n, 0.3, 'triangle', 0.3); }, i * 150); });
    }
  };

  var TRACKS = ['Golden Hour Mix', 'Harbor Nights', 'Neon Row Drive', 'Sawdust & Gold'];

  function startRadio() {
    if (!ensure() || !radioOn) return;
    stopRadio();
    try {
      var base = 110;
      radioOsc = ctx.createOscillator(); radioOsc.type = 'triangle'; radioOsc.frequency.value = base;
      radioOsc2 = ctx.createOscillator(); radioOsc2.type = 'sine'; radioOsc2.frequency.value = base * 1.5;
      var g = ctx.createGain(); g.gain.value = 0.05;
      var g2 = ctx.createGain(); g2.gain.value = 0.03;
      radioOsc.connect(g); g.connect(musicGain);
      radioOsc2.connect(g2); g2.connect(musicGain);
      radioOsc.start(); radioOsc2.start();
      var step = 0;
      var scale = [0, 3, 5, 7, 10, 12, 15];
      radioTimer = setInterval(function () {
        if (!radioOsc) return;
        var n = scale[step % scale.length];
        var f = base * Math.pow(2, n / 12);
        try { radioOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05); } catch (e) {}
        step++;
      }, 420);
    } catch (e) { /* ignore */ }
  }

  function stopRadio() {
    if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
    if (radioOsc) { try { radioOsc.stop(); } catch (e) {} radioOsc = null; }
    if (radioOsc2) { try { radioOsc2.stop(); } catch (e) {} radioOsc2 = null; }
  }

  VB.audio = {
    sfx: function (name) { if (SFX[name]) SFX[name](); },
    applyVolumes: function () {
      if (!ensure()) return;
      try {
        master.gain.value = volumes.master;
        musicGain.gain.value = volumes.music;
        sfxGain.gain.value = volumes.sfx;
      } catch (e) {}
    },
    setVolume: function (kind, v) { volumes[kind] = v; this.applyVolumes(); },
    getVolumes: function () { return volumes; },
    toggleRadio: function () {
      radioOn = !radioOn;
      if (radioOn) startRadio(); else stopRadio();
      return radioOn;
    },
    radioOn: function () { return radioOn; },
    nextTrack: function () {
      var S = VB.state;
      var i = TRACKS.indexOf(S.radioTrack);
      S.radioTrack = TRACKS[(i + 1) % TRACKS.length];
      return S.radioTrack;
    },
    unlock: function () { ensure(); if (radioOn) startRadio(); }
  };
})();
