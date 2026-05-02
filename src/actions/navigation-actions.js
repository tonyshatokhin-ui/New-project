function openCity(cityNameKey) {
  globalThis.state.selectedCity = cityNameKey;
  globalThis.state.view = "city";
  if (typeof hookOnboardingCityOpened === "function") {
    hookOnboardingCityOpened();
  }
  globalThis.render();
}

function switchView(view) {
  globalThis.state.view = view;
  globalThis.uiState.diplomacyTargetId = null;
  if (view === "city" && typeof hookOnboardingCityOpened === "function") {
    hookOnboardingCityOpened();
  }
  globalThis.render();
}

function resetGame() {
  globalThis.state = createInitialState();
  globalThis.uiState.logOpen = false;
  globalThis.uiState.diplomacyTargetId = null;
  globalThis.uiState.runVictoryModalDismissed = true;
  globalThis.uiState.selectedHexId = globalThis.state.world.startTileId;
  globalThis.uiState.toast = null;
  globalThis.uiState.turnEndModalOpen = false;
  globalThis.uiState.turnSummaryOpen = false;
  globalThis.state.turnSummary = null;
  globalThis.uiState.encyclopediaOpen = false;
  globalThis.uiState.onboardingStep = 0;
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  globalThis.render();
}

function toggleLog() {
  globalThis.uiState.logOpen = !globalThis.uiState.logOpen;
  globalThis.render();
}

function toggleMusic() {
  globalThis.uiState.musicOn = !globalThis.uiState.musicOn;
  bgMusic.muted = !globalThis.uiState.musicOn;
  defeatSound.muted = !globalThis.uiState.musicOn;
  if (globalThis.uiState.musicOn) {
    globalThis.tryStartMusic();
  } else {
    bgMusic.pause();
  }
  persistSettings();
  globalThis.render();
}

Object.assign(globalThis, {
  openCity,
  switchView,
  resetGame,
  toggleLog,
  toggleMusic,
});
