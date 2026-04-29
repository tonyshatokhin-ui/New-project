function nextTurn() {
  if (state.world.pendingEncounter) return;
  state.turn += 1;

  state.player.cities.forEach((city) => {
    normalizeCitySocial(city);
    processSocialMobility(city);
    maybeQueueSocialMobility(city);

    if (city.workerTrainingTurns > 0) {
      city.workerTrainingTurns -= 1;
      if (city.workerTrainingTurns <= 0) {
        const worker = createWorkerUnit(city.tileId, city.nameKey);
        state.world.units.push(worker);
        uiState.selectedArmyId = worker.id;
        pushLog(state, "workerReadyLog", { city: getCityName(city) });
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
      pushLog(state, "newTradeShip", { city: getCityName(city) });
    }

    state.player.gold = clampGoldBalance(state.player.gold + yieldData.gold);
    state.player.culture += yieldData.culture;
    state.world.prestige = Math.min(100, state.world.prestige + yieldData.templeInfluence);
    state.world.prestige = Math.min(100, state.world.prestige + (yieldData.prestige || 0));
    state.world.diplomacy = Math.min(100, state.world.diplomacy + (yieldData.diplomacy || 0));
    city.recruitProgress = clamp(city.recruitProgress + yieldData.soldiers, 0, 9.9);
    while (
      city.recruitProgress >= 1
      && city.soldiers < city.soldierCap
      && state.player.gold >= getSoldierRecruitGoldCost(city.soldiers + 1)
      && city.foodStock >= getSoldierRecruitFoodCost(city.soldiers + 1)
    ) {
      city.recruitProgress -= 1;
      city.soldiers += 1;
      state.player.gold = clampGoldBalance(state.player.gold - getSoldierRecruitGoldCost(city.soldiers));
      city.foodStock = Math.max(0, city.foodStock - getSoldierRecruitFoodCost(city.soldiers));
    }

    handleGrowth(city, foodSurplusForCity(yieldData, city));
    handleFoodStatus(city, rawFoodStock);
    normalizeCitySocial(city);
    if (RANDOM_EVENTS_ENABLED) {
      handleCityCrisis(city, foodDelta);
    }
  });

  applyTradeIncome();
  processDebtPressure();
  updateWorldPressure();
  processScoutTurn();
  processWorkerTurn();
  processHostileFrontier();
  processHostileRaiders();
  revealPlayerTerritory(state.world, state.player.cities, 1);
  refreshFactionKnowledge(state.world);
  if (RANDOM_EVENTS_ENABLED) {
    maybeWorldCrisis();
  }
  render();
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
      templeInfluence: city.assignments.temples * state.globalBonuses.templeInfluence,
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
  totals.gold -= getArmyGoldUpkeep(city.soldiers);
  if (state.player.gold < 0) {
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
    "granary": 1,
    "houses": 1,
    "workshop": 2,
    "market-square": 1,
    "shrine": 1,
    "dock": 2,
    "training-ground": 2,
  };
  return costs[buildingId] || 0;
}

function getDebtFoodPenalty() {
  // Debt still hurts, but ramps up slower to avoid instant death spirals.
  return Math.min(2, 1 + Math.floor(Math.max(0, Math.abs(state.player.gold) - 1) / 35));
}

function processDebtPressure() {
  if (state.player.gold >= 0) return;
  const scouts = state.world.units.filter((unit) => unit.type === "scout");
  if (!scouts.length) return;
  const leaveChance = clamp(25 + Math.floor(Math.abs(state.player.gold) / 4), 25, 75);
  if (Math.random() * 100 > leaveChance) return;
  const [lostScout] = scouts;
  state.world.units = state.world.units.filter((unit) => unit.id !== lostScout.id);
  pushLog(state, "debtScoutLeave");
  showToast(t("debtScoutLeave"), "warn");
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
    pushLog(state, "cityGrowth", { city: getCityName(city), population: city.population });
  }

  if (city.population >= city.populationCap) {
    city.growthProgress = Math.min(city.growthProgress, growthNeed - 1);
  }
}

function handleFoodStatus(city, rawFoodStock) {
  city.events = [];
  if (rawFoodStock < 0) {
    city.starvationTurns += 1;
    city.events.push(t("eventHunger"));
  } else {
    city.starvationTurns = 0;
  }

  if (city.starvationTurns > 3 && city.population > 1) {
    city.population -= 1;
    city.starvationTurns = 0;
    unassignOverflow(city);
    pushLog(state, "famineLoss", { city: getCityName(city) });
  }
}

function handleCityCrisis(city, foodDelta) {
  let risk = 0;
  if (foodDelta < 0) risk += 25;
  if (city.population >= city.populationCap) risk += 25;
  if (state.player.gold < 10) risk += 10;
  if (city.soldiers < Math.ceil(city.population / 3)) risk += 10;
  if (activeShipsForCity(city.nameKey) > 0) risk += 5 * activeShipsForCity(city.nameKey);
  risk += Math.floor(state.world.crisisPressure / 5);

  if (Math.random() * 100 <= risk) {
    triggerCityCrisis(city);
  }
}

