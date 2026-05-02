function getNationRowStripeClass(factionState) {
  if (factionState.allied) return "nation-stripe--ally";
  if (!factionState.contactEstablished) return "nation-stripe--unknown";
  const r = factionState.relation;
  if (r >= 58) return "nation-stripe--cordial";
  if (r >= 32) return "nation-stripe--neutral";
  return "nation-stripe--cold";
}

function toggleMapLayer(layerKey) {
  const cur = { ...(globalThis.uiState.mapLayers || {}) };
  cur[layerKey] = !cur[layerKey];
  globalThis.uiState.mapLayers = cur;
  if (typeof persistSettings === "function") persistSettings();
  globalThis.render();
}

function renderMapLayerToggles() {
  const layers = globalThis.uiState.mapLayers || {};
  const wrap = el("div", { className: "map-layer-toggles", role: "group", "aria-label": globalThis.t("mapLayersGroupLabel") });
  const mkBtn = (key, labelKey) => {
    const on = layers[key] !== false;
    const btn = el("button", {
      type: "button",
      className: `map-layer-toggle ${on ? "is-on" : "is-off"}`,
      "aria-pressed": on ? "true" : "false",
    });
    btn.textContent = globalThis.t(labelKey);
    btn.addEventListener("click", () => toggleMapLayer(key));
    return btn;
  };
  appendChildren(wrap, mkBtn("terrain", "mapLayerTerrain"), mkBtn("borders", "mapLayerBorders"), mkBtn("resources", "mapLayerResources"), mkBtn("units", "mapLayerUnits"));
  return wrap;
}

/** Short map chrome cue: idle workers or hunger risk, whichever is more acute. */
function getWorldCityAttentionMessage() {
  for (const city of globalThis.state.player.cities) {
    const yieldData = computeCityYield(city);
    const foodSurplus = foodSurplusForCity(yieldData, city);
    if (foodSurplus < 0) {
      return globalThis.t("worldAttentionHunger", { city: getCityName(city) });
    }
  }
  let worst = { city: null, count: 0 };
  globalThis.state.player.cities.forEach((city) => {
    const free = Math.max(0, city.population - assignedWorkers(city));
    if (free > worst.count) worst = { city, count: free };
  });
  if (worst.city && worst.count > 0) {
    return globalThis.t("worldAttentionIdle", { city: getCityName(worst.city), count: worst.count });
  }
  return null;
}

