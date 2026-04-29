function handleGlobalKeydown(event) {
  if (event.repeat || event.defaultPrevented) return;
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
    nextTurn();
    return;
  }

  if (uiState.screen !== "game") return;
  if (event.code === "F1") {
    event.preventDefault();
    uiState.hudPreset = "minimal";
    render();
    return;
  }
  if (event.code === "F2") {
    event.preventDefault();
    uiState.hudPreset = "standard";
    render();
    return;
  }
  if (event.code === "F3") {
    event.preventDefault();
    uiState.hudPreset = "detailed";
    render();
    return;
  }
  if (event.code === "Tab") {
    event.preventDefault();
    uiState.hudPanelOpen = !uiState.hudPanelOpen;
    render();
    return;
  }

  if (state.view === "city") {
    const cityModalByHotkey = {
      Digit1: "workers",
      Digit2: "buildings",
      Digit3: "directive",
      Digit4: "units",
      Digit0: uiState.cityActionLast || "workers",
    };
    const modalId = cityModalByHotkey[event.code];
    if (modalId) {
      event.preventDefault();
      uiState.cityActionModal = modalId;
      uiState.cityActionLast = modalId;
      render();
      return;
    }
  }
}

window.addEventListener("pointerdown", tryStartMusic, { once: true });
window.addEventListener("keydown", tryStartMusic, { once: true });
window.addEventListener("keydown", handleGlobalKeydown);
