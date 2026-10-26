// =====================================================================
// Blockdorf – mehrere Welten und Einstellungen im Spielstand (Etappe 7)
//   Ein Spielstand-Datensatz („Rekord“) bleibt rückwärtskompatibel:
//     { w, day, mined, built, kills, level }   = die gerade aktive Welt (wie bisher)
//     wid, wname, wmode                        = Kennung, Name und Modus der aktiven Welt
//     others: [{ id, name, w, day, mined, built, kills, level, mode, t }]   = die übrigen Welten
//     settings                                 = Einstellungen (gelten für alle Welten)
//   Alte Spielstände ohne wid/others laden als „Welt 1“.
// Reine Funktionen ohne Oberfläche (Node-testbar).
// =====================================================================

export const MAX_WORLDS = 8;
export const NAME_MAX = 24;

export const DEFAULT_SETTINGS = Object.freeze({
  sound: false, sfx: 0.7, music: 0.35, weatherFx: true, particles: true, shake: true, zoom: 0, touch: "auto", vibrate: true, debug: false, padSens: 1
});
const TOUCH = new Set(["auto", "on", "off"]);

const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const bool = (v, d) => (typeof v === "boolean" ? v : d);

/** Einstellungen prüfen und fehlende Werte auffüllen (auch aus beschädigten Spielständen) */
export function cleanSettings(s) {
  const o = s && typeof s === "object" ? s : {}, d = DEFAULT_SETTINGS;
  return {
    sound: bool(o.sound, d.sound), sfx: num(o.sfx, 0, 1, d.sfx), music: num(o.music, 0, 1, d.music),
    weatherFx: bool(o.weatherFx, d.weatherFx), particles: bool(o.particles, d.particles), shake: bool(o.shake, d.shake),
    zoom: Math.round(num(o.zoom, -1, 2, d.zoom)), touch: TOUCH.has(o.touch) ? o.touch : d.touch, vibrate: bool(o.vibrate, d.vibrate),
    debug: bool(o.debug, d.debug), padSens: num(o.padSens, 0.4, 2, d.padSens)
  };
}

export function cleanName(name, fallback = "Welt") {
  const s = String(name == null ? "" : name).replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return s || fallback;
}

const idNum = id => { const m = /^w(\d+)$/.exec(String(id)); return m ? Number(m[1]) : 0; };

/** Spielstand-Datensatz einlesen: alte Formate, fehlende Felder, kaputte Nebenwelten */
export function loadRecord(rec) {
  const r = rec && typeof rec === "object" ? rec : {};
  const others = [];
  const seen = new Set();
  const wid = typeof r.wid === "string" && /^w\d+$/.test(r.wid) ? r.wid : "w1";
  seen.add(wid);
  if (Array.isArray(r.others)) {
    for (const o of r.others) {
      if (!o || typeof o !== "object" || !o.w || typeof o.id !== "string" || !/^w\d+$/.test(o.id) || seen.has(o.id)) continue;
      seen.add(o.id);
      others.push({ id: o.id, name: cleanName(o.name, "Welt " + idNum(o.id)), w: o.w, day: o.day | 0, mined: o.mined | 0, built: o.built | 0, kills: o.kills | 0, level: o.level | 0, mode: o.mode === "creative" ? "creative" : "survival", t: Number(o.t) || 0 });
    }
  }
  return {
    w: r.w || null, wid, wname: cleanName(r.wname, "Welt " + idNum(wid)), wmode: r.wmode === "creative" ? "creative" : "survival",
    day: r.day | 0, mined: r.mined | 0, built: r.built | 0, kills: r.kills | 0, level: r.level | 0, t: Number(r.t) || 0,
    others, settings: cleanSettings(r.settings)
  };
}

/** Die aktive Welt als Eintrag der Nebenwelten-Liste */
const packActive = (r, now) => ({ id: r.wid, name: r.wname, w: r.w, day: r.day | 0, mined: r.mined | 0, built: r.built | 0, kills: r.kills | 0, level: r.level | 0, mode: r.wmode || "survival", t: r.t || now });
const activate = (r, o, others) => ({
  ...r, w: o.w, wid: o.id, wname: o.name, wmode: o.mode, day: o.day, mined: o.mined, built: o.built, kills: o.kills, level: o.level, t: o.t, others
});

