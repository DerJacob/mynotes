// =====================================================================
// Blockdorf – Neue Tiere und Monster der Oberwelt (Etappe 12)
//   Tier-Mechanik: Reiten (Sattel), Vertrauen (Fuchs, Lama), Flug-KI (Biene, Allay, Phantom), Gruppen (Lama-Karawane)
//   Tiere: Eisbär, Eiswanderer, Wüstenzombie, Lama, Panda, Fuchs, Biene (Bienenstock, Honig), Ziege (Rammen, Horn), Frosch (Laich, Kaulquappe,
//   Froschlichter), Allay, Kamel, Schnüffler (Ei, Samen), Phantom (Schlafmangel).
// Alles ist Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS, isFluid, hiveHoney, hiveOcc, hiveNec, hiveAux, HIVE_MAX, WP } from "./sandbox-data.js?v=10";
import { MOBS, ADV } from "./sandbox-mobs.js?v=10";
import { BREED_FOOD, BABY_TIME } from "./sandbox-farm.js?v=10";
import { AQUATIC } from "./sandbox-ocean11.js?v=10";
import { mulberry32 } from "./sandbox-noise.js?v=10";

const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const cxOf = m => m.x + m.w / 2;
const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

Object.assign(MOBS, {
  polar_bear: { name: "Eisbär", kind: "neutral", w: 1.8, h: 1.3, hp: 30, speed: 2.7, dmg: 6, range: 12, xp: [1, 3], drops: [["raw_cod", 0, 2, 0.8], ["raw_salmon", 0, 2, 0.5]] },
  stray: { name: "Eiswanderer", kind: "hostile", w: 0.7, h: 1.8, hp: 20, speed: 2.2, dmg: 3, range: 20, xp: [5, 5], drops: [["bone", 0, 2, 1], ["arrow", 0, 2, 1]] },
  husk: { name: "Wüstenzombie", kind: "hostile", w: 0.7, h: 1.8, hp: 20, speed: 2.5, dmg: 3, range: 18, xp: [5, 5], drops: [["rotten_flesh", 0, 2, 1], ["iron_ingot", 1, 1, 0.025], ["carrot", 1, 1, 0.025], ["potato", 1, 1, 0.025]] },
  llama: { name: "Lama", kind: "neutral", w: 1.1, h: 1.75, hp: 22, speed: 1.7, dmg: 1, xp: [1, 3], drops: [["leather", 0, 2, 1]] },
  panda: { name: "Panda", kind: "neutral", w: 1.55, h: 1.25, hp: 20, speed: 1.3, dmg: 6, xp: [1, 3], drops: [["bamboo", 1, 1, 1]] },
  fox: { name: "Fuchs", kind: "neutral", w: 0.85, h: 0.7, hp: 10, speed: 3.4, dmg: 2, xp: [1, 3], drops: [] },
  bee: { name: "Biene", kind: "neutral", w: 0.55, h: 0.5, hp: 10, speed: 3.2, dmg: 2, xp: [1, 3], drops: [] },
  goat: { name: "Ziege", kind: "neutral", w: 0.95, h: 1.2, hp: 10, speed: 2.4, dmg: 2, xp: [1, 3], drops: [] },
  frog: { name: "Frosch", kind: "passive", w: 0.6, h: 0.5, hp: 10, speed: 2.2, xp: [1, 3], drops: [] },
  tadpole: { name: "Kaulquappe", kind: "passive", aq: 1, w: 0.35, h: 0.22, hp: 6, speed: 1.6, xp: [1, 3], drops: [] },
  allay: { name: "Allay", kind: "passive", w: 0.5, h: 0.7, hp: 20, speed: 3.8, xp: [1, 3], drops: [] },
  camel: { name: "Kamel", kind: "passive", w: 2.0, h: 2.05, hp: 32, speed: 2.5, xp: [1, 3], drops: [] },
  sniffer: { name: "Schnüffler", kind: "passive", w: 2.1, h: 1.9, hp: 14, speed: 1.0, xp: [1, 3], drops: [] },
  phantom: { name: "Phantom", kind: "hostile", w: 1.3, h: 0.55, hp: 20, speed: 4.4, dmg: 3, range: 30, xp: [5, 5], drops: [["phantom_membrane", 0, 1, 0.8]] }
});
AQUATIC.add("tadpole");
Object.assign(BREED_FOOD, {
  llama: ["hay_block"], panda: ["bamboo"], fox: ["sweet_berries"], bee: ["flower"], goat: ["wheat"], frog: ["slimeball"], camel: ["cactus"], sniffer: ["torchflower_seeds"],
  polar_bear: ["raw_cod", "raw_salmon"]
});
Object.assign(ADV, {
  beekeeper: ["Imker", "Hole Honig oder Honigwaben aus einem Bienenstock."],
  saddle: ["Im Sattel", "Sattle ein Tier und reite los."],
  trust: ["Vertrauenssache", "Gewinne das Vertrauen eines Lamas oder zieh einen Fuchs groß."],
  horn: ["Hornbläser", "Erbeute ein Ziegenhorn."],
  sniffer: ["Schnüffelnase", "Lass ein Schnüffler-Ei schlüpfen."],
  frog: ["Froschkönig", "Lass eine Kaulquappe zum Frosch heranwachsen."],
  allay: ["Kleiner Helfer", "Gib einem Allay einen Gegenstand."],
  froglight: ["Leuchtfrosch", "Erhalte ein Froschlicht."],
  phantom: ["Schlaflos", "Erlege ein Phantom."]
});

/** Reittiere: Geschwindigkeit, Sprungkraft, Sitzhöhe des Reiters unter der Oberkante */
export const RIDE = { camel: { spd: 5.6, jump: 11, seat: 0.5 }, pig: { spd: 3.8, jump: 8.5, seat: 0.05 } };
export const PANDA_TYPES = ["normal", "lazy", "worried", "playful", "aggressive", "weak", "brown"];
export const PHANTOM_DAYS = 3;                        // so viele Tage ohne Schlaf, bis Phantome kommen
export const HIVE_SPAN = 48;                          // so weit um den Spieler werden Bienenstöcke berechnet
export const EGG_TICKS = 45;                          // Schritte (2 s) bis das Schnüffler-Ei schlüpft; auf Moos doppelt so schnell
const COLD = new Set(["snow", "taiga", "grove", "snowy_slopes", "jagged_peaks"]);
const WARM = new Set(["desert", "savanna", "jungle", "bamboo", "mangrove"]);
const FLOWERS = new Set([B.FLOWER, B.PINK_PETALS, B.FLOWERING_AZALEA]);
const DIGGABLE = new Set([B.GRASS, B.DIRT, B.MOSS_BLOCK, B.MUD, B.GRASS_SNOW]);
const frogVar = bi => (COLD.has(bi) ? 2 : WARM.has(bi) ? 1 : 0);
/** Welche Tiere kommen wo (Gewicht) – neben den Tieren aus sandbox-mobs.js */
export const FAUNA_W = {
  plains: { llama: 1 }, meadow: { goat: 2, llama: 1 }, savanna: { llama: 3, camel: 3 }, desert: { camel: 3 }, taiga: { fox: 3 }, snow: { fox: 1, polar_bear: 2 },
  jungle: { panda: 2, frog: 2 }, bamboo: { panda: 3 }, swamp: { frog: 4 }, mangrove: { frog: 3 }, mountains: { goat: 2, llama: 2 }, grove: { goat: 2, fox: 2 },
  snowy_slopes: { goat: 3 }, jagged_peaks: { goat: 3 }, stony_peaks: { goat: 3, llama: 1 }, forest: { fox: 1 }, dappled: { fox: 1 }
};
const GROUP_N = { llama: [3, 5], goat: [1, 2], panda: [1, 1], fox: [1, 2], camel: [1, 2], frog: [2, 3], polar_bear: [1, 2] };
const E12 = new Set(Object.keys(FAUNA_W).flatMap(b => Object.keys(FAUNA_W[b])));

