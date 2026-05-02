function scoutEncounterCfg() {
  return typeof SCOUT_ENCOUNTER_CONFIG !== "undefined"
    ? SCOUT_ENCOUNTER_CONFIG
    : {
      traderShareOfPeaceful: 0.24,
      ruinsShareOfPeaceful: 0.22,
      beastWinWeight: 0.4,
      beastWoundWeight: 0.32,
      beastTrophyFood: 5,
      beastTrophyPrestige: 3,
      woundTurns: 2,
      woundHostileOddsPenalty: 12,
      woundFoodCost: 3,
      passageGoldBase: 7,
      passageGoldPerTribeStrength: 3,
      fleeSoftHostileChance: 0.44,
      traderBuyGoldCost: 10,
      traderBuyFood: 10,
      traderBuyCulture: 5,
      traderDeclineDiplomacy: 4,
      ruinsSearchHammer: 6,
      ruinsSearchGold: 14,
      ruinsSearchCulture: 10,
      ruinsSearchPrestige: 5,
      ruinsBadCrisis: 7,
      wildBeastHuntFoodTrophy: 4,
      wildBeastHuntCasualtyScale: 0.065,
    };
}

function getHostilePassageGold(encounter) {
  const cfg = scoutEncounterCfg();
  const s = Math.max(1, encounter?.tribeStrength || 1);
  return cfg.passageGoldBase + s * cfg.passageGoldPerTribeStrength;
}

function wildBeastTileBordersPlayer(tile) {
  if (!tile || tile.terrain === "sea") return false;
  return getHexNeighbors(tile, globalThis.state.world.hexTiles).some(
    (n) => n.owner === "player" && n.terrain !== "sea",
  );
}

function rollWildBeastStrengthForTerrain(tile) {
  const base = {
    forest: 3,
    hill: 2,
    mountain: 3,
    coast: 2,
    river: 2,
    plain: 2,
    sea: 1,
  };
  return (base[tile?.terrain] ?? 2) + Math.floor(Math.random() * 2);
}

function markTileWildBeast(tile) {
  if (!tile || tile.terrain === "sea") return;
  tile.wildBeast = true;
  tile.wildBeastStrength = rollWildBeastStrengthForTerrain(tile);
}

function clearWildBeast(tile) {
  if (!tile) return;
  tile.wildBeast = false;
  tile.wildBeastStrength = 0;
}

/**
 * Field army enters a hex where a beast lurks (scout fled/was wounded/killed).
 */
function resolveArmyVsWildBeastTile(armyUnit, tile) {
  if (!armyUnit || armyUnit.type !== "army" || !tile?.wildBeast) return;
  const cfg = scoutEncounterCfg();
  const beast = Math.max(1, tile.wildBeastStrength || 2);
  const soldiers = armyUnit.soldiers || 0;
  if (soldiers <= 0) return;
  const winChance =
    typeof computeCombatWinPercent === "function"
      ? computeCombatWinPercent(
          "beast_hunt",
          { unit: armyUnit },
          { archetypeId: "beast", magnitude: beast },
          tile,
        )
      : clamp(Math.round(36 + (soldiers / beast) * 30), 18, 92);
  const success = Math.random() * 100 <= winChance;
  const tileName = getHexRegionName(tile);
  const capital = getCapitalCity();
  if (success) {
    clearWildBeast(tile);
    globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 3);
    if (capital && cfg.wildBeastHuntFoodTrophy > 0) {
      capital.foodStock = clamp(capital.foodStock + cfg.wildBeastHuntFoodTrophy, 0, capital.foodCap);
    }
    const casualtyRoll = beast * cfg.wildBeastHuntCasualtyScale;
    if (Math.random() < casualtyRoll && soldiers > 1) {
      armyUnit.soldiers -= 1;
    }
    pushLog(globalThis.state, "wildBeastHuntWinLog", { tile: tileName });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastWildBeastHuntWin", { tile: tileName }), "success");
  } else {
    const lost = Math.min(soldiers, Math.max(1, Math.round(beast / 2)));
    armyUnit.soldiers = soldiers - lost;
    tile.wildBeastStrength = Math.min(7, beast + 1);
    pushLog(globalThis.state, "wildBeastHuntLoseLog", { tile: tileName, lost });
    globalThis.playDefeatSound();
    showToast(globalThis.t("toastWildBeastHuntLose", { tile: tileName, lost }), "danger");
  }
  if ((armyUnit.soldiers || 0) <= 0) {
    if (typeof maybeClearSelectionIfRemoved === "function") {
      maybeClearSelectionIfRemoved(armyUnit.id);
    }
    globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== armyUnit.id);
  }
}

