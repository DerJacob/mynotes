// =====================================================================
// Blockdorf – Dorfbewohner, Handel, Raubüberfälle, Karten und Möbel (Etappe 6)
//   Berufe:     ein freier Arbeitsblock (Komposter, Lesepult, Kartentisch, Amboss, Braustand) in der Nähe macht aus einem
//               Dorfbewohner einen Bauern, Bibliothekar, Kartografen, Schmied oder Geistlichen; nach dem ersten Handel bleibt er dabei
//   Handel:     fünf Stufen mit je zwei Angeboten, Smaragde als Währung, Vorrat füllt sich jeden Morgen wieder auf
//   Überfälle:  Anführer der Außenposten bringen das „Unheilvolle Omen“; wer damit ein Dorf betritt, löst drei Wellen Plünderer aus –
//               wer sie besiegt, wird „Held des Dorfes“ (günstigere Preise)
//   Karten:     Kartografen verkaufen Entdeckerkarten zu Waldanwesen und Ozeanmonumenten
//   Möbel:      Kissen (man sitzt), Strohbett (überspringt die Nacht, ohne den Spawnpunkt zu ändern), Lagerfeuer (verbrennt)
// Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS, WORKSTATIONS } from "./sandbox-data.js?v=10";
import { MOBS, ADV } from "./sandbox-mobs.js?v=10";
import { EFFECT_NAMES, EFFECT_BAD } from "./sandbox-brew.js?v=10";

export const PROFS = {
  farmer: { name: "Bauer", ws: B.COMPOSTER, color: "#7a9a3a", lines: ["Frisches Brot, gerade gebacken!", "Der Weizen steht prächtig dieses Jahr.", "Brauchst du Kürbisse?"] },
  librarian: { name: "Bibliothekar", ws: B.LECTERN, color: "#d8d8d0", lines: ["Bücher sind der wahre Schatz.", "Verzauberte Bücher? Natürlich, hier.", "Pssst – in der Bibliothek ist Ruhe."] },
  cartographer: { name: "Kartograf", ws: B.CARTO, color: "#b98a4a", lines: ["Weit hinter dem Horizont liegt noch viel.", "Eine Karte zeigt dir den Weg.", "Im Wald steht ein altes Anwesen …"] },
  smith: { name: "Schmied", ws: B.ANVIL, color: "#555a60", lines: ["Gutes Eisen hält ein Leben lang.", "Kohle her, dann schmieden wir!", "Meine Rüstung hält jeden Hieb aus."] },
  cleric: { name: "Geistlicher", ws: B.BREWING, color: "#8a4aa8", lines: ["Gold und Redstone – mein Geschäft.", "Der Ender ist näher, als du denkst.", "Ein Segen für deine Reise."] }
};
export const LEVEL_NAMES = ["Neuling", "Lehrling", "Geselle", "Experte", "Meister"];
const XP_NEXT = [0, 10, 70, 150, 250];
export const BOOK = "@book";

