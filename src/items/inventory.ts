import { T } from '../world/terrain.ts';

/** Data-driven item registry. World/block IDs never act as inventory indices. */
export const ITEMS = {
  stone: { name: 'Stone', category: 'Block', maxStack: 99, color: '#949aa3', symbol: 'ST', description: 'Every miner needs stone. A future building material.' },
  sand: { name: 'Sand', category: 'Block', maxStack: 99, color: '#e1b77f', symbol: 'SA', description: 'Soft, loose sand collected underground.' },
  fiber: { name: 'Root Fiber', category: 'Material', maxStack: 99, color: '#b88251', symbol: 'RF', description: 'Fibers from the ancient roots. For future recipes.' },
  soil: { name: 'Surface Soil', category: 'Block', maxStack: 99, color: '#8ba265', symbol: 'SO', description: 'A bit of the planet’s living surface.' },
  hardstone: { name: 'Hardstone', category: 'Material', maxStack: 99, color: '#889bb2', symbol: 'HS', description: 'Dense stone from armored deposits.' },
  obsidian: { name: 'Obsidian', category: 'Material', maxStack: 99, color: '#a78ac7', symbol: 'OB', description: 'Rare glassy stone. Requires a tier 3 pick.' },
  crystal: { name: 'Crystal Shard', category: 'Material', maxStack: 99, color: '#7fdee0', symbol: 'CR', description: 'A crafting shard from gem veins. Gems remain upgrade currency.' },
  bloom: { name: 'Warm Bloom', category: 'Consumable', maxStack: 20, color: '#f78e9f', symbol: 'WB', description: 'Use to restore 12 warmth, up to 100.' },
} as const;
export type ItemId = keyof typeof ITEMS;
export type ItemStack = { id: ItemId; count: number };
export type Inventory = (ItemStack | null)[];
export const INVENTORY_SLOTS = 24;
export const HOTBAR_SLOTS = 5;

export const BLOCK_DROPS: Readonly<Partial<Record<number, ItemId>>> = {
  [T.ROCK]: 'stone', [T.SAND]: 'sand', [T.ROOT]: 'fiber',
  [T.GRASS]: 'soil', [T.HARD]: 'hardstone', [T.OBSID]: 'obsidian',
  [T.GEM]: 'crystal', [T.FLOWER]: 'bloom',
};
export function dropForBlock(tile: number): ItemId | null { return BLOCK_DROPS[tile] ?? null; }
export function emptyInventory(): Inventory { return Array.from({ length: INVENTORY_SLOTS }, () => null); }
export function cloneInventory(inventory: Inventory): Inventory {
  return inventory.map((stack) => stack ? { ...stack } : null);
}
const known = (id: unknown): id is ItemId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, id);
/** Invalid or future-unknown entries are ignored; old saves with no inventory remain valid. */
export function normalizeInventory(input: unknown): Inventory {
  const slots = emptyInventory();
  if (!Array.isArray(input)) return slots;
  for (let index = 0; index < Math.min(slots.length, input.length); index++) {
    const stack = input[index];
    if (!stack || typeof stack !== 'object' || !known(stack.id) ||
        !Number.isSafeInteger(stack.count) || stack.count <= 0) continue;
    slots[index] = { id: stack.id, count: Math.min(stack.count, ITEMS[stack.id].maxStack) };
  }
  return slots;
}
export function usedSlots(inventory: Inventory): number { return inventory.filter(Boolean).length; }
export function countItem(inventory: Inventory, id: ItemId): number {
  return inventory.reduce((count, stack) => count + (stack?.id === id ? stack.count : 0), 0);
}
export function freeCapacity(inventory: Inventory, id: ItemId): number {
  const max = ITEMS[id].maxStack;
  return inventory.reduce((capacity, stack) => capacity + (stack === null ? max : stack.id === id ? max - stack.count : 0), 0);
}
export function canAddItem(inventory: Inventory, id: ItemId, count = 1): boolean {
  return Number.isSafeInteger(count) && count > 0 && freeCapacity(inventory, id) >= count;
}
/** Pure insertion - fills existing matching stacks before using empty slots. */
export function addItem(inventory: Inventory, id: ItemId, count: number): { inventory: Inventory; added: number; leftover: number } {
  if (!Number.isSafeInteger(count) || count <= 0) return { inventory, added: 0, leftover: count };
  const slots = cloneInventory(inventory);
  let remaining = count;
  const max = ITEMS[id].maxStack;
  for (const stack of slots) {
    if (stack?.id !== id || stack.count >= max) continue;
    const taken = Math.min(max - stack.count, remaining);
    stack.count += taken; remaining -= taken;
    if (!remaining) break;
  }
  for (let i = 0; i < slots.length && remaining; i++) {
    if (slots[i]) continue;
    const taken = Math.min(max, remaining);
    slots[i] = { id, count: taken }; remaining -= taken;
  }
  return { inventory: slots, added: count - remaining, leftover: remaining };
}
/** Pure single-stack withdrawal, useful for a consumable or a future crafting transaction. */
export function consumeSlot(inventory: Inventory, slot: number, count = 1): Inventory | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SLOTS || !Number.isSafeInteger(count) || count <= 0) return null;
  const old = inventory[slot];
  if (!old || old.count < count) return null;
  const result = cloneInventory(inventory);
  result[slot] = old.count === count ? null : { ...old, count: old.count - count };
  return result;
}
/** Tap one slot, then another to swap or combine matching stacks. */
export function moveSlot(inventory: Inventory, from: number, to: number): Inventory {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= INVENTORY_SLOTS || to < 0 || to >= INVENTORY_SLOTS || from === to || !inventory[from]) return inventory;
  const slots = cloneInventory(inventory);
  const source = slots[from]!;
  const dest = slots[to];
  if (dest?.id === source.id) {
    const moved = Math.min(ITEMS[source.id].maxStack - dest.count, source.count);
    if (moved <= 0) return inventory;
    dest.count += moved;
    slots[from] = moved === source.count ? null : { ...source, count: source.count - moved };
  } else {
    slots[from] = dest;
    slots[to] = source;
  }
  return slots;
}

/** Explicit inventory cleanup; never called automatically when collecting resources. */
export function discardSlot(inventory: Inventory, index: number): Inventory {
  if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SLOTS || !inventory[index]) return inventory;
  const result = cloneInventory(inventory);
  result[index] = null;
  return result;
}
