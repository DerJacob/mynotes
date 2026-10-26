// =====================================================================
// Blockdorf – Ozean (Etappe 11, nach Minecraft 1.8 Monument, 1.13 „Update Aquatic“, 1.17)
//   Wasserpflanzen: Tang, Seegras, Seegurken, Korallen und Korallenfächer stehen als Zusatzfeld (aux) auf Wasserquellen
//     (siehe WP in sandbox-data.js). Tang wächst, Seegurken leuchten, Korallenblöcke sterben ohne Wasser.
//   Schwamm saugt Wasser auf, Schildkröteneier schlüpfen, Leitstrom schützt und schlägt Feinde im Wasser.
//   Tauchen: Atmung, Wasserläufer, Wasseraffinität, Schildkrötenpanzer, Delfins Gunst, Blasensäulen (Seelensand hebt, Magma zieht).
//   Dreizack: stechen, werfen (Treue, Blitzschlag, Aufspießen) und Sog.
// Engine ohne Oberfläche; Anzeige in sandbox.js. Die Wassermobs stehen in sandbox-seamobs11.js.
// =====================================================================
import { B, BLOCKS, ITEMS, WP, isWaterPlant, CORALS, SILK, coralBlockOf, FIRST11, LAST11 } from "./sandbox-data.js?v=10";
import { FULL } from "./sandbox-combat10.js?v=10";
import { ADV } from "./sandbox-mobs.js?v=10";
import { EFFECT_NAMES, EFFECT_BAD } from "./sandbox-brew.js?v=10";

const SRC = 9;
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const cxOf = m => m.x + m.w / 2;
export const PRISM_FRAME = new Set([B.PRISMARINE, B.PRISM_BRICKS, B.DARK_PRISM, B.SEA_LANTERN]);
export const CONDUIT_NEED = 8;          // so viele Prismarin-Blöcke im 5 × 5-Feld braucht ein Leitstrom
export const CONDUIT_RANGE = 16;
export const TRIDENT_MIN = 0.5;
export const AQUATIC = new Set(["cod", "salmon", "tropical_fish", "pufferfish", "squid", "glow_squid", "dolphin", "turtle", "axolotl", "drowned", "guardian", "elder_guardian"]);
FULL.trident = 0.95;
SILK[B.TURTLE_EGG] = "turtle_egg";
Object.assign(EFFECT_NAMES, { mining_fatigue: "Abbaumüdigkeit", dolphins_grace: "Delfins Gunst", conduit_power: "Leitstromkraft" });
EFFECT_BAD.add("mining_fatigue");
Object.assign(ADV, {
  ocean_kelp: ["Unter dem Meer", "Sammle Tang."],
  conduit: ["Das Meer gehört dir", "Aktiviere einen Leitstrom."],
  trident: ["Poseidon grüßt", "Besorge einen Dreizack."],
  guardian: ["Wächter der Tiefe", "Besiege einen Wächter."],
  elder: ["Der Älteste fällt", "Besiege einen Ältesten Wächter."],
  turtle: ["Panzer für alle", "Brich eine Schildkröte aus dem Ei."],
  heart_sea: ["Schatzsucher", "Finde ein Herz des Meeres."]
});

