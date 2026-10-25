// =====================================================================
// Blockdorf – Daten: Blöcke, Gegenstände, Rezepte (ohne Logik, damit man sie leicht erweitern kann)
// Die Zahlen orientieren sich an Minecraft (Haltbarkeit, Schaden, Abbauzeiten, Rüstungspunkte).
// =====================================================================

// Block-IDs: 0–17 stehen in alten Spielständen, deshalb nie umnummerieren – nur hinten anhängen.
export const B = {
  AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, PLANKS: 7, COAL: 8, IRON: 9, GOLD: 10, TORCH: 11, BENCH: 12,
  GLASS: 13, BRICK: 14, BEDROCK: 15, FLOWER: 16, TALLGRASS: 17,
  COBBLE: 18, DIAMOND: 19, FURNACE: 20, CHEST: 21, DOOR_B: 22, DOOR_T: 23, DOOR_BO: 24, DOOR_TO: 25, LADDER: 26,
  // Etappe 2
  GRAVEL: 27, SNOW: 28, GRASS_SNOW: 29, SANDSTONE: 30, CACTUS: 31, DEADBUSH: 32,
  BIRCH_LOG: 33, BIRCH_LEAVES: 34, SPRUCE_LOG: 35, SPRUCE_LEAVES: 36, JUNGLE_LOG: 37, JUNGLE_LEAVES: 38, ACACIA_LOG: 39, ACACIA_LEAVES: 40,
  WATER: 41, LAVA: 42, DEEPSLATE: 43, COPPER: 44, REDSTONE: 45, LAPIS: 46, EMERALD: 47, OBSIDIAN: 48, ICE: 49, CLAY: 50
};
export const LOGS = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.JUNGLE_LOG, B.ACACIA_LOG];
export const LEAVES = [B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.JUNGLE_LEAVES, B.ACACIA_LEAVES];
export const isLog = id => id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.JUNGLE_LOG || id === B.ACACIA_LOG;
export const isLeaves = id => id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.JUNGLE_LEAVES || id === B.ACACIA_LEAVES;
export const isFluid = id => id === B.WATER || id === B.LAVA;
/** Pflanzen, die einen festen Boden brauchen */
export const isPlant = id => id === B.FLOWER || id === B.TALLGRASS || id === B.DEADBUSH;

const def = (key, o) => ({ key, fluid: false, dropN: null, solid: false, lcost: 0, hard: 0.75, tier: 0, tool: null, drop: null, emit: 0, climb: false, ...o });
/**
 * solid  = Körper stoßen dagegen · lcost = wie stark der Block Licht schluckt · hard = Sekunden mit der Hand (wie Minecraft: Härte × 1,5)
 * tool   = Werkzeugart, die schneller abbaut · tier = Mindeststufe des Werkzeugs, damit der Block etwas fallen lässt
 */
export const BLOCKS = [];
BLOCKS[B.AIR] = def("air", { hard: 0 });
BLOCKS[B.DIRT] = def("dirt", { solid: true, lcost: 3, hard: 0.75, tool: "shovel", drop: "dirt" });
BLOCKS[B.GRASS] = def("grass", { solid: true, lcost: 3, hard: 0.9, tool: "shovel", drop: "dirt" });
BLOCKS[B.STONE] = def("stone", { solid: true, lcost: 3, hard: 2.25, tool: "pick", tier: 1, drop: "cobble" });
BLOCKS[B.SAND] = def("sand", { solid: true, lcost: 3, hard: 0.75, tool: "shovel", drop: "sand" });
BLOCKS[B.LOG] = def("log", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: "log" });
BLOCKS[B.LEAVES] = def("leaves", { lcost: 1, hard: 0.3, drop: null });
BLOCKS[B.PLANKS] = def("planks", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: "planks" });
BLOCKS[B.COAL] = def("coal", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 1, drop: "coal" });
BLOCKS[B.IRON] = def("iron", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 2, drop: "raw_iron" });
BLOCKS[B.GOLD] = def("gold", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 3, drop: "raw_gold" });
BLOCKS[B.TORCH] = def("torch", { hard: 0.05, drop: "torch", emit: 13 });
BLOCKS[B.BENCH] = def("bench", { hard: 3.75, tool: "axe", drop: "bench", interact: true });
BLOCKS[B.GLASS] = def("glass", { solid: true, lcost: 0, hard: 0.45, drop: null });
BLOCKS[B.BRICK] = def("brick", { solid: true, lcost: 3, hard: 3, tool: "pick", tier: 1, drop: "brick" });
BLOCKS[B.BEDROCK] = def("bedrock", { solid: true, lcost: 3, hard: Infinity });
BLOCKS[B.FLOWER] = def("flower", { hard: 0.05, drop: "flower" });
BLOCKS[B.TALLGRASS] = def("tallgrass", { hard: 0.05 });
BLOCKS[B.COBBLE] = def("cobble", { solid: true, lcost: 3, hard: 3, tool: "pick", tier: 1, drop: "cobble" });
BLOCKS[B.DIAMOND] = def("diamond", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 3, drop: "diamond" });
BLOCKS[B.FURNACE] = def("furnace", { solid: true, lcost: 3, hard: 5.25, tool: "pick", tier: 1, drop: "furnace", interact: true, entity: "furnace" });
BLOCKS[B.CHEST] = def("chest", { solid: true, lcost: 0, hard: 3.75, tool: "axe", drop: "chest", interact: true, entity: "chest" });
BLOCKS[B.DOOR_B] = def("door_b", { solid: true, lcost: 3, hard: 4.5, tool: "axe", drop: "door", interact: true });
BLOCKS[B.DOOR_T] = def("door_t", { solid: true, lcost: 3, hard: 4.5, tool: "axe", drop: null, interact: true });
BLOCKS[B.DOOR_BO] = def("door_bo", { hard: 4.5, tool: "axe", drop: "door", interact: true });
BLOCKS[B.DOOR_TO] = def("door_to", { hard: 4.5, tool: "axe", drop: null, interact: true });
BLOCKS[B.LADDER] = def("ladder", { hard: 0.6, tool: "axe", drop: "ladder", climb: true });

