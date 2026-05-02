function renderRightRail() {
  const panel = el("div", { className: "panel soft" });
  panel.appendChild(el("h2", {}, globalThis.t("turnLog")));

  const metrics = el("div", { className: "metric-grid" });
  appendChildren(metrics, 
    metric(globalThis.t("territory"), String(globalThis.state.world.territory)),
    metric(globalThis.t("routes"), String(globalThis.state.world.routes.length)),
    metric(globalThis.t("cities"), String(globalThis.state.player.cities.length)),
    metric(globalThis.t("army"), String(totalSoldiers())),
  );
  panel.appendChild(metrics);

  panel.appendChild(sectionTitle(globalThis.t("recentEvents")));
  const logList = el("div", { className: "log-list" });
  globalThis.state.log.slice(0, 8).forEach((entry) => {
    const row = el("div", { className: "log-row" });
    appendChildren(row, el("strong", {}, globalThis.t("turnLabel", { turn: entry.turn })), el("small", {}, resolveLogText(entry)));
    logList.appendChild(row);
  });
  panel.appendChild(logList);
  return panel;
}

function renderLogDrawer() {
  const drawer = el("div", { className: "log-drawer-backdrop" });
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) toggleLog();
  });
  const inner = el("div", { className: "log-drawer panel soft" });
  appendChildren(inner, 
    el("div", { className: "tile-header" },
      el("h2", {}, globalThis.t("turnLog")),
      button("X", toggleLog),
    ),
    renderRightRail(),
  );
  drawer.appendChild(inner);
  return drawer;
}

function renderDiplomacyDrawer() {
  const tile = globalThis.state.world.hexTiles.find((item) => item.id === globalThis.uiState.diplomacyTargetId);
  if (!tile || tile.owner !== "rival" || !tile.factionId || tile.factionId === "player") return el("div");
  const faction = FACTIONS[tile.factionId];
  const factionState = globalThis.state.world.factions[tile.factionId];
  const drawer = el("div", { className: "log-drawer-backdrop" });
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDiplomacy();
  });

  const inner = el("div", { className: "log-drawer panel soft diplomacy-drawer" });
  const relationValue = factionState.relation;
  appendChildren(inner, 
    el("div", { className: "tile-header" },
      el("h2", {}, globalThis.t("diplomacyScreen")),
      button(globalThis.t("close"), closeDiplomacy),
    ),
    el("div", { className: "policy-row" },
      el("strong", {}, globalThis.t("interactionRegion", { region: getHexRegionName(tile) })),
      el("div", { className: "label" }, globalThis.t("interactionFaction", { faction: faction.name })),
      el("div", { className: "label" }, faction.description),
    ),
    el("div", { className: "metric-grid" },
      metric(globalThis.t("relation"), `${relationValue}/100`),
      metric(globalThis.t("contactStatus"), factionState.contactEstablished ? globalThis.t("contactEstablished") : globalThis.t("unknownContact")),
      metric(globalThis.t("tradePower"), factionState.tradePact ? globalThis.t("tradeActive") : globalThis.t("tradeUnlocked")),
      metric(globalThis.t("diplomacy"), factionState.allied ? globalThis.t("allianceActive") : globalThis.t("allianceUnlocked")),
    ),
    el("div", { className: "label" }, globalThis.t("shipsFree", { value: availableContactShips() })),
    renderDiplomacyActions(tile, faction, factionState),
  );

  drawer.appendChild(inner);
  return drawer;
}

