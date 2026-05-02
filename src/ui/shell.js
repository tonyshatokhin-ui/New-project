import { getLocale } from "../i18n/i18n.js";

function renderHeader() {
  const header = el("div", { className: "header game-header game-header--stacked" });
  const headerRow = el("div", { className: "header-row" });
  const turnPill = el("div", { id: "header-turn-pill", className: "header-turn-pill tabular-nums" }, globalThis.t("turnLabel", { turn: globalThis.state.turn }));

  const actions = el("div", { className: "action-row compact-actions compact-actions-primary" });
  appendChildren(
    actions,
    button(globalThis.t("worldMap"), () => {
      globalThis.uiState.headerMenuOpen = false;
      switchView("world");
    }, globalThis.state.view === "world"),
    button(globalThis.t("cityButton", { city: getCityName(getSelectedCity()) }), () => {
      globalThis.uiState.headerMenuOpen = false;
      switchView("city");
    }, globalThis.state.view === "city"),
    button(
      globalThis.t("endTurn"),
      () => {
        globalThis.uiState.headerMenuOpen = false;
        requestEndTurn();
      },
      Boolean(globalThis.state.world.pendingEncounter
        || (typeof turnEventsBlocked === "function" && turnEventsBlocked())),
    ),
  );

  const menuWrap = el("div", { className: "header-menu-wrap" });
  const menuToggle = button(globalThis.t("manage"), () => {
    globalThis.uiState.headerMenuOpen = !globalThis.uiState.headerMenuOpen;
    globalThis.render();
  }, false);
  menuToggle.classList.add("header-menu-toggle");
  menuWrap.appendChild(menuToggle);

  if (globalThis.uiState.headerMenuOpen) {
    const popup = el("div", { className: "header-menu-popup" });
    appendChildren(
      popup,
      button(globalThis.t("turnLog"), () => {
        globalThis.uiState.headerMenuOpen = false;
        toggleLog();
      }),
      button(globalThis.t("encyclopediaOpen"), () => {
        globalThis.uiState.headerMenuOpen = false;
        globalThis.uiState.encyclopediaOpen = true;
        globalThis.render();
      }, false),
      button(globalThis.t("menuOpenEmpireDrawer"), () => {
        globalThis.uiState.headerMenuOpen = false;
        openHudPanel("empire");
      }, false),
      button(globalThis.uiState.musicOn ? globalThis.t("musicOn") : globalThis.t("musicOff"), () => {
        globalThis.uiState.headerMenuOpen = false;
        toggleMusic();
      }),
      button(globalThis.t("languageEn"), () => {
        globalThis.uiState.headerMenuOpen = false;
        globalThis.setLocale("en");
      }, getLocale() === "en"),
      button(globalThis.t("languageRu"), () => {
        globalThis.uiState.headerMenuOpen = false;
        globalThis.setLocale("ru");
      }, getLocale() === "ru"),
      button(globalThis.t("hudPresetMinimal"), () => {
        globalThis.uiState.hudPreset = "minimal";
        globalThis.uiState.headerMenuOpen = false;
        globalThis.render();
      }, globalThis.uiState.hudPreset === "minimal"),
      button(globalThis.t("hudPresetStandard"), () => {
        globalThis.uiState.hudPreset = "standard";
        globalThis.uiState.headerMenuOpen = false;
        globalThis.render();
      }, globalThis.uiState.hudPreset === "standard"),
      button(globalThis.t("hudPresetDetailed"), () => {
        globalThis.uiState.hudPreset = "detailed";
        globalThis.uiState.headerMenuOpen = false;
        globalThis.render();
      }, globalThis.uiState.hudPreset === "detailed"),
      button(globalThis.t("turnEndGuardStrict"), () => {
        globalThis.uiState.turnEndGuard = "strict";
        globalThis.uiState.headerMenuOpen = false;
        persistSettings();
        globalThis.render();
      }, globalThis.uiState.turnEndGuard === "strict"),
      button(globalThis.t("turnEndGuardSoft"), () => {
        globalThis.uiState.turnEndGuard = "soft";
        globalThis.uiState.headerMenuOpen = false;
        persistSettings();
        globalThis.render();
      }, globalThis.uiState.turnEndGuard === "soft"),
      button(globalThis.t("turnEndGuardOff"), () => {
        globalThis.uiState.turnEndGuard = "off";
        globalThis.uiState.headerMenuOpen = false;
        persistSettings();
        globalThis.render();
      }, globalThis.uiState.turnEndGuard === "off"),
      button(globalThis.t("resetRun"), () => {
        globalThis.uiState.headerMenuOpen = false;
        resetGame();
      }),
      button(globalThis.t("mainMenu"), () => {
        globalThis.uiState.headerMenuOpen = false;
        openMainMenu();
      }),
    );
    menuWrap.appendChild(popup);
  }

  appendChildren(headerRow, turnPill, actions, menuWrap);
  const victoryHint = el(
    "div",
    { className: "header-victory-hint muted", role: "note" },
    globalThis.t("hudVictoryHint"),
  );
  appendChildren(header, headerRow, victoryHint);
  return header;
}

