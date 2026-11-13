import React, { useEffect, useRef, useState, useCallback } from "react";

// ============================================================
// SEKAERTH v3.1 — cozy dig-out-of-the-planet with selectable world sizes.
// 1 block = 1 meter. You start at the center of a round planet.
// Terrain generates on demand so even Earth-scale coordinates don't
// require allocating the planet upfront. Reach the sun to win.
// ============================================================

// ---------- config ----------
const WORLD_SIZES = [
  { id: "tiny", label: "Tiny", radius: 1600, detail: "THE ORIGINAL POCKET PLANET", disc: 20 },
  { id: "small", label: "Small", radius: 3200, detail: "A LITTLE MORE TO EXPLORE", disc: 27 },
  { id: "medium", label: "Medium", radius: 6400, detail: "A LONGER ASCENT", disc: 34 },
  { id: "large", label: "Large", radius: 12800, detail: "A VAST UNDERGROUND", disc: 41 },
  { id: "huge", label: "Huge", radius: 25600, detail: "FOR ENDURANCE EXPLORERS", disc: 47 },
  { id: "earth", label: "Real-Size Earth", radius: 6371000, detail: "TRUE EARTH RADIUS · EXTREME", disc: 54 },
] as const;
type WorldSize = (typeof WORLD_SIZES)[number]["id"];
const WORLD_SIZE_BY_ID = Object.fromEntries(WORLD_SIZES.map((size) => [size.id, size])) as Record<WorldSize, (typeof WORLD_SIZES)[number]>;
function distanceLabel(meters: number) {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return `${Number.isInteger(km) ? km.toLocaleString("en-US") : km.toFixed(1)} km`;
}
const CHUNK = 16;        // chunk size in tiles
const TILE = 16;         // tile px on the internal surface
const VIEW_W = 13;        // internal surface width in tiles
const VIEW_H = 23;        // internal surface height in tiles
const TICK_MS = 100;
const HEARTH_COST = 5;
const WARM_RADIUS = 7;   // hearth warm zone, meters
const CORE_WARM_R = 48;  // the core is naturally warm within this radius
const SAVE_RUN = "sekaerth-run-v1";
const SAVE_OPTS = "sekaerth-opts-v1";
// Preserve existing Sunward saves and settings when upgrading to Sekaerth.
const LEGACY_SAVE_RUN = "sunward-run-v1";
const LEGACY_SAVE_OPTS = "sunward-opts-v1";
const AUTOSAVE_TICKS = 50;

const T = {
  AIR: 0, ROCK: 1, GEM: 2, SAND: 4, HEARTH: 5,
  ROOT: 6, FLOWER: 7, GRASS: 8, HARD: 10, OBSID: 11,
} as const;

const HARDNESS: Record<number, number> = {
  [T.ROCK]: 4, [T.GEM]: 6, [T.SAND]: 1, [T.ROOT]: 2,
  [T.FLOWER]: 1, [T.GRASS]: 2, [T.HARD]: 8, [T.OBSID]: 12,
};
const diggable = (t: number) => t in HARDNESS;
const passable = (t: number) => t === T.AIR || t === T.HEARTH || t === T.FLOWER;

// per-block stats: hp (hits to break) and armor tier (pick required)
function blockStats(t: number, x: number, y: number, radius: number): { hp: number; tier: number } {
  const d = Math.hypot(x, y) / radius;
  if (t === T.HARD) return { hp: 8, tier: 2 };
  if (t === T.OBSID) return { hp: 12, tier: 3 };
  if (t === T.ROCK) return { hp: 4 + Math.round(6 * (1 - d)), tier: 1 };
  if (t === T.GEM) return { hp: 6, tier: 1 };
  if (t === T.ROOT) return { hp: 3, tier: 0 };
  if (t === T.GRASS) return { hp: 2, tier: 0 };
  return { hp: 1, tier: 0 }; // sand, flower
}

// pick progression
const PICK_COST = [0, 0, 10, 25];
const PICK_NAME = ["", "BASIC PICK", "STONE PICK", "CRYSTAL PICK"];

