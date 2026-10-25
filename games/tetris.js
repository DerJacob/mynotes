// =====================================================================
// Tetris – Oberfläche (Canvas, Tastatur, Touch). Die Regeln stehen in tetris-engine.js.
// Steuerung: ← → bewegen · ↑ / X rechts drehen · Z links drehen · ↓ schneller · Leertaste fallen lassen
//            C / Shift halten · P / Esc Pause.   (WASD geht auch)
// =====================================================================
import { Tetris, COLS, ROWS, HIDDEN, TYPES, CELLS, CLEAR_MS } from "./tetris-engine.js?v=1";

const CELL = 30;                       // Zeichen-Größe einer Zelle (CSS skaliert das Feld)
const VIS = ROWS - HIDDEN;             // sichtbare Reihen
const DAS = 160, ARR = 45;             // Wartezeit / Wiederholung beim Gedrückthalten (ms)
const COLORS = { I: "#4dd0e1", O: "#fdd835", T: "#ba68c8", S: "#66bb6a", Z: "#ef5350", J: "#5c6bc0", L: "#ffa726" };
const KEYS = {
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowDown: "soft", s: "soft", S: "soft",
  ArrowUp: "cw", w: "cw", W: "cw", x: "cw", X: "cw",
  z: "ccw", Z: "ccw",
  " ": "hard",
  c: "hold", C: "hold", Shift: "hold",
  p: "pause", P: "pause", Escape: "pause"
};
const fmt = n => new Intl.NumberFormat("de-DE").format(n);

function cell(g, px, py, s, color, alpha = 1) {
  const e = Math.max(2, s * 0.1);
  g.globalAlpha = alpha;
  g.fillStyle = color; g.fillRect(px, py, s, s);
  g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(px, py, s, e); g.fillRect(px, py, e, s);
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(px, py + s - e, s, e); g.fillRect(px + s - e, py, e, s);
  g.globalAlpha = 1;
}

