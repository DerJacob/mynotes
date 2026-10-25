// =====================================================================
// Blockdorf – Tiere und Monster malen (Etappe 3)
// Alle Figuren sind aus Rechtecken zusammengesetzt (1 Bildpunkt = S Bildschirmpixel), eigene Entwürfe im
// kantigen Stil der Bedrock-1.8-Zeit. Bildschirm-Koordinaten kommen von sandbox.js, hier gibt es keine Spielregeln.
// =====================================================================

/** Hauptfarbe je Sorte (für Partikel beim Treffer/Tod) */
export const MOB_COLORS = {
  cow: [86, 62, 46], pig: [240, 160, 164], sheep: [236, 236, 230], chicken: [244, 244, 240], rabbit: [168, 132, 88], wolf: [200, 200, 200], cat: [201, 138, 74],
  zombie: [92, 154, 84], skeleton: [216, 216, 204], creeper: [78, 166, 75], spider: [58, 47, 42], witch: [74, 42, 106], enderman: [28, 24, 36], slime: [60, 174, 94]
};

const tintCache = new Map();
function tint(c, k) {
  const key = c + k;
  let v = tintCache.get(key);
  if (!v) {
    const n = parseInt(c.slice(1, 7), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    v = `rgb(${Math.round(r + (255 - r) * k * 0.55)},${Math.round(g * (1 - k * 0.7))},${Math.round(b * (1 - k * 0.7))})`;
    tintCache.set(key, v);
  }
  return v;
}

/**
 * Malt ein Tier / Monster. bx, by = linke obere Ecke des Körpers auf dem Bildschirm, S = Pixelgröße, now = Zeit in ms.
 * art.base(id) liefert Gegenstandsbilder (für den Bogen des Skeletts).
 */
export function drawMob(g, m, bx, by, S, T, now, art) {
  const bsc = m.baby > 0 ? 0.55 : 1, bw = m.w * T / bsc, bh = m.h * T / bsc, flip = m.face < 0;
  const k = m.hurtT > 0 ? Math.min(1, m.hurtT / 0.2) : 0;
  const moving = m.onGround && Math.abs(m.vx) > 0.4;
  const sw = moving ? Math.sin(now / 105 + m.id * 1.7) * 1.7 : 0;
  g.save();
  g.translate(bx + (flip ? Math.round(bw * bsc * S) : 0), by);
  g.scale(flip ? -1 : 1, 1);
  if (bsc !== 1) g.scale(bsc, bsc);                                  // Jungtiere: dieselbe Figur, kleiner (Etappe 4)
  const R = (x, y, w, h, c) => { g.fillStyle = k ? tint(c, k) : c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.max(1, Math.round(w * S)), Math.max(1, Math.round(h * S))); };
  let fireH = bh;
  switch (m.type) {
    case "cow": {
      for (const [x, s] of [[2, sw], [6, -sw], [11, sw], [14.5, -sw]]) { R(x + s * 0.5, 13, 3, 8.6, "#3a2a1e"); R(x + s * 0.5, 19.8, 3, 1.8, "#161210"); }
      R(1, 5, 16.5, 9, "#4a3426"); R(1, 12.5, 16.5, 1.5, "#3a281c"); R(4, 5, 4, 4, "#e8e4dc"); R(11, 8, 4.5, 5, "#e8e4dc"); R(9, 5, 2, 2, "#e8e4dc");
      R(8, 13.5, 4, 1.8, "#e8a8a8");
      R(15, 3, 5.8, 8.4, "#4a3426"); R(18.4, 7, 2.4, 4.4, "#c8b49a"); R(19.6, 8.4, 0.8, 0.8, "#3a2a20"); R(17, 4.6, 1.3, 1.3, "#111"); R(15.2, 1.2, 1.4, 2.6, "#e8e4d8"); R(19.6, 1.2, 1.4, 2.6, "#e8e4d8");
      break;
    }
    case "pig": {
      for (const [x, s] of [[2, sw], [9, -sw]]) R(x + s * 0.5, 10, 3, 4.4, "#e08c90");
      R(1, 3.5, 12.5, 7.5, "#f0a0a4"); R(1, 9, 12.5, 2, "#d88488"); R(1, 3.5, 12.5, 1.2, "#f8b4b8");
      R(11, 2.5, 5, 6.5, "#f4aaae"); R(14.2, 5, 1.8, 3.4, "#e08a8e"); R(14.8, 5.6, 0.7, 0.9, "#a85a5e"); R(14.8, 7, 0.7, 0.9, "#a85a5e"); R(12.6, 4, 1.2, 1.2, "#222"); R(11.4, 1.6, 2.2, 1.6, "#e08a8e");
      R(0, 4, 1.4, 1.4, "#e08a8e");
      break;
    }
    case "sheep": {
      for (const [x, s] of [[3, sw], [6, -sw], [11, sw], [14, -sw]]) R(x + s * 0.5, 14, 2.4, 5.2, "#d6c2a0");
      if (m.sheared) { R(2, 5, 13, 8.5, "#e6bfae"); R(2, 12, 13, 1.5, "#cfa392"); }
      else { R(0.5, 3, 16, 12, "#ebebe6"); R(1, 2.2, 14, 1.6, "#f6f6f2"); R(1, 13.2, 15, 1.8, "#cfcfc8"); R(4, 7, 3, 2, "#dcdcd6"); R(10, 9, 3, 2, "#dcdcd6"); }
      R(14, 4.5, 5.2, 6.4, "#d6c2a0"); R(14.6, 3.2, 4.2, 2, m.sheared ? "#d6c2a0" : "#ebebe6"); R(17, 6, 1.1, 1.1, "#111"); R(14, 5, 1.4, 2, "#b8a47e"); R(18.2, 8.6, 1, 1.2, "#8a7a5a");
      break;
    }
    case "chicken": {
      R(3 + sw * 0.3, 9, 0.9, 2.4, "#e8a020"); R(5 - sw * 0.3, 9, 0.9, 2.4, "#e8a020"); R(2.4, 11, 1.8, 0.6, "#e8a020"); R(4.6, 11, 1.8, 0.6, "#e8a020");
      R(0.5, 4, 6.6, 5.4, "#f4f4f0"); R(0, 3.2, 2, 3, "#e8e8e2"); R(2, 5, 3.2, 3, m.vy > 1 ? "#cfcfc8" : "#dcdcd6");
      R(5.6, 1, 3, 4.6, "#f6f6f2"); R(8.4, 2.6, 1.6, 1.2, "#f0a020"); R(6.4, 0, 1.6, 1.4, "#d22a2a"); R(8, 3.8, 1, 1.6, "#d22a2a"); R(7.2, 2, 0.9, 0.9, "#111");
      break;
    }
    case "rabbit": {
      R(1, 3, 5.6, 3.6, "#a88458"); R(0.4, 4, 3, 3, "#98744c"); R(0, 4, 1.4, 1.4, "#f4f0e8");
      R(2, 6.4, 1.6, 1.6, "#8c6a44"); R(5, 6.4, 1.2, 1.6, "#8c6a44");
      R(5, 2, 3, 3.2, "#b89468"); R(5.4, 0, 1, 2.6, "#a88458"); R(6.8, 0, 1, 2.6, "#a88458"); R(5.6, 0.6, 0.5, 1.6, "#e8b8b0"); R(7.2, 3, 0.9, 0.9, "#111"); R(7.8, 3.8, 0.6, 0.6, "#d88080");
      break;
    }
    case "wolf": {
      const sit = m.sit, yo = sit ? 2.4 : 0, lh = sit ? 2.4 : 4.6;
      const fur = m.angry ? "#b8a8a8" : "#c9c9c9", dark = "#aaaaaa";
      if (sit) { R(1, 5 + yo, 7, 6, fur); R(1, 9.4 + yo, 7, 1.6, dark); R(8, 6.5 + yo, 2, 4.5, "#bdbdbd"); R(-0.5, 9.4 + yo, 3, 1.6, "#b9b9b9"); }
      else {
        for (const [x, s] of [[2, sw], [5, -sw], [8, sw], [10.2, -sw]]) R(x + s * 0.4, 9, 2, lh, "#bdbdbd");
        R(1.5, 4, 9.6, 5.6, fur); R(1.5, 8, 9.6, 1.6, dark); R(-0.8, m.angry ? 2 : 3.6, 3, 2, "#b9b9b9");
      }
      R(10, 2 + yo, 4.4, 4.6, "#d2d2d2"); R(13, 4 + yo, 2, 2, dark); R(14.4, 4 + yo, 1, 1, "#222"); R(10.4, 0.4 + yo, 1.5, 2.2, "#bdbdbd"); R(12.8, 0.4 + yo, 1.5, 2.2, "#bdbdbd");
      R(12, 3 + yo, 1, 1, m.angry ? "#e02020" : "#222");
      if (m.tamed) R(9.4, 4 + yo, 1.6, 4, "#d02828");
      break;
    }
    case "cat": {
      const sit = m.sit, yo = sit ? 1 : 0;
      for (const [x, s] of [[2.4, sw], [4.4, -sw], [7, sw], [8.6, -sw]]) R(x + s * 0.4, 7, 1.5, 2.6, "#b87a3c");
      R(2, 3 + yo, 8, 4, "#c98a4a"); R(4, 3 + yo, 1, 4, "#8a5a28"); R(7, 3 + yo, 1, 4, "#8a5a28"); R(2, 6 + yo, 8, 1, "#b0763a");
      R(-0.8, sit ? 6 : 1.4, 2.4, 1.4, "#c98a4a"); R(-1.2, sit ? 6 : 0.2, 1.4, 2.6, "#b0763a");
      R(9, 1.6 + yo, 4, 3.8, "#d09a56"); R(9.2, 0.4 + yo, 1.2, 1.4, "#d09a56"); R(11.8, 0.4 + yo, 1.2, 1.4, "#d09a56"); R(11, 2.8 + yo, 1, 1, "#4ec06a"); R(12.4, 4 + yo, 0.8, 0.8, "#e08a8a");
      if (m.tamed) R(8.4, 3.8 + yo, 1.4, 2.4, "#3a60e0");
      break;
    }
    case "zombie": {
      R(3 + sw * 0.5, 18, 3, 10.8, "#2f3a8a"); R(6.6 - sw * 0.5, 18, 3, 10.8, "#272f74"); R(2.6 + sw * 0.5, 27, 3.6, 1.8, "#1c2250"); R(6.2 - sw * 0.5, 27, 3.6, 1.8, "#161c40");
      R(2, 9, 7.6, 9.5, "#2a8ca0"); R(2, 9, 7.6, 1.3, "#3aa4b8"); R(2, 17, 7.6, 1.4, "#1c6070"); R(5, 12, 2, 3, "#1c6070");
      R(7, 10, 9.4, 2.6, "#5c9a54"); R(7, 12.4, 8.4, 2.4, "#4c8444"); R(15.6, 9.8, 1.6, 2.8, "#4e8a46");
      R(2.4, 1, 7, 7.6, "#5c9a54"); R(2.4, 1, 7, 1.6, "#4c8444"); R(6.6, 3.6, 1.8, 1.8, "#111"); R(3.2, 3.6, 1.8, 1.8, "#111"); R(5.8, 6.2, 3, 0.9, "#2c4a28"); R(2.4, 6.4, 1.6, 2, "#4c8444");
      break;
    }
    case "skeleton": {
      R(3.8 + sw * 0.5, 18, 1.9, 10.8, "#d8d8cc"); R(7 - sw * 0.5, 18, 1.9, 10.8, "#cacabe"); R(3.4 + sw * 0.5, 27.4, 2.8, 1.4, "#d8d8cc"); R(6.6 - sw * 0.5, 27.4, 2.8, 1.4, "#cacabe");
      R(5.2, 9, 1.5, 9.4, "#d8d8cc"); for (const y of [10, 12.3, 14.6]) R(3.2, y, 5.8, 1.1, "#d8d8cc"); R(4.4, 16.8, 3.4, 1.2, "#cacabe");
      R(7.6, 9.6, 6.4, 1.4, "#d8d8cc"); R(2, 9.6, 1.4, 6, "#cacabe");
      R(2.4, 1, 7, 7.6, "#dcdcd0"); R(2.4, 1, 7, 1.2, "#eeeee4"); R(3.6, 3.4, 2, 2, "#1a1a1a"); R(6.8, 3.4, 2, 2, "#1a1a1a"); R(5.8, 5.4, 1, 1, "#9a9a8c"); R(4, 6.8, 4.6, 0.9, "#2a2a2a");
      if (art) { const sz = Math.round(11 * S); g.drawImage(art.base("bow"), 0, 0, 16, 16, Math.round(11 * S), Math.round(4.6 * S), sz, sz); }
      break;
    }
    case "creeper": {
      const sc = 1 + Math.min(0.25, (m.fuse || 0) * 0.17);
      if (sc > 1) { g.translate(Math.round(bw / 2 * S), Math.round(bh * S)); g.scale(sc, sc * 0.98); g.translate(-Math.round(bw / 2 * S), -Math.round(bh * S)); }
      const flash = (m.fuse || 0) > 0 && Math.floor((m.fuse || 0) * 9) % 2 === 0;
      const c1 = flash ? "#f4f8f0" : "#4ea64b", c2 = flash ? "#dce4d6" : "#3c8a3a", c3 = flash ? "#ffffff" : "#56b052";
      R(1, 18.4, 3.6, 7.2, c2); R(6.6, 18.4, 3.6, 7.2, c2); R(0.6 + sw * 0.5, 19.4, 3.6, 6.2, c1); R(7 - sw * 0.5, 19.4, 3.6, 6.2, c1);
      R(2, 9, 7.4, 10, c1); R(3, 11, 2, 2, c2); R(6.4, 14, 2, 2, c2); R(2, 9, 7.4, 1.2, c3);
      R(1, 0, 9.2, 9, c3); R(1, 0, 9.2, 1.2, flash ? "#ffffff" : "#68c264"); R(2.4, 2.4, 2.2, 2.2, "#0e1c0e"); R(6.6, 2.4, 2.2, 2.2, "#0e1c0e"); R(4.4, 4.6, 2.4, 3.6, "#0e1c0e"); R(3.4, 5.8, 1, 2.4, "#0e1c0e"); R(7.2, 5.8, 1, 2.4, "#0e1c0e");
      break;
    }
    case "spider": {
      for (let i = 0; i < 4; i++) {
        const lx = 7 + i * 2.4, s = moving ? Math.sin(now / 80 + i * 1.6 + m.id) * 1.4 : 0;
        for (const [far, c] of [[1, "#2a2220"], [0, "#3a302c"]]) { const dy = far ? -0.8 : 0; R(lx - 2.6 + s + far, 5 + dy, 3.6, 1.1, c); R(lx - 4.6 + s * 1.4 + far, 5.6 + dy, 1.1, 8, c); }
      }
      R(0.6, 4.4, 9.6, 7.4, "#2c2420"); R(2, 5, 6, 2, "#4a3a32"); R(8.6, 5.4, 5.4, 5.6, "#3a2f2a"); R(13.4, 4.8, 6.4, 6.4, "#3a2f2a");
      R(18, 5.8, 1.8, 1.8, "#e02424"); R(18, 8.4, 1.8, 1.8, "#e02424"); R(16.4, 6.4, 1, 1, "#e02424"); R(16.4, 8.8, 1, 1, "#e02424"); R(18.8, 10, 1.4, 1.6, "#2a2220");
      break;
    }
    case "witch": {
      R(3.6 + sw * 0.4, 25, 2, 3.6, "#2a1830"); R(6.2 - sw * 0.4, 25, 2, 3.6, "#2a1830");
      R(2, 10, 7.6, 17, "#4a2a6a"); R(2, 24, 7.6, 3.6, "#321a4c"); R(2, 10, 7.6, 1.4, "#6a3c92"); R(1.4, 13, 8.8, 3, "#5a3880"); R(5.4, 11, 1.6, 4, "#e8e0d0");
      R(2.6, 3.6, 6.6, 7, "#7fa05a"); R(8.8, 6, 2.2, 3.2, "#6a8a48"); R(10.2, 8, 0.9, 0.9, "#3a5a2a"); R(6.6, 5.8, 1.4, 1.4, "#111"); R(3.8, 5.8, 1.4, 1.4, "#111"); R(1.8, 4.6, 1.8, 6, "#d05a2a");
      R(0.6, 2.6, 10.6, 1.6, "#201020"); R(2.6, 0, 6, 2.8, "#2a1630"); R(4, -2.6, 3, 2.8, "#201020"); R(5, -4.2, 2, 1.8, "#201020"); R(2.6, 2.6, 6, 0.8, "#6a2a8a");
      if (m.shootCd < 0.7) R(10.6, 11.6, 2.4, 3.2, "#b050e0");
      break;
    }
    case "enderman": {
      const jx = m.angry ? (Math.sin(now / 35) * 0.5) : 0;
      g.translate(Math.round(jx * S), 0);
      R(2 + sw * 0.6, 25, 2.2, 21.4, "#1a1822"); R(5.4 - sw * 0.6, 25, 2.2, 21.4, "#14121a");
      R(1.6, 13, 6.6, 12.4, "#1a1822"); R(0, 13.4, 1.6, 24, "#14121a"); R(8.2, 13.4, 1.6, 24, "#1a1822");
      R(1.4, 3, 6.8, 8.4, "#1c1a24"); R(1.4, 3, 6.8, 1.2, "#262432");
      R(2, 6.6, 2.2, 1.3, m.angry ? "#ff80ff" : "#d070ff"); R(5.6, 6.6, 2.2, 1.3, m.angry ? "#ff80ff" : "#d070ff");
      if (m.angry) R(2.4, 9, 4.8, 1.6, "#3a0a44");
      if (m.angry) for (let i = 0; i < 4; i++) { const t = now / 300 + i * 1.7; R(4.6 + Math.sin(t) * 6, 10 + ((t * 7) % 30), 0.9, 0.9, i % 2 ? "#c050ff" : "#7a20c0"); }
      break;
    }
    case "slime": {
      g.restore();
      drawSlime(g, m, bx, by, S, T, k);
      return;
    }
    default: R(0, 0, bw, bh, "#f0f");
  }
  if (m.fire) {
    for (let i = 0; i < 5; i++) {
      const jx = Math.sin(now / 90 + i * 2.1 + m.id) * 0.8, hh = 3.5 + (Math.sin(now / 70 + i * 3.3) + 1) * 2.2;
      g.fillStyle = i % 2 ? "#ffd24a" : "#ff8a1c"; g.fillRect(Math.round((0.5 + i * (bw / 5) + jx) * S), Math.round((bh * 0.45 - hh + i % 3 * 3) * S), Math.round(2.4 * S), Math.round(hh * S));
    }
  }
  g.restore();
}

