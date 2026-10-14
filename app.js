/* =====================================================================
 * MyNotes Web-App  (AH-1 Lesen + AH-2 „Vom PC“)
 *
 * So funktioniert's:
 *  - Anmelden mit Google (nur Zugriff auf Dateien, die MyNotes selbst angelegt hat: drive.file)
 *  - Ordner „MyNotes PC“ im Drive:
 *      mynotes-pc.zip          ← schreibt NUR das Handy (alle Notizen, verschlüsselt)
 *      img_….webp.enc          ← schreibt NUR das Handy (Bilder, einzeln verschlüsselt)
 *      mynotes-inbox.enc       ← schreibt NUR diese Web-App („Vom PC“)
 *      mynotes-inbox-done.enc  ← schreibt NUR das Handy (welche PC-Notizen übernommen wurden)
 *  - Entschlüsselt wird mit dem Passwort/Code der Drive-Sicherung – direkt hier im Browser.
 *
 * Datenschutz: Es wird NICHTS im Browser gespeichert – kein localStorage, keine Cookies,
 * kein IndexedDB, kein Offline-Cache. Alles liegt nur im Arbeitsspeicher: Tab zu = weg.
 * Einstellungen der Web-App liegen verschlüsselt mit in „mynotes-inbox.enc“ (in deinem Drive).
 * ===================================================================== */
"use strict";

const APP_VERSION = "1.0";
const CLIENT_ID = "723061989132-tu2nrvj1vvsbgmk6e03vf1g6gf6tsdmi.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_NAME = "MyNotes PC";
const F_MIRROR = "mynotes-pc.zip";
const F_INBOX = "mynotes-inbox.enc";
const F_DONE = "mynotes-inbox-done.enc";
const MAGIC = "MNE1";
const TE = new TextEncoder();
const TD = new TextDecoder();
const AAD = TE.encode("mynotes-backup|v1");
const POLL_VISIBLE_MS = 60_000;
const POLL_HIDDEN_MS = 5 * 60_000;
const DEMO = new URLSearchParams(location.search).has("demo");

/** Standard-Einstellungen (werden – falls möglich – verschlüsselt im Drive gespeichert) */
const DEFAULT_SETTINGS = {
  theme: "system",      // system | dark | light
  lockMinutes: 30,      // 0 = nie
  fontSize: 15,         // px
  hideDone: false,      // erledigte Checklisten-Punkte ausblenden
  view: "list",         // list | tiles
  sort: "custom",       // custom | modified | created | title
  previewPane: true     // Vorschau im PC-Editor
};

/** Alles, was die App weiß – nur im Arbeitsspeicher */
const S = {
  token: null, tokenExp: 0, tokenClient: null, user: null,
  folderId: null, files: new Map(),
  mirror: null,            // { id, modifiedTime }
  meta: null, zip: null,   // meta.json + ZIP-Inhalt (noch verschlüsselt)
  key: null,               // CryptoKey (nicht auslesbar)
  db: null,                // aufbereitete Daten (siehe buildDb)
  extras: { calc: {}, work: {} },
  inbox: { notes: [], checks: [], edits: [], fileId: null, modifiedTime: null, base: new Map(), readable: true, settings: null },
  done: new Set(), rejected: new Set(), doneModified: null,
  settings: { ...DEFAULT_SETTINGS },
  images: new Map(),       // Bildname → Promise<objectURL>
  fresh: new Set(),        // Notiz-IDs, die sich seit dem Öffnen geändert haben
  route: { view: "home" },
  noteId: null, pcId: null,
  page: new Map(),         // Notiz-ID → gewählte Seite
  collapsed: new Map(),    // Block-ID → eingeklappt (nur in dieser Sitzung)
  treeOpen: new Set(),     // aufgeklappte Ordner in der Seitenleiste
  dividerOpen: new Map(),  // Überschriften in Listen
  query: "",
  findTerms: null,         // Suchbegriffe zum Markieren in der geöffneten Notiz
  lastActivity: Date.now(),
  lastCheck: 0, checking: false, online: true, pollTimer: null, lockTimer: null,
  syncError: null,
  scroll: new Map(),
  listLimit: 80,
  unlocked: false
};

// ---------------------------------------------------------------------
// DOM-Helfer
// ---------------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg";
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Element bauen: h("div", {class:"x", onclick:fn}, "Text", kind, [kinder]) */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) setProps(el, props);
  append(el, kids);
  return el;
}
/** SVG-Element bauen */
function sv(tag, props, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.setAttribute("class", v);
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, kids);
  return el;
}
function setProps(el, props) {
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "vars") for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else if (k === "value" || k === "checked" || k === "disabled" || k === "selected") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
}
function append(el, kids) {
  for (const kid of kids) {
    if (kid == null || kid === false || kid === true) continue;
    if (Array.isArray(kid)) append(el, kid);
    else if (kid instanceof Node) el.appendChild(kid);
    else el.appendChild(document.createTextNode(String(kid)));
  }
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function replace(el, ...kids) { clear(el); append(el, kids); return el; }

// ---------------------------------------------------------------------
// Icons (Material Icons, Apache 2.0)
// ---------------------------------------------------------------------
const ICONS = {
  swap: "M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
  split: "M3 15h8v-2H3v2zm0 4h8v-2H3v2zm0-8h8V9H3v2zm0-6v2h8V5H3zm10 0h8v14h-8V5z",
  search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  folder: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  star: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  note: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  bell: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  task: "M22 5.18 10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44A9.9 9.9 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z",
  computer: "M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z",
  label: "M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z",
  archive: "M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z",
  trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  refresh: "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  settings: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  copy: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  print: "M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  menu: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z",
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  chevron: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
  expand: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  send: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  tiles: "M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z",
  list: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z",
  sort: "M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  inbox: "M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z",
  moon: "M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z",
  template: "M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z",
  help: "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
  open: "M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
  project: "M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  more: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  zoomIn: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2z",
  zoomOut: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z",
  fit: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z",
  keyboard: "M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z",
  cloud: "M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z",
  phone: "M17 1.01 7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z",
  checkbox: "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
  heading: "M5 4v3h5.5v12h3V7H19V4z",
  code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  hr: "M4 11h16v2H4z",
  eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  eyeOff: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
  table: "M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  warn: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  google: "M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z",
  shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z",
  pin: "M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z",
  calc: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5.97 4.06L14.09 6l1.41 1.41L16.91 6l1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.4-1.41 1.41-1.06-1.06 1.41-1.41-1.41-1.42zm-6.78.66h5v1.5h-5v-1.5zM11.5 16h-2v2H8v-2H6v-1.5h2v-2h1.5v2h2V16zm6.5 1.25h-5v-1.5h5v1.5zm0-2.5h-5v-1.5h5v1.5z",
  clock: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
  person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  draw: "M18.85 10.39l1.06-1.06c.78-.78.78-2.05 0-2.83L18.5 5.09c-.78-.78-2.05-.78-2.83 0l-1.06 1.06 4.24 4.24zm-5.66-2.83L4 16.76V21h4.24l9.19-9.19-4.24-4.25zM19 17.5c0 2.19-2.54 3.5-5 3.5-.55 0-1-.45-1-1s.45-1 1-1c1.54 0 3-.73 3-1.5 0-.47-.48-.87-1.23-1.2l1.48-1.48c1.07.63 1.75 1.47 1.75 2.68zM4.58 13.35C3.61 12.79 3 12.06 3 11c0-1.8 1.89-2.63 3.56-3.36C7.59 7.18 9 6.56 9 6c0-.41-.78-1-2-1-1.26 0-1.8.61-1.83.64-.35.41-.98.46-1.4.12a.997.997 0 0 1-.15-1.38C3.73 4.24 4.76 3 7 3s4 1.32 4 3c0 1.87-1.93 2.72-3.64 3.47C6.42 9.88 5 10.5 5 11c0 .31.43.6 1.07.86l-1.49 1.49z"
};
function icon(name, cls = "") {
  return sv("svg", { class: "ic " + cls, viewBox: "0 0 24 24", "aria-hidden": "true" }, sv("path", { d: ICONS[name] || ICONS.note }));
}
function iconBtn(name, title, onclick, cls = "") {
  return h("button", { class: "icon-btn " + cls, title, "aria-label": title, onclick }, icon(name));
}

// ---------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------
const fmtDate = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDateShort = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const fmtDateLong = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const fmtWeekday = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const fmtNum = new Intl.NumberFormat("de-DE");

function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
function dayDiff(t, now = Date.now()) { return Math.round((startOfDay(t) - startOfDay(now)) / 86_400_000); }

/** „vor 3 Min.“, „gestern 14:03“, „12. Okt.“ */
function relTime(t, now = Date.now()) {
  if (!t) return "–";
  const diff = now - t;
  if (diff < 45_000 && diff > -45_000) return "gerade eben";
  if (diff > 0 && diff < 3_600_000) return "vor " + Math.round(diff / 60_000) + " Min.";
  const dd = dayDiff(t, now);
  if (dd === 0) return "heute " + fmtTime.format(t);
  if (dd === -1) return "gestern " + fmtTime.format(t);
  if (dd === 1) return "morgen " + fmtTime.format(t);
  if (Math.abs(dd) < 7) return fmtWeekday.format(t) + " " + fmtTime.format(t);
  const sameYear = new Date(t).getFullYear() === new Date(now).getFullYear();
  return sameYear ? fmtDateShort.format(t) : fmtDate.format(t);
}
function fullTime(t) { return t ? fmtDate.format(t) + ", " + fmtTime.format(t) + " Uhr" : "–"; }

const REPEAT_LABEL = { 1: "täglich", 2: "wöchentlich", 3: "monatlich", 4: "jährlich" };
function reminderText(note) {
  if (!note.reminder) return null;
  const t = note.reminder;
  const dd = dayDiff(t);
  let day;
  if (dd === 0) day = "Heute";
  else if (dd === 1) day = "Morgen";
  else if (dd === -1) day = "Gestern";
  else if (dd > 1 && dd < 7) day = new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(t);
  else day = fmtDate.format(t);
  let s = day + (note.reminderHasTime ? ", " + fmtTime.format(t) : "");
  if (note.reminderRepeat && REPEAT_LABEL[note.reminderRepeat]) s += " · " + REPEAT_LABEL[note.reminderRepeat];
  return s;
}

function plural(n, one, many) { return fmtNum.format(n) + " " + (n === 1 ? one : many); }

// ---------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------
/** "#RRGGBB" / "#AARRGGBB" / "RRGGBB" → CSS-Farbe (oder null) */
function cssColor(hex) {
  if (!hex || typeof hex !== "string") return null;
  let s = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(s)) return "#" + s.toLowerCase();
  if (/^[0-9a-f]{8}$/i.test(s)) {
    const a = parseInt(s.slice(0, 2), 16) / 255;
    const r = parseInt(s.slice(2, 4), 16), g = parseInt(s.slice(4, 6), 16), b = parseInt(s.slice(6, 8), 16);
    return a >= 0.999 ? "#" + s.slice(2).toLowerCase() : `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }
  return null;
}
function rgbOf(css) {
  if (!css) return null;
  const m = /^#([0-9a-f]{6})$/i.exec(css);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const r = /^rgba?\((\d+),(\d+),(\d+)/.exec(css.replace(/\s/g, ""));
  return r ? [+r[1], +r[2], +r[3]] : null;
}
function isLight(css) {
  const rgb = rgbOf(css);
  if (!rgb) return false;
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}
const HIGHLIGHT = { yellow: "#FDD663", green: "#81C995", blue: "#8AB4F8", pink: "#FF8BCB", orange: "#FCAD70", purple: "#C58AF9" };
function highlightColor(key) {
  const c = HIGHLIGHT[key];
  if (!c) return null;
  const [r, g, b] = rgbOf(c.toLowerCase());
  return `rgba(${r},${g},${b},0.28)`;
}

// ---------------------------------------------------------------------
// Text-Normalisierung (Suche ohne Groß/klein und Akzente: „Übung“ = „ubung“ = „uebung“ nicht)
// ---------------------------------------------------------------------
function normChar(c) {
  const l = c.toLowerCase();
  if (l === "ß") return "ss";
  return l.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function norm(s) { return normChar(s || ""); }
/** Normalisiert und merkt sich, welche Stelle im Original zu welcher Stelle gehört */
function normMap(s) {
  let out = "";
  const map = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    // Ersatzpaare (Emoji) zusammenhalten
    if (c >= "\ud800" && c <= "\udbff" && i + 1 < s.length) { c = s.slice(i, i + 2); }
    const n = normChar(c);
    for (let k = 0; k < n.length; k++) map.push(i);
    out += n;
    if (c.length === 2) i++;
  }
  map.push(s.length);
  return { n: out, map };
}
function terms(q) {
  return norm(q).split(/\s+/).map(t => t.replace(/^["']|["']$/g, "")).filter(t => t.length > 0);
}
/** Bereiche [start, end) im Original, an denen einer der Begriffe vorkommt */
function findRanges(text, ts) {
  if (!ts || !ts.length || !text) return [];
  const { n, map } = normMap(text);
  const ranges = [];
  for (const t of ts) {
    let i = n.indexOf(t);
    while (i >= 0) {
      ranges.push([map[i], map[i + t.length - 1] + 1 + (text[map[i + t.length - 1]] >= "\ud800" && text[map[i + t.length - 1]] <= "\udbff" ? 1 : 0)]);
      i = n.indexOf(t, i + t.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r.slice());
  }
  return merged;
}

// ---------------------------------------------------------------------
// Kleinkram
// ---------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));
function debounce(fn, ms) {
  let t = null;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.flush = (...args) => { if (t) { clearTimeout(t); t = null; fn(...args); } };
  d.cancel = () => { clearTimeout(t); t = null; };
  d.pending = () => t !== null;
  return d;
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const x = Array.from(b, v => v.toString(16).padStart(2, "0")).join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
function safeFileName(s) {
  return (s || "Notiz").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Notiz";
}
function initials(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
}

// ---------------------------------------------------------------------
// Hinweise unten (Toasts)
// ---------------------------------------------------------------------
function toast(text, opts = {}) {
  let box = $(".toasts");
  if (!box) { box = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.appendChild(box); }
  const el = h("div", { class: "toast" + (opts.bad ? " bad" : "") }, h("span", { class: "grow" }, text));
  if (opts.action) {
    el.appendChild(h("button", { onclick: () => { el.remove(); opts.action.run(); } }, opts.action.label));
  }
  box.appendChild(el);
  setTimeout(() => el.remove(), opts.ms || (opts.action ? 6000 : 3200));
}

async function copyText(text, what = "Kopiert") {
  try {
    await navigator.clipboard.writeText(text);
    toast(what + " ✓");
  } catch (e) {
    // Notlösung für ältere Browser
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast(what + " ✓"); } catch (_) { toast("Kopieren nicht möglich", { bad: true }); }
    ta.remove();
  }
}
/** Datei zum Herunterladen anbieten (entsteht nur im Speicher, wird nicht im Browser abgelegt) */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// =====================================================================
// Verschlüsselung (genau wie auf dem Handy: BackupCrypto)
//   Datei = "MNE1" + IV (12 Byte) + AES-256-GCM( gzip(Klartext) ), AAD = "mynotes-backup|v1"
//   Schlüssel = PBKDF2-SHA256(Passwort, Salz aus meta.json, Runden aus meta.json)
// =====================================================================
function b64url(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const inflateRaw = b => streamBytes(b, new DecompressionStream("deflate-raw"));
const gunzip = b => streamBytes(b, new DecompressionStream("gzip"));
const gzip = b => streamBytes(b, new CompressionStream("gzip"));

async function deriveKey(secret, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", TE.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
class WrongKeyError extends Error {}
async function decryptBytes(data, key) {
  if (!data || data.length < 17 || TD.decode(data.subarray(0, 4)) !== MAGIC) throw new Error("Unbekanntes Dateiformat");
  let packed;
  try {
    packed = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: data.subarray(4, 16), additionalData: AAD, tagLength: 128 }, key, data.subarray(16)));
  } catch (e) {
    throw new WrongKeyError("Falsches Passwort (oder Datei beschädigt)");
  }
  return gunzip(packed);
}
async function decryptJson(data, key) { return JSON.parse(TD.decode(await decryptBytes(data, key))); }
async function encryptBytes(plain, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 }, key, await gzip(plain)));
  const out = new Uint8Array(16 + sealed.length);
  out.set(TE.encode(MAGIC), 0);
  out.set(iv, 4);
  out.set(sealed, 16);
  return out;
}

/** Kleiner ZIP-Leser (zentrales Verzeichnis; Deflate über DecompressionStream) */
async function readZip(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Keine gültige ZIP-Datei");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("ZIP-Verzeichnis beschädigt");
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = TD.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = buf.subarray(start, start + csize);
    out[name] = method === 0 ? data : await inflateRaw(data);
  }
  return out;
}

// =====================================================================
// Google-Anmeldung (Token nur im Speicher)
// =====================================================================
function gisReady() { return !!(window.google && google.accounts && google.accounts.oauth2); }
async function waitForGis(ms = 8000) {
  const end = Date.now() + ms;
  while (!gisReady() && Date.now() < end) await sleep(100);
  return gisReady();
}
/** Öffnet das Google-Fenster. Muss aus einem Klick heraus aufgerufen werden (sonst blockt der Browser das Fenster). */
function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    if (!gisReady()) { reject(new Error("Google-Anmeldung ist noch nicht geladen – bitte Seite neu laden.")); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: resp => {
        if (resp.error) { reject(new Error("Anmeldung fehlgeschlagen: " + (resp.error_description || resp.error))); return; }
        S.token = resp.access_token;
        S.tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(resp.access_token);
      },
      error_callback: err => {
        const t = err && err.type;
        reject(new Error(t === "popup_closed" ? "Anmeldefenster wurde geschlossen."
          : t === "popup_failed_to_open" ? "Anmeldefenster wurde blockiert – bitte Pop-ups für diese Seite erlauben."
            : "Anmeldung abgebrochen (" + (t || "unbekannt") + ")."));
      }
    });
    const opts = {};
    if (prompt != null) opts.prompt = prompt;
    if (S.user && S.user.email) opts.login_hint = S.user.email;
    client.requestAccessToken(opts);
  });
}
function tokenValid() { return DEMO || (S.token && Date.now() < S.tokenExp - 60_000); }
function revokeToken() {
  try { if (S.token && gisReady()) google.accounts.oauth2.revoke(S.token, () => {}); } catch (_) {}
  S.token = null; S.tokenExp = 0;
}

class AuthError extends Error {}
class NetError extends Error {}

/** Drive-Aufruf. Nichts landet im Browser-Cache (cache: no-store). */
async function drive(url, opts = {}) {
  if (!S.token || Date.now() > S.tokenExp) throw new AuthError("Google-Verbindung abgelaufen");
  let res;
  try {
    res = await fetch(url, { cache: "no-store", ...opts, headers: { Authorization: "Bearer " + S.token, ...(opts.headers || {}) } });
  } catch (e) {
    throw new NetError("Keine Verbindung zum Internet");
  }
  if (res.status === 401) { S.tokenExp = 0; throw new AuthError("Google-Verbindung abgelaufen"); }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error?.message || ""; } catch (_) {}
    const e = new Error("Google Drive meldet Fehler " + res.status + (detail ? ": " + detail : ""));
    e.status = res.status;
    throw e;
  }
  return res;
}
const q = s => encodeURIComponent(s);

async function driveAbout() {
  const r = await (await drive(API + "/about?fields=user(displayName,emailAddress,photoLink)")).json();
  return { name: r.user.displayName, email: r.user.emailAddress, photo: r.user.photoLink || null };
}
/** Ordner „MyNotes PC“ suchen (falls es mehrere gibt: den mit der PC-Kopie) */
async function findFolder() {
  const query = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const f = await (await drive(API + "/files?spaces=drive&fields=files(id,name,modifiedTime)&q=" + q(query))).json();
  if (!f.files.length) return null;
  if (f.files.length === 1) return f.files[0].id;
  for (const folder of f.files) {
    const files = await listFolder(folder.id);
    if (files.has(F_MIRROR)) return folder.id;
  }
  return f.files[0].id;
}
async function listFolder(folderId = S.folderId) {
  const map = new Map();
  let pageToken = "";
  do {
    const url = API + "/files?spaces=drive&pageSize=1000&fields=nextPageToken,files(id,name,size,modifiedTime)&q=" +
      q(`'${folderId}' in parents and trashed = false`) + (pageToken ? "&pageToken=" + q(pageToken) : "");
    const r = await (await drive(url)).json();
    for (const f of r.files) {
      const old = map.get(f.name);
      if (!old || old.modifiedTime < f.modifiedTime) map.set(f.name, f);
    }
    pageToken = r.nextPageToken || "";
  } while (pageToken);
  return map;
}
async function downloadFile(id) {
  return new Uint8Array(await (await drive(API + "/files/" + id + "?alt=media")).arrayBuffer());
}
async function fileMeta(id) {
  return (await drive(API + "/files/" + id + "?fields=id,modifiedTime,trashed")).json();
}
/** Datei anlegen oder ersetzen – liefert { id, modifiedTime } */
async function uploadFile(name, bytes, existingId) {
  if (existingId) {
    const r = await drive(UPLOAD + "/files/" + existingId + "?uploadType=media&fields=id,modifiedTime", {
      method: "PATCH", headers: { "Content-Type": "application/octet-stream" }, body: bytes
    });
    return r.json();
  }
  const boundary = "mynotes" + Math.random().toString(36).slice(2);
  const metaPart = JSON.stringify({ name, parents: [S.folderId], mimeType: "application/octet-stream" });
  const head = TE.encode("--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + metaPart +
    "\r\n--" + boundary + "\r\nContent-Type: application/octet-stream\r\n\r\n");
  const tail = TE.encode("\r\n--" + boundary + "--\r\n");
  const r = await drive(UPLOAD + "/files?uploadType=multipart&fields=id,modifiedTime", {
    method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body: new Blob([head, bytes, tail])
  });
  return r.json();
}
// =====================================================================
// Daten aufbereiten (Sicherungs-Format „mynotes-backup“, siehe BackupModel.kt)
// =====================================================================
const AREA_FOLDER = 0, AREA_HOME = 1, AREA_UNFILED = 2;

function buildDb(snap) {
  const db = {
    createdAt: snap.createdAt || 0,
    appVersion: snap.appVersion || "",
    notes: new Map(), folders: new Map(), labels: new Map(),
    rootFolders: [], unfiled: [], dividers: new Map(),
    backlinks: new Map(), searchReady: false
  };

  for (const f of snap.folders || []) {
    db.folders.set(f.id, {
      id: f.id, name: f.name || "Ordner", color: cssColor(f.color), parentId: f.parentId ?? null,
      sort: f.sort || 0, createdAt: f.createdAt || 0, modifiedAt: f.modifiedAt || 0,
      children: [], noteIds: [], project: null, pinnedAt: f.pinnedAt || null
    });
  }
  for (const f of db.folders.values()) {
    const parent = f.parentId != null ? db.folders.get(f.parentId) : null;
    if (parent) parent.children.push(f); else db.rootFolders.push(f);
  }
  const bySort = (a, b) => a.sort - b.sort || a.id - b.id;
  db.rootFolders.sort(bySort);
  for (const f of db.folders.values()) f.children.sort(bySort);

  for (const l of snap.labels || []) db.labels.set(l.id, { id: l.id, name: l.name || "Label", color: cssColor(l.color), noteIds: [] });

  for (const n of snap.notes || []) {
    db.notes.set(n.id, {
      id: n.id, title: n.title || "", favorite: !!n.favorite, archived: !!n.archived, deleted: !!n.deleted,
      deletedAt: n.deletedAt || null, template: !!n.template, reminder: n.reminder || null,
      reminderRepeat: n.reminderRepeat || 0, reminderHasTime: !!n.reminderHasTime, color: cssColor(n.color),
      createdAt: n.createdAt || 0, modifiedAt: n.modifiedAt || 0, sort: n.sort || 0,
      pageNames: n.pageNames ?? null, pinnedAt: n.pinnedAt || null, blocks: [], folderIds: [], labelIds: [], _text: null, _norm: null
    });
  }
  for (const b of snap.blocks || []) {
    const note = db.notes.get(b.noteId);
    if (!note) continue;
    note.blocks.push({
      id: b.id, noteId: b.noteId, type: b.type || "TEXT", content: b.content || "", checked: !!b.checked,
      position: b.position || 0, priority: b.priority || 0, highlight: b.highlight || null,
      collapsed: !!b.collapsed, page: b.page || 0
    });
  }
  for (const note of db.notes.values()) {
    note.blocks.sort((a, b) => a.page - b.page || a.position - b.position || a.id - b.id);
    note.pages = pagesOf(note);
  }
  for (const [noteId, folderId] of snap.folderRefs || []) {
    const note = db.notes.get(noteId), folder = db.folders.get(folderId);
    if (!note || !folder) continue;
    note.folderIds.push(folderId);
    if (isActive(note)) folder.noteIds.push(noteId);
  }
  for (const [noteId, labelId] of snap.labelRefs || []) {
    const note = db.notes.get(noteId), label = db.labels.get(labelId);
    if (!note || !label) continue;
    note.labelIds.push(labelId);
    if (!note.deleted && !note.template) label.noteIds.push(noteId);
  }
  for (const [from, to] of snap.backlinks || []) {
    if (!db.notes.has(from) || !db.notes.has(to) || from === to) continue;
    if (!db.backlinks.has(to)) db.backlinks.set(to, new Set());
    db.backlinks.get(to).add(from);
  }
  for (const note of db.notes.values()) {
    if (isActive(note) && note.folderIds.length === 0) db.unfiled.push(note.id);
  }
  for (const d of snap.dividers || []) {
    const key = d.area === AREA_HOME ? "home" : d.area === AREA_UNFILED ? "unfiled" : "f" + d.parentId;
    if (d.area === AREA_FOLDER && !db.folders.has(d.parentId)) continue;
    if (!db.dividers.has(key)) db.dividers.set(key, []);
    db.dividers.get(key).push({ id: d.id, kind: d.kind || 0, title: d.title || "", sort: d.sort || 0, collapsed: !!d.collapsed });
  }
  // Projekte
  for (const p of snap.projects || []) {
    const folder = db.folders.get(p.folderId);
    if (!folder) continue;
    folder.project = { board: !!p.board, phases: [], items: new Map() };
  }
  for (const ph of snap.phases || []) {
    const folder = db.folders.get(ph.folderId);
    if (!folder || !folder.project) continue;
    folder.project.phases.push({ id: ph.id, name: ph.name || "Phase", position: ph.position || 0, color: cssColor(ph.color), collapsed: !!ph.collapsed });
  }
  for (const it of snap.projectItems || []) {
    const folder = db.folders.get(it.folderId);
    if (!folder || !folder.project) continue;
    folder.project.items.set(it.noteId, { phaseId: it.phaseId, done: !!it.done, position: it.position || 0 });
  }
  for (const f of db.folders.values()) if (f.project) f.project.phases.sort((a, b) => a.position - b.position || a.id - b.id);
  // NEU (AL): Ordner, die an weiteren Orten gezeigt werden (Verweise)
  db.links = new Map();
  for (const l of snap.folderLinks || []) {
    if (!db.folders.has(l.folderId) || (l.parentId != null && !db.folders.has(l.parentId))) continue;
    const key = l.parentId == null ? "home" : "f" + l.parentId;
    if (!db.links.has(key)) db.links.set(key, []);
    db.links.get(key).push({ folder: db.folders.get(l.folderId), sort: l.sort || 0 });
  }
  return db;
}

const isActive = n => !n.deleted && !n.archived && !n.template;
/** NEU (AO): Ebene einer Überschrift – 1 Über, 2 normal (auch alle alten), 3 Unter (steht in `priority`) */
const headingLevel = b => b.priority >= 1 && b.priority <= 3 ? b.priority : 2;
/**
 * NEU (AM): Alle Notizen in einem Ordner – inkl. Unterordner und verknüpfter Ordner,
 * jede Notiz nur einmal (Notizen an mehreren Orten). Zwischengespeichert pro Datenstand.
 */
function folderTotal(folder) {
  const db = S.db;
  if (!db._totals) db._totals = new Map();
  if (db._totals.has(folder.id)) return db._totals.get(folder.id);
  const seen = new Set(), notes = new Set(), stack = [folder];
  while (stack.length) {
    const f = stack.pop();
    if (!f || seen.has(f.id)) continue;
    seen.add(f.id);
    f.noteIds.forEach(id => notes.add(id));
    f.children.forEach(c => stack.push(c));
    (db.links.get("f" + f.id) || []).forEach(l => stack.push(l.folder));
  }
  db._totals.set(folder.id, notes.size);
  return notes.size;
}
const noteById = id => S.db && S.db.notes.get(Number(id));
const folderById = id => S.db && S.db.folders.get(Number(id));

function pagesOf(note) {
  if (note.pageNames == null) return null;
  const names = String(note.pageNames).split("\n");
  const maxPage = note.blocks.reduce((m, b) => Math.max(m, b.page), 0);
  while (names.length <= maxPage) names.push("");
  return names.map((n, i) => n.trim() || "Seite " + (i + 1));
}
function blocksOfPage(note, page) { return note.pages ? note.blocks.filter(b => b.page === page) : note.blocks; }

/** Ordnerpfad „Arbeit › Projekte“ */
function folderPath(folderId) {
  const parts = [];
  let f = folderById(folderId), guard = 0;
  while (f && guard++ < 40) { parts.unshift(f); f = f.parentId != null ? folderById(f.parentId) : null; }
  return parts;
}

// ---------------------------------------------------------------------
// Links: @[Name](note:12) · @[Name](note:12#57) · @[Name](folder:5)
// ---------------------------------------------------------------------
const LINK_RE = /@\[([^\]]+)\]\((note|folder):(\d+)(?:#(\d+))?\)/g;
function readable(text) { return String(text || "").replace(LINK_RE, (_, label) => "@" + label); }
function linkMarkup(label, noteId, anchor) {
  const safe = String(label || "").replace(/\]/g, ")").replace(/\n/g, " ").trim() || "Notiz";
  return `@[${safe}](note:${noteId}${anchor ? "#" + anchor : ""})`;
}

// ---------------------------------------------------------------------
// Inhalte als Text (Vorschau, Suche, Kopieren)
// ---------------------------------------------------------------------
function parseTable(content) {
  if (!content.trim()) return [];
  return content.split("\n").map(r => r.split("|"));
}
function parseProfile(content) {
  if (!content || !content.trim()) return [];
  try { return (JSON.parse(content).fields || []).map(f => ({ l: f.l || "", v: f.v || "" })); } catch (_) { return []; }
}
function drawingTexts(content) {
  const out = [];
  for (const line of String(content || "").split("\n")) {
    if (line.startsWith("C ")) {
      const parts = line.split(" ");
      if (parts.length >= 8) {
        const t = unescapeCard(parts[7]);
        const rest = parts.slice(8).join(" ");
        const m = /@\[([^\]]+)\]/.exec(rest);
        out.push(t || (m ? m[1] : rest.replace(/^@/, "")));
      }
    } else if (line.startsWith("L ")) {
      const m = /@\[([^\]]+)\]/.exec(line);
      if (m) out.push(m[1]);
    }
  }
  return out.filter(Boolean);
}
/** Lesbarer Text eines Blocks (ohne Link-Technik) */
function blockText(b) {
  switch (b.type) {
    case "TABLE": return parseTable(b.content).map(r => r.join("  ")).join("\n");
    case "PROFILE": return parseProfile(b.content).filter(f => f.v).map(f => f.l + ": " + f.v).join("\n");
    case "WORKTIME": { const w = S.extras.work[b.id]; return w ? w.summary : "Arbeitszeit"; }
    case "DRAWING": return drawingTexts(b.content).join("\n");
    case "IMAGE": case "PROJECT": case "DIVIDER": return "";
    case "TIMETABLE": return timetableText(b.content); // NEU (AZ)
    default: return readable(b.content);
  }
}
/** Text zum Teilen/Kopieren – wie „Teilen“ auf dem Handy */
function notePlainText(note, page = null) {
  const lines = [];
  if (note.title.trim()) lines.push(note.title.trim(), "");
  const blocks = page == null ? note.blocks : blocksOfPage(note, page);
  let lastPage = -1;
  for (const b of blocks) {
    if (note.pages && page == null && b.page !== lastPage) {
      if (lastPage >= 0) lines.push("");
      lines.push("— " + note.pages[b.page] + " —");
      lastPage = b.page;
    }
    lines.push(...blockPlainLines(b, note));
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function blockPlainLines(b, note) {
  switch (b.type) {
    case "CHECKLIST_ITEM": return [(b.checked ? "☑ " : "☐ ") + readable(b.content)];
    case "DIVIDER": return ["———"];
    case "HEADING": return ["", readable(b.content)];
    case "TABLE": return parseTable(b.content).map(r => r.map(c => c.trim()).join(" | "));
    case "CALC": return calcLines(b).map(l => l.res ? l.src + "  = " + l.res : l.src);
    case "PROFILE": return parseProfile(b.content).filter(f => f.v).map(f => f.l + ": " + f.v);
    case "WORKTIME": { const w = S.extras.work[b.id]; return w ? [w.summary, ...w.lines] : ["⏱ Arbeitszeit"]; }
    case "DRAWING": return ["(Zeichnung)"];
    case "IMAGE": return ["(Bild)"];
    case "PROJECT": return [projectSummaryText(note, b.page)];
    case "TIMETABLE": return timetableText(b.content).split("\n"); // NEU (AZ)
    default: return [readable(b.content)];
  }
}
/** Markdown – wie der Markdown-Export am Handy */
function noteMarkdown(note) {
  const out = [];
  out.push("# " + (note.title.trim() || "Ohne Titel").replace(/\n/g, " "), "");
  const meta = [];
  if (note.favorite) meta.push("⭐ Favorit");
  meta.push("Geändert: " + fullTime(note.modifiedAt));
  meta.push("Erstellt: " + fullTime(note.createdAt));
  const rt = reminderText(note);
  if (rt) meta.push("⏰ " + rt);
  const labels = note.labelIds.map(id => S.db.labels.get(id)?.name).filter(Boolean);
  if (labels.length) meta.push("Labels: " + labels.join(", "));
  out.push("*" + meta.join(" · ") + "*", "");
  let prev = null, lastPage = -1;
  for (const b of note.blocks) {
    if (note.pages && b.page !== lastPage) { out.push("", "## " + note.pages[b.page], ""); lastPage = b.page; prev = null; }
    if (prev && !(prev === "CHECKLIST_ITEM" && b.type === "CHECKLIST_ITEM")) out.push("");
    prev = b.type;
    switch (b.type) {
      // GEÄNDERT (AO): Ebene 1–3 → ## / ### / #### (wie der Markdown-Export am Handy)
      case "HEADING": out.push("#".repeat(headingLevel(b) + 1) + " " + readable(b.content).replace(/\n/g, " ")); break;
      case "CHECKLIST_ITEM": out.push((b.checked ? "- [x] " : "- [ ] ") + (b.priority > 0 ? "!".repeat(b.priority) + " " : "") + readable(b.content).replace(/\n/g, " ")); break;
      case "CODE": out.push("```", b.content, "```"); break;
      case "DIVIDER": out.push("---"); break;
      case "TABLE": out.push(tableMarkdown(b.content)); break;
      case "CALC": {
        out.push("```", b.content, "```");
        const res = calcLines(b).filter(l => l.res).map(l => "- " + (l.src.trim() ? l.src.trim() + " = " : "") + l.res);
        if (res.length) out.push("**Ergebnisse:**", ...res);
        break;
      }
      case "PROFILE": parseProfile(b.content).filter(f => f.v).forEach(f => out.push(`- **${f.l}:** ${f.v}`)); break;
      case "WORKTIME": { const w = S.extras.work[b.id]; out.push(w ? w.summary : "⏱ Arbeitszeit"); break; }
      case "PROJECT": out.push("**" + projectSummaryText(note, b.page) + "**"); break;
      case "DRAWING": out.push("*(Zeichnung)*"); break;
      case "TIMETABLE": out.push(timetableText(b.content)); break; // NEU (AZ)
      case "IMAGE": out.push("*(Bild)*"); break;
      default: out.push(readable(b.content));
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
function tableMarkdown(content) {
  const rows = parseTable(content).map(r => r.map(c => c.trim().replace(/\|/g, "\\|").replace(/\n/g, " ")));
  if (!rows.length || rows.every(r => r.every(c => !c))) return "";
  const w = Math.max(...rows.map(r => r.length));
  const line = cells => "| " + Array.from({ length: w }, (_, i) => cells[i] || "").join(" | ") + " |";
  return [line(rows[0]), "|" + Array.from({ length: w }, () => " --- ").join("|") + "|", ...rows.slice(1).map(line)].join("\n");
}
function tableTsv(content) {
  return parseTable(content).map(r => r.map(c => c.replace(/\t/g, " ").replace(/\n/g, " ")).join("\t")).join("\n");
}
function tableCsv(content) {
  const esc = c => /[";\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
  return "﻿" + parseTable(content).map(r => r.map(c => esc(c.trim())).join(";")).join("\r\n");
}

// ---------------------------------------------------------------------
// Rechnungen (Ergebnisse kommen fertig vom Handy: pcextras.enc)
// ---------------------------------------------------------------------
function calcLines(b) {
  const results = S.extras.calc[b.id] || [];
  return b.content.split("\n").map((src, i) => {
    const r = results[i];
    return {
      src, res: r && r.v != null ? r.v : null, agg: !!(r && r.a), err: r && r.err ? r.err : null,
      head: !!(r && r.h) || /^\s*#/.test(src)
    };
  });
}

// ---------------------------------------------------------------------
// Projekte
// ---------------------------------------------------------------------
function checklistStats(note) {
  let total = 0, done = 0;
  for (const b of note.blocks) if (b.type === "CHECKLIST_ITEM" && b.content.trim()) { total++; if (b.checked) done++; }
  return { total, done };
}
function noteProgress(note, item) {
  const st = checklistStats(note);
  const complete = !!(item && item.done) || (st.total > 0 && st.done >= st.total);
  const progress = item && item.done ? 1 : st.total > 0 ? st.done / st.total : 0;
  return { complete, progress, ...st };
}
/** Projekt-Ordner: Phasen mit ihren Notizen */
function projectBoard(folder) {
  const p = folder.project;
  const phases = p.phases.length ? p.phases : [{ id: -1, name: "Schritte", position: 0, color: null }];
  const cols = new Map(phases.map(ph => [ph.id, []]));
  for (const noteId of folder.noteIds) {
    const note = noteById(noteId);
    if (!note) continue;
    const item = p.items.get(noteId);
    const phaseId = item && cols.has(item.phaseId) ? item.phaseId : phases[0].id;
    cols.get(phaseId).push({ note, item, pos: item ? item.position : 1e9 + note.sort, ...noteProgress(note, item) });
  }
  for (const list of cols.values()) list.sort((a, b) => a.pos - b.pos || a.note.id - b.note.id);
  const all = [...cols.values()].flat();
  const progress = all.length ? all.reduce((s, x) => s + x.progress, 0) / all.length : 0;
  return {
    phases: phases.map(ph => ({ phase: ph, entries: cols.get(ph.id) })),
    total: all.length, done: all.filter(x => x.complete).length, progress
  };
}
/** Projekt-Notiz: Überschriften = Phasen, Checklisten-Punkte = Aufgaben (siehe ProjectNote.kt) */
function notePhases(blocks) {
  const result = [];
  let heading = null, section = [], number = 0;
  const flush = () => {
    const tasks = section.filter(b => b.type === "CHECKLIST_ITEM" && b.content.trim());
    if (heading || tasks.length) {
      const done = tasks.filter(t => t.checked).length;
      result.push({
        heading, name: heading ? (readable(heading.content).trim() || "Phase " + number) : "Allgemein",
        tasks, done, total: tasks.length, progress: tasks.length ? done / tasks.length : 0,
        complete: tasks.length > 0 && done === tasks.length
      });
    }
  };
  for (const b of [...blocks].sort((a, b) => a.position - b.position)) {
    if (b.type === "HEADING") { flush(); number++; heading = b; section = []; }
    else if (b.type !== "PROJECT") section.push(b);
  }
  flush();
  return result;
}
function projectSummaryText(note, page) {
  const phases = notePhases(blocksOfPage(note, page));
  const tasks = phases.flatMap(p => p.tasks);
  const done = tasks.filter(t => t.checked).length;
  return tasks.length ? `📋 Projekt · ${done}/${tasks.length} erledigt · ${Math.round(done * 100 / tasks.length)} %` : "📋 Projekt · noch keine Aufgaben";
}

// ---------------------------------------------------------------------
// Listen bauen (gleiche Reihenfolge wie am Handy, siehe ListSections.kt)
// ---------------------------------------------------------------------
function sortNotes(notes, mode = S.settings.sort) {
  const arr = notes.slice();
  if (mode === "modified") arr.sort((a, b) => b.modifiedAt - a.modifiedAt);
  else if (mode === "created") arr.sort((a, b) => b.createdAt - a.createdAt);
  else if (mode === "title") arr.sort((a, b) => (a.title || "￿").localeCompare(b.title || "￿", "de", { sensitivity: "base" }));
  else arr.sort((a, b) => a.sort - b.sort || a.id - b.id);
  return arr;
}
/**
 * Einträge eines Bereichs: Favoriten oben, dann (bei „Eigene Reihenfolge“) Ordner, Notizen und
 * Überschriften gemischt nach Position.
 */
function areaEntries(folders, notes, dividers, mode = S.settings.sort, links = []) {
  const fav = notes.filter(n => n.favorite), rest = notes.filter(n => !n.favorite);
  const linked = links.map(l => ({ kind: "folder", folder: l.folder, linked: true, pos: l.sort, id: l.folder.id }));
  if (mode !== "custom") {
    return [...sortNotes(fav, mode).map(n => ({ kind: "note", note: n })),
      ...folders.map(f => ({ kind: "folder", folder: f })), ...linked,
      ...sortNotes(rest, mode).map(n => ({ kind: "note", note: n }))];
  }
  const rank = { divider: 0, folder: 1, note: 2 };
  const mixed = [
    ...folders.map(f => ({ kind: "folder", folder: f, pos: f.sort, id: f.id })), ...linked,
    ...rest.map(n => ({ kind: "note", note: n, pos: n.sort, id: n.id })),
    ...(dividers || []).map(d => ({ kind: "divider", divider: d, pos: d.sort, id: d.id }))
  ].sort((a, b) => a.pos - b.pos || rank[a.kind] - rank[b.kind] || a.id - b.id);
  return [...sortNotes(fav, "custom").map(n => ({ kind: "note", note: n })), ...mixed];
}

// ---------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------
function noteNorm(note) {
  if (note._norm == null) {
    const parts = [note.title];
    for (const b of note.blocks) parts.push(blockText(b));
    note._norm = norm(parts.join("\n"));
    note._titleNorm = norm(note.title);
  }
  return note._norm;
}
/** Treffer: alle Begriffe müssen vorkommen. Titel zählt mehr, neuere zuerst bei Gleichstand. */
function searchNotes(query, { scope = "all" } = {}) {
  const ts = terms(query);
  if (!ts.length) return [];
  const hits = [];
  for (const note of S.db.notes.values()) {
    if (scope === "all" && (note.deleted)) continue;
    const text = noteNorm(note);
    if (!ts.every(t => text.includes(t))) continue;
    let score = 0;
    for (const t of ts) {
      if (note._titleNorm.includes(t)) score += note._titleNorm.startsWith(t) ? 30 : 15;
      const idx = text.indexOf(t);
      if (idx >= 0 && (idx === 0 || /\W/.test(text[idx - 1]))) score += 3;
    }
    if (note.archived) score -= 5;
    if (note.template) score -= 3;
    hits.push({ note, score, ts });
  }
  hits.sort((a, b) => b.score - a.score || b.note.modifiedAt - a.note.modifiedAt);
  return hits;
}
/** Bis zu [max] Textstellen mit Treffern */
function snippets(note, ts, max = 2) {
  const out = [];
  for (const b of note.blocks) {
    const text = blockText(b);
    if (!text) continue;
    const ranges = findRanges(text, ts);
    if (!ranges.length) continue;
    const [s] = ranges[0];
    let from = Math.max(0, s - 40);
    if (from > 0) { const sp = text.lastIndexOf(" ", from); if (sp >= 0 && s - sp < 60) from = sp + 1; }
    let piece = text.slice(from, from + 160).replace(/\s*\n\s*/g, " ⏎ ");
    if (from > 0) piece = "…" + piece;
    if (from + 160 < text.length) piece += "…";
    out.push({ block: b, text: piece });
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------------
// „Vom PC“: einfache Schreibweise ⇄ Blöcke
//   # Über-Überschrift · ## Überschrift · ### Unter-Überschrift (NEU AO)
//   - [ ] Punkt · - [x] erledigt · --- Trennlinie · ``` Code ```
// ---------------------------------------------------------------------
const CHECK_RE = /^\s*(?:[-*+]\s*)?\[( |x|X)\]\s?(.*)$/;
const CHECK_ALT_RE = /^\s*([☐☑✓✔])\s?(.*)$/;
function markupToBlocks(text) {
  const blocks = [];
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  let buf = [];
  const flushText = () => {
    while (buf.length && !buf[0].trim()) buf.shift();
    while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
    if (buf.length) blocks.push({ type: "TEXT", content: buf.join("\n"), checked: false });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith("```")) {
      flushText();
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i++; }
      blocks.push({ type: "CODE", content: code.join("\n"), checked: false });
      continue;
    }
    let m;
    if ((m = /^(#{1,6})\s+/.exec(t))) { flushText(); blocks.push({ type: "HEADING", content: t.replace(/^#{1,6}\s+/, ""), checked: false, level: Math.min(3, m[1].length) }); continue; }
    if ((m = CHECK_RE.exec(line))) { flushText(); blocks.push({ type: "CHECKLIST_ITEM", content: m[2], checked: m[1] !== " " }); continue; }
    if ((m = CHECK_ALT_RE.exec(line))) { flushText(); blocks.push({ type: "CHECKLIST_ITEM", content: m[2], checked: m[1] !== "☐" }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,}|—{2,})$/.test(t)) { flushText(); blocks.push({ type: "DIVIDER", content: "", checked: false }); continue; }
    buf.push(line);
  }
  flushText();
  return blocks;
}
function blocksToMarkup(blocks) {
  const out = [];
  let prev = null;
  for (const b of blocks) {
    if (prev && !(prev === "CHECKLIST_ITEM" && b.type === "CHECKLIST_ITEM") && !(prev === "HEADING")) out.push("");
    prev = b.type;
    switch (b.type) {
      case "HEADING": out.push("#".repeat(b.level || 2) + " " + b.content.replace(/\n/g, " ")); break;
      case "CHECKLIST_ITEM": out.push((b.checked ? "- [x] " : "- [ ] ") + b.content.replace(/\n/g, " ")); break;
      case "CODE": out.push("```", b.content, "```"); break;
      case "DIVIDER": out.push("---"); break;
      default: out.push(b.content);
    }
  }
  return out.join("\n");
}
/** Handy-Notiz → Schreibweise für „Vom PC“ (Sonderblöcke werden zu Text) */
function noteToMarkup(note) {
  const blocks = [];
  for (const b of note.blocks) {
    switch (b.type) {
      case "TEXT": case "HEADING": case "CHECKLIST_ITEM": case "CODE": case "DIVIDER":
        blocks.push({ type: b.type, content: b.content, checked: b.checked, level: b.type === "HEADING" ? headingLevel(b) : undefined }); break;
      case "TABLE": blocks.push({ type: "TEXT", content: parseTable(b.content).map(r => r.map(c => c.trim()).join(" | ")).join("\n") }); break;
      case "CALC": blocks.push({ type: "CODE", content: b.content }); break;
      case "IMAGE": case "DRAWING": case "PROJECT": break;
      default: {
        const lines = blockPlainLines(b, note).filter(Boolean);
        if (lines.length) blocks.push({ type: "TEXT", content: lines.join("\n") });
      }
    }
  }
  return blocksToMarkup(blocks);
}
// =====================================================================
// Text mit Links, Webadressen und Such-Markierungen
// =====================================================================
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

