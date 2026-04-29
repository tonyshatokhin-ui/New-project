function constructionTurnsForBuilding(building) {
  const cost = building?.cost ?? 24;
  return Math.max(3, Math.min(7, 2 + Math.ceil(cost / 12)));
}

const BUILDINGS = [
  { id: "storehouse", unique: true, nameKey: "buildingStorehouse", descriptionKey: "buildingStorehouseDesc", cost: 18, apply: (city) => { city.foodCap += 16; } },
  { id: "granary", unique: true, requires: ["storehouse"], requiresResource: "grain", nameKey: "buildingGranary", descriptionKey: "buildingGranaryDesc", cost: 32, apply: (city) => { city.foodCap += 20; city.populationCap += 1; city.modifiers.growthDiscount += 8; } },
  { id: "houses", unique: true, nameKey: "buildingHouses", descriptionKey: "buildingHousesDesc", cost: 28, apply: (city) => { city.populationCap += 2; } },
  { id: "workshop", unique: true, nameKey: "buildingWorkshop", descriptionKey: "buildingWorkshopDesc", cost: 30, apply: (city) => { city.hammerCap += 12; city.modifiers.hammerPerMine += 1; } },
  { id: "market-square", unique: true, nameKey: "buildingMarketSquare", descriptionKey: "buildingMarketSquareDesc", cost: 24, apply: (city) => { city.goldCap += 12; city.modifiers.goldPerMarket += 1; } },
  { id: "shrine", unique: true, requiresResource: "incense", nameKey: "buildingShrine", descriptionKey: "buildingShrineDesc", cost: 30, apply: () => {} },
  { id: "dock", unique: true, requires: ["storehouse"], nameKey: "buildingDock", descriptionKey: "buildingDockDesc", cost: 32, apply: (city) => { city.shipCap += 1; } },
  { id: "training-ground", unique: true, requires: ["workshop"], requiresResource: "copper", nameKey: "buildingTrainingGround", descriptionKey: "buildingTrainingGroundDesc", cost: 42, apply: (city) => { city.soldierCap += 2; city.modifiers.recruitPointsPerBarracks += 0.05; } },
];

const TECHNOLOGIES = [
  { id: "seed-keeping", tier: 1, requiresResource: "grain", nameKey: "techSeedKeeping", descriptionKey: "techSeedKeepingDesc", cost: 60, apply: (state) => { state.player.cities.forEach((city) => { city.modifiers.foodPerField += 1; }); } },
  { id: "copper-tools", tier: 1, requiresResource: "copper", nameKey: "techCopperTools", descriptionKey: "techCopperToolsDesc", cost: 60, apply: (state) => { state.player.cities.forEach((city) => { city.hammerCap += 5; }); } },
  { id: "ancestor-cults", tier: 1, requiresResource: "incense", nameKey: "techAncestorCults", descriptionKey: "techAncestorCultsDesc", cost: 60, apply: (state) => { state.globalBonuses.templeInfluence = 1; } },
  { id: "tax-ledgers", tier: 2, nameKey: "techTaxLedgers", descriptionKey: "techTaxLedgersDesc", cost: 100, apply: (state) => { state.player.cities.forEach((city) => { city.modifiers.goldPerMarket += 1; }); state.globalBonuses.giftDiscount += 5; } },
  { id: "stone-roads", tier: 2, requiresResource: "stone", nameKey: "techStoneRoads", descriptionKey: "techStoneRoadsDesc", cost: 100, apply: (state) => { state.globalBonuses.tradeGoldBonus += 1; state.player.cities.forEach((city) => { city.foodCap += 5; }); } },
  { id: "iron-discipline", tier: 3, requiresResource: "copper", nameKey: "techIronDiscipline", descriptionKey: "techIronDisciplineDesc", cost: 150, apply: (state) => { state.player.cities.forEach((city) => { city.modifiers.recruitPointsPerBarracks += 0.05; city.soldierCap += 1; }); } },
];

const POLICIES = [
  {
    id: "buy-farmland",
    nameKey: "policyBuyFarmland",
    descriptionKey: "policyBuyFarmlandDesc",
    cost: 30,
    effect: (state) => {
      const capital = state.player.cities[0];
      state.player.gold -= 30;
      capital.foodCap += 2;
      capital.modifiers.foodPerField += 1;
      pushLog(state, "policyFarmlandLog", { city: getCityName(capital) });
    },
    available: (state) => state.player.gold >= 30,
  },
  {
    id: "send-gift",
    nameKey: "policySendGift",
    descriptionKey: "policySendGiftDesc",
    cost: 25,
    effect: (state) => {
      const cost = Math.max(10, 25 - state.globalBonuses.giftDiscount);
      state.player.gold -= cost;
      state.world.diplomacy = Math.min(100, state.world.diplomacy + 12);
      state.world.prestige = Math.min(100, state.world.prestige + 5);
      pushLog(state, "policyGiftLog");
    },
    available: (state) => state.player.gold >= Math.max(10, 25 - state.globalBonuses.giftDiscount),
  },
  {
    id: "stabilize-crisis",
    nameKey: "policyCrisisRelief",
    descriptionKey: "policyCrisisReliefDesc",
    cost: 20,
    effect: (state) => {
      state.player.gold -= 20;
      state.world.crisisPressure = Math.max(0, state.world.crisisPressure - 20);
      pushLog(state, "policyReliefLog");
    },
    available: (state) => state.player.gold >= 20 && state.world.crisisPressure > 0,
  },
];

const TRADE_OFFERS = [
  { id: "grain-route", nameKey: "tradeGrainExchange", descriptionKey: "tradeGrainExchangeDesc", shipCost: 1, effect: { gold: 4, food: 2, diplomacy: 1 } },
  { id: "bronze-route", nameKey: "tradeBronzeConvoy", descriptionKey: "tradeBronzeConvoyDesc", shipCost: 1, effect: { gold: 5, hammers: 3, prestige: 1 } },
  { id: "sacred-route", nameKey: "tradeSacredPilgrims", descriptionKey: "tradeSacredPilgrimsDesc", shipCost: 1, effect: { gold: 3, culture: 3, diplomacy: 2 } },
];
