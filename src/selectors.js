function getSelectedCity() {
  return globalThis.state.player.cities.find((city) => city.nameKey === globalThis.state.selectedCity) || globalThis.state.player.cities[0];
}

function getCityName(city) {
  return globalThis.t(city.nameKey);
}

function getCityNameByKey(nameKey) {
  return globalThis.t(nameKey);
}

function getRoleName(city) {
  return globalThis.t(city.roleKey);
}

function getCityDirective(city) {
  return CITY_DIRECTIVES.find((item) => item.id === city.directive) || CITY_DIRECTIVES[0];
}

function getCitySpecialization(city) {
  return CITY_SPECIALIZATIONS.find((item) => item.id === city.specialization) || CITY_SPECIALIZATIONS[0];
}

function getBuildingNameById(buildingId) {
  const building = BUILDINGS.find((item) => item.id === buildingId);
  return building ? globalThis.t(building.nameKey) : buildingId;
}

function getResourceDisplayName(resourceId) {
  return RESOURCE_DEFS[resourceId]?.nameKey ? globalThis.t(RESOURCE_DEFS[resourceId].nameKey) : resourceId;
}

function getResourceRule(resourceId) {
  return RESOURCE_RULES[resourceId] || {};
}

function getResourceEffectText(resourceId) {
  const rule = getResourceRule(resourceId);
  return rule.effectKey ? globalThis.t(rule.effectKey) : "";
}

function getResourceSynergyText(resourceId) {
  const rule = getResourceRule(resourceId);
  return rule.synergyKey ? globalThis.t(rule.synergyKey) : "";
}

function getResourceUnlockedBuildingsText(resourceId) {
  const rule = getResourceRule(resourceId);
  if (!rule.unlocksBuildings?.length) return "";
  return globalThis.t("resourceUnlocksBuildings", { value: rule.unlocksBuildings.map(getBuildingNameById).join(", ") });
}

function getTechnologyNameById(techId) {
  const tech = TECHNOLOGIES.find((item) => item.id === techId);
  return tech ? globalThis.t(tech.nameKey) : techId;
}

function technologyPrerequisitesMet(tech) {
  if (!tech?.requiresTechIds?.length) return true;
  const learned = globalThis.state.player.technologies || [];
  return tech.requiresTechIds.every((id) => learned.includes(id));
}

function getResourceUnlockedTechsText(resourceId) {
  const rule = getResourceRule(resourceId);
  if (!rule.unlocksTechs?.length) return "";
  return globalThis.t("resourceUnlocksTechs", { value: rule.unlocksTechs.map(getTechnologyNameById).join(", ") });
}

function getOwnedUnimprovedResourceTiles() {
  return globalThis.state.world.hexTiles.filter((tile) => tile.owner === "player" && tile.discovered && tile.resource && canExtractResource(tile.resource) && !tile.resourceImproved);
}

function getCapitalResourceYield(city) {
  if (!city?.isCapital) {
    return {
      food: 0,
      hammers: 0,
      culture: 0,
      gold: 0,
      soldiers: 0,
    };
  }

  const stone = getPlayerResourceCount("stone");
  const iron = getPlayerResourceCount("iron");
  const geologyHammersRaw = stone + iron;
  const canUseIron = iron > 0 && city.buildings.includes("training-ground") && city.assignments.barracks > 0;
  const incenseCount = getPlayerResourceCount("incense");
  return {
    food: getPlayerResourceCount("grain") + getPlayerResourceCount("fish"),
    /** Linked deposits used to stack without limit; cap keeps quarry output meaningful but not autopilot flood. */
    hammers: geologyHammersRaw ? Math.min(3, geologyHammersRaw) : 0,
    /** Incense yields no capital culture until a Shrine consecrates offerings into civic ritual (see encyclopedia/resource text). */
    culture: incenseCount > 0 && cityHasBuilding(city, "shrine") ? incenseCount : 0,
    gold: getPlayerResourceCount("horses"),
    soldiers: canUseIron ? iron * 0.02 : 0,
  };
}

function getResourceChainYield(city) {
  if (!city) {
    return {
      food: 0,
      hammers: 0,
      culture: 0,
      gold: 0,
      soldiers: 0,
      growthBonus: 0,
    };
  }

  return {
    food: playerHasResource("fish") && city.assignments.ports > 0 ? 1 : 0,
    hammers: playerHasResource("stone") && cityHasBuilding(city, "workshop") ? 1 : 0,
    culture: playerHasResource("incense") && cityHasBuilding(city, "shrine") ? 1 : 0,
    gold: playerHasResource("horses") && cityHasBuilding(city, "market-square") ? 1 : 0,
    soldiers:
      (playerHasResource("copper") && cityHasBuilding(city, "training-ground") && city.assignments.barracks > 0 ? 0.02 : 0)
      + (playerHasResource("iron") && city.assignments.barracks > 0 ? 0.03 : 0),
    growthBonus: playerHasResource("grain") && cityHasBuilding(city, "granary") ? 1 : 0,
  };
}

function playerHasResource(resourceId) {
  return getPlayerResourceCount(resourceId) > 0;
}

function getPlayerResourceCount(resourceId) {
  return globalThis.state.player.resources?.[resourceId] || 0;
}

function activeResourceExports(resourceId) {
  return globalThis.state.world.resourceDeals.filter((deal) => deal.resourceId === resourceId).length;
}

function getResourceSurplus(resourceId) {
  return Math.max(0, getPlayerResourceCount(resourceId) - 1 - activeResourceExports(resourceId));
}

function canExtractResource(resourceId) {
  return Boolean(RESOURCE_DEFS[resourceId]?.extractable);
}

function cityHasBuilding(city, buildingId) {
  return city.buildings.includes(buildingId);
}

function buildingRequirementsMet(city, building) {
  if ((building?.requires || []).some((requiredId) => !cityHasBuilding(city, requiredId))) return false;
  if (building?.requiresResource && !playerHasResource(building.requiresResource)) return false;
  return true;
}

function getAssignmentMax(city, jobId) {
  if (jobId === "barracks") return city.buildings.includes("training-ground") ? 1 : 0;
  if (jobId === "ports") return city.buildings.includes("dock") ? 1 : 0;
  if (jobId === "market") return city.buildings.includes("market-square") ? 1 : 0;
  if (jobId === "temples") return city.buildings.includes("shrine") ? 1 : 0;
  return city.population;
}

function assignedWorkers(city) {
  return Object.values(city.assignments).reduce((sum, value) => sum + value, 0);
}

Object.assign(globalThis, {
  getSelectedCity,
  getCityName,
  getCityNameByKey,
  getRoleName,
  getCityDirective,
  getCitySpecialization,
  getBuildingNameById,
  getResourceDisplayName,
  getResourceRule,
  getResourceEffectText,
  getResourceSynergyText,
  getResourceUnlockedBuildingsText,
  getTechnologyNameById,
  technologyPrerequisitesMet,
  getResourceUnlockedTechsText,
  getOwnedUnimprovedResourceTiles,
  getCapitalResourceYield,
  getResourceChainYield,
  playerHasResource,
  getPlayerResourceCount,
  activeResourceExports,
  getResourceSurplus,
  canExtractResource,
  cityHasBuilding,
  buildingRequirementsMet,
  getAssignmentMax,
  assignedWorkers,
});
