import {
  SKINS,
  START_LIVES,
  applyTap,
  createRunState,
  dailySeed,
  grantContinue,
  judge,
  mulberry32,
  nextPattern,
  parseChallenge,
  pulseDurationMs,
  pulseRadius,
  sanitizeName,
  skinById,
  startRadius,
  targetRadius,
  utcDateString,
} from "./engine.mjs";
import { buySkin, loadState, recordRun, saveState, touchStreak } from "./storage.mjs";
import { Synth } from "./audio.mjs";
import { AdBridge } from "./ads.mjs";
import { FX } from "./fx.mjs";
import { challengeUrl, shareChallenge } from "./share.mjs";

const $ = (id) => document.getElementById(id);

export class PulseRush {
  constructor() {
    this.canvas = $("stage");
    this.ctx = this.canvas.getContext("2d");
    this.synth = new Synth();
    this.ads = new AdBridge();
    this.fx = new FX();
    this.state = loadState();
    this.challenge = parseChallenge(location.search);
    this.screen = "menu";
    this.run = null;
    this.rng = () => Math.random();
    this.pulse = null;
    this.last = performance.now();
    this.dpr = 1;
    this.slowmo = 0;
    this.stars = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.2 + Math.random() * 0.8,
    }));
    this._bind();
  }

  async start() {
    this.state = saveState(touchStreak(this.state));
    this.paintMeta();
    this.show("menu");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("pointerdown", (e) => this.onPointer(e), { passive: false });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        this.tryTap();
      }
    });
    this.loop(performance.now());
    this.ads.init();
    if (this.challenge) this.showChallengeBanner();
  }

  _bind() {
    $("btn-play").onclick = () => this.begin("endless");
    $("btn-daily").onclick = () => this.begin("daily");
    $("btn-how").onclick = () => this.show("how");
    $("btn-shop").onclick = () => {
      this.renderShop();
      this.show("shop");
    };
    $("btn-settings").onclick = () => {
      this.fillSettings();
      this.show("settings");
    };
    for (const id of ["how-back", "shop-back", "settings-back"]) {
      $(id).onclick = () => this.show("menu");
    }
    $("btn-retry").onclick = () => this.begin(this.run?.mode || "endless");
    $("btn-home").onclick = () => this.show("menu");
    $("btn-share").onclick = () => this.doShare();
    $("btn-continue").onclick = () => this.doContinue();
    $("name-input").onchange = () => {
      this.state.name = sanitizeName($("name-input").value);
      saveState(this.state);
      this.paintMeta();
    };
    $("tog-sound").onchange = () => {
      this.state.sound = $("tog-sound").checked;
      this.synth.setEnabled(this.state.sound);
      saveState(this.state);
    };
    $("tog-haptics").onchange = () => {
      this.state.haptics = $("tog-haptics").checked;
      saveState(this.state);
    };
    $("btn-copy-link").onclick = async () => {
      const url = challengeUrl({
        score: this.state.best || 1,
        name: this.state.name,
        mode: "endless",
      });
      try {
        await navigator.clipboard.writeText(url);
        this.toast("Challenge link copied");
      } catch {
        this.toast(url);
      }
    };
  }

  fillSettings() {
    $("name-input").value = this.state.name;
    $("tog-sound").checked = this.state.sound;
    $("tog-haptics").checked = this.state.haptics;
  }

  showChallengeBanner() {
    const el = $("challenge-banner");
    el.hidden = false;
    el.innerHTML = `<strong>Beat ${this.challenge.name}</strong> · ${this.challenge.score.toLocaleString("en-US")} · ${this.challenge.mode === "daily" ? "today's seed" : "endless"}`;
  }

  paintMeta() {
    $("meta-best").textContent = this.state.best.toLocaleString("en-US");
    $("meta-coins").textContent = String(this.state.coins);
    $("meta-streak").textContent = String(this.state.streak);
    $("player-chip").textContent = this.state.name;
  }

  show(name) {
    this.screen = name;
    for (const el of document.querySelectorAll(".screen")) {
      el.hidden = el.id !== `screen-${name}`;
    }
    $("hud").hidden = name !== "play";
    document.body.dataset.screen = name;
  }

  begin(mode) {
    this.synth.unlock();
    this.synth.setEnabled(this.state.sound);
    const seed = mode === "daily" ? dailySeed() : (Math.random() * 0xffffffff) >>> 0;
    this.rng = mulberry32(seed);
    this.run = createRunState(mode, seed);
    this.fx = new FX();
    this.slowmo = 0;
    this.show("play");
    this.updateHud();
    this.spawnPulse();
    this.buzz(12);
  }

  spawnPulse() {
    const { w, h, min } = this.size();
    const cx = w / 2;
    const cy = h * 0.52;
    const pattern = nextPattern(this.run.hitIndex, this.rng);
    const target = targetRadius(min, this.rng);
    const from = startRadius(min, pattern.expanding, target);
    const missR = pattern.expanding ? Math.min(min * 0.48, target * 1.85) : Math.max(10, target * 0.12);
    this.pulse = {
      cx,
      cy,
      from,
      to: missR,
      target,
      t: 0,
      dur: pulseDurationMs(this.run.hitIndex, this.rng),
      expanding: pattern.expanding,
      consumed: false,
    };
  }

  size() {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    return { w, h, min: Math.min(w, h) };
  }

  resize() {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  onPointer(e) {
    if (this.screen !== "play") return;
    e.preventDefault();
    this.tryTap();
  }

  tryTap() {
    if (this.screen !== "play" || !this.run || this.run.over || !this.pulse || this.pulse.consumed) return;
    this.synth.unlock();
    const r = pulseRadius(this.pulse.t, this.pulse.from, this.pulse.to);
    const grade = judge(r, this.pulse.target);
    this.resolve(grade);
  }

  resolve(grade) {
    this.pulse.consumed = true;
    const { w, h } = this.size();
    const skin = skinById(this.state.skin);
    const { run, gained } = applyTap(this.run, grade);
    this.run = run;
    const colors = { perfect: skin.perfect, great: skin.target, good: skin.pulse, miss: "#ff5d7a" };
    this.fx.callout(grade.toUpperCase());
    this.fx.burst(w / 2, h * 0.52, colors[grade], grade === "perfect" ? 36 : 18);
    this.fx.shock(w / 2, h * 0.52, colors[grade]);
    if (grade === "perfect") {
      this.synth.perfect();
      this.fx.punch(10, skin.perfect);
      this.buzz(28);
    } else if (grade === "great") {
      this.synth.great();
      this.fx.punch(6, skin.target);
      this.buzz(18);
    } else if (grade === "good") {
      this.synth.good();
      this.buzz(10);
    } else {
      this.synth.miss();
      this.fx.punch(16, "#ff5d7a");
      this.buzz(50);
    }
    if (run.fever && run.combo === 8) this.synth.fever();
    this.updateHud(gained);
    if (run.over) {
      this.finish();
      return;
    }
    window.setTimeout(() => {
      if (this.screen === "play" && this.run && !this.run.over) this.spawnPulse();
    }, 90);
  }

  updateHud(gained) {
    $("hud-score").textContent = this.run.score.toLocaleString("en-US");
    $("hud-combo").textContent = this.run.combo ? `x${this.run.combo}` : "";
    $("hud-combo").classList.toggle("fever", this.run.fever);
    $("hud-lives").innerHTML = Array.from({ length: START_LIVES }, (_, i) =>
      `<span class="${i < this.run.lives ? "on" : ""}">♥</span>`
    ).join("");
    $("hud-gain").textContent = gained ? `+${gained}` : "";
    $("hud-mode").textContent = this.run.mode === "daily" ? "DAILY" : "ENDLESS";
  }

  async finish() {
    this.synth.gameOver();
    const date = utcDateString();
    const { state, coins } = recordRun(this.state, {
      score: this.run.score,
      mode: this.run.mode,
      date,
    });
    this.state = saveState(state);
    this.paintMeta();
    $("over-score").textContent = this.run.score.toLocaleString("en-US");
    $("over-best").textContent = `Best ${this.state.best.toLocaleString("en-US")}`;
    $("over-coins").textContent = `+${coins} coins`;
    const beaten =
      this.challenge && this.run.score > this.challenge.score
        ? this.challenge
        : null;
    $("over-rival").hidden = !this.challenge;
    if (this.challenge) {
      $("over-rival").textContent = beaten
        ? `You beat ${this.challenge.name}!`
        : `${this.challenge.score - this.run.score} short of ${this.challenge.name}`;
      $("over-rival").classList.toggle("win", Boolean(beaten));
    }
    const canContinue = !this.run.continued;
    $("btn-continue").hidden = !canContinue;
    $("btn-continue").textContent = this.ads.native ? "Watch ad to continue" : "Continue (1 revive)";
    this.show("over");
    if (beaten) {
      window.setTimeout(() => this.doShare({ beaten }), 500);
    }
    const shown = await this.ads.showInterstitial(this.state);
    if (shown) {
      this.state.gamesSinceInterstitial = 0;
      saveState(this.state);
    }
  }

  async doContinue() {
    const result = await this.ads.showRewarded();
    if (!result.earned) {
      this.toast("Ad not finished — no revive");
      return;
    }
    this.run = grantContinue(this.run);
    this.slowmo = 0.9;
    this.synth.continue();
    this.show("play");
    this.updateHud();
    this.spawnPulse();
  }

  async doShare(extra = {}) {
    const beaten = extra.beaten || (this.challenge && this.run?.score > this.challenge.score ? this.challenge : null);
    const score = this.run?.score || this.state.best;
    const result = await shareChallenge({
      score,
      name: this.state.name,
      best: this.state.best,
      streak: this.state.streak,
      mode: this.run?.mode || "endless",
      beaten,
      skin: skinById(this.state.skin),
    });
    if (result.via === "clipboard") this.toast("Challenge copied — paste it anywhere");
    else if (!result.ok && result.via !== "abort") this.toast("Share this: " + result.url);
  }

  renderShop() {
    const box = $("shop-list");
    box.innerHTML = "";
    $("shop-coins").textContent = `${this.state.coins} coins`;
    for (const skin of SKINS) {
      const owned = this.state.owned.includes(skin.id);
      const active = this.state.skin === skin.id;
      const b = document.createElement("button");
      b.className = `skin-card${active ? " active" : ""}`;
      b.innerHTML = `<i style="--a:${skin.target};--b:${skin.pulse}"></i><b>${skin.name}</b><span>${owned ? (active ? "Equipped" : "Own") : `${skin.price} coins`}</span>`;
      b.onclick = () => {
        const res = buySkin(this.state, skin.id);
        if (!res.ok) {
          this.toast("Need more coins — play another run");
          return;
        }
        this.state = saveState(res.state);
        this.paintMeta();
        this.renderShop();
      };
      box.appendChild(b);
    }
  }

  buzz(ms) {
    if (!this.state.haptics) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* ignore */
    }
  }

  toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    window.clearTimeout(this._toast);
    this._toast = window.setTimeout(() => {
      t.hidden = true;
    }, 2400);
  }

  loop(now) {
    const raw = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = this.slowmo > 0 ? raw * 0.45 : raw;
    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - raw);
    this.fx.step(dt);
    if (this.screen === "play" && this.pulse && !this.pulse.consumed && this.run && !this.run.over) {
      this.pulse.t += dt / (this.pulse.dur / 1000);
      if (this.pulse.t >= 1) this.resolve("miss");
    }
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  draw() {
    const ctx = this.ctx;
    const { w, h } = this.size();
    const skin = skinById(this.state.skin);
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.45, Math.max(w, h) * 0.8);
    bg.addColorStop(0, this.run?.fever ? "#14201c" : "#0b1020");
    bg.addColorStop(1, "#05060a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (const s of this.stars) {
      s.y += 0.0004 * s.z;
      if (s.y > 1) s.y = 0;
      ctx.globalAlpha = 0.25 + s.z * 0.5;
      ctx.fillStyle = "#c9e8ff";
      ctx.fillRect(s.x * w, s.y * h, s.z * 1.8, s.z * 1.8);
    }
    ctx.globalAlpha = 1;

    if (this.screen === "play" && this.pulse) {
      const p = this.pulse;
      const r = pulseRadius(Math.min(1, p.t), p.from, p.to);
      ctx.save();
      ctx.translate(p.cx, p.cy);
      ctx.strokeStyle = skin.target;
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = this.run.fever ? 28 : 16;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(0, 0, p.target, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,229,106,0.22)";
      ctx.lineWidth = 14;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, p.target, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = this.run.fever ? skin.perfect : skin.pulse;
      ctx.shadowColor = skin.pulse;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, r), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = skin.perfect;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(w / 2, h * 0.4);
      const t = performance.now() / 1000;
      ctx.strokeStyle = skin.target;
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = 22;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 86 + Math.sin(t * 2) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = skin.pulse;
      ctx.beginPath();
      ctx.arc(0, 0, 130 + Math.cos(t * 1.6) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.fx.draw(ctx, w, h);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new PulseRush();
  app.start();
  window.PulseRushApp = app;
});