function renderWorldView() {
  const hudPreset = globalThis.uiState.hudPreset || "standard";
  const isMinimalHud = hudPreset === "minimal";
  const panel = el(
    "div",
    { className: `panel world-panel active-stage-panel world-panel--compact${isMinimalHud ? " world-panel--minimal" : ""}` },
  );
  if (!isMinimalHud) {
    const head = el("div", { className: "world-panel-head" });
    appendChildren(
      head,
      el("h2", {}, globalThis.t("nationsTitle")),
      el("p", { className: "muted world-panel-hint" }, globalThis.t("nationsHint")),
    );
    panel.appendChild(head);
    panel.appendChild(renderWorldStatusBar());
  }

  const worldTop = el("div", { className: "world-stage-grid" });
  const nationsPanel = el("div", { className: "panel soft world-nations-panel" });
  nationsPanel.appendChild(el("h3", {}, globalThis.t("countriesTitle")));
  const nationList = el("div", { className: "policy-list" });
  const knownFactions = Object.values(FACTIONS).filter((faction) => {
    const factionState = globalThis.state.world.factions[faction.id];
    return factionState?.met || factionState?.contactEstablished;
  });
  if (!knownFactions.length) {
    nationsPanel.classList.add("world-nations-panel--empty");
    nationList.appendChild(el("div", { className: "empty-note" }, globalThis.t("noKnownNations")));
  }

  knownFactions.forEach((faction) => {
    const factionState = globalThis.state.world.factions[faction.id];
    const expanded = globalThis.uiState.nationsExpandedId === faction.id;
    const row = el("div", { className: `policy-row nation-row${expanded ? " nation-row--expanded" : ""}` });
    const summary = el("div", { className: "nation-row-summary" });
    const toggleBtn = el("button", {
      type: "button",
      className: "nation-row-toggle",
      "aria-expanded": expanded ? "true" : "false",
      "aria-label": expanded ? globalThis.t("nationRowCollapse") : globalThis.t("nationRowExpand"),
      title: expanded ? globalThis.t("nationRowCollapse") : globalThis.t("nationRowExpand"),
    });
    toggleBtn.appendChild(document.createTextNode(expanded ? "\u25BE" : "\u25B8"));
    toggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      globalThis.uiState.nationsExpandedId = expanded ? null : faction.id;
      globalThis.render();
    });
    appendChildren(
      summary,
      el("span", { className: `nation-stripe ${getNationRowStripeClass(factionState)}`, "aria-hidden": "true" }),
      el("strong", {}, faction.name),
      el("span", { className: "nation-relation-pill tabular-nums" }, `${factionState.relation}/100`),
      el("span", { className: "nation-row-spacer", "aria-hidden": "true" }),
      toggleBtn,
      button(globalThis.t("interact"), () => openDiplomacyForFaction(faction.id)),
    );
    row.appendChild(summary);
    if (expanded) {
      const details = el("div", { className: "nation-row-details" });
      appendChildren(
        details,
        el("div", { className: "label" }, faction.description),
        el("div", { className: "label" }, globalThis.t("relationsStatus", {
          value: factionState.relation,
          contact: factionState.contactEstablished ? globalThis.t("contactEstablished") : globalThis.t("unknownContact"),
        })),
      );
      row.appendChild(details);
    }
    nationList.appendChild(row);
  });
  nationsPanel.appendChild(nationList);

  const mapPanel = el("div", { className: `panel soft world-map-panel ${getWorldHudShiftClass()}` });
  const mapHead = el("div", { className: "world-map-panel-head" });
  mapHead.appendChild(el("h3", {}, globalThis.t("hexWorldTitle")));
  mapHead.appendChild(el("div", { className: "map-panel-layer-bar" }, renderMapLayerToggles()));
  const attn = getWorldCityAttentionMessage();
  if (attn) {
    mapHead.appendChild(el("div", { className: "world-attention-pill", role: "status" }, attn));
  }
  mapPanel.appendChild(mapHead);

  const mapStage = el("div", { className: "world-map-stage" });
  const R = typeof WORLD_CONFIG !== "undefined" && WORLD_CONFIG.hexFlatRadiusPx ? WORLD_CONFIG.hexFlatRadiusPx : 32;
  const fullH = Math.sqrt(3) * R;
  const mapPadPx = 36;
  const bounds = accumulateHexLayoutBounds(globalThis.state.world.hexTiles, R);
  const mapBoxW = bounds.width + mapPadPx * 2;
  const mapBoxH = bounds.height + mapPadPx * 2;

  const mapWrap = el("div", { className: "hex-map-wrap" });
  mapWrap.appendChild(el("div", { className: "hex-map-fog-edge", "aria-hidden": "true" }));
  const mapScroll = el("div", { className: "hex-map-scroll" });
  const layers = globalThis.uiState.mapLayers || {};
  const hexMap = el("div", { className: "hex-map" });
  hexMap.style.setProperty("--hex-r", `${R}px`);
  hexMap.style.width = `${mapBoxW}px`;
  hexMap.style.height = `${mapBoxH}px`;
  if (layers.terrain === false) hexMap.classList.add("map-layer-no-terrain");
  if (layers.borders === false) hexMap.classList.add("map-layer-no-borders");
  if (layers.resources === false) hexMap.classList.add("map-layer-no-resources");
  if (layers.units === false) hexMap.classList.add("map-layer-no-units");

  globalThis.state.world.hexTiles.forEach((tile) => {
    const ownerClass = tile.discovered ? `owner-${tile.owner}` : "owner-fogged";
    const territoryTone = getTerritoryTone(tile);
    const territoryClass = territoryTone ? `territory-${territoryTone}` : "";
    const moveTargetClass = canMoveScoutToTile(tile) ? "scout-move-target" : "";
    const fieldMoveClass = typeof canMoveFieldUnitToTile === "function" && canMoveFieldUnitToTile(tile) ? "field-unit-move-target" : "";
    const exploreTargetClass = canScoutExploreTile(tile) ? "scout-explore-target" : "";
    const workerEnclosureClass = canBuildEnclosureOnTile(tile) ? "worker-enclosure-target" : "";
    const enclosedClass = tile.enclosed ? "enclosed-tile" : "";
    const stateBorderEdges = getTerritoryBorderEdges(tile);
    const hasStateBorder = stateBorderEdges.length > 0 && territoryTone;
    const borderClass = hasStateBorder ? `state-border-tile state-border-${territoryTone}` : "";
    const isSelected = globalThis.uiState.selectedHexId === tile.id;
    const tileEl = el("button", {
      type: "button",
      className: `hex-tile terrain-${tile.terrain} ${ownerClass} ${territoryClass} ${enclosedClass} ${borderClass} ${tile.hostile ? "hostile-tile" : ""} ${tile.wildBeast ? "wild-beast-tile" : ""} ${moveTargetClass} ${fieldMoveClass} ${exploreTargetClass} ${workerEnclosureClass} ${isSelected ? "selected" : ""}`,
    });
    tileEl.setAttribute("data-hex-id", String(tile.id));
    const terrainWord = tile.terrain
      ? tile.terrain.charAt(0).toUpperCase() + tile.terrain.slice(1)
      : "";
    tileEl.setAttribute(
      "aria-label",
      tile.discovered
        ? globalThis.t("hexMapTileAriaDiscovered", { id: tile.id, terrain: terrainWord })
        : globalThis.t("hexMapTileAriaFog", { id: tile.id }),
    );

    const center = offsetQrToHexMapPixel(tile.q, tile.r, R);
    const left = center.xCenter - R - bounds.minL + mapPadPx;
    const top = center.yCenter - fullH / 2 - bounds.minT + mapPadPx;
    tileEl.style.left = `${left}px`;
    tileEl.style.top = `${top}px`;
    tileEl.addEventListener("click", () => handleHexClick(tile.id));
    tileEl.addEventListener("dblclick", () => handleHexDoubleClick(tile.id));
    tileEl.addEventListener("mouseenter", () => {
      tileEl.classList.add("hex-hover");
    });
    tileEl.addEventListener("mouseleave", () => {
      tileEl.classList.remove("hex-hover");
    });

    if (!tile.discovered) {
      appendChildren(tileEl, el("span", { className: "hex-fog" }, "?"));
    } else {
      appendTerrainBlendLayers(tileEl, tile);
      appendChildren(tileEl, el(
        "span",
        { className: `hex-terrain-mark terrain-mark-${tile.terrain}`, title: tile.terrain },
        iconNode(`terrain-${tile.terrain}`),
      ));
      const specialMarker = getHexPrimaryMarker(tile);
      if (specialMarker) {
        appendChildren(tileEl, el("span", { className: "hex-marker-primary", title: specialMarker.title }, iconNode(specialMarker.icon)));
      } else if (tile.resource) {
        appendChildren(tileEl, el(
          "span",
          { className: `hex-resource resource-${tile.resource}`, title: tile.resource },
          iconNode(`resource-${tile.resource}`),
        ));
      }
    }

    if (scoutDeployingAtTile(tile.id)) {
      appendChildren(
        tileEl,
        el(
          "span",
          {
            className: "hex-marker-scout-pending",
            title: globalThis.t("scoutPendingMarkerTitle"),
            "aria-label": globalThis.t("scoutPendingMarkerTitle"),
            role: "img",
          },
          iconNode("scout"),
        ),
      );
    } else if (scoutStationedOnCityHex(tile.id)) {
      appendChildren(
        tileEl,
        el(
          "span",
          {
            className: "hex-marker-scout-secondary",
            title: globalThis.t("scoutOnCityHexTitle"),
            "aria-label": globalThis.t("scoutOnCityHexTitle"),
            role: "img",
          },
          iconNode("scout"),
        ),
      );
    }

    if (hasStateBorder) {
      stateBorderEdges.forEach((edge) => {
        appendChildren(tileEl, el("span", { className: `hex-state-border-edge hex-state-border-${territoryTone} edge-${edge}` }));
      });
    }

    if (isSelected) {
      appendChildren(tileEl, el("span", { className: "hex-selection-ring" }));
    }

    hexMap.appendChild(tileEl);
  });
  mapScroll.appendChild(hexMap);
  mapWrap.appendChild(mapScroll);
  mapStage.appendChild(mapWrap);
  attachHexMapAutoFit(mapScroll, hexMap, mapBoxW, mapBoxH);
  if (hudPreset !== "minimal") {
    mapStage.appendChild(el("div", { className: "map-legend-slot" }, renderMapLegend()));
  }
  mapStage.appendChild(renderWorldPriorityOverlay());
  const topRightStack = el("div", { className: "world-map-top-right-stack" });
  topRightStack.appendChild(renderWorldEmpireControl());
  topRightStack.appendChild(renderWorldQuickActions());
  const hi = renderHexInspector();
  topRightStack.appendChild(hi.inspector);
  mapStage.appendChild(topRightStack);
  if (hi.actionDock) {
    mapStage.appendChild(hi.actionDock);
  }
  mapPanel.appendChild(mapStage);
  if (hudPreset !== "minimal") {
    mapPanel.appendChild(renderWorldEventFeed());
  }
  mapPanel.appendChild(renderWorldActionBar());

  const showNations = hudPreset === "detailed" || knownFactions.length > 0;
  const nationsVisible = showNations && !isMinimalHud;
  if (nationsVisible) {
    appendChildren(worldTop, nationsPanel, mapPanel);
  } else {
    worldTop.classList.add("world-stage-grid--focus-map");
    worldTop.appendChild(mapPanel);
  }
  panel.appendChild(worldTop);

  scheduleHexActionsDockPosition();

  return panel;
}

