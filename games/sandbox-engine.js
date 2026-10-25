// =====================================================================
// Blockdorf – Regeln und Welt (ohne Oberfläche, ohne Uhr; update(dt) treibt alles an → testbar)
//   Welt:      512 × 192 Blöcke, aus einer Zahl (seed) erzeugt: Hügel, Höhlen, Erze, Bäume, Sand, Dorf
//   Licht:     Himmelslicht + Fackellicht, weich ausgebreitet (wie bei Terraria)
//   Physik:    Spieler, Dorfbewohner, Schleime (Rechteck-Kollision, Stufen werden automatisch genommen)
//   Handwerk:  Abbauen mit Werkzeug-Stufen, Bauen, Rezepte, Werkbank
//   Speichern: Blöcke als Lauflängen (Base64) – klein genug für den Spielstand im Drive
// =====================================================================

export const W = 512, H = 192, SURF = 60, SPAWN_X = W >> 1;
export const DAY_LEN = 420;            // Sekunden pro Tag
export const REACH = 5.5;              // wie weit der Spieler Blöcke erreicht (in Blöcken)

// ---------------------------------------------------------------------
// Blöcke und Gegenstände
// ---------------------------------------------------------------------
export const B = { AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7, COAL: 8, IRON: 9, GOLD: 10, TORCH: 11, BENCH: 12, GLASS: 13, BRICK: 14, BEDROCK: 15, FLOWER: 16, TALLGRASS: 17 };
const def = (key, o) => ({ key, solid: false, lcost: 0, hard: 0.5, tier: 0, drop: null, emit: 0, ...o });
/** solid = Körper stoßen dagegen · lcost = wie stark der Block Licht schluckt, das ihn verlässt · hard = Sekunden mit der Hand */
export const BLOCKS = [];
BLOCKS[B.AIR] = def("air", { hard: 0 });
BLOCKS[B.DIRT] = def("dirt", { solid: true, lcost: 3, hard: 0.5, drop: "dirt" });
BLOCKS[B.GRASS] = def("grass", { solid: true, lcost: 3, hard: 0.6, drop: "dirt" });
BLOCKS[B.STONE] = def("stone", { solid: true, lcost: 3, hard: 1.8, tier: 1, drop: "stone" });
BLOCKS[B.SAND] = def("sand", { solid: true, lcost: 3, hard: 0.5, drop: "sand" });
BLOCKS[B.LOG] = def("log", { solid: true, lcost: 3, hard: 1.2, drop: "log" });
BLOCKS[B.LEAVES] = def("leaves", { lcost: 1, hard: 0.2, drop: "leaves" });
BLOCKS[B.PLANKS] = def("planks", { solid: true, lcost: 3, hard: 1, drop: "planks" });
BLOCKS[B.COAL] = def("coal", { solid: true, lcost: 3, hard: 2.2, tier: 1, drop: "coal" });
BLOCKS[B.IRON] = def("iron", { solid: true, lcost: 3, hard: 3.2, tier: 2, drop: "iron" });
BLOCKS[B.GOLD] = def("gold", { solid: true, lcost: 3, hard: 4, tier: 3, drop: "gold" });
BLOCKS[B.TORCH] = def("torch", { hard: 0.05, drop: "torch", emit: 13 });
BLOCKS[B.BENCH] = def("bench", { hard: 1, drop: "bench" });
BLOCKS[B.GLASS] = def("glass", { solid: true, lcost: 0, hard: 0.5, drop: "glass" });
BLOCKS[B.BRICK] = def("brick", { solid: true, lcost: 3, hard: 2.5, tier: 1, drop: "brick" });
BLOCKS[B.BEDROCK] = def("bedrock", { solid: true, lcost: 3, hard: Infinity });
BLOCKS[B.FLOWER] = def("flower", { hard: 0.05 });
BLOCKS[B.TALLGRASS] = def("tallgrass", { hard: 0.05 });

