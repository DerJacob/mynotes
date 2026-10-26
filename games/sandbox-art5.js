// =====================================================================
// Blockdorf – Grafik der Etappe 5: Nether, Ende, Leuchtfeuer.
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit. Portale, Magma und Spawner haben zwei Bilder und wechseln beim Zeichnen.
// =====================================================================
import { B } from "./sandbox-data.js?v=10";

export const T5 = 16;
/** Zusatzbilder im Atlas (0…80 und 81…101 sind die Blöcke selbst; 150…189 gehören Etappe 4) */
export const IDX5 = { WALL_NETHER: 190, FRAME_EYE: 191, PORTAL2: 192, ENDP2: 193, GATE2: 194, MAGMA2: 195, SPAWNER2: 196, BEACON_CORE: 197 };

export function paintAtlas5(paint, noise, specks) {
  const px = (set, x, y, w, h, c, a = 255) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c, a); };
  const rock = (set, r, base, k = 22) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      const patch = (((x >> 1) * 5 + (y >> 1) * 11) % 7) * 3 - 9;
      set(x, y, noise([base[0] + patch, base[1] + patch * 0.5, base[2] + patch * 0.5], k, r));
    }
  };
  // ---------- Netherrack, Seelensand, Glowstone ----------
  const nether = (set, r) => {
    rock(set, r, [118, 52, 54]);
    for (let i = 0; i < 7; i++) { let x = Math.floor(r() * 16), y = Math.floor(r() * 16); for (let k = 0; k < 4; k++) { set(x, y, [82, 30, 34]); x += r() < 0.6 ? 1 : 0; y += r() < 0.5 ? 1 : 0; } }
    for (let i = 0; i < 9; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [150, 76, 74]);
  };
  paint(B.NETHERRACK, nether);
  paint(IDX5.WALL_NETHER, (set, r) => { rock(set, r, [58, 26, 30], 14); for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [40, 16, 20]); });
  paint(B.SOUL_SAND, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) set(x, y, noise([88, 70, 56], 16, r));
    for (const [x, y] of [[2, 2], [9, 1], [5, 8], [12, 7], [2, 12], [9, 12]]) { px(set, x, y, 3, 3, [64, 48, 38]); set(x + 1, y + 1, [34, 24, 20]); set(x, y, [108, 88, 72]); set(x + 2, y, [108, 88, 72]); }
    for (let x = 0; x < 16; x++) set(x, 0, noise([112, 92, 76], 8, r));
  });
  paint(B.GLOWSTONE, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      const cell = ((x >> 2) * 3 + (y >> 2) * 5) % 4, base = [[232, 184, 80], [214, 162, 62], [244, 204, 104], [200, 146, 52]][cell];
      set(x, y, noise(base, 14, r));
    }
    for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [255, 244, 190]);
    for (let i = 0; i < 4; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [170, 116, 40]);
  });
  paint(B.QUARTZ_ORE, (set, r) => { nether(set, r); for (const [x, y] of [[3, 3], [10, 2], [6, 9], [12, 11], [2, 12]]) { px(set, x, y, 2, 2, [240, 236, 228]); set(x, y, [255, 255, 255]); set(x + 1, y + 1, [200, 194, 186]); } });
  paint(B.NETHER_GOLD, (set, r) => { nether(set, r); for (const [x, y] of [[3, 3], [10, 2], [6, 9], [12, 11], [2, 12]]) { px(set, x, y, 2, 2, [242, 196, 60]); set(x, y, [255, 240, 150]); set(x + 1, y + 1, [190, 140, 30]); } });
  const magma = (index, glow) => paint(index, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) set(x, y, noise([52, 22, 20], 14, r));
    for (const [x0, y0, len, vert] of [[0, 4, 16, 0], [5, 0, 12, 1], [10, 8, 6, 1], [0, 11, 11, 0], [12, 5, 4, 0]]) {
      for (let k = 0; k < len; k++) {
        const x = vert ? x0 + (k % 3 === 0 ? 1 : 0) : x0 + k, y = vert ? y0 + k : y0 + (k % 4 === 0 ? 1 : 0);
        set(x, y, glow ? [255, 170, 50] : [236, 120, 32]); if (k % 2 === 0) set(x + 1, y, glow ? [255, 120, 30] : [190, 70, 22]);
      }
    }
    for (let i = 0; i < 5; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), glow ? [255, 214, 110] : [255, 160, 60]);
  });
  magma(B.MAGMA, false); magma(IDX5.MAGMA2, true);
  paint(B.NETHER_BRICK, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7;
      set(x, y, mortar ? noise([30, 12, 16], 6, r) : noise([66, 26, 32], 12, r));
    }
    for (let y = 0; y < T5; y += 4) for (let x = 0; x < T5; x++) if (y % 4 === 0 && (x + ((y >> 2) % 2 ? 4 : 0)) % 8 !== 7) set(x, y, [88, 38, 44]);
  });
  const spawner = (index, f) => paint(index, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) set(x, y, noise([22, 26, 34], 8, r));
    px(set, 2, 2, 12, 12, [10, 12, 18]);
    for (let i = 3; i < 14; i += 3) { px(set, i, 2, 1, 12, [70, 76, 90]); px(set, 2, i, 12, 1, [70, 76, 90]); }
    px(set, 0, 0, 16, 2, [86, 92, 108]); px(set, 0, 14, 16, 2, [86, 92, 108]); px(set, 0, 0, 2, 16, [86, 92, 108]); px(set, 14, 0, 2, 16, [86, 92, 108]);
    const fl = f ? [[7, 9, 2, 4], [8, 7, 1, 3], [6, 10, 1, 2]] : [[7, 8, 2, 5], [6, 10, 1, 3], [9, 9, 1, 3]];
    for (const [x, y, w, h] of fl) px(set, x, y, w, h, [255, 150, 30]);
    px(set, 7, 11, 2, 2, [255, 226, 110]);
  });
  spawner(B.SPAWNER, 0); spawner(IDX5.SPAWNER2, 1);
  // ---------- Portale (halbdurchsichtig, zwei Bilder) ----------
  const portal = (index, ph) => paint(index, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      const w = Math.sin((x + ph * 5) * 0.8 + Math.sin(y * 0.6 + ph * 3) * 1.6) * 0.5 + 0.5;
      set(x, y, [70 + w * 90, 20 + w * 36, 150 + w * 90], 150 + w * 70);
    }
    for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [236, 190, 255], 230);
  });
  portal(B.PORTAL, 0); portal(IDX5.PORTAL2, 1);
  paint(B.QUARTZ_BLOCK, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      let c = noise([236, 230, 222], 8, r);
      if (x === 0 || y === 0) c = [250, 246, 240]; else if (x === 15 || y === 15) c = [196, 190, 182]; else if (y % 5 === 2 && x % 3 !== 0) c = [222, 214, 204];
      set(x, y, c);
    }
  });
  // ---------- Ende ----------
  paint(B.END_STONE, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) set(x, y, noise([222, 222, 164], 14, r));
    for (let i = 0; i < 10; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); set(x, y, [186, 186, 128]); set(x + 1, y, [196, 196, 138]); set(x, y + 1, [170, 170, 112]); }
    for (let i = 0; i < 5; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [240, 240, 190]);
  });
  const frame = (index, eye) => paint(index, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      let c = noise([52, 96, 80], 10, r);
      if (x === 0 || y === 0) c = [86, 138, 116]; else if (x === 15 || y === 15) c = [28, 56, 46]; else if (y > 11) c = noise([220, 220, 164], 10, r);
      set(x, y, c);
    }
    px(set, 3, 3, 10, 5, [20, 36, 30]); px(set, 3, 3, 10, 1, [12, 22, 18]);
    if (eye) { px(set, 4, 4, 8, 4, [34, 120, 100]); px(set, 5, 3, 6, 1, [34, 120, 100]); px(set, 6, 4, 4, 3, [120, 236, 200]); px(set, 7, 5, 2, 2, [20, 60, 50]); set(7, 4, [230, 255, 245]); }
    for (let x = 0; x < 16; x += 4) set(x + 1, 13, [180, 180, 130]);
  });
  frame(B.FRAME, false); frame(IDX5.FRAME_EYE, true);
  const endp = (index, ph, hue) => paint(index, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) set(x, y, noise(hue ? [26, 8, 44] : [8, 14, 26], 8, r), 236);
    for (let i = 0; i < 12; i++) { const x = (i * 7 + ph * 5) % 16, y = (i * 11 + ph * 3 + 2) % 16; set(x, y, hue ? [210, 130, 255] : [120, 220, 200], 255); if (i % 3 === 0) set(x + 1, y, hue ? [140, 70, 200] : [60, 150, 150], 255); }
  });
  endp(B.END_PORTAL, 0, false); endp(IDX5.ENDP2, 1, false);
  endp(B.GATEWAY, 0, true); endp(IDX5.GATE2, 1, true);
  paint(B.PURPUR, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      let c = noise([170, 124, 170], 12, r);
      if (x === 0 || y === 0 || x === 8 || y === 8) c = [142, 96, 144]; else if (x === 1 || y === 1 || x === 9 || y === 9) c = [194, 150, 196];
      set(x, y, c);
    }
  });
  paint(B.DRAGON_EGG, (set, r) => {
    const rows = [[7, 2], [6, 4], [5, 6], [4, 8], [4, 8], [3, 10], [3, 10], [3, 10], [3, 10], [4, 8], [4, 8], [5, 6], [6, 4]];
    rows.forEach(([x0, w], j) => { for (let i = 0; i < w; i++) set(x0 + i, 2 + j, noise(j < 2 ? [40, 20, 56] : [20, 10, 30], 8, r)); });
    for (let i = 0; i < 16; i++) set(4 + Math.floor(r() * 8), 4 + Math.floor(r() * 9), [104, 44, 160]);
    for (let j = 3; j < 12; j += 2) set(5 + (j % 3), 2 + j, [160, 80, 220]);
    px(set, 5, 14, 6, 1, [14, 8, 20]);
  });
  paint(B.SKULL, (set, r) => {
    px(set, 4, 6, 8, 8, [196, 196, 188]); px(set, 5, 5, 6, 1, [196, 196, 188]); px(set, 4, 6, 8, 1, [226, 226, 218]); px(set, 5, 13, 6, 2, [160, 160, 150]);
    px(set, 5, 8, 2, 2, [22, 22, 24]); px(set, 9, 8, 2, 2, [22, 22, 24]); px(set, 7, 10, 2, 1, [90, 90, 84]); px(set, 6, 12, 1, 2, [60, 60, 56]); px(set, 9, 12, 1, 2, [60, 60, 56]);
    for (let y = 5; y < 15; y++) for (let x = 4; x < 12; x++) if (r() < 0.12) set(x, y, [40, 40, 44]);
  });
  paint(B.BEACON, (set, r) => {
    for (let y = 0; y < 13; y++) for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 12;
      set(x, y, edge ? [180, 236, 244] : noise([130, 206, 222], 10, r), edge ? 255 : 210);
    }
    px(set, 3, 2, 10, 9, [40, 70, 80], 200);
    px(set, 6, 3, 4, 7, [190, 255, 255]); px(set, 4, 5, 8, 3, [190, 255, 255]); px(set, 7, 4, 2, 5, [255, 255, 255]); px(set, 5, 6, 6, 1, [255, 255, 255]);
    px(set, 0, 13, 16, 3, [30, 18, 52]); px(set, 0, 13, 16, 1, [66, 40, 100]); px(set, 1, 14, 3, 1, [90, 56, 130]); px(set, 10, 15, 4, 1, [14, 8, 24]);
  });
  const metal = (id, base, light, dark, mid) => paint(id, (set, r) => {
    for (let y = 0; y < T5; y++) for (let x = 0; x < T5; x++) {
      let c = noise(base, 10, r);
      if (x === 0 || y === 0) c = light; else if (x === 15 || y === 15) c = dark; else if (x === 1 || y === 1) c = mid; else if (x === 14 || y === 14) c = [dark[0] + 20, dark[1] + 20, dark[2] + 20];
      set(x, y, c);
    }
  });
  metal(B.GOLD_BLOCK, [250, 214, 70], [255, 246, 160], [186, 138, 30], [255, 232, 110]);
  metal(B.DIAMOND_BLOCK, [88, 226, 216], [200, 255, 250], [36, 150, 150], [140, 244, 236]);
  metal(B.EMERALD_BLOCK, [60, 208, 100], [170, 255, 190], [20, 130, 60], [110, 232, 140]);
}

