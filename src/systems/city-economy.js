function cityForecast(city) {
  const yieldData = computeCityYield(city);
  const foodNeed = getCityFoodNeed(city);
  const growthGain = getGrowthDelta(yieldData.food - foodNeed, city);
  const lines = [
    globalThis.t("forecastFood", { value: signed(yieldData.food - foodNeed) }),
    globalThis.t("forecastHammers", { value: signed(yieldData.hammers) }),
    globalThis.t("forecastCulture", { value: signed(yieldData.culture) }),
    globalThis.t("forecastGold", { value: signed(yieldData.gold) }),
    globalThis.t("forecastArmy", { value: signed(yieldData.soldiers) }),
    globalThis.t("forecastShipPoints", { value: signed(yieldData.shipPoints) }),
    globalThis.t("forecastGrowth", { value: growthGain }),
  ];
  return lines.join(" | ");
}

function citySummary(city) {
  const yieldData = computeCityYield(city);
  const foodNeed = getCityFoodNeed(city);
  return globalThis.t("summaryNetFood", { value: signed(yieldData.food - foodNeed), gold: signed(yieldData.gold), army: signed(yieldData.soldiers) });
}

function formatYield(yieldData) {
  const parts = [];
  if (yieldData.food) parts.push(globalThis.t("yieldFood", { value: yieldData.food }));
  if (yieldData.hammers) parts.push(globalThis.t("yieldHammers", { value: yieldData.hammers }));
  if (yieldData.culture) parts.push(globalThis.t("yieldCulture", { value: yieldData.culture }));
  if (yieldData.gold) parts.push(globalThis.t("yieldGold", { value: yieldData.gold }));
  if (yieldData.soldiers) parts.push(globalThis.t("yieldArmy", { value: yieldData.soldiers }));
  if (yieldData.shipPoints) parts.push(globalThis.t("yieldShipPts", { value: yieldData.shipPoints }));
  return parts.join(" | ");
}

function getGrowthNeed(city) {
  /** Steeper-than-linear cap without the old spike (early–mid pacing: ~−20% ticks to next citizen vs 18+N*4). */
  return Math.max(12, 16 + city.population * 3 - city.modifiers.growthDiscount);
}

function getArmyFoodUpkeep(soldiers) {
  if (soldiers <= 0) return 0;
  return soldiers * 2 + Math.max(0, soldiers - 2) * 2;
}

function getArmyGoldUpkeep(soldiers) {
  if (soldiers <= 0) return 0;
  // Softer early upkeep keeps the opening economy from collapsing.
  return Math.max(0, soldiers - 1) + Math.max(0, soldiers - 3);
}

function getFieldArmySoldiersForCity(cityNameKey) {
  if (!globalThis.state.world?.units) return 0;
  return globalThis.state.world.units
    .filter((unit) => unit.type === "army" && unit.homeCityKey === cityNameKey)
    .reduce((acc, unit) => acc + (unit.soldiers || 0), 0);
}

function getCityFoodNeed(city) {
  const field = getFieldArmySoldiersForCity(city.nameKey);
  return city.population * 2 + getArmyFoodUpkeep(city.soldiers + field);
}

function getSoldierRecruitFoodCost(nextSoldierCount) {
  return 6 + Math.max(0, nextSoldierCount - 2) * 3;
}

function getSoldierRecruitGoldCost(nextSoldierCount) {
  return 5 + Math.max(0, nextSoldierCount - 2) * 2;
}

function getGrowthDelta(foodSurplus, city = null) {
  if (foodSurplus <= 0) return 0;
  const directiveBonus = city && city.directive === "growth" ? 1 : 0;
  const storedSurplusBonus = city && city.foodStock >= city.foodCap && foodSurplus > 0
    ? 1 + Math.floor(foodSurplus / 3)
    : 0;
  return 1 + Math.floor(foodSurplus / 2) + directiveBonus + storedSurplusBonus;
}

