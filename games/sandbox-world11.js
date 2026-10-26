// =====================================================================
// Blockdorf – Weltzusatz (Etappe 11: Ozean)
//   Läuft nach addContent9() mit eigenem Zufall (seed + 11011); Gelände und ältere Bauwerke bleiben gleich.
//   Tangwälder und Seegras im Meer, Korallenriffe im warmen Ozean (Korallenblöcke, Korallen, Fächer, Seegurken),
//   Schiffswracks (mit Karte zum Schatz), Unterwasserruinen, vergrabene Schätze mit Herz des Meeres,
//   Monument: Nasse Schwämme und dunkler Prismarin.
// Gleiche Zahl → gleiche Welt.
// =====================================================================
import { B, WP } from "./sandbox-data.js?v=10";
import { mulberry32, fbm } from "./sandbox-noise.js?v=10";
import { BIOMES } from "./sandbox-world.js?v=10";
import { W, H, SPAWN_X, SEA } from "./sandbox-const.js?v=10";

const SRC = 9;
const LOOT = {
  supply: [["bread", 1, 4, 0.7], ["carrot", 2, 6, 0.5], ["potato", 2, 6, 0.5], ["wheat", 2, 6, 0.5], ["coal", 2, 6, 0.5], ["paper", 1, 4, 0.4], ["rotten_flesh", 2, 5, 0.4], ["iron_ingot", 1, 3, 0.45], ["gold_ingot", 1, 2, 0.2]],
  treasure: [["iron_ingot", 1, 5, 0.8], ["gold_ingot", 1, 4, 0.6], ["emerald", 1, 3, 0.5], ["diamond", 1, 2, 0.25], ["enchanted_book", 1, 1, 0.35], ["lapis", 3, 8, 0.3], ["bone", 1, 3, 0.3]],
  ruin: [["coal", 1, 3, 0.5], ["gold_ingot", 1, 2, 0.3], ["wheat", 1, 3, 0.5], ["stick", 1, 3, 0.4], ["iron_ingot", 1, 2, 0.3], ["book", 1, 1, 0.2], ["emerald", 1, 1, 0.2], ["raw_cod", 1, 3, 0.3]],
  buried: [["iron_ingot", 1, 4, 0.8], ["gold_ingot", 1, 4, 0.7], ["diamond", 1, 2, 0.4], ["emerald", 1, 3, 0.5], ["prismarine_crystals", 1, 5, 0.6], ["cooked_cod", 2, 4, 0.6], ["cooked_salmon", 2, 4, 0.5]]
};

