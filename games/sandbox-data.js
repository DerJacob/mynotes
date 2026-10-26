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
  WATER: 41, LAVA: 42, DEEPSLATE: 43, COPPER: 44, REDSTONE: 45, LAPIS: 46, EMERALD: 47, OBSIDIAN: 48, ICE: 49, CLAY: 50,
  // Etappe 3
  WOOL: 51, BED: 52,
  // Etappe 4: Landwirtschaft
  FARMLAND: 53, WHEAT: 54, CARROT: 55, POTATO: 56, PUMPKIN: 57, PUMPKIN_STEM: 58, MELON: 59, MELON_STEM: 60, CANE: 61, WART: 62,
  // Etappe 4: Redstone
  RS_WIRE: 63, RS_TORCH: 64, LEVER: 65, BUTTON: 66, PLATE: 67, PISTON: 68, STICKY: 69, PISTON_HEAD: 70, DISPENSER: 71, LAMP: 72, LAMP_ON: 73, RS_BLOCK: 74, RS_TORCH_OFF: 80,
  // Etappe 4: Verzaubern, Amboss, Brauen
  ENCHANT: 75, BOOKSHELF: 76, ANVIL: 77, BREWING: 78, IRON_BLOCK: 79,
  // Etappe 5: Nether, Ende, Wither, Leuchtfeuer
  NETHERRACK: 81, SOUL_SAND: 82, GLOWSTONE: 83, QUARTZ_ORE: 84, NETHER_GOLD: 85, MAGMA: 86, NETHER_BRICK: 87, SPAWNER: 88, PORTAL: 89, QUARTZ_BLOCK: 90,
  END_STONE: 91, FRAME: 92, END_PORTAL: 93, PURPUR: 94, DRAGON_EGG: 95, SKULL: 96, BEACON: 97, GOLD_BLOCK: 98, DIAMOND_BLOCK: 99, EMERALD_BLOCK: 100, GATEWAY: 101,
  // Etappe 6: Farben (Zusatzfeld aux: Farbe 0–15 | 16 = oben/kopfüber | 32 = Stufe steigt nach links), Dappled Forest, Camps, Dorfbewohner-Arbeitsblöcke
  CONCRETE: 102, WOOL_STAIRS: 103, WOOL_SLAB: 104, CONC_STAIRS: 105, CONC_SLAB: 106, CUSHION: 107, STRAW_BED: 108,
  POPLAR_LOG: 109, PLEAVES_R: 110, PLEAVES_O: 111, PLEAVES_Y: 112, LITTER_R: 113, LITTER_O: 114, LITTER_Y: 115, RED_BUSH: 116, PARASOL: 117,
  CAMPFIRE: 118, BARREL: 119, HAY: 120, COMPOSTER: 121, LECTERN: 122, CARTO: 123, PRISMARINE: 124, SEA_LANTERN: 125,
  // Etappe 8: Berge, üppige und Tropfstein-Höhlen, Kirschhain, Mangrovensumpf, Bambuswald, Fossilien
  POWDER_SNOW: 126, PACKED_ICE: 127, CALCITE: 128, TUFF: 129, DRIPSTONE: 130, STALAGMITE: 131, STALACTITE: 132, AMETHYST_BLOCK: 133, AMETHYST_CLUSTER: 134,
  MOSS_BLOCK: 135, MOSS_CARPET: 136, AZALEA: 137, FLOWERING_AZALEA: 138, AZALEA_LEAVES: 139, FLOWERING_AZALEA_LEAVES: 140, CAVE_VINES: 141, CAVE_VINES_BERRIES: 142, GLOW_LICHEN: 143,
  CHERRY_LOG: 144, CHERRY_LEAVES: 145, PINK_PETALS: 146, MANGROVE_LOG: 147, MANGROVE_LEAVES: 148, MANGROVE_ROOTS: 149, MUD: 150, PROPAGULE: 151, BAMBOO: 152, BAMBOO_BLOCK: 153, FOSSIL: 154
};
export const LOGS = [B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.JUNGLE_LOG, B.ACACIA_LOG, B.POPLAR_LOG, B.CHERRY_LOG, B.MANGROVE_LOG, B.BAMBOO_BLOCK];
export const LEAVES = [B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.JUNGLE_LEAVES, B.ACACIA_LEAVES, B.PLEAVES_R, B.PLEAVES_O, B.PLEAVES_Y, B.AZALEA_LEAVES, B.FLOWERING_AZALEA_LEAVES, B.CHERRY_LEAVES, B.MANGROVE_LEAVES];
export const isLog = id => id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.JUNGLE_LOG || id === B.ACACIA_LOG || id === B.POPLAR_LOG || id === B.CHERRY_LOG || id === B.MANGROVE_LOG || id === B.MANGROVE_ROOTS || id === B.BAMBOO_BLOCK;
export const isLeaves = id => id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.JUNGLE_LEAVES || id === B.ACACIA_LEAVES || (id >= B.PLEAVES_R && id <= B.PLEAVES_Y) || id === B.AZALEA_LEAVES || id === B.FLOWERING_AZALEA_LEAVES || id === B.CHERRY_LEAVES || id === B.MANGROVE_LEAVES;
export const isFluid = id => id === B.WATER || id === B.LAVA;
/** Pflanzen, die einen festen Boden brauchen */
export const isPlant = id => id === B.FLOWER || id === B.TALLGRASS || id === B.DEADBUSH || (id >= B.LITTER_R && id <= B.PARASOL) || id === B.STALAGMITE || id === B.AMETHYST_CLUSTER || id === B.MOSS_CARPET ||
  id === B.AZALEA || id === B.FLOWERING_AZALEA || id === B.PINK_PETALS || id === B.PROPAGULE;
/** Hängende Blöcke: brauchen oben festen Halt (oder ihresgleichen) */
export const isHang = id => id === B.STALACTITE || id === B.CAVE_VINES || id === B.CAVE_VINES_BERRIES;
/** Leuchtflechte haftet an jeder Wand, Decke oder jedem Boden */
export const isAttach = id => id === B.GLOW_LICHEN;
/** Bambus braucht Erde, Gras, Sand, Schlamm, Moos oder Bambus darunter */
export const bambooBase = id => id === B.DIRT || id === B.GRASS || id === B.SAND || id === B.MUD || id === B.MOSS_BLOCK || id === B.BAMBOO || id === B.GRASS_SNOW || id === B.CLAY || id === B.GRAVEL;
/** Nutzpflanzen: brauchen Ackerland (Zuckerrohr: Sand/Erde am Wasser), lassen sich nicht einfach überbauen */
export const isCrop = id => id === B.WHEAT || id === B.CARROT || id === B.POTATO || id === B.PUMPKIN_STEM || id === B.MELON_STEM || id === B.WART || id === B.CANE;
/** Redstone-Bauteile (halten die Liste im Spiel kurz: nur diese Blöcke werden beobachtet) */
export const RS_IDS = new Set([B.RS_WIRE, B.RS_TORCH, B.RS_TORCH_OFF, B.LEVER, B.BUTTON, B.PLATE, B.PISTON, B.STICKY, B.PISTON_HEAD, B.DISPENSER, B.LAMP, B.LAMP_ON, B.RS_BLOCK]);

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
BLOCKS[B.WOOL] = def("wool", { solid: true, lcost: 3, hard: 1.2, tool: "shears", drop: "wool" });
BLOCKS[B.BED] = def("bed", { hard: 0.3, drop: "bed", interact: true });

