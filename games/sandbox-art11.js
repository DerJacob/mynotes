// =====================================================================
// Blockdorf – Grafik der Etappe 11: Ozean (Korallen, Tang, Seegras, Seegurken, Schwamm, Leitstrom, Schildkrötenei, Meerestiere).
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit. Wasserpflanzen sind ein Zusatzfeld auf Wasser (siehe sandbox-data.js) und
// werden von sandbox.js mit drawPlant() über das Wasser gemalt; Mobs kommen aus drawMob11() (Rechtecke, 1 Bildpunkt = S Pixel).
// =====================================================================
import { B, ITEMS, CORALS, WP } from "./sandbox-data.js?v=10";

export const T11 = 16;
export const FIRST11 = B.CORAL_BLOCK, LAST11 = B.TURTLE_EGG;
/** Spalte im Atlas für die Blöcke der Etappe 11 (Spalten 306…312 sind frei) */
export const COL11 = id => 306 + (id - FIRST11);

const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp255 = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const shade = (c, k) => { const [r, g, b] = typeof c === "string" ? hexRgb(c) : c; return `rgb(${clamp255(r + k)},${clamp255(g + k)},${clamp255(b + k)})`; };
const CORAL_RGB = CORALS.map(c => hexRgb(c[2]));
const DEAD = [150, 144, 134];

// ---------------------------------------------------------------------
// Atlas: sieben Blockbilder
// ---------------------------------------------------------------------
export function paintAtlas11(paint, noise) {
  const P = id => COL11(id);
  paint(P(B.CORAL_BLOCK), (set, r) => coralTilePix(set, r, CORAL_RGB[0], noise));
  paint(P(B.DEAD_CORAL_BLOCK), (set, r) => coralTilePix(set, r, DEAD, noise));
  paint(P(B.SPONGE), (set, r) => spongePix(set, r, [212, 196, 70], [160, 142, 40], noise, false));
  paint(P(B.WET_SPONGE), (set, r) => spongePix(set, r, [170, 170, 52], [118, 124, 36], noise, true));
  paint(P(B.CONDUIT), (set, r) => {
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
      const edge = x === 2 || x === 13 || y === 2 || y === 13, mid = x === 7 || x === 8 || y === 7 || y === 8;
      if (edge || mid) set(x, y, noise(edge ? [150, 112, 70] : [120, 88, 54], 14, r));
      else set(x, y, [70, 112, 120], 120);
    }
    for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d < 4) set(x, y, d < 2 ? [236, 250, 255] : [120, 220, 236]); }
    set(7, 7, [60, 70, 90]); set(8, 8, [60, 70, 90]);
  });
  paint(P(B.DRIED_KELP_BLOCK), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(y % 4 === 3 ? [28, 40, 22] : [48, 66, 34], 10, r));
    for (let i = 0; i < 14; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [86, 104, 58]);
    for (let i = 0; i < 16; i++) { set(0, i, [26, 36, 20]); set(15, i, [26, 36, 20]); set(i, 0, [66, 86, 46]); }
  });
  paint(P(B.TURTLE_EGG), (set, r) => eggPix(set, 1, 0));
}
function coralTilePix(set, r, base, noise) {
  const dark = [base[0] * 0.7, base[1] * 0.7, base[2] * 0.7], light = [Math.min(255, base[0] * 1.25 + 14), Math.min(255, base[1] * 1.25 + 14), Math.min(255, base[2] * 1.25 + 14)];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(base, 18, r));
  for (let i = 0; i < 18; i++) { const x = Math.floor(r() * 16), y = Math.floor(r() * 16); set(x, y, dark); if (r() < 0.6) set(x + 1, y, dark); }
  for (let i = 0; i < 12; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), light);
  for (let i = 0; i < 6; i++) { const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13); set(x, y, dark); set(x + 1, y + 1, dark); set(x, y + 1, light); }
}
function spongePix(set, r, base, hole, noise, wet) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(base, 14, r));
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(r() * 14), y = Math.floor(r() * 14), w = 1 + Math.floor(r() * 2), h = 1 + Math.floor(r() * 2);
    for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) set(x + k, y + j, noise(hole, 10, r));
    set(x, y + h, [Math.min(255, base[0] + 30), Math.min(255, base[1] + 30), Math.min(255, base[2] + 18)]);
  }
  if (wet) for (let i = 0; i < 10; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), [90, 130, 80]);
}
/** Eier (n = 1…4) in eine Mulde; stage 0…2 = Risse */
function eggPix(set, n, stage) {
  const spots = n === 1 ? [4] : n === 2 ? [1, 8] : n === 3 ? [0, 5, 10] : [0, 4, 8, 12];
  for (const x0 of spots) {
    for (let y = 9; y < 16; y++) {
      const w = y === 9 ? 3 : y === 10 ? 4 : y >= 14 ? (y === 15 ? 3 : 4) : 5, o = Math.floor((5 - w) / 2);
      for (let x = 0; x < w; x++) set(x0 + o + x, y, y > 13 ? [196, 190, 150] : x === 0 || x === w - 1 ? [214, 208, 170] : [236, 232, 200]);
    }
    set(x0 + 2, 11, [150, 142, 98]); set(x0 + 3, 13, [160, 150, 106]); set(x0 + 1, 12, [160, 150, 106]);
    if (stage >= 1) { set(x0 + 2, 10, [70, 62, 40]); set(x0 + 1, 11, [70, 62, 40]); set(x0 + 3, 12, [70, 62, 40]); }
    if (stage >= 2) { set(x0 + 2, 13, [60, 52, 34]); set(x0 + 1, 14, [60, 52, 34]); set(x0 + 3, 11, [60, 52, 34]); set(x0 + 2, 12, [60, 52, 34]); }
  }
}

