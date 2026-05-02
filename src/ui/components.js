function flowCard(labelText, stockText, flowText) {
  const flowString = String(flowText);
  const toneClass = flowString.startsWith("+") ? "positive" : flowString.startsWith("-") ? "negative" : "neutral";
  const card = el("div", { className: "flow-card" });
  appendChildren(card, 
    el("strong", {}, labelText),
    el("div", { className: "value" }, stockText),
    el("div", { className: `flow-value ${toneClass}` }, flowText),
  );
  return card;
}

function renderSlider(city, jobId) {
  const wrap = el("div", { className: "district-slider-wrap" });
  const value = city.assignments[jobId];
  const max = getAssignmentMax(city, jobId);
  const job = typeof JOBS !== "undefined" ? JOBS.find((item) => item.id === jobId) : null;
  const ariaLabel = job ? globalThis.t(job.labelKey) : String(jobId);
  const row = el("div", { className: "district-slider-meta" },
    el("span", { className: "label", "aria-hidden": "true" }, "\u2060"),
    el("strong", {}, `${value}/${max}`),
  );
  const input = el("input", {
    className: "district-slider",
    type: "range",
    min: 0,
    max,
    value,
  });
  input.setAttribute("aria-label", ariaLabel);
  input.setAttribute("aria-valuemin", "0");
  input.setAttribute("aria-valuemax", String(max));
  input.setAttribute("aria-valuenow", String(value));
  input.addEventListener("input", (event) => {
    globalThis.tryStartMusic();
    globalThis.playSliderTickSound();
    const next = Number(event.target.value);
    event.target.setAttribute("aria-valuenow", String(next));
    setWorkers(city.nameKey, jobId, next);
  });
  appendChildren(wrap, row, input);
  return wrap;
}

function sectionTitle(text) {
  return el("div", { className: "section-head" }, el("h3", {}, text));
}

function metric(labelText, value) {
  const card = el("div", { className: "metric-card" });
  appendChildren(card, el("strong", {}, labelText), el("div", { className: "value" }, value));
  return card;
}

function button(text, onClick, disabled = false) {
  const btn = el("button", { disabled });
  btn.textContent = text;
  btn.addEventListener("click", () => {
    globalThis.tryStartMusic();
    globalThis.playButtonClickSound();
    onClick();
  });
  return btn;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === "className") node.className = value;
    else if (key === "disabled") node.disabled = value;
    else node[key] = value;
  });
  appendChildren(node, ...children);
  return node;
}

function appendChildren(node, ...children) {
  children.flat().forEach((child) => {
    if (child == null || child === false || child === "") return;
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
      return;
    }
    node.appendChild(child);
  });
  return node;
}

Object.assign(globalThis, {
  flowCard,
  renderSlider,
  sectionTitle,
  metric,
  button,
  el,
  appendChildren,
});
