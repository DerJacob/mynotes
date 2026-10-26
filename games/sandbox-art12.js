// =====================================================================
// Blockdorf – Grafik der Etappe 12: Tiere (Bienenstock, Nest, Honigwabenblock, Schnüffler-Ei, Froschlichter, Beerenstrauch) und 14 Figuren.
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit; Figuren aus Rechtecken (1 Bildpunkt = S Pixel), Blick nach rechts.
// =====================================================================
import { B, ITEMS } from "./sandbox-data.js?v=10";

export const FIRST12 = B.BEEHIVE, LAST12 = B.BERRY_BUSH0;
/** Spalte im Atlas für die Blöcke der Etappe 12 (Spalten 313…321 sind frei) */
export const COL12 = id => 313 + (id - FIRST12);
export const MOB_COLORS12 = {
  polar_bear: [244, 244, 238], stray: [200, 212, 216], husk: [184, 160, 112], llama: [224, 208, 168], panda: [244, 244, 244], fox: [216, 105, 42], bee: [240, 192, 48],
  goat: [232, 228, 220], frog: [194, 135, 58], tadpole: [58, 50, 38], allay: [88, 184, 240], camel: [214, 176, 120], sniffer: [168, 64, 42], phantom: [74, 90, 154]
};

const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const shade = (c, k) => { const n = parseInt(c.slice(1, 7), 16); return `rgb(${clamp255((n >> 16) + k)},${clamp255(((n >> 8) & 255) + k)},${clamp255((n & 255) + k)})`; };

