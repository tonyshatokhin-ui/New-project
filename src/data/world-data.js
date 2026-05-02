const FACTIONS = {
  riverClans: {
    id: "riverClans",
    name: "River Clans",
    description: "Loose agrarian tribes controlling the fertile inland routes.",
    baseRelation: 32,
    capitalNameKey: "cityMoonDelta",
  },
  groveKeepers: {
    id: "groveKeepers",
    name: "Grove Keepers",
    description: "Sacred custodians whose approval shapes culture and legitimacy.",
    baseRelation: 44,
    capitalNameKey: "cityOliveGrove",
  },
  seaKingdom: {
    id: "seaKingdom",
    name: "Sea Kingdom",
    description: "A stern maritime realm guarding the coast and mountain pass.",
    baseRelation: 24,
    capitalNameKey: "cityShellBay",
  },
};

const WORLD_CONFIG = {
  /** Original prototype-scale map (~⅓ hex count vs expanded 26×18). */
  width: 13,
  height: 12,
  /** Flat-top hex radius (center → vertex). Width = 2r, height = √3·r — odd-q offset coords place tiles edge-to-edge. */
  hexFlatRadiusPx: 32,
  revealRadius: 2,
  startingTerritoryRadius: 1,
  frontierRevealPerTurn: 1,
  /** Player capital anchor near center (axial coordinates). */
  playerStart: { q: 6, r: 5 },
};

/** Hostile tribes, raids, scout tension (`src/systems/hostiles.js`, `scout-worker.js`). */
const FRONTIER_HOSTILE_CONFIG = {
  /** Extra hostile encounter chance per existing hostile tile (capped). */
  scoutHostileChancePerExistingTile: 0.014,
  scoutHostileChanceCapBonus: 0.09,
  /** Armies on neighboring hexes slow escalation and reduce raid rolls. */
  suppressedRaidChanceMultiplier: 0.32,
  suppressedEscalationPenalty: 1,
  /** Field army assault on a hostile tile after marching in from player land. */
  assaultWinChanceBase: 34,
  assaultWinChancePerPowerRatio: 30,
  assaultCasualtyChanceScale: 0.07,
  /** Punitive raid when an army camps on a hex adjacent to this hostile tile. */
  punitiveRaidAdjacentArmyBonus: 14,
  /** Gold tribute: soften tribe without full pacify (fraction of full pacify cost). */
  tributeCalmCostFraction: 0.48,
  tributeCalmGoldFloor: 5,
};

/** Scout exploration events (`src/systems/scout-worker.js`). */
const SCOUT_ENCOUNTER_CONFIG = {
  /** Share of the former “peaceful encounter” band that becomes a caravan (rolled inside friendly slice). */
  traderShareOfPeaceful: 0.24,
  ruinsShareOfPeaceful: 0.22,
  /** Beast fight: win / wound / death — relative weights after choosing fight. */
  beastWinWeight: 0.4,
  beastWoundWeight: 0.32,
  beastTrophyFood: 5,
  beastTrophyPrestige: 3,
  woundTurns: 2,
  woundHostileOddsPenalty: 12,
  woundFoodCost: 3,
  /** Pay tribe to avoid clash (gold). */
  passageGoldBase: 7,
  passageGoldPerTribeStrength: 3,
  /** Chance retreat becomes a lighter hostile tile instead of full anger. */
  fleeSoftHostileChance: 0.44,
  /** Trader: cost and yields. */
  traderBuyGoldCost: 10,
  traderBuyFood: 10,
  traderBuyCulture: 5,
  traderDeclineDiplomacy: 4,
  /** Ruins search outcomes (rolled in resolve). */
  ruinsSearchHammer: 6,
  ruinsSearchGold: 14,
  ruinsSearchCulture: 10,
  ruinsSearchPrestige: 5,
  ruinsBadCrisis: 7,
  /** Lurking beast on tile — hunt rewards / casualties (`combat-resolve.js` handles win %). */
  wildBeastHuntFoodTrophy: 4,
  wildBeastHuntCasualtyScale: 0.065,
};

/**
 * Unit archetypes & combat tuning (`src/systems/combat-resolve.js`).
 * attack/defense: multipliers on abstract “fighting value”; vs: vs opponent archetype id; terrain: per-terrain tweaks.
 */
const UNIT_ARCHETYPES = {
  line: {
    attack: 1.06,
    defense: 1.08,
    vs: { tribal: 1.06, beast: 1.12, raider: 1.05, scout: 1 },
    terrain: {
      hill: { defense: 1.1 },
      forest: { defense: 1.08, attack: 0.97 },
      mountain: { defense: 1.12, attack: 0.94 },
      plain: { attack: 1.06 },
      river: { defense: 1.04 },
      coast: { attack: 1.02, defense: 1.03 },
    },
  },
  skirmisher: {
    attack: 1.14,
    defense: 0.93,
    vs: { tribal: 1.08, beast: 1.2, raider: 1.12 },
    terrain: {
      forest: { attack: 1.12, defense: 1.06 },
      hill: { attack: 1.06 },
      plain: { attack: 1.08 },
    },
  },
  scout: {
    attack: 0.84,
    defense: 0.76,
    vs: { tribal: 1.14, beast: 0.9, raider: 0.95 },
    terrain: {
      forest: { attack: 1.12, defense: 1.06 },
      hill: { attack: 1.05 },
      river: { attack: 1.08 },
    },
  },
  raider: {
    attack: 1.12,
    defense: 0.94,
    vs: { line: 1.06, skirmisher: 0.94, scout: 1.08 },
    terrain: {
      plain: { attack: 1.08 },
      forest: { attack: 1.06 },
      hill: { attack: 1.04 },
    },
  },
  tribal: {
    attack: 1,
    defense: 1.14,
    vs: { scout: 1.08, line: 1.03, skirmisher: 0.98 },
    terrain: {
      hill: { defense: 1.12 },
      forest: { defense: 1.1 },
      mountain: { defense: 1.08 },
    },
  },
  beast: {
    attack: 1.18,
    defense: 0.82,
    vs: { scout: 1.15, line: 1.06, skirmisher: 1.04 },
    terrain: {
      forest: { attack: 1.1, defense: 1.08 },
      mountain: { defense: 1.12 },
    },
  },
};

