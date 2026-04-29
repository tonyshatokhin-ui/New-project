function render() {
  document.documentElement.lang = t("htmlLang");
  document.title = t("pageTitle");
  document.body.classList.toggle("reduce-motion", uiState.reduceMotion);
  document.body.classList.toggle("compact-ui", uiState.compactUi);
  root.innerHTML = "";
  root.appendChild(uiState.screen === "game" ? renderApp() : renderMainMenu());
  applyPendingFocusRequest();
}

function renderApp() {
  const shell = el("div", { className: "app-shell" });
  shell.appendChild(renderHeader());

  const layout = el("div", { className: "layout" });
  layout.appendChild(renderMainStage());
  shell.appendChild(layout);

  if (uiState.logOpen) {
    shell.appendChild(renderLogDrawer());
  }
  if (uiState.diplomacyTargetId) {
    shell.appendChild(renderDiplomacyDrawer());
  }
  if (state.world.pendingEncounter) {
    shell.appendChild(renderEncounterModal());
  }
  if (uiState.toast) {
    shell.appendChild(renderToast());
  }
  if (uiState.turnTransition) {
    shell.appendChild(renderTurnTransition(uiState.turnTransition.turn));
  }

  return shell;
}

let toastTimer = null;
let turnTransitionTimer = null;

function showToast(message, tone = "info") {
  uiState.toast = { message, tone, icon: toastIconForTone(tone) };
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    uiState.toast = null;
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
  const toast = el(
    "div",
    { className: `game-toast ${uiState.toast.tone || "info"}` },
    el("span", { className: "game-toast-icon" }, uiState.toast.icon || "i"),
    el("span", { className: "game-toast-text" }, uiState.toast.message),
  );
  return toast;
}

function renderTurnTransition(turn) {
  return el(
    "div",
    { className: "turn-transition-banner" },
    el("div", { className: "turn-transition-title" }, t("turnLabel", { turn })),
    el("div", { className: "turn-transition-subtitle" }, t("turnAdvanceSubtitle")),
  );
}

function triggerTurnFeedback() {
  uiState.turnTransition = { turn: state.turn };
  if (turnTransitionTimer) {
    clearTimeout(turnTransitionTimer);
  }
  turnTransitionTimer = setTimeout(() => {
    uiState.turnTransition = null;
    turnTransitionTimer = null;
    render();
  }, 1600);
}

function applyPendingFocusRequest() {
  const request = uiState.focusRequest;
  if (!request || uiState.screen !== "game") return;
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
  uiState.focusRequest = null;
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
  const root = document.scrollingElement;
  if (root && root.scrollHeight > root.clientHeight) return root;
  return null;
}

