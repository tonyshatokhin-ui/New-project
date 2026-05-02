function getCityAssignedFieldArmySoldiers(city) {
  if (!city || typeof getFieldArmyUnits !== "function") return 0;
  return getFieldArmyUnits().reduce(
    (sum, unit) => (unit.homeCityKey === city.nameKey ? sum + (unit.soldiers || 0) : sum),
    0,
  );
}

function getCityArmyUpkeepTotals(city) {
  const totalSoldiersForUpkeep = (city.soldiers || 0) + getCityAssignedFieldArmySoldiers(city);
  return {
    food: getArmyFoodUpkeep(totalSoldiersForUpkeep),
    gold: getArmyGoldUpkeep(totalSoldiersForUpkeep),
  };
}

function renderCitySwitcher(currentCity) {
  if (!globalThis.state.player.cities?.length || globalThis.state.player.cities.length < 2) return null;
  const row = el("div", { className: "city-switcher", role: "tablist" });
  row.setAttribute("aria-label", globalThis.t("citySwitcherLabel"));
  globalThis.state.player.cities.forEach((c) => {
    const isCurrent = c.nameKey === currentCity.nameKey;
    row.appendChild(button(getCityName(c), () => openCity(c.nameKey), isCurrent));
  });
  return row;
}

/** Launcher tab: icon + label, no emoji. */
function cityLauncherButton(iconName, labelKey, tone, actionId, openFn) {
  const btn = el("button", { type: "button", className: "city-launcher-btn" });
  const labelText = globalThis.t(labelKey);
  btn.setAttribute("aria-label", labelText);
  btn.appendChild(el("span", { className: `city-launcher-icon tone-${tone}`, "aria-hidden": "true" }, iconNode(iconName)));
  btn.appendChild(document.createTextNode(" "));
  btn.appendChild(el("span", { className: "city-launcher-label" }, labelText));
  btn.addEventListener("click", () => {
    globalThis.tryStartMusic();
    globalThis.playButtonClickSound();
    openFn(actionId);
  });
  return btn;
}

function renderCityView(city) {
  const inspectMode = Boolean(globalThis.uiState.citySceneInspect);
  const panel = el("div", { className: `panel city-panel active-stage-panel ${inspectMode ? "inspect-mode" : ""}` });
  const toolbarMain = el("div", { className: "city-view-toolbar-main" });
  appendChildren(
    toolbarMain,
    el("h2", {}, globalThis.t("cityScreen")),
    renderCitySwitcher(city),
  );

  const toolbarActions = el("div", { className: "city-view-toolbar-actions" });
  toolbarActions.appendChild(renderCityRendererBadge());
  toolbarActions.appendChild(button(inspectMode ? globalThis.t("cityInspectExit") : globalThis.t("cityInspectEnter"), toggleCitySceneInspect, false));
  if (inspectMode) {
    appendChildren(
      toolbarActions,
      button(globalThis.t("cityInspectZoomOut"), zoomOutCityScene, false),
      button(globalThis.t("cityInspectZoomIn"), zoomInCityScene, false),
      button(globalThis.t("cityInspectReset"), resetCityScenePan, false),
    );
  }

  const toolbar = el("div", { className: "city-view-toolbar" }, toolbarMain, toolbarActions);
  panel.appendChild(toolbar);

  const screen = el("div", { className: `city-screen ${inspectMode ? "inspect-mode" : ""}` });
  const forecast = computeCityYield(city);
  const foodSurplus = forecast.food - getCityFoodNeed(city);
  const growthNeed = getGrowthNeed(city);
  const growthGain = getGrowthDelta(foodSurplus, city);
  const cityStatus = getCityStatus(city, foodSurplus);
  const alerts = getCityAlerts(city, foodSurplus);
  const directive = getCityDirective(city);
  const specialization = getCitySpecialization(city);
  const freeWorkers = Math.max(0, city.population - assignedWorkers(city));

  const ribbon = el("div", { className: "city-resource-ribbon" });
  appendChildren(ribbon, 
    flowCard(iconLabel("resource-grain", globalThis.t("metricFood"), "growth"), `${city.foodStock}/${city.foodCap}`, signed(foodSurplus)),
    flowCard(iconLabel("resource-stone", globalThis.t("metricHammers"), "economy"), `${city.hammerStock}/${city.hammerCap}`, signed(forecast.hammers)),
    flowCard(iconLabel("resource-copper", globalThis.t("gold"), "economy"), `${globalThis.state.player.gold}`, signed(forecast.gold)),
    flowCard(iconLabel("resource-incense", globalThis.t("culture"), "civic"), `${globalThis.state.player.culture}`, signed(forecast.culture)),
    flowCard(iconLabel("worker", globalThis.t("metricPopulation"), "civic"), `${city.population}/${city.populationCap}`, `${globalThis.t("freeWorkersShort", { value: freeWorkers })}`),
    flowCard(iconLabel("scout", globalThis.t("metricArmy"), "military"), `${city.soldiers}/${city.soldierCap}`, signed(forecast.soldiers)),
    flowCard(iconLabel("explore", globalThis.t("growthLabel"), "growth"), `${city.growthProgress}/${growthNeed}`, signed(growthGain)),
  );
  if (!inspectMode) {
  screen.appendChild(ribbon);
  }

  const cityLayout = el("div", { className: `city-layout ${inspectMode ? "inspect-mode" : ""}` });
  const left = el("div", { className: "city-column city-column-left panel soft" },
      el("div", { className: "tile-header" },
        el("h3", {}, `${city.isCapital ? `${globalThis.t("capitalTag")} ` : ""}${getCityName(city)}`),
        el("span", { className: "pill good" }, globalThis.t("cityHeaderRole", { role: getRoleName(city) })),
      ),
      el("div", { className: "label" }, globalThis.t("citySceneHint")),
      el("div", { className: "city-pill-row" },
      el("span", { className: "pill" }, globalThis.t("assignedWorkers", { assigned: assignedWorkers(city), population: city.population, free: freeWorkers })),
        el("span", { className: "pill" }, globalThis.t(specialization.labelKey)),
        el("span", { className: `pill ${cityStatus.tone}` }, globalThis.t(cityStatus.labelKey)),
      ),
      el("div", { className: "city-alert-list" },
        ...alerts.map((alert) => el("div", { className: `city-alert ${alert.tone}` }, alert.text)),
      ),
    renderCitySocialSummary(city),
    el("div", { className: "label" }, globalThis.t("armyUpkeepLine", getCityArmyUpkeepTotals(city))),
  );

  const center = el("div", { className: "city-column city-column-center" });
  const scene = el("div", { className: `city-scene ${inspectMode ? "inspect-mode" : ""}` });
  scene.style.setProperty("--scene-pan-x", `${globalThis.uiState.cityScenePan?.x || 0}px`);
  scene.style.setProperty("--scene-pan-y", `${globalThis.uiState.cityScenePan?.y || 0}px`);
  scene.style.setProperty("--scene-zoom", `${globalThis.uiState.citySceneZoom || 1}`);
  if (shouldUseThreeCityScene()) {
    appendChildren(scene, renderCityBackdropThree(scene, city, inspectMode));
  } else {
    appendChildren(scene, renderCityBackdropSvg(city, inspectMode));
    setupCitySceneDrag(scene, inspectMode);
  }
  center.appendChild(scene);

  const right = renderCityActionLauncher(city, scene, freeWorkers, directive, specialization);
  if (inspectMode) {
    cityLayout.appendChild(center);
  } else {
    appendChildren(cityLayout, left, center, right);
  }
  screen.appendChild(cityLayout);
  if (!inspectMode && globalThis.uiState.cityActionModal) {
    screen.appendChild(renderCityActionModal(city, scene));
  }
  panel.appendChild(screen);
  return panel;
}

