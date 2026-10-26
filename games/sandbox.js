// =====================================================================
// Blockdorf – Oberfläche: weiches Licht, Himmel mit Sonne/Mond/Sternen, Partikel, Inventar-Fenster,
// Steuerung per Tastatur/Maus/Touch. Texturen und Symbole stehen in sandbox-art.js, die Regeln in
// sandbox-engine.js / sandbox-inventory.js.
//   A/D laufen · W/Leertaste springen (Leiter: W hoch, S runter) · linke Maustaste abbauen/kämpfen
//   rechte Maustaste benutzen/bauen/essen · 1–9 oder Mausrad: Platz wählen · E Inventar · Q werfen · P/Esc Pause
// =====================================================================
import { Sandbox, W, H, SURF, B, BLOCKS, ITEMS, RECIPES, REACH, DAY_LEN, MAX_HP, mulberry32, BIOME_NAMES, MOBS, ADV, MODES, WEATHER_NAMES, MOON_FULL } from "./sandbox-engine.js?v=10";
import { makeArt, IDX, ORE_DEEP, T } from "./sandbox-art.js?v=10";
import { drawMob, drawProjectile, MOB_COLORS } from "./sandbox-mobart.js?v=10";
import { drawBlock4 } from "./sandbox-art4.js?v=10";
import { drawBlock8 } from "./sandbox-art8.js?v=10";
import { drawBlock9, bannerCloth } from "./sandbox-art9.js?v=10";
import { drawBlock11, plantSprite, FIRST11 } from "./sandbox-art11.js?v=10";
import { FIRST12, COL12 } from "./sandbox-art12.js?v=10";
import { LOOM_PATTERNS, TRIM_MATS, TRIM_MAT_IDS, FIRST9, COLORS } from "./sandbox-data.js?v=10";
import { mcY } from "./sandbox-const.js?v=10";
import { drawBlock5, IDX5 } from "./sandbox-art5.js?v=10";
import { drawBlock6, profLook, drawProfGear } from "./sandbox-art6.js?v=10";
import { PROFS, LEVEL_NAMES } from "./sandbox-vill.js?v=10";
import { DIM_NAMES, BEACON_EFFECTS, BEACON_PAY } from "./sandbox-dims.js?v=10";
import { stackName, stackLines, BREW_TIME, EFFECT_NAMES, EFFECT_BAD, potionColor } from "./sandbox-brew.js?v=10";
import { createAudio, stepMaterial, musicMood } from "./sandbox-audio.js?v=10";
import { loadRecord, addWorld, switchWorld, renameWorld, deleteWorld, canAdd, nextId, cleanSettings } from "./sandbox-worlds.js?v=10";
import { padStep, readPad, aimPoint, moveCursor } from "./sandbox-pad.js?v=10";
import { Precip, drawMoon, drawBolt, drawDebug } from "./sandbox-fx7.js?v=10";
import { settingsPanel, worldsPanel, newWorldPanel } from "./sandbox-menus.js?v=10";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const fmt = n => new Intl.NumberFormat("de-DE").format(n);
const TAGNAME = { "#planks": "Bretter", "#coals": "Kohle", "#logs": "Baumstämme", "#wool": "Wolle (beliebig)", "#dye": "Farbstoff (beliebig)" };
const potionColorOf = d => potionColor(d);
const hex2rgb = c => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c || ''); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [180, 70, 220]; };
const ROMAN2 = ['', '', ' II', ' III', ' IV'];
const DEEP_Y = SURF + 74;           // ab hier werden Erze auf Tiefenschiefer gemalt

