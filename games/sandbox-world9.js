// =====================================================================
// Blockdorf – Weltzusatz (Etappe 9)
//   Läuft nach addContent8() mit eigenem Zufall (seed + 9009).
//   Granit-, Diorit- und Andesit-Blasen im Gestein, farbige Tonbänder (Terrakotta) unter Wüste und Savanne,
//   Knochenblöcke in den Fossilien.
// Gleiche Zahl → gleiche Welt.
// =====================================================================
import { B } from "./sandbox-data.js?v=10";
import { mulberry32, hash2 } from "./sandbox-noise.js?v=10";
import { BIOMES } from "./sandbox-world.js?v=10";
import { W, H, SURF, WK } from "./sandbox-const.js?v=10";

// Farbindizes (COLORS): 0 weiß, 1 orange, 4 gelb, 8 hellgrau, 12 braun, 14 rot
const BAND = [1, 0, 14, 4, 1, 12, 8, 1, 14, 0];

export function addContent9(w, seed) {
  const rnd = mulberry32((seed ^ 0x9a9) + 9009);
  const { tiles, ground, biomes, lvl } = w;
  const aux = w.aux || (w.aux = new Uint8Array(W * H));
  const BI = Object.fromEntries(BIOMES.map((b, i) => [b, i]));
  const BOT = H - 8;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id, a = 0) => { if (x > 0 && x < W - 1 && y > 1 && y < H - 3) { const i = y * W + x; tiles[i] = id; lvl[i] = 0; aux[i] = a; } };

  // ---------- Granit, Diorit, Andesit: Blasen im Stein ----------
  for (const [id, n] of [[B.GRANITE, 26 * WK], [B.DIORITE, 26 * WK], [B.ANDESITE, 26 * WK]]) {
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(rnd() * W), cy = SURF + 6 + Math.floor(rnd() * (BOT - SURF - 30)), rx = 3 + rnd() * 5, ry = 2 + rnd() * 3.2;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 + (hash2(x, y, seed + 91) - 0.5) * 0.5) continue;
        if (y < ground[Math.max(0, Math.min(W - 1, x))] + 3) continue;
        if (at(x, y) === B.STONE) put(x, y, id);
      }
    }
  }

  // ---------- Tonbänder unter Wüste und Savanne ----------
  const phase = Math.floor(rnd() * BAND.length);
  for (let x = 2; x < W - 2; x++) {
    const b = biomes[x];
    if (b !== BI.desert && b !== BI.savanna) continue;
    const g = ground[x], from = g + (b === BI.desert ? 5 : 8), to = from + 9;
    for (let y = from; y < to; y++) {
      const t = at(x, y);
      if (t !== B.STONE && t !== B.SANDSTONE && t !== B.DIRT && t !== B.GRAVEL) continue;
      const k = (y - from + phase) % BAND.length;
      // jede dritte Schicht ist ungefärbtes Terrakotta, dazwischen farbige Bänder
      if ((y - from) % 3 === 2) put(x, y, B.TERRACOTTA); else put(x, y, B.TERRA_C, BAND[k]);
    }
  }

  // ---------- Knochenblöcke in den Fossilien ----------
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === B.FOSSIL && hash2(i % W, (i / W) | 0, seed + 93) < 0.3) { tiles[i] = B.BONE_BLOCK; aux[i] = 0; }
  return w;
}