// Etappe 4: Landwirtschaft
BLOCKS[B.FARMLAND] = def("farmland", { solid: true, lcost: 3, hard: 0.9, tool: "shovel", drop: "dirt" });
BLOCKS[B.WHEAT] = def("wheat", { hard: 0.05 });
BLOCKS[B.CARROT] = def("carrot", { hard: 0.05 });
BLOCKS[B.POTATO] = def("potato", { hard: 0.05 });
BLOCKS[B.PUMPKIN] = def("pumpkin", { solid: true, lcost: 3, hard: 1.5, tool: "axe", drop: "pumpkin" });
BLOCKS[B.PUMPKIN_STEM] = def("pumpkin_stem", { hard: 0.05 });
BLOCKS[B.MELON] = def("melon", { solid: true, lcost: 3, hard: 1.5, tool: "axe", drop: "melon_slice", dropN: [3, 7] });
BLOCKS[B.MELON_STEM] = def("melon_stem", { hard: 0.05 });
BLOCKS[B.CANE] = def("cane", { hard: 0.05, drop: "sugar_cane" });
BLOCKS[B.WART] = def("wart", { hard: 0.05 });
// Etappe 4: Redstone (Zustand steht im Zusatzfeld aux, siehe sandbox-redstone.js)
BLOCKS[B.RS_WIRE] = def("rs_wire", { hard: 0.05, drop: "redstone" });
BLOCKS[B.RS_TORCH] = def("rs_torch", { hard: 0.05, drop: "redstone_torch", emit: 7 });
BLOCKS[B.RS_TORCH_OFF] = def("rs_torch_off", { hard: 0.05, drop: "redstone_torch" });
BLOCKS[B.LEVER] = def("lever", { hard: 0.6, drop: "lever", interact: true });
BLOCKS[B.BUTTON] = def("button", { hard: 0.6, tool: "pick", drop: "button", interact: true });
BLOCKS[B.PLATE] = def("plate", { hard: 0.6, tool: "axe", drop: "pressure_plate" });
BLOCKS[B.PISTON] = def("piston", { solid: true, lcost: 3, hard: 0.8, tool: "pick", drop: "piston" });
BLOCKS[B.STICKY] = def("sticky", { solid: true, lcost: 3, hard: 0.8, tool: "pick", drop: "sticky_piston" });
BLOCKS[B.PISTON_HEAD] = def("piston_head", { solid: true, lcost: 3, hard: 0.8, tool: "pick", drop: null });
BLOCKS[B.DISPENSER] = def("dispenser", { solid: true, lcost: 3, hard: 5.25, tool: "pick", tier: 1, drop: "dispenser", interact: true, entity: "disp" });
BLOCKS[B.LAMP] = def("lamp", { solid: true, lcost: 3, hard: 0.45, drop: "redstone_lamp" });
BLOCKS[B.LAMP_ON] = def("lamp_on", { solid: true, lcost: 3, hard: 0.45, drop: "redstone_lamp", emit: 15 });
BLOCKS[B.RS_BLOCK] = def("rs_block", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 1, drop: "redstone_block" });
// Etappe 4: Verzaubern, Amboss, Brauen
BLOCKS[B.ENCHANT] = def("enchant", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 1, drop: "enchanting_table", interact: true, emit: 7 });
BLOCKS[B.BOOKSHELF] = def("bookshelf", { solid: true, lcost: 3, hard: 2.25, tool: "axe", drop: "book", dropN: [3, 3] });
BLOCKS[B.ANVIL] = def("anvil", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 1, drop: "anvil", interact: true });
BLOCKS[B.BREWING] = def("brewing", { solid: true, lcost: 3, hard: 0.75, tool: "pick", drop: "brewing_stand", interact: true, entity: "brew", emit: 1 });
BLOCKS[B.IRON_BLOCK] = def("iron_block", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 2, drop: "iron_block" });
// Etappe 5: Nether, Ende, Wither, Leuchtfeuer (Zustand im Zusatzfeld aux: Rahmen = Auge eingesetzt, siehe sandbox-dims.js)
BLOCKS[B.NETHERRACK] = def("netherrack", { solid: true, lcost: 3, hard: 0.6, tool: "pick", tier: 1, drop: "netherrack" });
BLOCKS[B.SOUL_SAND] = def("soul_sand", { solid: true, lcost: 3, hard: 0.75, tool: "shovel", drop: "soul_sand" });
BLOCKS[B.GLOWSTONE] = def("glowstone", { solid: true, lcost: 3, hard: 0.45, drop: "glowstone_dust", dropN: [2, 4], emit: 15 });
BLOCKS[B.QUARTZ_ORE] = def("quartz_ore", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 1, drop: "quartz" });
BLOCKS[B.NETHER_GOLD] = def("nether_gold", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 1, drop: "gold_nugget", dropN: [2, 6] });
BLOCKS[B.MAGMA] = def("magma", { solid: true, lcost: 3, hard: 0.75, tool: "pick", tier: 1, drop: "magma_block", emit: 3 });
BLOCKS[B.NETHER_BRICK] = def("nether_brick", { solid: true, lcost: 3, hard: 3, tool: "pick", tier: 1, drop: "nether_bricks" });
BLOCKS[B.SPAWNER] = def("spawner", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 1, drop: null });
BLOCKS[B.PORTAL] = def("portal", { hard: Infinity, emit: 11 });
BLOCKS[B.QUARTZ_BLOCK] = def("quartz_block", { solid: true, lcost: 3, hard: 1.2, tool: "pick", tier: 1, drop: "quartz_block" });
BLOCKS[B.END_STONE] = def("end_stone", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 1, drop: "end_stone" });
BLOCKS[B.FRAME] = def("frame", { solid: true, lcost: 3, hard: Infinity, interact: true, emit: 1 });
BLOCKS[B.END_PORTAL] = def("end_portal", { hard: Infinity, emit: 9 });
BLOCKS[B.PURPUR] = def("purpur", { solid: true, lcost: 3, hard: 3, tool: "pick", tier: 1, drop: "purpur_block" });
BLOCKS[B.DRAGON_EGG] = def("dragon_egg", { solid: true, lcost: 3, hard: 4.5, drop: "dragon_egg", emit: 2 });
BLOCKS[B.SKULL] = def("skull", { hard: 1.5, drop: "wither_skeleton_skull" });
BLOCKS[B.BEACON] = def("beacon", { solid: true, lcost: 0, hard: 4.5, drop: "beacon", interact: true, entity: "beacon", emit: 15 });
BLOCKS[B.GOLD_BLOCK] = def("gold_block", { solid: true, lcost: 3, hard: 4.5, tool: "pick", tier: 3, drop: "gold_block" });
BLOCKS[B.DIAMOND_BLOCK] = def("diamond_block", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 3, drop: "diamond_block" });
BLOCKS[B.EMERALD_BLOCK] = def("emerald_block", { solid: true, lcost: 3, hard: 7.5, tool: "pick", tier: 3, drop: "emerald_block" });
BLOCKS[B.GATEWAY] = def("gateway", { hard: Infinity, emit: 7 });
// Lücke 80 (Redstone-Fackel aus) bleibt wie sie war; Block 81+ liegen dahinter

