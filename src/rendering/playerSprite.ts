// player sprite: little ember spirit (12x12)
export const PLAYER_SPRITE = [
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
export const PLAYER_FLIP = PLAYER_SPRITE.map((r) => r.split("").reverse().join(""));
export const SPR: Record<string, string> = { Y: "#ffe08a", O: "#ff8c42", K: "#3a1a0a", R: "#c2410c" };

