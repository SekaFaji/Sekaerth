// ---------- pixel icons for the DOM UI (string-grid sprites, crisp edges) ----------
export default function PixelArt({ grid, colors, px = 2, className }: {
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
export const FLAME_GRID = [
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
export const PICK_GRID = [
  "..GGGGGG..",
  ".G......G.",
  "G........G",
  "....H.....",
  "...H......",
  "..H.......",
  ".H........",
  "H.........",
];



export const ICON_COLORS: Record<string, string> = {
  Y: "#ffe08a", O: "#ff8c42", G: "#9aa5b1", H: "#8a5a2b",
  X: "#e8e0d0", L: "#fff7cc",
};