function inline(text, ts) {
  const frag = document.createDocumentFragment();
  text = String(text || "");
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    if (m.index > last) appendUrls(frag, text.slice(last, m.index), ts);
    frag.appendChild(linkEl(m[1], m[2], Number(m[3]), m[4] ? Number(m[4]) : null, ts));
    last = m.index + m[0].length;
  }
  if (last < text.length) appendUrls(frag, text.slice(last), ts);
  return frag;
}
function appendUrls(frag, text, ts) {
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const trail = /[.,;:!?)\]}'»“”]+$/.exec(url);
    if (trail) url = url.slice(0, -trail[0].length);
    if (!url) continue;
    if (m.index > last) appendMarked(frag, text.slice(last, m.index), ts);
    const href = url.toLowerCase().startsWith("www.") ? "https://" + url : url;
    const a = h("a", { class: "url", href, target: "_blank", rel: "noopener noreferrer", title: href });
    appendMarked(a, url, ts);
    frag.appendChild(a);
    last = m.index + url.length;
  }
  if (last < text.length) appendMarked(frag, text.slice(last), ts);
}
function appendMarked(parent, text, ts) {
  const ranges = findRanges(text, ts);
  if (!ranges.length) { parent.appendChild(document.createTextNode(text)); return; }
  let last = 0;
  for (const [s, e] of ranges) {
    if (s > last) parent.appendChild(document.createTextNode(text.slice(last, s)));
    parent.appendChild(h("mark", { class: "find" }, text.slice(s, e)));
    last = e;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}
function linkEl(label, type, id, anchor, ts) {
  const isFolder = type === "folder";
  const target = isFolder ? folderById(id) : noteById(id);
  const ok = !!target && (isFolder || !target.deleted);
  const current = target ? (isFolder ? target.name : (target.title || "Ohne Titel")) : null;
  const el = h("button", {
    class: "link" + (ok ? "" : " dead"), type: "button",
    title: !target ? "Nicht verfügbar (gelöscht, versteckt oder nicht in der PC-Kopie)"
      : target.deleted ? "Liegt im Papierkorb" : (isFolder ? "Ordner öffnen: " : "Notiz öffnen: ") + current,
    onclick: e => {
      e.stopPropagation();
      if (!target) { toast("Ziel ist nicht verfügbar"); return; }
      if (isFolder) go({ view: "folder", id }, null);
      else openNote(id, { anchor });
    }
  }, h("span", { class: "lk-ic" }, isFolder ? "📁 " : "@"));
  appendMarked(el, label, ts);
  return el;
}

// =====================================================================
// Zeichnungen (Format siehe DrawingModel.kt) → SVG
// =====================================================================
const DSCALE = 10000;
function splitLimit(s, sep, limit) {
  const parts = s.split(sep);
  if (parts.length <= limit) return parts;
  return [...parts.slice(0, limit - 1), parts.slice(limit - 1).join(sep)];
}
function unescapeCard(tok) {
  if (tok === "-") return "";
  return tok.replace(/%([0-9a-fA-F]{2})/g, (_, hx) => String.fromCharCode(parseInt(hx, 16)));
}
function parseDrawLink(text) {
  LINK_RE.lastIndex = 0;
  const m = new RegExp(LINK_RE.source).exec(text || "");
  return m ? { isFolder: m[2] === "folder", id: Number(m[3]), label: m[1] } : null;
}
const isDrawColor = c => c === "i" || /^[0-9a-fA-F]{6}$/.test(c);

function decodeDrawing(text) {
  if (!text || !text.trim()) return null;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const header = lines[0].split(" ");
  if (header[0] !== "D1") return null;
  const aspect = Math.min(3, Math.max(0.5, (parseInt(header[1], 10) || 1500) / 1000));
  const d = { aspect, H: aspect * DSCALE, paper: header[2] || "n", strokes: [], cards: [], connectors: [], links: new Map() };
  for (const line of lines.slice(1)) {
    if (line.startsWith("L ")) {
      const p = splitLimit(line, " ", 3);
      const g = parseInt(p[1], 10), link = parseDrawLink(p[2]);
      if (!isNaN(g) && link) d.links.set(g, link);
    } else if (line.startsWith("C ")) {
      const p = splitLimit(line, " ", 9);
      if (p.length < 8) continue;
      const nums = p.slice(1, 6).map(v => parseInt(v, 10));
      if (nums.some(isNaN)) continue;
      const rest = p[8] || "";
      const link = parseDrawLink(rest);
      let text = unescapeCard(p[7]);
      if (!link && rest.startsWith("@") && !text) text = rest.slice(1);
      d.cards.push({
        id: nums[0], x: nums[1], y: nums[2], w: Math.max(nums[3], 800), h: Math.max(nums[4], 450),
        color: /^[0-9a-fA-F]{6}$/.test(p[6]) ? p[6] : null, text, link
      });
    } else if (line.startsWith("K ")) {
      const p = line.split(" ");
      const from = parseInt(p[1], 10), to = parseInt(p[2], 10);
      if (isNaN(from) || isNaN(to)) continue;
      d.connectors.push({ from, to, arrow: p[3] !== "l", color: isDrawColor(p[4] || "") ? p[4] : "i" });
    } else {
      const s = decodeStroke(line);
      if (s) d.strokes.push(s);
    }
  }
  for (const s of d.strokes) if (s.group != null && !d.links.has(s.group)) s.group = null;
  return d;
}
function decodeStroke(line) {
  const p = line.split(" ");
  if (p.length < 4 || !["P", "M", "F"].includes(p[0]) || !isDrawColor(p[1])) return null;
  const width = parseInt(p[2], 10);
  if (!(width > 0)) return null;
  const s = { tool: p[0], color: p[1], width, alpha: p[0] === "M" ? 0.4 : 1, smooth: true, filled: false, fill: null, group: null, pts: [] };
  let i = 3;
  while (i < p.length && !p[i].includes(",")) {
    const t = p[i];
    if (t[0] === "a") s.alpha = Math.min(1, Math.max(0.01, (parseInt(t.slice(1), 10) || 100) / 100));
    else if (t === "s") s.smooth = false;
    else if (t === "f") s.filled = true;
    else if (t[0] === "m") { s.fill = decodeFill(t); if (!s.fill) return null; }
    else if (t[0] === "g") s.group = parseInt(t.slice(1), 10);
    else return null;
    i++;
  }
  let x = 0, y = 0;
  const first = i;
  for (; i < p.length; i++) {
    const c = p[i].indexOf(",");
    if (c <= 0) return null;
    const a = parseInt(p[i].slice(0, c), 10), b = parseInt(p[i].slice(c + 1), 10);
    if (isNaN(a) || isNaN(b)) return null;
    if (i === first) { x = a; y = b; } else { x += a; y += b; }
    s.pts.push([x, y]);
  }
  if (s.tool === "F" && !s.fill) return null;
  if (s.tool !== "F" && !s.pts.length) return null;
  return s;
}
function decodeFill(tok) {
  const parts = tok.slice(1).split(";");
  if (parts.length !== 6) return null;
  const [left, top, cell, w, h] = parts.slice(0, 5).map(v => parseInt(v, 10));
  if ([left, top, cell, w, h].some(isNaN) || cell <= 0 || w < 1 || h < 1 || w > 4000 || h > 8000) return null;
  const bits = new Uint8Array(w * h);
  let idx = 0, val = false;
  for (const r of parts[5].split(".")) {
    const run = parseInt(r, 36);
    if (isNaN(run) || run < 0 || idx + run > bits.length) return null;
    if (val) bits.fill(1, idx, idx + run);
    idx += run;
    val = !val;
  }
  if (idx !== bits.length) return null;
  // Millionstel der Breite → Zeichnungs-Einheiten (Zehntausendstel)
  return { left: left / 100, top: top / 100, cell: cell / 100, w, h, bits };
}
function drawingBounds(d) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of d.strokes) {
    if (s.fill) {
      minX = Math.min(minX, s.fill.left); minY = Math.min(minY, s.fill.top);
      maxX = Math.max(maxX, s.fill.left + s.fill.w * s.fill.cell); maxY = Math.max(maxY, s.fill.top + s.fill.h * s.fill.cell);
    }
    const half = s.width / 2;
    for (const [x, y] of s.pts) {
      minX = Math.min(minX, x - half); minY = Math.min(minY, y - half);
      maxX = Math.max(maxX, x + half); maxY = Math.max(maxY, y + half);
    }
  }
  for (const c of d.cards) {
    minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w); maxY = Math.max(maxY, c.y + c.h);
  }
  return minX > maxX ? null : { l: minX, t: minY, r: maxX, b: maxY };
}
/** Ausschnitt wie am Handy (DrawingMath.previewBounds) */
function previewBounds(d) {
  const c = drawingBounds(d);
  if (!c) return null;
  const pad = 400, min = 3300;
  const w = Math.max(c.r - c.l + 2 * pad, min), hh = Math.max(c.b - c.t + 2 * pad, min * 0.5);
  const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2;
  return { l: cx - w / 2, t: cy - hh / 2, r: cx + w / 2, b: cy + hh / 2 };
}
function strokePathD(pts, smooth) {
  const f = v => Math.round(v * 10) / 10;
  if (!pts.length) return "";
  let d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
  if (pts.length === 1) return d;
  if (!smooth) { for (let i = 1; i < pts.length; i++) d += "L" + f(pts[i][0]) + " " + f(pts[i][1]); return d; }
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], n = pts[i + 1];
    d += "Q" + f(p[0]) + " " + f(p[1]) + " " + f((p[0] + n[0]) / 2) + " " + f((p[1] + n[1]) / 2);
  }
  const last = pts[pts.length - 1];
  return d + "L" + f(last[0]) + " " + f(last[1]);
}
const fillCache = new WeakMap();
function fillImage(fill, color) {
  let byColor = fillCache.get(fill);
  if (!byColor) { byColor = new Map(); fillCache.set(fill, byColor); }
  if (byColor.has(color)) return byColor.get(color);
  const canvas = document.createElement("canvas");
  canvas.width = fill.w; canvas.height = fill.h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(fill.w, fill.h);
  const [r, g, b] = rgbOf(color) || [128, 128, 128];
  for (let i = 0; i < fill.bits.length; i++) {
    if (!fill.bits[i]) continue;
    const o = i * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL("image/png");
  byColor.set(color, url);
  return url;
}
function inkColor() {
  const c = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : "#e8eaed";
}
const drawColor = c => c === "i" ? "currentColor" : "#" + c.toLowerCase();

/**
 * SVG einer Zeichnung. crop = nur bemalter Bereich (Vorschau), sonst ganze Fläche.
 * onLink(link) = Klick auf eine verlinkte Karte/Form.
 */
function drawingSvg(content, { crop = true, onLink = null, svgText = false } = {}) {
  const d = typeof content === "string" ? decodeDrawing(content) : content;
  if (!d) return null;
  const vb = crop ? previewBounds(d) : { l: 0, t: 0, r: DSCALE, b: d.H };
  if (!vb) return null;
  const W = vb.r - vb.l, H = vb.b - vb.t;
  const svg = sv("svg", {
    viewBox: `${vb.l} ${vb.t} ${W} ${H}`, xmlns: NS, preserveAspectRatio: "xMidYMid meet",
    role: "img", "aria-label": "Zeichnung"
  });
  svg.dataset.w = String(W);
  svg.dataset.h = String(H);
  // Papier
  if (d.paper !== "n") {
    const g = sv("g", { opacity: "0.13", stroke: "currentColor", fill: "currentColor" });
    const s = 500;
    const x0 = Math.ceil(vb.l / s) * s, y0 = Math.ceil(vb.t / s) * s;
    if (d.paper === "g" || d.paper === "l") {
      for (let y = y0; y <= vb.b; y += s) g.appendChild(sv("line", { x1: vb.l, y1: y, x2: vb.r, y2: y, "vector-effect": "non-scaling-stroke", "stroke-width": 1 }));
      if (d.paper === "g") for (let x = x0; x <= vb.r; x += s) g.appendChild(sv("line", { x1: x, y1: vb.t, x2: x, y2: vb.b, "vector-effect": "non-scaling-stroke", "stroke-width": 1 }));
    } else if (d.paper === "d") {
      for (let y = y0; y <= vb.b; y += s) for (let x = x0; x <= vb.r; x += s) g.appendChild(sv("circle", { cx: x, cy: y, r: 16, stroke: "none" }));
    }
    svg.appendChild(g);
  }
  // Füllungen zuerst (liegen unten)
  const ink = inkColor();
  for (const s of d.strokes) {
    if (!s.fill) continue;
    const f = s.fill;
    svg.appendChild(sv("image", {
      href: fillImage(f, s.color === "i" ? ink : "#" + s.color), x: f.left, y: f.top,
      width: f.w * f.cell, height: f.h * f.cell, preserveAspectRatio: "none", opacity: s.alpha
    }));
  }
  // Striche
  for (const s of d.strokes) {
    if (s.tool === "F") continue;
    const color = drawColor(s.color);
    if (s.pts.length === 1) {
      svg.appendChild(sv("circle", { cx: s.pts[0][0], cy: s.pts[0][1], r: s.width / 2, fill: color, "fill-opacity": s.alpha }));
      continue;
    }
    const path = strokePathD(s.pts, s.smooth);
    if (s.filled && s.pts.length > 2) svg.appendChild(sv("path", { d: path, fill: color, "fill-opacity": s.alpha, stroke: "none" }));
    svg.appendChild(sv("path", {
      d: path, fill: "none", stroke: color, "stroke-opacity": s.alpha, "stroke-width": s.width,
      "stroke-linecap": "round", "stroke-linejoin": "round"
    }));
  }
  // Verbinder
  const byId = new Map(d.cards.map(c => [c.id, c]));
  for (const k of d.connectors) {
    const a = byId.get(k.from), b = byId.get(k.to);
    if (!a || !b) continue;
    const [s, e] = connectorEnds(a, b);
    const color = drawColor(k.color);
    const g = sv("g", { stroke: color, "stroke-width": 40, "stroke-linecap": "round", fill: "none" });
    g.appendChild(sv("line", { x1: s[0], y1: s[1], x2: e[0], y2: e[1] }));
    if (k.arrow) {
      const ang = Math.atan2(e[1] - s[1], e[0] - s[0]), head = 220, spread = Math.PI / 7;
      g.appendChild(sv("line", { x1: e[0], y1: e[1], x2: e[0] - head * Math.cos(ang - spread), y2: e[1] - head * Math.sin(ang - spread) }));
      g.appendChild(sv("line", { x1: e[0], y1: e[1], x2: e[0] - head * Math.cos(ang + spread), y2: e[1] - head * Math.sin(ang + spread) }));
    }
    svg.appendChild(g);
  }
  // Karten
  for (const c of d.cards) {
    const bg = c.color ? "#" + c.color.toLowerCase() : null;
    const g = sv("g", { class: c.link && onLink ? "dl" : null, style: c.link && onLink ? "cursor:pointer" : null });
    g.appendChild(sv("rect", {
      x: c.x, y: c.y, width: c.w, height: c.h, rx: 120, ry: 120,
      fill: bg || "var(--surface)", stroke: c.link ? "var(--link)" : "currentColor",
      "stroke-opacity": c.link ? 1 : 0.55, "stroke-width": 30
    }));
    let label = c.text;
    if (c.link) {
      const target = c.link.isFolder ? folderById(c.link.id) : noteById(c.link.id);
      label = (c.link.isFolder ? "📁 " : "📄 ") + (target ? (c.link.isFolder ? target.name : target.title || "Ohne Titel") : c.link.label);
    }
    if (label && label.trim() && svgText) {
      // Für den Export: echter SVG-Text (foreignObject würde das PNG blockieren)
      const pad = 120;
      const font = Math.max(40, Math.min(320, c.h * 0.42));
      const maxLines = Math.max(1, Math.floor((c.h - pad) / (font * 1.3)));
      const perLine = Math.max(1, Math.floor((c.w - 2 * pad) / (font * 0.56)));
      const wrapped = [];
      for (const para of label.split("\n")) {
        let line = "";
        for (const word of para.split(/\s+/)) {
          if ((line + " " + word).trim().length > perLine && line) { wrapped.push(line); line = word; }
          else line = (line + " " + word).trim();
        }
        wrapped.push(line);
      }
      const shown = wrapped.slice(0, maxLines);
      if (wrapped.length > maxLines) shown[maxLines - 1] = shown[maxLines - 1].slice(0, Math.max(1, perLine - 1)) + "…";
      const color = bg ? (isLight(bg) ? "#202124" : "#ffffff") : "currentColor";
      const top = c.y + c.h / 2 - (shown.length - 1) * font * 1.3 / 2;
      const t = sv("text", { x: c.x + c.w / 2, y: top, "text-anchor": "middle", "dominant-baseline": "middle", "font-size": font, fill: color, "font-family": "system-ui, Segoe UI, Roboto, sans-serif" });
      shown.forEach((ln, i) => t.appendChild(sv("tspan", { x: c.x + c.w / 2, dy: i === 0 ? 0 : font * 1.3, text: ln })));
      g.appendChild(t);
    } else if (label && label.trim()) {
      const pad = 120;
      const font = Math.max(40, Math.min(320, c.h * 0.42));
      const lines = Math.max(1, Math.floor((c.h - pad) / (font * 1.3)));
      const fo = sv("foreignObject", { x: c.x + pad, y: c.y, width: Math.max(1, c.w - 2 * pad), height: c.h });
      const div = document.createElement("div");
      div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      Object.assign(div.style, {
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
        font: `${font}px/1.3 ${getComputedStyle(document.body).fontFamily}`,
        color: bg ? (isLight(bg) ? "#202124" : "#ffffff") : "currentColor", overflow: "hidden"
      });
      const span = document.createElement("span");
      Object.assign(span.style, { display: "-webkit-box", webkitLineClamp: String(lines), webkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", whiteSpace: "pre-wrap" });
      span.textContent = label;
      div.appendChild(span);
      fo.appendChild(div);
      g.appendChild(fo);
    }
    if (c.link && onLink) g.addEventListener("click", e => { e.stopPropagation(); onLink(c.link); });
    svg.appendChild(g);
  }
  // 🔗 an verlinkten Formen
  const groups = new Map();
  for (const s of d.strokes) if (s.group != null) {
    if (!groups.has(s.group)) groups.set(s.group, []);
    groups.get(s.group).push(s);
  }
  for (const [group, strokes] of groups) {
    const link = d.links.get(group);
    const b = drawingBounds({ strokes, cards: [] });
    if (!link || !b) continue;
    if (onLink) {
      const hit = sv("rect", { x: b.l - 150, y: b.t - 150, width: b.r - b.l + 300, height: b.b - b.t + 300, fill: "transparent", style: "cursor:pointer" });
      hit.addEventListener("click", e => { e.stopPropagation(); onLink(link); });
      hit.appendChild(sv("title", { text: (link.isFolder ? "Ordner: " : "Notiz: ") + link.label }));
      svg.appendChild(hit);
    }
    const r = 160;
    const badge = sv("g", { transform: `translate(${b.r} ${b.t})`, style: onLink ? "cursor:pointer" : null });
    badge.appendChild(sv("circle", { r, fill: "var(--link)", stroke: "#fff", "stroke-width": r * 0.18 }));
    badge.appendChild(sv("path", { d: ICONS.link, fill: "#fff", transform: `translate(${-r * 0.7} ${-r * 0.7}) scale(${r * 1.4 / 24})` }));
    if (onLink) badge.addEventListener("click", e => { e.stopPropagation(); onLink(link); });
    svg.appendChild(badge);
  }
  return svg;
}
function connectorEnds(a, b) {
  const center = c => [c.x + c.w / 2, c.y + c.h / 2];
  const clip = (toward, rect) => {
    const c = center(rect);
    const dx = toward[0] - c[0], dy = toward[1] - c[1];
    if (!dx && !dy) return c;
    const sx = dx ? (rect.w / 2) / Math.abs(dx) : Infinity, sy = dy ? (rect.h / 2) / Math.abs(dy) : Infinity;
    const s = Math.min(1, sx, sy);
    return [c[0] + dx * s, c[1] + dy * s];
  };
  return [clip(center(b), a), clip(center(a), b)];
}
function openDrawLink(link) {
  if (link.isFolder) { if (folderById(link.id)) go({ view: "folder", id: link.id }, null); else toast("Ordner ist nicht verfügbar"); }
  else if (noteById(link.id)) openNote(link.id); else toast("Notiz ist nicht verfügbar");
}
/** Zeichnung als PNG/SVG herunterladen */
async function exportDrawing(content, name, asPng) {
  const svg = drawingSvg(content, { crop: true, svgText: true });
  if (!svg) return;
  const W = 2000, H = Math.round(W * Number(svg.dataset.h) / Number(svg.dataset.w));
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.style.color = inkColor();
  const bg = sv("rect", { x: svg.viewBox.baseVal.x, y: svg.viewBox.baseVal.y, width: "100%", height: "100%", fill: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#2d2e30" });
  bg.setAttribute("width", svg.dataset.w); bg.setAttribute("height", svg.dataset.h);
  svg.insertBefore(bg, svg.firstChild);
  // CSS-Variablen in feste Farben umwandeln (für eine eigenständige Datei)
  const cs = getComputedStyle(document.documentElement);
  let xml = new XMLSerializer().serializeToString(svg)
    .replace(/var\(--surface\)/g, cs.getPropertyValue("--surface").trim() || "#2d2e30")
    .replace(/var\(--link\)/g, cs.getPropertyValue("--link").trim() || "#8ab4f8")
    .replace(/currentColor/g, inkColor());
  if (!asPng) { downloadBlob(new Blob([xml], { type: "image/svg+xml" }), safeFileName(name) + ".svg"); return; }
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = h("canvas", { width: W, height: H });
    canvas.getContext("2d").drawImage(img, 0, 0, W, H);
    canvas.toBlob(blob => blob && downloadBlob(blob, safeFileName(name) + ".png"), "image/png");
  } catch (e) {
    toast("PNG nicht möglich – lade SVG", { bad: true });
    downloadBlob(new Blob([xml], { type: "image/svg+xml" }), safeFileName(name) + ".svg");
  } finally { URL.revokeObjectURL(url); }
}

// =====================================================================
// Bilder: einzeln verschlüsselt im Drive (img_….webp.enc) – nur bei Bedarf laden
// =====================================================================
let imgActive = 0;
const imgQueue = [];
function loadImage(name) {
  if (S.images.has(name)) return S.images.get(name);
  const p = new Promise((resolve, reject) => {
    imgQueue.push(async () => {
      try {
        let blob;
        if (DEMO) blob = await window.MyNotesDemo.image(name);
        else {
          const f = S.files.get(name + ".enc");
          if (!f) throw new Error("Bild ist noch nicht im Drive (Handy lädt es beim nächsten Abgleich hoch)");
          const bytes = await decryptBytes(await downloadFile(f.id), S.key);
          blob = new Blob([bytes], { type: name.endsWith(".png") ? "image/png" : name.endsWith(".jpg") ? "image/jpeg" : "image/webp" });
        }
        resolve(URL.createObjectURL(blob));
      } catch (e) { S.images.delete(name); reject(e); }
    });
    pumpImages();
  });
  S.images.set(name, p);
  return p;
}
function pumpImages() {
  while (imgActive < 3 && imgQueue.length) {
    const job = imgQueue.shift();
    imgActive++;
    job().finally(() => { imgActive--; pumpImages(); });
  }
}
function clearImages() {
  for (const p of S.images.values()) p.then(url => URL.revokeObjectURL(url)).catch(() => {});
  S.images.clear();
}
const lazyObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazyObserver.unobserve(e.target);
    e.target._load && e.target._load();
  }
}, { rootMargin: "300px" }) : null;
function lazy(el, load) {
  el._load = load;
  if (lazyObserver) lazyObserver.observe(el); else load();
  return el;
}
function imageEl(name, { thumb = false, onOpen = null } = {}) {
  const box = h("div", { class: thumb ? "card-thumb" : "b-image" },
    h("div", { class: "ph" }, h("span", { class: "spinner" }), thumb ? null : "Bild wird entschlüsselt …"));
  lazy(box, () => {
    loadImage(name).then(url => {
      const img = h("img", { src: url, alt: "Bild", loading: "lazy", decoding: "async" });
      replace(box, img);
      if (onOpen) box.addEventListener("click", e => { e.stopPropagation(); onOpen(url); });
    }).catch(err => {
      replace(box, h("div", { class: "ph" }, icon("image"), thumb ? null : err.message));
    });
  });
  return box;
}
// =====================================================================
// Blöcke einer Notiz anzeigen
// =====================================================================
const PRIO = { 1: ["p1", "!", "Niedrige Priorität"], 2: ["p2", "!!", "Mittlere Priorität"], 3: ["p3", "!!!", "Hohe Priorität"] };

/**
 * opts: { ts: Suchbegriffe, note, tools: Kopier-Knöpfe zeigen, preview: (PC-Vorschau, keine Aktionen) }
 * Überschriften lassen sich einklappen (alles bis zur nächsten Überschrift).
 */
function renderBlocks(blocks, opts = {}) {
  const root = h("div", { class: "blocks" });
  let hiddenDone = 0;
  // GEÄNDERT (AO): Überschriften mit Ebenen – ein Abschnitt reicht bis zur nächsten Überschrift
  // gleicher oder höherer Ebene; tiefere Überschriften liegen IM Abschnitt (klappen mit ein).
  const stack = []; // offene Abschnitte { level, body, info }
  const target = () => stack.length ? stack[stack.length - 1].body : root;
  for (const b of blocks) {
    if (b.type === "HEADING") {
      const level = b.level || headingLevel(b);
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop().info.apply();
      const wasCollapsed = b.id != null && S.collapsed.has(b.id) ? !!S.collapsed.get(b.id) : !!(b.collapsed && !opts.preview);
      const body = h("div", { class: "section-body lv" + level });
      const toggle = h("button", { class: "tree-toggle" + (wasCollapsed ? "" : " open"), title: "Ein-/Ausklappen", type: "button" }, icon("chevron", "sm"));
      const count = h("span", { class: "hidden-count" });
      const head = h("div", { class: "b-heading lv" + level }, toggle, h(level === 1 ? "h2" : level === 2 ? "h3" : "h4", null, inline(b.content, opts.ts), " ", count));
      const blk = wrapBlock(b, head, opts);
      stack.forEach(x => x.info.n++);
      target().appendChild(blk);
      target().appendChild(body);
      const info = { body, toggle, count, collapsed: wasCollapsed, n: 0 };
      const apply = () => {
        body.classList.toggle("collapsed", info.collapsed);
        toggle.classList.toggle("open", !info.collapsed);
        count.textContent = info.collapsed && info.n ? `(${info.n} ausgeblendet)` : "";
      };
      toggle.onclick = () => { info.collapsed = !info.collapsed; if (b.id != null) S.collapsed.set(b.id, info.collapsed); apply(); };
      info.apply = apply;
      stack.push({ level, body, info });
      continue;
    }
    if (b.type === "CHECKLIST_ITEM" && b.checked && S.settings.hideDone && !opts.preview) { hiddenDone++; continue; }
    const el = renderBlock(b, opts);
    if (!el) continue;
    target().appendChild(el);
    stack.forEach(x => x.info.n++);
  }
  while (stack.length) stack.pop().info.apply();
  if (hiddenDone) {
    root.appendChild(h("button", {
      class: "chip", style: { marginTop: "10px", alignSelf: "flex-start" },
      onclick: () => { S.settings.hideDone = false; saveSettingsSoon(); renderMain(); }
    }, icon("eye", "sm"), plural(hiddenDone, "erledigter Punkt ausgeblendet", "erledigte Punkte ausgeblendet"), " – anzeigen"));
  }
  return root;
}

function wrapBlock(b, inner, opts, copy) {
  const el = h("div", { class: "blk" + (b.pendingEdit ? " pending-edit" : ""), id: b.id != null ? "b" + b.id : null });
  if (b.pendingEdit) el.title = "Am PC geändert – wartet aufs Handy";
  const hl = highlightColor(b.highlight);
  if (hl) { el.classList.add("hlbg"); el.style.setProperty("--hl", hl); }
  el.appendChild(inner);
  if (opts.tools && !opts.preview) {
    const tools = h("div", { class: "blk-tools" });
    if (copy) tools.appendChild(iconBtn("copy", copy.title || "Kopieren", e => { e.stopPropagation(); copyText(copy.text(), copy.done || "Kopiert"); }, "sm"));
    if (opts.note && typeof b.id === "number" && ["HEADING", "TEXT", "CHECKLIST_ITEM", "TABLE", "CODE", "CALC"].includes(b.type)) {
      tools.appendChild(iconBtn("link", "Link auf diese Stelle kopieren (für „Vom PC“)", e => {
        e.stopPropagation();
        const section = readable(b.content).split("\n").find(l => l.trim()) || "";
        const label = (opts.note.title || "Notiz") + (section ? " › " + (section.length > 40 ? section.slice(0, 39).trim() + "…" : section.trim()) : "");
        copyText(linkMarkup(label, opts.note.id, b.id), "Link kopiert – in „Vom PC“ einfügen");
      }, "sm"));
    }
    if (tools.childNodes.length) el.appendChild(tools);
  }
  return el;
}

function renderBlock(b, opts) {
  const ts = opts.ts;
  switch (b.type) {
    case "TEXT": {
      const div = h("div", { class: "b-text" }, inline(b.content, ts));
      return wrapBlock(b, div, opts, b.content.trim() ? { text: () => readable(b.content), title: "Text kopieren" } : null);
    }
    case "CHECKLIST_ITEM": {
      const prio = PRIO[b.priority];
      // NEU (AH-3): am PC abhaken → wird beim nächsten Abgleich am Handy übernommen
      const live = !opts.preview && typeof b.id === "number" && canCheckFromPc(opts.note) && !b.pendingEdit;
      const pending = live ? pendingCheck(b.id) : null;
      const checked = pending ? pending.checked : b.checked;
      const box = h(live ? "button" : "span", {
        class: "box" + (live ? " live" : ""), role: "checkbox", "aria-checked": String(checked), type: live ? "button" : null,
        title: live ? (checked ? "Haken entfernen (wird am Handy übernommen)" : "Abhaken (wird am Handy übernommen)") : null
      });
      const row = h("div", { class: "b-check" + (checked ? " done" : "") + (pending ? " pending" : "") },
        box,
        h("div", { class: "txt" }, prio ? h("span", { class: "prio " + prio[0], title: prio[2] }, prio[1]) : null, inline(b.content, ts),
          pending ? h("span", { class: "pending-tag", title: "Wartet auf das Handy" }, icon("phone", "sm"), "→ Handy") : null));
      const el = wrapBlock(b, row, opts, { text: () => readable(b.content), title: "Punkt kopieren" });
      if (live) box.addEventListener("click", e => {
        e.stopPropagation();
        toggleCheckFromPc(b);
        el.replaceWith(renderBlock(b, opts));
      });
      return el;
    }
    case "CODE": {
      const pre = h("pre", null, h("code", null));
      appendMarked(pre.firstChild, b.content, ts);
      return wrapBlock(b, h("div", { class: "b-code" }, pre), opts, { text: () => b.content, title: "Code kopieren", done: "Code kopiert" });
    }
    case "DIVIDER":
      return wrapBlock(b, h("hr", { class: "b-divider" }), { ...opts, tools: false });
    case "TABLE": {
      const rows = parseTable(b.content);
      if (!rows.length) return null;
      const width = Math.max(...rows.map(r => r.length));
      const table = h("table", { class: "b-table" });
      rows.forEach((r, i) => {
        const tr = h("tr");
        for (let c = 0; c < width; c++) {
          const cell = h(i === 0 ? "th" : "td");
          cell.appendChild(inline((r[c] || "").trim(), ts));
          tr.appendChild(cell);
        }
        table.appendChild(tr);
      });
      const wrap = h("div", { class: "b-table-wrap" }, table);
      const el = wrapBlock(b, wrap, opts, { text: () => tableTsv(b.content), title: "Tabelle kopieren (für Excel/Sheets)", done: "Tabelle kopiert – in Excel einfügen" });
      if (opts.tools && !opts.preview) {
        $(".blk-tools", el)?.appendChild(iconBtn("download", "Als CSV herunterladen", e => {
          e.stopPropagation();
          downloadBlob(new Blob([tableCsv(b.content)], { type: "text/csv;charset=utf-8" }), safeFileName(opts.note?.title || "Tabelle") + ".csv");
        }, "sm"));
      }
      return el;
    }
    case "CALC": {
      const lines = calcLines(b);
      const hasResults = !!S.extras.calc[b.id];
      const box = h("div", { class: "b-calc" });
      for (const l of lines) {
        if (!l.src.trim()) { box.appendChild(h("div", { class: "calc-row blank" })); continue; }
        const src = h("div", { class: "src" });
        appendMarked(src, l.src, ts);
        box.appendChild(h("div", { class: "calc-row" + (l.agg ? " agg" : "") + (l.head ? " head" : "") },
          src, l.err ? h("div", { class: "err", title: l.err }, "⚠ " + l.err) : h("div", { class: "res" }, l.res ? "= " + l.res : "")));
      }
      if (!hasResults && b.content.trim()) box.appendChild(h("div", { class: "calc-foot" }, h("span", { class: "small muted" }, "Ergebnisse kommen mit dem nächsten Abgleich vom Handy")));
      return wrapBlock(b, box, opts, {
        text: () => lines.map(l => l.res ? `${l.src} = ${l.res}` : l.src).join("\n"), title: "Rechnung mit Ergebnissen kopieren"
      });
    }
    case "DRAWING": {
      const svg = drawingSvg(b.content, { crop: true, onLink: opts.preview ? null : openDrawLink });
      if (!svg) return null;
      const box = h("div", { class: "b-drawing", title: "Groß anzeigen" }, svg);
      box.addEventListener("click", () => openLightbox({ svg: () => drawingSvg(b.content, { crop: true, onLink: l => { closeLightbox(); openDrawLink(l); } }), name: (opts.note?.title || "Zeichnung"), drawing: b.content }));
      const el = wrapBlock(b, box, opts);
      if (opts.tools && !opts.preview) {
        const tools = $(".blk-tools", el) || el.appendChild(h("div", { class: "blk-tools" }));
        tools.appendChild(iconBtn("download", "Als PNG herunterladen", e => { e.stopPropagation(); exportDrawing(b.content, opts.note?.title || "Zeichnung", true); }, "sm"));
        const texts = drawingTexts(b.content);
        if (texts.length) tools.appendChild(iconBtn("copy", "Texte der Karten kopieren", e => { e.stopPropagation(); copyText(texts.join("\n")); }, "sm"));
      }
      return el;
    }
    case "IMAGE": {
      if (!b.content) return null;
      const box = imageEl(b.content, { onOpen: url => openLightbox({ img: url, name: (opts.note?.title || "Bild") }) });
      return wrapBlock(b, box, opts);
    }
    case "PROFILE": {
      // GEÄNDERT (AN): wie am Handy – Kopf mit Farbe, Gruppen, IBAN verdeckt bis „Anzeigen“
      const fields = parseProfile(b.content);
      const name = (fields.find(f => f.l.toLowerCase() === "name") || {}).v || "";
      const subtitle = fields.filter(f => PROFILE_SUB.has(f.l.trim().toLowerCase()) && f.v.trim()).map(f => f.v.trim()).join(" · ");
      const rest = fields.filter(f => f.v.trim() && f.l.toLowerCase() !== "name" && !PROFILE_SUB.has(f.l.trim().toLowerCase()));
      let reveal = false;
      const card = h("div", { class: "b-profile" },
        h("div", { class: "profile-head" }, h("div", { class: "avatar" }, initials(name)),
          h("div", { class: "grow" }, h("h3", null, name || "Steckbrief"),
            h("div", { class: "small muted" }, subtitle || "Zeile anklicken = kopieren"))));
      const groups = new Map();
      for (const f of rest) { const g = profileGroup(f.l); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(f); }
      const valueEls = [];
      for (const g of PROFILE_GROUPS) {
        const list = groups.get(g);
        if (!list) continue;
        const hasSecret = list.some(f => profileSecret(f.l));
        const head = h("div", { class: "profile-group" }, h("span", { class: "grow" }, g));
        if (hasSecret) head.appendChild(h("button", {
          class: "btn subtle small", type: "button", onclick: e => {
            e.stopPropagation(); reveal = !reveal;
            valueEls.forEach(x => { x.el.textContent = profileDisplay(x.f, reveal); });
            e.currentTarget.textContent = reveal ? "Verbergen" : "Anzeigen";
          }
        }, "Anzeigen"));
        card.appendChild(head);
        for (const f of list) {
          const v = h("div", { class: "v" + (profileIsIban(f.l) ? " mono" : "") });
          if (profileSecret(f.l) || profileIsIban(f.l)) { v.textContent = profileDisplay(f, false); valueEls.push({ el: v, f }); }
          else appendMarked(v, profileDisplay(f, true), ts);
          const copyVal = profileIsIban(f.l) ? f.v.replace(/\s/g, "").toUpperCase() : f.v.trim();
          card.appendChild(h("div", { class: "profile-row", title: "„" + f.l + "“ kopieren", onclick: () => copyText(copyVal, "„" + f.l + "“ kopiert") },
            h("div", { class: "l" }, f.l), v, h("span", { class: "copy" }, icon("copy", "sm"))));
        }
      }
      const el = wrapBlock(b, card, opts, { text: () => fields.filter(f => f.v).map(f => f.l + ": " + f.v).join("\n"), title: "Alles kopieren" });
      if (opts.tools && !opts.preview) {
        $(".blk-tools", el)?.appendChild(iconBtn("person", "Als Kontakt (vCard) herunterladen", e => {
          e.stopPropagation();
          downloadBlob(new Blob([vCard(fields)], { type: "text/vcard;charset=utf-8" }), safeFileName(name || "Kontakt") + ".vcf");
        }, "sm"));
      }
      return el;
    }
    case "WORKTIME": {
      const w = S.extras.work[b.id];
      const box = h("div", { class: "b-work" },
        h("div", { class: "sum" }, w ? w.summary : "⏱ Arbeitszeit"),
        w ? h("ul", null, w.lines.map(l => h("li", null, l))) : h("div", { class: "small muted" }, "Die Auswertung kommt mit dem nächsten Abgleich vom Handy."));
      return wrapBlock(b, box, opts, w ? { text: () => [w.summary, ...w.lines].join("\n"), title: "Arbeitszeit kopieren" } : null);
    }
    case "PROJECT": {
      const pageBlocks = opts.pageBlocks || [];
      const phases = notePhases(pageBlocks);
      const tasks = phases.flatMap(p => p.tasks);
      const done = tasks.filter(t => t.checked).length;
      const cur = phases.find(p => p.tasks.some(t => !t.checked));
      const box = h("div", { class: "b-project" },
        h("h4", null, "📋 Projekt · " + (tasks.length ? `${done}/${tasks.length} erledigt · ${Math.round(done * 100 / tasks.length)} %` : "noch keine Aufgaben")),
        h("div", { class: "progress big" }, h("div", { style: { width: (tasks.length ? done * 100 / tasks.length : 0) + "%" } })));
      const list = h("div", { style: { marginTop: "10px" } });
      for (const p of phases) {
        list.appendChild(h("div", { class: "phase-row" + (p === cur ? " cur" : "") + (p.complete ? " complete" : "") },
          h("button", {
            class: "link name", style: { color: "var(--text)", textAlign: "left" },
            onclick: () => p.heading && scrollToBlock(p.heading.id)
          }, (p === cur ? "▶ " : "") + p.name),
          h("div", { class: "progress" }, h("div", { style: { width: p.progress * 100 + "%" } })),
          h("div", { class: "pct" }, p.total ? `${p.done}/${p.total}` : "–")));
      }
      box.appendChild(list);
      return wrapBlock(b, box, opts);
    }
    case "TIMETABLE": // NEU (AZ)
      return wrapBlock(b, timetableEl(b.content), opts, { text: () => timetableText(b.content), title: "Stundenplan als Text kopieren" });
    default:
      return wrapBlock(b, h("div", { class: "unknown-block" }, "Dieser Inhalt („" + b.type + "“) wird am PC noch nicht angezeigt."), opts);
  }
}

function vCard(fields) {
  const esc = s => s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  const name = (fields.find(f => f.l.toLowerCase() === "name") || {}).v || "";
  const out = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + esc(name)];
  const last = name.includes(" ") ? name.slice(name.lastIndexOf(" ") + 1) : name;
  const first = name.includes(" ") ? name.slice(0, name.lastIndexOf(" ")) : "";
  out.push(`N:${esc(last)};${esc(first)};;;`);
  for (const f of fields.filter(f => f.v.trim())) {
    switch (f.l.toLowerCase()) {
      case "e-mail": case "email": case "mail": out.push("EMAIL:" + esc(f.v)); break;
      case "telefon": case "handy": case "mobil": out.push("TEL:" + esc(f.v)); break;
      case "anschrift": case "adresse": out.push("ADR:;;" + esc(f.v) + ";;;;"); break;
      case "webseite": case "website": case "homepage": out.push("URL:" + esc(f.v)); break;
      case "geburtstag": out.push("NOTE:Geburtstag " + esc(f.v)); break;
      case "name": break;
      default: out.push("NOTE:" + esc(f.l) + ": " + esc(f.v));
    }
  }
  out.push("END:VCARD");
  return out.join("\r\n") + "\r\n";
}

