function markTileHostile(tile, strength = 1) {
  if (!tile) return;
  tile.hostile = true;
  tile.hostileStrength = Math.max(tile.hostileStrength || 0, strength);
  tile.hostileStage = Math.max(tile.hostileStage || 0, Math.min(3, Math.max(1, strength - 1)));
  tile.hostileAge = 0;
  tile.hostileCooldown = 2 + Math.floor(Math.random() * 2);
}

function frontierHostileCfg() {
  return typeof FRONTIER_HOSTILE_CONFIG !== "undefined"
    ? FRONTIER_HOSTILE_CONFIG
    : {
      scoutHostileChancePerExistingTile: 0.014,
      scoutHostileChanceCapBonus: 0.09,
      suppressedRaidChanceMultiplier: 0.32,
      suppressedEscalationPenalty: 1,
      assaultWinChanceBase: 34,
      assaultWinChancePerPowerRatio: 30,
      assaultCasualtyChanceScale: 0.07,
      punitiveRaidAdjacentArmyBonus: 14,
      tributeCalmCostFraction: 0.48,
      tributeCalmGoldFloor: 5,
    };
}

/** Hostile frontier hex touches at least one player-owned land tile (armies can march in). */
function hostileTileBordersPlayer(tile) {
  if (!tile || tile.terrain === "sea") return false;
  return getHexNeighbors(tile, globalThis.state.world.hexTiles).some(
    (n) => n.owner === "player" && n.terrain !== "sea",
  );
}

function armyUnitOnTile(tileId) {
  return globalThis.state.world.units.find(
    (u) => u.type === "army" && u.tileId === tileId && u.status !== "moving" && (u.soldiers || 0) > 0,
  ) || null;
}

function fieldArmiesAdjacentToTile(tileId) {
  const tile = getTileById(tileId);
  if (!tile) return 0;
  let count = 0;
  getHexNeighbors(tile, globalThis.state.world.hexTiles).forEach((neighbor) => {
    if (armyUnitOnTile(neighbor.id)) count += 1;
  });
  return count;
}

function processHostileFrontier() {
  const cfg = frontierHostileCfg();
  globalThis.state.world.hexTiles.forEach((tile) => {
    if (!tile.hostile) return;
    const suppressed = fieldArmiesAdjacentToTile(tile.id) > 0;
    if (!suppressed) {
      tile.hostileAge = (tile.hostileAge || 0) + 1;
    } else {
      tile.hostileAge = Math.max(0, (tile.hostileAge || 0) - cfg.suppressedEscalationPenalty);
    }
    if ((tile.hostileAge || 0) >= 3 && (tile.hostileStage || 1) < 3) {
      tile.hostileStage = (tile.hostileStage || 1) + 1;
      tile.hostileStrength += 1;
      tile.hostileAge = 0;
      pushLog(globalThis.state, "hostileEscalatedLog", { tile: getHexRegionName(tile), stage: tile.hostileStage });
    }
    if (tile.hostileCooldown > 0) {
      tile.hostileCooldown -= 1;
      return;
    }
    const nearCity = globalThis.state.player.cities.some((city) => hexDistance(tile.q, tile.r, getTileById(city.tileId).q, getTileById(city.tileId).r) <= 3);
    if (!nearCity) return;
    if (getHostileRaiders().some((unit) => unit.sourceTileId === tile.id)) return;
    let raidChance = Math.min(0.16 + tile.hostileStrength * 0.06 + (tile.hostileStage || 1) * 0.04, 0.64);
    if (suppressed) raidChance *= cfg.suppressedRaidChanceMultiplier;
    if (Math.random() > raidChance) return;
    spawnHostileRaider(tile);
    tile.hostileCooldown = 2 + Math.floor(Math.random() * (4 - Math.min(2, tile.hostileStage || 1)));
  });
}

