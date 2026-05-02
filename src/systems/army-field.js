/** Field armies & settlers: deploy, movement, merging into cities, frontier founding. */

const FRONTIER_CITY_NAME_KEYS = ["cityStoneHeights", "citySunHarbor", "cityDustSteppe", "cityRedPass"];

function getEffectiveFoundCityCosts() {
  const cfg = ARMY_SETTLER_CONFIG;
  const goldDisc = Math.max(0, globalThis.state.globalBonuses?.foundCityGoldDiscount || 0);
  const foodDisc = Math.max(0, globalThis.state.globalBonuses?.foundCityFoodDiscount || 0);
  return {
    gold: Math.max(cfg.foundCityCostGoldFloor, cfg.foundCityCostGold - goldDisc),
    food: Math.max(cfg.foundCityCostFoodFloor, cfg.foundCityCostFood - foodDisc),
  };
}

function getFieldArmyUnits() {
  return globalThis.state.world.units.filter((unit) => unit.type === "army");
}

function getSettlerUnits() {
  return globalThis.state.world.units.filter((unit) => unit.type === "settler");
}

function fieldArmyAtTile(tileId) {
  return getFieldArmyUnits().find((unit) => unit.tileId === tileId && unit.status !== "moving") || null;
}

function settlerUnitAtTile(tileId) {
  return getSettlerUnits().find((unit) => unit.tileId === tileId && unit.status !== "moving") || null;
}

function fieldUnitAtTile(tileId) {
  return settlerUnitAtTile(tileId) || fieldArmyAtTile(tileId) || null;
}

function pickFrontierCityNameKey() {
  const used = new Set(globalThis.state.player.cities.map((city) => city.nameKey));
  const next = FRONTIER_CITY_NAME_KEYS.find((key) => !used.has(key));
  return next || `cityFrontier${globalThis.state.player.cities.length + 1}`;
}

function getSettlerHomeCity(settlerUnit) {
  const cap = typeof getCapitalCity === "function" ? getCapitalCity() : globalThis.state.player.cities[0];
  if (!settlerUnit?.homeCityKey) return cap;
  return globalThis.state.player.cities.find((c) => c.nameKey === settlerUnit.homeCityKey) || cap;
}

function getFoundCityHintParams(tile) {
  const cfg = ARMY_SETTLER_CONFIG;
  const { gold: effGold, food: effFood } = getEffectiveFoundCityCosts();
  const settler = tile ? settlerUnitAtTile(tile.id) : null;
  const home = settler ? getSettlerHomeCity(settler) : null;
  return {
    gold: effGold,
    food: effFood,
    goldBase: cfg.foundCityCostGold,
    foodBase: cfg.foundCityCostFood,
    homeCity: home ? getCityName(home) : "",
    maxCities: cfg.maxPlayerCities,
    charter: Boolean(globalThis.state.globalBonuses?.frontierCharter),
  };
}

function getFoundCityBlockHint(tile) {
  const cfg = ARMY_SETTLER_CONFIG;
  const p = getFoundCityHintParams(tile);
  if (!tile || globalThis.state.world.pendingEncounter) return globalThis.t("foundCityUnavailable");
  if (!globalThis.state.player.technologies.includes("clan-migration")) return globalThis.t("foundCityUnavailable");
  if (globalThis.state.player.cities.length >= cfg.maxPlayerCities) return globalThis.t("foundCityBlockedCap", p);
  if (!tile.discovered || tile.terrain === "sea" || tile.hostile || tile.wildBeast || (typeof cityAtTile === "function" && cityAtTile(tile.id))) {
    return globalThis.t("foundCityUnavailable");
  }
  if (tile.owner !== "player") return globalThis.t("foundCityUnavailable");
  if (!settlerUnitAtTile(tile.id)) return globalThis.t("foundCityUnavailable");
  const { gold: neededGold, food: neededFood } = getEffectiveFoundCityCosts();
  if (globalThis.state.player.gold < neededGold) return globalThis.t("foundCityBlockedGold", p);
  const home = getSettlerHomeCity(settlerUnitAtTile(tile.id));
  if (home && home.foodStock < neededFood) return globalThis.t("foundCityBlockedFood", p);
  return globalThis.t("foundCityUnavailable");
}