// =====================================================================
// Karten in Listen
// =====================================================================
function noteCard(note, opts = {}) {
  note = effectiveNote(note); // NEU (AS): offene Änderungen vom PC auch in der Vorschau
  const card = h("div", {
    class: "card" + (note.color ? " colored" : "") + (S.noteId === note.id ? " on" : ""),
    tabindex: "0", role: "button", dataset: { note: String(note.id) },
    // GEÄNDERT (AT): Strg/⌘-Klick oder Mittelklick = daneben öffnen, Rechtsklick = Menü
    onclick: e => { if (e.ctrlKey || e.metaKey) openSplit(note.id); else openNote(note.id, { ts: opts.ts }); },
    onauxclick: e => { if (e.button === 1) { e.preventDefault(); openSplit(note.id); } },
    oncontextmenu: e => noteContextMenu(e, note),
    onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); if (e.ctrlKey || e.metaKey) openSplit(note.id); else openNote(note.id, { ts: opts.ts }); } }
  });
  if (note.color) card.style.setProperty("--note-color", note.color);
  const title = h("div", { class: "card-title" },
    S.fresh.has(note.id) ? h("span", { class: "fresh", title: "Seit dem Öffnen geändert" }) : null,
    h("span", { class: "t" + (note.title.trim() ? "" : " muted") }));
  appendMarked(title.lastChild, note.title.trim() || "Ohne Titel", opts.ts);
  if (note.favorite) title.appendChild(h("span", { class: "star", title: "Favorit" }, icon("star", "sm")));
  card.appendChild(title);

  if (opts.ts && opts.ts.length) {
    const sn = snippets(note, opts.ts, 2);
    if (sn.length) {
      const box = h("div", { class: "snippet" });
      for (const s of sn) { const d = h("div"); appendMarked(d, s.text, opts.ts); box.appendChild(d); }
      card.appendChild(box);
    }
  } else {
    const prev = cardPreview(note, opts.tile ? 9 : 4, opts.tile);
    if (prev) card.appendChild(prev);
  }

  // Zeile mit Angaben
  const meta = h("div", { class: "card-meta" });
  const st = checklistStats(note);
  if (opts.showFolder && note.folderIds.length) {
    const f = folderById(note.folderIds[0]);
    if (f) meta.appendChild(h("span", null, icon("folder"), f.name + (note.folderIds.length > 1 ? " +" + (note.folderIds.length - 1) : "")));
  }
  if (note.reminder) {
    const over = note.reminder < Date.now() && !note.reminderRepeat;
    meta.appendChild(h("span", { class: over ? "chip danger" : "", style: over ? null : null, title: reminderText(note) }, icon("bell"), relDay(note.reminder, note.reminderHasTime)));
  }
  if (st.total) meta.appendChild(h("span", { title: "Checkliste" }, icon("checkbox"), `${st.done}/${st.total}`));
  if (note.pages && note.pages.length > 1) meta.appendChild(h("span", null, icon("note"), note.pages.length + " Seiten"));
  meta.appendChild(h("span", { title: "Geändert " + fullTime(note.modifiedAt) }, relTime(note.modifiedAt)));
  card.appendChild(meta);
  if (note.labelIds.length) {
    const labels = h("div", { class: "card-labels" });
    for (const id of note.labelIds) {
      const l = S.db.labels.get(id);
      if (l) labels.appendChild(h("span", { class: "chip" }, l.color ? h("span", { class: "dot", style: { background: l.color } }) : null, l.name));
    }
    card.appendChild(labels);
  }
  if (opts.project) {
    const p = opts.project;
    card.appendChild(h("div", { class: "progress" }, h("div", { style: { width: Math.round(p.progress * 100) + "%" } })));
    if (p.complete) card.classList.add("complete");
  }
  return card;
}
function relDay(t, withTime) {
  const dd = dayDiff(t);
  const base = dd === 0 ? "Heute" : dd === 1 ? "Morgen" : dd === -1 ? "Gestern" : fmtDateShort.format(t);
  return withTime ? base + " " + fmtTime.format(t) : base;
}
function cardPreview(note, budget, tile) {
  const blocks = note.pages ? blocksOfPage(note, 0) : note.blocks;
  const box = h("div", { class: "card-prev" });
  let lines = 0, checks = 0, moreChecks = 0, thumb = null;
  for (const b of blocks) {
    if (lines >= budget) { if (b.type === "CHECKLIST_ITEM") moreChecks++; continue; }
    switch (b.type) {
      case "TEXT": {
        const t = readable(b.content).trim();
        if (!t) break;
        box.appendChild(h("div", { class: "ln" }, t));
        lines += Math.min(3, t.split("\n").length);
        break;
      }
      case "HEADING": if (b.content.trim()) { box.appendChild(h("div", { class: "ln h" }, readable(b.content))); lines++; } break;
      case "CHECKLIST_ITEM":
        if (!b.content.trim()) break;
        if (checks >= (tile ? 8 : 4)) { moreChecks++; break; }
        box.appendChild(h("div", { class: "ck" + (b.checked ? " done" : "") }, h("span", { class: "box" }), h("span", null, readable(b.content))));
        checks++; lines++;
        break;
      case "CODE": if (b.content.trim()) { box.appendChild(h("div", { class: "ln", style: { fontFamily: "var(--mono)", fontSize: ".82rem" } }, b.content.split("\n").slice(0, 3).join("\n"))); lines += 2; } break;
      case "TABLE": { const r = parseTable(b.content); if (r.length) { box.appendChild(h("div", { class: "ln" }, "▦ Tabelle · " + r.length + " Zeilen")); lines++; } break; }
      case "CALC": {
        const l = calcLines(b).find(x => x.res && x.agg) || calcLines(b).find(x => x.res);
        box.appendChild(h("div", { class: "ln" }, "🧮 " + (l ? (l.src.trim() ? l.src.trim() + " = " : "") + l.res : "Rechnung")));
        lines++;
        break;
      }
      case "PROFILE": {
        const f = parseProfile(b.content).filter(x => x.v);
        if (f.length) { box.appendChild(h("div", { class: "ln" }, f.slice(0, 3).map(x => x.l.toLowerCase() === "name" ? "🪪 " + x.v : x.l + ": " + x.v).join("\n"))); lines += 2; }
        break;
      }
      case "WORKTIME": { const w = S.extras.work[b.id]; box.appendChild(h("div", { class: "ln" }, w ? w.summary : "⏱ Arbeitszeit")); lines++; break; }
      case "PROJECT": box.appendChild(h("div", { class: "ln" }, projectSummaryText(note, b.page))); lines++; break;
      case "TIMETABLE": box.appendChild(h("div", { class: "ln" }, timetableSummary(b.content))); lines++; break; // NEU (AZ)
      case "DRAWING": if (!thumb && b.content.trim()) thumb = { type: "d", b }; break;
      case "IMAGE": if (!thumb && b.content) thumb = { type: "i", b }; break;
    }
  }
  if (moreChecks) box.appendChild(h("div", { class: "more" }, "+ " + plural(moreChecks, "weiterer Punkt", "weitere Punkte")));
  const frag = document.createDocumentFragment();
  if (box.childNodes.length) frag.appendChild(box);
  if (thumb) {
    if (thumb.type === "d") {
      const svg = drawingSvg(thumb.b.content, { crop: true });
      if (svg) frag.appendChild(h("div", { class: "card-thumb" }, svg));
    } else frag.appendChild(imageEl(thumb.b.content, { thumb: true }));
  }
  return frag.childNodes.length ? frag : null;
}
function folderCard(folder, linked = false) {
  const sub = [];
  if (folder.children.length) sub.push(plural(folder.children.length, "Unterordner", "Unterordner"));
  sub.push(plural(folderTotal(folder), "Notiz", "Notizen")); // GEÄNDERT (AM): inkl. Unterordner
  let progress = null;
  if (folder.project) {
    const pb = projectBoard(folder);
    sub.unshift(`Projekt · ${pb.done}/${pb.total} · ${Math.round(pb.progress * 100)} %`);
    progress = pb.progress;
  }
  return h("div", {
    class: "card folder-card", tabindex: "0", role: "button",
    onclick: () => go({ view: "folder", id: folder.id }, null),
    onkeydown: e => { if (e.key === "Enter") go({ view: "folder", id: folder.id }, null); }
  },
  h("span", { style: { color: folder.color || "var(--muted)" } }, icon(folder.project ? "project" : "folder")),
  h("div", { class: "grow" }, h("div", { class: "ellipsis", style: { fontWeight: 600 } }, folder.name,
    linked ? h("span", { title: "Wird hier zusätzlich gezeigt", style: { marginLeft: "6px", color: "var(--muted)" } }, icon("link", "sm")) : null),
  h("div", { class: "sub" }, sub.join(" · ")),
    progress != null ? h("div", { class: "progress" }, h("div", { style: { width: Math.round(progress * 100) + "%" } })) : null),
  icon("chevron", "sm"));
}


// ---------------------------------------------------------------------
// NEU (AN): Steckbrief-Hilfen (wie Profile in ProfileBlock.kt)
// ---------------------------------------------------------------------
const PROFILE_SUB = new Set(["beruf", "rolle", "firma", "position"]);
const PROFILE_GROUPS = ["Persönlich", "Kontakt", "Adresse", "Nummern & Konten", "Weiteres"];
function profileKey(l) { return String(l || "").trim().toLowerCase(); }
function profileIsIban(l) { return profileKey(l).includes("iban"); }
function profileSecret(l) { const k = profileKey(l); return ["iban", "konto", "pin", "passwort", "steuer", "ausweis"].some(x => k.includes(x)); }
function profileGroup(l) {
  const k = profileKey(l);
  if (["e-mail", "email", "mail", "telefon", "handy", "mobil", "festnetz", "webseite", "website", "homepage"].includes(k)) return "Kontakt";
  if (["anschrift", "adresse"].includes(k)) return "Adresse";
  if (profileSecret(l) || k.includes("nummer") || k.endsWith("-id")) return "Nummern & Konten";
  if (["geburtstag", "geburtsdatum"].includes(k) || PROFILE_SUB.has(k)) return "Persönlich";
  return "Weiteres";
}
function profileDisplay(f, reveal) {
  const v = f.v.trim();
  if (profileIsIban(f.l)) {
    const c = v.replace(/\s/g, "").toUpperCase();
    const grouped = c.replace(/(.{4})/g, "$1 ").trim();
    return reveal || c.length < 8 ? grouped : c.slice(0, 4) + " •••• •••• " + c.slice(-4);
  }
  if (profileSecret(f.l) && !reveal) return "•".repeat(Math.min(12, Math.max(4, v.length)));
  const k = profileKey(f.l);
  if (k === "geburtstag" || k === "geburtsdatum") {
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]), now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
      return v + " · " + age + " Jahre";
    }
  }
  return v;
}
// =====================================================================
// GEÄNDERT (AZ): Stundenplan – Format wie Timetable.kt am Handy
// v2: {"v":2,"days":[1..7],"slots":[{s:"07:45",e:"10:50",l:"",b:[["09:15","09:30"]]}],"ab":bool,"aMon":"2026-10-12","home":bool,
//      "entries":[{id,t,c (ARGB-Zahl),days:[1,3,5],from:"07:45",to:"14:30",who,room,tag,w ("",A,B),info}]}
// v1 (1.3): Einträge hingen an Zeitblock-Nummern (d, s, n) → werden beim Lesen umgewandelt
//   (Uhrzeiten aus dem Raster, gleiche Einträge an mehreren Tagen zusammengefasst, „Pause 9:15–9:30“ → echte Pause).
// Intern sind Uhrzeiten Minuten seit Mitternacht.
// =====================================================================
const TT_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TT_DAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function ttMin(hm) {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(String(hm ?? ""));
  if (!m) return NaN;
  const h = Number(m[1]), mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : NaN;
}
/** Minuten → „7:45“ */
function ttFmt(min) { return Math.floor(min / 60) + ":" + String(min % 60).padStart(2, "0"); }
function ttColor(argb) { return "#" + (Number(argb) & 0xFFFFFF).toString(16).padStart(6, "0"); }
function ttMonday(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function ttBreaksInText(text) {
  const out = [];
  const re = /(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/g;
  let m;
  while ((m = re.exec(text || ""))) { const s = ttMin(m[1]), e = ttMin(m[2]); if (e > s) out.push({ s, e }); }
  return out;
}

function timetableParse(content) {
  let j = {};
  try { j = content && content.trim() ? JSON.parse(content) : {}; } catch (_) { j = {}; }
  if (!j || typeof j !== "object") j = {};
  const slots = (j.slots || []).filter(x => x && x.s && x.e).map(x => {
    const b = Array.isArray(x.b) ? x.b.filter(p => Array.isArray(p)).map(p => ({ s: ttMin(p[0]), e: ttMin(p[1]) })).filter(p => p.e > p.s) : [];
    const fromLabel = b.length ? [] : ttBreaksInText(x.l || "");
    return { s: ttMin(x.s), e: ttMin(x.e), l: fromLabel.length ? "" : (x.l || ""), b: b.concat(fromLabel) };
  }).filter(sl => sl.e > sl.s);
  const days = (j.days || [1, 2, 3, 4, 5]).filter(d => d >= 1 && d <= 7).sort((a, b) => a - b);
  const base = e => ({
    id: String(e.id || Math.random().toString(36).slice(2, 10)), t: e.t || "", c: Number(e.c) || 0xFFA8EFEA,
    who: e.who || "", room: e.room || "", tag: e.tag || "", w: e.w || "", info: e.info || ""
  });
  let entries;
  if ((j.v || 1) < 2) {
    const single = (j.entries || []).filter(e => e && e.id).map(e => {
      const s = e.s || 0, n = Math.max(1, e.n || 1), d = e.d || 1;
      if (s >= slots.length || d < 1 || d > 7) return null;
      const last = Math.min(s + n - 1, slots.length - 1);
      return { ...base(e), days: [d], from: slots[s].s, to: slots[last].e };
    }).filter(Boolean);
    const merged = new Map();
    for (const e of single) {
      const key = JSON.stringify([e.t, e.c, e.from, e.to, e.who, e.room, e.tag, e.w, e.info]);
      const known = merged.get(key);
      if (known) known.days = [...new Set(known.days.concat(e.days))].sort((a, b) => a - b);
      else merged.set(key, e);
    }
    entries = [...merged.values()];
  } else {
    entries = (j.entries || []).filter(e => e && e.from && e.to).map(e => ({
      ...base(e),
      days: [...new Set((e.days || []).filter(d => d >= 1 && d <= 7))].sort((a, b) => a - b),
      from: ttMin(e.from), to: ttMin(e.to)
    })).filter(e => e.days.length && e.to > e.from);
  }
  return { days: days.length ? days : [1, 2, 3, 4, 5], slots, ab: !!j.ab, aMon: j.aMon || null, home: j.home !== false, entries };
}
/** "A"/"B" für diese Woche – null, wenn A/B aus */
function ttWeekOf(tt, date = new Date()) {
  if (!tt.ab) return null;
  if (!tt.aMon) return "A";
  const ref = new Date(tt.aMon + "T00:00:00");
  const weeks = Math.round((ttMonday(date) - ttMonday(ref)) / (7 * 86_400_000));
  return ((weeks % 2) + 2) % 2 === 0 ? "A" : "B";
}
/** Einträge eines Tages (week null = alle Wochen), nach Beginn sortiert */
function ttEntriesOn(tt, day, week) {
  return tt.entries.filter(e => e.days.includes(day) && (week == null || !e.w || e.w === week))
    .sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from));
}
/** Sichtbarer Bereich in Minuten (volle Stunden, mindestens 8–16 Uhr) */
function ttRange(tt) {
  const starts = tt.slots.map(s => s.s).concat(tt.entries.map(e => e.from));
  const ends = tt.slots.map(s => s.e).concat(tt.entries.map(e => e.to));
  const from = Math.min(8, Math.floor((starts.length ? Math.min(...starts) : 480) / 60));
  const to = Math.min(24, Math.max(16, Math.ceil((ends.length ? Math.max(...ends) : 960) / 60)));
  return [from * 60, to * 60];
}
/**
 * Ebenen wie am Handy: Ein Eintrag, der einen anderen ganz umschließt und mindestens doppelt so lang ist,
 * wird Hintergrund (z. B. Arbeit). Sonst stehen Überschneidungen nebeneinander.
 * → id → { lane, lanes, bg, over }
 */
