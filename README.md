# Sekaerth

**A mobile-first, 2D planetary survival and exploration game by SekaFaji Games.**

Start near the heart of a procedurally generated planet. Mine your way outward, gather resources, craft equipment, establish warm shelters and work toward the sunlight. Each world has its own seed, player progress and modifications.

**[Play Sekaerth](https://sekafaji.github.io/Sekaerth/)** · [Development guide](CONTRIBUTING.md) · [Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md)

## Highlights

- **Six world sizes:** Tiny, Small, Medium, Large, Huge and experimental Real-Size Earth. World dimensions range from a 1.6 km to a 6,371 km radius.
- **Mobile-first input:** floating thumbstick, ACT and INTERACT, with optional Auto-Dig and keyboard support.
- **Survival progression:** climate and biome-dependent cold, finite overlapping hearth heat, crafted gear and workbenches.
- **Sandbox foundations:** deterministic 16×16 terrain chunks, block mining, 24-slot inventory, five quick slots, resources and consumables.
- **World persistence:** multiple named worlds and incremental, per-chunk IndexedDB saves; compatible with existing worlds.

> Real-Size Earth uses Earth-scale dimensions but is not a simulation of real Earth geography or geology. This is an early playable game with more building and exploration systems planned.

## Landscape and fullscreen (v3.6.2)

Sekaerth fits the phone's available screen in portrait **and landscape**, expanding the world camera horizontally without distorting tiles. On landscape phones, the HUD forms a compact top row, while movement, ACT, INTERACT and the quickbar remain near the bottom edges.

Use **Fullscreen** from the title menu, pause menu or Settings. Fullscreen uses the browser API where supported; some mobile browsers and embedded webviews may not allow it. Rotating to landscape works even when fullscreen is unavailable. The game respects screen safe areas and only requests a landscape orientation lock when the device is already in landscape.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Thumbstick | WASD / arrows |
| Mine, use or place selected item | ACT | Space / F |
| Use a nearby workbench or hearth | INTERACT | E |
| Basic crafting | HAND | C |
| Inventory and equipment | BAG | I / B |
| Pause / settings | MENU | Esc |

Hand-craft a Workbench Kit from Stone, place it using ACT, then use INTERACT nearby to access the workbench recipes.

## Running locally

Node.js **22+** is required.

```sh
npm install
npm run dev
```

Open the URL shown by Vite. Before opening a pull request, validate with:

```sh
npm run check
```

This runs the Node unit tests, TypeScript verification and production build. GitHub Actions checks pull requests, then builds and deploys `main` to GitHub Pages. The workflows do not publish development ZIP backups.

## Project structure

| Directory | Responsibility |
| --- | --- |
| `src/world/` | Procedural terrain and chunk simulation |
| `src/persistence/` | World databases, migrations and local preferences |
| `src/items/`, `src/crafting/` | Inventory, equipment and recipes |
| `src/survival/` | Climate, cold and heat |
| `src/rendering/` | Lighting, tiles and player sprite data |
| `src/audio/` | Procedural game audio |
| `src/ui/` | Inventory interface, thumbstick and icon components |
| `src/SekaerthGame.tsx` | Main simulation and screen orchestration (remaining extraction in progress) |

See [architecture notes](docs/ARCHITECTURE.md) for the save transaction and world-loading behavior.

## Save safety and limitations

Worlds are stored **on the current device and browser origin**, not in a cloud account. Deleting website storage or changing device can remove them. **World export/import is not implemented yet.** Keep browser site data intact until backups are supported.

The large-world storage design persists modified chunks rather than generated terrain, but exceptionally long playthroughs and thousands of modified chunks still need device profiling.

## Studio

**Developed by SekaFaji Games.**
