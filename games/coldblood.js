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
  const DIFFS = [{ id: "easy", name: "Easy", hp: 0.8, cash: 1.15, lives: 30, start: 800, eggs: 1 }, { id: "normal", name: "Normal", hp: 1, cash: 1, lives: 20, start: 650, eggs: 1.5 }, { id: "hard", name: "Hard", hp: 1.35, cash: 0.85, lives: 10, start: 550, eggs: 2.2 }, { id: "apoc", name: "Apocalypse", hp: 3, cash: 1.6, lives: 15, start: 900, eggs: 4, elite: 0.3, needRebirth: 5 }];

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
    hatchery:  { name: "Iguana Hatchery", cost: 550, dmg: 0, rate: 0, range: 0.1, kind: "farm", air: true, col: "#c9e07f", dark: "#6e8a3a", desc: "Money maker. Iguanas lay golden eggs — pays out after every wave.", income: 100 },
    snapper:   { name: "Snapping Turtle", cost: 700, dmg: 70, rate: 0.35, range: 0.17, kind: "bite", air: false, col: "#4a8a7a", dark: "#25504a", desc: "WATER ONLY. Lurks under the surface; bites hard and drags bugs under.", armorPierce: 4, execute: 0.08, waterOnly: true },
    komodo:    { name: "Komodo Dragon",cost: 520, dmg: 30, rate: 0.8, range: 0.12, kind: "bite",  air: false, col: "#b8865a", dark: "#6a4a2a", desc: "Brawler. Savage bites that leave bacteria (bleed).", bleed: 5, unlock: "komodo" },
    croc:      { name: "Crocodile",    cost: 650, dmg: 18, rate: 0.45, range: 0.15, kind: "slam",  air: false, col: "#2f6e3f", dark: "#1a4a28", desc: "Amphibious — build on land OR in water. Death roll slams everything close, stuns briefly.", stun: 0.6, armorPierce: 2, water: true, unlock: "croc" },
    basilisk:  { name: "Basilisk",     cost: 900, dmg: 9,  rate: 1.4, range: 0.24, kind: "beam",  air: true,  col: "#ff8fd0", dark: "#a04a8a", desc: "Stone gaze. A beam that pierces a whole line of bugs.", pierce: 4, unlock: "basilisk" },
    ptero:     { name: "Pterodactyl",  cost: 1100, dmg: 26, rate: 1.1, range: 0.3, kind: "dart",  air: true,  col: "#74b9ff", dark: "#3f7fc4", desc: "Sky hunter. Flies ANYWHERE — over road, water, lava. Can patrol a lane. Bonus damage vs flyers.", pierce: 2, airBonus: 2, fly: true, unlock: "ptero" },
    trex:      { name: "T-Rex",        cost: 2400, dmg: 90, rate: 0.5, range: 0.2, kind: "bite",  air: false, col: "#ff6b4d", dark: "#8a2a2a", desc: "The king. Devastating bites; a roar that freezes the road.", roar: 9, roarDur: 2.2, armorPierce: 6, unlock: "trex" },
    // ---- REBIRTH reptiles: one per rebirth, permanent ----
    emberdrake:   { name: "Ember Drake",     cost: 1500, dmg: 12, rate: 1.1, range: 0.24, kind: "spray",  air: true,  col: "#ff8f3d", dark: "#a8401a", desc: "Dragonfire cone. Everything it touches burns.", poison: 14, cone: 0.5, rebirth: 1 },
    frostwyrm:    { name: "Frost Wyrm",      cost: 1900, dmg: 16, rate: 1.2, range: 0.28, kind: "beam",   air: true,  col: "#9fe3ff", dark: "#3f8fc4", desc: "Glacial breath. A piercing beam that freezes bugs solid.", pierce: 3, slowHit: 0.5, stunChance: 0.15, stunHit: 1, rebirth: 2 },
    stormserpent: { name: "Storm Serpent",   cost: 2400, dmg: 45, rate: 0.9, range: 0.26, kind: "chain",  air: true,  col: "#c98cff", dark: "#6a3fa8", desc: "Chain lightning that leaps from bug to bug.", chain: 5, rebirth: 3 },
    titanoboa:    { name: "Titanoboa",       cost: 3000, dmg: 30, rate: 0.6, range: 0.23, kind: "coil",   air: false, col: "#7fe0a0", dark: "#2a7a4a", desc: "The road itself coils. Crushes every bug in reach and shoves them back.", knockback: 0.05, rebirth: 4 },
    ancientdragon:{ name: "Ancient Dragon",  cost: 5200, dmg: 140, rate: 0.35, range: 0.34, kind: "meteor", air: true, col: "#ffd36b", dark: "#a8781a", desc: "Calls meteors down on the road. Apocalypse-grade.", meteors: 3, aoe: 0.07, rebirth: 5 }
  };
  const REBIRTH_PERKS = [
    { n: 1, reptile: "emberdrake", perk: "+25% eggs from every run", m: (m) => { m.eggMul += 0.25; } },
    { n: 2, reptile: "frostwyrm", perk: "+200 starting cash", m: (m) => { m.startCash += 200; } },
    { n: 3, reptile: "stormserpent", perk: "+10% damage for all reptiles", m: (m) => { m.dmgMul += 0.1; } },
    { n: 4, reptile: "titanoboa", perk: "sell towers for 100%", m: (m) => { m.sell = Math.max(m.sell, 1); } },
    { n: 5, reptile: "ancientdragon", perk: "unlocks APOCALYPSE difficulty (elite bugs with special abilities)", m: (m) => { m.apocalypse = true; } }
  ];
  const REBIRTH_NEED = 17;   // nodes owned to allow a rebirth (of 21)
  // elite abilities (Apocalypse: 30% of bugs from wave 3; freeplay past 40: 15%)
  const ELITES = {
    shield: { name: "Shielded", col: "#74b9ff", d: "+8 armor, regenerates" },
    phase:  { name: "Phasing",  col: "#c98cff", d: "blinks forward every 4 s" },
    split:  { name: "Splitter", col: "#7fe0a0", d: "splits into 3 on death" },
    heal:   { name: "Healer",   col: "#ff8fd0", d: "heals nearby bugs" },
    titan:  { name: "Titan",    col: "#ffd36b", d: "3× hp; stuns reptiles on death" }
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

  UP.hatchery = [
    { name: "Brood", tiers: [{ n: "Bigger Clutch", c: 350, d: "+$70 every wave", m: (s) => { s.income += 70; } }, { n: "Twin Iguanas", c: 800, d: "+$140 every wave", m: (s) => { s.income += 140; } }, { n: "Golden Eggs", c: 2000, d: "+$300/wave, lays $40 every 10 s mid-wave", m: (s) => { s.income += 300; s.trickle = 40; } }] },
    { name: "Nest Vault", tiers: [{ n: "Vault", c: 400, d: "stores eggs, +15% interest/wave, tap to collect (cap $3000)", m: (s) => { s.bank = 0.15; s.cap = 3000; } }, { n: "Deep Vault", c: 900, d: "+20% interest, cap $8000", m: (s) => { s.bank = 0.2; s.cap = 8000; } }, { n: "Dragon's Hoard", c: 2400, d: "+30% interest, cap $20000", m: (s) => { s.bank = 0.3; s.cap = 20000; } }] },
    { name: "Market", tiers: [{ n: "Egg Trader", c: 380, d: "kills nearby pay +15%", m: (s) => { s.cashBonus = 0.15; s.range *= 1.6; } }, { n: "Bazaar", c: 850, d: "kills nearby pay +35%", m: (s) => { s.cashBonus = 0.35; s.range *= 1.3; } }, { n: "Monopoly", c: 2200, d: "kills nearby pay +70%, +$60/wave", m: (s) => { s.cashBonus = 0.7; s.income += 60; } }] }
  ];
  UP.snapper = [
    { name: "Ambush", tiers: [{ n: "Long Neck", c: 300, d: "+30% range", m: (s) => { s.range *= 1.3; } }, { n: "Lunge", c: 700, d: "+50 damage", m: (s) => { s.dmg += 50; } }, { n: "Leviathan", c: 1800, d: "+150 damage, bosses take 2×", m: (s) => { s.dmg += 150; s.bossMul = 2; } }] },
    { name: "Drag Under", tiers: [{ n: "Undertow", c: 350, d: "15% to drag a bug under (instant kill)", m: (s) => { s.execute = 0.15; } }, { n: "Riptide", c: 800, d: "25% drag-under", m: (s) => { s.execute = 0.25; } }, { n: "The Deep", c: 2000, d: "40% drag-under, bites stun 1 s", m: (s) => { s.execute = 0.4; s.stunChance = 1; s.stunHit = 1; } }] },
    { name: "Shell", tiers: [{ n: "Quick Snap", c: 320, d: "+40% attack speed", m: (s) => { s.rate *= 1.4; } }, { n: "Jaws", c: 750, d: "+50% attack speed", m: (s) => { s.rate *= 1.5; } }, { n: "Shellbreaker", c: 1900, d: "ignores all armor, bites slow 50%", m: (s) => { s.armorPierce += 99; s.slowHit = 0.5; } }] }
  ];
  UP.emberdrake = [
    { name: "Inferno", tiers: [{ n: "Hotter", c: 500, d: "+60% burn", m: (s) => { s.poison *= 1.6; } }, { n: "Lingering Flame", c: 1100, d: "burn lasts 2×", m: (s) => { s.poisonDur *= 2; } }, { n: "Hellfire", c: 2600, d: "burn ignores armor, +20/s", m: (s) => { s.poison += 20; s.poisonArmor = true; } }] },
    { name: "Wingspan", tiers: [{ n: "Glide", c: 450, d: "+30% range", m: (s) => { s.range *= 1.3; } }, { n: "Wide Breath", c: 1000, d: "cone 1.6× wider", m: (s) => { s.cone *= 1.6; } }, { n: "Firestorm", c: 2400, d: "full-circle breath, +40% speed", m: (s) => { s.cone = Math.PI; s.rate *= 1.4; } }] },
    { name: "Dragonfire", tiers: [{ n: "Searing", c: 520, d: "+15 damage", m: (s) => { s.dmg += 15; } }, { n: "Molten", c: 1200, d: "ignores 6 armor, +20 damage", m: (s) => { s.armorPierce += 6; s.dmg += 20; } }, { n: "Draconic Fury", c: 2800, d: "bosses take 2×", m: (s) => { s.bossMul = 2; } }] }
  ];
  UP.frostwyrm = [
    { name: "Deep Freeze", tiers: [{ n: "Chill", c: 600, d: "slow 65%", m: (s) => { s.slowHit = 0.65; } }, { n: "Flash Freeze", c: 1300, d: "40% stun chance", m: (s) => { s.stunChance = 0.4; } }, { n: "Absolute Zero", c: 3000, d: "stun 2 s, bosses too (30%)", m: (s) => { s.stunHit = 2; s.stunChance = 0.6; } }] },
    { name: "Glacier Ray", tiers: [{ n: "Long Ray", c: 550, d: "+35% range", m: (s) => { s.range *= 1.35; } }, { n: "Wide Ray", c: 1200, d: "pierces everything", m: (s) => { s.pierce += 99; } }, { n: "Ice Age", c: 2700, d: "+60% attack speed", m: (s) => { s.rate *= 1.6; } }] },
    { name: "Shatter", tiers: [{ n: "Brittle", c: 600, d: "slowed bugs take +50%", m: (s) => { s.slowedMul = 1.5; } }, { n: "Fracture", c: 1300, d: "+25 damage", m: (s) => { s.dmg += 25; } }, { n: "Shatterpoint", c: 3000, d: "slowed bugs take 2.5×", m: (s) => { s.slowedMul = 2.5; } }] }
  ];
  UP.stormserpent = [
    { name: "Overload", tiers: [{ n: "Arc", c: 700, d: "chains to 3 more bugs", m: (s) => { s.chain += 3; } }, { n: "Grid", c: 1500, d: "chains to 4 more, longer jumps", m: (s) => { s.chain += 4; s.chainR = 0.18; } }, { n: "Tempest", c: 3400, d: "chains to everything in range", m: (s) => { s.chain += 99; } }] },
    { name: "Thunder", tiers: [{ n: "Crackle", c: 700, d: "+30 damage", m: (s) => { s.dmg += 30; } }, { n: "Boom", c: 1500, d: "+50 damage, ignores 5 armor", m: (s) => { s.dmg += 50; s.armorPierce += 5; } }, { n: "Skyfall", c: 3400, d: "damage doubles each jump (cap 4×)", m: (s) => { s.chainRamp = true; } }] },
    { name: "Static", tiers: [{ n: "Tingle", c: 650, d: "20% stun 0.6 s", m: (s) => { s.stunChance = 0.2; s.stunHit = 0.6; } }, { n: "Jolt", c: 1400, d: "+50% attack speed", m: (s) => { s.rate *= 1.5; } }, { n: "Paralysis", c: 3200, d: "50% stun 1.2 s", m: (s) => { s.stunChance = 0.5; s.stunHit = 1.2; } }] }
  ];
  UP.titanoboa = [
    { name: "Constrict", tiers: [{ n: "Squeeze", c: 800, d: "bugs in reach slow 40%", m: (s) => { s.slow = 0.4; } }, { n: "Crush Grip", c: 1700, d: "slow 60%, +20 damage", m: (s) => { s.slow = 0.6; s.dmg += 20; } }, { n: "Python", c: 3800, d: "stuns everything it hits 0.8 s", m: (s) => { s.stun = 0.8; } }] },
    { name: "Crush", tiers: [{ n: "Bone Break", c: 800, d: "ignores all armor", m: (s) => { s.armorPierce += 99; } }, { n: "Pulverize", c: 1800, d: "+40 damage", m: (s) => { s.dmg += 40; } }, { n: "Extinction Coil", c: 4000, d: "+100 damage, bosses 2×", m: (s) => { s.dmg += 100; s.bossMul = 2; } }] },
    { name: "Colossus", tiers: [{ n: "Longer", c: 750, d: "+30% range", m: (s) => { s.range *= 1.3; } }, { n: "Faster", c: 1600, d: "+50% attack speed", m: (s) => { s.rate *= 1.5; } }, { n: "World Serpent", c: 3800, d: "+50% range, huge knockback", m: (s) => { s.range *= 1.5; s.knockback = 0.12; } }] }
  ];
  UP.ancientdragon = [
    { name: "Cataclysm", tiers: [{ n: "More Meteors", c: 1500, d: "+2 meteors", m: (s) => { s.meteors += 2; } }, { n: "Bigger Impacts", c: 3200, d: "blast radius 1.6×", m: (s) => { s.aoe *= 1.6; } }, { n: "Armageddon", c: 7000, d: "+4 meteors, +50% speed", m: (s) => { s.meteors += 4; s.rate *= 1.5; } }] },
    { name: "Hellfire", tiers: [{ n: "Burning Sky", c: 1500, d: "impacts burn 20/s", m: (s) => { s.poison = 20; } }, { n: "Scorched Earth", c: 3200, d: "burn ignores armor, 4 s", m: (s) => { s.poisonArmor = true; s.poisonDur = 4; } }, { n: "Sunfall", c: 7000, d: "impacts stun 1 s", m: (s) => { s.stunHit = 1; } }] },
    { name: "Apex", tiers: [{ n: "Elder", c: 1500, d: "+120 damage", m: (s) => { s.dmg += 120; } }, { n: "Ancient", c: 3200, d: "+40% range, bosses 2×", m: (s) => { s.range *= 1.4; s.bossMul = 2; } }, { n: "Godslayer", c: 7500, d: "+400 damage", m: (s) => { s.dmg += 400; } }] }
  ];

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
  function metaFromNodes(nodes, rebirth) {
    const m = { startCash: 0, cashMul: 1, sell: 0.7, waveCash: 0, dmgMul: 1, dotMul: 1, rangeMul: 1, t3disc: 0, lives: 0, heal10: 0, slowAll: 0, bossLeakHalf: false, unlocked: {}, speed3: false, eggMul: 1, apocalypse: false, rebirth: rebirth || 0 };
    TREE.forEach((n) => { if (nodes[n.id]) n.m(m); });
    REBIRTH_PERKS.forEach((r) => { if ((rebirth || 0) >= r.n) r.m(m); });
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
    else if (type === "hatchery") {
      g.rotate(Math.PI / 2);
      g.fillStyle = "#6e4a2a"; ell(g, 0, 0, r * 1.25, r * 1.0); g.fill(); g.shadowBlur = 0; g.fillStyle = "#4a3018"; ell(g, 0, r * 0.05, r * 0.85, r * 0.65); g.fill();
      g.strokeStyle = "#8a6238"; g.lineWidth = r * 0.08; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.72); g.lineTo(Math.cos(a + 0.5) * r * 1.2, Math.sin(a + 0.5) * r * 0.95); g.stroke(); }
      const gl = 0.6 + 0.4 * Math.sin(now * 0.004); g.fillStyle = "#ffd36b"; if (!lowFx()) { g.shadowColor = "#ffd36b"; g.shadowBlur = r * 0.5 * gl; }
      [[-0.3, -0.1], [0.25, -0.15], [0, 0.22]].forEach((e, i) => { ell(g, e[0] * r, e[1] * r, r * 0.28, r * 0.36); g.fill(); }); g.shadowBlur = 0;
      g.fillStyle = "#fff4c8"; [[-0.3, -0.1], [0.25, -0.15], [0, 0.22]].forEach((e) => { dot(g, e[0] * r - r * 0.08, e[1] * r - r * 0.12, r * 0.07); });
      // iguana on the rim
      g.save(); g.translate(r * 0.9, -r * 0.7); g.rotate(-0.6 + Math.sin(now * 0.002) * 0.1); g.strokeStyle = dark; g.lineWidth = r * 0.14; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 0.5, 0); g.lineTo(-r * 1.1, r * 0.2 * Math.sin(now * 0.003)); g.stroke(); g.fillStyle = col; ell(g, 0, 0, r * 0.6, r * 0.24); g.fill(); ell(g, r * 0.6, 0, r * 0.22, r * 0.17); g.fill(); g.fillStyle = dark; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-r * 0.4 + i * r * 0.22, -r * 0.2); g.lineTo(-r * 0.32 + i * r * 0.22, -r * 0.45); g.lineTo(-r * 0.24 + i * r * 0.22, -r * 0.2); g.fill(); } g.fillStyle = "#1a1a1a"; dot(g, r * 0.68, -r * 0.06, r * 0.04); g.restore();
    } else if (type === "snapper") {
      g.strokeStyle = rgba("#9fe3ff", 0.35 + 0.2 * Math.sin(now * 0.005)); g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, 0, r * 1.7 + Math.sin(now * 0.003) * r * 0.1, 0, TAU); g.stroke();
      g.strokeStyle = dark; g.lineWidth = r * 0.3; g.lineCap = "round"; [[-0.6, -0.8], [-0.6, 0.8], [0.5, -0.85], [0.5, 0.85]].forEach((p, i) => { g.beginPath(); g.moveTo(p[0] * r, p[1] * r * 0.6); g.lineTo(p[0] * r + r * 0.15, p[1] * r + Math.sin(now * 0.004 + i) * r * 0.08); g.stroke(); });
      g.strokeStyle = dark; g.lineWidth = r * 0.2; g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(-r * 1.5, Math.sin(now * 0.003) * r * 0.2); g.stroke();
      g.fillStyle = dark; ell(g, 0, 0, r * 1.05, r * 0.85); g.fill(); g.shadowBlur = 0; g.fillStyle = col; ell(g, 0, 0, r * 0.85, r * 0.68); g.fill();
      g.strokeStyle = dark; g.lineWidth = r * 0.06; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-r * 0.7 + i * r * 0.5, -r * 0.6); g.lineTo(-r * 0.7 + i * r * 0.5, r * 0.6); g.stroke(); } g.beginPath(); g.moveTo(-r * 0.8, 0); g.lineTo(r * 0.8, 0); g.stroke();
      g.fillStyle = shade(col, 0.85); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-r * 0.5 + i * r * 0.5, -r * 0.05); g.lineTo(-r * 0.4 + i * r * 0.5, -r * 0.35); g.lineTo(-r * 0.3 + i * r * 0.5, -r * 0.05); g.fill(); }
      g.fillStyle = dark; ell(g, r * 1.15 + rec * r * 0.5, 0, r * 0.45, r * 0.34); g.fill(); g.fillStyle = "#e6ecf5"; g.beginPath(); g.moveTo(r * 1.5 + rec * r * 0.5, -r * 0.1); g.lineTo(r * 1.75 + rec * r * 0.7, 0); g.lineTo(r * 1.5 + rec * r * 0.5, r * 0.1); g.fill();
      g.fillStyle = "#ffd36b"; dot(g, r * 1.2 + rec * r * 0.5, -r * 0.18, r * 0.08); dot(g, r * 1.2 + rec * r * 0.5, r * 0.18, r * 0.08);
    } else if (type === "emberdrake" || type === "ancientdragon") {
      const big = type === "ancientdragon", flap = Math.sin(now * 0.008) * 0.3, W = big ? 2.6 : 2.0;
      g.fillStyle = dark; [-1, 1].forEach((d) => { g.beginPath(); g.moveTo(-r * 0.2, 0); g.lineTo(-r * 0.9, d * r * W * (0.75 + flap * 0.25)); g.lineTo(r * 0.4, d * r * W * 0.9 * (0.75 + flap * 0.25)); g.lineTo(r * 0.9, d * r * 0.5); g.closePath(); g.fill(); });
      g.strokeStyle = col; g.lineWidth = r * 0.08; [-1, 1].forEach((d) => { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-r * 0.1, 0); g.lineTo(-r * 0.9 + k * r * 0.65, d * r * W * (0.75 + flap * 0.25) * (0.7 + k * 0.15)); g.stroke(); } });
      g.strokeStyle = dark; g.lineWidth = r * 0.4; g.lineCap = "round"; g.beginPath(); g.moveTo(-r * 1.0, 0); for (let i = 1; i <= 5; i++) { const t = i / 5; g.lineTo(-r * 1.0 - t * r * 1.6, Math.sin(now * 0.003 + t * 3) * r * 0.3 * t); } g.stroke();
      g.fillStyle = col; ell(g, 0, 0, r * 1.3, r * 0.6); g.fill(); g.shadowBlur = 0; g.fillStyle = shade(col, 1.3); ell(g, -r * 0.1, 0, r * 0.8, r * 0.28); g.fill();
      g.fillStyle = dark; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-r * 0.9 + i * r * 0.4, -r * 0.1); g.lineTo(-r * 0.75 + i * r * 0.4, -r * 0.5); g.lineTo(-r * 0.6 + i * r * 0.4, -r * 0.1); g.fill(); }
      g.fillStyle = col; ell(g, r * 1.55, 0, r * 0.7, r * 0.38); g.fill(); g.fillStyle = dark; g.beginPath(); g.moveTo(r * 1.2, -r * 0.3); g.lineTo(r * 1.0, -r * 0.9); g.lineTo(r * 1.45, -r * 0.35); g.fill(); g.beginPath(); g.moveTo(r * 1.2, r * 0.3); g.lineTo(r * 1.0, r * 0.9); g.lineTo(r * 1.45, r * 0.35); g.fill();
      g.fillStyle = big ? "#fff" : "#ffd36b"; dot(g, r * 1.65, -r * 0.16, r * 0.1); dot(g, r * 1.65, r * 0.16, r * 0.1);
      // breath glow at the snout
      const gl = 0.5 + 0.5 * Math.sin(now * 0.01) + rec; g.fillStyle = rgba(big ? "#fff4c8" : "#ffd36b", 0.35 + gl * 0.4); dot(g, r * 2.25, 0, r * (0.12 + gl * 0.12 + rec * 0.3));
      if (big) { g.fillStyle = "#ffd36b"; g.beginPath(); g.moveTo(r * 1.3, -r * 0.5); g.lineTo(r * 1.45, -r * 1.05); g.lineTo(r * 1.65, -r * 0.6); g.lineTo(r * 1.85, -r * 1.1); g.lineTo(r * 1.95, -r * 0.5); g.fill(); }
    } else if (type === "frostwyrm" || type === "stormserpent" || type === "titanoboa") {
      const L = type === "titanoboa" ? 3.2 : 2.4, w = type === "titanoboa" ? 0.55 : 0.36;
      g.strokeStyle = col; g.lineWidth = r * w; g.lineCap = "round"; g.beginPath(); for (let i = 0; i <= 16; i++) { const t = i / 16; g.lineTo(-r * L * 0.85 + t * r * L, Math.sin(t * 7 + now * 0.004) * r * 0.55 * (1 - t * 0.6)); } g.stroke(); g.shadowBlur = 0;
      g.strokeStyle = shade(col, 1.35); g.lineWidth = r * w * 0.35; g.setLineDash([r * 0.2, r * 0.25]); g.lineDashOffset = -now * 0.02; g.stroke(); g.setLineDash([]);
      if (type === "frostwyrm") { g.fillStyle = "#e8fbff"; for (let i = 0; i < 5; i++) { const t = 0.15 + i * 0.17, x = -r * L * 0.85 + t * r * L, y = Math.sin(t * 7 + now * 0.004) * r * 0.55 * (1 - t * 0.6); g.beginPath(); g.moveTo(x - r * 0.1, y); g.lineTo(x, y - r * 0.5); g.lineTo(x + r * 0.1, y); g.fill(); } }
      if (type === "stormserpent") { for (let i = 0; i < 4; i++) { const t = 0.2 + i * 0.2, x = -r * L * 0.85 + t * r * L, y = Math.sin(t * 7 + now * 0.004) * r * 0.55 * (1 - t * 0.6); g.strokeStyle = rgba("#ffffff", 0.5 + 0.5 * Math.sin(now * 0.03 + i)); g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r * 0.2, y - r * 0.45); g.lineTo(x + r * 0.05, y - r * 0.4); g.lineTo(x + r * 0.25, y - r * 0.8); g.stroke(); } }
      // head
      g.fillStyle = dark; ell(g, r * L * 0.2, 0, r * 0.7 * (type === "titanoboa" ? 1.2 : 1), r * 0.85 * (type === "titanoboa" ? 1.1 : 1)); g.fill(); g.fillStyle = col; ell(g, r * L * 0.22, 0, r * 0.5, r * 0.6); g.fill(); ell(g, r * L * 0.22 + r * 0.6, 0, r * 0.45, r * 0.32); g.fill();
      g.fillStyle = type === "frostwyrm" ? "#9fe3ff" : type === "stormserpent" ? "#fff" : "#ffd36b"; dot(g, r * L * 0.22 + r * 0.7, -r * 0.16, r * 0.09); dot(g, r * L * 0.22 + r * 0.7, r * 0.16, r * 0.09);
      if (type === "frostwyrm") { g.fillStyle = "#e8fbff"; g.beginPath(); g.moveTo(r * L * 0.2, -r * 0.6); g.lineTo(r * L * 0.1, -r * 1.3); g.lineTo(r * L * 0.35, -r * 0.7); g.fill(); g.beginPath(); g.moveTo(r * L * 0.2, r * 0.6); g.lineTo(r * L * 0.1, r * 1.3); g.lineTo(r * L * 0.35, r * 0.7); g.fill(); }
      g.strokeStyle = "#ff6b8a"; g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(r * L * 0.22 + r * 1.0, 0); g.lineTo(r * L * 0.22 + r * 1.35 + rec * r * 0.5, -r * 0.1); g.moveTo(r * L * 0.22 + r * 1.0, 0); g.lineTo(r * L * 0.22 + r * 1.35 + rec * r * 0.5, r * 0.1); g.stroke();
    }
    g.restore();
    if (TOWERS[type].rebirth) { g.save(); g.strokeStyle = rgba(col, 0.35 + 0.2 * Math.sin(now * 0.004)); g.lineWidth = Math.max(1.5, r * 0.06); g.beginPath(); g.arc(0, 0, r * 2.3, 0, TAU); g.stroke(); g.restore(); }
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
      let selected = null, placing = null, moving = null, hud = null, hover = null, hoverValid = false, idSeq = 1, shakeT = 0, roadDash = 0, nextWaveIn = 0, statsDirty = true;
      let pickMap = 0, pickDiff = 1, toastEl = null, toastT = null;

      // ---------- persistence ----------
      function load() { save = Object.assign({ eggs: 0, nodes: {}, best: {}, runs: 0, run: null, seen: false, rebirth: 0 }, ctx.storage.get("save", {}) || {}); meta = metaFromNodes(save.nodes, save.rebirth); }
      function persist() { ctx.storage.set("save", save); }
      function unlocked(type) { const T = TOWERS[type]; if (T.rebirth) return (save.rebirth || 0) >= T.rebirth; return !T.unlock || meta.unlocked[T.unlock]; }

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
      function blocked(x, y, r, type, ignore) {
        const T = type ? TOWERS[type] : null;
        if (x < r || y < r || x > S - r || y > S - r) return "edge";
        for (const t of towers) if (t !== ignore && t.patrol == null && dist(x, y, t.x, t.y) < r + towerR(t) * 0.95) return "tower";
        if (T && T.fly) return null;
        if (distToRoad(x, y) < roadW() / 2 + r * 0.8) return "road";
        const inside = (w, pad) => { const dx = (x - w[0] * S) / (w[2] * S + pad), dy = (y - w[1] * S) / (w[3] * S + pad); return dx * dx + dy * dy < 1; };
        for (const w of (map.lava || [])) if (inside(w, r)) return "lava";
        const inWater = (map.water || []).some((w) => inside(w, r)), deepWater = (map.water || []).some((w) => inside(w, -r * 0.6));
        if (T && T.waterOnly) { if (!deepWater) return "land"; }
        else if (inWater && !(T && T.water)) return "water";
        for (const k of (map.rocks || [])) { if (k[2] > 0 && dist(x, y, k[0] * S, k[1] * S) < k[2] * S + r) return "rock"; }
        return null;
      }
      function blockMsg(why, T) { return why === "road" ? "Not on the road!" : why === "water" ? (T && T.name) + " can't swim — build on land" : why === "land" ? (T && T.name) + " lives in WATER — tap a pond" : why === "lava" ? "That's lava." : why === "tower" ? "Too close to another reptile" : "Can't build there"; }
      function towerR(t) { return S * (t.type === "trex" ? 0.05 : t.type === "croc" || t.type === "komodo" ? 0.04 : 0.033); }

      // ---------- run setup ----------
      function newRun(mapIdx, diffIdx, restore) {
        map = MAPS[mapIdx]; diff = DIFFS[diffIdx]; freeplay = false; won = false;
        paths = [buildPath(map.path)]; if (map.path2) paths.push(buildPath(map.path2));
        towers = []; enemies = []; shots = []; fx = []; floaters = []; queue = []; selected = null; placing = null; moving = null; waveActive = false; paused = false; speed = 1;
        cash = diff.start + meta.startCash; lives = diff.lives + meta.lives; wave = 1;
        if (restore) { cash = restore.cash; lives = restore.lives; wave = restore.wave; freeplay = !!restore.freeplay; restore.towers.forEach((rt) => { const t = mkTower(rt.type, rt.x * S, rt.y * S); t.tiers = rt.tiers.slice(); t.mode = rt.mode || "first"; t.spent = rt.spent || TOWERS[rt.type].cost; t.bank = rt.bank || 0; if (rt.patrol != null && TOWERS[rt.type].fly) { t.patrol = rt.patrol; } towers.push(t); }); }
        statsDirty = true; screen = "game"; ctx.setScore(wave - 1); renderUI(); toast(map.name + " · " + diff.name + (restore ? " — run restored" : ""), map.accent);
      }
      function saveRun() { save.run = { mapIdx: MAPS.indexOf(map), diffIdx: DIFFS.indexOf(diff), cash, lives, wave, freeplay, towers: towers.map((t) => ({ type: t.type, x: (t.patrol != null ? t.hx : t.x) / S, y: (t.patrol != null ? t.hy : t.y) / S, tiers: t.tiers, mode: t.mode, spent: t.spent, bank: t.bank || 0, patrol: t.patrol })) }; persist(); }
      function mkTower(type, x, y) { return { id: idSeq++, type, x, y, hx: x, hy: y, patrol: null, pd: 0, pdir: 1, bank: 0, farmT: 0, spawnT: 0, tiers: [0, 0, 0], mode: "first", cd: 0, angle: -Math.PI / 2, kills: 0, spent: TOWERS[type].cost, atkK: 0, stunT: 0, roarT: 0, ramp: 0, rampTgt: null, s: null, buff: 0, buffRate: 0, buffRange: 0 }; }

      // ---------- stats ----------
      function baseStats(type) { const T = TOWERS[type]; return { dmg: T.dmg, rate: T.rate, range: T.range, pierce: T.pierce || 1, crit: T.crit || 0, critMul: 2, air: !!T.air, armorPierce: T.armorPierce || 0, poison: T.poison || 0, poisonDur: 3, poisonArmor: false, cone: T.cone || 0, slow: T.slow || 0, slowHit: T.slowHit || 0, slowDur: 1.5, stun: T.stun || 0, stunHit: T.stunHit || 0, stunChance: T.stunChance || 0, chain: T.chain || 0, chainR: 0.13, chainRamp: false, meteors: T.meteors || 0, aoe: T.aoe || 0, bleed: T.bleed || 0, bleedDur: 3, bleedSpread: false, buff: T.buff || 0, buffRate: 0, buffRange: 0, cashWave: 0, cashBonus: 0, vuln: 0, bossMul: 1, slowedMul: 1, knockback: T.knockback || 0, airBonus: T.airBonus || 1, execute: T.execute || 0, income: T.income || 0, trickle: 0, bank: 0, cap: 0, roar: T.roar || 0, roarDur: T.roarDur || 0, roarDmg: 0, ramp: false, airOnlyFar: false }; }
      function computeStats(t) { const s = baseStats(t.type); UP[t.type].forEach((path, pi) => { for (let k = 0; k < t.tiers[pi]; k++) path.tiers[k].m(s); }); s.range *= meta.rangeMul; if (s.poison) s.poison *= meta.dotMul; if (s.bleed) s.bleed *= meta.dotMul; t.s = s; }
      function recomputeAll() { towers.forEach(computeStats); auras = towers.filter((t) => t.s.buff || t.s.slow || t.s.vuln || t.s.cashBonus); statsDirty = false; }
      function towerRange(t) { return t.s.range * S * (1 + t.buffRange); }
      function upgradeCost(t, pi) { const tier = t.tiers[pi]; if (tier >= 3) return null; let c = UP[t.type][pi].tiers[tier].c; if (tier === 2 && meta.t3disc) c = Math.round(c * (1 - meta.t3disc)); return c; }
      function canUpgrade(t, pi) { if (t.tiers[pi] >= 3) return false; const used = t.tiers.filter((x, i) => x > 0 && i !== pi).length; return used < 2; }
      function upgrade(t, pi) { const c = upgradeCost(t, pi); if (c == null || !canUpgrade(t, pi)) { sndNo(); return; } if (cash < c) { toast("Not enough cash", "#ff8fa3"); sndNo(); return; } cash -= c; t.spent += c; t.tiers[pi]++; statsDirty = true; sndUpgrade(); burst(t.x, t.y, TOWERS[t.type].col, 26); burst(t.x, t.y, "#ffd36b", 12); ring(t.x, t.y, S * 0.12, "#ffd36b", 500); t.spawnT = 0.6; floaters.push({ x: t.x, y: t.y - S * 0.08, text: UP[t.type][pi].tiers[t.tiers[pi] - 1].n.toUpperCase() + "!", col: "#ffd36b", t: 0, big: true }); floaters.push({ x: t.x, y: t.y - S * 0.04, text: "-$" + c, col: "#ffd36b", t: 0 }); shakeT = Math.max(shakeT, 120); renderUI(); }
      function sellTower(t) { const v = Math.round(t.spent * meta.sell); cash += v; towers = towers.filter((x) => x !== t); if (selected === t) selected = null; if (moving === t) moving = null; statsDirty = true; burst(t.x, t.y, "#ff8fa3", 18); ring(t.x, t.y, S * 0.08, "#ff8fa3", 400); floaters.push({ x: t.x, y: t.y - S * 0.03, text: "SOLD  +$" + v, col: "#ffd36b", t: 0, big: true }); sndSell(); renderUI(); }
      function place(type, x, y) {
        const T = TOWERS[type]; if (!unlocked(type)) return; const r = S * 0.033;
        if (cash < T.cost) { toast("Not enough cash for " + T.name, "#ff8fa3"); sndNo(); return false; }
        const why = blocked(x, y, r, type); if (why) { toast(blockMsg(why, T), "#ff8fa3"); sndNo(); return false; }
        cash -= T.cost; const t = mkTower(type, x, y); t.spawnT = 1; towers.push(t); statsDirty = true; if (!placing) selected = t; sndPlace(); A().tone(140, 0.12, { type: "triangle", vol: 0.08, glide: 60 }); burst(x, y, T.col, 22); burst(x, y, "#c8b89a", 10); ring(x, y, S * 0.09, T.col, 450); ring(x, y, S * 0.05, "#ffffff", 250); floaters.push({ x, y: y - S * 0.05, text: "-$" + T.cost, col: "#ffd36b", t: 0 }); floaters.push({ x, y: y - S * 0.09, text: T.name.toUpperCase() + " DEPLOYED", col: T.col, t: 0, big: true }); shakeT = Math.max(shakeT, 140); renderUI(); return true;
      }

      // ---------- sounds ----------
      const A = () => ctx.audio;
      function sndClick() { A().tone(660, 0.05, { type: "sine", vol: 0.05, glide: 880 }); }
      function sndPick() { A().arp([440, 660], { dur: 0.07, step: 0.05, vol: 0.07, type: "triangle" }); }
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
      let noElite = false;
      function spawn(type, pathIdx) {
        const def = ENEMIES[type], scale = diff.hp * map.diff * (1 + (wave - 1) * 0.085) * (wave > 40 ? Math.pow(1.11, wave - 40) : 1);
        const e = { id: idSeq++, type, def, hp: def.hp * scale, hpMax: def.hp * scale, d: -S * 0.02, path: pathIdx, x: 0, y: 0, ang: 0, slow: 0, slowT: 0, stunT: 0, poison: 0, poisonT: 0, poisonArmor: false, bleed: 0, bleedT: 0, ph: Math.random() * TAU, hurt: 0, roarT: def.roar ? def.roar * 1000 * 0.6 : 0, armor: def.armor || 0, elite: null, eT: 0 };
        const eliteChance = def.boss ? 0 : (diff.elite && wave >= 3 ? diff.elite : wave > 40 ? 0.15 : 0);
        if (eliteChance && Math.random() < eliteChance && !noElite) { const keys = Object.keys(ELITES); e.elite = keys[Math.floor(Math.random() * keys.length)]; if (e.elite === "shield") e.armor += 8; if (e.elite === "titan") { e.hp *= 3; e.hpMax *= 3; } }
        const p = pointAt(paths[pathIdx], 0); e.x = p.x; e.y = p.y; e.ang = p.ang; enemies.push(e); return e;
      }
      function waveCleared() {
        waveActive = false;
        const bonus = Math.round((100 + wave * 6) * diff.cash) + meta.waveCash + towers.reduce((s, t) => s + (t.s.cashWave || 0), 0);
        cash += bonus; floaters.push({ x: S / 2, y: S * 0.12, text: "wave " + wave + " cleared  +$" + bonus, col: "#ffd36b", t: 0, big: true });
        towers.forEach((t) => { if (!t.s || !t.s.income) return; if (t.s.bank) { t.bank = Math.min(t.s.cap, Math.floor((t.bank + t.s.income) * (1 + t.s.bank))); floaters.push({ x: t.x, y: t.y - S * 0.06, text: "🥚 $" + t.bank + " stored", col: "#c9e07f", t: 0 }); } else { cash += t.s.income; floaters.push({ x: t.x, y: t.y - S * 0.06, text: "🥚 +$" + t.s.income, col: "#ffd36b", t: 0, big: true }); } burst(t.x, t.y, "#ffd36b", 12); });
        if (meta.heal10 && wave % 10 === 0) { lives += meta.heal10; toast("Second Wind: +" + meta.heal10 + " lives", "#7fe0a0"); }
        wave++; ctx.setScore(wave - 1); saveRun(); renderUI();
        if (wave === 41 && !freeplay) { won = true; endRun(true); return; }
        if (autoNext) nextWaveIn = 1400;
      }
      function endRun(victory) {
        const cleared = wave - 1, mapId = map.id, dId = diff.id;
        const key = mapId + ":" + dId, prevBest = save.best[key] || 0;
        let eggs = Math.floor(cleared * diff.eggs * map.diff * meta.eggMul); if (victory && prevBest < 40) eggs += 40;
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
        if (s.execute && !e.def.boss && e.hp < e.hpMax * 0.9 + 1 && Math.random() < s.execute) { d = e.hp + e.armor + 999; floaters.push({ x: e.x, y: e.y - S * 0.04, text: "DRAGGED UNDER", col: "#9fe3ff", t: 0, big: true }); ring(e.x, e.y, S * 0.05, "#9fe3ff", 350); }
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
        e.dead = true; const bonus = (1 + inAura(e, "cashBonus") + (t && t.s.cashBonus ? t.s.cashBonus : 0)) * (e.elite ? 2 : 1);
        if (e.elite === "split") { noElite = true; for (let i = 0; i < 3; i++) { const s2 = spawn(e.type, e.path); s2.d = e.d - i * S * 0.015; s2.hp = s2.hpMax = e.hpMax * 0.35; } noElite = false; ring(e.x, e.y, S * 0.06, ELITES.split.col, 350); }
        if (e.elite === "titan") { towers.forEach((tw) => { if (dist(tw.x, tw.y, e.x, e.y) < S * 0.2) tw.stunT = Math.max(tw.stunT, 1500); }); ring(e.x, e.y, S * 0.2, ELITES.titan.col, 600); shakeT = 400; }
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
        else if (TOWERS[t.type].kind === "chain") { const pts = [{ x: t.x, y: t.y }]; const hitSet = {}; let cur = target, dmg = s.dmg, k = 0; while (cur && k < s.chain) { hit(cur, t, dmg); hitSet[cur.id] = 1; pts.push({ x: cur.x, y: cur.y }); k++; if (s.chainRamp) dmg = Math.min(s.dmg * 4, dmg * 1.6); const cx = cur.x, cy = cur.y; cur = enemies.filter((e) => !e.dead && !hitSet[e.id] && (s.air || !e.def.flying) && dist(e.x, e.y, cx, cy) < s.chainR * S).sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy))[0]; } fx.push({ kind: "bolt", pts, col: TOWERS[t.type].col, t: 0, dur: 200 }); A().tone(1200, 0.08, { type: "sawtooth", vol: 0.05, glide: 300 }); }
        else if (TOWERS[t.type].kind === "coil") { candidates(t).forEach((e) => { hit(e, t, s.dmg); if (s.stun && !e.def.boss) e.stunT = Math.max(e.stunT, s.stun * 1000); if (s.knockback) e.d = Math.max(0, e.d - s.knockback * S); }); fx.push({ kind: "coil", x: t.x, y: t.y, r: R, col: TOWERS[t.type].col, t: 0, dur: 450 }); shakeT = Math.max(shakeT, 160); sndShot("slam"); }
        else if (TOWERS[t.type].kind === "meteor") { const list = candidates(t); for (let k = 0; k < s.meteors && list.length; k++) { const e = list[Math.floor(Math.random() * list.length)]; const ix = e.x, iy = e.y; enemies.forEach((o) => { if (!o.dead && (s.air || !o.def.flying) && dist(o.x, o.y, ix, iy) <= s.aoe * S) hit(o, t, s.dmg); }); fx.push({ kind: "meteor", x: ix, y: iy, r: s.aoe * S, col: TOWERS[t.type].col, t: 0, dur: 520 }); burst(ix, iy, "#ff8f3d", 10); } shakeT = Math.max(shakeT, 220); A().tone(70, 0.4, { type: "sawtooth", vol: 0.1, glide: 30 }); }
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
          if (e.elite) { e.eT += dt; if (e.elite === "shield" && e.hp < e.hpMax) e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.02 * dt / 1000); else if (e.elite === "phase" && e.eT > 4000 && e.stunT <= 0) { e.eT = 0; e.d += S * 0.12; ring(e.x, e.y, S * 0.05, ELITES.phase.col, 350); } else if (e.elite === "heal" && e.eT > 500) { e.eT = 0; enemies.forEach((o) => { if (o !== e && !o.dead && o.hp < o.hpMax && dist(o.x, o.y, e.x, e.y) < S * 0.1) o.hp = Math.min(o.hpMax, o.hp + o.hpMax * 0.015); }); } }
          if (e.stunT > 0) { e.stunT -= dt; } else { e.d += e.def.speed * S * (1 - slowK) * (1 - slowAll) * dt / 1000; }
          if (e.def.roar) { e.roarT -= dt; if (e.roarT <= 0) { e.roarT = e.def.roar * 1000; towers.forEach((t) => { if (dist(t.x, t.y, e.x, e.y) < S * 0.28) t.stunT = 2200; }); ring(e.x, e.y, S * 0.28, "#ff3b3b", 700); shakeT = 500; A().tone(70, 0.7, { type: "sawtooth", vol: 0.14, glide: 35 }); toast("The King roars — nearby reptiles freeze!", "#ff6b6b"); } }
          const P = paths[e.path];
          if (e.d >= P.len) { let leak = e.def.leak; if (e.def.boss && meta.bossLeakHalf) leak = Math.ceil(leak / 2); lives -= leak; e.dead = true; enemies.splice(i, 1); sndLeak(); shakeT = 300; ring(P.pts[P.pts.length - 1].x, P.pts[P.pts.length - 1].y, S * 0.08, "#ff3b3b", 400); renderHud(); if (lives <= 0) { lives = 0; endRun(false); return; } continue; }
          const p = pointAt(P, Math.max(0, e.d)); e.x = p.x; e.y = p.y; e.ang = p.ang;
        }
        if (waveActive && !queue.length && !enemies.length) waveCleared();
        // towers
        towers.forEach((t) => {
          if (t.atkK > 0) t.atkK = Math.max(0, t.atkK - dt / 160); if (t.spawnT > 0) t.spawnT = Math.max(0, t.spawnT - dt / 420);
          if (t.patrol != null && paths[t.patrol]) { const P = paths[t.patrol]; t.pd += t.pdir * dt * S * 0.00013; if (t.pd >= P.len) { t.pd = P.len; t.pdir = -1; } if (t.pd <= 0) { t.pd = 0; t.pdir = 1; } const q = pointAt(P, t.pd); t.x = q.x + Math.sin(now * 0.002 + t.id) * S * 0.012; t.y = q.y + Math.cos(now * 0.0017 + t.id) * S * 0.012; }
          if (t.stunT > 0) { t.stunT -= dt; return; }
          if (TOWERS[t.type].kind === "farm") { if (t.s.trickle && waveActive) { t.farmT += dt; if (t.farmT >= 10000) { t.farmT = 0; cash += t.s.trickle; floaters.push({ x: t.x, y: t.y - S * 0.05, text: "+$" + t.s.trickle, col: "#ffd36b", t: 0, small: true }); burst(t.x, t.y, "#ffd36b", 5); } } return; }
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
          const fly = TOWERS[t.type].fly, lift = fly ? r * 1.1 + Math.sin(now * 0.004 + t.id) * r * 0.25 : 0;
          if (moving === t) g.globalAlpha = 0.45;
          g.fillStyle = fly ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.35)"; ell(g, t.x, t.y + r * 0.9, r * (fly ? 1.1 : 1.4), r * (fly ? 0.4 : 0.55)); g.fill();
          if (t.patrol != null) { g.strokeStyle = rgba(TOWERS[t.type].col, 0.25); g.lineWidth = S * 0.004; g.setLineDash([S * 0.012, S * 0.012]); g.lineDashOffset = -now * 0.02; strokePath(paths[t.patrol]); g.setLineDash([]); }
          if (TOWERS[t.type].kind === "aura" || t.s.buff) { g.strokeStyle = rgba(TOWERS[t.type].col, 0.18 + 0.06 * Math.sin(now * 0.003)); g.lineWidth = 1.5; g.setLineDash([S * 0.01, S * 0.012]); g.beginPath(); g.arc(t.x, t.y, towerRange(t), 0, TAU); g.stroke(); g.setLineDash([]); }
          g.save(); g.translate(t.x, t.y - lift); if (t.spawnT > 0) { const k = t.spawnT, bounce = 1 + Math.sin((1 - k) * Math.PI) * 0.35 + k * 0.9; g.translate(0, -k * k * S * 0.12); g.scale(bounce, bounce); g.globalAlpha = 1 - k * 0.3; } g.rotate(t.angle); drawReptile(g, t.type, r, now + t.id * 331, tier, t.atkK); g.restore();
          if (t.spawnT > 0) { g.strokeStyle = rgba(TOWERS[t.type].col, t.spawnT); g.lineWidth = S * 0.006; g.beginPath(); g.arc(t.x, t.y, r * (1.2 + (1 - t.spawnT) * 2.5), 0, TAU); g.stroke(); }
          if (t.stunT > 0) { g.fillStyle = "#ffd36b"; for (let k = 0; k < 3; k++) { const a = now * 0.006 + k * 2.1; dot(g, t.x + Math.cos(a) * r * 1.6, t.y - r * 1.6 + Math.sin(a) * r * 0.4, S * 0.005); } }
          if (t.buff) { g.fillStyle = rgba("#ffd36b", 0.9); g.font = "800 " + Math.round(S * 0.016) + "px system-ui"; g.textAlign = "center"; g.fillText("▲", t.x + r * 1.5, t.y - r * 1.3); }
          if (t.bank > 0) { g.save(); g.fillStyle = "rgba(10,8,20,0.7)"; const txt = "$" + t.bank, fs = Math.round(S * 0.017); g.font = "800 " + fs + "px system-ui"; const tw = g.measureText(txt).width; rr(g, t.x - tw / 2 - fs * 0.5, t.y - r * 2.4 - fs * 0.7, tw + fs, fs * 1.4, fs * 0.7); g.fill(); g.fillStyle = "#ffd36b"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, t.x, t.y - r * 2.4); g.restore(); }
          g.globalAlpha = 1;
        });
        if (selected) { const R = towerRange(selected); g.strokeStyle = rgba(TOWERS[selected.type].col, 0.7); g.lineWidth = 2; g.beginPath(); g.arc(selected.x, selected.y, R, 0, TAU); g.stroke(); g.fillStyle = rgba(TOWERS[selected.type].col, 0.06); g.fill(); }
        if (moving && !placing) { const T = TOWERS[moving.type]; g.save(); g.fillStyle = "rgba(10,8,20,0.75)"; rr(g, S * 0.18, S * 0.02, S * 0.64, S * 0.06, S * 0.03); g.fill(); g.strokeStyle = rgba(T.col, 0.6 + 0.3 * Math.sin(now * 0.006)); g.lineWidth = 2; g.stroke(); g.fillStyle = T.col; g.font = "800 " + Math.round(S * 0.024) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("MOVE " + T.name.toUpperCase() + "  ·  tap the new spot  ·  free", S / 2, S * 0.05); g.restore(); }
        if (moving && hover) { const t = moving, r = towerR(t), R = towerRange(t); g.save(); g.setLineDash([S * 0.01, S * 0.01]); g.strokeStyle = rgba(TOWERS[t.type].col, 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(t.x, t.y); g.lineTo(hover.x, hover.y); g.stroke(); g.setLineDash([]); g.globalAlpha = 0.85; g.strokeStyle = hoverValid ? rgba("#7fe0a0", 0.8) : rgba("#ff6b6b", 0.8); g.fillStyle = hoverValid ? rgba("#7fe0a0", 0.08) : rgba("#ff6b6b", 0.1); g.beginPath(); g.arc(hover.x, hover.y, R, 0, TAU); g.fill(); g.stroke(); g.globalAlpha = hoverValid ? 0.75 : 0.4; g.translate(hover.x, hover.y); g.rotate(-Math.PI / 2); drawReptile(g, t.type, r, now, Math.max.apply(null, t.tiers), 0); g.restore(); }
        if (placing) { const T = TOWERS[placing]; g.save(); g.fillStyle = "rgba(10,8,20,0.75)"; rr(g, S * 0.18, S * 0.02, S * 0.64, S * 0.06, S * 0.03); g.fill(); g.strokeStyle = rgba(T.col, 0.6 + 0.3 * Math.sin(now * 0.006)); g.lineWidth = 2; g.stroke(); g.fillStyle = T.col; g.font = "800 " + Math.round(S * 0.024) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("PLACE " + T.name.toUpperCase() + "  ·  $" + T.cost + "  ·  tap beside the road", S / 2, S * 0.05); g.restore(); }
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
          if (e.elite) { const E = ELITES[e.elite]; g.strokeStyle = rgba(E.col, 0.6 + 0.3 * Math.sin(now * 0.008 + e.ph)); g.lineWidth = 2; g.setLineDash([S * 0.008, S * 0.008]); g.lineDashOffset = -now * 0.02; g.beginPath(); g.arc(e.x, e.y, r * 1.9, 0, TAU); g.stroke(); g.setLineDash([]); g.fillStyle = E.col; g.font = "800 " + Math.round(S * 0.013) + "px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(E.name.toUpperCase(), e.x, e.y + r * 2.4); }
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
          else if (f.kind === "bolt") { g.strokeStyle = "#fff"; g.lineWidth = S * 0.006 * (1 - k) + 1; if (!lowFx()) { g.shadowColor = f.col; g.shadowBlur = S * 0.02; } g.beginPath(); f.pts.forEach((p, i) => { const jx = i ? (hash(i, Math.floor(f.t / 40)) - 0.5) * S * 0.02 : 0, jy = i ? (hash(Math.floor(f.t / 40), i) - 0.5) * S * 0.02 : 0; i ? g.lineTo(p.x + jx, p.y + jy) : g.moveTo(p.x, p.y); }); g.stroke(); g.strokeStyle = f.col; g.lineWidth = S * 0.012 * (1 - k); g.globalAlpha = 0.5 * (1 - k); g.stroke(); }
          else if (f.kind === "coil") { g.strokeStyle = f.col; g.lineWidth = S * 0.02 * (1 - k) + 2; g.setLineDash([S * 0.04, S * 0.02]); g.lineDashOffset = -k * S * 0.3; g.beginPath(); g.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, TAU); g.stroke(); g.setLineDash([]); }
          else if (f.kind === "meteor") { const fall = Math.min(1, k * 2.2); if (fall < 1) { g.fillStyle = "#ff8f3d"; if (!lowFx()) { g.shadowColor = "#ff8f3d"; g.shadowBlur = S * 0.03; } dot(g, f.x + (1 - fall) * S * 0.25, f.y - (1 - fall) * S * 0.6, S * 0.02); g.strokeStyle = rgba("#ffd36b", 0.5); g.lineWidth = S * 0.01; g.beginPath(); g.moveTo(f.x + (1 - fall) * S * 0.25, f.y - (1 - fall) * S * 0.6); g.lineTo(f.x + (1 - fall) * S * 0.25 + S * 0.08, f.y - (1 - fall) * S * 0.6 - S * 0.2); g.stroke(); } else { const kk = (k - 0.45) / 0.55; g.fillStyle = rgba("#ff8f3d", 0.5 * (1 - kk)); dot(g, f.x, f.y, f.r * (0.6 + kk * 0.6)); g.strokeStyle = rgba("#ffd36b", 1 - kk); g.lineWidth = S * 0.008; g.beginPath(); g.arc(f.x, f.y, f.r * (0.5 + kk), 0, TAU); g.stroke(); } }
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
        types.forEach((tp, i) => { const x = S * 0.06 + i * (S * 0.88 / (types.length - 1)), y = S * 0.82 + Math.sin(now * 0.002 + i) * S * 0.01; g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.globalAlpha = unlocked(tp) ? 1 : 0.25; drawReptile(g, tp, S * 0.028, now + i * 400, unlocked(tp) ? 1 : 0, 0); g.restore(); });
        g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#7fe0a0"; if (!lowFx()) { g.shadowColor = "#7fe0a0"; g.shadowBlur = S * 0.03; } g.font = "900 " + Math.round(S * 0.11) + "px system-ui, sans-serif"; g.fillText("COLD BLOOD", S / 2, S * 0.14); g.shadowBlur = 0; g.fillStyle = "rgba(230,236,245,0.7)"; g.font = "600 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.fillText("reptile tower defense", S / 2, S * 0.215); g.restore();
      }

      // ================= DOM UI =================
      function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
      function iconCanvas(type, size) { const c = document.createElement("canvas"); const d = window.devicePixelRatio || 1; c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + "px"; const gg = c.getContext("2d"); gg.setTransform(d, 0, 0, d, 0, 0); gg.translate(size / 2, size / 2); gg.rotate(-Math.PI / 2); drawReptile(gg, type, size * 0.2, 0, 0, 0); return c; }
      function bugCanvas(type, size) { const c = document.createElement("canvas"); const d = window.devicePixelRatio || 1; c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + "px"; const gg = c.getContext("2d"); gg.setTransform(d, 0, 0, d, 0, 0); gg.translate(size / 2, size / 2); drawBug(gg, type, size * (ENEMIES[type].boss ? 0.12 : 0.22), 0, 0, false); return c; }
      function renderUI() { renderHud(); renderPanel(); }
      // The top bar is built ONCE and then patched in place. (It used to be wiped + rebuilt every 400 ms and on every
      // kill, which destroyed the button between your press and the click — that's why Pause/auto/speed felt laggy.)
      function renderHud() {
        if (!topbar) return;
        if (screen !== "game") { topbar.style.display = "none"; return; } topbar.style.display = "";
        if (!hud || hud.topbar !== topbar) {
          topbar.innerHTML = "";
          const L = el("div", "cb-stat"), C = el("div", "cb-stat"), Wv = el("div", "cb-stat"); topbar.appendChild(L); topbar.appendChild(C); topbar.appendChild(Wv);
          const ctr = el("div", "cb-ctr");
          const start = el("button", "btn cb-start"); start.onclick = () => { if (waveActive) { if (diff.id === "hard" && !paused) { toast("Hard mode: no pausing while bugs are on the road", "#ff8fa3"); sndNo(); return; } paused = !paused; sndClick(); } else { paused = false; startWave(); } renderHud(); }; ctr.appendChild(start);
          const spd = el("div", "cb-speed"); const sps = [1, 2, 3].map((v) => { const b = el("button", "cb-sp", v + "×"); b.onclick = () => { if (b.disabled) { toast("Unlock 3× in the skill tree", "#c98cff"); return; } speed = v; sndClick(); renderHud(); }; spd.appendChild(b); return b; }); ctr.appendChild(spd);
          const auto = el("button", "cb-auto", "auto"); auto.title = "Start the next wave automatically"; auto.onclick = () => { autoNext = !autoNext; sndClick(); toast(autoNext ? "Auto-start ON — next wave begins by itself" : "Auto-start off", autoNext ? "#7fe0a0" : "#e6ecf5"); renderHud(); }; ctr.appendChild(auto);
          const menu = el("button", "cb-menu", "☰"); menu.title = "Maps / skill tree (run is saved between waves)"; menu.onclick = () => { if (diff.id === "hard" && waveActive) { toast("Hard mode: finish the wave first", "#ff8fa3"); sndNo(); return; } paused = true; saveRun(); showMenu(); }; ctr.appendChild(menu);
          topbar.appendChild(ctr);
          hud = { topbar, L, C, Wv, start, sps, auto, menu, cache: {} };
        }
        const H = hud, set = (node, key, html) => { if (H.cache[key] !== html) { H.cache[key] = html; node.innerHTML = html; } }, cls = (node, key, c) => { if (H.cache[key] !== c) { H.cache[key] = c; node.className = c; } };
        set(H.L, "L", "<b>♥ " + lives + "</b><small>lives</small>"); set(H.C, "C", "<b>$" + Math.floor(cash) + "</b><small>cash</small>"); set(H.Wv, "W", "<b>" + Math.min(wave, 999) + (freeplay || wave > 40 ? "" : " / 40") + "</b><small>wave</small>");
        const hardLock = diff.id === "hard" && waveActive && !paused;
        cls(H.start, "sc", "btn cb-start" + (waveActive ? " on" : "") + (hardLock ? " nolock" : "")); set(H.start, "st", waveActive ? (paused ? "▶ Resume" : hardLock ? "🔥 No pause (Hard)" : "⏸ Pause") : "▶ Start wave " + wave);
        H.sps.forEach((b, i) => { const v = i + 1, dis = v === 3 && !meta.speed3; cls(b, "sp" + v, "cb-sp" + (speed === v ? " on" : "") + (dis ? " dis" : "")); if (b.disabled !== dis) { b.disabled = dis; b.title = dis ? "Unlock 3× in the skill tree" : ""; } });
        cls(H.auto, "au", "cb-auto" + (autoNext ? " on" : ""));
      }
      function renderPanel() {
        if (!panel) return;
        if (screen !== "game") { panel.style.display = "none"; return; } panel.style.display = "";
        panel.innerHTML = "";
        if (selected) {
          const t = selected, T = TOWERS[t.type], s = t.s || baseStats(t.type);
          const head = el("div", "cb-sel-head"); head.appendChild(iconCanvas(t.type, 48)); const hb = el("div"); hb.appendChild(el("b", null, T.name)); hb.appendChild(el("small", null, T.desc)); head.appendChild(hb); const x = el("button", "cb-x", "✕"); x.onclick = () => { selected = null; renderPanel(); }; head.appendChild(x); panel.appendChild(head);
          const st = el("div", "cb-stats"); const kind = T.kind; st.innerHTML = (kind === "farm" ? "<span>income <b>$" + s.income + "/wave</b></span>" + (s.trickle ? "<span>mid-wave <b>$" + s.trickle + "/10s</b></span>" : "") + (s.bank ? "<span>interest <b>" + Math.round(s.bank * 100) + "%</b></span><span>stored <b>$" + (t.bank || 0) + "</b></span>" : "") + (s.cashBonus ? "<span>kills nearby <b>+" + Math.round(s.cashBonus * 100) + "%</b></span><span>range <b>" + Math.round(s.range * 100) + "</b></span>" : "") : kind === "aura" ? "<span>slow <b>" + Math.round(s.slow * 100) + "%</b></span><span>range <b>" + Math.round(s.range * 100) + "</b></span>" : "<span>dmg <b>" + Math.round(s.dmg * meta.dmgMul * (1 + t.buff)) + "</b></span><span>rate <b>" + (s.rate * (1 + t.buffRate)).toFixed(1) + "/s</b></span><span>range <b>" + Math.round(s.range * 100 * (1 + t.buffRange)) + "</b></span>") + (s.pierce > 1 ? "<span>pierce <b>" + Math.min(99, s.pierce) + "</b></span>" : "") + (s.crit ? "<span>crit <b>" + Math.round(s.crit * 100) + "%</b></span>" : "") + (s.poison ? "<span>poison <b>" + Math.round(s.poison) + "/s</b></span>" : "") + (s.bleed ? "<span>bleed <b>" + Math.round(s.bleed) + "/s</b></span>" : "") + "<span>kills <b>" + t.kills + "</b></span>" + (T.air ? "" : "<span class='cb-warn'>can't hit flyers</span>"); panel.appendChild(st);
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
          if (kind === "farm" && t.bank > 0) { const col = el("button", "cb-collect", "🥚 collect $" + t.bank); col.onclick = () => collectBank(t); panel.appendChild(col); }
          if (T.fly) { const pb = el("button", "cb-target cb-patrol" + (t.patrol != null ? " on" : ""), t.patrol == null ? "✈ patrol a lane" : "✈ patrolling lane " + (t.patrol + 1) + (t.patrol + 1 < paths.length ? " · next lane" : " · stop")); pb.title = "Fly back and forth above a road, attacking everything on it"; pb.onclick = () => { if (t.patrol == null) { t.hx = t.x; t.hy = t.y; t.patrol = 0; t.pd = 0; t.pdir = 1; toast(T.name + " is patrolling lane 1", T.col); } else if (t.patrol + 1 < paths.length) { t.patrol++; t.pd = 0; toast(T.name + " switched to lane " + (t.patrol + 1), T.col); } else { t.patrol = null; t.x = t.hx; t.y = t.hy; t.spawnT = 0.6; } sndClick(); renderPanel(); }; panel.appendChild(pb); }
          const mv = el("button", "cb-target cb-move" + (moving === t ? " on" : ""), moving === t ? "✕ cancel move" : "⇄ move"); mv.title = "Pick this reptile up and put it somewhere else — free"; mv.onclick = () => { if (moving === t) { moving = null; renderPanel(); return; } if (waveActive && !paused) { toast(diff.id === "hard" ? "Hard mode: move reptiles between waves" : "Pause first, then move", "#ff8fa3"); sndNo(); return; } if (t.patrol != null) { toast("Stop the patrol first", "#ff8fa3"); sndNo(); return; } moving = t; placing = null; sndPick(); toast("Tap where " + T.name + " should go · right-click cancels", T.col); renderPanel(); };
          if (kind !== "aura" && kind !== "farm") { const tg = el("button", "cb-target", "target: " + t.mode); tg.onclick = () => { const modes = ["first", "last", "strong", "close"]; t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length]; renderPanel(); }; foot.appendChild(tg); }
          foot.appendChild(mv); const sell = el("button", "cb-sell", "sell $" + Math.round(t.spent * meta.sell)); sell.onclick = () => sellTower(t); foot.appendChild(sell); panel.appendChild(foot);
          return;
        }
        const ttl = el("div", "cb-shop-title" + (placing ? " placing" : "")); ttl.innerHTML = placing ? "<b>" + TOWERS[placing].name.toUpperCase() + " READY</b> — tap the ground beside the road · <u>cancel</u>" : "Reptiles — pick one, then tap the map"; if (placing) ttl.querySelector("u").onclick = () => { placing = null; renderPanel(); }; panel.appendChild(ttl);
        const grid = el("div", "cb-shop");
        Object.keys(TOWERS).forEach((type, i) => {
          const T = TOWERS[type], ok = unlocked(type), card = el("button", "cb-card" + (placing === type ? " on" : "") + (!ok ? " lock" : cash < T.cost ? " poor" : " can")); card.style.setProperty("--tc", T.col);
          card.appendChild(iconCanvas(type, 56)); const nm = el("div", "cb-card-name"); const pip = (v, max) => { let o = ""; for (let k = 0; k < 4; k++) o += "<i class='" + (v / max > k / 4 ? "on" : "") + "'></i>"; return o; }; const bs = baseStats(type); const dps = bs.rate ? bs.dmg * bs.rate * (bs.pierce > 1 ? 1.5 : 1) + (bs.poison || 0) : 0;
          nm.innerHTML = "<b>" + T.name + "</b><em>" + (ok ? "$" + T.cost : T.rebirth ? "✦ rebirth " + T.rebirth : "🥚 skill tree") + "</em><span class='cb-pips'><label>" + (T.kind === "farm" ? "$/wave" : "dmg") + "</label>" + pip(T.kind === "aura" ? 0 : T.kind === "farm" ? bs.income : dps, T.kind === "farm" ? 400 : 60) + "<label>rng</label>" + pip(bs.range, 0.34) + "<label>" + (T.kind === "aura" ? "slow" : "spd") + "</label>" + pip(T.kind === "aura" ? bs.slow : bs.rate, T.kind === "aura" ? 0.7 : 2.4) + "</span>"; card.appendChild(nm); card.title = T.desc + (T.air ? "" : " · cannot hit flyers"); card.appendChild(el("kbd", null, String(i + 1)));
          const tag = T.waterOnly ? "water only" : T.fly ? "flies anywhere" : T.kind === "farm" ? "money maker" : T.water ? "land + water" : !T.air ? "ground only" : null; if (tag) { const tg = el("div", "cb-noair" + (T.waterOnly || T.water ? " wat" : T.fly ? " fly" : T.kind === "farm" ? " gold" : ""), tag); card.appendChild(tg); }
          if (T.rebirth) card.classList.add("rb");
          card.onclick = () => { if (!ok) { toast(T.rebirth ? T.name + " needs rebirth " + T.rebirth + " (skill tree)" : "Unlock " + T.name + " in the skill tree", "#c98cff"); sndNo(); return; } if (cash < T.cost && placing !== type) { toast("Need $" + (T.cost - Math.floor(cash)) + " more for " + T.name, "#ff8fa3"); sndNo(); card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); return; } placing = placing === type ? null : type; selected = null; if (placing) sndPick(); renderPanel(); };
          grid.appendChild(card);
        });
        panel.appendChild(grid);
        const tip = el("div", "cb-tip"); const nextBoss = [10, 20, 30, 35, 40].find((w) => w >= wave); tip.textContent = nextBoss ? "Next boss: wave " + nextBoss + " (" + ENEMIES[{ 10: "bigbeetle", 20: "centipede", 30: "raptor", 35: "ankylo", 40: "trex" }[nextBoss]].name + ")" : "Freeplay — bosses every 5 waves, bugs keep scaling."; panel.appendChild(tip);
      }
      function showMenu() {
        screen = "menu"; renderUI(); overlay.innerHTML = ""; overlay.style.display = ""; overlay.classList.add("menu"); overlay.classList.remove("tree");
        const card = el("div", "cb-card-big");
        const top = el("div", "cb-menu-top"); top.appendChild(el("h2", null, "Choose your ground")); const eggs = el("div", "cb-eggs", "🥚 " + save.eggs); eggs.title = "Eggs — spend them in the skill tree"; top.appendChild(eggs); const treeBtn = el("button", "btn cb-treebtn", "Skill tree"); treeBtn.onclick = showTree; top.appendChild(treeBtn); card.appendChild(top);
        if (save.run) { const r = save.run; const cont = el("button", "btn cb-continue", "▶ Continue run — " + MAPS[r.mapIdx].name + " · wave " + r.wave + " · " + DIFFS[r.diffIdx].name); cont.onclick = () => { overlay.style.display = "none"; newRun(r.mapIdx, r.diffIdx, r); }; card.appendChild(cont); }
        const maps = el("div", "cb-maps");
        MAPS.forEach((m, i) => { const b = el("button", "cb-map" + (pickMap === i ? " on" : "")); b.style.setProperty("--mc", m.accent); const pv = document.createElement("canvas"); pv.width = 180; pv.height = 120; drawMapPreview(pv, m); b.appendChild(pv); const nm = el("div", "cb-map-name"); const best = ["easy", "normal", "hard"].map((d) => save.best[m.id + ":" + d] || 0); nm.innerHTML = "<b>" + m.name + "</b><small>" + m.sub + "</small><i>best: " + (Math.max.apply(null, best) ? best.map((v, k) => DIFFS[k].name[0] + v).join(" · ") : "—") + "</i>"; b.appendChild(nm); b.onclick = () => { pickMap = i; showMenu(); }; maps.appendChild(b); });
        card.appendChild(maps);
        if (pickDiff === 3 && !meta.apocalypse) pickDiff = 1;
        const dif = el("div", "cb-diffs"); DIFFS.forEach((d, i) => { const locked = d.needRebirth && (save.rebirth || 0) < d.needRebirth; const b = el("button", "cb-diff" + (pickDiff === i ? " on" : "") + (d.id === "apoc" ? " apoc" : "") + (locked ? " locked" : "")); b.innerHTML = "<b>" + (d.id === "apoc" ? "☠ " : "") + d.name + "</b><small>" + (locked ? "rebirth " + d.needRebirth + " to unlock" : d.lives + " lives · $" + d.start + " · eggs ×" + d.eggs + (d.elite ? " · elite bugs" : "")) + "</small>"; b.onclick = () => { if (locked) { toast("Reach rebirth " + d.needRebirth + " for Apocalypse", "#ff8fa3"); sndNo(); return; } pickDiff = i; showMenu(); }; dif.appendChild(b); }); card.appendChild(dif);
        if (save.rebirth) { const rb = el("div", "cb-rbline"); rb.innerHTML = "✦ Rebirth <b>" + save.rebirth + "</b> · " + REBIRTH_PERKS.filter((r) => r.n <= save.rebirth).map((r) => TOWERS[r.reptile].name).join(", ") + " unlocked"; card.appendChild(rb); }
        tree = null;
        const go = el("button", "btn cb-go", "Defend " + MAPS[pickMap].name); go.onclick = () => { overlay.style.display = "none"; newRun(pickMap, pickDiff, null); }; card.appendChild(go);
        if (!save.seen) { card.appendChild(el("p", "cb-help", "Bugs march down the road toward your nest. Pick a reptile below the map, tap the ground beside the road to place it, then Start wave. Click a reptile to upgrade it down two of its three paths. Dinosaurs show up at waves 10, 20, 30, 35 and 40. Every run earns eggs for the skill tree.")); }
        overlay.appendChild(card);
      }
      function drawMapPreview(cv, m) { const gg = cv.getContext("2d"), W = cv.width, H = cv.height; const grd = gg.createLinearGradient(0, 0, W, H); grd.addColorStop(0, m.ground[0]); grd.addColorStop(1, m.ground[1]); gg.fillStyle = grd; gg.fillRect(0, 0, W, H); (m.water || []).forEach((w) => { gg.fillStyle = "#17405a"; gg.beginPath(); gg.ellipse(w[0] * W, w[1] * H, w[2] * W, w[3] * H, 0, 0, TAU); gg.fill(); }); (m.lava || []).forEach((w) => { gg.fillStyle = "#ff6b2a"; gg.beginPath(); gg.ellipse(w[0] * W, w[1] * H, w[2] * W, w[3] * H, 0, 0, TAU); gg.fill(); }); [m.path].concat(m.path2 ? [m.path2] : []).forEach((P) => { gg.strokeStyle = m.glow; gg.lineWidth = 9; gg.lineCap = "round"; gg.lineJoin = "round"; gg.globalAlpha = 0.35; gg.beginPath(); P.forEach((p, i) => (i ? gg.lineTo(p[0] * W, p[1] * H) : gg.moveTo(p[0] * W, p[1] * H))); gg.stroke(); gg.globalAlpha = 1; gg.strokeStyle = m.road; gg.lineWidth = 6; gg.stroke(); }); }
      // ================= SKILL TREE — constellation (drag to pan, wheel/pinch to zoom, tap a node) =================
      let tree = null;   // { cv, gg, W, H, cam:{x,y,z}, nodes:{id:{x,y,...}}, sel, fx:[], drag, pinch, target, detail, eggsEl }
      const BRANCH = { Economy: { ang: -2.35, col: "#ffd36b", icon: "coin" }, Offense: { ang: -0.8, col: "#ff6b6b", icon: "fang" }, Defense: { ang: 0.8, col: "#74b9ff", icon: "shield" }, Unlocks: { ang: 2.35, col: "#7fe0a0", icon: "egg" } };
      function layoutTree() {
        const pos = {}; const byBranch = {};
        TREE.forEach((nd) => { (byBranch[nd.branch] = byBranch[nd.branch] || []).push(nd); });
        Object.keys(byBranch).forEach((br) => {
          const list = byBranch[br], base = BRANCH[br].ang;
          const roots = list.filter((nd) => !nd.req || !list.some((o) => o.id === nd.req));
          const depth = {}; const walk = (id, d) => { depth[id] = d; list.filter((o) => o.req === id).forEach((o) => walk(o.id, d + 1)); };
          roots.forEach((r) => walk(r.id, 1));
          // siblings fan out; the main chain follows the branch angle with a gentle curve
          const kidsOf = (id) => list.filter((o) => o.req === id);
          const place = (nd, ang, d) => { const R = 150 + (d - 1) * 118; pos[nd.id] = { x: Math.cos(ang) * R, y: Math.sin(ang) * R * 0.78, ang, d }; const kids = kidsOf(nd.id); kids.forEach((k, ki) => { const off = kids.length > 1 ? (ki - (kids.length - 1) / 2) * 0.55 : Math.sin(d * 1.7) * 0.12; place(k, ang + off, d + 1); }); };
          roots.forEach((r, ri) => place(r, base + (roots.length > 1 ? (ri - (roots.length - 1) / 2) * 0.9 : 0), roots.length > 1 && ri > 0 ? 1 : 1));
        });
        return pos;
      }
      function showTree() {
        screen = "tree"; renderUI(); overlay.innerHTML = ""; overlay.style.display = ""; overlay.classList.add("menu"); overlay.classList.add("tree"); overlay.scrollTop = 0;
        const card = el("div", "cb-card-big cb-treecard");
        const top = el("div", "cb-menu-top"); top.appendChild(el("h2", null, "Skill tree")); const eggsEl = el("div", "cb-eggs", "🥚 " + save.eggs); top.appendChild(eggsEl); const back = el("button", "btn ghost", "← Maps"); back.onclick = () => { tree = null; showMenu(); }; top.appendChild(back); card.appendChild(top);
        const owned = Object.keys(save.nodes).filter((k) => save.nodes[k]).length, nextR = REBIRTH_PERKS[Math.min(save.rebirth || 0, REBIRTH_PERKS.length - 1)], canR = owned >= REBIRTH_NEED && (save.rebirth || 0) < REBIRTH_PERKS.length;
        const rbBtn = el("button", "btn cb-rbbtn" + (canR ? " ready" : "")); rbBtn.innerHTML = (save.rebirth >= REBIRTH_PERKS.length ? "✦ Max rebirth" : "✦ Rebirth " + ((save.rebirth || 0) + 1)) + "<small>" + (save.rebirth >= REBIRTH_PERKS.length ? "every legend unlocked" : canR ? "ready — unlock " + TOWERS[nextR.reptile].name : owned + " / " + REBIRTH_NEED + " nodes") + "</small>"; rbBtn.onclick = () => showRebirth(); top.appendChild(rbBtn);
        const nav = el("div", "cb-treenav"); Object.keys(BRANCH).forEach((br) => { const b = el("button", "cb-branchbtn", br); b.style.setProperty("--bc", BRANCH[br].col); const owned = TREE.filter((nd) => nd.branch === br && save.nodes[nd.id]).length, total = TREE.filter((nd) => nd.branch === br).length; b.innerHTML = br + "<small>" + owned + " / " + total + "</small>"; b.onclick = () => flyTo(br); nav.appendChild(b); }); const hint = el("div", "cb-treehint", "drag to look around · wheel / pinch to zoom · tap a node"); nav.appendChild(hint); card.appendChild(nav);
        const holder = el("div", "cb-treeholder"); const cv = document.createElement("canvas"); cv.className = "cb-treecv"; holder.appendChild(cv); const detail = el("div", "cb-treedetail"); holder.appendChild(detail); card.appendChild(holder);
        overlay.appendChild(card);
        const W = Math.min(card.clientWidth - 40, 880), H = Math.max(320, Math.min(560, overlay.clientHeight - (holder.getBoundingClientRect().top - overlay.getBoundingClientRect().top) - 30));
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px";
        const pos = layoutTree();
        tree = { cv, gg: cv.getContext("2d"), W, H, cam: { x: 0, y: 0, z: 1 }, nodes: pos, sel: null, fx: [], drag: null, pinch: null, target: null, detail, eggsEl, t0: performance.now(), stars: [] };
        for (let k = 0; k < 90; k++) tree.stars.push({ x: (hash(k, 41) - 0.5) * 1800, y: (hash(k, 42) - 0.5) * 1400, r: 0.6 + hash(k, 43) * 1.6, ph: hash(k, 44) * TAU });
        // fit everything at start
        let minX = 0, maxX = 0, minY = 0, maxY = 0; Object.values(pos).forEach((q) => { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); });
        tree.cam.z = Math.min(1.1, Math.min(W / (maxX - minX + 260), H / (maxY - minY + 220))); tree.cam.x = (minX + maxX) / 2; tree.cam.y = (minY + maxY) / 2; tree.fitZ = tree.cam.z;
        // input
        const toWorld = (cx, cy) => ({ x: (cx - W / 2) / tree.cam.z + tree.cam.x, y: (cy - H / 2) / tree.cam.z + tree.cam.y });
        const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        const pointers = new Map();
        cv.addEventListener("pointerdown", (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); const p = local(e); pointers.set(e.pointerId, p); if (pointers.size === 1) tree.drag = { x: p.x, y: p.y, cx: tree.cam.x, cy: tree.cam.y, moved: 0, t: performance.now() }; else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; tree.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: tree.cam.z }; tree.drag = null; } });
        cv.addEventListener("pointermove", (e) => { if (!pointers.has(e.pointerId)) { const p = local(e); tree.hover = hitNode(toWorld(p.x, p.y)); cv.style.cursor = tree.hover ? "pointer" : "grab"; return; } const p = local(e); pointers.set(e.pointerId, p); if (tree.pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); tree.cam.z = clamp(tree.pinch.z * d / tree.pinch.d, 0.45, 2.2); tree.target = null; return; } if (tree.drag) { tree.drag.moved += Math.hypot(p.x - tree.drag.x, p.y - tree.drag.y); tree.cam.x = tree.drag.cx - (p.x - tree.drag.x) / tree.cam.z; tree.cam.y = tree.drag.cy - (p.y - tree.drag.y) / tree.cam.z; tree.drag.x = p.x; tree.drag.y = p.y; tree.drag.cx = tree.cam.x; tree.drag.cy = tree.cam.y; tree.target = null; cv.style.cursor = "grabbing"; } });
        const up = (e) => { const p = local(e); pointers.delete(e.pointerId); if (tree.pinch && pointers.size < 2) tree.pinch = null; if (tree.drag) { const tap = tree.drag.moved < 8; tree.drag = null; cv.style.cursor = "grab"; if (tap) { const hitId = hitNode(toWorld(p.x, p.y)); if (hitId) selectNode(hitId); else { tree.sel = null; renderDetail(); } } } };
        cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
        cv.addEventListener("wheel", (e) => { e.preventDefault(); const p = local(e), before = toWorld(p.x, p.y); tree.cam.z = clamp(tree.cam.z * (e.deltaY < 0 ? 1.12 : 0.89), 0.45, 2.2); const after = toWorld(p.x, p.y); tree.cam.x += before.x - after.x; tree.cam.y += before.y - after.y; tree.target = null; }, { passive: false });
        cv.style.cursor = "grab";
        renderDetail();
        // first-visit: select the cheapest affordable node so the detail card isn't empty
        const first = TREE.filter((nd) => !save.nodes[nd.id] && (!nd.req || save.nodes[nd.req])).sort((a, b) => a.cost - b.cost)[0]; if (first) { tree.sel = first.id; renderDetail(); }
      }
      function showRebirth() {
        const owned = Object.keys(save.nodes).filter((k) => save.nodes[k]).length, r = save.rebirth || 0;
        if (r >= REBIRTH_PERKS.length) { toast("You've reached the final rebirth. Apocalypse awaits.", "#ffd36b"); return; }
        const perk = REBIRTH_PERKS[r], T = TOWERS[perk.reptile];
        const m = el("div", "cb-rbmodal"); const c = el("div", "cb-rbcard");
        c.appendChild(el("h2", null, "✦ Rebirth " + (r + 1)));
        c.appendChild(el("p", "cb-help", owned >= REBIRTH_NEED ? "Your reptiles have learned everything this tree can teach. Rebirth resets the tree and your eggs — and awakens a legend." : "Own " + REBIRTH_NEED + " of the " + TREE.length
+ " nodes to rebirth (" + owned + " so far)."));
        const gain = el("div", "cb-rbgain"); const ic = document.createElement("canvas"); ic.width = ic.height = Math.round(120 * dpr); ic.style.width = ic.style.height = "120px"; const g2 = ic.getContext("2d"); g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.translate(60, 60); g2.rotate(-Math.PI / 2); drawReptile(g2, perk.reptile, 22, now, 3, 0); gain.appendChild(ic);
        const gt = el("div"); gt.innerHTML = "<b>" + T.name + "</b><small>" + T.desc + "</small><i>+ " + perk.perk + "</i>"; gain.appendChild(gt); c.appendChild(gain);
        const lose = el("div", "cb-rblose"); lose.innerHTML = "<span>You lose</span> all " + owned + " skill nodes · your eggs (" + save.eggs + " → " + Math.floor(save.eggs * 0.25) + ", you keep a quarter)<br><span>You keep</span> every legend, your bests, and all rebirth perks" + (r + 1 === REBIRTH_PERKS.length ? "<br><span class='apoc'>Rebirth 5 unlocks ☠ APOCALYPSE</span>" : ""); c.appendChild(lose);
        const row = el("div", "btn-row"); if (owned >= REBIRTH_NEED) { const go = el("button", "btn cb-rbgo", "✦ REBIRTH"); go.onclick = () => { m.remove(); doRebirth(); }; row.appendChild(go); } const no = el("button", "btn ghost", "Not yet"); no.onclick = () => m.remove(); row.appendChild(no); c.appendChild(row);
        m.appendChild(c); overlay.appendChild(m);
      }
      function doRebirth() {
        const r = (save.rebirth || 0) + 1, perk = REBIRTH_PERKS[r - 1];
        // implode: every node flies into the hub, white flash, then the reset tree
        if (tree) { Object.keys(tree.nodes).forEach((id) => { const q = tree.nodes[id]; tree.fx.push({ kind: "pulse", x0: q.x, y0: q.y, x1: 0, y1: 0, t: 0, dur: 700, col: BRANCH[TREE.find((z) => z.id === id).branch].col }); }); tree.fx.push({ kind: "flash", t: 0, dur: 1200 }); }
        A().arp([196, 262, 330, 392, 523, 659, 784, 1046], { dur: 0.3, step: 0.09, vol: 0.14, type: "triangle" });
        setTimeout(() => { save.rebirth = r; save.nodes = {}; save.eggs = Math.floor(save.eggs * 0.25); meta = metaFromNodes(save.nodes, save.rebirth); persist(); if (screen === "tree") showTree(); toast("✦ REBIRTH " + r + " — " + TOWERS[perk.reptile].name + " awakens!", TOWERS[perk.reptile].col); }, 900);
      }
      function hitNode(w) { let best = null, bd = 1e9; Object.keys(tree.nodes).forEach((id) => { const q = tree.nodes[id]; const d = Math.hypot(w.x - q.x, w.y - q.y); if (d < 34 && d < bd) { bd = d; best = id; } }); return best; }
      function selectNode(id) { tree.sel = id; sndClick(); const q = tree.nodes[id]; tree.target = { x: q.x, y: q.y, z: Math.max(tree.cam.z, 1.0) }; renderDetail(); }
      function flyTo(br) { const ids = TREE.filter((nd) => nd.branch === br).map((nd) => nd.id); let cx = 0, cy = 0; ids.forEach((id) => { cx += tree.nodes[id].x; cy += tree.nodes[id].y; }); cx /= ids.length; cy /= ids.length; tree.target = { x: cx, y: cy, z: 1.05 }; sndClick(); }
      function renderDetail() {
        const d = tree.detail; d.innerHTML = "";
        if (!tree.sel) { d.appendChild(el("div", "cb-td-empty", "Tap a node to see what it does. Glowing nodes are ready to unlock.")); return; }
        const nd = TREE.find((q) => q.id === tree.sel), owned = !!save.nodes[nd.id], reqOk = !nd.req || save.nodes[nd.req], can = !owned && reqOk && save.eggs >= nd.cost, B = BRANCH[nd.branch];
        const head = el("div", "cb-td-head"); const ic = document.createElement("canvas"); ic.width = ic.height = Math.round(56 * dpr); ic.style.width = ic.style.height = "56px"; const g2 = ic.getContext("2d"); g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.translate(28, 28); drawNodeIcon(g2, nd, 22, B.col, true); head.appendChild(ic);
        const hb = el("div"); hb.appendChild(el("b", null, nd.name)); const sub = el("small", null, nd.branch + (nd.req ? " · after " + TREE.find((q) => q.id === nd.req).name : " · root")); sub.style.color = B.col; hb.appendChild(sub); head.appendChild(hb); d.appendChild(head);
        d.appendChild(el("p", "cb-td-desc", nd.d));
        const row = el("div", "cb-td-row");
        if (owned) row.appendChild(el("div", "cb-td-owned", "✓ Unlocked"));
        else { const b = el("button", "btn cb-td-buy" + (can ? "" : " off"), can ? "Unlock · 🥚 " + nd.cost : !reqOk ? "Locked · needs " + TREE.find((q) => q.id === nd.req).name : "Need 🥚 " + nd.cost + " (you have " + save.eggs + ")"); b.disabled = !can; b.onclick = () => buyNode(nd); row.appendChild(b); }
        d.appendChild(row);
      }
      function buyNode(nd) {
        if (save.nodes[nd.id] || save.eggs < nd.cost || (nd.req && !save.nodes[nd.req])) { sndNo(); return; }
        save.eggs -= nd.cost; save.nodes[nd.id] = true; meta = metaFromNodes(save.nodes); persist();
        const q = tree.nodes[nd.id], from = nd.req ? tree.nodes[nd.req] : { x: 0, y: 0 };
        tree.fx.push({ kind: "pulse", x0: from.x, y0: from.y, x1: q.x, y1: q.y, t: 0, dur: 520, col: BRANCH[nd.branch].col, id: nd.id });
        A().arp([392, 523, 659, 784], { dur: 0.14, step: 0.07, vol: 0.1, type: "triangle" });
        tree.eggsEl.textContent = "🥚 " + save.eggs; tree.eggsEl.classList.remove("pop"); void tree.eggsEl.offsetWidth; tree.eggsEl.classList.add("pop");
        const nb = tree.detail.parentNode.parentNode.querySelectorAll(".cb-branchbtn"); nb.forEach((b) => { const br = b.textContent.replace(/\d+ \/ \d+$/, "").trim(); const owned = TREE.filter((x) => x.branch === br && save.nodes[x.id]).length, total = TREE.filter((x) => x.branch === br).length; b.innerHTML = br + "<small>" + owned + " / " + total + "</small>"; });
        setTimeout(() => { if (tree) { for (let k = 0; k < 26; k++) { const a = Math.random() * TAU, sp = 0.08 + Math.random() * 0.2; tree.fx.push({ kind: "p", x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, dur: 500 + Math.random() * 400, col: k % 3 ? BRANCH[nd.branch].col : "#fff" }); } tree.fx.push({ kind: "ring", x: q.x, y: q.y, t: 0, dur: 600, col: BRANCH[nd.branch].col }); A().tone(880, 0.12, { type: "sine", vol: 0.08, glide: 1320 }); renderDetail(); } }, 500);
        renderDetail();
      }
      function drawNodeIcon(g2, nd, r, col, big) {
        if (nd.branch === "Unlocks" && TOWERS[nd.id]) { g2.save(); g2.rotate(-Math.PI / 2); drawReptile(g2, nd.id, r * 0.42, now, 0, 0); g2.restore(); return; }
        g2.fillStyle = col; g2.strokeStyle = col; g2.lineWidth = r * 0.16; g2.lineCap = "round";
        if (nd.branch === "Economy") { g2.beginPath(); g2.arc(0, 0, r * 0.55, 0, TAU); g2.stroke(); g2.font = "800 " + Math.round(r * 0.8) + "px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.fillText("$", 0, r * 0.05); }
        else if (nd.branch === "Offense") { g2.beginPath(); g2.moveTo(-r * 0.5, -r * 0.45); g2.lineTo(-r * 0.15, r * 0.55); g2.lineTo(0, -r * 0.1); g2.lineTo(r * 0.15, r * 0.55); g2.lineTo(r * 0.5, -r * 0.45); g2.lineTo(0, -r * 0.2); g2.closePath(); g2.fill(); }
        else if (nd.branch === "Defense") { g2.beginPath(); g2.moveTo(0, -r * 0.6); g2.lineTo(r * 0.55, -r * 0.35); g2.lineTo(r * 0.45, r * 0.2); g2.lineTo(0, r * 0.6); g2.lineTo(-r * 0.45, r * 0.2); g2.lineTo(-r * 0.55, -r * 0.35); g2.closePath(); g2.fill(); }
        else { g2.beginPath(); g2.ellipse(0, 0, r * 0.4, r * 0.55, 0, 0, TAU); g2.fill(); if (nd.id === "ff") { g2.fillStyle = "#0e0c1e"; g2.font = "800 " + Math.round(r * 0.6) + "px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.fillText("3×", 0, 0); } }
      }
      function drawTree() {
        if (!tree) return; const T = tree, g2 = T.gg, W = T.W, H = T.H, tnow = performance.now() - T.t0; const dtf = T.lastT ? Math.min(50, performance.now() - T.lastT) : 16; T.lastT = performance.now();
        // camera glide
        if (T.target) { const k = 0.12; T.cam.x += (T.target.x - T.cam.x) * k; T.cam.y += (T.target.y - T.cam.y) * k; T.cam.z += (T.target.z - T.cam.z) * k; if (Math.abs(T.target.x - T.cam.x) < 0.5 && Math.abs(T.target.z - T.cam.z) < 0.005) T.target = null; }
        g2.setTransform(dpr, 0, 0, dpr, 0, 0); g2.clearRect(0, 0, W, H);
        const bg = g2.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.75); bg.addColorStop(0, "#161233"); bg.addColorStop(1, "#08070f"); g2.fillStyle = bg; g2.fillRect(0, 0, W, H);
        g2.save(); g2.translate(W / 2, H / 2); g2.scale(T.cam.z, T.cam.z); g2.translate(-T.cam.x, -T.cam.y);
        // starfield (parallax-ish)
        T.stars.forEach((st) => { g2.fillStyle = "rgba(255,255,255," + (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(tnow * 0.002 + st.ph))) + ")"; g2.beginPath(); g2.arc(st.x, st.y, st.r / T.cam.z, 0, TAU); g2.fill(); });
        // hub
        const hubPulse = 0.5 + 0.5 * Math.sin(tnow * 0.003);
        g2.save(); g2.shadowColor = "#7fe0a0"; g2.shadowBlur = lowFx() ? 0 : 30 + hubPulse * 20; g2.fillStyle = "#1c1836"; g2.beginPath(); g2.arc(0, 0, 44, 0, TAU); g2.fill(); g2.restore();
        g2.strokeStyle = rgba("#7fe0a0", 0.5 + hubPulse * 0.4); g2.lineWidth = 3; g2.beginPath(); g2.arc(0, 0, 44, 0, TAU); g2.stroke();
        g2.fillStyle = "#e6ecf5"; g2.font = "900 18px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.fillText("🥚", 0, -6); g2.font = "800 13px system-ui"; g2.fillStyle = "#ffd36b"; g2.fillText(String(save.eggs), 0, 16);
        // connectors: hub → roots, parent → child
        TREE.forEach((nd) => {
          const q = T.nodes[nd.id]; const from = nd.req ? T.nodes[nd.req] : { x: 0, y: 0 }; const B = BRANCH[nd.branch];
          const owned = !!save.nodes[nd.id], avail = !owned && (!nd.req || save.nodes[nd.req]);
          const mx = (from.x + q.x) / 2 + (q.y - from.y) * 0.12, my = (from.y + q.y) / 2 - (q.x - from.x) * 0.12;
          g2.lineCap = "round";
          g2.strokeStyle = owned ? rgba(B.col, 0.9) : avail ? rgba(B.col, 0.45) : "rgba(255,255,255,0.1)"; g2.lineWidth = owned ? 4 : 2.5;
          if (owned && !lowFx()) { g2.shadowColor = B.col; g2.shadowBlur = 12; }
          g2.beginPath(); g2.moveTo(from.x, from.y); g2.quadraticCurveTo(mx, my, q.x, q.y); g2.stroke(); g2.shadowBlur = 0;
          if (owned) { g2.strokeStyle = "rgba(255,255,255,0.7)"; g2.lineWidth = 1.5; g2.setLineDash([6, 14]); g2.lineDashOffset = -tnow * 0.06; g2.beginPath(); g2.moveTo(from.x, from.y); g2.quadraticCurveTo(mx, my, q.x, q.y); g2.stroke(); g2.setLineDash([]); }
          else if (avail) { g2.strokeStyle = rgba(B.col, 0.35 + 0.3 * Math.sin(tnow * 0.004)); g2.lineWidth = 1.5; g2.setLineDash([4, 10]); g2.lineDashOffset = -tnow * 0.03; g2.beginPath(); g2.moveTo(from.x, from.y); g2.quadraticCurveTo(mx, my, q.x, q.y); g2.stroke(); g2.setLineDash([]); }
        });
        // nodes
        TREE.forEach((nd) => {
          const q = T.nodes[nd.id], B = BRANCH[nd.branch], owned = !!save.nodes[nd.id], reqOk = !nd.req || save.nodes[nd.req], can = !owned && reqOk && save.eggs >= nd.cost, avail = !owned && reqOk, sel = T.sel === nd.id, hov = T.hover === nd.id;
          const R = 26 + (sel ? 4 : 0) + (hov ? 2 : 0), pulse = 0.5 + 0.5 * Math.sin(tnow * 0.005 + q.x * 0.01);
          g2.save(); g2.translate(q.x, q.y);
          if (can) { g2.strokeStyle = rgba(B.col, 0.25 + pulse * 0.35); g2.lineWidth = 2; g2.beginPath(); g2.arc(0, 0, R + 10 + pulse * 6, 0, TAU); g2.stroke(); }
          if (sel) { g2.strokeStyle = "#fff"; g2.lineWidth = 2; g2.setLineDash([5, 6]); g2.lineDashOffset = -tnow * 0.05; g2.beginPath(); g2.arc(0, 0, R + 8, 0, TAU); g2.stroke(); g2.setLineDash([]); }
          if ((owned || can) && !lowFx()) { g2.shadowColor = B.col; g2.shadowBlur = owned ? 22 : 14 + pulse * 10; }
          g2.fillStyle = owned ? B.col : avail ? "#1c1836" : "#100e1c"; g2.beginPath(); g2.arc(0, 0, R, 0, TAU); g2.fill(); g2.shadowBlur = 0;
          g2.strokeStyle = owned ? "#fff" : avail ? B.col : "rgba(255,255,255,0.18)"; g2.lineWidth = owned ? 2.5 : 2; g2.beginPath(); g2.arc(0, 0, R, 0, TAU); g2.stroke();
          g2.globalAlpha = avail || owned ? 1 : 0.35; drawNodeIcon(g2, nd, R, owned ? "#0e0c1e" : B.col, false); g2.globalAlpha = 1;
          if (!owned) { g2.fillStyle = reqOk ? "#ffd36b" : "rgba(255,255,255,0.35)"; g2.font = "800 11px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; const pill = String(nd.cost); const pw = pill.length * 7 + 14; g2.fillStyle = "rgba(10,8,20,0.85)"; rr(g2, -pw / 2, R + 4, pw, 16, 8); g2.fill(); g2.fillStyle = reqOk ? "#ffd36b" : "rgba(255,255,255,0.4)"; g2.fillText("🥚" + pill, 0, R + 12); }
          if (!reqOk && !owned) { g2.fillStyle = "rgba(255,255,255,0.35)"; g2.font = "12px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.fillText("🔒", 0, 0); }
          // label (zoom-aware)
          if (T.cam.z > 0.7 || sel || hov) { g2.fillStyle = owned ? "#e6ecf5" : avail ? "#e6ecf5" : "rgba(230,236,245,0.45)"; g2.font = "700 12px system-ui"; g2.textAlign = "center"; g2.textBaseline = "top"; g2.fillText(nd.name, 0, -R - 20); }
          g2.restore();
        });
        // fx
        for (let k = T.fx.length - 1; k >= 0; k--) {
          const f = T.fx[k]; f.t += dtf; const kk = Math.min(1, f.t / f.dur);
          if (f.kind === "pulse") { const x = lerp(f.x0, f.x1, kk), y = lerp(f.y0, f.y1, kk); g2.save(); g2.shadowColor = f.col; g2.shadowBlur = 20; g2.fillStyle = "#fff"; g2.beginPath(); g2.arc(x, y, 7, 0, TAU); g2.fill(); g2.fillStyle = f.col; g2.beginPath(); g2.arc(x, y, 12, 0, TAU); g2.globalAlpha = 0.5; g2.fill(); g2.restore(); }
          else if (f.kind === "p") { f.x += f.vx * dtf; f.y += f.vy * dtf; g2.globalAlpha = 1 - kk; g2.fillStyle = f.col; g2.beginPath(); g2.arc(f.x, f.y, 3, 0, TAU); g2.fill(); g2.globalAlpha = 1; }
          else if (f.kind === "ring") { g2.globalAlpha = 1 - kk; g2.strokeStyle = f.col; g2.lineWidth = 4 * (1 - kk) + 1; g2.beginPath(); g2.arc(f.x, f.y, 30 + kk * 70, 0, TAU); g2.stroke(); g2.globalAlpha = 1; }
          else if (f.kind === "flash") { g2.save(); g2.setTransform(dpr, 0, 0, dpr, 0, 0); const a = kk < 0.5 ? kk * 2 : 1 - (kk - 0.5) * 2; g2.fillStyle = "rgba(255,255,255," + (a * 0.9) + ")"; g2.fillRect(0, 0, W, H); if (kk > 0.4) { g2.fillStyle = "#ffd36b"; g2.font = "900 " + Math.round(Math.min(W, H) * 0.12) + "px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.globalAlpha = Math.min(1, (kk - 0.4) * 3) * (1 - Math.max(0, kk - 0.85) * 6); g2.fillText("✦ REBIRTH ✦", W / 2, H / 2); } g2.restore(); }
          if (kk >= 1) T.fx.splice(k, 1);
        }
        g2.restore();
        // branch compass labels at the edges
        Object.keys(BRANCH).forEach((br) => { const B = BRANCH[br]; const ids = TREE.filter((nd) => nd.branch === br); const owned = ids.filter((nd) => save.nodes[nd.id]).length; const a = B.ang; const x = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 26), y = H / 2 + Math.sin(a) * (H / 2 - 22); g2.fillStyle = rgba(B.col, 0.85); g2.font = "800 11px system-ui"; g2.textAlign = "center"; g2.textBaseline = "middle"; g2.fillText(br.toUpperCase() + " " + owned + "/" + ids.length, x, y); });
      }
      function showEnd(victory, cleared, eggs, prevBest) {
        overlay.innerHTML = ""; overlay.style.display = ""; overlay.classList.remove("menu"); overlay.classList.remove("tree");
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
        if (button === 2) { placing = null; moving = null; selected = null; renderPanel(); return; }
        if (moving) { const t = moving, T = TOWERS[t.type]; const why = blocked(x, y, towerR(t), t.type, t); if (why) { toast(blockMsg(why, T), "#ff8fa3"); sndNo(); return; } burst(t.x, t.y, "#c8b89a", 8); ring(t.x, t.y, S * 0.05, T.col, 250); t.x = x; t.y = y; t.hx = x; t.hy = y; t.spawnT = 1; statsDirty = true; burst(x, y, T.col, 16); ring(x, y, S * 0.08, T.col, 400); floaters.push({ x, y: y - S * 0.07, text: T.name.toUpperCase() + " MOVED", col: T.col, t: 0, big: true }); sndPlace(); moving = null; selected = t; renderPanel(); return; }
        if (placing) { if (place(placing, x, y) && cash < TOWERS[placing].cost) { placing = null; toast("Out of cash — sell or clear a wave", "#ffd36b"); } renderPanel(); return; }
        let best = null, bd = 1e9; towers.forEach((t) => { const d = dist(x, y, t.x, t.y); if (d < towerR(t) * 1.6 && d < bd) { bd = d; best = t; } });
        if (best && best.bank > 0) collectBank(best);
        if (best !== selected) { selected = best; if (best) { sndClick(); ring(best.x, best.y, towerR(best) * 2.2, TOWERS[best.type].col, 300); } renderPanel(); }
      }
      function collectBank(t) { const v = t.bank; if (!v) return; t.bank = 0; cash += v; floaters.push({ x: t.x, y: t.y - S * 0.06, text: "🥚 +$" + v + " collected", col: "#ffd36b", t: 0, big: true }); burst(t.x, t.y, "#ffd36b", 20); ring(t.x, t.y, S * 0.08, "#ffd36b", 400); sndSell(); renderUI(); }
      function onMove(x, y) { hover = { x, y }; if (placing) hoverValid = !blocked(x, y, S * 0.033, placing); else if (moving) hoverValid = !blocked(x, y, towerR(moving), moving.type, moving); }

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
          wrap = el("div", "cb"); const left = el("div", "cb-left"); topbar = el("div", "cb-top"); hud = null; canvas = document.createElement("canvas"); canvas.className = "cb-canvas"; g = canvas.getContext("2d");
          left.appendChild(topbar); left.appendChild(canvas); toastEl = el("div", "cb-toast"); left.appendChild(toastEl); wrap.appendChild(left);
          panel = el("div", "cb-panel"); wrap.appendChild(panel);
          overlay = el("div", "cb-overlay"); wrap.appendChild(overlay);
          stage.appendChild(wrap);
          canvas.addEventListener("contextmenu", (e) => e.preventDefault());
          load(); if (!save.seen) { /* first-run help shows on the menu */ }
          now = 0; resize(); ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(resize);
          keyFn = (e) => { if (screen !== "game") return; if (e.key === " ") { e.preventDefault(); if (waveActive) { if (diff.id === "hard" && !paused) { toast("Hard mode: no pausing while bugs are on the road", "#ff8fa3"); return; } paused = !paused; } else startWave(); renderHud(); } else if (/^[1-9]$/.test(e.key)) { const type = Object.keys(TOWERS)[+e.key - 1]; if (type && unlocked(type)) { placing = placing === type ? null : type; selected = null; renderPanel(); } } else if (e.key === "Escape" || e.key.toLowerCase() === "q") { placing = null; selected = null; renderPanel(); } else if (e.key.toLowerCase() === "s" && selected) sellTower(selected); };
          window.addEventListener("keydown", keyFn);
          showMenu();
          Arcade._cb = { get: () => ({ screen, map: map && map.id, diff: diff && diff.id, cash, lives, wave, waveActive, towers: towers.map((t) => ({ type: t.type, x: t.x, y: t.y, tiers: t.tiers, kills: t.kills, bank: t.bank, patrol: t.patrol })), enemies: enemies.length, speed, paused, autoNext, water: map ? map.water : [], S, eggs: save.eggs, nodes: Object.keys(save.nodes), paths: paths.map((P) => P.pts) }), cheat: (o) => { if (o.cash != null) cash = o.cash; if (o.eggs != null) { save.eggs = o.eggs; persist(); } if (o.wave != null) wave = o.wave; if (o.rebirth != null) { save.rebirth = o.rebirth; meta = metaFromNodes(save.nodes, save.rebirth); persist(); } if (o.allNodes) { TREE.forEach((nd) => { save.nodes[nd.id] = true; }); meta = metaFromNodes(save.nodes, save.rebirth); persist(); } renderUI(); }, rebirth: () => doRebirth(), treeFx: () => tree && tree.fx.length, elites: () => enemies.filter((e) => e.elite).map((e) => e.elite), act: { startWave, place, upgrade: (i, pi) => upgrade(towers[i], pi), select: (i) => { selected = towers[i]; renderPanel(); }, newRun, showMenu, showTree, setSpeed: (v) => { speed = v; }, endRun, selectNode, roots: TREE.filter((nd) => !nd.req).map((nd) => nd.id) } };
          draw();
        },
        handleInput(intent) { if (intent.type !== "point" || (intent.el && intent.el !== canvas)) return; if (intent.phase === "move") onMove(intent.x, intent.y); else if (intent.phase === "down") onDown(intent.x, intent.y, intent.button); },
        tick(dt) { update(dt); draw(); if (screen === "tree") drawTree(); if (screen === "game") renderHud(); },
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
.cb-card{--tc:#7fe0a0;position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1.5px solid rgba(255,255,255,.12);border-radius:16px;padding:10px 6px 8px;color:#e6ecf5;font:inherit;cursor:pointer;text-align:center;transition:transform .12s,border-color .12s,box-shadow .12s}.cb-card canvas{transition:transform .15s}.cb-card:hover{border-color:var(--tc);transform:translateY(-2px)}.cb-card:hover canvas{transform:scale(1.12)}.cb-card.can{border-color:color-mix(in srgb,var(--tc) 45%,transparent)}.cb-card.on{border-color:var(--tc);background:color-mix(in srgb,var(--tc) 18%,transparent);box-shadow:0 0 22px color-mix(in srgb,var(--tc) 45%,transparent),inset 0 0 0 1px var(--tc);animation:cbpulse 1.1s ease-in-out infinite}.cb-card.on canvas{transform:scale(1.15)}.cb-card.poor{opacity:.5;filter:saturate(.5)}.cb-card.lock{opacity:.4;filter:grayscale(.6)}.cb-card kbd{position:absolute;top:5px;left:7px;font-size:10px;opacity:.45;font-family:inherit}.cb-card.shake{animation:cbshake .35s}
@keyframes cbpulse{0%,100%{box-shadow:0 0 14px color-mix(in srgb,var(--tc) 35%,transparent)}50%{box-shadow:0 0 30px color-mix(in srgb,var(--tc) 70%,transparent)}}@keyframes cbshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.cb-card-name b{display:block;font-size:12.5px;letter-spacing:.01em}.cb-card-name em{display:inline-block;font-style:normal;font-weight:800;font-size:12px;color:#0e0c1e;background:#ffd36b;border-radius:999px;padding:1px 9px;margin-top:3px}.cb-card.lock .cb-card-name em,.cb-card.poor .cb-card-name em{background:rgba(255,255,255,.14);color:#e6ecf5}
.cb-pips{display:grid;grid-template-columns:auto 1fr;gap:1px 5px;align-items:center;margin-top:5px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;opacity:.8;text-align:left}.cb-pips label{opacity:.6}.cb-pips i{display:inline-block;width:8px;height:4px;border-radius:2px;background:rgba(255,255,255,.14);margin-right:2px;vertical-align:middle}.cb-pips i.on{background:var(--tc)}.cb-noair{position:absolute;top:5px;right:7px;font-size:9px;color:#ff8fa3;opacity:.85}
.cb-shop-title.placing{color:#e6ecf5;opacity:1;background:rgba(127,224,160,.12);border:1px solid rgba(127,224,160,.4);border-radius:10px;padding:8px 10px;text-transform:none;letter-spacing:0;font-size:13px}.cb-shop-title.placing b{color:#7fe0a0}.cb-shop-title.placing u{cursor:pointer;opacity:.7;margin-left:4px}
.cb-tip{margin-top:8px;font-size:12px;opacity:.6}
.cb-sel-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}.cb-sel-head b{display:block;font-size:15px}.cb-sel-head small{opacity:.65;font-size:12px;display:block}.cb-x{margin-left:auto;background:transparent;border:0;color:#e6ecf5;opacity:.6;font-size:16px;cursor:pointer}
.cb-stats{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;opacity:.85;margin-bottom:8px}.cb-stats b{color:#7fe0a0}.cb-warn{color:#ff8fa3}
.cb-path{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px;margin-bottom:6px;background:rgba(255,255,255,.03)}.cb-path.has{border-color:rgba(127,224,160,.35)}.cb-path.locked{opacity:.5}
.cb-path-name{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}.cb-path-name i{color:#ffd36b;letter-spacing:2px;font-style:normal}
.cb-up{width:100%;display:grid;grid-template-columns:1fr auto;gap:2px 8px;text-align:left;background:rgba(127,224,160,.12);border:1px solid rgba(127,224,160,.4);border-radius:10px;padding:6px 8px;color:#e6ecf5;font:inherit;cursor:pointer}.cb-up b{font-size:13px}.cb-up small{grid-column:1;opacity:.7;font-size:11px}.cb-up em{grid-row:1/3;align-self:center;font-style:normal;font-weight:800;color:#ffd36b}.cb-up.poor{opacity:.5;border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.04)}
.cb-maxed{font-size:12px;color:#7fe0a0;font-weight:700}.cb-maxed.dim{color:rgba(230,236,245,.45);font-weight:500}
.cb-sel-foot{display:flex;gap:8px;margin-top:6px}.cb-target,.cb-sell{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px;color:#e6ecf5;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.cb-sell{border-color:rgba(255,107,107,.5);color:#ff8fa3}
.cb-overlay{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;z-index:5;overflow-y:auto;padding:6px}.cb-overlay.menu{padding-top:min(24vh,190px)}.cb-overlay.menu.tree{padding-top:6px}
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
.cb-treecard{max-width:940px}.cb-treenav{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}.cb-branchbtn{--bc:#7fe0a0;background:rgba(255,255,255,.05);border:1px solid color-mix(in srgb,var(--bc) 45%,transparent);border-radius:12px;padding:6px 12px;color:#e6ecf5;font:inherit;font-weight:800;font-size:13px;cursor:pointer;display:flex;flex-direction:column;align-items:center;line-height:1.1}.cb-branchbtn small{font-weight:600;font-size:10px;color:var(--bc)}.cb-branchbtn:hover{background:color-mix(in srgb,var(--bc) 18%,transparent)}.cb-treehint{margin-left:auto;font-size:12px;opacity:.5}
.cb-treeholder{position:relative}.cb-treecv{display:block;border-radius:16px;border:1px solid rgba(255,255,255,.1);touch-action:none;cursor:grab;width:100%}
.cb-treedetail{position:absolute;left:12px;right:12px;bottom:12px;background:rgba(10,8,22,.9);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 12px;backdrop-filter:blur(6px);display:flex;flex-direction:column;gap:6px;max-width:460px;margin:0 auto}
.cb-td-head{display:flex;align-items:center;gap:10px}.cb-td-head b{display:block;font-size:16px}.cb-td-head small{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase}.cb-td-desc{margin:0;opacity:.85;font-size:13px}.cb-td-row{display:flex;gap:8px}.cb-td-buy{flex:1;font-size:14px!important}.cb-td-buy.off{opacity:.5}.cb-td-owned{color:#7fe0a0;font-weight:800}.cb-td-empty{opacity:.6;font-size:13px}
.cb-eggs.pop{animation:cbeggpop .5s}@keyframes cbeggpop{0%{transform:scale(1)}30%{transform:scale(1.35);color:#fff}100%{transform:scale(1)}}
@media (max-width:899px){.cb-treehint{display:none}.cb-treedetail{left:6px;right:6px;bottom:6px;padding:8px}}
.cb-rbbtn{background:rgba(255,255,255,.06)!important;color:#e6ecf5!important;display:flex;flex-direction:column;line-height:1.1;padding:6px 12px!important}.cb-rbbtn small{font-size:10px;opacity:.65;font-weight:600}.cb-rbbtn.ready{background:linear-gradient(135deg,#ffd36b,#ff8f3d)!important;color:#0e0c1e!important;animation:cbpulse 1.2s infinite;--tc:#ffd36b}.cb-rbbtn.ready small{opacity:.8}
.cb-rbmodal{position:fixed;inset:0;background:rgba(6,5,14,.8);display:flex;align-items:center;justify-content:center;z-index:9;border-radius:22px}.cb-rbcard{width:min(520px,94%);background:#14112a;border:1px solid rgba(255,211,107,.5);border-radius:20px;padding:18px 20px;box-shadow:0 0 60px rgba(255,211,107,.2);text-align:center}.cb-rbcard h2{margin:0 0 6px;color:#ffd36b}
.cb-rbgain{display:flex;align-items:center;gap:14px;text-align:left;background:rgba(255,255,255,.04);border-radius:14px;padding:10px;margin:10px 0}.cb-rbgain b{display:block;font-size:18px}.cb-rbgain small{display:block;opacity:.75;font-size:13px}.cb-rbgain i{display:block;font-style:normal;color:#7fe0a0;font-weight:700;font-size:13px;margin-top:4px}
.cb-rblose{font-size:13px;opacity:.85;line-height:1.6;margin-bottom:10px}.cb-rblose span{color:#ff8fa3;font-weight:700}.cb-rblose span.apoc{color:#ffd36b}.cb-rbgo{background:linear-gradient(135deg,#ffd36b,#ff8f3d)!important;color:#0e0c1e!important;font-size:16px!important}
.cb-rbline{text-align:center;color:#ffd36b;font-size:13px;margin:-4px 0 10px;opacity:.9}.cb-diff.apoc.on,.cb-diff.apoc:not(.locked){border-color:rgba(255,107,107,.6)}.cb-diff.locked{opacity:.45}.cb-card.rb{border-color:rgba(255,211,107,.35)}.cb-card.rb.lock .cb-card-name em{background:rgba(255,211,107,.18);color:#ffd36b}
.cb-collect{width:100%;margin:6px 0 2px;background:linear-gradient(135deg,#ffd36b,#c9e07f);color:#0e0c1e;border:0;border-radius:10px;padding:9px;font:inherit;font-weight:800;cursor:pointer;animation:cbpulse 1.2s infinite;--tc:#ffd36b}
.cb-patrol{width:100%;margin-top:6px;background:rgba(116,185,255,.08)!important;border-color:rgba(116,185,255,.35)!important}.cb-patrol.on{background:rgba(116,185,255,.22)!important;border-color:#74b9ff!important;color:#fff}.cb-move.on{background:rgba(255,211,107,.2)!important;border-color:#ffd36b!important}
.cb-noair.wat{color:#74b9ff}.cb-noair.fly{color:#c98cff}.cb-noair.gold{color:#ffd36b}.cb-sp.dis{opacity:.4}
.cb-end{text-align:center}.cb-end h2{margin:0 0 6px}.cb-endline{opacity:.8;margin:0 0 10px}.cb-endeggs b{font-size:28px;color:#ffd36b;display:block}.cb-endeggs small{opacity:.6}.cb-end .btn-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
@media (max-width:899px){.cb-panel{padding:10px}.cb-top{font-size:13px}}
`;
})();
