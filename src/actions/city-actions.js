function adjustWorkers(cityNameKey, jobId, delta) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!city) return;
  setWorkers(cityNameKey, jobId, city.assignments[jobId] + delta);
}

function setWorkers(cityNameKey, jobId, nextValue) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!city) return;
  city.assignments[jobId] = clamp(Math.round(nextValue), 0, getAssignmentMax(city, jobId));
  rebalanceWorkers(city, jobId);
  if (typeof hookOnboardingWorkersChanged === "function") {
    hookOnboardingWorkersChanged();
  }
  globalThis.render();
}

function setCityDirective(cityNameKey, directiveId) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!city || !CITY_DIRECTIVES.some((item) => item.id === directiveId)) return;
  if (city.directive === directiveId) return;
  if (city.directiveChangeCount > 0) {
    if (globalThis.state.player.gold < 2) {
      showToast(globalThis.t("notEnoughGold"), "warn");
      return;
    }
    globalThis.state.player.gold -= 2;
    city.growthProgress = Math.max(0, city.growthProgress - 1);
  }
  city.directive = directiveId;
  city.directiveChangeCount += 1;
  showToast(globalThis.t("toastDirectiveChanged", { city: getCityName(city), directive: globalThis.t(getCityDirective(city).labelKey) }), "success");
  globalThis.render();
}

function setCitySpecialization(cityNameKey, specializationId) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!city || !CITY_SPECIALIZATIONS.some((item) => item.id === specializationId)) return;
  if (city.specialization === specializationId) return;
  if (city.specializationChangeCount > 0) {
    if (globalThis.state.player.gold < 4) {
      showToast(globalThis.t("notEnoughGold"), "warn");
      return;
    }
    globalThis.state.player.gold -= 4;
    city.growthProgress = Math.max(0, city.growthProgress - 2);
  }
  city.specialization = specializationId;
  city.specializationChangeCount += 1;
  showToast(globalThis.t("toastSpecializationChanged", { city: getCityName(city), specialization: globalThis.t(getCitySpecialization(city).labelKey) }), "success");
  globalThis.render();
}

function rebalanceWorkers(city, lockedJobId) {
  ["temples", "market", "ports", "barracks"].forEach((jobId) => {
    city.assignments[jobId] = Math.min(city.assignments[jobId], getAssignmentMax(city, jobId));
  });
  let overflow = assignedWorkers(city) - city.population;
  if (overflow <= 0) return;
  const reductionOrder = ["ports", "market", "barracks", "temples", "mines", "fields"].filter((id) => id !== lockedJobId);
  while (overflow > 0) {
    const nextJob = reductionOrder.find((id) => city.assignments[id] > 0);
    if (!nextJob) break;
    city.assignments[nextJob] -= 1;
    overflow -= 1;
  }
}

function normalizeCityBuildQueue(city) {
  if (!city) return;
  if (!Array.isArray(city.buildQueue)) city.buildQueue = [];
  /* Backlog (index > 0) should not carry a ticking timer until it becomes slot 0. */
  city.buildQueue.forEach((job, idx) => {
    if (idx > 0 && job && typeof job.turnsLeft === "number") {
      delete job.turnsLeft;
    }
  });
}

function isBuildingQueued(city, buildingId) {
  normalizeCityBuildQueue(city);
  return city.buildQueue.some((job) => job.buildingId === buildingId);
}

function queueBuildingConstruction(cityNameKey, buildingId) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  const building = BUILDINGS.find((item) => item.id === buildingId);
  normalizeCityBuildQueue(city);
  const builtCount = city?.buildings.filter((item) => item === buildingId).length || 0;
  if (!city || !building || city.hammerStock < building.cost || (building.unique && builtCount > 0) || !buildingRequirementsMet(city, building)) {
    return false;
  }
  if (isBuildingQueued(city, buildingId)) return false;

  city.hammerStock -= building.cost;
  const plannedTurns = typeof constructionTurnsForBuilding === "function" ? constructionTurnsForBuilding(building) : 4;
  const isActiveNow = city.buildQueue.length === 0;
  city.buildQueue.push(isActiveNow ? { buildingId, turnsLeft: plannedTurns } : { buildingId });

  pushLog(globalThis.state, "buildingQueued", {
    city: getCityName(city),
    building: globalThis.t(building.nameKey),
    turns: plannedTurns,
  });
  globalThis.render();
  return true;
}

