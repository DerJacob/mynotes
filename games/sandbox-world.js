// =====================================================================
// Blockdorf – Weltgenerator (Etappe 2)
//   Klima → Biome (Ebene, Wald, Birkenwald, Taiga, Schnee, Wüste, Savanne, Dschungel, Sumpf, Berge, Ozean)
//   Gelände → Schichten (Gras/Sand/Schnee, Stein, Tiefenschiefer, Grundgestein)
//   Höhlen: Gänge, dünne Gänge, Hallen, Schluchten, Eingänge · Wasserbecken und Lava am Boden
//   Erze: Kohle, Kupfer, Eisen, Lapis, Gold, Redstone, Diamant, Smaragd (nur in Bergen)
//   Bauwerke: Dörfer, Verliese, Minenschächte
// Gleiche Zahl → gleiche Welt.
// =====================================================================
import { B, BLOCKS } from "./sandbox-data.js?v=4";
import { mulberry32, hash2, vnoise, fbm, smooth, clamp } from "./sandbox-noise.js?v=4";

export const W = 512, H = 192, SURF = 60, SPAWN_X = W >> 1;
export const SEA = SURF + 4;                         // Wasserspiegel
export const DEEP = SURF + 72;                       // ab hier Tiefenschiefer
export const BIOMES = ["plains", "forest", "birch", "taiga", "snow", "desert", "savanna", "jungle", "swamp", "mountains", "ocean"];
export const BIOME_NAMES = { plains: "Ebene", forest: "Wald", birch: "Birkenwald", taiga: "Taiga", snow: "Schneeebene", desert: "Wüste", savanna: "Savanne", jungle: "Dschungel", swamp: "Sumpf", mountains: "Berge", ocean: "Ozean" };
const BI = Object.fromEntries(BIOMES.map((b, i) => [b, i]));

