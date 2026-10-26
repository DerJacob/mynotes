// =====================================================================
// Blockdorf – Dimensionen (Etappe 5)
//   Oberwelt (0) · Nether (1) · Ende (2). Alle drei haben dasselbe Raster (512 × 192); nur eine ist „lebendig“,
//   die anderen liegen als Schnappschuss in this.dims (Blöcke, Kisten, Gegenstände, Tiere).
//   Portale: Obsidianrahmen + Feuerzeug → Nether (x bleibt gleich, 1:1) · Endportal-Rahmen in der Festung + Augen
//   des Enders → Ende · Tor (Gateway) auf den äußeren Inseln · Enderperle · Auge des Enders zeigt zur Festung.
//   Speichern (Version 6): Oberwelt wie bisher, dazu dim, dimData (Nether/Ende), strongholds, flags.
// Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS, isFluid } from "./sandbox-data.js?v=8";
import { generateNether, generateEnd, placeStronghold, END_CX, END_TOP, END_ARRIVE, END_PILLARS } from "./sandbox-nether.js?v=8";
import { BIOME_NAMES } from "./sandbox-world.js?v=8";

Object.assign(BIOME_NAMES, { nether: "Nether", soul_valley: "Seelensandtal", end: "Das Ende" });

export const DIM_NAMES = ["Oberwelt", "Nether", "Das Ende"];
export const PORTAL_TIME = { [B.PORTAL]: 3, [B.END_PORTAL]: 0.8, [B.GATEWAY]: 1 };
export const BEACON_EFFECTS = ["speed", "jump", "strength", "regen"];       // freigeschaltet mit Stufe 1 … 4
export const BEACON_PAY = new Set(["iron_ingot", "gold_ingot", "emerald", "diamond"]);
const PYRAMID = new Set([B.IRON_BLOCK, B.GOLD_BLOCK, B.EMERALD_BLOCK, B.DIAMOND_BLOCK]);