function pickRaiderTargetCity(sourceTile) {
  const cities = [...globalThis.state.player.cities];
  if (!cities.length) return null;
  const scored = cities.map((city) => {
    const ct = getTileById(city.tileId);
    if (!ct) return null;
    const dist = hexDistance(sourceTile.q, sourceTile.r, ct.q, ct.r);
    const guard = city.soldiers + (typeof cityHasBuilding === "function" && cityHasBuilding(city, "training-ground") ? 3 : 0);
    const weakness = 20 / (5 + guard * 2);
    const distFactor = 1 / (1 + dist * 0.12);
    return { city, weight: weakness * distFactor };
  }).filter(Boolean);
  if (!scored.length) return getNearestPlayerCity(sourceTile);
  const total = scored.reduce((sum, x) => sum + x.weight, 0);
  if (total <= 0) return getNearestPlayerCity(sourceTile);
  let roll = Math.random() * total;
  for (const entry of scored) {
    roll -= entry.weight;
    if (roll <= 0) return entry.city;
  }
  return scored[scored.length - 1].city;
}

function getNearestPlayerCity(tile) {
  return [...globalThis.state.player.cities]
    .sort((left, right) => {
      const leftTile = getTileById(left.tileId);
      const rightTile = getTileById(right.tileId);
      return hexDistance(tile.q, tile.r, leftTile.q, leftTile.r) - hexDistance(tile.q, tile.r, rightTile.q, rightTile.r);
    })[0] || getCapitalCity();
}

function spawnHostileRaider(tile) {
  const targetCity = pickRaiderTargetCity(tile);
  if (!targetCity) return;
  const strength = Math.max(1, Math.min(4, (tile.hostileStrength || 1) + ((tile.hostileStage || 1) >= 3 ? 1 : 0)));
  const unit = createHostileRaiderUnit(tile.id, tile.id, targetCity.nameKey, strength);
  globalThis.state.world.units.push(unit);
  pushLog(globalThis.state, "hostileRaiderSpawned", { tile: getHexRegionName(tile), city: getCityName(targetCity) });
  showToast(globalThis.t("toastHostileRaiderSpawned", { tile: getHexRegionName(tile), city: getCityName(targetCity) }), "warn");
}

function getRaiderDestinationTile(raider) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === raider.targetCityKey) || getCapitalCity();
  return city ? getTileById(city.tileId) : null;
}

function getBestNeighborToward(tile, targetTile) {
  if (!tile || !targetTile) return null;
  return getHexNeighbors(tile, globalThis.state.world.hexTiles)
    .filter((neighbor) => neighbor.terrain !== "sea")
    .sort((left, right) => {
      return hexDistance(left.q, left.r, targetTile.q, targetTile.r) - hexDistance(right.q, right.r, targetTile.q, targetTile.r);
    })[0] || null;
}

function processHostileRaiders() {
  const remainingUnits = [];
  getHostileRaiders().forEach((raider) => {
    const currentTile = getTileById(raider.tileId);
    const targetTile = getRaiderDestinationTile(raider);
    if (!currentTile || !targetTile) return;

    const nextTile = getBestNeighborToward(currentTile, targetTile);
    if (nextTile) {
      raider.tileId = nextTile.id;
    }

    const landId = raider.tileId;
    if (typeof wipeSettlerIfRaiderOnTile === "function") {
      wipeSettlerIfRaiderOnTile(landId);
    }
    let raiderEnded = false;
    if (typeof fieldArmyAtTile === "function" && typeof resolveFieldArmyVersusRaider === "function") {
      const blocker = fieldArmyAtTile(landId);
      if (blocker && blocker.type === "army") {
        raiderEnded = resolveFieldArmyVersusRaider(raider, blocker);
      }
    }
    if (raiderEnded) {
      return;
    }

    if (raider.tileId === targetTile.id) {
      resolveRaiderAttack(raider, targetTile);
      return;
    }

    remainingUnits.push(raider);
  });

  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.type !== "hostile-raider").concat(remainingUnits);
}

