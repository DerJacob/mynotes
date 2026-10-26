// =====================================================================
// Blockdorf – Dörfer, Handel und Eisengolems (Etappe 13)
//   Berufe:     neun neue (Fischer, Pfeilmacher, Metzger, Schäfer, Maurer, Lederer, Waffen-, Werkzeug- und Rüstungsschmied) mit eigenen
//               Arbeitsblöcken und je fünf Stufen Angebote; ein dritter Händler-Satz für Bauer und Bibliothekar
//   Dorfleben:  Dorfbewohner haben Leben (20), fliehen vor Monstern, verstecken sich bei der Glocke und ziehen nach, wenn ein Dorf
//               leer wird. Zombies und Illager greifen sie an; stirbt einer durch einen Zombie, wird er zum Zombie-Dörfler
//   Heilung:    Wurftrank der Schwäche + Goldener Apfel verwandeln einen Zombie-Dörfler zurück – mit 20 % Rabatt für immer
//   Eisengolem: bewacht jedes Dorf (kommt von selbst wieder) oder wird aus vier Eisenblöcken und einem Kürbis gebaut (T-Form)
//   Glocke:     läuten lässt Monster im Umkreis leuchten und schickt die Dorfbewohner nach Hause
//   Belagerung: in manchen Nächten ziehen Zombies auf ein Dorf zu
//   Fahrender Händler mit zwei Lamas: kommt an manchen Tagen vorbei und handelt mit seltenen Waren
// Engine-Logik ohne Oberfläche (Node-testbar).
// =====================================================================
import { B, BLOCKS, ITEMS, isFluid } from "./sandbox-data.js?v=10";
import { MOBS, ADV } from "./sandbox-mobs.js?v=10";
import { PROFS, TRADES } from "./sandbox-vill.js?v=10";
import { UNDEAD } from "./sandbox-combat10.js?v=10";
import { EFFECT_NAMES } from "./sandbox-brew.js?v=10";

const E = "emerald";
const sgn = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

// ---------- Neue Berufe ----------
Object.assign(PROFS, {
  fisherman: { name: "Fischer", ws: B.BARREL, color: "#5a86a8", lines: ["Heute beißen sie wieder!", "Ein Fass voller Fisch – frisch gefangen.", "Am Wasser ist es am schönsten."] },
  fletcher: { name: "Pfeilmacher", ws: B.FLETCHING, color: "#6a7a4a", lines: ["Gerade Schäfte, scharfe Spitzen.", "Ein guter Pfeil trifft immer.", "Federn her – ich brauche Federn!"] },
  butcher: { name: "Metzger", ws: B.SMOKER, color: "#d8d4cc", lines: ["Frisch aus dem Räucherofen!", "Fleisch ist Kraft.", "Ein Stück Braten gefällig?"] },
  shepherd: { name: "Schäfer", ws: B.LOOM, color: "#c8b894", lines: ["Mäh – das war nicht ich.", "Weiche Wolle, warme Betten.", "Meine Schafe sind die besten."] },
  mason: { name: "Maurer", ws: B.STONECUTTER, color: "#8a8a84", lines: ["Stein auf Stein.", "Ein festes Haus steht ewig.", "Hast du Lehm für mich?"] },
  leatherworker: { name: "Lederer", ws: B.CAULDRON, color: "#7a5230", lines: ["Gutes Leder hält ein Leben lang.", "Gerben braucht Geduld.", "Ein Sattel? Aber gern!"] },
  weaponsmith: { name: "Waffenschmied", ws: B.GRINDSTONE, color: "#44464e", lines: ["Scharf wie am ersten Tag.", "Eine Klinge muss singen.", "Für Notfälle – und für Überfälle."] },
  toolsmith: { name: "Werkzeugschmied", ws: B.SMITHING, color: "#505a4e", lines: ["Spitzhacken für jedermann.", "Wer gräbt, braucht gutes Werkzeug.", "Ein Hammer, ein Amboss, ein Leben."] },
  armorer: { name: "Rüstungsschmied", ws: B.BLAST, color: "#3c4048", lines: ["Eisen schützt – Diamant noch mehr.", "Kein Hieb geht durch diese Platte.", "Probier den Helm mal an!"] },
  trader: { name: "Fahrender Händler", ws: null, color: "#2c3e8a", nolevel: true, lines: ["Seltenes aus aller Welt!", "Heute nur für dich.", "Morgen bin ich schon weiter."] }
});

