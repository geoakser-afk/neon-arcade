/* Arcade.music — generative calm background music. No audio files: it
   synthesizes slow, ambient chord progressions with a soft pad, gentle
   arpeggios, and a low sine bass, all through the shared AudioContext.
   Several "tracks" (different scales/tempos/timbres) that can be shuffled.
   Independent on/off from the SFX mute — this is the ambient bed. */
(function () {
  const store = window.Arcade.storage;
  const audio = window.Arcade.audio;   // reuse its AudioContext via unlock()/ctx

  // We need the raw AudioContext; audio.js keeps it private, so mint our own
  // lazily. Browsers allow multiple contexts; this one is just for music and
  // routes through its own master gain so we can fade it independently.
  let ac = null, master = null;
  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0;            // start silent; fade in on play
      master.connect(ac.destination);
    }
    return ac;
  }
  function unlock() { const c = ctx(); if (c.state === "suspended") c.resume(); }

  // ---- track definitions: calm, spacious, aesthetic ----
  // roots are MIDI-ish note names mapped to Hz; each track = a scale + chord
  // set + tempo + pad timbre. All are slow and soothing.
  function hz(semitonesFromA4) { return 440 * Math.pow(2, semitonesFromA4 / 12); }
  // helper: build a frequency from note index in an octave (C-based)
  function note(n) { return hz(n - 9); } // n: semitone above A? we use direct offsets below

  // Four tracks written to sound CLEARLY different from each other — distinct
  // register, tempo, timbre, arp rhythm, and a melody that's actually audible
  // (the old set was four near-identical low pad drones, so shuffling seemed
  // to do nothing). Each has its own musical identity below.
  const TRACKS = [
    {
      // "Nocturne" — deep, slow, warm. Low pad drone, sparse bell melody up high.
      name: "Nocturne",
      beat: 3.4,
      wave: "sine",
      chords: [
        [98.00, 146.83, 196.00, 233.08],   // Gm
        [87.31, 130.81, 174.61, 220.00],   // Fm-ish
        [116.54, 146.83, 174.61, 233.08],  // Ab
        [98.00, 155.56, 196.00, 246.94]    // G
      ],
      arp: [784.0, 0, 932.3, 0, 1046.5, 0, 784.0, 0],  // 0 = rest (sparse bells)
      arpWave: "sine", arpEvery: 0.85, arpVol: 0.075, padVol: 0.05, bassVol: 0.07, bassOct: 0.5
    },
    {
      // "Tidewater" — flowing mid-register, triangle pad, steady rolling arp.
      name: "Tidewater",
      beat: 2.4,
      wave: "triangle",
      chords: [
        [146.83, 220.00, 293.66, 349.23],  // D
        [164.81, 246.94, 329.63, 392.00],  // E
        [130.81, 196.00, 261.63, 329.63],  // C
        [110.00, 174.61, 220.00, 293.66]   // Am7
      ],
      arp: [587.3, 659.3, 880.0, 659.3, 587.3, 440.0],  // rolling, no rests
      arpWave: "triangle", arpEvery: 0.42, arpVol: 0.07, padVol: 0.05, bassVol: 0.055, bassOct: 0.5
    },
    {
      // "Aurora" — bright, high, shimmering. Higher chords, quick sparkle arp.
      name: "Aurora",
      beat: 2.8,
      wave: "sine",
      chords: [
        [261.63, 392.00, 523.25, 659.25],  // C (high)
        [293.66, 440.00, 587.33, 698.46],  // D
        [329.63, 493.88, 659.25, 783.99],  // E
        [246.94, 392.00, 493.88, 659.25]   // Bm-ish
      ],
      arp: [1046.5, 1318.5, 1568.0, 1318.5],  // high sparkle
      arpWave: "sine", arpEvery: 0.30, arpVol: 0.055, padVol: 0.042, bassVol: 0.05, bassOct: 0.5
    },
    {
      // "Driftwood" — spacious, minor, square-ish pluck with long rests.
      name: "Driftwood",
      beat: 4.0,
      wave: "triangle",
      chords: [
        [110.00, 164.81, 220.00, 261.63],  // Am
        [130.81, 196.00, 246.94, 329.63],  // C
        [146.83, 220.00, 293.66, 349.23],  // Dm-ish
        [98.00, 146.83, 196.00, 246.94]    // G
      ],
      arp: [440.0, 0, 0, 523.3, 0, 659.3, 0, 0],  // very sparse, meditative
      arpWave: "sine", arpEvery: 0.7, arpVol: 0.08, padVol: 0.055, bassVol: 0.065, bassOct: 0.25
    }
  ];

  let playing = false;
  let trackIdx = store.get("pref:musicTrack", 0) % TRACKS.length;
  let enabled = store.get("pref:music", false);
  let step = 0, arpStep = 0;
  let timers = [];

  function clearTimers() { timers.forEach((t) => clearTimeout(t)); timers = []; }

  // a single soft pad voice: slow attack, long release
  function pad(freq, dur, vol, wave) {
    const c = ctx(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave; o.frequency.value = freq;
    // gentle detune shimmer
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = wave; o2.frequency.value = freq * 1.005;
    o.connect(g); o2.connect(g2); g.connect(master); g2.connect(master);
    const a = dur * 0.35, r = dur * 0.9;
    [g, g2].forEach((gg) => {
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.linearRampToValueAtTime(vol, t + a);
      gg.gain.linearRampToValueAtTime(0.0001, t + dur + r);
    });
    o.start(t); o2.start(t); o.stop(t + dur + r + 0.1); o2.stop(t + dur + r + 0.1);
  }

  function pluck(freq, vol, wave) {
    const c = ctx(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave || "sine"; o.frequency.value = freq;
    o.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.start(t); o.stop(t + 1.0);
  }

  function scheduleChord() {
    if (!playing) return;
    const tk = TRACKS[trackIdx];
    const chord = tk.chords[step % tk.chords.length];
    // pad the chord
    chord.forEach((f) => pad(f, tk.beat, tk.padVol, tk.wave));
    // bass = root scaled down (per-track octave for a distinct low end)
    pad(chord[0] * (tk.bassOct || 0.5), tk.beat, tk.bassVol, "sine");
    step++;
    timers.push(setTimeout(scheduleChord, tk.beat * 1000));
  }

  function scheduleArp() {
    if (!playing) return;
    const tk = TRACKS[trackIdx];
    const f = tk.arp[arpStep % tk.arp.length];
    if (f) pluck(f, tk.arpVol, tk.arpWave || "sine");   // 0 = rest, skip
    arpStep++;
    timers.push(setTimeout(scheduleArp, tk.arpEvery * 1000));
  }

  function fade(to, ms) {
    const c = ctx();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(master.gain.value, c.currentTime);
    master.gain.linearRampToValueAtTime(to, c.currentTime + ms / 1000);
  }

  function startLoops() {
    playing = true;
    step = 0; arpStep = 0;
    fade(0.9, 1500);           // gentle fade-in (master already scales voices low)
    scheduleChord();
    timers.push(setTimeout(scheduleArp, 900));
  }
  function stopLoops(hard) {
    playing = false;
    clearTimers();
    if (!hard) fade(0, 900);
    else if (master) master.gain.value = 0;
  }

  const M = {
    tracks: TRACKS.map((t) => t.name),
    isEnabled: () => enabled,
    currentTrack: () => trackIdx,
    currentName: () => TRACKS[trackIdx].name,

    enable() {
      enabled = true; store.set("pref:music", true);
      unlock(); startLoops();
    },
    disable() {
      enabled = false; store.set("pref:music", false);
      stopLoops(false);
    },
    toggle() { if (enabled) M.disable(); else M.enable(); return enabled; },

    // shuffle to a different random track; keeps playing if already on
    shuffle() {
      let next = trackIdx;
      if (TRACKS.length > 1) while (next === trackIdx) next = Math.floor(Math.random() * TRACKS.length);
      trackIdx = next; store.set("pref:musicTrack", trackIdx);
      if (playing) { stopLoops(true); startLoops(); }
      return TRACKS[trackIdx].name;
    },

    // called on first user gesture so autoplay policy is satisfied; if the
    // user had music enabled from a previous session, resume it.
    resumeIfEnabled() { if (enabled) { unlock(); if (!playing) startLoops(); } }
  };

  window.Arcade.music = M;
})();