// ---------------------------------------------------------------------
// Zwischengespeicherte Bilder (Korallenblöcke je Farbe, Eier je Zustand)
// ---------------------------------------------------------------------
const mkCanvas = () => { const c = document.createElement("canvas"); c.width = c.height = T11; return c; };
const tileCache = new Map();
function pixCanvas(key, fn) {
  let c = tileCache.get(key);
  if (!c) {
    c = mkCanvas(); const g = c.getContext("2d"), img = g.createImageData(T11, T11), d = img.data;
    let s = 12345 + key.length * 77; for (let i = 0; i < key.length; i++) s = (s * 31 + key.charCodeAt(i)) | 0;
    const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
    const set = (x, y, col, a = 255) => { if (x < 0 || y < 0 || x >= T11 || y >= T11) return; const i = (y * T11 + x) * 4; d[i] = clamp255(col[0]); d[i + 1] = clamp255(col[1]); d[i + 2] = clamp255(col[2]); d[i + 3] = a; };
    const noise = (col, k, rr) => { const v = (rr() - 0.5) * k; return [col[0] + v, col[1] + v, col[2] + v]; };
    fn(set, r, noise); g.putImageData(img, 0, 0); tileCache.set(key, c);
  }
  return c;
}
/** Korallenblock-Bild; c = Farbindex 0…4, dead = abgestorben */
export const coralBlockTile = (c, dead) => pixCanvas(`cb${dead ? "d" : c | 0}`, (set, r, noise) => coralTilePix(set, r, dead ? DEAD : CORAL_RGB[(c | 0) % 5], noise));
export const eggTile = (n, stage) => pixCanvas(`egg${n}.${stage}`, set => eggPix(set, n, stage));

// ---------------------------------------------------------------------
// Blöcke zeichnen
// ---------------------------------------------------------------------
/** true = gemalt */
export function drawBlock11(g, atlas, id, aux, px, py, tile, S, game, tx, ty) {
  if (id < FIRST11 || id > LAST11) return false;
  const src = (cv, sx = 0, sy = 0) => g.drawImage(cv, sx, sy, T11, T11, px, py, tile, tile);
  switch (id) {
    case B.CORAL_BLOCK: src(coralBlockTile(aux, false)); return true;
    case B.TURTLE_EGG: src(eggTile((aux & 3) + 1, (aux >> 2) & 3)); return true;
    case B.CONDUIT: {
      src(atlas, COL11(id) * T11, 0);
      const now = typeof performance !== "undefined" ? performance.now() : 0, a = 0.16 + 0.1 * Math.sin(now / 420 + tx);
      g.fillStyle = `rgba(150,240,255,${a})`; g.fillRect(px + 4 * S, py + 4 * S, 8 * S, 8 * S);
      return true;
    }
    default: src(atlas, COL11(id) * T11, 0); return true;
  }
}

