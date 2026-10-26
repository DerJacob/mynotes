// =====================================================================
// Blockdorf – Menüs (Etappe 7): Einstellungen, Weltenliste, neue Welt, Chat-Zeilen.
// Die Funktionen bauen nur Knoten mit dem h()-Helfer der App; alle Aktionen laufen über Rückrufe (api).
// =====================================================================
import { MODES } from "./sandbox-polish.js?v=8";
import { listWorlds, canAdd, MAX_WORLDS, NAME_MAX } from "./sandbox-worlds.js?v=8";

/** Seed aus Text: leer = zufällig (undefined), Zahl = die Zahl, sonst ein Hash des Textes */
export function seedFrom(text) {
  const s = String(text == null ? "" : text).trim();
  if (!s) return undefined;
  if (/^-?\d{1,9}$/.test(s)) return Number(s) | 0;
  let hsh = 2166136261;
  for (let i = 0; i < s.length; i++) { hsh ^= s.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
  return hsh | 0;
}

const pct = v => Math.round(v * 100) + " %";
const ago = t => {
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "gerade eben" : m < 60 ? `vor ${m} Min.` : m < 1440 ? `vor ${Math.round(m / 60)} Std.` : `vor ${Math.round(m / 1440)} Tagen`;
};

/** Einstellungen: s = aktuelle Werte, api = { change(key, value), setMode(m), mode, back() } */
export function settingsPanel(h, s, api) {
  const row = (label, ctl, hint) => h("div", { class: "sb-set" }, h("div", { class: "sb-set-l" }, label, hint ? h("small", null, hint) : null), h("div", { class: "sb-set-c" }, ctl));
  const toggle = (key, on = "An", off = "Aus") => h("button", { class: "sb-tog" + (s[key] ? " on" : ""), type: "button", "aria-pressed": s[key] ? "true" : "false", onclick: () => api.change(key, !s[key]) }, s[key] ? on : off);
  const slider = (key, min, max, step, fmt = pct) => h("div", { class: "sb-sl" }, h("input", { type: "range", min, max, step, value: s[key], "aria-label": key, oninput: e => api.change(key, Number(e.target.value), true) }), h("span", null, fmt(s[key])));
  const zoomNames = ["Klein", "Normal", "Groß", "Sehr groß"];
  const stepper = () => h("div", { class: "sb-step" },
    h("button", { type: "button", "aria-label": "Kleiner", onclick: () => api.change("zoom", Math.max(-1, s.zoom - 1)) }, "−"), h("span", null, zoomNames[s.zoom + 1] || "Normal"),
    h("button", { type: "button", "aria-label": "Größer", onclick: () => api.change("zoom", Math.min(2, s.zoom + 1)) }, "+"));
  const seg = (key, opts) => h("div", { class: "sb-seg" }, ...opts.map(([v, label]) => h("button", { type: "button", class: s[key] === v ? "on" : "", onclick: () => api.change(key, v) }, label)));
  return h("div", { class: "sb-panel sb-settings" },
    h("div", { class: "sb-ph" }, "Einstellungen"),
    row("Ton", toggle("sound")),
    row("Effekte", slider("sfx", 0, 1, 0.05)),
    row("Musik", slider("music", 0, 1, 0.05), "0 % = aus"),
    row("Wetter-Effekte", toggle("weatherFx")),
    row("Partikel", toggle("particles")),
    row("Kamerawackeln", toggle("shake")),
    row("Bildgröße", stepper()),
    row("Touch-Tasten", seg("touch", [["auto", "Auto"], ["on", "An"], ["off", "Aus"]])),
    row("Vibration", toggle("vibrate"), "bei Treffern, auf dem Handy"),
    row("Gamepad-Zeiger", slider("padSens", 0.4, 2, 0.1, v => v.toFixed(1) + "×")),
    row("Debug-Anzeige", toggle("debug"), "F3"),
    row("Spielmodus dieser Welt", seg("mode", Object.entries(MODES).map(([k, v]) => [k, v]).map(([k, v]) => [k, v])), "Kreativ: fliegen, alles bauen, kein Schaden"),
    h("button", { class: "btn small", type: "button", onclick: () => api.back() }, "Zurück"));
}

/** Weltenliste: rec = normalisierter Spielstand (loadRecord), api = { play(id), rename(id, name), remove(id), create(), back() } */
export function worldsPanel(h, rec, api, state = {}) {
  const list = h("div", { class: "sb-wlist" });
  for (const w of listWorlds(rec)) {
    const editing = state.editing === w.id, confirm = state.confirm === w.id;
    const info = w.empty ? "noch leer" : `Tag ${w.day} · Stufe ${w.level} · ${MODES[w.mode] || "Überleben"}${w.t ? " · " + ago(w.t) : ""}`;
    let input = null;
    if (editing) input = h("input", { type: "text", class: "sb-wname", value: w.name, maxlength: NAME_MAX, "aria-label": "Name der Welt", onkeydown: e => { if (e.key === "Enter") api.rename(w.id, e.target.value); else if (e.key === "Escape") api.cancel(); } });
    list.appendChild(h("div", { class: "sb-world" + (w.active ? " on" : "") },
      h("div", { class: "sb-winfo" }, editing ? input : h("b", null, w.name, w.active ? h("em", null, " · aktiv") : null), h("small", null, info)),
      h("div", { class: "sb-wact" },
        editing ? h("button", { type: "button", onclick: () => api.rename(w.id, input.value) }, "OK") : h("button", { type: "button", title: "Umbenennen", "aria-label": "Umbenennen", onclick: () => api.edit(w.id) }, "✎"),
        h("button", { type: "button", class: "play", onclick: () => api.play(w.id) }, w.active ? "Weiter" : "Spielen"),
        h("button", { type: "button", class: "del" + (confirm ? " danger" : ""), title: "Löschen", "aria-label": "Löschen", onclick: () => api.remove(w.id) }, confirm ? "Wirklich?" : "🗑"))));
  }
  return h("div", { class: "sb-panel sb-worlds" },
    h("div", { class: "sb-ph" }, "Welten"),
    list,
    h("div", { class: "sb-wfoot" },
      canAdd(rec) ? h("button", { class: "btn small", type: "button", onclick: () => api.create() }, "+ Neue Welt") : h("small", null, `Mehr als ${MAX_WORLDS} Welten gehen nicht – lösche erst eine.`),
      h("button", { class: "btn ghost small", type: "button", onclick: () => api.back() }, "Zurück")));
}

/** Neue Welt: Name, Seed, Modus; api = { submit({ name, seed, mode }), back() } */
export function newWorldPanel(h, defaults, api) {
  let mode = defaults.mode || "survival";
  const name = h("input", { type: "text", class: "sb-wname", value: defaults.name, maxlength: NAME_MAX, "aria-label": "Name" });
  const seed = h("input", { type: "text", class: "sb-wname", value: "", placeholder: "zufällig", maxlength: 24, "aria-label": "Seed" });
  const segs = Object.entries(MODES).map(([k, v]) => h("button", { type: "button", class: mode === k ? "on" : "", "data-mode": k, onclick: () => { mode = k; for (const b of segs) b.className = b.getAttribute("data-mode") === k ? "on" : ""; } }, v));
  return h("div", { class: "sb-panel sb-newworld" },
    h("div", { class: "sb-ph" }, "Neue Welt"),
    h("div", { class: "sb-set" }, h("div", { class: "sb-set-l" }, "Name"), h("div", { class: "sb-set-c" }, name)),
    h("div", { class: "sb-set" }, h("div", { class: "sb-set-l" }, "Seed", h("small", null, "gleicher Seed = gleiche Welt")), h("div", { class: "sb-set-c" }, seed)),
    h("div", { class: "sb-set" }, h("div", { class: "sb-set-l" }, "Spielmodus"), h("div", { class: "sb-set-c" }, h("div", { class: "sb-seg" }, ...segs))),
    h("div", { class: "sb-wfoot" },
      h("button", { class: "btn small", type: "button", onclick: () => api.submit({ name: name.value, seed: seedFrom(seed.value), mode }) }, "Erstellen"),
      h("button", { class: "btn ghost small", type: "button", onclick: () => api.back() }, "Zurück")));
}
