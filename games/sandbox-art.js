// =====================================================================
// Blockdorf – Grafik: Block-Texturen (16 × 16, aus Zufall gemalt), Gegenstands-Symbole, HUD-Symbole.
// Alles wird beim Start per Code gemalt, es gibt keine Bilddateien. Die Texturen sind eigene Malereien im
// kantigen Minecraft-Stil (nicht die Originale).
// =====================================================================
import { B, BLOCKS, ITEMS, MATERIALS } from "./sandbox-data.js?v=3";
import { mulberry32 } from "./sandbox-noise.js?v=3";

export const T = 16;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Spalte = Block-ID (0…50); Zusatz-Bilder ab 60. Zeile 1 enthält die nach Biom gefärbten Varianten von Gras, Laub und hohem Gras.
export const IDX = { FLOWER2: 60, FLOWER3: 61, WALL_DIRT: 62, WALL_STONE: 63, FURNACE_LIT: 64, CRACK: 65 /* 65…69 = Risse in 5 Stufen */, LAVA2: 70, WALL_DEEP: 71, WATER2: 72, ORE_DEEP: 80 /* 80…87 */ };
export const ORE_DEEP = { [B.COAL]: 80, [B.IRON]: 81, [B.GOLD]: 82, [B.DIAMOND]: 83, [B.COPPER]: 84, [B.REDSTONE]: 85, [B.LAPIS]: 86, [B.EMERALD]: 87 };
// Farb-Faktoren (R, G, B) für Gras/Laub je Biom – Reihenfolge wie BIOMES in sandbox-world.js
export const BIOME_TINT = [[1, 1, 1], [0.9, 0.96, 0.88], [1.04, 1.02, 0.88], [0.7, 0.92, 0.86], [0.82, 0.98, 0.94], [1.4, 0.96, 0.6], [1.38, 0.97, 0.62], [0.72, 1.14, 0.58], [0.74, 0.8, 0.56], [0.86, 1.0, 0.92], [1, 1, 1]];
const ATLAS_N = 96;