function renderCityActionLauncher(city, scene, freeWorkers, directive, specialization) {
  const wrap = el("div", { className: "city-column city-column-right panel soft city-action-launcher", id: "city-workforce-section" });
  const actions = el("div", { className: "city-action-buttons" });
  const openAction = (actionId) => {
    globalThis.uiState.cityActionModal = actionId;
    globalThis.uiState.cityActionLast = actionId;
    globalThis.render();
  };
  appendChildren(
    actions,
    cityLauncherButton("worker", "workers", "civic", "workers", openAction),
    cityLauncherButton("city", "buildings", "economy", "buildings", openAction),
    cityLauncherButton("resource-incense", "technologies", "civic", "technologies", openAction),
    cityLauncherButton("explore", "cityDirectiveTitle", "growth", "directive", openAction),
    cityLauncherButton("army", "unitActionsTitle", "military", "units", openAction),
  );

  const summary = el("div", { className: "city-action-summary" });
  appendChildren(
    summary,
    el("h3", {}, iconLabel("worker", globalThis.t("workers"), "civic")),
    el("div", { className: "label" }, globalThis.t("assignedWorkers", { assigned: assignedWorkers(city), population: city.population, free: freeWorkers })),
    el("div", { className: "label" }, `${globalThis.t("cityDirectiveTitle")}: ${globalThis.t(directive.labelKey)}`),
    el("div", { className: "label" }, `${globalThis.t("citySpecializationTitle")}: ${globalThis.t(specialization.labelKey)}`),
    el("div", { className: "label" }, globalThis.t("armyUpkeepLine", getCityArmyUpkeepTotals(city))),
  );

  wrap.appendChild(actions);
  wrap.appendChild(summary);
  return wrap;
}

function renderCityActionModal(city, scene) {
  const actionId = globalThis.uiState.cityActionModal || globalThis.uiState.cityActionLast || "workers";
  const backdrop = el("div", { className: "city-action-modal-backdrop" });
  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    globalThis.uiState.cityActionModal = null;
    globalThis.render();
  });

  const modal = el("div", { className: "city-action-modal panel soft" });
  const title = actionId === "workers"
    ? globalThis.t("workers")
    : actionId === "buildings"
      ? globalThis.t("buildings")
      : actionId === "technologies"
        ? globalThis.t("technologies")
        : actionId === "directive"
          ? globalThis.t("cityDirectiveTitle")
          : globalThis.t("unitActionsTitle");
  appendChildren(
    modal,
      el("div", { className: "tile-header" },
      el("h3", {}, title),
      button(globalThis.t("close"), () => {
        globalThis.uiState.cityActionModal = null;
        globalThis.render();
      }, false),
    ),
    renderCityActionModalContent(actionId, city, scene),
  );

  backdrop.appendChild(modal);
  return backdrop;
}

function renderCityActionModalContent(actionId, city, scene) {
  const content = el("div", { className: "city-action-modal-content" });
  const freeWorkers = Math.max(0, city.population - assignedWorkers(city));

  if (actionId === "workers") {
    appendChildren(
      content,
      el("div", { className: "label" }, globalThis.t("assignedWorkers", { assigned: assignedWorkers(city), population: city.population, free: freeWorkers })),
    renderCityDistrictGroup(city, "cityGroupSustenance", ["fields", "ports"], "city-group-sustenance"),
    renderCityDistrictGroup(city, "cityGroupEconomy", ["mines", "market"], "city-group-economy"),
    renderCityDistrictGroup(city, "cityGroupPower", ["temples", "barracks"], "city-group-power"),
  );
    return content;
  }

  if (actionId === "buildings") {
  const buildList = el("div", { className: "build-list" });
  BUILDINGS.forEach((building) => {
    const builtCount = city.buildings.filter((item) => item === building.id).length;
    const requirementsMet = buildingRequirementsMet(city, building);
      const queued = typeof isBuildingQueued === "function" && isBuildingQueued(city, building.id);
    const row = el("div", { className: "build-row" });
      row.dataset.buildingId = building.id;
      row.addEventListener("mouseenter", () => {
        setCityBuildingHover(scene, building.id);
      });
      row.addEventListener("mouseleave", () => {
        setCityBuildingHover(scene, null);
      });
      appendChildren(
        row,
      el("strong", {}, `${globalThis.t(building.nameKey)}${builtCount ? ` x${builtCount}` : ""}`),
      el("div", { className: "label" }, globalThis.t(building.descriptionKey)),
      el("div", { className: "label" }, globalThis.t("costHammers", { cost: building.cost })),
        button(globalThis.t("build"), () => queueBuildingConstruction(city.nameKey, building.id), city.hammerStock < building.cost || (building.unique && builtCount > 0) || queued || !requirementsMet),
      );
      buildList.appendChild(row);
    });
    content.appendChild(buildList);
    return content;
  }

  if (actionId === "units") {
    const fieldFromCity = getCityAssignedFieldArmySoldiers(city);
    appendChildren(
      content,
      el("h3", {}, iconLabel("scout", globalThis.t("unitActionsTitle"), "military")),
      el("div", { className: "label" }, globalThis.t("armyUpkeepLine", {
        food: getArmyFoodUpkeep(city.soldiers + fieldFromCity),
        gold: getArmyGoldUpkeep(city.soldiers + fieldFromCity),
      })),
    );
    const unitList = el("div", { className: "policy-list" });
    const deployAll = Math.max(0, city.soldiers);
    const half = Math.min(deployAll, Math.max(1, Math.ceil(city.soldiers / 2)));
    const showHalfButton = half > 1 && half < deployAll;

    const deployRow = el("div", { className: "policy-row" });
    appendChildren(
      deployRow,
      el("strong", {}, globalThis.t("armyDeployAction")),
      el("div", { className: "label" }, globalThis.t("armyDeployHint", { soldiers: city.soldiers })),
      button(globalThis.t("armyDeployOne"), () => deploySoldier(city.nameKey, 1), typeof canDeployArmyFromCity !== "function" || !canDeployArmyFromCity(city, 1)),
    );
    if (showHalfButton) {
      deployRow.appendChild(button(
        globalThis.t("armyDeployHalf", { n: half }),
        () => deploySoldier(city.nameKey, half),
        typeof canDeployArmyFromCity !== "function" || !canDeployArmyFromCity(city, half),
      ));
    }
    deployRow.appendChild(button(globalThis.t("armyDeployAll"), () => deploySoldier(city.nameKey, deployAll), typeof canDeployArmyFromCity !== "function" || !canDeployArmyFromCity(city, deployAll)));
    unitList.appendChild(deployRow);

    unitList.appendChild(el("div", { className: "policy-row" },
      el("strong", {}, globalThis.t("armyTrainSettler")),
      el("div", { className: "label" }, city.settlerTrainingTurns > 0
        ? globalThis.t("armyTrainSettlerActive", { turns: city.settlerTrainingTurns })
        : globalThis.t("armyTrainSettlerHint", {
          cost: ARMY_SETTLER_CONFIG.settlerTrainingCostGold,
          turns: ARMY_SETTLER_CONFIG.settlerTrainingTurns,
          max: ARMY_SETTLER_CONFIG.maxPlayerCities,
        })),
      button(globalThis.t("armyTrainSettlerOrder"), () => trainSettler(city.nameKey), typeof canTrainSettler !== "function" || !canTrainSettler(city)),
    ));

    unitList.appendChild(el("div", { className: "policy-row" },
      el("strong", {}, globalThis.t("workerTrain")),
      el("div", { className: "label" }, city.workerTrainingTurns > 0
        ? globalThis.t("workerTrainingActive", { turns: city.workerTrainingTurns })
        : globalThis.t("workerTrainHint", { cost: WORKER_CONFIG.trainingCostGold, turns: WORKER_CONFIG.trainingTurns })),
      button(globalThis.t("workerTrain"), () => trainWorker(city.nameKey), !canTrainWorker(city)),
    ));

    getWorkerUnitsForCity(city.nameKey).forEach((worker) => {
      const row = el("div", { className: "policy-row" });
      appendChildren(row,
        el("strong", {}, globalThis.t("workerUnitRowTitle", { id: worker.id })),
        el("div", { className: "label" }, getWorkerStatusText(worker)),
        button(globalThis.t("workerSelect"), () => selectArmy(worker.id), globalThis.uiState.selectedArmyId === worker.id),
      );
      unitList.appendChild(row);
    });
    content.appendChild(unitList);
    return content;
  }

  if (actionId === "technologies") {
    appendChildren(
      content,
      el("div", { className: "label" }, globalThis.t("cityTechModalHint")),
      el("div", { className: "pill" }, globalThis.t("cityTechCultureReserve", { value: globalThis.state.player.culture })),
    );
    const techList = el("div", { className: "policy-list" });
    TECHNOLOGIES.forEach((tech) => {
      const learned = globalThis.state.player.technologies.includes(tech.id);
      const hasResource = !tech.requiresResource || playerHasResource(tech.requiresResource);
      const prereqsOk = typeof technologyPrerequisitesMet === "function" ? technologyPrerequisitesMet(tech) : true;
      const canAffordCulture = globalThis.state.player.culture >= tech.cost;
      const canResearchNow = !learned && canAffordCulture && hasResource && prereqsOk;
      const row = el("div", { className: "policy-row" });
      appendChildren(
        row,
        el("strong", {}, globalThis.t(tech.nameKey)),
        el("div", { className: "label" }, globalThis.t("techTierLine", { tier: tech.tier })),
        el("div", { className: "label" }, globalThis.t(tech.descriptionKey)),
      );
      if (!learned) {
        row.appendChild(el("div", { className: "label" }, globalThis.t("costCulture", { cost: tech.cost })));
        if (tech.requiresResource) {
          row.appendChild(
            el(
              "div",
              { className: hasResource ? "label" : "city-alert warn" },
              globalThis.t("techRequiresRealmResource", { resource: getResourceDisplayName(tech.requiresResource) }),
            ),
          );
        }
        if (!canAffordCulture) {
          row.appendChild(el("div", { className: "city-alert warn" }, globalThis.t("techNeedMoreCulture")));
        }
        if (tech.requiresTechIds?.length) {
          row.appendChild(
            el(
              "div",
              { className: prereqsOk ? "label" : "city-alert warn" },
              globalThis.t("techRequiresPriorTechs", {
                value: tech.requiresTechIds.map((id) => getTechnologyNameById(id)).join(", "),
              }),
            ),
          );
        }
        row.appendChild(button(globalThis.t("research"), () => researchTechnology(tech.id), !canResearchNow));
      } else {
        row.appendChild(el("span", { className: "pill good", "aria-live": "polite" }, globalThis.t("learned")));
      }
      techList.appendChild(row);
    });
    content.appendChild(techList);
    return content;
  }

  appendChildren(
    content,
    el("div", { className: "label" }, globalThis.t("cityDirectiveHint")),
    el("div", { className: "directive-grid" },
      ...CITY_DIRECTIVES.map((option) => button(
        `${city.directive === option.id ? `${globalThis.t("directiveActive")}: ` : ""}${globalThis.t(option.labelKey)}`,
        () => setCityDirective(city.nameKey, option.id),
        city.directive === option.id,
      )),
    ),
    el("h3", {}, iconLabel("explore", globalThis.t("citySpecializationTitle"), "growth")),
    el("div", { className: "label" }, globalThis.t("citySpecializationHint")),
    el("div", { className: "directive-grid specialization-grid" },
      ...CITY_SPECIALIZATIONS.map((option) => button(
        `${city.specialization === option.id ? `${globalThis.t("specializationActive")}: ` : ""}${globalThis.t(option.labelKey)}`,
        () => setCitySpecialization(city.nameKey, option.id),
        city.specialization === option.id,
      )),
    ),
  );
  return content;
}