/** Gegenstände: block = Block, der beim Bauen entsteht · tool/tier = Werkzeug */
export const ITEMS = {
  dirt: { name: "Erde", block: B.DIRT }, stone: { name: "Stein", block: B.STONE }, sand: { name: "Sand", block: B.SAND },
  log: { name: "Holz", block: B.LOG }, leaves: { name: "Laub", block: B.LEAVES }, planks: { name: "Bretter", block: B.PLANKS },
  coal: { name: "Kohle" }, iron: { name: "Eisen" }, gold: { name: "Gold" },
  torch: { name: "Fackel", block: B.TORCH }, bench: { name: "Werkbank", block: B.BENCH },
  glass: { name: "Glas", block: B.GLASS }, brick: { name: "Ziegel", block: B.BRICK },
  wood_pick: { name: "Holzspitzhacke", tool: "pick", tier: 1 }, stone_pick: { name: "Steinspitzhacke", tool: "pick", tier: 2 }, iron_pick: { name: "Eisenspitzhacke", tool: "pick", tier: 3 },
  wood_sword: { name: "Holzschwert", tool: "sword", tier: 1 }, stone_sword: { name: "Steinschwert", tool: "sword", tier: 2 }, iron_sword: { name: "Eisenschwert", tool: "sword", tier: 3 }
};
export const PLACE_ORDER = ["torch", "dirt", "stone", "planks", "log", "brick", "glass", "sand", "leaves", "bench"];
export const RECIPES = [
  { id: "planks", out: ["planks", 4], cost: { log: 1 } },
  { id: "torch", out: ["torch", 4], cost: { coal: 1, planks: 1 } },
  { id: "bench", out: ["bench", 1], cost: { planks: 8 } },
  { id: "stone_pick", out: ["stone_pick", 1], cost: { stone: 8, planks: 3 }, bench: true },
  { id: "iron_pick", out: ["iron_pick", 1], cost: { iron: 8, planks: 3 }, bench: true },
  { id: "stone_sword", out: ["stone_sword", 1], cost: { stone: 6, planks: 2 }, bench: true },
  { id: "iron_sword", out: ["iron_sword", 1], cost: { iron: 6, planks: 2 }, bench: true },
  { id: "brick", out: ["brick", 2], cost: { stone: 2 }, bench: true },
  { id: "glass", out: ["glass", 2], cost: { sand: 2 }, bench: true }
];
const PICK_SPEED = [1, 2, 3.4, 5];

// ---------------------------------------------------------------------
// Zufall und Rauschen
// ---------------------------------------------------------------------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 3) {
  let t = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, s + i * 101); n += a; a *= 0.5; f *= 2; }
  return t / n;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------------
// Blöcke ↔ Text (Lauflängen, Base64)
// ---------------------------------------------------------------------
export function encodeTiles(tiles) {
  const out = [];
  let i = 0;
  while (i < tiles.length) {
    const v = tiles[i];
    let n = 1;
    while (n < 255 && i + n < tiles.length && tiles[i + n] === v) n++;
    out.push(v, n);
    i += n;
  }
  let s = "";
  for (let k = 0; k < out.length; k += 8192) s += String.fromCharCode.apply(null, out.slice(k, k + 8192));
  return btoa(s);
}
export function decodeTiles(str) {
  const bin = atob(str);
  const tiles = new Uint8Array(W * H);
  let pos = 0;
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const v = bin.charCodeAt(i), n = bin.charCodeAt(i + 1);
    if (v >= BLOCKS.length || !n || pos + n > tiles.length) throw new Error("Welt beschädigt");
    tiles.fill(v, pos, pos + n);
    pos += n;
  }
  if (pos !== tiles.length) throw new Error("Welt beschädigt");
  return tiles;
}

const LINES = [
  "Willkommen im Dorf!", "Nachts treiben sich Schleime in den Höhlen herum.", "Tief unten gibt es Eisen – und sogar Gold.",
  "Fackeln halten die Dunkelheit fern.", "Mit einer Werkbank wird alles besser.", "Schönes Wetter heute!", "Hast du schon die Höhlen erkundet?",
  "Für Eisen brauchst du eine Steinspitzhacke."
];

// =====================================================================
export class Sandbox {
  /** opts.seed: neue Welt · opts.data: gespeicherte Welt (Ergebnis von toData) */
  constructor(opts = {}) {
    this.events = [];
    this.input = { left: false, right: false, jump: false };
    this.mining = null;
    this.lightDirty = true;
    if (opts.data) this._fromData(opts.data);
    else { this.seed = (opts.seed ?? (Math.random() * 2147483647)) | 0; this._generate(); this._fresh(); }
    this.rng = mulberry32((this.seed ^ 0x51ed) + Math.floor(this.time * 1000));
    this.sky = new Uint8Array(W * H);
    this.blk = new Uint8Array(W * H);
    this.spawnT = 2;
    this.relight();
  }

