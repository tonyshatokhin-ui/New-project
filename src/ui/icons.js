const WORLD_ICON_PATHS = {
  capital: [
    "M12 3l3.3 5.2 5.7-1.5-2.2 10.8H5.2L3 6.7l5.7 1.5L12 3z",
    "M6.8 19.5h10.4",
  ],
  city: [
    "M4.5 19V9.5l5-3.2 5 3.2V19",
    "M14.5 19v-6.5l5-2.8V19",
    "M8 19v-4h3v4",
    "M6.7 11.5h2.2M16.2 13.2h1.8",
  ],
  suburb: [
    "M5 19V11l4-2.8 4 2.8v8",
    "M13 19v-5.4l3-2.1 3 2.1V19",
    "M7.5 19v-3.2h2.6V19",
    "M4 20h16",
    "M6.2 8.5l2.8-2 2.8 2",
  ],
  scout: [
    "M12 3.5l6.5 17-6.5-3-6.5 3 6.5-17z",
    "M12 7.8v9.2",
    "M9.2 15.7l2.8-2.1 2.8 2.1",
  ],
  army: [
    "M6 7.5l6-4 6 4v9l-6 4-6-4v-9z",
    "M12 9.2v5.6",
    "M9.8 13.2l2.2-1 2.2 1",
  ],
  settler: [
    "M8 17.5v-6l4-9 4 9v6",
    "M12 13.8h-.1",
    "M10 17.5h4",
    "M6.5 20h11",
  ],
  worker: [
    "M8 20v-7.5l4-2.5 4 2.5V20",
    "M7.2 7.5h9.6",
    "M9 7.5a3 3 0 0 1 6 0",
    "M6.5 20h11",
  ],
  raider: [
    "M7 8.2a5 5 0 0 1 10 0v2.3a5 5 0 0 1-10 0V8.2z",
    "M8 17l-2.5 3M16 17l2.5 3",
    "M9.2 9.8h.1M14.7 9.8h.1",
    "M10 14.2h4",
  ],
  rival: [
    "M5 5l14 14M19 5L5 19",
    "M8 4h8M8 20h8",
  ],
  hostile: [
    "M12 3.5l9 16H3l9-16z",
    "M12 8.2v5.2",
    "M12 16.8h.1",
  ],
  beast: [
    "M7.5 14.5c-1.8-3.5.8-7 3.5-8.2 2-1 4 0 4.2 2.3-.8 2.8-3.8 5.7-4 8.2-.5 3.8-6 3.8-7.8 3.5z",
    "M11 11.2h1.2",
    "M9 18.5l2.2-2 2.2 2",
  ],
  move: [
    "M4 12h15",
    "M14 7l5 5-5 5",
    "M7 7l-3 5 3 5",
  ],
  explore: [
    "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
    "M14.8 9.2l-1.9 4.1-3.7 1.5 1.9-4.1 3.7-1.5z",
  ],
  "resource-copper": [
    "M7 8.5h10l-2.3 10h-5.4L7 8.5z",
    "M9 5.5h6M10.2 3.8h3.6",
  ],
  "resource-grain": [
    "M12 20V5",
    "M12 8c-3 0-4.8-1.3-5.7-3.3C9 4.4 11 5.6 12 8z",
    "M12 11c3 0 4.8-1.3 5.7-3.3C15 7.4 13 8.6 12 11z",
    "M12 14c-3 0-4.8-1.3-5.7-3.3C9 10.4 11 11.6 12 14z",
    "M12 17c3 0 4.8-1.3 5.7-3.3C15 13.4 13 14.6 12 17z",
  ],
  "resource-incense": [
    "M7 19h10",
    "M9 16h6l1.5 3h-9L9 16z",
    "M10 13c-2.2-2.8 2.8-3.4.8-6",
    "M14 13c2.2-2.8-2.8-3.4-.8-6",
  ],
  "resource-horses": [
    "M6 18V9.5l3.5-3H15l3 3v8.5",
    "M8 18v-3M16 18v-3",
    "M9 9.2h4.8l2.2 2.2",
    "M15.5 6.7L18 5.5",
  ],
  "resource-iron": [
    "M8 6.5h9l-5.2 6.2H16L8 20l2.6-6.3H7L8 6.5z",
  ],
  "resource-fish": [
    "M4 12c3.2-4.2 8.5-4.2 12 0-3.5 4.2-8.8 4.2-12 0z",
    "M16 12l4-3v6l-4-3z",
    "M8.5 11.4h.1",
  ],
  "resource-stone": [
    "M5 17.2l2-8.4 5-3.2 5.5 2.5 1.5 8.8-4.2 2.1H8.6L5 17.2z",
    "M7 13.8h10",
    "M12 5.8l-1.5 8",
  ],
  "resource-harbor": [
    "M12 4v13",
    "M8 8h8",
    "M6 12c1.4 4 3.4 6 6 6s4.6-2 6-6",
    "M9 18l-2 2M15 18l2 2",
  ],
  "terrain-mountain": [
    "M4 18l5.2-10 3.1 5 2.2-3.4L20 18H4z",
    "M9.2 8l1.4 3h3.7",
  ],
  "terrain-hill": [
    "M4 17c2.4-4.2 5.2-6.4 8.2-6.4 3.2 0 5.8 2.1 7.8 6.4H4z",
    "M7 16c1.5-2 3.1-3 5-3",
  ],
  "terrain-forest": [
    "M7 18l3.5-5.2H8.8L12 7l3.2 5.8h-1.7L17 18H7z",
    "M12 18v2",
  ],
  "terrain-plain": [
    "M4 14c3.2-1.6 5.4-1.6 8 0s4.8 1.6 8 0",
    "M4 18c3.2-1.6 5.4-1.6 8 0s4.8 1.6 8 0",
    "M7 10h10",
  ],
  "terrain-coast": [
    "M4 15c2.3-2 4.6-2 7 0s4.7 2 7 0",
    "M5 19c2.2-1.3 4.2-1.3 6 0s3.8 1.3 6 0",
    "M16 5c-2.3 1.5-3.5 3.7-3.5 6.5",
  ],
  "terrain-river": [
    "M13 3c-4.8 4.2 4.2 6.3-1 11.2-1.6 1.5-2.2 3.2-1.2 5.8",
    "M8 5c2.4 2 5.7 2.7 8 1",
  ],
  "terrain-sea": [
    "M4 11c2.4-2 4.8-2 7.2 0s4.8 2 8 0",
    "M4 16c2.4-2 4.8-2 7.2 0s4.8 2 8 0",
  ],
};

function iconNode(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `map-icon map-icon-${name}${className ? ` ${className}` : ""}`);

  (WORLD_ICON_PATHS[name] || WORLD_ICON_PATHS.explore).forEach((data) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", data);
    svg.appendChild(path);
  });

  return svg;
}

Object.assign(globalThis, {
  iconNode,
});
