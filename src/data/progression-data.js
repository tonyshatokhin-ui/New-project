function constructionTurnsForBuilding(building) {
  const cost = building?.cost ?? 24;
  return Math.max(4, Math.min(11, 2 + Math.ceil(cost / 32)));
}

/** Must mirror `apply`; used when reversing building loss (`hostiles.js`). Kept numeric for save compatibility. */
const BUILDING_REVERSALS = Object.freeze({
  storehouse: { foodCap: 28, hammerCap: 118 },
  granary: { foodCap: 36, populationCap: 3, growthDiscount: 14 },
  houses: { populationCap: 5 },
  workshop: { hammerCap: 320, hammerPerMine: 2 },
  "market-square": { goldCap: 48, goldPerMarket: 4 },
  shrine: { culturePerTemple: 2 },
  dock: { shipCap: 3 },
  "training-ground": { soldierCap: 8, recruitPointsPerBarracks: 0.1 },
});

const BUILDINGS = [
  {
    id: "storehouse",
    unique: true,
    nameKey: "buildingStorehouse",
    descriptionKey: "buildingStorehouseDesc",
    cost: 40,
    apply: (city) => {
      city.foodCap += 28;
      city.hammerCap += BUILDING_REVERSALS.storehouse.hammerCap;
    },
  },
  {
    id: "granary",
    unique: true,
    requires: ["storehouse"],
    requiresResource: "grain",
    nameKey: "buildingGranary",
    descriptionKey: "buildingGranaryDesc",
    cost: 165,
    apply: (city) => {
      city.foodCap += 36;
      city.populationCap += 3;
      city.modifiers.growthDiscount += 14;
    },
  },
  {
    id: "houses",
    unique: true,
    nameKey: "buildingHouses",
    descriptionKey: "buildingHousesDesc",
    cost: 110,
    apply: (city) => {
      city.populationCap += 5;
    },
  },
  {
    id: "workshop",
    unique: true,
    nameKey: "buildingWorkshop",
    descriptionKey: "buildingWorkshopDesc",
    cost: 132,
    apply: (city) => {
      city.hammerCap += BUILDING_REVERSALS.workshop.hammerCap;
      city.modifiers.hammerPerMine += BUILDING_REVERSALS.workshop.hammerPerMine;
    },
  },
  {
    id: "market-square",
    unique: true,
    nameKey: "buildingMarketSquare",
    descriptionKey: "buildingMarketSquareDesc",
    cost: 205,
    apply: (city) => {
      city.goldCap += BUILDING_REVERSALS["market-square"].goldCap;
      city.modifiers.goldPerMarket += BUILDING_REVERSALS["market-square"].goldPerMarket;
    },
  },
  {
    id: "shrine",
    unique: true,
    requiresResource: "incense",
    nameKey: "buildingShrine",
    descriptionKey: "buildingShrineDesc",
    cost: 188,
    apply: (city) => {
      city.modifiers.culturePerTemple += BUILDING_REVERSALS.shrine.culturePerTemple;
    },
  },
  {
    id: "dock",
    unique: true,
    requires: ["storehouse"],
    nameKey: "buildingDock",
    descriptionKey: "buildingDockDesc",
    cost: 178,
    apply: (city) => {
      city.shipCap += BUILDING_REVERSALS.dock.shipCap;
    },
  },
  {
    id: "training-ground",
    unique: true,
    requires: ["workshop"],
    requiresResource: "copper",
    nameKey: "buildingTrainingGround",
    descriptionKey: "buildingTrainingGroundDesc",
    cost: 352,
    apply: (city) => {
      city.soldierCap += BUILDING_REVERSALS["training-ground"].soldierCap;
      city.modifiers.recruitPointsPerBarracks +=
        BUILDING_REVERSALS["training-ground"].recruitPointsPerBarracks;
    },
  },
];

