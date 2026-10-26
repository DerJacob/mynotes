// =====================================================================
// Blockdorf – Wetter, Mondphasen, Spielmodi und Befehle (Etappe 7)
//   Wetter:    klar → Regen → (Gewitter) → klar; Regen und Schnee je nach Biom, Gewitter mit Blitzschlag,
//              Regen wässert Felder und dunkelt den Himmel ab (Sonnenbrand fällt bei Regen aus)
//   Mond:      acht Phasen (alle acht Tage von vorn); Vollmond macht die Nacht ein wenig heller
//   Modi:      Überleben und Kreativ (fliegen mit Doppelsprung, sofort abbauen, nichts verbrauchen, kein Schaden)
//   Befehle:   /help /gamemode /time /weather /tp /give /xp /heal /kill /spawnpoint /seed /locate /summon /clear
// Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS } from "./sandbox-data.js?v=8";
import { MOBS } from "./sandbox-mobs.js?v=8";
import { BIOMES, BIOME_NAMES, SNOWY_BIOMES } from "./sandbox-world.js?v=8";
import { mulberry32 } from "./sandbox-noise.js?v=8";

export const MODES = { survival: "Überleben", creative: "Kreativ" };
export const WEATHER_NAMES = { clear: "Klar", rain: "Regen", thunder: "Gewitter" };
export const MOON_NAMES = ["Vollmond", "Abnehmender Mond", "Letztes Viertel", "Abnehmende Sichel", "Neumond", "Zunehmende Sichel", "Erstes Viertel", "Zunehmender Mond"];
/** wie voll der Mond in Phase 0–7 ist (0 = Vollmond, 4 = Neumond) */
export const MOON_FULL = [1, 0.75, 0.5, 0.25, 0, 0.25, 0.5, 0.75];