export function makeAtlas() {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_N * T; cv.height = T * 2;
  const g = cv.getContext("2d");
  const avg = [];
  const paint = (index, fn) => {
    const img = g.createImageData(T, T), d = img.data, r = mulberry32(index * 7919 + 13);
    const set = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= T || y >= T) return; const i = (y * T + x) * 4; d[i] = clamp(c[0], 0, 255); d[i + 1] = clamp(c[1], 0, 255); d[i + 2] = clamp(c[2], 0, 255); d[i + 3] = a; };
    fn(set, r);
    g.putImageData(img, index * T, 0);
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
    avg[index] = n ? [sr / n, sg / n, sb / n] : [200, 200, 200];
  };
  const noise = (c, k, r) => { const v = (r() - 0.5) * k; return [c[0] + v, c[1] + v, c[2] + v]; };
  const stoneBase = (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const patch = (((x >> 2) * 7 + (y >> 2) * 13) % 5) * 3 - 6;
      set(x, y, noise([122 + patch, 124 + patch, 130 + patch], 18, r));
    }
    for (let i = 0; i < 4; i++) { let x = Math.floor(r() * T), y = Math.floor(r() * T); for (let k = 0; k < 4; k++) { set(x, y, [88, 90, 98]); x += r() < 0.5 ? 1 : 0; y += 1; } }
  };
  const specks = (set, r, base, hi, count) => {
    for (let i = 0; i < count; i++) {
      const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13);
      set(x, y, base); set(x + 1, y, base); set(x, y + 1, noise(base, 10, r)); if (r() < 0.6) set(x + 1, y + 1, base);
      set(x, y, hi);
    }
  };
  const dirtPix = (set, r, y0 = 0) => { for (let y = y0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise([134, 96, 67], 26, r); const q = r(); if (q < 0.07) c = [c[0] - 30, c[1] - 24, c[2] - 20]; else if (q > 0.96) c = [c[0] + 18, c[1] + 14, c[2] + 10]; set(x, y, c); } };

  paint(B.AIR, () => {});
  paint(B.DIRT, (set, r) => dirtPix(set, r));
  paint(B.GRASS, (set, r) => {
    dirtPix(set, r, 4);
    const edge = []; for (let x = 0; x < T; x++) edge[x] = 3 + Math.floor(r() * 3);
    for (let x = 0; x < T; x++) for (let y = 0; y < edge[x]; y++) {
      const k = y / edge[x];
      set(x, y, noise([lerp(120, 78, k), lerp(200, 150, k), lerp(74, 48, k)], 14, r));
    }
    for (let x = 0; x < T; x++) { set(x, edge[x], [104, 78, 54]); if (r() < 0.35) set(x, 0, [150, 224, 96]); }
  });
  paint(B.STONE, (set, r) => stoneBase(set, r));
  paint(B.SAND, (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise([226, 206, 144], 16, r); if (r() < 0.07) c = [c[0] - 28, c[1] - 28, c[2] - 24]; set(x, y, c); } });
  paint(B.LOG, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const s = x % 4 === 0 ? -24 : x % 4 === 2 ? 10 : 0; set(x, y, noise([104 + s, 76 + s, 46 + s * 0.7], 10, r)); }
    for (let y = 6; y <= 10; y++) for (let x = 4; x <= 7; x++) if (((x - 5.5) ** 2) / 4 + ((y - 8) ** 2) / 7 < 1) set(x, y, [66, 46, 28]);
  });
  paint(B.LEAVES, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const q = r();
      if (q < 0.12) continue;                                      // Löcher: man sieht Himmel durch
      const col = q < 0.4 ? [38, 98, 42] : q < 0.8 ? [58, 130, 50] : [92, 164, 62];
      set(x, y, noise(col, 10, r));
    }
  });
  paint(B.PLANKS, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = noise([180, 134, 80], 14, r);
      if (y % 5 === 0) c = [128, 90, 52];
      else if ((x === 3 && y < 5) || (x === 11 && y > 5 && y < 10) || (x === 6 && y > 10)) c = [140, 100, 58];
      set(x, y, c);
    }
    for (const [x, y] of [[1, 2], [14, 2], [1, 7], [14, 7], [1, 12], [14, 12]]) set(x, y, [88, 62, 36]);
  });
  const ore = (id, base, hi, count) => paint(id, (set, r) => { stoneBase(set, r); specks(set, r, base, hi, count); });
  ore(B.COAL, [30, 30, 36], [92, 92, 100], 7);
  ore(B.IRON, [208, 152, 118], [240, 200, 170], 6);
  ore(B.GOLD, [246, 206, 62], [255, 244, 160], 6);
  paint(B.TORCH, (set) => {
    for (let y = 6; y < 16; y++) { set(7, y, [124, 88, 50]); set(8, y, [96, 66, 38]); }
    set(7, 5, [255, 190, 60]); set(8, 5, [255, 150, 40]); set(7, 4, [255, 225, 100]); set(8, 4, [255, 190, 60]); set(7, 3, [255, 240, 150]); set(8, 3, [255, 210, 80]); set(6, 4, [255, 140, 40], 190); set(9, 4, [255, 140, 40], 190);
  });
  paint(B.BENCH, (set, r) => {
    for (let x = 1; x < 15; x++) { set(x, 7, [186, 138, 84]); set(x, 8, noise([150, 104, 60], 10, r)); }
    for (let y = 9; y < 16; y++) { set(2, y, [110, 76, 44]); set(13, y, [110, 76, 44]); set(3, y, [90, 62, 36]); set(12, y, [90, 62, 36]); }
    for (let x = 3; x < 13; x++) { set(x, 12, [130, 92, 54]); set(x, 13, [104, 72, 42]); }
    for (let x = 4; x < 8; x++) set(x, 6, [196, 198, 206]); set(4, 5, [150, 106, 62]); set(5, 5, [150, 106, 62]);
    for (let y = 4; y < 7; y++) set(11, y, [150, 150, 160]);
  });
  paint(B.GLASS, (set) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === T - 1 || y === T - 1;
      set(x, y, edge ? [226, 246, 255] : [186, 226, 246], edge ? 190 : 56);
    }
    for (let i = 0; i < 5; i++) set(3 + i, 3 + i, [255, 255, 255], 190);
    for (let i = 0; i < 3; i++) set(3 + i, 8 + i, [255, 255, 255], 150);
  });
  paint(B.BRICK, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 0;
      set(x, y, mortar ? noise([198, 190, 182], 10, r) : noise([170, 80, 62], 16, r));
    }
  });
  paint(B.BEDROCK, (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise([50, 50, 58], 16, r); if (r() < 0.06) c = [c[0] + 30, c[1] + 30, c[2] + 34]; set(x, y, c); } });
  paint(B.COBBLE, (set, r) => {
    const cell = (x, y) => (((x + 1) >> 2) * 31 + ((y + (((x + 1) >> 2) % 2) * 2) >> 2) * 17) % 7;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = cell(x, y), base = 104 + c * 5, edge = x % 4 === 3 || (y + (((x + 1) >> 2) % 2) * 2) % 4 === 3;
      set(x, y, noise(edge ? [70, 72, 78] : [base, base + 2, base + 8], 14, r));
    }
  });
  ore(B.DIAMOND, [70, 220, 214], [220, 255, 252], 6);
  const furnaceBase = (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      set(x, y, noise(edge ? [70, 72, 78] : [124, 126, 132], 14, r));
    }
    for (let x = 0; x < T; x += 4) for (let y = 1; y < 15; y++) if (y % 4 === 3) set(x, y, [88, 90, 96]);
  };
  paint(B.FURNACE, (set, r) => { furnaceBase(set, r); for (let y = 6; y <= 12; y++) for (let x = 4; x <= 11; x++) set(x, y, [30, 30, 34]); for (let x = 3; x <= 12; x++) set(x, 5, [60, 60, 66]); for (let x = 5; x <= 10; x++) set(x, 3, [50, 50, 56]); });
  paint(IDX.FURNACE_LIT, (set, r) => {
    furnaceBase(set, r);
    for (let y = 6; y <= 12; y++) for (let x = 4; x <= 11; x++) set(x, y, [60, 20, 10]);
    for (const [x, y, c] of [[5, 12, [255, 120, 30]], [6, 11, [255, 170, 40]], [6, 12, [255, 200, 70]], [7, 10, [255, 150, 30]], [7, 11, [255, 220, 90]], [8, 11, [255, 180, 50]], [8, 12, [255, 240, 130]], [9, 12, [255, 130, 30]], [9, 11, [255, 200, 60]], [10, 12, [255, 110, 20]]]) set(x, y, c);
    for (let x = 3; x <= 12; x++) set(x, 5, [60, 60, 66]);
  });
  paint(B.CHEST, (set, r) => {
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      let c = noise([176, 128, 62], 12, r);
      if (y === 5 || y === 6) c = [120, 82, 36];
      if (x === 1 || x === 14) c = [128, 88, 40];
      if (y === 1) c = [200, 154, 84];
      if (y === 14) c = [110, 74, 32];
      set(x, y, c);
    }
    for (let x = 0; x < 16; x++) { set(x, 0, [70, 46, 20]); set(x, 15, [70, 46, 20]); }
    for (let y = 0; y < 16; y++) { set(0, y, [70, 46, 20]); set(15, y, [70, 46, 20]); }
    for (let y = 5; y <= 9; y++) for (let x = 7; x <= 8; x++) set(x, y, y === 5 ? [150, 150, 160] : [210, 210, 222]);
    set(7, 9, [120, 120, 130]); set(8, 9, [120, 120, 130]);
  });
  const doorTex = (id, top, open) => paint(id, (set, r) => {
    const x1 = open ? 3 : 15;
    for (let y = 0; y < T; y++) for (let x = 0; x <= x1; x++) {
      let c = noise([160, 112, 56], 12, r);
      if (!open && (x === 0 || x === 15)) c = [104, 70, 34];
      else if (open && x === 0) c = [200, 150, 90];
      else if (open && x === 3) c = [100, 66, 30];
      else if (!open && (y === 0 && top)) c = [104, 70, 34];
      else if (!open && ((top && ((y >= 3 && y <= 6) || (y >= 9 && y <= 13))) || (!top && ((y >= 2 && y <= 6) || (y >= 9 && y <= 12))))) c = x >= 3 && x <= 12 ? noise([140, 96, 46], 10, r) : c;
      if (!open && (y === 15 && !top)) c = [104, 70, 34];
      set(x, y, c);
    }
    if (!open && !top) for (const [x, y] of [[12, 8], [12, 7]]) set(x, y, [235, 235, 245]);
    if (!open && top) { /* Fenster */ for (let y = 3; y <= 6; y++) for (let x = 4; x <= 11; x++) set(x, y, [190, 226, 246], 200); }
  });
  doorTex(B.DOOR_B, false, false); doorTex(B.DOOR_T, true, false); doorTex(B.DOOR_BO, false, true); doorTex(B.DOOR_TO, true, true);
  paint(B.LADDER, (set, r) => {
    for (let y = 0; y < T; y++) { for (const x of [2, 3, 12, 13]) set(x, y, x % 2 ? [150, 104, 52] : [118, 80, 38]); }
    for (const y of [1, 5, 9, 13]) for (let x = 4; x <= 11; x++) set(x, y, noise([140, 96, 46], 10, r));
  });
  const flower = (index, petal) => paint(index, (set) => {
    for (let y = 8; y < 16; y++) set(7, y, [66, 146, 60]);
    set(6, 12, [66, 146, 60]); set(5, 11, [66, 146, 60]); set(8, 11, [66, 146, 60]); set(9, 10, [66, 146, 60]);
    for (const [x, y] of [[6, 5], [7, 4], [8, 5], [7, 6], [6, 6], [8, 6], [6, 4], [8, 4]]) set(x, y, petal);
    set(7, 5, [252, 232, 120]);
  });
  flower(B.FLOWER, [226, 62, 72]); flower(IDX.FLOWER2, [250, 210, 60]); flower(IDX.FLOWER3, [96, 136, 244]);
  paint(B.TALLGRASS, (set, r) => {
    for (const [x, hh] of [[2, 5], [4, 8], [6, 6], [8, 10], [10, 7], [12, 5], [13, 8]]) for (let y = 16 - hh; y < 16; y++) set(x, y, noise(y < 16 - hh + 2 ? [128, 206, 80] : [74, 150, 54], 12, r));
  });
  const wall = (index, base) => paint(index, (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise(base, 12, r); if (x % 8 === 0 || y % 8 === 0) c = [c[0] - 12, c[1] - 12, c[2] - 12]; set(x, y, c); } });
  wall(IDX.WALL_DIRT, [96, 70, 50]); wall(IDX.WALL_STONE, [70, 70, 80]);
  for (let k = 0; k < 5; k++) paint(IDX.CRACK + k, (set, r) => {
    let x = 8, y = 8;
    for (let n = 0; n < (k + 1) * 7; n++) { set(x, y, [20, 14, 10], 210); x = clamp(x + Math.floor(r() * 3) - 1, 0, 15); y = clamp(y + Math.floor(r() * 3) - 1, 0, 15); if (n % 7 === 6) { x = 8; y = 8; } }
    for (let n = 0; n < (k + 1) * 4; n++) { let cx = 8, cy = 8; const dx = r() < 0.5 ? -1 : 1, dy = r() < 0.5 ? -1 : 1; for (let s = 0; s < 8; s++) { cx += dx * (r() < 0.7 ? 1 : 0); cy += dy * (r() < 0.7 ? 1 : 0); set(cx, cy, [20, 14, 10], 190); } }
  });

  // ---------- Etappe 2: Biome, Flüssigkeiten, Tiefe ----------
  const px4 = (set, r, base, k, rare) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise(base, k, r); if (rare && r() < rare[0]) c = rare[1]; set(x, y, c); } };
  paint(B.GRAVEL, (set, r) => {
    px4(set, r, [130, 126, 124], 20);
    for (let i = 0; i < 16; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14), c = r() < 0.5 ? [98, 94, 94] : [168, 162, 158]; set(x, y, c); set(x + 1, y, c); set(x, y + 1, noise(c, 12, r)); }
  });
  paint(B.SNOW, (set, r) => px4(set, r, [244, 248, 252], 8, [0.08, [210, 226, 242]]));
  paint(B.GRASS_SNOW, (set, r) => {
    dirtPix(set, r, 5);
    const edge = []; for (let x = 0; x < T; x++) edge[x] = 4 + Math.floor(r() * 3);
    for (let x = 0; x < T; x++) { for (let y = 0; y < edge[x]; y++) set(x, y, noise(y < 2 ? [248, 251, 255] : [226, 238, 248], 8, r)); set(x, edge[x], [210, 224, 238]); }
  });
  paint(B.SANDSTONE, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = noise([222, 202, 142], 12, r);
      if (y === 0 || y === 15) c = [206, 184, 124]; else if (y === 5 || y === 10) c = [200, 176, 118];
      set(x, y, c);
    }
    for (let i = 0; i < 10; i++) set(1 + Math.floor(r() * 13), 1 + Math.floor(r() * 13), [236, 218, 162]);
  });
  paint(B.CACTUS, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x < 2 || x > 13;
      let c = noise(edge ? [30, 98, 44] : x % 4 === 2 ? [52, 138, 58] : [64, 156, 62], 8, r);
      set(x, y, c);
    }
    for (let y = 1; y < T; y += 3) for (const x of [4, 8, 12]) { set(x + (y % 2), y, [230, 238, 190]); }
    for (let y = 0; y < T; y++) { set(0, y, [22, 70, 32]); set(15, y, [22, 70, 32]); }
  });
  paint(B.DEADBUSH, (set, r) => {
    const br = [[8, 15, 8, 9], [8, 9, 4, 5], [8, 10, 12, 4], [6, 7, 3, 3], [10, 7, 13, 5]];
    for (const [x0, y0, x1, y1] of br) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), i % 2 ? [120, 82, 40] : [96, 64, 30]); }
  });
  const logTex = (id, base, dark, light) => paint(id, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const s = x % 4 === 0 ? -24 : x % 4 === 2 ? 10 : 0; set(x, y, noise([base[0] + s, base[1] + s, base[2] + s * 0.7], 10, r)); }
    for (let y = 6; y <= 10; y++) for (let x = 4; x <= 7; x++) if (((x - 5.5) ** 2) / 4 + ((y - 8) ** 2) / 7 < 1) set(x, y, dark);
    if (light) light(set, r);
  });
  logTex(B.BIRCH_LOG, [216, 214, 202], [60, 56, 50], (set, r) => { for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16), w = 2 + Math.floor(r() * 3); for (let k = 0; k < w; k++) set(x + k, y, [38, 36, 34]); } });
  logTex(B.SPRUCE_LOG, [66, 48, 30], [38, 26, 16]);
  logTex(B.JUNGLE_LOG, [92, 70, 40], [54, 38, 20], (set, r) => { for (let i = 0; i < 12; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [64, 104, 40]); });
  logTex(B.ACACIA_LOG, [126, 112, 98], [96, 70, 50], (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (x % 4 === 2 && r() < 0.5) set(x, y, [172, 98, 52]); });
  const leafTex = (id, cols, hole = 0.12) => paint(id, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const q = r(); if (q < hole) continue; set(x, y, noise(q < 0.4 ? cols[0] : q < 0.8 ? cols[1] : cols[2], 10, r)); }
  });
  leafTex(B.BIRCH_LEAVES, [[96, 140, 54], [122, 166, 66], [152, 192, 84]]);
  leafTex(B.SPRUCE_LEAVES, [[28, 66, 48], [40, 88, 60], [58, 112, 74]], 0.1);
  leafTex(B.JUNGLE_LEAVES, [[24, 112, 30], [38, 150, 38], [76, 190, 54]], 0.14);
  leafTex(B.ACACIA_LEAVES, [[88, 118, 40], [114, 146, 52], [146, 176, 68]]);
  // Wasser: zwei Bilder (Wellen verschieben sich)
  const waterTex = (id, ph) => paint(id, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const w = Math.sin((x + ph * 4) * 0.8 + y * 0.5) + Math.sin((x - ph * 3) * 0.4 - y * 1.1);
      let c = noise([46 + w * 5, 96 + w * 8, 214 + w * 5], 8, r);
      if (w > 1.5) c = [110, 160, 244];
      set(x, y, c, 178);
    }
  });
  waterTex(B.WATER, 0); waterTex(IDX.WATER2, 1);
  const lavaTex = (id, ph) => paint(id, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const w = Math.sin((x + ph * 5) * 0.7 + Math.sin(y * 0.6) * 2) + Math.sin(y * 0.9 - (x + ph * 3) * 0.3);
      let c = w > 1.1 ? [255, 214, 70] : w > 0.2 ? [250, 140, 30] : w > -0.8 ? [216, 76, 14] : [150, 36, 10];
      set(x, y, noise(c, 12, r));
    }
  });
  lavaTex(B.LAVA, 0); lavaTex(IDX.LAVA2, 1);
  // Tiefenschiefer, Erze, Obsidian, Eis, Ton
  const deepBase = (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = noise([60, 60, 68], 12, r);
      if (y % 5 === 0) c = [c[0] - 12, c[1] - 12, c[2] - 10]; else if ((x + y * 3) % 11 === 0) c = [c[0] + 14, c[1] + 14, c[2] + 16];
      set(x, y, c);
    }
  };
  paint(B.DEEPSLATE, deepBase);
  wall(IDX.WALL_DEEP, [38, 38, 46]);
  const ORES = [[B.COAL, [30, 30, 36], [92, 92, 100], 7], [B.IRON, [208, 152, 118], [240, 200, 170], 6], [B.GOLD, [246, 206, 62], [255, 244, 160], 6], [B.DIAMOND, [70, 220, 214], [220, 255, 252], 6],
    [B.COPPER, [196, 108, 70], [90, 190, 150], 7], [B.REDSTONE, [186, 22, 22], [255, 96, 80], 8], [B.LAPIS, [36, 66, 190], [110, 150, 250], 7], [B.EMERALD, [36, 190, 84], [170, 255, 190], 5]];
  for (const [id, base, hi, n] of ORES) {
    if (id >= 27) paint(id, (set, r) => { stoneBase(set, r); specks(set, r, base, hi, n); });
    paint(ORE_DEEP[id], (set, r) => { deepBase(set, r); specks(set, r, base, hi, n); });
  }
  paint(B.OBSIDIAN, (set, r) => { px4(set, r, [22, 14, 38], 14); for (let i = 0; i < 12; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); set(x, y, [74, 36, 120]); set(x + 1, y, [52, 26, 90]); } });
  paint(B.ICE, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, noise([150, 200, 250], 12, r), 215);
    for (let i = 0; i < 4; i++) { let x = 2 + Math.floor(r() * 10), y = Math.floor(r() * 5); for (let k = 0; k < 7; k++) { set(x, y, [226, 244, 255], 235); x += r() < 0.5 ? 1 : 0; y += 1; } }
  });
  paint(B.CLAY, (set, r) => px4(set, r, [160, 166, 184], 10, [0.06, [140, 146, 166]]));
  // ---------- gefärbte Varianten (Zeile 2): Gras, Laub, hohes Gras je Biom ----------
  {
    const grab = i => g.getImageData(i * T, 0, T, T);
    const srcs = [grab(B.GRASS), grab(B.LEAVES), grab(B.TALLGRASS)];
    BIOME_TINT.forEach((tn, bi) => {
      srcs.forEach((src, k) => {
        const out = g.createImageData(T, T), a = src.data, o = out.data;
        for (let i = 0; i < a.length; i += 4) {
          const green = a[i + 1] > a[i] + 6 && a[i + 1] > a[i + 2] + 6;
          o[i] = clamp(green ? a[i] * tn[0] : a[i], 0, 255); o[i + 1] = clamp(green ? a[i + 1] * tn[1] : a[i + 1], 0, 255); o[i + 2] = clamp(green ? a[i + 2] * tn[2] : a[i + 2], 0, 255); o[i + 3] = a[i + 3];
        }
        g.putImageData(out, (bi * 3 + k) * T, T);
      });
    });
  }
  return { cv, avg };
}


