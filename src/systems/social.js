const SOCIAL_RULES = {
  plebsToEquites: {
    from: "plebs",
    to: "equites",
    costGold: 50,
    turns: 3,
    requiresAnyBuilding: ["market-square", "workshop"],
    maxShare: 0.6,
  },
  equitesToPatricians: {
    from: "equites",
    to: "patricians",
    costGold: 90,
    turns: 5,
    requiresAllBuildings: ["market-square", "shrine"],
    maxShare: 0.25,
  },
  maxQueue: 2,
};

function initCitySocial(city) {
  if (!city) return;
  city.social = {
    plebs: city.population,
    equites: 0,
    patricians: 0,
    queue: [],
  };
}

function getCitySocial(city) {
  if (!city) return null;
  if (!city.social) {
    initCitySocial(city);
  }
  return city.social;
}

function normalizeCitySocial(city) {
  const social = getCitySocial(city);
  if (!social) return;
  social.plebs = Math.max(0, Math.floor(social.plebs || 0));
  social.equites = Math.max(0, Math.floor(social.equites || 0));
  social.patricians = Math.max(0, Math.floor(social.patricians || 0));
  social.queue = (social.queue || []).filter((item) => item && item.turnsLeft > 0);

  const inQueue = social.queue.length;
  const settled = social.plebs + social.equites + social.patricians;
  const targetSettled = Math.max(0, city.population - inQueue);
  const delta = targetSettled - settled;
  if (delta !== 0) {
    social.plebs = Math.max(0, social.plebs + delta);
  }
}

function canStartMobility(city, rule) {
  const social = getCitySocial(city);
  if (!social || social.queue.length >= SOCIAL_RULES.maxQueue) return false;
  if (social[rule.from] <= 0) return false;
  if (state.player.gold < rule.costGold) return false;
  if (rule.requiresAnyBuilding && !rule.requiresAnyBuilding.some((buildingId) => cityHasBuilding(city, buildingId))) return false;
  if (rule.requiresAllBuildings && rule.requiresAllBuildings.some((buildingId) => !cityHasBuilding(city, buildingId))) return false;
  const toCount = social[rule.to] || 0;
  const maxCount = Math.floor(city.population * rule.maxShare);
  if (toCount >= Math.max(1, maxCount)) return false;
  return true;
}

function queueMobility(city, rule, labelKey) {
  const social = getCitySocial(city);
  if (!social) return false;
  if (!canStartMobility(city, rule)) return false;
  state.player.gold = clampGoldBalance(state.player.gold - rule.costGold);
  social.queue.push({
    from: rule.from,
    to: rule.to,
    turnsLeft: rule.turns,
    labelKey,
  });
  return true;
}

function maybeQueueSocialMobility(city) {
  if (queueMobility(city, SOCIAL_RULES.plebsToEquites, "socialLiftPlebsToEquites")) return;
  queueMobility(city, SOCIAL_RULES.equitesToPatricians, "socialLiftEquitesToPatricians");
}

function processSocialMobility(city) {
  const social = getCitySocial(city);
  if (!social || !social.queue.length) return;
  social.queue.forEach((entry) => {
    entry.turnsLeft -= 1;
  });
  const ready = social.queue.filter((entry) => entry.turnsLeft <= 0);
  social.queue = social.queue.filter((entry) => entry.turnsLeft > 0);
  ready.forEach((entry) => {
    if ((social[entry.from] || 0) <= 0) return;
    social[entry.from] -= 1;
    social[entry.to] = (social[entry.to] || 0) + 1;
    pushLog(state, "socialMobilityDone", {
      city: getCityName(city),
      step: t(entry.labelKey),
    });
  });
  normalizeCitySocial(city);
}

function applySocialEffects(city, totals) {
  const social = getCitySocial(city);
  if (!social) return;
  const equites = social.equites || 0;
  const patricians = social.patricians || 0;

  totals.gold += equites;
  totals.hammers += Math.floor(equites / 2);
  totals.culture += patricians;
  totals.food -= Math.ceil(equites * 0.5) + patricians;
  totals.gold -= patricians;
  totals.diplomacy += patricians * 0.3;
  totals.prestige += patricians * 0.2;
}
