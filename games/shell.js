// =====================================================================
// Spiele-Rahmen: Katalog, Spiel-Seite, verschlüsselter Spielstand.
// Wird von app.js erst beim ersten Öffnen von „Spiele“ geladen.
//
// Die Spiele selbst bekommen nur `ctx` (siehe renderGame) – nie den Schlüssel, nie die Notizen.
// Spielstände liegen verschlüsselt im Drive (Datei „mynotes-games.enc“, nur die Web-App schreibt sie),
// nicht im Browser. Im Demo-Modus bleiben sie nur im Arbeitsspeicher.
// =====================================================================
import { GAMES } from "./registry.js?v=7";

const FORMAT = "mynotes-games";
let api = null;      // Schnittstelle zur App (kommt bei jedem render() neu)
let cur = null;      // laufendes Spiel { id, main, root, handle }
let cssDone = false;

// ---------------------------------------------------------------------
// Spielstand
// ---------------------------------------------------------------------
const sv = { data: null, loading: null, dirty: false, timer: null, retry: null, writing: null, again: false, warned: false };
const emptyData = () => ({ format: FORMAT, v: 1, games: {} });

/** Zwei Stände zusammenführen: pro Spiel gewinnt der neuere – oder die merge()-Regel des Spiels */
function mergeData(remote, local) {
  const games = { ...((remote && remote.games) || {}) };
  for (const [id, rec] of Object.entries((local && local.games) || {})) {
    const r = games[id];
    const g = GAMES.find(x => x.id === id);
    if (!r) games[id] = rec;
    else if (g && g.merge) games[id] = { ...g.merge(r, rec), t: Math.max(r.t || 0, rec.t || 0) };
    else games[id] = (rec.t || 0) >= (r.t || 0) ? rec : r;
  }
  return { format: FORMAT, v: 1, games };
}

function ensureLoaded() {
  if (sv.data) return Promise.resolve(sv.data);
  if (!sv.loading) {
    sv.loading = (async () => {
      let remote = null;
      try { remote = await api.store.read(); }
      catch (e) { api.toast("Spielstände konnten nicht geladen werden: " + e.message, { bad: true }); }
      // Beim Speichern wird ohnehin mit dem Drive-Stand zusammengeführt – ein Rekord geht so nicht verloren.
      if (!sv.data) sv.data = remote && remote.games ? { format: FORMAT, v: 1, games: remote.games } : emptyData();
      return sv.data;
    })().finally(() => { sv.loading = null; });
  }
  return sv.loading;
}

function save(id, rec) {
  const d = sv.data || (sv.data = emptyData());
  d.games[id] = { ...rec, t: Date.now() };
  sv.dirty = true;
  clearTimeout(sv.timer);
  sv.timer = setTimeout(() => { flush().catch(() => {}); }, 1500);
}

function retryLater() {
  if (sv.retry) return;
  sv.retry = setInterval(() => {
    if (!sv.dirty) { clearInterval(sv.retry); sv.retry = null; return; }
    flush().catch(() => {});
  }, 30_000);
}

/** Ungespeicherten Spielstand jetzt ins Drive schreiben (app.js ruft das vor dem Sperren auf) */
export function flush() {
  clearTimeout(sv.timer); sv.timer = null;
  if (!sv.dirty || !sv.data || !api) return Promise.resolve();
  if (api.demo) { sv.dirty = false; return Promise.resolve(); }
  if (sv.writing) { sv.again = true; return sv.writing; }
  if (!api.store.canWrite()) {
    if (!sv.warned) { sv.warned = true; api.toast("Spielstand ist noch nicht gespeichert – er wird nach dem Neu-Verbinden nachgeholt"); }
    retryLater();
    return Promise.resolve();
  }
  sv.dirty = false;
  sv.writing = api.store.write(sv.data, mergeData)
    .then(merged => { sv.data = mergeData(merged, sv.data); sv.warned = false; })
    .catch(e => { sv.dirty = true; retryLater(); throw e; })
    .finally(() => {
      sv.writing = null;
      if (sv.again) { sv.again = false; flush().catch(() => {}); }
    });
  return sv.writing;
}

// ---------------------------------------------------------------------
// Laufendes Spiel
// ---------------------------------------------------------------------
export function isOpen() { return !!cur; }

/** Spiel beenden (Timer, Tastatur-Hörer …) und Stand sichern */
export function stop() {
  if (!cur) return;
  const c = cur;
  cur = null;
  try { c.handle && c.handle.destroy(); } catch (_) {}
  flush().catch(() => {});
}

