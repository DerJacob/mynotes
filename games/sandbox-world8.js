// =====================================================================
// Blockdorf – Weltzusatz (Etappe 8)
//   Läuft nach addContent6() mit eigenem Zufall (seed + 8008).
//   Üppige Höhlen (Moos, Azaleenbäume, Höhlenranken mit Glühbeeren, Leuchtflechte, Ton),
//   Tropfsteinhöhlen (Tropfsteinblöcke, Stalagmiten und Stalaktiten), Tuffadern, Amethyst-Geoden,
//   Fossilien in der Wüste (Rippen und Schädel), Pulverschnee auf den Hängen.
// Alles in der Seitenansicht; gleiche Zahl → gleiche Welt.
// =====================================================================
import { B } from "./sandbox-data.js?v=8";
import { mulberry32, hash2, fbm } from "./sandbox-noise.js?v=8";
import { BIOMES } from "./sandbox-world.js?v=8";
import { azaleaTree } from "./sandbox-trees8.js?v=8";
import { W, H, SURF, SPAWN_X } from "./sandbox-const.js?v=8";

const STONEISH = new Set([B.STONE, B.DEEPSLATE, B.TUFF, B.DIRT, B.GRAVEL, B.CALCITE, B.SANDSTONE, B.DRIPSTONE, B.CLAY]);