// ---------------------------------------------------------------------
// Etappe 6: Farben, Stufen und Halbblöcke, Kissen, Dappled Forest, Camps, Arbeitsblöcke
// ---------------------------------------------------------------------
/** 16 Farben wie in Minecraft: [Schlüssel, deutscher Name, Farbwert] */
export const COLORS = [
  ["white", "Weiß", "#e9ecec"], ["orange", "Orange", "#f07613"], ["magenta", "Magenta", "#bd44b3"], ["light_blue", "Hellblau", "#3aafd9"],
  ["yellow", "Gelb", "#f8c627"], ["lime", "Hellgrün", "#70b919"], ["pink", "Rosa", "#ed8dac"], ["gray", "Grau", "#3e4447"],
  ["light_gray", "Hellgrau", "#8e8e86"], ["cyan", "Türkis", "#158991"], ["purple", "Violett", "#792aac"], ["blue", "Blau", "#35399d"],
  ["brown", "Braun", "#724728"], ["green", "Grün", "#546d1b"], ["red", "Rot", "#a12722"], ["black", "Schwarz", "#141519"]
];
/** Gegenstands-Name zu Art und Farbe (weiße Wolle heißt wie früher "wool", damit alte Spielstände passen) */
export const colorItem = (kind, c) => (kind === "wool" && !c ? "wool" : `${kind}_${COLORS[c & 15][0]}`);
/** Teilblöcke: Kollisionskästen in Bruchteilen des Blocks [x0, y0, x1, y1] (y wächst nach unten) */
export const boxesOf = (id, aux) => {
  const bd = BLOCKS[id];
  if (!bd || !bd.shape) return FULL_BOX;
  const top = (aux & 16) !== 0;
  if (bd.shape === "slab") return top ? SLAB_TOP : SLAB_BOT;
  if (bd.shape === "cushion") return CUSHION_BOX;
  const right = (aux & 32) === 0;                                      // Stufe steigt nach rechts
  return STAIRS[(top ? 2 : 0) + (right ? 0 : 1)];
};
const FULL_BOX = [[0, 0, 1, 1]], SLAB_BOT = [[0, 0.5, 1, 1]], SLAB_TOP = [[0, 0, 1, 0.5]], CUSHION_BOX = [[0.05, 0.6, 0.95, 1]];
const STAIRS = [
  [[0, 0.5, 1, 1], [0.5, 0, 1, 0.5]], [[0, 0.5, 1, 1], [0, 0, 0.5, 0.5]],
  [[0, 0, 1, 0.5], [0.5, 0.5, 1, 1]], [[0, 0, 1, 0.5], [0, 0.5, 0.5, 1]]
];
BLOCKS[B.WOOL] = def("wool", { solid: true, lcost: 3, hard: 1.2, tool: "shears", colored: "wool" });
BLOCKS[B.CONCRETE] = def("concrete", { solid: true, lcost: 3, hard: 2.7, tool: "pick", tier: 1, colored: "concrete" });
BLOCKS[B.WOOL_STAIRS] = def("wool_stairs", { solid: true, lcost: 1, hard: 1.2, tool: "shears", colored: "wool_stairs", shape: "stairs", parent: B.WOOL });
BLOCKS[B.WOOL_SLAB] = def("wool_slab", { solid: true, lcost: 1, hard: 1.2, tool: "shears", colored: "wool_slab", shape: "slab", parent: B.WOOL });
BLOCKS[B.CONC_STAIRS] = def("conc_stairs", { solid: true, lcost: 1, hard: 2.7, tool: "pick", tier: 1, colored: "concrete_stairs", shape: "stairs", parent: B.CONCRETE });
BLOCKS[B.CONC_SLAB] = def("conc_slab", { solid: true, lcost: 1, hard: 2.7, tool: "pick", tier: 1, colored: "concrete_slab", shape: "slab", parent: B.CONCRETE });
BLOCKS[B.CUSHION] = def("cushion", { solid: true, lcost: 1, hard: 0.6, tool: "shears", colored: "cushion", shape: "cushion", interact: true });
BLOCKS[B.STRAW_BED] = def("straw_bed", { hard: 0.3, drop: "straw_bed", interact: true });
BLOCKS[B.POPLAR_LOG] = def("poplar_log", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: "poplar_log" });
for (const id of [B.PLEAVES_R, B.PLEAVES_O, B.PLEAVES_Y]) BLOCKS[id] = def("poplar_leaves", { lcost: 1, hard: 0.3, drop: null });
BLOCKS[B.LITTER_R] = def("leaf_litter", { hard: 0.05, drop: "leaf_litter_r" }); BLOCKS[B.LITTER_O] = def("leaf_litter", { hard: 0.05, drop: "leaf_litter_o" });
BLOCKS[B.LITTER_Y] = def("leaf_litter", { hard: 0.05, drop: "leaf_litter_y" });
BLOCKS[B.RED_BUSH] = def("red_bush", { hard: 0.05, drop: "red_bush" });
BLOCKS[B.PARASOL] = def("parasol", { hard: 0.05, drop: "parasol_mushroom" });
BLOCKS[B.CAMPFIRE] = def("campfire", { hard: 0.6, tool: "axe", drop: "campfire", emit: 15, hurts: true });
BLOCKS[B.BARREL] = def("barrel", { solid: true, lcost: 3, hard: 3.75, tool: "axe", drop: "barrel", interact: true, entity: "chest" });
BLOCKS[B.HAY] = def("hay", { solid: true, lcost: 3, hard: 0.75, drop: "hay_block" });
BLOCKS[B.COMPOSTER] = def("composter", { solid: true, lcost: 3, hard: 0.9, tool: "axe", drop: "composter" });
BLOCKS[B.LECTERN] = def("lectern", { solid: true, lcost: 3, hard: 3.75, tool: "axe", drop: "lectern" });
BLOCKS[B.CARTO] = def("carto", { solid: true, lcost: 3, hard: 3.75, tool: "axe", drop: "cartography_table" });
BLOCKS[B.PRISMARINE] = def("prismarine", { solid: true, lcost: 3, hard: 2.25, tool: "pick", tier: 1, drop: "prismarine" });
BLOCKS[B.SEA_LANTERN] = def("sea_lantern", { solid: true, lcost: 3, hard: 0.45, drop: "sea_lantern", emit: 15 });
/** Arbeitsblock → Beruf des Dorfbewohners (siehe sandbox-vill.js) */
export const WORKSTATIONS = { [B.COMPOSTER]: "farmer", [B.LECTERN]: "librarian", [B.CARTO]: "cartographer", [B.ANVIL]: "smith", [B.BREWING]: "cleric" };

