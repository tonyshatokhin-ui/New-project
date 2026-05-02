function getScoutStatusText(scout) {
  if (!scout) return "";
  if ((scout.woundTurns || 0) > 0) return globalThis.t("scoutWounded", { turns: scout.woundTurns });
  if (scout.status === "deploying") return globalThis.t("scoutDeploying");
  if (scout.status === "moving" && scout.targetTileId) return globalThis.t("scoutMoving", { tile: scout.targetTileId });
  if (scout.status === "exploring" && scout.targetTileId) return globalThis.t("scoutExploring", { tile: scout.targetTileId });
  return globalThis.t("scoutIdle");
}

function getWorkerStatusText(worker) {
  if (!worker) return "";
  const charges = getWorkerBuildCharges(worker);
  if (worker.status === "moving" && worker.targetTileId) {
    return `${globalThis.t("workerStatusMoving", { tile: getHexRegionName(getTileById(worker.targetTileId)) })} ${globalThis.t("workerCharges", { count: charges })}`;
  }
  if (worker.status === "extracting" && worker.taskTileId) {
    return `${globalThis.t("workerStatusExtracting", { tile: getHexRegionName(getTileById(worker.taskTileId)), turns: worker.taskTurns })} ${globalThis.t("workerCharges", { count: charges })}`;
  }
  if (worker.status === "enclosing" && worker.taskTileId) {
    return `${globalThis.t("workerStatusEnclosing", { tile: getHexRegionName(getTileById(worker.taskTileId)), turns: worker.taskTurns })} ${globalThis.t("workerCharges", { count: charges })}`;
  }
  return `${globalThis.t("workerStatusIdle", { tile: getHexRegionName(getTileById(worker.tileId)) })} ${globalThis.t("workerCharges", { count: charges })}`;
}

function canMoveScoutToTile(tile) {
  const scout = getPrimaryScout();
  if (!scout || scout.status !== "idle" || globalThis.state.world.pendingEncounter) return false;
  if (!tile || !tile.discovered || tile.terrain === "sea") return false;
  if (tile.wildBeast) return false;
  if (tile.id === scout.tileId) return false;
  const scoutTile = getTileById(scout.tileId);
  if (!scoutTile) return false;
  return getHexNeighbors(scoutTile, globalThis.state.world.hexTiles).some((neighbor) => neighbor.id === tile.id && neighbor.discovered);
}

function moveScoutToTile(tileId) {
  const tile = getTileById(tileId);
  const scout = getPrimaryScout();
  if (!tile || !scout || !canMoveScoutToTile(tile)) return;
  scout.targetTileId = tileId;
  scout.status = "moving";
  pushLog(globalThis.state, "scoutOrderedLog", { tile: tileId });
  globalThis.playScoutMoveSound();
  showToast(globalThis.t("toastScoutMoveOrder", { tile: getHexRegionName(tile) }), "info");
  globalThis.render();
}

function canScoutExploreTile(tile) {
  const scout = getPrimaryScout();
  if (!scout || scout.status !== "idle" || globalThis.state.world.pendingEncounter) return false;
  if (!tile || tile.discovered || tile.terrain === "sea") return false;
  const scoutTile = getTileById(scout.tileId);
  if (!scoutTile) return false;
  return getHexNeighbors(scoutTile, globalThis.state.world.hexTiles).some((neighbor) => neighbor.id === tile.id);
}

function getPacifyCost(tile) {
  return 10 + (tile?.hostileStrength || 1) * 4;
}

function countSoldiersInArmiesBesiegingHostile(tile) {
  if (!tile || typeof getHexNeighbors !== "function") return 0;
  let sum = 0;
  getHexNeighbors(tile, globalThis.state.world.hexTiles).forEach((hex) => {
    const u = globalThis.state.world.units.find(
      (x) => x.type === "army" && x.tileId === hex.id && x.status !== "moving",
    );
    if (u) sum += u.soldiers || 0;
  });
  return sum;
}