// biome by depth fraction d = r/R (0 = core, 1 = surface)
function biome(d: number) {
  if (d < 0.03) return { name: "THE HEARTH", rock: "#7a3b40", sky: "#1c0b0e" };
  if (d < 0.3) return { name: "IRON GARDEN", rock: "#566278", sky: "#0e1219" };
  if (d < 0.55) return { name: "GEMWOOD", rock: "#5c4890", sky: "#12101f" };
  if (d < 0.75) return { name: "THE SLOW SEA", rock: "#8a4a35", sky: "#1a0d08" };
  if (d < 0.92) return { name: "THE ROOTWAYS", rock: "#70563e", sky: "#130d08" };
  if (d < 0.998) return { name: "THE HOLLOW HALLS", rock: "#46586e", sky: "#0a0f18" };
  return { name: "FIRST LIGHT", rock: "#6b5a3e", sky: "#7ec3ea" };
}
const BIOME_KEYS = ["THE HEARTH", "IRON GARDEN", "GEMWOOD", "THE SLOW SEA", "THE ROOTWAYS", "THE HOLLOW HALLS", "FIRST LIGHT"];
const BIOME_ROCKS: Record<string, string> = {
  "THE HEARTH": "#7a3b40", "IRON GARDEN": "#566278", "GEMWOOD": "#5c4890",
  "THE SLOW SEA": "#8a4a35", "THE ROOTWAYS": "#70563e",
  "THE HOLLOW HALLS": "#46586e", "FIRST LIGHT": "#6b5a3e",
};