// ---------------------------------------------------------------------
// Atlas: neun Blockbilder
// ---------------------------------------------------------------------
export function paintAtlas12(paint, noise) {
  const P = id => COL12(id);
  const fillN = (set, r, base, amt = 10) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(base, amt, r)); };
  paint(P(B.BEEHIVE), (set, r) => {
    fillN(set, r, [200, 154, 88], 10);
    for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) set(x, y, [150, 108, 56]);
    for (let x = 0; x < 16; x++) { set(x, 0, [226, 182, 112]); set(x, 15, [120, 84, 42]); }
    for (let y = 0; y < 16; y++) { set(0, y, [226, 182, 112]); set(15, y, [140, 100, 50]); }
    for (let y = 6; y < 11; y++) for (let x = 3; x < 13; x++) set(x, y, y === 6 || y === 10 ? [70, 46, 22] : [40, 26, 12]);
    for (let x = 4; x < 12; x += 2) set(x, 8, [236, 168, 36]);
    for (let i = 0; i < 6; i++) set(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 3) * 4 - (r() < 0.5 ? 1 : 0), [232, 190, 120]);
  });
  paint(P(B.BEE_NEST), (set, r) => {
    fillN(set, r, [196, 154, 62], 16);
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); set(x, y, [150, 112, 40]); if (r() < 0.5) set(x + 1, y, [220, 184, 96]); }
    for (let y = 0; y < 16; y += 5) for (let x = 0; x < 16; x++) set(x, y, [168, 124, 46]);
    for (let y = 6; y < 11; y++) for (let x = 4; x < 12; x++) set(x, y, [58, 38, 14]);
    set(5, 6, [196, 154, 62]); set(10, 10, [196, 154, 62]); for (let x = 5; x < 11; x += 2) set(x, 8, [236, 168, 36]);
  });
  paint(P(B.HONEYCOMB_BLOCK), (set, r) => {
    fillN(set, r, [236, 150, 28], 8);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = Math.floor(y / 4), ox = row % 2 ? 2 : 0, cx = (x + ox) % 4, cy = y % 4;
      if (cx === 0 || cy === 0) set(x, y, [186, 100, 12]);
      else if (cx === 1 && cy === 1) set(x, y, [250, 196, 78]);
    }
  });
  paint(P(B.SNIFFER_EGG), (set, r) => {
    fillN(set, r, [172, 66, 44], 12);
    for (let i = 0; i < 20; i++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 15); set(x, y, [118, 36, 26]); set(x + 1, y, [118, 36, 26]); set(x, y + 1, [118, 36, 26]); }
    for (let i = 0; i < 12; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [224, 124, 88]);
    for (let y = 0; y < 16; y++) { set(0, y, [130, 46, 30]); set(15, y, [130, 46, 30]); }
    for (let x = 0; x < 16; x++) { set(x, 0, [210, 104, 70]); set(x, 15, [100, 32, 22]); }
    for (let i = 0; i < 10; i++) set(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), [88, 142, 58]);          // Moosflecken
  });
  const lamp = (id, light, mid, dark) => paint(P(id), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const gx = (x + (Math.floor(y / 5) % 2) * 3) % 6, gy = y % 5;
      set(x, y, gx === 0 || gy === 0 ? dark : (gx === 1 || gy === 1) ? light : noise(mid, 8, r));
    }
    for (let x = 0; x < 16; x++) { set(x, 0, light); set(x, 15, dark); }
  });
  lamp(B.OCHRE_FROGLIGHT, [255, 238, 168], [250, 214, 96], [196, 144, 40]);
  lamp(B.VERDANT_FROGLIGHT, [226, 252, 214], [166, 226, 150], [84, 150, 74]);
  lamp(B.PEARL_FROGLIGHT, [252, 238, 252], [226, 196, 240], [160, 120, 188]);
  const bush = (berries) => (set, r) => {
    const g1 = [50, 104, 40], g2 = [72, 136, 56], g3 = [34, 78, 30];
    for (let y = 5; y < 16; y++) for (let x = 1; x < 15; x++) {
      const d = Math.abs(x - 7.5) / 7 + (15 - y) / 13 * 0.55;
      if (d < 0.95 && r() < 0.93) set(x, y, r() < 0.5 ? g2 : g1);
    }
    for (let i = 0; i < 30; i++) set(1 + Math.floor(r() * 14), 6 + Math.floor(r() * 9), r() < 0.5 ? g3 : g2);
    set(7, 15, [80, 54, 30]); set(8, 15, [80, 54, 30]);
    if (berries) for (const [x, y] of [[4, 8], [9, 7], [6, 11], [11, 11], [3, 12], [8, 13], [12, 8]]) { set(x, y, [200, 40, 50]); set(x + 1, y, [170, 24, 40]); set(x, y - 1, [230, 90, 90]); }
  };
  paint(P(B.BERRY_BUSH), bush(true));
  paint(P(B.BERRY_BUSH0), bush(false));
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
export function paintItem12(id, g, atlas) {
  const it = ITEMS[id]; if (!it) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  if (it.block != null && it.block >= FIRST12 && it.block <= LAST12) { g.drawImage(atlas, COL12(it.block) * 16, 0, 16, 16, 0, 0, 16, 16); return true; }
  switch (id) {
    case "sweet_berries":
      for (const [x, y] of [[3, 7], [8, 5], [6, 10], [10, 9], [5, 3]]) { R(x, y, 3, 3, "#c8283a"); R(x, y, 1, 1, "#f08090"); R(x + 2, y + 2, 1, 1, "#8a1424"); P(x + 1, y - 1, "#3c7a30"); }
      return true;
    case "saddle":
      R(2, 5, 12, 5, "#6e3e22"); R(3, 4, 10, 2, "#8a5230"); R(2, 9, 12, 1, "#4a2814"); R(5, 3, 6, 2, "#a06a3c"); R(3, 10, 2, 5, "#b0b4c0"); R(11, 10, 2, 5, "#b0b4c0"); R(3, 14, 2, 1, "#7c808c"); R(11, 14, 2, 1, "#7c808c");
      R(6, 6, 4, 1, "#c89a60"); R(2, 6, 1, 3, "#4a2814"); R(13, 6, 1, 3, "#4a2814");
      return true;
    case "goat_horn":
      for (const [x, y, w, h] of [[3, 8, 4, 5], [5, 5, 4, 4], [8, 3, 4, 3], [11, 3, 2, 3], [12, 5, 2, 2]]) { R(x, y, w, h, "#d8c8a0"); R(x, y, w, 1, "#ece0c0"); R(x + w - 1, y, 1, h, "#b0a078"); }
      R(2, 11, 3, 3, "#6a4a2a"); R(2, 13, 3, 1, "#4a3018"); R(3, 9, 1, 1, "#8a8a8a");
      return true;
    case "phantom_membrane":
      R(3, 4, 10, 8, "#9aa8c8"); R(4, 3, 8, 2, "#b4c0dc"); R(4, 11, 8, 2, "#7c8aac"); R(3, 6, 10, 1, "#6c7a9c"); R(7, 4, 1, 8, "#6c7a9c"); R(10, 5, 1, 6, "#8492b4"); P(5, 5, "#e0e8ff"); P(11, 9, "#e0e8ff");
      return true;
    case "torchflower_seeds":
      for (const [x, y] of [[3, 6], [7, 4], [9, 8], [5, 10], [11, 5], [6, 7]]) { R(x, y, 2, 3, "#3a2a22"); R(x, y, 1, 1, "#e07a2a"); P(x + 1, y + 2, "#1a120e"); }
      return true;
    case "pitcher_pod":
      R(5, 3, 6, 10, "#6a9a5a"); R(4, 5, 8, 6, "#7ab06a"); R(6, 2, 4, 2, "#4a7a40"); R(6, 4, 4, 2, "#e07aa0"); R(7, 6, 2, 4, "#d85a8a"); R(5, 12, 6, 1, "#4a7a40"); P(5, 5, "#a8d898");
      return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Figuren (Blick nach rechts; R(x, y, w, h, Farbe) in Bildpunkten; sw = Schrittausschlag)
// ---------------------------------------------------------------------
const LLAMA = [["#e0d0a8", "#c8b488"], ["#f0eee8", "#d8d6ce"], ["#8a6a46", "#6a4e30"], ["#a4a4a4", "#848484"]];
const FROG = [["#c2873a", "#e8c070"], ["#d8d4c4", "#f2eee2"], ["#5a9a4a", "#9ad088"]];
const wob = (now, id, a = 0.6, sp = 160) => Math.sin(now / sp + id * 1.3) * a;

/** true = gemalt */
export function drawMob12(R, m, bw, bh, sw, g, S, now) {
  switch (m.type) {
    case "polar_bear": {
      for (const [x, s] of [[3, sw], [8, -sw], [17, sw], [21.5, -sw]]) { R(x + s * 0.5, 15, 4.4, 5.8, "#e6e6dc"); R(x + s * 0.5, 19.4, 4.4, 1.4, "#c8c8be"); }
      R(1, 5.4, 22, 10.8, "#f6f6f0"); R(1, 13.4, 22, 2.8, "#dedcd2"); R(3, 4.4, 17, 1.4, "#fcfcf8"); R(0, 6, 1.6, 3, "#eeeee6");
      const hy = m.angry ? 4.4 : 3.6;
      R(21, hy, 8, 8, "#f8f8f2"); R(26, hy + 2.8, 3.6, 4.4, "#ececE2"); R(28.6, hy + 2.6, 1.4, 1.5, "#1a1a1a"); R(24.4, hy + 1.6, 1.2, 1.2, "#1a1a1a");
      R(21.6, hy - 1.6, 2.4, 2.4, "#eaeae0"); R(25, hy - 1.6, 2.4, 2.4, "#eaeae0");
      if (m.angry) R(26, hy + 6.8, 3.4, 0.9, "#8a2020");
      return true;
    }
    case "stray": {
      const bone = "#c8d4d8", bone2 = "#aebcc4", cloth = "#5a7a94", cloth2 = "#46627a";
      R(3.8 + sw * 0.5, 18, 1.9, 10.8, bone); R(7 - sw * 0.5, 18, 1.9, 10.8, bone2); R(3.4 + sw * 0.5, 27.4, 2.8, 1.4, bone); R(6.6 - sw * 0.5, 27.4, 2.8, 1.4, bone2);
      R(2, 9, 7.6, 9.4, cloth); R(2, 9, 7.6, 1.2, "#7a9ab4"); R(2, 17, 7.6, 1.4, cloth2); R(5.2, 9, 1.5, 9, bone);
      R(7.6, 9.6, 6.4, 1.4, bone); R(2, 9.6, 1.4, 6, bone2);
      R(2.4, 1, 7, 7.6, "#dce6ea"); R(2.4, 1, 7, 1.2, "#f2f8fa"); R(1.6, 0.4, 8.6, 3.2, cloth); R(1.6, 3.4, 1.4, 5, cloth2); R(3.6, 3.6, 2, 2, "#12202a"); R(6.8, 3.6, 2, 2, "#12202a"); R(4, 6.8, 4.6, 0.9, "#2a3a44");
      R(12.6, 5, 1, 11, "#5a4a30"); R(11.8, 5, 1.4, 1, "#5a4a30"); R(11.8, 15, 1.4, 1, "#5a4a30"); R(12.2, 5.6, 0.5, 9.8, "#e0e8ea");
      return true;
    }
    case "husk": {
      R(3 + sw * 0.5, 18, 3, 10.8, "#6a5a40"); R(6.6 - sw * 0.5, 18, 3, 10.8, "#554831"); R(2.6 + sw * 0.5, 27, 3.6, 1.8, "#3c3222"); R(6.2 - sw * 0.5, 27, 3.6, 1.8, "#30281a");
      R(2, 9, 7.6, 9.5, "#8a7050"); R(2, 9, 7.6, 1.3, "#a08660"); R(2, 17, 7.6, 1.4, "#6a5438"); R(5, 12, 2, 3, "#6a5438"); R(3, 13, 2, 4, "#a08660");
      R(7, 10, 9.4, 2.6, "#b8a070"); R(7, 12.4, 8.4, 2.4, "#a08a5c"); R(15.6, 9.8, 1.6, 2.8, "#98825a");
      R(2.4, 1, 7, 7.6, "#b8a070"); R(2.4, 1, 7, 1.6, "#a08a5c"); R(6.6, 3.6, 1.8, 1.8, "#2a2014"); R(3.2, 3.6, 1.8, 1.8, "#2a2014"); R(5.8, 6.2, 3, 0.9, "#5a4a2c"); R(2.4, 6.4, 1.6, 2, "#a08a5c"); R(5, 1, 3, 1, "#d0bc8c");
      return true;
    }
    case "llama": {
      const [a, b] = LLAMA[(m.var | 0) & 3];
      for (const [x, s] of [[2.4, sw], [5.4, -sw], [9, sw], [11.6, -sw]]) { R(x + s * 0.5, 18.6, 2.4, 9.4, b); R(x + s * 0.5, 26.8, 2.4, 1.2, "#3a2e26"); }
      R(0.6, 9.6, 12.6, 9.6, a); R(0.6, 17, 12.6, 2.2, b); R(0, 10.4, 1.6, 2.6, b);
      if (m.trust) { R(2, 9, 9.6, 3.4, "#c84a4a"); R(2, 11.2, 9.6, 1.2, "#8a2a2a"); R(4.4, 9, 1, 3.4, "#f0d870"); R(8.4, 9, 1, 3.4, "#f0d870"); }
      R(11, 2, 4, 10, a); R(11.4, 0, 5.8, 4.8, a); R(15.4, 1.8, 2, 2.8, b); R(16.6, 2.2, 0.8, 0.8, "#2a1a14"); R(14.6, 0.8, 1, 1, "#14100e"); R(11.6, -0.2, 1.2, 2, b); R(13.8, -0.2, 1.2, 2, b);
      if (m.angT > 0) R(15.4, 4.2, 2.4, 0.7, "#e8e8e0");
      return true;
    }
    case "panda": {
      const k = m.var === 6 ? "#7a4a28" : "#212121", lie = m.lieT > 0, eat = m.eatT > 0;
      const yo = lie ? 2.4 : 0;
      for (const [x, s] of [[2.6, sw], [6.4, -sw], [14, sw], [17.8, -sw]]) R(x + s * 0.5, 14 + yo, 4.4, 6.2 - yo, k);
      R(1.4, 4.8 + yo, 16.4, 11, "#f4f4f4"); R(11, 4.8 + yo, 4.6, 10.6, k); R(1.4, 13.6 + yo, 16.4, 2.2, "#dedede"); R(0, 6.6 + yo, 2, 3, "#e8e8e8");
      const hy = (eat ? 5.4 : 2.8) + yo;
      R(15.4, hy, 9.2, 8.2, "#f8f8f8"); R(15.6, hy - 1.6, 2.6, 2.8, k); R(21.6, hy - 1.6, 2.6, 2.8, k);
      R(17.4, hy + 2.2, 2.6, 3, k); R(21.2, hy + 2.2, 2.6, 3, k); R(18.4, hy + 3, 0.9, 0.9, "#fff"); R(22.2, hy + 3, 0.9, 0.9, "#fff");
      R(21.4, hy + 4.8, 3.4, 3.4, "#e6e6e6"); R(23.4, hy + 4.8, 1.6, 1.3, "#111");
      if (eat) R(25.2, hy + 4, 2, 5, "#5a9a3a");
      if (m.angry) R(21.6, hy + 7.6, 3, 0.8, "#8a2020");
      return true;
    }
    case "fox": {
      const snow = m.var === 1, c = snow ? "#f2f2f2" : "#d8692a", c2 = snow ? "#d4d8de" : "#b8501c", w = snow ? "#ffffff" : "#f6eedd";
      const sl = m.sleeping, yo = sl ? 2 : 0;
      if (!sl) for (const [x, s] of [[2.8, sw], [4.6, -sw], [7, sw], [8.6, -sw]]) R(x + s * 0.4, 7.2, 1.6, 4, "#3a2a22");
      R(2.4, 3.4 + yo, 7.8, 4.6 - (sl ? 0.6 : 0), c); R(2.4, 6.6 + yo, 7.8, 1.4, w); R(2.4, 3.4 + yo, 7.8, 1, shade(c, 14));
      R(-2.4, 2 + yo, 5, 3.6, c); R(-2.4, 3.8 + yo, 1.8, 1.8, w); R(-1, 2 + yo, 3, 1, c2);
      const hx = sl ? 8.2 : 8.8, hy = (sl ? 4.8 : 2) + yo * 0.2;
      R(hx, hy, 5, 4.2, c); R(hx + 3.8, hy + 1.6, 1.8, 2, w); R(hx + 4.8, hy + 1.6, 0.9, 0.9, "#111"); R(hx + 0.4, hy - 1.6, 1.4, 1.8, c); R(hx + 3, hy - 1.6, 1.4, 1.8, c); R(hx + 0.4, hy - 1.6, 1.4, 0.6, "#2a1a14"); R(hx + 3, hy - 1.6, 1.4, 0.6, "#2a1a14");
      R(hx + 2.4, hy + 0.9, 0.9, sl ? 0.4 : 0.9, "#111");
      return true;
    }
    case "bee": {
      const f = Math.sin(now / 28 + m.id) * 0.9, angry = m.angT > 0;
      R(2, 2.4, 5.2, 4, "#f0c030"); R(3.6, 2.4, 1, 4, "#222"); R(5.4, 2.4, 1, 4, "#222"); R(2, 2.4, 5.2, 0.8, "#f8d860");
      R(6.6, 3, 2.4, 2.8, "#3a2a18"); R(8, 3.4, 0.9, 0.9, angry ? "#ff2a2a" : "#fff"); R(0.6, 4, 1.6, 0.8, m.stung ? "#00000000" : "#222");
      g.globalAlpha = 0.75; R(2.6, 0.6 + f, 3.4, 1.8, "#dff0ff"); R(4.6, 1.4 - f, 2.6, 1.4, "#c8e4fa"); g.globalAlpha = 1;
      R(3, 6.2, 0.8, 1.4, "#222"); R(5.2, 6.2, 0.8, 1.4, "#222");
      if (m.nec) { R(2.6, 6.8, 1.6, 1.2, "#f4a020"); R(5.2, 6.8, 1.6, 1.2, "#f4a020"); }
      return true;
    }
    case "goat": {
      const scream = m.var === 1, ram = m.ram | 0, hx = ram === 2 ? 1.4 : 0, hy = ram === 1 ? 1.8 : ram === 2 ? 2.6 : ram === 3 ? 0.6 : 0;
      for (const [x, s] of [[2.4, sw], [4.4, -sw], [9, sw], [10.8, -sw]]) { R(x + s * 0.4, 12.6, 1.8, 6, "#cfc9bd"); R(x + s * 0.4, 17.6, 1.8, 1.2, "#4a4036"); }
      R(1.6, 6.6, 10.4, 6.4, "#e8e4dc"); R(1.6, 11.6, 10.4, 1.6, "#d4cec2"); R(0.4, 7, 1.8, 2, "#d8d2c6");
      R(10 + hx, 2.8 + hy, 5, 5.4, "#e8e4dc"); R(13 + hx, 5 + hy, 2.2, 3, "#d6d0c4"); R(13.6 + hx, 8 + hy, 0.9, 2, "#d0c8b8");
      R(13.2 + hx, 4.6 + hy, 0.9, 0.9, scream ? "#d82020" : "#d8b030"); R(14.6 + hx, 6.4 + hy, 0.6, 0.6, "#222");
      R(9.4 + hx, 3.4 + hy, 1.8, 1.2, "#d0cabe");
      if (m.horn > 0) { R(11 + hx, 0.4 + hy, 1.1, 2.6, "#c8b890"); if (m.horn > 1) R(13.4 + hx, 0.4 + hy, 1.1, 2.6, "#c8b890"); R(11 + hx, 0.4 + hy, 1.1, 0.6, "#e0d4ac"); }
      return true;
    }
    case "frog": {
      const [a, b] = FROG[(m.var | 0) % 3], air = !m.onGround && !m.inWater;
      R(0.4, 4.6, 2.8, 3, shade(a, -22)); R(0.4, air ? 3.4 : 5, 3, 2.6, shade(a, -22));
      R(1.4, 2.8, 6.4, 3.8, a); R(1.4, 5.4, 6.4, 1.4, b); R(5.8, 4.6, 1.8, 3, shade(a, -22));
      R(5, 1.2, 2.2, 2.2, a); R(2.6, 1.2, 2.2, 2.2, a); R(5.4, 1.4, 1.4, 1.5, "#f0d050"); R(3, 1.4, 1.4, 1.5, "#f0d050"); R(6, 1.8, 0.7, 0.9, "#111"); R(3.6, 1.8, 0.7, 0.9, "#111");
      R(7.2, 4, 2.2, 1.6, a); R(8.2, 4.6, 1.2, 0.5, "#6a2a2a");
      if (m.tongue > 0.6) { R(9, 4.2, 10 * Math.min(1, (m.tongue - 0.6) / 0.3), 0.9, "#d85a6a"); }
      return true;
    }
    case "tadpole": {
      const t = wob(now, m.id, 0.5, 90);
      R(1.4, 0.6, 3.4, 2.4, "#3a3226"); R(0, 1.2 + t * 0.3, 1.8, 1.2, "#2a241a"); R(3.6, 0.8, 0.9, 0.9, "#c8c0a0"); R(2, 0.4, 1.6, 0.5, "#4a4034");
      return true;
    }
    case "allay": {
      const f = Math.sin(now / 90 + m.id) * 1.2;
      g.globalAlpha = 0.28; R(-1.4, 1, 10.8, 10.2, "#9ae0ff"); g.globalAlpha = 1;
      g.globalAlpha = 0.8; R(-1.6, 3.2 + f * 0.5, 3.4, 3.6, "#b8e8ff"); R(6.2, 3.2 - f * 0.5, 3.4, 3.6, "#9ad8fa"); g.globalAlpha = 1;
      R(2.2, 4.4, 3.6, 4.4, "#58b8f0"); R(2.2, 4.4, 3.6, 1, "#8ad4ff"); R(1.6, 0.4, 4.8, 4, "#78ccf8"); R(2.6, 1.8, 0.9, 1, "#102838"); R(4.6, 1.8, 0.9, 1, "#102838"); R(3.4, 3.2, 1.2, 0.5, "#2a6080");
      R(2.6, 8.8, 1, 2.2, "#58b8f0"); R(4.4, 8.8, 1, 2.2, "#58b8f0"); R(0.6, 5, 1.8, 1.2, "#58b8f0"); R(5.8, 5, 1.8, 1.2, "#58b8f0");
      if (m.hold || m.want) { R(6.4, 5.4, 2.6, 2.6, m.hold ? "#f0d870" : "#c8e8f8"); R(6.4, 5.4, 2.6, 0.7, "#ffffff"); }
      return true;
    }
    case "camel": {
      const sit = m.sitting, yo = sit ? 7.4 : 0, c = "#d6b078", c2 = "#b89058", c3 = "#c8a068";
      if (!sit) for (const [x, s] of [[4, sw], [8.4, -sw], [20, sw], [24.4, -sw]]) { R(x + s * 0.5, 20.4, 3.2, 12.4, c3); R(x + s * 0.5, 25.4, 3.2, 1.2, c2); R(x + s * 0.5, 31.6, 3.2, 1.2, "#6a5238"); }
      else { R(2, 25.4, 26, 6, c3); R(2, 30.4, 26, 1.4, c2); R(26, 26.4, 5, 5, c3); }
      R(1.6, 10 + yo, 27, 10.6, c); R(1.6, 18 + yo, 27, 2.6, c2); R(0.6, 11.4 + yo, 2, 3, c2);
      R(10.4, 4.4 + yo, 9, 6.4, c); R(11.4, 3.4 + yo, 7, 1.4, "#e2c08c");
      R(26.6, 2.8 + yo, 5, 11, c); R(27.6, 1.6 + yo, 4.4, 3, c); R(28.4, 0.4 + yo, 5, 4.2, c); R(31.4, 2 + yo, 1.6, 2.4, c2); R(31.6, 1.2 + yo, 0.9, 0.9, "#14100e"); R(28.6, -0.4 + yo, 1.2, 1.6, c2);
      R(1.4, 11 + yo, 1.2, 6, c2);
      if (m.saddle) { R(8.4, 8.4 + yo, 12, 3.2, "#7a2e24"); R(8.4, 8.4 + yo, 12, 0.9, "#a04436"); R(9.4, 11.4 + yo, 10, 5, "#a03a30"); R(9.4, 14.8 + yo, 10, 1.6, "#d8b040"); R(7.6, 10 + yo, 1.2, 8, "#4a2814"); }
      return true;
    }
    case "sniffer": {
      const dig = m.dig > 0, sw2 = dig ? 0 : sw, hy = dig ? 8 : 0;
      for (const [x, s] of [[4, sw2], [10, -sw2], [20, sw2], [25.4, -sw2]]) { R(x + s * 0.5, 22, 5, 8.4, "#8a3622"); R(x + s * 0.5, 29, 5, 1.4, "#5a2214"); }
      R(1.6, 9, 27, 14, "#a8402a"); R(1.6, 20, 27, 3, "#8a3622"); R(1.6, 9, 27, 1.4, "#c25a40"); R(0, 12, 2.2, 5, "#8a3622");
      R(4, 6.4, 20, 3.4, "#5a8a3a"); R(6, 5.4, 6, 1.6, "#6aa044"); R(15, 5.8, 5, 1.4, "#6aa044"); R(8, 8, 3, 1.6, "#487030");
      R(26, 8 + hy, 7.6, 11, "#b44a30"); R(28, 4.6 + hy, 4.4, 4.4, "#8a3622"); R(26.8, 3.4 + hy, 2.6, 3.6, "#8a3622"); R(30.4, 15.4 + hy, 3.2, 5, "#ecc8b0"); R(28.4, 11 + hy, 1.4, 1.4, "#111"); R(26, 8 + hy, 7.6, 1.4, "#cc6044");
      return true;
    }
    case "phantom": {
      const f = Math.sin(now / 130 + m.id) * 1.6;
      R(0, 3.2, 5.4, 1.6, "#3a4a82"); R(5, 2, 11, 3.8, "#4a5a9a"); R(5, 4.6, 11, 1.2, "#3c4a84");
      g.globalAlpha = 0.9; R(5.4, -0.6 - f, 7.4, 2.8, "#3c4a88"); R(8, -2.2 - f * 1.6, 5, 1.8, "#34427c"); R(6, 5.6 + f * 0.4, 6.4, 1.6, "#3c4a88"); g.globalAlpha = 1;
      R(15.4, 2, 5, 3.6, "#5a6aaa"); R(18, 2.8, 1.6, 1.4, "#8aff80"); R(15.6, 1.4, 1.4, 0.8, "#4a5a9a"); R(19, 4.6, 1.6, 0.8, "#2a3466");
      return true;
    }
  }
  return false;
}

/** Zusätze auf bekannten Figuren (Sattel auf dem Schwein). */
export function drawExtras12(R, m) {
  if (m.saddle && m.type === "pig") { R(3.4, 3.2, 5.4, 1.5, "#7a4a2a"); R(3.4, 3.2, 5.4, 0.5, "#a06a3c"); R(4.6, 4.6, 1.2, 2.4, "#4a2814"); R(7, 4.6, 1.2, 2.4, "#4a2814"); }
}

/** Spucke des Lamas im Flug. true = gemalt */
export function drawProjectile12(g, a, sx, sy, S, now) {
  if (a.kind !== "spit") return false;
  g.save(); g.translate(sx, sy);
  const Q = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S))); };
  Q(-1.6, -1.6, 3.2, 3.2, "#dfe8c8"); Q(-1, -2, 2, 4, "#c8dca8"); Q(-0.6, -0.6, 1.2, 1.2, "#f6fae8"); Q(-2.4, -0.4, 1, 1, "#a8c088" + (Math.floor(now / 60) % 2 ? "" : ""));
  g.restore();
  return true;
}
