import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { addItem, countItem, emptyInventory } from './inventory.ts';
import { coldDrainMultiplier, digStrength, emptyEquipment, equipFromBag, normalizeEquipment, unequipToBag } from './equipment.ts';
test('equip and unequip move actual item without duplication',()=>{
  const bag=addItem(emptyInventory(),'miners_gloves',1).inventory;
  const result=equipFromBag(bag,emptyEquipment(),0);
  assert.ok(result);assert.equal(result.equipment.hands,'miners_gloves');
  assert.equal(countItem(result.inventory,'miners_gloves'),0);
  assert.equal(digStrength(result.equipment),2);
  const undo=unequipToBag(result.inventory,result.equipment,'hands');
  assert.ok(undo);assert.equal(countItem(undo.inventory,'miners_gloves'),1);
  assert.equal(undo.equipment.hands,null);
});
test('replacing equipped gear returns previous item without duplicating',()=>{
  const bag=addItem(emptyInventory(),'miners_gloves',1).inventory;
  const result=equipFromBag(bag,{body:null,hands:'miners_gloves'},0);
  assert.ok(result);assert.equal(countItem(result.inventory,'miners_gloves'),1);
  assert.equal(result.equipment.hands,'miners_gloves');
});
test('normalization rejects invalid gear and warmth bonus applies only when worn',()=>{
  assert.deepEqual(normalizeEquipment({hands:'stone',body:'miners_gloves'}),emptyEquipment());
  assert.equal(coldDrainMultiplier({hands:null,body:'root_cloak'}),0.65);
});
test('cannot unequip into full inventory',()=>{
  const bag=emptyInventory().map(()=>({id:'stone' as const,count:99}));
  assert.equal(unequipToBag(bag,{body:'root_cloak',hands:null},'body'),null);
});
