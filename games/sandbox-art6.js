// =====================================================================
// Blockdorf – Grafik der Etappe 6: Farben, Treppen und Halbblöcke, Kissen, Dappled Forest, Camps, Arbeitsblöcke, Karten.
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit.
// Gefärbte Blöcke (Wolle, Beton und ihre Formen) werden je Farbe einmal gemalt und zwischengespeichert,
// damit der Atlas nicht 16-mal größer wird.
// =====================================================================
import { B, COLORS, ITEMS, boxesOf, BLOCKS } from "./sandbox-data.js?v=6";
import { mulberry32 } from "./sandbox-noise.js?v=6";

export const T6 = 16;
/** Spalte im Atlas für Blöcke 102…125 (die Spalten 120… gehören schon älteren Zusatzbildern) */
export const COL6 = id => 200 + (id - B.CONCRETE);
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const COLOR_RGB = COLORS.map(c => hexRgb(c[2]));
const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

export function paintAtlas6(paint, noise, specks) {
  const px = (set, x, y, w, h, c, a = 255) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, a); };
  const P = id => COL6(id);
  // Platzhalter für die gefärbten Blöcke (Teilchenfarbe beim Abbauen)
  for (const id of [B.CONCRETE, B.WOOL_STAIRS, B.WOOL_SLAB, B.CONC_STAIRS, B.CONC_SLAB, B.CUSHION]) paint(P(id), (set, r) => { for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise([200, 200, 196], 12, r)); });

  // ---------- Strohbett ----------
  paint(P(B.STRAW_BED), (set, r) => {
    px(set, 0, 11, 16, 5, [150, 110, 62]); px(set, 0, 11, 16, 1, [186, 142, 82]); px(set, 0, 15, 16, 1, [104, 74, 40]);
    for (let x = 0; x < 16; x++) for (let y = 7; y < 11; y++) set(x, y, noise([218, 186, 82], 26, r));
    for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 16), y = 6 + Math.floor(r() * 5); set(x, y, [240, 214, 120]); set(x + 1, y + 1, [176, 142, 52]); }
    px(set, 1, 5, 6, 3, [236, 232, 220]); px(set, 1, 5, 6, 1, [255, 255, 250]); px(set, 1, 7, 6, 1, [200, 196, 186]);
  });
  // ---------- Pappel ----------
  paint(P(B.POPLAR_LOG), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) {
      const stripe = (x * 3 + (y >> 2) * 5) % 7 === 0;
      set(x, y, noise(stripe ? [196, 186, 164] : [214, 206, 186], 14, r));
    }
    for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 13), y = Math.floor(r() * 14); px(set, x, y, 2 + (i % 3), 1, [64, 58, 52]); if (i % 2) set(x + 1, y + 1, [92, 84, 72]); }
    for (let y = 0; y < 16; y++) { set(0, y, [168, 158, 136]); set(15, y, [160, 150, 128]); }
  });
  const leaves = (id, base, dark, light) => paint(P(id), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise(base, 22, r));
    for (let i = 0; i < 26; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), dark);
    for (let i = 0; i < 14; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), light);
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); set(x, y, [20, 12, 8], 255); }
  });
  leaves(B.PLEAVES_R, [176, 46, 34], [112, 26, 22], [226, 96, 60]);
  leaves(B.PLEAVES_O, [216, 114, 26], [150, 70, 18], [250, 170, 60]);
  leaves(B.PLEAVES_Y, [228, 186, 40], [168, 126, 20], [252, 232, 110]);
  // ---------- Laubstreu: flacher Haufen am Boden ----------
  const litter = (id, cols) => paint(P(id), (set, r) => {
    for (let x = 0; x < 16; x++) {
      const h = 1 + Math.floor((Math.sin(x * 1.3 + id) * 0.5 + 0.5) * 2.4 + r() * 1.2);
      for (let k = 0; k < h; k++) set(x, 15 - k, noise(cols[(x + k) % cols.length], 16, r));
    }
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 15); set(x, 12, cols[i % cols.length]); set(x + 1, 13, cols[(i + 1) % cols.length]); }
    for (let x = 0; x < 16; x += 4) set(x + 1, 14, [92, 56, 30]);
  });
  litter(B.LITTER_R, [[176, 46, 34], [140, 34, 26], [206, 74, 44]]);
  litter(B.LITTER_O, [[216, 114, 26], [180, 84, 20], [244, 148, 44]]);
  litter(B.LITTER_Y, [[228, 186, 40], [190, 146, 28], [250, 214, 80]]);
  // ---------- Roter Busch ----------
  paint(P(B.RED_BUSH), (set, r) => {
    const rows = [[6, 4, 9], [4, 5, 11], [2, 6, 13], [1, 7, 14], [1, 8, 14], [1, 9, 14], [2, 10, 13], [3, 11, 12], [4, 12, 11], [6, 13, 9]];
    for (const [y, a, b] of rows) for (let x = a; x < a + b - 0 && x < 16; x++) if (x - a < b) set(x, y + 2, noise([48, 98, 34], 24, r));
    for (let i = 0; i < 14; i++) { const x = 2 + Math.floor(r() * 12), y = 5 + Math.floor(r() * 9); set(x, y, [34, 74, 24]); }
    for (let i = 0; i < 12; i++) { const x = 2 + Math.floor(r() * 11), y = 6 + Math.floor(r() * 8); set(x, y, [208, 38, 44]); set(x + 1, y, [150, 20, 30]); if (i % 3 === 0) set(x, y, [255, 110, 110]); }
    px(set, 7, 14, 2, 2, [92, 60, 32]);
  });
  // ---------- Schirmpilz ----------
  paint(P(B.PARASOL), (set, r) => {
    px(set, 7, 8, 2, 8, [232, 220, 196]); px(set, 7, 8, 1, 8, [250, 242, 222]); px(set, 8, 12, 1, 4, [196, 180, 152]);
    const cap = [[5, 3, 6], [3, 4, 10], [1, 5, 14], [0, 6, 16], [1, 7, 14]];
    for (const [a, y, w] of cap) for (let x = a; x < a + w; x++) set(x, y, noise([186, 142, 102], 18, r));
    for (const [x, y] of [[4, 5], [8, 4], [11, 6], [6, 7], [13, 6], [2, 6]]) set(x, y, [226, 196, 156]);
    for (const [x, y] of [[5, 6], [9, 6], [12, 7], [3, 7]]) set(x, y, [132, 94, 62]);
    px(set, 1, 7, 14, 1, [120, 84, 54]); px(set, 6, 3, 4, 1, [212, 172, 130]);
  });
  // ---------- Lagerfeuer (Flammen werden beim Zeichnen ergänzt) ----------
  paint(P(B.CAMPFIRE), (set, r) => {
    px(set, 1, 13, 14, 3, [58, 38, 22]); px(set, 1, 13, 14, 1, [112, 76, 44]);
    for (let i = 0; i < 10; i++) set(2 + Math.floor(r() * 12), 14 + Math.floor(r() * 2), r() < 0.5 ? [255, 120, 30] : [180, 60, 20]);
    for (let k = 0; k < 11; k++) { set(2 + k, 12 - (k >> 1), noise([116, 80, 44], 16, r)); set(2 + k, 13 - (k >> 1), noise([84, 56, 30], 14, r)); }
    for (let k = 0; k < 11; k++) { set(13 - k, 12 - (k >> 1), noise([108, 74, 40], 16, r)); set(13 - k, 13 - (k >> 1), noise([78, 52, 28], 14, r)); }
    px(set, 2, 12, 2, 2, [40, 28, 18]); px(set, 12, 12, 2, 2, [40, 28, 18]);
  });
  // ---------- Fass ----------
  paint(P(B.BARREL), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise(x % 4 === 0 ? [104, 72, 38] : [146, 104, 58], 14, r));
    for (const y of [2, 3, 12, 13]) for (let x = 0; x < 16; x++) set(x, y, noise(y % 2 ? [66, 68, 76] : [112, 114, 124], 8, r));
    for (let y = 0; y < 16; y++) { set(0, y, [86, 58, 30]); set(15, y, [82, 56, 28]); }
    px(set, 0, 0, 16, 1, [190, 146, 88]); px(set, 0, 15, 16, 1, [70, 48, 24]);
  });
  // ---------- Heuballen ----------
  paint(P(B.HAY), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise([204, 172, 52], 30, r));
    for (let i = 0; i < 30; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 16); px(set, x, y, 2, 1, r() < 0.5 ? [236, 206, 96] : [160, 126, 30]); }
    for (const y of [3, 4, 11, 12]) for (let x = 0; x < 16; x++) set(x, y, noise(y % 2 ? [92, 66, 30] : [128, 92, 44], 10, r));
    for (let y = 0; y < 16; y++) { set(0, y, [168, 134, 36]); set(15, y, [150, 118, 30]); }
  });
  // ---------- Komposter ----------
  paint(P(B.COMPOSTER), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise(y % 4 === 3 ? [100, 70, 38] : [150, 108, 60], 14, r));
    px(set, 2, 3, 12, 11, [64, 44, 26]);
    for (let y = 6; y < 14; y++) for (let x = 2; x < 14; x++) set(x, y, noise(y < 8 ? [84, 118, 40] : [70, 46, 26], 22, r));
    for (let i = 0; i < 8; i++) set(2 + Math.floor(r() * 12), 6 + Math.floor(r() * 7), r() < 0.5 ? [180, 60, 40] : [210, 190, 90]);
    px(set, 0, 0, 16, 3, [172, 128, 72]); px(set, 0, 0, 16, 1, [200, 156, 96]); px(set, 0, 14, 16, 2, [110, 76, 40]);
  });
  // ---------- Lesepult ----------
  paint(P(B.LECTERN), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise([150, 108, 60], 14, r));
    px(set, 0, 0, 16, 6, [186, 142, 82]); px(set, 0, 5, 16, 1, [104, 72, 40]);
    px(set, 2, 1, 12, 4, [244, 238, 216]); px(set, 2, 1, 12, 1, [255, 252, 238]); px(set, 8, 1, 1, 4, [190, 180, 150]);
    for (const y of [2, 3]) { px(set, 3, y, 4, 1, [110, 100, 80]); px(set, 10, y, 4, 1, [110, 100, 80]); }
    px(set, 0, 0, 16, 1, [124, 40, 36]); px(set, 6, 8, 4, 8, [112, 78, 44]); px(set, 2, 14, 12, 2, [112, 78, 44]);
  });
  // ---------- Kartentisch ----------
  paint(P(B.CARTO), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise(x % 8 === 7 ? [94, 66, 36] : [146, 104, 58], 14, r));
    px(set, 0, 0, 16, 7, [90, 62, 34]); px(set, 1, 1, 14, 5, [236, 220, 176]);
    px(set, 2, 2, 5, 3, [80, 150, 200]); px(set, 8, 3, 5, 2, [108, 168, 84]); px(set, 6, 2, 2, 2, [108, 168, 84]); set(11, 2, [200, 40, 40]); set(12, 3, [200, 40, 40]);
    px(set, 0, 7, 16, 1, [60, 40, 22]); px(set, 0, 15, 16, 1, [80, 54, 28]);
  });
  // ---------- Prismarin, Seelaterne ----------
  paint(P(B.PRISMARINE), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7;
      set(x, y, mortar ? noise([44, 100, 94], 8, r) : noise([84, 156, 142], 20, r));
    }
    for (let i = 0; i < 12; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [130, 200, 184]);
  });
  paint(P(B.SEA_LANTERN), (set, r) => {
    for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) set(x, y, noise([208, 238, 226], 14, r));
    for (const k of [0, 5, 10, 15]) { px(set, 0, k, 16, 1, [120, 170, 164]); px(set, k, 0, 1, 16, [120, 170, 164]); }
    for (let i = 0; i < 10; i++) set(1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), [255, 255, 250]);
    px(set, 1, 1, 4, 4, [236, 255, 246]); px(set, 11, 11, 4, 4, [236, 255, 246]);
  });
}