// ---------- utils ----------
function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + 13.37) * 43758.5453;
  return n - Math.floor(n);
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function shade(hex: string, f: number) {
  const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * f)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * f)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * f)));
  return `rgb(${r},${g},${b})`;
}
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// Copy older branded saves to the new keys on first access, without deleting originals.
function readStoredWithLegacy(key: string, legacyKey: string) {
  const existing = store.get(key);
  if (existing !== null) return existing;
  const legacy = store.get(legacyKey);
  if (legacy !== null) store.set(key, legacy);
  return legacy;
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

// ---------- chunked round-planet world ----------
class World {
  readonly size: WorldSize;
  readonly radius: number;
  readonly seed: number;
  // Chunk tiles are a working cache; permanent changes live in edits/dmg.
  // Bounding the cache prevents Earth-scale journeys accumulating all tiles in RAM.
  chunks = new Map<string, Int8Array>();
  edits = new Map<string, Map<number, number>>();
  dmg = new Map<string, Map<number, number>>();
  hearths: { x: number; y: number }[] = [{ x: 0, y: 0 }];

  constructor(size: WorldSize = "tiny", seed = 0) {
    this.size = size;
    this.radius = WORLD_SIZE_BY_ID[size].radius;
    this.seed = seed;
  }

  key(cx: number, cy: number) { return cx + "," + cy; }

  getDmg(x: number, y: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const m = this.dmg.get(this.key(cx, cy));
    if (!m) return 0;
    return m.get((y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)) ?? 0;
  }
  addDmg(x: number, y: number, amount: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const k = this.key(cx, cy);
    const i = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
    let m = this.dmg.get(k);
    if (!m) { m = new Map(); this.dmg.set(k, m); }
    const v = (m.get(i) ?? 0) + amount;
    m.set(i, v);
    return v;
  }
  clearDmg(x: number, y: number) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const m = this.dmg.get(this.key(cx, cy));
    if (m) m.delete((y - cy * CHUNK) * CHUNK + (x - cx * CHUNK));
  }

  baseTile(x: number, y: number): number {
    const r = Math.hypot(x, y);
    if (r > this.radius + 1) return T.AIR;             // open sky
    if (r >= this.radius - 2) return T.GRASS;          // grass shell
    if (r < 12) return r === 0 ? T.HEARTH : T.AIR;     // core chamber
    // protective shell near surface: fewer cave openings
    const shell = r > this.radius - 24;
    const sx = this.seed % 10007, sy = Math.floor(this.seed / 10007);
    const n = 0.55 * vnoise(x / 34 + sx, y / 34 + sy) +
      0.45 * vnoise(x / 11 + 100 + sx, y / 11 + 100 + sy);
    if (n > (shell ? 0.72 : 0.6)) return T.AIR;
    const d = r / this.radius;
    const h = hash2(x + sx, y + sy);
    const h2 = hash2(x * 3 + 7 + sx, y * 5 + 11 + sy);
    if (d >= 0.05 && d < 0.5 && h2 < 0.1) return T.HARD;   // hardstone patches — need tier 2
    if (d >= 0.3 && d < 0.6 && h2 > 0.94) return T.OBSID;  // obsidian shards — need tier 3
    if (d >= 0.3 && d < 0.55 && h < 0.05) return T.GEM;
    if (d >= 0.55 && d < 0.75 && h < 0.09) return T.SAND;
    if (d >= 0.75 && d < 0.92 && h < 0.08) return T.ROOT;
    if (d < 0.3 && h < 0.015) return T.FLOWER;
    if (h > 0.996) return T.GEM;
    return T.ROCK;
  }

  chunk(cx: number, cy: number): Int8Array {
    const k = this.key(cx, cy);
    let c = this.chunks.get(k);
    if (c) return c;
    c = new Int8Array(CHUNK * CHUNK);
    for (let ly = 0; ly < CHUNK; ly++)
      for (let lx = 0; lx < CHUNK; lx++)
        c[ly * CHUNK + lx] = this.baseTile(cx * CHUNK + lx, cy * CHUNK + ly);
    const ed = this.edits.get(k);
    if (ed) for (const [i, t] of ed) c[i] = t;
    for (const h of this.hearths) {
      if (Math.floor(h.x / CHUNK) === cx && Math.floor(h.y / CHUNK) === cy)
        c[(h.y - cy * CHUNK) * CHUNK + (h.x - cx * CHUNK)] = T.HEARTH;
    }
    this.chunks.set(k, c);
    if (this.chunks.size > 512) {
      const oldest = this.chunks.keys().next().value;
      if (oldest !== undefined) this.chunks.delete(oldest);
    }
    return c;
  }

  get(x: number, y: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.chunk(cx, cy);
    return c[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)];
  }
  set(x: number, y: number, t: number) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const k = this.key(cx, cy);
    const c = this.chunk(cx, cy);
    const i = (y - cy * CHUNK) * CHUNK + (x - cx * CHUNK);
    c[i] = t;
    let ed = this.edits.get(k);
    if (!ed) { ed = new Map(); this.edits.set(k, ed); }
    ed.set(i, t);
  }

  serialize() {
    const edits: Record<string, Record<number, number>> = {};
    for (const [k, m] of this.edits) {
      const o: Record<number, number> = {};
      for (const [i, t] of m) o[i] = t;
      edits[k] = o;
    }
    const dmg: Record<string, Record<number, number>> = {};
    for (const [k, m] of this.dmg) {
      const o: Record<number, number> = {};
      for (const [i, t] of m) o[i] = t;
      dmg[k] = o;
    }
    return { edits, dmg, hearths: this.hearths };
  }
  loadEdits(
    data: Record<string, Record<number, number>>,
    dmgData: Record<string, Record<number, number>> | undefined,
    hearths: { x: number; y: number }[],
  ) {
    this.edits.clear();
    for (const k of Object.keys(data)) {
      const m = new Map<number, number>();
      for (const i of Object.keys(data[k])) m.set(Number(i), data[k][Number(i)]);
      this.edits.set(k, m);
    }
    this.dmg.clear();
    if (dmgData)
      for (const k of Object.keys(dmgData)) {
        const m = new Map<number, number>();
        for (const i of Object.keys(dmgData[k])) m.set(Number(i), dmgData[k][Number(i)]);
        this.dmg.set(k, m);
      }
    this.hearths = hearths;
    this.chunks.clear();
  }
}

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
  const gemsRef = useRef(0);
  const pickRef = useRef(1);
  const timeRef = useRef(0);
  const digRef = useRef<Record<string, number>>({});
  const keysRef = useRef<Record<string, boolean>>({});
  const particlesRef = useRef<Particle[]>([]);
  const digAnimRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const saveTickRef = useRef(0);
  const wonRef = useRef(false);

  type Phase = "title" | "world" | "howto" | "settings" | "credits" | "play" | "paused" | "win";
  const [phase, setPhase] = useState<Phase>("title");
  const [menuFrom, setMenuFrom] = useState<Phase>("title");
  const [hasSave, setHasSave] = useState(false);
  const [savedWorld, setSavedWorld] = useState<WorldSize | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<WorldSize>("tiny");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
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

  // ----- persistence -----
  const saveRun = useCallback(() => {
    const p = playerRef.current;
    const world = worldRef.current;
    store.set(SAVE_RUN, JSON.stringify({
      v: 3, size: world.size, seed: world.seed, won: wonRef.current,
      px: p.x, py: p.y, facing: p.facing, pick: pickRef.current,
      warmth: warmthRef.current, gems: gemsRef.current, time: timeRef.current,
      ...world.serialize(),
    }));
    setHasSave(true);
    setSavedWorld(world.size);
  }, []);

  const newGame = useCallback((size: WorldSize) => {
    // The random seed is saved, so visited terrain regenerates identically.
    worldRef.current = new World(size, Math.floor(Math.random() * 1000000000));
    playerRef.current = { x: 0, y: -1, facing: 1 };
    renderRef.current = { x: 0, y: -TILE };
    warmthRef.current = 100;
    gemsRef.current = 0;
    pickRef.current = 1;
    timeRef.current = 0;
    digRef.current = {};
    particlesRef.current = [];
    keysRef.current = {};
    wonRef.current = false;
    saveTickRef.current = 0;
    setConfirmReplace(false);
    saveRun(); // new world's initial state replaces the previous save immediately
    setPhase("play");
    say(`YOU WAKE AT THE CENTER OF A ${WORLD_SIZE_BY_ID[size].label.toUpperCase()} WORLD. ANY WAY OUT IS UP.`);
  }, [say, saveRun]);

  const continueGame = useCallback(() => {
    try {
      const raw = readStoredWithLegacy(SAVE_RUN, LEGACY_SAVE_RUN);
      if (!raw) return;
      const s = JSON.parse(raw);
      // Version 2 saves had a fixed 1,600 m world and no procedural seed.
      const size: WorldSize = typeof s.size === "string" && Object.prototype.hasOwnProperty.call(WORLD_SIZE_BY_ID, s.size)
        ? s.size as WorldSize : "tiny";
      worldRef.current = new World(size, Number.isSafeInteger(s.seed) ? s.seed : 0);
      worldRef.current.loadEdits(s.edits ?? {}, s.dmg, s.hearths ?? [{ x: 0, y: 0 }]);
      playerRef.current = { x: s.px, y: s.py, facing: s.facing ?? 1 };
      renderRef.current = { x: s.px * TILE, y: s.py * TILE };
      warmthRef.current = s.warmth;
      gemsRef.current = s.gems;
      pickRef.current = s.pick ?? 1;
      timeRef.current = s.time ?? 0;
      digRef.current = {};
      keysRef.current = {};
      wonRef.current = typeof s.won === "boolean" ? s.won : Math.hypot(s.px, s.py) >= worldRef.current.radius - 2;
      saveTickRef.current = 0;
      setPhase("play");
      say("THE ROCK REMEMBERS YOU.");
    } catch { say("SAVE WAS CORRUPTED. START A NEW ASCENT."); }
  }, [say]);

  useEffect(() => {
    const raw = readStoredWithLegacy(SAVE_RUN, LEGACY_SAVE_RUN);
    setHasSave(!!raw);
    if (raw) {
      try {
        const stored = JSON.parse(raw);
        const size: WorldSize = typeof stored.size === "string" &&
          Object.prototype.hasOwnProperty.call(WORLD_SIZE_BY_ID, stored.size)
          ? stored.size as WorldSize : "tiny";
        setSavedWorld(size);
      } catch { setSavedWorld(null); }
    }
  }, []);

  useEffect(() => {
    const onLeave = () => { if (phase === "play" || phase === "paused") saveRun(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase, saveRun]);

  // ----- input -----
  const press = useCallback((k: string, v: boolean) => { keysRef.current[k] = v; }, []);

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
      if (k === "h") placeHearth();
      if (k === "u") upgradePick();
      if (k === "escape") {
        if (phase === "play") { setPhase("paused"); saveRun(); }
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
  }, [phase, placeHearth, upgradePick, saveRun]);

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
      let dx = 0, dy = 0;
      if (keys["arrowleft"] || keys["a"]) dx = -1;
      else if (keys["arrowright"] || keys["d"]) dx = 1;
      else if (keys["arrowup"] || keys["w"]) dy = -1;
      else if (keys["arrowdown"] || keys["s"]) dy = 1;

      if (dx !== 0 || dy !== 0) {
        if (dx !== 0) p.facing = dx;
        const nx = p.x + dx, ny = p.y + dy;
        const target = w.get(nx, ny);
        if (passable(target)) {
          p.x = nx; p.y = ny;
          digAnimRef.current = null;
          digRef.current = {};
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
            digAnimRef.current = { x: nx, y: ny, t: Date.now() };
            if (Math.random() < 0.5)
              particlesRef.current.push({
                x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2,
                vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.5,
                life: 1, color: "#ffcf8b",
              });
            // damage sticks to the block (Terraria-style), 10 visual states
            const dm = w.addDmg(nx, ny, 1);
            if (dm % 2 === 0) soundRef.current.dig();
            if (dm >= st.hp) {
              w.clearDmg(nx, ny);
              w.set(nx, ny, T.AIR);
              soundRef.current.breakTile();
              buzz(8);
              if (target === T.GEM) {
                gemsRef.current += 1;
                soundRef.current.gem();
                buzz(20);
                say("A GEM, GENTLY FREED");
              } else if (target === T.FLOWER) {
                warmthRef.current = Math.min(100, warmthRef.current + 12);
                say("A WARM BLOOM. TOASTIER.");
              }
            }
          }
        }
      }

      // warmth — colder toward the surface
      const r = Math.hypot(p.x, p.y);      const nearWarm =
        r <= CORE_WARM_R ||
        w.hearths.some((h) => Math.hypot(h.x - p.x, h.y - p.y) <= WARM_RADIUS);
      const d = r / w.radius;
      const delta = nearWarm ? 0.55 : -(0.015 + 0.08 * d);
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
        saveRun();
        setWinStats({ gems: gemsRef.current, time: timeRef.current, radius: w.radius });
        soundRef.current.win();
        setPhase("win");
        return;
      }

      // autosave
      if (++saveTickRef.current >= AUTOSAVE_TICKS) {
        saveTickRef.current = 0;
        saveRun();
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [phase, say, buzz, saveRun]);

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

      // ---------- in-canvas HUD (pixel font) ----------
      const W_ = VIEW_W * TILE, H_ = VIEW_H * TILE;
      // warmth
      const warm = Math.max(0, Math.round(warmthRef.current));
      drawText(ctx, "WARMTH", 3, 3, "#ffb35c");
      ctx.fillStyle = "#000"; ctx.fillRect(2, 10, 50, 6);
      ctx.fillStyle = "#241818"; ctx.fillRect(3, 11, 48, 4);
      ctx.fillStyle = warm > 50 ? "#ff9f43" : warm > 25 ? "#ffb35c" : "#ff5c5c";
      ctx.fillRect(3, 11, Math.round(48 * warm / 100), 4);
      // gems
      const gstr = "GEMS " + gemsRef.current;
      drawText(ctx, gstr, W_ - textWidth(gstr, 1) - 3, 3, "#9fd8e8");
      // pick tier
      const pstr = "PICK T" + pickRef.current;
      drawText(ctx, pstr, W_ - textWidth(pstr, 1) - 3, 10, pickRef.current >= 3 ? "#c9a0ff" : pickRef.current === 2 ? "#a8d8a8" : "#c8c8c8");
      // compass toward the sun + distance to surface
      if (pr > 4) {
        const th = Math.atan2(p.y, p.x);
        const dist = Math.max(0, Math.round(w.radius - pr));
        const dstr = dist + "M";
        drawText(ctx, dstr, Math.round(W_ / 2 - textWidth(dstr, 1) / 2), 16, "#ffe08a");
        ctx.save();
        ctx.translate(W_ / 2, 8);
        ctx.rotate(th);
        ctx.fillStyle = "#ffe08a";
        ctx.fillRect(-6, -1, 8, 2);
        ctx.fillRect(2, -3, 2, 6);
        ctx.fillRect(4, -2, 2, 4);
        ctx.restore();
      }
      // depth + biome
      drawText(ctx, "DEPTH " + Math.round(pr) + "M FROM CORE", 3, H_ - 9, "#c8b8a8");
      drawText(ctx, biome(pr / w.radius).name, W_ - textWidth(biome(pr / w.radius).name, 1) - 3, H_ - 9, "#e8d8b8");
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [opts.fxHigh]);

  // ---------- DOM ----------
  const btn =
    "select-none border border-amber-200/30 bg-amber-500/10 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-500/30 active:bg-amber-500/50 disabled:opacity-30";
  const btnSm = btn + " px-3 py-2 text-[10px]";
  const dpadBtn =
    "select-none bg-white/10 text-white text-lg font-bold w-12 h-12 flex items-center justify-center active:bg-white/30 border border-white/15";

  const goMenu = (m: Phase, from: Phase) => { setMenuFrom(from); setPhase(m); soundRef.current.ui(); };
  const back = () => { soundRef.current.ui(); setPhase(menuFrom === "paused" ? "paused" : "title"); };
  const togglePause = () => {
    if (phase === "play") { saveRun(); setPhase("paused"); }
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

        {/* touch controls */}
        {phase === "play" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto grid grid-cols-3 gap-1 opacity-90">
              <span />
              <button className={dpadBtn} onPointerDown={() => press("arrowup", true)} onPointerUp={() => press("arrowup", false)} onPointerLeave={() => press("arrowup", false)}>↑</button>
              <span />
              <button className={dpadBtn} onPointerDown={() => press("arrowleft", true)} onPointerUp={() => press("arrowleft", false)} onPointerLeave={() => press("arrowleft", false)}>←</button>
              <button className={dpadBtn} onPointerDown={() => press("arrowdown", true)} onPointerUp={() => press("arrowdown", false)} onPointerLeave={() => press("arrowdown", false)}>↓</button>
              <button className={dpadBtn} onPointerDown={() => press("arrowright", true)} onPointerUp={() => press("arrowright", false)} onPointerLeave={() => press("arrowright", false)}>→</button>
            </div>
            <div className="pointer-events-auto flex flex-col gap-2 opacity-90">
              <button
                className="flex select-none items-center gap-2 border border-violet-300/40 bg-violet-500/30 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-violet-100 active:bg-violet-500/60"
                onPointerDown={upgradePick}
              >
                <PixelArt grid={PICK_GRID} colors={ICON_COLORS} px={2} />
                Pick
                <span className="opacity-70">U</span>
              </button>
              <button
                className="flex select-none items-center gap-2 border border-orange-300/40 bg-orange-500/30 px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-orange-100 active:bg-orange-500/60"
                onPointerDown={placeHearth}
              >
                <PixelArt grid={FLAME_GRID} colors={ICON_COLORS} px={2} />
                Hearth
                <span className="opacity-70">{HEARTH_COST} GEMS</span>
              </button>
              <div className="flex gap-2">
                <button className={dpadBtn + " w-12 h-10"} onClick={togglePause}>
                  <PixelArt grid={PAUSE_GRID} colors={ICON_COLORS} px={2} />
                </button>
                <button className={dpadBtn + " w-12 h-10"} onClick={fullscreen}>
                  <PixelArt grid={FS_GRID} colors={ICON_COLORS} px={2} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* toast */}
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-none absolute bottom-24 left-1/2 z-30 w-[92%] -translate-x-1/2 rounded bg-black/80 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-amber-100"
          >
            {toast.text}
          </div>
        )}

        {/* pause button on desktop */}
        {phase === "play" && (
          <div className="absolute right-2 top-2 z-20 hidden sm:flex gap-1">
            <button className={btnSm} onClick={togglePause}>Pause (Esc)</button>
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
              {hasSave && <button className={btn} onClick={() => { soundRef.current.ensure(); continueGame(); }}>Continue{savedWorld ? ` - ${WORLD_SIZE_BY_ID[savedWorld].label}` : ""}</button>}
              <button className={btn} onClick={() => { setSelectedWorld("tiny"); setConfirmReplace(false); setPhase("world"); soundRef.current.ui(); }}>New Ascent</button>
              <button className={btn} onClick={() => goMenu("howto", "title")}>How to Play</button>
              <button className={btn} onClick={() => goMenu("settings", "title")}>Settings</button>
              <button className={btn} onClick={() => goMenu("credits", "title")}>Credits</button>
            </div>
            <p className="mt-8 font-mono text-[8px] uppercase tracking-widest text-white/25">
              v3.1 · six planet sizes · pocket to earth
            </p>
          </div>
        )}

        {/* ================= WORLD SETUP ================= */}
        {phase === "world" && (
          <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[#0b0a12]/95 px-4 py-5 text-center sm:px-6">
            <button
              className="self-start font-mono text-[10px] uppercase tracking-widest text-amber-200/75"
              onClick={() => { setConfirmReplace(false); setPhase("title"); }}
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
                    onClick={() => { setSelectedWorld(size.id); setConfirmReplace(false); soundRef.current.ui(); }}
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
            {hasSave && (
              <p className="mt-2 font-mono text-[9px] text-rose-200/90">WARNING: STARTING A NEW WORLD WILL REPLACE YOUR CURRENT SAVE.</p>
            )}
            <button
              className={btn + " mt-3 w-full border-amber-300/60 bg-amber-500/20 font-bold"}
              onClick={() => {
                if (hasSave && !confirmReplace) { setConfirmReplace(true); return; }
                soundRef.current.ensure();
                newGame(selectedWorld);
              }}
            >
              {confirmReplace ? "Confirm - Replace Save" : `Begin ${WORLD_SIZE_BY_ID[selectedWorld].label} Ascent`}
            </button>
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
              <button className={btn} onClick={() => { saveRun(); setPhase("title"); }}>Save + Quit to Title</button>
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
              <li>WASD / ARROWS / D-PAD — HOLD TO DIG.</li>
              <li>BLOCKS HAVE HP — DAMAGE STICKS (10 STATES).</li>
              <li>GRAY HARDSTONE NEEDS TIER 2, OBSIDIAN TIER 3.</li>
              <li>U OR BUTTON — FORGE A BETTER PICK (COSTS GEMS).</li>
              <li>H OR BUTTON — PLANT A HEARTH (5 GEMS). WARM LIGHT. SAVE POINT.</li>
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
              <button
                className={confirmErase ? "border-red-400/60 bg-red-500/20 font-mono text-[11px] uppercase tracking-[0.2em] text-red-200 px-5 py-2.5" : btn}
                onClick={() => {
                  if (!confirmErase) { setConfirmErase(true); return; }
                  store.del(SAVE_RUN);
                  store.del(LEGACY_SAVE_RUN);
                  setHasSave(false);
                  setSavedWorld(null);
                  setConfirmErase(false);
                  say("SAVE ERASED");
                }}
              >
                {confirmErase ? "Press Again to Confirm" : "Erase Save"}
              </button>
            </div>
            <button className={btn} onClick={() => { setConfirmErase(false); back(); }}>◀ Back</button>
          </div>
        )}

        {/* ================= CREDITS ================= */}
        {phase === "credits" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300">Credits</h2>
            <p className="max-w-[16rem] font-mono text-[10px] leading-relaxed text-white/60">
              SEKAERTH - a cozy ascent from the center of a little planet.
              Vibe-coded in TypeScript with a hand-rolled pixel engine,
              in the spirit of Sekampfire and Sekasma.
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