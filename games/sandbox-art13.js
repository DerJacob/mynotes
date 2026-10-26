// =====================================================================
// Blockdorf – Grafik der Etappe 13: Dörfer, Handel und Illager 2.0
//   Blöcke:  Pfeilmachertisch, Kessel, Glocke · Gegenstände: Totem der Unsterblichkeit, Goldener Apfel
//   Figuren: Zombie-Dörfler, Eisengolem, Magier (Evoker), Plagegeist (Vex), Zerstörer (Ravager), Fahrender Händler
//   Geschosse: Fangzähne des Magiers · Zusätze: Leuchten durch die Glocke, Händler-Decke auf Lamas
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit; Figuren aus Rechtecken (1 Bildpunkt = S Pixel), Blick nach rechts.
// =====================================================================
import { B, ITEMS, FIRST13, LAST13 } from "./sandbox-data.js?v=10";

export { FIRST13, LAST13 };
/** Spalte im Atlas für die Blöcke der Etappe 13 (setzt die Spalten der Etappe 12 fort: 322…324) */
export const COL13 = id => 322 + (id - FIRST13);
export const MOB_COLORS13 = {
  zombie_villager: [110, 154, 90], iron_golem: [200, 200, 196], evoker: [96, 96, 104], vex: [150, 184, 220], ravager: [92, 88, 82], wandering_trader: [44, 62, 138]
};

// ---------------------------------------------------------------------
// Atlas: drei Blockbilder
// ---------------------------------------------------------------------
export function paintAtlas13(paint, noise) {
  const P = id => COL13(id);
  const box = (set, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c); };
  // Pfeilmachertisch: Bretter, oben Federn und Pfeile, vorn Flint-Spitzen
  paint(P(B.FLETCHING), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise(y % 5 === 4 ? [112, 80, 42] : [166, 126, 72], 12, r));
    box(set, 0, 0, 16, 4, [108, 78, 42]); box(set, 0, 0, 16, 1, [190, 150, 92]);
    for (let x = 1; x < 15; x += 3) { box(set, x, 1, 1, 3, [232, 232, 224]); box(set, x + 1, 1, 1, 3, [190, 60, 50]); }
    box(set, 2, 6, 12, 3, [72, 50, 28]);
    for (let x = 3; x < 13; x += 3) { set(x, 7, [58, 58, 64]); set(x + 1, 7, [96, 96, 104]); set(x + 1, 6, [226, 226, 218]); }
    box(set, 0, 12, 16, 4, [96, 68, 36]); box(set, 0, 15, 16, 1, [66, 46, 24]);
    for (let y = 0; y < 16; y++) { set(0, y, [120, 88, 48]); set(15, y, [100, 72, 40]); }
  });
  // Kessel: schwarzer Eisentopf mit breitem Rand
  paint(P(B.CAULDRON), (set, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, noise([52, 54, 62], 8, r));
    box(set, 0, 0, 16, 3, [34, 34, 40]); box(set, 0, 0, 16, 1, [88, 90, 100]);
    box(set, 2, 3, 12, 3, [20, 22, 28]); box(set, 3, 3, 10, 1, [58, 118, 200]);
    for (let y = 3; y < 15; y++) { set(1, y, [86, 88, 98]); set(14, y, [30, 30, 36]); }
    box(set, 0, 13, 3, 3, [30, 30, 36]); box(set, 13, 13, 3, 3, [30, 30, 36]); box(set, 3, 14, 10, 2, [26, 26, 32]);
    for (let i = 0; i < 12; i++) set(2 + Math.floor(r() * 12), 6 + Math.floor(r() * 7), [74, 76, 86]);
  });
  // Glocke: Haken oben, goldene Glocke, Klöppel (der Rest bleibt durchsichtig)
  paint(P(B.BELL), (set, r) => {
    box(set, 1, 0, 14, 2, [96, 66, 36]); box(set, 1, 0, 14, 1, [128, 92, 54]);
    box(set, 7, 2, 2, 2, [58, 58, 64]);
    box(set, 5, 4, 6, 2, [226, 178, 40]); box(set, 4, 6, 8, 3, [238, 196, 54]); box(set, 3, 9, 10, 3, [226, 178, 40]); box(set, 2, 12, 12, 2, [200, 146, 30]);
    box(set, 5, 4, 1, 8, [255, 232, 120]); box(set, 11, 6, 1, 7, [170, 118, 24]); box(set, 2, 13, 12, 1, [150, 100, 20]);
    box(set, 7, 13, 2, 2, [70, 70, 78]); set(7, 15, [70, 70, 78]); set(8, 15, [70, 70, 78]);
    for (let i = 0; i < 4; i++) set(5 + Math.floor(r() * 6), 6 + Math.floor(r() * 6), [255, 248, 180]);
  });
}