function shouldUseThreeCityScene() {
  const mode = globalThis.uiState.cityRenderMode || CITY_RENDER_MODE_OPTIONS.THREE;
  return Boolean(window.CityScene3D?.isSupported?.() && mode === CITY_RENDER_MODE_OPTIONS.THREE);
}

function renderCityRendererBadge() {
  const diag = window.CityScene3D?.getDiagnostics?.();
  if (!diag) return el("span", { className: "pill warn" }, globalThis.t("rendererBadgeNoBridge"));
  if (diag.supported) return el("span", { className: "pill good" }, globalThis.t("rendererBadgeThree"));
  const reasonKey = !diag.threePresent
    ? (diag.bootstrapStarted ? "rendererReasonThreeLoading" : "rendererReasonThreeMissing")
    : !diag.registryPresent
      ? "rendererReasonRegistryMissing"
      : !diag.webgl
        ? "rendererReasonWebglOff"
        : "rendererReasonUnsupported";
  return el("span", { className: "pill warn" }, globalThis.t("rendererBadgeSvgFallback", { reason: globalThis.t(reasonKey), protocol: diag.protocol || "" }));
}

function setCityBuildingHover(scene, buildingId) {
  if (shouldUseThreeCityScene()) {
    const mount = scene.querySelector(".city-three-wrap");
    if (mount) {
      window.CityScene3D?.setHoveredBuilding?.(mount, buildingId);
    }
    return;
  }
  if (buildingId) {
    scene.dataset.hoverBuilding = buildingId;
  } else {
    delete scene.dataset.hoverBuilding;
  }
}

const CITY_SLOT_LAYOUT = [
  { id: "houses", x: 292, y: 294, req: null, district: "residential" },
  { id: "storehouse", x: 420, y: 332, req: null, district: "craft" },
  { id: "granary", x: 358, y: 382, req: "storehouse", district: "craft" },
  { id: "workshop", x: 490, y: 368, req: null, district: "craft" },
  { id: "market-square", x: 585, y: 430, req: null, district: "civic" },
  { id: "shrine", x: 324, y: 458, req: null, district: "sacred" },
  { id: "dock", x: 728, y: 346, req: "storehouse", district: "harbor" },
  { id: "training-ground", x: 528, y: 516, req: "workshop", district: "military" },
];

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function renderCityInspectSlotPanel(city) {
  const slotId = globalThis.uiState.cityInspectSlotId;
  if (!slotId) return null;
  const building = BUILDINGS.find((b) => b.id === slotId);
  if (!building) {
    globalThis.uiState.cityInspectSlotId = null;
    return null;
  }

  const builtCount = city.buildings.filter((x) => x === slotId).length;
  const isBuilt = builtCount > 0;
  const queue = Array.isArray(city.buildQueue) ? city.buildQueue : [];
  const qIdx = queue.findIndex((j) => j.buildingId === slotId);
  const queued = qIdx >= 0;
  const myJob = queued ? queue[qIdx] : null;
  const requirementsMet = buildingRequirementsMet(city, building);
  const estTurns =
    typeof constructionTurnsForBuilding === "function" ? constructionTurnsForBuilding(building) : 4;

  const close = () => {
    globalThis.uiState.cityInspectSlotId = null;
    globalThis.render();
  };

  let statusBody = "";
  if (isBuilt) {
    statusBody = globalThis.t("slotStatusBuilt");
  } else if (queued && qIdx === 0 && typeof myJob?.turnsLeft === "number") {
    statusBody = globalThis.t("slotStatusBuilding", { turns: myJob.turnsLeft });
  } else if (queued && qIdx > 0) {
    statusBody = globalThis.t("slotStatusQueuedBacklog", { turns: estTurns });
  } else {
    statusBody = globalThis.t("slotStatusEmpty", { turns: estTurns });
  }

  const backdrop = el("div", { className: "city-inspect-slot-backdrop", onclick: (e) => {
    if (e.target === backdrop) close();
  } });

  const card = el("div", { className: "city-inspect-slot-card panel soft" });
  appendChildren(
    card,
    el(
      "div",
      { className: "tile-header" },
      el("h3", {}, globalThis.t(building.nameKey)),
      button(globalThis.t("close"), close, false),
    ),
    el("div", { className: "label" }, globalThis.t(building.descriptionKey)),
    el("div", { className: "label city-inspect-slot-status" }, statusBody),
  );
  if (!isBuilt) {
    card.appendChild(el("div", { className: "label muted" }, globalThis.t("costHammers", { cost: building.cost })));
    // Duration is already in slotStatusEmpty / slotStatusQueuedBacklog; omit duplicate muted line here.
  }

  const canEnqueue =
    !isBuilt &&
    !queued &&
    requirementsMet &&
    city.hammerStock >= building.cost &&
    !(building.unique && builtCount > 0);

  card.appendChild(
    button(
      globalThis.t("slotBuildEnqueue"),
      () => {
        queueBuildingConstruction(city.nameKey, slotId);
        globalThis.render();
      },
      !canEnqueue,
    ),
  );

  backdrop.appendChild(card);
  return backdrop;
}

/** Display order for sliders on the 3D scene (only jobs with open capacity are shown). */
const CITY_SCENE_JOB_ORDER = ["fields", "mines", "temples", "market", "ports", "barracks"];

