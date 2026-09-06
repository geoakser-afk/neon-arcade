/* Arcade.voice — spoken phrases for the kid games, using pre-rendered Kokoro clips
   (audio/voice/<slug>.wav, generated offline by tools/kokoro-tts/gen.mjs). A phrase
   is a string or an array of strings; each part maps to one clip and the parts are
   played back to back ("Yes!" + "five" + "apples"). If a clip is missing or fails
   to load, the whole phrase falls back to the browser's speechSynthesis voice so
   the game still talks. Respects the arcade mute button. */
(function () {
  const A = window.Arcade;
  const BASE = "audio/voice/";
  const cache = {};            // slug -> HTMLAudioElement (decoded once, cloned per play)
  let current = null;          // {stop:fn}
  let seq = 0;

  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function clip(part) {
    const s = slug(part);
    if (!cache[s]) {
      const el = new Audio(BASE + s + ".wav");
      el.preload = "auto";
      cache[s] = el;
    }
    return cache[s];
  }
  function preload(parts) { (Array.isArray(parts) ? parts : [parts]).forEach(clip); }

  function fallback(text) {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 0.9; u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function stop() {
    seq++;
    if (current) { try { current.stop(); } catch (e) {} current = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  }

  // say("Yes!") or say(["Yes!", "five", "apples"]). Parts play in order with a tiny gap.
  function say(parts) {
    if (A.audio && A.audio.muted) return;
    const list = (Array.isArray(parts) ? parts : [parts]).filter(Boolean);
    if (!list.length) return;
    stop();
    const my = ++seq;
    let i = 0, node = null;
    const text = list.join(" ").replace(/\s+/g, " ");
    function next() {
      if (my !== seq) return;
      if (i >= list.length) { current = null; return; }
      const src = clip(list[i++]);
      node = src.cloneNode();
      node.volume = 1;
      node.onended = function () { setTimeout(next, 70); };
      node.onerror = function () { if (my === seq) { current = null; fallback(text); } };
      current = { stop: function () { try { node.pause(); node.currentTime = 0; } catch (e) {} } };
      const p = node.play();
      if (p && p.catch) p.catch(function () { if (my === seq) { current = null; fallback(text); } });
    }
    next();
  }

  A.voice = { say: say, stop: stop, preload: preload, slug: slug };
})();
