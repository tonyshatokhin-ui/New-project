const ONBOARD_KEY_DONE = "bronze-crown-onboarding-done-v1";

function isOnboardingComplete() {
  try {
    return localStorage.getItem(ONBOARD_KEY_DONE) === "1";
  } catch (_) {
    return true;
  }
}

function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARD_KEY_DONE, "1");
  } catch (_) {
    /* ignore */
  }
  globalThis.uiState.onboardingStep = 5;
}

/** Step 0: inspect map hex · 1: open city · 2: assign workers · 3: end turn once */
function getOnboardingStep() {
  if (!globalThis.uiState.advisorTips || isOnboardingComplete()) return 5;
  const s = globalThis.uiState.onboardingStep;
  return typeof s === "number" ? s : 0;
}

function hookOnboardingHexClick() {
  if (globalThis.uiState.screen !== "game" || isOnboardingComplete()) return;
  if (getOnboardingStep() === 0) {
    globalThis.uiState.onboardingStep = 1;
    globalThis.render();
  }
}

function hookOnboardingCityOpened() {
  if (globalThis.uiState.screen !== "game" || isOnboardingComplete()) return;
  if (getOnboardingStep() === 1) {
    globalThis.uiState.onboardingStep = 2;
    globalThis.render();
  }
}

function hookOnboardingWorkersChanged() {
  if (globalThis.uiState.screen !== "game" || isOnboardingComplete()) return;
  if (getOnboardingStep() !== 2) return;
  const ok = globalThis.state.player.cities.some((city) => assignedWorkers(city) >= city.population && city.population > 0);
  if (ok) {
    globalThis.uiState.onboardingStep = 3;
    globalThis.render();
  }
}

function hookOnboardingTurnEnded() {
  if (globalThis.uiState.screen !== "game" || isOnboardingComplete()) return;
  if (getOnboardingStep() === 3 && globalThis.state.turn >= 2) {
    completeOnboarding();
    showToast(globalThis.t("onboardingCompleteToast"), "success");
    globalThis.render();
  }
}

function dismissOnboardingBanner() {
  completeOnboarding();
  globalThis.render();
}

function renderOnboardingBanner() {
  if (!globalThis.uiState.advisorTips || isOnboardingComplete()) return null;
  const step = getOnboardingStep();
  if (step >= 4) return null;
  const keys = ["onboardingStep0", "onboardingStep1", "onboardingStep2", "onboardingStep3"];
  const text = globalThis.t(keys[step] || keys[0]);
  return el(
    "div",
    { className: "onboarding-banner", role: "region", "aria-label": globalThis.t("onboardingBannerAria") },
    el("div", { className: "onboarding-banner-text" }, text),
    button(globalThis.t("onboardingDismiss"), () => dismissOnboardingBanner(), false),
  );
}

Object.assign(globalThis, {
  isOnboardingComplete,
  completeOnboarding,
  getOnboardingStep,
  hookOnboardingHexClick,
  hookOnboardingCityOpened,
  hookOnboardingWorkersChanged,
  hookOnboardingTurnEnded,
  dismissOnboardingBanner,
  renderOnboardingBanner,
});
