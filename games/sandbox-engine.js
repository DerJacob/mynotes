// =====================================================================
// Blockdorf – Regeln und Welt (ohne Oberfläche, ohne Uhr; update(dt) treibt alles an → testbar)
//   Welt:      512 × 192 Blöcke, aus einer Zahl (seed) erzeugt: Hügel, Höhlen, Erze, Bäume, Sand, Dorf
//   Licht:     Himmelslicht + Fackellicht, weich ausgebreitet (wie bei Terraria)
//   Physik:    Spieler, Dorfbewohner, Schleime (Rechteck-Kollision, Stufen werden automatisch genommen)
//   Handwerk:  Abbauen mit Werkzeug-Stufen, Bauen, Rezepte, Werkbank
//   Speichern: Blöcke als Lauflängen (Base64) – klein genug für den Spielstand im Drive
// =====================================================================

import { B, BLOCKS, ITEMS, RECIPES, MATERIALS, SMELT, SMELT_TIME, hasTag, stackMax, ARMOR_SLOTS } from "./sandbox-data.js?v=2";
import { installInventory } from "./sandbox-inventory.js?v=2";
export { B, BLOCKS, ITEMS, RECIPES, MATERIALS, SMELT, SMELT_TIME, hasTag, stackMax, ARMOR_SLOTS };

