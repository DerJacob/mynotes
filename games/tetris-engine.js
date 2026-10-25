// =====================================================================
// Tetris-Regeln (ohne Oberfläche) – SRS-Drehung mit Wandtritten, 7er-Beutel, Hold, Schatten-Stein,
// Lock-Delay, Zeilen-Blitz, Punkte wie im „Guideline“-Tetris (vereinfacht).
// Kein DOM, keine Uhr: Die Oberfläche ruft update(dtMs) auf → leicht testbar.
// =====================================================================

export const COLS = 10;
export const ROWS = 22;     // 2 verdeckte Reihen oben (Spawn-Puffer) + 20 sichtbare
export const HIDDEN = 2;
export const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];   // Farbnummer im Feld = Index + 1

export const LOCK_MS = 500;   // so lange darf ein Stein am Boden noch bewegt werden
export const SOFT_MS = 40;    // Zeit pro Zeile bei gedrücktem „Runter“
export const CLEAR_MS = 280;  // Blitz-Dauer vor dem Entfernen voller Reihen
const MAX_LOCK_RESETS = 15;
const LINE_POINTS = [0, 100, 300, 500, 800];

const BASE = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
};
const rotCW = m => m.map((_, y) => m[0].map((__, x) => m[m.length - 1 - x][y]));

/** CELLS[typ][drehung] = [[x, y], …] relativ zur linken oberen Ecke der Matrix */
export const CELLS = {};
for (const t of TYPES) {
  CELLS[t] = [];
  let m = BASE[t];
  for (let r = 0; r < 4; r++) {
    const cells = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
    CELLS[t].push(cells);
    m = t === "O" ? m : rotCW(m);
  }
}

// Wandtritte (SRS). Werte wie in der Guideline: x nach rechts, y nach OBEN – beim Anwenden wird y umgedreht.
// Drehzustände: 0 = Start, 1 = rechts (R), 2 = umgedreht, 3 = links (L)
const KICKS_JLSTZ = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
};
const KICKS_I = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
};

