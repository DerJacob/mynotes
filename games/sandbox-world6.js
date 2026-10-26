// =====================================================================
// Blockdorf – Weltzusatz (Etappe 6)
//   Läuft nach generateWorld() mit eigenem Zufall (seed + 6006), damit Gelände, Höhlen und Dörfer der älteren Etappen gleich bleiben.
//   Dappled Forest: Pappeln mit roten / orangen / gelben Blättern, Laubstreu, rote Büsche, Schirmpilze
//   Abandoned Camps: Zelte aus Wolle, Lagerfeuer, Truhen und Fässer
//   Waldanwesen (drei Stockwerke), Ozeanmonument, Plünderer-Außenposten
//   Arbeitsblöcke in den Dörfern (Komposter, Lesepult, Kartentisch, Amboss)
// Alles in der Seitenansicht: Bauwerke sind Querschnitte, in denen man herumlaufen kann.
// =====================================================================
import { B } from "./sandbox-data.js?v=6";
import { mulberry32 } from "./sandbox-noise.js?v=6";
import { BIOMES } from "./sandbox-world.js?v=6";

const W = 512, H = 192, SURF = 60, SPAWN_X = W >> 1, SEA = SURF + 4;
export const DAPPLED = "dappled";
const BI_OCEAN = BIOMES.indexOf("ocean"), BI_MOUNT = BIOMES.indexOf("mountains"), BI_DESERT = BIOMES.indexOf("desert");
const TENT_COLORS = [1, 4, 14, 11, 12, 5, 0, 13];                                // Orange, Gelb, Rot, Blau, Braun, Hellgrün, Weiß, Grün

