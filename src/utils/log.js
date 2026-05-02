function pushLog(currentState, textKey, params = {}) {
  currentState.log.unshift({ turn: currentState.turn, textKey, params });
}

function resolveLogText(entry) {
  if (entry.text) return entry.text;
  return globalThis.t(entry.textKey, entry.params);
}

Object.assign(globalThis, {
  pushLog,
  resolveLogText,
});