/** turnBlockLevel: 2 = soft+strict, 1 = strict only, 0 = never blocks end turn */
function collectAllPriorityActions() {
  const actions = [];
  const addAction = (item) => actions.push(item);
  const scout = getPrimaryScout();

  if (!scout && canRaiseScout()) {
    addAction({
      tone: "warn",
      turnBlockLevel: 1,
      icon: "scout",
      title: globalThis.t("noticeScoutMissing"),
      cta: globalThis.t("actionRaiseScout"),
      onClick: () => focusRaiseScoutAction(),
    });
  } else if (scout && scout.status === "idle") {
    addAction({
      tone: "warn",
      turnBlockLevel: 1,
      icon: "scout",
      title: globalThis.t("noticeScoutIdle"),
      detail: getScoutStatusText(scout),
      cta: globalThis.t("actionOpenWorld"),
      onClick: () => switchView("world"),
    });
  }

  if (globalThis.state.player.gold < 0) {
    addAction({
      tone: "danger",
      turnBlockLevel: 2,
      icon: "hostile",
      title: globalThis.t("noticeGoldDeficit", { value: globalThis.state.player.gold }),
      detail: globalThis.t("cityOrderTrade"),
      cta: globalThis.t("actionOpenCityView"),
      onClick: () => openCity(getSelectedCity().nameKey),
    });
  }

  const hostileCount = hostileFrontierTiles().length + getHostileRaiders().length;
  if (hostileCount > 0) {
    addAction({
      tone: "warn",
      turnBlockLevel: 0,
      icon: "hostile",
      title: globalThis.t("noticeHostilesActive", { count: hostileCount }),
      cta: globalThis.t("actionOpenWorld"),
      onClick: () => switchView("world"),
    });
  }

  globalThis.state.player.cities.forEach((city) => {
    const yieldData = computeCityYield(city);
    const foodSurplus = foodSurplusForCity(yieldData, city);
    const freeWorkers = Math.max(0, city.population - assignedWorkers(city));
    const idleWorkers = getWorkerUnitsForCity(city.nameKey).filter((worker) => worker.status === "idle").length;
    const readyBuilding = BUILDINGS.find((building) => {
      const builtCount = city.buildings.filter((item) => item === building.id).length;
      const uniqueLocked = building.unique && builtCount > 0;
      const queued = typeof isBuildingQueued === "function" && isBuildingQueued(city, building.id);
      return !uniqueLocked && !queued && buildingRequirementsMet(city, building) && city.hammerStock >= building.cost;
    });

    if (foodSurplus < 0) {
      addAction({
        tone: "danger",
        turnBlockLevel: 2,
        icon: "hostile",
        title: globalThis.t("noticeCityHungry", { city: getCityName(city), value: signed(foodSurplus) }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (typeof canTrainWorker === "function" && canTrainWorker(city)) {
      addAction({
        tone: "warn",
        turnBlockLevel: 1,
        icon: "worker",
        title: globalThis.t("turnBlockWorkerTrainAvailable", { city: getCityName(city) }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (typeof canTrainSettler === "function" && canTrainSettler(city)) {
      addAction({
        tone: "warn",
        turnBlockLevel: 1,
        icon: "settler",
        title: globalThis.t("turnBlockSettlerTrainAvailable", { city: getCityName(city) }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (freeWorkers > 0) {
      addAction({
        tone: "warn",
        turnBlockLevel: 1,
        icon: "worker",
        title: globalThis.t("noticeIdleCitizens", { city: getCityName(city), count: freeWorkers }),
        cta: globalThis.t("actionAssignWorkers"),
        onClick: () => focusCityWorkforce(city.nameKey),
      });
    }

    if (readyBuilding) {
      addAction({
        tone: "good",
        turnBlockLevel: 1,
        icon: "city",
        title: globalThis.t("noticeBuildingReady", { city: getCityName(city), building: globalThis.t(readyBuilding.nameKey) }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (city.directiveChangeCount === 0) {
      addAction({
        tone: "good",
        turnBlockLevel: 0,
        icon: "move",
        title: globalThis.t("noticeDirectiveFree", { city: getCityName(city) }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (city.specializationChangeCount === 0) {
      addAction({
        tone: "good",
        turnBlockLevel: 0,
        icon: "explore",
        title: globalThis.t("noticeSpecializationFree", { city: getCityName(city) }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (idleWorkers > 0) {
      addAction({
        tone: "warn",
        turnBlockLevel: 1,
        icon: "worker",
        title: globalThis.t("noticeIdleWorkers", { city: getCityName(city), count: idleWorkers }),
        cta: globalThis.t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }
  });

  return actions;
}

function collectPriorityActions() {
  const priority = { danger: 0, warn: 1, good: 2 };
  return collectAllPriorityActions()
    .sort((left, right) => (priority[left.tone] ?? 9) - (priority[right.tone] ?? 9))
    .slice(0, 10);
}

function collectTurnEndBlockers() {
  const mode = globalThis.uiState.turnEndGuard || "strict";
  if (mode === "off") return [];
  const minLevel = mode === "soft" ? 2 : 1;
  const priority = { danger: 0, warn: 1, good: 2 };
  return collectAllPriorityActions()
    .filter((item) => (item.turnBlockLevel ?? 0) >= minLevel)
    .sort((left, right) => (priority[left.tone] ?? 9) - (priority[right.tone] ?? 9));
}

function requestEndTurn() {
  if (globalThis.state.world.pendingEncounter) return;
  if (typeof turnEventsBlocked === "function" && turnEventsBlocked()) return;
  const mode = globalThis.uiState.turnEndGuard || "strict";
  if (mode === "off") {
    nextTurn();
    return;
  }
  const blockers = collectTurnEndBlockers();
  if (!blockers.length) {
    nextTurn();
    return;
  }
  globalThis.uiState.turnEndModalOpen = true;
  globalThis.render();
}

function focusRaiseScoutAction() {
  globalThis.uiState.selectedHexId = globalThis.state.world.startTileId;
  globalThis.state.view = "world";
  globalThis.uiState.focusRequest = {
    selector: "#action-raise-scout",
    fallbackSelector: ".hex-inspector",
  };
  globalThis.render();
}

function focusCityWorkforce(cityNameKey) {
  globalThis.state.selectedCity = cityNameKey;
  globalThis.state.view = "city";
  globalThis.uiState.focusRequest = {
    selector: "#city-workforce-section",
    fallbackSelector: ".city-district-band",
  };
  globalThis.render();
}

function renderPriorityActionsPanel(actions = collectPriorityActions()) {
  const wrap = el("div", { className: "policy-list priority-list" });
  if (!actions.length) {
    wrap.appendChild(el("div", { className: "empty-note" }, globalThis.t("priorityActionsEmpty")));
    return wrap;
  }

  actions.forEach((item) => {
    const row = el("div", { className: `policy-row notice-row ${item.tone}` });
    appendChildren(
      row,
      el("strong", {}, item.title),
      item.detail ? el("div", { className: "label" }, item.detail) : null,
      item.cta && item.onClick ? button(item.cta, item.onClick, false) : null,
    );
    wrap.appendChild(row);
  });
  return wrap;
}

function renderSidebar() {
  const panel = el("div", { className: "panel soft sidebar-panel empire-drawer-panel" });
  panel.appendChild(el("h2", { className: "empire-drawer-title" }, globalThis.t("empire")));
  const resources = el("div", { className: "resource-grid empire-metric-grid" });
  const empireMetrics = [
    [globalThis.t("gold"), globalThis.state.player.gold],
    [globalThis.t("culture"), globalThis.state.player.culture],
    [globalThis.t("metricFood"), totalEmpireFood()],
    [globalThis.t("tradePower"), globalThis.state.world.tradePower],
    [globalThis.t("prestige"), globalThis.state.world.prestige],
    [globalThis.t("diplomacy"), globalThis.state.world.diplomacy],
    [globalThis.t("crisis"), globalThis.state.world.crisisPressure],
  ];
  empireMetrics.forEach(([labelText, value]) => {
    const card = el("div", { className: "resource-card empire-metric-card" });
    appendChildren(card, el("strong", {}, labelText), el("div", { className: "value" }, String(value)));
    resources.appendChild(card);
  });
  panel.appendChild(resources);

  const body = el("div", { className: "empire-drawer-body" });

  const colResources = el("div", { className: "empire-drawer-column empire-drawer-col-resources" });
  colResources.appendChild(sectionTitle(globalThis.t("empireResourcesTitle")));
  const resourceList = el("div", { className: "policy-list empire-connected-resources-list" });
  const connectedResources = Object.keys(globalThis.state.player.resources || {}).filter((resourceId) => getPlayerResourceCount(resourceId) > 0);
  if (!connectedResources.length) {
    resourceList.appendChild(el("div", { className: "empty-note" }, globalThis.t("noEmpireResources")));
  } else {
    connectedResources.forEach((resourceId) => {
      const row = el("div", { className: "policy-row" });
      appendChildren(row, 
        el("strong", {}, `${resourceGlyph(resourceId)} ${getResourceDisplayName(resourceId)}`),
        el("div", { className: "label" }, globalThis.t("resourceCountLine", { total: getPlayerResourceCount(resourceId), free: getResourceSurplus(resourceId) })),
        el("div", { className: "label" }, getResourceEffectText(resourceId)),
        getResourceUnlockedBuildingsText(resourceId) ? el("div", { className: "label" }, getResourceUnlockedBuildingsText(resourceId)) : null,
        getResourceUnlockedTechsText(resourceId) ? el("div", { className: "label" }, getResourceUnlockedTechsText(resourceId)) : null,
        getResourceSynergyText(resourceId) ? el("div", { className: "label" }, globalThis.t("resourceChainBonus", { value: getResourceSynergyText(resourceId) })) : null,
      );
      resourceList.appendChild(row);
    });
  }
  colResources.appendChild(resourceList);

  const colCities = el("div", { className: "empire-drawer-column empire-drawer-col-cities" });
  colCities.appendChild(sectionTitle(globalThis.t("cities")));
  const cityList = el("div", { className: "city-list" });
  globalThis.state.player.cities.forEach((city) => {
    const row = el("div", { className: "city-row" });
    const info = citySummary(city);
    appendChildren(row,
      el("strong", {}, `${city.isCapital ? `${globalThis.t("capitalTag")} ` : ""}${getCityName(city)}`),
      el("div", { className: "label" }, city.isCapital
        ? globalThis.t("cityLinePopOnly", { population: city.population, cap: city.populationCap })
        : globalThis.t("cityLine1", { role: getRoleName(city), population: city.population, cap: city.populationCap })),
      el("div", { className: "label" }, globalThis.t("cityLine2", { food: city.foodStock, foodCap: city.foodCap, hammers: city.hammerStock, hammerCap: city.hammerCap })),
      el("div", { className: "label" }, globalThis.t("cityLine3", { value: info })),
      button(city.nameKey === globalThis.state.selectedCity && globalThis.state.view === "city" ? globalThis.t("opened") : globalThis.t("openCity"), () => openCity(city.nameKey), city.nameKey === globalThis.state.selectedCity && globalThis.state.view === "city"),
    );
    cityList.appendChild(row);
  });
  colCities.appendChild(cityList);

  const colPolicies = el("div", { className: "empire-drawer-column empire-drawer-col-policies" });
  colPolicies.appendChild(sectionTitle(globalThis.t("policies")));
  colPolicies.appendChild(el("div", { className: "label muted empire-policies-hint" }, globalThis.t("policiesEmpireHint")));
  const policyList = el("div", { className: "policy-list empire-policy-grid" });
  POLICIES.forEach((policy) => {
    const available = policy.available(globalThis.state);
    const row = el("div", { className: "policy-row" });
    appendChildren(row, 
      el("strong", {}, globalThis.t(policy.nameKey)),
      el("div", { className: "label" }, globalThis.t(policy.descriptionKey)),
      button(globalThis.t("policyUse", { cost: policy.cost }), () => applyPolicy(policy.id), !available),
    );
    policyList.appendChild(row);
  });
  colPolicies.appendChild(policyList);

  appendChildren(body, colResources, colCities, colPolicies);
  panel.appendChild(body);

  return panel;
}

function renderMainStage() {
  const stage = el("div", { className: "main-stage hud-main-stage" });
  const content = el("div", { className: `hud-stage-content ${globalThis.state.view === "world" ? "hud-stage-content-world" : ""} hud-preset-${globalThis.uiState.hudPreset}` });
  content.appendChild(globalThis.state.view === "world" ? renderWorldView() : renderCityView(getSelectedCity()));
  stage.appendChild(content);
  if (globalThis.state.view !== "world") {
    stage.appendChild(renderHudDock());
  }
  if (globalThis.uiState.hudPanelOpen) {
    stage.appendChild(renderHudOverlayPanel());
  }
  return stage;
}

function renderHudDock() {
  const wrap = el("div", { className: "hud-dock", role: "toolbar", "aria-label": globalThis.t("hudEmpireDockLabel") });
  const empireBtn = el("button", {
    type: "button",
    className: `hud-dock-empire-btn ${globalThis.uiState.hudPanelOpen && globalThis.uiState.hudPanelTab === "empire" ? "hud-dock-active" : ""}`.trim(),
    "aria-label": globalThis.t("hudEmpireButtonAria"),
    title: globalThis.t("hudEmpireButtonAria"),
  });
  const icon = iconNode("capital");
  icon.setAttribute("aria-hidden", "true");
  empireBtn.appendChild(icon);
  empireBtn.addEventListener("click", () => {
    globalThis.tryStartMusic();
    globalThis.playButtonClickSound();
    openHudPanel("empire");
  });
  wrap.appendChild(empireBtn);
  return wrap;
}

function renderHudOverlayPanel() {
  const frame = el("div", { className: "hud-overlay-panel-frame hud-overlay-frame--wide" });
  const closeBtn = button(globalThis.t("close"), () => {
    globalThis.uiState.hudPanelOpen = false;
    globalThis.render();
  }, false);
  closeBtn.classList.add("hud-overlay-close");

  const panel = renderSidebar();
  panel.classList.add("hud-overlay-panel");
  if (globalThis.uiState.hudPanelTab === "alerts") {
    panel.classList.add("hud-overlay-alerts");
  }
  frame.appendChild(closeBtn);
  frame.appendChild(panel);
  return frame;
}

function openHudPanel(tab) {
  globalThis.uiState.hudPanelTab = tab;
  globalThis.uiState.hudPanelOpen = true;
  globalThis.uiState.headerMenuOpen = false;
  globalThis.render();
}

Object.assign(globalThis, {
  collectAllPriorityActions,
  collectPriorityActions,
  collectTurnEndBlockers,
  requestEndTurn,
  focusRaiseScoutAction,
  focusCityWorkforce,
  renderPriorityActionsPanel,
  renderHeader,
  renderSidebar,
  renderMainStage,
  renderHudDock,
  renderHudOverlayPanel,
  openHudPanel,
});