/** Spiel in `root` aufbauen. Liefert { destroy } – wird beim Verlassen/Sperren aufgerufen. */
export function mount(root, ctx) {
  const { h } = ctx;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rec = { best: 0, bestLines: 0, played: 0, ...(ctx.record || {}) };
  const game = new Tetris();
  let state = "ready";                 // ready | playing | paused | over
  let raf = 0, last = 0, destroyed = false, newBest = false;
  const held = { left: false, right: false, soft: false };
  let dasDir = 0, dasT = 0, arrT = 0;

  // ---------- Oberfläche ----------
  const canvas = (cls, w, hh) => h("canvas", { class: cls, width: Math.round(w * dpr), height: Math.round(hh * dpr) });
  const board = canvas("tg-board", COLS * CELL, VIS * CELL);
  const holdCv = canvas("tg-mini", 96, 72);
  const nextCv = canvas("tg-mini tall", 96, 216);
  const bg = board.getContext("2d"), hg = holdCv.getContext("2d"), ng = nextCv.getContext("2d");

  const ovTitle = h("div", { class: "tg-ov-title" });
  const ovText = h("div", { class: "tg-ov-text" });
  const ovBtn = h("button", { class: "btn", type: "button", onclick: () => primary() });
  const overlay = h("div", { class: "tg-overlay" }, ovTitle, ovText, ovBtn);

  const vals = {};
  const stat = (key, label) => { vals[key] = h("b", null, "0"); return h("div", { class: "tg-stat" }, h("span", null, label), vals[key]); };
  const side = h("div", { class: "tg-side" },
    h("div", { class: "tg-box" }, h("div", { class: "tg-label" }, "Halten"), holdCv),
    h("div", { class: "tg-box" }, h("div", { class: "tg-label" }, "Danach"), nextCv),
    h("div", { class: "tg-box stats" }, stat("score", "Punkte"), stat("level", "Level"), stat("lines", "Reihen"), stat("best", "Rekord")));

  const kbd = t => h("kbd", null, t);
  const help = h("div", { class: "tg-help" },
    h("div", null, kbd("←"), kbd("→"), " bewegen"), h("div", null, kbd("↑"), " / ", kbd("X"), " drehen · ", kbd("Z"), " zurück"),
    h("div", null, kbd("↓"), " schneller"), h("div", null, kbd("Leertaste"), " fallen lassen"),
    h("div", null, kbd("C"), " halten"), h("div", null, kbd("P"), " Pause"));

  const touchBtn = (label, action, title) => {
    const b = h("button", { class: "tg-tb", type: "button", title, "aria-label": title }, label);
    const up = () => { release(action); b.classList.remove("on"); };
    b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add("on"); press(action); });
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    return b;
  };
  const touch = h("div", { class: "tg-touch" },
    touchBtn("Halten", "hold", "Stein halten"), touchBtn("↺", "ccw", "Links drehen"), touchBtn("↻", "cw", "Rechts drehen"), touchBtn("⏸", "pause", "Pause"),
    touchBtn("◀", "left", "Nach links"), touchBtn("▼", "soft", "Schneller fallen"), touchBtn("▶", "right", "Nach rechts"), touchBtn("⤓", "hard", "Fallen lassen"));

  root.appendChild(h("div", { class: "tg" },
    h("div", { class: "tg-main" }, h("div", { class: "tg-board-wrap" }, board, overlay), touch),
    h("div", { class: "tg-right" }, side, help)));

  // ---------- Zustand ----------
  function showOverlay(kind) {
    overlay.hidden = kind == null;
    if (kind == null) return;
    if (kind === "ready") {
      ovTitle.textContent = "Tetris";
      ovText.textContent = rec.best ? "Dein Rekord: " + fmt(rec.best) + " Punkte" : "Reihen füllen, nicht bis oben stapeln.";
      ovBtn.textContent = "Spielen";
    } else if (kind === "paused") {
      ovTitle.textContent = "Pause";
      ovText.textContent = "Es geht genau hier weiter.";
      ovBtn.textContent = "Weiter";
    } else {
      ovTitle.textContent = "Game over";
      ovText.textContent = fmt(game.score) + " Punkte · " + fmt(game.lines) + (game.lines === 1 ? " Reihe" : " Reihen") + (newBest ? " – neuer Rekord!" : "");
      ovBtn.textContent = "Nochmal";
    }
  }
  function primary() {
    if (state === "paused") resume(); else start();
  }
  function start() {
    game.reset();
    resetHeld();
    newBest = false;
    state = "playing";
    showOverlay(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    hud(true);
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (state !== "playing") return;
    state = "paused";
    cancelAnimationFrame(raf); raf = 0;
    resetHeld();
    showOverlay("paused");
    draw();
  }
  function resume() {
    if (state !== "paused") return;
    state = "playing";
    showOverlay(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function gameOver() {
    state = "over";
    cancelAnimationFrame(raf); raf = 0;
    resetHeld();
    rec.played++;
    rec.bestLines = Math.max(rec.bestLines, game.lines);
    if (game.score > rec.best) { rec.best = game.score; newBest = true; }
    ctx.save({ best: rec.best, bestLines: rec.bestLines, played: rec.played });
    hud(true);
    showOverlay("over");
    draw();
  }
  function resetHeld() { held.left = held.right = held.soft = false; dasDir = 0; dasT = arrT = 0; }

  // ---------- Eingabe ----------
  function press(a) {
    if (state === "paused") { if (a === "pause") resume(); return; }
    if (state !== "playing") return;
    switch (a) {
      case "left": case "right": held[a] = true; dasDir = a === "left" ? -1 : 1; dasT = arrT = 0; game.move(dasDir); break;
      case "soft": held.soft = true; break;
      case "cw": game.rotate(1); break;
      case "ccw": game.rotate(-1); break;
      case "hard": game.hardDrop(); break;
      case "hold": game.hold(); break;
      case "pause": pause(); return;
    }
    if (game.over) gameOver();
  }
  function release(a) {
    if (a === "left" || a === "right") {
      held[a] = false;
      const dir = held.left ? -1 : held.right ? 1 : 0;
      if (dir !== dasDir) { dasDir = dir; dasT = arrT = 0; }
    } else if (a === "soft") held.soft = false;
  }
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || ctx.blocked()) return;   // Dialog offen → Tasten gehören dem Dialog
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    if ((state === "ready" || state === "over") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (!e.repeat) start(); return; }
    if (state === "paused" && e.key === "Enter") { e.preventDefault(); if (!e.repeat) resume(); return; }
    const a = KEYS[e.key];
    if (!a) return;
    e.preventDefault();                 // sonst scrollt die Seite bei Pfeiltasten / Leertaste
    if (!e.repeat) press(a);            // Wiederholung macht das Spiel selbst (DAS/ARR)
  }
  function onKeyUp(e) { const a = KEYS[e.key]; if (a) release(a); }
  function autoPause() { resetHeld(); if (state === "playing") pause(); }
  const onVisibility = () => { if (document.hidden) autoPause(); };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", autoPause);
  document.addEventListener("visibilitychange", onVisibility);

  // ---------- Schleife ----------
  function frame(t) {
    raf = 0;
    if (destroyed || state !== "playing") return;
    if (ctx.blocked()) { pause(); return; }   // z. B. Einstellungen per Mausklick geöffnet
    const dt = Math.min(100, Math.max(0, t - last));
    last = t;
    if (dasDir) {
      dasT += dt;
      if (dasT >= DAS) {
        arrT += dt;
        while (arrT >= ARR) { arrT -= ARR; if (!game.move(dasDir)) { arrT = 0; break; } }
      }
    }
    game.update(dt, held.soft);
    hud(false);
    draw();
    if (game.over) { gameOver(); return; }
    raf = requestAnimationFrame(frame);
  }

  // ---------- Anzeige ----------
  const shown = {};
  function hud(force) {
    const v = { score: fmt(game.score), level: String(game.level), lines: String(game.lines), best: fmt(Math.max(rec.best, game.score)) };
    for (const k in v) if (force || shown[k] !== v[k]) { vals[k].textContent = v[k]; shown[k] = v[k]; }
  }
  let themeAt = 0, themeVal = null;
  function theme() {
    const now = performance.now();
    if (themeVal && now - themeAt < 500) return themeVal;   // Design-Wechsel (Einstellungen) wird nach spätestens 0,5 s übernommen
    const cs = getComputedStyle(document.documentElement);
    const get = (n, d) => (cs.getPropertyValue(n) || "").trim() || d;
    themeAt = now;
    return (themeVal = { bg: get("--surface", "#2d2e30"), grid: get("--line", "rgba(255,255,255,.12)") });
  }
  function draw() {
    const th = theme();
    const g = bg;
    const W = COLS * CELL, H = VIS * CELL;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = th.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = th.grid; g.lineWidth = 1; g.globalAlpha = 0.55;
    g.beginPath();
    for (let x = 1; x < COLS; x++) { g.moveTo(x * CELL + 0.5, 0); g.lineTo(x * CELL + 0.5, H); }
    for (let y = 1; y < VIS; y++) { g.moveTo(0, y * CELL + 0.5); g.lineTo(W, y * CELL + 0.5); }
    g.stroke();
    g.globalAlpha = 1;
    for (let r = HIDDEN; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = game.board[r][c];
      if (v) cell(g, c * CELL, (r - HIDDEN) * CELL, CELL, COLORS[TYPES[v - 1]]);
    }
    if (game.piece && state !== "ready") {
      const p = game.piece;
      if (!game.over) {   // Schatten
        const gy = game.ghostY();
        for (const [cx, cy] of CELLS[p.type][p.rot]) {
          const y = gy + cy - HIDDEN;
          if (y < 0) continue;
          g.globalAlpha = 0.22; g.fillStyle = COLORS[p.type]; g.fillRect((p.x + cx) * CELL, y * CELL, CELL, CELL);
          g.globalAlpha = 0.7; g.strokeStyle = COLORS[p.type]; g.lineWidth = 2; g.strokeRect((p.x + cx) * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
          g.globalAlpha = 1;
        }
      }
      for (const [x, y] of game.cells()) if (y >= HIDDEN) cell(g, x * CELL, (y - HIDDEN) * CELL, CELL, COLORS[p.type]);
    }
    if (game.clearing) {   // Reihen blitzen auf
      const k = Math.min(1, game.clearing.t / CLEAR_MS);
      g.fillStyle = "#fff";
      g.globalAlpha = 0.9 * (1 - k);
      for (const r of game.clearing.rows) if (r >= HIDDEN) g.fillRect(0, (r - HIDDEN) * CELL, W, CELL);
      g.globalAlpha = 1;
    }
    mini(hg, 96, 72, [game.holdType], game.canHold ? 1 : 0.35);
    mini(ng, 96, 216, game.queue.slice(0, 3), 1);
  }
  /** Kleine Steine mittig in Fächern zeichnen */
  function mini(g, w, hh, types, alpha) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    const slot = hh / types.length, s = 20;
    types.forEach((t, i) => {
      if (!t) return;
      const cs = CELLS[t][0];
      const minX = Math.min(...cs.map(c => c[0])), maxX = Math.max(...cs.map(c => c[0]));
      const minY = Math.min(...cs.map(c => c[1])), maxY = Math.max(...cs.map(c => c[1]));
      const ox = (w - (maxX - minX + 1) * s) / 2, oy = i * slot + (slot - (maxY - minY + 1) * s) / 2;
      for (const [cx, cy] of cs) cell(g, ox + (cx - minX) * s, oy + (cy - minY) * s, s, COLORS[t], alpha);
    });
  }

  showOverlay("ready");
  hud(true);
  draw();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", autoPause);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}
