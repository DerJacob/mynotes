// =====================================================================
// Blockdorf – Regeln und Welt (ohne Oberfläche, ohne Uhr; update(dt) treibt alles an → testbar)
//   Welt:      512 × 192 Blöcke, aus einer Zahl (seed) erzeugt: Hügel, Höhlen, Erze, Bäume, Sand, Dorf
//   Licht:     Himmelslicht + Fackellicht, weich ausgebreitet (wie bei Terraria)
//   Physik:    Spieler, Dorfbewohner, Tiere und Monster (Rechteck-Kollision, Stufen werden automatisch genommen)
//   Handwerk:  Abbauen mit Werkzeug-Stufen, Bauen, Rezepte, Werkbank
//   Speichern: Blöcke als Lauflängen (Base64) – klein genug für den Spielstand im Drive
// =====================================================================

import { B, BLOCKS, ITEMS, RECIPES, MATERIALS, SMELT, SMELT_TIME, hasTag, stackMax, ARMOR_SLOTS, isFluid, boxesOf } from "./sandbox-data.js?v=10";
import { installInventory } from "./sandbox-inventory.js?v=10";
import { installFluids, SRC } from "./sandbox-fluids.js?v=10";
import { installMobs } from "./sandbox-mobs.js?v=10";
import { installFarm } from "./sandbox-farm.js?v=10";
import { installRedstone } from "./sandbox-redstone.js?v=10";
import { installBrew, ENCH } from "./sandbox-brew.js?v=10";
import { generateWorld, BIOMES, BIOME_NAMES } from "./sandbox-world.js?v=10";
import { addContent6 } from "./sandbox-world6.js?v=10";
import { addContent8 } from "./sandbox-world8.js?v=10";
import { addContent9 } from "./sandbox-world9.js?v=10";
import { addContent11 } from "./sandbox-world11.js?v=10";
import { addContent12 } from "./sandbox-world12.js?v=10";
import { migrateData } from "./sandbox-migrate.js?v=10";
import { installWiden } from "./sandbox-widen.js?v=10";
import { installDims } from "./sandbox-dims.js?v=10";
import { installBoss } from "./sandbox-boss.js?v=10";
import { installVillagers } from "./sandbox-vill.js?v=10";
import { installPolish } from "./sandbox-polish.js?v=10";
import { installFlora } from "./sandbox-flora.js?v=10";
import { installCraft9 } from "./sandbox-craft9.js?v=10";
import { installCombat10 } from "./sandbox-combat10.js?v=10";
import { installOcean } from "./sandbox-ocean11.js?v=10";
import { installSeaMobs } from "./sandbox-seamobs11.js?v=10";
import { installFauna } from "./sandbox-fauna12.js?v=10";
export { MODES, WEATHER_NAMES, MOON_NAMES, MOON_FULL, findItem, findMob } from "./sandbox-polish.js?v=10";
import { NETHER_BIOMES, placeStronghold } from "./sandbox-nether.js?v=10";
export { BIOMES, BIOME_NAMES };
export { B, BLOCKS, ITEMS, RECIPES, MATERIALS, SMELT, SMELT_TIME, hasTag, stackMax, ARMOR_SLOTS };

import { W, H, SURF, SPAWN_X, OLD_H } from "./sandbox-const.js?v=10";
export { W, H, SURF, SPAWN_X };
export const DAY_LEN = 420;            // Sekunden pro Tag
export const REACH = 5.5;              // wie weit der Spieler Blöcke erreicht (in Blöcken)
export const MAX_HP = 20;              // in halben Herzen, wie Minecraft
export const SAVE_VERSION = 14;

