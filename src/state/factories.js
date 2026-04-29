function createCity(nameKey, roleKey, isCapital = false, tileId = null, customName = "") {
  const city = {
    nameKey,
    roleKey,
    directive: "balanced",
    specialization: isCapital ? "agrarian" : "craft",
    isCapital,
    tileId,
    customName,
    population: isCapital ? 6 : 5,
    populationCap: isCapital ? 10 : 8,
    foodStock: isCapital ? 20 : 12,
    foodCap: 20,
    hammerStock: 0,
    hammerCap: 30,
    goldCap: 30,
    soldiers: isCapital ? 1 : 0,
    soldierCap: isCapital ? 3 : 2,
    recruitProgress: 0,
    shipPoints: 0,
    shipCost: 16,
    ships: 0,
    shipCap: 0,
    starvationTurns: 0,
    growthProgress: isCapital ? 8 : 4,
    directiveChangeCount: 0,
    specializationChangeCount: 0,
    workerTrainingTurns: 0,
    assignments: {
      fields: isCapital ? 4 : 4,
      mines: 1,
      temples: 0,
      barracks: 0,
      market: 0,
      ports: 0,
    },
    modifiers: {
      foodPerField: 3,
      hammerPerMine: 2,
      culturePerTemple: 1,
      recruitPointsPerBarracks: 0.1,
      goldPerMarket: 2,
      foodPerPort: 0,
      shipPointsPerPort: 1,
      growthDiscount: 0,
    },
    buildings: [],
    events: [],
  };
  initCitySocial(city);
  return city;
}

function createInitialState() {
  const worldSeed = Math.floor(Math.random() * 1_000_000_000);
  const generatedWorld = generateHexWorld(worldSeed);
  const playerCities = [
    createCity("cityAurelia", "roleCapital", true, generatedWorld.startTileId),
  ];
  const factions = Object.fromEntries(
    Object.values(FACTIONS).map((faction) => [
      faction.id,
      {
        relation: faction.baseRelation,
        contactEstablished: false,
        contactShipCommitted: false,
        tradePact: false,
        allied: false,
        met: false,
      },
    ]),
  );

  const world = {
    diplomacy: 42,
    prestige: 18,
    tradePower: 15,
    warPressure: 12,
    crisisPressure: 8,
    territory: generatedWorld.hexTiles.filter((tile) => tile.owner === "player").length,
    mapWidth: generatedWorld.mapWidth,
    mapHeight: generatedWorld.mapHeight,
    seed: worldSeed,
    startTileId: generatedWorld.startTileId,
    hexTiles: generatedWorld.hexTiles,
    routes: [],
    resourceDeals: [],
    factions,
    units: [],
    pendingEncounter: null,
    nextUnitId: 1,
  };
  revealPlayerTerritory(world, playerCities, WORLD_CONFIG.revealRadius);
  refreshFactionKnowledge(world);

  return {
    turn: 1,
    view: "world",
    selectedCity: playerCities[0].nameKey,
    world,
    player: {
      gold: 30,
      culture: 20,
      technologies: [],
      cities: playerCities,
      resources: {},
    },
    globalBonuses: {
      tradeGoldBonus: 0,
      giftDiscount: 0,
      templeInfluence: 0,
    },
    log: [
      {
        turn: 1,
        textKey: "logStart",
        params: {},
      },
    ],
  };
}

function createScoutUnit(tileId, homeCityKey) {
  return {
    id: "scout-1",
    type: "scout",
    tileId,
    homeCityKey,
    status: "deploying",
    targetTileId: null,
    returnTileId: null,
    soldiers: 1,
  };
}

function createWorkerUnit(tileId, homeCityKey) {
  const unitId = `worker-${state.world.nextUnitId++}`;
  return {
    id: unitId,
    type: "worker",
    tileId,
    homeCityKey,
    status: "idle",
    targetTileId: null,
    taskTileId: null,
    taskTurns: 0,
    taskType: null,
    resourceId: null,
    buildCharges: WORKER_CONFIG.buildCharges,
    soldiers: 0,
  };
}

function createHostileRaiderUnit(tileId, sourceTileId, targetCityKey, strength = 1) {
  const unitId = `raider-${state.world.nextUnitId++}`;
  return {
    id: unitId,
    type: "hostile-raider",
    tileId,
    sourceTileId,
    targetCityKey,
    status: "marching",
    strength,
    soldiers: 0,
  };
}