  // ---------- Zugriff ----------
  tile(x, y) { return x < 0 || x >= W || y < 0 || y >= H ? (y < 0 ? B.AIR : B.BEDROCK) : this.tiles[y * W + x]; }
  solidAt(x, y) { return BLOCKS[this.tile(Math.floor(x), Math.floor(y))].solid; }
  setTile(x, y, id) { if (x >= 0 && x < W && y >= 0 && y < H) { this.tiles[y * W + x] = id; this.lightDirty = true; } }

  // ---------- Welt erzeugen ----------
  _generate() {
    const seed = this.seed, rnd = mulberry32(seed);
    const tiles = (this.tiles = new Uint8Array(W * H));
    const hgt = new Int16Array(W);
    for (let x = 0; x < W; x++) {
      const t = smooth(22, 50, Math.abs(x - SPAWN_X));
      hgt[x] = Math.round(SURF + (fbm(x * 0.012, 3.7, seed, 4) - 0.5) * 80 * t);
    }
    const sandAt = x => Math.abs(x - SPAWN_X) > 55 && fbm(x * 0.02, 9.1, seed + 7, 3) > 0.6;
    this.ground = new Int16Array(W);
    for (let x = 0; x < W; x++) {
      const top = clamp(hgt[x], 20, H - 40);
      const sand = sandAt(x);
      const dirt = 3 + Math.floor(hash2(x, 5, seed) * 3);
      for (let y = top; y < H; y++) {
        let id;
        if (y >= H - 2) id = B.BEDROCK;
        else if (sand && y < top + 6) id = B.SAND;
        else if (y === top) id = B.GRASS;
        else if (y <= top + dirt) id = B.DIRT;
        else id = B.STONE;
        tiles[y * W + x] = id;
      }
      this.ground[x] = top;
    }
    // Höhlen: dünne Gänge (Schnitt zweier Rauschfelder) und größere Kammern
    for (let x = 1; x < W - 1; x++) {
      const top = this.ground[x];
      const nearVillage = Math.abs(x - SPAWN_X) < 26;
      for (let y = top + 6; y < H - 5; y++) {
        if (nearVillage && y < top + 18) continue;
        const a = Math.abs(vnoise(x * 0.05, y * 0.07, seed + 11) - 0.5);
        const b = Math.abs(vnoise(x * 0.05 + 40, y * 0.07 + 40, seed + 23) - 0.5);
        let carve = a < 0.04 && b < 0.045;
        if (!carve && y > top + 24 && fbm(x * 0.03, y * 0.045, seed + 31, 3) > 0.7) carve = true;
        if (carve && tiles[y * W + x] !== B.BEDROCK) tiles[y * W + x] = B.AIR;
      }
    }
    // Erze als kleine Adern
    const vein = (type, count, minD, size) => {
      for (let i = 0; i < count; i++) {
        let cx = Math.floor(rnd() * W), cy = Math.floor(SURF + minD + rnd() * (H - 8 - SURF - minD));
        const n = size[0] + Math.floor(rnd() * (size[1] - size[0] + 1));
        for (let k = 0; k < n; k++) {
          if (cx > 0 && cx < W - 1 && cy > 0 && cy < H - 3 && tiles[cy * W + cx] === B.STONE) tiles[cy * W + cx] = type;
          const d = Math.floor(rnd() * 4);
          cx += d === 0 ? 1 : d === 1 ? -1 : 0; cy += d === 2 ? 1 : d === 3 ? -1 : 0;
        }
      }
    };
    vein(B.COAL, 520, 8, [4, 9]);
    vein(B.IRON, 330, 28, [3, 7]);
    vein(B.GOLD, 150, 62, [2, 5]);
    // Bäume, Gras, Blumen
    for (let x = 6; x < W - 6; x += 4 + Math.floor(rnd() * 6)) {
      if (Math.abs(x - SPAWN_X) < 26 || sandAt(x)) continue;
      const gy = this.ground[x];
      if (tiles[gy * W + x] !== B.GRASS) continue;
      const th = 4 + Math.floor(rnd() * 4);
      for (let i = 1; i <= th; i++) tiles[(gy - i) * W + x] = B.LOG;
      const top = gy - th;
      for (let dx = -2; dx <= 2; dx++) for (let dy = -3; dy <= 1; dy++) {
        if (dx * dx + dy * dy * 0.8 > 5.2) continue;
        const px = x + dx, py = top + dy;
        if (px >= 0 && px < W && py > 0 && tiles[py * W + px] === B.AIR) tiles[py * W + px] = B.LEAVES;
      }
    }
    for (let x = 0; x < W; x++) {
      const gy = this.ground[x];
      if (tiles[gy * W + x] !== B.GRASS || tiles[(gy - 1) * W + x] !== B.AIR) continue;
      const r = rnd();
      if (r < 0.2) tiles[(gy - 1) * W + x] = B.TALLGRASS; else if (r < 0.26) tiles[(gy - 1) * W + x] = B.FLOWER;
    }
    this._village();
  }
  _village() {
    const t = this.tiles, put = (x, y, id) => { if (x >= 0 && x < W && y > 0 && y < H) t[y * W + x] = id; };
    const S = SURF;
    for (let x = SPAWN_X - 24; x <= SPAWN_X + 24; x++) for (let y = S - 12; y < S; y++) put(x, y, B.AIR);   // Platz schaffen
    const house = (x0, bench) => {
      for (let y = S - 5; y <= S - 1; y++) { put(x0, y, B.PLANKS); put(x0 + 6, y, B.PLANKS); }
      for (let x = x0 - 1; x <= x0 + 7; x++) put(x, S - 6, B.PLANKS);        // Dach mit Überstand
      for (let x = x0 + 1; x <= x0 + 5; x++) { put(x, S, B.PLANKS); }       // Boden
      for (let y = S - 5; y <= S - 1; y++) for (let x = x0 + 1; x <= x0 + 5; x++) put(x, y, B.AIR);
      put(x0, S - 2, B.AIR); put(x0, S - 1, B.AIR);                          // Tür (offen)
      put(x0 + 6, S - 3, B.GLASS);                                           // Fenster
      put(x0 + 1, S - 4, B.TORCH);
      if (bench) put(x0 + 4, S - 1, B.BENCH);
    };
    house(SPAWN_X - 20, false);
    house(SPAWN_X - 3, true);
    house(SPAWN_X + 13, false);
    for (const x of [SPAWN_X - 9, SPAWN_X + 9]) { put(x, S - 1, B.LOG); put(x, S - 2, B.LOG); put(x, S - 3, B.TORCH); }  // Laternenpfähle
  }
  _fresh() {
    this.time = 0.3; this.day = 1;
    this.stats = { mined: 0, built: 0, kills: 0 };
    this.player = { x: SPAWN_X - 6.4, y: SURF - 1.8 - 0.001, w: 0.8, h: 1.8, vx: 0, vy: 0, onGround: false, face: 1, hp: 10, maxHp: 10, invuln: 0, coyote: 0, jumpBuf: 0, atkCd: 0, visOff: 0, stepUp: true };
    this.inv = { wood_pick: 1, wood_sword: 1, torch: 6 };
    this.sel = 0;
    this._entities();
  }
  _entities() {
    this.slimes = [];
    this.villagers = [-17, 0, 16].map((dx, i) => ({
      x: SPAWN_X + dx + 1.6, y: SURF - 1.7 - 0.001, w: 0.7, h: 1.7, vx: 0, vy: 0, onGround: false, face: 1,
      home: SPAWN_X + dx + 3, t: 1 + i, dir: 0, say: null, sayT: 0, cool: 3 + i * 2, look: i, stepUp: true, visOff: 0
    }));
  }