export function addContent8(w, seed) {
  const rnd = mulberry32((seed ^ 0x8e8) + 8008);
  const { tiles, ground, biomes, lvl } = w;
  const aux = w.aux || (w.aux = new Uint8Array(W * H));
  const structs = w.structs || (w.structs = []);
  const BOT = H - 8;
  const BI = Object.fromEntries(BIOMES.map((b, i) => [b, i]));
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H ? B.BEDROCK : tiles[y * W + x]);
  const put = (x, y, id) => { if (x > 0 && x < W - 1 && y > 1 && y < H - 3) { const i = y * W + x; tiles[i] = id; lvl[i] = 0; aux[i] = 0; } };
  const solidStone = id => STONEISH.has(id);
  const nearVillage = x => Math.abs(x - SPAWN_X) < 30 || w.villages.some(v => Math.abs(v.x - x) < 28);
  const colOk = x => biomes[x] !== BI.ocean && !nearVillage(x);
  const depthOf = (x, y) => y - ground[x];

  // ---------- Tuff: Adern im Gestein, vor allem tief unten ----------
  for (let i = 0; i < 70; i++) {
    const cx = Math.floor(rnd() * W), cy = SURF + 26 + Math.floor(rnd() * (BOT - SURF - 40)), rx = 2.5 + rnd() * 4.5, ry = 1.6 + rnd() * 2.6;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 + (hash2(x, y, seed + 81) - 0.5) * 0.4) continue;
      const t = at(x, y); if (t === B.STONE || t === B.DEEPSLATE) put(x, y, B.TUFF);
    }
  }

  // ---------- Geoden: Kalzit außen, Amethyst innen, hohl ----------
  for (let i = 0, made = 0; i < 160 && made < 9; i++) {
    const R = 3.6 + rnd() * 2.2, cx = 12 + Math.floor(rnd() * (W - 24)), cy = SURF + 34 + Math.floor(rnd() * (BOT - SURF - 50));
    if (!colOk(cx)) continue;
    let air = 0, n = 0;
    for (let y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R + 1); y++) for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) { n++; const t = at(x, y); if (t === B.AIR || t === B.WATER || t === B.LAVA) air++; }
    if (air > n * 0.04) continue;
    for (let y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R + 1); y++) for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) {
      const d = Math.hypot((x - cx) * 1.0, (y - cy) * 1.1);
      if (d > R + 1) continue;
      put(x, y, d > R ? B.CALCITE : d > R - 1.1 ? B.AMETHYST_BLOCK : B.AIR);
    }
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      if (at(x, y) === B.AIR && at(x, y + 1) === B.AMETHYST_BLOCK && rnd() < 0.45) put(x, y, B.AMETHYST_CLUSTER);
    }
    structs.push({ kind: "geode", x: Math.round(cx), y: Math.round(cy) });
    made++;
  }

  // ---------- Üppige Höhlen und Tropfsteinhöhlen ----------
  const lush = (x, y) => fbm(x * 0.016 + 20, y * 0.021 + 7, seed + 801, 3) > 0.63;
  const drip = (x, y) => fbm(x * 0.017 + 90, y * 0.022 + 40, seed + 811, 3) > 0.645;
  const airLike = t => t === B.AIR;
  const treeEnv = { put: (x, y, id) => { if (at(x, y) === B.AIR) put(x, y, id); }, air: (x, y) => at(x, y) === B.AIR, rnd };
  for (let pass = 0; pass < 2; pass++) for (let x = 2; x < W - 2; x++) {
    if (!colOk(x)) continue;
    for (let y = ground[x] + 14; y < BOT - 24; y++) {
      const t = tiles[y * W + x];
      const isLush = lush(x, y), isDrip = !isLush && drip(x, y);
      if (!isLush && !isDrip) continue;
      if (t !== B.AIR) {
        // Wände der Höhle: Moos bzw. Tropfstein (erster Durchgang)
        if (pass !== 0 || !solidStone(t) || t === B.CLAY) continue;
        const open = airLike(at(x, y - 1)) || airLike(at(x, y + 1)) || airLike(at(x - 1, y)) || airLike(at(x + 1, y));
        if (!open) continue;
        if (isLush) { if (hash2(x, y, seed + 82) < (airLike(at(x, y - 1)) ? 0.4 : 0.7)) put(x, y, hash2(x, y, seed + 83) < 0.05 ? B.CLAY : B.MOSS_BLOCK); }
        else if (hash2(x, y, seed + 84) < 0.65) put(x, y, B.DRIPSTONE);
        continue;
      }
      if (pass !== 1) continue;                                           // zweiter Durchgang: Schmuck in den Hohlräumen
      const below = tiles[(y + 1) * W + x], above = tiles[(y - 1) * W + x];
      if (isLush) {
        if (below === B.MOSS_BLOCK || below === B.CLAY) {
          const r = hash2(x, y, seed + 85);
          if (r < 0.2) put(x, y, B.MOSS_CARPET);
          else if (r < 0.25) put(x, y, B.AZALEA);
          else if (r < 0.275) put(x, y, B.FLOWERING_AZALEA);
          else if (r < 0.29 && below === B.MOSS_BLOCK && y > 12 && [2, 3, 4, 5, 6, 7].every(k => at(x, y - k) === B.AIR)) azaleaTree(treeEnv, x, y + 1);
        } else if (above === B.MOSS_BLOCK && hash2(x, y, seed + 86) < 0.3) {
          const len = 1 + Math.floor(hash2(x, y, seed + 87) * 6);
          for (let k = 0; k < len && at(x, y + k) === B.AIR; k++) put(x, y + k, k === len - 1 && hash2(x, y + k, seed + 88) < 0.6 ? B.CAVE_VINES_BERRIES : B.CAVE_VINES);
        } else if ((solidStone(above) || solidStone(at(x - 1, y)) || solidStone(at(x + 1, y))) && hash2(x, y, seed + 89) < 0.05) put(x, y, B.GLOW_LICHEN);
      } else {
        if ((below === B.DRIPSTONE || below === B.STONE || below === B.DEEPSLATE) && hash2(x, y, seed + 90) < 0.17) {
          put(x, y, B.STALAGMITE);
        } else if ((above === B.DRIPSTONE || above === B.STONE || above === B.DEEPSLATE) && hash2(x, y, seed + 91) < 0.17) {
          const len = 1 + (hash2(x, y, seed + 92) < 0.4 ? 1 : 0) + (hash2(x, y, seed + 93) < 0.15 ? 1 : 0);
          for (let k = 0; k < len && at(x, y + k) === B.AIR; k++) put(x, y + k, B.STALACTITE);
        }
      }
    }
  }

  // ---------- Fossilien in der Wüste ----------
  {
    const desertCols = []; for (let x = 0; x < W; x++) if (biomes[x] === BI.desert && !nearVillage(x)) desertCols.push(x);
    const want = desertCols.length >= 16 ? 1 + Math.floor(desertCols.length / 70) : 0;
    for (let i = 0, made = 0; i < 80 && made < want; i++) {
      const L = 11 + Math.floor(rnd() * 6), x0 = desertCols[Math.floor(rnd() * desertCols.length)] - (L >> 1);
      if (x0 < 4 || x0 + L + 4 >= W - 4) continue;
      let allDesert = true; for (let x = x0; x < x0 + L + 3; x++) if (biomes[x] !== BI.desert) { allDesert = false; break; }
      if (!allDesert) continue;
      const y = Math.max(...ground.slice(x0, x0 + L + 3)) + 9 + Math.floor(rnd() * 8);
      const bone = (x, yy) => { const t = at(x, yy); if (t !== B.WATER && t !== B.LAVA && t !== B.BEDROCK) put(x, yy, rnd() < 0.14 ? B.COAL : B.FOSSIL); };
      for (let k = 0; k < L; k++) bone(x0 + k, y);                                          // Wirbelsäule
      for (let k = 2; k < L - 1; k += 2) { const h = 2 + Math.min(k, L - k) / 3 | 0; for (let j = 1; j <= Math.min(4, h); j++) bone(x0 + k + (j > 2 ? (k < L / 2 ? -1 : 1) : 0), y + j); }   // Rippen
      for (let j = -1; j <= 1; j++) for (let k = 0; k < 3; k++) if (!(j === 0 && k === 1)) bone(x0 + L + k, y + j);                                   // Schädel mit Augenhöhle
      structs.push({ kind: "fossil", x: x0 + (L >> 1), y });
      made++;
    }
  }

  // ---------- Pulverschnee auf Hängen und Gipfeln ----------
  for (let x = 2; x < W - 2; x++) {
    const b = biomes[x];
    if (b !== BI.snowy_slopes && b !== BI.jagged_peaks && b !== BI.grove) continue;
    if (hash2(x >> 2, 3, seed + 94) > (b === BI.grove ? 0.1 : 0.22)) continue;
    const g = ground[x];
    for (let y = g; y < g + (b === BI.grove ? 2 : 4); y++) { const t = at(x, y); if (t === B.SNOW || t === B.GRASS_SNOW || t === B.PACKED_ICE || (y > g + 1 && t === B.STONE)) put(x, y, B.POWDER_SNOW); }
  }
  return w;
}
