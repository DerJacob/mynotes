// =====================================================================
// Blockdorf – Verzaubern, Amboss, Brauen und Effekte (Etappe 4)
//   Verzauberungstisch: drei Angebote je nach Bücherregalen (bis 15) – kostet Erfahrungsstufen und Lapislazuli
//   Amboss: Reparieren (Material oder gleicher Gegenstand), Bücher und Verzauberungen verschmelzen; kostet Stufen
//   Braustand: Wasserflasche → Seltsamer Trank → Tränke (Redstone verlängert, Glowstone-Staub verstärkt, Schwarzpulver → Wurftrank)
//   Effekte: Schnelligkeit, Langsamkeit, Stärke, Schwäche, Sprungkraft, Regeneration, Gift, Heilung, Schaden, Feuerschutz, Wasseratmung, Nachtsicht, Unsichtbarkeit, Federfall
// Engine ohne Oberfläche; Anzeige in sandbox.js.
// =====================================================================
import { B, BLOCKS, ITEMS, MATERIALS, SMELT, hasTag } from "./sandbox-data.js?v=6";
import { mulberry32 } from "./sandbox-noise.js?v=6";

// ---------------------------------------------------------------------
// Verzauberungen
// ---------------------------------------------------------------------
export const ROMAN = ["", "I", "II", "III", "IV", "V"];
/** items: für welche Arten · base/step: ab welcher Stufe des Angebots Level 1, 2, … möglich ist · w: Gewicht · cost: Amboss-Faktor */
export const ENCH = {
  sharpness: { name: "Schärfe", max: 5, items: ["sword", "axe"], base: 1, step: 11, w: 10, cost: 1 },
  knockback: { name: "Rückstoß", max: 2, items: ["sword"], base: 5, step: 20, w: 5, cost: 2 },
  fire_aspect: { name: "Verbrennung", max: 2, items: ["sword"], base: 10, step: 20, w: 2, cost: 4 },
  looting: { name: "Plünderung", max: 3, items: ["sword"], base: 15, step: 9, w: 2, cost: 4 },
  efficiency: { name: "Effizienz", max: 5, items: ["pick", "axe", "shovel", "hoe", "shears"], base: 1, step: 10, w: 10, cost: 1 },
  fortune: { name: "Glück", max: 3, items: ["pick", "axe", "shovel", "hoe"], base: 15, step: 9, w: 2, cost: 4 },
  silk_touch: { name: "Behutsamkeit", max: 1, items: ["pick", "axe", "shovel", "hoe"], base: 15, step: 0, w: 1, cost: 8 },
  unbreaking: { name: "Haltbarkeit", max: 3, items: ["sword", "axe", "pick", "shovel", "hoe", "shears", "bow", "rod", "armor"], base: 5, step: 8, w: 5, cost: 2 },
  protection: { name: "Schutz", max: 4, items: ["armor"], base: 1, step: 11, w: 10, cost: 1 },
  feather_falling: { name: "Federfall", max: 4, items: ["boots"], base: 5, step: 6, w: 5, cost: 2 },
  power: { name: "Stärke", max: 5, items: ["bow"], base: 1, step: 10, w: 10, cost: 1 },
  punch: { name: "Schlag", max: 2, items: ["bow"], base: 12, step: 20, w: 2, cost: 4 },
  flame: { name: "Flamme", max: 1, items: ["bow"], base: 20, step: 0, w: 2, cost: 4 },
  infinity: { name: "Unendlichkeit", max: 1, items: ["bow"], base: 20, step: 0, w: 1, cost: 8 },
  lure: { name: "Köder", max: 3, items: ["rod"], base: 15, step: 9, w: 2, cost: 4 },
  luck_of_the_sea: { name: "Glück des Meeres", max: 3, items: ["rod"], base: 15, step: 9, w: 2, cost: 4 },
  mending: { name: "Reparatur", max: 1, items: ["sword", "axe", "pick", "shovel", "hoe", "shears", "bow", "rod", "armor"], base: 25, step: 0, w: 2, cost: 4, treasure: true }
};
const CONFLICT = [["fortune", "silk_touch"], ["infinity", "mending"]];
const conflicts = (a, b) => CONFLICT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Art eines Gegenstands für Verzauberungen: Liste passender Klassen (leer = nicht verzauberbar) */
export function enchClasses(id) {
  const it = ITEMS[id]; if (!it) return [];
  if (id === "book" || id === "enchanted_book") return ["book"];
  if (it.tool) return [it.tool];
  if (it.armor) return it.armor.slot === 3 ? ["armor", "boots"] : ["armor"];
  if (id === "bow") return ["bow"];
  if (id === "fishing_rod") return ["rod"];
  return [];
}
const applicable = (name, classes) => classes.includes("book") || ENCH[name].items.some(c => classes.includes(c));
/** Textzeilen für Verzauberungen eines Stapels ("Schärfe III") */
export function enchLines(st) { return st && st.e ? Object.entries(st.e).filter(([k]) => ENCH[k]).map(([k, v]) => ENCH[k].name + (ENCH[k].max > 1 ? " " + ROMAN[v] : "")) : []; }