export function installFauna(Sandbox, K) {
  const { clamp, W, H, SURF } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1, d = 0) => ({ id, n, d });
  const approach = (m, tvx, tvy, a, dt) => {
    m.vx += clamp(tvx - m.vx, -a * dt, a * dt);
    m.vy += clamp(tvy - m.vy, -a * dt, a * dt);
  };
  /** Flieger bewegt sich auf einen Punkt zu (wird vor dem Ziel langsamer) */
  const flyTo = (m, tx, ty, spd, a, dt) => {
    const dx = tx - cxOf(m), dy = ty - (m.y + m.h / 2), L = Math.hypot(dx, dy) || 1, k = Math.min(1, L / 1.6);
    approach(m, dx / L * spd * k, dy / L * spd * k, a, dt);
    if (Math.abs(dx) > 0.2) m.face = sgn(dx);
  };
  const flyStep = function (e, m, dt) { e._flyBody(m, dt); m.x = clamp(m.x, 0, W - m.w); };
  const makeBaby = (e, m, t = BABY_TIME) => {
    const d = MOBS[m.type], feet = m.y + m.h;
    m.w = d.w * 0.55; m.h = d.h * 0.55; m.y = feet - m.h - 0.001; m.baby = t;
  };
  const freeAir = (e, x, y) => {                       // über festen Blöcken nach einem freien Platz suchen
    x = clamp(Math.floor(x), 1, W - 2); y = Math.floor(y);
    for (let k = 0; k < 8; k++) { const yy = y - k; if (yy < 3) break; if (!BLOCKS[e.tile(x, yy)].solid && !isFluid(e.tile(x, yy))) return yy + 0.5; }
    return Math.max(3, y - 8);
  };
  const bushTop = (e, x) => e.ground[clamp(Math.floor(x), 0, W - 1)] - 1;

  // =================================================================
  // Erzeugen
  // =================================================================
  const prevInit = P._mobInitNew;
  /** Vorgaben setzen, ohne bereits gegebene Werte (extra beim Erzeugen) zu überschreiben */
  const D = (m, o) => { for (const k of Object.keys(o)) if (m[k] === undefined) m[k] = o[k]; };
  P._mobInitNew = function (m, type) {
    prevInit.call(this, m, type);
    const r = () => this.mrng(), bi = this.dim ? "" : this.biomeAt(Math.floor(m.x));
    switch (type) {
      case "llama": D(m, { var: Math.floor(r() * 4), spitCd: 1 + r() * 2, grT: r(), angT: 0, lead: null }); break;
      case "panda": D(m, { var: r() < 0.08 ? 6 : Math.floor(r() * 6), snT: 90 + r() * 110, lieT: 0, eatT: 0, roll: 0 }); break;
      case "fox": D(m, { var: COLD.has(bi) ? 1 : 0, huntCd: 0, sleeping: false }); break;
      case "bee": D(m, { fly: true, nec: false, hv: null, pollT: 0, angT: 0, flT: r(), fl: null, tx: m.x, ty: m.y, wT: 0, stung: false, hvT: 0 }); break;
      case "goat": D(m, { var: r() < 0.06 ? 1 : 0, horn: 2, ramCd: 8 + r() * 20, ram: 0, ramT: 0, rdir: 1 }); break;
      case "frog": D(m, { var: frogVar(bi), hopT: r(), tongue: 0, preg: false }); break;
      case "tadpole": D(m, { age: 0 }); break;
      case "allay": D(m, { fly: true, want: null, hold: null, owner: false, tx: m.x, ty: m.y, wT: 0, relCd: 0, hy: m.y, home: cxOf(m) }); break;
      case "camel": D(m, { sitT: 30 + r() * 60, sitting: false, sitDur: 0 }); break;
      case "sniffer": D(m, { snT: 15 + r() * 25, dig: 0, tgt: null }); break;
      case "phantom": D(m, { fly: true, ph: "circle", phT: 3 + r() * 4, ang: r() * 6.28 }); break;
    }
  };

  // natürliche Spawns: Zombie in der Wüste → Wüstenzombie, Skelett im Schnee → Eiswanderer
  const prevSpawnMob = P.spawnMob;
  P.spawnMob = function (type, x, y, extra = {}) {
    if (this._natural && !this.dim && (type === "zombie" || type === "skeleton") && y <= this.ground[clamp(Math.floor(x), 0, W - 1)] + 3) {
      const bi = this.biomeAt(Math.floor(x));
      if (type === "zombie" && bi === "desert" && this.mrng() < 0.85) type = "husk";
      else if (type === "skeleton" && (bi === "snow" || bi === "snowy_slopes" || bi === "jagged_peaks" || bi === "grove") && this.mrng() < 0.85) type = "stray";
    }
    return prevSpawnMob.call(this, type, x, y, extra);
  };
  const prevMobSpawn = P._mobSpawn;
  P._mobSpawn = function (dt) {
    this._natural = true;
    try { prevMobSpawn.call(this, dt); } finally { this._natural = false; }
  };

  // =================================================================
  // Künstliche Intelligenz
  // =================================================================
  const prevAi = P._aiNew;
  P._aiNew = function (m, d, dt, dx, dy, dist) {
    const p = this.player;
    if (p.ride === m && RIDE[m.type]) { this._aiRidden(m, d, dt); return 1; }
    switch (m.type) {
      case "polar_bear": this._aiBear(m, d, dt, dx, dy, dist); return 1;
      case "stray": {
        const n0 = this.proj.length;
        this._aiRanged(m, d, dt, dx, dy, dist, "arrow");
        if (this.proj.length > n0) this.proj[this.proj.length - 1].stray = true;
        return 1;
      }
      case "husk": this._aiMelee(m, d, dt, dx, dy, dist, 11); return 1;
      case "llama": this._aiLlama(m, d, dt, dx, dy, dist); return 1;
      case "panda": this._aiPanda(m, d, dt, dx, dy, dist); return 1;
      case "fox": this._aiFox(m, d, dt, dx, dy, dist); return 1;
      case "bee": return this._aiBee(m, d, dt, dx, dy, dist);
      case "goat": this._aiGoat(m, d, dt, dx, dy, dist); return 1;
      case "frog": this._aiFrog(m, d, dt, dx, dy, dist); return 1;
      case "tadpole": return this._aiTadpole(m, d, dt, dx, dy, dist);
      case "allay": return this._aiAllay(m, d, dt, dx, dy, dist);
      case "camel": this._aiCamel(m, d, dt, dx, dy, dist); return 1;
      case "sniffer": this._aiSniffer(m, d, dt, dx, dy, dist); return 1;
      case "phantom": return this._aiPhantom(m, d, dt, dx, dy, dist);
    }
    return prevAi.call(this, m, d, dt, dx, dy, dist);
  };
  // Pfeile des Eiswanderers verlangsamen
  const prevSpecial = P._projSpecial;
  P._projSpecial = function (a, dt) { this._curProj = a; return prevSpecial.call(this, a, dt); };
  const prevProjs = P._projectiles;
  P._projectiles = function (dt) { try { prevProjs.call(this, dt); } finally { this._curProj = null; } };
  const prevHurtPl = P.hurt;
  P.hurt = function (n, dir, why) {
    const a = this._curProj, hp = this.player.hp;
    prevHurtPl.call(this, n, dir, why);
    if (a && a.stray && why === "arrow" && this.player.hp < hp) this.addEffect("slowness", 30, 0);
  };
  const prevTouch = P._touch;
  P._touch = function (m, d, dt) {
    const p = this.player, hp = p.hp;
    prevTouch.call(this, m, d, dt);
    if (m.type === "husk" && p.hp < hp) this.addEffect("hunger", 7, 0);
  };
  /** Hunger-Effekt: Erschöpfung steigt schneller */
  P._faunaFx = function (dt) { if (this.fx && this.fx.hunger) this.addExh(0.1 * dt * this.fxAmp("hunger")); };

  // ---------- Reiten ----------
  P._aiRidden = function (m, d, dt) {
    const inp = this.input, rd = RIDE[m.type], dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    m.panic = 0; m.sitting = false; m.sitT = 20 + this.mrng() * 40;
    this._steer(m, dir, rd.spd, dt, 11);
    if (inp.jump && m.onGround) { m.vy = -rd.jump; m.onGround = false; }
  };
  const prevPlayer = P._player;
  P._player = function (dt) {
    const p = this.player, m = p.ride;
    if (m) {
      const inp = this.input;
      if (m.dead || !this.mobs.includes(m) || inp.down || (m.inLava) || (m.inWater && m.type === "camel")) this._dismount();
      else {
        p.invuln = Math.max(0, p.invuln - dt); p.atkCd = Math.max(0, p.atkCd - dt);
        p.x = clamp(cxOf(m) - p.w / 2, 0, W - p.w); p.y = m.y + (RIDE[m.type] ? RIDE[m.type].seat : 0.4) - p.h; p.vx = p.vy = 0; p.onGround = true; p.landV = 0; p.coyote = 0.1;
        p.face = m.face; p.inWater = p.inLava = false;
        return;
      }
    }
    prevPlayer.call(this, dt);
  };
  P._dismount = function () {
    const p = this.player, m = p.ride; p.ride = null;
    if (!m) return;
    const q = this._safeSpot(clamp(cxOf(m) - p.w / 2 + (m.face || 1) * 0.9, 0, W - p.w), m.y + m.h - p.h - 0.01);
    p.x = q.x; p.y = q.y; p.vx = 0; p.vy = 0; p.onGround = false;
    this.events.push({ t: "dismount" });
  };
  P._mount = function (m) {
    const p = this.player;
    p.ride = m; m.sitting = false;
    p.x = cxOf(m) - p.w / 2; p.y = m.y + RIDE[m.type].seat - p.h; p.vx = p.vy = 0;
    this.grant("saddle");
    this.events.push({ t: "mount", type: m.type });
  };

  // ---------- Eisbär, Panda, Fuchs, Lama ----------
  P._aiBear = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    const p = this.player;
    if (m.baby > 0) {                                        // Jungtier folgt einer Mutter
      let mom = null, bd = 12;
      for (const o of this.mobs) if (o.type === "polar_bear" && !(o.baby > 0) && !o.dead && Math.abs(cxOf(o) - cxOf(m)) < bd) { mom = o; bd = Math.abs(cxOf(o) - cxOf(m)); }
      if (mom && bd > 2.5) this._steer(m, sgn(cxOf(mom) - cxOf(m)), d.speed * 0.9, dt); else this._wander(m, d, dt, 0.7);
      return;
    }
    if (!m.angry) for (const o of this.mobs) if (o.type === "polar_bear" && o.baby > 0 && Math.abs(cxOf(o) - cxOf(m)) < 9 && Math.abs(cxOf(o) - (p.x + p.w / 2)) < 4.5 && Math.abs(o.y - p.y) < 3) { m.angry = true; break; }
    if (m.angry) {
      if (dist > 26) m.angry = false;
      this._steer(m, Math.abs(dx) > 0.8 ? sgn(dx) : 0, d.speed * 1.25, dt, 11);
      this._touch(m, d, dt);
    } else this._wander(m, d, dt, 0.8);
  };
  P._aiPanda = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    const p = this.player;
    m.snT -= dt;
    if (m.baby > 0 && m.snT <= 0) { m.snT = 90 + this.mrng() * 110; this.dropStack(stk("slimeball"), cxOf(m), m.y, true); this.events.push({ t: "sneeze", x: cxOf(m), y: m.y }); }
    if (m.var === 4 && !m.angry && dist < 5 && Math.abs(dy) < 2.5) m.angry = true;
    if (m.angry) {
      if (dist > 20) m.angry = false;
      this._steer(m, Math.abs(dx) > 0.8 ? sgn(dx) : 0, d.speed * 1.5, dt, 10);
      this._touch(m, d, dt);
      return;
    }
    if (m.panic > 0) { m.panic -= dt; this._steer(m, m.flee, d.speed * 1.6, dt); return; }
    m.eatT = Math.max(0, m.eatT - dt); m.lieT = Math.max(0, m.lieT - dt); m.roll = Math.max(0, m.roll - dt);
    if (m.eatT > 0 || m.lieT > 0) { this._steer(m, 0, 0, dt); return; }
    // Bambus vom Boden fressen
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const dr = this.drops[i];
      if (dr.id !== "bamboo" || Math.abs(dr.x - cxOf(m)) > 5 || Math.abs(dr.y - m.y) > 2.5) continue;
      if (Math.abs(dr.x - cxOf(m)) < 1.0) { this.drops.splice(i, 1); m.eatT = 4; m.hp = Math.min(m.maxHp, m.hp + 2); this.events.push({ t: "eat", x: cxOf(m), y: m.y }); return; }
      this._steer(m, sgn(dr.x - cxOf(m)), d.speed * 0.8, dt); return;
    }
    if (m.var === 1 && this.mrng() < dt * 0.05) { m.lieT = 6 + this.mrng() * 6; return; }                  // Fauler Panda legt sich hin
    if (m.var === 3 && m.onGround && this.mrng() < dt * 0.12) { m.roll = 1.2; m.vy = -6; m.vx = m.face * 3.5; m.onGround = false; return; }   // Verspielter Panda rollt
    this._wander(m, d, dt, 0.9);
  };
  P._aiFox = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    const night = this.dayFactor() < 0.5;
    m.huntCd -= dt;
    if (m.panic > 0) { m.panic -= dt; this._steer(m, m.flee, d.speed * 1.5, dt, 11); return; }
    if (m.trust) {                                           // vertraut dem Spieler: folgt und hilft im Kampf
      if (dist > 16) { this._teleport(m, 3, true); return; }
      let tgt = null, bd = 9;
      for (const o of this.mobs) if (o.kind === "hostile" && o.type !== "creeper" && Math.abs(cxOf(o) - this.player.x) < 8 && Math.hypot(cxOf(o) - cxOf(m), o.y - m.y) < bd) { tgt = o; bd = Math.hypot(cxOf(o) - cxOf(m), o.y - m.y); }
      if (tgt) {
        const dir = sgn(cxOf(tgt) - cxOf(m)); this._steer(m, Math.abs(cxOf(tgt) - cxOf(m)) > 0.6 ? dir : 0, d.speed * 1.3, dt);
        if (m.atkCd <= 0 && touching(m, tgt, 0.25)) { m.atkCd = 0.9; this._mobHurt(tgt, 3, dir, "fox"); }
        return;
      }
      if (Math.abs(dx) > 3.5) this._steer(m, sgn(dx), d.speed * 1.1, dt); else this._steer(m, 0, 0, dt);
      return;
    }
    if (!m.angry && dist < 5.5 && Math.abs(dy) < 3) { m.panic = 2.2; m.flee = -sgn(dx) || 1; m.sleeping = false; return; }   // scheu
    if (m.angry) {
      if (dist > 20) m.angry = false;
      this._steer(m, Math.abs(dx) > 0.6 ? sgn(dx) : 0, d.speed, dt, 11); this._touch(m, d, dt); return;
    }
    if (!night) { m.sleeping = true; this._steer(m, 0, 0, dt); return; }                                   // tagsüber schlafen
    m.sleeping = false;
    let prey = null, bd = 14;
    if (m.huntCd <= 0) for (const o of this.mobs) if ((o.type === "chicken" || o.type === "rabbit") && !o.dead && Math.hypot(cxOf(o) - cxOf(m), o.y - m.y) < bd) { prey = o; bd = Math.hypot(cxOf(o) - cxOf(m), o.y - m.y); }
    if (prey) {
      const dir = sgn(cxOf(prey) - cxOf(m));
      if (bd < 3 && m.onGround && m.leapCd === undefined) { m.vy = -7; m.vx = dir * 6; m.onGround = false; m.leapCd = 1; }
      else this._steer(m, Math.abs(cxOf(prey) - cxOf(m)) > 0.5 ? dir : 0, d.speed * 1.2, dt, 11);
      if (m.leapCd !== undefined) { m.leapCd -= dt; if (m.leapCd <= 0) m.leapCd = undefined; }
      if (touching(m, prey, 0.2)) { m.huntCd = 8; m.hp = Math.min(m.maxHp, m.hp + 2); this._mobHurt(prey, 5, dir, "fox"); }
      return;
    }
    this._wander(m, d, dt);
  };
  /** Wer gehört zu meiner Gruppe? Folgt dem nächsten Artgenossen mit kleinerer Nummer (so entsteht die Karawane) */
  const refreshLead = (e, m) => {
    let best = null, bd = 12;
    for (const o of e.mobs) if (o !== m && o.type === m.type && !o.dead && !(o.baby > 0) && o.id < m.id && Math.abs(cxOf(o) - cxOf(m)) < bd && Math.abs(o.y - m.y) < 6) { best = o; bd = Math.abs(cxOf(o) - cxOf(m)); }
    m.lead = best;
  };
  P._aiLlama = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    const p = this.player;
    m.spitCd -= dt; m.grT -= dt;
    if (m.grT <= 0) { m.grT = 1.5; refreshLead(this, m); }
    if (m.angT > 0) {                                        // verärgert: spuckt
      m.angT -= dt;
      if (dist > 22) m.angT = 0;
      m.face = sgn(dx) || m.face;
      if (m.spitCd <= 0 && dist < 14 && this._los(cxOf(m), m.y + 0.5, p.x + p.w / 2, p.y + 0.7)) { m.spitCd = 2.2 + this.mrng(); this._shoot(m, "spit", p.x + p.w / 2, p.y + 0.7, 15, 1); }
      this._steer(m, dist < 5 ? -sgn(dx) : 0, d.speed, dt);
      return;
    }
    if (m.panic > 0) { m.panic -= dt; this._steer(m, m.flee, d.speed * 1.4, dt); return; }
    if (m.trust) {                                           // zahmes Lama folgt dem Spieler in der Reihe
      let rank = 0; for (const o of this.mobs) if (o.type === "llama" && o.trust && !o.dead && o.id < m.id && Math.abs(cxOf(o) - cxOf(m)) < 30) rank++;
      if (dist > 22) { this._teleport(m, 4, true); return; }
      const stop = 2.6 + rank * 1.6;
      if (Math.abs(dx) > stop) { const dir = sgn(dx); if (!(m.onGround && this._cliffAhead(m, dir) && dy < 2)) this._steer(m, dir, d.speed * 2.2, dt, 12); else this._steer(m, 0, 0, dt); }
      else this._steer(m, 0, 0, dt);
      return;
    }
    const L = m.lead;
    if (L && !L.dead && this.mobs.includes(L)) {
      const ld = cxOf(L) - cxOf(m);
      if (Math.abs(ld) > 15) { m.lead = null; return; }
      if (Math.abs(ld) > 2.2) { const dir = sgn(ld); if (!(m.onGround && this._cliffAhead(m, dir))) this._steer(m, dir, d.speed * 1.2, dt, 11); else this._steer(m, 0, 0, dt); }
      else this._steer(m, 0, 0, dt);
      return;
    }
    this._wander(m, d, dt, 0.8);
  };

  // ---------- Biene ----------
  const hiveAt = (e, x, y) => { const id = e.tile(x, y); return id === B.BEEHIVE || id === B.BEE_NEST; };
  /** Nächster Stock mit freiem Platz */
  const findHive = (e, m, r = 22) => {
    let best = null, bd = 1e9;
    const x0 = Math.floor(cxOf(m)), y0 = Math.floor(m.y);
    for (let x = x0 - r; x <= x0 + r; x++) for (let y = y0 - 8; y <= y0 + 8; y++) {
      if (!hiveAt(e, x, y) || hiveOcc(e.aux[y * W + x]) >= HIVE_MAX) continue;
      const dd = Math.abs(x - x0) + Math.abs(y - y0) * 1.5; if (dd < bd) { bd = dd; best = [x, y]; }
    }
    return best;
  };
  const findFlower = (e, m, r = 13) => {
    let best = null, bd = 1e9;
    const x0 = Math.floor(cxOf(m)), y0 = Math.floor(m.y);
    for (let x = x0 - r; x <= x0 + r; x++) for (let y = y0 - 6; y <= y0 + 6; y++) {
      if (!FLOWERS.has(e.tile(x, y))) continue;
      const dd = Math.abs(x - x0) + Math.abs(y - y0) * 1.5 + e.mrng() * 3; if (dd < bd) { bd = dd; best = [x, y]; }
    }
    return best;
  };
  P._hiveEnter = function (m, hx, hy) {
    if (!hiveAt(this, hx, hy)) return false;
    const i = hy * W + hx, a = this.aux[i];
    if (hiveOcc(a) >= HIVE_MAX) return false;
    this.aux[i] = hiveAux(hiveHoney(a), hiveOcc(a) + 1, hiveNec(a) + (m.nec ? 1 : 0));
    this._remove(m);
    this.events.push({ t: "bee_in", x: hx + 0.5, y: hy + 0.5 });
    return true;
  };
  /** Eine Biene aus dem Stock lassen (angry = gleich wütend). Gibt die Biene oder null. */
  P._hiveRelease = function (hx, hy, angry = false) {
    const i = hy * W + hx, a = this.aux[i];
    if (!hiveAt(this, hx, hy) || hiveOcc(a) <= 0) return null;
    let spot = null;
    for (const [ox, oy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) { const t = this.tile(hx + ox, hy + oy); if (!BLOCKS[t].solid && !isFluid(t)) { spot = [hx + ox, hy + oy]; break; } }
    if (!spot) return null;
    const d = MOBS.bee, m = this.spawnMob("bee", spot[0] + 0.5 - d.w / 2, spot[1] + 0.5 + d.h / 2);
    if (this._hit(m)) { this.mobs.pop(); return null; }
    let honey = hiveHoney(a), nec = hiveNec(a);
    if (nec > 0) { nec--; honey = Math.min(5, honey + 1); }
    this.aux[i] = hiveAux(honey, hiveOcc(a) - 1, nec);
    m.hv = [hx, hy]; m.fly = true;
    if (angry) m.angT = 25;
    return m;
  };
  /** Wütende Bienen: alle in der Nähe, optional die Bewohner des Stocks */
  P._beesAnger = function (x, y, r = 10) {
    for (const o of this.mobs) if (o.type === "bee" && !o.dead && Math.abs(cxOf(o) - x) < r && Math.abs(o.y - y) < r) o.angT = 25;
  };
  P._hiveCalm = function (hx, hy) {                                           // Lagerfeuer unter dem Stock beruhigt die Bienen
    for (let dx = -1; dx <= 1; dx++) for (let dy = 1; dy <= 5; dy++) if (this.tile(hx + dx, hy + dy) === B.CAMPFIRE) return true;
    return false;
  };
  P._hiveAnger = function (hx, hy, occ) {
    if (this._hiveCalm(hx, hy)) return;
    for (let k = 0; k < occ; k++) this._hiveRelease(hx, hy, true);
    this._beesAnger(hx + 0.5, hy + 0.5);
  };
  P._aiBee = function (m, d, dt, dx, dy, dist) {
    const p = this.player, pcx = p.x + p.w / 2;
    m.flT -= dt; m.wT -= dt;
    if (m.angT > 0) {
      m.angT -= dt;
      if (!m.stung) {
        flyTo(m, pcx, p.y + 0.9, d.speed * 1.15, 16, dt);
        if (touching(m, p, 0.12) && m.atkCd <= 0) { m.atkCd = 1; m.stung = true; m.dieT = 0.8; this.hurt(2, sgn(pcx - cxOf(m)) || 1, "mob"); this.addEffect("poison", 10, 0); this.events.push({ t: "sting", x: cxOf(m), y: m.y }); }
      } else {
        m.dieT -= dt;
        approach(m, 0, 2, 10, dt);
        if (m.dieT <= 0) { this._remove(m); return 2; }
      }
      flyStep(this, m, dt);
      return 2;
    }
    const day = this.dayFactor() > 0.35 && !this.dim;
    // Wohnort pflegen
    m.hvT -= dt;
    if (m.hvT <= 0) { m.hvT = 3 + this.mrng() * 2; if (!m.hv || !hiveAt(this, m.hv[0], m.hv[1])) m.hv = findHive(this, m); }
    if (m.nec && (!day || true) && m.hv) {                                  // Nektar abliefern
      const hx = m.hv[0] + 0.5, hy = m.hv[1] + 0.5;
      flyTo(m, hx, hy, d.speed, 10, dt);
      if (Math.abs(cxOf(m) - hx) < 0.8 && Math.abs(m.y + m.h / 2 - hy) < 0.9 && this._hiveEnter(m, m.hv[0], m.hv[1])) return 2;
    } else if (!day && m.hv) {                                              // Nacht: nach Hause
      const hx = m.hv[0] + 0.5, hy = m.hv[1] + 0.5;
      flyTo(m, hx, hy, d.speed, 10, dt);
      if (Math.abs(cxOf(m) - hx) < 0.8 && Math.abs(m.y + m.h / 2 - hy) < 0.9 && this._hiveEnter(m, m.hv[0], m.hv[1])) return 2;
    } else if (day && !m.nec) {
      if (!m.fl || !FLOWERS.has(this.tile(m.fl[0], m.fl[1]))) { m.fl = null; if (m.flT <= 0) { m.flT = 1.5 + this.mrng(); m.fl = findFlower(this, m); } }
      if (m.fl) {
        const fx = m.fl[0] + 0.5, fy = m.fl[1] - 0.2;
        flyTo(m, fx, fy, d.speed * 0.8, 10, dt);
        if (Math.abs(cxOf(m) - fx) < 0.7 && Math.abs(m.y + m.h / 2 - fy) < 0.8) {
          m.pollT += dt;
          if (m.pollT >= 4) { m.pollT = 0; m.nec = true; m.fl = null; this.events.push({ t: "pollen", x: cxOf(m), y: m.y }); }
        } else m.pollT = 0;
      } else this._flyWander(m, d, dt, m.hv ? m.hv[0] + 0.5 : cxOf(m), m.hv ? m.hv[1] : bushTop(this, cxOf(m)) - 2, 9);
    } else this._flyWander(m, d, dt, cxOf(m), bushTop(this, cxOf(m)) - 2, 5);
    if (m.blocked) { m.wT = 0; m.fl = null; }
    flyStep(this, m, dt);
    return 2;
  };
  /** Flieger streift um einen Mittelpunkt */
  P._flyWander = function (m, d, dt, hx, hy, R) {
    if (m.wT <= 0) {
      m.wT = 1.5 + this.mrng() * 2.5;
      m.tx = hx + (this.mrng() - 0.5) * 2 * R; m.ty = freeAir(this, m.tx, hy + (this.mrng() - 0.5) * R);
    }
    flyTo(m, m.tx, m.ty, d.speed * 0.45, 7, dt);
  };

  // ---------- Ziege ----------
  P._aiGoat = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    const p = this.player, scream = m.var === 1;
    m.ramCd -= dt;
    if (m.panic > 0) { m.panic -= dt; this._steer(m, m.flee, d.speed * 1.6, dt, 15); return; }
    if (m.ram === 1) {                                       // Anlauf nehmen
      m.ramT -= dt; this._steer(m, 0, 0, dt); m.face = m.rdir;
      if (m.ramT <= 0) { m.ram = 2; m.ramT = 1.4; }
      return;
    }
    if (m.ram === 2) {                                       // Sturmangriff
      m.ramT -= dt;
      const wall = m.blocked && m.onGround;
      this._steer(m, m.rdir, scream ? 10 : 8, dt, 0);
      let hit = false;
      if (touching(m, p, 0.1) && p.invuln <= 0) { this.hurt(scream ? 3 : 2, m.rdir, "mob"); p.vx = m.rdir * 11; hit = true; }
      for (const o of this.mobs) if (o !== m && !o.dead && o.type !== "goat" && o.kind !== "hostile" && touching(m, o, 0.1)) { this._mobHurt(o, 2, m.rdir, "goat"); hit = true; break; }
      if (wall) {                                            // Wand gerammt: Horn fällt ab
        const t = this.tile(Math.floor(cxOf(m) + m.rdir * (m.w / 2 + 0.4)), Math.floor(m.y + m.h * 0.5));
        if (BLOCKS[t].solid && BLOCKS[t].hard >= 1.5 && m.horn > 0 && !(m.baby > 0)) {
          m.horn--; this.dropStack(stk("goat_horn", 1, (scream ? 4 : 0) + Math.floor(this.mrng() * 4)), cxOf(m) + m.rdir * 0.8, m.y + 0.4, true);
          this.events.push({ t: "horn_drop", x: cxOf(m), y: m.y });
        }
        hit = true;
      }
      if (hit || m.ramT <= 0) { m.ram = 3; m.ramT = 2; }
      return;
    }
    if (m.ram === 3) { m.ramT -= dt; this._steer(m, 0, 0, dt); if (m.ramT <= 0) { m.ram = 0; m.ramCd = scream ? 5 + this.mrng() * 7 : 14 + this.mrng() * 20; } return; }
    if (m.ramCd <= 0 && !(m.baby > 0)) {
      let tgt = null;
      if (dist < 11 && Math.abs(dy) < 3 && this._los(cxOf(m), m.y + 0.5, p.x + p.w / 2, p.y + 0.7)) tgt = p;
      else for (const o of this.mobs) if (o !== m && !o.dead && o.kind === "passive" && !MOBS[o.type].aq && o.type !== "goat" && Math.abs(cxOf(o) - cxOf(m)) < 9 && Math.abs(o.y - m.y) < 2) { tgt = o; break; }
      if (tgt) { m.ram = 1; m.ramT = 0.9; m.rdir = sgn(cxOf(tgt) - cxOf(m)) || 1; return; }
      m.ramCd = 4 + this.mrng() * 6;
    }
    // Ziegen springen gern: Wandern mit hohen Sprüngen, ohne Angst vor Abgründen
    m.t -= dt;
    if (m.t <= 0) { const r = this.mrng(); if (r < 0.4) { m.dir = 0; m.t = 1 + this.mrng() * 3; } else { m.dir = r < 0.7 ? -1 : 1; m.t = 1 + this.mrng() * 3; } }
    this._steer(m, m.dir, d.speed * 0.7, dt, 16);
    if (m.dir && m.onGround && this.mrng() < dt * 0.25) { m.vy = -13 - this.mrng() * 3; m.onGround = false; }
  };

  // ---------- Frosch, Kaulquappe ----------
  P._aiFrog = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    m.hopT -= dt; m.tongue = Math.max(0, m.tongue - dt);
    let dir = 0;
    // Beute: Schleim (und Magmawürfel)
    let prey = null;
    if (m.tongue <= 0) for (const o of this.mobs) if ((o.type === "slime" || o.type === "magma_cube") && !o.dead && Math.abs(cxOf(o) - cxOf(m)) < 6 && Math.abs(o.y - m.y) < 2.5) { prey = o; break; }
    if (prey) {
      dir = sgn(cxOf(prey) - cxOf(m)); m.face = dir || m.face;
      if (Math.abs(cxOf(prey) - cxOf(m)) < 3.2) { this._frogEat(m, prey); dir = 0; }
    } else if (m.preg) {                                      // trächtig: zum Wasser hüpfen und Laich legen
      m.pgT -= dt;
      const w = m.wtx !== undefined && this.tile(m.wtx, m.wty) === B.WATER ? [m.wtx, m.wty] : this._waterSurface(cxOf(m), 26);
      if (!w || m.pgT <= 0) m.preg = false;
      else {
        m.wtx = w[0]; m.wty = w[1];
        if (Math.abs(cxOf(m) - (w[0] + 0.5)) < 1.7 && Math.abs(m.y + m.h - w[1]) < 2.5) {
          this.aux[w[1] * W + w[0]] = WP.SPAWN; m.preg = false; this.events.push({ t: "spawn", x: w[0] + 0.5, y: w[1] });
        } else dir = sgn(w[0] + 0.5 - cxOf(m));
      }
    } else if (!m.inWater) {
      m.t -= dt;
      if (m.t <= 0) { const r = this.mrng(); m.dir = r < 0.4 ? 0 : r < 0.7 ? -1 : 1; m.t = 1 + this.mrng() * 3; }
      dir = m.dir;
    } else { m.t -= dt; if (m.t <= 0) { m.dir = this.mrng() < 0.5 ? -1 : 1; m.t = 1 + this.mrng() * 2; } dir = m.dir; }
    if (dir && m.onGround && this._cliffAhead(m, dir) && !m.preg) dir = -dir;
    if (dir && m.hopT <= 0 && (m.onGround || m.inWater)) {
      m.vy = m.inWater ? -4.5 : -9.5; m.vx = dir * d.speed * 1.5; m.hopT = 0.55 + this.mrng() * 0.8; m.onGround = false; m.face = dir;
      if (this.mrng() < 0.08) m.dir = -m.dir;
    } else if (m.onGround) m.vx *= 0.7;
  };
  P._frogEat = function (m, prey) {
    m.tongue = 1.2;
    this.events.push({ t: "tongue", x: cxOf(m), y: m.y, tx: cxOf(prey), ty: prey.y });
    const x = cxOf(prey), y = prey.y + prey.h / 2;
    this._mobHurt(prey, 9999, 0, "frog");
    const lamp = m.var === 2 ? "verdant_froglight" : m.var === 1 ? "pearl_froglight" : "ochre_froglight";
    this.dropStack(stk(lamp), x, y, true);
    m.hp = Math.min(m.maxHp, m.hp + 2);
  };
  /** Nächste Wasserquelle an der Oberfläche (Luft darüber) in Reichweite */
  P._waterSurface = function (x0, r) {
    const ix = Math.floor(x0);
    let best = null, bd = 1e9;
    for (let x = ix - r; x <= ix + r; x++) {
      if (x < 2 || x >= W - 2) continue;
      const gy = this.ground[x];
      for (let y = Math.max(3, gy - 14); y <= gy + 2; y++) {
        if (this.tile(x, y) === B.WATER && this.tile(x, y - 1) === B.AIR && this.lvl[y * W + x] === 9 && this.aux[y * W + x] === 0) { const dd = Math.abs(x - x0); if (dd < bd) { bd = dd; best = [x, y]; } break; }
      }
    }
    return best;
  };
  P._aiTadpole = function (m, d, dt, dx, dy, dist) {
    m.age += dt;
    if (m.age >= BABY_TIME) {
      const fd = MOBS.frog, feet = m.y + m.h, bi = this.biomeAt(Math.floor(cxOf(m)));
      m.type = "frog"; m.kind = "passive"; m.w = fd.w; m.h = fd.h; m.y = feet - fd.h - 0.001; m.maxHp = m.hp = fd.hp; m.var = frogVar(bi);
      m.hopT = 0.5; m.tongue = 0; m.preg = false; m.dir = 0; m.t = 1; m.age = 0;
      if (this._hit(m)) m.y -= 0.6;
      this.events.push({ t: "convert", x: cxOf(m), y: m.y, type: "frog" });
      if (Math.abs(dx) < 40) this.grant("frog");
      return 1;
    }
    this._aiFish(m, d, dt, dx, dy, dist);
    return 2;
  };

  // ---------- Allay ----------
  P._aiAllay = function (m, d, dt, dx, dy, dist) {
    const p = this.player, pcx = p.x + p.w / 2;
    m.relCd -= dt; m.wT -= dt;
    let tgt = null;
    if (m.owner) {
      if (dist > 26) { this._teleport(m, 3, true); }
      if (m.hold) {
        tgt = [pcx, p.y + 0.2];
        if (Math.abs(pcx - cxOf(m)) < 2.8 && Math.abs(p.y + 0.5 - m.y) < 2.5) {
          this.dropStack(stk(m.hold.id, m.hold.n, m.hold.d), cxOf(m), m.y + m.h, false, sgn(pcx - cxOf(m)) * 0.3);
          m.hold = null; m.relCd = 3;
        }
      } else if (m.want && m.relCd <= 0) {
        let best = null, bd = 17;
        for (const dr of this.drops) if (dr.id === m.want && !dr.e && Math.hypot(dr.x - cxOf(m), dr.y - m.y) < bd) { best = dr; bd = Math.hypot(dr.x - cxOf(m), dr.y - m.y); }
        if (best) {
          tgt = [best.x + 0.15, best.y + 0.15];
          if (bd < 1.1) { m.hold = { id: best.id, n: best.n, d: best.d | 0 }; this.drops.splice(this.drops.indexOf(best), 1); this.events.push({ t: "pickup_allay", x: cxOf(m), y: m.y }); }
        }
      }
      if (!tgt) {
        tgt = [pcx - p.face * 1.6, p.y - 0.4 + Math.sin(this.time * 400 + m.id) * 0.4];
        if (Math.abs(tgt[0] - cxOf(m)) < 0.6 && Math.abs(tgt[1] - m.y) < 0.6) { approach(m, 0, 0, 8, dt); flyStep(this, m, dt); return 2; }
      }
      flyTo(m, tgt[0], tgt[1], d.speed, 12, dt);
    } else this._flyWander(m, d, dt, m.home, m.hy, 5);
    flyStep(this, m, dt);
    return 2;
  };

  // ---------- Kamel ----------
  P._aiCamel = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) { m.sitting = false; return; }
    m.sitT -= dt;
    if (m.panic > 0) { m.panic -= dt; m.sitting = false; this._steer(m, m.flee, d.speed * 1.6, dt, 11); return; }
    if (m.sitting) { m.sitDur -= dt; this._steer(m, 0, 0, dt); if (m.sitDur <= 0) { m.sitting = false; m.sitT = 40 + this.mrng() * 60; } return; }
    if (m.sitT <= 0 && m.onGround && !(m.baby > 0)) { m.sitting = true; m.sitDur = 8 + this.mrng() * 12; return; }
    this._wander(m, d, dt, 0.8);
  };

  // ---------- Schnüffler ----------
  P._aiSniffer = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    if (m.baby > 0) { this._wander(m, d, dt, 0.8); return; }
    if (m.dig > 0) {
      m.dig -= dt; this._steer(m, 0, 0, dt);
      if (m.dig <= 0) this._sniffDone(m);
      return;
    }
    m.snT -= dt;
    if (m.tgt) {
      const ddx = m.tgt[0] + 0.5 - cxOf(m);
      if (!DIGGABLE.has(this.tile(m.tgt[0], m.tgt[1]))) { m.tgt = null; m.snT = 5; return; }
      if (Math.abs(ddx) < 1.1) { m.dig = 7 + this.mrng() * 3; m.face = sgn(ddx) || m.face; this.events.push({ t: "dig", x: cxOf(m), y: m.y }); return; }
      if (m.snT < -30) { m.tgt = null; m.snT = 20 + this.mrng() * 20; return; }
      this._steer(m, sgn(ddx), d.speed * 1.2, dt, 11);
      return;
    }
    if (m.snT <= 0) {
      const x0 = Math.floor(cxOf(m)), y0 = Math.floor(m.y + m.h);
      let best = null, bd = 1e9;
      for (let x = x0 - 12; x <= x0 + 12; x++) for (let y = y0 - 2; y <= y0 + 2; y++) {
        if (!DIGGABLE.has(this.tile(x, y)) || BLOCKS[this.tile(x, y - 1)].solid || isFluid(this.tile(x, y - 1))) continue;
        const dd = Math.abs(x + 0.5 - cxOf(m)) + Math.abs(y - y0) * 2 + this.mrng(); if (dd < bd) { bd = dd; best = [x, y]; }
      }
      if (best) { m.tgt = best; m.snT = 0; this.events.push({ t: "sniff", x: cxOf(m), y: m.y }); } else m.snT = 12 + this.mrng() * 10;
      return;
    }
    this._wander(m, d, dt, 0.8);
  };
  P._sniffDone = function (m) {
    if (!m.tgt) return;
    const [x, y] = m.tgt;
    if (DIGGABLE.has(this.tile(x, y))) this.dropStack(stk(this.mrng() < 0.5 ? "torchflower_seeds" : "pitcher_pod"), x + 0.5, y - 0.4, true);
    this.events.push({ t: "dug", x: x + 0.5, y });
    m.tgt = null; m.snT = 30 + this.mrng() * 40;
  };

  // ---------- Phantom ----------
  P._aiPhantom = function (m, d, dt, dx, dy, dist) {
    const p = this.player, pcx = p.x + p.w / 2;
    if (this.dayFactor() > 0.75 && !this.dim) {                      // Sonnenlicht verbrennt Phantome
      const ix = Math.floor(cxOf(m)), iy = Math.floor(m.y);
      if (iy >= 0 && iy < H && this.sky[iy * W + ix] * this.dayFactor() >= 12.5) m.ignite = Math.max(m.ignite || 0, 2);
    }
    m.ang += dt * 1.1; m.phT -= dt;
    if (m.ph === "swoop") {
      flyTo(m, pcx, p.y + 0.9, d.speed * 1.9, 26, dt);
      const hp0 = p.hp; this._touch(m, d, dt);
      if (p.hp < hp0 || touching(m, p, 0.2) || m.phT <= 0) { m.ph = "circle"; m.phT = 5 + this.mrng() * 6; m.ang += 3; }
    } else {
      flyTo(m, pcx + Math.cos(m.ang) * 8, p.y - 6 + Math.sin(m.ang * 1.7) * 1.6, d.speed, 10, dt);
      if (m.phT <= 0 && dist < 22 && this._los(cxOf(m), m.y, pcx, p.y + 0.7)) { m.ph = "swoop"; m.phT = 1.8; }
      else if (m.phT <= 0) m.phT = 2;
    }
    if (m.blocked) { m.ph = "circle"; m.phT = 2; }
    flyStep(this, m, dt);
    return 2;
  };

  // =================================================================
  // Schaden, Tod, Benutzen
  // =================================================================
  const prevHurt = P._mobHurt;
  P._mobHurt = function (m, dmg, dir, src) {
    const byP = src === "player" || src === "arrow";
    if (!m.dead) {
      if (byP) switch (m.type) {
        case "llama": m.angT = 12; break;
        case "panda": if (m.var === 4 || m.var === 6) m.angry = true; else { m.panic = 4; m.flee = dir || 1; } break;
        case "polar_bear": m.angry = true; break;
        case "bee": this._beesAnger(cxOf(m), m.y, 8); m.angT = 25; break;
        case "goat": m.ramCd = 0; break;
        case "fox": if (!m.trust) { m.panic = 4; m.flee = dir || (this.mrng() < 0.5 ? -1 : 1); } break;
      }
      if (m.type === "polar_bear" && m.baby > 0) for (const o of this.mobs) if (o.type === "polar_bear" && !(o.baby > 0) && Math.abs(cxOf(o) - cxOf(m)) < 14) o.angry = true;
      if (m.type === "camel" || m.type === "sniffer") m.sitting = false;
    }
    return prevHurt.call(this, m, dmg, dir, src);
  };
  const prevDie = P._mobDieNew;
  P._mobDieNew = function (m, src) {
    prevDie.call(this, m, src);
    const p = this.player;
    if (p.ride === m) this._dismount();
    if (m.saddle) this.dropStack(stk("saddle"), cxOf(m), m.y + m.h / 2, true);
    if (m.hold) this.dropStack(stk(m.hold.id, m.hold.n, m.hold.d), cxOf(m), m.y + m.h / 2, true);
    if (m.type === "phantom" && (src === "player" || src === "arrow")) this.grant("phantom");
  };

  const prevUse = P._mobUseNew;
  P._mobUseNew = function (m, s) {
    const id = s && s.id, adult = !(m.baby > 0);
    // Reittiere: Sattel auflegen, aufsteigen
    if (RIDE[m.type] && adult && !(id && BREED_FOOD[m.type] && BREED_FOOD[m.type].includes(id))) {
      if (!m.saddle) { if (id === "saddle") { m.saddle = true; this._consumeSel(); this.events.push({ t: "saddle", x: cxOf(m), y: m.y }); this.grant("saddle"); return true; } }
      else if (id !== "saddle" && this.player.ride !== m) { this._mount(m); return true; }
    }
    switch (m.type) {
      case "llama":
        if (id === "hay_block" && !m.trust && adult) {
          this._consumeSel();
          if (this.mrng() < 0.35) { m.trust = true; m.angT = 0; this.grant("trust"); this.events.push({ t: "tame", x: cxOf(m), y: m.y }); }
          else this.events.push({ t: "smoke", x: cxOf(m), y: m.y });
          return true;
        }
        break;
      case "goat":
        if (id === "bucket" && adult) { this._consumeSel(); this.add("milk_bucket", 1, 0, true); this.events.push({ t: "bucket", fill: true, x: Math.floor(cxOf(m)), y: Math.floor(m.y) }); return true; }
        break;
      case "tadpole":
        if (id === "slimeball") { this._consumeSel(); m.age += 30; this.events.push({ t: "love", x: cxOf(m), y: m.y, grow: true }); return true; }
        break;
      case "allay":
        if (s && id !== "amethyst_shard") {
          if (m.want !== id) { m.want = id; this.events.push({ t: "allay", x: cxOf(m), y: m.y }); }
          if (!m.owner) { m.owner = true; this.grant("allay"); }
          return true;
        }
        if (!s && m.owner && m.want) { m.want = null; return true; }
        break;
      case "sniffer": case "camel":
        m.sitting = false; break;
    }
    return prevUse.call(this, m, s);
  };

  // Zucht: Frösche legen Laich, Schnüffler Eier, junge Füchse vertrauen dem Spieler
  const prevBreed = P._breed;
  P._breed = function (a, b) {
    if (a.type === "frog") { a.love = b.love = 0; a.bcd = b.bcd = 60; a.preg = true; a.pgT = 90; a.wtx = undefined; this.addXp(1 + Math.floor(this.mrng() * 7)); this.events.push({ t: "baby", x: cxOf(a), y: a.y }); return; }
    if (a.type === "sniffer") {
      a.love = b.love = 0; a.bcd = b.bcd = 120; this.addXp(1 + Math.floor(this.mrng() * 7));
      const x = Math.floor((cxOf(a) + cxOf(b)) / 2), y = Math.floor(Math.max(a.y + a.h, b.y + b.h) - 0.05);
      if (this.tile(x, y) === B.AIR || (!BLOCKS[this.tile(x, y)].solid && !isFluid(this.tile(x, y)))) { this.setTile(x, y, B.SNIFFER_EGG); this.events.push({ t: "baby", x: x + 0.5, y }); }
      else this.dropStack(stk("sniffer_egg"), x + 0.5, y, true);
      return;
    }
    const n0 = this.mobs.length;
    prevBreed.call(this, a, b);
    if (a.type === "fox") { const baby = this.mobs[this.mobs.length - 1]; if (this.mobs.length > n0 && baby && baby.type === "fox") { baby.trust = true; this.grant("trust"); } }
  };

  // Sprung-/Wurfgegenstände und Blöcke: Bienenstock, Beerenstrauch, Horn
  const baseUse = P.use;
  P.use = function (tx, ty) {
    if (!this.win) {
      const s = this.selStack();
      if (s && s.id === "goat_horn") {
        if (!(this.hornCd > 0)) { this.hornCd = 7; this.events.push({ t: "horn", v: s.d | 0 }); for (const o of this.mobs) if (o.kind === "passive" && Math.abs(cxOf(o) - this.player.x) < 24 && !o.panic) { o.panic = 1.5; o.flee = sgn(cxOf(o) - this.player.x) || 1; } }
        return true;
      }
      if (this.reachOk(tx, ty) && tx >= 0 && tx < W && ty >= 3 && ty < H - 3) {
        const id = this.tile(tx, ty), i = ty * W + tx;
        if ((id === B.BEEHIVE || id === B.BEE_NEST) && s) {
          const a = this.aux[i];
          if (hiveHoney(a) >= 5 && (s.id === "glass_bottle" || s.id === "shears")) {
            const occ = hiveOcc(a);
            if (s.id === "glass_bottle") { this._consumeSel(); this.add("honey_bottle", 1, 0, true); }
            else { this.dropStack(stk("honeycomb", 3), tx + 0.5, ty - 0.3, true); this._wear(this.inv, this.sel, 1); }
            this.aux[i] = hiveAux(0, occ, hiveNec(a));
            this._hiveAnger(tx, ty, occ);
            this.grant("beekeeper"); this.events.push({ t: "honey", x: tx + 0.5, y: ty });
            return true;
          }
        }
        if (id === B.BERRY_BUSH) {
          const n = 1 + Math.floor(this.mrng() * 3);
          this.dropStack(stk("sweet_berries", n), tx + 0.5, ty + 0.3, true); this.setTile(tx, ty, B.BERRY_BUSH0);
          this.events.push({ t: "pick", x: tx + 0.5, y: ty });
          return true;
        }
        if (s && s.id === "sweet_berries" && (id === B.AIR || id === B.TALLGRASS)) {            // Beeren auf Erde oder Gras pflanzen, sonst essen
          const below = this.tile(tx, ty + 1);
          if ((below === B.GRASS || below === B.DIRT || below === B.GRASS_SNOW || below === B.MOSS_BLOCK) && !this.mobs.some(o => o.x < tx + 1 && o.x + o.w > tx && o.y < ty + 1 && o.y + o.h > ty)) {
            this.setTile(tx, ty, B.BERRY_BUSH0); this._consumeSel(); this.events.push({ t: "place", x: tx, y: ty, id: B.BERRY_BUSH0 });
            return true;
          }
        }
      }
    }
    return baseUse.call(this, tx, ty);
  };
  const baseBreak = P._break;
  P._break = function (x, y, byPlayer) {
    const id = this.tile(x, y), a = this.aux[y * W + x];
    baseBreak.call(this, x, y, byPlayer);
    if ((id === B.BEEHIVE || id === B.BEE_NEST) && this.tile(x, y) !== id) {
      const occ = hiveOcc(a);
      if (occ > 0 && !this.dim) {                                    // Bewohner fliegen heraus (Rest wird sofort wütend)
        this._hiveCalmBreak = this._hiveCalm(x, y);
        for (let k = 0; k < occ; k++) {
          const d = MOBS.bee, m = this.spawnMob("bee", x + 0.5 - d.w / 2, y + 0.5 + d.h / 2);
          if (this._hit(m)) { this.mobs.pop(); continue; }
          m.fly = true; if (!this._hiveCalmBreak) m.angT = 25;
        }
        if (!this._hiveCalmBreak) this._beesAnger(x + 0.5, y + 0.5);
      }
    }
  };

  // =================================================================
  // Schlaf und Phantome
  // =================================================================
  const prevSleep = P.sleep;
  P.sleep = function (tx, ty, straw) {
    const ok = prevSleep.call(this, tx, ty, straw);
    if (ok && !this.dim) this.lastSleep = this.day;
    return ok;
  };
  P._phantomSpawn = function (dt) {
    this.phT = (this.phT === undefined ? 20 : this.phT) - dt;
    if (this.phT > 0) return;
    this.phT = 22 + this.mrng() * 14;
    const p = this.player;
    if (this.dim || this.dayFactor() > 0.3 || this.day - (this.lastSleep === undefined ? 1 : this.lastSleep) < PHANTOM_DAYS || p.hp <= 0) return;
    const ix = Math.floor(p.x + p.w / 2);
    for (let y = Math.floor(p.y) - 1; y >= 0; y--) if (BLOCKS[this.tile(ix, y)].solid) return;                 // nur unter freiem Himmel
    let n = 0; for (const m of this.mobs) if (m.type === "phantom" && Math.abs(cxOf(m) - p.x) < 80) n++;
    if (n >= 3) return;
    const k = 1 + Math.floor(this.mrng() * Math.min(3 - n, 2));
    for (let i = 0; i < k; i++) {
      const x = clamp(p.x + (this.mrng() - 0.5) * 14, 2, W - 3), y = p.y - 11 - this.mrng() * 5, d = MOBS.phantom;
      const m = this.spawnMob("phantom", x, y + d.h);
      if (this._hit(m)) { this.mobs.pop(); continue; }
      m.fly = true;
    }
  };

  // =================================================================
  // Welt: Spawns, Bienenstöcke, Laich, Eier, Beeren
  // =================================================================
  const mobsNear = (e, x, r, types) => { let n = 0; for (const m of e.mobs) if (types.has(m.type) && Math.abs(cxOf(m) - x) < r) n++; return n; };
  /** Gruppe auf freiem Boden bei Spalte x ablegen */
  P._placeGroup = function (type, x, n) {
    const d = MOBS[type]; let made = 0;
    for (let i = 0; i < n; i++) {
      const ix = clamp(Math.floor(x + (i - n / 2) * 1.8), 2, W - 3), gy = this.ground[ix], t = this.tile(ix, gy);
      if (!BLOCKS[t].solid || isFluid(t) || t === B.CACTUS || this.tile(ix, gy - 1) !== B.AIR || this.tile(ix, gy - 2) !== B.AIR || gy > SURF + 6) continue;
      const m = this.spawnMob(type, ix + 0.5 - d.w / 2, gy);
      if (this._hit(m)) { this.mobs.pop(); continue; }
      made++;
      if (type === "polar_bear" && made > 1 && this.mrng() < 0.7) makeBaby(this, m, BABY_TIME * (0.3 + this.mrng() * 0.7));
    }
    return made;
  };
  P._pickFauna = function (bi, rnd) {
    const w = FAUNA_W[bi]; if (!w) return null;
    const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0);
    let r = rnd() * tot; for (const [k, v] of e) { r -= v; if (r < 0) return k; }
    return e[0][0];
  };
  const prevPopulate = P._populate;
  P._populate = function () {
    prevPopulate.call(this);
    const rnd = mulberry32((this.seed ^ 0x12fa) | 0);
    for (let x = 24; x < W - 24; x += 40 + Math.floor(rnd() * 40)) {
      const type = this._pickFauna(this.biomeAt(x), rnd);
      if (!type) continue;
      const [a, b] = GROUP_N[type]; this._placeGroup(type, x, a + Math.floor(rnd() * (b - a + 1)));
    }
    for (const s of this.structs || []) {                              // Allays leben bei Anwesen und Außenposten
      if (s.kind !== "mansion" && s.kind !== "outpost") continue;
      for (let i = 0; i < (s.kind === "mansion" ? 3 : 2); i++) {
        const d = MOBS.allay, m = this.spawnMob("allay", s.x + (i - 1) * 3 + 0.5 - d.w / 2, s.y - 3 - i * 0.5);
        if (this._hit(m)) { this.mobs.pop(); continue; }
        m.fly = true; m.home = s.x;
      }
    }
  };
  /** Laufende Spawns: Tiere der Oberwelt (selten), solange wenige in der Nähe sind */
  P._faunaSpawn = function (dt) {
    if (this.passT > 1e8) return;                        // wie die übrigen Tier-Spawns abschaltbar (passT)
    this.faT = (this.faT === undefined ? 6 : this.faT) - dt;
    if (this.faT > 0 || this.dim) return;
    this.faT = 11;
    const p = this.player, px = p.x + p.w / 2;
    if (this.dayFactor() < 0.6 || mobsNear(this, px, 80, E12) >= 8) return;
    const x = Math.floor(px + (this.mrng() < 0.5 ? -1 : 1) * (28 + this.mrng() * 26));
    if (x < 4 || x >= W - 4) return;
    const type = this._pickFauna(this.biomeAt(x), () => this.mrng());
    if (!type) return;
    const [a, b] = GROUP_N[type]; this._placeGroup(type, x, a + Math.floor(this.mrng() * (b - a + 1)));
  };
  /** Alle 2 s rund um den Spieler: Bienenstöcke, Sträucher, Laich, Eier */
  P._faunaScan = function (dt) {
    this.fsT = (this.fsT === undefined ? 1 : this.fsT) - dt;
    if (this.fsT > 0 || this.dim) return;
    this.fsT = 2;
    const p = this.player, px = Math.floor(p.x + p.w / 2), py = Math.floor(p.y);
    const x0 = Math.max(2, px - HIVE_SPAN), x1 = Math.min(W - 3, px + HIVE_SPAN), y0 = Math.max(3, py - 36), y1 = Math.min(H - 4, py + 36);
    const day = this.dayFactor() > 0.35;
    let bees = 0; for (const m of this.mobs) if (m.type === "bee") bees++;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, id = this.tiles[i];
      if (id === B.BEEHIVE || id === B.BEE_NEST) {
        const a = this.aux[i];
        if (hiveOcc(a) > 0 && day && bees < 24 && this.mrng() < 0.3 && this._hiveRelease(x, y, false)) bees++;
      } else if (id === B.BERRY_BUSH0) {
        if (this.mrng() < 0.03 && this.lightAt(x, y) >= 9) this.tiles[i] = B.BERRY_BUSH;
      } else if (id === B.SNIFFER_EGG) {
        const a = this.aux[i] + (this.tile(x, y + 1) === B.MOSS_BLOCK ? 2 : 1);
        if (a >= EGG_TICKS) {
          this.setTile(x, y, B.AIR);
          const d = MOBS.sniffer, m = this.spawnMob("sniffer", x + 0.5 - d.w / 2, y + 1);
          makeBaby(this, m, BABY_TIME);
          if (this._hit(m)) { m.y -= 0.8; if (this._hit(m)) { this.mobs.pop(); continue; } }
          this.grant("sniffer"); this.events.push({ t: "hatch", x: x + 0.5, y });
        } else this.aux[i] = a;
      } else if (id === B.WATER && this.aux[i] === WP.SPAWN) {
        if (this.mrng() < 0.045) {
          this.aux[i] = 0;
          const k = 2 + Math.floor(this.mrng() * 4), d = MOBS.tadpole;
          for (let j = 0; j < k; j++) { const m = this.spawnMob("tadpole", x + 0.5 - d.w / 2, y + 0.5 + d.h / 2); m.inWater = true; if (this._hit(m)) this.mobs.pop(); }
          this.events.push({ t: "hatch", x: x + 0.5, y });
        }
      }
    }
  };
  const prevMobs = P._mobs;
  P._mobs = function (dt) {
    prevMobs.call(this, dt);
    this._faunaStep(dt);
  };
  P._faunaStep = function (dt) {
    if (this.hornCd > 0) this.hornCd -= dt;
    this._faunaFx(dt);
    this._faunaScan(dt);
    this._faunaSpawn(dt);
    this._phantomSpawn(dt);
  };
  const prevAdv = P._advTick;
  P._advTick = function () {
    prevAdv.call(this);
    if (this.count("goat_horn") > 0) this.grant("horn");
    if (this.count("ochre_froglight") + this.count("verdant_froglight") + this.count("pearl_froglight") > 0) this.grant("froglight");
  };

  // =================================================================
  // Speichern
  // =================================================================
  const prevSaveX = P._mobSaveX;
  P._mobSaveX = function (m, o) {
    if (prevSaveX) prevSaveX.call(this, m, o);
    const z = {};
    if (m.saddle) z.s = 1;
    if (m.trust) z.t = 1;
    if (m.nec) z.n = 1;
    if (m.hv) z.hv = [m.hv[0], m.hv[1]];
    if (m.type === "goat") z.hn = m.horn | 0;
    if (m.type === "tadpole" && m.age > 0) z.ag = Math.round(m.age);
    if (m.want) z.w = m.want;
    if (m.owner) z.ow = 1;
    if (m.hold) z.hd = [m.hold.id, m.hold.n | 0, m.hold.d | 0];
    if (m.preg) z.pg = 1;
    if (m.type === "allay" && Number.isFinite(m.home)) z.hm = Math.round(m.home);
    if (m.angT > 0 && m.type === "bee") z.an = 1;
    if (Object.keys(z).length) o.z = z;
  };
  const prevLoadX = P._mobLoadX;
  P._mobLoadX = function (m, o) {
    if (prevLoadX) prevLoadX.call(this, m, o);
    if (m.var !== undefined && !(o.vr > 0)) m.var = 0;
    const z = o.z && typeof o.z === "object" ? o.z : null;
    if (!z) return;
    if (z.s && RIDE[m.type]) m.saddle = true;
    if (z.t && (m.type === "fox" || m.type === "llama")) m.trust = true;
    if (z.n && m.type === "bee") m.nec = true;
    if (Array.isArray(z.hv) && Number.isFinite(z.hv[0]) && Number.isFinite(z.hv[1]) && m.type === "bee") m.hv = [clamp(z.hv[0] | 0, 0, W - 1), clamp(z.hv[1] | 0, 0, H - 1)];
    if (m.type === "goat" && Number.isFinite(z.hn)) m.horn = clamp(z.hn | 0, 0, 2);
    if (m.type === "tadpole" && Number.isFinite(z.ag)) m.age = clamp(z.ag, 0, BABY_TIME);
    if (m.type === "allay") {
      if (typeof z.w === "string" && ITEMS[z.w]) m.want = z.w;
      if (z.ow) m.owner = true;
      if (Array.isArray(z.hd) && ITEMS[z.hd[0]]) m.hold = { id: z.hd[0], n: clamp(z.hd[1] | 0, 1, 64), d: Math.max(0, z.hd[2] | 0) };
      if (Number.isFinite(z.hm)) m.home = z.hm;
      m.hy = m.y;
    }
    if (z.pg && m.type === "frog") { m.preg = true; m.pgT = 60; }
    if (z.an && m.type === "bee") m.angT = 10;
    if (m.type === "bee" || m.type === "allay" || m.type === "phantom") m.fly = true;
  };
  P._faunaSave = function () { return { ls: this.lastSleep === undefined ? undefined : this.lastSleep | 0 }; };
  P._faunaLoad = function (d) {
    this.lastSleep = d && Number.isFinite(d.ls) ? clamp(d.ls | 0, 0, 1e9) : undefined;
    if (this.lastSleep === undefined) this.lastSleep = this.day;                // alter Spielstand: kein Schlafmangel auf einen Schlag
    this.player.ride = null;
  };
  void SURF; void bushTop;
}
