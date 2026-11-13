import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LightingMask } from './lighting.ts';

test('all light gradients are drawn over the entire viewport, not square sub-rectangles',()=>{
  const fills: Array<[number,number,number,number]> = [];
  let mode = '';
  const context = {
    clearRect:()=>{},
    fillRect:(...a: [number,number,number,number])=>fills.push(a),
    createRadialGradient:()=>({addColorStop:()=>{}}),
    set globalCompositeOperation(value:string){mode=value},
    get globalCompositeOperation(){return mode},
    fillStyle:''
  };
  const old=(globalThis as any).document;
  (globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  try {
    const mask=new LightingMask(208,368);
    const drawn:unknown[]=[];
    mask.draw({drawImage:(...x:unknown[])=>drawn.push(x)} as any,0.83,[
      {x:100,y:150,radius:130},{x:125,y:140,radius:60}
    ]);
    assert.deepEqual(fills,[[0,0,208,368],[0,0,208,368],[0,0,208,368]]);
    assert.equal(drawn.length,1);
    assert.equal(mode,'source-over');
  } finally { (globalThis as any).document=old; }
});
