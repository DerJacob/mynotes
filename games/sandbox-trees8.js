// =====================================================================
// Blockdorf – Bäume und Pflanzen der Etappe 8 (Weltgenerator und Wachstum teilen sich diese Formen)
//   env = { put(x, y, id), air(x, y), rnd() }   gy = Reihe der obersten festen Bodenzeile (der Baum beginnt eine Zeile darüber)
// =====================================================================
import { B } from "./sandbox-data.js?v=9";

const blob = (env, cx, cy, rx, ry, id, cut = 0.2, alt = null, altP = 0) => {
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
    if ((dx / rx) ** 2 + (dy / ry) ** 2 > 1 + cut) continue;
    if (env.air(cx + dx, cy + dy)) env.put(cx + dx, cy + dy, alt !== null && env.rnd() < altP ? alt : id);
  }
};

/** Kirschbaum: kurzer, kräftiger Stamm, breite rosa Krone */
export function cherryTree(env, x, gy) {
  const th = 4 + Math.floor(env.rnd() * 3), lean = env.rnd() < 0.5 ? -1 : 1;
  for (let i = 1; i <= th; i++) env.put(x, gy - i, B.CHERRY_LOG);
  const bx = x + lean * 2, by = gy - th - 1;
  for (let i = 0; i < 2; i++) env.put(x + lean * (i + 1), gy - th + 1 - i, B.CHERRY_LOG);       // Ast
  blob(env, x, gy - th - 1, 3.4, 2.1, B.CHERRY_LEAVES, 0.15);
  blob(env, bx, by - 1, 2.6, 1.7, B.CHERRY_LEAVES, 0.15);
  return th;
}
/** Mangrove: Stelzwurzeln am Fuß, Stamm, Laubkrone */
export function mangroveTree(env, x, gy) {
  const th = 5 + Math.floor(env.rnd() * 4);
  for (const d of [-2, -1, 1, 2]) {                                     // Stelzwurzeln: zwei Blöcke hoch, außen niedriger
    const rh = Math.abs(d) === 1 ? 3 : 2;
    for (let i = 0; i < rh; i++) if (env.air(x + d, gy - 1 - i) || env.air(x + d, gy - i)) env.put(x + d, gy - 1 - i + (Math.abs(d) === 2 ? 0 : 0), B.MANGROVE_ROOTS);
  }
  for (let i = 1; i <= th; i++) env.put(x, gy - i, i <= 3 ? B.MANGROVE_ROOTS : B.MANGROVE_LOG);
  for (let i = 1; i <= 3; i++) env.put(x, gy - i, B.MANGROVE_LOG);
  blob(env, x, gy - th - 1, 3.1, 2.2, B.MANGROVE_LEAVES, 0.15);
  if (env.rnd() < 0.7) { const px = x + (env.rnd() < 0.5 ? -2 : 2); if (env.air(px, gy - th)) env.put(px, gy - th, B.PROPAGULE); }
  return th;
}
/** Azaleenbaum in üppigen Höhlen: Eichenstamm, Azaleenlaub */
export function azaleaTree(env, x, gy) {
  const th = 3 + Math.floor(env.rnd() * 3);
  for (let i = 1; i <= th; i++) env.put(x, gy - i, B.LOG);
  blob(env, x, gy - th - 1, 2.5, 1.8, B.AZALEA_LEAVES, 0.2, B.FLOWERING_AZALEA_LEAVES, 0.35);
  return th;
}
/** Bambusstängel */
export function bambooStalk(env, x, gy, h = 0) {
  const n = h || 4 + Math.floor(env.rnd() * 9);
  for (let i = 1; i <= n; i++) { if (!env.air(x, gy - i)) break; env.put(x, gy - i, B.BAMBOO); }
  return n;
}
