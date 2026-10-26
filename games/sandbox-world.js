// =====================================================================
// Blockdorf – Weltgenerator (Etappe 2)
//   Klima → Biome (Ebene, Wald, Birkenwald, Taiga, Schnee, Wüste, Savanne, Dschungel, Sumpf, Berge, Ozean)
//   Gelände → Schichten (Gras/Sand/Schnee, Stein, Tiefenschiefer, Grundgestein)
//   Höhlen: Gänge, dünne Gänge, Hallen, Schluchten, Eingänge · Wasserbecken und Lava am Boden
//   Erze: Kohle, Kupfer, Eisen, Lapis, Gold, Redstone, Diamant, Smaragd (nur in Bergen)
//   Bauwerke: Dörfer, Verliese, Minenschächte
// Gleiche Zahl → gleiche Welt.
// =====================================================================
import { B, BLOCKS } from "./sandbox-data.js?v=10";
import { cherryTree, mangroveTree, bambooStalk } from "./sandbox-trees8.js?v=10";
import { mulberry32, hash2, vnoise, fbm, smooth, clamp } from "./sandbox-noise.js?v=10";

import { W, H, SURF, SPAWN_X, SEA, DEEP } from "./sandbox-const.js?v=10";
export const BIOMES = ["plains", "forest", "birch", "taiga", "snow", "desert", "savanna", "jungle", "swamp", "mountains", "ocean", "dappled", "meadow", "grove", "snowy_slopes", "jagged_peaks", "stony_peaks", "cherry", "mangrove", "bamboo", "warm_ocean"];
export const BIOME_NAMES = { plains: "Ebene", forest: "Wald", birch: "Birkenwald", taiga: "Taiga", snow: "Schneeebene", desert: "Wüste", savanna: "Savanne", jungle: "Dschungel", swamp: "Sumpf", mountains: "Berge", ocean: "Ozean", dappled: "Gesprenkelter Wald", meadow: "Wiese", grove: "Schneehain", snowy_slopes: "Verschneite Hänge", jagged_peaks: "Zackengipfel", stony_peaks: "Steingipfel", cherry: "Kirschhain", mangrove: "Mangrovensumpf", bamboo: "Bambuswald", warm_ocean: "Warmer Ozean" };
export const OCEANS = new Set(["ocean", "warm_ocean"]);
/** Biome der Berge (Höhenstufen der Berge ab 1.18) */
export const MOUNTAIN_BIOMES = new Set(["mountains", "grove", "snowy_slopes", "jagged_peaks", "stony_peaks"]);
/** Biome mit Schnee statt Regen */
export const SNOWY_BIOMES = new Set(["snow", "grove", "snowy_slopes", "jagged_peaks"]);
const BI = Object.fromEntries(BIOMES.map((b, i) => [b, i]));

/** Truheninhalt */
function loot(rnd, kind, xr) {
  const pick = (id, a, b = a) => ({ id, n: a + Math.floor(rnd() * (b - a + 1)), d: 0 });
  const t = {
    village: [["apple", 2, 5, 0.9], ["torch", 4, 10, 0.8], ["stick", 3, 8, 0.7], ["coal", 2, 6, 0.6], ["iron_ingot", 1, 3, 0.35], ["bucket", 1, 1, 0.15], ["gold_ingot", 1, 2, 0.15], ["planks", 4, 10, 0.5]],
    dungeon: [["iron_ingot", 1, 4, 0.7], ["gold_ingot", 1, 3, 0.45], ["coal", 3, 8, 0.7], ["apple", 1, 3, 0.5], ["redstone", 2, 6, 0.4], ["lapis", 2, 6, 0.3], ["bucket", 1, 1, 0.3], ["diamond", 1, 2, 0.14], ["emerald", 1, 1, 0.08], ["iron_pick", 1, 1, 0.06], ["torch", 5, 12, 0.5]],
    shaft: [["coal", 3, 9, 0.8], ["torch", 6, 14, 0.7], ["iron_ingot", 1, 4, 0.5], ["gold_ingot", 1, 2, 0.25], ["lapis", 2, 5, 0.3], ["diamond", 1, 1, 0.1], ["stick", 4, 10, 0.5], ["apple", 1, 2, 0.35], ["raw_copper", 2, 6, 0.4]]
  }[kind];
  const out = [];
  for (const [id, a, b, p] of t) if (rnd() < p) { const s = pick(id, a, b); if (id === "iron_pick") s.n = 1; out.push(s); }
  // Etappe 4: Saatgut, Bücher und Alchemie-Zutaten – mit eigenem Zufall, damit Welten der Etappe 3 gleich bleiben
  const extra = {
    village: [["wheat_seeds", 3, 8, 0.5], ["carrot", 2, 5, 0.45], ["potato", 2, 5, 0.4], ["bread", 1, 3, 0.4], ["pumpkin_seeds", 1, 3, 0.25], ["melon_seeds", 1, 3, 0.2], ["book", 1, 2, 0.25]],
    dungeon: [["enchanted_book", 1, 1, 0.3], ["nether_wart", 2, 4, 0.3], ["blaze_rod", 1, 2, 0.22], ["book", 1, 2, 0.3], ["glass_bottle", 2, 4, 0.2]],
    shaft: [["book", 1, 2, 0.3], ["enchanted_book", 1, 1, 0.12], ["redstone", 3, 8, 0.4], ["bread", 1, 3, 0.3]]
  }[kind];
  const xo = [];
  for (const [id, a, b, p] of extra) if (xr() < p) xo.push({ id, n: a + Math.floor(xr() * (b - a + 1)), d: 0 });
  return [...out.slice(0, 7), ...xo.slice(0, 3)];
}

