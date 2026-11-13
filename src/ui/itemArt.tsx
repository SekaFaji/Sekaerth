import React from 'react';
import type { ItemId } from '../items/inventory.ts';

/** Bespoke 12x12 silhouettes in a shared pixel palette. No emoji / letter tiles.
 * Every item uses the same dark outline, midtone and light-source direction.
 * Replace or expand the sprite grid without modifying the inventory UI.
 */
type Sprite = { pixels: string[]; shades: Record<string, string> };
const rock = { o: '#30313b', a: '#777d89', b: '#aab1bd', c: '#d2d7d9', d: '#535866' };
const warm = { o: '#49352e', a: '#a7653d', b: '#e5a364', c: '#ffd38c', d: '#75482d' };
const wood = { o: '#45332a', a: '#80583a', b: '#bc8851', c: '#ebbd79', d: '#684a34' };
const glass = { o: '#32434b', a: '#4ba3b4', b: '#80e8df', c: '#dcfff3', d: '#2d6d85' };
const plants = { o: '#304539', a: '#59894c', b: '#a2c875', c: '#e3e59e', d: '#8f5a3b' };
const sprites: Record<ItemId, Sprite> = {
  stone: { shades: rock, pixels: [
    '            ','   ooooo    ','  obbbbaoo  ',' oabccbbaa  ',' oabbbabaa  ','oddaaabbao  ',
    'oddadaabao  ',' ooddaabaa ','  oooaaaao  ','   ooooooo  ','            ','            ',
  ] },
  sand: { shades: { ...warm, a:'#c79c65', b:'#e5ca8d', c:'#ffebaf' }, pixels: [
    '            ','  oooooooo  ','  obbbbcbo  ','  oabbbbao  ','  oabbaabo  ','  oaabaabo  ',
    '  oaaaacbo  ','  oddaaabo  ','  oddddabo  ','  oooooooo  ','            ','            ',
  ] },
  fiber: { shades: wood, pixels: [
    '      oo    ','   oobb o   ','  obbbaa o  ','  oaaadoao  ','   oabbao   ','  oaadao    ',
    ' obbaaoo    ',' oaaabbbo   ','  oaadddo   ','   ooooo    ','            ','            ',
  ] },
  soil: { shades: { ...wood, b:'#8c633f', c:'#74ad64', a:'#b17846' }, pixels: [
    '            ',' ooccccocco ',' occcccccbo ',' obbbcbabao ',' oaaabbbabo ',' oaabaadabo ',
    ' odaadabaao ',' oaaddaabao ',' oddaaaddao ',' oooooooooo ','            ','            ',
  ] },
  hardstone: { shades: { ...rock, a:'#536b82', b:'#819bb5', c:'#c1d4e4', d:'#3f546e' }, pixels: [
    '            ','   oooo     ','  obccaoo   ',' oabbbbaao  ',' oadbbbaao  ',' odaadccao  ',
    ' oaddabbao  ','  oadbbao   ','   oooooo   ','            ','            ','            ',
  ] },
  obsidian: { shades: { o:'#171925', a:'#383147', b:'#73578c', c:'#d5b5ff', d:'#24213a' }, pixels: [
    '     oo     ','    obbo    ','   oabboo   ','  oacbaddo  ',' oabbbddao  ',' oabaaddao  ',
    ' oadddddao  ','  oadddao   ','   ooddo    ','    ooo     ','            ','            ',
  ] },
  crystal: { shades: glass, pixels: [
    '    oo      ','   obbo oo  ','   obcbooao  ','  oacbbaabo  ','  oabcababo  ',' oabbbacbbo  ',
    ' oadbaacbbo  ','  odaaabbo  ','   oaaabo   ','    oooo    ','            ','            ',
  ] },
  bloom: { shades: { o:'#46374a', a:'#e56d88', b:'#ffa4b7', c:'#ffe8b2', d:'#519459' }, pixels: [
    '            ','  oo   oo   ',' obbao obbo  ',' oabbcbbbo  ','  oabcbbo   ','   oabao    ',
    '    odo     ','   odod     ','   oddo     ','    oo      ','            ','            ',
  ] },
  workbench_kit: { shades: wood, pixels: [
    '            ','  oooooooo  ','  ocbbcbbo  ','  oaaabbaao ','  oooooooo  ','  od    do  ',
    '  od    do  ','  od    do  ','  od    do  ','  oo    oo  ','            ','            ',
  ] },
  hearth_kit: { shades: warm, pixels: [
    '            ','     oo     ','    ocbo    ','   ocbbbo   ','   oababo   ','  oabbbaao  ',
    ' oooooooooo ',' obbbabbbbo ',' oaadaadaao ',' oooooooooo ','            ','            ',
  ] },
  warm_tonic: { shades: { ...glass, a:'#d8754d', b:'#ffbd68', c:'#fff1b1' }, pixels: [
    '    oooo    ','    occo    ','    obbo    ','   oooooo   ','  oaabbbbo   ','  oabcbcbo   ',
    '  oabcbbbo   ','  oaaabbbo   ','   oooooo   ','            ','            ','            ',
  ] },
  root_cloak: { shades: plants, pixels: [
    '   oo  oo   ','  oaboooabo  ',' oabbbaabbo  ',' oaacbbcaao  ',' oaabbcbaao  ',' oaaaddaaao  ',
    ' oaaaddaaao  ',' oaaddddaao  ',' oaddddddo  ','  oooooooo  ','            ','            ',
  ] },
  miners_gloves: { shades: { ...rock, b:'#bf9877', c:'#edd2a6', a:'#8d786f' }, pixels: [
    '  oo   oo   ',' oobo  obbo  ',' obbbo obbbo  ',' obbbboaboo  ',' oacccobao  ','  oaadabao  ',
    '  oaadaao   ','  oooooo    ','            ','            ','            ','            ',
  ] },
  starter_pick: { shades: wood, pixels: [
    '  oooooooo  ','  obbbcbbo  ','   ooaaao   ','     oo     ','     ao     ','     ao     ',
    '     ao     ','     ao     ','     ao     ','     oo     ','            ','            ',
  ] },
  stone_pick: { shades: rock, pixels: [
    '  oooooooo  ','  ocbbcbbo  ','   oaabao   ','     oo     ','     ao     ','     ao     ',
    '     ao     ','     ao     ','     ao     ','     oo     ','            ','            ',
  ] },
  crystal_pick: { shades: glass, pixels: [
    '  ooccoooo  ','  ocbbcbao  ','   oacbao   ','     oo     ','     ao     ','     ao     ',
    '     ao     ','     ao     ','     ao     ','     oo     ','            ','            ',
  ] },
};

export function ItemArt({ id, size = 28 }: { id: ItemId; size?: number }) {
  const { pixels, shades } = sprites[id];
  // Collapse pixels of the same color into a single vector path. This keeps
  // the mobile inventory light on DOM nodes while retaining crisp 12px art.
  const paths: Record<string, string> = {};
  for (let y = 0; y < pixels.length; y++) {
    const row = pixels[y];
    for (let x = 0; x < 12; x++) {
      const shade = row[x];
      if (!shades[shade]) continue;
      paths[shade] = (paths[shade] || '') + `M${x},${y}h1v1h-1z`;
    }
  }
  return <svg aria-hidden="true" viewBox="0 0 12 12" width={size} height={size}
    style={{ imageRendering:'pixelated', flexShrink:0 }} shapeRendering="crispEdges">
    {Object.entries(paths).map(([shade,d])=><path key={shade} d={d} fill={shades[shade]} />)}
  </svg>;
}
