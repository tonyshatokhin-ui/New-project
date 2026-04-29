function renderHeader() {
  const header = el("div", { className: "header" });
  const titleGroup = el("div", { className: "title-group" });
  appendChildren(titleGroup, 
    el("h1", {}, t("gameTitle")),
    el("p", {}, t("gameSubtitle", { turn: state.turn })),
  );

  const actions = el("div", { className: "action-row" });
  appendChildren(actions, 
    button(t("worldMap"), () => switchView("world"), state.view === "world"),
    button(t("cityButton", { city: getCityName(getSelectedCity()) }), () => switchView("city"), state.view === "city"),
    button(t("turnLog"), toggleLog),
    button(t("endTurn"), nextTurn, Boolean(state.world.pendingEncounter)),
    button(t("resetRun"), resetGame),
    button(t("mainMenu"), openMainMenu),
    button(uiState.musicOn ? t("musicOn") : t("musicOff"), toggleMusic),
    button(t("languageEn"), () => setLocale("en"), locale === "en"),
    button(t("languageRu"), () => setLocale("ru"), locale === "ru"),
  );

  appendChildren(header, titleGroup, actions);
  return header;
}

function collectPriorityActions() {
  const actions = [];
  const addAction = (item) => actions.push(item);
  const capital = getCapitalCity();
  const scout = getPrimaryScout();

  if (!scout && canRaiseScout()) {
    addAction({
      tone: "warn",
      title: t("noticeScoutMissing"),
      cta: t("actionRaiseScout"),
      onClick: () => focusRaiseScoutAction(),
    });
  } else if (scout && scout.status === "idle") {
    addAction({
      tone: "warn",
      title: t("noticeScoutIdle"),
      detail: getScoutStatusText(scout),
      cta: t("actionOpenWorld"),
      onClick: () => switchView("world"),
    });
  }

  if (state.player.gold < 0) {
    addAction({
      tone: "danger",
      title: t("noticeGoldDeficit", { value: state.player.gold }),
      detail: t("cityOrderTrade"),
      cta: t("actionOpenCityView"),
      onClick: () => openCity(getSelectedCity().nameKey),
    });
  }

  const hostileCount = hostileFrontierTiles().length + getHostileRaiders().length;
  if (hostileCount > 0) {
    addAction({
      tone: "warn",
      title: t("noticeHostilesActive", { count: hostileCount }),
      cta: t("actionOpenWorld"),
      onClick: () => switchView("world"),
    });
  }

  state.player.cities.forEach((city) => {
    const yieldData = computeCityYield(city);
    const foodSurplus = foodSurplusForCity(yieldData, city);
    const freeWorkers = Math.max(0, city.population - assignedWorkers(city));
    const idleWorkers = getWorkerUnitsForCity(city.nameKey).filter((worker) => worker.status === "idle").length;
    const readyBuilding = BUILDINGS.find((building) => {
      const builtCount = city.buildings.filter((item) => item === building.id).length;
      const uniqueLocked = building.unique && builtCount > 0;
      return !uniqueLocked && buildingRequirementsMet(city, building) && city.hammerStock >= building.cost;
    });

    if (foodSurplus < 0) {
      addAction({
        tone: "danger",
        title: t("noticeCityHungry", { city: getCityName(city), value: signed(foodSurplus) }),
        cta: t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (freeWorkers > 0) {
      addAction({
        tone: "warn",
        title: t("noticeIdleCitizens", { city: getCityName(city), count: freeWorkers }),
        cta: t("actionAssignWorkers"),
        onClick: () => focusCityWorkforce(city.nameKey),
      });
    }

    if (readyBuilding) {
      addAction({
        tone: "good",
        title: t("noticeBuildingReady", { city: getCityName(city), building: t(readyBuilding.nameKey) }),
        cta: t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (city.directiveChangeCount === 0) {
      addAction({
        tone: "good",
        title: t("noticeDirectiveFree", { city: getCityName(city) }),
        cta: t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (city.specializationChangeCount === 0) {
      addAction({
        tone: "good",
        title: t("noticeSpecializationFree", { city: getCityName(city) }),
        cta: t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }

    if (idleWorkers > 0) {
      addAction({
        tone: "warn",
        title: t("noticeIdleWorkers", { city: getCityName(city), count: idleWorkers }),
        cta: t("actionOpenCity", { city: getCityName(city) }),
        onClick: () => openCity(city.nameKey),
      });
    }
  });

  const priority = { danger: 0, warn: 1, good: 2 };
  return actions
    .sort((left, right) => (priority[left.tone] ?? 9) - (priority[right.tone] ?? 9))
    .slice(0, 10);
}

function focusRaiseScoutAction() {
  uiState.selectedHexId = state.world.startTileId;
  state.view = "world";
  uiState.focusRequest = {
    selector: "#action-raise-scout",
    fallbackSelector: ".hex-inspector",
  };
  render();
}

function focusCityWorkforce(cityNameKey) {
  state.selectedCity = cityNameKey;
  state.view = "city";
  uiState.focusRequest = {
    selector: "#city-workforce-section",
    fallbackSelector: ".city-district-band",
  };
  render();
}

function renderPriorityActionsPanel(actions = collectPriorityActions()) {
  const wrap = el("div", { className: "policy-list priority-list" });
  if (!actions.length) {
    wrap.appendChild(el("div", { className: "empty-note" }, t("priorityActionsEmpty")));
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
  const panel = el("div", { className: "panel soft" });
  panel.appendChild(el("h2", {}, t("empire")));

  const resources = el("div", { className: "resource-grid" });
  [
    [t("gold"), state.player.gold],
    [t("culture"), state.player.culture],
    [t("metricFood"), totalEmpireFood()],
    [t("tradePower"), state.world.tradePower],
    [t("prestige"), state.world.prestige],
    [t("diplomacy"), state.world.diplomacy],
    [t("crisis"), state.world.crisisPressure],
  ].forEach(([labelText, value]) => {
    const card = el("div", { className: "resource-card" });
    appendChildren(card, el("strong", {}, labelText), el("div", { className: "value" }, String(value)));
    resources.appendChild(card);
  });
  panel.appendChild(resources);

  const priorityActions = collectPriorityActions();
  const topTone = priorityActions.some((item) => item.tone === "danger")
    ? "danger"
    : priorityActions.some((item) => item.tone === "warn")
      ? "warn"
      : "good";
  const prioritySection = el("div", { className: `priority-panel ${topTone}` });
  const priorityHead = el(
    "div",
    { className: "section-head priority-head" },
    el("h3", {}, t("priorityActionsTitle")),
    el("span", { className: `priority-badge ${topTone}` }, String(priorityActions.length)),
  );
  appendChildren(prioritySection, priorityHead, renderPriorityActionsPanel(priorityActions));
  panel.appendChild(prioritySection);

  panel.appendChild(sectionTitle(t("empireResourcesTitle")));
  const resourceList = el("div", { className: "policy-list" });
  const connectedResources = Object.keys(state.player.resources || {}).filter((resourceId) => getPlayerResourceCount(resourceId) > 0);
  if (!connectedResources.length) {
    resourceList.appendChild(el("div", { className: "empty-note" }, t("noEmpireResources")));
  } else {
    connectedResources.forEach((resourceId) => {
      const row = el("div", { className: "policy-row" });
      appendChildren(row, 
        el("strong", {}, `${resourceGlyph(resourceId)} ${getResourceDisplayName(resourceId)}`),
        el("div", { className: "label" }, t("resourceCountLine", { total: getPlayerResourceCount(resourceId), free: getResourceSurplus(resourceId) })),
        el("div", { className: "label" }, getResourceEffectText(resourceId)),
        getResourceUnlockedBuildingsText(resourceId) ? el("div", { className: "label" }, getResourceUnlockedBuildingsText(resourceId)) : null,
        getResourceUnlockedTechsText(resourceId) ? el("div", { className: "label" }, getResourceUnlockedTechsText(resourceId)) : null,
        getResourceSynergyText(resourceId) ? el("div", { className: "label" }, t("resourceChainBonus", { value: getResourceSynergyText(resourceId) })) : null,
      );
      resourceList.appendChild(row);
    });
  }
  panel.appendChild(resourceList);

  panel.appendChild(sectionTitle(t("cities")));
  const cityList = el("div", { className: "city-list" });
  state.player.cities.forEach((city) => {
    const row = el("div", { className: "city-row" });
    const info = citySummary(city);
    appendChildren(row, 
      el("strong", {}, `${city.isCapital ? `${t("capitalTag")} ` : ""}${getCityName(city)}`),
      el("div", { className: "label" }, t("cityLine1", { role: getRoleName(city), population: city.population, cap: city.populationCap })),
      el("div", { className: "label" }, t("cityLine2", { food: city.foodStock, foodCap: city.foodCap, hammers: city.hammerStock, hammerCap: city.hammerCap })),
      el("div", { className: "label" }, t("cityLine3", { value: info })),
      button(city.nameKey === state.selectedCity && state.view === "city" ? t("opened") : t("openCity"), () => openCity(city.nameKey), city.nameKey === state.selectedCity && state.view === "city"),
    );
    cityList.appendChild(row);
  });
  panel.appendChild(cityList);

  panel.appendChild(sectionTitle(t("policies")));
  const policyList = el("div", { className: "policy-list" });
  POLICIES.forEach((policy) => {
    const available = policy.available(state);
    const row = el("div", { className: "policy-row" });
    appendChildren(row, 
      el("strong", {}, t(policy.nameKey)),
      el("div", { className: "label" }, t(policy.descriptionKey)),
      button(t("policyUse", { cost: policy.cost }), () => applyPolicy(policy.id), !available),
    );
    policyList.appendChild(row);
  });
  panel.appendChild(policyList);

  return panel;
}

function renderMainStage() {
  const stage = el("div", { className: "main-stage" });
  stage.appendChild(state.view === "world" ? renderWorldView() : renderCityView(getSelectedCity()));
  return stage;
}

