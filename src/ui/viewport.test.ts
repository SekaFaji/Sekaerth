import test from "node:test";
import assert from "node:assert/strict";
import { measureGameViewport } from "./viewport.ts";

test("portrait and landscape use the screen ratio rather than a fixed portrait bitmap", () => {
  const portrait = measureGameViewport(390, 844);
  const landscape = measureGameViewport(844, 390);
  assert.ok(portrait.height > portrait.width);
  assert.ok(landscape.width > landscape.height);
  assert.ok(landscape.width / landscape.height > 2);
  assert.ok(Math.abs(landscape.width / landscape.height - 844 / 390) < 0.02);
});

test("phone layouts keep similar block sizes on rotation", () => {
  const a = measureGameViewport(390, 844);
  const b = measureGameViewport(844, 390);
  assert.ok(Math.abs(390 / a.width - 390 / b.height) < 0.25);
});

test("invalid or zero stage sizes are not applied", () => {
  assert.deepEqual(measureGameViewport(0, 320), { width: 0, height: 0 });
  assert.deepEqual(measureGameViewport(Infinity, 320), { width: 0, height: 0 });
});
