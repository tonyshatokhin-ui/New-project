/**
 * Social estates: plebeian strata (poor / middle / affluent), savings pools, gated promotions.
 * Promotion costs are paid from populace savings (not player gold). Queue reserves people who left a tier.
 */

const SOCIAL_RULES = {
  plebsToEquites: {
    id: "plebsToEquites",
    fromTier: "plebsRich",
    to: "equites",
    costSavings: 50,
    savingsKey: "savingsToEquites",
    turns: 3,
    requiresAnyBuilding: ["market-square", "workshop"],
    maxShare: 0.6,
  },
  equitesToPatricians: {
    id: "equitesToPatricians",
    fromTier: "equites",
    to: "patricians",
    costSavings: 90,
    savingsKey: "savingsToPatricians",
    turns: 5,
    requiresAllBuildings: ["market-square", "shrine"],
    maxShare: 0.25,
  },
  maxQueue: 2,
};

/** Split population among three plebeian archetypes (rough 28% / 44% / 28%). */
function distributePlebsThreeTiers(total) {
  if (total <= 0) return { plebsPoor: 0, plebsMid: 0, plebsRich: 0 };
  if (total === 1) return { plebsPoor: 0, plebsMid: 1, plebsRich: 0 };
  const poor = Math.max(0, Math.floor(total * 0.28));
  const rich = Math.max(0, Math.floor(total * 0.28));
  const mid = Math.max(0, total - poor - rich);
  return { plebsPoor: poor, plebsMid: mid, plebsRich: rich };
}

function plebsTotal(social) {
  return (social.plebsPoor || 0) + (social.plebsMid || 0) + (social.plebsRich || 0);
}

function migrateLegacySocial(social, city) {
  if (social.plebs != null && social.plebsPoor == null) {
    const n = Math.max(0, Math.floor(social.plebs));
    const d = distributePlebsThreeTiers(n);
    social.plebsPoor = d.plebsPoor;
    social.plebsMid = d.plebsMid;
    social.plebsRich = d.plebsRich;
    delete social.plebs;
  }
  if (social.savingsToEquites == null) social.savingsToEquites = 0;
  if (social.savingsToPatricians == null) social.savingsToPatricians = 0;
  social.savingsToEquites = Math.max(0, Math.min(999, social.savingsToEquites));
  social.savingsToPatricians = Math.max(0, Math.min(999, social.savingsToPatricians));
}

function initCitySocial(city) {
  if (!city) return;
  const d = distributePlebsThreeTiers(city.population);
  city.social = {
    plebsPoor: d.plebsPoor,
    plebsMid: d.plebsMid,
    plebsRich: d.plebsRich,
    equites: 0,
    patricians: 0,
    savingsToEquites: 0,
    savingsToPatricians: 0,
    queue: [],
  };
}

function getCitySocial(city) {
  if (!city) return null;
  if (!city.social) {
    initCitySocial(city);
  } else {
    migrateLegacySocial(city.social, city);
  }
  return city.social;
}

function normalizeCitySocial(city) {
  const social = getCitySocial(city);
  if (!social) return;
  migrateLegacySocial(social, city);

  social.plebsPoor = Math.max(0, Math.floor(social.plebsPoor || 0));
  social.plebsMid = Math.max(0, Math.floor(social.plebsMid || 0));
  social.plebsRich = Math.max(0, Math.floor(social.plebsRich || 0));
  social.equites = Math.max(0, Math.floor(social.equites || 0));
  social.patricians = Math.max(0, Math.floor(social.patricians || 0));
  social.queue = (social.queue || []).filter((item) => item && item.turnsLeft > 0);

  const inQueue = social.queue.length;
  const strataSum = plebsTotal(social) + social.equites + social.patricians;
  const accounted = strataSum + inQueue;
  let delta = city.population - accounted;

  if (delta > 0) {
    social.plebsMid += delta;
  } else if (delta < 0) {
    let rem = -delta;
    const take = (key) => {
      if (rem <= 0) return;
      const cur = social[key] || 0;
      const n = Math.min(cur, rem);
      social[key] = cur - n;
      rem -= n;
    };
    ["plebsPoor", "plebsMid", "plebsRich", "equites", "patricians"].forEach((key) => take(key));
  }
}

/**
 * Randomized savings: affluent plebeians contribute most; middle some; poor rarely.
 * Equites pool savings toward patrician candidacy. Scales with assigned work in the city.
 */
