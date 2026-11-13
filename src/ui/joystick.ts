/** Sekaerth's thumb movement, informed by the recovered Cursed Project thumb model.
 * An active thumb overrides the keyboard, a small dead zone prevents accidental
 * movement, and displacement is capped at the joystick's visual radius.
 * Not a claim that the original game used the same pixels or UI artwork.
 */
export type Axes = { x: number; y: number };
export type JoystickVector = { axis: Axes | null; offsetX: number; offsetY: number };

export const JOYSTICK_RADIUS = 37;
export const JOYSTICK_DEAD_ZONE = 6;

export function thumbVector(dx: number, dy: number, radius = JOYSTICK_RADIUS): JoystickVector {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || radius <= 0) {
    return { axis: null, offsetX: 0, offsetY: 0 };
  }
  const d = Math.hypot(dx, dy);
  if (d < JOYSTICK_DEAD_ZONE) return { axis: null, offsetX: 0, offsetY: 0 };
  const m = Math.min(1, radius / d);
  const offsetX = dx * m;
  const offsetY = dy * m;
  return { axis: { x: offsetX / radius, y: offsetY / radius }, offsetX, offsetY };
}

/** Maps eight-way input to grid steps, without cutting through solid corners.
 * A diagonal only traverses if both adjacent cardinal cells are open; when
 * blocked, choose the dominant axis so held movement still mines intuitively.
 */
export function gridStep(axis: Axes, canPass: (x: number, y: number) => boolean): Axes {
  let x = Math.abs(axis.x) >= 0.28 ? Math.sign(axis.x) : 0;
  let y = Math.abs(axis.y) >= 0.28 ? Math.sign(axis.y) : 0;
  if (x && y && (!canPass(x, 0) || !canPass(0, y))) {
    if (Math.abs(axis.x) >= Math.abs(axis.y)) y = 0;
    else x = 0;
  }
  return { x, y };
}
