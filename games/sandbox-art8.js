// =====================================================================
// Blockdorf – Grafik der Etappe 8: Berge, üppige und Tropfstein-Höhlen, Kirschhain, Mangrovensumpf, Bambuswald, Fossilien.
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit (kräftige Schattierung, wenige Farben je Block).
// =====================================================================
import { B, ITEMS } from "./sandbox-data.js?v=9";

export const T8 = 16;
export const FIRST8 = B.POWDER_SNOW, LAST8 = B.FOSSIL;
/** Spalte im Atlas für die Blöcke der Etappe 8 (Spalten 224… sind frei) */
export const COL8 = id => 224 + (id - FIRST8);

export function paintAtlas8(paint, noise, specks) {
  const px = (set, x, y, w, h, c, a = 255) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, a); };
  const fill = (set, r, base, k = 16) => { for (let y = 0; y < T8; y++) for (let x = 0; x < T8; x++) set(x, y, noise(base, k, r)); };
  const dots = (set, r, c, n) => { for (let i = 0; i < n; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), c); };
  const P = id => COL8(id);

  // ---------- Pulverschnee: weich, mit hellen Löchern ----------
  paint(P(B.POWDER_SNOW), (set, r) => {
    fill(set, r, [238, 242, 248], 10);
    for (let i = 0; i < 16; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); px(set, x, y, 2, 2, [214, 224, 238]); set(x, y, [255, 255, 255]); }
    dots(set, r, [196, 210, 230], 14);
  });
  // ---------- Gepacktes Eis ----------
  paint(P(B.PACKED_ICE), (set, r) => {
    fill(set, r, [150, 190, 238], 14);
    for (let k = 0; k < 4; k++) { let x = Math.floor(r() * 16), y = Math.floor(r() * 16); for (let i = 0; i < 7; i++) { set(x, y, [208, 232, 255]); x++; y += r() < 0.5 ? 1 : 0; } }
    for (let i = 0; i < 5; i++) { let x = Math.floor(r() * 14), y = Math.floor(r() * 14); set(x, y, [104, 150, 214]); set(x + 1, y + 1, [104, 150, 214]); }
    for (let i = 0; i < 16; i++) { set(i, 0, [190, 218, 250]); set(0, i, [190, 218, 250]); set(15, i, [118, 160, 220]); set(i, 15, [118, 160, 220]); }
  });
  // ---------- Kalzit ----------
  paint(P(B.CALCITE), (set, r) => {
    fill(set, r, [226, 224, 216], 12);
    for (let y = 3; y < 16; y += 5) for (let x = 0; x < 16; x++) if (r() < 0.8) set(x, y + (x >> 3), [200, 198, 190]);
    for (let i = 0; i < 10; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [248, 246, 240]);
    for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [162, 160, 154]);
  });
  // ---------- Tuff ----------
  paint(P(B.TUFF), (set, r) => {
    fill(set, r, [112, 112, 102], 14);
    for (let i = 0; i < 7; i++) px(set, Math.floor(r() * 13), Math.floor(r() * 13), 2 + Math.floor(r() * 3), 2, noise([86, 88, 78], 10, r));
    for (let i = 0; i < 9; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [150, 148, 134]);
    for (let i = 0; i < 4; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [150, 128, 96]);
  });
  // ---------- Tropfstein ----------
  paint(P(B.DRIPSTONE), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise([(x + (y >> 2)) % 5 < 2 ? 146 : 128, (x + (y >> 2)) % 5 < 2 ? 112 : 98, 84], 14, r));
    for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 14); set(x, y, [92, 70, 56]); set(x, y + 1, [92, 70, 56]); }
    dots(set, r, [176, 140, 108], 10);
  });
  const spike = (up) => (set, r) => {
    for (let y = 0; y < 16; y++) {
      const t = up ? (15 - y) / 15 : y / 15;             // 1 an der Spitze
      const hw = Math.max(0, Math.round(7.2 * (1 - t) ** 0.9));
      if (t >= 0.97) continue;
      for (let x = 8 - hw - (hw > 0 ? 1 : 0); x < 8 + hw + 1; x++) {
        const edge = x === 8 - hw - 1 || x === 8 + hw, c = edge ? [92, 70, 56] : x < 8 ? [150, 118, 90] : [126, 98, 74];
        set(x, y, noise(c, 10, r));
      }
    }
    for (let i = 0; i < 6; i++) { const y = up ? 9 + Math.floor(r() * 6) : Math.floor(r() * 6); set(6 + Math.floor(r() * 3), y, [176, 142, 108]); }
  };
  paint(P(B.STALAGMITE), spike(true));
  paint(P(B.STALACTITE), spike(false));
  // ---------- Amethyst ----------
  paint(P(B.AMETHYST_BLOCK), (set, r) => {
    fill(set, r, [146, 96, 196], 14);
    for (const [x, y] of [[1, 1], [8, 2], [4, 7], [11, 9], [2, 12], [9, 13]]) { px(set, x, y, 4, 3, [172, 124, 222]); px(set, x + 1, y + 1, 2, 1, [208, 166, 250]); set(x + 3, y + 2, [108, 66, 156]); }
    dots(set, r, [96, 58, 142], 8);
  });
  paint(P(B.AMETHYST_CLUSTER), (set, r) => {
    const crystal = (cx, base, h, w) => {
      for (let i = 0; i < h; i++) { const hw = i > h - 3 ? 0 : w; for (let x = cx - hw; x <= cx + hw; x++) set(x, base - i, x <= cx - hw + (hw ? 0 : 0) && hw ? [190, 140, 238] : x === cx + hw && hw ? [104, 62, 152] : [158, 108, 208]); }
      set(cx, base - h + 1, [226, 190, 255]);
    };
    px(set, 3, 13, 10, 3, [98, 72, 112]);
    crystal(4, 13, 7, 1); crystal(8, 13, 11, 1); crystal(12, 13, 6, 1); crystal(6, 13, 4, 0); crystal(10, 13, 5, 0);
    dots(set, r, [108, 80, 124], 5);
  });
  // ---------- Moos ----------
  paint(P(B.MOSS_BLOCK), (set, r) => {
    fill(set, r, [88, 118, 46], 16);
    for (let i = 0; i < 16; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); set(x, y, [122, 152, 62]); set(x + 1, y, [62, 90, 32]); }
    dots(set, r, [140, 168, 78], 8);
  });
  paint(P(B.MOSS_CARPET), (set, r) => {
    for (let x = 0; x < 16; x++) for (let y = 13; y < 16; y++) set(x, y, noise(y === 13 ? [112, 144, 58] : [84, 114, 44], 14, r));
    for (let x = 0; x < 16; x += 3) set(x, 12, [100, 132, 52]);
  });
  // ---------- Azalee ----------
  const azalea = (flowers) => (set, r) => {
    px(set, 7, 9, 2, 6, [112, 84, 52]); px(set, 6, 13, 1, 2, [112, 84, 52]); px(set, 9, 14, 1, 1, [112, 84, 52]); px(set, 5, 15, 6, 1, [86, 62, 40]);
    for (let y = 1; y < 10; y++) for (let x = 1; x < 15; x++) {
      const dx = (x - 7.5) / 6.6, dy = (y - 5) / 4.6;
      if (dx * dx + dy * dy < 1 + (r() - 0.5) * 0.35) set(x, y, noise([62, 112, 44], 22, r));
    }
    dots(set, r, [96, 150, 64], 14); dots(set, r, [34, 72, 28], 10);
    if (flowers) for (const [x, y] of [[3, 3], [7, 2], [11, 4], [5, 6], [9, 6], [12, 7], [2, 5]]) { set(x, y, [230, 120, 200]); set(x + 1, y, [250, 170, 224]); set(x, y + 1, [200, 84, 170]); }
  };
  paint(P(B.AZALEA), azalea(false)); paint(P(B.FLOWERING_AZALEA), azalea(true));
  const leaves = (base, dark, light, flowers) => (set, r) => {
    fill(set, r, base, 24);
    dots(set, r, dark, 28); dots(set, r, light, 14);
    for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [20, 12, 8]);
    if (flowers) for (let i = 0; i < 12; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); set(x, y, [236, 128, 206]); set(x + 1, y, [252, 176, 232]); }
  };
  paint(P(B.AZALEA_LEAVES), leaves([66, 116, 48], [38, 78, 30], [102, 156, 70], false));
  paint(P(B.FLOWERING_AZALEA_LEAVES), leaves([66, 116, 48], [38, 78, 30], [102, 156, 70], true));
  // ---------- Höhlenranken, Glühbeeren ----------
  const vine = (berries) => (set, r) => {
    for (let y = 0; y < 16; y++) {
      const x = 8 + Math.round(Math.sin(y * 0.55) * 1.2);
      set(x, y, noise([76, 126, 52], 14, r)); set(x + 1, y, [44, 84, 36]);
      if (y % 4 === 2) { set(x - 1, y, [96, 150, 64]); set(x - 2, y + 1, [76, 126, 52]); set(x + 2, y + 1, [60, 104, 44]); set(x + 3, y + 1, [96, 150, 64]); }
    }
    if (berries) for (const [x, y] of [[6, 5], [10, 9], [7, 12], [10, 3]]) { px(set, x, y, 2, 2, [250, 170, 40]); set(x, y, [255, 226, 110]); set(x + 1, y + 1, [214, 112, 20]); }
  };
  paint(P(B.CAVE_VINES), vine(false)); paint(P(B.CAVE_VINES_BERRIES), vine(true));
  // ---------- Leuchtflechte ----------
  paint(P(B.GLOW_LICHEN), (set, r) => {
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(r() * 14), y = Math.floor(r() * 14), w = 1 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 2);
      px(set, x, y, w, h, noise([128, 200, 150], 18, r), 200); set(x, y, [196, 244, 214], 230);
    }
    dots(set, r, [72, 142, 104], 16);
  });
  // ---------- Kirschholz, Kirschlaub, Blütenblätter ----------
  paint(P(B.CHERRY_LOG), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = (x + 1) % 4 === 0; set(x, y, noise(s ? [112, 62, 78] : [160, 100, 112], 12, r)); }
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 13); px(set, x, y, 1, 3, [92, 48, 62]); }
    for (let i = 0; i < 8; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [196, 136, 146]);
    for (let y = 0; y < 16; y++) { set(0, y, [120, 70, 84]); set(15, y, [108, 60, 74]); }
  });
  paint(P(B.CHERRY_LEAVES), (set, r) => {
    fill(set, r, [236, 160, 192], 24);
    dots(set, r, [204, 116, 156], 26); dots(set, r, [255, 204, 224], 18); dots(set, r, [250, 232, 240], 6);
    for (let i = 0; i < 4; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [90, 50, 60]);
  });
  paint(P(B.PINK_PETALS), (set, r) => {
    for (const [x, y] of [[2, 11], [7, 12], [11, 10], [4, 14], [9, 14]]) {
      px(set, x, y, 3, 2, noise([244, 170, 204], 14, r)); set(x, y, [255, 218, 234]); set(x + 2, y + 1, [210, 120, 164]); set(x + 1, y + 2, [92, 140, 60]);
    }
    for (const x of [4, 9, 12]) set(x, 13, [92, 140, 60]);
  });
  // ---------- Mangrove ----------
  paint(P(B.MANGROVE_LOG), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const s = (x * 5 + 2) % 7 < 2; set(x, y, noise(s ? [78, 38, 36] : [112, 60, 52], 14, r)); }
    for (let i = 0; i < 7; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 12); px(set, x, y, 1, 3 + Math.floor(r() * 3), [58, 28, 28]); }
    dots(set, r, [140, 84, 66], 8);
  });
  paint(P(B.MANGROVE_LEAVES), leaves([62, 108, 40], [34, 72, 28], [92, 144, 60], false));
  paint(P(B.MANGROVE_ROOTS), (set, r) => {
    fill(set, r, [60, 40, 28], 10);
    for (let k = 0; k < 5; k++) {
      let x = 1 + Math.floor(r() * 14);
      for (let y = 0; y < 16; y++) { px(set, x, y, 2, 1, noise([112, 76, 46], 16, r)); set(x, y, [136, 96, 60]); if (r() < 0.35) x = Math.max(0, Math.min(14, x + (r() < 0.5 ? -1 : 1))); }
    }
    for (let i = 0; i < 12; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [34, 22, 16]);
  });
  paint(P(B.MUD), (set, r) => {
    fill(set, r, [64, 54, 52], 10);
    for (let i = 0; i < 8; i++) { const x = Math.floor(r() * 13), y = Math.floor(r() * 14); px(set, x, y, 3, 1, [82, 70, 66]); }
    dots(set, r, [44, 36, 36], 12);
  });
  paint(P(B.PROPAGULE), (set, r) => {
    px(set, 7, 7, 2, 9, [84, 130, 56]); set(7, 8, [112, 160, 74]); set(8, 14, [60, 98, 40]);
    px(set, 4, 5, 3, 2, [70, 116, 48]); px(set, 9, 4, 3, 2, [96, 144, 62]); set(5, 4, [112, 160, 74]); set(10, 3, [124, 172, 84]);
    px(set, 7, 2, 2, 5, [52, 96, 40]); set(7, 1, [44, 80, 34]);                  // hängende Schote
    px(set, 5, 15, 6, 1, [70, 52, 40]);
  });
  // ---------- Bambus ----------
  paint(P(B.BAMBOO), (set, r) => {
    for (let y = 0; y < 16; y++) {
      px(set, 7, y, 3, 1, noise([112, 168, 56], 14, r)); set(7, y, [150, 204, 84]); set(9, y, [66, 116, 38]);
      if (y % 5 === 3) px(set, 6, y, 5, 1, [88, 134, 44]);
    }
    set(10, 4, [94, 150, 54]); set(11, 3, [118, 176, 68]); set(12, 3, [118, 176, 68]); set(5, 10, [94, 150, 54]); set(4, 9, [118, 176, 68]);
  });
  paint(P(B.BAMBOO_BLOCK), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(x % 4 === 0 ? [118, 150, 54] : x % 4 === 3 ? [170, 160, 70] : [198, 184, 84], 12, r));
    for (const y of [3, 10]) for (let x = 0; x < 16; x++) set(x, y, noise([146, 134, 60], 8, r));
    for (let y = 0; y < 16; y++) { set(0, y, [104, 130, 48]); set(15, y, [124, 112, 50]); }
  });
  // ---------- Fossil: Stein mit Knochenrippen ----------
  paint(P(B.FOSSIL), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise([168, 156, 128], 16, r));
    for (let k = 0; k < 3; k++) {
      const x0 = 1 + k * 5;
      for (let i = 0; i < 9; i++) { const x = x0 + Math.round(Math.sin(i * 0.35) * 2), y = 3 + i; set(x, y, [236, 230, 212]); set(x + 1, y, [190, 182, 160]); }
      set(x0 + 1, 2, [244, 240, 226]); set(x0, 12, [212, 206, 186]);
    }
    dots(set, r, [124, 112, 88], 12);
  });
  void specks; void ITEMS;
}

