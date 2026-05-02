function getStoredLocale() {
  const stored = localStorage.getItem(globalThis.STORAGE_KEY);
  return stored && globalThis.I18N[stored] ? stored : globalThis.DEFAULT_LOCALE;
}

let locale = getStoredLocale();

function getLocale() {
  return locale;
}

function t(key, params = {}) {
  const table = globalThis.I18N[locale] || globalThis.I18N[globalThis.DEFAULT_LOCALE];
  const fallback = globalThis.I18N[globalThis.DEFAULT_LOCALE];
  const value = table[key] ?? fallback[key] ?? key;
  return typeof value === "function" ? value(params) : value;
}

function setLocale(nextLocale) {
  if (!globalThis.I18N[nextLocale]) return;
  locale = nextLocale;
  localStorage.setItem(globalThis.STORAGE_KEY, nextLocale);
  globalThis.render();
}

function localizeName(key) {
  return t(key);
}

Object.assign(globalThis, {
  t,
  setLocale,
  localizeName,
  getLocale,
});

export { getLocale, setLocale, t, localizeName };