export class Tetris {
  /** opts.rng: Zufallsfunktion (für Tests), opts.startLevel */
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;
    this.startLevel = opts.startLevel || 1;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    this.bag = [];
    this.queue = [];
    this.holdType = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = this.startLevel;
    this.combo = -1;
    this.over = false;
    this.clearing = null;   // { rows: [..], t: ms }
    this.piece = null;      // { type, rot, x, y }
    this.acc = 0;           // Zeit seit der letzten Fall-Zeile
    this.lockAcc = 0;       // Zeit am Boden
    this.lockResets = 0;
    this.lowest = 0;
    this.pieces = 0;
    while (this.queue.length < 5) this.queue.push(this._draw());
    this._spawn();
  }

  // ---------- Zufall: 7er-Beutel ----------
  _draw() {
    if (!this.bag.length) {
      this.bag = TYPES.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }
  _next() {
    const t = this.queue.shift();
    while (this.queue.length < 5) this.queue.push(this._draw());
    return t;
  }

  _spawn(type) {
    if (type == null) { type = this._next(); this.pieces++; }
    const n = BASE[type].length;
    const piece = { type, rot: 0, x: Math.floor((COLS - n) / 2), y: 1 };
    this.piece = piece;
    this.acc = 0; this.lockAcc = 0; this.lockResets = 0;
    if (this._hits(type, 0, piece.x, piece.y)) {
      piece.y = 0;   // noch eine Reihe höher versuchen, sonst „Block out“
      if (this._hits(type, 0, piece.x, piece.y)) { this.over = true; return; }
    }
    this.lowest = piece.y;
  }

  // ---------- Hilfen ----------
  _hits(type, rot, x, y) {
    for (const [cx, cy] of CELLS[type][rot]) {
      const gx = x + cx, gy = y + cy;
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return true;
      if (this.board[gy][gx]) return true;
    }
    return false;
  }
  grounded() {
    const p = this.piece;
    return !!p && this._hits(p.type, p.rot, p.x, p.y + 1);
  }
  cells(p = this.piece) {
    return p ? CELLS[p.type][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy]) : [];
  }
  ghostY() {
    const p = this.piece;
    if (!p) return 0;
    let y = p.y;
    while (!this._hits(p.type, p.rot, p.x, y + 1)) y++;
    return y;
  }
  dropMs() {
    const l = Math.min(this.level, 15);
    return Math.max(2, 1000 * Math.pow(0.8 - (l - 1) * 0.007, l - 1));
  }
  get busy() { return this.over || !!this.clearing || !this.piece; }

  /** Nach jeder Bewegung am Boden: Lock-Timer zurücksetzen (höchstens 15×) */
  _touched() {
    if (this.grounded() && this.lockResets < MAX_LOCK_RESETS) { this.lockAcc = 0; this.lockResets++; }
  }
  /** Eine Zeile fallen lassen. Liefert true, wenn es ging. */
  _fall() {
    const p = this.piece;
    if (!p || this._hits(p.type, p.rot, p.x, p.y + 1)) return false;
    p.y++;
    if (p.y > this.lowest) { this.lowest = p.y; this.lockResets = 0; }
    return true;
  }

  // ---------- Aktionen ----------
  move(dx) {
    if (this.busy) return false;
    const p = this.piece;
    if (this._hits(p.type, p.rot, p.x + dx, p.y)) return false;
    p.x += dx;
    this._touched();
    return true;
  }
  /** dir: +1 rechts herum, −1 links herum */
  rotate(dir) {
    if (this.busy) return false;
    const p = this.piece;
    if (p.type === "O") return true;
    const to = (p.rot + dir + 4) % 4;
    const table = p.type === "I" ? KICKS_I : KICKS_JLSTZ;
    for (const [kx, ky] of table[p.rot + ">" + to]) {
      const nx = p.x + kx, ny = p.y - ky;
      if (!this._hits(p.type, to, nx, ny)) {
        p.rot = to; p.x = nx; p.y = ny;
        if (ny > this.lowest) { this.lowest = ny; this.lockResets = 0; }
        this._touched();
        return true;
      }
    }
    return false;
  }
  softStep() {
    if (this.busy || !this._fall()) return false;
    this.score += 1;
    this.acc = 0;
    return true;
  }
  hardDrop() {
    if (this.busy) return;
    let d = 0;
    while (this._fall()) d++;
    this.score += 2 * d;
    this._lock();
  }
  hold() {
    if (this.busy || !this.canHold) return false;
    const cur = this.piece.type;
    const held = this.holdType;
    this.holdType = cur;
    if (held == null) this._spawn(); else this._spawn(held);
    this.canHold = false;
    return true;
  }

  // ---------- Festsetzen ----------
  _lock() {
    const p = this.piece;
    const cells = this.cells(p);
    const color = TYPES.indexOf(p.type) + 1;
    for (const [x, y] of cells) this.board[y][x] = color;
    this.piece = null;
    if (cells.every(([, y]) => y < HIDDEN)) { this.over = true; return; }   // „Lock out“
    const rows = [];
    for (let y = 0; y < ROWS; y++) if (this.board[y].every(v => v)) rows.push(y);
    if (rows.length) { this.clearing = { rows, t: 0 }; return; }
    this.combo = -1;
    this.canHold = true;
    this._spawn();
  }
  _finishClear() {
    const rows = this.clearing.rows;
    const n = rows.length;
    this.board = this.board.filter((_, y) => !rows.includes(y));
    while (this.board.length < ROWS) this.board.unshift(new Array(COLS).fill(0));
    this.score += LINE_POINTS[n] * this.level;
    this.combo++;
    if (this.combo > 0) this.score += 50 * this.combo * this.level;
    this.lines += n;
    this.level = this.startLevel + Math.floor(this.lines / 10);
    this.clearing = null;
    this.canHold = true;
    this._spawn();
  }

  /** Zeit vergeht (dt in ms). soft = „Runter“ gedrückt. */
  update(dt, soft = false) {
    if (this.over) return;
    if (this.clearing) {
      this.clearing.t += dt;
      if (this.clearing.t >= CLEAR_MS) this._finishClear();
      return;
    }
    if (!this.piece) return;
    if (this.grounded()) {
      this.acc = 0;
      this.lockAcc += dt;
      if (this.lockAcc >= LOCK_MS) this._lock();
      return;
    }
    this.lockAcc = 0;
    const g = this.dropMs();
    const interval = soft ? Math.min(g, SOFT_MS) : g;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= interval && steps++ < 25) {
      this.acc -= interval;
      if (!this._fall()) break;
      if (soft) this.score += 1;
      if (this.grounded()) { this.acc = 0; break; }
    }
  }
}
