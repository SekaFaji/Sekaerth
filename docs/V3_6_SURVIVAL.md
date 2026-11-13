# Sekaerth v3.6 - Survival, Crafting and Interaction

**Developer: SekaFaji Games**

## Gameplay changes

- **Player lighting:** reusable 208 × 368 compositing mask; full-frame radial light holes for player and hearths. No small square fill rectangle around the character.
- **ACT:** Hold to mine the aimed block. If a Workbench Kit or Hearth Kit is selected in one of five quick slots, ACT places exactly one kit on the player's current open tile. With a Warm Bloom or Warm Tonic selected, ACT consumes it. Other items don't trigger an accidental discard.
- **INTERACT:** Opens workbench recipes only while standing near a placed workbench; a nearby hearth provides heat/cold information. E is the keyboard equivalent. Quickbar taps select an item rather than using it instantly.
- **Hand crafting:** Only the Workbench Kit (16 Stone). Workbench recipes: Hearth Kit, Stone Pickaxe, Crystal Pickaxe, Warm Tonic, Root Cloak, Miner's Gloves.
- **Pickaxe:** Every new player starts with an equipped Basic Pickaxe. New picks are crafted, enter inventory, then equipped through Backpack. Pre-v7 worlds with stored tier 2/3 pickaxes restore their equivalent equipped tool at load. No direct gem-purchase Forge.
- **Hearth:** Craft at workbench with 8 Stone and 2 Crystal Shards; place through ACT. Produces up to 50 heat, reduced at distance across a 7-block radius. Nearby hearth outputs sum. A single hearth does not negate extreme cold. The core emits baseline heat.
- **Cold:** Ambient cold rises outward and varies by biome, reaching hundreds of units in exposed areas. The HUD displays `COLD` and `HEAT`. Net cold determines warmth drain; warm shelter recovers warmth and a Root Cloak slows loss.
- **Auto-Dig:** Optional toggle under Settings, off by default. Move-only thumb control is otherwise unchanged. Existing saves, inventory and world modifications remain compatible.
- **Items:** Pixel-art silhouettes now replace the letter-based item tokens in backpack, crafting view and hotbar.

## Controls

Mobile: thumbstick to move, **ACT** to mine/place/use, **INTERACT** to open station, **HAND** to craft a basic workbench, **BAG** for items and gear.
Keyboard: WASD/arrows to move, **Space/F** to act, **E** to interact, **C** for hand crafting, **I/B** for backpack, **Esc** to pause.

## Compatibility and limitations

- Save metadata format v7 adds tool equipment; IndexedDB database schema remains unchanged. Legacy numeric pick tiers are preserved when loaded.
- Created hearth positions are still in the world metadata list rather than separate spatially indexed records. Large numbers of hearths may warrant indexing later.
- The climate model is a game mechanic based on radial depth and biome, not a scientifically accurate Earth weather simulation. Hearths do not yet burn fuel.
- This patch introduces **placeable stations**, not general block construction; full building will be a later update.
- Browser storage remains local. Manual export/import is not yet available; do not clear your browser's website data.