/** Beim Sperren/Abmelden: alles verwerfen, was im Speicher liegt (vorher flush() aufrufen) */
export function reset() {
  stop();
  clearTimeout(sv.timer); sv.timer = null;
  clearInterval(sv.retry); sv.retry = null;
  sv.data = null; sv.loading = null; sv.dirty = false; sv.writing = null; sv.again = false; sv.warned = false;
  api = null;
}

function ensureCss() {
  if (cssDone) return;
  cssDone = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./games.css?v=8", import.meta.url).href;
  document.head.appendChild(link);
}

/** Wird von app.js bei jedem renderMain() für die Ansicht „Spiele“ aufgerufen. */
export function render(main, apiIn) {
  api = apiIn;
  ensureCss();
  const id = api.route().id;
  const game = id ? GAMES.find(g => g.id === id && !g.soon) : null;
  if (game) return renderGame(main, game);
  stop();
  renderCatalog(main);
}

// ---------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------
function renderCatalog(main) {
  const { h, icon, mainBar, openNav, replace } = api;
  const grid = h("div", { class: "game-grid" });
  const sums = new Map();
  for (const g of GAMES) {
    const sum = h("div", { class: "game-sum" }, g.soon ? "Kommt bald" : "");
    sums.set(g.id, sum);
    grid.appendChild(h("button", {
      class: "game-card", type: "button", disabled: !!g.soon, title: g.soon ? "Noch nicht spielbar" : g.title + " spielen",
      onclick: () => api.open(g.id)
    }, h("div", { class: "game-emoji", "aria-hidden": "true" }, g.emoji),
    h("div", { class: "game-info" }, h("div", { class: "game-name" }, g.title), h("div", { class: "game-desc" }, g.desc), sum)));
  }
  const bar = mainBar(
    h("button", { class: "icon-btn only-narrow", onclick: openNav, title: "Menü", "aria-label": "Menü" }, icon("menu")),
    h("div", { class: "crumbs" }, h("b", { style: { color: "var(--text)", fontSize: "1.05rem", padding: "0 6px" } }, "Spiele")));
  const scroller = h("div", { class: "main-scroll" }, h("div", { class: "game-wrap" },
    h("h1", { class: "game-h1" }, "Spiele"),
    h("p", { class: "game-lead" }, "Kleine Spiele für zwischendurch. Sie laufen komplett hier im Browser. " +
      (api.demo ? "Im Demo-Modus bleiben Rekorde nur bis zum Schließen des Tabs." : "Rekorde liegen verschlüsselt in deinem Drive – nicht im Browser.")),
    grid));
  replace(main, bar, scroller);
  ensureLoaded().then(data => {
    if (!main.contains(grid)) return;
    for (const g of GAMES) if (!g.soon && g.summary) sums.get(g.id).textContent = g.summary(data.games[g.id]);
  });
}

// ---------------------------------------------------------------------
// Spiel-Seite
// ---------------------------------------------------------------------
function renderGame(main, game) {
  // Läuft dieses Spiel schon (z. B. weil in den Einstellungen das Design gewechselt wurde)? Dann nicht neu starten.
  if (cur && cur.id === game.id && cur.main === main && main.contains(cur.root)) return;
  stop();
  const { h, icon, iconBtn, mainBar, replace, openNav } = api;
  const root = h("div", { class: "game-stage" }, h("div", { class: "game-loading" }, h("span", { class: "spinner" }), "Lade " + game.title + " …"));
  const bar = mainBar(
    h("button", { class: "icon-btn only-narrow", onclick: openNav, title: "Menü", "aria-label": "Menü" }, icon("menu")),
    iconBtn("back", "Zurück zu den Spielen", () => api.open(null)),
    h("div", { class: "crumbs" },
      h("button", { onclick: () => api.open(null), title: "Alle Spiele" }, "Spiele"),
      icon("chevron", "sm"),
      h("span", { style: { padding: "2px 6px", color: "var(--text)" } }, game.title)));
  replace(main, bar, h("div", { class: "main-scroll" }, h("div", { class: "game-wrap" }, root)));
  const me = { id: game.id, main, root, handle: null };
  cur = me;
  Promise.all([game.load(), ensureLoaded()]).then(([mod, data]) => {
    if (cur !== me) return;   // inzwischen woanders
    root.textContent = "";
    me.handle = mod.mount(root, {
      h, icon, toast: api.toast, demo: api.demo, title: game.title,
      blocked: api.blocked || (() => false),   // true, solange ein Dialog/Menü der App offen ist
      record: data.games[game.id] || null,
      save: rec => save(game.id, rec),
      exit: () => api.open(null)
    });
  }).catch(e => {
    if (cur !== me) return;
    root.textContent = "";
    root.appendChild(h("div", { class: "main-empty" }, icon("warn"), h("h3", null, game.title + " konnte nicht geladen werden"), h("div", null, e.message || String(e))));
  });
}
