// =====================================================================
// Blockdorf – Weltzusatz (Etappe 12: Tiere)
//   Läuft nach addContent11() mit eigenem Zufall (seed + 12012); Gelände und ältere Bauwerke bleiben gleich.
//   Bienennester an Baumstämmen (bei Blumen), Süßbeerensträucher im Nadelwald, Schnüffler-Eier in den Truhen der Unterwasserruinen.
// Gleiche Zahl → gleiche Welt.
// =====================================================================
import { B, isLog, hiveAux } from "./sandbox-data.js?v=10";
import { mulberry32 } from "./sandbox-noise.js?v=10";
import { BIOMES } from "./sandbox-world.js?v=10";
import { W, H, SPAWN_X } from "./sandbox-const.js?v=10";

export function addContent12(w, seed) {
  const rnd = mulberry32((seed ^ 0xb0b12) + 12012);
  const { tiles, ground, biomes, lvl, chests, structs } = w;
  const aux = w.aux || (w.aux = new Uint8Array(W * H));
  const BI = Object.fromEntries(BIOMES.map((b, i) => [b, i]));
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id, a = 0) => { if (x > 0 && x < W - 1 && y > 1 && y < H - 3) { const i = y * W + x; tiles[i] = id; lvl[i] = 0; aux[i] = a; } };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const NEST = new Set(["plains", "forest", "birch", "meadow", "cherry", "dappled"].map(n => BI[n]).filter(v => v !== undefined));
  const BUSH = new Set(["taiga", "grove"].map(n => BI[n]).filter(v => v !== undefined));
  const bushSnow = BI.snow;

  // ---------- Bienennester ----------
  // Kandidaten: Stammblöcke 2–6 über dem Boden mit freier Luft daneben (in Wald-, Wiesen- und Kirschbiomen)
  const cand = [];
  for (let x = 6; x < W - 6; x++) {
    if (!NEST.has(biomes[x]) || Math.abs(x - SPAWN_X) < 6) continue;
    const g = ground[x];
    for (let h = 2; h <= 6; h++) {
      const y = g - 1 - h;
      if (!isLog(at(x, y))) continue;
      for (const s of [-1, 1]) if (at(x + s, y) === B.AIR) { cand.push({ x: x + s, y }); break; }
      break;
    }
  }
  let flowersNear = x => { let n = 0; for (let d = -10; d <= 10; d++) { const xx = Math.max(0, Math.min(W - 1, x + d)); if (at(xx, ground[xx] - 1) === B.FLOWER) n++; } return n; };
  const nests = [];
  const okSpace = x => nests.every(n => Math.abs(n - x) >= 18);
  const putNest = c => { put(c.x, c.y, B.BEE_NEST, hiveAux(ri(0, 2), ri(1, 3), 0)); nests.push(c.x); };
  for (const c of cand) if (okSpace(c.x) && rnd() < (flowersNear(c.x) >= 2 ? 0.3 : 0.08)) putNest(c);
  for (const c of cand) { if (nests.length >= 2) break; if (okSpace(c.x)) putNest(c); }      // in jeder Welt mindestens zwei

  // ---------- Süßbeerensträucher ----------
  for (let x = 8; x < W - 8; x++) {
    const bi = biomes[x];
    if (!(BUSH.has(bi) || bi === bushSnow) || rnd() > (bi === bushSnow ? 0.03 : 0.07)) continue;
    const g = ground[x], t = at(x, g);
    if ((t === B.GRASS || t === B.GRASS_SNOW) && at(x, g - 1) === B.AIR) put(x, g - 1, rnd() < 0.7 ? B.BERRY_BUSH : B.BERRY_BUSH0);
  }

  // ---------- Schnüffler-Eier in den Unterwasserruinen ----------
  const ruins = (structs || []).filter(s => s.kind === "ruin");
  let given = 0;
  const give = s => {
    const c = chests.find(k => k.x === s.x && k.y === s.y - 1);
    if (!c) return false;
    c.items.unshift({ id: "sniffer_egg", n: 1, d: 0 }); c.items.length = Math.min(9, c.items.length);
    return true;
  };
  for (const s of ruins) if (biomes[s.x] === BI.warm_ocean && rnd() < 0.7 && give(s)) given++;
  if (!given) for (const s of ruins) if (give(s)) { given++; break; }
  return w;
}