/** Handelsangebote: Beruf → Stufe 1–5 → je zwei Angebote. a/b = was der Spieler gibt, out = was er bekommt */
const E = "emerald";
const TRADES = {
  farmer: [
    [{ a: ["wheat", 20], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], out: ["bread", 6], max: 16, xp: 1 }],
    [{ a: ["pumpkin", 6], out: [E, 1], max: 12, xp: 5 }, { a: [E, 1], out: ["pumpkin_pie", 4], max: 12, xp: 5 }],
    [{ a: ["melon", 4], out: [E, 1], max: 12, xp: 10 }, { a: [E, 1], out: ["apple", 4], max: 12, xp: 10 }],
    [{ a: ["carrot", 22], out: [E, 1], max: 12, xp: 15 }, { a: [E, 3], out: ["golden_carrot", 3], max: 12, xp: 15 }],
    [{ a: ["potato", 26], out: [E, 1], max: 12, xp: 30 }, { a: [E, 4], out: ["glistering_melon_slice", 3], max: 12, xp: 30 }]
  ],
  librarian: [
    [{ a: ["paper", 24], out: [E, 1], max: 16, xp: 2 }, { a: [E, 5], b: ["book", 1], out: BOOK, max: 4, xp: 5 }],
    [{ a: ["book", 4], out: [E, 1], max: 12, xp: 5 }, { a: [E, 9], out: ["bookshelf", 1], max: 12, xp: 5 }],
    [{ a: ["glass", 4], out: [E, 1], max: 12, xp: 10 }, { a: [E, 8], b: ["book", 1], out: BOOK, max: 4, xp: 10 }],
    [{ a: ["string", 20], out: [E, 1], max: 12, xp: 15 }, { a: [E, 3], out: ["glass_bottle", 6], max: 12, xp: 15 }],
    [{ a: ["gold_ingot", 3], out: [E, 1], max: 12, xp: 30 }, { a: [E, 12], b: ["book", 1], out: BOOK, max: 4, xp: 30 }]
  ],
  cartographer: [
    [{ a: ["paper", 24], out: [E, 1], max: 16, xp: 2 }, { a: ["string", 20], out: [E, 1], max: 16, xp: 2 }],
    [{ a: [E, 13], b: ["paper", 1], out: "map_monument", max: 12, xp: 5 }, { a: ["glass", 8], out: [E, 1], max: 12, xp: 5 }],
    [{ a: [E, 14], b: ["paper", 1], out: "map_mansion", max: 12, xp: 10 }, { a: ["bone", 12], out: [E, 1], max: 12, xp: 10 }],
    [{ a: ["leather", 6], out: [E, 1], max: 12, xp: 15 }, { a: [E, 2], out: ["torch", 16], max: 12, xp: 15 }],
    [{ a: ["wool", 10], out: [E, 1], max: 12, xp: 30 }, { a: [E, 6], out: ["bread", 12], max: 12, xp: 30 }]
  ],
  smith: [
    [{ a: ["coal", 15], out: [E, 1], max: 16, xp: 2 }, { a: [E, 7], out: ["iron_helmet", 1], max: 12, xp: 1 }],
    [{ a: ["iron_ingot", 4], out: [E, 1], max: 12, xp: 5 }, { a: [E, 9], out: ["iron_boots", 1], max: 12, xp: 5 }],
    [{ a: ["flint", 24], out: [E, 1], max: 12, xp: 10 }, { a: [E, 11], out: ["iron_pick", 1], max: 12, xp: 10 }],
    [{ a: ["diamond", 1], out: [E, 4], max: 12, xp: 15 }, { a: [E, 14], out: ["iron_chest", 1], max: 12, xp: 15 }],
    [{ a: [E, 15], out: ["diamond_sword", 1], max: 3, xp: 30 }, { a: [E, 18], out: ["diamond_chest", 1], max: 3, xp: 30 }]
  ],
  cleric: [
    [{ a: ["rotten_flesh", 32], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], out: ["redstone", 2], max: 16, xp: 1 }],
    [{ a: ["gold_ingot", 3], out: [E, 1], max: 12, xp: 5 }, { a: [E, 1], out: ["lapis", 1], max: 12, xp: 5 }],
    [{ a: ["bone", 20], out: [E, 1], max: 12, xp: 10 }, { a: [E, 4], out: ["glowstone", 1], max: 12, xp: 10 }],
    [{ a: ["rabbit_foot", 2], out: [E, 1], max: 12, xp: 15 }, { a: [E, 5], out: ["ender_pearl", 1], max: 12, xp: 15 }],
    [{ a: ["spider_eye", 6], out: [E, 1], max: 12, xp: 30 }, { a: [E, 3], out: ["glass_bottle", 3], max: 12, xp: 30 }]
  ]
};

