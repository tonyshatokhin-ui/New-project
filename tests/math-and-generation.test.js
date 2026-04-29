const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(relativePath, context) {
  const absolutePath = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

function createBaseContext() {
  return vm.createContext({
    Math,
    Object,
    Array,
    totalGoldCap: () => 150,
  });
}

test("math helpers clamp and sign values", () => {
  const context = createBaseContext();
  loadScript("src/utils/math.js", context);

  assert.equal(context.clamp(7, 1, 4), 4);
  assert.equal(context.clamp(-2, 1, 4), 1);
  assert.equal(context.clampGoldBalance(900), 150);
  assert.equal(context.signed(5), "+5");
  assert.equal(context.signed(-3), "-3");
});

test("mulberry32 is deterministic for the same seed", () => {
  const context = createBaseContext();
  loadScript("src/utils/math.js", context);

  const rngA = context.mulberry32(1337);
  const rngB = context.mulberry32(1337);
  const seqA = [rngA(), rngA(), rngA()];
  const seqB = [rngB(), rngB(), rngB()];

  assert.deepEqual(seqA, seqB);
});

test("generateHexWorld is deterministic and returns expected dimensions", () => {
  const context = vm.createContext({
    Math,
    Object,
    Array,
    WORLD_CONFIG: {
      width: 11,
      height: 8,
      revealRadius: 2,
      startingTerritoryRadius: 1,
      frontierRevealPerTurn: 1,
      playerStart: { q: 5, r: 4 },
    },
    FACTIONS: {
      riverClans: { capitalNameKey: "cityMoonDelta" },
      groveKeepers: { capitalNameKey: "cityOliveGrove" },
      seaKingdom: { capitalNameKey: "cityShellBay" },
    },
  });

  loadScript("src/utils/math.js", context);
  loadScript("src/world/generation.js", context);

  const worldA = context.generateHexWorld(2026);
  const worldB = context.generateHexWorld(2026);

  assert.equal(worldA.mapWidth, 11);
  assert.equal(worldA.mapHeight, 8);
  assert.equal(worldA.hexTiles.length, 88);
  assert.equal(worldA.startTileId, "h-5-4");
  assert.deepEqual(worldA, worldB);
});