import { mulberry32, hash2, vnoise, fbm, smooth, clamp } from "./sandbox-noise.js?v=10";
export { mulberry32 };
export { MOBS, ADV } from "./sandbox-mobs.js?v=10";
export { ENCH, ROMAN, POTION_KINDS, POTION_FX, EFFECT_NAMES, EFFECT_BAD, stackName, stackLines, enchLines, potionKind, potionMod, potionCode, potionColor, brewResult, BREW_TIME } from "./sandbox-brew.js?v=10";

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
export function decodeTiles(str, len = W * H) {
  const bin = atob(str);
  const tiles = new Uint8Array(len);
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
  "Willkommen im Dorf!", "Nachts treiben sich Zombies und Creeper herum – am besten ein Bett in der Nähe.", "Tief unten gibt es Eisen – und sogar Gold.",
  "Fackeln halten die Dunkelheit fern.", "Mit einer Werkbank wird alles besser.", "Schönes Wetter heute!", "Hast du schon die Höhlen erkundet?", "Mit einem Knochen kannst du einen Wolf zähmen.",
  "Für Eisen brauchst du eine Steinspitzhacke."
];

// =====================================================================
const FULL = [0, 0, 1, 1], STEPS = [0.5, 1];
export class Sandbox {
  /** opts.seed: neue Welt · opts.data: gespeicherte Welt (Ergebnis von toData) */
  constructor(opts = {}) {
    this.events = [];
    this.input = { left: false, right: false, jump: false };
    this.mining = null;
    this.lightDirty = true;
    this._dimInit();
    if (opts.data) { opts = { ...opts, data: migrateData(opts.data, { encodeTiles, decodeTiles }) }; this._fromData(opts.data); }
    else { this.seed = (opts.seed ?? (Math.random() * 2147483647)) | 0; this._generate(); this._fresh(); this._stockChests(); }
    this._fluidInit();
    this.rng = mulberry32((this.seed ^ 0x51ed) + Math.floor(this.time * 1000));
    this.sky = new Uint8Array(W * H);
    this.blk = new Uint8Array(W * H);
    this.spawnT = 2;
    this._mobInit();
    this._farmInit(); this._floraInit(); this._brewInit(); this._craft9Init();
    if (opts.data && opts.data.v >= 4) this._mobsFromData(opts.data.mobs); else this._populate();
    this._rsInit();
    if (opts.data) { this._ensureStronghold(); this._restoreDim(opts.data); }
    this.relight();
  }