/** Apply first job in queue when turns run out — call once per city at end of each turn (after yields). */
function processCityConstructionQueueAtTurnEnd(city) {
  normalizeCityBuildQueue(city);
  if (!city.buildQueue.length) return;
  const active = city.buildQueue[0];
  if (typeof active.turnsLeft !== "number") {
    const bd = BUILDINGS.find((item) => item.id === active.buildingId);
    active.turnsLeft =
      bd && typeof constructionTurnsForBuilding === "function"
        ? constructionTurnsForBuilding(bd)
        : 4;
  }
  active.turnsLeft -= 1;
  if (active.turnsLeft > 0) return;
  const doneId = active.buildingId;
  city.buildQueue.shift();
  finalizeQueuedBuildingConstruction(city, doneId);
  if (city.buildQueue.length > 0) {
    const next = city.buildQueue[0];
    const bd = BUILDINGS.find((item) => item.id === next.buildingId);
    next.turnsLeft =
      bd && typeof constructionTurnsForBuilding === "function"
        ? constructionTurnsForBuilding(bd)
        : 4;
  }
}

function finalizeQueuedBuildingConstruction(city, buildingId) {
  const building = BUILDINGS.find((item) => item.id === buildingId);
  if (!building) return;
  if (building.unique && city.buildings.includes(buildingId)) return;
  city.buildings.push(building.id);
  building.apply(city);
  rebalanceWorkers(city);
  pushLog(globalThis.state, "buildingFinished", { city: getCityName(city), building: globalThis.t(building.nameKey) });
}

/** @deprecated Prefer queueBuildingConstruction (multi-turn construction). Kept name for callers. */
function constructBuilding(cityNameKey, buildingId) {
  queueBuildingConstruction(cityNameKey, buildingId);
}

function researchTechnology(techId) {
  const tech = TECHNOLOGIES.find((item) => item.id === techId);
  if (!tech || globalThis.state.player.technologies.includes(tech.id) || globalThis.state.player.culture < tech.cost) return;
  if (tech.requiresResource && !playerHasResource(tech.requiresResource)) return;
  if (typeof technologyPrerequisitesMet === "function" && !technologyPrerequisitesMet(tech)) return;
  globalThis.state.player.culture -= tech.cost;
  globalThis.state.player.technologies.push(tech.id);
  tech.apply(globalThis.state);
  pushLog(globalThis.state, "technologyUnlocked", { tech: globalThis.t(tech.nameKey) });
  globalThis.render();
}

function startTrade(cityNameKey, offerId) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  const offer = TRADE_OFFERS.find((item) => item.id === offerId);
  if (!city || !offer) return;
  if (!cityHasBuilding(city, "market-square")) {
    showToast(globalThis.t("routeNeedsMarketToast"), "warn");
    return;
  }
  if (availableShipsForCity(city.nameKey) < offer.shipCost) {
    showToast(globalThis.t("routeNeedsShipToast"), "warn");
    return;
  }
  const route = {
    id: `${offer.id}-${Date.now()}`,
    cityKey: city.nameKey,
    nameKey: offer.nameKey,
    descriptionKey: offer.descriptionKey,
    effect: { ...offer.effect },
    upkeepGold: offer.shipCost,
    blockedTurns: 0,
  };
  globalThis.state.world.routes.push(route);
  globalThis.state.world.tradePower += 3;
  globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 2);
  pushLog(globalThis.state, "launchedRoute", { city: getCityName(city), route: globalThis.t(offer.nameKey) });
  globalThis.render();
}

function cancelTrade(routeId) {
  const routeIndex = globalThis.state.world.routes.findIndex((route) => route.id === routeId);
  if (routeIndex === -1) return;
  const [route] = globalThis.state.world.routes.splice(routeIndex, 1);
  globalThis.state.world.tradePower = Math.max(0, globalThis.state.world.tradePower - 2);
  pushLog(globalThis.state, "canceledRoute", { route: globalThis.t(route.nameKey), city: getCityNameByKey(route.cityKey) });
  globalThis.render();
}

function availableShipsForCity(cityNameKey) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!city) return 0;
  return Math.max(0, city.ships - activeShipsForCity(cityNameKey));
}

function applyPolicy(policyId) {
  const policy = POLICIES.find((item) => item.id === policyId);
  if (!policy || !policy.available(globalThis.state)) return;
  policy.effect(globalThis.state);
  globalThis.render();
}

Object.assign(globalThis, {
  adjustWorkers,
  setWorkers,
  setCityDirective,
  setCitySpecialization,
  rebalanceWorkers,
  normalizeCityBuildQueue,
  isBuildingQueued,
  queueBuildingConstruction,
  processCityConstructionQueueAtTurnEnd,
  finalizeQueuedBuildingConstruction,
  constructBuilding,
  researchTechnology,
  startTrade,
  cancelTrade,
  availableShipsForCity,
  applyPolicy,
});