/** Behutsamkeit (Silk Touch): welcher Gegenstand fällt statt der üblichen Beute */
export const SILK = {
  [B.STONE]: "stone", [B.COAL]: "coal_ore", [B.IRON]: "iron_ore", [B.GOLD]: "gold_ore", [B.DIAMOND]: "diamond_ore", [B.COPPER]: "copper_ore", [B.REDSTONE]: "redstone_ore",
  [B.LAPIS]: "lapis_ore", [B.EMERALD]: "emerald_ore", [B.GRASS]: "grass_block", [B.GRASS_SNOW]: "grass_block", [B.DEEPSLATE]: "deepslate", [B.ICE]: "ice", [B.GLASS]: "glass",
  [B.LEAVES]: "leaves", [B.BOOKSHELF]: "bookshelf", [B.MELON]: "melon", [B.CLAY]: "clay", [B.SNOW]: "snow",
  [B.QUARTZ_ORE]: "quartz_ore", [B.NETHER_GOLD]: "nether_gold_ore", [B.GLOWSTONE]: "glowstone",
  [B.PACKED_ICE]: "packed_ice", [B.AZALEA_LEAVES]: "azalea_leaves", [B.FLOWERING_AZALEA_LEAVES]: "flowering_azalea_leaves", [B.CHERRY_LEAVES]: "cherry_leaves",
  [B.MANGROVE_LEAVES]: "mangrove_leaves", [B.FOSSIL]: "fossil", [B.AMETHYST_CLUSTER]: "amethyst_cluster", [B.GLOW_LICHEN]: "glow_lichen"
};
/** Glück (Fortune) erhöht die Ausbeute dieser Blöcke */
export const FORTUNE_BLOCKS = new Set([B.COAL, B.DIAMOND, B.EMERALD, B.LAPIS, B.REDSTONE, B.COPPER, B.QUARTZ_ORE, B.NETHER_GOLD, B.GLOWSTONE]);
/** Wasser zerstört diese weichen Blöcke */
export const isSoft = id => isPlant(id) || isHang(id) || isAttach(id) || id === B.BAMBOO || isCrop(id) || id === B.TORCH || id === B.RS_WIRE || id === B.RS_TORCH || id === B.RS_TORCH_OFF || id === B.LEVER || id === B.BUTTON || id === B.PLATE;

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
item("raw_copper", "Rohkupfer"); item("copper_ingot", "Kupferbarren"); item("lapis", "Lapislazuli"); item("emerald", "Smaragd");
item("bucket", "Eimer", { stack: 16 }); item("water_bucket", "Wassereimer", { stack: 1 }); item("lava_bucket", "Lavaeimer", { stack: 1, fuel: 1000 });
item("coal", "Kohle", { fuel: 80, tags: ["coals"] }); item("charcoal", "Holzkohle", { fuel: 80, tags: ["coals"] });
item("raw_iron", "Roheisen"); item("raw_gold", "Rohgold");
item("iron_ingot", "Eisenbarren"); item("gold_ingot", "Goldbarren"); item("diamond", "Diamant");
item("stick", "Stock", { fuel: 5 }); item("apple", "Apfel", { food: [4, 2.4] });
item("slimeball", "Schleimball");
// Etappe 3: Beute, Fleisch, Waffen
blockItem("wool", "Wolle", B.WOOL, { fuel: 5 }); blockItem("bed", "Bett", B.BED, { stack: 1 });
item("leather", "Leder"); item("feather", "Feder"); item("egg", "Ei", { stack: 16 }); item("bone", "Knochen"); item("bone_meal", "Knochenmehl");
item("string", "Faden"); item("gunpowder", "Schwarzpulver"); item("spider_eye", "Spinnenauge"); item("ender_pearl", "Enderperle", { stack: 16 }); item("flint", "Feuerstein");
item("arrow", "Pfeil"); item("bow", "Bogen", { stack: 1, dur: 384, fuel: 15 }); item("shield", "Schild", { stack: 1, dur: 336, fuel: 15 });
item("shears", "Schere", { stack: 1, dur: 238, tool: "shears", tier: 1, speed: 5, dmg: 1, mat: "iron" });
item("milk_bucket", "Milcheimer", { stack: 1 });
item("raw_beef", "Rohes Rindfleisch", { food: [3, 1.8] }); item("steak", "Steak", { food: [8, 12.8] });
item("raw_porkchop", "Rohes Schweinefleisch", { food: [3, 1.8] }); item("cooked_porkchop", "Gebratenes Schweinefleisch", { food: [8, 12.8] });
item("raw_chicken", "Rohes Hühnchen", { food: [2, 1.2] }); item("cooked_chicken", "Gebratenes Hühnchen", { food: [6, 7.2] });
item("raw_mutton", "Rohes Hammelfleisch", { food: [2, 1.2] }); item("cooked_mutton", "Gebratenes Hammelfleisch", { food: [6, 9.6] });
item("raw_rabbit", "Rohes Kaninchen", { food: [3, 1.8] }); item("cooked_rabbit", "Gebratenes Kaninchen", { food: [5, 6] });
item("rotten_flesh", "Verrottetes Fleisch", { food: [4, 0.8] });