// ---------------------------------------------------------------------
// Gefärbte Blöcke (zwischengespeichert)
// ---------------------------------------------------------------------
const tileCache = new Map();
const mkCanvas = (w = T6, h = T6) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
/** Wolle oder Beton in Farbe c als 16 × 16-Bild */
export function colorTile(kind, c) {
  const key = `${kind}${c & 15}`;
  let cv = tileCache.get(key);
  if (cv) return cv;
  cv = mkCanvas();
  const g = cv.getContext("2d"), img = g.createImageData(T6, T6), d = img.data, base = COLOR_RGB[c & 15], r = mulberry32((kind === "wool" ? 313 : 977) + c * 31);
  for (let y = 0; y < T6; y++) for (let x = 0; x < T6; x++) {
    let k;
    if (kind === "wool") {
      k = (r() - 0.5) * 20 + (y % 2 ? -5 : 4) + (((x + y * 3) % 7) === 0 ? -10 : 0);
      if (r() < 0.06) k -= 22;
      if (r() < 0.05) k += 16;
    } else {
      k = (r() - 0.5) * 7;
      if (x === 0 || y === 0) k += 5; else if (x === 15 || y === 15) k -= 7;
    }
    const i = (y * T6 + x) * 4;
    d[i] = clamp255(base[0] + k); d[i + 1] = clamp255(base[1] + k); d[i + 2] = clamp255(base[2] + k); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  tileCache.set(key, cv);
  return cv;
}
/** Kissen: flaches Polster mit Knopf */
export function cushionTile(c) {
  const key = `c${c & 15}`;
  let cv = tileCache.get(key);
  if (cv) return cv;
  cv = mkCanvas();
  const g = cv.getContext("2d"), base = COLOR_RGB[c & 15];
  const col = (k, a = 1) => `rgb(${clamp255(base[0] + k)},${clamp255(base[1] + k)},${clamp255(base[2] + k)})`;
  const R = (x, y, w, h, k) => { g.fillStyle = col(k); g.fillRect(x, y, w, h); };
  R(1, 11, 14, 4, -34); R(0, 12, 16, 2, -34);
  R(1, 10, 14, 4, 0); R(0, 11, 16, 2, 0); R(2, 10, 12, 1, 22); R(1, 11, 14, 1, 14);
  R(1, 13, 14, 1, -18);
  R(7, 11, 2, 2, -42); R(7, 11, 1, 1, -24);
  R(0, 14, 16, 1, -50); R(2, 15, 12, 1, -50);
  tileCache.set(key, cv);
  return cv;
}
/** Teilstück eines Blocks zeichnen (Treppe, Stufe): Kästen aus boxesOf */
function drawBoxes(g, src, boxes, px, py, tile) {
  for (const [x0, y0, x1, y1] of boxes) {
    g.drawImage(src, x0 * T6, y0 * T6, (x1 - x0) * T6, (y1 - y0) * T6, px + x0 * tile, py + y0 * tile, (x1 - x0) * tile, (y1 - y0) * tile);
    // feine Kante, damit Stufen lesbar bleiben
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(px + x0 * tile, py + y0 * tile, (x1 - x0) * tile, Math.max(1, tile / 16));
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(px + x0 * tile, py + y1 * tile - Math.max(1, tile / 16), (x1 - x0) * tile, Math.max(1, tile / 16));
  }
}
const COLORED = { [B.WOOL]: "wool", [B.CONCRETE]: "concrete", [B.WOOL_STAIRS]: "wool", [B.WOOL_SLAB]: "wool", [B.CONC_STAIRS]: "concrete", [B.CONC_SLAB]: "concrete" };

/** Zeichnet die neuen Blöcke. true = gemalt */
export function drawBlock6(g, atlas, id, aux, px, py, tile, S, game, tx, ty) {
  if (id === B.WOOL) { g.drawImage(colorTile("wool", aux), 0, 0, T6, T6, px, py, tile, tile); return true; }
  if (id < B.CONCRETE || id > B.SEA_LANTERN) return false;
  const kind = COLORED[id];
  if (kind) {
    const bd = BLOCKS[id];
    if (!bd.shape) g.drawImage(colorTile(kind, aux), 0, 0, T6, T6, px, py, tile, tile);
    else drawBoxes(g, colorTile(kind, aux), boxesOf(id, aux), px, py, tile);
    return true;
  }
  if (id === B.CUSHION) { g.drawImage(cushionTile(aux), 0, 0, T6, T6, px, py, tile, tile); return true; }
  g.drawImage(atlas, COL6(id) * T6, 0, T6, T6, px, py, tile, tile);
  if (id === B.CAMPFIRE) {
    const now = typeof performance !== "undefined" ? performance.now() : 0, t = now / 130 + tx * 1.7;
    const f = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(px + x * S, py + y * S, w * S, h * S); };
    const h1 = 5 + Math.sin(t) * 1.4, h2 = 4 + Math.sin(t * 1.7 + 1) * 1.3;
    f(5, 11 - h1, 3, h1, "#f08018"); f(8, 11 - h2, 3, h2, "#e86a10"); f(6, 11 - h1 + 1.2, 2, h1 - 1.2, "#ffc040"); f(8.6, 11 - h2 + 1.2, 1.6, h2 - 1.2, "#ffe070");
    if (Math.sin(t * 2.3) > 0.55) f(6.5 + Math.sin(t) * 2, 4 - h1 * 0.3, 1, 1, "#ffd060");
  }
  return true;
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
/** Malt das Symbol; true, wenn Etappe 6 den Gegenstand kennt. */
export function paintItem6(id, g, atlas, st) {
  const it = ITEMS[id]; if (!it) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const Pp = (x, y, c) => R(x, y, 1, 1, c);
  if (it.kind && it.col != null) {
    const kind = it.kind.startsWith("wool") ? "wool" : it.kind.startsWith("concrete") ? "concrete" : "cushion";
    if (it.kind === "wool" || it.kind === "concrete") g.drawImage(colorTile(kind, it.col), 0, 0);
    else if (it.kind === "cushion") { g.drawImage(cushionTile(it.col), 0, 0); }
    else if (it.kind.endsWith("slab")) { g.drawImage(colorTile(kind, it.col), 0, 0, 16, 8, 0, 8, 16, 8); R(0, 8, 16, 1, "rgba(255,255,255,0.2)"); R(0, 15, 16, 1, "rgba(0,0,0,0.25)"); }
    else { drawBoxes(g, colorTile(kind, it.col), boxesOf(it.block, 0), 0, 0, 16); }
    return true;
  }
  if (it.tags && it.tags.includes("dye")) {
    const c = COLOR_RGB[it.col], rgb = k => `rgb(${clamp255(c[0] + k)},${clamp255(c[1] + k)},${clamp255(c[2] + k)})`;
    R(5, 6, 6, 6, rgb(0)); R(4, 7, 8, 4, rgb(0)); R(6, 5, 4, 1, rgb(-20)); R(5, 6, 1, 1, rgb(26)); R(6, 7, 2, 1, rgb(40)); R(5, 11, 6, 1, rgb(-40)); R(4, 10, 1, 1, rgb(-30)); R(11, 10, 1, 1, rgb(-40));
    R(5, 12, 6, 1, "rgba(0,0,0,0.25)");
    return true;
  }
  if (it.block != null && it.block >= B.CONCRETE && it.block <= B.SEA_LANTERN) {
    g.drawImage(atlas, COL6(it.block) * T6, 0, T6, T6, 0, 0, T6, T6);
    if (it.block === B.CAMPFIRE) { R(6, 4, 3, 7, "#f08018"); R(9, 6, 2, 5, "#e86a10"); R(7, 6, 1, 4, "#ffc040"); }
    return true;
  }
  if (it.map) {
    R(1, 2, 14, 12, "#d9c08a"); R(1, 2, 14, 1, "#efe0b4"); R(1, 13, 14, 1, "#a8895a"); R(1, 2, 1, 12, "#c4a874"); R(14, 2, 1, 12, "#a8895a");
    R(3, 4, 5, 4, "#5aa0d0"); R(9, 8, 4, 4, "#6ab056"); R(8, 6, 2, 3, "#6ab056");
    if (it.map === "mansion") { R(4, 9, 4, 3, "#5a3a22"); R(5, 8, 2, 1, "#7a4a2a"); R(5, 10, 1, 2, "#c8a050"); }
    else { R(4, 4, 4, 3, "#5cc0b0"); R(5, 3, 2, 1, "#7ae0cc"); Pp(5, 5, "#d6f4ee"); }
    Pp(11, 4, "#c82828"); Pp(12, 5, "#c82828"); Pp(12, 4, "#c82828"); Pp(11, 5, "#c82828");
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Dorfbewohner: Berufskleidung
// ---------------------------------------------------------------------
const PROF_LOOK = {
  farmer: { robe: ["#8a6a3a", "#6a4e28"], hat: "#e0c060" },
  librarian: { robe: ["#d8d4cc", "#b8b2a6"], hat: null },
  cartographer: { robe: ["#9a7a50", "#7a5c38"], hat: "#6a4a2a" },
  smith: { robe: ["#4c4c52", "#34343a"], hat: null },
  cleric: { robe: ["#7a46a0", "#5a3280"], hat: null }
};
/** Farben und Zubehör je Beruf; undefined = Standardkleidung */
export function profLook(prof) { return PROF_LOOK[prof]; }
/** Zeichnet das Beruf-Zubehör im Körperraster (R wie in drawVillager) */
export function drawProfGear(R, prof, bob, lvl = 1) {
  switch (prof) {
    case "farmer": R(0.8, 1.6 - bob, 9.8, 1.2, "#e0c060"); R(2, 0.2 - bob, 7.2, 1.8, "#c8a848"); R(2, 1.6 - bob, 7.2, 0.5, "#8a6a28"); R(2.4, 12 - bob, 6.6, 9, "#a07a48"); break;
    case "librarian": R(5.2, 4.7 - bob, 3, 1.6, "#2c2c34"); R(5.6, 5 - bob, 2.2, 0.9, "#9ad0e8"); R(2, 12 - bob, 7.5, 1, "#8a8478"); break;
    case "cartographer": R(1.5, 1 - bob, 8, 1.4, "#6a4a2a"); R(2.5, 11 - bob, 3, 4, "#ecdcae"); R(2.5, 11 - bob, 3, 0.8, "#cbb888"); break;
    case "smith": R(2, 9 - bob, 7.5, 14, "#34343a"); R(2.5, 12 - bob, 6.5, 9, "#6a4a30"); R(2.5, 12 - bob, 6.5, 1, "#8a6a48"); R(6.6, 9.4 - bob, 1.4, 3, "#2a2a30"); break;
    case "cleric": R(1.5, 1.2 - bob, 8.5, 2.4, "#5a3280"); R(5.4, 11 - bob, 1.2, 6, "#f4c93a"); R(4.4, 13 - bob, 3.2, 1, "#f4c93a"); break;
  }
  if (lvl >= 3 && prof) R(2.2, 22.4 - bob, 1.3, 1.1, lvl >= 5 ? "#6ae0e0" : lvl >= 4 ? "#f4c93a" : "#c8c8d0");
}