function renderDiplomacyActions(tile, faction, factionState) {
  const list = el("div", { className: "policy-list" });
  const actionCards = [
    {
      title: globalThis.t("sendContactShip"),
      desc: globalThis.t("contactShipHint"),
      buttonText: globalThis.t("sendContactShip"),
      onClick: () => establishContact(tile.factionId),
      disabled: factionState.contactEstablished || availableContactShips() <= 0,
    },
    {
      title: globalThis.t("giftAction"),
      desc: globalThis.t("giftHint", { cost: getFactionGiftCost() }),
      buttonText: globalThis.t("giftAction"),
      onClick: () => sendFactionGift(tile.factionId),
      disabled: !factionState.contactEstablished || globalThis.state.player.gold < getFactionGiftCost(),
    },
    {
      title: globalThis.t("tradeAction"),
      desc: globalThis.t("tradeHint"),
      buttonText: globalThis.t("tradeAction"),
      onClick: () => openFactionTrade(tile.factionId),
      disabled: !factionState.contactEstablished || factionState.relation < 50 || factionState.tradePact,
    },
    {
      title: globalThis.t("allianceAction"),
      desc: globalThis.t("allianceHint"),
      buttonText: globalThis.t("allianceAction"),
      onClick: () => offerAlliance(tile.factionId),
      disabled: !factionState.contactEstablished || factionState.relation < 80 || factionState.allied,
    },
    {
      title: globalThis.t("conquestAction"),
      desc: globalThis.t("conquestHint"),
      buttonText: globalThis.t("conquestAction"),
      onClick: () => conquerRegion(tile.id),
      disabled: totalSoldiers() < 4,
    },
  ];

  actionCards.forEach((action) => {
    const row = el("div", { className: "policy-row" });
    appendChildren(row, 
      el("strong", {}, action.title),
      el("div", { className: "label" }, action.desc),
      button(action.buttonText, action.onClick, action.disabled),
    );
    list.appendChild(row);
  });

  const exportableResources = Object.keys(globalThis.state.player.resources || {}).filter((resourceId) => getPlayerResourceCount(resourceId) >= 2);
  if (factionState.tradePact && exportableResources.length) {
    exportableResources.forEach((resourceId) => {
      const exportRow = el("div", { className: "policy-row" });
      const dealActive = globalThis.state.world.resourceDeals.some((deal) => deal.factionId === faction.id && deal.resourceId === resourceId);
      appendChildren(exportRow, 
        el("strong", {}, `${resourceGlyph(resourceId)} ${globalThis.t("exportAction")}`),
        el("div", { className: "label" }, globalThis.t("exportHint", { resource: getResourceDisplayName(resourceId), gold: RESOURCE_DEFS[resourceId]?.exportGold || 0 })),
        button(dealActive ? globalThis.t("exportActive") : globalThis.t("exportAction"), () => startResourceExport(faction.id, resourceId), dealActive || !canExportResourceToFaction(faction.id, resourceId)),
      );
      list.appendChild(exportRow);
    });
  } else if (factionState.tradePact) {
    list.appendChild(el("div", { className: "policy-row" },
      el("strong", {}, globalThis.t("exportAction")),
      el("div", { className: "label" }, globalThis.t("exportRequiresTrade")),
    ));
  }
  return list;
}

function renderEncounterModal() {
  const encounter = globalThis.state.world.pendingEncounter;
  if (!encounter) return el("div");

  const drawer = el("div", { className: "log-drawer-backdrop" });
  const inner = el("div", { className: "log-drawer panel soft diplomacy-drawer encounter-drawer" });

  let title;
  let body;
  if (encounter.type === "beast") {
    title = globalThis.t("encounterDangerTitle");
    body = globalThis.t("encounterBeastBody", { tile: encounter.tileName });
  } else if (encounter.type === "hostile") {
    title = globalThis.t("encounterHostileTitle");
    const passage = typeof getHostilePassageGold === "function" ? getHostilePassageGold(encounter) : 16;
    body = globalThis.t("encounterHostileBody", {
      tile: encounter.tileName,
      tribe: encounter.tribeStrength,
      odds: hostileSuccessChance(encounter),
      passage,
    });
  } else if (encounter.type === "friendly") {
    title = globalThis.t("encounterFriendlyTitle");
    body = globalThis.t("encounterFriendlyBody", { tile: encounter.tileName });
  } else if (encounter.type === "trader") {
    title = globalThis.t("encounterTraderTitle");
    body = globalThis.t("encounterTraderBody", { tile: encounter.tileName });
  } else if (encounter.type === "ruins") {
    title = globalThis.t("encounterRuinsTitle");
    body = globalThis.t("encounterRuinsBody", { tile: encounter.tileName });
  } else {
    title = globalThis.t("encounterFriendlyTitle");
    body = "";
  }

  appendChildren(inner,
    el("div", { className: "tile-header" },
      el("h2", {}, title),
      el("span", { className: "pill warn" }, encounter.tileName),
    ),
    el("div", { className: "policy-row" }, el("div", { className: "label" }, body)),
  );

  const actions = el("div", { className: "policy-list" });
  if (encounter.type === "beast") {
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFight"), () => resolveBeastEncounter("fight"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFlee"), () => resolveBeastEncounter("flee"), false));
  } else if (encounter.type === "hostile") {
    const passageGold = typeof getHostilePassageGold === "function" ? getHostilePassageGold(encounter) : 16;
    actions.appendChild(renderEncounterAction(globalThis.t("encounterPassage"), () => resolveHostileEncounter("passage"), globalThis.state.player.gold < passageGold));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterLoot"), () => resolveHostileEncounter("loot"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterTakePeople"), () => resolveHostileEncounter("people"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFlee"), () => resolveHostileEncounter("flee"), false));
  } else if (encounter.type === "friendly") {
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFriendlyJoin"), () => resolveFriendlyEncounter("join"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFriendlyGold"), () => resolveFriendlyEncounter("gold"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFriendlyCulture"), () => resolveFriendlyEncounter("culture"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterFriendlyInsight"), () => resolveFriendlyEncounter("insight"), false));
  } else if (encounter.type === "trader") {
    const buyCost = typeof SCOUT_ENCOUNTER_CONFIG !== "undefined" ? SCOUT_ENCOUNTER_CONFIG.traderBuyGoldCost : 10;
    actions.appendChild(renderEncounterAction(globalThis.t("encounterTraderBuy"), () => resolveTraderEncounter("buy"), globalThis.state.player.gold < buyCost));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterTraderDecline"), () => resolveTraderEncounter("decline"), false));
  } else if (encounter.type === "ruins") {
    actions.appendChild(renderEncounterAction(globalThis.t("encounterRuinsSearch"), () => resolveRuinsEncounter("search"), false));
    actions.appendChild(renderEncounterAction(globalThis.t("encounterRuinsLeave"), () => resolveRuinsEncounter("leave"), false));
  }

  inner.appendChild(actions);
  drawer.appendChild(inner);
  return drawer;
}