// Etappe 4: Landwirtschaft, Angeln, Redstone, Verzaubern, Brauen
// put: [Art, Block] – Gegenstände, die nicht einfach als Block gesetzt werden (Pflanzen brauchen Boden, Redstone-Teile haben eine Richtung)
const putItem = (id, name, kind, block, o = {}) => item(id, name, { put: [kind, block], ...o });
putItem("wheat_seeds", "Weizensamen", "plant", B.WHEAT); item("wheat", "Weizen");
putItem("carrot", "Karotte", "plant", B.CARROT, { food: [3, 3.6] }); putItem("potato", "Kartoffel", "plant", B.POTATO, { food: [1, 0.6] });
item("baked_potato", "Ofenkartoffel", { food: [5, 6] }); item("bread", "Brot", { food: [5, 6] });
blockItem("pumpkin", "Kürbis", B.PUMPKIN); putItem("pumpkin_seeds", "Kürbiskerne", "plant", B.PUMPKIN_STEM); item("pumpkin_pie", "Kürbiskuchen", { food: [8, 4.8] });
blockItem("melon", "Melone", B.MELON); putItem("melon_seeds", "Melonenkerne", "plant", B.MELON_STEM); item("melon_slice", "Melonenscheibe", { food: [2, 1.2] });
putItem("sugar_cane", "Zuckerrohr", "plant", B.CANE); item("sugar", "Zucker"); item("paper", "Papier"); item("book", "Buch", { fuel: 5 });
item("golden_carrot", "Goldene Karotte", { food: [6, 14.4] }); item("gold_nugget", "Goldklumpen"); item("glistering_melon_slice", "Glitzernde Melonenscheibe");
item("fishing_rod", "Angel", { stack: 1, dur: 64, fuel: 15 });
item("raw_cod", "Roher Kabeljau", { food: [2, 0.4] }); item("cooked_cod", "Gebratener Kabeljau", { food: [5, 6] });
item("raw_salmon", "Roher Lachs", { food: [2, 0.4] }); item("cooked_salmon", "Gebratener Lachs", { food: [6, 9.6] }); item("pufferfish", "Kugelfisch", { food: [1, 0.2] });
item("rabbit_foot", "Hasenpfote");
// Redstone
putItem("redstone", "Redstone", "rs", B.RS_WIRE);
putItem("redstone_torch", "Redstone-Fackel", "rs", B.RS_TORCH); putItem("lever", "Hebel", "rs", B.LEVER); putItem("button", "Knopf", "rs", B.BUTTON); putItem("pressure_plate", "Druckplatte", "rs", B.PLATE, { fuel: 5 });
putItem("piston", "Kolben", "rs", B.PISTON); putItem("sticky_piston", "Klebriger Kolben", "rs", B.STICKY); putItem("dispenser", "Spender", "rs", B.DISPENSER);
blockItem("redstone_lamp", "Redstone-Lampe", B.LAMP); blockItem("redstone_block", "Redstone-Block", B.RS_BLOCK);
// Verzaubern, Amboss, Brauen
blockItem("enchanting_table", "Verzauberungstisch", B.ENCHANT); blockItem("bookshelf", "Bücherregal", B.BOOKSHELF, { fuel: 15 });
blockItem("anvil", "Amboss", B.ANVIL); blockItem("iron_block", "Eisenblock", B.IRON_BLOCK); blockItem("brewing_stand", "Braustand", B.BREWING);
item("enchanted_book", "Verzaubertes Buch", { stack: 1 });
item("glass_bottle", "Glasflasche"); item("potion", "Trank", { stack: 1 }); item("splash_potion", "Wurftrank", { stack: 1 });
putItem("nether_wart", "Netherwarze", "plant", B.WART); item("blaze_rod", "Lohenrute", { fuel: 120 }); item("blaze_powder", "Lohenstaub"); item("fermented_spider_eye", "Fermentiertes Spinnenauge");
item("glowstone_dust", "Glowstone-Staub");
// Etappe 5: Nether, Ende, Wither, Leuchtfeuer
blockItem("netherrack", "Netherrack", B.NETHERRACK); blockItem("soul_sand", "Seelensand", B.SOUL_SAND); blockItem("glowstone", "Glowstone", B.GLOWSTONE);
blockItem("magma_block", "Magmablock", B.MAGMA); blockItem("nether_bricks", "Netherziegel", B.NETHER_BRICK); blockItem("quartz_block", "Quarzblock", B.QUARTZ_BLOCK);
blockItem("quartz_ore", "Netherquarzerz", B.QUARTZ_ORE); blockItem("nether_gold_ore", "Nethergolderz", B.NETHER_GOLD);
blockItem("end_stone", "Endstein", B.END_STONE); blockItem("purpur_block", "Purpurblock", B.PURPUR); blockItem("dragon_egg", "Drachenei", B.DRAGON_EGG, { stack: 1 });
blockItem("wither_skeleton_skull", "Wither-Skelettschädel", B.SKULL); blockItem("beacon", "Leuchtfeuer", B.BEACON);
blockItem("gold_block", "Goldblock", B.GOLD_BLOCK); blockItem("diamond_block", "Diamantblock", B.DIAMOND_BLOCK); blockItem("emerald_block", "Smaragdblock", B.EMERALD_BLOCK);
item("quartz", "Netherquarz"); item("nether_brick", "Netherziegel (Barren)"); item("magma_cream", "Magmacreme"); item("ghast_tear", "Ghast-Träne"); item("nether_star", "Netherstern");
item("ender_eye", "Enderauge"); item("flint_and_steel", "Feuerzeug", { stack: 1, dur: 64 });
item("elytra", "Elytren", { stack: 1, dur: 432, armor: { slot: 1, def: 0 }, mat: "elytra" });
// Erzblöcke und Co. als Gegenstände (für Behutsamkeit / Silk Touch)
blockItem("coal_ore", "Kohleerz", B.COAL); blockItem("iron_ore", "Eisenerz", B.IRON); blockItem("gold_ore", "Golderz", B.GOLD); blockItem("diamond_ore", "Diamanterz", B.DIAMOND);
blockItem("copper_ore", "Kupfererz", B.COPPER); blockItem("redstone_ore", "Redstone-Erz", B.REDSTONE); blockItem("lapis_ore", "Lapiserz", B.LAPIS); blockItem("emerald_ore", "Smaragderz", B.EMERALD);
blockItem("grass_block", "Grasblock", B.GRASS); blockItem("deepslate", "Tiefenschiefer", B.DEEPSLATE); blockItem("ice", "Eis", B.ICE);

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

