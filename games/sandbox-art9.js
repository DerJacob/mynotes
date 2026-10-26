// =====================================================================
// Blockdorf – Grafik der Etappe 9: Steine, Farben, Holzsätze, Werkblöcke, Kupfer, Kerzen, Banner.
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit. Blöcke mit Zusatzfeld (Farbe, Holzart, Alterung)
// werden je Zustand einmal gemalt und zwischengespeichert, damit der Atlas klein bleibt.
// =====================================================================
import { B, COLORS, ITEMS, BLOCKS, boxesOf, WOODS, STONE_MATS, TRIM_PATTERNS, TRIM_MATS, TRIM_MAT_IDS, LOOM_PATTERNS, isDoorM, isTrap } from "./sandbox-data.js?v=10";
import { mulberry32 } from "./sandbox-noise.js?v=10";
import { COL11, FIRST11, LAST11 } from "./sandbox-art11.js?v=10";

export const T9 = 16;
export const FIRST9 = B.GRANITE, LAST9 = B.TRAP_OL;
/** Spalte im Atlas für die Blöcke der Etappe 9 (Spalten 256… sind frei) */
export const COL9 = id => 256 + (id - FIRST9);
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CRGB = COLORS.map(c => hexRgb(c[2]));
const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const rgb = (c, k = 0) => `rgb(${clamp255(c[0] + k)},${clamp255(c[1] + k)},${clamp255(c[2] + k)})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mkCanvas = (w = T9, h = T9) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

/** Wo liegt das Bild eines vollen Blocks im Atlas? (Spalte; Zeile 0) */
export function atlasCol(id) {
  if (id >= FIRST11 && id <= LAST11) return COL11(id);
  if (id >= FIRST9) return COL9(id);
  if (id >= B.POWDER_SNOW) return 224 + (id - B.POWDER_SNOW);
  if (id >= B.CONCRETE && id <= B.SEA_LANTERN) return 200 + (id - B.CONCRETE);
  return id;
}

// ---------------------------------------------------------------------
// Atlas: Steine, Honig, Schleim, Werkblöcke, getöntes Glas
// ---------------------------------------------------------------------
export function paintAtlas9(paint, noise, specks) {
  const px = (set, x, y, w, h, c, a = 255) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, a); };
  const fill = (set, r, base, k = 16) => { for (let y = 0; y < T9; y++) for (let x = 0; x < T9; x++) set(x, y, noise(base, k, r)); };
  const blobs = (set, r, c, n, k = 12) => { for (let i = 0; i < n; i++) { const x = Math.floor(r() * 13), y = Math.floor(r() * 13), w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2); px(set, x, y, w, h, noise(c, k, r)); } };
  const bevel = (set, hi, lo) => { for (let i = 0; i < 16; i++) { set(i, 0, hi); set(0, i, hi); set(15, i, lo); set(i, 15, lo); } };
  const P = id => COL9(id);
  // Platzhalter für alle Blöcke (Teilchenfarbe); die richtigen Bilder überschreiben sie
  for (let id = FIRST9; id <= LAST9; id++) paint(P(id), (set, r) => fill(set, r, [160, 140, 120], 12));

  // ---------- Granit, Diorit, Andesit ----------
  paint(P(B.GRANITE), (set, r) => { fill(set, r, [154, 106, 90], 14); blobs(set, r, [118, 76, 62], 6, 10); blobs(set, r, [186, 140, 122], 5, 10); for (let i = 0; i < 12; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [208, 168, 150]); });
  paint(P(B.DIORITE), (set, r) => { fill(set, r, [190, 188, 184], 12); blobs(set, r, [126, 126, 128], 6, 10); blobs(set, r, [232, 230, 226], 6, 8); for (let i = 0; i < 10; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [96, 96, 100]); });
  paint(P(B.ANDESITE), (set, r) => { fill(set, r, [136, 136, 134], 12); blobs(set, r, [108, 108, 108], 6, 8); blobs(set, r, [158, 158, 154], 5, 8); for (let i = 0; i < 10; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [88, 88, 90]); });
  const polished = (id, base, hi, lo) => paint(P(id), (set, r) => { fill(set, r, base, 7); for (let i = 0; i < 6; i++) set(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), noise(hi, 6, r)); bevel(set, hi, lo); for (let i = 1; i < 15; i++) { set(i, 1, noise(base, 5, r)); } });
  polished(B.P_GRANITE, [164, 112, 96], [196, 146, 128], [118, 76, 62]);
  polished(B.P_DIORITE, [198, 196, 192], [236, 234, 230], [140, 140, 142]);
  polished(B.P_ANDESITE, [142, 142, 140], [170, 170, 166], [100, 100, 100]);
  // ---------- Prismarinziegel ----------
  paint(P(B.PRISM_BRICKS), (set, r) => {
    fill(set, r, [92, 170, 152], 18);
    for (let x = 0; x < 16; x++) { set(x, 0, [52, 116, 106]); set(x, 7, [52, 116, 106]); set(x, 8, [52, 116, 106]); set(x, 15, [52, 116, 106]); }
    for (let y = 0; y < 8; y++) { set(0, y, [52, 116, 106]); set(8, y, [52, 116, 106]); } for (let y = 8; y < 16; y++) { set(0, y, [52, 116, 106]); set(8, y, [52, 116, 106]); }
    for (let i = 0; i < 10; i++) set(1 + Math.floor(r() * 14), 1 + Math.floor(r() * 14), [140, 214, 192]);
  });
  paint(P(B.DARK_PRISM), (set, r) => { fill(set, r, [44, 82, 70], 14); for (let x = 0; x < 16; x++) { set(x, 7, [24, 52, 44]); set(x, 15, [24, 52, 44]); } for (let y = 0; y < 16; y++) set(y < 8 ? 7 : 3, y, [24, 52, 44]); for (let i = 0; i < 8; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [84, 138, 118]); });
  // ---------- Tuff-Familie ----------
  const tuffBase = (set, r) => { fill(set, r, [112, 112, 102], 12); for (let i = 0; i < 5; i++) px(set, Math.floor(r() * 13), Math.floor(r() * 13), 2 + Math.floor(r() * 3), 2, noise([92, 94, 84], 8, r)); };
  paint(P(B.P_TUFF), (set, r) => { tuffBase(set, r); bevel(set, [136, 136, 124], [86, 86, 78]); });
  paint(P(B.TUFF_BRICKS), (set, r) => {
    fill(set, r, [120, 120, 108], 10);
    for (let y of [0, 5, 10, 15]) for (let x = 0; x < 16; x++) set(x, y, [82, 84, 74]);
    for (let y = 0; y < 15; y++) { const off = (y / 5 | 0) % 2 ? 4 : 10; set(off, y, [82, 84, 74]); }
    for (let i = 0; i < 10; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [146, 146, 132]);
  });
  paint(P(B.CH_TUFF), (set, r) => { tuffBase(set, r); bevel(set, [136, 136, 124], [78, 80, 72]); px(set, 3, 3, 10, 10, [92, 94, 84]); px(set, 4, 4, 8, 8, noise([120, 120, 108], 8, r)); for (let i = 5; i < 11; i++) { set(i, 8, [84, 86, 76]); set(8, i, [84, 86, 76]); } });
  // ---------- Schleimblock, Honigblock, Knochenblock, Terrakotta ----------
  paint(P(B.SLIME), (set, r) => {
    fill(set, r, [104, 188, 82], 10);
    for (let i = 0; i < 16; i++) { set(i, 0, [76, 150, 58]); set(0, i, [76, 150, 58]); set(15, i, [76, 150, 58]); set(i, 15, [76, 150, 58]); }
    px(set, 3, 3, 10, 10, [132, 212, 104]); px(set, 4, 4, 8, 8, [118, 200, 92]); px(set, 4, 4, 3, 2, [190, 244, 170]); px(set, 3, 3, 10, 1, [90, 168, 70]);
  });
  paint(P(B.HONEY), (set, r) => {
    fill(set, r, [232, 148, 30], 12);
    for (let i = 0; i < 16; i++) { set(i, 0, [190, 112, 16]); set(0, i, [190, 112, 16]); set(15, i, [190, 112, 16]); set(i, 15, [190, 112, 16]); }
    px(set, 3, 3, 10, 10, [250, 176, 52]); px(set, 4, 4, 8, 8, [244, 164, 38]); px(set, 4, 4, 3, 2, [255, 222, 120]); px(set, 3, 3, 10, 1, [210, 130, 20]);
  });
  paint(P(B.BONE_BLOCK), (set, r) => {
    fill(set, r, [226, 222, 200], 10);
    for (let x = 0; x < 16; x += 4) for (let y = 0; y < 16; y++) set(x + 1, y, noise([196, 190, 164], 8, r));
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) if (r() < 0.8) set(x, y, [176, 170, 144]);
    bevel(set, [244, 240, 222], [176, 170, 148]);
  });
  paint(P(B.TERRACOTTA), (set, r) => { fill(set, r, [152, 94, 68], 12); for (let i = 0; i < 8; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [176, 116, 86]); for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [128, 74, 52]); });
  // ---------- getöntes Glas ----------
  paint(P(B.TINTED_GLASS), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise([52, 40, 62], 8, r), 235);
    for (let i = 0; i < 16; i++) { set(i, 0, [92, 76, 112]); set(0, i, [92, 76, 112]); set(15, i, [70, 56, 88]); set(i, 15, [70, 56, 88]); }
    for (let i = 0; i < 4; i++) { set(3 + i, 3 + i, [120, 100, 144]); set(4 + i, 3 + i, [96, 80, 116]); }
  });
  // ---------- Werkblöcke ----------
  const wood = (set, r, base = [146, 104, 58]) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(y % 4 === 3 ? [base[0] - 40, base[1] - 30, base[2] - 20] : base, 12, r)); };
  paint(P(B.STONECUTTER), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise([124, 124, 130], 14, r));
    px(set, 0, 8, 16, 8, noise([110, 110, 116], 8, r)); px(set, 0, 8, 16, 1, [168, 168, 176]); px(set, 0, 15, 16, 1, [80, 80, 86]);
    for (let a = 0; a < 20; a++) { const ang = (a / 20) * Math.PI * 2, cx = 8 + Math.cos(ang) * 6, cy = 5 + Math.sin(ang) * 4.4; set(Math.round(cx), Math.round(cy), a % 2 ? [220, 220, 228] : [176, 178, 188]); }
    px(set, 5, 3, 6, 4, [190, 192, 204]); px(set, 7, 4, 2, 2, [80, 80, 90]); px(set, 0, 0, 16, 1, [150, 150, 158]);
  });
  paint(P(B.SMITHING), (set, r) => {
    wood(set, r, [140, 98, 56]); px(set, 0, 0, 16, 6, noise([56, 50, 54], 8, r)); px(set, 0, 0, 16, 1, [96, 88, 92]);
    px(set, 2, 2, 5, 2, [150, 150, 160]); px(set, 3, 1, 2, 1, [196, 196, 204]); px(set, 9, 2, 5, 1, [196, 196, 204]); px(set, 9, 3, 1, 2, [196, 196, 204]); px(set, 13, 3, 1, 2, [196, 196, 204]);
    px(set, 0, 6, 16, 1, [60, 40, 22]); px(set, 0, 15, 16, 1, [76, 52, 28]); for (const x of [1, 14]) px(set, x, 7, 1, 8, [96, 66, 36]);
    px(set, 5, 9, 6, 4, [96, 98, 108]); px(set, 6, 10, 4, 2, [128, 130, 142]);
  });
  paint(P(B.LOOM), (set, r) => {
    wood(set, r, [150, 108, 62]); px(set, 1, 1, 14, 14, [96, 66, 36]);
    for (let x = 2; x < 14; x++) { const c = [[220, 220, 214], [196, 52, 48], [60, 100, 190], [232, 196, 60]][((x >> 1) % 4)]; for (let y = 2; y < 14; y++) set(x, y, y % 2 ? c : [c[0] - 30, c[1] - 30, c[2] - 30]); }
    px(set, 0, 5, 16, 2, [118, 84, 46]); px(set, 0, 10, 16, 2, [118, 84, 46]); px(set, 0, 5, 16, 1, [180, 136, 80]); px(set, 0, 10, 16, 1, [180, 136, 80]);
  });
  paint(P(B.GRINDSTONE), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, [0, 0, 0], 0);
    px(set, 0, 2, 3, 12, noise([140, 98, 56], 10, r)); px(set, 13, 2, 3, 12, noise([140, 98, 56], 10, r)); px(set, 0, 2, 3, 1, [190, 146, 88]); px(set, 13, 2, 3, 1, [190, 146, 88]);
    for (let y = 1; y < 15; y++) for (let x = 3; x < 13; x++) { const dx = (x - 7.5) / 4.9, dy = (y - 7.5) / 6.5; if (dx * dx + dy * dy <= 1) set(x, y, noise(dy < -0.3 ? [168, 168, 174] : [136, 136, 144], 10, r)); }
    px(set, 6, 1, 2, 14, [114, 114, 122]); px(set, 3, 15, 10, 1, [96, 66, 36]); px(set, 3, 0, 10, 1, [96, 66, 36]); px(set, 5, 0, 6, 1, [168, 168, 174]);
  });
  const furnaceBody = (set, r, base, dark) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(base, 14, r)); bevel(set, [base[0] + 30, base[1] + 30, base[2] + 30], dark); };
  paint(P(B.SMOKER), (set, r) => { furnaceBody(set, r, [128, 98, 70], [74, 52, 34]); px(set, 0, 0, 16, 3, [88, 62, 40]); px(set, 3, 6, 10, 6, [42, 34, 30]); for (let x = 4; x < 12; x += 2) px(set, x, 7, 1, 4, [96, 90, 86]); px(set, 3, 6, 10, 1, [70, 60, 54]); px(set, 6, 1, 4, 1, [150, 120, 88]); });
  paint(P(B.BLAST), (set, r) => { furnaceBody(set, r, [96, 96, 104], [56, 56, 64]); px(set, 0, 0, 16, 3, [70, 70, 78]); px(set, 3, 6, 10, 6, [30, 30, 36]); for (let x = 3; x < 13; x += 2) px(set, x, 6, 1, 6, [140, 142, 154]); for (let y = 7; y < 12; y += 2) px(set, 3, y, 10, 1, [140, 142, 154]); });
  paint(P(B.CBOOKSHELF), (set, r) => { wood(set, r, [150, 108, 62]); px(set, 0, 0, 16, 1, [190, 146, 88]); px(set, 0, 7, 16, 2, [100, 70, 38]); px(set, 5, 0, 1, 16, [100, 70, 38]); px(set, 10, 0, 1, 16, [100, 70, 38]); });
  paint(P(B.ARMOR_STAND), (set) => { px(set, 7, 1, 2, 14, [140, 100, 56]); px(set, 3, 15, 10, 1, [120, 120, 126]); });
}

// ---------------------------------------------------------------------
// Zustandsabhängige Bilder (zwischengespeichert)
// ---------------------------------------------------------------------
const cache = new Map();
const memo = (key, make) => { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };
const paintTile = (fn, seed) => { const cv = mkCanvas(), g = cv.getContext("2d"), img = g.createImageData(T9, T9), d = img.data, r = mulberry32(seed); const set = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= T9 || y >= T9) return; const i = (y * T9 + x) * 4; d[i] = clamp255(c[0]); d[i + 1] = clamp255(c[1]); d[i + 2] = clamp255(c[2]); d[i + 3] = a; }; fn(set, r); g.putImageData(img, 0, 0); return cv; };
const nz = (c, k, r) => { const v = (r() - 0.5) * k; return [c[0] + v, c[1] + v, c[2] + v]; };
const TERRA_BASE = [152, 94, 68];

export function terraTile(c) {
  return memo(`t${c & 15}`, () => paintTile((set, r) => {
    const col = mix(TERRA_BASE, CRGB[c & 15], c === 15 ? 0.78 : 0.62);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, nz(col, 10, r));
    for (let i = 0; i < 8; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [col[0] + 18, col[1] + 14, col[2] + 12]);
    for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [col[0] - 22, col[1] - 18, col[2] - 16]);
  }, 500 + c));
}
export function powderTile(c) {
  return memo(`p${c & 15}`, () => paintTile((set, r) => {
    const col = CRGB[c & 15], lift = c === 15 ? 14 : 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const q = r(); set(x, y, [col[0] + lift + (q - 0.5) * 30, col[1] + lift + (q - 0.5) * 30, col[2] + lift + (q - 0.5) * 30]); }
    for (let i = 0; i < 20; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [col[0] + 34, col[1] + 34, col[2] + 34]);
  }, 700 + c));
}
/** Glasierte Terrakotta: 16 verschiedene Muster, Farbe der Platte */
export function glazedTile(c) {
  return memo(`g${c & 15}`, () => paintTile((set, r) => {
    const col = CRGB[c & 15], lo = [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], hi = [Math.min(255, col[0] * 0.5 + 140), Math.min(255, col[1] * 0.5 + 140), Math.min(255, col[2] * 0.5 + 140)], dark = [col[0] * 0.45, col[1] * 0.45, col[2] * 0.45];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, nz(col, 6, r));
    const m = c & 15, F = (x, y, w, h, cc) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, cc); };
    switch (m) {
      case 0: for (let i = 0; i < 8; i++) { F(i, 7 - i, 1, 2 * i + 2, hi); F(15 - i, 7 - i, 1, 2 * i + 2, hi); } break;                        // Rauten
      case 1: F(2, 2, 12, 12, lo); F(4, 4, 8, 8, hi); F(6, 6, 4, 4, dark); break;                                                           // Quadrate
      case 2: for (let i = 0; i < 16; i++) { set(i, i, hi); set(15 - i, i, hi); set(i, 1 + i, lo); set(15 - i, 1 + i, lo); } break;          // Kreuz
      case 3: for (let y = 1; y < 16; y += 4) F(0, y, 16, 2, y % 8 === 1 ? hi : lo); break;                                                // Streifen
      case 4: for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) { F(x, y, 4, 4, hi); F(x + 4, y + 4, 4, 4, hi); } break;      // Schach
      case 5: for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; set(Math.round(8 + Math.cos(t) * 6), Math.round(8 + Math.sin(t) * 6), hi); set(Math.round(8 + Math.cos(t) * 3), Math.round(8 + Math.sin(t) * 3), lo); } break;   // Kreise
      case 6: for (let x = 0; x < 16; x++) { const y = 4 + (x % 8 < 4 ? x % 4 : 4 - x % 4) * 2; F(x, y, 1, 2, hi); F(x, y + 7, 1, 2, lo); } break;        // Zickzack
      case 7: for (let i = 0; i < 6; i++) { F(2 + i, 2 + i, 12 - 2 * i, 1, hi); F(2 + i, 13 - i, 12 - 2 * i, 1, lo); F(2 + i, 2 + i, 1, 12 - 2 * i, hi); F(13 - i, 2 + i, 1, 12 - 2 * i, lo); } break;   // Spirale
      case 8: for (let i = 0; i < 16; i += 2) { F(i, 0, 1, 16, i % 4 ? lo : hi); } break;                                                  // Pfosten
      case 9: for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]]) { F(x - 1, y, 3, 1, hi); F(x, y - 1, 1, 3, hi); } break;   // Sterne
      case 10: F(0, 7, 16, 2, hi); F(7, 0, 2, 16, hi); F(5, 5, 6, 6, lo); F(6, 6, 4, 4, dark); break;                                      // Pfeilkreuz
      case 11: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 5 === 0) set(x, y, hi); break;                       // Schräg
      case 12: for (let i = 0; i < 4; i++) F(i * 4, (i % 2) * 4 + 2, 4, 4, i % 2 ? lo : hi); break;                                         // Treppe
      case 13: F(0, 0, 16, 2, dark); F(0, 14, 16, 2, dark); F(0, 0, 2, 16, dark); F(14, 0, 2, 16, dark); F(5, 5, 6, 6, hi); break;           // Rahmen
      case 14: for (let a = 0; a < 16; a++) { F(a, 3 + Math.round(Math.sin(a / 2.5) * 2), 1, 2, hi); F(a, 10 + Math.round(Math.sin(a / 2.5) * 2), 1, 2, lo); } break;   // Wellen
      default: F(0, 0, 8, 8, lo); F(8, 8, 8, 8, lo); F(0, 8, 8, 8, hi); F(8, 0, 8, 8, hi); break;                                              // Felder
    }
    for (let i = 0; i < 16; i++) { set(i, 0, [col[0] + 28, col[1] + 28, col[2] + 28]); set(0, i, [col[0] + 28, col[1] + 28, col[2] + 28]); set(15, i, [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55]); set(i, 15, [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55]); }
  }, 900 + c));
}
/** Holzbretter der Holzart w (Eiche kommt aus dem Atlas, hier trotzdem als Bild für Treppen und Stufen) */
export function plankTile(w) {
  return memo(`w${w}`, () => paintTile((set, r) => {
    const base = WOODS[w][3];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = y >> 2, shade = [0, -12, 8, -6][row];
      const seam = y % 4 === 3, endx = ((row % 2) ? 5 : 11);
      let c = nz([base[0] + shade, base[1] + shade, base[2] + shade], 12, r);
      if (seam) c = [c[0] * 0.78, c[1] * 0.78, c[2] * 0.78];
      if (x === endx && !seam) c = [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82];
      if (w === 8 && x % 4 === 0) c = [c[0] * 0.9, c[1] * 0.92, c[2] * 0.85];        // Bambus: Rillen
      set(x, y, c);
    }
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 12); set(x, y, [base[0] * 0.8, base[1] * 0.8, base[2] * 0.8]); set(x + 1, y, [base[0] * 0.85, base[1] * 0.85, base[2] * 0.85]); }
  }, 1100 + w));
}
const COPPER_BASE = [[196, 110, 76], [168, 128, 96], [90, 150, 118], [70, 164, 144]];
const copperRgb = st => COPPER_BASE[st & 3];
/** Kupfer: Alterung 0–3. fam = copper_block, cut_copper, chiseled_copper, copper_grate, copper_bulb */
export function copperTile(fam, st, lit = false) {
  return memo(`cu${fam}${st}${lit ? "l" : ""}`, () => paintTile((set, r) => {
    const col = copperRgb(st), lo = [col[0] * 0.72, col[1] * 0.72, col[2] * 0.72], hi = [Math.min(255, col[0] + 38), Math.min(255, col[1] + 34), Math.min(255, col[2] + 30)];
    const F = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, nz(col, 14, r));
    if (fam === "copper_block") { for (let i = 0; i < 14; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), hi); for (let i = 0; i < 8; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), lo); }
    else if (fam === "cut_copper") { F(0, 7, 16, 1, lo); F(0, 15, 16, 1, lo); F(7, 0, 1, 8, lo); F(3, 8, 1, 8, lo); F(11, 8, 1, 8, lo); F(0, 0, 16, 1, hi); F(0, 8, 16, 1, hi); }
    else if (fam === "chiseled_copper") { F(0, 0, 16, 2, lo); F(0, 14, 16, 2, lo); F(0, 0, 2, 16, lo); F(14, 0, 2, 16, lo); F(4, 4, 8, 8, lo); F(5, 5, 6, 6, hi); F(7, 5, 2, 6, col); F(5, 7, 6, 2, col); }
    else if (fam === "copper_grate") { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, [0, 0, 0], 0); for (let i = 0; i < 16; i += 5) { F(i, 0, 2, 16, col); F(0, i, 16, 2, col); } F(0, 15, 16, 1, col); F(15, 0, 1, 16, col); F(0, 0, 16, 1, hi); F(0, 0, 1, 16, hi); }
    else { F(0, 0, 16, 1, hi); F(0, 15, 16, 1, lo); F(0, 0, 1, 16, hi); F(15, 0, 1, 16, lo); F(3, 3, 10, 10, lo); F(4, 4, 8, 8, lit ? [255, 232, 140] : [86, 70, 56]); if (lit) { F(6, 6, 4, 4, [255, 255, 216]); } else { F(5, 5, 2, 2, [118, 100, 82]); } F(2, 7, 1, 2, hi); F(13, 7, 1, 2, hi); }
  }, 1300 + st * 7 + fam.length));
}
export const COPPER_FAM_BLOCK = { [B.COPPER_BLOCK]: "copper_block", [B.CUT_COPPER]: "cut_copper", [B.CHISELED_COPPER]: "chiseled_copper", [B.COPPER_GRATE]: "copper_grate", [B.COPPER_BULB]: "copper_bulb", [B.BULB_ON]: "copper_bulb" };

/** Quelle (Bild, Spalte, Zeile) eines vollen Blocks für Treppen und Stufen */
function matSource(atlas, kind, m) {
  if (kind === "wood") { if (m === 0) return { img: atlas, sx: B.PLANKS * T9, sy: 0 }; return { img: plankTile(m), sx: 0, sy: 0 }; }
  const blk = STONE_MATS[m & 15][3];
  return { img: atlas, sx: atlasCol(blk) * T9, sy: 0 };
}
function drawBoxes(g, src, boxes, px, py, tile) {
  const e = Math.max(1, tile / 16);
  for (const [x0, y0, x1, y1] of boxes) {
    g.drawImage(src.img, src.sx + x0 * T9, src.sy + y0 * T9, (x1 - x0) * T9, (y1 - y0) * T9, px + x0 * tile, py + y0 * tile, (x1 - x0) * tile, (y1 - y0) * tile);
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(px + x0 * tile, py + y0 * tile, (x1 - x0) * tile, e);
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(px + x0 * tile, py + y1 * tile - e, (x1 - x0) * tile, e);
  }
}

// ---------- Türen und Falltüren ----------
const woodRgb = w => WOODS[w][3];
function doorBase(m, st) { return m === 9 ? copperRgb(st) : woodRgb(m); }
/** Türblatt (oben mit Fenster, unten mit Füllung) als 16×16 */
export function doorTile(m, st, top, open) {
  return memo(`d${m}${st}${top ? 1 : 0}${open ? 1 : 0}`, () => paintTile((set, r) => {
    const col = doorBase(m, st), lo = [col[0] * 0.66, col[1] * 0.66, col[2] * 0.66], hi = [Math.min(255, col[0] + 30), Math.min(255, col[1] + 26), Math.min(255, col[2] + 22)];
    const F = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
    const x0 = open ? 0 : 0, w = open ? 3 : 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < w; x++) set(x0 + x, y, nz(col, 12, r));
    if (open) { F(0, 0, 1, 16, hi); F(2, 0, 1, 16, lo); }
    else {
      F(0, 0, 16, 1, hi); F(0, 15, 16, 1, lo); F(0, 0, 2, 16, hi); F(14, 0, 2, 16, lo);
      if (top) { F(3, 3, 10, 6, [48, 40, 36]); F(4, 4, 8, 4, m === 9 ? [90, 120, 130] : [128, 170, 200]); F(4, 4, 8, 1, [190, 220, 240]); F(3, 3, 10, 1, lo); }
      else { F(3, 3, 10, 5, lo); F(4, 4, 8, 3, nz(col, 8, r)); F(3, 10, 10, 4, lo); F(4, 11, 8, 2, nz(col, 8, r)); F(12, 7, 2, 2, [220, 200, 80]); }
    }
  }, 1500 + m * 13 + st * 3 + (top ? 1 : 0) + (open ? 90 : 0)));
}
export function trapTile(m, st) {
  return memo(`tr${m}${st}`, () => paintTile((set, r) => {
    const col = doorBase(m, st), lo = [col[0] * 0.66, col[1] * 0.66, col[2] * 0.66], hi = [Math.min(255, col[0] + 30), Math.min(255, col[1] + 26), Math.min(255, col[2] + 22)];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, nz(col, 12, r));
    for (let i = 0; i < 16; i++) { set(i, 0, hi); set(i, 15, lo); set(0, i, hi); set(15, i, lo); }
    for (let i = 3; i < 13; i++) { set(i, 3, lo); set(i, 12, lo); } for (let j = 3; j < 13; j++) { set(3, j, lo); set(12, j, lo); }
    for (let i = 7; i < 9; i++) for (let j = 6; j < 10; j++) set(i, j, [210, 190, 90]);
  }, 1700 + m * 13 + st));
}

// ---------- Banner ----------
const BAN_W = 12, BAN_H = 15;
/** Muster als Maske in einem Tuchfeld (12 × 15): true = Muster deckt diesen Punkt ab */
const patternAt = (key, x, y) => {
  const w = BAN_W, h = BAN_H, cx = (w - 1) / 2, cy = (h - 1) / 2;
  switch (key) {
    case "bt": return y < 4;
    case "bb": return y >= h - 4;
    case "ps": return x < 4;
    case "pd": return x >= w - 4;
    case "pm": return Math.abs(x - cx) < 2.2;
    case "fe": return Math.abs(y - cy) < 2.4;
    case "cr": return Math.abs(x - cx) < 2.2 || Math.abs(y - cy) < 2.2;
    case "sa": return Math.abs(x / w - y / h) < 0.13 || Math.abs((w - 1 - x) / w - y / h) < 0.13;
    case "bo": return x < 2 || x >= w - 2 || y < 2 || y >= h - 2;
    case "bl": return Math.abs(x / w - (h - 1 - y) / h) < 0.16;
    case "br": return Math.abs(x / w - y / h) < 0.16;
    case "ro": return Math.hypot(x - cx, (y - cy) * 0.8) < 3.6;
    case "lo": return Math.abs(x - cx) / 5 + Math.abs(y - cy) / 6.4 < 1;
    case "hl": return x < w / 2;
    case "hr": return x >= w / 2;
    case "ho": return y < h / 2;
    case "hu": return y >= h / 2;
    default: return false;
  }
};
/** Banner-Tuch (12 × 15) mit Farbe und Mustern; p = [[Muster-Index, Farbe], …] */
export function bannerCloth(c, p) {
  const sig = `${c}|${(p || []).map(q => q.join(",")).join(";")}`;
  return memo(`b${sig}`, () => {
    const cv = mkCanvas(BAN_W, BAN_H), g = cv.getContext("2d"), img = g.createImageData(BAN_W, BAN_H), d = img.data, r = mulberry32(31 + c);
    const put = (x, y, col, k = 0) => { const i = (y * BAN_W + x) * 4; d[i] = clamp255(col[0] + k); d[i + 1] = clamp255(col[1] + k); d[i + 2] = clamp255(col[2] + k); d[i + 3] = 255; };
    for (let y = 0; y < BAN_H; y++) for (let x = 0; x < BAN_W; x++) put(x, y, CRGB[c & 15], Math.floor((r() - 0.5) * 8));
    for (const q of p || []) { const pat = LOOM_PATTERNS[q[0]]; if (!pat) continue; for (let y = 0; y < BAN_H; y++) for (let x = 0; x < BAN_W; x++) if (patternAt(pat[0], x, y)) put(x, y, CRGB[q[1] & 15], Math.floor((r() - 0.5) * 8)); }
    g.putImageData(img, 0, 0);
    return cv;
  });
}
/** Banner als Block (Stange oben, Tuch hängt herab), Spitze unten */
export function drawBannerBlock(g, px, py, tile, c, p) {
  const k = tile / 16, cloth = bannerCloth(c, p);
  g.fillStyle = "#6e4a24"; g.fillRect(px, py, tile, Math.max(1, Math.round(k * 1.4))); g.fillStyle = "#a47a44"; g.fillRect(px, py, tile, Math.max(1, Math.round(k * 0.5)));
  g.drawImage(cloth, 0, 0, BAN_W, BAN_H - 2, px + 2 * k, py + 1.4 * k, BAN_W * k, (BAN_H - 2) * k);
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(px + 2 * k, py + 13.4 * k, BAN_W * k, Math.max(1, k * 0.6));
  // Spitze unten (Wimpel)
  for (let i = 0; i < 3; i++) { g.drawImage(cloth, 0, BAN_H - 2 + (i > 0 ? 0 : 0), BAN_W, 1, px + (2 + i) * k, py + (13.4 + i * 0.5) * k, (BAN_W - 2 * i) * k, k * 0.5); }
}
/** Banner als Gegenstand (16 × 16): Stange und Tuch */
function paintBannerIcon(g, c, p) {
  const cloth = bannerCloth(c, p);
  g.fillStyle = "#6e4a24"; g.fillRect(1, 0, 14, 2); g.fillStyle = "#a47a44"; g.fillRect(1, 0, 14, 1);
  g.fillStyle = "#4a3418"; g.fillRect(7, 14, 2, 2);
  g.drawImage(cloth, 0, 0, BAN_W, BAN_H - 1, 2, 2, BAN_W, BAN_H - 1);
  g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(2, 15, BAN_W, 1);
}

// ---------- Kerzen ----------
function drawCandle(g, px, py, tile, c, lit, now, tx) {
  const k = tile / 16, col = c >= 16 ? [236, 228, 200] : CRGB[c & 15], lo = [col[0] * 0.78, col[1] * 0.78, col[2] * 0.78];
  g.fillStyle = rgb(col); g.fillRect(px + 6 * k, py + 8 * k, 4 * k, 8 * k);
  g.fillStyle = rgb(col, 34); g.fillRect(px + 6 * k, py + 8 * k, 1.4 * k, 8 * k);
  g.fillStyle = rgb(lo); g.fillRect(px + 9 * k, py + 8 * k, 1 * k, 8 * k);
  g.fillStyle = rgb(col, 50); g.fillRect(px + 6 * k, py + 8 * k, 4 * k, 1.2 * k);
  g.fillStyle = "#2a2220"; g.fillRect(px + 7.6 * k, py + 6.4 * k, 0.9 * k, 1.8 * k);
  if (lit) {
    const t = now / 120 + tx * 1.9, fl = 1.4 + Math.sin(t) * 0.4;
    g.fillStyle = "#f08018"; g.fillRect(px + 7 * k, py + (6.6 - fl) * k, 2 * k, fl * k);
    g.fillStyle = "#ffe070"; g.fillRect(px + 7.4 * k, py + (6.6 - fl * 0.6) * k, 1.2 * k, fl * 0.6 * k);
  }
}
function drawPlankBox(g, src, px, py, tile) { g.drawImage(src.img, src.sx, src.sy, T9, T9, px, py, tile, tile); }

// ---------- Schilder ----------
function drawSign(g, px, py, tile, S, w, hanging, lines) {
  const k = tile / 16, base = woodRgb(w), lo = [base[0] * 0.7, base[1] * 0.7, base[2] * 0.7], hi = [Math.min(255, base[0] + 28), Math.min(255, base[1] + 24), Math.min(255, base[2] + 20)];
  const y0 = hanging ? 3 : 2, hh = hanging ? 11 : 11;
  if (hanging) { g.fillStyle = "#5e5e66"; g.fillRect(px + 2.5 * k, py, k, 4 * k); g.fillRect(px + 12.5 * k, py, k, 4 * k); g.fillStyle = lo && rgb(lo); g.fillRect(px, py, tile, k * 1.2); }
  g.fillStyle = rgb(lo); g.fillRect(px + 0.5 * k, py + (y0 - 0.5) * k, 15 * k, (hh + 1) * k);
  g.fillStyle = rgb(base); g.fillRect(px + 1 * k, py + y0 * k, 14 * k, hh * k);
  g.fillStyle = rgb(hi); g.fillRect(px + 1 * k, py + y0 * k, 14 * k, k * 0.8);
  if (!hanging) { g.fillStyle = rgb(lo); g.fillRect(px + 7.4 * k, py + (y0 + hh) * k, 1.2 * k, (16 - y0 - hh) * k); }
  if (lines && lines.some(Boolean)) {
    g.fillStyle = "#1c1410"; g.textBaseline = "top"; g.textAlign = "center";
    const fs = Math.max(4, Math.floor(hh * k / 4.6));
    g.font = `bold ${fs}px monospace`;
    lines.slice(0, 4).forEach((t, i) => { if (t) g.fillText(t, px + 8 * k, py + (y0 + 0.4) * k + i * (hh * k / 4.1), 13 * k); });
    g.textAlign = "start"; g.textBaseline = "alphabetic";
  }
}

// ---------- Rüstungsständer ----------
const ARM_COL = { leather: "#a0612f", iron: "#d6d9e4", gold: "#f4c93a", diamond: "#4fe0d8", elytra: "#8a7ac8" };
function drawStand(g, px, py, tile, ent) {
  const k = tile / 16, F = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(px + x * k, py + y * k, w * k, h * k); };
  F(3, 15, 10, 1, "#8a8a92"); F(3, 15, 10, 0.4, "#b8b8c0");
  F(7.3, 5.5, 1.4, 9.5, "#8c6a3a"); F(3.5, 6.5, 9, 1.2, "#8c6a3a"); F(4.5, 11, 1.2, 4, "#8c6a3a"); F(10.3, 11, 1.2, 4, "#8c6a3a"); F(6, 1, 4, 4, "#8c6a3a"); F(6, 1, 4, 0.6, "#b08a52");
  const s = ent ? ent.s : [], col = i => { const st = s[i]; return st ? ARM_COL[ITEMS[st.id].mat] || "#999" : null; };
  const h = col(0), c = col(1), l = col(2), b = col(3);
  if (h) { F(5.4, 0.2, 5.2, 5, h); F(6.4, 2.4, 3.2, 1.8, "rgba(0,0,0,0.35)"); F(5.4, 0.2, 5.2, 0.8, "rgba(255,255,255,0.35)"); }
  if (c) { F(4, 5.4, 8, 6.4, c); F(2.8, 5.6, 2, 5.4, c); F(11.2, 5.6, 2, 5.4, c); F(4, 5.4, 8, 0.8, "rgba(255,255,255,0.3)"); F(7.4, 6, 1.2, 5.4, "rgba(0,0,0,0.18)"); }
  if (l) { F(4.2, 11, 3.6, 3, l); F(8.2, 11, 3.6, 3, l); }
  if (b) { F(4, 13.6, 4, 2.4, b); F(8, 13.6, 4, 2.4, b); }
}

// ---------- Gemeißeltes Bücherregal ----------
const BOOK_COLS = ["#7a2a2a", "#2a4a7a", "#2a6a3a", "#7a5a2a", "#5a2a6a", "#2a6a6a"];
function drawCBook(g, px, py, tile, atlas, aux, ent) {
  const k = tile / 16;
  g.drawImage(atlas, COL9(B.CBOOKSHELF) * T9, 0, T9, T9, px, py, tile, tile);
  const slots = [[1.5, 1.5], [6, 1.5], [10.5, 1.5], [1.5, 9.5], [6, 9.5], [10.5, 9.5]];
  slots.forEach(([x, y], i) => {
    g.fillStyle = "#3a2810"; g.fillRect(px + x * k, py + y * k, 4 * k, 5.6 * k);
    if (aux & (1 << i)) {
      const st = ent && ent.s && ent.s[i], enchanted = st && st.id === "enchanted_book";
      g.fillStyle = enchanted ? "#6a3a9a" : BOOK_COLS[i % 6]; g.fillRect(px + (x + 0.6) * k, py + (y + 0.6) * k, 2.8 * k, 4.4 * k);
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(px + (x + 0.6) * k, py + (y + 0.6) * k, 0.8 * k, 4.4 * k);
      g.fillStyle = "#e8d49a"; g.fillRect(px + (x + 1.4) * k, py + (y + 1.6) * k, 1.2 * k, 0.8 * k);
    }
  });
}

/** Zeichnet die neuen Blöcke. true = gemalt */
export function drawBlock9(g, atlas, id, aux, px, py, tile, S, game, tx, ty) {
  if (id < FIRST9 || id > LAST9) return false;
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const ent = game && game.ents ? game.ents.get(tx + "," + ty) : null;
  const src = (cv, sx = 0, sy = 0) => g.drawImage(cv, sx, sy, T9, T9, px, py, tile, tile);
  switch (id) {
    case B.TERRA_C: src(terraTile(aux)); return true;
    case B.GLAZED: src(glazedTile(aux)); return true;
    case B.POWDER: src(powderTile(aux)); return true;
    case B.WPLANKS: if (aux & 15) src(plankTile(aux & 15)); else src(atlas, B.PLANKS * T9); return true;
    case B.WSTAIRS: case B.WSLAB: drawBoxes(g, matSource(atlas, "wood", aux & 15), boxesOf(id, aux), px, py, tile); return true;
    case B.SSTAIRS: case B.SSLAB: drawBoxes(g, matSource(atlas, "stone", aux & 15), boxesOf(id, aux), px, py, tile); return true;
    case B.COPPER_BLOCK: case B.CUT_COPPER: case B.CHISELED_COPPER: case B.COPPER_GRATE: case B.COPPER_BULB: case B.BULB_ON:
      src(copperTile(COPPER_FAM_BLOCK[id], aux & 3, id === B.BULB_ON));
      if (aux & 64) { g.fillStyle = "rgba(255,214,90,0.18)"; g.fillRect(px, py, tile, tile); }
      return true;
    case B.DOORM_B: case B.DOORM_T: case B.DOORM_BO: case B.DOORM_TO: {
      const m = aux & 15, st = m === 9 ? (aux >> 4) & 3 : 0, open = id === B.DOORM_BO || id === B.DOORM_TO, top = id === B.DOORM_T || id === B.DOORM_TO;
      const cv = doorTile(m, st, top, open);
      if (open) { const left = (aux & 128) === 0; g.drawImage(cv, 0, 0, 3, T9, left ? px : px + tile - tile * 3 / 16, py, tile * 3 / 16, tile); }
      else src(cv);
      return true;
    }
    case B.TRAP: case B.TRAP_O: case B.TRAP_OL: {
      const m = aux & 15, st = m === 9 ? (aux >> 4) & 3 : 0, cv = trapTile(m, st);
      for (const [x0, y0, x1, y1] of boxesOf(id, aux)) g.drawImage(cv, x0 * T9, y0 * T9, (x1 - x0) * T9, (y1 - y0) * T9, px + x0 * tile, py + y0 * tile, (x1 - x0) * tile, (y1 - y0) * tile);
      return true;
    }
    case B.BANNER: drawBannerBlock(g, px, py, tile, aux & 15, ent && ent.p); return true;
    case B.CANDLE: case B.CANDLE_LIT: drawCandle(g, px, py, tile, aux & 31 ? (aux & 16 ? 16 : aux & 15) : 0, id === B.CANDLE_LIT, now, tx); return true;
    case B.SIGN: drawSign(g, px, py, tile, S, aux & 15, false, ent && ent.l); return true;
    case B.HSIGN: drawSign(g, px, py, tile, S, aux & 15, true, ent && ent.l); return true;
    case B.ARMOR_STAND: drawStand(g, px, py, tile, ent); return true;
    case B.CBOOKSHELF: drawCBook(g, px, py, tile, atlas, aux, ent); return true;
    default: g.drawImage(atlas, COL9(id) * T9, 0, T9, T9, px, py, tile, tile); return true;
  }
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
const MATC = { leather: "#a0612f", iron: "#d6d9e4", gold: "#f4c93a", diamond: "#4fe0d8" };
/** Verzierung (Schmiedevorlage + Material) als Band auf dem Rüstungssymbol */
export function paintTrim(g, id, tr) {
  const it = ITEMS[id]; if (!it || !it.armor || !tr) return;
  const [pi, mi] = tr, col = (TRIM_MATS[TRIM_MAT_IDS[mi]] || ["", "#fff"])[1], slot = it.armor.slot;
  g.fillStyle = col;
  const y = slot === 0 ? 5 : slot === 1 ? 7 : slot === 2 ? 6 : 11;
  const p = pi % 8;
  if (p % 4 === 0) { g.fillRect(3, y, 10, 1); g.fillRect(3, y + 3, 10, 1); }
  else if (p % 4 === 1) { for (let i = 0; i < 5; i++) g.fillRect(3 + i * 2, y + (i % 2) * 2, 2, 1); }
  else if (p % 4 === 2) { g.fillRect(7, y - 1, 2, 5); g.fillRect(4, y + 1, 8, 1); }
  else { for (let i = 0; i < 4; i++) g.fillRect(4 + i * 2, y + i % 2, 1, 3); }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(3, y + 4, 10, 1);
}
/** Banner auf dem Schild */
export function paintShieldBanner(g, bp) {
  if (!bp) return;
  const cloth = bannerCloth(bp.c, bp.p);
  g.drawImage(cloth, 0, 0, BAN_W, BAN_H, 4, 3, 8, 10);
}
/** Malt das Symbol; true, wenn Etappe 9 den Gegenstand kennt. */
export function paintItem9(id, g, atlas, st) {
  const it = ITEMS[id]; if (!it) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const m = it.m9;
  if (m) {
    const k = m[0];
    if (k === "terra") g.drawImage(terraTile(m[1]), 0, 0);
    else if (k === "glazed") g.drawImage(glazedTile(m[1]), 0, 0);
    else if (k === "powder") g.drawImage(powderTile(m[1]), 0, 0);
    else if (k === "banner") paintBannerIcon(g, m[1], st && st.bp ? st.bp.p : null);
    else if (k === "candle") { drawCandle(g, 0, 0, 16, m[1], false, 0, 0); }
    else if (k === "wood") g.drawImage(plankTile(m[1]), 0, 0);
    else if (k === "wstairs" || k === "wslab" || k === "sstairs" || k === "sslab") {
      const wood = k[0] === "w", s = matSource(atlas, wood ? "wood" : "stone", m[1]), slab = k.endsWith("slab");
      if (slab) { g.drawImage(s.img, s.sx, s.sy + 8, 16, 8, 0, 8, 16, 8); R(0, 8, 16, 1, "rgba(255,255,255,0.2)"); R(0, 15, 16, 1, "rgba(0,0,0,0.25)"); }
      else drawBoxes(g, s, boxesOf(wood ? B.WSTAIRS : B.SSTAIRS, 0), 0, 0, 16);
    }
    else if (k === "sign") drawSign(g, 0, 0, 16, 1, m[1], false, null);
    else if (k === "hsign") drawSign(g, 0, 0, 16, 1, m[1], true, null);
    else if (k === "door") { const cs = m[1] === 9 ? m[2] : 0; g.drawImage(doorTile(m[1], cs, true, false), 0, 0, 16, 16, 3, 0, 10, 8); g.drawImage(doorTile(m[1], cs, false, false), 0, 0, 16, 16, 3, 8, 10, 8); }
    else if (k === "trap") { const cs = m[1] === 9 ? m[2] : 0; g.drawImage(trapTile(m[1], cs), 0, 0, 16, 16, 0, 0, 16, 16); R(0, 12, 16, 4, "rgba(0,0,0,0.0)"); }
    else if (k === "copper") {
      g.drawImage(copperTile(m[1], m[2], false), 0, 0);
      if (m[3]) { for (const [x, y] of [[3, 3], [10, 5], [5, 10], [12, 12]]) R(x, y, 2, 2, "rgba(255,214,90,0.55)"); }
    }
    return true;
  }
  if (it.block != null && it.block >= FIRST9 && it.block <= LAST9) {
    if (it.block === B.ARMOR_STAND) { drawStand(g, 0, 0, 16, null); return true; }
    if (it.block === B.CBOOKSHELF) { drawCBook(g, 0, 0, 16, atlas, 0b101011, null); return true; }
    g.drawImage(atlas, COL9(it.block) * T9, 0, T9, T9, 0, 0, T9, T9); return true;
  }
  if (id === "honeycomb") { for (const [x, y] of [[4, 4], [8, 3], [6, 7], [10, 7], [4, 10], [8, 11]]) { R(x, y, 3, 3, "#e8a424"); R(x, y, 3, 1, "#f8cc58"); R(x + 1, y + 1, 1, 1, "#a8700c"); } return true; }
  if (id === "honey_bottle") { R(6, 2, 4, 2, "#8a6a3a"); R(5, 4, 6, 1, "#d8e4ea"); R(4, 5, 8, 9, "#d8e4ea"); R(5, 6, 6, 7, "#e8a020"); R(5, 6, 6, 1, "#f8c850"); R(6, 8, 1, 3, "#ffe28a"); R(4, 14, 8, 1, "#9aa8b0"); return true; }
  if (id === "spyglass") { R(1, 10, 4, 3, "#c4683c"); R(4, 8, 4, 3, "#d4743c"); R(7, 6, 4, 3, "#c4683c"); R(10, 4, 5, 4, "#d88050"); R(14, 4, 1, 4, "#7a3a1c"); R(1, 10, 1, 3, "#6a2c14"); R(4, 8, 1, 1, "#f0a070"); R(10, 4, 5, 1, "#f0a070"); R(2, 11, 1, 1, "#a050e0"); return true; }
  if (it.trim != null) {
    R(2, 2, 12, 12, "#d8d2c0"); R(2, 2, 12, 1, "#fffaf0"); R(2, 13, 12, 1, "#9a9482"); R(2, 2, 1, 12, "#f4efe0"); R(13, 2, 1, 12, "#9a9482");
    const c = ["#3a7a96", "#e0b050", "#4a8a3a", "#5a5a64", "#2a6aa8", "#8a8aa0", "#5a4a8a", "#c8b898"][it.trim % 8];
    R(4, 4, 8, 1, c); R(4, 6, 2, 5, c); R(10, 6, 2, 5, c); R(6, 8, 4, 1, c); R(6, 10, 4, 1, c);
    return true;
  }
  return false;
}
