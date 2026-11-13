import React, { useEffect, useRef, useState, useCallback } from "react";
import { gridStep, thumbVector, JOYSTICK_RADIUS, type Axes } from "./ui/joystick";
import { World } from "./world/World";
import { WORLD_SIZES, WORLD_SIZE_BY_ID, type WorldSize, distanceLabel, CHUNK, TILE, VIEW_W, VIEW_H,
  TICK_MS, HEARTH_COST, WARM_RADIUS, CORE_WARM_R, T, diggable, passable,
  blockStats, PICK_COST, PICK_NAME, biome, BIOME_KEYS, BIOME_ROCKS, hash2, shade } from "./world/terrain";
import { SAVE_FORMAT, listWorlds, readWorld, readChunk, listModifiedKeys, writeWorld,
  removeWorld, migrateLegacyWorld, newWorldId, storageEstimate, type WorldSave } from "./persistence/worldDb";
import { ITEMS, INVENTORY_SLOTS, HOTBAR_SLOTS, type Inventory, emptyInventory,
  normalizeInventory, cloneInventory, canAddItem, addItem, moveSlot, consumeSlot,
  dropForBlock, usedSlots, discardSlot } from "./items/inventory";
import InventoryPanel, { ItemIcon } from "./ui/InventoryPanel";
import { craftItem, RECIPES } from "./crafting/recipes";
import { coldDrainMultiplier, digStrength, emptyEquipment, normalizeEquipment, equipFromBag, unequipToBag, type Equipment, type EquipmentSlot } from "./items/equipment";

// ============================================================
// SEKAERTH v3.5 - cozy dig-out-of-the-planet with selectable world sizes.
// 1 block = 1 meter. You start at the center of a round planet.
// Terrain generates on demand so even Earth-scale coordinates don't
// require allocating the planet upfront. Reach the sun to win.
// ============================================================

// ---------- UI options ----------
const SAVE_OPTS = "sekaerth-opts-v1";
const LEGACY_SAVE_OPTS = "sunward-opts-v1";
const AUTOSAVE_TICKS = 50;
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

// ---------- 3x5 pixel font ----------
const FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"], N: ["111", "101", "101", "101", "101"],
  O: ["010", "101", "101", "101", "010"], P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "010", "001"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  " ": ["000", "000", "000", "000", "000"], "-": ["000", "000", "111", "000", "000"],
  ":": ["000", "010", "000", "010", "000"], ".": ["000", "000", "000", "000", "010"],
  "/": ["001", "001", "010", "100", "100"],
};
function textWidth(s: string, scale: number) { return s.length * 4 * scale - scale; }
function drawText(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
  color: string, scale = 1, shadow = true,
) {
  const str = s.toUpperCase();
  if (shadow) drawTextRaw(ctx, str, x + scale, y + scale, "#000000", scale);
  drawTextRaw(ctx, str, x, y, color, scale);
}
function drawTextRaw(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, scale: number,
) {
  ctx.fillStyle = color;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]];
    if (!g) continue;
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (g[r][c] === "1") ctx.fillRect(x + i * 4 * scale + c * scale, y + r * scale, scale, scale);
  }
}

// ---------- pixel tileset ----------
type Tileset = Record<string, HTMLCanvasElement[]>;
function makeTile(draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = TILE; c.height = TILE;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx);
  return c;
}
function rockTile(base: string): HTMLCanvasElement {
  return makeTile((ctx) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, TILE, TILE);
    const dark = shade(base, 0.74), light = shade(base, 1.3);
    // organic speckles, no grid edges — tiles must merge into rock masses
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = Math.random() < 0.55 ? dark : light;
      const s = Math.random() < 0.3 ? 2 : 1;
      ctx.fillRect(Math.floor(Math.random() * (TILE - 2)), Math.floor(Math.random() * (TILE - 2)), s, s);
    }
    // occasional hairline crack
    if (Math.random() < 0.45) {
      ctx.fillStyle = shade(base, 0.6);
      ctx.fillRect(2 + Math.floor(Math.random() * 8), 2 + Math.floor(Math.random() * 12), 4 + Math.floor(Math.random() * 4), 1);
    }
  });
}
function buildTileset(): Tileset {
  const set: Tileset = {};
  for (const k of BIOME_KEYS) set["rock_" + k] = [0, 1, 2, 3].map(() => rockTile(BIOME_ROCKS[k]));
  set.sand = [makeTile((ctx) => {
    ctx.fillStyle = "#d9a066"; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = "#b5824d";
    for (let y = 2; y < TILE; y += 4)
      for (let x = (y % 8 === 2 ? 1 : 3); x < TILE; x += 6) ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = "#e8bd85"; ctx.fillRect(0, 0, TILE, 1);
  })];
  set.root = [makeTile((ctx) => {
    ctx.fillStyle = "#7a4e26"; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = "#5c3a1c"; for (let x = 2; x < TILE; x += 5) ctx.fillRect(x, 0, 2, TILE);
    ctx.fillStyle = "#94612f"; for (let x = 4; x < TILE; x += 7) ctx.fillRect(x, 0, 1, TILE);
  })];
  set.grass = [makeTile((ctx) => {
    ctx.fillStyle = "#6b4a2a"; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = "#4a8f3c"; ctx.fillRect(0, 4, TILE, TILE - 4);
    ctx.fillStyle = "#5fae4a"; ctx.fillRect(0, 4, TILE, 3);
    ctx.fillStyle = "#3c7a32";
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(Math.random() * 14), 5 + Math.floor(Math.random() * 4), 2, 2);
    ctx.fillStyle = "#7fd35f"; for (let x = 1; x < TILE; x += 5) ctx.fillRect(x, 1, 2, 3);
  })];
  set.workbench = [makeTile((ctx) => {
    ctx.fillStyle = '#644c35'; ctx.fillRect(1, 6, 14, 5);
    ctx.fillStyle = '#b98d5d'; ctx.fillRect(1, 4, 14, 3);
    ctx.fillStyle = '#e1b27c'; ctx.fillRect(2, 4, 12, 1);
    ctx.fillStyle = '#4d3525'; ctx.fillRect(3, 11, 2, 5); ctx.fillRect(11, 11, 2, 5);
    ctx.fillStyle = '#dab582'; ctx.fillRect(4, 2, 7, 2);
    ctx.fillStyle = '#7b5a40'; ctx.fillRect(7, 0, 2, 4);
  })];
  set.hearth = [makeTile((ctx) => {
    ctx.fillStyle = "#3a2a2a"; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = "#57403c";
    ctx.fillRect(1, 1, 6, 6); ctx.fillRect(9, 1, 6, 6);
    ctx.fillRect(1, 9, 6, 6); ctx.fillRect(9, 9, 6, 6);
    ctx.fillStyle = "#241818"; ctx.fillRect(0, 7, TILE, 2); ctx.fillRect(7, 0, 2, TILE);
    ctx.fillStyle = "#1a1010"; ctx.fillRect(0, TILE - 2, TILE, 2);
  })];

  // armored blocks
  set.hard = [makeTile((ctx) => {
    ctx.fillStyle = "#6a7686"; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = "#8a97a8";
    ctx.fillRect(2, 2, 5, 3); ctx.fillRect(9, 4, 4, 3); ctx.fillRect(4, 10, 6, 3);
    ctx.fillStyle = "#4a5563";
    ctx.fillRect(10, 11, 3, 3); ctx.fillRect(1, 8, 2, 2); ctx.fillRect(12, 1, 3, 2);
    ctx.fillStyle = "#b8c4d2"; ctx.fillRect(3, 3, 2, 1); ctx.fillRect(10, 5, 2, 1);
  })];
  set.obsid = [makeTile((ctx) => {
    ctx.fillStyle = "#241b30"; ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = "#161020";
    ctx.fillRect(0, 12, 6, 4); ctx.fillRect(9, 0, 7, 5);
    ctx.fillStyle = "#7c5ca8";
    ctx.fillRect(2, 2, 1, 5); ctx.fillRect(3, 3, 1, 3); ctx.fillRect(11, 8, 1, 5);
    ctx.fillStyle = "#a884d4";
    ctx.fillRect(3, 2, 1, 1); ctx.fillRect(12, 9, 1, 1); ctx.fillRect(6, 11, 1, 1);
  })];

  // 10 progressive crack states (drawn over damaged blocks)
  set.cracks = Array.from({ length: 10 }, (_, state) =>
    makeTile((ctx) => {
      const s = state + 1;
      for (let arm = 0; arm < 3; arm++) {
        const baseA = hash2(state * 7 + 1, arm * 13 + 5) * Math.PI * 2;
        let x = 8, y = 8;
        const len = 2 + Math.round((s / 10) * 6 * (0.6 + hash2(state, arm) * 0.8));
        for (let j = 0; j < len; j++) {
          const a = baseA + (hash2(state * 31 + j, arm) - 0.5) * 1.2;
          x += Math.cos(a); y += Math.sin(a);
          const cx2 = Math.max(0, Math.min(TILE - 1, Math.round(x)));
          const cy2 = Math.max(0, Math.min(TILE - 1, Math.round(y)));
          ctx.fillStyle = j % 3 === 0 ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.55)";
          ctx.fillRect(cx2, cy2, 1, 1);
        }
      }
      if (s >= 6) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, 2, 1); ctx.fillRect(TILE - 2, TILE - 1, 2, 1);
      }
    }),
  );
  return set;
}