/**
 * Fits hex grid into its viewport using transform: scale (centered, no upscale).
 * Single shared ResizeObserver — replaced each render to avoid leaking observers on stale DOM.
 */
let _hexMapResizeObserver = null;
let _hexActionsDockScrollCleanup = null;
function scheduleHexActionsDockPosition() {
  requestAnimationFrame(() => {
    positionHexActionsDock();
    requestAnimationFrame(() => positionHexActionsDock());
  });
}

function hexTileSelectorForId(tileId) {
  const id = String(tileId);
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return `[data-hex-id="${CSS.escape(id)}"]`;
  }
  const escaped = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `[data-hex-id="${escaped}"]`;
}

function positionHexActionsDock() {
  const dock = document.getElementById("hex-actions-dock");
  if (!dock) return;
  const tile = typeof getSelectedHex === "function" ? getSelectedHex() : null;
  if (!tile) {
    dock.style.display = "none";
    return;
  }
  const tileEl = document.querySelector(hexTileSelectorForId(tile.id));
  if (!tileEl) {
    dock.style.display = "none";
    return;
  }
  dock.style.display = "";
  const tileRect = tileEl.getBoundingClientRect();
  const gap = 10;
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const maxPanelH = Math.min(viewportH * 0.65, viewportH - margin * 2);
  dock.style.position = "fixed";
  dock.style.zIndex = "65";
  dock.style.maxHeight = `${maxPanelH}px`;
  dock.style.overflowY = "auto";
  dock.style.visibility = "hidden";
  dock.style.left = "0";
  dock.style.top = "0";
  dock.style.transform = "none";
  const dockW = dock.offsetWidth;
  const dockH = dock.offsetHeight;
  let left = tileRect.right + gap;
  if (left + dockW > viewportW - margin) {
    left = tileRect.left - gap - dockW;
  }
  if (left < margin) {
    left = margin;
  }
  let top = tileRect.top + tileRect.height / 2 - dockH / 2;
  if (top < margin) top = margin;
  if (top + dockH > viewportH - margin) {
    top = Math.max(margin, viewportH - margin - dockH);
  }
  dock.style.left = `${left}px`;
  dock.style.top = `${top}px`;
  dock.style.transform = "none";
  dock.style.visibility = "";
}

