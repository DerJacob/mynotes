// =====================================================================
// Blockdorf – Landwirtschaft, Tierzucht und Angeln (Etappe 4)
//   Hacke macht aus Erde/Gras Ackerland · Ackerland ist feucht, wenn Wasser höchstens 4 Blöcke entfernt ist
//   Weizen, Karotten, Kartoffeln, Kürbis- und Melonenstängel, Zuckerrohr, Netherwarze · Knochenmehl
//   Tiere füttern → Liebe → Baby (wächst nach 2,5 Minuten heran) · Angeln mit Beute, Müll und Schätzen
// Gewachsen wird nur in Spielernähe (±48 Blöcke) und nur bei Licht (Stufe 9) – wie in Minecraft, nur schneller.
// =====================================================================
import { B, BLOCKS, ITEMS, isCrop, isPlant, colorItem } from "./sandbox-data.js?v=7";
import { mulberry32 } from "./sandbox-noise.js?v=7";
import { MOBS } from "./sandbox-mobs.js?v=7";

const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const GROW_RANGE = 48;
/** Wachstumschance je Sekunde und Stufe */
export const GROW = { wet: 0.05, dry: 0.02, cane: 0.04, wart: 0.03, fruit: 0.15 };
export const BABY_TIME = 150, LOVE_TIME = 20, BREED_COOLDOWN = 60;
/** Was Tiere fressen, um sich zu paaren */
const BREED_FOOD = {
  cow: ["wheat"], sheep: ["wheat"], pig: ["carrot", "potato", "golden_carrot"], chicken: ["wheat_seeds", "pumpkin_seeds", "melon_seeds"],
  rabbit: ["carrot", "golden_carrot", "flower"], wolf: ["raw_beef", "steak", "raw_porkchop", "cooked_porkchop", "raw_chicken", "cooked_chicken", "raw_mutton", "cooked_mutton", "raw_rabbit", "cooked_rabbit", "rotten_flesh"], cat: ["raw_cod", "raw_salmon", "raw_chicken"]
};
const SOIL = id => id === B.DIRT || id === B.GRASS || id === B.GRASS_SNOW || id === B.FARMLAND;
const CANE_BASE = id => id === B.GRASS || id === B.DIRT || id === B.SAND || id === B.GRASS_SNOW;
const TICKED = new Set([B.FARMLAND, B.WHEAT, B.CARROT, B.POTATO, B.PUMPKIN_STEM, B.MELON_STEM, B.CANE, B.WART]);