/** Spill from garrison cap: buffer recruit progress, then discharge pay in gold. */
function applyArmyMergeSpill(city, spilled) {
  if (spilled <= 0 || !city) return { rpGain: 0, goldRefund: 0 };
  const cfg = ARMY_SETTLER_CONFIG;
  const per = cfg.mergeSpillRecruitProgressPerSoldier;
  const roomRp = Math.max(0, 9.9 - city.recruitProgress);
  const maxSoldiersForRp = per > 0 ? roomRp / per : 0;
  const soldiersToRp = Math.min(spilled, maxSoldiersForRp);
  const rpGain = soldiersToRp * per;
  city.recruitProgress = clamp(city.recruitProgress + rpGain, 0, 9.9);
  const rest = spilled - soldiersToRp;
  const goldEach = cfg.mergeSpillGoldPerRemainderSoldier;
  const goldRefund = rest > 0 ? rest * goldEach : 0;
  if (goldRefund > 0) {
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + goldRefund);
  }
  return { rpGain, goldRefund };
}

function mergeOneArmyIntoCityCore(armyUnit, city) {
  if (!armyUnit || armyUnit.type !== "army" || !city) return;
  const cap = city.soldierCap;
  const merged = armyUnit.soldiers || 0;
  const room = Math.max(0, cap - city.soldiers);
  const added = Math.min(room, merged);
  const spilled = merged - added;
  city.soldiers += added;
  maybeClearSelectionIfRemoved(armyUnit.id);
  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== armyUnit.id);
  const spill = applyArmyMergeSpill(city, spilled);
  pushLog(globalThis.state, "armyMergedLog", {
    city: getCityName(city),
    added,
    spilled,
    rpGain: spill.rpGain,
    goldRefund: spill.goldRefund,
  });
}

function absorbRemainingFieldArmiesOnCityTile(city) {
  if (!city?.tileId) return;
  let guard = 0;
  while (guard++ < 48) {
    const next = fieldArmyAtTile(city.tileId);
    if (!next || next.type !== "army") break;
    mergeOneArmyIntoCityCore(next, city);
  }
}

function mergeFieldArmyIntoCity(armyUnit, city) {
  mergeOneArmyIntoCityCore(armyUnit, city);
  absorbRemainingFieldArmiesOnCityTile(city);
}

function selectArmy(unitId) {
  globalThis.uiState.selectedArmyId = unitId;
  globalThis.render();
}

function getSelectedFieldUnit() {
  const id = globalThis.uiState.selectedArmyId;
  if (!id) return null;
  return (
    globalThis.state.world.units.find((unit) => unit.id === id && (unit.type === "army" || unit.type === "settler")) ||
    null
  );
}

function canMoveFieldUnitToTile(tile) {
  const unit = getSelectedFieldUnit();
  if (!unit || unit.status !== "idle" || globalThis.state.world.pendingEncounter) return false;
  if (!tile || !tile.discovered || tile.terrain === "sea") return false;
  if (tile.id === unit.tileId) return false;
  const origin = getTileById(unit.tileId);
  if (!origin) return false;
  const isNeighbor = getHexNeighbors(origin, globalThis.state.world.hexTiles).some((neighbor) => neighbor.id === tile.id);
  if (!isNeighbor) return false;

  if (unit.type === "settler") {
    return tile.owner === "player" && !tile.hostile && !tile.wildBeast;
  }

  if (tile.owner === "player" && !tile.hostile) return true;

  if (unit.type === "army" && tile.hostile && typeof hostileTileBordersPlayer === "function") {
    return hostileTileBordersPlayer(tile);
  }

  if (unit.type === "army" && tile.wildBeast && typeof wildBeastTileBordersPlayer === "function") {
    return wildBeastTileBordersPlayer(tile);
  }

  return false;
}

function maybeClearSelectionIfRemoved(unitId) {
  if (globalThis.uiState.selectedArmyId === unitId) {
    globalThis.uiState.selectedArmyId = null;
  }
}

function moveArmyToTile(armyId, tileId) {
  const unit = globalThis.state.world.units.find((u) => u.id === armyId && (u.type === "army" || u.type === "settler"));
  const tile = getTileById(tileId);
  if (!unit || unit.status !== "idle" || !tile) return;
  globalThis.uiState.selectedArmyId = armyId;
  if (!canMoveFieldUnitToTile(tile)) return;
  unit.targetTileId = tileId;
  unit.status = "moving";
  pushLog(globalThis.state, unit.type === "settler" ? "settlerMoveOrderedLog" : "armyMoveOrderedLog", { tile: getHexRegionName(tile) });
  globalThis.playScoutMoveSound?.();
  globalThis.render();
}

function deploySoldier(cityNameKey, amount = 1) {
  const city = globalThis.state.player.cities.find((c) => c.nameKey === cityNameKey);
  if (!canDeployArmyFromCity(city, amount)) return;
  const n = Math.floor(Number(amount));
  city.soldiers -= n;
  const army = createArmyUnit(city.tileId, city.nameKey, n);
  globalThis.state.world.units.push(army);
  globalThis.uiState.selectedArmyId = army.id;
  pushLog(globalThis.state, "armyDeployedLog", { city: getCityName(city), soldiers: n });
  globalThis.render();
}

