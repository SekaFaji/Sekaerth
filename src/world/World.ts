import { CHUNK, T, WORLD_SIZE_BY_ID, type WorldSize, hash2, vnoise } from './terrain.ts';

/** Only sparse player-made deltas are persisted. Generated terrain is never stored. */
export type ChunkDelta = { key: string; edits: number[]; dmg: number[]; revision: number };
export type StoredChunk = { worldId: string; key: string; edits: number[]; dmg: number[] };
const CACHE_LIMIT = 256;
const UNLOADED = new Int8Array(CHUNK * CHUNK).fill(T.PENDING);

function unpack(pairs: number[]): Map<number, number> {
  const result = new Map<number, number>();
  if (!Array.isArray(pairs)) return result;
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const index = pairs[i], value = pairs[i + 1];
    if (Number.isInteger(index) && index >= 0 && index < CHUNK * CHUNK && Number.isFinite(value)) result.set(index, value);
  }
  return result;
}
function pack(map?: Map<number, number>): number[] {
  const result: number[] = [];
  for (const [i, t] of map ?? []) result.push(i, t);
  return result;
}

export class World {
  readonly size: WorldSize;
  readonly radius: number;
  readonly seed: number;
  // LRU render cache, and a separate bounded, lazy cache of chunk modifications.
  readonly chunks = new Map<string, Int8Array>();
  readonly edits = new Map<string, Map<number, number>>();
  readonly dmg = new Map<string, Map<number, number>>();
  readonly storedKeys = new Set<string>();
  private readonly loaded = new Set<string>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly failed = new Set<string>();
  private readonly revisions = new Map<string, number>();
  private readonly dirty = new Set<string>();
  private loader?: (key: string) => Promise<StoredChunk | undefined>;
  hearths: { x: number; y: number }[] = [{ x: 0, y: 0 }];

  constructor(size: WorldSize = 'tiny', seed = 0) {
    this.size = size;
    this.radius = WORLD_SIZE_BY_ID[size].radius;
    this.seed = seed;
  }

  key(cx: number, cy: number) { return cx + ',' + cy; }
  /** Configure lazy restoration after obtaining a key-only index from IndexedDB. */
  connectStorage(keys: Iterable<string>, loader: (key: string) => Promise<StoredChunk | undefined>) {
    this.storedKeys.clear();
    for (const key of keys) this.storedKeys.add(key);
    this.loader = loader;
  }

