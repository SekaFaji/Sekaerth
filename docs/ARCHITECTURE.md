# Sekaerth architecture - v3.3

## Current modules

- `src/world/terrain.ts` - **stable procedural rules**, block IDs, hardness, world sizes, noise and biomes. Preserve old values when possible: changing generation can alter existing worlds.
- `src/world/World.ts` - deterministic 16×16 terrain generation, sparse edits/damage and bounded render chunk cache. Stored overrides are loaded lazily.
- `src/persistence/worldDb.ts` - indexed world records, per-world keyed modified chunks, atomic transactions, deletion and legacy localStorage migration. All storage access is asynchronous.
- `src/ui/joystick.ts` - touch input normalization and eight-way movement selection.
- `src/SekaerthGame.tsx` - remaining gameplay loop, HUD, interaction and rendering. Future patches should extract features into testable modules rather than growing this component.

## IndexedDB schema version 1

Database: `sekaerth-worlds-v1`

| Object store | Key | Purpose |
|---|---|---|
| `worlds` | `id` | One versioned `WorldSave` record with name, planet settings, coordinates, warmth, gems, pick and hearth positions |
| `chunks` | `[worldId, key]` | One sparse edit/damage record per modified 16×16 chunk, indexed by `worldId` |

The `WorldSave.v` value is currently **4** and distinguishes gameplay save format from the IndexedDB schema version. An update to either should include migrations/tests.

Each chunk uses `key = cx + ',' + cy` where `cx = floor(x / 16)` and `cy = floor(y / 16)`. Negative coordinates are supported. A `StoredChunk` contains flat `[tileIndex, value, ...]` arrays for `edits` and `dmg`. Only changes relative to base terrain need to be stored. An empty sparse record deletes its row.

## Save lifecycle

1. World creation writes the metadata record before gameplay begins.
2. Mining/hearths/sand mark chunk revisions dirty in the world state; player progress also changes metadata.
3. Every 5 seconds and on pause/page-hide, `saveRun` captures the current small metadata snapshot and current dirty chunk snapshots.
4. A serial promise queue commits each snapshot as an **atomic transaction** (`worlds` + `chunks`). Dirty revisions are cleared only after transaction success and only if they still match the captured version.
5. A write failure reports a storage error and leaves chunks dirty for retry. No old localStorage save is deleted.
6. On world selection, the game loads metadata and **only the index of changed chunk keys**. It then hydrates nearby changed chunk data before allowing movement. Distant changed data remains on disk until approached.
7. Accessing an unhydrated modified chunk returns `PENDING`, represented as dark rock. Physics and mining cannot alter it until the saved delta is present. A failed load remains blocked rather than silently returning incorrect generated terrain.

**Durability warning:** Browser page termination may cancel asynchronous saves. Page-hide triggers a best-effort save, but the committed autosave is the durable checkpoint. Closing a tab immediately after mining can lose up to the autosave interval. “Save + Quit” awaits the save transaction. Quota errors should be surfaced, never swallowed.

## Memory model

- `World.chunks`: LRU cap of 256 generated/rendered chunk arrays, regardless of planet radius.
- `World.edits`/`World.dmg`: sparse overrides for currently loaded chunks and unsaved dirty chunks. Clean maps are evicted with their render chunk.
- `World.storedKeys`: one key per modified chunk stored in IndexedDB. This is the **remaining unbounded key-only index**. Large-world optimizations can use spatial indexes and async range queries when profiling demands it.
- World radius and seed are persisted. **No pristine terrain tiles are saved**.

## Legacy compatibility

- The old save under `sekaerth-run-v1` or `sunward-run-v1` (including v2/v3) imports once into ID `legacy-import-v4`, named `Recovered World`.
- Existing original save keys are retained untouched to protect against import failures. This migration only works on the **same web origin**; it cannot access another domain's browser storage.
- The successful migration flag `sekaerth-legacy-migrated-v4` prevents duplicate imports.
- If import fails due to corruption/quota, the old save remains in place. Do not erase it.

## Extension points / next patches

- `items/`: shared typed item registry and stack rules, independent from visuals.
- `inventory/`: inventory stacks, equipment slots, selected quickslot, versioned save fragment.
- `crafting/`: recipe definitions, station requirements and deterministic consume/produce transactions.
- `systems/mining`: mining drops and durability, consuming tile IDs from `terrain`.
- `systems/building`: block placement and interactions, recorded as sparse changes.
- `rendering/`: extract tile drawing, weather and particles from the React component.
- `persistence/`: world backups/import/export, transactional snapshot / backups, chunk payload compaction and mobile quota monitoring.

Any new persistent gameplay field must have a default for migrated saves and a test for older save versions. No feature should require eagerly materializing an entire planet.
