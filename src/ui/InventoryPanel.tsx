import React, { useState } from 'react';
import { HOTBAR_SLOTS, INVENTORY_SLOTS, ITEMS, usedSlots, type Inventory, type ItemStack } from '../items/inventory.ts';

/** Deliberately tiny pixel glyphs rather than emoji, so every device looks consistent. */
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

type Props = {
  inventory: Inventory;
  warmth: number;
  onMove: (from: number, to: number) => void;
  onUse: (index: number) => void;
  onDiscard: (index: number) => void;
  onClose: () => void;
};
/** Mobile-first 6 x 4 backpack. Tap source, then destination; no drag requirement. */
export default function InventoryPanel({ inventory, warmth, onMove, onUse, onDiscard, onClose }: Props) {
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
    <div role="dialog" aria-modal="true" aria-label="Backpack inventory" className="absolute inset-0 z-40 flex flex-col bg-[#0d1017]/95 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-[max(0.6rem,env(safe-area-inset-top))] font-mono text-amber-100">
      <header className="seka-plaque flex shrink-0 items-center justify-between gap-2 p-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-amber-200">Backpack</h2>
          <p className="mt-0.5 text-[9px] text-amber-100/65">{usedSlots(inventory)}/{INVENTORY_SLOTS} SLOTS FILLED</p>
        </div>
        <button type="button" className="border border-amber-100/40 bg-amber-700/20 px-3 py-2 text-[11px] font-bold uppercase active:bg-amber-500/30" onClick={onClose}>✕ Close</button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div className="seka-plaque p-2">
          <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-widest text-amber-100/75">
            <span>Items</span><span>Warmth: {Math.round(warmth)}%</span>
          </div>
          <div className="grid grid-cols-6 gap-1" role="group" aria-label="24 item slots">
            {inventory.map((slot, index) => (
              <button key={index} type="button" onClick={() => pickSlot(index)}
                aria-pressed={selected === index}
                aria-label={`Slot ${index+1}: ${slot ? `${ITEMS[slot.id].name}, ${slot.count}` : 'Empty'}`}
                className={`relative flex min-w-0 aspect-square items-center justify-center border text-center ${selected === index ? 'border-amber-200 bg-amber-300/25 ring-1 ring-amber-300' : 'border-amber-300/25 bg-black/35 active:bg-amber-200/20'}`}>
                <ItemIcon stack={slot} small />
                {slot && <span className="absolute bottom-0 right-0 bg-black/70 px-[2px] text-[9px] font-bold leading-[12px] text-amber-100">{slot.count}</span>}
                {index < HOTBAR_SLOTS && <span className="absolute left-[2px] top-[1px] text-[7px] leading-none text-amber-200/70">{index+1}</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[9px] text-amber-100/65">Tap an item, then another slot to move, swap or stack.</p>
        </div>
        <div className="seka-plaque mt-3 min-h-[88px] p-3">
          {stack ? (
            <>
              <div className="flex items-center gap-2"><ItemIcon stack={stack} /><div><div className="text-xs font-bold text-amber-200">{ITEMS[stack.id].name}</div><div className="text-[9px] text-amber-100/55">{ITEMS[stack.id].category} · {stack.count}/{ITEMS[stack.id].maxStack}</div></div></div>
              <p className="mt-2 text-[10px] leading-relaxed text-amber-100/75">{ITEMS[stack.id].description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {stack.id === 'bloom' && <button type="button" onClick={() => { onUse(selected!); setSelected(null); setConfirmDiscard(false); }}
                  disabled={warmth >= 100} className="border border-amber-300/60 bg-orange-800/50 px-3 py-2 text-[10px] font-bold uppercase text-amber-100 disabled:opacity-40">Use Bloom +12</button>}
                {!confirmDiscard ? <button type="button" onClick={() => setConfirmDiscard(true)}
                  className="border border-red-200/35 bg-red-950/30 px-3 py-2 text-[10px] uppercase text-rose-200">Discard stack</button> : <>
                    <button type="button" onClick={() => { onDiscard(selected!); setSelected(null); setConfirmDiscard(false); }}
                      className="border border-red-300/65 bg-red-900/60 px-3 py-2 text-[10px] font-bold uppercase text-rose-100">Confirm discard</button>
                    <button type="button" onClick={() => setConfirmDiscard(false)}
                      className="border border-amber-200/30 px-3 py-2 text-[10px] uppercase">Cancel</button>
                  </>}
              </div>
            </>
          ) : <p className="text-[10px] text-amber-100/60">Select a slot to inspect an item. The first five slots are your quickbar.</p>}
        </div>
      </main>
    </div>
  );
}
