export class FX {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = "#fff";
    this.hint = "";
    this.hintLife = 0;
    this.hintColor = "#fff";
  }

  burst(x, y, color, n = 22) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.22;
      const s = 2.4 + Math.random() * 7.2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 1,
        color,
        r: 1.4 + Math.random() * 2.6,
        streak: Math.random() < 0.28,
      });
    }
  }

  shock(x, y, color) {
    this.rings.push({ x, y, r: 12, life: 1, color, w: 4 });
    this.rings.push({ x, y, r: 6, life: 0.7, color, w: 2 });
  }

  punch(amount, color) {
    this.shake = Math.max(this.shake, amount);
    this.flash = 0.32;
    this.flashColor = color || "#fff";
  }

  callout(text, color) {
    this.hint = text;
    this.hintColor = color || "#fff";
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
      p.vy += 8 * dt;
      p.vx *= 0.99;
      p.life -= dt * 1.55;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.r += dt * 460;
      r.life -= dt * 1.35;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  draw(ctx, w, h) {
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.globalCompositeOperation = "lighter";
    for (const r of this.rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.life) * 0.85;
      ctx.lineWidth = r.w || 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.streak) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.r * 3, -p.r * 0.4, p.r * 6, p.r * 0.8);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.22;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (this.hintLife > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.hintLife * 1.45);
      ctx.fillStyle = this.hintColor;
      ctx.shadowColor = this.hintColor;
      ctx.shadowBlur = 22;
      ctx.font = "800 34px Orbitron, Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.hint, w / 2, h * 0.2);
      ctx.restore();
    }
  }
}

export function drawStars(ctx, stars, w, h, dt) {
  for (const s of stars) {
    s.y += 0.00055 * s.z * (dt ? 60 * dt : 1);
    if (s.y > 1) {
      s.y = 0;
      s.x = Math.random();
    }
    ctx.globalAlpha = 0.22 + s.z * 0.55;
    ctx.fillStyle = s.z > 0.7 ? "#fff4c2" : "#c9e8ff";
    const r = s.z * 1.7;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.18, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function ring(ctx, r, color, width, glow, dash) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = glow || color;
  ctx.shadowBlur = glow ? 18 : 0;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawMenuRings(ctx, w, h, skin, now) {
  const min = Math.min(w, h);
  const t = now / 1000;
  ctx.save();
  ctx.translate(w / 2, h * 0.4);
  const inner = min * 0.145 + Math.sin(t * 2) * min * 0.01;
  const outer = min * 0.22 + Math.cos(t * 1.6) * min * 0.012;
  ring(ctx, inner, skin.target, 5, skin.glow, [min * 0.04, min * 0.03]);
  ring(ctx, inner * 0.86, "rgba(255,255,255,0.18)", 1.5, null, null);
  ring(ctx, outer, skin.pulse, 4, skin.pulse, [min * 0.055, min * 0.028]);
  ctx.fillStyle = skin.perfect;
  ctx.shadowColor = skin.perfect;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlayArena(ctx, pulse, skin, fever, now) {
  const r = Math.max(2, pulse.radius);
  const target = pulse.target;
  const err = Math.abs(r - target) / Math.max(1, target);
  const close = err < 0.22;
  const sweet = err < 0.155;

  ctx.save();
  ctx.translate(pulse.cx, pulse.cy);

  const bloom = ctx.createRadialGradient(0, 0, 8, 0, 0, target * (sweet ? 1.55 : 1.25));
  bloom.addColorStop(0, sweet ? "rgba(255,229,106,0.16)" : "rgba(57,246,255,0.07)");
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(0, 0, target * 1.6, 0, Math.PI * 2);
  ctx.fill();

  ring(ctx, target, skin.target, fever ? 7 : 6, skin.glow, null);
  ring(ctx, target, "rgba(255,229,106,0.28)", close ? 16 : 10, null, null);
  ring(ctx, target * 0.9, "rgba(255,255,255,0.2)", 1.4, null, [10, 8]);
  if (sweet) {
    ring(ctx, target, skin.perfect, 2, skin.perfect, null);
    ctx.fillStyle = skin.perfect;
    ctx.font = "800 15px Rajdhani, Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.92;
    ctx.fillText("NOW", 0, target + 18);
    ctx.globalAlpha = 1;
  }

  const ghosts = pulse.trail || [];
  for (let i = 0; i < ghosts.length; i++) {
    ctx.globalAlpha = 0.12 + i * 0.08;
    ring(ctx, ghosts[i], fever ? skin.perfect : skin.pulse, 3, null, null);
  }
  ctx.globalAlpha = 1;

  ring(ctx, r, fever ? skin.perfect : skin.pulse, 5.5, skin.pulse, null);
  ring(ctx, r, "rgba(255,255,255,0.55)", 1.6, null, null);

  ctx.fillStyle = skin.perfect;
  ctx.shadowColor = skin.perfect;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff8d0";
  ctx.beginPath();
  ctx.arc(-1.4, -1.4, 1.6, 0, Math.PI * 2);
  ctx.fill();

  const tick = ((now / 80) % 360) * (Math.PI / 180);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 11, tick, tick + 1.2);
  ctx.stroke();
  ctx.restore();
}
