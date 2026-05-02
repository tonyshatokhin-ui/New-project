function getFactionHomeAnchors(width, height) {
  return {
    player: { q: WORLD_CONFIG.playerStart.q, r: WORLD_CONFIG.playerStart.r },
    riverClans: { q: 1, r: height - 2 },
    groveKeepers: { q: width - 3, r: 1 },
    seaKingdom: { q: width - 2, r: height - 2 },
  };
}

function generateHexWorld(seed) {
  const { width, height } = WORLD_CONFIG;
  const anchors = getFactionHomeAnchors(width, height);
  const hexTiles = [];

  for (let r = 0; r < height; r += 1) {
    for (let q = 0; q < width; q += 1) {
      const tile = buildGeneratedHex(seed, q, r, width, height, anchors);
      hexTiles.push(tile);
    }
  }

  applyCapitalSites(hexTiles, anchors);
  const startTileId = `h-${anchors.player.q}-${anchors.player.r}`;
  seedPlayerFrontierResources(hexTiles, startTileId, seed);
  return {
    mapWidth: width,
    mapHeight: height,
    startTileId,
    hexTiles,
  };
}

function offsetToCube(q, r) {
  const x = q;
  const z = r - ((q - (q & 1)) / 2);
  const y = -x - z;
  return { x, y, z };
}

function cubeToOffset(x, z) {
  return {
    q: x,
    r: z + ((x - (x & 1)) / 2),
  };
}

function hexDistance(q1, r1, q2, r2) {
  const left = offsetToCube(q1, r1);
  const right = offsetToCube(q2, r2);
  return Math.max(
    Math.abs(left.x - right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.z - right.z),
  );
}

function getHexNeighbors(tile, hexTiles) {
  const origin = offsetToCube(tile.q, tile.r);
  const directions = [
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 0, z: -1 },
    { x: 0, y: 1, z: -1 },
    { x: -1, y: 1, z: 0 },
    { x: -1, y: 0, z: 1 },
    { x: 0, y: -1, z: 1 },
  ];

  return directions
    .map((direction) => cubeToOffset(origin.x + direction.x, origin.z + direction.z))
    .map(({ q, r }) => hexTiles.find((entry) => entry.q === q && entry.r === r))
    .filter(Boolean);
}

function buildGeneratedHex(seed, q, r, width, height, anchors) {
  const id = `h-${q}-${r}`;
  const seaBand = q >= width - 1 || (q >= width - 2 && coordNoise(seed, q, r, 5) > 0.18);
  const coastBand = !seaBand && (q === width - 2 || (q === width - 3 && coordNoise(seed, q, r, 7) > 0.7));
  const riverQ = getRiverColumn(r, width);
  const elevation = coordNoise(seed, q, r, 11);
  const moisture = coordNoise(seed, q, r, 13);

  let terrain = "plain";
  if (seaBand) terrain = "sea";
  else if (coastBand) terrain = "coast";
  else if (q === riverQ || (Math.abs(q - riverQ) === 1 && moisture > 0.82)) terrain = "river";
  else if (elevation > 0.82) terrain = "mountain";
  else if (elevation > 0.66) terrain = "hill";
  else if (moisture > 0.64) terrain = "forest";

  const factionId = getNearestFactionId(q, r, anchors);
  const owner = getGeneratedOwner(q, r, terrain, anchors, factionId);
  const resource = assignResource(seed, q, r, terrain, owner);

  return {
    id,
    q,
    r,
    /** Terrain height factor 0–1 (pseudo-elevation visual on hex map). */
    elevation,
    terrain,
    owner,
    factionId,
    resource,
    resourceImproved: false,
    enclosed: false,
    cityName: null,
    hostile: false,
    hostileStrength: 0,
    hostileStage: 0,
    hostileAge: 0,
    hostileCooldown: 0,
    discovered: false,
  };
}

function getRiverColumn(r, width) {
  const middle = Math.floor(width / 2);
  const offsets = [-1, 0, 0, 1, 0, -1, 0];
  return clamp(middle + offsets[r % offsets.length], 1, width - 3);
}

function getNearestFactionId(q, r, anchors) {
  const factionIds = ["riverClans", "groveKeepers", "seaKingdom"];
  return factionIds.sort((left, right) => {
    const leftAnchor = anchors[left];
    const rightAnchor = anchors[right];
    return hexDistance(q, r, leftAnchor.q, leftAnchor.r) - hexDistance(q, r, rightAnchor.q, rightAnchor.r);
  })[0];
}

function getGeneratedOwner(q, r, terrain, anchors, factionId) {
  if (q === anchors.player.q && r === anchors.player.r) return "player";
  if (terrain === "sea") return factionId === "seaKingdom" && q >= WORLD_CONFIG.width - 2 ? "rival" : "neutral";
  const anchor = anchors[factionId];
  const distance = hexDistance(q, r, anchor.q, anchor.r);
  return distance <= 1 ? "rival" : "neutral";
}

function applyCapitalSites(hexTiles, anchors) {
  const capitalNames = {
    player: "cityAurelia",
    riverClans: FACTIONS.riverClans.capitalNameKey,
    groveKeepers: FACTIONS.groveKeepers.capitalNameKey,
    seaKingdom: FACTIONS.seaKingdom.capitalNameKey,
  };

  Object.entries(anchors).forEach(([factionId, anchor]) => {
    const tile = hexTiles.find((entry) => entry.q === anchor.q && entry.r === anchor.r);
    if (!tile) return;
    tile.cityName = capitalNames[factionId];
    tile.owner = factionId === "player" ? "player" : "rival";
    tile.factionId = factionId;
    if (factionId === "player") {
      tile.terrain = "river";
      tile.resource = "grain";
      tile.enclosed = true;
    } else if (factionId === "seaKingdom") {
      tile.terrain = "coast";
      tile.resource = "harbor";
    }
  });
}

