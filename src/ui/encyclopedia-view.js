/** In-game reference: data-driven entries from JOBS, BUILDINGS, techs, policies, etc. */

function closeEncyclopedia() {
  globalThis.uiState.encyclopediaOpen = false;
  globalThis.render();
}

function encCard(title, body, metaLines) {
  const block = el("article", { className: "encyclopedia-card" }, el("h4", { className: "encyclopedia-card-title" }, title));
  if (metaLines && metaLines.length) {
    const m = el("div", { className: "encyclopedia-card-meta" });
    metaLines.forEach((line) => {
      m.appendChild(el("span", { className: "encyclopedia-meta-chip" }, line));
    });
    block.appendChild(m);
  }
  block.appendChild(el("p", { className: "encyclopedia-card-body" }, body));
  return block;
}

function encSection(heading) {
  return el("h3", { className: "encyclopedia-section-title" }, heading);
}

function encyclopediaBuildingMeta(b) {
  const lines = [
    globalThis.t("encyclopediaMetaCost", { cost: b.cost }),
    globalThis.t("encyclopediaMetaBuildTurns", { n: constructionTurnsForBuilding(b) }),
  ];
  if (b.unique) lines.push(globalThis.t("encyclopediaMetaUnique"));
  if (b.requires && b.requires.length) {
    const list = b.requires.map((id) => {
      const dep = BUILDINGS.find((x) => x.id === id);
      return dep ? globalThis.t(dep.nameKey) : id;
    }).join(", ");
    lines.push(globalThis.t("encyclopediaMetaRequires", { list }));
  }
  if (b.requiresResource) {
    lines.push(globalThis.t("encyclopediaMetaResource", { name: getResourceDisplayName(b.requiresResource) }));
  }
  return lines;
}

function renderEncyclopediaDrawer() {
  const backdrop = el("div", { className: "log-drawer-backdrop encyclopedia-backdrop" });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeEncyclopedia();
  });
  const inner = el("div", { className: "log-drawer panel soft encyclopedia-drawer" });
  appendChildren(
    inner,
    el(
      "div",
      { className: "tile-header encyclopedia-header" },
      el("h2", {}, globalThis.t("encyclopediaTitle")),
      button(globalThis.t("close"), closeEncyclopedia, false),
    ),
  );

  const scroll = el("div", { className: "encyclopedia-scroll", tabIndex: 0 });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionBasics")));
  scroll.appendChild(el("p", { className: "encyclopedia-lede" }, globalThis.t("encyclopediaIntro")));

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionDistricts")));
  JOBS.forEach((job) => {
    scroll.appendChild(
      encCard(globalThis.t(job.labelKey), globalThis.t(job.descriptionKey), [globalThis.t("encyclopediaDistrictGlyph", { g: job.glyph })]),
    );
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionBuildings")));
  BUILDINGS.forEach((b) => {
    scroll.appendChild(encCard(globalThis.t(b.nameKey), globalThis.t(b.descriptionKey), encyclopediaBuildingMeta(b)));
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionTechnologies")));
  TECHNOLOGIES.forEach((tech) => {
    const meta = [
      globalThis.t("encyclopediaMetaTechTier", { tier: tech.tier }),
      globalThis.t("encyclopediaMetaTechCost", { cost: tech.cost }),
    ];
    if (tech.requiresResource) {
      meta.push(globalThis.t("encyclopediaMetaResource", { name: getResourceDisplayName(tech.requiresResource) }));
    }
    if (tech.requiresTechIds?.length) {
      meta.push(
        globalThis.t("encyclopediaMetaTechRequires", {
          list: tech.requiresTechIds.map((id) => getTechnologyNameById(id)).join(", "),
        }),
      );
    }
    scroll.appendChild(encCard(globalThis.t(tech.nameKey), globalThis.t(tech.descriptionKey), meta));
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionPolicies")));
  POLICIES.forEach((p) => {
    scroll.appendChild(
      encCard(globalThis.t(p.nameKey), globalThis.t(p.descriptionKey), [globalThis.t("encyclopediaMetaPolicyCost", { cost: p.cost })]),
    );
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionTrade")));
  TRADE_OFFERS.forEach((tr) => {
    scroll.appendChild(
      encCard(globalThis.t(tr.nameKey), globalThis.t(tr.descriptionKey), [globalThis.t("encyclopediaMetaTradeShips", { n: tr.shipCost })]),
    );
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionDirectives")));
  CITY_DIRECTIVES.forEach((d) => {
    scroll.appendChild(encCard(globalThis.t(d.labelKey), globalThis.t(d.descriptionKey), null));
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionSpecializations")));
  CITY_SPECIALIZATIONS.forEach((s) => {
    scroll.appendChild(encCard(globalThis.t(s.labelKey), globalThis.t(s.descriptionKey), null));
  });

  const unitEntries = [
    { titleKey: "encyclopediaUnitScoutTitle", bodyKey: "encyclopediaUnitScoutBody" },
    { titleKey: "encyclopediaUnitWorkerTitle", bodyKey: "encyclopediaUnitWorkerBody" },
    { titleKey: "encyclopediaUnitArmyTitle", bodyKey: "encyclopediaUnitArmyBody" },
    { titleKey: "encyclopediaUnitSettlerTitle", bodyKey: "encyclopediaUnitSettlerBody" },
    { titleKey: "encyclopediaUnitRaiderTitle", bodyKey: "encyclopediaUnitRaiderBody" },
  ];
  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionUnits")));
  unitEntries.forEach((u) => {
    scroll.appendChild(encCard(globalThis.t(u.titleKey), globalThis.t(u.bodyKey), null));
  });

  scroll.appendChild(encSection(globalThis.t("encyclopediaSectionWorld")));
  scroll.appendChild(el("p", { className: "encyclopedia-lede" }, globalThis.t("encyclopediaWorldBody")));

  inner.appendChild(scroll);
  backdrop.appendChild(inner);
  return backdrop;
}

Object.assign(globalThis, {
  closeEncyclopedia,
  encCard,
  encSection,
  encyclopediaBuildingMeta,
  renderEncyclopediaDrawer,
});
