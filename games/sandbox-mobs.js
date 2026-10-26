// =====================================================================
// Blockdorf – Tiere, Monster und Kampf (Etappe 3)
//   Passiv: Kuh, Schwein, Schaf, Huhn, Kaninchen · zähmbar: Wolf (Knochen), Katze (rohes Hühnchen)
//   Feindlich: Zombie, Skelett (Bogen), Creeper (Explosion), Spinne, Hexe, Enderman, Schleim
//   Kampf: Schadenswerte der Waffen, Rückstoß, kritische Treffer, Rüstung, Schild, Bogen und Pfeile
//   Dazu: Spawnregeln nach Licht, Tiefe und Biom, Beute, Bett (Schlafen, Respawn) und Fortschritte.
// Alles ist Engine-Logik ohne Oberfläche (Node-testbar); gezeichnet wird in sandbox.js.
// =====================================================================
import { B, BLOCKS, ITEMS, SMELT, isFluid, hasTag } from "./sandbox-data.js?v=10";
import { mulberry32 } from "./sandbox-noise.js?v=10";
import { NH } from "./sandbox-const.js?v=10";

const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Beute: [Gegenstand, min, max, Wahrscheinlichkeit] */
export const MOBS = {
  cow: { name: "Kuh", kind: "passive", w: 1.3, h: 1.35, hp: 10, speed: 1.2, xp: [1, 3], drops: [["raw_beef", 1, 3, 1], ["leather", 0, 2, 1]] },
  pig: { name: "Schwein", kind: "passive", w: 1.0, h: 0.9, hp: 10, speed: 1.3, xp: [1, 3], drops: [["raw_porkchop", 1, 3, 1]] },
  sheep: { name: "Schaf", kind: "passive", w: 1.2, h: 1.2, hp: 8, speed: 1.2, xp: [1, 3], drops: [["raw_mutton", 1, 2, 1], ["wool", 1, 1, 1]] },
  chicken: { name: "Huhn", kind: "passive", w: 0.55, h: 0.7, hp: 4, speed: 1.1, xp: [1, 3], drops: [["raw_chicken", 1, 1, 1], ["feather", 0, 2, 1]] },
  rabbit: { name: "Kaninchen", kind: "passive", w: 0.5, h: 0.5, hp: 3, speed: 2.6, xp: [1, 3], drops: [["raw_rabbit", 0, 1, 1], ["rabbit_foot", 1, 1, 0.1]] },
  wolf: { name: "Wolf", kind: "neutral", w: 0.9, h: 0.85, hp: 8, speed: 3.2, dmg: 3, xp: [1, 3], drops: [] },
  cat: { name: "Katze", kind: "neutral", w: 0.8, h: 0.6, hp: 10, speed: 2.4, xp: [1, 3], drops: [] },
  zombie: { name: "Zombie", kind: "hostile", w: 0.7, h: 1.8, hp: 20, speed: 2.5, dmg: 3, range: 18, xp: [5, 5], drops: [["rotten_flesh", 0, 2, 1], ["iron_ingot", 1, 1, 0.025], ["carrot", 1, 1, 0.025], ["potato", 1, 1, 0.025]] },
  skeleton: { name: "Skelett", kind: "hostile", w: 0.7, h: 1.8, hp: 20, speed: 2.2, dmg: 4, range: 20, xp: [5, 5], drops: [["bone", 0, 2, 1], ["arrow", 0, 2, 1], ["bow", 1, 1, 0.085]] },
  creeper: { name: "Creeper", kind: "hostile", w: 0.7, h: 1.6, hp: 20, speed: 2.3, range: 16, xp: [5, 5], drops: [["gunpowder", 0, 2, 1]] },
  spider: { name: "Spinne", kind: "hostile", w: 1.4, h: 0.9, hp: 16, speed: 3.4, dmg: 2, range: 16, xp: [5, 5], drops: [["string", 0, 2, 1], ["spider_eye", 1, 1, 0.33]] },
  witch: { name: "Hexe", kind: "hostile", w: 0.7, h: 1.85, hp: 26, speed: 2.0, dmg: 4, range: 18, xp: [5, 5], drops: [["stick", 0, 2, 1], ["redstone", 0, 2, 1], ["gunpowder", 0, 2, 1], ["glowstone_dust", 0, 2, 0.4], ["sugar", 0, 2, 0.4], ["glass_bottle", 0, 2, 0.4], ["spider_eye", 0, 1, 0.25]] },
  enderman: { name: "Enderman", kind: "hostile", w: 0.6, h: 2.9, hp: 40, speed: 4.4, dmg: 7, range: 24, xp: [5, 5], drops: [["ender_pearl", 0, 1, 1]] },
  slime: { name: "Schleim", kind: "hostile", w: 0.9, h: 0.7, hp: 10, speed: 2, dmg: 3, range: 22, xp: [4, 4], drops: [["slimeball", 0, 2, 1]] }
};
const HERD = { // Biom → Gewichte der Tiere beim Erzeugen der Welt
  plains: { cow: 3, pig: 2, sheep: 3, chicken: 2 }, forest: { pig: 2, sheep: 2, cow: 2, chicken: 1, wolf: 2 }, birch: { pig: 2, sheep: 2, cow: 2, chicken: 1 },
  taiga: { wolf: 3, rabbit: 2, sheep: 1, pig: 1, cow: 1 }, snow: { rabbit: 3, sheep: 1 }, desert: { rabbit: 2 }, savanna: { cow: 2, sheep: 2, pig: 1, chicken: 1 },
  jungle: { chicken: 3, pig: 1 }, swamp: { cow: 1, chicken: 1 }, mountains: { sheep: 3 }, ocean: {}, warm_ocean: {}, dappled: { pig: 2, sheep: 2, cow: 2, wolf: 1, chicken: 1 },
  meadow: { sheep: 3, cow: 2, pig: 1, rabbit: 2 }, grove: { rabbit: 2, wolf: 2, sheep: 1 }, snowy_slopes: { rabbit: 2 }, jagged_peaks: {}, stony_peaks: { sheep: 1 },
  cherry: { pig: 2, sheep: 2, rabbit: 2, cow: 1 }, mangrove: { cow: 1, chicken: 1 }, bamboo: { pig: 2, chicken: 2 }
};

