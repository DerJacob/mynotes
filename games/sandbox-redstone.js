// =====================================================================
// Blockdorf – Redstone in 2D (Etappe 4)
//   Quellen:    Hebel, Knopf (1 s), Druckplatte (Spieler, Tiere, Gegenstände), Redstone-Block, Redstone-Fackel
//   Leitung:    Redstone-Staub (Stärke 15 → 0, je Block −1), steigt und fällt Stufen wie in Minecraft
//   Verbraucher: Kolben (schiebt bis zu 12 Blöcke, der klebrige zieht einen zurück), Spender, Lampe
//   Fackel:     liegt an einem Block (unten, links oder rechts) und ist AUS, wenn dieser Block unter Strom steht
// Alles läuft im Takt von 0,1 s (ein Redstone-Tick). Der Zustand steht im Zusatzfeld aux der Welt:
//   Staub = Stärke · Fackel = Befestigung (0 unten, 1 links, 2 rechts) · Hebel = an | Befestigung<<1 (0 unten, 1 links, 2 rechts, 3 oben)
//   Knopf = Restzeit (Ticks) | Befestigung<<4 · Platte = gedrückt · Kolben/Spender = Richtung (0 rechts, 1 links, 2 oben, 3 unten) | 4 (ausgefahren / ausgelöst)
// =====================================================================
import { B, BLOCKS, ITEMS, RS_IDS, isFluid } from "./sandbox-data.js?v=10";

export const RS_TICK = 0.1;
export const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1]];
const ATT = [[0, 1], [-1, 0], [1, 0], [0, -1]];            // Befestigung: unten, links, rechts, oben → Lage des tragenden Blocks relativ zum Bauteil
const PUSH_MAX = 12;
const NO_CONDUCT = new Set([B.GLASS, B.ICE, B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.JUNGLE_LEAVES, B.ACACIA_LEAVES, B.CACTUS, B.PISTON_HEAD]);

