const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "bronze-crown-locale";
const INTRO_STORAGE_KEY = "bronze-crown-intro-seen";
const SETTINGS_STORAGE_KEY = "bronze-crown-settings";
const RANDOM_EVENTS_ENABLED = false;

function getStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

const storedSettings = getStoredSettings();
const CITY_RENDER_MODE_OPTIONS = {
  SVG: "svg",
  THREE: "three",
};

const uiState = {
  screen: "menu",
  introSeen: localStorage.getItem(INTRO_STORAGE_KEY) === "true",
  logOpen: false,
  musicOn: storedSettings.musicOn ?? true,
  advisorTips: storedSettings.advisorTips ?? true,
  compactUi: storedSettings.compactUi ?? false,
  reduceMotion: storedSettings.reduceMotion ?? false,
  audioReady: false,
  diplomacyTargetId: null,
  selectedHexId: null,
  selectedArmyId: null,
  headerMenuOpen: false,
  hudPanelOpen: false,
  hudPanelTab: "alerts",
  hudPreset: "standard",
  cityHubTab: "workers",
  cityActionModal: null,
  cityActionLast: "workers",
  turnTransition: null,
  focusRequest: null,
  citySceneInspect: false,
  cityScenePan: { x: 0, y: 0 },
  citySceneZoom: 1,
  /** Building slot id opened from 3D map popover — inspect mode only. */
  cityInspectSlotId: null,
  /** Per-city projected % positions for map worker count chips — avoids one-frame layout jump on re-render. */
  workerChipLayoutByCity: {},
  cityRenderMode: storedSettings.cityRenderMode || CITY_RENDER_MODE_OPTIONS.THREE,
  toast: null,
};