function ttLayout(dayEntries) {
  const dur = e => e.to - e.from;
  const encloses = (a, b) => a.id !== b.id && a.from <= b.from && a.to >= b.to && dur(a) >= 2 * dur(b);
  const bgIds = new Set(dayEntries.filter(e => dayEntries.some(o => encloses(e, o))).map(e => e.id));
  const out = new Map();
  const lanesFor = (group, isBg) => {
    const sorted = group.slice().sort((a, b) => a.from - b.from || dur(b) - dur(a) || a.t.localeCompare(b.t));
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      if (!cluster.length) return;
      const ends = [];
      const lane = new Map();
      for (const e of cluster) {
        let i = ends.findIndex(x => x <= e.from);
        if (i < 0) { ends.push(e.to); i = ends.length - 1; } else ends[i] = e.to;
        lane.set(e.id, i);
      }
      for (const e of cluster) {
        const over = !isBg && dayEntries.some(o => bgIds.has(o.id) && o.from < e.to && e.from < o.to);
        // Hintergrund: Name an der ersten freien Stelle (mind. 18 Min.), damit ihn nichts verdeckt
        let label = 0;
        if (isBg) {
          let cursor = e.from;
          for (const f of dayEntries.filter(o => !bgIds.has(o.id) && o.from < e.to && e.from < o.to).sort((a, b) => a.from - b.from)) {
            if (f.from - cursor >= 18) break;
            cursor = Math.max(cursor, f.to);
          }
          label = cursor <= e.to - 15 ? cursor - e.from : 0;
        }
        out.set(e.id, { lane: lane.get(e.id), lanes: ends.length, bg: isBg, over, label });
      }
      cluster = [];
    };
    for (const e of sorted) {
      if (cluster.length && e.from >= clusterEnd) flush();
      cluster.push(e);
      clusterEnd = Math.max(clusterEnd, e.to);
    }
    flush();
  };
  lanesFor(dayEntries.filter(e => bgIds.has(e.id)), true);
  lanesFor(dayEntries.filter(e => !bgIds.has(e.id)), false);
  return out;
}
/** Was läuft gerade / als Nächstes (heute)? Bei mehreren gleichzeitig: der kürzere. */
function ttNowNext(tt, now = new Date()) {
  const day = ((now.getDay() + 6) % 7) + 1;
  const min = now.getHours() * 60 + now.getMinutes();
  const today = ttEntriesOn(tt, day, ttWeekOf(tt, now));
  const current = today.filter(e => e.from <= min && min < e.to).sort((a, b) => (a.to - a.from) - (b.to - b.from))[0] || null;
  const next = today.filter(e => e.from > min).sort((a, b) => a.from - b.from)[0] || null;
  return { current, next };
}
function timetableSummary(content) {
  const tt = timetableParse(content);
  const { current, next } = ttNowNext(tt);
  return ["🗓 Stundenplan · " + plural(tt.entries.length, "Eintrag", "Einträge"),
    current ? "jetzt: " + current.t : null, next ? "danach: " + next.t + " " + ttFmt(next.from) : null].filter(Boolean).join(" · ");
}
function timetableText(content) {
  const tt = timetableParse(content);
  const out = [];
  for (const d of tt.days) {
    const list = ttEntriesOn(tt, d, null);
    if (!list.length) continue;
    out.push(TT_DAYS_LONG[d - 1]);
    for (const e of list) {
      const extra = [e.who, e.room, e.tag, e.w ? "Woche " + e.w : ""].filter(Boolean).join(", ");
      out.push("  " + ttFmt(e.from) + "–" + ttFmt(e.to) + " " + e.t + (extra ? " (" + extra + ")" : ""));
    }
  }
  return out.join("\n") || "🗓 Stundenplan (leer)";
}

/**
 * Wochenansicht wie am Handy: Höhe = Dauer, Zeitraster als Linien (Blockgrenzen kräftig, Pausen schattiert),
 * lange Einträge blass im Hintergrund, gleichzeitige nebeneinander, rote Jetzt-Linie. Nur lesen.
 */
function timetableEl(content) {
  const tt = timetableParse(content);
  const box = h("div", { class: "b-tt" });
  if (!tt.slots.length && !tt.entries.length) {
    box.appendChild(h("div", { class: "muted small" }, "🗓 Stundenplan – noch nicht eingerichtet (am Handy).")); return box;
  }
  const thisWeek = ttWeekOf(tt);
  let week = thisWeek;
  const PX = 1.05; // Pixel pro Minute
  const draw = () => {
    clear(box);
    const now = new Date();
    const { current, next } = ttNowNext(tt, now);
    const head = h("div", { class: "tt-head" }, h("b", null, "🗓 Stundenplan"),
      h("span", { class: "small muted grow" }, [current ? "Jetzt: " + current.t + (current.room ? " (" + current.room + ")" : "") + " bis " + ttFmt(current.to) : null,
        next ? "danach " + ttFmt(next.from) + ": " + next.t : null].filter(Boolean).join(" · ")));
    if (tt.ab) {
      head.appendChild(seg([["A", "Woche A" + (thisWeek === "A" ? " · jetzt" : "")], ["B", "Woche B" + (thisWeek === "B" ? " · jetzt" : "")], ["*", "Alle"]],
        week == null ? "*" : week, v => { week = v === "*" ? null : v; draw(); }));
    }
    box.appendChild(head);
    const [from, to] = ttRange(tt);
    const y = min => ((min - from) * PX).toFixed(1) + "px";
    const monday = ttMonday(now);
    const todayD = ((now.getDay() + 6) % 7) + 1;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const grid = h("div", { class: "tt-grid", vars: { "--tt-days": String(tt.days.length), "--tt-h": ((to - from) * PX).toFixed(0) + "px" } });
    grid.appendChild(h("div", { class: "tt-corner" }));
    tt.days.forEach(d => {
      const date = new Date(monday); date.setDate(monday.getDate() + d - 1);
      grid.appendChild(h("div", { class: "tt-day" + (d === todayD ? " today" : "") }, TT_DAYS[d - 1] + " " + date.getDate() + "."));
    });
    // Zeitspalte: Blockanfang unter der Linie, Blockende darüber, Pausen klein (wie in der Skizze)
    const times = h("div", { class: "tt-times" });
    if (!tt.slots.length) {
      for (let hh = from / 60; hh < to / 60; hh++) times.appendChild(h("span", { class: "tt-tl below", vars: { "--y": y(hh * 60) } }, hh + ":00"));
    }
    tt.slots.forEach(sl => {
      times.appendChild(h("span", { class: "tt-tl below strong", vars: { "--y": y(sl.s) } }, ttFmt(sl.s)));
      times.appendChild(h("span", { class: "tt-tl above", vars: { "--y": y(sl.e) } }, ttFmt(sl.e)));
      sl.b.forEach(b => {
        times.appendChild(h("span", { class: "tt-tl above tiny", vars: { "--y": y(b.s) } }, ttFmt(b.s)));
        times.appendChild(h("span", { class: "tt-tl below tiny", vars: { "--y": y(b.e) } }, ttFmt(b.e)));
      });
    });
    grid.appendChild(times);
    tt.days.forEach(d => {
      const col = h("div", { class: "tt-col" + (d === todayD ? " today" : "") });
      for (let hh = Math.ceil(from / 60); hh <= to / 60; hh++) col.appendChild(h("div", { class: "tt-hour", vars: { "--y": y(hh * 60) } }));
      tt.slots.forEach(sl => {
        sl.b.forEach(b => col.appendChild(h("div", { class: "tt-break", vars: { "--y": y(b.s), "--h": ((b.e - b.s) * PX).toFixed(1) + "px" } })));
        col.appendChild(h("div", { class: "tt-line", vars: { "--y": y(sl.s) } }));
        col.appendChild(h("div", { class: "tt-line", vars: { "--y": y(sl.e) } }));
      });
      const list = ttEntriesOn(tt, d, week);
      const layout = ttLayout(list);
      list.sort((a, b) => (layout.get(a.id)?.bg ? 0 : 1) - (layout.get(b.id)?.bg ? 0 : 1));
      for (const e of list) {
        const p = layout.get(e.id) || { lane: 0, lanes: 1, bg: false, over: false };
        const inset = !p.bg && p.over ? 16 : 0;
        const w = (100 - inset) / p.lanes;
        const bg = ttColor(e.c);
        const running = d === todayD && (!e.w || e.w === thisWeek) && nowMin >= e.from && nowMin < e.to;
        const short = (e.to - e.from) * PX < 46;
        const el = h("div", {
          class: "tt-entry" + (p.bg ? " bg" : isLight(bg) ? "" : " dark") + (p.lanes > 1 ? " multi" : "") + (short ? " short" : "") +
            (running ? " running" : "") + (e.info ? " has-info" : ""), tabindex: "0",
          title: [e.t, ttFmt(e.from) + "–" + ttFmt(e.to), e.who, e.room, e.tag, e.w ? "Woche " + e.w : "", e.info].filter(Boolean).join("\n"),
          vars: {
            "--y": y(e.from), "--h": Math.max(18, (e.to - e.from) * PX).toFixed(1) + "px",
            "--x": (inset + w * p.lane).toFixed(2) + "%", "--w": w.toFixed(2) + "%", "--tt-bg": bg,
            "--label": ((p.label || 0) * PX).toFixed(1) + "px"
          }
        },
        !p.bg && !short && (e.who || e.tag) ? h("span", { class: "top" }, h("span", { class: "who" }, e.who), e.tag ? h("span", { class: "tag" }, e.tag) : null) : null,
        h("span", { class: "t" }, e.t + (e.w ? " (" + e.w + ")" : "")),
        e.room && !short ? h("span", { class: "room" }, e.room) : null);
        col.appendChild(el);
      }
      if (d === todayD && nowMin >= from && nowMin < to) col.appendChild(h("div", { class: "tt-now", vars: { "--y": y(nowMin) } }));
      grid.appendChild(col);
    });
    box.appendChild(h("div", { class: "tt-scroll" }, grid));
  };
  draw();
  return box;
}
// =====================================================================
// Navigation (Adresse enthält nur Nummern – keine Titel, keine Inhalte, keine Suchbegriffe)
// =====================================================================
const VIEWS = {
  home: { title: "Start", icon: "home" },
  all: { title: "Alle Notizen", icon: "note" },
  fav: { title: "Favoriten", icon: "star" },
  reminders: { title: "Erinnerungen", icon: "bell" },
  tasks: { title: "Aufgaben", icon: "task" },
  pc: { title: "Vom PC", icon: "computer" },
  unfiled: { title: "Ohne Ordner", icon: "inbox" },
  templates: { title: "Vorlagen", icon: "template" },
  archive: { title: "Archiv", icon: "archive" },
  trash: { title: "Papierkorb", icon: "trash" },
  search: { title: "Suche", icon: "search" },
  folder: { title: "Ordner", icon: "folder" },
  label: { title: "Label", icon: "label" }
};

function routeHash() {
  const r = S.route;
  let s = "#/" + r.view + (r.id != null ? "/" + r.id : "");
  if (S.pcId) s += "/pc/" + S.pcId;
  else if (S.noteId != null) s += "/n/" + S.noteId;
  return s;
}
function parseHash(hash) {
  const p = (hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const out = { route: { view: "home" }, noteId: null, pcId: null };
  if (!p.length || !VIEWS[p[0]]) return out;
  out.route.view = p[0];
  let i = 1;
  if ((p[0] === "folder" || p[0] === "label") && p[1] && /^\d+$/.test(p[1])) { out.route.id = Number(p[1]); i = 2; }
  if (p[i] === "n" && /^\d+$/.test(p[i + 1] || "")) out.noteId = Number(p[i + 1]);
  if (p[i] === "pc" && p[i + 1]) out.pcId = p[i + 1];
  return out;
}

/** Bereich wechseln. noteId === undefined → Auswahl behalten, null → keine Notiz */
function go(route, noteId, { push = true } = {}) {
  const sameRoute = route.view === S.route.view && route.id === S.route.id;
  rememberScroll();
  S.route = { view: route.view, id: route.id };
  if (noteId !== undefined) { S.noteId = noteId; S.pcId = null; if (noteId == null) S.split.noteId = null; }
  if (!sameRoute) S.listLimit = 80;
  if (push) history.pushState(null, "", routeHash());
  closeNav();
  renderSidebarActive();
  renderList();
  renderMain();
  revealFolder();
  setMobilePane(S.noteId != null || S.pcId != null || S.route.view === "home" ? "main" : "list");
}
function openNote(id, { anchor = null, ts = null, blockId = null } = {}) {
  const note = noteById(id);
  if (!note) { toast("Notiz nicht gefunden"); return; }
  rememberScroll();
  // NEU (AT): Nebeneinander – in der gerade aktiven Spalte öffnen
  if (splitActive() && S.split.active === "b" && note.id !== S.noteId) {
    S.split.noteId = note.id;
    renderMain({ anchor: anchor || blockId });
    return;
  }
  if (splitActive() && note.id === S.split.noteId) { setActivePane("b"); return; }
  S.noteId = note.id;
  S.pcId = null;
  S.findTerms = ts && ts.length ? ts : null;
  history.pushState(null, "", routeHash());
  markListSelection();
  renderMain({ anchor: anchor || blockId });
  setMobilePane("main");
}
function openPc(id) {
  rememberScroll();
  if (S.route.view !== "pc") { S.route = { view: "pc" }; renderSidebarActive(); S.pcId = id; S.noteId = null; renderList(); }
  else {
    S.pcId = id; S.noteId = null;
    if ($(`.list .card[data-pc="${CSS.escape(id)}"]`)) markListSelection(); else renderList();
  }
  history.pushState(null, "", routeHash());
  renderMain();
  setMobilePane("main");
}
function closeNote() {
  if (splitActive()) { closeSplit(S.split.active); return; } // NEU (AT)
  S.noteId = null; S.pcId = null; S.findTerms = null;
  history.pushState(null, "", routeHash());
  markListSelection();
  renderMain();
  setMobilePane("list");
}
window.addEventListener("popstate", () => {
  if (!S.unlocked) return;
  const p = parseHash(location.hash);
  S.route = p.route; S.noteId = p.noteId; S.pcId = p.pcId;
  renderSidebarActive(); renderList(); renderMain(); revealFolder();
  setMobilePane(S.noteId != null || S.pcId || S.route.view === "home" ? "main" : "list");
});
function rememberScroll() {
  const lb = $(".list-body");
  if (lb) S.scroll.set("list:" + S.route.view + ":" + (S.route.id ?? ""), lb.scrollTop);
}
function setMobilePane(pane) {
  const shell = $(".shell");
  if (shell) shell.classList.toggle("show-main", pane === "main");
}
function openNav() { $(".shell")?.classList.add("nav-open"); if (!$(".nav-scrim")) document.body.appendChild(h("div", { class: "nav-scrim", onclick: closeNav })); }
function closeNav() { $(".shell")?.classList.remove("nav-open"); $(".nav-scrim")?.remove(); }

// =====================================================================
// Grundgerüst
// =====================================================================
function renderShell() {
  const app = $("#app");
  clear(app);
  const shell = h("div", { class: "shell" },
    h("div", { class: "banner-area" }),
    h("aside", { class: "side", "aria-label": "Navigation" }),
    h("section", { class: "list", "aria-label": "Liste" }),
    h("main", { class: "main" }));
  app.appendChild(shell);
  if (DEMO) app.appendChild(h("div", { class: "demo-flag" }, "DEMO · Beispieldaten"));
  renderSidebar();
  renderList();
  renderMain();
  renderBanner();
}

function renderBanner() {
  const area = $(".banner-area");
  if (!area) return;
  clear(area);
  if (!DEMO && !tokenValid() && S.unlocked) {
    area.appendChild(h("div", { class: "banner" }, icon("warn"),
      h("span", { class: "grow" }, "Die Google-Verbindung ist abgelaufen. Lesen geht weiter – zum Aktualisieren und Speichern kurz neu verbinden."),
      h("button", { class: "btn small", onclick: renewToken }, "Neu verbinden")));
  } else if (S.inbox && !S.inbox.readable) {
    area.appendChild(h("div", { class: "banner bad" }, icon("warn"),
      h("span", { class: "grow" }, "„Vom PC“ wurde mit einem anderen Passwort gespeichert und kann nicht gelesen werden. Neue PC-Notizen ersetzen die alten."),
      h("button", { class: "btn small ghost", onclick: () => go({ view: "pc" }, null) }, "Ansehen")));
  }
}
async function renewToken() {
  try {
    await requestToken("");
    renderBanner();
    toast("Wieder verbunden ✓");
    poll(true);
    if (pcDirty()) { saveInboxSoon.cancel(); saveInbox(); }
  } catch (e) { toast(e.message, { bad: true }); }
}

// =====================================================================
// Seitenleiste
// =====================================================================
function counts() {
  const db = S.db;
  let all = 0, fav = 0, arch = 0, trash = 0, tmpl = 0, rem = 0, tasks = 0;
  for (const n of db.notes.values()) {
    if (n.deleted) { trash++; continue; }
    if (n.template) { tmpl++; continue; }
    if (n.archived) { arch++; continue; }
    all++;
    if (n.favorite) fav++;
    if (n.reminder) rem++;
    for (const b of n.blocks) if (b.type === "CHECKLIST_ITEM" && !b.checked && b.content.trim()) tasks++;
  }
  return { all, fav, arch, trash, tmpl, rem, tasks, unfiled: db.unfiled.length, pc: pcVisible().length };
}
function navItem(view, label, iconName, count, opts = {}) {
  const on = S.route.view === view && S.route.id == null;
  return h("button", {
    class: "nav-item" + (on ? " on" : ""), dataset: { view },
    onclick: () => go({ view }, null), title: opts.title || null
  }, icon(iconName), h("span", { class: "grow ellipsis" }, label),
  count ? h("span", { class: "count" + (opts.badge ? " badge" : "") }, fmtNum.format(count)) : null);
}
function renderSidebar() {
  const side = $(".side");
  if (!side) return;
  const c = counts();
  const search = h("input", {
    type: "search", placeholder: "Suchen", autocomplete: "off", spellcheck: "false", "aria-label": "Notizen durchsuchen",
    value: S.query,
    oninput: e => onSearchInput(e.target.value),
    onkeydown: e => {
      if (e.key === "Escape") { e.target.value = ""; onSearchInput(""); e.target.blur(); }
      if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); focusListItem(0, e.key === "Enter"); }
    }
  });
  const user = S.user || {};
  const scroll = h("div", { class: "side-scroll" },
    navItem("home", "Start", "home"),
    navItem("all", "Alle Notizen", "note", c.all),
    navItem("fav", "Favoriten", "star", c.fav),
    navItem("reminders", "Erinnerungen", "bell", c.rem),
    navItem("tasks", "Aufgaben", "task", c.tasks, { title: "Alle offenen Checklisten-Punkte" }),
    navItem("pc", "Vom PC", "computer", c.pc, { badge: c.pc > 0, title: "Am PC geschrieben – am Handy übernehmen" }),
    h("div", { class: "nav-title" }, h("span", null, "Ordner"),
      h("button", { onclick: toggleAllFolders, title: "Alle auf-/zuklappen" }, S.treeOpen.size ? "Zuklappen" : "Aufklappen")),
    folderTree(),
    navItem("unfiled", "Ohne Ordner", "inbox", c.unfiled),
    labelSection(),
    h("div", { class: "nav-sep" }),
    navItem("templates", "Vorlagen", "template", c.tmpl),
    navItem("archive", "Archiv", "archive", c.arch),
    navItem("trash", "Papierkorb", "trash", c.trash));
  const foot = h("div", { class: "side-foot" },
    h("div", { class: "sync-line", id: "sync-line" }),
    h("div", { class: "foot-actions" },
      h("div", { class: "user", title: (user.name || "") + (user.email ? " · " + user.email : "") },
        user.photo ? h("img", { class: "avatar", src: user.photo, alt: "", referrerpolicy: "no-referrer" }) : h("span", { class: "avatar" }, initials(user.name)),
        h("span", { class: "name" }, user.name || "Angemeldet")),
      iconBtn("refresh", "Jetzt aktualisieren (R)", () => poll(true)),
      iconBtn("lock", "Sperren (L)", () => lock("Gesperrt.")),
      iconBtn("settings", "Einstellungen", openSettings)));
  replace(side,
    h("div", { class: "side-head" }, h("img", { class: "logo-img sm", src: "logo.png", alt: "" }), h("div", { class: "brand" }, "MyNotes", h("small", null, "am PC")),
      h("span", { class: "grow" }), iconBtn("help", "Tastenkürzel & Hilfe (?)", openShortcuts, "sm"),
      h("button", { class: "icon-btn sm only-narrow", title: "Schließen", onclick: closeNav }, icon("close"))),
    h("div", { class: "search-box" }, icon("search"), search, h("kbd", null, "Strg K")),
    scroll, foot);
  updateSyncLine();
}
function renderSidebarActive() {
  $$(".nav-item").forEach(el => el.classList.toggle("on", el.dataset.view === S.route.view && S.route.id == null));
  $$(".tree-row").forEach(el => {
    const on = (el.dataset.folder && S.route.view === "folder" && Number(el.dataset.folder) === S.route.id) ||
      (el.dataset.label && S.route.view === "label" && Number(el.dataset.label) === S.route.id);
    el.classList.toggle("on", !!on);
  });
}
/** Ordner in der Seitenleiste aufklappen, damit der geöffnete sichtbar ist */
function revealFolder() {
  if (S.route.view !== "folder") return;
  let changed = false;
  for (const f of folderPath(S.route.id).slice(0, -1)) if (!S.treeOpen.has(f.id)) { S.treeOpen.add(f.id); changed = true; }
  if (changed) renderSidebar();
  const row = $(`.tree-row[data-folder="${S.route.id}"]`);
  row && row.scrollIntoView({ block: "nearest" });
}
function toggleAllFolders() {
  if (S.treeOpen.size) S.treeOpen.clear();
  else for (const f of S.db.folders.values()) if (f.children.length) S.treeOpen.add(f.id);
  renderSidebar();
}
function folderTree() {
  const box = h("div", { class: "tree" });
  // Startseiten-Überschriften wie am Handy zwischen den Ordnern
  const entries = areaEntries(S.db.rootFolders, [], S.db.dividers.get("home") || [], "custom", S.db.links.get("home") || []);
  for (const e of entries) {
    if (e.kind === "divider") box.appendChild(e.divider.kind === 0 ? h("div", { class: "tree-head" }, e.divider.title || "Abschnitt") : h("div", { class: "tree-line" }));
    else if (e.kind === "folder") appendFolderRow(box, e.folder, 0, e.linked);
  }
  if (!S.db.rootFolders.length) box.appendChild(h("div", { class: "small muted", style: { padding: "4px 20px" } }, "Keine Ordner"));
  return box;
}
function appendFolderRow(box, f, depth, linked = false) {
  const open = S.treeOpen.has(f.id);
  const on = S.route.view === "folder" && S.route.id === f.id;
  let extra = null;
  if (f.project) {
    const pb = projectBoard(f);
    extra = progressRing(pb.progress, `Projekt: ${pb.done}/${pb.total} erledigt`);
  }
  const row = h("div", { class: "tree-row" + (on ? " on" : ""), dataset: { folder: String(f.id) }, style: { paddingLeft: (8 + depth * 14) + "px" } },
    h("button", {
      class: "tree-toggle" + (open ? " open" : "") + (f.children.length ? "" : " none"), title: open ? "Zuklappen" : "Aufklappen",
      onclick: e => { e.stopPropagation(); if (open) S.treeOpen.delete(f.id); else S.treeOpen.add(f.id); renderSidebar(); }
    }, icon("chevron", "sm")),
    h("button", { class: "tree-main", onclick: () => { go({ view: "folder", id: f.id }, null); } },
      h("span", { style: { color: f.color || "var(--muted)", display: "inline-flex" } }, icon(f.project ? "project" : "folder")),
      h("span", { class: "tree-name" }, f.name),
      linked ? h("span", { title: "Wird hier zusätzlich gezeigt", style: { display: "inline-flex", color: "var(--muted)" } }, icon("link", "sm")) : null,
      extra,
      folderTotal(f) ? h("span", { class: "count", title: "Alle Notizen – auch in Unterordnern" }, fmtNum.format(folderTotal(f))) : null));
  box.appendChild(row);
  if (open && depth < 12) {
    for (const c of f.children) appendFolderRow(box, c, depth + 1);
    for (const l of S.db.links.get("f" + f.id) || []) appendFolderRow(box, l.folder, depth + 1, true);
  }
}
function progressRing(p, title) {
  const r = 7, c = 2 * Math.PI * r;
  return sv("svg", { class: "ring", viewBox: "0 0 18 18" },
    sv("title", { text: title }),
    sv("circle", { cx: 9, cy: 9, r, fill: "none", stroke: "var(--surface3)", "stroke-width": 3 }),
    sv("circle", { cx: 9, cy: 9, r, fill: "none", stroke: "var(--ok)", "stroke-width": 3, "stroke-dasharray": `${c * p} ${c}`, transform: "rotate(-90 9 9)", "stroke-linecap": "round" }));
}
function labelSection() {
  const labels = [...S.db.labels.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (!labels.length) return null;
  const box = h("div", null, h("div", { class: "nav-title" }, h("span", null, "Labels")));
  for (const l of labels) {
    const on = S.route.view === "label" && S.route.id === l.id;
    box.appendChild(h("div", { class: "tree-row" + (on ? " on" : ""), dataset: { label: String(l.id) }, style: { paddingLeft: "8px" } },
      h("span", { class: "tree-toggle none" }),
      h("button", { class: "tree-main", onclick: () => go({ view: "label", id: l.id }, null) },
        h("span", { style: { color: l.color || "var(--muted)", display: "inline-flex" } }, icon("label")),
        h("span", { class: "tree-name" }, l.name),
        l.noteIds.length ? h("span", { class: "count" }, fmtNum.format(l.noteIds.length)) : null)));
  }
  return box;
}
function updateSyncLine() {
  const el = $("#sync-line");
  if (!el) return;
  let dotCls = "", text;
  if (DEMO) text = "Demo – nichts wird gespeichert";
  else if (S.checking) { dotCls = "run"; text = "Prüfe auf Neues …"; }
  else if (S.syncError) { dotCls = "bad"; text = S.syncError; }
  else {
    const age = Date.now() - (S.db?.createdAt || 0);
    if (age > 24 * 3600_000) dotCls = "old";
    text = "Stand vom Handy: " + relTime(S.db?.createdAt);
  }
  replace(el, h("span", { class: "dot " + dotCls }), h("span", { class: "grow ellipsis", title: S.db ? "Handy hat zuletzt hochgeladen: " + fullTime(S.db.createdAt) + "\nZuletzt geprüft: " + (S.lastCheck ? fmtTime.format(S.lastCheck) : "–") : "" }, text));
}

// =====================================================================
// Liste (mittlere Spalte)
// =====================================================================
const SORT_LABEL = { custom: "Eigene Reihenfolge", modified: "Zuletzt geändert", created: "Zuletzt erstellt", title: "Titel A–Z" };

function tilesActive() {
  return S.settings.view === "tiles" && ["all", "fav", "unfiled", "folder", "label", "templates", "archive", "trash"].includes(S.route.view);
}
function listModel() {
  const r = S.route, db = S.db;
  const notesOf = ids => ids.map(id => db.notes.get(id)).filter(Boolean);
  const all = [...db.notes.values()];
  switch (r.view) {
    case "home": return {
      title: "Zuletzt bearbeitet", sub: "Die neuesten Änderungen",
      entries: all.filter(isActive).sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 150).map(n => ({ kind: "note", note: n })),
      showFolder: true, noSort: true, noView: true
    };
    case "all": return { title: "Alle Notizen", entries: sortNotes(all.filter(isActive), S.settings.sort === "custom" ? "modified" : S.settings.sort).map(n => ({ kind: "note", note: n })), showFolder: true, sortNoCustom: true };
    case "fav": return { title: "Favoriten", entries: sortNotes(all.filter(n => isActive(n) && n.favorite)).map(n => ({ kind: "note", note: n })), showFolder: true };
    case "unfiled": return { title: "Notizen ohne Ordner", entries: areaEntries([], notesOf(db.unfiled), db.dividers.get("unfiled") || []) };
    case "templates": return { title: "Vorlagen", sub: "Anklicken → ansehen · „Als PC-Notiz verwenden“ übernimmt sie für „Vom PC“", entries: sortNotes(all.filter(n => n.template && !n.deleted), "title").map(n => ({ kind: "note", note: n })), noSort: true };
    case "archive": return { title: "Archiv", entries: sortNotes(all.filter(n => n.archived && !n.deleted && !n.template), "modified").map(n => ({ kind: "note", note: n })), showFolder: true, noSort: true };
    case "trash": return { title: "Papierkorb", sub: "Nur zum Nachsehen – wiederherstellen geht am Handy", entries: all.filter(n => n.deleted).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)).map(n => ({ kind: "note", note: n })), noSort: true };
    case "label": {
      const l = db.labels.get(r.id);
      if (!l) return { title: "Label", entries: [], empty: "Dieses Label gibt es nicht mehr." };
      return { title: l.name, sub: "Label", color: l.color, entries: sortNotes(notesOf(l.noteIds).filter(n => !n.deleted && !n.template)).map(n => ({ kind: "note", note: n })), showFolder: true };
    }
    case "folder": {
      const f = folderById(r.id);
      if (!f) return { title: "Ordner", entries: [], empty: "Diesen Ordner gibt es nicht (mehr) in der PC-Kopie." };
      const path = folderPath(f.id);
      return {
        title: f.name, color: f.color, folder: f,
        sub: path.length > 1 ? path.slice(0, -1).map(x => x.name).join(" › ") : (f.project ? "Projekt" : null),
        entries: areaEntries(f.children, notesOf(f.noteIds), db.dividers.get("f" + f.id) || [], S.settings.sort, db.links.get("f" + f.id) || [])
      };
    }
    default: return { title: VIEWS[r.view]?.title || "", entries: [] };
  }
}