function processScoutTurn() {
  const scout = getPrimaryScout();
  if (scout && (scout.woundTurns || 0) > 0) {
    scout.woundTurns -= 1;
  }
  if (!scout) return;

  if (scout.status === "deploying") {
    scout.status = "idle";
    pushLog(globalThis.state, "scoutDeployedLog");
    return;
  }

  if (!scout.targetTileId) return;

  const tile = getTileById(scout.targetTileId);
  if (!tile) {
    scout.targetTileId = null;
    scout.status = "idle";
    return;
  }

  if (scout.status === "moving") {
    scout.tileId = tile.id;
    scout.targetTileId = null;
    scout.status = "idle";
    pushLog(globalThis.state, "scoutMovedLog", { tile: getHexRegionName(tile) });
    return;
  }

  if (scout.status === "exploring") {
    scout.tileId = tile.id;
    scout.targetTileId = null;
    scout.status = "idle";
    revealRadius(globalThis.state.world.hexTiles, tile.id, 0);
    maybeLogFactionDiscovery(tile);

    const encounter = rollScoutEncounter(tile);
    if (!encounter) {
      pushLog(globalThis.state, "scoutQuietLog", { tile: getHexRegionName(tile) });
      scout.returnTileId = null;
      return;
    }

    encounter.returnTileId = scout.returnTileId || globalThis.state.world.startTileId;
    globalThis.state.world.pendingEncounter = encounter;
    if (encounter.type === "beast") {
      pushLog(globalThis.state, "scoutBeastLog", { tile: encounter.tileName });
    } else if (encounter.type === "hostile") {
      pushLog(globalThis.state, "scoutHostileLog", { tile: encounter.tileName });
    } else if (encounter.type === "trader") {
      pushLog(globalThis.state, "scoutTraderLog", { tile: encounter.tileName });
    } else if (encounter.type === "ruins") {
      pushLog(globalThis.state, "scoutRuinsLog", { tile: encounter.tileName });
    } else {
      pushLog(globalThis.state, "scoutFriendlyLog", { tile: encounter.tileName });
    }
  }
}

function processWorkerTurn() {
  getWorkerUnits().forEach((worker) => {
    if (worker.status === "moving" && worker.targetTileId) {
      const tile = getTileById(worker.targetTileId);
      if (!tile) {
        worker.status = "idle";
        worker.targetTileId = null;
        return;
      }
      worker.tileId = tile.id;
      worker.targetTileId = null;
      worker.status = "idle";
      pushLog(globalThis.state, "workerMovedLog", { tile: getHexRegionName(tile) });
      return;
    }

    if (worker.status === "extracting" && worker.taskTileId) {
      worker.taskTurns = Math.max(0, worker.taskTurns - 1);
      if (worker.taskTurns > 0) return;
      const tile = getTileById(worker.taskTileId);
      if (tile && tile.resource && canExtractResource(tile.resource) && !tile.resourceImproved) {
        tile.resourceImproved = true;
        globalThis.state.player.resources[tile.resource] = (globalThis.state.player.resources[tile.resource] || 0) + 1;
        pushLog(globalThis.state, "workerExtractLog", { tile: getHexRegionName(tile), resource: getResourceDisplayName(tile.resource) });
        showToast(globalThis.t("workerExtractLog", { tile: getHexRegionName(tile), resource: getResourceDisplayName(tile.resource) }), "success");
        spendWorkerBuildCharge(worker);
      }
      worker.status = "idle";
      worker.taskType = null;
      worker.resourceId = null;
      worker.taskTileId = null;
      worker.taskTurns = 0;
      return;
    }

    if (worker.status === "enclosing" && worker.taskTileId) {
      worker.taskTurns = Math.max(0, worker.taskTurns - 1);
      if (worker.taskTurns > 0) return;
      const tile = getTileById(worker.taskTileId);
      if (tile && tile.owner === "neutral" && tile.terrain !== "sea") {
        tile.owner = "player";
        tile.factionId = "player";
        tile.enclosed = true;
        tile.discovered = true;
        worker.tileId = tile.id;
        globalThis.state.world.territory = globalThis.state.world.hexTiles.filter((entry) => entry.owner === "player").length;
        revealRadius(globalThis.state.world.hexTiles, tile.id, 1);
        pushLog(globalThis.state, "workerEnclosureLog", { tile: getHexRegionName(tile) });
        showToast(globalThis.t("workerEnclosureDoneToast", { tile: getHexRegionName(tile) }), "success");
        spendWorkerBuildCharge(worker);
      }
      worker.status = "idle";
      worker.taskType = null;
      worker.targetTileId = null;
      worker.taskTileId = null;
      worker.taskTurns = 0;
    }
  });
}

