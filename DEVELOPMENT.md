# Development guide

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- A modern browser with WebGL enabled for the interactive 3D lunar atlas

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The game needs no account, backend, or database. Progress is kept in the current browser's local storage.

## Verify changes

```sh
npm test
npm run build
```

The test suite covers colony initialization, facility construction and placement, daily resource rules, survival failure, sector unlocking, daily fieldwork, randomized hazards, repairs, and save validation/migration. The production build runs TypeScript checks before bundling.

## Project layout

- `src/game.ts` — sector data, economy values, colony rules, hazard scheduling and repair, and local save validation
- `src/moon-scene.ts` — Three.js lunar globe, textured terrain regions, rotation, and pointer selection
- `src/ui.ts` — atlas, interactive sector map and fieldwork, HUD, hazard board, construction, timer, and save/load behavior
- `src/style.css` — responsive visual design and reduced-motion support
- `src/game.test.ts` — core game-rule tests
- `GAME_SPEC.md` — gameplay behavior, initial balancing values, and acceptance criteria

## Save data

The save key is `lunar-frontier-save`; its schema version is `4`. Version-1, version-2, and version-3 colonies are migrated automatically, preserving progress and assigning existing facilities default map positions. Active hazards, the seeded random state, and the next hazard interval are saved. Solar-flare/DONKI behavior is a placeholder; the game does not currently make NASA API requests. Use the in-game **Start a new colony** flow to replace an existing mission. Invalid saves are reported instead of being silently overwritten.
