// Browser preferences are intentionally independent of per-world IndexedDB saves.
export type Opts = { fxHigh: boolean; sound: boolean; vol: number; haptic: boolean; autoDig: boolean };

// ---------- UI options ----------
const SAVE_OPTS = "sekaerth-opts-v1";
const LEGACY_SAVE_OPTS = "sunward-opts-v1";
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
function readStoredWithLegacy(key: string, legacyKey: string) {
  const existing = store.get(key);
  if (existing !== null) return existing;
  const old = store.get(legacyKey);
  if (old !== null) store.set(key, old);
  return old;
}


export function loadOptions(): Opts {
  try {
    const raw = readStoredWithLegacy(SAVE_OPTS, LEGACY_SAVE_OPTS);
    if (raw) return { fxHigh: true, sound: true, vol: 0.7, haptic: true, autoDig: false, ...JSON.parse(raw) };
  } catch { /* Unavailable browser storage or corrupted user preferences. */ }
  return { fxHigh: true, sound: true, vol: 0.7, haptic: true, autoDig: false };
}

export function saveOptions(opts: Opts): void {
  store.set(SAVE_OPTS, JSON.stringify(opts));
}