export function installDims(Sandbox, K) {
  const { clamp, W, H, SURF, SPAWN_X, encodeTiles, decodeTiles, ENCH, stackMax } = K;
  const P = Sandbox.prototype;
  const free = (self, x, y) => self.tile(x, y) === B.AIR;

  // ---------- Grundzustand ----------
  P._dimInit = function () {
    this.dim = 0; this.dims = {}; this.noSky = false; this.ambient = 0;
    this.flags = { dragonDead: false };
    this.strongholds = [];
    this.portalT = 0; this.portalKind = 0; this.portalNeed = 3; this.portalLock = false; this.eyeCd = 0; this.pearlCd = 0;
  };
  P._dimSnap = function () {
    return { tiles: this.tiles, lvl: this.lvl, aux: this.aux, ground: this.ground, biomes: this.biomes, villages: this.villages, ents: this.ents, drops: this.drops, decay: this.decay, mobs: this.mobs, proj: this.proj, villagers: this.villagers };
  };
  P._dimUse = function (s) {
    this.tiles = s.tiles; this.lvl = s.lvl; this.aux = s.aux; this.ground = s.ground; this.biomes = s.biomes; this.villages = s.villages || [];
    this.ents = s.ents || new Map(); this.drops = s.drops || []; this.decay = s.decay || []; this.proj = s.proj || []; this.villagers = s.villagers || [];
    if (s.mobsData) { const arr = s.mobsData; s.mobsData = null; this._mobsFromData(arr); } else this.mobs = s.mobs || [];
  };
  /** Schnappschuss einer Dimension (die gerade aktive wird frisch aus dem Spielzustand gebildet) */
  P._dimGet = function (n) { return this.dim === n ? this._dimSnap() : (this.dims[n] || null); };

  // ---------- Speichern / Laden von Kisten und Gegenständen ----------
  P._packStack = function (st) { return st ? (st.e || st.r ? [st.id, st.n, st.d || 0, st.e || 0, st.r || 0] : [st.id, st.n, st.d || 0]) : 0; };
  P._unpackStack = function (a) {
    if (!(Array.isArray(a) && ITEMS[a[0]])) return null;
    const s = { id: a[0], n: clamp(a[1] | 0, 1, stackMax(a[0])), d: a[2] | 0 };
    if (a[3] && typeof a[3] === "object") { const e = {}; for (const [k, v] of Object.entries(a[3])) if (ENCH[k] && v > 0) e[k] = Math.min(ENCH[k].max, v | 0); if (Object.keys(e).length) s.e = e; }
    if (a[4] > 0) s.r = Math.min(10, a[4] | 0);
    return s;
  };
  P._entsToData = function (map) {
    return [...map.entries()].map(([k, e]) => {
      const [x, y] = k.split(",").map(Number);
      return { x, y, t: e.t, s: e.s.map(st => this._packStack(st)), burn: e.burn, burnMax: e.burnMax, cook: e.cook, xp: e.xp, fuel: e.fuel, brewT: e.brewT, eff: e.eff || undefined, on: e.on ? 1 : undefined };
    });
  };
  P._entsFromData = function (arr) {
    const out = new Map();
    for (const e of Array.isArray(arr) ? arr : []) {
      if (!e || !(e.t === "chest" || e.t === "furnace" || e.t === "disp" || e.t === "brew" || e.t === "beacon") || !Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
      const n = { chest: 27, furnace: 3, disp: 9, brew: 5, beacon: 1 }[e.t];
      const o = { t: e.t, s: Array.from({ length: n }, (_, i) => this._unpackStack((e.s || [])[i])), burn: +e.burn || 0, burnMax: +e.burnMax || 0, cook: +e.cook || 0, xp: +e.xp || 0, fuel: +e.fuel || 0, brewT: +e.brewT || 0 };
      if (e.t === "beacon") { o.eff = BEACON_EFFECTS.includes(e.eff) ? e.eff : null; o.lvl = 0; o.on = false; }
      out.set(`${e.x},${e.y}`, o);
    }
    return out;
  };
  P._dropsToData = function (drops) { return drops.slice(-120).map(d => [d.id, d.n, d.d || 0, +d.x.toFixed(2), +d.y.toFixed(2)]); };
  P._dropsFromData = function (arr) {
    const out = [];
    for (const a of Array.isArray(arr) ? arr : []) if (Array.isArray(a) && ITEMS[a[0]] && Number.isFinite(a[3]) && Number.isFinite(a[4])) out.push({ id: a[0], n: clamp(a[1] | 0, 1, stackMax(a[0])), d: a[2] | 0, x: +a[3], y: +a[4], vx: 0, vy: 0, w: 0.3, h: 0.3, age: 1, stepUp: false });
    return out;
  };
  /** Nether / Ende in die gespeicherte Form bringen */
  P._packDim = function (s) {
    return {
      tiles: encodeTiles(s.tiles), lvl: encodeTiles(s.lvl), aux: encodeTiles(s.aux), biomes: encodeTiles(s.biomes), ground: Array.from(s.ground),
      ents: this._entsToData(s.ents || new Map()), drops: this._dropsToData(s.drops || []), mobs: s.mobsData || this._mobsToData(s.mobs || [])
    };
  };
  P._unpackDim = function (dd) {
    if (!dd || typeof dd.tiles !== "string") throw new Error("Dimension beschädigt");
    const tiles = decodeTiles(dd.tiles);
    let lvl = new Uint8Array(W * H), aux = new Uint8Array(W * H), biomes = new Uint8Array(W);
    try { lvl = decodeTiles(dd.lvl); } catch (e) { /* Flüssigkeiten beginnen neu */ }
    try { aux = decodeTiles(dd.aux); } catch (e) { /* Zusatzdaten beschädigt */ }
    try { biomes = decodeTiles(dd.biomes, W); } catch (e) { /* ok */ }
    for (let i = 0; i < W * H; i++) if (tiles[i] === B.WATER || tiles[i] === B.LAVA) { if (!lvl[i]) lvl[i] = 9; } else lvl[i] = 0;
    return {
      tiles, lvl, aux, biomes, ground: Int16Array.from(dd.ground && dd.ground.length === W ? dd.ground : new Array(W).fill(0)), villages: [],
      ents: this._entsFromData(dd.ents), drops: this._dropsFromData(dd.drops), decay: [], proj: [], villagers: [], mobsData: Array.isArray(dd.mobs) ? dd.mobs : []
    };
  };
  P._saveDims = function (data) {
    data.dim = this.dim; data.strongholds = this.strongholds.map(s => ({ x: s.x, y: s.y })); data.flags = { ...this.flags };
    const dd = {};
    for (const n of [1, 2]) { const s = this._dimGet(n); if (s) dd[n] = this._packDim(s); }
    if (Object.keys(dd).length) data.dimData = dd;
  };
  /** Nach dem Laden: Nether / Ende bereitstellen und ggf. dort weitermachen */
  P._restoreDim = function (d) {
    const p = this.player;
    if (!d.dimData) { if (d.dim) { p.x = this.spawn.x; p.y = this.spawn.y; } return; }
    for (const n of [1, 2]) { try { if (d.dimData[n]) this.dims[n] = this._unpackDim(d.dimData[n]); } catch (e) { delete this.dims[n]; } }
    const want = d.dim | 0;
    if ((want === 1 || want === 2) && this.dims[want]) {
      this._enterDim(want, { keep: true });
      if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; }
    } else if (want) { p.x = this.spawn.x; p.y = this.spawn.y; }
  };

  // ---------- Festung ----------
  P._ensureStronghold = function () {
    if (this.strongholds.length) return;
    const aux = this.aux, sh = placeStronghold(this.seed, this.tiles, this.lvl, aux, SPAWN_X, SURF);
    if (!sh) return;
    this.strongholds = [{ x: sh.x, y: sh.y }];
    this._stockChests(this.ents, sh.chests);
  };
  /** Sind alle fünf Rahmen gefüllt, öffnet sich das Endportal */
  P._endPortalCheck = function () {
    for (const s of this.strongholds) {
      const fr = [[s.x - 2, s.y], [s.x + 2, s.y], [s.x - 1, s.y + 1], [s.x, s.y + 1], [s.x + 1, s.y + 1]];
      if (!fr.every(([x, y]) => this.tile(x, y) === B.FRAME && this.aux[y * W + x] === 1)) continue;
      let opened = false;
      for (let x = s.x - 1; x <= s.x + 1; x++) if (this.tile(x, s.y) === B.AIR) { this.setTile(x, s.y, B.END_PORTAL); opened = true; }
      if (opened) { this.events.push({ t: "endportal", x: s.x, y: s.y }); this.grant("endportal"); }
    }
  };
  P._insertEye = function (tx, ty) {
    const s = this.selStack();
    if (!s || s.id !== "ender_eye" || this.tile(tx, ty) !== B.FRAME || this.aux[ty * W + tx]) return false;
    this.aux[ty * W + tx] = 1; this._consumeSel();
    this.events.push({ t: "eye_in", x: tx, y: ty });
    this._endPortalCheck();
    return true;
  };
  /** Auge des Enders werfen: zeigt zur nächsten Festung */
  P._throwEye = function () {
    if (this.eyeCd > 0) return true;
    this.eyeCd = 1.2;
    const p = this.player, cx = p.x + p.w / 2;
    let best = null;
    if (this.dim === 0) for (const s of this.strongholds) if (!best || Math.abs(s.x - cx) < Math.abs(best.x - cx)) best = s;
    if (!best) { this.events.push({ t: "eye", none: true }); return true; }
    const dx = best.x - cx, dy = best.y - (p.y + p.h / 2);
    this.events.push({ t: "eye", dx: Math.sign(dx) || 1, dist: Math.round(Math.abs(dx)), down: Math.abs(dx) < 10 ? Math.round(dy) : 0 });
    this.grant("eye");
    if (this.mrng() < 0.2) { this._consumeSel(); this.events.push({ t: "eye_break" }); }
    return true;
  };

  // ---------- Portale ----------
  P._lightPortal = function (tx, ty) {
    let x = tx, y = ty;
    if (this.tile(x, y) === B.OBSIDIAN) y--;                           // auf den Rahmen geklickt: darüber anzünden
    if (!free(this, x, y)) return false;
    let by = y; while (by < H - 2 && free(this, x, by + 1)) by++;
    if (this.tile(x, by + 1) !== B.OBSIDIAN) return false;
    let t0 = by; while (t0 > 1 && free(this, x, t0 - 1) && by - t0 < 22) t0--;
    const top = t0 - 1, h = by - t0 + 1;
    if (this.tile(x, top) !== B.OBSIDIAN || h < 3 || h > 21) return false;
    let xl = x; while (xl > 1 && free(this, xl - 1, by) && x - xl < 22) xl--;
    let xr = x; while (xr < W - 2 && free(this, xr + 1, by) && xr - x < 22) xr++;
    const w = xr - xl + 1;
    if (this.tile(xl - 1, by) !== B.OBSIDIAN || this.tile(xr + 1, by) !== B.OBSIDIAN || w < 2 || w > 21) return false;
    for (let yy = t0; yy <= by; yy++) {
      if (this.tile(xl - 1, yy) !== B.OBSIDIAN || this.tile(xr + 1, yy) !== B.OBSIDIAN) return false;
      for (let xx = xl; xx <= xr; xx++) if (!free(this, xx, yy)) return false;
    }
    for (let xx = xl; xx <= xr; xx++) if (this.tile(xx, top) !== B.OBSIDIAN || this.tile(xx, by + 1) !== B.OBSIDIAN) return false;
    for (let yy = t0; yy <= by; yy++) for (let xx = xl; xx <= xr; xx++) this.setTile(xx, yy, B.PORTAL);
    this._wear(this.inv, this.sel, 1);
    this.events.push({ t: "portal_lit", x, y });
    return true;
  };
  /** Wird nach dem Abbauen eines Blocks aufgerufen: ohne Rahmen verschwindet das Portal */
  P._dimBreak = function (x, y, id) {
    if (id !== B.OBSIDIAN) return;
    const q = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tile(x + dx, y + dy) === B.PORTAL) q.push([x + dx, y + dy]);
    if (!q.length) return;
    while (q.length) {
      const [px, py] = q.pop();
      if (this.tile(px, py) !== B.PORTAL) continue;
      this.setTile(px, py, B.AIR);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.tile(px + dx, py + dy) === B.PORTAL) q.push([px + dx, py + dy]);
    }
    this.events.push({ t: "portal_off", x, y });
  };
  /** Passende freie Stelle (Boden unter 4 Spalten, 5 Reihen Luft) für ein neues Portal */
  P._portalSite = function (x) {
    x = clamp(x, 6, W - 10);
    if (this.dim === 0) {
      for (let k = 0; k <= 40; k++) for (const sx of (k ? [x - k, x + k] : [x])) {
        const cx = clamp(sx, 6, W - 10), gy = this.ground[cx];
        if (gy <= SURF + 3 && gy > 8 && !isFluid(this.tile(cx, gy - 1)) && !isFluid(this.tile(cx + 3, this.ground[cx + 3] - 1))) return { x: cx, y: gy };
      }
      return { x, y: clamp(this.ground[x], 8, H - 10) };
    }
    for (let k = 0; k <= 70; k++) for (const sx of (k ? [x - k, x + k] : [x])) {
      const cx = clamp(sx, 6, W - 10);
      for (let y = 26; y < 150; y++) {
        let ok = true;
        for (let dx = -1; dx <= 4 && ok; dx++) if (!BLOCKS[this.tile(cx + dx, y)].solid || this.tile(cx + dx, y) === B.BEDROCK || isFluid(this.tile(cx + dx, y - 1))) ok = false;
        for (let dy = 1; dy <= 6 && ok; dy++) for (let dx = 0; dx <= 3 && ok; dx++) if (!free(this, cx + dx, y - dy)) ok = false;
        if (ok) return { x: cx, y };
      }
    }
    return { x, y: 70 };                                              // notfalls mitten in die Höhle
  };
  /** Rahmen 4 × 5 (innen 2 × 3) mit Plattform bauen, Boden = Reihe y */
  P._makePortal = function (x, y) {
    for (let yy = y - 6; yy <= y - 1; yy++) for (let xx = x - 2; xx <= x + 5; xx++) { const t = this.tile(xx, yy); if (t !== B.AIR && t !== B.BEDROCK) this.setTile(xx, yy, B.AIR); }
    for (let xx = x - 1; xx <= x + 4; xx++) this.setTile(xx, y, B.OBSIDIAN);
    for (let xx = x; xx <= x + 3; xx++) this.setTile(xx, y - 4, B.OBSIDIAN);
    for (let yy = y - 3; yy <= y - 1; yy++) { this.setTile(x, yy, B.OBSIDIAN); this.setTile(x + 3, yy, B.OBSIDIAN); this.setTile(x + 1, yy, B.PORTAL); this.setTile(x + 2, yy, B.PORTAL); }
  };
  P._portalArrive = function (x) {
    const p = this.player;
    let best = null;
    for (let k = 0; k <= 64 && !best; k++) for (const sx of (k ? [x - k, x + k] : [x])) {
      if (sx < 1 || sx >= W - 1) continue;
      for (let y = H - 1; y >= 0; y--) if (this.tile(sx, y) === B.PORTAL) { best = { x: sx, y }; break; }
      if (best) break;
    }
    if (!best) { const s = this._portalSite(x); this._makePortal(s.x, s.y); best = { x: s.x + 1, y: s.y - 1 }; }
    p.x = best.x + 0.5 - p.w / 2; p.y = best.y + 1 - p.h - 0.001; p.vx = p.vy = 0;
    if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; }
    this.portalLock = true; this.portalT = 0;
  };

  // ---------- Wechsel ----------
  P._genDim = function (n) {
    const g = n === 1 ? generateNether(this.seed) : generateEnd(this.seed);
    const ents = new Map();
    this._stockChests(ents, g.chests);
    return { tiles: g.tiles, lvl: g.lvl, aux: g.aux, ground: g.ground, biomes: g.biomes, villages: [], ents, drops: [], decay: [], mobs: [], proj: [], villagers: [] };
  };
  /** In eine andere Dimension wechseln. opts: via ("portal"), x · keep (Spielerposition nicht ändern) */
  P._enterDim = function (n, opts = {}) {
    if (n === this.dim || (n !== 0 && n !== 1 && n !== 2)) return false;
    const p = this.player;
    this.closeWindow(); this.mining = null; this.fish = null; this.bow = null; this.blocking = false; this.aim = null;
    this.dims[this.dim] = this._dimSnap();
    let s = this.dims[n], fresh = false;
    if (!s) { s = this._genDim(n); fresh = true; }
    delete this.dims[n];
    this._dimUse(s); this.dim = n; this.noSky = n !== 0; this.ambient = [0, 5, 3][n];
    this._fluidInit(); this._rsInit();
    this.portalT = 0;
    if (fresh) this._dimPopulate(n);
    if (!opts.keep) {
      if (opts.via === "portal") this._portalArrive(opts.x);
      else if (n === 2) { p.x = END_ARRIVE + 0.1; p.y = END_TOP - p.h - 0.001; p.vx = p.vy = 0; this.portalLock = true; }
      else {
        p.x = this.spawn.x; p.y = this.spawn.y; p.vx = p.vy = 0; this.portalLock = true;
        if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; }
      }
    }
    this.lightDirty = true; this.relight();
    this.events.push({ t: "dim", dim: n });
    if (n === 1) this.grant("nether"); else if (n === 2) this.grant("end");
    return true;
  };
  P._gateway = function () {
    const p = this.player, cx = p.x + p.w / 2, cols = new Map();
    for (let x = 1; x < W - 1; x++) for (let y = 0; y < H; y++) if (this.tile(x, y) === B.GATEWAY) cols.set(x, Math.max(cols.get(x) ?? -1, y));
    let dest = null;
    for (const [x, y] of cols) if (Math.abs(x + 0.5 - cx) > 4 && (!dest || Math.abs(x - cx) > Math.abs(dest.x - cx))) dest = { x, y };
    if (dest) { p.x = dest.x + 0.5 - p.w / 2; p.y = dest.y + 1 - p.h - 0.001; }
    else { p.x = END_ARRIVE + 0.1; p.y = END_TOP - p.h - 0.001; }
    p.vx = p.vy = 0; this.portalLock = true; this.portalT = 0;
    this.events.push({ t: "tp", x: p.x, y: p.y, self: true });
  };
  P._dimStep = function (dt) {
    const p = this.player;
    this.eyeCd = Math.max(0, this.eyeCd - dt); this.pearlCd = Math.max(0, this.pearlCd - dt);
    const x0 = Math.floor(p.x), x1 = Math.floor(p.x + p.w - 1e-6), y0 = Math.floor(p.y), y1 = Math.floor(p.y + p.h - 1e-6);
    let kind = 0;
    for (let y = y0; y <= y1 && !kind; y++) for (let x = x0; x <= x1; x++) { const id = this.tile(x, y); if (PORTAL_TIME[id]) { kind = id; break; } }
    if (!kind) { this.portalT = 0; this.portalKind = 0; this.portalLock = false; return; }
    this.portalKind = kind; this.portalNeed = PORTAL_TIME[kind];
    if (this.portalLock) { this.portalT = 0; return; }
    this.portalT += dt;
    if (this.portalT < this.portalNeed) return;
    this.portalT = 0;
    const cx = Math.floor(p.x + p.w / 2);
    if (kind === B.PORTAL) this._enterDim(this.dim === 0 ? 1 : 0, { via: "portal", x: cx });
    else if (kind === B.END_PORTAL) this._enterDim(this.dim === 2 ? 0 : 2);
    else this._gateway();
  };

  // ---------- Benutzen ----------
  /** Sonderfälle beim Rechtsklick (vor allem anderen): Feuerzeug, Enderauge, Enderperle */
  P._useSpecial = function (s, tx, ty) {
    if (s.id === "ender_eye") {
      if (this.reachOk(tx, ty) && this.tile(tx, ty) === B.FRAME) return this._insertEye(tx, ty) || true;
      return this._throwEye();
    }
    if (s.id === "ender_pearl") return this._throwPearl(tx, ty);
    if (s.id === "flint_and_steel") return this.reachOk(tx, ty) ? this._lightPortal(tx, ty) : false;
    return false;
  };
  P._throwPearl = function (tx, ty) {
    if (this.pearlCd > 0) return true;
    const p = this.player, x0 = p.x + p.w / 2, y0 = p.y + 0.5, dx = tx + 0.5 - x0, dy = ty + 0.5 - y0, L = Math.max(0.5, Math.hypot(dx, dy)), sp = 24;
    this.proj.push({ kind: "pearl", x: x0, y: y0, vx: dx / L * sp, vy: dy / L * sp - 2, dmg: 0, fromPlayer: true, age: 0, stuck: false, stuckT: 0 });
    this._consumeSel(); this.pearlCd = 0.6;
    this.events.push({ t: "shoot", mob: false });
    return true;
  };

  // ---------- Erzeugen der Bewohner ----------
  P._dimPopulate = function (n) {
    const rnd = this.mrng;
    if (n === 1) {
      for (let i = 0, made = 0; i < 160 && made < 34; i++) {
        const x = 8 + Math.floor(rnd() * (W - 16)), fy = this._findSpawnY(x, 12, 150, 2);
        if (fy < 0) continue;
        const r = rnd(), type = r < 0.55 ? "zombie_piglin" : r < 0.8 ? "piglin" : "magma_cube";
        const m = this.spawnMob(type, x + 0.5 - 0.35, fy); if (this._hit(m)) this.mobs.pop(); else made++;
      }
      for (let i = 0, made = 0; i < 120 && made < 6; i++) {            // Ghasts schweben frei in der Höhle
        const x = 20 + Math.floor(rnd() * (W - 40)), y = 36 + Math.floor(rnd() * 56);
        if (!this._roomFor(x, y, 4, 4)) continue;
        const m = this.spawnMob("ghast", x - 1.7 + 0.5, y + 3.6); if (this._hit(m)) this.mobs.pop(); else made++;
      }
      let made = 0;                                                    // Wither-Skelette auf Netherziegeln
      for (let i = 0; i < 400 && made < 10; i++) {
        const x = 4 + Math.floor(rnd() * (W - 8)), y = 30 + Math.floor(rnd() * 120);
        if (this.tile(x, y) !== B.NETHER_BRICK || this.tile(x, y - 1) !== B.AIR || this.tile(x, y - 2) !== B.AIR || this.tile(x, y - 3) !== B.AIR) continue;
        const m = this.spawnMob("wither_skeleton", x + 0.5 - 0.35, y); if (this._hit(m)) this.mobs.pop(); else made++;
      }
    } else if (n === 2) {
      if (!this.flags.dragonDead) {
        for (const dx of END_PILLARS) {
          const cx = END_CX + dx;
          for (let y = 20; y < H - 5; y++) if (this.tile(cx, y) === B.OBSIDIAN) { this.spawnMob("end_crystal", cx + 0.5 - 0.7, y); break; }
        }
        this.spawnMob("ender_dragon", END_CX - 3, END_TOP - 36);
      }
      for (let i = 0, made = 0; i < 80 && made < 9; i++) {
        const x = END_CX - 34 + Math.floor(rnd() * 68), fy = this._findSpawnY(x, END_TOP - 6, END_TOP + 20, 3);
        if (fy < 0) continue;
        const m = this.spawnMob("enderman", x + 0.5 - 0.3, fy); if (this._hit(m)) this.mobs.pop(); else made++;
      }
    }
  };
  /** Rechteck w × h Blöcke, Mitte (x, y), ohne Block und Flüssigkeit */
  P._roomFor = function (x, y, w, h) {
    for (let yy = y - 1; yy < y + h - 1; yy++) for (let xx = x - Math.floor(w / 2); xx < x - Math.floor(w / 2) + w; xx++) { const t = this.tile(xx, yy); if (BLOCKS[t].solid || isFluid(t) || yy < 4 || yy > H - 8) return false; }
    return true;
  };

  // ---------- Der Drache ist besiegt ----------
  P._dragonDead = function () {
    this.flags.dragonDead = true;
    const cx = END_CX, top = END_TOP;
    for (let y = top - 4; y <= top - 1; y++) this.setTile(cx, y, B.BEDROCK);
    this.setTile(cx, top - 5, B.DRAGON_EGG);
    for (const dx of [-3, -2, -1, 1, 2, 3]) { this.setTile(cx + dx, top - 1, B.END_PORTAL); this.setTile(cx + dx, top - 2, B.END_PORTAL); }
    const gx = cx + 14;
    this.setTile(gx, top - 1, B.BEDROCK);
    this.setTile(gx, top - 2, B.GATEWAY); this.setTile(gx, top - 3, B.GATEWAY);
    this.grant("dragon");
    this.events.push({ t: "dragon_dead" });
  };

  // ---------- Leuchtfeuer ----------
  /** Stufe der Pyramide (0 … 4) unter einem Leuchtfeuer */
  P.beaconLevel = function (bx, by) {
    let L = 0;
    for (let i = 1; i <= 4; i++) {
      for (let x = bx - i; x <= bx + i; x++) if (!PYRAMID.has(this.tile(x, by + i))) return L;
      L = i;
    }
    return L;
  };
  P.beaconClear = function (bx, by) { for (let y = by - 1; y >= 0; y--) if (BLOCKS[this.tile(bx, y)].solid) return false; return true; };
  P._beaconStep = function (dt) {
    this.beaconT = (this.beaconT === undefined ? 1 : this.beaconT) - dt;
    if (this.beaconT > 0) return;
    this.beaconT = 1;
    const p = this.player;
    for (const [k, e] of this.ents) {
      if (e.t !== "beacon") continue;
      const [bx, by] = k.split(",").map(Number);
      if (this.tile(bx, by) !== B.BEACON) continue;
      e.lvl = this.beaconLevel(bx, by); e.on = e.lvl > 0 && this.beaconClear(bx, by);
      if (!e.on || !e.eff) continue;
      this.grant("beacon");
      if (Math.abs(bx + 0.5 - (p.x + p.w / 2)) <= 10 + 10 * e.lvl && Math.abs(by - p.y) <= 40 + 10 * e.lvl) this.addEffect(e.eff, 12, e.eff === "regen" ? 0 : 0, true);
    }
  };
  /** Effekt wählen: kostet einen Barren / Smaragd / Diamant im Zahlplatz */
  P.beaconSet = function (name) {
    const e = this.winEnt();
    if (!this.win || this.win.kind !== "beacon" || !e || e.t !== "beacon") return false;
    const idx = BEACON_EFFECTS.indexOf(name);
    e.lvl = this.beaconLevel(this.win.x, this.win.y);
    if (idx < 0 || idx + 1 > e.lvl) { this.events.push({ t: "beacon_no", why: "lvl" }); return false; }
    const pay = e.s[0];
    if (!pay || !BEACON_PAY.has(pay.id)) { this.events.push({ t: "beacon_no", why: "pay" }); return false; }
    pay.n--; if (pay.n <= 0) e.s[0] = null;
    e.eff = name; e.on = this.beaconClear(this.win.x, this.win.y);
    this.events.push({ t: "beacon_set", name });
    return true;
  };
}