function spendWorkerBuildCharge(worker) {
  worker.buildCharges = Math.max(0, (worker.buildCharges ?? WORKER_CONFIG.buildCharges) - 1);
  if (worker.buildCharges > 0) return;
  globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== worker.id);
  if (globalThis.uiState.selectedArmyId === worker.id) {
    globalThis.uiState.selectedArmyId = null;
  }
  pushLog(globalThis.state, "workerSpentLog");
  showToast(globalThis.t("workerSpentToast"), "info");
}

function maybeLogFactionDiscovery(tile) {
  if (tile.owner !== "rival" || !tile.factionId) return;
  const factionState = globalThis.state.world.factions[tile.factionId];
  if (factionState && !factionState.met) {
    factionState.met = true;
    pushLog(globalThis.state, "scoutMetFactionLog", { faction: FACTIONS[tile.factionId].name });
  }
}

function rollScoutEncounter(tile) {
  const dangerChance = getDangerChance(tile);
  const friendlyChance = getFriendlyChance(tile);
  const hostileChance = getHostileChance(tile);
  const roll = Math.random();
  if (roll < dangerChance) {
    return {
      type: "beast",
      tileId: tile.id,
      tileName: getHexRegionName(tile),
    };
  }
  if (roll < dangerChance + hostileChance) {
    return {
      type: "hostile",
      tileId: tile.id,
      tileName: getHexRegionName(tile),
      tribeStrength: rollTribeStrength(tile),
    };
  }
  if (roll < dangerChance + hostileChance + friendlyChance) {
    const cfg = scoutEncounterCfg();
    const u = Math.random();
    const ts = cfg.traderShareOfPeaceful;
    const rs = cfg.ruinsShareOfPeaceful;
    if (u < ts) {
      return { type: "trader", tileId: tile.id, tileName: getHexRegionName(tile) };
    }
    if (u < ts + rs) {
      return { type: "ruins", tileId: tile.id, tileName: getHexRegionName(tile) };
    }
    return { type: "friendly", tileId: tile.id, tileName: getHexRegionName(tile) };
  }
  return null;
}

function getDangerChance(tile) {
  const terrainChance = {
    forest: 0.42,
    hill: 0.36,
    mountain: 0.4,
    coast: 0.24,
    river: 0.18,
    plain: 0.22,
    sea: 0,
  };
  return terrainChance[tile.terrain] ?? 0.25;
}

function getFriendlyChance(tile) {
  const terrainChance = {
    forest: 0.12,
    hill: 0.15,
    mountain: 0.08,
    coast: 0.18,
    river: 0.26,
    plain: 0.24,
    sea: 0,
  };
  return terrainChance[tile.terrain] ?? 0.18;
}

function getHostileChance(tile) {
  const terrainChance = {
    forest: 0.18,
    hill: 0.2,
    mountain: 0.22,
    coast: 0.12,
    river: 0.08,
    plain: 0.14,
    sea: 0,
  };
  const base = terrainChance[tile.terrain] ?? 0.12;
  const cfg = typeof FRONTIER_HOSTILE_CONFIG !== "undefined"
    ? FRONTIER_HOSTILE_CONFIG
    : { scoutHostileChancePerExistingTile: 0.014, scoutHostileChanceCapBonus: 0.09 };
  const existing = typeof hostileFrontierTiles === "function" ? hostileFrontierTiles().length : 0;
  const heat = Math.min(cfg.scoutHostileChanceCapBonus, existing * cfg.scoutHostileChancePerExistingTile);
  return Math.min(0.52, base + heat);
}

function rollTribeStrength(tile) {
  const terrainBase = {
    forest: 2,
    hill: 2,
    mountain: 3,
    coast: 1,
    river: 1,
    plain: 2,
    sea: 0,
  };
  return (terrainBase[tile.terrain] ?? 1) + Math.floor(Math.random() * 2);
}

function hostileSuccessChance(encounter) {
  const scout = getPrimaryScout();
  const tribeStrength = Math.max(1, encounter?.tribeStrength || 1);
  const cfg = scoutEncounterCfg();
  const encounterTile = encounter?.tileId ? getTileById(encounter.tileId) : null;
  let odds =
    typeof computeCombatWinPercent === "function" && scout
      ? computeCombatWinPercent(
          "scout_vs_tribal",
          { unit: scout },
          { archetypeId: "tribal", magnitude: tribeStrength },
          encounterTile,
        )
      : clamp(Math.round(25 + ((scout?.soldiers || 1) / tribeStrength) * 45), 15, 85);
  if ((scout?.woundTurns || 0) > 0) {
    odds = clamp(odds - cfg.woundHostileOddsPenalty, 8, 85);
  }
  return odds;
}

