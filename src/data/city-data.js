const JOBS = [
  {
    id: "fields",
    labelKey: "jobFields",
    glyph: "F",
    descriptionKey: "jobFieldsDesc",
    baseYield: (city) => ({
      food: city.assignments.fields * city.modifiers.foodPerField,
    }),
  },
  {
    id: "mines",
    labelKey: "jobMines",
    glyph: "M",
    descriptionKey: "jobMinesDesc",
    baseYield: (city) => ({
      hammers: city.assignments.mines * city.modifiers.hammerPerMine,
    }),
  },
  {
    id: "temples",
    labelKey: "jobTemples",
    glyph: "T",
    descriptionKey: "jobTemplesDesc",
    baseYield: (city) => ({
      culture: city.assignments.temples * city.modifiers.culturePerTemple,
    }),
  },
  {
    id: "barracks",
    labelKey: "jobBarracks",
    glyph: "B",
    descriptionKey: "jobBarracksDesc",
    baseYield: (city) => ({
      soldiers: city.assignments.barracks * city.modifiers.recruitPointsPerBarracks,
    }),
  },
  {
    id: "market",
    labelKey: "jobMarket",
    glyph: "$",
    descriptionKey: "jobMarketDesc",
    baseYield: (city) => ({
      gold: city.assignments.market * city.modifiers.goldPerMarket,
    }),
  },
  {
    id: "ports",
    labelKey: "jobPorts",
    glyph: "P",
    descriptionKey: "jobPortsDesc",
    baseYield: (city) => ({
      food: city.assignments.ports * city.modifiers.foodPerPort,
      shipPoints: city.assignments.ports * city.modifiers.shipPointsPerPort,
    }),
  },
];

const CITY_DIRECTIVES = [
  {
    id: "balanced",
    labelKey: "directiveBalanced",
    descriptionKey: "directiveBalancedDesc",
    apply: () => ({}),
  },
  {
    id: "growth",
    labelKey: "directiveGrowth",
    descriptionKey: "directiveGrowthDesc",
    apply: (city) => ({
      food: city.assignments.fields > 0 ? 3 : 0,
      growthBonus: city.assignments.fields > 0 ? 1 : 0,
      hammers: city.assignments.fields > 0 ? -1 : 0,
    }),
  },
  {
    id: "war",
    labelKey: "directiveWar",
    descriptionKey: "directiveWarDesc",
    apply: (city) => ({
      soldiers: city.assignments.barracks > 0 ? 0.1 : 0,
      food: city.assignments.barracks > 0 ? -2 : 0,
      culture: city.assignments.barracks > 0 ? -1 : 0,
    }),
  },
  {
    id: "trade",
    labelKey: "directiveTrade",
    descriptionKey: "directiveTradeDesc",
    apply: (city) => ({
      gold: city.assignments.market > 0 ? 3 : 0,
      shipPoints: city.assignments.ports > 0 ? 1 : 0,
      food: city.assignments.market > 0 && city.assignments.ports > 0 ? -1 : 0,
      soldiers: city.assignments.market > 0 && city.assignments.barracks > 0 ? -0.05 : 0,
    }),
  },
  {
    id: "faith",
    labelKey: "directiveFaith",
    descriptionKey: "directiveFaithDesc",
    apply: (city) => ({
      culture: city.assignments.temples > 0 ? 3 : 0,
      templeInfluence: city.assignments.temples > 0 ? 1 : 0,
      hammers: city.assignments.temples > 0 ? -1 : 0,
      gold: city.assignments.temples > 0 ? -1 : 0,
    }),
  },
];

const CITY_SPECIALIZATIONS = [
  {
    id: "agrarian",
    labelKey: "specializationAgrarian",
    descriptionKey: "specializationAgrarianDesc",
    apply: (city) => ({
      food: city.assignments.fields > 0 ? 2 : 0,
      growthBonus: city.assignments.fields > 0 ? 1 : 0,
      culture: city.assignments.temples > 0 ? -1 : 0,
    }),
  },
  {
    id: "craft",
    labelKey: "specializationCraft",
    descriptionKey: "specializationCraftDesc",
    apply: (city) => ({
      hammers: city.assignments.mines > 0 ? 1 : 0,
      gold: city.assignments.mines > 0 ? 1 : 0,
      food: city.assignments.fields > 0 ? -1 : 0,
      culture: city.assignments.temples > 0 ? -1 : 0,
    }),
  },
  {
    id: "martial",
    labelKey: "specializationMartial",
    descriptionKey: "specializationMartialDesc",
    apply: (city) => ({
      soldiers: city.assignments.barracks > 0 ? 0.05 : 0,
      hammers: city.assignments.barracks > 0 ? 1 : 0,
      food: city.assignments.fields > 0 || city.assignments.barracks > 0 ? -1 : 0,
      culture: city.assignments.temples > 0 ? -1 : 0,
    }),
  },
  {
    id: "mercantile",
    labelKey: "specializationMercantile",
    descriptionKey: "specializationMercantileDesc",
    apply: (city) => ({
      gold: city.assignments.market > 0 ? 2 : 0,
      shipPoints: city.assignments.ports > 0 ? 1 : 0,
      food: city.assignments.fields > 0 ? -1 : 0,
      soldiers: city.assignments.barracks > 0 ? -0.05 : 0,
    }),
  },
  {
    id: "sacred",
    labelKey: "specializationSacred",
    descriptionKey: "specializationSacredDesc",
    apply: (city) => ({
      culture: city.assignments.temples > 0 ? 2 : 0,
      templeInfluence: city.assignments.temples > 0 ? 1 : 0,
      hammers: city.assignments.mines > 0 ? -1 : 0,
      gold: city.assignments.market > 0 ? -1 : 0,
    }),
  },
];

Object.assign(globalThis, { JOBS, CITY_DIRECTIVES, CITY_SPECIALIZATIONS });
