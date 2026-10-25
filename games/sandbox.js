// =====================================================================
// Blockdorf – Oberfläche: Pixel-Texturen (alle selbst gemalt, keine Bilddateien), weiches Licht,
// Himmel mit Sonne/Mond/Sternen, Partikel, Steuerung per Tastatur/Maus/Touch.
// Die Regeln stehen in sandbox-engine.js.
//   A/D oder ←/→ laufen · W/↑/Leertaste springen · linke Maustaste abbauen/kämpfen · rechte Maustaste bauen
//   1–9 oder Mausrad: Baustein wählen · E: Handwerk · P/Esc: Pause
// =====================================================================
import { Sandbox, W, H, B, BLOCKS, ITEMS, RECIPES, REACH, DAY_LEN, mulberry32 } from "./sandbox-engine.js?v=1";

const T = 16;                                  // Pixel pro Block in den Texturen
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const fmt = n => new Intl.NumberFormat("de-DE").format(n);

// =====================================================================
// Texturen (16 × 16, aus Zufallszahlen gemalt)
// =====================================================================
const IDX = { FLOWER2: 18, FLOWER3: 19, WALL_DIRT: 20, WALL_STONE: 21, CRACK: 22 };   // 22…26 = Risse in 5 Stufen
const ATLAS_N = 27;

function makeAtlas() {
  const cv = document.createElement("canvas");
  cv.width = ATLAS_N * T; cv.height = T;
  const g = cv.getContext("2d");
  const avg = [];
  const paint = (index, fn) => {
    const img = g.createImageData(T, T), d = img.data, r = mulberry32(index * 7919 + 13);
    const set = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= T || y >= T) return; const i = (y * T + x) * 4; d[i] = clamp(c[0], 0, 255); d[i + 1] = clamp(c[1], 0, 255); d[i + 2] = clamp(c[2], 0, 255); d[i + 3] = a; };
    fn(set, r);
    g.putImageData(img, index * T, 0);
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; }
    avg[index] = n ? [sr / n, sg / n, sb / n] : [200, 200, 200];
  };
  const noise = (c, k, r) => { const v = (r() - 0.5) * k; return [c[0] + v, c[1] + v, c[2] + v]; };
  const stoneBase = (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const patch = (((x >> 2) * 7 + (y >> 2) * 13) % 5) * 3 - 6;
      set(x, y, noise([122 + patch, 124 + patch, 130 + patch], 18, r));
    }
    for (let i = 0; i < 4; i++) { let x = Math.floor(r() * T), y = Math.floor(r() * T); for (let k = 0; k < 4; k++) { set(x, y, [88, 90, 98]); x += r() < 0.5 ? 1 : 0; y += 1; } }
  };
  const specks = (set, r, base, hi, count) => {
    for (let i = 0; i < count; i++) {
      const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13);
      set(x, y, base); set(x + 1, y, base); set(x, y + 1, noise(base, 10, r)); if (r() < 0.6) set(x + 1, y + 1, base);
      set(x, y, hi);
    }
  };
  const dirtPix = (set, r, y0 = 0) => { for (let y = y0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise([134, 96, 67], 26, r); const q = r(); if (q < 0.07) c = [c[0] - 30, c[1] - 24, c[2] - 20]; else if (q > 0.96) c = [c[0] + 18, c[1] + 14, c[2] + 10]; set(x, y, c); } };

  paint(B.AIR, () => {});
  paint(B.DIRT, (set, r) => dirtPix(set, r));
  paint(B.GRASS, (set, r) => {
    dirtPix(set, r, 4);
    const edge = []; for (let x = 0; x < T; x++) edge[x] = 3 + Math.floor(r() * 3);
    for (let x = 0; x < T; x++) for (let y = 0; y < edge[x]; y++) {
      const k = y / edge[x];
      set(x, y, noise([lerp(120, 78, k), lerp(200, 150, k), lerp(74, 48, k)], 14, r));
    }
    for (let x = 0; x < T; x++) { set(x, edge[x], [104, 78, 54]); if (r() < 0.35) set(x, 0, [150, 224, 96]); }
  });
  paint(B.STONE, (set, r) => stoneBase(set, r));
  paint(B.SAND, (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise([226, 206, 144], 16, r); if (r() < 0.07) c = [c[0] - 28, c[1] - 28, c[2] - 24]; set(x, y, c); } });
  paint(B.LOG, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const s = x % 4 === 0 ? -24 : x % 4 === 2 ? 10 : 0; set(x, y, noise([104 + s, 76 + s, 46 + s * 0.7], 10, r)); }
    for (let y = 6; y <= 10; y++) for (let x = 4; x <= 7; x++) if (((x - 5.5) ** 2) / 4 + ((y - 8) ** 2) / 7 < 1) set(x, y, [66, 46, 28]);
  });
  paint(B.LEAVES, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const q = r();
      if (q < 0.12) continue;                                      // Löcher: man sieht Himmel durch
      const col = q < 0.4 ? [38, 98, 42] : q < 0.8 ? [58, 130, 50] : [92, 164, 62];
      set(x, y, noise(col, 10, r));
    }
  });
  paint(B.PLANKS, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = noise([180, 134, 80], 14, r);
      if (y % 5 === 0) c = [128, 90, 52];
      else if ((x === 3 && y < 5) || (x === 11 && y > 5 && y < 10) || (x === 6 && y > 10)) c = [140, 100, 58];
      set(x, y, c);
    }
    for (const [x, y] of [[1, 2], [14, 2], [1, 7], [14, 7], [1, 12], [14, 12]]) set(x, y, [88, 62, 36]);
  });
  const ore = (id, base, hi, count) => paint(id, (set, r) => { stoneBase(set, r); specks(set, r, base, hi, count); });
  ore(B.COAL, [30, 30, 36], [92, 92, 100], 7);
  ore(B.IRON, [208, 152, 118], [240, 200, 170], 6);
  ore(B.GOLD, [246, 206, 62], [255, 244, 160], 6);
  paint(B.TORCH, (set) => {
    for (let y = 6; y < 16; y++) { set(7, y, [124, 88, 50]); set(8, y, [96, 66, 38]); }
    set(7, 5, [255, 190, 60]); set(8, 5, [255, 150, 40]); set(7, 4, [255, 225, 100]); set(8, 4, [255, 190, 60]); set(7, 3, [255, 240, 150]); set(8, 3, [255, 210, 80]); set(6, 4, [255, 140, 40], 190); set(9, 4, [255, 140, 40], 190);
  });
  paint(B.BENCH, (set, r) => {
    for (let x = 1; x < 15; x++) { set(x, 7, [186, 138, 84]); set(x, 8, noise([150, 104, 60], 10, r)); }
    for (let y = 9; y < 16; y++) { set(2, y, [110, 76, 44]); set(13, y, [110, 76, 44]); set(3, y, [90, 62, 36]); set(12, y, [90, 62, 36]); }
    for (let x = 3; x < 13; x++) { set(x, 12, [130, 92, 54]); set(x, 13, [104, 72, 42]); }
    for (let x = 4; x < 8; x++) set(x, 6, [196, 198, 206]); set(4, 5, [150, 106, 62]); set(5, 5, [150, 106, 62]);
    for (let y = 4; y < 7; y++) set(11, y, [150, 150, 160]);
  });
  paint(B.GLASS, (set) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const edge = x === 0 || y === 0 || x === T - 1 || y === T - 1;
      set(x, y, edge ? [226, 246, 255] : [186, 226, 246], edge ? 190 : 56);
    }
    for (let i = 0; i < 5; i++) set(3 + i, 3 + i, [255, 255, 255], 190);
    for (let i = 0; i < 3; i++) set(3 + i, 8 + i, [255, 255, 255], 150);
  });
  paint(B.BRICK, (set, r) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 0;
      set(x, y, mortar ? noise([198, 190, 182], 10, r) : noise([170, 80, 62], 16, r));
    }
  });
  paint(B.BEDROCK, (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise([50, 50, 58], 16, r); if (r() < 0.06) c = [c[0] + 30, c[1] + 30, c[2] + 34]; set(x, y, c); } });
  const flower = (index, petal) => paint(index, (set) => {
    for (let y = 8; y < 16; y++) set(7, y, [66, 146, 60]);
    set(6, 12, [66, 146, 60]); set(5, 11, [66, 146, 60]); set(8, 11, [66, 146, 60]); set(9, 10, [66, 146, 60]);
    for (const [x, y] of [[6, 5], [7, 4], [8, 5], [7, 6], [6, 6], [8, 6], [6, 4], [8, 4]]) set(x, y, petal);
    set(7, 5, [252, 232, 120]);
  });
  flower(B.FLOWER, [226, 62, 72]); flower(IDX.FLOWER2, [250, 210, 60]); flower(IDX.FLOWER3, [96, 136, 244]);
  paint(B.TALLGRASS, (set, r) => {
    for (const [x, hh] of [[2, 5], [4, 8], [6, 6], [8, 10], [10, 7], [12, 5], [13, 8]]) for (let y = 16 - hh; y < 16; y++) set(x, y, noise(y < 16 - hh + 2 ? [128, 206, 80] : [74, 150, 54], 12, r));
  });
  const wall = (index, base) => paint(index, (set, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { let c = noise(base, 12, r); if (x % 8 === 0 || y % 8 === 0) c = [c[0] - 12, c[1] - 12, c[2] - 12]; set(x, y, c); } });
  wall(IDX.WALL_DIRT, [96, 70, 50]); wall(IDX.WALL_STONE, [70, 70, 80]);
  for (let k = 0; k < 5; k++) paint(IDX.CRACK + k, (set, r) => {
    let x = 8, y = 8;
    for (let n = 0; n < (k + 1) * 7; n++) { set(x, y, [20, 14, 10], 210); x = clamp(x + Math.floor(r() * 3) - 1, 0, 15); y = clamp(y + Math.floor(r() * 3) - 1, 0, 15); if (n % 7 === 6) { x = 8; y = 8; } }
    for (let n = 0; n < (k + 1) * 4; n++) { let cx = 8, cy = 8; const dx = r() < 0.5 ? -1 : 1, dy = r() < 0.5 ? -1 : 1; for (let s = 0; s < 8; s++) { cx += dx * (r() < 0.7 ? 1 : 0); cy += dy * (r() < 0.7 ? 1 : 0); set(cx, cy, [20, 14, 10], 190); } }
  });
  return { cv, avg };
}

