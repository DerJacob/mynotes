// =====================================================================
// Blockdorf – Grafik der Etappe 4: Ackerbau, Redstone, Verzauberung, Brauen.
// Texturen werden beim Start gemalt (eigene Bilder, 16 × 16). Dreh- und spiegelbare Bauteile (Kolben, Hebel,
// Spender …) sind einmal "nach rechts" bzw. "unten angebracht" gemalt und werden beim Zeichnen gedreht.
// =====================================================================
import { B, BLOCKS } from "./sandbox-data.js?v=8";
import { potionColor } from "./sandbox-brew.js?v=8";

export const T4 = 16;
/** Atlas-Plätze der Zusatzbilder (Spalte im Atlas; 0…80 sind die Blöcke selbst) */
export const IDX4 = {
  FARM_WET: 150, WHEAT: 151 /* 151…158 */, CARROT: 159 /* 159…162 */, POTATO: 163 /* 163…166 */, PSTEM: 167 /* 167…170 */, MSTEM: 171 /* 171…174 */, WART: 175 /* 175…177 */,
  PISTON_EXT: 178, STICKY_EXT: 179, ANVIL1: 180, ANVIL2: 181, LEVER_OFF: 182, LEVER_ON: 183, BUTTON: 184, BUTTON_ON: 185, PLATE: 186, PLATE_ON: 187, HEAD_STICKY: 188, WIRE: 189
};
/** Stufe des Bildes aus dem Wachstumswert der Pflanze */
export const cropFrame = (id, aux) => {
  switch (id) {
    case B.WHEAT: return IDX4.WHEAT + Math.min(7, aux);
    case B.CARROT: return IDX4.CARROT + [0, 0, 1, 1, 2, 2, 2, 3][Math.min(7, aux)];
    case B.POTATO: return IDX4.POTATO + [0, 0, 1, 1, 2, 2, 2, 3][Math.min(7, aux)];
    case B.PUMPKIN_STEM: return IDX4.PSTEM + (Math.min(7, aux) >> 1);
    case B.MELON_STEM: return IDX4.MSTEM + (Math.min(7, aux) >> 1);
    case B.WART: return IDX4.WART + [0, 1, 1, 2][Math.min(3, aux)];
    default: return id;
  }
};

