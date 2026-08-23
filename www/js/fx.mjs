export class FX {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = "#fff";
    this.hint = "";
    this.hintLife = 0;
  }

  burst(x, y, color, n = 22) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
      const s = 2.2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        color,
        r: 1.6 + Math.random() * 2.4,
      });
    }
  }

  shock(x, y, color) {
    this.rings.push({ x, y, r: 12, life: 1, color });
  }

  punch(amount, color) {
    this.shake = Math.max(this.shake, amount);
    this.flash = 0.28;
    this.flashColor = color || "#fff";
  }

  callout(text) {
    this.hint = text;
    this.hintLife = 1;
  }

  step(dt) {
    this.shake *= Math.pow(0.04, dt);
    if (this.shake < 0.2) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 1.8);
    this.hintLife = Math.max(0, this.hintLife - dt * 1.1);
    for (const p of this.particles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 6 * dt;
      p.life -= dt * 1.6;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.r += dt * 420;
      r.life -= dt * 1.4;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  draw(ctx, w, h) {
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(sx, sy);
    for (const r of this.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.life);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.25;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (this.hintLife > 0) {
      ctx.globalAlpha = Math.min(1, this.hintLife * 1.4);
      ctx.fillStyle = "#fff";
      ctx.font = "800 42px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.hint, w / 2, h * 0.22);
      ctx.globalAlpha = 1;
    }
  }
}
