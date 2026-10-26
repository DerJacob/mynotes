// =====================================================================
// Blockdorf – Regeln der Etappe 9: Steine, Farben, Holzsätze, Werkblöcke, Kupfer, Kerzen, Banner
//   Steinsäge, Webstuhl, Schleifstein, Schmiedetisch · Räucherofen und Schmelzofen (in sandbox-inventory.js) · Lagerfeuer-Kochen
//   Schleimblock (Hüpfen), Honigblock (bremst, klebt) · Betonpulver (fällt, härtet im Wasser)
//   Kerzen, Kupfer (altert, Wachs, Axt), Türen und Falltüren aus Holz und Kupfer, Schilder mit Text, Rüstungsständer,
//   Banner mit Mustern, gemeißeltes Bücherregal, Honigflasche
// Hängt sich an bestehende Methoden (Muster wie in den früheren Etappen); Engine ohne Oberfläche.
// =====================================================================
import {
  B, BLOCKS, ITEMS, COLORS, STONE_MATS, STONECUT, COPPER_IDS, isDoorM, isTrap, itemOf9, FIRST9, LAST9, TRIM_MAT_IDS, MAX_LAYERS, LOOM_PATTERNS,
  hasTag, isPlant, isFluid, isFoodSmelt, SMELT
} from "./sandbox-data.js?v=9";
import { mulberry32 } from "./sandbox-noise.js?v=9";

export const OXIDE_CHANCE = 0.0022;   // je Block und Durchgang (alle 2 s): im Mittel gut 15 Minuten bis zur nächsten Stufe
export const CAMP_TIME = 30;           // Sekunden, bis Essen am Lagerfeuer gar ist

