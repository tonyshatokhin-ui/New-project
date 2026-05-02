function handleGlobalKeydown(event) {
  if (event.repeat || event.defaultPrevented) return;

  if (event.code === "Escape" && globalThis.uiState.screen === "game" && globalThis.state.view === "city" && globalThis.uiState.cityActionModal) {
    event.preventDefault();
    globalThis.uiState.cityActionModal = null;
    globalThis.render();
    return;
  }

  if (event.code === "Escape" && globalThis.uiState.screen === "game" && globalThis.uiState.turnEndModalOpen) {
    event.preventDefault();
    globalThis.uiState.turnEndModalOpen = false;
    globalThis.render();
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement
    && (
      target.tagName === "INPUT"
      || target.tagName === "TEXTAREA"
      || target.tagName === "SELECT"
      || target.tagName === "BUTTON"
      || target.isContentEditable
    )
  ) {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    requestEndTurn();
    return;
  }

  if (globalThis.uiState.screen !== "game") return;
  if (event.code === "F1") {
    event.preventDefault();
    globalThis.uiState.hudPreset = "minimal";
    globalThis.render();
    return;
  }
  if (event.code === "F2") {
    event.preventDefault();
    globalThis.uiState.hudPreset = "standard";
    globalThis.render();
    return;
  }
  if (event.code === "F3") {
    event.preventDefault();
    globalThis.uiState.hudPreset = "detailed";
    globalThis.render();
    return;
  }
  if (event.code === "Tab") {
    event.preventDefault();
    globalThis.uiState.hudPanelOpen = !globalThis.uiState.hudPanelOpen;
    globalThis.render();
    return;
  }

  if (globalThis.state.view === "city") {
    const cityModalByHotkey = {
      Digit1: "workers",
      Digit2: "buildings",
      Digit3: "technologies",
      Digit4: "directive",
      Digit5: "units",
      Digit0: globalThis.uiState.cityActionLast || "workers",
    };
    const modalId = cityModalByHotkey[event.code];
    if (modalId) {
      event.preventDefault();
      globalThis.uiState.cityActionModal = modalId;
      globalThis.uiState.cityActionLast = modalId;
      globalThis.render();
      return;
    }
  }
}

window.addEventListener("pointerdown", () => globalThis.tryStartMusic(), { once: true });
window.addEventListener("keydown", () => globalThis.tryStartMusic(), { once: true });
window.addEventListener("keydown", handleGlobalKeydown);

Object.assign(globalThis, {
  handleGlobalKeydown,
});