export function installFarm(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1) => ({ id, n, d: 0 });
  const cxOf = m => m.x + m.w / 2;
  const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

  P._farmInit = function () {
    this.frng = mulberry32((this.seed ^ 0x2b7e) + Math.floor(this.time * 1000));   // eigener Zufall: Wachstum ändert nichts am übrigen Weltgeschehen
    this.farmT = 1;
    this.fish = null;
  };

  // ---------- Boden und Stützen ----------
  P.wetFarmland = function (x, y) {
    for (let dx = -4; dx <= 4; dx++) { if (this.tile(x + dx, y) === B.WATER || this.tile(x + dx, y - 1) === B.WATER) return true; }
    return false;
  };
  /** Steht die Pflanze auf einem passenden Untergrund? */
  P._cropOk = function (x, y) {
    const id = this.tile(x, y), below = this.tile(x, y + 1);
    if (id === B.CANE) return below === B.CANE || (CANE_BASE(below) && (this.tile(x - 1, y + 1) === B.WATER || this.tile(x + 1, y + 1) === B.WATER));
    if (id === B.WART) return below === B.SOUL_SAND;
    return below === B.FARMLAND;
  };
  P._cropBreak = function (x, y) { this._break(x, y, false); };

  // ---------- Hacke ----------
  /** Hacke auf Erde/Gras: Ackerland. Man kann den Boden oder die Luft darüber anklicken. */
  P._till = function (tx, ty) {
    let y = ty;
    if (this.tile(tx, y) === B.AIR || isPlant(this.tile(tx, y))) y = ty + 1;
    const t = this.tile(tx, y);
    if (t !== B.DIRT && t !== B.GRASS && t !== B.GRASS_SNOW) return false;
    const above = this.tile(tx, y - 1);
    if (above !== B.AIR && !isPlant(above)) return false;
    if (isPlant(above)) this.setTile(tx, y - 1, B.AIR);
    this.setTile(tx, y, B.FARMLAND);
    this.aux[y * W + tx] = this.wetFarmland(tx, y) ? 1 : 0;
    this._wear(this.inv, this.sel, 1);
    this.events.push({ t: "till", x: tx, y });
    return true;
  };

  // ---------- Pflanzen ----------
  P._plant = function (tx, ty) {
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (!it || !it.put || it.put[0] !== "plant") return false;
    const blk = it.put[1];
    // Man darf den Boden oder die Luft darüber anklicken
    if (BLOCKS[this.tile(tx, ty)].solid && this.tile(tx, ty - 1) === B.AIR) ty -= 1;
    const cur = this.tile(tx, ty);
    if (cur !== B.AIR && !isPlant(cur)) return false;
    if (!this.reachOk(tx, ty) || ty < 2) return false;
    this.setTile(tx, ty, blk);
    if (!this._cropOk(tx, ty)) { this.setTile(tx, ty, cur === B.AIR ? B.AIR : cur); return false; }
    this._consumeSel();
    this.stats.built++;
    this.events.push({ t: "place", x: tx, y: ty, id: blk });
    return true;
  };

  // ---------- Knochenmehl ----------
  /** Knochenmehl an einer Stelle: Pflanzen wachsen, auf Gras sprießen Blumen. true = hat gewirkt. */
  P._fertilizeAt = function (tx, ty) {
    let y = ty, id = this.tile(tx, y);
    if (id === B.FARMLAND && isCrop(this.tile(tx, y - 1))) { y -= 1; id = this.tile(tx, y); }
    if (isCrop(id) && id !== B.CANE) {
      const max = id === B.WART ? 3 : 7, a = this.aux[y * W + tx];
      if (a >= max && id !== B.PUMPKIN_STEM && id !== B.MELON_STEM) return false;
      const add = id === B.WART ? 1 : 2 + Math.floor(this.frng() * 4);
      this.aux[y * W + tx] = Math.min(max, a + add);
      this.events.push({ t: "grow", x: tx, y });
      if (a + add >= max && (id === B.PUMPKIN_STEM || id === B.MELON_STEM)) this._fruit(tx, y, true);
      return true;
    }
    // Gras: Blumen und hohes Gras ringsum
    const gy = id === B.GRASS ? y : (id === B.AIR && this.tile(tx, y + 1) === B.GRASS ? y + 1 : -1);
    if (gy < 0) return false;
    for (let k = 0; k < 9; k++) {
      const x = tx + Math.floor(this.frng() * 7) - 3;
      for (let yy = gy - 4; yy <= gy + 4; yy++) {
        if (this.tile(x, yy) === B.GRASS && this.tile(x, yy - 1) === B.AIR) { this.setTile(x, yy - 1, this.frng() < 0.75 ? B.TALLGRASS : B.FLOWER); break; }
      }
    }
    this.events.push({ t: "grow", x: tx, y: gy });
    return true;
  };
  P._fertilize = function (tx, ty) {
    const s = this.selStack(); if (!s || s.id !== "bone_meal") return false;
    if (!this._fertilizeAt(tx, ty)) return false;
    this._consumeSel();
    return true;
  };

  // ---------- Wachstum ----------
  /** Reifer Kürbis-/Melonenstängel setzt eine Frucht links oder rechts daneben */
  P._fruit = function (x, y, force) {
    const id = this.tile(x, y), fruit = id === B.PUMPKIN_STEM ? B.PUMPKIN : B.MELON;
    if (this.tile(x - 1, y) === fruit || this.tile(x + 1, y) === fruit) return false;
    if (!force && this.frng() >= GROW.fruit) return false;
    const sides = this.frng() < 0.5 ? [-1, 1] : [1, -1];
    for (const d of sides) {
      const fx = x + d;
      if (this.tile(fx, y) === B.AIR && SOIL(this.tile(fx, y + 1))) { this.setTile(fx, y, fruit); this.events.push({ t: "place", x: fx, y, id: fruit }); return true; }
    }
    return false;
  };
  P._farmStep = function (dt) {
    this.farmT -= dt;
    if (this.farmT > 0) return;
    this.farmT = 1;
    const p = this.player, cx = Math.floor(p.x + p.w / 2);
    const x0 = Math.max(1, cx - GROW_RANGE), x1 = Math.min(W - 2, cx + GROW_RANGE);
    const tiles = this.tiles, aux = this.aux, r = this.frng;
    for (let x = x0; x <= x1; x++) {
      for (let y = 2; y < H - 2; y++) {
        const id = tiles[y * W + x];
        if (id < B.FARMLAND || id > B.WART || !TICKED.has(id)) continue;
        const i = y * W + x;
        if (id === B.FARMLAND) {
          const wet = this.wetFarmland(x, y);
          aux[i] = wet ? 1 : 0;
          const up = tiles[i - W];
          if (BLOCKS[up].solid) this.setTile(x, y, B.DIRT);
          else if (!wet && !isCrop(up) && r() < 0.1) this.setTile(x, y, B.DIRT);
          continue;
        }
        if (!this._cropOk(x, y)) { this._cropBreak(x, y); continue; }
        if (id === B.CANE) {
          if (tiles[i - W] !== B.AIR) continue;
          let h = 1; while (this.tile(x, y + h) === B.CANE) h++;
          if (h < 3 && r() < GROW.cane) this.setTile(x, y - 1, B.CANE);
          continue;
        }
        if (id === B.WART) { if (aux[i] < 3 && r() < GROW.wart) aux[i]++; continue; }
        // Weizen, Karotte, Kartoffel, Stängel brauchen Licht
        if (this.lightAt(x, y) < 9) continue;
        if (aux[i] < 7) { if (r() < (aux[i + W] === 1 ? GROW.wet : GROW.dry)) aux[i]++; }
        else if (id === B.PUMPKIN_STEM || id === B.MELON_STEM) this._fruit(x, y, false);
      }
    }
  };

  // ---------- Ernte ----------
  /** Besondere Beute beim Abbauen: [[Gegenstand, Anzahl], …] oder null (dann gilt BLOCKS[id].drop) */
  P._specialDrops = function (id, aux, harvest, fortune = 0) {
    const r = this.frng, n = (a, b) => a + Math.floor(r() * (b - a + 1));
    if (BLOCKS[id].colored) return [[colorItem(BLOCKS[id].colored, aux & 15), 1]];
    switch (id) {
      case B.WHEAT: return aux >= 7 ? [["wheat", 1], ["wheat_seeds", n(0, 3 + fortune)]] : [["wheat_seeds", 1]];
      case B.CARROT: return [["carrot", aux >= 7 ? n(2, 5 + fortune) : 1]];
      case B.POTATO: return [["potato", aux >= 7 ? n(2, 5 + fortune) : 1]];
      case B.PUMPKIN_STEM: return [["pumpkin_seeds", n(0, aux >= 7 ? 2 : 1)]];
      case B.MELON_STEM: return [["melon_seeds", n(0, aux >= 7 ? 2 : 1)]];
      case B.WART: return [["nether_wart", aux >= 3 ? n(2, 4 + fortune) : 1]];
      case B.TALLGRASS: return r() < 0.125 ? [["wheat_seeds", 1]] : [];
      case B.MELON: return [["melon_slice", Math.min(9, n(3, 7 + fortune))]];
      default: return null;
    }
  };

  // ---------- Tierzucht ----------
  P._feed = function (m, s) {
    const foods = BREED_FOOD[m.type]; if (!foods || !s || !foods.includes(s.id)) return false;
    if ((m.type === "wolf" || m.type === "cat") && !m.tamed) return false;
    if (m.type === "wolf" && m.hp < m.maxHp) return false;           // zuerst heilen (siehe mobUse)
    if (m.baby > 0) { m.baby = Math.max(1, m.baby - m.baby * 0.1); this._consumeSel(); this.events.push({ t: "love", x: cxOf(m), y: m.y, grow: true }); return true; }
    if (m.love > 0 || m.bcd > 0) return false;
    m.love = LOVE_TIME; this._consumeSel();
    this.events.push({ t: "love", x: cxOf(m), y: m.y });
    return true;
  };
  P._loveAI = function (m, d, dt) {
    if (m.bcd > 0) m.bcd -= dt;
    if (m.baby > 0) { m.baby -= dt; if (m.baby <= 0) this._grow(m); return false; }
    if (!(m.love > 0)) return false;
    m.love -= dt;
    let mate = null, bd = 12;
    for (const o of this.mobs) {
      if (o === m || o.dead || o.type !== m.type || !(o.love > 0) || o.baby > 0) continue;
      const dist = Math.abs(cxOf(o) - cxOf(m)) + Math.abs(o.y - m.y) * 2;
      if (dist < bd) { mate = o; bd = dist; }
    }
    if (!mate) return false;
    if (touching(m, mate, 0.5)) { this._breed(m, mate); return false; }
    const dir = sgn(cxOf(mate) - cxOf(m));
    if (m.onGround && this._cliffAhead(m, dir)) return false;
    this._steer(m, dir, d.speed * 0.9, dt);
    return true;
  };
  P._breed = function (a, b) {
    a.love = b.love = 0; a.bcd = b.bcd = BREED_COOLDOWN;
    const d = MOBS[a.type], x = (cxOf(a) + cxOf(b)) / 2, floor = Math.max(a.y + a.h, b.y + b.h);
    const baby = this.spawnMob(a.type, x - d.w * 0.275, floor);
    baby.w = d.w * 0.55; baby.h = d.h * 0.55; baby.y = floor - baby.h - 0.001; baby.baby = BABY_TIME; baby.eggT = 600;
    if (a.tamed && b.tamed) { baby.tamed = true; baby.maxHp = baby.hp = a.type === "wolf" ? 20 : 10; }
    this.addXp(1 + Math.floor(this.mrng() * 7));
    this.events.push({ t: "baby", x, y: baby.y });
  };
  P._grow = function (m) {
    const d = MOBS[m.type], feet = m.y + m.h;
    const w = m.w, h = m.h;
    m.w = d.w; m.h = d.h; m.x -= (d.w - w) / 2; m.y = feet - d.h - 0.001; m.baby = 0;
    if (this._hit(m)) {
      let ok = false; const y0 = m.y;
      for (const up of [0.1, 0.3, 0.6, 1, 1.5, 2]) { m.y = y0 - up; if (!this._hit(m)) { ok = true; break; } }
      if (!ok) { m.w = w; m.h = h; m.y = feet - h - 0.001; m.baby = 10; }
    }
  };

  // ---------- Angeln ----------
  const FISH = [["raw_cod", 62], ["raw_salmon", 25], ["pufferfish", 13]];
  const JUNK = ["stick", "string", "bone", "leather", "rotten_flesh", "feather"];
  P._rodStack = function () { const s = this.selStack(); return s && s.id === "fishing_rod" ? s : null; };
  /** Rechtsklick mit der Angel: auswerfen oder einholen */
  P._rodUse = function (tx, ty) {
    if (this.fish) return this._reel();
    // Wasseroberfläche an der angeklickten Stelle suchen
    let y = ty;
    if (this.tile(tx, y) !== B.WATER) { for (let k = 1; k <= 3 && this.tile(tx, y) !== B.WATER; k++) y = ty + k; }
    if (this.tile(tx, y) !== B.WATER) return false;
    while (this.tile(tx, y - 1) === B.WATER) y--;
    const lure = ((this._rodStack().e || {}).lure) | 0;
    this.fish = { x: tx + 0.5, y, st: 0, t: Math.max(1.5, 5 + this.frng() * 15 - lure * 4), bt: 0, age: 0 };
    this.events.push({ t: "cast", x: tx + 0.5, y });
    return true;
  };
  P._reel = function () {
    const f = this.fish; this.fish = null;
    if (!f) return false;
    if (f.st !== 1) { this.events.push({ t: "reel", item: null }); return true; }
    const rod = this._rodStack(), luck = rod ? ((rod.e || {}).luck_of_the_sea) | 0 : 0, r = this.frng;
    const treasure = r() < 0.05 + 0.01 * luck, junk = !treasure && r() < Math.max(0, 0.10 - 0.02 * luck);
    let st;
    if (treasure) {
      const k = r();
      if (k < 0.4) st = this._randomBook ? this._randomBook(30, true) : stk("book");
      else if (k < 0.7) { st = stk("bow"); if (this._enchantStack) this._enchantStack(st, 20 + Math.floor(r() * 10)); }
      else { st = stk("fishing_rod"); if (this._enchantStack) this._enchantStack(st, 20 + Math.floor(r() * 10)); }
      st.d = Math.floor(r() * (ITEMS[st.id].dur || 1) * 0.5);
    } else if (junk) {
      st = stk(JUNK[Math.floor(r() * JUNK.length)], 1);
    } else {
      let q = r() * FISH.reduce((a, [, w]) => a + w, 0), id = FISH[0][0];
      for (const [k, w] of FISH) { q -= w; if (q < 0) { id = k; break; } }
      st = stk(id, 1);
    }
    const p = this.player;
    this.dropStack(st, f.x, f.y + 0.5, false);
    // der Fang fliegt zum Spieler
    const last = this.drops[this.drops.length - 1];
    if (last) { last.vx = clamp((p.x + p.w / 2 - f.x) * 2.2, -9, 9); last.vy = -7; last.age = 0; }
    if (rod) this._wear(this.inv, this.sel, 1);
    this.addXp(1 + Math.floor(r() * 6));
    this.addExh(0.01);
    this.events.push({ t: "reel", item: st.id, x: f.x, y: f.y, treasure });
    return true;
  };
  P._fishStep = function (dt) {
    const f = this.fish; if (!f) return;
    const p = this.player;
    f.age += dt;
    if (!this._rodStack() || this.win || Math.hypot(f.x - (p.x + p.w / 2), f.y - (p.y + p.h / 2)) > 13 || this.tile(Math.floor(f.x), f.y) !== B.WATER) { this.fish = null; this.events.push({ t: "reel", item: null }); return; }
    if (f.st === 0) {
      f.t -= dt;
      if (f.t <= 0) { f.st = 1; f.bt = 1.3; this.events.push({ t: "bite", x: f.x, y: f.y }); }
    } else {
      f.bt -= dt;
      if (f.bt <= 0) { f.st = 0; f.t = 3 + this.frng() * 8; }
    }
  };
}