export function generateWorld(seed) {
  const rnd = mulberry32(seed);
  const tiles = new Uint8Array(W * H), lvl = new Uint8Array(W * H);
  const ground = new Int16Array(W), biomes = new Uint8Array(W);
  const chests = [], villages = [];
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id) => { if (x >= 0 && x < W && y > 0 && y < H) tiles[y * W + x] = id; };
  const air = (x, y) => at(x, y) === B.AIR;
  const isStoneish = id => id === B.STONE || id === B.DEEPSLATE;

  // ---------- Klima und Höhe ----------
  const temp = new Float32Array(W), humid = new Float32Array(W), mnt = new Float32Array(W), oce = new Float32Array(W), hgt = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    temp[x] = fbm(x * 0.0065, 11.3, seed + 1, 3);
    humid[x] = fbm(x * 0.0075 + 50, 21.7, seed + 2, 3);
    mnt[x] = smooth(0.56, 0.72, fbm(x * 0.0042 + 90, 3.3, seed + 3, 3));
    oce[x] = smooth(0.62, 0.74, fbm(x * 0.0048 + 130, 7.3, seed + 4, 3));
  }
  // Teilgebiete der Etappe 8: Kirschhain (mild und feucht), Bambuswald (im Dschungel), Mangrovensumpf (warmer Sumpf)
  const cherryN = new Float32Array(W), bambooN = new Float32Array(W);
  for (let x = 0; x < W; x++) { cherryN[x] = fbm(x * 0.011 + 500, 8.8, seed + 12, 3); bambooN[x] = fbm(x * 0.013 + 640, 2.2, seed + 13, 3); }
  const climate = x => {
    const t = temp[x], h = humid[x];
    if (t < 0.42) return h > 0.48 ? "taiga" : "snow";
    if (t > 0.58) return h < 0.44 ? "desert" : h > 0.58 ? (bambooN[x] > 0.55 ? "bamboo" : "jungle") : "savanna";
    if (h > 0.62) return t > 0.5 ? "mangrove" : "swamp";
    if (h > 0.53) return cherryN[x] > 0.6 ? "cherry" : "forest";
    if (h > 0.46) return "birch";
    return cherryN[x] > 0.66 && h > 0.49 ? "cherry" : "plains";
  };
  // Jede Welt bekommt mindestens eine Bergkette (sonst würde die höhere Welt ungenutzt bleiben) und jedes neue Biom wenigstens einmal:
  // fehlt es, wird der breiteste passende Streifen umgewidmet.
  if (mnt.filter(m => m > 0.7).length < 40) {
    const cx = (hash2(7, 7, seed) < 0.5 ? 70 : 340) + Math.floor(hash2(8, 8, seed) * 100), wd = 80;
    for (let x = 0; x < W; x++) { const k = 1 - Math.pow(Math.abs(x - cx) / wd, 2); if (k > 0) mnt[x] = Math.max(mnt[x], smooth(0, 0.5, k)); }
  }
  const clim = new Array(W);
  for (let x = 0; x < W; x++) clim[x] = climate(x);
  {
    const LAND = ["plains", "forest", "birch", "taiga", "savanna", "swamp", "jungle", "cherry", "mangrove", "bamboo"];
    for (const nb of ["desert", "cherry", "mangrove", "bamboo"]) {
      if (clim.includes(nb)) continue;
      const ok = x => Math.abs(x - SPAWN_X) > 50 && mnt[x] < 0.4 && oce[x] < 0.4 && LAND.includes(clim[x]) && !["desert", "cherry", "mangrove", "bamboo"].includes(clim[x]);
      let best = null;
      for (let x = 0; x < W;) {
        if (!ok(x)) { x++; continue; }
        let e = x; while (e < W && ok(e)) e++;
        if (!best || e - x > best.e - best.x) best = { x, e };
        x = e;
      }
      if (best && best.e - best.x >= 16) { const mid = (best.x + best.e) >> 1; for (let x = Math.max(best.x, mid - 22); x < Math.min(best.e, mid + 22); x++) clim[x] = nb; }
    }
  }
  for (let x = 0; x < W; x++) {
    const t = smooth(26, 56, Math.abs(x - SPAWN_X));
    const c = clim[x];
    const amp = 80 * (1 + mnt[x] * 0.6) * (c === "desert" || c === "savanna" ? 0.55 : 1);
    let hh = SURF + (fbm(x * 0.012, 3.7, seed, 4) - 0.5) * amp * t + oce[x] * 26 * t;
    // Berge (1.18): bis zu etwa 110 Blöcke über der Ebene, Grate und Gipfel durch ein eigenes Rauschen
    const ridge = smooth(0.3, 0.78, fbm(x * 0.03 + 300, 5.5, seed + 9, 4));
    hh -= mnt[x] * t * (22 + 88 * ridge);
    // Gipfel werden oben weich gestaucht, damit sie nicht an der Weltdecke abgeschnitten werden
    const peakTop = SURF - 112;
    if (hh < peakTop + 24) hh = peakTop + 24 - 24 * (1 - Math.exp(-(peakTop + 24 - hh) / 24));
    // Senken laufen nur im Ozean richtig voll; sonst bleiben es kleine Teiche (höchstens ~6 tief)
    if (hh > SEA - 2) hh = SEA - 2 + (hh - (SEA - 2)) * (0.15 + 0.85 * oce[x]);
    if ((c === "swamp" || c === "mangrove") && mnt[x] < 0.2 && oce[x] < 0.2) hh = hh + (SEA - 0.5 - hh) * 0.75 * t;
    hgt[x] = hh;
  }
  // Hat die Welt noch keinen richtigen Berg (Rauschen ohne Grat), wird ein Gebirgsstock aufgesetzt
  if (Math.min(...hgt) > SURF - 64) {
    const cx = (hash2(9, 9, seed) < 0.5 ? 70 : 340) + Math.floor(hash2(10, 10, seed) * 100), wd = 70;
    for (let x = 0; x < W; x++) {
      const k = 1 - Math.pow(Math.abs(x - cx) / wd, 2);
      if (k <= 0 || Math.abs(x - SPAWN_X) < 60) continue;
      const lift = smooth(0, 0.8, k) * (66 + 30 * smooth(0.3, 0.78, fbm(x * 0.03 + 300, 5.5, seed + 9, 4)));
      if (hgt[x] < SEA - 2) hgt[x] = Math.max(SURF - 100, hgt[x] - lift); else hgt[x] = Math.max(SURF - 100, Math.min(hgt[x], SURF) - lift);
      mnt[x] = Math.max(mnt[x], 0.5 * smooth(0, 0.3, k));
    }
  }
  // Etappe 11: Jede Welt bekommt auch ein Meer (sonst blieben Monument, Riffe und Wracks vielen Welten verborgen).
  // Gezählt werden die Spalten, die gleich als Ozean eingeteilt werden; zu wenige → ein Meer wird wie das Gebirge oben aufgesetzt.
  {
    let n = 0;
    for (let x = 0; x < W; x++) if (Math.abs(x - SPAWN_X) > 44 && mnt[x] <= 0.3 && oce[x] > 0.45 && Math.round(hgt[x]) >= SEA + 3) n++;
    if (n < 40) {
      const cx = (hash2(11, 11, seed) < 0.5 ? 60 : 350) + Math.floor(hash2(12, 12, seed) * 90), wd = 70;
      for (let x = 0; x < W; x++) {
        const k = 1 - Math.pow(Math.abs(x - cx) / wd, 2);
        if (k <= 0 || Math.abs(x - SPAWN_X) < 60) continue;
        const f = smooth(0, 0.35, k);
        oce[x] = Math.max(oce[x], f); mnt[x] *= 1 - smooth(0, 0.2, k);
        hgt[x] = Math.max(hgt[x], SEA + 3 + 18 * smooth(0, 0.7, k));
      }
    }
  }
  // Biome je Spalte
  const bname = new Array(W);
  for (let x = 0; x < W; x++) {
    const top = clamp(Math.round(hgt[x]), 8, H - 60);
    let b = clim[x];
    if (Math.abs(x - SPAWN_X) <= 44) b = "plains";
    else if (mnt[x] > 0.3 && top < SURF - 8) {
      // Höhenstufen: Wiese unten, Hain / Hänge in der Mitte, Gipfel oben – kalt: Schnee, warm: Stein
      const rise = SURF - top, cold = temp[x] < 0.5;
      b = rise < 22 ? "meadow" : rise < 44 ? (cold ? "grove" : rise < 34 ? "meadow" : "stony_peaks") : rise < 70 ? (cold ? "snowy_slopes" : "stony_peaks") : (cold ? "jagged_peaks" : "stony_peaks");
    }
    else if (oce[x] > 0.45 && top >= SEA + 3) b = temp[x] > 0.55 ? "warm_ocean" : "ocean";
    bname[x] = b; biomes[x] = BI[b]; ground[x] = top;
  }

  // ---------- Spalten füllen ----------
  for (let x = 0; x < W; x++) {
    const top = ground[x], b = bname[x];
    const village = Math.abs(x - SPAWN_X) <= 26;
    const beach = !village && !MOUNTAIN_BIOMES.has(b) && b !== "snow" && b !== "mangrove" && top >= SEA - 2 && top <= SEA + 3;
    const dirt = 3 + Math.floor(hash2(x, 5, seed) * 3);
    const dsLine = DEEP + Math.floor(hash2(x, 9, seed) * 4);
    const clayPatch = b === "ocean" && fbm(x * 0.09, 4.4, seed + 7, 2) > 0.62;
    for (let y = top; y < H; y++) {
      const d = y - top;
      let id;
      if (y >= H - 2) id = B.BEDROCK;
      else if (y >= H - 4 && hash2(x, y, seed + 3) < (y === H - 3 ? 0.6 : 0.3)) id = B.BEDROCK;
      else if (b === "warm_ocean") id = d < 4 ? B.SAND : (y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (b === "ocean") id = d < 4 ? (clayPatch && d < 3 ? B.CLAY : hash2(x >> 2, 3, seed) < 0.3 ? B.GRAVEL : B.SAND) : (y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (beach && d < 5) id = B.SAND;
      else if (b === "desert" && d < 5) id = B.SAND;
      else if (b === "desert" && d < 9) id = B.SANDSTONE;
      else if (b === "mountains") id = d === 0 && top < SURF - 20 ? B.SNOW : d < 2 && top < SURF - 14 ? B.SNOW : (hash2(x >> 1, y >> 1, seed + 5) < 0.04 && d < 4 ? B.GRAVEL : y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (b === "jagged_peaks") id = d < 2 ? (hash2(x >> 1, y >> 1, seed + 14) < 0.22 ? B.PACKED_ICE : B.SNOW) : d < 6 && hash2(x >> 2, y >> 1, seed + 15) < 0.2 ? B.PACKED_ICE : (y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (b === "snowy_slopes") id = d < 3 ? B.SNOW : (d < 5 && hash2(x >> 1, y, seed + 17) < 0.05 ? B.GRAVEL : y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (b === "grove") id = d === 0 ? B.GRASS_SNOW : d <= dirt ? B.DIRT : (y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (b === "stony_peaks") id = d < 3 && hash2(x >> 1, y >> 1, seed + 16) < 0.3 ? B.CALCITE : (hash2(x >> 1, y >> 1, seed + 5) < 0.05 && d < 4 ? B.GRAVEL : y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (b === "mangrove") id = d < 4 ? B.MUD : d < 6 ? B.DIRT : (y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (d === 0) id = b === "snow" || (b === "taiga" && temp[x] < 0.38) ? B.GRASS_SNOW : B.GRASS;
      else if (d <= dirt) id = B.DIRT;
      else id = y >= dsLine ? B.DEEPSLATE : B.STONE;
      tiles[y * W + x] = id;
    }
    // Wasser über dem Gelände (Seen, Ozean, Sumpf)
    for (let y = SEA; y < top; y++) { tiles[y * W + x] = B.WATER; lvl[y * W + x] = 8; }
    if (top > SEA && (b === "snow" || (b === "taiga" && temp[x] < 0.38))) tiles[SEA * W + x] = B.ICE;
    if (top > SEA + 1 && (b === "snow" || (b === "taiga" && temp[x] < 0.38)) && hash2(x >> 3, 2, seed + 18) < 0.4) for (let y = SEA + 1; y < Math.min(top, SEA + 3); y++) tiles[y * W + x] = B.PACKED_ICE;   // Eisplatten: unter dem Eis liegt gepacktes Eis
  }

  // ---------- Höhlen ----------
  const nearVillage = x => Math.abs(x - SPAWN_X) < 28;
  for (let x = 1; x < W - 1; x++) {
    const top = ground[x];
    for (let y = top + 3; y < H - 5; y++) {
      const id = tiles[y * W + x];
      if (id === B.AIR || id === B.WATER || id === B.BEDROCK) continue;
      if (nearVillage(x) && y < top + 18) continue;
      const a = Math.abs(vnoise(x * 0.05, y * 0.07, seed + 11) - 0.5), b2 = Math.abs(vnoise(x * 0.05 + 40, y * 0.07 + 40, seed + 23) - 0.5);
      let carve = y >= top + 6 && a < 0.04 && b2 < 0.045;                                              // Gänge
      if (!carve) { const a2 = Math.abs(vnoise(x * 0.11 + 7, y * 0.09 + 3, seed + 41) - 0.5), b3 = Math.abs(vnoise(x * 0.1 + 80, y * 0.12 + 9, seed + 43) - 0.5); carve = y >= top + 8 && a2 < 0.022 && b3 < 0.03; }   // dünne Gänge
      if (!carve && y > top + 24 && fbm(x * 0.03, y * 0.045, seed + 31, 3) > 0.7) carve = true;       // große Hallen
      // Käsehöhlen (1.18): weite, flache Kammern mit Säulen und Löchern, nach unten häufiger
      if (!carve && y > top + 16 && fbm(x * 0.019, y * 0.058, seed + 301, 3) > 0.685 - Math.min(0.03, (y - top) / 3500)) carve = true;
      // Spaghetti-Gänge: lange, gewundene Röhren (drei Blöcke hoch); Nudel-Gänge: dünn und tief (zwei Blöcke hoch)
      if (!carve && y > top + 10 && Math.abs(vnoise(x * 0.032, y * 0.047, seed + 311) - 0.5) < 0.0135) { carve = true; for (const dy of [-1, -2]) { const j = (y + dy) * W + x, t2 = tiles[j]; if (t2 !== B.AIR && t2 !== B.WATER && t2 !== B.BEDROCK && t2 !== B.ICE && y + dy > top + 6) tiles[j] = B.AIR; } }
      if (!carve && y > top + 30 && Math.abs(vnoise(x * 0.07 + 9, y * 0.09 + 4, seed + 313) - 0.5) < 0.0085) { carve = true; const j = (y - 1) * W + x, t2 = tiles[j]; if (t2 !== B.AIR && t2 !== B.WATER && t2 !== B.BEDROCK) tiles[j] = B.AIR; }
      if (carve && !(id === B.SAND && y < top + 6)) tiles[y * W + x] = B.AIR;
    }
  }
  const carveDisc = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 1 || x >= W - 1 || y < 2 || y >= H - 5) continue;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
      const id = tiles[y * W + x];
      if (id !== B.BEDROCK && id !== B.WATER && id !== B.ICE) tiles[y * W + x] = B.AIR;
    }
  };
  // Schluchten: senkrechte Risse von der Oberfläche in die Tiefe
  for (let i = 0; i < 7; i++) {
    const sx = 20 + Math.floor(rnd() * (W - 40));
    if (nearVillage(sx) || OCEANS.has(bname[sx])) continue;
    const depth = 22 + Math.floor(rnd() * 45), ph = rnd() * 6;
    for (let k = 0; k < depth; k++) {
      const y = ground[clamp(Math.round(sx), 0, W - 1)] - 1 + k, wd = 1.1 + vnoise(k * 0.2, i, seed + 61) * 1.8 + (k < 6 ? 0.8 : 0);
      carveDisc(sx + Math.sin(k * 0.22 + ph) * 3, y, wd, 1.3);
    }
  }
  // Höhleneingänge: schräge Gänge von der Oberfläche
  for (let i = 0; i < 12; i++) {
    let x = 15 + rnd() * (W - 30);
    if (nearVillage(x) || OCEANS.has(bname[Math.round(x)])) continue;
    let y = ground[Math.round(x)] - 1;
    const dir = rnd() < 0.5 ? -1 : 1;
    for (let k = 0; k < 34; k++) { carveDisc(x, y, 1.7, 1.7); x += dir * (0.5 + 0.3 * Math.sin(k * 0.4)); y += 0.85; }
  }
  // Lava am Boden, Wasserbecken in einigen Höhlen
  for (let x = 1; x < W - 1; x++) for (let y = SURF + 14; y < H - 5; y++) {
    const i = y * W + x;
    if (tiles[i] !== B.AIR) continue;
    if (y >= H - 30) { tiles[i] = B.LAVA; lvl[i] = 8; continue; }
    if (y < SURF + 22) continue;
    const lvlY = SURF + 30 + Math.floor(fbm(x * 0.02, 1.1, seed + 56, 2) * 50);
    if (y >= lvlY && fbm(x * 0.012, y * 0.03, seed + 55, 2) > 0.64) { tiles[i] = B.WATER; lvl[i] = 8; }
  }

  // Unterirdische Seen (1.18): Wasser füllt eine Kammer bis zu einem festen Spiegel
  for (let k = 0, made = 0; k < 160 && made < 12; k++) {
    const sx = 10 + Math.floor(rnd() * (W - 20));
    if (nearVillage(sx) || OCEANS.has(bname[sx])) continue;
    const sy = ground[sx] + 22 + Math.floor(rnd() * Math.min(80, H - 40 - ground[sx] - 22));
    if (sy >= H - 34 || tiles[sy * W + sx] !== B.AIR) continue;
    let fy = sy; while (fy + 1 < H - 6 && tiles[(fy + 1) * W + sx] === B.AIR) fy++;
    if (tiles[(fy + 1) * W + sx] === B.LAVA || fy >= H - 31) continue;
    const level = fy - 1 - Math.floor(rnd() * 5), seen = new Set([fy * W + sx]), q = [[sx, fy]];
    let ok = true;
    while (q.length && ok) {
      const [cx, cy] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
        if (nx < 1 || nx >= W - 1 || ny < level || ny >= H - 5 || seen.has(ni)) continue;
        const t = tiles[ni];
        if (t === B.AIR) { seen.add(ni); q.push([nx, ny]); if (seen.size > 1400) { ok = false; break; } }
        else if (t === B.LAVA || t === B.WATER) { ok = false; break; }
      }
    }
    if (!ok || seen.size < 40) continue;
    for (const i of seen) { tiles[i] = B.WATER; lvl[i] = 8; }
    made++;
  }

  // ---------- Erze ----------
  // Verteilung wie ab 1.18: dichteste Stelle in einer bestimmten Tiefe, nach oben und unten dünner
  const BOT = H - 8 - SURF;                                                           // tiefste Zeile unter der Oberfläche
  const veinT = (type, count, minD, maxD, peakD, size) => {
    for (let i = 0; i < count; i++) {
      const u = (rnd() + rnd()) / 2, d = u < 0.5 ? minD + (peakD - minD) * (u * 2) ** 0.8 : peakD + (Math.min(maxD, BOT) - peakD) * ((u - 0.5) * 2) ** 1.2;
      let cx = Math.floor(rnd() * W), cy = Math.floor(SURF + d);
      const n = size[0] + Math.floor(rnd() * (size[1] - size[0] + 1));
      for (let k = 0; k < n; k++) {
        if (cx > 0 && cx < W - 1 && cy > 0 && cy < H - 3 && isStoneish(tiles[cy * W + cx])) tiles[cy * W + cx] = type;
        const dd = Math.floor(rnd() * 4);
        cx += dd === 0 ? 1 : dd === 1 ? -1 : 0; cy += dd === 2 ? 1 : dd === 3 ? -1 : 0;
      }
    }
  };
  const vein = (type, count, minD, maxD, size) => {
    for (let i = 0; i < count; i++) {
      let cx = Math.floor(rnd() * W), cy = Math.floor(SURF + minD + rnd() * (Math.min(H - 8, SURF + maxD) - SURF - minD));
      const n = size[0] + Math.floor(rnd() * (size[1] - size[0] + 1));
      for (let k = 0; k < n; k++) {
        if (cx > 0 && cx < W - 1 && cy > 0 && cy < H - 3 && isStoneish(tiles[cy * W + cx])) tiles[cy * W + cx] = type;
        const d = Math.floor(rnd() * 4);
        cx += d === 0 ? 1 : d === 1 ? -1 : 0; cy += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
  };
  veinT(B.COAL, 520, 6, 130, 34, [4, 9]);
  veinT(B.COPPER, 320, 10, 100, 46, [3, 8]);
  veinT(B.IRON, 340, 30, 124, 72, [3, 7]);
  veinT(B.LAPIS, 100, 34, 124, 84, [2, 5]);
  veinT(B.GOLD, 170, 56, 124, 100, [2, 5]);
  veinT(B.REDSTONE, 190, 72, 124, 112, [3, 6]);
  veinT(B.DIAMOND, 90, 86, 124, 116, [1, 4]);
  // Berge (1.18): Kohle, Eisen und Kupfer auch im Berginneren, Smaragde nur dort
  const mountCols = []; for (let x = 0; x < W; x++) if (MOUNTAIN_BIOMES.has(bname[x]) && ground[x] < SURF - 20) mountCols.push(x);
  if (mountCols.length) {
    for (const [type, n, size] of [[B.COAL, 90, [4, 9]], [B.IRON, 70, [3, 7]], [B.COPPER, 50, [4, 9]]]) {
      for (let i = 0; i < n; i++) {
        let cx = mountCols[Math.floor(rnd() * mountCols.length)], cy = ground[cx] + 4 + Math.floor(rnd() * 40);
        const cnt = size[0] + Math.floor(rnd() * (size[1] - size[0] + 1));
        for (let k = 0; k < cnt; k++) {
          if (cx > 0 && cx < W - 1 && cy > 0 && cy < H - 3 && isStoneish(tiles[cy * W + cx])) tiles[cy * W + cx] = type;
          const dd = Math.floor(rnd() * 4); cx += dd === 0 ? 1 : dd === 1 ? -1 : 0; cy += dd === 2 ? 1 : dd === 3 ? -1 : 0;
        }
      }
    }
  }
  for (let i = 0, n = 0; i < 600 && n < 24; i++) {                  // Smaragde nur in Bergen
    const x = Math.floor(rnd() * W);
    if (!MOUNTAIN_BIOMES.has(bname[x]) || bname[x] === "meadow") continue;
    const y = ground[x] + 3 + Math.floor(rnd() * 30);
    if (isStoneish(at(x, y))) { put(x, y, B.EMERALD); n++; }
  }

  // ---------- Pflanzen ----------
  const logsAt = (x, y0, h, id) => { for (let i = 1; i <= h; i++) put(x, y0 - i, id); };
  const blob = (cx, cy, rx, ry, id, cut = 0.2) => {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1 + cut) continue;
      if (air(cx + dx, cy + dy)) put(cx + dx, cy + dy, id);
    }
  };
  const tree = {
    oak(x, gy) { const th = 4 + Math.floor(rnd() * 3); logsAt(x, gy, th, B.LOG); blob(x, gy - th - 1, 2.3, 2.1, B.LEAVES); },
    birch(x, gy) { const th = 5 + Math.floor(rnd() * 3); logsAt(x, gy, th, B.BIRCH_LOG); blob(x, gy - th - 1, 2.0, 2.2, B.BIRCH_LEAVES); },
    spruce(x, gy) {
      const th = 6 + Math.floor(rnd() * 5); logsAt(x, gy, th, B.SPRUCE_LOG);
      for (let j = 0; j < th - 1; j++) { const r = Math.min(3, j % 2 === 0 ? (j >> 1) + 1 : j >> 1); for (let dx = -r; dx <= r; dx++) if (air(x + dx, gy - th - 1 + j)) put(x + dx, gy - th - 1 + j, B.SPRUCE_LEAVES); }
    },
    jungle(x, gy) { const th = 8 + Math.floor(rnd() * 7); logsAt(x, gy, th, B.JUNGLE_LOG); blob(x, gy - th - 1, 3.6, 2.4, B.JUNGLE_LEAVES, 0.15); blob(x, gy - th + 1, 2.6, 1.2, B.JUNGLE_LEAVES, 0.1); },
    acacia(x, gy) {
      const th = 4 + Math.floor(rnd() * 3), dir = rnd() < 0.5 ? -1 : 1; logsAt(x, gy, th, B.ACACIA_LOG);
      put(x + dir, gy - th - 1, B.ACACIA_LOG); put(x + dir * 2, gy - th - 2, B.ACACIA_LOG);
      for (let dx = -2; dx <= 2; dx++) if (air(x + dir * 2 + dx, gy - th - 3)) put(x + dir * 2 + dx, gy - th - 3, B.ACACIA_LEAVES);
      for (let dx = -1; dx <= 1; dx++) if (air(x + dir * 2 + dx, gy - th - 4)) put(x + dir * 2 + dx, gy - th - 4, B.ACACIA_LEAVES);
    }
  };
  const dens = { plains: 0.07, forest: 0.4, birch: 0.34, taiga: 0.34, snow: 0.08, savanna: 0.1, jungle: 0.32, swamp: 0.14, mountains: 0.08, cherry: 0.26, mangrove: 0.34, bamboo: 0.08, meadow: 0.02, grove: 0.28 };
  const envT = { put: (x, y, id) => put(x, y, id), air, rnd };
  let lastTree = -99;
  for (let x = 8; x < W - 8; x++) {
    const b = bname[x], gy = ground[x], id = at(x, gy);
    if (Math.abs(x - SPAWN_X) < 28) continue;
    if (b === "desert") {
      if (gy > SEA) continue;
      if (id === B.SAND && hash2(x, 17, seed) < 0.11 && at(x - 1, gy - 1) !== B.CACTUS && at(x + 1, gy - 1) !== B.CACTUS && at(x, gy - 1) === B.AIR) { const h = 1 + Math.floor(hash2(x, 18, seed) * 3); for (let i = 1; i <= h; i++) put(x, gy - i, B.CACTUS); }
      else if (id === B.SAND && hash2(x, 19, seed) < 0.1 && at(x, gy - 1) === B.AIR) put(x, gy - 1, B.DEADBUSH);
      continue;
    }
    if (!dens[b] || (id !== B.GRASS && id !== B.GRASS_SNOW && !(b === "mangrove" && id === B.MUD)) || at(x, gy - 1) !== B.AIR && !(b === "mangrove" && at(x, gy - 1) === B.WATER)) continue;
    if (gy > SEA + (b === "swamp" || b === "mangrove" ? 1 : 0)) continue;                    // unter Wasser: keine Bäume
    if (x - lastTree < (b === "jungle" ? 4 : 3) || hash2(x, 29, seed) >= dens[b]) continue;
    if (b === "plains" || b === "swamp") tree.oak(x, gy);
    else if (b === "forest") (hash2(x, 41, seed) < 0.22 ? tree.birch : tree.oak)(x, gy);
    else if (b === "birch") tree.birch(x, gy);
    else if (b === "taiga" || b === "snow" || b === "mountains" || b === "grove") tree.spruce(x, gy);
    else if (b === "cherry") cherryTree(envT, x, gy);
    else if (b === "mangrove") mangroveTree(envT, x, gy);
    else if (b === "bamboo") (hash2(x, 43, seed) < 0.5 ? tree.jungle : tree.oak)(x, gy);
    else if (b === "meadow") tree.oak(x, gy);
    else if (b === "savanna") tree.acacia(x, gy);
    else if (b === "jungle") tree.jungle(x, gy);
    lastTree = x;
  }
  for (let x = 0; x < W; x++) {
    const gy = ground[x], b = bname[x], id = at(x, gy);
    if (Math.abs(x - SPAWN_X) < 28 || gy > SEA || at(x, gy - 1) !== B.AIR) continue;
    if (id !== B.GRASS) continue;
    const r = hash2(x, 61, seed);
    const flower = { plains: 0.1, forest: 0.04, birch: 0.05, savanna: 0.02, jungle: 0.03, swamp: 0.04, taiga: 0.01, meadow: 0.22, cherry: 0.05, bamboo: 0.02 }[b] || 0;
    const grass = { plains: 0.22, forest: 0.18, birch: 0.18, savanna: 0.4, jungle: 0.4, swamp: 0.25, taiga: 0.18, meadow: 0.3, cherry: 0.2, bamboo: 0.18 }[b] || 0;
    if (b === "cherry" && r > 0.72 && r < 0.92) put(x, gy - 1, B.PINK_PETALS);
    else if (b === "bamboo" && hash2(x, 62, seed) < 0.34) bambooStalk(envT, x, gy);
    else if (r < flower) put(x, gy - 1, B.FLOWER); else if (r < flower + grass) put(x, gy - 1, B.TALLGRASS);
  }
  // Mangrovensumpf: Schösslinge auf dem Schlamm
  for (let x = 2; x < W - 2; x++) {
    const gy = ground[x];
    if (bname[x] === "mangrove" && at(x, gy) === B.MUD && at(x, gy - 1) === B.AIR && hash2(x, 63, seed) < 0.12) put(x, gy - 1, B.PROPAGULE);
  }
  // Etappe 4: Zuckerrohr am Ufer, Kürbisse in Ebenen und Wäldern, Melonen im Dschungel (nur mit Hash-Zufall, ändert die übrige Welt nicht)
  for (let x = 4; x < W - 4; x++) {
    const gy = ground[x], b = bname[x], id = at(x, gy);
    if (Math.abs(x - SPAWN_X) < 28 || at(x, gy - 1) !== B.AIR && !(at(x, gy - 1) === B.TALLGRASS || at(x, gy - 1) === B.FLOWER)) continue;
    if ((id === B.SAND || id === B.GRASS || id === B.DIRT) && (at(x - 1, gy) === B.WATER || at(x + 1, gy) === B.WATER) && hash2(x, 71, seed) < 0.4) {
      const h = 1 + Math.floor(hash2(x, 72, seed) * 3);
      for (let i = 1; i <= h; i++) put(x, gy - i, B.CANE);
    } else if (id === B.GRASS && gy <= SEA && (b === "plains" || b === "forest" || b === "birch") && hash2(x, 73, seed) < 0.012) put(x, gy - 1, B.PUMPKIN);
    else if (id === B.GRASS && gy <= SEA && b === "jungle" && hash2(x, 75, seed) < 0.025) put(x, gy - 1, B.MELON);
  }

  // ---------- Bauwerke ----------
  // Dorf: Platz ebnen, Häuser, Laternenpfähle, Truhen
  const village = (cx, S, style, main) => {
    const wall = style === "sand" ? B.SANDSTONE : style === "stone" ? B.COBBLE : B.PLANKS;
    const roof = style === "sand" ? B.SANDSTONE : B.PLANKS;
    const topId = style === "sand" ? B.SAND : style === "snow" ? B.GRASS_SNOW : B.GRASS;
    const under = style === "sand" ? B.SANDSTONE : B.DIRT;
    for (let x = cx - 24; x <= cx + 24; x++) {
      if (x < 1 || x >= W - 1) continue;
      for (let y = S - 14; y < S; y++) { put(x, y, B.AIR); lvl[y * W + x] = 0; }
      put(x, S, topId);
      for (let y = S + 1; y < S + 6; y++) if (!isStoneish(at(x, y)) && !BLOCKS[at(x, y)].solid || at(x, y) === B.WATER || at(x, y) === B.AIR) put(x, y, under);
      for (let y = S + 1; y < S + 6; y++) lvl[y * W + x] = 0;
      ground[x] = S;
    }
    const house = (x0, withBench, chest) => {
      for (let y = S - 5; y <= S - 1; y++) { put(x0, y, wall); put(x0 + 6, y, wall); }
      for (let x = x0 - 1; x <= x0 + 7; x++) put(x, S - 6, roof);
      for (let x = x0 + 1; x <= x0 + 5; x++) put(x, S, B.PLANKS);
      for (let y = S - 5; y <= S - 1; y++) for (let x = x0 + 1; x <= x0 + 5; x++) put(x, y, B.AIR);
      put(x0, S - 2, B.AIR); put(x0, S - 1, B.AIR);
      put(x0 + 6, S - 3, B.GLASS);
      put(x0 + 1, S - 4, B.TORCH);
      if (withBench) put(x0 + 4, S - 1, B.BENCH);
      if (chest) { put(x0 + 2, S - 1, B.CHEST); chests.push({ x: x0 + 2, y: S - 1, items: main && chest === 1 ? [{ id: "apple", n: 3, d: 0 }, { id: "torch", n: 8, d: 0 }, { id: "stick", n: 6, d: 0 }, { id: "coal", n: 4, d: 0 }, { id: "wheat_seeds", n: 5, d: 0 }, { id: "carrot", n: 3, d: 0 }, { id: "potato", n: 3, d: 0 }] : loot(rnd, "village", mulberry32(seed + chests.length * 977 + 5)) }); }
    };
    house(cx - 20, false, 1);
    house(cx - 3, main, main ? 0 : 1);
    house(cx + 13, false, main ? 0 : 1);
    for (const x of [cx - 9, cx + 9]) { put(x, S - 1, B.LOG); put(x, S - 2, B.LOG); put(x, S - 3, B.TORCH); }
    villages.push({ x: cx, y: S, style });
  };
  village(SPAWN_X, SURF, "oak", true);
  const styleOf = b => (b === "desert" ? "sand" : b === "snow" || b === "taiga" ? "stone" : "oak");
  for (let tries = 0; tries < 80 && villages.length < 4; tries++) {
    const x = 40 + Math.floor(rnd() * (W - 80)), b = bname[x];
    if (Math.abs(x - SPAWN_X) < 110 || villages.some(v => Math.abs(v.x - x) < 100)) continue;
    if (MOUNTAIN_BIOMES.has(b) || OCEANS.has(b) || b === "swamp" || b === "jungle" || b === "mangrove" || b === "bamboo") continue;
    const g = ground[x];
    if (g > SEA - 1 || g < SURF - 14) continue;
    let ok = true; for (let dx = -24; dx <= 24; dx += 6) if (OCEANS.has(bname[clamp(x + dx, 0, W - 1)]) || ground[clamp(x + dx, 0, W - 1)] > SEA + 4 || Math.abs(ground[clamp(x + dx, 0, W - 1)] - g) > 12) ok = false;
    if (ok) village(x, g, styleOf(b), false);
  }

  // Verlies: versiegelter Raum mit Truhe
  const placed = [];
  const far = (x, y, d) => placed.every(p => Math.hypot(p.x - x, p.y - y) > d);
  for (let i = 0, n = 0; i < 200 && n < 10; i++) {
    const w = 5 + Math.floor(rnd() * 5), hh = 4, x = 12 + Math.floor(rnd() * (W - 24 - w)), y = SURF + 16 + Math.floor(rnd() * 88);
    if (nearVillage(x) || !far(x, y, 30) || y + hh + 2 >= H - 8) continue;
    if (!isStoneish(at(x + (w >> 1), y)) || OCEANS.has(bname[x])) continue;
    for (let yy = y - 1; yy <= y + hh; yy++) for (let xx = x - 1; xx <= x + w; xx++) put(xx, yy, xx === x - 1 || xx === x + w || yy === y - 1 || yy === y + hh ? B.COBBLE : B.AIR);
    const cxp = x + 1 + Math.floor(rnd() * (w - 2));
    put(cxp, y + hh - 1, B.CHEST); chests.push({ x: cxp, y: y + hh - 1, items: loot(rnd, "dungeon", mulberry32(seed + chests.length * 977 + 7)) });
    placed.push({ x, y }); n++;
  }
  // Minenschacht: Gang mit Holzbalken, Fackeln und Truhe am Ende
  for (let i = 0, n = 0; i < 120 && n < 7; i++) {
    const len = 36 + Math.floor(rnd() * 40), x = 10 + Math.floor(rnd() * (W - 20 - len)), y = SURF + 24 + Math.floor(rnd() * 66);
    if (nearVillage(x) || nearVillage(x + len) || !far(x, y, 40) || y + 2 >= H - 8) continue;
    for (let xx = x; xx < x + len; xx++) {
      for (let yy = y - 2; yy <= y; yy++) put(xx, yy, B.AIR);
      if (!BLOCKS[at(xx, y + 1)].solid || at(xx, y + 1) === B.WATER) put(xx, y + 1, B.PLANKS);
      for (let yy = y - 2; yy <= y; yy++) lvl[yy * W + xx] = 0;
      if ((xx - x) % 6 === 0) { put(xx, y - 3, B.PLANKS); put(xx, y - 2, B.PLANKS); }
      if ((xx - x) % 12 === 6) put(xx, y, B.TORCH);
    }
    if (rnd() < 0.7) { const cxp = x + len - 2; put(cxp, y, B.CHEST); chests.push({ x: cxp, y, items: loot(rnd, "shaft", mulberry32(seed + chests.length * 977 + 9)) }); }
    placed.push({ x, y }); n++;
  }
  // fließendes Wasser/Lava, das durch Bauwerke ungültig wurde, bereinigen
  for (let i = 0; i < W * H; i++) { if (tiles[i] !== B.WATER && tiles[i] !== B.LAVA) lvl[i] = 0; else if (!lvl[i]) lvl[i] = 8; }
  for (const c of chests) if (tiles[c.y * W + c.x] !== B.CHEST) tiles[c.y * W + c.x] = B.CHEST;       // eine überlappende Röhre darf keine Truhe wegräumen
  return { tiles, lvl, ground, biomes, villages, chests };
}
