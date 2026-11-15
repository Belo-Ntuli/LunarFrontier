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

The test suite covers colony initialization, facility construction and placement, daily resource rules and sector production modifiers, survival failure, sector unlocking, daily fieldwork, randomized hazards, repairs, and save validation/migration. The production build runs TypeScript checks before bundling.

## Project layout

- `src/game.ts` — sector data, economy values, colony rules, hazard scheduling and repair, and local save validation
- `src/moon-scene.ts` — Three.js lunar globe, textured terrain regions, rotation, and pointer selection
- `src/ui.ts` — atlas, pixelated sector map and crew sprites, fieldwork, HUD, hazard board, construction, timer, and save/load behavior
- `src/style.css` — responsive interface styling, design tokens, and reduced-motion support
- `src/game.test.ts` — core game-rule tests
- `GAME_SPEC.md` — gameplay behavior, initial balancing values, and acceptance criteria

## 2D gameplay interface

The sector screen uses deep-space blue interface panels, warm regolith terrain,
and distinct resource/facility accent colors. CSS design tokens live in
`src/style.css`; resource and facility icons are authored inline in `src/ui.ts`
so the interface has no remote font or art dependencies. UI changes should
continue to display existing game data and invoke existing actions rather than
reimplementing simulation rules. The 2D screen is sized to the desktop
viewport: the lunar surface fills the play area and the facility list scrolls
inside its floating panel. The HUD's Lunar Day label formats the existing
colony day value; day progression remains in the game layer.

## Save data

The save key is `lunar-frontier-save`; its schema version is `8`. Version-1 through version-7 colonies are migrated automatically, preserving colony progress and facility locations while removing discontinued facility types. Existing hazard state is preserved when present; older saves receive an initialized hazard schedule. Active hazards, dust-storm visual end times and failure deadlines, the seeded random state, and the next hazard interval are saved. Solar-flare/DONKI behavior is a placeholder; the game does not currently make NASA API requests. Use the in-game **Start a new colony** flow to replace an existing mission. Invalid saves are reported instead of being silently overwritten.
