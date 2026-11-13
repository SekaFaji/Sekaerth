import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ambientColdAt, climateAt, hearthHeatAt, HEARTH_HEAT } from './cold.ts';

test('deep core is survivable while cold increases toward the surface',()=>{
  assert.ok(ambientColdAt(0,0,1600)<ambientColdAt(800,0,1600));
  assert.ok(ambientColdAt(800,0,1600)<ambientColdAt(1590,0,1600));
  assert.ok(climateAt(0,0,1600,[{x:0,y:0}]).warmthDelta>0);
});
test('each hearth produces at most 50 heat, affected by distance',()=>{
  const h=[{x:800,y:0}];
  assert.equal(hearthHeatAt(800,0,h),HEARTH_HEAT);
  assert.ok(hearthHeatAt(803,0,h)<HEARTH_HEAT);
  assert.equal(hearthHeatAt(807,0,h),0);
});
test('five nearby hearths cannot cancel cold of 500',()=>{
  const hearths=Array.from({length:5},()=>({x:1590,y:0}));
  const c=climateAt(1590,0,1600,hearths);
  assert.ok(c.ambientCold>250);
  assert.equal(c.hearthHeat,250);
  assert.ok(c.netCold>0);
  assert.ok(c.warmthDelta<0);
});
test('more heat can create a warm zone and clothing reduces cold loss',()=>{
  const hs=Array.from({length:12},()=>({x:1590,y:0}));
  const cozy=climateAt(1590,0,1600,hs);
  assert.equal(cozy.netCold,0);
  assert.ok(cozy.warmthDelta>0);
  const base=climateAt(1400,0,1600,[]);
  const cloak=climateAt(1400,0,1600,[],0.65);
  assert.ok(base.warmthDelta<cloak.warmthDelta);
});
test('world radius zero never produces invalid environmental values',()=>{
  const c=climateAt(2,3,0,[]);
  assert.ok(Number.isFinite(c.ambientCold));
  assert.ok(Number.isFinite(c.warmthDelta));
});