/** Fortschritte (wie bei Minecraft): id → [Name, Beschreibung] */
export const ADV = {
  wood: ["Holz sammeln", "Schlage einen Baum um und sammle einen Stamm ein."],
  bench: ["Handwerk beginnen", "Stelle eine Werkbank her."],
  stone: ["Steinzeit", "Baue Stein mit einer Spitzhacke ab."],
  furnace: ["Heißes Zeug", "Baue einen Ofen."],
  iron: ["Eisern", "Schmelze einen Eisenbarren."],
  armor: ["Ausgerüstet", "Trage ein Rüstungsteil."],
  diamond: ["Diamanten!", "Finde einen Diamanten."],
  deep: ["Tiefengräber", "Steige tief unter die Erde hinab."],
  bucket: ["Eimerweise", "Stelle einen Eimer her."],
  lava: ["Heiße Sache", "Fülle einen Eimer mit Lava."],
  kill: ["Monsterjäger", "Besiege ein feindliches Monster."],
  shoot: ["Schütze", "Schieße mit einem Bogen."],
  hit: ["Volltreffer", "Triff ein Lebewesen mit einem Pfeil."],
  boom: ["Zisch!", "Überlebe die Explosion eines Creepers."],
  tame: ["Bester Freund", "Zähme einen Wolf oder eine Katze."],
  shear: ["Schäfer", "Schere ein Schaf."],
  bed: ["Süße Träume", "Schlafe in einem Bett."],
  spider: ["Spinnenjäger", "Erlege eine Spinne."],
  farm: ["Landwirt", "Ernte reifen Weizen, Karotten oder Kartoffeln."],
  breed: ["Zuchterfolg", "Lass zwei Tiere ein Baby bekommen."],
  fish: ["Petri Heil", "Fange etwas mit der Angel."],
  redstone: ["Es werde Licht", "Bring eine Redstone-Lampe zum Leuchten."],
  enchant: ["Verzauberer", "Verzaubere einen Gegenstand am Verzauberungstisch."],
  brew: ["Hexenküche", "Braue einen Trank."]
};