/** Angebote: je Stufe zwei, wie bei den ersten fünf Berufen */
Object.assign(TRADES, {
  fisherman: [
    [{ a: ["raw_cod", 15], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], b: ["raw_cod", 6], out: ["cooked_cod", 6], max: 16, xp: 1 }],
    [{ a: ["raw_salmon", 13], out: [E, 1], max: 12, xp: 5 }, { a: [E, 1], out: ["campfire", 1], max: 12, xp: 5 }],
    [{ a: ["tropical_fish", 6], out: [E, 1], max: 12, xp: 10 }, { a: [E, 3], out: ["fishing_rod", 1], max: 12, xp: 10 }],
    [{ a: ["pufferfish", 4], out: [E, 1], max: 12, xp: 15 }, { a: [E, 2], out: ["bucket_cod", 1], max: 12, xp: 15 }],
    [{ a: ["ink_sac", 5], out: [E, 1], max: 12, xp: 30 }, { a: [E, 6], out: ["scute", 1], max: 6, xp: 30 }]
  ],
  fletcher: [
    [{ a: ["stick", 32], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], out: ["arrow", 16], max: 16, xp: 1 }],
    [{ a: ["flint", 26], out: [E, 1], max: 12, xp: 5 }, { a: [E, 2], out: ["bow", 1], max: 12, xp: 5 }],
    [{ a: ["string", 14], out: [E, 1], max: 12, xp: 10 }, { a: [E, 3], out: ["crossbow", 1], max: 12, xp: 10 }],
    [{ a: ["feather", 24], out: [E, 1], max: 12, xp: 15 }, { a: [E, 2], out: ["spectral_arrow", 5], max: 12, xp: 15 }],
    [{ a: ["gunpowder", 10], out: [E, 1], max: 12, xp: 30 }, { a: [E, 4], out: ["firework_rocket", 3], max: 12, xp: 30 }]
  ],
  butcher: [
    [{ a: ["coal", 15], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], out: ["raw_porkchop", 7], max: 16, xp: 1 }],
    [{ a: ["raw_porkchop", 7], out: [E, 1], max: 12, xp: 5 }, { a: ["raw_chicken", 4], out: [E, 1], max: 12, xp: 5 }],
    [{ a: ["raw_beef", 10], out: [E, 1], max: 12, xp: 10 }, { a: [E, 1], out: ["cooked_chicken", 8], max: 12, xp: 10 }],
    [{ a: ["raw_mutton", 7], out: [E, 1], max: 12, xp: 15 }, { a: [E, 1], out: ["cooked_porkchop", 5], max: 12, xp: 15 }],
    [{ a: ["sweet_berries", 10], out: [E, 1], max: 12, xp: 30 }, { a: [E, 2], out: ["steak", 6], max: 12, xp: 30 }]
  ],
  shepherd: [
    [{ a: ["wool", 18], out: [E, 1], max: 16, xp: 2 }, { a: [E, 2], out: ["shears", 1], max: 12, xp: 1 }],
    [{ a: ["dye_white", 12], out: [E, 1], max: 12, xp: 5 }, { a: [E, 1], out: ["wool", 4], max: 12, xp: 5 }],
    [{ a: ["dye_red", 12], out: [E, 1], max: 12, xp: 10 }, { a: [E, 3], out: ["bed", 1], max: 12, xp: 10 }],
    [{ a: ["dye_blue", 12], out: [E, 1], max: 12, xp: 15 }, { a: [E, 2], out: ["cushion_white", 3], max: 12, xp: 15 }],
    [{ a: ["dye_green", 12], out: [E, 1], max: 12, xp: 30 }, { a: [E, 3], out: ["banner_white", 1], max: 12, xp: 30 }]
  ],
  mason: [
    [{ a: ["clay", 10], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], out: ["brick", 10], max: 16, xp: 1 }],
    [{ a: ["stone", 20], out: [E, 1], max: 12, xp: 5 }, { a: [E, 1], out: ["polished_andesite", 4], max: 12, xp: 5 }],
    [{ a: ["diorite", 16], out: [E, 1], max: 12, xp: 10 }, { a: [E, 1], out: ["polished_granite", 4], max: 12, xp: 10 }],
    [{ a: ["andesite", 16], out: [E, 1], max: 12, xp: 15 }, { a: [E, 1], out: ["terracotta", 1], max: 12, xp: 15 }],
    [{ a: ["quartz", 12], out: [E, 1], max: 12, xp: 30 }, { a: [E, 1], out: ["quartz_block", 1], max: 12, xp: 30 }]
  ],
  leatherworker: [
    [{ a: ["leather", 6], out: [E, 1], max: 16, xp: 2 }, { a: [E, 3], out: ["leather_legs", 1], max: 12, xp: 1 }],
    [{ a: ["flint", 26], out: [E, 1], max: 12, xp: 5 }, { a: [E, 5], out: ["leather_chest", 1], max: 12, xp: 5 }],
    [{ a: ["leather", 9], out: [E, 1], max: 12, xp: 10 }, { a: [E, 4], out: ["leather_helmet", 1], max: 12, xp: 10 }],
    [{ a: ["scute", 4], out: [E, 1], max: 12, xp: 15 }, { a: [E, 6], out: ["saddle", 1], max: 6, xp: 15 }],
    [{ a: ["string", 20], out: [E, 1], max: 12, xp: 30 }, { a: [E, 6], out: ["turtle_helmet", 1], max: 6, xp: 30 }]
  ],
  weaponsmith: [
    [{ a: ["coal", 15], out: [E, 1], max: 16, xp: 2 }, { a: [E, 3], out: ["iron_axe", 1], max: 12, xp: 1 }],
    [{ a: ["iron_ingot", 4], out: [E, 1], max: 12, xp: 5 }, { a: [E, 7], out: ["iron_sword", 1], max: 12, xp: 5 }],
    [{ a: ["flint", 24], out: [E, 1], max: 12, xp: 10 }, { a: [E, 8], out: ["bell", 1], max: 6, xp: 10 }],
    [{ a: ["diamond", 1], out: [E, 4], max: 12, xp: 15 }, { a: [E, 17], out: ["diamond_axe", 1], max: 3, xp: 15 }],
    [{ a: ["gold_ingot", 3], out: [E, 1], max: 12, xp: 30 }, { a: [E, 20], out: ["diamond_sword", 1], max: 3, xp: 30 }]
  ],
  toolsmith: [
    [{ a: ["coal", 15], out: [E, 1], max: 16, xp: 2 }, { a: [E, 1], out: ["stone_axe", 1], max: 12, xp: 1 }],
    [{ a: ["iron_ingot", 4], out: [E, 1], max: 12, xp: 5 }, { a: [E, 1], out: ["stone_shovel", 1], max: 12, xp: 5 }],
    [{ a: ["flint", 30], out: [E, 1], max: 12, xp: 10 }, { a: [E, 6], out: ["iron_pick", 1], max: 12, xp: 10 }],
    [{ a: ["diamond", 1], out: [E, 4], max: 12, xp: 15 }, { a: [E, 5], out: ["iron_hoe", 1], max: 12, xp: 15 }],
    [{ a: [E, 12], out: ["diamond_pick", 1], max: 3, xp: 30 }, { a: [E, 13], out: ["diamond_shovel", 1], max: 3, xp: 30 }]
  ],
  armorer: [
    [{ a: ["coal", 15], out: [E, 1], max: 16, xp: 2 }, { a: [E, 5], out: ["iron_helmet", 1], max: 12, xp: 1 }],
    [{ a: ["iron_ingot", 4], out: [E, 1], max: 12, xp: 5 }, { a: [E, 7], out: ["iron_legs", 1], max: 12, xp: 5 }],
    [{ a: ["lava_bucket", 1], out: [E, 1], max: 12, xp: 10 }, { a: [E, 4], out: ["shield", 1], max: 12, xp: 10 }],
    [{ a: ["diamond", 1], out: [E, 4], max: 12, xp: 15 }, { a: [E, 18], out: ["diamond_legs", 1], max: 3, xp: 15 }],
    [{ a: [E, 13], out: ["diamond_helmet", 1], max: 3, xp: 30 }, { a: [E, 20], out: ["diamond_chest", 1], max: 3, xp: 30 }]
  ]
});
// ein dritter Handel für die ersten Berufe
const more = (prof, lvl, spec) => TRADES[prof][lvl - 1].push(spec);
more("farmer", 3, { a: [E, 1], out: ["baked_potato", 4], max: 12, xp: 10 });
more("farmer", 4, { a: [E, 2], out: ["honey_bottle", 3], max: 12, xp: 15 });
more("librarian", 1, { a: ["ink_sac", 5], out: [E, 1], max: 16, xp: 2 });
more("librarian", 4, { a: [E, 4], out: ["spyglass", 1], max: 6, xp: 15 });
more("cleric", 3, { a: ["glowstone_dust", 4], out: [E, 1], max: 12, xp: 10 });
more("cartographer", 4, { a: [E, 3], out: ["firework_rocket", 2], max: 12, xp: 15 });