function attachHexMapAutoFit(scrollEl, hexMap, mapBoxW, mapBoxH) {
  const fit = () => {
    const availW = scrollEl.clientWidth;
    const availH = scrollEl.clientHeight;
    if (!availW || !availH || !mapBoxW || !mapBoxH) return;
    const scale = Math.min(availW / mapBoxW, availH / mapBoxH, 1);
    hexMap.style.transform = `scale(${scale})`;
    hexMap.dataset.fitScale = scale.toFixed(3);
    hexMap.style.setProperty("--map-fit-scale", scale.toFixed(3));
    scheduleHexActionsDockPosition();
  };
  requestAnimationFrame(fit);
  if (_hexActionsDockScrollCleanup) {
    _hexActionsDockScrollCleanup();
    _hexActionsDockScrollCleanup = null;
  }
  const onScroll = () => scheduleHexActionsDockPosition();
  scrollEl.addEventListener("scroll", onScroll, { passive: true });
  _hexActionsDockScrollCleanup = () => scrollEl.removeEventListener("scroll", onScroll);
  if (typeof ResizeObserver !== "undefined") {
    if (_hexMapResizeObserver) _hexMapResizeObserver.disconnect();
    _hexMapResizeObserver = new ResizeObserver(fit);
    _hexMapResizeObserver.observe(scrollEl);
  }
}

function renderWorldEmpireControl() {
  const btn = el("button", {
    type: "button",
    className: `world-map-empire-btn hud-dock-empire-btn ${globalThis.uiState.hudPanelOpen && globalThis.uiState.hudPanelTab === "empire" ? "hud-dock-active" : ""}`.trim(),
    "aria-label": globalThis.t("hudEmpireButtonAria"),
    title: globalThis.t("hudEmpireButtonAria"),
  });
  const icon = iconNode("capital");
  icon.setAttribute("aria-hidden", "true");
  btn.appendChild(icon);
  btn.addEventListener("click", () => {
    globalThis.tryStartMusic();
    globalThis.playButtonClickSound();
    openHudPanel("empire");
  });
  return btn;
}