function canDeployArmyFromCity(city, amount = 1) {
  const n = Math.floor(Number(amount));
  if (!city || city.tileId === null || globalThis.state.world.pendingEncounter) return false;
  return n >= 1 && city.soldiers >= n;
}

function garrisonSoldier(cityNameKey) {}

function trainSettler(cityNameKey) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!canTrainSettler(city)) return;
  globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - ARMY_SETTLER_CONFIG.settlerTrainingCostGold);
  city.settlerTrainingTurns = ARMY_SETTLER_CONFIG.settlerTrainingTurns;
  pushLog(globalThis.state, "settlerTrainStartedLog", { city: getCityName(city) });
  globalThis.render();
}

function canTrainSettler(city) {
  const cfg = ARMY_SETTLER_CONFIG;
  if (!city || city.settlerTrainingTurns > 0 || city.workerTrainingTurns > 0) return false;
  if (!globalThis.state.player.technologies.includes("clan-migration")) return false;
  if (globalThis.state.player.cities.length >= cfg.maxPlayerCities) return false;
  if (globalThis.state.player.gold < cfg.settlerTrainingCostGold) return false;
  return getSettlerUnits().length < cfg.maxSettlersOnMap;
}

function foundCityCostsMet(tile) {
  const settler = tile ? settlerUnitAtTile(tile.id) : null;
  const home = settler ? getSettlerHomeCity(settler) : null;
  if (!home) return false;
  const { gold, food } = getEffectiveFoundCityCosts();
  if (globalThis.state.player.gold < gold) return false;
  if (home.foodStock < food) return false;
  return true;
}

function canFoundCity(tile) {
  if (!tile || globalThis.state.world.pendingEncounter) return false;
  if (!globalThis.state.player.technologies.includes("clan-migration")) return false;
  if (globalThis.state.player.cities.length >= ARMY_SETTLER_CONFIG.maxPlayerCities) return false;
  if (!tile.discovered || tile.terrain === "sea" || tile.hostile || tile.wildBeast || cityAtTile(tile.id)) return false;
  if (!settlerUnitAtTile(tile.id)) return false;
  if (tile.owner !== "player") return false;
  return foundCityCostsMet(tile);
}

function foundCity(tileId) {
  const tile = getTileById(tileId);
  const settler = tile ? settlerUnitAtTile(tileId) : null;
  if (!tile || settler?.type !== "settler" || !canFoundCity(tile)) return;
  const home = getSettlerHomeCity(settler);
  const { gold: payGold, food: payFood } = getEffectiveFoundCityCosts();
  globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - payGold);
  if (home) {
    home.foodStock = Math.max(0, home.foodStock - payFood);
  }
  const nameKey = pickFrontierCityNameKey();
  maybeClearSelectionIfRemoved(settler.id);
  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== settler.id);
  globalThis.state.player.cities.push(createCity(nameKey, "roleForge", false, tile.id));
  tile.cityName = nameKey;
  globalThis.state.world.territory = globalThis.state.world.hexTiles.filter((entry) => entry.owner === "player").length;
  revealRadius(globalThis.state.world.hexTiles, tile.id, WORLD_CONFIG?.revealRadius ?? 2);
  pushLog(globalThis.state, "cityFoundedLog", { city: globalThis.t(nameKey), tile: getHexRegionName(tile) });
  globalThis.playSuccessSound?.();
  showToast(globalThis.t("toastCityFounded", { city: globalThis.t(nameKey) }), "success");
  globalThis.render();
}

function processFieldArmyTurn() {
  const moving = globalThis.state.world.units.filter(
    (unit) =>
      (unit.type === "army" || unit.type === "settler") &&
      unit.status === "moving" &&
      unit.targetTileId,
  );

  moving.forEach((unit) => {
    const tile = getTileById(unit.targetTileId);
    if (!tile) {
      unit.targetTileId = null;
      unit.status = "idle";
      return;
    }

    unit.tileId = tile.id;
    unit.targetTileId = null;
    unit.status = "idle";
    pushLog(globalThis.state,
      unit.type === "settler" ? "settlerArrivedLog" : "armyArrivedLog",
      { tile: getHexRegionName(tile) },
    );

    const cityHere = typeof cityAtTile === "function" ? cityAtTile(unit.tileId) : null;
    let armyMobile = unit.type === "army" ? globalThis.state.world.units.find((u) => u.id === unit.id) : null;
    if (armyMobile && tile.hostile && typeof resolveArmyAssaultOnHostileTile === "function") {
      resolveArmyAssaultOnHostileTile(armyMobile, tile);
    }
    armyMobile = unit.type === "army" ? globalThis.state.world.units.find((u) => u.id === unit.id) : null;
    if (armyMobile && tile.wildBeast && typeof resolveArmyVsWildBeastTile === "function") {
      resolveArmyVsWildBeastTile(armyMobile, tile);
    }
    const armyStill = unit.type === "army" ? globalThis.state.world.units.find((u) => u.id === unit.id) : null;
    if (armyStill && cityHere) {
      mergeFieldArmyIntoCity(armyStill, cityHere);
    }
  });
}