/** Schleim: hüpft, quetscht sich beim Springen */
export function drawSlime(g, s, bx, by, S, T, k = 0) {
  const w = s.w * T * S, hh = s.h * T * S, sq = Math.max(0.7, Math.min(1.35, 1 - s.vy * 0.03)), sh = hh * sq, sw = w * (2 - sq) * 0.9 + w * 0.1;
  const x = bx + (w - sw) / 2, y = by + (hh - sh);
  const col = (c) => (k ? tint(c, k) : c);
  g.globalAlpha = 0.92;
  g.fillStyle = col("#3cae5e"); g.fillRect(Math.round(x), Math.round(y + sh * 0.25), Math.round(sw), Math.round(sh * 0.75));
  g.fillRect(Math.round(x + sw * 0.12), Math.round(y), Math.round(sw * 0.76), Math.round(sh * 0.3));
  g.fillStyle = col("#7ce09a"); g.fillRect(Math.round(x + sw * 0.18), Math.round(y + sh * 0.1), Math.round(sw * 0.3), Math.round(sh * 0.12));
  g.fillStyle = col("#256f3c"); g.fillRect(Math.round(x), Math.round(y + sh * 0.85), Math.round(sw), Math.round(sh * 0.15));
  g.fillStyle = "#10281a"; g.fillRect(Math.round(x + sw * 0.28), Math.round(y + sh * 0.38), Math.round(sw * 0.12), Math.round(sh * 0.2)); g.fillRect(Math.round(x + sw * 0.62), Math.round(y + sh * 0.38), Math.round(sw * 0.12), Math.round(sh * 0.2));
  g.globalAlpha = 1;
}

