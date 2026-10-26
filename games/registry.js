// =====================================================================
// Spiele-Katalog. Neues Spiel = ein Eintrag hier + eine Datei mit  export function mount(root, ctx) { … return { destroy() } }
//   id       kurz, nur a-z 0-9 und „-“ (steht in der Adresse: #/games/tetris)
//   load     lädt das Spiel erst beim Öffnen
//   summary  Zeile auf der Karte aus dem gespeicherten Stand (oder leer)
//   merge    optional: zwei Stände zusammenführen (z. B. von zwei PCs) – ohne merge gewinnt der neuere
//   soon     true = steht schon im Katalog, ist aber noch nicht spielbar
// =====================================================================
import { summary as worldsSummary, mergeRecords } from "./sandbox-worlds.js?v=10";

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
    desc: "Abbauen, handwerken, bauen, kämpfen, Felder bestellen, Redstone-Schaltungen und Tränke brauen – eine hohe Pixelwelt mit Schneebergen, tiefen Höhlen (Tropfstein, Geoden, Moos und Glühbeeren), Kirschhain, Mangroven und Bambuswald, Tieren, Monstern, Tag und Nacht. Durch Portale geht es in den Nether und ins Ende zu Enderdrache und Wither. Dein Dorf wartet schon auf dich – mit Dorfbewohnern zum Handeln, Überfällen, Karten zu Waldvilla und Ozeanmonument, dem Gesprenkelten Wald, verlassenen Lagern und Wolle, Beton und Kissen in 16 Farben. Neu: Granit, Diorit und Andesit, Terrakotta und Banner mit Webstuhl-Mustern, Holzsätze aller Baumarten, Steinsäge, Schleifstein, Schmiedetisch mit Rüstungsverzierungen, Räucher- und Schmelzofen, Kupfer (das altert und sich wachsen lässt), Kerzen, Schilder, Rüstungsständer, Schleim- und Honigblöcke. Kampf 2.0: Abklingzeit, Schwungangriff und kritische Treffer, Schilde (und Äxte, die sie entwaffnen), eine zweite Hand für Schild und Fackel, Zeit- und Spektralpfeile, verweilende Tränke, Armbrust mit Mehrfachschuss, Durchschlag und Schnellladen – auch mit Feuerwerk. Ozean: Unterwasserleben mit Tang, Seegras, Seegurken und Korallenriffen in warmen Meeren, Schiffswracks, vergrabene Schätze (mit Schatzkarte), Ozeanmonumente mit Wächtern, Ältestem Wächter und Schwämmen, Delfine, Schildkröten (Eier, Panzer), Kugelfische, Tintenfische, Axolotl und Ertrunkene, Blasensäulen, der Dreizack (werfen, Treue, Sog, Blitz) und der Leitstrom. Tiere 2.0: Reiten und Sattel, Vertrauen und Flug-KI – Eisbär, Eiswanderer und Wüstenzombie, Lama mit Karawane und Spucke, Panda, Fuchs, Biene mit Bienenstock, Honigwabe und Honigflasche, Ziege mit Rammen und Ziegenhorn, Frosch mit Froschlicht, Allay, Kamel, Schnüffler mit Ei und Samensuche sowie der Phantom bei Schlafmangel. Mit Regen, Schnee und Gewitter, Mondphasen, Ton und Musik, Kreativmodus, Befehlen, mehreren Welten und Gamepad.",
    load: () => import("./sandbox.js?v=13"),
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