function getCityStatus(city, foodSurplus) {
  if (foodSurplus < 0) return { labelKey: "cityStatusHungry", tone: "warn" };
  if (city.population >= city.populationCap) return { labelKey: "cityStatusPacked", tone: "warn" };
  if (city.soldiers < Math.max(1, Math.ceil(city.population / 4))) return { labelKey: "cityStatusFragile", tone: "warn" };
  if (foodSurplus >= 4) return { labelKey: "cityStatusGrowing", tone: "good" };
  return { labelKey: "cityStatusStable", tone: "" };
}

function getCityAlerts(city, foodSurplus) {
  const alerts = [];
  const freeWorkers = city.population - assignedWorkers(city);
  if (foodSurplus < 0) alerts.push({ text: globalThis.t("cityAlertFood"), tone: "warn" });
  if (freeWorkers > 0) alerts.push({ text: globalThis.t("cityAlertIdle", { count: freeWorkers }), tone: "good" });
  if (city.population >= city.populationCap) alerts.push({ text: globalThis.t("cityAlertHousing"), tone: "warn" });
  if (city.soldiers < Math.max(1, Math.ceil(city.population / 4))) alerts.push({ text: globalThis.t("cityAlertGarrison"), tone: "warn" });
  if (city.soldiers >= 3) alerts.push({ text: globalThis.t("cityAlertArmyBurden"), tone: "warn" });
  if (!alerts.length) alerts.push({ text: globalThis.t("cityAlertBalanced"), tone: "good" });
  return alerts.slice(0, 3);
}

function getCityImperialOrder(city) {
  const knownFactionIds = Object.values(FACTIONS)
    .filter((faction) => globalThis.state.world.factions[faction.id]?.met || globalThis.state.world.factions[faction.id]?.contactEstablished)
    .map((faction) => faction.id);
  if (availableContactShips() <= 0 && knownFactionIds.length === 0) return globalThis.t("cityOrderShips");
  if (knownFactionIds.length > 0 && !knownFactionIds.some((factionId) => globalThis.state.world.factions[factionId]?.contactEstablished)) return globalThis.t("cityOrderContact");
  if (getHostileRaiders().length > 0) return globalThis.t("cityOrderFrontier");
  if (city.soldiers >= 3 && globalThis.state.player.gold < 20) return globalThis.t("cityOrderTrade");
  const hostileCount = hostileFrontierTiles().length;
  if (hostileCount > 0 && city.soldiers < Math.max(2, hostileCount + 1)) return globalThis.t("cityOrderFrontier");
  if (city.population < city.populationCap && city.foodStock < Math.floor(city.foodCap * 0.45)) return globalThis.t("cityOrderGrowth");
  if (globalThis.state.player.gold < 35) return globalThis.t("cityOrderTrade");
  return globalThis.t("cityOrderDefault");
}

function foodSurplusForCity(yieldData, city) {
  return yieldData.food - getCityFoodNeed(city);
}

function totalSoldiers() {
  const citySoldiers = sumCities((city) => city.soldiers);
  const fieldUnits = globalThis.state.world.units.reduce((sum, unit) => sum + (unit.soldiers || 0), 0);
  return citySoldiers + fieldUnits;
}

function spendSoldiers(amount) {
  let remaining = amount;
  const cities = [...globalThis.state.player.cities].sort((a, b) => b.soldiers - a.soldiers);
  cities.forEach((city) => {
    if (remaining <= 0) return;
    const spent = Math.min(city.soldiers, remaining);
    city.soldiers -= spent;
    remaining -= spent;
  });
  const units = [...globalThis.state.world.units].sort((a, b) => (b.soldiers || 0) - (a.soldiers || 0));
  units.forEach((unit) => {
    if (remaining <= 0) return;
    const spent = Math.min(unit.soldiers || 0, remaining);
    unit.soldiers = (unit.soldiers || 0) - spent;
    remaining -= spent;
  });
  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => {
    if (unit.type === "scout") return (unit.soldiers || 0) > 0;
    if (unit.type === "army") return (unit.soldiers || 0) > 0;
    return true;
  });
}

