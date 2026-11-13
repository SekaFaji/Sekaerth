import { addItem, cloneInventory, countItem, type Inventory, type ItemId } from '../items/inventory.ts';

export type Ingredient = { id: ItemId; count: number };
export type Recipe = {
  id: string; name: string; description: string;
  ingredients: readonly Ingredient[];
  output: Ingredient;
  station: 'hand' | 'workbench';
};

/** Data-driven recipes: add future materials and stations here without touching UI logic. */
export const RECIPES: readonly Recipe[] = [
  { id: 'workbench', name: 'Workbench Kit', description: 'Place in an open tile to unlock workshop recipes nearby.', station: 'hand', output: { id: 'workbench_kit', count: 1 },
    ingredients: [{ id: 'stone', count: 16 }] },
  { id: 'tonic', name: 'Warm Tonic', description: 'Restores 35 warmth when consumed.', station: 'hand', output: { id: 'warm_tonic', count: 1 },
    ingredients: [{ id: 'bloom', count: 2 }, { id: 'crystal', count: 1 }] },
  { id: 'cloak', name: 'Root Cloak', description: 'Equip in Body slot to reduce warmth loss by 35%.', station: 'workbench', output: { id: 'root_cloak', count: 1 },
    ingredients: [{ id: 'fiber', count: 10 }, { id: 'bloom', count: 2 }] },
  { id: 'gloves', name: "Miner's Gloves", description: 'Equip in Hands slot for two damage per mining hit.', station: 'workbench', output: { id: 'miners_gloves', count: 1 },
    ingredients: [{ id: 'stone', count: 14 }, { id: 'crystal', count: 3 }] },
] as const;

export type CraftFailure = 'recipe' | 'station' | 'ingredients' | 'space';
export type CraftResult = { ok: true; inventory: Inventory } | { ok: false; reason: CraftFailure };
export function canCraft(inventory: Inventory, recipe: Recipe, nearWorkbench: boolean): CraftFailure | null {
  if (recipe.station === 'workbench' && !nearWorkbench) return 'station';
  if (recipe.ingredients.some(({ id, count }) => countItem(inventory, id) < count)) return 'ingredients';
  // All-or-nothing preview: output space is calculated AFTER consuming ingredients.
  let after = cloneInventory(inventory);
  for (const { id, count } of recipe.ingredients) {
    let needed = count;
    for (let i = 0; i < after.length && needed > 0; i++) {
      const slot = after[i];
      if (!slot || slot.id !== id) continue;
      const amount = Math.min(needed, slot.count);
      needed -= amount;
      after[i] = slot.count === amount ? null : { ...slot, count: slot.count - amount };
    }
    if (needed) return 'ingredients';
  }
  if (addItem(after, recipe.output.id, recipe.output.count).leftover) return 'space';
  return null;
}
export function craftItem(inventory: Inventory, recipeId: string, nearWorkbench: boolean): CraftResult {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return { ok: false, reason: 'recipe' };
  const reason = canCraft(inventory, recipe, nearWorkbench);
  if (reason) return { ok: false, reason };
  let next = cloneInventory(inventory);
  for (const { id, count } of recipe.ingredients) {
    let needed = count;
    for (let i = 0; i < next.length && needed > 0; i++) {
      const slot = next[i];
      if (!slot || slot.id !== id) continue;
      const amount = Math.min(needed, slot.count);
      needed -= amount;
      next[i] = slot.count === amount ? null : { ...slot, count: slot.count - amount };
    }
  }
  return { ok: true, inventory: addItem(next, recipe.output.id, recipe.output.count).inventory };
}
