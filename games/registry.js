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
    id: "aufbau",
    title: "ASCII-Aufbauspiel",
    emoji: "🏘️",
    desc: "Ein kleines Aufbauspiel nur aus Zeichen – das bauen wir als Nächstes selbst.",
    soon: true
  }
];
