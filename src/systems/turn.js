function nextTurn() {
  if (globalThis.state.world.pendingEncounter) return;
  if (typeof turnEventsBlocked === "function" && turnEventsBlocked()) return;
  const turnMetricsBefore = typeof snapshotEmpireTurnMetrics === "function"
    ? snapshotEmpireTurnMetrics()
    : null;
  globalThis.state.turn += 1;
  if (typeof globalThis.playTurnAdvanceSound === "function") globalThis.playTurnAdvanceSound();

  globalThis.state.player.cities.forEach((city) => {
    normalizeCitySocial(city);
    tickSocialSavings(city);
    processSocialMobility(city);
    maybeQueueSocialMobility(city);

    if (city.workerTrainingTurns > 0) {
      city.workerTrainingTurns -= 1;
      if (city.workerTrainingTurns <= 0) {
        const worker = createWorkerUnit(city.tileId, city.nameKey);
        globalThis.state.world.units.push(worker);
        globalThis.uiState.selectedArmyId = worker.id;
        pushLog(globalThis.state, "workerReadyLog", { city: getCityName(city) });
      }
    }

    if (city.settlerTrainingTurns > 0) {
      city.settlerTrainingTurns -= 1;
      if (city.settlerTrainingTurns <= 0) {
        const settler = createSettlerUnit(city.tileId, city.nameKey);
        globalThis.state.world.units.push(settler);
        globalThis.uiState.selectedArmyId = settler.id;
        pushLog(globalThis.state, "settlerReadyLog", { city: getCityName(city) });
      }
    }
    const yieldData = computeCityYield(city);
    const foodNeed = getCityFoodNeed(city);
    const foodDelta = yieldData.food - foodNeed;
    const rawFoodStock = city.foodStock + foodDelta;
    city.foodStock = clamp(rawFoodStock, 0, city.foodCap);
    if (!cityHasBuilding(city, "storehouse") && city.foodStock > 8) {
      city.foodStock = Math.max(0, city.foodStock - Math.floor(city.foodStock * 0.25));
    }
    city.hammerStock = clamp(city.hammerStock + yieldData.hammers, 0, city.hammerCap);
    city.shipPoints += yieldData.shipPoints;

    if (city.shipPoints >= city.shipCost && city.ships < city.shipCap) {
      city.shipPoints -= city.shipCost;
      city.ships += 1;
      pushLog(globalThis.state, "newTradeShip", { city: getCityName(city) });
    }

    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + yieldData.gold);
    globalThis.state.player.culture += yieldData.culture;
    globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + yieldData.templeInfluence);
    globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + (yieldData.prestige || 0));
    globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + (yieldData.diplomacy || 0));
    city.recruitProgress = clamp(city.recruitProgress + yieldData.soldiers, 0, 9.9);
    while (
      city.recruitProgress >= 1
      && city.soldiers < city.soldierCap
      && globalThis.state.player.gold >= getSoldierRecruitGoldCost(city.soldiers + 1)
      && city.foodStock >= getSoldierRecruitFoodCost(city.soldiers + 1)
    ) {
      city.recruitProgress -= 1;
      city.soldiers += 1;
      globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - getSoldierRecruitGoldCost(city.soldiers));
      city.foodStock = Math.max(0, city.foodStock - getSoldierRecruitFoodCost(city.soldiers));
    }

    handleGrowth(city, foodSurplusForCity(yieldData, city));
    handleFoodStatus(city, rawFoodStock);
    normalizeCitySocial(city);
    if (globalThis.state.turn >= 12 || RANDOM_EVENTS_ENABLED) {
      handleCityCrisis(city, foodDelta);
    }
    processCityConstructionQueueAtTurnEnd(city);
  });

  applyTradeIncome();
  processDebtPressure();
  updateWorldPressure();
  processScoutTurn();
  if (typeof processFieldArmyTurn === "function") {
    processFieldArmyTurn();
  }
  processWorkerTurn();
  processHostileFrontier();
  processHostileRaiders();
  revealPlayerTerritory(globalThis.state.world, globalThis.state.player.cities, 1);
  refreshFactionKnowledge(globalThis.state.world);
  if (globalThis.state.turn >= 14 || RANDOM_EVENTS_ENABLED) {
    maybeWorldCrisis();
  }
  if (typeof tickRivalStandingSimulation === "function") {
    tickRivalStandingSimulation();
  }
  if (typeof tryResolveRunOutcome === "function") {
    tryResolveRunOutcome();
  }
  if (typeof rollNarrativeTurnEvents === "function") {
    rollNarrativeTurnEvents();
  }
  if (typeof finalizeTurnEventsForUi === "function") {
    finalizeTurnEventsForUi();
  }
  if (typeof triggerTurnFeedback === "function") {
    triggerTurnFeedback();
  }
  if (turnMetricsBefore && typeof buildTurnSummary === "function") {
    const after = snapshotEmpireTurnMetrics();
    globalThis.state.turnSummary = buildTurnSummary(turnMetricsBefore, after);
    const showSummary =
      typeof turnEventQueueClearForSummary === "function" ? turnEventQueueClearForSummary() : true;
    globalThis.uiState.turnSummaryOpen = Boolean(showSummary);
  }
  if (typeof processMidGamePulse === "function") {
    processMidGamePulse();
  }
  if (typeof maybeFirstContactUiTips === "function") {
    maybeFirstContactUiTips();
  }
  if (typeof hookOnboardingTurnEnded === "function") {
    hookOnboardingTurnEnded();
  }
  globalThis.render();
}

