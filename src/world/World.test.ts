import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { World } from './World.ts';
import { CHUNK, T } from './terrain.ts';

test('planet generation remains deterministic across all sizes and seeds', () => {
  for (const size of ['tiny', 'small', 'medium', 'large', 'huge', 'earth'] as const) {
    const a = new World(size, 826184), b = new World(size, 826184);
    for (const [x,y] of [[0,0],[10,-7],[230,33],[-37,-96],[4,402]])
      assert.equal(a.get(x,y), b.get(x,y));
  }
  assert.equal(new World('earth').radius, 6371000);
});

test('only edited chunks are dirty and edits reverse back to procedural terrain', () => {
  const world = new World('tiny', 23);
  const x = 27, y = 8, base = world.get(x,y);
  world.set(x,y, base===T.AIR?T.ROCK:T.AIR);
  assert.equal(world.dirtyChunks().length,1);
  assert.equal(world.dirtyChunks()[0].edits.length,2);
  world.set(x,y,base);
  assert.equal(world.dirtyChunks()[0].edits.length,0);
  const current = world.dirtyChunks();
  world.acknowledgeSaved(current);
  assert.equal(world.getDirtyCount(),0);
  assert.equal(world.storedKeys.size,0);
});

test('acknowledging an earlier save does not drop newer changes in the same chunk', () => {
  const world = new World();
  world.set(25,25,T.AIR);
  const first = world.dirtyChunks();
  world.set(26,25,T.AIR);
  world.acknowledgeSaved(first);
  assert.equal(world.getDirtyCount(),1);
  const second = world.dirtyChunks();
  world.acknowledgeSaved(second);
  assert.equal(world.getDirtyCount(),0);
});

test('edited chunks hydrate lazily, unedited chunks generate instantly', async () => {
  let requests = 0;
  const world = new World();
  world.connectStorage(['-1,1'], async key => { requests++; await Promise.resolve(); return { worldId:'test',key,edits:[3,T.AIR],dmg:[3,2] }; });
  const targetX=-CHUNK+3, targetY=CHUNK;
  assert.equal(world.get(targetX,targetY),T.PENDING);
  assert.equal(world.get(4,40),world.baseTile(4,40));
  assert.equal(world.get(targetX,targetY),T.PENDING);
  await world.preload(-1,1,0);
  assert.equal(world.get(targetX,targetY),T.AIR);
  assert.equal(world.getDmg(targetX,targetY),2);
  assert.equal(requests,1);
});

test('a failed chunk load remains inaccessible rather than silently regenerating', async () => {
  const world = new World();
  const old = console.error;
  console.error = () => {};
  try {
    world.connectStorage(['1,1'], async () => { throw new Error('simulated storage outage'); });
    assert.equal(world.get(17,17),T.PENDING);
    await world.preload(1,1,0);
    assert.ok(world.hasReadError());
    assert.equal(world.get(17,17),T.PENDING);
    world.set(17,17,T.AIR);
    assert.equal(world.getDirtyCount(),0);
  } finally { console.error=old; }
});

test('render-cache stays bounded even with an Earth-radius coordinate', () => {
  const world = new World('earth', 1);
  for (let i=0;i<1000;i++) world.get(i * CHUNK, 200);
  assert.ok(world.chunks.size<=256);
});


test('placed workbench persists as a passable modified chunk and hydrates after save', async () => {
  const world = new World('tiny', 25);
  const x = 3, y = -3;
  world.set(x, y, T.WORKBENCH);
  const dirty = world.dirtyChunks();
  assert.equal(dirty.length, 1);
  const key = dirty[0].key;
  const restored = new World('tiny', 25);
  restored.connectStorage(new Set([key]), async () => ({worldId:'test', key, edits:dirty[0].edits, dmg:dirty[0].dmg}));
  assert.equal(restored.get(x, y), T.PENDING);
  await restored.preload(Math.floor(x/16),Math.floor(y/16),0);
  assert.equal(restored.get(x,y),T.WORKBENCH);
});