export function paintAtlas4(paint, noise, specks) {
  const px = (set, x, y, w, h, c, a = 255) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, a); };
  const col = (set, x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(x, y, c); };

  // ---------- Ackerland ----------
  const farm = (index, base, hi) => paint(index, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) {
      let c = noise(base, 14, r);
      if (y === 0) c = hi; else if (y % 4 === 2 && x % 8 !== 3) c = [c[0] - 14, c[1] - 12, c[2] - 8];
      set(x, y, c);
    }
  });
  farm(B.FARMLAND, [112, 76, 48], [150, 106, 72]); farm(IDX4.FARM_WET, [70, 46, 32], [96, 66, 46]);

  // ---------- Pflanzen ----------
  const wheatH = [2, 4, 5, 7, 9, 11, 13, 14];
  const wheat = (index, s) => paint(index, (set, r) => {
    const ripe = s === 7, h = wheatH[s];
    for (const x of [2, 5, 8, 11, 14]) {
      const hh = h - ((x * 3 + s) % 3);
      for (let y = 16 - hh; y < 16; y++) set(x, y, noise(ripe ? [208, 170, 66] : [72 + s * 4, 158 - s * 2, 48], 12, r));
      if (ripe) { set(x, 16 - hh, [236, 206, 104]); set(x, 17 - hh, [226, 190, 84]); set(x - 1, 17 - hh, [214, 176, 70]); set(x + 1, 18 - hh, [214, 176, 70]); }
      else if (s > 2) set(x + 1, 16 - hh + 1, [96, 176, 60]);
    }
  });
  for (let s = 0; s < 8; s++) wheat(IDX4.WHEAT + s, s);
  wheat(B.WHEAT, 7);
  const leafy = (index, s, leaf, root) => paint(index, (set, r) => {
    const h = [3, 5, 8, 9][s];
    for (const x of [3, 7, 11]) {
      const hh = h - ((x + s) % 2);
      for (let y = 16 - hh; y < 16; y++) set(x, y, noise(leaf, 12, r));
      set(x - 1, 16 - hh + 1, noise(leaf, 12, r)); set(x + 1, 16 - hh + 2, noise(leaf, 12, r)); if (s > 0) set(x - 1, 16 - hh + 3, noise(leaf, 12, r));
    }
    if (s === 3) { px(set, 3, 14, 2, 2, root); px(set, 7, 14, 2, 2, root); px(set, 11, 14, 2, 2, root); set(4, 15, [root[0] - 40, root[1] - 30, root[2] - 20]); }
  });
  for (let s = 0; s < 4; s++) { leafy(IDX4.CARROT + s, s, [62, 150, 56], [236, 126, 30]); leafy(IDX4.POTATO + s, s, [76, 132, 62], [204, 168, 100]); }
  leafy(B.CARROT, 3, [62, 150, 56], [236, 126, 30]); leafy(B.POTATO, 3, [76, 132, 62], [204, 168, 100]);
  const stem = (index, s, melon) => paint(index, (set, r) => {
    const h = [3, 6, 9, 11][s], c = s === 3 ? [170, 152, 76] : [86 + s * 8, 164 - s * 4, 56];
    for (let y = 16 - h; y < 16; y++) set(8, y, noise(c, 10, r));
    if (s >= 1) { set(7, 16 - h + 1, noise(c, 10, r)); set(9, 16 - h + 2, noise(c, 10, r)); }
    if (s === 3) { set(9, 16 - h, noise(c, 8, r)); set(10, 16 - h, noise(c, 8, r)); set(10, 16 - h + 1, c); set(6, 16 - h + 3, c); set(5, 16 - h + 3, c); }
    if (s >= 2) { set(6, 16 - h + 4, [70, 146, 50]); set(10, 16 - h + 5, [70, 146, 50]); set(5, 16 - h + 4, [70, 146, 50]); }
  });
  for (let s = 0; s < 4; s++) { stem(IDX4.PSTEM + s, s, false); stem(IDX4.MSTEM + s, s, true); }
  stem(B.PUMPKIN_STEM, 3, false); stem(B.MELON_STEM, 3, true);
  paint(B.CANE, (set, r) => {
    for (const x0 of [3, 10]) for (let y = 0; y < 16; y++) {
      const node = y % 5 === 4;
      for (const dx of [0, 1]) set(x0 + dx, y, noise(node ? [92, 142, 60] : dx ? [132, 190, 90] : [150, 208, 104], 8, r));
    }
    for (const [x, y] of [[2, 2], [5, 3], [9, 7], [12, 8], [2, 11], [5, 12], [12, 13]]) set(x, y, [112, 176, 80]);
    set(6, 4, [112, 176, 80]); set(13, 9, [112, 176, 80]);
  });
  const wart = (index, s) => paint(index, (set, r) => {
    const h = [4, 8, 11][s];
    for (const [x, hh] of [[3, h - 1], [7, h], [11, h - 2]]) {
      for (let y = 16 - hh; y < 16; y++) { set(x, y, noise([118, 24, 40], 14, r)); set(x + 1, y, noise([150, 36, 50], 14, r)); }
      if (s > 0) { set(x - 1, 16 - hh + 2, [150, 36, 50]); set(x + 2, 16 - hh + 3, [118, 24, 40]); }
      if (s === 2) { set(x, 16 - hh, [214, 74, 90]); set(x + 1, 16 - hh + 1, [214, 74, 90]); }
    }
    px(set, 1, 15, 14, 1, [86, 18, 28]);
  });
  for (let s = 0; s < 3; s++) wart(IDX4.WART + s, s);
  wart(B.WART, 2);

  // ---------- Kürbis, Melone ----------
  paint(B.PUMPKIN, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) {
      let c = noise([222, 134, 28], 14, r);
      if (x % 5 === 2) c = [c[0] - 40, c[1] - 36, c[2] - 10]; else if (x % 5 === 3) c = [c[0] + 12, c[1] + 10, c[2] + 4];
      if (y === 0 || y === 15) c = [c[0] - 30, c[1] - 30, c[2] - 8];
      set(x, y, c);
    }
    px(set, 7, 0, 2, 2, [76, 110, 40]); px(set, 8, 0, 1, 1, [96, 130, 52]);
  });
  paint(B.MELON, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) {
      let c = noise(x % 4 === 1 ? [50, 112, 38] : [118, 176, 52], 14, r);
      if (x % 4 === 0 && r() < 0.6) c = [94, 150, 44];
      if (y < 2 || y > 13) c = [c[0] - 26, c[1] - 26, c[2] - 12];
      set(x, y, c);
    }
  });

  // ---------- Redstone ----------
  paint(B.RS_BLOCK, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) {
      let c = noise([176, 20, 18], 22, r);
      if (x === 0 || y === 0) c = [226, 56, 44]; else if (x === 15 || y === 15) c = [118, 8, 10];
      else if ((x + y) % 7 === 0) c = [210, 36, 30];
      set(x, y, c);
    }
    specks(set, r, [140, 10, 12], [255, 90, 70], 4);
  });
  const lamp = (index, on) => paint(index, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) {
      const edge = x % 8 === 0 || y % 8 === 0 || x === 15 || y === 15;
      let c = on ? (edge ? [196, 140, 60] : noise([255, 222, 128], 14, r)) : (edge ? [70, 48, 34] : noise([122, 90, 62], 14, r));
      if (on && x % 8 > 0 && x % 8 < 4 && y % 8 > 0 && y % 8 < 4) c = [255, 244, 190];
      set(x, y, c);
    }
  });
  lamp(B.LAMP, false); lamp(B.LAMP_ON, true);
  paint(B.RS_TORCH, (set) => {
    for (let y = 6; y < 16; y++) { set(7, y, [124, 88, 50]); set(8, y, [96, 66, 38]); }
    px(set, 6, 3, 4, 4, [214, 28, 24]); px(set, 7, 2, 2, 1, [255, 80, 60]); px(set, 7, 4, 2, 2, [255, 150, 130]); set(6, 3, [255, 100, 80]);
  });
  paint(B.RS_TORCH_OFF, (set) => {
    for (let y = 6; y < 16; y++) { set(7, y, [124, 88, 50]); set(8, y, [96, 66, 38]); }
    px(set, 6, 3, 4, 4, [96, 28, 26]); px(set, 7, 2, 2, 1, [128, 52, 46]); px(set, 7, 4, 2, 2, [70, 20, 20]);
  });
  paint(B.RS_WIRE, (set) => { px(set, 6, 12, 4, 2, [214, 24, 20]); px(set, 7, 11, 2, 1, [255, 70, 50]); });
  paint(IDX4.WIRE, (set) => { px(set, 6, 12, 4, 2, [214, 24, 20]); });
  const lever = (index, on) => paint(index, (set, r) => {
    px(set, 4, 13, 8, 3, [120, 122, 130]); px(set, 4, 13, 8, 1, [160, 162, 170]); px(set, 4, 15, 8, 1, [84, 86, 92]);
    const x1 = on ? 11 : 4;
    for (let i = 0; i <= 8; i++) { const t = i / 8, x = Math.round(8 + (x1 - 8) * t), y = Math.round(13 - 9 * t); set(x, y, [132, 94, 54]); set(x + 1, y, [102, 70, 38]); }
    px(set, x1 - 1, 2, 3, 3, [158, 116, 70]); set(x1 - 1, 2, [196, 150, 96]);
  });
  lever(B.LEVER, false); lever(IDX4.LEVER_OFF, false); lever(IDX4.LEVER_ON, true);
  const button = (index, on) => paint(index, (set, r) => {
    const y0 = on ? 14 : 13;
    px(set, 4, y0, 8, 16 - y0, [132, 134, 142]); px(set, 4, y0, 8, 1, [172, 174, 182]); px(set, 4, 15, 8, 1, [92, 94, 102]);
    if (!on) { px(set, 5, 14, 6, 1, [118, 120, 128]); }
  });
  button(B.BUTTON, false); button(IDX4.BUTTON, false); button(IDX4.BUTTON_ON, true);
  const plate = (index, on) => paint(index, (set, r) => {
    const y0 = on ? 14 : 13;
    for (let y = y0; y < 16; y++) for (let x = 1; x < 15; x++) set(x, y, noise(y === y0 ? [176, 176, 184] : [138, 138, 146], 8, r));
    px(set, 1, 15, 14, 1, [96, 96, 104]);
  });
  plate(B.PLATE, false); plate(IDX4.PLATE, false); plate(IDX4.PLATE_ON, true);

  // ---------- Kolben und Spender (Blickrichtung rechts) ----------
  const body = (set, r, w) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < w; x++) {
      const edge = y === 0 || y === 15 || x === 0;
      set(x, y, edge ? noise([84, 86, 94], 10, r) : noise([124 + ((x * 3 + y) % 4) * 3, 126 + ((x * 3 + y) % 4) * 3, 134], 14, r));
    }
    for (let x = 0; x < w; x += 4) for (let y = 3; y < 13; y += 4) set(x + 2, y, [100, 102, 110]);
  };
  const wood = (set, r, x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { let c = noise([196, 150, 88], 12, r); if (y % 5 === 0 || y === y0) c = [150, 108, 62]; set(x, y, c); }
  };
  const slime = (set, r, x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { let c = noise([112, 202, 82], 14, r); if (x === x0 || y === y0) c = [170, 236, 130]; else if (y === y0 + h - 1) c = [74, 150, 54]; set(x, y, c, 235); }
  };
  paint(B.PISTON, (set, r) => { body(set, r, 12); wood(set, r, 12, 0, 4, 16); });
  paint(B.STICKY, (set, r) => { body(set, r, 12); slime(set, r, 12, 0, 4, 16); });
  const ext = (index) => paint(index, (set, r) => { body(set, r, 16); px(set, 12, 4, 4, 8, [44, 44, 52]); px(set, 12, 4, 4, 1, [70, 70, 78]); });
  ext(IDX4.PISTON_EXT); ext(IDX4.STICKY_EXT);
  const head = (index, sticky) => paint(index, (set, r) => {
    if (sticky) slime(set, r, 0, 0, 4, 16); else wood(set, r, 0, 0, 4, 16);
    for (let x = 4; x < 16; x++) { set(x, 6, [176, 132, 76]); set(x, 7, [150, 108, 62]); set(x, 8, [136, 96, 54]); set(x, 9, [104, 72, 40]); }
  });
  head(B.PISTON_HEAD, false); head(IDX4.HEAD_STICKY, true);
  paint(B.DISPENSER, (set, r) => {
    body(set, r, 16);
    px(set, 9, 4, 6, 8, [46, 46, 52]); px(set, 10, 5, 4, 6, [24, 24, 28]); px(set, 8, 3, 1, 10, [96, 98, 106]);
    set(11, 7, [60, 60, 66]); set(12, 8, [60, 60, 66]);
  });

  // ---------- Verzaubern, Regale, Amboss, Brauen ----------
  paint(B.BOOKSHELF, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) set(x, y, noise([180, 134, 80], 12, r));
    for (const y of [0, 7, 8, 15]) for (let x = 0; x < T4; x++) set(x, y, noise([140, 100, 58], 10, r));
    const pal = [[170, 40, 40], [40, 100, 160], [60, 140, 70], [200, 160, 50], [120, 60, 140], [210, 210, 200], [150, 90, 40]];
    for (const [y0, y1] of [[1, 6], [9, 14]]) {
      let x = 0, k = (y0 * 3) | 0;
      while (x < 16) {
        const w = 1 + ((x * 7 + y0) % 2), c = pal[(k++ * 5 + x) % pal.length], top = y0 + ((x + y0) % 3 === 0 ? 1 : 0);
        for (let xx = x; xx < Math.min(16, x + w); xx++) for (let y = top; y <= y1; y++) set(xx, y, y === top ? [c[0] + 30, c[1] + 30, c[2] + 30] : xx === x ? [c[0] + 12, c[1] + 12, c[2] + 12] : c);
        x += w;
      }
    }
  });
  paint(B.ENCHANT, (set, r) => {
    for (let y = 5; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise([26, 18, 44], 10, r));
    for (let x = 0; x < 16; x++) { set(x, 5, [182, 34, 44]); set(x, 6, [150, 22, 34]); }
    px(set, 0, 5, 1, 2, [230, 210, 90]); px(set, 15, 5, 1, 2, [230, 210, 90]);
    for (const [x, y] of [[3, 9], [12, 9], [7, 11], [8, 12]]) { set(x, y, [96, 236, 224]); set(x, y + 1, [40, 180, 190]); }
    for (let i = 0; i < 9; i++) set(1 + Math.floor(r() * 14), 8 + Math.floor(r() * 7), [72, 42, 120]);
    px(set, 0, 14, 16, 2, [14, 8, 26]); px(set, 3, 3, 10, 2, [150, 22, 34], 0);
    // schwebendes Buch
    px(set, 4, 1, 8, 4, [150, 28, 38]); px(set, 5, 2, 6, 2, [236, 228, 200]); px(set, 8, 1, 1, 4, [96, 18, 28]);
  });
  const anvil = (index, dmg) => paint(index, (set, r) => {
    const c = () => noise([66, 68, 76], 10, r);
    px(set, 1, 2, 14, 4, [0, 0, 0], 0);
    for (let y = 2; y <= 5; y++) for (let x = 1; x <= 14; x++) set(x, y, y === 2 ? [118, 120, 130] : c());
    for (let y = 6; y <= 9; y++) for (let x = 5; x <= 10; x++) set(x, y, c());
    for (let y = 10; y <= 11; y++) for (let x = 3; x <= 12; x++) set(x, y, c());
    for (let y = 12; y <= 15; y++) for (let x = 2; x <= 13; x++) set(x, y, y === 15 ? [38, 40, 46] : c());
    px(set, 1, 2, 2, 3, [0, 0, 0], 0); px(set, 0, 3, 1, 2, [0, 0, 0], 0);
    set(1, 3, [90, 92, 100]); set(2, 2, [90, 92, 100]);
    if (dmg >= 1) { for (const [x, y] of [[5, 3], [6, 4], [7, 4], [8, 5], [9, 3]]) set(x, y, [24, 24, 28]); }
    if (dmg >= 2) { for (const [x, y] of [[3, 2], [4, 3], [11, 3], [12, 4], [6, 7], [7, 8], [8, 9], [5, 13], [6, 12]]) set(x, y, [20, 20, 24]); }
  });
  anvil(B.ANVIL, 0); anvil(IDX4.ANVIL1, 1); anvil(IDX4.ANVIL2, 2);
  paint(B.BREWING, (set, r) => {
    for (let y = 13; y < 16; y++) for (let x = 2; x < 14; x++) set(x, y, noise(y === 13 ? [150, 152, 160] : [112, 114, 122], 10, r));
    px(set, 7, 3, 2, 10, [226, 152, 40]); px(set, 7, 3, 1, 10, [250, 190, 70]); px(set, 6, 1, 4, 2, [250, 204, 64]); px(set, 7, 0, 2, 1, [255, 232, 130]);
    px(set, 3, 9, 10, 1, [120, 86, 52]); px(set, 3, 9, 1, 2, [120, 86, 52]); px(set, 12, 9, 1, 2, [120, 86, 52]); px(set, 5, 8, 6, 1, [150, 108, 62]);
  });
  paint(B.IRON_BLOCK, (set, r) => {
    for (let y = 0; y < T4; y++) for (let x = 0; x < T4; x++) {
      let c = noise([214, 216, 224], 10, r);
      if (x === 0 || y === 0) c = [244, 246, 252]; else if (x === 15 || y === 15) c = [150, 152, 164]; else if (x === 1 || y === 1) c = [230, 232, 240]; else if (x === 14 || y === 14) c = [180, 182, 194];
      set(x, y, c);
    }
  });
}