Object.assign(MOBS, {
  pillager: { name: "Plünderer", kind: "hostile", w: 0.7, h: 1.8, hp: 24, speed: 2.4, dmg: 4, range: 24, xp: [6, 6], drops: [["arrow", 0, 2, 1], ["emerald", 0, 1, 0.2], ["bread", 0, 1, 0.3]] },
  vindicator: { name: "Diener", kind: "hostile", w: 0.7, h: 1.8, hp: 24, speed: 2.9, dmg: 8, range: 22, xp: [6, 6], drops: [["emerald", 0, 1, 0.35], ["iron_ingot", 0, 1, 0.15]] },
  illager_captain: { name: "Anführer", kind: "hostile", w: 0.7, h: 1.8, hp: 32, speed: 2.7, dmg: 8, range: 24, xp: [10, 10], drops: [["emerald", 1, 2, 1], ["iron_ingot", 0, 2, 0.5]] }
});
Object.assign(ADV, {
  trade: ["Ein guter Handel", "Tausche etwas mit einem Dorfbewohner."],
  sit: ["Platz genommen", "Setze dich auf ein Kissen."],
  autumn: ["Herbstzauber", "Besuche den Dappled Forest."],
  explore: ["Entdecker", "Finde das Ziel einer Entdeckerkarte."],
  omen: ["Unheilvolles Omen", "Besiege einen Anführer der Plünderer."],
  hero: ["Held des Dorfes", "Verteidige ein Dorf gegen einen Überfall."]
});
Object.assign(EFFECT_NAMES, { bad_omen: "Unheilvolles Omen", hero_village: "Held des Dorfes" });
EFFECT_BAD.add("bad_omen");

