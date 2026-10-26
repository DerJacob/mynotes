// =====================================================================
// Blockdorf – Kampf 2.0 und Waffen (Etappe 10, nach Minecraft 1.9 und 1.14)
//   Angriffsladung: Schläge brauchen je nach Waffe Zeit zum Aufladen; halb geladene Schläge machen wenig Schaden.
//   Volle Ladung: kritische Treffer (im Fall), Schwungangriff mit dem Schwert (Schwungkraft), Axt entwaffnet Schilde.
//   Schild: braucht eine Viertelsekunde, bis er oben ist; Axthiebe (Diener) legen ihn für 5 Sekunden lahm.
//   Zweite Hand: Schild und Fackel (Taste F tauscht), leere Haupthand setzt Blöcke aus der zweiten Hand.
//   Geschosse: Spektralpfeile (Leuchten), getränkte Pfeile (Trankwirkung), Armbrust (Mehrfachschuss, Durchschuss,
//   Schnellladen, Feuerwerksraketen), Verweiltränke und Drachenatem (Wolken am Boden), Feuerwerk.
//   Neue Verzauberungen wirken hier: Schwungkraft, Bann, Nemesis, Feuer-/Explosions-/Schussschutz, Dornen.
// Engine ohne Oberfläche; Anzeige in sandbox.js.
// =====================================================================
import { BLOCKS, ITEMS, AMMO, stackMax } from "./sandbox-data.js?v=10";
import { POTION_FX, potionKind, potionMod, potionColor, FIREWORK_FLIGHT, FIREWORK_STAR } from "./sandbox-brew.js?v=10";

/** Zeit bis zur vollen Ladung je Waffenart (Sekunden); ohne Werkzeug zählt die Faust */
export const FULL = { sword: 0.625, axe: 1.1, pick: 0.85, shovel: 1.0, hoe: 0.4 };
export const FIST = 0.3;
export const SHIELD_RAISE = 0.25;         // so lange dauert es, bis der Schild oben ist
export const SHIELD_OFF = 5;              // so lange ist er nach einem Axthieb lahmgelegt
export const XBOW_TIME = 1.25;
export const UNDEAD = new Set(["zombie", "skeleton", "wither_skeleton", "zombie_piglin"]);
export const ARTHROPODS = new Set(["spider"]);
const AXE_MOBS = new Set(["vindicator", "illager_captain"]);
const BLOCKABLE = new Set(["mob", "arrow", "potion", "slime"]);
const KIND = { arrow: "arrow", spectral_arrow: "spectral", tipped_arrow: "tipped", firework_rocket: "rocket" };
const ITEM_OF = { arrow: "arrow", spectral: "spectral_arrow", tipped: "tipped_arrow", rocket: "firework_rocket" };
/** Gegenstände in der Haupthand, die selbst etwas mit der rechten Maustaste tun (dann hebt die zweite Hand keinen Schild) */
const BUSY = new Set(["bow", "crossbow", "bucket", "water_bucket", "lava_bucket", "milk_bucket", "potion", "splash_potion", "lingering_potion", "glass_bottle", "fishing_rod", "spyglass", "ender_pearl", "ender_eye", "egg", "flint_and_steel", "shears", "bone_meal", "firework_rocket", "map", "elytra"]);
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
const cxOf = m => m.x + m.w / 2;