/** Pfeil oder Trank, sx/sy = Bildschirmposition der Spitze */
export function drawProjectile(g, a, sx, sy, S, now) {
  g.save();
  g.translate(sx, sy);
  if (a.kind === "potion") {
    g.rotate(now / 120);
    g.fillStyle = "#6a2a8a"; g.fillRect(-2 * S, -2 * S, 4 * S, 4 * S); g.fillStyle = "#c050e0"; g.fillRect(-1.5 * S, -1 * S, 3 * S, 2.5 * S); g.fillStyle = "#e8e0d0"; g.fillRect(-1 * S, -3 * S, 2 * S, 1.2 * S);
  } else {
    g.rotate(a.ang !== undefined ? a.ang : Math.atan2(a.vy, a.vx));
    g.fillStyle = "#8a6a42"; g.fillRect(-9 * S, -0.5 * S, 10 * S, Math.max(1, S));
    g.fillStyle = "#aeb2bc"; g.fillRect(0, -1.2 * S, 2.6 * S, 2.4 * S); g.fillStyle = "#e8ecf4"; g.fillRect(1.6 * S, -0.6 * S, 1.4 * S, 1.2 * S);
    g.fillStyle = "#f0f0f4"; g.fillRect(-9 * S, -1.6 * S, 3 * S, 3.2 * S); g.fillStyle = "#c0c0cc"; g.fillRect(-9 * S, -0.3 * S, 3 * S, 0.6 * S);
  }
  g.restore();
}