  private markDirty(key: string) {
    this.dirty.add(key);
    this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    this.loaded.add(key);
    // A newly edited chunk must be treated as known-persistent by lazy restoration.
    this.storedKeys.add(key);
  }
  private loadChunk(key: string) {
    if (this.loading.has(key) || this.failed.has(key) || !this.loader) return;
    const promise = this.loader(key).then((row) => {
      // A chunk must not be overwritten by a late IO response if edited in the meantime.
      if (!this.dirty.has(key)) {
        if (row?.edits?.length) this.edits.set(key, unpack(row.edits));
        else this.edits.delete(key);
        if (row?.dmg?.length) this.dmg.set(key, unpack(row.dmg));
        else this.dmg.delete(key);
      }
      if (!row) this.storedKeys.delete(key);
      this.loaded.add(key);
      this.chunks.delete(key);
    }).catch((error) => {
      console.error('Failed to load world chunk', key, error);
      this.failed.add(key); // Stay blocked; never treat unknown edited terrain as pristine.
    }).finally(() => { this.loading.delete(key); });
    this.loading.set(key, promise);
  }
  async preload(cx: number, cy: number, radius = 2) {
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      const key = this.key(x, y);
      if (this.storedKeys.has(key) && !this.loaded.has(key)) this.loadChunk(key);
    }
    await Promise.all([...this.loading.values()]);
  }
  hasReadError() { return this.failed.size > 0; }

  getDmg(x: number, y: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    return this.dmg.get(this.key(cx, cy))?.get((y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)) ?? 0;
  }
  addDmg(x: number, y: number, amount: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const key = this.key(cx, cy);
    const index = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
    if (this.chunk(cx, cy)[index] === T.PENDING) return 0;
    let data = this.dmg.get(key);
    if (!data) { data = new Map(); this.dmg.set(key, data); }
    const next = (data.get(index) ?? 0) + amount;
    data.set(index, next);
    this.markDirty(key);
    return next;
  }
  clearDmg(x: number, y: number) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const key = this.key(cx, cy);
    const map = this.dmg.get(key);
    if (map?.delete((y - cy * CHUNK) * CHUNK + (x - cx * CHUNK))) {
      if (map.size === 0) this.dmg.delete(key);
      this.markDirty(key);
    }
  }
  baseTile(x: number, y: number): number {
    const r = Math.hypot(x, y);
    if (r > this.radius + 1) return T.AIR;
    if (r >= this.radius - 2) return T.GRASS;
    if (r < 12) return r === 0 ? T.HEARTH : T.AIR;
    const shell = r > this.radius - 24;
    const sx = this.seed % 10007, sy = Math.floor(this.seed / 10007);
    const n = 0.55 * vnoise(x / 34 + sx, y / 34 + sy) +
      0.45 * vnoise(x / 11 + 100 + sx, y / 11 + 100 + sy);
    if (n > (shell ? 0.72 : 0.6)) return T.AIR;
    const d = r / this.radius;
    const h = hash2(x + sx, y + sy);
    const h2 = hash2(x * 3 + 7 + sx, y * 5 + 11 + sy);
    if (d >= 0.05 && d < 0.5 && h2 < 0.1) return T.HARD;
    if (d >= 0.3 && d < 0.6 && h2 > 0.94) return T.OBSID;
    if (d >= 0.3 && d < 0.55 && h < 0.05) return T.GEM;
    if (d >= 0.55 && d < 0.75 && h < 0.09) return T.SAND;
    if (d >= 0.75 && d < 0.92 && h < 0.08) return T.ROOT;
    if (d < 0.3 && h < 0.015) return T.FLOWER;
    if (h > 0.996) return T.GEM;
    return T.ROCK;
  }
  chunk(cx: number, cy: number): Int8Array {
    const key = this.key(cx, cy);
    const cached = this.chunks.get(key);
    if (cached) {
      this.chunks.delete(key); this.chunks.set(key, cached);
      return cached;
    }
    if (this.storedKeys.has(key) && !this.loaded.has(key)) {
      this.loadChunk(key);
      return UNLOADED;
    }
    const chunk = new Int8Array(CHUNK * CHUNK);
    for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++)
      chunk[y * CHUNK + x] = this.baseTile(cx * CHUNK + x, cy * CHUNK + y);
    for (const [index, tile] of this.edits.get(key) ?? []) chunk[index] = tile;
    for (const h of this.hearths) {
      if (Math.floor(h.x / CHUNK) === cx && Math.floor(h.y / CHUNK) === cy)
        chunk[(h.y - cy * CHUNK) * CHUNK + (h.x - cx * CHUNK)] = T.HEARTH;
    }
    this.chunks.set(key, chunk);
    while (this.chunks.size > CACHE_LIMIT) {
      const oldest = this.chunks.keys().next().value as string;
      this.chunks.delete(oldest);
      if (!this.dirty.has(oldest)) {
        this.edits.delete(oldest); this.dmg.delete(oldest); this.loaded.delete(oldest);
      }
    }
    return chunk;
  }
  get(x: number, y: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    return this.chunk(cx, cy)[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)];
  }
  set(x: number, y: number, tile: number) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), key = this.key(cx, cy);
    const chunk = this.chunk(cx, cy), index = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
    if (chunk[index] === T.PENDING) return; // Do not overwrite unloaded saved chunks.
    if (chunk[index] === tile) return;
    chunk[index] = tile;
    let data = this.edits.get(key);
    if (!data) { data = new Map(); this.edits.set(key, data); }
    // Returning a block to generated state removes the override.
    if (this.baseTile(x, y) === tile) data.delete(index);
    else data.set(index, tile);
    if (data.size === 0) this.edits.delete(key);
    this.markDirty(key);
  }
  dirtyChunks(): ChunkDelta[] {
    return [...this.dirty].map((key) => ({
      key, edits: pack(this.edits.get(key)), dmg: pack(this.dmg.get(key)),
      revision: this.revisions.get(key) ?? 0,
    }));
  }
  acknowledgeSaved(chunks: ChunkDelta[]) {
    for (const chunk of chunks) {
      if (this.revisions.get(chunk.key) !== chunk.revision) continue;
      this.dirty.delete(chunk.key);
      if (chunk.edits.length || chunk.dmg.length) this.storedKeys.add(chunk.key);
      else this.storedKeys.delete(chunk.key);
    }
  }
  getDirtyCount() { return this.dirty.size; }
}