const norm = s => String(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").trim();

/** Sucht einen Gegenstand nach Kennung oder (auch teilweise) deutschem Namen */
export function findItem(q) {
  const k = norm(q);
  if (!k) return null;
  if (ITEMS[k]) return k;
  const ids = Object.keys(ITEMS);
  const exact = ids.filter(id => norm(ITEMS[id].name) === k);
  if (exact.length) return exact[0];
  const part = ids.filter(id => id.includes(k) || norm(ITEMS[id].name).includes(k));
  return part.length === 1 ? part[0] : part.length ? part.sort((a, b) => a.length - b.length)[0] : null;
}
export function findMob(q) {
  const k = norm(q);
  if (!k) return null;
  if (MOBS[k]) return k;
  const ids = Object.keys(MOBS);
  const exact = ids.filter(id => norm(MOBS[id].name) === k);
  if (exact.length) return exact[0];
  const part = ids.filter(id => id.includes(k) || norm(MOBS[id].name).includes(k));
  return part.length ? part[0] : null;
}

const PLACES = {
  mansion: ["mansion", "anwesen", "waldanwesen"], camp: ["camp", "lager"], outpost: ["outpost", "aussenposten"], monument: ["monument", "ozeanmonument"],
  village: ["village", "dorf"]
};
const PLACE_NAMES = { mansion: "Waldanwesen", camp: "Lager", outpost: "Außenposten", monument: "Ozeanmonument", village: "Dorf" };

export function installPolish(Sandbox, K) {
  const { clamp, W, H, SURF } = K;
  const P = Sandbox.prototype;

  // ---------- Grundzustand ----------
  const prevFresh = P._fresh;
  P._fresh = function () {
    prevFresh.call(this);
    this.mode = "survival";
    this.weather = { kind: "clear", t: 0, k: 0, dark: 0.28, bolt: null, boltT: 8 };
    this.wrng = mulberry32((this.seed ^ 0x7ea7) + 77);
    this.weather.t = 500 + this.wrng() * 900;
    this.mineCd = 0;
  };

  // ---------- Speichern (Spielstand v8) ----------
  P._polishSave = function () {
    const w = this.weather;
    return { mode: this.mode, weather: { kind: w.kind, t: +w.t.toFixed(1), k: +w.k.toFixed(2) } };
  };
  P._polishLoad = function (d) {
    if (d && typeof d.mode === "string" && MODES[d.mode]) this.mode = d.mode;
    const w = d && d.weather;
    if (w && typeof w === "object" && WEATHER_NAMES[w.kind] && Number.isFinite(w.t)) {
      this.weather.kind = w.kind; this.weather.t = clamp(w.t, 1, 5000); this.weather.k = clamp(+w.k || 0, 0, 1);
      this.weather.dark = w.kind === "thunder" ? 0.45 : 0.28;
    }
  };

  // ---------- Mond ----------
  /** Die Phase gehört zur ganzen Nacht: nach Mitternacht gilt noch die Phase des Abends davor */
  P.moonPhase = function () { return (((Math.max(1, this.day | 0) - 1 - (this.time < 0.5 ? 1 : 0)) % 8) + 8) % 8; };
  P.moonName = function () { return MOON_NAMES[this.moonPhase()]; };

  // ---------- Wetter ----------
  P.precipAt = function (x) {
    if (this.dim) return "none";
    x = clamp(Math.floor(x), 0, W - 1);
    const name = BIOMES[this.biomes[x]];
    if (name === "desert" || name === "savanna") return "none";
    if (SNOWY_BIOMES.has(name)) return "snow";
    if ((name === "mountains" && this.ground[x] < SURF - 14) || (name === "stony_peaks" && this.ground[x] < SURF - 60)) return "snow";
    return "rain";
  };
  /** Trifft Regen oder Schnee diesen Block (kein Dach darüber, Wetter aktiv)? */
  P.rainsOn = function (x, y) {
    const w = this.weather;
    if (!w || w.kind === "clear" || w.k < 0.5 || this.dim) return false;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    if (this.precipAt(x) === "none") return false;
    for (let yy = y; yy >= 0; yy--) { const id = this.tiles[yy * W + x]; if (id !== B.AIR && BLOCKS[id].solid) return false; }   // Dach darüber?
    return true;
  };
  P.setWeather = function (kind, secs) {
    if (!WEATHER_NAMES[kind]) return false;
    const w = this.weather;
    w.kind = kind; w.dark = kind === "thunder" ? 0.45 : 0.28;
    w.t = Number.isFinite(secs) && secs > 0 ? secs : kind === "clear" ? 600 + this.wrng() * 900 : 120 + this.wrng() * 180;
    w.boltT = 4 + this.wrng() * 8;
    this.events.push({ t: "weather", kind });
    return true;
  };
  P._weatherStep = function (dt) {
    const w = this.weather;
    w.t -= dt;
    if (w.t <= 0) {
      if (w.kind === "clear") this.setWeather(this.wrng() < 0.25 ? "thunder" : "rain");
      else this.setWeather("clear");
    }
    const target = w.kind === "clear" ? 0 : 1, rate = dt * 0.12;
    w.k += clamp(target - w.k, -rate, rate);
    if (w.k < 1e-4) w.k = 0;
    if (w.bolt) { w.bolt.t -= dt; if (w.bolt.t <= 0) w.bolt = null; }
    if (w.kind === "thunder" && w.k > 0.6 && !this.dim) {
      w.boltT -= dt;
      if (w.boltT <= 0) { w.boltT = 5 + this.wrng() * 14; this._lightning(); }
    }
  };
  /** Blitz in Spielernähe (oder an einer Stelle x); verletzt, wer nah genug steht */
  P._lightning = function (x) {
    const p = this.player;
    if (x === undefined) x = Math.floor(p.x + p.w / 2 + (this.wrng() - 0.5) * 70);
    x = clamp(Math.floor(x), 2, W - 3);
    const y = this.ground[x];
    this.weather.bolt = { x, y, t: 0.4 };
    this.events.push({ t: "lightning", x, y });
    const near = (ox, oy) => Math.abs(ox - x) < 2.6 && oy > y - 14 && oy < y + 4;
    if (near(p.x + p.w / 2, p.y + p.h / 2)) this.hurt(6, 0, "lightning");
    for (const m of this.mobs.slice()) if (!m.boss && near(m.x + m.w / 2, m.y + m.h / 2)) this._mobHurt(m, 8, 0, "lightning");
  };
  P.dayFactor = function () {
    const w = this.weather;
    const floor = 0.06 + 0.04 * MOON_FULL[(Math.max(1, this.day | 0) - 1) & 7];
    let f = 0.5 + 0.7 * Math.sin(2 * Math.PI * (this.time - 0.25));
    f = f < floor ? floor : f > 1 ? 1 : f;
    if (w && w.k > 0 && !this.dim) { f *= 1 - w.dark * w.k; if (f < floor) f = floor; }
    return f;
  };
  const prevWet = P.wetFarmland;
  P.wetFarmland = function (x, y) { return prevWet.call(this, x, y) || this.rainsOn(x, y - 1); };
  const prevSleep = P.sleep;
  P.sleep = function (...a) { const ok = prevSleep.apply(this, a); if (ok && this.weather && this.weather.kind !== "clear") this.setWeather("clear"); return ok; };

  // ---------- Spielmodi ----------
  P.setMode = function (m) {
    if (!MODES[m]) return false;
    this.mode = m;
    const p = this.player;
    if (m === "creative") { p.hp = p.maxHp; this.food = 20; this.sat = 5; this.exh = 0; } else p.flying = false;
    this.events.push({ t: "mode", m });
    return true;
  };
  const prevHurt = P.hurt;
  P.hurt = function (n, dir, why) { if (this.mode === "creative" && why !== "void") return; return prevHurt.call(this, n, dir, why); };
  const prevHunger = P._hunger;
  P._hunger = function (dt) { if (this.mode === "creative") { this.food = 20; return; } return prevHunger.call(this, dt); };
  const prevConsume = P._consumeSel;
  P._consumeSel = function () { if (this.mode === "creative") return; return prevConsume.call(this); };
  const prevWear = P._wear;
  P._wear = function (...a) { if (this.mode === "creative") return; return prevWear.apply(this, a); };
  const prevMine = P.mineStep;
  P.mineStep = function (tx, ty, dt) {
    if (this.mode !== "creative") return prevMine.call(this, tx, ty, dt);
    if (this.win) return 0;
    if (!this.reachOk(tx, ty)) { this.mining = null; return 0; }
    const id = this.tile(tx, ty);
    if (id === B.AIR || BLOCKS[id].hard === Infinity) { this.mining = null; return 0; }
    if (this.mineCd > 0) return 1;
    const keep = this._noDrops; this._noDrops = true;
    try { this._break(tx, ty, true); } finally { this._noDrops = keep; }
    this.mining = null; this.mineCd = 0.2;
    return 2;
  };
  const prevStep = P._step;
  P._step = function (dt) {
    if (this.mineCd > 0) this.mineCd -= dt;
    prevStep.call(this, dt);
    this._weatherStep(dt);
  };
  const prevPlayer = P._player;
  P._player = function (dt) {
    const p = this.player;
    if (this.mode === "creative") {
      const inp = this.input;
      p.fjT = (p.fjT || 0) - dt;
      const edge = inp.jump && !p.jumpPrev; p.jumpPrev = !!inp.jump;
      if (edge) { if (p.fjT > 0) { p.flying = !p.flying; p.fjT = 0; p.vy = 0; } else p.fjT = 0.3; }
      if (p.flying) { this._flyStep(dt); return; }
    } else p.flying = false;
    return prevPlayer.call(this, dt);
  };
  P._flyStep = function (dt) {
    const p = this.player, inp = this.input;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), vdir = (inp.down ? 1 : 0) - (inp.jump ? 1 : 0);
    p.vx += clamp(dir * 10 - p.vx, -60 * dt, 60 * dt);
    p.vy += clamp(vdir * 8 - p.vy, -50 * dt, 50 * dt);
    if (dir) p.face = dir;
    p.invuln = Math.max(0, p.invuln - dt); p.atkCd = Math.max(0, p.atkCd - dt);
    p.coyote = 0; p.jumpBuf = 0; p.glide = false; p.onLadder = false;
    this._body(p, dt, 0);
    p.landV = 0;
    if (p.onGround && vdir > 0) p.flying = false;           // beim Landen endet der Flug
  };
  const prevWinCheck = P._windowCheck;
  P._windowCheck = function () { if (this.win && this.win.kind === "creative") return; return prevWinCheck.call(this); };
  const prevClose = P.closeWindow;
  P.closeWindow = function () { if (this.win && this.win.kind === "creative") { this.cursor = null; } return prevClose.call(this); };
  /** Kreativfenster: Stapel in die Hand nehmen (voll oder einzeln) */
  P.creativeTake = function (id, full = true) {
    if (this.mode !== "creative" || !ITEMS[id]) return false;
    const n = full ? Math.max(1, K.stackMax(id)) : 1, c = this.cursor;
    if (c && c.id === id && !c.d && !c.e) { c.n = Math.min(Math.max(1, K.stackMax(id)), c.n + n); return true; }
    if (c) return false;
    this.cursor = this.newStack(id, n);
    return true;
  };
  P.creativeTrash = function () { if (this.mode !== "creative") return false; this.cursor = null; return true; };
  const prevOpen = P.openWindow;
  P.openWindow = function (kind, x, y) {
    if (kind === "inv" && this.mode === "creative") kind = "creative";
    return prevOpen.call(this, kind, x, y);
  };

  // ---------- Befehle ----------
  const here = s => `${Math.round(s.player.x + s.player.w / 2)} / ${Math.round(SURF - (s.player.y + s.player.h / 2))}`;
  P._locate = function (what) {
    const k = norm(what), p = this.player, px = p.x + p.w / 2;
    let kind = null;
    for (const [id, names] of Object.entries(PLACES)) if (names.some(n => n === k || n.startsWith(k))) kind = id;
    let best = null, label = null;
    const take = (x, y) => { const d = Math.abs(x - px); if (!best || d < best.d) best = { x, y, d }; };
    if (kind === "village") { label = PLACE_NAMES.village; for (const v of this.villages) take(v.x, v.y); }
    else if (kind) { label = PLACE_NAMES[kind]; for (const s of this.structs) if (s.kind === kind) take(s.x, s.y); }
    else {
      const bi = BIOMES.findIndex((b, i) => b === k || norm(BIOME_NAMES[i]).includes(k));
      if (bi >= 0) { label = BIOME_NAMES[bi]; for (let x = 0; x < W; x++) if (this.biomes[x] === bi) take(x, this.ground[x]); }
    }
    if (!label) return { ok: false, text: "Unbekanntes Ziel. Möglich: Dorf, Anwesen, Lager, Außenposten, Monument oder ein Biom." };
    if (!best) return { ok: false, text: `${label}: In dieser Welt gibt es keins.` };
    const dir = best.x >= px ? "rechts" : "links";
    return { ok: true, text: `${label} bei x ${best.x}, ${Math.round(best.d)} Blöcke ${dir}.` };
  };

  /** Führt einen Chat-Befehl aus („/time set night“ oder ohne Schrägstrich). Liefert { ok, lines[] } */
  P.command = function (line) {
    let s = String(line || "").trim();
    if (s.startsWith("/")) s = s.slice(1);
    const parts = s.split(/\s+/).filter(Boolean);
    const cmd = norm(parts[0] || ""), a = parts.slice(1);
    const ok = (...lines) => ({ ok: true, lines });
    const bad = text => ({ ok: false, lines: [text] });
    const p = this.player;
    switch (cmd) {
      case "": return bad("Befehl fehlt. Tippe /help.");
      case "help": case "hilfe": case "?":
        return ok("/gamemode survival|creative – Spielmodus", "/time set day|noon|night|midnight|0…1 – Uhrzeit", "/weather clear|rain|thunder [Sekunden]",
          "/tp x [Höhe] oder /tp spawn", "/give Gegenstand [Anzahl]", "/xp Anzahl", "/heal  /kill  /clear", "/spawnpoint  /seed  /locate Ziel  /summon Mob [Anzahl]");
      case "gamemode": case "gm": case "spielmodus": {
        const m = { survival: "survival", s: "survival", 0: "survival", ueberleben: "survival", creative: "creative", c: "creative", 1: "creative", kreativ: "creative" }[norm(a[0] || "")];
        if (!m) return bad("Modus: survival oder creative.");
        this.setMode(m); return ok(`Spielmodus: ${MODES[m]}.`);
      }
      case "time": case "zeit": {
        const sub = norm(a[0] || "query");
        if (sub === "query") return ok(`Tag ${this.day}, Zeit ${this.time.toFixed(2)} (${this.moonName()}).`);
        if (sub === "set") {
          const v = norm(a[1] || ""), names = { day: 0.27, tag: 0.27, sunrise: 0.2, morgen: 0.2, noon: 0.5, mittag: 0.5, sunset: 0.75, abend: 0.75, night: 0.85, nacht: 0.85, midnight: 0.0, mitternacht: 0.0 };
          const t = v in names ? names[v] : Number(v);
          if (!Number.isFinite(t) || t < 0 || t > 1) return bad("Zeit: day, noon, night, midnight oder eine Zahl von 0 bis 1.");
          if (t < this.time - 0.001 && v !== "midnight" && v !== "mitternacht") this.day++;
          this.time = t >= 1 ? 0 : t; this.lightDirty = true; return ok(`Zeit auf ${this.time.toFixed(2)} gesetzt.`);
        }
        if (sub === "add") {
          const d = Number(a[1]); if (!Number.isFinite(d)) return bad("Zeit add braucht eine Zahl.");
          let t = this.time + d; while (t >= 1) { t -= 1; this.day++; } while (t < 0) t += 1;
          this.time = t; this.lightDirty = true; return ok(`Zeit ${this.time.toFixed(2)}, Tag ${this.day}.`);
        }
        return bad("Nutze /time set … oder /time add …");
      }
      case "weather": case "wetter": {
        const k = { clear: "clear", klar: "clear", sonne: "clear", rain: "rain", regen: "rain", thunder: "thunder", gewitter: "thunder" }[norm(a[0] || "")];
        if (!k) return bad("Wetter: clear, rain oder thunder.");
        this.setWeather(k, a[1] ? Number(a[1]) : undefined); return ok(`Wetter: ${WEATHER_NAMES[k]}.`);
      }
      case "tp": case "teleport": {
        if (norm(a[0] || "") === "spawn") { p.x = this.spawn.x; p.y = this.spawn.y; p.vx = p.vy = 0; if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; } return ok("Zum Spawnpunkt."); }
        const x = Number(a[0]);
        if (!Number.isFinite(x)) return bad("Nutze /tp x [Höhe] oder /tp spawn.");
        const cx = clamp(Math.round(x), 1, W - 2);
        let y = a[1] !== undefined && Number.isFinite(Number(a[1])) ? SURF - Number(a[1]) - p.h / 2 : this.ground[cx] - p.h - 0.01;
        y = clamp(y, 1, H - p.h - 1);
        p.x = cx + 0.5 - p.w / 2; p.y = y; p.vx = p.vy = 0;
        if (this._hit(p)) { const q = this._safeSpot(p.x, p.y); p.x = q.x; p.y = q.y; }
        return ok(`Teleportiert nach ${here(this)}.`);
      }
      case "give": case "gib": {
        const id = findItem(a[0] || "");
        if (!id) return bad(`Unbekannter Gegenstand: ${a[0] || "?"}`);
        const n = clamp(Math.floor(Number(a[1]) || 1), 1, 2304);
        const rest = this.add(id, n, 0, true);
        return ok(`${n - (rest | 0)} × ${ITEMS[id].name} erhalten.`);
      }
      case "xp": { const n = Math.floor(Number(a[0])); if (!Number.isFinite(n) || n < 0 || n > 100000) return bad("Nutze /xp Anzahl."); this.addXp(n); return ok(`+${n} Erfahrung.`); }
      case "heal": case "heilen": p.hp = p.maxHp; this.food = 20; this.sat = 5; this.exh = 0; p.air = 15; return ok("Voll geheilt.");
      case "kill": case "tod": { const m = this.mode; this.mode = "survival"; this._die(); this.mode = m; return ok("Du bist gestorben."); }
      case "clear": case "leeren": this.inv = this._emptyInv(); this.armor = [null, null, null, null]; this.cursor = null; return ok("Inventar geleert.");
      case "spawnpoint": case "spawn": this.spawn = { x: p.x, y: p.y }; return ok(`Spawnpunkt bei ${here(this)}.`);
      case "seed": return ok(`Seed: ${this.seed}`);
      case "locate": case "finde": { const r = this._locate(a.join(" ")); return r.ok ? ok(r.text) : bad(r.text); }
      case "summon": case "beschwoere": {
        const t = findMob(a[0] || "");
        if (!t) return bad(`Unbekannter Mob: ${a[0] || "?"}`);
        const n = clamp(Math.floor(Number(a[1]) || 1), 1, 10);
        for (let i = 0; i < n; i++) this.spawnMob(t, p.x + p.w / 2 + 3 + i * 1.5 - MOBS[t].w / 2, Math.floor(p.y + p.h));
        return ok(`${n} × ${MOBS[t].name} erscheint.`);
      }
      default: return bad(`Unbekannter Befehl „${parts[0]}“. Tippe /help.`);
    }
  };
}