export const W = 512, H = 192, SURF = 60, SPAWN_X = W >> 1;
export const DAY_LEN = 420;            // Sekunden pro Tag
export const REACH = 5.5;              // wie weit der Spieler Blöcke erreicht (in Blöcken)
export const MAX_HP = 20;              // in halben Herzen, wie Minecraft
export const SAVE_VERSION = 2;

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
    vein(B.DIAMOND, 70, 88, [1, 4]);
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
    this.spawn = { x: SPAWN_X - 6.4, y: SURF - 1.8 - 0.001 };
    this.player = { x: this.spawn.x, y: this.spawn.y, w: 0.8, h: 1.8, vx: 0, vy: 0, onGround: false, face: 1, hp: MAX_HP, maxHp: MAX_HP, invuln: 0, coyote: 0, jumpBuf: 0, atkCd: 0, visOff: 0, stepUp: true };
    this._resetInventory();
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
    const p = this.player, pk = st => (st ? [st.id, st.n, st.d || 0] : 0);
    return {
      v: SAVE_VERSION, seed: this.seed, tiles: encodeTiles(this.tiles), ground: Array.from(this.ground),
      p: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), hp: p.hp, food: this.food, sat: +this.sat.toFixed(1), exh: +this.exh.toFixed(2) },
      inv: this.inv.map(pk), armor: this.armor.map(pk), sel: this.sel, xp: this.xp,
      ents: [...this.ents.entries()].map(([k, e]) => { const [x, y] = k.split(",").map(Number); return { x, y, t: e.t, s: e.s.map(pk), burn: e.burn, burnMax: e.burnMax, cook: e.cook, xp: e.xp }; }),
      drops: this.drops.slice(-120).map(d => [d.id, d.n, d.d || 0, +d.x.toFixed(2), +d.y.toFixed(2)]),
      spawn: { x: +this.spawn.x.toFixed(2), y: +this.spawn.y.toFixed(2) },
      time: +this.time.toFixed(4), day: this.day, stats: { ...this.stats }
    };
  }
  _fromData(d) {
    if (!d || (d.v !== 1 && d.v !== 2) || typeof d.tiles !== "string") throw new Error("Unbekanntes Welt-Format");
    this.seed = d.seed | 0;
    this.tiles = decodeTiles(d.tiles);
    this.ground = Int16Array.from(d.ground && d.ground.length === W ? d.ground : new Array(W).fill(SURF));
    this._fresh();
    const p = this.player, legacy = d.v === 1;
    if (d.p && Number.isFinite(d.p.x) && Number.isFinite(d.p.y)) {
      p.x = clamp(d.p.x, 0, W - p.w); p.y = clamp(d.p.y, 0, H - p.h);
      p.hp = clamp((d.p.hp | 0) * (legacy ? 2 : 1), 1, p.maxHp);
      if (!legacy) { this.food = clamp(d.p.food | 0, 0, 20); this.sat = clamp(+d.p.sat || 0, 0, 20); this.exh = clamp(+d.p.exh || 0, 0, 4); }
    }
    const un = a => (Array.isArray(a) && ITEMS[a[0]] ? { id: a[0], n: clamp(a[1] | 0, 1, stackMax(a[0])), d: a[2] | 0 } : null);
    if (legacy) {
      // alter Spielstand: Gegenstände als Zahlen pro Sorte → in die Plätze einsortieren
      const map = { iron: "raw_iron", gold: "raw_gold" };
      this.inv = this._emptyInv();
      if (d.inv && typeof d.inv === "object") for (const [k0, v] of Object.entries(d.inv)) { const k = map[k0] || k0; if (ITEMS[k] && v > 0) this.add(k, Math.min(9999, v | 0), 0, true); }
      this.events.length = 0;
    } else {
      if (Array.isArray(d.inv)) this.inv = this._emptyInv().map((_, i) => un(d.inv[i]));
      if (Array.isArray(d.armor)) this.armor = [0, 1, 2, 3].map(i => un(d.armor[i]));
      this.xp = Math.max(0, d.xp | 0);
      for (const e of d.ents || []) {
        if (!(e.t === "chest" || e.t === "furnace") || !Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
        const n = e.t === "chest" ? 27 : 3;
        this.ents.set(`${e.x},${e.y}`, { t: e.t, s: Array.from({ length: n }, (_, i) => un((e.s || [])[i])), burn: +e.burn || 0, burnMax: +e.burnMax || 0, cook: +e.cook || 0, xp: +e.xp || 0 });
      }
      for (const a of d.drops || []) if (ITEMS[a[0]]) this.drops.push({ id: a[0], n: clamp(a[1] | 0, 1, stackMax(a[0])), d: a[2] | 0, x: +a[3], y: +a[4], vx: 0, vy: 0, w: 0.3, h: 0.3, age: 1, stepUp: false });
      if (d.spawn && Number.isFinite(d.spawn.x)) this.spawn = { x: d.spawn.x, y: d.spawn.y };
    }
    this.sel = clamp(d.sel | 0, 0, 8);
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

  // Inventar, Handwerk, Abbauen, Bauen, Kampf, Ofen, Truhen: siehe sandbox-inventory.js

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
    this._hunger(dt);
    for (const v of this.villagers) this._villager(v, dt);
    for (const s of [...this.slimes]) this._slime(s, dt);
    this._drops(dt);
    this._furnaces(dt);
    this._decayStep(dt);
    this._windowCheck();
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 1.5; this._trySpawn(); }
  }
  _player(dt) {
    const p = this.player, inp = this.input;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const acc = (p.onGround ? 70 : 34) * dt;
    const onLadder = BLOCKS[this.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h * 0.5))].climb || BLOCKS[this.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h - 0.1))].climb;
    p.onLadder = onLadder;
    p.vx += clamp(dir * (onLadder ? 3.2 : 6.2) - p.vx, -acc, acc);
    if (dir) p.face = dir;
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.jumpBuf = inp.jump ? 0.12 : p.jumpBuf - dt;
    p.invuln = Math.max(0, p.invuln - dt); p.atkCd = Math.max(0, p.atkCd - dt);
    if (onLadder) {
      p.vy = inp.jump ? -4.5 : inp.down ? 4.5 : 0; p.coyote = 0; p.jumpBuf = 0;
    } else if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -15; p.coyote = 0; p.jumpBuf = 0; p.onGround = false; this.events.push({ t: "jump" }); this.addExh(0.05); }
    if (!inp.jump && p.vy < -5 && !onLadder) p.vy += 60 * dt;     // kurz tippen = kleiner Sprung
    const wasFalling = p.vy;
    this._body(p, dt, onLadder ? 0 : 42);
    if (onLadder) { p.landV = 0; if (p.vy > 4.6) p.vy = 4.6; }
    if (p.landV > 0) { const dist = (p.landV * p.landV) / 84; if (dist > 3.2) this.hurt(Math.ceil(dist - 3), 0, "fall"); }
    if (Math.abs(p.vx) > 0.5 && p.onGround) this.addExh(Math.abs(p.vx) * dt * 0.012);
    for (const s of this.slimes) if (s.hurt <= 0 && p.x < s.x + s.w && p.x + p.w > s.x && p.y < s.y + s.h && p.y + p.h > s.y) this.hurt(3, s.x + s.w / 2 > p.x + p.w / 2 ? -1 : 1, "slime");
  }
  hurt(n, dir, why) {
    const p = this.player;
    if (n <= 0 || (p.invuln > 0 && why !== "hunger")) return;
    if (why === "slime") {
      const def = this.defense();
      n = Math.max(1, Math.round(n * (1 - Math.min(20, def) * 0.04)));
      for (let i = 0; i < 4; i++) this.wearArmor(i);
    }
    p.hp -= n; if (why !== "hunger") p.invuln = 1;
    this.regenT = 0;
    if (dir) { p.vx = dir * 7; p.vy = -7; }
    this.addExh(0.1);
    this.events.push({ t: "hurt", n, why });
    if (p.hp <= 0) this._die();
  }
  _die() {
    const p = this.player;
    this.events.push({ t: "died" });
    // wie Minecraft: alles fällt an der Todesstelle
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const all = [...this.inv, ...this.armor, this.cursor];
    for (const st of all) if (st) this.dropStack(st, cx, cy, true);
    this.inv = this._emptyInv(); this.armor = [null, null, null, null]; this.cursor = null; this.grid.fill(null); this.win = null;
    this.xp = 0; this.food = 20; this.sat = 5; this.exh = 0;
    p.hp = p.maxHp; p.x = this.spawn.x; p.y = this.spawn.y; p.vx = p.vy = 0; p.invuln = 2;
    this.slimes.length = 0;
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
        this.slimes.push({ x: x + 0.05, y: y + 0.3, w: 0.9, h: 0.7, vx: 0, vy: 0, onGround: false, hp: 10, hopT: 0.5 + this.rng(), hurt: 0, stepUp: false });
        return;
      }
    }
  }
}

installInventory(Sandbox, { clamp, REACH, MAX_HP, W, H, SURF, SPAWN_X });
