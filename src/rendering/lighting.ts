/** A full-viewport darkness mask with radial light cutouts.
 * All gradients are painted across the FULL frame, never into a cropped square.
 * Reusing the same offscreen canvas avoids allocating textures every frame.
 */
export type ScreenLight = { x: number; y: number; radius: number; strength?: number };

export class LightingMask {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  constructor(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Lighting canvas could not be created');
    this.canvas = canvas;
    this.context = context;
  }
  draw(ctx: CanvasRenderingContext2D, darkness: number, lights: readonly ScreenLight[]) {
    const mask = this.context;
    const { width, height } = this.canvas;
    mask.globalCompositeOperation = 'source-over';
    mask.clearRect(0, 0, width, height);
    mask.fillStyle = `rgba(2, 4, 11, ${Math.max(0, Math.min(1, darkness))})`;
    mask.fillRect(0, 0, width, height);
    mask.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      if (light.radius <= 0 || light.x + light.radius < 0 || light.y + light.radius < 0 ||
          light.x - light.radius > width || light.y - light.radius > height) continue;
      const gradient = mask.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
      const strength = Math.max(0, Math.min(1, light.strength ?? 1));
      gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
      gradient.addColorStop(0.30, `rgba(255,255,255,${strength * 0.95})`);
      gradient.addColorStop(0.65, `rgba(255,255,255,${strength * 0.50})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      mask.fillStyle = gradient;
      mask.fillRect(0, 0, width, height);
    }
    mask.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.canvas, 0, 0);
  }
}