function computeCityYield(city) {
  const totals = JOBS.reduce(
    (total, job) => {
      const next = job.baseYield(city);
      Object.entries(next).forEach(([key, value]) => {
        total[key] = (total[key] || 0) + value;
      });
      return total;
    },
    {
      food: 0,
      hammers: 0,
      culture: 0,
      soldiers: 0,
      gold: 0,
      shipPoints: 0,
      growthBonus: 0,
      diplomacy: 0,
      prestige: 0,
      templeInfluence: city.assignments.temples * globalThis.state.globalBonuses.templeInfluence,
    },
  );
  const directiveBonus = getCityDirective(city).apply(city);
  Object.entries(directiveBonus).forEach(([key, value]) => {
    totals[key] = (totals[key] || 0) + value;
  });
  const specializationBonus = getCitySpecialization(city).apply(city);
  Object.entries(specializationBonus).forEach(([key, value]) => {
    totals[key] = (totals[key] || 0) + value;
  });
  const resourceChainBonus = getResourceChainYield(city);
  Object.entries(resourceChainBonus).forEach(([key, value]) => {
    totals[key] = (totals[key] || 0) + value;
  });
  const resourceBonus = getCapitalResourceYield(city);
  Object.entries(resourceBonus).forEach(([key, value]) => {
    totals[key] = (totals[key] || 0) + value;
  });
  const idleCitizens = Math.max(0, city.population - assignedWorkers(city));
  totals.gold += Math.floor(idleCitizens / 2);
  totals.gold -= getBuildingUpkeep(city);
  totals.gold -= getArmyGoldUpkeep(city.soldiers + getFieldArmySoldiersForCity(city.nameKey));
  if (globalThis.state.player.gold < 0) {
    totals.food -= getDebtFoodPenalty();
  }
  applySocialEffects(city, totals);
  return totals;
}

function getBuildingUpkeep(city) {
  return city.buildings.reduce((sum, buildingId) => sum + buildingUpkeepForId(buildingId), 0);
}

function buildingUpkeepForId(buildingId) {
  const costs = {
    "storehouse": 1,
    "granary": 2,
    "houses": 2,
    "workshop": 5,
    "market-square": 2,
    "shrine": 2,
    "dock": 3,
    "training-ground": 6,
  };
  return costs[buildingId] || 0;
}

function getDebtFoodPenalty() {
  // Debt still hurts, but ramps up slower to avoid instant death spirals.
  return Math.min(2, 1 + Math.floor(Math.max(0, Math.abs(globalThis.state.player.gold) - 1) / 35));
}

function processDebtPressure() {
  if (globalThis.state.player.gold >= 0) return;
  const scouts = globalThis.state.world.units.filter((unit) => unit.type === "scout");
  if (!scouts.length) return;
  const leaveChance = clamp(25 + Math.floor(Math.abs(globalThis.state.player.gold) / 4), 25, 75);
  if (Math.random() * 100 > leaveChance) return;
  const [lostScout] = scouts;
  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== lostScout.id);
  pushLog(globalThis.state, "debtScoutLeave");
  showToast(globalThis.t("debtScoutLeave"), "warn");
}

