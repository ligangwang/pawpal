/** Little synthesised sounds, so no audio files are downloaded. */
type Note = [freq: number, to: number, dur: number, delay?: number];
const SOUNDS: Record<string, { type: OscillatorType; notes: Note[]; vol?: number }> = {
  tap: { type: "triangle", notes: [[520, 700, 0.08]] },
  feed: { type: "square", notes: [[300, 260, 0.06], [300, 260, 0.06, 0.15], [300, 260, 0.06, 0.3]], vol: 0.08 },
  happy: { type: "sine", notes: [[660, 660, 0.1], [880, 880, 0.12, 0.1], [990, 990, 0.16, 0.2]] },
  play: { type: "triangle", notes: [[400, 900, 0.18], [500, 1000, 0.18, 0.25]] },
  bathe: { type: "sine", notes: [[900, 1400, 0.06], [1100, 1600, 0.06, 0.12], [800, 1300, 0.06, 0.25], [1000, 1500, 0.06, 0.4]] },
  coin: { type: "square", notes: [[988, 988, 0.07], [1319, 1319, 0.2, 0.07]], vol: 0.07 },
  hatch: { type: "triangle", notes: [[523, 523, 0.12], [659, 659, 0.12, 0.12], [784, 784, 0.12, 0.24], [1047, 1047, 0.3, 0.36]] },
  miss: { type: "sine", notes: [[400, 250, 0.3]] },
  step: { type: "triangle", notes: [[600, 800, 0.08]] },
};

export class Sound {
  on = true;
  private ctx?: AudioContext;
  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = typeof window !== "undefined" ? window.AudioContext : undefined;
    if (!Ctor) return undefined;
    try {
      this.ctx = new Ctor();
    } catch {
      return undefined;
    }
    return this.ctx;
  }
  play(name: keyof typeof SOUNDS) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const s = SOUNDS[name];
    for (const [freq, to, dur, delay = 0] of s.notes) {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      o.type = s.type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(s.vol ?? 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }
}