  // ---------- Zugriff ----------
  tile(x, y) { return x < 0 || x >= W || y < 0 || y >= H ? (y < 0 ? B.AIR : B.BEDROCK) : this.tiles[y * W + x]; }
  solidAt(x, y) { return BLOCKS[this.tile(Math.floor(x), Math.floor(y))].solid; }
  /** Licht muss neu berechnet werden: sonst überall (lightDirty = true), mit lightAt(x) nur rund um die Spalte x (Etappe 13: die Welt ist groß) */
  get lightDirty() { return this._ld; }
  set lightDirty(v) { this._ld = v; if (v) this._lfull = true; }
  lightAt2(x) {
    if (!this._ld) { this._ld = true; this._lfull = false; this._lx0 = this._lx1 = x; }
    else if (!this._lfull) { if (x < this._lx0) this._lx0 = x; if (x > this._lx1) this._lx1 = x; }
  }
  setTile(x, y, id) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const i = y * W + x;
    const old = this.tiles[i];
    this.tiles[i] = id; this.lvl[i] = 0; this.aux[i] = 0; this.lightAt2(x);
    if (this.rs) this._rsTouch(x, y, old, id);
    this._fluidWake(x, y);
  }

  // ---------- Welt erzeugen ----------
  /** Die ganze Welt dieser Zahl (seed), noch ohne Festung */
  _genFull() { return addContent12(addContent11(addContent9(addContent8(addContent6(generateWorld(this.seed), this.seed), this.seed), this.seed), this.seed), this.seed); }
  _generate() {
    const w = this._genFull();
    this.tiles = w.tiles; this.lvl = w.lvl; this.aux = w.aux; this.structs = w.structs; this.ground = w.ground; this.biomes = w.biomes; this.villages = w.villages;
    this._worldChests = w.chests;
    const sh = placeStronghold(this.seed, this.tiles, this.lvl, this.aux, SPAWN_X, SURF);   // Festung mit Endportal tief unter der Erde
    if (sh) { this.strongholds = [{ x: sh.x, y: sh.y }]; this._worldChests.push(...sh.chests); }
  }
  /** Truhen der Bauwerke (Dörfer, Verliese, Schächte) mit Beute füllen */
  _stockChests(ents = this.ents, list = this._worldChests) {
    if (!this.frng) this._farmInit();
    for (const c of list || []) {
      const s = new Array(27).fill(null);
      c.items.forEach((it, k) => { if (ITEMS[it.id]) s[k * 3 % 27] = it.id === "enchanted_book" ? this._randomBook(12 + Math.floor(this.frng() * 16)) : { id: it.id, n: it.n, d: it.d | 0 }; });
      ents.set(`${c.x},${c.y}`, { t: "chest", s });
    }
    if (list === this._worldChests) this._worldChests = null;
  }
  biomeAt(x) {
    const i = clamp(Math.floor(x), 0, W - 1);
    if (this.dim === 1) return NETHER_BIOMES[this.biomes[i]] || "nether";
    if (this.dim === 2) return "end";
    return BIOMES[this.biomes[i]] || "plains";
  }
  _fresh() {
    this.time = 0.3; this.day = 1;
    this.stats = { mined: 0, built: 0, kills: 0 };
    this.adv = {}; this.bed = null;
    this.spawn = { x: SPAWN_X - 6.4, y: SURF - 1.8 - 0.001 };
    this.player = { air: 15, burn: 0, x: this.spawn.x, y: this.spawn.y, w: 0.8, h: 1.8, vx: 0, vy: 0, onGround: false, face: 1, hp: MAX_HP, maxHp: MAX_HP, invuln: 0, coyote: 0, jumpBuf: 0, atkCd: 0, visOff: 0, stepUp: true };
    this._resetInventory();
    this._entities();
  }
  _entities() {
    this.mobs = [];
    this.villagers = [-17, 0, 16].map((dx, i) => ({
      x: SPAWN_X + dx + 1.6, y: SURF - 1.7 - 0.001, w: 0.7, h: 1.7, vx: 0, vy: 0, onGround: false, face: 1,
      home: SPAWN_X + dx + 3, t: 1 + i, dir: 0, say: null, sayT: 0, cool: 3 + i * 2, look: i, stepUp: true, visOff: 0
    }));
  }

  // ---------- Speichern ----------
  toData() {
    const p = this.player, pk = st => this._packStack(st), ow = this._dimGet(0);          // oben steht immer die Oberwelt
    const data = {
      v: SAVE_VERSION, h: H, w: W, seed: this.seed, tiles: encodeTiles(ow.tiles), lvl: encodeTiles(ow.lvl), biomes: encodeTiles(ow.biomes), villages: ow.villages, ground: Array.from(ow.ground),
      p: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), hp: p.hp, food: this.food, sat: +this.sat.toFixed(1), exh: +this.exh.toFixed(2) },
      inv: this.inv.map(pk), armor: this.armor.map(pk), sel: this.sel, xp: this.xp,
      ents: this._entsToData(ow.ents),
      drops: this._dropsToData(ow.drops),
      spawn: { x: +this.spawn.x.toFixed(2), y: +this.spawn.y.toFixed(2) },
      time: +this.time.toFixed(4), day: this.day, stats: { ...this.stats },
      mobs: this._mobsToData(ow.mobs), adv: { ...this.adv }, bed: this.bed ? { ...this.bed } : null,
      aux: encodeTiles(ow.aux), fx: Object.fromEntries(Object.entries(this.fx).map(([k, f]) => [k, [+f.t.toFixed(1), f.amp]])), es: this.enchSeed
    };
    Object.assign(data, this._villSave(), this._polishSave(), this._c10Save(), this._oceanSave(), this._faunaSave());
    this._saveDims(data);
    return data;
  }
  _fromData(d) {
    if (!d || !(d.v >= 1 && d.v <= SAVE_VERSION) || typeof d.tiles !== "string") throw new Error("Unbekanntes Welt-Format");
    this.seed = d.seed | 0;
    this.tiles = decodeTiles(d.tiles);
    this.aux = new Uint8Array(W * H);
    if (d.v >= 5 && typeof d.aux === "string") { try { this.aux = decodeTiles(d.aux); } catch (e) { /* Zusatzdaten beschädigt: Pflanzen und Redstone beginnen neu */ } }
    this.ground = Int16Array.from(d.ground && d.ground.length === W ? d.ground : new Array(W).fill(SURF));
    this.lvl = new Uint8Array(W * H); this.biomes = new Uint8Array(W); this.villages = [];
    if (d.v >= 3) {
      try { this.lvl = decodeTiles(d.lvl); this.biomes = decodeTiles(d.biomes, W); } catch (e) { /* Zusatzdaten beschädigt: Welt bleibt spielbar */ }
      this.villages = Array.isArray(d.villages) ? d.villages.filter(v => v && Number.isFinite(v.x)) : [];
    } else this.villages = [{ x: SPAWN_X, y: SURF, style: "oak" }];
    if (d.pad > 0 && d.pad < W) this._padFill(d.pad | 0);                // alte Welt: rechts neues Gelände (Etappe 13)
    if (d.v >= 3) for (let i = 0; i < W * H; i++) if (this.tiles[i] === B.WATER || this.tiles[i] === B.LAVA) { if (!this.lvl[i]) this.lvl[i] = SRC; } else this.lvl[i] = 0;
    this._fresh();
    const p = this.player, legacy = d.v === 1;
    if (d.p && Number.isFinite(d.p.x) && Number.isFinite(d.p.y)) {
      p.x = clamp(d.p.x, 0, W - p.w); p.y = clamp(d.p.y, 0, H - p.h);
      p.hp = clamp((d.p.hp | 0) * (legacy ? 2 : 1), 1, p.maxHp);
      if (!legacy) { this.food = clamp(d.p.food | 0, 0, 20); this.sat = clamp(+d.p.sat || 0, 0, 20); this.exh = clamp(+d.p.exh || 0, 0, 4); }
    }
    const un = a => this._unpackStack(a);
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
      for (const [k, e] of this._entsFromData(d.ents)) this.ents.set(k, e);
      for (const a of this._dropsFromData(d.drops)) this.drops.push(a);
      if (d.spawn && Number.isFinite(d.spawn.x)) this.spawn = { x: d.spawn.x, y: d.spawn.y };
    }
    this.fx = {};
    if (d.fx && typeof d.fx === "object") for (const [k, f] of Object.entries(d.fx)) if (Array.isArray(f) && f[0] > 0) this.fx[k] = { t: +f[0], amp: f[1] | 0 };
    if (Number.isFinite(d.es)) this.enchSeed = d.es >>> 0;
    if (d.adv && typeof d.adv === "object") for (const k of Object.keys(d.adv)) if (d.adv[k]) this.adv[k] = 1;
    if (d.bed && Number.isFinite(d.bed.x) && Number.isFinite(d.bed.y)) this.bed = { x: d.bed.x | 0, y: d.bed.y | 0 };
    this.sel = clamp(d.sel | 0, 0, 8);
    this.time = Number.isFinite(d.time) ? d.time % 1 : 0.3;
    this.day = Math.max(1, d.day | 0);
    if (d.stats) this.stats = { mined: d.stats.mined | 0, built: d.stats.built | 0, kills: d.stats.kills | 0 };
    if (Array.isArray(d.strongholds)) this.strongholds = d.strongholds.filter(s => s && Number.isFinite(s.x) && Number.isFinite(s.y)).map(s => ({ x: s.x | 0, y: s.y | 0 }));
    if (d.flags && typeof d.flags === "object") this.flags.dragonDead = !!d.flags.dragonDead;
    this._villLoad(d);
    this._padAfter();
    this._polishLoad(d);
    this._c10Load(d);
    this._oceanLoad(d);
    this._faunaLoad(d);
    // Falls der Spielstand im Boden steckt (beschädigt), zurück ins Dorf (steht der Spieler im Nether/Ende, prüft _restoreDim das)
    if (!d.dim && this._hit(p)) { p.x = SPAWN_X - 6.4; p.y = SURF - 1.8 - 0.001; }
  }

  // ---------- Licht ----------
  dayFactor() { return clamp(0.5 + 0.7 * Math.sin(2 * Math.PI * (this.time - 0.25)), 0.06, 1); }
  /** 0 … 15: wie hell ist es an diesem Block gerade? */
  lightAt(x, y) {
    if (x < 0 || x >= W || y < 0 || y >= H) return 0;
    const i = y * W + x;
    return Math.max(this.sky[i] * this.dayFactor(), this.blk[i], this.ambient);
  }
  /** Licht neu berechnen. Ohne Angabe überall; mit lo…hi nur die Spalten, deren Licht sich geändert haben kann (Licht reicht höchstens 15 Spalten weit) */
  relight(lo = 0, hi = W - 1) {
    this._ld = false; this._lfull = true;
    const full = lo <= 0 && hi >= W - 1;
    if (!full) { lo = Math.max(0, lo - 15); hi = Math.min(W - 1, hi + 15); }                    // so weit kann sich das Licht ändern
    const a = full ? 0 : Math.max(0, lo - 16), b = full ? W - 1 : Math.min(W - 1, hi + 16);     // so weit wird gerechnet (Licht von außerhalb reicht nicht mehr hinein)
    const tiles = this.tiles, sky = this.sky, blk = this.blk;
    // Ränder (Spalten a … lo−1 und hi+1 … b) behalten ihr altes Licht: dort fehlen die Lichtquellen von außerhalb
    let keep = null;
    if (!full) {
      keep = [];
      for (const [c0, c1] of [[a, lo - 1], [hi + 1, b]]) for (let x = c0; x <= c1; x++) { const col = new Uint8Array(2 * H); for (let y = 0; y < H; y++) { col[y] = sky[y * W + x]; col[H + y] = blk[y * W + x]; } keep.push([x, col]); }
      for (let y = 0; y < H; y++) { sky.fill(0, y * W + a, y * W + b + 1); blk.fill(0, y * W + a, y * W + b + 1); }
    } else { sky.fill(0); blk.fill(0); }
    const bs = Array.from({ length: 16 }, () => []);
    // Himmelslicht: in jeder Spalte von oben bis zum ersten Block, der Licht schluckt
    if (!this.noSky) for (let x = a; x <= b; x++) for (let y = 0; y < H && BLOCKS[tiles[y * W + x]].lcost === 0; y++) { sky[y * W + x] = 15; bs[15].push(y * W + x); }
    this._spread(sky, bs, a, b);
    const bb = Array.from({ length: 16 }, () => []);
    const aux = this.aux;
    for (let y = 0; y < H; y++) for (let x = a; x <= b; x++) { const i = y * W + x, t = tiles[i]; let e = BLOCKS[t].emit; if (!e && t === B.WATER && aux[i] >= 4 && aux[i] < 8) e = 3 * (aux[i] - 2); if (e) { blk[i] = e; bb[e].push(i); } }
    this._spread(blk, bb, a, b);
    if (keep) for (const [x, col] of keep) for (let y = 0; y < H; y++) { sky[y * W + x] = col[y]; blk[y * W + x] = col[H + y]; }
  }
  _spread(light, buckets, a = 0, b = W - 1) {
    const tiles = this.tiles;
    for (let L = 15; L >= 2; L--) {
      const list = buckets[L];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        if (light[i] !== L) continue;
        const nl = L - 1 - BLOCKS[tiles[i]].lcost;
        if (nl <= 0) continue;
        const x = i % W, y = (i / W) | 0;
        if (x > a && light[i - 1] < nl) { light[i - 1] = nl; buckets[nl].push(i - 1); }
        if (x < b && light[i + 1] < nl) { light[i + 1] = nl; buckets[nl].push(i + 1); }
        if (y > 0 && light[i - W] < nl) { light[i - W] = nl; buckets[nl].push(i - W); }
        if (y < H - 1 && light[i + W] < nl) { light[i + W] = nl; buckets[nl].push(i + W); }
      }
    }
  }

  // Inventar, Handwerk, Abbauen, Bauen, Kampf, Ofen, Truhen: siehe sandbox-inventory.js

  // ---------- Physik ----------
  /** Kästen (Teilblöcke) im Weg des Körpers: ruft cb(tileX, tileY, kasten) für jeden überlappenden Kasten auf */
  _boxesHit(b, cb) {
    const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6), y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = this.tile(x, y), bd = BLOCKS[t];
      if (!bd.solid) continue;
      if (!bd.shape) { if (cb(x, y, FULL) === true) return true; continue; }
      for (const k of boxesOf(t, this.aux[y * W + x])) {
        if (b.x + b.w - 1e-6 > x + k[0] && b.x < x + k[2] && b.y + b.h - 1e-6 > y + k[1] && b.y < y + k[3] && cb(x, y, k) === true) return true;
      }
    }
    return false;
  }
  _hit(b) {
    const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6), y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = this.tile(x, y), bd = BLOCKS[t];
      if (!bd.solid) continue;
      if (!bd.shape) return true;
      for (const k of boxesOf(t, this.aux[y * W + x])) if (b.x + b.w - 1e-6 > x + k[0] && b.x < x + k[2] && b.y + b.h - 1e-6 > y + k[1] && b.y < y + k[3]) return true;
    }
    return false;
  }
  _moveX(b, dx) {
    b.x = clamp(b.x + dx, 0, W - b.w);
    if (!this._hit(b)) return;
    if (b.stepUp && b.onGround && dx !== 0) {
      const y0 = b.y;
      for (const up of STEPS) { b.y = y0 - up; if (!this._hit(b)) { b.visOff = (b.visOff || 0) + up; return; } }
      b.y = y0;
    }
    if (dx > 0) { const c = Math.floor(b.x + b.w - 1e-6); let lim = Infinity; this._boxesHit(b, (x, y, k) => { if (x === c) lim = Math.min(lim, x + k[0]); }); b.x = (isFinite(lim) ? lim : Math.floor(b.x + b.w - 1e-6)) - b.w - 1e-4; }
    else { const c = Math.floor(b.x); let lim = -Infinity; this._boxesHit(b, (x, y, k) => { if (x === c) lim = Math.max(lim, x + k[2]); }); b.x = (isFinite(lim) ? lim : Math.floor(b.x) + 1) + 1e-4; }
    b.x = clamp(b.x, 0, W - b.w);
    b.vx = 0; b.blocked = true;
  }
  _moveY(b, dy) {
    b.y = clamp(b.y + dy, 0, H - b.h);
    b.landV = 0;
    if (this._hit(b)) {
      if (dy > 0) { const r = Math.floor(b.y + b.h - 1e-6); let lim = Infinity; this._boxesHit(b, (x, y, k) => { if (y === r) lim = Math.min(lim, y + k[1]); }); b.y = (isFinite(lim) ? lim : Math.floor(b.y + b.h - 1e-6)) - b.h - 1e-4; b.landV = b.vy; b.onGround = true; }
      else { const r = Math.floor(b.y); let lim = -Infinity; this._boxesHit(b, (x, y, k) => { if (y === r) lim = Math.max(lim, y + k[3]); }); b.y = (isFinite(lim) ? lim : Math.floor(b.y) + 1) + 1e-4; }
      b.vy = 0;
    } else if (dy > 0.0001) b.onGround = false;
  }
  _body(b, dt, grav = 42) {
    b.blocked = false;
    if (b !== this.player) {
      const f = this.fluidOf(b);
      if (f === B.WATER) { grav *= 0.25; b.vx *= Math.max(0, 1 - 3 * dt); b.inWater = true; if (b.vy > 3.5) b.vy = 3.5; }
      else if (f === B.LAVA) { grav *= 0.15; b.vx *= Math.max(0, 1 - 6 * dt); if (b.vy > 1.5) b.vy = 1.5; b.inLava = true; }
      else { b.inWater = b.inLava = false; }
    }
    b.vy = Math.min(b.vy + grav * dt, 32);
    this._moveX(b, b.vx * dt);
    this._moveY(b, b.vy * dt);
    if (b.visOff > 0) b.visOff = Math.max(0, b.visOff - 9 * dt);
  }

  update(dtIn) {
    let dt = Math.min(dtIn, 0.1);
    while (dt > 1e-6) { const s = Math.min(dt, 1 / 60); this._step(s); dt -= s; }
    if (this._ld) { if (this._lfull || this._lx1 - this._lx0 > 400) this.relight(); else this.relight(this._lx0, this._lx1); }
  }
  _step(dt) {
    this.time += dt / DAY_LEN;
    if (this.time >= 1) { this.time -= 1; this.day++; this.events.push({ t: "day", day: this.day }); }
    this._player(dt);
    this._dimPlayer(dt);
    this._hunger(dt);
    for (const v of this.villagers) this._villager(v, dt);
    this._mobs(dt);
    this._drops(dt);
    this._furnaces(dt);
    this._decayStep(dt);
    this._fluidStep(dt);
    this._oceanStep(dt);
    this._farmStep(dt);
    this._rsStep(dt);
    this._fxStep(dt);
    this._fishStep(dt);
    this._brewStep(dt);
    this._windowCheck();
  }
  _player(dt) {
    const p = this.player, inp = this.input;
    this._playerFluids(dt);
    const swim = p.inWater || p.inLava;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const gl = this._canGlide(); p.glide = gl;                       // Elytren: Sprungtaste im Fall halten
    const acc = (p.onGround ? 70 : gl ? 14 : 34) * dt;
    const onLadder = BLOCKS[this.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h * 0.5))].climb || BLOCKS[this.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h - 0.1))].climb;
    p.onLadder = onLadder;
    let spd = Math.max(0.3, 1 + 0.2 * this.fxAmp("speed") - 0.15 * this.fxAmp("slowness"));
    if (p.onGround && this.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h + 0.05)) === B.SOUL_SAND) spd *= 0.6;
    spd *= this._slowFactor(p);
    p.vx += clamp((gl ? (dir ? dir * 16 : p.vx) : dir * (onLadder ? 3.2 : p.inLava ? 2.2 : swim ? 3.8 * (this.swimMul || 1) : 6.2 * spd)) - p.vx, -acc, acc);
    if (dir) p.face = dir;
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.jumpBuf = inp.jump ? 0.12 : p.jumpBuf - dt;
    p.invuln = Math.max(0, p.invuln - dt); p.atkCd = Math.max(0, p.atkCd - dt);
    if (onLadder) {
      p.vy = inp.jump ? -4.5 : inp.down ? 4.5 : 0; p.coyote = 0; p.jumpBuf = 0;
    } else if (swim) {
      p.vy = clamp(p.vy + (inp.jump ? -34 : inp.down ? 14 : 0) * dt, -5, p.inLava ? 1.5 : 3.5); p.coyote = 0; p.jumpBuf = 0;
    } else if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = -15 * (1 + 0.12 * this.fxAmp("jump")); p.coyote = 0; p.jumpBuf = 0; p.onGround = false; this.events.push({ t: "jump" }); this.addExh(0.05); }
    if (!inp.jump && p.vy < -5 && !onLadder && !swim) p.vy += 60 * dt;     // kurz tippen = kleiner Sprung
    const wasFalling = p.vy;
    if (swim) p.vy = clamp(p.vy, -5, p.inLava ? 1.5 : 3.5);
    this._body(p, dt, gl ? 6 : onLadder ? 0 : swim ? 9 : 42);
    if (gl && p.vy > 4.2) p.vy = 4.2;
    if (swim) p.vy *= Math.max(0, 1 - 2 * dt);
    if (onLadder) { p.landV = 0; if (p.vy > 4.6) p.vy = 4.6; }
    if (p.landV > 0 && !swim) { const dist = (p.landV * p.landV) / 84; if (dist > 3.2) {
      const ff = this.armor[3] && this.armor[3].e ? this.armor[3].e.feather_falling | 0 : 0;
      const n = this.fx.slow_fall || p.glideT > 0 ? 0 : Math.ceil(Math.ceil(dist - 3) * (1 - 0.12 * ff));
      if (n > 0) this.hurt(n, 0, "fall");
    } }
    if (Math.abs(p.vx) > 0.5 && p.onGround) this.addExh(Math.abs(p.vx) * dt * 0.012);
    this._blockCheck();
  }
  hurt(n, dir, why) {
    const p = this.player;
    const env = why === "hunger" || why === "drown" || why === "lava" || why === "fire" || why === "cactus" || why === "magic" || why === "poison" || why === "wither" || why === "void" || why === "magma";
    if ((why === "lava" || why === "fire") && this.fx.fire_resistance) return;
    if (n <= 0 || (p.invuln > 0 && !env)) return;
    // Schild: Angriffe von vorn (Monster, Pfeile, Tränke) werden abgefangen
    if (this._shieldBlocks(n, dir, why)) return;
    if (why === "slime" || why === "mob" || why === "arrow" || why === "explosion") {
      const def = this.defense();
      n = Math.max(1, Math.round(n * (1 - Math.min(20, def) * 0.04)));
      for (let i = 0; i < 4; i++) this.wearArmor(i);
    }
    p.hp -= n; if (!env) p.invuln = 1;
    this.regenT = 0;
    if (dir && why !== "explosion") { p.vx = dir * 7; p.vy = -7; }
    this.addExh(0.1);
    this.events.push({ t: "hurt", n, why });
    if (p.hp <= 0) this._die();
  }
  _die() {
    const p = this.player;
    this.events.push({ t: "died" });
    // wie Minecraft: alles fällt an der Todesstelle
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const all = [...this.inv, ...this.armor, ...this.offh, this.cursor];
    for (const st of all) if (st) this.dropStack(st, cx, cy, true);
    this.inv = this._emptyInv(); this.armor = [null, null, null, null]; this.offh = [null]; this.cursor = null; this.grid.fill(null); this.win = null;
    this.xp = 0; this.food = 20; this.sat = 5; this.exh = 0;
    if (this.bed && this.tile(this.bed.x, this.bed.y) !== B.BED) {          // Bett zerstört → zurück ans Weltspawn
      this.bed = null; this.spawn = { x: SPAWN_X - 6.4, y: SURF - 1.8 - 0.001 }; this.events.push({ t: "nobed" });
    }
    if (this.dim) this._enterDim(0, { keep: true });                      // Tod im Nether / Ende: zurück in die Oberwelt
    p.air = 15; p.burn = 0; p.hp = p.maxHp; p.x = this.spawn.x; p.y = this.spawn.y; p.vx = p.vy = 0; p.invuln = 2;
    if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; }
    this.mobs = this.mobs.filter(m => m.kind !== "hostile"); this.proj.length = 0; this.bow = null; this.xbow = null; this.clouds = []; this.shieldCd = 0; this.shieldT = 0; this.blocking = false;
    this.fx = {}; this.fish = null;
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
}

installInventory(Sandbox, { clamp, REACH, MAX_HP, W, H, SURF, SPAWN_X });
installFluids(Sandbox, { clamp, W, H });
installMobs(Sandbox, { clamp, W, H, SURF, SPAWN_X, REACH });
installFarm(Sandbox, { clamp, W, H });
installRedstone(Sandbox, { clamp, W, H });
installBrew(Sandbox, { clamp, W, H, MAX_HP });
installDims(Sandbox, { clamp, W, H, SURF, SPAWN_X, encodeTiles, decodeTiles, ENCH, stackMax });
installBoss(Sandbox, { clamp, W, H });
installVillagers(Sandbox, { clamp, W, H, SPAWN_X, REACH });
installFlora(Sandbox, { clamp, W, H });
installPolish(Sandbox, { clamp, W, H, SURF, stackMax });
installCraft9(Sandbox, { clamp, W, H });
installCombat10(Sandbox, { clamp, W, H, REACH });
installOcean(Sandbox, { clamp, W, H });
installSeaMobs(Sandbox, { clamp, W, H, SURF });
installFauna(Sandbox, { clamp, W, H, SURF });
installWiden(Sandbox, { clamp, W, H, SURF });
