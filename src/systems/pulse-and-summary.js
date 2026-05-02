/** Turn-over-turn empire deltas for UI summary + mid-game event pulses (after early game). */

const MID_GAME_CITY_CRISIS_FROM_TURN = 12;
const MID_GAME_WORLD_CRISIS_FROM_TURN = 14;
const MID_GAME_PULSE_FROM_TURN = 10;

function snapshotEmpireTurnMetrics() {
  const foodTotal = typeof totalEmpireFood === "function"
    ? totalEmpireFood()
    : globalThis.state.player.cities.reduce((sum, city) => sum + city.foodStock, 0);
  return {
    gold: globalThis.state.player.gold,
    culture: globalThis.state.player.culture,
    diplomacy: globalThis.state.world.diplomacy,
    prestige: globalThis.state.world.prestige,
    territory: globalThis.state.world.territory,
    foodTotal,
  };
}

function signedInt(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function buildTurnSummary(before, after) {
  const goldDelta = after.gold - before.gold;
  const cultureDelta = after.culture - before.culture;
  const diplomacyDelta = after.diplomacy - before.diplomacy;
  const prestigeDelta = after.prestige - before.prestige;
  const territoryDelta = after.territory - before.territory;
  const foodDelta = after.foodTotal - before.foodTotal;

  const lines = [];
  lines.push(globalThis.t("turnSummaryGold", { delta: signedInt(goldDelta) }));
  lines.push(globalThis.t("turnSummaryCulture", { delta: signedInt(cultureDelta) }));
  lines.push(globalThis.t("turnSummaryDiplomacy", { delta: signedInt(diplomacyDelta) }));
  lines.push(globalThis.t("turnSummaryPrestige", { delta: signedInt(prestigeDelta) }));
  if (territoryDelta !== 0) {
    lines.push(globalThis.t("turnSummaryTerritory", { delta: signedInt(territoryDelta) }));
  }
  lines.push(globalThis.t("turnSummaryFoodEmpire", { delta: signedInt(foodDelta) }));

  return {
    turn: globalThis.state.turn,
    goldDelta,
    cultureDelta,
    lines,
  };
}

/** Conditional mid-game density: diplomacy cadence, prestige tension, frontier chatter, small city boons. */
function processMidGamePulse() {
  const turn = globalThis.state.turn;
  if (turn < MID_GAME_PULSE_FROM_TURN) return;

  const metFactions = Object.entries(globalThis.state.world.factions || {}).filter(
    ([, fs]) => fs && (fs.met || fs.contactEstablished),
  );
  if (metFactions.length && turn % 12 === 0 && Math.random() < 0.55) {
    const [fid] = metFactions[Math.floor(Math.random() * metFactions.length)];
    const fs = globalThis.state.world.factions[fid];
    if (fs) {
      fs.relation = Math.min(100, (fs.relation || 0) + Math.floor(2 + Math.random() * 4));
      pushLog(globalThis.state, "midGameDiplomacyPulse", { faction: FACTIONS[fid]?.name || fid });
      if (Math.random() < 0.35) {
        showToast(globalThis.t("midGameDiplomacyToast", { faction: FACTIONS[fid]?.name || fid }), "info");
      }
    }
  }

  if (turn >= 12 && globalThis.state.world.prestige > 65 && Math.random() < 0.18) {
    if (metFactions.length) {
      const [fid] = metFactions[Math.floor(Math.random() * metFactions.length)];
      const fs = globalThis.state.world.factions[fid];
      if (fs) {
        fs.relation = Math.max(0, (fs.relation || 0) - Math.floor(2 + Math.random() * 4));
        pushLog(globalThis.state, "midGameEnvyPulse", { faction: FACTIONS[fid]?.name || fid });
      }
    }
  }

  const hostileN = globalThis.state.world.hexTiles.filter((tile) => tile.owner === "player" && tile.hostile).length;
  if (turn >= 11 && hostileN >= 2 && turn % 11 === 0 && Math.random() < 0.4) {
    pushLog(globalThis.state, "midGameFrontierPulse");
  }

  if (turn >= 15 && turn % 18 === 0 && globalThis.state.player.cities.length) {
    const city = globalThis.state.player.cities[Math.floor(Math.random() * globalThis.state.player.cities.length)];
    if (Math.random() < 0.5) {
      const gain = 4 + Math.floor(Math.random() * 5);
      globalThis.state.player.culture += gain;
      pushLog(globalThis.state, "midGameCityRumor", { city: getCityName(city), amount: gain });
      showToast(globalThis.t("midGameCityRumorToast", { city: getCityName(city) }), "success");
    } else if (globalThis.state.player.gold >= 6) {
      globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - 6);
      globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 2);
      pushLog(globalThis.state, "midGameFestivalPaid", { city: getCityName(city) });
      showToast(globalThis.t("midGameFestivalToast", { city: getCityName(city) }), "info");
    }
  }

  if (turn % 20 === 0 && turn >= 20 && metFactions.length && Math.random() < 0.45) {
    const [fid] = metFactions[Math.floor(Math.random() * metFactions.length)];
    globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 1);
    pushLog(globalThis.state, "midGameEmbassyNote", { faction: FACTIONS[fid]?.name || fid });
  }
}

function maybeFirstContactUiTips() {
  try {
    let maxSav = 0;
    globalThis.state.player.cities.forEach((city) => {
      const social = getCitySocial(city);
      if (social) {
        maxSav = Math.max(maxSav, social.savingsToEquites || 0, social.savingsToPatricians || 0);
      }
    });
    if (maxSav > 30) {
      const k = "bronze-crown-tip-savings";
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, "1");
        showToast(globalThis.t("firstTipSavings"), "info");
      }
    }
    if (globalThis.state.player.gold < 0) {
      const k = "bronze-crown-tip-debt";
      if (!localStorage.getItem(k)) {
        localStorage.setItem(k, "1");
        showToast(globalThis.t("firstTipDebt"), "warn");
      }
    }
  } catch (_) {
    /* no-op */
  }
}

Object.assign(globalThis, {
  snapshotEmpireTurnMetrics,
  signedInt,
  buildTurnSummary,
  processMidGamePulse,
  maybeFirstContactUiTips,
});