// ---------------------------------------------------------------------
// Tränke
// ---------------------------------------------------------------------
/** Die Reihenfolge nie ändern (steht in Spielständen): d = Art × 4 + Stufe (0 normal, 1 verlängert, 2 verstärkt) */
export const POTION_KINDS = ["water", "awkward", "mundane", "night_vision", "invisibility", "leaping", "fire_resistance", "swiftness", "slowness", "water_breathing", "healing", "harming", "poison", "weakness", "strength", "regeneration", "slow_falling"];
/** Dauer in Sekunden [normal, verlängert, verstärkt], effekt = Name des Effekts */
export const POTION_FX = {
  night_vision: { n: "Nachtsicht", fx: "night_vision", dur: [180, 480, 0], col: "#3a3ad8" }, invisibility: { n: "Unsichtbarkeit", fx: "invisibility", dur: [180, 480, 0], col: "#9aa6b8" },
  leaping: { n: "Sprungkraft", fx: "jump", dur: [180, 480, 90], col: "#42e050" }, fire_resistance: { n: "Feuerschutz", fx: "fire_resistance", dur: [180, 480, 0], col: "#f0902c" },
  swiftness: { n: "Schnelligkeit", fx: "speed", dur: [180, 480, 90], col: "#4cc8f0" }, slowness: { n: "Langsamkeit", fx: "slowness", dur: [90, 240, 20], col: "#5a6c8c" },
  water_breathing: { n: "Wasseratmung", fx: "water_breathing", dur: [180, 480, 0], col: "#2e6ae0" }, healing: { n: "Heilung", fx: null, instant: "heal", col: "#f04a58" },
  harming: { n: "Schaden", fx: null, instant: "harm", col: "#7a1a28" }, poison: { n: "Gift", fx: "poison", dur: [45, 90, 21], col: "#5ea02c" },
  weakness: { n: "Schwäche", fx: "weakness", dur: [90, 240, 0], col: "#6a6a70" }, strength: { n: "Stärke", fx: "strength", dur: [180, 480, 90], col: "#c8402c" },
  regeneration: { n: "Regeneration", fx: "regen", dur: [45, 90, 22], col: "#e068a8" }, slow_falling: { n: "Sanftes Fallen", fx: "slow_fall", dur: [90, 240, 0], col: "#d8d4c0" }
};
export const POTION_BASE = { water: ["Wasserflasche", "#4a78d8"], awkward: ["Seltsamer Trank", "#6a5ac0"], mundane: ["Langweiliger Trank", "#8a78b8"] };
/** Namen aller Effekte (Anzeige oben im Spiel) */
export const EFFECT_NAMES = { speed: "Schnelligkeit", slowness: "Langsamkeit", strength: "Stärke", weakness: "Schwäche", jump: "Sprungkraft", regen: "Regeneration", poison: "Gift", fire_resistance: "Feuerschutz", water_breathing: "Wasseratmung", night_vision: "Nachtsicht", invisibility: "Unsichtbarkeit", slow_fall: "Sanftes Fallen", wither: "Wither" };
export const EFFECT_BAD = new Set(["slowness", "weakness", "poison", "wither"]);
export const potionKind = d => POTION_KINDS[(d | 0) >> 2] || "water";
export const potionMod = d => (d | 0) & 3;
export const potionCode = (kind, mod = 0) => POTION_KINDS.indexOf(kind) * 4 + mod;
export function potionColor(d) { const k = potionKind(d); return POTION_FX[k] ? POTION_FX[k].col : POTION_BASE[k][1]; }
export function stackName(st) {
  if (!st) return "";
  if (st.id === "potion" || st.id === "splash_potion") {
    const k = potionKind(st.d), m = potionMod(st.d);
    if (POTION_BASE[k]) return (st.id === "splash_potion" ? "Wurf-" : "") + POTION_BASE[k][0];
    return (st.id === "splash_potion" ? "Wurftrank" : "Trank") + " der " + POTION_FX[k].n + (m === 2 ? " II" : "") + (m === 1 ? " (verlängert)" : "");
  }
  return ITEMS[st.id] ? ITEMS[st.id].name : st.id;
}
export function stackLines(st) {
  if (!st) return [];
  const out = enchLines(st);
  if (st.id === "potion" || st.id === "splash_potion") {
    const k = potionKind(st.d), m = potionMod(st.d), f = POTION_FX[k];
    if (f) {
      if (f.instant) out.push((f.instant === "heal" ? "Heilt " : "Schadet ") + (f.instant === "heal" ? (m === 2 ? 4 : 2) : (m === 2 ? 6 : 3)) + " Herzen");
      else { const s = f.dur[m] || f.dur[0]; out.push(`${f.n}${m === 2 ? " II" : ""} (${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`); }
    }
  }
  return out;
}