// player sprite: little ember spirit (12x12)
const PLAYER_SPRITE = [
  ".....YY.....",
  "....YOO.....",
  "....YOOO....",
  "...OOOOOO...",
  "..OOOOOOOO..",
  ".OOOOOOOOOO.",
  ".OKOOOOOKO..",
  ".OOOOOOOOOO.",
  "..OOOOOOOO..",
  "...OOOOOO...",
  "....OOOO....",
  "....RRR.....",
];
const PLAYER_FLIP = PLAYER_SPRITE.map((r) => r.split("").reverse().join(""));
const SPR: Record<string, string> = { Y: "#ffe08a", O: "#ff8c42", K: "#3a1a0a", R: "#c2410c" };

// ---------- audio (procedural, sekampfire-style) ----------
class Sound {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  vol = 0.7;
  on = true;
  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? this.vol : 0;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setVol(v: number) { this.vol = v; if (this.master) this.master.gain.value = this.on ? v : 0; }
  setOn(b: boolean) { this.on = b; if (this.master) this.master.gain.value = b ? this.vol : 0; }
  blip(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
    if (!this.ctx || !this.master || !this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  dig() { this.blip(70 + Math.random() * 50, 0.05, "square", 0.12); }
  breakTile() { this.blip(140, 0.07, "square", 0.15, -60); }
  gem() { this.blip(660, 0.08, "triangle", 0.2); setTimeout(() => this.blip(990, 0.1, "triangle", 0.2), 70); }
  hearth() { this.blip(110, 0.5, "sawtooth", 0.15, 30); setTimeout(() => this.blip(880, 0.15, "triangle", 0.15), 200); }
  nap() { this.blip(400, 0.5, "sine", 0.2, -250); }
  ui() { this.blip(660, 0.04, "sine", 0.12); }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, "triangle", 0.22), i * 130));
  }
}

// ---------- pixel icons for the DOM UI (string-grid sprites, crisp edges) ----------
function PixelArt({ grid, colors, px = 2, className }: {
  grid: string[]; colors: Record<string, string>; px?: number; className?: string;
}) {
  const w = grid[0].length, h = grid.length;
  return (
    <svg
      width={w * px} height={h * px} viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges" className={className} aria-hidden
    >
      {grid.flatMap((row, y) =>
        row.split("").map((ch, x) => {
          const c = colors[ch];
          return c ? <rect key={x + "_" + y} x={x} y={y} width={1} height={1} fill={c} /> : null;
        }),
      )}
    </svg>
  );
}
const FLAME_GRID = [
  "....Y...",
  "...YY...",
  "...OO...",
  "..OOO...",
  ".OOOOO..",
  ".OOOOO..",
  "OOOOOOO.",
  "OOOOOOO.",
  ".OOOOO..",
  "..OOO...",
];
const PICK_GRID = [
  "..GGGGGG..",
  ".G......G.",
  "G........G",
  "....H.....",
  "...H......",
  "..H.......",
  ".H........",
  "H.........",
];
const PAUSE_GRID = [
  "XX..XX",
  "XX..XX",
  "XX..XX",
  "XX..XX",
  "XX..XX",
];
const FS_GRID = [
  "X......X",
  "XX....XX",
  "........",
  "........",
  "........",
  "........",
  "XX....XX",
  "X......X",
];
const SUN_GRID = [
  "...YY...",
  ".Y.YY.Y.",
  "..YYYY..",
  "YYYYYYYY",
  "YYYYYYYY",
  "..YYYY..",
  ".Y.YY.Y.",
  "...YY...",
];
const ICON_COLORS: Record<string, string> = {
  Y: "#ffe08a", O: "#ff8c42", G: "#9aa5b1", H: "#8a5a2b",
  X: "#e8e0d0", L: "#fff7cc",
};
const SUN_COLORS: Record<string, string> = { Y: "#f59e0b" };

// ---------- main ----------
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Opts = { fxHigh: boolean; sound: boolean; vol: number; haptic: boolean };

