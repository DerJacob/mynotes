// =====================================================================
// Blockdorf – Oberfläche: weiches Licht, Himmel mit Sonne/Mond/Sternen, Partikel, Inventar-Fenster,
// Steuerung per Tastatur/Maus/Touch. Texturen und Symbole stehen in sandbox-art.js, die Regeln in
// sandbox-engine.js / sandbox-inventory.js.
//   A/D laufen · W/Leertaste springen (Leiter: W hoch, S runter) · linke Maustaste abbauen/kämpfen
//   rechte Maustaste benutzen/bauen/essen · 1–9 oder Mausrad: Platz wählen · E Inventar · Q werfen · P/Esc Pause
// =====================================================================
import { Sandbox, W, H, SURF, B, BLOCKS, ITEMS, RECIPES, REACH, DAY_LEN, MAX_HP, mulberry32, BIOME_NAMES, MOBS, ADV } from "./sandbox-engine.js?v=4";
import { makeArt, IDX, ORE_DEEP, T } from "./sandbox-art.js?v=4";
import { drawMob, drawProjectile, MOB_COLORS } from "./sandbox-mobart.js?v=4";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const fmt = n => new Intl.NumberFormat("de-DE").format(n);
const TAGNAME = { "#planks": "Bretter", "#coals": "Kohle", "#logs": "Baumstämme" };
const DEEP_Y = SURF + 74;           // ab hier werden Erze auf Tiefenschiefer gemalt

