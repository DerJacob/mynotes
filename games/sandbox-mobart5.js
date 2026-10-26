// =====================================================================
// Blockdorf – Nether- und Ende-Monster malen (Etappe 5). Wie in sandbox-mobart.js: nur Rechtecke, 1 Bildpunkt = S Bildschirmpixel.
// =====================================================================

import { drawMob6, MOB_COLORS6 } from "./sandbox-mobart6.js?v=7";

export const MOB_COLORS5 = {
  piglin: [230, 150, 140], zombie_piglin: [120, 150, 90], ghast: [240, 240, 240], blaze: [250, 190, 40], wither_skeleton: [40, 40, 44],
  magma_cube: [200, 80, 24], ender_dragon: [30, 20, 40], end_crystal: [210, 150, 255], wither: [30, 30, 36], ...MOB_COLORS6
};

/**
 * Malt eine Sorte aus Etappe 5. R(x, y, w, h, farbe) zeichnet im Körperraster. true = gemalt.
 * bw/bh = Körpergröße in Bildpunkten, sw = Schrittausschlag, g/S/now wie in drawMob.
 */
export function drawMob5(R, m, bw, bh, sw, g, S, now) {
  switch (m.type) {
    case "piglin": case "zombie_piglin": {
      const z = m.type === "zombie_piglin";
      const skin = z ? "#7a9a5a" : "#e8a090", skin2 = z ? "#648048" : "#cc8474", cloth = z ? "#4a6a3a" : "#7c4a2a", cloth2 = z ? "#3a5a2c" : "#5c3620";
      R(2.2 + sw * 0.5, 20, 3, 8.8, cloth2); R(5.6 - sw * 0.5, 20, 3, 8.8, cloth2); R(2.2 + sw * 0.5, 27.4, 3, 1.4, "#241810"); R(5.6 - sw * 0.5, 27.4, 3, 1.4, "#241810");
      R(1.6, 10, 8, 11, cloth); R(1.6, 10, 8, 1.2, z ? "#5c7e4a" : "#966038"); R(1.6, 18, 8, 3, cloth2); R(4.6, 10, 2, 11, z ? "#3a5a2c" : "#e0b040");
      const arm = m.angry ? -4 : 0;
      R(-0.6, 10.6 + arm, 2.2, 9, skin2); R(9.8, 10.6 + arm, 2.2, 9, skin);
      if (m.angry && !z) { R(10, 6, 2, 3, "#d6d9e4"); R(10.4, 3, 1.2, 3.4, "#f4f5fa"); }
      if (!z && m.barterT > 0) R(9.6, 14, 3, 3, "#f4c93a");
      R(1.6, 1.4, 8.4, 8.6, skin); R(1.6, 1.4, 8.4, 1.2, z ? "#8cac6a" : "#f0b4a4");
      R(0, 3.2, 1.8, 3.4, skin2); R(10, 3.2, 1.8, 3.4, skin2);
      R(3, 6.4, 5.6, 3.4, skin2); R(3.6, 6.8, 1, 1.4, "#f4ecd8"); R(7, 6.8, 1, 1.4, "#f4ecd8");
      R(3.2, 4, 1.6, 1.4, "#241410"); R(7, 4, 1.6, 1.4, "#241410"); if (m.angry) { R(3, 3.2, 2, 0.7, "#241410"); R(6.8, 3.2, 2, 0.7, "#241410"); }
      R(3.6, 7.2, 0.7, 0.7, "#000"); R(6.8, 7.2, 0.7, 0.7, "#000");
      if (z) { R(1.6, 1.4, 8.4, 0.8, "#40563a"); R(2.4, 5, 1, 1, "#3a4a2c"); }
      return true;
    }
    case "ghast": {
      const charge = m.wind > 0, bob = Math.sin(now / 420 + m.id) * 0.7;
      const body = charge ? "#fbe8e0" : "#f4f4f2", edge = charge ? "#e8c0b0" : "#d6d6d4";
      for (let i = 0; i < 9; i++) {
        const lx = 3 + i * 5.4, len = 11 + ((i * 7) % 5) * 2 + Math.sin(now / 300 + i * 1.3) * 2.2;
        R(lx, 36 + bob, 3.2, len, i % 2 ? edge : body); R(lx, 36 + bob + len - 1.2, 3.2, 1.2, "#b8b8b6");
      }
      R(0, 2 + bob, 54.4, 36, body); R(0, 2 + bob, 54.4, 3, "#fff"); R(0, 35 + bob, 54.4, 3, edge); R(0, 2 + bob, 2.4, 36, edge); R(52, 2 + bob, 2.4, 36, edge);
      R(3, 6 + bob, 9, 6, "#e8e8e6"); R(38, 10 + bob, 12, 8, "#e8e8e6");
      const ey = charge ? "#e02020" : "#2a2a2a";
      R(8, 19 + bob, 13, 4.4, ey); R(33, 19 + bob, 13, 4.4, ey); R(8, 19 + bob, 13, 1, "#00000044");
      R(21, 30 + bob, 12, 3.6, ey === "#2a2a2a" ? "#484848" : "#8a1010");
      return true;
    }
    case "blaze": {
      const t = now / 220 + m.id;
      for (let i = 0; i < 4; i++) {
        const a = t + i * 1.57, off = Math.cos(a) * 4.6, hh = 3.4 + (i % 2) * 1.2;
        for (let j = 0; j < 3; j++) { const yy = 11 + j * 6.2 + Math.sin(t * 1.4 + j) * 0.6; R(4.4 + off * (j % 2 ? -1 : 1), yy, 2.6, hh, j % 2 ? "#e8a020" : "#f0b830"); }
      }
      R(5, 8, 1.8, 20, "#d88a18"); R(3.4, 17, 4.8, 8, "#e49a1c");
      R(1.6, 0.4, 8, 8, "#e8a420"); R(1.6, 0.4, 8, 1.2, "#ffd860"); R(1.6, 7, 8, 1.2, "#c47a10");
      R(3.2, 3.4, 1.6, 1.6, "#2a1608"); R(6.8, 3.4, 1.6, 1.6, "#2a1608"); R(4.2, 6, 3, 0.9, "#6a3a10");
      if (m.burst > 0) R(3.6, 2, 4.4, 0.8, "#ff5018");
      R(0.4, 4, 1.2, 1.6, "#c47a10"); R(10, 4, 1.2, 1.6, "#c47a10");
      return true;
    }
    case "wither_skeleton": {
      R(2.4 + sw * 0.5, 22, 2.2, 14, "#26262a"); R(5.6 - sw * 0.5, 22, 2.2, 14, "#1c1c20");
      R(1.6, 13, 8, 9.4, "#2a2a2e"); for (let i = 0; i < 4; i++) R(2.4, 14 + i * 2.2, 6.4, 0.9, "#0e0e10"); R(5, 13, 1.4, 9.4, "#18181a");
      const arm = m.atkCd > 0.7 ? -3 : 0;
      R(-0.4, 13.4 + arm, 2, 13, "#24242a"); R(9.8, 13.4 + arm, 2, 13, "#2a2a2e");
      R(10, 22 + arm, 2.6, 2, "#1a1a1e");
      R(10.2, 24.6 + arm, 1.4, 11, "#4a4a52"); R(9.2, 24 + arm, 3.4, 1.2, "#6a6a72"); R(10.2, 21 + arm, 1.4, 3, "#8a8a92");
      R(1.8, 3.2, 8, 9.4, "#2c2c30"); R(1.8, 3.2, 8, 1.2, "#3c3c42"); R(2.6, 6.4, 2, 1.8, "#000"); R(7, 6.4, 2, 1.8, "#000"); R(3, 6.8, 0.8, 0.8, "#c04020"); R(7.4, 6.8, 0.8, 0.8, "#c04020");
      R(3.6, 10, 4.4, 1, "#101012"); R(4.6, 9.6, 0.8, 2, "#101012");
      return true;
    }
    case "magma_cube": {
      const sq = Math.max(0.75, Math.min(1.3, 1 - (m.vy || 0) * 0.03)), w = bw, h = bh * sq, y0 = bh - h;
      const glow = Math.sin(now / 260 + m.id) > 0;
      R(0, y0, w, h, "#3c1c18"); R(0.6, y0 + 0.6, w - 1.2, h - 1.2, "#541c14");
      for (let i = 0; i < 3; i++) R(1.4 + i * 4.6, y0 + 2 + (i % 2) * 3, 3.4, 1.2, glow ? "#ffb030" : "#e8781c");
      R(1.4, y0 + h * 0.3, w - 2.8, 1, glow ? "#ff8a1c" : "#cc5a14");
      R(2.6, y0 + h * 0.5, 3.2, 2, "#ffd060"); R(w - 5.8, y0 + h * 0.5, 3.2, 2, "#ffd060"); R(2.6, y0 + h * 0.62, 3.2, 0.8, "#c05014"); R(w - 5.8, y0 + h * 0.62, 3.2, 0.8, "#c05014");
      R(0, y0 + h - 1.2, w, 1.2, "#2a100c");
      return true;
    }
    case "end_crystal": {
      const t = now / 700 + m.id, fl = Math.round(Math.sin(t) * 1.2);
      R(1.4, 18, 19, 3.4, "#3a3a46"); R(0.4, 20.4, 21, 2, "#202028");
      g.save(); g.translate(Math.round(bw / 2 * S), Math.round((9 + fl) * S)); g.rotate(t * 0.9);
      const q = 6.4 * S; g.fillStyle = "#d29aff"; g.fillRect(-q, -q, q * 2, q * 2); g.fillStyle = "#f0d0ff"; g.fillRect(-q, -q, q, q); g.fillStyle = "#8a50c8"; g.fillRect(0, 0, q, q);
      g.rotate(0.785); const r2 = 4.2 * S; g.fillStyle = "#fff"; g.fillRect(-r2 / 2, -r2 / 2, r2, r2); g.restore();
      return true;
    }
    case "wither": {
      const flash = m.fuse > 0 && Math.floor(now / 110) % 2 === 0, armor = (m.hp || 1) <= (m.maxHp || 300) / 2;
      const C = (c) => flash ? "#d8dcff" : c;
      R(15.6, 14, 3.4, 22, C("#2c2c34")); for (let i = 0; i < 6; i++) R(9, 16 + i * 3.2, 17, 1.4, C("#34343e")); R(12, 14, 11, 1.8, C("#3c3c46"));
      R(4, 14, 4, 4, C("#2c2c34")); R(27, 14, 4, 4, C("#2c2c34"));
      const skull = (x, y, s, ey) => {
        R(x, y, s, s, C("#3a3a42")); R(x, y, s, s * 0.14, C("#4e4e58")); R(x + s * 0.16, y + s * 0.38, s * 0.22, s * 0.22, ey); R(x + s * 0.62, y + s * 0.38, s * 0.22, s * 0.22, ey);
        R(x + s * 0.3, y + s * 0.72, s * 0.4, s * 0.1, C("#14141a"));
      };
      const e = armor ? "#d8e8ff" : "#101014";
      skull(10.4, -1, 14.4, e); skull(-1, 3.4, 9.2, e); skull(26.6, 3.4, 9.2, e);
      if (armor) { R(9, 14, 17, 2.2, "#8aa0d8"); R(10.4, -1, 14.4, 1, "#aac0f0"); }
      return true;
    }
    case "ender_dragon": {
      const t = now / 260, fl = Math.sin(t) * 7;
      const dk = "#16101e", md = "#241a30", lt = "#38284a";
      for (const s of [0, 1]) {                                       // zwei Flügel, der hintere dunkler
        const c = s ? dk : md, wob = s ? Math.sin(t - 0.5) * 7 : fl;
        for (let i = 0; i < 4; i++) { const ln = 26 - i * 4; R(36 - i * 5 - (s ? 3 : 0), 12 + wob * (1 - i * 0.18) - ln + (s ? 6 : 0), 5.6, ln, c); }
        R(30 - (s ? 3 : 0), 12 + wob * 0.2 + (s ? 6 : 0), 22, 6, c);
        for (let i = 0; i < 4; i++) R(36 - i * 5 - (s ? 3 : 0), 12 + wob * (1 - i * 0.18) - (26 - i * 4) + (s ? 6 : 0), 1.2, 26 - i * 4, lt);
      }
      R(10, 20, 54, 20, md); R(10, 20, 54, 3, lt); R(10, 36, 54, 4, dk);
      for (let i = 0; i < 6; i++) R(16 + i * 8, 15, 3, 5, lt);                  // Rückenzacken
      const tail = Math.sin(t * 0.7) * 3;
      R(0, 24 + tail, 12, 8, md); R(-14, 26 + tail * 1.4, 16, 6, dk); R(-28, 27 + tail * 1.8, 16, 4, dk);
      R(62, 14, 14, 14, md); R(62, 14, 14, 2, lt);                                 // Hals
      R(72, 4, 22, 17, md); R(72, 4, 22, 3, lt); R(88, 12, 12, 8, dk); R(88, 12, 12, 1.4, lt);   // Kopf + Schnauze
      R(76, 0, 3, 5, lt); R(84, 0, 3, 5, lt);
      R(82, 8, 4, 3, m.ph === "dive" ? "#ff4080" : "#e070ff"); R(83, 8, 2, 1, "#fff");
      R(90, 17, 8, 2, "#e8e0f0");
      R(22, 38 + fl * 0.1, 4, 8, dk); R(46, 38 - fl * 0.1, 4, 8, dk);
      if (m.healing) { g.globalAlpha = 0.35; R(8, 18, 70, 22, "#e8a0ff"); g.globalAlpha = 1; }
      return true;
    }
    default: return drawMob6(R, m, bw, bh, sw, g, S, now);
  }
}

