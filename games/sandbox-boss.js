// =====================================================================
// Blockdorf – Bewohner des Nethers und des Endes, Bosse, Leuchtfeuer-Umwelt (Etappe 5)
//   Nether:  Piglin (tauscht Gold, wird wütend ohne Goldrüstung), Zombie-Piglin, Ghast (Feuerbälle, zurückschlagbar),
//            Lohe (Feuersalven, Spawner in Festungen), Wither-Skelett, Magmawürfel
//   Ende:    Enderdrache (kreist, stürzt herab, heilt sich an Kristallen), Endkristall (explodiert), Enderman
//   Wither:  aus Seelensand + 3 Schädeln beschwören, Explosion, schießt Schädel, zerstört Blöcke
//   Spieler: Seelensand bremst, Magmablock brennt, Leere im Ende, Elytren (Gleiten), Enderperle
// Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS } from "./sandbox-data.js?v=8";
import { MOBS, ADV } from "./sandbox-mobs.js?v=8";
import { END_CX, END_TOP } from "./sandbox-nether.js?v=8";
import { NH } from "./sandbox-const.js?v=8";

Object.assign(MOBS, {
  piglin: { name: "Piglin", kind: "neutral", w: 0.7, h: 1.8, hp: 16, speed: 2.9, dmg: 4, range: 14, xp: [5, 5], drops: [["gold_nugget", 0, 2, 0.4]] },
  zombie_piglin: { name: "Zombie-Piglin", kind: "neutral", w: 0.7, h: 1.8, hp: 20, speed: 2.7, dmg: 5, range: 18, xp: [5, 5], drops: [["rotten_flesh", 0, 1, 1], ["gold_nugget", 0, 1, 0.5], ["gold_ingot", 1, 1, 0.025]] },
  ghast: { name: "Ghast", kind: "hostile", w: 3.4, h: 3.4, hp: 10, speed: 2.4, dmg: 4, range: 42, xp: [5, 5], drops: [["ghast_tear", 0, 1, 0.55], ["gunpowder", 0, 2, 1]] },
  blaze: { name: "Lohe", kind: "hostile", w: 0.7, h: 1.8, hp: 20, speed: 3.0, dmg: 5, range: 32, xp: [10, 10], drops: [["blaze_rod", 0, 1, 1]] },
  wither_skeleton: { name: "Wither-Skelett", kind: "hostile", w: 0.7, h: 2.4, hp: 20, speed: 2.6, dmg: 7, range: 22, xp: [5, 5], drops: [["coal", 0, 1, 0.33], ["bone", 0, 2, 1], ["wither_skeleton_skull", 1, 1, 0.06]] },
  magma_cube: { name: "Magmawürfel", kind: "hostile", w: 1.0, h: 0.8, hp: 12, speed: 2, dmg: 4, range: 20, xp: [4, 4], drops: [["magma_cream", 0, 1, 0.4]] },
  ender_dragon: { name: "Enderdrache", kind: "hostile", boss: true, w: 6, h: 3, hp: 200, speed: 14, dmg: 6, range: 90, xp: [3000, 3000], drops: [] },
  end_crystal: { name: "Endkristall", kind: "object", w: 1.4, h: 1.4, hp: 1, speed: 0, xp: [0, 0], drops: [] },
  wither: { name: "Wither", kind: "hostile", boss: true, w: 2.2, h: 3, hp: 300, speed: 6, dmg: 8, range: 60, xp: [50, 50], drops: [["nether_star", 1, 1, 1]] }
});
Object.assign(ADV, {
  nether: ["Wir müssen tiefer gehen", "Betritt den Nether durch ein Portal."],
  blaze: ["In die Flammen", "Besorge eine Lohenrute."],
  barter: ["Goldrausch", "Tausche Gold mit einem Piglin."],
  ghast_return: ["Zurück zum Absender", "Schlag einen Feuerball zurück und besiege damit einen Ghast."],
  eye: ["Auge um Auge", "Wirf ein Auge des Enders."],
  endportal: ["Das Ende?", "Öffne ein Endportal in der Festung."],
  end: ["Das Ende.", "Betritt das Ende."],
  dragon: ["Der Drache ist tot", "Besiege den Enderdrachen."],
  wither: ["Die Verwelkung", "Beschwöre den Wither und besiege ihn."],
  beacon: ["Ein Leuchtfeuer im Dunkeln", "Aktiviere ein Leuchtfeuer."],
  elytra: ["Himmel und Hölle", "Lege Elytren an."]
});