const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function installVillagers(Sandbox, K) {
  const { clamp, W, H, SPAWN_X, REACH } = K;
  const P = Sandbox.prototype;
  const cxOf = m => m.x + m.w / 2;
  const RAID_D = {};                                                              // Plünderer in Überfällen: sie sehen den Spieler von weit her
  const raidD = type => RAID_D[type] || (RAID_D[type] = { ...MOBS[type], range: 80 });

  // ---------- Erzeugen ----------
  P._newVillager = function (x, y, home, look) {
    return { x, y, w: 0.7, h: 1.7, vx: 0, vy: 0, onGround: false, face: 1, home, t: 1 + look, dir: 0, say: null, sayT: 0, cool: 3 + look * 2, look, stepUp: true, visOff: 0,
      prof: null, lvl: 1, xp: 0, locked: false, ws: null, offers: [], jobT: 0.5 + (look % 3) * 0.4 };
  };
  const prevEntities = P._entities;
  P._entities = function () {
    prevEntities.call(this);
    this.raid = null; this._lastDay = 0; this._vt = 1;
    const vs = this.villages && this.villages.length ? this.villages : [{ x: SPAWN_X, y: 60 }];
    this.villagers = [];
    vs.forEach((v, vi) => [-17, 0, 16].forEach((dx, i) => this.villagers.push(this._newVillager(v.x + dx + 1.6, v.y - 1.7 - 0.001, v.x + dx + 3, (vi * 3 + i) % 6))));
  };

  // ---------- Speichern ----------
  P._villSave = function () {
    return {
      villagers: this.villagers.map(v => ({
        x: +v.x.toFixed(2), y: +v.y.toFixed(2), home: v.home, look: v.look, prof: v.prof, lvl: v.lvl, xp: v.xp, locked: v.locked ? 1 : 0, ws: v.ws ? [v.ws.x, v.ws.y] : 0,
        offers: v.offers.map(o => ({ a: o.a, b: o.b || 0, out: this._packStack(o.out), max: o.max, uses: o.uses, xp: o.xp }))
      })),
      structs: (this.structs || []).map(s => ({ ...s }))
    };
  };
  P._villLoad = function (d) {
    this.structs = Array.isArray(d.structs) ? d.structs.filter(s => s && Number.isFinite(s.x) && Number.isFinite(s.y) && typeof s.kind === "string").map(s => ({ ...s, x: s.x | 0, y: s.y | 0 })) : [];
    if (!Array.isArray(d.villagers) || !d.villagers.length) return;
    const list = [];
    for (const r of d.villagers) {
      if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y)) continue;
      const v = this._newVillager(clamp(r.x, 0, W - 1), clamp(r.y, 0, H - 2), Number.isFinite(r.home) ? r.home : r.x, (r.look | 0) % 6);
      if (PROFS[r.prof]) {
        v.prof = r.prof; v.lvl = clamp(r.lvl | 0, 1, 5); v.xp = Math.max(0, r.xp | 0); v.locked = !!r.locked;
        if (Array.isArray(r.ws) && r.ws.length === 2) v.ws = { x: r.ws[0] | 0, y: r.ws[1] | 0 };
        for (const o of Array.isArray(r.offers) ? r.offers : []) {
          const out = this._unpackStack(o.out);
          if (!out || !ITEMS[out.id] || !Array.isArray(o.a) || !ITEMS[o.a[0]]) continue;
          v.offers.push({ a: [o.a[0], clamp(o.a[1] | 0, 1, 64)], b: Array.isArray(o.b) && ITEMS[o.b[0]] ? [o.b[0], clamp(o.b[1] | 0, 1, 64)] : null, out, max: clamp(o.max | 0, 1, 64), uses: clamp(o.uses | 0, 0, 64), xp: o.xp | 0 });
        }
      }
      list.push(v);
    }
    if (list.length) this.villagers = list;
  };

  // ---------- Berufe und Angebote ----------
  /** Angebote einer Stufe hinzufügen (Karten nur, wenn es das Ziel gibt) */
  P._offersFor = function (v, lvl) {
    const specs = (TRADES[v.prof] || [])[lvl - 1] || [];
    for (const sp of specs) {
      let spec = sp, out;
      if (sp.out === BOOK) out = this._randomBook(15 + Math.floor(this.mrng() * 15));
      else if (typeof sp.out === "string") {
        const kind = sp.out === "map_mansion" ? "mansion" : "monument";
        const t = this._nearestStruct(kind, v.x);
        if (!t) { spec = { a: ["glass", 8], out: [E, 1], max: 12, xp: sp.xp }; out = { id: E, n: 1, d: 0 }; }
        else out = { id: sp.out, n: 1, d: t.x };
      } else out = { id: sp.out[0], n: sp.out[1], d: 0 };
      if (!ITEMS[out.id] || !ITEMS[spec.a[0]]) continue;
      v.offers.push({ a: [...spec.a], b: spec.b ? [...spec.b] : null, out, max: spec.max, uses: 0, xp: spec.xp });
    }
  };
  P._nearestStruct = function (kind, x) {
    let best = null;
    for (const s of this.structs || []) if (s.kind === kind && (!best || Math.abs(s.x - x) < Math.abs(best.x - x))) best = s;
    return best;
  };
  P._claimJob = function (v) {
    const taken = new Set(this.villagers.filter(o => o !== v && o.ws).map(o => `${o.ws.x},${o.ws.y}`));
    const cx = Math.floor(cxOf(v)), cy = Math.floor(v.y + v.h / 2);
    let best = null, bd = 1e9;
    for (let x = cx - 20; x <= cx + 20; x++) for (let y = cy - 4; y <= cy + 4; y++) {
      const t = this.tile(x, y), prof = WORKSTATIONS[t];
      if (!prof || !PROFS[prof] || taken.has(`${x},${y}`)) continue;
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d < bd) { bd = d; best = { x, y, prof }; }
    }
    if (!best) return false;
    v.prof = best.prof; v.ws = { x: best.x, y: best.y }; v.lvl = 1; v.xp = 0; v.offers = []; v.home = best.x;
    this._offersFor(v, 1);
    this.events.push({ t: "job", x: cxOf(v), y: v.y, prof: v.prof });
    return true;
  };
  P._jobCheck = function (v) {
    if (v.prof && v.ws && !v.locked) {
      const t = this.tile(v.ws.x, v.ws.y);
      if (WORKSTATIONS[t] !== v.prof) { v.prof = null; v.ws = null; v.offers = []; v.lvl = 1; v.xp = 0; }
    } else if (v.prof && v.ws && v.locked) {
      // gelernt ist gelernt: der Beruf bleibt, auch wenn der Arbeitsblock verschwindet
    }
    if (!v.prof) this._claimJob(v);
    else if (!v.offers.length) for (let l = 1; l <= v.lvl; l++) this._offersFor(v, l);          // z. B. nach beschädigtem Spielstand
  };
  const prevVillager = P._villager;
  P._villager = function (v, dt) {
    const said = v.sayT;
    prevVillager.call(this, v, dt);
    if (v.sayT > said && v.prof && v.sayT > 3.9) { const L = PROFS[v.prof].lines; v.say = L[Math.floor(this.rng() * L.length)]; }
    v.jobT -= dt;
    if (v.jobT <= 0) { v.jobT = 3 + this.rng(); this._jobCheck(v); }
    if (v.ws && v.prof && Math.abs(cxOf(v) - v.ws.x) > 14) v.home = v.ws.x;
  };

  // ---------- Handel ----------
  P.villagerAtTile = function (tx, ty) {
    const p = this.player;
    for (const v of this.villagers) {
      if (v.x >= tx + 1 || v.x + v.w <= tx || v.y >= ty + 1 || v.y + v.h <= ty) continue;
      if (Math.hypot(cxOf(v) - (p.x + p.w / 2), v.y + v.h / 2 - (p.y + p.h / 2)) <= REACH + 1) return v;
    }
    return null;
  };
  P._villagerUse = function (tx, ty) {
    const v = this.villagerAtTile(tx, ty); if (!v) return false;
    v.face = sgn(this.player.x - v.x) || v.face;
    if (!v.prof) { v.say = "Hmm … ich brauche erst einen Arbeitsplatz."; v.sayT = 3; return true; }
    this.openWindow("trade", Math.floor(cxOf(v)), Math.floor(v.y));
    this.win.v = v;
    return true;
  };
  P.hero = function () { return !!(this.fx && this.fx.hero_village); };
  /** Preis, den der Spieler zahlt (Held des Dorfes: Smaragd-Preise sinken um 30 %) */
  P.offerCost = function (pair) {
    if (!pair) return null;
    return pair[0] === E && this.hero() ? [pair[0], Math.max(1, Math.round(pair[1] * 0.7))] : pair;
  };
  P.offerCan = function (o) {
    if (!o || o.uses >= o.max) return false;
    const a = this.offerCost(o.a), b = this.offerCost(o.b);
    if (!this.has(a[0], a[1])) return false;
    if (b) { if (b[0] === a[0]) { if (!this.has(a[0], a[1] + b[1])) return false; } else if (!this.has(b[0], b[1])) return false; }
    return true;
  };
  P.trade = function (i) {
    const w = this.win, v = w && w.kind === "trade" && w.v;
    if (!v || !v.offers[i]) return false;
    const o = v.offers[i];
    if (!this.offerCan(o)) return false;
    const a = this.offerCost(o.a), b = this.offerCost(o.b);
    this.take(a[0], a[1]); if (b) this.take(b[0], b[1]);
    const out = o.out;
    const rest = this.add(out.id, out.n, out.d || 0, true, out.e ? out : null);
    if (rest > 0) this.dropStack(this.newStack(out.id, rest, out.d || 0, out.e ? out : null), this.player.x + 0.4, this.player.y + 0.8, true);
    o.uses++;
    v.locked = true; v.xp += o.xp;
    this.addXp(3 + Math.floor(this.mrng() * 3));
    this.grant("trade");
    while (v.lvl < 5 && v.xp >= XP_NEXT[v.lvl]) { v.lvl++; this._offersFor(v, v.lvl); this.events.push({ t: "villager_level", lvl: v.lvl }); }
    this.events.push({ t: "trade", x: cxOf(v), y: v.y });
    return true;
  };
  P._restock = function () { for (const v of this.villagers) for (const o of v.offers) o.uses = 0; };

  // ---------- Karten ----------
  P.mapInfo = function (stack) {
    const s = stack || this.selStack();
    if (!s || !ITEMS[s.id] || !ITEMS[s.id].map) return null;
    const kind = ITEMS[s.id].map;
    return { kind, target: s.d | 0, name: ITEMS[s.id].name, px: this.player.x + this.player.w / 2, py: this.player.y };
  };
  P._useMap = function (s) {
    if (!s || !ITEMS[s.id] || !ITEMS[s.id].map) return false;
    this.openWindow("map", 0, 0);
    return true;
  };

  // ---------- Möbel ----------
  P.sitOn = function (tx, ty) {
    const p = this.player;
    if (this.tile(tx, ty) !== B.CUSHION || !this.reachOk(tx, ty)) return false;
    p.sit = { x: tx, y: ty };
    p.x = tx + 0.5 - p.w / 2; p.y = ty + 0.6 - p.h - 1e-3; p.vx = p.vy = 0; p.onGround = true;
    this.events.push({ t: "sit", x: tx, y: ty });
    this.grant("sit");
    return true;
  };
  const prevPlayer = P._player;
  P._player = function (dt) {
    const p = this.player;
    if (p.sit) {
      const inp = this.input;
      if (inp.left || inp.right || inp.jump || inp.down || this.tile(p.sit.x, p.sit.y) !== B.CUSHION) p.sit = null;
      else { p.vx = p.vy = 0; p.onGround = true; p.landV = 0; p.coyote = 0.1; return; }
    }
    prevPlayer.call(this, dt);
    // Lagerfeuer verbrennt, wer hineintritt
    const fx = Math.floor(p.x + p.w / 2), fy = Math.floor(p.y + p.h - 0.1);
    this._cfT = (this._cfT || 0) - dt;
    if (this.tile(fx, fy) === B.CAMPFIRE && this._cfT <= 0 && !this.fx.fire_resistance) { this._cfT = 0.8; this.hurt(1, 0, "fire"); p.burn = Math.max(p.burn || 0, 1.5); }
  };

  // ---------- Plünderer: Verhalten ----------
  const prevInit = P._mobInitNew;
  P._mobInitNew = function (m, type) {
    prevInit.call(this, m, type);
    if (type === "pillager") m.shootCd = 1.5 + this.mrng();
  };
  const prevAi = P._aiNew;
  P._aiNew = function (m, d, dt, dx, dy, dist) {
    switch (m.type) {
      case "pillager": this._aiRanged(m, m.raider ? raidD(m.type) : d, dt, dx, dy, dist, "arrow"); return 1;
      case "vindicator": case "illager_captain": this._aiMelee(m, m.raider ? raidD(m.type) : d, dt, dx, dy, dist, 11); return 1;
      case "witch": if (m.raider) { this._aiRanged(m, raidD("witch"), dt, dx, dy, dist, "potion"); return 1; } break;
    }
    return prevAi.call(this, m, d, dt, dx, dy, dist);
  };
  const prevDieNew = P._mobDieNew;
  P._mobDieNew = function (m, src) {
    prevDieNew.call(this, m, src);
    if (m.type === "illager_captain" && !m.raider && (src === "player" || src === "arrow")) { this.addEffect("bad_omen", 3000, 0); this.grant("omen"); this.events.push({ t: "omen", x: cxOf(m), y: m.y }); }
  };

  // ---------- Überfälle ----------
  P.raidInfo = function () {
    const r = this.raid; if (!r) return null;
    const left = r.foes.filter(m => !m.dead).length;
    return { wave: Math.max(1, r.wave), waves: r.waves, left, total: Math.max(r.total, left), state: r.state, x: r.vx };
  };
  P._raidStart = function (v) {
    this.raid = { vx: v.x, vy: v.y, wave: 0, waves: 3, foes: [], delay: 6, away: 0, state: "wait", total: 0 };
    delete this.fx.bad_omen;
    this.events.push({ t: "raid", s: "start", x: v.x });
    for (const vv of this.villagers) if (Math.abs(vv.x - v.x) < 40) { vv.say = "Plünderer! Hilfe!"; vv.sayT = 5; }
  };
  P._raidSpawn = function () {
    const r = this.raid, k = r.wave, W2 = this.ground;
    const counts = [["pillager", 1 + k], ["vindicator", k]];
    if (k >= 2) counts.push(["witch", k - 1]);
    if (k === r.waves) counts.push(["illager_captain", 1]);
    r.foes = [];
    let side = this.mrng() < 0.5 ? -1 : 1;
    for (const [type, n] of counts) for (let i = 0; i < n; i++) {
      side = -side;
      const x = clamp(Math.floor(r.vx + side * (18 + this.mrng() * 10)), 3, W - 4);
      const gy = W2[x] || r.vy;
      const yy = this._findSpawnY(x, Math.max(3, gy - 10), Math.min(H - 6, gy + 6), 2);
      const m = this.spawnMob(type, x + 0.5, yy >= 0 ? yy : gy, { raider: true, angry: true });
      if (this._hit(m)) { this._remove(m); continue; }
      r.foes.push(m);
    }
    r.total = r.foes.length; r.state = "fight";
    this.events.push({ t: "raid", s: "wave", wave: k });
  };
  P._raidEnd = function (win) {
    const r = this.raid; if (!r) return;
    for (const m of r.foes) if (!m.dead) this._remove(m);
    this.raid = null;
    if (win) {
      this.addEffect("hero_village", 1200, 0);
      this.grant("hero");
      this.addXp(40);
      this.add(E, 5, 0, true);
      for (const v of this.villagers) if (Math.abs(v.x - r.vx) < 40) { v.say = "Danke, Held!"; v.sayT = 5; }
    }
    this.events.push({ t: "raid", s: win ? "win" : "lose" });
  };
  const prevDie = P._die;
  P._die = function () { if (this.raid) this._raidEnd(false); prevDie.call(this); };

  P._villTick = function () {
    const p = this.player;
    if (this.dim) { if (this.raid) this._raidEnd(false); return; }
    const px = p.x + p.w / 2;
    // Überfall auslösen / fortführen
    if (!this.raid && this.fx.bad_omen) {
      let best = null;
      for (const v of this.villages || []) if (Math.abs(v.x - px) < 32 && this.villagers.some(q => Math.abs(q.x - v.x) < 30)) best = v;
      if (best) this._raidStart(best);
    }
    const r = this.raid;
    if (r) {
      r.away = Math.abs(px - r.vx) > 70 ? r.away + 1 : 0;
      if (r.away > 40) { this._raidEnd(false); }
      else if (r.state === "wait") { r.delay -= 1; if (r.delay <= 0) { r.wave++; this._raidSpawn(); } }
      else if (r.state === "fight") {
        r.foes = r.foes.filter(m => !m.dead && this.mobs.includes(m));
        if (!r.foes.length) { if (r.wave >= r.waves) this._raidEnd(true); else { r.state = "wait"; r.delay = 6; } }
      }
    }
    // Wächter der Bauwerke
    for (const s of this.structs || []) {
      if (s.g || Math.abs(s.x - px) > 34 || Math.abs(s.y - p.y) > 24) continue;
      if (s.kind === "outpost") {
        s.g = 1;
        this.spawnMob("illager_captain", s.x + 6.5, s.y); this.spawnMob("pillager", s.x - 5.5, s.y); this.spawnMob("pillager", s.x + 9.5, s.y);
      } else if (s.kind === "mansion") {
        s.g = 1;
        this.spawnMob("vindicator", s.x - 12 + 0.5, s.y); this.spawnMob("vindicator", s.x + 3 + 0.5, s.y);
        this.spawnMob("vindicator", s.x - 2 + 0.5, s.y - 5); this.spawnMob("vindicator", s.x + 3 + 0.5, s.y - 10);
      }
    }
    // Kartenziel / Dappled Forest
    const i = clamp(Math.floor(px), 0, W - 1);
    if (this.biomeAt(i) === "dappled") this.grant("autumn");
    const s = this.selStack();
    if (s && ITEMS[s.id] && ITEMS[s.id].map && s.d && Math.abs(s.d - px) < 14) this.grant("explore");
  };
  const prevMobs = P._mobs;
  P._mobs = function (dt) {
    prevMobs.call(this, dt);
    if (this.day !== this._lastDay) { if (this._lastDay) this._restock(); this._lastDay = this.day; }
    this._vt -= dt;
    if (this._vt <= 0) { this._vt = 1; this._villTick(); }
  };
}
