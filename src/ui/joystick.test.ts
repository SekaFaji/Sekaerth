import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { thumbVector, gridStep } from './joystick.ts';

test('dead zone avoids accidental taps while dragging starts motion', () => {
  assert.equal(thumbVector(1, 3).axis, null);
  assert.ok(thumbVector(12, 0).axis!.x > 0);
  assert.equal(thumbVector(0, 0).axis, null);
});
test('thumb clipping caps output axes', () => {
  const value = thumbVector(1000, -1000);
  assert.ok(Math.hypot(value.axis!.x, value.axis!.y) <= 1.0001);
});
test('free diagonals work, blocked corners slide along dominant axis', () => {
  assert.deepEqual(gridStep({ x: 1, y: 1 }, () => true), { x: 1, y: 1 });
  assert.deepEqual(gridStep({ x: .9, y: .6 }, (x, y) => x !== 1), { x: 1, y: 0 });
  assert.deepEqual(gridStep({ x: .5, y: -.9 }, (x, y) => y !== -1), { x: 0, y: -1 });
});