export default function SekaerthGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tilesetRef = useRef<Tileset | null>(null);
  const worldRef = useRef<World>(new World());
  const soundRef = useRef<Sound>(new Sound());
  const playerRef = useRef({ x: 0, y: -1, facing: 1 });
  const renderRef = useRef({ x: 0, y: -TILE });
  const warmthRef = useRef(100);
  const gemsRef = useRef(0); // Existing gem currency stays separate from craftable crystal shards.
  const inventoryRef = useRef<Inventory>(emptyInventory());
  const equipmentRef = useRef<Equipment>(emptyEquipment());
  const [inventoryTab, setInventoryTab] = useState<"bag"|"craft"|"gear">("bag");
  const [, publishInventory] = useState(0);
  const [hotbarSlot, setHotbarSlot] = useState(0);
  const fullBagWarningRef = useRef<string | null>(null);
  const pickRef = useRef(1);
  const timeRef = useRef(0);
  const digRef = useRef<Record<string, number>>({});
  const keysRef = useRef<Record<string, boolean>>({});
  const thumbRef = useRef<Axes | null>(null);
  const stickPointerRef = useRef<number | null>(null);
  const stickOriginRef = useRef({ x: 80, y: 76 });
  const [stick, setStick] = useState({ x: 80, y: 76, dx: 0, dy: 0, active: false });
  const [hud, setHud] = useState({ warmth: 100, gems: 0, pick: 1, depth: 1,
    toSun: 1599, angle: -90, biome: "THE HEARTH", size: "tiny" as WorldSize, bag: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const digAnimRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const saveTickRef = useRef(0);
  const wonRef = useRef(false);
  const activeWorldRef = useRef<{ id: string; name: string; createdAt: number } | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const storageBusyRef = useRef(false);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [worlds, setWorlds] = useState<WorldSave[]>([]);
  const [loadingWorlds, setLoadingWorlds] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [deleteWorldId, setDeleteWorldId] = useState<string | null>(null);
  const [diskUsage, setDiskUsage] = useState<{ usage: number; quota: number } | null>(null);

  type Phase = "title" | "world" | "worlds" | "loading" | "howto" | "settings" | "credits" | "play" | "inventory" | "paused" | "win";
  const [phase, setPhase] = useState<Phase>("title");
  const [menuFrom, setMenuFrom] = useState<Phase>("title");
  const [hasSave, setHasSave] = useState(false);
  const [savedWorld, setSavedWorld] = useState<WorldSize | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<WorldSize>("tiny");
  const [winStats, setWinStats] = useState({ gems: 0, time: 0, radius: 1600 });
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [opts, setOpts] = useState<Opts>(() => {
    try {
      const raw = readStoredWithLegacy(SAVE_OPTS, LEGACY_SAVE_OPTS);
      if (raw) return { fxHigh: true, sound: true, vol: 0.7, haptic: true, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { fxHigh: true, sound: true, vol: 0.7, haptic: true };
  });

  useEffect(() => {
    store.set(SAVE_OPTS, JSON.stringify(opts));
    soundRef.current.setOn(opts.sound);
    soundRef.current.setVol(opts.vol);
  }, [opts]);

  const say = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const buzz = useCallback((ms: number) => {
    if (!opts.haptic) return;
    try { navigator.vibrate?.(ms); } catch { /* ignore */ }
  }, [opts.haptic]);

  const updateHud = useCallback(() => {
    const p = playerRef.current;
    const world = worldRef.current;
    const depth = Math.round(Math.hypot(p.x, p.y));
    setHud({
      warmth: Math.max(0, Math.round(warmthRef.current)), gems: gemsRef.current,
      pick: pickRef.current, depth, toSun: Math.max(0, world.radius - depth),
      biome: biome(depth / world.radius).name, size: world.size,
      angle: Math.atan2(p.y, p.x) * (180 / Math.PI),
      bag: usedSlots(inventoryRef.current),
    });
  }, []);

  // ----- versioned, incremental, multiworld persistence -----
  const refreshWorlds = useCallback(async () => {
    try {
      const list = await listWorlds();
      setWorlds(list);
      setHasSave(list.length > 0);
      setSavedWorld(list[0]?.size ?? null);
      setStorageError(null);
      setDiskUsage(await storageEstimate());
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'World storage unavailable');
    } finally { setLoadingWorlds(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try { await migrateLegacyWorld(); }
      catch (error) {
        if (!cancelled) setStorageError(error instanceof Error ? error.message : 'Old save import failed');
      }
      if (!cancelled) await refreshWorlds();
    })();
    return () => { cancelled = true; };
  }, [refreshWorlds]);

  // Captures a consistent snapshot at the call site, queues atomic IDB writes,
  // and acknowledges a chunk only if it has not changed since the snapshot.
  const saveRun = useCallback((): Promise<void> => {
    const active = activeWorldRef.current;
    if (!active) return Promise.resolve();
    const p = playerRef.current;
    const world = worldRef.current;
    const chunks = world.dirtyChunks();
    const meta: WorldSave = {
      v: SAVE_FORMAT, id: active.id, name: active.name, createdAt: active.createdAt,
      updatedAt: Date.now(), size: world.size, seed: world.seed, won: wonRef.current,
      px: p.x, py: p.y, facing: p.facing, pick: pickRef.current,
      warmth: warmthRef.current, gems: gemsRef.current, time: timeRef.current,
      hearths: world.hearths.map((h) => ({ ...h })),
      inventory: cloneInventory(inventoryRef.current),
      equipment: { ...equipmentRef.current },
    };
    setSavingState('saving');
    const next = saveQueueRef.current.catch(() => { /* previous failure remains visible */ }).then(async () => {
      await writeWorld(meta, chunks);
      world.acknowledgeSaved(chunks);
      setWorlds((previous) => [meta, ...previous.filter((item) => item.id !== meta.id)]
        .sort((a, b) => b.updatedAt - a.updatedAt));
      setHasSave(true);
      setSavedWorld(meta.size);
      setSavingState('saved');
    });
    saveQueueRef.current = next.catch((error) => {
      console.error('Sekaerth autosave failed', error);
      setStorageError(error instanceof Error ? error.message : 'World save failed');
      setSavingState('error');
      throw error;
    });
    return saveQueueRef.current;
  }, []);

  const newGame = useCallback(async (size: WorldSize) => {
    if (storageBusyRef.current) return;
    storageBusyRef.current = true;
    setPhase('loading');
    try {
      await saveQueueRef.current;
      const timestamp = Date.now();
      const name = selectedName.trim().slice(0, 32) || `World ${worlds.length + 1}`;
      const id = newWorldId();
      worldRef.current = new World(size, Math.floor(Math.random() * 1000000000));
      activeWorldRef.current = { id, name, createdAt: timestamp };
      playerRef.current = { x: 0, y: -1, facing: 1 };
      renderRef.current = { x: 0, y: -TILE };
      warmthRef.current = 100;
      gemsRef.current = 0;
      inventoryRef.current = emptyInventory();
      equipmentRef.current = emptyEquipment();
      publishInventory((n) => n + 1);
      setHotbarSlot(0);
      fullBagWarningRef.current = null;
      pickRef.current = 1;
      timeRef.current = 0;
      digRef.current = {};
      particlesRef.current = [];
      keysRef.current = {};
      wonRef.current = false;
      saveTickRef.current = 0;
      await saveRun(); // world exists durably before player starts editing
      updateHud();
      setPhase('play');
      say(`WELCOME TO ${name.toUpperCase()}. YOUR ASCENT BEGINS!`);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not create world');
      setPhase('world');
      say('WORLD COULD NOT BE SAVED. PLEASE CHECK STORAGE.');
    } finally { storageBusyRef.current = false; }
  }, [worlds.length, selectedName, say, saveRun, updateHud]);

  const continueGame = useCallback(async (id?: string) => {
    if (storageBusyRef.current) return;
    storageBusyRef.current = true;
    setPhase('loading');
    try {
      await saveQueueRef.current;
      const activeId = id ?? worlds[0]?.id;
      if (!activeId) throw new Error('No saved world found');
      const s = await readWorld(activeId);
      if (!s) throw new Error('World not found');
      const size: WorldSize = WORLD_SIZE_BY_ID[s.size] ? s.size : 'tiny';
      const world = new World(size, Number.isSafeInteger(s.seed) ? s.seed : 0);
      world.hearths = Array.isArray(s.hearths) && s.hearths.length ? s.hearths : [{ x: 0, y: 0 }];
      const keys = await listModifiedKeys(s.id);
      world.connectStorage(keys, (key) => readChunk(s.id, key));
      const px = Number.isSafeInteger(s.px) ? s.px : 0;
      const py = Number.isSafeInteger(s.py) ? s.py : -1;
      // Load edits around the spawn before allowing mining or falling sand.
      await world.preload(Math.floor(px / CHUNK), Math.floor(py / CHUNK), 2);
      if (world.hasReadError()) throw new Error('One or more world chunks could not be loaded');
      worldRef.current = world;
      activeWorldRef.current = { id: s.id, name: s.name, createdAt: s.createdAt };
      playerRef.current = { x: px, y: py, facing: s.facing ?? 1 };
      renderRef.current = { x: px * TILE, y: py * TILE };
      warmthRef.current = s.warmth;
      gemsRef.current = s.gems;
      inventoryRef.current = normalizeInventory(s.inventory);
      equipmentRef.current = normalizeEquipment(s.equipment);
      publishInventory((n) => n + 1);
      setHotbarSlot(0);
      fullBagWarningRef.current = null;
      pickRef.current = s.pick ?? 1;
      timeRef.current = s.time ?? 0;
      digRef.current = {};
      keysRef.current = {};
      wonRef.current = Boolean(s.won);
      saveTickRef.current = 0;
      updateHud();
      setPhase('play');
      say('THE ROCK REMEMBERS YOU.');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'World could not be loaded');
      setPhase('worlds');
      say('WORLD FAILED TO LOAD. NO SAVES WERE DELETED.');
    } finally { storageBusyRef.current = false; }
  }, [worlds, say, updateHud]);

  const eraseWorld = useCallback(async (id: string) => {
    if (storageBusyRef.current) return;
    storageBusyRef.current = true;
    try {
      await saveQueueRef.current;
      await removeWorld(id);
      if (activeWorldRef.current?.id === id) activeWorldRef.current = null;
      setDeleteWorldId(null);
      await refreshWorlds();
      say('WORLD DELETED.');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Could not delete world');
      say('WORLD DELETE FAILED.');
    } finally { storageBusyRef.current = false; }
  }, [refreshWorlds, say]);

  useEffect(() => {
    const saveOnHidden = () => { if (phase === 'play' || phase === 'inventory' || phase === 'paused') void saveRun().catch(() => {}); };
    window.addEventListener('pagehide', saveOnHidden);
    const onVisibility = () => { if (document.hidden) saveOnHidden(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', saveOnHidden);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, saveRun]);

  // ----- input -----
  // A floating thumb pad: the first touch establishes the center, then dragging
  // sends a capped analog vector. Pointer capture keeps releases reliable.
  const resetStick = useCallback(() => {
    thumbRef.current = null;
    stickPointerRef.current = null;
    setStick({ x: 80, y: 76, dx: 0, dy: 0, active: false });
  }, []);
  const stickDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== null) return;
    event.preventDefault();
    soundRef.current.ensure();
    const box = event.currentTarget.getBoundingClientRect();
    const radius = JOYSTICK_RADIUS + 26;
    const x = Math.max(radius, Math.min(box.width - radius, event.clientX - box.left));
    const y = Math.max(radius, Math.min(box.height - radius, event.clientY - box.top));
    stickPointerRef.current = event.pointerId;
    stickOriginRef.current = { x, y };
    thumbRef.current = null;
    setStick({ x, y, dx: 0, dy: 0, active: true });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const stickMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    const { x, y } = stickOriginRef.current;
    const next = thumbVector(event.clientX - box.left - x, event.clientY - box.top - y);
    thumbRef.current = next.axis;
    setStick({ x, y, dx: next.offsetX, dy: next.offsetY, active: true });
  }, []);
  const stickUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerRef.current !== event.pointerId) return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetStick();
  }, [resetStick]);

  useEffect(() => {
    if (phase !== "play") { resetStick(); keysRef.current = {}; }
  }, [phase, resetStick]);
  useEffect(() => {
    const loseFocus = () => { keysRef.current = {}; resetStick(); };
    const onVisibility = () => { if (document.hidden) loseFocus(); };
    window.addEventListener("blur", loseFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", loseFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [resetStick]);

  // A consumable is the first real item interaction; later crafting can use the
  // same immutable inventory operations without coupling recipes to React.
  const workbenchNearby = useCallback(() => {
    const w = worldRef.current, p = playerRef.current;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy <= 5 && w.get(p.x + dx, p.y + dy) === T.WORKBENCH) return true;
    }
    return false;
  }, []);

  const openBackpack = useCallback((tab: "bag" | "craft" | "gear") => {
    setInventoryTab(tab);
    setPhase('inventory');
  }, []);

  /** Consume items in inventory, or place a workbench using a real saved tile. */
  const useInventoryItem = useCallback((slot: number) => {
    const stack = inventoryRef.current[slot];
    if (!stack || !['bloom', 'warm_tonic', 'workbench_kit'].includes(stack.id)) return;
    if (stack.id === 'workbench_kit') {
      const w = worldRef.current, p = playerRef.current;
      if (w.get(p.x, p.y) !== T.AIR) { say('STAND IN AN OPEN TILE TO PLACE A WORKBENCH'); return; }
      const next = consumeSlot(inventoryRef.current, slot);
      if (!next) return;
      w.set(p.x, p.y, T.WORKBENCH);
      inventoryRef.current = next;
      publishInventory((n) => n + 1);
      soundRef.current.hearth(); buzz(20);
      setPhase('play');
      say('WORKBENCH PLACED - CRAFT ADVANCED GEAR NEARBY');
      void saveRun().catch(() => {});
      return;
    }
    if (warmthRef.current >= 100) { say('WARMTH IS ALREADY FULL'); return; }
    const next = consumeSlot(inventoryRef.current, slot);
    if (!next) return;
    inventoryRef.current = next;
    const restored = stack.id === 'warm_tonic' ? 35 : 12;
    warmthRef.current = Math.min(100, warmthRef.current + restored);
    publishInventory((n) => n + 1);
    updateHud(); soundRef.current.hearth(); buzz(15);
    say(`${ITEMS[stack.id].name.toUpperCase()} USED - +${restored} WARMTH`);
    void saveRun().catch(() => {});
  }, [say, buzz, updateHud, saveRun]);

  const makeRecipe = useCallback((id: string) => {
    const result = craftItem(inventoryRef.current, id, workbenchNearby());
    if (!result.ok) {
      const warning = { station: 'WORKBENCH REQUIRED', ingredients: 'MORE MATERIALS REQUIRED', space: 'NOT ENOUGH BACKPACK SPACE', recipe: 'UNKNOWN RECIPE' };
      say(warning[result.reason]); return;
    }
    inventoryRef.current = result.inventory;
    publishInventory((n) => n + 1);
    const recipe = RECIPES.find((r) => r.id === id)!;
    soundRef.current.hearth(); buzz(12);
    say(`CRAFTED: ${recipe.name.toUpperCase()}`);
    void saveRun().catch(() => {});
  }, [workbenchNearby, saveRun, say, buzz]);

  const equipItem = useCallback((slot: number) => {
    const result = equipFromBag(inventoryRef.current, equipmentRef.current, slot);
    if (!result) { say('CANNOT EQUIP THAT ITEM'); return; }
    inventoryRef.current = result.inventory;
    equipmentRef.current = result.equipment;
    publishInventory((n) => n + 1); buzz(12);
    say('GEAR EQUIPPED');
    void saveRun().catch(() => {});
  }, [say, buzz, saveRun]);

  const unequipItem = useCallback((slot: EquipmentSlot) => {
    const result = unequipToBag(inventoryRef.current, equipmentRef.current, slot);
    if (!result) { say('BACKPACK FULL - CANNOT UNEQUIP'); return; }
    inventoryRef.current = result.inventory;
    equipmentRef.current = result.equipment;
    publishInventory((n) => n + 1); buzz(12);
    say('GEAR RETURNED TO BACKPACK');
    void saveRun().catch(() => {});
  }, [say, buzz, saveRun]);

  const moveInventory = useCallback((from: number, to: number) => {
    const next = moveSlot(inventoryRef.current, from, to);
    if (next === inventoryRef.current) return;
    inventoryRef.current = next;
    publishInventory((n) => n + 1);
  }, []);

  const discardInventory = useCallback((slot: number) => {
    const next = discardSlot(inventoryRef.current, slot);
    if (next === inventoryRef.current) return;
    inventoryRef.current = next;
    publishInventory((n) => n + 1);
    say('STACK DISCARDED. SPACE FREED.');
  }, [say]);

  const upgradePick = useCallback(() => {
    if (phase !== "play") return;
    const t = pickRef.current;
    if (t >= 3) { say("YOUR PICK IS FULLY FORGED"); return; }
    const cost = PICK_COST[t + 1];
    if (gemsRef.current < cost) { say(`NEED ${cost} GEMS FOR THE ${PICK_NAME[t + 1]}`); return; }
    gemsRef.current -= cost;
    pickRef.current = t + 1;
    soundRef.current.hearth();
    buzz(30);
    say(`${PICK_NAME[t + 1]} FORGED — TIER ${t + 1}!`);
  }, [phase, say, buzz]);

  const placeHearth = useCallback(() => {
    if (phase !== "play") return;
    const w = worldRef.current;
    const p = playerRef.current;
    if (gemsRef.current < HEARTH_COST) { say(`NEED ${HEARTH_COST} GEMS FOR A HEARTH`); return; }
    if (w.get(p.x, p.y) !== T.AIR) { say("STAND IN OPEN ROCK TO PLANT A HEARTH"); return; }
    w.set(p.x, p.y, T.HEARTH);
    w.hearths.push({ x: p.x, y: p.y });
    gemsRef.current -= HEARTH_COST;
    soundRef.current.hearth();
    buzz(30);
    say("YOU PLANT A HEARTH. THE ROCK GLOWS.");
  }, [phase, say, buzz]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      keysRef.current[k] = true;
      soundRef.current.ensure();
      if ((k === 'i' || k === 'b') && !e.repeat) {
        if (phase === 'play') { openBackpack('bag'); }
        else if (phase === 'inventory') { setPhase('play'); }
        return;
      }
      if (k === 'c' && phase === 'play' && !e.repeat) { openBackpack('craft'); return; }
      if (k === 'e' && phase === 'play' && !e.repeat) { openBackpack('gear'); return; }
      if (k === "h") placeHearth();
      if (k === "u") upgradePick();
      if (k === "escape") {
        if (phase === "play") { setPhase("paused"); void saveRun().catch(() => {}); }
        else if (phase === "inventory") { setPhase("play"); }
        else if (phase === "paused") setPhase("play");
      }
    };
    const up = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, placeHearth, upgradePick, saveRun, openBackpack]);

  // ----- sim tick -----
  useEffect(() => {
    if (phase !== "play") return;
    const interval = setInterval(() => {
      const w = worldRef.current;
      const p = playerRef.current;
      timeRef.current += TICK_MS / 1000;

      // falling sand near the player (bottom-up so each grain moves once per tick)
      const pcx = Math.floor(p.x / CHUNK), pcy = Math.floor(p.y / CHUNK);
      for (let cy = pcy + 1; cy >= pcy - 1; cy--) {
        for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
          const c = w.chunk(cx, cy);
          for (let i = CHUNK * CHUNK - 1; i >= 0; i--) {
            if (c[i] !== T.SAND) continue;
            const lx = i % CHUNK, ly = (i - lx) / CHUNK;
            const x = cx * CHUNK + lx, y = cy * CHUNK + ly;
            if (w.get(x, y + 1) === T.AIR) { w.set(x, y + 1, T.SAND); w.set(x, y, T.AIR); }
          }
        }
      }

      // movement / digging
      const keys = keysRef.current;
      const input = thumbRef.current ?? {
        x: Number(Boolean(keys["arrowright"] || keys["d"])) - Number(Boolean(keys["arrowleft"] || keys["a"])),
        y: Number(Boolean(keys["arrowdown"] || keys["s"])) - Number(Boolean(keys["arrowup"] || keys["w"])),
      };
      const { x: dx, y: dy } = gridStep(input, (x, y) => passable(w.get(p.x + x, p.y + y)));

      if (dx !== 0 || dy !== 0) {
        if (dx !== 0) p.facing = dx;
        const nx = p.x + dx, ny = p.y + dy;
        const target = w.get(nx, ny);
        if (passable(target)) {
          p.x = nx; p.y = ny;
          digAnimRef.current = null;
          digRef.current = {};
          fullBagWarningRef.current = null;
          // Warm flowers are passable. Harvest them on contact rather than
          // trying to damage a tile that the movement system walks through.
          if (target === T.FLOWER && canAddItem(inventoryRef.current, 'bloom')) {
            inventoryRef.current = addItem(inventoryRef.current, 'bloom', 1).inventory;
            publishInventory((n) => n + 1);
            w.set(nx, ny, T.AIR);
            buzz(8);
            say('WARM BLOOM COLLECTED - USE IT FROM YOUR BACKPACK');
          }
        } else if (diggable(target)) {
          const st = blockStats(target, nx, ny, w.radius);
          if (st.tier > pickRef.current) {
            // armored block — needs a better pick (mention once per block)
            const tk = "t" + nx + "," + ny;
            if (!digRef.current[tk]) {
              digRef.current[tk] = 1;
              say(`ARMORED BLOCK — NEED A TIER ${st.tier} PICK (PRESS U)`);
            }
          } else {
            const drop = dropForBlock(target);
            if (drop && !canAddItem(inventoryRef.current, drop)) {
              const warning = `${nx},${ny}`;
              if (fullBagWarningRef.current !== warning) {
                say('BACKPACK FULL - OPEN BAG TO MAKE ROOM');
                fullBagWarningRef.current = warning;
              }
              // Retain both the tile and its damage if collection cannot fit.
              // No mined materials are destroyed or dropped invisibly.
            } else {
              fullBagWarningRef.current = null;
              digAnimRef.current = { x: nx, y: ny, t: Date.now() };
              if (Math.random() < 0.5)
                particlesRef.current.push({
                  x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2,
                  vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5,
                  life: 1, color: "#ffcf8b",
                });
              // damage sticks to the block (Terraria-style), 10 visual states
              const dm = w.addDmg(nx, ny, digStrength(equipmentRef.current));
              if (dm % 2 === 0) soundRef.current.dig();
              if (dm >= st.hp) {
                w.clearDmg(nx, ny);
                w.set(nx, ny, T.AIR);
                soundRef.current.breakTile();
                buzz(8);
                // Persistent world edit + item collection occur in the same
                // synchronous tick, then one autosave snapshots both atomically.
                if (drop) {
                  inventoryRef.current = addItem(inventoryRef.current, drop, 1).inventory;
                  publishInventory((n) => n + 1);
                }
                if (target === T.GEM) {
                  gemsRef.current += 1;
                  soundRef.current.gem();
                  buzz(20);
                  say('GEM +1, CRYSTAL SHARD +1');
                } else if (target === T.OBSID || target === T.HARD) {
                  say(`${ITEMS[drop!].name.toUpperCase()} COLLECTED`);
                }
              }
            } // full bag guard
          }
        }
      }

      // warmth — colder toward the surface
      const r = Math.hypot(p.x, p.y);
      const nearWarm =
        r <= CORE_WARM_R ||
        w.hearths.some((h) => Math.hypot(h.x - p.x, h.y - p.y) <= WARM_RADIUS);
      const d = r / w.radius;
      const delta = nearWarm ? 0.55 : -(0.015 + 0.08 * d) * coldDrainMultiplier(equipmentRef.current);
      warmthRef.current = Math.min(100, Math.max(-1, warmthRef.current + delta));

      if (warmthRef.current <= 0) {
        let best = w.hearths[0], bd = Infinity;
        for (const h of w.hearths) {
          const dd = Math.hypot(h.x - p.x, h.y - p.y);
          if (dd < bd) { bd = dd; best = h; }
        }
        let placed = false;
        for (let ring = 1; ring <= 2 && !placed; ring++) {
          for (let oy = -ring; oy <= ring && !placed; oy++)
            for (let ox = -ring; ox <= ring && !placed; ox++) {
              if (passable(w.get(best.x + ox, best.y + oy))) {
                p.x = best.x + ox; p.y = best.y + oy;
                placed = true;
              }
            }
        }
        warmthRef.current = 60;
        soundRef.current.nap();
        say("TOO COLD. YOU NAPPED AT A HEARTH.");
      }

      // ambient embers
      if (nearWarm && Math.random() < 0.25) {
        particlesRef.current.push({
          x: p.x * TILE + (Math.random() - 0.5) * TILE * 7,
          y: p.y * TILE + (Math.random() - 0.5) * TILE * 7,
          vx: 0, vy: -0.4 - Math.random() * 0.4, life: 1, color: "#ff9f43",
        });
      }
      particlesRef.current = particlesRef.current
        .map((pt) => ({ ...pt, x: pt.x + pt.vx, y: pt.y + pt.vy, life: pt.life - 0.02 }))
        .filter((pt) => pt.life > 0)
        .slice(-160);

      // win: reach the grass shell (once — sandbox continues afterwards)
      if (r >= w.radius - 2 && !wonRef.current) {
        wonRef.current = true;
        void saveRun().catch(() => {});
        setWinStats({ gems: gemsRef.current, time: timeRef.current, radius: w.radius });
        soundRef.current.win();
        setPhase("win");
        return;
      }

      if (w.hasReadError()) {
        setStorageError('Some edited chunks failed to load. Movement is blocked in those areas.');
      }
      // Native-style UI reads live game state, never independently simulates stats.
      updateHud();

      // autosave
      if (++saveTickRef.current >= AUTOSAVE_TICKS) {
        saveTickRef.current = 0;
        void saveRun().catch(() => {});
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [phase, say, buzz, saveRun, updateHud]);

  // ----- canvas sizing: integer device-pixel scaling (crisp, no shimmer) -----
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const fitScale = Math.min(w / (VIEW_W * TILE), h / (VIEW_H * TILE));
      // each game pixel becomes exactly k x k device pixels — no fractional shimmer
      const k = Math.max(1, Math.floor(fitScale * dpr));
      let cssW = (VIEW_W * TILE * k) / dpr;
      let cssH = (VIEW_H * TILE * k) / dpr;
      if (cssW > w || cssH > h) { // integer scale does not fit: plain contain
        cssW = Math.floor(VIEW_W * TILE * fitScale);
        cssH = Math.floor(VIEW_H * TILE * fitScale);
      }
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.style.left = Math.round((w - cssW) / 2) + "px";
      canvas.style.top = Math.round((h - cssH) / 2) + "px";
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, []);

  // ----- render loop -----
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const w = worldRef.current;
      if (!canvas || !w) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!tilesetRef.current) tilesetRef.current = buildTileset();
      const ts = tilesetRef.current;
      const fx = opts.fxHigh;
      ctx.imageSmoothingEnabled = false;

      const p = playerRef.current;
      const r = renderRef.current;
      r.x += (p.x * TILE - r.x) * 0.25;
      r.y += (p.y * TILE - r.y) * 0.25;
      const camX = r.x + TILE / 2 - (VIEW_W * TILE) / 2;
      const camY = r.y + TILE / 2 - (VIEW_H * TILE) / 2;
      const now = Date.now();

      const pr = Math.hypot(p.x, p.y);
      ctx.fillStyle = pr > w.radius - 24 ? "#7ec3ea" : biome(pr / w.radius).sky;
      ctx.fillRect(0, 0, VIEW_W * TILE, VIEW_H * TILE);

      // sun in the sky, radially outward from the center
      if (pr > 4) {
        const ux = p.x / pr, uy = p.y / pr;
        const sx = ux * (w.radius + 34) * TILE - camX;
        const sy = uy * (w.radius + 34) * TILE - camY;
        if (sx > -60 && sy > -60 && sx < VIEW_W * TILE + 60 && sy < VIEW_H * TILE + 60) {
          ctx.fillStyle = "#fff3b0"; ctx.fillRect(sx - 10, sy - 10, 20, 20);
          ctx.fillStyle = "#ffe066"; ctx.fillRect(sx - 8, sy - 8, 16, 16);
          ctx.fillStyle = "#fff9d6"; ctx.fillRect(sx - 5, sy - 6, 10, 10);
        }
      }

      // tiles
      const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
      for (let y = y0; y <= y0 + VIEW_H + 1; y++) {
        for (let x = x0; x <= x0 + VIEW_W + 1; x++) {
          const tt = w.get(x, y);
          if (tt === T.AIR) continue;
          if (tt === T.PENDING) {
            ctx.fillStyle = '#100e17';
            ctx.fillRect(Math.round(x * TILE - camX), Math.round(y * TILE - camY), TILE, TILE);
            continue;
          }
          const sx = Math.round(x * TILE - camX), sy = Math.round(y * TILE - camY);
          const bd = Math.hypot(x, y) / w.radius;
          const b = biome(bd);
          const variant = Math.floor(hash2(x, y) * 4);
          if (tt === T.ROCK || tt === T.GEM || tt === T.FLOWER) {
            ctx.drawImage(ts["rock_" + b.name][variant], sx, sy);
          } else if (tt === T.SAND) {
            ctx.drawImage(ts.sand[0], sx, sy);
          } else if (tt === T.ROOT) {
            ctx.drawImage(ts.root[0], sx, sy);
          } else if (tt === T.GRASS) {
            ctx.drawImage(ts.grass[0], sx, sy);
          } else if (tt === T.HEARTH) {
            ctx.drawImage(ts.hearth[0], sx, sy);
          } else if (tt === T.WORKBENCH) {
            ctx.drawImage(ts.workbench[0], sx, sy);
          } else if (tt === T.HARD) {
            ctx.drawImage(ts.hard[0], sx, sy);
          } else if (tt === T.OBSID) {
            ctx.drawImage(ts.obsid[0], sx, sy);
          }
          // persistent damage cracks (10 states)
          const dm = w.getDmg(x, y);
          if (dm > 0) {
            const st = blockStats(tt, x, y, w.radius);
            const state = Math.max(0, Math.min(9, Math.floor((dm / st.hp) * 10)));
            ctx.drawImage(ts.cracks[state], sx, sy);
          }
          if (tt === T.GEM) {
            ctx.fillStyle = "#b45309";
            ctx.fillRect(sx + 4, sy + 5, 8, 6); ctx.fillRect(sx + 6, sy + 3, 4, 10);
            ctx.fillStyle = "#fbbf24";
            ctx.fillRect(sx + 5, sy + 6, 6, 4); ctx.fillRect(sx + 7, sy + 4, 2, 8);
            ctx.fillStyle = "#fff7cc"; ctx.fillRect(sx + 6, sy + 5, 2, 2);
          }
          if (tt === T.FLOWER) {
            const sway = Math.round(Math.sin(now / 500 + x) * 1);
            ctx.fillStyle = "#3f7a2e"; ctx.fillRect(sx + 7, sy + 8, 2, 5);
            ctx.fillStyle = "#ff6b81";
            ctx.fillRect(sx + 5 + sway, sy + 4, 6, 2); ctx.fillRect(sx + 7 + sway, sy + 2, 2, 6);
            ctx.fillStyle = "#ffd166"; ctx.fillRect(sx + 7 + sway, sy + 4, 2, 2);
          }
        }
      }

      // hearth glow + flames
      if (fx) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const h of w.hearths) {
          const hx = h.x * TILE - camX, hy = h.y * TILE - camY;
          if (hx < -200 || hy < -200 || hx > VIEW_W * TILE + 200 || hy > VIEW_H * TILE + 200) continue;
          const g = ctx.createRadialGradient(hx + 8, hy + 8, 4, hx + 8, hy + 8, TILE * 7);
          g.addColorStop(0, "rgba(255,150,60,0.26)");
          g.addColorStop(1, "rgba(255,140,50,0)");
          ctx.fillStyle = g;
          ctx.fillRect(hx - TILE * 7, hy - TILE * 7, TILE * 15, TILE * 15);
        }
        ctx.restore();
      }
      for (const h of w.hearths) {
        const hx = h.x * TILE - camX, hy = h.y * TILE - camY;
        if (hx < -20 || hy < -20 || hx > VIEW_W * TILE + 20 || hy > VIEW_H * TILE + 20) continue;
        const f = Math.floor(now / 130) % 3;
        ctx.fillStyle = "#ff9f43";
        ctx.fillRect(hx + 5, hy + 7 + (f === 2 ? 1 : 0), 6, 6 - (f === 1 ? 1 : 0));
        ctx.fillStyle = "#ffd166"; ctx.fillRect(hx + 6, hy + 9 - (f === 2 ? 1 : 0), 4, 4);
        ctx.fillStyle = "#fff3b0"; ctx.fillRect(hx + 7, hy + 11, 2, 2);
      }

      // dig cracks
      if (digAnimRef.current && now - digAnimRef.current.t < 180) {
        const { x, y } = digAnimRef.current;
        const sx = x * TILE - camX, sy = y * TILE - camY;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillRect(sx + 3, sy + 7, 10, 2); ctx.fillRect(sx + 7, sy + 3, 2, 10);
      }

      // particles
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x - camX), Math.round(pt.y - camY), 2, 2);
      }
      ctx.globalAlpha = 1;

      // player ember spirit
      const px = Math.round(r.x - camX), py = Math.round(r.y - camY + Math.sin(now / 400) * 1.5);
      if (fx) {
        const g = ctx.createRadialGradient(px + 6, py + 6, 2, px + 6, py + 6, TILE * 1.8);
        g.addColorStop(0, "rgba(255,170,80,0.35)");
        g.addColorStop(1, "rgba(255,170,80,0)");
        ctx.fillStyle = g;
        ctx.fillRect(px - TILE, py - TILE, TILE * 3, TILE * 3);
      }
      const blink = (now / 3400) % 1 < 0.05;
      const sprite = p.facing < 0 ? PLAYER_FLIP : PLAYER_SPRITE;
      for (let sy2 = 0; sy2 < sprite.length; sy2++) {
        const row = sprite[sy2];
        for (let sx2 = 0; sx2 < row.length; sx2++) {
          let ch = row[sx2];
          if (blink && ch === "K") ch = "O";
          const color = SPR[ch];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(px + sx2 + 2, py + sy2 + 1, 1, 1);
        }
      }

      // cozy lamp falloff: dark far from the ember, warm near (FX high, underground only)
      if (fx && pr < w.radius - 24) {
        const lg = ctx.createRadialGradient(px + 6, py + 6, 44, px + 6, py + 6, 210);
        lg.addColorStop(0, "rgba(0,0,0,0)");
        lg.addColorStop(0.6, "rgba(0,0,0,0.12)");
        lg.addColorStop(1, "rgba(0,0,0,0.45)");
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, VIEW_W * TILE, VIEW_H * TILE);
      }

      // HUD is now a readable, responsive DOM overlay in Sekampfire-style
      // translucent wooden plaques. Avoid double-rendering tiny canvas text.
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [opts.fxHigh]);

  // ---------- DOM ----------
  const btn =
    "select-none border border-amber-200/30 bg-amber-500/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-500/30 active:bg-amber-500/50 disabled:opacity-30";
  const btnSm = btn + " px-3 py-2 text-[10px]";

  const goMenu = (m: Phase, from: Phase) => { setMenuFrom(from); setPhase(m); soundRef.current.ui(); };
  const back = () => { soundRef.current.ui(); setPhase(menuFrom === "paused" ? "paused" : "title"); };
  const togglePause = () => {
    if (phase === "play") { void saveRun().catch(() => {}); setPhase("paused"); }
    else if (phase === "paused") setPhase("play");
  };
  const fullscreen = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  };
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-black text-white">
      <div ref={stageRef} className="relative h-full w-full max-w-[420px] overflow-hidden bg-[#0b0a12]">
        <canvas
          ref={canvasRef}
          width={VIEW_W * TILE}
          height={VIEW_H * TILE}
          className="absolute"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Sekampfire-inspired translucent wooden HUD plaques. */}
        {phase === "play" && (
          <div className="pointer-events-none absolute inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-20 select-none font-mono">
            <div className="flex gap-1.5">
              <div className="seka-plaque flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold tracking-[0.1em] text-amber-100">{hud.biome}</div>
                  <div className="mt-0.5 text-[9px] text-amber-100/65">{WORLD_SIZE_BY_ID[hud.size].label} · CORE {distanceLabel(hud.depth)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[9px] text-amber-100/65">☀ SUNLIGHT</div>
                  <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-amber-200">
                    <span className="inline-block text-sm leading-none" aria-label="Direction to surface" style={{ transform: `rotate(${hud.angle}deg)` }}>➤</span>
                    {distanceLabel(hud.toSun)}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => openBackpack('craft')}
                className="seka-plaque pointer-events-auto flex w-[50px] shrink-0 flex-col items-center justify-center text-[10px] font-bold tracking-wider text-amber-100 active:bg-amber-300/25"
                aria-label="Open crafting recipes">
                <span className="text-base leading-none">⚒</span>
                <span className="mt-1 text-[8px]">CRAFT</span>
              </button>
              <button
                type="button" onClick={() => openBackpack('bag')}
                className="seka-plaque pointer-events-auto flex w-[50px] shrink-0 flex-col items-center justify-center text-[10px] font-bold tracking-wider text-amber-100 active:bg-amber-300/25"
                aria-label={`Open backpack, ${hud.bag} of ${INVENTORY_SLOTS} slots filled`}
              >
                <span className="text-base leading-none">▦</span>
                <span className="mt-1 text-[8px]">BAG {hud.bag}</span>
              </button>
              <button
                type="button" onClick={togglePause}
                className="seka-plaque pointer-events-auto flex w-[48px] shrink-0 flex-col items-center justify-center text-[10px] font-bold tracking-wider text-amber-100 active:bg-amber-300/25"
                aria-label="Pause and open game menu"
              >
                <span className="text-base leading-none">☰</span>
                <span className="mt-1 text-[8px]">MENU</span>
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-[1.5fr_0.85fr_0.9fr] gap-1.5">
              <div className="seka-plaque min-w-0 px-2 py-1.5">
                <div className="flex items-center justify-between text-[9px] text-amber-100/80"><span>WARMTH</span><strong className="text-amber-100">{hud.warmth}%</strong></div>
                <div className="mt-1 h-[5px] overflow-hidden border border-stone-500/60 bg-stone-950/80">
                  <div className="h-full transition-[width] duration-200" style={{ width: `${hud.warmth}%`, background: hud.warmth < 25 ? "#e37a72" : "#eab266" }} />
                </div>
              </div>
              <div className="seka-plaque flex min-w-0 flex-col justify-center px-2 py-1.5 text-[9px]">
                <span className="text-amber-100/70">GEMS</span>
                <strong className="mt-0.5 text-xs text-cyan-200">{hud.gems}</strong>
              </div>
              <div className="seka-plaque flex min-w-0 flex-col justify-center px-2 py-1.5 text-[9px]">
                <span className="text-amber-100/70">PICKAXE</span>
                <strong className="mt-0.5 text-[11px] text-amber-100">TIER {hud.pick}</strong>
              </div>
            </div>
          </div>
        )}

        {phase === 'play' && <div className="pointer-events-none absolute right-3 top-[115px] z-20 font-mono text-[8px] text-amber-100/70">
          {savingState === 'saving' ? 'SAVING...' : savingState === 'error' ? 'SAVE ERROR' : savingState === 'saved' ? 'SAVED' : ''}
        </div>}
        {/* First five backpack slots form a lightweight, expandable quickbar. */}
        {phase === 'play' && (
          <div className="pointer-events-auto absolute bottom-[169px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[3px] rounded-sm border border-amber-200/35 bg-[#20252d]/80 p-1 font-mono">
            {inventoryRef.current.slice(0, HOTBAR_SLOTS).map((stack, index) => (
              <button key={index} type="button" aria-pressed={hotbarSlot===index}
                aria-label={`Quick slot ${index+1}: ${stack ? `${ITEMS[stack.id].name}, ${stack.count}` : 'Empty'}`}
                onClick={() => { setHotbarSlot(index); if (stack && ['bloom','warm_tonic','workbench_kit'].includes(stack.id)) useInventoryItem(index); }}
                className={`relative flex h-[34px] w-[34px] items-center justify-center border ${hotbarSlot===index ? 'border-amber-200 bg-amber-300/25' : 'border-amber-200/25 bg-black/40'}`}>
                <ItemIcon stack={stack} small />
                {stack && <span className="absolute bottom-0 right-0 bg-black/70 px-[2px] text-[8px] text-white">{stack.count}</span>}
              </button>
            ))}
          </div>
        )}
        {/* Drag thumb to move and automatically dig, like the Cursed Project movement thumb. */}
        {phase === "play" && (
          <>
            <div
              role="group" aria-label="Touch movement thumbstick: drag to move or dig"
              data-testid="sekaerth-thumbstick"
              className="pointer-events-auto absolute bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 z-20 h-[152px] w-[160px] touch-none select-none"
              onPointerDown={stickDown} onPointerMove={stickMove}
              onPointerUp={stickUp} onPointerCancel={stickUp}
              onLostPointerCapture={(event) => { if (stickPointerRef.current === event.pointerId) resetStick(); }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="seka-joystick-base pointer-events-none absolute h-[94px] w-[94px] rounded-full"
                style={{ left: stick.x - 47, top: stick.y - 47 }}>
                <span className="absolute left-1/2 top-[6px] -translate-x-1/2 text-[11px] text-amber-200/40">◆</span>
                <span className="absolute bottom-[6px] left-1/2 -translate-x-1/2 text-[11px] text-amber-200/40">◆</span>
                <span className="absolute left-[8px] top-1/2 -translate-y-1/2 text-[11px] text-amber-200/40">◆</span>
                <span className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[11px] text-amber-200/40">◆</span>
                <div className={`seka-joystick-thumb absolute left-1/2 top-1/2 h-[48px] w-[48px] -translate-x-1/2 -translate-y-1/2 rounded-full ${stick.active ? "seka-joystick-active" : ""}`}
                  style={{ marginLeft: stick.dx, marginTop: stick.dy }}>
                  <span className="text-[19px] leading-none text-amber-100/90">✦</span>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 text-center font-mono text-[9px] tracking-[0.16em] text-amber-100/70">DRAG TO MOVE / DIG</div>
            </div>

            <div className="pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-20 flex flex-col items-center gap-3 select-none">
              <button type="button" onClick={upgradePick}
                aria-label={`Forge pickaxe upgrade, current tier ${hud.pick}`}
                className="seka-action-button flex h-[68px] w-[68px] flex-col items-center justify-center gap-0.5 rounded-full active:scale-95">
                <PixelArt grid={PICK_GRID} colors={ICON_COLORS} px={2} />
                <span className="font-mono text-[9px] font-bold text-violet-100">FORGE</span>
                <span className="font-mono text-[8px] text-amber-100/75">{hud.pick < 3 ? `${PICK_COST[hud.pick + 1]} GEMS` : "MAX"}</span>
              </button>
              <button type="button" onClick={placeHearth}
                aria-label={`Place a hearth, costs ${HEARTH_COST} gems`}
                className="seka-action-button flex h-[68px] w-[68px] flex-col items-center justify-center gap-0.5 rounded-full active:scale-95">
                <PixelArt grid={FLAME_GRID} colors={ICON_COLORS} px={2} />
                <span className="font-mono text-[9px] font-bold text-orange-100">HEARTH</span>
                <span className="font-mono text-[8px] text-amber-100/75">{HEARTH_COST} GEMS</span>
              </button>
            </div>
          </>
        )}

        {phase === 'inventory' && <InventoryPanel key={inventoryTab}
          inventory={inventoryRef.current} warmth={warmthRef.current}
          equipment={equipmentRef.current} nearWorkbench={workbenchNearby()} initialTab={inventoryTab}
          onMove={moveInventory} onUse={useInventoryItem} onDiscard={discardInventory}
          onEquip={equipItem} onUnequip={unequipItem} onCraft={makeRecipe}
          onClose={() => setPhase('play')} />} 

        {/* Notifications stay clear of both thumbstick and action buttons. */}
        {toast && (
          <div key={toast.id}
            className="seka-plaque pointer-events-none absolute bottom-[224px] left-1/2 z-30 w-[90%] -translate-x-1/2 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-amber-100">
            {toast.text}
          </div>
        )}

        {/* ================= TITLE ================= */}
        {phase === "title" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-1.5 bg-black/70 p-6">
            <div className="mb-2 text-center">
              <div className="animate-pulse">
                <PixelArt grid={FLAME_GRID} colors={ICON_COLORS} px={5} />
              </div>
              <h1 className="mt-2 font-mono text-[clamp(24px,8vw,34px)] font-bold tracking-[0.22em] text-amber-300 drop-shadow-[0_3px_0_rgba(120,40,0,1)]">
                SEKAERTH
              </h1>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">
                DIG TOWARD THE SUN · 1 BLOCK = 1 M
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-2">
              {!loadingWorlds && hasSave && <button className={btn} onClick={() => { soundRef.current.ensure(); void continueGame(); }}>Continue{savedWorld ? ` - ${WORLD_SIZE_BY_ID[savedWorld].label}` : ""}</button>}
              <button className={btn} disabled={loadingWorlds} onClick={() => { setPhase('worlds'); void refreshWorlds(); }}>My Worlds ({worlds.length})</button>
              <button className={btn} disabled={loadingWorlds || !!storageError} onClick={() => { setSelectedWorld("tiny"); setSelectedName(""); setPhase("world"); soundRef.current.ui(); }}>New Ascent</button>
              <button className={btn} onClick={() => goMenu("howto", "title")}>How to Play</button>
              <button className={btn} onClick={() => goMenu("settings", "title")}>Settings</button>
              <button className={btn} onClick={() => goMenu("credits", "title")}>Credits</button>
            </div>
            {storageError && <p role="alert" className="mt-3 max-w-[290px] text-center font-mono text-[9px] text-rose-200">Storage: {storageError}</p>}
            <p className="mt-8 font-mono text-[8px] uppercase tracking-widest text-white/25">
              v3.4 · backpack · resource drops · multiworld saves
            </p>
          </div>
        )}

        {/* ================= WORLD SETUP ================= */}
        {phase === "world" && (
          <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#0b0a12]/95 px-4 py-5 text-center sm:px-6">
            <button
              className="self-start font-mono text-[10px] uppercase tracking-widest text-amber-200/75"
              onClick={() => setPhase("title")}
            >
              ◀ Main Menu
            </button>
            <h2 className="mt-1 font-mono text-lg font-bold uppercase tracking-[0.25em] text-amber-300">Create a World</h2>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/50">CHOOSE YOUR PLANET SIZE</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {WORLD_SIZES.map((size) => {
                const active = selectedWorld === size.id;
                return (
                  <button
                    key={size.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setSelectedWorld(size.id); soundRef.current.ui(); }}
                    className={`flex min-h-[122px] flex-col items-center justify-center gap-1 border p-2 text-center transition-colors ${active ? "border-amber-300 bg-amber-500/20" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
                  >
                    <div
                      className="flex shrink-0 items-center justify-center rounded-full border border-amber-200/25 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                      style={{
                        width: size.disc, height: size.disc,
                        background: size.id === "earth"
                          ? "radial-gradient(circle at 34% 30%, #75c99d, #2f7598 54%, #1b354d 75%, #0b1725)"
                          : "radial-gradient(circle at 30% 30%, #d88c69, #775383 60%, #29253d 85%)",
                      }}
                    />
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-amber-100">{size.label}</span>
                    <span className="font-mono text-[9px] text-white/65">RADIUS {distanceLabel(size.radius)}</span>
                    <span className="font-mono text-[8px] uppercase leading-snug text-white/40">{size.detail}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 border border-amber-300/15 bg-amber-400/5 px-3 py-2 font-mono text-[9px] leading-relaxed text-white/65">
              {selectedWorld === "earth"
                ? "EARTH MODE USES THE REAL 6,371 KM RADIUS. WITH 1 METER BLOCKS THIS IS AN EXPERIMENTAL, EXTREMELY LONG ASCENT."
                : `RADIUS ${distanceLabel(WORLD_SIZE_BY_ID[selectedWorld].radius)}. TERRAIN GENERATES AS YOU EXPLORE. EVERY DIRECTION LEADS OUTWARD.`}
            </div>
            <label className="mt-3 flex flex-col gap-1 text-left font-mono text-[9px] uppercase tracking-wider text-amber-100/70">
              World Name (optional)
              <input type="text" maxLength={32} autoComplete="off" value={selectedName}
                placeholder={`World ${worlds.length + 1}`}
                onChange={(event) => setSelectedName(event.currentTarget.value)}
                className="w-full border border-amber-300/25 bg-black/45 px-3 py-2 text-[12px] text-amber-50 outline-none focus:border-amber-300/70" />
            </label>
            <p className="mt-2 font-mono text-[9px] text-amber-100/55">YOUR NEW WORLD GETS ITS OWN SAVE SLOT. NO EXISTING WORLDS WILL BE REPLACED.</p>
            <button className={btn + " mt-3 w-full border-amber-300/60 bg-amber-500/20 font-bold"}
              disabled={loadingWorlds || !!storageError}
              onClick={() => { soundRef.current.ensure(); void newGame(selectedWorld); }}>
              Begin {WORLD_SIZE_BY_ID[selectedWorld].label} Ascent
            </button>
            {storageError && <p role="alert" className="mt-2 font-mono text-[10px] text-red-200">STORAGE ERROR: {storageError}</p>}
          </div>
        )}

        {/* ================= SAVED WORLDS ================= */}
        {phase === 'worlds' && (
          <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#0b0a12]/95 px-5 py-5 font-mono">
            <button className="self-start text-[10px] uppercase tracking-widest text-amber-200/75"
              onClick={() => { setDeleteWorldId(null); setPhase('title'); }}>◀ Main Menu</button>
            <h2 className="mt-4 text-center text-lg font-bold uppercase tracking-widest text-amber-300">My Worlds</h2>
            <p className="mt-2 text-center text-[9px] leading-relaxed text-amber-100/50">EACH PLANET SAVES INDEPENDENTLY. WORLD CHANGES LOAD IN CHUNKS.</p>
            {loadingWorlds && <p className="mt-8 text-center text-amber-100/60">READING WORLDS...</p>}
            {!loadingWorlds && worlds.length === 0 && <p className="mt-8 text-center text-amber-100/60">NO WORLDS YET. CREATE YOUR FIRST PLANET!</p>}
            <div className="mt-4 flex flex-col gap-3">
              {worlds.map((world) => (
                <div key={world.id} className="seka-plaque flex flex-col gap-2 px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold uppercase text-amber-100">{world.name}</p>
                      <p className="mt-1 text-[9px] text-amber-100/65">{WORLD_SIZE_BY_ID[world.size]?.label ?? 'Tiny'} · {distanceLabel(Math.round(Math.hypot(world.px, world.py)))} from core</p>
                    </div>
                    <span className="shrink-0 text-[8px] text-amber-100/50">{new Date(world.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className={btn + ' flex-1'} onClick={() => void continueGame(world.id)}>Play World</button>
                    <button className="border border-rose-300/30 bg-rose-950/30 px-3 text-[10px] text-rose-200"
                      onClick={() => setDeleteWorldId(deleteWorldId === world.id ? null : world.id)}>
                      {deleteWorldId === world.id ? 'Cancel' : 'Delete'}</button>
                  </div>
                  {deleteWorldId === world.id && (
                    <button className="border border-red-300/60 bg-red-800/35 p-2 text-[10px] uppercase text-red-100"
                      onClick={() => void eraseWorld(world.id)}>Confirm - Delete This World Permanently</button>
                  )}
                </div>
              ))}
            </div>
            {diskUsage && <p className="mt-4 text-center text-[9px] text-amber-100/50">BROWSER STORAGE: {(diskUsage.usage / (1024 * 1024)).toFixed(1)} MB USED {diskUsage.quota ? `/ ${(diskUsage.quota / (1024 * 1024)).toFixed(0)} MB AVAILABLE QUOTA` : ''}</p>}
            {storageError && <p role="alert" className="mt-4 text-center text-[10px] text-red-200">{storageError}</p>}
            <button className={btn + ' mt-4'} onClick={() => { setSelectedName(''); setSelectedWorld('tiny'); setPhase('world'); }}>Create Another World</button>
          </div>
        )}

        {phase === 'loading' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 font-mono text-amber-100">
            <span className="text-xl">✦</span>
            <p className="text-[12px] uppercase tracking-widest">Preparing Your Planet...</p>
            <p className="text-[9px] text-amber-100/60">Loading terrain and world changes</p>
          </div>
        )}

        {/* ================= PAUSE ================= */}
        {phase === "paused" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/75 p-6">
            <h2 className="mb-4 font-mono text-base uppercase tracking-[0.35em] text-amber-300">Paused</h2>
            <div className="flex flex-col gap-2">
              <button className={btn} onClick={togglePause}>Resume</button>
              <button className={btn} onClick={() => goMenu("settings", "paused")}>Settings</button>
              <button className={btn} onClick={() => goMenu("howto", "paused")}>How to Play</button>
              <button className={btn} onClick={() => {
                void saveRun().then(() => setPhase('title')).catch(() => say('SAVE FAILED. STAYING IN WORLD.'));
              }}>Save + Quit to Title</button>
            </div>
          </div>
        )}

        {/* ================= HOW TO PLAY ================= */}
        {phase === "howto" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300">How to Play</h2>
            <ul className="space-y-1.5 font-mono text-[10px] leading-relaxed text-white/70">
              <li>YOU ARE AT THE CENTER OF A ROUND PLANET.</li>
              <li>EVERY DIRECTION IS "UP" — DIG ANY WAY.</li>
              <li>THE ARROW ALWAYS POINTS TO THE SUN.</li>
              <li>1 BLOCK = 1 METER. CHOOSE THE PLANET RADIUS WHEN STARTING.</li>
              <li>WASD / ARROWS OR DRAG THE THUMBSTICK TO MOVE AND DIG.</li>
              <li>BLOCKS HAVE HP — DAMAGE STICKS (10 STATES).</li>
              <li>GRAY HARDSTONE NEEDS TIER 2, OBSIDIAN TIER 3.</li>
              <li>U OR BUTTON — FORGE A BETTER PICK (COSTS GEMS).</li>
              <li>H OR BUTTON - PLANT A HEARTH (5 GEMS). WARM LIGHT. SAVE POINT.</li>
              <li>I / B OR BAG BUTTON - OPEN YOUR 24-SLOT BACKPACK.</li>
              <li>C OR CRAFT BUTTON - CRAFT A WORKBENCH KIT AND WARM TONICS.</li>
              <li>PLACE A WORKBENCH THEN RETURN TO CRAFTING FOR EQUIPMENT.</li>
              <li>ROOT CLOAK SLOWS COLD LOSS. MINER'S GLOVES SPEED UP DIGGING.</li>
              <li>E - OPEN EQUIPMENT. GEAR IS SAVED PER WORLD.</li>
              <li>TAP A STACK, THEN ANOTHER SLOT TO SWAP OR MERGE.</li>
              <li>THE FIRST 5 SLOTS MAKE UP THE QUICKBAR.</li>
              <li>MINED BLOCKS YIELD MATERIALS. WARM BLOOMS RESTORE WARMTH WHEN USED.</li>
              <li>EACH PLANET HAS ITS OWN NAME AND SAVE SLOT.</li>
              <li>WORLD CHANGES AUTOSAVE IN SEPARATE CHUNK RECORDS.</li>
              <li>HEARTHS REFILL WARMTH. COLD = NAP.</li>
              <li>REACH THE GRASS RING. SEE THE SUN. WIN.</li>
            </ul>
            <button className={btn} onClick={back}>◀ Back</button>
          </div>
        )}

        {/* ================= SETTINGS ================= */}
        {phase === "settings" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300">Settings</h2>
            <div className="flex w-64 flex-col gap-2">
              <button className={btn} onClick={() => setOpts((o) => ({ ...o, fxHigh: !o.fxHigh }))}>
                Visual FX: {opts.fxHigh ? "High" : "Low"}
              </button>
              <button className={btn} onClick={() => setOpts((o) => ({ ...o, sound: !o.sound }))}>
                Sound: {opts.sound ? "On" : "Off"}
              </button>
              <label className="flex items-center justify-between border border-amber-200/20 bg-amber-500/5 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-amber-100">
                Volume
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={opts.vol}
                  onChange={(e) => setOpts((o) => ({ ...o, vol: Number(e.target.value) }))}
                  className="ml-3 w-24 accent-amber-400"
                />
              </label>
              <button className={btn} onClick={() => setOpts((o) => ({ ...o, haptic: !o.haptic }))}>
                Haptics: {opts.haptic ? "On" : "Off"}
              </button>
              <p className="border border-amber-200/15 bg-amber-950/20 p-3 text-[10px] leading-relaxed text-amber-100/70">
                Your worlds now save separately. Manage or delete them from My Worlds on the main menu.
              </p>
            </div>
            <button className={btn} onClick={back}>◀ Back</button>
          </div>
        )}

        {/* ================= CREDITS ================= */}
        {phase === "credits" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300">Credits</h2>
            <p className="max-w-[16rem] font-mono text-[10px] leading-relaxed text-white/60">
              SEKAERTH - EXPLORE, MINE AND CRAFT YOUR WAY THROUGH A LIVING PLANET.
              Developed by SekaFaji Games.
            </p>
            <p className="font-mono text-[9px] text-white/30">1 BLOCK = 1 M · SIX WORLD SIZES</p>
            <button className={btn} onClick={back}>◀ Back</button>
          </div>
        )}

        {/* ================= WIN ================= */}
        {phase === "win" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-sky-300/95 to-amber-200/95 p-6 text-center text-amber-950">
            <div className="text-5xl">🌅</div>
            <h2 className="font-mono text-lg font-bold uppercase tracking-[0.3em]">First Light</h2>
            <p className="max-w-[17rem] font-mono text-[10px] leading-relaxed">
              YOU REACHED THE SURFACE OF A PLANET WITH A {distanceLabel(winStats.radius)} RADIUS. THE SUN IS WARM ON YOUR LITTLE EMBER FACE.
            </p>
            <p className="font-mono text-[10px] opacity-70">
              💎 {winStats.gems} GEMS · {fmtTime(winStats.time)}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              <button
                className="border-2 border-amber-900/50 bg-amber-600/25 px-8 py-2 font-mono text-[11px] uppercase tracking-widest text-amber-950 active:bg-amber-600/50"
                onClick={() => setPhase("play")}
              >
                Keep Digging (Sandbox)
              </button>
              <button
                className="border-2 border-amber-900/30 px-8 py-2 font-mono text-[11px] uppercase tracking-widest text-amber-950 active:bg-amber-600/20"
                onClick={() => setPhase("title")}
              >
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* title-screen hint */}
        {phase === "title" && (
          <button className={btnSm + " absolute right-2 top-2 z-30 hidden sm:block"} onClick={fullscreen}>
            ⛶
          </button>
        )}
      </div>
    </div>
  );
}