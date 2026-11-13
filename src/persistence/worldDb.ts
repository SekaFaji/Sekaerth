import type { WorldSize } from '../world/terrain.ts';
import type { ChunkDelta, StoredChunk } from '../world/World.ts';
import { normalizeInventory, type Inventory } from '../items/inventory.ts';
import type { Equipment } from '../items/equipment.ts';

export const SAVE_FORMAT = 7;
export const DB_NAME = 'sekaerth-worlds-v1';
export const LEGACY_KEYS = ['sekaerth-run-v1', 'sunward-run-v1'] as const;
const MIGRATED_KEY = 'sekaerth-legacy-migrated-v4';
const WORLD_STORE = 'worlds', CHUNK_STORE = 'chunks';

/** A small record per world; each chunk lives in its own indexed record. */
export type WorldSave = {
  id: string; name: string; v: number; size: WorldSize; seed: number;
  createdAt: number; updatedAt: number; won: boolean;
  px: number; py: number; facing: number; pick: number; warmth: number;
  gems: number; time: number; hearths: { x: number; y: number }[];
  /** Optional for v4 saves; normalize on load without rewriting old data. */
  inventory?: Inventory;
  /** Equipment now includes a pickaxe slot (v7). Old worlds still load via normalization. */
  equipment?: Equipment;
};

let databasePromise: Promise<IDBDatabase> | undefined;
function openDb(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is unavailable in this browser')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORLD_STORE)) db.createObjectStore(WORLD_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunks = db.createObjectStore(CHUNK_STORE, { keyPath: ['worldId', 'key'] });
        chunks.createIndex('worldId', 'worldId', { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Cannot open the world database'));
    request.onblocked = () => reject(new Error('Close other Sekaerth tabs to upgrade storage'));
  }).catch((error) => { databasePromise = undefined; throw error; });
  return databasePromise;
}
function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('World data read failed'));
  });
}
function done(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('World storage write failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('World storage transaction aborted'));
  });
}

export async function listWorlds(): Promise<WorldSave[]> {
  const db = await openDb();
  const tx = db.transaction(WORLD_STORE, 'readonly');
  const data = await req(tx.objectStore(WORLD_STORE).getAll() as IDBRequest<WorldSave[]>);
  return data.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function readWorld(id: string): Promise<WorldSave | undefined> {
  const db = await openDb();
  return req(db.transaction(WORLD_STORE, 'readonly').objectStore(WORLD_STORE).get(id));
}
export async function readChunk(worldId: string, key: string): Promise<StoredChunk | undefined> {
  const db = await openDb();
  return req(db.transaction(CHUNK_STORE, 'readonly').objectStore(CHUNK_STORE).get([worldId, key]));
}
/** Reads only the primary keys, not each full modification payload. */
export async function listModifiedKeys(worldId: string): Promise<Set<string>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const result = new Set<string>();
    const tx = db.transaction(CHUNK_STORE, 'readonly');
    const cursor = tx.objectStore(CHUNK_STORE).index('worldId').openKeyCursor(IDBKeyRange.only(worldId));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) { result.add((c.primaryKey as [string, string])[1]); c.continue(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error('Cannot read chunk index'));
    tx.onabort = () => reject(tx.error ?? new Error('Chunk index read aborted'));
  });
}

/** Atomically commit player metadata together with only the modified chunks. */
export async function writeWorld(meta: WorldSave, changes: ChunkDelta[] = []): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([WORLD_STORE, CHUNK_STORE], 'readwrite');
  const completed = done(tx); // attach transaction handlers before making requests
  tx.objectStore(WORLD_STORE).put(meta);
  const store = tx.objectStore(CHUNK_STORE);
  for (const chunk of changes) {
    if (chunk.edits.length || chunk.dmg.length)
      store.put({ worldId: meta.id, key: chunk.key, edits: chunk.edits, dmg: chunk.dmg } satisfies StoredChunk);
    else store.delete([meta.id, chunk.key]);
  }
  await completed;
}
export async function removeWorld(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([WORLD_STORE, CHUNK_STORE], 'readwrite');
  const completed = done(tx);
  const chunks = tx.objectStore(CHUNK_STORE);
  const cursor = chunks.index('worldId').openCursor(IDBKeyRange.only(id));
  cursor.onsuccess = () => { const entry = cursor.result; if (entry) { entry.delete(); entry.continue(); } };
  tx.objectStore(WORLD_STORE).delete(id);
  await completed;
}

