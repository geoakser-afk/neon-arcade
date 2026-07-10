/* Arcade.audio — synthesized Web Audio engine. No audio files, ever.
   Two tiers: calm (soft, low-vol, routine actions) + punchy (louder,
   layered, satisfying wins). Ported and extended from break.html. */
(function () {
  const store = window.Arcade.storage;
  let ac = null;
  let muted = store.get("pref:muted", false);

  function ctx() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    return ac;
  }
  // call on a user gesture to satisfy autoplay policy
  function unlock() { const c = ctx(); if (c.state === "suspended") c.resume(); }

  // core voice: oscillator -> gain envelope -> master
  function tone(freq, dur, opts) {
    if (muted) return;
    opts = opts || {};
    const c = ctx();
    const t = c.currentTime + (opts.when || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(freq, t);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t + dur);
    const vol = opts.vol == null ? 0.16 : opts.vol;
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (opts.attack || 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // chord: several tones together
  function chord(freqs, dur, opts) {
    opts = opts || {};
    freqs.forEach((f, i) => tone(f, dur, Object.assign({}, opts, { when: (opts.when || 0) + i * (opts.spread || 0) })));
  }

  // arpeggio: notes in sequence
  function arp(freqs, opts) {
    opts = opts || {};
    const step = opts.step || 0.09;
    freqs.forEach((f, i) => tone(f, opts.dur || 0.18, Object.assign({}, opts, { when: (opts.when || 0) + i * step })));
  }

  // ----- semantic helpers games use via ctx.audio -----
  const A = {
    unlock, tone, chord, arp,
    beep: (f, d, type, vol) => tone(f, d, { type, vol }), // back-compat with break.html style

    // calm tier — soft, easy on the ears
    soft() { tone(320, 0.09, { type: "triangle", vol: 0.06 }); },
    move() { tone(200, 0.08, { type: "triangle", vol: 0.07 }); },
    tick() { tone(660, 0.04, { type: "sine", vol: 0.05 }); },
    pick() { tone(520, 0.10, { type: "sine", vol: 0.12 }); },
    place() { tone(180, 0.10, { type: "sine", vol: 0.10 }); },

    // punchy tier — satisfying wins, pitch scales with magnitude
    win(level) {
      const n = Math.min(12, Math.max(0, level || 1));
      const base = 300 * Math.pow(1.0595, n * 2.4);
      chord([base, base * 1.5], 0.16, { type: "sine", vol: 0.22 });
    },
    score() { arp([523, 659, 784], { dur: 0.14, step: 0.06, vol: 0.18, type: "sine" }); },
    combo(n) { tone(440 * Math.pow(1.0595, Math.min(24, n) * 2), 0.12, { type: "sine", vol: 0.2 }); },
    thunk() { tone(90, 0.14, { type: "sine", vol: 0.24, glide: 55 }); },

    // warning sting — clear but not harsh; fires when the timer goes red
    warn() { chord([440, 587], 0.22, { type: "triangle", vol: 0.2, spread: 0.05 }); },

    // shared jingles / stings
    start() { arp([523, 659, 784], { dur: 0.18, step: 0.08, vol: 0.2, type: "sine" }); },
    breakOver() { arp([784, 659, 523, 392], { dur: 0.22, step: 0.12, vol: 0.2, type: "triangle" }); },
    gameOver() { arp([392, 330, 262], { dur: 0.26, step: 0.14, vol: 0.16, type: "sine" }); },
    lose() { tone(160, 0.3, { type: "triangle", vol: 0.16, glide: 90 }); },

    get muted() { return muted; },
    toggleMute() { muted = !muted; store.set("pref:muted", muted); return muted; },
    setMuted(m) { muted = m; store.set("pref:muted", muted); }
  };

  window.Arcade.audio = A;
})();
