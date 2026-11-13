import { addItem, canAddItem, cloneInventory, type Inventory, type ItemId } from './inventory.ts';

export type EquipmentSlot = 'body' | 'hands' | 'tool';
export type Equipment = Record<EquipmentSlot, ItemId | null>;
export const EMPTY_EQUIPMENT: Equipment = { body: null, hands: null, tool: 'starter_pick' };

/** A saved equipment ID is only valid in the slot explicitly assigned to it. */
export const EQUIPPABLE: Readonly<Partial<Record<ItemId, EquipmentSlot>>> = {
  starter_pick: 'tool',
  stone_pick: 'tool',
  crystal_pick: 'tool',
  root_cloak: 'body',
  miners_gloves: 'hands',
};
export function emptyEquipment(): Equipment { return { ...EMPTY_EQUIPMENT }; }
export function normalizeEquipment(source: unknown): Equipment {
  const result = emptyEquipment();
  if (!source || typeof source !== 'object') return result;
  const value = source as Record<string, unknown>;
  for (const slot of ['body', 'hands', 'tool'] as const) {
    const id = value[slot];
    if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(EQUIPPABLE, id) && EQUIPPABLE[id as ItemId] === slot)
      result[slot] = id as ItemId;
  }
  return result;
}

export type EquipmentChange = { inventory: Inventory; equipment: Equipment };
/** Equipping swaps a real item between bag and gear; never creates a duplicate. */
export function equipFromBag(inventory: Inventory, equipment: Equipment, index: number): EquipmentChange | null {
  if (!Number.isInteger(index) || index < 0 || index >= inventory.length) return null;
  const stack = inventory[index];
  if (!stack || stack.count !== 1) return null;
  const slot = EQUIPPABLE[stack.id];
  if (!slot) return null;
  const next = cloneInventory(inventory);
  next[index] = null;
  const previouslyEquipped = equipment[slot];
  if (previouslyEquipped) {
    const restored = addItem(next, previouslyEquipped, 1);
    if (restored.leftover) return null;
    return { inventory: restored.inventory, equipment: { ...equipment, [slot]: stack.id } };
  }
  return { inventory: next, equipment: { ...equipment, [slot]: stack.id } };
}
export function unequipToBag(inventory: Inventory, equipment: Equipment, slot: EquipmentSlot): EquipmentChange | null {
  if (slot === 'tool') return null; // A pick is required to mine. Replace it by equipping a new pick.
  const id = equipment[slot];
  if (!id || !canAddItem(inventory, id)) return null;
  const added = addItem(inventory, id, 1);
  if (added.leftover) return null;
  return { inventory: added.inventory, equipment: { ...equipment, [slot]: null } };
}
/** These bonuses do not change minimum pick tier requirements. */
export function digStrength(equipment: Equipment): number { return equipment.hands === 'miners_gloves' ? 2 : 1; }
export function coldDrainMultiplier(equipment: Equipment): number { return equipment.body === 'root_cloak' ? 0.65 : 1; }

/** Old saves kept the pick tier directly; restore it as actual equipment. */
export function restoreLegacyPick(equipment: Equipment, tier: number): Equipment {
  if (equipment.tool && equipment.tool !== 'starter_pick') return equipment;
  if (tier >= 3) return { ...equipment, tool: 'crystal_pick' };
  if (tier >= 2) return { ...equipment, tool: 'stone_pick' };
  return equipment;
}
export function equippedPickTier(equipment: Equipment): number {
  return equipment.tool === 'crystal_pick' ? 3 : equipment.tool === 'stone_pick' ? 2 : 1;
}
