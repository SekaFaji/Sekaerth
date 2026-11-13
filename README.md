# Sekaerth 🌍

**Current version: 3.5 - Crafting and equipment.**

**Developed by SekaFaji Games.**

**Sekaerth** is a cozy, pixel-art planet exploration game. Start at the warm heart of a procedurally generated planet, mine outward, upgrade your pickaxe, place hearths and eventually reach the sunlight. Inspired by 2D sandbox exploration games, with mobile-first thumb movement.

**Play:** https://sekafaji.github.io/Sekaerth/

## v3.5 - crafting and equipment

- Mobile-friendly **Crafting** and **Equipment** tabs beside the 24-slot backpack; open crafting using **CRAFT / C**, bag using **BAG / I / B**, and equipment using **E**.
- Craft a **Workbench Kit** (16 Stone) anywhere; use it from the bag or quickbar to place a persistent workshop at your feet on an open tile. Stand within two tiles of the workbench to unlock advanced recipes.
- Craft **Warm Tonics** (2 Warm Blooms + 1 Crystal Shard) anywhere to restore 35 warmth.
- At a workbench, craft **Root Cloak** (10 Root Fiber + 2 Warm Blooms) and **Miner's Gloves** (14 Stone + 3 Crystal Shards).
- Wear the cloak to reduce cold drain by 35%. Equip gloves to deal 2 mining damage per strike, without bypassing the existing pickaxe tier requirements.
- Crafting uses all-or-nothing ingredient transactions, checks output capacity *after* consuming ingredients and leaves old worlds and the gem-based pickaxe forge intact.
- Crafting benches save in modified terrain chunks. Each world's equipment saves in the same IndexedDB metadata record as its inventory. Existing v5 worlds load with empty equipment slots.

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

## Inventory and resources (v3.4)

Break stone, sand, roots, hardstone, obsidian, gem deposits and surface grass to collect stackable material drops; walking through Warm Blooms collects them too. Crystal Shards are separate crafting resources; **gems are still the currency for pickaxe upgrades and hearths**, to preserve existing progression.

- Open your **24-slot backpack** with the in-game BAG button or **I / B** on keyboard.
- The first five slots form the quickbar. Tap two backpack slots to move, swap or combine items.
- Warm Bloom is a consumable that restores 12 warmth (up to 100). Use it from the backpack or the quickbar.
- A full bag blocks mining rather than destroying a resource. **Discard stack** requires confirmation to make space; discarded stacks are removed permanently (world item drops are a future feature).
- Inventory saves with each world's metadata and changed chunks in the same IndexedDB transaction. Old v4 worlds without inventory load with an empty backpack.

Version 3.5 adds a first crafting station, wearable equipment and real recipe transactions. General block construction and item-dropping in the world remain future features.

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

Move and automatically dig using the touchscreen thumbstick or WASD/arrow keys. Tap **CRAFT** (or C) for recipes, **BAG** (or I/B) for items, **E** for equipment, **FORGE** (or U) for a gem-powered pickaxe upgrade, **HEARTH** (or H) for a warm checkpoint, and **MENU** (or Esc) to pause.

## Architecture and persistence

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for module responsibilities, transaction semantics, chunk hydration, migration rules and extension points.

The codebase now includes data-driven item, crafting and equipment modules. Next planned systems: placeable building blocks, item drops in the world, equipment visuals, richer crafting stations and save backup/export.

## Known limitations

- Saves are per browser origin, not cloud-synced.
- World backup/export has not been implemented. Browser storage is not a permanent archive.
- A very large number of modified chunks makes the modified-chunk key index large; further profiling and storage optimization will be needed for extreme playthroughs.
- Other gameplay and graphics still live in the original monolithic React component, pending incremental extraction.
- Large world sizes need progression balancing and more content before they become enjoyable full-length sandbox experiences.