/** Feuerball / Lohenschuss / Schädel / Enderperle (sx, sy = Mitte), true = gemalt */
export function drawProjectile5(g, a, sx, sy, S, now) {
  const Q = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S))); };
  g.save(); g.translate(sx, sy);
  switch (a.kind) {
    case "fireball": {
      const k = a.big ? 1.5 : 1;
      g.rotate(now / 160); Q(-3 * k, -3 * k, 6 * k, 6 * k, "#4a4a4a"); Q(-2.4 * k, -2.4 * k, 4.8 * k, 4.8 * k, "#d8561a"); Q(-1.6 * k, -1.6 * k, 3.2 * k, 3.2 * k, "#ffb030"); Q(-0.8 * k, -0.8 * k, 1.6 * k, 1.6 * k, "#fff0a0");
      break;
    }
    case "firebolt": g.rotate(now / 100); Q(-1.6, -1.6, 3.2, 3.2, "#c8480e"); Q(-1, -1, 2, 2, "#ffc040"); Q(-0.4, -0.4, 0.8, 0.8, "#fff"); break;
    case "skull": g.rotate(now / 200); Q(-2, -2, 4, 4, "#1c1c22"); Q(-1.6, -1.6, 3.2, 3.2, "#3a3a44"); Q(-1.2, -0.4, 0.8, 0.8, "#101014"); Q(0.4, -0.4, 0.8, 0.8, "#101014"); break;
    case "pearl": g.rotate(now / 140); Q(-2, -2, 4, 4, "#0e3a34"); Q(-1.6, -1.6, 3.2, 3.2, "#2a9a82"); Q(-1, -1, 1.4, 1.4, "#8af0d0"); break;
    default: g.restore(); return false;
  }
  g.restore(); return true;
}