/** Fahrender Händler: Vorrat an seltenen Waren, davon werden sechs ausgewählt */
const TRADER_POOL = [
  { a: [E, 2], out: ["sea_pickle", 2] }, { a: [E, 3], out: ["packed_ice", 1] }, { a: [E, 1], out: ["slimeball", 1] }, { a: [E, 2], out: ["moss_block", 2] },
  { a: [E, 3], out: ["pointed_dripstone", 2] }, { a: [E, 2], out: ["pink_petals", 2] }, { a: [E, 4], out: ["glowstone", 1] }, { a: [E, 5], out: ["nautilus_shell", 1] },
  { a: [E, 1], out: ["bamboo", 4] }, { a: [E, 2], out: ["sweet_berries", 6] }, { a: [E, 6], out: ["honeycomb", 2] }, { a: [E, 3], out: ["gunpowder", 2] },
  { a: [E, 5], out: ["torchflower_seeds", 1] }, { a: [E, 5], out: ["pitcher_pod", 1] }, { a: [E, 2], out: ["mangrove_propagule", 2] }, { a: [E, 4], out: ["azalea", 1] },
  { a: [E, 8], out: ["golden_apple", 1] }, { a: [E, 1], out: ["kelp", 4] }, { a: [E, 4], out: ["dried_kelp", 8] }, { a: [E, 7], out: ["saddle", 1] },
  { a: ["water_bucket", 1], out: [E, 2] }, { a: ["wheat", 16], out: [E, 2] }, { a: ["packed_ice", 2], out: [E, 2] }, { a: ["gold_ingot", 4], out: [E, 2] }
];

// ---------- Neue Tiere und Dorfmonster ----------
Object.assign(MOBS, {
  zombie_villager: { name: "Zombie-Dörfler", kind: "hostile", w: 0.7, h: 1.8, hp: 20, speed: 2.3, dmg: 3, range: 18, xp: [5, 5], drops: [["rotten_flesh", 0, 2, 1], ["iron_ingot", 1, 1, 0.025], ["carrot", 1, 1, 0.025], ["potato", 1, 1, 0.025]] },
  iron_golem: { name: "Eisengolem", kind: "neutral", w: 1.3, h: 2.7, hp: 100, speed: 2.1, dmg: 14, xp: [0, 0], drops: [["iron_ingot", 3, 5, 1], ["flower", 0, 2, 1]] },
  wandering_trader: { name: "Fahrender Händler", kind: "passive", w: 0.7, h: 1.8, hp: 20, speed: 1.3, xp: [0, 0], drops: [] }
});
MOBS.pillager.drops.push(["crossbow", 0, 1, 0.085]);
UNDEAD.add("zombie_villager");
Object.assign(ADV, {
  bell: ["Glockenläuter", "Läute eine Glocke."],
  golem: ["Hallo, Eisenmann", "Baue einen Eisengolem aus vier Eisenblöcken und einem Kürbis."],
  cure: ["Doktor Dörfler", "Heile einen Zombie-Dörfler mit Schwäche-Wurftrank und Goldenem Apfel."],
  totem: ["Zweite Chance", "Lass dich von einem Totem der Unsterblichkeit retten."],
  wanderer: ["Wanderlust", "Handle mit einem Fahrenden Händler."],
  siege: ["Nachtwache", "Überstehe eine Zombie-Belagerung, ohne dass ein Dorfbewohner stirbt."]
});

