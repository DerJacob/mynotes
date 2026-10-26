// =====================================================================
// Blockdorf – Plünderer malen (Etappe 6): Plünderer (Armbrust), Diener (Axt), Anführer (mit Banner-Kopfschmuck).
// =====================================================================
export const MOB_COLORS6 = { pillager: [120, 130, 140], vindicator: [110, 120, 130], illager_captain: [150, 100, 70] };

/** R(x, y, w, h, farbe) zeichnet im Körperraster. true = gemalt. */
export function drawMob6(R, m, bw, bh, sw, g, S, now) {
  switch (m.type) {
    case "pillager": case "vindicator": case "illager_captain": {
      const cap = m.type === "illager_captain", vin = m.type === "vindicator";
      const coat = vin ? "#3c5a4a" : cap ? "#6a3a30" : "#4a5058", coat2 = vin ? "#2c4438" : cap ? "#4e2a22" : "#363a40";
      R(3.4 + sw * 0.5, 19, 2.6, 9.8, "#3a3030"); R(6.2 - sw * 0.5, 19, 2.6, 9.8, "#2e2626"); R(3 + sw * 0.5, 27.6, 3.2, 1.2, "#1c1616"); R(5.8 - sw * 0.5, 27.6, 3.2, 1.2, "#161212");
      R(2, 9, 7.6, 11, coat); R(2, 9, 7.6, 1.2, vin ? "#4c7058" : cap ? "#8a4c3e" : "#5c646c"); R(2, 18, 7.6, 2.4, coat2); R(5.2, 9.6, 1.2, 10, coat2);
      const aim = m.type === "pillager" && m.shootCd < 0.8;
      R(1.2, 11, 8.6, 2.6, "#b49a82"); R(1.2, 13.2, 8.6, 1.6, "#9c846e");
      if (m.type === "pillager") {
        R(6, aim ? 8.6 : 11.4, 7.6, 2, "#5a3e24"); R(11.4, aim ? 7.8 : 10.6, 2.2, 3.6, "#2c2c32"); R(7, aim ? 8 : 10.8, 4, 0.8, "#8a8a92");
        if (aim) R(13.6, 9, 2.4, 0.8, "#d8d8d0");
      } else {
        const swing = m.atkCd > 0.55 ? -3 : 0;
        R(9.4, 9.4 + swing, 1.6, 8, "#6a4a2a"); R(8.4, 8.2 + swing, 3.6, 3, "#a8aab4"); R(8.4, 8.2 + swing, 3.6, 0.8, "#d8dae4");
      }
      R(2.4, 1, 7, 8, "#a89684"); R(2.4, 1, 7, 1.2, "#bcaa98"); R(2.4, 6.8, 7, 2, "#8c7a68");
      R(1.8, 2.6, 1.2, 2.2, "#90806e"); R(9, 2.6, 1.2, 2.2, "#90806e");
      R(4, 3.8, 3.8, 0.9, "#2a2218"); R(3.6, 3.6, 1.8, 1.8, "#e8e4d8"); R(6.2, 3.6, 1.8, 1.8, "#e8e4d8"); R(4.2, 4.2, 0.9, 0.9, "#1a4a2a"); R(6.8, 4.2, 0.9, 0.9, "#1a4a2a");
      R(5.2, 5.2, 1.6, 2.6, "#8c7664"); R(3.8, 7.4, 4.4, 0.8, "#40302a");
      if (cap) { R(2, -0.6, 8, 2, "#2a2a30"); R(4.4, -3.2, 3.2, 2.8, "#e8e8e0"); R(4.4, -3.2, 3.2, 0.8, "#2a6ac8"); R(4.8, -1.6, 2.4, 0.9, "#1a4a98"); }
      else if (vin) { R(2.2, 0.4, 7.6, 1.8, "#2c2c34"); R(2.2, 0.4, 7.6, 0.6, "#4a4a56"); }
      else { R(2.2, 0.2, 7.6, 2.2, "#3a2c20"); R(2.2, 0.2, 7.6, 0.7, "#5a4430"); }
      return true;
    }
    default: return false;
  }
}