/** Engagement ids → win% = clamp(round(base + ratio * ratioScale), min, max); ratio = atkEff / defEff. */
const COMBAT_RULES = {
  prestigeAttackBonus: 0.06,
  /** Any city with training-ground: multiplier on imperial “virtual” attacks (raid / intercept). */
  empireDisciplineBonus: 1.04,
  engagements: {
    beast_hunt: { base: 10, ratioScale: 34, min: 18, max: 92 },
    tribal_assault: { base: 12, ratioScale: 32, min: 20, max: 90 },
    raider_field: { base: 14, ratioScale: 30, min: 25, max: 92 },
    raider_intercept: { base: 12, ratioScale: 32, min: 25, max: 90 },
    punitive_raid: { base: 14, ratioScale: 28, min: 22, max: 94 },
    scout_vs_tribal: { base: 16, ratioScale: 38, min: 10, max: 86 },
  },
};

const WORKER_CONFIG = {
  trainingCostGold: 10,
  trainingTurns: 3,
  extractionTurns: 2,
  enclosureTurns: 2,
  buildCharges: 2,
};

/** Field armies & frontier settlers (`src/systems/army-field.js`). */
const ARMY_SETTLER_CONFIG = {
  settlerTrainingCostGold: 22,
  settlerTrainingTurns: 4,
  maxPlayerCities: 5,
  maxSettlersOnMap: 2,
  /** Gold paid from empire treasury when planting a frontier city (before discounts). */
  foundCityCostGold: 20,
  /** Food taken from the city that trained the settler when founding (stock), before discounts. */
  foundCityCostFood: 9,
  /** Minimum treasury cost after Clan Migration / charter discounts. */
  foundCityCostGoldFloor: 8,
  /** Minimum food drawn from training city after discounts. */
  foundCityCostFoodFloor: 4,
  /** Soldiers that do not fit the garrison: each contributes this much recruit progress until cap 9.9. */
  mergeSpillRecruitProgressPerSoldier: 0.5,
  /** Remaining spill after recruit buffer is exhausted: gold per soldier. */
  mergeSpillGoldPerRemainderSoldier: 4,
};

const RESOURCE_DEFS = {
  copper: { nameKey: "bonusCopperVein", glyph: "Cu", exportGold: 5, exportDiplomacy: 1, extractable: true },
  grain: { nameKey: "bonusRichFields", glyph: "Gr", exportGold: 4, exportDiplomacy: 1, extractable: true },
  incense: { nameKey: "bonusCultureSite", glyph: "In", exportGold: 6, exportDiplomacy: 2, extractable: true },
  horses: { nameKey: "bonusHorsePastures", glyph: "Ho", exportGold: 5, exportDiplomacy: 1, extractable: true },
  iron: { nameKey: "bonusIronDeposit", glyph: "Fe", exportGold: 6, exportDiplomacy: 1, extractable: true },
  fish: { nameKey: "bonusFishShoals", glyph: "Fi", exportGold: 4, exportDiplomacy: 1, extractable: true },
  stone: { nameKey: "bonusStoneOutcrop", glyph: "St", exportGold: 4, exportDiplomacy: 0, extractable: true },
  harbor: { nameKey: "bonusTradePort", glyph: "Ha", exportGold: 0, exportDiplomacy: 0, extractable: false },
};

const RESOURCE_RULES = {
  grain: { effectKey: "resourceEffectGrain", unlocksBuildings: ["granary"], unlocksTechs: ["seed-keeping"], synergyKey: "resourceSynergyGrain" },
  copper: {
    effectKey: "resourceEffectCopper",
    unlocksBuildings: ["training-ground"],
    unlocksTechs: ["copper-tools", "iron-discipline", "legion-codex"],
    synergyKey: "resourceSynergyCopper",
  },
  incense: {
    effectKey: "resourceEffectIncense",
    unlocksBuildings: ["shrine"],
    unlocksTechs: ["ancestor-cults", "ritual-calendar"],
    synergyKey: "resourceSynergyIncense",
  },
  stone: { effectKey: "resourceEffectStone", unlocksTechs: ["stone-roads"], synergyKey: "resourceSynergyStone" },
  fish: { effectKey: "resourceEffectFish", unlocksTechs: ["harbor-masters"], synergyKey: "resourceSynergyFish" },
  horses: { effectKey: "resourceEffectHorses", unlocksTechs: ["equine-relays"], synergyKey: "resourceSynergyHorses" },
  iron: { effectKey: "resourceEffectIron", unlocksTechs: ["smelt-pits"], synergyKey: "resourceSynergyIron" },
  harbor: { effectKey: "resourceEffectHarbor", synergyKey: "resourceSynergyHarbor" },
};

Object.assign(globalThis, {
  FACTIONS,
  WORLD_CONFIG,
  FRONTIER_HOSTILE_CONFIG,
  SCOUT_ENCOUNTER_CONFIG,
  UNIT_ARCHETYPES,
  COMBAT_RULES,
  WORKER_CONFIG,
  ARMY_SETTLER_CONFIG,
  RESOURCE_DEFS,
  RESOURCE_RULES,
});
