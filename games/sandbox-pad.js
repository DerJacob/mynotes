// =====================================================================
// Blockdorf – Gamepad (Etappe 7): Abbildung der Tasten und Sticks auf Spielaktionen.
//   Linker Stick / Steuerkreuz  laufen, hoch = springen, runter = Leiter/Abstieg
//   A                           springen            Rechter Stick   zielen (sonst vor dich)
//   RT oder X                   abbauen / kämpfen   LT oder B       benutzen / bauen / essen
//   LB / RB                     Platz links/rechts  Y               Inventar (im Fenster: schließen)
//   Start                       Pause               Zurück          Fortschritte
//   Stick-Klick rechts          fallen lassen       Fenster         linker Stick bewegt den Zeiger, A = Klick, X = Rechtsklick, LB/RB halten = Umschalt
// Reine Funktionen (Node-testbar); die Oberfläche liest navigator.getGamepads() und ruft padStep().
// =====================================================================

export const DEAD = 0.2;
const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, ls: 10, rs: 11, up: 12, down: 13, left: 14, right: 15 };

/** Radiale Totzone: kleine Ausschläge zählen nicht, der Rest wird auf 0…1 gestreckt */
export function stick(x, y, dead = DEAD) {
  x = Number(x) || 0; y = Number(y) || 0;
  const m = Math.hypot(x, y);
  if (m < dead) return { x: 0, y: 0, m: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return { x: x * k, y: y * k, m: Math.min(1, (m - dead) / (1 - dead)) };
}

/** Rohdaten eines Gamepads (axes[], buttons[]) in benannte Werte umsetzen */
export function readPad(gp) {
  const axes = (gp && gp.axes) || [], btns = (gp && gp.buttons) || [];
  const b = n => { const v = btns[BTN[n]]; return !!v && (typeof v === "object" ? !!v.pressed || (v.value || 0) > 0.5 : !!v); };
  const o = { l: stick(axes[0], axes[1]), r: stick(axes[2], axes[3]) };
  for (const n of Object.keys(BTN)) o[n] = b(n);
  return o;
}

/**
 * Ein Bild lang auswerten.
 *   raw    Ergebnis von readPad (oder null, wenn kein Pad da ist)
 *   prev   Rückgabe des letzten Aufrufs (state) oder null
 *   opts   { win: Fenster offen?, sens: Zeigerempfindlichkeit }
 * Liefert { state, move: {left,right,jump,down}, mine, use, aim: {x,y}|null, cursor: {dx,dy}|null, edges: {…} }
 */
export function padStep(raw, prev, opts = {}) {
  const win = !!opts.win, sens = opts.sens || 1;
  const none = { state: null, move: { left: false, right: false, jump: false, down: false }, mine: false, use: false, aim: null, cursor: null, edges: {}, active: false };
  if (!raw) return none;
  const p = prev || {};
  const edge = n => !!raw[n] && !p[n];
  const state = {};
  for (const n of Object.keys(BTN)) state[n] = !!raw[n];
  const lx = raw.l.x, ly = raw.l.y;
  const active = raw.l.m > 0 || raw.r.m > 0 || Object.keys(BTN).some(n => raw[n]);
  const edges = {};
  if (win) {
    // im Fenster: Stick = Zeiger, A = Klick, X = Rechtsklick, Y/B = schließen
    const cursor = { dx: lx * 900 * sens, dy: ly * 900 * sens };
    if (edge("a")) edges.click = 0;
    if (edge("x")) edges.click = 2;
    if (edge("y") || edge("b") || edge("start")) edges.close = true;
    edges.shift = raw.lb || raw.rb;
    return { ...none, state, cursor, edges, active };
  }
  const move = {
    left: lx < -0.3 || raw.left, right: lx > 0.3 || raw.right,
    jump: raw.a || raw.up || ly < -0.6, down: ly > 0.6 || raw.down
  };
  if (edge("lb")) edges.slot = -1;
  if (edge("rb")) edges.slot = 1;
  if (edge("y")) edges.inventory = true;
  if (edge("start")) edges.pause = true;
  if (edge("back")) edges.advancements = true;
  if (edge("rs")) edges.drop = true;
  const aim = raw.r.m > 0.35 ? { x: raw.r.x, y: raw.r.y } : null;
  return { state, move, mine: raw.rt || raw.x, use: raw.lt || raw.b, aim, cursor: null, edges, active };
}

/** Zielpunkt in Blöcken: rechter Stick zeigt vom Spieler weg (Reichweite begrenzt), ohne Stick vor den Spieler */
export function aimPoint(px, py, face, aim, reach = 4.5) {
  if (aim) {
    const m = Math.hypot(aim.x, aim.y) || 1;
    return { x: px + (aim.x / m) * Math.min(reach, 1 + m * reach), y: py + (aim.y / m) * Math.min(reach, 1 + m * reach) };
  }
  return { x: px + (face < 0 ? -1.2 : 1.2), y: py };
}

/** Zeiger im Fenster: Position (Pixel) nachführen und im Bild halten */
export function moveCursor(c, cur, dt, w, h) {
  if (!cur) return c;
  return { x: Math.max(0, Math.min(w, c.x + cur.dx * dt)), y: Math.max(0, Math.min(h, c.y + cur.dy * dt)) };
}