BLOCKS[B.GRAVEL] = def("gravel", { solid: true, lcost: 3, hard: 0.9, tool: "shovel", drop: "gravel" });
BLOCKS[B.SNOW] = def("snow", { solid: true, lcost: 3, hard: 0.3, tool: "shovel", tier: 0, drop: "snow" });
BLOCKS[B.GRASS_SNOW] = def("grass_snow", { solid: true, lcost: 3, hard: 0.9, tool: "shovel", drop: "dirt" });
BLOCKS[B.SANDSTONE] = def("sandstone", { solid: true, lcost: 3, hard: 1.2, tool: "pick", tier: 1, drop: "sandstone" });
BLOCKS[B.CACTUS] = def("cactus", { solid: true, lcost: 0, hard: 0.6, drop: "cactus" });
BLOCKS[B.DEADBUSH] = def("deadbush", { hard: 0.05, drop: "stick" });
for (const [lg, lv, name] of [[B.BIRCH_LOG, B.BIRCH_LEAVES, "birch"], [B.SPRUCE_LOG, B.SPRUCE_LEAVES, "spruce"], [B.JUNGLE_LOG, B.JUNGLE_LEAVES, "jungle"], [B.ACACIA_LOG, B.ACACIA_LEAVES, "acacia"]]) {
  BLOCKS[lg] = def(name + "_log", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: name + "_log" });
  BLOCKS[lv] = def(name + "_leaves", { lcost: 1, hard: 0.3, drop: null });
}
BLOCKS[B.WATER] = def("water", { fluid: true, lcost: 1, hard: Infinity });
BLOCKS[B.LAVA] = def("lava", { fluid: true, lcost: 0, hard: Infinity, emit: 15 });
BLOCKS[B.DEEPSLATE] = def("deepslate", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 1, drop: "cobble" });
BLOCKS[B.COPPER] = def("copper", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 2, drop: "raw_copper", dropN: [2, 3] });
BLOCKS[B.REDSTONE] = def("redstone", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 3, drop: "redstone", dropN: [4, 5], emit: 5 });
BLOCKS[B.LAPIS] = def("lapis", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 2, drop: "lapis", dropN: [4, 8] });
BLOCKS[B.EMERALD] = def("emerald", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 3, drop: "emerald" });
BLOCKS[B.OBSIDIAN] = def("obsidian", { solid: true, lcost: 3, hard: 75, tool: "pick", tier: 4, drop: "obsidian" });
BLOCKS[B.ICE] = def("ice", { solid: true, lcost: 0, hard: 0.75, tool: "pick", drop: null });
BLOCKS[B.CLAY] = def("clay", { solid: true, lcost: 3, hard: 0.9, tool: "shovel", drop: "clay" });

// ---------------------------------------------------------------------
// Gegenstände
// ---------------------------------------------------------------------
export const ITEMS = {};
const item = (id, name, o = {}) => { ITEMS[id] = { id, name, stack: 64, ...o }; };
const blockItem = (id, name, block, o = {}) => item(id, name, { block, ...o });

