function terrainGlyph(terrain) {
  const map = {
    mountain: "^",
    hill: "n",
    forest: "T",
    plain: ".",
    coast: "~",
    river: "=",
    sea: "~",
  };
  return map[terrain] || "?";
}

function resourceGlyph(resource) {
  const map = {
    iron: "Fe",
    copper: "Cu",
    incense: "In",
    grain: "Gr",
    horses: "Ho",
    stone: "St",
    fish: "Fi",
    harbor: "Ha",
  };
  return map[resource] || "";
}

Object.assign(globalThis, {
  terrainGlyph,
  resourceGlyph,
});
