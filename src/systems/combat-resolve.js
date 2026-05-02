/** Central combat math: archetypes, terrain, vs-matrix, engagements (`UNIT_ARCHETYPES`, `COMBAT_RULES` in world-data). */

function combatRulesFallback() {
  return {
    prestigeAttackBonus: 0.06,
    empireDisciplineBonus: 1.04,
    engagements: {
      beast_hunt: { base: 10, ratioScale: 34, min: 18, max: 92 },
      tribal_assault: { base: 12, ratioScale: 32, min: 20, max: 90 },
      raider_field: { base: 14, ratioScale: 30, min: 25, max: 92 },
      raider_intercept: { base: 12, ratioScale: 32, min: 25, max: 90 },
      punitive_raid: { base: 14, ratioScale: 28, min: 22, max: 94 },
      scout_vs_tribal: { base: 16, ratioScale: 38, min: 10, max: 86 },
    },
  };
}

function getCombatRules() {
  return typeof COMBAT_RULES !== "undefined" ? COMBAT_RULES : combatRulesFallback();
}

function archetypeFallback(id) {
  return {
    attack: 1,
    defense: 1,
    vs: {},
    terrain: {},
  };
}

function getArchetype(id) {
  const table = typeof UNIT_ARCHETYPES !== "undefined" ? UNIT_ARCHETYPES : {};
  return Object.assign(archetypeFallback(id), table[id] || table.line || {});
}

function resolveArchetypeFromUnit(unit) {
  if (!unit) return "line";
  if (unit.archetype) return unit.archetype;
  if (unit.type === "scout") return "scout";
  if (unit.type === "hostile-raider") return "raider";
  return "line";
}

function terrainStatMult(arch, terrain, aspect) {
  if (!terrain || !arch.terrain || !arch.terrain[terrain]) return 1;
  const row = arch.terrain[terrain];
  if (row.both) return row.both;
  const a = row[aspect];
  return typeof a === "number" ? a : 1;
}

function vsMult(arch, opponentArchetypeId) {
  if (!opponentArchetypeId || !arch.vs) return 1;
  const m = arch.vs[opponentArchetypeId];
  return typeof m === "number" ? m : 1;
}

function applyModifiers(unit, value, role) {
  let v = value;
  if (!unit?.modifiers?.length) return v;
  unit.modifiers.forEach((mod) => {
    if (!mod || typeof mod.percent !== "number") return;
    if (mod.stat !== role && mod.stat !== "all") return;
    v *= 1 + mod.percent / 100;
  });
  return v;
}

function empireDisciplineMultiplier() {
  const bonus = getCombatRules().empireDisciplineBonus || 1.04;
  if (!globalThis.state || !globalThis.state.player?.cities?.length) return 1;
  if (typeof cityHasBuilding !== "function") return 1;
  return globalThis.state.player.cities.some((c) => cityHasBuilding(c, "training-ground")) ? bonus : 1;
}

function magnitudeFromUnit(unit) {
  return Math.max(0.5, unit.soldiers || unit.strength || 1);
}

/**
 * @param {object} spec — { unit } | { virtual: { soldiers, archetype? } } | { archetypeId, magnitude }
 * @param {"attack"|"defense"} role
 */
function effectiveCombatStrength(spec, role, tile, opponentArchetypeId) {
  const terrain = tile?.terrain;

  if (spec.archetypeId && spec.magnitude != null) {
    const arch = getArchetype(spec.archetypeId);
    const stat = role === "defense" ? arch.defense : arch.attack;
    let v = spec.magnitude * stat;
    v *= terrainStatMult(arch, terrain, role);
    v *= vsMult(arch, opponentArchetypeId);
    return Math.max(0.01, v);
  }

  if (spec.virtual) {
    const aid = spec.virtual.archetype || "line";
    const arch = getArchetype(aid);
    const stat = role === "defense" ? arch.defense : arch.attack;
    let v = Math.max(1, spec.virtual.soldiers || 1) * stat;
    v *= terrainStatMult(arch, terrain, role);
    v *= vsMult(arch, opponentArchetypeId);
    if (role === "attack") {
      v *= empireDisciplineMultiplier();
      if (globalThis.state && globalThis.state.world?.prestige) {
        const pb = getCombatRules().prestigeAttackBonus || 0.06;
        v *= 1 + (globalThis.state.world.prestige / 100) * pb;
      }
    }
    return Math.max(0.01, v);
  }

  const unit = spec.unit;
  if (!unit) return 0.01;

  const aid = resolveArchetypeFromUnit(unit);
  const arch = getArchetype(aid);
  const stat = role === "defense" ? arch.defense : arch.attack;
  let v = magnitudeFromUnit(unit) * stat;
  v *= terrainStatMult(arch, terrain, role);
  v *= vsMult(arch, opponentArchetypeId);

  if (unit.type === "army" && role === "attack") {
    if (globalThis.state && globalThis.state.world?.prestige) {
      const pb = getCombatRules().prestigeAttackBonus || 0.06;
      v *= 1 + (globalThis.state.world.prestige / 100) * pb;
    }
    if (unit.homeCityKey && globalThis.state?.player?.cities && typeof cityHasBuilding === "function") {
      const home = globalThis.state.player.cities.find((c) => c.nameKey === unit.homeCityKey);
      if (home && cityHasBuilding(home, "training-ground")) {
        v *= 1.03;
      }
    }
  }

  v = applyModifiers(unit, v, role);
  return Math.max(0.01, v);
}

function opponentArchFromSpec(spec) {
  if (spec.unit) return resolveArchetypeFromUnit(spec.unit);
  if (spec.archetypeId) return spec.archetypeId;
  if (spec.virtual?.archetype) return spec.virtual.archetype;
  return "line";
}

/**
 * @param {string} engagementId — key in COMBAT_RULES.engagements
 * @param {object} attackerSpec
 * @param {object} defenderSpec
 * @param {object|null} tile — terrain context
 * @returns {number} win probability 0–100 for the attacker
 */
function computeCombatWinPercent(engagementId, attackerSpec, defenderSpec, tile) {
  const rules = getCombatRules().engagements[engagementId];
  if (!rules) return 50;
  const defArch = opponentArchFromSpec(defenderSpec);
  const atkArch = opponentArchFromSpec(attackerSpec);
  const atk = effectiveCombatStrength(attackerSpec, "attack", tile, defArch);
  const def = effectiveCombatStrength(defenderSpec, "defense", tile, atkArch);
  const ratio = atk / Math.max(0.001, def);
  const raw = rules.base + ratio * rules.ratioScale;
  return clamp(Math.round(raw), rules.min, rules.max);
}

Object.assign(globalThis, {
  combatRulesFallback,
  getCombatRules,
  archetypeFallback,
  getArchetype,
  resolveArchetypeFromUnit,
  terrainStatMult,
  vsMult,
  applyModifiers,
  empireDisciplineMultiplier,
  magnitudeFromUnit,
  effectiveCombatStrength,
  opponentArchFromSpec,
  computeCombatWinPercent,
});