/** Brauen: was passiert, wenn man Zutat ing auf Flasche st gibt? Liefert den neuen Stapel oder null. */
const WATER_ING = { nether_wart: "awkward", fermented_spider_eye: "weakness", sugar: "mundane", glistering_melon_slice: "mundane", spider_eye: "mundane", blaze_powder: "mundane", rabbit_foot: "mundane" };
const AWKWARD_ING = { golden_carrot: "night_vision", sugar: "swiftness", rabbit_foot: "leaping", pufferfish: "water_breathing", glistering_melon_slice: "healing", spider_eye: "poison", blaze_powder: "strength", magma_cream: "fire_resistance", ghast_tear: "regeneration" };
const CORRUPT = { night_vision: "invisibility", swiftness: "slowness", leaping: "slowness", fire_resistance: "slowness", healing: "harming", poison: "harming", water_breathing: "harming" };
const LONGER = new Set(["night_vision", "invisibility", "leaping", "fire_resistance", "swiftness", "slowness", "water_breathing", "poison", "weakness", "strength", "regeneration", "slow_falling"]);
const STRONGER = new Set(["leaping", "swiftness", "slowness", "healing", "harming", "poison", "regeneration", "strength"]);
export const BREW_INGREDIENTS = new Set([...Object.keys(WATER_ING), ...Object.keys(AWKWARD_ING), "fermented_spider_eye", "redstone", "glowstone_dust", "gunpowder", "magma_cream", "ghast_tear"]);
export function brewResult(st, ing) {
  if (!st || (st.id !== "potion" && st.id !== "splash_potion")) return null;
  const kind = potionKind(st.d), mod = potionMod(st.d), out = (k, m = 0, id = st.id) => ({ id, n: 1, d: potionCode(k, m) });
  if (ing === "gunpowder") return st.id === "potion" ? { ...out(kind, mod, "splash_potion") } : null;
  if (ing === "redstone") return LONGER.has(kind) && mod === 0 ? out(kind, 1) : null;
  if (ing === "glowstone_dust") return STRONGER.has(kind) && mod === 0 ? out(kind, 2) : null;
  if (ing === "fermented_spider_eye") {
    if (kind === "water" && mod === 0) return out("weakness");
    return CORRUPT[kind] ? out(CORRUPT[kind], kind === "healing" ? mod : 0) : null;
  }
  if (kind === "water" && mod === 0 && WATER_ING[ing]) return out(WATER_ING[ing]);
  if (kind === "awkward" && AWKWARD_ING[ing]) return out(AWKWARD_ING[ing]);
  return null;
}
export const BREW_TIME = 20;