// ---------------------------------------------------------------------
// Wasserpflanzen (aux auf Wasser): wiegen sich in der Strömung
// ---------------------------------------------------------------------
/** Malt eine Wasserpflanze in das 16er-Raster ab (ox, oy), k = Pixel je Rasterpunkt. now = Zeit (ms), sd = Versatz der Welle */
export function plantSprite(g, aux, ox, oy, k, now = 0, sd = 0) {
  const F = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(ox + x * k), Math.round(oy + y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
  const wave = (y, amp = 1) => Math.round(Math.sin(now / 650 + y * 0.45 + sd) * amp);
  if (aux === WP.KELP || aux === WP.KELP_TOP) {
    const top = aux === WP.KELP_TOP;
    for (let y = top ? 3 : 0; y < 16; y++) {
      const w = wave(y, 1.4), c = (y >> 1) % 2 ? "#3d8a2c" : "#4a9a34";
      F(6 + w, y, 3, 1, c); F(6 + w, y, 1, 1, "#2c6e22"); F(8 + w, y, 1, 1, "#68b848");
      if (y % 5 === 2) F((y % 10 === 2 ? 4 : 9) + w, y, 2, 1, "#3d8a2c");
    }
    if (top) { for (let y = 0; y < 3; y++) { const w = wave(y, 1.4); F(6 + w + (y === 0 ? 1 : 0), y, y === 0 ? 1 : 2, 1, "#68b848"); } }
  } else if (aux === WP.SEAGRASS) {
    for (const [x, h, c] of [[3, 7, "#3f9a3a"], [6, 11, "#4aac42"], [9, 8, "#3a8c36"], [12, 5, "#4aac42"]]) {
      for (let j = 0; j < h; j++) { const w = Math.round(Math.sin(now / 600 + (16 - j) * 0.5 + sd + x) * (j / h) * 1.6); F(x + w, 15 - j, 2, 1, j === h - 1 ? "#7ad064" : c); }
    }
  } else if (aux >= WP.PICKLE && aux < WP.PICKLE + 4) {
    const n = aux - WP.PICKLE + 1, spots = [[6, 9], [3, 10], [10, 10], [7, 6]].slice(0, n);
    for (const [x, y] of spots) {
      F(x, y + 1, 3, 5, "#5a7a1c"); F(x, y + 1, 1, 5, "#7a9a2c"); F(x + 2, y + 1, 1, 5, "#44601a"); F(x + 1, y, 1, 1, "#7a9a2c");
      F(x, y + 3, 3, 1, "#9aba44"); F(x + 1, y + 2, 1, 1, "#d0f04a"); F(x + 1, y + 4, 1, 1, "#d0f04a");
    }
    F(0, 15, 16, 1, "rgba(0,0,0,0.12)");
  } else if (aux >= WP.CORAL && aux < WP.CORAL + 5) coralSprite(F, 0, CORAL_RGB[aux - WP.CORAL], aux - WP.CORAL, false);
  else if (aux >= WP.FAN && aux < WP.FAN + 5) coralSprite(F, 1, CORAL_RGB[aux - WP.FAN], aux - WP.FAN, false);
  else if (aux >= WP.DEAD_CORAL && aux < WP.DEAD_CORAL + 5) coralSprite(F, 0, DEAD, aux - WP.DEAD_CORAL, true);
  else if (aux >= WP.DEAD_FAN && aux < WP.DEAD_FAN + 5) coralSprite(F, 1, DEAD, aux - WP.DEAD_FAN, true);
  else if (aux === WP.SPAWN) {                         // Froschlaich: Gallertklumpen mit dunklen Punkten
    for (const [x, y] of [[1, 13], [4, 14], [7, 13], [10, 14], [13, 13], [3, 12], [9, 12], [6, 14]]) { F(x, y, 3, 2, "#b8c8a0"); F(x, y, 3, 1, "#d8e4c4"); F(x + 1, y + 1, 1, 1, "#2a2a22"); }
  }
}
/** Koralle (fan 0) oder Korallenfächer (fan 1) in Farbe col; kind = Form 0…4 */
function coralSprite(F, fan, col, kind, dead) {
  const c = shade(col, 0), hi = shade(col, 46), lo = shade(col, -50);
  if (fan) {
    F(7, 11, 2, 5, lo);
    for (let y = 3; y <= 11; y++) { const w = 2 + Math.round((11 - y) * 1.5), x = 8 - Math.floor(w / 2); F(x, y, w, 1, (y + kind) % 3 === 0 ? hi : c); if (y < 10) { F(x, y, 1, 1, lo); F(x + w - 1, y, 1, 1, lo); } }
    for (let i = -3; i <= 3; i++) F(8 + i * 2 - (i > 0 ? 1 : 0), 5 + Math.abs(i), 1, 5 - Math.abs(i), lo);
    return;
  }
  if (kind === 0) {                                   // Röhrenkoralle: drei Röhren
    for (const [x, h] of [[2, 9], [6, 12], [10, 7]]) { F(x, 16 - h, 4, h, c); F(x, 16 - h, 1, h, hi); F(x + 3, 16 - h, 1, h, lo); F(x + 1, 16 - h, 2, 1, lo); }
  } else if (kind === 1) {                            // Hirnkoralle: Kuppel mit Furchen
    F(1, 11, 14, 5, c); F(2, 8, 12, 3, c); F(4, 6, 8, 2, c); F(4, 6, 8, 1, hi); F(2, 8, 12, 1, hi);
    for (const x of [4, 7, 10]) { F(x, 7, 1, 6, lo); F(x + 1, 9, 1, 5, lo); } F(1, 15, 14, 1, lo);
  } else if (kind === 2) {                            // Blasenkoralle: Blasen
    for (const [x, y, s] of [[1, 11, 5], [8, 9, 6], [4, 5, 4], [11, 3, 4], [0, 4, 3]]) { F(x, y, s, s, c); F(x + 1, y - 1 < 0 ? 0 : y - 1, s - 2, 1, c); F(x + 1, y + 1, 1, 1, hi); F(x + 1, y + s, s - 2, 1, lo); F(x + s - 1, y + 1, 1, s - 1, lo); }
  } else if (kind === 3) {                            // Feuerkoralle: Äste
    F(7, 6, 2, 10, c); F(7, 6, 1, 10, hi);
    for (const [x, y, w] of [[3, 9, 4], [9, 7, 4], [2, 5, 2], [12, 4, 2], [5, 2, 2], [8, 1, 2]]) { F(x, y, w, 2, c); F(x, y, w, 1, hi); F(x + w - 1, y, 1, 2, lo); }
    F(2, 3, 1, 2, c); F(13, 2, 1, 2, c); F(5, 0, 1, 2, hi);
  } else {                                            // Geweihkoralle: Geweih
    F(7, 8, 2, 8, c); F(5, 6, 2, 3, c); F(9, 5, 2, 4, c); F(3, 3, 2, 4, c); F(11, 2, 2, 4, c); F(5, 1, 1, 3, c); F(7, 0, 1, 3, c); F(2, 1, 1, 3, hi);
    F(7, 8, 1, 8, hi); F(9, 5, 1, 4, hi); F(3, 3, 1, 4, hi); F(12, 2, 1, 4, lo); F(10, 8, 1, 2, lo);
  }
  if (dead) F(0, 15, 16, 1, "rgba(0,0,0,0.12)");
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
const FISHBUCKET = { cod: "#a0845a", salmon: "#a8584c", pufferfish: "#e0c43a", tropical: "#ec8a2c", axolotl: "#f0b8c4" };
/** Malt das Symbol; true, wenn Etappe 11 den Gegenstand kennt. */
export function paintItem11(id, g, atlas) {
  const it = ITEMS[id]; if (!it) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  if (it.block != null && it.block >= FIRST11 && it.block <= LAST11) {
    if (it.block === B.CORAL_BLOCK) g.drawImage(coralBlockTile(it.col, false), 0, 0);
    else if (it.block === B.TURTLE_EGG) { g.drawImage(eggTile(3, 0), 0, 0, 16, 16, 0, -1, 16, 16); }
    else g.drawImage(atlas, COL11(it.block) * T11, 0, T11, T11, 0, 0, T11, T11);
    return true;
  }
  if (it.wet != null) { plantSprite(g, it.wet, 0, 0, 1, 0, 0); return true; }
  switch (id) {
    case "dried_kelp": R(3, 3, 10, 10, "#2c3c20"); R(3, 3, 10, 2, "#4a6434"); R(3, 7, 10, 1, "#1e2c16"); R(3, 10, 10, 1, "#1e2c16"); R(2, 4, 1, 8, "#3a4e2a"); R(13, 4, 1, 8, "#1e2c16"); P(6, 5, "#6a8a48"); P(9, 8, "#6a8a48"); return true;
    case "prismarine_shard": R(6, 2, 3, 3, "#bfeee0"); R(5, 5, 5, 4, "#7fcfb8"); R(4, 9, 5, 3, "#5aae98"); R(5, 12, 3, 2, "#3e8a78"); R(7, 3, 1, 5, "#e8fff6"); R(10, 6, 2, 3, "#5aae98"); R(11, 9, 1, 2, "#3e8a78"); return true;
    case "prismarine_crystals": for (const [x, y, c] of [[3, 7, "#f2f0b0"], [8, 3, "#dff6e8"], [9, 8, "#f6f2b4"], [5, 11, "#cdeed8"]]) { R(x, y, 3, 4, c); R(x + 1, y - 1, 1, 1, "#ffffff"); R(x, y + 3, 3, 1, "#98c8b0"); } return true;
    case "scute": R(4, 3, 8, 2, "#7ad064"); R(3, 5, 10, 6, "#58b04a"); R(4, 11, 8, 2, "#3e8a38"); R(7, 5, 2, 6, "#3e8a38"); R(4, 7, 8, 1, "#3e8a38"); R(5, 3, 3, 1, "#a8f090"); return true;
    case "nautilus_shell": R(4, 3, 8, 2, "#d8bfa0"); R(3, 5, 10, 7, "#e8d4b4"); R(5, 12, 7, 2, "#a88a66"); R(5, 6, 6, 5, "#c0a07a"); R(7, 7, 3, 3, "#e8d4b4"); R(8, 8, 1, 1, "#8a6a48"); R(3, 5, 1, 7, "#f6e8cc"); R(12, 6, 1, 6, "#a88a66"); R(10, 3, 2, 2, "#8a6a48"); return true;
    case "heart_of_the_sea": R(5, 3, 6, 2, "#3a6a8a"); R(3, 5, 10, 6, "#4a82a8"); R(5, 11, 6, 2, "#2e5a78"); R(4, 4, 8, 1, "#6aa4c8"); R(5, 6, 2, 2, "#9ad8f0"); R(9, 8, 3, 1, "#2e5a78"); R(7, 7, 2, 2, "#c8f0ff"); R(3, 6, 1, 4, "#5a96bc"); R(12, 6, 1, 4, "#2e5a78"); return true;
    case "turtle_helmet": R(3, 4, 10, 6, "#58b04a"); R(4, 3, 8, 1, "#7ad064"); R(2, 7, 2, 5, "#3e8a38"); R(12, 7, 2, 5, "#3e8a38"); R(5, 8, 6, 3, "#00000055"); R(5, 5, 2, 2, "#3e8a38"); R(9, 5, 2, 2, "#3e8a38"); R(7, 4, 2, 1, "#a8f090"); R(3, 4, 10, 1, "#7ad064"); return true;
    case "trident": {
      for (let i = 0; i < 11; i++) R(3 + i * 0.7 | 0, 14 - i, 2, 2, i % 2 ? "#4a8a96" : "#3a7480");
      R(10, 1, 2, 5, "#58a8b8"); R(7, 4, 2, 5, "#58a8b8"); R(12, 4, 2, 5, "#58a8b8"); R(7, 4, 6, 2, "#58a8b8"); R(9, 0, 1, 1, "#aef0f8"); R(7, 3, 1, 1, "#aef0f8"); R(13, 3, 1, 1, "#aef0f8"); R(8, 5, 1, 3, "#8ad4e0"); R(11, 2, 1, 4, "#8ad4e0"); R(9, 6, 3, 1, "#2e6470"); return true;
    }
    case "ink_sac": R(5, 4, 6, 9, "#1c1c28"); R(4, 6, 8, 5, "#262634"); R(6, 3, 4, 2, "#12121a"); R(6, 6, 2, 2, "#4a4a62"); R(9, 10, 2, 1, "#0c0c12"); return true;
    case "glow_ink_sac": R(5, 4, 6, 9, "#1c5a64"); R(4, 6, 8, 5, "#26747e"); R(6, 3, 4, 2, "#123e46"); R(6, 6, 2, 2, "#8af0e4"); R(9, 9, 2, 2, "#4ac8c0"); R(5, 11, 1, 1, "#aef8f0"); return true;
    case "tropical_fish": fishIcon(R, P, "#ec7a22", "#f6f0e8"); return true;
    case "map_treasure": {
      R(2, 2, 12, 12, "#d8c496"); R(2, 2, 12, 1, "#ece0b6"); R(2, 13, 12, 1, "#a89468"); R(2, 2, 1, 12, "#ece0b6"); R(13, 2, 1, 12, "#a89468");
      R(3, 3, 10, 10, "#9ec0cc"); R(3, 3, 5, 4, "#bfd8c0"); R(4, 4, 3, 2, "#8cb078");
      for (const [x, y] of [[8, 11], [9, 10], [10, 9], [11, 8]]) P(x, y, "#8a5a2a");
      R(10, 5, 1, 3, "#d02828"); R(12, 5, 1, 3, "#d02828"); R(11, 6, 1, 1, "#d02828"); P(10, 5, "#d02828"); P(12, 7, "#d02828");
      R(2, 2, 12, 1, "#0000001a"); return true;
    }
    default:
      if (it.fishbucket) {
        R(3, 5, 10, 9, "#aeb4c4"); R(4, 14, 8, 1, "#7c8294"); R(2, 4, 12, 2, "#c8ccd8"); R(3, 5, 2, 8, "#d8dce8"); R(11, 5, 2, 9, "#8a90a2");
        R(4, 6, 8, 4, "#3a6ee0"); R(4, 6, 8, 1, "#6a9aff");
        const c = FISHBUCKET[it.fishbucket];
        if (it.fishbucket === "axolotl") { R(5, 7, 6, 3, c); R(4, 6, 1, 1, "#d84a5a"); R(11, 6, 1, 1, "#d84a5a"); P(9, 8, "#222"); }
        else fishIcon((x, y, w, h, col) => R(x, y - 1 + 3, w, h, col), (x, y, col) => P(x, y + 2, col), c, it.fishbucket === "tropical" ? "#f6f0e8" : shade(c, 40), 2);
        return true;
      }
      return false;
  }
}
function fishIcon(R, P, body, acc, small) {
  if (small) { R(5, 2, 5, 3, body); R(3, 2, 2, 3, acc); P(8, 3, "#111"); R(6, 2, 3, 1, acc); return; }
  R(5, 5, 8, 6, body); R(3, 6, 2, 4, acc); R(2, 5, 1, 2, acc); R(2, 9, 1, 2, acc); R(7, 3, 4, 2, acc); R(5, 5, 8, 1, shade(body, 40)); R(11, 6, 1, 1, "#111"); R(7, 7, 1, 3, acc); R(9, 7, 1, 3, acc); R(13, 8, 1, 2, shade(body, -40)); R(7, 11, 3, 1, acc);
}

// ---------------------------------------------------------------------
// Meerestiere (Blickrichtung rechts; sw = Schrittausschlag, wird für Schwimmbewegung nicht gebraucht)
// ---------------------------------------------------------------------
const FISH_VAR = [["#ec7a22", "#f6f0e8"], ["#3a8ae0", "#f6e24a"], ["#e0407a", "#f6f0f8"], ["#f0c030", "#2a2a3a"], ["#8a5ad8", "#f6f0e8"], ["#3ac8c0", "#ec7a22"], ["#e8e8f0", "#e04a3a"], ["#4a9a3a", "#f0e060"]];
const AXO = [["#f0b8c4", "#e86a86"], ["#8a6a4a", "#d8788a"], ["#ecd060", "#e88a5a"], ["#78d0e0", "#e86a86"], ["#3c58b0", "#d8788a"]];
const wob = (now, id, a = 0.6, sp = 160) => Math.sin(now / sp + id * 1.3) * a;

/** true = gemalt */
export function drawMob11(R, m, bw, bh, sw, g, S, now) {
  const tail = wob(now, m.id, 1, 120);
  switch (m.type) {
    case "cod": {
      R(0, 1.4 + tail * 0.3, 2.6, 1.8, "#8a6e46"); R(2, 0.8, 7, 3.2, "#a0845a"); R(2, 3, 7, 1.8, "#d8c8a0"); R(3, 0.4, 4, 0.9, "#7e6440"); R(8.2, 1.4, 1.6, 2.4, "#a0845a");
      R(7.8, 1.6, 1, 1, "#111"); R(2, 2.2, 7, 0.5, "#7e6440"); R(4.6, 1.6, 1.2, 1.2, "#8e7448");
      return true;
    }
    case "salmon": {
      R(0, 1.6 + tail * 0.3, 3, 2.2, "#7a6a58"); R(2.8, 0.8, 8, 3.6, "#7c8a72"); R(2.8, 3, 8, 2.2, "#dd8e7a"); R(3.4, 0.2, 4, 1, "#5e6c56"); R(10, 1.6, 2.6, 2.4, "#6c7a62");
      R(11, 2, 1, 1, "#111"); R(10.2, 3.4, 2.2, 0.8, "#c46a58"); R(5.2, 1.8, 1.4, 1.4, "#6c7a62");
      return true;
    }
    case "tropical_fish": {
      const [a, b] = FISH_VAR[(m.var | 0) % 8];
      R(0, 1.2 + tail * 0.3, 1.8, 3.6, b); R(1.6, 0.8, 4.6, 4.2, a); R(2.4, 0, 3, 1.1, b); R(2.4, 4.8, 3, 1.1, b); R(3.2, 1, 1.2, 3.8, b); R(5, 2, 1.4, 1.6, b); R(5.2, 1.6, 0.8, 0.8, "#111");
      return true;
    }
    case "pufferfish": {
      const k = 0.62 + 0.38 * (m.puff || 0), w = bw * k, h = bh * k, x = (bw - w) / 2, y = bh - h;
      const open = (m.puff || 0) > 0.5;
      R(x, y + h * 0.1, w, h * 0.8, "#e2c63e"); R(x + w * 0.15, y, w * 0.7, h, "#ecd44e"); R(x + w * 0.1, y + h * 0.6, w * 0.8, h * 0.3, "#f6f0cc");
      R(x + w * 0.62, y + h * 0.28, w * 0.18, h * 0.18, "#111"); R(x - w * 0.12, y + h * 0.32 + tail * 0.2, w * 0.14, h * 0.3, "#c8a830");
      R(x + w * 0.78, y + h * 0.58, w * 0.14, h * 0.1, "#6a4a1a");
      R(x + w * 0.35, y + h * 0.05, w * 0.25, h * 0.2, "#4a9ac0");
      if (open) for (const [fx, fy] of [[0, 0.3], [0.9, 0.3], [0.45, -0.1], [0.45, 0.95], [0.1, 0.85], [0.8, 0.85], [0.1, 0.05], [0.8, 0.05]]) R(x + w * fx - 0.4, y + h * fy - 0.4, 1.4, 1.4, "#8a6a1a");
      return true;
    }
    case "squid": case "glow_squid": {
      const glow = m.type === "glow_squid", c0 = glow ? "#1f6e7c" : "#2a4472", c1 = glow ? "#2a8ea0" : "#3a5a90", c2 = glow ? "#154e5a" : "#1c3052";
      const a = Math.sin(now / 240 + m.id) * 0.8;
      R(2.2, 0, 9.2, 8.4, c0); R(1.4, 1.2, 10.8, 6.4, c0); R(3, 0, 7, 1.2, c1); R(2.6, 6.6, 8.4, 1.8, c2);
      R(2.4, 5.4, 2.4, 2, "#e8eef2"); R(8.8, 5.4, 2.4, 2, "#e8eef2"); R(3.4, 5.8, 1.2, 1.4, "#111"); R(9.8, 5.8, 1.2, 1.4, "#111");
      for (let i = 0; i < 4; i++) { const x = 2.4 + i * 2.5; R(x + a * (i % 2 ? 1 : -1), 8.4, 1.6, 3.2, c0); R(x + a * (i % 2 ? 1.6 : -1.6), 11.4, 1.6, 3.4, c2); }
      if (glow) for (const [x, y] of [[4, 2], [8, 3], [6, 1], [10, 2], [3, 4]]) { g.globalAlpha = 0.6 + 0.4 * Math.sin(now / 300 + x + m.id); R(x, y, 1.1, 1.1, "#c8fff6"); g.globalAlpha = 1; }
      return true;
    }
    case "dolphin": {
      const t2 = wob(now, m.id, 1.2, 140);
      R(0, 3.4 + t2 * 0.5, 3, 1.6, "#5a6b80"); R(0.4, 2.4 + t2, 2, 1.2, "#4e5e72"); R(2, 2.4, 15, 6, "#6e7f93"); R(3, 1.6, 11, 1.4, "#7a8ba0"); R(3, 6.4, 13, 2.4, "#d8dee6");
      R(14, 3, 6, 4.6, "#6e7f93"); R(14, 6, 5, 2.2, "#d8dee6"); R(19, 4.6, 5.2, 2.2, "#7a8ba0"); R(19.4, 6, 4.6, 1.2, "#d8dee6"); R(16.6, 3.2, 1.2, 1.2, "#111");
      R(7, 0, 3, 2.6, "#5a6b80"); R(8, -0.4, 2, 1, "#5a6b80"); R(10.4, 7.6, 3, 2, "#5a6b80"); R(2, 6, 1, 1, "#55657a");
      return true;
    }
    case "turtle": {
      const s = Math.sin(now / 230 + m.id) * 0.8, onWater = !m.onGround;
      R(2.4 + s, 6.6, 3, 1.6, "#6aa854"); R(13 - s, 6.6, 3, 1.6, "#6aa854"); R(0, 5, 2.2, 1.4, "#6aa854");
      R(3, 1, 13, 6.2, "#4a8a38"); R(2, 2.4, 15, 4.6, "#4a8a38"); R(5, 0, 9, 1.4, "#5aa046"); R(3, 6.4, 13, 1.6, "#d8cc8a");
      for (const [x, y] of [[5, 1.6], [9, 1.2], [12.4, 2.2], [7, 4], [11, 4.4], [4, 4.6]]) { R(x, y, 2.6, 2.2, "#3a6e2c"); R(x, y, 2.6, 0.7, "#6ab050"); }
      R(16.6, 3, 3.2, 3, "#78b45e"); R(18.8, 3.6, 1.2, 1.2, "#111"); R(17.2, 5.6, 2.6, 0.8, "#a8d48c");
      if (m.gv) R(8, -0.8, 3, 0.9, "#e8e4c8");
      return true;
    }
    case "axolotl": {
      const [a, gl] = AXO[(m.var | 0) % 5], t2 = wob(now, m.id, 0.9, 200), flap = wob(now, m.id, 0.6, 130);
      R(0, 2.4 + t2, 3.4, 2.4, a); R(0, 3.8 + t2, 3.4, 0.8, shade(a, -30)); R(3, 1.8, 6.6, 3.6, a); R(3, 4.2, 6.6, 1.2, shade(a, 30)); R(4.2, 0.4, 4.2, 1.4, shade(a, -22));
      R(9, 1.4, 3.4, 3.6, a); R(11, 2.2, 1, 1, "#111"); R(10.4, 4, 1.8, 0.7, shade(a, -40));
      R(3.4, 5.4 + flap * 0.3, 1.2, 1.4, shade(a, -30)); R(7.4, 5.4 - flap * 0.3, 1.2, 1.4, shade(a, -30));
      for (const dy of [0, 1.1, 2.2]) { R(9.6 + flap * 0.3, -0.2 + dy * 0.6, 2.2, 0.8, gl); R(8.2, 0.4 + dy, 1.8, 0.8, gl); }
      return true;
    }
    case "drowned": {
      const skin = "#6aa89e", skin2 = "#548a82", cloth = "#3a8a9a", cloth2 = "#2c6a78";
      R(3 + sw * 0.5, 18, 3, 10.8, cloth2); R(6.6 - sw * 0.5, 18, 3, 10.8, "#24586a"); R(2.6 + sw * 0.5, 27, 3.6, 1.8, "#1c3c4a"); R(6.2 - sw * 0.5, 27, 3.6, 1.8, "#162e3a");
      R(2, 9, 7.6, 9.5, cloth); R(2, 9, 7.6, 1.3, "#4aa4b4"); R(2, 17, 7.6, 1.4, cloth2); R(5, 12, 2, 3, cloth2); R(2.2, 14, 1.6, 2.4, "#3a7a3a"); R(7.6, 16, 1.4, 2, "#3a7a3a");
      R(7, 10, 9.4, 2.6, skin); R(7, 12.4, 8.4, 2.4, skin2); R(15.6, 9.8, 1.6, 2.8, "#4e867e");
      R(2.4, 1, 7, 7.6, skin); R(2.4, 1, 7, 1.6, skin2); R(6.6, 3.6, 1.8, 1.8, "#a8f0e8"); R(3.2, 3.6, 1.8, 1.8, "#a8f0e8"); R(5.8, 6.2, 3, 0.9, "#2c4a48"); R(2.4, 6.4, 1.6, 2, skin2);
      R(3.4, 0.4, 1.2, 1.4, "#3a8a3a"); R(7.6, 0.6, 1, 1.2, "#3a8a3a");
      if (m.trident) { R(14.6, 4, 1.2, 14, "#3a7480"); R(13.2, 1.2, 4, 1.2, "#58a8b8"); R(13.2, 0.2, 1, 3.4, "#58a8b8"); R(15.6, 0.2, 1, 3.4, "#58a8b8"); R(14.4, -0.8, 1.4, 4, "#58a8b8"); }
      return true;
    }
    case "guardian": case "elder_guardian": {
      const el = m.type === "elder_guardian", u = bw / 16, body = el ? "#9a9c88" : "#4a9a86", body2 = el ? "#7c7e6c" : "#3a7e6e", body3 = el ? "#b2b4a0" : "#62b8a0", spine = el ? "#d0cfc0" : "#e8963a";
      const beam = m.beaming ? Math.min(1, (m.beamT || 0) / (el ? 3 : 2)) : 0, tl = wob(now, m.id, 1.4, 150);
      R(0, 6 * u + tl * u, 3 * u, 3.4 * u, body2); R(-1.4 * u, 5 * u + tl * 1.6 * u, 2 * u, 2 * u, body);
      R(2.6 * u, 3 * u, 12 * u, 10 * u, body); R(3.8 * u, 1.8 * u, 9.6 * u, 12.6 * u, body); R(3.8 * u, 1.8 * u, 9.6 * u, 1.4 * u, body3); R(3.8 * u, 12.6 * u, 9.6 * u, 1.8 * u, body2);
      for (const [x, y, vx, vy] of [[6, 1.6, 0, -1], [10.6, 1.6, 0, -1], [2.4, 4, -1, 0], [14.6, 4.6, 1, 0], [2.4, 10, -1, 0], [14.6, 10, 1, 0], [6, 14.2, 0, 1], [10.6, 14.2, 0, 1], [8.2, 14.2, 0, 1]]) {
        const ex = vx ? 1.8 * u : 1.2 * u, ey = vy ? 1.8 * u : 1.2 * u;
        R(x * u + (vx < 0 ? -ex : 0), y * u + (vy < 0 ? -ey : 0), vx ? ex : 1.2 * u, vy ? ey : 1.2 * u, spine);
      }
      const ex = 6.2 * u, ey = 4.8 * u, es = 6.6 * u;
      R(ex, ey, es, es, "#f0f0e8"); R(ex + 0.6 * u, ey + 0.6 * u, es - 1.2 * u, es - 1.2 * u, beam > 0 ? `rgb(255,${Math.round(120 - beam * 80)},${Math.round(70 - beam * 50)})` : "#e86a2a");
      R(ex + es * 0.5 - 0.7 * u, ey + es * 0.5 - 0.7 * u, 1.6 * u, 1.6 * u, "#16161c");
      if (beam > 0) { g.globalAlpha = 0.25 + 0.4 * beam; R(ex - u, ey - u, es + 2 * u, es + 2 * u, "#ff7a50"); g.globalAlpha = 1; }
      R(10.4 * u, 11 * u, 3.6 * u, 0.8 * u, body2);
      return true;
    }
    default: return false;
  }
}

/** Dreizack im Flug (Spitze bei sx, sy). true = gemalt */
export function drawTrident(g, a, sx, sy, S, now) {
  g.save(); g.translate(sx, sy); g.rotate(a.ang !== undefined ? a.ang : Math.atan2(a.vy, a.vx));
  const Q = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S))); };
  if (a.ret) { g.globalAlpha = 0.28 + 0.12 * Math.sin(now / 70); Q(-12, -3.4, 14, 6.8, "#8af0ff"); g.globalAlpha = 1; }
  Q(-13, -0.6, 13, 1.3, "#3a7480"); Q(-13, -0.6, 13, 0.5, "#4a8a96");
  Q(-2, -2.6, 2, 5.2, "#58a8b8"); Q(0, -1.2, 5, 2.4, "#8ad4e0"); Q(0, -3.4, 4, 1.2, "#58a8b8"); Q(0, 2.2, 4, 1.2, "#58a8b8"); Q(3.4, -3.4, 1, 1.2, "#aef0f8"); Q(3.4, 2.2, 1, 1.2, "#aef0f8"); Q(4.4, -0.6, 1.2, 1.2, "#aef0f8");
  g.restore();
}
