// =====================================================================
// Blockdorf – Optik für Wetter, Mond und Hilfsanzeigen (Etappe 7)
//   Precip      Regen und Schnee als Teilchen in Weltkoordinaten; nur dort, wo kein Dach darüber ist; Spritzer am Boden
//   moonMask    Mondscheibe mit Phase als kleines Pixelbild (0 = außen, 1 = dunkle Seite, 2 = beleuchtet)
//   boltPath    gezackter Blitz von oben bis zum Boden
// Zeichnen bekommt den Canvas-Kontext und alle Werte als Parameter (Node-testbar mit einem Attrappen-Kontext).
// =====================================================================

import { BLOCKS } from "./sandbox-data.js?v=10";

/** Mondphase 0–7 (0 = Vollmond, 4 = Neumond) als n×n-Raster */
export function moonMask(phase, n = 12) {
  const ph = ((phase % 8) + 8) % 8, waxing = ph > 4;
  const k = Math.cos((waxing ? 8 - ph : ph) * Math.PI / 4);
  const rows = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      const nx = (x + 0.5 - n / 2) / (n / 2), ny = (y + 0.5 - n / 2) / (n / 2), w2 = 1 - ny * ny;
      if (nx * nx + ny * ny > 1 || w2 <= 0) { row.push(0); continue; }
      const w = Math.sqrt(w2);
      const lit = ph === 4 ? false : waxing ? nx > -k * w : nx < k * w;
      row.push(lit ? 2 : 1);
    }
    rows.push(row);
  }
  return rows;
}
export const MOON_CRATERS = [[3, 3], [7, 4], [5, 8], [8, 8], [2, 7]];

/** Mond zeichnen: Mittelpunkt (bx, by), Radius r in Bildschirmpixeln */
export function drawMoon(g, bx, by, r, phase) {
  const n = 12, m = moonMask(phase, n), px = (r * 2) / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = m[y][x]; if (!v) continue;
    const crater = MOON_CRATERS.some(([cx, cy]) => cx === x && cy === y);
    g.fillStyle = v === 2 ? (crater ? "#c4cce6" : "#e9eeff") : "rgba(40,48,84,.55)";
    g.fillRect(Math.round(bx - r + x * px), Math.round(by - r + y * px), Math.ceil(px), Math.ceil(px));
  }
}

/** Blitz: Zickzack von (x, yTop) nach (x, yGround); rng liefert 0…1 */
export function boltPath(x, yTop, yGround, rng) {
  const pts = [[x, yTop]];
  let cx = x, cy = yTop;
  while (cy < yGround) {
    cy = Math.min(yGround, cy + 2 + rng() * 3);
    cx += (rng() - 0.5) * 2.4;
    pts.push([cx, cy]);
  }
  pts[pts.length - 1][0] = x + (pts[pts.length - 1][0] - x) * 0.3;     // am Boden wieder näher am Ziel
  return pts;
}