/** Kurzliste für das Welten-Menü; die aktive Welt steht vorn */
export function listWorlds(r) {
  const list = [{ id: r.wid, name: r.wname, day: r.day | 0, level: r.level | 0, mined: r.mined | 0, mode: r.wmode || "survival", t: r.t || 0, active: true, empty: !r.w }];
  for (const o of r.others) list.push({ id: o.id, name: o.name, day: o.day, level: o.level, mined: o.mined, mode: o.mode, t: o.t, active: false, empty: false });
  return list;
}

export const canAdd = r => 1 + r.others.length < MAX_WORLDS;

export function nextId(r) {
  let m = idNum(r.wid);
  for (const o of r.others) m = Math.max(m, idNum(o.id));
  return "w" + (m + 1);
}

/** Neue Welt anlegen: die bisherige wandert in die Liste, die neue wird aktiv (w = null, die Oberfläche erzeugt sie). */
export function addWorld(r, { name, mode } = {}, now = Date.now()) {
  if (!canAdd(r)) return null;
  const id = nextId(r);
  const others = r.w ? [...r.others, packActive(r, now)] : [...r.others];
  return { ...r, w: null, wid: id, wname: cleanName(name, "Welt " + idNum(id)), wmode: mode === "creative" ? "creative" : "survival", day: 0, mined: 0, built: 0, kills: 0, level: 0, t: now, others };
}

/** Zu einer anderen Welt wechseln */
export function switchWorld(r, id, now = Date.now()) {
  if (id === r.wid) return r;
  const o = r.others.find(x => x.id === id);
  if (!o) return r;
  const others = r.others.filter(x => x !== o);
  if (r.w) others.push(packActive(r, now));
  return activate(r, o, others);
}

export function renameWorld(r, id, name) {
  if (id === r.wid) return { ...r, wname: cleanName(name, r.wname) };
  return { ...r, others: r.others.map(o => (o.id === id ? { ...o, name: cleanName(name, o.name) } : o)) };
}

/** Welt löschen. Die aktive Welt zu löschen holt die zuletzt gespielte andere nach vorn; gibt es keine, bleibt w = null. */
export function deleteWorld(r, id) {
  if (id !== r.wid) return { ...r, others: r.others.filter(o => o.id !== id) };
  if (!r.others.length) return { ...r, w: null, day: 0, mined: 0, built: 0, kills: 0, level: 0, wname: "Welt " + idNum(r.wid), wmode: "survival" };
  const best = r.others.reduce((a, b) => (b.t > a.t ? b : a));
  return activate(r, best, r.others.filter(o => o !== best));
}

/** Zwei Stände desselben Spiels zusammenführen (z. B. von zwei Geräten): pro Welt gewinnt der neuere, nichts geht verloren. */
export function mergeRecords(a, b) {
  const ra = loadRecord(a), rb = loadRecord(b);
  const win = (ra.t || 0) >= (rb.t || 0) ? ra : rb, lose = win === ra ? rb : ra;
  const all = new Map();
  const put = o => { const k = all.get(o.id); if (!k || (o.t || 0) > (k.t || 0)) all.set(o.id, o); };
  for (const r of [lose, win]) { if (r.w) put(packActive(r, r.t)); for (const o of r.others) put(o); }
  const act = win.w ? all.get(win.wid) : null;
  const others = [...all.values()].filter(o => o.id !== win.wid);
  const base = act ? activate(win, act, others) : { ...win, others };
  return { ...base, settings: win.settings };
}

/** Fürs Katalog-Kärtchen */
export function summary(rec) {
  if (!rec || (!rec.w && !(rec.day | 0) && !(rec.others && rec.others.length))) return "Neue Welt";
  const n = 1 + (Array.isArray(rec.others) ? rec.others.length : 0);
  const base = `Tag ${rec.day | 0} · ${(rec.mined | 0).toLocaleString("de-DE")} abgebaut`;
  return n > 1 ? `${base} · ${n} Welten` : base;
}