function legacyChunkPairs(input: unknown): number[] {
  if (!input || typeof input !== 'object') return [];
  const pairs: number[] = [];
  for (const [index, value] of Object.entries(input)) {
    const i = Number(index), v = Number(value);
    if (Number.isInteger(i) && i >= 0 && i < 256 && Number.isFinite(v)) pairs.push(i, v);
  }
  return pairs;
}
const VALID_SIZES = new Set<WorldSize>(['tiny', 'small', 'medium', 'large', 'huge', 'earth']);
function safeNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
/** One-time non-destructive import. Original localStorage data is never removed. */
export async function migrateLegacyWorld(): Promise<'imported' | 'already-imported' | 'none'> {
  if (typeof localStorage === 'undefined') return 'none';
  try { if (localStorage.getItem(MIGRATED_KEY) === 'ok') return 'already-imported'; } catch { return 'none'; }
  let raw: string | null = null;
  for (const key of LEGACY_KEYS) {
    try { raw = localStorage.getItem(key); } catch { /* disabled localStorage */ }
    if (raw) break;
  }
  if (!raw) { try { localStorage.setItem(MIGRATED_KEY, 'ok'); } catch { /* ignore */ } return 'none'; }
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw); } catch { throw new Error('The old save is damaged. It was kept in localStorage for recovery.'); }
  const id = 'legacy-import-v4';
  if (await readWorld(id)) {
    try { localStorage.setItem(MIGRATED_KEY, 'ok'); } catch { /* ignore */ }
    return 'already-imported';
  }
  const now = Date.now();
  const size = VALID_SIZES.has(input.size as WorldSize) ? input.size as WorldSize : 'tiny';
  const hearths = Array.isArray(input.hearths) ? input.hearths.filter((h): h is {x: number; y: number} =>
    h && Number.isSafeInteger(h.x) && Number.isSafeInteger(h.y)) : [{ x: 0, y: 0 }];
  const world: WorldSave = {
    id, name: 'Recovered World', v: SAVE_FORMAT, size,
    seed: Number.isSafeInteger(input.seed) ? input.seed as number : 0,
    createdAt: now, updatedAt: now, won: Boolean(input.won),
    px: safeNumber(input.px, 0), py: safeNumber(input.py, -1),
    facing: safeNumber(input.facing, 1), pick: safeNumber(input.pick, 1),
    warmth: safeNumber(input.warmth, 100), gems: safeNumber(input.gems, 0),
    time: safeNumber(input.time, 0), hearths: hearths.length ? hearths : [{x:0,y:0}],
    inventory: normalizeInventory(input.inventory),
  };
  const edits = (input.edits && typeof input.edits === 'object' ? input.edits : {}) as Record<string, unknown>;
  const dmg = (input.dmg && typeof input.dmg === 'object' ? input.dmg : {}) as Record<string, unknown>;
  const changes: ChunkDelta[] = [];
  for (const key of new Set([...Object.keys(edits), ...Object.keys(dmg)])) {
    if (!/^-?\d+,-?\d+$/.test(key)) continue;
    const e = legacyChunkPairs(edits[key]), d = legacyChunkPairs(dmg[key]);
    if (e.length || d.length) changes.push({key, edits:e, dmg:d, revision:0});
  }
  await writeWorld(world, changes);
  try { localStorage.setItem(MIGRATED_KEY, 'ok'); } catch { /* ignore */ }
  return 'imported';
}

export function newWorldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'world-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch { return null; }
}
