// =====================================================================
// Blockdorf – Inventar, Handwerk, Abbauen, Bauen, Kampf, Ofen, Truhen, Hunger, Erfahrung
// Wird an die Klasse Sandbox gehängt (installInventory) und hält sandbox-engine.js übersichtlich.
// =====================================================================
import { B, BLOCKS, ITEMS, RECIPES, SMELT, SMELT_TIME, hasTag, stackMax, isLog, isLeaves, isFluid, isPlant, isCrop, SILK, FORTUNE_BLOCKS } from "./sandbox-data.js?v=6";

export function installInventory(Sandbox, K) {
  const { clamp, REACH } = K;
  const W = K.W, H = K.H;
  const P = Sandbox.prototype;
  const fuelOf = id => (ITEMS[id] && ITEMS[id].fuel) || 0;
  const ingOk = (need, got) => !!got && (need[0] === "#" ? hasTag(got, need.slice(1)) : need === got);

  // ---------- Grundzustand ----------
  P._emptyInv = function () { return new Array(36).fill(null); };
  P._resetInventory = function () {
    this.inv = this._emptyInv();
    this.armor = [null, null, null, null];
    this.cursor = null;
    this.grid = new Array(9).fill(null);
    this.win = null;                 // { kind: "inv" | "bench" | "furnace" | "chest", x, y }
    this.ents = new Map();           // "x,y" → Ofen / Truhe
    this.drops = [];
    this.decay = [];
    this.sel = 0; this.xp = 0;
    this.food = 20; this.sat = 5; this.exh = 0; this.regenT = 0; this.starveT = 0; this.eatCd = 0;
  };

  // ---------- Plätze ----------
  /** Neuer Stapel; x = Vorlage, von der Verzauberungen (e) und Reparaturzähler (r) übernommen werden */
  const newStack = (id, n = 1, d = 0, x = null) => {
    const s = { id, n, d };
    if (x && x.e && Object.keys(x.e).length) s.e = { ...x.e };
    if (x && x.r) s.r = x.r;
    return s;
  };
  P.newStack = newStack;
  P.count = function (id) { let c = 0; for (const s of this.inv) if (s && s.id === id) c += s.n; return c; };
  P.has = function (id, n = 1) { return this.count(id) >= n; };
  /** Fügt Gegenstände ein (erst zu vorhandenen Stapeln, dann in leere Plätze). Gibt zurück, wie viele übrig blieben. */
  P._insert = function (arr, id, n, d = 0, from = 0, to = arr.length, x = null) {
    const max = stackMax(id);
    if (max > 1 && !(x && x.e)) for (let i = from; i < to && n > 0; i++) { const s = arr[i]; if (s && s.id === id && s.n < max) { const m = Math.min(n, max - s.n); s.n += m; n -= m; } }
    for (let i = from; i < to && n > 0; i++) if (!arr[i]) { const m = Math.min(n, max); arr[i] = newStack(id, m, d, x); n -= m; }
    return n;
  };
  P.add = function (id, n = 1, d = 0, silent = false, x = null) {
    if (!ITEMS[id]) return n;
    const rest = this._insert(this.inv, id, n, d, 0, 36, x);
    if (!silent && rest < n) this.events.push({ t: "pickup", item: id, n: n - rest });
    return rest;
  };
  P.take = function (id, n = 1) {
    if (!this.has(id, n)) return false;
    for (let i = 0; i < 36 && n > 0; i++) { const s = this.inv[i]; if (s && s.id === id) { const m = Math.min(n, s.n); s.n -= m; n -= m; if (s.n <= 0) this.inv[i] = null; } }
    return true;
  };
  P.room = function (id) {
    const max = stackMax(id); let r = 0;
    for (const s of this.inv) r += !s ? max : s.id === id ? max - s.n : 0;
    return r;
  };
  P.hotbar = function () { return this.inv.slice(0, 9); };
  P.selStack = function () { return this.inv[this.sel] || null; };
  P.selItem = function () { const s = this.selStack(); return s ? s.id : null; };
  P.select = function (i) { this.sel = clamp(i | 0, 0, 8); };
  P.defense = function () { let d = 0; for (const s of this.armor) if (s) d += ITEMS[s.id].armor.def + ((s.e && s.e.protection) | 0); return d; };
  /** Werkzeug in der Hand: type = Art (oder null), tier = Stufe, speed = Abbautempo, dmg = Schaden */
  P.heldTool = function () {
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (it && it.tool) { const e = s.e || {}; return { type: it.tool, tier: it.tier, speed: it.speed + (e.efficiency ? e.efficiency * e.efficiency + 1 : 0), dmg: it.dmg, slot: this.sel, ench: e }; }
    return { type: null, tier: 0, speed: 1, dmg: 1, slot: -1, ench: s && s.e && ITEMS[s.id].dur ? s.e : {} };
  };
  P._wear = function (arr, i, n, ev) {
    const s = arr[i]; if (!s) return;
    const it = ITEMS[s.id]; if (!it.dur) return;
    if (s.e && s.e.unbreaking) { let k = 0; for (let i = 0; i < n; i++) if (this.frng() < 1 / (s.e.unbreaking + 1)) k++; n = k; if (!n) return; }
    s.d = (s.d || 0) + n;
    if (s.d >= it.dur) { arr[i] = null; this.events.push({ t: "toolbreak", item: s.id }); }
  };
  P.wearArmor = function (i) { this._wear(this.armor, i, 1); };
  P.addXp = function (n) {
    if (n <= 0) return;
    const before = this.level();
    // Reparatur: Erfahrung flickt Gegenstände mit Reparatur (Mending) – 2 Haltbarkeit je Punkt
    const cand = [this.inv[this.sel], ...this.armor].filter(s => s && s.e && s.e.mending && s.d > 0);
    if (cand.length) { const s = cand[Math.floor(this.frng() * cand.length)], fix = Math.min(s.d, n * 2); s.d -= fix; n -= Math.ceil(fix / 2); }
    this.xp += n;
    this.events.push({ t: "xp", n: n < 1 ? 1 : n });
    if (this.level() > before) this.events.push({ t: "level", level: this.level() });
  };
  /** Erfahrung wie Minecraft: Stufe L → L+1 braucht 2L+7 (bis 15), danach 5L−38 */
  const need = L => (L < 15 ? 2 * L + 7 : L < 30 ? 5 * L - 38 : 9 * L - 158);
  P._need = need;
  P.level = function () { let L = 0, x = this.xp; while (x >= need(L)) { x -= need(L); L++; } return L; };
  P.levelFrac = function () { let L = 0, x = this.xp; while (x >= need(L)) { x -= need(L); L++; } return x / need(L); };

  // ---------- Hunger ----------
  P.addExh = function (x) {
    this.exh += x;
    while (this.exh >= 4) { this.exh -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else this.food = Math.max(0, this.food - 1); }
  };
  P._hunger = function (dt) {
    const p = this.player;
    this.eatCd = Math.max(0, this.eatCd - dt);
    if (this.food >= 18 && p.hp < p.maxHp) {
      this.regenT += dt;
      if (this.regenT >= (this.food >= 20 && this.sat > 0 ? 0.6 : 4)) { this.regenT = 0; p.hp++; this.addExh(4); }
    } else if (this.food <= 0) {
      this.starveT += dt;
      if (this.starveT >= 4) { this.starveT = 0; if (p.hp > 1) this.hurt(1, 0, "hunger"); }
    } else { this.regenT = 0; this.starveT = 0; }
  };
  P.eat = function () {
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (!it || !it.food || this.food >= 20 || this.eatCd > 0) return false;
    this.food = Math.min(20, this.food + it.food[0]);
    this.sat = Math.min(this.food, this.sat + it.food[1]);
    this._consumeSel();
    this.eatCd = 0.5;
    this.events.push({ t: "eat", item: s ? it.id : null });
    return true;
  };
  P._consumeSel = function () { const s = this.inv[this.sel]; if (!s) return; s.n--; if (s.n <= 0) this.inv[this.sel] = null; };

  // ---------- Handwerk ----------
  P.gridSize = function () { return this.win && this.win.kind === "bench" ? 3 : 2; };
  P._cells = function () { const n = this.gridSize(); return this.grid.slice(0, n * n).map(s => (s ? s.id : null)); };
  function matchShaped(r, cells, size) {
    // Ausschnitt der belegten Felder
    let x0 = size, x1 = -1, y0 = size, y1 = -1;
    for (let i = 0; i < cells.length; i++) if (cells[i]) { const x = i % size, y = (i / size) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < 0) return false;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (r.shape.length !== h || r.shape[0].length !== w) return false;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
        const ch = r.shape[y][mirror ? w - 1 - x : x], got = cells[(y0 + y) * size + x0 + x];
        if (ch === " ") { if (got) ok = false; } else if (!ingOk(r.key[ch], got)) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }
  function matchLess(r, cells) {
    const got = cells.filter(Boolean);
    if (got.length !== r.ingredients.length) return false;
    const used = new Array(got.length).fill(false);
    for (const need of r.ingredients) { const i = got.findIndex((g, k) => !used[k] && ingOk(need, g)); if (i < 0) return false; used[i] = true; }
    return true;
  }
  P.matchRecipe = function () {
    const size = this.gridSize(), cells = this._cells();
    if (!cells.some(Boolean)) return null;
    for (const r of RECIPES) if (r.shape ? matchShaped(r, cells, size) : matchLess(r, cells)) return r;
    return null;
  };
  P.craftResult = function () { const r = this.matchRecipe(); return r ? { id: r.out[0], n: r.out[1], recipe: r } : null; };
  P._consumeGrid = function () { const n = this.gridSize() ** 2; for (let i = 0; i < n; i++) { const s = this.grid[i]; if (s) { s.n--; if (s.n <= 0) this.grid[i] = null; } } };
  P._clickOut = function (shift) {
    let made = 0;
    for (let guard = 0; guard < 64; guard++) {
      const r = this.craftResult();
      if (!r) break;
      if (shift) {
        if (this.room(r.id) < r.n) break;
        this._consumeGrid(); this.add(r.id, r.n, 0, true);
      } else {
        const c = this.cursor;
        if (c && (c.id !== r.id || c.n + r.n > stackMax(r.id))) break;
        this._consumeGrid();
        if (c) c.n += r.n; else this.cursor = newStack(r.id, r.n);
      }
      made++; this.events.push({ t: "craft", id: r.id });
      if (!shift) break;
    }
    return made > 0;
  };
  /** Rezept aus dem Inventar ins Raster legen (Rezeptbuch). Gibt false zurück, wenn nicht genug da ist oder das Raster zu klein ist. */
  P.fillRecipe = function (id) {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return false;
    const size = this.gridSize();
    const rows = r.shape || null;
    if (rows && (rows.length > size || rows[0].length > size)) { this.events.push({ t: "needbench" }); return false; }
    if (!rows && r.ingredients.length > size * size) { this.events.push({ t: "needbench" }); return false; }
    this._clearGrid();
    const cells = [];
    if (rows) rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== " ") cells.push([y * size + x, r.key[ch]]); }));
    else r.ingredients.forEach((n, i) => cells.push([i, n]));
    for (const [pos, needId] of cells) {
      const i = this.inv.findIndex(s => s && ingOk(needId, s.id));
      if (i < 0) { this._clearGrid(); return false; }
      const s = this.inv[i];
      this.grid[pos] = newStack(s.id, 1, s.d, s);
      s.n--; if (s.n <= 0) this.inv[i] = null;
    }
    return true;
  };
  P._clearGrid = function () {
    for (let i = 0; i < 9; i++) { const s = this.grid[i]; if (s) { const rest = this._insert(this.inv, s.id, s.n, s.d, 0, 36, s); if (rest) this.dropStack(newStack(s.id, rest, s.d, s)); this.grid[i] = null; } }
  };
  /** Rezepte, die man gerade mit dem Inventar herstellen könnte (für das Rezeptbuch) */
  P.recipeAvailable = function (r) {
    const have = {}; for (const s of this.inv) if (s) have[s.id] = (have[s.id] || 0) + s.n;
    for (const s of this.grid) if (s) have[s.id] = (have[s.id] || 0) + s.n;
    const want = [];
    if (r.shape) { for (const row of r.shape) for (const ch of row) if (ch !== " ") want.push(r.key[ch]); }
    else want.push(...r.ingredients);
    const left = { ...have };
    for (const w of want) {
      const id = Object.keys(left).find(k => left[k] > 0 && ingOk(w, k));
      if (!id) return false; left[id]--;
    }
    return true;
  };
  P.recipeNeedsBench = function (r) { return r.shape ? r.shape.length > 2 || r.shape[0].length > 2 : r.ingredients.length > 4; };

  // ---------- Fenster (Inventar, Werkbank, Ofen, Truhe) ----------
  P.openWindow = function (kind, x = 0, y = 0) {
    this.closeWindow();
    this.win = { kind, x, y };
    this.mining = null;
    this.events.push({ t: "open", kind, x, y });
  };
  P.closeWindow = function () {
    if (!this.win) return;
    this._clearGrid();
    if (this.cursor) { const c = this.cursor; this.cursor = null; const rest = this._insert(this.inv, c.id, c.n, c.d, 0, 36, c); if (rest) this.dropStack(newStack(c.id, rest, c.d, c)); }
    this.win = null;
    this.events.push({ t: "close" });
  };
  P._windowCheck = function () {
    const w = this.win;
    if (!w || w.kind === "inv" || w.kind === "adv") return;
    const p = this.player;
    if (Math.hypot(w.x + 0.5 - (p.x + p.w / 2), w.y + 0.5 - (p.y + p.h / 2)) > REACH + 2 || !BLOCKS[this.tile(w.x, w.y)].interact) this.closeWindow();
  };
  P.winEnt = function () { return this.win ? this.ents.get(`${this.win.x},${this.win.y}`) || null : null; };
  P.slots = function (area) {
    if (area === "inv") return this.inv;
    if (area === "armor") return this.armor;
    if (area === "grid") return this.grid;
    const e = this.winEnt();
    if ((area === "f" && e && e.t === "furnace") || (area === "chest" && e && (e.t === "chest" || e.t === "disp")) || (area === "b" && e && e.t === "brew") || (area === "bn" && e && e.t === "beacon")) return e.s;
    return null;
  };
  P.canPut = function (area, idx, st) {
    const it = ITEMS[st.id];
    if (area === "armor") return !!it.armor && it.armor.slot === idx;
    if (area === "f") return idx === 0 ? !!SMELT[st.id] : idx === 1 ? fuelOf(st.id) > 0 : false;
    if (area === "b") return this.brewCanPut(idx, st);
    if (area === "bn") return st.id === "iron_ingot" || st.id === "gold_ingot" || st.id === "emerald" || st.id === "diamond";
    if (area === "grid" && this.win && this.win.kind === "ench") return idx === 0 ? this.enchantable(st) : idx === 1 && st.id === "lapis";
    if (area === "grid" && this.win && this.win.kind === "anvil") return idx < 2;
    return area !== "out";
  };
  /** Mausklick auf einen Platz wie in Minecraft. right = rechte Maustaste */
  P.click = function (area, idx, right = false) {
    if (area === "out") { if (this.win && this.win.kind === "anvil") this.anvilTake(false); else this._clickOut(false); return; }
    const arr = this.slots(area);
    if (!arr || idx < 0 || idx >= arr.length) return;
    const s = arr[idx], c = this.cursor;
    if (area === "f" && idx === 2) {          // Ergebnis des Ofens: nur nehmen
      if (!s) return;
      if (!c) this.cursor = s; else if (c.id === s.id && c.n + s.n <= stackMax(c.id)) c.n += s.n; else return;
      arr[idx] = null; this._furnaceXp();
      return;
    }
    if (!c) {
      if (!s) return;
      if (right && s.n > 1) { const h = Math.ceil(s.n / 2); this.cursor = newStack(s.id, h, s.d, s); s.n -= h; } else { this.cursor = s; arr[idx] = null; }
      return;
    }
    if (!this.canPut(area, idx, c)) return;
    if (!s) {
      if (right && c.n > 1) { arr[idx] = newStack(c.id, 1, c.d, c); c.n--; } else { arr[idx] = c; this.cursor = null; }
      return;
    }
    if (s.id === c.id && stackMax(c.id) > 1 && !s.e && !c.e) {
      const m = Math.min(right ? 1 : c.n, stackMax(s.id) - s.n);
      s.n += m; c.n -= m; if (c.n <= 0) this.cursor = null;
      return;
    }
    if (right) return;
    arr[idx] = c; this.cursor = s;
  };
  /** Umschalt-Klick: Stapel schnell verschieben */
  P.shiftClick = function (area, idx) {
    if (area === "out") { if (this.win && this.win.kind === "anvil") this.anvilTake(true); else this._clickOut(true); return; }
    const arr = this.slots(area);
    if (!arr || !arr[idx]) return;
    const s = arr[idx];
    const move = (to, from = 0, upto = to.length) => { const rest = this._insert(to, s.id, s.n, s.d, from, upto, s); if (rest === s.n) return false; s.n = rest; if (rest <= 0) arr[idx] = null; return true; };
    if (area === "inv") {
      const e = this.winEnt();
      if (this.win && (this.win.kind === "chest" || this.win.kind === "disp") && e) { move(e.s); return; }
      if (this.win && this.win.kind === "beacon" && e) { if ((s.id === "iron_ingot" || s.id === "gold_ingot" || s.id === "emerald" || s.id === "diamond") && move(e.s, 0, 1)) return; }
      if (this.win && this.win.kind === "brew" && e) {
        for (const [a, b] of [[0, 3], [3, 4], [4, 5]]) if (this.brewCanPut(a, s) && move(e.s, a, b)) return;
      }
      if (this.win && this.win.kind === "ench") {
        if (s.id === "lapis") { move(this.grid, 1, 2); return; }
        if (this.enchantable(s) && !this.grid[0]) { move(this.grid, 0, 1); return; }
      }
      if (this.win && this.win.kind === "anvil" && (!this.grid[0] || !this.grid[1])) { move(this.grid, 0, 2); return; }
      if (this.win && this.win.kind === "furnace" && e) {
        if (SMELT[s.id]) { if (!e.s[0] || e.s[0].id === s.id) { move(e.s, 0, 1); return; } }
        if (fuelOf(s.id)) { move(e.s, 1, 2); return; }
      }
      const it = ITEMS[s.id];
      if (it.armor && !this.armor[it.armor.slot]) { this.armor[it.armor.slot] = s; arr[idx] = null; return; }
      if (idx < 9) move(this.inv, 9, 36); else move(this.inv, 0, 9);
      return;
    }
    if (area === "f" && idx === 2) { move(this.inv); if (!arr[2]) this._furnaceXp(); return; }
    move(this.inv);
  };
  /** Gegenstand aus der Hand werfen (Taste Q) oder Stapel unter dem Mauszeiger loswerden */
  P.throwHeld = function (all = false) {
    const s = this.selStack(); if (!s) return;
    const n = all ? s.n : 1;
    const st = newStack(s.id, n, s.d, s);
    s.n -= n; if (s.n <= 0) this.inv[this.sel] = null;
    const p = this.player;
    this.dropStack(st, p.x + p.w / 2, p.y + 0.6, false, p.face);
  };
  P.throwCursor = function (all = true) {
    const c = this.cursor; if (!c) return;
    const n = all ? c.n : 1; const st = newStack(c.id, n, c.d, c);
    c.n -= n; if (c.n <= 0) this.cursor = null;
    const p = this.player;
    this.dropStack(st, p.x + p.w / 2, p.y + 0.6, false, p.face);
  };

  // ---------- Drops ----------
  P.dropStack = function (st, x, y, scatter = false, dir = 0) {
    const p = this.player;
    x = x ?? p.x + p.w / 2; y = y ?? p.y + 0.6;
    const r = this.rng || Math.random;
    this.drops.push({ id: st.id, n: st.n, d: st.d || 0, e: st.e, r: st.r, x: x - 0.15, y: y - 0.15, vx: dir ? dir * 5 : (scatter ? (r() - 0.5) * 3 : (r() - 0.5) * 2), vy: dir ? -3 : -(2 + r() * 3), w: 0.3, h: 0.3, age: dir ? -0.6 : 0, stepUp: false, onGround: false });
    if (this.drops.length > 260) this.drops.shift();
  };
  P._drops = function (dt) {
    const p = this.player, pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age > 300 || d.y > H) { this.drops.splice(i, 1); continue; }
      const dx = pcx - (d.x + 0.15), dy = pcy - (d.y + 0.15), dist = Math.hypot(dx, dy);
      if (d.age > 0.5 && dist < 2.6 && this.room(d.id) > 0) {              // werden vom Spieler angezogen
        const k = Math.min(1, 9 * dt / Math.max(dist, 0.1));
        d.x += dx * k; d.y += dy * k; d.vy = 0;
        if (dist < 0.7) {
          const rest = this.add(d.id, d.n, d.d, false, d);
          if (rest <= 0) { this.drops.splice(i, 1); continue; }
          d.n = rest;
        }
        continue;
      }
      this._body(d, dt, 30);
      if (d.inLava) { this.drops.splice(i, 1); this.events.push({ t: "hiss", x: d.x, y: d.y }); continue; }
      if (d.onGround) d.vx *= 0.85;
    }
  };

  // ---------- Abbauen ----------
  P.reachOk = function (tx, ty) {
    const p = this.player;
    return Math.hypot(tx + 0.5 - (p.x + p.w / 2), ty + 0.5 - (p.y + p.h / 2)) <= REACH;
  };
  /** Ein Bild lang abbauen. Liefert 0 = nichts, 1 = in Arbeit, 2 = abgebaut. */
  P.mineStep = function (tx, ty, dt) {
    if (this.win) return 0;
    if (!this.reachOk(tx, ty)) { this.mining = null; return 0; }
    const id = this.tile(tx, ty), bd = BLOCKS[id];
    if (id === B.AIR || bd.hard === Infinity) { this.mining = null; return 0; }
    const tool = this.heldTool(), match = !!bd.tool && tool.type === bd.tool;
    const harvest = !bd.tier || (match && tool.tier >= bd.tier);
    if (!this.mining || this.mining.x !== tx || this.mining.y !== ty) {
      this.mining = { x: tx, y: ty, p: 0, harvest };
      if (!harvest) this.events.push({ t: "noharvest", id });
    }
    let time = bd.hard / (match ? tool.speed : 1);
    if (!harvest) time *= 3.33;
    this.mining.p += dt / Math.max(0.03, time);
    if (this.mining.p >= 1) { this._break(tx, ty, true); this.mining = null; return 2; }
    return 1;
  };
  P.mineStop = function () { this.mining = null; };
  P._break = function (x, y, byPlayer) {
    const id = this.tile(x, y), bd = BLOCKS[id];
    if (id === B.AIR) return;
    const aux = this.aux[y * W + x];
    const tool = this.heldTool();
    const harvest = !byPlayer || !bd.tier || (!!bd.tool && tool.type === bd.tool && tool.tier >= bd.tier);
    // Tür: beide Hälften zusammen
    if (id === B.DOOR_B || id === B.DOOR_BO) { this.setTile(x, y - 1, B.AIR); }
    else if (id === B.DOOR_T || id === B.DOOR_TO) { y += 1; this.setTile(x, y, B.AIR); this.setTile(x, y - 1, B.AIR); this.dropFrom("door", 1, x, y, harvest || !byPlayer); this.stats.mined++; this.events.push({ t: "break", x, y, id }); this._settle(x, y); return; }
    if (this._rsBreak) this._rsBreak(x, y, id, aux);
    this.setTile(x, y, B.AIR);
    if (this._dimBreak) this._dimBreak(x, y, id);
    const key = `${x},${y}`, ent = this.ents.get(key);
    if (ent) { for (const st of ent.s) if (st) this.dropStack(st, x + 0.5, y + 0.5, true); this.ents.delete(key); }
    const ench = byPlayer ? tool.ench || {} : {};
    const special = harvest && !this._noDrops ? (ench.silk_touch && SILK[id] ? [[SILK[id], 1]] : this._specialDrops(id, aux, harvest, ench.fortune | 0)) : null;
    if (special) { for (const [item, n] of special) if (n > 0) this.dropFrom(item, n, x, y, true); }
    else if (bd.drop && harvest && !this._noDrops) {
      let dn = bd.dropN ? bd.dropN[0] + Math.floor(this.rng() * (bd.dropN[1] - bd.dropN[0] + 1)) : 1;
      if (ench.fortune && FORTUNE_BLOCKS.has(id)) dn *= 1 + Math.max(0, Math.floor(this.rng() * (ench.fortune + 2)) - 1);
      this.dropFrom(id === B.GRAVEL && this.rng() < 0.1 ? "flint" : bd.drop, dn, x, y, true);
    }
    if (isLeaves(id) && !(ench.silk_touch && id === B.LEAVES)) {
      const r = this.rng(); if (r < (id === B.LEAVES || id === B.BIRCH_LEAVES ? 0.06 : 0)) this.dropFrom("apple", 1, x, y, true); else if (r < 0.16) this.dropFrom("stick", 1, x, y, true);
    }
    if (id === B.ICE && !ench.silk_touch && this.tile(x, y + 1) !== B.AIR && !isPlant(this.tile(x, y + 1))) this._setFluid(y * W + x, B.WATER, 9);
    if (byPlayer) {
      this.stats.mined++;
      if (harvest && id === B.COAL) this.addXp(Math.floor(this.rng() * 3));
      if (harvest && (id === B.DIAMOND || id === B.EMERALD)) this.addXp(3 + Math.floor(this.rng() * 5));
      if (harvest && id === B.LAPIS) this.addXp(2 + Math.floor(this.rng() * 4));
      if (harvest && id === B.REDSTONE) this.addXp(1 + Math.floor(this.rng() * 5));
      if (bd.hard > 0.1 && tool.type) this._wear(this.inv, this.sel, tool.type === "sword" ? 2 : 1);
      this.addExh(0.005);
    }
    this.events.push({ t: "break", x, y, id });
    if (isLog(id)) this._decayScan(x, y);
    this._settle(x, y);
  };
  P.dropFrom = function (item, n, x, y, ok = true) { if (ok) this.dropStack(newStack(item, n), x + 0.5, y + 0.5, true); };
  /** Beute mit besonderen Regeln (Ernte, hohes Gras): kommt aus sandbox-farm.js */

  /** Nach dem Abbauen: Fackeln ohne Halt, Pflanzen ohne Boden, Türen und Leitern ohne Halt fallen ab; Sand fällt nach */
  P._settle = function (x, y) {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy, id = this.tile(nx, ny);
      if (id === B.TORCH && !this._supported(nx, ny)) { this.setTile(nx, ny, B.AIR); this.dropFrom("torch", 1, nx, ny); this.events.push({ t: "break", x: nx, y: ny, id }); this._settle(nx, ny); }
      else if (id === B.BED && !BLOCKS[this.tile(nx, ny + 1)].solid && !this._supported(nx, ny)) { this.setTile(nx, ny, B.AIR); this.dropFrom("bed", 1, nx, ny); this.events.push({ t: "break", x: nx, y: ny, id }); }
      else if (id === B.SKULL && !this._supported(nx, ny)) { this.setTile(nx, ny, B.AIR); this.dropFrom("wither_skeleton_skull", 1, nx, ny); this.events.push({ t: "break", x: nx, y: ny, id }); }
      else if (isPlant(id) && !BLOCKS[this.tile(nx, ny + 1)].solid) { this.setTile(nx, ny, B.AIR); this.events.push({ t: "break", x: nx, y: ny, id }); }
      else if (id === B.CACTUS && this.tile(nx, ny + 1) !== B.SAND && this.tile(nx, ny + 1) !== B.CACTUS) { this.setTile(nx, ny, B.AIR); this.dropFrom("cactus", 1, nx, ny); this.events.push({ t: "break", x: nx, y: ny, id }); this._settle(nx, ny); }
      else if (id === B.LADDER && !this._ladderOk(nx, ny)) { this.setTile(nx, ny, B.AIR); this.dropFrom("ladder", 1, nx, ny); this.events.push({ t: "break", x: nx, y: ny, id }); this._settle(nx, ny); }
      else if ((id === B.DOOR_B || id === B.DOOR_BO) && !BLOCKS[this.tile(nx, ny + 1)].solid) { this._break(nx, ny, false); }
      else if (isCrop(id) && !this._cropOk(nx, ny)) { this._cropBreak(nx, ny); }
      else if (this._rsSettle && this._rsSettle(nx, ny, id)) { /* Redstone-Teil ohne Halt ist abgefallen */ }
    }
    this._sandFall(x, y - 1);
  };
  P._sandFall = function (x, y) {
    let moved = false;
    const fid = this.tile(x, y);
    while ((fid === B.SAND || fid === B.GRAVEL) && this.tile(x, y) === fid && y + 1 < H - 2 && !BLOCKS[this.tile(x, y + 1)].solid) {
      const below = this.tile(x, y + 1);
      if (below === B.TORCH || below === B.LADDER) break;
      this.setTile(x, y, B.AIR); this.setTile(x, y + 1, fid); y++; moved = true;
    }
    if (moved) this.events.push({ t: "sand", x, y });
  };
  P._supported = function (x, y) { return BLOCKS[this.tile(x - 1, y)].solid || BLOCKS[this.tile(x + 1, y)].solid || BLOCKS[this.tile(x, y + 1)].solid || BLOCKS[this.tile(x, y - 1)].solid; };
  P._ladderOk = function (x, y) { return BLOCKS[this.tile(x - 1, y)].solid || BLOCKS[this.tile(x + 1, y)].solid || this.tile(x, y - 1) === B.LADDER || (this.tile(x, y + 1) === B.LADDER) || BLOCKS[this.tile(x, y + 1)].solid; };

  // ---------- Laub ohne Baum verschwindet ----------
  P._decayScan = function (x, y) {
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const lx = x + dx, ly = y + dy;
      if (isLeaves(this.tile(lx, ly)) && !this._nearLog(lx, ly) && !this.decay.some(q => q.x === lx && q.y === ly)) this.decay.push({ x: lx, y: ly, t: 0.4 + this.rng() * 5 });
    }
  };
  P._nearLog = function (x, y) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4 && isLog(this.tile(x + dx, y + dy))) return true;
    return false;
  };
  P._decayStep = function (dt) {
    for (let i = this.decay.length - 1; i >= 0; i--) {
      const q = this.decay[i]; q.t -= dt;
      if (q.t > 0) continue;
      this.decay.splice(i, 1);
      if (isLeaves(this.tile(q.x, q.y)) && !this._nearLog(q.x, q.y)) this._break(q.x, q.y, false);
    }
  };

  // ---------- Benutzen / Bauen ----------
  P.benchNear = function () {
    const p = this.player, cx = Math.floor(p.x + p.w / 2), cy = Math.floor(p.y + p.h / 2);
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) if (this.tile(x, y) === B.BENCH) return true;
    return false;
  };
  P._toggleDoor = function (x, y) {
    const id = this.tile(x, y);
    const by = id === B.DOOR_B || id === B.DOOR_BO ? y : y + 1;
    const open = this.tile(x, by) === B.DOOR_BO;
    if (!open) { this.setTile(x, by, B.DOOR_BO); this.setTile(x, by - 1, B.DOOR_TO); }
    else {
      const p = this.player;
      const over = { x, y: by - 1, w: 1, h: 2 };
      if (p.x < over.x + 1 && p.x + p.w > over.x && p.y < over.y + 2 && p.y + p.h > over.y) return false;   // man steht in der Tür
      this.setTile(x, by, B.DOOR_B); this.setTile(x, by - 1, B.DOOR_T);
    }
    this.events.push({ t: "door", x, y: by, open: !open });
    return true;
  };
  /** Rechtsklick: Block benutzen (Werkbank, Ofen, Truhe, Tür), essen oder bauen */
  /** Neue Blockdaten (Ofen, Truhe, Spender, Braustand) */
  P._newEnt = function (kind) {
    if (kind === "chest") return { t: "chest", s: new Array(27).fill(null) };
    if (kind === "disp") return { t: "disp", s: new Array(9).fill(null) };
    if (kind === "brew") return { t: "brew", s: new Array(5).fill(null), fuel: 0, brewT: 0 };
    if (kind === "beacon") return { t: "beacon", s: [null], eff: null, lvl: 0, on: false };
    return { t: "furnace", s: [null, null, null], burn: 0, burnMax: 0, cook: 0, xp: 0 };
  };
  P.use = function (tx, ty) {
    if (this.win) return false;
    if (this.fish && this.selItem() === "fishing_rod") return this._reel();            // Angel einholen: egal wohin man klickt
    { const s0 = this.selStack(); if (s0 && this._useSpecial(s0, tx, ty)) return true; }   // Feuerzeug, Enderauge, Enderperle
    if (!this.reachOk(tx, ty)) return false;
    const id = this.tile(tx, ty), bd = BLOCKS[id];
    if (bd.interact) {
      if (id === B.BENCH) { this.openWindow("bench", tx, ty); return true; }
      if (id === B.ENCHANT) { this.openWindow("ench", tx, ty); return true; }
      if (id === B.ANVIL) { this.openWindow("anvil", tx, ty); return true; }
      if (bd.entity) {
        const key = `${tx},${ty}`;
        if (!this.ents.has(key)) this.ents.set(key, this._newEnt(bd.entity));
        this.openWindow(bd.entity, tx, ty); return true;
      }
      if (id >= B.DOOR_B && id <= B.DOOR_TO) return this._toggleDoor(tx, ty);
      if (id === B.BED) return this.sleep(tx, ty);
      if (id === B.LEVER) return this._rsLever(tx, ty);
      if (id === B.BUTTON) return this._rsButton(tx, ty);
    }
    if (this.mobUse(tx, ty)) return true;
    const s = this.selStack(), it = s && ITEMS[s.id];
    if (s && (s.id === "bucket" || s.id === "water_bucket" || s.id === "lava_bucket")) return this.useBucket(tx, ty);
    if (s) {
      if (it.tool === "hoe" && this._till(tx, ty)) return true;
      if (it.put && it.put[0] === "plant" && this._plant(tx, ty)) return true;
      if (s.id === "bone_meal" && this._fertilize(tx, ty)) return true;
      if (s.id === "fishing_rod") return this._rodUse(tx, ty);
      if (s.id === "glass_bottle" && this._fillBottle(tx, ty)) return true;
      if (s.id === "potion") return this.drink();
      if (s.id === "splash_potion") return this.throwPotion(tx, ty);
      if (it.food && this.food < 20) return this.eat();
    }
    return this.place(tx, ty);
  };
  /** Ausgewählten Block setzen */
  P.place = function (tx, ty) {
    const s = this.selStack();
    if (s && ITEMS[s.id].put) return ITEMS[s.id].put[0] === "rs" ? this._rsPlace(tx, ty, ITEMS[s.id].put[1]) : false;
    if (!s || !ITEMS[s.id].block) return false;
    if (!this.reachOk(tx, ty) || tx < 0 || tx >= W || ty < 2 || ty >= H - 2) return false;
    const cur = this.tile(tx, ty);
    const id = ITEMS[s.id].block;
    if (cur !== B.AIR && !isPlant(cur) && !(isFluid(cur) && BLOCKS[id].solid)) return false;
    const isDoor = id === B.DOOR_B;
    if (isDoor) {
      const up = this.tile(tx, ty - 1);
      if (!(up === B.AIR || isPlant(up)) || !BLOCKS[this.tile(tx, ty + 1)].solid) return false;
    } else if (id === B.LADDER) { if (!this._ladderOk(tx, ty)) return false; }
    else if (!this._supported(tx, ty)) return false;
    const solid = BLOCKS[id].solid;
    if (solid) {
      const box = { x: tx, y: isDoor ? ty - 1 : ty, w: 1, h: isDoor ? 2 : 1 };
      const over = b => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y;
      if (over(this.player) || this.villagers.some(over) || this.mobs.some(over)) return false;
    }
    this.setTile(tx, ty, id);
    if (isDoor) this.setTile(tx, ty - 1, B.DOOR_T);
    if (BLOCKS[id].entity) this.ents.set(`${tx},${ty}`, this._newEnt(BLOCKS[id].entity));
    this._consumeSel();
    this.stats.built++;
    this.events.push({ t: "place", x: tx, y: ty, id });
    if (id === B.SKULL) this._witherCheck(tx, ty);
    if (id === B.SAND || id === B.GRAVEL) this._sandFall(tx, ty);
    return true;
  };

  // ---------- Kampf: siehe sandbox-mobs.js ----------

  // ---------- Ofen ----------
  P._furnaceXp = function () {
    const e = this.winEnt(); if (!e || e.t !== "furnace" || e.xp <= 0) return;
    const n = Math.floor(e.xp) + (this.rng() < e.xp % 1 ? 1 : 0);
    e.xp = 0; this.addXp(n);
  };
  P._furnaces = function (dt) {
    for (const e of this.ents.values()) {
      if (e.t !== "furnace") continue;
      const inp = e.s[0], fuel = e.s[1], out = e.s[2];
      const res = inp && SMELT[inp.id];
      const can = !!res && (!out || (out.id === res[0] && out.n < stackMax(out.id)));
      if (e.burn > 0) e.burn = Math.max(0, e.burn - dt);
      if (can) {
        if (e.burn <= 0 && fuel && fuelOf(fuel.id)) { e.burn = e.burnMax = fuelOf(fuel.id); fuel.n--; if (fuel.n <= 0) e.s[1] = null; }
        if (e.burn > 0) {
          e.cook += dt;
          if (e.cook >= SMELT_TIME) {
            e.cook = 0; inp.n--; if (inp.n <= 0) e.s[0] = null;
            if (out) out.n++; else e.s[2] = newStack(res[0], 1);
            e.xp += res[1];
            this.events.push({ t: "smelted" });
          }
        } else e.cook = Math.max(0, e.cook - 2 * dt);
      } else e.cook = Math.max(0, e.cook - 2 * dt);
    }
  };
}