function claimStartingTerritory(hexTiles, startTileId, radius) {
  const startTile = hexTiles.find((tile) => tile.id === startTileId);
  if (!startTile) return;
  hexTiles.forEach((tile) => {
    if (hexDistance(tile.q, tile.r, startTile.q, startTile.r) > radius) return;
    if (tile.owner === "rival" || tile.terrain === "sea") return;
    tile.owner = "player";
    tile.factionId = "player";
  });
}

function seedPlayerFrontierResources(hexTiles, startTileId, seed) {
  const startTile = hexTiles.find((tile) => tile.id === startTileId);
  if (!startTile) return;
  const frontierTiles = hexTiles.filter((tile) => (
    tile.id !== startTileId
    && tile.owner !== "rival"
    && tile.terrain !== "sea"
    && hexDistance(tile.q, tile.r, startTile.q, startTile.r) <= 2
  ));
  if (!frontierTiles.length) return;

  if (!frontierTiles.some((tile) => tile.resource && tile.resource !== "grain")) {
    const copperTile = frontierTiles.find((tile) => ["hill", "plain", "forest"].includes(tile.terrain))
      || frontierTiles[0];
    if (copperTile) copperTile.resource = "copper";
  }

  const supportResources = ["incense", "stone", "horses", "fish"];
  if (!frontierTiles.some((tile) => supportResources.includes(tile.resource))) {
    const roll = coordNoise(seed, 91, 17, 29);
    const supportTile = frontierTiles.find((tile) => tile.resource !== "copper") || frontierTiles[frontierTiles.length - 1];
    if (!supportTile) return;
    if (supportTile.terrain === "forest") supportTile.resource = "incense";
    else if (supportTile.terrain === "coast") supportTile.resource = "fish";
    else if (supportTile.terrain === "hill" || supportTile.terrain === "mountain") supportTile.resource = "stone";
    else supportTile.resource = roll > 0.5 ? "horses" : "incense";
  }
}

function assignResource(seed, q, r, terrain, owner) {
  const roll = coordNoise(seed, q, r, 17);
  if (owner === "player" && terrain === "river") return "grain";
  if (terrain === "mountain") return roll > 0.5 ? "iron" : "stone";
  if (terrain === "hill") return roll > 0.45 ? "copper" : null;
  if (terrain === "forest") return roll > 0.58 ? "incense" : null;
  if (terrain === "plain") {
    if (roll > 0.72) return "horses";
    if (roll > 0.4) return "grain";
    return null;
  }
  if (terrain === "coast") return roll > 0.62 ? "fish" : null;
  if (terrain === "river") return roll > 0.35 ? "grain" : null;
  return null;
}

function revealPlayerTerritory(world, cities, radius) {
  cities.forEach((city) => {
    revealRadius(world.hexTiles, city.tileId, radius);
  });
  world.hexTiles
    .filter((tile) => tile.owner === "player")
    .forEach((tile) => revealRadius(world.hexTiles, tile.id, 1));
}

function revealRadius(hexTiles, centerTileId, radius) {
  const center = hexTiles.find((tile) => tile.id === centerTileId);
  if (!center) return;
  hexTiles.forEach((tile) => {
    if (hexDistance(tile.q, tile.r, center.q, center.r) <= radius) {
      tile.discovered = true;
    }
  });
}

function advanceFrontierExploration(world, revealCount = WORLD_CONFIG.frontierRevealPerTurn) {
  const candidates = world.hexTiles
    .filter((tile) => !tile.discovered && hasDiscoveredNeighbor(world.hexTiles, tile))
    .sort((left, right) => {
      const leftDistance = hexDistance(left.q, left.r, WORLD_CONFIG.playerStart.q, WORLD_CONFIG.playerStart.r);
      const rightDistance = hexDistance(right.q, right.r, WORLD_CONFIG.playerStart.q, WORLD_CONFIG.playerStart.r);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
      return left.id.localeCompare(right.id);
    })
    .slice(0, revealCount);

  candidates.forEach((tile) => {
    tile.discovered = true;
  });
}

function refreshFactionKnowledge(world) {
  Object.entries(world.factions).forEach(([factionId, factionState]) => {
    if (factionState.contactEstablished) {
      factionState.met = true;
      return;
    }
    factionState.met = world.hexTiles.some((tile) => tile.discovered && tile.owner === "rival" && tile.factionId === factionId);
  });
}

function hasDiscoveredNeighbor(hexTiles, tile) {
  return getHexNeighbors(tile, hexTiles).some((neighbor) => neighbor.discovered);
}

Object.assign(globalThis, {
  getFactionHomeAnchors,
  generateHexWorld,
  offsetToCube,
  cubeToOffset,
  hexDistance,
  getHexNeighbors,
  buildGeneratedHex,
  getRiverColumn,
  getNearestFactionId,
  getGeneratedOwner,
  applyCapitalSites,
  claimStartingTerritory,
  seedPlayerFrontierResources,
  assignResource,
  revealPlayerTerritory,
  revealRadius,
  advanceFrontierExploration,
  refreshFactionKnowledge,
  hasDiscoveredNeighbor,
});
