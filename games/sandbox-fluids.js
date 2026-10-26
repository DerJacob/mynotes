// =====================================================================
// Blockdorf – Wasser und Lava (Etappe 2)
//   Stufen: 9 = Quelle · 8 = fallend · 7…1 = fließend (7 direkt neben der Quelle)
//   Wasser fließt weit (7 Blöcke), Lava langsam und kurz (3 Blöcke). Zwei Wasserquellen daneben → neue Quelle.
//   Wasser + Lava: Lavaquelle → Obsidian, fließende Lava → Bruchstein.
//   Dazu: Schwimmen, Luft anhalten, Lava- und Kaktusschaden, Eimer.
// =====================================================================
import { B, BLOCKS, ITEMS, isFluid, isPlant, isSoft } from "./sandbox-data.js?v=6";

export const SRC = 9, FALL = 8;

export function installFluids(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const WATER_DT = 0.2, LAVA_DT = 0.9;
  const replaceable = id => id === B.AIR || isSoft(id);
  const eff = l => (l >= FALL ? 8 : l);

  P._fluidInit = function () {
    this.fluidSet = new Set();
    this.fluidT = { w: 0, l: 0 };
  };
  /** Zelle (x,y) und ihre Nachbarn zur Neuberechnung vormerken */
  P._fluidWake = function (x, y) {
    const s = this.fluidSet; if (!s) return;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) s.add(ny * W + nx);
    }
  };
  P._setFluid = function (i, id, level) {
    const old = this.tiles[i];
    this.tiles[i] = id; this.lvl[i] = level; this.aux[i] = 0;
    if (this._rsTouch && old !== id) this._rsTouch(i % W, (i / W) | 0, old, id);
    this.lightDirty = true;
    this._fluidWake(i % W, (i / W) | 0);
  };
  P._clearFluid = function (i, id = B.AIR) {
    const old = this.tiles[i];
    this.tiles[i] = id; this.lvl[i] = 0; this.aux[i] = 0;
    if (this._rsTouch && old !== id) this._rsTouch(i % W, (i / W) | 0, old, id);
    this.lightDirty = true;
    this._fluidWake(i % W, (i / W) | 0);
  };
  P.fluidAt = function (x, y) { const t = this.tile(x, y); return isFluid(t) ? t : 0; };
  P.fluidLevel = function (x, y) { return x < 0 || x >= W || y < 0 || y >= H ? 0 : this.lvl[y * W + x]; };

  /** Ist (x,y) für Flüssigkeit f ein "Loch" (kann noch Flüssigkeit aufnehmen)? */
  const isHole = (self, x, y, f) => {
    if (y >= H) return false;
    const t = self.tile(x, y);
    if (replaceable(t)) return true;
    return t === f;                                  // gleiche Flüssigkeit darunter: sie fließt dort weiter nach unten
  };

  /** Eine Zelle für Flüssigkeit f neu berechnen. */
  P._fluidCell = function (i, f) {
    const x = i % W, y = (i / W) | 0, t = this.tiles[i];
    if (x <= 0 || x >= W - 1 || y <= 0 || y >= H - 2) return;
    const other = f === B.WATER ? B.LAVA : B.WATER;
    // Treffen Wasser und Lava aufeinander?
    if (f === B.LAVA && t === B.LAVA) {
      const wet = this.tile(x, y - 1) === B.WATER || this.tile(x - 1, y) === B.WATER || this.tile(x + 1, y) === B.WATER;
      if (wet) { this._clearFluid(i, this.lvl[i] === SRC ? B.OBSIDIAN : B.COBBLE); this.events.push({ t: "hiss", x, y }); return; }
    }
    if (f === B.WATER && t === B.WATER) {
      // Wasser fließt auf Lava darunter oder daneben
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0]]) {
        const ni = (y + dy) * W + (x + dx);
        if (this.tiles[ni] === B.LAVA) { this._clearFluid(ni, this.lvl[ni] === SRC ? B.OBSIDIAN : B.COBBLE); this.events.push({ t: "hiss", x: x + dx, y: y + dy }); }
      }
    }
    if (t === f && this.lvl[i] === SRC) return;                      // Quellen bleiben
    if (!(replaceable(t) || t === f)) return;
    if (t === other) return;
    const decay = f === B.LAVA ? 2 : 1;
    let want = 0, src = false;
    if (this.tile(x, y - 1) === f) want = FALL;                       // von oben nachfließend
    else {
      let srcN = 0;
      for (const dx of [-1, 1]) {
        const nx = x + dx, ni = y * W + nx;
        if (this.tiles[ni] !== f) continue;
        const nl = this.lvl[ni];
        const canSide = nl === SRC || !isHole(this, nx, y + 1, f);   // wer unten weiterfließen kann, fließt nicht zur Seite
        if (!canSide) continue;
        if (nl === SRC) srcN++;
        want = Math.max(want, eff(nl) - decay);
      }
      if (f === B.WATER && srcN >= 2) {
        const b = this.tile(x, y + 1);
        if (BLOCKS[b].solid || (b === B.WATER && this.lvl[(y + 1) * W + x] === SRC)) { want = SRC; src = true; }
      }
    }
    if (f === B.LAVA && want > 0 && (this.tile(x, y - 1) === B.WATER || this.tile(x - 1, y) === B.WATER || this.tile(x + 1, y) === B.WATER)) {
      this._clearFluid(i, B.COBBLE); this.events.push({ t: "hiss", x, y }); return;
    }
    if (f === B.WATER && want > 0 && (this.tile(x, y + 1) === B.LAVA)) { this._clearFluid((y + 1) * W + x, this.lvl[(y + 1) * W + x] === SRC ? B.OBSIDIAN : B.COBBLE); this.events.push({ t: "hiss", x, y: y + 1 }); }
    if (want > 0) {
      if (t !== f || this.lvl[i] !== want) { if (t === B.TORCH) this.events.push({ t: "break", x, y, id: t }); this._setFluid(i, f, want); }
    } else if (t === f) this._clearFluid(i);                          // Zufluss weg → versiegt
    // Fließt nach unten weiter (Loch unter einer Fluid-Zelle)
  };

  P._fluidStep = function (dt) {
    const s = this.fluidSet; if (!s || !s.size) { if (s) { this.fluidT.w = 0; this.fluidT.l = 0; } return; }
    this.fluidT.w += dt; this.fluidT.l += dt;
    const doW = this.fluidT.w >= WATER_DT, doL = this.fluidT.l >= LAVA_DT;
    if (!doW && !doL) return;
    if (doW) this.fluidT.w = 0;
    if (doL) this.fluidT.l = 0;
    const cur = [...s]; s.clear();
    let n = 0;
    for (const i of cur) {
      if (n++ > 6000) { s.add(i); continue; }
      const t = this.tiles[i];
      const near = f => { const x = i % W, y = (i / W) | 0; return t === f || this.tile(x, y - 1) === f || this.tile(x - 1, y) === f || this.tile(x + 1, y) === f; };
      let keep = false;
      if (doW) { if (near(B.WATER)) this._fluidCell(i, B.WATER); } else if (near(B.WATER)) keep = true;
      if (doL) { if (near(B.LAVA)) this._fluidCell(i, B.LAVA); } else if (near(B.LAVA)) keep = true;
      if (keep) s.add(i);
    }
  };

  // ---------- Körper in Flüssigkeit ----------
  P.fluidOf = function (b, k = 0.5) { return this.fluidAt(Math.floor(b.x + b.w / 2), Math.floor(b.y + b.h * k)); };

  /** Luft, Ertrinken, Lava, Kaktus – für den Spieler */
  P._playerFluids = function (dt) {
    const p = this.player;
    const body = this.fluidOf(p, 0.5), feet = this.fluidOf(p, 0.9), head = this.fluidAt(Math.floor(p.x + p.w / 2), Math.floor(p.y + 0.25));
    p.inWater = body === B.WATER || feet === B.WATER;
    p.inLava = body === B.LAVA || feet === B.LAVA;
    if (p.air === undefined) p.air = 15;
    if (head === B.WATER && !(this.fx && this.fx.water_breathing)) {
      p.air -= dt;
      if (p.air <= 0) { p.air += 1; this.hurt(2, 0, "drown"); }
    } else p.air = Math.min(15, p.air + dt * 6);
    if (p.inLava) {
      p.burn = this.fx && this.fx.fire_resistance ? 0 : 4; p.lavaT = (p.lavaT || 0) - dt;
      if (p.lavaT <= 0) { p.lavaT = 0.5; p.invuln = 0; this.hurt(4, 0, "lava"); }
    } else if (p.burn > 0) {
      if (p.inWater) p.burn = 0;
      else {
        p.burn -= dt; p.burnT = (p.burnT || 0) - dt;
        if (p.burnT <= 0) { p.burnT = 1; this.hurt(1, 0, "fire"); }
      }
    }
    // Kaktus
    p.cactusT = (p.cactusT || 0) - dt;
    if (p.cactusT <= 0) {
      const x0 = Math.floor(p.x - 0.08), x1 = Math.floor(p.x + p.w + 0.08), y0 = Math.floor(p.y + 0.1), y1 = Math.floor(p.y + p.h - 0.1);
      let touch = false;
      for (let y = y0; y <= y1 && !touch; y++) for (let x = x0; x <= x1; x++) if (this.tile(x, y) === B.CACTUS) { touch = true; break; }
      if (touch) { p.cactusT = 0.5; p.invuln = 0; this.hurt(1, 0, "cactus"); }
    }
  };

  /** Eimer: leer → Quelle aufnehmen; voll → Quelle setzen. Liefert true, wenn etwas geschah. */
  P.useBucket = function (tx, ty) {
    const s = this.selStack();
    if (!s) return false;
    const id = this.tile(tx, ty), i = ty * W + tx;
    if (s.id === "bucket") {
      if (isFluid(id) && this.lvl[i] === SRC) {
        const full = id === B.WATER ? "water_bucket" : "lava_bucket";
        this._clearFluid(i);
        s.n--; if (s.n <= 0) this.inv[this.sel] = null;
        this.add(full, 1, 0, true);
        this.events.push({ t: "bucket", fill: true, x: tx, y: ty });
        return true;
      }
      return false;
    }
    if (s.id === "water_bucket" && this.dim === 1) {                  // im Nether verdampft das Wasser
      this.inv[this.sel] = this.newStack("bucket", 1); this.events.push({ t: "hiss", x: tx, y: ty });
      return true;
    }
    if (s.id === "water_bucket" || s.id === "lava_bucket") {
      const f = s.id === "water_bucket" ? B.WATER : B.LAVA;
      if (!replaceable(id) && !(isFluid(id) && (id !== f || this.lvl[i] !== SRC))) return false;
      if (ty < 2 || ty >= H - 2) return false;
      const p = this.player;
      if (p.x < tx + 1 && p.x + p.w > tx && p.y < ty + 1 && p.y + p.h > ty && f === B.LAVA) { /* in Lava-Eimer-Block stehen ist erlaubt */ }
      const was = id;
      this.lvl[i] = 0; this.tiles[i] = B.AIR;
      const other = f === B.WATER ? B.LAVA : B.WATER;
      if (was === other) this._clearFluid(i, f === B.WATER ? (this.lvl[i] === SRC ? B.OBSIDIAN : B.COBBLE) : B.OBSIDIAN);
      else this._setFluid(i, f, SRC);
      this.inv[this.sel] = { id: "bucket", n: 1, d: 0 };
      this.events.push({ t: "bucket", fill: false, x: tx, y: ty });
      return true;
    }
    return false;
  };
}