/** Raider elimination on stepping onto idle settler. */
function wipeSettlerIfRaiderOnTile(tileId) {
  const tile = getTileById(tileId);
  const settler = tile ? settlerUnitAtTile(tile.id) : null;
  const raiderHere = hostileRaiderAtTile(tileId);
  if (!settler || settler.type !== "settler" || !raiderHere) return;
  maybeClearSelectionIfRemoved(settler.id);
  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== settler.id);
  pushLog(globalThis.state, "settlerLostToRaiderLog", { tile: getHexRegionName(tile) });
  showToast(globalThis.t("toastSettlerLostToRaider", { tile: getHexRegionName(tile) }), "danger");
}

/**
 * Combat when a raider enters an army hex.
 * @returns {boolean} true if raider was destroyed / removed from play
 */
function resolveFieldArmyVersusRaider(raider, defender) {
  if (!raider || !defender || defender.type !== "army" || (defender.soldiers || 0) <= 0) return false;
  const tile = getTileById(raider.tileId);
  const odds =
    typeof computeCombatWinPercent === "function"
      ? computeCombatWinPercent("raider_field", { unit: defender }, { unit: raider }, tile)
      : clamp(
          Math.round(30 + (Math.max(1, defender.soldiers) / Math.max(1, raider.strength || 1)) * 25),
          25,
          92,
        );
  const tileName = getHexRegionName(getTileById(raider.tileId));
  const success = Math.random() * 100 <= odds;
  if (success) {
    globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== raider.id);
    if (Math.random() < 0.35 && defender.soldiers > 0) defender.soldiers -= 1;
    if (defender.soldiers <= 0) {
      maybeClearSelectionIfRemoved(defender.id);
      globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== defender.id);
    }
    pushLog(globalThis.state, "fieldArmyWonVersusRaiderLog", { tile: tileName });
    globalThis.playSuccessSound?.();
    showToast(globalThis.t("toastFieldArmyStoppedRaider", { tile: tileName }), "success");
    return true;
  }

  defender.soldiers -= Math.min(defender.soldiers || 0, Math.max(1, Math.floor((raider.strength || 1) / 2)));
  raider.strength = Math.max(1, (raider.strength || 1) - 1);
  if (defender.soldiers <= 0) {
    maybeClearSelectionIfRemoved(defender.id);
    globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== defender.id);
  }
  pushLog(globalThis.state, "fieldArmyLostVersusRaiderLog", { tile: tileName });
  globalThis.playDefeatSound?.();
  showToast(globalThis.t("toastFieldArmyFailedStopRaider", { tile: tileName }), "danger");
  return false;
}

/** Stub compatibility — prefer `moveArmyToTile` + selection. */
function canArmyMoveTo(armyId, tileId) {
  const unit = globalThis.state.world.units.find((u) => u.id === armyId);
  const tile = getTileById(tileId);
  if (!unit || !tile || (unit.type !== "army" && unit.type !== "settler")) return false;
  const prev = globalThis.uiState.selectedArmyId;
  globalThis.uiState.selectedArmyId = armyId;
  const ok = canMoveFieldUnitToTile(tile);
  globalThis.uiState.selectedArmyId = prev;
  return ok;
}

Object.assign(globalThis, {
  getEffectiveFoundCityCosts,
  getFieldArmyUnits,
  getSettlerUnits,
  fieldArmyAtTile,
  settlerUnitAtTile,
  fieldUnitAtTile,
  pickFrontierCityNameKey,
  getSettlerHomeCity,
  getFoundCityHintParams,
  getFoundCityBlockHint,
  applyArmyMergeSpill,
  mergeOneArmyIntoCityCore,
  absorbRemainingFieldArmiesOnCityTile,
  mergeFieldArmyIntoCity,
  selectArmy,
  getSelectedFieldUnit,
  canMoveFieldUnitToTile,
  maybeClearSelectionIfRemoved,
  moveArmyToTile,
  deploySoldier,
  canDeployArmyFromCity,
  garrisonSoldier,
  trainSettler,
  canTrainSettler,
  foundCityCostsMet,
  canFoundCity,
  foundCity,
  processFieldArmyTurn,
  wipeSettlerIfRaiderOnTile,
  resolveFieldArmyVersusRaider,
  canArmyMoveTo,
});