function tickSocialSavings(city) {
  const social = getCitySocial(city);
  if (!social) return;
  const assigned = typeof assignedWorkers === "function" ? assignedWorkers(city) : 0;
  const workFactor = assigned > 0 ? 1 : 0.4;

  const poor = social.plebsPoor || 0;
  const mid = social.plebsMid || 0;
  const rich = social.plebsRich || 0;
  const eq = social.equites || 0;

  const incEq =
    Math.floor(rich * (1.2 + Math.random() * 3.2))
    + Math.floor(mid * (0.15 + Math.random() * 0.55))
    + (poor > 0 ? Math.floor(Math.random() * (1 + Math.floor(poor / 3))) : 0);

  const incPat = Math.floor(eq * (0.6 + Math.random() * 2.4));

  social.savingsToEquites = Math.min(999, (social.savingsToEquites || 0) + Math.floor(incEq * workFactor));
  social.savingsToPatricians = Math.min(999, (social.savingsToPatricians || 0) + Math.floor(incPat * workFactor));
}

function maxStratumSlots(city, rule) {
  const maxCount = Math.floor(city.population * rule.maxShare);
  return maxCount;
}

function canStartMobility(city, rule) {
  const social = getCitySocial(city);
  if (!social || social.queue.length >= SOCIAL_RULES.maxQueue) return false;

  if ((social[rule.savingsKey] || 0) < rule.costSavings) return false;

  if (rule.requiresAnyBuilding && !rule.requiresAnyBuilding.some((buildingId) => cityHasBuilding(city, buildingId))) {
    return false;
  }
  if (rule.requiresAllBuildings && rule.requiresAllBuildings.some((buildingId) => !cityHasBuilding(city, buildingId))) {
    return false;
  }

  const fromCount = rule.fromTier === "equites" ? (social.equites || 0) : (social[rule.fromTier] || 0);
  if (fromCount <= 0) return false;

  const toCount = social[rule.to] || 0;
  const cap = maxStratumSlots(city, rule);
  if (cap < 1) return false;
  if (toCount >= cap) return false;

  return true;
}

function queueMobility(city, rule, labelKey) {
  const social = getCitySocial(city);
  if (!social) return false;
  if (!canStartMobility(city, rule)) return false;

  social[rule.savingsKey] = Math.max(0, (social[rule.savingsKey] || 0) - rule.costSavings);

  if (rule.fromTier === "equites") {
    social.equites = Math.max(0, (social.equites || 0) - 1);
  } else {
    social[rule.fromTier] = Math.max(0, (social[rule.fromTier] || 0) - 1);
  }

  social.queue.push({
    ruleId: rule.id,
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
    const dest = entry.to || (entry.ruleId === "equitesToPatricians" ? "patricians" : "equites");
    if (dest === "equites") {
      social.equites = (social.equites || 0) + 1;
    } else if (dest === "patricians") {
      social.patricians = (social.patricians || 0) + 1;
    }
    pushLog(globalThis.state, "socialMobilityDone", {
      city: getCityName(city),
      step: globalThis.t(entry.labelKey),
    });
    if (typeof queueSocialTurnEvent === "function") {
      queueSocialTurnEvent(city, entry, dest);
    }
  });
  normalizeCitySocial(city);
}

function applySocialEffects(city, totals) {
  const social = getCitySocial(city);
  if (!social) return;
  const equites = social.equites || 0;
  const patricians = social.patricians || 0;
  const poor = social.plebsPoor || 0;
  const mid = social.plebsMid || 0;
  const rich = social.plebsRich || 0;

  totals.gold += equites;
  totals.hammers += Math.floor(equites / 3);
  totals.culture += patricians;
  totals.food -= Math.ceil(equites * 0.5) + patricians;
  totals.gold -= patricians;
  totals.diplomacy += patricians * 0.3;
  totals.prestige += patricians * 0.2;

  totals.gold += Math.floor(rich / 3);
  totals.food -= Math.floor(poor / 3);
  if (mid > 0) {
    totals.culture += Math.floor(mid / 5);
  }
}

/** UI / tools — costs mirror SOCIAL_RULES (city-view loads before social.js; call only after scripts run). */
function getSocialPromotionCosts() {
  return {
    costEq: SOCIAL_RULES.plebsToEquites.costSavings,
    costPat: SOCIAL_RULES.equitesToPatricians.costSavings,
  };
}

Object.assign(globalThis, {
  distributePlebsThreeTiers,
  plebsTotal,
  migrateLegacySocial,
  initCitySocial,
  getCitySocial,
  normalizeCitySocial,
  tickSocialSavings,
  maxStratumSlots,
  canStartMobility,
  queueMobility,
  maybeQueueSocialMobility,
  processSocialMobility,
  applySocialEffects,
  getSocialPromotionCosts,
});