function resolveRaiderAttack(raider, cityTile) {
  const city = cityAtTile(cityTile.id) || getCapitalCity();
  if (!city) return;
  const sourceTile = getTileById(raider.sourceTileId) || cityTile;

  const outcomeRoll = Math.random();
  if (outcomeRoll < 0.34 && globalThis.state.player.gold > 0) {
    const stolen = Math.min(globalThis.state.player.gold, 4 + raider.strength * 3);
    globalThis.state.player.gold -= stolen;
    pushLog(globalThis.state, "hostileRaidGold", { tile: getHexRegionName(sourceTile), amount: stolen });
    showToast(globalThis.t("hostileRaidGold", { tile: getHexRegionName(sourceTile), amount: stolen }), "danger");
    return;
  }

  if (outcomeRoll < 0.67 && city.population > 1) {
    city.population -= 1;
    unassignOverflow(city);
    pushLog(globalThis.state, "hostileRaidPopulation", { tile: getHexRegionName(sourceTile) });
    showToast(globalThis.t("hostileRaidPopulation", { tile: getHexRegionName(sourceTile) }), "danger");
    return;
  }

  if (city.buildings.length) {
    const lostIndex = Math.floor(Math.random() * city.buildings.length);
    const [lostBuilding] = city.buildings.splice(lostIndex, 1);
    if (lostBuilding) {
      applyBuildingLoss(city, lostBuilding);
      pushLog(globalThis.state, "hostileRaidBuilding", { tile: getHexRegionName(sourceTile), building: getBuildingNameById(lostBuilding) });
      showToast(globalThis.t("hostileRaidBuilding", { tile: getHexRegionName(sourceTile), building: getBuildingNameById(lostBuilding) }), "danger");
      return;
    }
  }

  if (city.soldiers > 0) {
    city.soldiers -= 1;
    pushLog(globalThis.state, "hostileRaidSoldier", { tile: getHexRegionName(sourceTile) });
    showToast(globalThis.t("hostileRaidSoldier", { tile: getHexRegionName(sourceTile) }), "danger");
    return;
  }

  if (city.population > 1) {
    city.population -= 1;
    unassignOverflow(city);
    pushLog(globalThis.state, "hostileRaidPopulation", { tile: getHexRegionName(sourceTile) });
    showToast(globalThis.t("hostileRaidPopulation", { tile: getHexRegionName(sourceTile) }), "danger");
  }
}

function applyBuildingLoss(city, buildingId) {
  const R = typeof BUILDING_REVERSALS !== "undefined" ? BUILDING_REVERSALS : {};

  if (buildingId === "storehouse") {
    const d = R.storehouse || { foodCap: 28, hammerCap: 118 };
    city.foodCap = Math.max(20, city.foodCap - d.foodCap);
    city.hammerCap = Math.max(30, city.hammerCap - d.hammerCap);
  }
  if (buildingId === "granary") {
    const d = R.granary || { foodCap: 36, populationCap: 3, growthDiscount: 14 };
    city.foodCap = Math.max(20, city.foodCap - d.foodCap);
    city.populationCap = Math.max(city.isCapital ? 10 : 8, city.populationCap - d.populationCap);
    city.modifiers.growthDiscount = Math.max(0, city.modifiers.growthDiscount - d.growthDiscount);
  }
  if (buildingId === "houses") {
    const d = R.houses || { populationCap: 5 };
    city.populationCap = Math.max(city.isCapital ? 10 : 8, city.populationCap - d.populationCap);
  }
  if (buildingId === "workshop") {
    const d = R.workshop || { hammerCap: 320, hammerPerMine: 2 };
    city.hammerCap = Math.max(30, city.hammerCap - d.hammerCap);
    city.modifiers.hammerPerMine = Math.max(1, city.modifiers.hammerPerMine - d.hammerPerMine);
  }
  if (buildingId === "market-square") {
    const d = R["market-square"] || { goldCap: 48, goldPerMarket: 4 };
    city.goldCap = Math.max(30, city.goldCap - d.goldCap);
    city.modifiers.goldPerMarket = Math.max(3, city.modifiers.goldPerMarket - d.goldPerMarket);
  }
  if (buildingId === "shrine") {
    const d = R.shrine || { culturePerTemple: 2 };
    city.modifiers.culturePerTemple = Math.max(1, city.modifiers.culturePerTemple - d.culturePerTemple);
  }
  if (buildingId === "dock") {
    const d = R.dock || { shipCap: 3 };
    city.shipCap = Math.max(0, city.shipCap - d.shipCap);
  }
  if (buildingId === "training-ground") {
    const d = R["training-ground"] || { soldierCap: 8, recruitPointsPerBarracks: 0.1 };
    city.soldierCap = Math.max(city.isCapital ? 3 : 2, city.soldierCap - d.soldierCap);
    city.modifiers.recruitPointsPerBarracks = Math.max(
      0.1,
      city.modifiers.recruitPointsPerBarracks - d.recruitPointsPerBarracks,
    );
  }
  city.foodStock = clamp(city.foodStock, 0, city.foodCap);
  city.hammerStock = clamp(city.hammerStock, 0, city.hammerCap);
  city.soldiers = clamp(city.soldiers, 0, city.soldierCap);
  rebalanceWorkers(city);
}