// ---------------------------------------------------------------------
// Zeichnen im Spiel
// ---------------------------------------------------------------------
const rotDraw = (g, atlas, idx, quarter, flip, px, py, tile) => {
  g.save(); g.translate(px + tile / 2, py + tile / 2);
  if (quarter) g.rotate(quarter * Math.PI / 2);
  if (flip) g.scale(-1, 1);
  g.drawImage(atlas, idx * T4, 0, T4, T4, -tile / 2, -tile / 2, tile, tile); g.restore();
};
/** Richtung (0 rechts, 1 links, 2 oben, 3 unten) → Drehung eines nach rechts gemalten Bildes */
const facing = (g, atlas, idx, dir, px, py, tile) => rotDraw(g, atlas, idx, dir === 2 ? 3 : dir === 3 ? 1 : 0, dir === 1, px, py, tile);
/** Befestigung (0 unten, 1 links, 2 rechts, 3 oben) → Drehung eines unten angebrachten Bildes */
const attached = (g, atlas, idx, att, px, py, tile) => rotDraw(g, atlas, idx, att === 1 ? 1 : att === 2 ? 3 : att === 3 ? 2 : 0, false, px, py, tile);

/** Malt Blöcke, die mehr als ein festes Bild brauchen. Gibt true zurück, wenn der Block fertig gezeichnet ist. */
export function drawBlock4(g, atlas, id, aux, px, py, tile, S, game, tx, ty) {
  switch (id) {
    case B.FARMLAND: g.drawImage(atlas, (aux === 1 ? IDX4.FARM_WET : B.FARMLAND) * T4, 0, T4, T4, px, py, tile, tile); return true;
    case B.WHEAT: case B.CARROT: case B.POTATO: case B.PUMPKIN_STEM: case B.MELON_STEM: case B.WART:
      g.drawImage(atlas, cropFrame(id, aux) * T4, 0, T4, T4, px, py, tile, tile); return true;
    case B.ANVIL: g.drawImage(atlas, (aux >= 2 ? IDX4.ANVIL2 : aux === 1 ? IDX4.ANVIL1 : B.ANVIL) * T4, 0, T4, T4, px, py, tile, tile); return true;
    case B.LEVER: attached(g, atlas, aux & 1 ? IDX4.LEVER_ON : IDX4.LEVER_OFF, (aux >> 1) & 3, px, py, tile); return true;
    case B.BUTTON: attached(g, atlas, (aux & 15) > 0 ? IDX4.BUTTON_ON : IDX4.BUTTON, (aux >> 4) & 3, px, py, tile); return true;
    case B.PLATE: g.drawImage(atlas, (aux === 1 ? IDX4.PLATE_ON : IDX4.PLATE) * T4, 0, T4, T4, px, py, tile, tile); return true;
    case B.PISTON: case B.STICKY: facing(g, atlas, aux & 4 ? (id === B.STICKY ? IDX4.STICKY_EXT : IDX4.PISTON_EXT) : id, aux & 3, px, py, tile); return true;
    case B.PISTON_HEAD: facing(g, atlas, aux & 4 ? IDX4.HEAD_STICKY : B.PISTON_HEAD, aux & 3, px, py, tile); return true;
    case B.DISPENSER: facing(g, atlas, B.DISPENSER, aux & 3, px, py, tile); return true;
    case B.RS_TORCH: case B.RS_TORCH_OFF: {
      const att = aux & 3, off = att === 1 ? -tile * 0.16 : att === 2 ? tile * 0.16 : 0;
      g.drawImage(atlas, id * T4, 0, T4, T4, px + off, py + (att ? -tile * 0.06 : 0), tile, tile);
      if (id === B.RS_TORCH) { g.fillStyle = "rgba(255,60,40,.28)"; g.fillRect(px + off + 5 * S, py + 1.5 * S, 6 * S, 5 * S); }
      return true;
    }
    case B.RS_WIRE: {
      const lv = Math.min(15, aux | 0), u = tile / 16;
      const c = lv ? `rgb(${Math.round(120 + lv * 9)},${lv > 9 ? (lv - 9) * 8 : 0},${lv > 0 ? 12 : 0})` : "#3e0c0c", hi = lv ? `rgb(255,${60 + lv * 6},${50 + lv * 3})` : "#5c1414";
      const has = (dx, dy) => game.tile(tx + dx, ty + dy) === B.RS_WIRE;
      const solid = (dx, dy) => BLOCKS[game.tile(tx + dx, ty + dy)].solid;
      const r = (x, y, w, h, cc) => { g.fillStyle = cc; g.fillRect(Math.round(px + x * u), Math.round(py + y * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u))); };
      let any = false;
      for (const d of [-1, 1]) {
        const x0 = d < 0 ? 0 : 8, x1 = d < 0 ? 8 : 16;
        if (has(d, 0)) { r(x0, 12, x1 - x0, 2, c); r(x0, 12, x1 - x0, 1, hi); any = true; }
        if (has(d, -1) && !solid(0, -1)) { const ex = d < 0 ? 0 : 14; r(ex, 0, 2, 14, c); r(ex, 0, 1, 14, hi); r(d < 0 ? 0 : 8, 12, 8, 2, c); any = true; }
        if (has(d, 1) && !solid(d, 0)) { const ex = d < 0 ? 0 : 14; r(ex, 12, 2, 4, c); r(d < 0 ? 0 : 8, 12, 8, 2, c); any = true; }
      }
      if (!any) { r(2, 12, 12, 2, c); r(2, 12, 12, 1, hi); }
      r(6, 11, 4, 3, c); r(7, 11, 2, 1, hi);
      return true;
    }
    case B.BREWING: {
      g.drawImage(atlas, B.BREWING * T4, 0, T4, T4, px, py, tile, tile);
      const e = game.ents.get(tx + "," + ty);
      if (e) {
        const spots = [[1, 7], [11, 7], [6, 10]];
        for (let i = 0; i < 3; i++) {
          const st = e.s[i]; if (!st) continue;
          const [bx, by] = spots[i], c = st.id === "potion" || st.id === "splash_potion" ? potionColor(st.d) : "#88a8ff";
          g.fillStyle = "#c8e4f0"; g.fillRect(px + (bx + 1) * S, py + by * S, 2 * S, 1 * S);
          g.fillStyle = "rgba(210,236,250,.85)"; g.fillRect(px + bx * S, py + (by + 1) * S, 4 * S, 5 * S);
          g.fillStyle = c; g.fillRect(px + (bx + 0.5) * S, py + (by + 2.5) * S, 3 * S, 3 * S);
        }
        if (e.brewT > 0) { g.fillStyle = "rgba(255,255,255,.6)"; for (let k = 0; k < 3; k++) g.fillRect(px + (7 + (k - 1) * 2) * S, py + (6 - ((e.brewT * 6 + k * 3) % 5)) * S, S, S); }
      }
      return true;
    }
    default: return false;
  }
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
const FISH = {
  raw_cod: ["#b8a07a", "#d8c49c", "#8a7650", "#ece0c4"], cooked_cod: ["#9c6e3e", "#c8924e", "#6a4624", "#e8d0a0"],
  raw_salmon: ["#d8604a", "#f0907a", "#a03e30", "#f6c8b8"], cooked_salmon: ["#c06a38", "#e8944e", "#86441e", "#f4c898"]
};
export const PUT_ICON = { redstone_torch: B.RS_TORCH, lever: IDX4.LEVER_OFF, button: IDX4.BUTTON, pressure_plate: IDX4.PLATE, piston: B.PISTON, sticky_piston: B.STICKY, dispenser: B.DISPENSER };