function renderEncounterAction(title, onClick, disabled = false) {
  const row = el("div", { className: "policy-row" });
  appendChildren(row,
    el("strong", {}, title),
    button(title, onClick, disabled),
  );
  return row;
}

function renderRunVictoryModal() {
  const drawer = el("div", { className: "log-drawer-backdrop run-victory-backdrop" });
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) dismissRunVictoryModal();
  });
  const inner = el("div", { className: "log-drawer panel soft diplomacy-drawer encounter-drawer run-victory-modal" });
  const turn = globalThis.state.runOutcomeTurn ?? globalThis.state.turn;
  appendChildren(inner, 
    el("div", { className: "tile-header" },
      el("h2", {}, globalThis.t("runVictoryTitle")),
      el("span", { className: "pill good" }, globalThis.t("runVictoryPill")),
    ),
    el(
      "div",
      { className: "policy-row" },
      el("div", { className: "label" }, globalThis.t("runVictoryBody", {
        turn,
        epochName: globalThis.t("eraName4"),
      })),
    ),
    el("div", { className: "policy-row run-victory-actions" },
      button(globalThis.t("runVictoryContinue"), dismissRunVictoryModal, false),
      button(globalThis.t("runVictoryRestart"), () => { resetGame(); }, false),
    ),
  );
  drawer.appendChild(inner);
  return drawer;
}

function dismissTurnEndModal() {
  globalThis.uiState.turnEndModalOpen = false;
  globalThis.render();
}

function renderTurnEndModal() {
  const items = collectTurnEndBlockers();
  if (!items.length) {
    globalThis.uiState.turnEndModalOpen = false;
    return null;
  }
  const backdrop = el("div", { className: "log-drawer-backdrop turn-end-guard-backdrop" });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) dismissTurnEndModal();
  });
  const inner = el("div", { className: "log-drawer panel soft diplomacy-drawer turn-end-guard-modal" });
  appendChildren(
    inner,
    el(
      "div",
      { className: "tile-header" },
      el("h2", {}, globalThis.t("turnEndGuardTitle")),
      el("span", { className: "pill warn" }, String(items.length)),
    ),
    el("p", { className: "label turn-end-guard-intro" }, globalThis.t("turnEndGuardIntro")),
    globalThis.uiState.turnEndGuard === "soft"
      ? el("p", { className: "label turn-end-guard-soft" }, globalThis.t("turnEndGuardSoftDetail"))
      : null,
  );

  const list = el("div", { className: "turn-end-guard-list" });
  items.forEach((item) => {
    const row = el("div", { className: `policy-row notice-row ${item.tone} turn-end-guard-row` });
    const go = () => {
      globalThis.uiState.turnEndModalOpen = false;
      const fn = item.onClick;
      if (typeof fn === "function") fn();
      globalThis.render();
    };
    appendChildren(
      row,
      el(
        "span",
        { className: `turn-end-guard-icon tone-${item.tone || "warn"}`, "aria-hidden": "true" },
        iconNode(item.icon || "hostile"),
      ),
      el(
        "div",
        { className: "turn-end-guard-row-text" },
        el("strong", {}, item.title),
        item.detail ? el("div", { className: "label" }, item.detail) : null,
      ),
      button(item.cta || globalThis.t("worldMap"), go, false),
    );
    list.appendChild(row);
  });
  inner.appendChild(list);

  appendChildren(
    inner,
    el(
      "div",
      { className: "policy-row turn-end-guard-actions" },
      button(globalThis.t("turnEndGuardCancel"), dismissTurnEndModal, false),
      button(globalThis.t("turnEndGuardAnyway"), () => {
        globalThis.uiState.turnEndModalOpen = false;
        nextTurn();
      }, false),
    ),
  );

  backdrop.appendChild(inner);
  return backdrop;
}