// ---------------------------------------------------------------------
// Gegenstands-Symbole
// ---------------------------------------------------------------------
export function paintItem13(id, g, atlas) {
  const it = ITEMS[id]; if (!it) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  if (it.block != null && it.block >= FIRST13 && it.block <= LAST13) { g.drawImage(atlas, COL13(it.block) * 16, 0, 16, 16, 0, 0, 16, 16); return true; }
  switch (id) {
    case "totem_of_undying": {
      // goldene Figur mit ausgebreiteten Armen, grünen Augen und Smaragd-Stirn
      R(5, 1, 6, 5, "#f0c430"); R(5, 1, 6, 1, "#fbe27a"); R(5, 5, 6, 1, "#c8981c");
      R(4, 2, 1, 3, "#c8981c"); R(11, 2, 1, 3, "#c8981c");
      R(6, 3, 1, 1, "#1c6a3c"); R(9, 3, 1, 1, "#1c6a3c"); R(7, 4, 2, 1, "#8a5a10"); R(7, 2, 2, 1, "#2ec06a");
      R(2, 6, 12, 3, "#e0b020"); R(2, 6, 12, 1, "#fbe27a"); R(2, 8, 12, 1, "#b88a14");
      R(5, 9, 6, 5, "#d4a41c"); R(5, 9, 1, 5, "#f2cc50"); R(10, 9, 1, 5, "#a87c10");
      R(5, 14, 2, 1, "#a87c10"); R(9, 14, 2, 1, "#a87c10");
      P(7, 10, "#2ec06a"); P(8, 11, "#2ec06a"); P(7, 12, "#1c8a4a");
      return true;
    }
    case "golden_apple": {
      R(5, 4, 6, 9, "#f2c230"); R(4, 5, 8, 7, "#f2c230"); R(6, 3, 4, 2, "#f2c230");
      R(4, 5, 1, 7, "#c8901a"); R(11, 5, 1, 7, "#b4781a"); R(5, 12, 6, 1, "#a8701a"); R(6, 13, 4, 1, "#a8701a");
      R(5, 4, 2, 2, "#fff0a0"); R(5, 6, 1, 2, "#fff0a0"); R(9, 5, 1, 1, "#fff0a0");
      R(7, 1, 1, 3, "#6a4a22"); R(8, 1, 3, 1, "#3c8a30"); R(9, 2, 2, 1, "#2a6a24");
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------
// Figuren
// ---------------------------------------------------------------------
const wob = (now, id, a = 0.6, sp = 160) => Math.sin(now / sp + id * 1.3) * a;

/** true = gemalt */
export function drawMob13(R, m, bw, bh, sw, g, S, now) {
  switch (m.type) {
    case "zombie_villager": {
      const shake = m.curing > 0 ? Math.sin(now / 45) * 0.8 : 0, weak = m.weakT > 0;
      const skin = m.curing > 0 ? "#8aae6a" : "#6e9a5a", skin2 = "#5a8248";
      const robe = ["#8a6a3a", "#6a4e28"];
      R(3.6 + sw * 0.5 + shake, 19, 2.6, 9.8, "#4a3a2c"); R(6.4 - sw * 0.5 + shake, 19, 2.6, 9.8, "#3a2c20"); R(3.2 + sw * 0.5 + shake, 27.6, 3.2, 1.2, "#1c1612"); R(6 - sw * 0.5 + shake, 27.6, 3.2, 1.2, "#161210");
      R(2 + shake, 9, 7.8, 11, robe[0]); R(2 + shake, 17.6, 7.8, 2.6, robe[1]); R(2 + shake, 9, 7.8, 1.2, "#a8844a");
      R(1.4 + shake, 11.4, 9.4, 2.6, skin2); R(9, 11.4 + wob(now, m.id, 0.4), 6.4, 2.4, skin); R(14.4, 11.4, 1.2, 2.4, skin2);
      R(2.4 + shake, 1, 7.2, 8.2, skin); R(2.4 + shake, 1, 7.2, 1.2, "#86b272"); R(2.4 + shake, 7, 7.2, 2.2, skin2);
      R(9.2 + shake, 4.4, 2.6, 4.2, skin2); R(9.6 + shake, 4.8, 1.4, 2.6, "#4e7a3c");
      R(4.4 + shake, 3.6, 1.8, 1.6, "#e8e8d8"); R(7 + shake, 3.6, 1.8, 1.6, "#e8e8d8"); R(5.2 + shake, 4, 1, 1, weak ? "#c04040" : "#1a1a1a"); R(7.8 + shake, 4, 1, 1, weak ? "#c04040" : "#1a1a1a");
      R(3.8 + shake, 2.6, 2.8, 0.8, "#3a5a2a"); R(6.6 + shake, 2.6, 2.8, 0.8, "#3a5a2a");
      if (m.curing > 0) for (let i = 0; i < 3; i++) R(2 + i * 3 + Math.sin(now / 150 + i) * 1.5, -2 - ((now / 60 + i * 9) % 8), 1, 1, "#ffe070");
      return true;
    }
    case "iron_golem": {
      const raise = m.atkCd > 0.55 || m.swing > 0, arm = raise ? -7 : 0;
      R(5 + sw * 0.4, 31, 4.6, 12, "#a8a8a2"); R(12.6 - sw * 0.4, 31, 4.6, 12, "#98989a"); R(4.6 + sw * 0.4, 41.4, 5.4, 1.8, "#7a7a78"); R(12.2 - sw * 0.4, 41.4, 5.4, 1.8, "#6a6a6a");
      R(3, 12, 16.4, 19, "#cfcfca"); R(3, 12, 16.4, 2, "#e4e4e0"); R(3, 27, 16.4, 4, "#a8a8a4"); R(9, 12, 4.4, 18, "#b8b8b4");
      R(4, 18, 3, 6, "#6aa24a"); R(14, 20, 2, 7, "#5a9040"); R(5, 22, 1, 5, "#4a7a34");
      R(0.4, 12 + arm, 4.4, 17, "#c0c0bc"); R(0.4, 26 + arm, 4.4, 4, "#a4a4a0"); R(17.8, 12 + arm, 4.4, 17, "#b4b4b0"); R(17.8, 26 + arm, 4.4, 4, "#98989a");
      R(7.2, 1.4, 9.2, 10.6, "#d6d6d0"); R(7.2, 1.4, 9.2, 1.4, "#ececE6"); R(7.2, 10, 9.2, 2, "#b2b2ae");
      R(14.6, 6, 3.4, 5.6, "#b4866a"); R(15, 6, 3, 1, "#cfa085");
      R(9.2, 4.4, 2, 1.6, "#1a1a1a"); R(13, 4.4, 2, 1.6, "#1a1a1a"); R(9.2, 3.6, 6, 0.8, "#9c9c98");
      if (m.hp < m.maxHp * 0.5) { R(5, 14, 0.8, 5, "#58584f"); R(6, 18, 3, 0.8, "#58584f"); R(15, 22, 0.8, 5, "#58584f"); }
      if (m.hp < m.maxHp * 0.25) { R(10, 4, 0.8, 5, "#58584f"); R(8, 24, 4, 0.8, "#58584f"); }
      return true;
    }
    case "evoker": {
      const cast = m.castT > 0, up = cast ? -3.6 : 0;
      const coat = "#3a3a42", coat2 = "#2a2a30", trim = "#e8c028";
      R(3.4 + sw * 0.5, 22, 2.6, 7, "#2e2a2a"); R(6.2 - sw * 0.5, 22, 2.6, 7, "#242020");
      R(2, 9, 7.6, 15, coat); R(2, 9, 7.6, 1.2, "#52525c"); R(2, 21.6, 7.6, 2.4, coat2); R(2, 23.6, 7.6, 1, trim); R(5.2, 9.6, 1.2, 14, trim); R(2, 14, 7.6, 0.8, trim);
      R(1.2, 11 + up, 8.6, 2.6, "#b49a82"); R(1.2, 13.2 + up, 8.6, 1.6, "#9c846e");
      R(9.4, 9 + up - 2, 2.4, 3.6, coat); R(9.4, 8 + up - 2, 2.4, 1.4, "#c8b49a");
      R(2.4, 1, 7, 8, "#a89684"); R(2.4, 1, 7, 1.2, "#bcaa98"); R(2.4, 6.8, 7, 2, "#8c7a68");
      R(1.8, 2.6, 1.2, 2.2, "#90806e"); R(9, 2.6, 1.2, 2.2, "#90806e");
      R(3.2, 2.6, 3.4, 0.9, "#e8e8e0"); R(6.4, 2.6, 3, 0.9, "#e8e8e0");
      R(3.6, 3.6, 1.8, 1.8, "#e8e4d8"); R(6.2, 3.6, 1.8, 1.8, "#e8e4d8"); R(4.2, 4.2, 0.9, 0.9, "#c01818"); R(6.8, 4.2, 0.9, 0.9, "#c01818");
      R(5.2, 5.2, 1.6, 2.6, "#8c7664"); R(3.8, 7.4, 4.4, 0.8, "#40302a");
      R(2.2, 0.2, 7.6, 1.2, "#2e2e36");
      if (cast) for (let i = 0; i < 5; i++) R(2 + Math.sin(now / 120 + i * 1.3) * 5 + 4, -2 - ((now / 50 + i * 7) % 9), 1.1, 1.1, i % 2 ? "#ffe070" : "#9c40e0");
      return true;
    }
    case "vex": {
      const f = Math.sin(now / 55 + m.id) * 1.8;
      g.globalAlpha = m.charging ? 1 : 0.88;
      R(1.4, 2 - f, 3.4, 6, "#b8d4f0"); R(4.6, 1 - f * 1.4, 2, 5, "#9cc0e4");
      R(2, 4, 4.6, 6, "#8aa8cc"); R(2, 4, 4.6, 1, "#a8c4e4"); R(2.4, 9.4, 1.4, 3.4, "#7a98bc"); R(4.6, 9.4, 1.4, 3.2, "#6a88ac");
      R(2.4, 0.4, 4.2, 4.4, "#a8c4e4"); R(3.4, 1.8, 0.9, 0.9, "#e83030"); R(5, 1.8, 0.9, 0.9, "#e83030"); R(5.6, 3, 1, 1, "#7088a8");
      R(5.4, 6 + (m.charging ? -1.4 : 0), 5.6, 1.1, "#a8aab4"); R(10, 5.8 + (m.charging ? -1.4 : 0), 1, 1.6, "#6a4a2a");
      g.globalAlpha = 1;
      return true;
    }
    case "ravager": {
      const roar = m.roarT > 0, sh = m.stunT > 0 ? Math.sin(now / 40) * 0.7 : 0;
      for (const [x, s] of [[3, sw], [8, -sw], [21, sw], [26, -sw]]) { R(x + s * 0.6, 26, 5, 9.4, "#4a463f"); R(x + s * 0.6, 34, 5, 1.4, "#2a2824"); }
      R(1 + sh, 9, 29, 19, "#6a665e"); R(1 + sh, 9, 29, 2.4, "#7c786e"); R(1 + sh, 24, 29, 4, "#56524a");
      R(4 + sh, 12, 22, 3, "#58544c"); R(10 + sh, 11, 4, 14, "#5a564e"); R(18 + sh, 14, 3, 10, "#4e4a43");
      R(23 + sh, 7, 11, 16, "#4e4a44"); R(23 + sh, 7, 11, 2.4, "#5c5851");
      R(29 + sh, 13, 5, roar ? 10 : 7, "#3a3631");
      if (roar) { R(30 + sh, 17, 4.6, 1.8, "#9a2a2a"); R(30 + sh, 17, 1, 1, "#f0f0e8"); R(33 + sh, 17, 1, 1, "#f0f0e8"); }
      R(26.4 + sh, 3.4, 3.2, 8, "#d8d0b4"); R(27.4 + sh, 0.6, 1.6, 4, "#ece6d0"); R(26.4 + sh, 3.4, 1, 8, "#bcb498");
      R(25 + sh, 11, 2, 1.8, "#e83030"); R(24.4 + sh, 9.6, 3.4, 1, "#2a2724");
      R(22 + sh, 5, 3, 3.4, "#3a3631"); R(0, 10 + sh, 2, 5, "#58544c");
      return true;
    }
    case "wandering_trader": {
      const bob = Math.abs(Math.sin(now / 120 + m.id)) * (m.onGround && Math.abs(m.vx) > 0.4 ? 0.6 : 0);
      R(3.4, 19 - bob, 2.6, 9.8, "#3c2a1c"); R(6.2, 19 - bob, 2.6, 9.8, "#2c1e14");
      R(2, 9 - bob, 7.8, 14, "#2c3e8a"); R(2, 9 - bob, 7.8, 1.2, "#4c60b0"); R(2, 21 - bob, 7.8, 2.4, "#1e2c66"); R(5, 9 - bob, 1.4, 13, "#e8e0c0");
      R(1.4, 11.6 - bob, 8.8, 2.6, "#1e2c66"); R(1.4, 13.2 - bob, 8.8, 1.2, "#c8c0a0");
      R(2.4, 2.4 - bob, 7.2, 7, "#e2b48c"); R(9.4, 5.2 - bob, 2.4, 3.2, "#d29c78"); R(7.2, 4.4 - bob, 1.4, 1.4, "#1e1e28"); R(4.4, 4.4 - bob, 1.4, 1.4, "#1e1e28");
      R(2, 5.4 - bob, 7.6, 1.2, "#e8e8e0");
      R(1.4, 0.6 - bob, 8.8, 2.4, "#2c3e8a"); R(2.4, -1.6 - bob, 6.4, 2.4, "#3c52a8"); R(3.4, -3.4 - bob, 4.4, 2, "#2c3e8a"); R(1.4, 2.4 - bob, 8.8, 0.8, "#c8c0a0");
      R(10.4, 11 - bob, 2.2, 3.2, "#b8d8f0"); R(10.4, 10.2 - bob, 2.2, 1, "#8a6a3a");
      return true;
    }
  }
  return false;
}

/** Zusätze auf Figuren: Leuchten durch die Glocke, Decke des Händler-Lamas */
export function drawExtras13(R, m, bw, bh, now) {
  if (m.type === "llama" && m.trader) { R(2, 9, 9.6, 3.4, "#2a4a9a"); R(2, 11.2, 9.6, 1.2, "#1c3270"); R(4.4, 9, 1, 3.4, "#e8e0c0"); R(8.4, 9, 1, 3.4, "#e8e0c0"); }
  if (m.glowT > 0) {
    const a = Math.min(1, m.glowT) * (0.65 + 0.35 * Math.sin(now / 90));
    R(-0.8, -0.8, bw + 1.6, 0.8, `rgba(255,224,90,${a})`); R(-0.8, bh, bw + 1.6, 0.8, `rgba(255,224,90,${a})`);
    R(-0.8, -0.8, 0.8, bh + 1.6, `rgba(255,224,90,${a})`); R(bw, -0.8, 0.8, bh + 1.6, `rgba(255,224,90,${a})`);
  }
}

/** Fangzahn des Magiers: Blick auf den Boden, sx/sy = Position der Fußpunkts. true = gemalt */
export function drawProjectile13(g, a, sx, sy, S, now) {
  if (a.kind !== "fang") return false;
  const up = Math.max(0, Math.min(1, a.rise || 0)), h = Math.max(0, up * 2 - Math.max(0, (a.life - 0.5) * 3));
  if (h <= 0.02) return true;
  g.save(); g.translate(sx, sy);
  const Q = (x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.max(1, Math.round(w * S)), Math.max(1, Math.round(hh * S))); };
  const H = h * 14, open = a.life > 0.3 && a.life < 0.55 ? 0 : 1.4;
  Q(-5.6 - open, -H, 3.4, H, "#e8e4d0"); Q(-5.6 - open, -H, 1, H, "#fffcf0"); Q(2.2 + open, -H, 3.4, H, "#d8d4c0"); Q(4.6 + open, -H, 1, H, "#b8b4a0");
  Q(-4.4 - open, -H - 2.4, 2.2, 2.4, "#e8e4d0"); Q(2.2 + open, -H - 2.4, 2.2, 2.4, "#d8d4c0");
  Q(-2.2, -2, 4.4, 2, "#3a2a1c");
  g.restore();
  return true;
}
