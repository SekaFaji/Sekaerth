> Historical release note: v3.6 replaces the direct gem-powered Forge and Hearth actions with workbench crafting. See [V3_6_SURVIVAL.md](V3_6_SURVIVAL.md).

# Sekaerth v3.5 - Crafting and Equipment

Developed by SekaFaji Games.

## Gameplay

Open **CRAFT** in the HUD (keyboard `C`). Workbench Kits (16 Stone) and Warm Tonics are field recipes. This ensures a workbench can be crafted with materials available near the core. A Workbench Kit is a real inventory item: select it in BAG, then choose **Place Workbench** while standing in open air. The placement is stored as `T.WORKBENCH` in the existing modified chunk record, not as a separate global structure list. Players must remain within sqrt(5) tiles of the bench to access advanced recipes. `T.WORKBENCH` is passable so players cannot trap themselves.

At a bench players can craft the Root Cloak (body slot) and Miner's Gloves (hands slot). Pick tiers remain hard gates. The gloves double damage per mining strike but do not change required pick tier. The cloak multiplies cold decay by 0.65; nearby warmth sources are unaffected.

The new InventoryPanel exposes three scrollable mobile tabs (Backpack, Crafting, Equipment). New item registry entries live in `src/items/inventory.ts`, recipes in `src/crafting/recipes.ts`, and equipment logic in `src/items/equipment.ts`. Recipe transactions and equipment swaps are pure operations with unit tests. The current single-character pixel icons are placeholders, not final sprite art.

## Storage and migration

World metadata save format is 6, retaining the v1 IndexedDB schema and the same chunk format. Equipment is stored as `{body: ItemId|null, hands: ItemId|null}` under `WorldSave.equipment`. Existing v5 worlds load without equipment; `normalizeEquipment` defaults their slots to empty. No destructive migration occurs and legacy files remain untouched. Persisted benches are terrain edits, so existing chunk autosave logic handles them without writing entire worlds.

## Current limits

- Four starter recipes only; multi-ingredient station progression and recipe discovery are planned.
- General block placement, harvesting or recovering workbenches, item drops on ground and craft queue are not yet built.
- There is no equipment durability or gear visual on the character yet.
- Existing FORGE/Hearth gem purchases remain available to preserve v3.4 progression and players' saves.
