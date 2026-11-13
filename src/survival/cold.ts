/** Sekaerth's first location-based climate simulation.
 * Cold and heat share one unit: a hearth supplies at most 50 heat units.
 * Ambient cold varies with distance from the core and the active biome.
 * Keep this deterministic: climate must not depend on wall-clock time or FPS.
 */
import { CORE_WARM_R, WARM_RADIUS, biome } from '../world/terrain.ts';

export const HEARTH_HEAT = 50;
export const HEARTH_RANGE = WARM_RADIUS;
export type HeatSource = { x: number; y: number };
export type Climate = {
  ambientCold: number;
  hearthHeat: number;
  coreHeat: number;
  netCold: number;
  warmthDelta: number;
};
const BIOME_COLD: Record<string, number> = {
  'THE HEARTH': -25,
  'IRON GARDEN': 25,
  GEMWOOD: 45,
  'THE SLOW SEA': -35,
  'THE ROOTWAYS': 65,
  'THE HOLLOW HALLS': 110,
  'FIRST LIGHT': 100,
};
const clamp = (number: number, min: number, max: number) => Math.max(min, Math.min(max, number));

export function ambientColdAt(x: number, y: number, radius: number): number {
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  const depth = clamp(Math.hypot(x, y) / radius, 0, 1);
  const region = biome(depth).name;
  return Math.round(clamp(25 + 375 * Math.pow(depth, 1.15) + (BIOME_COLD[region] || 0), 0, 600));
}

/** Multiple hearths add together, but only inside a modest working radius.
 * A hearth on top of the player gives 50 heat, never instant immunity.
 */
export function hearthHeatAt(x: number, y: number, hearths: readonly HeatSource[]): number {
  let total = 0;
  for (const h of hearths) {
    const distance = Math.hypot(x - h.x, y - h.y);
    if (distance >= HEARTH_RANGE) continue;
    total += HEARTH_HEAT * Math.max(0, 1 - distance / HEARTH_RANGE);
  }
  return Math.round(total);
}

export function climateAt(x: number, y: number, radius: number,
  hearths: readonly HeatSource[], resistance = 1): Climate {
  const ambientCold = ambientColdAt(x, y, radius);
  const hearthHeat = hearthHeatAt(x, y, hearths);
  const coreHeat = Math.round(185 * clamp(1 - Math.hypot(x, y) / CORE_WARM_R, 0, 1));
  const netCold = Math.max(0, ambientCold - hearthHeat - coreHeat);
  // One 100 ms tick: freezing regions drain warmth faster, true shelter recovers it.
  // Resistance modifies cold loss, not the benefits of shelter and supplies.
  const warmthDelta = netCold <= 12 ? 0.23 :
    -(0.012 + 0.065 * netCold / 500) * clamp(resistance, 0.1, 1);
  return { ambientCold, hearthHeat, coreHeat, netCold, warmthDelta };
}