function raiderInterceptChance(raider) {
  if (!raider) return 50;
  const tile = getTileById(raider.tileId);
  if (typeof computeCombatWinPercent === "function") {
    return computeCombatWinPercent(
      "raider_intercept",
      { virtual: { soldiers: Math.max(1, totalSoldiers()), archetype: "line" } },
      { unit: raider },
      tile,
    );
  }
  return clamp(Math.round(30 + (Math.max(1, totalSoldiers()) / Math.max(1, raider.strength)) * 25), 25, 90);
}

function canInterceptRaider(raider) {
  return Boolean(raider && totalSoldiers() >= 1 && !globalThis.state.world.pendingEncounter);
}

function interceptRaider(tileId) {
  const raider = hostileRaiderAtTile(tileId);
  if (!canInterceptRaider(raider)) return;
  const success = Math.random() * 100 <= raiderInterceptChance(raider);
  if (success) {
    globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== raider.id);
    pushLog(globalThis.state, "hostileRaiderIntercepted", { tile: getHexRegionName(getTileById(tileId)) });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastHostileRaiderIntercepted", { tile: getHexRegionName(getTileById(tileId)) }), "success");
  } else {
    spendSoldiers(1);
    pushLog(globalThis.state, "hostileRaiderInterceptionFailed", { tile: getHexRegionName(getTileById(tileId)) });
    globalThis.playDefeatSound();
    showToast(globalThis.t("toastHostileRaiderInterceptionFailed", { tile: getHexRegionName(getTileById(tileId)) }), "danger");
  }
  globalThis.render();
}

/**
 * Triggered when a field army enters a hostile hex from player territory.
 */
function resolveArmyAssaultOnHostileTile(armyUnit, tile) {
  if (!armyUnit || armyUnit.type !== "army" || !tile?.hostile) return;
  const cfg = frontierHostileCfg();
  const soldiers = armyUnit.soldiers || 0;
  if (soldiers <= 0) return;
  const strength = Math.max(1, tile.hostileStrength || 1);
  const stage = Math.max(1, tile.hostileStage || 1);
  const enemyPower = strength + stage * 0.55;
  const winChance =
    typeof computeCombatWinPercent === "function"
      ? computeCombatWinPercent(
          "tribal_assault",
          { unit: armyUnit },
          { archetypeId: "tribal", magnitude: enemyPower },
          tile,
        )
      : clamp(
          Math.round(cfg.assaultWinChanceBase + (soldiers / enemyPower) * cfg.assaultWinChancePerPowerRatio),
          20,
          90,
        );
  const success = Math.random() * 100 <= winChance;
  const tileName = getHexRegionName(tile);
  if (success) {
    tile.hostile = false;
    tile.hostileStrength = 0;
    tile.hostileStage = 0;
    tile.hostileAge = 0;
    tile.hostileCooldown = 0;
    globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 4);
    const casualtyRoll = (strength + stage) * cfg.assaultCasualtyChanceScale;
    if (Math.random() < casualtyRoll && soldiers > 1) {
      armyUnit.soldiers -= 1;
    }
    pushLog(globalThis.state, "frontierArmyAssaultWonLog", { tile: tileName });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastFrontierArmyAssaultWon", { tile: tileName }), "success");
  } else {
    const lost = Math.min(soldiers, Math.max(1, Math.round(stage * 0.6 + strength / 3)));
    armyUnit.soldiers = soldiers - lost;
    tile.hostileStrength = Math.min(8, strength + 1);
    if ((tile.hostileStage || 1) < 3 && Math.random() < 0.45) {
      tile.hostileStage = (tile.hostileStage || 1) + 1;
    }
    tile.hostileCooldown = 1;
    pushLog(globalThis.state, "frontierArmyAssaultLostLog", { tile: tileName, lost });
    globalThis.playDefeatSound();
    showToast(globalThis.t("toastFrontierArmyAssaultLost", { tile: tileName, lost }), "danger");
  }
  if ((armyUnit.soldiers || 0) <= 0) {
    if (typeof maybeClearSelectionIfRemoved === "function") {
      maybeClearSelectionIfRemoved(armyUnit.id);
    }
    globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== armyUnit.id);
  }
}