/** Kleine Symbole für Hotbar und Handwerk */
function drawItem(g, atlas, item, x, y, s) {
  const k = s / 16, R = (rx, ry, rw, rh, c) => { g.fillStyle = c; g.fillRect(x + rx * k, y + ry * k, rw * k, rh * k); };
  const it = ITEMS[item];
  g.imageSmoothingEnabled = false;
  if (it.block != null) { g.drawImage(atlas, it.block * T, 0, T, T, x, y, s, s); return; }
  if (item === "coal") { R(3, 7, 7, 6, "#222228"); R(7, 4, 6, 6, "#30303a"); R(4, 8, 2, 1, "#5c5c68"); R(9, 5, 2, 1, "#6a6a76"); return; }
  if (item === "iron" || item === "gold") {
    const [a, b, c] = item === "iron" ? ["#bcbcc6", "#e6e6ee", "#8c8c98"] : ["#f2c93c", "#fff0a0", "#c08e1c"];
    R(2, 7, 12, 5, a); R(3, 6, 10, 1, b); R(2, 12, 12, 1, c); R(2, 7, 1, 5, b); R(13, 7, 1, 6, c); return;
  }
  const col = { 1: "#9a6c3c", 2: "#8d8f98", 3: "#d4d8e4" }[it.tier];
  if (it.tool === "pick") {
    for (let i = 0; i < 9; i++) R(3 + i, 13 - i, 2, 2, "#7a5230");
    R(6, 3, 2, 2, col); R(8, 2, 4, 2, col); R(12, 3, 2, 2, col); R(13, 5, 2, 3, col); R(8, 2, 4, 1, "#ffffff55");
  } else {
    for (let i = 0; i < 9; i++) R(5 + i, 10 - i, 2, 2, col);
    R(4, 9, 5, 2, "#7a5230"); R(3, 12, 3, 3, "#5a3a20"); R(7, 4, 2, 1, "#ffffff66");
  }
}
function itemCanvas(atlas, item, size) {
  const c = document.createElement("canvas"); c.width = c.height = size; c.className = "sb-ic";
  drawItem(c.getContext("2d"), atlas, item, 0, 0, size);
  return c;
}

