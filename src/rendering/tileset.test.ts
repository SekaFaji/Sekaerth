import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildTileset } from "./tileset.ts";
import { TILE, BIOME_KEYS } from "../world/terrain.ts";

test("tile atlas includes all biome rocks, structures and damage states", () => {
  const previous = (globalThis as any).document;
  const paint = { fillStyle: "", fillRect() {} };
  (globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => paint }) };
  try {
    const tiles = buildTileset();
    for (const key of BIOME_KEYS) assert.equal(tiles["rock_" + key].length, 4);
    for (const key of ["sand", "root", "grass", "workbench", "hearth", "hard", "obsid"])
      assert.equal(tiles[key].length, 1, key);
    assert.equal(tiles.cracks.length, 10);
    assert.equal(TILE, 16);
  } finally { (globalThis as any).document = previous; }
});