function renderCityBackdropThree(sceneNode, city, inspectMode) {
  const wrap = el("div", { className: "city-backdrop-wrap city-three-wrap" });
  const overlay = el("div", { className: "city-three-overlay" });
  const workerNodes = [
    { x: 22, y: 73, value: city.assignments.fields, jobId: "fields" },
    { x: 34, y: 74, value: city.assignments.mines, jobId: "mines" },
    { x: 46, y: 76, value: city.assignments.temples, jobId: "temples" },
    { x: 58, y: 74, value: city.assignments.market, jobId: "market" },
    { x: 68, y: 69, value: city.assignments.ports, jobId: "ports" },
    { x: 40, y: 83, value: city.assignments.barracks, jobId: "barracks" },
  ];
  const cachedLayout =
    typeof globalThis.uiState.workerChipLayoutByCity === "object" && globalThis.uiState.workerChipLayoutByCity !== null
      ? globalThis.uiState.workerChipLayoutByCity[city.nameKey]
      : null;
  const workDock = renderCitySceneWorkDock(city, inspectMode);
  /** @type {Array<{ chip: HTMLElement, node: (typeof workerNodes)[number]}>} */
  const workerChips = [];
  if (!inspectMode) {
    workerNodes.forEach((node) => {
      if (node.value <= 0) return;
      const chip = el("div", { className: `city-three-worker-chip job-${node.jobId}` }, String(node.value));
      const prev = cachedLayout?.[node.jobId];
      chip.style.left = `${prev ? prev.left : node.x}%`;
      chip.style.top = `${prev ? prev.top : node.y}%`;
      overlay.appendChild(chip);
      workerChips.push({ chip, node });
    });
  }
  if (workDock) overlay.appendChild(workDock);
  wrap.appendChild(overlay);
  if (inspectMode) {
    const hint = el("div", { className: "city-three-slot-hint city-three-slot-hint--inspect label" }, globalThis.t("cityInspectSlotHint"));
    wrap.appendChild(hint);
  }
  const mounted = window.CityScene3D?.mountOrSync?.(wrap, {
    city,
    inspectMode,
    highlightedBuildingId: sceneNode.dataset.hoverBuilding || null,
    onWorkerChipLayout(workerLayout) {
      if (!workerLayout || !workerChips.length) return;
      if (!globalThis.uiState.workerChipLayoutByCity || typeof globalThis.uiState.workerChipLayoutByCity !== "object") {
        globalThis.uiState.workerChipLayoutByCity = {};
      }
      globalThis.uiState.workerChipLayoutByCity[city.nameKey] = {
        ...(globalThis.uiState.workerChipLayoutByCity[city.nameKey] || {}),
        ...workerLayout,
      };
      workerChips.forEach(({ chip, node }) => {
        const p = workerLayout[node.jobId];
        if (!p) return;
        chip.style.left = `${p.left}%`;
        chip.style.top = `${p.top}%`;
      });
    },
    onSlotPicked: (slotId) => {
      globalThis.uiState.cityInspectSlotId = slotId;
      globalThis.render();
    },
  });
  if (!mounted) {
    wrap.classList.remove("city-three-wrap");
    wrap.appendChild(renderCityBackdropSvg(city, inspectMode).firstChild);
  } else if (inspectMode && globalThis.uiState.cityInspectSlotId) {
    const bubble = renderCityInspectSlotPanel(city);
    if (bubble) wrap.appendChild(bubble);
  }
  return wrap;
}

