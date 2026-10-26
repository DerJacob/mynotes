// =====================================================================
// Blockdorf – Wassermobs (Etappe 11)
//   Fische (Kabeljau, Lachs, Tropenfisch, Kugelfisch), Tintenfische (gewöhnlich, Leucht), Delfin, Schildkröte, Axolotl,
//   Ertrunkene, Wächter und Ältester Wächter (bewachen das Ozeanmonument).
// Eigene Schwimm-KI: Die Tiere bewegen sich in drei Richtungen und bleiben im Wasser.
// =====================================================================
import { B, BLOCKS, ITEMS } from "./sandbox-data.js?v=10";
import { MOBS, ADV } from "./sandbox-mobs.js?v=10";
import { BREED_FOOD, BABY_TIME, BREED_COOLDOWN } from "./sandbox-farm.js?v=10";
import { AQUATIC } from "./sandbox-ocean11.js?v=10";

const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const cxOf = m => m.x + m.w / 2;
const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

Object.assign(MOBS, {
  cod: { name: "Kabeljau", kind: "passive", aq: 1, w: 0.62, h: 0.3, hp: 3, speed: 2.6, xp: [1, 3], drops: [["raw_cod", 1, 1, 1], ["bone_meal", 1, 1, 0.05]] },
  salmon: { name: "Lachs", kind: "passive", aq: 1, w: 0.8, h: 0.34, hp: 3, speed: 2.8, xp: [1, 3], drops: [["raw_salmon", 1, 1, 1], ["bone_meal", 1, 1, 0.05]] },
  tropical_fish: { name: "Tropenfisch", kind: "passive", aq: 1, w: 0.42, h: 0.36, hp: 3, speed: 2.4, xp: [1, 3], drops: [["tropical_fish", 1, 1, 1], ["bone_meal", 1, 1, 0.05]] },
  pufferfish: { name: "Kugelfisch", kind: "neutral", aq: 1, w: 0.5, h: 0.5, hp: 3, speed: 1.6, xp: [1, 3], drops: [["pufferfish", 1, 1, 1], ["bone_meal", 1, 1, 0.05]] },
  squid: { name: "Tintenfisch", kind: "passive", aq: 1, w: 0.85, h: 0.95, hp: 10, speed: 1.4, xp: [1, 3], drops: [["ink_sac", 1, 3, 1]] },
  glow_squid: { name: "Leuchttintenfisch", kind: "passive", aq: 1, w: 0.85, h: 0.95, hp: 10, speed: 1.3, xp: [1, 3], drops: [["glow_ink_sac", 1, 3, 1]] },
  dolphin: { name: "Delfin", kind: "neutral", aq: 1, w: 1.6, h: 0.65, hp: 10, speed: 4.2, dmg: 3, xp: [1, 3], drops: [["raw_cod", 0, 1, 1]] },
  turtle: { name: "Schildkröte", kind: "passive", aq: 1, w: 1.25, h: 0.5, hp: 30, speed: 0.9, xp: [1, 3], drops: [] },
  axolotl: { name: "Axolotl", kind: "passive", aq: 1, w: 0.8, h: 0.42, hp: 14, speed: 2.0, dmg: 2, xp: [1, 3], drops: [] },
  drowned: { name: "Ertrunkener", kind: "hostile", aq: 1, w: 0.7, h: 1.8, hp: 20, speed: 2.5, dmg: 3, range: 20, xp: [5, 5], drops: [["rotten_flesh", 0, 2, 1], ["gold_ingot", 1, 1, 0.025], ["copper_ingot", 0, 1, 0.11], ["nautilus_shell", 1, 1, 0.03]] },
  guardian: { name: "Wächter", kind: "hostile", aq: 1, w: 0.95, h: 0.95, hp: 30, speed: 2.8, dmg: 5, range: 16, xp: [10, 10], drops: [["prismarine_shard", 0, 2, 1], ["raw_cod", 0, 1, 0.4], ["prismarine_crystals", 0, 1, 0.4]] },
  elder_guardian: { name: "Ältester Wächter", kind: "hostile", aq: 1, w: 1.9, h: 1.9, hp: 80, speed: 2.2, dmg: 8, range: 18, xp: [10, 10], drops: [["prismarine_shard", 1, 3, 1], ["wet_sponge", 1, 1, 1], ["raw_cod", 0, 1, 0.6], ["prismarine_crystals", 0, 2, 0.6]] }
});
BREED_FOOD.turtle = ["seagrass"];
export const FISH_BUCKET = { cod: "cod", salmon: "salmon", pufferfish: "pufferfish", tropical: "tropical_fish", axolotl: "axolotl" };
const BUCKET_OF = { cod: "bucket_cod", salmon: "bucket_salmon", pufferfish: "bucket_pufferfish", tropical_fish: "bucket_tropical", axolotl: "bucket_axolotl" };
export const MON_GUARDS = 8;                       // so viele Wächter bewachen ein Monument (der Älteste kommt dazu)
export const DROWN_TIME = 15;                      // Sekunden im Wasser, bis ein Zombie zum Ertrunkenen wird

