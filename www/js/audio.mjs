export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._drone = null;
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
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (this.master) this.master.gain.value = this.enabled ? 0.22 : 0;
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone(freq, dur, type, gain, slide) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), this.t + dur);
    g.gain.setValueAtTime(gain, this.t);
    g.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.t + dur + 0.02);
  }

  noise(dur, gain) {
    if (!this.ctx || !this.enabled) return;
    const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = n;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "highpass";
    bp.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.t);
    g.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
  }

  tap() {
    this.tone(880, 0.05, "triangle", 0.12);
  }

  perfect() {
    this.tone(988, 0.09, "sine", 0.2);
    this.tone(1480, 0.16, "triangle", 0.12);
  }

  great() {
    this.tone(784, 0.1, "triangle", 0.16);
  }

  good() {
    this.tone(523, 0.08, "sine", 0.12);
  }

  miss() {
    this.tone(180, 0.22, "sawtooth", 0.14, 70);
    this.noise(0.12, 0.08);
  }

  fever() {
    this.tone(523, 0.12, "square", 0.08);
    this.tone(784, 0.16, "square", 0.08);
    this.tone(1046, 0.22, "triangle", 0.1);
  }

  gameOver() {
    this.tone(220, 0.28, "sawtooth", 0.12, 90);
    this.tone(164, 0.4, "sine", 0.1, 70);
  }

  continue() {
    this.tone(392, 0.12, "triangle", 0.14);
    this.tone(523, 0.18, "triangle", 0.12);
  }

  pulseTick(rate) {
    const f = 60 + Math.min(80, rate * 4);
    this.tone(f, 0.04, "sine", 0.03);
  }
}
