// =====================================================================
// Blockdorf – Grafik der Etappe 10: Armbrust, Spektral- und getränkte Pfeile, Verweiltrank, Drachenatem, Feuerwerk.
// Eigene 16 × 16-Bilder im kantigen Stil der 1.8-Zeit.
// =====================================================================
import { COLORS, ITEMS } from "./sandbox-data.js?v=10";
import { potionColor, FIREWORK_FLIGHT, FIREWORK_STAR } from "./sandbox-brew.js?v=10";

/** Malt das Symbol; true, wenn Etappe 10 den Gegenstand kennt. st: { d, ld } */
export function paintItem10(id, g, atlas, st) {
  if (!ITEMS[id]) return false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const line = (x0, y0, x1, y1, c, w = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w, c); };
  const arrowAt = (x0, y0, x1, y1, tip, fl) => {          // Pfeil von (x0,y0) = Ende bis (x1,y1) = Spitze
    line(x0, y0, x1, y1, "#8a6a42");
    R(x1 - 1, y1 - 1, 3, 3, tip); P(x1 + 1, y1 - 1, "#ffffff55");
    line(x0, y0, x0 + 2, y0 - 2, fl); line(x0 + 1, y0, x0 + 3, y0 - 2, fl); line(x0, y0 - 1, x0 + 2, y0 - 3, fl);
  };
  switch (id) {
    case "crossbow": {                                   // waagerecht: Schaft nach rechts, Wurfarme vorn nach vorn gebogen
      const ld = st && st.ld, wood = "#7a5230", dark = "#4b2f16", cord = "#ece8dc";
      R(1, 8, 12, 2, wood); R(1, 8, 12, 1, "#9a6a3c"); R(0, 7, 3, 4, "#5a3a18"); R(1, 7, 2, 1, "#7a5230");   // Schaft mit Kolben
      P(5, 10, "#8a8a96"); P(5, 11, "#5c5c68"); R(10, 7, 3, 1, "#8a8a96");                                      // Abzug, Führung
      for (const [x, y] of [[10, 2], [11, 2], [12, 3], [13, 4], [13, 5], [14, 6], [14, 7], [14, 8], [10, 15], [11, 15], [12, 14], [13, 13], [13, 12], [14, 11], [14, 10], [14, 9]]) P(x, y, dark);
      for (const [x, y] of [[11, 3], [12, 4], [13, 6], [13, 12], [12, 13], [11, 14]]) P(x, y, "#6a4424");
      P(15, 8, dark); P(15, 9, dark);
      if (ld) {
        line(10, 2, 7, 8, cord); line(7, 9, 10, 15, cord);
        const sh = (x0, x1, tip, fl) => { R(x0, 7, x1 - x0, 1, "#8a6a42"); R(x0, 6, 2, 1, fl); R(x0 + 1, 8, 1, 0, fl); R(x1 - 1, 6, 2, 3, tip); P(x1 + 1, 7, tip); P(x0 + 1, 6, fl); };
        if (ld.k === "rocket") { R(7, 6, 6, 3, "#e8e0c8"); R(7, 7, 6, 1, "#d83a3a"); R(13, 6, 2, 3, "#d83a3a"); P(15, 7, "#d83a3a"); P(6, 5, "#d83a3a"); P(6, 9, "#d83a3a"); P(5, 7, "#ffb030"); }
        else if (ld.k === "spectral") sh(7, 14, "#ffd83a", "#fff2a0");
        else if (ld.k === "tipped") sh(7, 14, potionColor(ld.d), "#ece8dc");
        else sh(7, 14, "#aeb2bc", "#f0f0f4");
      } else line(10, 2, 10, 15, cord);
      return true;
    }
    case "spectral_arrow": arrowAt(3, 13, 12, 4, "#ffd83a", "#fff2a0"); P(13, 3, "#fff6a8"); P(11, 2, "#fff6a8"); P(14, 5, "#fff6a8"); P(5, 11, "#ffe14a77"); return true;
    case "tipped_arrow": { const c = potionColor(st && st.d != null ? st.d : 0); arrowAt(3, 13, 12, 4, c, "#ece8dc"); R(12, 3, 2, 2, c); P(13, 2, "#ffffff77"); P(10, 5, c); P(5, 11, c); return true; }
    case "lingering_potion": {
      const c = potionColor(st && st.d != null ? st.d : 0);
      R(6, 2, 4, 1, "#a8744a"); R(6, 3, 4, 2, "#c8e4f0"); R(3, 6, 10, 8, "rgba(200,232,250,.7)"); R(4, 5, 8, 1, "rgba(200,232,250,.7)"); R(4, 14, 8, 1, "#8ab0c8");
      R(4, 8, 8, 6, c); R(4, 8, 8, 1, "#ffffff55"); R(4, 6, 1, 7, "#f4fcff");
      R(3, 5, 1, 1, "#7a3aa0"); R(12, 5, 1, 1, "#7a3aa0"); R(2, 9, 1, 3, "#7a3aa088"); R(13, 9, 1, 3, "#7a3aa088"); R(5, 15, 6, 1, "#7a3aa0aa"); P(8, 10, "#ffffff99");
      return true;
    }
    case "dragon_breath": {
      R(6, 2, 4, 2, "#a8744a"); R(6, 4, 4, 2, "#c8e4f0"); R(4, 7, 8, 7, "rgba(200,232,250,.7)"); R(5, 6, 6, 1, "rgba(200,232,250,.7)"); R(4, 13, 8, 1, "#8ab0c8");
      R(4, 8, 8, 5, "#a03ad0"); R(5, 8, 3, 2, "#d86aff"); R(8, 10, 3, 2, "#6a1a98"); P(6, 11, "#e8a0ff"); P(9, 9, "#e8a0ff"); R(5, 8, 1, 4, "#ffffff99");
      return true;
    }
    case "firework_star": {
      const c = COLORS[((st && st.d) | 0) & 15][2];
      R(6, 5, 4, 6, c); R(5, 6, 6, 4, c); R(7, 3, 2, 10, c); R(3, 7, 10, 2, c);
      R(7, 6, 2, 2, "#ffffffcc"); R(6, 5, 1, 1, "#ffffff88"); P(7, 4, "#00000022"); R(5, 10, 6, 1, "#00000033");
      return true;
    }
    case "firework_rocket": {
      const d = st ? st.d | 0 : 1, fl = FIREWORK_FLIGHT(d), star = FIREWORK_STAR(d), band = star ? COLORS[(star - 1) & 15][2] : "#d83a3a";
      line(8, 15, 5, 8, "#8a6a42", 1); line(9, 15, 6, 8, "#6a4a2a");
      R(5, 3, 5, 7, "#e8dcc0"); R(5, 3, 1, 7, "#fff6dc"); R(9, 3, 1, 7, "#c8b890"); R(5, 5, 5, 2, band); R(6, 1, 3, 2, "#d83a3a"); R(7, 0, 1, 1, "#d83a3a"); R(4, 8, 1, 2, "#d83a3a"); R(10, 8, 1, 2, "#d83a3a");
      for (let i = 0; i < fl; i++) P(7, 8 + (i % 3) * 0 + (i > 0 ? i - 1 : 0), "#b0a080");
      if (star) { P(11, 4, band); P(12, 6, band); P(3, 5, band); }
      return true;
    }
    default: return false;
  }
}