// Lederrüstung (Material nur für Rüstung, daher nicht in MATERIALS: dort würden auch Lederwerkzeuge entstehen)
ARMOR_SLOTS.forEach((sl, i) => item(`leather_${sl}`, `Leder${ARMOR_NAMES[sl]}`, { stack: 1, armor: { slot: i, def: [1, 3, 2, 1][i] }, dur: ARMOR_FACTOR[i] * 5, mat: "leather" }));

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
shaped("bow", 1, [" SX", "S X", " SX"], { S: "stick", X: "string" });
shaped("arrow", 4, ["F", "S", "W"], { F: "flint", S: "stick", W: "feather" });
shaped("shield", 1, ["PIP", "PPP", " P "], { P: "#planks", I: "iron_ingot" });
shaped("shears", 1, [" I", "I "], { I: "iron_ingot" });
shaped("bed", 1, ["WWW", "PPP"], { W: "#wool", P: "#planks" });
shaped("wool", 1, ["SS", "SS"], { S: "string" });
shapeless("bone_meal", 3, ["bone"]);
// Etappe 4
shaped("bread", 1, ["WWW"], { W: "wheat" });
shapeless("sugar", 1, ["sugar_cane"]);
shaped("paper", 3, ["CCC"], { C: "sugar_cane" });
shapeless("book", 1, ["paper", "paper", "paper", "leather"]);
shapeless("pumpkin_pie", 1, ["pumpkin", "sugar", "egg"]);
shaped("fishing_rod", 1, ["  S", " SX", "S X"], { S: "stick", X: "string" });
shapeless("gold_nugget", 9, ["gold_ingot"]);
shaped("gold_ingot_n", 1, ["NNN", "NNN", "NNN"], { N: "gold_nugget" }, { out: ["gold_ingot", 1] });
shaped("golden_carrot", 1, ["NNN", "NCN", "NNN"], { N: "gold_nugget", C: "carrot" });
shaped("glistering_melon_slice", 1, ["NNN", "NMN", "NNN"], { N: "gold_nugget", M: "melon_slice" });
shaped("iron_block", 1, ["III", "III", "III"], { I: "iron_ingot" });
shapeless("iron_ingot_b", 9, ["iron_block"], { out: ["iron_ingot", 9] });
shaped("redstone_block", 1, ["RRR", "RRR", "RRR"], { R: "redstone" });
shapeless("redstone_b", 9, ["redstone_block"], { out: ["redstone", 9] });
shaped("redstone_torch", 1, ["R", "S"], { R: "redstone", S: "stick" });
shaped("lever", 1, ["S", "C"], { S: "stick", C: "cobble" });
shapeless("button", 1, ["stone"]);
shaped("pressure_plate", 1, ["PP"], { P: "#planks" });
shaped("piston", 1, ["PPP", "CIC", "CRC"], { P: "#planks", C: "cobble", I: "iron_ingot", R: "redstone" });
shaped("sticky_piston", 1, ["S", "P"], { S: "slimeball", P: "piston" });
shaped("dispenser", 1, ["CCC", "CBC", "CRC"], { C: "cobble", B: "bow", R: "redstone" });
shaped("redstone_lamp", 1, [" R ", "RTR", " R "], { R: "redstone", T: "torch" });
shaped("enchanting_table", 1, [" B ", "DOD", "OOO"], { B: "book", D: "diamond", O: "obsidian" });
shaped("bookshelf", 1, ["PPP", "BBB", "PPP"], { P: "#planks", B: "book" });
shaped("anvil", 1, ["III", " i ", "iii"], { I: "iron_block", i: "iron_ingot" });
shaped("brewing_stand", 1, [" B ", "CCC"], { B: "blaze_rod", C: "cobble" });
shaped("glass_bottle", 3, ["G G", " G "], { G: "glass" });
shapeless("blaze_powder", 2, ["blaze_rod"]);
shapeless("fermented_spider_eye", 1, ["spider_eye", "sugar", "flower"]);
// Etappe 5
shapeless("flint_and_steel", 1, ["iron_ingot", "flint"]);
shapeless("ender_eye", 1, ["ender_pearl", "blaze_powder"]);
shapeless("magma_cream", 1, ["blaze_powder", "slimeball"]);
shaped("glowstone", 1, ["GG", "GG"], { G: "glowstone_dust" });
shaped("quartz_block", 1, ["QQ", "QQ"], { Q: "quartz" });
shaped("nether_bricks", 1, ["NN", "NN"], { N: "nether_brick" });
shaped("gold_block", 1, ["GGG", "GGG", "GGG"], { G: "gold_ingot" }); shapeless("gold_ingot_g", 9, ["gold_block"], { out: ["gold_ingot", 9] });
shaped("diamond_block", 1, ["DDD", "DDD", "DDD"], { D: "diamond" }); shapeless("diamond_b", 9, ["diamond_block"], { out: ["diamond", 9] });
shaped("emerald_block", 1, ["EEE", "EEE", "EEE"], { E: "emerald" }); shapeless("emerald_b", 9, ["emerald_block"], { out: ["emerald", 9] });
shaped("beacon", 1, ["GGG", "GNG", "OOO"], { G: "glass", N: "nether_star", O: "obsidian" });
{ const k = { X: "leather" };
  shaped("leather_helmet", 1, ["XXX", "X X"], k); shaped("leather_chest", 1, ["X X", "XXX", "XXX"], k);
  shaped("leather_legs", 1, ["XXX", "X X", "X X"], k); shaped("leather_boots", 1, ["X X", "X X"], k); }
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
  raw_beef: ["steak", 0.35], raw_porkchop: ["cooked_porkchop", 0.35], raw_chicken: ["cooked_chicken", 0.35], raw_mutton: ["cooked_mutton", 0.35], raw_rabbit: ["cooked_rabbit", 0.35],
  potato: ["baked_potato", 0.35], raw_cod: ["cooked_cod", 0.35], raw_salmon: ["cooked_salmon", 0.35],
  netherrack: ["nether_brick", 0.1], nether_gold_ore: ["gold_ingot", 1],
  log: ["charcoal", 0.15], birch_log: ["charcoal", 0.15], spruce_log: ["charcoal", 0.15], jungle_log: ["charcoal", 0.15], acacia_log: ["charcoal", 0.15]
};
export const SMELT_TIME = 10;

