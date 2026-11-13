/** Stable planet parameters. Keep existing seeds and biome thresholds unchanged. */
// ---------- config ----------
export const WORLD_SIZES = [
  { id: "tiny", label: "Tiny", radius: 1600, detail: "THE ORIGINAL POCKET PLANET", disc: 20 },
  { id: "small", label: "Small", radius: 3200, detail: "A LITTLE MORE TO EXPLORE", disc: 27 },
  { id: "medium", label: "Medium", radius: 6400, detail: "A LONGER ASCENT", disc: 34 },
  { id: "large", label: "Large", radius: 12800, detail: "A VAST UNDERGROUND", disc: 41 },
  { id: "huge", label: "Huge", radius: 25600, detail: "FOR ENDURANCE EXPLORERS", disc: 47 },
  { id: "earth", label: "Real-Size Earth", radius: 6371000, detail: "TRUE EARTH RADIUS · EXTREME", disc: 54 },
] as const;
export type WorldSize = (typeof WORLD_SIZES)[number]["id"];
export const WORLD_SIZE_BY_ID = Object.fromEntries(WORLD_SIZES.map((size) => [size.id, size])) as Record<WorldSize, (typeof WORLD_SIZES)[number]>;
export function distanceLabel(meters: number) {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  return `${Number.isInteger(km) ? km.toLocaleString("en-US") : km.toFixed(1)} km`;
}
export const CHUNK = 16;        // chunk size in tiles
export const TILE = 16;         // tile px on the internal surface
export const VIEW_W = 13;        // internal surface width in tiles
export const VIEW_H = 23;        // internal surface height in tiles
export const TICK_MS = 100;
export const HEARTH_COST = 5;
export const WARM_RADIUS = 7;   // hearth warm zone, meters
export const CORE_WARM_R = 48;  // the core is naturally warm within this radius

export const T = {
  PENDING: -1, AIR: 0, ROCK: 1, GEM: 2, SAND: 4, HEARTH: 5,
  ROOT: 6, FLOWER: 7, GRASS: 8, HARD: 10, OBSID: 11,
} as const;

const HARDNESS: Record<number, number> = {
  [T.ROCK]: 4, [T.GEM]: 6, [T.SAND]: 1, [T.ROOT]: 2,
  [T.FLOWER]: 1, [T.GRASS]: 2, [T.HARD]: 8, [T.OBSID]: 12,
};
export const diggable = (t: number) => t in HARDNESS;
export const passable = (t: number) => t === T.AIR || t === T.HEARTH || t === T.FLOWER;

// per-block stats: hp (hits to break) and armor tier (pick required)
export function blockStats(t: number, x: number, y: number, radius: number): { hp: number; tier: number } {
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
export const PICK_COST = [0, 0, 10, 25];
export const PICK_NAME = ["", "BASIC PICK", "STONE PICK", "CRYSTAL PICK"];

// biome by depth fraction d = r/R (0 = core, 1 = surface)
export function biome(d: number) {
  if (d < 0.03) return { name: "THE HEARTH", rock: "#7a3b40", sky: "#1c0b0e" };
  if (d < 0.3) return { name: "IRON GARDEN", rock: "#566278", sky: "#0e1219" };
  if (d < 0.55) return { name: "GEMWOOD", rock: "#5c4890", sky: "#12101f" };
  if (d < 0.75) return { name: "THE SLOW SEA", rock: "#8a4a35", sky: "#1a0d08" };
  if (d < 0.92) return { name: "THE ROOTWAYS", rock: "#70563e", sky: "#130d08" };
  if (d < 0.998) return { name: "THE HOLLOW HALLS", rock: "#46586e", sky: "#0a0f18" };
  return { name: "FIRST LIGHT", rock: "#6b5a3e", sky: "#7ec3ea" };
}
export const BIOME_KEYS = ["THE HEARTH", "IRON GARDEN", "GEMWOOD", "THE SLOW SEA", "THE ROOTWAYS", "THE HOLLOW HALLS", "FIRST LIGHT"];
export const BIOME_ROCKS: Record<string, string> = {
  "THE HEARTH": "#7a3b40", "IRON GARDEN": "#566278", "GEMWOOD": "#5c4890",
  "THE SLOW SEA": "#8a4a35", "THE ROOTWAYS": "#70563e",
  "THE HOLLOW HALLS": "#46586e", "FIRST LIGHT": "#6b5a3e",
};

// ---------- utils ----------
export function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + 13.37) * 43758.5453;
  return n - Math.floor(n);
}
export function smooth(t: number) { return t * t * (3 - 2 * t); }
export function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function shade(hex: string, f: number) {
  const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * f)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * f)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * f)));
  return `rgb(${r},${g},${b})`;
}