function renderList() {
  const list = $(".list");
  if (!list) return;
  const shell = $(".shell");
  shell && shell.classList.toggle("tiles", tilesActive() && S.noteId == null);
  const r = S.route;
  if (r.view === "search") return renderSearchList(list);
  if (r.view === "tasks") return renderTaskList(list);
  if (r.view === "reminders") return renderReminderList(list);
  if (r.view === "pc") return renderPcList(list);

  const m = listModel();
  const body = h("div", { class: "list-body" });
  const tools = h("div", { class: "list-tools" });
  if (!m.noSort) tools.appendChild(sortButton(m.sortNoCustom));
  if (!m.noView) tools.appendChild(viewButton());
  if (m.folder && m.folder.project) {
    tools.appendChild(h("button", { class: "chip accent", onclick: () => { if (S.noteId != null) closeNote(); else renderMain(); } }, icon("project", "sm"), "Projekt-Board"));
  }
  // NEU (AS): neue Notiz direkt in diesem Ordner
  if (m.folder && S.inbox.readable !== false) {
    tools.appendChild(h("button", { class: "chip", title: "Neue Notiz in diesem Ordner – kommt am Handy direkt hierher", onclick: () => newNoteInFolder(m.folder.id) }, icon("add", "sm"), "Neue Notiz"));
  }
  replace(list, listHead(m.title, m.sub, m.color, m.entries.filter(e => e.kind === "note").length), tools, body);
  // NEU (AS): am PC in diesem Ordner angelegt, noch nicht am Handy
  const pend = m.folder ? pcVisible().filter(n => n.folderId === m.folder.id) : [];
  if (pend.length) {
    body.appendChild(h("div", { class: "group-title" }, "Vom PC – kommt gleich", h("span", { class: "line" })));
    pend.forEach(n => body.appendChild(pcCard(n)));
  }
  if (!m.entries.length) {
    if (!pend.length) body.appendChild(h("div", { class: "list-empty" }, icon(VIEWS[r.view]?.icon || "note"), m.empty || "Hier ist nichts."));
  } else fillEntries(body, m.entries, { showFolder: m.showFolder, area: r.view === "folder" ? "f" + r.id : r.view });
  const key = "list:" + r.view + ":" + (r.id ?? "");
  if (S.scroll.has(key)) body.scrollTop = S.scroll.get(key);
}
function listHead(title, sub, color, count) {
  return h("div", { class: "list-head" },
    h("button", { class: "icon-btn only-narrow", title: "Menü", onclick: openNav }, icon("menu")),
    color ? h("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: color, flex: "0 0 auto" } }) : null,
    h("div", { class: "titles" }, h("h2", { title }, title),
      h("div", { class: "sub" }, [sub, count != null ? plural(count, "Notiz", "Notizen") : null].filter(Boolean).join(" · "))));
}
function sortButton(noCustom) {
  const current = noCustom && S.settings.sort === "custom" ? "modified" : S.settings.sort;
  return h("button", {
    class: "chip", title: "Sortierung", onclick: e => openMenu(e.currentTarget, [
      { hd: "Sortieren nach" },
      ...Object.entries(SORT_LABEL).filter(([k]) => !(noCustom && k === "custom")).map(([k, label]) => ({
        label, icon: k === current ? "check" : null, on: k === current,
        run: () => { S.settings.sort = k; saveSettingsSoon(); renderList(); if (tilesActive()) renderMain(); }
      }))
    ])
  }, icon("sort", "sm"), SORT_LABEL[current]);
}
function viewButton() {
  const tiles = S.settings.view === "tiles";
  return h("button", {
    class: "chip", title: tiles ? "Als Liste anzeigen" : "Als Kacheln anzeigen (wie Google Notizen)",
    onclick: () => { S.settings.view = tiles ? "list" : "tiles"; saveSettingsSoon(); renderList(); renderMain(); }
  }, icon(tiles ? "list" : "tiles", "sm"), tiles ? "Liste" : "Kacheln");
}
/** Einträge in Etappen anzeigen (große Listen bleiben flüssig) */
function fillEntries(body, entries, opts) {
  let hiddenUnder = null;
  let shown = 0;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.kind === "divider") {
      const d = e.divider;
      if (d.kind === 0) {
        const key = opts.area + ":" + d.id;
        const collapsed = S.dividerOpen.has(key) ? !S.dividerOpen.get(key) : d.collapsed;
        hiddenUnder = collapsed ? d.id : null;
        let n = 0;
        if (collapsed) for (let k = i + 1; k < entries.length && !(entries[k].kind === "divider" && entries[k].divider.kind === 0); k++) if (entries[k].kind !== "divider") n++;
        frag.appendChild(h("div", {
          class: "group-title click", title: collapsed ? "Aufklappen" : "Zuklappen",
          onclick: () => { S.dividerOpen.set(key, collapsed); rememberScroll(); renderList(); }
        }, h("span", { class: "tree-toggle" + (collapsed ? "" : " open"), style: { width: "18px", height: "18px" } }, icon("chevron", "sm")),
        h("span", null, d.title || "Abschnitt"), collapsed && n ? h("span", { style: { textTransform: "none", fontWeight: 400 } }, "(" + n + ")") : null, h("span", { class: "line" })));
      } else if (!hiddenUnder) frag.appendChild(h("div", { class: "divider-line" }));
      continue;
    }
    if (hiddenUnder) continue;
    if (shown >= S.listLimit) {
      const rest = entries.length - i;
      frag.appendChild(h("button", { class: "btn subtle small list-more", onclick: () => { S.listLimit += 200; rememberScroll(); renderList(); } }, "Weitere " + fmtNum.format(rest) + " anzeigen"));
      break;
    }
    frag.appendChild(e.kind === "folder" ? folderCard(e.folder, e.linked) : noteCard(e.note, { showFolder: opts.showFolder, ts: opts.ts }));
    shown++;
  }
  body.appendChild(frag);
}
function markListSelection() {
  $$(".list .card[data-note], .tiles-grid .card[data-note]").forEach(c => c.classList.toggle("on", Number(c.dataset.note) === S.noteId));
  $$(".list .card[data-pc]").forEach(c => c.classList.toggle("on", c.dataset.pc === S.pcId));
  const shell = $(".shell");
  if (shell) shell.classList.toggle("tiles", tilesActive() && S.noteId == null);
}
function focusListItem(index, open) {
  const cards = $$(".list-body .card, .list-body .task-row");
  if (!cards.length) return;
  const el = cards[Math.max(0, Math.min(index, cards.length - 1))];
  el.focus();
  el.scrollIntoView({ block: "nearest" });
  if (open) el.click();
}

// ---------------- Suche ----------------
let searchTimer = null;
function onSearchInput(value) {
  S.query = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (value.trim()) {
      if (S.route.view !== "search") { S.prevRoute = S.route; S.route = { view: "search" }; renderSidebarActive(); history.pushState(null, "", routeHash()); }
      renderList();
      setMobilePane("list");
    } else if (S.route.view === "search") {
      S.route = S.prevRoute || { view: "home" };
      history.replaceState(null, "", routeHash());
      renderSidebarActive(); renderList(); renderMain();
    }
  }, 120);
}
function renderSearchList(list) {
  const ts = terms(S.query);
  const body = h("div", { class: "list-body" });
  const hits = ts.length ? searchNotes(S.query) : [];
  const folders = ts.length ? [...S.db.folders.values()].filter(f => ts.every(t => norm(f.name).includes(t))) : [];
  replace(list, listHead("Suche", ts.length ? "„" + S.query.trim() + "“" : "Suchbegriff eingeben", null, hits.length), body);
  if (!ts.length) { body.appendChild(h("div", { class: "list-empty" }, icon("search"), "Tippe oben einen Suchbegriff ein. Groß-/Kleinschreibung und Akzente sind egal, mehrere Wörter müssen alle vorkommen.")); return; }
  if (folders.length) {
    body.appendChild(h("div", { class: "group-title" }, "Ordner", h("span", { class: "line" })));
    folders.slice(0, 8).forEach(f => body.appendChild(folderCard(f)));
  }
  if (!hits.length && !folders.length) { body.appendChild(h("div", { class: "list-empty" }, icon("search"), "Nichts gefunden.")); return; }
  const groups = [
    ["Notizen", hits.filter(x => isActive(x.note))],
    ["Vorlagen", hits.filter(x => x.note.template)],
    ["Archiv", hits.filter(x => x.note.archived && !x.note.template)]
  ];
  for (const [name, arr] of groups) {
    if (!arr.length) continue;
    if (folders.length || groups.filter(g => g[1].length).length > 1) body.appendChild(h("div", { class: "group-title" }, name + " (" + arr.length + ")", h("span", { class: "line" })));
    fillEntries(body, arr.map(x => ({ kind: "note", note: x.note })), { showFolder: true, ts, area: "search" });
  }
}

// ---------------- Aufgaben ----------------
function renderTaskList(list) {
  S.taskMode = S.taskMode || "open";
  S.taskSort = S.taskSort || "note";
  const body = h("div", { class: "list-body" });
  const tools = h("div", { class: "list-tools" },
    seg([["open", "Offen"], ["all", "Alle"]], S.taskMode, v => { S.taskMode = v; renderList(); }),
    seg([["note", "Nach Notiz"], ["prio", "Wichtigste zuerst"]], S.taskSort, v => { S.taskSort = v; renderList(); }));
  const groups = [];
  let total = 0;
  for (const note of S.db.notes.values()) {
    if (!isActive(note)) continue;
    const items = note.blocks.filter(b => b.type === "CHECKLIST_ITEM" && b.content.trim() && (S.taskMode === "all" || !b.checked));
    if (!items.length) continue;
    total += items.length;
    groups.push({ note, items });
  }
  replace(list, listHead("Aufgaben", S.taskMode === "open" ? "Offene Checklisten-Punkte aus allen Notizen" : "Alle Checklisten-Punkte", null, null), tools, body);
  if (!groups.length) { body.appendChild(h("div", { class: "list-empty" }, icon("task"), "Keine offenen Aufgaben 🎉")); return; }
  if (S.taskSort === "prio") {
    const rows = groups.flatMap(g => g.items.map(b => ({ b, note: g.note })))
      .sort((a, b) => (a.b.checked - b.b.checked) || (b.b.priority - a.b.priority) || (b.note.modifiedAt - a.note.modifiedAt));
    let lastPrio = null;
    for (const r of rows.slice(0, 600)) {
      const p = r.b.checked ? -1 : r.b.priority;
      if (p !== lastPrio) {
        body.appendChild(h("div", { class: "group-title" }, p === -1 ? "Erledigt" : p === 3 ? "Hohe Priorität" : p === 2 ? "Mittlere Priorität" : p === 1 ? "Niedrige Priorität" : "Ohne Priorität", h("span", { class: "line" })));
        lastPrio = p;
      }
      body.appendChild(taskRow(r.b, r.note, true));
    }
  } else {
    groups.sort((a, b) => b.note.modifiedAt - a.note.modifiedAt);
    for (const g of groups) {
      body.appendChild(h("div", { class: "group-title click", onclick: () => openNote(g.note.id) },
        h("span", { class: "ellipsis", style: { textTransform: "none", letterSpacing: 0, fontSize: ".9rem", color: "var(--text)" } }, g.note.title || "Ohne Titel"),
        h("span", { style: { fontWeight: 400 } }, g.items.length), h("span", { class: "line" })));
      for (const b of g.items) body.appendChild(taskRow(b, g.note, false));
    }
  }
  body.appendChild(h("div", { class: "small muted", style: { padding: "16px 4px" } }, plural(total, "Punkt", "Punkte") + " · Kästchen anklicken = abhaken – das Handy übernimmt es beim nächsten Abgleich (bis dahin „→ Handy“)."));
}
function taskRow(b, note, showNote) {
  const prio = PRIO[b.priority];
  const checked = effectiveChecked(b); // NEU (AH-3)
  const pending = pendingCheck(b.id);
  const box = h("span", { class: "box live", title: "Abhaken (wird am Handy übernommen)" });
  const row = h("div", {
    class: "task-row" + (checked ? " done" : "") + (pending ? " pending" : ""), tabindex: "0",
    onclick: () => openNote(note.id, { blockId: b.id }),
    onkeydown: e => { if (e.key === "Enter") openNote(note.id, { blockId: b.id }); }
  }, box,
  h("span", { class: "t" }, prio ? h("span", { class: "prio " + prio[0] }, prio[1]) : null, readable(b.content),
    pending ? h("span", { class: "pending-tag" }, icon("phone", "sm"), "→ Handy") : null),
  showNote ? h("span", { class: "from" }, note.title || "Ohne Titel") : null);
  box.addEventListener("click", e => {
    e.stopPropagation();
    if (!canCheckFromPc(note)) return;
    toggleCheckFromPc(b);
    row.replaceWith(taskRow(b, note, showNote));
  });
  return row;
}
function seg(options, value, onChange) {
  return h("div", { class: "seg" }, options.map(([v, label]) => h("button", { class: v === value ? "on" : "", onclick: () => onChange(v) }, label)));
}

// ---------------- Erinnerungen ----------------
function renderReminderList(list) {
  const notes = [...S.db.notes.values()].filter(n => n.reminder && !n.deleted && !n.template).sort((a, b) => a.reminder - b.reminder);
  const body = h("div", { class: "list-body" });
  replace(list, listHead("Erinnerungen", "Wie am Handy unter „Anstehend“", null, notes.length), body);
  if (!notes.length) { body.appendChild(h("div", { class: "list-empty" }, icon("bell"), "Keine Erinnerungen.")); return; }
  const now = Date.now();
  const bucket = n => {
    const dd = dayDiff(n.reminder, now);
    if (n.reminder < now && dd < 0) return "Überfällig";
    if (dd <= 0) return "Heute";
    if (dd === 1) return "Morgen";
    if (dd < 7) return "Nächste 7 Tage";
    if (dd < 31) return "Diesen Monat";
    return "Später";
  };
  let last = null;
  for (const n of notes) {
    const b = bucket(n);
    if (b !== last) { body.appendChild(h("div", { class: "group-title", style: b === "Überfällig" ? { color: "var(--danger)" } : null }, b, h("span", { class: "line" }))); last = b; }
    body.appendChild(noteCard(n, { showFolder: true }));
  }
}
// =====================================================================
// Hauptbereich (rechte Spalte)
// =====================================================================
function renderMain(opts = {}) {
  const main = $(".main");
  if (!main) return;
  const shell = $(".shell");
  shell && shell.classList.toggle("tiles", tilesActive() && S.noteId == null && !S.pcId);
  // NEU (AT): Aufräumen nach der Nebeneinander-Ansicht
  main.classList.remove("split");
  if (main._splitObs && !splitActive()) { main._splitObs.disconnect(); main._splitObs = null; }
  renderShellSplit();
  if (S.route.view === "pc" || S.pcId) return renderPcMain(main);
  if (splitActive()) return renderSplit(main); // NEU (AT)
  if (S.noteId != null) return renderNote(main, opts);
  if (tilesActive()) return renderTiles(main);
  if (S.route.view === "home") return renderDashboard(main);
  if (S.route.view === "folder") {
    const f = folderById(S.route.id);
    if (f && f.project) return renderBoard(main, f);
    if (f) return renderFolderOverview(main, f);
  }
  replace(main, h("div", { class: "main-empty" }, icon("note"),
    h("h3", null, "Keine Notiz ausgewählt"),
    h("div", null, "Wähle links eine Notiz aus – oder suche mit ", h("kbd", null, "Strg K"), ".")));
}

function mainBar(...items) {
  const bar = h("div", { class: "note-bar" }, ...items);
  return bar;
}
function backButton() {
  const narrow = matchMedia("(max-width: 760px)").matches;
  if (!narrow && !(tilesActive())) return null;
  return iconBtn("back", "Zurück", () => closeNote());
}
function watchScroll(scroller, bar) {
  scroller.addEventListener("scroll", () => bar.classList.toggle("scrolled", scroller.scrollTop > 4), { passive: true });
}

