# Sekaerth v3.4 - Inventory and resource collection

## Scope
- Adds a separate, pure TypeScript item registry and inventory logic.
- 24 backpack slots, 5 quick slots, mobile touch selection and stack merging/swapping.
- Mining drops for stone, sand, roots, grass, hardstone, obsidian and crystal shards. Flowers are collected on contact.
- Warm Bloom restores 12 warmth; consumption works in backpack and quickbar.
- Gem currency continues to pay for pickaxes and hearths without modification.
- Protects drops when full and supports explicit confirmed discard for clearing space.
- Persists the inventory on each world's existing IDB metadata record; gameplay format v5, database schema version remains 1.

## Tests and backwards compatibility
- `npm test`: deterministic terrain/joystick and inventory rules, legacy migration, multiworld IDB saves.
- `npm run typecheck` and `npm run build` validate the React UI integration.
- Old worlds lacking the inventory field hydrate as an empty 24-slot backpack. No generated terrain IDs, seeds or save keys were changed.

## Limitations and next phase
- The quickbar currently selects the five top backpack slots and can consume Warm Blooms; general item use is for the upcoming crafting/building implementation.
- No craft recipes, workstations, equipment, dropped-item entities, inventory expansion or manual backups yet.
- Discard permanently removes the stack; no item object is created in the world.
- Very large worlds still need ongoing memory/storage profiling on physical mobile devices.