function resolveHostileEncounter(choice) {
  const encounter = globalThis.state.world.pendingEncounter;
  if (!encounter || encounter.type !== "hostile") return;

  const scout = getPrimaryScout();
  const tile = getTileById(encounter.tileId);

  if (choice === "passage") {
    const cost = typeof getHostilePassageGold === "function" ? getHostilePassageGold(encounter) : 16;
    if (globalThis.state.player.gold < cost) return;
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - cost);
    if (scout) scout.returnTileId = null;
    pushLog(globalThis.state, "hostilePassageLog", { tile: encounter.tileName, gold: cost });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastHostilePassage", { tile: encounter.tileName, gold: cost }), "success");
    globalThis.state.world.pendingEncounter = null;
    globalThis.render();
    return;
  }

  if (choice === "flee") {
    if (scout) {
      scout.tileId = encounter.returnTileId || globalThis.state.world.startTileId;
      scout.targetTileId = null;
      scout.returnTileId = null;
      scout.status = "idle";
    }
    const cfg = typeof scoutEncounterCfg === "function"
      ? scoutEncounterCfg()
      : { fleeSoftHostileChance: 0.44 };
    const soft = Math.random() < cfg.fleeSoftHostileChance;
    if (soft) {
      const str = Math.max(1, (encounter.tribeStrength || 1) - 1);
      markTileHostile(tile, str);
      tile.hostileStage = 1;
      tile.hostileCooldown = Math.max(tile.hostileCooldown || 0, 4);
      pushLog(globalThis.state, "tribeHostileSoftFlee", { tile: encounter.tileName });
      showToast(globalThis.t("toastHostileFleeSoft", { tile: encounter.tileName }), "warn");
    } else {
      markTileHostile(tile, encounter.tribeStrength);
      pushLog(globalThis.state, "tribeHostileEscaped", { tile: encounter.tileName });
      showToast(globalThis.t("toastHostileFlee", { tile: encounter.tileName }), "warn");
    }
    globalThis.state.world.pendingEncounter = null;
    globalThis.render();
    return;
  }

  const success = Math.random() * 100 <= hostileSuccessChance(encounter);
  markTileHostile(tile, encounter.tribeStrength + (success ? 1 : 0));

  if (success) {
    if (choice === "loot") {
      const goldGain = 10 + encounter.tribeStrength * 4;
      globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + goldGain);
      pushLog(globalThis.state, "tribeHostileLooted", { tile: encounter.tileName });
      globalThis.playSuccessSound();
      showToast(globalThis.t("toastHostileLootWin", { tile: encounter.tileName, gold: goldGain }), "success");
    } else {
      const capital = getCapitalCity();
      if (capital) {
        capital.population = Math.min(capital.populationCap, capital.population + 1);
      }
      pushLog(globalThis.state, "tribeHostileTaken", { tile: encounter.tileName });
      globalThis.playSuccessSound();
      showToast(globalThis.t("toastHostilePeopleWin", { tile: encounter.tileName }), "success");
    }
  } else {
    if (scout) {
      globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== scout.id);
    }
    pushLog(globalThis.state, "tribeHostileRepelled", { tile: encounter.tileName });
    globalThis.playDefeatSound();
    showToast(globalThis.t("toastHostileLose", { tile: encounter.tileName }), "danger");
  }

  globalThis.state.world.pendingEncounter = null;
  globalThis.render();
}

Object.assign(globalThis, {
  markTileHostile,
  frontierHostileCfg,
  hostileTileBordersPlayer,
  armyUnitOnTile,
  fieldArmiesAdjacentToTile,
  processHostileFrontier,
  pickRaiderTargetCity,
  getNearestPlayerCity,
  spawnHostileRaider,
  getRaiderDestinationTile,
  getBestNeighborToward,
  processHostileRaiders,
  resolveRaiderAttack,
  applyBuildingLoss,
  raiderInterceptChance,
  canInterceptRaider,
  interceptRaider,
  resolveArmyAssaultOnHostileTile,
  resolveHostileEncounter,
});
