/**
 * Narrative turn events: queued during resolution, shown as modal choices before play continues.
 * Blocks End Turn like scout encounters. Works with turn summary (summary opens after queue clears).
 */

function turnEventsBlocked() {
  return Boolean(globalThis.state.pendingTurnEvent);
}

function turnEventQueueClearForSummary() {
  return !globalThis.state.pendingTurnEvent && !(globalThis.state.turnEventQueue && globalThis.state.turnEventQueue.length);
}

function queueTurnEvent(payload) {
  if (!globalThis.state.turnEventQueue) globalThis.state.turnEventQueue = [];
  globalThis.state.turnEventQueue.push(payload);
}

/** Called from social.js when a promotion completes (same turn tick). */
function queueSocialTurnEvent(city, entry, dest) {
  queueTurnEvent({
    kind: "socialMilestone",
    cityKey: city.nameKey,
    estate: dest,
    labelKey: entry.labelKey,
  });
}

function finalizeTurnEventsForUi() {
  if (globalThis.state.world.pendingEncounter) return;
  if (globalThis.state.pendingTurnEvent) return;
  if (!globalThis.state.turnEventQueue || !globalThis.state.turnEventQueue.length) return;
  globalThis.state.pendingTurnEvent = globalThis.state.turnEventQueue.shift();
}

/** Weighted random crises after early game; respects cooldowns on meta. */
function rollNarrativeTurnEvents() {
  if (globalThis.state.world.pendingEncounter) return;
  const meta = globalThis.state.turnEventMeta || { lastFamineTurn: -999, lastRaidTurn: -999 };
  globalThis.state.turnEventMeta = meta;
  const turn = globalThis.state.turn;
  if (turn < 4 && !RANDOM_EVENTS_ENABLED) return;

  const capital = typeof getCapitalCity === "function" ? getCapitalCity() : null;
  if (
    capital
    && turn >= 6
    && turn - meta.lastFamineTurn >= 12
    && (capital.foodStock <= 4
      || (capital.starvationTurns || 0) > 0
      || capital.foodStock <= Math.max(2, Math.floor(capital.foodCap * 0.2)))
  ) {
    if (Math.random() < (RANDOM_EVENTS_ENABLED ? 0.2 : 0.12)) {
      queueTurnEvent({ kind: "capitalFamine", cityKey: capital.nameKey });
      meta.lastFamineTurn = turn;
      return;
    }
  }

  if (
    turn >= 7
    && turn - meta.lastRaidTurn >= 10
    && globalThis.state.player.cities.length
    && Math.random() < (RANDOM_EVENTS_ENABLED ? 0.18 : 0.11)
  ) {
    const cities = globalThis.state.player.cities;
    const city = cities[Math.floor(Math.random() * cities.length)];
    queueTurnEvent({
      kind: "banditRaid",
      cityKey: city.nameKey,
    });
    meta.lastRaidTurn = turn;
  }
}

function getCityByKey(nameKey) {
  return globalThis.state.player.cities.find((c) => c.nameKey === nameKey) || null;
}

function applyTurnEventChoice(ev, choiceId) {
  const city = ev.cityKey ? getCityByKey(ev.cityKey) : null;
  const cityName = city ? getCityName(city) : "";

  if (ev.kind === "socialMilestone") {
    if (choiceId === "feast") {
      const cost = 10;
      if (globalThis.state.player.gold >= cost) {
        globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - cost);
        globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 3);
        pushLog(globalThis.state, "turnEventSocialLogFeast", { city: cityName });
      } else {
        globalThis.state.player.culture += 2;
        pushLog(globalThis.state, "turnEventSocialLogModestFallback", { city: cityName });
      }
    } else if (choiceId === "modest") {
      globalThis.state.player.culture += 3;
      pushLog(globalThis.state, "turnEventSocialLogModest", { city: cityName });
    } else {
      pushLog(globalThis.state, "turnEventSocialLogAck", { city: cityName });
    }
    return;
  }

  if (ev.kind === "capitalFamine" && city) {
    if (choiceId === "granaries") {
      const cost = 14;
      if (globalThis.state.player.gold >= cost) {
        globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - cost);
        city.foodStock = Math.min(city.foodCap, city.foodStock + 8);
        pushLog(globalThis.state, "turnEventFamineLogGranaries", { city: cityName });
      } else {
        city.starvationTurns = (city.starvationTurns || 0) + 1;
        pushLog(globalThis.state, "turnEventFamineLogFailedBuy", { city: cityName });
      }
    } else if (choiceId === "ration") {
      globalThis.state.world.prestige = Math.max(0, globalThis.state.world.prestige - 4);
      city.foodStock = Math.min(city.foodCap, city.foodStock + 2);
      pushLog(globalThis.state, "turnEventFamineLogRation", { city: cityName });
    } else {
      globalThis.state.player.culture = Math.max(0, globalThis.state.player.culture - 4);
      globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 2);
      pushLog(globalThis.state, "turnEventFamineLogInvoke", { city: cityName });
    }
    return;
  }

  if (ev.kind === "banditRaid" && city) {
    const tribute = 12 + Math.floor(Math.random() * 6);
    if (choiceId === "pay") {
      const paid = Math.min(globalThis.state.player.gold, tribute);
      globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - paid);
      pushLog(globalThis.state, "turnEventRaidLogPay", { city: cityName, gold: paid });
    } else if (choiceId === "fight") {
      if ((city.soldiers || 0) >= 1 && Math.random() < 0.72) {
        city.soldiers = Math.max(0, city.soldiers - (Math.random() < 0.35 ? 1 : 0));
        pushLog(globalThis.state, "turnEventRaidLogFightOk", { city: cityName });
      } else {
        globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - Math.floor(tribute * 0.7));
        city.foodStock = Math.max(0, city.foodStock - 5);
        pushLog(globalThis.state, "turnEventRaidLogFightBad", { city: cityName });
      }
    } else {
      city.foodStock = Math.max(0, city.foodStock - 6);
      globalThis.state.player.gold = clampGoldBalance(globalThis.state.player.gold - 5);
      pushLog(globalThis.state, "turnEventRaidLogNeglect", { city: cityName });
    }
  }
}

function resolveTurnEvent(choiceId) {
  const ev = globalThis.state.pendingTurnEvent;
  if (!ev) return;
  applyTurnEventChoice(ev, choiceId);
  globalThis.state.pendingTurnEvent = null;
  finalizeTurnEventsForUi();
  if (turnEventQueueClearForSummary() && globalThis.state.turnSummary) {
    globalThis.uiState.turnSummaryOpen = true;
  }
  globalThis.render();
}

Object.assign(globalThis, {
  turnEventsBlocked,
  turnEventQueueClearForSummary,
  queueTurnEvent,
  queueSocialTurnEvent,
  finalizeTurnEventsForUi,
  rollNarrativeTurnEvents,
  getCityByKey,
  applyTurnEventChoice,
  resolveTurnEvent,
});
