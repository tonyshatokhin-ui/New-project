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

test("city economy core formulas remain stable", () => {
  const context = vm.createContext({
    Math,
    Object,
    Array,
  });

  loadScript("src/systems/city-economy.js", context);

  assert.equal(context.getGrowthNeed({ population: 1, modifiers: { growthDiscount: 0 } }), 19);
  assert.equal(context.getGrowthNeed({ population: 1, modifiers: { growthDiscount: 20 } }), 12);

  assert.equal(context.getArmyFoodUpkeep(0), 0);
  assert.equal(context.getArmyFoodUpkeep(2), 4);
  assert.equal(context.getArmyFoodUpkeep(4), 12);

  assert.equal(context.getArmyGoldUpkeep(0), 0);
  assert.equal(context.getArmyGoldUpkeep(1), 0);
  assert.equal(context.getArmyGoldUpkeep(2), 1);
  assert.equal(context.getArmyGoldUpkeep(4), 4);

  assert.equal(context.getSoldierRecruitFoodCost(1), 6);
  assert.equal(context.getSoldierRecruitFoodCost(4), 12);
  assert.equal(context.getSoldierRecruitGoldCost(1), 5);
  assert.equal(context.getSoldierRecruitGoldCost(4), 9);
});

test("growth delta accounts for directive and full stock bonus", () => {
  const context = vm.createContext({
    Math,
    Object,
    Array,
  });

  loadScript("src/systems/city-economy.js", context);

  assert.equal(context.getGrowthDelta(0, null), 0);
  assert.equal(context.getGrowthDelta(3, { directive: "default", foodStock: 1, foodCap: 10 }), 2);
  assert.equal(context.getGrowthDelta(6, { directive: "growth", foodStock: 12, foodCap: 12 }), 8);
});

test("turn helpers keep upkeep and debt penalty behavior", () => {
  const context = vm.createContext({
    Math,
    Object,
    Array,
    state: {
      player: { gold: -45 },
    },
  });

  loadScript("src/systems/turn.js", context);

  assert.equal(context.buildingUpkeepForId("storehouse"), 1);
  assert.equal(context.buildingUpkeepForId("workshop"), 5);
  assert.equal(context.buildingUpkeepForId("unknown-building"), 0);
  assert.equal(context.getDebtFoodPenalty(), 2);
});