function renderWorldQuickActions() {
  const wrap = el("div", { className: "world-quick-actions" });
  wrap.appendChild(el("strong", {}, globalThis.t("unitActionsTitle")));
  const list = el("div", { className: "world-quick-actions-list" });
  const canRaise = canRaiseScout();
  if (canRaise) {
    const row = el("div", { className: "policy-row", id: "action-raise-scout-row" });
    const actionButton = button(globalThis.t("scoutRaised"), () => {
      globalThis.uiState.selectedHexId = globalThis.state.world.startTileId;
      raiseScout();
    }, false);
    actionButton.id = "action-raise-scout";
    appendChildren(
      row,
      el("div", { className: "label" }, globalThis.t("scoutRaisedHint")),
      actionButton,
    );
    list.appendChild(row);
  } else {
    list.appendChild(el("div", { className: "label" }, globalThis.t("unitActionsNoImmediate")));
  }
  wrap.appendChild(list);
  return wrap;
}

function renderMapLegend() {
  const legend = el("div", { className: "map-legend" });
  appendChildren(legend, 
    el("strong", { className: "map-legend-title" }, globalThis.t("mapLegendTitle")),
    renderLegendItem(iconNode("city"), globalThis.t("legendCity")),
    renderLegendItem(iconNode("scout"), globalThis.t("legendScout")),
    renderLegendItem(iconNode("army"), globalThis.t("legendArmy")),
    renderLegendItem(iconNode("settler"), globalThis.t("legendSettler")),
    renderLegendItem(iconNode("worker"), globalThis.t("workerLegend")),
    renderLegendItem(iconNode("raider"), globalThis.t("legendRaider")),
    renderLegendItem(iconNode("rival"), globalThis.t("legendRival")),
    renderLegendItem(iconNode("hostile"), globalThis.t("legendHostile"), "hostile"),
    renderLegendItem(iconNode("beast"), globalThis.t("legendWildBeast"), "beast"),
    renderLegendItem(iconNode("move"), globalThis.t("legendMove"), "move"),
    renderLegendItem(iconNode("explore"), globalThis.t("legendExplore"), "explore"),
  );
  return legend;
}

function renderWorldEventFeed() {
  const wrap = el("div", { className: "world-event-feed panel soft" });
  wrap.appendChild(el("h3", {}, worldIconLabel("explore", globalThis.t("recentEvents"), "growth")));
  const list = el("div", { className: "world-event-feed-list" });
  const entries = (globalThis.state.log || []).slice(0, 4);
  if (!entries.length) {
    list.appendChild(el("div", { className: "label" }, globalThis.t("noEvents")));
  } else {
    entries.forEach((entry) => {
      const tone = toneForLogEntry(entry);
      const row = el("div", { className: `world-event-item label tone-${tone}` });
      appendChildren(
        row,
        el("span", { className: `world-event-icon tone-${tone}` }, iconNode(iconForLogEntry(entry))),
        el("span", {}, resolveLogText(entry)),
      );
      list.appendChild(row);
    });
  }
  wrap.appendChild(list);
  return wrap;
}

/** When the status strip is visible (standard/detailed), scout summaries already live there; avoid repeating them in priority chips. */
function filterPriorityOverlayForWorldMap(actions) {
  const preset = globalThis.uiState.hudPreset || "standard";
  if (preset === "minimal") return actions;
  return actions.filter((item) => item.icon !== "scout");
}

function renderWorldPriorityOverlay() {
  const wrap = el("div", { className: "world-priority-overlay panel soft" });
  wrap.appendChild(el("h3", {}, worldIconLabel("hostile", globalThis.t("priorityActionsTitle"), "civic")));
  const list = el("div", { className: "world-priority-overlay-list" });
  const entries = filterPriorityOverlayForWorldMap(collectPriorityActions()).slice(0, 4);
  if (!entries.length) {
    list.appendChild(el("div", { className: "label" }, globalThis.t("priorityActionsEmpty")));
  } else {
    entries.forEach((item) => {
      const row = el("button", {
        className: `world-priority-item world-priority-button ${item.tone || "warn"}`,
      });
      row.addEventListener("click", () => {
        if (typeof item.onClick === "function") item.onClick();
      });
      appendChildren(
        row,
        el("span", { className: `world-priority-icon tone-${item.tone || "warn"}` }, iconNode(item.icon || "hostile")),
        el("span", { className: "world-priority-text" }, item.title),
      );
      list.appendChild(row);
    });
  }
  wrap.appendChild(list);
  return wrap;
}

