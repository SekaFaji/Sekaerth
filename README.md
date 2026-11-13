# Sekaerth 🌍

**Sekaerth** is a cozy, pixel-art planet exploration game. Start at the warm center of a procedurally generated world, mine your way outward, gather gems, build hearths, upgrade your pickaxe and reach the sunlight.

The project was originally prototyped as *Sunward* and renamed to **Sekaerth** for the Seka game collection.

## Choose your world

| World | Radius | Diameter |
| --- | ---: | ---: |
| Tiny (original) | 1.6 km | 3.2 km |
| Small | 3.2 km | 6.4 km |
| Medium | 6.4 km | 12.8 km |
| Large | 12.8 km | 25.6 km |
| Huge | 25.6 km | 51.2 km |
| Real-Size Earth | 6,371 km | 12,742 km |

Each block represents one meter. Terrain is generated in chunks on demand rather than allocating an entire planet up front. World choice affects the planet radius, depth-based biome transitions and progression distance. **Real-Size Earth is an experimental endurance setting**, not a claim of realistic geology or a fully populated Earth map.

## Play

Once GitHub Pages has been enabled with **Settings → Pages → Build and deployment → GitHub Actions**, the game is intended to deploy to:

https://sekafaji.github.io/Sekaerth/

## Development

Requires Node.js 20 or later.

```sh
npm install
npm run dev
npm test
npm run build
```

The game runs as a React/TypeScript component in `src/SekaerthGame.tsx`, built with Vite and Tailwind CSS. The deployment workflow in `.github/workflows/pages.yml` publishes `dist/` on pushes to `main` after Pages is enabled.

## Controls and HUD

On phones, drag the circular movement thumbstick at bottom-left to walk or hold against rock to dig. The thumbstick has a small dead zone, supports diagonals and safely stops when you release or switch apps. The right-side circular **Forge** and **Hearth** buttons upgrade your pick (10 and 25 gems) or place a hearth (5 gems).

On keyboards, move/dig with **WASD** or arrow keys. Upgrade the pickaxe with **U**, place a hearth with **H**, and pause with **Esc**.

The top HUD uses warm translucent timber plaques inspired by Sekampfire. It shows the live biome, world size, distance from the core, direction and distance to sunlight, warmth, gems, pickaxe tier and the Menu button.

The movement thumb uses the Cursed Project restoration as a *behavioral reference* (dead zone, capped thumb displacement and drag control). The Sekaerth art and UI are distinct and its grid-based diagonal movement avoids passing through solid corners.


## Saves

Runs and settings are saved locally in your browser. The game migrates legacy `sunward-*` storage keys to `sekaerth-*` when it runs on the **same website origin**. Browser storage is not shared across different domains, so an older deployment's progress cannot automatically move to GitHub Pages.

Starting a new world replaces the current single save slot; a confirmation is shown. World-size selection and existing save compatibility were added in v3.1.

## Project status

Early playable prototype. v3.2 adds a Sekampfire-inspired HUD and a Cursed Project-inspired analog touch control in place of the four arrow buttons. Large worlds are mathematically scalable, but richer exploration content, balancing and game-length tuning remain future work.
