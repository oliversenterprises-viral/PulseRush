export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._drone = null;
    this._pulseCues = [];
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.2;
    this.master.connect(this.ctx.destination);
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.master) this.master.gain.value = this.enabled ? 0.2 : 0;
    if (!this.enabled) this.stopDrone();
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  latencySec() {
    if (!this.ctx) return 0.04;
    const base = Number(this.ctx.baseLatency) || 0;
    const out = Number(this.ctx.outputLatency) || 0;
    const sum = base + out;
    if (sum > 0) return Math.min(0.09, Math.max(0.012, sum));
    return 0.036;
  }

  tone(freq, dur, type, gain, slide, when) {
    if (!this.ctx || !this.enabled) return null;
    const t0 = when != null ? Math.max(this.ctx.currentTime, when) : this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    return o;
  }

  noise(dur, gain, cutoff = 1200) {
    if (!this.ctx || !this.enabled) return;
    const n = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * dur)), this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = n;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.t);
    g.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
  }

  tap() {
    this.tone(880, 0.05, "triangle", 0.1);
  }

  start() {
    this.tone(392, 0.08, "triangle", 0.1);
    this.tone(784, 0.14, "sine", 0.08);
    this.noise(0.06, 0.04, 1800);
  }

  perfect() {
    this.tone(988, 0.1, "sine", 0.18);
    this.tone(1480, 0.18, "triangle", 0.12);
    this.tone(1976, 0.1, "sine", 0.05);
    this.noise(0.05, 0.045, 2400);
  }

  great() {
    this.tone(784, 0.1, "triangle", 0.15);
    this.tone(1175, 0.12, "sine", 0.06);
  }

  good() {
    this.tone(523, 0.08, "sine", 0.12);
  }

  miss() {
    this.tone(180, 0.22, "sawtooth", 0.13, 70);
    this.noise(0.12, 0.08, 900);
  }

  fever() {
    this.tone(523, 0.12, "square", 0.07);
    this.tone(784, 0.16, "square", 0.07);
    this.tone(1046, 0.22, "triangle", 0.1);
  }

  gameOver() {
    this.stopDrone();
    this.tone(220, 0.28, "sawtooth", 0.11, 90);
    this.tone(164, 0.42, "sine", 0.1, 70);
  }

  continue() {
    this.tone(392, 0.12, "triangle", 0.14);
    this.tone(523, 0.18, "triangle", 0.12);
    this.startDrone();
  }

  pulseTick(rate) {
    const f = 60 + Math.min(80, rate * 4);
    this.tone(f, 0.04, "sine", 0.03);
  }

  startDrone() {
    this.stopDrone();
    if (!this.ctx || !this.enabled) return;
    const make = (freq, gain, type) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(gain, this.t + 0.6);
      o.connect(g);
      g.connect(this.master);
      o.start();
      return { o, g };
    };
    this._drone = [make(55, 0.03, "sine"), make(82.4, 0.018, "triangle")];
  }

  stopDrone() {
    if (!this._drone) return;
    for (const n of this._drone) {
      try {
        n.g.gain.exponentialRampToValueAtTime(0.001, this.t + 0.2);
        n.o.stop(this.t + 0.25);
      } catch {
        /* already stopped */
      }
    }
    this._drone = null;
  }

  cancelPulseCue() {
    for (const n of this._pulseCues) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this._pulseCues = [];
  }

  /**
   * Schedule the hit-window tick on the audio clock so it lands with the
   * visual ring after speaker latency, not on the next animation frame.
   */
  schedulePulseHit(when) {
    this.cancelPulseCue();
    if (!this.ctx || !this.enabled) return;
    const t0 = Math.max(this.ctx.currentTime + 0.012, when);
    const a = this.tone(1320, 0.032, "sine", 0.15, null, t0);
    const b = this.tone(880, 0.045, "triangle", 0.08, null, t0);
    if (a) this._pulseCues.push(a);
    if (b) this._pulseCues.push(b);
  }
}