function renderCityBackdropSvg(city, inspectMode = false) {
  const wrap = el("div", { className: "city-backdrop-wrap" });
  const svg = svgEl("svg", {
    class: "city-backdrop-svg",
    viewBox: "0 0 960 640",
    preserveAspectRatio: inspectMode ? "xMidYMid meet" : "xMidYMid slice",
    "aria-hidden": "true",
  });

  const landscape = svgEl("g", { class: "city-layer landscape" });
  landscape.appendChild(svgEl("rect", { x: 0, y: 0, width: 960, height: 640, fill: "#7ba856" }));
  landscape.appendChild(svgEl("path", {
    d: "M0,270 C160,190 280,210 420,290 C560,365 710,380 960,290 L960,0 L0,0 Z",
    fill: "#6a8f43",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M0,206 C120,160 240,166 370,212 C520,264 710,268 960,188 L960,0 L0,0 Z",
    fill: "rgba(98, 132, 62, 0.55)",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M0,150 C150,104 320,108 470,156 C640,212 812,206 960,148",
    stroke: "rgba(89, 112, 57, 0.62)",
    "stroke-width": 4,
    fill: "none",
    "stroke-linecap": "round",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M0,420 C210,330 380,350 520,420 C640,480 780,520 960,500 L960,640 L0,640 Z",
    fill: "#cfbd82",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M0,368 C180,330 320,338 470,392 C590,435 760,470 960,452",
    stroke: "rgba(171, 147, 99, 0.52)",
    "stroke-width": 5,
    fill: "none",
    "stroke-linecap": "round",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M46,500 C190,462 330,470 468,522",
    stroke: "rgba(168, 136, 88, 0.4)",
    "stroke-width": 4,
    fill: "none",
    "stroke-linecap": "round",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M680,0 C770,40 860,130 910,220 C945,286 948,360 960,640 L960,0 Z",
    fill: "#5fb4d6",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M700,60 C760,120 820,220 860,360 C885,450 900,540 910,640",
    class: "city-water-shimmer",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M0,438 C180,382 320,396 470,448 C610,496 770,538 960,520",
    stroke: "rgba(226, 205, 152, 0.32)",
    "stroke-width": 14,
    fill: "none",
    "stroke-linecap": "round",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M0,338 C148,296 284,302 440,346 C592,390 754,430 960,410",
    stroke: "rgba(108, 84, 55, 0.2)",
    "stroke-width": 8,
    fill: "none",
    "stroke-linecap": "round",
  }));
  landscape.appendChild(svgEl("path", {
    d: "M430,470 C505,450 570,466 650,510",
    stroke: "#bc9a62",
    "stroke-width": 18,
    fill: "none",
    "stroke-linecap": "round",
    opacity: 0.75,
  }));
  landscape.appendChild(svgEl("path", {
    d: "M478,468 C430,430 368,398 316,360",
    stroke: "#b38f5f",
    "stroke-width": 13,
    fill: "none",
    "stroke-linecap": "round",
    opacity: 0.7,
  }));
  landscape.appendChild(svgEl("path", {
    d: "M500,462 C582,422 660,392 724,355",
    stroke: "#b38f5f",
    "stroke-width": 12,
    fill: "none",
    "stroke-linecap": "round",
    opacity: 0.68,
  }));
  landscape.appendChild(svgEl("circle", { cx: 480, cy: 468, r: 44, fill: "rgba(201, 175, 125, 0.45)" }));
  landscape.appendChild(svgEl("circle", { cx: 480, cy: 468, r: 28, fill: "rgba(224, 203, 161, 0.68)" }));
  landscape.appendChild(svgEl("circle", { cx: 480, cy: 468, r: 14, fill: "rgba(176, 146, 96, 0.72)" }));
  landscape.appendChild(svgEl("rect", { x: 474, y: 432, width: 12, height: 26, rx: 2, fill: "rgba(150, 109, 66, 0.78)" }));
  landscape.appendChild(svgEl("rect", { x: 470, y: 428, width: 20, height: 6, rx: 2, fill: "rgba(175, 137, 92, 0.82)" }));
  landscape.appendChild(svgEl("path", {
    d: "M468,458 L492,458 M472,452 L488,452",
    stroke: "rgba(107, 71, 42, 0.55)",
    "stroke-width": 1.5,
    fill: "none",
    "stroke-linecap": "round",
  }));
  landscape.appendChild(svgEl("circle", { cx: 480, cy: 468, r: 5, fill: "rgba(127, 89, 56, 0.55)" }));
  const decoLayer = svgEl("g", { class: "city-layer deco" });
  const forestLayer = svgEl("g", { class: "city-layer forest" });
  const foregroundLayer = svgEl("g", { class: "city-layer foreground" });
  appendChildren(
    decoLayer,
    svgEl("circle", { cx: 112, cy: 410, r: 18, class: "city-tree-canopy" }),
    svgEl("circle", { cx: 132, cy: 420, r: 15, class: "city-tree-canopy" }),
    svgEl("circle", { cx: 96, cy: 424, r: 14, class: "city-tree-canopy" }),
    svgEl("rect", { x: 110, y: 422, width: 6, height: 18, rx: 2, class: "city-tree-trunk" }),
    svgEl("circle", { cx: 868, cy: 374, r: 16, class: "city-tree-canopy" }),
    svgEl("circle", { cx: 884, cy: 384, r: 13, class: "city-tree-canopy" }),
    svgEl("circle", { cx: 852, cy: 386, r: 12, class: "city-tree-canopy" }),
    svgEl("rect", { x: 865, y: 386, width: 5, height: 16, rx: 2, class: "city-tree-trunk" }),
    svgEl("ellipse", { cx: 98, cy: 520, rx: 14, ry: 10, class: "city-bush" }),
    svgEl("ellipse", { cx: 124, cy: 536, rx: 13, ry: 8, class: "city-bush" }),
    svgEl("ellipse", { cx: 152, cy: 552, rx: 12, ry: 8, class: "city-bush" }),
    svgEl("ellipse", { cx: 874, cy: 556, rx: 14, ry: 10, class: "city-bush" }),
    svgEl("ellipse", { cx: 846, cy: 542, rx: 12, ry: 8, class: "city-bush" }),
    svgEl("ellipse", { cx: 818, cy: 532, rx: 11, ry: 7, class: "city-bush" }),
    svgEl("ellipse", { cx: 246, cy: 492, rx: 18, ry: 12, class: "city-bush" }),
    svgEl("ellipse", { cx: 218, cy: 506, rx: 14, ry: 9, class: "city-bush" }),
    svgEl("ellipse", { cx: 622, cy: 562, rx: 16, ry: 11, class: "city-bush" }),
    svgEl("ellipse", { cx: 690, cy: 524, rx: 13, ry: 9, class: "city-bush" }),
    svgEl("path", { d: "M560,534 L582,522 L602,536", class: "city-fence" }),
    svgEl("path", { d: "M604,538 L622,528 L640,540", class: "city-fence" }),
    svgEl("line", { x1: 716, y1: 332, x2: 716, y2: 307, class: "city-post" }),
    svgEl("line", { x1: 731, y1: 336, x2: 731, y2: 310, class: "city-post" }),
    svgEl("ellipse", { cx: 418, cy: 506, rx: 8, ry: 12, class: "city-amphora" }),
    svgEl("ellipse", { cx: 431, cy: 510, rx: 7, ry: 10, class: "city-amphora" }),
    svgEl("ellipse", { cx: 445, cy: 507, rx: 6, ry: 9, class: "city-amphora" }),
    svgEl("circle", { cx: 164, cy: 474, r: 16, class: "city-tree-canopy" }),
    svgEl("circle", { cx: 150, cy: 486, r: 13, class: "city-tree-canopy" }),
    svgEl("rect", { x: 156, y: 488, width: 6, height: 18, rx: 2, class: "city-tree-trunk" }),
    svgEl("circle", { cx: 790, cy: 440, r: 14, class: "city-tree-canopy" }),
    svgEl("circle", { cx: 808, cy: 448, r: 11, class: "city-tree-canopy" }),
    svgEl("rect", { x: 796, y: 450, width: 5, height: 16, rx: 2, class: "city-tree-trunk" }),
    svgEl("path", { d: "M118,548 C132,538 148,540 164,548", class: "city-grass" }),
    svgEl("path", { d: "M188,556 C201,546 217,548 232,556", class: "city-grass" }),
    svgEl("path", { d: "M736,548 C748,540 762,542 776,548", class: "city-grass" }),
    svgEl("path", { d: "M806,558 C819,548 835,550 850,558", class: "city-grass" }),
    svgEl("path", { d: "M56,560 C70,548 86,550 102,560", class: "city-grass" }),
    svgEl("path", { d: "M262,570 C277,558 294,560 309,570", class: "city-grass" }),
    svgEl("path", { d: "M530,582 C544,572 560,574 576,582", class: "city-grass" }),
    svgEl("path", { d: "M676,574 C690,564 706,566 722,574", class: "city-grass" }),
    svgEl("path", { d: "M438,322 L462,334 L486,322", class: "city-ruin-line" }),
    svgEl("path", { d: "M462,334 L462,350", class: "city-ruin-line" }),
    svgEl("ellipse", { cx: 455, cy: 352, rx: 22, ry: 8, class: "city-ruin-shadow" }),
    svgEl("circle", { cx: 318, cy: 536, r: 6, class: "city-rock" }),
    svgEl("circle", { cx: 332, cy: 542, r: 5, class: "city-rock" }),
    svgEl("circle", { cx: 346, cy: 538, r: 4, class: "city-rock" }),
    svgEl("circle", { cx: 764, cy: 502, r: 6, class: "city-rock" }),
    svgEl("circle", { cx: 778, cy: 508, r: 5, class: "city-rock" }),
    svgEl("circle", { cx: 792, cy: 504, r: 4, class: "city-rock" }),
    svgEl("path", { d: "M232,366 C244,354 260,356 272,366", class: "city-bird" }),
    svgEl("path", { d: "M270,352 C280,342 294,344 304,352", class: "city-bird" }),
    svgEl("path", { d: "M808,292 C818,282 832,284 842,292", class: "city-bird" }),
  );
  appendChildren(
    forestLayer,
    svgEl("circle", { cx: 82, cy: 292, r: 18, class: "city-tree-canopy deep" }),
    svgEl("circle", { cx: 104, cy: 300, r: 16, class: "city-tree-canopy deep" }),
    svgEl("circle", { cx: 60, cy: 304, r: 14, class: "city-tree-canopy deep" }),
    svgEl("rect", { x: 79, y: 304, width: 6, height: 18, rx: 2, class: "city-tree-trunk" }),
    svgEl("circle", { cx: 206, cy: 248, r: 16, class: "city-tree-canopy deep" }),
    svgEl("circle", { cx: 226, cy: 256, r: 13, class: "city-tree-canopy deep" }),
    svgEl("rect", { x: 204, y: 257, width: 5, height: 15, rx: 2, class: "city-tree-trunk" }),
    svgEl("circle", { cx: 872, cy: 246, r: 17, class: "city-tree-canopy deep" }),
    svgEl("circle", { cx: 892, cy: 255, r: 14, class: "city-tree-canopy deep" }),
    svgEl("circle", { cx: 850, cy: 260, r: 12, class: "city-tree-canopy deep" }),
    svgEl("rect", { x: 869, y: 257, width: 6, height: 17, rx: 2, class: "city-tree-trunk" }),
    svgEl("path", { d: "M758,332 C776,322 794,324 812,332", class: "city-fog-ridge" }),
    svgEl("path", { d: "M124,340 C142,330 160,332 178,340", class: "city-fog-ridge" }),
  );
  appendChildren(
    foregroundLayer,
    svgEl("ellipse", { cx: 100, cy: 612, rx: 88, ry: 20, class: "city-foreground-shadow" }),
    svgEl("ellipse", { cx: 860, cy: 608, rx: 96, ry: 22, class: "city-foreground-shadow" }),
    svgEl("circle", { cx: 74, cy: 592, r: 20, class: "city-tree-canopy close" }),
    svgEl("circle", { cx: 96, cy: 604, r: 16, class: "city-tree-canopy close" }),
    svgEl("rect", { x: 80, y: 604, width: 7, height: 20, rx: 2, class: "city-tree-trunk" }),
    svgEl("circle", { cx: 872, cy: 588, r: 19, class: "city-tree-canopy close" }),
    svgEl("circle", { cx: 892, cy: 600, r: 15, class: "city-tree-canopy close" }),
    svgEl("rect", { x: 878, y: 600, width: 7, height: 20, rx: 2, class: "city-tree-trunk" }),
    svgEl("path", { d: "M32,612 C72,578 120,574 164,612", class: "city-foreground-ridge" }),
    svgEl("path", { d: "M778,612 C818,576 868,572 920,612", class: "city-foreground-ridge" }),
    svgEl("ellipse", { cx: 540, cy: 602, rx: 22, ry: 9, class: "city-ruin-shadow" }),
    svgEl("rect", { x: 532, y: 578, width: 6, height: 20, rx: 2, class: "city-ruin-block" }),
    svgEl("rect", { x: 542, y: 586, width: 6, height: 12, rx: 2, class: "city-ruin-block" }),
  );

  const slotsLayer = svgEl("g", { class: "city-layer slots" });
  CITY_SLOT_LAYOUT.forEach((slot) => {
    const canBuild = city.buildings.includes(slot.id)
      ? false
      : BUILDINGS.some((building) => building.id === slot.id && buildingRequirementsMet(city, building));
    slotsLayer.appendChild(svgEl("path", {
      d: slotFoundationPath(slot.x, slot.y),
      class: `city-slot ${canBuild ? "available" : "locked"}`,
      "data-building-id": slot.id,
      "data-district": slot.district,
    }));
    slotsLayer.appendChild(renderSlotIcon(slot));
  });

  const buildingLayer = svgEl("g", { class: "city-layer buildings" });
  CITY_SLOT_LAYOUT.forEach((slot) => {
    if (!city.buildings.includes(slot.id)) return;
    buildingLayer.appendChild(renderBuildingShape(slot));
  });

  const overlayLayer = svgEl("g", { class: "city-layer overlay" });
  const workerNodes = [
    { x: 278, y: 520, value: city.assignments.fields, jobId: "fields" },
    { x: 390, y: 525, value: city.assignments.mines, jobId: "mines" },
    { x: 500, y: 535, value: city.assignments.temples, jobId: "temples" },
    { x: 610, y: 520, value: city.assignments.market, jobId: "market" },
    { x: 700, y: 485, value: city.assignments.ports, jobId: "ports" },
    { x: 440, y: 585, value: city.assignments.barracks, jobId: "barracks" },
  ];
  workerNodes
    .filter((node) => node.value > 0)
    .forEach((node) => {
      overlayLayer.appendChild(renderWorkerChip(node));
    });

  appendChildren(svg, landscape, forestLayer, decoLayer, slotsLayer, buildingLayer, overlayLayer, foregroundLayer);
  wrap.appendChild(svg);
  return wrap;
}

