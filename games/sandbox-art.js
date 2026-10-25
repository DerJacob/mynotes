// =====================================================================
// Blockdorf – Grafik: Block-Texturen (16 × 16, aus Zufall gemalt), Gegenstands-Symbole, HUD-Symbole.
// Alles wird beim Start per Code gemalt, es gibt keine Bilddateien. Die Texturen sind eigene Malereien im
// kantigen Minecraft-Stil (nicht die Originale).
// =====================================================================
import { B, BLOCKS, ITEMS, MATERIALS } from "./sandbox-data.js?v=2";
import { mulberry32 } from "./sandbox-engine.js?v=2";

export const T = 16;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const IDX = { FLOWER2: 27, FLOWER3: 28, WALL_DIRT: 29, WALL_STONE: 30, FURNACE_LIT: 31, CRACK: 32 };   // 32…36 = Risse in 5 Stufen
const ATLAS_N = 37;

export function makeAtlas() {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_N * T; cv.height = T;
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
  mk("armor", ["X.XXXXX.X", "XXXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", ".XXXXXXX.", "..XXXXX..", "...XXX..."], ["#aeb4c4", "#e8ecf8", "#aeb4c4"], "#3a3c44");
  return { atlas, avg, base, icon, hud };
}