function resolveBeastEncounter(choice) {
  const encounter = globalThis.state.world.pendingEncounter;
  if (!encounter || encounter.type !== "beast") return;

  const scout = getPrimaryScout();
  const cfg = scoutEncounterCfg();
  const capital = getCapitalCity();
  const encounterTile = getTileById(encounter.tileId);
  if (choice === "fight") {
    const r = Math.random();
    if (r < cfg.beastWinWeight) {
      if (encounterTile) clearWildBeast(encounterTile);
      globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + cfg.beastTrophyPrestige);
      if (capital) {
        capital.foodStock = clamp(capital.foodStock + cfg.beastTrophyFood, 0, capital.foodCap);
      }
      if (scout) scout.returnTileId = null;
      pushLog(globalThis.state, "scoutFightWin", { tile: encounter.tileName });
      globalThis.playSuccessSound();
      showToast(globalThis.t("toastBeastFightWin", { tile: encounter.tileName }), "success");
    } else if (r < cfg.beastWinWeight + cfg.beastWoundWeight) {
      if (encounterTile) markTileWildBeast(encounterTile);
      if (scout) {
        scout.woundTurns = Math.max(scout.woundTurns || 0, cfg.woundTurns);
        scout.tileId = encounter.returnTileId || globalThis.state.world.startTileId;
        scout.targetTileId = null;
        scout.returnTileId = null;
        scout.status = "idle";
      }
      if (capital && cfg.woundFoodCost > 0) {
        capital.foodStock = Math.max(0, capital.foodStock - cfg.woundFoodCost);
      }
      globalThis.state.world.prestige = Math.max(0, globalThis.state.world.prestige - 1);
      pushLog(globalThis.state, "scoutFightWound", { tile: encounter.tileName });
      globalThis.playDefeatSound();
      showToast(globalThis.t("toastBeastWound", { tile: encounter.tileName }), "warn");
    } else {
      if (encounterTile) markTileWildBeast(encounterTile);
      if (scout) {
        globalThis.state.world.units = globalThis.state.world.units.filter((unit) => unit.id !== scout.id);
      }
      pushLog(globalThis.state, "scoutFightLose", { tile: encounter.tileName });
      globalThis.playDefeatSound();
      showToast(globalThis.t("toastBeastFightLose", { tile: encounter.tileName }), "danger");
    }
  } else {
    if (encounterTile) markTileWildBeast(encounterTile);
    if (scout) {
      scout.tileId = encounter.returnTileId || globalThis.state.world.startTileId;
      scout.targetTileId = null;
      scout.returnTileId = null;
      scout.status = "idle";
    }
    pushLog(globalThis.state, "scoutFled", { tile: encounter.tileName });
    showToast(globalThis.t("toastBeastFlee", { tile: encounter.tileName }), "warn");
  }

  globalThis.state.world.pendingEncounter = null;
  globalThis.render();
}

function resolveFriendlyEncounter(choice) {
  const encounter = globalThis.state.world.pendingEncounter;
  if (!encounter || encounter.type !== "friendly") return;

  const capital = getCapitalCity();
  const scout = getPrimaryScout();
  if (choice === "join" && capital) {
    capital.population = Math.min(capital.populationCap, capital.population + 1);
    pushLog(globalThis.state, "tribeJoined");
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastFriendlyJoin"), "success");
  } else if (choice === "gold") {
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + 14);
    pushLog(globalThis.state, "tribeGiftedGold");
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastFriendlyGold"), "success");
  } else if (choice === "culture") {
    globalThis.state.player.culture += 12;
    pushLog(globalThis.state, "tribeSharedCulture");
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastFriendlyCulture"), "success");
  } else if (choice === "insight") {
    revealRadius(globalThis.state.world.hexTiles, encounter.tileId, 1);
    globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 3);
    pushLog(globalThis.state, "tribeInsightLog", { tile: encounter.tileName });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastFriendlyInsight", { tile: encounter.tileName }), "success");
  }

  if (scout) scout.returnTileId = null;
  globalThis.state.world.pendingEncounter = null;
  globalThis.render();
}

