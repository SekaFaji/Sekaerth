import { TILE, BIOME_KEYS, BIOME_ROCKS, hash2, shade } from "../world/terrain.ts";

// ---------- pixel tileset ----------
export type Tileset = Record<string, HTMLCanvasElement[]>;
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
export function buildTileset(): Tileset {
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