blockItem("dirt", "Erde", B.DIRT); blockItem("stone", "Stein", B.STONE); blockItem("cobble", "Bruchstein", B.COBBLE);
blockItem("sand", "Sand", B.SAND); blockItem("log", "Eichenholz", B.LOG, { fuel: 15, tags: ["logs"] });
blockItem("leaves", "Laub", B.LEAVES);
blockItem("planks", "Bretter", B.PLANKS, { tags: ["planks"], fuel: 15 });
blockItem("torch", "Fackel", B.TORCH); blockItem("bench", "Werkbank", B.BENCH, { fuel: 15 });
blockItem("glass", "Glas", B.GLASS); blockItem("brick", "Steinziegel", B.BRICK);
blockItem("flower", "Blume", B.FLOWER);
blockItem("furnace", "Ofen", B.FURNACE); blockItem("chest", "Truhe", B.CHEST, { fuel: 15 });
blockItem("door", "Holztür", B.DOOR_B); blockItem("ladder", "Leiter", B.LADDER);
blockItem("gravel", "Kies", B.GRAVEL); blockItem("snow", "Schneeblock", B.SNOW); blockItem("sandstone", "Sandstein", B.SANDSTONE);
blockItem("cactus", "Kaktus", B.CACTUS); blockItem("obsidian", "Obsidian", B.OBSIDIAN); blockItem("clay", "Ton", B.CLAY);
blockItem("birch_log", "Birkenholz", B.BIRCH_LOG, { fuel: 15, tags: ["logs"] }); blockItem("spruce_log", "Fichtenholz", B.SPRUCE_LOG, { fuel: 15, tags: ["logs"] });
blockItem("jungle_log", "Tropenholz", B.JUNGLE_LOG, { fuel: 15, tags: ["logs"] }); blockItem("acacia_log", "Akazienholz", B.ACACIA_LOG, { fuel: 15, tags: ["logs"] });
item("raw_copper", "Rohkupfer"); item("copper_ingot", "Kupferbarren"); item("redstone", "Redstone"); item("lapis", "Lapislazuli"); item("emerald", "Smaragd");
item("bucket", "Eimer", { stack: 16 }); item("water_bucket", "Wassereimer", { stack: 1 }); item("lava_bucket", "Lavaeimer", { stack: 1, fuel: 1000 });
item("coal", "Kohle", { fuel: 80, tags: ["coals"] }); item("charcoal", "Holzkohle", { fuel: 80, tags: ["coals"] });
item("raw_iron", "Roheisen"); item("raw_gold", "Rohgold");
item("iron_ingot", "Eisenbarren"); item("gold_ingot", "Goldbarren"); item("diamond", "Diamant");
item("stick", "Stock", { fuel: 5 }); item("apple", "Apfel", { food: [4, 2.4] });
item("slimeball", "Schleimball");

// Werkzeuge und Rüstung: Stufe (tier) bestimmt, welche Erze etwas fallen lassen
export const MATERIALS = {
  wood: { name: "Holz", tier: 1, speed: 2, dur: 59, ing: "#planks", dmg: { sword: 4, axe: 3, pick: 2, shovel: 2, hoe: 1 } },
  stone: { name: "Stein", tier: 2, speed: 4, dur: 131, ing: "cobble", dmg: { sword: 5, axe: 4, pick: 3, shovel: 3, hoe: 1 } },
  iron: { name: "Eisen", tier: 3, speed: 6, dur: 250, ing: "iron_ingot", dmg: { sword: 6, axe: 5, pick: 4, shovel: 4, hoe: 1 }, armor: { dur: 15, def: [2, 6, 5, 2] } },
  gold: { name: "Gold", tier: 1, speed: 12, dur: 32, ing: "gold_ingot", dmg: { sword: 4, axe: 3, pick: 2, shovel: 2, hoe: 1 }, armor: { dur: 7, def: [2, 5, 3, 1] } },
  diamond: { name: "Diamant", tier: 4, speed: 8, dur: 1561, ing: "diamond", dmg: { sword: 7, axe: 6, pick: 5, shovel: 5, hoe: 1 }, armor: { dur: 33, def: [3, 8, 6, 3] } }
};
export const TOOL_NAMES = { pick: "spitzhacke", axe: "axt", shovel: "schaufel", sword: "schwert", hoe: "hacke" };
export const TOOL_ITEM = { pick: "pick", axe: "axe", shovel: "shovel", sword: "sword", hoe: "hoe" };
export const ARMOR_SLOTS = ["helmet", "chest", "legs", "boots"];
const ARMOR_NAMES = { helmet: "helm", chest: "brustpanzer", legs: "hose", boots: "stiefel" };
const ARMOR_FACTOR = [11, 16, 15, 13];       // Haltbarkeit = Faktor × Material (wie Minecraft)
const cap = s => s[0].toUpperCase() + s.slice(1);
for (const [m, M] of Object.entries(MATERIALS)) {
  for (const t of Object.keys(TOOL_NAMES)) {
    const name = M.name + (t === "sword" ? "schwert" : t === "pick" ? "spitzhacke" : t === "axe" ? "axt" : t === "shovel" ? "schaufel" : "hacke");
    item(`${m}_${t}`, name, { stack: 1, tool: t, tier: M.tier, speed: M.speed, dur: M.dur, dmg: M.dmg[t], mat: m });
  }
  if (M.armor) ARMOR_SLOTS.forEach((s, i) => item(`${m}_${s}`, `${M.name}${ARMOR_NAMES[s]}`, { stack: 1, armor: { slot: i, def: M.armor.def[i] }, dur: ARMOR_FACTOR[i] * M.armor.dur, mat: m }));
}