function renderBuildingShape(slot) {
  const group = svgEl("g", { class: "city-building", transform: `translate(${slot.x}, ${slot.y})` });
  group.setAttribute("data-building-id", slot.id);
  group.appendChild(svgEl("ellipse", { cx: 14, cy: 26, rx: 28, ry: 8, class: "city-cast-shadow" }));
  group.appendChild(svgEl("ellipse", { cx: 0, cy: 18, rx: 30, ry: 12, class: "city-building-shadow" }));
  group.appendChild(svgEl("ellipse", { cx: 2, cy: 20, rx: 24, ry: 9, class: "city-building-shadow-soft" }));
  if (slot.id === "houses") {
    addPseudo3dPlinth(group, 36, 8);
    group.appendChild(svgEl("ellipse", { cx: -14, cy: 2, rx: 14, ry: 10, class: "city-wall adobe" }));
    group.appendChild(svgEl("ellipse", { cx: -14, cy: 10, rx: 14, ry: 3.5, class: "city-wall-side" }));
    group.appendChild(svgEl("polygon", { points: "-29,2 1,2 -14,-21", class: "city-roof straw" }));
    group.appendChild(svgEl("ellipse", { cx: 16, cy: 4, rx: 13, ry: 9, class: "city-wall adobe" }));
    group.appendChild(svgEl("ellipse", { cx: 16, cy: 12, rx: 13, ry: 3.2, class: "city-wall-side" }));
    group.appendChild(svgEl("polygon", { points: "2,4 30,4 16,-16", class: "city-roof straw" }));
    group.appendChild(svgEl("line", { x1: -14, y1: -21, x2: -14, y2: -27, class: "city-mast" }));
    return group;
  }
  if (slot.id === "dock") {
    addPseudo3dPlinth(group, 50, 9);
    group.appendChild(svgEl("rect", { x: -24, y: -10, width: 48, height: 22, class: "city-wall" }));
    group.appendChild(svgEl("polygon", { points: "24,-10 30,-6 30,16 24,12", class: "city-wall-side" }));
    group.appendChild(svgEl("polygon", { points: "-30,-10 30,-10 0,-34", class: "city-roof straw" }));
    group.appendChild(svgEl("rect", { x: 16, y: -28, width: 6, height: 22, class: "city-mast" }));
    group.appendChild(svgEl("line", { x1: 22, y1: -22, x2: 32, y2: -14, class: "city-mast" }));
    return group;
  }
  if (slot.id === "training-ground" || slot.id === "workshop") {
    addPseudo3dPlinth(group, 54, 10);
    group.appendChild(svgEl("rect", { x: -26, y: -14, width: 52, height: 28, class: "city-wall stone" }));
    group.appendChild(svgEl("polygon", { points: "26,-14 34,-8 34,20 26,14", class: "city-wall-side stone" }));
    group.appendChild(svgEl("polygon", { points: "-32,-14 32,-14 0,-40", class: "city-roof dark" }));
    group.appendChild(svgEl("line", { x1: -20, y1: -2, x2: 20, y2: -2, class: "city-engrave" }));
    group.appendChild(svgEl("circle", { cx: 22, cy: -36, r: 5, class: "city-smoke" }));
    group.appendChild(svgEl("circle", { cx: 26, cy: -46, r: 4, class: "city-smoke" }));
    return group;
  }
  if (slot.id === "market-square") {
    addPseudo3dPlinth(group, 58, 10);
    group.appendChild(svgEl("rect", { x: -28, y: -10, width: 56, height: 24, class: "city-wall" }));
    group.appendChild(svgEl("polygon", { points: "28,-10 36,-5 36,19 28,14", class: "city-wall-side" }));
    group.appendChild(svgEl("polygon", { points: "-34,-10 34,-10 0,-28", class: "city-roof" }));
    group.appendChild(svgEl("rect", { x: -6, y: -22, width: 12, height: 10, class: "city-banner" }));
    group.appendChild(svgEl("line", { x1: -18, y1: -10, x2: -18, y2: 14, class: "city-column" }));
    group.appendChild(svgEl("line", { x1: 18, y1: -10, x2: 18, y2: 14, class: "city-column" }));
    return group;
  }
  if (slot.id === "shrine") {
    addPseudo3dPlinth(group, 44, 9);
    group.appendChild(svgEl("rect", { x: -20, y: -8, width: 40, height: 22, class: "city-wall stone" }));
    group.appendChild(svgEl("polygon", { points: "20,-8 26,-4 26,18 20,14", class: "city-wall-side stone" }));
    group.appendChild(svgEl("polygon", { points: "-24,-8 24,-8 0,-36", class: "city-roof dark" }));
    group.appendChild(svgEl("rect", { x: -2, y: -30, width: 4, height: 12, class: "city-mast" }));
    group.appendChild(svgEl("line", { x1: -11, y1: 2, x2: 11, y2: 2, class: "city-engrave" }));
    return group;
  }
  addPseudo3dPlinth(group, 44, 8);
  group.appendChild(svgEl("ellipse", { cx: 0, cy: 0, rx: 22, ry: 16, class: "city-wall adobe" }));
  group.appendChild(svgEl("ellipse", { cx: 0, cy: 11, rx: 22, ry: 4.2, class: "city-wall-side" }));
  group.appendChild(svgEl("polygon", { points: "-20,0 20,0 0,-34", class: "city-roof straw" }));
  return group;
}

function addPseudo3dPlinth(group, width, depth) {
  const half = width / 2;
  group.appendChild(svgEl("polygon", {
    points: `${-half},14 ${half},14 ${half + depth},${14 + depth * 0.55} ${-half + depth},${14 + depth * 0.55}`,
    class: "city-plinth-top",
  }));
  group.appendChild(svgEl("polygon", {
    points: `${half},14 ${half + depth},${14 + depth * 0.55} ${half + depth},${22 + depth * 0.55} ${half},22`,
    class: "city-plinth-side",
  }));
  group.appendChild(svgEl("polygon", {
    points: `${-half},14 ${half},14 ${half - 8},10 ${-half + 8},10`,
    class: "city-plinth-highlight",
  }));
}

