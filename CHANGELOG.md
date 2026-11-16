# Changelog

Sekaerth is developed by **SekaFaji Games**. This changelog summarizes shipped milestones; detailed research and architecture notes live under `docs/`.

## 3.6.2 - Adaptive landscape and fullscreen

- Remove fixed 420px portrait stage cap; the game now fills the available screen.
- Responsive internal camera shows more tiles across when rotated without distorting sprites.
- Compact landscape HUD, repositioned quickbar and action controls.
- Fullscreen entry and exit from title, pause and Settings, with capability/failure feedback.
- Viewport layout regression tests; no world save format or gameplay logic changes.

## 3.6.1 - Repository maintenance

- Extracted sound, rendered tile assets, character pixels, icon components and preferences from the main game component.
- Added regression coverage for asset creation and legacy preference migration.
- Standardized the project checks and added contributor guidance.
- No intentional changes to game mechanics, save formats or controls.

## 3.6 - Survival and interaction

- Added ACT and INTERACT, workbench-based crafting, environmental cold and finite hearth heat.
- Updated light compositing and inventory item artwork.

## 3.5 - Crafting and equipment

- Added workbench recipes, wearable gear and equipment persistence.

## 3.4 - Inventory and resources

- Added inventory slots, quick slots, stackable mining drops and consumables.

## 3.3 - World storage foundation

- Added named worlds and independent chunk-based IndexedDB saves with legacy migration.

## 3.2 - Mobile controls

- Added mobile thumbstick and a compact HUD.

## 3.1 - World selection

- Added six planet sizes and the Sekaerth identity.