/** Mobs, die Dorfbewohner angreifen (Nahkämpfer) und vor denen Dorfbewohner fliehen */
const VILL_ATK = new Set(["zombie", "zombie_villager", "husk", "vindicator", "illager_captain", "ravager"]);
const THREATS = new Set(["zombie", "zombie_villager", "husk", "vindicator", "illager_captain", "ravager", "pillager", "evoker", "vex", "witch", "creeper"]);
const touching = (a, b, pad = 0.1) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

export function installVillagers13(Sandbox, K) {
  const { clamp, W, H } = K;
  const P = Sandbox.prototype;
  const cxOf = m => m.x + m.w / 2;
  const stk = (id, n = 1) => ({ id, n, d: 0 });

  // ---------- Mob-Start ----------
  const prevInit = P._mobInitNew;
  P._mobInitNew = function (m, type) {
    prevInit.call(this, m, type);
    switch (type) {
      case "iron_golem": m.atkT = 0; m.swing = 0; m.angT = 0; m.home = Math.floor(cxOf(m)); break;
      case "wandering_trader": m.life = 420; m.home = Math.floor(cxOf(m)); m.prof = "trader"; m.lvl = 5; m.xp = 0; m.locked = true; m.offers = []; break;
      case "zombie_villager": m.curing = 0; m.weakT = 0; m.vill = null; break;
    }
  };

  // ---------- Schaden an Dorfbewohnern ----------
  P._villagerHurt = function (v, dmg, dir, src) {
    if (dmg <= 0 || !this.villagers.includes(v)) return false;
    v.hp -= dmg; v.hurtT = 0.4;
    v.vy = -4; v.onGround = false;
    v.fleeT = 3; v.fleeDir = dir ? -dir : -(v.face || 1);
    this.events.push({ t: "hit", x: cxOf(v), y: v.y, n: Math.round(dmg), src });
    if (v.hp <= 0) { this._villagerDie(v, src); return true; }
    return false;
  };
  P._villagerDie = function (v, src) {
    const i = this.villagers.indexOf(v); if (i < 0) return;
    this.villagers.splice(i, 1);
    if (this.win && this.win.v === v) this.closeWindow();
    this.events.push({ t: "villager_died", x: cxOf(v), y: v.y });
    if (src === "zombie" || src === "zombie_villager" || src === "husk") {
      const z = this.spawnMob("zombie_villager", v.x, v.y + v.h, {});
      if (this._hit(z)) z.y -= 0.6;
      z.vill = v;
      z.face = v.face; this.events.push({ t: "zombified", x: cxOf(v), y: v.y });
    }
    if (this._sgLost !== undefined) this._sgLost = true;                       // die Belagerung kostete ein Leben
  };
  /** Nächster Dorfbewohner in Reichweite r (Spalten) und ±3 Zeilen */
  P._nearestVillager = function (m, r) {
    let best = null, bd = r;
    for (const v of this.villagers) {
      const d = Math.abs(cxOf(v) - cxOf(m));
      if (d < bd && Math.abs(v.y - m.y) < 3.2) { best = v; bd = d; }
    }
    return best;
  };

  // ---------- Dorfbewohner: Flucht und Verstecken ----------
  P._villScan = function (v) {
    let best = null, bd = 9;
    for (const m of this.mobs) {
      if (m.dead || !THREATS.has(m.type)) continue;
      const d = Math.abs(cxOf(m) - cxOf(v));
      if (d < bd && Math.abs(m.y - v.y) < 4 && (m.type !== "creeper" || d < 5)) { best = m; bd = d; }
    }
    if (best) {
      const away = -sgn(cxOf(best) - cxOf(v)) || 1;
      v.fleeT = 2.5; v.fleeDir = away; v.hide = false;
      if (v.sayT <= 0 && this.mrng() < 0.3) { v.say = this.mrng() < 0.5 ? "Hilfe!" : "Ein Monster!"; v.sayT = 2.5; }
    }
  };
  const prevVillager = P._villager;
  P._villager = function (v, dt) {
    v.hurtT = Math.max(0, (v.hurtT || 0) - dt);
    v.scT = (v.scT || 0) - dt;
    if (v.scT <= 0) { v.scT = 0.5; this._villScan(v); }
    if (v.fleeT > 0) {
      v.fleeT -= dt; v.sayT = Math.max(0, v.sayT - dt); v.cool -= dt; v.jobT -= dt;
      let dir = v.fleeDir || 1;
      if (v.hide) { const dh = v.home - cxOf(v); dir = Math.abs(dh) > 1.5 ? sgn(dh) : 0; }
      v.dir = dir; if (dir) v.face = dir;
      v.vx = dir * (v.hide ? 2.4 : 2.3); v.t = 0.6;
      this._body(v, dt);
      return;
    }
    v.hide = false;
    prevVillager.call(this, v, dt);
  };

  // ---------- Angriffe auf Dorfbewohner / Eisengolem / Zombie-Dörfler ----------
  const prevAi = P._aiNew;
  P._aiNew = function (m, d, dt, dx, dy, dist) {
    if (m.glowT > 0) m.glowT -= dt;
    switch (m.type) {
      case "iron_golem": this._aiGolem(m, d, dt, dx, dy, dist); return 1;
      case "zombie_villager": {
        if (m.weakT > 0) m.weakT -= dt;
        if (m.curing > 0) {
          m.curing -= dt; this._steer(m, 0, 0, dt);
          if (m.curing <= 0) this._cureDone(m);
          return 1;
        }
        if (this._villagerFight(m, d, dt, dist)) return 1;
        this._aiMelee(m, d, dt, dx, dy, dist, 11);
        return 1;
      }
      case "wandering_trader": {
        const hx = m.home - cxOf(m);
        if (Math.abs(hx) > 16 && !(m.panic > 0)) { this._steer(m, sgn(hx), d.speed, dt); return 1; }
        break;
      }
      case "llama": if (m.trader && this._aiTraderLlama(m, d, dt)) return 1; break;
    }
    if (VILL_ATK.has(m.type) && this._villagerFight(m, d, dt, dist)) return 1;
    return prevAi.call(this, m, d, dt, dx, dy, dist);
  };
  /** Nahkämpfer verfolgen einen Dorfbewohner, wenn er näher ist als der Spieler. true = beschäftigt */
  P._villagerFight = function (m, d, dt, dist) {
    const v = this._nearestVillager(m, 10);
    if (!v) return false;
    const dv = Math.hypot(cxOf(v) - cxOf(m), v.y + v.h / 2 - (m.y + m.h * 0.4));
    if (dist < dv && dist < 8) return false;
    const dir = sgn(cxOf(v) - cxOf(m));
    this._steer(m, Math.abs(cxOf(v) - cxOf(m)) > 0.4 ? dir : 0, d.speed, dt, 11);
    if (m.atkCd <= 0 && touching(m, v, 0.15)) {
      m.atkCd = 1.0;
      this._villagerHurt(v, Math.max(2, d.dmg || 3), dir, m.type);
    }
    return true;
  };

  // ---------- Eisengolem ----------
  P._aiGolem = function (m, d, dt, dx, dy, dist) {
    const p = this.player, cx = cxOf(m);
    m.atkT -= dt; m.swing = Math.max(0, m.swing - dt);
    if (m.angT > 0) { m.angT -= dt; if (dist > 24) m.angT = 0; }
    let tgt = null, bd = 15;
    if (m.angT > 0 && dist < 18) tgt = p;
    else for (const o of this.mobs) {
      if (o === m || o.dead || o.kind !== "hostile") continue;
      const dd = Math.abs(cxOf(o) - cx);
      if (dd < bd && Math.abs(o.y - m.y) < 5) { tgt = o; bd = dd; }
    }
    if (!tgt) {
      const hx = m.home - cx;
      if (Math.abs(hx) > 18) this._steer(m, sgn(hx), d.speed * 0.8, dt, 11);
      else this._wander(m, d, dt, 0.5);
      return;
    }
    const tcx = tgt === p ? p.x + p.w / 2 : cxOf(tgt), tdx = tcx - cx;
    m.face = sgn(tdx) || m.face;
    if (Math.abs(tdx) > 1.6) this._steer(m, sgn(tdx), d.speed, dt, 12);
    else this._steer(m, 0, 0, dt);
    const tty = tgt === p ? p.y : tgt.y, th = tgt === p ? p.h : tgt.h;
    if (Math.abs(tdx) < 2.3 && Math.abs((tty + th / 2) - (m.y + m.h * 0.45)) < 2.4 && m.atkT <= 0) {
      m.atkT = 1.3; m.swing = 0.45;
      if (tgt === p) this.hurt(8, sgn(tdx) || 1, "mob");
      else {
        this._mobHurt(tgt, 14 + Math.floor(this.mrng() * 7), sgn(tdx) || 1, "golem");
        if (!tgt.dead) { tgt.vy = -9; tgt.onGround = false; }
      }
      this.events.push({ t: "golem_hit", x: cx, y: m.y });
    }
    // der Gegner schlägt zurück
    if (tgt !== p && !tgt.dead && Math.abs(tdx) < 2 && (tgt.gHit = (tgt.gHit || 0) - dt) <= 0) {
      tgt.gHit = 1.2;
      const dm = MOBS[tgt.type] || {};
      if (dm.dmg) this._mobHurt(m, Math.max(1, Math.round(dm.dmg * 0.7)), 0, "mob");
    }
  };
  const prevHurtMod = P._mobHurtMod;
  P._mobHurtMod = function (m, dmg, dir, src) {
    if (m.type === "iron_golem" && (src === "player" || src === "arrow")) m.angT = 12;
    if (m.type === "wandering_trader") m.life = Math.min(m.life, 120);
    return prevHurtMod.call(this, m, dmg, dir, src);
  };
  /** T-Form aus vier Eisenblöcken, Kürbis oben: wird zum Golem */
  P._tryGolem = function (tx, ty) {
    const I = B.IRON_BLOCK;
    if (this.tile(tx, ty) !== B.PUMPKIN) return false;
    if (this.tile(tx, ty + 1) !== I || this.tile(tx - 1, ty + 1) !== I || this.tile(tx + 1, ty + 1) !== I || this.tile(tx, ty + 2) !== I) return false;
    for (const [x, y] of [[tx, ty], [tx, ty + 1], [tx - 1, ty + 1], [tx + 1, ty + 1], [tx, ty + 2]]) this.setTile(x, y, B.AIR);
    const g = this.spawnMob("iron_golem", tx + 0.5 - MOBS.iron_golem.w / 2, ty + 3, { pc: true });
    if (this._hit(g)) g.y -= 0.9;
    g.home = tx;
    this.events.push({ t: "golem", x: tx + 0.5, y: ty + 1 });
    this.grant("golem");
    return true;
  };
  const basePlace = P.place;
  P.place = function (tx, ty) {
    const ok = basePlace.call(this, tx, ty);
    if (ok && this.tile(tx, ty) === B.PUMPKIN) this._tryGolem(tx, ty);
    return ok;
  };
  /** Jedes Dorf mit Dorfbewohnern bekommt (wieder) einen Golem, wenn keiner in der Nähe ist */
  P._golemTick = function () {
    this._gT = (this._gT || 0) + 1;
    if (this._gT % 5) return;
    const px = this.player.x + this.player.w / 2;
    this._gCool = this._gCool || {};
    for (const v of this.villages || []) {
      if (Math.abs(v.x - px) > 70) continue;
      const c = this._gCool[v.x] = (this._gCool[v.x] || 0) - 5;
      if (c > 0) continue;
      if (this.villagers.filter(q => Math.abs(q.x - v.x) < 30).length < 2) continue;
      if (this.mobs.some(m => m.type === "iron_golem" && Math.abs(cxOf(m) - v.x) < 36)) continue;
      const x = Math.floor(v.x + 4 + this.mrng() * 8);
      const g = this.spawnMob("iron_golem", x + 0.5 - MOBS.iron_golem.w / 2, v.y, {});
      if (this._hit(g)) { this._remove(g); this._gCool[v.x] = 20; continue; }
      g.home = v.x;
      this._gCool[v.x] = 150;
    }
  };

  // ---------- Zombie-Dörfler heilen ----------
  const prevApplyMob = P._applyPotionToMob;
  P._applyPotionToMob = function (m, kind, mod, scale) {
    if (kind === "weakness") { m.weakT = Math.max(m.weakT || 0, (mod === 1 ? 480 : mod === 0 ? 180 : 90) * Math.max(0.25, scale)); return; }
    return prevApplyMob.call(this, m, kind, mod, scale);
  };
  const prevMobUse = P._mobUseNew;
  P._mobUseNew = function (m, s) {
    if (m.type === "zombie_villager" && s && s.id === "golden_apple" && m.weakT > 0 && !(m.curing > 0)) {
      this._consumeSel(); m.curing = 20; m.angry = false;
      this.events.push({ t: "cure_start", x: cxOf(m), y: m.y });
      return true;
    }
    if (m.type === "wandering_trader") {
      if (!m.offers.length) this._traderStock(m);
      m.face = sgn(this.player.x - m.x) || m.face;
      this.openWindow("trade", Math.floor(cxOf(m)), Math.floor(m.y));
      this.win.v = m;
      this.grant("wanderer");
      return true;
    }
    return prevMobUse.call(this, m, s);
  };
  P._cureDone = function (m) {
    const src = m.vill;
    const v = src || this._newVillager(cxOf(m) - 0.35, m.y + m.h - 1.7 - 0.001, cxOf(m), Math.floor(this.mrng() * 6));
    v.x = cxOf(m) - v.w / 2; v.y = m.y + m.h - v.h - 0.001; v.vx = v.vy = 0;
    v.hp = 20; v.cured = true; v.fleeT = 0; v.say = "Ich fühle mich so viel besser!"; v.sayT = 4;
    if (v.home === undefined || !Number.isFinite(v.home)) v.home = cxOf(m);
    this._remove(m);
    this.villagers.push(v);
    this.events.push({ t: "cure", x: cxOf(v), y: v.y });
    this.grant("cure");
  };
  const prevOfferCost = P.offerCost;
  P.offerCost = function (pair) {
    const c = prevOfferCost.call(this, pair);
    const w = this.win, v = w && w.kind === "trade" && w.v;
    if (c && v && v.cured && c[0] === E) return [E, Math.max(1, Math.round(c[1] * 0.8))];
    return c;
  };
  // Goldener Apfel: auch bei vollem Hunger essbar, kurze Regeneration
  const baseEat = P.eat;
  P.eat = function () {
    const s = this.selStack();
    if (s && s.id === "golden_apple") {
      if (this.eatCd > 0) return false;
      this.food = Math.min(20, this.food + ITEMS.golden_apple.food[0]);
      this.sat = Math.min(this.food, this.sat + ITEMS.golden_apple.food[1]);
      this._consumeSel(); this.eatCd = 0.5;
      this.addEffect("regen", 6, 1);
      this.events.push({ t: "eat", item: "golden_apple" });
      return true;
    }
    return baseEat.call(this);
  };
  const baseUseItem = P.use;
  P.use = function (tx, ty) {
    if (!this.win && this.tile(tx, ty) === B.BELL && this.reachOk(tx, ty) && !this.villagerAtTile(tx, ty)) return this.ringBell(tx, ty);
    const s = this.selStack();
    if (!this.win && s && s.id === "golden_apple" && !this.mobAtTile(tx, ty)) return this.eat();
    return baseUseItem.call(this, tx, ty);
  };

  // ---------- Glocke ----------
  P.ringBell = function (tx, ty) {
    if (this._bellCd > 0) return false;
    this._bellCd = 0.8;
    this.events.push({ t: "bell", x: tx + 0.5, y: ty + 0.5 });
    this.grant("bell");
    let glow = 0;
    for (const m of this.mobs) if (m.kind === "hostile" && Math.abs(cxOf(m) - tx) < 48 && Math.abs(m.y - ty) < 30) { m.glowT = 4.5; glow++; }
    for (const v of this.villagers) {
      if (Math.abs(cxOf(v) - tx) > 32) continue;
      const danger = glow > 0 || this.raid;
      if (danger) { v.fleeT = 8; v.hide = true; v.say = "Alle in Deckung!"; v.sayT = 3; }
      else { v.say = "Ding-Dong!"; v.sayT = 2; }
    }
    return true;
  };
  P._bellNear = function (x) {
    const x0 = Math.floor(x);
    for (const v of this.villages || []) {
      if (Math.abs(v.x - x0) > 30) continue;
      for (let dx = -26; dx <= 26; dx++) for (let dy = -3; dy <= 1; dy++) if (this.tile(v.x + dx, v.y + dy) === B.BELL) return { x: v.x + dx, y: v.y + dy };
    }
    return null;
  };

  // ---------- Belagerung, Golem, Nachzug (pro Sekunde) ----------
  const prevTick = P._villTick;
  P._villTick = function () {
    prevTick.call(this);
    if (this.dim) return;
    this._golemTick();
    this._siegeTick();
    this._traderTick();
  };
  P._siegeTick = function () {
    const night = this.dayFactor() < 0.2, p = this.player, px = p.x + p.w / 2;
    const key = this.time > 0.5 ? this.day : this.day - 1;
    this._sgDone = this._sgDone || new Map();
    const sg = this._siege;
    if (sg) {
      sg.t--;
      const alive = sg.foes.filter(m => !m.dead && this.mobs.includes(m)).length;
      if (!alive || sg.t <= 0 || !night) {
        if (!alive && !this._sgLost) this.grant("siege");
        this._siege = null; this._sgLost = undefined;
      }
      return;
    }
    if (!night || this.raid) return;
    for (const v of this.villages || []) {
      if (Math.abs(v.x - px) > 55 || this._sgDone.get(v.x) === key) continue;
      this._sgDone.set(v.x, key);
      const near = this.villagers.filter(q => Math.abs(q.x - v.x) < 30).length;
      if (near < 2 || this.mrng() > 0.35) continue;
      const foes = [], n = 3 + Math.floor(this.mrng() * 3);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1, x = clamp(Math.floor(v.x + side * (27 + this.mrng() * 7)), 3, W - 4);
        const yy = this._findSpawnY(x, Math.max(3, v.y - 10), Math.min(H - 6, v.y + 8), 2);
        const m = this.spawnMob("zombie", x + 0.5 - MOBS.zombie.w / 2, yy >= 0 ? yy : v.y, { siege: true });
        if (this._hit(m)) { this._remove(m); continue; }
        foes.push(m);
      }
      if (foes.length) {
        this._siege = { vx: v.x, foes, t: 150, n: near };
        this._sgLost = false;
        this.events.push({ t: "siege", x: v.x });
        for (const q of this.villagers) if (Math.abs(q.x - v.x) < 30) { q.say = "Zombies! Sie kommen!"; q.sayT = 4; }
      }
      break;
    }
  };
  const prevMobs = P._mobs;
  P._mobs = function (dt) {
    const d0 = this._lastDay;
    if (this._bellCd > 0) this._bellCd -= dt;
    prevMobs.call(this, dt);
    if (d0 && this._lastDay !== d0) this._dayChange13();
  };
  P._dayChange13 = function () {
    const px = this.player.x + this.player.w / 2;
    // verwaiste Dörfer bekommen Nachwuchs (ein Dorfbewohner pro Tag)
    for (const v of this.villages || []) {
      if (Math.abs(v.x - px) > 90) continue;
      const n = this.villagers.filter(q => Math.abs(q.x - v.x) < 30).length;
      if (n >= 3) continue;
      const nv = this._newVillager(v.x + 1.6, v.y - 1.7 - 0.001, v.x + 3, Math.floor(this.mrng() * 6));
      if (this.villagers.length < 400) this.villagers.push(nv);
    }
    // Fahrender Händler
    if (!this.mobs.some(m => m.type === "wandering_trader")) {
      this._tCh = this._tCh || 0.25;
      if (this.mrng() < this._tCh) { this._tPend = true; this._tCh = 0.25; } else this._tCh = Math.min(0.75, this._tCh + 0.1);
    }
  };

  // ---------- Fahrender Händler ----------
  P._traderStock = function (m) {
    const pool = TRADER_POOL.map((t, i) => [this.mrng(), i]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(([, i]) => TRADER_POOL[i]);
    m.offers = pool.filter(t => ITEMS[t.out[0]] && ITEMS[t.a[0]]).map(t => ({
      a: [t.a[0], t.a[1]], b: null, out: { id: t.out[0], n: t.out[1], d: 0 }, max: t.a[0] === E ? 4 + Math.floor(this.mrng() * 5) : 6, uses: 0, xp: 0
    }));
  };
  P._traderSpawn = function () {
    const p = this.player, px = p.x + p.w / 2;
    for (let k = 0; k < 12; k++) {
      const side = this.mrng() < 0.5 ? -1 : 1, x = clamp(Math.floor(px + side * (22 + this.mrng() * 18)), 4, W - 5), g = this.ground[x], t = this.tile(x, g);
      const above = this.tile(x, g - 1);
      if (!BLOCKS[t].solid || isFluid(t) || isFluid(above) || BLOCKS[above].solid || g > 140) continue;
      const tr = this.spawnMob("wandering_trader", x + 0.5 - MOBS.wandering_trader.w / 2, g, {});
      if (this._hit(tr)) { this._remove(tr); continue; }
      this._traderStock(tr);
      for (const dx of [-2, 2]) {
        const lx = clamp(x + dx, 3, W - 4), lg = this.ground[lx];
        if (Math.abs(lg - g) > 1) continue;
        const l = this.spawnMob("llama", lx + 0.5 - MOBS.llama.w / 2, lg, { trader: true, var: Math.floor(this.mrng() * 4) });
        if (this._hit(l)) this._remove(l);
      }
      this.events.push({ t: "trader", x, y: g });
      return true;
    }
    return false;
  };
  P._traderTick = function () {
    const tr = this.mobs.find(m => m.type === "wandering_trader");
    const px = this.player.x + this.player.w / 2;
    if (tr) {
      tr.life -= 1;
      const away = Math.abs(cxOf(tr) - px) > 90;
      if ((tr.life <= 0 || away) && !(this.win && this.win.v === tr)) this._traderLeave(tr);
      return;
    }
    if (this._tPend && this.dayFactor() > 0.55) { this._tPend = false; this._traderSpawn(); }
  };
  P._traderLeave = function (tr) {
    this.events.push({ t: "tp", x: tr.x, y: tr.y });
    this._remove(tr);
    for (const l of [...this.mobs]) if (l.type === "llama" && l.trader && Math.abs(cxOf(l) - cxOf(tr)) < 24) this._remove(l);
  };
  P._aiTraderLlama = function (m, d, dt) {
    if (m.angT > 0 || m.panic > 0) return false;
    let tr = m.tr && !m.tr.dead && this.mobs.includes(m.tr) ? m.tr : null;
    if (!tr) {
      let bd = 40;
      for (const o of this.mobs) if (o.type === "wandering_trader" && Math.abs(cxOf(o) - cxOf(m)) < bd) { tr = o; bd = Math.abs(cxOf(o) - cxOf(m)); }
      m.tr = tr;
    }
    if (!tr) { m.trader = false; return false; }
    const dx = cxOf(tr) - cxOf(m);
    if (Math.abs(dx) > 3.4) this._steer(m, sgn(dx), d.speed * 1.5, dt, 11); else this._steer(m, 0, 0, dt);
    return true;
  };

  // ---------- Speichern ----------
  const prevSaveX = P._mobSaveX;
  P._mobSaveX = function (m, o) {
    if (prevSaveX) prevSaveX.call(this, m, o);
    const z = {};
    switch (m.type) {
      case "iron_golem": if (m.pc) z.pc = 1; if (Number.isFinite(m.home)) z.hm = Math.round(m.home); break;
      case "wandering_trader":
        z.lf = Math.round(m.life); z.hm = Math.round(m.home);
        z.of = m.offers.map(of => ({ a: of.a, out: this._packStack(of.out), max: of.max, uses: of.uses }));
        break;
      case "llama": if (m.trader) z.tl = 1; break;
      case "zombie_villager":
        if (m.weakT > 0) z.wk = Math.round(m.weakT);
        if (m.curing > 0) z.cr = +m.curing.toFixed(1);
        if (m.vill) z.vl = this._villPack(m.vill);
        break;
    }
    if (Object.keys(z).length) o.z13 = z;
  };
  const prevLoadX = P._mobLoadX;
  P._mobLoadX = function (m, o) {
    if (prevLoadX) prevLoadX.call(this, m, o);
    const z = o.z13 && typeof o.z13 === "object" ? o.z13 : null;
    if (!z) return;
    switch (m.type) {
      case "iron_golem": if (z.pc) m.pc = true; if (Number.isFinite(z.hm)) m.home = z.hm; break;
      case "wandering_trader": {
        if (Number.isFinite(z.lf)) m.life = clamp(z.lf, 1, 600);
        if (Number.isFinite(z.hm)) m.home = z.hm;
        m.offers = [];
        for (const r of Array.isArray(z.of) ? z.of : []) {
          const out = this._unpackStack(r && r.out);
          if (!out || !ITEMS[out.id] || !Array.isArray(r.a) || !ITEMS[r.a[0]]) continue;
          m.offers.push({ a: [r.a[0], clamp(r.a[1] | 0, 1, 64)], b: null, out, max: clamp(r.max | 0, 1, 64), uses: clamp(r.uses | 0, 0, 64), xp: 0 });
        }
        break;
      }
      case "llama": if (z.tl) m.trader = true; break;
      case "zombie_villager":
        if (Number.isFinite(z.wk)) m.weakT = clamp(z.wk, 0, 600);
        if (Number.isFinite(z.cr)) m.curing = clamp(z.cr, 0, 30);
        if (z.vl) m.vill = this._villUnpack(z.vl);
        break;
    }
  };
  void stk; void EFFECT_NAMES;
}