export function installOcean(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1, d = 0) => ({ id, n, d });

  // ---------- Zustand ----------
  P._oceanReset = function () { this.trid = null; this.turtleT = 0; this._headWet = false; this.swimMul = 1; this.oT = 0; this.conduitT = 0; this.cond = []; };
  const baseReset = P._resetInventory;
  P._resetInventory = function () { baseReset.call(this); this._oceanReset(); };

  const wetAux = (e, x, y) => (e.tile(x, y) === B.WATER ? e.aux[y * W + x] : 0);
  const solidBase = (e, x, y) => BLOCKS[e.tile(x, y)].solid;
  const isKelp = a => a === WP.KELP || a === WP.KELP_TOP;

  // ---------- Wasserpflanzen setzen ----------
  P._placeWet = function (tx, ty, s, it) {
    if (!this.reachOk(tx, ty) || tx < 1 || tx >= W - 1 || ty < 3 || ty >= H - 3) return false;
    const i = ty * W + tx;
    if (this.tile(tx, ty) !== B.WATER || this.lvl[i] < 8) return false;
    const a = this.aux[i], k = it.wet, below = ty + 1;
    const bs = solidBase(this, tx, below), belowKelp = isKelp(wetAux(this, tx, below));
    if (k === WP.KELP) {
      if (a !== 0 || !(bs || belowKelp)) return false;
      if (belowKelp) this.aux[below * W + tx] = WP.KELP;
      this.aux[i] = WP.KELP_TOP;
    } else if (k === WP.PICKLE) {
      if (a >= WP.PICKLE && a < WP.PICKLE + 3) this.aux[i] = a + 1;
      else if (a === 0 && bs) this.aux[i] = WP.PICKLE;
      else return false;
    } else {
      if (a !== 0 || !bs) return false;
      this.aux[i] = k;
    }
    this.lvl[i] = SRC;                                           // Wirtszelle wird zur festen Quelle (sonst löscht fließendes Wasser die Pflanze)
    this._consumeSel(); this.stats.built++; this.lightDirty = true;
    this.events.push({ t: "place", x: tx, y: ty, id: B.WATER });
    return true;
  };
  // Einsetzen aus der zweiten Hand (wie Blöcke), Schwamm saugt, Korallenblock ohne Wasser stirbt
  const basePlace = P.place;
  P.place = function (tx, ty) {
    let s = this.selStack(), viaOff = false;
    if (!s && this.offh[0]) { s = this.offh[0]; viaOff = true; }
    const it = s && ITEMS[s.id];
    if (it && it.wet) {
      if (!viaOff) return this._placeWet(tx, ty, s, it);
      this.inv[this.sel] = s; this.offh[0] = null;
      try { return this._placeWet(tx, ty, s, it); } finally { this.offh[0] = this.inv[this.sel]; this.inv[this.sel] = null; }
    }
    if (it && it.block === B.TURTLE_EGG && this.tile(tx, ty) === B.TURTLE_EGG && this.reachOk(tx, ty)) {      // zweites bis viertes Ei in dieselbe Mulde
      const i = ty * W + tx, a = this.aux[i];
      if ((a & 3) < 3) { this.aux[i] = a + 1; this._consumeSel(); this.stats.built++; this.events.push({ t: "place", x: tx, y: ty, id: B.TURTLE_EGG }); return true; }
      return false;
    }
    const ok = basePlace.call(this, tx, ty);
    if (ok && it && it.block === B.SPONGE) this._absorb(tx, ty);
    return ok;
  };
  /** Schwamm saugt Wasser in der Nähe auf (bis 65 Zellen, höchstens 7 Schritte weit) und wird nass */
  P._absorb = function (tx, ty) {
    const seen = new Set(), q = [];
    const push = (x, y, d) => { const k = y * W + x; if (x < 1 || x >= W - 1 || y < 2 || y >= H - 2 || seen.has(k) || this.tile(x, y) !== B.WATER) return; seen.add(k); q.push([x, y, d]); };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) push(tx + dx, ty + dy, 1);
    let n = 0;
    for (let h = 0; h < q.length && n < 65; h++) {
      const [x, y, d] = q[h];
      this._clearFluid(y * W + x); n++;
      if (d < 7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) push(x + dx, y + dy, d + 1);
    }
    if (n > 0) { this.setTile(tx, ty, B.WET_SPONGE); this.events.push({ t: "sponge", x: tx, y: ty, n }); }
    return n;
  };

  // ---------- Wasserpflanzen abbauen ----------
  P._breakWet = function (x, y, byPlayer) {
    const i = y * W + x, a = this.aux[i];
    if (this.tile(x, y) !== B.WATER || !isWaterPlant(a)) return false;
    const tool = this.heldTool(), en = byPlayer ? tool.ench || {} : {}, silk = !!en.silk_touch, shears = byPlayer && tool.type === "shears";
    this.aux[i] = 0; this.lightDirty = true;
    let drop = null, n = 1;
    if (isKelp(a)) drop = "kelp";
    else if (a === WP.SEAGRASS) drop = silk || shears ? "seagrass" : null;
    else if (a >= WP.PICKLE && a < WP.PICKLE + 4) { drop = "sea_pickle"; n = a - WP.PICKLE + 1; }
    else if (a >= WP.CORAL && a < WP.CORAL + 5) drop = silk ? `coral_${CORALS[a - WP.CORAL][0]}` : null;
    else if (a >= WP.FAN && a < WP.FAN + 5) drop = silk ? `coral_fan_${CORALS[a - WP.FAN][0]}` : null;
    if (drop && !this._noDrops) this.dropFrom(drop, n, x, y, true);
    if (byPlayer) { this.stats.mined++; this.addExh(0.005); if (isKelp(a)) this.grant("ocean_kelp"); }
    this.events.push({ t: "break", x, y, id: B.WATER, wet: a });
    if (isKelp(a)) { const up = wetAux(this, x, y - 1); if (isKelp(up)) this._breakWet(x, y - 1, byPlayer); }          // alles darüber reißt ab
    return true;
  };
  const baseMine = P.mineStep;
  P.mineStep = function (tx, ty, dt) {
    if (!this.win && this.reachOk(tx, ty) && this.tile(tx, ty) === B.WATER && isWaterPlant(this.aux[ty * W + tx])) { this._breakWet(tx, ty, true); this.mining = null; return 2; }
    return baseMine.call(this, tx, ty, dt * this._mineMul());
  };
  /** Abbaugeschwindigkeit: unter Wasser ohne Wasseraffinität nur ein Fünftel, Abbaumüdigkeit bremst */
  P._mineMul = function () {
    let m = 1;
    const helm = this.armor[0], aqua = !!(helm && helm.e && helm.e.aqua_affinity);
    if (this._headWet && !aqua && !this.fx.conduit_power) m *= 0.2;
    if (this.fx.mining_fatigue) m *= [0.3, 0.09, 0.027][Math.min(2, this.fx.mining_fatigue.amp | 0)];
    return m;
  };
  /** Nach dem Abbauen: Pflanzen ohne Boden lösen sich */
  const baseSettle = P._settle;
  P._settle = function (x, y) {
    baseSettle.call(this, x, y);
    for (let yy = y - 1; yy >= Math.max(2, y - 3); yy--) {
      const a = wetAux(this, x, yy);
      if (!a) break;
      const below = wetAux(this, x, yy + 1);
      if (isKelp(a) ? !(solidBase(this, x, yy + 1) || isKelp(below)) : !solidBase(this, x, yy + 1)) { this._breakWet(x, yy, false); }
      else break;
    }
  };
  const baseSpecial = P._specialDrops;
  P._specialDrops = function (id, aux, harvest, fortune) {
    if (id >= FIRST11 && id <= LAST11) {
      if (id === B.CORAL_BLOCK) { const en = this.heldTool().ench || {}; return [[en.silk_touch ? coralBlockOf(Math.min(4, aux | 0)) : "dead_coral_block", 1]]; }
    }
    return baseSpecial ? baseSpecial.call(this, id, aux, harvest, fortune) : null;
  };
  // ---------- Takt: Wachstum, Korallen, Eier, Leitstrom ----------
  P._oceanStep = function (dt) {
    this._bubbles(dt);
    if (this.dim) return;
    this.oT += dt; if (this.oT < 0.5) return;
    const step = this.oT; this.oT = 0;
    const p = this.player, px = Math.floor(p.x + p.w / 2), r = () => this.frng();
    const x0 = Math.max(2, px - 40), x1 = Math.min(W - 3, px + 40), y0 = Math.max(4, Math.floor(p.y) - 30), y1 = Math.min(H - 4, Math.floor(p.y) + 40);
    const night = this.dayFactor() < 0.35;
    const conduits = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x, t = this.tiles[i];
      if (t === B.WATER) {
        if (this.aux[i] === WP.KELP_TOP && r() < 0.06 * step * 2) {
          let h = 1; while (h < 22 && isKelp(wetAux(this, x, y + h))) h++;
          const ui = (y - 1) * W + x;
          if (h < 22 && this.tiles[ui] === B.WATER && this.lvl[ui] >= 8 && this.aux[ui] === 0 && y - 1 > 4) { this.aux[i] = WP.KELP; this.aux[ui] = WP.KELP_TOP; this.lvl[ui] = SRC; }
        }
      } else if (t === B.CORAL_BLOCK) {
        if (!this._waterNear(x, y) && r() < 0.35) { this.tiles[i] = B.DEAD_CORAL_BLOCK; this.events.push({ t: "coral_dies", x, y }); }
      } else if (t === B.TURTLE_EGG) {
        const a = this.aux[i], stage = (a >> 2) & 3;
        if (r() < (night ? 0.06 : 0.02) * step * 2) {
          if (stage >= 2) this._hatch(x, y, (a & 3) + 1);
          else this.aux[i] = (a & 3) | ((stage + 1) << 2);
        }
      } else if (t === B.CONDUIT) conduits.push([x, y]);
    }
    this._conduits(conduits, step);
    // Tauchen: Schildkrötenpanzer-Luft
    if (!this._headWet && this.armor[0] && this.armor[0].id === "turtle_helmet") this.turtleT = 10;
    // Tang entdecken
  };
  P._waterNear = function (x, y) { return this.tile(x - 1, y) === B.WATER || this.tile(x + 1, y) === B.WATER || this.tile(x, y - 1) === B.WATER || this.tile(x, y + 1) === B.WATER; };
  P._hatch = function (x, y, n) {
    this.setTile(x, y, B.AIR);
    for (let k = 0; k < n; k++) if (this._spawnBabyTurtle) this._spawnBabyTurtle(x + 0.5 + (k - n / 2) * 0.2, y + 1, x);
    this.events.push({ t: "hatch", x, y });
    this.grant("turtle");
  };

  // ---------- Leitstrom ----------
  P._conduitActive = function (x, y) {
    if (this.tile(x, y - 1) !== B.WATER && this.tile(x - 1, y) !== B.WATER && this.tile(x + 1, y) !== B.WATER) return false;
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && PRISM_FRAME.has(this.tile(x + dx, y + dy))) n++;
    return n >= CONDUIT_NEED;
  };
  P._conduits = function (list, step) {
    const p = this.player, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    this.cond = [];
    for (const [x, y] of list) {
      if (!this._conduitActive(x, y)) continue;
      this.cond.push([x, y]);
      const d = Math.hypot(pcx - (x + 0.5), pcy - (y + 0.5));
      if (this.fluidOf(p, 0.5) === B.WATER && d <= CONDUIT_RANGE) { this.addEffect("conduit_power", 13, 0, true); this.grant("conduit"); }
      this.conduitT -= step;
      if (this.conduitT <= 0) {
        this.conduitT = 2;
        for (const m of [...this.mobs]) {
          if (m.dead || m.kind !== "hostile" || m.boss || this.fluidOf(m, 0.5) !== B.WATER) continue;
          if (Math.hypot(cxOf(m) - (x + 0.5), m.y + m.h / 2 - (y + 0.5)) <= 8) { this._mobHurt(m, 4, 0, "magic"); this.events.push({ t: "conduit_hit", x, y, tx: cxOf(m), ty: m.y + m.h / 2 }); }
        }
      }
    }
  };

  // ---------- Blasensäulen ----------
  /** +1 = Säule aus Seelensand (hebt), −1 = aus Magma (zieht), 0 = keine */
  P.bubbleDir = function (x, y) {
    if (this.tile(x, y) !== B.WATER) return 0;
    for (let yy = y + 1; yy < Math.min(H - 1, y + 70); yy++) {
      const t = this.tile(x, yy);
      if (t === B.WATER) continue;
      return t === B.SOUL_SAND ? 1 : t === B.MAGMA ? -1 : 0;
    }
    return 0;
  };
  P._bubbles = function (dt) {
    const p = this.player;
    const push = (e, isP) => {
      const d = this.bubbleDir(Math.floor(e.x + e.w / 2), Math.floor(e.y + e.h * 0.5));
      if (!d) return;
      if (d > 0) e.vy = Math.max(-7, e.vy - 55 * dt);
      else e.vy = Math.min(6, e.vy + 40 * dt);
      if (isP) { p.air = Math.min(15, p.air + (d > 0 ? 6 * dt : 0)); this._bubT = 0.3; }
    };
    if (p.inWater) push(p, true);
    for (const m of this.mobs) if (m.inWater && !m.dead) push(m, false);
  };

  // ---------- Tauchen ----------
  const basePF = P._playerFluids;
  P._playerFluids = function (dt) {
    const p = this.player;
    const head = this.fluidAt(Math.floor(p.x + p.w / 2), Math.floor(p.y + 0.25));
    this._headWet = head === B.WATER;
    const helm = this.armor[0], resp = helm && helm.e ? helm.e.respiration | 0 : 0, turtle = !!helm && helm.id === "turtle_helmet";
    // Sog: Schub aus dem Wasserschwung
    if (p.rip) {
      p.rip.t -= dt;
      if (p.rip.t <= 0) p.rip = null; else { p.vx = p.rip.vx; p.vy = p.rip.vy; this._ripHit(dt); }
    }
    basePF.call(this, dt);
    if (this._headWet && !(this.fx && this.fx.water_breathing)) {
      let back = 0;
      if (this.fx.conduit_power) back = 1;
      else if (turtle && this.turtleT > 0) { back = 1; this.turtleT -= dt; }
      else if (resp) back = resp / (resp + 1);
      if (back > 0) p.air = Math.min(15, p.air + dt * back);
    }
    const boots = this.armor[3], ds = boots && boots.e ? boots.e.depth_strider | 0 : 0;
    let m = 1;
    if (p.inWater && !p.inLava) {
      if (this._headWet) m *= 1.25;
      m *= 1 + 0.25 * ds;
      if (this.fx.dolphins_grace) m *= 1.6;
      if (this.fx.conduit_power) m *= 1.15;
    }
    this.swimMul = m;
  };

  // ---------- Dreizack ----------
  P.tridentDraw = function (dt) {
    if (this.win || this.selItem() !== "trident") { this.trid = null; return false; }
    if (!this.trid) this.trid = { t: 0 };
    this.trid.t = Math.min(1.2, this.trid.t + dt);
    return true;
  };
  const rainingAt = e => !!e.weather && e.weather.kind !== "clear" && e.weather.k > 0.3 && !e.dim && e.sky[Math.floor(e.player.y) * W + Math.floor(e.player.x + e.player.w / 2)] >= 15;
  P.tridentRelease = function (mx, my) {
    const b = this.trid; this.trid = null;
    const s = this.selStack();
    if (!b || !s || s.id !== "trident" || b.t < TRIDENT_MIN) return false;
    const en = s.e || {}, p = this.player, x0 = p.x + p.w / 2, y0 = p.y + 0.5;
    const L = Math.max(0.1, Math.hypot(mx - x0, my - y0)), ux = (mx - x0) / L, uy = (my - y0) / L;
    if (en.riptide) {
      if (!(p.inWater || rainingAt(this))) return false;
      const lvl = en.riptide | 0, sp = 11 + 4 * lvl;
      p.rip = { t: 0.3 + 0.1 * lvl, vx: ux * sp, vy: uy * sp, hit: new Set(), imp: en.impaling | 0 };
      p.onGround = false; p.coyote = 0;
      this._wear(this.inv, this.sel, 1); this.addExh(0.1);
      this.events.push({ t: "riptide", x: x0, y: y0, lvl });
      return true;
    }
    this._wear(this.inv, this.sel, 1);
    const st = this.inv[this.sel];
    this.inv[this.sel] = null;
    this.addExh(0.05);
    const speed = 26;
    if (!st) { this.events.push({ t: "shoot", mob: false }); return true; }
    this.proj.push({ kind: "trident", x: x0, y: y0, vx: ux * speed, vy: uy * speed, dmg: 8, fromPlayer: true, age: 0, stuck: false, stuckT: 0, st, loy: en.loyalty | 0, ch: !!en.channeling, imp: en.impaling | 0, ang: Math.atan2(uy, ux) });
    this.grant("shoot"); this.events.push({ t: "shoot", mob: false, trident: true });
    return true;
  };
  P._ripHit = function () {
    const p = this.player, r = p.rip; if (!r) return;
    for (const m of [...this.mobs]) {
      if (m.dead || r.hit.has(m) || m.kind === "object") continue;
      if (p.x < m.x + m.w + 0.2 && p.x + p.w > m.x - 0.2 && p.y < m.y + m.h + 0.2 && p.y + p.h > m.y - 0.2) {
        r.hit.add(m);
        this._impale = r.imp; this._mobHurt(m, 8, sgn(r.vx) || 1, "player"); this._impale = 0;
      }
    }
  };
  const baseHandHold = P.handHold;
  P.handHold = function (dt, mx, my, used) {
    if (!this.win && this.selItem() === "trident") return !used && this.tridentDraw(dt) ? "trident" : null;
    this.trid = null;
    return baseHandHold.call(this, dt, mx, my, used);
  };
  const baseHandRelease = P.handRelease;
  P.handRelease = function (mx, my) {
    let r = false;
    if (this.trid) r = this.tridentRelease(mx, my);
    return baseHandRelease.call(this, mx, my) || r;
  };
  const prevSpecial = P._projSpecial;
  P._projSpecial = function (a, dt) {
    if (a.kind !== "trident") return prevSpecial.call(this, a, dt);
    const p = this.player;
    a.age += dt;
    const end = (drop) => {
      this._projRm(a);
      if (drop && a.fromPlayer && a.st && !this._noDrops) this.dropStack(a.st, a.x, a.y, true);
    };
    if (a.ret) {                                              // Treue: der Dreizack fliegt zurück
      const tx = p.x + p.w / 2, ty = p.y + p.h / 2, L = Math.hypot(tx - a.x, ty - a.y) || 1;
      a.vx = (tx - a.x) / L * 24; a.vy = (ty - a.y) / L * 24; a.x += a.vx * dt; a.y += a.vy * dt; a.ang = Math.atan2(a.vy, a.vx);
      if (L < 0.9 || a.age > 25) {
        this._projRm(a);
        if (this.add(a.st.id, 1, a.st.d | 0, true, a.st) > 0) this.dropStack(a.st, tx, ty, true);
        this.events.push({ t: "trident_back", x: tx, y: ty });
      }
      return true;
    }
    if (a.age > 14 || a.x < 0 || a.x >= W || a.y < -4 || a.y > H + 4) { end(true); return true; }
    const sp = Math.hypot(a.vx, a.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.2)), sdt = dt / steps;
    for (let k = 0; k < steps; k++) {
      a.vy += 22 * sdt;
      const wet = this.tile(Math.floor(a.x), Math.floor(a.y)) === B.WATER;
      if (wet) { a.vx *= 1 - 0.8 * sdt; a.vy *= 1 - 0.8 * sdt; }
      a.x += a.vx * sdt; a.y += a.vy * sdt; a.ang = Math.atan2(a.vy, a.vx);
      if (a.x < 0 || a.x >= W) { end(true); return true; }
      if (BLOCKS[this.tile(Math.floor(a.x), Math.floor(a.y))].solid) {
        this.events.push({ t: "thunk", x: a.x, y: a.y });
        if (a.loy) { a.ret = true; a.age = 0; } else end(true);
        return true;
      }
      if (!a.fromPlayer) {
        if (a.x > p.x - 0.15 && a.x < p.x + p.w + 0.15 && a.y > p.y - 0.15 && a.y < p.y + p.h + 0.15) { this.hurt(a.dmg, sgn(a.vx), "arrow"); this._projRm(a); return true; }
        continue;
      }
      for (const m of this.mobs) {
        if (m.dead || m.kind === "object" || m === a.shooter) continue;
        if (a.x > m.x - 0.15 && a.x < m.x + m.w + 0.15 && a.y > m.y - 0.15 && a.y < m.y + m.h + 0.15) {
          this._impale = a.imp; this._mobHurt(m, a.dmg, sgn(a.vx), "arrow"); this._impale = 0; this.grant("hit");
          if (a.ch && this.weather && this.weather.kind === "thunder" && !this.dim) this._lightning(cxOf(m));
          if (a.loy) { a.ret = true; a.age = 0; } else end(true);
          return true;
        }
      }
    }
    return true;
  };
  // Aufspießen: Zusatzschaden gegen Wassertiere
  const baseHurtMod = P._mobHurtMod;
  P._mobHurtMod = function (m, dmg, dir, src) {
    if (this._impale && AQUATIC.has(m.type) && (src === "player" || src === "arrow")) dmg += 2.5 * this._impale;
    return baseHurtMod.call(this, m, dmg, dir, src);
  };
  const baseAttack = P.attack;
  P.attack = function (mx, my) {
    const s = this.selStack();
    this._impale = s && s.id === "trident" && s.e ? s.e.impaling | 0 : 0;
    try { return baseAttack.call(this, mx, my); } finally { this._impale = 0; }
  };
  // Fortschritte
  const baseAdv = P._advTick;
  P._advTick = function () {
    baseAdv.call(this);
    const has = id => this.count(id) > 0;
    if (has("trident")) this.grant("trident");
    if (has("heart_of_the_sea")) this.grant("heart_sea");
    if (has("kelp")) this.grant("ocean_kelp");
  };
}