// =====================================================================
// mount
// =====================================================================
export function mount(root, ctx) {
  const { h } = ctx;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { cv: atlas, avg } = makeAtlas();

  // ---------- Welt laden oder neu erzeugen ----------
  let game;
  let hadSave = false;
  try { if (ctx.record && ctx.record.w) { game = new Sandbox({ data: ctx.record.w }); hadSave = true; } } catch (_) { game = null; }
  if (!game) game = new Sandbox({});
  let state = "ready", raf = 0, last = 0, destroyed = false, confirmNew = false;
  let saveT = 0, dirty = false, flash = 0, toastT = 0, sound = false, craftOpen = false, touchMode = "mine", placeCd = 0, swingT = 0, walkPh = 0, shake = 0;
  const keys = { left: false, right: false, jump: false };
  const mouse = { px: 0, py: 0, in: false, down: false, btn: 0 };
  const cam = { x: game.player.x, y: game.player.y };
  const parts = [], floats = [];
  let audio = null;

  // ---------- Oberfläche ----------
  const canvas = h("canvas", { class: "sb-canvas" });
  const g = canvas.getContext("2d");
  const lightCv = document.createElement("canvas"), lg = lightCv.getContext("2d");
  const glowCv = document.createElement("canvas"), gg = glowCv.getContext("2d");
  const hearts = h("div", { class: "sb-hearts" });
  const info = h("div", { class: "sb-info" });
  const tools = h("div", { class: "sb-tools-line" });
  const hotbar = h("div", { class: "sb-hotbar" });
  const toastEl = h("div", { class: "sb-toast", hidden: true });
  const craftPanel = h("div", { class: "sb-craft", hidden: true });
  const btn = (label, title, fn, cls = "") => h("button", { class: "sb-btn " + cls, type: "button", title, "aria-label": title, onclick: fn }, label);
  const soundBtn = btn("🔇", "Ton an/aus", () => { sound = !sound; if (sound) ensureAudio(); soundBtn.textContent = sound ? "🔊" : "🔇"; blurFocus(); });
  const craftBtn = btn("🔨", "Handwerk (E)", () => { toggleCraft(); blurFocus(); });
  const pauseBtn = btn("⏸", "Pause (P)", () => { pause(); });
  const ovTitle = h("div", { class: "tg-ov-title" }, "Blockdorf");
  const ovText = h("div", { class: "sb-ov-text" });
  const ovBtn = h("button", { class: "btn", type: "button", onclick: () => primary() });
  const ovNew = h("button", { class: "btn ghost small", type: "button", onclick: () => newWorld() }, "Neue Welt");
  const overlay = h("div", { class: "tg-overlay sb-overlay" }, ovTitle, ovText, ovBtn, ovNew);
  const kbd = t => h("kbd", null, t);
  const help = h("div", { class: "sb-help" },
    h("div", null, kbd("A"), kbd("D"), " laufen · ", kbd("W"), " / ", kbd("Leertaste"), " springen"),
    h("div", null, "Linke Maustaste: abbauen und kämpfen · rechte: bauen"),
    h("div", null, kbd("1"), "–", kbd("9"), " / Mausrad: Baustein · ", kbd("E"), " Handwerk · ", kbd("P"), " Pause"));
  const touchBtn = (label, action, title) => {
    const b = h("button", { class: "tg-tb", type: "button", title, "aria-label": title }, label);
    const up = () => { act(action, false); b.classList.remove("on"); };
    b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add("on"); act(action, true); });
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
    return b;
  };
  const modeBtn = h("button", { class: "tg-tb sb-mode", type: "button", title: "Berühren: abbauen oder bauen", onclick: () => { touchMode = touchMode === "mine" ? "place" : "mine"; modeBtn.textContent = touchMode === "mine" ? "⛏ Abbauen" : "🧱 Bauen"; } }, "⛏ Abbauen");
  const touch = h("div", { class: "sb-touch" }, touchBtn("◀", "left", "Nach links"), touchBtn("▲", "jump", "Springen"), touchBtn("▶", "right", "Nach rechts"), modeBtn);

  root.appendChild(h("div", { class: "sb" },
    h("div", { class: "sb-view" }, canvas,
      h("div", { class: "sb-hud-top" }, h("div", { class: "sb-left" }, hearts, info, tools), h("div", { class: "sb-right" }, craftBtn, soundBtn, pauseBtn)),
      toastEl, hotbar, craftPanel, overlay),
    touch, help));

  function blurFocus() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }

  // ---------- HUD ----------
  let sigHearts = "", sigHotbar = "", sigTools = "", sigCraft = "", sigInfo = "";
  function hud() {
    const p = game.player;
    const sh = p.hp + "/" + p.maxHp;
    if (sh !== sigHearts) { sigHearts = sh; hearts.textContent = ""; for (let i = 0; i < p.maxHp; i++) hearts.appendChild(h("span", { class: "sb-heart" + (i < p.hp ? " on" : "") }, "♥")); }
    const hb = game.hotbar(); game.selItem();
    const sb = hb.map(k => k + game.count(k)).join(",") + "|" + game.sel;
    if (sb !== sigHotbar) {
      sigHotbar = sb; hotbar.textContent = "";
      hb.forEach((k, i) => hotbar.appendChild(h("button", { class: "sb-slot" + (i === game.sel ? " on" : ""), type: "button", title: ITEMS[k].name, onclick: () => { game.select(i); blurFocus(); } },
        itemCanvas(atlas, k, 32), h("span", { class: "sb-n" }, String(game.count(k))), i < 9 ? h("span", { class: "sb-key" }, String(i + 1)) : null)));
    }
    const hour = Math.floor(game.time * 24), min = Math.floor((game.time * 24 - hour) * 60);
    const si = `Tag ${game.day} · ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    if (si !== sigInfo) { sigInfo = si; info.textContent = si; }
    const st = ["Hand", "Holz", "Stein", "Eisen"][game.tier("pick")] + "-Spitzhacke · " + ["ohne Schwert", "Holzschwert", "Steinschwert", "Eisenschwert"][game.tier("sword")];
    if (st !== sigTools) { sigTools = st; tools.textContent = st; }
    if (craftOpen) {
      const sc = JSON.stringify(game.inv) + game.benchNear();
      if (sc !== sigCraft) { sigCraft = sc; renderCraft(); }
    }
  }
  function renderCraft() {
    craftPanel.textContent = "";
    const near = game.benchNear();
    craftPanel.appendChild(h("div", { class: "sb-craft-head" }, h("b", null, "Handwerk"), h("button", { class: "sb-x", type: "button", title: "Schließen", onclick: () => toggleCraft() }, "✕")));
    craftPanel.appendChild(h("div", { class: "sb-craft-note" }, near ? "Werkbank in der Nähe ✓" : "Keine Werkbank in der Nähe"));
    for (const r of RECIPES) {
      const s = game.recipeState(r), ok = s.have && s.bench && !s.owned;
      const cost = Object.entries(r.cost).map(([k, n]) => h("span", { class: game.count(k) >= n ? "ok" : "no" }, `${n} ${ITEMS[k].name}`));
      const row = h("div", { class: "sb-recipe" + (ok ? " can" : "") },
        itemCanvas(atlas, r.out[0], 28),
        h("div", { class: "sb-r-main" }, h("div", { class: "sb-r-name" }, (r.out[1] > 1 ? r.out[1] + "× " : "") + ITEMS[r.out[0]].name),
          h("div", { class: "sb-r-cost" }, cost.flatMap((c, i) => (i ? [", ", c] : [c]))),
          r.bench && !s.bench ? h("div", { class: "sb-r-hint" }, "Werkbank nötig") : s.owned ? h("div", { class: "sb-r-hint" }, "Schon vorhanden") : null),
        h("button", { class: "btn small", type: "button", disabled: !ok, onclick: () => { if (game.craft(r.id)) { dirty = true; sfx("craft"); } blurFocus(); } }, "Herstellen"));
      craftPanel.appendChild(row);
    }
  }
  function toggleCraft() { craftOpen = !craftOpen; craftPanel.hidden = !craftOpen; sigCraft = ""; if (craftOpen) renderCraft(); }
  function say(text, ms = 2600) { toastEl.textContent = text; toastEl.hidden = false; toastT = ms / 1000; }

  // ---------- Ton (winzige Synthesizer-Klänge, standardmäßig aus) ----------
  function ensureAudio() { if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { audio = null; } } if (audio && audio.state === "suspended") audio.resume(); }
  function tone(f, d, type = "square", v = 0.04, slide = 0) {
    if (!sound || !audio) return;
    const o = audio.createOscillator(), gn = audio.createGain(), t = audio.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(audio.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function sfx(k) {
    if (k === "break") tone(180, 0.09, "square", 0.05, -80); else if (k === "place") tone(300, 0.06, "triangle", 0.06, 60);
    else if (k === "hurt") tone(160, 0.22, "sawtooth", 0.06, -90); else if (k === "craft") { tone(520, 0.08, "triangle", 0.06); setTimeout(() => tone(780, 0.1, "triangle", 0.06), 70); }
    else if (k === "pick") tone(120 + Math.random() * 40, 0.04, "square", 0.025); else if (k === "kill") tone(420, 0.14, "square", 0.05, -250); else if (k === "jump") tone(250, 0.07, "triangle", 0.03, 90);
  }

  // ---------- Zustand ----------
  function showOverlay(kind) {
    overlay.hidden = kind == null;
    if (kind == null) return;
    const day = game.day;
    ovTitle.textContent = kind === "paused" ? "Pause" : "Blockdorf";
    ovText.textContent = kind === "paused" ? "Deine Welt wird gespeichert." : hadSave || game.stats.mined || game.stats.built ? `Dein Dorf wartet – Tag ${day}, ${fmt(game.stats.mined)} Blöcke abgebaut, ${fmt(game.stats.built)} gebaut.` : "Baue ab, handwerke und errichte dein Dorf. Nachts wird es gefährlich – bring Fackeln mit.";
    ovBtn.textContent = kind === "paused" || hadSave || game.stats.mined ? "Weiter" : "Spielen";
    ovNew.textContent = confirmNew ? "Wirklich? Alles geht verloren" : "Neue Welt";
    ovNew.className = "btn ghost small" + (confirmNew ? " danger" : "");
  }
  function primary() { ensureAudio(); if (state === "playing") return; confirmNew = false; start(); }
  function start() {
    state = "playing"; showOverlay(null); blurFocus(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (state !== "playing") return;
    state = "paused"; cancelAnimationFrame(raf); raf = 0; keys.left = keys.right = keys.jump = false; mouse.down = false; game.mineStop();
    saveNow(); confirmNew = false; showOverlay("paused"); draw(0);
  }
  function newWorld() {
    if (!confirmNew) { confirmNew = true; showOverlay(state === "paused" ? "paused" : "ready"); return; }
    confirmNew = false; game = new Sandbox({}); hadSave = false; parts.length = 0; floats.length = 0; cam.x = game.player.x; cam.y = game.player.y;
    sigHotbar = sigHearts = sigTools = sigInfo = sigCraft = ""; saveNow(); state = "ready"; showOverlay("ready"); hud(); draw(0);
  }
  function saveNow() { ctx.save({ w: game.toData(), day: game.day, mined: game.stats.mined, built: game.stats.built, kills: game.stats.kills }); dirty = false; saveT = 0; }

  // ---------- Eingabe ----------
  function act(a, on) {
    if (a === "left") keys.left = on; else if (a === "right") keys.right = on; else if (a === "jump") keys.jump = on;
  }
  const KEYMAP = { a: "left", A: "left", ArrowLeft: "left", d: "right", D: "right", ArrowRight: "right", w: "jump", W: "jump", ArrowUp: "jump", " ": "jump" };
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || ctx.blocked()) return;
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    if (state !== "playing") {
      if (e.key === "Enter" || (e.key === " " && state !== "paused")) { e.preventDefault(); if (!e.repeat) primary(); }
      else if (state === "paused" && (e.key === "p" || e.key === "P" || e.key === "Escape")) { e.preventDefault(); if (!e.repeat) primary(); }
      return;
    }
    const a = KEYMAP[e.key];
    if (a) { e.preventDefault(); act(a, true); return; }
    if (e.key >= "1" && e.key <= "9") { e.preventDefault(); game.select(Number(e.key) - 1); return; }
    if (e.key === "e" || e.key === "E") { e.preventDefault(); if (!e.repeat) toggleCraft(); }
    else if (e.key === "p" || e.key === "P" || e.key === "Escape") { e.preventDefault(); if (!e.repeat) pause(); }
    else if (e.key === "m" || e.key === "M") { soundBtn.click ? soundBtn.click() : null; }
  }
  function onKeyUp(e) { const a = KEYMAP[e.key]; if (a) act(a, false); }
  function autoPause() { keys.left = keys.right = keys.jump = false; mouse.down = false; if (state === "playing") pause(); }
  const onVisibility = () => { if (document.hidden) autoPause(); };
  function setPointer(e) {
    const r = canvas.getBoundingClientRect(), w = r.width || 1, hh = r.height || 1;
    mouse.px = (e.clientX - r.left) * (canvas.width / w); mouse.py = (e.clientY - r.top) * (canvas.height / hh); mouse.in = true;
  }
  canvas.addEventListener("pointerdown", e => {
    if (state !== "playing") return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    setPointer(e); mouse.down = true; ensureAudio();
    mouse.btn = e.pointerType === "touch" || e.pointerType === "pen" ? (touchMode === "place" ? 2 : 0) : (e.button === 2 ? 2 : 0);
    placeCd = 0;
  });
  canvas.addEventListener("pointermove", setPointer);
  const up = () => { mouse.down = false; game.mineStop(); };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", () => { mouse.in = false; });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => { if (state !== "playing") return; e.preventDefault(); const n = game.hotbar().length; if (n) game.select((game.sel + (e.deltaY > 0 ? 1 : -1) + n) % n); }, { passive: false });
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", autoPause);
  document.addEventListener("visibilitychange", onVisibility);

  // ---------- Größe ----------
  let S = 2;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const cw = Math.max(240, Math.round((r.width || 800) * dpr)), ch = Math.max(200, Math.round((r.height || 520) * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    S = Math.max(2, Math.round(ch / 330));
  }
  let ro = null;
  if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(() => { resize(); if (state !== "playing") draw(0); }); ro.observe(canvas); }
  resize();

  // ---------- Hauptschleife ----------
  function frame(t) {
    raf = 0;
    if (destroyed || state !== "playing") return;
    if (ctx.blocked()) { pause(); return; }
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
    step(dt);
    draw(dt);
    hud();
    if (state === "playing") raf = requestAnimationFrame(frame);
  }
  function worldMouse() {
    const tile = T * S, cw = canvas.width, ch = canvas.height;
    return { x: cam.x - cw / 2 / tile + mouse.px / tile, y: cam.y - ch / 2 / tile + mouse.py / tile };
  }
  function step(dt) {
    game.input.left = keys.left; game.input.right = keys.right; game.input.jump = keys.jump;
    // Maus: abbauen, kämpfen, bauen
    let mining = false;
    if (mouse.down && mouse.in !== false) {
      const m = worldMouse(), tx = Math.floor(m.x), ty = Math.floor(m.y);
      if (mouse.btn === 2) { placeCd -= dt; if (placeCd <= 0 && game.place(tx, ty)) { placeCd = 0.12; dirty = true; sfx("place"); } }
      else if (game.attack(m.x, m.y)) { swingT = 0.25; sfx("kill"); }
      else { const r = game.mineStep(tx, ty, dt); mining = r === 1 || r === 2; if (mining && Math.random() < dt * 9) sfx("pick"); if (r === 1 && Math.random() < dt * 22) spark(tx + 0.5, ty + 0.5, game.tile(tx, ty), 1); }
    } else game.mineStop();
    swingT = Math.max(0, swingT - dt);
    game.player.swing = mining ? 1 : swingT > 0 ? 1 : 0;
    game.update(dt);
    const p = game.player;
    if (Math.abs(p.vx) > 0.5 && p.onGround) walkPh += dt * Math.abs(p.vx) * 1.7;
    // Kamera folgt weich
    const tx = p.x + p.w / 2, ty = p.y + p.h / 2 - 0.4, k = 1 - Math.pow(0.0005, dt);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    // Ereignisse verarbeiten
    for (const e of game.events) {
      if (e.t === "break") { spark(e.x + 0.5, e.y + 0.5, e.id, 9); sfx("break"); dirty = true; }
      else if (e.t === "place") { spark(e.x + 0.5, e.y + 0.5, e.id, 3); }
      else if (e.t === "pickup") floatText(`+${e.n} ${ITEMS[e.item].name}`, "#fff3b0");
      else if (e.t === "hurt") { flash = 0.5; shake = 0.25; sfx("hurt"); }
      else if (e.t === "died") say("Du wurdest ins Dorf zurückgebracht. Deine Sachen sind noch da.", 4000);
      else if (e.t === "weak") say(`${["", "Dafür brauchst du eine Holz-", "Dafür brauchst du eine Stein-", "Dafür brauchst du eine Eisen-"][BLOCKS[e.id].tier] || "Dafür brauchst du eine bessere "}Spitzhacke`, 2400);
      else if (e.t === "day") say(`Tag ${e.day}`, 2200);
      else if (e.t === "hit") spark(e.x, e.y + 0.4, 1000, 5);
      else if (e.t === "kill") { spark(e.x, e.y, 1000, 14); }
      else if (e.t === "jump") sfx("jump");
    }
    game.events.length = 0;
    // Partikel, Schwebetexte, Meldungen
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt; q.vy += 24 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) parts.splice(i, 1); }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y -= dt * 0.9; if (f.life <= 0) floats.splice(i, 1); }
    flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.hidden = true; }
    saveT += dt; if (saveT > 20 && dirty) saveNow();
  }
  function spark(x, y, id, n) {
    const col = id === 1000 ? [90, 210, 120] : avg[id] || [200, 200, 200];
    for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5 - 1, life: 0.5 + Math.random() * 0.5, c: col, s: 0.1 + Math.random() * 0.12 });
  }
  function floatText(text, color) {
    const p = game.player;
    for (const f of floats) if (f.text === text && f.life > 0.8) { return; }
    floats.push({ x: p.x + p.w / 2, y: p.y - 0.4 - floats.length * 0.35, text, color, life: 1.4 });
  }

  // =====================================================================
  // Zeichnen
  // =====================================================================
  const stars = []; { const r = mulberry32(99); for (let i = 0; i < 90; i++) stars.push([r(), r() * 0.7, 0.5 + r()]); }
  const clouds = []; { const r = mulberry32(5); for (let i = 0; i < 9; i++) clouds.push({ x: r() * 2400, y: 20 + r() * 150, w: 5 + Math.floor(r() * 6), s: 4 + r() * 8 }); }
  function skyColors(d, sunAlt) {
    const dayTop = [74, 146, 232], dayBot = [168, 214, 250], nightTop = [6, 8, 26], nightBot = [18, 24, 56];
    const k = clamp((d - 0.06) / 0.94, 0, 1), e = k * k * (3 - 2 * k);
    let top = mix(nightTop, dayTop, e), bot = mix(nightBot, dayBot, e);
    const warm = Math.exp(-((sunAlt / 0.28) ** 2));
    top = mix(top, [132, 96, 170], warm * 0.5); bot = mix(bot, [252, 150, 84], warm * 0.75);
    return [top, bot];
  }
  function draw(dt) {
    const cw = canvas.width, ch = canvas.height, tile = T * S;
    const d = Math.min(1, game.dayFactor() * 1.3), sunAlt = Math.sin(2 * Math.PI * (game.time - 0.25));
    g.imageSmoothingEnabled = false;
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 6 * S * shake * 4) : 0, sy = shake > 0 ? Math.round((Math.random() - 0.5) * 6 * S * shake * 4) : 0;
    g.setTransform(1, 0, 0, 1, sx, sy);
    const left = cam.x - cw / 2 / tile, top = cam.y - ch / 2 / tile;
    const x0 = Math.floor(left), y0 = Math.floor(top);
    const offX = Math.round((left - x0) * tile), offY = Math.round((top - y0) * tile);
    const scr = (wx, wy) => [Math.round((wx - left) * tile), Math.round((wy - top) * tile)];

    // --- Himmel ---
    const [c1, c2] = skyColors(d, sunAlt);
    const horizon = Math.round((60 - top) * tile);        // Höhe der Dorfwiese auf dem Bildschirm
    const grad = g.createLinearGradient(0, 0, 0, Math.max(ch, horizon + tile * 6));
    grad.addColorStop(0, rgb(c1)); grad.addColorStop(1, rgb(c2));
    g.fillStyle = grad; g.fillRect(-8, -8, cw + 16, ch + 16);
    if (d < 0.7) { const a = clamp((0.7 - d) * 1.6, 0, 1); g.fillStyle = "#fff"; for (const [sx0, sy0, sz] of stars) { g.globalAlpha = a * (0.5 + 0.5 * Math.sin(game.time * 400 + sx0 * 50)); g.fillRect(Math.round(sx0 * cw), Math.round(sy0 * Math.max(60, horizon)), Math.ceil(sz * S * 0.7), Math.ceil(sz * S * 0.7)); } g.globalAlpha = 1; }
    // Sonne und Mond ziehen im Bogen über den Himmel
    const arcY = Math.max(80 * S, Math.min(horizon, ch)), arcH = Math.min(arcY * 0.85, ch * 0.6);
    const body = (u, col, glow, r) => {
      if (u < -0.1 || u > 1.1) return;
      const bx = u * cw, by = arcY - Math.sin(clamp(u, 0, 1) * Math.PI) * arcH;
      const gr = g.createRadialGradient(bx, by, r * 0.4, bx, by, r * 4); gr.addColorStop(0, glow); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(bx - r * 4, by - r * 4, r * 8, r * 8);
      g.fillStyle = col; g.fillRect(Math.round(bx - r), Math.round(by - r), r * 2, r * 2);
    };
    const tt = game.time;
    if (tt >= 0.2 && tt <= 0.8) body((tt - 0.2) / 0.6, "#fff6c8", "rgba(255,230,140,.45)", 7 * S);
    const mt = tt >= 0.7 ? (tt - 0.7) / 0.6 : (tt + 0.3) / 0.6;
    if (mt >= 0 && mt <= 1 && d < 0.8) { g.globalAlpha = clamp((0.8 - d) * 2, 0, 1); body(mt, "#e6ecff", "rgba(170,190,255,.35)", 5 * S); g.globalAlpha = 1; }
    // Wolken
    g.globalAlpha = clamp(d * 1.1, 0.08, 0.9);
    for (const c of clouds) {
      const wx = ((c.x + game.time * DAY_LEN * c.s - cam.x * tile * 0.15) % (cw + 600) + cw + 600) % (cw + 600) - 300;
      const cy = Math.round(c.y * S * 0.6 - (top - 40) * tile * 0.05);
      g.fillStyle = d > 0.4 ? "#ffffff" : "#8b92b8";
      for (let i = 0; i < c.w; i++) { const hh = (i === 0 || i === c.w - 1 ? 1 : 2 + (i % 2)) * 3 * S; g.fillRect(Math.round(wx + i * 5 * S), cy - hh, 5 * S, hh + 3 * S); }
    }
    g.globalAlpha = 1;
    // Ferne Hügel (zwei Ebenen)
    const hillCol = (a, b) => rgb(mix(mix([18, 22, 44], a, clamp(d * 1.2, 0, 1)), b, 0.0));
    for (let layer = 0; layer < 2; layer++) {
      const par = layer ? 0.45 : 0.25, amp = layer ? 14 : 24, base = horizon - (layer ? 6 : 26) * S;
      g.fillStyle = layer ? hillCol([88, 138, 108], [0, 0, 0]) : hillCol([116, 160, 188], [0, 0, 0]);
      for (let x = 0; x < cw; x += 4 * S) {
        const wx = x + cam.x * tile * par;
        const yy = base - (Math.sin(wx * 0.0042 / S + layer * 2) * amp + Math.sin(wx * 0.011 / S + layer) * amp * 0.45) * S * 0.6;
        const yTop = Math.round(yy);
        if (yTop < ch) g.fillRect(x, yTop, 4 * S, ch - yTop);
      }
    }

    // --- Blöcke ---
    const vw = Math.ceil(cw / tile) + 2, vh = Math.ceil(ch / tile) + 2;
    for (let j = 0; j < vh; j++) {
      const ty = y0 + j;
      if (ty < 0 || ty >= H) continue;
      for (let i = 0; i < vw; i++) {
        const tx = x0 + i;
        if (tx < 0 || tx >= W) continue;
        const px = i * tile - offX, py = j * tile - offY;
        const id = game.tiles[ty * W + tx], gy = game.ground[tx];
        if (ty > gy && (id === B.AIR || !BLOCKS[id].solid || id === B.GLASS)) g.drawImage(atlas, (ty < gy + 7 ? IDX.WALL_DIRT : IDX.WALL_STONE) * T, 0, T, T, px, py, tile, tile);
        if (id === B.AIR) continue;
        let idx = id;
        if (id === B.FLOWER) idx = [B.FLOWER, IDX.FLOWER2, IDX.FLOWER3][(tx * 7 + ty * 3) % 3];
        g.drawImage(atlas, idx * T, 0, T, T, px, py, tile, tile);
        if (id === B.TORCH) { const fl = 0.5 + 0.5 * Math.sin(game.time * 3000 + tx * 2.1); g.fillStyle = `rgba(255,${180 + fl * 60 | 0},80,${0.35 + fl * 0.3})`; g.fillRect(px + 6 * S, py + (2 + (fl > 0.6 ? 0 : 1)) * S, 4 * S, 3 * S); }
      }
    }
    // Risse am Block, den man gerade abbaut, und Zielrahmen
    const mn = game.mining;
    if (mn && !mn.weak) { const [bx, by] = scr(mn.x, mn.y); g.drawImage(atlas, (IDX.CRACK + clamp(Math.floor(mn.p * 5), 0, 4)) * T, 0, T, T, bx, by, tile, tile); }
    if (state === "playing" && mouse.in !== false && (mouse.in || mouse.down)) {
      const m = worldMouse(), tx = Math.floor(m.x), ty = Math.floor(m.y), [bx, by] = scr(tx, ty), ok = game.reachOk(tx, ty);
      g.strokeStyle = ok ? "rgba(255,255,255,.85)" : "rgba(255,90,90,.55)"; g.lineWidth = Math.max(1, S); g.strokeRect(bx + S * 0.5, by + S * 0.5, tile - S, tile - S);
    }

    // --- Figuren ---
    for (const v of game.villagers) drawVillager(v, scr);
    for (const s of game.slimes) drawSlime(s, scr);
    drawPlayer(scr);
    // Partikel
    for (const q of parts) { const [bx, by] = scr(q.x, q.y); g.globalAlpha = clamp(q.life * 2, 0, 1); g.fillStyle = rgb(q.c); g.fillRect(bx, by, Math.max(2, q.s * tile), Math.max(2, q.s * tile)); }
    g.globalAlpha = 1;

    // --- Licht: eine Pixelkarte (1 Pixel = 1 Block), weich auf den Bildschirm gezogen ---
    drawLight(vw, vh, x0, y0, offX, offY, d, tile, cw, ch);

    // --- Text über den Figuren (nicht abgedunkelt) ---
    g.textBaseline = "middle"; g.textAlign = "center";
    for (const v of game.villagers) if (v.sayT > 0 && v.say) bubble(v.say, ...scr(v.x + v.w / 2, v.y - 0.2));
    g.font = `bold ${Math.round(5 * S)}px system-ui, sans-serif`;
    for (const f of floats) { const [fx, fy] = scr(f.x, f.y); g.globalAlpha = clamp(f.life * 1.6, 0, 1); g.lineWidth = S; g.strokeStyle = "rgba(0,0,0,.7)"; g.strokeText(f.text, fx, fy); g.fillStyle = f.color; g.fillText(f.text, fx, fy); }
    g.globalAlpha = 1;
    if (flash > 0) { g.fillStyle = `rgba(210,30,30,${flash * 0.5})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
  }

  let lightImg = null, glowImg = null, lightW = 0, lightH = 0;
  function drawLight(vw, vh, x0, y0, offX, offY, d, tile, cw, ch) {
    const w = vw + 1, hh = vh + 1;
    if (lightCv.width !== w || lightCv.height !== hh) { lightCv.width = glowCv.width = w; lightCv.height = glowCv.height = hh; lightImg = lg.createImageData(w, hh); glowImg = gg.createImageData(w, hh); }
    const a = lightImg.data, b = glowImg.data, sky = game.sky, blk = game.blk, p = game.player;
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, fl = 1 + 0.05 * Math.sin(game.time * 2600);
    for (let j = 0; j < hh; j++) {
      const ty = y0 + j - 0, rowOk = ty >= 0 && ty < H;
      for (let i = 0; i < w; i++) {
        const tx = x0 + i, o = (j * w + i) * 4;
        let s = 0, bl = 0;
        if (rowOk && tx >= 0 && tx < W) { const k = ty * W + tx; s = sky[k] * d; bl = blk[k]; }
        else if (ty < 0 && tx >= 0 && tx < W) s = 15 * d;
        const near = Math.max(0, 1 - Math.hypot(tx + 0.5 - pcx, ty + 0.5 - pcy) / 4.2);
        const lum = Math.max(s, bl * fl, near * near * 5.2) / 15;
        const bright = Math.max(0.025, Math.pow(Math.min(1, lum), 0.82));
        const skyShare = s / (s + bl + 0.001), night = 1 - d;
        a[o] = 2 * night * skyShare; a[o + 1] = 6 * night * skyShare; a[o + 2] = 26 * night * skyShare; a[o + 3] = Math.round((1 - bright) * 255);
        const warm = bl > s ? Math.min(1, (bl * fl) / 15) : 0;
        b[o] = 255; b[o + 1] = 150; b[o + 2] = 70; b[o + 3] = Math.round(warm * warm * 0.42 * 255);
      }
    }
    lg.putImageData(lightImg, 0, 0); gg.putImageData(glowImg, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "low";
    // Pixel i deckt Block x0+i ab Bildschirmposition i*tile - offX; die Mitte des Pixels liegt in der Mitte des Blocks
    g.drawImage(lightCv, -offX, -offY, w * tile, hh * tile);
    g.globalCompositeOperation = "lighter";
    g.drawImage(glowCv, -offX, -offY, w * tile, hh * tile);
    g.globalCompositeOperation = "source-over";
    g.imageSmoothingEnabled = false;
  }
  function bubble(text, bx, by) {
    const fs = Math.round(5 * S); g.font = `${fs}px system-ui, sans-serif`;
    const words = text.split(" "), lines = []; let cur = "";
    for (const wd of words) { const t = cur ? cur + " " + wd : wd; if (g.measureText(t).width > 46 * S && cur) { lines.push(cur); cur = wd; } else cur = t; }
    lines.push(cur);
    const wmax = Math.max(...lines.map(l => g.measureText(l).width)) + 6 * S, hb = lines.length * (fs + 2) + 4 * S, x = bx - wmax / 2, y = by - hb - 3 * S;
    g.fillStyle = "rgba(255,255,255,.95)"; g.fillRect(Math.round(x), Math.round(y), Math.round(wmax), Math.round(hb));
    g.beginPath(); g.moveTo(bx - 2 * S, y + hb); g.lineTo(bx + 2 * S, y + hb); g.lineTo(bx, y + hb + 3 * S); g.closePath(); g.fill();
    g.fillStyle = "#222"; lines.forEach((l, i) => g.fillText(l, bx, y + 2.5 * S + (i + 0.5) * (fs + 2)));
  }
  // ---------- Figuren (aus Rechtecken gemalt; 1 Texturpixel = S Bildschirmpixel) ----------
  function drawPlayer(scr) {
    const p = game.player, [bx, by0] = scr(p.x - 0.0, p.y + (p.visOff || 0) * 0);
    const by = by0 + Math.round((p.visOff || 0) * T * S), flip = p.face < 0;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 && p.invuln < 1.2) return;     // Blinken nach Treffer
    g.save();
    g.translate(bx + (flip ? Math.round(p.w * T * S) : 0), by); g.scale(flip ? -1 : 1, 1);
    const R = (x, y, w, h2, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h2 * S)); };
    const sw = p.onGround ? Math.sin(walkPh * 2.2) * (Math.abs(p.vx) > 0.5 ? 2.6 : 0) : 2;
    const bob = p.onGround && Math.abs(p.vx) > 0.5 ? Math.abs(Math.sin(walkPh * 2.2)) * 0.8 : 0;
    // Beine
    R(3 + sw * 0.5, 18 - bob, 3, 8, "#463c78"); R(7 - sw * 0.5, 18 - bob, 3, 8, "#3a3264");
    R(2.5 + sw * 0.5, 25.5 - bob, 4, 2.5, "#3c2a1c"); R(6.5 - sw * 0.5, 25.5 - bob, 4, 2.5, "#2e2014");
    // Körper
    R(2, 9 - bob, 9, 9.5, "#3c6ec8"); R(2, 9 - bob, 9, 1.3, "#5a8ee0"); R(2, 17 - bob, 9, 1.3, "#3c281c");
    // Kopf
    R(3, 2 - bob, 7, 7, "#ecbc94"); R(3, 1 - bob, 8, 2.6, "#54341e"); R(2, 1.6 - bob, 2, 5.5, "#54341e"); R(8, 4.6 - bob, 1.6, 1.6, "#1e1e28"); R(7.5, 7 - bob, 2.5, 0.8, "#c88a6c");
    // Arm und Werkzeug
    const swing = p.swing ? Math.sin(performance.now() / 55) : 0;
    const hx = 9.5, hy = 11 - bob;
    g.save(); g.translate(Math.round(hx * S), Math.round(hy * S)); g.rotate(p.swing ? -0.5 + swing * 0.9 : 0.25);
    R(-1, -0.5, 2.6, 6.5, "#3c6ec8"); R(-1, 5.5, 2.6, 2, "#ecbc94");
    if (p.swing) {
      const sword = game.slimes.length && game.player.atkCd > 0;
      g.translate(0, Math.round(6 * S));
      if (sword) { R(0, -2.5, 13, 2, "#d0d4e0"); R(0, -4, 2.2, 5, "#7a5230"); }
      else { R(0, -1, 10, 2, "#7a5230"); const tc = ["#9a6c3c", "#9a6c3c", "#8d8f98", "#d4d8e4"][game.tier("pick")]; R(8, -5, 2.4, 10, tc); R(8, -5, 2.4, 1.3, "#ffffff77"); }
    }
    g.restore();
    g.restore();
  }
  function drawVillager(v, scr) {
    const [bx, by0] = scr(v.x, v.y), by = by0 + Math.round((v.visOff || 0) * T * S), flip = v.face < 0;
    const robes = [["#9b5a36", "#7a4426"], ["#4c8a56", "#376b40"], ["#8a5aa8", "#6a4486"]][v.look % 3];
    const moving = v.dir !== 0, bob = moving ? Math.abs(Math.sin(performance.now() / 120 + v.look)) * 0.7 : 0;
    g.save(); g.translate(bx + (flip ? Math.round(v.w * T * S) : 0), by); g.scale(flip ? -1 : 1, 1);
    const R = (x, y, w, h2, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h2 * S)); };
    R(2, 9 - bob, 7.5, 15.5, robes[0]); R(2, 22 - bob, 7.5, 2.5, robes[1]); R(1.5, 12.5 - bob, 8.5, 3, robes[1]);
    R(2.5, 25 - bob * 0.5, 3, 2, "#3c2a1c"); R(6, 25 - bob * 0.5, 3, 2, "#3c2a1c");
    R(2.5, 2.5 - bob, 6.5, 7, "#e2b48c"); R(8.4, 5.6 - bob, 2.3, 3, "#d29c78"); R(6.4, 4.6 - bob, 1.4, 1.4, "#1e1e28");
    R(2, 1.5 - bob, 7.5, 2.2, v.look === 1 ? "#d8d8d8" : "#4a3020"); R(1.5, 2 - bob, 1.6, 4, v.look === 1 ? "#d8d8d8" : "#4a3020");
    g.restore();
  }
  function drawSlime(s, scr) {
    const [bx, by] = scr(s.x, s.y), w = s.w * T * S, hh = s.h * T * S, sq = clamp(1 - s.vy * 0.03, 0.7, 1.35), sh = hh * sq, sw = w * (2 - sq) * 0.9 + w * 0.1;
    const x = bx + (w - sw) / 2, y = by + (hh - sh);
    g.globalAlpha = s.hurt > 0 ? 0.55 : 0.92;
    g.fillStyle = "#3cae5e"; g.fillRect(Math.round(x), Math.round(y + sh * 0.25), Math.round(sw), Math.round(sh * 0.75));
    g.fillRect(Math.round(x + sw * 0.12), Math.round(y), Math.round(sw * 0.76), Math.round(sh * 0.3));
    g.fillStyle = "#7ce09a"; g.fillRect(Math.round(x + sw * 0.18), Math.round(y + sh * 0.1), Math.round(sw * 0.3), Math.round(sh * 0.12));
    g.fillStyle = "#256f3c"; g.fillRect(Math.round(x), Math.round(y + sh * 0.85), Math.round(sw), Math.round(sh * 0.15));
    g.fillStyle = "#10281a"; g.fillRect(Math.round(x + sw * 0.28), Math.round(y + sh * 0.38), Math.round(sw * 0.12), Math.round(sh * 0.2)); g.fillRect(Math.round(x + sw * 0.62), Math.round(y + sh * 0.38), Math.round(sw * 0.12), Math.round(sh * 0.2));
    g.globalAlpha = 1;
  }

  showOverlay("ready");
  hud();
  draw(0);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      try { if (state !== "ready" || dirty) saveNow(); } catch (_) {}
      if (ro) ro.disconnect();
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", autoPause);
      document.removeEventListener("visibilitychange", onVisibility);
      if (audio) { try { audio.close(); } catch (_) {} }
    }
  };
}