function handleGrowth(city, foodSurplus) {
  const growthNeed = getGrowthNeed(city);
  const growthGain = getGrowthDelta(foodSurplus, city);
  if (growthGain > 0) {
    city.growthProgress += growthGain;
  } else if (foodSurplus < 0) {
    city.growthProgress = Math.max(0, city.growthProgress - 1);
  }

  while (city.growthProgress >= growthNeed && city.population < city.populationCap) {
    city.growthProgress -= growthNeed;
    city.population += 1;
    pushLog(globalThis.state, "cityGrowth", { city: getCityName(city), population: city.population });
  }

  if (city.population >= city.populationCap) {
    city.growthProgress = Math.min(city.growthProgress, growthNeed - 1);
  }
}

function handleFoodStatus(city, rawFoodStock) {
  city.events = [];
  if (rawFoodStock < 0) {
    city.starvationTurns += 1;
    city.events.push(globalThis.t("eventHunger"));
  } else {
    city.starvationTurns = 0;
  }

  if (city.starvationTurns > 3 && city.population > 1) {
    city.population -= 1;
    city.starvationTurns = 0;
    unassignOverflow(city);
    pushLog(globalThis.state, "famineLoss", { city: getCityName(city) });
  }
}

function handleCityCrisis(city, foodDelta) {
  let risk = 0;
  if (foodDelta < 0) risk += 25;
  if (city.population >= city.populationCap) risk += 25;
  if (globalThis.state.player.gold < 10) risk += 10;
  if (city.soldiers < Math.ceil(city.population / 3)) risk += 10;
  if (activeShipsForCity(city.nameKey) > 0) risk += 5 * activeShipsForCity(city.nameKey);
  risk += Math.floor(globalThis.state.world.crisisPressure / 5);

  if (Math.random() * 100 <= risk) {
    triggerCityCrisis(city);
  }
}

function triggerCityCrisis(city) {
  const crisisPool = [
    {
      canPay: () => globalThis.state.player.gold >= 12,
      pay: () => {
        globalThis.state.player.gold -= 12;
        city.events.push(globalThis.t("eventRiotCalmed"));
        pushLog(globalThis.state, "foodRiotPaid", { city: getCityName(city) });
      },
      fail: () => {
        if (city.population > 1) city.population -= 1;
        unassignOverflow(city);
        pushLog(globalThis.state, "unrestLoss", { city: getCityName(city) });
      },
    },
    {
      canPay: () => globalThis.state.player.gold >= 10,
      pay: () => {
        globalThis.state.player.gold -= 10;
        city.events.push(globalThis.t("eventHealers"));
        pushLog(globalThis.state, "epidemicPaid", { city: getCityName(city) });
      },
      fail: () => {
        if (city.population > 1) city.population -= 1;
        unassignOverflow(city);
        pushLog(globalThis.state, "diseaseLoss", { city: getCityName(city) });
      },
    },
    {
      canPay: () => globalThis.state.player.gold >= 8,
      pay: () => {
        globalThis.state.player.gold -= 8;
        city.events.push(globalThis.t("eventRaidPaid"));
        pushLog(globalThis.state, "raidPaid", { city: getCityName(city) });
      },
      fail: () => {
        const hammerLoss = Math.min(10, city.hammerStock);
        city.hammerStock -= hammerLoss;
        if (!hammerLoss && city.population > 1) {
          city.population -= 1;
          unassignOverflow(city);
        }
        pushLog(globalThis.state, "raidLoss", { city: getCityName(city), amount: hammerLoss || 1 });
      },
    },
  ];
  const crisis = crisisPool[Math.floor(Math.random() * crisisPool.length)];
  if (crisis.canPay()) crisis.pay();
  else crisis.fail();
  globalThis.state.world.crisisPressure = Math.min(100, globalThis.state.world.crisisPressure + 6);
}

