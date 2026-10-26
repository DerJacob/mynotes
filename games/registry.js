// =====================================================================
// Spiele-Katalog. Neues Spiel = ein Eintrag hier + eine Datei mit  export function mount(root, ctx) { … return { destroy() } }
//   id       kurz, nur a-z 0-9 und „-“ (steht in der Adresse: #/games/tetris)
//   load     lädt das Spiel erst beim Öffnen
//   summary  Zeile auf der Karte aus dem gespeicherten Stand (oder leer)
//   merge    optional: zwei Stände zusammenführen (z. B. von zwei PCs) – ohne merge gewinnt der neuere
//   soon     true = steht schon im Katalog, ist aber noch nicht spielbar
// =====================================================================
import { summary as worldsSummary, mergeRecords } from "./sandbox-worlds.js?v=7";

const fmt = n => new Intl.NumberFormat("de-DE").format(n);

export const GAMES = [
  {
    id: "tetris",
    title: "Tetris",
    emoji: "🧱",
    desc: "Steine drehen, Reihen füllen. Mit Halten, Schatten-Stein und Steuerung per Tastatur oder Touch.",
    load: () => import("./tetris.js?v=1"),
    summary: r => r && r.best ? "Rekord " + fmt(r.best) + " · " + fmt(r.played || 0) + (r.played === 1 ? " Spiel" : " Spiele") : "Noch kein Rekord",
    merge: (a, b) => ({
      best: Math.max(a.best || 0, b.best || 0),
      bestLines: Math.max(a.bestLines || 0, b.bestLines || 0),
      played: Math.max(a.played || 0, b.played || 0)
    })
  },
  {
    id: "sandbox",
    title: "Blockdorf",
    emoji: "⛏️",
    desc: "Abbauen, handwerken, bauen, kämpfen, Felder bestellen, Redstone-Schaltungen und Tränke brauen – eine Pixelwelt mit Höhlen, Tieren, Monstern, Tag und Nacht. Durch Portale geht es in den Nether und ins Ende zu Enderdrache und Wither. Dein Dorf wartet schon auf dich – mit Dorfbewohnern zum Handeln, Überfällen, Karten zu Waldvilla und Ozeanmonument, dem Gesprenkelten Wald, verlassenen Lagern und Wolle, Beton und Kissen in 16 Farben. Mit Regen, Schnee und Gewitter, Mondphasen, Ton und Musik, Kreativmodus, Befehlen, mehreren Welten und Gamepad.",
    load: () => import("./sandbox.js?v=7"),
    summary: worldsSummary,
    merge: mergeRecords
  },
  {
    id: "zivilisation",
    title: "Zivilisation",
    emoji: "🏛️",
    desc: "Ein Rundenstrategiespiel: Städte gründen, Forschung, Handel und Reiche – das bauen wir als Nächstes.",
    soon: true
  }
];
