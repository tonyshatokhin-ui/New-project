/** Run win: reach the final epoch (iron-discipline tech) and hold sole 1st place in the age standings. */

const RUN_VICTORY = Object.freeze({
  minTurn: 26,
  finalTechId: "iron-discipline",
});

const RUN_STANDING_ENTRIES = Object.keys(FACTIONS).length + 1;

function getPlayerStandingScore() {
  const techN = globalThis.state.player.technologies.length;
  const popTotal = sumCities((city) => city.population);
  return Math.floor(
    globalThis.state.world.prestige
    + globalThis.state.world.diplomacy
    + globalThis.state.player.culture * 0.35
    + popTotal * 8
    + globalThis.state.world.territory * 7
    + techN * 34,
  );
}

/** Era ladder by tech tier (IV = last — iron discipline). */
function getEmpireEpochIndex() {
  const ids = globalThis.state.player.technologies;
  if (ids.includes(RUN_VICTORY.finalTechId)) return 4;
  if (TECHNOLOGIES.some((tech) => tech.tier >= 2 && ids.includes(tech.id))) return 3;
  if (TECHNOLOGIES.some((tech) => tech.tier === 1 && ids.includes(tech.id))) return 2;
  return 1;
}

function empireEpochNameKey(epochIndex) {
  return `eraName${epochIndex}`;
}

function tickRivalStandingSimulation() {
  const standing = globalThis.state.world.rivalEmpireStanding;
  if (!standing || typeof standing !== "object") return;
  Object.keys(standing).forEach((factionId) => {
    let v = standing[factionId];
    const jitter = Math.random() * 1.85 + 0.18;
    v = Math.round(v + jitter + Math.sin(globalThis.state.turn / 31) * 0.4);
    if (Math.random() < 0.045) v -= Math.floor(Math.random() * 5);
    standing[factionId] = clamp(v, 54, 226);
  });
}

function getStandingRaceDetails() {
  const pScore = getPlayerStandingScore();
  const rows = Object.entries(globalThis.state.world.rivalEmpireStanding || {}).map(([factionId, score]) => ({
    isPlayer: false,
    factionId,
    label: FACTIONS[factionId]?.name || factionId,
    score,
  }));
  rows.push({
    isPlayer: true,
    factionId: null,
    label: globalThis.t("standingPlayerLabel"),
    score: pScore,
  });
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (!a.isPlayer && b.isPlayer) return -1;
    if (a.isPlayer && !b.isPlayer) return 1;
    return String(a.factionId || "").localeCompare(String(b.factionId || ""));
  });
  const rank = rows.findIndex((row) => row.isPlayer) + 1;
  const top = rows[0];
  const second = rows[1];
  const soleLeader = Boolean(top?.isPlayer && second && top.score > second.score);
  return {
    rows,
    rank,
    total: RUN_STANDING_ENTRIES,
    soleLeader,
    leaderScore: top?.score,
    playerScore: pScore,
  };
}

function hasReachedFinalEpoch() {
  return globalThis.state.player.technologies.includes(RUN_VICTORY.finalTechId);
}

function isRunVictoryMet() {
  if (globalThis.state.runOutcome || globalThis.state.turn < RUN_VICTORY.minTurn) return false;
  if (!hasReachedFinalEpoch()) return false;
  return getStandingRaceDetails().soleLeader;
}

function getCampaignObjectiveLine() {
  if (globalThis.state.runOutcome === "victory") return globalThis.t("objectiveCampaignWonShort");
  const epoch = getEmpireEpochIndex();
  const { rank, soleLeader } = getStandingRaceDetails();
  return globalThis.t("objectiveCampaignEpochStanding", {
    epochCurrent: globalThis.t(empireEpochNameKey(epoch)),
    epochFinal: globalThis.t("eraName4"),
    standingLine: globalThis.t("standingRankLine", { rank, total: RUN_STANDING_ENTRIES }),
    tieHint: soleLeader ? "" : ` ${globalThis.t("standingNeedLead")}`,
  });
}

function tryResolveRunOutcome() {
  if (globalThis.state.runOutcome) return;
  if (!isRunVictoryMet()) return;
  globalThis.state.runOutcome = "victory";
  globalThis.state.runOutcomeTurn = globalThis.state.turn;
  const { rank } = getStandingRaceDetails();
  pushLog(globalThis.state, "runVictoryLog", {
    turn: globalThis.state.turn,
    rank,
    score: getPlayerStandingScore(),
  });
  globalThis.uiState.runVictoryModalDismissed = false;
  if (typeof globalThis.playSuccessSound === "function") globalThis.playSuccessSound();
}

function dismissRunVictoryModal() {
  globalThis.uiState.runVictoryModalDismissed = true;
  globalThis.render();
}

Object.assign(globalThis, {
  getPlayerStandingScore,
  getEmpireEpochIndex,
  empireEpochNameKey,
  tickRivalStandingSimulation,
  getStandingRaceDetails,
  hasReachedFinalEpoch,
  isRunVictoryMet,
  getCampaignObjectiveLine,
  tryResolveRunOutcome,
  dismissRunVictoryModal,
});
