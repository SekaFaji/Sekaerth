import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import { World } from '../world/World.ts';
import { T } from '../world/terrain.ts';
import { SAVE_FORMAT, migrateLegacyWorld, listWorlds, readWorld, readChunk, writeWorld, listModifiedKeys, removeWorld } from './worldDb.ts';

// Browser localStorage is separate from IndexedDB and must remain untouched by migration.
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
  removeItem: (key: string) => { values.delete(key); },
}});

test('v2/v3 localStorage world imports once without deleting originals', async () => {
  localStorage.setItem('sekaerth-run-v1', JSON.stringify({
    v: 3, size:'medium', seed: 46, px: -30, py: 3, gems: 22, pick: 2, warmth: 52,
    hearths: [{x:0,y:0}], edits: {'-2,0': {'12': 0}}, dmg: {'-2,0': {'10': 3}},
  }));
  assert.equal(await migrateLegacyWorld(),'imported');
  assert.ok(localStorage.getItem('sekaerth-run-v1'));
  const imported=await readWorld('legacy-import-v4');
  assert.ok(imported);
  assert.equal(imported.size, 'medium');
  assert.equal(imported.gems,22);
  assert.deepEqual((await readChunk(imported.id,'-2,0'))?.edits,[12,0]);
  assert.equal(await migrateLegacyWorld(),'already-imported');
});

test('writes only touched chunks, loads lazily and deletes one world independently', async () => {
  const world=new World('earth',314159);
  const original=world.get(40,40);
  const changed=original===T.AIR ? T.ROCK : T.AIR;
  world.set(40,40,changed);
  world.addDmg(41,41,2);
  const dirty=world.dirtyChunks();
  assert.equal(dirty.length,1);
  const meta={v:SAVE_FORMAT,id:'test-earth',name:'Vast Planet',size:'earth' as const,seed:314159,
    px:40,py:40,facing:1,pick:1,warmth:75,gems:4,time:3,won:false,
    hearths:[{x:0,y:0}],createdAt:Date.now(),updatedAt:Date.now()};
  await writeWorld(meta, dirty);
  world.acknowledgeSaved(dirty);
  assert.equal(world.getDirtyCount(),0);
  assert.equal((await listModifiedKeys(meta.id)).size,1);
  assert.equal((await listWorlds()).length,2);
  const restored=new World('earth',314159);
  restored.connectStorage(await listModifiedKeys(meta.id),(key)=>readChunk(meta.id,key));
  assert.equal(restored.get(40,40),T.PENDING);
  await restored.preload(2,2,0);
  assert.equal(restored.get(40,40),changed);
  assert.equal(restored.getDmg(41,41),2);
  assert.equal(restored.get(0,20),restored.baseTile(0,20));
  await removeWorld(meta.id);
  assert.equal(await readWorld(meta.id),undefined);
  assert.equal((await listModifiedKeys(meta.id)).size,0);
  assert.equal((await listWorlds()).length,1);
});