// ---------------------------------------------------------------------
// Etappe 6: Gegenstände und Rezepte
// ---------------------------------------------------------------------
const KIND_BLOCK = { wool: B.WOOL, concrete: B.CONCRETE, wool_stairs: B.WOOL_STAIRS, wool_slab: B.WOOL_SLAB, concrete_stairs: B.CONC_STAIRS, concrete_slab: B.CONC_SLAB, cushion: B.CUSHION };
const KIND_NAME = { wool: "Wolle", concrete: "Beton", wool_stairs: "Wolltreppe", wool_slab: "Wollstufe", concrete_stairs: "Betontreppe", concrete_slab: "Betonstufe", cushion: "Kissen" };
for (const kind of Object.keys(KIND_BLOCK)) {
  COLORS.forEach(([key, name], c) => {
    const id = colorItem(kind, c);
    item(id, `${KIND_NAME[kind]} (${name})`, { block: KIND_BLOCK[kind], aux: c, col: c, kind, fuel: kind.startsWith("wool") || kind === "cushion" ? 5 : 0, tags: kind === "wool" ? ["wool"] : kind === "wool_slab" ? ["wool_slab"] : [] });
  });
}
ITEMS.wool.aux = 0; ITEMS.wool.col = 0; ITEMS.wool.kind = "wool"; ITEMS.wool.tags = ["wool"];
COLORS.forEach(([key, name], c) => item(`dye_${key}`, `Farbstoff (${name})`, { col: c, tags: ["dye"] }));
blockItem("straw_bed", "Strohbett", B.STRAW_BED, { stack: 1, fuel: 5 });
blockItem("poplar_log", "Pappelholz", B.POPLAR_LOG, { fuel: 15, tags: ["logs"] });
blockItem("leaf_litter_r", "Laubstreu (rot)", B.LITTER_R); blockItem("leaf_litter_o", "Laubstreu (orange)", B.LITTER_O); blockItem("leaf_litter_y", "Laubstreu (gelb)", B.LITTER_Y);
blockItem("red_bush", "Roter Busch", B.RED_BUSH, { fuel: 5 });
blockItem("parasol_mushroom", "Schirmpilz", B.PARASOL, { food: [2, 1.2] });
blockItem("campfire", "Lagerfeuer", B.CAMPFIRE, { fuel: 15 }); blockItem("barrel", "Fass", B.BARREL, { fuel: 15 });
blockItem("hay_block", "Heuballen", B.HAY); blockItem("composter", "Komposter", B.COMPOSTER, { fuel: 15 });
blockItem("lectern", "Lesepult", B.LECTERN, { fuel: 15 }); blockItem("cartography_table", "Kartentisch", B.CARTO, { fuel: 15 });
blockItem("prismarine", "Prismarin", B.PRISMARINE); blockItem("sea_lantern", "Seelaterne", B.SEA_LANTERN);
item("map_mansion", "Entdeckerkarte (Waldanwesen)", { stack: 1, map: "mansion" }); item("map_monument", "Entdeckerkarte (Ozeanmonument)", { stack: 1, map: "monument" });

shaped("straw_bed", 1, ["WWW", "PPP"], { W: "wheat", P: "#planks" });
shaped("campfire", 1, [" S ", "SCS", "LLL"], { S: "stick", C: "#coals", L: "#logs" });
shaped("barrel", 1, ["PSP", "P P", "PSP"], { P: "#planks", S: "stick" });
shaped("hay_block", 1, ["WWW", "WWW", "WWW"], { W: "wheat" }); shapeless("wheat_h", 9, ["hay_block"], { out: ["wheat", 9] });
shaped("composter", 1, ["P P", "P P", "PPP"], { P: "#planks" });
shaped("lectern", 1, ["PPP", " B ", " P "], { P: "#planks", B: "bookshelf" });
shaped("cartography_table", 1, ["CC", "PP", "PP"], { C: "paper", P: "#planks" });
shaped("leaf_litter_mix", 1, ["L"], { L: "leaf_litter_r" }, { out: ["leaf_litter_o", 1], hide: true });
// Farbstoffe: Grundfarben aus Fundstücken, Mischfarben aus zwei Grundfarben
shapeless("dye_red", 1, ["flower"]); shapeless("dye_yellow", 1, ["flower", "glowstone_dust"]); shapeless("dye_blue", 1, ["lapis"]);
shapeless("dye_black", 1, ["charcoal"]); shapeless("dye_white", 1, ["bone_meal"]);
SMELT.cactus = ["dye_green", 1];
const MIX = { orange: ["red", "yellow"], pink: ["red", "white"], purple: ["red", "blue"], magenta: ["purple", "pink"], cyan: ["blue", "green"], light_blue: ["blue", "white"], lime: ["green", "white"], gray: ["black", "white"], light_gray: ["gray", "white"], brown: ["red", "green"] };
for (const [k, [a, b]] of Object.entries(MIX)) shapeless(`dye_${k}`, 2, [`dye_${a}`, `dye_${b}`]);
COLORS.forEach(([key], c) => {
  const w = colorItem("wool", c), cn = colorItem("concrete", c), ws = colorItem("wool_stairs", c), wl = colorItem("wool_slab", c);
  const cs = colorItem("concrete_stairs", c), cl = colorItem("concrete_slab", c), d = `dye_${key}`;
  shapeless(`wool_dye_${key}`, 1, ["#wool", d], { out: [w, 1], hide: true });
  shapeless(`concrete_mix_${key}`, 8, ["sand", "sand", "sand", "sand", "gravel", "gravel", "gravel", "gravel", d], { out: [cn, 8], hide: true });
  shaped(`stairs_${w}`, 4, ["X  ", "XX ", "XXX"], { X: w }, { out: [ws, 4], hide: true });
  shaped(`slab_${w}`, 6, ["XXX"], { X: w }, { out: [wl, 6], hide: true });
  shaped(`stairs_${cn}`, 4, ["X  ", "XX ", "XXX"], { X: cn }, { out: [cs, 4], hide: true });
  shaped(`slab_${cn}`, 6, ["XXX"], { X: cn }, { out: [cl, 6], hide: true });
  shaped(`cushion_${key}`, 1, ["XXX"], { X: wl }, { out: [colorItem("cushion", c), 1], hide: true });
});