export function installMobs(Sandbox, K) {
  const { clamp, W, H, SURF, SPAWN_X, REACH } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1) => ({ id, n, d: 0 });

  /** Haken für zusätzliche Felder beim Speichern / Laden von Tieren (ab Etappe 12 gefüllt) */
  P._mobSaveX = function () {};
  P._mobLoadX = function () {};
  P._mobInit = function () {
    this.mrng = mulberry32((this.seed ^ 0x3f1d) + Math.floor(this.time * 1000));   // eigener Zufall: Tiere ändern nichts am übrigen Weltgeschehen
    this.mobs = []; this.proj = []; this._mobId = 0; this.passT = 4; this.advT = 1; this.blocking = false; this.bow = null; this.aim = null;
    if (!this.adv) this.adv = {};
  };

  // ---------- Erzeugen ----------
  P.spawnMob = function (type, x, y, extra = {}) {
    const d = MOBS[type];
    const m = {
      id: ++this._mobId, type, kind: d.kind, x, y: y - d.h - 0.001, w: d.w, h: d.h, vx: 0, vy: 0, onGround: false, face: this.mrng() < 0.5 ? -1 : 1, hp: d.hp, maxHp: d.hp,
      hurtT: 0, t: this.mrng() * 2, dir: 0, stepUp: false, atkCd: 1, panic: 0, flee: 0, angry: false, tamed: false, sit: false, ...extra
    };
    if (type === "sheep") { m.sheared = false; m.shearT = 0; }
    if (type === "chicken") m.eggT = 200 + this.mrng() * 300;
    if (type === "rabbit") m.hopT = 0.5;
    if (type === "skeleton" || type === "witch") m.shootCd = 1.5 + this.mrng();
    if (type === "creeper") m.fuse = 0;
    if (type === "spider") m.leapCd = 1;
    if (type === "enderman") m.tpT = 4;
    if (type === "slime") m.hopT = 0.5 + this.mrng();
    this._mobInitNew(m, type);
    this.mobs.push(m);
    return m;
  };
  /** Tiere beim Erzeugen der Welt verteilen (gleiche Welt → gleiche Tiere) */
  P._populate = function () {
    const rnd = mulberry32((this.seed ^ 0x7ac3) | 0);
    const pick = w => { const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0); if (!tot) return null; let r = rnd() * tot; for (const [k, v] of e) { r -= v; if (r < 0) return k; } return e[0][0]; };
    for (let x = 18; x < W - 18; x += 6 + Math.floor(rnd() * 9)) {
      const gy = this.ground[x], t = this.tile(x, gy);
      if (gy > SURF + 4 || (t !== B.GRASS && t !== B.GRASS_SNOW) || this.tile(x, gy - 1) !== B.AIR) continue;
      const type = pick(HERD[this.biomeAt(x)] || {});
      if (!type) continue;
      const n = type === "wolf" ? 2 + Math.floor(rnd() * 3) : type === "chicken" ? 2 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const px = x + i * 1.3 - n * 0.6, ix = Math.floor(px);
        if (ix < 2 || ix >= W - 2 || this.tile(ix, this.ground[ix]) === B.WATER || this.ground[ix] > SURF + 4) continue;
        { const m = this.spawnMob(type, px, this.ground[ix]); if (this._hit(m)) this.mobs.pop(); }
      }
    }
    for (const v of this.villages || []) for (let i = 0; i < 2; i++) { const ix = Math.floor(v.x + (i ? 10 : -12)); if (ix > 2 && ix < W - 2) { const m = this.spawnMob("cat", ix, v.y); if (this._hit(m)) this.mobs.pop(); } }
  };

  // ---------- Hilfen ----------
  P._los = function (x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 1; i < n; i++) { const t = i / n; if (BLOCKS[this.tile(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))].solid) return false; }
    return true;
  };
  P._cliffAhead = function (m, dir) {
    const x = Math.floor(m.x + m.w / 2 + dir * (m.w / 2 + 0.6)), y0 = Math.floor(m.y + m.h + 0.05);
    if (isFluid(this.tile(x, y0)) || isFluid(this.tile(x, y0 - 1))) return true;
    for (let k = 0; k < 4; k++) if (BLOCKS[this.tile(x, y0 + k)].solid) return false;
    return true;
  };
  P._steer = function (m, dir, speed, dt, jump = 11) {
    if (m.slowT > 0) speed *= 0.55;
    const acc = (m.onGround ? 42 : 12) * dt;
    m.vx += clamp(dir * speed - m.vx, -acc, acc);
    if (dir) m.face = dir;
    if (dir && m.blocked && m.onGround) { m.vy = -jump; m.onGround = false; }
  };
  const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
  const cxOf = m => m.x + m.w / 2;
  P.mobAtTile = function (tx, ty) {
    const p = this.player;
    let best = null, bd = 1e9;
    for (const m of this.mobs) {
      if (m.x >= tx + 1 || m.x + m.w <= tx || m.y >= ty + 1 || m.y + m.h <= ty) continue;
      const d = Math.hypot(cxOf(m) - (p.x + p.w / 2), m.y + m.h / 2 - (p.y + p.h / 2));
      if (d <= REACH + 1 && d < bd) { best = m; bd = d; }
    }
    return best;
  };
  P.hostilesNear = function (x, r) { let n = 0; for (const m of this.mobs) if (m.kind === "hostile" && Math.abs(cxOf(m) - x) < r) n++; return n; };
  P.grant = function (id) {
    if (!ADV[id] || this.adv[id]) return;
    this.adv[id] = 1; this.events.push({ t: "adv", id, name: ADV[id][0] });
  };

  // ---------- Schaden ----------
  /** Schaden an einem Lebewesen. dir = Richtung des Rückstoßes (0 = keiner). Liefert true, wenn es dabei starb. */
  P._mobHurt = function (m, dmg, dir, src) {
    if (m.dead || dmg <= 0) return false;
    dmg = this._mobHurtMod(m, dmg, dir, src);
    if (dmg <= 0) return false;
    m.hp -= dmg; m.hurtT = 0.35;
    if (dir && !m.fly && m.kind !== "object") { const res = m.type === "enderman" ? 0.3 : m.type === "cow" ? 0.8 : 1; m.vx = dir * (7 + 3 * (this._kb | 0)) * res; m.vy = -5 * res; m.onGround = false; }
    if (m.kind === "passive") { m.panic = 5; m.flee = dir || (this.mrng() < 0.5 ? -1 : 1); }
    else if (m.type === "wolf" || m.type === "spider" || m.type === "enderman") { if (src === "player" || src === "arrow") m.angry = true; }
    this.events.push({ t: "hit", x: cxOf(m), y: m.y, n: Math.round(dmg), src });
    if (m.hp <= 0) { this._mobDie(m, src); return true; }
    if (m.type === "enderman" && (src === "player" || src === "arrow") && this.mrng() < 0.4) this._teleport(m, 8);
    return false;
  };
  P._mobDie = function (m, src) {
    if (m.dead) return;
    m.dead = true;
    const i = this.mobs.indexOf(m); if (i >= 0) this.mobs.splice(i, 1);
    const d = MOBS[m.type], baby = m.baby > 0, loot = src === "player" ? m.lootLvl | 0 : 0;
    for (const [id0, a, b, pr] of baby ? [] : d.drops) {
      if (id0 === "wool" && m.sheared) continue;
      if (this.mrng() >= pr) continue;
      const n = a + Math.floor(this.mrng() * (b - a + 1 + loot));
      const id = m.ignite > 0 && SMELT[id0] && /^raw_/.test(id0) ? SMELT[id0][0] : id0;      // brennende Tiere lassen Gebratenes fallen
      if (n > 0) this.dropStack(stk(id, n), cxOf(m), m.y + m.h / 2, true);
    }
    const byPlayer = (src === "player" || src === "arrow") && !baby;
    if (byPlayer) {
      this.addXp(d.xp[0] + Math.floor(this.mrng() * (d.xp[1] - d.xp[0] + 1)));
      if (m.kind === "hostile") { this.stats.kills++; this.grant("kill"); if (m.type === "spider") this.grant("spider"); }
    }
    this.events.push({ t: "kill", x: cxOf(m), y: m.y + m.h / 2, type: m.type });
    this._mobDieNew(m, src);
  };
  /** Spieler greift an (Mausposition in Blockkoordinaten). true = getroffen. */
  const COOLDOWN = { sword: 0.5, axe: 1.0, pick: 0.85, shovel: 0.9, hoe: 0.4 };
  P.attack = function (mx, my) {
    const p = this.player;
    if (p.atkCd > 0 || this.win) return false;
    if (this._projAttack(mx, my)) return true;
    let target = null, bd = 1e9;
    for (const m of this.mobs) {
      if (mx < m.x - 0.35 || mx > m.x + m.w + 0.35 || my < m.y - 0.35 || my > m.y + m.h + 0.35) continue;
      const d = Math.hypot(cxOf(m) - (p.x + p.w / 2), m.y + m.h / 2 - (p.y + p.h / 2));
      if (d > REACH - 0.5 + m.w / 2) continue;
      if (d < bd) { target = m; bd = d; }
    }
    if (!target) return false;
    const tool = this.heldTool(), en = tool.ench || {};
    let dmg = tool.dmg;
    if (en.sharpness && (tool.type === "sword" || tool.type === "axe")) dmg += 1 + 0.5 * (en.sharpness - 1);
    if (this.fx && this.fx.strength) dmg += 3 * this.fxAmp("strength");
    if (this.fx && this.fx.weakness) dmg = Math.max(1, dmg - 4 * this.fxAmp("weakness"));
    const crit = !p.onGround && p.vy > 1 && !p.inWater && !p.onLadder;
    if (crit) dmg = Math.round(dmg * 1.5 * 2) / 2;
    p.atkCd = tool.type ? COOLDOWN[tool.type] || 0.6 : 0.3;
    if (tool.type) this._wear(this.inv, this.sel, tool.type === "sword" ? 1 : 2);
    this.addExh(0.1);
    target.lootLvl = en.looting | 0;
    if (en.fire_aspect) target.ignite = Math.max(target.ignite || 0, 4 * en.fire_aspect);
    this._kb = en.knockback | 0;
    this._mobHurt(target, dmg, sgn(cxOf(target) - (p.x + p.w / 2)) || p.face, "player");
    this._kb = 0;
    if (crit) this.events.push({ t: "crit", x: cxOf(target), y: target.y });
    return true;
  };
  /** Rechtsklick auf ein Tier: scheren, melken, zähmen, füttern, sitzen lassen */
  P.mobUse = function (tx, ty) {
    const m = this.mobAtTile(tx, ty);
    if (!m) return false;
    const s = this.selStack(), id = s && s.id;
    if (this._mobUseNew(m, s)) return true;
    if (m.type === "sheep" && id === "shears" && !m.sheared && !(m.baby > 0)) {
      m.sheared = true; m.shearT = 120;
      this.dropStack(stk("wool", 1 + Math.floor(this.mrng() * 3)), cxOf(m), m.y + m.h / 2, true);
      this._wear(this.inv, this.sel, 1); this.grant("shear"); this.events.push({ t: "shear", x: cxOf(m), y: m.y });
      return true;
    }
    if (m.type === "cow" && id === "bucket" && !(m.baby > 0)) {
      s.n--; if (s.n <= 0) this.inv[this.sel] = null;
      this.add("milk_bucket", 1, 0, true); this.events.push({ t: "bucket", fill: true, x: Math.floor(cxOf(m)), y: Math.floor(m.y) });
      return true;
    }
    if ((m.type === "wolf" && id === "bone") || (m.type === "cat" && id === "raw_chicken")) {
      if (m.tamed) return false;
      this._consumeSel();
      if (this.mrng() < 0.34) { m.tamed = true; m.angry = false; m.hp = m.maxHp = m.type === "wolf" ? 20 : 10; m.sit = true; this.grant("tame"); this.events.push({ t: "tame", x: cxOf(m), y: m.y }); }
      else this.events.push({ t: "smoke", x: cxOf(m), y: m.y });
      return true;
    }
    if (this._feed(m, s)) return true;
    if (m.tamed) {
      if (m.type === "wolf" && s && ITEMS[s.id].food && /raw_|cooked_|steak|rotten/.test(s.id) && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + ITEMS[s.id].food[0]); this._consumeSel(); this.events.push({ t: "tame", x: cxOf(m), y: m.y }); return true; }
      m.sit = !m.sit; this.events.push({ t: "sit", sit: m.sit });
      return true;
    }
    return false;
  };

  // ---------- Pfeile, Tränke, Explosionen ----------
  P._shoot = function (m, kind, tx, ty, speed, dmg) {
    const x0 = cxOf(m), y0 = m.y + m.h * 0.3, dx = tx - x0, dy = ty - y0;
    const t = Math.max(0.25, Math.abs(dx) / speed), g = kind === "potion" ? 14 : 20;
    const vx = dx / t, vy = (dy - 0.5 * g * t * t) / t + (this.mrng() - 0.5) * 1.6;
    this.proj.push({ kind, x: x0, y: y0, vx, vy, dmg, fromPlayer: false, age: 0, stuck: false, stuckT: 0 });
    this.events.push({ t: "shoot", mob: true });
  };
  P.bowDraw = function (dt) {
    if (this.win || this.selItem() !== "bow" || this.count("arrow") <= 0) { this.bow = null; return false; }
    if (!this.bow) this.bow = { t: 0 };
    this.bow.t = Math.min(1.2, this.bow.t + dt);
    return true;
  };
  P.bowRelease = function (mx, my) {
    const b = this.bow; this.bow = null;
    if (!b || b.t < 0.25 || this.selItem() !== "bow") return false;
    const en = this.selStack().e || {}, inf = !!en.infinity;
    if (!(inf ? this.count("arrow") > 0 : this.take("arrow", 1))) return false;
    const p = this.player, x0 = p.x + p.w / 2, y0 = p.y + 0.5, q = Math.min(1, b.t / 1.0);
    const L = Math.max(0.1, Math.hypot(mx - x0, my - y0)), speed = 14 + 26 * q;
    this.proj.push({ kind: "arrow", x: x0, y: y0, vx: (mx - x0) / L * speed, vy: (my - y0) / L * speed, dmg: Math.round((2 + 7 * q) * (en.power ? 1 + 0.25 * (en.power + 1) : 1)), fromPlayer: true, crit: q >= 1, age: 0, stuck: false, stuckT: 0, kb: en.punch | 0, fire: !!en.flame, noPickup: inf });
    this._wear(this.inv, this.sel, 1); this.addExh(0.05);
    this.grant("shoot"); this.events.push({ t: "shoot", mob: false });
    return true;
  };
  P._projectiles = function (dt) {
    const p = this.player;
    for (const a of [...this.proj]) {
      if (this._projSpecial(a, dt)) continue;
      if (a.stuck) {
        a.stuckT -= dt;
        if (!BLOCKS[this.tile(Math.floor(a.x), Math.floor(a.y))].solid) a.stuck = false;            // Block weg → fällt weiter
        else {
          if (a.fromPlayer && a.kind === "arrow" && !a.noPickup && Math.abs(a.x - (p.x + p.w / 2)) < 1.2 && Math.abs(a.y - (p.y + p.h / 2)) < 1.5 && this.room(a.item || "arrow") > 0) { this.add(a.item || "arrow", 1, a.tip | 0); this.proj.splice(this.proj.indexOf(a), 1); continue; }
          if (a.stuckT <= 0) this.proj.splice(this.proj.indexOf(a), 1);
          continue;
        }
      }
      a.age += dt;
      if (a.age > 15 || a.y > H + 5) { this.proj.splice(this.proj.indexOf(a), 1); continue; }
      const sp = Math.hypot(a.vx, a.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.2)), sdt = dt / steps;
      let gone = false;
      for (let k = 0; k < steps && !gone; k++) {
        a.vy += (a.kind === "potion" ? 14 : 20) * sdt; a.x += a.vx * sdt; a.y += a.vy * sdt;
        a.ang = Math.atan2(a.vy, a.vx);
        if (a.x < 0 || a.x >= W) { gone = true; break; }
        const tid = this.tile(Math.floor(a.x), Math.floor(a.y));
        if (BLOCKS[tid].solid) {
          if (a.kind === "potion") { if (a.pot !== undefined) this._splashPotion(a); else this._splash(a); gone = true; }
          else { a.stuck = true; a.stuckT = 60; a.vx = a.vy = 0; this.events.push({ t: "thunk", x: a.x, y: a.y }); }
          break;
        }
        if (tid === B.WATER) { a.vx *= 1 - 3 * sdt; a.vy *= 1 - 3 * sdt; }
        if (!a.fromPlayer) {
          if (a.x > p.x - 0.1 && a.x < p.x + p.w + 0.1 && a.y > p.y - 0.1 && a.y < p.y + p.h + 0.1) {
            if (a.kind === "potion") this._splash(a); else this.hurt(a.dmg, sgn(a.vx), "arrow");
            gone = true;
          }
        } else {
          for (const m of this.mobs) {
            if (a.x > m.x - 0.1 && a.x < m.x + m.w + 0.1 && a.y > m.y - 0.1 && a.y < m.y + m.h + 0.1) {
              if (a.kind === "potion") { this._splashPotion(a); gone = true; break; }
              if (a.hitSet && a.hitSet.has(m)) continue;                      // Durchschuss: jedes Ziel nur einmal
              this._kb = a.kb | 0; if (a.fire) m.ignite = Math.max(m.ignite || 0, 5);
              this._mobHurt(m, a.dmg, sgn(a.vx), "arrow"); this._kb = 0; this.grant("hit");
              if (a.ak) this._arrowEffects(a, m);
              if (a.pierce > 0) { a.pierce--; (a.hitSet = a.hitSet || new Set()).add(m); continue; }
              gone = true; break;
            }
          }
        }
      }
      if (gone) { const i = this.proj.indexOf(a); if (i >= 0) this.proj.splice(i, 1); }
    }
  };
  P._splash = function (a) {
    const p = this.player;
    this.events.push({ t: "splash", x: a.x, y: a.y });
    if (Math.hypot(a.x - (p.x + p.w / 2), a.y - (p.y + p.h / 2)) < 2.2) this.hurt(a.dmg, sgn(p.x - a.x), "potion");
  };
  P.explode = function (cx, cy, r, opts = {}) {
    const R = Math.ceil(r), p = this.player, k = opts.k ?? 1;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (opts.noBlocks) break;
      const d = Math.hypot(dx, dy);
      if (d > r * (0.8 + 0.25 * this.mrng())) continue;
      const x = Math.floor(cx) + dx, y = Math.floor(cy) + dy, id = this.tile(x, y), bd = BLOCKS[id];
      if (id === B.AIR || isFluid(id) || bd.hard === Infinity || id === B.OBSIDIAN || y < 2 || y >= H - 4) continue;
      this._noDrops = this.mrng() > 0.3; this._break(x, y, false);
    }
    this._noDrops = false;
    const hit = (b, isPlayer) => {
      const bx = b.x + b.w / 2, by = b.y + b.h / 2, d = Math.hypot(bx - cx, by - cy);
      if (d >= r * 2) return;
      const dmg = Math.round(22 * k * (1 - d / (r * 2))), dir = sgn(bx - cx) || 1;
      if (isPlayer) { if (opts.noPlayer) return; if (dmg > 0) { p.invuln = 0; this.hurt(dmg, dir, "explosion"); p.vx = dir * 10; p.vy = -8; this.grant("boom"); } }
      else if (dmg > 0) this._mobHurt(b, dmg, dir, "explosion");
    };
    hit(p, true);
    for (const m of [...this.mobs]) if (m.type !== "creeper" || !m.exploding) hit(m, false);
    this.events.push({ t: "boom", x: cx, y: cy, r });
  };

  // ---------- Schlafen ----------
  /** Nächstgelegene freie Stelle für einen Spieler-Körper (nach oben / seitlich ausweichen) */
  P._safeSpot = function (x, y) {
    const p = this.player;
    for (const dy of [0, -1, -2, -3, 1]) for (const dx of [0, -1, 1, -2, 2]) {
      const b = { x: clamp(x + dx, 0, W - p.w), y: y + dy, w: p.w, h: p.h };
      if (b.y >= 0 && !this._hit(b)) return { x: b.x, y: b.y };
    }
    return { x, y };
  };
  P.sleep = function (tx, ty, straw = false) {
    if (this.dim) { this._break(tx, ty, false); this.explode(tx + 0.5, ty + 0.5, 4); return true; }
    const t = this.time;
    if (!(t >= 0.78 || t < 0.2)) { this.events.push({ t: "nosleep", why: "day" }); return false; }
    if (this.hostilesNear(this.player.x, 16) > 0) { this.events.push({ t: "nosleep", why: "mobs" }); return false; }
    if (!straw) { this.bed = { x: tx, y: ty }; this.spawn = this._safeSpot(tx + 0.1, ty + 1 - 1.8 - 0.001); }
    if (t >= 0.78) { this.day++; this.events.push({ t: "day", day: this.day }); }
    this.time = 0.27;
    this.grant("bed");
    this.events.push({ t: "sleep" });
    return true;
  };

  // ---------- Künstliche Intelligenz ----------
  P._teleport = function (m, r, nearP) {
    const p = this.player, cx0 = nearP ? p.x : cxOf(m);
    for (let k = 0; k < 16; k++) {
      const x = Math.floor(cx0 + (this.mrng() - 0.5) * 2 * r), yy = this._findSpawnY(x, Math.max(3, Math.floor(m.y) - 8), Math.min(H - 6, Math.floor(m.y) + 8), Math.ceil(m.h));
      if (yy < 0) continue;
      m.x = x + 0.5 - m.w / 2; m.y = yy - m.h - 0.001; m.vx = m.vy = 0;
      this.events.push({ t: "tp", x: m.x, y: m.y });
      return true;
    }
    return false;
  };
  P._findSpawnY = function (x, yMin, yMax, h) {
    const n = yMax - yMin; if (n <= 0) return -1;
    const start = Math.floor(this.mrng() * n);
    for (let k = 0; k < n; k++) {
      const y = yMin + ((start + k) % n), t = this.tile(x, y);
      if (!BLOCKS[t].solid || t === B.CACTUS || t === B.GLASS || t === B.ICE) continue;
      let ok = true;
      for (let j = 1; j <= h; j++) { const u = this.tile(x, y - j); if (BLOCKS[u].solid || isFluid(u)) { ok = false; break; } }
      if (ok) return y;
    }
    return -1;
  };
  P._mobs = function (dt) {
    const p = this.player;
    this._mobSpawn(dt);
    for (const m of [...this.mobs]) {
      if (m.dead) continue;
      const far = Math.abs(cxOf(m) - (p.x + p.w / 2));
      if (far > 72 && !m.tamed && !m.boss) { if (m.kind === "hostile" && far > 95) this._remove(m); continue; }
      m.hurtT = Math.max(0, m.hurtT - dt); m.atkCd -= dt;
      const d = MOBS[m.type];
      // Wasser, Lava
      if (m.inWater && m.type !== "enderman" && !d.aq) m.vy = Math.max(-2.6, m.vy - 36 * dt);
      if (m.inLava) { m.lavaT = (m.lavaT || 0) - dt; if (m.lavaT <= 0) { m.lavaT = 0.5; this._mobHurt(m, 4, 0, "lava"); if (m.dead) continue; } }
      if (m.type === "enderman" && m.inWater) { this._mobHurt(m, 2 * dt * 3, 0, "water"); if (m.dead) continue; }
      if ((m.type === "zombie" || m.type === "skeleton" || (m.type === "zombie_villager" && !(m.curing > 0))) && !m.inWater) {
        const ix = Math.floor(cxOf(m)), iy = Math.floor(m.y + 0.2);
        m.fire = iy >= 0 && iy < H && this.sky[iy * W + ix] * this.dayFactor() >= 12.5;
        if (m.fire) { m.burnT = (m.burnT || 1) - dt; if (m.burnT <= 0) { m.burnT = 1; this._mobHurt(m, 1, 0, "fire"); if (m.dead) continue; } }
      } else m.fire = false;
      if (m.ignite > 0) {
        if (m.inWater) m.ignite = 0;
        else { m.ignite -= dt; m.fire = true; m.igT = (m.igT || 1) - dt; if (m.igT <= 0) { m.igT = 1; this._mobHurt(m, 1, 0, "fire"); if (m.dead) continue; } }
      }
      if (m.poisonT > 0) { m.poisonT -= dt; m.poiT = (m.poiT || 1.25) - dt; if (m.poiT <= 0) { m.poiT = 1.25; if (m.hp > 1) this._mobHurt(m, 1, 0, "poison"); if (m.dead) continue; } }
      if (m.slowT > 0) m.slowT -= dt;
      const cx = cxOf(m), cy = m.y + m.h * 0.3, pcx = p.x + p.w / 2, pcy = p.y + 0.7;
      const dx = pcx - cx, dy = pcy - cy, dist = Math.hypot(dx, dy) * (this.fx && this.fx.invisibility ? 4 : 1);
      const nb = this._aiNew(m, d, dt, dx, dy, dist);
      if (!nb) switch (m.type) {
        case "zombie": this._aiMelee(m, d, dt, dx, dy, dist, 11); break;
        case "spider": this._aiSpider(m, d, dt, dx, dy, dist); break;
        case "skeleton": this._aiRanged(m, d, dt, dx, dy, dist, "arrow"); break;
        case "witch": this._aiRanged(m, d, dt, dx, dy, dist, "potion"); break;
        case "creeper": this._aiCreeper(m, d, dt, dx, dy, dist); break;
        case "enderman": this._aiEnder(m, d, dt, dx, dy, dist); break;
        case "slime": this._aiSlime(m, d, dt, dx, dy, dist); break;
        case "wolf": this._aiWolf(m, d, dt, dx, dy, dist); break;
        default: this._aiPassive(m, d, dt, dx, dy, dist);
      }
      if (m.dead) continue;
      if (nb !== 2) this._body(m, dt, m.type === "enderman" ? 36 : 42);
      m.x = clamp(m.x, 0, W - m.w);
      if (m.y > H || (this.dim === 2 && !m.boss && m.y > NH - 12)) this._remove(m);
    }
    this._projectiles(dt);
    this.advT -= dt; if (this.advT <= 0) { this.advT = 1; this._advTick(); }
  };
  P._remove = function (m) { m.dead = true; const i = this.mobs.indexOf(m); if (i >= 0) this.mobs.splice(i, 1); };
  P._wander = function (m, d, dt, speedK = 1) {
    m.t -= dt;
    if (m.t <= 0) { const r = this.mrng(); if (r < 0.45) { m.dir = 0; m.t = 1 + this.mrng() * 3.5; } else { m.dir = r < 0.725 ? -1 : 1; m.t = 1 + this.mrng() * 3; } }
    if (m.dir && m.onGround && this._cliffAhead(m, m.dir)) m.dir = -m.dir;
    this._steer(m, m.dir, d.speed * 0.55 * speedK, dt);
  };
  /** Kontaktschaden */
  P._touch = function (m, d, dt) {
    const p = this.player;
    if (m.atkCd <= 0 && touching(m, p, 0.12)) { m.atkCd = 1.0; this.hurt(d.dmg, sgn(p.x + p.w / 2 - cxOf(m)) || 1, "mob"); if (m.type === "wither_skeleton") this.addEffect("wither", 8, 0); }
  };
  P._aiPassive = function (m, d, dt, dx, dy, dist) {
    if (this._loveAI(m, d, dt)) return;
    if (m.type === "sheep" && m.sheared) { m.shearT -= dt; if (m.shearT <= 0) m.sheared = false; }
    if (m.type === "chicken") {
      m.eggT -= dt;
      if (m.eggT <= 0) { m.eggT = 300 + this.mrng() * 300; this.dropStack(stk("egg"), cxOf(m), m.y + m.h / 2, true); }
      if (!m.onGround && m.vy > 2) m.vy = 2;                                    // flattert langsam hinunter
    }
    let dir = 0, speed = d.speed * 0.55;
    if (m.panic > 0) {
      m.panic -= dt; dir = m.flee; speed = d.speed * 1.5;
      if (m.onGround && this._cliffAhead(m, dir)) { dir = -dir; m.flee = dir; }
    } else if (m.tamed) {
      if (dist > 15) { this._teleport(m, 3, true); return; }
      if (!m.sit && Math.abs(dx) > 3) { dir = sgn(dx); speed = 4.2; if (m.onGround && this._cliffAhead(m, dir) && dy < 2) dir = 0; }
    } else {
      m.t -= dt;
      if (m.t <= 0) { const r = this.mrng(); if (r < 0.45) { m.dir = 0; m.t = 1 + this.mrng() * 3.5; } else { m.dir = r < 0.725 ? -1 : 1; m.t = 1 + this.mrng() * 3; } }
      if (m.dir && m.onGround && this._cliffAhead(m, m.dir)) m.dir = -m.dir;
      dir = m.dir;
    }
    if (m.type === "rabbit") {
      m.hopT -= dt;
      if (dir && m.onGround && m.hopT <= 0) { m.onGround = false; m.vy = -8.5; m.vx = dir * Math.max(speed, 2.2) * 1.3; m.hopT = 0.35 + this.mrng() * 0.4; m.face = dir; }
      else if (m.onGround && !dir) m.vx *= 0.7;
    } else this._steer(m, dir, speed, dt);
  };
  P._aiWolf = function (m, d, dt, dx, dy, dist) {
    if (m.tamed) {
      if (this._loveAI(m, d, dt)) return;
      if (dist > 14) { this._teleport(m, 3, true); return; }
      // Beschützer: nächstes Monster in der Nähe des Spielers angreifen
      let tgt = null, bd = 9;
      for (const o of this.mobs) if (o.kind === "hostile" && o.type !== "creeper" && Math.abs(cxOf(o) - this.player.x) < 9 && Math.hypot(cxOf(o) - cxOf(m), o.y - m.y) < bd) { tgt = o; bd = Math.hypot(cxOf(o) - cxOf(m), o.y - m.y); }
      if (m.sit) { this._steer(m, 0, 0, dt); return; }
      if (tgt) {
        const dir = sgn(cxOf(tgt) - cxOf(m)); this._steer(m, Math.abs(cxOf(tgt) - cxOf(m)) > 0.6 ? dir : 0, d.speed * 1.4, dt);
        if (m.atkCd <= 0 && touching(m, tgt, 0.25)) { m.atkCd = 0.9; this._mobHurt(tgt, 4, dir, "wolf"); }
        return;
      }
      if (Math.abs(dx) > 3) this._steer(m, sgn(dx), d.speed * 1.2, dt); else this._steer(m, 0, 0, dt);
      return;
    }
    if (m.angry) {
      if (dist > 22) m.angry = false;
      this._steer(m, Math.abs(dx) > 0.6 ? sgn(dx) : 0, d.speed, dt);
      this._touch(m, d, dt);
      return;
    }
    this._wander(m, d, dt);
  };
  P._aiMelee = function (m, d, dt, dx, dy, dist, jump) {
    const aware = dist < d.range;
    if (aware) {
      this._steer(m, Math.abs(dx) > 0.5 ? sgn(dx) : 0, d.speed, dt, jump);
      this._touch(m, d, dt);
    } else this._wander(m, d, dt, 0.8);
  };
  P._aiSpider = function (m, d, dt, dx, dy, dist) {
    const cx = Math.floor(cxOf(m)), cy = Math.floor(m.y + 0.2);
    const aggressive = m.angry || this.lightAt(cx, cy) < 10;
    m.leapCd -= dt;
    if (dist < d.range && aggressive) {
      const dir = Math.abs(dx) > 0.5 ? sgn(dx) : 0;
      this._steer(m, dir, d.speed, dt, 10);
      if (m.blocked && dy < -0.5) m.vy = -5;                              // an der Wand hochklettern
      if (m.leapCd <= 0 && dist < 4.5 && m.onGround && Math.abs(dy) < 2.5) { m.vy = -9; m.onGround = false; m.vx = sgn(dx) * 7; m.leapCd = 1.3; }
      this._touch(m, d, dt);
    } else this._wander(m, d, dt);
  };
  P._aiRanged = function (m, d, dt, dx, dy, dist, kind) {
    const p = this.player, pcy = p.y + 0.7;
    const sight = dist < d.range && this._los(cxOf(m), m.y + 0.4, p.x + p.w / 2, pcy);
    m.shootCd -= dt;
    if (sight) {
      const want = kind === "arrow" ? 6.5 : 8.5;
      let dir = 0;
      if (Math.abs(dx) > want + 2.5) dir = sgn(dx); else if (Math.abs(dx) < want - 2) dir = -sgn(dx);
      if (dir && m.onGround && this._cliffAhead(m, dir)) dir = 0;
      this._steer(m, dir, d.speed, dt);
      m.face = sgn(dx) || m.face;
      if (m.shootCd <= 0) { m.shootCd = (kind === "arrow" ? 2 : 3) + this.mrng() * 0.8; this._shoot(m, kind, p.x + p.w / 2, pcy, kind === "arrow" ? 24 : 14, d.dmg); }
    } else if (dist < d.range) this._steer(m, sgn(dx), d.speed * 0.8, dt);
    else this._wander(m, d, dt);
  };
  P._aiCreeper = function (m, d, dt, dx, dy, dist) {
    // Katzen verscheuchen Creeper
    for (const o of this.mobs) if (o.type === "cat" && Math.abs(cxOf(o) - cxOf(m)) < 6 && Math.abs(o.y - m.y) < 3) { m.fuse = 0; this._steer(m, -sgn(cxOf(o) - cxOf(m)), d.speed * 1.2, dt); return; }
    const p = this.player, los = this._los(cxOf(m), m.y + 0.4, p.x + p.w / 2, p.y + 0.7);
    if (dist < 3 && los && Math.abs(dy) < 2.2) {
      if (m.fuse <= 0) this.events.push({ t: "fuse", x: cxOf(m), y: m.y });
      m.fuse += dt; this._steer(m, 0, 0, dt);
      if (m.fuse >= 1.5) { m.exploding = true; const x = cxOf(m), y = m.y + m.h / 2; this._remove(m); this.explode(x, y, 3); }
      return;
    }
    if (m.fuse > 0) m.fuse = dist > 5 ? 0 : Math.max(0, m.fuse - dt * 1.5);
    if (dist < d.range) this._steer(m, Math.abs(dx) > 0.5 ? sgn(dx) : 0, d.speed, dt, 11);
    else this._wander(m, d, dt, 0.8);
  };
  P._aiEnder = function (m, d, dt, dx, dy, dist) {
    const a = this.aim, p = this.player;
    if (!m.angry && a && a.x > m.x - 0.4 && a.x < m.x + m.w + 0.4 && a.y > m.y - 0.4 && a.y < m.y + m.h + 0.4 && dist < 30 && this._los(p.x + p.w / 2, p.y + 0.5, cxOf(m), m.y + 0.3)) m.angry = true;
    if (m.angry) {
      if (dist > 40) { m.angry = false; return; }
      m.tpT -= dt;
      if (m.tpT <= 0) { m.tpT = 3 + this.mrng() * 3; if (dist > 5) this._teleport(m, 5, true); }
      this._steer(m, Math.abs(dx) > 0.6 ? sgn(dx) : 0, d.speed, dt, 12);
      this._touch(m, d, dt);
    } else {
      m.tpT -= dt; if (m.tpT <= 0) { m.tpT = 8 + this.mrng() * 8; if (this.mrng() < 0.3) this._teleport(m, 10); }
      this._wander(m, d, dt, 0.8);
    }
  };
  P._aiSlime = function (m, d, dt, dx, dy, dist) {
    m.hopT -= dt;
    const near = dist < d.range;
    if (m.onGround && m.hopT <= 0) {
      m.hopT = 0.9 + this.mrng() * 0.8;
      const dir = near ? sgn(dx) : (this.mrng() < 0.5 ? -1 : 1);
      m.vx = dir * (near ? 4.2 : 2); m.vy = -9; m.onGround = false; m.face = dir;
    }
    if (m.onGround) m.vx *= 0.8;
    this._touch(m, d, dt);
  };

  // ---------- Spawnen ----------
  const HOSTILE_W = {
    surface: { zombie: 40, skeleton: 22, creeper: 24, spider: 20, enderman: 3, witch: 1 },
    cave: { zombie: 30, skeleton: 30, creeper: 22, spider: 24, slime: 12, enderman: 2, witch: 1 }
  };
  const inVillage = (self, x, y) => (self.villages || []).some(v => Math.abs(v.x - x) < 28 && y <= v.y + 6 && y >= v.y - 16);
  P._mobSpawn = function (dt) {
    if (this.dim) return this._mobSpawnDim(dt);
    const p = this.player;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.4;
      if (this.hostilesNear(p.x, 70) < 14) {
        const side = this.mrng() < 0.5 ? -1 : 1, x = Math.floor(p.x + side * (13 + this.mrng() * 18));
        if (x >= 3 && x < W - 3) {
          const y0 = Math.max(3, Math.floor(p.y) - 14), y1 = Math.min(H - 6, Math.floor(p.y) + 16);
          const fy = this._findSpawnY(x, y0, y1, 2);
          if (fy > 0 && !inVillage(this, x, fy) && this.lightAt(x, fy - 1) <= 6) {
            const cave = fy > this.ground[x] + 3, wts = { ...(cave ? HOSTILE_W.cave : HOSTILE_W.surface) }, bi = this.biomeAt(x);
            if (bi === "swamp") { wts.witch += 12; wts.slime = (wts.slime || 0) + (cave ? 0 : 14); }
            if (bi === "desert" || bi === "ocean" || bi === "warm_ocean") wts.slime = 0;
            // Enderman braucht drei freie Blöcke
            if (!(this.tile(x, fy - 3) === B.AIR)) delete wts.enderman;
            if (this.tile(x, fy - 1) !== B.AIR && BLOCKS[this.tile(x, fy - 1)].solid) { /* Pflanze o. Ä.: ok */ }
            const e = Object.entries(wts).filter(([, v]) => v > 0), tot = e.reduce((a, [, v]) => a + v, 0);
            let r = this.mrng() * tot, type = e[0][0]; for (const [k, v] of e) { r -= v; if (r < 0) { type = k; break; } }
            this.spawnMob(type, x + 0.5 - MOBS[type].w / 2, fy, type === "zombie" && (x * 31 + this.day) % 8 === 0 ? { shield: true } : {});
          }
        }
      }
    }
    this.passT -= dt;
    if (this.passT <= 0) {
      this.passT = 9;
      let n = 0; for (const m of this.mobs) if (m.kind === "passive" && !MOBS[m.type].aq && Math.abs(cxOf(m) - p.x) < 80) n++;
      if (n < 6 && this.dayFactor() > 0.6) {
        const side = this.mrng() < 0.5 ? -1 : 1, x = Math.floor(p.x + side * (26 + this.mrng() * 24));
        if (x >= 3 && x < W - 3) {
          const gy = this.ground[x], t = this.tile(x, gy), w = HERD[this.biomeAt(x)] || {};
          const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0);
          if (tot && (t === B.GRASS || t === B.GRASS_SNOW) && this.tile(x, gy - 1) === B.AIR && gy <= SURF + 4) {
            let r = this.mrng() * tot, type = e[0][0]; for (const [k, v] of e) { r -= v; if (r < 0) { type = k; break; } }
            if (type !== "wolf") for (let i = 0; i < 2; i++) { const ix = clamp(x + i, 2, W - 3); if (this.ground[ix] === gy) { const m = this.spawnMob(type, ix + 0.1, gy); if (this._hit(m)) this.mobs.pop(); } }
          }
        }
      }
    }
  };

  // ---------- Fortschritte ----------
  P._advTick = function () {
    const has = id => this.count(id) > 0, p = this.player;
    if (!this.adv.wood && this.inv.some(st => st && hasTag(st.id, "logs"))) this.grant("wood");
    if (has("bench")) this.grant("bench");
    if (has("cobble")) this.grant("stone");
    if (has("furnace")) this.grant("furnace");
    if (has("iron_ingot")) this.grant("iron");
    if (this.armor.some(Boolean)) this.grant("armor");
    if (has("diamond")) this.grant("diamond");
    if (has("bucket") || has("water_bucket") || has("lava_bucket")) this.grant("bucket");
    if (has("lava_bucket")) this.grant("lava");
    if (p.y > SURF + 55 && !this.dim) this.grant("deep");
    if (has("blaze_rod")) this.grant("blaze");
    if (this.inv.some(st => st && st.id === "potion" && st.d > 11)) this.grant("brew");
  };

  // ---------- Speichern ----------
  P._mobsToData = function (list = this.mobs) {
    const p = this.player, keep = list.filter(m => m.boss || m.type === "end_crystal"), rest = list.filter(m => !(m.boss || m.type === "end_crystal"));
    const arr = keep.concat(rest.sort((a, b) => Math.abs(cxOf(a) - p.x) - Math.abs(cxOf(b) - p.x)).slice(0, 400));
    return arr.map(m => {
      const o = { t: m.type, x: +m.x.toFixed(2), y: +m.y.toFixed(3), hp: m.hp };
      if (m.tamed) { o.tm = 1; if (m.sit) o.st = 1; }
      if (m.sheared) o.sh = Math.round(m.shearT);
      if (m.shield) o.sd = 1;
      if (m.baby > 0) o.bb = Math.round(m.baby);
      if (m.fuse > 0 && m.type === "wither") o.fz = +m.fuse.toFixed(1);
      if (m.angry && (m.type === "piglin" || m.type === "zombie_piglin")) o.an = 1;
      if (m.var) o.vr = m.var;
      if (m.type === "turtle") { o.hm = Math.round(m.home); if (m.gravid) o.gv = 1; }
      if (m.mon !== undefined) o.mn = m.mon;
      if (m.trident) o.tr = 1;
      this._mobSaveX(m, o);
      return o;
    });
  };
  P._mobsFromData = function (arr) {
    this.mobs = [];
    for (const o of Array.isArray(arr) ? arr : []) {
      const d = MOBS[o && o.t]; if (!d || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
      const m = this.spawnMob(o.t, clamp(o.x, 0, W - d.w), 0);
      m.y = clamp(o.y, 0, H - d.h); m.hp = clamp(+o.hp || d.hp, 1, o.tm ? 20 : d.hp);
      if (o.tm) { m.tamed = true; m.sit = !!o.st; m.maxHp = o.t === "wolf" ? 20 : 10; }
      if (o.sh) { m.sheared = true; m.shearT = o.sh; }
      if (o.sd) m.shield = true;
      if (o.fz > 0) m.fuse = +o.fz;
      if (o.an) m.angry = true;
      if (o.vr > 0) m.var = o.vr | 0;
      if (Number.isFinite(o.hm)) m.home = o.hm;
      if (o.gv) m.gravid = true;
      if (Number.isFinite(o.mn)) m.mon = o.mn;
      if (o.tr) m.trident = true;
      this._mobLoadX(m, o);
      if (o.bb > 0) { m.baby = o.bb; m.w = d.w * 0.55; m.h = d.h * 0.55; m.y = clamp(o.y, 0, H - m.h); }
      if (this._hit(m)) {                                        // Rundung beim Speichern: ein Stück nach oben schieben
        const y0 = m.y; let ok = false;
        for (const up of [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2]) { m.y = y0 - up; if (!this._hit(m)) { ok = true; break; } }
        if (!ok) this.mobs.pop();
      }
    }
  };
}