/** Truheninhalt */
function loot(rnd, kind) {
  const pick = (id, a, b = a) => ({ id, n: a + Math.floor(rnd() * (b - a + 1)), d: 0 });
  const t = {
    village: [["apple", 2, 5, 0.9], ["torch", 4, 10, 0.8], ["stick", 3, 8, 0.7], ["coal", 2, 6, 0.6], ["iron_ingot", 1, 3, 0.35], ["bucket", 1, 1, 0.15], ["gold_ingot", 1, 2, 0.15], ["planks", 4, 10, 0.5]],
    dungeon: [["iron_ingot", 1, 4, 0.7], ["gold_ingot", 1, 3, 0.45], ["coal", 3, 8, 0.7], ["apple", 1, 3, 0.5], ["redstone", 2, 6, 0.4], ["lapis", 2, 6, 0.3], ["bucket", 1, 1, 0.3], ["diamond", 1, 2, 0.14], ["emerald", 1, 1, 0.08], ["iron_pick", 1, 1, 0.06], ["torch", 5, 12, 0.5]],
    shaft: [["coal", 3, 9, 0.8], ["torch", 6, 14, 0.7], ["iron_ingot", 1, 4, 0.5], ["gold_ingot", 1, 2, 0.25], ["lapis", 2, 5, 0.3], ["diamond", 1, 1, 0.1], ["stick", 4, 10, 0.5], ["apple", 1, 2, 0.35], ["raw_copper", 2, 6, 0.4]]
  }[kind];
  const out = [];
  for (const [id, a, b, p] of t) if (rnd() < p) { const s = pick(id, a, b); if (id === "iron_pick") s.n = 1; out.push(s); }
  return out.slice(0, 7);
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
    mnt[x] = smooth(0.62, 0.76, fbm(x * 0.0042 + 90, 3.3, seed + 3, 3));
    oce[x] = smooth(0.62, 0.74, fbm(x * 0.0048 + 130, 7.3, seed + 4, 3));
  }
  const climate = x => {
    const t = temp[x], h = humid[x];
    if (t < 0.42) return h > 0.48 ? "taiga" : "snow";
    if (t > 0.58) return h < 0.44 ? "desert" : h > 0.58 ? "jungle" : "savanna";
    if (h > 0.62) return "swamp";
    if (h > 0.53) return "forest";
    if (h > 0.46) return "birch";
    return "plains";
  };
  for (let x = 0; x < W; x++) {
    const t = smooth(26, 56, Math.abs(x - SPAWN_X));
    const c = climate(x);
    let amp = 80 * (1 + mnt[x] * 1.3) * (c === "desert" || c === "savanna" ? 0.55 : 1);
    let hh = SURF + (fbm(x * 0.012, 3.7, seed, 4) - 0.5) * amp * t - mnt[x] * 28 * t + oce[x] * 26 * t;
    hh += (fbm(x * 0.045 + 300, 5.5, seed + 9, 3) - 0.5) * 46 * mnt[x] * t;       // Grate und Gipfel in den Bergen
    // Gipfel werden oben weich gestaucht, damit sie nicht an der Weltdecke abgeschnitten werden (flache Hochebene)
    if (hh < 38) hh = 38 - 17 * (1 - Math.exp(-(38 - hh) / 17));
    // Senken laufen nur im Ozean richtig voll; sonst bleiben es kleine Teiche (höchstens ~6 tief)
    if (hh > SEA - 2) hh = SEA - 2 + (hh - (SEA - 2)) * (0.15 + 0.85 * oce[x]);
    if (c === "swamp" && mnt[x] < 0.2 && oce[x] < 0.2) hh = hh + (SEA - 0.5 - hh) * 0.75 * t;
    hgt[x] = hh;
  }
  // Biome je Spalte
  const bname = new Array(W);
  for (let x = 0; x < W; x++) {
    const top = clamp(Math.round(hgt[x]), 18, H - 60);
    let b = climate(x);
    if (Math.abs(x - SPAWN_X) <= 44) b = "plains";
    else if (mnt[x] > 0.5 && top < SURF - 4) b = "mountains";
    else if (oce[x] > 0.45 && top >= SEA + 3) b = "ocean";
    bname[x] = b; biomes[x] = BI[b]; ground[x] = top;
  }

  // ---------- Spalten füllen ----------
  for (let x = 0; x < W; x++) {
    const top = ground[x], b = bname[x];
    const village = Math.abs(x - SPAWN_X) <= 26;
    const beach = !village && b !== "mountains" && b !== "snow" && top >= SEA - 2 && top <= SEA + 3;
    const dirt = 3 + Math.floor(hash2(x, 5, seed) * 3);
    const dsLine = DEEP + Math.floor(hash2(x, 9, seed) * 4);
    const clayPatch = b === "ocean" && fbm(x * 0.09, 4.4, seed + 7, 2) > 0.62;
    for (let y = top; y < H; y++) {
      const d = y - top;
      let id;
      if (y >= H - 2) id = B.BEDROCK;
      else if (y >= H - 4 && hash2(x, y, seed + 3) < (y === H - 3 ? 0.6 : 0.3)) id = B.BEDROCK;
      else if (b === "ocean") id = d < 4 ? (clayPatch && d < 3 ? B.CLAY : hash2(x >> 2, 3, seed) < 0.3 ? B.GRAVEL : B.SAND) : (y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (beach && d < 5) id = B.SAND;
      else if (b === "desert" && d < 5) id = B.SAND;
      else if (b === "desert" && d < 9) id = B.SANDSTONE;
      else if (b === "mountains") id = d === 0 && top < SURF - 20 ? B.SNOW : d < 2 && top < SURF - 14 ? B.SNOW : (hash2(x >> 1, y >> 1, seed + 5) < 0.04 && d < 4 ? B.GRAVEL : y >= dsLine ? B.DEEPSLATE : B.STONE);
      else if (d === 0) id = b === "snow" || (b === "taiga" && temp[x] < 0.38) ? B.GRASS_SNOW : B.GRASS;
      else if (d <= dirt) id = B.DIRT;
      else id = y >= dsLine ? B.DEEPSLATE : B.STONE;
      tiles[y * W + x] = id;
    }
    // Wasser über dem Gelände (Seen, Ozean, Sumpf)
    for (let y = SEA; y < top; y++) { tiles[y * W + x] = B.WATER; lvl[y * W + x] = 8; }
    if (top > SEA && (b === "snow" || (b === "taiga" && temp[x] < 0.38))) tiles[SEA * W + x] = B.ICE;
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
    if (nearVillage(sx) || bname[sx] === "ocean") continue;
    const depth = 22 + Math.floor(rnd() * 45), ph = rnd() * 6;
    for (let k = 0; k < depth; k++) {
      const y = ground[clamp(Math.round(sx), 0, W - 1)] - 1 + k, wd = 1.1 + vnoise(k * 0.2, i, seed + 61) * 1.8 + (k < 6 ? 0.8 : 0);
      carveDisc(sx + Math.sin(k * 0.22 + ph) * 3, y, wd, 1.3);
    }
  }
  // Höhleneingänge: schräge Gänge von der Oberfläche
  for (let i = 0; i < 12; i++) {
    let x = 15 + rnd() * (W - 30);
    if (nearVillage(x) || bname[Math.round(x)] === "ocean") continue;
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

  // ---------- Erze ----------
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
  vein(B.COAL, 520, 8, 200, [4, 9]);
  vein(B.COPPER, 320, 10, 70, [3, 8]);
  vein(B.IRON, 330, 28, 200, [3, 7]);
  vein(B.LAPIS, 90, 40, 100, [2, 5]);
  vein(B.GOLD, 150, 62, 200, [2, 5]);
  vein(B.REDSTONE, 170, 80, 200, [3, 6]);
  vein(B.DIAMOND, 70, 88, 200, [1, 4]);
  for (let i = 0, n = 0; i < 400 && n < 18; i++) {                  // Smaragde nur in Bergen
    const x = Math.floor(rnd() * W);
    if (bname[x] !== "mountains") continue;
    const y = ground[x] + 3 + Math.floor(rnd() * 14);
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
  const dens = { plains: 0.07, forest: 0.4, birch: 0.34, taiga: 0.34, snow: 0.08, savanna: 0.1, jungle: 0.32, swamp: 0.14, mountains: 0.08 };
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
    if (!dens[b] || (id !== B.GRASS && id !== B.GRASS_SNOW) || at(x, gy - 1) !== B.AIR) continue;
    if (gy > SEA + (b === "swamp" ? 1 : 0)) continue;                    // unter Wasser: keine Bäume
    if (x - lastTree < (b === "jungle" ? 4 : 3) || hash2(x, 29, seed) >= dens[b]) continue;
    if (b === "plains" || b === "swamp") tree.oak(x, gy);
    else if (b === "forest") (hash2(x, 41, seed) < 0.22 ? tree.birch : tree.oak)(x, gy);
    else if (b === "birch") tree.birch(x, gy);
    else if (b === "taiga" || b === "snow" || b === "mountains") tree.spruce(x, gy);
    else if (b === "savanna") tree.acacia(x, gy);
    else if (b === "jungle") tree.jungle(x, gy);
    lastTree = x;
  }
  for (let x = 0; x < W; x++) {
    const gy = ground[x], b = bname[x], id = at(x, gy);
    if (Math.abs(x - SPAWN_X) < 28 || gy > SEA || at(x, gy - 1) !== B.AIR) continue;
    if (id !== B.GRASS) continue;
    const r = hash2(x, 61, seed);
    const flower = { plains: 0.1, forest: 0.04, birch: 0.05, savanna: 0.02, jungle: 0.03, swamp: 0.04, taiga: 0.01 }[b] || 0;
    const grass = { plains: 0.22, forest: 0.18, birch: 0.18, savanna: 0.4, jungle: 0.4, swamp: 0.25, taiga: 0.18 }[b] || 0;
    if (r < flower) put(x, gy - 1, B.FLOWER); else if (r < flower + grass) put(x, gy - 1, B.TALLGRASS);
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
      if (chest) { put(x0 + 2, S - 1, B.CHEST); chests.push({ x: x0 + 2, y: S - 1, items: main && chest === 1 ? [{ id: "apple", n: 3, d: 0 }, { id: "torch", n: 8, d: 0 }, { id: "stick", n: 6, d: 0 }, { id: "coal", n: 4, d: 0 }] : loot(rnd, "village") }); }
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
    if (b === "mountains" || b === "ocean" || b === "swamp" || b === "jungle") continue;
    const g = ground[x];
    if (g > SEA - 1 || g < SURF - 14) continue;
    let ok = true; for (let dx = -24; dx <= 24; dx += 6) if (bname[clamp(x + dx, 0, W - 1)] === "ocean" || ground[clamp(x + dx, 0, W - 1)] > SEA + 4) ok = false;
    if (ok) village(x, g, styleOf(b), false);
  }

  // Verlies: versiegelter Raum mit Truhe
  const placed = [];
  const far = (x, y, d) => placed.every(p => Math.hypot(p.x - x, p.y - y) > d);
  for (let i = 0, n = 0; i < 200 && n < 10; i++) {
    const w = 5 + Math.floor(rnd() * 5), hh = 4, x = 12 + Math.floor(rnd() * (W - 24 - w)), y = SURF + 16 + Math.floor(rnd() * 88);
    if (nearVillage(x) || !far(x, y, 30) || y + hh + 2 >= H - 8) continue;
    if (!isStoneish(at(x + (w >> 1), y)) || bname[x] === "ocean") continue;
    for (let yy = y - 1; yy <= y + hh; yy++) for (let xx = x - 1; xx <= x + w; xx++) put(xx, yy, xx === x - 1 || xx === x + w || yy === y - 1 || yy === y + hh ? B.COBBLE : B.AIR);
    const cxp = x + 1 + Math.floor(rnd() * (w - 2));
    put(cxp, y + hh - 1, B.CHEST); chests.push({ x: cxp, y: y + hh - 1, items: loot(rnd, "dungeon") });
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
    if (rnd() < 0.7) { const cxp = x + len - 2; put(cxp, y, B.CHEST); chests.push({ x: cxp, y, items: loot(rnd, "shaft") }); }
    placed.push({ x, y }); n++;
  }
  // fließendes Wasser/Lava, das durch Bauwerke ungültig wurde, bereinigen
  for (let i = 0; i < W * H; i++) { if (tiles[i] !== B.WATER && tiles[i] !== B.LAVA) lvl[i] = 0; else if (!lvl[i]) lvl[i] = 8; }
  return { tiles, lvl, ground, biomes, villages, chests };
}