// =====================================================================
// mount
// =====================================================================
export function mount(root, ctx) {
  const { h } = ctx;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const art = makeArt(), atlas = art.atlas, avg = art.avg;

  // ---------- Welt laden oder neu erzeugen ----------
  const rec0 = loadRecord(ctx.record);
  let settings = rec0.settings;
  const meta = { wid: rec0.wid, wname: rec0.wname, others: rec0.others };
  let game;
  let hadSave = false;
  try { if (rec0.w) { game = new Sandbox({ data: rec0.w }); hadSave = true; } } catch (_) { game = null; }
  if (!game) { game = new Sandbox({}); if (rec0.wmode === "creative") game.setMode("creative"); }
  game.events.length = 0;
  let state = "ready", raf = 0, last = 0, destroyed = false;
  let saveT = 0, dirty = false, flash = 0, toastT = 0, touchMode = "mine", placeCd = 0, swingT = 0, walkPh = 0, shake = 0, fade = 0, whiteout = 0;
  const keys = { left: false, right: false, jump: false, down: false };
  const mouse = { px: 0, py: 0, in: false, down: false, btn: 0 };
  const cam = { x: game.player.x, y: game.player.y };
  const parts = [], floats = [], sweeps = [], rays = [];
  const audio = createAudio();
  audio.apply(settings);
  const ensureAudio = () => audio.ensure();
  const sfx = k => audio.sfx(k);
  const precip = new Precip();
  const pad = { left: false, right: false, jump: false, down: false };
  let padPrev = null, padHad = false, padPt = { x: 0, y: 0 }, padMine = false, padUse = false, padShown = false;
  let page = "main", wrec = null, wstate = {}, ovKind = "ready";
  let chatHist = [], chatIdx = 0, chatSig = "";
  const chatLines = [];
  let fps = 60, drawMs = 0, stepAcc = 0;
  const cre = { tab: "block", q: "" };

  // ---------- Oberfläche ----------
  const canvas = h("canvas", { class: "sb-canvas" });
  const g = canvas.getContext("2d");
  const lightCv = document.createElement("canvas"), lg = lightCv.getContext("2d");
  const glowCv = document.createElement("canvas"), gg = glowCv.getContext("2d");
  const info = h("div", { class: "sb-info" }), fxRow = h("div", { class: "sb-fx" });
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
  const soundBtn = btn(settings.sound ? "🔊" : "🔇", "Ton an/aus (M)", () => { setSetting("sound", !settings.sound); blurFocus(); });
  const chatBtn = btn("⌨", "Befehle (T)", () => { if (chatIn.hidden) openChat("/"); else closeChat(); });
  const invBtn = btn("🎒", "Inventar (E)", () => { toggleInv(); blurFocus(); });
  const advBtn = btn("🏆", "Fortschritte (G)", () => { toggleAdv(); blurFocus(); });
  const pauseBtn = btn("⏸", "Pause (P)", () => { pause(); });
  const ovTitle = h("div", { class: "tg-ov-title" }, "Blockdorf");
  const ovText = h("div", { class: "sb-ov-text" });
  const ovBtn = h("button", { class: "btn", type: "button", onclick: () => primary() });
  const ovSet = h("button", { class: "btn ghost small", type: "button", onclick: () => { page = "settings"; renderPage(); } }, "Einstellungen");
  const ovWorlds = h("button", { class: "btn ghost small", type: "button", onclick: () => { page = "worlds"; wrec = null; wstate = {}; renderPage(); } }, "Welten");
  const ovRow = h("div", { class: "sb-ovrow" }, ovSet, ovWorlds);
  const ovPanel = h("div", { class: "sb-ovpanel", hidden: true });
  const overlay = h("div", { class: "tg-overlay sb-overlay" }, ovTitle, ovText, ovBtn, ovRow, ovPanel);
  const chatLog = h("div", { class: "sb-chatlog", "aria-live": "polite" });
  const chatIn = h("input", { class: "sb-chatin", type: "text", maxlength: 120, placeholder: "Befehl, z. B. /hilfe", "aria-label": "Befehl", autocomplete: "off", spellcheck: "false", hidden: true });
  const padEl = h("div", { class: "sb-padptr", hidden: true });
  const kbd = t => h("kbd", null, t);
  const help = h("div", { class: "sb-help" },
    h("div", null, kbd("A"), kbd("D"), " laufen · ", kbd("W"), " / ", kbd("Leertaste"), " springen · ", kbd("S"), " Leiter runter"),
    h("div", null, "Linke Maustaste: abbauen und kämpfen · rechte: benutzen, bauen, essen"),
    h("div", null, "Bogen und Armbrust: rechte Maustaste halten (Armbrust: loslassen = geladen, nächster Klick = Schuss) · Dreizack: halten und loslassen = werfen (Sog im Wasser/Regen) · Schild: rechte Maustaste halten · ", kbd("F"), " zweite Hand · ", kbd("G"), " Fortschritte"),
    h("div", null, "Linke Maustaste gedrückt halten schlägt erst bei voller Ladung zu: Kritisch im Fall, Schwert schwingt, Axt entwaffnet Schilde"),
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
      h("div", { class: "sb-hud-top" }, h("div", { class: "sb-left" }, info, fxRow), h("div", { class: "sb-right" }, advBtn, invBtn, chatBtn, soundBtn, pauseBtn)),
      toastEl, chatLog, h("div", { class: "sb-bottom" }, heldName, barsRow, xpBar, hotbar), chatIn, winWrap, cursorEl, padEl, overlay),
    touch, help, h("div", { class: "sb-ver" }, "Blockdorf Version 13 · Etappe 13 · Spielstand 14")));
  barsRow.append(h("div", { class: "sb-barcol" }, armorRow, heartsRow), h("div", { class: "sb-barcol sb-foodcol" }, airRow, foodRow));
  function applySettings() {
    audio.apply(settings);
    soundBtn.textContent = settings.sound ? "🔊" : "🔇";
    touch.className = "sb-touch" + (settings.touch === "on" ? " force" : settings.touch === "off" ? " off" : "");
  }
  applySettings();

  function blurFocus() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }

  // ---------- HUD ----------
  const sig = { bars: "", hot: "", win: "", info: "", xp: "", book: "", fx: "" };
  const iconRow = (row, kind, n, vals) => {
    row.textContent = "";
    for (let i = 0; i < n; i++) row.appendChild(art.hud[kind](vals(i)));
  };
  function slotEl(area, idx, st, cls = "") {
    const it = st && ITEMS[st.id];
    const el = h("div", { class: "sb-s " + cls, "data-area": area, "data-idx": String(idx), title: it ? [stackName(st), ...stackLines(st)].join("\n") : "" });
    if (st) {
      el.appendChild(art.icon(st.id, 32, st));
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
    const sh = JSON.stringify(game.hotbar()) + "|" + game.sel + "|" + JSON.stringify(game.offh);
    if (sh !== sig.hot) {
      sig.hot = sh; hotbar.textContent = "";
      if (game.offh[0]) { const oe = slotEl("off", 0, game.offh[0], "sb-slot sb-offslot"); oe.appendChild(h("span", { class: "sb-key" }, "F")); hotbar.appendChild(oe); }
      game.hotbar().forEach((st, i) => {
        const el = slotEl("inv", i, st, "sb-slot" + (i === game.sel ? " on" : ""));
        el.appendChild(h("span", { class: "sb-key" }, String(i + 1)));
        hotbar.appendChild(el);
      });
      const cur = game.selStack();
      if (cur && cur.id !== lastHeld) { heldName.textContent = stackName(cur); heldName.hidden = false; heldT = 1.8; }
      lastHeld = cur ? cur.id : null;
    }
    const sf = Object.entries(game.fx).map(([k, f]) => `${k}${f.amp}:${Math.ceil(f.t)}`).join("|");
    if (sf !== sig.fx) {
      sig.fx = sf; fxRow.textContent = "";
      for (const [k, f] of Object.entries(game.fx)) { const s = Math.ceil(f.t); fxRow.appendChild(h("span", { class: "sb-fxi" + (EFFECT_BAD.has(k) ? " bad" : "") }, `${EFFECT_NAMES[k] || k}${ROMAN2[f.amp + 1] || ""} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`)); }
    }
    const hour = Math.floor(game.time * 24), min = Math.floor((game.time * 24 - hour) * 60);
    let si = game.dim ? `${BIOME_NAMES[game.biomeAt(p.x + p.w / 2)]} · Höhe ${SURF - Math.floor(p.y + p.h / 2)}` : `Tag ${game.day} · ${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")} · ${BIOME_NAMES[game.biomeAt(p.x + p.w / 2)]} · Höhe ${SURF - Math.floor(p.y + p.h / 2)}`;
    if (!game.dim && game.weather && game.weather.kind !== "clear" && game.weather.k > 0.3) si += " · " + weatherName();
    if (game.mode === "creative") si += " · Kreativ" + (p.flying ? " (fliegt)" : "");
    if (si !== sig.info) { sig.info = si; info.textContent = si; }
    syncWindow();
  }
  let lastHeld = null, heldT = 0;

  // ---------- Fenster: Inventar, Werkbank, Ofen, Truhe ----------
  const sizeOf = kind => (kind === "bench" ? 3 : 2);
  function syncWindow() {
    const w = game.win;
    if (!w) { if (!winWrap.hidden) { winWrap.hidden = true; cursorEl.hidden = true; sig.win = ""; } return; }
    if (winWrap.hidden) { winWrap.hidden = false; keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; game.blocking = false; game.bow = null; game.xbow = null; game.trid = null; }
    const e = game.winEnt();
    const sg = JSON.stringify([w.kind, cre.tab, game.inv, game.armor, game.offh, game.grid, game.cursor, e && e.s, w.kind === "adv" ? game.adv : 0, w.kind === "trade" && w.v ? [w.v.offers.map(o => o.uses), w.v.lvl, w.v.xp, game.hero()] : 0, w.kind === "map" ? Math.floor(game.player.x / 3) : 0, w.kind === "ench" || w.kind === "anvil" ? game.xp : 0, w.kind === "beacon" && e ? [e.eff, game.beaconLevel(w.x, w.y), game.beaconClear(w.x, w.y)] : 0]);
    if (sg !== sig.win) { sig.win = sg; renderWindow(); renderBook(); updateCursor(); }
    if (w.kind === "brew" && e) { const f = winPanel.querySelector(".sb-bfuel i"), a = winPanel.querySelector(".sb-bprog i"); if (f) f.style.width = Math.round(clamp(e.fuel / 20, 0, 1) * 100) + "%"; if (a) a.style.height = Math.round(clamp(e.brewT / BREW_TIME, 0, 1) * 100) + "%"; }
    if (w.kind === "furnace" && e) { const f = winPanel.querySelector(".sb-flame i"), a = winPanel.querySelector(".sb-arrow i"); if (f) f.style.height = e.burnMax ? Math.round((e.burn / e.burnMax) * 100) + "%" : "0%"; if (a) a.style.width = Math.round((e.cook / (e.mode ? 5 : 10)) * 100) + "%"; }
  }
  const arrow = () => h("div", { class: "sb-arrow" }, h("i"));
  const BIOME_MAPCOL = ["#6eaa46", "#40783a", "#80aa5a", "#3c6e5c", "#ecf0f4", "#e2d08e", "#aaaa46", "#288c32", "#50643c", "#80808a", "#4070aa", "#c86428"];
  /** Entdeckerkarte: Geländeprofil der ganzen Welt, du (weiß) und das Ziel (rotes Kreuz) */
  function drawMap(cvm, mi) {
    const c = cvm.getContext("2d"), cw = cvm.width, ch = cvm.height, sx = cw / W;
    c.fillStyle = "#d9c08a"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#e8d6a4"; c.fillRect(3, 3, cw - 6, ch - 6);
    const y0 = 38, ys = 1.9;
    for (let x = 0; x < W; x++) {
      const gy = game.ground[x], top = Math.round((gy - y0) * ys);
      c.fillStyle = BIOME_MAPCOL[game.biomes[x]] || "#6eaa46";
      c.fillRect(Math.floor(x * sx), clamp(top, 4, ch - 4), Math.ceil(sx) + 0, ch - 4 - clamp(top, 4, ch - 4));
      if (game.tiles[(gy - 1) * W + x] === B.WATER || (gy > SURF + 4 && game.tiles[(SURF + 4) * W + x] === B.WATER)) {
        const wt = Math.round((SURF + 4 - y0) * ys); c.fillStyle = "#4a86c8"; c.fillRect(Math.floor(x * sx), wt, Math.ceil(sx), Math.max(0, top - wt));
      }
    }
    c.strokeStyle = "rgba(60,40,20,.5)"; c.lineWidth = 2; c.strokeRect(3, 3, cw - 6, ch - 6);
    const px = mi.px * sx;
    c.fillStyle = "#fff"; c.strokeStyle = "#222"; c.lineWidth = 2; c.beginPath(); c.moveTo(px, 8); c.lineTo(px - 6, 22); c.lineTo(px + 6, 22); c.closePath(); c.fill(); c.stroke();
    if (mi.target) {
      const tx = mi.target * sx; c.strokeStyle = "#d02020"; c.lineWidth = 4; c.beginPath(); c.moveTo(tx - 8, 30); c.lineTo(tx + 8, 46); c.moveTo(tx + 8, 30); c.lineTo(tx - 8, 46); c.stroke();
      c.setLineDash([4, 4]); c.lineWidth = 2; c.beginPath(); c.moveTo(px, 26); c.lineTo(tx, 26); c.stroke(); c.setLineDash([]);
    }
  }
  function renderWindow() {
    const w = game.win; winPanel.textContent = "";
    let title = { creative: "Kreativ-Inventar", inv: "Inventar", bench: "Werkbank", furnace: "Ofen", chest: "Truhe", adv: "Fortschritte", ench: "Verzaubern", anvil: "Amboss", brew: "Braustand", disp: "Spender", beacon: "Leuchtfeuer", trade: "Handel", map: "Entdeckerkarte", stonecut: "Steinsäge", loom: "Webstuhl", grind: "Schleifstein", smith: "Schmiedetisch", sign: "Schild beschriften" }[w.kind];
    const fe = w.kind === "furnace" ? game.winEnt() : null;
    if (fe && fe.mode) title = fe.mode === "smoke" ? "Räucherofen" : "Schmelzofen";
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
    const outStack = () => { const r = game.craftResult(); return r ? { id: r.id, n: r.n, d: r.d | 0, ...(r.x ? { bp: r.x.bp, e: r.x.e } : {}) } : null; };
    if (w.kind === "creative") {
      const tabs = h("div", { class: "sb-ctabs" }, ...CRE_TABS.map(([k, n]) => h("button", { type: "button", class: "sb-ctab" + (!cre.q.trim() && cre.tab === k ? " on" : ""), onclick: () => { cre.tab = k; cre.q = ""; creScroll = 0; sig.win = ""; blurFocus(); } }, n)));
      const body = () => (cre.tab === "inv" && !cre.q.trim() ? h("div", { class: "sb-cinv" }, row("inv", 9, 9), row("inv", 18, 9), row("inv", 27, 9)) : creGrid());
      const holder = h("div", { class: "sb-cholder" }, body());
      const search = h("input", { class: "sb-csearch", type: "search", placeholder: "Suchen …", value: cre.q, "aria-label": "Gegenstand suchen",
        oninput: e => { cre.q = e.target.value; creScroll = 0; holder.textContent = ""; holder.appendChild(body()); tabs.querySelectorAll(".sb-ctab").forEach(b => b.classList.remove("on")); },
        onkeydown: e => { if (e.key === "Escape") { e.preventDefault(); e.target.blur(); game.closeWindow(); sig.win = ""; } } });
      holder.addEventListener("scroll", () => { creScroll = holder.scrollTop; });
      const trash = h("div", { class: "sb-s sb-trash", "data-area": "trash", "data-idx": "0", title: "Papierkorb: legt den Gegenstand in der Hand weg" }, h("span", { class: "sb-trashic" }, "🗑"));
      const armorRow2 = h("div", { class: "sb-srow sb-crow" }); for (let i = 0; i < 4; i++) armorRow2.appendChild(slotEl("armor", i, game.armor[i], "sb-armor" + i)); armorRow2.appendChild(slotEl("off", 0, game.offh[0], "sb-offslot")); armorRow2.appendChild(trash);
      winPanel.append(tabs, search, holder, armorRow2);
      creScrollApply = () => { holder.scrollTop = creScroll; };
    } else if (w.kind === "inv") {
      const armor = h("div", { class: "sb-armorcol" }); for (let i = 0; i < 4; i++) armor.appendChild(slotEl("armor", i, game.armor[i], "sb-armor" + i)); armor.appendChild(slotEl("off", 0, game.offh[0], "sb-offslot"));
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
    } else if (w.kind === "disp") {
      winPanel.appendChild(h("div", { class: "sb-chest sb-disp" }, row("chest", 0, 3), row("chest", 3, 3), row("chest", 6, 3)));
    } else if (w.kind === "ench") {
      const offers = game.enchOffers(), lap = game.grid[1], lv = game.level();
      const list = h("div", { class: "sb-offers" });
      if (!offers) list.appendChild(h("div", { class: "sb-hint" }, game.grid[0] ? "Das lässt sich nicht (mehr) verzaubern." : "Lege links einen Gegenstand und darunter Lapislazuli ein."));
      else offers.forEach((o, k) => {
        const has = Object.keys(o.ench).length > 0, ok = has && lv >= o.req && lv >= o.cost && lap && lap.id === "lapis" && lap.n >= o.cost;
        list.appendChild(h("button", { class: "sb-offer" + (ok ? " can" : ""), type: "button", title: `Braucht Stufe ${o.req}`, onclick: () => { if (game.enchant(k)) { sfx("adv"); dirty = true; } else say("Dafür fehlen dir Erfahrungsstufen oder Lapislazuli.", 2000); sig.win = ""; blurFocus(); } },
          h("div", { class: "sb-ol" }, String(o.req)), h("div", { class: "sb-om" }, h("div", { class: "sb-oh" }, o.hint || "–"), h("div", { class: "sb-oc" }, `${o.cost} Lapislazuli · ${o.cost} Stufe${o.cost > 1 ? "n" : ""}`))));
      });
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-enchslots" }, slotEl("grid", 0, game.grid[0]), slotEl("grid", 1, game.grid[1])), list));
      winPanel.appendChild(h("div", { class: "sb-hint" }, `Bücherregale rundherum: ${game.enchShelves()} von 15 · Deine Stufe: ${lv}`));
    } else if (w.kind === "anvil") {
      const pv = game.anvilPreview(), outSt = pv && pv.out ? pv.out : null, lv = game.level();
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-craftbox" }, slotEl("grid", 0, game.grid[0]), h("span", { class: "sb-plus" }, "+"), slotEl("grid", 1, game.grid[1]), arrow(), slotEl("out", 0, outSt, "sb-out"))));
      winPanel.appendChild(h("div", { class: "sb-hint" + (pv && pv.cost && lv < pv.cost ? " bad" : "") }, !game.grid[0] || !game.grid[1] ? "Lege links den Gegenstand und rechts Material, ein zweites gleiches Stück oder ein Buch ein." : pv && pv.error === "expensive" ? "Zu teuer!" : pv && pv.error ? "Das lässt sich so nicht kombinieren." : `Kosten: ${pv.cost} Stufe${pv.cost > 1 ? "n" : ""} (du hast ${lv})`));
    } else if (w.kind === "brew") {
      const e = game.winEnt();
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-brew" },
        h("div", { class: "sb-bcol" }, slotEl("b", 4, e.s[4]), h("div", { class: "sb-bfuel", title: "Brennstoff" }, h("i"))),
        h("div", { class: "sb-bmid" }, slotEl("b", 3, e.s[3]), h("div", { class: "sb-bprog" }, h("i")), h("div", { class: "sb-bbots" }, slotEl("b", 0, e.s[0]), slotEl("b", 1, e.s[1]), slotEl("b", 2, e.s[2]))))));
      winPanel.appendChild(h("div", { class: "sb-hint" }, "Oben die Zutat, unten bis zu drei Flaschen. Lohenstaub links ist der Brennstoff."));
    } else if (w.kind === "trade") {
      const v = w.v, pf = PROFS[v.prof] || { name: "Dorfbewohner" };
      const need = [10, 70, 150, 250][v.lvl - 1];
      winPanel.appendChild(h("div", { class: "sb-hint" }, pf.nolevel ? `${pf.name} · seltene Waren, nur kurz zu Besuch` : `${pf.name} · ${LEVEL_NAMES[v.lvl - 1]}${need ? ` (${v.xp}/${need} Erfahrung)` : " (Meister)"}${game.hero() ? " · Held des Dorfes: Smaragde −30 %" : ""}${v.cured ? " · Geheilt: Smaragde −20 %" : ""}`));
      const list = h("div", { class: "sb-offers sb-trades" });
      v.offers.forEach((o, i) => {
        const a = game.offerCost(o.a), b = game.offerCost(o.b), ok = game.offerCan(o), sold = o.uses >= o.max;
        const side = (pair, st) => h("span", { class: "sb-tg", title: ITEMS[pair[0]].name }, art.icon(pair[0], 26, st), h("i", null, pair[1] > 1 ? "×" + pair[1] : ""));
        list.appendChild(h("button", { class: "sb-offer sb-trade" + (ok ? " can" : "") + (sold ? " sold" : ""), type: "button", title: `${ITEMS[o.out.id].name}${o.out.n > 1 ? " ×" + o.out.n : ""}`, onclick: () => { if (game.trade(i)) dirty = true; sig.win = ""; blurFocus(); } },
          side(a), b ? h("span", { class: "sb-plus" }, "+") : null, b ? side(b) : null, h("span", { class: "sb-ar" }, "→"), side([o.out.id, o.out.n], o.out),
          h("span", { class: "sb-uses" }, sold ? "ausverkauft" : `${o.max - o.uses}/${o.max}`)));
      });
      winPanel.appendChild(list);
      winPanel.appendChild(h("div", { class: "sb-hint" }, "Klicke auf ein Angebot, um zu tauschen. Am Morgen füllen die Händler ihre Vorräte wieder auf."));
    } else if (w.kind === "stonecut") {
      const opts = game.stoneOptions(), list = h("div", { class: "sb-cuts" });
      if (!opts.length) list.appendChild(h("div", { class: "sb-hint" }, "Lege links einen Stein ein – hier erscheinen die Formen."));
      else opts.forEach(([id, n], i) => list.appendChild(h("button", { class: "sb-cut", type: "button", title: ITEMS[id].name + (n > 1 ? " ×" + n : ""), onclick: () => { if (game.stoneTake(i)) { sfx("click"); dirty = true; } sig.win = ""; blurFocus(); } }, art.icon(id, 30), n > 1 ? h("i", null, "×" + n) : null)));
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-enchslots" }, slotEl("grid", 0, game.grid[0])), list));
    } else if (w.kind === "loom") {
      const bs = game.grid[0], dye = game.grid[1], list = h("div", { class: "sb-cuts sb-pats" });
      const baseC = bs ? (bs.bp ? bs.bp.c : ITEMS[bs.id].banner) : 8, layers = bs && bs.bp ? bs.bp.p : [], dc = dye && ITEMS[dye.id].col != null ? ITEMS[dye.id].col : 0;
      LOOM_PATTERNS.forEach(([, name], i) => {
        const can = game.loomCan(i), cv = h("canvas", { width: 12, height: 15, class: "sb-pat" });
        const src = bannerCloth(baseC == null ? 8 : baseC, [...layers, [i, dc]]); cv.getContext("2d").drawImage(src, 0, 0);
        list.appendChild(h("button", { class: "sb-cut" + (can ? " can" : ""), type: "button", title: name, disabled: !can, onclick: () => { if (game.loomApply(i)) { sfx("click"); dirty = true; } sig.win = ""; blurFocus(); } }, cv));
      });
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-enchslots" }, slotEl("grid", 0, game.grid[0]), slotEl("grid", 1, game.grid[1])), list));
      winPanel.appendChild(h("div", { class: "sb-hint" }, !bs ? "Oben ein Banner, darunter ein Farbstoff – dann ein Muster wählen." : layers.length >= 6 ? "Mehr als 6 Muster passen nicht auf ein Banner." : "Das Muster erscheint in der Farbe des Farbstoffs."));
    } else if (w.kind === "grind") {
      const pv = game.grindPreview();
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-craftbox" }, slotEl("grid", 0, game.grid[0]), h("span", { class: "sb-plus" }, "+"), slotEl("grid", 1, game.grid[1]), arrow(), slotEl("out", 0, pv ? pv.out : null, "sb-out"))));
      winPanel.appendChild(h("div", { class: "sb-hint" }, pv ? (pv.xp > 0 ? `Entfernt Verzauberungen und gibt ${pv.xp} Erfahrung.` : "Fügt beide Stücke zusammen und repariert sie.") : "Ein verzauberter Gegenstand verliert seine Verzauberung; zwei gleiche Werkzeuge werden zu einem repariert."));
    } else if (w.kind === "smith") {
      const pv = game.smithPreview();
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-craftbox" }, slotEl("grid", 0, game.grid[0]), h("span", { class: "sb-plus" }, "+"), slotEl("grid", 1, game.grid[1]), h("span", { class: "sb-plus" }, "+"), slotEl("grid", 2, game.grid[2]), arrow(), slotEl("out", 0, pv && pv.out ? pv.out : null, "sb-out"))));
      winPanel.appendChild(h("div", { class: "sb-hint" }, "Vorlage, Rüstungsteil und ein Material (Barren oder Edelstein) ergeben eine Verzierung."));
    } else if (w.kind === "sign") {
      const lines = game.signLines(w.x, w.y) || ["", "", "", ""];
      const box = h("div", { class: "sb-sign" });
      lines.forEach((t, i) => box.appendChild(h("input", { class: "sb-signin", type: "text", maxlength: 15, value: t, "aria-label": `Zeile ${i + 1}`, autocomplete: "off", spellcheck: "false",
        oninput: () => { game.signSet(w.x, w.y, [...box.querySelectorAll("input")].map(x => x.value)); dirty = true; },
        onkeydown: ev => { ev.stopPropagation(); if (ev.key === "Escape" || (ev.key === "Enter" && i === 3)) { ev.preventDefault(); ev.target.blur(); game.closeWindow(); sig.win = ""; } else if (ev.key === "Enter") { ev.preventDefault(); box.querySelectorAll("input")[i + 1].focus(); } } })));
      winPanel.appendChild(box);
      winPanel.appendChild(h("div", { class: "sb-hint" }, "Bis zu vier Zeilen, je 15 Zeichen. Mit Esc oder Enter in der letzten Zeile fertig."));
      setTimeout(() => { const f = box.querySelector("input"); if (f && game.win && game.win.kind === "sign") f.focus(); }, 0);
    } else if (w.kind === "map") {
      const mi = game.mapInfo();
      const cvm = h("canvas", { class: "sb-map", width: 480, height: 160 });
      winPanel.appendChild(cvm);
      if (mi) {
        drawMap(cvm, mi);
        const dist = mi.target ? Math.round(Math.abs(mi.target - mi.px)) : 0;
        winPanel.appendChild(h("div", { class: "sb-hint" }, mi.target ? `${mi.name}: Das Ziel (rotes Kreuz) liegt ${dist} Blöcke ${mi.target > mi.px ? "östlich" : "westlich"} von dir.` : "Diese Karte zeigt kein Ziel."));
      }
    } else if (w.kind === "beacon") {
      const e = game.winEnt(), lv = game.beaconLevel(w.x, w.y), pay = e.s[0], payOk = !!(pay && BEACON_PAY.has(pay.id));
      const list = h("div", { class: "sb-offers" });
      BEACON_EFFECTS.forEach((n, i) => {
        const open = i < lv, ok = open && payOk, act = e.eff === n;
        list.appendChild(h("button", { class: "sb-offer" + (ok ? " can" : ""), type: "button", title: open ? "Kostet einen Barren oder Edelstein" : `Braucht eine Pyramide der Stufe ${i + 1}`,
          onclick: () => { if (game.beaconSet(n)) dirty = true; sig.win = ""; blurFocus(); } },
          h("div", { class: "sb-ol" }, String(i + 1)), h("div", { class: "sb-om" }, h("div", { class: "sb-oh" }, EFFECT_NAMES[n] + (act ? " ✓" : "")), h("div", { class: "sb-oc" }, open ? `Stufe ${i + 1} · 1 Barren / Edelstein` : `Pyramide Stufe ${i + 1} nötig`))));
      });
      winPanel.appendChild(h("div", { class: "sb-top" }, h("div", { class: "sb-enchslots" }, slotEl("bn", 0, e.s[0])), list));
      winPanel.appendChild(h("div", { class: "sb-hint" }, `Pyramide: Stufe ${lv} von 4 · ${game.beaconClear(w.x, w.y) ? "Der Strahl ist frei." : "Etwas verdeckt den Strahl!"} Bezahlung: Eisen-, Gold-Barren, Smaragd oder Diamant.`));
    }
    if (w.kind === "creative") winPanel.appendChild(h("div", { class: "sb-invbox" }, row("inv", 0, 9)));
    else if (w.kind !== "sign") {
      winPanel.appendChild(h("div", { class: "sb-wl" }, "Inventar"));
      winPanel.appendChild(h("div", { class: "sb-invbox" }, row("inv", 9, 9), row("inv", 18, 9), row("inv", 27, 9), h("div", { class: "sb-gap" }), row("inv", 0, 9)));
    }
    if (creScrollApply) { creScrollApply(); creScrollApply = null; }
  }
  // Kreativ-Fenster: Gegenstände nach Art, mit Suche; der Raster-Inhalt wird nur bei Wechsel neu gebaut
  const weatherName = () => { const w = game.weather; return w.kind === "thunder" ? "Gewitter" : game.precipAt(game.player.x + 0.4) === "snow" ? "Schneefall" : "Regen"; };
  const CRE_TABS = [["block", "Blöcke"], ["tool", "Werkzeug"], ["armor", "Rüstung"], ["food", "Essen"], ["other", "Sonstiges"], ["inv", "Inventar"]];
  let creItems = null, creScroll = 0, creScrollApply = null;
  const creKind = it => (it.armor ? "armor" : it.tool ? "tool" : it.food ? "food" : it.block ? "block" : "other");
  function creList() {
    if (!creItems) { creItems = {}; for (const [k] of CRE_TABS) creItems[k] = []; for (const it of Object.values(ITEMS)) creItems[creKind(it)].push(it.id); }
    const q = cre.q.trim().toLowerCase();
    if (q) return Object.values(ITEMS).filter(it => it.name.toLowerCase().includes(q) || it.id.includes(q)).map(it => it.id);
    return creItems[cre.tab];
  }
  function creGrid() {
    const box = h("div", { class: "sb-cgrid" });
    for (const id of creList()) { const el = slotEl("cre", 0, game.newStack(id, 1), "sb-cs"); el.setAttribute("data-id", id); box.appendChild(el); }
    if (!box.firstChild) box.appendChild(h("div", { class: "sb-hint" }, "Nichts gefunden."));
    return box;
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
    const list = RECIPES.map(r => ({ r, can: game.recipeAvailable(r), big: game.recipeNeedsBench(r) })).filter(x => !(x.big && size === 2 && !x.can) && !(x.r.hide && !x.can));
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
    cursorEl.appendChild(art.icon(c.id, 32, c));
    if (c.n > 1) cursorEl.appendChild(h("span", { class: "sb-n" }, String(c.n)));
  }
  winWrap.addEventListener("pointermove", e => {
    const r = winWrap.getBoundingClientRect();
    cursorEl.style.transform = `translate(${e.clientX - r.left - 16}px, ${e.clientY - r.top - 16}px)`;
  });
  winWrap.addEventListener("contextmenu", e => e.preventDefault());
  winWrap.addEventListener("pointerdown", e => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    e.preventDefault();
    const s = e.target.closest && e.target.closest(".sb-s");
    const r = winWrap.getBoundingClientRect();
    cursorEl.style.transform = `translate(${e.clientX - r.left - 16}px, ${e.clientY - r.top - 16}px)`;
    if (s) {
      const area = s.getAttribute("data-area"), idx = Number(s.getAttribute("data-idx")), right = e.button === 2;
      if (area === "cre") { const id = s.getAttribute("data-id"); if (!game.creativeTake(id, !right)) { game.creativeTrash(); game.creativeTake(id, !right); } }
      else if (area === "trash") game.creativeTrash();
      else if (e.shiftKey && !right) game.shiftClick(area, idx); else game.click(area, idx, right);
      sfx("click"); dirty = true; sig.win = "";
    } else if (!e.target.closest(".sb-win") && !e.target.closest(".sb-book")) { if (game.cursor) game.throwCursor(true); else game.closeWindow(); sig.win = ""; }
  });
  hotbar.addEventListener("pointerdown", e => {
    const el = e.target.closest && e.target.closest(".sb-s");
    if (el && !game.win) { e.preventDefault(); if (el.getAttribute("data-area") === "off") { if (game.swapHands()) dirty = true; } else game.select(Number(el.getAttribute("data-idx"))); }
  });
  function toggleInv() { if (game.win) game.closeWindow(); else game.openWindow("inv"); sig.win = ""; }
  function toggleAdv() { if (game.win && game.win.kind === "adv") game.closeWindow(); else game.openWindow("adv"); sig.win = ""; }
  function say(text, ms = 2600) { toastEl.textContent = text; toastEl.hidden = false; toastT = ms / 1000; }

  // ---------- Zustand, Einstellungen, Welten ----------
  const curRec = () => ({
    w: game.toData(), day: game.day, mined: game.stats.mined, built: game.stats.built, kills: game.stats.kills, level: game.level(),
    wid: meta.wid, wname: meta.wname, wmode: game.mode, others: meta.others, settings, t: Date.now()
  });
  const getRec = () => wrec || (wrec = loadRecord(curRec()));
  function showOverlay(kind) {
    overlay.hidden = kind == null;
    if (kind == null) return;
    ovKind = kind;
    const day = game.day, nm = meta.others.length ? `„${meta.wname}“ – ` : "";
    ovTitle.textContent = kind === "paused" ? "Pause" : "Blockdorf";
    ovText.textContent = nm + (kind === "paused" ? "Deine Welt wird gespeichert." : hadSave || game.stats.mined || game.stats.built ? `Dein Dorf wartet – Tag ${day}, ${fmt(game.stats.mined)} Blöcke abgebaut, ${fmt(game.stats.built)} gebaut.` : "Baue ab, handwerke und errichte dein Dorf. Nachts wird es gefährlich – bring Fackeln mit.");
    ovBtn.textContent = kind === "paused" || hadSave || game.stats.mined ? "Weiter" : "Spielen";
    renderPage();
  }
  /** Overlay-Seiten: Start/Pause, Einstellungen, Welten, neue Welt */
  function renderPage() {
    if (overlay.hidden) return;
    const main = page === "main";
    ovTitle.hidden = ovText.hidden = ovBtn.hidden = ovRow.hidden = !main;
    ovPanel.hidden = main;
    if (main) return;
    ovPanel.textContent = "";
    if (page === "settings") ovPanel.appendChild(settingsPanel(h, { ...settings, mode: game.mode }, settingsApi));
    else if (page === "worlds") ovPanel.appendChild(worldsPanel(h, getRec(), worldsApi, wstate));
    else ovPanel.appendChild(newWorldPanel(h, { name: "Welt " + Number(nextId(getRec()).slice(1)), mode: "survival" }, newApi));
  }
  function backToMain() { page = "main"; wstate = {}; wrec = null; if (dirty) saveNow(); showOverlay(ovKind); }
  function setSetting(key, value, live) {
    if (key === "mode") { if (game.mode !== value) game.setMode(value); dirty = true; sig.win = ""; if (!live) renderPage(); return; }
    settings = cleanSettings({ ...settings, [key]: value });
    applySettings(); dirty = true;
    if (key === "sound" && settings.sound) audio.ensure();
    if (key === "sound" || key === "zoom") resize();
    if (live) {
      const inp = ovPanel.querySelector ? ovPanel.querySelector(`input[aria-label="${key}"]`) : null;
      if (inp && inp.nextSibling) inp.nextSibling.textContent = key === "padSens" ? settings.padSens.toFixed(1) + "×" : Math.round(settings[key] * 100) + " %";
    } else renderPage();
    if (state !== "playing") draw(0);
  }
  const settingsApi = { change: (k, v, live) => setSetting(k, v, live), back: () => backToMain() };
  /** Eine Welt zeigen oder austauschen; r kommt aus sandbox-worlds.js, seed nur bei einer neuen Welt */
  function applyRecord(r, seed) {
    meta.wid = r.wid; meta.wname = r.wname; meta.others = r.others;
    let ng = null, had = false;
    try { if (r.w) { ng = new Sandbox({ data: r.w }); had = true; } } catch (_) { ng = null; }
    if (!ng) { ng = new Sandbox(seed === undefined ? {} : { seed }); if (r.wmode === "creative") ng.setMode("creative"); }
    ng.events.length = 0;
    game = ng; hadSave = had; parts.length = 0; floats.length = 0; chatLines.length = 0; chatSig = "";
    precip.drops.length = 0; precip.splash.length = 0;
    cam.x = game.player.x; cam.y = game.player.y;
    for (const k of Object.keys(sig)) sig[k] = "";
    lastHeld = null; keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; stepAcc = 0;
    state = "ready";
  }
  function commit(r, reload) {
    const wid0 = meta.wid;
    const swap = reload === null ? (r.wid !== wid0 || !r.w) : reload;
    if (swap) applyRecord(r); else { meta.wname = r.wname; meta.others = r.others; }
    wrec = null; saveNow();
    if (swap) { page = "main"; wstate = {}; showOverlay("ready"); hud(); draw(0); } else renderPage();
  }
  const worldsApi = {
    play: id => {
      if (id === meta.wid) { page = "main"; primary(); return; }
      commit(switchWorld(getRec(), id), true); primary();
    },
    edit: id => { wstate = { editing: id }; renderPage(); },
    cancel: () => { wstate = {}; renderPage(); },
    rename: (id, name) => { wstate = {}; commit(renameWorld(getRec(), id, name), false); },
    remove: id => {
      if (wstate.confirm !== id) { wstate = { confirm: id }; renderPage(); return; }
      wstate = {}; commit(deleteWorld(getRec(), id), null);
    },
    create: () => { if (canAdd(getRec())) { page = "newworld"; renderPage(); } },
    back: () => backToMain()
  };
  const newApi = {
    submit: ({ name, seed, mode }) => {
      const r = addWorld(getRec(), { name, mode });
      if (!r) return;
      applyRecord(r, seed); wrec = null; saveNow(); page = "main"; wstate = {};
      showOverlay("ready"); hud(); draw(0);
    },
    back: () => { page = "worlds"; renderPage(); }
  };
  function primary() { ensureAudio(); if (state === "playing") return; page = "main"; start(); }
  function start() {
    state = "playing"; showOverlay(null); blurFocus(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (state !== "playing") return;
    state = "paused"; cancelAnimationFrame(raf); raf = 0; keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; game.mineStop(); game.bow = null; game.xbow = null; game.trid = null; game.blocking = false;
    padMine = padUse = false; pad.left = pad.right = pad.jump = pad.down = false; padEl.hidden = true; padShown = false;
    if (!chatIn.hidden) closeChat();
    saveNow(); page = "main"; showOverlay("paused"); draw(0);
  }
  function saveNow() { ctx.save(curRec()); dirty = false; saveT = 0; }

  // ---------- Chat und Befehle ----------
  function chatPrint(text, cls = "") {
    for (const line of String(text).split("\n")) chatLines.push({ text: line, cls, life: 10 });
    if (chatLines.length > 14) chatLines.splice(0, chatLines.length - 14);
    chatSig = "";
  }
  function renderChat() {
    const open = !chatIn.hidden, vis = chatLines.filter(l => open || l.life > 0).slice(open ? -10 : -6);
    const sg = vis.map(l => l.text + "|" + l.cls + "|" + (l.life < 1.5 && !open ? 1 : 0)).join("\n");
    if (sg === chatSig) return;
    chatSig = sg; chatLog.textContent = "";
    for (const l of vis) chatLog.appendChild(h("div", { class: "sb-cl " + l.cls + (l.life < 1.5 && !open ? " fade" : "") }, l.text));
  }
  function openChat(pre = "") {
    if (state !== "playing") return;
    keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; game.mineStop();
    chatIn.hidden = false; chatIn.value = pre; chatIdx = chatHist.length; chatSig = ""; chatIn.focus();
  }
  function closeChat() { chatIn.hidden = true; chatIn.value = ""; chatSig = ""; blurFocus(); }
  function runChat(line) {
    line = line.trim();
    if (!line) return;
    chatHist.push(line); if (chatHist.length > 30) chatHist.shift();
    chatPrint(line, "me");
    if (!line.startsWith("/")) return;
    let r;
    try { r = game.command(line); } catch (_) { r = { ok: false, lines: ["Das ging schief – der Befehl wurde nicht ausgeführt."] }; }
    for (const l of r.lines) chatPrint(l, r.ok ? "ok" : "bad");
    sfx(r.ok ? "chat" : "error"); dirty = true; sig.win = "";
  }
  chatIn.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); const v = chatIn.value; closeChat(); runChat(v); }
    else if (e.key === "Escape") { e.preventDefault(); closeChat(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (chatIdx > 0) chatIn.value = chatHist[--chatIdx]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); chatIdx = Math.min(chatHist.length, chatIdx + 1); chatIn.value = chatHist[chatIdx] || ""; }
  });
  chatIn.addEventListener("blur", () => { if (!chatIn.hidden) closeChat(); });

  // ---------- Gamepad ----------
  function getPad() {
    try { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const x of l) if (x && x.connected) return x; } catch (_) {}
    return null;
  }
  function buzz(ms) {
    if (!settings.vibrate) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
      const gp = getPad(), a = gp && gp.vibrationActuator;
      if (a && a.playEffect) a.playEffect("dual-rumble", { duration: ms, weakMagnitude: 0.4, strongMagnitude: 0.7 });
    } catch (_) {}
  }
  function placeCursor(x, y) {
    cursorEl.style.transform = `translate(${x - 16}px, ${y - 16}px)`;
    padEl.style.transform = `translate(${x}px, ${y}px)`;
  }
  /** Klick des Gamepads im Fenster: Plätze bekommen ein echtes pointerdown, Knöpfe einen Klick */
  function padClick(r, btn, shift) {
    const cx = r.left + padPt.x, cy = r.top + padPt.y;
    const el = document.elementFromPoint ? document.elementFromPoint(cx, cy) : null;
    if (!el || !el.closest) return;
    const b = el.closest("button, input");
    if (b && !el.closest(".sb-s")) { if (btn === 0 && b.click) b.click(); return; }
    const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: btn, shiftKey: !!shift };
    el.dispatchEvent(typeof PointerEvent === "function" ? new PointerEvent("pointerdown", opts) : new MouseEvent("pointerdown", opts));
  }
  function pollPad(dt) {
    const gp = getPad();
    const res = padStep(gp ? readPad(gp) : null, padPrev, { win: !!game.win, sens: settings.padSens });
    padPrev = res.state;
    if (!gp) {
      if (padHad) { padHad = false; pad.left = pad.right = pad.jump = pad.down = false; if (padMine || padUse) { padMine = padUse = false; up(); } padEl.hidden = true; padShown = false; }
      return;
    }
    padHad = true;
    const e = res.edges;
    if (game.win) {
      pad.left = pad.right = pad.jump = pad.down = false;
      if (padMine || padUse) { padMine = padUse = false; up(); }
      const r = winWrap.getBoundingClientRect();
      if (!padShown) { padPt = { x: (r.width || 400) / 2, y: (r.height || 300) / 2 }; padShown = true; }
      if (res.cursor) padPt = moveCursor(padPt, res.cursor, dt, r.width || 400, r.height || 300);
      placeCursor(padPt.x, padPt.y); padEl.hidden = false;
      if (e.click != null) padClick(r, e.click, e.shift);
      if (e.close) { game.closeWindow(); sig.win = ""; }
      return;
    }
    padShown = false; padEl.hidden = true;
    pad.left = res.move.left; pad.right = res.move.right; pad.jump = res.move.jump; pad.down = res.move.down;
    if (e.slot) game.select((game.sel + e.slot + 9) % 9);
    if (e.inventory) toggleInv();
    if (e.advancements) toggleAdv();
    if (e.drop) { game.throwHeld(false); dirty = true; }
    if (e.pause) { pause(); return; }
    if (res.mine || res.use || res.aim) {
      const p = game.player, pt = aimPoint(p.x + p.w / 2, p.y + 0.6, p.face, res.aim, REACH), tile = T * S;
      mouse.px = (pt.x - (cam.x - canvas.width / 2 / tile)) * tile; mouse.py = (pt.y - (cam.y - canvas.height / 2 / tile)) * tile; mouse.in = true;
    }
    const want = res.use ? 2 : res.mine ? 0 : -1, cur = padUse ? 2 : padMine ? 0 : -1;
    if (want !== cur) {
      if (cur !== -1) up();
      padMine = want === 0; padUse = want === 2;
      if (want !== -1) pressAt(want);
    }
  }
  // Im Menü (Spiel angehalten): Start oder A setzt fort
  let idlePrev = null, idleA = false;
  const idleTimer = setInterval(() => {
    if (destroyed) return;
    if (state === "playing") { idlePrev = null; return; }
    const gp = getPad(), res = padStep(gp ? readPad(gp) : null, idlePrev, { win: false });
    const a = !!(res.state && res.state.a);
    if (idlePrev === null) { idlePrev = res.state || {}; idleA = a; return; }
    idlePrev = res.state || {};
    if (page === "main" && gp && (res.edges.pause || (a && !idleA))) primary();
    idleA = a;
  }, 100);
  const onPadConnect = () => { if (state === "playing") say("Gamepad verbunden.", 2000); };
  window.addEventListener("gamepadconnected", onPadConnect);

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
      if (page !== "main") { if (e.key === "Escape") { e.preventDefault(); if (page === "newworld") { page = "worlds"; renderPage(); } else backToMain(); } return; }
      if (e.key === "Enter" || (e.key === " " && state !== "paused")) { e.preventDefault(); if (!e.repeat) primary(); }
      else if (state === "paused" && (e.key === "p" || e.key === "P" || e.key === "Escape")) { e.preventDefault(); if (!e.repeat) primary(); }
      return;
    }
    if (e.key === "F3") { e.preventDefault(); if (!e.repeat) setSetting("debug", !settings.debug); return; }
    if ((e.key === "t" || e.key === "T" || e.key === "/") && !game.win) { e.preventDefault(); if (!e.repeat) openChat(e.key === "/" ? "/" : ""); return; }
    if (e.key === "e" || e.key === "E") { e.preventDefault(); if (!e.repeat) toggleInv(); return; }
    if (e.key === "g" || e.key === "G") { e.preventDefault(); if (!e.repeat) toggleAdv(); return; }
    if (e.key === "Escape" && game.win) { e.preventDefault(); game.closeWindow(); sig.win = ""; return; }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") { e.preventDefault(); if (!e.repeat) pause(); return; }
    if (e.key >= "1" && e.key <= "9") { e.preventDefault(); game.select(Number(e.key) - 1); return; }
    if (game.win) return;
    const a = KEYMAP[e.key];
    if (a) { e.preventDefault(); act(a, true); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); if (!e.repeat && game.swapHands()) { dirty = true; sfx("click"); } }
    else if (e.key === "q" || e.key === "Q") { e.preventDefault(); game.throwHeld(e.shiftKey); dirty = true; }
    else if (e.key === "m" || e.key === "M") { soundBtn.click ? soundBtn.click() : null; }
  }
  function onKeyUp(e) { const a = KEYMAP[e.key]; if (a) act(a, false); }
  function autoPause() { keys.left = keys.right = keys.jump = keys.down = false; mouse.down = false; if (state === "playing") pause(); }
  const onVisibility = () => { if (document.hidden) autoPause(); };
  function setPointer(e) {
    const r = canvas.getBoundingClientRect(), w = r.width || 1, hh = r.height || 1;
    mouse.px = (e.clientX - r.left) * (canvas.width / w); mouse.py = (e.clientY - r.top) * (canvas.height / hh); mouse.in = true;
  }
  /** Taste drücken (Maus, Touch oder Gamepad): btn 0 = abbauen/kämpfen, 2 = benutzen/bauen */
  function pressAt(btn) {
    mouse.down = true; mouse.btn = btn;
    placeCd = 0; mouse.first = true;
    if (mouse.btn === 2) {                       // Benutzen sofort ausführen, damit auch ganz kurze Klicks/Tipper zählen
      const m = worldMouse();
      mouse.first = false;
      if (game.use(Math.floor(m.x), Math.floor(m.y))) { placeCd = 0.25; dirty = true; mouse.used = true; }
      else if (game.selItem() === "bow" && !game.hasAmmo()) say("Du brauchst Pfeile für den Bogen.", 1800);
      else if (game.selItem() === "crossbow" && !game.xbowLoaded() && !game.hasAmmo(true)) say("Du brauchst Pfeile oder Feuerwerksraketen für die Armbrust.", 2200);
    } else mouse.used = false;
  }
  canvas.addEventListener("pointerdown", e => {
    if (state !== "playing") return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    setPointer(e); ensureAudio();
    pressAt(e.pointerType === "touch" || e.pointerType === "pen" ? (touchMode === "use" ? 2 : 0) : (e.button === 2 ? 2 : 0));
  });
  canvas.addEventListener("pointermove", setPointer);
  const up = () => {
    if (mouse.down && mouse.btn === 2 && (game.bow || game.xbow || game.trid)) { const m = worldMouse(); if (game.handRelease(m.x, m.y)) { dirty = true; } }
    game.bow = null; game.xbow = null; game.trid = null; game.blocking = false; mouse.used = false;
    mouse.down = false; game.mineStop();
  };
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", () => { mouse.in = false; });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => { if (state !== "playing") return; e.preventDefault(); game.select((game.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9); }, { passive: false });
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", autoPause);
  document.addEventListener("visibilitychange", onVisibility);

  // ---------- Größe ----------
  let S = 2, spyOn = false;
  function resize() {
    const r = canvas.getBoundingClientRect();
    const cw = Math.max(240, Math.round((r.width || 800) * dpr)), ch = Math.max(200, Math.round((r.height || 520) * dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    S = clamp(Math.max(2, Math.round(ch / 330)) + settings.zoom + (spyOn ? 3 : 0), 1, spyOn ? 9 : 6);
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
    const t0 = performance.now();
    pollPad(dt);
    step(dt);
    draw(dt);
    hud();
    drawMs += (performance.now() - t0 - drawMs) * 0.1;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (state === "playing") raf = requestAnimationFrame(frame);
  }
  function worldMouse() {
    const tile = T * S, cw = canvas.width, ch = canvas.height;
    return { x: cam.x - cw / 2 / tile + mouse.px / tile, y: cam.y - ch / 2 / tile + mouse.py / tile };
  }
  function step(dt) {
    const lock = !!game.win;
    { const spy = !lock && mouse.down && mouse.btn === 2 && game.selItem() === "spyglass"; if (spy !== spyOn) { spyOn = spy; resize(); } }
    game.input.left = !lock && (keys.left || pad.left); game.input.right = !lock && (keys.right || pad.right); game.input.jump = !lock && (keys.jump || pad.jump); game.input.down = !lock && (keys.down || pad.down);
    // Maus: abbauen, kämpfen, bauen
    let mining = false;
    if (mouse.down && mouse.in !== false) {
      const m = worldMouse(), tx = Math.floor(m.x), ty = Math.floor(m.y);
      if (mouse.btn === 2) {
        placeCd -= dt;
        const hs = game.handHold(dt, m.x, m.y, mouse.used);
        if ((hs === "bow" && game.bow.t < dt * 1.5) || (hs === "xbow" && game.xbow && game.xbow.t < dt * 1.5)) sfx("click");
        if (mouse.first) { mouse.first = false; if (game.use(tx, ty)) { placeCd = 0.25; dirty = true; } }
        else if (placeCd <= 0) { const it = game.handItem(); if (it && ITEMS[it].block && !BLOCKS[game.tile(tx, ty)].interact && game.place(tx, ty)) { placeCd = 0.12; dirty = true; } }
      }
      else if (game.attack(m.x, m.y)) { swingT = 0.25; sfx("kill"); }
      else { const r = game.mineStep(tx, ty, dt); mining = r === 1 || r === 2; if (mining && Math.random() < dt * 9) sfx("pick"); if (r === 1 && Math.random() < dt * 22) spark(tx + 0.5, ty + 0.5, game.tile(tx, ty), 1); }
    } else game.mineStop();
    game.aim = mouse.in ? worldMouse() : null;
    swingT = Math.max(0, swingT - dt);
    for (let i = sweeps.length - 1; i >= 0; i--) { sweeps[i].life -= dt; if (sweeps[i].life <= 0) sweeps.splice(i, 1); }
    game.player.swing = mining ? 1 : swingT > 0 ? 1 : 0;
    const air0 = !game.player.onGround, vy0 = game.player.vy;
    game.update(dt);
    const p = game.player;
    if (Math.abs(p.vx) > 0.5 && p.onGround) walkPh += dt * Math.abs(p.vx) * 1.7;
    // Schritte, Landung, Wetter- und Höhlenklang, Musik
    if (p.onGround && !p.flying && Math.abs(p.vx) > 0.5 && !game.win) {
      stepAcc += Math.abs(p.vx) * dt;
      if (stepAcc > 2.4) { stepAcc = 0; audio.step(stepMaterial(game.tile(Math.floor(p.x + p.w / 2), Math.floor(p.y + p.h + 0.1))), Math.abs(p.vx) / 4); }
    } else if (!p.onGround) stepAcc = 1.6;
    if (air0 && p.onGround && vy0 > 9) audio.sfx("land");
    if (settings.sound) soundScape(dt);
    // Kamera folgt weich
    const tx = p.x + p.w / 2, ty = p.y + p.h / 2 - 0.4, k = 1 - Math.pow(0.0005, dt);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    if (Math.abs(cam.x - tx) > 30 || Math.abs(cam.y - ty) > 30) { cam.x = tx; cam.y = ty; }      // nach einem Sprung (/tp) sofort mitkommen
    // Ereignisse verarbeiten
    for (const e of game.events) {
      if (ocean11Event(e)) continue;
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
      else if (e.t === "hurt") { flash = 0.5; kick(0.25); buzz(40); sfx("hurt"); if (e.why === "lava") say("Autsch – Lava!", 1200); else if (e.why === "drown") say("Du ertrinkst! Schwimm nach oben (Leertaste).", 1500); }
      else if (e.t === "hiss") { spark(e.x + 0.5, e.y + 0.5, B.STONE, 7); sfx("hiss"); }
      else if (e.t === "bucket") { spark(e.x + 0.5, e.y + 0.5, e.fill ? B.WATER : B.LAVA, 6); sfx("place"); dirty = true; }
      else if (e.t === "died") say("Du bist gestorben. Deine Sachen liegen dort, wo es passiert ist – du hast 5 Minuten.", 5000);
      else if (e.t === "day") say(`Tag ${e.day}`, 2200);
      else if (e.t === "hit") { spark(e.x, e.y + 0.4, [200, 40, 40], 5); floats.push({ x: e.x, y: e.y - 0.2, text: `-${e.n}`, color: e.src === "player" || e.src === "arrow" ? "#ffe0a0" : "#ffb0a0", life: 0.9 }); if (e.src === "player") sfx("kill"); }
      else if (e.t === "kill") { spark(e.x, e.y, MOB_COLORS[e.type] || [200, 200, 200], 14); sfx("kill"); }
      else if (e.t === "crit") { floats.push({ x: e.x, y: e.y - 0.9, text: "Krit!", color: "#fff070", life: 0.9 }); }
      else if (e.t === "shoot") sfx("shoot");
      else if (e.t === "thunk") sfx("thunk");
      else if (e.t === "block") { if (e.mob) spark(e.x, e.y, [210, 214, 226], 6); else spark(game.player.x + game.player.w / 2 + game.player.face * 0.6, game.player.y + 0.8, [210, 214, 226], 6); sfx("block"); }
      else if (e.t === "shieldbreak") { spark(e.x, e.y + 0.6, [200, 150, 90], 12); sfx("hurt"); if (!e.mob) say("Dein Schild ist für 5 Sekunden lahmgelegt!", 1800); }
      else if (e.t === "sweep") { sweeps.push({ x: e.x, y: e.y, dir: e.dir, life: 0.22 }); sfx("kill"); }
      else if (e.t === "thorns") { spark(e.x, e.y + 0.8, [150, 210, 90], 6); }
      else if (e.t === "swap") sfx("click");
      else if (e.t === "xbowload") { sfx("click"); dirty = true; }
      else if (e.t === "rocket") { spark(e.x, e.y, [255, 190, 80], 8); sfx("shoot"); }
      else if (e.t === "firework") { const c = e.col >= 0 ? hex2rgb(COLORS[e.col & 15][2]) : [255, 220, 120]; for (let r = 0; r < 3; r++) spark(e.x, e.y, r === 1 ? [255, 255, 255] : c, 14); sfx("kill"); }
      else if (e.t === "cloud") { spark(e.x, e.y - 0.3, hex2rgb(e.col), 12); sfx("splash"); }
      else if (e.t === "splash") { spark(e.x, e.y, hex2rgb(e.col), 16); sfx("splash"); }
      else if (e.t === "till") { spark(e.x + 0.5, e.y + 0.3, B.DIRT, 6); sfx("place"); dirty = true; }
      else if (e.t === "grow") { spark(e.x + 0.5, e.y + 0.4, 1000, 9); sfx("xp"); dirty = true; }
      else if (e.t === "love") { for (let i = 0; i < 3; i++) floats.push({ x: e.x + (i - 1) * 0.35, y: e.y - 0.3 - (i % 2) * 0.25, text: "❤", color: e.grow ? "#9be07a" : "#ff6080", life: 1 }); sfx("click"); dirty = true; }
      else if (e.t === "baby") { for (let i = 0; i < 5; i++) floats.push({ x: e.x + (i - 2) * 0.35, y: e.y - 0.3 - (i % 2) * 0.3, text: "❤", color: "#ff6080", life: 1.2 }); sfx("tame"); dirty = true; }
      else if (e.t === "cast") sfx("shoot");
      else if (e.t === "bite") { floats.push({ x: e.x, y: e.y - 0.8, text: "!", color: "#ffe060", life: 0.9 }); sfx("splash"); }
      else if (e.t === "reel") { if (e.item) { floatText(`Gefangen: ${ITEMS[e.item].name}`, e.treasure ? "#c9a0ff" : "#fff3b0"); sfx("pick"); spark(e.x, e.y, B.WATER, 8); dirty = true; } else sfx("click"); }
      else if (e.t === "effect") { if (!e.silent) { say(`${EFFECT_NAMES[e.name] || e.name}!`, 1600); sfx("eat"); } }
      else if (e.t === "effect_end") floatText(`${EFFECT_NAMES[e.name] || e.name} ist vorbei`, "#d0d0d8");
      else if (e.t === "drink") sfx("eat");
      else if (e.t === "enchant") { spark(game.player.x + game.player.w / 2, game.player.y + 0.5, [168, 90, 255], 18); sfx("adv"); dirty = true; }
      else if (e.t === "noench") { sfx("block"); }
      else if (e.t === "anvil") { spark(e.x + 0.5, e.y + 0.3, [200, 200, 210], 6); sfx("block"); dirty = true; }
      else if (e.t === "anvilbreak") { say("Der Amboss ist kaputtgegangen.", 2600); sfx("hurt"); dirty = true; }
      else if (e.t === "brewed") { sfx("splash"); dirty = true; }
      else if (e.t === "rs") { if (e.k === "piston") { spark(e.x + 0.5, e.y + 0.5, B.STONE, 5); sfx("thunk"); } else if (e.k === "lamp") sfx("click"); else sfx(e.on === false ? "click" : "thunk"); dirty = true; }
      else if (e.t === "fuse") sfx("hiss");
      else if (e.t === "boom") {
        spark(e.x, e.y, B.STONE, 26); spark(e.x, e.y, B.DIRT, 14); spark(e.x, e.y, [70, 70, 70], 22); spark(e.x, e.y, [255, 190, 70], 14); sfx("boom"); whiteout = 0.35; dirty = true;
        const d = Math.hypot(e.x - game.player.x, e.y - game.player.y); kick(clamp(1 - d / 16, 0, 1) * 0.8);
      }
      else if (e.t === "tp") { spark(e.x + 0.3, e.y + 1, [176, 60, 232], 10); sfx("tp"); if (e.self) { cam.x = game.player.x + game.player.w / 2; cam.y = game.player.y; } }
      else if (e.t === "tame") { for (let i = 0; i < 4; i++) floats.push({ x: e.x + (i - 1.5) * 0.4, y: e.y - 0.3 - (i % 2) * 0.3, text: "❤", color: "#ff6080", life: 1.1 }); sfx("tame"); dirty = true; }
      else if (e.t === "smoke") floats.push({ x: e.x, y: e.y - 0.3, text: "…", color: "#d0d0d0", life: 0.9 });
      else if (e.t === "sit") say(e.sit ? "Er bleibt sitzen." : "Er folgt dir wieder.", 1400);
      else if (e.t === "shear") { spark(e.x, e.y + 0.6, [236, 236, 230], 10); sfx("click"); dirty = true; }
      else if (e.t === "nosleep") say(e.why === "day" ? "Du kannst nur nachts schlafen." : "Du kannst jetzt nicht schlafen – Monster sind in der Nähe!", 2400);
      else if (e.t === "sleep") { fade = 1.6; say("Gute Nacht … der Morgen graut.", 2400); dirty = true; }
      else if (e.t === "nobed") say("Dein Bett fehlt oder wurde zerstört – du startest am Dorf.", 3600);
      else if (e.t === "adv") { say(`🏆 Fortschritt: ${e.name}`, 4200); sfx("adv"); dirty = true; sig.win = ""; }
      else if (e.t === "jump") sfx("jump");
      else if (e.t === "bounce") { sfx("jump"); spark(e.x + 0.5, e.y, [110, 200, 90], 6); dirty = true; }
      else if (e.t === "stonecut" || e.t === "loom" || e.t === "grind" || e.t === "smith" || e.t === "stand" || e.t === "book" || e.t === "camp") { sfx("click"); dirty = true; sig.win = ""; }
      else if (e.t === "wax") { spark(e.x + 0.5, e.y + 0.5, [255, 214, 90], 8); sfx("click"); dirty = true; }
      else if (e.t === "scrape") { spark(e.x + 0.5, e.y + 0.5, [110, 190, 160], 8); sfx("break"); dirty = true; }
      else if (e.t === "candle") { sfx(e.on ? "hiss" : "click"); dirty = true; }
      else if (e.t === "dim") { fade = 1.4; cam.x = game.player.x + game.player.w / 2; cam.y = game.player.y; parts.length = 0; floats.length = 0; say(DIM_NAMES[e.dim] || "", 2400); sfx("portal"); dirty = true; sig.win = ""; }
      else if (e.t === "portal_lit") { spark(e.x + 0.5, e.y + 1.5, [176, 60, 232], 20); sfx("portal"); dirty = true; }
      else if (e.t === "portal_off") { spark(e.x + 0.5, e.y + 1, [176, 60, 232], 14); sfx("hiss"); dirty = true; }
      else if (e.t === "eye") {
        if (e.none) say("Das Enderauge findet nichts – hier gibt es keine Festung in der Nähe.", 2800);
        else say(`Das Enderauge schwebt nach ${e.dx > 0 ? "rechts" : "links"} – etwa ${e.dist} Blöcke weit${e.down ? `, ${e.down} Blöcke tiefer` : ""}.`, 3600);
        spark(game.player.x + game.player.w / 2, game.player.y, [90, 230, 190], 10); sfx("shoot");
      }
      else if (e.t === "eye_in") { spark(e.x + 0.5, e.y + 0.3, [90, 230, 190], 10); sfx("click"); dirty = true; }
      else if (e.t === "eye_break") { say("Das Enderauge zerbricht.", 1800); sfx("break"); }
      else if (e.t === "endportal") { say("Das Endportal öffnet sich!", 3600); sfx("adv"); whiteout = 0.3; spark(e.x + 0.5, e.y + 0.5, [120, 230, 200], 26); dirty = true; }
      else if (e.t === "trade") { spark(e.x, e.y + 0.5, [60, 220, 120], 8); sfx("xp"); }
      else if (e.t === "job") { spark(e.x, e.y + 0.3, [240, 220, 120], 8); sfx("click"); }
      else if (e.t === "villager_level") say(`Der Händler ist jetzt: ${LEVEL_NAMES[e.lvl - 1]} – neue Angebote!`, 2800);
      else if (e.t === "sit") sfx("place");
      else if (e.t === "omen") say("Du spürst ein Unheilvolles Omen … betritt ein Dorf!", 4200);
      else if (e.t === "raid") {
        if (e.s === "start") { say(`⚔ Überfall${e.lvl > 1 ? " der Stufe " + ["I", "II", "III", "IV", "V"][e.lvl - 1] : ""}! Verteidige das Dorf!`, 4200); sfx("roar"); }
        else if (e.s === "wave") { say(`Welle ${e.wave} greift an!`, 2600); sfx("roar"); }
        else if (e.s === "win") { say("🏆 Der Überfall ist abgewehrt – du bist Held des Dorfes!", 4600); sfx("adv"); dirty = true; }
        else if (e.s === "lose") say("Der Überfall ist gescheitert …", 3400);
      }
      else if (e.t === "omen_up") say(`Das Omen wird stärker: Stufe ${["I", "II", "III", "IV", "V"][e.lvl - 1]}`, 3200);
      else if (e.t === "bell") { spark(e.x, e.y, [244, 201, 58], 10); sfx("bell"); }
      else if (e.t === "totem") { say("Das Totem der Unsterblichkeit rettet dich!", 3400); sfx("totem"); whiteout = 0.25; spark(e.x, e.y, [244, 201, 58], 40); spark(e.x, e.y, [60, 220, 120], 24); dirty = true; }
      else if (e.t === "golem") { spark(e.x, e.y, [210, 210, 206], 18); sfx("golem"); dirty = true; }
      else if (e.t === "golem_hit") sfx("golem");
      else if (e.t === "cure_start") { say("Der Zombie-Dörfler beginnt zu zittern …", 2600); spark(e.x, e.y, [255, 224, 112], 10); sfx("tame"); dirty = true; }
      else if (e.t === "cure") { say("Der Zombie-Dörfler ist geheilt – sie bekommen jetzt 20 % Rabatt!", 3400); spark(e.x, e.y, [255, 224, 112], 24); sfx("adv"); dirty = true; }
      else if (e.t === "zombified") { say("Ein Dorfbewohner wurde zum Zombie!", 2600); sfx("roar"); }
      else if (e.t === "villager_died") spark(e.x, e.y + 0.8, [200, 60, 60], 10);
      else if (e.t === "siege") { say("🧟 Zombie-Belagerung! Verteidige das Dorf!", 4200); sfx("roar"); }
      else if (e.t === "trader") { say("Ein Fahrender Händler ist in der Nähe!", 3200); sfx("tame"); }
      else if (e.t === "cast") { spark(e.x, e.y + 0.3, e.kind ? [120, 200, 255] : [244, 201, 58], 10); sfx("hiss"); }
      else if (e.t === "fangs") sfx("fang");
      else if (e.t === "roar" || e.t === "ravager_hit") sfx("roar");
      else if (e.t === "barter_start") sfx("click");
      else if (e.t === "barter") { spark(e.x, e.y + 0.5, [244, 201, 58], 8); sfx("xp"); }
      else if (e.t === "ghast_charge") sfx("gcharge");
      else if (e.t === "ghast_shoot") sfx("gshoot");
      else if (e.t === "blaze_shoot") sfx("shoot");
      else if (e.t === "wither_summon") { say("Der Wither wird beschworen …", 3000); sfx("roar"); }
      else if (e.t === "wither_awake") { sfx("boom"); whiteout = 0.35; kick(0.6); }
      else if (e.t === "dragon_dive") sfx("roar");
      else if (e.t === "dragon_dead") { say("Der Enderdrache ist besiegt! Ein Tor öffnet sich …", 6000); sfx("adv"); whiteout = 0.6; spark(game.player.x, game.player.y, [200, 120, 255], 30); dirty = true; }
      else if (e.t === "beacon_set") { say(`Leuchtfeuer: ${EFFECT_NAMES[e.name] || e.name}`, 2200); sfx("adv"); dirty = true; }
      else if (e.t === "beacon_no") { say(e.why === "lvl" ? "Dafür ist die Pyramide zu klein." : "Lege einen Eisen-, Gold-Barren, Smaragd oder Diamanten als Bezahlung ein.", 2600); sfx("block"); }
      else if (e.t === "lightning") { const d = Math.abs(e.x - game.player.x); spark(e.x + 0.5, e.y, [255, 255, 200], 14); audio.thunder(d); if (d < 14) { kick(0.35); buzz(70); } }
      else if (e.t === "weather") { if (!game.dim) say(e.kind === "clear" ? "Der Himmel klart auf." : e.kind === "thunder" ? "Ein Gewitter zieht auf." : game.precipAt(game.player.x) === "snow" ? "Es beginnt zu schneien." : game.precipAt(game.player.x) === "none" ? "Wolken ziehen auf." : "Es beginnt zu regnen.", 2400); }
      else if (e.t === "mode") { say(`Spielmodus: ${MODES[e.m]}`, 2200); sfx("mode"); dirty = true; sig.win = ""; }
      else if (e.t === "spark") spark(e.x, e.y, [255, 150, 40], 8);
    }
    game.events.length = 0;
    // Partikel, Schwebetexte, Meldungen
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt; q.vy += (q.gy === undefined ? 24 : q.gy) * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.life <= 0) parts.splice(i, 1); }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y -= dt * 0.9; if (f.life <= 0) floats.splice(i, 1); }
    flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt); fade = Math.max(0, fade - dt); whiteout = Math.max(0, whiteout - dt);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.hidden = true; }
    for (const l of chatLines) l.life -= dt;
    renderChat();
    if (heldT > 0) { heldT -= dt; if (heldT <= 0) heldName.hidden = true; }
    saveT += dt; if (saveT > 20 && dirty) saveNow();
  }
  const kick = v => { if (settings.shake) shake = Math.max(shake, v); };
  /** Klang der Umgebung: Regen (draußen laut, unter Dach leise), Höhlenbrummen, Musik je nach Stimmung */
  function soundScape(dt) {
    const p = game.player, px = p.x + p.w / 2, wk = game.weather, depth = game.dim ? 0 : p.y - SURF;
    let rain = 0;
    if (!game.dim && wk.k > 0.05 && game.precipAt(px) === "rain") rain = wk.k * (game.rainsOn(px, p.y) ? 1 : 0.25);
    audio.ambient({ rain, cave: game.dim ? 0 : clamp((depth - 14) / 20, 0, 1) });
    let boss = false;
    for (const m of game.mobs) if (m.boss) { boss = true; break; }
    audio.music(dt, musicMood({ dim: game.dim || 0, boss, depth, raining: rain > 0.4, time: game.time }));
  }
  function spark(x, y, id, n) {
    if (!settings.particles) n = Math.min(n, 2);
    const col = Array.isArray(id) ? id : id === 1000 ? [90, 210, 120] : avg[id] || [200, 200, 200];
    for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5 - 1, life: 0.5 + Math.random() * 0.5, c: col, s: 0.1 + Math.random() * 0.12 });
  }
  function floatText(text, color) {
    const p = game.player;
    for (const f of floats) if (f.text === text && f.life > 0.8) { return; }
    floats.push({ x: p.x + p.w / 2, y: p.y - 0.4 - floats.length * 0.35, text, color, life: 1.4 });
  }

  /** Ereignisse der Etappe 11 (Ozean); true = behandelt */
  function ocean11Event(e) {
    const p = game.player, bub = (x, y, n) => { for (let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * 0.7, y: y + (Math.random() - 0.5) * 0.5, vx: (Math.random() - 0.5) * 1.4, vy: -1.5 - Math.random() * 2, gy: -3, life: 0.7 + Math.random() * 0.7, c: [220, 240, 255], s: 0.07 + Math.random() * 0.08 }); };
    switch (e.t) {
      case "ink": spark(e.x, e.y + 0.5, e.glow ? [90, 235, 225] : [24, 24, 40], 18); bub(e.x, e.y + 0.5, 4); sfx("splash"); return true;
      case "jet": bub(e.x, e.y + 0.4, 7); return true;
      case "splash": spark(e.x, e.y, B.WATER, 12); bub(e.x, e.y, 4); sfx("splash"); return true;
      case "puff": spark(e.x, e.y + 0.3, [226, 198, 62], 8); bub(e.x, e.y + 0.3, 3); sfx("hiss"); return true;
      case "beam_start": sfx("gcharge"); return true;
      case "beam_hit": rays.push({ x: e.x, y: e.y, tx: e.tx, ty: e.ty, life: 0.3, col: "#ff9060" }); spark(e.tx, e.ty, [255, 130, 90], 14); sfx("gshoot"); return true;
      case "curse": spark(p.x + p.w / 2, p.y + 0.6, [190, 190, 160], 22); say("Der Älteste Wächter hat dich verflucht – Abbaumüdigkeit!", 3200); sfx("roar"); kick(0.5); return true;
      case "convert": spark(e.x, e.y + 0.8, [106, 168, 158], 16); bub(e.x, e.y + 0.8, 6); sfx("splash"); return true;
      case "scute": spark(e.x, e.y + 0.4, [100, 190, 80], 8); sfx("pick"); return true;
      case "egg_lay": spark(e.x + 0.5, e.y + 0.6, [236, 232, 200], 6); sfx("place"); dirty = true; return true;
      case "hatch": for (let i = 0; i < 3; i++) floats.push({ x: e.x + 0.5 + (i - 1) * 0.35, y: e.y - 0.1 - (i % 2) * 0.25, text: "❤", color: "#9be07a", life: 1.1 }); spark(e.x + 0.5, e.y + 0.6, [236, 232, 200], 12); sfx("tame"); dirty = true; return true;
      case "sponge": spark(e.x + 0.5, e.y + 0.5, [212, 196, 70], 14); bub(e.x + 0.5, e.y + 0.5, 6); sfx("splash"); dirty = true; return true;
      case "riptide": bub(e.x, e.y, 14); spark(e.x, e.y, B.WATER, 10); sfx("splash"); kick(0.35); return true;
      case "conduit_hit": rays.push({ x: e.x + 0.5, y: e.y + 0.5, tx: e.tx, ty: e.ty, life: 0.35, col: "#9af4ff" }); spark(e.tx, e.ty, [150, 240, 255], 6); sfx("click"); return true;
      case "trident_back": spark(e.x, e.y, [140, 235, 250], 8); sfx("click"); dirty = true; return true;
      case "heal_fx": for (let i = 0; i < 3; i++) floats.push({ x: e.x + (i - 1) * 0.35, y: e.y - 0.2 - (i % 2) * 0.3, text: "❤", color: "#ff6080", life: 1.1 }); sfx("tame"); return true;
      case "coral_dies": spark(e.x + 0.5, e.y + 0.5, [150, 144, 134], 8); dirty = true; return true;
      default: return false;
    }
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
  /** Himmel im Nether (rote Glut) und im Ende (violette Leere mit Sternen) */
  function drawDimSky(dim, cw, ch) {
    const t = performance.now(), grad = g.createLinearGradient(0, 0, 0, ch);
    if (dim === 1) { const pu = 0.5 + 0.5 * Math.sin(t / 1800); grad.addColorStop(0, "#1a0305"); grad.addColorStop(1, rgb([92 + pu * 16, 20, 10])); }
    else { grad.addColorStop(0, "#04010a"); grad.addColorStop(1, "#1a0c2c"); }
    g.fillStyle = grad; g.fillRect(-8, -8, cw + 16, ch + 16);
    if (dim === 2) {
      g.fillStyle = "#e6d8ff";
      for (const [sx0, sy0, sz] of stars) { g.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(t / 900 + sx0 * 40)); g.fillRect(Math.round(((sx0 * cw - cam.x * T * S * 0.03) % cw + cw) % cw), Math.round(sy0 / 0.7 * ch * 0.95), Math.ceil(sz * S * 0.7), Math.ceil(sz * S * 0.7)); }
      g.globalAlpha = 1;
    } else {
      for (let i = 0; i < 30; i++) {
        const x = (i * 137.5 + t * 0.012 * (1 + (i % 3)) + cam.x * T * S * 0.04) % cw, y = ch - ((t * 0.02 * (1 + (i % 4)) + i * 53 * S) % ch);
        g.globalAlpha = 0.25 + 0.3 * ((i * 7) % 5) / 5; g.fillStyle = i % 2 ? "#ff8a30" : "#ffc060"; g.fillRect(Math.round((x + cw) % cw), Math.round(y), S, S);
      }
      g.globalAlpha = 1;
    }
  }
  function draw(dt) {
    const cw = canvas.width, ch = canvas.height, tile = T * S;
    const d = Math.min(1, game.dayFactor() * 1.3), sunAlt = Math.sin(2 * Math.PI * (game.time - 0.25));
    const wk = game.dim || !game.weather ? 0 : game.weather.k;          // wie stark es gerade regnet (0…1)
    g.imageSmoothingEnabled = false;
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 6 * S * shake * 4) : 0, sy = shake > 0 ? Math.round((Math.random() - 0.5) * 6 * S * shake * 4) : 0;
    g.setTransform(1, 0, 0, 1, sx, sy);
    const left = cam.x - cw / 2 / tile, top = cam.y - ch / 2 / tile;
    const x0 = Math.floor(left), y0 = Math.floor(top);
    const offX = Math.round((left - x0) * tile), offY = Math.round((top - y0) * tile);
    const scr = (wx, wy) => [Math.round((wx - left) * tile), Math.round((wy - top) * tile)];

    // --- Himmel ---
    const dim = game.dim || 0;
    const horizon = Math.round((SURF - top) * tile);        // Höhe der Dorfwiese auf dem Bildschirm
    if (dim) drawDimSky(dim, cw, ch); else {
    let [c1, c2] = skyColors(d, sunAlt);
    if (wk > 0) { const gv = 0.3 + 0.7 * d; c1 = mix(c1, [64 * gv, 70 * gv, 84 * gv], wk * 0.7); c2 = mix(c2, [110 * gv, 118 * gv, 130 * gv], wk * 0.75); }
    const grad = g.createLinearGradient(0, 0, 0, Math.max(ch, horizon + tile * 6));
    grad.addColorStop(0, rgb(c1)); grad.addColorStop(1, rgb(c2));
    g.fillStyle = grad; g.fillRect(-8, -8, cw + 16, ch + 16);
    if (d < 0.7) { const a = clamp((0.7 - d) * 1.6, 0, 1); g.fillStyle = "#fff"; for (const [sx0, sy0, sz] of stars) { g.globalAlpha = a * (1 - wk * 0.85) * (0.5 + 0.5 * Math.sin(game.time * 400 + sx0 * 50)); g.fillRect(Math.round(sx0 * cw), Math.round(sy0 * Math.max(60, horizon)), Math.ceil(sz * S * 0.7), Math.ceil(sz * S * 0.7)); } g.globalAlpha = 1; }
    // Sonne und Mond ziehen im Bogen über den Himmel
    const arcY = Math.max(80 * S, Math.min(horizon, ch)), arcH = Math.min(arcY * 0.85, ch * 0.6);
    const body = (u, col, glow, r, paint) => {
      if (u < -0.1 || u > 1.1) return;
      const bx = u * cw, by = arcY - Math.sin(clamp(u, 0, 1) * Math.PI) * arcH;
      const gr = g.createRadialGradient(bx, by, r * 0.4, bx, by, r * 4); gr.addColorStop(0, glow); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(bx - r * 4, by - r * 4, r * 8, r * 8);
      if (paint) paint(bx, by, r); else { g.fillStyle = col; g.fillRect(Math.round(bx - r), Math.round(by - r), r * 2, r * 2); }
    };
    const tt = game.time;
    if (tt >= 0.2 && tt <= 0.8) { g.globalAlpha = 1 - wk * 0.8; body((tt - 0.2) / 0.6, "#fff6c8", "rgba(255,230,140,.45)", 7 * S); g.globalAlpha = 1; }
    const mt = tt >= 0.7 ? (tt - 0.7) / 0.6 : (tt + 0.3) / 0.6;
    if (mt >= 0 && mt <= 1 && d < 0.8) {
      const mph = game.moonPhase();
      g.globalAlpha = clamp((0.8 - d) * 2, 0, 1) * (1 - wk * 0.8);
      body(mt, "#e6ecff", `rgba(170,190,255,${0.12 + 0.23 * MOON_FULL[mph]})`, 6 * S, (bx, by, r) => drawMoon(g, bx, by, r, mph));
      g.globalAlpha = 1;
    }
    // Wolken
    g.globalAlpha = Math.min(0.95, clamp(d * 1.1, 0.08, 0.9) + wk * 0.35);
    for (const c of clouds) {
      const wx = ((c.x + game.time * DAY_LEN * c.s - cam.x * tile * 0.15) % (cw + 600) + cw + 600) % (cw + 600) - 300;
      const cy = Math.round(c.y * S * 0.6 - (top - 40) * tile * 0.05);
      g.fillStyle = wk > 0.3 ? (d > 0.4 ? "#9ba2b0" : "#555c78") : d > 0.4 ? "#ffffff" : "#8b92b8";
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
    } // Ende Himmel der Oberwelt

    // --- Blöcke ---
    const vw = Math.ceil(cw / tile) + 2, vh = Math.ceil(ch / tile) + 2;
    const fluids = [], plants = [], bcols = [];
    for (let j = 0; j < vh; j++) {
      const ty = y0 + j;
      if (ty < 0 || ty >= H) continue;
      for (let i = 0; i < vw; i++) {
        const tx = x0 + i;
        if (tx < 0 || tx >= W) continue;
        const px = i * tile - offX, py = j * tile - offY;
        const id = game.tiles[ty * W + tx], gy = game.ground[tx], bd = BLOCKS[id];
        if (ty > gy && (id === B.AIR || !bd.solid || id === B.GLASS)) g.drawImage(atlas, (dim === 1 ? IDX5.WALL_NETHER : ty < gy + 7 ? IDX.WALL_DIRT : ty >= DEEP_Y - 2 ? IDX.WALL_DEEP : IDX.WALL_STONE) * T, 0, T, T, px, py, tile, tile);
        if (id === B.AIR) continue;
        if (bd.fluid) { fluids.push(px, py, id, game.lvl[ty * W + tx], ty > 0 ? game.tiles[(ty - 1) * W + tx] : 0); if (id === B.WATER) { const wa = game.aux[ty * W + tx]; if (wa > 0 && wa < 48) plants.push(px, py, wa, tx); } continue; }
        if ((id === B.SOUL_SAND || id === B.MAGMA) && ty > 0 && game.tiles[(ty - 1) * W + tx] === B.WATER) bcols.push(tx, ty, id === B.SOUL_SAND ? 1 : -1);
        let idx = id, row = 0;
        if (id === B.FLOWER) idx = [B.FLOWER, IDX.FLOWER2, IDX.FLOWER3][(tx * 7 + ty * 3) % 3];
        else if (id === B.FURNACE) { const fe = game.ents.get(tx + "," + ty); if (fe && fe.burn > 0) idx = IDX.FURNACE_LIT; }
        else if (id === B.GRASS || id === B.LEAVES || id === B.TALLGRASS) { idx = game.biomes[tx] * 3 + (id === B.GRASS ? 0 : id === B.LEAVES ? 1 : 2); row = 1; }
        else if (ty >= DEEP_Y && ORE_DEEP[id] != null) idx = ORE_DEEP[id];
        if (id >= FIRST12) g.drawImage(atlas, COL12(id) * T, 0, T, T, px, py, tile, tile); /* Etappe 12 */ else if (id >= FIRST11 && drawBlock11(g, atlas, id, game.aux[ty * W + tx], px, py, tile, S, game, tx, ty)) { /* Etappe 11 */ } else if (id >= FIRST9 && drawBlock9(g, atlas, id, game.aux[ty * W + tx], px, py, tile, S, game, tx, ty)) { /* Etappe 9 */ } else if (id >= B.POWDER_SNOW && drawBlock8(g, atlas, id, 0, px, py, tile)) { /* Etappe 8 */ } else if ((id === B.WOOL || id >= B.CONCRETE) && drawBlock6(g, atlas, id, game.aux[ty * W + tx], px, py, tile, S, game, tx, ty)) { /* gemalt */ } else if (id >= B.NETHERRACK && drawBlock5(g, atlas, id, game.aux[ty * W + tx], px, py, tile, S, game, tx, ty)) { /* gemalt */ } else if (id < B.FARMLAND || !drawBlock4(g, atlas, id, game.aux[ty * W + tx], px, py, tile, S, game, tx, ty)) g.drawImage(atlas, idx * T, row * T, T, T, px, py, tile, tile);
        if (id === B.TORCH) { const fl = 0.5 + 0.5 * Math.sin(game.time * 3000 + tx * 2.1); g.fillStyle = `rgba(255,${180 + fl * 60 | 0},80,${0.35 + fl * 0.3})`; g.fillRect(px + 6 * S, py + (2 + (fl > 0.6 ? 0 : 1)) * S, 4 * S, 3 * S); }
      }
    }
    // Risse am Block, den man gerade abbaut, und Zielrahmen
    const mn = game.mining;
    if (mn) { const [bx, by] = scr(mn.x, mn.y); g.drawImage(atlas, (IDX.CRACK + clamp(Math.floor(mn.p * 5), 0, 4)) * T, 0, T, T, bx, by, tile, tile); }
    if (state === "playing" && mouse.in !== false && (mouse.in || mouse.down)) {
      const m = worldMouse(), tx = Math.floor(m.x), ty = Math.floor(m.y), [bx, by] = scr(tx, ty), ok = game.reachOk(tx, ty);
      g.strokeStyle = ok ? "rgba(255,255,255,.85)" : "rgba(255,90,90,.55)"; g.lineWidth = Math.max(1, S); g.strokeRect(bx + S * 0.5, by + S * 0.5, tile - S, tile - S);
      // Angriffsladung (Etappe 10): schmaler Balken unter dem Zielrahmen, solange der nächste Schlag noch lädt
      const ch = game.attackCharge();
      if (ch < 1 && !game.win) {
        const bw2 = tile, bx2 = bx, by2 = by + tile + S;
        g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(bx2 - S, by2 - S, bw2 + 2 * S, 3 * S + S); g.fillStyle = ch >= 0.9 ? "#ffe14a" : "#e8ecf4"; g.fillRect(bx2, by2, Math.round(bw2 * ch), 2 * S);
      }
    }
    // Schwungangriff: heller Bogen vor dem Spieler
    for (const sw of sweeps) {
      const [sx0, sy0] = scr(sw.x - (sw.dir || 1) * 1.2, sw.y), k = 1 - sw.life / 0.22;
      g.save(); g.translate(sx0, sy0); g.scale(sw.dir || 1, 1);
      g.globalAlpha = Math.max(0, 0.9 - k); g.strokeStyle = "#fffbe0"; g.lineWidth = Math.max(2, S * 1.6); g.lineCap = "round";
      g.beginPath(); g.arc(0, 0, tile * (1.7 + k * 0.5), -1.1 + k * 0.5, 1.1 + k * 0.3); g.stroke();
      g.globalAlpha = Math.max(0, 0.6 - k); g.lineWidth = Math.max(1, S * 0.8); g.beginPath(); g.arc(0, 0, tile * (1.3 + k * 0.4), -0.9 + k * 0.4, 0.9 + k * 0.3); g.stroke();
      g.restore();
    }

    // --- Drops ---
    for (const d of game.drops) {
      const [dx, dy] = scr(d.x, d.y), sz = Math.round(tile * 0.45), bob = Math.round(Math.sin(performance.now() / 380 + d.x * 3) * S);
      g.drawImage(art.base(d.id, d), 0, 0, T, T, dx + (d.n > 1 ? Math.round(S * 1.5) : 0), dy - Math.round(sz * 0.4) + bob + (d.n > 1 ? -Math.round(S) : 0), sz, sz);
      if (d.n > 1) g.drawImage(art.base(d.id, d), 0, 0, T, T, dx, dy - Math.round(sz * 0.4) + bob, sz, sz);
    }
    // --- Figuren ---
    for (const v of game.villagers) drawVillager(v, scr);
    const drawMobOne = m => {
      const [mx, my] = scr(m.x, m.y + (m.visOff || 0));
      drawMob(g, m, mx, my + Math.round((m.visOff || 0) * T * S), S, T, performance.now(), art);
      if (m.hp !== m._uiHp) { if (m._uiHp !== undefined) m._uiT = performance.now(); m._uiHp = m.hp; }
    };
    const seaMobs = [];
    for (const m of game.mobs) {
      if (m.x + m.w < left - 3 || m.x > left + cw / tile + 3) continue;
      if (MOBS[m.type] && MOBS[m.type].aq) { seaMobs.push(m); continue; }      // Meerestiere werden nach dem Wasser gemalt, damit sie darin sichtbar bleiben
      drawMobOne(m);
    }
    const tridents = [];
    for (const a of game.proj) { if (a.kind === "trident") { tridents.push(a); continue; } const [ax, ay] = scr(a.x, a.y); drawProjectile(g, a, ax, ay, S, performance.now()); }
    for (const m of game.mobs) {         // Wächterstrahl: wird in zwei bzw. drei Sekunden dicker und röter
      if (!m.beaming) continue;
      const el = m.type === "elder_guardian", f = clamp((m.beamT || 0) / (el ? 3 : 2), 0, 1), pl = game.player;
      const [ax, ay] = scr(m.x + m.w / 2, m.y + m.h * 0.45), [bx2, by2] = scr(pl.x + pl.w / 2, pl.y + 0.7);
      g.save(); g.lineCap = "round";
      g.globalAlpha = 0.25 + 0.45 * f; g.strokeStyle = `rgb(255,${Math.round(210 - f * 120)},${Math.round(160 - f * 110)})`; g.lineWidth = Math.max(1, S * (1 + f * 2.2)); g.beginPath(); g.moveTo(ax, ay);
      const nseg = 7; for (let i = 1; i < nseg; i++) { const u = i / nseg; g.lineTo(ax + (bx2 - ax) * u + Math.sin(performance.now() / 60 + i * 2) * S * (1 - f), ay + (by2 - ay) * u + Math.cos(performance.now() / 70 + i) * S * (1 - f)); } g.lineTo(bx2, by2); g.stroke();
      g.globalAlpha = 0.5 + 0.4 * f; g.strokeStyle = "#fff6e0"; g.lineWidth = Math.max(1, S * 0.5); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke();
      g.restore();
    }
    for (let i = rays.length - 1; i >= 0; i--) {
      const r = rays[i]; r.life -= 1 / 60;
      if (r.life <= 0) { rays.splice(i, 1); continue; }
      const [ax, ay] = scr(r.x, r.y), [bx2, by2] = scr(r.tx, r.ty);
      g.save(); g.globalAlpha = clamp(r.life * 3, 0, 1); g.strokeStyle = r.col; g.lineWidth = Math.max(1, S * 1.4); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke(); g.restore();
    }
    drawPlayer(scr);
    if (game.fish) {                       // Angelschnur und Schwimmer
      const f = game.fish, p = game.player, t = performance.now(), dip = f.st === 1 ? 0.22 + 0.06 * Math.sin(t / 55) : 0.03 * Math.sin(t / 420);
      const [hx, hy] = scr(p.x + p.w / 2 + p.face * 0.6, p.y + 0.45), [bx, by] = scr(f.x, f.y + 0.12 + dip);
      g.strokeStyle = "rgba(235,235,240,.8)"; g.lineWidth = Math.max(1, S * 0.5); g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo((hx + bx) / 2, Math.min(hy, by) - 2.5 * tile * 0.3, bx, by); g.stroke();
      g.fillStyle = "#e23a3a"; g.fillRect(Math.round(bx - 1.5 * S), Math.round(by - 2 * S), Math.round(3 * S), Math.round(2 * S)); g.fillStyle = "#f4f4f4"; g.fillRect(Math.round(bx - 1.5 * S), Math.round(by), Math.round(3 * S), Math.round(1.5 * S));
    }
    if (game.bow && game.bow.t > 0.05) {
      const p = game.player, [px, py] = scr(p.x + p.w / 2, p.y), bwid = 16 * S, f = Math.min(1, game.bow.t / 1.0);
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(Math.round(px - bwid / 2) - S, py - 7 * S - S, bwid + 2 * S, 3 * S + 2 * S);
      g.fillStyle = f >= 1 ? "#ffe14a" : "#ffffff"; g.fillRect(Math.round(px - bwid / 2), py - 7 * S, Math.round(bwid * f), 3 * S);
    }
    if (game.trid && game.trid.t > 0.05) {
      const p = game.player, [px, py] = scr(p.x + p.w / 2, p.y), bwid = 16 * S, f = Math.min(1, game.trid.t / 0.5);
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(Math.round(px - bwid / 2) - S, py - 7 * S - S, bwid + 2 * S, 3 * S + 2 * S);
      g.fillStyle = f >= 1 ? "#7af0ff" : "#ffffff"; g.fillRect(Math.round(px - bwid / 2), py - 7 * S, Math.round(bwid * f), 3 * S);
    }
    if (game.xbow && game.xbow.t > 0.05) {
      const p = game.player, [px, py] = scr(p.x + p.w / 2, p.y), bwid = 16 * S, f = Math.min(1, game.xbow.t / game.crossbowTime());
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(Math.round(px - bwid / 2) - S, py - 7 * S - S, bwid + 2 * S, 3 * S + 2 * S);
      g.fillStyle = f >= 1 ? "#6ae06a" : "#ffffff"; g.fillRect(Math.round(px - bwid / 2), py - 7 * S, Math.round(bwid * f), 3 * S);
    }
    drawFluids(fluids, tile);
    drawOcean(plants, bcols, tile, scr);
    g.globalAlpha = 0.92; for (const m of seaMobs) drawMobOne(m); g.globalAlpha = 1;
    for (const a of tridents) { const [ax, ay] = scr(a.x, a.y); drawProjectile(g, a, ax, ay, S, performance.now()); }
    // Wolken am Boden (Verweiltränke, Drachenatem)
    for (const c of game.clouds) {
      if (c.x + c.r < left - 2 || c.x - c.r > left + cw / tile + 2) continue;
      const [cx0, cy0] = scr(c.x, c.y), rr = c.r * tile, now2 = performance.now(), col = c.kind === "breath" ? [176, 74, 216] : hex2rgb(potionColorOf(c.pot));
      const fade = clamp(1 - c.t / c.life, 0.25, 1);
      g.save(); g.translate(cx0, cy0);
      g.globalAlpha = 0.28 * fade; g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.beginPath(); g.ellipse(0, -0.15 * tile, rr, Math.min(rr * 0.42, tile * 0.95), 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 9; i++) {
        const a = now2 / 900 + i * 0.7, px2 = Math.sin(a * 1.3 + i) * rr * 0.85, py2 = -0.2 * tile - ((now2 / 1400 + i * 0.37) % 1) * tile * 1.1;
        g.globalAlpha = (0.55 - ((now2 / 1400 + i * 0.37) % 1) * 0.5) * fade; g.fillStyle = `rgb(${Math.min(255, col[0] + 50)},${Math.min(255, col[1] + 50)},${Math.min(255, col[2] + 50)})`; g.fillRect(Math.round(px2), Math.round(py2), Math.max(2, S * 1.5), Math.max(2, S * 1.5));
      }
      g.restore();
    }
    // Partikel
    for (const q of parts) { const [bx, by] = scr(q.x, q.y); g.globalAlpha = clamp(q.life * 2, 0, 1); g.fillStyle = rgb(q.c); g.fillRect(bx, by, Math.max(2, q.s * tile), Math.max(2, q.s * tile)); }
    g.globalAlpha = 1;

    // --- Regen und Schnee (nur unter freiem Himmel) ---
    if (!dim) { precip.update(dt, game, { left, top, vw: cw / tile, vh: ch / tile }, W, H, settings); precip.draw(g, game, scr, S, tile); }

    // --- Licht: eine Pixelkarte (1 Pixel = 1 Block), weich auf den Bildschirm gezogen ---
    drawLight(vw, vh, x0, y0, offX, offY, d, tile, cw, ch);
    drawBeams(scr, cw, ch, tile);
    const bo = game.weather && game.weather.bolt;
    if (bo && settings.weatherFx) {
      drawBolt(g, bo, scr, top, S, mulberry32((bo.x * 977 + (bo.t > 0.2 ? 1 : 2)) | 0));
      g.fillStyle = `rgba(235,240,255,${clamp(bo.t / 0.4, 0, 1) * 0.4})`; g.fillRect(-8, -8, cw + 16, ch + 16);
    }

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
    drawBossBar(cw, ch);
    if (game.portalT > 0 && game.portalKind) {
      const a = clamp(game.portalT / game.portalNeed, 0, 1), pul = 0.85 + 0.15 * Math.sin(performance.now() / 90);
      g.fillStyle = game.portalKind === B.PORTAL ? `rgba(110,30,190,${a * 0.72 * pul})` : `rgba(14,40,40,${a * 0.8 * pul})`; g.fillRect(-8, -8, cw + 16, ch + 16);
    }
    if (flash > 0) { g.fillStyle = `rgba(210,30,30,${flash * 0.5})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
    if (whiteout > 0) { g.fillStyle = `rgba(255,240,210,${whiteout * 1.1})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
    if (fade > 0) { g.fillStyle = `rgba(4,6,20,${Math.min(1, fade * 1.6)})`; g.fillRect(-8, -8, cw + 16, ch + 16); }
    if (settings.debug) drawDebug(g, debugLines(), S, cw);
  }
  function debugLines() {
    const p = game.player, w = game.weather;
    return [
      `Blockdorf · ${Math.round(fps)} FPS · ${drawMs.toFixed(1)} ms je Bild`,
      `X ${(p.x + p.w / 2).toFixed(1)} · Höhe ${(SURF - p.y).toFixed(1)}${game.dim ? "" : ` · Y ${mcY(p.y).toFixed(1)}`} · Tempo ${p.vx.toFixed(1)} / ${p.vy.toFixed(1)}`,
      `${BIOME_NAMES[game.biomeAt(p.x + p.w / 2)]} · Seed ${game.seed} · ${MODES[game.mode]}`,
      `Wetter ${w.kind} ${w.k.toFixed(2)} (noch ${Math.round(w.t)} s) · Mond ${game.moonPhase()}`,
      `Figuren ${game.mobs.length} · Drops ${game.drops.length} · Teilchen ${parts.length} · Regen ${precip.drops.length}`
    ];
  }

  /** Leuchtfeuer-Strahlen und die Heilstrahlen der Endkristalle (leuchten, also nach dem Licht gezeichnet) */
  const BEAM_COL = { speed: "120,230,255", jump: "140,255,140", strength: "255,110,90", regen: "255,150,220" };
  function drawBeams(scr, cw, ch, tile) {
    const now = performance.now();
    g.globalCompositeOperation = "lighter";
    for (const [k, e] of game.ents) {
      if (e.t !== "beacon" || !e.on) continue;
      const [bx, by] = k.split(",").map(Number), [sx, sy] = scr(bx + 0.5, by);
      if (sx < -tile || sx > cw + tile || sy < -tile * 2) { if (sy < 0) continue; }
      const col = BEAM_COL[e.eff] || "230,255,255", w = tile * 0.34, pul = 0.5 + 0.12 * Math.sin(now / 260);
      g.fillStyle = `rgba(${col},${pul * 0.55})`; g.fillRect(Math.round(sx - w / 2), 0, Math.round(w), Math.max(0, sy - Math.round(tile * 0.35)));
      g.fillStyle = `rgba(${col},${pul})`; g.fillRect(Math.round(sx - w / 5), 0, Math.max(1, Math.round(w * 0.4)), Math.max(0, sy - Math.round(tile * 0.35)));
    }
    const dr = game.mobs.find(m => m.type === "ender_dragon");
    if (dr && dr.healing) {
      const [dx, dy] = scr(dr.x + dr.w / 2, dr.y + dr.h / 2);
      for (const m of game.mobs) {
        if (m.type !== "end_crystal" || Math.abs(m.x - dr.x) > 48) continue;
        const [cx, cy] = scr(m.x + m.w / 2, m.y + m.h / 2);
        g.strokeStyle = `rgba(255,150,255,${0.55 + 0.25 * Math.sin(now / 80 + m.id)})`; g.lineWidth = Math.max(2, S * 1.4);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(dx, dy); g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
  }
  /** Bossleiste oben in der Mitte (Drache, Wither) */
  function drawRaidBar(cw, ri) {
    const w = Math.min(cw * 0.6, 180 * S), x = Math.round((cw - w) / 2), y = Math.round(22 * S), hh = Math.round(3.4 * S);
    const f = ri.state === "wait" && ri.left === 0 ? 0 : clamp(1 - ri.left / Math.max(1, ri.total), 0, 1);
    const lv = ri.lvl > 1 ? ` (Stufe ${["I", "II", "III", "IV", "V"][ri.lvl - 1]})` : "";
    const nm = ri.state === "wait" ? `Überfall${lv} – Welle ${Math.min(ri.wave + 1, ri.waves)} von ${ri.waves} naht …` : `Überfall${lv} – Welle ${ri.wave} von ${ri.waves}`;
    g.font = `bold ${Math.round(4.8 * S)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineWidth = S; g.strokeStyle = "rgba(0,0,0,.8)";
    g.strokeText(nm, cw / 2, y - 2 * S); g.fillStyle = "#fff"; g.fillText(nm, cw / 2, y - 2 * S);
    g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(x - S, y - S, w + 2 * S, hh + 2 * S);
    g.fillStyle = "#c83c3c"; g.fillRect(x, y, Math.round(w * f), hh);
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x, y, Math.round(w * f), Math.max(1, Math.round(hh * 0.3)));
    for (let i = 1; i < 6; i++) { g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x + Math.round(w * i / 6), y, Math.max(1, Math.round(S * 0.5)), hh); }
    g.textBaseline = "middle";
  }
  function drawBossBar(cw, ch) {
    const p = game.player; let b = null;
    for (const m of game.mobs) if (m.boss && (!b || Math.abs(m.x - p.x) < Math.abs(b.x - p.x))) b = m;
    if (!b || Math.abs(b.x - p.x) > 120) { const ri = game.raidInfo(); if (ri) drawRaidBar(cw, ri); return; }
    const w = Math.min(cw * 0.6, 180 * S), x = Math.round((cw - w) / 2), y = Math.round(22 * S), f = clamp(b.hp / b.maxHp, 0, 1), hh = Math.round(3.4 * S);
    const nm = b.fuse > 0 ? "Der Wither erwacht …" : MOBS[b.type].name;
    g.font = `bold ${Math.round(4.8 * S)}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.lineWidth = S; g.strokeStyle = "rgba(0,0,0,.8)";
    g.strokeText(nm, cw / 2, y - 2 * S); g.fillStyle = "#fff"; g.fillText(nm, cw / 2, y - 2 * S);
    g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(x - S, y - S, w + 2 * S, hh + 2 * S);
    g.fillStyle = b.type === "ender_dragon" ? "#c050ff" : "#aab0cc"; g.fillRect(x, y, Math.round(w * f), hh);
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x, y, Math.round(w * f), Math.max(1, Math.round(hh * 0.3)));
    for (let i = 1; i < 10; i++) { g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x + Math.round(w * i / 10), y, Math.max(1, Math.round(S * 0.5)), hh); }
    g.textBaseline = "middle";
  }

  let lightImg = null, glowImg = null, lightW = 0, lightH = 0;
  function drawLight(vw, vh, x0, y0, offX, offY, d, tile, cw, ch) {
    const w = vw + 1, hh = vh + 1;
    if (lightCv.width !== w || lightCv.height !== hh) { lightCv.width = glowCv.width = w; lightCv.height = glowCv.height = hh; lightImg = lg.createImageData(w, hh); glowImg = gg.createImageData(w, hh); }
    const a = lightImg.data, b = glowImg.data, sky = game.sky, blk = game.blk, p = game.player;
    const he = game.heldEmit(), pcx = p.x + p.w / 2, pcy = p.y + p.h / 2, fl = 1 + 0.05 * Math.sin(game.time * 2600), nv = game.hasFx("night_vision");
    const noSky = !!game.noSky, amb = game.dim === 2 ? 7 : game.ambient || 0, tintC = game.dim === 1 ? [34, 4, 4] : game.dim === 2 ? [12, 2, 28] : null;
    const gsq = [];
    for (const m of game.mobs) if (m.type === "glow_squid" && !m.dead) gsq.push(m.x + m.w / 2, m.y + m.h / 2);
    for (let j = 0; j < hh; j++) {
      const ty = y0 + j - 0, rowOk = ty >= 0 && ty < H;
      for (let i = 0; i < w; i++) {
        const tx = x0 + i, o = (j * w + i) * 4;
        let s = 0, bl = 0;
        if (rowOk && tx >= 0 && tx < W) { const k = ty * W + tx; s = noSky ? 0 : sky[k] * d; bl = blk[k]; }
        else if (ty < 0 && tx >= 0 && tx < W) s = noSky ? 0 : 15 * d;
        const near = Math.max(0, 1 - Math.hypot(tx + 0.5 - pcx, ty + 0.5 - pcy) / 4.2);
        const hl = he ? Math.max(0, he * fl - Math.hypot(tx + 0.5 - pcx, ty + 0.5 - pcy) * 1.5) : 0;
        let gl = 0; for (let q = 0; q < gsq.length; q += 2) { const v = 9 - Math.hypot(tx + 0.5 - gsq[q], ty + 0.5 - gsq[q + 1]) * 1.8; if (v > gl) gl = v; }
        const lum = Math.max(s, bl * fl, near * near * 5.2, hl, gl, nv ? 12 : 0, amb) / 15;
        const bright = Math.max(0.025, Math.pow(Math.min(1, lum), 0.82));
        const skyShare = s / (s + bl + 0.001), night = nv ? (1 - d) * 0.25 : 1 - d;
        if (tintC) { a[o] = tintC[0]; a[o + 1] = tintC[1]; a[o + 2] = tintC[2]; } else { a[o] = 2 * night * skyShare; a[o + 1] = 6 * night * skyShare; a[o + 2] = 26 * night * skyShare; }
        a[o + 3] = Math.round((1 - bright) * 255);
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
  /** Wasserpflanzen und Blasensäulen über dem Wasser (Etappe 11) */
  function drawOcean(pl, bc, tile, scr) {
    const t = performance.now(), k = tile / T;
    g.globalAlpha = 0.93;
    for (let i = 0; i < pl.length; i += 4) plantSprite(g, pl[i + 2], pl[i], pl[i + 1], k, t, pl[i + 3] * 0.9);
    g.globalAlpha = 1;
    for (let i = 0; i < bc.length; i += 3) {
      const tx = bc[i], ty = bc[i + 1], up = bc[i + 2] > 0, [bx, by] = scr(tx, ty);
      // Wassersäule oberhalb bis zur Wasseroberfläche (höchstens 24 Felder, sichtbarer Teil)
      for (let yy = ty - 1, n = 0; yy >= 0 && n < 24 && game.tiles[yy * W + tx] === B.WATER; yy--, n++) {
        const cy = by - (ty - yy) * tile;
        if (cy < -tile || cy > canvas.height) continue;
        for (let b = 0; b < 3; b++) {
          const ph = ((t / (up ? 900 : 1100) + b * 0.34 + yy * 0.17 + tx * 0.3) % 1 + 1) % 1, fy = up ? 1 - ph : ph;
          const bxx = bx + Math.round((0.2 + ((b * 0.37 + yy * 0.13) % 0.6)) * tile + Math.sin(t / 300 + b + yy) * S), byy = cy + Math.round(fy * tile);
          const sz = Math.max(2, Math.round((1 + (b % 2)) * S));
          g.globalAlpha = 0.75; g.fillStyle = up ? "#e8f6ff" : "#3a2230"; g.fillRect(bxx, byy, sz, sz);
          g.globalAlpha = 0.9; g.fillStyle = up ? "#9fd2ff" : "#6a3040"; g.fillRect(bxx, byy, Math.max(1, sz - S), Math.max(1, sz - S));
        }
      }
      g.globalAlpha = 1;
    }
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
    if (game.hasFx("invisibility")) g.globalAlpha = 0.3;
    g.translate(bx + (flip ? Math.round(p.w * T * S) : 0), by); g.scale(flip ? -1 : 1, 1);
    const R = (x, y, w, h2, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h2 * S)); };
    const sw = p.onGround ? Math.sin(walkPh * 2.2) * (Math.abs(p.vx) > 0.5 ? 2.6 : 0) : 2;
    const bob = p.onGround && Math.abs(p.vx) > 0.5 ? Math.abs(Math.sin(walkPh * 2.2)) * 0.8 : 0;
    // Elytren (hinter dem Körper): gefaltet am Rücken, beim Gleiten aufgespannt
    if (game.armor[1] && game.armor[1].id === "elytra") {
      if (p.glide) { for (let i = 0; i < 7; i++) { R(3 - i * 2.4, 8 + i * 0.4 - Math.sin(performance.now() / 120 + i) * 0.5, 3, 11 - i * 0.9, i % 2 ? "#6e6e82" : "#8a8aa0"); R(3 - i * 2.4, 8 + i * 0.4, 3, 1.1, "#b4b4c8"); } }
      else { R(-1.2, 9 - bob, 3.4, 11, "#6e6e82"); R(-1.2, 9 - bob, 3.4, 1.4, "#a0a0b8"); R(-0.4, 17 - bob, 2.6, 3.2, "#585870"); }
    }
    // Beine (sitzend: nach vorn ausgestreckt, der ganze Körper rutscht tiefer)
    const sit = !!p.sit;
    if (sit) { g.translate(0, Math.round(5 * S)); R(5, 18, 9, 3, "#463c78"); R(5, 20.4, 9, 0.6, "#2c2650"); R(13, 17.6, 3.4, 3.8, "#3c2a1c"); }
    else { R(3 + sw * 0.5, 18 - bob, 3, 8, "#463c78"); R(7 - sw * 0.5, 18 - bob, 3, 8, "#3a3264");
    R(2.5 + sw * 0.5, 25.5 - bob, 4, 2.5, "#3c2a1c"); R(6.5 - sw * 0.5, 25.5 - bob, 4, 2.5, "#2e2014"); }
    // Körper
    R(2, 9 - bob, 9, 9.5, "#3c6ec8"); R(2, 9 - bob, 9, 1.3, "#5a8ee0"); R(2, 17 - bob, 9, 1.3, "#3c281c");
    // Kopf
    R(3, 2 - bob, 7, 7, "#ecbc94"); R(3, 1 - bob, 8, 2.6, "#54341e"); R(2, 1.6 - bob, 2, 5.5, "#54341e"); R(8, 4.6 - bob, 1.6, 1.6, "#1e1e28"); R(7.5, 7 - bob, 2.5, 0.8, "#c88a6c");
    // Rüstung
    const AC = { leather: ["#a0612f", "#c98a52", "#6f4220"], iron: ["#d0d3de", "#f4f5fa", "#8e91a0"], gold: ["#f2c93c", "#fff0a0", "#b8861a"], diamond: ["#4fe0d8", "#c8fffa", "#1f9c9e"], turtle: ["#58b04a", "#7ad064", "#3e8a38"] };
    const arm = i => (game.armor[i] ? AC[ITEMS[game.armor[i].id].mat] : null);
    let c = arm(2); if (c && !sit) { R(3 + sw * 0.5, 17.5 - bob, 3, 5, c[0]); R(7 - sw * 0.5, 17.5 - bob, 3, 5, c[1]); R(2, 16.5 - bob, 9, 2, c[2]); }
    c = arm(3); if (c && !sit) { R(2.5 + sw * 0.5, 24.5 - bob, 4, 3.5, c[0]); R(6.5 - sw * 0.5, 24.5 - bob, 4, 3.5, c[2]); }
    c = arm(1); if (c) { R(2, 9 - bob, 9, 8, c[0]); R(2, 9 - bob, 9, 1.3, c[1]); R(2, 16 - bob, 9, 1.3, c[2]); R(5, 10 - bob, 3, 5, c[1]); }
    c = arm(0); if (c) { R(2.6, 0.6 - bob, 8.4, 4.4, c[0]); R(2.6, 0.6 - bob, 8.4, 1.2, c[1]); R(2.2, 1 - bob, 1.6, 6, c[2]); R(8.6, 3.6 - bob, 2.4, 1.2, "#00000055"); }
    // Arm und Gegenstand in der Hand
    const swing = p.swing ? Math.sin(performance.now() / 55) : 0;
    const hx = 9.5, hy = 11 - bob;
    g.save(); g.translate(Math.round(hx * S), Math.round(hy * S)); g.rotate(game.trid && game.trid.t > 0.05 ? -2.1 : p.swing ? -0.5 + swing * 0.9 : 0.25);
    R(-1, -0.5, 2.6, 6.5, "#3c6ec8"); R(-1, 5.5, 2.6, 2, "#ecbc94");
    const held = game.selStack();
    if (held) {
      const it = ITEMS[held.id], base = art.base(held.id, held);
      g.translate(0, Math.round(6.5 * S));
      if (it.tool || it.armor) { const sc = S * 0.8; g.rotate(p.swing ? 0.2 : 0.5); g.drawImage(base, 0, 0, T, T, Math.round(-3 * sc), Math.round(-13 * sc), Math.round(T * sc), Math.round(T * sc)); }
      else { const sz = Math.round(7 * S); g.drawImage(base, 0, 0, T, T, Math.round(-sz * 0.2), Math.round(-sz * 0.9), sz, sz); }
    }
    g.restore();
    // Schild (Haupt- oder Zweithand): erhoben vor dem Körper, sonst gesenkt am Arm; nach einem Axthieb grau und wackelnd
    const mainSh = game.selStack(), offSh = game.offh[0];
    const shSt = mainSh && mainSh.id === "shield" ? mainSh : offSh && offSh.id === "shield" ? offSh : null;
    if (shSt) {
      const dis = game.shieldCd > 0, up = game.blocking && !dis, raised = up ? Math.min(1, game.shieldT / 0.25) : 0;
      const sz = Math.round(13 * S), shx = Math.round((up ? 6.8 : 4.2 + (dis ? Math.sin(performance.now() / 40) * 0.5 : 0)) * S), shy = Math.round((up ? 6.4 - raised * 0.4 : 12.5) * S);
      if (dis) g.globalAlpha = 0.55;
      if (up) { g.drawImage(art.base("shield", shSt), 0, 0, T, T, shx, shy, sz, sz); }
      else { g.save(); g.translate(shx, shy); g.rotate(-0.35); g.drawImage(art.base("shield", shSt), 0, 0, T, T, 0, 0, Math.round(sz * 0.8), Math.round(sz * 0.8)); g.restore(); }
      if (dis) { g.globalAlpha = 0.3; R(4, 6, 8, 12, "#c83030"); }
    }
    // Zweite Hand: Fackel, Totem u. a. am hinteren Arm (Schild ist oben gezeichnet)
    if (offSh && offSh.id !== "shield") {
      g.save(); g.translate(Math.round(2.2 * S), Math.round(11 * S)); g.rotate(-0.15);
      R(-1, -0.5, 2.4, 6, "#2f5aa8"); R(-1, 5, 2.4, 1.8, "#d8aa84");
      const sz = Math.round(6 * S); g.drawImage(art.base(offSh.id, offSh), 0, 0, T, T, Math.round(-sz * 0.55), Math.round(3.6 * S) - sz, sz, sz);
      g.restore();
    }
    g.restore();
  }
  function drawVillager(v, scr) {
    const [bx, by0] = scr(v.x, v.y), by = by0 + Math.round((v.visOff || 0) * T * S), flip = v.face < 0;
    const pl = v.prof ? profLook(v.prof) : null;
    const robes = pl ? pl.robe : [["#9b5a36", "#7a4426"], ["#4c8a56", "#376b40"], ["#8a5aa8", "#6a4486"]][v.look % 3];
    const moving = v.dir !== 0, bob = moving ? Math.abs(Math.sin(performance.now() / 120 + v.look)) * 0.7 : 0;
    g.save(); g.translate(bx + (flip ? Math.round(v.w * T * S) : 0), by); g.scale(flip ? -1 : 1, 1);
    const R = (x, y, w, h2, c) => { g.fillStyle = c; g.fillRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h2 * S)); };
    R(2, 9 - bob, 7.5, 15.5, robes[0]); R(2, 22 - bob, 7.5, 2.5, robes[1]); R(1.5, 12.5 - bob, 8.5, 3, robes[1]);
    R(2.5, 25 - bob * 0.5, 3, 2, "#3c2a1c"); R(6, 25 - bob * 0.5, 3, 2, "#3c2a1c");
    R(2.5, 2.5 - bob, 6.5, 7, "#e2b48c"); R(8.4, 5.6 - bob, 2.3, 3, "#d29c78"); R(6.4, 4.6 - bob, 1.4, 1.4, "#1e1e28");
    R(2, 1.5 - bob, 7.5, 2.2, v.look === 1 ? "#d8d8d8" : "#4a3020"); R(1.5, 2 - bob, 1.6, 4, v.look === 1 ? "#d8d8d8" : "#4a3020");
    if (v.prof) drawProfGear(R, v.prof, bob, v.lvl);
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
      audio.destroy(); clearInterval(idleTimer); window.removeEventListener("gamepadconnected", onPadConnect);
    }
  };
}