/** Extra punitive-raid success % from field armies camped on hexes touching this hostile tile. */
function punitiveRaidBonusFromAdjacentArmies(tile) {
  const cfg = typeof FRONTIER_HOSTILE_CONFIG !== "undefined"
    ? FRONTIER_HOSTILE_CONFIG
    : { punitiveRaidAdjacentArmyBonus: 14 };
  const n = countSoldiersInArmiesBesiegingHostile(tile);
  if (n <= 0) return 0;
  return Math.min(24, cfg.punitiveRaidAdjacentArmyBonus + Math.floor(n / 2));
}

function getTributeCalmCost(tile) {
  const cfg = typeof FRONTIER_HOSTILE_CONFIG !== "undefined"
    ? FRONTIER_HOSTILE_CONFIG
    : { tributeCalmCostFraction: 0.48, tributeCalmGoldFloor: 5 };
  return Math.max(cfg.tributeCalmGoldFloor, Math.floor(getPacifyCost(tile) * cfg.tributeCalmCostFraction));
}

function canLaunchPunitiveRaid(tile) {
  return Boolean(tile?.hostile && !globalThis.state.world.pendingEncounter && totalSoldiers() >= 1);
}

function punitiveRaidChance(tile) {
  const strength = Math.max(1, tile?.hostileStrength || 1);
  const base =
    typeof computeCombatWinPercent === "function"
      ? computeCombatWinPercent(
          "punitive_raid",
          { virtual: { soldiers: Math.max(1, totalSoldiers()), archetype: "line" } },
          { archetypeId: "tribal", magnitude: strength },
          tile,
        )
      : clamp(Math.round(20 + (totalSoldiers() / strength) * 25), 20, 90);
  const camp = punitiveRaidBonusFromAdjacentArmies(tile);
  return clamp(base + camp, 20, 95);
}

function canTributeCalmHostileTile(tile) {
  if (!tile?.hostile || globalThis.state.world.pendingEncounter) return false;
  const stage = tile.hostileStage || 1;
  const str = tile.hostileStrength || 1;
  if (stage <= 1 && str <= 1) return false;
  return globalThis.state.player.gold >= getTributeCalmCost(tile);
}

function tributeCalmHostileTile(tileId) {
  const tile = getTileById(tileId);
  if (!canTributeCalmHostileTile(tile)) return;
  const cost = getTributeCalmCost(tile);
  globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - cost);
  tile.hostileStage = Math.max(1, (tile.hostileStage || 1) - 1);
  tile.hostileStrength = Math.max(1, (tile.hostileStrength || 1) - 1);
  tile.hostileAge = 0;
  tile.hostileCooldown = Math.max(tile.hostileCooldown || 0, 1);
  globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 1);
  const tileName = getHexRegionName(tile);
  pushLog(globalThis.state, "tributeCalmHostileLog", { tile: tileName });
  globalThis.playSuccessSound();
  showToast(globalThis.t("toastTributeCalmHostile", { tile: tileName, gold: cost }), "success");
  globalThis.render();
}

function launchPunitiveRaid(tileId) {
  const tile = getTileById(tileId);
  if (!canLaunchPunitiveRaid(tile)) return;
  const tileName = getHexRegionName(tile);

  const success = Math.random() * 100 <= punitiveRaidChance(tile);
  if (success) {
    tile.hostile = false;
    tile.hostileStrength = 0;
    tile.hostileStage = 0;
    tile.hostileAge = 0;
    tile.hostileCooldown = 0;
    globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 3);
    pushLog(globalThis.state, "punitiveRaidWin", { tile: tileName });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastPunitiveRaidWin", { tile: tileName }), "success");
  } else {
    spendSoldiers(1);
    tile.hostileStrength += 1;
    tile.hostileCooldown = 1;
    pushLog(globalThis.state, "punitiveRaidLose", { tile: tileName });
    globalThis.playDefeatSound();
    showToast(globalThis.t("toastPunitiveRaidLose", { tile: tileName }), "danger");
  }
  globalThis.render();
}

