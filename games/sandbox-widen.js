// =====================================================================
// Blockdorf – alte Welten wachsen mit (Etappe 13)
//   Ein Spielstand der Breite 512 wird links in die neue, viel breitere Welt gesetzt (siehe sandbox-migrate.js). Hier wird die Welt
//   rechts davon mit frisch erzeugtem Gelände derselben Zahl (seed) gefüllt: Blöcke, Biome, Dörfer, Bauwerke und Truhen. An der Naht
//   gleicht eine Rampe die Höhen an, damit keine Steilwand entsteht (liegt ein Bauwerk im Weg, bleibt die Naht, wie sie ist).
//   Nether: gleiches Verfahren für die neuen Spalten. Tiere und Dorfbewohner der neuen Gebiete kommen mit der Zeit von selbst.
// =====================================================================
import { B } from "./sandbox-data.js?v=10";
import { H, W, SEA } from "./sandbox-const.js?v=10";

export const SEAM = 44;                                   // so viele Spalten rechts der Naht werden angeglichen
const smooth01 = t => t * t * (3 - 2 * t);

export function installWiden(Sandbox, K) {
  const P = Sandbox.prototype;

  /** Welt rechts von Spalte pad auffüllen (vor _fresh); merkt sich, was danach noch zu tun ist */
  P._padFill = function (pad) {
    const g = this._genFull();
    const cols = (dst, src, rows) => { for (let y = 0; y < rows; y++) dst.set(src.subarray(y * W + pad, (y + 1) * W), y * W + pad); };
    cols(this.tiles, g.tiles, H); cols(this.lvl, g.lvl, H); cols(this.aux, g.aux, H);
    for (let x = pad; x < W; x++) { this.ground[x] = g.ground[x]; this.biomes[x] = g.biomes[x]; }
    // Naht: Gelände angleichen, falls dort nichts gebaut wurde
    const zone0 = pad - 14, zone1 = pad + SEAM + 14;
    const busy = [...(g.villages || []), ...(g.structs || []), ...(g.chests || [])].some(o => o.x >= zone0 && o.x <= zone1);
    if (!busy) this._seam(pad, g);
    this._pad = {
      from: pad,
      villages: (g.villages || []).filter(v => v.x >= pad),
      structs: (g.structs || []).filter(s => s.x >= pad),
      chests: (g.chests || []).filter(c => c.x >= pad)
    };
  };

  P._seam = function (pad, g) {
    const tiles = this.tiles, lvl = this.lvl, aux = this.aux, ground = this.ground;
    const g0 = ground[pad - 1];
    for (let k = 0; k < SEAM; k++) {
      const x = pad + k, g1 = ground[x];
      const t = smooth01((k + 1) / (SEAM + 1)), gt = Math.round(g0 + (g1 - g0) * t);
      if (gt === g1) continue;
      const top = tiles[g1 * W + x], under = tiles[Math.min(H - 1, g1 + 1) * W + x];
      const topId = top === B.WATER || top === B.AIR ? B.SAND : top;
      if (gt < g1) {                                                            // Gelände muss höher werden: auffüllen
        for (let y = gt; y < g1; y++) { const i = y * W + x; tiles[i] = y === gt ? topId : (y < gt + 4 ? (under === B.AIR || under === B.WATER ? B.DIRT : under) : B.STONE); lvl[i] = 0; aux[i] = 0; }
      } else {                                                                  // tiefer: abtragen
        for (let y = g1; y < gt; y++) { const i = y * W + x; tiles[i] = B.AIR; lvl[i] = 0; aux[i] = 0; }
        const i = gt * W + x; tiles[i] = topId; lvl[i] = 0; aux[i] = 0;
      }
      // darüber alles freiräumen (Bäume, Pflanzen); unter dem Meeresspiegel steht Wasser
      for (let y = Math.max(1, Math.min(g1, gt) - 42); y < gt; y++) {
        const i = y * W + x;
        if (y >= SEA) { tiles[i] = B.WATER; lvl[i] = 8; } else { tiles[i] = B.AIR; lvl[i] = 0; }
        aux[i] = 0;
      }
      ground[x] = gt;
    }
  };

  /** Nach _fresh / _villLoad: Truhen füllen, Dörfer und Bauwerke eintragen, Dorfbewohner ansiedeln */
  P._padAfter = function () {
    const p = this._pad; if (!p) return;
    this._pad = null;
    this._stockChests(this.ents, p.chests);
    for (const v of p.villages) {
      this.villages.push(v);
      [-17, 0, 16].forEach((dx, i) => this.villagers.push(this._newVillager(v.x + dx + 1.6, v.y - 1.7 - 0.001, v.x + dx + 3, (this.villagers.length + i) % 6)));
    }
    this.structs = [...(this.structs || []), ...p.structs.map(s => ({ ...s }))];
  };

  /** Nether / Ende aus alter Breite: neue Spalten rechts erzeugen (aufgerufen von _unpackDim) */
  P._padDim = function (n, s, pad) {
    const g = this._genDim(n);
    const cols = (dst, src) => { for (let y = 0; y < H; y++) dst.set(src.subarray(y * W + pad, (y + 1) * W), y * W + pad); };
    cols(s.tiles, g.tiles); cols(s.lvl, g.lvl); cols(s.aux, g.aux);
    for (let x = pad; x < W; x++) { s.ground[x] = g.ground[x]; s.biomes[x] = g.biomes[x]; }
    for (const [k, e] of g.ents) { const x = +k.split(",")[0]; if (x >= pad) s.ents.set(k, e); }
  };
}