// ---------------------------------------------------------------------
// Etappe 8: Berge, Höhlen, Kirschhain, Mangrovensumpf, Bambuswald, Fossilien
// ---------------------------------------------------------------------
BLOCKS[B.POWDER_SNOW] = def("powder_snow", { lcost: 1, hard: 0.15, tool: "shovel", drop: null, slow: 0.4 });
BLOCKS[B.PACKED_ICE] = def("packed_ice", { solid: true, lcost: 0, hard: 0.75, tool: "pick", drop: null });
BLOCKS[B.CALCITE] = def("calcite", { solid: true, lcost: 3, hard: 0.75, tool: "pick", tier: 1, drop: "calcite" });
BLOCKS[B.TUFF] = def("tuff", { solid: true, lcost: 3, hard: 2.25, tool: "pick", tier: 1, drop: "tuff" });
BLOCKS[B.DRIPSTONE] = def("dripstone", { solid: true, lcost: 3, hard: 2.25, tool: "pick", tier: 1, drop: "dripstone_block" });
BLOCKS[B.STALAGMITE] = def("stalagmite", { hard: 1.5, tool: "pick", tier: 1, drop: "pointed_dripstone" });
BLOCKS[B.STALACTITE] = def("stalactite", { hard: 1.5, tool: "pick", tier: 1, drop: "pointed_dripstone" });
BLOCKS[B.AMETHYST_BLOCK] = def("amethyst_block", { solid: true, lcost: 3, hard: 1.5, tool: "pick", tier: 1, drop: "amethyst_block" });
BLOCKS[B.AMETHYST_CLUSTER] = def("amethyst_cluster", { hard: 1.5, tool: "pick", tier: 1, drop: "amethyst_shard", dropN: [2, 4], emit: 5 });
BLOCKS[B.MOSS_BLOCK] = def("moss_block", { solid: true, lcost: 3, hard: 0.15, drop: "moss_block" });
BLOCKS[B.MOSS_CARPET] = def("moss_carpet", { hard: 0.15, drop: "moss_carpet" });
BLOCKS[B.AZALEA] = def("azalea", { hard: 0.05, drop: "azalea" });
BLOCKS[B.FLOWERING_AZALEA] = def("flowering_azalea", { hard: 0.05, drop: "flowering_azalea" });
BLOCKS[B.AZALEA_LEAVES] = def("azalea_leaves", { lcost: 1, hard: 0.3, drop: null });
BLOCKS[B.FLOWERING_AZALEA_LEAVES] = def("flowering_azalea_leaves", { lcost: 1, hard: 0.3, drop: null });
BLOCKS[B.CAVE_VINES] = def("cave_vines", { hard: 0.05, drop: null, climb: true });
BLOCKS[B.CAVE_VINES_BERRIES] = def("cave_vines_berries", { hard: 0.05, drop: "glow_berries", dropN: [1, 2], climb: true, emit: 14, interact: true });
BLOCKS[B.GLOW_LICHEN] = def("glow_lichen", { hard: 0.2, drop: "glow_lichen", emit: 7 });
BLOCKS[B.CHERRY_LOG] = def("cherry_log", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: "cherry_log" });
BLOCKS[B.CHERRY_LEAVES] = def("cherry_leaves", { lcost: 1, hard: 0.3, drop: null });
BLOCKS[B.PINK_PETALS] = def("pink_petals", { hard: 0.05, drop: "pink_petals" });
BLOCKS[B.MANGROVE_LOG] = def("mangrove_log", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: "mangrove_log" });
BLOCKS[B.MANGROVE_LEAVES] = def("mangrove_leaves", { lcost: 1, hard: 0.3, drop: null });
BLOCKS[B.MANGROVE_ROOTS] = def("mangrove_roots", { solid: true, lcost: 1, hard: 1.1, tool: "axe", drop: "mangrove_roots" });
BLOCKS[B.MUD] = def("mud", { solid: true, lcost: 3, hard: 0.75, tool: "shovel", drop: "mud" });
BLOCKS[B.PROPAGULE] = def("propagule", { hard: 0.05, drop: "mangrove_propagule" });
BLOCKS[B.BAMBOO] = def("bamboo", { hard: 0.3, tool: "axe", drop: "bamboo" });
BLOCKS[B.BAMBOO_BLOCK] = def("bamboo_block", { solid: true, lcost: 3, hard: 3, tool: "axe", drop: "bamboo_block" });
BLOCKS[B.FOSSIL] = def("fossil", { solid: true, lcost: 3, hard: 3, tool: "pick", tier: 1, drop: "bone", dropN: [2, 4] });
/** Erste und letzte Block-ID der Etappe 8 (Bilder: sandbox-art8.js) */
export const FIRST8 = B.POWDER_SNOW, LAST8 = B.FOSSIL;

blockItem("packed_ice", "Gepacktes Eis", B.PACKED_ICE); blockItem("calcite", "Kalzit", B.CALCITE); blockItem("tuff", "Tuff", B.TUFF);
blockItem("dripstone_block", "Tropfsteinblock", B.DRIPSTONE); blockItem("pointed_dripstone", "Spitzer Tropfstein", B.STALAGMITE);
blockItem("amethyst_block", "Amethystblock", B.AMETHYST_BLOCK); item("amethyst_shard", "Amethystscherbe"); blockItem("amethyst_cluster", "Amethystcluster", B.AMETHYST_CLUSTER);
blockItem("moss_block", "Moosblock", B.MOSS_BLOCK); blockItem("moss_carpet", "Moosteppich", B.MOSS_CARPET);
blockItem("azalea", "Azalee", B.AZALEA, { fuel: 5 }); blockItem("flowering_azalea", "Blühende Azalee", B.FLOWERING_AZALEA, { fuel: 5 });
blockItem("azalea_leaves", "Azaleenlaub", B.AZALEA_LEAVES); blockItem("flowering_azalea_leaves", "Blühendes Azaleenlaub", B.FLOWERING_AZALEA_LEAVES);
item("glow_berries", "Glühbeeren", { food: [2, 0.4] }); blockItem("glow_lichen", "Leuchtflechte", B.GLOW_LICHEN);
blockItem("cherry_log", "Kirschholz", B.CHERRY_LOG, { fuel: 15, tags: ["logs"] }); blockItem("cherry_leaves", "Kirschlaub", B.CHERRY_LEAVES); blockItem("pink_petals", "Blütenblätter", B.PINK_PETALS);
blockItem("mangrove_log", "Mangrovenholz", B.MANGROVE_LOG, { fuel: 15, tags: ["logs"] }); blockItem("mangrove_leaves", "Mangrovenlaub", B.MANGROVE_LEAVES);
blockItem("mangrove_roots", "Mangrovenwurzeln", B.MANGROVE_ROOTS, { fuel: 15 }); blockItem("mud", "Schlamm", B.MUD); blockItem("mangrove_propagule", "Mangrovenschössling", B.PROPAGULE);
blockItem("bamboo", "Bambus", B.BAMBOO, { fuel: 5 }); blockItem("bamboo_block", "Bambusholz", B.BAMBOO_BLOCK, { fuel: 15, tags: ["logs"] });
blockItem("fossil", "Fossil", B.FOSSIL);

shaped("packed_ice", 1, ["III", "III", "III"], { I: "ice" });
shaped("amethyst_block", 1, ["SS", "SS"], { S: "amethyst_shard" }); shapeless("amethyst_shard_b", 4, ["amethyst_block"], { out: ["amethyst_shard", 4] });
shaped("moss_carpet", 3, ["MM"], { M: "moss_block" });
shaped("bamboo_block", 1, ["BBB", "BBB", "BBB"], { B: "bamboo" });
shaped("stick_bamboo", 1, ["B", "B"], { B: "bamboo" }, { out: ["stick", 1] });
shapeless("dye_pink_petals", 1, ["pink_petals"], { out: ["dye_pink", 1], hide: true });
SMELT.mangrove_roots = ["charcoal", 0.15]; SMELT.cherry_log = ["charcoal", 0.15]; SMELT.mangrove_log = ["charcoal", 0.15];
