import "./bootstrap.js";

globalThis.state = globalThis.createInitialState();
globalThis.uiState.selectedHexId = globalThis.state.world.startTileId;

globalThis.render();