// =====================================================================
// mount
// =====================================================================
export function mount(root, ctx) {
  const { h } = ctx;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const art = makeArt(), atlas = art.atlas, avg = art.avg;

  // ---------- Welt laden oder neu erzeugen ----------
  let game;
  let hadSave = false;
  try { if (ctx.record && ctx.record.w) { game = new Sandbox({ data: ctx.record.w }); hadSave = true; } } catch (_) { game = null; }
  if (!game) game = new Sandbox({});
  let state = "ready", raf = 0, last = 0, destroyed = false, confirmNew = false;
  let saveT = 0, dirty = false, flash = 0, toastT = 0, sound = false, touchMode = "mine", placeCd = 0, swingT = 0, walkPh = 0, shake = 0, fade = 0, whiteout = 0;
  const keys = { left: false, right: false, jump: false, down: false };
  const mouse = { px: 0, py: 0, in: false, down: false, btn: 0 };
  const cam = { x: game.player.x, y: game.player.y };
  const parts = [], floats = [];
  let audio = null;

  // ---------- Oberfläche ----------
  const canvas = h("canvas", { class: "sb-canvas" });
  const g = canvas.getContext("2d");
  const lightCv = document.createElement("canvas"), lg = lightCv.getContext("2d");
  const glowCv = document.createElement("canvas"), gg = glowCv.getContext("2d");
  const info = h("div", { class: "sb-info" });
  const heldName = h("div", { class: "sb-held", hidden: true });
  const barsRow = h("div", { class: "sb-barsrow" });
  const armorRow = h("div", { class: "sb-iconrow" }), heartsRow = h("div", { class: "sb-iconrow" }), foodRow = h("div", { class: "sb-iconrow" }), airRow = h("div", { class: "sb-iconrow sb-airrow" });
  const xpFill = h("div", { class: "sb-xpfill" }), xpLvl = h("div", { class: "sb-xplvl" });
  const xpBar = h("div", { class: "sb-xp" }, xpFill, xpLvl);
  const hotbar = h("div", { class: "sb-hotbar" });
  const toastEl = h("div", { class: "sb-toast", hidden: true });
  const cursorEl = h("div", { class: "sb-cursor", hidden: true });
  const winPanel = h("div", { class: "sb-win" });
  const bookPanel = h("div", { class: "sb-book" });
  const winWrap = h("div", { class: "sb-winwrap", hidden: true }, h("div", { class: "sb-wincol" }, winPanel, bookPanel));
  const btn = (label, title, fn, cls = "") => h("button", { class: "sb-btn " + cls, type: "button", title, "aria-label": title, onclick: fn }, label);
  const soundBtn = btn("🔇", "Ton an/aus", () => { sound = !sound; if (sound) ensureAudio(); soundBtn.textContent = sound ? "🔊" : "🔇"; blurFocus(); });
  const invBtn = btn("🎒", "Inventar (E)", () => { toggleInv(); blurFocus(); });
  const advBtn = btn("🏆", "Fortschritte (G)", () => { toggleAdv(); blurFocus(); });
  const pauseBtn = btn("⏸", "Pause (P)", () => { pause(); });
  const ovTitle = h("div", { class: "tg-ov-title" }, "Blockdorf");
  const ovText = h("div", { class: "sb-ov-text" });
  const ovBtn = h("button", { class: "btn", type: "button", onclick: () => primary() });
  const ovNew = h("button", { class: "btn ghost small", type: "button", onclick: () => newWorld() }, "Neue Welt");
  const overlay = h("div", { class: "tg-overlay sb-overlay" }, ovTitle, ovText, ovBtn, ovNew);
  const kbd = t => h("kbd", null, t);
  const help = h("div", { class: "sb-help" },
    h("div", null, kbd("A"), kbd("D"), " laufen · ", kbd("W"), " / ", kbd("Leertaste"), " springen · ", kbd("S"), " Leiter runter"),
    h("div", null, "Linke Maustaste: abbauen und kämpfen · rechte: benutzen, bauen, essen"),
    h("div", null, "Bogen: rechte Maustaste halten und loslassen · Schild: rechte Maustaste halten · ", kbd("G"), " Fortschritte"),
    h("div", null, kbd("1"), "–", kbd("9"), " / Mausrad: Platz · ", kbd("E"), " Inventar · ", kbd("Q"), " werfen · ", kbd("P"), " Pause"));
  const touchBtn = (label, action, title) => {
    const b = h("button", { class: "tg-tb", type: "button", title, "aria-label": title }, label);
    const up = () => { act(action, false); b.classList.remove("on"); };
    b.addEventListener("pointerdown", e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add("on"); act(action, true); });
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
    return b;
  };
  const modeBtn = h("button", { class: "tg-tb sb-mode", type: "button", title: "Berühren: abbauen oder benutzen", onclick: () => { touchMode = touchMode === "mine" ? "use" : "mine"; modeBtn.textContent = touchMode === "mine" ? "⛏ Abbauen" : "🧱 Benutzen"; } }, "⛏ Abbauen");
  const touch = h("div", { class: "sb-touch" }, touchBtn("◀", "left", "Nach links"), touchBtn("▲", "jump", "Springen / hoch"), touchBtn("▼", "down", "Runter"), touchBtn("▶", "right", "Nach rechts"), modeBtn);

  root.appendChild(h("div", { class: "sb" },
    h("div", { class: "sb-view" }, canvas,
      h("div", { class: "sb-hud-top" }, h("div", { class: "sb-left" }, info), h("div", { class: "sb-right" }, advBtn, invBtn, soundBtn, pauseBtn)),
      toastEl, h("div", { class: "sb-bottom" }, heldName, barsRow, xpBar, hotbar), winWrap, cursorEl, overlay),
    touch, help));
  barsRow.append(h("div", { class: "sb-barcol" }, armorRow, heartsRow), h("div", { class: "sb-barcol sb-foodcol" }, airRow, foodRow));

  function blurFocus() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }

  // ---------- HUD ----------
  const sig = { bars: "", hot: "", win: "", info: "", xp: "", book: "" };
  const iconRow = (row, kind, n, vals) => {
    row.textContent = "";
    for (let i = 0; i < n; i++) row.appendChild(art.hud[kind](vals(i)));
  };
  function slotEl(area, idx, st, cls = "") {
    const it = st && ITEMS[st.id];
    const el = h("div", { class: "sb-s " + cls, "data-area": area, "data-idx": String(idx), title: it ? it.name : "" });
    if (st) {
      el.appendChild(art.icon(st.id, 32));
      if (st.n > 1) el.appendChild(h("span", { class: "sb-n" }, String(st.n)));
      if (it.dur && st.d > 0) { const f = 1 - st.d / it.dur; el.appendChild(h("div", { class: "sb-dur" }, h("i", { style: { width: Math.round(f * 100) + "%", background: `hsl(${Math.round(f * 120)},80%,45%)` } }))); }
    }
    return el;
  }
  function hud() {
    const p = game.player;
    const nAir = p.air < 14.95 ? Math.max(0, Math.min(10, Math.ceil(p.air / 1.5))) : -1;
    const sb = `${p.hp}|${game.food}|${game.defense()}|${nAir}`;
    if (sb !== sig.bars) {
      sig.bars = sb;
      iconRow(heartsRow, "heart", MAX_HP / 2, i => (p.hp >= i * 2 + 2 ? 1 : p.hp === i * 2 + 1 ? 0.5 : 0));
      iconRow(foodRow, "food", 10, i => (game.food >= i * 2 + 2 ? 1 : game.food === i * 2 + 1 ? 0.5 : 0));
      const df = game.defense();
      iconRow(armorRow, "armor", df > 0 ? 10 : 0, i => (df >= i * 2 + 2 ? 1 : df === i * 2 + 1 ? 0.5 : 0));
      iconRow(airRow, "bubble", Math.max(0, nAir), () => 1);
    }
    const sx = `${game.xp}`;
    if (sx !== sig.xp) { sig.xp = sx; xpFill.style.width = Math.round(game.levelFrac() * 100) + "%"; xpLvl.textContent = game.level() > 0 ? String(game.level()) : ""; }
    const sh = JSON.stringify(game.hotbar()) + "|" + game.sel;
    if (sh !== sig.hot) {
      sig.hot = sh; hotbar.textContent = "";
      game.hotbar().forEach((st, i) => {
        const el = slotEl("inv", i, st, "sb-slot" + (i === game.sel ? " on" : ""));
        el.appendChild(h("span", { class: "sb-key" }, String(i + 1)));
        hotbar.appendChild(el);
      });
      const cur = game.selStack();
      if (cur && cur.id !== lastHeld) { heldName.textContent = ITEMS[cur.id].name; heldName.hidden = false; heldT = 1.8; }
      lastHeld = cur ? cur.id : null;
    }
    const hour = Math.floor(game.time * 24), min = Math.floor((game.time * 24 - hour) * 60);
    const si = `Tag ${game.day} · ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")} · ${BIOME_NAMES[game.biomeAt(p.x + p.w / 2)]} · Höhe ${SURF - Math.floor(p.y + p.h / 2)}`;
    if (si !== sig.info) { sig.info = si; info.textContent = si; }
    syncWindow();
  }
  let lastHeld = null, heldT = 0;

  // ---------- Fenster: Inventar, Werkbank, Ofen, Truhe ----------
  const sizeOf = kind => (kind === "bench" ? 3 : 2);
  function syncWindow() {
    const w = game.win;
    if (!w) { if (!winWrap.hidden) { winWrap.hidden = true; cursorEl.hidden = true; sig.win = ""; } return; }
    if (winWrap.hidden) { winWrap.hidden = false; keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; game.blocking = false; game.bow = null; }
    const e = game.winEnt();
    const sg = JSON.stringify([w.kind, game.inv, game.armor, game.grid, game.cursor, e && e.s, w.kind === "adv" ? game.adv : 0]);
    if (sg !== sig.win) { sig.win = sg; renderWindow(); renderBook(); updateCursor(); }
    if (w.kind === "furnace" && e) { const f = winPanel.querySelector(".sb-flame i"), a = winPanel.querySelector(".sb-arrow i"); if (f) f.style.height = e.burnMax ? Math.round((e.burn / e.burnMax) * 100) + "%" : "0%"; if (a) a.style.width = Math.round((e.cook / 10) * 100) + "%"; }
  }
  const arrow = () => h("div", { class: "sb-arrow" }, h("i"));
  function renderWindow() {
    const w = game.win; winPanel.textContent = "";
    const title = { inv: "Inventar", bench: "Werkbank", furnace: "Ofen", chest: "Truhe", adv: "Fortschritte" }[w.kind];
    winPanel.appendChild(h("div", { class: "sb-wt" }, h("b", null, title), h("button", { class: "sb-x", type: "button", title: "Schließen (E)", onclick: () => { game.closeWindow(); blurFocus(); } }, "✕")));
    if (w.kind === "adv") {
      const ids = Object.keys(ADV), done = ids.filter(k => game.adv[k]).length;
      winPanel.appendChild(h("div", { class: "sb-advcount" }, `${done} von ${ids.length} geschafft`));
      const list = h("div", { class: "sb-advlist" });
      for (const k of [...ids.filter(k => game.adv[k]), ...ids.filter(k => !game.adv[k])]) {
        const ok = !!game.adv[k];
        list.appendChild(h("div", { class: "sb-adv" + (ok ? " ok" : "") }, h("div", { class: "sb-advic" }, ok ? "🏆" : "🔒"), h("div", null, h("div", { class: "sb-advn" }, ADV[k][0]), h("div", { class: "sb-advd" }, ADV[k][1]))));
      }
      winPanel.appendChild(list);
      return;
    }
    const row = (area, from, n, cls = "") => { const r = h("div", { class: "sb-srow " + cls }); for (let i = from; i < from + n; i++) r.appendChild(slotEl(area, i, game.slots(area)[i])); return r; };
    const grid = size => { const gEl = h("div", { class: "sb-grid", style: { gridTemplateColumns: `repeat(${size}, 40px)` } }); for (let i = 0; i < size * size; i++) gEl.appendChild(slotEl("grid", i, game.grid[i])); return gEl; };
    const outStack = () => { const r = game.craftResult(); return r ? { id: r.id, n: r.n, d: 0 } : null; };
    if (w.kind === "inv") {
      const armor = h("div", { class: "sb-armorcol" }); for (let i = 0; i < 4; i++) armor.appendChild(slotEl("armor", i, game.armor[i], "sb-armor" + i));
      winPanel.appendChild(h("div", { class: "sb-top" }, armor, h("div", { class: "sb-defense" }, h("div", { class: "sb-big" }, String(game.defense())), h("div", null, "Rüstung")), h("div", { class: "sb-craftbox" }, grid(2), arrow(), slotEl("out", 0, outStack(), "sb-out"))));
    } else if (w.kind === "bench") {
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-craftbox" }, grid(3), arrow(), slotEl("out", 0, outStack(), "sb-out"))));
    } else if (w.kind === "furnace") {
      const e = game.winEnt();
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-furn" },
        h("div", { class: "sb-fcol" }, slotEl("f", 0, e.s[0]), h("div", { class: "sb-flame" }, h("i")), slotEl("f", 1, e.s[1])),
        arrow(), slotEl("f", 2, e.s[2], "sb-out"))));
    } else if (w.kind === "chest") {
      winPanel.appendChild(h("div", { class: "sb-chest" }, row("chest", 0, 9), row("chest", 9, 9), row("chest", 18, 9)));
    }
    winPanel.appendChild(h("div", { class: "sb-wl" }, "Inventar"));
    winPanel.appendChild(h("div", { class: "sb-invbox" }, row("inv", 9, 9), row("inv", 18, 9), row("inv", 27, 9), h("div", { class: "sb-gap" }), row("inv", 0, 9)));
  }
  function ingText(r) {
    const cnt = new Map();
    if (r.shape) { for (const row of r.shape) for (const ch of row) if (ch !== " ") cnt.set(r.key[ch], (cnt.get(r.key[ch]) || 0) + 1); }
    else for (const k of r.ingredients) cnt.set(k, (cnt.get(k) || 0) + 1);
    return [...cnt].map(([k, n]) => `${n}× ${TAGNAME[k] || ITEMS[k].name}`).join(" · ");
  }
  function renderBook() {
    bookPanel.textContent = "";
    const w = game.win;
    if (!w || (w.kind !== "inv" && w.kind !== "bench")) { bookPanel.hidden = true; return; }
    bookPanel.hidden = false;
    bookPanel.appendChild(h("div", { class: "sb-wt" }, h("b", null, "Rezepte")));
    const size = sizeOf(w.kind);
    const list = RECIPES.map(r => ({ r, can: game.recipeAvailable(r), big: game.recipeNeedsBench(r) })).filter(x => !(x.big && size === 2 && !x.can));
    list.sort((a, b) => (b.can && (!b.big || size === 3)) - (a.can && (!a.big || size === 3)));
    const box = h("div", { class: "sb-booklist" });
    for (const { r, can, big } of list) {
      const ok = can && (!big || size === 3);
      box.appendChild(h("button", { class: "sb-rec" + (ok ? " can" : ""), type: "button", title: ingText(r), onclick: () => { if (!game.fillRecipe(r.id)) say(big && size === 2 ? "Dafür brauchst du eine Werkbank." : "Dir fehlt etwas dafür.", 1800); sig.win = ""; blurFocus(); } },
        art.icon(r.out[0], 28), h("div", { class: "sb-rm" }, h("div", { class: "sb-rn" }, (r.out[1] > 1 ? r.out[1] + "× " : "") + ITEMS[r.out[0]].name), h("div", { class: "sb-rc" }, ingText(r) + (big ? " · Werkbank" : "")))));
    }
    bookPanel.appendChild(box);
  }
  function updateCursor() {
    const c = game.cursor;
    cursorEl.textContent = "";
    if (!c || !game.win) { cursorEl.hidden = true; return; }
    cursorEl.hidden = false;
    cursorEl.appendChild(art.icon(c.id, 32));
    if (c.n > 1) cursorEl.appendChild(h("span", { class: "sb-n" }, String(c.n)));
  }
  winWrap.addEventListener("pointermove", e => {
    const r = winWrap.getBoundingClientRect();
    cursorEl.style.transform = `translate(${e.clientX - r.left - 16}px, ${e.clientY - r.top - 16}px)`;
  });
  winWrap.addEventListener("contextmenu", e => e.preventDefault());
  winWrap.addEventListener("pointerdown", e => {
    e.preventDefault();
    const s = e.target.closest && e.target.closest(".sb-s");
    const r = winWrap.getBoundingClientRect();
    cursorEl.style.transform = `translate(${e.clientX - r.left - 16}px, ${e.clientY - r.top - 16}px)`;
    if (s) {
      const area = s.getAttribute("data-area"), idx = Number(s.getAttribute("data-idx")), right = e.button === 2;
      if (e.shiftKey && !right) game.shiftClick(area, idx); else game.click(area, idx, right);
      sfx("click"); dirty = true; sig.win = "";
    } else if (!e.target.closest(".sb-win") && !e.target.closest(".sb-book")) { if (game.cursor) game.throwCursor(true); else game.closeWindow(); sig.win = ""; }
  });
  hotbar.addEventListener("pointerdown", e => {
    const el = e.target.closest && e.target.closest(".sb-s");
    if (el && !game.win) { e.preventDefault(); game.select(Number(el.getAttribute("data-idx"))); }
  });
  function toggleInv() { if (game.win) game.closeWindow(); else game.openWindow("inv"); sig.win = ""; }
  function toggleAdv() { if (game.win && game.win.kind === "adv") game.closeWindow(); else game.openWindow("adv"); sig.win = ""; }
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
    else if (k === "door") tone(200, 0.08, "square", 0.04, -60); else if (k === "eat") { tone(300, 0.05, "square", 0.04); setTimeout(() => tone(260, 0.05, "square", 0.04), 80); }
    else if (k === "hiss") tone(700, 0.18, "sawtooth", 0.025, -450);
    else if (k === "boom") { tone(70, 0.55, "sawtooth", 0.09, -40); tone(120, 0.4, "square", 0.06, -80); }
    else if (k === "shoot") tone(520, 0.12, "triangle", 0.05, -380); else if (k === "thunk") tone(150, 0.06, "square", 0.04, -60);
    else if (k === "block") { tone(900, 0.05, "square", 0.04); tone(600, 0.07, "square", 0.03); }
    else if (k === "tame") { tone(660, 0.08, "triangle", 0.05); setTimeout(() => tone(880, 0.12, "triangle", 0.05), 90); }
    else if (k === "tp") tone(900, 0.2, "sine", 0.04, -700); else if (k === "splash") tone(300, 0.2, "sawtooth", 0.025, 200);
    else if (k === "adv") { tone(523, 0.12, "triangle", 0.06); setTimeout(() => tone(659, 0.12, "triangle", 0.06), 120); setTimeout(() => tone(784, 0.25, "triangle", 0.06), 240); }
    else if (k === "xp") tone(900 + Math.random() * 300, 0.06, "sine", 0.03); else if (k === "click") tone(420, 0.03, "square", 0.02);
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
    state = "paused"; cancelAnimationFrame(raf); raf = 0; keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; game.mineStop(); game.bow = null; game.blocking = false;
    saveNow(); confirmNew = false; showOverlay("paused"); draw(0);
  }
  function newWorld() {
    if (!confirmNew) { confirmNew = true; showOverlay(state === "paused" ? "paused" : "ready"); return; }
    confirmNew = false; game = new Sandbox({}); hadSave = false; parts.length = 0; floats.length = 0; cam.x = game.player.x; cam.y = game.player.y;
    for (const k of Object.keys(sig)) sig[k] = ""; lastHeld = null; saveNow(); state = "ready"; showOverlay("ready"); hud(); draw(0);
  }
  function saveNow() { ctx.save({ w: game.toData(), day: game.day, mined: game.stats.mined, built: game.stats.built, kills: game.stats.kills, level: game.level() }); dirty = false; saveT = 0; }

  // ---------- Eingabe ----------
  function act(a, on) {
    if (a === "left") keys.left = on; else if (a === "right") keys.right = on; else if (a === "jump") keys.jump = on; else if (a === "down") keys.down = on;
  }
  const KEYMAP = { a: "left", A: "left", ArrowLeft: "left", d: "right", D: "right", ArrowRight: "right", w: "jump", W: "jump", ArrowUp: "jump", " ": "jump", s: "down", S: "down", ArrowDown: "down" };
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || ctx.blocked()) return;
    const t = e.target;
    if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
    if (state !== "playing") {
      if (e.key === "Enter" || (e.key === " " && state !== "paused")) { e.preventDefault(); if (!e.repeat) primary(); }
      else if (state === "paused" && (e.key === "p" || e.key === "P" || e.key === "Escape")) { e.preventDefault(); if (!e.repeat) primary(); }
      return;
    }
    if (e.key === "e" || e.key === "E") { e.preventDefault(); if (!e.repeat) toggleInv(); return; }
    if (e.key === "g" || e.key === "G") { e.preventDefault(); if (!e.repeat) toggleAdv(); return; }
    if (e.key === "Escape" && game.win) { e.preventDefault(); game.closeWindow(); sig.win = ""; return; }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") { e.preventDefault(); if (!e.repeat) pause(); return; }
    if (e.key >= "1" && e.key <= "9") { e.preventDefault(); game.select(Number(e.key) - 1); return; }
    if (game.win) return;
    const a = KEYMAP[e.key];
    if (a) { e.preventDefault(); act(a, true); return; }
    if (e.key === "q" || e.key === "Q") { e.preventDefault(); game.throwHeld(e.shiftKey); dirty = true; }
    else if (e.key === "m" || e.key === "M") { soundBtn.click ? soundBtn.click() : null; }
  }
  function onKeyUp(e) { const a = KEYMAP[e.key]; if (a) act(a, false); }
  function autoPause() { keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; if (state === "playing") pause(); }
  const onVisibility = () => { if (document.hidden) autoPause(); };
  function setPointer(e) {
    const r = canvas.getBoundingClientRect(), w = r.width || 1, hh = r.height || 1;
    mouse.px = (e.clientX - r.left) * (canvas.width / w); mouse.py = (e.clientY - r.top) * (canvas.height / hh); mouse.in = true;
  }
  canvas.addEventListener("pointerdown", e => {
    if (state !== "playing") return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    setPointer(e); mouse.down = true; ensureAudio();
    mouse.btn = e.pointerType === "touch" || e.pointerType === "pen" ? (touchMode === "use" ? 2 : 0) : (e.button === 2 ? 2 : 0);
    placeCd = 0; mouse.first = true;
    if (mouse.btn === 2) {                       // Benutzen sofort ausführen, damit auch ganz kurze Klicks/Tipper zählen
      const m = worldMouse();
      mouse.first = false;
      if (game.use(Math.floor(m.x), Math.floor(m.y))) { placeCd = 0.25; dirty = true; mouse.used = true; }
      else if (game.selItem() === "bow" && game.count("arrow") === 0) say("Du brauchst Pfeile für den Bogen.", 1800);
    } else mouse.used = false;
  });
  canvas.addEventListener("pointermove", setPointer);
  const up = () => {
    if (mouse.down && mouse.btn === 2 && game.bow) { const m = worldMouse(); if (game.bowRelease(m.x, m.y)) { dirty = true; } }
    game.bow = null; game.blocking = false; mouse.used = false;
    mouse.down = false; game.mineStop();
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", () => { mouse.in = false; });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => { if (state !== "playing") return; e.preventDefault(); game.select((game.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9); }, { passive: false });
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
    const lock = !!game.win;
    game.input.left = !lock && keys.left; game.input.right = !lock && keys.right; game.input.jump = !lock && keys.jump; game.input.down = !lock && keys.down;
    // Maus: abbauen, kämpfen, bauen
    let mining = false;
    if (mouse.down && mouse.in !== false) {
      const m = worldMouse(), tx = Math.floor(m.x), ty = Math.floor(m.y);
      if (mouse.btn === 2) {
        placeCd -= dt;
        const heldIt = game.selItem();
        if (heldIt === "shield") game.blocking = true; else if (heldIt === "bow" && !mouse.used) { if (game.bowDraw(dt) && game.bow.t < dt * 1.5) sfx("click"); }
        if (mouse.first) { mouse.first = false; if (game.use(tx, ty)) { placeCd = 0.25; dirty = true; } }
        else if (placeCd <= 0) { const it = game.selItem(); if (it && ITEMS[it].block && !BLOCKS[game.tile(tx, ty)].interact && game.place(tx, ty)) { placeCd = 0.12; dirty = true; } }
      }
      else if (game.attack(m.x, m.y)) { swingT = 0.25; sfx("kill"); }
      else { const r = game.mineStep(tx, ty, dt); mining = r === 1 || r === 2; if (mining && Math.random() < dt * 9) sfx("pick"); if (r === 1 && Math.random() < dt * 22) spark(tx + 0.5, ty + 0.5, game.tile(tx, ty), 1); }
    } else game.mineStop();
    game.aim = mouse.in ? worldMouse() : null;
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
      else if (e.t === "place") { spark(e.x + 0.5, e.y + 0.5, e.id, 3); sfx("place"); }
      else if (e.t === "door") sfx("door");
      else if (e.t === "eat") sfx("eat");
      else if (e.t === "xp") { sfx("xp"); }
      else if (e.t === "level") say(`Erfahrungsstufe ${e.level}!`, 2200);
      else if (e.t === "toolbreak") { say(`${ITEMS[e.item].name} ist kaputtgegangen.`, 2600); sfx("hurt"); }
      else if (e.t === "needbench") say("Dafür brauchst du eine Werkbank.", 1800);
      else if (e.t === "noharvest") say("Damit bekommst du davon nichts – du brauchst das richtige Werkzeug.", 2800);
      else if (e.t === "craft") sfx("craft");
      else if (e.t === "pickup") floatText(`+${e.n} ${ITEMS[e.item].name}`, "#fff3b0");
      else if (e.t === "hurt") { flash = 0.5; shake = 0.25; sfx("hurt"); if (e.why === "lava") say("Autsch – Lava!", 1200); else if (e.why === "drown") say("Du ertrinkst! Schwimm nach oben (Leertaste).", 1500); }
      else if (e.t === "hiss") { spark(e.x + 0.5, e.y + 0.5, B.STONE, 7); sfx("hiss"); }
      else if (e.t === "bucket") { spark(e.x + 0.5, e.y + 0.5, e.fill ? B.WATER : B.LAVA, 6); sfx("place"); dirty = true; }
      else if (e.t === "died") say("Du bist gestorben. Deine Sachen liegen dort, wo es passiert ist – du hast 5 Minuten.", 5000);
      else if (e.t === "day") say(`Tag ${e.day}`, 2200);
      else if (e.t === "hit") { spark(e.x, e.y + 0.4, [200, 40, 40], 5); floats.push({ x: e.x, y: e.y - 0.2, text: `-${e.n}`, color: e.src === "player" || e.src === "arrow" ? "#ffe0a0" : "#ffb0a0", life: 0.9 }); if (e.src === "player") sfx("kill"); }
      else if (e.t === "kill") { spark(e.x, e.y, MOB_COLORS[e.type] || [200, 200, 200], 14); sfx("kill"); }
      else if (e.t === "crit") { floats.push({ x: e.x, y: e.y - 0.9, text: "Krit!", color: "#fff070", life: 0.9 }); }
      else if (e.t === "shoot") sfx("shoot");
      else if (e.t === "thunk") sfx("thunk");
      else if (e.t === "block") { spark(game.player.x + game.player.w / 2 + game.player.face * 0.6, game.player.y + 0.8, [210, 214, 226], 6); sfx("block"); }
      else if (e.t === "splash") { spark(e.x, e.y, [180, 70, 220], 14); sfx("splash"); }
      else if (e.t === "fuse") sfx("hiss");
      else if (e.t === "boom") {
        spark(e.x, e.y, B.STONE, 26); spark(e.x, e.y, B.DIRT, 14); spark(e.x, e.y, [70, 70, 70], 22); spark(e.x, e.y, [255, 190, 70], 14); sfx("boom"); whiteout = 0.35; dirty = true;
        const d = Math.hypot(e.x - game.player.x, e.y - game.player.y); shake = Math.max(shake, clamp(1 - d / 16, 0, 1) * 0.8);
      }
      else if (e.t === "tp") { spark(e.x + 0.3, e.y + 1, [176, 60, 232], 10); sfx("tp"); }
      else if (e.t === "tame") { for (let i = 0; i < 4; i++) floats.push({ x: e.x + (i - 1.5) * 0.4, y: e.y - 0.3 - (i % 2) * 0.3, text: "❤", color: "#ff6080", life: 1.1 }); sfx("tame"); dirty = true; }
      else if (e.t === "smoke") floats.push({ x: e.x, y: e.y - 0.3, text: "…", color: "#d0d0d0", life: 0.9 });
      else if (e.t === "sit") say(e.sit ? "Er bleibt sitzen." : "Er folgt dir wieder.", 1400);
      else if (e.t === "shear") { spark(e.x, e.y + 0.6, [236, 236, 230], 10); sfx("click"); dirty = true; }
      else if (e.t === "nosleep") say(e.why === "day" ? "Du kannst nur nachts schlafen." : "Du kannst jetzt nicht schlafen – Monster sind in der Nähe!", 2400);
      else if (e.t === "sleep") { fade = 1.6; say("Gute Nacht … der Morgen graut.", 2400); dirty = true; }
      else if (e.t === "nobed") say("Dein Bett fehlt oder wurde zerstört – du startest am Dorf.", 3600);
      else if (e.t === "adv") { say(`🏆 Fortschritt: ${e.name}`, 4200); sfx("adv"); dirty = true; sig.win = ""; }
      else if (e.t === "jump") sfx("jump");
    }
    game.events.length = 0;
    // Partikel, Schwebetexte, Meldungen
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt; q.vy += 24 * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) parts.splice(i, 1); }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y -= dt * 0.9; if (f.life <= 0) floats.splice(i, 1); }
    flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt); fade = Math.max(0, fade - dt); whiteout = Math.max(0, whiteout - dt);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.hidden = true; }
    if (heldT > 0) { heldT -= dt; if (heldT <= 0) heldName.hidden = true; }
    saveT += dt; if (saveT > 20 && dirty) saveNow();
  }
  function spark(x, y, id, n) {
    const col = Array.isArray(id) ? id : id === 1000 ? [90, 210, 120] : avg[id] || [200, 200, 200];
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
    const fluids = [];
    for (let j = 0; j < vh; j++) {
      const ty = y0 + j;
      if (ty < 0 || ty >= H) continue;
      for (let i = 0; i < vw; i++) {
        const tx = x0 + i;
        if (tx < 0 || tx >= W) continue;
        const px = i * tile - offX, py = j * tile - offY;
        const id = game.tiles[ty * W + tx], gy = game.ground[tx], bd = BLOCKS[id];
        if (ty > gy && (id === B.AIR || !bd.solid || id === B.GLASS)) g.drawImage(atlas, (ty < gy + 7 ? IDX.WALL_DIRT : ty >= DEEP_Y - 2 ? IDX.WALL_DEEP : IDX.WALL_STONE) * T, 0, T, T, px, py, tile, tile);
        if (id === B.AIR) continue;
        if (bd.fluid) { fluids.push(px, py, id, game.lvl[ty * W + tx], ty > 0 ? game.tiles[(ty - 1) * W + tx] : 0); continue; }
        let idx = id, row = 0;
        if (id === B.FLOWER) idx = [B.FLOWER, IDX.FLOWER2, IDX.FLOWER3][(tx * 7 + ty * 3) % 3];
        else if (id === B.FURNACE) { const fe = game.ents.get(tx + "," + ty); if (fe && fe.burn > 0) idx = IDX.FURNACE_LIT; }
        else if (id === B.GRASS || id === B.LEAVES || id === B.TALLGRASS) { idx = game.biomes[tx] * 3 + (id === B.GRASS ? 0 : id === B.LEAVES ? 1 : 2); row = 1; }
        else if (ty >= DEEP_Y && ORE_DEEP[id] != null) idx = ORE_DEEP[id];
        g.drawImage(atlas, idx * T, row * T, T, T, px, py, tile, tile);
        if (id === B.TORCH) { const fl = 0.5 + 0.5 * Math.sin(game.time * 3000 + tx * 2.1); g.fillStyle = `rgba(255,${180 + fl * 60 | 0},80,${0.35 + fl * 0.3})`; g.fillRect(px + 6 * S, py + (2 + (fl > 0.6 ? 0 : 1)) * S, 4 * S, 3 * S); }
      }
    }
    // Risse am Block, den man gerade abbaut, und Zielrahmen
    const mn = game.mining;
    if (mn) { const [bx, by] = scr(mn.x, mn.y); g.drawImage(atlas, (IDX.CRACK + clamp(Math.floor(mn.p * 5), 0, 4)) * T, 0, T, T, bx, by, tile, tile); }
    if (state === "playing" && mouse.in !== false && (mouse.in || mouse.down)) {
      const m = worldMouse(), tx = Math.floor(m.x), ty = Math.floor(m.y), [bx, by] = scr(tx, ty), ok = game.reachOk(tx, ty);
      g.strokeStyle = ok ? "rgba(255,255,255,.85)" : "rgba(255,90,90,.55)"; g.lineWidth = Math.max(1, S); g.strokeRect(bx + S * 0.5, by + S * 0.5, tile - S, tile - S);
    }

    // --- Drops ---
    for (const d of game.drops) {
      const [dx, dy] = scr(d.x, d.y), sz = Math.round(tile * 0.45), bob = Math.round(Math.sin(performance.now() / 380 + d.x * 3) * S);
      g.drawImage(art.base(d.id), 0, 0, T, T, dx + (d.n > 1 ? Math.round(S * 1.5) : 0), dy - Math.round(sz * 0.4) + bob + (d.n > 1 ? -Math.round(S) : 0), sz, sz);
      if (d.n > 1) g.drawImage(art.base(d.id), 0, 0, T, T, dx, dy - Math.round(sz * 0.4) + bob, sz, sz);
    }
    // --- Figuren ---
    for (const v of game.villagers) drawVillager(v, scr);
    for (const m of game.mobs) {
      if (m.x + m.w < left - 3 || m.x > left + cw / tile + 3) continue;
      const [mx, my] = scr(m.x, m.y + (m.visOff || 0));
      drawMob(g, m, mx, my + Math.round((m.visOff || 0) * T * S), S, T, performance.now(), art);
      if (m.hp !== m._uiHp) { if (m._uiHp !== undefined) m._uiT = performance.now(); m._uiHp = m.hp; }
    }
    for (const a of game.proj) { const [ax, ay] = scr(a.x, a.y); drawProjectile(g, a, ax, ay, S, performance.now()); }
    drawPlayer(scr);
    if (game.bow && game.bow.t > 0.05) {
      const p = game.player, [px, py] = scr(p.x + p.w / 2, p.y), bwid = 16 * S, f = Math.min(1, game.bow.t / 1.0);
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(Math.round(px - bwid / 2) - S, py - 7 * S - S, bwid + 2 * S, 3 * S + 2 * S);
      g.fillStyle = f >= 1 ? "#ffe14a" : "#ffffff"; g.fillRect(Math.round(px - bwid / 2), py - 7 * S, Math.round(bwid * f), 3 * S);
    }
    drawFluids(fluids, tile);
    // Partikel
    for (const q of parts) { const [bx, by] = scr(q.x, q.y); g.globalAlpha = clamp(q.life * 2, 0, 1); g.fillStyle = rgb(q.c); g.fillRect(bx, by, Math.max(2, q.s * tile), Math.max(2, q.s * tile)); }
    g.globalAlpha = 1;

    // --- Licht: eine Pixelkarte (1 Pixel = 1 Block), weich auf den Bildschirm gezogen ---
    drawLight(vw, vh, x0, y0, offX, offY, d, tile, cw, ch);

    // --- Text über den Figuren (nicht abgedunkelt) ---
    g.textBaseline = "middle"; g.textAlign = "center";
    for (const v of game.villagers) if (v.sayT > 0 && v.say) bubble(v.say, ...scr(v.x + v.w / 2, v.y - 0.2));
    {
      const now = performance.now(), mw = mouse.in ? worldMouse() : null;
      for (const m of game.mobs) {
        const hov = mw && mw.x > m.x - 0.3 && mw.x < m.x + m.w + 0.3 && mw.y > m.y - 0.3 && mw.y < m.y + m.h + 0.3;
        const recent = m._uiT && now - m._uiT < 3200;
        if (!hov && !recent) continue;
        if (m.x + m.w < left - 2 || m.x > left + cw / tile + 2) continue;
        const [lx, ly] = scr(m.x + m.w / 2, m.y), bwid = Math.max(14, m.maxHp * 1.6) * S * 0.6, f = clamp(m.hp / m.maxHp, 0, 1);
        g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(Math.round(lx - bwid / 2) - S, ly - 5 * S - S, Math.round(bwid) + 2 * S, 2.6 * S + 2 * S);
        g.fillStyle = f > 0.5 ? "#5ad25a" : f > 0.25 ? "#e8c23a" : "#e04a3a"; g.fillRect(Math.round(lx - bwid / 2), ly - 5 * S, Math.round(bwid * f), Math.round(2.6 * S));
        if (hov) { g.font = `bold ${Math.round(4.6 * S)}px system-ui, sans-serif`; g.textBaseline = "alphabetic"; g.lineWidth = S; g.strokeStyle = "rgba(0,0,0,.75)"; const nm = (m.tamed ? "♥ " : "") + MOBS[m.type].name; g.strokeText(nm, lx, ly - 7 * S); g.fillStyle = m.kind === "hostile" ? "#ffb0a0" : "#ffffff"; g.fillText(nm, lx, ly - 7 * S); g.textBaseline = "middle"; }
      }
    }
    g.font = `bold ${Math.round(5 * S)}px system-ui, sans-serif`;
    for (const f of floats) { const [fx, fy] = scr(f.x, f.y); g.globalAlpha = clamp(f.life * 1.6, 0, 1); g.lineWidth = S; g.strokeStyle = "rgba(0,0,0,.7)"; g.strokeText(f.text, fx, fy); g.fillStyle = f.color; g.fillText(f.text, fx, fy); }
    g.globalAlpha = 1;
    if (flash > 0) { g.fillStyle = `rgba(210,30,30,${flash * 0.5})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
    if (whiteout > 0) { g.fillStyle = `rgba(255,240,210,${whiteout * 1.1})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
    if (fade > 0) { g.fillStyle = `rgba(4,6,20,${Math.min(1, fade * 1.6)})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
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
  /** Wasser und Lava: Höhe nach Stufe, zwei Bilder im Wechsel, Oberflächenlinie */
  function drawFluids(list, tile) {
    const t = performance.now();
    for (let k = 0; k < list.length; k += 5) {
      const px = list[k], py = list[k + 1], id = list[k + 2], lv = list[k + 3], above = list[k + 4];
      const lava = id === B.LAVA, full = above === id || lv === 8;
      const hT = full ? T : lv >= 9 ? 14 : Math.max(2, Math.round(1.5 + lv * 1.7));
      const fr = Math.floor(t / (lava ? 650 : 420) + px * 0.01) % 2;
      const idx = fr ? (lava ? IDX.LAVA2 : IDX.WATER2) : id;
      g.drawImage(atlas, idx * T, T - hT, T, hT, px, py + (T - hT) * S, tile, hT * S);
      if (!full) { g.fillStyle = lava ? "rgba(255,230,120,.55)" : "rgba(225,240,255,.5)"; g.fillRect(px, py + (T - hT) * S, tile, Math.max(1, S)); }
    }
    // Kopf unter Wasser / in Lava: Farbschleier über dem ganzen Bild
    const p = game.player, head = game.fluidAt(Math.floor(p.x + p.w / 2), Math.floor(p.y + 0.25));
    if (head) { g.fillStyle = head === B.WATER ? "rgba(24,70,200,.26)" : "rgba(255,90,10,.55)"; g.fillRect(-8, -8, canvas.width + 16, canvas.height + 16); }
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
    // Rüstung
    const AC = { leather: ["#a0612f", "#c98a52", "#6f4220"], iron: ["#d0d3de", "#f4f5fa", "#8e91a0"], gold: ["#f2c93c", "#fff0a0", "#b8861a"], diamond: ["#4fe0d8", "#c8fffa", "#1f9c9e"] };
    const arm = i => (game.armor[i] ? AC[ITEMS[game.armor[i].id].mat] : null);
    let c = arm(2); if (c) { R(3 + sw * 0.5, 17.5 - bob, 3, 5, c[0]); R(7 - sw * 0.5, 17.5 - bob, 3, 5, c[1]); R(2, 16.5 - bob, 9, 2, c[2]); }
    c = arm(3); if (c) { R(2.5 + sw * 0.5, 24.5 - bob, 4, 3.5, c[0]); R(6.5 - sw * 0.5, 24.5 - bob, 4, 3.5, c[2]); }
    c = arm(1); if (c) { R(2, 9 - bob, 9, 8, c[0]); R(2, 9 - bob, 9, 1.3, c[1]); R(2, 16 - bob, 9, 1.3, c[2]); R(5, 10 - bob, 3, 5, c[1]); }
    c = arm(0); if (c) { R(2.6, 0.6 - bob, 8.4, 4.4, c[0]); R(2.6, 0.6 - bob, 8.4, 1.2, c[1]); R(2.2, 1 - bob, 1.6, 6, c[2]); R(8.6, 3.6 - bob, 2.4, 1.2, "#00000055"); }
    // Arm und Gegenstand in der Hand
    const swing = p.swing ? Math.sin(performance.now() / 55) : 0;
    const hx = 9.5, hy = 11 - bob;
    g.save(); g.translate(Math.round(hx * S), Math.round(hy * S)); g.rotate(p.swing ? -0.5 + swing * 0.9 : 0.25);
    R(-1, -0.5, 2.6, 6.5, "#3c6ec8"); R(-1, 5.5, 2.6, 2, "#ecbc94");
    const held = game.selStack();
    if (held) {
      const it = ITEMS[held.id], base = art.base(held.id);
      g.translate(0, Math.round(6.5 * S));
      if (it.tool || it.armor) { const sc = S * 0.8; g.rotate(p.swing ? 0.2 : 0.5); g.drawImage(base, 0, 0, T, T, Math.round(-3 * sc), Math.round(-13 * sc), Math.round(T * sc), Math.round(T * sc)); }
      else { const sz = Math.round(7 * S); g.drawImage(base, 0, 0, T, T, Math.round(-sz * 0.2), Math.round(-sz * 0.9), sz, sz); }
    }
    g.restore();
    if (game.blocking && game.selItem() === "shield") g.drawImage(art.base("shield"), 0, 0, T, T, Math.round(6.5 * S), Math.round(6 * S), Math.round(14 * S), Math.round(14 * S));
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
