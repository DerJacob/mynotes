// =====================================================================
// Blockdorf – Illager 2.0, Totem und Überfälle der Stufen 1–5 (Etappe 13)
//   Magier (Evoker): hält Abstand, lässt Fangzähne in einer Reihe aus dem Boden schnappen und ruft drei Plagegeister; lässt ein Totem fallen
//   Plagegeist (Vex): fliegt durch Wände, stößt zu und löst sich nach 30–120 s auf (oder wenn der Magier fällt)
//   Zerstörer (Ravager): riesig, rennt an, schleudert den Spieler fort und brüllt (betäubt sich dabei); lässt einen Sattel fallen
//   Plünderer: tragen Armbrüste (lassen manchmal eine fallen); der Anführer lässt ein Unheilvolles Banner fallen
//   Totem der Unsterblichkeit: in einer Hand → statt zu sterben bleibt 1 Herz, dazu Regeneration und Feuerschutz
//   Überfälle: Omen-Stufe I–V (jeder weitere erlegte Anführer mit Omen erhöht die Stufe) → 3 bis 7 Wellen, stärkere Truppen,
//              Magier ab Welle 4, Zerstörer ab Welle 5, Belohnung steigt mit der Stufe
// Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS, COLORS } from "./sandbox-data.js?v=10";
import { MOBS, ADV } from "./sandbox-mobs.js?v=10";
import { EFFECT_NAMES } from "./sandbox-brew.js?v=10";

const E = "emerald";
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
const ILLAGERS = new Set(["evoker", "vex", "pillager", "vindicator", "illager_captain", "ravager", "witch"]);
export const ROMAN = ["I", "II", "III", "IV", "V"];
/** Muster des Unheilvollen Banners (Türkis mit Hellgrau, Grau, Schwarz) */
export const OMEN_BANNER = { c: COLORS.findIndex(c => c[0] === "cyan"), p: [[12, 8], [8, 7], [11, 15], [3, 7]] };

Object.assign(MOBS, {
  evoker: { name: "Magier", kind: "hostile", w: 0.7, h: 1.95, hp: 24, speed: 2.4, dmg: 6, range: 26, xp: [10, 10], drops: [["totem_of_undying", 1, 1, 1], ["emerald", 0, 1, 0.5]] },
  vex: { name: "Plagegeist", kind: "hostile", w: 0.5, h: 0.8, hp: 14, speed: 4.6, dmg: 4, range: 40, xp: [3, 3], drops: [] },
  ravager: { name: "Zerstörer", kind: "hostile", w: 2.2, h: 2.2, hp: 100, speed: 3.0, dmg: 12, range: 30, xp: [20, 20], drops: [["saddle", 1, 1, 1]] }
});
MOBS.illager_captain.drops = MOBS.illager_captain.drops.slice();
Object.assign(ADV, {
  evoker: ["Magierjäger", "Besiege einen Magier."],
  raid_big: ["Großer Überfall", "Wehre einen Überfall der Omen-Stufe III oder höher ab."],
  vex: ["Plagegeistplage", "Besiege einen Plagegeist."]
});

