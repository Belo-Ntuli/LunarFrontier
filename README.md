# Lunar Frontier

A browser-based lunar colony management game. Explore a 3D atlas of the Moon,
establish an outpost, manage life-support resources, build facilities, and
expand into new sectors. The game is an educational simulation; its lunar
terrain and resource values are simplified for play.

## Get started

### Requirements

- Node.js 20.19+ or 22.12+
- npm
- A modern browser with WebGL enabled for the interactive 3D atlas

### Run locally

```sh
git clone https://github.com/Belo-Ntuli/LunarFrontier.git
cd LunarFrontier
npm install
npm run dev
```

Open the local URL printed by Vite. Player progress is saved in the current
browser's local storage; the game does not require an account or backend.

## Host on GitHub Pages

The `Deploy to GitHub Pages` workflow builds and publishes the game whenever
changes are pushed to `main`, or when started manually from the Actions tab.
In the repository's **Settings → Pages**, set the build and deployment source
to **GitHub Actions**. After the first successful workflow run, the site is
available at `https://belo-ntuli.github.io/LunarFrontier/`.

## Gameplay and development

- [GAME_SPEC.md](./GAME_SPEC.md) describes the gameplay, current balancing
  values, and acceptance criteria.
- [DEVELOPMENT.md](./DEVELOPMENT.md) documents the project structure, save
  behavior, and development checks.

Run the test suite and production build before submitting a change:

```sh
npm test
npm run build
```

## Contributing

1. Fork the repository or create a feature branch; avoid committing directly
   to `main`.
2. Keep changes focused and follow the gameplay requirements in
   [GAME_SPEC.md](./GAME_SPEC.md).
3. Run `npm test` and `npm run build`.
4. Commit your changes with a clear message, push your branch, and open a pull
   request describing the change and verification performed.

For a local feature branch:

```sh
git switch -c feature/short-description
# Make and verify your changes
git add <files>
git commit -m "Describe the change"
git push -u origin feature/short-description
```

Please do not commit generated `dist/` output, `node_modules/`, local
environment files, or credentials.
