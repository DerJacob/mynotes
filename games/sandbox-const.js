// =====================================================================
// Blockdorf – gemeinsame Maße der Welt (ab Etappe 8)
//   Die Oberwelt ist 256 Blöcke hoch (wie Minecraft ab 1.18: von Y=-64 bis Y=192), die Oberfläche der Ebenen liegt bei SURF.
//   Nether und Ende haben weiter ihr altes Maß (NH = 192 Zeilen oben); darunter liegt nur Grundgestein bzw. Leere.
//   Die Höhe über dem Boden zählt in den Spielregeln immer relativ zu SURF – so bleibt die Tiefe unter der Oberfläche gleich.
// =====================================================================
export const OLD_W = 512;                // Breite der Welten bis Etappe 12 (Spielstand-Version ≤ 13)
export const W = 2560;                   // Breite aller Welten (ab Etappe 13: fünf Mal so breit, Biome drei Mal so breit)
export const WK = W / OLD_W;             // Faktor für Anzahlen (Höhlen, Erze, Bauwerke …), damit die Dichte gleich bleibt
export const BIOME_SCALE = 3;            // so viel breiter sind Klimazonen und Biome als früher
export const H = 256;                    // Höhe aller Welten (Zeilen)
export const OLD_H = 192;                // Höhe der Welten bis Etappe 7 (Spielstand-Version ≤ 8)
export const NH = 192;                   // Höhe, in der Nether und Ende erzeugt werden
export const SURF = 124;                 // Oberfläche der Ebenen
export const SPAWN_X = W >> 1;
export const SEA = SURF + 4;             // Wasserspiegel
export const DEEP = SURF + 72;           // ab hier Tiefenschiefer
export const BOTTOM = H - 5;             // darunter nur noch Grundgestein
/** Minecraft-Höhe (Y) einer Zeile: Y=-64 ganz unten, Meeresspiegel bei 64 */
export const mcY = y => 192 - y;
