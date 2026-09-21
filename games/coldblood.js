/* COLD BLOOD — reptile tower defense. Bugs (and, at the milestone waves, dinosaurs) march down a winding
   road toward your nest; you place cold-blooded defenders beside the road and grow them down upgrade paths.
   Five themed maps, nine reptiles (four unlock through the egg skill tree), three upgrade paths × three tiers
   each (two paths per tower), targeting modes, 1×/2×/3× speed, 40 waves then freeplay, four boss waves.
   Eggs earned every run feed a persistent skill tree (cloud-synced). Per-map leaderboards on the end screen. */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const dist = (a, b, c, d) => Math.hypot(c - a, d - b);
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); }
  function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return ((h >>> 0) % 10000) / 10000; }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r * k), 0, 255); g = clamp(Math.round(g * k), 0, 255); b = clamp(Math.round(b * k), 0, 255); return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
  const lowFx = () => !!(window.Arcade && Arcade.perf && Arcade.perf.isLow());

  // ================= MAPS =================
  // path: normalized waypoints (0..1), enemies walk start → end. decor seeds the scenery. water/rock = no-build zones.
  const MAPS = [
    { id: "swamp", name: "Murkwater Swamp", sub: "gentle bends · starter", diff: 1, ground: ["#0f2420", "#163129"], road: "#3a3d2b", glow: "#7fe0a0", accent: "#7fe0a0",
      path: [[0, 0.22], [0.22, 0.22], [0.32, 0.4], [0.18, 0.58], [0.3, 0.78], [0.55, 0.8], [0.66, 0.6], [0.55, 0.4], [0.7, 0.24], [0.9, 0.3], [0.86, 0.55], [0.96, 0.72]],
      water: [[0.78, 0.82, 0.13, 0.08], [0.1, 0.9, 0.09, 0.06], [0.45, 0.14, 0.1, 0.06]], decor: "reed" },
    { id: "desert", name: "Sunscorch Flats", sub: "long straights · fast bugs", diff: 1.2, ground: ["#2a1a12", "#3a2418"], road: "#5a4230", glow: "#ffb86b", accent: "#ffb86b",
      path: [[0.5, 0], [0.5, 0.2], [0.15, 0.2], [0.15, 0.48], [0.85, 0.48], [0.85, 0.76], [0.3, 0.76], [0.3, 0.96]],
      water: [[0.6, 0.34, 0.07, 0.05]], rocks: [[0.7, 0.1, 0.06], [0.1, 0.9, 0.07], [0.9, 0.9, 0.05]], decor: "cactus" },
    { id: "jungle", name: "Emerald Canopy", sub: "two entrances · chaos", diff: 1.45, ground: ["#0c1f14", "#12301c"], road: "#3f3a25", glow: "#a8e6a0", accent: "#4fd18a",
      path: [[0, 0.5], [0.2, 0.5], [0.3, 0.3], [0.5, 0.3], [0.6, 0.5], [0.5, 0.7], [0.3, 0.7], [0.2, 0.5]],   // loop!
      path2: [[0.6, 0.5], [0.8, 0.5], [0.9, 0.3], [0.96, 0.3]],
      water: [[0.1, 0.15, 0.08, 0.06], [0.85, 0.85, 0.1, 0.07]], decor: "vine" },
    { id: "volcano", name: "Ashfall Caldera", sub: "narrow ledges · hard", diff: 1.7, ground: ["#1a0e10", "#2a1414"], road: "#4a2c2a", glow: "#ff6b4d", accent: "#ff6b4d",
      path: [[0.5, 1], [0.5, 0.82], [0.2, 0.82], [0.2, 0.55], [0.8, 0.55], [0.8, 0.3], [0.35, 0.3], [0.35, 0.12], [0.65, 0.12], [0.65, 0.04]],
      lava: [[0.5, 0.68, 0.12, 0.06], [0.5, 0.42, 0.14, 0.06]], rocks: [[0.08, 0.1, 0.06], [0.92, 0.9, 0.06]], decor: "ember" },
    { id: "ruins", name: "Serpent Temple", sub: "spiral · brutal", diff: 2, ground: ["#141026", "#1f1838"], road: "#3c3560", glow: "#c98cff", accent: "#c98cff",
      path: [[0, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.28], [0.72, 0.28], [0.72, 0.72], [0.28, 0.72], [0.28, 0.46], [0.5, 0.46], [0.5, 0.58]],
      water: [], rocks: [[0.5, 0.5, 0.0]], decor: "rune" }
  ];
  const DIFFS = [{ id: "easy", name: "Easy", hp: 0.8, cash: 1.15, lives: 30, start: 800, eggs: 1 }, { id: "normal", name: "Normal", hp: 1, cash: 1, lives: 20, start: 650, eggs: 1.5 }, { id: "hard", name: "Hard", hp: 1.35, cash: 0.85, lives: 10, start: 550, eggs: 2.2 }];

  // ================= ENEMIES =================
  // speed = fraction of the board per second. armor = flat damage soaked per hit. cash on kill. leak = lives lost.
  const ENEMIES = {
    ant:       { name: "Ant",            hp: 10,   speed: 0.085, r: 0.012, cash: 2,  leak: 1, col: "#b8865a", from: 1 },
    beetle:    { name: "Beetle",         hp: 26,   speed: 0.062, r: 0.017, cash: 4,  leak: 1, col: "#5a7fa0", from: 3 },
    wasp:      { name: "Wasp",           hp: 16,   speed: 0.11,  r: 0.014, cash: 5,  leak: 1, col: "#ffd36b", from: 5, flying: true },
    spider:    { name: "Spider",         hp: 40,   speed: 0.075, r: 0.018, cash: 6,  leak: 1, col: "#6b4a6e", from: 7 },
    dragonfly: { name: "Dragonfly",      hp: 22,   speed: 0.16,  r: 0.015, cash: 7,  leak: 1, col: "#74b9ff", from: 9, flying: true },
    roach:     { name: "Armored Roach",  hp: 70,   speed: 0.055, r: 0.019, cash: 9,  leak: 2, col: "#4a3a2a", from: 11, armor: 3 },
    scorpion:  { name: "Scorpion",       hp: 95,   speed: 0.07,  r: 0.02,  cash: 11, leak: 2, col: "#c9563a", from: 14, armor: 2 },
    fireant:   { name: "Fire Ant",       hp: 60,   speed: 0.1,   r: 0.013, cash: 9,  leak: 1, col: "#ff6b4d", from: 17, regen: 4 },
    hornet:    { name: "Hornet",         hp: 90,   speed: 0.12,  r: 0.017, cash: 13, leak: 2, col: "#ff9f43", from: 21, flying: true, armor: 2 },
    tarantula: { name: "Tarantula",      hp: 260,  speed: 0.05,  r: 0.026, cash: 22, leak: 3, col: "#3a2a3a", from: 25, armor: 4 },
    // bosses (dinos) — milestone waves
    bigbeetle: { name: "Titan Beetle",   hp: 900,  speed: 0.04,  r: 0.045, cash: 120, leak: 5, col: "#2f5f8f", boss: true, armor: 4 },
    centipede: { name: "Centipede Queen",hp: 2200, speed: 0.05,  r: 0.05,  cash: 260, leak: 8, col: "#8a3a5a", boss: true, armor: 5, spawns: "ant" },
    raptor:    { name: "Raptor",         hp: 1400, speed: 0.13,  r: 0.04,  cash: 220, leak: 6, col: "#3fa66a", boss: true, armor: 3 },
    ankylo:    { name: "Ankylosaur",     hp: 5200, speed: 0.032, r: 0.06,  cash: 400, leak: 10, col: "#7a6a4a", boss: true, armor: 12 },
    trex:      { name: "T-Rex King",     hp: 9000, speed: 0.045, r: 0.07,  cash: 900, leak: 20, col: "#8a2a2a", boss: true, armor: 6, roar: 8 }
  };
  // wave recipe: which bugs and how many. Returns [{type, n, gap(ms)}]
  function waveRecipe(w) {
    const groups = [];
    if (w === 10) return [{ type: "beetle", n: 8, gap: 500 }, { type: "bigbeetle", n: 1, gap: 0 }];
    if (w === 20) return [{ type: "roach", n: 8, gap: 450 }, { type: "centipede", n: 1, gap: 0 }, { type: "wasp", n: 10, gap: 300 }];
    if (w === 30) return [{ type: "scorpion", n: 8, gap: 400 }, { type: "raptor", n: 3, gap: 1800 }, { type: "hornet", n: 8, gap: 350 }];
    if (w === 35) return [{ type: "tarantula", n: 4, gap: 800 }, { type: "ankylo", n: 1, gap: 0 }, { type: "fireant", n: 16, gap: 250 }];
    if (w === 40) return [{ type: "hornet", n: 10, gap: 300 }, { type: "trex", n: 1, gap: 0 }, { type: "raptor", n: 2, gap: 2000 }];
    const avail = Object.keys(ENEMIES).filter((k) => !ENEMIES[k].boss && ENEMIES[k].from <= w);
    const budget = 6 + w * 1.7;
    let left = budget, i = 0;
    while (left > 0 && i < 5) {
      const t = avail[Math.floor(hash(w, i) * avail.length)];
      const n = Math.max(2, Math.round(Math.min(left, budget * (0.25 + hash(i, w) * 0.35))));
      groups.push({ type: t, n: n, gap: Math.max(140, 700 - w * 12 - (ENEMIES[t].flying ? 80 : 0)) });
      left -= n; i++;
    }
    if (w > 40) { const bossType = ["raptor", "ankylo", "bigbeetle", "centipede", "trex"][w % 5]; groups.push({ type: bossType, n: 1 + Math.floor((w - 40) / 10), gap: 2500 }); }
    return groups;
  }

  // ================= TOWERS (reptiles) =================
  // base stats: dmg per hit, rate = attacks/s, range = fraction of board, kind of attack. air = can hit flying.
  const TOWERS = {
    gecko:     { name: "Gecko",        cost: 170, dmg: 4,  rate: 2.2, range: 0.17, kind: "dart", air: true,  col: "#7fe0a0", dark: "#3fa66a", desc: "Quick dart-spitter. Cheap, reliable, hits flyers.", pierce: 1 },
    chameleon: { name: "Chameleon",    cost: 320, dmg: 22, rate: 0.55, range: 0.34, kind: "dart", air: true, col: "#c98cff", dark: "#7f5fa0", desc: "Sniper tongue. Long range, big single hits.", pierce: 1, crit: 0.1 },
    cobra:     { name: "Cobra",        cost: 380, dmg: 3,  rate: 0.9, range: 0.19, kind: "spray", air: true, col: "#4fd18a", dark: "#2a7a4a", desc: "Venom spray. Poisons everything in a cone.", poison: 6, cone: 0.55 },
    tortoise:  { name: "Tortoise",     cost: 300, dmg: 0,  rate: 0, range: 0.2,  kind: "aura",  air: true,  col: "#a8c6a0", dark: "#5f8a5a", desc: "Support. Slows bugs nearby and steadies allies.", slow: 0.25, buff: 0 },
    komodo:    { name: "Komodo Dragon",cost: 520, dmg: 30, rate: 0.8, range: 0.12, kind: "bite",  air: false, col: "#b8865a", dark: "#6a4a2a", desc: "Brawler. Savage bites that leave bacteria (bleed).", bleed: 5, unlock: "komodo" },
    croc:      { name: "Crocodile",    cost: 650, dmg: 18, rate: 0.45, range: 0.15, kind: "slam",  air: false, col: "#2f6e3f", dark: "#1a4a28", desc: "Death roll. Slams everything close, stuns briefly.", stun: 0.6, armorPierce: 2, unlock: "croc" },
    basilisk:  { name: "Basilisk",     cost: 900, dmg: 9,  rate: 1.4, range: 0.24, kind: "beam",  air: true,  col: "#ff8fd0", dark: "#a04a8a", desc: "Stone gaze. A beam that pierces a whole line of bugs.", pierce: 4, unlock: "basilisk" },
    ptero:     { name: "Pterodactyl",  cost: 1100, dmg: 26, rate: 1.1, range: 0.3, kind: "dart",  air: true,  col: "#74b9ff", dark: "#3f7fc4", desc: "Sky hunter. Shreds flyers, bonus damage in the air.", pierce: 2, airBonus: 2, unlock: "ptero" },
    trex:      { name: "T-Rex",        cost: 2400, dmg: 90, rate: 0.5, range: 0.2, kind: "bite",  air: false, col: "#ff6b4d", dark: "#8a2a2a", desc: "The king. Devastating bites; a roar that freezes the road.", roar: 9, roarDur: 2.2, armorPierce: 6, unlock: "trex" }
  };
  // three upgrade paths × three tiers per reptile. mod(s) mutates the stat object s.
  const UP = {
    gecko: [
      { name: "Sticky Feet", tiers: [{ n: "Twitchy", c: 110, d: "+40% attack speed", m: (s) => { s.rate *= 1.4; } }, { n: "Rapid Fire", c: 260, d: "+50% attack speed", m: (s) => { s.rate *= 1.5; } }, { n: "Blur", c: 700, d: "double speed, +1 damage", m: (s) => { s.rate *= 2; s.dmg += 1; } }] },
      { name: "Spit Shot", tiers: [{ n: "Sharp Darts", c: 120, d: "+3 damage", m: (s) => { s.dmg += 3; } }, { n: "Piercing", c: 300, d: "darts pass through 2 more bugs", m: (s) => { s.pierce += 2; } }, { n: "Acid Darts", c: 800, d: "+6 damage, ignores 2 armor", m: (s) => { s.dmg += 6; s.armorPierce += 2; } }] },
      { name: "Wall Crawler", tiers: [{ n: "Long Look", c: 90, d: "+25% range", m: (s) => { s.range *= 1.25; } }, { n: "Night Eyes", c: 220, d: "+25% range, 10% crits", m: (s) => { s.range *= 1.25; s.crit += 0.1; } }, { n: "Ceiling Perch", c: 650, d: "+40% range, crits deal 3×", m: (s) => { s.range *= 1.4; s.critMul = 3; } }] }
    ],
    chameleon: [
      { name: "Camo Sight", tiers: [{ n: "Keen Eye", c: 200, d: "+20% range, +10% crits", m: (s) => { s.range *= 1.2; s.crit += 0.1; } }, { n: "Deadeye", c: 450, d: "+25% crits", m: (s) => { s.crit += 0.25; } }, { n: "Executioner", c: 1400, d: "crits deal 4×, +15 damage", m: (s) => { s.critMul = 4; s.dmg += 15; } }] },
      { name: "Sticky Tongue", tiers: [{ n: "Gluey", c: 180, d: "hits slow bugs 30%", m: (s) => { s.slowHit = Math.max(s.slowHit, 0.3); } }, { n: "Tar Tongue", c: 420, d: "slow 50%, lasts longer", m: (s) => { s.slowHit = 0.5; s.slowDur = 2.5; } }, { n: "Paralyze", c: 1200, d: "hits stun for 0.8 s", m: (s) => { s.stunHit = 0.8; } }] },
      { name: "Rapid Lash", tiers: [{ n: "Quick Lash", c: 220, d: "+35% attack speed", m: (s) => { s.rate *= 1.35; } }, { n: "Double Lash", c: 520, d: "+40% attack speed, +6 damage", m: (s) => { s.rate *= 1.4; s.dmg += 6; } }, { n: "Whiplash", c: 1500, d: "tongue pierces 3 bugs", m: (s) => { s.pierce += 3; s.rate *= 1.2; } }] }
    ],
    cobra: [
      { name: "Neurotoxin", tiers: [{ n: "Potent", c: 200, d: "+50% poison damage", m: (s) => { s.poison *= 1.5; } }, { n: "Lingering", c: 480, d: "poison lasts 2× longer", m: (s) => { s.poisonDur *= 2; } }, { n: "Necrosis", c: 1300, d: "poison ignores armor, +8/s", m: (s) => { s.poison += 8; s.poisonArmor = true; } }] },
      { name: "Wide Spit", tiers: [{ n: "Broad Spray", c: 160, d: "wider cone", m: (s) => { s.cone *= 1.5; } }, { n: "Far Spit", c: 380, d: "+30% range", m: (s) => { s.range *= 1.3; } }, { n: "Venom Storm", c: 1100, d: "full-circle spray, faster", m: (s) => { s.cone = Math.PI; s.rate *= 1.4; } }] },
      { name: "Hood Fear", tiers: [{ n: "Hiss", c: 180, d: "sprayed bugs slow 25%", m: (s) => { s.slowHit = Math.max(s.slowHit, 0.25); } }, { n: "Terror Hood", c: 450, d: "slow 45%", m: (s) => { s.slowHit = 0.45; s.slowDur = 2; } }, { n: "Medusa Venom", c: 1250, d: "10% chance to stun 1.5 s", m: (s) => { s.stunChance = 0.1; s.stunHit = 1.5; } }] }
    ],
    tortoise: [
      { name: "Slow Aura", tiers: [{ n: "Cold Shell", c: 180, d: "slow 40%", m: (s) => { s.slow = 0.4; } }, { n: "Deep Freeze", c: 420, d: "slow 55%, +20% range", m: (s) => { s.slow = 0.55; s.range *= 1.2; } }, { n: "Glacier", c: 1200, d: "slow 70%; bugs take +15% damage inside", m: (s) => { s.slow = 0.7; s.vuln = 0.15; } }] },
      { name: "Elder", tiers: [{ n: "Wisdom", c: 220, d: "+60 cash each wave", m: (s) => { s.cashWave += 60; } }, { n: "Patience", c: 500, d: "+140 cash each wave", m: (s) => { s.cashWave += 140; } }, { n: "Hoarder", c: 1300, d: "+15% cash from kills nearby", m: (s) => { s.cashBonus = 0.15; } }] },
      { name: "Fortify", tiers: [{ n: "Rally", c: 200, d: "allies in range +10% damage", m: (s) => { s.buff = 0.1; } }, { n: "War Drum", c: 480, d: "+20% damage, +10% speed", m: (s) => { s.buff = 0.2; s.buffRate = 0.1; } }, { n: "Ancient Roar", c: 1400, d: "+35% damage, +25% range for allies", m: (s) => { s.buff = 0.35; s.buffRange = 0.25; } }] }
    ],
    komodo: [
      { name: "Bite Force", tiers: [{ n: "Jaws", c: 260, d: "+20 damage", m: (s) => { s.dmg += 20; } }, { n: "Crusher", c: 600, d: "+40 damage, ignores 3 armor", m: (s) => { s.dmg += 40; s.armorPierce += 3; } }, { n: "Bone Snap", c: 1600, d: "double damage to bosses", m: (s) => { s.bossMul = 2; } }] },
      { name: "Bacteria", tiers: [{ n: "Septic", c: 240, d: "bleed +6/s", m: (s) => { s.bleed += 6; } }, { n: "Plague", c: 560, d: "bleed spreads to a nearby bug", m: (s) => { s.bleedSpread = true; } }, { n: "Rot", c: 1500, d: "bleed +15/s, lasts 2×", m: (s) => { s.bleed += 15; s.bleedDur *= 2; } }] },
      { name: "Alpha", tiers: [{ n: "Prowl", c: 200, d: "+30% range", m: (s) => { s.range *= 1.3; } }, { n: "Frenzy", c: 520, d: "+60% attack speed", m: (s) => { s.rate *= 1.6; } }, { n: "Pack Leader", c: 1400, d: "allies in range +15% damage", m: (s) => { s.buff = 0.15; } }] }
    ],
    croc: [
      { name: "Death Roll", tiers: [{ n: "Thrash", c: 300, d: "+15 damage", m: (s) => { s.dmg += 15; } }, { n: "Spin", c: 700, d: "+40% attack speed", m: (s) => { s.rate *= 1.4; } }, { n: "Cyclone", c: 1800, d: "+50 damage, stun 1.2 s", m: (s) => { s.dmg += 50; s.stun = 1.2; } }] },
      { name: "Armor Crunch", tiers: [{ n: "Tooth", c: 280, d: "ignores 4 more armor", m: (s) => { s.armorPierce += 4; } }, { n: "Shatter", c: 650, d: "bosses take +50%", m: (s) => { s.bossMul = 1.5; } }, { n: "Jaws of Ruin", c: 1700, d: "ignores all armor, +30 damage", m: (s) => { s.armorPierce += 99; s.dmg += 30; } }] },
      { name: "Ambush", tiers: [{ n: "Lurk", c: 240, d: "+35% range", m: (s) => { s.range *= 1.35; } }, { n: "Strike", c: 600, d: "+50% damage to slowed bugs", m: (s) => { s.slowedMul = 1.5; } }, { n: "Tidal Slam", c: 1600, d: "slam also knocks bugs back", m: (s) => { s.knockback = 0.04; } }] }
    ],
    basilisk: [
      { name: "Stone Gaze", tiers: [{ n: "Petrify", c: 400, d: "15% chance to stun 1 s", m: (s) => { s.stunChance = 0.15; s.stunHit = 1; } }, { n: "Cold Stare", c: 900, d: "beam slows 40%", m: (s) => { s.slowHit = 0.4; } }, { n: "Gorgon", c: 2200, d: "40% stun chance, 1.5 s", m: (s) => { s.stunChance = 0.4; s.stunHit = 1.5; } }] },
      { name: "Wide Beam", tiers: [{ n: "Broad Beam", c: 380, d: "pierces 3 more", m: (s) => { s.pierce += 3; } }, { n: "Long Beam", c: 850, d: "+35% range", m: (s) => { s.range *= 1.35; } }, { n: "Ray of Ruin", c: 2100, d: "pierces everything, +6 damage", m: (s) => { s.pierce += 99; s.dmg += 6; } }] },
      { name: "Focus", tiers: [{ n: "Intensity", c: 420, d: "+50% damage", m: (s) => { s.dmg *= 1.5; } }, { n: "Overcharge", c: 950, d: "+60% attack speed", m: (s) => { s.rate *= 1.6; } }, { n: "Sunbeam", c: 2400, d: "damage ramps up to 3× on one target", m: (s) => { s.ramp = true; } }] }
    ],
    ptero: [
      { name: "Dive", tiers: [{ n: "Talons", c: 450, d: "+18 damage", m: (s) => { s.dmg += 18; } }, { n: "Screech", c: 1000, d: "flyers hit take 3× ", m: (s) => { s.airBonus = 3; } }, { n: "Sky Reaper", c: 2500, d: "+40 damage, pierces 3", m: (s) => { s.dmg += 40; s.pierce += 3; } }] },
      { name: "Wingspan", tiers: [{ n: "Glide", c: 400, d: "+30% range", m: (s) => { s.range *= 1.3; } }, { n: "Soar", c: 900, d: "+30% range, +30% speed", m: (s) => { s.range *= 1.3; s.rate *= 1.3; } }, { n: "Thermal", c: 2300, d: "hits the whole map's flyers", m: (s) => { s.range = 2; s.airOnlyFar = true; } }] },
      { name: "Frenzy", tiers: [{ n: "Quick Beak", c: 460, d: "+40% attack speed", m: (s) => { s.rate *= 1.4; } }, { n: "Storm", c: 1000, d: "+50% attack speed", m: (s) => { s.rate *= 1.5; } }, { n: "Cyclone", c: 2600, d: "double speed", m: (s) => { s.rate *= 2; } }] }
    ],
    trex: [
      { name: "Tyrant", tiers: [{ n: "Crunch", c: 900, d: "+60 damage", m: (s) => { s.dmg += 60; } }, { n: "Devour", c: 2000, d: "kills below 20% hp instantly", m: (s) => { s.execute = 0.2; } }, { n: "Extinction", c: 5000, d: "+200 damage, bosses take 2×", m: (s) => { s.dmg += 200; s.bossMul = 2; } }] },
      { name: "Roar", tiers: [{ n: "Bellow", c: 800, d: "roar every 6 s", m: (s) => { s.roar = 6; } }, { n: "Thunder", c: 1800, d: "roar lasts 3.5 s", m: (s) => { s.roarDur = 3.5; } }, { n: "Earthquake", c: 4500, d: "roar also deals 150 damage", m: (s) => { s.roarDmg = 150; } }] },
      { name: "Dominion", tiers: [{ n: "Territory", c: 850, d: "+40% range", m: (s) => { s.range *= 1.4; } }, { n: "Apex Aura", c: 1900, d: "allies in range +30% damage", m: (s) => { s.buff = 0.3; } }, { n: "King's Bounty", c: 4800, d: "kills in range pay 2×", m: (s) => { s.cashBonus = 1; } }] }
    ]
  };

  // ================= SKILL TREE (eggs) =================
  const TREE = [
    { id: "nestegg", branch: "Economy", name: "Nest Egg", cost: 15, d: "+100 starting cash", req: null, m: (m) => { m.startCash += 100; } },
    { id: "bounty", branch: "Economy", name: "Bug Bounty", cost: 25, d: "+15% cash from kills", req: "nestegg", m: (m) => { m.cashMul += 0.15; } },
    { id: "pawn", branch: "Economy", name: "Pawn Shop", cost: 20, d: "sell towers for 85%", req: "bounty", m: (m) => { m.sell = 0.85; } },
    { id: "wavetax", branch: "Economy", name: "Wave Tax", cost: 45, d: "+50 cash every wave", req: "pawn", m: (m) => { m.waveCash += 50; } },
    { id: "goldnest", branch: "Economy", name: "Golden Nest", cost: 80, d: "+250 starting cash", req: "wavetax", m: (m) => { m.startCash += 250; } },
    { id: "fangs1", branch: "Offense", name: "Sharp Fangs", cost: 20, d: "+5% damage", req: null, m: (m) => { m.dmgMul += 0.05; } },
    { id: "fangs2", branch: "Offense", name: "Sharper Fangs", cost: 35, d: "+5% damage", req: "fangs1", m: (m) => { m.dmgMul += 0.05; } },
    { id: "venom", branch: "Offense", name: "Venom Mastery", cost: 35, d: "+30% poison & bleed", req: "fangs1", m: (m) => { m.dotMul += 0.3; } },
    { id: "eagle", branch: "Offense", name: "Eagle Eye", cost: 30, d: "+8% range for all", req: "fangs2", m: (m) => { m.rangeMul += 0.08; } },
    { id: "apex", branch: "Offense", name: "Apex Predator", cost: 70, d: "+10% damage", req: "eagle", m: (m) => { m.dmgMul += 0.1; } },
    { id: "master", branch: "Offense", name: "Master Tier", cost: 120, d: "cheaper tier-3 upgrades (−20%)", req: "apex", m: (m) => { m.t3disc = 0.2; } },
    { id: "skin", branch: "Defense", name: "Thick Skin", cost: 20, d: "+5 lives", req: null, m: (m) => { m.lives += 5; } },
    { id: "wind", branch: "Defense", name: "Second Wind", cost: 40, d: "+3 lives every 10 waves", req: "skin", m: (m) => { m.heal10 += 3; } },
    { id: "coldsnap", branch: "Defense", name: "Cold Snap", cost: 45, d: "all bugs 6% slower", req: "wind", m: (m) => { m.slowAll += 0.06; } },
    { id: "hide", branch: "Defense", name: "Scaled Hide", cost: 60, d: "+5 lives, bosses leak half", req: "coldsnap", m: (m) => { m.lives += 5; m.bossLeakHalf = true; } },
    { id: "komodo", branch: "Unlocks", name: "Komodo Dragon", cost: 30, d: "unlock the brawler", req: null, m: (m) => { m.unlocked.komodo = true; } },
    { id: "croc", branch: "Unlocks", name: "Crocodile", cost: 50, d: "unlock the death roll", req: "komodo", m: (m) => { m.unlocked.croc = true; } },
    { id: "basilisk", branch: "Unlocks", name: "Basilisk", cost: 70, d: "unlock the stone gaze", req: "croc", m: (m) => { m.unlocked.basilisk = true; } },
    { id: "ptero", branch: "Unlocks", name: "Pterodactyl", cost: 100, d: "unlock the sky hunter", req: "basilisk", m: (m) => { m.unlocked.ptero = true; } },
    { id: "trex", branch: "Unlocks", name: "T-Rex", cost: 160, d: "unlock the king", req: "ptero", m: (m) => { m.unlocked.trex = true; } },
    { id: "ff", branch: "Unlocks", name: "Fast Forward", cost: 10, d: "3× game speed", req: null, m: (m) => { m.speed3 = true; } }
  ];
  function metaFromNodes(nodes) {
    const m = { startCash: 0, cashMul: 1, sell: 0.7, waveCash: 0, dmgMul: 1, dotMul: 1, rangeMul: 1, t3disc: 0, lives: 0, heal10: 0, slowAll: 0, bossLeakHalf: false, unlocked: {}, speed3: false };
    TREE.forEach((n) => { if (nodes[n.id]) n.m(m); });
    return m;
  }

  // ================= ART: reptiles =================
  // Each reptile is drawn top-down at (0,0) facing +x, body radius r. tier = highest upgrade tier (visual flair).
  function drawReptile(g, type, r, now, tier, attackK) {
    const T = TOWERS[type], col = T.col, dark = T.dark, breathe = 1 + Math.sin(now * 0.003) * 0.03, rec = attackK || 0;
    g.save(); g.scale(breathe - rec * 0.12, breathe + rec * 0.08);
    const glow = tier >= 2 ? r * 0.7 : tier >= 1 ? r * 0.35 : 0;
    if (glow && !lowFx()) { g.shadowColor = col; g.shadowBlur = glow; }
    if (type === "gecko" || type === "chameleon" || type === "komodo" || type === "basilisk") {
      const L = type === "komodo" ? 1.5 : type === "chameleon" ? 1.2 : 1.3, W = type === "komodo" ? 0.62 : 0.5;
      // tail
      g.strokeStyle = dark; g.lineWidth = r * (type === "komodo" ? 0.4 : 0.26); g.lineCap = "round"; g.beginPath(); g.moveTo(-r * L * 0.8, 0); for (let i = 1; i <= 6; i++) { const t = i / 6; g.lineTo(-r * L * 0.8 - t * r * 1.2, Math.sin(now * 0.004 + t * 4) * r * 0.22 * t); } g.stroke();
      // legs
      g.strokeStyle = dark; g.lineWidth = r * 0.2; [[-0.5, -1], [-0.5, 1], [0.45, -1], [0.45, 1]].forEach((p, i) => { const wig = Math.sin(now * 0.006 + i) * 0.1; g.beginPath(); g.moveTo(p[0] * r, p[1] * r * W * 0.8); g.lineTo(p[0] * r + r * 0.25, p[1] * (r * W + r * 0.45) + wig * r); g.lineTo(p[0] * r + r * 0.55, p[1] * (r * W + r * 0.55)); g.stroke(); });
      // body
      g.fillStyle = col; ell(g, 0, 0, r * L, r * W); g.fill(); g.shadowBlur = 0;
      g.fillStyle = shade(col, 1.25); ell(g, -r * 0.1, 0, r * L * 0.6, r * W * 0.45); g.fill();
      if (type === "komodo") { g.fillStyle = dark; for (let i = 0; i < 7; i++) dot(g, -r * 0.9 + i * r * 0.3, (i % 2 ? -1 : 1) * r * 0.22, r * 0.06); }
      if (type === "basilisk") { g.fillStyle = "#ffd36b"; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-r * 0.6 + i * r * 0.3, -r * W * 0.9); g.lineTo(-r * 0.5 + i * r * 0.3, -r * W * 1.6); g.lineTo(-r * 0.4 + i * r * 0.3, -r * W * 0.9); g.fill(); } }
      // head
      g.fillStyle = col; ell(g, r * L * 0.95, 0, r * 0.5, r * 0.36); g.fill();
      g.fillStyle = type === "basilisk" ? "#ff3b3b" : "#ffd36b"; dot(g, r * L * 0.95 + r * 0.08, -r * 0.2, r * 0.1); dot(g, r * L * 0.95 + r * 0.08, r * 0.2, r * 0.1);
      g.fillStyle = "#1a1a1a"; dot(g, r * L * 0.95 + r * 0.1, -r * 0.2, r * 0.045); dot(g, r * L * 0.95 + r * 0.1, r * 0.2, r * 0.045);
      if (type === "chameleon") { g.fillStyle = dark; g.beginPath(); g.moveTo(r * L * 0.7, -r * 0.3); g.lineTo(r * L * 0.5, -r * 0.7); g.lineTo(r * L * 0.95, -r * 0.35); g.fill(); }
      if (type === "gecko") { g.fillStyle = shade(col, 0.8); for (let i = 0; i < 4; i++) dot(g, -r * 0.6 + i * r * 0.4, 0, r * 0.07); }
    } else if (type === "cobra") {
      g.strokeStyle = col; g.lineWidth = r * 0.42; g.lineCap = "round"; g.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12; g.lineTo(-r * 1.6 + t * r * 1.5, Math.sin(t * 5 + now * 0.003) * r * 0.45 * (1 - t * 0.5)); } g.stroke(); g.shadowBlur = 0;
      g.strokeStyle = shade(col, 1.3); g.lineWidth = r * 0.12; g.setLineDash([r * 0.15, r * 0.2]); g.stroke(); g.setLineDash([]);
      // hood + head (raised, facing +x)
      g.fillStyle = dark; ell(g, r * 0.35, 0, r * 0.75, r * 0.95); g.fill(); g.fillStyle = col; ell(g, r * 0.35, 0, r * 0.55, r * 0.75); g.fill();
      g.fillStyle = shade(col, 0.7); ell(g, r * 0.35, 0, r * 0.28, r * 0.42); g.fill();
      g.fillStyle = col; ell(g, r * 0.95, 0, r * 0.4, r * 0.3); g.fill(); g.fillStyle = "#ff3b3b"; dot(g, r * 1.05, -r * 0.14, r * 0.07); dot(g, r * 1.05, r * 0.14, r * 0.07);
      g.strokeStyle = "#ff6b8a"; g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(r * 1.6 + rec * r * 0.5, -r * 0.1); g.moveTo(r * 1.3, 0); g.lineTo(r * 1.6 + rec * r * 0.5, r * 0.1); g.stroke();
    } else if (type === "tortoise") {
      g.fillStyle = dark; [[-0.7, -0.7], [-0.7, 0.7], [0.6, -0.7], [0.6, 0.7]].forEach((p) => { ell(g, p[0] * r, p[1] * r, r * 0.28, r * 0.2); g.fill(); });
      g.fillStyle = col; ell(g, r * 1.05, 0, r * 0.38, r * 0.3); g.fill(); g.fillStyle = "#1a1a1a"; dot(g, r * 1.2, -r * 0.12, r * 0.05); dot(g, r * 1.2, r * 0.12, r * 0.05);
      g.fillStyle = shade(col, 0.6); ell(g, 0, 0, r * 0.95, r * 0.85); g.fill(); g.shadowBlur = 0;
      g.fillStyle = col; for (let i = 0; i < 7; i++) { const a = i * TAU / 6, rr2 = i === 6 ? 0 : r * 0.5; ell(g, Math.cos(a) * rr2, Math.sin(a) * rr2, r * 0.26, r * 0.24); g.fill(); }
      g.strokeStyle = shade(col, 0.5); g.lineWidth = r * 0.05; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.stroke(); }
      if (tier >= 2) { g.strokeStyle = rgba("#ffd36b", 0.6); g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, 0, r * 0.95, 0, TAU); g.stroke(); }
    } else if (type === "croc") {
      g.strokeStyle = dark; g.lineWidth = r * 0.45; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 1.2, 0); for (let i = 1; i <= 5; i++) { const t = i / 5; g.lineTo(-r * 1.2 - t * r * 1.3, Math.sin(now * 0.003 + t * 3) * r * 0.25 * t); } g.stroke();
      g.strokeStyle = dark; g.lineWidth = r * 0.25; [[-0.7, -1], [-0.7, 1], [0.5, -1], [0.5, 1]].forEach((p) => { g.beginPath(); g.moveTo(p[0] * r, p[1] * r * 0.5); g.lineTo(p[0] * r - r * 0.2, p[1] * r * 0.95); g.stroke(); });
      g.fillStyle = col; ell(g, -0.1 * r, 0, r * 1.5, r * 0.62); g.fill(); g.shadowBlur = 0;
      g.fillStyle = shade(col, 1.3); for (let i = 0; i < 6; i++) { ell(g, -r * 1.2 + i * r * 0.45, 0, r * 0.12, r * 0.1); g.fill(); }
      g.save(); g.translate(r * 1.2, 0); g.rotate(-rec * 0.5); g.fillStyle = col; rr(g, 0, -r * 0.3, r * 1.1, r * 0.28, r * 0.1); g.fill(); g.restore();
      g.fillStyle = col; rr(g, r * 1.2, r * 0.02, r * 1.1, r * 0.28, r * 0.1); g.fill();
      g.fillStyle = "#fff"; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(r * 1.35 + i * r * 0.18, -r * 0.02); g.lineTo(r * 1.45 + i * r * 0.18, -r * 0.02); g.lineTo(r * 1.4 + i * r * 0.18, r * 0.1); g.fill(); }
      g.fillStyle = "#ffd36b"; dot(g, r * 1.0, -r * 0.42, r * 0.12); dot(g, r * 1.0, r * 0.42, r * 0.12); g.fillStyle = "#1a1a1a"; g.fillRect(r * 0.97, -r * 0.5, r * 0.06, r * 0.16); g.fillRect(r * 0.97, r * 0.34, r * 0.06, r * 0.16);
    } else if (type === "ptero") {
      const flap = Math.sin(now * 0.012) * 0.35;
      g.fillStyle = col; [-1, 1].forEach((d) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(-r * 0.6, d * r * 2.2 * (0.7 + flap * 0.3)); g.lineTo(r * 0.9, d * r * 1.6 * (0.7 + flap * 0.3)); g.lineTo(r * 0.5, 0); g.closePath(); g.fill(); });
      g.shadowBlur = 0; g.fillStyle = dark; [-1, 1].forEach((d) => { g.beginPath(); g.moveTo(-r * 0.1, 0); g.lineTo(-r * 0.6, d * r * 2.2 * (0.7 + flap * 0.3)); g.lineTo(-r * 0.2, d * r * 1.2); g.fill(); });
      g.fillStyle = col; ell(g, 0, 0, r * 1.1, r * 0.35); g.fill(); g.beginPath(); g.moveTo(r * 0.9, -r * 0.15); g.lineTo(r * 1.9, 0); g.lineTo(r * 0.9, r * 0.15); g.fill();
      g.fillStyle = dark; g.beginPath(); g.moveTo(r * 0.6, -r * 0.2); g.lineTo(r * 0.2, -r * 0.9); g.lineTo(r * 0.9, -r * 0.1); g.fill();
      g.fillStyle = "#ffd36b"; dot(g, r * 0.9, -r * 0.16, r * 0.07);
    } else if (type === "trex") {
      g.strokeStyle = dark; g.lineWidth = r * 0.5; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 1.1, 0); g.lineTo(-r * 2.4, Math.sin(now * 0.003) * r * 0.3); g.stroke();
      g.fillStyle = dark; ell(g, -r * 0.3, -r * 0.75, r * 0.45, r * 0.35); g.fill(); ell(g, -r * 0.3, r * 0.75, r * 0.45, r * 0.35); g.fill();
      g.fillStyle = col; ell(g, -r * 0.2, 0, r * 1.3, r * 0.75); g.fill(); g.shadowBlur = 0;
      g.fillStyle = shade(col, 0.7); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-r * 1.2 + i * r * 0.4, -r * 0.1); g.lineTo(-r * 1.05 + i * r * 0.4, -r * 0.55); g.lineTo(-r * 0.9 + i * r * 0.4, -r * 0.1); g.fill(); }
      g.save(); g.translate(r * 1.0, 0); g.rotate(-rec * 0.35); g.fillStyle = col; ell(g, r * 0.5, -r * 0.12, r * 0.9, r * 0.45); g.fill(); g.restore();
      g.fillStyle = shade(col, 0.85); ell(g, r * 1.5, r * 0.15, r * 0.85, r * 0.3); g.fill();
      g.fillStyle = "#fff"; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r * 1.0 + i * r * 0.2, -r * 0.04); g.lineTo(r * 1.1 + i * r * 0.2, -r * 0.04); g.lineTo(r * 1.05 + i * r * 0.2, r * 0.14); g.fill(); }
      g.fillStyle = "#ffd36b"; dot(g, r * 1.0, -r * 0.38, r * 0.12); g.fillStyle = "#1a1a1a"; dot(g, r * 1.03, -r * 0.38, r * 0.06);
      if (tier >= 3) { g.fillStyle = "#ffd36b"; g.beginPath(); g.moveTo(r * 0.6, -r * 0.7); g.lineTo(r * 0.7, -r * 1.1); g.lineTo(r * 0.85, -r * 0.8); g.lineTo(r * 1.0, -r * 1.15); g.lineTo(r * 1.1, -r * 0.7); g.fill(); }
    }
    g.restore();
    if (tier >= 3) { g.save(); g.strokeStyle = rgba("#ffd36b", 0.55); g.lineWidth = Math.max(1.5, r * 0.08); g.setLineDash([r * 0.3, r * 0.2]); g.lineDashOffset = -now * 0.02; g.beginPath(); g.arc(0, 0, r * 1.9, 0, TAU); g.stroke(); g.restore(); }
  }

  // ================= ART: bugs + bosses =================
  function drawBug(g, type, r, now, ph, hurt) {
    const E = ENEMIES[type], col = hurt ? "#ffffff" : E.col, dark = shade(E.col, 0.55);
    const wig = Math.sin(now * 0.02 + ph);
    if (type === "ant" || type === "fireant") {
      g.strokeStyle = dark; g.lineWidth = r * 0.14; g.lineCap = "round"; for (let i = -1; i <= 1; i++) { [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(i * r * 0.5, 0); g.lineTo(i * r * 0.5 + wig * r * 0.2 * s, s * r * 1.0); g.stroke(); }); }
      g.fillStyle = col; ell(g, -r * 0.9, 0, r * 0.55, r * 0.4); g.fill(); ell(g, 0, 0, r * 0.35, r * 0.3); g.fill(); ell(g, r * 0.7, 0, r * 0.4, r * 0.35); g.fill();
      if (type === "fireant") { g.fillStyle = "#ffd36b"; ell(g, -r * 0.9, 0, r * 0.25, r * 0.15); g.fill(); }
      g.fillStyle = "#1a1a1a"; dot(g, r * 0.95, -r * 0.15, r * 0.08); dot(g, r * 0.95, r * 0.15, r * 0.08);
    } else if (type === "beetle" || type === "roach" || type === "bigbeetle") {
      g.strokeStyle = dark; g.lineWidth = r * 0.12; for (let i = -1; i <= 1; i++) { [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(i * r * 0.5, s * r * 0.5); g.lineTo(i * r * 0.5 + wig * r * 0.15, s * r * 1.05); g.stroke(); }); }
      g.fillStyle = col; ell(g, 0, 0, r * 1.05, r * 0.85); g.fill();
      g.fillStyle = shade(E.col, 1.35); ell(g, -r * 0.2, -r * 0.25, r * 0.45, r * 0.2, -0.3); g.fill();
      g.strokeStyle = dark; g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(r * 0.7, 0); g.stroke();
      if (type === "roach") { g.strokeStyle = shade(E.col, 1.6); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-r * 0.7 + i * r * 0.4, -r * 0.7); g.lineTo(-r * 0.7 + i * r * 0.4, r * 0.7); g.stroke(); } }
      g.fillStyle = dark; ell(g, r * 1.0, 0, r * 0.3, r * 0.35); g.fill();
      if (type === "bigbeetle") { g.strokeStyle = dark; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(r * 1.1, -r * 0.2); g.lineTo(r * 1.9, -r * 0.55); g.moveTo(r * 1.1, r * 0.2); g.lineTo(r * 1.9, r * 0.55); g.stroke(); }
      g.fillStyle = "#ff6b6b"; dot(g, r * 1.1, -r * 0.15, r * 0.08); dot(g, r * 1.1, r * 0.15, r * 0.08);
    } else if (type === "wasp" || type === "hornet" || type === "dragonfly") {
      const wf = Math.abs(Math.sin(now * 0.05 + ph));
      g.fillStyle = "rgba(200,230,255,0.5)"; if (type === "dragonfly") { [-1, 1].forEach((d) => { ell(g, -r * 0.2, d * r * 0.9, r * 1.1, r * 0.25 * (0.4 + wf)); g.fill(); ell(g, r * 0.5, d * r * 0.7, r * 0.8, r * 0.22 * (0.4 + wf)); g.fill(); }); } else { [-1, 1].forEach((d) => { ell(g, -r * 0.1, d * r * 0.7, r * 0.7, r * 0.35 * (0.4 + wf)); g.fill(); }); }
      g.fillStyle = col; if (type === "dragonfly") { ell(g, -r * 0.6, 0, r * 1.0, r * 0.18); g.fill(); dot(g, r * 0.6, 0, r * 0.35); } else { ell(g, -r * 0.5, 0, r * 0.8, r * 0.45); g.fill(); dot(g, r * 0.7, 0, r * 0.38); }
      if (type !== "dragonfly") { g.fillStyle = "#1a1a1a"; for (let i = 0; i < 3; i++) g.fillRect(-r * 1.1 + i * r * 0.35, -r * 0.4, r * 0.15, r * 0.8); g.beginPath(); g.moveTo(-r * 1.3, 0); g.lineTo(-r * 1.7, r * 0.12); g.lineTo(-r * 1.3, r * 0.15); g.fill(); }
      g.fillStyle = type === "hornet" ? "#ff3b3b" : "#2a2434"; dot(g, r * 0.9, -r * 0.16, r * 0.12); dot(g, r * 0.9, r * 0.16, r * 0.12);
    } else if (type === "spider" || type === "tarantula") {
      g.strokeStyle = dark; g.lineWidth = r * (type === "tarantula" ? 0.2 : 0.12); g.lineCap = "round";
      for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6, w = Math.sin(now * 0.01 + i + ph) * r * 0.1; [-1, 1].forEach((d) => { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 1.1, d * r * 0.6 + w); g.lineTo(Math.cos(a) * r * 1.6, d * r * 1.2 + w); g.stroke(); }); }
      g.fillStyle = col; ell(g, -r * 0.3, 0, r * 0.85, r * 0.7); g.fill(); dot(g, r * 0.55, 0, r * 0.42);
      if (type === "tarantula") { g.fillStyle = shade(E.col, 1.5); for (let i = 0; i < 12; i++) dot(g, -r * 0.9 + hash(i, 3) * r * 1.1, -r * 0.5 + hash(i, 5) * r, r * 0.05); }
      g.fillStyle = "#ff3b3b"; for (let i = 0; i < 4; i++) dot(g, r * 0.6 + (i % 2) * r * 0.15, -r * 0.3 + i * r * 0.2, r * 0.07);
    } else if (type === "scorpion") {
      g.fillStyle = col; ell(g, 0, 0, r * 0.95, r * 0.55); g.fill();
      g.strokeStyle = col; g.lineWidth = r * 0.24; g.lineCap = "round"; g.beginPath(); for (let i = 0; i <= 5; i++) { const t = i / 5; g.lineTo(-r * 0.8 - t * r * 1.2, -Math.sin(t * 2.2) * r * 1.1); } g.stroke();
      g.fillStyle = "#1a1a1a"; dot(g, -r * 2.0, -r * 0.95, r * 0.16);
      g.lineWidth = r * 0.14; [-1, 1].forEach((d) => { g.beginPath(); g.moveTo(r * 0.7, d * r * 0.2); g.lineTo(r * 1.4, d * r * 0.55); g.stroke(); g.fillStyle = col; ell(g, r * 1.5, d * r * 0.55, r * 0.3, r * 0.2); g.fill(); });
      g.fillStyle = "#ffd36b"; dot(g, r * 0.5, -r * 0.15, r * 0.1); dot(g, r * 0.7, -r * 0.15, r * 0.1);
    } else if (type === "centipede") {
      g.strokeStyle = dark; g.lineWidth = r * 0.1; for (let i = 0; i < 9; i++) { [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(-r * 2.2 + i * r * 0.5, 0); g.lineTo(-r * 2.2 + i * r * 0.5 + Math.sin(now * 0.02 + i) * r * 0.15, s * r * 0.8); g.stroke(); }); }
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? col : shade(E.col, 1.3); ell(g, -r * 2.2 + i * r * 0.5 + Math.sin(now * 0.005 + i) * 0, Math.sin(now * 0.006 + i * 0.7) * r * 0.15, r * 0.36, r * 0.42); g.fill(); }
      g.fillStyle = dark; ell(g, r * 2.2, 0, r * 0.55, r * 0.5); g.fill(); g.fillStyle = "#ff3b3b"; dot(g, r * 2.4, -r * 0.2, r * 0.12); dot(g, r * 2.4, r * 0.2, r * 0.12);
      g.strokeStyle = dark; g.lineWidth = r * 0.1; g.beginPath(); g.moveTo(r * 2.5, -r * 0.3); g.lineTo(r * 3.2, -r * 0.7); g.moveTo(r * 2.5, r * 0.3); g.lineTo(r * 3.2, r * 0.7); g.stroke();
    } else if (type === "raptor") {
      g.strokeStyle = dark; g.lineWidth = r * 0.3; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(-r * 2.4, Math.sin(now * 0.004) * r * 0.4); g.stroke();
      g.fillStyle = dark; ell(g, -r * 0.2, -r * 0.6, r * 0.35, r * 0.28); g.fill(); ell(g, -r * 0.2, r * 0.6, r * 0.35, r * 0.28); g.fill();
      g.fillStyle = col; ell(g, -r * 0.1, 0, r * 1.1, r * 0.55); g.fill(); g.fillStyle = shade(E.col, 1.3); ell(g, -r * 0.2, 0, r * 0.7, r * 0.2); g.fill();
      g.fillStyle = col; ell(g, r * 1.2, 0, r * 0.7, r * 0.32); g.fill(); g.fillStyle = "#ffd36b"; dot(g, r * 1.2, -r * 0.2, r * 0.1); g.fillStyle = "#1a1a1a"; dot(g, r * 1.24, -r * 0.2, r * 0.05);
      g.fillStyle = "#fff"; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r * 1.3 + i * r * 0.15, r * 0.05); g.lineTo(r * 1.38 + i * r * 0.15, r * 0.05); g.lineTo(r * 1.34 + i * r * 0.15, r * 0.2); g.fill(); }
    } else if (type === "ankylo") {
      g.fillStyle = dark; [[-0.8, -0.8], [-0.8, 0.8], [0.6, -0.8], [0.6, 0.8]].forEach((p) => { ell(g, p[0] * r, p[1] * r, r * 0.35, r * 0.28); g.fill(); });
      g.strokeStyle = col; g.lineWidth = r * 0.4; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 1.1, 0); g.lineTo(-r * 2.2, 0); g.stroke(); g.fillStyle = shade(E.col, 0.7); dot(g, -r * 2.3, 0, r * 0.45);
      g.fillStyle = col; ell(g, 0, 0, r * 1.3, r * 0.95); g.fill();
      g.fillStyle = shade(E.col, 1.4); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; dot(g, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.55, r * 0.14); } dot(g, 0, 0, r * 0.2);
      g.fillStyle = shade(E.col, 0.6); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; g.beginPath(); g.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.85); g.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.2); g.lineTo(Math.cos(a + 0.25) * r * 1.1, Math.sin(a + 0.25) * r * 0.85); g.fill(); }
      g.fillStyle = col; ell(g, r * 1.4, 0, r * 0.45, r * 0.35); g.fill(); g.fillStyle = "#1a1a1a"; dot(g, r * 1.5, -r * 0.15, r * 0.07); dot(g, r * 1.5, r * 0.15, r * 0.07);
    } else if (type === "trex") {
      const T = { col: col, dark: dark };
      g.strokeStyle = dark; g.lineWidth = r * 0.5; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 1.1, 0); g.lineTo(-r * 2.6, Math.sin(now * 0.003) * r * 0.3); g.stroke();
      g.fillStyle = dark; ell(g, -r * 0.3, -r * 0.8, r * 0.5, r * 0.38); g.fill(); ell(g, -r * 0.3, r * 0.8, r * 0.5, r * 0.38); g.fill();
      g.fillStyle = col; ell(g, -r * 0.2, 0, r * 1.35, r * 0.8); g.fill();
      g.fillStyle = shade(E.col, 0.7); for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-r * 1.2 + i * r * 0.4, -r * 0.1); g.lineTo(-r * 1.05 + i * r * 0.4, -r * 0.6); g.lineTo(-r * 0.9 + i * r * 0.4, -r * 0.1); g.fill(); }
      g.fillStyle = col; ell(g, r * 1.5, -r * 0.12, r * 0.95, r * 0.48); g.fill(); g.fillStyle = shade(E.col, 0.85); ell(g, r * 1.55, r * 0.18, r * 0.9, r * 0.32); g.fill();
      g.fillStyle = "#fff"; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(r * 1.0 + i * r * 0.2, -r * 0.02); g.lineTo(r * 1.1 + i * r * 0.2, -r * 0.02); g.lineTo(r * 1.05 + i * r * 0.2, r * 0.16); g.fill(); }
      g.fillStyle = "#ffd36b"; g.beginPath(); g.moveTo(r * 0.5, -r * 0.75); g.lineTo(r * 0.6, -r * 1.2); g.lineTo(r * 0.8, -r * 0.85); g.lineTo(r * 1.0, -r * 1.25); g.lineTo(r * 1.15, -r * 0.75); g.fill();
      g.fillStyle = "#ff3b3b"; dot(g, r * 1.0, -r * 0.4, r * 0.13); g.fillStyle = "#1a1a1a"; dot(g, r * 1.04, -r * 0.4, r * 0.06);
    }
  }

  Arcade.register({
    id: "coldblood",
    name: "Cold Blood",
    tagline: "Reptile tower defense. Nine cold-blooded defenders, three upgrade paths each, five maps, dino bosses.",
    accent: "#7fe0a0",
    complexity: "high",
    controls: "click",
    scoreLabel: "Wave",
    create() {
      let stageEl, ctx, wrap, canvas, g, topbar, panel, overlay, styleEl, unResize = null, keyFn = null, raf = null;
      let S = 0, dpr = 1, now = 0, reduced = false;
      let save, meta;
      let screen = "menu";                         // menu | tree | game | end
      let map = null, diff = null, paths = [], towers = [], enemies = [], shots = [], fx = [], floaters = [], auras = [];
      let cash = 0, lives = 0, wave = 0, waveActive = false, queue = [], waveT = 0, speed = 1, paused = false, autoNext = false, freeplay = false, won = false;
      let selected = null, placing = null, hover = null, hoverValid = false, idSeq = 1, shakeT = 0, roadDash = 0, nextWaveIn = 0, statsDirty = true;
      let pickMap = 0, pickDiff = 1, toastEl = null, toastT = null;

      // ---------- persistence ----------
      function load() { save = Object.assign({ eggs: 0, nodes: {}, best: {}, runs: 0, run: null, seen: false }, ctx.storage.get("save", {}) || {}); meta = metaFromNodes(save.nodes); }
      function persist() { ctx.storage.set("save", save); }
      function unlocked(type) { return !TOWERS[type].unlock || meta.unlocked[TOWERS[type].unlock]; }

      // ---------- geometry ----------
      function buildPath(norm) { const pts = norm.map((p) => ({ x: p[0] * S, y: p[1] * S })); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y)); return { pts, cum, len: cum[cum.length - 1] }; }
      function pointAt(P, d) {
        d = clamp(d, 0, P.len); let i = 1; while (i < P.cum.length - 1 && P.cum[i] < d) i++;
        const a = P.pts[i - 1], b = P.pts[i], seg = P.cum[i] - P.cum[i - 1] || 1, k = (d - P.cum[i - 1]) / seg;
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), ang: Math.atan2(b.y - a.y, b.x - a.x) };
      }
      function distToSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1); return dist(px, py, ax + dx * t, ay + dy * t); }
      function distToRoad(x, y) { let m = 1e9; paths.forEach((P) => { for (let i = 1; i < P.pts.length; i++) m = Math.min(m, distToSeg(x, y, P.pts[i - 1].x, P.pts[i - 1].y, P.pts[i].x, P.pts[i].y)); }); return m; }
      function roadW() { return S * 0.075; }
      function blocked(x, y, r) {
        if (x < r || y < r || x > S - r || y > S - r) return "edge";
        if (distToRoad(x, y) < roadW() / 2 + r * 0.8) return "road";
        for (const w of (map.water || []).concat(map.lava || [])) { const dx = (x - w[0] * S) / (w[2] * S + r), dy = (y - w[1] * S) / (w[3] * S + r); if (dx * dx + dy * dy < 1) return "water"; }
        for (const k of (map.rocks || [])) { if (k[2] > 0 && dist(x, y, k[0] * S, k[1] * S) < k[2] * S + r) return "rock"; }
        for (const t of towers) if (dist(x, y, t.x, t.y) < r + towerR(t) * 0.95) return "tower";
        return null;
      }
      function towerR(t) { return S * (t.type === "trex" ? 0.05 : t.type === "croc" || t.type === "komodo" ? 0.04 : 0.033); }

      // ---------- run setup ----------
      function newRun(mapIdx, diffIdx, restore) {
        map = MAPS[mapIdx]; diff = DIFFS[diffIdx]; freeplay = false; won = false;
        paths = [buildPath(map.path)]; if (map.path2) paths.push(buildPath(map.path2));
        towers = []; enemies = []; shots = []; fx = []; floaters = []; queue = []; selected = null; placing = null; waveActive = false; paused = false; speed = 1;
        cash = diff.start + meta.startCash; lives = diff.lives + meta.lives; wave = 1;
        if (restore) { cash = restore.cash; lives = restore.lives; wave = restore.wave; freeplay = !!restore.freeplay; restore.towers.forEach((rt) => { const t = mkTower(rt.type, rt.x * S, rt.y * S); t.tiers = rt.tiers.slice(); t.mode = rt.mode || "first"; t.spent = rt.spent || TOWERS[rt.type].cost; towers.push(t); }); }
        statsDirty = true; screen = "game"; ctx.setScore(wave - 1); renderUI(); toast(map.name + " · " + diff.name + (restore ? " — run restored" : ""), map.accent);
      }
      function saveRun() { save.run = { mapIdx: MAPS.indexOf(map), diffIdx: DIFFS.indexOf(diff), cash, lives, wave, freeplay, towers: towers.map((t) => ({ type: t.type, x: t.x / S, y: t.y / S, tiers: t.tiers, mode: t.mode, spent: t.spent })) }; persist(); }
      function mkTower(type, x, y) { return { id: idSeq++, type, x, y, tiers: [0, 0, 0], mode: "first", cd: 0, angle: -Math.PI / 2, kills: 0, spent: TOWERS[type].cost, atkK: 0, stunT: 0, roarT: 0, ramp: 0, rampTgt: null, s: null, buff: 0, buffRate: 0, buffRange: 0 }; }

      // ---------- stats ----------
      function baseStats(type) { const T = TOWERS[type]; return { dmg: T.dmg, rate: T.rate, range: T.range, pierce: T.pierce || 1, crit: T.crit || 0, critMul: 2, air: !!T.air, armorPierce: T.armorPierce || 0, poison: T.poison || 0, poisonDur: 3, poisonArmor: false, cone: T.cone || 0, slow: T.slow || 0, slowHit: 0, slowDur: 1.5, stun: T.stun || 0, stunHit: 0, stunChance: 0, bleed: T.bleed || 0, bleedDur: 3, bleedSpread: false, buff: T.buff || 0, buffRate: 0, buffRange: 0, cashWave: 0, cashBonus: 0, vuln: 0, bossMul: 1, slowedMul: 1, knockback: 0, airBonus: T.airBonus || 1, execute: 0, roar: T.roar || 0, roarDur: T.roarDur || 0, roarDmg: 0, ramp: false, airOnlyFar: false }; }
      function computeStats(t) { const s = baseStats(t.type); UP[t.type].forEach((path, pi) => { for (let k = 0; k < t.tiers[pi]; k++) path.tiers[k].m(s); }); s.range *= meta.rangeMul; if (s.poison) s.poison *= meta.dotMul; if (s.bleed) s.bleed *= meta.dotMul; t.s = s; }
      function recomputeAll() { towers.forEach(computeStats); auras = towers.filter((t) => t.s.buff || t.s.slow || t.s.vuln || t.s.cashBonus); statsDirty = false; }
      function towerRange(t) { return t.s.range * S * (1 + t.buffRange); }
      function upgradeCost(t, pi) { const tier = t.tiers[pi]; if (tier >= 3) return null; let c = UP[t.type][pi].tiers[tier].c; if (tier === 2 && meta.t3disc) c = Math.round(c * (1 - meta.t3disc)); return c; }
      function canUpgrade(t, pi) { if (t.tiers[pi] >= 3) return false; const used = t.tiers.filter((x, i) => x > 0 && i !== pi).length; return used < 2; }
      function upgrade(t, pi) { const c = upgradeCost(t, pi); if (c == null || !canUpgrade(t, pi)) { sndNo(); return; } if (cash < c) { toast("Not enough cash", "#ff8fa3"); sndNo(); return; } cash -= c; t.spent += c; t.tiers[pi]++; statsDirty = true; sndUpgrade(); burst(t.x, t.y, TOWERS[t.type].col, 14); renderUI(); }
      function sellTower(t) { const v = Math.round(t.spent * meta.sell); cash += v; towers = towers.filter((x) => x !== t); if (selected === t) selected = null; statsDirty = true; floaters.push({ x: t.x, y: t.y, text: "+$" + v, col: "#ffd36b", t: 0 }); sndSell(); renderUI(); }
      function place(type, x, y) {
        const T = TOWERS[type]; if (!unlocked(type)) return; const r = S * 0.033;
        if (cash < T.cost) { toast("Not enough cash for " + T.name, "#ff8fa3"); sndNo(); return false; }
        const why = blocked(x, y, r); if (why) { toast(why === "road" ? "Not on the road!" : why === "water" ? "Reptiles can't build in water" : why === "tower" ? "Too close to another reptile" : "Can't build there", "#ff8fa3"); sndNo(); return false; }
        cash -= T.cost; const t = mkTower(type, x, y); towers.push(t); statsDirty = true; selected = t; sndPlace(); burst(x, y, T.col, 10); renderUI(); return true;
      }

      // ---------- sounds ----------
      const A = () => ctx.audio;
      function sndPlace() { A().tone(392, 0.08, { type: "triangle", vol: 0.08, glide: 523 }); }
      function sndUpgrade() { A().arp([523, 659, 784], { dur: 0.1, step: 0.06, vol: 0.09, type: "triangle" }); }
      function sndSell() { A().tone(600, 0.1, { type: "sine", vol: 0.07, glide: 300 }); }
      function sndNo() { A().tone(200, 0.12, { type: "square", vol: 0.05, glide: 150 }); }
      function sndKill(boss) { if (boss) A().arp([196, 262, 330, 392], { dur: 0.25, step: 0.1, vol: 0.12, type: "triangle" }); }
      function sndLeak() { A().tone(220, 0.25, { type: "sawtooth", vol: 0.08, glide: 110 }); }
      function sndWave() { A().arp([330, 440, 554], { dur: 0.12, step: 0.08, vol: 0.09, type: "sine" }); }
      let shotSndT = 0; function sndShot(kind) { if (now - shotSndT < 60) return; shotSndT = now; if (kind === "dart") A().tone(900, 0.03, { type: "sine", vol: 0.025, glide: 1300 }); else if (kind === "beam") A().tone(660, 0.06, { type: "sawtooth", vol: 0.025, glide: 990 }); else if (kind === "spray") A().tone(300, 0.08, { type: "triangle", vol: 0.03, glide: 200 }); else if (kind === "slam") A().tone(90, 0.12, { type: "triangle", vol: 0.07, glide: 50 }); else if (kind === "bite") A().tone(180, 0.06, { type: "square", vol: 0.04, glide: 120 }); }

      // ---------- fx ----------
      function burst(x, y, col, n) { const m = lowFx() ? Math.ceil(n / 3) : n; for (let i = 0; i < m; i++) { const a = Math.random() * TAU, sp = S * (0.0002 + Math.random() * 0.0005); fx.push({ kind: "p", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: 300 + Math.random() * 300, col, r: S * (0.003 + Math.random() * 0.004) }); } }
      function ring(x, y, r, col, dur) { fx.push({ kind: "ring", x, y, r, col, t: 0, dur: dur || 350 }); }
      function toast(text, col) { if (!toastEl) return; toastEl.textContent = text; toastEl.style.color = col || "#e6ecf5"; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 2200); }

      // ---------- waves ----------
      function startWave() {
        if (waveActive || screen !== "game") return;
        const recipe = waveRecipe(wave); let t = 400; queue = [];
        recipe.forEach((grp, gi) => { for (let i = 0; i < grp.n; i++) { queue.push({ type: grp.type, at: t, path: paths.length > 1 ? (gi + i) % paths.length : 0 }); t += grp.gap; } t += 600; });
        waveActive = true; waveT = 0; sndWave(); renderUI();
        if (ENEMIES[recipe[recipe.length - 1].type].boss || recipe.some((r) => ENEMIES[r.type].boss)) { const b = recipe.find((r) => ENEMIES[r.type].boss); toast("⚠ " + ENEMIES[b.type].name + " approaches!", "#ff6b6b"); shakeT = 600; }
      }
      function spawn(type, pathIdx) {
        const def = ENEMIES[type], scale = diff.hp * map.diff * (1 + (wave - 1) * 0.085) * (wave > 40 ? Math.pow(1.11, wave - 40) : 1);
        const e = { id: idSeq++, type, def, hp: def.hp * scale, hpMax: def.hp * scale, d: -S * 0.02, path: pathIdx, x: 0, y: 0, ang: 0, slow: 0, slowT: 0, stunT: 0, poison: 0, poisonT: 0, poisonArmor: false, bleed: 0, bleedT: 0, ph: Math.random() * TAU, hurt: 0, roarT: def.roar ? def.roar * 1000 * 0.6 : 0, armor: def.armor || 0 };
        const p = pointAt(paths[pathIdx], 0); e.x = p.x; e.y = p.y; e.ang = p.ang; enemies.push(e); return e;
      }
      function waveCleared() {
        waveActive = false;
        const bonus = Math.round((100 + wave * 6) * diff.cash) + meta.waveCash + towers.reduce((s, t) => s + (t.s.cashWave || 0), 0);
        cash += bonus; floaters.push({ x: S / 2, y: S * 0.12, text: "wave " + wave + " cleared  +$" + bonus, col: "#ffd36b", t: 0, big: true });
        if (meta.heal10 && wave % 10 === 0) { lives += meta.heal10; toast("Second Wind: +" + meta.heal10 + " lives", "#7fe0a0"); }
        wave++; ctx.setScore(wave - 1); saveRun(); renderUI();
        if (wave === 41 && !freeplay) { won = true; endRun(true); return; }
        if (autoNext) nextWaveIn = 1400;
      }
      function endRun(victory) {
        const cleared = wave - 1, mapId = map.id, dId = diff.id;
        const key = mapId + ":" + dId, prevBest = save.best[key] || 0;
        let eggs = Math.floor(cleared * diff.eggs * map.diff); if (victory && prevBest < 40) eggs += 40;
        save.eggs += eggs; save.best[key] = Math.max(prevBest, cleared); save.runs++; save.run = victory ? save.run : null; persist();
        screen = "end"; paused = true; A().arp(victory ? [523, 659, 784, 1046, 1318] : [330, 262, 196], { dur: 0.25, step: 0.1, vol: 0.12, type: "triangle" });
        renderUI(); showEnd(victory, cleared, eggs, prevBest);
        if (window.Arcade && Arcade.cloud) Arcade.cloud.submit("coldblood:" + mapId + ":" + dId, cleared);
      }

      // ---------- combat ----------
      function inAura(e, key) { let v = 0; auras.forEach((t) => { if (t.s[key] && dist(e.x, e.y, t.x, t.y) <= towerRange(t)) v = Math.max(v, t.s[key]); }); return v; }
      function candidates(t) { const R = towerRange(t); return enemies.filter((e) => !e.dead && e.d >= 0 && (t.s.air || !e.def.flying) && (!t.s.airOnlyFar || e.def.flying || dist(e.x, e.y, t.x, t.y) <= t.s.range * S / 6) && dist(e.x, e.y, t.x, t.y) <= R + e.def.r * S); }
      function pickTarget(t, list) { if (!list.length) return null; const m = t.mode; if (m === "first") return list.reduce((a, b) => (b.d > a.d ? b : a)); if (m === "last") return list.reduce((a, b) => (b.d < a.d ? b : a)); if (m === "strong") return list.reduce((a, b) => (b.hp > a.hp ? b : a)); return list.reduce((a, b) => (dist(b.x, b.y, t.x, t.y) < dist(a.x, a.y, t.x, t.y) ? b : a)); }
      function hit(e, t, dmg, opts) {
        if (e.dead) return; opts = opts || {}; const s = t.s;
        let d = dmg * meta.dmgMul * (1 + t.buff);
        if (Math.random() < s.crit) { d *= s.critMul; floaters.push({ x: e.x, y: e.y - S * 0.03, text: "CRIT", col: "#ffd36b", t: 0 }); }
        if (e.def.flying && s.airBonus > 1) d *= s.airBonus;
        if (e.def.boss && s.bossMul > 1) d *= s.bossMul;
        if (e.slow > 0 && s.slowedMul > 1) d *= s.slowedMul;
        const vuln = inAura(e, "vuln"); if (vuln) d *= 1 + vuln;
        if (s.ramp) { if (t.rampTgt === e) t.ramp = Math.min(2, t.ramp + 0.12); else { t.ramp = 0; t.rampTgt = e; } d *= 1 + t.ramp; }
        const eff = Math.max(1, d - Math.max(0, e.armor - s.armorPierce));
        e.hp -= eff; e.hurt = 90;
        if (s.slowHit) { e.slow = Math.max(e.slow, s.slowHit); e.slowT = Math.max(e.slowT, s.slowDur * 1000); }
        if (s.stunHit && (s.stunChance ? Math.random() < s.stunChance : true) && !e.def.boss) e.stunT = Math.max(e.stunT, s.stunHit * 1000);
        else if (s.stunHit && e.def.boss && (s.stunChance ? Math.random() < s.stunChance * 0.3 : Math.random() < 0.3)) e.stunT = Math.max(e.stunT, s.stunHit * 400);
        if (s.poison) { e.poison = Math.max(e.poison, s.poison); e.poisonT = Math.max(e.poisonT, s.poisonDur * 1000); e.poisonArmor = e.poisonArmor || s.poisonArmor; }
        if (s.bleed) { e.bleed = Math.max(e.bleed, s.bleed); e.bleedT = Math.max(e.bleedT, s.bleedDur * 1000); if (s.bleedSpread) { const o = enemies.find((q) => q !== e && !q.dead && dist(q.x, q.y, e.x, e.y) < S * 0.06); if (o) { o.bleed = Math.max(o.bleed, s.bleed * 0.6); o.bleedT = Math.max(o.bleedT, 2000); } } }
        if (s.execute && e.hp > 0 && e.hp < e.hpMax * s.execute && !e.def.boss) { e.hp = 0; floaters.push({ x: e.x, y: e.y - S * 0.03, text: "DEVOURED", col: "#ff6b4d", t: 0 }); }
        if (eff >= 25 || e.def.boss) floaters.push({ x: e.x + (Math.random() - 0.5) * S * 0.02, y: e.y - S * 0.02, text: "-" + Math.round(eff), col: "#fff", t: 0, small: true });
        if (e.hp <= 0) kill(e, t);
      }
      function kill(e, t) {
        e.dead = true; const bonus = 1 + inAura(e, "cashBonus") + (t && t.s.cashBonus ? t.s.cashBonus : 0);
        const c = Math.round(e.def.cash * diff.cash * meta.cashMul * bonus); cash += c; if (t) t.kills++;
        burst(e.x, e.y, e.def.col, e.def.boss ? 40 : 8); if (e.def.boss) { ring(e.x, e.y, S * 0.2, e.def.col, 600); shakeT = 500; floaters.push({ x: e.x, y: e.y - S * 0.05, text: e.def.name + " down!  +$" + c, col: "#ffd36b", t: 0, big: true }); }
        else if (c >= 9) floaters.push({ x: e.x, y: e.y - S * 0.02, text: "+$" + c, col: "#ffd36b", t: 0, small: true });
        sndKill(e.def.boss);
        if (e.def.spawns) { for (let i = 0; i < 8; i++) { const s = spawn(e.def.spawns, e.path); s.d = e.d - i * S * 0.02; } }
        renderHud();
      }
      function fire(t, target) {
        const s = t.s, R = towerRange(t); t.atkK = 1; t.angle = Math.atan2(target.y - t.y, target.x - t.x);
        if (TOWERS[t.type].kind === "dart") { shots.push({ x: t.x + Math.cos(t.angle) * S * 0.03, y: t.y + Math.sin(t.angle) * S * 0.03, tgt: target, spd: S * 0.0011, dmg: s.dmg, pierce: s.pierce, hitIds: {}, from: t, col: TOWERS[t.type].col, t: 0, trail: [] }); sndShot("dart"); }
        else if (TOWERS[t.type].kind === "spray") { const cone = s.cone; candidates(t).forEach((e) => { const a = Math.atan2(e.y - t.y, e.x - t.x); let da = Math.abs(((a - t.angle + Math.PI * 3) % TAU) - Math.PI); if (da <= cone) hit(e, t, s.dmg); }); fx.push({ kind: "cone", x: t.x, y: t.y, ang: t.angle, cone, r: R, col: TOWERS[t.type].col, t: 0, dur: 300 }); sndShot("spray"); }
        else if (TOWERS[t.type].kind === "beam") { const ux = Math.cos(t.angle), uy = Math.sin(t.angle); const along = enemies.filter((e) => !e.dead && (s.air || !e.def.flying)).map((e) => { const px = e.x - t.x, py = e.y - t.y, proj = px * ux + py * uy, off = Math.abs(px * uy - py * ux); return { e, proj, off }; }).filter((o) => o.proj > 0 && o.proj <= R * 1.15 && o.off < o.e.def.r * S + S * 0.014).sort((a, b) => a.proj - b.proj).slice(0, s.pierce); along.forEach((o) => hit(o.e, t, s.dmg)); fx.push({ kind: "beam", x: t.x, y: t.y, x2: t.x + ux * R * 1.15, y2: t.y + uy * R * 1.15, col: TOWERS[t.type].col, t: 0, dur: 140 }); sndShot("beam"); }
        else if (TOWERS[t.type].kind === "slam") { candidates(t).forEach((e) => { hit(e, t, s.dmg); if (s.stun && !e.def.boss) e.stunT = Math.max(e.stunT, s.stun * 1000); if (s.knockback) e.d = Math.max(0, e.d - s.knockback * S); }); ring(t.x, t.y, R, TOWERS[t.type].col, 380); shakeT = Math.max(shakeT, 120); sndShot("slam"); }
        else if (TOWERS[t.type].kind === "bite") { hit(target, t, s.dmg); fx.push({ kind: "bite", x: target.x, y: target.y, col: TOWERS[t.type].col, t: 0, dur: 220 }); sndShot("bite"); }
      }
      function roar(t) { const R = towerRange(t) * 1.3; enemies.forEach((e) => { if (!e.dead && dist(e.x, e.y, t.x, t.y) <= R) { e.stunT = Math.max(e.stunT, t.s.roarDur * 1000 * (e.def.boss ? 0.4 : 1)); if (t.s.roarDmg) hit(e, t, t.s.roarDmg); } }); ring(t.x, t.y, R, "#ff6b4d", 700); shakeT = 400; A().tone(80, 0.6, { type: "sawtooth", vol: 0.14, glide: 40 }); floaters.push({ x: t.x, y: t.y - S * 0.07, text: "ROAR", col: "#ff6b4d", t: 0, big: true }); }

      // ---------- simulation step ----------
      function step(dt) {
        now += dt; if (shakeT > 0) shakeT -= dt; roadDash += dt * 0.03;
        if (statsDirty) recomputeAll();
        // aura buffs on towers
        towers.forEach((t) => { t.buff = 0; t.buffRate = 0; t.buffRange = 0; });
        auras.forEach((a) => { if (!a.s.buff && !a.s.buffRate && !a.s.buffRange) return; const R = a.s.range * S; towers.forEach((t) => { if (t !== a && dist(t.x, t.y, a.x, a.y) <= R) { t.buff = Math.max(t.buff, a.s.buff || 0); t.buffRate = Math.max(t.buffRate, a.s.buffRate || 0); t.buffRange = Math.max(t.buffRange, a.s.buffRange || 0); } }); });
        // spawning
        if (waveActive) { waveT += dt; while (queue.length && queue[0].at <= waveT) { const q = queue.shift(); spawn(q.type, q.path); } }
        if (nextWaveIn > 0) { nextWaveIn -= dt; if (nextWaveIn <= 0) startWave(); }
        // enemies
        const slowAll = meta.slowAll;
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i]; if (e.dead) { enemies.splice(i, 1); continue; }
          if (e.hurt > 0) e.hurt -= dt;
          if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
          const aura = inAura(e, "slow"); const slowK = Math.max(e.slow, aura);
          if (e.poisonT > 0) { e.poisonT -= dt; const dmg = e.poison * dt / 1000; e.hp -= e.poisonArmor ? dmg : Math.max(0, dmg - e.armor * dt / 3000); if (e.hp <= 0) { kill(e, null); continue; } }
          if (e.bleedT > 0) { e.bleedT -= dt; e.hp -= e.bleed * dt / 1000; if (e.hp <= 0) { kill(e, null); continue; } }
          if (e.def.regen && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + e.def.regen * dt / 1000);
          if (e.stunT > 0) { e.stunT -= dt; } else { e.d += e.def.speed * S * (1 - slowK) * (1 - slowAll) * dt / 1000; }
          if (e.def.roar) { e.roarT -= dt; if (e.roarT <= 0) { e.roarT = e.def.roar * 1000; towers.forEach((t) => { if (dist(t.x, t.y, e.x, e.y) < S * 0.28) t.stunT = 2200; }); ring(e.x, e.y, S * 0.28, "#ff3b3b", 700); shakeT = 500; A().tone(70, 0.7, { type: "sawtooth", vol: 0.14, glide: 35 }); toast("The King roars — nearby reptiles freeze!", "#ff6b6b"); } }
          const P = paths[e.path];
          if (e.d >= P.len) { let leak = e.def.leak; if (e.def.boss && meta.bossLeakHalf) leak = Math.ceil(leak / 2); lives -= leak; e.dead = true; enemies.splice(i, 1); sndLeak(); shakeT = 300; ring(P.pts[P.pts.length - 1].x, P.pts[P.pts.length - 1].y, S * 0.08, "#ff3b3b", 400); renderHud(); if (lives <= 0) { lives = 0; endRun(false); return; } continue; }
          const p = pointAt(P, Math.max(0, e.d)); e.x = p.x; e.y = p.y; e.ang = p.ang;
        }
        if (waveActive && !queue.length && !enemies.length) waveCleared();
        // towers
        towers.forEach((t) => {
          if (t.atkK > 0) t.atkK = Math.max(0, t.atkK - dt / 160);
          if (t.stunT > 0) { t.stunT -= dt; return; }
          if (TOWERS[t.type].kind === "aura") return;
          if (t.s.roar) { t.roarT += dt; if (t.roarT >= t.s.roar * 1000 && enemies.some((e) => !e.dead && dist(e.x, e.y, t.x, t.y) <= towerRange(t) * 1.3)) { t.roarT = 0; roar(t); } }
          t.cd -= dt * (1 + t.buffRate);
          if (t.cd > 0) return;
          const list = candidates(t); const tgt = pickTarget(t, list); if (!tgt) { if (t.s.ramp) { t.ramp = 0; t.rampTgt = null; } return; }
          fire(t, tgt); t.cd = 1000 / t.s.rate;
        });
        // shots
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i]; s.t += dt;
          if (!s.tgt || s.tgt.dead) { const nt = enemies.filter((e) => !e.dead && !s.hitIds[e.id] && (s.from.s.air || !e.def.flying) && dist(e.x, e.y, s.x, s.y) < S * 0.14)[0]; if (!nt || s.t > 2500) { shots.splice(i, 1); continue; } s.tgt = nt; }
          const dx = s.tgt.x - s.x, dy = s.tgt.y - s.y, d = Math.hypot(dx, dy), stepL = s.spd * dt;
          if (!lowFx()) { s.trail.push({ x: s.x, y: s.y }); if (s.trail.length > 5) s.trail.shift(); }
          if (d <= stepL + s.tgt.def.r * S) { hit(s.tgt, s.from, s.dmg); s.hitIds[s.tgt.id] = 1; s.pierce--; if (s.pierce <= 0) { shots.splice(i, 1); continue; } s.tgt = null; }
          else { s.x += dx / d * stepL; s.y += dy / d * stepL; }
        }
        for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; if (f.kind === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.98; f.vy *= 0.98; } if (f.t > f.dur) fx.splice(i, 1); }
        for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].t += dt; if (floaters[i].t > (floaters[i].big ? 1600 : 800)) floaters.splice(i, 1); }
      }
      function update(dtRaw) {
        if (screen !== "game" || paused) { now += dtRaw; if (screen === "menu" || screen === "tree") { /* idle anim only */ } return; }
        const dt = Math.min(50, dtRaw);
        for (let i = 0; i < speed; i++) { step(dt); if (screen !== "game") break; }
      }

      // ================= RENDER =================
      function drawMapBase() {
        const grd = g.createLinearGradient(0, 0, S, S); grd.addColorStop(0, map.ground[0]); grd.addColorStop(1, map.ground[1]); g.fillStyle = grd; g.fillRect(0, 0, S, S);
        // texture + decor (deterministic)
        for (let i = 0; i < 220; i++) { const x = hash(i, 1) * S, y = hash(i, 2) * S; if (distToRoad(x, y) < roadW() * 0.8) continue; g.fillStyle = "rgba(255,255,255," + (0.015 + hash(i, 3) * 0.04) + ")"; ell(g, x, y, S * (0.008 + hash(i, 4) * 0.03), S * (0.005 + hash(i, 5) * 0.014), hash(i, 6) * 3); g.fill(); }
        // vignette + glow pools under the path so the road sits in the scene
        const vg = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)"); g.fillStyle = vg; g.fillRect(0, 0, S, S);
        // road shoulders: worn dirt + edge stones
        paths.forEach((P) => { g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = rgba(map.road, 0.35); g.lineWidth = roadW() * 1.7; strokePath(P); g.restore(); for (let i = 0; i < 70; i++) { const d = hash(i, 21) * P.len, side = hash(i, 22) < 0.5 ? -1 : 1, p = pointAt(P, d); const nx = -Math.sin(p.ang) * side, ny = Math.cos(p.ang) * side; const x = p.x + nx * roadW() * (0.62 + hash(i, 23) * 0.12), y = p.y + ny * roadW() * (0.62 + hash(i, 23) * 0.12); g.fillStyle = "rgba(255,255,255," + (0.08 + hash(i, 24) * 0.1) + ")"; ell(g, x, y, S * (0.003 + hash(i, 25) * 0.005), S * (0.002 + hash(i, 26) * 0.003), hash(i, 27) * 3); g.fill(); } });
        (map.water || []).forEach((w) => { g.fillStyle = "#17405a"; if (!lowFx()) { g.shadowColor = "#74b9ff"; g.shadowBlur = S * 0.03; } ell(g, w[0] * S, w[1] * S, w[2] * S, w[3] * S); g.fill(); g.shadowBlur = 0; g.fillStyle = "rgba(191,233,255,0.12)"; ell(g, w[0] * S - w[2] * S * 0.2, w[1] * S - w[3] * S * 0.2, w[2] * S * 0.6, w[3] * S * 0.5); g.fill(); });
        (map.lava || []).forEach((w) => { g.fillStyle = "#ff6b2a"; if (!lowFx()) { g.shadowColor = "#ff6b2a"; g.shadowBlur = S * 0.04; } ell(g, w[0] * S, w[1] * S, w[2] * S, w[3] * S); g.fill(); g.shadowBlur = 0; g.fillStyle = "#ffd36b"; ell(g, w[0] * S, w[1] * S, w[2] * S * 0.5, w[3] * S * 0.45); g.fill(); });
        (map.rocks || []).forEach((k) => { if (!k[2]) return; g.fillStyle = "#4e4a66"; ell(g, k[0] * S, k[1] * S, k[2] * S, k[2] * S * 0.7); g.fill(); g.fillStyle = "#6b6689"; ell(g, k[0] * S - k[2] * S * 0.25, k[1] * S - k[2] * S * 0.25, k[2] * S * 0.45, k[2] * S * 0.3); g.fill(); });
        for (let i = 0; i < 44; i++) { const x = hash(i, 11) * S, y = hash(i, 12) * S; if (distToRoad(x, y) < roadW() * 0.9 || blocked(x, y, S * 0.02) === "water") continue; drawDecor(map.decor, x, y, S * (0.016 + hash(i, 13) * 0.022), i); }
      }
      function drawDecor(kind, x, y, r, i) {
        g.save();
        if (kind === "reed") { g.strokeStyle = "#3f7a4a"; g.lineWidth = r * 0.16; g.lineCap = "round"; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + k * r * 0.3, y + r * 0.4); g.quadraticCurveTo(x + k * r * 0.5 + Math.sin(now * 0.001 + i) * r * 0.2, y - r * 0.6, x + k * r * 0.7, y - r * 1.4); g.stroke(); } g.fillStyle = "#8a6a3c"; ell(g, x + r * 0.7, y - r * 1.2, r * 0.12, r * 0.35); g.fill(); }
        else if (kind === "cactus") { g.fillStyle = "#3f8a5a"; rr(g, x - r * 0.25, y - r * 1.4, r * 0.5, r * 1.9, r * 0.25); g.fill(); rr(g, x - r * 0.9, y - r * 0.8, r * 0.7, r * 0.3, r * 0.15); g.fill(); rr(g, x - r * 0.9, y - r * 1.2, r * 0.3, r * 0.7, r * 0.15); g.fill(); g.fillStyle = "#ff8fd0"; dot(g, x, y - r * 1.45, r * 0.15); }
        else if (kind === "vine") { g.fillStyle = "#1f5e46"; if (!lowFx()) { g.shadowColor = "#3fa66a"; g.shadowBlur = r * 0.6; } dot(g, x, y - r * 0.6, r * 1.2); dot(g, x - r * 0.8, y, r * 0.9); dot(g, x + r * 0.8, y - r * 0.1, r * 0.9); g.shadowBlur = 0; g.fillStyle = "#2f8a5e"; dot(g, x - r * 0.3, y - r * 1.0, r * 0.45); g.fillStyle = "#4a3448"; g.fillRect(x - r * 0.15, y - r * 0.2, r * 0.3, r * 1.2); }
        else if (kind === "ember") { g.fillStyle = "#3a2a2a"; ell(g, x, y, r * 1.1, r * 0.6); g.fill(); const k = 0.5 + 0.5 * Math.sin(now * 0.004 + i); g.fillStyle = "rgba(255,120,60," + (0.3 + k * 0.5) + ")"; if (!lowFx()) { g.shadowColor = "#ff6b2a"; g.shadowBlur = r * 0.8 * k; } dot(g, x, y - r * 0.1, r * 0.25); g.shadowBlur = 0; }
        else if (kind === "rune") { g.strokeStyle = rgba("#c98cff", 0.35 + 0.25 * Math.sin(now * 0.002 + i)); g.lineWidth = Math.max(1, r * 0.1); g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x, y - r * 0.9); g.lineTo(x + r * 0.78, y + r * 0.45); g.lineTo(x - r * 0.78, y + r * 0.45); g.closePath(); g.stroke(); }
        g.restore();
      }
      function drawRoad() {
        paths.forEach((P, pi) => {
          g.save(); g.lineCap = "round"; g.lineJoin = "round";
          g.strokeStyle = rgba(map.glow, 0.22); g.lineWidth = roadW() * 1.25; if (!lowFx()) { g.shadowColor = map.glow; g.shadowBlur = S * 0.02; } strokePath(P); g.shadowBlur = 0;
          g.strokeStyle = map.road; g.lineWidth = roadW(); strokePath(P);
          g.strokeStyle = "rgba(255,255,255,0.18)"; g.lineWidth = Math.max(1, S * 0.004); g.setLineDash([S * 0.02, S * 0.025]); g.lineDashOffset = -roadDash; strokePath(P); g.setLineDash([]);
          g.restore();
          // spawn portal
          const s0 = P.pts[0]; g.save(); g.translate(s0.x, s0.y); g.rotate(now * 0.002); g.strokeStyle = rgba(map.glow, 0.8); g.lineWidth = S * 0.006; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, 0, roadW() * (0.35 + k * 0.12), k * 2, k * 2 + 4); g.stroke(); } g.restore();
          if (pi === 0) { // nest at the end
            const e0 = P.pts[P.pts.length - 1]; g.save(); g.translate(e0.x, e0.y);
            g.fillStyle = "#6b4a3c"; ell(g, 0, S * 0.01, roadW() * 0.62, roadW() * 0.4); g.fill(); g.fillStyle = "#8a6a4c"; ell(g, 0, S * 0.005, roadW() * 0.5, roadW() * 0.3); g.fill();
            for (let k = 0; k < 3; k++) { g.fillStyle = k === 1 ? "#f4e2c2" : "#e6ecf5"; if (!lowFx()) { g.shadowColor = map.glow; g.shadowBlur = S * 0.015; } ell(g, (k - 1) * roadW() * 0.22, -S * 0.005 + (k === 1 ? -S * 0.006 : 0), roadW() * 0.14, roadW() * 0.18); g.fill(); g.shadowBlur = 0; g.fillStyle = rgba(map.glow, 0.5); for (let q = 0; q < 3; q++) dot(g, (k - 1) * roadW() * 0.22 + (hash(k, q) - 0.5) * roadW() * 0.16, -S * 0.005 + (hash(q, k) - 0.5) * roadW() * 0.22, S * 0.003); }
            g.restore();
          }
        });
      }
      function strokePath(P) { g.beginPath(); P.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
      function drawTowers() {
        towers.forEach((t) => {
          const r = towerR(t), tier = Math.max.apply(null, t.tiers);
          g.fillStyle = "rgba(0,0,0,0.35)"; ell(g, t.x, t.y + r * 0.9, r * 1.4, r * 0.55); g.fill();
          if (TOWERS[t.type].kind === "aura" || t.s.buff) { g.strokeStyle = rgba(TOWERS[t.type].col, 0.18 + 0.06 * Math.sin(now * 0.003)); g.lineWidth = 1.5; g.setLineDash([S * 0.01, S * 0.012]); g.beginPath(); g.arc(t.x, t.y, towerRange(t), 0, TAU); g.stroke(); g.setLineDash([]); }
          g.save(); g.translate(t.x, t.y); g.rotate(t.angle); drawReptile(g, t.type, r, now + t.id * 331, tier, t.atkK); g.restore();
          if (t.stunT > 0) { g.fillStyle = "#ffd36b"; for (let k = 0; k < 3; k++) { const a = now * 0.006 + k * 2.1; dot(g, t.x + Math.cos(a) * r * 1.6, t.y - r * 1.6 + Math.sin(a) * r * 0.4, S * 0.005); } }
          if (t.buff) { g.fillStyle = rgba("#ffd36b", 0.9); g.font = "800 " + Math.round(S * 0.016) + "px system-ui"; g.textAlign = "center"; g.fillText("▲", t.x + r * 1.5, t.y - r * 1.3); }
        });
        if (selected) { const R = towerRange(selected); g.strokeStyle = rgba(TOWERS[selected.type].col, 0.7); g.lineWidth = 2; g.beginPath(); g.arc(selected.x, selected.y, R, 0, TAU); g.stroke(); g.fillStyle = rgba(TOWERS[selected.type].col, 0.06); g.fill(); }
        if (placing && hover) { const T = TOWERS[placing], r = S * 0.033, R = baseStats(placing).range * meta.rangeMul * S; g.save(); g.globalAlpha = 0.85; g.strokeStyle = hoverValid ? rgba("#7fe0a0", 0.8) : rgba("#ff6b6b", 0.8); g.fillStyle = hoverValid ? rgba("#7fe0a0", 0.08) : rgba("#ff6b6b", 0.1); g.lineWidth = 2; g.beginPath(); g.arc(hover.x, hover.y, R, 0, TAU); g.fill(); g.stroke(); g.globalAlpha = hoverValid ? 0.75 : 0.4; g.translate(hover.x, hover.y); g.rotate(-Math.PI / 2); drawReptile(g, placing, r, now, 0, 0); g.restore(); }
      }
      function drawEnemies() {
        enemies.forEach((e) => {
          if (e.d < 0) return;
          const r = e.def.r * S; g.save(); g.translate(e.x, e.y);
          if (e.def.flying) { g.fillStyle = "rgba(0,0,0,0.25)"; ell(g, S * 0.01, r * 1.4, r * 0.9, r * 0.4); g.fill(); g.translate(0, -r * 0.6); }
          else { g.fillStyle = "rgba(0,0,0,0.3)"; ell(g, 0, r * 0.6, r * 1.1, r * 0.5); g.fill(); }
          if (e.slow > 0 || inAura(e, "slow")) { g.strokeStyle = "rgba(116,185,255,0.6)"; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r * 1.5, 0, TAU); g.stroke(); }
          g.rotate(e.ang); drawBug(g, e.type, r, now, e.ph, e.hurt > 0); g.restore();
          if (e.poisonT > 0) { g.fillStyle = "rgba(127,224,160,0.7)"; for (let k = 0; k < 3; k++) dot(g, e.x + Math.sin(now * 0.005 + k * 2) * r, e.y - r * 1.3 - ((now * 0.03 + k * 10) % 30) / 30 * r, S * 0.003); }
          if (e.bleedT > 0) { g.fillStyle = "rgba(255,80,80,0.8)"; dot(g, e.x + r * 0.5, e.y + r * 0.6, S * 0.004); }
          if (e.stunT > 0) { g.fillStyle = "#ffd36b"; for (let k = 0; k < 3; k++) { const a = now * 0.007 + k * 2.1; dot(g, e.x + Math.cos(a) * r * 1.4, e.y - r * 1.6 + Math.sin(a) * r * 0.3, S * 0.004); } }
          if (e.hp < e.hpMax || e.def.boss) { const w = Math.max(S * 0.03, r * 2.4), k = clamp(e.hp / e.hpMax, 0, 1); g.fillStyle = "rgba(0,0,0,0.5)"; rr(g, e.x - w / 2, e.y - r * 1.9, w, S * 0.006, 2); g.fill(); g.fillStyle = k > 0.5 ? "#7fe0a0" : k > 0.25 ? "#ffd36b" : "#ff6b6b"; rr(g, e.x - w / 2, e.y - r * 1.9, w * k, S * 0.006, 2); g.fill(); }
          if (e.def.boss) { g.fillStyle = "#fff"; g.font = "800 " + Math.round(S * 0.016) + "px system-ui"; g.textAlign = "center"; g.fillText(e.def.name, e.x, e.y - r * 2.2); }
        });
      }
      function drawShots() {
        shots.forEach((s) => { g.strokeStyle = rgba(s.col, 0.55); g.lineWidth = S * 0.004; g.lineCap = "round"; if (s.trail.length) { g.beginPath(); g.moveTo(s.trail[0].x, s.trail[0].y); s.trail.forEach((p) => g.lineTo(p.x, p.y)); g.lineTo(s.x, s.y); g.stroke(); } g.fillStyle = "#fff"; if (!lowFx()) { g.shadowColor = s.col; g.shadowBlur = S * 0.012; } dot(g, s.x, s.y, S * 0.005); g.shadowBlur = 0; });
        fx.forEach((f) => {
          const k = f.t / f.dur; g.save(); g.globalAlpha = 1 - k;
          if (f.kind === "p") { g.fillStyle = f.col; dot(g, f.x, f.y, f.r * (1 - k * 0.5)); }
          else if (f.kind === "ring") { g.strokeStyle = f.col; g.lineWidth = S * 0.006 * (1 - k) + 1; g.beginPath(); g.arc(f.x, f.y, f.r * (0.3 + 0.7 * k), 0, TAU); g.stroke(); }
          else if (f.kind === "beam") { g.strokeStyle = f.col; g.lineWidth = S * 0.012 * (1 - k) + 1; if (!lowFx()) { g.shadowColor = f.col; g.shadowBlur = S * 0.02; } g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke(); }
          else if (f.kind === "cone") { g.fillStyle = rgba(f.col, 0.35); g.beginPath(); g.moveTo(f.x, f.y); g.arc(f.x, f.y, f.r * (0.6 + 0.4 * k), f.ang - f.cone, f.ang + f.cone); g.closePath(); g.fill(); }
          else if (f.kind === "bite") { g.strokeStyle = "#fff"; g.lineWidth = S * 0.005; g.beginPath(); g.arc(f.x, f.y, S * 0.02 * (1 + k), Math.PI * 0.15, Math.PI * 0.85); g.stroke(); g.beginPath(); g.arc(f.x, f.y, S * 0.02 * (1 + k), Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
          g.restore();
        });
        floaters.forEach((f) => { const dur = f.big ? 1600 : 800, k = f.t / dur; g.save(); g.globalAlpha = 1 - k * k; g.fillStyle = f.col; g.font = "800 " + Math.round(S * (f.big ? 0.03 : f.small ? 0.015 : 0.02)) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; if (!lowFx() && f.big) { g.shadowColor = f.col; g.shadowBlur = 10; } g.fillText(f.text, f.x, f.y - k * S * 0.05); g.restore(); });
      }
      let mapCache = null, mapCacheKey = "";
      function draw() {
        if (!g) return;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
        if (screen === "menu" || screen === "tree") { drawMenuBg(); return; }
        g.save();
        if (shakeT > 0) g.translate((Math.random() - 0.5) * S * 0.006, (Math.random() - 0.5) * S * 0.006);
        // cache the static map layer (ground + water + rocks) once per size
        const key = map.id + "@" + S + "@" + lowFx();
        if (mapCacheKey !== key) { mapCache = document.createElement("canvas"); mapCache.width = Math.round(S * dpr); mapCache.height = Math.round(S * dpr); const gg = mapCache.getContext("2d"); gg.setTransform(dpr, 0, 0, dpr, 0, 0); const old = g; g = gg; drawMapBase(); g = old; mapCacheKey = key; }
        g.drawImage(mapCache, 0, 0, S, S);
        // animated decor on top of the cache (cheap)
        if (map.decor === "ember" || map.decor === "rune") for (let i = 0; i < 44; i++) { const x = hash(i, 11) * S, y = hash(i, 12) * S; if (distToRoad(x, y) < roadW() * 0.9) continue; drawDecor(map.decor, x, y, S * (0.018 + hash(i, 13) * 0.02), i); }
        drawRoad(); drawTowers(); drawEnemies(); drawShots();
        if (paused && screen === "game") { g.fillStyle = "rgba(6,5,14,0.45)"; g.fillRect(0, 0, S, S); g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.07) + "px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("PAUSED", S / 2, S / 2); }
        g.restore();
      }
      function drawMenuBg() {
        const grd = g.createLinearGradient(0, 0, S, S); grd.addColorStop(0, "#0e1a18"); grd.addColorStop(1, "#141026"); g.fillStyle = grd; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + (0.08 + 0.25 * (0.5 + 0.5 * Math.sin(now * 0.002 + i))) + ")"; dot(g, hash(i, 7) * S, hash(i, 8) * S, S * 0.003); }
        // parade of reptiles
        const types = Object.keys(TOWERS);
        types.forEach((tp, i) => { const x = S * 0.1 + i * S * 0.1, y = S * 0.82 + Math.sin(now * 0.002 + i) * S * 0.01; g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.globalAlpha = unlocked(tp) ? 1 : 0.25; drawReptile(g, tp, S * 0.028, now + i * 400, unlocked(tp) ? 1 : 0, 0); g.restore(); });
        g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#7fe0a0"; if (!lowFx()) { g.shadowColor = "#7fe0a0"; g.shadowBlur = S * 0.03; } g.font = "900 " + Math.round(S * 0.11) + "px system-ui, sans-serif"; g.fillText("COLD BLOOD", S / 2, S * 0.14); g.shadowBlur = 0; g.fillStyle = "rgba(230,236,245,0.7)"; g.font = "600 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.fillText("reptile tower defense", S / 2, S * 0.215); g.restore();
      }

      // ================= DOM UI =================
      function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
      function iconCanvas(type, size) { const c = document.createElement("canvas"); const d = window.devicePixelRatio || 1; c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + "px"; const gg = c.getContext("2d"); gg.setTransform(d, 0, 0, d, 0, 0); gg.translate(size / 2, size / 2); gg.rotate(-Math.PI / 2); drawReptile(gg, type, size * 0.2, 0, 0, 0); return c; }
      function bugCanvas(type, size) { const c = document.createElement("canvas"); const d = window.devicePixelRatio || 1; c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + "px"; const gg = c.getContext("2d"); gg.setTransform(d, 0, 0, d, 0, 0); gg.translate(size / 2, size / 2); drawBug(gg, type, size * (ENEMIES[type].boss ? 0.12 : 0.22), 0, 0, false); return c; }
      function renderUI() { renderHud(); renderPanel(); }
      function renderHud() {
        if (!topbar) return;
        if (screen !== "game") { topbar.style.display = "none"; return; } topbar.style.display = "";
        topbar.innerHTML = "";
        const L = el("div", "cb-stat"); L.innerHTML = "<b>♥ " + lives + "</b><small>lives</small>"; const C = el("div", "cb-stat"); C.innerHTML = "<b>$" + Math.floor(cash) + "</b><small>cash</small>"; const Wv = el("div", "cb-stat"); Wv.innerHTML = "<b>" + Math.min(wave, 999) + (freeplay || wave > 40 ? "" : " / 40") + "</b><small>wave</small>";
        topbar.appendChild(L); topbar.appendChild(C); topbar.appendChild(Wv);
        const ctr = el("div", "cb-ctr");
        const start = el("button", "btn cb-start" + (waveActive ? " on" : ""), waveActive ? (paused ? "▶ Resume" : "⏸ Pause") : "▶ Start wave " + wave); start.onclick = () => { if (waveActive) { paused = !paused; } else { paused = false; startWave(); } renderHud(); }; ctr.appendChild(start);
        const spd = el("div", "cb-speed"); [1, 2, 3].forEach((v) => { const b = el("button", "cb-sp" + (speed === v ? " on" : ""), v + "×"); b.disabled = v === 3 && !meta.speed3; b.title = v === 3 && !meta.speed3 ? "Unlock 3× in the skill tree" : ""; b.onclick = () => { speed = v; renderHud(); }; spd.appendChild(b); }); ctr.appendChild(spd);
        const auto = el("button", "cb-auto" + (autoNext ? " on" : ""), "auto"); auto.title = "Start the next wave automatically"; auto.onclick = () => { autoNext = !autoNext; renderHud(); }; ctr.appendChild(auto);
        const menu = el("button", "cb-menu", "☰"); menu.title = "Maps / skill tree (run is saved between waves)"; menu.onclick = () => { paused = true; saveRun(); showMenu(); }; ctr.appendChild(menu);
        topbar.appendChild(ctr);
      }
      function renderPanel() {
        if (!panel) return;
        if (screen !== "game") { panel.style.display = "none"; return; } panel.style.display = "";
        panel.innerHTML = "";
        if (selected) {
          const t = selected, T = TOWERS[t.type], s = t.s || baseStats(t.type);
          const head = el("div", "cb-sel-head"); head.appendChild(iconCanvas(t.type, 48)); const hb = el("div"); hb.appendChild(el("b", null, T.name)); hb.appendChild(el("small", null, T.desc)); head.appendChild(hb); const x = el("button", "cb-x", "✕"); x.onclick = () => { selected = null; renderPanel(); }; head.appendChild(x); panel.appendChild(head);
          const st = el("div", "cb-stats"); const kind = T.kind; st.innerHTML = (kind === "aura" ? "<span>slow <b>" + Math.round(s.slow * 100) + "%</b></span><span>range <b>" + Math.round(s.range * 100) + "</b></span>" : "<span>dmg <b>" + Math.round(s.dmg * meta.dmgMul * (1 + t.buff)) + "</b></span><span>rate <b>" + (s.rate * (1 + t.buffRate)).toFixed(1) + "/s</b></span><span>range <b>" + Math.round(s.range * 100 * (1 + t.buffRange)) + "</b></span>") + (s.pierce > 1 ? "<span>pierce <b>" + Math.min(99, s.pierce) + "</b></span>" : "") + (s.crit ? "<span>crit <b>" + Math.round(s.crit * 100) + "%</b></span>" : "") + (s.poison ? "<span>poison <b>" + Math.round(s.poison) + "/s</b></span>" : "") + (s.bleed ? "<span>bleed <b>" + Math.round(s.bleed) + "/s</b></span>" : "") + "<span>kills <b>" + t.kills + "</b></span>" + (T.air ? "" : "<span class='cb-warn'>can't hit flyers</span>"); panel.appendChild(st);
          UP[t.type].forEach((path, pi) => {
            const row = el("div", "cb-path" + (t.tiers[pi] ? " has" : "") + (canUpgrade(t, pi) ? "" : " locked"));
            const lab = el("div", "cb-path-name"); lab.innerHTML = "<b>" + path.name + "</b><i>" + "●".repeat(t.tiers[pi]) + "○".repeat(3 - t.tiers[pi]) + "</i>"; row.appendChild(lab);
            const tier = t.tiers[pi], cost = upgradeCost(t, pi);
            if (cost != null && canUpgrade(t, pi)) { const b = el("button", "cb-up" + (cash >= cost ? "" : " poor")); b.innerHTML = "<b>" + path.tiers[tier].n + "</b><small>" + path.tiers[tier].d + "</small><em>$" + cost + "</em>"; b.onclick = () => upgrade(t, pi); row.appendChild(b); }
            else if (cost == null) row.appendChild(el("div", "cb-maxed", "MAXED · " + path.tiers[2].n));
            else row.appendChild(el("div", "cb-maxed dim", "locked — two paths max"));
            panel.appendChild(row);
          });
          const foot = el("div", "cb-sel-foot");
          if (kind !== "aura") { const tg = el("button", "cb-target", "target: " + t.mode); tg.onclick = () => { const modes = ["first", "last", "strong", "close"]; t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length]; renderPanel(); }; foot.appendChild(tg); }
          const sell = el("button", "cb-sell", "sell $" + Math.round(t.spent * meta.sell)); sell.onclick = () => sellTower(t); foot.appendChild(sell); panel.appendChild(foot);
          return;
        }
        panel.appendChild(el("div", "cb-shop-title", placing ? "Tap the map to place · right-click or ✕ to cancel" : "Reptiles — pick one, then tap the map"));
        const grid = el("div", "cb-shop");
        Object.keys(TOWERS).forEach((type, i) => {
          const T = TOWERS[type], ok = unlocked(type), card = el("button", "cb-card" + (placing === type ? " on" : "") + (!ok ? " lock" : cash < T.cost ? " poor" : ""));
          card.appendChild(iconCanvas(type, 44)); const nm = el("div", "cb-card-name"); nm.innerHTML = "<b>" + T.name + "</b><small>" + (ok ? "$" + T.cost : "🥚 skill tree") + "</small>"; card.appendChild(nm); card.title = T.desc + (T.air ? "" : " · cannot hit flyers"); card.appendChild(el("kbd", null, String(i + 1)));
          card.onclick = () => { if (!ok) { toast("Unlock " + T.name + " in the skill tree", "#c98cff"); return; } placing = placing === type ? null : type; selected = null; renderPanel(); };
          grid.appendChild(card);
        });
        panel.appendChild(grid);
        const tip = el("div", "cb-tip"); const nextBoss = [10, 20, 30, 35, 40].find((w) => w >= wave); tip.textContent = nextBoss ? "Next boss: wave " + nextBoss + " (" + ENEMIES[{ 10: "bigbeetle", 20: "centipede", 30: "raptor", 35: "ankylo", 40: "trex" }[nextBoss]].name + ")" : "Freeplay — bosses every 5 waves, bugs keep scaling."; panel.appendChild(tip);
      }
      function showMenu() {
        screen = "menu"; renderUI(); overlay.innerHTML = ""; overlay.style.display = ""; overlay.classList.add("menu");
        const card = el("div", "cb-card-big");
        const top = el("div", "cb-menu-top"); top.appendChild(el("h2", null, "Choose your ground")); const eggs = el("div", "cb-eggs", "🥚 " + save.eggs); eggs.title = "Eggs — spend them in the skill tree"; top.appendChild(eggs); const treeBtn = el("button", "btn cb-treebtn", "Skill tree"); treeBtn.onclick = showTree; top.appendChild(treeBtn); card.appendChild(top);
        if (save.run) { const r = save.run; const cont = el("button", "btn cb-continue", "▶ Continue run — " + MAPS[r.mapIdx].name + " · wave " + r.wave + " · " + DIFFS[r.diffIdx].name); cont.onclick = () => { overlay.style.display = "none"; newRun(r.mapIdx, r.diffIdx, r); }; card.appendChild(cont); }
        const maps = el("div", "cb-maps");
        MAPS.forEach((m, i) => { const b = el("button", "cb-map" + (pickMap === i ? " on" : "")); b.style.setProperty("--mc", m.accent); const pv = document.createElement("canvas"); pv.width = 180; pv.height = 120; drawMapPreview(pv, m); b.appendChild(pv); const nm = el("div", "cb-map-name"); const best = ["easy", "normal", "hard"].map((d) => save.best[m.id + ":" + d] || 0); nm.innerHTML = "<b>" + m.name + "</b><small>" + m.sub + "</small><i>best: " + (Math.max.apply(null, best) ? best.map((v, k) => DIFFS[k].name[0] + v).join(" · ") : "—") + "</i>"; b.appendChild(nm); b.onclick = () => { pickMap = i; showMenu(); }; maps.appendChild(b); });
        card.appendChild(maps);
        const dif = el("div", "cb-diffs"); DIFFS.forEach((d, i) => { const b = el("button", "cb-diff" + (pickDiff === i ? " on" : "")); b.innerHTML = "<b>" + d.name + "</b><small>" + d.lives + " lives · $" + d.start + " · eggs ×" + d.eggs + "</small>"; b.onclick = () => { pickDiff = i; showMenu(); }; dif.appendChild(b); }); card.appendChild(dif);
        const go = el("button", "btn cb-go", "Defend " + MAPS[pickMap].name); go.onclick = () => { overlay.style.display = "none"; newRun(pickMap, pickDiff, null); }; card.appendChild(go);
        if (!save.seen) { card.appendChild(el("p", "cb-help", "Bugs march down the road toward your nest. Pick a reptile below the map, tap the ground beside the road to place it, then Start wave. Click a reptile to upgrade it down two of its three paths. Dinosaurs show up at waves 10, 20, 30, 35 and 40. Every run earns eggs for the skill tree.")); }
        overlay.appendChild(card);
      }
      function drawMapPreview(cv, m) { const gg = cv.getContext("2d"), W = cv.width, H = cv.height; const grd = gg.createLinearGradient(0, 0, W, H); grd.addColorStop(0, m.ground[0]); grd.addColorStop(1, m.ground[1]); gg.fillStyle = grd; gg.fillRect(0, 0, W, H); (m.water || []).forEach((w) => { gg.fillStyle = "#17405a"; gg.beginPath(); gg.ellipse(w[0] * W, w[1] * H, w[2] * W, w[3] * H, 0, 0, TAU); gg.fill(); }); (m.lava || []).forEach((w) => { gg.fillStyle = "#ff6b2a"; gg.beginPath(); gg.ellipse(w[0] * W, w[1] * H, w[2] * W, w[3] * H, 0, 0, TAU); gg.fill(); }); [m.path].concat(m.path2 ? [m.path2] : []).forEach((P) => { gg.strokeStyle = m.glow; gg.lineWidth = 9; gg.lineCap = "round"; gg.lineJoin = "round"; gg.globalAlpha = 0.35; gg.beginPath(); P.forEach((p, i) => (i ? gg.lineTo(p[0] * W, p[1] * H) : gg.moveTo(p[0] * W, p[1] * H))); gg.stroke(); gg.globalAlpha = 1; gg.strokeStyle = m.road; gg.lineWidth = 6; gg.stroke(); }); }
      function showTree() {
        screen = "tree"; renderUI(); overlay.innerHTML = ""; overlay.style.display = ""; overlay.classList.add("menu");
        const card = el("div", "cb-card-big");
        const top = el("div", "cb-menu-top"); top.appendChild(el("h2", null, "Skill tree")); top.appendChild(el("div", "cb-eggs", "🥚 " + save.eggs)); const back = el("button", "btn ghost", "← Maps"); back.onclick = showMenu; top.appendChild(back); card.appendChild(top);
        card.appendChild(el("p", "cb-help", "Eggs come from every run (waves cleared × difficulty × map). Nodes are permanent."));
        const cols = el("div", "cb-tree");
        ["Economy", "Offense", "Defense", "Unlocks"].forEach((br) => {
          const col = el("div", "cb-branch"); col.appendChild(el("h3", null, br));
          TREE.filter((n) => n.branch === br).forEach((n) => {
            const owned = !!save.nodes[n.id], reqOk = !n.req || save.nodes[n.req], can = !owned && reqOk && save.eggs >= n.cost;
            const b = el("button", "cb-node" + (owned ? " owned" : can ? " can" : reqOk ? " poor" : " locked")); b.innerHTML = "<b>" + n.name + "</b><small>" + n.d + "</small><em>" + (owned ? "✓" : "🥚 " + n.cost) + "</em>";
            b.onclick = () => { if (owned) return; if (!reqOk) { toast("Needs " + TREE.find((q) => q.id === n.req).name + " first", "#ff8fa3"); return; } if (save.eggs < n.cost) { toast("Not enough eggs — play a run!", "#ff8fa3"); sndNo(); return; } save.eggs -= n.cost; save.nodes[n.id] = true; meta = metaFromNodes(save.nodes); persist(); sndUpgrade(); showTree(); };
            col.appendChild(b);
          });
          cols.appendChild(col);
        });
        card.appendChild(cols); overlay.appendChild(card);
      }
      function showEnd(victory, cleared, eggs, prevBest) {
        overlay.innerHTML = ""; overlay.style.display = ""; overlay.classList.remove("menu");
        const card = el("div", "cb-card-big cb-end");
        card.appendChild(el("h2", null, victory ? "🏆 The nest is safe!" : "The nest fell."));
        card.appendChild(el("p", "cb-endline", (victory ? "You cleared all 40 waves of " : "You held ") + map.name + " (" + diff.name + ")" + (victory ? "." : " for " + cleared + " wave" + (cleared === 1 ? "" : "s") + ".") + (cleared > prevBest ? "  New best!" : "")));
        const eg = el("div", "cb-endeggs"); eg.innerHTML = "<b>+" + eggs + " 🥚</b><small>eggs earned · " + save.eggs + " total</small>"; card.appendChild(eg);
        const row = el("div", "btn-row");
        if (victory) { const keep = el("button", "btn", "Keep going (freeplay)"); keep.onclick = () => { overlay.style.display = "none"; freeplay = true; won = false; paused = false; screen = "game"; renderUI(); }; row.appendChild(keep); }
        const again = el("button", "btn" + (victory ? " ghost" : ""), "Play again"); again.onclick = () => { overlay.style.display = "none"; newRun(MAPS.indexOf(map), DIFFS.indexOf(diff), null); }; row.appendChild(again);
        const tr = el("button", "btn ghost", "Skill tree"); tr.onclick = showTree; row.appendChild(tr);
        const mp = el("button", "btn ghost", "Maps"); mp.onclick = showMenu; row.appendChild(mp);
        card.appendChild(row);
        if (window.Arcade && Arcade.leaderboardPanel) { const lb = Arcade.leaderboardPanel("coldblood:" + map.id + ":" + diff.id, null, map.name + " · " + diff.name + " (waves)"); lb.style.margin = "12px auto 0"; card.appendChild(lb); }
        overlay.appendChild(card);
      }

      // ================= INPUT =================
      function canvasPoint(intent) { return { x: intent.x, y: intent.y }; }
      function onDown(x, y, button) {
        if (screen !== "game") return;
        if (button === 2) { placing = null; selected = null; renderPanel(); return; }
        if (placing) { if (place(placing, x, y)) { if (!(window.Arcade && Arcade.input && false)) placing = cash >= TOWERS[placing].cost ? placing : null; } renderPanel(); return; }
        let best = null, bd = 1e9; towers.forEach((t) => { const d = dist(x, y, t.x, t.y); if (d < towerR(t) * 1.6 && d < bd) { bd = d; best = t; } });
        selected = best; renderPanel();
      }
      function onMove(x, y) { hover = { x, y }; if (placing) hoverValid = !blocked(x, y, S * 0.033); }

      function resize() {
        const wide = window.innerWidth >= 900;
        S = wide ? Math.floor(Math.min(window.innerWidth - 340, window.innerHeight * 0.8, 820)) : Arcade.board.stageSize(700);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px"; canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        wrap.classList.toggle("wide", wide);
        if (map) { paths = [buildPath(map.path)]; if (map.path2) paths.push(buildPath(map.path2)); }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c; reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          styleEl = document.createElement("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl);
          wrap = el("div", "cb"); const left = el("div", "cb-left"); topbar = el("div", "cb-top"); canvas = document.createElement("canvas"); canvas.className = "cb-canvas"; g = canvas.getContext("2d");
          left.appendChild(topbar); left.appendChild(canvas); toastEl = el("div", "cb-toast"); left.appendChild(toastEl); wrap.appendChild(left);
          panel = el("div", "cb-panel"); wrap.appendChild(panel);
          overlay = el("div", "cb-overlay"); wrap.appendChild(overlay);
          stage.appendChild(wrap);
          canvas.addEventListener("contextmenu", (e) => e.preventDefault());
          load(); if (!save.seen) { /* first-run help shows on the menu */ }
          now = 0; resize(); ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(resize);
          keyFn = (e) => { if (screen !== "game") return; if (e.key === " ") { e.preventDefault(); if (waveActive) paused = !paused; else startWave(); renderHud(); } else if (/^[1-9]$/.test(e.key)) { const type = Object.keys(TOWERS)[+e.key - 1]; if (type && unlocked(type)) { placing = placing === type ? null : type; selected = null; renderPanel(); } } else if (e.key === "Escape" || e.key.toLowerCase() === "q") { placing = null; selected = null; renderPanel(); } else if (e.key.toLowerCase() === "s" && selected) sellTower(selected); };
          window.addEventListener("keydown", keyFn);
          showMenu();
          Arcade._cb = { get: () => ({ screen, map: map && map.id, diff: diff && diff.id, cash, lives, wave, waveActive, towers: towers.map((t) => ({ type: t.type, x: t.x, y: t.y, tiers: t.tiers, kills: t.kills })), enemies: enemies.length, S, eggs: save.eggs, nodes: Object.keys(save.nodes), paths: paths.map((P) => P.pts) }), cheat: (o) => { if (o.cash != null) cash = o.cash; if (o.eggs != null) { save.eggs = o.eggs; persist(); } if (o.wave != null) wave = o.wave; renderUI(); }, act: { startWave, place, upgrade: (i, pi) => upgrade(towers[i], pi), select: (i) => { selected = towers[i]; renderPanel(); }, newRun, showMenu, showTree, setSpeed: (v) => { speed = v; }, endRun } };
          draw();
        },
        handleInput(intent) { if (intent.type !== "point") return; if (intent.phase === "move") onMove(intent.x, intent.y); else if (intent.phase === "down") onDown(intent.x, intent.y, intent.button); },
        tick(dt) { update(dt); draw(); if (screen === "game" && !paused && (now % 400) < 20) renderHud(); },
        getScore() { return Math.max(0, wave - 1); },
        teardown() {
          if (screen === "game" && !won) saveRun();
          if (unResize) unResize(); unResize = null; if (keyFn) window.removeEventListener("keydown", keyFn); keyFn = null;
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); if (window.Arcade) delete Arcade._cb;
          stageEl = ctx = canvas = g = wrap = panel = topbar = overlay = toastEl = null; towers = []; enemies = []; shots = []; fx = []; mapCache = null; mapCacheKey = "";
        }
      };
    }
  });

  const CSS = `
.cb{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;position:relative}
.cb.wide{flex-direction:row;align-items:flex-start;justify-content:center}
.cb-left{display:flex;flex-direction:column;align-items:center;gap:8px;position:relative}
.cb-canvas{border-radius:18px;background:#0e1a18;box-shadow:0 0 50px rgba(127,224,160,.12);touch-action:none;cursor:crosshair;display:block}
.cb-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;min-height:44px}
.cb-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:4px 12px;display:flex;flex-direction:column;align-items:center;min-width:64px}.cb-stat b{font-size:18px;line-height:1.1}.cb-stat small{opacity:.55;font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.cb-ctr{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.cb-start{padding:8px 14px!important;font-size:14px!important}.cb-start.on{background:rgba(255,255,255,.12)!important;color:#e6ecf5!important}
.cb-speed{display:flex;border:1px solid rgba(255,255,255,.14);border-radius:10px;overflow:hidden}.cb-sp,.cb-auto,.cb-menu{background:rgba(255,255,255,.05);border:0;color:#e6ecf5;font:inherit;font-size:13px;font-weight:700;padding:8px 10px;cursor:pointer}.cb-sp.on,.cb-auto.on{background:rgba(127,224,160,.25);color:#7fe0a0}.cb-sp:disabled{opacity:.35;cursor:not-allowed}.cb-auto,.cb-menu{border:1px solid rgba(255,255,255,.14);border-radius:10px}
.cb-toast{position:absolute;left:50%;bottom:12px;transform:translateX(-50%) translateY(10px);background:rgba(10,8,20,.9);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px 14px;font-weight:700;font-size:14px;opacity:0;transition:.2s;pointer-events:none;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}.cb-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.cb-panel{width:100%;max-width:820px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:12px}.cb.wide .cb-panel{width:300px;flex:0 0 300px;max-height:calc(100vh - 140px);overflow-y:auto}
.cb-shop-title{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.6;margin-bottom:8px}
.cb-shop{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.cb.wide .cb-shop{grid-template-columns:repeat(2,1fr)}
.cb-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px 6px;color:#e6ecf5;font:inherit;cursor:pointer;text-align:center}.cb-card:hover{border-color:rgba(127,224,160,.5)}.cb-card.on{border-color:#7fe0a0;background:rgba(127,224,160,.16);box-shadow:0 0 18px rgba(127,224,160,.25)}.cb-card.poor{opacity:.55}.cb-card.lock{opacity:.4;filter:grayscale(.6)}.cb-card kbd{position:absolute;top:4px;left:6px;font-size:10px;opacity:.4}
.cb-card-name b{display:block;font-size:12px}.cb-card-name small{opacity:.7;font-size:11px;color:#ffd36b}
.cb-tip{margin-top:8px;font-size:12px;opacity:.6}
.cb-sel-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}.cb-sel-head b{display:block;font-size:15px}.cb-sel-head small{opacity:.65;font-size:12px;display:block}.cb-x{margin-left:auto;background:transparent;border:0;color:#e6ecf5;opacity:.6;font-size:16px;cursor:pointer}
.cb-stats{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;opacity:.85;margin-bottom:8px}.cb-stats b{color:#7fe0a0}.cb-warn{color:#ff8fa3}
.cb-path{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px;margin-bottom:6px;background:rgba(255,255,255,.03)}.cb-path.has{border-color:rgba(127,224,160,.35)}.cb-path.locked{opacity:.5}
.cb-path-name{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}.cb-path-name i{color:#ffd36b;letter-spacing:2px;font-style:normal}
.cb-up{width:100%;display:grid;grid-template-columns:1fr auto;gap:2px 8px;text-align:left;background:rgba(127,224,160,.12);border:1px solid rgba(127,224,160,.4);border-radius:10px;padding:6px 8px;color:#e6ecf5;font:inherit;cursor:pointer}.cb-up b{font-size:13px}.cb-up small{grid-column:1;opacity:.7;font-size:11px}.cb-up em{grid-row:1/3;align-self:center;font-style:normal;font-weight:800;color:#ffd36b}.cb-up.poor{opacity:.5;border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.04)}
.cb-maxed{font-size:12px;color:#7fe0a0;font-weight:700}.cb-maxed.dim{color:rgba(230,236,245,.45);font-weight:500}
.cb-sel-foot{display:flex;gap:8px;margin-top:6px}.cb-target,.cb-sell{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px;color:#e6ecf5;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.cb-sell{border-color:rgba(255,107,107,.5);color:#ff8fa3}
.cb-overlay{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;z-index:5;overflow-y:auto;padding:6px}.cb-overlay.menu{padding-top:min(24vh,190px)}
.cb-card-big{width:min(880px,100%);background:rgba(14,11,26,.94);border:1px solid rgba(127,224,160,.35);border-radius:22px;padding:18px 20px;box-shadow:0 0 60px rgba(127,224,160,.12);backdrop-filter:blur(6px)}
.cb-menu-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}.cb-menu-top h2{margin:0;font-size:22px;flex:1}.cb-eggs{font-weight:800;color:#ffd36b;font-size:18px}
.cb-continue{width:100%;margin-bottom:10px;background:#ffd36b!important;color:#0e0c1e!important}
.cb-maps{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}
.cb-map{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px;color:#e6ecf5;font:inherit;cursor:pointer;text-align:left}.cb-map canvas{width:100%;height:auto;border-radius:10px;display:block}.cb-map.on{border-color:var(--mc);box-shadow:0 0 18px color-mix(in srgb,var(--mc) 40%,transparent)}.cb-map-name b{display:block;font-size:13px;margin-top:6px}.cb-map-name small{opacity:.6;font-size:11px;display:block}.cb-map-name i{font-style:normal;font-size:11px;color:#ffd36b;display:block}
.cb-diffs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}.cb-diff{flex:1;min-width:120px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px;color:#e6ecf5;font:inherit;cursor:pointer}.cb-diff b{display:block}.cb-diff small{opacity:.6;font-size:11px}.cb-diff.on{border-color:#7fe0a0;background:rgba(127,224,160,.14)}
.cb-go{width:100%;font-size:16px!important;padding:12px!important}
.cb-help{font-size:13px;opacity:.7;line-height:1.5;margin:12px 0 0}
.cb-tree{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.cb-branch h3{margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
.cb-node{display:block;width:100%;text-align:left;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:8px 10px;color:#e6ecf5;font:inherit;cursor:pointer;margin-bottom:6px;position:relative}.cb-node b{display:block;font-size:13px}.cb-node small{opacity:.65;font-size:11px;display:block}.cb-node em{position:absolute;top:8px;right:10px;font-style:normal;font-weight:800;color:#ffd36b;font-size:12px}
.cb-node.owned{border-color:rgba(127,224,160,.5);background:rgba(127,224,160,.12)}.cb-node.owned em{color:#7fe0a0}.cb-node.can{border-color:rgba(255,211,107,.6)}.cb-node.locked{opacity:.4}.cb-node.poor{opacity:.7}
.cb-end{text-align:center}.cb-end h2{margin:0 0 6px}.cb-endline{opacity:.8;margin:0 0 10px}.cb-endeggs b{font-size:28px;color:#ffd36b;display:block}.cb-endeggs small{opacity:.6}.cb-end .btn-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
@media (max-width:899px){.cb-panel{padding:10px}.cb-top{font-size:13px}}
`;
})();
