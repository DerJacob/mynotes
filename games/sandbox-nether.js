// =====================================================================
// Blockdorf – Welten der Etappe 5: Nether, Ende und die Festung (Stronghold) in der Oberwelt
//   Nether:  eine riesige Höhle zwischen Grundgestein oben und unten, Lava-Ozean, Netherrack-Hügel und -Säulen,
//            schwebende Inseln, Glowstone an der Decke, Seelensandtal, Quarz- und Golderz, Magma am Ufer,
//            Netherfestungen (Brücken mit Dach, Warzenraum, Lohenspawner, Truhen)
//   Ende:    Hauptinsel aus Endstein mit zehn Obsidiansäulen (Kristalle oben) und Drache; zwei äußere Inseln mit
//            Endstadt-Türmen (Purpur, Truhen, Elytren)
//   Festung: versiegelter Raum tief unter der Erde mit dem Endportal-Rahmen
// Reine Funktionen: gleiche Zahl → gleiche Welt. Spielregeln stehen in sandbox-dims.js / sandbox-boss.js.
// =====================================================================
import { B } from "./sandbox-data.js?v=6";
import { mulberry32, hash2, fbm, smooth, clamp } from "./sandbox-noise.js?v=6";

export const W = 512, H = 192;
export const NETHER_BIOMES = ["nether", "soul_valley"];
export const NETHER_LAVA = 132;              // Lava-Spiegel im Nether
export const END_CX = W >> 1, END_TOP = 100; // Mitte und Oberkante der Hauptinsel
export const END_RIGHT = END_CX + 150;
export const END_ARRIVE = END_CX - 46;  // hier kommt man im Ende an       // Mitte der äußeren Insel mit der Endstadt

/** Beute der Truhen: [Gegenstand, min, max, Wahrscheinlichkeit] */
const FORTRESS_LOOT = [["gold_ingot", 1, 3, 0.55], ["iron_ingot", 1, 5, 0.45], ["diamond", 1, 2, 0.28], ["nether_wart", 3, 7, 0.55], ["obsidian", 2, 4, 0.3], ["flint_and_steel", 1, 1, 0.2], ["gold_sword", 1, 1, 0.14], ["enchanted_book", 1, 1, 0.14], ["glowstone_dust", 2, 6, 0.3], ["blaze_rod", 1, 2, 0.2]];
const STRONGHOLD_LOOT = [["iron_ingot", 1, 5, 0.6], ["gold_ingot", 1, 3, 0.4], ["ender_pearl", 1, 2, 0.35], ["blaze_powder", 1, 3, 0.3], ["diamond", 1, 2, 0.2], ["bread", 1, 3, 0.5], ["enchanted_book", 1, 1, 0.3], ["apple", 1, 3, 0.4], ["book", 1, 2, 0.3]];
const CITY_LOOT = [["diamond", 2, 6, 0.8], ["emerald", 2, 6, 0.7], ["gold_ingot", 3, 8, 0.8], ["iron_ingot", 4, 9, 0.8], ["diamond_sword", 1, 1, 0.25], ["enchanted_book", 1, 1, 0.5], ["ender_pearl", 1, 3, 0.4]];
function loot(table, rnd, cap = 7) {
  const out = [];
  for (const [id, a, b, p] of table) if (p > 0 && rnd() < p) out.push({ id, n: a + Math.floor(rnd() * (b - a + 1)), d: 0 });
  return out.slice(0, cap);
}

function arrays() { return { tiles: new Uint8Array(W * H), lvl: new Uint8Array(W * H), aux: new Uint8Array(W * H), ground: new Int16Array(W), biomes: new Uint8Array(W) }; }