function totalShips() {
  return sumCities((city) => city.ships);
}

function totalCommittedContactShips() {
  return Object.values(globalThis.state.world.factions).filter((faction) => faction.contactShipCommitted).length;
}

function availableContactShips() {
  return Math.max(0, totalShips() - globalThis.state.world.routes.length - totalCommittedContactShips());
}

function availableOperationalShips() {
  return Math.max(0, totalShips() - globalThis.state.world.routes.length - totalCommittedContactShips());
}

function totalGoldCap() {
  return globalThis.state.player.cities.reduce((sum, city) => sum + city.goldCap, 0);
}

function activeShipsForCity(cityNameKey) {
  return globalThis.state.world.routes.filter((route) => route.cityKey === cityNameKey).length;
}

function getTradeThreatForCity(city) {
  if (!city) return 0;
  const cityTile = getTileById(city.tileId);
  if (!cityTile) return 0;
  const hostilePressure = hostileFrontierTiles()
    .filter((tile) => hexDistance(tile.q, tile.r, cityTile.q, cityTile.r) <= 3)
    .reduce((sum, t) => sum + 1 + Math.max(0, ((t.hostileStage || 1) - 1)) * 0.4, 0);
  const raiderPressure = getHostileRaiders().filter((unit) => unit.targetCityKey === city.nameKey).length;
  return hostilePressure + raiderPressure * 2;
}

function getRouteDisruptionChance(route) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === route.cityKey);
  if (!city) return 0;
  const marketShield = cityHasBuilding(city, "market-square") ? 4 : 0;
  return clamp(6 + getTradeThreatForCity(city) * 7 - marketShield, 0, 65);
}

function weakestCity() {
  return [...globalThis.state.player.cities].sort((a, b) => a.population - b.population)[0];
}

function unassignOverflow(city) {
  while (assignedWorkers(city) > city.population) {
    const order = ["ports", "market", "barracks", "temples", "mines", "fields"];
    const jobId = order.find((id) => city.assignments[id] > 0);
    if (!jobId) break;
    city.assignments[jobId] -= 1;
  }
}

function sumCities(pick) {
  return globalThis.state.player.cities.reduce((sum, city) => sum + pick(city), 0);
}

function getCapitalCity() {
  return globalThis.state.player.cities.find((city) => city.isCapital) || globalThis.state.player.cities[0];
}

function getPrimaryScout() {
  return globalThis.state.world.units.find((unit) => unit.type === "scout") || null;
}

function getHostileRaiders() {
  return globalThis.state.world.units.filter((unit) => unit.type === "hostile-raider");
}

function hostileRaiderAtTile(tileId) {
  return getHostileRaiders().find((unit) => unit.tileId === tileId) || null;
}

function hostileFrontierTiles() {
  return globalThis.state.world.hexTiles.filter((tile) => tile.hostile);
}

function getTileById(tileId) {
  return globalThis.state.world.hexTiles.find((tile) => tile.id === tileId) || null;
}

Object.assign(globalThis, {
  cityForecast,
  citySummary,
  formatYield,
  getGrowthNeed,
  getArmyFoodUpkeep,
  getArmyGoldUpkeep,
  getFieldArmySoldiersForCity,
  getCityFoodNeed,
  getSoldierRecruitFoodCost,
  getSoldierRecruitGoldCost,
  getGrowthDelta,
  getCityStatus,
  getCityAlerts,
  getCityImperialOrder,
  foodSurplusForCity,
  totalSoldiers,
  spendSoldiers,
  totalShips,
  totalCommittedContactShips,
  availableContactShips,
  availableOperationalShips,
  totalGoldCap,
  activeShipsForCity,
  getTradeThreatForCity,
  getRouteDisruptionChance,
  weakestCity,
  unassignOverflow,
  sumCities,
  getCapitalCity,
  getPrimaryScout,
  getHostileRaiders,
  hostileRaiderAtTile,
  hostileFrontierTiles,
  getTileById,
});