function renderWorldActionBar() {
  const preset = globalThis.uiState.hudPreset || "standard";
  if (preset === "minimal") {
    const bar = el("div", { className: "world-action-bar world-action-bar--minimal" });
    const logBtn = button(globalThis.t("turnLog"), toggleLog, false);
    logBtn.setAttribute("aria-label", globalThis.t("turnLog"));
    bar.appendChild(logBtn);
    return bar;
  }
  const bar = el("div", { className: "world-action-bar" });
  appendChildren(
    bar,
    button(`🗺 ${globalThis.t("worldMap")}`, () => switchView("world"), globalThis.state.view === "world"),
    button(`🏛 ${globalThis.t("cityButton", { city: getCityName(getSelectedCity()) })}`, () => switchView("city"), globalThis.state.view === "city"),
    button(`📜 ${globalThis.t("turnLog")}`, toggleLog, false),
  );
  return bar;
}

function worldIconLabel(iconName, text, tone = "civic") {
  return el(
    "span",
    { className: "world-inline-icon-label" },
    el("span", { className: `world-inline-icon tone-${tone}` }, iconNode(iconName)),
    el("span", {}, text),
  );
}

function iconForLogEntry(entry) {
  const key = entry?.textKey || "";
  if (/army|settler|founded/i.test(key)) return "army";
  if (/raid|hostile|punitive|fight|conquer/i.test(key)) return "raider";
  if (/gold|trade|ship|route/i.test(key)) return "resource-copper";
  if (/growth|food|famine|hunger/i.test(key)) return "resource-grain";
  if (/scout|explore|contact/i.test(key)) return "explore";
  return "city";
}

function toneForLogEntry(entry) {
  const key = entry?.textKey || "";
  if (/raid|hostile|famine|hunger|lose|loss|disease/i.test(key)) return "military";
  if (/gold|trade|ship|route/i.test(key)) return "economy";
  if (/growth|food|joined|culture/i.test(key)) return "growth";
  return "civic";
}

function getWorldHudShiftClass() {
  const tile = getSelectedHex();
  if (!tile) return "";
  const nearRight = tile.q >= Math.floor(globalThis.state.world.mapWidth * 0.55);
  return nearRight ? "hud-shift-left" : "";
}

function renderWorldStatusBar() {
  const wrap = el("div", { className: "world-status-grid" });

  const scoutPanel = el("div", { className: "panel soft world-status-panel" });
  appendChildren(scoutPanel, 
    el("h3", {}, globalThis.t("scoutStatusTitle")),
    el("div", { className: "label" }, getScoutStatusSummary()),
  );

  const objectivesPanel = el("div", { className: "panel soft world-status-panel" });
  objectivesPanel.appendChild(el("h3", {}, globalThis.t("worldObjectivesTitle")));
  const objectiveList = el("div", { className: "objective-list" });
  getWorldObjectives().forEach((objective) => {
    objectiveList.appendChild(el("div", { className: "objective-row" }, `* ${objective}`));
  });
  objectivesPanel.appendChild(objectiveList);

  const workerPanel = el("div", { className: "panel soft world-status-panel" });
  appendChildren(workerPanel, 
    el("h3", {}, globalThis.t("workerPanelTitle")),
    el("div", { className: "label" }, getWorkerStatusSummary()),
  );

  appendChildren(wrap, scoutPanel, objectivesPanel, workerPanel);
  return wrap;
}

function renderLegendItem(marker, label, tone = "") {
  return el(
    "span",
    { className: `map-legend-item ${tone ? `map-legend-item-${tone}` : ""}` },
    el("span", { className: "map-legend-marker" }, marker),
    el("span", {}, label),
  );
}

function scoutDeployingAtTile(tileId) {
  const scoutUnit = typeof getPrimaryScout === "function" ? getPrimaryScout() : null;
  return Boolean(scoutUnit && scoutUnit.status === "deploying" && scoutUnit.tileId === tileId);
}

/** Primary marker is city/capital icon — show a corner scout badge when the scout is on that hex. */
function scoutStationedOnCityHex(tileId) {
  const scoutUnit = typeof getPrimaryScout === "function" ? getPrimaryScout() : null;
  if (!scoutUnit || scoutUnit.tileId !== tileId || scoutUnit.status === "deploying") return false;
  return Boolean(cityAtTile(tileId));
}