/** Malt das Symbol; true, wenn Etappe 4 den Gegenstand kennt. st = Stapel (für Farbe der Tränke). */
export function paintItem4(id, g, atlas, st) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, c, w = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w, c); };
  if (PUT_ICON[id] != null) { g.drawImage(atlas, PUT_ICON[id] * T4, 0, T4, T4, 0, 0, T4, T4); return true; }
  if (FISH[id]) {
    const [a, hi, lo, bone] = FISH[id], cooked = id.startsWith("cooked");
    R(3, 5, 9, 6, a); R(4, 4, 6, 1, a); R(4, 11, 6, 1, a); R(4, 5, 7, 1, hi); R(2, 6, 1, 4, a); R(12, 4, 3, 3, lo); R(12, 9, 3, 3, lo); R(12, 7, 1, 2, a); R(4, 10, 7, 1, lo);
    P(4, 7, "#10100c"); P(3, 6, bone); R(7, 6, 1, 4, lo); R(9, 6, 1, 3, lo); if (cooked) { P(5, 5, "#6a3c14"); P(8, 9, "#6a3c14"); }
    return true;
  }
  switch (id) {
    case "wheat_seeds": P(5, 5, "#7a9a3a"); P(6, 5, "#5c7a28"); P(9, 4, "#7a9a3a"); P(4, 8, "#5c7a28"); P(5, 8, "#7a9a3a"); P(8, 8, "#7a9a3a"); P(9, 8, "#5c7a28"); P(11, 7, "#7a9a3a"); P(6, 11, "#5c7a28"); P(7, 11, "#7a9a3a"); P(10, 11, "#7a9a3a"); P(11, 11, "#5c7a28"); P(8, 6, "#8aaa48"); break;
    case "wheat": line(5, 14, 11, 4, "#c8a43e", 1); line(7, 14, 12, 6, "#d8b44c", 1); line(3, 13, 9, 3, "#b89430", 1); R(8, 2, 2, 3, "#ecd078"); R(10, 4, 2, 3, "#ecd078"); R(5, 3, 2, 2, "#e0c060"); R(5, 12, 7, 2, "#7a5a2a"); R(5, 12, 7, 1, "#9a7a3c"); break;
    case "carrot": R(5, 5, 6, 3, "#f08a24"); R(6, 8, 5, 3, "#e87a18"); R(7, 11, 3, 2, "#d86a10"); P(8, 13, "#c05a0c"); R(5, 5, 6, 1, "#ffb060"); P(6, 7, "#c85e0c"); P(9, 9, "#c85e0c"); R(7, 2, 1, 3, "#3a9a3a"); R(9, 2, 1, 3, "#4aaa44"); R(8, 1, 1, 4, "#5ac050"); break;
    case "golden_carrot": R(5, 5, 6, 3, "#f4c63a"); R(6, 8, 5, 3, "#e8b020"); R(7, 11, 3, 2, "#c89412"); P(8, 13, "#a07a0c"); R(5, 5, 6, 1, "#fff09a"); P(6, 7, "#b08414"); P(9, 9, "#b08414"); R(7, 2, 1, 3, "#3a9a3a"); R(9, 2, 1, 3, "#4aaa44"); R(8, 1, 1, 4, "#5ac050"); break;
    case "potato": R(4, 6, 8, 6, "#c8a064"); R(5, 5, 6, 1, "#d8b478"); R(5, 12, 6, 1, "#9a7840"); P(6, 8, "#8a6830"); P(9, 7, "#8a6830"); P(8, 10, "#8a6830"); R(4, 6, 1, 4, "#dcc088"); break;
    case "baked_potato": R(4, 6, 8, 6, "#c88a44"); R(5, 5, 6, 1, "#e0a860"); R(5, 12, 6, 1, "#8a5a24"); P(6, 8, "#5c3c14"); P(9, 7, "#5c3c14"); P(8, 10, "#5c3c14"); R(6, 6, 4, 1, "#f4e4b8"); R(7, 7, 2, 1, "#f4e4b8"); break;
    case "bread": R(2, 6, 12, 6, "#c8903c"); R(3, 5, 10, 1, "#d8a850"); R(4, 4, 8, 1, "#d8a850"); R(2, 12, 12, 1, "#8a5a20"); R(3, 6, 10, 1, "#e0b868"); P(5, 8, "#9a6428"); P(8, 9, "#9a6428"); P(11, 8, "#9a6428"); R(2, 6, 1, 6, "#b07a2c"); R(13, 6, 1, 6, "#a06a24"); break;
    case "pumpkin_seeds": for (const [x, y] of [[4, 5], [8, 4], [11, 6], [5, 9], [9, 9], [6, 12], [11, 11]]) { R(x, y, 2, 1, "#e8dcb8"); P(x, y + 1, "#b8a878"); } break;
    case "melon_seeds": for (const [x, y] of [[4, 5], [8, 4], [11, 6], [5, 9], [9, 9], [6, 12], [11, 11]]) { R(x, y, 2, 2, "#2a2a2a"); P(x, y, "#5a5a5a"); } break;
    case "melon_slice": R(2, 3, 12, 3, "#3a8a3a"); R(3, 6, 10, 3, "#e84a54"); R(4, 9, 8, 2, "#e84a54"); R(5, 11, 6, 1, "#e84a54"); R(2, 3, 12, 1, "#78c05a"); R(2, 3, 2, 3, "#3a8a3a"); P(6, 7, "#1a1a1a"); P(9, 8, "#1a1a1a"); P(7, 10, "#1a1a1a"); R(3, 6, 10, 1, "#f4f0e0"); break;
    case "glistering_melon_slice": R(2, 3, 12, 3, "#c8a830"); R(3, 6, 10, 3, "#f2a040"); R(4, 9, 8, 2, "#f2a040"); R(5, 11, 6, 1, "#f2a040"); R(2, 3, 12, 1, "#ffe070"); P(6, 7, "#8a6a10"); P(9, 8, "#8a6a10"); P(7, 10, "#8a6a10"); R(3, 6, 10, 1, "#fff0b0"); P(11, 4, "#ffffff"); P(4, 10, "#ffffff"); break;
    case "pumpkin_pie": R(2, 6, 12, 6, "#d8782a"); R(2, 5, 12, 2, "#e8a05c"); R(2, 12, 12, 1, "#8a4a14"); R(3, 7, 10, 3, "#e08a30"); P(7, 8, "#b05a14"); P(10, 9, "#b05a14"); R(2, 5, 12, 1, "#f0c088"); for (let x = 2; x < 14; x += 2) P(x, 5, "#c8803c"); break;
    case "sugar_cane": R(7, 3, 2, 11, "#8ac85a"); R(7, 3, 1, 11, "#a8e070"); for (const y of [6, 10]) R(7, y, 2, 1, "#5a9a3a"); R(3, 2, 4, 1, "#78b850"); R(9, 4, 4, 1, "#78b850"); R(5, 7, 2, 1, "#78b850"); break;
    case "sugar": R(4, 8, 8, 5, "#f4f4f4"); R(5, 6, 6, 2, "#ffffff"); R(6, 5, 4, 1, "#ffffff"); R(4, 12, 8, 1, "#c8c8d0"); P(6, 9, "#dcdce4"); P(9, 10, "#dcdce4"); P(8, 7, "#e4e4ec"); break;
    case "paper": R(3, 3, 10, 11, "#f2f0e6"); R(3, 3, 10, 1, "#ffffff"); R(3, 13, 10, 1, "#c8c6b8"); R(12, 3, 1, 11, "#dcdacc"); line(5, 6, 10, 6, "#b8b6a8"); line(5, 8, 10, 8, "#b8b6a8"); line(5, 10, 8, 10, "#b8b6a8"); break;
    case "book": case "enchanted_book": {
      const ench = id === "enchanted_book";
      R(3, 2, 10, 12, ench ? "#4a3a8a" : "#8a4a28"); R(4, 2, 9, 12, ench ? "#6a54b4" : "#a8683a"); R(3, 2, 2, 12, ench ? "#2e2260" : "#6a3418"); R(5, 3, 7, 1, ench ? "#8a74d8" : "#c88a56");
      R(12, 3, 1, 10, "#eae4d0"); R(11, 13, 2, 1, "#c8c0a8"); R(6, 6, 5, 4, ench ? "#c8b44a" : "#d8c07a"); R(7, 7, 3, 2, ench ? "#4a3a8a" : "#a8683a");
      if (ench) { P(8, 4, "#e8d8ff"); P(5, 11, "#e8d8ff"); P(10, 12, "#e8d8ff"); }
      break;
    }
    case "gold_nugget": R(5, 8, 6, 4, "#f2c93c"); R(6, 7, 4, 1, "#fff0a0"); R(5, 12, 6, 1, "#b8861a"); P(6, 9, "#fff0a0"); P(10, 10, "#c08e1c"); break;
    case "fishing_rod": line(3, 14, 12, 3, "#8a5a2c", 2); line(4, 14, 12, 4, "#a8743c", 1); line(12, 3, 13, 12, "#e8e8f0", 1); R(12, 12, 2, 2, "#d83a3a"); R(12, 12, 2, 1, "#ffffff"); R(2, 13, 3, 2, "#5a3a18"); break;
    case "pufferfish": R(4, 4, 8, 8, "#f0c838"); R(5, 3, 6, 1, "#f0c838"); R(5, 12, 6, 1, "#c89c20"); R(5, 5, 6, 2, "#fff0a0"); R(2, 7, 2, 3, "#e8b020"); R(12, 7, 2, 3, "#e8b020"); P(6, 7, "#10100c"); P(9, 7, "#10100c"); P(6, 2, "#c89c20"); P(9, 2, "#c89c20"); P(3, 6, "#c89c20"); P(12, 6, "#c89c20"); R(6, 9, 4, 1, "#a8641c"); break;
    case "rabbit_foot": R(5, 6, 6, 7, "#c8a678"); R(6, 5, 4, 1, "#c8a678"); R(4, 12, 8, 2, "#b08c5c"); R(5, 6, 2, 5, "#e4c8a0"); R(6, 3, 4, 3, "#a8a8b0"); R(6, 3, 4, 1, "#d0d0d8"); P(6, 14, "#e8dcc8"); P(8, 14, "#e8dcc8"); P(10, 14, "#e8dcc8"); break;
    case "glass_bottle": R(6, 2, 4, 2, "#a8744a"); R(6, 4, 4, 2, "#c8e4f0"); R(4, 7, 8, 7, "rgba(200,232,250,.75)"); R(5, 6, 6, 1, "rgba(200,232,250,.75)"); R(4, 13, 8, 1, "#8ab0c8"); R(5, 8, 1, 4, "#f4fcff"); R(11, 8, 1, 5, "#8ab0c8"); break;
    case "potion": case "splash_potion": {
      const c = st && st.d != null ? potionColor(st.d) : "#4a78d8", splash = id === "splash_potion";
      if (splash) { R(6, 2, 4, 1, "#a8744a"); R(6, 3, 4, 2, "#c8e4f0"); R(3, 6, 10, 8, "rgba(200,232,250,.7)"); R(4, 5, 8, 1, "rgba(200,232,250,.7)"); R(4, 14, 8, 1, "#8ab0c8"); R(4, 9, 8, 5, c); R(4, 9, 8, 1, "#ffffff55"); R(4, 7, 8, 2, c); R(4, 7, 8, 1, "#ffffff44"); R(4, 6, 1, 7, "#f4fcff"); P(2, 4, c); P(13, 3, c); P(1, 8, c); P(14, 7, c); }
      else { R(6, 2, 4, 2, "#a8744a"); R(6, 4, 4, 2, "#c8e4f0"); R(4, 7, 8, 7, "rgba(200,232,250,.7)"); R(5, 6, 6, 1, "rgba(200,232,250,.7)"); R(4, 13, 8, 1, "#8ab0c8"); R(4, 8, 8, 5, c); R(4, 8, 8, 1, "#ffffff55"); R(5, 8, 1, 4, "#ffffffaa"); R(11, 8, 1, 5, "#00000033"); }
      break;
    }
    case "nether_wart": R(4, 6, 8, 7, "#a82434"); R(5, 5, 6, 1, "#c83a4c"); R(5, 13, 6, 1, "#701420"); P(6, 8, "#e0586c"); P(9, 9, "#701420"); P(8, 6, "#e0586c"); R(11, 7, 1, 5, "#841c2a"); R(6, 3, 1, 2, "#6a2a4a"); R(9, 3, 1, 2, "#6a2a4a"); break;
    case "blaze_rod": line(3, 14, 12, 3, "#e8a028", 2); line(4, 14, 12, 4, "#fcd048", 1); P(12, 2, "#fff0a0"); P(13, 3, "#fff0a0"); P(5, 12, "#b86c14"); P(8, 9, "#b86c14"); P(10, 6, "#b86c14"); break;
    case "blaze_powder": R(4, 8, 8, 5, "#f0a428"); R(5, 6, 6, 2, "#fcc848"); R(6, 5, 4, 1, "#ffe48c"); R(4, 12, 8, 1, "#b8701a"); P(6, 9, "#b8701a"); P(9, 10, "#fff0a0"); P(8, 7, "#fff0a0"); break;
    case "fermented_spider_eye": R(5, 4, 6, 1, "#9a4a58"); R(4, 5, 8, 7, "#7a2c3c"); R(5, 12, 6, 1, "#4a1420"); R(6, 7, 4, 4, "#2a1018"); P(5, 6, "#c8707e"); P(10, 5, "#c8707e"); P(7, 8, "#e8a0aa"); R(11, 6, 1, 4, "#a05064"); break;
    case "glowstone_dust": R(4, 8, 8, 5, "#e8b84a"); R(5, 6, 6, 2, "#f8d870"); R(6, 5, 4, 1, "#fff0a8"); R(4, 12, 8, 1, "#a8761c"); P(6, 9, "#a8761c"); P(9, 10, "#fff6c8"); P(8, 7, "#fff6c8"); break;
    default: return false;
  }
  return true;
}

/** Schimmer für verzauberte Gegenstände: violette Streifen, nur dort wo schon Pixel sind */
export function glint(g) {
  g.save(); g.globalCompositeOperation = "source-atop";
  for (let k = -16; k < 32; k += 5) { g.fillStyle = "rgba(168,90,255,.42)"; for (let i = 0; i < 16; i++) g.fillRect(k + i, 15 - i, 2, 1); }
  g.restore();
}