export function addContent6(w, seed) {
  const rnd = mulberry32((seed ^ 0x6006) + 6006);
  const { tiles, ground, biomes, chests } = w;
  const BI_DAP = BIOMES.indexOf(DAPPLED);
  const aux = w.aux = new Uint8Array(W * H);
  const structs = w.structs = [];
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id, a = 0) => { if (x >= 0 && x < W && y > 0 && y < H) { tiles[y * W + x] = id; aux[y * W + x] = a; w.lvl[y * W + x] = 0; } };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const isWood = id => id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.JUNGLE_LOG || id === B.ACACIA_LOG || id === B.POPLAR_LOG;
  const isLeaf = id => id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.JUNGLE_LEAVES || id === B.ACACIA_LEAVES || (id >= B.PLEAVES_R && id <= B.PLEAVES_Y);
  const taken = [];                                                              // belegte Streifen [x0, x1]
  for (const v of w.villages) taken.push([v.x - 24, v.x + 24]);
  taken.push([SPAWN_X - 40, SPAWN_X + 40]);
  const free = (x0, x1, gap = 6) => !taken.some(t => x0 - gap < t[1] && x1 + gap > t[0]);
  const drySurface = x => { const g = ground[x]; return !!g && at(x, g - 1) !== B.WATER && at(x, g) !== B.WATER && at(x, g) !== B.ICE && biomes[x] !== BI_OCEAN; };

  /** Loot einer Truhe */
  const stock = (x, y, table) => {
    const items = [];
    for (const [id, a, b, p] of table) if (rnd() < p) items.push({ id, n: ri(a, b), d: 0 });
    if (!items.length) items.push({ id: "bread", n: 2, d: 0 });
    chests.push({ x, y, items: items.slice(0, 9) });
  };
  const LOOT = {
    camp: [["bread", 1, 3, 0.7], ["wheat", 2, 5, 0.5], ["stick", 3, 8, 0.7], ["torch", 3, 8, 0.6], ["coal", 2, 5, 0.6], ["raw_beef", 1, 3, 0.4], ["leather", 1, 3, 0.35], ["string", 1, 4, 0.35], ["arrow", 3, 8, 0.3], ["iron_ingot", 1, 2, 0.25], ["apple", 1, 2, 0.4], ["book", 1, 1, 0.15]],
    outpost: [["arrow", 4, 10, 0.8], ["iron_ingot", 1, 3, 0.6], ["bread", 2, 4, 0.6], ["wheat", 3, 6, 0.5], ["coal", 3, 7, 0.5], ["gold_ingot", 1, 2, 0.3], ["book", 1, 2, 0.3], ["enchanted_book", 1, 1, 0.2], ["redstone", 2, 5, 0.3]],
    mansion: [["diamond", 1, 3, 0.55], ["iron_ingot", 2, 6, 0.85], ["gold_ingot", 2, 5, 0.65], ["emerald", 1, 3, 0.45], ["enchanted_book", 1, 1, 0.55], ["bread", 3, 6, 0.7], ["book", 1, 3, 0.5], ["redstone", 3, 8, 0.5], ["lapis", 3, 7, 0.4], ["bone", 2, 5, 0.4], ["string", 2, 5, 0.4]]
  };

  /** Streifen einebnen: Oberfläche auf Höhe base, alles darüber frei */
  const flatten = (x0, wd, base, top = 26) => {
    for (let x = x0; x < x0 + wd; x++) {
      const g = ground[x], topT = at(x, g) === B.WATER ? B.SAND : at(x, g) || B.GRASS;
      for (let y = Math.max(1, base - top); y < base; y++) put(x, y, B.AIR);
      if (g > base) for (let y = base; y < g; y++) put(x, y, y === base ? topT : B.DIRT);
      else if (g < base) { /* tiefer gelegt: darunter ist schon Erde */ }
      put(x, base, topT === B.GRASS || topT === B.SAND || topT === B.SNOW ? topT : B.GRASS);
      ground[x] = base;
    }
  };
  /** Platz für ein Bauwerk finden: ebenes Land, nicht im Wasser, nicht auf Dörfern */
  const findSite = (wd, minDist = 0, maxSlope = 4) => {
    for (let k = 0; k < 400; k++) {
      const x0 = ri(6, W - wd - 6), cx = x0 + (wd >> 1);
      if (Math.abs(cx - SPAWN_X) < minDist || !free(x0, x0 + wd)) continue;
      let lo = 999, hi = -1, ok = true;
      for (let x = x0; x < x0 + wd; x++) { if (!drySurface(x) || biomes[x] === BI_MOUNT) { ok = false; break; } lo = Math.min(lo, ground[x]); hi = Math.max(hi, ground[x]); }
      if (!ok || hi - lo > maxSlope) continue;
      const sorted = []; for (let x = x0; x < x0 + wd; x++) sorted.push(ground[x]); sorted.sort((a, b) => a - b);
      taken.push([x0, x0 + wd]);
      return { x0, wd, base: sorted[sorted.length >> 1] };
    }
    return null;
  };

  // ---------- Dappled Forest ----------
  if (BI_DAP >= 0) {
    const zones = [];
    for (let k = 0; k < 1500 && zones.length < 2; k++) {
      const need = k < 500 ? 0.7 : k < 1000 ? 0.5 : 0.35;
      const wd = ri(48, 80), x0 = ri(4, W - wd - 4);
      if (!free(x0, x0 + wd, 4) || zones.some(z => x0 < z[1] + 24 && x0 + wd > z[0] - 24)) continue;
      let good = 0;
      for (let x = x0; x < x0 + wd; x++) if (biomes[x] !== BI_OCEAN && biomes[x] !== BI_MOUNT && biomes[x] !== BI_DESERT && ground[x] && at(x, ground[x]) === B.GRASS && at(x, ground[x] - 1) !== B.WATER) good++;
      if (good < wd * need) continue;
      zones.push([x0, x0 + wd]);
    }
    w.dappled = zones;
    for (const [z0, z1] of zones) {
      for (let x = z0; x < z1; x++) {
        const g = ground[x];
        if (at(x, g) !== B.GRASS) continue;
        biomes[x] = BI_DAP;
        for (let y = Math.max(2, g - 22); y < g; y++) { const t = at(x, y); if (isWood(t) || isLeaf(t)) tiles[y * W + x] = B.AIR; }
      }
      // Pappeln
      const trunks = new Set();
      for (let x = z0 + 2; x < z1 - 2; x += ri(3, 6)) {
        const g = ground[x];
        if (at(x, g) !== B.GRASS || at(x, g - 1) !== B.AIR && at(x, g - 1) !== B.FLOWER && at(x, g - 1) !== B.TALLGRASS) continue;
        const h = ri(8, 11), pal = [B.PLEAVES_R, B.PLEAVES_O, B.PLEAVES_Y], main = pick(pal);
        for (let y = 1; y <= h; y++) put(x, g - y, B.POPLAR_LOG);
        const HW = [0, 1, 1, 2, 2, 1, 1];
        for (let r = 0; r < HW.length; r++) for (let dx = -HW[r]; dx <= HW[r]; dx++) {
          const yy = g - h - 2 + r, xx = x + dx;
          if (Math.abs(dx) === HW[r] && HW[r] > 1 && rnd() < 0.3) continue;
          if (at(xx, yy) === B.AIR || isLeaf(at(xx, yy)) || at(xx, yy) === B.FLOWER || at(xx, yy) === B.TALLGRASS) put(xx, yy, rnd() < 0.18 ? pick(pal) : main);
        }
        trunks.add(x);
      }
      // Bodenschmuck
      for (let x = z0; x < z1; x++) {
        const g = ground[x];
        if (trunks.has(x) || at(x, g) !== B.GRASS) continue;
        const above = at(x, g - 1);
        if (above !== B.AIR && above !== B.FLOWER && above !== B.TALLGRASS) continue;
        const r = rnd();
        if (r < 0.3) put(x, g - 1, B.LITTER_R + Math.floor(rnd() * 3));
        else if (r < 0.36) put(x, g - 1, B.RED_BUSH);
        else if (r < 0.41) put(x, g - 1, B.PARASOL);
      }
    }
  }

  // ---------- Waldanwesen ----------
  {
    const s = findSite(33, 90, 9) || findSite(33, 60, 12) || findSite(33, 40, 16);
    if (s) {
      flatten(s.x0, s.wd, s.base, 30);
      const gy = s.base - 1, x0 = s.x0;
      const rows = [[1, 4], [6, 9], [11, 14]];                                   // Innenräume jeder Etage: Höhe über dem Boden von … bis …
      for (let y = 1; y <= 14; y++) { put(x0, gy - y + 1, B.COBBLE); put(x0 + 32, gy - y + 1, B.COBBLE); }
      for (const fl of [5, 10, 15]) for (let c = 0; c <= 32; c++) put(x0 + c, gy - fl + 1, B.PLANKS);
      for (let c = 0; c <= 32; c++) put(x0 + c, gy - 15 + 1, B.PLANKS);
      for (const [a, b] of rows) for (let y = a; y <= b; y++) for (const part of [11, 22]) if (y > a + 1) put(x0 + part, gy - y + 1, B.PLANKS);
      for (const ladderC of [5, 27]) for (let y = 1; y <= 14; y++) put(x0 + ladderC, gy - y + 1, B.LADDER);
      // Türen unten, Fenster oben
      for (let y = 1; y <= 2; y++) { put(x0, gy - y + 1, B.AIR); put(x0 + 32, gy - y + 1, B.AIR); }
      for (const [a] of rows.slice(1)) { put(x0, gy - (a + 1) + 1, B.GLASS); put(x0 + 32, gy - (a + 1) + 1, B.GLASS); }
      // Pfeiler und Giebel
      for (let y = 1; y <= 14; y++) for (const c of [1, 31]) if (y > 2) put(x0 + c, gy - y + 1, B.SPRUCE_LOG);
      const roof = [[3, 29], [8, 24], [13, 19]];
      roof.forEach(([a, b], i) => { for (let c = a; c <= b; c++) put(x0 + c, gy - 16 - i + 1, B.COBBLE); });
      // Truhen, Fackeln
      const spots = [[8, 1], [25, 1], [14, 6], [18, 11]];
      for (const [c, y] of spots) { put(x0 + c, gy - y + 1, B.CHEST); stock(x0 + c, gy - y + 1, LOOT.mansion); }
      for (const [a] of rows) for (const c of [3, 16, 29]) put(x0 + c, gy - a + 1, B.TORCH);
      structs.push({ kind: "mansion", x: x0 + 16, y: s.base, w: 33, h: 18 });
    }
  }

  // ---------- Zelte und Lager ----------
  const tent = (x0, gy, mirror, colA, colB, loot) => {
    const X = c => x0 + (mirror ? 6 - c : c);
    const wool = (c, y) => put(X(c), y, B.WOOL, c % 2 ? colA : colB);
    for (let c = 0; c <= 6; c++) wool(c, gy - 3);
    for (let c = 1; c <= 5; c++) wool(c, gy - 4);
    for (let c = 2; c <= 4; c++) wool(c, gy - 5);
    wool(3, gy - 6);
    wool(6, gy - 1); wool(6, gy - 2);
    if (loot === "chest") { put(X(4), gy - 1, B.CHEST); stock(X(4), gy - 1, LOOT.camp); }
    else { put(X(4), gy - 1, B.BARREL); stock(X(4), gy - 1, LOOT.camp); }
    put(X(2), gy - 1, B.TORCH);
  };
  const campCount = 2 + (rnd() < 0.5 ? 1 : 0);
  for (let k = 0; k < campCount; k++) {
    const s = findSite(22, 45, 6) || findSite(22, 30, 10); if (!s) continue;
    flatten(s.x0, s.wd, s.base);
    const colA = pick(TENT_COLORS), colB = pick(TENT_COLORS);
    tent(s.x0 + 1, s.base - 1, false, colA, colB, "chest");
    put(s.x0 + 10, s.base - 1, B.CAMPFIRE);
    put(s.x0 + 12, s.base - 1, B.HAY);
    if (rnd() < 0.7) { put(s.x0 + 13, s.base - 1, B.BARREL); stock(s.x0 + 13, s.base - 1, LOOT.camp); }
    tent(s.x0 + 14, s.base - 1, true, colB, colA, "barrel");
    structs.push({ kind: "camp", x: s.x0 + 11, y: s.base });
  }

  // ---------- Plünderer-Außenposten ----------
  const outCount = 1 + (rnd() < 0.6 ? 1 : 0);
  for (let k = 0; k < outCount; k++) {
    const s = findSite(9, 80, 5) || findSite(9, 45, 9); if (!s) continue;
    flatten(s.x0, s.wd, s.base, 20);
    const gy = s.base - 1, x0 = s.x0 + 1;                                         // Turm: x0 .. x0+6 (Wände bei 1 und 5)
    for (let y = 1; y <= 10; y++) { put(x0 + 1, gy - y + 1, B.PLANKS); put(x0 + 5, gy - y + 1, B.PLANKS); }
    for (let y = 1; y <= 2; y++) put(x0 + 1, gy - y + 1, B.AIR);                  // Tür links
    put(x0 + 5, gy - 8, B.AIR); put(x0 + 5, gy - 9, B.AIR);                       // Ausguck rechts
    for (const fy of [4, 8]) for (let c = 1; c <= 5; c++) put(x0 + c, gy - fy + 1, c === 2 ? B.AIR : B.PLANKS);
    for (let y = 1; y <= 8; y++) put(x0 + 2, gy - y + 1, B.LADDER);
    for (let c = 0; c <= 6; c++) put(x0 + c, gy - 10, B.PLANKS);
    put(x0 + 4, gy - 7, B.CHEST); stock(x0 + 4, gy - 7, LOOT.outpost);
    put(x0 + 4, gy - 1, B.TORCH); put(x0 + 4, gy - 4, B.TORCH);
    put(x0 + 3, gy - 3, B.BARREL); stock(x0 + 3, gy - 3, LOOT.outpost);
    structs.push({ kind: "outpost", x: x0 + 3, y: s.base });
  }

  // ---------- Ozeanmonument ----------
  {
    const WD = 29;
    let best = null;
    for (let x = 4; x < W - WD - 4; x++) {
      let ok = true;
      for (let c = 0; c < WD && ok; c++) if (biomes[x + c] !== BI_OCEAN || ground[x + c] < SEA + 5) ok = false;
      if (ok) { best = x; break; }
    }
    if (best !== null) {
      const x0 = best + 0;
      let base = 999, deep = 0;
      for (let c = 0; c < WD; c++) { base = Math.min(base, ground[x0 + c]); deep = Math.max(deep, ground[x0 + c]); }
      for (let c = 0; c < WD; c++) for (let y = base; y < ground[x0 + c]; y++) put(x0 + c, y, B.SAND);
      for (let c = 0; c < WD; c++) ground[x0 + c] = base;
      const gy = base - 1, P = B.PRISMARINE;
      for (let c = 0; c < WD; c++) put(x0 + c, base, P);                           // Sockel
      for (let y = 4; y <= 10; y++) { put(x0, gy - y + 1, P); put(x0 + 28, gy - y + 1, P); }    // unten bleiben die Eingänge offen
      for (let c = 0; c < WD; c++) put(x0 + c, gy - 10, P);                         // Dach
      for (let c = 4; c < WD - 4; c += 4) put(x0 + c, gy - 9, B.SEA_LANTERN);
      for (const part of [9, 19]) for (let y = 4; y <= 9; y++) put(x0 + part, gy - y + 1, P);
      for (let c = 11; c <= 17; c++) { put(x0 + c, gy - 5, P); }
      for (let y = 1; y <= 5; y++) { put(x0 + 11, gy - y + 1, P); put(x0 + 17, gy - y + 1, P); }
      for (let c = 12; c <= 16; c++) put(x0 + c, gy, B.GOLD_BLOCK);
      for (let c = 13; c <= 15; c++) put(x0 + c, gy - 1, B.GOLD_BLOCK);
      for (const c of [3, 25]) { for (let y = 1; y <= 6; y++) put(x0 + c, gy - y + 1, P); put(x0 + c, gy - 6, B.SEA_LANTERN); }
      // Wasser im Innenraum (die Welt füllt sich bis zum Meeresspiegel)
      for (let y = SEA; y < base; y++) for (let c = 1; c < WD - 1; c++) if (tiles[y * W + x0 + c] === B.AIR) { tiles[y * W + x0 + c] = B.WATER; w.lvl[y * W + x0 + c] = 8; }
      structs.push({ kind: "monument", x: x0 + 14, y: base });
    }
  }

  // ---------- Arbeitsblöcke in den Dörfern ----------
  const WORK = [B.COMPOSTER, B.LECTERN, B.CARTO, B.ANVIL];
  w.villages.forEach(v => {
    const placed = [];
    for (let tries = 0; tries < 80 && placed.length < WORK.length; tries++) {
      const x = v.x + ri(-22, 22), g = ground[x];
      if (!g || Math.abs(g - v.y) > 3 || (v.x === SPAWN_X && Math.abs(x - SPAWN_X + 6.4) < 3)) continue;
      if (placed.some(p => Math.abs(p - x) < 4)) continue;
      let open = at(x, g) === B.GRASS || at(x, g) === B.DIRT || at(x, g) === B.SAND;
      for (let dx = -1; dx <= 1 && open; dx++) for (let dy = 1; dy <= 4; dy++) if (at(x + dx, g - dy) !== B.AIR) { open = false; break; }
      if (!open) continue;
      put(x, g - 1, WORK[placed.length]); placed.push(x);
    }
  });
  w.structs = structs;
  return w;
}