function canPacifyHostileTile(tile) {
  return Boolean(tile?.hostile && !globalThis.state.world.pendingEncounter && globalThis.state.player.gold >= getPacifyCost(tile));
}

function pacifyHostileTile(tileId) {
  const tile = getTileById(tileId);
  if (!canPacifyHostileTile(tile)) return;
  const cost = getPacifyCost(tile);
  const tileName = getHexRegionName(tile);
  globalThis.state.player.gold -= cost;
  tile.hostile = false;
  tile.hostileStrength = 0;
  tile.hostileStage = 0;
  tile.hostileAge = 0;
  tile.hostileCooldown = 0;
  globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 2);
  pushLog(globalThis.state, "pacifyTribeLog", { tile: tileName });
  globalThis.playSuccessSound();
  showToast(globalThis.t("toastPacifyTile", { tile: tileName, gold: cost }), "success");
  globalThis.render();
}

function sendScoutToTile(tileId) {
  const tile = getTileById(tileId);
  const scout = getPrimaryScout();
  if (!tile || !scout || !canScoutExploreTile(tile)) return;
  scout.targetTileId = tileId;
  scout.returnTileId = scout.tileId;
  scout.status = "exploring";
  pushLog(globalThis.state, "scoutExploredLog", { tile: tileId });
  globalThis.playScoutMoveSound();
  showToast(globalThis.t("toastScoutExploreOrder", { tile: getHexRegionName(tile) }), "info");
  globalThis.render();
}

function canRaiseScout() {
  if (getPrimaryScout()) return false;
  const capital = getCapitalCity();
  return Boolean(capital && capital.soldiers > 0 && !globalThis.state.world.pendingEncounter);
}

function canTrainWorker(city) {
  return Boolean(city && city.workerTrainingTurns <= 0 && globalThis.state.player.gold >= WORKER_CONFIG.trainingCostGold);
}

function trainWorker(cityNameKey) {
  const city = globalThis.state.player.cities.find((item) => item.nameKey === cityNameKey);
  if (!canTrainWorker(city)) return;
  globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - WORKER_CONFIG.trainingCostGold);
  city.workerTrainingTurns = WORKER_CONFIG.trainingTurns;
  globalThis.render();
}

function getWorkerUnits() {
  return globalThis.state.world.units.filter((unit) => unit.type === "worker");
}

function getWorkerUnitsForCity(cityNameKey) {
  return getWorkerUnits().filter((unit) => unit.homeCityKey === cityNameKey);
}

function getSelectedWorker() {
  const worker = getWorkerUnits().find((unit) => unit.id === globalThis.uiState.selectedArmyId);
  return worker || null;
}

function workerAtTile(tileId) {
  return getWorkerUnits().find((unit) => unit.tileId === tileId && unit.status !== "moving") || null;
}

function canMoveSelectedWorkerToTile(tile) {
  const worker = getSelectedWorker();
  if (!worker || worker.status !== "idle" || globalThis.state.world.pendingEncounter) return false;
  if (!tile || !tile.discovered || tile.terrain === "sea" || tile.owner !== "player") return false;
  if (tile.id === worker.tileId) return false;
  const workerTile = getTileById(worker.tileId);
  if (!workerTile) return false;
  return getHexNeighbors(workerTile, globalThis.state.world.hexTiles).some((neighbor) => neighbor.id === tile.id && neighbor.discovered && neighbor.owner === "player");
}

function canBuildEnclosureOnTile(tile) {
  const worker = getSelectedWorker();
  if (!worker || worker.status !== "idle" || globalThis.state.world.pendingEncounter) return false;
  if (!workerHasBuildCharges(worker)) return false;
  if (!tile || !tile.discovered || tile.terrain === "sea" || tile.owner !== "neutral") return false;
  if (tile.enclosed || tile.hostile || tile.wildBeast) return false;
  const workerTile = getTileById(worker.tileId);
  if (!workerTile || workerTile.owner !== "player") return false;
  return getHexNeighbors(workerTile, globalThis.state.world.hexTiles).some((neighbor) => neighbor.id === tile.id);
}