// ---------------------------------------------------------------------
// Gegenstands-Symbole (16 × 16)
// ---------------------------------------------------------------------
const MAT_COL = {
  wood: ["#a4743f", "#c89658", "#6e4a24"], stone: ["#8d8f98", "#b4b6bf", "#5e6068"], iron: ["#d6d9e4", "#f4f5fa", "#8e91a0"],
  gold: ["#f4c93a", "#fff0a0", "#b8861a"], diamond: ["#4fe0d8", "#c8fffa", "#1f9c9e"]
};
const STICK = "#7a5230";

function paintItem(g, atlas, id) {
  const it = ITEMS[id];
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, c, w = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w, c); };
  if (it.block != null) {
    const idx = id === "flower" ? B.FLOWER : id === "door" ? B.DOOR_B : it.block;
    g.drawImage(atlas, idx * T, 0, T, T, 0, 0, T, T);
    return;
  }
  if (it.tool) {
    const [c, hi, lo] = MAT_COL[it.mat];
    if (it.tool === "pick") {
      line(3, 14, 11, 6, STICK, 2);
      R(4, 3, 3, 2, c); R(6, 2, 5, 2, c); R(10, 3, 3, 2, c); R(12, 5, 2, 4, c); R(7, 2, 4, 1, hi); R(12, 5, 1, 3, lo);
    } else if (it.tool === "axe") {
      line(3, 14, 10, 7, STICK, 2);
      R(8, 2, 5, 2, c); R(7, 4, 6, 3, c); R(11, 7, 2, 2, c); R(8, 2, 5, 1, hi); R(12, 4, 1, 4, lo);
    } else if (it.tool === "shovel") {
      line(3, 14, 9, 8, STICK, 2);
      R(9, 3, 4, 5, c); R(10, 2, 2, 1, c); R(9, 3, 1, 4, hi); R(12, 4, 1, 4, lo);
    } else if (it.tool === "hoe") {
      line(3, 14, 10, 7, STICK, 2);
      R(8, 3, 5, 2, c); R(8, 3, 5, 1, hi); R(8, 5, 2, 2, c); R(12, 4, 1, 1, lo);
    } else {
      line(4, 12, 12, 4, c, 2); line(5, 12, 12, 5, hi, 1); P(12, 3, c); P(13, 3, hi);
      R(3, 11, 5, 2, lo); line(2, 14, 4, 12, STICK, 2); P(1, 15, "#4a3018");
    }
    return;
  }
  if (it.armor) {
    const [c, hi, lo] = MAT_COL[it.mat], s = it.armor.slot;
    if (s === 0) { R(3, 4, 10, 6, c); R(2, 7, 2, 5, c); R(12, 7, 2, 5, c); R(5, 8, 6, 3, "#00000055"); R(3, 4, 10, 1, hi); R(2, 11, 2, 1, lo); R(12, 11, 2, 1, lo); }
    else if (s === 1) { R(2, 3, 12, 11, c); R(1, 3, 3, 4, c); R(12, 3, 3, 4, c); R(6, 2, 4, 3, "#00000055"); R(2, 3, 12, 1, hi); R(4, 13, 8, 1, lo); R(7, 5, 2, 8, lo); }
    else if (s === 2) { R(3, 2, 10, 5, c); R(3, 7, 4, 8, c); R(9, 7, 4, 8, c); R(3, 2, 10, 1, hi); R(7, 7, 2, 1, "#00000055"); R(6, 14, 1, 1, lo); R(9, 14, 1, 1, lo); }
    else { R(3, 5, 4, 8, c); R(9, 5, 4, 8, c); R(2, 10, 5, 4, c); R(9, 10, 5, 4, c); R(3, 5, 4, 1, hi); R(9, 5, 4, 1, hi); R(2, 13, 5, 1, lo); R(9, 13, 5, 1, lo); }
    return;
  }
  switch (id) {
    case "coal": R(3, 7, 7, 6, "#222228"); R(7, 4, 6, 6, "#30303a"); R(4, 8, 2, 1, "#5c5c68"); R(9, 5, 2, 1, "#6a6a76"); break;
    case "charcoal": R(3, 7, 7, 6, "#3a3028"); R(7, 4, 6, 6, "#4a3e34"); R(4, 8, 2, 1, "#7a6a58"); R(9, 5, 2, 1, "#8a7a68"); break;
    case "raw_iron": R(3, 5, 9, 8, "#b49a86"); R(4, 4, 6, 2, "#c8b09a"); R(5, 7, 2, 2, "#e8a070"); R(9, 9, 2, 2, "#d08858"); R(4, 12, 8, 1, "#8a7260"); break;
    case "raw_gold": R(3, 5, 9, 8, "#cdb35a"); R(4, 4, 6, 2, "#e6cf72"); R(5, 7, 2, 2, "#fff0a0"); R(9, 9, 2, 2, "#f2c93c"); R(4, 12, 8, 1, "#9a8530"); break;
    case "iron_ingot": case "gold_ingot": {
      const [a, b, c] = id === "iron_ingot" ? ["#d0d3de", "#f4f5fa", "#8e91a0"] : ["#f2c93c", "#fff0a0", "#c08e1c"];
      R(2, 7, 12, 5, a); R(3, 6, 10, 1, b); R(2, 12, 12, 1, c); R(2, 7, 1, 5, b); R(13, 7, 1, 6, c); break;
    }
    case "diamond": R(5, 3, 6, 2, "#c8fffa"); R(3, 5, 10, 3, "#4fe0d8"); R(4, 8, 8, 2, "#2fbfc0"); R(6, 10, 4, 2, "#1f9c9e"); R(7, 12, 2, 1, "#1f9c9e"); R(6, 3, 2, 1, "#ffffff"); break;
    case "stick": line(3, 14, 12, 4, STICK, 2); line(4, 13, 11, 5, "#9a6c3c", 1); break;
    case "apple": R(4, 5, 8, 7, "#d63a2c"); R(5, 4, 6, 1, "#e85a44"); R(5, 12, 6, 1, "#a82418"); R(5, 6, 2, 2, "#ff8a76"); R(7, 2, 1, 3, "#5a3a20"); R(8, 2, 3, 2, "#4aa84a"); break;
    case "slimeball": R(4, 5, 8, 8, "#5cc878"); R(5, 4, 6, 1, "#7ce09a"); R(5, 13, 6, 1, "#3c9858"); R(6, 6, 2, 2, "#b4f4c4"); break;
    case "raw_copper": R(3, 5, 9, 8, "#b8795a"); R(4, 4, 6, 2, "#d49270"); R(5, 7, 2, 2, "#68c8a4"); R(9, 9, 2, 2, "#e8a07c"); R(4, 12, 8, 1, "#8a583e"); break;
    case "copper_ingot": R(2, 7, 12, 5, "#d4825a"); R(3, 6, 10, 1, "#f2a880"); R(2, 12, 12, 1, "#a05a38"); R(2, 7, 1, 5, "#f2a880"); R(13, 7, 1, 6, "#a05a38"); break;
    case "redstone": R(4, 8, 8, 4, "#b01818"); R(5, 6, 6, 3, "#d82424"); R(3, 10, 3, 2, "#8c1010"); R(9, 5, 3, 2, "#ff5a48"); R(6, 9, 2, 1, "#ff8a78"); R(10, 11, 3, 2, "#e03030"); break;
    case "lapis": R(4, 5, 8, 8, "#2848b8"); R(5, 4, 6, 1, "#4a6ae0"); R(5, 13, 6, 1, "#1a2c80"); R(6, 6, 2, 2, "#8aa8ff"); R(9, 9, 2, 2, "#3a5ad0"); break;
    case "emerald": R(5, 3, 6, 2, "#9af0b0"); R(3, 5, 10, 3, "#28c05c"); R(4, 8, 8, 2, "#1a9a46"); R(6, 10, 4, 2, "#127836"); R(6, 3, 2, 1, "#e0ffe8"); break;
    case "bucket": case "water_bucket": case "lava_bucket": {
      R(3, 5, 10, 1, "#9a9ca8"); R(4, 6, 8, 7, "#c4c7d2"); R(5, 13, 6, 1, "#8a8d9a"); R(4, 6, 1, 7, "#e6e8f0"); R(11, 6, 1, 7, "#8a8d9a"); R(5, 3, 1, 3, "#8a8d9a"); R(10, 3, 1, 3, "#8a8d9a"); R(5, 3, 6, 1, "#8a8d9a");
      if (id === "water_bucket") { R(5, 6, 6, 3, "#3f78e8"); R(5, 6, 6, 1, "#8ab4ff"); }
      else if (id === "lava_bucket") { R(5, 6, 6, 3, "#f08a1c"); R(5, 6, 6, 1, "#ffd24a"); R(8, 7, 2, 1, "#e0480c"); }
      break;
    }
    default: R(4, 4, 8, 8, "#f0f"); break;
  }
}