function resolveTraderEncounter(choice) {
  const encounter = globalThis.state.world.pendingEncounter;
  if (!encounter || encounter.type !== "trader") return;
  const cfg = scoutEncounterCfg();
  const capital = getCapitalCity();
  const scout = getPrimaryScout();
  if (choice === "buy") {
    if (globalThis.state.player.gold < cfg.traderBuyGoldCost) return;
    globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - cfg.traderBuyGoldCost);
    if (capital) {
      capital.foodStock = clamp(capital.foodStock + cfg.traderBuyFood, 0, capital.foodCap);
    }
    globalThis.state.player.culture += cfg.traderBuyCulture;
    pushLog(globalThis.state, "traderBuyLog", { tile: encounter.tileName });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastTraderBuy", { tile: encounter.tileName }), "success");
  } else {
    globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + cfg.traderDeclineDiplomacy);
    pushLog(globalThis.state, "traderDeclineLog", { tile: encounter.tileName });
    showToast(globalThis.t("toastTraderDecline"), "info");
  }
  if (scout) scout.returnTileId = null;
  globalThis.state.world.pendingEncounter = null;
  globalThis.render();
}

function resolveRuinsEncounter(choice) {
  const encounter = globalThis.state.world.pendingEncounter;
  if (!encounter || encounter.type !== "ruins") return;
  const cfg = scoutEncounterCfg();
  const capital = getCapitalCity();
  const scout = getPrimaryScout();
  if (choice === "leave") {
    globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 3);
    pushLog(globalThis.state, "ruinsLeaveLog", { tile: encounter.tileName });
    globalThis.playSuccessSound();
    showToast(globalThis.t("toastRuinsLeave", { tile: encounter.tileName }), "success");
  } else {
    const roll = Math.random();
    if (roll < 0.28) {
      if (capital) {
        capital.hammerStock = clamp(capital.hammerStock + cfg.ruinsSearchHammer, 0, capital.hammerCap);
        pushLog(globalThis.state, "ruinsSearchHammerLog", { tile: encounter.tileName });
        showToast(globalThis.t("toastRuinsHammer", { tile: encounter.tileName }), "success");
      } else {
        globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + Math.floor(cfg.ruinsSearchGold * 0.75));
        pushLog(globalThis.state, "ruinsSearchGoldLog", { tile: encounter.tileName });
        showToast(globalThis.t("toastRuinsGold", { tile: encounter.tileName }), "success");
      }
      globalThis.playSuccessSound();
    } else if (roll < 0.52) {
      globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold + cfg.ruinsSearchGold);
      pushLog(globalThis.state, "ruinsSearchGoldLog", { tile: encounter.tileName });
      showToast(globalThis.t("toastRuinsGold", { tile: encounter.tileName }), "success");
      globalThis.playSuccessSound();
    } else if (roll < 0.74) {
      globalThis.state.player.culture += cfg.ruinsSearchCulture;
      pushLog(globalThis.state, "ruinsSearchCultureLog", { tile: encounter.tileName });
      showToast(globalThis.t("toastRuinsCulture", { tile: encounter.tileName }), "success");
      globalThis.playSuccessSound();
    } else if (roll < 0.88) {
      globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + cfg.ruinsSearchPrestige);
      pushLog(globalThis.state, "ruinsSearchPrestigeLog", { tile: encounter.tileName });
      showToast(globalThis.t("toastRuinsPrestige", { tile: encounter.tileName }), "success");
      globalThis.playSuccessSound();
    } else {
      globalThis.state.world.crisisPressure = clamp(globalThis.state.world.crisisPressure + cfg.ruinsBadCrisis, 0, 100);
      pushLog(globalThis.state, "ruinsSearchOmenLog", { tile: encounter.tileName });
      globalThis.playDefeatSound();
      showToast(globalThis.t("toastRuinsOmen", { tile: encounter.tileName }), "warn");
    }
  }
  if (scout) scout.returnTileId = null;
  globalThis.state.world.pendingEncounter = null;
  globalThis.render();
}

Object.assign(globalThis, {
  scoutEncounterCfg,
  getHostilePassageGold,
  wildBeastTileBordersPlayer,
  rollWildBeastStrengthForTerrain,
  markTileWildBeast,
  clearWildBeast,
  resolveArmyVsWildBeastTile,
  processScoutTurn,
  processWorkerTurn,
  spendWorkerBuildCharge,
  maybeLogFactionDiscovery,
  rollScoutEncounter,
  getDangerChance,
  getFriendlyChance,
  getHostileChance,
  rollTribeStrength,
  hostileSuccessChance,
  resolveBeastEncounter,
  resolveFriendlyEncounter,
  resolveTraderEncounter,
  resolveRuinsEncounter,
});