export function installCombat10(Sandbox, K) {
  const { clamp, W, H, REACH } = K;
  const P = Sandbox.prototype;

  // ---------- Zustand ----------
  P._c10Reset = function () {
    this.offh = [null];                 // zweite Hand
    this.clouds = [];                   // Wolken am Boden (Verweiltränke, Drachenatem)
    this.shieldT = 0; this.shieldCd = 0; this.atkFull = FIST; this._atkPrev = false; this._atkNow = false;
    this.xbow = null; this._handUsed = false; this._lastHeld = undefined; this._c10Held = undefined;
  };
  const baseReset = P._resetInventory;
  P._resetInventory = function () { baseReset.call(this); this._c10Reset(); };
  P._c10Save = function () { return this.offh[0] ? { off: this._packStack(this.offh[0]) } : {}; };
  P._c10Load = function (d) { if (d && d.off) this.offh[0] = this._unpackStack(d.off); };

  // ---------- Angriffsladung ----------
  P._weaponFull = function () { const t = this.heldTool(); return t.type ? FULL[t.type] || 0.6 : FIST; };
  /** 0 … 1: wie weit ist der nächste Schlag geladen? */
  P.attackCharge = function () {
    const p = this.player, full = this.atkFull || FIST;
    return clamp(1 - p.atkCd / full, 0, 1);
  };
  /** Gegenstand, den man gerade bedienen kann: Haupthand, sonst die zweite Hand */
  P.handItem = function () { return this.selItem() || (this.offh[0] ? this.offh[0].id : null); };
  /** Welche Verzauberungsstufe tragen alle Rüstungsteile zusammen? */
  P._armorEnch = function (name) { let n = 0; for (const s of this.armor) if (s && s.e && s.e[name]) n += s.e[name] | 0; return n; };

  /** Spieler greift an (Mausposition in Blockkoordinaten). true = getroffen. */
  P.attack = function (mx, my) {
    const p = this.player;
    const held = this._atkPrev; this._atkNow = true;           // Taste schon im letzten Bild gedrückt?
    if (this.win) return false;
    const full = this._weaponFull(), s0 = this.attackCharge();
    if (this._projAttack(mx, my, s0)) { this._atkNow = true; return true; }
    let target = null, bd = 1e9;
    for (const m of this.mobs) {
      if (mx < m.x - 0.35 || mx > m.x + m.w + 0.35 || my < m.y - 0.35 || my > m.y + m.h + 0.35) continue;
      const d = Math.hypot(cxOf(m) - (p.x + p.w / 2), m.y + m.h / 2 - (p.y + p.h / 2));
      if (d > REACH - 0.5 + m.w / 2) continue;
      if (d < bd) { target = m; bd = d; }
    }
    if (!target) return false;
    if (held && s0 < 0.95) return false;                       // gehaltene Taste wartet auf volle Ladung
    const tool = this.heldTool(), en = tool.ench || {}, s = s0;
    const strong = s >= 0.9;
    let base = tool.dmg;
    if (this.fx && this.fx.strength) base += 3 * this.fxAmp("strength");
    if (this.fx && this.fx.weakness) base = Math.max(1, base - 4 * this.fxAmp("weakness"));
    let bonus = 0;
    const melee = tool.type === "sword" || tool.type === "axe";
    if (melee) {
      if (en.sharpness) bonus += 1 + 0.5 * (en.sharpness - 1);
      if (en.smite && UNDEAD.has(target.type)) bonus += 2.5 * en.smite;
      if (en.bane_of_arthropods && ARTHROPODS.has(target.type)) bonus += 2.5 * en.bane_of_arthropods;
    }
    let dmg = base * (0.2 + 0.8 * s * s);
    const crit = strong && !p.onGround && p.vy > 1 && !p.inWater && !p.onLadder;
    if (crit) dmg *= 1.5;
    dmg = Math.round((dmg + bonus * s) * 2) / 2;
    if (dmg < 0.5) dmg = 0.5;
    const sweep = strong && !crit && tool.type === "sword" && p.onGround;
    p.atkCd = full; this.atkFull = full;
    if (tool.type) this._wear(this.inv, this.sel, tool.type === "sword" ? 1 : 2);
    this.addExh(0.1);
    const dir = sgn(cxOf(target) - (p.x + p.w / 2)) || p.face;
    target.lootLvl = en.looting | 0;
    if (en.fire_aspect) target.ignite = Math.max(target.ignite || 0, 4 * en.fire_aspect);
    this._kb = en.knockback | 0;
    this._axeHit = tool.type === "axe" && strong;
    this._mobHurt(target, dmg, dir, "player");
    this._axeHit = false; this._kb = 0;
    if (crit) this.events.push({ t: "crit", x: cxOf(target), y: target.y });
    if (sweep) this._sweep(target, tool, en, dir);
    return true;
  };
  /** Schwungangriff: Tiere und Monster neben dem Ziel bekommen einen Teil des Schadens ab */
  P._sweep = function (target, tool, en, dir) {
    const p = this.player, lv = en.sweeping_edge | 0;
    const sd = 1 + (lv ? tool.dmg * lv / (lv + 1) : 0);
    let hit = 0;
    for (const o of [...this.mobs]) {
      if (o === target || o.dead || o.kind === "object" || o.tamed) continue;
      if (Math.hypot(cxOf(o) - cxOf(target), o.y + o.h / 2 - target.y - target.h / 2) > 1.7 + o.w / 2) continue;
      if (Math.hypot(cxOf(o) - (p.x + p.w / 2), o.y + o.h / 2 - (p.y + p.h / 2)) > REACH) continue;
      if ((cxOf(o) - (p.x + p.w / 2)) * dir < -0.3) continue;      // nur vor dem Spieler
      this._kb = 0; this._mobHurt(o, sd, sgn(cxOf(o) - (p.x + p.w / 2)) || dir, "player"); hit++;
    }
    this.events.push({ t: "sweep", x: cxOf(target), y: target.y + target.h / 2, dir, n: hit });
  };

  // Rückschlag auf Feuerbälle verlangt eine halbwegs geladene Hand
  const baseProjAttack = P._projAttack;
  P._projAttack = function (mx, my, s0 = 1) { return s0 >= 0.5 ? baseProjAttack.call(this, mx, my) : false; };

  // ---------- Schild ----------
  /** Welcher Schild schützt gerade? { arr, i } (Haupthand zuerst) oder null */
  P._shieldArr = function () {
    const a = this.inv[this.sel];
    if (a && a.id === "shield") return { arr: this.inv, i: this.sel };
    const o = this.offh[0];
    if (o && o.id === "shield") return { arr: this.offh, i: 0 };
    return null;
  };
  /** Schild oben und wirksam? */
  P.shieldUp = function () { return !!this.blocking && this.shieldCd <= 0 && this.shieldT >= SHIELD_RAISE && !!this._shieldArr(); };
  P._blockCheck = function () { if (this.blocking && !this._shieldArr()) { this.blocking = false; this.shieldT = 0; } };
  /** Schaden von vorn abfangen? Gibt true zurück, wenn der Schild den Schlag abgehalten hat. */
  P._shieldBlocks = function (n, dir, why) {
    const p = this.player;
    if (!BLOCKABLE.has(why) || !dir || p.face !== -dir || !this.shieldUp()) return false;
    const sh = this._shieldArr();
    this._wear(sh.arr, sh.i, Math.max(1, Math.round(n)));
    p.invuln = 0.4; p.vx = dir * 3.5;
    this.events.push({ t: "block" });
    if (why === "mob" || why === "slime") {
      const a = this._attackerNear(2.8);
      if (a && AXE_MOBS.has(a.type)) { this.shieldCd = SHIELD_OFF; this.shieldT = 0; this.events.push({ t: "shieldbreak", x: cxOf(a), y: a.y }); }
    }
    return true;
  };
  /** Nächster Gegner in der Nähe des Spielers (Angreifer für Dornen und Axthiebe) */
  P._attackerNear = function (r) {
    const p = this.player, px = p.x + p.w / 2, py = p.y + p.h / 2;
    let best = null, bd = r;
    for (const m of this.mobs) {
      if (m.dead || m.kind === "passive" || m.kind === "object") continue;
      const d = Math.hypot(cxOf(m) - px, m.y + m.h / 2 - py);
      if (d < bd) { best = m; bd = d; }
    }
    return best;
  };
  // Gegner mit Schild: Hiebe von vorn prallen ab, Axthiebe legen den Schild lahm
  const baseMod = P._mobHurtMod;
  P._mobHurtMod = function (m, dmg, dir, src) {
    if (m.shield && !(m.shieldOff > 0) && (src === "player" || src === "arrow") && dir && m.face === -dir) {
      if (this._axeHit) { m.shieldOff = SHIELD_OFF; this.events.push({ t: "shieldbreak", x: cxOf(m), y: m.y, mob: true }); }
      else this.events.push({ t: "block", x: cxOf(m), y: m.y + m.h * 0.4, mob: true });
      m.vx = dir * 2.5;
      return 0;
    }
    return baseMod.call(this, m, dmg, dir, src);
  };
  const baseDie = P._mobDie;
  P._mobDie = function (m, src) {
    const was = m.dead;
    baseDie.call(this, m, src);
    if (!was && m.dead && m.shield && src === "player" && this.mrng() < 0.1) this.dropStack({ id: "shield", n: 1, d: Math.floor(this.mrng() * 200) }, cxOf(m), m.y + m.h / 2, true);
  };

  // ---------- Verzauberungen gegen Schaden ----------
  const baseHurt = P.hurt;
  P.hurt = function (n, dir, why) {
    if (n > 0) {
      const lv = why === "fire" || why === "lava" ? this._armorEnch("fire_protection") : why === "explosion" ? this._armorEnch("blast_protection") : why === "arrow" ? this._armorEnch("projectile_protection") : 0;
      if (lv > 0) {
        const m = n * (1 - Math.min(0.8, 0.08 * lv)), f = Math.floor(m);
        n = f + (this.frng() < m - f ? 1 : 0);
        if (n <= 0) return;
      }
    }
    const hp0 = this.player.hp;
    baseHurt.call(this, n, dir, why);
    const p = this.player;
    if (why === "mob" && p.hp < hp0 && p.hp > 0) {
      const lv = this._armorEnch("thorns");
      if (lv > 0 && this.frng() < Math.min(0.9, 0.15 * lv)) {
        const a = this._attackerNear(2.8);
        if (a) { this._mobHurt(a, 1 + Math.floor(this.frng() * 4), sgn(cxOf(a) - (p.x + p.w / 2)), "thorns"); this.events.push({ t: "thorns", x: cxOf(a), y: a.y }); }
      }
    }
  };

  // ---------- Zweite Hand ----------
  P.swapHands = function () {
    if (this.win) return false;
    const a = this.inv[this.sel], b = this.offh[0];
    if (!a && !b) return false;
    this.inv[this.sel] = b; this.offh[0] = a;
    this.bow = null; this.xbow = null; this.blocking = false; this.shieldT = 0;
    this.events.push({ t: "swap" });
    return true;
  };
  /** Hält die Haupthand etwas, das selbst auf die rechte Maustaste reagiert? */
  P._mainBusy = function (id) { const it = id && ITEMS[id]; return !!it && (!!it.block || !!it.food || !!it.put || BUSY.has(id)); };
  /** Leuchtkraft des Gegenstands in einer Hand (Fackel o. Ä.) */
  P.heldEmit = function () {
    let e = 0;
    for (const s of [this.inv[this.sel], this.offh[0]]) { const b = s && ITEMS[s.id] && ITEMS[s.id].block; if (b && BLOCKS[b].emit) e = Math.max(e, BLOCKS[b].emit); }
    return e;
  };
  const basePlace = P.place;
  P.place = function (tx, ty) {
    const o = this.offh[0];
    if (!this.inv[this.sel] && o && (ITEMS[o.id].block || ITEMS[o.id].put)) {
      this.inv[this.sel] = o; this.offh[0] = null;
      let r;
      try { r = basePlace.call(this, tx, ty); } finally { this.offh[0] = this.inv[this.sel]; this.inv[this.sel] = null; }
      return r;
    }
    return basePlace.call(this, tx, ty);
  };
  const baseSlots = P.slots;
  P.slots = function (area) { return area === "off" ? this.offh : baseSlots.call(this, area); };
  const baseCanPut = P.canPut;
  P.canPut = function (area, idx, st) { return area === "off" ? true : baseCanPut.call(this, area, idx, st); };
  const baseShift = P.shiftClick;
  P.shiftClick = function (area, idx) {
    const s = area === "inv" ? this.inv[idx] : null;
    if (s && s.id === "shield" && !this.offh[0] && this.win && (this.win.kind === "inv" || this.win.kind === "creative")) { this.offh[0] = s; this.inv[idx] = null; return; }
    return baseShift.call(this, area, idx);
  };

  // ---------- Geschosse: Munition ----------
  /** Erstes passendes Geschoss (zweite Hand, dann Inventar). Im Kreativmodus gibt es unendlich Pfeile. */
  P._ammo = function (accept = AMMO) {
    for (const [arr, from, to] of [[this.offh, 0, 1], [this.inv, 0, 36]]) {
      for (let i = from; i < to; i++) { const s = arr[i]; if (s && s.n > 0 && accept.includes(s.id)) return { arr, i, st: s, k: KIND[s.id], d: s.d | 0, id: s.id }; }
    }
    return this.mode === "creative" ? { arr: null, i: 0, st: null, k: "arrow", d: 0, id: "arrow" } : null;
  };
  P._useAmmo = function (am) { if (!am || !am.arr) return; am.st.n--; if (am.st.n <= 0) am.arr[am.i] = null; };
  P.hasAmmo = function (xbow = false) { return !!this._ammo(xbow ? [...AMMO, "firework_rocket"] : AMMO); };
  /** Pfeil mit allen Eigenschaften */
  P._mkArrow = function (k, d, x, y, vx, vy, dmg, o = {}) {
    return { kind: "arrow", x, y, vx, vy, dmg, fromPlayer: true, crit: !!o.crit, age: 0, stuck: false, stuckT: 0, kb: o.kb | 0, fire: !!o.fire, noPickup: !!o.noPickup,
      ak: k, item: ITEM_OF[k] || "arrow", tip: k === "tipped" ? d | 0 : undefined, pierce: o.pierce | 0 };
  };

  // ---------- Bogen ----------
  P.bowDraw = function (dt) {
    if (this.win || this.selItem() !== "bow" || !this._ammo()) { this.bow = null; return false; }
    if (!this.bow) this.bow = { t: 0 };
    this.bow.t = Math.min(1.2, this.bow.t + dt);
    return true;
  };
  P.bowRelease = function (mx, my) {
    const b = this.bow; this.bow = null;
    if (!b || b.t < 0.25 || this.selItem() !== "bow") return false;
    const am = this._ammo(); if (!am) return false;
    const en = this.selStack().e || {}, inf = !!en.infinity && am.k === "arrow";
    if (!inf) this._useAmmo(am);
    const p = this.player, x0 = p.x + p.w / 2, y0 = p.y + 0.5, q = Math.min(1, b.t / 1.0);
    const L = Math.max(0.1, Math.hypot(mx - x0, my - y0)), speed = 14 + 26 * q;
    this.proj.push(this._mkArrow(am.k, am.d, x0, y0, (mx - x0) / L * speed, (my - y0) / L * speed, Math.round((2 + 7 * q) * (en.power ? 1 + 0.25 * (en.power + 1) : 1)),
      { crit: q >= 1, kb: en.punch, fire: !!en.flame, noPickup: inf || !am.arr }));
    this._wear(this.inv, this.sel, 1); this.addExh(0.05);
    this.grant("shoot"); this.events.push({ t: "shoot", mob: false });
    return true;
  };

  // ---------- Armbrust ----------
  /** Ladezeit der Armbrust in der Hand (Schnellladen verkürzt sie) */
  P.crossbowTime = function () { const s = this.selStack(); return Math.max(0.25, XBOW_TIME - 0.25 * ((s && s.e && s.e.quick_charge) | 0)); };
  P.xbowLoaded = function () { const s = this.selStack(); return !!s && s.id === "crossbow" && !!s.ld; };
  P.xbowDraw = function (dt) {
    const s = this.selStack();
    if (this.win || !s || s.id !== "crossbow" || s.ld || !this._ammo([...AMMO, "firework_rocket"])) { this.xbow = null; return false; }
    if (!this.xbow) this.xbow = { t: 0 };
    this.xbow.t = Math.min(this.crossbowTime() + 0.4, this.xbow.t + dt);
    return true;
  };
  /** Maustaste losgelassen: volle Ladung → die Armbrust ist geladen */
  P.xbowRelease = function () {
    const b = this.xbow; this.xbow = null;
    const s = this.selStack();
    if (!b || !s || s.id !== "crossbow" || s.ld || b.t < this.crossbowTime()) return false;
    const am = this._ammo([...AMMO, "firework_rocket"]); if (!am) return false;
    s.ld = { k: am.k, d: am.d, m: s.e && s.e.multishot ? 1 : 0 };
    this._useAmmo(am);
    this.events.push({ t: "xbowload" });
    return true;
  };
  P.crossbowFire = function (mx, my) {
    const s = this.selStack();
    if (this.win || !s || s.id !== "crossbow" || !s.ld) return false;
    const ld = s.ld, en = s.e || {}; s.ld = null;
    const p = this.player, x0 = p.x + p.w / 2, y0 = p.y + 0.5, a0 = Math.atan2(my - y0, mx - x0);
    const angles = ld.m ? [0, -0.17, 0.17] : [0];
    angles.forEach((da, i) => {
      const a = a0 + da, side = i > 0;
      if (ld.k === "rocket") {
        this.proj.push({ kind: "rocket", x: x0, y: y0, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, d: ld.d, fromPlayer: true, age: 0, stuck: false, stuckT: 0, dmg: 0 });
      } else {
        this.proj.push(this._mkArrow(ld.k, ld.d, x0, y0, Math.cos(a) * 40, Math.sin(a) * 40, 9, { crit: true, pierce: en.piercing, noPickup: side || this.mode === "creative" }));
      }
    });
    this._wear(this.inv, this.sel, ld.k === "rocket" ? 3 : 1); this.addExh(0.05);
    this.grant("shoot"); this.events.push({ t: "shoot", mob: false, xbow: true });
    return true;
  };

  // ---------- Hände benutzen (rechte Maustaste halten) ----------
  /** Wird jedes Bild aufgerufen, solange die rechte Taste gedrückt ist. used = der Klick hat schon etwas bewirkt. */
  P.handHold = function (dt, mx, my, used) {
    if (this.win) return null;
    const it = this.selItem(), off = this.offh[0] && this.offh[0].id;
    if (it === "shield") { this.blocking = true; return "shield"; }
    if (it === "bow") return !used && this.bowDraw(dt) ? "bow" : null;
    if (it === "crossbow") return !used && this.xbowDraw(dt) ? "xbow" : null;
    if (off === "shield" && !this._mainBusy(it)) { this.blocking = true; return "shield"; }
    return null;
  };
  /** Rechte Taste losgelassen: Pfeil abschießen bzw. Armbrust laden */
  P.handRelease = function (mx, my) {
    let r = false;
    if (this.bow) r = this.bowRelease(mx, my) || r;
    if (this.xbow) r = this.xbowRelease() || r;
    this.blocking = false; this.shieldT = 0; this._handUsed = false;
    return r;
  };

  // ---------- Benutzen: Armbrust abfeuern, Raketen, Drachenatem sammeln ----------
  const baseUse = P.use;
  P.use = function (tx, ty) {
    if (baseUse.call(this, tx, ty)) return true;
    if (this.win) return false;
    const s = this.selStack();
    if (!s) return false;
    if (s.id === "crossbow" && s.ld) { const a = this.aim; return this.crossbowFire(a ? a.x : tx + 0.5, a ? a.y : ty + 0.5); }
    if (s.id === "firework_rocket") return this._useRocket(tx, ty);
    if (s.id === "glass_bottle") return this._collectBreath(tx, ty);
    return false;
  };
  /** Feuerwerksrakete: beim Gleiten ein Schub, sonst steigt sie in den Himmel */
  P._useRocket = function (tx, ty) {
    const s = this.selStack(), p = this.player, d = s.d | 0;
    if (this.eatCd > 0) return false;
    this.eatCd = 0.3;
    if ((p.glide || p.glideT > 0) && this.armor[1] && this.armor[1].id === "elytra") {
      p.boostT = 0.5 + 0.5 * FIREWORK_FLIGHT(d);
      this._consumeSel();
      this.events.push({ t: "rocket", x: p.x + p.w / 2, y: p.y + p.h, boost: true });
      return true;
    }
    if (!this.reachOk(tx, ty)) return false;
    this.proj.push({ kind: "rocket", x: tx + 0.5, y: ty, vx: 0, vy: -12, up: true, life: 0.5 + 0.45 * FIREWORK_FLIGHT(d), d, fromPlayer: true, age: 0, stuck: false, stuckT: 0, dmg: 0 });
    this._consumeSel();
    this.events.push({ t: "rocket", x: tx + 0.5, y: ty });
    return true;
  };
  const baseCanGlide = P._canGlide;
  P._canGlide = function () {
    const p = this.player, a = this.armor[1];
    if (p.boostT > 0 && a && a.id === "elytra" && !p.onGround && !p.inWater && !p.inLava && !p.onLadder && this.input.jump) return true;
    return baseCanGlide.call(this);
  };
  /** Feuerwerksexplosion: Sterne richten Schaden an (nie am eigenen Spieler) */
  P._fireworkBlast = function (x, y, d, fromPlayer = true) {
    const star = FIREWORK_STAR(d);
    this.events.push({ t: "firework", x, y, col: star ? star - 1 : -1 });
    if (!star) return;
    for (const m of [...this.mobs]) {
      if (m.dead || m.kind === "object") continue;
      const dist = Math.hypot(cxOf(m) - x, m.y + m.h / 2 - y);
      if (dist < 3.5) this._mobHurt(m, Math.max(1, Math.round(5 * (1 - dist / 3.5 * 0.4))), sgn(cxOf(m) - x), fromPlayer ? "arrow" : "fire");
    }
  };
  const baseSpecial = P._projSpecial;
  P._projSpecial = function (a, dt) {
    if (a.kind !== "rocket") return baseSpecial.call(this, a, dt);
    a.age += dt;
    if (a.up) {
      a.y += a.vy * dt; a.vy *= 1 - 0.4 * dt;
      if (a.age >= a.life || BLOCKS[this.tile(Math.floor(a.x), Math.floor(a.y))].solid) { this._fireworkBlast(a.x, a.y, a.d, true); this._projRm(a); }
      return true;
    }
    if (a.age > 4 || a.x < 0 || a.x >= W || a.y < -4 || a.y > H + 4) { this._projRm(a); return true; }
    const sp = Math.hypot(a.vx, a.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.25)), sdt = dt / steps;
    for (let k = 0; k < steps; k++) {
      a.vy += 3 * sdt; a.x += a.vx * sdt; a.y += a.vy * sdt; a.ang = Math.atan2(a.vy, a.vx);
      if (a.x < 0 || a.x >= W) { this._projRm(a); return true; }
      let boom = BLOCKS[this.tile(Math.floor(a.x), Math.floor(a.y))].solid;
      if (!boom) for (const m of this.mobs) if (!m.dead && m.kind !== "object" && a.x > m.x - 0.2 && a.x < m.x + m.w + 0.2 && a.y > m.y - 0.2 && a.y < m.y + m.h + 0.2) { boom = true; break; }
      if (boom) { this._fireworkBlast(a.x, a.y, a.d, true); this._projRm(a); return true; }
    }
    return true;
  };

  // ---------- Pfeilwirkungen ----------
  /** Treffer eines Pfeils auf ein Lebewesen: Trankwirkung bzw. Leuchten */
  P._arrowEffects = function (a, m) {
    if (a.ak === "spectral") m.glow = 10;
    if (a.ak === "tipped" && a.tip !== undefined) {
      const k = potionKind(a.tip), mod = potionMod(a.tip), f = POTION_FX[k];
      if (f && !m.dead) this._applyPotionToMob(m, k, mod, f.instant ? 1 : 0.125);
    }
  };

  // ---------- Wolken am Boden ----------
  /** kind "potion": Verweiltrank (pot = Trankcode) · "breath": Drachenatem */
  P._spawnCloud = function (x, y, pot, kind = "potion") {
    if (this.clouds.length >= 24) this.clouds.shift();
    this.clouds.push({ x, y, r: kind === "breath" ? 3.2 : 3, r0: kind === "breath" ? 3.2 : 3, t: 0, life: 30, pot: pot | 0, kind, tick: 0.3, seen: new Map() });
    this.events.push({ t: "cloud", x, y, col: kind === "breath" ? "#b04ad8" : potionColor(pot) });
  };
  const inCloud = (c, e) => Math.abs(e.x + e.w / 2 - c.x) <= c.r + e.w / 2 && e.y + e.h > c.y - 1.4 && e.y < c.y + 0.8;
  P._cloudsStep = function (dt) {
    const p = this.player;
    for (const c of [...this.clouds]) {                 // Kopie: Treffer können Wolken anlegen oder die Liste ersetzen (Tod, Dimensionswechsel)
      c.t += dt; c.r = Math.max(0, c.r0 * (1 - 0.85 * c.t / c.life)); c.tick -= dt;
      if (c.t >= c.life || c.r < 0.35) { const i = this.clouds.indexOf(c); if (i >= 0) this.clouds.splice(i, 1); continue; }
      if (c.tick > 0) continue;
      c.tick = 0.5;
      const kind = potionKind(c.pot), mod = potionMod(c.pot), f = POTION_FX[kind];
      const gap = c.kind === "breath" ? 0.5 : 2;
      const once = key => { const last = c.seen.get(key); if (last !== undefined && c.t - last < gap) return false; c.seen.set(key, c.t); return true; };
      if (inCloud(c, p) && once("p")) {
        if (c.kind === "breath") this.hurt(2, 0, "magic");
        else if (f) this._applyPotionTo(kind, mod, f.instant ? 0.5 : 0.25);
        c.r0 = Math.max(0, c.r0 - 0.12);
      }
      for (const m of [...this.mobs]) {
        if (m.dead || m.kind === "object" || m.type === "ender_dragon" || !inCloud(c, m) || !once(m)) continue;
        if (c.kind === "breath") this._mobHurt(m, 2, 0, "potion");
        else if (f) this._applyPotionToMob(m, kind, mod, f.instant ? 0.5 : 0.25);
        c.r0 = Math.max(0, c.r0 - 0.12);
      }
    }
  };
  /** Glasflasche in eine Drachenatem-Wolke halten */
  P._collectBreath = function (tx, ty) {
    if (!this.reachOk(tx, ty)) return false;
    for (const c of this.clouds) {
      if (c.kind !== "breath" || Math.abs(tx + 0.5 - c.x) > c.r + 0.6 || Math.abs(ty + 0.5 - c.y) > 2) continue;
      this._consumeSel();
      const rest = this.add("dragon_breath", 1, 0, true);
      if (rest) this.dropStack({ id: "dragon_breath", n: 1, d: 0 });
      c.r0 = Math.max(0, c.r0 - 0.5);
      this.events.push({ t: "bucket", fill: true, x: tx, y: ty });
      return true;
    }
    return false;
  };
  // Drachenfeuerbälle hinterlassen Atemwolken
  const baseBurst = P._projBurst;
  P._projBurst = function (a, hit) {
    baseBurst.call(this, a, hit);
    if (a.kind === "fireball" && a.big && !a.fromPlayer && a.owner && a.owner.type === "ender_dragon") this._spawnCloud(a.x, a.y, 0, "breath");
  };
  const baseEnter = P._enterDim;
  if (baseEnter) P._enterDim = function (...args) { this.clouds = []; this.xbow = null; return baseEnter.apply(this, args); };

  // ---------- Takt ----------
  const baseUpdate = P.update;
  P.update = function (dt) { this._atkPrev = this._atkNow; this._atkNow = false; return baseUpdate.call(this, dt); };
  const baseStep = P._step;
  P._step = function (dt) {
    const p = this.player;
    // Elytren-Schub durch Feuerwerk: Richtung zur Maus
    if (p.boostT > 0) {
      p.boostT -= dt;
      if (this._canGlide()) {
        const a = this.aim, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        let dx = a ? a.x - cx : p.face, dy = a ? a.y - cy : -0.3;
        const L = Math.max(0.01, Math.hypot(dx, dy)); dx /= L; dy /= L;
        const k = Math.min(1, 7 * dt);
        p.vx += (dx * 22 - p.vx) * k; p.vy += (dy * 22 - p.vy) * k;
      }
    }
    baseStep.call(this, dt);
    // Waffenwechsel: die Ladung beginnt von vorn
    const held = this.selItem();
    if (this._c10Held !== undefined && held !== this._c10Held) { this.atkFull = this._weaponFull(); p.atkCd = this.atkFull; this.xbow = null; this.bow = null; }
    this._c10Held = held;
    // Schild
    this._blockCheck();
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    if (this.blocking && this.shieldCd <= 0) this.shieldT += dt; else this.shieldT = 0;
    if (this.shieldCd > 0) this.blocking = false;
    // Gegner: Schild-Sperre und Leuchten
    for (const m of this.mobs) { if (m.shieldOff > 0) m.shieldOff -= dt; if (m.glow > 0) m.glow -= dt; }
    if (this.xbow && this.selItem() !== "crossbow") this.xbow = null;
    if (this.clouds.length) this._cloudsStep(dt);
  };

  // ---------- Handwerk mit Zutaten-abhängigem Ergebnis ----------
  const baseCraft = P.craftResult;
  P.craftResult = function () {
    const r = baseCraft.call(this);
    if (!r || !r.recipe.dyn) return r;
    const g = this.grid.filter(Boolean), dyn = r.recipe.dyn;
    const col = s => ITEMS[s.id].col | 0;
    if (dyn === "tipped") { const l = g.find(s => s.id === "lingering_potion"); r.d = l ? l.d | 0 : 0; }
    else if (dyn === "star") { const dye = g.find(s => ITEMS[s.id].col !== undefined && s.id !== "firework_star"); r.d = dye ? col(dye) : 0; }
    else if (dyn === "rocket") {
      const f = g.filter(s => s.id === "gunpowder").length, st = g.find(s => s.id === "firework_star");
      r.d = Math.max(1, Math.min(3, f)) | ((st ? (st.d & 15) + 1 : 0) << 2);
    } else if (dyn === "shieldbanner") {
      const sh = g.find(s => s.id === "shield"), bn = g.find(s => ITEMS[s.id].banner !== undefined);
      if (sh && bn) { r.d = sh.d | 0; r.x = { e: sh.e, r: sh.r, bp: bn.bp ? { c: bn.bp.c, p: bn.bp.p.map(q => q.slice()) } : { c: ITEMS[bn.id].banner, p: [] } }; }
    }
    return r;
  };
  P._clickOut = function (shift) {
    let made = 0;
    for (let guard = 0; guard < 64; guard++) {
      const r = this.craftResult();
      if (!r) break;
      const d = r.d | 0;
      if (shift) {
        if (this.room(r.id) < r.n) break;
        this._consumeGrid(); this.add(r.id, r.n, d, true, r.x || null);
      } else {
        const c = this.cursor;
        if (c && (c.id !== r.id || c.n + r.n > stackMax(r.id) || c.e || c.bp || r.x || (ITEMS[c.id].byD && (c.d | 0) !== d))) break;
        this._consumeGrid();
        if (c) c.n += r.n; else this.cursor = this.newStack(r.id, r.n, d, r.x || null);
      }
      made++; this.events.push({ t: "craft", id: r.id });
      if (!shift) break;
    }
    return made > 0;
  };
}
