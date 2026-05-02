function cityAtTile(tileId) {
  return globalThis.state.player.cities.find(city => city.tileId === tileId);
}

function totalEmpireFood() {
  return globalThis.state.player.cities.reduce((sum, city) => sum + city.foodStock, 0);
}

function openDiplomacyForFaction(factionId) {
  const factionState = globalThis.state.world.factions[factionId];
  if (!factionState?.met && !factionState?.contactEstablished) return;
  const tile = globalThis.state.world.hexTiles.find((entry) => entry.factionId === factionId && entry.owner === "rival" && entry.discovered);
  if (tile) {
    globalThis.uiState.diplomacyTargetId = tile.id;
    globalThis.render();
  }
}

function getHexRegionName(tile) {
  if (!tile) return "";
  if (tile.cityName) return globalThis.t(tile.cityName);
  const terrainLabel = tile.terrain ? tile.terrain.charAt(0).toUpperCase() + tile.terrain.slice(1) : "Wilds";
  return `${terrainLabel} ${tile.id}`;
}

function handleHexClick(tileId) {
  globalThis.tryStartMusic();
  globalThis.playTileSelectSound();
  globalThis.uiState.selectedHexId = tileId;
  const worker = workerAtTile(tileId);
  if (worker) {
    globalThis.uiState.selectedArmyId = worker.id;
    showToast(globalThis.t("workerSelectedToast", { tile: getHexRegionName(getTileById(tileId)) }), "info");
  } else if (typeof fieldUnitAtTile === "function") {
    const fieldUnit = fieldUnitAtTile(tileId);
    if (fieldUnit) {
      globalThis.uiState.selectedArmyId = fieldUnit.id;
      showToast(globalThis.t("toastFieldUnitSelected", { tile: getHexRegionName(getTileById(tileId)) }), "info");
    }
  }
  if (typeof hookOnboardingHexClick === "function") {
    hookOnboardingHexClick();
  }
  globalThis.render();
}

function handleHexDoubleClick(tileId) {
  const tile = getTileById(tileId);
  globalThis.uiState.selectedHexId = tileId;
  if (tile && canExtractTile(tile)) {
    globalThis.tryStartMusic();
    globalThis.playTileSelectSound();
    startResourceExtraction(tileId);
    return;
  }
  if (tile && canMoveSelectedWorkerToTile(tile)) {
    globalThis.tryStartMusic();
    globalThis.playTileSelectSound();
    moveWorkerToTile(tileId);
    return;
  }
  if (
    tile
    && typeof getSelectedFieldUnit === "function"
    && typeof canMoveFieldUnitToTile === "function"
    && getSelectedFieldUnit()
    && canMoveFieldUnitToTile(tile)
  ) {
    globalThis.tryStartMusic();
    globalThis.playTileSelectSound();
    moveArmyToTile(getSelectedFieldUnit().id, tileId);
    return;
  }
  if (tile && canMoveScoutToTile(tile)) {
    globalThis.tryStartMusic();
    globalThis.playTileSelectSound();
    moveScoutToTile(tileId);
    return;
  }
  if (tile && canScoutExploreTile(tile)) {
    globalThis.tryStartMusic();
    globalThis.playTileSelectSound();
    sendScoutToTile(tileId);
    return;
  }
  globalThis.render();
}

function getSelectedHex() {
  return globalThis.state.world.hexTiles.find(t => t.id === globalThis.uiState.selectedHexId);
}

/** Flat-top odd-q offset (q,r) → pixel center. Pairs with cube math in generation.js so neighbors share full edges. */
function offsetQrToHexMapPixel(q, r, radiusPx) {
  const xCenter = 1.5 * radiusPx * q;
  const yCenter = Math.sqrt(3) * radiusPx * (r + ((q & 1) ? 0.5 : 0));
  return { xCenter, yCenter };
}

/** Bounding box for full hex footprints (width = 2r, height = √3·r) — used to size the absolutely-positioned canvas. */
function accumulateHexLayoutBounds(hexTiles, radiusPx) {
  const fullW = 2 * radiusPx;
  const fullH = Math.sqrt(3) * radiusPx;
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  hexTiles.forEach(({ q, r }) => {
    const { xCenter, yCenter } = offsetQrToHexMapPixel(q, r, radiusPx);
    const left = xCenter - radiusPx;
    const top = yCenter - fullH / 2;
    minL = Math.min(minL, left);
    minT = Math.min(minT, top);
    maxR = Math.max(maxR, left + fullW);
    maxB = Math.max(maxB, top + fullH);
  });
  return { minL, minT, width: maxR - minL, height: maxB - minT };
}

Object.assign(globalThis, {
  cityAtTile,
  totalEmpireFood,
  openDiplomacyForFaction,
  getHexRegionName,
  handleHexClick,
  handleHexDoubleClick,
  getSelectedHex,
  offsetQrToHexMapPixel,
  accumulateHexLayoutBounds,
});
