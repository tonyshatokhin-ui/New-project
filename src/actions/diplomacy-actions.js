function openDiplomacy(tileId) {
  const tile = globalThis.state.world.hexTiles.find((item) => item.id === tileId);
  if (!tile || tile.owner !== "rival" || !tile.discovered) return;
  globalThis.uiState.diplomacyTargetId = tileId;
  globalThis.render();
}

function closeDiplomacy() {
  globalThis.uiState.diplomacyTargetId = null;
  globalThis.render();
}

function establishContact(factionId) {
  const factionState = globalThis.state.world.factions[factionId];
  if (!factionState || factionState.contactEstablished || availableContactShips() <= 0) return;
  factionState.contactEstablished = true;
  factionState.contactShipCommitted = true;
  factionState.relation = Math.min(100, factionState.relation + 8);
  pushLog(globalThis.state, "contactMade", { faction: FACTIONS[factionId].name });
  globalThis.render();
}

function getFactionGiftCost() {
  return Math.max(12, 20 - (globalThis.state.globalBonuses?.giftDiscount || 0));
}

function sendFactionGift(factionId) {
  const factionState = globalThis.state.world.factions[factionId];
  const cost = getFactionGiftCost();
  if (!factionState?.contactEstablished || globalThis.state.player.gold < cost) return;
  globalThis.state.player.gold -= cost;
  factionState.relation = Math.min(100, factionState.relation + 15);
  globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 4);
  globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 2);
  pushLog(globalThis.state, "giftSentFaction", { faction: FACTIONS[factionId].name });
  globalThis.render();
}

function openFactionTrade(factionId) {
  const factionState = globalThis.state.world.factions[factionId];
  if (!factionState?.contactEstablished || factionState.relation < 50 || factionState.tradePact) return;
  factionState.tradePact = true;
  globalThis.state.world.tradePower += 5;
  pushLog(globalThis.state, "tradeOpenedFaction", { faction: FACTIONS[factionId].name });
  globalThis.render();
}

function canExportResourceToFaction(factionId, resourceId) {
  const factionState = globalThis.state.world.factions[factionId];
  if (!factionState?.tradePact) return false;
  if (getResourceSurplus(resourceId) <= 0) return false;
  return !globalThis.state.world.resourceDeals.some((deal) => deal.factionId === factionId && deal.resourceId === resourceId);
}

function startResourceExport(factionId, resourceId) {
  if (!canExportResourceToFaction(factionId, resourceId)) return;
  const def = RESOURCE_DEFS[resourceId];
  globalThis.state.world.resourceDeals.push({
    id: `${factionId}-${resourceId}-${Date.now()}`,
    factionId,
    resourceId,
    gold: def.exportGold,
    diplomacy: def.exportDiplomacy,
  });
  pushLog(globalThis.state, "exportOpenedLog", { faction: FACTIONS[factionId].name, resource: getResourceDisplayName(resourceId) });
  globalThis.render();
}

function offerAlliance(factionId) {
  const factionState = globalThis.state.world.factions[factionId];
  if (!factionState?.contactEstablished || factionState.relation < 80 || factionState.allied) return;
  factionState.allied = true;
  globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 8);
  globalThis.state.world.diplomacy = Math.min(100, globalThis.state.world.diplomacy + 8);
  pushLog(globalThis.state, "allianceOpenedFaction", { faction: FACTIONS[factionId].name });
  globalThis.render();
}

function conquerRegion(tileId) {
  const tile = globalThis.state.world.hexTiles.find((item) => item.id === tileId);
  if (!tile || tile.owner === "player" || totalSoldiers() < 4) return;
  const factionId = tile.factionId;
  tile.owner = "player";
  tile.discovered = true;
  globalThis.state.world.territory += 1;
  globalThis.state.world.prestige = Math.min(100, globalThis.state.world.prestige + 4);
  globalThis.state.world.warPressure = Math.min(100, globalThis.state.world.warPressure + 6);
  spendSoldiers(4);
  if (globalThis.state.world.factions[factionId]) {
    globalThis.state.world.factions[factionId].relation = Math.max(0, globalThis.state.world.factions[factionId].relation - 25);
    globalThis.state.world.factions[factionId].allied = false;
  }
  pushLog(globalThis.state, "conqueredRegion", { region: getHexRegionName(tile), faction: FACTIONS[factionId]?.name || globalThis.t("rival") });
  globalThis.uiState.diplomacyTargetId = null;
  globalThis.render();
}

Object.assign(globalThis, {
  openDiplomacy,
  closeDiplomacy,
  establishContact,
  getFactionGiftCost,
  sendFactionGift,
  openFactionTrade,
  canExportResourceToFaction,
  startResourceExport,
  offerAlliance,
  conquerRegion,
});
