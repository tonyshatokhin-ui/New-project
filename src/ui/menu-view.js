import { getLocale } from "../i18n/i18n.js";

function renderMainMenu() {
  const shell = el("div", { className: "menu-screen" });
  const panel = el("main", { className: "menu-panel" });

  appendChildren(
    panel,
    el("div", { className: "menu-kicker" }, globalThis.t("menuKicker")),
    el("h1", {}, globalThis.t("gameTitle")),
    el("p", { className: "menu-subtitle" }, globalThis.t("menuSubtitle")),
  );

  if (globalThis.uiState.screen === "intro") {
    panel.appendChild(renderIntroStory());
  } else {
    panel.appendChild(renderMenuActions());
    panel.appendChild(renderMenuSettings());
  }

  if (globalThis.uiState.advisorTips && globalThis.uiState.screen === "menu") {
    panel.appendChild(el("p", { className: "menu-advisor" }, globalThis.t("menuAdvisorTip")));
  }

  shell.appendChild(panel);
  return shell;
}

function renderMenuActions() {
  const actions = el("div", { className: "menu-actions" });
  appendChildren(
    actions,
    button(globalThis.t("startGame"), startGameFromMenu),
    button(globalThis.t("resetRun"), resetGameFromMenu),
  );
  return actions;
}

function renderIntroStory() {
  const story = el("section", { className: "story-panel" });
  appendChildren(
    story,
    el("h2", {}, globalThis.t("introTitle")),
    ...globalThis.t("introParagraphs").map((paragraph) => el("p", {}, paragraph)),
    el("div", { className: "menu-actions" },
      button(globalThis.t("enterAurelia"), finishIntro),
      button(globalThis.t("backToMenu"), openMainMenu),
    ),
  );
  return story;
}

function renderMenuSettings() {
  const settings = el("section", { className: "menu-settings" });
  appendChildren(
    settings,
    el("h2", {}, globalThis.t("settingsTitle")),
    renderLanguagePicker(),
    renderSettingToggle("musicOn", globalThis.uiState.musicOn ? globalThis.t("musicOn") : globalThis.t("musicOff"), toggleMusic),
    renderSettingToggle("advisorTips", globalThis.t("advisorTips"), () => toggleSetting("advisorTips")),
    renderSettingToggle("compactUi", globalThis.t("compactUi"), () => toggleSetting("compactUi")),
    renderSettingToggle("reduceMotion", globalThis.t("reduceMotion"), () => toggleSetting("reduceMotion")),
  );
  return settings;
}

function renderLanguagePicker() {
  const row = el("div", { className: "settings-row" });
  appendChildren(
    row,
    el("span", {}, globalThis.t("languageTitle")),
    el("div", { className: "segmented" },
      button(globalThis.t("languageEn"), () => globalThis.setLocale("en"), getLocale() === "en"),
      button(globalThis.t("languageRu"), () => globalThis.setLocale("ru"), getLocale() === "ru"),
    ),
  );
  return row;
}

function renderSettingToggle(settingKey, labelText, onToggle) {
  const input = el("input", {
    type: "checkbox",
    checked: Boolean(globalThis.uiState[settingKey]),
    id: `setting-${settingKey}`,
  });
  input.addEventListener("change", () => {
    globalThis.tryStartMusic();
    globalThis.playButtonClickSound();
    onToggle();
  });

  return el("label", { className: "settings-row toggle-row", htmlFor: input.id },
    el("span", {}, labelText),
    input,
  );
}

function startGameFromMenu() {
  if (!globalThis.uiState.introSeen) {
    globalThis.uiState.screen = "intro";
  } else {
    globalThis.uiState.screen = "game";
  }
  globalThis.render();
}

function finishIntro() {
  globalThis.uiState.introSeen = true;
  localStorage.setItem(globalThis.INTRO_STORAGE_KEY, "true");
  globalThis.uiState.screen = "game";
  globalThis.render();
}

function openMainMenu() {
  globalThis.uiState.screen = "menu";
  globalThis.uiState.turnEndModalOpen = false;
  globalThis.render();
}

function resetGameFromMenu() {
  resetGame();
  globalThis.uiState.screen = "menu";
}

function toggleSetting(settingKey) {
  globalThis.uiState[settingKey] = !globalThis.uiState[settingKey];
  persistSettings();
  globalThis.render();
}

function persistSettings() {
  localStorage.setItem(globalThis.SETTINGS_STORAGE_KEY, JSON.stringify({
    musicOn: globalThis.uiState.musicOn,
    advisorTips: globalThis.uiState.advisorTips,
    compactUi: globalThis.uiState.compactUi,
    reduceMotion: globalThis.uiState.reduceMotion,
    cityRenderMode: globalThis.uiState.cityRenderMode,
    mapLayers: globalThis.uiState.mapLayers,
    turnEndGuard: globalThis.uiState.turnEndGuard,
  }));
}

Object.assign(globalThis, {
  renderMainMenu,
  renderMenuActions,
  renderIntroStory,
  renderMenuSettings,
  renderLanguagePicker,
  renderSettingToggle,
  startGameFromMenu,
  finishIntro,
  openMainMenu,
  resetGameFromMenu,
  toggleSetting,
  persistSettings,
});