export function installSeaMobs(Sandbox, K) {
  const { clamp, W, H, SURF } = K;
  const P = Sandbox.prototype;
  const SEA = SURF + 4;
  const stk = (id, n = 1, d = 0) => ({ id, n, d });

  // ---------- Hilfen ----------
  const wet = (e, x, y) => e.tile(Math.floor(x), Math.floor(y)) === B.WATER;
  const approach = (m, tvx, tvy, a, dt) => {
    m.vx += clamp(tvx - m.vx, -a * dt, a * dt);
    m.vy += clamp(tvy - m.vy, -a * dt, a * dt);
  };
  /** Körper im Wasser: kein Auftrieb, nur Bremsen; an Land fallen sie */
  P._swimBody = function (m, dt) {
    m.blocked = false;
    const f = this.fluidOf(m);
    m.inWater = f === B.WATER; m.inLava = f === B.LAVA;
    if (m.inWater) { const k = Math.max(0, 1 - 0.9 * dt); m.vx *= k; m.vy *= k; }
    else {
      m.vy = Math.min(m.vy + (m.inLava ? 5 : 38) * dt, 30);
      if (m.onGround) m.vx *= Math.max(0, 1 - 8 * dt);
    }
    this._moveX(m, m.vx * dt); this._moveY(m, m.vy * dt);
    m.x = clamp(m.x, 0, W - m.w);
  };
  /** Geschwindigkeit so ändern, dass das Tier im Wasser bleibt (nach vorn, oben, unten prüfen) */
  const keepIn = (e, m, allowAir) => {
    const cx = cxOf(m), cy = m.y + m.h / 2;
    if (m.vx && !wet(e, cx + sgn(m.vx) * (m.w / 2 + 0.5), cy)) { m.vx = -m.vx * 0.6; m.dir = -sgn(m.vx) || m.dir; m.sx = -(m.sx || 0); m.t = Math.min(m.t, 0.4); }
    if (m.vy < 0 && !allowAir && !wet(e, cx, m.y - 0.35)) { m.vy = Math.max(0, -m.vy * 0.3); m.sy = Math.abs(m.sy || 0) * 0.5; }
    if (m.vy > 0 && !wet(e, cx, m.y + m.h + 0.35)) { m.vy = -m.vy * 0.4; m.sy = -Math.abs(m.sy || 0) * 0.5; }
  };
  /** Zufällige Schwimmrichtung wählen; mit Schwarmneigung */
  const heading = (e, m, d, vk = 0.6) => {
    const r = e.mrng(), a = r * Math.PI * 2;
    m.sx = Math.cos(a) * d.speed * vk; m.sy = Math.sin(a) * d.speed * vk * 0.45;
    if (m.type === "cod" || m.type === "salmon" || m.type === "tropical_fish") {
      let n = 0, sx = 0, sy = 0;
      for (const o of e.mobs) if (o !== m && o.type === m.type && !o.dead && Math.abs(cxOf(o) - cxOf(m)) < 9 && Math.abs(o.y - m.y) < 5) { n++; sx += cxOf(o); sy += o.y; if (n >= 6) break; }
      if (n) { const tx = sx / n - cxOf(m), ty = sy / n - m.y; const L = Math.hypot(tx, ty) || 1; if (L > 2.5) { m.sx = m.sx * 0.5 + tx / L * d.speed * 0.5; m.sy = m.sy * 0.5 + ty / L * d.speed * 0.3; } }
    }
    m.t = 1.2 + e.mrng() * 3;
  };
  const flop = (e, m, dt) => {                                   // an Land: zappeln und ersticken
    m.dry = (m.dry || 0) + dt;
    m.flopT = (m.flopT || 0) - dt;
    if (m.onGround && m.flopT <= 0) { m.flopT = 0.5 + e.mrng() * 0.5; m.vy = -5; m.vx = (e.mrng() - 0.5) * 5; m.onGround = false; }
    if (m.dry > 3) { m.dry = 1.4; e._mobHurt(m, 1, 0, "dry"); }
  };

  // ---------- Erzeugen ----------
  const prevInit = P._mobInitNew;
  P._mobInitNew = function (m, type) {
    prevInit.call(this, m, type);
    const d = MOBS[type];
    if (!d.aq) return;
    m.sx = 0; m.sy = 0; m.t = this.mrng() * 2; m.dir = this.mrng() < 0.5 ? -1 : 1;
    if ((type === "tropical_fish" || type === "axolotl") && m.var === undefined) m.var = Math.floor(this.mrng() * (type === "axolotl" ? 5 : 8));
    if (type === "pufferfish") m.puff = 0;
    if (type === "squid" || type === "glow_squid") { m.jetT = 2 + this.mrng() * 4; m.inked = false; }
    if (type === "dolphin") m.leapT = 3 + this.mrng() * 6;
    if (type === "turtle") { if (m.home === undefined) m.home = Math.floor(m.x + m.w / 2); m.digT = 0; }
    if (type === "drowned") { m.shootCd = 1.5 + this.mrng(); if (this.mrng() < 0.06) m.trident = true; m.drT = 0; }
    if (type === "guardian" || type === "elder_guardian") { m.beamT = 0; m.beamCd = 1 + this.mrng() * 2; m.beaming = false; m.curseT = 2; }
  };

  // ---------- KI ----------
  const prevAi = P._aiNew;
  P._aiNew = function (m, d, dt, dx, dy, dist) {
    switch (m.type) {
      case "cod": case "salmon": case "tropical_fish": this._aiFish(m, d, dt, dx, dy, dist); return 2;
      case "pufferfish": this._aiPuffer(m, d, dt, dx, dy, dist); return 2;
      case "squid": case "glow_squid": this._aiSquid(m, d, dt, dx, dy, dist); return 2;
      case "dolphin": this._aiDolphin(m, d, dt, dx, dy, dist); return 2;
      case "axolotl": this._aiAxolotl(m, d, dt, dx, dy, dist); return 2;
      case "turtle": return this._aiTurtle(m, d, dt, dx, dy, dist);
      case "drowned": return this._aiDrowned(m, d, dt, dx, dy, dist);
      case "guardian": case "elder_guardian": this._aiGuardian(m, d, dt, dx, dy, dist); return 2;
      case "zombie": {                                            // im Wasser wird er zum Ertrunkenen
        if (this.fluidOf(m, 0.7) === B.WATER) {
          m.drT = (m.drT || 0) + dt;
          if (m.drT >= DROWN_TIME) { this._convert(m, "drowned"); return 1; }
        } else m.drT = 0;
        break;
      }
    }
    return prevAi.call(this, m, d, dt, dx, dy, dist);
  };
  P._convert = function (m, type) {
    const d = MOBS[type], ratio = m.hp / m.maxHp;
    m.type = type; m.maxHp = d.hp; m.hp = Math.max(1, Math.round(d.hp * ratio));
    m.drT = 0; m.shootCd = 1.5; m.shield = false; m.fire = false;
    if (this.mrng() < 0.06) m.trident = true;
    this.events.push({ t: "convert", x: cxOf(m), y: m.y, type });
  };
  const fleeFrom = (e, m, dx, dt, near, dist) => {
    if (dist < near && m.panic <= 0) { m.panic = 1.6; m.flee = -sgn(dx) || 1; }
  };
  P._aiFish = function (m, d, dt, dx, dy, dist) {
    const f = this.fluidOf(m); m.inWater = f === B.WATER;
    if (!m.inWater) { flop(this, m, dt); this._swimBody(m, dt); return; }
    m.dry = 0;
    fleeFrom(this, m, dx, dt, 3.2, dist);
    m.t -= dt;
    if (m.panic > 0) {
      m.panic -= dt;
      approach(m, m.flee * d.speed * 1.9, (this.mrng() - 0.5) * d.speed * 0.6, 9, dt);
    } else {
      if (m.t <= 0) heading(this, m, d);
      approach(m, m.sx, m.sy, 3.5, dt);
    }
    keepIn(this, m, false);
    if (Math.abs(m.vx) > 0.15) m.face = sgn(m.vx);
    this._swimBody(m, dt);
  };
  P._aiPuffer = function (m, d, dt, dx, dy, dist) {
    const f = this.fluidOf(m); m.inWater = f === B.WATER;
    if (!m.inWater) { flop(this, m, dt); this._swimBody(m, dt); return; }
    m.dry = 0;
    const threat = dist < 3.2 || m.angry;
    m.puff = clamp((m.puff || 0) + (threat ? 2.5 : -0.8) * dt, 0, 1);
    m.t -= dt;
    if (m.t <= 0) heading(this, m, d, 0.45);
    approach(m, m.sx, m.sy, 2, dt);
    keepIn(this, m, false);
    if (Math.abs(m.vx) > 0.1) m.face = sgn(m.vx);
    if (m.puff > 0.6 && m.atkCd <= 0 && touching(m, this.player, 0.1)) {
      m.atkCd = 1.6; this.addEffect("poison", 8, 0, false); this.events.push({ t: "puff", x: cxOf(m), y: m.y });
    }
    this._swimBody(m, dt);
  };
  P._aiSquid = function (m, d, dt, dx, dy, dist) {
    const f = this.fluidOf(m); m.inWater = f === B.WATER;
    if (!m.inWater) { flop(this, m, dt); this._swimBody(m, dt); return; }
    m.dry = 0; m.jetT -= dt;
    if (m.panic > 0) {
      m.panic -= dt;
      if (!m.inked) { m.inked = true; this.events.push({ t: "ink", x: cxOf(m), y: m.y, glow: m.type === "glow_squid" }); }
      approach(m, m.flee * d.speed * 3, -0.6 * d.speed, 14, dt);
    } else {
      m.inked = false;
      if (m.jetT <= 0) {                                         // Rückstoß
        m.jetT = 3 + this.mrng() * 4;
        const a = (this.mrng() - 0.5) * 2.2 + (this.mrng() < 0.5 ? 0 : Math.PI);
        m.vx = Math.cos(a) * d.speed * 3; m.vy = Math.sin(a) * d.speed * 3 - 0.8; m.face = sgn(m.vx) || m.face;
        this.events.push({ t: "jet", x: cxOf(m), y: m.y + m.h / 2 });
      }
      approach(m, 0, 0.45, 1.2, dt);                              // sinkt langsam
    }
    keepIn(this, m, false);
    this._swimBody(m, dt);
  };
  P._aiDolphin = function (m, d, dt, dx, dy, dist) {
    const p = this.player, f = this.fluidOf(m); m.inWater = f === B.WATER;
    m.leapT -= dt;
    if (m.leaping > 0) m.leaping -= dt;
    if (!m.inWater) {                                            // in der Luft: Bogen
      if (m.onGround) flop(this, m, dt);
      this._swimBody(m, dt); return;
    }
    m.dry = 0;
    if (p.inWater && dist < 12) { this.addEffect("dolphins_grace", 5, 0, true); }
    if (m.angry) {
      if (dist > 26) m.angry = false;
      const L = Math.hypot(dx, dy) || 1;
      approach(m, dx / L * d.speed * 1.4, dy / L * d.speed * 1.4, 12, dt);
      if (m.atkCd <= 0 && touching(m, p, 0.2)) { m.atkCd = 1.0; this.hurt(d.dmg, sgn(dx) || 1, "mob"); }
    } else if (p.inWater && dist < 16 && dist > 3) {              // spielt mit dem Schwimmer
      const L = Math.hypot(dx, dy) || 1;
      approach(m, dx / L * d.speed * 0.9, dy / L * d.speed * 0.6, 6, dt);
    } else {
      m.t -= dt;
      if (m.t <= 0) heading(this, m, d, 0.8);
      approach(m, m.sx, m.sy, 5, dt);
    }
    if (m.leapT <= 0 && !m.angry && !wet(this, cxOf(m), m.y - 1.2) && wet(this, cxOf(m), m.y + 0.1)) {
      m.leapT = 8 + this.mrng() * 10; m.leaping = 1.2; m.vy = -10; m.vx = (m.face || 1) * d.speed * 1.6; this.events.push({ t: "splash", x: cxOf(m), y: m.y });
    }
    keepIn(this, m, m.leaping > 0);
    if (Math.abs(m.vx) > 0.2) m.face = sgn(m.vx);
    this._swimBody(m, dt);
  };
  P._aiAxolotl = function (m, d, dt, dx, dy, dist) {
    const f = this.fluidOf(m); m.inWater = f === B.WATER;
    if (!m.inWater) { m.vy = Math.min(m.vy + 38 * dt, 30); if (m.onGround) m.vx *= 0.8; this._swimBody(m, dt); return; }
    // Beute oder Feinde in der Nähe jagen
    let tgt = null, bd = 9;
    for (const o of this.mobs) {
      if (o === m || o.dead || !o.inWater) continue;
      const hunt = o.type === "drowned" || o.type === "guardian" || o.type === "cod" || o.type === "salmon" || o.type === "tropical_fish" || o.type === "squid" || o.type === "glow_squid";
      if (!hunt) continue;
      const dd = Math.hypot(cxOf(o) - cxOf(m), o.y - m.y);
      if (dd < bd) { bd = dd; tgt = o; }
    }
    m.t -= dt;
    if (tgt) {
      const tx = cxOf(tgt) - cxOf(m), ty = tgt.y + tgt.h / 2 - (m.y + m.h / 2), L = Math.hypot(tx, ty) || 1;
      approach(m, tx / L * d.speed * 1.5, ty / L * d.speed * 1.5, 8, dt);
      if (touching(m, tgt, 0.25) && m.atkCd <= 0) {
        m.atkCd = 1.2;
        const hostile = tgt.kind === "hostile";
        if (this._mobHurt(tgt, d.dmg, sgn(tx) || 1, "axolotl") && hostile && Math.hypot(this.player.x - m.x, this.player.y - m.y) < 22) {
          this.addEffect("regen", 6, 1, true); delete this.fx.mining_fatigue; this.events.push({ t: "heal_fx", x: cxOf(m), y: m.y });
        }
      }
    } else {
      if (m.t <= 0) heading(this, m, d, 0.45);
      approach(m, m.sx, m.sy * 0.5 + 0.2, 2.5, dt);
    }
    keepIn(this, m, false);
    if (Math.abs(m.vx) > 0.1) m.face = sgn(m.vx);
    this._swimBody(m, dt);
  };

  // ---- Schildkröte ----
  P._nearWaterDir = function (m, r = 30) {
    const y = Math.floor(m.y + m.h * 0.5), x0 = Math.floor(cxOf(m));
    for (let k = 1; k <= r; k++) for (const s of [1, -1]) for (let j = 0; j <= 4; j++) if (this.tile(x0 + s * k, y + j) === B.WATER) return s;
    return 0;
  };
  P._aiTurtle = function (m, d, dt, dx, dy, dist) {
    const f = this.fluidOf(m); m.inWater = f === B.WATER;
    if (this._loveAI(m, d, dt)) return 1;
    const baby = m.baby > 0;
    if (!m.inWater) {
      m.dry = 0;
      let dir = 0;
      if (m.gravid && m.home !== undefined) {                       // zur Heimat laufen und Eier legen
        const hx = m.home + 0.5 - cxOf(m);
        if (Math.abs(hx) > 1.4) dir = sgn(hx);
        else if (m.onGround) {
          m.digT += dt;
          if (m.digT > 4) { m.digT = 0; this._layEggs(m); }
        }
      } else if (baby) dir = this._nearWaterDir(m, 40) || m.dir;
      else if (m.panic > 0) { m.panic -= dt; dir = m.flee; }
      else {
        m.t -= dt;
        if (m.t <= 0) { const r = this.mrng(); m.dir = r < 0.4 ? 0 : r < 0.7 ? -1 : 1; m.t = 1.5 + this.mrng() * 3; }
        dir = m.dir;
        if (dir && m.onGround && this._cliffAhead(m, dir) && !this._nearWaterDir(m, 3)) dir = -dir, m.dir = dir;
      }
      this._steer(m, dir, d.speed * (baby ? 0.9 : 1), dt, 8);
      return 1;
    }
    // im Wasser: schwimmen, am liebsten dicht über dem Grund
    m.dry = 0;
    m.t -= dt;
    if (m.gravid && m.home !== undefined) {
      const hx = m.home + 0.5 - cxOf(m);
      approach(m, sgn(hx) * 2.2, -0.6, 3, dt);
      if (Math.abs(hx) < 0.5) approach(m, 0, 0, 3, dt);
    } else {
      if (m.panic > 0) { m.panic -= dt; approach(m, m.flee * 2.4, 0.3, 4, dt); }
      else {
        if (m.t <= 0) { heading(this, m, d, 1.4); m.sy = (this.mrng() - 0.2) * 0.8; }
        approach(m, m.sx, m.sy, 2, dt);
      }
    }
    keepIn(this, m, false);
    if (Math.abs(m.vx) > 0.1) m.face = sgn(m.vx);
    this._swimBody(m, dt);
    return 2;
  };
  P._layEggs = function (m) {
    const x = Math.floor(cxOf(m)), y = Math.floor(m.y + m.h - 0.05);
    if (this.tile(x, y + 1) !== B.SAND || this.tile(x, y) !== B.AIR) { m.gravid = false; return; }
    this.setTile(x, y, B.TURTLE_EGG);
    this.aux[y * W + x] = 1 + Math.floor(this.mrng() * 3);            // 2 bis 4 Eier (Anzahl − 1 in den unteren Bits)
    m.gravid = false; m.digT = 0;
    this.events.push({ t: "egg_lay", x, y });
  };
  const baseBreed = P._breed;
  P._breed = function (a, b) {
    if (a.type !== "turtle") return baseBreed.call(this, a, b);
    a.love = b.love = 0; a.bcd = b.bcd = BREED_COOLDOWN;
    (a.home !== undefined && this.mrng() < 0.5 ? a : b).gravid = true;
    this.addXp(1 + Math.floor(this.mrng() * 7));
    this.events.push({ t: "love", x: (cxOf(a) + cxOf(b)) / 2, y: a.y });
  };
  P._spawnBabyTurtle = function (x, yBottom, homeX) {
    const d = MOBS.turtle, baby = this.spawnMob("turtle", x - d.w * 0.275, yBottom, { home: homeX });
    baby.w = d.w * 0.55; baby.h = d.h * 0.55; baby.y = yBottom - baby.h - 0.001; baby.baby = BABY_TIME;
    if (this._hit(baby)) { baby.y -= 0.6; if (this._hit(baby)) { this.mobs.pop(); return null; } }
    return baby;
  };
  const baseGrow = P._grow;
  P._grow = function (m) {
    baseGrow.call(this, m);
    if (m.type === "turtle" && !(m.baby > 0)) { this.dropStack(stk("scute", 1), cxOf(m), m.y + m.h / 2, true); this.events.push({ t: "scute", x: cxOf(m), y: m.y }); }
  };

  // ---- Ertrunkener ----
  P._aiDrowned = function (m, d, dt, dx, dy, dist) {
    const p = this.player, f = this.fluidOf(m); m.inWater = f === B.WATER;
    const aware = dist < d.range && (this._los(cxOf(m), m.y + 0.4, p.x + p.w / 2, p.y + 0.7) || m.inWater);
    m.shootCd -= dt;
    // Sonnenlicht verbrennt sie an Land
    if (!m.inWater) {
      const ix = Math.floor(cxOf(m)), iy = Math.floor(m.y + 0.2);
      m.fire = iy >= 0 && iy < H && this.sky[iy * W + ix] * this.dayFactor() >= 12.5;
      if (m.fire) { m.burnT = (m.burnT || 1) - dt; if (m.burnT <= 0) { m.burnT = 1; this._mobHurt(m, 1, 0, "fire"); } }
    } else m.fire = false;
    if (m.dead) return 2;
    if (m.trident && aware && dist > 4 && dist < 15 && m.shootCd <= 0 && this._los(cxOf(m), m.y + 0.4, p.x + p.w / 2, p.y + 0.7)) {
      m.shootCd = 3.2 + this.mrng(); m.face = sgn(dx) || m.face;
      this._shoot(m, "trident", p.x + p.w / 2, p.y + 0.7, 17, 6);
    }
    if (m.inWater) {
      m.t -= dt;
      if (aware) {
        const L = Math.hypot(dx, dy) || 1, keep = m.trident && dist < 7 ? -0.6 : 1;
        approach(m, dx / L * d.speed * 1.1 * keep, dy / L * d.speed * 1.1 * keep, 7, dt);
        if (m.atkCd <= 0 && touching(m, p, 0.12)) { m.atkCd = 1.0; this.hurt(d.dmg, sgn(p.x + p.w / 2 - cxOf(m)) || 1, "mob"); }
        m.face = sgn(dx) || m.face;
      } else {
        if (m.t <= 0) { const r = this.mrng(); m.dir = r < 0.35 ? 0 : r < 0.675 ? -1 : 1; m.t = 1.5 + this.mrng() * 3; }
        approach(m, m.dir * d.speed * 0.4, m.onGround ? 0 : 0.9, 4, dt);
        if (m.dir) m.face = m.dir;
      }
      if (m.blocked && m.onGround) m.vy = -4.5;
      this._swimBody(m, dt);
      return 2;
    }
    if (aware) {
      if (m.trident && dist < 7) this._steer(m, -sgn(dx), d.speed, dt, 11);
      else this._steer(m, Math.abs(dx) > 0.5 ? sgn(dx) : 0, d.speed, dt, 11);
      this._touch(m, d, dt);
    } else this._wander(m, d, dt, 0.8);
    return 1;
  };

  // ---- Wächter ----
  P._aiGuardian = function (m, d, dt, dx, dy, dist) {
    const p = this.player, f = this.fluidOf(m); m.inWater = f === B.WATER;
    if (!m.inWater) { flop(this, m, dt); this._swimBody(m, dt); m.beaming = false; m.beamT = 0; return; }
    m.dry = 0;
    const elder = m.type === "elder_guardian";
    const sight = dist < d.range && p.inWater && this._los(cxOf(m), m.y + m.h / 2, p.x + p.w / 2, p.y + 0.7);
    m.t -= dt;
    if (sight) {
      const want = elder ? 7 : 5.5, L = Math.hypot(dx, dy) || 1, k = dist > want + 1.5 ? 1 : dist < want - 1.5 ? -0.8 : 0;
      approach(m, dx / L * d.speed * k, dy / L * d.speed * k, 6, dt);
      m.face = sgn(dx) || m.face;
      m.beamCd -= dt;
      if (!m.beaming && m.beamCd <= 0) { m.beaming = true; m.beamT = 0; this.events.push({ t: "beam_start", x: cxOf(m), y: m.y }); }
      if (m.beaming) {
        m.beamT += dt;
        if (m.beamT >= (elder ? 3 : 2)) {
          m.beaming = false; m.beamT = 0; m.beamCd = 1.5 + this.mrng();
          this.hurt(d.dmg, sgn(dx) || 1, "magic"); this.events.push({ t: "beam_hit", x: cxOf(m), y: m.y + m.h / 2, tx: p.x + p.w / 2, ty: p.y + 0.7 });
        }
      }
    } else {
      m.beaming = false; m.beamT = 0;
      if (m.t <= 0) heading(this, m, d, 0.55);
      approach(m, m.sx, m.sy, 3, dt);
    }
    if (elder) {                                                  // Fluch: Abbaumüdigkeit
      m.curseT -= dt;
      if (m.curseT <= 0) {
        m.curseT = 60;
        if (p.inWater && dist < 30) { this.addEffect("mining_fatigue", 180, 2, false); this.events.push({ t: "curse", x: cxOf(m), y: m.y }); }
      }
    }
    keepIn(this, m, false);
    this._swimBody(m, dt);
  };
  const prevMod = P._mobHurtMod;
  P._mobHurtMod = function (m, dmg, dir, src) {
    if ((m.type === "guardian" || m.type === "elder_guardian") && m.beaming && src === "player") this.hurt(2, 0, "magic");        // Stacheln
    return prevMod.call(this, m, dmg, dir, src);
  };
  const prevDie = P._mobDieNew;
  P._mobDieNew = function (m, src) {
    prevDie.call(this, m, src);
    if (m.mon !== undefined) {
      const rec = (this.monK ||= {})[m.mon] || (this.monK[m.mon] = { g: 0, e: 0 });
      if (m.type === "guardian") rec.g++; else if (m.type === "elder_guardian") rec.e = 1;
    }
    if (src === "player" || src === "arrow") {
      if (m.type === "guardian") this.grant("guardian");
      if (m.type === "elder_guardian") this.grant("elder");
    }
    if (m.type === "squid" || m.type === "glow_squid") this.events.push({ t: "ink", x: cxOf(m), y: m.y, glow: m.type === "glow_squid" });
  };
  const prevDeadEnd = P._mobHurt;
  P._mobHurt = function (m, dmg, dir, src) {
    if (m.type === "pufferfish" && (src === "player" || src === "arrow")) m.angry = true;
    if (m.type === "dolphin" && (src === "player" || src === "arrow")) m.angry = true;
    const r = prevDeadEnd.call(this, m, dmg, dir, src);
    if (!r && !m.dead && (m.type === "squid" || m.type === "glow_squid")) { m.panic = 3; m.flee = -sgn(dir) || (this.mrng() < 0.5 ? -1 : 1); }
    return r;
  };

  // ---------- Benutzen ----------
  const prevUse = P._mobUseNew;
  P._mobUseNew = function (m, s) {
    if (s && s.id === "water_bucket" && BUCKET_OF[m.type] && !(m.baby > 0)) {
      this.inv[this.sel] = this.newStack(BUCKET_OF[m.type], 1, m.var | 0);
      this._remove(m);
      this.events.push({ t: "bucket", fill: true, x: Math.floor(cxOf(m)), y: Math.floor(m.y) });
      return true;
    }
    return prevUse.call(this, m, s);
  };
  const baseUse = P.use;
  P.use = function (tx, ty) {
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (it && it.fishbucket && !this.win) {
      if (!this.reachOk(tx, ty) || ty < 3 || ty >= H - 3) return false;
      const id = this.tile(tx, ty), i = ty * W + tx;
      if (!(id === B.AIR || id === B.WATER || (BLOCKS[id] && !BLOCKS[id].solid && !BLOCKS[id].fluid && id !== B.LAVA))) return false;
      if (this.dim === 1) { this.inv[this.sel] = this.newStack("bucket", 1); this.events.push({ t: "hiss", x: tx, y: ty }); return true; }
      if (id !== B.WATER || this.lvl[i] !== 9) this._setFluid(i, B.WATER, 9);
      const type = FISH_BUCKET[it.fishbucket], d = MOBS[type];
      const m = this.spawnMob(type, tx + 0.5 - d.w / 2, ty + 0.5 + d.h / 2, { var: s.d | 0 });
      m.inWater = true;
      this.inv[this.sel] = this.newStack("bucket", 1);
      this.events.push({ t: "bucket", fill: false, x: tx, y: ty });
      return true;
    }
    return baseUse.call(this, tx, ty);
  };

  // ---------- Spawnen ----------
  const prevSpawn = P._mobSpawn;
  P._mobSpawn = function (dt) {
    prevSpawn.call(this, dt);
    if (!this.dim) { this._seaSpawn(dt); this._monuments(dt); }
  };
  const SEA_W = {
    ocean: { cod: 10, salmon: 4, squid: 4, pufferfish: 1, dolphin: 2 },
    warm_ocean: { tropical_fish: 14, pufferfish: 4, cod: 2, dolphin: 2, squid: 1 },
    lake: { cod: 3, salmon: 2 }
  };
  P._seaSpawn = function (dt) {
    this.seaT = (this.seaT === undefined ? 2 : this.seaT) - dt;
    if (this.seaT > 0) return;
    this.seaT = 2.2;
    const p = this.player, px = p.x + p.w / 2;
    let nAq = 0, nT = 0, nD = 0;
    for (const m of this.mobs) {
      if (Math.abs(cxOf(m) - px) > 70 || !MOBS[m.type].aq) continue;
      if (m.type === "turtle") nT++; else if (m.type === "dolphin") { nD++; nAq++; } else if (m.kind !== "hostile") nAq++;
    }
    const side = this.mrng() < 0.5 ? -1 : 1, x = Math.floor(px + side * (7 + this.mrng() * 42));
    if (x < 3 || x >= W - 3) return;
    const bi = this.biomeAt(x), night = this.dayFactor() < 0.35;
    // Strandschildkröten
    if (nT < 3 && !night && (bi === "ocean" || bi === "warm_ocean") && this.mrng() < 0.35) {
      for (let k = -8; k <= 8; k += 2) {
        const xx = x + k, gy = this.ground[xx];
        if (xx < 3 || xx >= W - 3 || gy < SEA - 3 || gy > SEA + 2) continue;
        if (this.tile(xx, gy) === B.SAND && this.tile(xx, gy - 1) === B.AIR && this.tile(xx, gy - 2) === B.AIR) {
          let water = false; for (let j = 3; j <= 10 && !water; j++) if (this.tile(xx + j, SEA + 1) === B.WATER || this.tile(xx - j, SEA + 1) === B.WATER) water = true;
          if (water) { const m = this.spawnMob("turtle", xx + 0.1, gy); if (this._hit(m)) this.mobs.pop(); break; }
        }
      }
    }
    // Wasserspalte suchen
    const y0 = Math.max(4, Math.floor(p.y) - 14), y1 = Math.min(H - 6, Math.floor(p.y) + 18), span = y1 - y0;
    if (span < 2) return;
    const start = Math.floor(this.mrng() * span);
    let yy = -1;
    for (let k = 0; k < span; k++) { const y = y0 + (start + k) % span; if (this.tile(x, y) === B.WATER) { yy = y; break; } }
    if (yy < 0) return;
    let top = yy, bot = yy;
    while (this.tile(x, top - 1) === B.WATER) top--;
    while (this.tile(x, bot + 1) === B.WATER) bot++;
    const depth = bot - top + 1;
    if (depth < 3) return;
    const y = top + 1 + Math.floor(this.mrng() * (depth - 2)), under = y > this.ground[x] + 1;
    const wts = {};
    if (under) {
      const floor = this.tile(x, bot + 1);
      if (nAq < 12) { if (floor === B.CLAY || floor === B.MOSS_BLOCK || this.tile(x + 1, bot) === B.MOSS_BLOCK) wts.axolotl = 8; if (y > SURF + 14) wts.glow_squid = 5; }
    } else if (nAq < 18) {
      const t = SEA_W[bi] || SEA_W.lake;
      for (const [k, v] of Object.entries(t)) {
        if ((k === "squid" || k === "dolphin") && depth < 7) continue;
        if (k === "dolphin" && (nD >= 2 || night)) continue;
        wts[k] = v;
      }
    }
    if ((night || under) && this.hostilesNear(px, 70) < 14 && depth >= 2 && (bi === "ocean" || bi === "warm_ocean" || under || bi === "swamp")) wts.drowned = (bi === "ocean" || bi === "warm_ocean") ? 7 : 2;
    const e = Object.entries(wts).filter(([, v]) => v > 0), tot = e.reduce((a, [, v]) => a + v, 0);
    if (!tot) return;
    let r = this.mrng() * tot, type = e[0][0]; for (const [k, v] of e) { r -= v; if (r < 0) { type = k; break; } }
    const d = MOBS[type];
    const n = type === "drowned" || type === "dolphin" || type === "axolotl" || type === "glow_squid" || type === "squid" ? 1 : 2 + Math.floor(this.mrng() * 3);
    for (let k = 0; k < n; k++) {
      const m = this.spawnMob(type, x + 0.5 - d.w / 2 + k * 0.7, y + 0.5 + d.h / 2);
      if (this._hit(m) || !wet(this, cxOf(m), m.y + m.h / 2)) this.mobs.pop(); else m.inWater = true;
    }
  };
  /** Wächter des Ozeanmonuments: erscheinen, wenn man sich nähert (bis zur Höchstzahl, getötete kommen nicht wieder) */
  P._monuments = function (dt) {
    this.monT = (this.monT === undefined ? 1 : this.monT) - dt;
    if (this.monT > 0) return;
    this.monT = 2;
    const p = this.player, px = p.x + p.w / 2;
    this.monK = this.monK || {};
    for (const s of this.structs || []) {
      if (s.kind !== "monument" || Math.abs(px - s.x) > 48 || Math.abs(p.y - s.y) > 50) continue;
      const rec = this.monK[s.x] || (this.monK[s.x] = { g: 0, e: 0 });
      let ng = 0, ne = 0;
      for (const m of this.mobs) if (m.mon === s.x) { if (m.type === "guardian") ng++; else ne++; }
      const tryPlace = (type, cx0, cy0, rx, ry, tries) => {
        const d = MOBS[type];
        for (let k = 0; k < tries; k++) {
          const x = Math.floor(cx0 + (this.mrng() * 2 - 1) * rx), y = Math.floor(cy0 + (this.mrng() * 2 - 1) * ry);
          if (this.tile(x, y) !== B.WATER || this.tile(x, y - 1) !== B.WATER) continue;
          const m = this.spawnMob(type, x + 0.5 - d.w / 2, y + 0.5 + d.h / 2, { mon: s.x });
          if (this._hit(m)) { this.mobs.pop(); continue; }
          return m;
        }
        return null;
      };
      let made = 0;
      while (ng + rec.g < MON_GUARDS && made < 2) { if (!tryPlace("guardian", s.x, s.y - 5, 13, 4, 6)) break; ng++; made++; }
      if (!rec.e && !ne) tryPlace("elder_guardian", s.x, s.y - 4, 1.5, 0.5, 5);
    }
  };
  P._oceanSave = function () { return { monK: this.monK && Object.keys(this.monK).length ? this.monK : undefined }; };
  P._oceanLoad = function (d) {
    this.monK = {};
    if (d && d.monK && typeof d.monK === "object") for (const [k, v] of Object.entries(d.monK)) if (v && Number.isFinite(+k)) this.monK[k] = { g: clampN(v.g, 0, 64), e: v.e ? 1 : 0 };
  };
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v | 0));
  void AQUATIC; void ADV;
}
