# Bronze Crown Architecture

This project is intentionally dependency-free: `index.html` loads classic browser scripts in a fixed order.

## Main Layers

- `src/config/` keeps global feature flags and UI state.
- `src/i18n/` keeps translations and locale helpers.
- `src/data/` keeps balance tables: jobs, buildings, technologies, policies, factions, resources, and world config.
- `src/state/` creates serializable game state and unit/city factories.
- `src/actions/` handles player commands that mutate state and trigger rendering.
- `src/systems/` advances simulation rules: turns, economy, scouts, workers, hostile frontier, and raids.
- `src/world/` owns map generation, hex math consumers, glyphs, and map query helpers.
- `src/ui/` owns DOM rendering only.
- `src/audio/` owns music and UI sound helpers.
- `src/styles/` splits the visual layer by screen and responsibility.

## Rules For New Features

- Put new balance data in `src/data/`, not inside render functions.
- Put turn-by-turn rules in `src/systems/`.
- Put click/button commands in `src/actions/`.
- Keep DOM creation inside `src/ui/`.
- Keep map generation and hex helpers inside `src/world/`.
- Avoid adding direct gameplay rules to UI render functions.
