import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { addItem, countItem, emptyInventory, type Inventory } from '../items/inventory.ts';
import { canCraft, craftItem, RECIPES } from './recipes.ts';
const stocked = (...items: [string, number][]): Inventory => items.reduce((bag,[id,count])=>addItem(bag,id as any,count).inventory,emptyInventory());
test('hand crafting consumes exact ingredients and yields exactly one station', () => {
  const bag = stocked(['stone',16]);
  const result=craftItem(bag,'workbench',false);
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(countItem(result.inventory,'workbench_kit'),1);
  assert.equal(countItem(result.inventory,'stone'),0);
  assert.equal(countItem(result.inventory,'fiber'),0);
  assert.equal(countItem(bag,'stone'),16); // inputs never mutated
});
test('workbench recipes require proximity and do not consume ingredients on failure', () => {
  const bag=stocked(['fiber',10],['bloom',2]);
  assert.deepEqual(craftItem(bag,'cloak',false),{ok:false,reason:'station'});
  const result=craftItem(bag,'cloak',true);
  assert.equal(result.ok,true);
  if (result.ok) assert.equal(countItem(result.inventory,'root_cloak'),1);
  assert.equal(countItem(bag,'bloom'),2);
});
test('cannot craft without ingredients or unknown recipe',()=>{
  assert.deepEqual(craftItem(emptyInventory(),'missing',true),{ok:false,reason:'recipe'});
  assert.deepEqual(craftItem(emptyInventory(),'tonic',true),{ok:false,reason:'ingredients'});
});
test('outputs require free capacity after ingredient consumption',()=>{
  const bag=stocked(['bloom',2],['crystal',1]);
  for(let i=2;i<24;i++)bag[i]={id:'root_cloak',count:1};
  assert.equal(canCraft(bag,RECIPES[1],false),null); // freeing input slots allows output
  bag[0]={id:'warm_tonic',count:10}; bag[1]={id:'workbench_kit',count:10};
  assert.equal(craftItem(bag,'tonic',false).ok,false);
});
test('repeated recipes respect limited stock',()=>{
  const b=stocked(['bloom',4],['crystal',2]);
  const a=craftItem(b,'tonic',false);assert.equal(a.ok,true);
  if(!a.ok)return;
  const c=craftItem(a.inventory,'tonic',false);assert.equal(c.ok,true);
  if(!c.ok)return;
  assert.equal(countItem(c.inventory,'warm_tonic'),2);
  assert.deepEqual(craftItem(c.inventory,'tonic',false),{ok:false,reason:'ingredients'});
});