  // ---------- Speichern ----------
  toData() {
    const p = this.player;
    return {
      v: 1, seed: this.seed, tiles: encodeTiles(this.tiles), ground: Array.from(this.ground),
      p: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), hp: p.hp }, inv: { ...this.inv }, sel: this.sel,
      time: +this.time.toFixed(4), day: this.day, stats: { ...this.stats }
    };
  }
  _fromData(d) {
    if (!d || d.v !== 1 || typeof d.tiles !== "string") throw new Error("Unbekanntes Welt-Format");
    this.seed = d.seed | 0;
    this.tiles = decodeTiles(d.tiles);
    this.ground = Int16Array.from(d.ground && d.ground.length === W ? d.ground : new Array(W).fill(SURF));
    this._fresh();
    const p = this.player;
    if (d.p && Number.isFinite(d.p.x) && Number.isFinite(d.p.y)) { p.x = clamp(d.p.x, 0, W - p.w); p.y = clamp(d.p.y, 0, H - p.h); p.hp = clamp(d.p.hp | 0, 1, p.maxHp); }
    if (d.inv && typeof d.inv === "object") { this.inv = {}; for (const [k, v] of Object.entries(d.inv)) if (ITEMS[k] && v > 0) this.inv[k] = Math.min(9999, v | 0); }
    this.sel = d.sel | 0;
    this.time = Number.isFinite(d.time) ? d.time % 1 : 0.3;
    this.day = Math.max(1, d.day | 0);
    if (d.stats) this.stats = { mined: d.stats.mined | 0, built: d.stats.built | 0, kills: d.stats.kills | 0 };
    // Falls der Spielstand im Boden steckt (beschädigt), zurück ins Dorf
    if (this._hit(p)) { p.x = SPAWN_X - 6.4; p.y = SURF - 1.8 - 0.001; }
  }

  // ---------- Licht ----------
  dayFactor() { return clamp(0.5 + 0.7 * Math.sin(2 * Math.PI * (this.time - 0.25)), 0.06, 1); }
  /** 0 … 15: wie hell ist es an diesem Block gerade? */
  lightAt(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return 0;
    const i = y * W + x;
    return Math.max(this.sky[i] * this.dayFactor(), this.blk[i]);
  }
  relight() {
    this.lightDirty = false;
    const tiles = this.tiles, sky = this.sky, blk = this.blk;
    sky.fill(0); blk.fill(0);
    const bs = Array.from({ length: 16 }, () => []);
    // Himmelslicht: in jeder Spalte von oben bis zum ersten Block, der Licht schluckt
    for (let x = 0; x < W; x++) for (let y = 0; y < H && BLOCKS[tiles[y * W + x]].lcost === 0; y++) sky[y * W + x] = 15;
    for (let i = 0; i < W * H; i++) if (sky[i] === 15) bs[15].push(i);
    this._spread(sky, bs);
    const bb = Array.from({ length: 16 }, () => []);
    for (let i = 0; i < W * H; i++) { const e = BLOCKS[tiles[i]].emit; if (e) { blk[i] = e; bb[e].push(i); } }
    this._spread(blk, bb);
  }
  _spread(light, buckets) {
    const tiles = this.tiles;
    for (let L = 15; L >= 2; L--) {
      const list = buckets[L];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        if (light[i] !== L) continue;
        const nl = L - 1 - BLOCKS[tiles[i]].lcost;
        if (nl <= 0) continue;
        const x = i % W, y = (i / W) | 0;
        if (x > 0 && light[i - 1] < nl) { light[i - 1] = nl; buckets[nl].push(i - 1); }
        if (x < W - 1 && light[i + 1] < nl) { light[i + 1] = nl; buckets[nl].push(i + 1); }
        if (y > 0 && light[i - W] < nl) { light[i - W] = nl; buckets[nl].push(i - W); }
        if (y < H - 1 && light[i + W] < nl) { light[i + W] = nl; buckets[nl].push(i + W); }
      }
    }
  }

  // ---------- Inventar ----------
  count(item) { return this.inv[item] || 0; }
  add(item, n = 1) { this.inv[item] = Math.min(9999, this.count(item) + n); this.events.push({ t: "pickup", item, n }); }
  _take(item, n) { const c = this.count(item) - n; if (c > 0) this.inv[item] = c; else delete this.inv[item]; }
  tier(kind) { let t = 0; for (const [k, v] of Object.entries(this.inv)) { const it = ITEMS[k]; if (v > 0 && it && it.tool === kind && it.tier > t) t = it.tier; } return t; }
  hotbar() { return PLACE_ORDER.filter(k => this.count(k) > 0); }
  selItem() { const hb = this.hotbar(); if (!hb.length) return null; this.sel = clamp(this.sel, 0, hb.length - 1); return hb[this.sel]; }
  select(i) { const hb = this.hotbar(); if (hb.length) this.sel = clamp(i, 0, hb.length - 1); }
  benchNear() {
    const p = this.player, cx = Math.floor(p.x + p.w / 2), cy = Math.floor(p.y + p.h / 2);
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) if (this.tile(x, y) === B.BENCH) return true;
    return false;
  }
  recipeState(r) {
    const have = Object.entries(r.cost).every(([k, n]) => this.count(k) >= n);
    const owned = ITEMS[r.out[0]].tool && this.count(r.out[0]) > 0;
    return { have, owned: !!owned, bench: !r.bench || this.benchNear() };
  }
  craft(id) {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return false;
    const s = this.recipeState(r);
    if (!s.have || !s.bench || s.owned) return false;
    for (const [k, n] of Object.entries(r.cost)) this._take(k, n);
    this.add(r.out[0], r.out[1]);
    this.events.push({ t: "craft", id });
    return true;
  }

  // ---------- Abbauen, Bauen, Kämpfen ----------
  reachOk(tx, ty) {
    const p = this.player;
    return Math.hypot(tx + 0.5 - (p.x + p.w / 2), ty + 0.5 - (p.y + p.h / 2)) <= REACH;
  }
  /** Ein Bild lang abbauen. Liefert 0 = nichts, 1 = in Arbeit, 2 = abgebaut, -1 = Werkzeug zu schwach */
  mineStep(tx, ty, dt) {
    if (!this.reachOk(tx, ty)) { this.mining = null; return 0; }
    const id = this.tile(tx, ty), bd = BLOCKS[id];
    if (id === B.AIR || bd.hard === Infinity) { this.mining = null; return 0; }
    if (bd.tier > this.tier("pick")) {
      if (!this.mining || this.mining.x !== tx || this.mining.y !== ty || !this.mining.weak) this.events.push({ t: "weak", id });
      this.mining = { x: tx, y: ty, p: 0, weak: true };
      return -1;
    }
    if (!this.mining || this.mining.x !== tx || this.mining.y !== ty || this.mining.weak) this.mining = { x: tx, y: ty, p: 0 };
    this.mining.p += (dt * PICK_SPEED[this.tier("pick")]) / Math.max(0.03, bd.hard);
    if (this.mining.p >= 1) { this._break(tx, ty); this.mining = null; return 2; }
    return 1;
  }
  mineStop() { this.mining = null; }
  _break(x, y) {
    const id = this.tile(x, y), bd = BLOCKS[id];
    this.setTile(x, y, B.AIR);
    if (bd.drop) this.add(bd.drop, 1);
    this.stats.mined++;
    this.events.push({ t: "break", x, y, id });
    this._settle(x, y);
  }
  /** Nach dem Abbauen: Fackeln ohne Halt und Pflanzen ohne Boden fallen ab */
  _settle(x, y) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy, id = this.tile(nx, ny);
      if (id === B.TORCH && !this._supported(nx, ny)) { this.setTile(nx, ny, B.AIR); this.add("torch", 1); this.events.push({ t: "break", x: nx, y: ny, id }); this._settle(nx, ny); }
      else if ((id === B.FLOWER || id === B.TALLGRASS) && !BLOCKS[this.tile(nx, ny + 1)].solid) { this.setTile(nx, ny, B.AIR); this.events.push({ t: "break", x: nx, y: ny, id }); }
    }
  }
  _supported(x, y) { return BLOCKS[this.tile(x - 1, y)].solid || BLOCKS[this.tile(x + 1, y)].solid || BLOCKS[this.tile(x, y + 1)].solid || BLOCKS[this.tile(x, y - 1)].solid; }
  /** Ausgewählten Block setzen */
  place(tx, ty) {
    const item = this.selItem();
    if (!item || !ITEMS[item].block) return false;
    if (!this.reachOk(tx, ty) || tx < 0 || tx >= W || ty < 1 || ty >= H - 2) return false;
    const cur = this.tile(tx, ty);
    if (cur !== B.AIR && cur !== B.FLOWER && cur !== B.TALLGRASS) return false;
    const id = ITEMS[item].block;
    if (!this._supported(tx, ty)) return false;
    if (BLOCKS[id].solid) {
      const box = { x: tx, y: ty, w: 1, h: 1 };
      const over = b => b.x < box.x + 1 && b.x + b.w > box.x && b.y < box.y + 1 && b.y + b.h > box.y;
      if (over(this.player) || this.villagers.some(over) || this.slimes.some(over)) return false;
    }
    this.setTile(tx, ty, id);
    this._take(item, 1);
    this.stats.built++;
    this.events.push({ t: "place", x: tx, y: ty, id });
    return true;
  }
  /** Schwerthieb auf einen Schleim an (mx, my) in Blockkoordinaten. Liefert true, wenn getroffen. */
  attack(mx, my) {
    const p = this.player;
    if (p.atkCd > 0) return false;
    for (const s of this.slimes) {
      if (mx < s.x - 0.4 || mx > s.x + s.w + 0.4 || my < s.y - 0.4 || my > s.y + s.h + 0.4) continue;
      if (Math.hypot(s.x + s.w / 2 - (p.x + p.w / 2), s.y + s.h / 2 - (p.y + p.h / 2)) > REACH - 0.5) continue;
      const dmg = [1, 2, 3, 5][this.tier("sword")];   // Hand, Holz, Stein, Eisen (Schleim hat 4 Leben)
      s.hp -= dmg; s.hurt = 0.3; p.atkCd = 0.35;
      const dir = s.x + s.w / 2 > p.x + p.w / 2 ? 1 : -1;
      s.vx = dir * 7; s.vy = -6;
      this.events.push({ t: "hit", x: s.x + s.w / 2, y: s.y });
      if (s.hp <= 0) { this.slimes.splice(this.slimes.indexOf(s), 1); this.stats.kills++; this.events.push({ t: "kill", x: s.x + s.w / 2, y: s.y + s.h / 2 }); }
      return true;
    }
    return false;
  }

  // ---------- Physik ----------
  _hit(b) {
    const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6), y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (BLOCKS[this.tile(x, y)].solid) return true;
    return false;
  }
  _moveX(b, dx) {
    b.x = clamp(b.x + dx, 0, W - b.w);
    if (!this._hit(b)) return;
    if (b.stepUp && b.onGround && dx !== 0) {
      const y0 = b.y; b.y -= 1;
      if (!this._hit(b)) { b.visOff = (b.visOff || 0) + 1; return; }
      b.y = y0;
    }
    if (dx > 0) b.x = Math.floor(b.x + b.w - 1e-6) - b.w - 1e-4; else b.x = Math.floor(b.x) + 1 + 1e-4;
    b.x = clamp(b.x, 0, W - b.w);
    b.vx = 0; b.blocked = true;
  }
  _moveY(b, dy) {
    b.y = clamp(b.y + dy, 0, H - b.h);
    b.landV = 0;
    if (this._hit(b)) {
      if (dy > 0) { b.y = Math.floor(b.y + b.h - 1e-6) - b.h - 1e-4; b.landV = b.vy; b.onGround = true; }
      else { b.y = Math.floor(b.y) + 1 + 1e-4; }
      b.vy = 0;
    } else if (dy > 0.0001) b.onGround = false;
  }
  _body(b, dt, grav = 42) {
    b.blocked = false;
    b.vy = Math.min(b.vy + grav * dt, 32);
    this._moveX(b, b.vx * dt);
    this._moveY(b, b.vy * dt);
    if (b.visOff > 0) b.visOff = Math.max(0, b.visOff - 9 * dt);
  }

  update(dtIn) {
    let dt = Math.min(dtIn, 0.1);
    while (dt > 1e-6) { const s = Math.min(dt, 1 / 60); this._step(s); dt -= s; }
    if (this.lightDirty) this.relight();
  }
  _step(dt) {
    this.time += dt / DAY_LEN;
    if (this.time >= 1) { this.time -= 1; this.day++; this.events.push({ t: "day", day: this.day }); }
    this._player(dt);
    for (const v of this.villagers) this._villager(v, dt);
    for (const s of [...this.slimes]) this._slime(s, dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.5; this._trySpawn(); }
  }
  _player(dt) {
    const p = this.player, inp = this.input;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const acc = (p.onGround ? 70 : 34) * dt;
    p.vx += clamp(dir * 6.2 - p.vx, -acc, acc);
    if (dir) p.face = dir;
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.jumpBuf = inp.jump ? 0.12 : p.jumpBuf - dt;
    p.invuln = Math.max(0, p.invuln - dt); p.atkCd = Math.max(0, p.atkCd - dt);
    if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -15; p.coyote = 0; p.jumpBuf = 0; p.onGround = false; this.events.push({ t: "jump" }); }
    if (!inp.jump && p.vy < -5) p.vy += 60 * dt;                  // kurz tippen = kleiner Sprung
    this._body(p, dt);
    if (p.landV > 21) this.hurt(Math.ceil((p.landV - 21) / 3), 0, "fall");
    if (p.hp < p.maxHp && p.invuln <= 0) { p.regen = (p.regen || 0) + dt; if (p.regen > 6) { p.regen = 0; p.hp++; } }
    for (const s of this.slimes) if (s.hurt <= 0 && p.x < s.x + s.w && p.x + p.w > s.x && p.y < s.y + s.h && p.y + p.h > s.y) this.hurt(1, s.x + s.w / 2 > p.x + p.w / 2 ? -1 : 1, "slime");
  }
  hurt(n, dir, why) {
    const p = this.player;
    if (p.invuln > 0 || n <= 0) return;
    p.hp -= n; p.invuln = 1; p.regen = 0;
    if (dir) { p.vx = dir * 7; p.vy = -7; }
    this.events.push({ t: "hurt", n, why });
    if (p.hp <= 0) {
      this.events.push({ t: "died" });
      p.hp = p.maxHp; p.x = SPAWN_X - 6.4; p.y = SURF - 1.8 - 0.001; p.vx = p.vy = 0; p.invuln = 2;
      this.slimes.length = 0;
    }
  }
  _villager(v, dt) {
    v.t -= dt; v.sayT = Math.max(0, v.sayT - dt); v.cool -= dt;
    if (v.t <= 0) {
      if (v.dir !== 0 || this.rng() < 0.3) { v.dir = 0; v.t = 1 + this.rng() * 3; }
      else { v.dir = this.rng() < 0.5 ? -1 : 1; v.t = 1 + this.rng() * 2.5; }
    }
    if (v.x > v.home + 9) v.dir = -1; else if (v.x < v.home - 9) v.dir = 1;
    if (v.dir) v.face = v.dir;
    v.vx = v.dir * 1.6;
    this._body(v, dt);
    const p = this.player;
    if (v.cool <= 0 && Math.abs(v.x - p.x) < 4 && Math.abs(v.y - p.y) < 3) {
      v.say = LINES[Math.floor(this.rng() * LINES.length)]; v.sayT = 4; v.cool = 14 + this.rng() * 10; v.dir = 0; v.t = 3;
      v.face = p.x > v.x ? 1 : -1;
    }
  }
  _slime(s, dt) {
    s.hurt = Math.max(0, (s.hurt || 0) - dt); s.hopT -= dt;
    const p = this.player, near = Math.hypot(p.x - s.x, p.y - s.y) < 22;
    if (s.onGround && s.hopT <= 0) {
      s.hopT = 0.9 + this.rng() * 0.8;
      const dir = near ? (p.x > s.x ? 1 : -1) : (this.rng() < 0.5 ? -1 : 1);
      s.vx = dir * (near ? 4.2 : 2); s.vy = -9; s.onGround = false;
    }
    if (s.onGround) s.vx *= 0.8;
    this._body(s, dt);
    if (Math.hypot(p.x - s.x, p.y - s.y) > 60 || s.y > H) this.slimes.splice(this.slimes.indexOf(s), 1);
  }
  _trySpawn() {
    if (this.slimes.length >= 6) return;
    const p = this.player, side = this.rng() < 0.5 ? -1 : 1;
    const x = Math.floor(p.x + side * (14 + this.rng() * 14));
    if (x < 2 || x >= W - 2) return;
    const y0 = Math.max(2, Math.floor(p.y) - 12), y1 = Math.min(H - 4, Math.floor(p.y) + 14);
    for (let y = y0; y < y1; y++) {
      if (this.tile(x, y) === B.AIR && this.tile(x, y - 1) === B.AIR && BLOCKS[this.tile(x, y + 1)].solid) {
        if (Math.abs(x - SPAWN_X) < 26 && y < SURF + 2) return;     // im Dorf bleibt es friedlich
        if (this.lightAt(x, y) >= 5) return;
        this.slimes.push({ x: x + 0.05, y: y + 0.3, w: 0.9, h: 0.7, vx: 0, vy: 0, onGround: false, hp: 4, hopT: 0.5 + this.rng(), hurt: 0, stepUp: false });
        return;
      }
    }
  }
}