function triggerCityCrisis(city) {
  const crisisPool = [
    {
      canPay: () => state.player.gold >= 12,
      pay: () => {
        state.player.gold -= 12;
        city.events.push(t("eventRiotCalmed"));
        pushLog(state, "foodRiotPaid", { city: getCityName(city) });
      },
      fail: () => {
        if (city.population > 1) city.population -= 1;
        unassignOverflow(city);
        pushLog(state, "unrestLoss", { city: getCityName(city) });
      },
    },
    {
      canPay: () => state.player.gold >= 10,
      pay: () => {
        state.player.gold -= 10;
        city.events.push(t("eventHealers"));
        pushLog(state, "epidemicPaid", { city: getCityName(city) });
      },
      fail: () => {
        if (city.population > 1) city.population -= 1;
        unassignOverflow(city);
        pushLog(state, "diseaseLoss", { city: getCityName(city) });
      },
    },
    {
      canPay: () => state.player.gold >= 8,
      pay: () => {
        state.player.gold -= 8;
        city.events.push(t("eventRaidPaid"));
        pushLog(state, "raidPaid", { city: getCityName(city) });
      },
      fail: () => {
        const hammerLoss = Math.min(10, city.hammerStock);
        city.hammerStock -= hammerLoss;
        if (!hammerLoss && city.population > 1) {
          city.population -= 1;
          unassignOverflow(city);
        }
        pushLog(state, "raidLoss", { city: getCityName(city), amount: hammerLoss || 1 });
      },
    },
  ];
  const crisis = crisisPool[Math.floor(Math.random() * crisisPool.length)];
  if (crisis.canPay()) crisis.pay();
  else crisis.fail();
  state.world.crisisPressure = Math.min(100, state.world.crisisPressure + 6);
}

function applyTradeIncome() {
  Object.entries(state.world.factions).forEach(([factionId, factionState]) => {
    if (!factionState.tradePact) return;
    state.player.gold = clampGoldBalance(state.player.gold + 3);
    state.world.diplomacy = Math.min(100, state.world.diplomacy + 1);
    factionState.relation = Math.min(100, factionState.relation + 1);
  });
  state.world.routes.forEach((route) => {
    const sourceCity = state.player.cities.find((item) => item.nameKey === route.cityKey);
    state.player.gold = clampGoldBalance(state.player.gold - (route.upkeepGold || 1));
    if (route.blockedTurns > 0) {
      route.blockedTurns -= 1;
      return;
    }
    const disruptionChance = getRouteDisruptionChance(route);
    if (Math.random() * 100 < disruptionChance) {
      route.blockedTurns = 1;
      pushLog(state, "routeDisruptedLog", { route: t(route.nameKey), city: getCityNameByKey(route.cityKey) });
      showToast(t("routeDisruptedToast", { route: t(route.nameKey) }), "warn");
      return;
    }
    const marketPenalty = sourceCity && !cityHasBuilding(sourceCity, "market-square") ? 1 : 0;
    const routeGold = route.effect.gold + state.globalBonuses.tradeGoldBonus - marketPenalty;
    state.player.gold = clampGoldBalance(state.player.gold + routeGold);
    if (route.effect.food) {
      if (sourceCity) sourceCity.foodStock = clamp(sourceCity.foodStock + route.effect.food, 0, sourceCity.foodCap);
    }
    if (route.effect.hammers) {
      if (sourceCity) sourceCity.hammerStock = clamp(sourceCity.hammerStock + route.effect.hammers, 0, sourceCity.hammerCap);
    }
    if (route.effect.culture) state.player.culture += route.effect.culture;
    if (route.effect.diplomacy) state.world.diplomacy = Math.min(100, state.world.diplomacy + route.effect.diplomacy);
    if (route.effect.prestige) state.world.prestige = Math.min(100, state.world.prestige + route.effect.prestige);
  });
  state.world.resourceDeals.forEach((deal) => {
    state.player.gold = clampGoldBalance(state.player.gold + deal.gold);
    const factionState = state.world.factions[deal.factionId];
    if (factionState) {
      factionState.relation = Math.min(100, factionState.relation + deal.diplomacy);
    }
    state.world.diplomacy = Math.min(100, state.world.diplomacy + deal.diplomacy);
  });
}

function updateWorldPressure() {
  const cityCount = state.player.cities.length;
  state.world.tradePower = state.world.routes.length * 6 + sumCities((city) => city.assignments.market + city.assignments.ports);
  state.world.warPressure = Math.max(0, 10 + cityCount * 2 - Math.floor(totalSoldiers() / 3));
  state.world.crisisPressure = clamp(
    state.world.crisisPressure + Math.max(0, cityCount - 2) + (state.world.warPressure > 15 ? 4 : -2),
    0,
    100,
  );
}

function maybeWorldCrisis() {
  const chance = state.world.crisisPressure + state.world.warPressure / 2;
  if (Math.random() * 100 > chance) return;
  const outcomes = [
    () => {
      if (state.player.gold >= 20) {
        state.player.gold -= 20;
        pushLog(state, "worldUnrestPaid");
      } else {
        const city = weakestCity();
        if (city && city.population > 1) {
          city.population -= 1;
          unassignOverflow(city);
          pushLog(state, "worldCrisisLoss", { city: getCityName(city) });
        }
      }
    },
    () => {
      state.world.diplomacy = Math.max(0, state.world.diplomacy - 8);
      pushLog(state, "rumorLoss");
    },
    () => {
      if (state.world.routes.length) {
        const lost = state.world.routes.shift();
        pushLog(state, "stormLoss", { route: t(lost.nameKey) });
      } else {
        state.world.prestige = Math.max(0, state.world.prestige - 5);
        pushLog(state, "failedCeremony");
      }
    },
  ];
  outcomes[Math.floor(Math.random() * outcomes.length)]();
}
