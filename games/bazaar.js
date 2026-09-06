/* Squishy Bazaar — a whole fidget-toy trading world, designed with Ella.
   Collect squishies, bouncy balls, pop-its, slimes and other fidgets; squeeze
   them (every toy has its OWN synthesized sound — crunchy ones crunch, needle
   ones ping, bouncy ones boing); buy low and sell high on a live market with
   news events; trade face-to-face with bot traders who each have tastes; or
   flip the Auto-Trader on and let YOUR bot hunt deals for you. Earn coins in
   two mini-games (Bounce Pool: pull a squishy back and sink it; Sort Rush:
   sort toys by category against the clock). Work up from Common to Super and
   Legendary. No merging (Ella's rule). Everything persists per-browser. */
(function () {
  Arcade.register({
    id: "bazaar",
    name: "Squishy *Bazaar*",
    tagline: "Collect, squeeze, trade & flip fidget toys. Every one has its own sound.",
    accent: "#b48cff",
    complexity: "high",
    controls: "mouse",
    scoreLabel: "Worth",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0;                       // ms clock while mounted
      let mx = -1, my = -1;              // hover position
      let hits = [];                     // clickable regions, rebuilt every draw
      let toasts = [];
      let modal = null;
      let screen = "collection";
      let pages = { collection: 0, trade: 0 };
      let sortMode = "rarity";
      let squish = {};                   // uid -> spring {s, v}
      let traderId = null;
      let offer = { mine: [], theirs: [] };
      let speech = null;                 // {text, t}
      let mini = null;                   // active mini-game state
      let save = null;
      let dirty = false, saveT = 0;
      let marketT = 0, botT = 0;
      let levelFx = -99999;
      let drag = null;
      let bgDots = [];
      let confetti = [];

      const INV_MAX = 40;
      const SHOP_CYCLE = 120000;
      const MARKET_TICK = 5000;
      const BOT_TICK = 7000;

      // ---------- helpers ----------
      function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
      function lerp(a, b, t) { return a + (b - a) * t; }
      function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [180, 180, 180]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      function rgba(h, a) { const c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
      function mix(h1, h2, t) { const a = hexRgb(h1), b = hexRgb(h2); return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + ")"; }
      function lighten(h, t) { return mix(h, "#ffffff", t); }
      function darken(h, t) { return mix(h, "#000000", t); }
      function hsl(h, s, l, a) { return "hsla(" + h + "," + s + "%," + l + "%," + (a == null ? 1 : a) + ")"; }
      function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
      function srnd(seed, i) { const x = Math.sin(seed * 0.37 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
      function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
      function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
      function fmt(n) { n = Math.round(n); if (n >= 100000) return (n / 1000).toFixed(0) + "k"; if (n >= 10000) return (n / 1000).toFixed(1) + "k"; return String(n); }
      function pathRR(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
      function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
      function font(wt, px) { g.font = wt + " " + Math.max(8, Math.round(px)) + "px system-ui, -apple-system, 'Segoe UI', sans-serif"; }
      function ellipsize(str, max) { if (g.measureText(str).width <= max) return str; while (str.length > 1 && g.measureText(str + "…").width > max) str = str.slice(0, -1); return str + "…"; }
      function text(str, x, y, o) {
        o = o || {};
        font(o.wt || "600", o.size || S * 0.022);
        g.fillStyle = o.col || "rgba(230,236,245,0.92)";
        g.textAlign = o.align || "left"; g.textBaseline = o.base || "middle";
        if (o.max) str = ellipsize(String(str), o.max);
        g.fillText(String(str), x, y);
      }
      // word-wrapped text; returns number of lines drawn
      function wrap(str, x, y, max, lh, o) {
        o = o || {};
        font(o.wt || "500", o.size || S * 0.02);
        g.fillStyle = o.col || "rgba(230,236,245,0.85)";
        g.textAlign = o.align || "left"; g.textBaseline = "middle";
        const words = String(str).split(" "); let line = "", n = 0;
        for (let i = 0; i < words.length; i++) {
          const test = line ? line + " " + words[i] : words[i];
          if (g.measureText(test).width > max && line) { g.fillText(line, x, y + n * lh); line = words[i]; n++; }
          else line = test;
        }
        if (line) { g.fillText(line, x, y + n * lh); n++; }
        return n;
      }

      // ---------- data: categories ----------
      const CATS = {
        crunchy: { label: "Crunchy", desc: "foam-bead crunchers", hue: "#f6b26b" },
        needle:  { label: "Needle", desc: "spiky & poky", hue: "#8ee3f5" },
        bouncy:  { label: "Bouncy", desc: "balls that boing", hue: "#ff8fa3" },
        soft:    { label: "Slow-Rise", desc: "soft squishy foam", hue: "#ffd1dc" },
        clicky:  { label: "Clicky", desc: "pop-its, cubes, spinners", hue: "#b8f2b0" },
        slime:   { label: "Slime & Putty", desc: "gooey stretchers", hue: "#a6ffe8" },
        odd:     { label: "Odd Fidgets", desc: "weird little wonders", hue: "#e0c3ff" }
      };
      const CAT_KEYS = Object.keys(CATS);

      // ---------- data: rarity tiers ----------
      const RAR = [
        { key: "common",    label: "Common",    col: "#a9b4c4", w: 52,  lvl: 1 },
        { key: "uncommon",  label: "Uncommon",  col: "#7fe0a0", w: 27,  lvl: 1 },
        { key: "rare",      label: "Rare",      col: "#74b9ff", w: 13,  lvl: 2 },
        { key: "epic",      label: "Epic",      col: "#c98cff", w: 5.5, lvl: 4 },
        { key: "super",     label: "Super",     col: "#ff8fd0", w: 2,   lvl: 6 },
        { key: "legendary", label: "Legendary", col: "#ffd36b", w: 0.6, lvl: 8 }
      ];
      const RI = {}; RAR.forEach(function (r, i) { RI[r.key] = i; });
      function rarOf(it) { return RAR[RI[it.rar]]; }

      // ---------- data: the toy catalog ----------
      // shape: ball blob cube star spiky donut bar cloud heart drop spinner pop tube
      // pat:   none spots stripes glitter swirl bubbles face
      function I(id, name, cat, rar, base, shape, ca, cb, pat, snd) { return { id: id, name: name, cat: cat, rar: rar, base: base, shape: shape, ca: ca, cb: cb, pat: pat, snd: snd }; }
      const ITEMS = [
        // common
        I("crunch_bead", "Bead Crunch Ball", "crunchy", "common", 12, "ball", "#f7c873", "#c9852c", "spots", "crunch"),
        I("crunch_donut", "Crunchy Donut", "crunchy", "common", 14, "donut", "#f4a6c1", "#a85c7c", "spots", "crunch"),
        I("crunch_star", "Crunch Star", "crunchy", "common", 15, "star", "#ffd27a", "#b57b1f", "none", "crunch"),
        I("spike_pom", "Spiky Pom", "needle", "common", 10, "spiky", "#9be7ff", "#3f8fb5", "none", "ping"),
        I("pin_tube", "Pin Tube", "needle", "common", 12, "tube", "#8ee3f5", "#2d7f96", "stripes", "ping"),
        I("rubber_bouncer", "Rubber Bouncer", "bouncy", "common", 9, "ball", "#ff9fb0", "#b8455e", "stripes", "bounce"),
        I("mini_bun", "Mini Bun", "soft", "common", 11, "blob", "#ffe0ea", "#d18ea3", "face", "rise"),
        I("popit_square", "Pop-It Square", "clicky", "common", 13, "pop", "#b8f2b0", "#5c9a52", "none", "pop"),
        I("bubble_wrap", "Bubble Wrap Strip", "clicky", "common", 9, "bar", "#cfe8ff", "#6d8fb5", "bubbles", "popmany"),
        I("green_goo", "Green Goo", "slime", "common", 12, "drop", "#a6ffb0", "#3f9a52", "bubbles", "goo"),
        I("stress_orb", "Stress Orb", "odd", "common", 8, "ball", "#d9d9e6", "#7a7a94", "none", "thud"),
        // uncommon
        I("mochi_kitty", "Mochi Kitty", "soft", "uncommon", 32, "blob", "#fff1f3", "#e6a9b8", "face", "rise"),
        I("crunch_avocado", "Crunch Avocado", "crunchy", "uncommon", 28, "drop", "#b6e388", "#4d7a2a", "none", "crunch"),
        I("hedgehog_poker", "Hedgehog Poker", "needle", "uncommon", 30, "spiky", "#c9b8ff", "#6a55b5", "none", "ping"),
        I("glow_bouncer", "Glow Bouncer", "bouncy", "uncommon", 34, "ball", "#c6ff9a", "#5a9a2e", "glitter", "bounce"),
        I("tri_spinner", "Tri Spinner", "clicky", "uncommon", 40, "spinner", "#ffd08a", "#b5651d", "none", "whirr"),
        I("think_putty", "Think Putty", "slime", "uncommon", 36, "blob", "#ffb3d9", "#b3477f", "swirl", "stretch"),
        I("infinity_cube", "Infinity Cube", "clicky", "uncommon", 45, "cube", "#a8b8ff", "#4a5aa8", "none", "clicks"),
        I("water_snake", "Wiggly Water Snake", "odd", "uncommon", 38, "tube", "#9ad8ff", "#2e6f9c", "spots", "wobble"),
        I("squeaky_duck", "Squeaky Duck", "odd", "uncommon", 26, "blob", "#ffe27a", "#c99a1c", "face", "squeak"),
        I("splat_ball", "Splat Ball", "bouncy", "uncommon", 30, "ball", "#ff9c6b", "#b5442e", "none", "splat"),
        // rare
        I("crunch_cloud", "Crunch Cloud", "crunchy", "rare", 95, "cloud", "#f3f6ff", "#a4b5d6", "glitter", "crunch"),
        I("crystal_spike", "Crystal Spike", "needle", "rare", 120, "spiky", "#b6f0ff", "#3d9fb5", "glitter", "ping"),
        I("galaxy_bouncer", "Galaxy Bouncer", "bouncy", "rare", 110, "ball", "#7f8cff", "#2a2f7a", "glitter", "bounce"),
        I("slowrise_cake", "Slow-Rise Cake", "soft", "rare", 130, "cube", "#ffd7e8", "#c77aa0", "face", "rise"),
        I("heart_popit", "Heart Pop-It", "clicky", "rare", 100, "heart", "#ff9fc8", "#b04a78", "none", "pop"),
        I("glitter_slime", "Glitter Slime", "slime", "rare", 115, "drop", "#c8a6ff", "#6a3fb5", "glitter", "goo"),
        I("magnet_beads", "Magnet Beads", "odd", "rare", 140, "ball", "#c4c9d6", "#5d6270", "spots", "clicks"),
        I("tangle_twist", "Tangle Twist", "odd", "rare", 90, "donut", "#7fe0c0", "#2f8a70", "stripes", "chirp"),
        I("needoh_cube", "Nee-Doh Cube", "slime", "rare", 125, "cube", "#a6ffe8", "#3fa08a", "bubbles", "stretch"),
        // epic
        I("dragon_crunch", "Dragon Crunch", "crunchy", "epic", 320, "star", "#ff9d6b", "#b5321e", "glitter", "crunch"),
        I("neon_urchin", "Neon Urchin", "needle", "epic", 380, "spiky", "#c8ff6b", "#5a9a1e", "glitter", "ping"),
        I("moon_bouncer", "Moon Bouncer", "bouncy", "epic", 350, "ball", "#f2f2ff", "#8a8ab5", "spots", "bounce"),
        I("giant_bun", "Giant Slow-Rise Bun", "soft", "epic", 420, "blob", "#fff4e0", "#d9a066", "face", "rise"),
        I("gold_spinner", "Gold Spinner", "clicky", "epic", 450, "spinner", "#ffe08a", "#b8860b", "glitter", "whirr"),
        I("nebula_slime", "Nebula Slime", "slime", "epic", 400, "drop", "#8f7fff", "#3a2a8a", "glitter", "goo"),
        I("mood_octopus", "Mood Octopus", "odd", "epic", 300, "blob", "#c99cff", "#6b3fb5", "face", "wobble"),
        // super
        I("crown_cruncher", "Crown Cruncher", "crunchy", "super", 900, "star", "#ffe08a", "#c48a00", "glitter", "crunch"),
        I("aurora_spike", "Aurora Spike", "needle", "super", 1100, "spiky", "#9affe0", "#2a8f7a", "glitter", "ping"),
        I("hyper_bouncer", "Hyper Bouncer", "bouncy", "super", 1000, "ball", "#ff7ab8", "#8a1f5a", "glitter", "bounce"),
        I("cloud_whale", "Cloud Whale Squish", "soft", "super", 1300, "cloud", "#dfe9ff", "#8aa0d6", "face", "rise"),
        I("prism_cube", "Prism Cube", "clicky", "super", 1200, "cube", "#d0f0ff", "#5a7aa8", "glitter", "clicks"),
        I("void_putty", "Void Putty", "slime", "super", 1150, "blob", "#7a6ab0", "#1a1030", "glitter", "stretch"),
        // legendary
        I("everlasting_crunch", "The Everlasting Crunch", "crunchy", "legendary", 3500, "star", "#fff0b0", "#d4a017", "glitter", "crunch"),
        I("starneedle", "Starneedle", "needle", "legendary", 4000, "spiky", "#e0ffff", "#4aa8b5", "glitter", "ping"),
        I("infinity_bouncer", "Infinity Bouncer", "bouncy", "legendary", 4500, "ball", "#ffffff", "#7a7aff", "glitter", "bounce"),
        I("original_squishy", "The Original Squishy", "soft", "legendary", 6000, "blob", "#ffe6ee", "#e08aa8", "face", "rise"),
        I("dragon_breath", "Dragon's Breath Slime", "slime", "legendary", 5000, "drop", "#ff9a6b", "#a3241a", "glitter", "goo"),
        I("mystery_fidget", "The Mystery Fidget", "odd", "legendary", 5500, "cube", "#5a5a8a", "#0f0f1f", "glitter", "mystery")
      ];
      const ITEM = {}; ITEMS.forEach(function (it) { ITEM[it.id] = it; });

      // ---------- data: traders (bots you trade WITH) ----------
      const TRADERS = [
        { id: "bolt", name: "Bolt", sub: "the trading robot", likes: ["clicky", "needle"], dislikes: ["slime"], greed: 1.0, lvl: 1, col: "#8ee3f5", face: "robot",
          hi: ["BEEP. Bolt online. Show me clicky things.", "Scanning collection… acceptable. Let us trade."],
          yes: ["DEAL ACCEPTED. Processing squish.", "Trade complete. Happiness subroutine: 100%.", "Excellent input. Enjoy your new toy."],
          close: ["Analysis: a little short. Add one small item.", "Almost. My circuits want slightly more."],
          no: ["ERROR: offer insufficient. Recalculate.", "Negative. That trade does not compute."] },
        { id: "pip", name: "Pip", sub: "bouncy-ball fanatic", likes: ["bouncy", "crunchy"], dislikes: ["odd"], greed: 0.95, lvl: 1, col: "#ff9fb0", face: "kid",
          hi: ["Ooh ooh what do you have?! Anything bouncy??", "Hi hi hi! Wanna trade? I LOVE crunchy stuff."],
          yes: ["YESSS deal! Best trade ever!!", "Okay okay okay DEAL. Squeeze it, squeeze it!", "Sweet! You're my favorite trader now."],
          close: ["Hmm… sooo close. Toss in one more thing?", "Almost! Sweeten it just a tiny bit?"],
          no: ["Nooo that's not fair, I'd lose my whole allowance!", "Nah. Pip's not falling for that one."] },
        { id: "marsh", name: "Marsh", sub: "the marshmallow", likes: ["soft", "slime"], dislikes: ["needle"], greed: 1.1, lvl: 3, col: "#ffd1dc", face: "cloud",
          hi: ["mmm… hello. soft things only, please. no pokey.", "*yawn* oh, a visitor. got anything squishy?"],
          yes: ["mmm yes. that's a cozy deal.", "deal. this one goes in the cuddle pile.", "soft trade, soft heart. accepted."],
          close: ["so close… a little more softness?", "hmm. add something small and we're good."],
          no: ["no thank you. too pokey, too little.", "that's… not enough. sorry."] },
        { id: "velour", name: "Madame Velour", sub: "collector of legends", likes: [], dislikes: [], greed: 1.2, lvl: 5, col: "#c98cff", face: "cat",
          hi: ["Darling. Show me something RARE, or don't waste my time.", "Ah, a collector. Do you have anything… exquisite?"],
          yes: ["Divine. It's a deal, darling.", "Magnifique. This one is worthy of my shelf.", "Yes. You have taste. Accepted."],
          close: ["Tempting… but not quite. Add a little sparkle.", "Mm. Nearly. One more small piece."],
          no: ["Common trinkets? Please. No.", "Absolutely not, darling."] }
      ];
      const TRADER = {}; TRADERS.forEach(function (t) { TRADER[t.id] = t; });

      // ---------- data: levels ----------
      const XP = [0, 40, 120, 260, 480, 800, 1250, 1900, 2800, 4000];
      const RANKS = ["Newbie", "Squisher", "Collector", "Trader", "Dealer", "Broker", "Tycoon", "Mogul", "Legend", "Squish Lord"];
      const UNLOCKS = {
        2: "Auto-Trader bot + Rare toys in the shop",
        3: "Sort Rush mini-game + Marsh the trader",
        4: "Epic toys + a bigger shop",
        5: "Madame Velour + better sell prices",
        6: "Super toys in the shop",
        8: "Legendary toys in the shop"
      };
      function levelOf(xp) { let l = 1; while (l < XP.length && xp >= XP[l]) l++; if (l >= XP.length) l = XP.length + Math.floor((xp - XP[XP.length - 1]) / 1500); return l; }
      function xpForLevel(l) { return l <= 1 ? 0 : l <= XP.length ? XP[l - 1] : XP[XP.length - 1] + 1500 * (l - XP.length); }
      function level() { return levelOf(save.xp); }
      function rank(l) { return RANKS[Math.min(RANKS.length - 1, l - 1)]; }

      // ---------- sounds: every toy has its own voice ----------
      // Two layers:
      //  1) FAMILY recipes (by category feel) shaped by a per-toy VOICE — pitch (p) and
      //     variant (k) derived from the toy's id — so two crunchies never sound identical.
      //  2) SIGNATURE recipes keyed by toy id for every Rare / Epic / Super / Legendary toy.
      // Each recipe: (a=ctx.audio, v=volume 0..1, w=start offset seconds, vo={p,k})
      function voiceOf(it) { const h = hash(it.id); return { p: 0.78 + srnd(h, 1) * 0.6, k: Math.floor(srnd(h, 2) * 3) }; }
      function bell(a, f, d, vol, w) {
        a.tone(f, d, { type: "sine", vol: vol, when: w });
        a.tone(f * 2, d * 0.6, { type: "sine", vol: vol * 0.35, when: w });
        a.tone(f * 3.01, d * 0.35, { type: "sine", vol: vol * 0.12, when: w });
      }
      function burst(a, n, lo, hi, d, vol, w, spread, type) {
        for (let i = 0; i < n; i++) a.tone(lo + Math.random() * (hi - lo), d, { type: type || "sawtooth", vol: vol, when: w + i * spread + Math.random() * spread * 0.5, attack: 0.002 });
      }
      function pad(a, f, d, vol, w) {   // 3 detuned sines = soft chord pad
        [0.995, 1, 1.006].forEach(function (m) { a.tone(f * m, d, { type: "sine", vol: vol, when: w, attack: d * 0.35 }); });
      }
      const PENTA = [1, 1.125, 1.25, 1.5, 1.6875, 2, 2.25, 2.5];
      const SND = {
        // ---- families (shaped by voice) ----
        crunch: function (a, v, w, vo) {
          burst(a, 8 + vo.k * 3, 600 * vo.p, 2600 * vo.p, 0.025, 0.045 * v, w, 0.02 + vo.k * 0.006);
          a.tone(140 * vo.p, 0.12, { type: "triangle", vol: 0.07 * v, glide: 90 * vo.p, when: w });
        },
        ping: function (a, v, w, vo) {
          const pat = [[0, 0.07, 0.13], [0, 0.05, 0.1, 0.15], [0, 0.12]][vo.k];
          pat.forEach(function (d, i) { a.tone(1500 * vo.p + i * 220, 0.1, { type: "sine", vol: 0.09 * v, when: w + d, glide: (1900 + i * 200) * vo.p }); });
        },
        bounce: function (a, v, w, vo) {
          let t = w, d = 0.18 - vo.k * 0.03, f = 260 * vo.p;
          for (let i = 0; i < 4 + vo.k; i++) { a.tone(f, d, { type: "sine", vol: Math.max(0.02, 0.16 - i * 0.025) * v, when: t, glide: f * 0.55 }); t += d + 0.02; d *= 0.72; f *= 1.12; }
        },
        rise: function (a, v, w, vo) {
          const d = 0.7 + vo.k * 0.15;
          a.tone(150 * vo.p, d, { type: "sine", vol: 0.14 * v, glide: 330 * vo.p, attack: 0.15, when: w });
          a.tone(300 * vo.p, d, { type: "triangle", vol: 0.03 * v, glide: 660 * vo.p, attack: 0.2, when: w });
          if (vo.k === 2) bell(a, 1046 * vo.p, 0.25, 0.05 * v, w + d * 0.9);
        },
        pop: function (a, v, w, vo) {
          for (let i = 0; i <= vo.k; i++) {
            a.tone(520 * vo.p * (1 + i * 0.15), 0.06, { type: "triangle", vol: 0.14 * v, glide: 160 * vo.p, attack: 0.002, when: w + i * 0.13 });
            a.tone(1200 * vo.p, 0.03, { type: "sine", vol: 0.05 * v, when: w + i * 0.13 + 0.005 });
          }
        },
        popmany: function (a, v, w, vo) {
          for (let i = 0; i < 6 + vo.k * 2; i++) a.tone((450 + Math.random() * 300) * vo.p, 0.05, { type: "triangle", vol: 0.09 * v, glide: 150 * vo.p, when: w + i * 0.08 + Math.random() * 0.03 });
        },
        goo: function (a, v, w, vo) {
          a.tone(220 * vo.p, 0.35, { type: "sine", vol: 0.12 * v, glide: 90 * vo.p, when: w });
          a.tone(700 * vo.p, 0.12, { type: "sine", vol: 0.05 * v, glide: 1400 * vo.p, when: w + 0.05 });
          a.tone(500 * vo.p, 0.1, { type: "sine", vol: 0.04 * v, glide: 1000 * vo.p, when: w + 0.25 });
          if (vo.k >= 1) a.tone(900 * vo.p, 0.08, { type: "sine", vol: 0.04 * v, glide: 1800 * vo.p, when: w + 0.42 });
        },
        thud: function (a, v, w, vo) {
          a.tone(110 * vo.p, 0.16, { type: "sine", vol: 0.2 * v, glide: 60 * vo.p, when: w });
          if (vo.k === 1) a.tone(130 * vo.p, 0.12, { type: "sine", vol: 0.12 * v, glide: 60 * vo.p, when: w + 0.2 });
        },
        whirr: function (a, v, w, vo) {
          for (let i = 0; i < 14; i++) a.tone(600 * vo.p - i * (22 + vo.k * 6), 0.06, { type: "triangle", vol: Math.max(0.01, 0.06 - i * 0.003) * v, when: w + i * 0.045 });
        },
        stretch: function (a, v, w, vo) {
          a.tone(180 * vo.p, 0.5, { type: "triangle", vol: 0.1 * v, glide: 420 * vo.p, attack: 0.1, when: w });
          a.tone(420 * vo.p, 0.2, { type: "sine", vol: 0.07 * v, glide: 200 * vo.p, when: w + 0.5 });
          if (vo.k === 2) a.tone(240 * vo.p, 0.05, { type: "triangle", vol: 0.1 * v, when: w + 0.72 });
        },
        clicks: function (a, v, w, vo) {
          for (let i = 0; i < 5 + vo.k * 2; i++) a.tone(1800 * vo.p, 0.02, { type: "square", vol: 0.03 * v, when: w + i * (0.09 - vo.k * 0.02), attack: 0.001 });
        },
        wobble: function (a, v, w, vo) {
          for (let i = 0; i < 6 + vo.k * 2; i++) a.tone((i % 2 ? 300 : 420) * vo.p, 0.12, { type: "sine", vol: 0.1 * v, glide: (i % 2 ? 420 : 300) * vo.p, when: w + i * 0.1 });
        },
        squeak: function (a, v, w, vo) {
          a.tone(900 * vo.p, 0.14, { type: "sawtooth", vol: 0.045 * v, glide: 1500 * vo.p, when: w });
          a.tone((vo.k === 1 ? 1200 : 1500) * vo.p, 0.16, { type: "sawtooth", vol: 0.035 * v, glide: (vo.k === 2 ? 1900 : 800) * vo.p, when: w + 0.15 });
        },
        splat: function (a, v, w, vo) {
          a.tone(120 * vo.p, 0.12, { type: "sine", vol: 0.18 * v, glide: 50, when: w });
          burst(a, 7 + vo.k * 3, 500 * vo.p, 1400 * vo.p, 0.03, 0.04 * v, w + 0.03, 0.02, "triangle");
        },
        chirp: function (a, v, w, vo) {
          for (let i = 0; i < 4 + vo.k; i++) a.tone((700 + i * 150) * vo.p, 0.08, { type: "sine", vol: 0.08 * v, glide: (1100 + i * 150) * vo.p, when: w + i * 0.09 });
        },
        mystery: function (a, v, w, vo) {
          const keys = Object.keys(SND).filter(function (k) { return k !== "mystery" && k !== "mystery_fidget"; });
          SND[rnd(keys)](a, v, w, vo);
        },

        // ---- SIGNATURE sounds: rare ----
        crunch_cloud: function (a, v, w) {          // fluffy crunch that turns into an airy shimmer
          burst(a, 7, 500, 1600, 0.03, 0.03 * v, w, 0.03);
          [1568, 1760, 2093].forEach(function (f, i) { a.tone(f, 0.5, { type: "sine", vol: 0.035 * v, when: w + 0.25 + i * 0.05, attack: 0.15 }); });
        },
        crystal_spike: function (a, v, w) {         // glassy bell arpeggio
          [1318, 1568, 1976, 2637].forEach(function (f, i) { bell(a, f, 0.35, 0.07 * v, w + i * 0.08); });
        },
        galaxy_bouncer: function (a, v, w) {        // bounce with a space glide tail
          SND.bounce(a, v, w, { p: 0.8, k: 1 });
          a.tone(900, 0.6, { type: "sine", vol: 0.05 * v, glide: 180, when: w + 0.5 });
          bell(a, 2093, 0.3, 0.03 * v, w + 0.9);
        },
        slowrise_cake: function (a, v, w) {         // rise… then the oven timer dings
          SND.rise(a, v, w, { p: 0.9, k: 0 });
          bell(a, 1568, 0.4, 0.07 * v, w + 0.75); bell(a, 1568, 0.4, 0.05 * v, w + 0.95);
        },
        heart_popit: function (a, v, w) {           // heartbeat: ba-DUM, ba-DUM
          [0, 0.16, 0.62, 0.78].forEach(function (d, i) { a.tone(i % 2 ? 380 : 300, 0.08, { type: "triangle", vol: (i % 2 ? 0.16 : 0.11) * v, glide: 120, attack: 0.002, when: w + d }); });
        },
        glitter_slime: function (a, v, w) {         // goo with glitter ticks
          SND.goo(a, v, w, { p: 1.1, k: 0 });
          burst(a, 9, 2500, 4200, 0.03, 0.025 * v, w + 0.1, 0.05, "sine");
        },
        magnet_beads: function (a, v, w) {          // chain of clicks snapping faster, then clunk
          let t = w, step = 0.11; for (let i = 0; i < 9; i++) { a.tone(1900 + i * 60, 0.02, { type: "square", vol: 0.03 * v, when: t, attack: 0.001 }); t += step; step *= 0.78; }
          a.tone(160, 0.12, { type: "triangle", vol: 0.12 * v, glide: 90, when: t });
        },
        tangle_twist: function (a, v, w) {          // twist up, untwist down
          for (let i = 0; i < 5; i++) a.tone(600 + i * 140, 0.07, { type: "sine", vol: 0.08 * v, glide: 800 + i * 140, when: w + i * 0.07 });
          for (let i = 0; i < 5; i++) a.tone(1300 - i * 140, 0.07, { type: "sine", vol: 0.07 * v, glide: 1100 - i * 140, when: w + 0.42 + i * 0.07 });
        },
        needoh_cube: function (a, v, w) {           // stretch with a wobbly tremolo
          for (let i = 0; i < 8; i++) a.tone(200 + i * 25 + (i % 2) * 40, 0.09, { type: "triangle", vol: 0.09 * v, when: w + i * 0.07 });
          a.tone(420, 0.2, { type: "sine", vol: 0.07 * v, glide: 180, when: w + 0.6 });
        },
        // ---- epic ----
        dragon_crunch: function (a, v, w) {         // big crunch + a low growl
          burst(a, 14, 400, 2200, 0.03, 0.05 * v, w, 0.02);
          a.tone(70, 0.7, { type: "sawtooth", vol: 0.09 * v, glide: 45, when: w + 0.05, attack: 0.05 });
          a.tone(120, 0.5, { type: "sawtooth", vol: 0.05 * v, glide: 260, when: w + 0.5 });
        },
        neon_urchin: function (a, v, w) {           // electric zaps
          for (let i = 0; i < 7; i++) a.tone(900 + Math.random() * 2500, 0.035, { type: "square", vol: 0.035 * v, glide: 300, when: w + i * 0.055, attack: 0.001 });
          a.tone(1800, 0.14, { type: "sine", vol: 0.08 * v, glide: 2600, when: w + 0.4 });
        },
        moon_bouncer: function (a, v, w) {          // slow-motion bounce with echoes
          let t = w, d = 0.34, f = 180;
          for (let i = 0; i < 5; i++) { a.tone(f, d, { type: "sine", vol: (0.15 - i * 0.025) * v, glide: f * 0.6, when: t }); a.tone(f * 2, d * 0.5, { type: "sine", vol: (0.04 - i * 0.006) * v, when: t + 0.12 }); t += d + 0.06; d *= 0.8; f *= 1.08; }
        },
        giant_bun: function (a, v, w) {             // very low, very slow rise… poof
          a.tone(70, 1.4, { type: "sine", vol: 0.16 * v, glide: 200, attack: 0.5, when: w });
          a.tone(140, 1.4, { type: "triangle", vol: 0.03 * v, glide: 400, attack: 0.6, when: w });
          burst(a, 6, 300, 900, 0.05, 0.03 * v, w + 1.3, 0.02, "triangle");
        },
        gold_spinner: function (a, v, w) {          // whirr with gold chimes riding it
          SND.whirr(a, v, w, { p: 1.1, k: 1 });
          [2093, 2637, 3136, 3951].forEach(function (f, i) { bell(a, f, 0.3, 0.045 * v, w + 0.1 + i * 0.14); });
        },
        nebula_slime: function (a, v, w) {          // goo dissolving into a detuned space pad
          SND.goo(a, v * 0.8, w, { p: 0.85, k: 1 });
          pad(a, 330, 1.1, 0.05 * v, w + 0.2); pad(a, 495, 1.0, 0.03 * v, w + 0.35);
        },
        mood_octopus: function (a, v, w) {          // wobble + a random little 3-note mood melody
          SND.wobble(a, v * 0.7, w, { p: 1, k: 0 });
          for (let i = 0; i < 3; i++) bell(a, 660 * rnd(PENTA), 0.22, 0.06 * v, w + 0.55 + i * 0.16);
        },
        // ---- super ----
        crown_cruncher: function (a, v, w) {        // crunch, then a royal fanfare
          burst(a, 10, 700, 2400, 0.025, 0.045 * v, w, 0.022);
          [523, 659, 784].forEach(function (f) { a.tone(f, 0.22, { type: "triangle", vol: 0.07 * v, when: w + 0.3 }); });
          [659, 784, 1046].forEach(function (f) { a.tone(f, 0.45, { type: "triangle", vol: 0.08 * v, when: w + 0.55 }); });
        },
        aurora_spike: function (a, v, w) {          // shimmering sliding pings + chord
          for (let i = 0; i < 6; i++) a.tone(1200 + i * 180, 0.16, { type: "sine", vol: 0.07 * v, glide: 1500 + i * 220, when: w + i * 0.09 });
          pad(a, 880, 0.9, 0.04 * v, w + 0.5); pad(a, 1320, 0.8, 0.03 * v, w + 0.6);
        },
        hyper_bouncer: function (a, v, w) {         // bounces that speed up into a zip
          let t = w, d = 0.16, f = 300;
          for (let i = 0; i < 12; i++) { a.tone(f, Math.max(0.03, d), { type: "sine", vol: 0.13 * v, glide: f * 0.6, when: t }); t += d; d *= 0.8; f *= 1.06; }
          a.tone(600, 0.25, { type: "sine", vol: 0.1 * v, glide: 2400, when: t });
        },
        cloud_whale: function (a, v, w) {           // whale song
          a.tone(140, 1.2, { type: "sine", vol: 0.14 * v, glide: 420, attack: 0.3, when: w });
          a.tone(420, 0.9, { type: "sine", vol: 0.1 * v, glide: 180, attack: 0.1, when: w + 1.1 });
          a.tone(60, 1.8, { type: "sine", vol: 0.08 * v, when: w, attack: 0.5 });
        },
        prism_cube: function (a, v, w) {            // clicks + a bright prismatic run across octaves
          SND.clicks(a, v * 0.7, w, { p: 1.2, k: 2 });
          [523, 659, 784, 1046, 1318, 1568, 2093, 2637].forEach(function (f, i) { bell(a, f, 0.18, 0.05 * v, w + 0.25 + i * 0.05); });
        },
        void_putty: function (a, v, w) {            // dark: a drone, a downward whoosh, a lone tick
          a.tone(55, 1.2, { type: "sawtooth", vol: 0.06 * v, when: w, attack: 0.3 });
          a.tone(800, 0.7, { type: "sine", vol: 0.07 * v, glide: 60, when: w + 0.1 });
          a.tone(2400, 0.03, { type: "square", vol: 0.03 * v, when: w + 1.15, attack: 0.001 });
        },
        // ---- legendary ----
        everlasting_crunch: function (a, v, w) {    // crunch in three echoing waves + a choir chord
          [0, 0.35, 0.7].forEach(function (d, i) { burst(a, 10, 600, 2600, 0.025, (0.045 - i * 0.012) * v, w + d, 0.022); });
          pad(a, 392, 1.4, 0.04 * v, w + 0.6); pad(a, 494, 1.3, 0.035 * v, w + 0.7); pad(a, 587, 1.2, 0.03 * v, w + 0.8);
        },
        starneedle: function (a, v, w) {            // a cascade of twinkling stars
          for (let i = 0; i < 10; i++) bell(a, 1046 * rnd(PENTA), 0.3, 0.05 * v, w + i * 0.07);
          a.tone(2600, 0.5, { type: "sine", vol: 0.04 * v, glide: 5200, when: w + 0.7 });
        },
        infinity_bouncer: function (a, v, w) {      // bounces that keep going and rise, ending in a chime
          let t = w, d = 0.14, f = 240;
          for (let i = 0; i < 16; i++) { a.tone(f, d, { type: "sine", vol: 0.11 * v, glide: f * 0.62, when: t }); t += d + 0.01; f *= 1.07; }
          [1568, 2093, 2637].forEach(function (f2, i) { bell(a, f2, 0.6, 0.06 * v, t + i * 0.08); });
        },
        original_squishy: function (a, v, w) {      // the warmest slow rise, blooming into a chord, with a heartbeat
          a.tone(120, 1.2, { type: "sine", vol: 0.14 * v, glide: 330, attack: 0.3, when: w });
          pad(a, 330, 1.4, 0.05 * v, w + 0.5); pad(a, 415, 1.3, 0.045 * v, w + 0.6); pad(a, 494, 1.2, 0.04 * v, w + 0.7);
          [1.5, 1.66].forEach(function (d, i) { a.tone(i ? 380 : 300, 0.08, { type: "triangle", vol: 0.1 * v, glide: 120, when: w + d }); });
        },
        dragon_breath: function (a, v, w) {         // goo + fire crackle + roar
          SND.goo(a, v * 0.7, w, { p: 0.7, k: 0 });
          burst(a, 16, 300, 1800, 0.03, 0.03 * v, w + 0.1, 0.045);
          a.tone(90, 0.9, { type: "sawtooth", vol: 0.08 * v, glide: 240, when: w + 0.4, attack: 0.1 });
        },
        mystery_fidget: function (a, v, w) {        // a different legendary voice every time
          const sig = ["everlasting_crunch", "starneedle", "infinity_bouncer", "original_squishy", "dragon_breath", "cloud_whale", "void_putty", "prism_cube"];
          SND[rnd(sig)](a, v, w);
        }
      };
      function playToy(it, v, w) {
        if (!ctx) return;
        v = v == null ? 1 : v; w = w || 0;
        const vo = voiceOf(it);
        try { (SND[it.id] || SND[it.snd])(ctx.audio, v, w, vo); } catch (e) {}
        if (it.rar === "legendary") ctx.audio.arp([2093, 2637, 3136, 3951], { dur: 0.16, step: 0.06, vol: 0.035 * v, type: "sine", when: w + 0.9 });
      }
      function sndCoin(n) { ctx.audio.arp(n >= 100 ? [880, 1108, 1318, 1760] : [880, 1318], { dur: 0.1, step: 0.05, vol: 0.12, type: "sine" }); }
      function sndClick() { ctx.audio.tone(520, 0.05, { type: "sine", vol: 0.06 }); }
      function sndNo() { ctx.audio.tone(200, 0.16, { type: "triangle", vol: 0.08, glide: 140 }); }
      function sndLevel() { ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.16, type: "sine" }); }

      // ---------- save / state ----------
      function newSave() {
        const cats = {};
        CAT_KEYS.forEach(function (k) {
          // seed a little price history so the Market charts are alive from the start
          const hist = []; let m = 1;
          for (let i = 0; i < 14; i++) { m = clamp(m + (1 - m) * 0.04 + gauss() * 0.035, 0.6, 1.6); hist.push(Math.round(m * 1000) / 1000); }
          cats[k] = { m: m, hist: hist };
        });
        const s = {
          v: 1, coins: 150, xp: 0, inv: [], nextUid: 1,
          market: { cats: cats, news: null },
          shop: { stock: [], t: 0 },
          traders: {},
          bot: { on: false, log: [], earned: 0, trades: 0 },
          stats: { trades: 0, bought: 0, sold: 0, mini: 0, squeezes: 0, bestWorth: 0 },
          seen: {}, intro: false, created: Date.now()
        };
        return s;
      }
      function load() {
        const s = ctx.storage.get("save", null);
        save = s && s.v === 1 ? s : newSave();
        hydrate();
      }
      // fill in anything missing (fresh save OR older save shape) and reset mount-relative clocks
      function hydrate() {
        if (!save.traders) save.traders = {};
        if (!save.bot) save.bot = { on: false, log: [], earned: 0, trades: 0 };
        if (!save.seen) save.seen = {};
        if (!save.stats) save.stats = { trades: 0, bought: 0, sold: 0, mini: 0, squeezes: 0, bestWorth: 0 };
        if (!save.inv.length && !save.intro) {
          giveItem("mini_bun"); giveItem("rubber_bouncer"); giveItem("crunch_bead");
        }
        save.shop.t = 0;                       // shop clock is mount-relative
        if (save.market.news) save.market.news.t = 0;
        if (!save.shop.stock.length || !save.shop.stock.some(Boolean)) restock(false);
        TRADERS.forEach(function (t) { ensureTrader(t.id); });
        save.inv.forEach(function (x) { save.seen[x.id] = 1; });
        dirty = true;
      }
      function persist() {
        if (!save || !ctx) return;
        ctx.storage.set("save", save);
        dirty = false; saveT = now;
      }
      function markDirty() { dirty = true; }

      // ---------- items & economy ----------
      function price(it) { const m = save.market.cats[it.cat] ? save.market.cats[it.cat].m : 1; return Math.max(1, Math.round(it.base * m)); }
      function sellCut() { return level() >= 5 ? 0.85 : 0.75; }
      function sellPrice(it) { return Math.max(1, Math.round(price(it) * sellCut())); }
      function inst(uid) { for (let i = 0; i < save.inv.length; i++) if (save.inv[i].u === uid) return save.inv[i]; return null; }
      function giveItem(id) {
        const x = { u: save.nextUid++, id: id, lock: false, t: Date.now() };
        save.inv.push(x); save.seen[id] = 1; markDirty();
        return x;
      }
      function removeItem(uid) {
        const i = save.inv.findIndex(function (x) { return x.u === uid; });
        if (i >= 0) save.inv.splice(i, 1);
        offer.mine = offer.mine.filter(function (u) { return u !== uid; });
        delete squish[uid]; markDirty();
      }
      function worth() { return save.coins + save.inv.reduce(function (s, x) { return s + price(ITEM[x.id]); }, 0); }
      function refreshScore() {
        const w = Math.round(worth());
        ctx.setScore(fmt(w));
        if (w > (save.stats.bestWorth || 0)) { save.stats.bestWorth = w; ctx.storage.recordScore(w); }
      }
      function sortedInv() {
        const arr = save.inv.slice();
        if (sortMode === "rarity") arr.sort(function (a, b) { const d = RI[ITEM[b.id].rar] - RI[ITEM[a.id].rar]; return d || (price(ITEM[b.id]) - price(ITEM[a.id])); });
        else if (sortMode === "value") arr.sort(function (a, b) { return price(ITEM[b.id]) - price(ITEM[a.id]); });
        else arr.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
        return arr;
      }

      function addXp(n) {
        const before = level();
        save.xp += n;
        const after = level();
        if (after > before) {
          levelFx = now;
          sndLevel();
          spawnConfetti(S / 2, S * 0.12, 40);
          toast("Level " + after + " — " + rank(after) + "!", ctx.accent);
          if (UNLOCKS[after]) toast("Unlocked: " + UNLOCKS[after], "#7fe0a0");
          TRADERS.forEach(function (t) { if (t.lvl === after) fillTrader(t.id); });
          if (after === 4) restock(false);
        }
        markDirty();
      }

      // ---------- shop ----------
      function rollRarity(maxLvl, boost) {
        const pool = RAR.filter(function (r) { return r.lvl <= maxLvl; });
        let tot = 0; pool.forEach(function (r) { tot += r.w * (boost && boost[r.key] ? boost[r.key] : 1); });
        let x = Math.random() * tot;
        for (let i = 0; i < pool.length; i++) { x -= pool[i].w * (boost && boost[pool[i].key] ? boost[pool[i].key] : 1); if (x <= 0) return pool[i].key; }
        return pool[pool.length - 1].key;
      }
      function rollItem(rarKey, cats) {
        let c = ITEMS.filter(function (i) { return i.rar === rarKey && (!cats || cats.indexOf(i.cat) >= 0); });
        if (!c.length) c = ITEMS.filter(function (i) { return i.rar === rarKey; });
        return rnd(c);
      }
      function shopSlots() { return level() >= 4 ? 8 : 6; }
      function restock(paid) {
        const n = shopSlots();
        const lvl = level();
        save.shop.stock = [];
        for (let i = 0; i < n; i++) save.shop.stock.push(rollItem(rollRarity(lvl)).id);
        // guarantee at least one uncommon+ so the shop is never all-common
        if (!save.shop.stock.some(function (id) { return RI[ITEM[id].rar] >= 1; })) save.shop.stock[0] = rollItem("uncommon").id;
        save.shop.t = now;
        markDirty();
        if (paid) { sndClick(); toast("Fresh stock!", "#7fe0a0"); }
      }
      function restockCost() { return 15 + Math.floor(level() * 5); }
      function buy(slot, byBot) {
        const id = save.shop.stock[slot]; if (!id) return false;
        const it = ITEM[id], p = price(it);
        if (save.coins < p) { if (!byBot) { toast("Not enough coins (" + p + ")", "#ff9fb0"); sndNo(); } return false; }
        if (save.inv.length >= INV_MAX) { if (!byBot) { toast("Collection full — sell or trade something", "#ff9fb0"); sndNo(); } return false; }
        save.coins -= p;
        const x = giveItem(id);
        save.shop.stock[slot] = null;
        save.stats.bought++;
        addXp(2 + RI[it.rar] * 2);
        if (!byBot) { playToy(it, 0.9, 0); toast("Bought " + it.name + " for " + p, rarOf(it).col); bump(x.u); }
        refreshScore();
        return true;
      }
      function sell(uid, byBot) {
        const x = inst(uid); if (!x) return 0;
        const it = ITEM[x.id];
        let p = sellPrice(it);
        if (byBot) p = Math.round(p * 0.9);
        removeItem(uid);
        save.coins += p; save.stats.sold++;
        addXp(3 + RI[it.rar] * 2);
        if (!byBot) { playToy(it, 0.6, 0); sndCoin(p); toast("Sold " + it.name + " for " + p + " coins", "#ffd36b"); }
        refreshScore();
        return p;
      }

      // ---------- market ----------
      const NEWS_UP = ["{C} toys are blowing up on FidgetTok!", "A famous streamer unboxed a {C} haul — prices soaring", "{C} shortage: every store is sold out", "Celebrity spotted with a {C} toy. Everyone wants one."];
      const NEWS_DOWN = ["Everyone's bored of {C} toys this week", "A giant {C} shipment just flooded the market", "A new fidget craze pushed {C} toys out of the spotlight", "{C} toys went on clearance everywhere"];
      function marketTick() {
        CAT_KEYS.forEach(function (k) {
          const c = save.market.cats[k];
          c.m = clamp(c.m + (1 - c.m) * 0.04 + gauss() * 0.035, 0.5, 2.4);
          c.hist.push(Math.round(c.m * 1000) / 1000);
          if (c.hist.length > 48) c.hist.shift();
        });
        // occasional news shock (about every 60s)
        if (Math.random() < MARKET_TICK / 60000) {
          const k = rnd(CAT_KEYS), c = save.market.cats[k];
          const up = Math.random() < 0.5;
          const amt = 0.18 + Math.random() * 0.28;
          c.m = clamp(c.m + (up ? amt : -amt), 0.5, 2.4);
          const tpl = rnd(up ? NEWS_UP : NEWS_DOWN);
          save.market.news = { text: tpl.replace("{C}", CATS[k].label), cat: k, up: up, t: now };
          toast((up ? "▲ " : "▼ ") + save.market.news.text, up ? "#7fe0a0" : "#ff9fb0");
          ctx.audio.tone(up ? 520 : 300, 0.18, { type: "sine", vol: 0.06, glide: up ? 780 : 200 });
        }
        // traders slowly rotate one item
        TRADERS.forEach(function (t) {
          if (Math.random() < 0.08) {
            const tr = ensureTrader(t.id);
            if (tr.inv.length) tr.inv[Math.floor(Math.random() * tr.inv.length)] = traderRoll(t);
          }
          const tr = ensureTrader(t.id);
          tr.mood = Math.max(1, (tr.mood || 1) - 0.01);
        });
        refreshScore(); markDirty();
      }
      function change(k) { const h = save.market.cats[k].hist; if (h.length < 2) return 0; const a = h[Math.max(0, h.length - 7)], b = h[h.length - 1]; return (b - a) / a; }

      // ---------- traders ----------
      function ensureTrader(id) {
        if (!save.traders[id]) { save.traders[id] = { inv: [], mood: 1 }; fillTrader(id); }
        return save.traders[id];
      }
      function traderRoll(t) {
        const lvl = level();
        const boost = {};
        // traders carry one tier above what the shop sells, to tempt you
        const maxLvl = lvl + 2;
        let rar = rollRarity(maxLvl, boost);
        if (t.id === "velour") { rar = rollRarity(maxLvl, { common: 0.05, uncommon: 0.2, rare: 2, epic: 3, super: 3, legendary: 3 }); }
        const cats = t.likes.length && Math.random() < 0.55 ? t.likes : null;
        return rollItem(rar, cats).id;
      }
      function fillTrader(id) {
        const t = TRADER[id], tr = save.traders[id] || (save.traders[id] = { inv: [], mood: 1 });
        while (tr.inv.length < 6) tr.inv.push(traderRoll(t));
        markDirty();
      }
      function perceive(t, it) {
        let v = price(it);
        if (t.id === "velour") { const ri = RI[it.rar]; v *= ri <= 1 ? 0.4 : ri === 2 ? 1 : 1.3; }
        else if (t.likes.indexOf(it.cat) >= 0) v *= 1.35;
        else if (t.dislikes.indexOf(it.cat) >= 0) v *= 0.65;
        return v;
      }
      function unlockedTraders() { const l = level(); return TRADERS.filter(function (t) { return t.lvl <= l; }); }
      function curTrader() { return traderId ? TRADER[traderId] : null; }
      function say(t, key) { speech = { text: rnd(t[key]), t: now, who: t.id }; }
      function selectTrader(id) {
        if (traderId === id) return;
        traderId = id; offer = { mine: [], theirs: [] }; pages.trade = 0;
        ensureTrader(id); say(TRADER[id], "hi"); sndClick();
      }
      // ratio of what they GET vs what they'd need — >=1 accepts
      function dealRatio() {
        const t = curTrader(); if (!t) return 0;
        const tr = ensureTrader(t.id);
        let G = 0, L = 0;
        offer.mine.forEach(function (u) { const x = inst(u); if (x) G += perceive(t, ITEM[x.id]); });
        offer.theirs.forEach(function (i) { const id = tr.inv[i]; if (id) L += perceive(t, ITEM[id]); });
        if (L <= 0) return G > 0 ? 2 : 0;
        return G / (L * t.greed * (tr.mood || 1));
      }
      function propose() {
        const t = curTrader(); if (!t) return;
        const tr = ensureTrader(t.id);
        if (!offer.mine.length) { speech = { text: "You have to offer something first.", t: now, who: t.id }; sndNo(); return; }
        const r = dealRatio();
        if (r >= 1) {
          const give = offer.mine.map(inst).filter(Boolean);
          const getIds = offer.theirs.map(function (i) { return tr.inv[i]; }).filter(Boolean);
          if (save.inv.length - give.length + getIds.length > INV_MAX) { toast("Collection full — sell something first", "#ff9fb0"); sndNo(); return; }
          // swap
          give.forEach(function (x) { removeItem(x.u); tr.inv.push(x.id); });
          const idxs = offer.theirs.slice().sort(function (a, b) { return b - a; });
          idxs.forEach(function (i) { tr.inv.splice(i, 1); });
          const got = [];
          getIds.forEach(function (id) { got.push(giveItem(id)); });
          while (tr.inv.length > 8) tr.inv.shift();
          while (tr.inv.length < 6) tr.inv.push(traderRoll(t));
          tr.mood = 1;
          save.stats.trades++;
          let bestRi = 0; getIds.forEach(function (id) { bestRi = Math.max(bestRi, RI[ITEM[id].rar]); });
          addXp(10 + bestRi * 6 + give.length * 2);
          say(t, "yes");
          // the toys you received play their sounds, one after another
          getIds.forEach(function (id, i) { playToy(ITEM[id], 1, i * 0.55); });
          got.forEach(function (x) { bump(x.u); });
          spawnConfetti(S / 2, S * 0.52, 26);
          modal = { type: "traded", got: getIds, gave: give.map(function (x) { return x.id; }), who: t.id, t: now };
          offer = { mine: [], theirs: [] };
          refreshScore(); markDirty();
        } else if (r >= 0.8) { say(t, "close"); sndNo(); tr.mood = Math.min(1.15, (tr.mood || 1) + 0.02); markDirty(); }
        else { say(t, "no"); sndNo(); tr.mood = Math.min(1.2, (tr.mood || 1) + 0.04); markDirty(); }
      }
      function toggleMine(uid) {
        const i = offer.mine.indexOf(uid);
        if (i >= 0) offer.mine.splice(i, 1);
        else { if (offer.mine.length >= 3) { toast("Max 3 toys per side", "#ff9fb0"); return; } offer.mine.push(uid); }
        sndClick();
      }
      function toggleTheirs(idx) {
        const i = offer.theirs.indexOf(idx);
        if (i >= 0) offer.theirs.splice(i, 1);
        else { if (offer.theirs.length >= 3) { toast("Max 3 toys per side", "#ff9fb0"); return; } offer.theirs.push(idx); }
        sndClick();
      }

      // ---------- YOUR auto-trader bot ----------
      function botUnlocked() { return level() >= 2; }
      function botLog(s) { save.bot.log.unshift({ t: Date.now(), s: s }); if (save.bot.log.length > 8) save.bot.log.pop(); markDirty(); }
      function botStep() {
        if (!save.bot.on || !botUnlocked()) return;
        // 1) buy market dips
        const dips = [];
        save.shop.stock.forEach(function (id, i) {
          if (!id) return; const it = ITEM[id];
          if (save.market.cats[it.cat].m <= 0.88 && price(it) <= save.coins * 0.45) dips.push(i);
        });
        if (dips.length && save.inv.length < INV_MAX - 2) {
          const i = rnd(dips), it = ITEM[save.shop.stock[i]], p = price(it);
          if (buy(i, true)) { botLog("Bought " + it.name + " for " + p + " — " + CATS[it.cat].label + " is down"); ctx.audio.soft(); return; }
        }
        // 2) sell into highs (never a locked toy)
        const highs = save.inv.filter(function (x) { return !x.lock && save.market.cats[ITEM[x.id].cat].m >= 1.18 && offer.mine.indexOf(x.u) < 0; });
        if (highs.length) {
          highs.sort(function (a, b) { return price(ITEM[a.id]) - price(ITEM[b.id]); });
          const x = highs[0], it = ITEM[x.id];
          const p = sell(x.u, true);
          save.bot.earned += p; save.bot.trades++;
          botLog("Sold " + it.name + " for " + p + " — " + CATS[it.cat].label + " is up " + Math.round((save.market.cats[it.cat].m - 1) * 100) + "%");
          ctx.audio.soft(); return;
        }
        // 3) hunt a favorable 1-for-1 trade
        const ts = unlockedTraders().slice().sort(function () { return Math.random() - 0.5; });
        const mine = save.inv.filter(function (x) { return !x.lock && offer.mine.indexOf(x.u) < 0; });
        for (let a = 0; a < ts.length; a++) {
          const t = ts[a], tr = ensureTrader(t.id);
          for (let i = 0; i < tr.inv.length; i++) {
            const theirs = ITEM[tr.inv[i]];
            for (let j = 0; j < mine.length; j++) {
              const my = ITEM[mine[j].id];
              if (price(theirs) < price(my) * 1.15) continue;
              if (perceive(t, my) < perceive(t, theirs) * t.greed * (tr.mood || 1)) continue;
              // do it
              removeItem(mine[j].u); tr.inv.splice(i, 1); tr.inv.push(my.id);
              const x = giveItem(theirs.id);
              while (tr.inv.length < 6) tr.inv.push(traderRoll(t));
              save.stats.trades++; save.bot.trades++;
              const gain = price(theirs) - price(my); save.bot.earned += gain;
              addXp(8 + RI[theirs.rar] * 4);
              botLog("Traded " + my.name + " → " + theirs.name + " with " + t.name + " (+" + gain + " worth)");
              playToy(theirs, 0.5, 0); bump(x.u);
              refreshScore(); return;
            }
          }
        }
        // 4) nothing to do
        if (!save.bot.log.length || save.bot.log[0].s.indexOf("Watching") !== 0) botLog("Watching the market for a deal…");
      }
      function toggleBot() {
        if (!botUnlocked()) { toast("Auto-Trader unlocks at level 2", "#ff9fb0"); sndNo(); return; }
        save.bot.on = !save.bot.on; markDirty();
        botT = 0;
        if (save.bot.on) { toast("Auto-Trader ON — it buys dips, sells highs, hunts trades", "#7fe0a0"); ctx.audio.arp([440, 660, 880], { dur: 0.1, step: 0.05, vol: 0.1 }); botLog("Bot powered on."); }
        else { toast("Auto-Trader OFF", "#a9b4c4"); ctx.audio.tone(330, 0.12, { type: "sine", vol: 0.08, glide: 220 }); }
      }

      // ---------- fx ----------
      function toast(txt, col) { toasts.push({ text: txt, col: col || "#e6ecf5", t: now }); if (toasts.length > 4) toasts.shift(); }
      function bump(uid) { squish[uid] = { s: 0, v: 0.045 }; }
      function squeeze(uid) {
        const x = inst(uid); if (!x) return;
        squish[uid] = { s: 0, v: 0.05 };
        playToy(ITEM[x.id], 1, 0);
        save.stats.squeezes++; markDirty();
      }
      function spawnConfetti(x, y, n) {
        if (reduced) return;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = S * (0.0003 + Math.random() * 0.0006);
          confetti.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0004, life: 1, col: rnd(["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#b48cff"]), r: S * (0.004 + Math.random() * 0.006) });
        }
      }
      function updateFx(dt) {
        Object.keys(squish).forEach(function (k) {
          const q = squish[k];
          // spring toward 0 with overshoot
          q.v += (-q.s * 0.0009 - q.v * 0.011) * dt;
          q.s += q.v * dt;
          if (Math.abs(q.s) < 0.002 && Math.abs(q.v) < 0.00005) delete squish[k];
        });
        for (let i = confetti.length - 1; i >= 0; i--) {
          const c = confetti[i];
          c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1400;
          if (c.life <= 0) confetti.splice(i, 1);
        }
        toasts = toasts.filter(function (t) { return now - t.t < 3200; });
      }
      function sq(uid) { const q = squish[uid]; return q ? clamp(q.s, -0.5, 1) : 0; }

      // =====================================================================
      //  RENDERING — toys first (the star of the show), then UI, then screens
      // =====================================================================
      const TAU = Math.PI * 2;

      function smoothClosed(pts) {
        const n = pts.length;
        g.beginPath();
        const p0 = pts[n - 1], p1 = pts[0];
        g.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
        for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
        g.closePath();
      }
      function shapePath(shape, r, seed, spin) {
        spin = spin || 0;
        g.beginPath();
        switch (shape) {
          case "blob": { const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const rr = r * (0.9 + srnd(seed, i) * 0.16); pts.push({ x: Math.cos(a) * rr * 1.05, y: Math.sin(a) * rr * 0.93 }); } smoothClosed(pts); break; }
          case "cube": pathRR(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.24); break;
          case "star": { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU; const rr = i % 2 ? r * 0.55 : r; pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); } smoothClosed(pts); break; }
          case "spiky": { const n = 16; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + spin; const rr = i % 2 ? r * 0.68 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.closePath(); break; }
          case "donut": g.arc(0, 0, r, 0, TAU); g.moveTo(r * 0.4, 0); g.arc(0, 0, r * 0.4, 0, TAU, true); break;
          case "bar": pathRR(-r, -r * 0.42, r * 2, r * 0.84, r * 0.32); break;
          case "tube": pathRR(-r * 0.42, -r, r * 0.84, r * 2, r * 0.4); break;
          case "cloud": [[-0.45, 0.12, 0.5], [-0.12, -0.3, 0.55], [0.35, -0.08, 0.5], [0.12, 0.25, 0.5], [-0.2, 0.28, 0.45]].forEach(function (c) { g.moveTo(c[0] * r + c[2] * r, c[1] * r); g.arc(c[0] * r, c[1] * r, c[2] * r, 0, TAU); }); break;
          case "heart": g.moveTo(0, r * 0.85); g.bezierCurveTo(-r * 1.35, -r * 0.05, -r * 0.65, -r * 1.1, 0, -r * 0.45); g.bezierCurveTo(r * 0.65, -r * 1.1, r * 1.35, -r * 0.05, 0, r * 0.85); g.closePath(); break;
          case "drop": g.moveTo(0, -r); g.bezierCurveTo(r * 0.95, -r * 0.05, r * 0.9, r * 0.95, 0, r * 0.95); g.bezierCurveTo(-r * 0.9, r * 0.95, -r * 0.95, -r * 0.05, 0, -r); g.closePath(); break;
          case "spinner": for (let k = 0; k < 3; k++) { const a = spin + k * TAU / 3; const cx = Math.cos(a) * r * 0.55, cy = Math.sin(a) * r * 0.55; g.moveTo(cx + r * 0.45, cy); g.arc(cx, cy, r * 0.45, 0, TAU); } g.moveTo(r * 0.32, 0); g.arc(0, 0, r * 0.32, 0, TAU); break;
          case "pop": pathRR(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.4); break;
          default: g.arc(0, 0, r, 0, TAU);
        }
      }
      function bodyGradient(ca, cb, r) {
        const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r * 1.25);
        gr.addColorStop(0, lighten(ca, 0.45)); gr.addColorStop(0.42, ca); gr.addColorStop(1, cb);
        return gr;
      }
      function sparkle(x, y, s, a) {
        g.fillStyle = "rgba(255,255,255," + a + ")";
        g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill();
      }
      function drawPattern(it, r, seed, t) {
        const cb = it.cb;
        if (it.pat === "spots") {
          g.fillStyle = rgba(cb, 0.5);
          for (let i = 0; i < 7; i++) { const cx = (srnd(seed, i) * 2 - 1) * r * 0.8, cy = (srnd(seed, i + 20) * 2 - 1) * r * 0.8, rad = r * (0.07 + srnd(seed, i + 40) * 0.1); g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); }
        } else if (it.pat === "stripes") {
          g.save(); g.rotate(-0.6); g.fillStyle = rgba(cb, 0.38);
          for (let k = -4; k <= 4; k++) g.fillRect(k * r * 0.5 - r * 0.1, -2 * r, r * 0.2, 4 * r);
          g.restore();
        } else if (it.pat === "glitter") {
          for (let i = 0; i < 16; i++) {
            const px = (srnd(seed, i) * 2 - 1) * r * 0.85, py = (srnd(seed, i + 20) * 2 - 1) * r * 0.85;
            const ph = srnd(seed, i + 60);
            const a = 0.15 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.004 + ph * 6.28));
            sparkle(px, py, r * (0.05 + srnd(seed, i + 80) * 0.06), a);
          }
        } else if (it.pat === "swirl") {
          g.strokeStyle = rgba(cb, 0.45); g.lineWidth = r * 0.11; g.lineCap = "round";
          g.beginPath();
          for (let a = 0; a <= 4 * Math.PI; a += 0.2) { const rad = a / (4 * Math.PI) * r * 0.8; const x = Math.cos(a + seed) * rad, y = Math.sin(a + seed) * rad; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
          g.stroke();
        } else if (it.pat === "bubbles") {
          for (let i = 0; i < 7; i++) {
            const cx = (srnd(seed, i) * 2 - 1) * r * 0.7, cy = (srnd(seed, i + 20) * 2 - 1) * r * 0.7, rad = r * (0.08 + srnd(seed, i + 40) * 0.12);
            g.fillStyle = "rgba(255,255,255,0.16)"; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
            g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(cx - rad * 0.35, cy - rad * 0.35, rad * 0.25, 0, TAU); g.fill();
          }
        }
      }
      function drawFace(r, sqv) {
        const ey = -r * 0.05, ex = r * 0.3, er = r * 0.085;
        const ink = "rgba(40,30,50,0.85)";
        if (sqv > 0.3) {
          g.lineWidth = r * 0.06; g.strokeStyle = ink; g.lineCap = "round";
          [-1, 1].forEach(function (s) { g.beginPath(); g.moveTo(s * ex - r * 0.1, ey + r * 0.04); g.lineTo(s * ex, ey - r * 0.05); g.lineTo(s * ex + r * 0.1, ey + r * 0.04); g.stroke(); });
        } else {
          g.fillStyle = ink;
          [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * ex, ey, er, er * 1.2, 0, 0, TAU); g.fill(); });
          g.fillStyle = "rgba(255,255,255,0.8)";
          [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * ex - er * 0.3, ey - er * 0.4, er * 0.35, 0, TAU); g.fill(); });
        }
        g.fillStyle = "rgba(255,120,150,0.28)";
        [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * r * 0.52, r * 0.22, r * 0.14, r * 0.08, 0, 0, TAU); g.fill(); });
        g.strokeStyle = "rgba(40,30,50,0.7)"; g.lineWidth = r * 0.045; g.lineCap = "round";
        g.beginPath(); g.arc(0, r * 0.18, r * (sqv > 0.3 ? 0.16 : 0.12), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      }
      function drawPopBubbles(it, r, seed) {
        for (let i = 0; i < 9; i++) {
          const cx = ((i % 3) - 1) * r * 0.55, cy = (Math.floor(i / 3) - 1) * r * 0.55;
          const popped = srnd(seed, i + 100) > 0.6;
          const rad = r * 0.2;
          if (popped) { g.fillStyle = rgba(it.cb, 0.55); g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); }
          else {
            const gr = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.35, rad * 0.1, cx, cy, rad);
            gr.addColorStop(0, lighten(it.ca, 0.5)); gr.addColorStop(1, it.cb);
            g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
          }
        }
      }

      /* drawToy — a soft-shaded, glossy, glowing fidget toy at (x,y) with radius r.
         o.sq = squish amount (0..1; negative = stretch), o.t = anim clock,
         o.alpha, o.glow(false to skip rarity glow). */
      function drawToy(x, y, r, it, o) {
        o = o || {};
        const sqv = o.sq || 0;
        const t = o.t == null ? now : o.t;
        const seed = hash(it.id) % 997;
        const rar = rarOf(it), ri = RI[it.rar];
        const alpha = o.alpha == null ? 1 : o.alpha;
        g.save();
        g.translate(x, y);
        // floor shadow
        g.globalAlpha = alpha * 0.42;
        g.fillStyle = "#000";
        g.beginPath(); g.ellipse(0, r * 1.0, r * (0.8 + sqv * 0.25), r * 0.17, 0, 0, TAU); g.fill();
        g.globalAlpha = alpha;
        // squash around the bottom
        g.translate(0, r * sqv * 0.3);
        g.scale(1 + sqv * 0.32, 1 - sqv * 0.3);
        // legendary halo ring (outside the body)
        if (it.rar === "legendary" && !reduced) {
          for (let i = 0; i < 6; i++) {
            const a = t * 0.0012 + i * TAU / 6; const rr = r * 1.3;
            sparkle(Math.cos(a) * rr, Math.sin(a) * rr * 0.9, r * 0.09, 0.35 + 0.35 * Math.sin(t * 0.005 + i));
          }
        }
        // rarity glow
        if (ri >= 1 && o.glow !== false) {
          let col = rar.col;
          if (it.rar === "legendary") col = hsl((t * 0.05) % 360, 90, 70);
          g.shadowColor = col; g.shadowBlur = r * (0.2 + ri * 0.13);
        }
        const spin = it.shape === "spinner" ? (Math.abs(sqv) > 0.02 ? t * 0.012 : t * 0.0006) : (it.shape === "spiky" ? 0 : 0);
        const isSlime = it.cat === "slime";
        if (it.shape === "spiky") {
          shapePath("spiky", r, seed, spin);
          g.fillStyle = bodyGradient(darken(it.ca, 0.1), it.cb, r); g.fill();
          g.shadowBlur = 0;
          shapePath("ball", r * 0.7, seed);
          g.fillStyle = bodyGradient(it.ca, it.cb, r * 0.7); g.fill();
        } else {
          shapePath(it.shape, r, seed, spin);
          if (isSlime) g.globalAlpha = alpha * 0.92;
          g.fillStyle = bodyGradient(it.ca, it.cb, r); g.fill();
          g.globalAlpha = alpha;
        }
        g.shadowBlur = 0;
        // pattern + rim light + shade, clipped to the body
        const clipR = it.shape === "spiky" ? r * 0.7 : r;
        const clipShape = it.shape === "spiky" ? "ball" : it.shape;
        g.save();
        shapePath(clipShape, clipR, seed, spin); g.clip();
        drawPattern(it, clipR, seed, t);
        if (it.shape === "pop") drawPopBubbles(it, r, seed);
        // top-left rim light (offset path stroked inside the clip)
        g.save(); g.translate(clipR * 0.07, clipR * 0.08);
        shapePath(clipShape, clipR, seed, spin);
        g.lineWidth = clipR * 0.12; g.strokeStyle = "rgba(255,255,255,0.13)"; g.stroke();
        g.restore();
        // bottom-right ambient shade
        g.save(); g.translate(-clipR * 0.07, -clipR * 0.09);
        shapePath(clipShape, clipR, seed, spin);
        g.lineWidth = clipR * 0.14; g.strokeStyle = "rgba(0,0,0,0.16)"; g.stroke();
        g.restore();
        g.restore();
        // specular highlights
        g.save();
        g.fillStyle = "rgba(255,255,255," + (isSlime ? 0.5 : 0.36) + ")";
        g.beginPath(); g.ellipse(-clipR * 0.38, -clipR * 0.42, clipR * 0.26, clipR * 0.13, -0.65, 0, TAU); g.fill();
        g.fillStyle = "rgba(255,255,255,0.55)";
        g.beginPath(); g.arc(-clipR * 0.15, -clipR * 0.6, clipR * 0.06, 0, TAU); g.fill();
        g.restore();
        if (it.pat === "face") drawFace(clipR, sqv);
        g.restore();
      }

      // ---------- UI primitives ----------
      function hit(x, y, w, h, fn) { hits.push({ x: x, y: y, w: w, h: h, fn: fn }); }
      function hovering(x, y, w, h) { return !modal && inRect({ x: x, y: y, w: w, h: h }, mx, my); }
      function panel(x, y, w, h, o) {
        o = o || {};
        g.save();
        pathRR(x, y, w, h, o.r == null ? S * 0.02 : o.r);
        g.fillStyle = o.fill || "rgba(255,255,255,0.035)"; g.fill();
        g.lineWidth = 1; g.strokeStyle = o.stroke || "rgba(255,255,255,0.08)"; g.stroke();
        g.restore();
      }
      function button(x, y, w, h, label, fn, o) {
        o = o || {};
        const hov = !o.disabled && hovering(x, y, w, h);
        g.save();
        pathRR(x, y, w, h, h / 2);
        if (o.disabled) { g.fillStyle = "rgba(255,255,255,0.03)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 1; g.stroke(); }
        else if (o.primary) {
          g.fillStyle = hov ? lighten(o.col || ctx.accent, 0.12) : rgba(o.col || ctx.accent, 0.85); g.fill();
          g.shadowColor = rgba(o.col || ctx.accent, 0.6); g.shadowBlur = hov ? S * 0.02 : S * 0.01;
          g.strokeStyle = rgba(o.col || ctx.accent, 0.9); g.lineWidth = 1; g.stroke();
        } else {
          g.fillStyle = hov ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"; g.fill();
          g.strokeStyle = o.col ? rgba(o.col, 0.6) : "rgba(255,255,255,0.14)"; g.lineWidth = 1; g.stroke();
        }
        g.restore();
        text(label, x + w / 2, y + h / 2 + 0.5, { size: o.size || Math.min(h * 0.42, S * 0.021), align: "center", wt: "700", col: o.disabled ? "rgba(230,236,245,0.35)" : o.primary ? "#0f0b18" : (o.col || "rgba(230,236,245,0.92)"), max: w * 0.92 });
        if (!o.disabled && fn) hit(x, y, w, h, fn);
      }
      function coinIcon(x, y, r) {
        g.save();
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        gr.addColorStop(0, "#fff0b0"); gr.addColorStop(0.6, "#ffd36b"); gr.addColorStop(1, "#b8860b");
        g.fillStyle = gr; g.shadowColor = "rgba(255,211,107,0.5)"; g.shadowBlur = r;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.shadowBlur = 0; g.strokeStyle = "rgba(120,80,0,0.35)"; g.lineWidth = Math.max(1, r * 0.18);
        g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.stroke();
        g.restore();
      }
      function coinText(n, x, y, size, align) {
        font("700", size); const w = g.measureText(fmt(n)).width;
        const r = size * 0.38;
        let cx = x;
        if (align === "center") cx = x - (w + r * 2.6) / 2;
        else if (align === "right") cx = x - w - r * 2.6;
        coinIcon(cx + r, y, r);
        text(fmt(n), cx + r * 2.6, y + 0.5, { size: size, wt: "700", col: "#ffd36b" });
        return w + r * 2.6;
      }
      function rarityPill(x, y, it, size) {
        const rar = rarOf(it);
        font("700", size); const w = g.measureText(rar.label.toUpperCase()).width + size * 1.2, h = size * 1.6;
        g.save(); pathRR(x, y - h / 2, w, h, h / 2); g.fillStyle = rgba(rar.col, 0.18); g.fill(); g.strokeStyle = rgba(rar.col, 0.6); g.lineWidth = 1; g.stroke(); g.restore();
        text(rar.label.toUpperCase(), x + w / 2, y + 0.5, { size: size, wt: "700", col: rar.col, align: "center" });
        return w;
      }
      function lockGlyph(x, y, s, col) {
        g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, s * 0.18); g.lineCap = "round";
        g.beginPath(); g.arc(x, y - s * 0.25, s * 0.35, Math.PI, 0); g.stroke();
        pathRR(x - s * 0.5, y - s * 0.25, s, s * 0.75, s * 0.15); g.fill(); g.restore();
      }
      function toyCard(x, y, w, h, it, o) {
        o = o || {};
        const rar = rarOf(it), ri = RI[it.rar];
        const hov = o.onClick && hovering(x, y, w, h);
        g.save();
        pathRR(x, y, w, h, S * 0.016);
        g.fillStyle = o.selected ? rgba(ctx.accent, 0.16) : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)";
        g.fill();
        g.lineWidth = o.selected ? 2 : 1;
        g.strokeStyle = o.selected ? ctx.accent : rgba(rar.col, ri >= 2 ? 0.55 : 0.22);
        if (ri >= 3) { g.shadowColor = rgba(rar.col, 0.45); g.shadowBlur = S * 0.012; }
        g.stroke();
        g.restore();
        const r = Math.min(w, h) * (o.big ? 0.3 : 0.25);
        drawToy(x + w / 2, y + h * (o.price != null ? 0.4 : 0.44), r, it, { sq: o.uid != null ? sq(o.uid) : 0, t: now, alpha: o.dim ? 0.45 : 1 });
        const nameSize = Math.min(S * 0.019, w * 0.1);
        text(it.name, x + w / 2, y + h * (o.price != null ? 0.73 : 0.82), { size: nameSize, align: "center", max: w * 0.9, col: o.dim ? "rgba(230,236,245,0.5)" : "rgba(230,236,245,0.92)" });
        if (o.price != null) coinText(o.price, x + w / 2, y + h * 0.88, nameSize * 1.05, "center");
        if (o.badge) {
          font("800", nameSize * 0.9); const bw = g.measureText(o.badge).width + nameSize;
          g.save(); pathRR(x + S * 0.006, y + S * 0.006, bw, nameSize * 1.4, nameSize * 0.7); g.fillStyle = o.badgeCol || ctx.accent; g.fill(); g.restore();
          text(o.badge, x + S * 0.006 + bw / 2, y + S * 0.006 + nameSize * 0.72, { size: nameSize * 0.9, wt: "800", align: "center", col: "#0f0b18" });
        }
        if (o.lock) lockGlyph(x + w - S * 0.018, y + S * 0.02, S * 0.02, "rgba(255,211,107,0.85)");
        if (o.onClick) hit(x, y, w, h, o.onClick);
      }
      function pager(x, y, w, h, cur, total, onPrev, onNext) {
        if (total <= 1) return;
        const bw = h;
        button(x, y, bw, h, "‹", onPrev, { disabled: cur <= 0 });
        text((cur + 1) + " / " + total, x + w / 2, y + h / 2, { size: h * 0.4, align: "center", col: "rgba(230,236,245,0.7)" });
        button(x + w - bw, y, bw, h, "›", onNext, { disabled: cur >= total - 1 });
      }
      function avatar(x, y, r, t, dim) {
        g.save();
        if (dim) g.globalAlpha = 0.4;
        g.shadowColor = rgba(t.col, 0.6); g.shadowBlur = r * 0.6;
        const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        gr.addColorStop(0, lighten(t.col, 0.4)); gr.addColorStop(1, darken(t.col, 0.25));
        g.fillStyle = gr;
        if (t.face === "robot") {
          pathRR(x - r * 0.85, y - r * 0.75, r * 1.7, r * 1.5, r * 0.3); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = darken(t.col, 0.2); g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x, y - r * 0.75); g.lineTo(x, y - r * 1.05); g.stroke();
          g.fillStyle = lighten(t.col, 0.6); g.beginPath(); g.arc(x, y - r * 1.12, r * 0.14, 0, TAU); g.fill();
          g.fillStyle = "rgba(20,30,40,0.9)"; pathRR(x - r * 0.6, y - r * 0.35, r * 1.2, r * 0.45, r * 0.15); g.fill();
          g.fillStyle = t.col; [-0.3, 0.3].forEach(function (d) { g.beginPath(); g.arc(x + d * r, y - r * 0.12, r * 0.1, 0, TAU); g.fill(); });
          g.strokeStyle = "rgba(20,30,40,0.8)"; g.lineWidth = r * 0.08; g.beginPath(); g.moveTo(x - r * 0.35, y + r * 0.35); g.lineTo(x + r * 0.35, y + r * 0.35); g.stroke();
        } else if (t.face === "cloud") {
          g.beginPath(); [[-0.45, 0.1, 0.5], [-0.1, -0.3, 0.55], [0.38, -0.05, 0.5], [0.1, 0.25, 0.5]].forEach(function (c) { g.moveTo(x + c[0] * r + c[2] * r, y + c[1] * r); g.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, TAU); }); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = "rgba(60,40,60,0.8)"; g.lineWidth = r * 0.08; g.lineCap = "round";
          [-0.28, 0.28].forEach(function (d) { g.beginPath(); g.moveTo(x + d * r - r * 0.1, y - r * 0.05); g.lineTo(x + d * r + r * 0.1, y - r * 0.05); g.stroke(); });
          g.beginPath(); g.arc(x, y + r * 0.2, r * 0.12, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
        } else if (t.face === "cat") {
          g.beginPath(); g.moveTo(x - r * 0.75, y - r * 0.3); g.lineTo(x - r * 0.65, y - r * 1.05); g.lineTo(x - r * 0.15, y - r * 0.7); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(x + r * 0.75, y - r * 0.3); g.lineTo(x + r * 0.65, y - r * 1.05); g.lineTo(x + r * 0.15, y - r * 0.7); g.closePath(); g.fill();
          g.beginPath(); g.arc(x, y, r * 0.8, 0, TAU); g.fill(); g.shadowBlur = 0;
          g.fillStyle = "rgba(40,20,50,0.9)"; [-0.3, 0.3].forEach(function (d) { g.beginPath(); g.ellipse(x + d * r, y - r * 0.1, r * 0.08, r * 0.16, 0, 0, TAU); g.fill(); });
          g.strokeStyle = "rgba(40,20,50,0.8)"; g.lineWidth = r * 0.06; g.lineCap = "round";
          g.beginPath(); g.moveTo(x - r * 0.15, y + r * 0.25); g.lineTo(x, y + r * 0.35); g.lineTo(x + r * 0.15, y + r * 0.25); g.stroke();
        } else {
          g.beginPath(); g.arc(x, y, r * 0.85, 0, TAU); g.fill(); g.shadowBlur = 0;
          g.fillStyle = darken(t.col, 0.45); g.beginPath(); g.arc(x, y - r * 0.35, r * 0.85, Math.PI * 1.05, Math.PI * 1.95); g.fill();
          g.fillStyle = "rgba(40,20,40,0.9)"; [-0.3, 0.3].forEach(function (d) { g.beginPath(); g.arc(x + d * r, y, r * 0.09, 0, TAU); g.fill(); });
          g.strokeStyle = "rgba(40,20,40,0.85)"; g.lineWidth = r * 0.07; g.lineCap = "round";
          g.beginPath(); g.arc(x, y + r * 0.2, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
          g.fillStyle = "rgba(255,120,150,0.3)"; [-0.55, 0.55].forEach(function (d) { g.beginPath(); g.arc(x + d * r, y + r * 0.2, r * 0.13, 0, TAU); g.fill(); });
        }
        g.restore();
      }
      function sparklineDraw(x, y, w, h, hist, col) {
        if (!hist || hist.length < 2) return;
        let mn = Infinity, mxv = -Infinity;
        hist.forEach(function (v) { if (v < mn) mn = v; if (v > mxv) mxv = v; });
        mn = Math.min(mn, 0.9); mxv = Math.max(mxv, 1.1);
        const px = function (i) { return x + i / (hist.length - 1) * w; };
        const py = function (v) { return y + h - (v - mn) / (mxv - mn) * h; };
        g.save();
        // baseline at 1.0
        g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 1; g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(x, py(1)); g.lineTo(x + w, py(1)); g.stroke(); g.setLineDash([]);
        g.beginPath(); hist.forEach(function (v, i) { if (i === 0) g.moveTo(px(i), py(v)); else g.lineTo(px(i), py(v)); });
        g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath();
        const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, rgba(col, 0.28)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.fill();
        g.beginPath(); hist.forEach(function (v, i) { if (i === 0) g.moveTo(px(i), py(v)); else g.lineTo(px(i), py(v)); });
        g.strokeStyle = col; g.lineWidth = Math.max(1.5, S * 0.003); g.lineJoin = "round"; g.shadowColor = rgba(col, 0.6); g.shadowBlur = S * 0.008; g.stroke();
        g.shadowBlur = 0; g.fillStyle = "#fff"; g.beginPath(); g.arc(px(hist.length - 1), py(hist[hist.length - 1]), S * 0.005, 0, TAU); g.fill();
        g.restore();
      }

      // ---------- chrome: background, top bar, tabs ----------
      function drawBackground() {
        const gr = g.createLinearGradient(0, 0, 0, S);
        gr.addColorStop(0, "#0b0a14"); gr.addColorStop(1, "#08070f");
        g.fillStyle = gr; g.fillRect(0, 0, S, S);
        const rg = g.createRadialGradient(S * 0.5, S * 0.1, 0, S * 0.5, S * 0.1, S * 0.9);
        rg.addColorStop(0, rgba(ctx.accent, 0.09)); rg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rg; g.fillRect(0, 0, S, S);
        if (!reduced) {
          bgDots.forEach(function (d) {
            const yy = ((d.y - now * d.sp) % 1 + 1) % 1;
            g.fillStyle = rgba(ctx.accent, d.a * (0.5 + 0.5 * Math.sin(now * 0.001 + d.ph)));
            g.beginPath(); g.arc(d.x * S, yy * S, d.r * S, 0, TAU); g.fill();
          });
        }
      }
      function drawTop() {
        const y = S * 0.018, h = S * 0.075;
        const ts = S * 0.036;
        font("800", ts);
        const w1 = g.measureText("Squishy ").width;
        text("Squishy", S * 0.03, y + h * 0.5, { wt: "800", size: ts, col: "rgba(230,236,245,0.95)" });
        g.save(); g.shadowColor = rgba(ctx.accent, 0.7); g.shadowBlur = S * 0.015;
        text("Bazaar", S * 0.03 + w1, y + h * 0.5, { wt: "800", size: ts, col: ctx.accent });
        g.restore();
        // coins pill
        const ph = h * 0.6, pw = S * 0.19, px = S * 0.97 - pw, py = y + (h - ph) / 2;
        panel(px, py, pw, ph, { r: ph / 2, fill: "rgba(255,211,107,0.08)", stroke: "rgba(255,211,107,0.35)" });
        coinText(save.coins, px + pw / 2, py + ph / 2, ph * 0.5, "center");
        // level pill
        const lvl = level(), lw = S * 0.27, lx = px - lw - S * 0.014;
        panel(lx, py, lw, ph, { r: ph / 2 });
        const need = xpForLevel(lvl + 1) - xpForLevel(lvl), have = save.xp - xpForLevel(lvl);
        const glow = now - levelFx < 1500;
        text("Lv " + lvl + " · " + rank(lvl), lx + S * 0.02, py + ph * 0.4, { size: ph * 0.36, wt: "700", col: glow ? ctx.accent : "rgba(230,236,245,0.9)", max: lw - S * 0.04 });
        g.save(); pathRR(lx + S * 0.02, py + ph * 0.66, lw - S * 0.04, ph * 0.14, ph * 0.07); g.fillStyle = "rgba(255,255,255,0.08)"; g.fill();
        pathRR(lx + S * 0.02, py + ph * 0.66, (lw - S * 0.04) * clamp(have / need, 0, 1), ph * 0.14, ph * 0.07); g.fillStyle = ctx.accent; g.shadowColor = ctx.accent; g.shadowBlur = 6; g.fill(); g.restore();
      }
      const TABS = [["collection", "Collection"], ["shop", "Shop"], ["trade", "Trade"], ["market", "Market"], ["games", "Games"], ["playground", "Play"]];
      function drawTabs() {
        const y = S * 0.105, h = S * 0.06, x0 = S * 0.03, w = S * 0.94 / TABS.length;
        TABS.forEach(function (tb, i) {
          const x = x0 + i * w, active = screen === tb[0] && !mini;
          const hov = hovering(x, y, w, h);
          if (active) { g.save(); pathRR(x + 2, y, w - 4, h, S * 0.014); g.fillStyle = rgba(ctx.accent, 0.14); g.fill(); g.restore(); }
          else if (hov) { g.save(); pathRR(x + 2, y, w - 4, h, S * 0.014); g.fillStyle = "rgba(255,255,255,0.05)"; g.fill(); g.restore(); }
          let label = tb[1];
          if (tb[0] === "collection") label += " " + save.inv.length;
          text(label, x + w / 2, y + h / 2, { size: Math.min(S * 0.022, w * 0.15), wt: "700", align: "center", col: active ? ctx.accent : "rgba(230,236,245,0.7)", max: w * 0.9 });
          if (active) { g.save(); g.fillStyle = ctx.accent; g.shadowColor = ctx.accent; g.shadowBlur = 8; pathRR(x + w * 0.3, y + h - 3, w * 0.4, 3, 1.5); g.fill(); g.restore(); }
          if (tb[0] === "trade" && save.bot.on) { g.save(); g.fillStyle = "#7fe0a0"; g.shadowColor = "#7fe0a0"; g.shadowBlur = 6; g.beginPath(); g.arc(x + w - S * 0.018, y + S * 0.014, S * 0.006, 0, TAU); g.fill(); g.restore(); }
          hit(x, y, w, h, function () { if (mini) { mini = null; } if (tb[0] === "playground") { enterPlayground(); sndClick(); return; } screen = tb[0]; modal = null; sndClick(); });
        });
        if (save.market.news && screen !== "market") {
          // thin ticker under the tabs
          const n = save.market.news;
          text((n.up ? "▲ " : "▼ ") + n.text, S / 2, y + h + S * 0.012, { size: S * 0.016, align: "center", col: n.up ? "rgba(127,224,160,0.75)" : "rgba(255,159,176,0.75)", max: S * 0.9 });
        }
      }
      const C = { x: 0, y: 0, w: 0, h: 0 }; // content rect
      function contentRect() { C.x = S * 0.03; C.y = S * 0.19; C.w = S * 0.94; C.h = S * 0.985 - C.y; return C; }

      // ---------- screen: Collection ----------
      function drawCollection() {
        const c = contentRect();
        text("Your collection", c.x, c.y + S * 0.022, { wt: "700", size: S * 0.026 });
        text(save.inv.length + " / " + INV_MAX + " toys · click one to squeeze, sell or lock it", c.x, c.y + S * 0.052, { size: S * 0.016, col: "rgba(230,236,245,0.55)", max: c.w * 0.55 });
        const bw = S * 0.16, bh = S * 0.042;
        button(c.x + c.w - bw, c.y + S * 0.004, bw, bh, "Sort: " + sortMode, function () { sortMode = sortMode === "rarity" ? "value" : sortMode === "value" ? "newest" : "rarity"; sndClick(); });
        const cols = S < 520 ? 4 : 5, rows = 3, per = cols * rows;
        const arr = sortedInv();
        const np = Math.max(1, Math.ceil(arr.length / per));
        pages.collection = clamp(pages.collection, 0, np - 1);
        const gy = c.y + S * 0.075, gh = c.h - S * 0.075 - (np > 1 ? S * 0.05 : 0);
        const cw = c.w / cols, ch = Math.min(gh / rows, cw * 1.18);
        const pad = S * 0.005;
        const slice = arr.slice(pages.collection * per, pages.collection * per + per);
        slice.forEach(function (x, i) {
          const r = Math.floor(i / cols), col = i % cols, it = ITEM[x.id];
          toyCard(c.x + col * cw + pad, gy + r * ch + pad, cw - pad * 2, ch - pad * 2, it, {
            uid: x.u, price: price(it), lock: x.lock,
            onClick: function () { modal = { type: "item", uid: x.u, t: now }; squeeze(x.u); }
          });
        });
        if (!arr.length) wrap("No toys yet. Hit the Shop tab to buy your first squishy, or play a mini-game for coins.", c.x + c.w * 0.1, gy + gh * 0.4, c.w * 0.8, S * 0.03, { align: "left", size: S * 0.022 });
        if (np > 1) pager(c.x + c.w * 0.3, c.y + c.h - S * 0.046, c.w * 0.4, S * 0.042, pages.collection, np, function () { pages.collection--; sndClick(); }, function () { pages.collection++; sndClick(); });
      }

      // ---------- screen: Shop ----------
      function drawShop() {
        const c = contentRect();
        text("The Shop", c.x, c.y + S * 0.022, { wt: "700", size: S * 0.026 });
        const left = Math.max(0, SHOP_CYCLE - (now - save.shop.t));
        text("New stock in " + Math.ceil(left / 1000) + "s · prices follow the Market", c.x, c.y + S * 0.052, { size: S * 0.016, col: "rgba(230,236,245,0.55)", max: c.w * 0.55 });
        const bw = S * 0.2, bh = S * 0.042;
        button(c.x + c.w - bw, c.y + S * 0.004, bw, bh, "Restock now · " + restockCost(), function () {
          const cost = restockCost();
          if (save.coins < cost) { toast("Need " + cost + " coins to restock", "#ff9fb0"); sndNo(); return; }
          save.coins -= cost; restock(true); refreshScore();
        });
        const n = shopSlots(), cols = S < 520 ? 3 : 4, rows = Math.ceil(n / cols);
        const gy = c.y + S * 0.075, gh = c.h - S * 0.075 - S * 0.05;
        const cw = c.w / cols, ch = Math.min(gh / rows, cw * 1.15);
        const pad = S * 0.006;
        for (let i = 0; i < n; i++) {
          const r = Math.floor(i / cols), col = i % cols;
          const x = c.x + col * cw + pad, y = gy + r * ch + pad, w = cw - pad * 2, h = ch - pad * 2;
          const id = save.shop.stock[i];
          if (!id) {
            g.save(); pathRR(x, y, w, h, S * 0.016); g.setLineDash([4, 5]); g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 1; g.stroke(); g.restore();
            text("sold", x + w / 2, y + h / 2, { size: S * 0.018, align: "center", col: "rgba(230,236,245,0.3)" });
            continue;
          }
          const it = ITEM[id], p = price(it), ch2 = change(it.cat);
          const isNew = !save.seen[id];
          toyCard(x, y, w, h, it, {
            price: p, badge: isNew ? "NEW" : (ch2 <= -0.08 ? "DEAL" : null), badgeCol: isNew ? ctx.accent : "#7fe0a0",
            onClick: function () { modal = { type: "buy", slot: i, t: now }; sndClick(); }
          });
        }
        wrap("Tip: watch the Market tab. When a category dips, its toys go on sale here — buy low, then sell or trade high.", c.x, c.y + c.h - S * 0.03, c.w, S * 0.02, { size: S * 0.015, col: "rgba(230,236,245,0.45)" });
      }

      // ---------- screen: Trade ----------
      function drawTrade() {
        const c = contentRect();
        let y = c.y;
        const lvl = level();
        // trader chips
        const chipW = c.w / TRADERS.length, chipH = S * 0.085;
        TRADERS.forEach(function (t, i) {
          const x = c.x + i * chipW, locked = t.lvl > lvl, active = traderId === t.id;
          const hov = !locked && hovering(x, y, chipW, chipH);
          g.save(); pathRR(x + 2, y, chipW - 4, chipH, S * 0.016);
          g.fillStyle = active ? rgba(t.col, 0.16) : hov ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"; g.fill();
          g.strokeStyle = active ? rgba(t.col, 0.8) : "rgba(255,255,255,0.08)"; g.lineWidth = active ? 1.5 : 1; g.stroke(); g.restore();
          avatar(x + chipH * 0.5, y + chipH * 0.5, chipH * 0.3, t, locked);
          text(t.name, x + chipH * 0.95, y + chipH * 0.36, { size: Math.min(S * 0.02, chipW * 0.12), wt: "700", col: locked ? "rgba(230,236,245,0.4)" : "rgba(230,236,245,0.95)", max: chipW - chipH });
          text(locked ? "unlocks at Lv " + t.lvl : t.sub, x + chipH * 0.95, y + chipH * 0.66, { size: Math.min(S * 0.015, chipW * 0.09), col: "rgba(230,236,245,0.5)", max: chipW - chipH });
          if (!locked) hit(x, y, chipW, chipH, function () { selectTrader(t.id); });
        });
        y += chipH + S * 0.012;
        const t = curTrader();
        if (!t) {
          panel(c.x, y, c.w, S * 0.08);
          wrap("Pick a trader above. Each one has tastes — they'll pay more for toys they love and less for ones they don't. Or flip on your Auto-Trader below and let your own bot hunt deals.", c.x + S * 0.02, y + S * 0.025, c.w - S * 0.04, S * 0.024, { size: S * 0.018 });
          drawBotPanel(c.x, c.y + c.h - S * 0.085, c.w, S * 0.085);
          return;
        }
        const tr = ensureTrader(t.id);
        // speech bubble
        const bh = S * 0.058;
        g.save(); pathRR(c.x, y, c.w, bh, S * 0.016); g.fillStyle = rgba(t.col, 0.1); g.fill(); g.strokeStyle = rgba(t.col, 0.35); g.lineWidth = 1; g.stroke();
        g.beginPath(); g.moveTo(c.x + chipW * (TRADERS.indexOf(t) + 0.5) - S * 0.01, y + 1); g.lineTo(c.x + chipW * (TRADERS.indexOf(t) + 0.5), y - S * 0.012); g.lineTo(c.x + chipW * (TRADERS.indexOf(t) + 0.5) + S * 0.01, y + 1); g.fillStyle = rgba(t.col, 0.35); g.fill(); g.restore();
        const sp = speech && speech.who === t.id ? speech.text : t.hi[0];
        text(t.name + ": ", c.x + S * 0.02, y + bh / 2, { size: S * 0.019, wt: "800", col: t.col });
        font("800", S * 0.019); const nw = g.measureText(t.name + ": ").width;
        text(sp, c.x + S * 0.02 + nw, y + bh / 2, { size: S * 0.019, wt: "500", col: "rgba(230,236,245,0.92)", max: c.w - S * 0.05 - nw });
        y += bh + S * 0.012;
        // their toys
        text(t.name + "'s toys — click to ask for one", c.x, y + S * 0.01, { size: S * 0.016, col: "rgba(230,236,245,0.6)" });
        const likes = t.id === "velour" ? "loves Rare & up" : "loves " + t.likes.map(function (k) { return CATS[k].label; }).join(" & ") + (t.dislikes.length ? " · dislikes " + CATS[t.dislikes[0]].label : "");
        text(likes, c.x + c.w, y + S * 0.01, { size: S * 0.015, align: "right", col: rgba(t.col, 0.9), max: c.w * 0.5 });
        y += S * 0.028;
        const cw = c.w / 6, ch = S * 0.125, pad = S * 0.004;
        tr.inv.slice(0, 6).forEach(function (id, i) {
          const it = ITEM[id], selI = offer.theirs.indexOf(i) >= 0;
          toyCard(c.x + i * cw + pad, y, cw - pad * 2, ch, it, { price: price(it), selected: selI, badge: selI ? "ASK" : null, onClick: function () { toggleTheirs(i); } });
        });
        y += ch + S * 0.012;
        // deal bar
        drawDealBar(c.x, y, c.w, S * 0.078, t);
        y += S * 0.078 + S * 0.012;
        // my toys
        text("Your toys — click to offer (max 3)", c.x, y + S * 0.01, { size: S * 0.016, col: "rgba(230,236,245,0.6)" });
        const arr = sortedInv(), per = 12, np = Math.max(1, Math.ceil(arr.length / per));
        pages.trade = clamp(pages.trade, 0, np - 1);
        if (np > 1) pager(c.x + c.w - S * 0.22, y - S * 0.008, S * 0.22, S * 0.036, pages.trade, np, function () { pages.trade--; sndClick(); }, function () { pages.trade++; sndClick(); });
        y += S * 0.028;
        const botH = S * 0.085, botY = c.y + c.h - botH;
        const ch2 = Math.min(S * 0.12, (botY - S * 0.012 - y) / 2);
        arr.slice(pages.trade * per, pages.trade * per + per).forEach(function (x, i) {
          const r = Math.floor(i / 6), col = i % 6, it = ITEM[x.id], selM = offer.mine.indexOf(x.u) >= 0;
          toyCard(c.x + col * cw + pad, y + r * ch2, cw - pad * 2, ch2 - pad, it, { uid: x.u, price: price(it), selected: selM, badge: selM ? "GIVE" : null, lock: x.lock, onClick: function () { toggleMine(x.u); } });
        });
        if (!arr.length) text("You have no toys to offer — visit the Shop.", c.x, y + ch2 * 0.5, { size: S * 0.018, col: "rgba(230,236,245,0.5)" });
        drawBotPanel(c.x, botY, c.w, botH);
      }
      function drawDealBar(x, y, w, h, t) {
        panel(x, y, w, h, { fill: "rgba(255,255,255,0.045)" });
        let giveV = 0, getV = 0;
        const tr = ensureTrader(t.id);
        offer.mine.forEach(function (u) { const it = inst(u); if (it) giveV += price(ITEM[it.id]); });
        offer.theirs.forEach(function (i) { if (tr.inv[i]) getV += price(ITEM[tr.inv[i]]); });
        const r = dealRatio();
        const col = r >= 1 ? "#7fe0a0" : r >= 0.8 ? "#ffd36b" : "#ff9fb0";
        text("You give " + offer.mine.length + " · worth " + fmt(giveV), x + S * 0.02, y + h * 0.27, { size: S * 0.017, col: "rgba(230,236,245,0.85)" });
        text("You get " + offer.theirs.length + " · worth " + fmt(getV), x + w * 0.5, y + h * 0.27, { size: S * 0.017, col: "rgba(230,236,245,0.85)" });
        const view = offer.mine.length || offer.theirs.length ? Math.round(Math.min(r, 2) * 100) + "%" : "—";
        text(t.name + "'s view: " + view, x + w - S * 0.02, y + h * 0.27, { size: S * 0.017, align: "right", col: col, wt: "800" });
        // meter
        const mw = w * 0.44, mx0 = x + S * 0.02, my0 = y + h * 0.6, mh = h * 0.2;
        g.save(); pathRR(mx0, my0, mw, mh, mh / 2); g.fillStyle = "rgba(255,255,255,0.08)"; g.fill();
        pathRR(mx0, my0, mw * clamp(r / 1.25, 0, 1), mh, mh / 2); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8; g.fill();
        g.restore();
        // the 100% line
        g.save(); g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mx0 + mw * 0.8, my0 - 3); g.lineTo(mx0 + mw * 0.8, my0 + mh + 3); g.stroke(); g.restore();
        const bw = Math.min(S * 0.17, w * 0.2), bh = h * 0.42;
        button(x + w - S * 0.02 - bw, y + h * 0.5, bw, bh, "Propose", propose, { primary: true, col: t.col });
        button(x + w - S * 0.03 - bw * 2, y + h * 0.5, bw, bh, "Clear", function () { offer = { mine: [], theirs: [] }; sndClick(); });
      }
      function drawBotPanel(x, y, w, h) {
        const on = save.bot.on, unlocked = botUnlocked();
        panel(x, y, w, h, { fill: on ? "rgba(127,224,160,0.06)" : "rgba(255,255,255,0.03)", stroke: on ? "rgba(127,224,160,0.35)" : "rgba(255,255,255,0.08)" });
        const bw = Math.min(S * 0.24, w * 0.3), bh = Math.min(S * 0.042, h * 0.5);
        button(x + S * 0.015, y + (h - bh) / 2, bw, bh, unlocked ? ("Auto-Trader: " + (on ? "ON" : "OFF")) : "Auto-Trader · Lv 2", toggleBot, { primary: on, col: on ? "#7fe0a0" : null, disabled: false });
        const tx = x + S * 0.03 + bw;
        if (!unlocked) { wrap("Your own trading bot. Unlocks at level 2 — it buys market dips, sells highs and hunts good swaps for you.", tx, y + h * 0.32, w - (tx - x) - S * 0.02, S * 0.02, { size: S * 0.015, col: "rgba(230,236,245,0.55)" }); return; }
        const log = save.bot.log;
        if (log.length) {
          text(log[0].s, tx, y + h * 0.3, { size: S * 0.016, col: on ? "rgba(230,236,245,0.92)" : "rgba(230,236,245,0.6)", max: w - (tx - x) - S * 0.02 });
          if (log[1]) text(log[1].s, tx, y + h * 0.55, { size: S * 0.014, col: "rgba(230,236,245,0.5)", max: w - (tx - x) - S * 0.02 });
        } else text(on ? "Bot is warming up…" : "Flip it on and the bot trades for you while you play.", tx, y + h * 0.35, { size: S * 0.016, col: "rgba(230,236,245,0.6)", max: w - (tx - x) - S * 0.02 });
        text("bot earned " + fmt(save.bot.earned) + " · " + save.bot.trades + " deals", tx, y + h * 0.8, { size: S * 0.013, col: "rgba(127,224,160,0.7)", max: w - (tx - x) - S * 0.02 });
      }

      // ---------- screen: Market ----------
      function drawMarket() {
        const c = contentRect();
        text("The Market", c.x, c.y + S * 0.022, { wt: "700", size: S * 0.026 });
        text("live prices · every toy's price = base × its category's index", c.x, c.y + S * 0.052, { size: S * 0.016, col: "rgba(230,236,245,0.55)", max: c.w * 0.7 });
        let y = c.y + S * 0.075;
        const n = save.market.news;
        const nh = S * 0.05;
        g.save(); pathRR(c.x, y, c.w, nh, S * 0.014);
        g.fillStyle = n ? (n.up ? "rgba(127,224,160,0.1)" : "rgba(255,159,176,0.1)") : "rgba(255,255,255,0.035)"; g.fill();
        g.strokeStyle = n ? (n.up ? "rgba(127,224,160,0.4)" : "rgba(255,159,176,0.4)") : "rgba(255,255,255,0.08)"; g.stroke(); g.restore();
        text(n ? (n.up ? "▲ NEWS: " : "▼ NEWS: ") + n.text : "NEWS: quiet day at the bazaar. Prices drift on their own.", c.x + S * 0.02, y + nh / 2, { size: S * 0.017, wt: "600", col: n ? (n.up ? "#7fe0a0" : "#ff9fb0") : "rgba(230,236,245,0.6)", max: c.w - S * 0.04 });
        y += nh + S * 0.012;
        const rowH = (c.h - (y - c.y) - S * 0.04) / CAT_KEYS.length;
        CAT_KEYS.forEach(function (k, i) {
          const cat = CATS[k], m = save.market.cats[k].m, ch = change(k);
          const ry = y + i * rowH;
          const hov = hovering(c.x, ry, c.w, rowH);
          g.save(); pathRR(c.x, ry + 2, c.w, rowH - 4, S * 0.014); g.fillStyle = hov ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)"; g.fill(); g.restore();
          g.save(); g.fillStyle = cat.hue; g.shadowColor = cat.hue; g.shadowBlur = 8; g.beginPath(); g.arc(c.x + S * 0.025, ry + rowH / 2, S * 0.008, 0, TAU); g.fill(); g.restore();
          text(cat.label, c.x + S * 0.045, ry + rowH * 0.38, { size: S * 0.02, wt: "700", max: c.w * 0.22 });
          const owned = save.inv.filter(function (x) { return ITEM[x.id].cat === k; }).length;
          text(owned ? "you own " + owned : cat.desc, c.x + S * 0.045, ry + rowH * 0.68, { size: S * 0.014, col: owned ? rgba(cat.hue, 0.85) : "rgba(230,236,245,0.5)", max: c.w * 0.22 });
          sparklineDraw(c.x + c.w * 0.3, ry + rowH * 0.2, c.w * 0.38, rowH * 0.6, save.market.cats[k].hist, cat.hue);
          const col = m >= 1.12 ? "#7fe0a0" : m <= 0.88 ? "#ff9fb0" : "rgba(230,236,245,0.9)";
          text("×" + m.toFixed(2), c.x + c.w - S * 0.02, ry + rowH * 0.38, { size: S * 0.022, wt: "800", align: "right", col: col });
          text((ch >= 0 ? "▲ +" : "▼ ") + Math.round(ch * 100) + "%" + (m >= 1.15 ? "  · SELL" : m <= 0.88 ? "  · BUY" : ""), c.x + c.w - S * 0.02, ry + rowH * 0.68, { size: S * 0.015, align: "right", col: ch >= 0 ? "rgba(127,224,160,0.85)" : "rgba(255,159,176,0.85)" });
        });
        wrap("×1.00 is normal. Below 0.90 = cheap, time to buy. Above 1.15 = pricey, time to sell. News shocks move a whole category at once.", c.x, c.y + c.h - S * 0.022, c.w, S * 0.02, { size: S * 0.015, col: "rgba(230,236,245,0.45)" });
      }

      // ---------- screen: Games hub ----------
      function drawGames() {
        const c = contentRect();
        text("Mini-games — earn coins", c.x, c.y + S * 0.022, { wt: "700", size: S * 0.026 });
        text("coins won: " + fmt(save.stats.mini), c.x + c.w, c.y + S * 0.022, { size: S * 0.017, align: "right", col: "rgba(255,211,107,0.85)" });
        const lvl = level();
        const cards = [
          { title: "Bounce Pool", desc: "Pull one of your squishies back like a slingshot, let go, and bank it in a pocket. Pegs give bonus coins. 5 shots.", pay: "8–25 coins per pocket", unlocked: true, start: startPool, col: "#74b9ff" },
          { title: "Sort Rush", desc: "Toys fly in one at a time — sort each into the right bin before the 30-second clock runs out. Listen: each toy plays its sound.", pay: "3 coins per sort + streak bonuses", unlocked: lvl >= 3, lvlNeed: 3, start: startSort, col: "#ff8fd0" }
        ];
        const wide = S >= 520;
        const gy = c.y + S * 0.06;
        const cw = wide ? (c.w - S * 0.02) / 2 : c.w, chh = wide ? c.h * 0.7 : (c.h - S * 0.12) / 2;
        cards.forEach(function (cd, i) {
          const x = wide ? c.x + i * (cw + S * 0.02) : c.x, y = wide ? gy : gy + i * (chh + S * 0.015);
          const hov = cd.unlocked && hovering(x, y, cw, chh);
          panel(x, y, cw, chh, { fill: hov ? rgba(cd.col, 0.08) : "rgba(255,255,255,0.035)", stroke: cd.unlocked ? rgba(cd.col, 0.4) : "rgba(255,255,255,0.08)" });
          // preview art (desktop only — phones stack the cards and have no room)
          const px = x + cw / 2, py = y + chh * 0.3, pr = Math.min(cw, chh) * 0.18;
          g.save(); if (!cd.unlocked) g.globalAlpha = 0.35;
          if (!wide) { /* no art */ }
          else if (i === 0) {
            g.fillStyle = rgba(cd.col, 0.12); pathRR(px - pr * 1.6, py - pr * 1.2, pr * 3.2, pr * 2.4, pr * 0.3); g.fill();
            g.strokeStyle = rgba(cd.col, 0.6); g.lineWidth = 2; g.stroke();
            [-1.1, 0, 1.1].forEach(function (d) { g.fillStyle = "rgba(0,0,0,0.6)"; g.beginPath(); g.arc(px + d * pr, py - pr * 0.75, pr * 0.28, 0, TAU); g.fill(); });
            const prev = save.inv.length ? ITEM[save.inv[0].id] : ITEMS[0];
            drawToy(px, py + pr * 0.6, pr * 0.35, prev, { t: now });
            g.setLineDash([3, 5]); g.strokeStyle = "rgba(255,255,255,0.4)"; g.beginPath(); g.moveTo(px, py + pr * 0.5); g.lineTo(px + pr * 0.9, py - pr * 0.6); g.stroke();
          } else {
            g.fillStyle = rgba(cd.col, 0.12); pathRR(px - pr * 1.6, py - pr * 0.4, pr * 1.3, pr * 1.3, pr * 0.2); g.fill(); pathRR(px + pr * 0.3, py - pr * 0.4, pr * 1.3, pr * 1.3, pr * 0.2); g.fill();
            drawToy(px, py - pr * 0.55, pr * 0.4, ITEM.crunch_star, { t: now });
            text("◀", px - pr * 0.95, py + pr * 0.25, { size: pr * 0.5, align: "center", col: rgba(cd.col, 0.8) });
            text("▶", px + pr * 0.95, py + pr * 0.25, { size: pr * 0.5, align: "center", col: rgba(cd.col, 0.8) });
          }
          g.restore();
          const tY = wide ? 0.58 : 0.13, dY = wide ? 0.68 : 0.27, pY = wide ? 0.87 : 0.64;
          text(cd.title, x + cw / 2, y + chh * tY, { size: S * 0.026, wt: "800", align: "center", col: cd.unlocked ? cd.col : "rgba(230,236,245,0.5)" });
          wrap(cd.desc, x + S * 0.02, y + chh * dY, cw - S * 0.04, S * 0.021, { size: S * 0.016, col: "rgba(230,236,245,0.7)" });
          text(cd.pay, x + cw / 2, y + chh * pY, { size: S * 0.015, align: "center", col: "rgba(255,211,107,0.8)" });
          const bw = S * 0.16, bh = S * 0.042;
          if (cd.unlocked) button(x + cw / 2 - bw / 2, y + chh - bh - S * 0.012, bw, bh, "Play", function () { cd.start(); sndClick(); }, { primary: true, col: cd.col });
          else button(x + cw / 2 - bw / 2, y + chh - bh - S * 0.012, bw, bh, "Level " + cd.lvlNeed, null, { disabled: true });
        });
        // stats + reset
        const sy = c.y + c.h - S * 0.05;
        text("trades " + save.stats.trades + " · bought " + save.stats.bought + " · sold " + save.stats.sold + " · squeezes " + save.stats.squeezes + " · best worth " + fmt(save.stats.bestWorth), c.x, sy, { size: S * 0.014, col: "rgba(230,236,245,0.45)", max: c.w * 0.75 });
        button(c.x + c.w - S * 0.12, sy - S * 0.018, S * 0.12, S * 0.036, "Reset save", function () { modal = { type: "confirm", text: "Erase your whole collection, coins and progress? This can't be undone.", yes: function () { save = newSave(); hydrate(); persist(); squish = {}; offer = { mine: [], theirs: [] }; traderId = null; screen = "collection"; modal = { type: "intro" }; refreshScore(); toast("Fresh start!", ctx.accent); }, t: now }; sndClick(); }, { size: S * 0.014 });
      }

      // =====================================================================
      //  MINI-GAME 1 — Bounce Pool (slingshot a squishy into a pocket)
      // =====================================================================
      function payMult() { return 1 + 0.12 * (level() - 1); }
      function poolRect() {
        const c = contentRect();
        const h = c.h - S * 0.105;                       // leave room under the table for toasts
        const w = Math.min(c.w, h * 0.82);
        return { x: (S - w) / 2, y: c.y + S * 0.045, w: w, h: h };
      }
      function startPool() {
        const owned = save.inv.length ? ITEM[rnd(save.inv).id] : ITEM.rubber_bouncer;
        mini = { kind: "pool", toy: owned, shots: 5, shot: 0, coins: 0, pegHits: 0, ball: { x: 0, y: 0, vx: 0, vy: 0, moving: false }, pegs: [], pockets: [], T: null, rb: 0, sink: null, rest: 0, done: false, lastBump: 0, trail: [], pegFx: [0, 0, 0], pocketFx: [0, 0, 0], sqv: 0, best: 0 };
        layoutPool(); resetBall();
        toast("Drag the toy back, let go to shoot!", ctx.accent);
      }
      function layoutPool() {
        const m = mini; const T = poolRect(); m.T = T;
        const rb = T.w * 0.05; m.rb = rb;
        m.pockets = [
          { x: T.x + rb * 1.7, y: T.y + rb * 1.7, r: rb * 1.45, val: 8 },
          { x: T.x + T.w / 2, y: T.y + rb * 1.5, r: rb * 1.2, val: 25 },
          { x: T.x + T.w - rb * 1.7, y: T.y + rb * 1.7, r: rb * 1.45, val: 8 }
        ];
        m.pegs = [
          { x: T.x + T.w * 0.3, y: T.y + T.h * 0.42, r: rb * 0.65 },
          { x: T.x + T.w * 0.7, y: T.y + T.h * 0.42, r: rb * 0.65 },
          { x: T.x + T.w * 0.5, y: T.y + T.h * 0.6, r: rb * 0.65 }
        ];
        if (!m.ball.moving) resetBall();
      }
      function resetBall() {
        const m = mini, T = m.T;
        m.ball = { x: T.x + T.w / 2, y: T.y + T.h - m.rb * 2.4, vx: 0, vy: 0, moving: false };
        m.trail = []; m.sink = null; m.rest = 0;
      }
      function launchBall(dx, dy) {
        const m = mini;
        const len = Math.hypot(dx, dy);
        if (len < m.rb * 0.6) return;
        const cap = m.T.w * 0.45;
        const k = Math.min(1, cap / len);
        const K = 0.009;
        m.ball.vx = dx * k * K; m.ball.vy = dy * k * K; m.ball.moving = true;
        m.sqv = 0.6;
        playToy(m.toy, 0.7, 0);
      }
      function poolBump(strength) {
        const m = mini;
        if (now - m.lastBump < 90) return;
        m.lastBump = now; m.sqv = Math.min(1, 0.35 + strength);
        playToy(m.toy, clamp(0.25 + strength * 0.6, 0.2, 0.8), 0);
      }
      function updatePool(dt) {
        const m = mini, b = m.ball, T = m.T, rb = m.rb;
        m.sqv = Math.max(0, m.sqv - dt / 380);
        for (let i = 0; i < 3; i++) { m.pegFx[i] = Math.max(0, m.pegFx[i] - dt / 400); m.pocketFx[i] = Math.max(0, m.pocketFx[i] - dt / 900); }
        if (m.done) return;
        if (m.sink) {
          m.sink.t += dt;
          if (m.sink.t > 800) nextShot();
          return;
        }
        if (m.rest > 0) { m.rest -= dt; if (m.rest <= 0) nextShot(); return; }
        if (!b.moving) return;
        const steps = Math.max(1, Math.ceil(dt / 4)), h = dt / steps;
        for (let s = 0; s < steps; s++) {
          b.x += b.vx * h; b.y += b.vy * h;
          const sp = Math.hypot(b.vx, b.vy);
          // cushions
          if (b.x - rb < T.x) { b.x = T.x + rb; b.vx = -b.vx * 0.82; poolBump(sp * 300 / S); }
          if (b.x + rb > T.x + T.w) { b.x = T.x + T.w - rb; b.vx = -b.vx * 0.82; poolBump(sp * 300 / S); }
          if (b.y - rb < T.y) { b.y = T.y + rb; b.vy = -b.vy * 0.82; poolBump(sp * 300 / S); }
          if (b.y + rb > T.y + T.h) { b.y = T.y + T.h - rb; b.vy = -b.vy * 0.82; poolBump(sp * 300 / S); }
          // pegs
          for (let i = 0; i < m.pegs.length; i++) {
            const p = m.pegs[i], dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
            if (d < rb + p.r && d > 0) {
              const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny;
              if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; b.vx *= 0.9; b.vy *= 0.9; }
              b.x = p.x + nx * (rb + p.r + 0.5); b.y = p.y + ny * (rb + p.r + 0.5);
              if (m.pegFx[i] <= 0.5) {
                m.pegFx[i] = 1; m.pegHits++;
                const bonus = Math.round(1 * payMult());
                m.coins += bonus; save.coins += bonus; save.stats.mini += bonus; markDirty();
                ctx.audio.tone(880 + i * 120, 0.08, { type: "sine", vol: 0.1, glide: 1200 });
                m.sqv = 0.5;
              }
            }
          }
          // pockets
          for (let i = 0; i < m.pockets.length; i++) {
            const p = m.pockets[i];
            if (Math.hypot(b.x - p.x, b.y - p.y) < p.r * 0.85) {
              const win = Math.round(p.val * payMult());
              m.coins += win; save.coins += win; save.stats.mini += win; addXp(Math.ceil(win / 3));
              m.sink = { t: 0, i: i, win: win }; m.pocketFx[i] = 1;
              b.moving = false;
              sndCoin(win); playToy(m.toy, 0.9, 0.1);
              spawnConfetti(p.x, p.y, win >= 20 ? 40 : 18);
              refreshScore();
              return;
            }
          }
          // friction
          const f = Math.pow(0.9978, h); b.vx *= f; b.vy *= f;
          if (Math.hypot(b.vx, b.vy) < 0.00005 * S) { b.vx = b.vy = 0; b.moving = false; m.rest = 500; break; }
        }
        if (!reduced) { m.trail.push({ x: b.x, y: b.y, a: 1 }); if (m.trail.length > 22) m.trail.shift(); }
        m.trail.forEach(function (p) { p.a -= dt / 500; });
        m.trail = m.trail.filter(function (p) { return p.a > 0; });
      }
      function nextShot() {
        const m = mini;
        m.shot++;
        if (m.shot >= m.shots) { m.done = true; m.sink = null; if (m.coins > 0) ctx.audio.score(); return; }
        resetBall();
      }
      function drawPool() {
        const m = mini, T = m.T, rb = m.rb;
        // rails + felt
        g.save();
        pathRR(T.x - rb * 0.9, T.y - rb * 0.9, T.w + rb * 1.8, T.h + rb * 1.8, rb * 1.2);
        g.fillStyle = "rgba(60,44,90,0.9)"; g.shadowColor = rgba(ctx.accent, 0.35); g.shadowBlur = S * 0.03; g.fill(); g.shadowBlur = 0;
        g.strokeStyle = rgba(ctx.accent, 0.5); g.lineWidth = 2; g.stroke();
        pathRR(T.x, T.y, T.w, T.h, rb * 0.6);
        const felt = g.createRadialGradient(T.x + T.w / 2, T.y + T.h * 0.45, T.w * 0.1, T.x + T.w / 2, T.y + T.h / 2, T.w * 0.9);
        felt.addColorStop(0, "#1c1a3a"); felt.addColorStop(1, "#0f0d22");
        g.fillStyle = felt; g.fill();
        g.restore();
        // pockets
        m.pockets.forEach(function (p, i) {
          g.save();
          const fx = m.pocketFx[i];
          g.fillStyle = "rgba(0,0,0,0.85)"; g.shadowColor = i === 1 ? "#ffd36b" : ctx.accent; g.shadowBlur = rb * (0.5 + fx * 1.5);
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = i === 1 ? rgba("#ffd36b", 0.6 + fx * 0.4) : rgba(ctx.accent, 0.5 + fx * 0.5); g.lineWidth = 2; g.stroke();
          g.restore();
          coinText(Math.round(p.val * payMult()), p.x, p.y + p.r + S * 0.016, S * 0.015, "center");
        });
        // pegs
        m.pegs.forEach(function (p, i) {
          g.save();
          const fx = m.pegFx[i];
          const gr = g.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
          gr.addColorStop(0, lighten("#74b9ff", 0.5 + fx * 0.4)); gr.addColorStop(1, "#2a4a8a");
          g.fillStyle = gr; g.shadowColor = "#74b9ff"; g.shadowBlur = p.r * (0.8 + fx * 2);
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
          g.restore();
        });
        // trail
        m.trail.forEach(function (p) { g.fillStyle = rgba(m.toy.ca, p.a * 0.25); g.beginPath(); g.arc(p.x, p.y, rb * 0.6 * p.a, 0, TAU); g.fill(); });
        // rubber band + aim guide
        if (drag && drag.kind === "pool") {
          const b = m.ball;
          let dx = b.x - drag.x, dy = b.y - drag.y;
          const len = Math.hypot(dx, dy), cap = T.w * 0.45, k = Math.min(1, cap / Math.max(1, len));
          const px = b.x - dx * k, py = b.y - dy * k;
          g.save();
          g.strokeStyle = rgba(ctx.accent, 0.8); g.lineWidth = Math.max(2, rb * 0.16); g.lineCap = "round";
          g.beginPath(); g.moveTo(px, py); g.lineTo(b.x, b.y); g.stroke();
          g.setLineDash([rb * 0.3, rb * 0.35]); g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 2;
          g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + dx * k * 2.2, b.y + dy * k * 2.2); g.stroke();
          g.restore();
          text(Math.round(k * len / cap * 100) + "% power", b.x, b.y - rb * 2.2, { size: S * 0.016, align: "center", col: rgba(ctx.accent, 0.9) });
        }
        // ball
        if (!m.sink) drawToy(m.ball.x, m.ball.y, rb, m.toy, { t: now, sq: m.sqv });
        else {
          const p = m.pockets[m.sink.i], k = clamp(m.sink.t / 500, 0, 1);
          drawToy(lerp(m.ball.x, p.x, k), lerp(m.ball.y, p.y, k), rb * (1 - k * 0.9), m.toy, { t: now, alpha: 1 - k });
          text("+" + m.sink.win, p.x, p.y - p.r - S * 0.02 - k * S * 0.03, { size: S * 0.03, wt: "800", align: "center", col: "#ffd36b" });
        }
        // HUD
        const hy = T.y - S * 0.028;
        text("Bounce Pool · shot " + Math.min(m.shot + 1, m.shots) + " / " + m.shots, T.x, hy, { size: S * 0.019, wt: "700" });
        if (S >= 520) text(m.toy.name, T.x + T.w / 2, hy, { size: S * 0.015, align: "center", col: rgba(m.toy.ca, 0.9), max: T.w * 0.3 });
        coinText(m.coins, T.x + T.w, hy, S * 0.02, "right");
        if (!m.ball.moving && !m.done && !m.sink && !drag) text("drag the toy back, release to shoot", T.x + T.w / 2, T.y + T.h - rb * 0.9, { size: S * 0.015, align: "center", col: "rgba(255,255,255,0.4)" });
        if (m.done) {
          const pw = Math.min(S * 0.6, T.w * 0.9), ph = S * 0.26, px = (S - pw) / 2, py = T.y + T.h / 2 - ph / 2;
          panel(px, py, pw, ph, { fill: "rgba(16,13,28,0.96)", stroke: rgba(ctx.accent, 0.5) });
          text("Round over!", px + pw / 2, py + ph * 0.2, { size: S * 0.03, wt: "800", align: "center", col: ctx.accent });
          text("You banked", px + pw / 2, py + ph * 0.42, { size: S * 0.018, align: "center", col: "rgba(230,236,245,0.7)" });
          coinText(m.coins, px + pw / 2, py + ph * 0.56, S * 0.034, "center");
          const bw = pw * 0.4, bh = S * 0.045;
          button(px + pw * 0.06, py + ph - bh - S * 0.02, bw, bh, "Play again", function () { startPool(); sndClick(); }, { primary: true });
          button(px + pw * 0.54, py + ph - bh - S * 0.02, bw, bh, "Back to games", function () { mini = null; screen = "games"; sndClick(); });
        }
      }
      function poolPointer(phase, x, y) {
        const m = mini, b = m.ball;
        if (phase === "down") {
          if (m.done || m.sink || b.moving || m.rest > 0) return false;
          if (Math.hypot(x - b.x, y - b.y) > m.rb * 3) return false;
          drag = { kind: "pool", x: x, y: y }; return true;
        }
        if (!drag || drag.kind !== "pool") return false;
        if (phase === "move") { drag.x = x; drag.y = y; return true; }
        if (phase === "up") { const dx = b.x - drag.x, dy = b.y - drag.y; drag = null; launchBall(dx, dy); return true; }
        return false;
      }

      // =====================================================================
      //  MINI-GAME 2 — Sort Rush (sort toys into the right bin, 30 seconds)
      // =====================================================================
      function startSort() {
        mini = { kind: "sort", timeLeft: 30000, cur: null, bins: [], streak: 0, bestStreak: 0, coins: 0, ok: 0, n: 0, since: 0, fly: null, wrongFx: 0, done: false, enter: 0 };
        sortPickBins(); sortSpawn();
        toast("Left or right — sort each toy into its bin!", ctx.accent);
      }
      function sortPickBins() {
        const a = rnd(CAT_KEYS); let b = rnd(CAT_KEYS); while (b === a) b = rnd(CAT_KEYS);
        mini.bins = [a, b]; mini.since = 0;
      }
      function sortSpawn() {
        const m = mini;
        const cat = m.bins[Math.random() < 0.5 ? 0 : 1];
        const pool = ITEMS.filter(function (i) { return i.cat === cat; });
        m.cur = rnd(pool); m.enter = 0;
        playToy(m.cur, 0.45, 0.05);
      }
      function sortAnswer(side) {
        const m = mini; if (!m || m.kind !== "sort" || m.done || !m.cur || m.fly) return;
        const idx = side === "left" ? 0 : 1;
        const correct = m.cur.cat === m.bins[idx];
        m.n++;
        if (correct) {
          m.streak++; m.bestStreak = Math.max(m.bestStreak, m.streak); m.ok++;
          let win = 3; if (m.streak % 5 === 0) { win += 5; ctx.audio.combo(m.streak); spawnConfetti(S / 2, S * 0.45, 20); }
          win = Math.round(win * payMult());
          m.coins += win; save.coins += win; save.stats.mini += win; markDirty();
          ctx.audio.pick();
        } else { m.streak = 0; m.wrongFx = 1; sndNo(); }
        m.fly = { side: idx, t: 0, it: m.cur, ok: correct };
        m.cur = null;
        m.since++; if (m.since >= 5) sortPickBins();
      }
      function updateSort(dt) {
        const m = mini;
        if (m.done) return;
        m.wrongFx = Math.max(0, m.wrongFx - dt / 350);
        m.enter = Math.min(1, m.enter + dt / 220);
        if (m.fly) { m.fly.t += dt; if (m.fly.t > 230) { m.fly = null; sortSpawn(); } }
        m.timeLeft -= dt;
        if (m.timeLeft <= 0) { m.timeLeft = 0; m.done = true; m.cur = null; m.fly = null; addXp(Math.ceil(m.coins / 3)); refreshScore(); if (m.coins > 0) ctx.audio.score(); }
      }
      function drawSort() {
        const m = mini, c = contentRect();
        // timer bar
        const tw = c.w, ty = c.y + S * 0.01, th = S * 0.014;
        g.save(); pathRR(c.x, ty, tw, th, th / 2); g.fillStyle = "rgba(255,255,255,0.08)"; g.fill();
        const frac = m.timeLeft / 30000, tcol = frac < 0.25 ? "#ff9fb0" : ctx.accent;
        pathRR(c.x, ty, tw * frac, th, th / 2); g.fillStyle = tcol; g.shadowColor = tcol; g.shadowBlur = 8; g.fill(); g.restore();
        text("Sort Rush · " + Math.ceil(m.timeLeft / 1000) + "s", c.x, ty + S * 0.035, { size: S * 0.019, wt: "700" });
        text("streak " + m.streak, c.x + c.w / 2, ty + S * 0.035, { size: S * 0.017, align: "center", col: m.streak >= 5 ? "#ffd36b" : "rgba(230,236,245,0.7)" });
        coinText(m.coins, c.x + c.w, ty + S * 0.035, S * 0.02, "right");
        // bins
        const by = c.y + c.h * 0.5, bh = c.h * 0.46, bw = c.w * 0.44;
        const bins = [{ x: c.x, cat: m.bins[0] }, { x: c.x + c.w - bw, cat: m.bins[1] }];
        bins.forEach(function (b, i) {
          const cat = CATS[b.cat];
          const hov = hovering(b.x, by, bw, bh);
          g.save(); pathRR(b.x, by, bw, bh, S * 0.03);
          g.fillStyle = rgba(cat.hue, hov ? 0.16 : 0.09); g.fill();
          g.strokeStyle = rgba(cat.hue, 0.6); g.lineWidth = 2; g.shadowColor = rgba(cat.hue, 0.5); g.shadowBlur = S * 0.02; g.stroke();
          g.restore();
          text(cat.label, b.x + bw / 2, by + bh * 0.4, { size: Math.min(S * 0.034, bw * 0.16), wt: "800", align: "center", col: cat.hue, max: bw * 0.9 });
          text(cat.desc, b.x + bw / 2, by + bh * 0.55, { size: S * 0.016, align: "center", col: "rgba(230,236,245,0.6)", max: bw * 0.9 });
          text(i === 0 ? "◀  left" : "right  ▶", b.x + bw / 2, by + bh * 0.82, { size: S * 0.018, align: "center", col: "rgba(255,255,255,0.4)" });
          if (!m.done) hit(b.x, by, bw, bh, function () { sortAnswer(i === 0 ? "left" : "right"); });
        });
        // current toy
        const cx = S / 2, cy = c.y + c.h * 0.27;
        if (m.cur) {
          const k = 1 - Math.pow(1 - m.enter, 3);
          const r = S * 0.075 * k;
          if (m.wrongFx > 0) { g.save(); g.translate(Math.sin(now * 0.08) * m.wrongFx * S * 0.01, 0); }
          drawToy(cx, cy, r, m.cur, { t: now });
          if (m.wrongFx > 0) g.restore();
          text(m.cur.name, cx, cy + S * 0.11, { size: S * 0.022, wt: "700", align: "center" });
          rarityPill(cx - S * 0.04, cy + S * 0.14, m.cur, S * 0.013);
        }
        if (m.fly) {
          const k = m.fly.t / 230, b = bins[m.fly.side];
          drawToy(lerp(cx, b.x + bw / 2, k), lerp(cy, by + bh * 0.3, k), S * 0.075 * (1 - k * 0.6), m.fly.it, { t: now, alpha: 1 - k * 0.5 });
          text(m.fly.ok ? "✓" : "✗", cx, cy - S * 0.1 - k * S * 0.04, { size: S * 0.05, wt: "800", align: "center", col: m.fly.ok ? "#7fe0a0" : "#ff9fb0" });
        }
        if (m.done) {
          const pw = Math.min(S * 0.6, c.w * 0.9), ph = S * 0.3, px = (S - pw) / 2, py = c.y + c.h / 2 - ph / 2;
          panel(px, py, pw, ph, { fill: "rgba(16,13,28,0.96)", stroke: rgba(ctx.accent, 0.5) });
          text("Time!", px + pw / 2, py + ph * 0.17, { size: S * 0.03, wt: "800", align: "center", col: ctx.accent });
          text(m.ok + " / " + m.n + " sorted · best streak " + m.bestStreak, px + pw / 2, py + ph * 0.36, { size: S * 0.018, align: "center", col: "rgba(230,236,245,0.75)" });
          coinText(m.coins, px + pw / 2, py + ph * 0.54, S * 0.034, "center");
          const bw2 = pw * 0.4, bh2 = S * 0.045;
          button(px + pw * 0.06, py + ph - bh2 - S * 0.02, bw2, bh2, "Play again", function () { startSort(); sndClick(); }, { primary: true });
          button(px + pw * 0.54, py + ph - bh2 - S * 0.02, bw2, bh2, "Back to games", function () { mini = null; screen = "games"; sndClick(); });
        }
      }

      // =====================================================================
      //  MODALS, TOASTS, FX
      // =====================================================================
      function drawModal() {
        if (!modal) return;
        const m = modal;
        g.fillStyle = "rgba(4,3,10,0.74)"; g.fillRect(0, 0, S, S);
        const closeable = m.type !== "intro" && m.type !== "confirm";
        hit(0, 0, S, S, function () { if (closeable) { modal = null; sndClick(); } });
        const pw = Math.min(S * 0.8, S - 30);
        let ph = S * 0.62;
        if (m.type === "confirm") ph = S * 0.3;
        if (m.type === "traded") ph = S * 0.56;
        if (m.type === "intro") ph = S * 0.7;
        const px = (S - pw) / 2, py = (S - ph) / 2;
        panel(px, py, pw, ph, { fill: "rgba(16,13,28,0.97)", stroke: rgba(ctx.accent, 0.45), r: S * 0.03 });
        hit(px, py, pw, ph, function () {});
        const bh = S * 0.048;
        if (m.type === "item" || m.type === "buy") {
          const x = m.type === "item" ? inst(m.uid) : null;
          const it = m.type === "item" ? (x ? ITEM[x.id] : null) : ITEM[save.shop.stock[m.slot] || ""];
          if (!it) { modal = null; return; }
          const r = S * 0.11, tx = px + pw / 2, ty = py + ph * 0.28;
          drawToy(tx, ty, r, it, { t: now, sq: x ? sq(x.u) : (squish["shop"] ? clamp(squish["shop"].s, -0.5, 1) : 0) });
          hit(tx - r * 1.3, ty - r * 1.3, r * 2.6, r * 2.6, function () { if (x) squeeze(x.u); else { squish["shop"] = { s: 0, v: 0.05 }; playToy(it, 1, 0); } });
          text("click the toy to squeeze it", tx, ty + r * 1.35, { size: S * 0.014, align: "center", col: "rgba(255,255,255,0.35)" });
          text(it.name, tx, py + ph * 0.56, { size: S * 0.03, wt: "800", align: "center", max: pw * 0.9 });
          font("700", S * 0.014); const pillW = g.measureText(rarOf(it).label.toUpperCase()).width + S * 0.014 * 1.2;
          const catLabel = CATS[it.cat].label;
          font("600", S * 0.017); const catW = g.measureText(catLabel).width;
          const totalW = pillW + S * 0.015 + catW;
          rarityPill(tx - totalW / 2, py + ph * 0.635, it, S * 0.014);
          text(catLabel, tx - totalW / 2 + pillW + S * 0.015, py + ph * 0.635, { size: S * 0.017, col: CATS[it.cat].hue });
          const p = price(it);
          if (m.type === "item") {
            text("worth " + fmt(p) + " · sells for " + fmt(sellPrice(it)) + (x.lock ? " · LOCKED (bot won't sell it)" : ""), tx, py + ph * 0.71, { size: S * 0.016, align: "center", col: "rgba(230,236,245,0.65)", max: pw * 0.92 });
            const bw = (pw - S * 0.08) / 3;
            button(px + S * 0.03, py + ph - bh - S * 0.03, bw, bh, "Sell · " + fmt(sellPrice(it)), function () { sell(x.u, false); modal = null; }, { primary: true, col: "#ffd36b" });
            button(px + S * 0.04 + bw, py + ph - bh - S * 0.03, bw, bh, x.lock ? "Unlock" : "Lock", function () { x.lock = !x.lock; markDirty(); sndClick(); toast(x.lock ? "Locked — the bot will never sell it" : "Unlocked", x.lock ? "#ffd36b" : "#a9b4c4"); });
            button(px + S * 0.05 + bw * 2, py + ph - bh - S * 0.03, bw, bh, "Close", function () { modal = null; sndClick(); });
          } else {
            text("price " + fmt(p) + " · you have " + fmt(save.coins) + " coins" + (change(it.cat) <= -0.08 ? " · " + catLabel + " is on sale!" : ""), tx, py + ph * 0.71, { size: S * 0.016, align: "center", col: save.coins >= p ? "rgba(230,236,245,0.65)" : "#ff9fb0", max: pw * 0.92 });
            const bw = (pw - S * 0.08) / 3;
            button(px + S * 0.03, py + ph - bh - S * 0.03, bw, bh, "Buy · " + fmt(p), function () { if (buy(m.slot, false)) modal = null; }, { primary: true, disabled: save.coins < p });
            button(px + S * 0.04 + bw, py + ph - bh - S * 0.03, bw, bh, "Hear it", function () { squish["shop"] = { s: 0, v: 0.05 }; playToy(it, 1, 0); });
            button(px + S * 0.05 + bw * 2, py + ph - bh - S * 0.03, bw, bh, "Cancel", function () { modal = null; sndClick(); });
          }
        } else if (m.type === "traded") {
          const t = TRADER[m.who];
          text("Deal with " + t.name + "!", px + pw / 2, py + S * 0.05, { size: S * 0.03, wt: "800", align: "center", col: t.col });
          const half = pw / 2;
          text("you gave", px + half * 0.5, py + S * 0.1, { size: S * 0.015, align: "center", col: "rgba(230,236,245,0.5)" });
          text("you got", px + half * 1.5, py + S * 0.1, { size: S * 0.015, align: "center", col: "rgba(230,236,245,0.5)" });
          const drawRow = function (ids, cx0, cy0) {
            const n = ids.length, r = Math.min(S * 0.05, half * 0.8 / Math.max(1, n) * 0.4);
            ids.forEach(function (id, i) { const it = ITEM[id]; const x = cx0 + (i - (n - 1) / 2) * r * 2.6; drawToy(x, cy0, r, it, { t: now, sq: 0.15 * Math.sin(now * 0.006 + i) }); text(it.name, x, cy0 + r * 1.7, { size: S * 0.012, align: "center", max: r * 2.5, col: "rgba(230,236,245,0.75)" }); });
          };
          drawRow(m.gave, px + half * 0.5, py + ph * 0.42);
          drawRow(m.got, px + half * 1.5, py + ph * 0.42);
          text("⇄", px + half, py + ph * 0.42, { size: S * 0.04, align: "center", col: rgba(t.col, 0.8) });
          wrap(speech && speech.who === t.id ? '"' + speech.text + '"' : "", px + S * 0.03, py + ph * 0.7, pw - S * 0.06, S * 0.022, { size: S * 0.017, col: t.col, align: "left" });
          button(px + pw / 2 - S * 0.1, py + ph - bh - S * 0.03, S * 0.2, bh, "Sweet!", function () { modal = null; sndClick(); }, { primary: true, col: t.col });
        } else if (m.type === "confirm") {
          wrap(m.text, px + S * 0.04, py + ph * 0.3, pw - S * 0.08, S * 0.026, { size: S * 0.019 });
          const bw = pw * 0.36;
          button(px + pw * 0.1, py + ph - bh - S * 0.03, bw, bh, "Yes, erase it", function () { const f = m.yes; modal = null; f(); }, { primary: true, col: "#ff9fb0" });
          button(px + pw * 0.54, py + ph - bh - S * 0.03, bw, bh, "No", function () { modal = null; sndClick(); });
        } else if (m.type === "intro") {
          text("Welcome to the", px + pw / 2, py + S * 0.05, { size: S * 0.02, align: "center", col: "rgba(230,236,245,0.6)" });
          g.save(); g.shadowColor = rgba(ctx.accent, 0.7); g.shadowBlur = S * 0.02;
          text("Squishy Bazaar", px + pw / 2, py + S * 0.095, { size: S * 0.042, wt: "800", align: "center", col: ctx.accent });
          g.restore();
          const demo = [ITEM.mini_bun, ITEM.rubber_bouncer, ITEM.crunch_bead];
          demo.forEach(function (it, i) { drawToy(px + pw / 2 + (i - 1) * S * 0.13, py + S * 0.19, S * 0.045, it, { t: now, sq: 0.2 * Math.max(0, Math.sin(now * 0.004 + i * 2)) }); });
          const lines = [
            "You start with 3 toys and 150 coins.",
            "COLLECTION — click a toy to squeeze it. Every toy has its own sound.",
            "SHOP — buy toys. Prices move with the MARKET, so buy when a category dips.",
            "TRADE — swap toys with bot traders (each has tastes), or turn on your own Auto-Trader.",
            "GAMES — Bounce Pool & Sort Rush pay out coins.",
            "Level up to unlock Rare → Epic → Super → Legendary toys."
          ];
          let yy = py + S * 0.27;
          lines.forEach(function (l) { yy += wrap(l, px + S * 0.04, yy, pw - S * 0.08, S * 0.022, { size: S * 0.0165, col: "rgba(230,236,245,0.85)" }) * S * 0.022 + S * 0.008; });
          button(px + pw / 2 - S * 0.11, py + ph - bh - S * 0.03, S * 0.22, bh, "Let's go!", function () { save.intro = true; markDirty(); modal = null; ctx.audio.start(); }, { primary: true });
        }
      }
      function drawToasts() {
        toasts.forEach(function (t, i) {
          const age = now - t.t, life = 3200;
          const a = age < 200 ? age / 200 : age > life - 400 ? (life - age) / 400 : 1;
          if (a <= 0) return;
          const h = S * 0.036, y = S * 0.905 - (toasts.length - 1 - i) * (h + S * 0.008);
          font("600", S * 0.016); const w = Math.min(S * 0.9, g.measureText(t.text).width + S * 0.05);
          g.save(); g.globalAlpha = a;
          pathRR(S / 2 - w / 2, y, w, h, h / 2); g.fillStyle = "rgba(16,13,28,0.94)"; g.fill(); g.strokeStyle = rgba(t.col, 0.6); g.lineWidth = 1; g.stroke();
          text(t.text, S / 2, y + h / 2, { size: S * 0.016, align: "center", col: t.col, max: w - S * 0.03 });
          g.restore();
        });
      }
      function drawConfetti() {
        confetti.forEach(function (c) {
          g.save(); g.globalAlpha = clamp(c.life, 0, 1); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.x * 0.05 + c.y * 0.03);
          g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore();
        });
      }
      function drawLevelFlash() {
        const age = now - levelFx;
        if (age > 1400) return;
        const a = (1 - age / 1400) * 0.35;
        const rg = g.createRadialGradient(S / 2, S * 0.1, 0, S / 2, S * 0.1, S);
        rg.addColorStop(0, rgba(ctx.accent, a)); rg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rg; g.fillRect(0, 0, S, S);
      }


      // =====================================================================
      //  PLAYGROUND — no UI, no text: just your squishies and toys to mess with them
      // =====================================================================
      const PG_TOOLS = ["hand", "slide", "tramp", "spring", "fan", "magnet", "whirl", "bubble", "cannon", "wreck", "stomp", "zerog", "rain"];
      const PG_LABEL = { hand: "grab & fling", slide: "place a slide", tramp: "place a trampoline", fan: "place a fan", magnet: "hold to attract", whirl: "hold to swirl", cannon: "click to fire a toy", stomp: "click to stomp", bubble: "bubble a toy (click again to pop)", spring: "place a spring launcher", wreck: "wrecking ball — drag it back, let go", zerog: "zero gravity", rain: "drop them all again" };
      let pg = null;

      function pgToyList() {
        if (save.inv.length) return save.inv.map(function (x) { return { uid: x.u, it: ITEM[x.id] }; });
        return [{ uid: -1, it: ITEM.mini_bun }, { uid: -2, it: ITEM.rubber_bouncer }, { uid: -3, it: ITEM.crunch_bead }];
      }
      function pgRadius(it) { return S * (0.03 + RI[it.rar] * 0.0045); }
      function pgFloor() { return S - Math.min(S * 0.058, S * 0.09) * 1.85; }   // toys rest above the tool dock
      function enterPlayground() {
        const list = pgToyList();
        const key = list.map(function (t) { return t.uid; }).join(",") + "@" + S;
        if (!pg) pg = { tool: "hand", objs: [], zeroG: false, fx: [], key: "", toys: [], grabbed: null, down: false, px: S / 2, py: S / 2, lastPointer: 0, hover: -1, ball: null };
        if (pg.key !== key) {
          pg.key = key;
          pg.toys = list.map(function (t, i) { const r = pgRadius(t.it); return { uid: t.uid, it: t.it, r: r, x: S * (0.1 + Math.random() * 0.8), y: -r - Math.random() * S * 0.6 - i * r * 0.4, vx: 0, vy: 0, sq: 0, sqv: 0, lastSnd: -9999, onSlide: 0, bubble: 0 }; });
          pg.objs = []; pg.ball = null;
        }
        pg.grabbed = null; pg.down = false; pg.lastPointer = now;
        screen = "playground"; modal = null; mini = null; toasts = [];
      }
      function pgRain() {
        pg.toys.forEach(function (t, i) { t.x = S * (0.08 + Math.random() * 0.84); t.y = -t.r - Math.random() * S * 0.5 - i * t.r * 0.3; t.vx = (Math.random() - 0.5) * S * 0.0004; t.vy = 0; });
        ctx.audio.arp([660, 520, 440], { dur: 0.12, step: 0.06, vol: 0.08, type: "sine" });
      }
      function pgSound(t, strength, w) {
        if (now - t.lastSnd < 160) return;
        t.lastSnd = now;
        playToy(t.it, clamp(strength, 0.15, 0.95), w || 0);
      }
      function pgImpact(t, sp) {
        const n = sp / (S * 0.0012);
        t.sq = Math.min(1, t.sq + clamp(n * 0.7, 0.15, 0.9)); t.sqv = 0;
        if (n > 0.28) pgSound(t, 0.2 + n * 0.5);
      }
      function slidePts(o) {
        const d = o.dir, x = o.x, y = o.y;
        return [{ x: x, y: y }, { x: x + d * S * 0.12, y: y + S * 0.14 }, { x: x + d * S * 0.27, y: y + S * 0.21 }, { x: x + d * S * 0.36, y: y + S * 0.17 }];
      }
      function trampPts(o) { return [{ x: o.x - S * 0.1, y: o.y }, { x: o.x + S * 0.1, y: o.y }]; }
      // circle vs segment. e = restitution, fric = tangential keep-ratio, boost = trampoline multiplier
      function collideSeg(t, a, b, e, fric, boost) {
        const abx = b.x - a.x, aby = b.y - a.y, L2 = abx * abx + aby * aby;
        let u = ((t.x - a.x) * abx + (t.y - a.y) * aby) / L2; u = clamp(u, 0, 1);
        const cx = a.x + abx * u, cy = a.y + aby * u;
        const dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy);
        if (d >= t.r || d === 0) return false;
        const nx = dx / d, ny = dy / d;
        t.x = cx + nx * t.r; t.y = cy + ny * t.r;
        const vn = t.vx * nx + t.vy * ny;
        if (vn < 0) {
          t.vx -= (1 + e) * vn * nx; t.vy -= (1 + e) * vn * ny;
          if (boost && ny < -0.5) { t.vx *= boost; t.vy *= boost; }
          const tx = -ny, ty = nx, vt = t.vx * tx + t.vy * ty;
          t.vx -= vt * (1 - fric) * tx; t.vy -= vt * (1 - fric) * ty;
          if (-vn > S * 0.0003) pgImpact(t, -vn * (boost ? 2 : 1));
        }
        return true;
      }
      function updatePlayground(dt) {
        const p = pg; if (!p) return;
        const G = p.zeroG ? 0 : S * 0.0000022;
        const vmax = S * 0.0032;
        const steps = 2, h = dt / steps;
        for (let s = 0; s < steps; s++) {
          for (let i = 0; i < p.toys.length; i++) {
            const t = p.toys[i];
            if (t === p.grabbed) continue;
            if (t.bubble > 0) {
              // floating in a bubble: gentle lift + wobble, strong air drag
              t.bubble -= h;
              t.vy += (-S * 0.0000012 - t.vy * 0.004) * h; t.vx += (Math.sin(now * 0.002 + t.r) * S * 0.0000004 - t.vx * 0.002) * h;
              if (t.bubble <= 0) pgPop(t);
            } else t.vy += G * h;
            if (p.down && (p.tool === "magnet" || p.tool === "whirl")) {
              const dx = p.px - t.x, dy = p.py - t.y, d = Math.max(S * 0.03, Math.hypot(dx, dy));
              const f = S * 0.0000045 * h * Math.min(3, S * 0.5 / d);
              if (p.tool === "magnet") { t.vx += dx / d * f; t.vy += dy / d * f - G * h * 0.8; }
              else { t.vx += (-dy / d) * f * 1.4 + dx / d * f * 0.25; t.vy += (dx / d) * f * 1.4 + dy / d * f * 0.25 - G * h * 0.7; }
            }
            for (let k = 0; k < p.objs.length; k++) {
              const o = p.objs[k];
              if (o.kind === "fan" && Math.abs(t.x - o.x) < S * 0.075 && t.y < o.y) { t.vy -= (G * 1.8 + S * 0.0000007) * h; t.vx += Math.sin(now * 0.004 + i) * S * 0.0000007 * h; }
            }
            const damp = Math.pow(p.zeroG ? 0.99996 : 0.9994, h); t.vx *= damp; t.vy *= damp;
            const sp = Math.hypot(t.vx, t.vy); if (sp > vmax) { t.vx *= vmax / sp; t.vy *= vmax / sp; }
            t.x += t.vx * h; t.y += t.vy * h;
            const e = p.zeroG ? 0.98 : 0.55;
            if (t.x - t.r < 0) { t.x = t.r; if (t.vx < 0) { pgImpact(t, -t.vx); t.vx = -t.vx * e; } }
            if (t.x + t.r > S) { t.x = S - t.r; if (t.vx > 0) { pgImpact(t, t.vx); t.vx = -t.vx * e; } }
            const FL = pgFloor();
            if (t.y + t.r > FL) { t.y = FL - t.r; if (t.vy > 0) { pgImpact(t, t.vy); t.vy = -t.vy * e; if (Math.abs(t.vy) < S * 0.00015) t.vy = 0; } t.vx *= Math.pow(0.996, h); }
            if (t.y - t.r < 0 && t.vy < 0 && t.y > -t.r) { t.y = t.r; if (t.bubble > 0) pgPop(t); pgImpact(t, -t.vy); t.vy = -t.vy * e; }
            if (t.bubble > 0 && (t.x <= t.r + 0.5 || t.x >= S - t.r - 0.5)) pgPop(t);
            for (let k = 0; k < p.objs.length; k++) {
              const o = p.objs[k];
              if (o.kind === "slide") {
                const pts = slidePts(o);
                for (let q = 0; q < pts.length - 1; q++) if (collideSeg(t, pts[q], pts[q + 1], 0.12, 0.9985)) { if (t.onSlide <= 0) pgSound(t, 0.3); t.onSlide = 250; }
              } else if (o.kind === "tramp") { const tp = trampPts(o); collideSeg(t, tp[0], tp[1], 0.9, 1, 1.3); }
              else if (o.kind === "spring") {
                const sp2 = springPts(o);
                if (collideSeg(t, sp2[0], sp2[1], 0.1, 0.6) && o.cd <= 0 && t.y < o.y) {
                  o.cd = 320; o.comp = 1;
                  t.vy = -S * 0.0036; t.vx *= 0.4; t.sq = 1; t.sqv = 0; t.lastSnd = -9999; pgSound(t, 0.9);
                  ctx.audio.tone(180, 0.18, { type: "triangle", vol: 0.12, glide: 720 });
                }
              }
            }
            if (p.ball) pgBallHit(t);
            t.onSlide -= h;
          }
          for (let i = 0; i < p.toys.length; i++) for (let j = i + 1; j < p.toys.length; j++) {
            const a = p.toys[i], b = p.toys[j];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), md = a.r + b.r;
            if (d >= md || d === 0) continue;
            const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
            const ga = a === p.grabbed, gb = b === p.grabbed;
            if (!ga) { a.x -= nx * ov * (gb ? 2 : 1); a.y -= ny * ov * (gb ? 2 : 1); }
            if (!gb) { b.x += nx * ov * (ga ? 2 : 1); b.y += ny * ov * (ga ? 2 : 1); }
            const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (vn < 0) {
              const jimp = -(1 + 0.65) * vn / 2;
              if (!ga) { a.vx -= jimp * nx; a.vy -= jimp * ny; }
              if (!gb) { b.vx += jimp * nx; b.vy += jimp * ny; }
              if (-vn > S * 0.0004) { pgImpact(a, -vn * 0.8); pgImpact(b, -vn * 0.8); }
            }
          }
        }
        p.toys.forEach(function (t) { t.sqv += (-t.sq * 0.0009 - t.sqv * 0.011) * dt; t.sq += t.sqv * dt; if (Math.abs(t.sq) < 0.002 && Math.abs(t.sqv) < 0.00005) { t.sq = 0; t.sqv = 0; } });
        if (p.grabbed) {
          const t = p.grabbed, k = Math.min(1, dt / 35);
          const nx = clamp(t.x + (p.px - t.x) * k, t.r, S - t.r), ny = clamp(t.y + (p.py - t.y) * k, t.r, pgFloor() - t.r);
          const vx = (nx - t.x) / Math.max(1, dt), vy = (ny - t.y) / Math.max(1, dt);
          t.vx = t.vx * 0.4 + vx * 0.6; t.vy = t.vy * 0.4 + vy * 0.6;
          t.x = nx; t.y = ny;
        }
        p.objs.forEach(function (o) { if (o.kind === "spring") { o.cd = (o.cd || 0) - dt; o.comp = Math.max(0, (o.comp || 0) - dt / 260); } });
        if (p.ball) pgBallUpdate(dt);
        p.fx = p.fx.filter(function (f) { f.t += dt; if (f.kind === "bubble") { f.y -= S * 0.00012 * dt; f.x += Math.sin(f.t * 0.004 + f.r) * S * 0.0002 * dt; } return f.t < f.dur; });
      }
      function pgPop(t) {
        t.bubble = 0; t.sq = Math.min(1, t.sq + 0.5); t.sqv = 0;
        ctx.audio.tone(900 + Math.random() * 400, 0.06, { type: "sine", vol: 0.12, glide: 300, attack: 0.002 });
        pg.fx.push({ kind: "ring", x: t.x, y: t.y, t: 0, dur: 350, r: t.r * 2.2, col: "#a6ffe8" });
      }
      function springPts(o) { return [{ x: o.x - S * 0.06, y: o.y }, { x: o.x + S * 0.06, y: o.y }]; }
      // ---- wrecking ball: a heavy pendulum hung from the top; drag it back and let go ----
      function pgBallMake(x) {
        const r = S * 0.062, L = Math.min(S * 0.55, pgFloor() - r - S * 0.02);
        pg.ball = { ax: clamp(x, S * 0.15, S * 0.85), ay: 0, L: L, r: r, th: 0, w: 0, grab: false, lastHit: -9999 };
        ctx.audio.thunk();
      }
      function pgBallPos(b) { return { x: b.ax + Math.sin(b.th) * b.L, y: b.ay + Math.cos(b.th) * b.L }; }
      function pgBallVel(b) { return { x: Math.cos(b.th) * b.L * b.w, y: -Math.sin(b.th) * b.L * b.w }; }
      function pgBallUpdate(dt) {
        const b = pg.ball;
        if (b.grab) {
          const th = clamp(Math.atan2(pg.px - b.ax, Math.max(S * 0.05, pg.py - b.ay)), -1.45, 1.45);
          b.w = b.w * 0.5 + ((th - b.th) / Math.max(1, dt)) * 0.5; b.th = th;
          return;
        }
        const G = pg.zeroG ? S * 0.0000004 : S * 0.0000022;
        b.w += -(G / b.L) * Math.sin(b.th) * dt;
        b.w *= Math.pow(0.9997, dt);
        b.th += b.w * dt;
        if (b.th > 1.5) { b.th = 1.5; b.w = -Math.abs(b.w) * 0.6; } if (b.th < -1.5) { b.th = -1.5; b.w = Math.abs(b.w) * 0.6; }
      }
      function pgBallHit(t) {
        const b = pg.ball, bp = pgBallPos(b), bv = pgBallVel(b);
        const dx = t.x - bp.x, dy = t.y - bp.y, d = Math.hypot(dx, dy), md = t.r + b.r;
        if (d >= md || d === 0) return;
        const nx = dx / d, ny = dy / d;
        t.x = bp.x + nx * md; t.y = bp.y + ny * md;
        const bs = Math.hypot(bv.x, bv.y), vn = (t.vx - bv.x) * nx + (t.vy - bv.y) * ny;
        if (vn < 0) { t.vx -= 1.6 * vn * nx; t.vy -= 1.6 * vn * ny; }
        t.vx += nx * bs * 0.4; t.vy += ny * bs * 0.4;
        if (t.bubble > 0) pgPop(t);
        if (bs > S * 0.0003) { pgImpact(t, bs * 1.5); if (now - b.lastHit > 120) { b.lastHit = now; ctx.audio.tone(90, 0.12, { type: "sine", vol: Math.min(0.25, 0.08 + bs / S * 120), glide: 50 }); } }
      }
      function pgToyAt(x, y) {
        for (let i = pg.toys.length - 1; i >= 0; i--) { const t = pg.toys[i]; if (Math.hypot(x - t.x, y - t.y) <= t.r * 1.15) return t; }
        return null;
      }
      function pgPlace(kind, x, y) {
        const p = pg;
        for (let i = 0; i < p.objs.length; i++) { const o = p.objs[i]; if (o.kind === kind && Math.hypot(o.x - x, o.y - y) < S * 0.07) { p.objs.splice(i, 1); ctx.audio.thunk(); return; } }
        const same = p.objs.filter(function (o) { return o.kind === kind; });
        if (same.length >= 4) p.objs.splice(p.objs.indexOf(same[0]), 1);
        const o = { kind: kind, x: x, y: clamp(y, S * 0.08, pgFloor() - S * 0.03), dir: x < S / 2 ? 1 : -1 };
        if (kind === "tramp") o.x = clamp(x, S * 0.11, S * 0.89);
        if (kind === "spring") { o.x = clamp(x, S * 0.07, S * 0.93); o.cd = 0; o.comp = 0; }
        p.objs.push(o); ctx.audio.place();
      }
      function pgPointer(phase, x, y) {
        const p = pg; if (!p) return;
        p.px = x; p.py = y; p.lastPointer = now;
        if (phase === "down") {
          p.down = true;
          if (p.ball && (p.tool === "hand" || p.tool === "wreck")) {
            const bp = pgBallPos(p.ball);
            if (Math.hypot(x - bp.x, y - bp.y) <= p.ball.r * 1.3) { p.ball.grab = true; p.ball.w = 0; ctx.audio.tone(140, 0.08, { type: "triangle", vol: 0.08 }); return; }
          }
          if (p.tool === "hand") {
            const t = pgToyAt(x, y);
            if (t) { p.grabbed = t; p.toys.splice(p.toys.indexOf(t), 1); p.toys.push(t); t.sq = Math.min(1, t.sq + 0.55); t.sqv = 0; t.lastSnd = -9999; pgSound(t, 0.85); }
          } else if (p.tool === "slide" || p.tool === "tramp" || p.tool === "fan" || p.tool === "spring") pgPlace(p.tool, x, y);
          else if (p.tool === "bubble") {
            const t = pgToyAt(x, y);
            if (t) {
              if (t.bubble > 0) pgPop(t);
              else { t.bubble = 9000; t.vy = Math.min(t.vy, 0) - S * 0.0002; t.sq = Math.min(1, t.sq + 0.3); t.lastSnd = -9999; pgSound(t, 0.5); ctx.audio.tone(500, 0.25, { type: "sine", vol: 0.07, glide: 1400, attack: 0.05 }); }
            } else {
              for (let i = 0; i < 6; i++) p.fx.push({ kind: "bubble", x: x + (Math.random() - 0.5) * S * 0.04, y: y + (Math.random() - 0.5) * S * 0.04, t: 0, dur: 1800 + Math.random() * 1500, r: S * (0.008 + Math.random() * 0.016) });
              ctx.audio.tone(700 + Math.random() * 300, 0.12, { type: "sine", vol: 0.05, glide: 1200, attack: 0.03 });
            }
          } else if (p.tool === "wreck") {
            if (p.ball) { const bp = pgBallPos(p.ball); if (Math.hypot(x - bp.x, y - bp.y) <= p.ball.r * 1.3) { p.ball = null; ctx.audio.thunk(); return; } }
            pgBallMake(x);
          }
          else if (p.tool === "cannon") {
            if (!p.toys.length) return;
            const t = rnd(p.toys); if (t === p.grabbed) p.grabbed = null;
            const ox = S * 0.07, oy = pgFloor() - S * 0.05;
            t.x = ox; t.y = oy;
            const dx = x - ox, dy = y - oy, d = Math.max(1, Math.hypot(dx, dy));
            const sp = clamp(d * 0.0055, S * 0.0012, S * 0.0032);
            t.vx = dx / d * sp; t.vy = dy / d * sp; t.sq = 0.7; t.lastSnd = -9999;
            pgSound(t, 0.9); ctx.audio.thunk();
            p.fx.push({ kind: "ring", x: ox, y: oy, t: 0, dur: 400, r: S * 0.08, col: ctx.accent });
          } else if (p.tool === "stomp") {
            const R = S * 0.17; let n = 0;
            p.toys.forEach(function (t) {
              const dx = t.x - x, dy = t.y - y, d = Math.hypot(dx, dy);
              if (d > R + t.r) return;
              const k = 1 - clamp(d / (R + t.r), 0, 1);
              t.sq = 1; t.sqv = 0;
              t.vx += (d > 1 ? dx / d : 0) * S * 0.0016 * k; t.vy += (d > 1 ? dy / d : 0) * S * 0.0012 * k - S * 0.0011 * k;
              if (n < 5) { t.lastSnd = -9999; pgSound(t, 0.9, n * 0.07); }
              n++;
            });
            ctx.audio.thunk();
            p.fx.push({ kind: "ring", x: x, y: y, t: 0, dur: 500, r: R, col: "#ff9fb0" });
          }
          return;
        }
        if (phase === "up") { p.down = false; p.grabbed = null; if (p.ball && p.ball.grab) { p.ball.grab = false; } }
      }
      function pgDock(kind) {
        const p = pg;
        if (kind === "zerog") { p.zeroG = !p.zeroG; ctx.audio.tone(p.zeroG ? 300 : 500, 0.2, { type: "sine", vol: 0.08, glide: p.zeroG ? 600 : 250 }); if (p.zeroG) p.toys.forEach(function (t) { t.vy -= S * 0.0004 * (0.5 + Math.random()); }); return; }
        if (kind === "rain") { pgRain(); return; }
        p.tool = kind; sndClick();
      }
      function pgIcon(kind, x, y, s, col) {
        g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1.5, s * 0.1); g.lineCap = "round"; g.lineJoin = "round";
        const u = s * 0.5;
        if (kind === "hand") { g.beginPath(); g.moveTo(-u * 0.5, -u * 0.9); g.lineTo(u * 0.6, u * 0.1); g.lineTo(u * 0.05, u * 0.2); g.lineTo(u * 0.35, u * 0.85); g.lineTo(-u * 0.05, u * 0.4); g.lineTo(-u * 0.5, u * 0.7); g.closePath(); g.fill(); }
        else if (kind === "slide") { g.beginPath(); g.moveTo(-u, -u * 0.8); g.lineTo(-u * 0.4, u * 0.1); g.lineTo(u * 0.4, u * 0.6); g.lineTo(u, u * 0.35); g.stroke(); g.beginPath(); g.arc(-u * 0.75, -u * 0.95, u * 0.22, 0, TAU); g.fill(); }
        else if (kind === "tramp") { g.beginPath(); g.moveTo(-u, u * 0.2); g.lineTo(u, u * 0.2); g.moveTo(-u * 0.7, u * 0.2); g.lineTo(-u * 0.85, u * 0.9); g.moveTo(u * 0.7, u * 0.2); g.lineTo(u * 0.85, u * 0.9); g.moveTo(0, -u * 0.9); g.lineTo(0, -u * 0.1); g.moveTo(-u * 0.35, -u * 0.55); g.lineTo(0, -u * 0.9); g.lineTo(u * 0.35, -u * 0.55); g.stroke(); }
        else if (kind === "fan") { for (let i = -1; i <= 1; i++) { g.beginPath(); for (let k = 0; k <= 8; k++) { const yy = u * 0.9 - k / 8 * u * 1.8; const xx = i * u * 0.55 + Math.sin(k * 0.8 + i) * u * 0.18; if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke(); } }
        else if (kind === "magnet") { g.lineWidth = Math.max(2, s * 0.18); g.beginPath(); g.arc(0, -u * 0.1, u * 0.65, Math.PI, 0); g.moveTo(-u * 0.65, -u * 0.1); g.lineTo(-u * 0.65, u * 0.7); g.moveTo(u * 0.65, -u * 0.1); g.lineTo(u * 0.65, u * 0.7); g.stroke(); }
        else if (kind === "whirl") { g.beginPath(); for (let a = 0; a < 4.5 * Math.PI; a += 0.25) { const r = a / (4.5 * Math.PI) * u; const xx = Math.cos(a) * r, yy = Math.sin(a) * r; if (a === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); } g.stroke(); }
        else if (kind === "cannon") { g.beginPath(); g.arc(-u * 0.35, u * 0.35, u * 0.5, 0, TAU); g.fill(); g.lineWidth = Math.max(2, s * 0.2); g.beginPath(); g.moveTo(-u * 0.2, u * 0.2); g.lineTo(u * 0.7, -u * 0.7); g.stroke(); g.beginPath(); g.arc(u * 0.85, -u * 0.85, u * 0.12, 0, TAU); g.fill(); }
        else if (kind === "stomp") { g.beginPath(); g.moveTo(0, -u); g.lineTo(0, u * 0.3); g.moveTo(-u * 0.45, -u * 0.15); g.lineTo(0, u * 0.3); g.lineTo(u * 0.45, -u * 0.15); g.moveTo(-u, u * 0.75); g.lineTo(u, u * 0.75); g.stroke(); }
        else if (kind === "bubble") { g.beginPath(); g.arc(u * 0.25, -u * 0.3, u * 0.6, 0, TAU); g.stroke(); g.lineWidth = Math.max(2, s * 0.16); g.beginPath(); g.moveTo(-u * 0.2, u * 0.2); g.lineTo(-u * 0.85, u * 0.85); g.stroke(); g.beginPath(); g.arc(u * 0.05, -u * 0.5, u * 0.12, 0, TAU); g.fill(); }
        else if (kind === "spring") { g.beginPath(); for (let k = 0; k <= 6; k++) { const yy = u * 0.9 - k * u * 0.25; g.lineTo(k % 2 ? u * 0.45 : -u * 0.45, yy); } g.stroke(); g.beginPath(); g.moveTo(-u * 0.7, u * 0.95); g.lineTo(u * 0.7, u * 0.95); g.moveTo(-u * 0.7, -u * 0.7); g.lineTo(u * 0.7, -u * 0.7); g.stroke(); }
        else if (kind === "wreck") { g.beginPath(); g.moveTo(0, -u); g.lineTo(u * 0.35, -u * 0.05); g.stroke(); g.beginPath(); g.arc(u * 0.4, u * 0.45, u * 0.5, 0, TAU); g.fill(); g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = Math.max(1, s * 0.06); g.beginPath(); g.arc(u * 0.4, u * 0.45, u * 0.5, 0, TAU); g.stroke(); }
        else if (kind === "zerog") { g.beginPath(); g.arc(0, 0, u * 0.45, 0, TAU); g.fill(); g.beginPath(); g.ellipse(0, 0, u, u * 0.35, -0.5, 0, TAU); g.stroke(); }
        else if (kind === "rain") { g.beginPath(); [[-0.45, -0.3, 0.4], [-0.05, -0.55, 0.45], [0.4, -0.3, 0.4], [0, -0.15, 0.4]].forEach(function (c) { g.moveTo(c[0] * u + c[2] * u, c[1] * u); g.arc(c[0] * u, c[1] * u, c[2] * u, 0, TAU); }); g.fill(); [-0.5, 0, 0.5].forEach(function (d, i) { g.beginPath(); g.moveTo(d * u, u * 0.35 + (i % 2) * u * 0.15); g.lineTo(d * u - u * 0.1, u * 0.85 + (i % 2) * u * 0.15); g.stroke(); }); }
        g.restore();
      }
      function drawPlayground() {
        const p = pg;
        // soft floor glow
        const FL = pgFloor();
        const fg = g.createLinearGradient(0, FL - S * 0.18, 0, FL);
        fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(1, rgba(ctx.accent, 0.14));
        g.fillStyle = fg; g.fillRect(0, FL - S * 0.18, S, S * 0.18);
        g.save(); g.strokeStyle = rgba(ctx.accent, 0.35); g.lineWidth = 1.5; g.shadowColor = ctx.accent; g.shadowBlur = S * 0.012; g.beginPath(); g.moveTo(S * 0.02, FL); g.lineTo(S * 0.98, FL); g.stroke(); g.restore();
        // objects
        p.objs.forEach(function (o) {
          g.save();
          if (o.kind === "slide") {
            const pts = slidePts(o);
            g.lineCap = "round"; g.lineJoin = "round";
            g.strokeStyle = rgba(ctx.accent, 0.25); g.lineWidth = S * 0.028; g.beginPath(); pts.forEach(function (q, i) { i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); g.stroke();
            g.strokeStyle = lighten(ctx.accent, 0.3); g.lineWidth = S * 0.012; g.shadowColor = ctx.accent; g.shadowBlur = S * 0.02; g.stroke();
            g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = S * 0.003; g.stroke();
            g.strokeStyle = rgba(ctx.accent, 0.35); g.lineWidth = S * 0.006; g.setLineDash([S * 0.01, S * 0.014]);
            g.beginPath(); g.moveTo(pts[0].x, pts[0].y); g.lineTo(pts[0].x, FL); g.stroke();
          } else if (o.kind === "tramp") {
            const tp = trampPts(o);
            g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = S * 0.005; g.beginPath(); g.moveTo(tp[0].x + S * 0.02, o.y); g.lineTo(tp[0].x, FL); g.moveTo(tp[1].x - S * 0.02, o.y); g.lineTo(tp[1].x, FL); g.stroke();
            g.lineCap = "round"; g.strokeStyle = "#7fe0a0"; g.lineWidth = S * 0.012; g.shadowColor = "#7fe0a0"; g.shadowBlur = S * 0.02; g.beginPath(); g.moveTo(tp[0].x, o.y); g.lineTo(tp[1].x, o.y); g.stroke();
          } else if (o.kind === "spring") {
            const sp2 = springPts(o), comp = o.comp || 0, base = Math.min(FL, o.y + S * 0.06), top = o.y + comp * S * 0.03;
            g.strokeStyle = "#ffd36b"; g.lineWidth = S * 0.006; g.lineCap = "round"; g.lineJoin = "round"; g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.015;
            g.beginPath(); for (let k = 0; k <= 8; k++) { const yy = base - k / 8 * (base - top); if (k === 0) g.moveTo(o.x, yy); else g.lineTo(o.x + (k % 2 ? S * 0.03 : -S * 0.03), yy); } g.stroke();
            g.lineWidth = S * 0.012; g.beginPath(); g.moveTo(sp2[0].x, top); g.lineTo(sp2[1].x, top); g.stroke();
            g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = S * 0.004; g.beginPath(); g.moveTo(sp2[0].x - S * 0.01, base); g.lineTo(sp2[1].x + S * 0.01, base); g.stroke();
          } else if (o.kind === "fan") {
            g.fillStyle = rgba("#74b9ff", 0.9); g.shadowColor = "#74b9ff"; g.shadowBlur = S * 0.02;
            g.beginPath(); g.arc(o.x, o.y, S * 0.035, Math.PI, 0); g.fill(); g.shadowBlur = 0;
            g.fillStyle = "rgba(20,30,50,0.8)"; g.beginPath(); g.arc(o.x, o.y, S * 0.012, 0, TAU); g.fill();
            g.strokeStyle = "rgba(116,185,255,0.22)"; g.lineWidth = S * 0.004; g.lineCap = "round";
            for (let i = -2; i <= 2; i++) { const xx = o.x + i * S * 0.03; for (let k = 0; k < 6; k++) { const yy = o.y - ((now * 0.00035 + k / 6 + i * 0.1) % 1) * o.y; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + Math.sin(yy * 0.05) * S * 0.008, yy - S * 0.03); g.stroke(); } }
          }
          g.restore();
        });
        // toys (+ bubbles)
        p.toys.forEach(function (t) {
          drawToy(t.x, t.y, t.r, t.it, { sq: t.sq, t: now });
          if (t.bubble > 0) {
            const br = t.r * 1.55 + Math.sin(now * 0.005 + t.r) * t.r * 0.05;
            g.save();
            const bg = g.createRadialGradient(t.x, t.y, br * 0.6, t.x, t.y, br);
            bg.addColorStop(0, "rgba(255,255,255,0)"); bg.addColorStop(0.85, "rgba(166,255,232,0.08)"); bg.addColorStop(1, "rgba(255,255,255,0.28)");
            g.fillStyle = bg; g.beginPath(); g.arc(t.x, t.y, br, 0, TAU); g.fill();
            g.strokeStyle = hsl((now * 0.06 + t.r * 10) % 360, 80, 80, 0.55); g.lineWidth = 1.5; g.stroke();
            g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(t.x - br * 0.45, t.y - br * 0.5, br * 0.22, br * 0.1, -0.7, 0, TAU); g.fill();
            g.restore();
          }
        });
        // wrecking ball
        if (p.ball) {
          const b = p.ball, bp = pgBallPos(b);
          g.save();
          g.strokeStyle = "rgba(200,200,220,0.5)"; g.lineWidth = S * 0.006; g.setLineDash([S * 0.012, S * 0.008]); g.beginPath(); g.moveTo(b.ax, b.ay); g.lineTo(bp.x, bp.y); g.stroke(); g.setLineDash([]);
          g.fillStyle = "rgba(200,200,220,0.7)"; g.beginPath(); g.arc(b.ax, b.ay + S * 0.004, S * 0.012, 0, TAU); g.fill();
          const bg2 = g.createRadialGradient(bp.x - b.r * 0.35, bp.y - b.r * 0.4, b.r * 0.1, bp.x, bp.y, b.r);
          bg2.addColorStop(0, "#8a8aa8"); bg2.addColorStop(0.5, "#3a3a52"); bg2.addColorStop(1, "#14141f");
          g.fillStyle = bg2; g.shadowColor = b.grab ? ctx.accent : "rgba(255,255,255,0.35)"; g.shadowBlur = S * 0.02;
          g.beginPath(); g.arc(bp.x, bp.y, b.r, 0, TAU); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = b.grab ? ctx.accent : "rgba(255,255,255,0.25)"; g.lineWidth = 2; g.stroke();
          g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.ellipse(bp.x - b.r * 0.4, bp.y - b.r * 0.45, b.r * 0.22, b.r * 0.1, -0.7, 0, TAU); g.fill();
          g.restore();
        }
        // fx
        p.fx.forEach(function (f) {
          const k = f.t / f.dur;
          if (f.kind === "bubble") {
            g.save(); g.globalAlpha = 1 - k * k; g.strokeStyle = hsl((now * 0.08 + f.r * 900) % 360, 80, 82, 0.7); g.lineWidth = 1.2;
            g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.stroke();
            g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(f.x - f.r * 0.4, f.y - f.r * 0.4, f.r * 0.18, 0, TAU); g.fill(); g.restore();
            return;
          }
          g.save(); g.globalAlpha = 1 - k; g.strokeStyle = f.col; g.lineWidth = S * 0.006 * (1 - k) + 1; g.beginPath(); g.arc(f.x, f.y, f.r * (0.3 + k * 0.9), 0, TAU); g.stroke(); g.restore();
        });
        // held-tool cursor
        if (p.down && (p.tool === "magnet" || p.tool === "whirl")) {
          g.save(); g.strokeStyle = rgba(ctx.accent, 0.6); g.lineWidth = 2; g.setLineDash([4, 6]); g.lineDashOffset = -now * 0.05;
          g.beginPath(); g.arc(p.px, p.py, S * 0.05 + Math.sin(now * 0.008) * S * 0.006, 0, TAU); g.stroke(); g.restore();
        }
        // dock (icons only; fades when idle) + exit
        const idle = now - p.lastPointer;
        const dockA = idle > 2200 ? 0.22 : 1;
        const n = PG_TOOLS.length, isz = Math.min(S * 0.058, S * 0.9 / n), gap = isz * 0.18;
        const dw = n * isz + (n - 1) * gap, dx0 = (S - dw) / 2, dy = S - isz * 1.45;
        g.save(); g.globalAlpha = dockA;
        pathRR(dx0 - gap, dy - gap, dw + gap * 2, isz + gap * 2, isz * 0.4); g.fillStyle = "rgba(16,13,28,0.75)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.08)"; g.stroke();
        g.restore();
        let hoverKind = null;
        PG_TOOLS.forEach(function (k, i) {
          const x = dx0 + i * (isz + gap), active = p.tool === k || (k === "zerog" && p.zeroG);
          const hov = hovering(x, dy, isz, isz);
          if (hov) hoverKind = k;
          g.save(); g.globalAlpha = dockA;
          if (active || hov) { pathRR(x, dy, isz, isz, isz * 0.3); g.fillStyle = active ? rgba(ctx.accent, 0.3) : "rgba(255,255,255,0.08)"; g.fill(); }
          pgIcon(k, x + isz / 2, dy + isz / 2, isz * 0.55, active ? "#ffffff" : "rgba(230,236,245,0.75)");
          g.restore();
          hit(x, dy, isz, isz, function () { pgDock(k); });
        });
        if (hoverKind && S >= 520) text(PG_LABEL[hoverKind], S / 2, dy - isz * 0.45, { size: S * 0.016, align: "center", col: "rgba(230,236,245,0.6)" });
        const ex = S - S * 0.06, ey = S * 0.06, er = S * 0.026;
        g.save(); g.globalAlpha = dockA; g.strokeStyle = "rgba(230,236,245,0.6)"; g.lineWidth = 2; g.lineCap = "round";
        g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fillStyle = "rgba(16,13,28,0.7)"; g.fill(); g.stroke();
        g.beginPath(); g.moveTo(ex - er * 0.4, ey - er * 0.4); g.lineTo(ex + er * 0.4, ey + er * 0.4); g.moveTo(ex + er * 0.4, ey - er * 0.4); g.lineTo(ex - er * 0.4, ey + er * 0.4); g.stroke(); g.restore();
        hit(ex - er * 1.5, ey - er * 1.5, er * 3, er * 3, function () { screen = "collection"; sndClick(); });
        canvas.style.cursor = p.tool === "hand" ? (pgToyAt(mx, my) || (p.ball && Math.hypot(mx - pgBallPos(p.ball).x, my - pgBallPos(p.ball).y) < p.ball.r * 1.3) ? "grab" : "default") : "crosshair";
      }

      // =====================================================================
      //  MAIN LOOP, INPUT, LIFECYCLE
      // =====================================================================
      function draw() {
        hits = [];
        drawBackground();
        if (screen === "playground" && pg) { drawPlayground(); drawConfetti(); return; }
        drawTop();
        drawTabs();
        if (mini) { if (mini.kind === "pool") drawPool(); else drawSort(); }
        else if (screen === "collection") drawCollection();
        else if (screen === "shop") drawShop();
        else if (screen === "trade") drawTrade();
        else if (screen === "market") drawMarket();
        else drawGames();
        drawConfetti();
        drawLevelFlash();
        drawToasts();
        drawModal();
        if (hovering(0, 0, S, S)) canvas.style.cursor = hits.some(function (h) { return inRect(h, mx, my) && h.w < S; }) ? "pointer" : "default";
      }
      function update(dt) {
        now += dt;
        updateFx(dt);
        marketT += dt; if (marketT >= MARKET_TICK) { marketT -= MARKET_TICK; marketTick(); }
        if (save.bot.on) { botT += dt; if (botT >= BOT_TICK) { botT = 0; botStep(); } }
        if (now - save.shop.t >= SHOP_CYCLE) { restock(false); toast("The shop restocked!", "#7fe0a0"); }
        if (mini) { if (mini.kind === "pool") updatePool(dt); else updateSort(dt); }
        if (screen === "playground" && pg) updatePlayground(dt);
        if (dirty && now - saveT > 1000) persist();
      }
      function pointerDown(x, y) {
        if (mini && mini.kind === "pool" && !modal && poolPointer("down", x, y)) return;
        for (let i = hits.length - 1; i >= 0; i--) {
          const h = hits[i];
          if (inRect(h, x, y)) { try { h.fn(); } catch (e) { console.error(e); } return; }
        }
        if (screen === "playground" && pg && !modal) pgPointer("down", x, y);
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrapEl = document.createElement("div");
          wrapEl.style.display = "flex"; wrapEl.style.flexDirection = "column"; wrapEl.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px";
          canvas.style.background = "#0b0a14";
          canvas.style.boxShadow = "0 0 50px rgba(180,140,255,0.12)";
          canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrapEl.appendChild(canvas);
          const hintEl = document.createElement("div");
          hintEl.className = "hint";
          hintEl.textContent = "Collect · squeeze · trade · flip. Your bazaar saves itself in this browser.";
          wrapEl.appendChild(hintEl);
          stage.appendChild(wrapEl);
          bgDots = [];
          for (let i = 0; i < 40; i++) bgDots.push({ x: Math.random(), y: Math.random(), r: 0.0015 + Math.random() * 0.003, a: 0.05 + Math.random() * 0.15, sp: 0.000003 + Math.random() * 0.000006, ph: Math.random() * 6.28 });
          now = 0; marketT = 0; botT = 0; saveT = 0; toasts = []; confetti = []; squish = {}; modal = null; mini = null; drag = null;
          screen = "collection"; traderId = null; offer = { mine: [], theirs: [] }; speech = null; pg = null;
          resize();
          load();
          if (!save.intro) modal = { type: "intro" };
          refreshScore();
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type === "point") {
            mx = intent.x; my = intent.y;
            if (intent.phase === "down") { if (intent.button === 0) pointerDown(intent.x, intent.y); return; }
            if (mini && mini.kind === "pool" && drag) { poolPointer(intent.phase, intent.x, intent.y); return; }
            if (screen === "playground" && pg) { pgPointer(intent.phase, intent.x, intent.y); return; }
            return;
          }
          if (intent.type === "dir") {
            if (mini && mini.kind === "sort" && !modal) { if (intent.dir === "left" || intent.dir === "right") sortAnswer(intent.dir); }
            return;
          }
          if (intent.type === "action") {
            if (modal) {
              if (modal.type === "intro") { save.intro = true; markDirty(); modal = null; ctx.audio.start(); }
              else if (modal.type !== "confirm") { modal = null; }
              return;
            }
            if (mini && mini.done) { if (mini.kind === "pool") startPool(); else startSort(); }
          }
        },
        tick(dt) { update(dt); draw(); },
        pause() { persist(); },
        teardown() {
          persist();
          if (unResize) unResize(); unResize = null;
          if (canvas) canvas.style.cursor = "default";
          stageEl = ctx = canvas = g = null;
          save = null; mini = null; modal = null; drag = null; hits = [];
        }
      };

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (mini && mini.kind === "pool") layoutPool();
      }
    }
  });
})();