function getHexPrimaryMarker(tile) {
  const city = cityAtTile(tile.id);
  const raider = hostileRaiderAtTile(tile.id);
  const armyField = typeof fieldArmyAtTile === "function" ? fieldArmyAtTile(tile.id) : null;
  const settleField = typeof settlerUnitAtTile === "function" ? settlerUnitAtTile(tile.id) : null;
  const worker = workerAtTile(tile.id);
  const scoutUnit = typeof getPrimaryScout === "function" ? getPrimaryScout() : null;
  const scoutHere =
    scoutUnit &&
    scoutUnit.tileId === tile.id &&
    scoutUnit.status !== "deploying";

  if (city?.isCapital) return { icon: "capital", title: "capital" };
  if (city) return { icon: "city", title: "city" };
  if (raider) return { icon: "raider", title: "raider" };
  if (armyField) return { icon: "army", title: "army" };
  if (settleField) return { icon: "settler", title: "settler" };
  if (scoutHere) return { icon: "scout", title: "scout" };
  if (tile.owner === "player" && tile.enclosed) return { icon: "suburb", title: "enclosed suburb" };
  if (tile.owner === "rival") return { icon: "rival", title: "enemy territory" };
  if (tile.wildBeast) return { icon: "beast", title: "wild beast" };
  if (tile.hostile) return { icon: "hostile", title: "hostile frontier" };
  if (worker) return { icon: "worker", title: "worker" };
  return null;
}

function getTerritoryTone(tile) {
  if (!tile?.discovered) return "";
  const territoryGroup = getTerritoryGroup(tile);
  if (territoryGroup === "player") return "player";
  if (!territoryGroup.startsWith("rival:")) return "";
  return globalThis.state.world.factions[tile.factionId]?.allied ? "ally" : "enemy";
}

function getTerritoryGroup(tile) {
  if (!tile) return "void";
  if (tile.owner === "player") return "player";
  if (tile.owner === "rival") return `rival:${tile.factionId || "unknown"}`;
  return tile.owner || "neutral";
}

function isTerritoryBorderTile(tile) {
  return getTerritoryBorderEdges(tile).length > 0;
}

function appendTerrainBlendLayers(tileEl, tile) {
  if (tile.terrain === "river") {
    getWaterConnectionEdges(tile).forEach((edge) => {
      appendChildren(tileEl, el("span", { className: `hex-water-flow flow-${edge}` }));
    });
    appendChildren(tileEl, el("span", { className: "hex-water-core" }));
  }

  if (tile.terrain === "coast") {
    getTerrainNeighborEdges(tile, (neighbor) => neighbor.terrain === "sea").forEach((edge) => {
      appendChildren(tileEl, el("span", { className: `hex-coast-water edge-${edge}` }));
    });
  }

  if (tile.terrain === "forest") {
    getTerrainNeighborEdges(tile, (neighbor) => neighbor.terrain === "forest").forEach((edge) => {
      appendChildren(tileEl, el("span", { className: `hex-forest-canopy edge-${edge}` }));
    });
  }
}

function getWaterConnectionEdges(tile) {
  const edges = getTerrainNeighborEdges(tile, (neighbor) => ["river", "coast", "sea"].includes(neighbor.terrain));
  if (edges.length >= 2) return edges;
  if (edges.length === 1) return [edges[0], oppositeHexEdge(edges[0])];
  return ["ne", "sw"];
}

function oppositeHexEdge(edge) {
  return {
    ne: "sw",
    e: "w",
    se: "nw",
    sw: "ne",
    w: "e",
    nw: "se",
  }[edge] || "sw";
}

function getTerrainNeighborEdges(tile, predicate) {
  return getHexNeighborEdges(tile)
    .filter(({ neighbor }) => neighbor.discovered && predicate(neighbor))
    .map(({ edge }) => edge);
}

function getTerritoryBorderEdges(tile) {
  const territoryTone = getTerritoryTone(tile);
  if (!territoryTone) return [];
  const territoryGroup = getTerritoryGroup(tile);
  return getHexNeighborEdges(tile)
    .filter(({ neighbor }) => {
    return getTerritoryGroup(neighbor) !== territoryGroup;
    })
    .map(({ edge }) => edge);
}

function getHexNeighborEdges(tile) {
  const origin = offsetToCube(tile.q, tile.r);
  const directions = [
    { edge: "e", x: 1, y: -1, z: 0 },
    { edge: "ne", x: 1, y: 0, z: -1 },
    { edge: "nw", x: 0, y: 1, z: -1 },
    { edge: "w", x: -1, y: 1, z: 0 },
    { edge: "sw", x: -1, y: 0, z: 1 },
    { edge: "se", x: 0, y: -1, z: 1 },
  ];

  return directions.map((direction) => {
    const next = cubeToOffset(origin.x + direction.x, origin.z + direction.z);
    return {
      edge: direction.edge,
      neighbor: globalThis.state.world.hexTiles.find((entry) => entry.q === next.q && entry.r === next.r) || { discovered: false },
    };
  });
}