// ---------------------------------------------------------------------
// Nether
// ---------------------------------------------------------------------
export function generateNether(seed) {
  const rnd = mulberry32((seed ^ 0x4e7e5) | 0), s2 = (seed ^ 0x77aa) | 0;
  const { tiles, lvl, aux, ground, biomes } = arrays();
  const chests = [], strongholds = [], fortresses = [];
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id) => { if (x > 0 && x < W - 1 && y > 3 && y < H - 4) tiles[y * W + x] = id; };
  const ceil = new Int16Array(W), floor = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    ceil[x] = Math.round(18 + (fbm(x * 0.03, 2.2, s2 + 1, 3) - 0.5) * 22);
    floor[x] = Math.round(132 + (fbm(x * 0.012, 8.8, s2 + 2, 4) - 0.5) * 90 + (fbm(x * 0.07, 1.1, s2 + 3, 2) - 0.5) * 8);
    biomes[x] = fbm(x * 0.012 + 40, 6.6, s2 + 4, 3) > 0.6 ? 1 : 0;
  }
  // Grundgestein-Schalen, Netherrack, Höhle, Lava-Ozean
  for (let x = 0; x < W; x++) {
    const fl = clamp(floor[x], ceil[x] + 24, H - 14);
    floor[x] = fl;
    for (let y = 0; y < H; y++) {
      let id;
      if (y <= 1 || y >= H - 2) id = B.BEDROCK;
      else if (y <= 4 && hash2(x, y, seed + 3) < (y === 2 ? 0.9 : y === 3 ? 0.55 : 0.25)) id = B.BEDROCK;
      else if (y >= H - 5 && hash2(x, y, seed + 4) < (y === H - 3 ? 0.9 : 0.4)) id = B.BEDROCK;
      else if (y < ceil[x] || y >= fl) id = B.NETHERRACK;
      else id = B.AIR;
      tiles[y * W + x] = id;
    }
    ground[x] = 0;                                        // überall sieht man die Rückwand der Höhle
  }
  // Seelensandtal und Magma am Ufer
  for (let x = 1; x < W - 1; x++) {
    const fl = floor[x], valley = biomes[x] === 1;
    if (valley) { for (let k = 0; k < 3 + (hash2(x, 5, seed) < 0.5 ? 1 : 0); k++) if (at(x, fl + k) === B.NETHERRACK) put(x, fl + k, B.SOUL_SAND); }
    else if (fl > NETHER_LAVA - 3 && fl <= NETHER_LAVA && hash2(x, 6, seed) < 0.45) put(x, fl, B.MAGMA);
  }
  // Lava-Ozean
  for (let x = 1; x < W - 1; x++) for (let y = NETHER_LAVA; y < floor[x]; y++) { tiles[y * W + x] = B.LAVA; lvl[y * W + x] = 9; }
  // Säulen von der Decke bis zum Boden
  for (let i = 0, n = 0; i < 80 && n < 16; i++) {
    const cx = 20 + Math.floor(rnd() * (W - 40)), w = 2 + Math.floor(rnd() * 4);
    if (floor[cx] > NETHER_LAVA - 6) continue;
    for (let y = ceil[cx] - 1; y <= floor[cx] + 1; y++) for (let x = cx - w; x <= cx + w; x++) {
      const wob = Math.round((hash2(x >> 1, y >> 2, seed + 11) - 0.5) * 2.4);
      if (Math.abs(x - cx) <= w + wob - (y - ceil[cx]) * 0 - Math.abs(Math.sin(y * 0.2)) * 1.2) if (at(x, y) === B.AIR) put(x, y, B.NETHERRACK);
    }
    n++;
  }
  // Zapfen an der Decke
  for (let x = 2; x < W - 2; x++) if (hash2(x, 15, seed) < 0.16) { const len = 2 + Math.floor(hash2(x, 16, seed) * 9); for (let k = 0; k < len; k++) { const w = k < len * 0.5 ? 1 : 0; for (let dx = -w; dx <= w; dx++) if (at(x + dx, ceil[x] + k) === B.AIR) put(x + dx, ceil[x] + k, B.NETHERRACK); } }
  // Schwebende Inseln
  for (let i = 0; i < 34; i++) {
    const cx = 10 + Math.floor(rnd() * (W - 20)), cy = 48 + Math.floor(rnd() * 56), rx = 4 + Math.floor(rnd() * 8), ry = 2 + Math.floor(rnd() * 3);
    for (let y = cy - ry; y <= cy + ry * 2; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = y <= cy ? (y - cy) / ry : (y - cy) / (ry * 2);
      if (dx * dx + dy * dy > 1) continue;
      if (at(x, y) === B.AIR) put(x, y, (valleyAt(x) && y <= cy + 1) ? B.SOUL_SAND : B.NETHERRACK);
    }
    if (rnd() < 0.5) for (let dx = -2; dx <= 2; dx++) if (at(cx + dx, cy + ry * 2 + 1) === B.AIR && rnd() < 0.7) put(cx + dx, cy + ry * 2 + 1, B.GLOWSTONE);
  }
  function valleyAt(x) { return biomes[clamp(x, 0, W - 1)] === 1; }
  // Glowstone-Trauben an der Decke
  for (let i = 0; i < 46; i++) {
    const cx = 6 + Math.floor(rnd() * (W - 12)), cy = ceil[cx], r = 1.4 + rnd() * 1.8;
    for (let y = cy - 1; y <= cy + 4; y++) for (let x = cx - 3; x <= cx + 3; x++) {
      if (Math.hypot(x - cx, (y - cy) * 0.9) <= r + (hash2(x, y, seed + 21) - 0.5) && y >= ceil[clamp(x, 0, W - 1)] - 1) put(x, y, B.GLOWSTONE);
    }
  }
  // Erze im Netherrack
  const vein = (type, count, size) => {
    for (let i = 0; i < count; i++) {
      let cx = Math.floor(rnd() * W), cy = 6 + Math.floor(rnd() * (H - 14));
      const n = size[0] + Math.floor(rnd() * (size[1] - size[0] + 1));
      for (let k = 0; k < n; k++) {
        if (cx > 0 && cx < W - 1 && cy > 4 && cy < H - 5 && at(cx, cy) === B.NETHERRACK) put(cx, cy, type);
        const d = Math.floor(rnd() * 4); cx += d === 0 ? 1 : d === 1 ? -1 : 0; cy += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
  };
  vein(B.QUARTZ_ORE, 420, [3, 6]); vein(B.NETHER_GOLD, 240, [2, 5]);
  // Netherfestungen
  const fortress = (fx, len, fy) => {
    // Platz freiräumen: Gang 5 hoch, darüber Dach, darunter Boden zwei dick
    for (let x = fx - 1; x <= fx + len; x++) for (let y = fy - 7; y <= fy + 1; y++) put(x, y, B.AIR);
    for (let x = fx - 1; x <= fx + len; x++) for (let y = fy - 7; y <= fy + 1; y++) if (tiles[y * W + x] === B.LAVA) lvl[y * W + x] = 0;
    for (let x = fx; x < fx + len; x++) {
      put(x, fy, B.NETHER_BRICK); put(x, fy + 1, B.NETHER_BRICK);                           // Boden
      const open = x < fx + 10 || x >= fx + len - 10;                                         // an den Enden offene Brücke mit Brüstung
      if (!open) { put(x, fy - 6, B.NETHER_BRICK); put(x, fy - 7, B.NETHER_BRICK); }        // Dach
      else if (x % 3 === 0) put(x, fy - 1, B.NETHER_BRICK);                                   // Zinnen
      if (!open && (x - fx) % 9 === 4) for (let y = fy - 5; y <= fy - 1; y++) { put(x, y, B.NETHER_BRICK); put(x + 1, y, B.NETHER_BRICK); }   // Stützpfeiler im Gang... mit Durchgang
      if (!open && (x - fx) % 9 === 4) { put(x, fy - 1, B.AIR); put(x + 1, fy - 1, B.AIR); put(x, fy - 2, B.AIR); put(x + 1, fy - 2, B.AIR); put(x, fy - 3, B.AIR); put(x + 1, fy - 3, B.AIR); }
      // Stützen nach unten bis zum Boden oder zur Lava
      if ((x - fx) % 8 === 0) for (let y = fy + 2; y < H - 5 && (at(x, y) === B.AIR || at(x, y) === B.LAVA); y++) { put(x, y, B.NETHER_BRICK); put(x + 1, y, B.NETHER_BRICK); }
    }
    for (let y = fy - 7; y <= fy + 1; y++) { put(fx - 1, y, B.NETHER_BRICK); put(fx + len, y, B.NETHER_BRICK); }
    // Wald aus Netherwarzen auf Seelensand in der Mitte
    const mid = fx + Math.floor(len / 2);
    for (let x = mid - 5; x <= mid + 5; x++) { put(x, fy, B.SOUL_SAND); if (x > mid - 5 && x < mid + 5) { put(x, fy - 1, B.WART); aux[(fy - 1) * W + x] = 3; } }
    // Lohenspawner an einem Ende
    const sx = fx + len - 12;
    put(sx, fy - 1, B.SPAWNER); put(sx - 1, fy - 1, B.NETHER_BRICK); put(sx + 1, fy - 1, B.NETHER_BRICK);
    // Truhen
    for (const cx of [fx + 14, fx + len - 18, mid + 9]) { put(cx, fy - 1, B.CHEST); chests.push({ x: cx, y: fy - 1, items: loot(FORTRESS_LOOT, rnd) }); }
    fortresses.push({ x: fx, len, y: fy, spawner: { x: sx, y: fy - 1 } });
  };
  const fxs = [];
  for (let i = 0, n = 0; i < 80 && n < 3; i++) {
    const len = 62 + Math.floor(rnd() * 30), fx = 40 + Math.floor(rnd() * (W - 80 - len));
    if (fxs.some(q => Math.abs(q - fx) < len + 80)) continue;
    fxs.push(fx); fortress(fx, len, 92 + Math.floor(rnd() * 14)); n++;
  }
  // Wasser und flüssige Reste gibt es hier nicht; Lava-Zellen brauchen einen Wert
  for (let i = 0; i < W * H; i++) { if (tiles[i] === B.LAVA && !lvl[i]) lvl[i] = 9; }
  return { tiles, lvl, aux, ground, biomes, chests, fortresses, strongholds };
}

// ---------------------------------------------------------------------
// Das Ende
// ---------------------------------------------------------------------
export const END_PILLARS = [-38, -31, -24, -17, -10, 10, 17, 24, 31, 38];
export function generateEnd(seed) {
  const rnd = mulberry32((seed ^ 0x3d1e) | 0);
  const { tiles, lvl, aux, ground, biomes } = arrays();
  const chests = [], crystals = [], gateways = {};
  const put = (x, y, id) => { if (x > 0 && x < W - 1 && y > 0 && y < H - 1) tiles[y * W + x] = id; };
  const isle = (cx, top, r, th) => {
    for (let dx = -r; dx <= r; dx++) {
      const k = 1 - Math.pow(Math.abs(dx) / (r + 0.5), 2.2), t = Math.round(th * Math.pow(Math.max(0, k), 0.85) + (hash2(cx + dx, 3, seed) - 0.5) * 2);
      for (let y = top; y < top + Math.max(1, t); y++) put(cx + dx, y, B.END_STONE);
    }
  };
  isle(END_CX, END_TOP, 42, 22);
  isle(END_RIGHT, END_TOP - 2, 16, 10);
  isle(END_CX - 150, END_TOP + 3, 12, 8);
  ground.fill(H + 30);
  // Obsidiansäulen
  END_PILLARS.forEach((dx, i) => {
    const cx = END_CX + dx, h = 12 + Math.floor(hash2(i, 5, seed) * 20), w = h > 24 ? 1 : 1;
    for (let y = END_TOP - h; y < END_TOP; y++) for (let x = cx - w; x <= cx + w; x++) put(x, y, B.OBSIDIAN);
    crystals.push({ x: cx + 0.5, y: END_TOP - h, cage: h > 26 });
    if (h > 26) { for (let x = cx - 2; x <= cx + 2; x++) { put(x, END_TOP - h - 4, B.GLASS); } for (const dx2 of [-2, 2]) for (let y = END_TOP - h - 3; y < END_TOP - h; y++) put(cx + dx2, y, B.GLASS); put(cx - 2, END_TOP - h - 3, B.GLASS); }
  });
  // Endstadt-Turm auf der rechten Insel: Purpur, drei Stockwerke, Leitern, Truhen
  const tower = (x0, top, floors) => {
    const w = 7, fh = 5, hh = floors * fh;
    for (let y = top - hh - 1; y < top; y++) for (let x = x0; x < x0 + w; x++) {
      const wall = x === x0 || x === x0 + w - 1, fl = (top - y - 1) % fh === 0 && y < top - 1, roof = y === top - hh - 1;
      put(x, y, wall || roof || (fl && x !== x0 + 1) ? B.PURPUR : B.AIR);
    }
    for (let y = top - hh; y < top; y++) put(x0 + 1, y, B.LADDER);
    put(x0 + 3, top - hh - 2, B.AIR);
    for (const wy of [top - 3, top - fh - 3, top - 2 * fh - 3]) { put(x0 + w - 1, wy, B.GLASS); put(x0, wy, B.GLASS); }
    for (let x = x0; x < x0 + w; x++) if (x % 2 === 0) put(x, top - hh - 2, B.PURPUR);        // Zinnen
    put(x0 + 4, top - 1, B.CHEST); chests.push({ x: x0 + 4, y: top - 1, items: loot(CITY_LOOT, rnd) });
    put(x0 + 4, top - hh + 3 - fh * 0, B.AIR);
    const topFloorY = top - hh + (fh - 1);
    put(x0 + 5, top - (floors - 1) * fh - 2, B.CHEST); chests.push({ x: x0 + 5, y: top - (floors - 1) * fh - 2, items: [{ id: "elytra", n: 1, d: 0 }, ...loot(CITY_LOOT, rnd, 4)] });
    void topFloorY;
  };
  tower(END_RIGHT - 8, END_TOP - 2, 3);
  // zweiter, kleiner Turm auf der linken Insel mit Truhe
  tower(END_CX - 154, END_TOP + 3, 2);
  // Tor der äußeren Insel (führt zurück zur Hauptinsel): zwei Blöcke hoch auf Grundgestein
  gateways.right = { x: END_RIGHT + 8, y: END_TOP - 4 };
  put(gateways.right.x, END_TOP - 2, B.BEDROCK);
  put(gateways.right.x, END_TOP - 3, B.GATEWAY); put(gateways.right.x, END_TOP - 4, B.GATEWAY);
  // Ankunftsplattform am linken Rand der Hauptinsel (Obsidian), darüber frei
  for (let x = END_CX - 50; x <= END_CX - 41; x++) { put(x, END_TOP, B.OBSIDIAN); for (let y = END_TOP - 5; y < END_TOP; y++) put(x, y, B.AIR); }
  return { tiles, lvl, aux, ground, biomes, chests, crystals, gateways };
}

// ---------------------------------------------------------------------
// Festung in der Oberwelt
// ---------------------------------------------------------------------
/** Baut einen versiegelten Raum mit Endportal-Rahmen tief im Gestein. Liefert Beschreibung + Truhen. */
export function placeStronghold(seed, tiles, lvl, aux, spawnX, surf) {
  const rnd = mulberry32((seed ^ 0x5712) | 0);
  let cx = 60 + Math.floor(rnd() * (W - 120));
  for (let tries = 0; tries < 30 && Math.abs(cx - spawnX) < 140; tries++) cx = 60 + Math.floor(rnd() * (W - 120));
  if (Math.abs(cx - spawnX) < 140) cx = spawnX + (spawnX > W / 2 ? -150 : 150);
  const yf = surf + 90 + Math.floor(rnd() * 8);                    // oberste freie Reihe über dem Boden
  const x0 = cx - 11, x1 = cx + 11, y0 = yf - 9, y1 = yf + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, wall = x === x0 || x === x1 || y === y0 || y === y1;
    tiles[i] = wall ? B.BRICK : B.AIR; lvl[i] = 0; aux[i] = 0;
  }
  const frames = [];
  const setFrame = (x, y) => { tiles[y * W + x] = B.FRAME; aux[y * W + x] = rnd() < 0.15 ? 1 : 0; frames.push({ x, y }); };
  setFrame(cx - 2, yf); setFrame(cx + 2, yf);                       // links und rechts der Grube
  for (let x = cx - 1; x <= cx + 1; x++) setFrame(x, y1);           // drei im Boden darunter
  if (frames.every(f => aux[f.y * W + f.x] === 1)) aux[frames[0].y * W + frames[0].x] = 0;
  // Einrichtung: Säulen mit Fackeln, Truhe
  for (const dx of [-8, 8]) { for (let y = yf - 4; y <= yf; y++) tiles[y * W + cx + dx] = B.BRICK; tiles[(yf - 5) * W + cx + dx] = B.TORCH; }
  for (const dx of [-10, 10]) tiles[(yf - 4) * W + cx + dx] = B.TORCH;
  tiles[yf * W + cx - 5] = B.CHEST;
  return { x: cx, y: yf, frames, chests: [{ x: cx - 5, y: yf, items: loot(STRONGHOLD_LOOT, rnd) }] };
}
