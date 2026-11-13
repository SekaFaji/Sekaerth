import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ITEMS, emptyInventory, addItem, canAddItem, consumeSlot, moveSlot, countItem, dropForBlock, normalizeInventory, discardSlot, INVENTORY_SLOTS } from './inventory.ts';
import { T } from '../world/terrain.ts';

test('all mining tile drops are registered, with gems and bloom producing unique materials', () => {
  for (const tile of [T.ROCK,T.GEM,T.SAND,T.ROOT,T.HARD,T.OBSID,T.GRASS,T.FLOWER]) {
    const id = dropForBlock(tile);
    assert.ok(id && ITEMS[id]);
  }
  assert.equal(dropForBlock(T.AIR),null);
});
test('24-slot backpack adds items into matching stacks and overflow is returned', () => {
  const start = emptyInventory();
  const first = addItem(start,'stone',100);
  assert.equal(first.added,100);
  assert.deepEqual(first.inventory.slice(0,2),[{id:'stone',count:99},{id:'stone',count:1}]);
  assert.equal(start[0],null);
  const withMore = addItem(first.inventory, 'stone',98);
  assert.equal(withMore.inventory[1]?.count,99);
  assert.equal(countItem(withMore.inventory,'stone'),198);
  let filled=emptyInventory();
  filled=addItem(filled,'stone',INVENTORY_SLOTS*99).inventory;
  assert.equal(canAddItem(filled,'stone'),false);
  assert.equal(addItem(filled,'sand',1).leftover,1);
});
test('mobile two-tap moving swaps slots and merges without deleting items', () => {
  let bag=emptyInventory();
  bag[0]={id:'stone',count:40}; bag[1]={id:'stone',count:85}; bag[2]={id:'fiber',count:1};
  bag=moveSlot(bag,0,1);
  assert.deepEqual(bag.slice(0,2),[{id:'stone',count:26},{id:'stone',count:99}]);
  bag=moveSlot(bag,0,2);
  assert.deepEqual(bag.slice(0,3),[{id:'fiber',count:1},{id:'stone',count:99},{id:'stone',count:26}]);
  assert.equal(moveSlot(bag,4,3),bag);
});
test('consuming a warm bloom reduces count and clears empty stack', () => {
  const bag=emptyInventory();bag[4]={id:'bloom',count:2};
  const one=consumeSlot(bag,4)!;
  assert.deepEqual(one[4],{id:'bloom',count:1});
  assert.equal(consumeSlot(one,4)![4],null);
  assert.equal(consumeSlot(one,4,2),null);
});
test('old saves, malformed stacks and oversized counts normalize safely', () => {
  assert.deepEqual(normalizeInventory(undefined),emptyInventory());
  const bag=normalizeInventory([{id:'stone',count:500},{id:'bloom',count:4},{id:'unknown',count:3},{id:'stone',count:-5}]);
  assert.deepEqual(bag.slice(0,4),[{id:'stone',count:99},{id:'bloom',count:4},null,null]);
  assert.equal(bag.length,24);
});

test('full bags can recover free space by explicitly discarding a stack', () => {
  const full=addItem(emptyInventory(),'stone',INVENTORY_SLOTS*99).inventory;
  assert.equal(canAddItem(full,'sand'),false);
  const cleared=discardSlot(full,2);
  assert.equal(canAddItem(cleared,'sand'),true);
  assert.equal(full[2]?.count,99); // immutable, do not alter saved snapshots
});
