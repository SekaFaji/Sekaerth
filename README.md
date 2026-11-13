# Sekaerth 🌍

**Sekaerth** is a cozy, pixel-art planet exploration game. Start at the warm heart of a procedurally generated planet, mine outward, upgrade your pickaxe, place hearths and eventually reach the sunlight. Inspired by 2D sandbox exploration games, with mobile-first thumb movement.

**Play:** https://sekafaji.github.io/Sekaerth/

## v3.3 - foundation and world saves

- Create **multiple named worlds**, each with its own seed, player, hearths and block changes.
- A separate **IndexedDB world database** replaces the old single large localStorage run blob.
- Each altered 16×16 chunk is persisted independently. Pristine terrain is regenerated deterministically from the saved seed, not stored.
- **Incremental saves** write only changed chunks plus the small world metadata record in one transaction. Failed writes retain dirty chunks for retry.
- Only modified chunk **keys** are indexed on loading a world; modified content is read lazily as the player approaches. Blocks are temporarily blocked while their saved changes load, never replaced with pristine terrain.
- Terrain generation, world state and persistence are now in separate modules for future inventory, crafting and structures.
- The first launch attempts a **non-destructive import** from the former `sekaerth-run-v1`/`sunward-run-v1` save. The old browser save is not deleted.
- The pause menu saves before returning to the title, and world deletion requires confirmation.

**Caveat:** IndexedDB is browser- and origin-specific. Clearing site data, changing domains, or uninstalling browsers can remove it. World import/export and backups are planned, not yet implemented. Avoid clearing site data until backup export exists.

## World sizes

| World | Radius | Diameter |
| --- | ---: | ---: |
| Tiny (original) | 1.6 km | 3.2 km |
| Small | 3.2 km | 6.4 km |
| Medium | 6.4 km | 12.8 km |
| Large | 12.8 km | 25.6 km |
| Huge | 25.6 km | 51.2 km |
| Real-Size Earth | 6,371 km | 12,742 km |

One block represents one meter. Real-Size Earth is experimental: planet dimensions are Earth-scale, but geology and travel speed are not realistically simulated.

## Development

Requires Node.js 22 or later.

```sh
npm install
npm run test
npm run typecheck
npm run dev
npm run build
```

Production deployment is handled by `.github/workflows/pages.yml` on `main`. Enable **Settings → Pages → Build and deployment → GitHub Actions** if deployment has not been configured.

## Controls

Move and automatically dig using the touchscreen thumbstick or WASD/arrow keys. Tap **FORGE** (or U) to improve your pickaxe, **HEARTH** (or H) to plant a warm checkpoint, and **MENU** (or Esc) to pause.

## Architecture and persistence

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module responsibilities, transaction semantics, chunk hydration, migration rules and extension points.

Next planned systems: item definitions, inventory, resource drops, crafting recipes, equipment and block placement. These are **not yet implemented** in v3.3.

## Known limitations

- Saves are per browser origin, not cloud-synced.
- World backup/export has not been implemented. Browser storage is not a permanent archive.
- A very large number of modified chunks makes the modified-chunk key index large; further profiling and storage optimization will be needed for extreme playthroughs.
- Other gameplay and graphics still live in the original monolithic React component, pending incremental extraction.
- Large world sizes need progression balancing and more content before they become enjoyable full-length sandbox experiences.