// ---------------------------------------------------------------------
// Zeichnen im Spiel
// ---------------------------------------------------------------------
/** Blöcke mit wechselnden Bildern. true = fertig gezeichnet. now = Zeit in ms (aus game.__now oder performance.now()). */
export function drawBlock5(g, atlas, id, aux, px, py, tile, S, game, tx, ty) {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const put = (idx, alpha = 1) => { if (alpha !== 1) g.globalAlpha = alpha; g.drawImage(atlas, idx * T5, 0, T5, T5, px, py, tile, tile); if (alpha !== 1) g.globalAlpha = 1; };
  switch (id) {
    case B.PORTAL: put(Math.floor(now / 260) % 2 ? IDX5.PORTAL2 : B.PORTAL); return true;
    case B.END_PORTAL: put(Math.floor(now / 420) % 2 ? IDX5.ENDP2 : B.END_PORTAL); return true;
    case B.GATEWAY: put(Math.floor(now / 380) % 2 ? IDX5.GATE2 : B.GATEWAY); return true;
    case B.FRAME: put(aux === 1 ? IDX5.FRAME_EYE : B.FRAME); return true;
    case B.MAGMA: put(Math.floor(now / 700 + tx * 0.37) % 2 ? IDX5.MAGMA2 : B.MAGMA); return true;
    case B.SPAWNER: put(Math.floor(now / 240) % 2 ? IDX5.SPAWNER2 : B.SPAWNER); return true;
    case B.BEACON: {
      put(B.BEACON);
      const e = game.ents && game.ents.get(tx + "," + ty);
      if (e && e.on) { g.globalAlpha = 0.5 + 0.3 * Math.sin(now / 300); g.fillStyle = "#c8ffff"; g.fillRect(px + 6 * S, py + 4 * S, 4 * S, 5 * S); g.globalAlpha = 1; }
      return true;
    }
    default: return false;
  }
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
/** Malt das Symbol; true, wenn Etappe 5 den Gegenstand kennt. */
export function paintItem5(id, g, atlas, st) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, c, w = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w, c); };
  switch (id) {
    case "quartz": R(5, 3, 6, 2, "#fffdf8"); R(3, 5, 10, 3, "#ece6dc"); R(4, 8, 8, 2, "#d4ccc0"); R(6, 10, 4, 2, "#b8b0a4"); R(6, 3, 2, 1, "#ffffff"); P(11, 6, "#b8b0a4"); break;
    case "nether_brick": R(2, 7, 12, 5, "#5a2430"); R(3, 6, 10, 1, "#7c3846"); R(2, 12, 12, 1, "#341218"); R(2, 7, 1, 5, "#7c3846"); R(13, 7, 1, 6, "#341218"); P(6, 9, "#341218"); P(10, 9, "#341218"); break;
    case "magma_cream": R(4, 5, 8, 8, "#d86a1c"); R(5, 4, 6, 1, "#f09a38"); R(5, 13, 6, 1, "#8a3a0c"); R(6, 6, 2, 2, "#ffd070"); R(9, 9, 2, 2, "#ef8a2c"); P(10, 6, "#ffd070"); break;
    case "ghast_tear": R(6, 2, 4, 2, "#e8f4f8"); R(5, 4, 6, 2, "#dcecf2"); R(4, 6, 8, 5, "#cfe2ea"); R(5, 11, 6, 2, "#bcd2dc"); R(6, 13, 4, 1, "#a0bcc8"); R(5, 6, 2, 3, "#ffffff"); P(10, 8, "#a0bcc8"); break;
    case "nether_star": {
      const c = "#f4f4ff", h = "#ffffff", l = "#a8b0d8";
      R(7, 1, 2, 14, c); R(1, 7, 14, 2, c); line(3, 3, 12, 12, c, 2); line(12, 3, 3, 12, c, 2);
      R(6, 6, 4, 4, h); R(7, 7, 2, 2, "#e8e0ff"); P(7, 1, h); P(1, 7, h); R(7, 14, 2, 1, l); R(14, 7, 1, 2, l); P(3, 3, h); P(12, 3, l); break;
    }
    case "ender_eye": {
      R(6, 2, 4, 1, "#14463a"); R(5, 3, 6, 1, "#14463a"); R(4, 4, 8, 8, "#14463a"); R(5, 12, 6, 1, "#0c3028"); R(6, 13, 4, 1, "#0a2820");
      R(5, 4, 6, 7, "#20906e"); R(5, 4, 3, 3, "#3cc6a0"); P(5, 4, "#c0ffe8");
      R(7, 6, 3, 3, "#0a1c16"); P(7, 6, "#6fe8c0"); R(9, 9, 2, 2, "#2fb08c"); break;
    }
    case "flint_and_steel": {
      R(2, 9, 7, 5, "#7a7c86"); R(3, 8, 5, 1, "#a4a6b0"); R(2, 13, 7, 1, "#50525a"); R(3, 10, 3, 2, "#2e3036");
      line(9, 12, 14, 3, "#d6d9e4", 1); line(10, 13, 14, 5, "#8e91a0", 1); R(12, 2, 3, 2, "#4a4c54"); P(13, 2, "#7a7c86"); P(2, 9, "#c0c2cc");
      break;
    }
    case "elytra": {
      R(7, 2, 2, 12, "#6a6a74");
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? 1 : 9;
        R(x0, 3, 6, 3, "#8a8a98"); R(x0, 6, 6, 3, "#76768a"); R(x0 + (s < 0 ? 0 : 1), 9, 5, 3, "#62627a"); R(x0 + (s < 0 ? 1 : 2), 12, 3, 2, "#505068");
        R(x0, 3, 6, 1, "#b4b4c4"); P(x0 + (s < 0 ? 1 : 4), 5, "#a0a0b4"); P(x0 + (s < 0 ? 3 : 2), 8, "#a0a0b4"); P(x0 + (s < 0 ? 2 : 3), 11, "#8a8aa0");
      }
      R(6, 3, 4, 2, "#8a4a9a"); P(7, 3, "#c080d8"); break;
    }
    default: return false;
  }
  return true;
}
