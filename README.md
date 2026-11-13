# Sekaerth 🌍

**Created by SekaFaji Games** | **Version 3.6 - Survival & Interaction**

A mobile-first, 2D pixel-art planet adventure. Begin near the heart of a procedurally generated planet, mine resources, craft and upgrade equipment, establish workbenches and warm shelters, and journey toward sunlight. Inspired by sandbox exploration and survival games, with its own radial-world progression.

**Play Sekaerth:** https://sekafaji.github.io/Sekaerth/

## Current features

- Six world sizes from Tiny (1,600 m radius) to experimental Real-Size Earth (6,371 km radius). One block is one meter.
- Procedurally generated terrain with deterministic seeds, 16×16 chunks and separately persisted player modifications.
- Named worlds and independent browser saves (IndexedDB), legacy-save migration and incremental saves.
- Cursed Project-inspired floating movement thumbstick and a compact, semi-transparent HUD.
- **ACT** to mine or use/place the selected quickbar item; **INTERACT** near a workbench for advanced crafting. Optional Auto-Dig in Settings.
- A 24-slot inventory, five-slot quickbar, stackable resources, equipped tools, body and hand gear.
- Hand-craft a **Workbench Kit** using Stone, place it, and interact with it to craft pickaxes, Hearth Kits, clothing and consumables.
- Climate based on world position and biome; hearths produce limited, overlapping heat rather than giving unlimited immunity to cold.
- Radial player and hearth lighting and dedicated pixel-art item icons.

## New in v3.6

- Removed direct gem-powered **Forge** and **Hearth** actions from the HUD. Those items are now crafted at workbenches.
- Added **ACT** and **INTERACT** controls. ACT mines when held and places selected crafting kits with a single press. E / Space / F provide desktop equivalents.
- Hand crafting only offers the Workbench Kit; interact with a placed station for other recipes.
- A Basic Pickaxe is equipped by default. Crafted Stone and Crystal Pickaxes are equipped from the Backpack. Existing tier-2/3 saves retain their pickaxe tier through migration.
- Added ambient cold and a **50-heat-output hearth** (with 7-block falloff), gear resistance and warmth recovery when shelter overcomes cold.
- Replaced square-cut player lighting and placeholder inventory letter tiles with a composited radial lighting system and item pixel art.

See [v3.6 release notes](docs/V3_6_SURVIVAL.md) and [architecture documentation](docs/ARCHITECTURE.md).

## World sizes

| World | Radius | Diameter |
| --- | ---: | ---: |
| Tiny | 1.6 km | 3.2 km |
| Small | 3.2 km | 6.4 km |
| Medium | 6.4 km | 12.8 km |
| Large | 12.8 km | 25.6 km |
| Huge | 25.6 km | 51.2 km |
| Real-Size Earth (experimental) | 6,371 km | 12,742 km |

World dimensions are Earth-scale in the last mode, but biome distribution, geology and travel speeds are intentionally game-like.

## Mobile controls

- **Thumbstick:** move. Movement does not mine unless Auto-Dig is enabled.
- **ACT:** hold to mine; tap to place a Workbench/Hearth Kit from the selected quick slot or use a consumable.
- **INTERACT:** open the workbench when standing nearby; inspect a hearth.
- **HAND:** make a Workbench Kit from Stone. **BAG:** inventory, equipment and quickbar organization. **MENU:** settings, saving and exit.
- **Keyboard:** WASD/arrows to move, Space/F for ACT, E to INTERACT, C for HAND, I/B for BAG, Esc for pause.

## Development

Node.js 22+:

```sh
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Automated validation runs on pull requests; pushes to `main` also build and publish GitHub Pages. The project uses React, TypeScript, Vite, Tailwind and browser IndexedDB.

## Save-data safety

World changes are chunk deltas; generated terrain is regenerated from its seed. Each world has its own inventory, equipment, position, explored edits and crafted stations. Existing worlds from v3.3-v3.5 load without an IndexedDB schema reset; old pickaxe tiers are restored into actual equipment.

**Important:** Browser data is local to each site and device. Clearing site data can remove worlds. Manual export/import and cloud backup are **not yet implemented**. Huge numbers of structures and player edits will require further storage performance profiling, especially on phones.

## Planned features

Precise building/block placement, storage chests, mining/interaction animations, more stations, equipment variety, biome-specific discoveries, advanced climate and fuel systems, and manual save export/import. These are planned - not represented as completed functionality.
