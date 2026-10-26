// =====================================================================
// Blockdorf – Spielstand-Umbau auf höhere Welten (Etappe 8)
//   Bis Version 8 war jede Welt 192 Zeilen hoch. Seit Etappe 8 hat die Oberwelt 256 Zeilen; die Oberfläche der Ebenen liegt
//   dadurch bei Zeile 124 statt 60. Alte Welten werden beim Laden um 64 Zeilen nach unten verschoben (oben kommt Luft dazu),
//   die Tiefe unter der Oberfläche bleibt gleich. Nether und Ende behalten ihre Zeilen, unten kommt Grundgestein bzw. Leere dazu.
//   Neue Spielstände tragen das Feld h (Höhe der Welt); fehlt es, war die Welt 192 hoch.
// Reine Funktion: verändert den übergebenen Spielstand nicht.
// =====================================================================
import { W, H, OLD_H } from "./sandbox-const.js?v=10";

const BEDROCK = 15;

/** Ein Block-Raster (Text) auf neue Höhe bringen: shiftTop = Zeilen, die oben dazukommen; fillBottom = Füllblock für Zeilen unten */
function regrid(str, oldH, newH, shiftTop, fillBottom, decodeTiles, encodeTiles) {
  const old = decodeTiles(str, W * oldH);
  const out = new Uint8Array(W * newH);
  out.set(old, shiftTop * W);
  if (fillBottom) out.fill(fillBottom, (shiftTop + oldH) * W);
  return encodeTiles(out);
}
const num = (v, f) => (Number.isFinite(v) ? v + f : v);

/**
 * @param d  Spielstand (Ergebnis von toData, beliebige Version ≤ aktuell)
 * @param fn { encodeTiles, decodeTiles } aus sandbox-engine.js
 * @returns Spielstand in der Höhe H (derselbe Verweis, wenn nichts zu tun ist)
 */
export function migrateData(d, fn) {
  if (!d || typeof d !== "object") return d;
  const oh = Number.isFinite(d.h) ? d.h | 0 : OLD_H;
  if (oh === H) return d;
  if (oh > H || oh < 16) throw new Error("Unbekanntes Welt-Format");
  const dy = H - oh;
  const { encodeTiles, decodeTiles } = fn;
  const o = { ...d, h: H };
  if (typeof d.tiles !== "string") throw new Error("Unbekanntes Welt-Format");
  o.tiles = regrid(d.tiles, oh, H, dy, 0, decodeTiles, encodeTiles);
  for (const k of ["lvl", "aux"]) {
    if (typeof d[k] !== "string") continue;
    try { o[k] = regrid(d[k], oh, H, dy, 0, decodeTiles, encodeTiles); } catch (e) { delete o[k]; }   // beschädigte Zusatzdaten beginnen neu
  }
  if (Array.isArray(d.ground)) o.ground = d.ground.map(g => num(g, dy));
  // Spieler: steht er im Nether / Ende, gilt seine Lage dort (keine Verschiebung)
  if (d.p && typeof d.p === "object") o.p = { ...d.p, y: d.dim ? d.p.y : num(d.p.y, dy) };
  if (d.spawn && typeof d.spawn === "object") o.spawn = { ...d.spawn, y: num(d.spawn.y, dy) };
  if (d.bed && typeof d.bed === "object") o.bed = { ...d.bed, y: num(d.bed.y, dy) };
  if (Array.isArray(d.villages)) o.villages = d.villages.map(v => (v && typeof v === "object" ? { ...v, y: num(v.y, dy) } : v));
  if (Array.isArray(d.ents)) o.ents = d.ents.map(e => (e && typeof e === "object" ? { ...e, y: num(e.y, dy) } : e));
  if (Array.isArray(d.drops)) o.drops = d.drops.map(a => (Array.isArray(a) ? [a[0], a[1], a[2], a[3], num(a[4], dy)] : a));
  if (Array.isArray(d.mobs)) o.mobs = d.mobs.map(m => (m && typeof m === "object" ? { ...m, y: num(m.y, dy) } : m));
  if (Array.isArray(d.villagers)) o.villagers = d.villagers.map(v => (v && typeof v === "object" ? { ...v, y: num(v.y, dy), ws: Array.isArray(v.ws) ? [v.ws[0], num(v.ws[1], dy)] : v.ws } : v));
  if (Array.isArray(d.structs)) o.structs = d.structs.map(s => (s && typeof s === "object" ? { ...s, y: num(s.y, dy) } : s));
  if (Array.isArray(d.strongholds)) o.strongholds = d.strongholds.map(s => (s && typeof s === "object" ? { ...s, y: num(s.y, dy) } : s));
  // Nether (1) und Ende (2): oben bleibt alles stehen, unten kommt Grundgestein bzw. Leere
  if (d.dimData && typeof d.dimData === "object") {
    o.dimData = {};
    for (const n of Object.keys(d.dimData)) {
      const dd = d.dimData[n];
      if (!dd || typeof dd.tiles !== "string") continue;
      try {
        const nd = { ...dd, tiles: regrid(dd.tiles, oh, H, 0, +n === 1 ? BEDROCK : 0, decodeTiles, encodeTiles) };
        for (const k of ["lvl", "aux"]) if (typeof dd[k] === "string") { try { nd[k] = regrid(dd[k], oh, H, 0, 0, decodeTiles, encodeTiles); } catch (e) { delete nd[k]; } }
        o.dimData[n] = nd;
      } catch (e) { /* beschädigte Dimension wird neu erzeugt */ }
    }
  }
  return o;
}