function moveWorkerToTile(tileId) {
  const tile = getTileById(tileId);
  const worker = getSelectedWorker();
  if (!tile || !worker || !canMoveSelectedWorkerToTile(tile)) return;
  worker.targetTileId = tileId;
  worker.status = "moving";
  pushLog(globalThis.state, "workerMovedLog", { tile: getHexRegionName(tile) });
  globalThis.playScoutMoveSound();
  showToast(globalThis.t("workerMoveToast", { tile: getHexRegionName(tile) }), "info");
  globalThis.render();
}

function canExtractTile(tile) {
  const worker = getSelectedWorker();
  if (!worker || worker.status !== "idle" || !tile || !tile.discovered || tile.owner !== "player") return false;
  if (!workerHasBuildCharges(worker)) return false;
  if (worker.tileId !== tile.id) return false;
  if (!tile.resource || !canExtractResource(tile.resource) || tile.resourceImproved) return false;
  return !getWorkerUnits().some((unit) => unit.status === "extracting" && unit.taskTileId === tile.id);
}

function startResourceExtraction(tileId) {
  const tile = getTileById(tileId);
  const worker = getSelectedWorker();
  if (!tile || !worker || !canExtractTile(tile)) return;
  worker.status = "extracting";
  worker.taskType = "extracting";
  worker.taskTileId = tileId;
  worker.taskTurns = WORKER_CONFIG.extractionTurns;
  worker.resourceId = tile.resource;
  showToast(globalThis.t("workerExtractToast", { tile: getHexRegionName(tile), resource: getResourceDisplayName(tile.resource) }), "info");
  globalThis.render();
}

function raiseScout() {
  if (!canRaiseScout()) return;
  const capital = getCapitalCity();
  capital.soldiers -= 1;
  globalThis.state.world.units.push(createScoutUnit(globalThis.state.world.startTileId, capital.nameKey));
  pushLog(globalThis.state, "scoutReadyLog");
  globalThis.render();
}

function startEnclosure(tileId) {
  const tile = getTileById(tileId);
  const worker = getSelectedWorker();
  if (!tile || !worker || !canBuildEnclosureOnTile(tile)) return;
  worker.status = "enclosing";
  worker.taskType = "enclosing";
  worker.taskTileId = tileId;
  worker.targetTileId = tileId;
  worker.taskTurns = WORKER_CONFIG.enclosureTurns;
  showToast(globalThis.t("workerEnclosureToast", { tile: getHexRegionName(tile) }), "info");
  globalThis.render();
}

function getWorkerBuildCharges(worker) {
  return worker?.buildCharges ?? WORKER_CONFIG.buildCharges;
}

function workerHasBuildCharges(worker) {
  return getWorkerBuildCharges(worker) > 0;
}

Object.assign(globalThis, {
  getScoutStatusText,
  getWorkerStatusText,
  canMoveScoutToTile,
  moveScoutToTile,
  canScoutExploreTile,
  getPacifyCost,
  countSoldiersInArmiesBesiegingHostile,
  punitiveRaidBonusFromAdjacentArmies,
  getTributeCalmCost,
  canLaunchPunitiveRaid,
  punitiveRaidChance,
  canTributeCalmHostileTile,
  tributeCalmHostileTile,
  launchPunitiveRaid,
  canPacifyHostileTile,
  pacifyHostileTile,
  sendScoutToTile,
  canRaiseScout,
  canTrainWorker,
  trainWorker,
  getWorkerUnits,
  getWorkerUnitsForCity,
  getSelectedWorker,
  workerAtTile,
  canMoveSelectedWorkerToTile,
  canBuildEnclosureOnTile,
  moveWorkerToTile,
  canExtractTile,
  startResourceExtraction,
  raiseScout,
  startEnclosure,
  getWorkerBuildCharges,
  workerHasBuildCharges,
});