const FIREPROOF = new Set(["zombie_piglin", "piglin", "ghast", "blaze", "wither_skeleton", "magma_cube", "ender_dragon", "wither", "end_crystal"]);
const BARTER = [["ender_pearl", 1, 3, 12], ["gravel", 4, 8, 20], ["leather", 2, 4, 10], ["quartz", 3, 6, 12], ["glowstone_dust", 3, 6, 12], ["soul_sand", 4, 8, 14], ["obsidian", 1, 1, 8], ["string", 3, 6, 10], ["nether_brick", 2, 6, 10], ["iron_ingot", 1, 3, 8], ["magma_cream", 1, 2, 6]];
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const isFireproof = type => FIREPROOF.has(type);

export function installBoss(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1) => ({ id, n, d: 0 });
  const cxOf = m => m.x + m.w / 2;
  const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

  // ---------- Erzeugen ----------
  P._mobInitNew = function (m, type) {
    const r = this.mrng;
    switch (type) {
      case "piglin": m.barterT = 0; break;
      case "magma_cube": m.hopT = 0.5 + r(); break;
      case "ghast": m.fly = true; m.fireCd = 3 + r() * 2; m.wind = 0; m.moveT = 0; m.tvx = 0; m.tvy = 0; break;
      case "blaze": m.fly = true; m.fireCd = 2 + r(); m.burst = 0; m.burstT = 0; m.moveT = 0; m.tvx = 0; m.tvy = 0; break;
      case "ender_dragon": m.boss = true; m.fly = true; m.ph = "circle"; m.phT = 7 + r() * 4; m.ang = r() * 6.28; m.fireCd = 6; m.healT = 0.5; break;
      case "wither": m.boss = true; m.fly = true; m.fireCd = 2; m.regT = 1; m.brkT = 0.4; m.side = 1; m.sideT = 4; if (m.fuse === undefined) m.fuse = 0; break;
      case "end_crystal": m.noBody = true; break;
    }
  };
  /** Schaden anpassen (Immunitäten, Wut, Panzerung); 0 = kein Schaden */
  P._mobHurtMod = function (m, dmg, dir, src) {
    if ((src === "fire" || src === "lava") && FIREPROOF.has(m.type)) return 0;
    if (m.type === "wither") { if (m.fuse > 0) return 0; if (m.hp <= m.maxHp / 2 && src === "arrow") return 0; }
    if (m.type === "end_crystal") return Math.max(1, dmg);
    if (m.type === "piglin" || m.type === "zombie_piglin") {
      if (src === "player" || src === "arrow") {
        m.angry = true;
        for (const o of this.mobs) if (o !== m && (o.type === "zombie_piglin" || o.type === "piglin") && Math.abs(cxOf(o) - cxOf(m)) < 14) o.angry = true;
      }
    }
    return dmg;
  };
  P._mobDieNew = function (m, src) {
    const cx = cxOf(m), cy = m.y + m.h / 2;
    if (m.type === "end_crystal") this.explode(cx, cy, 4, { k: 0.45 });
    else if (m.type === "ender_dragon") this._dragonDead();
    else if (m.type === "wither") this.grant("wither");
    else if (m.type === "ghast" && m.deflected) this.grant("ghast_return");
  };
  /** Rechtsklick auf Piglin mit Goldbarren: tauschen */
  P._mobUseNew = function (m, s) {
    if (m.type === "piglin" && s && s.id === "gold_ingot" && !(m.barterT > 0) && !m.angry) {
      this._consumeSel(); m.barterT = 2.5; m.face = sgn(this.player.x - m.x) || m.face;
      this.events.push({ t: "barter_start", x: cxOf(m), y: m.y });
      return true;
    }
    return false;
  };
  P._barterGive = function (m) {
    const tot = BARTER.reduce((a, b) => a + b[3], 0);
    let r = this.mrng() * tot, pick = BARTER[0];
    for (const b of BARTER) { r -= b[3]; if (r < 0) { pick = b; break; } }
    const n = pick[1] + Math.floor(this.mrng() * (pick[2] - pick[1] + 1));
    this.dropStack(stk(pick[0], n), cxOf(m), m.y + m.h * 0.4, false, sgn(this.player.x - m.x) || 1);
    this.grant("barter");
    this.events.push({ t: "barter", x: cxOf(m), y: m.y });
  };

  // ---------- Fliegen ----------
  P._flyBody = function (m, dt) {
    m.blocked = false;
    this._moveX(m, m.vx * dt);
    this._moveY(m, m.vy * dt);
    m.onGround = false;
  };
  const approach = (m, tvx, tvy, a, dt) => {
    m.vx += clamp(tvx - m.vx, -a * dt, a * dt);
    m.vy += clamp(tvy - m.vy, -a * dt, a * dt);
  };

  // ---------- KI ----------
  /** 0 = kein neues Wesen · 1 = KI erledigt, Körper (Schwerkraft) läuft weiter · 2 = alles erledigt */
  P._aiNew = function (m, d, dt, dx, dy, dist) {
    switch (m.type) {
      case "piglin": this._aiPiglin(m, d, dt, dx, dy, dist); return 1;
      case "zombie_piglin": this._aiZPiglin(m, d, dt, dx, dy, dist); return 1;
      case "wither_skeleton": this._aiMelee(m, d, dt, dx, dy, dist, 11); return 1;
      case "magma_cube": this._aiSlime(m, d, dt, dx, dy, dist); return 1;
      case "ghast": this._aiGhast(m, d, dt, dx, dy, dist); return 2;
      case "blaze": this._aiBlaze(m, d, dt, dx, dy, dist); return 2;
      case "ender_dragon": this._aiDragon(m, d, dt, dx, dy, dist); return 2;
      case "wither": this._aiWither(m, d, dt, dx, dy, dist); return 2;
      case "end_crystal": return 2;
    }
    return 0;
  };
  P._aiPiglin = function (m, d, dt, dx, dy, dist) {
    const p = this.player;
    if (m.barterT > 0) {
      m.barterT -= dt; this._steer(m, 0, 0, dt);
      if (m.barterT <= 0) this._barterGive(m);
      return;
    }
    // Goldbarren auf dem Boden aufheben
    for (const dr of this.drops) {
      if (dr.id === "gold_ingot" && Math.abs(dr.x - cxOf(m)) < 2.5 && Math.abs(dr.y - (m.y + m.h * 0.6)) < 2) {
        dr.n--; if (dr.n <= 0) this.drops.splice(this.drops.indexOf(dr), 1);
        m.barterT = 2.5; m.face = sgn(dr.x - cxOf(m)) || m.face;
        return;
      }
    }
    const gold = this.armor.some(a => a && ITEMS[a.id].mat === "gold");
    const hostile = m.angry || (!gold && dist < d.range && this._los(cxOf(m), m.y + 0.4, p.x + p.w / 2, p.y + 0.7));
    if (hostile) {
      if (dist > 34) m.angry = false;
      this._steer(m, Math.abs(dx) > 0.5 ? sgn(dx) : 0, d.speed, dt, 11);
      this._touch(m, d, dt);
    } else this._wander(m, d, dt, 0.8);
  };
  P._aiZPiglin = function (m, d, dt, dx, dy, dist) {
    if (m.angry) {
      if (dist > 34) m.angry = false;
      this._steer(m, Math.abs(dx) > 0.5 ? sgn(dx) : 0, d.speed * 1.2, dt, 11);
      this._touch(m, d, dt);
    } else this._wander(m, d, dt, 0.8);
  };
  P._aiGhast = function (m, d, dt, dx, dy, dist) {
    const p = this.player, cx = cxOf(m), cy = m.y + m.h / 2;
    const aware = dist < d.range && this._los(cx, cy, p.x + p.w / 2, p.y + 0.7);
    m.moveT -= dt;
    let tvx, tvy;
    if (aware) {
      const ax = Math.abs(dx);
      tvx = ax > 18 ? sgn(dx) * d.speed : ax < 11 ? -sgn(dx) * d.speed : Math.sin(this._clock * 1.5 + m.id) * 0.8;
      tvy = clamp((p.y - 3 - cy) * 0.6, -d.speed, d.speed);
      m.face = sgn(dx) || m.face;
      m.fireCd -= dt;
      if (m.wind > 0) {
        m.wind -= dt;
        if (m.wind <= 0) {
          m.fireCd = 3.2 + this.mrng() * 1.6;
          const L = Math.max(0.5, Math.hypot(dx, p.y + 0.7 - cy)), sp = 8;
          this.proj.push({ kind: "fireball", x: cx + sgn(dx) * 1.2, y: cy, vx: (p.x + p.w / 2 - cx) / L * sp, vy: (p.y + 0.7 - cy) / L * sp, fromPlayer: false, owner: m, age: 0, stuck: false, stuckT: 0, dmg: 6 });
          this.events.push({ t: "ghast_shoot", x: cx, y: cy });
        }
      } else if (m.fireCd <= 0) { m.wind = 0.8; this.events.push({ t: "ghast_charge", x: cx, y: cy }); }
    } else {
      m.wind = 0;
      if (m.moveT <= 0) { m.moveT = 2 + this.mrng() * 3; m.tvx = (this.mrng() - 0.5) * d.speed; m.tvy = (this.mrng() - 0.5) * d.speed * 0.6; }
      if (m.blocked) { m.tvx = -m.tvx; m.tvy = -m.tvy; }
      tvx = m.tvx; tvy = m.tvy;
    }
    if (m.blocked && aware) tvy = -Math.abs(tvy) - 1;
    approach(m, tvx, tvy, 4, dt);
    this._flyBody(m, dt);
  };
  P._aiBlaze = function (m, d, dt, dx, dy, dist) {
    const p = this.player, cx = cxOf(m), cy = m.y + m.h / 2;
    const aware = dist < d.range && this._los(cx, cy, p.x + p.w / 2, p.y + 0.7);
    m.moveT -= dt;
    let tvx, tvy;
    if (aware) {
      const ax = Math.abs(dx);
      tvx = ax > 9 ? sgn(dx) * d.speed : ax < 4.5 ? -sgn(dx) * d.speed : 0;
      tvy = clamp((p.y - 1.8 + Math.sin(this._clock * 2.5 + m.id) * 1.2 - cy) * 0.8, -d.speed, d.speed);
      m.face = sgn(dx) || m.face;
      m.fireCd -= dt;
      if (m.fireCd <= 0 && m.burst <= 0) { m.burst = 3; m.burstT = 0; m.fireCd = 3.6 + this.mrng(); }
      if (m.burst > 0) {
        m.burstT -= dt;
        if (m.burstT <= 0) {
          m.burstT = 0.32; m.burst--;
          const L = Math.max(0.5, Math.hypot(dx, p.y + 0.7 - cy)), sp = 13;
          this.proj.push({ kind: "firebolt", x: cx, y: cy, vx: (p.x + p.w / 2 - cx) / L * sp, vy: (p.y + 0.7 - cy) / L * sp, fromPlayer: false, owner: m, age: 0, stuck: false, stuckT: 0, dmg: 5 });
          this.events.push({ t: "blaze_shoot", x: cx, y: cy });
        }
      }
    } else {
      if (m.moveT <= 0) { m.moveT = 1.5 + this.mrng() * 2.5; m.tvx = (this.mrng() - 0.5) * d.speed; m.tvy = (this.mrng() - 0.5) * d.speed * 0.7; }
      if (m.blocked) { m.tvx = -m.tvx; m.tvy = -m.tvy; }
      tvx = m.tvx; tvy = m.tvy;
    }
    approach(m, tvx, tvy, 7, dt);
    this._flyBody(m, dt);
    this._touch(m, d, dt);
  };
  P._aiDragon = function (m, d, dt, dx, dy, dist) {
    const p = this.player, cx = cxOf(m), cy = m.y + m.h / 2, px = p.x + p.w / 2, py = p.y + p.h / 2;
    m.phT -= dt; m.fireCd -= dt;
    m.healT -= dt;
    if (m.healT <= 0) {
      m.healT = 0.5;
      if (m.hp < m.maxHp && this.mobs.some(o => o.type === "end_crystal" && Math.abs(cxOf(o) - cx) < 48)) { m.hp = Math.min(m.maxHp, m.hp + 1); m.healing = 1; } else m.healing = 0;
    }
    let tx, ty, sp;
    if (m.ph === "dive") {
      tx = px; ty = py - 0.5; sp = 17;
      if (m.phT <= 0 || Math.hypot(tx - cx, ty - cy) < 2) { m.ph = "circle"; m.phT = 8 + this.mrng() * 5; }
    } else {
      m.ang += dt * 0.5;
      tx = END_CX + Math.cos(m.ang) * 38; ty = END_TOP - 36 + Math.sin(m.ang * 1.7) * 10; sp = d.speed;
      if (m.phT <= 0 && Math.abs(px - END_CX) < 70) { m.ph = "dive"; m.phT = 3.6; this.events.push({ t: "dragon_dive", x: cx, y: cy }); }
      if (m.fireCd <= 0 && dist < 55 && this._los(cx, cy, px, py)) {
        m.fireCd = 6 + this.mrng() * 3;
        const L = Math.max(0.5, Math.hypot(px - cx, py - cy)), s2 = 9;
        this.proj.push({ kind: "fireball", x: cx, y: cy + 1, vx: (px - cx) / L * s2, vy: (py - cy) / L * s2, fromPlayer: false, owner: m, age: 0, stuck: false, stuckT: 0, dmg: 6, big: true });
        this.events.push({ t: "ghast_shoot", x: cx, y: cy });
      }
    }
    const L = Math.max(0.1, Math.hypot(tx - cx, ty - cy));
    approach(m, (tx - cx) / L * sp, (ty - cy) / L * sp, 20, dt);
    m.x = clamp(m.x + m.vx * dt, 2, W - m.w - 2); m.y = clamp(m.y + m.vy * dt, 3, END_TOP + 8);
    m.face = sgn(m.vx) || m.face; m.onGround = false;
    if (m.atkCd <= 0 && touching(m, p, 0.05)) { m.atkCd = 1.2; this.hurt(d.dmg, sgn(px - cx) || 1, "mob"); }
  };
  P._aiWither = function (m, d, dt, dx, dy, dist) {
    const p = this.player, cx = cxOf(m), cy = m.y + m.h / 2, px = p.x + p.w / 2, py = p.y + p.h / 2;
    if (m.fuse > 0) {
      m.fuse -= dt; m.vx = m.vy = 0;
      if (m.fuse <= 0) {
        m.fuse = 0;
        this.explode(cx, cy, 6, { k: 0.7 });
        this.events.push({ t: "wither_awake", x: cx, y: cy });
      }
      return;
    }
    m.regT -= dt; if (m.regT <= 0) { m.regT = 1; m.hp = Math.min(m.maxHp, m.hp + 1); }
    m.sideT -= dt; if (m.sideT <= 0) { m.sideT = 3 + this.mrng() * 3; m.side = -m.side; }
    const tx = px + m.side * 7, ty = py - 4.5;
    approach(m, clamp((tx - cx) * 1.2, -d.speed, d.speed), clamp((ty - cy) * 1.2, -d.speed, d.speed), 12, dt);
    m.x = clamp(m.x + m.vx * dt, 1, W - m.w - 1); m.y = clamp(m.y + m.vy * dt, 3, H - m.h - 4);
    m.face = sgn(dx) || m.face; m.onGround = false;
    m.fireCd -= dt;
    if (m.fireCd <= 0 && dist < d.range) {
      m.fireCd = m.hp <= m.maxHp / 2 ? 1.3 : 2.2;
      const L = Math.max(0.5, Math.hypot(px - cx, py - cy)), sp = 12;
      this.proj.push({ kind: "skull", x: cx, y: cy, vx: (px - cx) / L * sp, vy: (py - cy) / L * sp, fromPlayer: false, owner: m, age: 0, stuck: false, stuckT: 0, dmg: 6 });
      this.events.push({ t: "ghast_shoot", x: cx, y: cy });
    }
    m.brkT -= dt;
    if (m.brkT <= 0) {                                              // Blöcke im Weg zerstören
      m.brkT = 0.4;
      for (let y = Math.floor(m.y) - 1; y <= Math.floor(m.y + m.h) + 1; y++) for (let x = Math.floor(m.x) - 1; x <= Math.floor(m.x + m.w) + 1; x++) {
        const id = this.tile(x, y);
        if (id === B.AIR || BLOCKS[id].hard === Infinity || id === B.OBSIDIAN || id === B.BEDROCK || y < 3 || y >= H - 4) continue;
        if (BLOCKS[id].solid || BLOCKS[id].interact) { this._noDrops = this.mrng() > 0.15; this._break(x, y, false); this._noDrops = false; }
      }
    }
    if (m.atkCd <= 0 && touching(m, p, 0.05)) { m.atkCd = 1.2; this.hurt(d.dmg, sgn(px - cx) || 1, "mob"); this.addEffect("wither", 8, 0); }
  };

  // ---------- Wither beschwören ----------
  /** Nach dem Setzen eines Schädels bei (x, y): T aus Seelensand (3 oben, 1 darunter) mit drei Schädeln */
  P._witherCheck = function (x, y) {
    const sy = y + 1;                                                // Seelensand-Reihe unter den Schädeln
    for (let cx = x - 1; cx <= x + 1; cx++) {
      let ok = this.tile(cx, sy + 1) === B.SOUL_SAND;
      for (let dx = -1; dx <= 1 && ok; dx++) if (this.tile(cx + dx, y) !== B.SKULL || this.tile(cx + dx, sy) !== B.SOUL_SAND) ok = false;
      if (!ok) continue;
      for (let dx = -1; dx <= 1; dx++) { this.setTile(cx + dx, y, B.AIR); this.setTile(cx + dx, sy, B.AIR); }
      this.setTile(cx, sy + 1, B.AIR);
      const d = MOBS.wither;
      this.spawnMob("wither", cx + 0.5 - d.w / 2, sy + 1.0, { fuse: 7 });
      this.events.push({ t: "wither_summon", x: cx, y: sy });
      return true;
    }
    return false;
  };

  // ---------- Geschosse ----------
  P._projRm = function (a) { const i = this.proj.indexOf(a); if (i >= 0) this.proj.splice(i, 1); };
  const SPECIAL = new Set(["fireball", "firebolt", "skull", "pearl"]);
  /** true = dieses Geschoss gehört mir (und ist erledigt oder fliegt weiter) */
  P._projSpecial = function (a, dt) {
    if (!SPECIAL.has(a.kind)) return false;
    const p = this.player;
    a.age += dt;
    if (a.age > 14 || a.x < 0 || a.x >= W || a.y < -4 || a.y > H + 4) { this._projRm(a); return true; }
    const g = a.kind === "pearl" ? 20 : 0;
    const sp = Math.hypot(a.vx, a.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.25)), sdt = dt / steps;
    for (let k = 0; k < steps; k++) {
      a.px = a.x; a.py = a.y;
      a.vy += g * sdt; a.x += a.vx * sdt; a.y += a.vy * sdt;
      if (a.x < 0 || a.x >= W) { this._projRm(a); return true; }
      const tid = this.tile(Math.floor(a.x), Math.floor(a.y));
      if (BLOCKS[tid].solid) { this._projBurst(a, null); this._projRm(a); return true; }
      if (!a.fromPlayer && a.kind !== "pearl") {
        if (a.x > p.x - 0.25 && a.x < p.x + p.w + 0.25 && a.y > p.y - 0.25 && a.y < p.y + p.h + 0.25) { this._projBurst(a, p); this._projRm(a); return true; }
      }
      if (a.fromPlayer && a.kind !== "pearl") {
        for (const m of this.mobs) if (a.x > m.x - 0.2 && a.x < m.x + m.w + 0.2 && a.y > m.y - 0.2 && a.y < m.y + m.h + 0.2 && m !== a.shooter) {
          this._projBurst(a, m); this._projRm(a); return true;
        }
      }
    }
    return true;
  };
  P._projBurst = function (a, hit) {
    const p = this.player;
    if (a.kind === "pearl") {
      const x = a.px ?? a.x, y = a.py ?? a.y;
      p.x = clamp(x - p.w / 2, 0, W - p.w); p.y = clamp(y - p.h / 2, 0, H - p.h); p.vx = p.vy = 0;
      if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; }
      this.events.push({ t: "tp", x: p.x, y: p.y, self: true });
      this.hurt(5, 0, "fall");
      return;
    }
    if (a.kind === "fireball") {
      const big = a.big ? 2.5 : 2;
      if (a.fromPlayer) {
        if (hit && hit !== p) {
          if (a.owner === hit) hit.deflected = true;
          this._mobHurt(hit, a.owner === hit ? 100 : 14, sgn(a.vx), "player");
        }
        this.explode(a.x, a.y, big, { k: 0.3, noPlayer: true });
      } else this.explode(a.x, a.y, big, { k: a.big ? 0.4 : 0.3 });
      return;
    }
    if (a.kind === "firebolt") {
      if (hit === p) { this.hurt(a.dmg, sgn(a.vx), "mob"); if (!(this.fx && this.fx.fire_resistance)) p.burn = Math.max(p.burn || 0, 3); }
      else this.events.push({ t: "smoke", x: a.x, y: a.y });
      return;
    }
    if (a.kind === "skull") {
      if (hit === p) { this.hurt(a.dmg, sgn(a.vx), "mob"); this.addEffect("wither", 10, 0); }
      this.explode(a.x, a.y, 2, { k: 0.35 });
    }
  };
  /** Angriff mit der Hand auf einen Feuerball: zurückschlagen */
  P._projAttack = function (mx, my) {
    const p = this.player;
    for (const a of this.proj) {
      if (a.kind !== "fireball" || a.fromPlayer) continue;
      if (Math.hypot(a.x - mx, a.y - my) > 1.6 || Math.hypot(a.x - (p.x + p.w / 2), a.y - (p.y + p.h / 2)) > 6) continue;
      const o = a.owner && !a.owner.dead ? a.owner : null;
      let dx = o ? cxOf(o) - a.x : -a.vx, dy = o ? o.y + o.h / 2 - a.y : -a.vy;
      const L = Math.max(0.1, Math.hypot(dx, dy)), sp = Math.max(9, Math.hypot(a.vx, a.vy) * 1.4);
      a.vx = dx / L * sp; a.vy = dy / L * sp; a.fromPlayer = true; a.age = 0;
      p.atkCd = 0.4;
      this.events.push({ t: "hit", x: a.x, y: a.y, n: 0, src: "player" });
      return true;
    }
    return false;
  };

  // ---------- Spawnen in den Dimensionen ----------
  P._mobSpawnDim = function (dt) {
    const p = this.player, nether = this.dim === 1;
    this.spawnT -= dt;
    this.spawnerT = (this.spawnerT === undefined ? 2 : this.spawnerT) - dt;
    if (nether && this.spawnerT <= 0) { this.spawnerT = 2; this._spawnerStep(); }
    if (this.spawnT > 0) return;
    this.spawnT = 1.6;
    const near = this.hostilesNear(p.x, 70) + this.mobs.filter(m => m.kind === "neutral" && Math.abs(cxOf(m) - p.x) < 70).length;
    if (near >= (nether ? 14 : 9)) return;
    const side = this.mrng() < 0.5 ? -1 : 1, x = Math.floor(p.x + side * (13 + this.mrng() * 20));
    if (x < 3 || x >= W - 3) return;
    if (nether && this.mrng() < 0.18 && this.mobs.filter(m => m.type === "ghast").length < 7) {
      const gx = Math.floor(p.x + side * (22 + this.mrng() * 22)), gy = clamp(Math.floor(p.y - 14 + this.mrng() * 18), 22, 130);
      if (gx > 6 && gx < W - 6 && this._roomFor(gx, gy, 4, 4)) this.spawnMob("ghast", gx - 1.7 + 0.5, gy + 3.6);
      return;
    }
    const y0 = Math.max(3, Math.floor(p.y) - 14), y1 = Math.min(H - 6, Math.floor(p.y) + 16);
    const fy = this._findSpawnY(x, y0, y1, nether ? 2 : 3);
    if (fy <= 0) return;
    const on = this.tile(x, fy);
    let wts;
    if (nether) wts = { zombie_piglin: 30, piglin: 12, magma_cube: on === B.NETHERRACK ? 10 : 0, wither_skeleton: on === B.NETHER_BRICK ? 45 : 0 };
    else wts = on === B.END_STONE ? { enderman: 1 } : {};
    const e = Object.entries(wts).filter(([, v]) => v > 0), tot = e.reduce((a, [, v]) => a + v, 0);
    if (!tot) return;
    let r = this.mrng() * tot, type = e[0][0]; for (const [k, v] of e) { r -= v; if (r < 0) { type = k; break; } }
    const m = this.spawnMob(type, x + 0.5 - MOBS[type].w / 2, fy);
    if (this._hit(m)) this.mobs.pop();
  };
  /** Lohenspawner in Netherfestungen: erzeugen Lohen, solange man in der Nähe ist */
  P._spawnerStep = function () {
    const p = this.player, cx = Math.floor(p.x);
    let blazes = 0; for (const m of this.mobs) if (m.type === "blaze") blazes++;
    if (blazes >= 6) return;
    for (let x = Math.max(1, cx - 22); x <= Math.min(W - 2, cx + 22); x++) for (let y = 4; y < H - 4; y++) {
      if (this.tile(x, y) !== B.SPAWNER) continue;
      if (Math.abs(y - p.y) > 22 || this.mrng() > 0.6) continue;
      let near = 0; for (const m of this.mobs) if (m.type === "blaze" && Math.abs(cxOf(m) - x) < 12 && Math.abs(m.y - y) < 10) near++;
      if (near >= 3) continue;
      if (this._roomFor(x, y - 1, 1, 2)) { const m = this.spawnMob("blaze", x + 0.5 - 0.35, y - 0.05); if (this._hit(m)) this.mobs.pop(); else this.events.push({ t: "spark", x: x + 0.5, y: y - 1 }); }
    }
  };

  // ---------- Spieler in den Dimensionen ----------
  /** Wird in _step nach dem Spieler aufgerufen */
  P._dimPlayer = function (dt) {
    const p = this.player;
    this._clock = (this._clock || 0) + dt;
    // Seelensand bremst (siehe _player), Magma brennt
    const fx = Math.floor(p.x + p.w / 2), fy = Math.floor(p.y + p.h + 0.05);
    if (p.onGround && this.tile(fx, fy) === B.MAGMA && !(this.fx && this.fx.fire_resistance)) {
      p.magT = (p.magT || 0) - dt;
      if (p.magT <= 0) { p.magT = 0.5; this.hurt(1, 0, "magma"); }
    } else p.magT = 0;
    // Leere im Ende
    if (this.dim === 2 && p.y > NH - 14) { p.voidT = (p.voidT || 0) - dt; if (p.voidT <= 0) { p.voidT = 0.4; this.hurt(4, 0, "void"); } }
    // Elytren: Wer sie trägt, gleitet beim Halten der Sprungtaste im Fall
    p.glideT = Math.max(0, (p.glideT || 0) - dt);
    if (p.glide) {
      p.glideT = 0.4;
      p.glideWear = (p.glideWear || 0) + dt;
      if (p.glideWear >= 2) { p.glideWear = 0; this._wear(this.armor, 1, 1); }
    }
    if (this.armor[1] && this.armor[1].id === "elytra") this.grant("elytra");
    this._dimStep(dt);
    this._beaconStep(dt);
  };
  /** Gleiten möglich? (vor dem Bewegen im _player abgefragt) */
  P._canGlide = function () {
    const p = this.player, a = this.armor[1];
    return !!a && a.id === "elytra" && !p.onGround && !p.inWater && !p.inLava && !p.onLadder && !!this.input.jump && p.vy > 1;
  };
}