export function installRedstone(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const stk = (id, n = 1) => ({ id, n, d: 0 });

  P._rsInit = function () {
    this.rs = new Set();
    for (let i = 0; i < this.tiles.length; i++) if (RS_IDS.has(this.tiles[i])) this.rs.add(i);
    this.rsAcc = 0;
    this.rsTicks = 0;
  };
  /** Wird von setTile aufgerufen: Bauteile merken bzw. vergessen */
  P._rsTouch = function (x, y, old, nu) {
    const i = y * W + x;
    if (RS_IDS.has(nu)) this.rs.add(i); else if (RS_IDS.has(old)) this.rs.delete(i);
  };

  const solidAt = (self, x, y) => BLOCKS[self.tile(x, y)].solid;
  const conductor = (self, x, y) => { const t = self.tile(x, y); return BLOCKS[t].solid && !NO_CONDUCT.has(t); };
  const isOn = (self, x, y) => {
    const t = self.tile(x, y), a = x >= 0 && x < W && y >= 0 && y < H ? self.aux[y * W + x] : 0;
    switch (t) {
      case B.LEVER: return !!(a & 1);
      case B.BUTTON: return (a & 15) > 0;
      case B.PLATE: return a === 1;
      case B.RS_BLOCK: case B.RS_TORCH: return true;
      default: return false;
    }
  };
  /** Gibt Strom an alle vier Nachbarn (Staub, Kolben, Lampen …) */
  const directSource = (self, x, y) => isOn(self, x, y);
  /** Tragender Block eines Bauteils */
  const attachOf = (self, x, y) => {
    const t = self.tile(x, y), a = self.aux[y * W + x];
    if (t === B.LEVER) { const [dx, dy] = ATT[(a >> 1) & 3]; return [x + dx, y + dy]; }
    if (t === B.BUTTON) { const [dx, dy] = ATT[(a >> 4) & 3]; return [x + dx, y + dy]; }
    if (t === B.RS_TORCH || t === B.RS_TORCH_OFF) { const [dx, dy] = ATT[a & 3]; return [x + dx, y + dy]; }
    if (t === B.PLATE || t === B.RS_WIRE) return [x, y + 1];
    return null;
  };
  const wireLevel = (self, x, y) => (self.tile(x, y) === B.RS_WIRE ? self.aux[y * W + x] : 0);

  /** Block (bx,by) steht "fest" unter Strom: Hebel/Knopf/Platte daran, Fackel darunter */
  P._rsStrong = function (bx, by) {
    if (!conductor(this, bx, by)) return false;
    for (const [dx, dy] of DIRS) {
      const nx = bx + dx, ny = by + dy, t = this.tile(nx, ny);
      if ((t === B.LEVER || t === B.BUTTON) && isOn(this, nx, ny)) { const a = attachOf(this, nx, ny); if (a && a[0] === bx && a[1] === by) return true; }
      else if (t === B.PLATE && isOn(this, nx, ny) && ny === by - 1 && nx === bx) return true;
      else if (t === B.RS_TORCH && nx === bx && ny === by + 1) return true;           // Fackel unter dem Block
    }
    return false;
  };
  /** Block steht unter Strom (auch schwach durch Staub oben oder daneben) */
  P._rsWeak = function (bx, by) {
    if (this._rsStrong(bx, by)) return true;
    if (!conductor(this, bx, by)) return false;
    return wireLevel(this, bx, by - 1) > 0 || wireLevel(this, bx - 1, by) > 0 || wireLevel(this, bx + 1, by) > 0;
  };
  /** Bekommt ein Verbraucher (Kolben, Spender, Lampe) Strom? */
  P._rsMechPower = function (x, y) {
    if (this._rsWeak(x, y)) return true;
    if (wireLevel(this, x, y - 1) > 0 || wireLevel(this, x - 1, y) > 0 || wireLevel(this, x + 1, y) > 0) return true;
    for (const [dx, dy] of DIRS) if (this.tile(x + dx, y + dy) === B.RS_BLOCK) return true;
    return false;
  };
  P._rsDirectIn = function (x, y) {
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, t = this.tile(nx, ny);
      if ((t === B.LEVER || t === B.BUTTON || t === B.PLATE || t === B.RS_BLOCK) && directSource(this, nx, ny)) return true;
      if (t === B.RS_TORCH) return true;
      if (this._rsStrong(nx, ny)) return true;
    }
    return false;
  };
  /** Staub: Nachbarn, mit denen er verbunden ist */
  const wireLinks = (self, x, y, out) => {
    out.length = 0;
    for (const dx of [-1, 1]) {
      if (self.tile(x + dx, y) === B.RS_WIRE) out.push((y) * W + x + dx);
      if (!solidAt(self, x + dx, y) && self.tile(x + dx, y + 1) === B.RS_WIRE) out.push((y + 1) * W + x + dx);
      if (!solidAt(self, x, y - 1) && self.tile(x + dx, y - 1) === B.RS_WIRE) out.push((y - 1) * W + x + dx);
    }
    return out;
  };

  P._rsWires = function () {
    const buckets = Array.from({ length: 16 }, () => []), lv = new Map(), wires = [], links = [];
    for (const i of this.rs) if (this.tiles[i] === B.RS_WIRE) {
      wires.push(i);
      if (this._rsDirectIn(i % W, (i / W) | 0)) { lv.set(i, 15); buckets[15].push(i); }
    }
    for (let L = 15; L >= 2; L--) {
      const list = buckets[L];
      for (let k = 0; k < list.length; k++) {
        const i = list[k]; if (lv.get(i) !== L) continue;
        for (const j of wireLinks(this, i % W, (i / W) | 0, links)) if ((lv.get(j) || 0) < L - 1) { lv.set(j, L - 1); buckets[L - 1].push(j); }
      }
    }
    for (const i of wires) { const nl = lv.get(i) || 0; if (this.aux[i] !== nl) this.aux[i] = nl; }
  };

  // ---------- Takt ----------
  P._rsStep = function (dt) {
    if (!this.rs.size) { this.rsAcc = 0; return; }
    this.rsAcc += dt;
    let guard = 0;
    while (this.rsAcc >= RS_TICK && guard++ < 4) { this.rsAcc -= RS_TICK; this._rsTick(); }
    if (this.rsAcc > RS_TICK * 4) this.rsAcc = 0;
  };
  const bodies = self => [self.player, ...self.mobs, ...self.villagers, ...self.drops];
  P._rsTick = function () {
    this.rsTicks++;
    const list = [...this.rs];
    // 1) Platten und Knöpfe
    let bs = null;
    for (const i of list) {
      const t = this.tiles[i], x = i % W, y = (i / W) | 0;
      if (t === B.PLATE) {
        bs = bs || bodies(this);
        const on = bs.some(b => b.x < x + 1 && b.x + b.w > x && b.y + b.h > y + 0.75 && b.y < y + 1 && !(b.age !== undefined && b.age < 0));
        if (on !== (this.aux[i] === 1)) { this.aux[i] = on ? 1 : 0; this.events.push({ t: "rs", k: "plate", on, x, y }); }
      } else if (t === B.BUTTON) {
        const a = this.aux[i];
        if ((a & 15) > 0) { this.aux[i] = (a & 0xf0) | ((a & 15) - 1); if ((a & 15) === 1) this.events.push({ t: "rs", k: "button", on: false, x, y }); }
      }
    }
    // 2) Fackeln (eine Stufe verzögert → Uhren möglich)
    for (const i of list) {
      const t = this.tiles[i];
      if (t !== B.RS_TORCH && t !== B.RS_TORCH_OFF) continue;
      const x = i % W, y = (i / W) | 0, a = attachOf(this, x, y);
      const lit = !this._rsWeak(a[0], a[1]);
      if (lit !== (t === B.RS_TORCH)) { this.tiles[i] = lit ? B.RS_TORCH : B.RS_TORCH_OFF; this.lightDirty = true; }
    }
    // 3) Staub
    this._rsWires();
    // 4) Verbraucher
    for (const i of list) {
      const t = this.tiles[i];
      if (t !== B.PISTON && t !== B.STICKY && t !== B.DISPENSER && t !== B.LAMP && t !== B.LAMP_ON) continue;
      const x = i % W, y = (i / W) | 0, pw = this._rsMechPower(x, y);
      if (t === B.PISTON || t === B.STICKY) {
        const ext = !!(this.aux[i] & 4);
        if (pw && !ext) this._pistonExtend(x, y);
        else if (!pw && ext) this._pistonRetract(x, y);
      } else if (t === B.DISPENSER) {
        const latched = !!(this.aux[i] & 4);
        if (pw && !latched) { this.aux[i] |= 4; this._dispense(x, y); }
        else if (!pw && latched) this.aux[i] &= 3;
      } else if (t === B.LAMP && pw) { this.tiles[i] = B.LAMP_ON; this.aux[i] = 0; this.lightDirty = true; this.events.push({ t: "rs", k: "lamp", on: true, x, y }); }
      else if (t === B.LAMP_ON) {
        if (pw) this.aux[i] = 0;
        else if (++this.aux[i] >= 3) { this.tiles[i] = B.LAMP; this.aux[i] = 0; this.lightDirty = true; this.events.push({ t: "rs", k: "lamp", on: false, x, y }); }
      }
    }
  };

  // ---------- Bedienen ----------
  P._rsLever = function (x, y) {
    const i = y * W + x;
    this.aux[i] ^= 1;
    this.events.push({ t: "rs", k: "lever", on: !!(this.aux[i] & 1), x, y });
    this.addExh(0.005);
    return true;
  };
  P._rsButton = function (x, y) {
    const i = y * W + x, a = this.aux[i];
    if ((a & 15) > 0) return true;
    this.aux[i] = (a & 0xf0) | 10;
    this.events.push({ t: "rs", k: "button", on: true, x, y });
    return true;
  };

  // ---------- Setzen ----------
  const dirToward = (self, tx, ty) => {
    const p = self.player, dx = tx + 0.5 - (p.x + p.w / 2), dy = ty + 0.5 - (p.y + p.h / 2);
    if (Math.abs(dx) >= Math.abs(dy) * 1.2) return dx >= 0 ? 0 : 1;
    return dy < 0 ? 2 : 3;
  };
  P._rsPlace = function (tx, ty, block) {
    const s = this.selStack();
    if (!s || tx < 0 || tx >= W || ty < 2 || ty >= H - 2 || !this.reachOk(tx, ty)) return false;
    const cur = this.tile(tx, ty);
    if (cur !== B.AIR && !this._replaceable(cur)) return false;
    let aux = 0;
    const att = order => { for (const k of order) { const [dx, dy] = ATT[k]; if (conductor(this, tx + dx, ty + dy) || solidAt(this, tx + dx, ty + dy)) return k; } return -1; };
    switch (block) {
      case B.RS_WIRE: case B.PLATE: if (!solidAt(this, tx, ty + 1) || isFluid(this.tile(tx, ty + 1))) return false; break;
      case B.RS_TORCH: { const k = att([0, 1, 2]); if (k < 0) return false; aux = k; break; }
      case B.LEVER: { const k = att([0, 1, 2, 3]); if (k < 0) return false; aux = k << 1; break; }
      case B.BUTTON: { const k = att([1, 2, 0, 3]); if (k < 0) return false; aux = k << 4; break; }
      case B.PISTON: case B.STICKY: case B.DISPENSER:
        if (!this._supported(tx, ty)) return false;
        aux = dirToward(this, tx, ty);
        break;
      default: return false;
    }
    if (BLOCKS[block].solid) {
      const over = b => b.x < tx + 1 && b.x + b.w > tx && b.y < ty + 1 && b.y + b.h > ty;
      if (over(this.player) || this.villagers.some(over) || this.mobs.some(over)) return false;
    }
    this.setTile(tx, ty, block);
    this.aux[ty * W + tx] = aux;
    if (BLOCKS[block].entity) this.ents.set(`${tx},${ty}`, this._newEnt(BLOCKS[block].entity));
    this._consumeSel();
    this.stats.built++;
    this.events.push({ t: "place", x: tx, y: ty, id: block });
    return true;
  };
  P._replaceable = function (id) { return id === B.FLOWER || id === B.TALLGRASS || id === B.DEADBUSH; };

  /** Nach einer Änderung in der Nachbarschaft: fällt das Bauteil ab? */
  P._rsSettle = function (x, y, id) {
    let need = true, drop = null;
    switch (id) {
      case B.RS_WIRE: need = solidAt(this, x, y + 1); drop = "redstone"; break;
      case B.PLATE: need = solidAt(this, x, y + 1); drop = "pressure_plate"; break;
      case B.RS_TORCH: case B.RS_TORCH_OFF: { const a = attachOf(this, x, y); need = solidAt(this, a[0], a[1]); drop = "redstone_torch"; break; }
      case B.LEVER: { const a = attachOf(this, x, y); need = solidAt(this, a[0], a[1]); drop = "lever"; break; }
      case B.BUTTON: { const a = attachOf(this, x, y); need = solidAt(this, a[0], a[1]); drop = "button"; break; }
      default: return false;
    }
    if (need) return false;
    this.setTile(x, y, B.AIR);
    this.dropFrom(drop, 1, x, y);
    this.events.push({ t: "break", x, y, id });
    this._settle(x, y);
    return true;
  };
  /** Vor dem Abbauen: Kolbenarm und Kolben gehören zusammen */
  P._rsBreak = function (x, y, id, aux) {
    if (id === B.PISTON_HEAD) {
      const [dx, dy] = DIRS[aux & 3], bt = this.tile(x - dx, y - dy);
      if (bt === B.PISTON || bt === B.STICKY) this.aux[(y - dy) * W + x - dx] &= 3;
    } else if ((id === B.PISTON || id === B.STICKY) && (aux & 4)) {
      const [dx, dy] = DIRS[aux & 3];
      if (this.tile(x + dx, y + dy) === B.PISTON_HEAD) this.setTile(x + dx, y + dy, B.AIR);
    }
  };

  // ---------- Kolben ----------
  const pushable = (self, x, y, t) => {
    if (!BLOCKS[t].solid || BLOCKS[t].hard === Infinity || BLOCKS[t].entity || t === B.OBSIDIAN || t === B.PISTON_HEAD || t === B.ENCHANT) return false;
    if ((t === B.PISTON || t === B.STICKY) && (self.aux[y * W + x] & 4)) return false;
    return true;
  };
  const crushable = t => t === B.AIR || isFluid(t) || (!BLOCKS[t].solid && !(t >= B.DOOR_B && t <= B.DOOR_TO) && t !== B.BED);
  P._pistonExtend = function (x, y) {
    const i = y * W + x, id = this.tiles[i], a = this.aux[i], dir = a & 3, [dx, dy] = DIRS[dir];
    const line = [];
    let cx = x + dx, cy = y + dy, end = null;
    for (let n = 0; n <= PUSH_MAX; n++) {
      if (cy < 2 || cy >= H - 2 || cx < 1 || cx >= W - 1) return false;
      const t = this.tile(cx, cy);
      if (crushable(t)) { end = [cx, cy]; break; }
      if (!pushable(this, cx, cy, t) || n === PUSH_MAX) return false;
      line.push([cx, cy, t, this.aux[cy * W + cx]]);
      cx += dx; cy += dy;
    }
    if (!end) return false;
    const et = this.tile(end[0], end[1]);
    if (et !== B.AIR) { if (isFluid(et)) this.setTile(end[0], end[1], B.AIR); else this._break(end[0], end[1], false); }
    for (let k = line.length - 1; k >= 0; k--) {
      const [px, py, t, au] = line[k];
      this.setTile(px + dx, py + dy, t); this.aux[(py + dy) * W + px + dx] = au;
      this.setTile(px, py, B.AIR);
    }
    this.setTile(x + dx, y + dy, B.PISTON_HEAD);
    this.aux[(y + dy) * W + x + dx] = dir | (id === B.STICKY ? 4 : 0);
    this.aux[i] = a | 4;
    this._rsPushBodies(x + dx, y + dy, line.length + 1, dx, dy);
    for (const [px, py] of line) this._settle(px + dx, py + dy);
    this.events.push({ t: "rs", k: "piston", on: true, x, y });
    return true;
  };
  P._pistonRetract = function (x, y) {
    const i = y * W + x, id = this.tiles[i], a = this.aux[i], dir = a & 3, [dx, dy] = DIRS[dir];
    this.aux[i] = a & 3;
    if (this.tile(x + dx, y + dy) === B.PISTON_HEAD) this.setTile(x + dx, y + dy, B.AIR);
    if (id === B.STICKY) {
      const t = this.tile(x + 2 * dx, y + 2 * dy);
      if (t !== B.AIR && pushable(this, x + 2 * dx, y + 2 * dy, t)) {
        const au = this.aux[(y + 2 * dy) * W + x + 2 * dx];
        this.setTile(x + 2 * dx, y + 2 * dy, B.AIR); this.setTile(x + dx, y + dy, t); this.aux[(y + dy) * W + x + dx] = au;
      }
    }
    this._settle(x + dx, y + dy);
    this.events.push({ t: "rs", k: "piston", on: false, x, y });
    return true;
  };
  /** Wer im Weg steht, wird mitgeschoben */
  P._rsPushBodies = function (x0, y0, len, dx, dy) {
    for (const b of [this.player, ...this.mobs, ...this.villagers, ...this.drops]) {
      if (!this._hit(b)) continue;
      const ox = b.x, oy = b.y;
      let ok = false;
      for (let k = 1; k <= len + 2 && !ok; k++) {
        b.x = clamp(ox + dx * k, 0, W - b.w); b.y = oy + dy * k;
        if (b.y < 0) b.y = 0;
        if (!this._hit(b)) ok = true;
      }
      if (!ok) {
        b.x = ox; b.y = oy;
        if (b === this.player) { const q = this._safeSpot(ox, oy - 1); b.x = q.x; b.y = q.y; }
      } else if (b === this.player || b.vy !== undefined) { if (dy < 0) b.vy = Math.min(b.vy, -9); else if (dx) b.vx = dx * 8; b.onGround = false; }
    }
  };

  // ---------- Spender ----------
  P._dispense = function (x, y) {
    const ent = this.ents.get(`${x},${y}`); if (!ent) return;
    const a = this.aux[y * W + x], [dx, dy] = DIRS[a & 3], fx = x + dx, fy = y + dy;
    const filled = ent.s.map((s, k) => (s ? k : -1)).filter(k => k >= 0);
    if (!filled.length) { this.events.push({ t: "rs", k: "dry", x, y }); return; }
    const k = filled[Math.floor(this.frng() * filled.length)], s = ent.s[k], front = this.tile(fx, fy);
    const use1 = () => { s.n--; if (s.n <= 0) ent.s[k] = null; };
    const cx = fx + 0.5, cy = fy + 0.5;
    if (s.id === "arrow") {
      use1();
      this.proj.push({ kind: "arrow", x: cx - dx * 0.3, y: cy, vx: dx * 22, vy: dy * 22 - (dx ? 1.5 : 0), dmg: 4, fromPlayer: true, age: 0, stuck: false, stuckT: 0, disp: true });
    } else if (s.id === "splash_potion" || s.id === "lingering_potion") {
      use1();
      this.proj.push({ kind: "potion", x: cx - dx * 0.3, y: cy, vx: dx * 10, vy: dy * 10 - 4, dmg: 0, pot: s.d, ling: s.id === "lingering_potion", fromPlayer: true, age: 0, stuck: false, stuckT: 0 });
    } else if ((s.id === "water_bucket" || s.id === "lava_bucket") && (front === B.AIR || this._softAt(front))) {
      this._setFluid(fy * W + fx, s.id === "water_bucket" ? B.WATER : B.LAVA, 9);
      ent.s[k] = stk("bucket");
      this.events.push({ t: "bucket", fill: false, x: fx, y: fy });
    } else if (s.id === "bucket" && isFluid(front) && this.lvl[fy * W + fx] === 9) {
      const f = front;
      this._clearFluid(fy * W + fx);
      use1(); const full = stk(f === B.WATER ? "water_bucket" : "lava_bucket");
      if (ent.s[k]) { const e2 = ent.s.findIndex(q => !q); if (e2 >= 0) ent.s[e2] = full; else this.dropStack(full, cx, cy, true); } else ent.s[k] = full;
      this.events.push({ t: "bucket", fill: true, x: fx, y: fy });
    } else if (s.id === "bone_meal" && this._fertilizeAt(fx, fy)) {
      use1();
    } else {
      use1();
      this.dropStack({ id: s.id, n: 1, d: s.d, e: s.e }, cx - dx * 0.2, cy, false, dx || 0);
      if (!dx) { const dr = this.drops[this.drops.length - 1]; if (dr) { dr.vx = 0; dr.vy = dy * 6 - (dy ? 0 : 2); dr.age = -0.4; } }
    }
    this.events.push({ t: "rs", k: "disp", x, y });
  };
  P._softAt = function (id) { return id !== B.AIR && !BLOCKS[id].solid && !isFluid(id) && id !== B.LADDER && !(id >= B.DOOR_B && id <= B.DOOR_TO) && id !== B.BED; };
}