function renderSlotIcon(slot) {
  const icon = svgEl("g", {
    class: "city-slot-icon",
    transform: `translate(${slot.x}, ${slot.y})`,
  });
  if (slot.id === "houses") {
    icon.appendChild(svgEl("path", { d: "M-10,3 L0,-9 L10,3 M-7,3 L-7,11 M7,3 L7,11", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "storehouse") {
    icon.appendChild(svgEl("path", { d: "M-11,8 L-11,-6 L11,-6 L11,8 Z M-11,0 L11,0", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "granary") {
    icon.appendChild(svgEl("path", { d: "M-10,5 C-10,-5 10,-5 10,5 C10,9 -10,9 -10,5 Z M-6,-6 L6,-6", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "workshop") {
    icon.appendChild(svgEl("path", { d: "M-11,7 L-11,-6 L11,-6 L11,7 M-6,-10 L-2,-6 M2,-10 L6,-6", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "market-square") {
    icon.appendChild(svgEl("path", { d: "M-12,-3 L0,-11 L12,-3 M-10,-3 L-10,8 M0,-3 L0,8 M10,-3 L10,8", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "shrine") {
    icon.appendChild(svgEl("path", { d: "M-10,5 L0,-10 L10,5 M0,-13 L0,-10", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "dock") {
    icon.appendChild(svgEl("path", { d: "M-12,8 L12,8 M-8,1 L-8,8 M0,1 L0,8 M8,1 L8,8 M8,-10 L8,1 L14,-4", class: "city-slot-icon-stroke" }));
  } else if (slot.id === "training-ground") {
    icon.appendChild(svgEl("path", { d: "M-11,7 L-11,-7 L11,-7 L11,7 M-7,-2 L7,2 M7,-2 L-7,2", class: "city-slot-icon-stroke" }));
  }
  return icon;
}

function slotFoundationPath(x, y) {
  return `M ${x - 54} ${y + 8} C ${x - 36} ${y - 18}, ${x + 36} ${y - 18}, ${x + 54} ${y + 8}
    C ${x + 34} ${y + 30}, ${x - 34} ${y + 30}, ${x - 54} ${y + 8} Z`;
}

function renderWorkerChip(node) {
  const group = svgEl("g", {
    class: `city-worker-chip job-${node.jobId}`,
    transform: `translate(${node.x}, ${node.y})`,
  });
  group.appendChild(svgEl("circle", { cx: 0, cy: 0, r: 14, class: "city-overlay-chip" }));
  group.appendChild(renderWorkerCitizen(node.jobId));
  group.appendChild(svgEl("text", {
    x: 0,
    y: 25,
    class: "city-overlay-count",
    "text-anchor": "middle",
  })).textContent = String(node.value);
  return group;
}

function renderWorkerCitizen(jobId) {
  const icon = svgEl("g", { class: "city-citizen" });
  icon.appendChild(svgEl("circle", { cx: 0, cy: -4.5, r: 2.3, class: "city-citizen-head" }));
  icon.appendChild(svgEl("line", { x1: 0, y1: -2, x2: 0, y2: 5, class: "city-citizen-limb body" }));
  icon.appendChild(svgEl("line", { x1: 0, y1: 0, x2: -3.2, y2: 2.4, class: "city-citizen-limb arm-left" }));
  icon.appendChild(svgEl("line", { x1: 0, y1: 0, x2: 3.2, y2: 2.4, class: "city-citizen-limb arm-right" }));
  icon.appendChild(svgEl("line", { x1: 0, y1: 5, x2: -2.4, y2: 8.5, class: "city-citizen-limb leg-left" }));
  icon.appendChild(svgEl("line", { x1: 0, y1: 5, x2: 2.4, y2: 8.5, class: "city-citizen-limb leg-right" }));

  const tool = svgEl("g", { class: "city-citizen-tool" });
  if (jobId === "fields") {
    tool.appendChild(svgEl("line", { x1: 3.8, y1: -0.8, x2: 6.6, y2: -3.8, class: "city-citizen-tool-line" }));
    tool.appendChild(svgEl("path", { d: "M5.8,-4.2 C7.3,-4.2 8.3,-3.4 8.6,-2.2", class: "city-citizen-tool-line" }));
  } else if (jobId === "mines") {
    tool.appendChild(svgEl("line", { x1: -5.5, y1: -0.8, x2: 5.5, y2: -4.2, class: "city-citizen-tool-line" }));
    tool.appendChild(svgEl("line", { x1: 2.5, y1: -5.2, x2: 6.5, y2: -2.2, class: "city-citizen-tool-line" }));
  } else if (jobId === "temples") {
    tool.appendChild(svgEl("line", { x1: 5.2, y1: -2.2, x2: 5.2, y2: -7.2, class: "city-citizen-tool-line" }));
    tool.appendChild(svgEl("line", { x1: 3.2, y1: -4.7, x2: 7.2, y2: -4.7, class: "city-citizen-tool-line" }));
  } else if (jobId === "market") {
    tool.appendChild(svgEl("rect", { x: 4.1, y: -5.4, width: 4.6, height: 3.6, rx: 0.8, class: "city-citizen-tool-line" }));
    tool.appendChild(svgEl("line", { x1: 4.1, y1: -3.6, x2: 8.7, y2: -3.6, class: "city-citizen-tool-line" }));
  } else if (jobId === "ports") {
    tool.appendChild(svgEl("line", { x1: 5.2, y1: -6.6, x2: 5.2, y2: 0.2, class: "city-citizen-tool-line" }));
    tool.appendChild(svgEl("path", { d: "M5.2,-6.1 L8.6,-3.8 L5.2,-1.8 Z", class: "city-citizen-tool-line" }));
  } else if (jobId === "barracks") {
    tool.appendChild(svgEl("line", { x1: 4.8, y1: -5.8, x2: 4.8, y2: 1.8, class: "city-citizen-tool-line" }));
    tool.appendChild(svgEl("path", { d: "M4.8,-5.8 L7.8,-3.2 L4.8,-0.8 Z", class: "city-citizen-tool-line" }));
  }
  icon.appendChild(tool);
  return icon;
}

function toggleCitySceneInspect() {
  if (globalThis.uiState.citySceneInspect) {
    globalThis.uiState.citySceneInspect = false;
    globalThis.uiState.cityInspectSlotId = null;
    resetCitySceneView();
    globalThis.render();
    return;
  }
  globalThis.uiState.citySceneInspect = true;
  globalThis.uiState.cityInspectSlotId = null;
  globalThis.uiState.citySceneZoom = 0.92;
  globalThis.uiState.cityScenePan = { x: 0, y: 0 };
  globalThis.render();
}

function resetCityScenePan() {
  resetCitySceneView();
  globalThis.render();
}

function resetCitySceneView() {
  globalThis.uiState.cityScenePan = { x: 0, y: 0 };
  globalThis.uiState.citySceneZoom = 1;
}

function zoomInCityScene() {
  globalThis.uiState.citySceneZoom = clamp((globalThis.uiState.citySceneZoom || 1) + 0.08, 0.65, 1.55);
  globalThis.render();
}

function zoomOutCityScene() {
  globalThis.uiState.citySceneZoom = clamp((globalThis.uiState.citySceneZoom || 1) - 0.08, 0.65, 1.55);
  globalThis.render();
}

function setupCitySceneDrag(sceneNode, inspectMode) {
  if (!inspectMode) return;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseX = globalThis.uiState.cityScenePan?.x || 0;
  let baseY = globalThis.uiState.cityScenePan?.y || 0;

  const onPointerMove = (event) => {
    if (!dragging) return;
    const nextX = clamp(baseX + (event.clientX - startX), -420, 420);
    const nextY = clamp(baseY + (event.clientY - startY), -300, 300);
    globalThis.uiState.cityScenePan = { x: nextX, y: nextY };
    sceneNode.style.setProperty("--scene-pan-x", `${nextX}px`);
    sceneNode.style.setProperty("--scene-pan-y", `${nextY}px`);
  };

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    sceneNode.classList.remove("dragging");
    sceneNode.releasePointerCapture?.(sceneNode.__dragPointerId);
    sceneNode.removeEventListener("pointermove", onPointerMove);
  };

  sceneNode.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    baseX = globalThis.uiState.cityScenePan?.x || 0;
    baseY = globalThis.uiState.cityScenePan?.y || 0;
    sceneNode.__dragPointerId = event.pointerId;
    sceneNode.setPointerCapture?.(event.pointerId);
    sceneNode.classList.add("dragging");
    sceneNode.addEventListener("pointermove", onPointerMove);
  });

  sceneNode.addEventListener("pointerup", stopDrag);
  sceneNode.addEventListener("pointercancel", stopDrag);
  sceneNode.addEventListener("pointerleave", stopDrag);
}

function renderCityDistrictGroup(city, titleKey, jobIds, className) {
  const wrap = el("div", { className: `city-district-group ${className}` });
  wrap.appendChild(el("div", { className: "city-district-group-title" }, iconLabel(iconForDistrictTitle(titleKey), globalThis.t(titleKey), toneForDistrictTitle(titleKey))));
  jobIds.forEach((jobId) => {
    const job = JOBS.find((item) => item.id === jobId);
    if (job) wrap.appendChild(renderCityDistrictCard(city, job));
  });
  return wrap;
}

function iconForDistrictTitle(titleKey) {
  if (titleKey === "cityGroupSustenance") return "resource-grain";
  if (titleKey === "cityGroupEconomy") return "resource-copper";
  if (titleKey === "cityGroupPower") return "army";
  return "city";
}

function toneForDistrictTitle(titleKey) {
  if (titleKey === "cityGroupSustenance") return "growth";
  if (titleKey === "cityGroupEconomy") return "economy";
  if (titleKey === "cityGroupPower") return "military";
  return "civic";
}

function iconLabel(iconName, text, tone = "civic") {
  return el(
    "span",
    { className: "city-inline-icon-label" },
    el("span", { className: `city-inline-icon tone-${tone}` }, iconNode(iconName)),
    el("span", {}, text),
  );
}

function renderCitySocialSummary(city) {
  const social = getCitySocial(city);
  if (!social) return null;
  const firstQueue = social.queue[0];
  const poor = social.plebsPoor ?? 0;
  const mid = social.plebsMid ?? 0;
  const rich = social.plebsRich ?? 0;
  const savEq = social.savingsToEquites ?? 0;
  const savPat = social.savingsToPatricians ?? 0;
  const promoCosts = typeof getSocialPromotionCosts === "function"
    ? getSocialPromotionCosts()
    : { costEq: 50, costPat: 90 };
  const nearPromo = savEq >= promoCosts.costEq * 0.85 || savPat >= promoCosts.costPat * 0.85;
  return el("div", { className: `city-social-box${nearPromo ? " city-social-savings-near" : ""}` },
    el("strong", {}, globalThis.t("socialTitle")),
    el("div", { className: "label" }, globalThis.t("socialPlebsTiersLine", { poor, mid, rich })),
    el("div", { className: "label" }, globalThis.t("socialEstatesLine", {
      equites: social.equites ?? 0,
      patricians: social.patricians ?? 0,
    })),
    el("div", { className: "label" }, globalThis.t("socialSavingsLine", {
      savEq,
      savPat,
      costEq: promoCosts.costEq,
      costPat: promoCosts.costPat,
    })),
    el("div", { className: "label" }, globalThis.t("socialQueueLine", { value: social.queue.length })),
    firstQueue ? el("div", { className: "label" }, globalThis.t("socialQueueNextLine", { step: globalThis.t(firstQueue.labelKey), turns: firstQueue.turnsLeft })) : null,
  );
}

function renderCityDistrictCard(city, job) {
  const row = el("div", { className: `district-card district-${job.id}` });
  const yields = formatYield(job.baseYield(city));
  appendChildren(row, 
    el("div", { className: "district-card-head" },
      el("strong", { className: "district-title" },
        el("span", { className: "district-title-icon" }, iconNode(iconForCityJob(job.id))),
        el("span", {}, globalThis.t(job.labelKey)),
      ),
      el("span", { className: "pill" }, city.assignments[job.id]),
    ),
    el("div", { className: "label" }, globalThis.t(job.descriptionKey)),
    el("div", { className: "label" }, globalThis.t("currentYield", { value: yields || globalThis.t("noOutput") })),
    renderSlider(city, job.id),
  );
  return row;
}

function iconForCityJob(jobId) {
  if (jobId === "fields") return "resource-grain";
  if (jobId === "ports") return "resource-harbor";
  if (jobId === "mines") return "resource-stone";
  if (jobId === "market") return "resource-copper";
  if (jobId === "temples") return "resource-incense";
  if (jobId === "barracks") return "raider";
  return "city";
}

function renderCitySceneJobSlider(city, jobId) {
  const job = JOBS.find((item) => item.id === jobId);
  const max = getAssignmentMax(city, jobId);
  const wrap = el("div", { className: "city-scene-job-slider" });
  const input = el("input", {
    type: "range",
    min: 0,
    max,
    value: city.assignments[jobId],
    className: "district-slider",
  });
  input.setAttribute("aria-valuemin", "0");
  input.setAttribute("aria-valuemax", String(max));
  input.setAttribute("aria-valuenow", String(city.assignments[jobId]));
  if (job) input.setAttribute("aria-label", globalThis.t(job.labelKey));
  input.addEventListener("input", (event) => {
    globalThis.tryStartMusic();
    globalThis.playSliderTickSound();
    setWorkers(city.nameKey, jobId, Number(event.target.value));
    const nextVal = city.assignments[jobId];
    input.value = String(nextVal);
    input.setAttribute("aria-valuenow", String(nextVal));
  });
  appendChildren(
    wrap,
    el("div", { className: "city-scene-job-slider-row" },
      el("span", { className: "city-scene-job-slider-icon", "aria-hidden": "true" }, iconNode(iconForCityJob(jobId))),
      el("span", { className: "city-scene-job-slider-label" }, job ? globalThis.t(job.labelKey) : jobId),
      el("span", { className: "city-scene-job-slider-count", "aria-hidden": "true" }, `${city.assignments[jobId]}/${max}`),
    ),
    input,
  );
  return wrap;
}

function renderCitySceneWorkDock(city, inspectMode) {
  if (inspectMode) return null;
  const openJobs = CITY_SCENE_JOB_ORDER.filter((id) => getAssignmentMax(city, id) > 0);
  if (!openJobs.length) return null;
  const dock = el("div", {
    className: "city-scene-work-dock",
  });
  dock.appendChild(el("div", { className: "city-scene-work-dock-heading label" }, globalThis.t("citySceneWorkDockTitle")));
  const row = el("div", { className: "city-scene-work-dock-row" });
  openJobs.forEach((jobId) => row.appendChild(renderCitySceneJobSlider(city, jobId)));
  dock.appendChild(row);
  return dock;
}

function syncCityDirectiveText(scene, city, directive) {
  const directiveSummary = scene.querySelector(".city-order-box.secondary .label");
  if (directiveSummary) {
    directiveSummary.textContent = `${globalThis.t(directive.labelKey)} - ${globalThis.t(directive.descriptionKey)}`;
  }
  const specializationSummary = scene.querySelector(".specialization-box .label");
  if (specializationSummary) {
    const specialization = getCitySpecialization(city);
    specializationSummary.textContent = `${globalThis.t(specialization.labelKey)} - ${globalThis.t(specialization.descriptionKey)}`;
  }
  const directiveButtons = scene.querySelectorAll(".city-directive-card .directive-grid button");
  directiveButtons.forEach((buttonNode, index) => {
    const directiveOption = CITY_DIRECTIVES[index];
    if (!directiveOption) return;
    buttonNode.textContent = `${city.directive === directiveOption.id ? `${globalThis.t("directiveActive")}: ` : ""}${globalThis.t(directiveOption.labelKey)}`;
  });
  const specializationButtons = scene.querySelectorAll(".specialization-grid button");
  specializationButtons.forEach((buttonNode, index) => {
    const specializationOption = CITY_SPECIALIZATIONS[index];
    if (!specializationOption) return;
    buttonNode.textContent = `${city.specialization === specializationOption.id ? `${globalThis.t("specializationActive")}: ` : ""}${globalThis.t(specializationOption.labelKey)}`;
  });
}

Object.assign(globalThis, {
  getCityAssignedFieldArmySoldiers,
  getCityArmyUpkeepTotals,
  renderCitySwitcher,
  cityLauncherButton,
  renderCityView,
  renderCityActionLauncher,
  renderCityActionModal,
  renderCityActionModalContent,
  shouldUseThreeCityScene,
  renderCityRendererBadge,
  setCityBuildingHover,
  svgEl,
  renderCityInspectSlotPanel,
  renderCityBackdropThree,
  renderCityBackdropSvg,
  renderBuildingShape,
  addPseudo3dPlinth,
  renderSlotIcon,
  slotFoundationPath,
  renderWorkerChip,
  renderWorkerCitizen,
  toggleCitySceneInspect,
  resetCityScenePan,
  resetCitySceneView,
  zoomInCityScene,
  zoomOutCityScene,
  setupCitySceneDrag,
  renderCityDistrictGroup,
  iconForDistrictTitle,
  toneForDistrictTitle,
  iconLabel,
  renderCitySocialSummary,
  renderCityDistrictCard,
  iconForCityJob,
  renderCitySceneJobSlider,
  renderCitySceneWorkDock,
  syncCityDirectiveText,
});