/** Liefert { atlas, avg, icon(id, size) → neues Canvas, base(id) → 16×16-Canvas (zwischengespeichert) } */
export function makeArt() {
  const { cv: atlas, avg } = makeAtlas();
  const cache = new Map();
  const base = id => {
    let c = cache.get(id);
    if (!c) { c = document.createElement("canvas"); c.width = c.height = T; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; paintItem(g, atlas, id); cache.set(id, c); }
    return c;
  };
  const icon = (id, size) => {
    const c = document.createElement("canvas"); c.width = c.height = size; c.className = "sb-ic";
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(base(id), 0, 0, size, size);
    return c;
  };
  const hud = {};
  const mk = (key, rows, colors, empty) => {
    const w = rows[0].length, h = rows.length;
    const draw = (frac) => {          // frac: 1 voll, 0.5 halb, 0 leer
      const c = document.createElement("canvas"); c.width = w + 2; c.height = h + 2; c.className = "sb-hi";
      const g = c.getContext("2d");
      const at = (x, y) => (rows[y] && rows[y][x]) || ".";
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
        const ch = at(x, y);
        if (ch === ".") { if ("XBH".includes(at(x - 1, y)) || "XBH".includes(at(x + 1, y)) || "XBH".includes(at(x, y - 1)) || "XBH".includes(at(x, y + 1))) { g.fillStyle = "#1a0d0d"; g.fillRect(x + 1, y + 1, 1, 1); } continue; }
        const full = frac >= 1 || (frac > 0 && x < w / 2);
        g.fillStyle = !full ? empty : ch === "X" ? colors[0] : ch === "H" ? colors[1] : colors[2];
        g.fillRect(x + 1, y + 1, 1, 1);
      }
      return c;
    };
    hud[key] = draw;
  };
  mk("heart", ["..XX.XX..", ".XHXXXXX.", "XHXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "...XXX...", "....X...."], ["#e02a34", "#ff9a9a", "#e02a34"], "#3a2a2a");
  mk("food", ["....XXXX.", "...XHXXXX", "...XXXXXX", "...XXXXXX", "....XXXX.", "..BBX....", ".BB......", "BB......."], ["#b8642c", "#e8a064", "#f2f0e6"], "#3a302a");
  mk("bubble", [".XXXX.", "XHXXXX", "XHXXXX", "XXXXXX", ".XXXX."], ["#5ab0ff", "#e4f4ff", "#5ab0ff"], "#26334a");
  mk("armor", ["X.XXXXX.X", "XXXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", ".XXXXXXX.", "..XXXXX..", "...XXX..."], ["#aeb4c4", "#e8ecf8", "#aeb4c4"], "#3a3c44");
  return { atlas, avg, base, icon, hud };
}