function renderTurnEventModal() {
  const ev = globalThis.state.pendingTurnEvent;
  if (!ev) return null;

  const drawer = el("div", { className: "log-drawer-backdrop turn-event-backdrop" });
  const inner = el("div", { className: "log-drawer panel soft diplomacy-drawer turn-event-drawer" });

  const city = ev.cityKey ? globalThis.state.player.cities.find((c) => c.nameKey === ev.cityKey) : null;
  const cityName = city ? getCityName(city) : "";

  let title;
  let body;
  if (ev.kind === "socialMilestone") {
    title = globalThis.t("turnEventSocialTitle");
    body = globalThis.t("turnEventSocialBody", {
      city: cityName,
      step: globalThis.t(ev.labelKey),
      estate: ev.estate === "equites" ? globalThis.t("estateNameEquites") : globalThis.t("estateNamePatricians"),
    });
  } else if (ev.kind === "capitalFamine") {
    title = globalThis.t("turnEventFamineTitle");
    body = globalThis.t("turnEventFamineBody", { city: cityName });
  } else if (ev.kind === "banditRaid") {
    title = globalThis.t("turnEventRaidTitle");
    body = globalThis.t("turnEventRaidBody", { city: cityName });
  } else {
    title = globalThis.t("turnEventGenericTitle");
    body = "";
  }

  appendChildren(
    inner,
    el(
      "div",
      { className: "tile-header" },
      el("h2", {}, title),
      el("span", { className: "pill warn" }, globalThis.t("turnEventBadge")),
    ),
    el("div", { className: "policy-row" }, el("div", { className: "label turn-event-prose" }, body)),
  );

  const actions = el("div", { className: "turn-event-actions policy-list" });

  if (ev.kind === "socialMilestone") {
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventSocialChoiceFeast"), "feast", false));
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventSocialChoiceModest"), "modest", false));
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventSocialChoiceAck"), "acknowledge", false));
  } else if (ev.kind === "capitalFamine") {
    actions.appendChild(
      turnEventChoiceRow(globalThis.t("turnEventFamineChoiceGranaries"), "granaries", globalThis.state.player.gold < 14),
    );
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventFamineChoiceRation"), "ration", false));
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventFamineChoiceInvoke"), "invoke", false));
  } else if (ev.kind === "banditRaid") {
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventRaidChoicePay"), "pay", globalThis.state.player.gold < 1));
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventRaidChoiceFight"), "fight", false));
    actions.appendChild(turnEventChoiceRow(globalThis.t("turnEventRaidChoiceNeglect"), "neglect", false));
  }

  inner.appendChild(actions);
  drawer.appendChild(inner);
  return drawer;
}

function turnEventChoiceRow(label, choiceId, disabled) {
  const row = el("div", { className: "policy-row turn-event-action-row" });
  row.appendChild(button(label, () => resolveTurnEvent(choiceId), disabled));
  return row;
}

Object.assign(globalThis, {
  renderLogDrawer,
  renderDiplomacyDrawer,
  renderDiplomacyActions,
  renderEncounterModal,
  renderEncounterAction,
  renderRunVictoryModal,
  dismissTurnEndModal,
  renderTurnEndModal,
  renderTurnEventModal,
  turnEventChoiceRow,
});
