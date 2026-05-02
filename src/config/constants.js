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

function normalizeMapLayers(raw) {
  const base = { terrain: true, borders: true, resources: true, units: true };
  if (!raw || typeof raw !== "object") return { ...base };
  return { ...base, ...raw };
}
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
  /** After victory modal is acknowledged; hides overlay until next run or new victory. */
  runVictoryModalDismissed: true,
  mapLayers: normalizeMapLayers(storedSettings.mapLayers),
  /** Which nation row is expanded in the world panel (`faction.id` or null). */
  nationsExpandedId: null,
  /** `strict` | `soft` | `off` — end-turn guard (see `requestEndTurn`). */
  turnEndGuard: ["strict", "soft", "off"].includes(storedSettings.turnEndGuard)
    ? storedSettings.turnEndGuard
    : "strict",
  turnEndModalOpen: false,
  /** First-run guided steps (0–3); complete when player ends first turn or dismisses. */
  onboardingStep: 0,
  /** After nextTurn, show compact empire delta panel until dismissed. */
  turnSummaryOpen: false,
  /** Full-screen reference from Manage menu. */
  encyclopediaOpen: false,
};

Object.assign(globalThis, {
  uiState,
  CITY_RENDER_MODE_OPTIONS,
  RANDOM_EVENTS_ENABLED,
  INTRO_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STORAGE_KEY,
  DEFAULT_LOCALE,
});
