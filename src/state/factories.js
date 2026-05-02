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
    /** Base hammer storage; Storehouse boosts cap so you can save for Workshop; Workshop adds hundreds. Copper Tools stacks. */
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
    settlerTrainingTurns: 0,
    assignments: {
      fields: isCapital ? 4 : 4,
      mines: 1,
      temples: 0,
      barracks: 0,
      market: 0,
      ports: 0,
    },
    modifiers: {
      /* Base 4: early fields + specialization clear food need without forcing growth directive every turn */
      foodPerField: 4,
      hammerPerMine: 1,
      culturePerTemple: 1,
      recruitPointsPerBarracks: 0.1,
      goldPerMarket: 3,
      foodPerPort: 0,
      shipPointsPerPort: 1,
      growthDiscount: 0,
    },
    buildings: [],
    buildQueue: [],
    events: [],
  };
  initCitySocial(city);
  return city;
}

function rivalEmpireStandingAtStart(worldSeed, factionId) {
  let h = worldSeed >>> 0;
  for (let i = 0; i < factionId.length; i++) {
    h = (((h ^ factionId.charCodeAt(i)) * 9176) >>> 0) % 2147483629;
  }
  return 124 + (h % 26);
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
    /** Simulated “empire vigor” rivals use in the standings race (deterministic start from seed). */
    rivalEmpireStanding: Object.fromEntries(
      Object.values(FACTIONS).map((faction) => [
        faction.id,
        rivalEmpireStandingAtStart(worldSeed, faction.id),
      ]),
    ),
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
    /** Last resolved turn delta summary for UI (`pulse-and-summary.js`). */
    turnSummary: null,
    /** null | "victory" — run-level outcome (sandbox can continue after victory). */
    runOutcome: null,
    /** Turn when victory was triggered (when runOutcome is set). */
    runOutcomeTurn: null,
    /** Narrative modal queue (`turn-events.js`). */
    pendingTurnEvent: null,
    turnEventQueue: [],
    turnEventMeta: { lastFamineTurn: -999, lastRaidTurn: -999 },
    view: "world",
    selectedCity: playerCities[0].nameKey,
    world,
    player: {
      gold: 30,
      /** Enough to feel like a court archive, but tier-1 discoveries still need shrines/temples churning. */
      culture: 150,
      technologies: [],
      cities: playerCities,
      resources: {},
    },
    globalBonuses: {
      tradeGoldBonus: 0,
      giftDiscount: 0,
      templeInfluence: 0,
      foundCityGoldDiscount: 0,
      foundCityFoodDiscount: 0,
      frontierCharter: false,
      buyFarmlandUsed: false,
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
    archetype: "scout",
    modifiers: [],
    tileId,
    homeCityKey,
    status: "deploying",
    targetTileId: null,
    returnTileId: null,
    soldiers: 1,
    woundTurns: 0,
  };
}

function createWorkerUnit(tileId, homeCityKey) {
  const unitId = `worker-${globalThis.state.world.nextUnitId++}`;
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

/** Name keys must exist in i18n; used when founding colonies. */
function createArmyUnit(tileId, homeCityKey, soldiers, archetype = "line") {
  const unitId = `army-${globalThis.state.world.nextUnitId++}`;
  return {
    id: unitId,
    type: "army",
    archetype,
    modifiers: [],
    tileId,
    homeCityKey,
    status: "idle",
    targetTileId: null,
    soldiers: Math.max(1, Math.floor(Number(soldiers)) || 0),
  };
}

function createSettlerUnit(tileId, homeCityKey) {
  const unitId = `settler-${globalThis.state.world.nextUnitId++}`;
  return {
    id: unitId,
    type: "settler",
    tileId,
    homeCityKey,
    status: "idle",
    targetTileId: null,
    soldiers: 0,
  };
}

function createHostileRaiderUnit(tileId, sourceTileId, targetCityKey, strength = 1) {
  const unitId = `raider-${globalThis.state.world.nextUnitId++}`;
  return {
    id: unitId,
    type: "hostile-raider",
    archetype: "raider",
    modifiers: [],
    tileId,
    sourceTileId,
    targetCityKey,
    status: "marching",
    strength,
    soldiers: 0,
  };
}

Object.assign(globalThis, {
  createCity,
  rivalEmpireStandingAtStart,
  createInitialState,
  createScoutUnit,
  createWorkerUnit,
  createArmyUnit,
  createSettlerUnit,
  createHostileRaiderUnit,
});