export function addContent11(w, seed) {
  const rnd = mulberry32((seed ^ 0xb0b11) + 11011);
  const { tiles, ground, biomes, lvl, chests } = w;
  const aux = w.aux || (w.aux = new Uint8Array(W * H));
  const structs = w.structs || (w.structs = []);
  const BI = Object.fromEntries(BIOMES.map((b, i) => [b, i]));
  const isOcean = x => biomes[x] === BI.ocean || biomes[x] === BI.warm_ocean;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id, a = 0) => { if (x > 0 && x < W - 1 && y > 1 && y < H - 3) { const i = y * W + x; tiles[i] = id; lvl[i] = 0; aux[i] = a; } };
  /** Wasserzelle mit Pflanze (feste Quelle, damit fließendes Wasser sie nicht löscht) */
  const plant = (x, y, a) => { if (at(x, y) !== B.WATER) return false; const i = y * W + x; lvl[i] = SRC; aux[i] = a; return true; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const stock = (x, y, table, first = []) => {
    const items = [...first];
    for (const [id, a, b, p] of table) if (rnd() < p) items.push({ id, n: ri(a, b), d: 0 });
    if (items.length === first.length) items.push({ id: "bread", n: 2, d: 0 });
    chests.push({ x, y, items: items.slice(0, 9) });
  };
  const floorOk = id => id === B.SAND || id === B.GRAVEL || id === B.CLAY;
  const taken = [];
  for (const v of w.villages || []) taken.push([v.x - 26, v.x + 26]);
  taken.push([SPAWN_X - 44, SPAWN_X + 44]);
  for (const s of structs) if (s.kind === "monument" || s.kind === "mansion" || s.kind === "outpost" || s.kind === "camp") taken.push([s.x - 22, s.x + 22]);
  const tight = [[SPAWN_X - 30, SPAWN_X + 30]];                                                         // nur der tatsächlich bebaute Boden (für kleine Verstecke)
  for (const v of w.villages || []) tight.push([v.x - 26, v.x + 26]);
  for (const s of structs) { const r = s.kind === "monument" ? 16 : s.kind === "mansion" ? 18 : s.kind === "outpost" ? 8 : s.kind === "camp" ? 10 : 0; if (r) tight.push([s.x - r, s.x + r]); }
  const freeTight = (x, gap = 3) => !tight.some(t => x + gap > t[0] && x - gap < t[1]);
  const free = (x0, x1, gap = 4) => !taken.some(t => x0 - gap < t[1] && x1 + gap > t[0]);
  const allOcean = (x0, wd, minDepth) => { for (let c = 0; c < wd; c++) if (!isOcean(x0 + c) || ground[x0 + c] < SEA + minDepth) return false; return true; };
  /** Meeresgrund einebnen: bis zur höchsten Stelle mit Sand auffüllen; liefert die neue Grundhöhe */
  const levelFloor = (x0, wd) => {
    let base = 999; for (let c = 0; c < wd; c++) base = Math.min(base, ground[x0 + c]);
    for (let c = 0; c < wd; c++) { for (let y = base; y < ground[x0 + c]; y++) put(x0 + c, y, B.SAND); ground[x0 + c] = base; }
    return base;
  };

  // ---------- Tangwälder und Seegras ----------
  for (let x = 3; x < W - 3; x++) {
    if (!isOcean(x)) continue;
    const g = ground[x], depth = g - SEA;
    if (depth < 3 || at(x, g - 1) !== B.WATER || !floorOk(at(x, g)) || aux[(g - 1) * W + x]) continue;
    const kelpN = fbm(x * 0.045 + 77, 3.1, seed + 211, 2), grassN = fbm(x * 0.06 + 140, 6.6, seed + 212, 2);
    if (kelpN > 0.56 && depth >= 6 && biomes[x] === BI.ocean && rnd() < 0.5) {
      const h = Math.max(3, Math.min(depth - 2, 3 + Math.floor(rnd() * 14)));
      for (let k = 0; k < h; k++) plant(x, g - 1 - k, k === h - 1 ? WP.KELP_TOP : WP.KELP);
    } else if (rnd() < (grassN > 0.5 ? 0.38 : 0.03)) plant(x, g - 1, WP.SEAGRASS);
  }

  // ---------- Korallenriffe im warmen Ozean ----------
  for (let x = 8; x < W - 8; x++) {
    if (biomes[x] !== BI.warm_ocean || ground[x] < SEA + 4 || rnd() > 0.05) continue;
    const r = 2 + Math.floor(rnd() * 4), c1 = ri(0, 4), c2 = ri(0, 4), dead = rnd() < 0.12;
    for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx;
      if (!isOcean(xx) || ground[xx] < SEA + 3) continue;
      const g = ground[xx], hgt = Math.floor((1 - Math.abs(dx) / (r + 1)) * (1 + rnd() * 3.2));
      for (let k = 0; k < hgt; k++) if (at(xx, g - 1 - k) === B.WATER) put(xx, g - 1 - k, dead ? B.DEAD_CORAL_BLOCK : B.CORAL_BLOCK, rnd() < 0.5 ? c1 : c2);
      const top = g - 1 - hgt, c = rnd() < 0.5 ? c1 : c2, q = rnd();
      if (at(xx, top) !== B.WATER || (hgt === 0 && q < 0.35)) continue;
      if (dead) plant(xx, top, q < 0.6 ? WP.DEAD_CORAL : WP.DEAD_FAN);
      else if (q < 0.4) plant(xx, top, WP.CORAL + c);
      else if (q < 0.7) plant(xx, top, WP.FAN + c);
      else if (q < 0.85) plant(xx, top, WP.PICKLE + ri(0, 3));
      else plant(xx, top, WP.SEAGRASS);
    }
    x += r * 2;
  }

  // ---------- Vergrabene Schätze (Strände) ----------
  const treasures = [];
  const bury = (x, g) => {
    for (let dy = 1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, g + dy) !== B.SAND && at(x + dx, g + dy) !== B.STONE && at(x + dx, g + dy) !== B.DIRT) put(x + dx, g + dy, B.SAND);
    put(x, g + 2, B.CHEST);
    stock(x, g + 2, LOOT.buried, [{ id: "heart_of_the_sea", n: 1, d: 0 }]);
    structs.push({ kind: "treasure", x, y: g + 2 });
    treasures.push({ x, y: g + 2 });
    taken.push([x - 6, x + 6]); tight.push([x - 5, x + 5]);
  };
  const startX = 12 + Math.floor(rnd() * (W - 24));
  for (let k = 0; k < W - 24 && treasures.length < 4; k++) {                                           // Strände
    const x = 12 + (startX - 12 + k) % (W - 24), g = ground[x];
    if (g < SEA - 3 || g > SEA + 3 || at(x, g) !== B.SAND || (at(x, g - 1) !== B.AIR && at(x, g - 1) !== B.WATER) || !freeTight(x)) continue;
    let near = false; for (let d = 2; d <= 14; d++) if (isOcean(x + d) || isOcean(x - d)) near = true;
    if (!near || treasures.some(t => Math.abs(t.x - x) < 70)) continue;
    bury(x, g);
  }
  for (let k = 0; k < W - 24 && !treasures.length; k++) {                                               // Notlösung: unter dem flachen Meeresgrund
    const x = 12 + (startX - 12 + k) % (W - 24), g = ground[x];
    if (!isOcean(x) || g < SEA + 2 || g > SEA + 8 || !floorOk(at(x, g)) || !freeTight(x)) continue;
    bury(x, g);
  }

  // ---------- Schiffswracks ----------
  const hullBot = c => Math.floor(((c - 7) * (c - 7)) / 17), hullTop = c => 5 + Math.floor(Math.abs(c - 7) / 4);
  const wrecks = [];
  for (let tries = 0; tries < 300 && wrecks.length < 4; tries++) {
    const x0 = 14 + Math.floor(rnd() * (W - 44));
    if (!allOcean(x0, 15, 5) || !free(x0, x0 + 14)) continue;
    const base = levelFloor(x0, 15);
    for (let c = 0; c < 15; c++) {
      const bot = hullBot(c), top = hullTop(c);
      for (let r = bot; r <= top; r++) {
        const y = base - 1 - r;
        if (r === bot || c <= 1 || c >= 13) put(x0 + c, y, B.PLANKS);
        else if (r === top && c % 2 === 0) put(x0 + c, y, B.PLANKS);
        else if (r === 3 && c >= 3 && c <= 11 && c !== 6 && c !== 7) put(x0 + c, y, B.PLANKS);
      }
    }
    for (let r = hullBot(7) + 1; r <= 10; r++) put(x0 + 7, base - 1 - r, B.LOG);                      // Mast
    const cy = c => base - 1 - hullBot(c) - 1;
    put(x0 + 10, cy(10), B.CHEST); stock(x0 + 10, cy(10), LOOT.treasure);
    wrecks.push({ x: x0 + 7, y: base, supply: { x: x0 + 4, y: cy(4) } });
    put(x0 + 4, cy(4), B.CHEST);
    structs.push({ kind: "shipwreck", x: x0 + 7, y: base });
    taken.push([x0 - 4, x0 + 18]);
  }
  for (const wr of wrecks) {                                                                         // Karte zum nächsten Schatz in der Versorgungskiste
    let best = null; for (const t of treasures) if (!best || Math.abs(t.x - wr.x) < Math.abs(best.x - wr.x)) best = t;
    stock(wr.supply.x, wr.supply.y, LOOT.supply, best ? [{ id: "map_treasure", n: 1, d: best.x }] : []);
  }

  // ---------- Unterwasserruinen ----------
  let ruins = 0;
  for (let tries = 0; tries < 300 && ruins < 5; tries++) {
    const wd = 7 + Math.floor(rnd() * 3), x0 = 12 + Math.floor(rnd() * (W - 40));
    if (!allOcean(x0, wd, 4) || !free(x0, x0 + wd - 1)) continue;
    const warm = biomes[x0] === BI.warm_ocean, wall = warm ? B.SANDSTONE : B.COBBLE;
    const base = levelFloor(x0, wd);
    for (let c = 0; c < wd; c++) {
      const pillar = c === 0 || c === wd - 1, h = pillar ? 4 + Math.floor(rnd() * 3) : rnd() < 0.65 ? 1 + Math.floor(rnd() * 3) : 0;
      for (let r = 0; r < h; r++) put(x0 + c, base - 1 - r, !warm && rnd() < 0.2 ? B.MOSS_BLOCK : wall);
    }
    const mid = x0 + (wd >> 1);
    for (let r = 0; r < 3; r++) put(mid, base - 1 - r, B.AIR);
    for (let r = 0; r < 3; r++) { const i = (base - 1 - r) * W + mid; tiles[i] = B.WATER; lvl[i] = SRC; aux[i] = 0; }
    put(mid, base - 1, B.CHEST); stock(mid, base - 1, LOOT.ruin);
    structs.push({ kind: "ruin", x: x0 + (wd >> 1), y: base });
    taken.push([x0 - 3, x0 + wd + 2]);
    ruins++;
  }

  // ---------- Monument: nasse Schwämme und dunkler Prismarin ----------
  for (const s of structs) {
    if (s.kind !== "monument") continue;
    const x0 = s.x - 14, gy = s.y - 1;
    for (const c0 of [4, 22]) for (let c = c0; c < c0 + 3; c++) for (let r = 0; r < 2; r++) { const t = at(x0 + c, gy - r); if (t === B.WATER || t === B.AIR) put(x0 + c, gy - r, B.WET_SPONGE); }
    for (let c = 0; c < 29; c += 2) if (at(x0 + c, gy - 10) === B.PRISMARINE) put(x0 + c, gy - 10, B.DARK_PRISM);
    for (const c of [9, 19]) for (let y = 4; y <= 9; y++) if (at(x0 + c, gy - y + 1) === B.PRISMARINE && y % 2 === 0) put(x0 + c, gy - y + 1, B.PRISM_BRICKS);
    for (const c of [0, 28]) for (let y = 4; y <= 10; y++) if (at(x0 + c, gy - y + 1) === B.PRISMARINE && y % 3 === 0) put(x0 + c, gy - y + 1, B.PRISM_BRICKS);
  }
  return w;
}
