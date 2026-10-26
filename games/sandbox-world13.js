// =====================================================================
// Blockdorf – Weltzusatz (Etappe 13: Dörfer, Handel und Illager 2.0)
//   Läuft nach addContent12() mit eigenem Zufall (seed + 13013); Gelände und ältere Bauwerke bleiben gleich.
//   Dörfer sehen je Biom anders aus (Wüste: Sandstein, Savanne: Akazie, Taiga: Fichte, Schnee: Fichte mit Schneedach) und haben
//   eine Glocke. Die vier Arbeitsblöcke im Freien (aus Etappe 6) wechseln in fremden Dörfern zu Blöcken der Dorfart – so haben Savanne,
//   Wüste, Taiga und Schnee ihre eigenen Berufe. Das Startdorf bleibt, wie es war.
// Gleiche Zahl → gleiche Welt.
// =====================================================================
import { B } from "./sandbox-data.js?v=10";
import { mulberry32 } from "./sandbox-noise.js?v=10";
import { W, H, SPAWN_X } from "./sandbox-const.js?v=10";

/** Holzart (Zusatzfeld der bunten Bretter) je Dorfart: 2 = Fichte, 4 = Akazie */
const WOOD = { acacia: 4, spruce: 2, snow: 2 };
/** Arbeitsblöcke, die in den Häusern der jeweiligen Dorfart stehen können */
const WORK = {
  oak: [B.COMPOSTER, B.LECTERN, B.CARTO, B.BARREL, B.FLETCHING, B.ANVIL],
  sand: [B.CARTO, B.STONECUTTER, B.SMOKER, B.COMPOSTER, B.BREWING, B.LECTERN],
  acacia: [B.LOOM, B.SMOKER, B.CAULDRON, B.COMPOSTER, B.GRINDSTONE, B.CARTO],
  spruce: [B.FLETCHING, B.BARREL, B.SMITHING, B.LECTERN, B.BLAST, B.LOOM],
  snow: [B.CAULDRON, B.GRINDSTONE, B.BREWING, B.BARREL, B.BLAST, B.SMITHING]
};

export function addContent13(w, seed) {
  const rnd = mulberry32((seed ^ 0xb0b13) + 13013);
  const { tiles, lvl, villages } = w;
  const aux = w.aux || (w.aux = new Uint8Array(W * H));
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id, a = 0) => { if (x > 0 && x < W - 1 && y > 1 && y < H - 3) { const i = y * W + x; tiles[i] = id; lvl[i] = 0; aux[i] = a; } };
  for (const v of villages || []) {
    const cx = v.x, S = v.y, main = cx === SPAWN_X, style = v.style;
    // ---------- Aussehen ----------
    const wood = WOOD[style];
    if (wood) {
      for (let x = cx - 24; x <= cx + 24; x++) for (let y = S - 8; y <= S; y++) if (at(x, y) === B.PLANKS) put(x, y, B.WPLANKS, wood);
      if (style === "snow") {                                    // Schneedach: auf jedes Dach eine Lage Schnee
        for (const x0 of [cx - 20, cx - 3, cx + 13]) for (let x = x0 - 1; x <= x0 + 7; x++) if (at(x, S - 7) === B.AIR && at(x, S - 6) === B.WPLANKS) put(x, S - 7, B.SNOW);
      }
    }
    // ---------- Glocke ----------
    for (const dx of [6, -6, 7, -7, 5, -5, 8, -8]) {
      const bx = cx + dx;
      if (at(bx, S - 1) === B.AIR && at(bx, S) !== B.AIR && at(bx, S - 2) === B.AIR && at(bx - 1, S - 1) !== B.BELL) { put(bx, S - 1, B.BELL); break; }
    }
    // ---------- Arbeitsblöcke ----------
    // Etappe 6 stellte vier Blöcke (Komposter, Lesepult, Kartentisch, Amboss) ins Freie; in fremden Dörfern wechseln sie zur Dorfart
    if (main) continue;
    const pool = [...(WORK[style] || WORK.oak)], placed = [];
    const OLD = new Set([B.COMPOSTER, B.LECTERN, B.CARTO, B.ANVIL]);
    for (let x = cx - 24; x <= cx + 24; x++) for (let y = S - 6; y <= S + 4; y++) {
      if (!OLD.has(at(x, y)) || !pool.length) continue;
      const k = Math.floor(rnd() * pool.length), id = pool.splice(k, 1)[0];
      put(x, y, id); placed.push(x);
    }
    // Schneedörfer bekamen in Etappe 6 keine (der Boden war Schnee): hier fehlende Blöcke nachsetzen
    for (let tries = 0; tries < 120 && placed.length < 4 && pool.length; tries++) {
      const x = cx + Math.floor(rnd() * 45) - 22, g = w.ground[x];
      if (!g || Math.abs(g - S) > 3 || placed.some(q => Math.abs(q - x) < 4) || Math.abs(x - cx) < 7) continue;
      const top = at(x, g);
      let open = top === B.GRASS || top === B.GRASS_SNOW || top === B.DIRT || top === B.SAND;
      for (let dx = -1; dx <= 1 && open; dx++) for (let dy = 1; dy <= 4; dy++) if (at(x + dx, g - dy) !== B.AIR) { open = false; break; }
      if (!open) continue;
      const k = Math.floor(rnd() * pool.length), id = pool.splice(k, 1)[0];
      put(x, g - 1, id); placed.push(x);
    }
  }
  return w;
}
