const appRoot = document.getElementById("app");

function render() {
  document.documentElement.lang = globalThis.t("htmlLang");
  document.title = globalThis.t("pageTitle");
  document.body.classList.toggle("reduce-motion", globalThis.uiState.reduceMotion);
  document.body.classList.toggle("compact-ui", globalThis.uiState.compactUi);
  appRoot.innerHTML = "";
  appRoot.appendChild(globalThis.uiState.screen === "game" ? renderApp() : globalThis.renderMainMenu());
  applyPendingFocusRequest();
}

function renderApp() {
  const shell = globalThis.el("div", {
    className: `app-shell${globalThis.uiState.turnTransition ? " shell-turn-transition" : ""}`.trim(),
  });
  shell.appendChild(globalThis.renderHeader());

  const onboardingBanner = typeof globalThis.renderOnboardingBanner === "function"
    ? globalThis.renderOnboardingBanner()
    : null;
  if (onboardingBanner) shell.appendChild(onboardingBanner);

  const layout = globalThis.el("div", { className: "layout" });
  layout.appendChild(globalThis.renderMainStage());
  shell.appendChild(layout);

  if (globalThis.uiState.logOpen) {
    shell.appendChild(globalThis.renderLogDrawer());
  }
  if (globalThis.uiState.encyclopediaOpen && typeof globalThis.renderEncyclopediaDrawer === "function") {
    shell.appendChild(globalThis.renderEncyclopediaDrawer());
  }
  if (globalThis.uiState.diplomacyTargetId) {
    shell.appendChild(globalThis.renderDiplomacyDrawer());
  }
  if (globalThis.state.world.pendingEncounter) {
    shell.appendChild(globalThis.renderEncounterModal());
  }
  if (globalThis.state.pendingTurnEvent && typeof globalThis.renderTurnEventModal === "function") {
    const turnEvEl = globalThis.renderTurnEventModal();
    if (turnEvEl) shell.appendChild(turnEvEl);
  }
  if (
    globalThis.state.runOutcome === "victory"
    && globalThis.uiState.runVictoryModalDismissed === false
    && typeof globalThis.renderRunVictoryModal === "function"
  ) {
    shell.appendChild(globalThis.renderRunVictoryModal());
  }
  if (globalThis.uiState.toast) {
    shell.appendChild(renderToast());
  }
  if (globalThis.uiState.turnEndModalOpen) {
    const turnEndEl = globalThis.renderTurnEndModal();
    if (turnEndEl) shell.appendChild(turnEndEl);
  }
  if (globalThis.uiState.turnSummaryOpen && globalThis.state.turnSummary) {
    const summaryEl = renderTurnSummaryPanel();
    if (summaryEl) shell.appendChild(summaryEl);
  }
  if (globalThis.uiState.turnTransition) {
    shell.appendChild(renderTurnTransition(globalThis.uiState.turnTransition.turn));
  }

  return shell;
}

let toastTimer = null;
let turnTransitionTimer = null;

function showToast(message, tone = "info") {
  globalThis.uiState.toast = { message, tone, icon: toastIconForTone(tone) };
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    globalThis.uiState.toast = null;
    toastTimer = null;
    render();
  }, 2200);
  render();
}

function toastIconForTone(tone) {
  if (tone === "success") return "OK";
  if (tone === "warn") return "!";
  if (tone === "danger") return "X";
  return "i";
}

function renderToast() {
  const toast = globalThis.el(
    "div",
    { className: `game-toast ${globalThis.uiState.toast.tone || "info"}` },
    globalThis.el("span", { className: "game-toast-icon" }, globalThis.uiState.toast.icon || "i"),
    globalThis.el("span", { className: "game-toast-text" }, globalThis.uiState.toast.message),
  );
  return toast;
}

function dismissTurnSummary() {
  globalThis.uiState.turnSummaryOpen = false;
  render();
}

function renderTurnSummaryPanel() {
  const summary = globalThis.state.turnSummary;
  if (!summary || !summary.lines) return null;
  const backdrop = globalThis.el("div", { className: "turn-summary-backdrop" });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) dismissTurnSummary();
  });
  const inner = globalThis.el("div", { className: "turn-summary-panel panel soft" });
  globalThis.appendChildren(
    inner,
    globalThis.el(
      "div",
      { className: "tile-header" },
      globalThis.el("h2", {}, globalThis.t("turnSummaryTitle", { turn: summary.turn })),
      globalThis.button("×", dismissTurnSummary, false),
    ),
  );
  summary.lines.forEach((line) => {
    inner.appendChild(globalThis.el("div", { className: "label turn-summary-line" }, line));
  });
  inner.appendChild(
    globalThis.el(
      "div",
      { className: "turn-summary-actions" },
      globalThis.button(globalThis.t("turnSummaryDismiss"), dismissTurnSummary, false),
    ),
  );
  backdrop.appendChild(inner);
  return backdrop;
}

function renderTurnTransition(turn) {
  return globalThis.el(
    "div",
    { className: "turn-transition-banner" },
    globalThis.el("div", { className: "turn-transition-title" }, globalThis.t("turnLabel", { turn })),
    globalThis.el("div", { className: "turn-transition-subtitle" }, globalThis.t("turnAdvanceSubtitle")),
  );
}

function triggerTurnFeedback() {
  globalThis.uiState.turnTransition = { turn: globalThis.state.turn };
  if (turnTransitionTimer) {
    clearTimeout(turnTransitionTimer);
  }
  turnTransitionTimer = setTimeout(() => {
    globalThis.uiState.turnTransition = null;
    turnTransitionTimer = null;
    render();
  }, 1600);
}

function applyPendingFocusRequest() {
  const request = globalThis.uiState.focusRequest;
  if (!request || globalThis.uiState.screen !== "game") return;
  const applyFocus = () => {
    const target = document.querySelector(request.selector)
      || (request.fallbackSelector ? document.querySelector(request.fallbackSelector) : null);
    if (!target) return;
    const scrollHost = getScrollHost(target);
    if (scrollHost) {
      const hostRect = scrollHost.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - hostRect.top - hostRect.height * 0.2;
      scrollHost.scrollTo({
        top: scrollHost.scrollTop + offset,
        behavior: "smooth",
      });
    }
    target.classList.add("ui-spotlight");
    setTimeout(() => {
      target.classList.remove("ui-spotlight");
    }, 1800);
  };
  globalThis.uiState.focusRequest = null;
  setTimeout(applyFocus, 0);
}

function getScrollHost(node) {
  let current = node?.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
    if (canScrollY) return current;
    current = current.parentElement;
  }
  const scrollRoot = document.scrollingElement;
  if (scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight) return scrollRoot;
  return null;
}

globalThis.render = render;
globalThis.showToast = showToast;