function applyTradeIncome() {
  Object.entries(globalThis.state.world.factions).forEach(([factionId, factionState]) => {
    if (!factionState.tradePact) return;
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + 3);
    globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 1);
    factionState.relation = Math.min(100, factionState.relation + 1);
  });
  globalThis.state.world.routes.forEach((route) => {
    const sourceCity = globalThis.state.player.cities.find((item) => item.nameKey === route.cityKey);
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - (route.upkeepGold || 1));
    if (route.blockedTurns > 0) {
      route.blockedTurns -= 1;
      return;
    }
    const disruptionChance = getRouteDisruptionChance(route);
    if (Math.random() * 100 < disruptionChance) {
      route.blockedTurns = 1;
      pushLog(globalThis.state, "routeDisruptedLog", { route: globalThis.t(route.nameKey), city: getCityNameByKey(route.cityKey) });
      showToast(globalThis.t("routeDisruptedToast", { route: globalThis.t(route.nameKey) }), "warn");
      return;
    }
    const marketPenalty = sourceCity && !cityHasBuilding(sourceCity, "market-square") ? 1 : 0;
    const routeGold = route.effect.gold + globalThis.state.globalBonuses.tradeGoldBonus - marketPenalty;
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + routeGold);
    if (route.effect.food) {
      if (sourceCity) sourceCity.foodStock = clamp(sourceCity.foodStock + route.effect.food, 0, sourceCity.foodCap);
    }
    if (route.effect.hammers) {
      if (sourceCity) sourceCity.hammerStock = clamp(sourceCity.hammerStock + route.effect.hammers, 0, sourceCity.hammerCap);
    }
    if (route.effect.culture) globalThis.state.player.culture += route.effect.culture;
    if (route.effect.diplomacy) globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + route.effect.diplomacy);
    if (route.effect.prestige) globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + route.effect.prestige);
  });
  globalThis.state.world.resourceDeals.forEach((deal) => {
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + deal.gold);
    const factionState = globalThis.state.world.factions[deal.factionId];
    if (factionState) {
      factionState.relation = Math.min(100, factionState.relation + deal.diplomacy);
    }
    globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + deal.diplomacy);
  });
}

function updateWorldPressure() {
  const cityCount = globalThis.state.player.cities.length;
  globalThis.state.world.tradePower = globalThis.state.world.routes.length * 6 + sumCities((city) => city.assignments.market + city.assignments.ports);
  globalThis.state.world.warPressure = Math.max(0, 10 + cityCount * 2 - Math.floor(totalSoldiers() / 3));
  globalThis.state.world.crisisPressure = clamp(
    globalThis.state.world.crisisPressure + Math.max(0, cityCount - 2) + (globalThis.state.world.warPressure > 15 ? 4 : -2),
    0,
    100,
  );
}

function maybeWorldCrisis() {
  const chance = globalThis.state.world.crisisPressure + globalThis.state.world.warPressure / 2;
  if (Math.random() * 100 > chance) return;
  const outcomes = [
    () => {
      if (globalThis.state.player.gold >= 20) {
        globalThis.state.player.gold -= 20;
        pushLog(globalThis.state, "worldUnrestPaid");
      } else {
        const city = weakestCity();
        if (city && city.population > 1) {
          city.population -= 1;
          unassignOverflow(city);
          pushLog(globalThis.state, "worldCrisisLoss", { city: getCityName(city) });
        }
      }
    },
    () => {
      globalThis.state.world.diplomacy = Math.max(0, globalThis.state.world.diplomacy - 8);
      pushLog(globalThis.state, "rumorLoss");
    },
    () => {
      if (globalThis.state.world.routes.length) {
        const lost = globalThis.state.world.routes.shift();
        pushLog(globalThis.state, "stormLoss", { route: globalThis.t(lost.nameKey) });
      } else {
        globalThis.state.world.prestige = Math.max(0, globalThis.state.world.prestige - 5);
        pushLog(globalThis.state, "failedCeremony");
      }
    },
  ];
  outcomes[Math.floor(Math.random() * outcomes.length)]();
}

Object.assign(globalThis, {
  nextTurn,
  computeCityYield,
  getBuildingUpkeep,
  buildingUpkeepForId,
  getDebtFoodPenalty,
  processDebtPressure,
  handleGrowth,
  handleFoodStatus,
  handleCityCrisis,
  triggerCityCrisis,
  applyTradeIncome,
  updateWorldPressure,
  maybeWorldCrisis,
});
