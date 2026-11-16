/** Screen-fit world viewport, independent of planet size and world seed.
 * Retains 16x16 game tiles, expanding visible columns on wide screens.
 * The canvas is stretched to fill its stage, not letterboxed to portrait.
 */
import { TILE } from "../world/terrain.ts";

export type GameViewport = { width: number; height: number };

export function measureGameViewport(cssWidth: number, cssHeight: number): GameViewport {
  if (!Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth <= 0 || cssHeight <= 0)
    return { width: 0, height: 0 };
  // A phone displays roughly 13 tiles across in portrait and 12 down in landscape.
  // Desktop windows can reveal extra tiles, instead of zooming the player to oblivion.
  const desiredTilePx = Math.max(18, Math.min(42, cssWidth / 13, cssHeight / 12));
  const scale = desiredTilePx / TILE;
  return {
    width: Math.max(TILE, Math.round(cssWidth / scale)),
    height: Math.max(TILE, Math.round(cssHeight / scale)),
  };
}
