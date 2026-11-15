import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadOptions, saveOptions } from "./options.ts";

test("defaults are safe without browser storage", () => {
  const original = (globalThis as any).localStorage;
  (globalThis as any).localStorage = undefined;
  try {
    assert.deepEqual(loadOptions(), { fxHigh: true, sound: true, vol: 0.7, haptic: true, autoDig: false });
    assert.doesNotThrow(() => saveOptions(loadOptions()));
  } finally { (globalThis as any).localStorage = original; }
});

test("legacy preferences migrate without deleting the original value", () => {
  const original = (globalThis as any).localStorage;
  const values = new Map<string, string>([["sunward-opts-v1", JSON.stringify({ sound: false, vol: 0.4 })]]);
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  try {
    const opts = loadOptions();
    assert.equal(opts.sound, false);
    assert.equal(opts.vol, 0.4);
    assert.equal(opts.autoDig, false);
    assert.equal(values.get("sunward-opts-v1"), JSON.stringify({ sound: false, vol: 0.4 }));
    assert.equal(values.get("sekaerth-opts-v1"), values.get("sunward-opts-v1"));
    saveOptions({ ...opts, sound: true });
    assert.equal(JSON.parse(values.get("sekaerth-opts-v1")!).sound, true);
  } finally { (globalThis as any).localStorage = original; }
});
