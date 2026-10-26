// =====================================================================
// Blockdorf – Pflanzenregeln der Etappe 8
//   Pulverschnee (langsam, weiche Landung), hängende Blöcke (Tropfstein, Höhlenranken), Leuchtflechte,
//   Bambus (wächst), Höhlenranken (wachsen nach unten, tragen Glühbeeren), Mangrovenschössling und Knochenmehl.
// Wird in sandbox-engine.js eingebunden und hängt sich an bestehende Methoden (Muster wie in den früheren Etappen).
// =====================================================================
import { B, BLOCKS, ITEMS, isHang, isAttach, bambooBase, isPlant } from "./sandbox-data.js?v=9";
import { mulberry32 } from "./sandbox-noise.js?v=9";
import { mangroveTree } from "./sandbox-trees8.js?v=9";

const GROW = { bamboo: 0.045, vine: 0.04, berry: 0.12, range: 36 };
export function installFlora(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;

  P._floraInit = function () { this.flrng = mulberry32((this.seed ^ 0x8f10) + Math.floor(this.time * 1000)); this.floraT = 1; };

  // ---------- Pulverschnee ----------
  P._inBlock = function (b, id) {
    const x0 = Math.floor(b.x), x1 = Math.floor(b.x + b.w - 1e-6), y0 = Math.floor(b.y), y1 = Math.floor(b.y + b.h - 1e-6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.tile(x, y) === id) return true;
    return false;
  };
  /** 1 = normal, kleiner = langsamer (Pulverschnee) */
  P._slowFactor = function (b) { return this._inBlock(b, B.POWDER_SNOW) ? BLOCKS[B.POWDER_SNOW].slow : 1; };
  const baseBody = P._body;
  P._body = function (b, dt, grav) {
    const ps = this._inBlock(b, B.POWDER_SNOW);
    if (ps) { b.vx *= Math.max(0, 1 - 7 * dt); if (b.vy > 2.2) b.vy = 2.2; }
    baseBody.call(this, b, dt, grav);
    if (ps) b.landV = 0;
  };

  // ---------- Halt beim Bauen ----------
  /** Darf der Block hier stehen? (nur für die Etappe-8-Blöcke; sonst null) */
  P._floraOk = function (id, x, y) {
    if (id === B.BAMBOO) return bambooBase(this.tile(x, y + 1));
    if (isHang(id)) { const up = this.tile(x, y - 1); return BLOCKS[up].solid || (id === B.STALACTITE ? up === B.STALACTITE : (up === B.CAVE_VINES || up === B.CAVE_VINES_BERRIES)); }
    if (isAttach(id)) return BLOCKS[this.tile(x - 1, y)].solid || BLOCKS[this.tile(x + 1, y)].solid || BLOCKS[this.tile(x, y + 1)].solid || BLOCKS[this.tile(x, y - 1)].solid;
    if (id === B.PROPAGULE) { const b = this.tile(x, y + 1); return b === B.MUD || b === B.DIRT || b === B.GRASS || b === B.MOSS_BLOCK || b === B.CLAY || b === B.SAND; }
    if (isPlant(id) && id >= B.STALAGMITE) return BLOCKS[this.tile(x, y + 1)].solid;
    return null;
  };
  const baseSupported = P._supported;
  P._supported = function (x, y) {
    const st = this.selStack(), it = st && ITEMS[st.id], id = it && it.block;
    if (id) { const ok = this._floraOk(id, x, y); if (ok !== null) return ok; }
    return baseSupported.call(this, x, y);
  };
  const baseSettle = P._settle;
  P._settle = function (x, y) {
    baseSettle.call(this, x, y);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy, id = this.tile(nx, ny);
      if (id < B.POWDER_SNOW) continue;
      const hang = isHang(id) || isAttach(id) || id === B.BAMBOO;
      if (hang && this._floraOk(id, nx, ny) === false) {
        this.setTile(nx, ny, B.AIR);
        const bd = BLOCKS[id];
        if (bd.drop) this.dropFrom(bd.drop, 1, nx, ny);
        this.events.push({ t: "break", x: nx, y: ny, id });
        this._settle(nx, ny);
      }
    }
  };

  // ---------- Benutzen und Knochenmehl ----------
  const baseUse = P.use;
  P.use = function (tx, ty) {
    if (!this.win && this.reachOk(tx, ty) && this.tile(tx, ty) === B.CAVE_VINES_BERRIES) {
      this.setTile(tx, ty, B.CAVE_VINES);
      const n = 1 + (this.flrng() < 0.4 ? 1 : 0);
      this.dropFrom("glow_berries", n, tx, ty);
      this.events.push({ t: "pick", x: tx, y: ty, id: B.CAVE_VINES_BERRIES });
      return true;
    }
    return baseUse.call(this, tx, ty);
  };
  const baseFert = P._fertilizeAt;
  P._fertilizeAt = function (tx, ty) {
    let y = ty, id = this.tile(tx, y);
    if (id === B.BAMBOO) {
      while (this.tile(tx, y - 1) === B.BAMBOO) y--;
      let grown = 0;
      for (let k = 0; k < 2 + Math.floor(this.flrng() * 3); k++) if (this.tile(tx, y - 1) === B.AIR) { this.setTile(tx, y - 1, B.BAMBOO); y--; grown++; }
      if (grown) this.events.push({ t: "grow", x: tx, y });
      return grown > 0;
    }
    if (id === B.PROPAGULE) {
      const env = { put: (x, yy, b) => this.setTile(x, yy, b), air: (x, yy) => { const t = this.tile(x, yy); return t === B.AIR || isPlant(t); }, rnd: this.flrng };
      this.setTile(tx, y, B.AIR);
      mangroveTree(env, tx, y + 1);
      this.events.push({ t: "grow", x: tx, y });
      return true;
    }
    if (id === B.CAVE_VINES || id === B.CAVE_VINES_BERRIES) {
      let yy = y; while (this.tile(tx, yy + 1) === B.CAVE_VINES || this.tile(tx, yy + 1) === B.CAVE_VINES_BERRIES) yy++;
      if (this.tile(tx, yy + 1) !== B.AIR) return false;
      this.setTile(tx, yy + 1, this.flrng() < 0.3 ? B.CAVE_VINES_BERRIES : B.CAVE_VINES);
      this.events.push({ t: "grow", x: tx, y: yy + 1 });
      return true;
    }
    if (id === B.MOSS_BLOCK || (id === B.AIR && this.tile(tx, y + 1) === B.MOSS_BLOCK)) {
      const gy = id === B.MOSS_BLOCK ? y : y + 1;
      let n = 0;
      for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 2; dy++) {
        const x = tx + dx, yy = gy + dy;
        if (this.tile(x, yy) === B.STONE || this.tile(x, yy) === B.DIRT || this.tile(x, yy) === B.GRASS) { if (this.flrng() < 0.35) { this.setTile(x, yy, B.MOSS_BLOCK); n++; } }
      }
      for (let dx = -3; dx <= 3; dx++) { const x = tx + dx; for (let yy = gy - 2; yy <= gy + 2; yy++) if (this.tile(x, yy) === B.MOSS_BLOCK && this.tile(x, yy - 1) === B.AIR && this.flrng() < 0.4) { this.setTile(x, yy - 1, B.MOSS_CARPET); n++; break; } }
      this.events.push({ t: "grow", x: tx, y: gy });
      return n > 0 || true;
    }
    return baseFert.call(this, tx, ty);
  };

  // ---------- Wachstum ----------
  const baseFarm = P._farmStep;
  P._farmStep = function (dt) {
    baseFarm.call(this, dt);
    this.floraT = (this.floraT ?? 1) - dt;
    if (this.floraT > 0) return;
    this.floraT = 1.5;
    if (this.dim) return;
    if (!this.flrng) this._floraInit();
    const p = this.player, cx = Math.floor(p.x + p.w / 2), x0 = Math.max(1, cx - GROW.range), x1 = Math.min(W - 2, cx + GROW.range), r = this.flrng;
    const tiles = this.tiles;
    for (let x = x0; x <= x1; x++) {
      for (let y = 3; y < H - 3; y++) {
        const id = tiles[y * W + x];
        if (id !== B.BAMBOO && id !== B.CAVE_VINES && id !== B.CAVE_VINES_BERRIES) continue;
        if (id === B.BAMBOO) {
          if (tiles[(y - 1) * W + x] !== B.AIR) continue;
          let h = 1; while (this.tile(x, y + h) === B.BAMBOO) h++;
          if (h < 14 && this.lightAt(x, y) >= 8 && r() < GROW.bamboo) this.setTile(x, y - 1, B.BAMBOO);
        } else if (tiles[(y + 1) * W + x] === B.AIR) {
          let h = 1; while (this.tile(x, y - h) === B.CAVE_VINES || this.tile(x, y - h) === B.CAVE_VINES_BERRIES) h++;
          if (h < 18 && r() < GROW.vine) this.setTile(x, y + 1, r() < GROW.berry * 3 ? B.CAVE_VINES_BERRIES : B.CAVE_VINES);
        }
      }
    }
  };
}
