function capitalizeTerrain(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function iconForTerrainOrOwner(owner) {
  if (owner === "player") return "capital";
  if (owner === "rival") return "rival";
  return "terrain-plain";
}

function inspectorHead(titleText) {
  const head = el("div", { className: "hex-inspector-head" });
  appendChildren(head,
    el("span", { className: "hex-inspector-head-badge", "aria-hidden": "true" }, iconNode("explore")),
    el("h3", {}, titleText));
  return head;
}

function inspectorChip(iconName, label) {
  const chip = el("span", { className: "hex-inspector-chip" });
  appendChildren(chip,
    el("span", { className: "hex-inspector-chip-icon", "aria-hidden": "true" }, iconNode(iconName)),
    el("span", { className: "hex-inspector-chip-text" }, label));
  return chip;
}

/** One row with left icon column + body — better scan than plain paragraphs. */
function inspectorRow(iconName, ...bodyParts) {
  const row = el("div", { className: "hex-inspector-row" });
  row.appendChild(el("span", { className: "hex-inspector-row-icon", "aria-hidden": "true" }, iconNode(iconName)));
  const body = el("div", { className: "hex-inspector-row-body" });
  bodyParts.forEach((part) => {
    if (!part) return;
    if (typeof part === "string") body.appendChild(el("span", {}, part));
    else body.appendChild(part);
  });
  row.appendChild(body);
  return row;
}

function inspectorProseRow(iconName, text) {
  const p = el("p", { className: "hex-inspector-prose" }, text);
  return inspectorRow(iconName, p);
}

function inspectorSectionDivider() {
  return el("div", { className: "hex-inspector-divider", role: "presentation" });
}

/** All interactive hex actions (shown beside the selected tile on the world map). */
function buildHexInspectorActionsEl(tile) {
  if (!tile) return null;
  const actions = el("div", { className: "policy-list hex-inspector-actions" });

  if (!tile.discovered) {
    const canExplore = canScoutExploreTile(tile);
    const scoutRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(scoutRow,
      el("strong", {}, globalThis.t("scoutTitle")),
      el("div", { className: "label" }, canExplore ? globalThis.t("scoutActionHint") : globalThis.t("scoutUnavailable")),
      button(globalThis.t("scoutAction"), () => sendScoutToTile(tile.id), !canExplore),
    );
    actions.appendChild(scoutRow);
    return actions;
  }

  const worker = workerAtTile(tile.id);
  const raider = hostileRaiderAtTile(tile.id);
  const armyField = typeof fieldArmyAtTile === "function" ? fieldArmyAtTile(tile.id) : null;
  const settleField = typeof settlerUnitAtTile === "function" ? settlerUnitAtTile(tile.id) : null;
  const selectedWorker = getSelectedWorker();

  if (tile.owner === "rival" && tile.discovered && tile.factionId && tile.factionId !== "player") {
    const diploRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(diploRow,
      el("strong", {}, globalThis.t("diplomacyActionTitle")),
      el("div", { className: "label" }, globalThis.t("diplomacyActionHint")),
      button(globalThis.t("interact"), () => openDiplomacy(tile.id), false),
    );
    actions.appendChild(diploRow);
  }

  const canMoveScoutHere = canMoveScoutToTile(tile);
  if (canMoveScoutHere) {
    const moveRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(moveRow,
      el("strong", {}, globalThis.t("scoutMoveAction")),
      el("div", { className: "label" }, globalThis.t("scoutMoveHint")),
      button(globalThis.t("scoutMoveAction"), () => moveScoutToTile(tile.id), false),
    );
    actions.appendChild(moveRow);
  }

  if (worker) {
    const selectRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(selectRow,
      el("strong", {}, globalThis.t("workerSelect")),
      el("div", { className: "label" }, getWorkerStatusText(worker)),
      button(globalThis.t("workerSelect"), () => selectArmy(worker.id), globalThis.uiState.selectedArmyId === worker.id),
    );
    actions.appendChild(selectRow);
  }

  const selField = typeof getSelectedFieldUnit === "function" ? getSelectedFieldUnit() : null;
  if (selField && typeof canMoveFieldUnitToTile === "function" && canMoveFieldUnitToTile(tile)) {
    const moveFieldRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(moveFieldRow,
      el("strong", {}, globalThis.t("fieldUnitMoveAction")),
      el("div", { className: "label" }, globalThis.t("fieldUnitMoveHint")),
      button(globalThis.t("fieldUnitMoveAction"), () => moveArmyToTile(selField.id, tile.id), false),
    );
    actions.appendChild(moveFieldRow);
  }

  if (
    settleField
    && typeof canFoundCity === "function"
    && typeof foundCity === "function"
    && settleField.tileId === tile.id
    && settleField.status === "idle"
  ) {
    const fcRow = el("div", { className: "policy-row hex-inspector-action-row" });
    const fcParams = typeof getFoundCityHintParams === "function" ? getFoundCityHintParams(tile) : {};
    const fcLabel = canFoundCity(tile)
      ? globalThis.t("foundCityHint", fcParams)
      : (typeof getFoundCityBlockHint === "function" ? getFoundCityBlockHint(tile) : globalThis.t("foundCityUnavailable"));
    appendChildren(fcRow,
      el("strong", {}, globalThis.t("foundCityAction")),
      el("div", { className: "label" }, fcLabel),
      button(globalThis.t("foundCityAction"), () => foundCity(tile.id), !canFoundCity(tile)),
    );
    actions.appendChild(fcRow);
  }

  if (selectedWorker && canMoveSelectedWorkerToTile(tile)) {
    const moveWorkerRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(moveWorkerRow,
      el("strong", {}, globalThis.t("workerActionMove")),
      el("div", { className: "label" }, globalThis.t("workerActionMoveHint")),
      button(globalThis.t("workerActionMove"), () => moveWorkerToTile(tile.id), false),
    );
    actions.appendChild(moveWorkerRow);
  }

  if (selectedWorker && canBuildEnclosureOnTile(tile)) {
    const enclosureRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(enclosureRow,
      el("strong", {}, globalThis.t("workerActionEnclose")),
      el("div", { className: "label" }, globalThis.t("workerActionEncloseHint", { turns: WORKER_CONFIG.enclosureTurns })),
      button(globalThis.t("workerActionEnclose"), () => startEnclosure(tile.id), false),
    );
    actions.appendChild(enclosureRow);
  }

  if (selectedWorker && tile.owner === "player" && tile.discovered && tile.resource && !tile.resourceImproved && selectedWorker.tileId === tile.id) {
    const extractRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(extractRow,
      el("strong", {}, globalThis.t("workerActionExtract")),
      el("div", { className: "label" }, canExtractResource(tile.resource)
        ? globalThis.t("workerActionExtractHint", { turns: WORKER_CONFIG.extractionTurns })
        : globalThis.t("workerNeedsResource")),
      button(globalThis.t("workerActionExtract"), () => startResourceExtraction(tile.id), !canExtractTile(tile)),
    );
    actions.appendChild(extractRow);
  }

  if (tile.hostile) {
    const raidOdds = punitiveRaidChance(tile);
    const campBonus = typeof punitiveRaidBonusFromAdjacentArmies === "function"
      ? punitiveRaidBonusFromAdjacentArmies(tile)
      : 0;
    const raidRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(raidRow,
      el("strong", {}, globalThis.t("punitiveRaidAction")),
      el("div", { className: "label" }, globalThis.t("punitiveRaidHint", { odds: raidOdds, campBonus })),
      button(globalThis.t("punitiveRaidAction"), () => launchPunitiveRaid(tile.id), !canLaunchPunitiveRaid(tile)),
    );
    actions.appendChild(raidRow);

    const tributeCost = typeof getTributeCalmCost === "function" ? getTributeCalmCost(tile) : 0;
    const tributeRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(tributeRow,
      el("strong", {}, globalThis.t("tributeCalmAction")),
      el("div", { className: "label" }, globalThis.t("tributeCalmHint", { gold: tributeCost })),
      button(globalThis.t("tributeCalmAction"), () => tributeCalmHostileTile(tile.id), !canTributeCalmHostileTile(tile)),
    );
    actions.appendChild(tributeRow);

    const pacifyCost = getPacifyCost(tile);
    const pacifyRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(pacifyRow,
      el("strong", {}, globalThis.t("pacifyTribeAction")),
      el("div", { className: "label" }, globalThis.t("pacifyTribeHint", { gold: pacifyCost })),
      button(globalThis.t("pacifyTribeAction"), () => pacifyHostileTile(tile.id), !canPacifyHostileTile(tile)),
    );
    actions.appendChild(pacifyRow);
  }

  if (raider) {
    const interceptRow = el("div", { className: "policy-row hex-inspector-action-row" });
    appendChildren(interceptRow,
      el("strong", {}, globalThis.t("interceptRaiderAction")),
      el("div", { className: "label" }, globalThis.t("interceptRaiderHint", { odds: raiderInterceptChance(raider) })),
      button(globalThis.t("interceptRaiderAction"), () => interceptRaider(tile.id), !canInterceptRaider(raider)),
    );
    actions.appendChild(interceptRow);
  }

  return actions.childNodes.length ? actions : null;
}

function hexActionsDockWrap(actionsInner) {
  if (!actionsInner) return null;
  const dock = el("div", {
    className: "hex-actions-dock",
    id: "hex-actions-dock",
    "aria-label": globalThis.t("hexActionsDockAria"),
  });
  dock.appendChild(actionsInner);
  return dock;
}

/**
 * @returns {{ inspector: HTMLElement, actionDock: HTMLElement | null }}
 */
function renderHexInspector() {
  const tile = getSelectedHex();
  const inspector = el("div", {
    className: `panel soft hex-inspector hex-inspector-card${tile ? " hex-inspector--linked" : ""}`.trim(),
  });

  if (!tile) {
    inspector.appendChild(inspectorHead(globalThis.t("selectedHexTitle")));
    const empty = el("div", { className: "hex-inspector-empty" });
    appendChildren(empty,
      el("span", { className: "hex-inspector-empty-icon", "aria-hidden": "true" }, iconNode("explore")),
      el("div", { className: "empty-note hex-inspector-empty-note" }, globalThis.t("selectedHexHint")));
    inspector.appendChild(empty);
    return { inspector, actionDock: null };
  }

  if (!tile.discovered) {
    inspector.appendChild(inspectorHead(globalThis.t("selectedHexTitle")));
    const chips = el("div", { className: "hex-inspector-chips" });
    chips.appendChild(inspectorChip("terrain-plain", capitalizeTerrain(tile.terrain)));
    inspector.appendChild(chips);
    inspector.appendChild(inspectorRow("move",
      el("span", { className: "hex-inspector-mono-label" }, tile.id)));
    inspector.appendChild(inspectorRow("terrain-plain", el("span", {}, globalThis.t("hexOwnerLine", { owner: globalThis.t("ownerNeutral"), status: globalThis.t("unknownStatus") }))));
    inspector.appendChild(inspectorProseRow("explore", globalThis.t("hiddenHexLabel", { tileId: tile.id })));

    const actionsEl = buildHexInspectorActionsEl(tile);
    return { inspector, actionDock: hexActionsDockWrap(actionsEl) };
  }

  const scout = getPrimaryScout();
  const city = cityAtTile(tile.id);
  const worker = workerAtTile(tile.id);
  const raider = hostileRaiderAtTile(tile.id);
  const armyField = typeof fieldArmyAtTile === "function" ? fieldArmyAtTile(tile.id) : null;
  const settleField = typeof settlerUnitAtTile === "function" ? settlerUnitAtTile(tile.id) : null;

  inspector.appendChild(inspectorHead(globalThis.t("selectedHexTitle")));

  const chips = el("div", { className: "hex-inspector-chips" });
  chips.appendChild(inspectorChip(`terrain-${tile.terrain}`, capitalizeTerrain(tile.terrain)));
  if (tile.resource) chips.appendChild(inspectorChip(`resource-${tile.resource}`, getResourceDisplayName(tile.resource)));
  inspector.appendChild(chips);

  inspector.appendChild(inspectorRow(
    "move",
    el(
      "span",
      { className: "hex-inspector-inline-meta" },
      el("span", { className: "hex-inspector-mono-label" }, tile.id),
      ` · ${capitalizeTerrain(tile.terrain)}${tile.resource ? ` · ${tile.resource}` : ""}`,
    ),
  ));

  inspector.appendChild(inspectorRow(
    iconForTerrainOrOwner(tile.owner),
    globalThis.t("hexOwnerLine", {
      owner: tile.owner,
      status: tile.discovered ? globalThis.t("discoveredStatus") : globalThis.t("unknownStatus"),
    }),
  ));

  if (tile.resource) {
    if (tile.resourceImproved) {
      inspector.appendChild(inspectorRow(
        `resource-${tile.resource}`,
        el("strong", { className: "hex-inspector-resource-flag" }, `✓ ${globalThis.t("resourceConnected")}`),
      ));
    }
    inspector.appendChild(inspectorProseRow(`resource-${tile.resource}`, getResourceEffectText(tile.resource)));
    if (getResourceUnlockedBuildingsText(tile.resource)) {
      inspector.appendChild(inspectorProseRow("city", getResourceUnlockedBuildingsText(tile.resource)));
    }
    if (getResourceUnlockedTechsText(tile.resource)) {
      inspector.appendChild(inspectorProseRow("explore", getResourceUnlockedTechsText(tile.resource)));
    }
    if (getResourceSynergyText(tile.resource)) {
      const syn = inspectorProseRow("capital", globalThis.t("resourceChainBonus", { value: getResourceSynergyText(tile.resource) }));
      syn.classList.add("hex-inspector-synergy");
      inspector.appendChild(syn);
    }
    inspector.appendChild(inspectorSectionDivider());
  }

  if (tile.hostile) {
    inspector.appendChild(inspectorProseRow("hostile", globalThis.t("hostileTileStatus", { strength: tile.hostileStrength || 1 })));
    inspector.appendChild(inspectorProseRow("hostile", globalThis.t("hostileStageStatus", { stage: tile.hostileStage || 1 })));
    if (typeof fieldArmiesAdjacentToTile === "function" && fieldArmiesAdjacentToTile(tile.id) > 0) {
      inspector.appendChild(inspectorProseRow("army", globalThis.t("hostileSuppressedByArmies")));
    }
  }
  if (tile.wildBeast) {
    inspector.appendChild(inspectorProseRow("beast", globalThis.t("wildBeastTileStatus", { strength: tile.wildBeastStrength || 1 })));
    inspector.appendChild(inspectorProseRow("scout", globalThis.t("wildBeastTileHint")));
  }
  if (raider) {
    inspector.appendChild(inspectorProseRow("raider", globalThis.t("raiderTileStatus", {
      strength: raider.strength,
      city: getCityNameByKey(raider.targetCityKey),
    })));
  }
  if (city) {
    inspector.appendChild(inspectorProseRow(city.isCapital ? "capital" : "city",
      globalThis.t("hexCityLine", { city: getCityName(city), soldiers: city.soldiers, cap: city.soldierCap }),
    ));
  }
  if (worker) {
    inspector.appendChild(inspectorProseRow("worker", getWorkerStatusText(worker)));
  }
  if (armyField && armyField.type === "army") {
    inspector.appendChild(inspectorProseRow("army", globalThis.t("inspectorArmyLine", { strength: armyField.soldiers })));
  }
  if (settleField && settleField.type === "settler") {
    inspector.appendChild(inspectorProseRow("settler", globalThis.t("inspectorSettlerLine")));
  }
  if (scout) {
    inspector.appendChild(inspectorProseRow("scout", getScoutStatusText(scout)));
  }

  const actionsEl = buildHexInspectorActionsEl(tile);
  return { inspector, actionDock: hexActionsDockWrap(actionsEl) };
}

Object.assign(globalThis, {
  capitalizeTerrain,
  iconForTerrainOrOwner,
  inspectorHead,
  inspectorChip,
  inspectorRow,
  inspectorProseRow,
  inspectorSectionDivider,
  buildHexInspectorActionsEl,
  hexActionsDockWrap,
  renderHexInspector,
});