/** Zeichnet die Blöcke der Etappe 8 (nur das Bild aus dem Atlas). true = gemalt */
export function drawBlock8(g, atlas, id, aux, px, py, tile) {
  if (id < FIRST8 || id > LAST8) return false;
  g.drawImage(atlas, COL8(id) * T8, 0, T8, T8, px, py, tile, tile);
  return true;
}

/** Symbole der Gegenstände der Etappe 8; true, wenn bekannt */
export function paintItem8(id, g, atlas) {
  const it = ITEMS[id]; if (!it) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  if (it.block != null && it.block >= FIRST8 && it.block <= LAST8) { g.drawImage(atlas, COL8(it.block) * T8, 0, T8, T8, 0, 0, T8, T8); return true; }
  if (id === "amethyst_shard") { R(7, 2, 2, 11, "#9a68d0"); R(6, 4, 1, 7, "#b88ae8"); R(9, 5, 1, 6, "#6c3fa0"); R(7, 1, 2, 1, "#d8b4fa"); R(7, 2, 1, 4, "#d2a8f6"); R(6, 6, 1, 1, "#d2a8f6"); R(7, 12, 2, 2, "#7a4ab0"); return true; }
  if (id === "glow_berries") { R(5, 4, 3, 3, "#f8b030"); R(9, 7, 3, 3, "#f8b030"); R(6, 9, 3, 3, "#f8b030"); R(5, 4, 1, 1, "#ffe890"); R(9, 7, 1, 1, "#ffe890"); R(6, 9, 1, 1, "#ffe890"); R(7, 6, 1, 1, "#d87818"); R(11, 9, 1, 1, "#d87818"); R(8, 11, 1, 1, "#d87818"); R(7, 1, 1, 3, "#4c8a38"); R(8, 3, 2, 1, "#4c8a38"); return true; }
  return false;
}