export function installIllagers13(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const cxOf = m => m.x + m.w / 2;
  const RAID_R = {};
  const rd = (m, d) => (m.raider ? RAID_R[m.type] || (RAID_R[m.type] = { ...MOBS[m.type], range: 80 }) : d);

  // ---------- Start ----------
  const prevInit = P._mobInitNew;
  P._mobInitNew = function (m, type) {
    prevInit.call(this, m, type);
    switch (type) {
      case "evoker": m.castCd = 3 + this.mrng() * 2; m.vexCd = 6; m.castT = 0; m.castKind = 0; break;
      case "vex": m.fly = true; m.life = 30 + this.mrng() * 90; m.owner = m.owner || null; m.charging = false; break;
      case "ravager": m.rvCd = 2; m.roarT = 0; m.stunT = 0; break;
    }
  };

  const prevAi = P._aiNew;
  P._aiNew = function (m, d, dt, dx, dy, dist) {
    switch (m.type) {
      case "evoker": this._aiEvoker(m, rd(m, d), dt, dx, dy, dist); return 1;
      case "vex": this._aiVex(m, d, dt, dx, dy, dist); return 2;
      case "ravager": this._aiRavager(m, rd(m, d), dt, dx, dy, dist); return 1;
    }
    return prevAi.call(this, m, d, dt, dx, dy, dist);
  };

  // ---------- Magier ----------
  P._aiEvoker = function (m, d, dt, dx, dy, dist) {
    if (m.glowT > 0) m.glowT -= dt;
    m.castCd -= dt; m.vexCd -= dt;
    if (m.castT > 0) {
      m.castT -= dt; m.face = sgn(dx) || m.face; this._steer(m, 0, 0, dt);
      if (m.castT <= 0) this._evokerCast(m);
      return;
    }
    if (dist < d.range) {
      const want = 7.5;
      let dir = 0;
      if (Math.abs(dx) > want + 3) dir = sgn(dx); else if (Math.abs(dx) < want - 3) dir = -sgn(dx);
      if (dir && m.onGround && this._cliffAhead(m, dir)) dir = 0;
      this._steer(m, dir, d.speed, dt);
      m.face = sgn(dx) || m.face;
      if (m.castCd <= 0 && Math.abs(dx) < 17 && Math.abs(dy) < 6) {
        const mine = this.mobs.filter(o => o.type === "vex" && o.owner === m && !o.dead).length;
        m.castKind = m.vexCd <= 0 && mine < 3 ? 1 : 0;
        m.castT = m.castKind ? 1.1 : 0.9;
        m.castCd = 3.4 + this.mrng() * 1.4;
        this.events.push({ t: "cast", x: cxOf(m), y: m.y, kind: m.castKind });
      }
    } else this._wander(m, d, dt, 0.8);
  };
  P._evokerCast = function (m) {
    const cx = cxOf(m);
    if (m.castKind === 1) {
      m.vexCd = 17;
      for (let i = -1; i <= 1; i++) {
        this.spawnMob("vex", cx + i * 1.2 - MOBS.vex.w / 2, m.y + 0.5, { owner: m });
      }
      return;
    }
    const p = this.player, dir = sgn(p.x + p.w / 2 - cx) || m.face || 1;
    const foot = Math.floor(m.y + m.h);
    for (let i = 0; i < 9; i++) {
      const x = cx + dir * (1.5 + i * 1.15), tx = Math.floor(x);
      if (tx < 1 || tx >= W - 1) break;
      let fy = -1;
      for (let y = foot - 3; y <= foot + 4; y++) if (BLOCKS[this.tile(tx, y)].solid && !BLOCKS[this.tile(tx, y - 1)].solid) { fy = y; break; }
      if (fy < 0) continue;
      this.proj.push({ kind: "fang", x, y: fy, vx: 0, vy: 0, dmg: 6, fromPlayer: false, age: 0, stuck: false, stuckT: 0, delay: 0.15 + i * 0.1, life: 0, rise: 0, hit: false, owner: m });
    }
    this.events.push({ t: "fangs", x: cx, y: m.y });
  };
  const prevSpecial = P._projSpecial;
  P._projSpecial = function (a, dt) {
    if (a.kind !== "fang") return prevSpecial.call(this, a, dt);
    if (a.delay > 0) { a.delay -= dt; a.rise = 0; return true; }
    a.life += dt; a.rise = Math.min(1, a.life / 0.18);
    if (!a.hit && a.life >= 0.15 && a.life < 0.6) {
      const box = { x: a.x - 0.55, y: a.y - 1.5, w: 1.1, h: 1.5 };
      const p = this.player;
      if (touching(box, p, 0)) { a.hit = true; this.hurt(6, sgn(p.x + p.w / 2 - a.x) || 1, "magic"); }
      for (const v of [...this.villagers]) if (!a.hit && touching(box, v, 0)) { a.hit = true; this._villagerHurt(v, 6, sgn(cxOf(v) - a.x), "fang"); }
      for (const m of [...this.mobs]) if (!a.hit && !m.dead && !ILLAGERS.has(m.type) && m.kind !== "object" && touching(box, m, 0)) { a.hit = true; this._mobHurt(m, 6, sgn(cxOf(m) - a.x), "fang"); }
    }
    if (a.life > 0.9) this._projRm(a);
    return true;
  };

  // ---------- Plagegeist ----------
  P._aiVex = function (m, d, dt, dx, dy, dist) {
    const o = m.owner;
    if (o && (o.dead || !this.mobs.includes(o))) { this._remove(m); return; }
    m.life -= dt;
    if (m.life <= 0) { m.drainT = (m.drainT || 0) - dt; if (m.drainT <= 0) { m.drainT = 1; this._mobHurt(m, 2, 0, "expire"); if (m.dead) return; } }
    const p = this.player;
    m.charging = dist < 12;
    let tx, ty;
    if (dist < 30) { tx = dx; ty = dy - 0.3; }
    else if (o) { tx = cxOf(o) - cxOf(m); ty = (o.y - 1) - m.y; }
    else { tx = 0; ty = 0; }
    const L = Math.max(0.5, Math.hypot(tx, ty)), sp = d.speed * (m.charging ? 1 : 0.7);
    const wob = Math.sin(m.life * 3 + m.id) * 1.2;
    const wx = tx / L * sp, wy = ty / L * sp + wob;
    const k = Math.min(1, dt * 6);
    m.vx += (wx - m.vx) * k; m.vy += (wy - m.vy) * k;
    m.x = clamp(m.x + m.vx * dt, 0, W - m.w); m.y = clamp(m.y + m.vy * dt, 2, H - 4);                 // fliegt durch Wände
    m.onGround = false; m.blocked = false;
    if (Math.abs(m.vx) > 0.3) m.face = sgn(m.vx);
    if (m.atkCd <= 0 && touching(m, p, 0.15)) { m.atkCd = 1; this.hurt(d.dmg, sgn(p.x + p.w / 2 - cxOf(m)) || 1, "mob"); }
  };

  // ---------- Zerstörer ----------
  P._aiRavager = function (m, d, dt, dx, dy, dist) {
    const p = this.player;
    m.rvCd -= dt; m.roarT = Math.max(0, m.roarT - dt);
    if (m.stunT > 0) { m.stunT -= dt; this._steer(m, 0, 0, dt); return; }
    if (this._villagerFight(m, d, dt, dist)) return;
    if (dist < d.range) {
      this._steer(m, Math.abs(dx) > 1.2 ? sgn(dx) : 0, d.speed, dt, 13);
      if (m.rvCd <= 0 && touching(m, p, 0.5) && Math.abs(dy) < 2.6) {
        m.rvCd = 2.2;
        const dir = sgn(p.x + p.w / 2 - cxOf(m)) || 1;
        this.hurt(d.dmg, dir, "mob");
        p.vx = dir * 13; p.vy = -7; p.onGround = false;
        this.events.push({ t: "ravager_hit", x: cxOf(m), y: m.y });
        if (this.mrng() < 0.35) { m.roarT = 1.3; m.stunT = 1.0; this.events.push({ t: "roar", x: cxOf(m), y: m.y }); }
      }
    } else this._wander(m, d, dt, 0.8);
  };

  // ---------- Beute und Omen ----------
  const prevDieNew = P._mobDieNew;
  P._mobDieNew = function (m, src) {
    const amp0 = this.fx && this.fx.bad_omen ? this.fx.bad_omen.amp : -1;
    prevDieNew.call(this, m, src);
    const byPlayer = src === "player" || src === "arrow";
    if (m.type === "illager_captain") {
      if (byPlayer) {
        const st = this.newStack("banner_cyan", 1); st.bp = { c: OMEN_BANNER.c, p: OMEN_BANNER.p.map(q => q.slice()) };
        this.dropStack(st, cxOf(m), m.y + m.h / 2, true);
      }
      // ein Omen und noch ein Anführer: die Stufe steigt (bis V)
      if (!m.raider && byPlayer && amp0 >= 0) {
        this.fx.bad_omen = { t: 3000, amp: Math.min(4, amp0 + 1) };
        this.events.push({ t: "omen_up", lvl: this.fx.bad_omen.amp + 1 });
      }
    }
    if (byPlayer) {
      if (m.type === "evoker") this.grant("evoker");
      if (m.type === "vex") this.grant("vex");
    }
  };
  Object.assign(EFFECT_NAMES, { bad_omen: "Unheilvolles Omen" });

  // ---------- Totem der Unsterblichkeit ----------
  const baseHurt = P.hurt;
  P.hurt = function (n, dir, why) { this._hurtWhy = why; return baseHurt.call(this, n, dir, why); };
  const baseDie = P._die;
  P._die = function () {
    if (this._hurtWhy !== "void" && this._totemPop()) return;
    return baseDie.call(this);
  };
  P._totemPop = function () {
    const p = this.player, s = this.selStack(), o = this.offh && this.offh[0];
    if (s && s.id === "totem_of_undying") this._consumeSel();
    else if (o && o.id === "totem_of_undying") { o.n--; if (o.n <= 0) this.offh[0] = null; }
    else return false;
    p.hp = 1; p.invuln = 2; p.burn = 0; p.air = 15;
    this.fx = {}; this.fxT = this.fxT || {};
    this.addEffect("regen", 45, 1); this.addEffect("fire_resistance", 40, 0);
    this.events.push({ t: "totem", x: p.x + p.w / 2, y: p.y + p.h / 2 });
    this.grant("totem");
    return true;
  };

  // ---------- Überfälle: Stufe, Wellen, Truppen ----------
  P.raidInfo = function () {
    const r = this.raid; if (!r) return null;
    const left = r.foes.filter(m => !m.dead).length;
    return { wave: Math.max(1, r.wave), waves: r.waves, left, total: Math.max(r.total, left), state: r.state, x: r.vx, lvl: r.lvl };
  };
  P._raidStart = function (v) {
    const lvl = clamp((this.fx.bad_omen ? this.fx.bad_omen.amp : 0) + 1, 1, 5);
    this.raid = { vx: v.x, vy: v.y, wave: 0, waves: Math.min(7, 2 + lvl), lvl, foes: [], delay: 6, away: 0, state: "wait", total: 0 };
    delete this.fx.bad_omen;
    this.events.push({ t: "raid", s: "start", x: v.x, lvl });
    const bell = this._bellNear(v.x);
    if (bell) this.events.push({ t: "bell", x: bell.x + 0.5, y: bell.y + 0.5 });
    for (const vv of this.villagers) if (Math.abs(vv.x - v.x) < 40) {
      vv.say = bell ? "Die Glocke! Alle in Deckung!" : "Plünderer! Hilfe!"; vv.sayT = 5;
      if (bell) { vv.fleeT = 14; vv.hide = true; }
    }
  };
  /** [Art, Anzahl] der Welle k bei Stufe lvl (Wellen 1–3 wie früher, danach stärker) */
  P._raidWave = function (k, lvl, last) {
    const counts = [["pillager", Math.min(7, 1 + k + (lvl >= 4 ? 1 : 0))], ["vindicator", Math.min(5, k)]];
    if (k >= 2) counts.push(["witch", Math.min(3, k - 1)]);
    if (k >= 4) counts.push(["evoker", k >= 7 ? 2 : 1]);
    if (k >= 5) counts.push(["ravager", k >= 7 ? 2 : 1]);
    if (last) counts.push(["illager_captain", 1]);
    return counts;
  };
  P._raidSpawn = function () {
    const r = this.raid, k = r.wave, W2 = this.ground;
    const counts = this._raidWave(k, r.lvl || 1, k === r.waves);
    r.foes = [];
    let side = this.mrng() < 0.5 ? -1 : 1;
    for (const [type, n] of counts) for (let i = 0; i < n; i++) {
      side = -side;
      const x = clamp(Math.floor(r.vx + side * (18 + this.mrng() * 10)), 3, W - 4);
      const gy = W2[x] || r.vy;
      const yy = this._findSpawnY(x, Math.max(3, gy - 10), Math.min(H - 6, gy + 6), Math.ceil(MOBS[type].h));
      const m = this.spawnMob(type, x + 0.5 - MOBS[type].w / 2, yy >= 0 ? yy : gy, { raider: true, angry: true });
      if (this._hit(m)) { this._remove(m); continue; }
      r.foes.push(m);
    }
    r.total = r.foes.length; r.state = "fight";
    this.events.push({ t: "raid", s: "wave", wave: k, lvl: r.lvl });
  };
  P._raidEnd = function (win) {
    const r = this.raid; if (!r) return;
    for (const m of r.foes) if (!m.dead) this._remove(m);
    this.raid = null;
    const L = r.lvl || 1;
    if (win) {
      this.addEffect("hero_village", 1200 + 300 * (L - 1), 0);
      this.grant("hero");
      if (L >= 3) this.grant("raid_big");
      this.addXp(30 + 10 * L);
      this.add(E, 3 + 2 * L, 0, true);
      for (const v of this.villagers) if (Math.abs(v.x - r.vx) < 40) { v.say = "Danke, Held!"; v.sayT = 5; v.fleeT = 0; v.hide = false; }
    } else for (const v of this.villagers) v.hide = false;
    this.events.push({ t: "raid", s: win ? "win" : "lose", lvl: L });
  };
  // Verloren, wenn im Dorf kein Dorfbewohner mehr lebt; Wächter der Herrenhäuser bekommen Magier
  const prevTick = P._villTick;
  P._villTick = function () {
    const r0 = this.raid;
    prevTick.call(this);
    if (this.dim) return;
    const r = this.raid;
    if (r && r === r0 && r.state !== "wait" && !this.villagers.some(q => Math.abs(q.x - r.vx) < 40)) this._raidEnd(false);
    const p = this.player, px = p.x + p.w / 2;
    for (const s of this.structs || []) {
      if (s.kind !== "mansion" || !s.g || s.e || Math.abs(s.x - px) > 40 || Math.abs(s.y - p.y) > 26) continue;
      s.e = 1;
      let n = 0;
      for (const dx of [-9, 6, -5, 9, 0, -12]) {
        if (n >= 2) break;
        const m = this.spawnMob("evoker", s.x + dx + 0.5 - MOBS.evoker.w / 2, s.y, {});
        if (this._hit(m)) this._remove(m); else n++;
      }
    }
  };
}