export function installCraft9(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const key = (x, y) => `${x},${y}`;
  const solid = (e, x, y) => BLOCKS[e.tile(x, y)].solid;

  P._craft9Init = function () { this.ox9 = mulberry32((this.seed ^ 0x9c0de) + 77); this.oxT = 2; this.powT = 1; };

  /** Gegenstand in das Inventar legen, was nicht passt, fällt zu Boden */
  P._give = function (st) {
    if (!st) return;
    const rest = this._insert(this.inv, st.id, st.n, st.d, 0, 36, st);
    if (rest) this.dropStack(this.newStack(st.id, rest, st.d, st));
  };
  P._bannerStack = function (c, p) {
    const s = this.newStack(`banner_${COLORS[c & 15][0]}`, 1);
    if (p && p.length) s.bp = { c: c & 15, p: p.map(q => q.slice()) };
    return s;
  };
  const free = (e, tx, ty) => { const c = e.tile(tx, ty); return c === B.AIR || isPlant(c); };
  const overlapsBody = (e, box) => {
    const over = b => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y;
    return over(e.player) || e.villagers.some(over) || e.mobs.some(over);
  };

  // ---------- Bauen ----------
  const basePlace = P.place;
  P.place = function (tx, ty) {
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (!it || it.block == null || it.block < FIRST9 || it.block > LAST9) return basePlace.call(this, tx, ty);
    const id = it.block, aux0 = it.col | 0;
    if (!this.reachOk(tx, ty) || tx < 0 || tx >= W || ty < 2 || ty >= H - 2) return false;
    const cur = this.tile(tx, ty), i = ty * W + tx;
    // zwei gleiche Stufen ergeben wieder den vollen Block
    if ((id === B.WSLAB || id === B.SSLAB) && cur === id && (this.aux[i] & 15) === (aux0 & 15)) {
      const m = aux0 & 15, full = id === B.WSLAB ? (m === 0 ? [B.PLANKS, 0] : [B.WPLANKS, m]) : [STONE_MATS[m][3], 0];
      this.setTile(tx, ty, full[0]); this.aux[i] = full[1];
      this._consumeSel(); this.stats.built++; this.events.push({ t: "place", x: tx, y: ty, id: full[0] });
      return true;
    }
    if (cur !== B.AIR && !isPlant(cur) && !(isFluid(cur) && BLOCKS[id].solid)) return false;
    const floor = solid(this, tx, ty + 1);
    let placed = false;
    if (id === B.DOORM_B) {
      if (!free(this, tx, ty - 1) || !floor) return false;
      if (overlapsBody(this, { x: tx, y: ty - 1, w: 1, h: 2 })) return false;
      this.setTile(tx, ty, B.DOORM_B); this.aux[i] = aux0;
      this.setTile(tx, ty - 1, B.DOORM_T); this.aux[i - W] = aux0;
      placed = true;
    } else if (id === B.TRAP) {
      if (!this._supported(tx, ty)) return false;
      const a = this.aim, top = a && a.y - ty < 0.5, aux = aux0 | (top ? 128 : 0);
      if (overlapsBody(this, { x: tx, y: top ? ty : ty + 0.8, w: 1, h: 0.2 })) return false;
      this.setTile(tx, ty, B.TRAP); this.aux[i] = aux;
      placed = true;
    } else if (id === B.CANDLE || id === B.ARMOR_STAND) {
      if (!floor) return false;
      this.setTile(tx, ty, id); this.aux[i] = aux0;
      if (id === B.ARMOR_STAND) this.ents.set(key(tx, ty), this._newEnt("stand"));
      placed = true;
    } else if (id === B.HSIGN) {
      if (!(solid(this, tx, ty - 1) || solid(this, tx - 1, ty) || solid(this, tx + 1, ty))) return false;
      this.setTile(tx, ty, id); this.aux[i] = aux0; placed = true;
    }
    if (placed) {
      this._consumeSel(); this.stats.built++; this.events.push({ t: "place", x: tx, y: ty, id });
      return true;
    }
    const bp = s.bp ? { c: s.bp.c, p: s.bp.p.map(q => q.slice()) } : null;
    const ok = basePlace.call(this, tx, ty);
    if (!ok) return false;
    if (id === B.BANNER) { const e = this._newEnt("banner"); e.c = aux0 & 15; e.p = bp ? bp.p : []; this.ents.set(key(tx, ty), e); }
    else if (id === B.SIGN || id === B.HSIGN) { this.ents.set(key(tx, ty), this._newEnt("sign")); this.openWindow("sign", tx, ty); }
    else if (id === B.CBOOKSHELF) this.ents.set(key(tx, ty), this._newEnt("cbook"));
    else if (id === B.POWDER) this._sandFall(tx, ty);
    return true;
  };

  // ---------- Benutzen ----------
  const baseUse = P.use;
  P.use = function (tx, ty) {
    if (this.win) return baseUse.call(this, tx, ty);
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (s && s.id === "spyglass") return false;                  // Fernglas: die Oberfläche zoomt, solange die Taste gehalten wird
    if (this.reachOk(tx, ty)) {
      const id = this.tile(tx, ty);
      if (id >= FIRST9 && id <= LAST9 && this._use9(tx, ty, id, s, it)) return true;
      if (id === B.CAMPFIRE && this._campUse(tx, ty, s)) return true;
    }
    return baseUse.call(this, tx, ty);
  };
  P._use9 = function (tx, ty, id, s, it) {
    const bd = BLOCKS[id];
    if (id === B.STONECUTTER) { this.openWindow("stonecut", tx, ty); return true; }
    if (id === B.SMITHING) { this.openWindow("smith", tx, ty); return true; }
    if (id === B.LOOM) { this.openWindow("loom", tx, ty); return true; }
    if (id === B.GRINDSTONE) { this.openWindow("grind", tx, ty); return true; }
    if (id === B.SMOKER || id === B.BLAST) {
      const k = key(tx, ty); if (!this.ents.has(k)) this.ents.set(k, this._newEnt(bd.entity));
      this.openWindow("furnace", tx, ty); return true;
    }
    if (this._copperUse(tx, ty, s, it)) return true;
    if (isDoorM(id)) return this._toggleDoorM(tx, ty);
    if (isTrap(id)) return this._toggleTrap(tx, ty);
    if (id === B.COPPER_BULB || id === B.BULB_ON) { this.setTile(tx, ty, id === B.BULB_ON ? B.COPPER_BULB : B.BULB_ON, true); this.events.push({ t: "click", x: tx, y: ty }); return true; }
    if (id === B.CANDLE) {
      if (s && s.id === "flint_and_steel") { this._setKeep(tx, ty, B.CANDLE_LIT); this._wear(this.inv, this.sel, 1); this.events.push({ t: "candle", x: tx, y: ty, on: true }); return true; }
      return false;
    }
    if (id === B.CANDLE_LIT) { this._setKeep(tx, ty, B.CANDLE); this.events.push({ t: "candle", x: tx, y: ty, on: false }); return true; }
    if (id === B.ARMOR_STAND) return this._standUse(tx, ty, s, it);
    if (id === B.SIGN || id === B.HSIGN) {
      const k = key(tx, ty); if (!this.ents.has(k)) this.ents.set(k, this._newEnt("sign"));
      this.openWindow("sign", tx, ty); return true;
    }
    if (id === B.CBOOKSHELF) return this._cbookUse(tx, ty, s);
    return false;
  };
  /** Block tauschen, das Zusatzfeld bleibt */
  P._setKeep = function (x, y, id) { const i = y * W + x, a = this.aux[i]; this.setTile(x, y, id); this.aux[i] = a; };
  const baseSetTile = P.setTile;

  // ---------- Türen und Falltüren ----------
  P._toggleDoorM = function (x, y) {
    const id = this.tile(x, y), open = id === B.DOORM_BO || id === B.DOORM_TO;
    const bot = id === B.DOORM_B || id === B.DOORM_BO ? y : y + 1, i = bot * W + x;
    const aux = this.aux[i], p = this.player;
    if (!open) {
      const right = p.x + p.w / 2 > x + 0.5, a = (aux & 127) | (right ? 0 : 128);
      this.setTile(x, bot, B.DOORM_BO); this.aux[i] = a;
      this.setTile(x, bot - 1, B.DOORM_TO); this.aux[i - W] = a;
    } else {
      if (p.x < x + 1 && p.x + p.w > x && p.y < bot + 1 && p.y + p.h > bot - 1) return false;         // man steht in der Tür
      const a = aux & 127;
      this.setTile(x, bot, B.DOORM_B); this.aux[i] = a;
      this.setTile(x, bot - 1, B.DOORM_T); this.aux[i - W] = a;
    }
    this.events.push({ t: "door", x, y: bot, open: !open });
    return true;
  };
  P._toggleTrap = function (x, y) {
    const id = this.tile(x, y), i = y * W + x, a = this.aux[i], p = this.player;
    if (id === B.TRAP) this._setKeep(x, y, p.x + p.w / 2 > x + 0.5 ? B.TRAP_OL : B.TRAP_O);
    else {
      const top = (a & 128) !== 0, box = { x, y: top ? y : y + 0.8, w: 1, h: 0.2 };
      if (overlapsBody(this, box)) return false;
      this._setKeep(x, y, B.TRAP);
    }
    this.events.push({ t: "door", x, y, open: id === B.TRAP });
    return true;
  };

  // ---------- Kupfer: Alterung, Wachs, Axt ----------
  /** Kupfer-Zustand eines Blocks: { stage, wax } oder null */
  P._copperState = function (x, y) {
    const id = this.tile(x, y), a = this.aux[y * W + x];
    if (COPPER_IDS.has(id)) return { stage: a & 3, wax: (a & 64) !== 0 };
    if ((isDoorM(id) || isTrap(id)) && (a & 15) === 9) return { stage: (a >> 4) & 3, wax: (a & 64) !== 0 };
    return null;
  };
  P._copperSet = function (x, y, stage, wax) {
    const set = (xx, yy) => {
      const id = this.tile(xx, yy), i = yy * W + xx, a = this.aux[i];
      if (COPPER_IDS.has(id)) this.aux[i] = (a & ~67) | stage | (wax ? 64 : 0);
      else this.aux[i] = (a & ~112) | (stage << 4) | (wax ? 64 : 0);
    };
    set(x, y);
    const id = this.tile(x, y);
    if (isDoorM(id)) set(x, id === B.DOORM_B || id === B.DOORM_BO ? y - 1 : y + 1);
  };
  P._copperUse = function (x, y, s, it) {
    const st = this._copperState(x, y);
    if (!st || !s) return false;
    if (s.id === "honeycomb") {
      if (st.wax) return false;
      this._copperSet(x, y, st.stage, true); this._consumeSel(); this.events.push({ t: "wax", x, y }); return true;
    }
    if (it && it.tool === "axe") {
      if (st.wax) this._copperSet(x, y, st.stage, false);
      else if (st.stage > 0) this._copperSet(x, y, st.stage - 1, false);
      else return false;
      this._wear(this.inv, this.sel, 1); this.events.push({ t: "scrape", x, y }); return true;
    }
    return false;
  };
  /** Ein Alterungsdurchgang: jeder ungewachste Kupferblock in Reichweite altert mit der Wahrscheinlichkeit chance */
  P._oxidize = function (chance = OXIDE_CHANCE, range = 40) {
    const p = this.player, cx = Math.floor(p.x + p.w / 2), x0 = Math.max(0, cx - range), x1 = Math.min(W - 1, cx + range), r = this.ox9 || (this.ox9 = mulberry32((this.seed ^ 0x9c0de) + 77));
    let n = 0;
    for (let x = x0; x <= x1; x++) for (let y = 2; y < H - 2; y++) {
      const id = this.tiles[y * W + x];
      if (id < B.COPPER_BLOCK || id > B.TRAP_OL) continue;
      if (!(COPPER_IDS.has(id) || id === B.DOORM_B || id === B.DOORM_BO || isTrap(id))) continue;
      const st = this._copperState(x, y);
      if (!st || st.wax || st.stage >= 3 || r() >= chance) continue;
      this._copperSet(x, y, st.stage + 1, false); n++;
    }
    return n;
  };

  // ---------- Rüstungsständer ----------
  P._standUse = function (tx, ty, s, it) {
    const k = key(tx, ty); let e = this.ents.get(k);
    if (!e) { e = this._newEnt("stand"); this.ents.set(k, e); }
    if (s && it.armor) {
      const slot = it.armor.slot, old = e.s[slot];
      e.s[slot] = this.newStack(s.id, 1, s.d, s);
      this._consumeSel();
      if (old) this._give(old);
      this.events.push({ t: "stand", x: tx, y: ty });
      return true;
    }
    const i = e.s.findIndex(Boolean);
    if (i < 0) return false;
    this._give(e.s[i]); e.s[i] = null;
    this.events.push({ t: "stand", x: tx, y: ty });
    return true;
  };

  // ---------- Gemeißeltes Bücherregal ----------
  P._cbookUse = function (tx, ty, s) {
    const k = key(tx, ty), i = ty * W + tx; let e = this.ents.get(k);
    if (!e) { e = this._newEnt("cbook"); this.ents.set(k, e); }
    const a = this.aim;
    let slot = -1;
    if (a && Math.floor(a.x) === tx && Math.floor(a.y) === ty) slot = (a.y - ty < 0.5 ? 0 : 3) + Math.min(2, Math.floor((a.x - tx) * 3));
    if (s && (s.id === "book" || s.id === "enchanted_book")) {
      if (slot < 0 || e.s[slot]) slot = e.s.findIndex(q => !q);
      if (slot < 0) return false;
      e.s[slot] = this.newStack(s.id, 1, s.d, s); this._consumeSel();
      this.aux[i] |= 1 << slot; this.events.push({ t: "book", x: tx, y: ty });
      return true;
    }
    if (slot < 0 || !e.s[slot]) slot = e.s.findIndex(Boolean);
    if (slot < 0) return false;
    this._give(e.s[slot]); e.s[slot] = null; this.aux[i] &= ~(1 << slot);
    this.events.push({ t: "book", x: tx, y: ty });
    return true;
  };
  /** Stärke des Verzauberungstisch-Bonus: gemeißelte Regale zählen wie Bücherregale, wenn sie Bücher tragen (siehe sandbox-brew.js) */

  // ---------- Schilder ----------
  P.signLines = function (x, y) { const e = this.ents.get(key(x, y)); return e && e.t === "sign" ? e.l.slice() : null; };
  P.signSet = function (x, y, lines) {
    const t = this.tile(x, y);
    if (t !== B.SIGN && t !== B.HSIGN) return false;
    let e = this.ents.get(key(x, y)); if (!e || e.t !== "sign") { e = this._newEnt("sign"); this.ents.set(key(x, y), e); }
    e.l = Array.from({ length: 4 }, (_, i) => String((lines || [])[i] || "").replace(/[\u0000-\u001f]/g, "").slice(0, 15));
    this.events.push({ t: "signset", x, y });
    return true;
  };

  // ---------- Lagerfeuer ----------
  P._campUse = function (tx, ty, s) {
    if (!s || !isFoodSmelt(s.id)) return false;
    const k = key(tx, ty); let e = this.ents.get(k);
    if (!e) { e = this._newEnt("camp"); this.ents.set(k, e); }
    if (e.s[0]) return false;
    e.s[0] = this.newStack(s.id, 1, s.d); e.cook = 0;
    this._consumeSel(); this.events.push({ t: "camp", x: tx, y: ty });
    return true;
  };
  const baseFurnaces = P._furnaces;
  P._furnaces = function (dt) {
    baseFurnaces.call(this, dt);
    for (const [k, e] of this.ents) {
      if (e.t !== "camp") continue;
      const [x, y] = k.split(",").map(Number);
      if (this.tile(x, y) !== B.CAMPFIRE) { if (e.s[0]) this.dropStack(e.s[0], x + 0.5, y + 0.5, true); this.ents.delete(k); continue; }
      if (!e.s[0]) continue;
      e.cook += dt;
      if (e.cook >= CAMP_TIME) {
        const res = SMELT[e.s[0].id]; e.s[0] = null; e.cook = 0;
        if (res) { this.dropFrom(res[0], 1, x, y - 1); this.events.push({ t: "smelted" }); }
      }
    }
  };

  // ---------- Honigflasche ----------
  const baseEat = P.eat;
  P.eat = function () {
    const s = this.selStack(), it = s && ITEMS[s.id], back = it && it.returns;
    const ok = baseEat.call(this);
    if (ok && back) this._give(this.newStack(back, 1));
    return ok;
  };

  // ---------- Schleim, Honig: Hüpfen, Bremsen, Kleben ----------
  const baseBody = P._body;
  P._body = function (b, dt, grav) {
    baseBody.call(this, b, dt, grav);
    const cx = Math.floor(b.x + b.w / 2), fy = Math.floor(b.y + b.h + 0.08);
    if (b.landV > 0) {
      const under = this.tile(cx, fy);
      if (under === B.SLIME && !(b === this.player && this.input.down)) {
        if (b.landV > 4.5) { b.vy = -b.landV * 0.78; b.onGround = false; b.bounceT = 0.9; this.events.push({ t: "bounce", x: cx, y: fy }); }
        b.landV = 0;
      } else if (under === B.HONEY) b.landV *= 0.2;
    }
    if (!b.onGround && b.vy > 1.6 && b.w) {                               // an Honig kleben: langsam hinabrutschen
      const l = this.tile(Math.floor(b.x - 0.05), Math.floor(b.y + b.h * 0.5)), r = this.tile(Math.floor(b.x + b.w + 0.05), Math.floor(b.y + b.h * 0.5));
      if (l === B.HONEY || r === B.HONEY) { b.vy = 1.6; b.landV = 0; }
    }
  };
  const baseSlow = P._slowFactor;
  P._slowFactor = function (b) {
    let f = baseSlow.call(this, b);
    if (b.onGround && this.tile(Math.floor(b.x + b.w / 2), Math.floor(b.y + b.h + 0.08)) === B.HONEY) f *= BLOCKS[B.HONEY].slow;
    return f;
  };
  const basePlayer = P._player;
  P._player = function (dt) {
    const p = this.player, was = p.onGround, honey = was && this.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h + 0.08)) === B.HONEY;
    const v0 = p.vy, cut = p.bounceT > 0 && !this.input.jump && v0 < -5;
    basePlayer.call(this, dt);
    if (cut) p.vy -= 60 * dt;                                             // Sprung vom Schleim wird nicht durch kurzes Tippen gekappt
    if (p.bounceT > 0) { p.bounceT -= dt; if (p.vy >= 0) p.bounceT = 0; }
    if (honey && p.vy < -5) p.vy *= 0.55;                                 // auf Honig springt man nur halb so hoch
  };

  // ---------- Betonpulver ----------
  const waterNear = (e, x, y) => e.tile(x - 1, y) === B.WATER || e.tile(x + 1, y) === B.WATER || e.tile(x, y - 1) === B.WATER || e.tile(x, y + 1) === B.WATER || e.tile(x, y) === B.WATER;
  P._harden = function (x, y) {
    if (this.tile(x, y) !== B.POWDER) return false;
    const i = y * W + x, a = this.aux[i] & 15;
    this.setTile(x, y, B.CONCRETE); this.aux[i] = a;
    this.events.push({ t: "hiss", x, y });
    return true;
  };
  const baseFall = P._sandFall;
  P._sandFall = function (x, y) {
    if (this.tile(x, y) !== B.POWDER) return baseFall.call(this, x, y);
    const a = this.aux[y * W + x] & 15;
    let moved = false;
    if (waterNear(this, x, y)) { this._harden(x, y); return; }
    while (this.tile(x, y) === B.POWDER && y + 1 < H - 2 && !BLOCKS[this.tile(x, y + 1)].solid) {
      const below = this.tile(x, y + 1);
      if (below === B.TORCH || below === B.LADDER) break;
      this.setTile(x, y, B.AIR); this.setTile(x, y + 1, B.POWDER); this.aux[(y + 1) * W + x] = a; y++; moved = true;
      if (waterNear(this, x, y)) { this._harden(x, y); break; }
    }
    if (moved) this.events.push({ t: "sand", x, y });
  };

  // ---------- Halt: nichts schwebt ----------
  const baseSettle = P._settle;
  P._settle = function (x, y) {
    baseSettle.call(this, x, y);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy, id = this.tile(nx, ny);
      if (id < FIRST9 || id > LAST9) continue;
      let bad = false;
      if (id === B.CANDLE || id === B.CANDLE_LIT || id === B.ARMOR_STAND || id === B.DOORM_B || id === B.DOORM_BO) bad = !solid(this, nx, ny + 1);
      else if (id === B.BANNER || id === B.SIGN || isTrap(id)) bad = !(solid(this, nx - 1, ny) || solid(this, nx + 1, ny) || solid(this, nx, ny + 1) || solid(this, nx, ny - 1));
      else if (id === B.HSIGN) bad = !(solid(this, nx, ny - 1) || solid(this, nx - 1, ny) || solid(this, nx + 1, ny));
      if (bad) this._break(nx, ny, false);
      else if (id === B.POWDER && !solid(this, nx, ny + 1)) this._sandFall(nx, ny);
    }
  };

  // ---------- Abbauen: Türen, Banner, Gegenstand je Zusatzfeld ----------
  const baseBreak = P._break;
  P._break = function (x, y, byPlayer) {
    const id = this.tile(x, y);
    if (isDoorM(id)) {
      const bot = id === B.DOORM_B || id === B.DOORM_BO ? y : y + 1, aux = this.aux[bot * W + x];
      const tool = this.heldTool(), harvest = true;
      this.setTile(x, bot - 1, B.AIR); this.setTile(x, bot, B.AIR);
      if (!this._noDrops && harvest) { const it = itemOf9(B.DOORM_B, aux); if (it) this.dropFrom(it, 1, x, bot); }
      if (byPlayer) { this.stats.mined++; if (tool.type) this._wear(this.inv, this.sel, 1); }
      this.events.push({ t: "break", x, y: bot, id }); this._settle(x, bot);
      return;
    }
    if (id === B.BANNER) {
      const e = this.ents.get(key(x, y)), c = this.aux[y * W + x] & 15, p = e && e.p ? e.p.map(q => q.slice()) : [];
      baseBreak.call(this, x, y, byPlayer);
      if (!this._noDrops) this.dropStack(this._bannerStack(c, p), x + 0.5, y + 0.5, true);
      return;
    }
    return baseBreak.call(this, x, y, byPlayer);
  };
  const baseSpecial = P._specialDrops;
  P._specialDrops = function (id, aux, harvest, fortune) {
    if (id >= FIRST9 && id <= LAST9) {
      if (id === B.BANNER) return [];
      const it = itemOf9(id, aux);
      if (it) return [[it, 1]];
    }
    return baseSpecial ? baseSpecial.call(this, id, aux, harvest, fortune) : null;
  };

  // ---------- Steinsäge ----------
  P.stoneOptions = function () { const s = this.grid[0]; return s && STONECUT[s.id] ? STONECUT[s.id] : []; };
  P.stoneTake = function (i) {
    const s = this.grid[0], o = this.stoneOptions()[i];
    if (!s || !o) return false;
    s.n--; if (s.n <= 0) this.grid[0] = null;
    this._give(this.newStack(o[0], o[1]));
    this.events.push({ t: "stonecut" });
    return true;
  };

  // ---------- Webstuhl ----------
  P.loomCan = function (pat) {
    const b = this.grid[0], d = this.grid[1];
    if (!b || !d || !ITEMS[b.id] || ITEMS[b.id].banner == null || !hasTag(d.id, "dye")) return false;
    if (!(pat >= 0 && pat < LOOM_PATTERNS.length)) return false;
    return (b.bp ? b.bp.p.length : 0) < MAX_LAYERS;
  };
  P.loomApply = function (pat) {
    if (!this.loomCan(pat)) return false;
    const b = this.grid[0], d = this.grid[1], bp = b.bp ? { c: b.bp.c, p: b.bp.p.map(q => q.slice()) } : { c: ITEMS[b.id].banner, p: [] };
    bp.p.push([pat, ITEMS[d.id].col | 0]);
    const out = this.newStack(b.id, 1); out.bp = bp;
    b.n--; if (b.n <= 0) this.grid[0] = null;
    d.n--; if (d.n <= 0) this.grid[1] = null;
    this._give(out);
    this.events.push({ t: "loom" });
    return true;
  };

  // ---------- Schleifstein ----------
  const enchSum = s => (s && s.e ? Object.values(s.e).reduce((t, v) => t + v, 0) : 0);
  /** Vorschau: { out, xp } oder null */
  P.grindPreview = function () {
    const a = this.grid[0], b = this.grid[1], s = a || b;
    if (!s || (a && b && a === b)) return null;
    const ia = a && ITEMS[a.id], ib = b && ITEMS[b.id];
    if (a && b) {
      if (a.id !== b.id || !ia.dur) return null;
      const rem = (ia.dur - (a.d | 0)) + (ib.dur - (b.d | 0)) + Math.floor(ia.dur * 0.05), d = Math.max(0, ia.dur - rem);
      return { out: this.newStack(a.id, 1, d), xp: (enchSum(a) + enchSum(b)) * 2 };
    }
    if (!s.e || !Object.keys(s.e).length) return null;
    const out = this.newStack(s.id, 1, s.d); delete out.e; delete out.r;
    if (s.id === "enchanted_book") out.id = "book";
    return { out, xp: enchSum(s) * 2 };
  };
  P.grindTake = function (toInv) {
    const pv = this.grindPreview(); if (!pv) return false;
    if (!toInv && this.cursor) return false;
    for (const k of [0, 1]) { const s = this.grid[k]; if (s) { s.n--; if (s.n <= 0) this.grid[k] = null; } }
    this._takeOut(pv.out, toInv);
    if (pv.xp > 0) this.addXp(pv.xp);
    this.events.push({ t: "grind" });
    return true;
  };
  P._takeOut = function (out, toInv) {
    if (toInv || this.cursor) { this._give(out); return; }
    this.cursor = out;
  };

  // ---------- Schmiedetisch (Verzierungen) ----------
  P.smithPreview = function () {
    const t = this.grid[0], a = this.grid[1], m = this.grid[2];
    if (!t || !a || !m) return null;
    const ti = ITEMS[t.id], ai = ITEMS[a.id];
    if (ti.trim == null) return { error: "template" };
    if (!ai.armor || ai.mat === "elytra") return { error: "armor" };
    const mi = TRIM_MAT_IDS.indexOf(m.id);
    if (mi < 0) return { error: "material" };
    const out = this.newStack(a.id, 1, a.d, a); out.tr = [ti.trim, mi];
    return { out };
  };
  P.smithTake = function (toInv) {
    const pv = this.smithPreview(); if (!pv || !pv.out) return false;
    if (!toInv && this.cursor) return false;
    for (const k of [0, 1, 2]) { const s = this.grid[k]; if (s) { s.n--; if (s.n <= 0) this.grid[k] = null; } }
    this._takeOut(pv.out, toInv);
    this.events.push({ t: "smith" });
    return true;
  };
  const baseCanPut = P.canPut;
  P.canPut = function (area, idx, st) {
    const k = this.win && this.win.kind, it = ITEMS[st.id];
    if (area === "grid" && k === "stonecut") return idx === 0 && !!STONECUT[st.id];
    if (area === "grid" && k === "loom") return idx === 0 ? it.banner != null : idx === 1 && hasTag(st.id, "dye");
    if (area === "grid" && k === "grind") return idx < 2 && (!!it.dur || st.id === "enchanted_book");
    if (area === "grid" && k === "smith") return idx === 0 ? it.trim != null : idx === 1 ? !!it.armor && it.mat !== "elytra" : idx === 2 && TRIM_MAT_IDS.includes(st.id);
    return baseCanPut.call(this, area, idx, st);
  };
  const baseClick = P.click;
  P.click = function (area, idx, right = false) {
    if (area === "out" && this.win && (this.win.kind === "smith" || this.win.kind === "grind")) { if (this.win.kind === "smith") this.smithTake(false); else this.grindTake(false); return; }
    return baseClick.call(this, area, idx, right);
  };
  const baseShift = P.shiftClick;
  P.shiftClick = function (area, idx) {
    const k = this.win && this.win.kind;
    if (area === "out" && (k === "smith" || k === "grind")) { if (k === "smith") this.smithTake(true); else this.grindTake(true); return; }
    if (area === "inv" && (k === "stonecut" || k === "smith" || k === "loom" || k === "grind")) {
      const s = this.inv[idx]; if (!s) return;
      const it = ITEMS[s.id];
      let from = 0, to = 0;
      if (k === "stonecut") { from = 0; to = 1; }
      else if (k === "loom") { if (it.banner != null) { from = 0; to = 1; } else if (hasTag(s.id, "dye")) { from = 1; to = 2; } }
      else if (k === "grind") { from = 0; to = 2; }
      else if (k === "smith") { if (it.trim != null) { from = 0; to = 1; } else if (it.armor) { from = 1; to = 2; } else if (TRIM_MAT_IDS.includes(s.id)) { from = 2; to = 3; } }
      if (to > from) { const rest = this._insert(this.grid, s.id, s.n, s.d, from, to, s); if (rest < s.n) { s.n = rest; if (rest <= 0) this.inv[idx] = null; return; } }
    }
    return baseShift.call(this, area, idx);
  };

  // ---------- Wachstum und Pflege (zusammen mit den Pflanzen) ----------
  const baseFarm = P._farmStep;
  P._farmStep = function (dt) {
    baseFarm.call(this, dt);
    if (this.dim) return;
    this.powT = (this.powT ?? 1) - dt; this.oxT = (this.oxT ?? 2) - dt;
    if (this.powT <= 0) {
      this.powT = 1;
      const p = this.player, cx = Math.floor(p.x + p.w / 2);
      for (let x = Math.max(1, cx - 40); x <= Math.min(W - 2, cx + 40); x++) for (let y = 3; y < H - 3; y++) if (this.tiles[y * W + x] === B.POWDER) { if (waterNear(this, x, y)) this._harden(x, y); else if (!solid(this, x, y + 1)) this._sandFall(x, y); }
      // Daten ohne Block (Wasser hat ein Schild weggespült …) aufräumen
      for (const [k, e] of this.ents) {
        const t = e.t; if (t !== "sign" && t !== "banner" && t !== "stand" && t !== "cbook") continue;
        const [x, y] = k.split(",").map(Number), id = this.tile(x, y);
        const ok = t === "sign" ? id === B.SIGN || id === B.HSIGN : t === "banner" ? id === B.BANNER : t === "stand" ? id === B.ARMOR_STAND : id === B.CBOOKSHELF;
        if (!ok) { for (const st of e.s) if (st) this.dropStack(st, x + 0.5, y + 0.5, true); this.ents.delete(k); }
      }
    }
    if (this.oxT <= 0) { this.oxT = 2; this._oxidize(); }
  };
}