// ---------------------------------------------------------------------
// Notiz ansehen
// ---------------------------------------------------------------------
function renderNote(main, opts = {}, { noteId = S.noteId, pane = null } = {}) {
  // GEÄNDERT (AS): offene Änderungen vom PC schon anzeigen; (AT): auch als Spalte (pane „a“/„b“)
  const raw = noteById(noteId);
  if (raw && S.edit && S.edit.noteId === raw.id) return renderNoteEditor(main, raw);
  const note = effectiveNote(raw);
  const closeThis = pane === "b" ? () => closeSplit("b") : pane === "a" ? () => closeSplit("a") : closeNote;
  if (!note) {
    replace(main, h("div", { class: "main-empty" }, icon("warn"), h("h3", null, "Diese Notiz gibt es nicht mehr"),
      h("div", null, "Sie wurde am Handy gelöscht oder in den versteckten Bereich verschoben."),
      h("button", { class: "btn subtle", onclick: closeThis }, "Schließen")));
    return;
  }
  const ts = pane === "b" ? null : S.findTerms;
  if (pane !== "b") S.findNext = S.findPrev = null;
  const scroller = h("div", { class: "main-scroll" });
  // Kopfzeile: Ordnerpfad + Aktionen
  const crumbs = h("div", { class: "crumbs" });
  const paths = note.folderIds.map(folderPath).filter(p => p.length);
  if (paths.length) {
    paths[0].forEach((f, i) => {
      if (i) crumbs.appendChild(icon("chevron", "sm"));
      crumbs.appendChild(h("button", { onclick: () => go({ view: "folder", id: f.id }, null), title: "Ordner öffnen" }, f.name));
    });
    if (paths.length > 1) crumbs.appendChild(h("span", { class: "chip", title: paths.slice(1).map(p => p.map(f => f.name).join(" › ")).join("\n") }, "+" + (paths.length - 1)));
  } else crumbs.appendChild(h("span", { style: { padding: "2px 6px" } }, note.deleted ? "Papierkorb" : note.template ? "Vorlage" : note.archived ? "Archiv" : "Ohne Ordner"));
  const page = Math.min(S.page.get(note.id) || 0, note.pages ? note.pages.length - 1 : 0);
  const editable = canEditFromPc(raw);
  const bar = mainBar(pane ? null : backButton(), crumbs,
    editable ? h("button", { class: "btn subtle small edit-btn", title: "Am PC bearbeiten (E) – das Handy übernimmt die Änderungen", onclick: () => startEdit(raw, page) }, icon("edit", "sm"), "Bearbeiten") : null,
    iconBtn("copy", "Als Text kopieren", () => copyText(notePlainText(note), "Notiz kopiert")),
    pane ? null : iconBtn("print", "Drucken / als PDF speichern", () => printNote()),
    iconBtn("more", "Mehr", e => openMenu(e.currentTarget, [
      editable ? { label: "Am PC bearbeiten", icon: "edit", run: () => startEdit(raw, page) } : null,
      pane ? { label: "Seiten tauschen", icon: "swap", run: swapSplit } : { label: "Daneben öffnen …", icon: "split", run: pickSplitNote },
      { sep: true },
      { label: "Als Text kopieren", icon: "copy", run: () => copyText(notePlainText(note), "Notiz kopiert") },
      note.pages ? { label: "Nur diese Seite kopieren", icon: "copy", run: () => copyText(notePlainText(note, page), "Seite kopiert") } : null,
      { label: "Als Markdown kopieren", icon: "code", run: () => copyText(noteMarkdown(note), "Markdown kopiert") },
      { sep: true },
      { label: "Herunterladen (.md)", icon: "download", run: () => downloadBlob(new Blob([noteMarkdown(note)], { type: "text/markdown;charset=utf-8" }), safeFileName(note.title) + ".md") },
      { label: "Herunterladen (.txt)", icon: "download", run: () => downloadBlob(new Blob([notePlainText(note)], { type: "text/plain;charset=utf-8" }), safeFileName(note.title) + ".txt") },
      { label: "Drucken / PDF", icon: "print", run: printNote },
      { sep: true },
      { label: "Link kopieren (für „Vom PC“)", icon: "link", run: () => copyText(linkMarkup(note.title || "Notiz", note.id), "Link kopiert – in einer PC-Notiz einfügen") },
      { label: note.template ? "Als neue PC-Notiz verwenden" : "Als Kopie in „Vom PC“ bearbeiten", icon: "template", run: () => pcFromNote(note) }
    ])),
    iconBtn("close", pane ? "Diese Notiz schließen" : "Schließen (Esc)", closeThis));
  watchScroll(scroller, bar);
  const wrap = h("div", { class: "note-wrap" });
  const paper = h("article", { class: "note-paper" });
  if (note.color) paper.appendChild(h("div", { class: "note-colorband", style: { background: note.color } }));
  const title = h("h1", { class: "note-title" + (note.title.trim() ? "" : " untitled") });
  appendMarked(title, note.title.trim() || "Ohne Titel", ts);
  paper.appendChild(title);

  // Angaben
  const meta = h("div", { class: "note-meta" });
  if (note.favorite) meta.appendChild(h("span", { class: "chip accent" }, icon("star", "sm"), "Favorit"));
  if (note.deleted) meta.appendChild(h("span", { class: "chip danger" }, icon("trash", "sm"), "Im Papierkorb"));
  if (note.archived) meta.appendChild(h("span", { class: "chip" }, icon("archive", "sm"), "Archiviert"));
  if (note.template) meta.appendChild(h("span", { class: "chip" }, icon("template", "sm"), "Vorlage"));
  const rt = reminderText(note);
  if (rt) meta.appendChild(h("span", { class: "chip" + (note.reminder < Date.now() && !note.reminderRepeat ? " danger" : ""), title: "Erinnerung" }, icon("bell", "sm"), rt));
  for (const id of note.labelIds) {
    const l = S.db.labels.get(id);
    if (l) meta.appendChild(h("button", { class: "chip", onclick: () => go({ view: "label", id: l.id }, null) }, l.color ? h("span", { class: "dot", style: { background: l.color } }) : null, l.name));
  }
  meta.appendChild(h("span", { class: "chip", title: "Erstellt " + fullTime(note.createdAt) + "\nGeändert " + fullTime(note.modifiedAt) }, icon("clock", "sm"), "Geändert " + relTime(note.modifiedAt)));
  if (S.fresh.has(note.id)) meta.appendChild(h("span", { class: "chip accent" }, "● Neu seit dem Öffnen"));
  paper.appendChild(meta);
  const eb = pendingEditBanner(note); // NEU (AS)
  if (eb) paper.appendChild(eb);
  if (note.template) {
    paper.appendChild(h("div", { class: "panel", style: { marginBottom: "18px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } },
      h("div", { class: "grow" }, h("b", null, "Vorlage"), h("div", { class: "small muted" }, "Mit „Als PC-Notiz verwenden“ entsteht daraus eine neue Notiz in „Vom PC“ – fertig zum Ausfüllen und Übernehmen am Handy.")),
      h("button", { class: "btn", onclick: () => pcFromNote(note) }, icon("edit"), "Als PC-Notiz verwenden")));
  }

  // Seiten
  if (note.pages && note.pages.length > 1) {
    const tabs = h("div", { class: "note-tabs", role: "tablist" });
    note.pages.forEach((name, i) => {
      const hits = ts ? note.blocks.filter(b => b.page === i && findRanges(blockText(b), ts).length).length : 0;
      tabs.appendChild(h("button", {
        class: i === page ? "on" : "", role: "tab",
        onclick: () => { S.page.set(note.id, i); renderMain(); }
      }, name, hits ? h("span", { class: "chip accent", style: { marginLeft: "6px", padding: "0 6px" } }, hits) : null));
    });
    paper.appendChild(tabs);
  }
  const blocks = blocksOfPage(note, page);
  // Inhaltsverzeichnis bei längeren Notizen
  const heads = blocks.filter(b => b.type === "HEADING" && b.content.trim());
  if (heads.length >= 3) {
    const ol = h("ol");
    heads.forEach(b => ol.appendChild(h("li", { class: "lv" + headingLevel(b) }, h("a", { href: "#", onclick: e => { e.preventDefault(); scrollToBlock(b.id); } }, readable(b.content)))));
    paper.appendChild(h("details", { class: "toc" }, h("summary", null, "Inhalt (" + heads.length + " Abschnitte)"), ol));
  }
  const blocksEl = renderBlocks(blocks, { ts, note, tools: true, pageBlocks: blocks });
  paper.appendChild(blocksEl);
  if (!blocks.length) paper.appendChild(h("div", { class: "muted" }, "(leer)"));

  // Rückverweise
  const back = [...(S.db.backlinks.get(note.id) || [])].map(id => noteById(id)).filter(n => n && !n.deleted);
  if (back.length) {
    paper.appendChild(h("div", { class: "backlinks" }, h("h4", null, "Verlinkt von"),
      back.map(n => h("button", { class: "chip", onclick: () => openNote(n.id) }, "📄 " + (n.title || "Ohne Titel")))));
  }
  const words = notePlainText(note).split(/\s+/).filter(Boolean).length;
  paper.appendChild(h("div", { class: "note-foot" },
    h("span", null, "Erstellt " + fullTime(note.createdAt)),
    h("span", null, "Geändert " + fullTime(note.modifiedAt)),
    h("span", null, plural(words, "Wort", "Wörter"))));
  wrap.appendChild(paper);
  scroller.appendChild(wrap);
  replace(main, bar, scroller);

  // Suchtreffer: Leiste zum Durchspringen
  if (ts) setupFindBar(main, scroller, wrap);
  if (opts.anchor) setTimeout(() => scrollToBlock(opts.anchor, true), 30);
  else scroller.scrollTop = 0;
}
function scrollToBlock(blockId, fromLink) {
  let el = document.getElementById("b" + blockId);
  if (!el) {
    // Block liegt evtl. auf einer anderen Seite
    const note = noteById(S.noteId);
    const b = note && note.blocks.find(x => x.id === Number(blockId));
    if (b && note.pages && (S.page.get(note.id) || 0) !== b.page) {
      S.page.set(note.id, b.page);
      renderMain({ anchor: blockId });
      return;
    }
    if (fromLink) toast("Diese Stelle gibt es nicht mehr – die Notiz wird von oben gezeigt");
    return;
  }
  // Eingeklappte Abschnitte öffnen (GEÄNDERT AO: auch verschachtelte)
  let section, guard = 0;
  while ((section = el.closest(".section-body.collapsed")) && guard++ < 10) { const head = section.previousElementSibling; const t = head && $(".tree-toggle", head); if (!t) break; t.click(); }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}
function setupFindBar(main, scroller, wrap) {
  // eingeklappte Abschnitte mit Treffern öffnen
  $$(".section-body.collapsed", wrap).forEach(sec => {
    if ($("mark.find", sec)) { const head = sec.previousElementSibling; head && $(".tree-toggle", head)?.click(); }
  });
  const marks = $$("mark.find", wrap);
  const label = h("span");
  let cur = -1;
  const show = i => {
    if (!marks.length) return;
    marks[cur]?.classList.remove("cur");
    cur = (i + marks.length) % marks.length;
    marks[cur].classList.add("cur");
    marks[cur].scrollIntoView({ block: "center", behavior: "smooth" });
    label.textContent = `${cur + 1} von ${marks.length}`;
  };
  if (!marks.length) label.textContent = "Treffer auf anderen Seiten";
  const bar = h("div", { class: "findbar" }, icon("search", "sm"), h("span", { class: "muted" }, "„" + S.findTerms.join(" ") + "“"), label,
    iconBtn("expand", "Nächster Treffer (Enter)", () => show(cur + 1), "sm"),
    h("button", { class: "icon-btn sm", title: "Vorheriger Treffer", onclick: () => show(cur - 1), style: { transform: "rotate(180deg)" } }, icon("expand")),
    iconBtn("close", "Markierung entfernen", () => { S.findTerms = null; renderMain(); }, "sm"));
  wrap.insertBefore(bar, wrap.firstChild);
  S.findNext = () => show(cur + 1);
  S.findPrev = () => show(cur - 1);
  if (marks.length) setTimeout(() => show(0), 40);
}
function printNote() {
  // Alle Seiten drucken: kurz alle Seiten einblenden
  window.print();
}

// ---------------------------------------------------------------------
// Startseite
// ---------------------------------------------------------------------
function renderDashboard(main) {
  const db = S.db;
  const now = Date.now();
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 17 ? "Hallo" : hour < 22 ? "Guten Abend" : "Gute Nacht";
  const first = (S.user?.name || "").split(" ")[0];
  const active = [...db.notes.values()].filter(isActive);
  const c = counts();
  const scroller = h("div", { class: "main-scroll" });
  const bar = mainBar(h("button", { class: "icon-btn only-narrow", onclick: openNav, title: "Menü" }, icon("menu")), h("div", { class: "crumbs" }));
  watchScroll(scroller, bar);
  const dash = h("div", { class: "dash" });
  dash.appendChild(h("div", { class: "dash-hello" },
    h("h1", null, hello + (first ? ", " + first : "") + " 👋"),
    h("p", null, fmtDateLong.format(now) + " · Stand vom Handy " + relTime(db.createdAt))));
  const grid = h("div", { class: "dash-grid" });

  // Angepinnt (wie am Handy)
  const pinned = [
    ...[...db.folders.values()].filter(f => f.pinnedAt).map(f => ({ t: f.pinnedAt, folder: f })),
    ...[...db.notes.values()].filter(n => n.pinnedAt && !n.deleted && !n.archived).map(n => ({ t: n.pinnedAt, note: n }))
  ].sort((a, b) => a.t - b.t);
  if (pinned.length) {
    grid.appendChild(h("div", { class: "panel wide" }, h("h3", null, icon("pin"), "Angepinnt"),
      h("div", { class: "pinned-row" }, pinned.map(p => p.folder
        ? h("button", { class: "chip pin-chip", onclick: () => go({ view: "folder", id: p.folder.id }, null) },
          h("span", { style: { color: p.folder.color || "var(--muted)", display: "inline-flex" } }, icon("folder", "sm")), p.folder.name)
        : h("button", { class: "chip pin-chip", onclick: () => openNote(p.note.id) }, icon("note", "sm"), p.note.title || "Ohne Titel")))));
  }

  // Schnell ans Handy
  const ta = h("textarea", { class: "field", placeholder: "Text, Link oder Liste hier hineinschreiben oder einfügen …\nErste Zeile = Titel (optional). „- [ ] “ wird zur Checkliste.", spellcheck: "true" });
  const send = async () => {
    const text = ta.value;
    if (!text.trim()) { ta.focus(); return; }
    const n = createPcNote(text, { fromQuick: true });
    ta.value = "";
    await saveInbox();
    toast("Ans Handy geschickt ✓ – erscheint dort unter „Vom PC“", { action: { label: "Öffnen", run: () => openPc(n.id) } });
    renderSidebar(); renderSidebarActive();
  };
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  grid.appendChild(h("div", { class: "panel quick" },
    h("h3", null, icon("send"), h("span", { class: "grow" }, "Schnell ans Handy schicken")), ta,
    h("div", { class: "actions" }, h("span", { class: "hint" }, h("kbd", null, "Strg"), " + ", h("kbd", null, "Enter"), " sendet · landet am Handy in „Vom PC“"),
      h("button", { class: "btn", onclick: send }, icon("send"), "Senden"))));

  // Zahlen
  const words = active.reduce((s, n) => s + (n._words ??= notePlainText(n).split(/\s+/).filter(Boolean).length), 0);
  grid.appendChild(h("div", { class: "panel" }, h("h3", null, icon("note"), "Überblick"),
    h("div", { class: "stats" },
      stat(c.all, "Notizen", () => go({ view: "all" }, null)),
      stat(db.folders.size, "Ordner"),
      stat(c.tasks, "offene Aufgaben", () => go({ view: "tasks" }, null)),
      stat(c.rem, "Erinnerungen", () => go({ view: "reminders" }, null)),
      stat(words, "Wörter"),
      stat(c.pc, "Vom PC", () => go({ view: "pc" }, null)))));

  // Zuletzt bearbeitet
  const recent = active.sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 8);
  grid.appendChild(h("div", { class: "panel wide" }, h("h3", null, icon("clock"), h("span", { class: "grow" }, "Zuletzt bearbeitet"),
    h("button", { class: "btn subtle small", onclick: () => go({ view: "all" }, null) }, "Alle")),
  h("div", { class: "recent-grid" }, recent.map(n => noteCard(n, { showFolder: true })))));

  // Erinnerungen
  const rem = [...db.notes.values()].filter(n => n.reminder && !n.deleted && !n.template && n.reminder > now - 7 * 86_400_000).sort((a, b) => a.reminder - b.reminder).slice(0, 7);
  // NEU (AZ): Stundenplan – was läuft gerade, was kommt als Nächstes (wie am Handy)
  const ttRows = [];
  for (const n of active) {
    for (const b of n.blocks) {
      if (b.type !== "TIMETABLE") continue;
      let raw = {};
      try { raw = JSON.parse(b.content || "{}"); } catch (_) {}
      if (raw.home === false) continue;
      const tt = timetableParse(b.content); // GEÄNDERT (AZ): echte Uhrzeiten
      if (!tt.entries.length) continue;
      const { current, next } = ttNowNext(tt);
      if (!current && !next) continue;
      const e = current || next;
      ttRows.push(h("button", { class: "row-link tt-now-row", onclick: () => openNote(n.id) },
        h("span", { class: "dot", style: { background: ttColor(e.c) } }),
        h("span", { class: "t" }, current ? "Jetzt: " + current.t + (current.room ? " (" + current.room + ")" : "") : "Als Nächstes: " + next.t + (next.room ? " (" + next.room + ")" : "")),
        h("span", { class: "d" }, current ? "bis " + ttFmt(current.to) + (next ? " · danach " + next.t : "") : ttFmt(next.from))));
    }
  }
  grid.appendChild(h("div", { class: "panel" }, h("h3", null, icon("bell"), h("span", { class: "grow" }, "Anstehend"),
    h("button", { class: "btn subtle small", onclick: () => go({ view: "reminders" }, null) }, "Alle")),
  ttRows,
  rem.length ? rem.map(n => h("button", { class: "row-link", onclick: () => openNote(n.id) },
    h("span", { class: "t" }, n.title || "Ohne Titel"),
    h("span", { class: "d" + (n.reminder < now && !n.reminderRepeat ? " over" : "") }, relDay(n.reminder, n.reminderHasTime))))
    : ttRows.length ? null : h("div", { class: "muted small" }, "Keine Erinnerungen in Sicht.")));

  // Aufgaben (wichtigste zuerst)
  const tasks = [];
  for (const n of active) for (const b of n.blocks) if (b.type === "CHECKLIST_ITEM" && !b.checked && b.content.trim()) tasks.push({ b, n });
  tasks.sort((x, y) => y.b.priority - x.b.priority || y.n.modifiedAt - x.n.modifiedAt);
  grid.appendChild(h("div", { class: "panel" }, h("h3", null, icon("task"), h("span", { class: "grow" }, "Offene Aufgaben"),
    h("button", { class: "btn subtle small", onclick: () => go({ view: "tasks" }, null) }, "Alle " + fmtNum.format(tasks.length))),
  tasks.length ? tasks.slice(0, 8).map(t => taskRow(t.b, t.n, true)) : h("div", { class: "muted small" }, "Alles erledigt 🎉")));

  // Projekte
  const projects = [...db.folders.values()].filter(f => f.project).map(f => ({ f, pb: projectBoard(f) }));
  const projectNotes = active.filter(n => n.blocks.some(b => b.type === "PROJECT"));
  if (projects.length || projectNotes.length) {
    const panel = h("div", { class: "panel" }, h("h3", null, icon("project"), "Projekte"));
    for (const { f, pb } of projects) {
      panel.appendChild(h("div", { class: "proj-row", onclick: () => go({ view: "folder", id: f.id }, null), title: `${pb.done}/${pb.total} erledigt` },
        h("span", { class: "ellipsis" }, h("span", { style: { color: f.color || "var(--muted)" } }, "📁 "), f.name),
        h("div", { class: "progress" }, h("div", { style: { width: Math.round(pb.progress * 100) + "%" } })),
        h("span", { class: "pct" }, Math.round(pb.progress * 100) + " %")));
    }
    for (const n of projectNotes.slice(0, 6)) {
      const ph = notePhases(blocksOfPage(n, n.blocks.find(b => b.type === "PROJECT").page));
      const tasksAll = ph.flatMap(p => p.tasks), done = tasksAll.filter(t => t.checked).length;
      const p = tasksAll.length ? done / tasksAll.length : 0;
      panel.appendChild(h("div", { class: "proj-row", onclick: () => openNote(n.id), title: `${done}/${tasksAll.length} erledigt` },
        h("span", { class: "ellipsis" }, "📋 ", n.title || "Ohne Titel"),
        h("div", { class: "progress" }, h("div", { style: { width: Math.round(p * 100) + "%" } })),
        h("span", { class: "pct" }, Math.round(p * 100) + " %")));
    }
    grid.appendChild(panel);
  }

  // Vom PC
  const pcs = pcVisible().slice(0, 5);
  grid.appendChild(h("div", { class: "panel" }, h("h3", null, icon("computer"), h("span", { class: "grow" }, "Vom PC"),
    h("button", { class: "btn subtle small", onclick: () => newPcNote() }, icon("add", "sm"), "Neu")),
  pcs.length ? pcs.map(n => h("button", { class: "row-link", onclick: () => openPc(n.id) },
    h("span", { class: "t" }, n.title || firstLine(n.md) || "Ohne Titel"), h("span", { class: "d" }, relTime(n.modified))))
    : h("div", { class: "muted small" }, "Noch nichts. Schreib oben etwas oder lege eine PC-Notiz an – am Handy erscheint sie unter „Vom PC“.")));

  dash.appendChild(grid);
  scroller.appendChild(dash);
  replace(main, bar, scroller);
}
function stat(n, label, onclick) {
  return h(onclick ? "button" : "div", { class: "stat", onclick, style: onclick ? { border: 0, textAlign: "left", color: "inherit", cursor: "pointer" } : null },
    h("b", null, fmtNum.format(n)), h("span", null, label));
}

// ---------------------------------------------------------------------
// Projekt-Board (Projekt-Ordner)
// ---------------------------------------------------------------------
function renderBoard(main, folder) {
  const pb = projectBoard(folder);
  const scroller = h("div", { class: "main-scroll" });
  const bar = mainBar(h("button", { class: "icon-btn only-narrow", onclick: openNav, title: "Menü" }, icon("menu")), h("div", { class: "crumbs" }, folderPath(folder.id).map((f, i) => [i ? icon("chevron", "sm") : null, h("button", { onclick: () => go({ view: "folder", id: f.id }, null) }, f.name)])));
  watchScroll(scroller, bar);
  const wrap = h("div", { class: "board-wrap" },
    h("div", { class: "board-head" },
      h("h1", null, folder.name),
      h("div", { class: "progress big" }, h("div", { style: { width: Math.round(pb.progress * 100) + "%" } })),
      h("span", { class: "muted" }, `${pb.done}/${pb.total} erledigt · ${Math.round(pb.progress * 100)} %`)));
  const board = h("div", { class: "board" });
  for (const col of pb.phases) {
    const doneN = col.entries.filter(e => e.complete).length;
    const c = h("div", { class: "board-col", vars: col.phase.color ? { "--phase-color": col.phase.color } : null },
      h("h3", null, col.phase.name, h("span", null, `${doneN}/${col.entries.length}`)));
    for (const e of col.entries) c.appendChild(noteCard(e.note, { project: e }));
    if (!col.entries.length) c.appendChild(h("div", { class: "small muted", style: { padding: "6px 4px" } }, "Leer"));
    board.appendChild(c);
  }
  wrap.appendChild(board);
  if (folder.children.length) {
    wrap.appendChild(h("div", { class: "group-title" }, "Unterordner", h("span", { class: "line" })));
    wrap.appendChild(h("div", { class: "tiles-folders" }, folder.children.map(f => folderCard(f))));
  }
  scroller.appendChild(wrap);
  replace(main, bar, scroller);
}

function renderFolderOverview(main, folder) {
  const notes = folder.noteIds.map(id => noteById(id)).filter(Boolean);
  const st = notes.reduce((a, n) => { const s = checklistStats(n); a.t += s.total; a.d += s.done; return a; }, { t: 0, d: 0 });
  replace(main, h("div", { class: "main-empty" },
    h("span", { style: { color: folder.color || "var(--muted)" } }, icon("folder")),
    h("h3", null, folder.name),
    h("div", null, [plural(notes.length, "Notiz", "Notizen"), folder.children.length ? plural(folder.children.length, "Unterordner", "Unterordner") : null,
      st.t ? `${st.d}/${st.t} Punkte erledigt` : null].filter(Boolean).join(" · ")),
    notes.length ? h("div", { class: "small" }, "Zuletzt geändert: " + relTime(Math.max(...notes.map(n => n.modifiedAt)))) : null,
    h("div", { style: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap", justifyContent: "center" } },
      h("button", { class: "btn subtle", onclick: () => { S.settings.view = "tiles"; saveSettingsSoon(); renderList(); renderMain(); } }, icon("tiles"), "Als Kacheln zeigen"),
      notes.length ? h("button", { class: "btn subtle", onclick: () => copyText(notes.map(n => notePlainText(n)).join("\n\n――――――――\n\n"), plural(notes.length, "Notiz kopiert", "Notizen kopiert")) }, icon("copy"), "Alle kopieren") : null)));
}

// ---------------------------------------------------------------------
// Kacheln (wie Google Notizen)
// ---------------------------------------------------------------------
function renderTiles(main) {
  const m = listModel();
  const scroller = h("div", { class: "main-scroll" });
  const bar = mainBar(h("button", { class: "icon-btn only-narrow", onclick: openNav, title: "Menü" }, icon("menu")),
    h("div", { class: "crumbs" }, h("b", { style: { color: "var(--text)", fontSize: "1.05rem", padding: "0 6px" } }, m.title),
      h("span", null, plural(m.entries.filter(e => e.kind === "note").length, "Notiz", "Notizen"))),
    m.noSort ? null : sortButton(m.sortNoCustom), viewButton());
  watchScroll(scroller, bar);
  const wrap = h("div", { class: "tiles-wrap" });
  const folders = m.entries.filter(e => e.kind === "folder");
  if (folders.length) wrap.appendChild(h("div", { class: "tiles-folders" }, folders.map(e => folderCard(e.folder, e.linked))));
  // Abschnitte (Überschriften wie am Handy), darin die Karten
  const sections = [{ title: null, cards: [] }];
  let shown = 0;
  for (const e of m.entries) {
    if (e.kind === "divider") {
      if (e.divider.kind === 0) sections.push({ title: e.divider.title || "Abschnitt", cards: [] });
      continue;
    }
    if (e.kind !== "note") continue;
    if (shown >= Math.max(S.listLimit, 200)) { shown++; continue; }
    sections[sections.length - 1].cards.push(noteCard(e.note, { tile: true, showFolder: m.showFolder }));
    shown++;
  }
  const grids = [];
  for (const s of sections) {
    if (s.title) wrap.appendChild(h("div", { class: "group-title" }, s.title, h("span", { class: "line" })));
    if (!s.cards.length) continue;
    const grid = h("div", { class: "tiles-grid" });
    wrap.appendChild(grid);
    grids.push([grid, s.cards]);
  }
  if (!m.entries.length) wrap.appendChild(h("div", { class: "list-empty" }, icon("note"), m.empty || "Hier ist nichts."));
  const limit = Math.max(S.listLimit, 200);
  if (shown > limit) wrap.appendChild(h("button", { class: "btn subtle small list-more", onclick: () => { S.listLimit = limit + 200; renderMain(); } }, "Weitere " + fmtNum.format(shown - limit) + " anzeigen"));
  scroller.appendChild(wrap);
  replace(main, bar, scroller);
  for (const [grid, cards] of grids) masonry(grid, cards);
}
/** Karten zeilenweise auf Spalten verteilen (immer in die kürzeste) – Reihenfolge wie bei Google Notizen */
function masonry(grid, cards) {
  const width = grid.clientWidth || 800;
  const n = Math.max(1, Math.floor((width + 14) / (240 + 14)));
  grid.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  const cols = Array.from({ length: n }, () => grid.appendChild(h("div", { class: "tiles-col" })));
  const heights = new Array(n).fill(0);
  for (const c of cards) {
    let best = 0;
    for (let i = 1; i < n; i++) if (heights[i] < heights[best] - 1) best = i;
    cols[best].appendChild(c);
    heights[best] = cols[best].offsetHeight;
  }
}
addEventListener("resize", debounce(() => {
  if (S.unlocked && tilesActive() && S.noteId == null && !S.pcId) {
    const ms = $(".main-scroll"), top = ms ? ms.scrollTop : 0;
    renderMain();
    const n = $(".main-scroll");
    if (n) n.scrollTop = top;
  }
}, 200));

// =====================================================================
// Menüs, Dialoge, Großansicht
// =====================================================================
function openMenu(anchor, items) {
  closeMenu();
  const menu = h("div", { class: "menu", role: "menu" });
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { menu.appendChild(h("div", { class: "sep" })); continue; }
    if (it.hd) { menu.appendChild(h("div", { class: "hd" }, it.hd)); continue; }
    menu.appendChild(h("button", { class: it.on ? "on" : "", role: "menuitem", onclick: () => { closeMenu(); it.run(); } },
      it.icon ? icon(it.icon) : h("span", { style: { width: "20px" } }), it.label));
  }
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = Math.min(r.right - mw, innerWidth - mw - 8);
  if (left < 8) left = Math.min(r.left, innerWidth - mw - 8);
  let top = r.bottom + 4;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  menu.style.left = Math.max(8, left) + "px";
  menu.style.top = top + "px";
  const first = $("button", menu);
  first && first.focus();
  setTimeout(() => document.addEventListener("pointerdown", menuOutside, true), 0);
}
function menuOutside(e) { if (!e.target.closest(".menu")) closeMenu(); }
function closeMenu() {
  $(".menu")?.remove();
  document.removeEventListener("pointerdown", menuOutside, true);
}

function openDialog(content, { wide = false, onClose = null } = {}) {
  closeDialog();
  const dlg = h("div", { class: "dialog" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true" }, content);
  const ov = h("div", { class: "overlay", onclick: e => { if (e.target === ov) closeDialog(); } }, dlg);
  ov._onClose = onClose;
  document.body.appendChild(ov);
  const f = $("input, textarea, button", dlg);
  f && f.focus();
  return dlg;
}
function closeDialog() {
  const ov = $(".overlay");
  if (!ov) return false;
  ov.remove();
  ov._onClose && ov._onClose();
  return true;
}
function confirmDialog(title, text, okLabel, danger = false) {
  return new Promise(resolve => {
    let result = false;
    openDialog([
      h("h2", null, title), h("p", { class: "muted" }, text),
      h("div", { class: "actions" },
        h("button", { class: "btn ghost", onclick: () => closeDialog() }, "Abbrechen"),
        h("button", { class: "btn" + (danger ? " danger" : ""), onclick: () => { result = true; closeDialog(); } }, okLabel))
    ], { onClose: () => resolve(result) });
  });
}

/** Großansicht mit Zoom (Mausrad, +/−, Ziehen) */
function openLightbox({ img, svg, name, drawing }) {
  closeLightbox();
  const content = h("div", { class: "lb-content" });
  let natW = 0, natH = 0;
  const stage = h("div", { class: "lb-stage" }, content);
  let scale = 1, tx = 0, ty = 0;
  const apply = () => { content.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`; };
  const fit = () => {
    const sw = stage.clientWidth - 40, sh = stage.clientHeight - 40;
    scale = Math.min(sw / natW, sh / natH, img ? 1 : 4);
    tx = (stage.clientWidth - natW * scale) / 2; ty = (stage.clientHeight - natH * scale) / 2;
    apply();
  };
  const zoom = (f, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) => {
    const ns = Math.min(12, Math.max(0.1, scale * f));
    tx = cx - (cx - tx) * (ns / scale); ty = cy - (cy - ty) * (ns / scale); scale = ns; apply();
  };
  const box = h("div", { class: "lightbox", role: "dialog", "aria-label": "Großansicht" },
    h("div", { class: "lb-bar" }, h("span", { class: "grow ellipsis" }, name || ""),
      iconBtn("zoomOut", "Verkleinern (−)", () => zoom(1 / 1.25)),
      iconBtn("zoomIn", "Vergrößern (+)", () => zoom(1.25)),
      iconBtn("fit", "Einpassen (0)", fit),
      drawing ? iconBtn("download", "Als PNG herunterladen", () => exportDrawing(drawing, name, true)) : null,
      img ? iconBtn("download", "Bild herunterladen", () => fetch(img).then(r => r.blob()).then(b => downloadBlob(b, safeFileName(name) + (b.type === "image/png" ? ".png" : b.type === "image/jpeg" ? ".jpg" : ".webp")))) : null,
      iconBtn("close", "Schließen (Esc)", closeLightbox)),
    stage);
  document.body.appendChild(box);
  if (img) {
    const im = h("img", { src: img, alt: name || "Bild", draggable: "false" });
    content.appendChild(im);
    im.onload = () => { natW = im.naturalWidth; natH = im.naturalHeight; fit(); };
  } else {
    const el = svg();
    const w = Number(el.dataset.w), hh = Number(el.dataset.h);
    natW = 1200; natH = Math.round(1200 * hh / w);
    el.setAttribute("width", natW); el.setAttribute("height", natH);
    content.appendChild(el);
    requestAnimationFrame(fit);
  }
  stage.addEventListener("wheel", e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let drag = null;
  stage.addEventListener("pointerdown", e => { if (e.target.closest(".dl, [style*=pointer]")) return; drag = { x: e.clientX - tx, y: e.clientY - ty }; stage.classList.add("drag"); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", e => { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
  stage.addEventListener("pointerup", () => { drag = null; stage.classList.remove("drag"); });
  stage.addEventListener("dblclick", e => { const r = stage.getBoundingClientRect(); zoom(2, e.clientX - r.left, e.clientY - r.top); });
  box._keys = e => {
    if (e.key === "+" || e.key === "=") zoom(1.25);
    else if (e.key === "-") zoom(1 / 1.25);
    else if (e.key === "0") fit();
  };
}
function closeLightbox() {
  const lb = $(".lightbox");
  if (!lb) return false;
  lb.remove();
  return true;
}
// =====================================================================
// „Vom PC“ – hier schreibt NUR der PC (Datei mynotes-inbox.enc)
// Das Handy zeigt die Notizen unter „Vom PC“ und kann sie übernehmen.
// =====================================================================
function pcVisible() {
  return S.inbox.notes.filter(n => !S.done.has(n.id)).sort((a, b) => b.modified - a.modified);
}
function pcTaken() { return S.inbox.notes.filter(n => S.done.has(n.id)).concat(S.inbox.taken || []); }
function pcNote(id) { return S.inbox.notes.find(n => n.id === id) || (S.inbox.taken || []).find(n => n.id === id) || null; }
function pcDirty() { return !!S.inbox.dirty; }
function firstLine(md) { return (String(md || "").split("\n").find(l => l.trim()) || "").replace(/^#+\s*|^\s*[-*]\s*\[[ xX]\]\s*/g, "").trim().slice(0, 80); }

/** Neue PC-Notiz aus Text. Beim Schnell-Senden: erste Zeile wird Titel, wenn danach noch etwas kommt. */
function createPcNote(text, { fromQuick = false, title = null, folderId = null } = {}) {
  const now = Date.now();
  let md = String(text || "").replace(/\r\n?/g, "\n");
  let t = title;
  if (t == null && fromQuick) {
    const lines = md.split("\n");
    const first = lines[0].trim();
    if (lines.length > 1 && first.length > 0 && first.length <= 80 && !CHECK_RE.test(lines[0]) && lines.slice(1).some(l => l.trim())) {
      t = first.replace(/^#+\s*/, "");
      md = lines.slice(1).join("\n").replace(/^\n+/, "");
    } else if (/^https?:\/\/\S+$/.test(first) && lines.length === 1) {
      t = "Link vom PC";
    } else t = "Vom PC · " + fmtDateShort.format(now) + " " + fmtTime.format(now);
  }
  const note = { id: uuid(), title: t || "", created: now, modified: now, md, blocks: markupToBlocks(md), folderId: folderId ?? null };
  S.inbox.notes.push(note);
  S.inbox.dirty = true;
  return note;
}
function newPcNote(md = "", title = "", folderId = null) {
  const n = createPcNote(md, { title, folderId });
  if (S.route.view !== "pc") { S.route = { view: "pc" }; renderSidebarActive(); }
  S.pcId = n.id; S.noteId = null;
  history.pushState(null, "", routeHash());
  renderList(); renderMain();
  setMobilePane("main");
  setTimeout(() => $(title ? ".editor-area" : ".editor-title")?.focus(), 30);
  saveInboxSoon();
  renderSidebarCounts();
}
function pcFromNote(note) {
  const title = note.template ? note.title : (note.title ? note.title + " (Kopie)" : "Kopie");
  newPcNote(noteToMarkup(note), title);
  toast(note.template ? "Vorlage übernommen – jetzt ausfüllen" : "Kopie angelegt – am Handy entsteht beim Übernehmen eine neue Notiz");
}
async function deletePcNote(id) {
  const idx = S.inbox.notes.findIndex(n => n.id === id);
  if (idx < 0) {
    S.inbox.taken = (S.inbox.taken || []).filter(n => n.id !== id);
    S.pcId = null; renderList(); renderMain();
    return;
  }
  const [removed] = S.inbox.notes.splice(idx, 1);
  S.inbox.dirty = true;
  if (S.pcId === id) { S.pcId = null; history.replaceState(null, "", routeHash()); }
  renderList(); renderMain(); renderSidebarCounts();
  saveInboxSoon();
  toast("PC-Notiz gelöscht", {
    action: {
      label: "Rückgängig", run: () => {
        removed.modified = Date.now();
        S.inbox.notes.push(removed);
        S.inbox.dirty = true;
        saveInboxSoon();
        openPc(removed.id);
        renderSidebarCounts();
      }
    }
  });
}
function renderSidebarCounts() {
  const n = pcVisible().length;
  const el = $('.nav-item[data-view="pc"]');
  if (!el) return;
  let c = $(".count", el);
  if (!n) { c && c.remove(); return; }
  if (!c) { c = h("span", { class: "count badge" }); el.appendChild(c); }
  c.className = "count badge";
  c.textContent = fmtNum.format(n);
}

// ---------------- Laden & Speichern ----------------
function parseInbox(json) {
  if (!json || json.format !== "mynotes-pc-inbox") return { notes: [], checks: [], edits: [], web: null };
  const notes = (json.notes || []).filter(n => n && n.id).map(n => {
    const blocks = Array.isArray(n.blocks) ? n.blocks.map(b => ({ type: b.type || "TEXT", content: b.content || "", checked: !!b.checked, level: b.level || undefined })) : [];
    return {
      id: String(n.id), title: n.title || "", created: n.created || 0, modified: n.modified || 0,
      md: typeof n.md === "string" ? n.md : blocksToMarkup(blocks), blocks,
      folderId: n.folderId != null ? Number(n.folderId) : null // NEU (AS): direkt im Ordner angelegt
    };
  });
  // NEU (AS): Änderungen an vorhandenen Notizen
  const edits = (json.edits || []).filter(e => e && e.id && e.noteId != null).map(e => ({ ...e, id: String(e.id), noteId: Number(e.noteId), at: e.at || 0 }));
  // NEU (AH-3): Haken, die am PC gesetzt wurden (das Handy übernimmt sie)
  const checks = (json.checks || []).filter(c => c && c.id && c.blockId != null)
    .map(c => ({ id: String(c.id), blockId: Number(c.blockId), noteId: Number(c.noteId) || null, checked: !!c.checked, at: c.at || 0 }));
  return { notes, checks, edits, web: json.web && typeof json.web === "object" ? json.web : null };
}
async function loadInbox(file) {
  if (!file) { S.inbox.fileId = null; S.inbox.modifiedTime = null; S.inbox.readable = true; return; }
  const bytes = await downloadFile(file.id);
  try {
    const parsed = parseInbox(await decryptJson(bytes, S.key));
    S.inbox.notes = parsed.notes;
    S.inbox.checks = parsed.checks;
    S.inbox.edits = parsed.edits;
    S.inbox.webRemote = parsed.web;
    S.inbox.readable = true;
  } catch (e) {
    if (!(e instanceof WrongKeyError)) throw e;
    S.inbox.notes = [];
    S.inbox.checks = [];
    S.inbox.edits = [];
    S.inbox.readable = false;
  }
  S.inbox.fileId = file.id;
  S.inbox.modifiedTime = file.modifiedTime;
  S.inbox.base = inboxBase();
}
async function loadDone(file) {
  if (!file) { S.done = new Set(); S.rejected = new Set(); S.doneModified = null; return; }
  if (file.modifiedTime === S.doneModified) return;
  try {
    const json = await decryptJson(await downloadFile(file.id), S.key);
    S.done = new Set((json.done || []).map(String));
    S.rejected = new Set((json.rejected || []).map(String)); // NEU (AS): am Handy verworfen
  } catch (e) {
    if (!(e instanceof WrongKeyError)) throw e;
  }
  S.doneModified = file.modifiedTime;
}
/** Drei-Wege-Abgleich mit dem Stand im Drive (falls ein anderer PC/Tab inzwischen gespeichert hat) */
/** Stand für den Drei-Wege-Abgleich: Notizen (id → geändert) und Haken („c:“ + id → Zeitpunkt) */
function inboxBase() {
  return new Map([...S.inbox.notes.map(n => [n.id, n.modified]), ...(S.inbox.checks || []).map(c => ["c:" + c.id, c.at]),
    ...(S.inbox.edits || []).map(e => ["e:" + e.id, e.at])]);
}
function mergeInbox(remoteNotes, remoteChecks = [], remoteEdits = []) {
  const base = S.inbox.base;
  // NEU (AS): Edits wie Haken – neu hier/woanders bleibt, hier/woanders gelöscht verschwindet
  const le = new Map((S.inbox.edits || []).map(e => [e.id, e])), re = new Map(remoteEdits.map(e => [e.id, e]));
  const edits = [];
  for (const id of new Set([...le.keys(), ...re.keys()])) {
    const l = le.get(id), r = re.get(id);
    if (l && r) edits.push(l);
    else if (l) { if (!base.has("e:" + id)) edits.push(l); }
    else if (r) { if (!base.has("e:" + id)) edits.push(r); }
  }
  S.inbox.edits = edits.sort((a, b) => a.at - b.at);
  // NEU (AH-3): Haken – neu hier/woanders bleibt, hier/woanders gelöscht verschwindet
  const lc = new Map((S.inbox.checks || []).map(c => [c.id, c])), rc = new Map(remoteChecks.map(c => [c.id, c]));
  const checks = [];
  for (const id of new Set([...lc.keys(), ...rc.keys()])) {
    const l = lc.get(id), r = rc.get(id);
    if (l && r) checks.push(l);
    else if (l) { if (!base.has("c:" + id)) checks.push(l); }
    else if (r) { if (!base.has("c:" + id)) checks.push(r); }
  }
  S.inbox.checks = checks;
  const local = new Map(S.inbox.notes.map(n => [n.id, n]));
  const remote = new Map(remoteNotes.map(n => [n.id, n]));
  const result = [];
  for (const id of new Set([...local.keys(), ...remote.keys()])) {
    const l = local.get(id), r = remote.get(id);
    if (l && r) result.push(r.modified > l.modified ? r : l);
    else if (l) { if (!base.has(id) || l.modified > base.get(id)) result.push(l); }      // neu hier – oder woanders gelöscht
    else if (r) { if (!base.has(id) || r.modified > base.get(id)) result.push(r); }      // neu woanders – oder hier gelöscht
  }
  S.inbox.notes = result;
}
let saving = null, saveAgain = false;
async function saveInbox() {
  if (DEMO) { S.inbox.dirty = false; S.inbox.state = "demo"; updateSaveState(); return; }
  if (saving) { saveAgain = true; return saving; }
  saving = (async () => {
    S.inbox.state = "saving"; updateSaveState();
    try {
      if (!tokenValid()) throw new AuthError("Google-Verbindung abgelaufen");
      // 1) Hat jemand anderes inzwischen gespeichert?
      if (S.inbox.fileId) {
        let meta = null;
        try { meta = await fileMeta(S.inbox.fileId); } catch (e) { if (e.status !== 404) throw e; }
        if (!meta || meta.trashed) { S.inbox.fileId = null; S.inbox.base = new Map(); }
        else if (meta.modifiedTime !== S.inbox.modifiedTime && S.inbox.readable) {
          try {
            const remote = parseInbox(await decryptJson(await downloadFile(S.inbox.fileId), S.key));
            mergeInbox(remote.notes, remote.checks, remote.edits);
          } catch (e) { if (!(e instanceof WrongKeyError)) throw e; }
        }
      } else {
        // Datei könnte von einem anderen PC angelegt worden sein
        const files = await listFolder();
        S.files = files;
        const f = files.get(F_INBOX);
        if (f) {
          try {
            const remote = parseInbox(await decryptJson(await downloadFile(f.id), S.key));
            mergeInbox(remote.notes, remote.checks, remote.edits);
          } catch (e) { if (!(e instanceof WrongKeyError)) throw e; }
          S.inbox.fileId = f.id;
        }
      }
      // 2) Am Handy übernommene aufräumen
      const taken = S.inbox.notes.filter(n => S.done.has(n.id));
      if (taken.length) S.inbox.taken = [...(S.inbox.taken || []).filter(t => !taken.some(x => x.id === t.id)), ...taken];
      S.inbox.notes = S.inbox.notes.filter(n => !S.done.has(n.id));
      S.inbox.checks = (S.inbox.checks || []).filter(c => !S.done.has(c.id)); // vom Handy übernommen
      moveAppliedEdits(); // NEU (AS): übernommene Edits bleiben sichtbar, bis der neue Stand da ist
      // 3) Verschlüsselt hochladen
      const payload = {
        format: "mynotes-pc-inbox", v: 2,
        notes: S.inbox.notes.map(n => ({ id: n.id, title: n.title, created: n.created, modified: n.modified, blocks: n.blocks, md: n.md, folderId: n.folderId ?? null })),
        checks: S.inbox.checks || [], // NEU (AH-3)
        edits: S.inbox.edits || [],   // NEU (AS)
        web: { ...S.settings, v: 1 }
      };
      const plain = TE.encode(JSON.stringify(payload));
      if (plain.length > 900_000) toast("„Vom PC“ wird sehr groß – bitte alte PC-Notizen löschen", { bad: true });
      const res = await uploadFile(F_INBOX, await encryptBytes(plain, S.key), S.inbox.fileId);
      S.inbox.fileId = res.id;
      S.inbox.modifiedTime = res.modifiedTime;
      S.inbox.base = inboxBase();
      S.inbox.readable = true;
      S.inbox.dirty = false;
      S.inbox.settingsDirty = false;
      S.inbox.state = "saved";
      S.inbox.savedAt = Date.now();
      if (taken.length) { renderList(); renderSidebarCounts(); }
    } catch (e) {
      S.inbox.state = "error";
      S.inbox.error = e instanceof AuthError ? "Nicht gespeichert – Google-Verbindung abgelaufen" : e instanceof NetError ? "Nicht gespeichert – keine Verbindung" : "Nicht gespeichert – " + e.message;
      if (e instanceof AuthError) renderBanner();
    } finally {
      updateSaveState();
    }
  })();
  try { await saving; } finally {
    saving = null;
    if (saveAgain) { saveAgain = false; saveInbox(); }
  }
}
const saveInboxSoon = debounce(() => saveInbox(), 1200);
const saveSettingsSoon = debounce(() => { applySettings(); S.inbox.settingsDirty = true; if (S.inbox.readable !== false) saveInbox(); }, 1500);
// Wiederholen, falls Speichern fehlschlug
setInterval(() => { if (S.unlocked && S.inbox.dirty && S.inbox.state === "error" && tokenValid() && !saving) saveInbox(); }, 30_000);

function updateSaveState() {
  for (const el of $$(".save-state")) {
    const st = S.inbox.state;
    el.className = "save-state" + (st === "saved" ? " ok" : st === "error" ? " bad" : "");
    replace(el,
      st === "saving" ? h("span", { class: "spinner", style: { width: "12px", height: "12px" } }) : icon(st === "error" ? "warn" : st === "saved" ? "cloud" : "edit", "sm"),
      st === "saving" ? "Speichere …" : st === "saved" ? "Gespeichert " + fmtTime.format(S.inbox.savedAt || Date.now())
        : st === "error" ? (S.inbox.error || "Nicht gespeichert") : st === "demo" ? "Demo – nicht gespeichert" : pcDirty() ? "Ungespeichert" : "Im Drive",
      st === "error" ? h("button", { class: "btn small subtle", style: { marginLeft: "6px" }, onclick: () => tokenValid() ? saveInbox() : renewToken() }, "Erneut") : null);
  }
  $$(".card[data-pc]").forEach(c => {
    const st = $(".pc-status", c);
    if (st && c.dataset.pc === S.pcId) replace(st, pcStatusContent(pcNote(c.dataset.pc)));
  });
}
window.addEventListener("beforeunload", e => {
  if (S.unlocked && (pcDirty() || saving)) { e.preventDefault(); e.returnValue = ""; }
});

// ---------------- Liste ----------------
function pcStatusContent(n) {
  if (!n) return [];
  if (S.rejected && S.rejected.has(n.id)) return [icon("close", "sm"), "Am Handy verworfen"];
  if (S.done.has(n.id) || (S.inbox.taken || []).some(t => t.id === n.id)) return [icon("phone", "sm"), "Am Handy übernommen"];
  if (DEMO) return [icon("cloud", "sm"), "Demo"];
  if (S.inbox.base.get(n.id) === n.modified) return [icon("cloud", "sm"), n.folderId != null && phoneAuto() ? "Im Drive – kommt automatisch in den Ordner" : "Im Drive – wartet aufs Handy"];
  return [icon("edit", "sm"), "Noch nicht gespeichert"];
}
function pcCard(n) {
  const taken = S.done.has(n.id) || (S.inbox.taken || []).some(t => t.id === n.id);
  const prevText = n.md.split("\n").filter(l => l.trim()).slice(0, 4);
  return h("div", {
    class: "card" + (S.pcId === n.id ? " on" : ""), tabindex: "0", role: "button", dataset: { pc: n.id },
    onclick: () => openPc(n.id), onkeydown: e => { if (e.key === "Enter") openPc(n.id); }
  },
  h("div", { class: "card-title" }, h("span", { class: "t" + (n.title.trim() ? "" : " muted") }, n.title.trim() || firstLine(n.md) || "Ohne Titel")),
  prevText.length ? h("div", { class: "card-prev" }, prevText.map(l => {
    const m = CHECK_RE.exec(l);
    return m ? h("div", { class: "ck" + (m[1] !== " " ? " done" : "") }, h("span", { class: "box" }), h("span", null, readable(m[2])))
      : h("div", { class: "ln" }, readable(l.replace(/^#+\s+/, "")));
  })) : null,
  h("div", { class: "card-meta" },
    h("span", { class: "pc-status " + (taken ? "ok" : DEMO || S.inbox.base.get(n.id) === n.modified ? "wait" : "bad") }, pcStatusContent(n)),
    n.folderId != null && folderById(n.folderId) ? h("span", { title: "Kommt am Handy in diesen Ordner" }, icon("folder", "sm"), folderById(n.folderId).name) : null,
    h("span", null, relTime(n.modified))));
}
function renderPcList(list) {
  const body = h("div", { class: "list-body" });
  const notes = pcVisible();
  const taken = pcTaken();
  const tools = h("div", { class: "list-tools" },
    h("button", { class: "btn small", onclick: () => newPcNote() }, icon("add", "sm"), "Neue PC-Notiz"),
    h("button", { class: "chip", onclick: openTemplatePickerNew, title: "Neue PC-Notiz aus einer Vorlage vom Handy" }, icon("template", "sm"), "Aus Vorlage"));
  replace(list, listHead("Vom PC", "Am PC schreiben – am Handy übernehmen", null, null), tools, body);
  if (!S.inbox.readable) body.appendChild(h("div", { class: "panel", style: { marginBottom: "10px", borderColor: "var(--danger)" } }, h("b", null, "Alte PC-Notizen nicht lesbar"),
    h("div", { class: "small muted" }, "Sie wurden mit einem früheren Passwort gespeichert. Sobald du hier etwas speicherst, werden sie ersetzt.")));
  if (!notes.length && !taken.length) {
    body.appendChild(h("div", { class: "list-empty" }, icon("computer"), h("div", null, "Noch keine PC-Notizen."),
      h("div", { class: "small", style: { marginTop: "6px" } }, "Alles, was du hier schreibst, erscheint am Handy auf der Startseite unter „Vom PC“. Dort tippst du auf „Übernehmen“ – fertig.")));
    return;
  }
  notes.forEach(n => body.appendChild(pcCard(n)));
  if (taken.length) {
    body.appendChild(h("div", { class: "group-title" }, "Am Handy übernommen", h("span", { class: "line" })));
    taken.sort((a, b) => b.modified - a.modified).forEach(n => body.appendChild(pcCard(n)));
  }
}

// ---------------- Editor ----------------
function renderPcMain(main) {
  const n = S.pcId ? pcNote(S.pcId) : null;
  if (!n) return renderPcIntro(main);
  const taken = S.done.has(n.id) || (S.inbox.taken || []).some(t => t.id === n.id);
  const scroller = h("div", { class: "main-scroll" });
  const state = h("span", { class: "save-state" });
  const bar = mainBar(backButton() || (matchMedia("(max-width: 760px)").matches ? iconBtn("back", "Zurück", closeNote) : null),
    h("div", { class: "crumbs" }, h("span", { style: { display: "inline-flex", gap: "6px", alignItems: "center", padding: "2px 6px" } }, icon("computer", "sm"), "Vom PC"),
      n.folderId != null && folderById(n.folderId) ? [icon("chevron", "sm"), h("button", { onclick: () => go({ view: "folder", id: n.folderId }, null), title: "Ordner öffnen" }, folderById(n.folderId).name)] : null, state),
    iconBtn(S.settings.previewPane ? "eyeOff" : "eye", S.settings.previewPane ? "Vorschau ausblenden" : "Vorschau zeigen", () => { S.settings.previewPane = !S.settings.previewPane; saveSettingsSoon(); renderMain(); }),
    iconBtn("copy", "Text kopieren", () => copyText((n.title ? n.title + "\n\n" : "") + n.md, "Kopiert")),
    iconBtn("trash", "PC-Notiz löschen", async () => {
      if (taken || (!n.md.trim() && !n.title.trim()) || await confirmDialog("PC-Notiz löschen?", "„" + (n.title || firstLine(n.md) || "Ohne Titel") + "“ wird aus „Vom PC“ entfernt. Am Handy verschwindet sie beim nächsten Abgleich.", "Löschen", true)) deletePcNote(n.id);
    }),
    iconBtn("close", "Schließen", closeNote));
  watchScroll(scroller, bar);
  const wrap = h("div", { class: "editor-wrap" });
  if (taken) {
    wrap.appendChild(h("div", { class: "panel", style: { margin: "8px 0 16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" } },
      h("span", { style: { color: "var(--ok)" } }, icon("phone", "lg")),
      S.rejected && S.rejected.has(n.id) ? h("div", { class: "grow" }, h("b", null, "Am Handy verworfen"), h("div", { class: "small muted" }, "Diese PC-Notiz wurde am Handy nicht übernommen. Du kannst sie als neue PC-Notiz weiterschreiben.")) :
      h("div", { class: "grow" }, h("b", null, "Am Handy übernommen"), h("div", { class: "small muted" }, (n.folderId != null && folderById(n.folderId) ? "Diese Notiz liegt jetzt am Handy in „" + folderById(n.folderId).name + "“." : "Diese Notiz ist jetzt eine normale Notiz am Handy (in „Notizen ohne Ordner“).") + " Weiter bearbeiten: sobald sie in der Liste auftaucht, dort „Bearbeiten“.")),
      h("button", { class: "btn subtle", onclick: () => newPcNote(n.md, n.title ? n.title + " (neu)" : "") }, "Als neue PC-Notiz weiterschreiben")));
    wrap.appendChild(h("h1", { class: "note-title" }, n.title || "Ohne Titel"));
    wrap.appendChild(renderBlocks(markupToBlocks(n.md), { preview: true }));
    scroller.appendChild(wrap);
    replace(main, bar, scroller);
    updateSaveState();
    return;
  }
  const titleIn = h("input", { class: "editor-title", placeholder: "Titel", value: n.title, maxlength: "300", "aria-label": "Titel" });
  const area = h("textarea", { class: "editor-area", spellcheck: "true", placeholder: "Schreib los …\n\n## Überschrift\n- [ ] Checkliste\n---  (Trennlinie)\n```  Code  ```", "aria-label": "Text" });
  area.value = n.md;
  const preview = h("div", { class: "editor-preview" });
  const counter = h("span", { class: "small muted" });
  const refreshPreview = () => {
    const blocks = markupToBlocks(area.value);
    replace(preview, h("div", { class: "pv-title" }, icon("phone", "sm"), "So kommt es aufs Handy"),
      n.title || titleIn.value ? h("h1", { class: "note-title" }, titleIn.value) : null,
      blocks.length ? renderBlocks(blocks, { preview: true }) : h("div", { class: "muted small" }, "(noch leer)"));
    const words = (titleIn.value + " " + area.value).split(/\s+/).filter(Boolean).length;
    counter.textContent = plural(words, "Wort", "Wörter") + " · " + fmtNum.format(area.value.length) + " Zeichen";
  };
  const changed = () => {
    n.title = titleIn.value;
    n.md = area.value;
    n.blocks = markupToBlocks(area.value);
    n.modified = Date.now();
    S.inbox.dirty = true;
    S.inbox.state = "dirty";
    updateSaveState();
    if (S.settings.previewPane) refreshPreviewSoon();
    else refreshCounter();
    updatePcCard(n);
    saveInboxSoon();
  };
  const refreshPreviewSoon = debounce(refreshPreview, 250);
  const refreshCounter = debounce(() => {
    const words = (titleIn.value + " " + area.value).split(/\s+/).filter(Boolean).length;
    counter.textContent = plural(words, "Wort", "Wörter") + " · " + fmtNum.format(area.value.length) + " Zeichen";
  }, 300);
  titleIn.addEventListener("input", changed);
  titleIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); area.focus(); } });
  area.addEventListener("input", changed);
  area.addEventListener("keydown", e => editorKeys(e, area));
  const tb = (iconName, label, title, fn) => h("button", { class: "tb", title, type: "button", onclick: () => { fn(); if (!$(".overlay")) area.focus(); } }, icon(iconName, "sm"), label);
  const toolbar = h("div", { class: "toolbar" },
    tb("checkbox", "Checkliste", "Zeilen als Checkliste (- [ ] )", () => toggleLines(area, "- [ ] ", /^\s*[-*]\s*\[[ xX]\]\s?/)),
    tb("heading", "Überschrift", "Zeile als Überschrift (## )", () => toggleLines(area, "## ", /^#{1,6}\s+/)),
    tb("heading", "Über", "Zeile als Über-Überschrift (# ) – klappt die Überschriften darunter mit ein", () => toggleLines(area, "# ", /^#{1,6}\s+/)),
    tb("code", "Code", "Als Code-Block", () => wrapCode(area)),
    tb("hr", "Trennlinie", "Trennlinie einfügen", () => insertText(area, (atLineStart(area) ? "" : "\n") + "---\n")),
    h("span", { class: "sep" }),
    tb("link", "Link zu Notiz", "Link auf eine Handy-Notiz einfügen", () => openLinkPicker(area)),
    tb("template", "Vorlage", "Inhalt einer Vorlage einfügen", () => openTemplatePickerInsert(area)));
  wrap.append(
    h("div", { class: "editor-head" }, titleIn),
    toolbar,
    h("div", { class: "editor-cols" + (S.settings.previewPane ? "" : " single") }, area, S.settings.previewPane ? preview : null),
    h("div", { class: "editor-help" },
      h("span", null, h("code", null, "# "), " Über-Überschrift"), h("span", null, h("code", null, "## "), " Überschrift"), h("span", null, h("code", null, "- [ ] "), " Checkliste"),
      h("span", null, h("code", null, "- [x] "), " erledigt"), h("span", null, h("code", null, "---"), " Trennlinie"),
      h("span", null, h("code", null, "```"), " Code"), h("span", null, h("kbd", null, "Strg S"), " speichern"),
      h("span", null, n.folderId != null && folderById(n.folderId) ? "Kommt am Handy in „" + folderById(n.folderId).name + "“" : "Am Handy: Startseite → „Vom PC“ → Übernehmen"), h("span", { class: "grow" }), counter));
  scroller.appendChild(wrap);
  replace(main, bar, scroller);
  refreshPreview();
  updateSaveState();
  area.style.height = Math.max(area.scrollHeight + 4, Math.round(innerHeight * 0.55)) + "px";
  area.addEventListener("input", () => { if (area.scrollHeight > area.clientHeight) area.style.height = area.scrollHeight + 4 + "px"; });
}
function updatePcCard(n) {
  const card = $(`.card[data-pc="${CSS.escape(n.id)}"]`);
  if (!card) return;
  const fresh = pcCard(n);
  card.replaceWith(fresh);
}
function renderPcIntro(main) {
  const steps = [
    ["1", "Hier schreiben", "Links auf „Neue PC-Notiz“ – oder auf der Startseite einfach Text einfügen und senden."],
    ["2", "Wird verschlüsselt gespeichert", "Automatisch, in deinem Google Drive (Datei „mynotes-inbox.enc“). Nur mit deinem Passwort lesbar."],
    ["3", "Am Handy übernehmen", "Startseite → „Vom PC“ → Übernehmen. Daraus wird eine normale Notiz in „Notizen ohne Ordner“."]
  ];
  replace(main, h("div", { class: "main-scroll" }, h("div", { class: "dash", style: { maxWidth: "760px" } },
    h("div", { class: "dash-hello" }, h("h1", null, "Vom PC"), h("p", null, "Für ganz neue Notizen. Vorhandene Notizen bearbeitest du direkt in der Notiz („Bearbeiten“), neue Notizen für einen Ordner legst du im Ordner an.")),
    h("div", { class: "dash-grid", style: { gridTemplateColumns: "1fr" } },
      h("div", { class: "panel" }, steps.map(([n, t, d]) => h("div", { style: { display: "flex", gap: "14px", padding: "8px 0" } },
        h("span", { class: "avatar", style: { background: "var(--accent)", color: "var(--on-accent)" } }, n),
        h("div", null, h("b", null, t), h("div", { class: "small muted" }, d))))),
      h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        h("button", { class: "btn big", onclick: () => newPcNote() }, icon("add"), "Neue PC-Notiz"),
        h("button", { class: "btn ghost big", onclick: openTemplatePickerNew }, icon("template"), "Aus Vorlage")),
      h("div", { class: "small muted" }, "Tipp: In jeder Handy-Notiz gibt es oben unter ⋮ „Link kopieren“. Den Link kannst du in eine PC-Notiz einfügen – am Handy wird er zum normalen Notiz-Link.")))));
}

// ---------------- Textfeld-Helfer ----------------
function insertText(area, text) {
  area.focus();
  if (!document.execCommand || !document.execCommand("insertText", false, text)) {
    area.setRangeText(text, area.selectionStart, area.selectionEnd, "end");
    area.dispatchEvent(new Event("input"));
  }
}
function deleteRange(area, start, end) {
  area.focus();
  area.setSelectionRange(start, end);
  if (!document.execCommand || !document.execCommand("delete")) {
    area.setRangeText("", start, end, "end");
    area.dispatchEvent(new Event("input"));
  }
}
function atLineStart(area) { const s = area.selectionStart; return s === 0 || area.value[s - 1] === "\n"; }
function selectLines(area) {
  const v = area.value;
  const start = v.lastIndexOf("\n", area.selectionStart - 1) + 1;
  let end = v.indexOf("\n", area.selectionEnd - (area.selectionEnd > area.selectionStart && v[area.selectionEnd - 1] === "\n" ? 1 : 0));
  if (end < 0) end = v.length;
  area.setSelectionRange(start, end);
  return v.slice(start, end);
}
function toggleLines(area, prefix, re) {
  const text = selectLines(area);
  const lines = text.split("\n");
  const all = lines.every(l => !l.trim() || re.test(l));
  const out = lines.map(l => {
    if (!l.trim()) return l;
    if (all) return l.replace(re, "");
    const clean = l.replace(/^\s*[-*]\s*\[[ xX]\]\s?/, "").replace(/^#{1,6}\s+/, "");
    return prefix + clean;
  }).join("\n");
  insertText(area, out);
}
function wrapCode(area) {
  const sel = area.value.slice(area.selectionStart, area.selectionEnd);
  insertText(area, (atLineStart(area) ? "" : "\n") + "```\n" + sel + (sel.endsWith("\n") || !sel ? "" : "\n") + "```\n");
}
function editorKeys(e, area) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveInboxSoon.cancel(); saveInbox(); return; }
  if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && area.selectionStart === area.selectionEnd) {
    const v = area.value, pos = area.selectionStart;
    const lineStart = v.lastIndexOf("\n", pos - 1) + 1;
    const line = v.slice(lineStart, pos);
    let m = /^(\s*)([-*])\s*\[[ xX]\]\s?(.*)$/.exec(line);
    if (m) {
      e.preventDefault();
      if (!m[3].trim()) deleteRange(area, lineStart, pos);
      else insertText(area, "\n" + m[1] + m[2] + " [ ] ");
      return;
    }
    m = /^(\s*)([-*•])\s(.*)$/.exec(line);
    if (m && !/^(-{3,}|\*{3,})$/.test(line.trim())) {
      e.preventDefault();
      if (!m[3].trim()) deleteRange(area, lineStart, pos);
      else insertText(area, "\n" + m[1] + m[2] + " ");
    }
  }
  if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    insertText(area, "    ");
  }
}

