// =====================================================================
// Spiele-Katalog. Neues Spiel = ein Eintrag hier + eine Datei mit  export function mount(root, ctx) { … return { destroy() } }
//   id       kurz, nur a-z 0-9 und „-“ (steht in der Adresse: #/games/tetris)
//   load     lädt das Spiel erst beim Öffnen
//   summary  Zeile auf der Karte aus dem gespeicherten Stand (oder leer)
//   merge    optional: zwei Stände zusammenführen (z. B. von zwei PCs) – ohne merge gewinnt der neuere
//   soon     true = steht schon im Katalog, ist aber noch nicht spielbar
// =====================================================================
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
    desc: "Abbauen, handwerken, bauen – eine Pixelwelt mit Höhlen, Erzen, Tag und Nacht. Dein Dorf wartet schon auf dich.",
    load: () => import("./sandbox.js?v=2"),
    summary: r => r && r.day ? "Tag " + r.day + " · " + fmt(r.mined || 0) + " abgebaut · " + fmt(r.built || 0) + " gebaut" : "Neue Welt"
  },
  {
    id: "zivilisation",
    title: "Zivilisation",
    emoji: "🏛️",
    desc: "Ein Rundenstrategiespiel: Städte gründen, Forschung, Handel und Reiche – das bauen wir als Nächstes.",
    soon: true
  }
];