export const hasTag = (id, tag) => !!ITEMS[id] && !!ITEMS[id].tags && ITEMS[id].tags.includes(tag);
export const stackMax = id => (ITEMS[id] ? ITEMS[id].stack : 64);

// ---------------------------------------------------------------------
// Rezepte (wie Minecraft: Raster 2×2 im Inventar, 3×3 an der Werkbank)
//   shape: Zeilen aus Buchstaben (Leerzeichen = leer), key: Buchstabe → Gegenstand oder "#tag"
//   shapeless: Zutatenliste in beliebiger Anordnung
// ---------------------------------------------------------------------
export const RECIPES = [];
const shaped = (out, n, shape, key, o = {}) => RECIPES.push({ id: `${out}`, out: [out, n], shape, key, ...o });
const shapeless = (out, n, ingredients, o = {}) => RECIPES.push({ id: `${out}`, out: [out, n], ingredients, ...o });

shapeless("planks", 4, ["#logs"]);
shaped("bucket", 1, ["I I", " I "], { I: "iron_ingot" });
shaped("stick", 4, ["P", "P"], { P: "#planks" });
shaped("bench", 1, ["PP", "PP"], { P: "#planks" });
shaped("torch", 4, ["C", "S"], { C: "#coals", S: "stick" });
shaped("chest", 1, ["PPP", "P P", "PPP"], { P: "#planks" });
shaped("furnace", 1, ["CCC", "C C", "CCC"], { C: "cobble" });
shaped("door", 3, ["PP", "PP", "PP"], { P: "#planks" });
shaped("ladder", 3, ["S S", "SSS", "S S"], { S: "stick" });
shaped("brick", 4, ["SS", "SS"], { S: "stone" });
for (const [m, M] of Object.entries(MATERIALS)) {
  const key = { X: M.ing, S: "stick" };
  shaped(`${m}_pick`, 1, ["XXX", " S ", " S "], key);
  shaped(`${m}_axe`, 1, ["XX", "XS", " S"], key);
  shaped(`${m}_shovel`, 1, ["X", "S", "S"], key);
  shaped(`${m}_hoe`, 1, ["XX", " S", " S"], key);
  shaped(`${m}_sword`, 1, ["X", "X", "S"], key);
  if (M.armor) {
    const k = { X: M.ing };
    shaped(`${m}_helmet`, 1, ["XXX", "X X"], k);
    shaped(`${m}_chest`, 1, ["X X", "XXX", "XXX"], k);
    shaped(`${m}_legs`, 1, ["XXX", "X X", "X X"], k);
    shaped(`${m}_boots`, 1, ["X X", "X X"], k);
  }
}
/** Ofen: Zutat → [Ergebnis, Erfahrung] */
export const SMELT = {
  raw_iron: ["iron_ingot", 0.7], raw_gold: ["gold_ingot", 1], raw_copper: ["copper_ingot", 0.7], sand: ["glass", 0.1], cobble: ["stone", 0.1], clay: ["brick", 0.3],
  log: ["charcoal", 0.15], birch_log: ["charcoal", 0.15], spruce_log: ["charcoal", 0.15], jungle_log: ["charcoal", 0.15], acacia_log: ["charcoal", 0.15]
};
export const SMELT_TIME = 10;