const TECHNOLOGIES = [
  {
    id: "seed-keeping",
    tier: 1,
    requiresResource: "grain",
    nameKey: "techSeedKeeping",
    descriptionKey: "techSeedKeepingDesc",
    cost: 198,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.modifiers.foodPerField += 2;
      });
    },
  },
  {
    id: "copper-tools",
    tier: 1,
    requiresResource: "copper",
    nameKey: "techCopperTools",
    descriptionKey: "techCopperToolsDesc",
    cost: 225,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.hammerCap += 62;
      });
    },
  },
  {
    id: "ancestor-cults",
    tier: 1,
    requiresResource: "incense",
    nameKey: "techAncestorCults",
    descriptionKey: "techAncestorCultsDesc",
    cost: 210,
    apply: (g) => {
      g.globalBonuses.templeInfluence = (g.globalBonuses.templeInfluence || 0) + 1;
    },
  },
  {
    id: "tax-ledgers",
    tier: 2,
    nameKey: "techTaxLedgers",
    descriptionKey: "techTaxLedgersDesc",
    cost: 318,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.modifiers.goldPerMarket += 2;
      });
      g.globalBonuses.giftDiscount = (g.globalBonuses.giftDiscount || 0) + 8;
    },
  },
  {
    id: "stone-roads",
    tier: 2,
    requiresResource: "stone",
    nameKey: "techStoneRoads",
    descriptionKey: "techStoneRoadsDesc",
    cost: 335,
    apply: (g) => {
      g.globalBonuses.tradeGoldBonus = (g.globalBonuses.tradeGoldBonus || 0) + 2;
      g.player.cities.forEach((city) => {
        city.foodCap += 14;
      });
    },
  },
  {
    id: "clan-migration",
    tier: 2,
    nameKey: "techClanMigration",
    descriptionKey: "techClanMigrationDesc",
    cost: 302,
    apply: (g) => {
      g.globalBonuses.foundCityGoldDiscount = (g.globalBonuses.foundCityGoldDiscount || 0) + 5;
      g.globalBonuses.foundCityFoodDiscount = (g.globalBonuses.foundCityFoodDiscount || 0) + 4;
    },
  },
  {
    id: "harbor-masters",
    tier: 2,
    requiresResource: "fish",
    nameKey: "techHarborMasters",
    descriptionKey: "techHarborMastersDesc",
    cost: 288,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.modifiers.shipPointsPerPort += 1;
        city.modifiers.foodPerPort += 1;
      });
    },
  },
  {
    id: "equine-relays",
    tier: 2,
    requiresResource: "horses",
    nameKey: "techEquineRelays",
    descriptionKey: "techEquineRelaysDesc",
    cost: 298,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.modifiers.goldPerMarket += 2;
        city.goldCap += 26;
      });
    },
  },
  {
    id: "smelt-pits",
    tier: 2,
    requiresResource: "iron",
    nameKey: "techSmeltPits",
    descriptionKey: "techSmeltPitsDesc",
    cost: 342,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.hammerCap += 52;
      });
    },
  },
  {
    id: "ritual-calendar",
    tier: 2,
    requiresResource: "incense",
    requiresTechIds: ["ancestor-cults"],
    nameKey: "techRitualCalendar",
    descriptionKey: "techRitualCalendarDesc",
    cost: 365,
    apply: (g) => {
      g.globalBonuses.templeInfluence = (g.globalBonuses.templeInfluence || 0) + 1;
    },
  },
  {
    id: "iron-discipline",
    tier: 3,
    requiresResource: "copper",
    nameKey: "techIronDiscipline",
    descriptionKey: "techIronDisciplineDesc",
    cost: 448,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.modifiers.recruitPointsPerBarracks += 0.12;
        city.soldierCap += 5;
      });
    },
  },
  {
    id: "legion-codex",
    tier: 3,
    requiresResource: "copper",
    requiresTechIds: ["iron-discipline"],
    nameKey: "techLegionCodex",
    descriptionKey: "techLegionCodexDesc",
    cost: 512,
    apply: (g) => {
      g.player.cities.forEach((city) => {
        city.modifiers.recruitPointsPerBarracks += 0.1;
        city.soldierCap += 5;
      });
    },
  },
];

const POLICIES = [
  {
    id: "buy-farmland",
    nameKey: "policyBuyFarmland",
    descriptionKey: "policyBuyFarmlandDesc",
    cost: 38,
    effect: (g) => {
      if (g.globalBonuses.buyFarmlandUsed) return;
      const capital = g.player.cities[0];
      if (!capital) return;
      g.globalBonuses.buyFarmlandUsed = true;
      g.player.gold -= 38;
      capital.foodCap += 2;
      pushLog(g, "policyFarmlandLog", { city: getCityName(capital) });
    },
    available: (g) =>
      !g.globalBonuses.buyFarmlandUsed
      && g.player.gold >= 38
      && g.player.cities.length > 0,
  },
  {
    id: "stabilize-crisis",
    nameKey: "policyCrisisRelief",
    descriptionKey: "policyCrisisReliefDesc",
    cost: 22,
    effect: (g) => {
      g.player.gold -= 22;
      g.world.crisisPressure = Math.max(0, g.world.crisisPressure - 14);
      pushLog(g, "policyReliefLog");
    },
    available: (g) => g.player.gold >= 22 && g.world.crisisPressure > 0,
  },
  {
    id: "frontier-charter",
    nameKey: "policyFrontierCharter",
    descriptionKey: "policyFrontierCharterDesc",
    cost: 28,
    effect: (g) => {
      if (g.globalBonuses.frontierCharter) return;
      g.player.gold = clampGoldBalance(g.player.gold - 28);
      g.globalBonuses.frontierCharter = true;
      g.globalBonuses.foundCityGoldDiscount += 3;
      g.globalBonuses.foundCityFoodDiscount += 2;
      pushLog(g, "policyFrontierCharterLog");
    },
    available: (g) =>
      !g.globalBonuses.frontierCharter
      && g.player.technologies.includes("clan-migration")
      && g.player.gold >= 28,
  },
];

const TRADE_OFFERS = [
  { id: "grain-route", nameKey: "tradeGrainExchange", descriptionKey: "tradeGrainExchangeDesc", shipCost: 1, effect: { gold: 4, food: 2, diplomacy: 1 } },
  { id: "bronze-route", nameKey: "tradeBronzeConvoy", descriptionKey: "tradeBronzeConvoyDesc", shipCost: 1, effect: { gold: 5, hammers: 2, prestige: 1 } },
  { id: "sacred-route", nameKey: "tradeSacredPilgrims", descriptionKey: "tradeSacredPilgrimsDesc", shipCost: 1, effect: { gold: 3, culture: 3, diplomacy: 2 } },
];

Object.assign(globalThis, {
  constructionTurnsForBuilding,
  BUILDING_REVERSALS,
  BUILDINGS,
  TECHNOLOGIES,
  POLICIES,
  TRADE_OFFERS,
});
