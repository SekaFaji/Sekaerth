import React, { useState } from 'react';
import { HOTBAR_SLOTS, INVENTORY_SLOTS, ITEMS, countItem, usedSlots, type Inventory, type ItemStack } from '../items/inventory.ts';
import { RECIPES, canCraft, type CraftFailure } from '../crafting/recipes.ts';
import { type Equipment, type EquipmentSlot } from '../items/equipment.ts';

/** Consistent hand-drawn-looking tile glyphs without font-dependent emoji. */
export function ItemIcon({ stack, small = false }: { stack: ItemStack | null; small?: boolean }) {
  if (!stack) return <span className="block h-5 w-5" aria-hidden />;
  const item = ITEMS[stack.id];
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 items-center justify-center border-2 border-black/35 font-mono font-black shadow-[inset_2px_2px_0_rgba(255,255,255,0.2),2px_2px_0_rgba(0,0,0,0.4)] ${small ? 'h-6 w-6 text-[8px]' : 'h-8 w-8 text-[10px]'}`}
      style={{ background: item.color, color: '#1e1b1a' }}>
      <span className="absolute left-0.5 top-0.5 h-1 w-1 bg-white/30" />{item.symbol}
    </span>
  );
}

type Tab = 'bag' | 'craft' | 'gear';
type Props = {
  inventory: Inventory;
  warmth: number;
  equipment: Equipment;
  nearWorkbench: boolean;
  initialTab?: Tab;
  onMove: (from: number, to: number) => void;
  onUse: (index: number) => void;
  onEquip: (index: number) => void;
  onUnequip: (slot: EquipmentSlot) => void;
  onCraft: (recipeId: string) => void;
  onDiscard: (index: number) => void;
  onClose: () => void;
};
const tabButton = 'min-w-0 flex-1 border px-2 py-2 text-[10px] font-bold uppercase tracking-wider';
const button = 'border border-amber-300/40 bg-amber-950/30 px-3 py-2 text-[10px] font-bold uppercase text-amber-100 active:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-40';
const failureText: Record<CraftFailure, string> = { recipe: 'Unknown recipe', station: 'Requires nearby workbench', ingredients: 'Missing materials', space: 'Backpack is full' };

/** Mobile-first inventory, crafting and gear in one pause-safe overlay. */
export default function InventoryPanel({ inventory, warmth, equipment, nearWorkbench, initialTab='bag', onMove, onUse,
  onEquip, onUnequip, onCraft, onDiscard, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const pickSlot = (index: number) => {
    setConfirmDiscard(false);
    if (selected === null) { setSelected(index); return; }
    if (selected === index) { setSelected(null); return; }
    onMove(selected, index);
    setSelected(null);
  };
  const stack = selected !== null ? inventory[selected] : null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Backpack crafting and equipment" className="absolute inset-0 z-40 flex flex-col bg-[#0d1017]/95 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-[max(0.6rem,env(safe-area-inset-top))] font-mono text-amber-100">
      <header className="seka-plaque flex shrink-0 items-center justify-between gap-2 p-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-amber-200">Expedition Pack</h2>
          <p className="mt-0.5 text-[9px] text-amber-100/65">{usedSlots(inventory)}/{INVENTORY_SLOTS} SLOTS · {nearWorkbench ? 'AT WORKBENCH' : 'FIELD CRAFTING'}</p>
        </div>
        <button type="button" className={button} onClick={onClose} aria-label="Close inventory">✕ Close</button>
      </header>
      <nav className="mt-2 flex shrink-0 gap-1" aria-label="Backpack sections">
        {(['bag','craft','gear'] as const).map((value) => <button type="button" key={value}
          aria-current={tab===value ? 'page' : undefined}
          className={`${tabButton} ${tab===value?'border-amber-200 bg-amber-400/20 text-amber-100':'border-amber-200/30 bg-black/30 text-amber-100/75'}`}
          onClick={()=>{setTab(value);setSelected(null);setConfirmDiscard(false);}}>{value==='bag'?'Backpack':value==='craft'?'Crafting':'Equipment'}</button>)}
      </nav>
      <main className="min-h-0 flex-1 overflow-y-auto pt-2 pb-2">
        {tab==='bag' && <>
          <div className="seka-plaque p-2">
            <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-widest text-amber-100/75"><span>Items</span><span>Warmth {Math.round(warmth)}%</span></div>
            <div className="grid grid-cols-6 gap-1" role="group" aria-label="24 item slots">
              {inventory.map((slot, index) => <button key={index} type="button" onClick={() => pickSlot(index)}
                aria-pressed={selected === index} aria-label={`Slot ${index+1}: ${slot ? `${ITEMS[slot.id].name}, ${slot.count}` : 'Empty'}`}
                className={`relative flex min-w-0 aspect-square items-center justify-center border text-center ${selected===index?'border-amber-200 bg-amber-300/25 ring-1 ring-amber-300':'border-amber-300/25 bg-black/35 active:bg-amber-200/20'}`}>
                <ItemIcon stack={slot} small />
                {slot && <span className="absolute bottom-0 right-0 bg-black/70 px-[2px] text-[9px] font-bold leading-[12px] text-amber-100">{slot.count}</span>}
                {index < HOTBAR_SLOTS && <span className="absolute left-[2px] top-[1px] text-[7px] leading-none text-amber-200/70">{index+1}</span>}
              </button>)}
            </div>
            <p className="mt-2 text-center text-[9px] text-amber-100/65">Tap two slots to move, swap or combine items.</p>
          </div>
          <div className="seka-plaque mt-2 min-h-[90px] p-3">
            {stack ? <>
              <div className="flex items-center gap-2"><ItemIcon stack={stack}/><div><div className="text-xs font-bold text-amber-200">{ITEMS[stack.id].name}</div><div className="text-[9px] text-amber-100/55">{ITEMS[stack.id].category} · {stack.count}/{ITEMS[stack.id].maxStack}</div></div></div>
              <p className="mt-2 text-[10px] leading-relaxed text-amber-100/75">{ITEMS[stack.id].description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(stack.id==='bloom'||stack.id==='warm_tonic'||stack.id==='workbench_kit') && <button type="button" className={button} disabled={stack.id!=='workbench_kit'&&warmth>=100}
                  onClick={()=>{onUse(selected!);setSelected(null);setConfirmDiscard(false);}}>{stack.id==='workbench_kit'?'Place Workbench':`Use +${stack.id==='bloom'?12:35} Warmth`}</button>}
                {(stack.id==='root_cloak'||stack.id==='miners_gloves') && <button type="button" className={button} onClick={()=>{onEquip(selected!);setSelected(null);}}>Equip</button>}
                {!confirmDiscard?<button type="button" onClick={()=>setConfirmDiscard(true)} className="border border-red-200/35 bg-red-950/30 px-3 py-2 text-[10px] uppercase text-rose-200">Discard stack</button>:<>
                  <button type="button" onClick={()=>{onDiscard(selected!);setSelected(null);setConfirmDiscard(false);}} className="border border-red-300/65 bg-red-900/60 px-3 py-2 text-[10px] uppercase text-rose-100">Confirm discard</button>
                  <button type="button" className={button} onClick={()=>setConfirmDiscard(false)}>Cancel</button>
                </>}
              </div>
            </>:<p className="text-[10px] text-amber-100/60">Select a slot to inspect or use an item. The first five are your quickbar.</p>}
          </div>
        </>}
        {tab==='craft' && <div className="flex flex-col gap-2">
          <div className="seka-plaque px-3 py-2 text-[10px] text-amber-100/75">{nearWorkbench ? 'Workbench recipes unlocked' : 'Craft anywhere. Place a Workbench Kit to unlock advanced equipment.'}</div>
          {RECIPES.map(recipe=>{
            const reason=canCraft(inventory,recipe,nearWorkbench);
            return <div className="seka-plaque p-3" key={recipe.id}>
              <div className="flex items-start gap-2"><ItemIcon stack={{id:recipe.output.id,count:recipe.output.count}} />
                <div className="min-w-0 flex-1"><div className="text-[12px] font-bold text-amber-200">{recipe.name}</div><div className="text-[9px] text-amber-100/60">{recipe.station==='hand'?'Field crafting':'Workbench'}</div></div>
                <span className="text-[10px] text-amber-100/70">×{recipe.output.count}</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-amber-100/75">{recipe.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">{recipe.ingredients.map(ing=><span key={ing.id} className={`border px-1.5 py-1 text-[9px] ${countItem(inventory,ing.id)>=ing.count?'border-amber-200/25 text-amber-100/85':'border-rose-400/40 text-rose-200'}`}>{ITEMS[ing.id].name}: {countItem(inventory,ing.id)}/{ing.count}</span>)}</div>
              <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] text-amber-100/60">{reason?failureText[reason]:'Ready to craft'}</span><button type="button" className={button} disabled={Boolean(reason)} onClick={()=>onCraft(recipe.id)}>Craft</button></div>
            </div>;
          })}
        </div>}
        {tab==='gear' && <div className="flex flex-col gap-3">
          {(['body','hands'] as const).map(slot=>{
            const id=equipment[slot];
            return <div className="seka-plaque flex items-center gap-3 p-3" key={slot}>
              <ItemIcon stack={id?{id,count:1}:null}/>
              <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wider text-amber-100/65">{slot==='body'?'Body':'Hands'}</p><p className="text-[12px] font-bold text-amber-200">{id?ITEMS[id].name:'Empty slot'}</p><p className="mt-1 text-[9px] text-amber-100/70">{slot==='body'?'Cloak: reduces cold loss':'Gloves: stronger mining hits'}</p></div>
              {id&&<button type="button" className={button} onClick={()=>onUnequip(slot)}>Unequip</button>}
            </div>;
          })}
          <p className="seka-plaque p-3 text-[10px] leading-relaxed text-amber-100/70">Craft gear in the Crafting tab, then tap a crafted item in your Backpack to equip it. Your gear saves with this world.</p>
        </div>}
      </main>
    </div>
  );
}