function getScoutStatusSummary() {
  const scout = getPrimaryScout();
  if (!scout) return globalThis.t("scoutStatusNone");
  if (scout.status === "deploying") return globalThis.t("scoutStatusDeploying");
  if (scout.status === "moving" && scout.targetTileId) {
    return globalThis.t("scoutStatusMoving", { tile: getHexRegionName(getTileById(scout.targetTileId) || { id: scout.targetTileId, terrain: "" }) });
  }
  if (scout.status === "exploring" && scout.targetTileId) {
    return globalThis.t("scoutStatusExploring", { tile: getHexRegionName(getTileById(scout.targetTileId) || { id: scout.targetTileId, terrain: "" }) });
  }
  return globalThis.t("scoutStatusReady", { tile: getHexRegionName(getTileById(scout.tileId) || { id: scout.tileId, terrain: "" }) });
}

function getWorkerStatusSummary() {
  const worker = getSelectedWorker() || getWorkerUnits()[0];
  if (!worker) return globalThis.t("workerStatusNone");
  return getWorkerStatusText(worker);
}

function getWorldObjectives() {
  const objectives = [];
  if (globalThis.state.runOutcome === "victory") {
    objectives.push(globalThis.t("objectiveCampaignWonShort"));
  } else if (typeof getCampaignObjectiveLine === "function") {
    objectives.push(getCampaignObjectiveLine());
  }
  const scout = getPrimaryScout();
  const knownFactions = Object.values(globalThis.state.world.factions).filter((faction) => faction.met || faction.contactEstablished);
  const hostileTiles = globalThis.state.world.hexTiles.filter((tile) => tile.hostile);
  const activeRaiders = getHostileRaiders();
  const connectedResourceCount = Object.values(globalThis.state.player.resources || {}).reduce((sum, value) => sum + value, 0);

  if (!scout) {
    objectives.push(globalThis.t("objectiveDeployScout"));
  } else if (scout.status === "idle") {
    const scoutTile = getTileById(scout.tileId);
    const canExplore = scoutTile
      ? getHexNeighbors(scoutTile, globalThis.state.world.hexTiles).some((tile) => !tile.discovered && tile.terrain !== "sea")
      : false;
    if (canExplore) objectives.push(globalThis.t("objectiveExploreFrontier"));
  }

  if (!knownFactions.length) {
    objectives.push(globalThis.t("objectiveMeetNation"));
  } else if (knownFactions.every((faction) => !faction.contactEstablished)) {
    objectives.push(globalThis.t("objectiveEstablishContact"));
  }

  if (hostileTiles.length) {
    objectives.push(globalThis.t("objectivePacifyFrontier", { count: hostileTiles.length }));
  }

  if (activeRaiders.length) {
    objectives.push(globalThis.t("objectiveStopRaiders", { count: activeRaiders.length }));
  }

  if (globalThis.state.world.territory < 3) {
    objectives.push(globalThis.t("objectiveGrowRealm", { target: 3 }));
  }

  if (getOwnedUnimprovedResourceTiles().length > 0) {
    objectives.push(globalThis.t("objectiveDevelopResource"));
  }

  if (connectedResourceCount === 0) {
    objectives.push(globalThis.t("noEmpireResources"));
  }

  return objectives.slice(0, 3);
}

Object.assign(globalThis, {
  toggleMapLayer,
  renderMapLayerToggles,
  getWorldCityAttentionMessage,
  renderWorldView,
  scheduleHexActionsDockPosition,
  hexTileSelectorForId,
  positionHexActionsDock,
  attachHexMapAutoFit,
  renderWorldEmpireControl,
  renderWorldQuickActions,
  renderMapLegend,
  renderWorldEventFeed,
  filterPriorityOverlayForWorldMap,
  renderWorldPriorityOverlay,
  renderWorldActionBar,
  worldIconLabel,
  iconForLogEntry,
  toneForLogEntry,
  getWorldHudShiftClass,
  renderWorldStatusBar,
  renderLegendItem,
  scoutDeployingAtTile,
  scoutStationedOnCityHex,
  getHexPrimaryMarker,
  getTerritoryTone,
  getTerritoryGroup,
  isTerritoryBorderTile,
  appendTerrainBlendLayers,
  getWaterConnectionEdges,
  oppositeHexEdge,
  getTerrainNeighborEdges,
  getTerritoryBorderEdges,
  getHexNeighborEdges,
  getScoutStatusSummary,
  getWorkerStatusSummary,
  getWorldObjectives,
});