// ---------------- Auswahl-Dialoge ----------------
function notePicker(title, list, onPick, { placeholder = "Suchen …", sub = null } = {}) {
  const input = h("input", { class: "field", placeholder, autocomplete: "off" });
  const box = h("div", { class: "picker-list" });
  let sel = 0, items = [];
  const draw = () => {
    const ts = terms(input.value);
    items = list.filter(n => !ts.length || ts.every(t => norm((n.title || "") + " " + (sub ? sub(n) : "")).includes(t))).slice(0, 60);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    replace(box, items.length ? items.map((n, i) => h("button", { class: i === sel ? "sel" : "", onclick: () => { closeDialog(); onPick(n); } },
      icon(n.template ? "template" : "note", "sm"), h("span", { class: "ellipsis" }, n.title || "Ohne Titel"), sub ? h("span", { class: "sub" }, sub(n)) : null))
      : h("div", { class: "muted small", style: { padding: "10px" } }, "Nichts gefunden."));
  };
  input.addEventListener("input", () => { sel = 0; draw(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); $(".sel", box)?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); $(".sel", box)?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter" && items[sel]) { e.preventDefault(); const it = items[sel]; closeDialog(); onPick(it); }
  });
  openDialog([h("h2", null, title), input, box], { wide: true });
  draw();
  input.focus();
}
function openLinkPicker(area) {
  const notes = [...S.db.notes.values()].filter(n => !n.deleted && !n.template).sort((a, b) => b.modifiedAt - a.modifiedAt);
  const selStart = area.selectionStart, selEnd = area.selectionEnd;
  notePicker("Link auf Handy-Notiz einfügen", notes, n => {
    area.focus();
    area.setSelectionRange(selStart, selEnd);
    insertText(area, linkMarkup(n.title || "Notiz", n.id));
    toast("Link eingefügt – am Handy wird daraus ein normaler Notiz-Link");
  }, { placeholder: "Notiz suchen …", sub: n => n.folderIds.length ? (folderById(n.folderIds[0])?.name || "") : "" });
}
function templates() { return [...S.db.notes.values()].filter(n => n.template && !n.deleted).sort((a, b) => a.title.localeCompare(b.title, "de")); }
function openTemplatePickerNew() {
  const t = templates();
  if (!t.length) { toast("Am Handy gibt es noch keine Vorlagen"); return; }
  notePicker("Neue PC-Notiz aus Vorlage", t, n => pcFromNote(n), { placeholder: "Vorlage suchen …" });
}
function openTemplatePickerInsert(area) {
  const t = templates();
  if (!t.length) { toast("Am Handy gibt es noch keine Vorlagen"); return; }
  const selStart = area.selectionStart, selEnd = area.selectionEnd;
  notePicker("Vorlage einfügen", t, n => {
    area.focus();
    area.setSelectionRange(selStart, selEnd);
    insertText(area, (atLineStart(area) ? "" : "\n") + noteToMarkup(n) + "\n");
    const titleIn = $(".editor-title");
    if (titleIn && !titleIn.value.trim()) { titleIn.value = n.title; titleIn.dispatchEvent(new Event("input")); }
  }, { placeholder: "Vorlage suchen …" });
}


// =====================================================================
// NEU (AH-3): Abhaken am PC – der PC schlägt den Haken vor, das Handy übernimmt ihn
// =====================================================================
function pendingCheck(blockId) {
  return (S.inbox.checks || []).find(c => c.blockId === blockId && !S.done.has(c.id)) || null;
}
function effectiveChecked(b) {
  const p = pendingCheck(b.id);
  return p ? p.checked : b.checked;
}
function canCheckFromPc(note) {
  return !!note && !note.deleted && S.inbox.readable !== false;
}
function toggleCheckFromPc(b) {
  const next = !effectiveChecked(b);
  S.inbox.checks = (S.inbox.checks || []).filter(c => c.blockId !== b.id || S.done.has(c.id));
  if (next !== b.checked) S.inbox.checks.push({ id: uuid(), blockId: b.id, noteId: b.noteId, checked: next, at: Date.now() });
  S.inbox.dirty = true;
  saveInboxSoon();
  renderSidebarCounts();
}
/** Neuer Stand vom Handy: Haken, die dort schon so sind, braucht es nicht mehr */
function dropSatisfiedChecks() {
  if (!S.inbox.checks || !S.inbox.checks.length) return false;
  const before = S.inbox.checks.length;
  S.inbox.checks = S.inbox.checks.filter(c => {
    const note = noteById(c.noteId);
    const b = note && note.blocks.find(x => x.id === c.blockId);
    return b && b.checked !== c.checked;
  });
  return S.inbox.checks.length !== before;
}
// =====================================================================
// NEU (AS): Am PC direkt in Notizen schreiben
//
// Der PC ändert NIE selbst die Notizen – er schickt dem Handy nur „Edits“ (die geänderten
// Stellen, mit dem Stand, den er gesehen hat). Das Handy übernimmt sie automatisch oder nach
// Bestätigung (Einstellung am Handy). Hat sich eine Stelle am Handy inzwischen geändert, bleibt
// die Handy-Fassung und die PC-Fassung kommt als eigene Notiz dazu – nichts geht verloren.
//
// Bis das Handy den neuen Stand hochgeladen hat, zeigt der PC die Änderungen schon an
// (gestrichelt markiert, „→ Handy“).
// =====================================================================
const EDITABLE = new Set(["TEXT", "CHECKLIST_ITEM", "HEADING", "CODE"]);
S.appliedEdits = [];   // vom Handy übernommen, neuer Stand aber noch nicht da
S.edit = null;         // laufende Bearbeitung { noteId, page, title, rows, dirty }

/** Übernimmt das Handy Änderungen automatisch? (steht in pcextras.enc) */
function phoneAuto() { return !(S.extras && S.extras.settings && S.extras.settings.auto === false); }
const levelToPrio = l => (l === 1 || l === 3 ? l : 0);

function pendingEditsFor(noteId) {
  const open = (S.inbox.edits || []).filter(e => e.noteId === noteId && !S.done.has(e.id));
  const applied = S.appliedEdits.filter(x => x.edit.noteId === noteId).map(x => x.edit);
  return [...applied, ...open].sort((a, b) => a.at - b.at);
}
/** Übernommene Edits merken, bis der neue Stand vom Handy da ist (sonst flackert der alte Text kurz auf) */
function moveAppliedEdits() {
  const edits = S.inbox.edits || [];
  const taken = edits.filter(e => S.done.has(e.id));
  if (!taken.length) return;
  let rejected = 0;
  for (const e of taken) {
    if (S.rejected && S.rejected.has(e.id)) { rejected++; continue; } // am Handy verworfen → nicht mehr anzeigen
    if (S.appliedEdits.some(x => x.edit.id === e.id)) continue;
    S.appliedEdits.push({ edit: e, mod: noteById(e.noteId)?.modifiedAt ?? null, at: Date.now() });
  }
  S.inbox.edits = edits.filter(e => !S.done.has(e.id));
  if (rejected) toast(plural(rejected, "Änderung wurde", "Änderungen wurden") + " am Handy verworfen");
}
/** Nach neuem Stand vom Handy: erledigte Edits wegwerfen */
function dropAppliedEdits() {
  const now = Date.now();
  S.appliedEdits = S.appliedEdits.filter(x => {
    const n = noteById(x.edit.noteId);
    return n && n.modifiedAt === x.mod && now - x.at < 10 * 60_000;
  });
}

/** Notiz so, wie sie nach den offenen Edits aussieht (für Anzeige und Editor) */
function effectiveNote(note) {
  if (!note) return note;
  const edits = pendingEditsFor(note.id);
  if (!edits.length) return note;
  let title = note.title;
  let blocks = note.blocks.map(b => ({ ...b }));
  const find = id => blocks.findIndex(b => String(b.id) === String(id));
  for (const e of edits) {
    if (e.title && e.title.to != null) title = e.title.to;
    for (const st of e.sets || []) {
      const i = find(st.blockId);
      if (i < 0) continue;
      const b = blocks[i];
      blocks[i] = { ...b, content: st.to, checked: st.checked != null ? st.checked : b.checked, priority: b.type === "HEADING" && st.level != null ? levelToPrio(st.level) : b.priority, pendingEdit: true };
    }
    for (const d of e.dels || []) { const i = find(d.blockId); if (i >= 0) blocks.splice(i, 1); }
    for (const a of e.adds || []) {
      const nb = { id: "t:" + a.tmp, noteId: note.id, type: a.type, content: a.content || "", checked: !!a.checked, priority: a.type === "HEADING" ? levelToPrio(a.level) : 0, highlight: null, collapsed: false, page: a.page || 0, pendingEdit: true };
      let i = a.after != null ? find(a.after) : -1;
      if (i >= 0) blocks.splice(i + 1, 0, nb);
      else if (a.after == null) { const first = blocks.findIndex(b => b.page === nb.page); blocks.splice(first < 0 ? blocks.length : first, 0, nb); }
      else { let last = -1; blocks.forEach((b, k) => { if (b.page === nb.page) last = k; }); blocks.splice(last < 0 ? blocks.length : last + 1, 0, nb); }
    }
  }
  return { ...note, title, blocks, _pending: edits };
}
function canEditFromPc(note) { return !!note && !note.deleted && S.inbox.readable !== false; }

/** Hinweis über der Notiz, solange Änderungen unterwegs sind */
function pendingEditBanner(note) {
  const open = (S.inbox.edits || []).filter(e => e.noteId === note.id && !S.done.has(e.id));
  const applied = S.appliedEdits.some(x => x.edit.noteId === note.id);
  if (!open.length && !applied) return null;
  if (!open.length) return h("div", { class: "edit-banner ok" }, icon("phone", "sm"), h("span", { class: "grow" }, "Am Handy übernommen – der neue Stand kommt gleich."));
  const saved = open.every(e => S.inbox.base.get("e:" + e.id) === e.at) || DEMO;
  return h("div", { class: "edit-banner" }, icon("edit", "sm"),
    h("span", { class: "grow" }, !saved ? "Am PC geändert – wird gespeichert …"
      : phoneAuto() ? "Am PC geändert – das Handy übernimmt es beim nächsten Abgleich (App öffnen oder alle ~15 Min.)."
        : "Am PC geändert – am Handy unter „Vom PC“ bestätigen."),
    h("button", {
      class: "btn subtle small", onclick: async () => {
        if (!await confirmDialog("Änderungen zurücknehmen?", "Die Änderungen vom PC an dieser Notiz werden verworfen, bevor das Handy sie übernimmt.", "Zurücknehmen", true)) return;
        S.inbox.edits = (S.inbox.edits || []).filter(e => !(e.noteId === note.id && !S.done.has(e.id)));
        S.inbox.dirty = true; saveInboxSoon(); renderMain(); toast("Änderungen zurückgenommen");
      }
    }, "Zurücknehmen"));
}

// ---------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------
function startEdit(note, page) {
  if (!canEditFromPc(note)) { toast("Diese Notiz lässt sich am PC nicht bearbeiten", { bad: true }); return; }
  const eff = effectiveNote(note);
  const blocks = blocksOfPage(eff, page);
  S.edit = {
    noteId: note.id, page, dirty: false,
    titleOrig: eff.title, title: eff.title,
    orig: blocks.map(b => ({ id: b.id, type: b.type, content: b.content, checked: !!b.checked, level: b.type === "HEADING" ? headingLevel(b) : null })),
    rows: blocks.map(b => ({ key: uuid(), origId: b.id, type: b.type, content: b.content, checked: !!b.checked, level: b.type === "HEADING" ? headingLevel(b) : null, block: b }))
  };
  renderMain();
}
function cancelEdit(force) {
  const go2 = () => { S.edit = null; renderMain(); };
  if (force || !S.edit || !S.edit.dirty) return go2();
  confirmDialog("Änderungen verwerfen?", "Was du hier geändert hast, wird nicht gespeichert.", "Verwerfen", true).then(ok => { if (ok) go2(); });
}
function editMarkDirty() { if (S.edit) S.edit.dirty = true; }

/** Edit aus dem Editor-Stand bauen (nur echte Änderungen) */
function buildEdit(note) {
  const ed = S.edit;
  const origById = new Map(ed.orig.map(o => [String(o.id), o]));
  const sets = [], dels = [], adds = [];
  const present = new Set();
  let prevRef = null; // Bezug für neue Blöcke: vorheriger Block (ID oder „t:…“)
  for (const r of ed.rows) {
    if (r.origId != null) {
      const o = origById.get(String(r.origId));
      present.add(String(r.origId));
      if (o && EDITABLE.has(o.type)) {
        const changed = o.content !== r.content || o.checked !== r.checked || (o.type === "HEADING" && o.level !== r.level);
        if (changed) sets.push({ blockId: o.id, from: o.content, to: r.content, checked: o.type === "CHECKLIST_ITEM" ? r.checked : null, level: o.type === "HEADING" ? r.level : null });
      }
      prevRef = r.origId;
    } else {
      if (r.type !== "DIVIDER" && !r.content.trim() && r.type !== "CHECKLIST_ITEM") continue; // leere Textblöcke nicht schicken
      if (r.type === "CHECKLIST_ITEM" && !r.content.trim()) continue;
      const tmp = uuid().replace(/-/g, "").slice(0, 12);
      adds.push({ tmp, after: prevRef, page: ed.page, type: r.type, content: r.type === "DIVIDER" ? "" : r.content, checked: !!r.checked, level: r.type === "HEADING" ? r.level : null });
      prevRef = "t:" + tmp;
    }
  }
  for (const o of ed.orig) if (!present.has(String(o.id)) && (EDITABLE.has(o.type) || o.type === "DIVIDER")) dels.push({ blockId: o.id, from: o.content });
  const title = ed.title !== ed.titleOrig ? { from: ed.titleOrig, to: ed.title } : null;
  if (!title && !sets.length && !dels.length && !adds.length) return null;
  return { id: uuid(), noteId: note.id, noteTitle: ed.title || note.title, at: Date.now(), base: note.modifiedAt, title, sets, dels, adds };
}
async function saveEdit(note) {
  const edit = buildEdit(note);
  if (!edit) { cancelEdit(true); toast("Keine Änderungen"); return; }
  S.inbox.edits = [...(S.inbox.edits || []), edit];
  S.inbox.dirty = true;
  S.edit = null;
  renderMain();
  renderSidebarCounts();
  await saveInbox();
  toast(phoneAuto() ? "Gespeichert ✓ – das Handy übernimmt die Änderungen automatisch" : "Gespeichert ✓ – am Handy unter „Vom PC“ bestätigen");
}

function renderNoteEditor(main, note) {
  const ed = S.edit;
  const scroller = h("div", { class: "main-scroll" });
  const bar = mainBar(h("div", { class: "crumbs" }, h("span", { style: { padding: "2px 6px", display: "inline-flex", gap: "6px", alignItems: "center" } }, icon("edit", "sm"), "Bearbeiten – kommt aufs Handy")),
    h("button", { class: "btn ghost small", onclick: () => cancelEdit(false) }, "Abbrechen"),
    h("button", { class: "btn small", onclick: () => saveEdit(note) }, icon("send", "sm"), "Speichern"));
  watchScroll(scroller, bar);
  const wrap = h("div", { class: "editor-wrap note-editor" });
  const titleIn = h("input", { class: "editor-title", value: ed.title, placeholder: "Titel", maxlength: "300", "aria-label": "Titel" });
  titleIn.addEventListener("input", () => { ed.title = titleIn.value; editMarkDirty(); });
  titleIn.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); focusRow(0, false); } });
  const list = h("div", { class: "erows" });
  const info = h("div", { class: "small muted edit-hint" },
    note.pages ? "Seite „" + note.pages[ed.page] + "“ · " : "",
    "Rechnungen, Tabellen, Zeichnungen & Co. bleiben unverändert (am Handy bearbeiten). ",
    h("kbd", null, "Strg S"), " speichern · ", h("kbd", null, "Esc"), " abbrechen");

  const rowEls = [];
  function draw() {
    clear(list);
    rowEls.length = 0;
    ed.rows.forEach((r, i) => { const el = rowEl(r, i); rowEls.push(el); list.appendChild(el); });
    if (!ed.rows.length) list.appendChild(h("div", { class: "muted small", style: { padding: "8px 4px" } }, "(leer – unten etwas hinzufügen)"));
  }
  function focusRow(i, atEnd = true) {
    const el = rowEls[Math.max(0, Math.min(i, rowEls.length - 1))];
    const ta = el && $("textarea", el);
    if (!ta) return;
    ta.focus();
    const p = atEnd ? ta.value.length : 0;
    ta.setSelectionRange(p, p);
  }
  function insertRow(at, type, content = "", focus = true) {
    ed.rows.splice(at, 0, { key: uuid(), origId: null, type, content, checked: false, level: type === "HEADING" ? 2 : null });
    editMarkDirty();
    draw();
    if (focus) focusRow(at, false); // sofort – sonst landen schnell getippte Zeichen kurz außerhalb
  }
  function removeRow(i, focusPrev = true) {
    ed.rows.splice(i, 1);
    editMarkDirty();
    draw();
    if (focusPrev) focusRow(i - 1, true);
  }
  const grow = ta => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
  function addMenu(anchor, at) {
    openMenu(anchor, [
      { hd: "Darunter einfügen" },
      { label: "Text", icon: "note", run: () => insertRow(at, "TEXT") },
      { label: "Checkliste", icon: "checkbox", run: () => insertRow(at, "CHECKLIST_ITEM") },
      { label: "Überschrift", icon: "heading", run: () => insertRow(at, "HEADING") },
      { label: "Code", icon: "code", run: () => insertRow(at, "CODE") },
      { label: "Trennlinie", icon: "hr", run: () => insertRow(at, "DIVIDER", "", false) }
    ]);
  }
  function rowEl(r, i) {
    const tools = h("div", { class: "erow-tools" },
      h("button", { class: "icon-btn sm", title: "Darunter einfügen", type: "button", onclick: e => addMenu(e.currentTarget, i + 1) }, icon("add", "sm")));
    if (!EDITABLE.has(r.type) && r.type !== "DIVIDER") {
      // Sonderblock: nur anzeigen
      const prev = renderBlock(r.block, { note, preview: true, pageBlocks: ed.rows.map(x => x.block).filter(Boolean) });
      return h("div", { class: "erow locked", title: "Am Handy bearbeiten" }, h("div", { class: "erow-lock" }, icon("phone", "sm")), h("div", { class: "grow" }, prev || h("span", { class: "muted small" }, "(" + r.type + ")")), tools);
    }
    if (r.type === "DIVIDER") {
      tools.appendChild(h("button", { class: "icon-btn sm", title: "Trennlinie löschen", type: "button", onclick: () => removeRow(i, false) }, icon("close", "sm")));
      return h("div", { class: "erow divider" }, h("hr", { class: "b-divider grow" }), tools);
    }
    const ta = h("textarea", { class: "erow-text t-" + r.type.toLowerCase() + (r.type === "HEADING" ? " lv" + r.level : ""), rows: "1", spellcheck: "true", placeholder: r.type === "HEADING" ? "Überschrift" : r.type === "CHECKLIST_ITEM" ? "Punkt" : r.type === "CODE" ? "Code" : "Text" });
    ta.value = r.content;
    ta.addEventListener("input", () => { r.content = ta.value; editMarkDirty(); grow(ta); });
    ta.addEventListener("keydown", e => {
      const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveEdit(note); return; }
      if (e.key === "Escape") { e.preventDefault(); cancelEdit(false); return; }
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && (r.type === "CHECKLIST_ITEM" || r.type === "HEADING")) {
        e.preventDefault();
        if (r.type === "CHECKLIST_ITEM" && !r.content.trim() && r.origId == null) { r.type = "TEXT"; editMarkDirty(); draw(); focusRow(i); return; }
        const before = ta.value.slice(0, ta.selectionStart), after = ta.value.slice(ta.selectionEnd);
        r.content = before;
        insertRow(i + 1, r.type === "HEADING" ? "TEXT" : "CHECKLIST_ITEM", after);
        return;
      }
      if (e.key === "Backspace" && atStart && !ta.value && r.origId == null) { e.preventDefault(); removeRow(i); return; }
      if (e.key === "ArrowUp" && atStart && i > 0) { e.preventDefault(); focusRow(i - 1); }
      if (e.key === "ArrowDown" && ta.selectionStart === ta.value.length && i < ed.rows.length - 1) { e.preventDefault(); focusRow(i + 1, false); }
    });
    setTimeout(() => grow(ta), 0);
    let lead = null;
    if (r.type === "CHECKLIST_ITEM") {
      lead = h("button", { class: "box live" + (r.checked ? " on" : ""), type: "button", role: "checkbox", "aria-checked": String(r.checked), title: "Abhaken",
        onclick: () => { r.checked = !r.checked; editMarkDirty(); draw(); focusRow(i); } });
    } else if (r.type === "HEADING") {
      lead = h("select", { class: "lv-select", title: "Ebene", onchange: e => { r.level = Number(e.target.value); editMarkDirty(); draw(); } },
        [[1, "Über"], [2, "Normal"], [3, "Unter"]].map(([v, l]) => h("option", { value: String(v), selected: r.level === v }, l)));
    }
    tools.appendChild(h("button", { class: "icon-btn sm", title: r.origId == null ? "Entfernen" : "Löschen (am Handy nur, wenn dort unverändert)", type: "button", onclick: () => removeRow(i, false) }, icon("close", "sm")));
    return h("div", { class: "erow t-" + r.type.toLowerCase() + (r.checked ? " done" : "") + (r.origId == null ? " new" : "") }, lead, ta, tools);
  }
  draw();
  const adders = h("div", { class: "eadd" },
    [["TEXT", "note", "Text"], ["CHECKLIST_ITEM", "checkbox", "Checkliste"], ["HEADING", "heading", "Überschrift"], ["CODE", "code", "Code"], ["DIVIDER", "hr", "Trennlinie"]]
      .map(([t, ic, l]) => h("button", { class: "chip", type: "button", onclick: () => insertRow(ed.rows.length, t, "", t !== "DIVIDER") }, icon(ic, "sm"), l)));
  wrap.append(h("div", { class: "editor-head" }, titleIn), info, list, adders,
    h("div", { class: "edit-foot small muted" }, icon("shield", "sm"),
      " Das Handy ändert nur Stellen, die dort noch so sind wie hier zu sehen. Wurde etwas am Handy inzwischen geändert, bleibt das – deine PC-Fassung kommt dann als eigene Notiz „⚠ Vom PC (Konflikt)“ dazu."));
  scroller.appendChild(wrap);
  replace(main, bar, scroller);
  if (!ed.rows.length) titleIn.focus();
}

// ---------------------------------------------------------------------
// Neue Notiz direkt in einem Ordner (am Handy automatisch oder nach Bestätigung im Ordner)
// ---------------------------------------------------------------------
function newNoteInFolder(folderId) {
  if (S.inbox.readable === false) { toast("„Vom PC“ ist gerade nicht lesbar", { bad: true }); return; }
  newPcNote("", "", folderId);
  toast(phoneAuto() ? "Neue Notiz – kommt am Handy automatisch in diesen Ordner" : "Neue Notiz – am Handy unter „Vom PC“ bestätigen");
}
window.addEventListener("beforeunload", e => {
  if (S.unlocked && S.edit && S.edit.dirty) { e.preventDefault(); e.returnValue = ""; }
});
// =====================================================================
// NEU (AT): Zwei Notizen nebeneinander
//  - Notiz-Karte mit Strg/⌘-Klick oder Mittelklick, Rechtsklick → „Daneben öffnen“,
//    oder in der Notiz ⋯ → „Daneben öffnen …“
//  - Breit genug: zwei Spalten, jede mit eigener Leiste und eigenem Scrollen, Trenner verschiebbar.
//    Schmal: Reiter oben, es ist immer nur eine Notiz zu sehen – nichts überlappt.
//  - Die Liste wird dafür ausgeblendet (mehr Platz); Schließen bringt sie zurück.
// =====================================================================
S.split = { noteId: null, ratio: 0.5, active: "a" };
const SPLIT_MIN_W = 880;   // darunter Reiter statt Spalten