export function installBrew(Sandbox, K) {
  const { clamp, W, H, MAX_HP } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1, d = 0) => ({ id, n, d });

  P._brewInit = function () {
    if (!this.fx) this.fx = {};
    this.fxT = { regen: 0, poison: 0 };
    if (this.enchSeed === undefined) this.enchSeed = (this.seed ^ 0x5eed) >>> 0;
  };

  // ---------- Effekte ----------
  /** Effekt hinzufügen: stärkerer ersetzt schwächeren, bei gleicher Stärke gilt die längere Dauer */
  P.addEffect = function (name, seconds, amp = 0, silent = false) {
    const cur = this.fx[name];
    if (cur && (cur.amp > amp || (cur.amp === amp && cur.t >= seconds))) return;
    this.fx[name] = { t: seconds, amp };
    if (!silent || !cur) this.events.push({ t: "effect", name, silent });
  };
  P.hasFx = function (name) { return !!this.fx[name]; };
  P.fxAmp = function (name) { return this.fx[name] ? this.fx[name].amp + 1 : 0; };
  P._fxStep = function (dt) {
    const p = this.player;
    for (const k of Object.keys(this.fx)) { const f = this.fx[k]; f.t -= dt; if (f.t <= 0) { delete this.fx[k]; this.events.push({ t: "effect_end", name: k }); } }
    if (this.fx.regen) {
      this.fxT.regen -= dt;
      if (this.fxT.regen <= 0) { this.fxT.regen = 2.5 / Math.pow(2, this.fx.regen.amp); if (p.hp < p.maxHp) p.hp++; }
    }
    if (this.fx.poison) {
      this.fxT.poison -= dt;
      if (this.fxT.poison <= 0) { this.fxT.poison = 1.25 / Math.pow(2, this.fx.poison.amp); if (p.hp > 1) this.hurt(1, 0, "poison"); }
    }
    if (this.fx.wither) {
      this.fxT.wither = (this.fxT.wither ?? 2) - dt;
      if (this.fxT.wither <= 0) { this.fxT.wither = 2 / Math.pow(2, this.fx.wither.amp); this.hurt(1, 0, "wither"); }
    }
    if (this.fx.slow_fall && p.vy > 2.5) p.vy = 2.5;
  };
  P._applyPotionTo = function (kind, mod, scale) {
    const f = POTION_FX[kind]; if (!f) return;
    const p = this.player;
    if (f.instant === "heal") { p.hp = Math.min(p.maxHp, p.hp + Math.round((mod === 2 ? 8 : 4) * scale)); }
    else if (f.instant === "harm") { const n = Math.round((mod === 2 ? 12 : 6) * scale); if (n > 0) this.hurt(n, 0, "magic"); }
    else this.addEffect(f.fx, Math.max(5, (f.dur[mod] || f.dur[0]) * scale), mod === 2 ? 1 : 0);
  };
  P._applyPotionToMob = function (m, kind, mod, scale) {
    const f = POTION_FX[kind]; if (!f) return;
    if (f.instant === "heal") m.hp = Math.min(m.maxHp, m.hp + Math.round((mod === 2 ? 8 : 4) * scale));
    else if (f.instant === "harm") this._mobHurt(m, Math.round((mod === 2 ? 12 : 6) * scale), 0, "potion");
    else if (f.fx === "poison") m.poisonT = (f.dur[mod] || f.dur[0]) * scale;
    else if (f.fx === "slowness") m.slowT = (f.dur[mod] || f.dur[0]) * scale;
  };
  /** Trinken */
  P.drink = function () {
    const s = this.selStack(); if (!s || s.id !== "potion" || this.eatCd > 0) return false;
    const kind = potionKind(s.d), mod = potionMod(s.d);
    if (POTION_FX[kind]) this._applyPotionTo(kind, mod, 1);
    this.eatCd = 0.5;
    this.inv[this.sel] = stk("glass_bottle");
    this.events.push({ t: "drink", item: "potion" });
    return true;
  };
  /** Wurftrank werfen (zur Mausposition) */
  P.throwPotion = function (tx, ty) {
    const s = this.selStack(); if (!s || s.id !== "splash_potion" || this.eatCd > 0) return false;
    const p = this.player, x0 = p.x + p.w / 2, y0 = p.y + 0.5, dx = tx + 0.5 - x0, dy = ty + 0.5 - y0, L = Math.max(0.5, Math.hypot(dx, dy)), sp = 13;
    this.proj.push({ kind: "potion", x: x0, y: y0, vx: dx / L * sp, vy: dy / L * sp - 3, dmg: 0, pot: s.d, fromPlayer: true, age: 0, stuck: false, stuckT: 0 });
    this._consumeSel(); this.eatCd = 0.4;
    this.events.push({ t: "shoot", mob: false });
    return true;
  };
  /** Wurftrank zerplatzt: Spieler und Tiere im Umkreis von 4 Blöcken, je näher desto stärker */
  P._splashPotion = function (a) {
    const kind = potionKind(a.pot), mod = potionMod(a.pot), p = this.player;
    this.events.push({ t: "splash", x: a.x, y: a.y, col: potionColor(a.pot) });
    const scale = d => (d >= 4 ? 0 : 1 - d / 4 * 0.75);
    const dp = Math.hypot(a.x - (p.x + p.w / 2), a.y - (p.y + p.h / 2));
    if (dp < 4 && POTION_FX[kind]) this._applyPotionTo(kind, mod, scale(dp));
    for (const m of [...this.mobs]) {
      const dm = Math.hypot(a.x - (m.x + m.w / 2), a.y - (m.y + m.h / 2));
      if (dm < 4 && POTION_FX[kind]) this._applyPotionToMob(m, kind, mod, scale(dm));
    }
  };
  /** Glasflasche an Wasser füllen */
  P._fillBottle = function (tx, ty) {
    let y = ty;
    if (this.tile(tx, y) !== B.WATER) y = ty + 1;
    if (this.tile(tx, y) !== B.WATER) return false;
    const s = this.selStack();
    this._consumeSel();
    const rest = this.add("potion", 1, potionCode("water"), true);
    if (rest) this.dropStack(stk("potion", 1, potionCode("water")));
    this.events.push({ t: "bucket", fill: true, x: tx, y });
    return s != null;
  };

  // ---------- Verzauberungstisch ----------
  P.enchantable = function (st) { return !!st && !st.e && enchClasses(st.id).length > 0; };
  P.enchShelves = function () {
    const w = this.win; if (!w) return 0;
    let n = 0;
    for (let y = w.y - 1; y <= w.y + 1; y++) for (let x = w.x - 3; x <= w.x + 3; x++) if (this.tile(x, y) === B.BOOKSHELF) n++;
    return Math.min(15, n);
  };
  /** Verzauberungen für Angebotsstärke lv auswählen (deterministisch aus Startwert) */
  P._pickEnchants = function (classes, lv, seed, allowTreasure = false) {
    const r = mulberry32((seed >>> 0) ^ 0x9e3779b1);
    lv = clamp(lv + Math.floor(r() * 5) - 2, 1, 40);
    const poss = (name) => { const e = ENCH[name]; let k = 0; for (let l = 1; l <= e.max; l++) if (lv >= e.base + (l - 1) * e.step) k = l; return k; };
    const pool = () => Object.keys(ENCH).filter(n => (allowTreasure || !ENCH[n].treasure) && applicable(n, classes) && poss(n) > 0);
    const chosen = {};
    const pick = () => {
      const c = pool().filter(n => !chosen[n] && !Object.keys(chosen).some(o => conflicts(o, n)));
      if (!c.length) return false;
      let q = r() * c.reduce((a, n) => a + ENCH[n].w, 0), name = c[0];
      for (const n of c) { q -= ENCH[n].w; if (q < 0) { name = n; break; } }
      const kmax = poss(name);
      chosen[name] = r() < 0.6 ? kmax : 1 + Math.floor(r() * kmax);
      return true;
    };
    if (!pick()) return {};
    let chance = (lv + 1) / 50;
    for (let i = 0; i < 2; i++) { if (r() < chance && pick()) chance /= 2; else break; }
    return chosen;
  };
  /** Die drei Angebote des offenen Tisches oder null */
  P.enchOffers = function () {
    const w = this.win; if (!w || w.kind !== "ench") return null;
    const st = this.grid[0]; if (!this.enchantable(st)) return null;
    const sh = this.enchShelves(), r = mulberry32(this.enchSeed >>> 0);
    const base = 1 + Math.floor(r() * 8) + (sh >> 1) + Math.floor(r() * (sh + 1));
    const reqs = [Math.max(Math.floor(base / 3), 1), Math.floor(base * 2 / 3) + 1, Math.max(base, sh * 2)].map(v => Math.min(30, v));
    const classes = enchClasses(st.id);
    return reqs.map((req, k) => {
      const e = this._pickEnchants(classes, req, this.enchSeed * 3 + k * 977 + req);
      const first = Object.keys(e)[0];
      return { req, cost: k + 1, ench: e, hint: first ? ENCH[first].name + (ENCH[first].max > 1 ? " " + ROMAN[e[first]] : "") + " …" : "" };
    });
  };
  P.pointsFor = function (level) { let t = 0; for (let L = 0; L < level; L++) t += this._need(L); return t; };
  P.spendLevels = function (n) {
    const L = this.level(), frac = this.levelFrac(), nl = Math.max(0, L - n);
    this.xp = this.pointsFor(nl) + Math.floor(frac * this._need(nl));
  };
  P.enchant = function (k) {
    const w = this.win; if (!w || w.kind !== "ench") return false;
    const offers = this.enchOffers(); if (!offers || !offers[k]) return false;
    const o = offers[k], st = this.grid[0], lap = this.grid[1];
    if (!Object.keys(o.ench).length || this.level() < o.req || this.level() < o.cost || !lap || lap.id !== "lapis" || lap.n < o.cost) { this.events.push({ t: "noench" }); return false; }
    this.spendLevels(o.cost);
    lap.n -= o.cost; if (lap.n <= 0) this.grid[1] = null;
    if (st.id === "book") this.grid[0] = { id: "enchanted_book", n: 1, d: 0, e: { ...o.ench } };
    else st.e = { ...o.ench };
    this.enchSeed = (Math.imul(this.enchSeed, 1103515245) + 12345 + o.req) >>> 0;
    this.events.push({ t: "enchant", level: o.req });
    return true;
  };
  /** Gegenstand mit Zufallsverzauberungen versehen (Beute, Fischen) */
  P._enchantStack = function (st, lv) {
    const classes = enchClasses(st.id); if (!classes.length) return st;
    const e = this._pickEnchants(classes, lv, Math.floor(this.frng() * 4e9), false);
    if (Object.keys(e).length) st.e = e;
    return st;
  };
  P._randomBook = function (lv = 25, treasure = false) {
    const e = this._pickEnchants(["book"], lv, Math.floor(this.frng() * 4e9), treasure);
    return { id: "enchanted_book", n: 1, d: 0, e: Object.keys(e).length ? e : { unbreaking: 1 } };
  };

  // ---------- Amboss ----------
  const maxDur = id => (ITEMS[id] && ITEMS[id].dur) || 0;
  const penalty = st => (st && st.r ? Math.pow(2, st.r) - 1 : 0);
  /** Material, mit dem sich ein Gegenstand reparieren lässt */
  function repairMat(id) {
    const it = ITEMS[id]; if (!it || !it.dur) return null;
    if (it.mat === "leather") return "leather";
    if (it.mat && MATERIALS[it.mat]) return MATERIALS[it.mat].ing;
    if (id === "bow" || id === "fishing_rod") return null;
    if (id === "shield") return "#planks";
    return null;
  }
  const matches = (need, id) => (need[0] === "#" ? hasTag(id, need.slice(1)) : need === id);
  /** Ergebnis der Amboss-Rechnung: { out, cost, use: [Anzahl rechts verbraucht] } oder { error } oder null */
  P.anvilPreview = function () {
    const w = this.win; if (!w || w.kind !== "anvil") return null;
    const a = this.grid[0], b = this.grid[1];
    if (!a || !b) return null;
    let out = { id: a.id, n: 1, d: a.d || 0, e: a.e ? { ...a.e } : undefined, r: a.r };
    let cost = penalty(a) + penalty(b), used = 1, any = false;
    const dur = maxDur(a.id);
    // 1) Reparieren mit Material
    const mat = repairMat(a.id);
    if (dur && a.d > 0 && mat && matches(mat, b.id)) {
      const per = Math.ceil(dur / 4);
      let units = 0; let d = out.d;
      while (units < b.n && d > 0) { d = Math.max(0, d - per); units++; }
      out.d = d; used = units; cost += units; any = true;
    } else if (dur && b.id === a.id) {
      // 2) Gleicher Gegenstand: Haltbarkeit zusammenlegen (+12 %)
      if (a.d > 0 || b.d > 0 || b.e) {
        const left = (dur - (a.d || 0)) + (dur - (b.d || 0)) + Math.floor(dur * 0.12);
        out.d = Math.max(0, dur - Math.min(dur, left)); any = out.d !== a.d; cost += 2;
      }
    }
    // 3) Verzauberungen übertragen (Buch oder gleicher Gegenstand)
    const src = b.e && (b.id === "enchanted_book" || b.id === a.id) ? b.e : null;
    if (src) {
      const classes = enchClasses(a.id); const fromBook = b.id === "enchanted_book";
      let added = 0;
      out.e = out.e || {};
      for (const [name, lvl] of Object.entries(src)) {
        if (!ENCH[name] || !applicable(name, classes)) continue;
        if (Object.keys(out.e).some(o => o !== name && conflicts(o, name))) { cost += 1; continue; }
        const have = out.e[name] || 0;
        let nl = have === lvl ? Math.min(ENCH[name].max, lvl + 1) : Math.max(have, lvl);
        if (nl === have) continue;
        out.e[name] = nl; added++;
        const m = ENCH[name].cost;
        cost += nl * (fromBook ? Math.max(1, Math.floor(m / 2)) : m);
      }
      if (added) any = true;
      if (!Object.keys(out.e).length) delete out.e;
    }
    // Buch + Buch ergibt wieder ein verzaubertes Buch
    if (a.id === "book" && out.e) out.id = "enchanted_book";
    if (!any) return { error: "none" };
    out.r = Math.max(a.r || 0, b.r || 0) + 1;
    if (out.id === "enchanted_book" || !maxDur(out.id)) out.d = 0;
    if (cost >= 40) return { error: "expensive", cost };
    return { out, cost: Math.max(1, cost), used };
  };
  P.anvilTake = function (shift) {
    const pv = this.anvilPreview();
    if (!pv || pv.error) return false;
    if (this.level() < pv.cost) { this.events.push({ t: "noench" }); return false; }
    const c = this.cursor;
    if (!shift && c) return false;
    if (shift && this.room(pv.out.id) <= 0) return false;
    this.spendLevels(pv.cost);
    const b = this.grid[1];
    b.n -= pv.used; if (b.n <= 0) this.grid[1] = null;
    this.grid[0] = null;
    if (shift) this._insert(this.inv, pv.out.id, 1, pv.out.d, 0, 36, pv.out); else this.cursor = this.newStack(pv.out.id, 1, pv.out.d, pv.out);
    // Der Amboss nutzt sich ab
    const w = this.win;
    this.events.push({ t: "anvil", x: w.x, y: w.y });
    if (this.frng() < 0.12) {
      const i = w.y * W + w.x;
      if (this.aux[i] >= 2) { this._noDrops = true; this._break(w.x, w.y, false); this._noDrops = false; this.events.push({ t: "anvilbreak" }); }
      else this.aux[i]++;
    }
    return true;
  };

  // ---------- Braustand ----------
  P.brewCanPut = function (idx, st) {
    if (idx < 3) return st.id === "potion" || st.id === "splash_potion";
    if (idx === 3) return BREW_INGREDIENTS.has(st.id);
    return idx === 4 && st.id === "blaze_powder";
  };
  P._brewStep = function (dt) {
    for (const e of this.ents.values()) {
      if (e.t !== "brew") continue;
      const ing = e.s[3], fuel = e.s[4];
      const todo = ing ? [0, 1, 2].filter(k => brewResult(e.s[k], ing.id)) : [];
      if (!todo.length) { e.brewT = 0; continue; }
      if (e.fuel <= 0) {
        if (fuel && fuel.id === "blaze_powder") { e.fuel = 20; fuel.n--; if (fuel.n <= 0) e.s[4] = null; }
        else { e.brewT = 0; continue; }
      }
      e.brewT += dt;
      if (e.brewT >= BREW_TIME) {
        for (const k of todo) e.s[k] = brewResult(e.s[k], ing.id);
        ing.n--; if (ing.n <= 0) e.s[3] = null;
        e.fuel--; e.brewT = 0;
        this.events.push({ t: "brewed" });
      }
    }
  };
}
