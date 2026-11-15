// ---------- audio (procedural, sekampfire-style) ----------
export class Sound {
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