function splitActive() {
  return S.split.noteId != null && S.noteId != null && !S.pcId && !!noteById(S.split.noteId) && S.split.noteId !== S.noteId;
}
function openSplit(id) {
  const note = noteById(id);
  if (!note) { toast("Notiz nicht gefunden"); return; }
  if (matchMedia("(max-width: 760px)").matches) { openNote(id); return; } // Handy-Breite: normal öffnen
  if (S.noteId == null || S.pcId) { openNote(id); toast("Tipp: Mit Strg + Klick auf eine zweite Notiz öffnest du sie daneben"); return; }
  if (S.noteId === note.id) { toast("Diese Notiz ist schon offen"); return; }
  S.split.noteId = note.id;
  S.split.active = "b";
  renderShellSplit();
  renderMain();
}
function closeSplit(which = "b") {
  const closed = which === "a" ? S.noteId : S.split.noteId;
  if (S.edit && S.edit.noteId === closed && !S.edit.dirty) S.edit = null;
  if (which === "a" && S.split.noteId != null) {
    // linke schließen → rechte rückt nach
    S.noteId = S.split.noteId;
    history.replaceState(null, "", routeHash());
  }
  S.split.noteId = null;
  S.split.active = "a";
  renderShellSplit();
  markListSelection();
  renderMain();
}
function swapSplit() {
  if (!splitActive()) return;
  const a = S.noteId;
  S.noteId = S.split.noteId;
  S.split.noteId = a;
  history.replaceState(null, "", routeHash());
  renderMain();
}
function renderShellSplit() {
  const shell = $(".shell");
  if (shell) shell.classList.toggle("split-on", splitActive());
}
function pickSplitNote() {
  const notes = [...S.db.notes.values()].filter(n => !n.deleted && n.id !== S.noteId).sort((a, b) => b.modifiedAt - a.modifiedAt);
  notePicker("Daneben öffnen", notes, n => openSplit(n.id), { placeholder: "Notiz suchen …", sub: n => n.folderIds.length ? (folderById(n.folderIds[0])?.name || "") : "" });
}

/** Hauptbereich mit zwei Notizen */
function renderSplit(main) {
  renderShellSplit();
  const paneA = h("div", { class: "pane pane-a" + (S.split.active === "a" ? " active" : ""), onpointerdown: () => setActivePane("a") });
  const paneB = h("div", { class: "pane pane-b" + (S.split.active === "b" ? " active" : ""), onpointerdown: () => setActivePane("b") });
  const handle = h("div", { class: "split-handle", title: "Ziehen zum Verschieben · Doppelklick: Mitte", role: "separator", "aria-orientation": "vertical" });
  const tabs = h("div", { class: "split-tabs", role: "tablist" });
  const box = h("div", { class: "split-box" }, paneA, handle, paneB);
  const root = h("div", { class: "split-root" }, tabs, box);
  replace(main, root);
  main.classList.add("split");
  const applyRatio = () => box.style.setProperty("--split-a", (S.split.ratio * 100).toFixed(2) + "%");
  applyRatio();
  const noteA = noteById(S.noteId), noteB = noteById(S.split.noteId);
  renderNote(paneA, {}, { noteId: S.noteId, pane: "a" });
  renderNote(paneB, {}, { noteId: S.split.noteId, pane: "b" });
  const tab = (key, n) => h("button", { class: S.split.active === key ? "on" : "", role: "tab", onclick: () => setActivePane(key) },
    h("span", { class: "ellipsis" }, n?.title || "Ohne Titel"));
  replace(tabs, tab("a", noteA), tab("b", noteB),
    iconBtn("swap", "Seiten tauschen", swapSplit, "sm"), iconBtn("close", "Zweite Notiz schließen", () => closeSplit("b"), "sm"));
  // Trenner ziehen
  let drag = null;
  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    drag = { left: box.getBoundingClientRect().left, width: box.clientWidth };
    handle.setPointerCapture(e.pointerId);
    box.classList.add("dragging");
  });
  handle.addEventListener("pointermove", e => {
    if (!drag) return;
    S.split.ratio = Math.min(0.75, Math.max(0.25, (e.clientX - drag.left) / drag.width));
    applyRatio();
  });
  const end = () => { if (!drag) return; drag = null; box.classList.remove("dragging"); };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  handle.addEventListener("dblclick", () => { S.split.ratio = 0.5; applyRatio(); });
  // Breite beobachten: zu schmal → Reiter
  const fit = () => root.classList.toggle("narrow", main.clientWidth < SPLIT_MIN_W);
  fit();
  if (main._splitObs) main._splitObs.disconnect();
  if ("ResizeObserver" in window) { main._splitObs = new ResizeObserver(fit); main._splitObs.observe(main); }
}
function setActivePane(key) {
  if (S.split.active === key) return;
  S.split.active = key;
  $$(".split-root .pane").forEach(p => p.classList.toggle("active", p.classList.contains("pane-" + key)));
  $$(".split-tabs [role=tab]").forEach((t, i) => t.classList.toggle("on", (i === 0 ? "a" : "b") === key));
}

/** Rechtsklick-Menü auf Notiz-Karten */
function noteContextMenu(e, note) {
  e.preventDefault();
  const anchor = { getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) };
  openMenu(anchor, [
    { label: "Öffnen", icon: "open", run: () => openNote(note.id) },
    { label: "Daneben öffnen", icon: "split", run: () => openSplit(note.id) },
    { sep: true },
    { label: "Als Text kopieren", icon: "copy", run: () => copyText(notePlainText(note), "Notiz kopiert") },
    { label: "Link kopieren (für „Vom PC“)", icon: "link", run: () => copyText(linkMarkup(note.title || "Notiz", note.id), "Link kopiert") },
    canEditFromPc(note) ? { label: "Am PC bearbeiten", icon: "edit", run: () => { openNote(note.id); startEdit(note, 0); } } : null
  ]);
}
// =====================================================================
// Anmelden → PC-Kopie finden → Passwort → App
// =====================================================================
function gate(...content) {
  const app = $("#app");
  replace(app, h("div", { class: "gate" }, h("div", { class: "gate-card" }, ...content)));
  return app;
}
function gateFoot() {
  return h("div", { class: "gate-foot" },
    h("div", { class: "row" }, icon("shield", "sm"), h("span", null, "Ende-zu-Ende verschlüsselt: Entschlüsselt wird nur hier in diesem Fenster – mit deinem Passwort.")),
    h("div", { class: "row" }, icon("eyeOff", "sm"), h("span", null, "Nichts wird im Browser gespeichert. Tab zu = alles weg.")),
    h("div", { class: "row" }, icon("lock", "sm"), h("span", null, "Google sieht nur verschlüsselte Dateien. Die App sieht nur ihre eigenen Dateien (nicht dein restliches Drive).")));
}
function showLogin(message, bad) {
  S.unlocked = false;
  const btn = h("button", { class: "btn big" }, icon("google"), "Mit Google anmelden");
  const msg = h("div", { class: "gate-msg" + (bad ? " bad" : "") }, message || "");
  btn.onclick = async () => {
    btn.disabled = true;
    msg.className = "gate-msg";
    msg.textContent = "Anmeldefenster ist offen …";
    try {
      if (!(await waitForGis())) throw new Error("Google-Anmeldung lädt nicht – Internet/Werbeblocker prüfen und neu laden.");
      await requestToken(S.user ? "" : undefined);
      await connect();
    } catch (e) {
      btn.disabled = false;
      msg.className = "gate-msg bad";
      msg.textContent = e.message;
    }
  };
  gate(h("img", { class: "logo-img", src: "logo.png", alt: "" }), h("h1", null, "MyNotes am PC"),
    h("p", null, "Deine Handy-Notizen ansehen, durchsuchen und kopieren – und neue Notizen ans Handy schicken."),
    btn, msg,
    h("p", { class: "small", style: { marginTop: "16px" } }, "Voraussetzung am Handy: Einstellungen → „PC-Zugriff (Web-App)“ einschalten (mit verschlüsselter Drive-Sicherung)."),
    gateFoot());
}

/** Nach der Google-Anmeldung: Ordner + PC-Kopie holen */
async function connect() {
  const steps = [["Google-Konto", "a"], ["Ordner „MyNotes PC“ suchen", "b"], ["Verschlüsselte Notizen laden", "c"]];
  const list = h("ul", { class: "gate-steps" }, steps.map(([t, k]) => h("li", { dataset: { k } }, h("span", { class: "st" }, "•"), t)));
  const msg = h("div", { class: "gate-msg" });
  gate(h("img", { class: "logo-img", src: "logo.png", alt: "" }), h("h1", null, "Verbinde …"), list, msg);
  const mark = (k, st) => { const li = $(`li[data-k="${k}"]`, list); if (li) { li.className = st; $(".st", li).textContent = st === "done" ? "✓" : st === "bad" ? "!" : "•"; } };
  let step = "a";
  try {
    mark("a", "run");
    S.user = await driveAbout();
    mark("a", "done"); step = "b"; mark("b", "run");
    S.folderId = await findFolder();
    if (!S.folderId) throw new Error("Im Drive gibt es noch keinen Ordner „MyNotes PC“.\n\nAm Handy: Einstellungen → „PC-Zugriff (Web-App)“ einschalten und „Jetzt hochladen“ tippen. Wichtig: am Handy mit demselben Google-Konto angemeldet sein (" + S.user.email + ").");
    S.files = await listFolder();
    if (!S.files.has(F_MIRROR)) throw new Error("Der Ordner ist da, aber die Notizen fehlen noch.\n\nAm Handy: Einstellungen → „PC-Zugriff (Web-App)“ → „Jetzt hochladen“ tippen und eine Minute warten.");
    mark("b", "done"); step = "c"; mark("c", "run");
    await fetchMirror(S.files.get(F_MIRROR));
    mark("c", "done");
    showUnlock();
  } catch (e) {
    mark(step, "bad");
    msg.className = "gate-msg bad";
    msg.textContent = e.message;
    const card = $(".gate-card");
    card.appendChild(h("div", { style: { display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" } },
      h("button", { class: "btn", style: { width: "auto" }, onclick: () => connect().catch(() => {}) }, icon("refresh"), "Nochmal versuchen"),
      h("button", { class: "btn ghost", style: { width: "auto" }, onclick: () => { revokeToken(); S.user = null; showLogin(); } }, "Anderes Konto")));
  }
}
/** PC-Kopie (noch verschlüsselt) herunterladen und auspacken */
async function fetchMirror(file) {
  const zip = await readZip(await downloadFile(file.id));
  if (!zip["meta.json"] || !zip["backup.enc"]) throw new Error("Die PC-Kopie ist unvollständig – am Handy „Jetzt hochladen“ tippen.");
  const meta = JSON.parse(TD.decode(zip["meta.json"]));
  if (!meta.encrypted || !meta.salt) throw new Error("Die PC-Kopie ist nicht verschlüsselt – das sollte nicht passieren. Bitte am Handy die Verschlüsselung prüfen.");
  S.zip = zip;
  S.meta = meta;
  S.mirror = { id: file.id, modifiedTime: file.modifiedTime };
}

function showUnlock(message) {
  S.unlocked = false;
  const user = S.user || {};
  const input = h("input", {
    class: "field", type: "password", placeholder: "Passwort bzw. Code der Drive-Sicherung", autocomplete: "off",
    "data-lpignore": "true", "aria-label": "Passwort", spellcheck: "false", name: "mn-" + Math.random().toString(36).slice(2)
  });
  const eye = iconBtn("eye", "Passwort zeigen", () => { input.type = input.type === "password" ? "text" : "password"; });
  const btn = h("button", { class: "btn big" }, icon("lock"), "Entsperren");
  const msg = h("div", { class: "gate-msg" + (message ? " bad" : "") }, message || "");
  const go = async () => {
    const secret = input.value;
    if (!secret) { input.focus(); return; }
    btn.disabled = true; input.disabled = true;
    replace(btn, h("span", { class: "spinner" }), "Entschlüssele …");
    msg.className = "gate-msg"; msg.textContent = "";
    try {
      await unlock(secret);
    } catch (e) {
      btn.disabled = false; input.disabled = false;
      replace(btn, icon("lock"), "Entsperren");
      msg.className = "gate-msg bad";
      msg.textContent = e.message;
      input.select();
    }
  };
  btn.onclick = go;
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  gate(h("img", { class: "logo-img", src: "logo.png", alt: "" }), h("h1", null, "Entsperren"),
    h("div", { class: "gate-user" },
      user.photo ? h("img", { src: user.photo, alt: "", referrerpolicy: "no-referrer" }) : h("span", { class: "avatar" }, initials(user.name)),
      h("div", { class: "grow" }, h("div", { style: { fontWeight: 600 } }, user.name || "Angemeldet"), h("div", { class: "small muted" }, user.email || "")),
      h("button", { class: "btn ghost small", onclick: logout }, "Abmelden")),
    h("p", null, "Stand vom Handy: ", h("b", { style: { color: "var(--text)" } }, S.meta ? relTime(S.meta.createdAt) : "–"),
      S.meta ? h("span", { class: "small" }, " (" + fullTime(S.meta.createdAt) + ")") : null),
    h("div", { class: "pw-row" }, input, eye), btn, msg, gateFoot());
  setTimeout(() => input.focus(), 30);
}

async function unlock(secret) {
  const key = await deriveKey(secret, b64url(S.meta.salt), S.meta.iterations || 210000);
  let snap;
  try { snap = await decryptJson(S.zip["backup.enc"], key); }
  catch (e) { throw new Error(e instanceof WrongKeyError ? "Falsches Passwort bzw. falscher Code." : "Entschlüsseln fehlgeschlagen: " + e.message); }
  if (snap.format !== "mynotes-backup") throw new Error("Unbekanntes Format der PC-Kopie.");
  S.key = key;
  S.extras = { calc: {}, work: {} };
  if (S.zip["pcextras.enc"]) {
    try { const x = await decryptJson(S.zip["pcextras.enc"], key); S.extras = { calc: x.calc || {}, work: x.work || {}, settings: x.settings || {} }; } catch (_) {}
  }
  S.db = buildDb(snap);
  // „Vom PC“ + übernommen
  S.inbox = { notes: [], checks: [], fileId: null, modifiedTime: null, base: new Map(), readable: true, taken: [], state: null };
  try {
    await Promise.all([loadInbox(S.files.get(F_INBOX)), loadDone(S.files.get(F_DONE))]);
  } catch (e) { toast("„Vom PC“ konnte nicht geladen werden: " + e.message, { bad: true }); }
  if (S.inbox.webRemote) S.settings = { ...DEFAULT_SETTINGS, ...pickSettings(S.inbox.webRemote) };
  startApp();
}
function pickSettings(o) {
  const out = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (o[k] !== undefined && typeof o[k] === typeof DEFAULT_SETTINGS[k]) out[k] = o[k];
  return out;
}
function startApp() {
  S.unlocked = true;
  S.lastActivity = Date.now();
  S.lastCheck = Date.now();
  applySettings();
  const p = parseHash(location.hash);
  S.route = p.route; S.noteId = p.noteId; S.pcId = p.pcId;
  if (S.route.view === "search") S.route = { view: "home" };
  history.replaceState(null, "", routeHash());
  renderShell();
  revealFolder();
  setMobilePane(S.noteId != null || S.pcId ? "main" : (S.route.view === "home" ? "main" : "list"));
  schedulePoll();
  clearInterval(S.lockTimer);
  S.lockTimer = setInterval(checkIdle, 20_000);
  clearInterval(S.clockTimer);
  S.clockTimer = setInterval(updateSyncLine, 30_000);
  // abgeschlossene „Vom PC“-Notizen aufräumen
  if (!DEMO && S.inbox.notes.some(n => S.done.has(n.id))) saveInbox();
}

// =====================================================================
// Aktualisieren (jede Minute nachsehen, ob das Handy Neues hochgeladen hat)
// =====================================================================
function schedulePoll() {
  clearTimeout(S.pollTimer);
  if (!S.unlocked || DEMO) return;
  S.pollTimer = setTimeout(() => poll(false), document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
}
document.addEventListener("visibilitychange", () => {
  if (!S.unlocked || DEMO) return;
  if (!document.hidden && Date.now() - S.lastCheck > 30_000) poll(false);
  else schedulePoll();
});
async function poll(manual) {
  if (!S.unlocked) return;
  if (DEMO) { if (manual) toast("Demo – es gibt nichts zu aktualisieren"); return; }
  if (S.checking) return;
  if (!tokenValid()) {
    renderBanner();
    if (manual) renewToken();
    schedulePoll();
    return;
  }
  S.checking = true;
  updateSyncLine();
  try {
    const files = await listFolder();
    S.files = files;
    const mirror = files.get(F_MIRROR);
    let changed = 0;
    if (mirror && mirror.modifiedTime !== S.mirror.modifiedTime) changed = await refreshMirror(mirror);
    const done = files.get(F_DONE);
    const doneBefore = S.done.size;
    if (done && done.modifiedTime !== S.doneModified) await loadDone(done);
    const inbox = files.get(F_INBOX);
    if (inbox && inbox.modifiedTime !== S.inbox.modifiedTime && !saving && !pcDirty()) {
      await loadInbox(inbox);
      if (S.route.view === "pc" && !S.pcId) renderList();
    }
    // NEU (AH-3): übernommene Haken aufräumen
    if (((S.inbox.checks || []).some(c => S.done.has(c.id)) || (S.inbox.edits || []).some(e => S.done.has(e.id))) && !saving) {
      saveInbox();
      if (S.noteId != null && !S.edit) renderMain(); // NEU (AS): Hinweis „übernommen“ zeigen
    }
    if (S.done.size !== doneBefore || S.inbox.notes.some(n => S.done.has(n.id))) {
      const newlyTaken = S.inbox.notes.filter(n => S.done.has(n.id));
      if (newlyTaken.length) {
        toast(plural(newlyTaken.length, "PC-Notiz wurde", "PC-Notizen wurden") + " am Handy übernommen 📱");
        saveInbox();
      }
      renderSidebarCounts();
      if (S.route.view === "pc") { renderList(); if (S.pcId && S.done.has(S.pcId)) renderMain(); }
    }
    S.syncError = null;
    S.lastCheck = Date.now();
    if (manual && !changed) toast("Alles aktuell ✓ (Stand vom Handy: " + relTime(S.db.createdAt) + ")");
  } catch (e) {
    if (e instanceof WrongKeyError || e.code === "rekey") {
      lock("Das Passwort wurde am Handy geändert – bitte das neue Passwort eingeben.");
      return;
    }
    S.syncError = e instanceof AuthError ? "Google-Verbindung abgelaufen" : e instanceof NetError ? "Offline – versuche es gleich wieder" : "Fehler: " + e.message;
    if (e instanceof AuthError) renderBanner();
    if (manual) toast(S.syncError, { bad: true });
  } finally {
    S.checking = false;
    updateSyncLine();
    schedulePoll();
  }
}
/** Neue PC-Kopie laden und Ansicht aktualisieren. Liefert die Zahl geänderter Notizen. */
async function refreshMirror(file) {
  const zip = await readZip(await downloadFile(file.id));
  const meta = JSON.parse(TD.decode(zip["meta.json"]));
  if (meta.salt !== S.meta.salt || meta.iterations !== S.meta.iterations) {
    // Passwort wurde am Handy geändert → neu entsperren
    S.zip = zip; S.meta = meta; S.mirror = { id: file.id, modifiedTime: file.modifiedTime };
    const err = new Error("rekey"); err.code = "rekey";
    throw err;
  }
  const snap = await decryptJson(zip["backup.enc"], S.key);
  let extras = { calc: {}, work: {} };
  if (zip["pcextras.enc"]) { try { const x = await decryptJson(zip["pcextras.enc"], S.key); extras = { calc: x.calc || {}, work: x.work || {}, settings: x.settings || {} }; } catch (_) {} }
  const old = S.db;
  const db = buildDb(snap);
  let changed = 0;
  for (const n of db.notes.values()) {
    const o = old.notes.get(n.id);
    if (!o || o.modifiedAt !== n.modifiedAt || o.deleted !== n.deleted || o.archived !== n.archived) { S.fresh.add(n.id); changed++; }
  }
  for (const id of old.notes.keys()) if (!db.notes.has(id)) changed++;
  S.db = db;
  S.extras = extras;
  delete S.db._totals; // NEU (AM)
  dropAppliedEdits();  // NEU (AS): übernommene Änderungen sind jetzt im neuen Stand
  if (dropSatisfiedChecks()) { S.inbox.dirty = true; saveInboxSoon(); } // NEU (AH-3)
  S.meta = meta;
  S.zip = zip;
  S.mirror = { id: file.id, modifiedTime: file.modifiedTime };
  // Ansicht auffrischen, ohne die Position zu verlieren
  const editing = (document.activeElement && document.activeElement.closest(".editor-wrap, .quick, .search-box")) || (S.edit && S.edit.dirty);
  const mainScroll = $(".main-scroll")?.scrollTop || 0;
  rememberScroll();
  const searchFocus = document.activeElement && document.activeElement.closest(".search-box");
  renderSidebar();
  if (searchFocus) { const i = $(".search-box input"); i && (i.focus(), i.setSelectionRange(i.value.length, i.value.length)); }
  renderList();
  if (!editing) {
    renderMain();
    const ms = $(".main-scroll");
    if (ms) ms.scrollTop = mainScroll;
  }
  if (changed) toast("Neuer Stand vom Handy · " + plural(changed, "Notiz geändert", "Notizen geändert"));
  return changed;
}

// =====================================================================
// Sperren, Abmelden, Leerlauf
// =====================================================================
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, () => { S.lastActivity = Date.now(); }, { passive: true, capture: true }));
let lastMove = 0;
addEventListener("mousemove", () => { const t = Date.now(); if (t - lastMove > 5000) { lastMove = t; S.lastActivity = t; } }, { passive: true });
function checkIdle() {
  if (!S.unlocked || DEMO) return;
  const m = S.settings.lockMinutes;
  if (m > 0 && Date.now() - S.lastActivity > m * 60_000) lock("Automatisch gesperrt nach " + m + " Minuten ohne Aktivität.");
}
/** Alles Entschlüsselte aus dem Speicher werfen. Google-Anmeldung bleibt (nur verschlüsselte Dateien). */
async function lock(message) {
  if (!S.unlocked) return;
  if (DEMO) { toast("Demo – Sperren ist hier ausgeschaltet"); return; }
  if (pcDirty()) { saveInboxSoon.cancel(); try { await saveInbox(); } catch (_) {} }
  S.unlocked = false;
  clearTimeout(S.pollTimer); clearInterval(S.lockTimer); clearInterval(S.clockTimer);
  closeDialog(); closeLightbox(); closeMenu();
  S.key = null; S.db = null; S.extras = { calc: {}, work: {} };
  S.inbox = { notes: [], checks: [], edits: [], fileId: null, modifiedTime: null, base: new Map(), readable: true, taken: [] };
  S.appliedEdits = []; S.edit = null; S.split.noteId = null; // NEU (AS/AT)
  S.done = new Set(); S.rejected = new Set(); S.doneModified = null;
  S.fresh.clear(); S.collapsed.clear(); S.page.clear(); S.query = ""; S.findTerms = null;
  clearImages();
  $$(".toasts .toast").forEach(t => t.remove());
  history.replaceState(null, "", location.pathname + location.search);
  document.title = "MyNotes";
  // Neueste Kopie holen, damit nach dem Entsperren alles aktuell ist
  try {
    if (tokenValid()) {
      S.files = await listFolder();
      const f = S.files.get(F_MIRROR);
      if (f && (!S.zip || f.modifiedTime !== S.mirror?.modifiedTime)) await fetchMirror(f);
    }
  } catch (_) {}
  if (!S.zip) { showLogin(message || "Gesperrt. Bitte neu anmelden."); return; }
  showUnlock(message);
}
async function logout() {
  if (S.unlocked && pcDirty()) { try { await saveInbox(); } catch (_) {} }
  S.unlocked = false;
  clearTimeout(S.pollTimer); clearInterval(S.lockTimer); clearInterval(S.clockTimer);
  S.key = null; S.db = null; S.zip = null; S.meta = null; S.mirror = null;
  S.inbox = { notes: [], checks: [], fileId: null, modifiedTime: null, base: new Map(), readable: true, taken: [] };
  clearImages();
  revokeToken();
  S.user = null; S.folderId = null; S.files = new Map();
  history.replaceState(null, "", location.pathname + location.search);
  showLogin("Abgemeldet.");
}

// =====================================================================
// Einstellungen
// =====================================================================
function applySettings() {
  const st = S.settings;
  const root = document.documentElement;
  if (st.theme === "dark" || st.theme === "light") root.dataset.theme = st.theme; else delete root.dataset.theme;
  root.style.setProperty("--fs", (st.fontSize || 15) + "px");
}
function openSettings() {
  const st = S.settings;
  const row = (title, desc, control) => h("div", { class: "setting" }, h("div", { class: "grow" }, h("b", null, title), desc ? h("span", null, desc) : null), control);
  const rerender = () => { applySettings(); saveSettingsSoon(); renderSidebar(); renderList(); renderMain(); openSettings(); };
  const f = S.files.get(F_MIRROR);
  openDialog([
    h("h2", null, icon("settings"), h("span", { class: "grow" }, "Einstellungen"), iconBtn("close", "Schließen", closeDialog)),
    row("Aussehen", null, seg([["system", "System"], ["dark", "Dunkel"], ["light", "Hell"]], st.theme, v => { st.theme = v; rerender(); })),
    row("Schriftgröße", null, seg([[14, "Klein"], [15, "Normal"], [17, "Groß"], [19, "Sehr groß"]].map(([v, l]) => [v, l]), st.fontSize, v => { st.fontSize = Number(v); rerender(); })),
    row("Ansicht der Listen", "Kacheln zeigen Notizen nebeneinander wie Google Notizen", seg([["list", "Liste"], ["tiles", "Kacheln"]], st.view, v => { st.view = v; rerender(); })),
    row("Erledigte Punkte ausblenden", "In Notizen abgehakte Checklisten-Punkte verstecken", seg([[false, "Zeigen"], [true, "Ausblenden"]], st.hideDone, v => { st.hideDone = v === true || v === "true"; rerender(); })),
    row("Automatisch sperren", "Nach dieser Zeit ohne Aktivität wird alles Entschlüsselte gelöscht", seg([[5, "5 Min"], [15, "15"], [30, "30"], [60, "60"], [0, "Nie"]], st.lockMinutes, v => { st.lockMinutes = Number(v); rerender(); })),
    h("p", { class: "small muted", style: { marginTop: "12px" } }, "Diese Einstellungen werden verschlüsselt in deinem Drive gespeichert (zusammen mit „Vom PC“) – nicht im Browser."),
    h("div", { class: "panel", style: { marginTop: "14px", fontSize: ".88rem" } },
      h("b", null, "Verbindung"),
      h("div", { class: "muted", style: { marginTop: "6px", display: "grid", gap: "3px" } },
        h("span", null, "Konto: " + (S.user?.email || (DEMO ? "Demo" : "–"))),
        h("span", null, "Stand vom Handy: " + fullTime(S.db?.createdAt) + (S.db?.appVersion ? " · App " + S.db.appVersion : "")),
        h("span", null, "PC-Kopie: " + (f ? Math.round((f.size || 0) / 1024) + " KB" : "–") + " · Bilder im Drive: " + [...S.files.keys()].filter(k => k.startsWith("img_")).length),
        h("span", null, "Zuletzt geprüft: " + (S.lastCheck ? fmtTime.format(S.lastCheck) : "–") + " · Web-App " + APP_VERSION))),
    h("div", { class: "actions" },
      h("button", { class: "btn ghost", onclick: () => { closeDialog(); poll(true); } }, icon("refresh"), "Aktualisieren"),
      h("button", { class: "btn ghost", onclick: () => { closeDialog(); lock("Gesperrt."); } }, icon("lock"), "Sperren"),
      h("button", { class: "btn danger", onclick: () => { closeDialog(); logout(); } }, icon("logout"), "Abmelden"))
  ], { wide: true });
}
function openShortcuts() {
  const k = (...keys) => h("div", { class: "k" }, keys.map(x => h("kbd", null, x)));
  openDialog([
    h("h2", null, icon("keyboard"), h("span", { class: "grow" }, "Tastenkürzel"), iconBtn("close", "Schließen", closeDialog)),
    h("div", { class: "keys" },
      k("Strg", "K"), h("span", null, "Suchen (auch „/“)"),
      k("↓", "↑"), h("span", null, "In der Liste bewegen · Enter öffnet"),
      k("J", "K"), h("span", null, "Nächste / vorige Notiz"),
      k("N"), h("span", null, "Neue PC-Notiz"),
      k("G"), h("span", null, "Zur Startseite"),
      k("R"), h("span", null, "Jetzt aktualisieren"),
      k("C"), h("span", null, "Geöffnete Notiz als Text kopieren"),
      k("E"), h("span", null, "Geöffnete Notiz am PC bearbeiten (kommt aufs Handy)"),
      k("Strg", "Klick"), h("span", null, "Notiz daneben öffnen (zwei Notizen nebeneinander)"),
      k("V"), h("span", null, "Liste ⇄ Kacheln"),
      k("L"), h("span", null, "Sperren"),
      k("Esc"), h("span", null, "Schließen / zurück"),
      k("Strg", "S"), h("span", null, "PC-Notiz sofort speichern"),
      k("Strg", "Enter"), h("span", null, "Schnell-Senden auf der Startseite"),
      k("?"), h("span", null, "Diese Hilfe")),
    h("h2", { style: { marginTop: "22px" } }, icon("help"), "Gut zu wissen"),
    h("ul", { class: "small", style: { margin: 0, paddingLeft: "18px", display: "grid", gap: "6px", color: "var(--muted)" } },
      h("li", null, "Das Handy lädt Änderungen etwa 1 Minute nach dem Bearbeiten hoch. Die Web-App schaut jede Minute nach."),
      h("li", null, "Am PC kannst du Notizen bearbeiten (E), neue Notizen in Ordnern anlegen und abhaken. Der PC schickt dem Handy nur Vorschläge – das Handy übernimmt sie automatisch oder nach Bestätigung (Einstellung am Handy). Was am Handy inzwischen anders ist, wird nie überschrieben."),
      h("li", null, "Rechnungen und Arbeitszeit zeigen die Ergebnisse, die das Handy berechnet hat."),
      h("li", null, "Der versteckte Bereich ist nie auf dem PC."),
      h("li", null, "Über Kopier-Symbole neben Blöcken: Tabellen gehen direkt in Excel, Links auf Stellen in „Vom PC“."))
  ], { wide: true });
}

// =====================================================================
// Tastatur
// =====================================================================
addEventListener("keydown", e => {
  if (!S.unlocked) return;
  const lb = $(".lightbox");
  if (lb) { if (e.key === "Escape") closeLightbox(); else lb._keys && lb._keys(e); return; }
  if ($(".menu") && e.key === "Escape") { closeMenu(); return; }
  if ($(".overlay")) { if (e.key === "Escape") closeDialog(); return; }
  const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); return; }
  if (typing) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (mod || e.altKey) return;
  // NEU (AS): Während des Bearbeitens keine Ein-Buchstaben-Kürzel (nur Esc)
  if (S.edit && S.noteId != null && e.key !== "Escape") return;
  switch (e.key) {
    case "/": e.preventDefault(); focusSearch(); break;
    case "?": openShortcuts(); break;
    case "n": case "N": e.preventDefault(); newPcNote(); break;
    case "r": case "R": poll(true); break;
    case "l": case "L": lock("Gesperrt."); break;
    case "g": case "G": go({ view: "home" }, null); break;
    case "v": case "V": S.settings.view = S.settings.view === "tiles" ? "list" : "tiles"; saveSettingsSoon(); renderList(); renderMain(); break;
    case "c": case "C": { const n = noteById(S.noteId); if (n) copyText(notePlainText(n), "Notiz kopiert"); break; }
    case "e": case "E": { // NEU (AS): bearbeiten
      const id = splitActive() && S.split.active === "b" ? S.split.noteId : S.noteId;
      const n = noteById(id);
      if (n && canEditFromPc(n) && !S.pcId) { e.preventDefault(); startEdit(n, S.page.get(n.id) || 0); }
      break;
    }
    case "j": case "k": case "J": case "K": stepNote(e.key.toLowerCase() === "j" ? 1 : -1); break;
    case "Enter": if (S.findNext && document.activeElement === document.body) S.findNext(); break;
    case "Escape":
      if (S.edit && S.noteId != null) cancelEdit(false); // NEU (AS)
      else if (S.findTerms) { S.findTerms = null; renderMain(); }
      else if ($(".shell.nav-open")) closeNav();
      else if (S.noteId != null || S.pcId) closeNote();
      else if (S.route.view === "search") { S.query = ""; const i = $(".search-box input"); if (i) i.value = ""; onSearchInput(""); }
      break;
    case "ArrowDown": case "ArrowUp": {
      const cards = $$(".list-body .card, .list-body .task-row");
      if (!cards.length) break;
      e.preventDefault();
      const idx = cards.indexOf(document.activeElement);
      focusListItem(idx < 0 ? 0 : idx + (e.key === "ArrowDown" ? 1 : -1), false);
      break;
    }
  }
});
function focusSearch() {
  closeNav();
  if (matchMedia("(max-width: 1000px)").matches) openNav();
  const i = $(".search-box input");
  if (i) { i.focus(); i.select(); }
}
function stepNote(dir) {
  const cards = $$(".list-body .card[data-note], .tiles-grid .card[data-note]");
  if (!cards.length) return;
  const idx = cards.findIndex(c => Number(c.dataset.note) === S.noteId);
  const next = cards[Math.max(0, Math.min(cards.length - 1, idx < 0 ? 0 : idx + dir))];
  next.scrollIntoView({ block: "nearest" });
  openNote(Number(next.dataset.note));
}

// =====================================================================
// Start
// =====================================================================
async function boot() {
  applySettings();
  if (DEMO) {
    try {
      await import("./demo.js?v=3");
      const d = window.MyNotesDemo.setup();
      S.user = d.user;
      S.db = buildDb(d.snapshot);
      S.extras = d.extras;
      S.files = new Map();
      S.inbox = { notes: parseInbox(d.inbox).notes, checks: [], edits: parseInbox(d.inbox).edits, fileId: "demo", modifiedTime: "demo", base: new Map(), readable: true, taken: [], state: null };
      S.inbox.base = inboxBase();
      S.done = new Set(d.done || []);
      window.MyNotesTest = { effectiveNote, buildEdit, timetableParse, timetableText, ttLayout, folderTotal, openNote, go, readZip, deriveKey, decryptBytes, decryptJson, encryptBytes, b64url, buildDb, markupToBlocks, blocksToMarkup, searchNotes, decodeDrawing, S };
      startApp();
    } catch (e) {
      gate(h("h1", null, "Demo konnte nicht starten"), h("div", { class: "gate-msg bad" }, String(e && e.stack || e)));
    }
    return;
  }
  if (!window.crypto || !crypto.subtle || typeof DecompressionStream === "undefined") {
    gate(h("img", { class: "logo-img", src: "logo.png", alt: "" }), h("h1", null, "Browser zu alt"),
      h("p", null, "Bitte einen aktuellen Chrome, Edge, Firefox oder Safari verwenden (und die Seite über https öffnen)."));
    return;
  }
  showLogin();
}
boot();