/** Wettereffekte: Teilchen leben in Weltkoordinaten, gezeichnet wird nur, was im Bild und unter freiem Himmel ist */
export class Precip {
  constructor(rng = Math.random) { this.rng = rng; this.drops = []; this.splash = []; this.time = 0; }
  /**
   * @param game   Engine (weather, tiles, precipAt)
   * @param view   { left, top, vw, vh } sichtbarer Bereich in Blöcken
   */
  update(dt, game, view, W, H, settings = {}) {
    this.time += dt;
    const w = game.weather, on = settings.weatherFx !== false && w && w.k > 0.02 && !game.dim;
    const cols = Math.ceil(view.vw) + 4;
    if (this._cols !== cols || !this._ceil) { this._cols = cols; this._ceil = new Int16Array(cols); }
    for (let i = 0; i < cols; i++) {
      const x = Math.floor(view.left) - 2 + i;
      let y = 0;
      if (x >= 0 && x < W) { y = H; for (let yy = 0; yy < H; yy++) { const id = game.tiles[yy * W + x]; if (id !== 0 && BLOCKS[id].solid) { y = yy; break; } } }
      this._ceil[i] = y;
    }
    const target = on ? Math.round(view.vw * 2.4 * w.k) : 0;
    const x0 = view.left - 3, x1 = view.left + view.vw + 3;
    while (this.drops.length < target) {
      const x = x0 + this.rng() * (x1 - x0);
      this.drops.push({ x, y: view.top - this.rng() * (view.vh + 2), v: 0, s: this.rng() });
    }
    if (target === 0) { this.drops.length = 0; this.splash.length = 0; } else if (this.drops.length > target + 8) this.drops.length = target + 8;
    for (const d of this.drops) {
      const kind = game.precipAt(d.x);
      const ci = Math.floor(d.x) - (Math.floor(view.left) - 2), ceil = ci >= 0 && ci < cols ? this._ceil[ci] : H;
      d.v = kind === "snow" ? 3 + d.s * 2 : 26 + d.s * 8;
      d.y += d.v * dt;
      if (kind === "snow") d.x += Math.sin(this.time * 2 + d.s * 40) * dt * 0.8;
      else d.x -= dt * 5;
      if (d.y >= ceil || d.y > view.top + view.vh + 1) {
        if (d.y >= ceil && kind === "rain" && ceil < H && d.y < view.top + view.vh + 2 && this.splash.length < 120 && this.rng() < 0.6) this.splash.push({ x: d.x, y: ceil, t: 0.25 });
        d.x = x0 + this.rng() * (x1 - x0); d.y = view.top - 1 - this.rng() * 3;
      }
      if (d.x < x0 - 6) d.x += x1 - x0 + 6; else if (d.x > x1 + 6) d.x -= x1 - x0 + 6;
    }
    for (const s of this.splash) s.t -= dt;
    this.splash = this.splash.filter(s => s.t > 0);
  }
  draw(g, game, scr, S, tile) {
    if (!this.drops.length && !this.splash.length) return;
    const w = game.weather, a = Math.min(1, (w ? w.k : 0) * 1.2);
    for (const d of this.drops) {
      if (game.precipAt(d.x) === "snow") {
        const [x, y] = scr(d.x, d.y); g.fillStyle = `rgba(255,255,255,${0.55 + 0.4 * d.s})`; const s = Math.max(2, Math.round(S * (1 + d.s))); g.fillRect(x, y, s, s);
      } else {
        const [x, y] = scr(d.x, d.y); g.fillStyle = `rgba(175,205,255,${0.5 * a + 0.25 * d.s})`; g.fillRect(x, y, Math.max(1, Math.round(S * 0.75)), Math.round(S * (4 + d.s * 3)));
      }
    }
    g.fillStyle = "rgba(190,215,255,.55)";
    for (const s of this.splash) { const [x, y] = scr(s.x, s.y), q = Math.max(1, Math.round(S * (1.4 - s.t * 3))); g.fillRect(x - q, y - q, q, q); g.fillRect(x + q, y - q * 2, q, q); }
  }
}

/** Blitz zeichnen (hell, mit Schein); scr rechnet Weltkoordinaten in Bildschirmpixel um */
export function drawBolt(g, bolt, scr, top, S, rng) {
  if (!bolt) return;
  const pts = boltPath(bolt.x + 0.5, top - 1, bolt.y, bolt._rng || rng);
  g.lineJoin = "miter";
  for (const [lw, col] of [[S * 5, "rgba(190,200,255,.25)"], [S * 2.4, "rgba(235,240,255,.9)"], [Math.max(1, S * 0.9), "#ffffff"]]) {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    pts.forEach(([x, y], i) => { const [sx, sy] = scr(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.stroke();
  }
}

/** Debug-Anzeige (F3) */
export function drawDebug(g, lines, S, cw) {
  g.font = `${Math.max(11, Math.round(3.6 * S))}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = "left"; g.textBaseline = "top";
  const lh = Math.max(14, Math.round(4.6 * S)), w = Math.max(...lines.map(l => g.measureText ? g.measureText(l).width : l.length * 3 * S)) + 6 * S;
  g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(S, 14 * S, w, lines.length * lh + 3 * S);
  g.fillStyle = "#e8f0e8";
  lines.forEach((l, i) => g.fillText(l, 3 * S, 15.5 * S + i * lh));
  void cw;
}
