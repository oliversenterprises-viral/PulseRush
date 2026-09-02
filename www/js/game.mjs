import {
  FEVER_AT,
  SKINS,
  START_LIVES,
  applyTap,
  createRunState,
  dailySeed,
  grantContinue,
  judge,
  hitProgress,
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
import { FX, drawMenuRings, drawPlayArena, drawStars, drawVignette } from "./fx.mjs";
import { challengeUrl, shareChallenge } from "./share.mjs";

const $ = (id) => document.getElementById(id);

const GRADE_COLOR = {
  perfect: "#ffe56a",
  great: "#39f6ff",
  good: "#ff3df0",
  miss: "#ff5d7a",
};

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
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.2 + Math.random() * 0.8,
    }));
    this._overAnim = 0;
    this._bind();
  }

  async start() {
    this.state = saveState(touchStreak(this.state));
    this.paintMeta();
    this.show("menu");
    this.resize();
    const onResize = () => this.resize();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.synth.unlock();
    });
    this.canvas.addEventListener("pointerdown", (e) => this.onPointer(e), { passive: false });
    this.canvas.parentElement.addEventListener("pointerdown", (e) => this.onPointer(e), { passive: false });
    document.addEventListener("keydown", (e) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      if (this.screen === "menu") {
        e.preventDefault();
        this.begin(this.playMode());
        return;
      }
      if (this.screen !== "play") return;
      e.preventDefault();
      this.tryTap();
    });
    this.loop(performance.now());
    this.ads.init();
    if (this.challenge) {
      this.showChallengeBanner();
      document.title = `Beat ${this.challenge.name}'s ${this.challenge.score.toLocaleString("en-US")} — PulseRush`;
    }
  }

  _bind() {
    $("btn-play").onclick = () => this.begin(this.playMode());
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

  playMode() {
    return this.challenge?.mode || "endless";
  }

  showChallengeBanner() {
    const el = $("challenge-banner");
    el.hidden = false;
    el.innerHTML = `<strong>Beat ${this.challenge.name}</strong> · ${this.challenge.score.toLocaleString("en-US")} · ${this.challenge.mode === "daily" ? "today's seed" : "endless"}`;
    $("btn-play").textContent = `BEAT ${this.challenge.score.toLocaleString("en-US")}`;
  }

  paintMeta() {
    $("meta-best").textContent = this.state.best.toLocaleString("en-US");
    $("meta-coins").textContent = String(this.state.coins);
    $("meta-streak").textContent = String(this.state.streak);
    $("player-chip").textContent = this.state.name;
    const hint = $("menu-hint");
    if (hint) {
      hint.textContent = this.challenge
        ? `Beat ${this.challenge.name}. Tap PLAY, then tap when the rings overlap.`
        : this.state.runs > 0
          ? "Tap PLAY. Same pulse. New dare."
          : "Tap PLAY. Hit the pulse when it kisses the ring.";
    }
    if (!this.challenge) $("btn-play").textContent = "PLAY";
  }

  show(name) {
    this.screen = name;
    for (const el of document.querySelectorAll(".screen")) {
      el.hidden = el.id !== `screen-${name}`;
    }
    $("hud").hidden = name !== "play";
    document.body.dataset.screen = name;
    if (name !== "play") this.synth.stopDrone();
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
    this.synth.start();
    this.synth.startDrone();
    this.buzz(12);
  }

  spawnPulse() {
    const { w, h, min } = this.size();
    const cx = w / 2;
    const cy = h * 0.48;
    const pattern = nextPattern(this.run.hitIndex, this.rng);
    const target = targetRadius(min, this.rng);
    const from = startRadius(min, pattern.expanding, target);
    const missR = pattern.expanding ? Math.min(min * 0.48, target * 1.85) : Math.max(10, target * 0.12);
    this.synth.cancelPulseCue();
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
      trail: [],
      perfStart: performance.now(),
      ctxStart: this.synth.ctx ? this.synth.ctx.currentTime : null,
    };
    if (this.run.hitIndex === 0) {
      this.fx.callout("TAP THE RING", "#fff");
      this.fx.hintLife = 2.2;
    }
    this.armPulseCue();
  }

  armPulseCue() {
    const p = this.pulse;
    if (!p || !this.synth.ctx || !this.state.sound) return;
    const hitT = hitProgress(p.from, p.to, p.target);
    const when = this.synth.ctx.currentTime + (hitT * p.dur) / 1000 - this.synth.latencySec();
    this.synth.schedulePulseHit(when);
  }

  size() {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    return { w, h, min: Math.min(w, h) };
  }

  resize() {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const host = this.canvas.parentElement;
    const box = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.pulse) {
      this.pulse.cx = w / 2;
      this.pulse.cy = h * 0.48;
    }
  }

  onPointer(e) {
    if (this.screen !== "play") return;
    if (e.target.closest?.("button, a, input, label")) return;
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
    this.synth.cancelPulseCue();
    const { w, h } = this.size();
    const skin = skinById(this.state.skin);
    const { run, gained } = applyTap(this.run, grade);
    this.run = run;
    const colors = { perfect: skin.perfect, great: skin.target, good: skin.pulse, miss: "#ff5d7a" };
    this.fx.callout(grade.toUpperCase(), GRADE_COLOR[grade]);
    this.fx.burst(w / 2, h * 0.48, colors[grade], grade === "perfect" ? 42 : grade === "miss" ? 14 : 22);
    this.fx.shock(w / 2, h * 0.48, colors[grade]);
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
    if (run.fever && run.combo === FEVER_AT) this.synth.fever();
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
    const bar = $("hud-fever");
    if (bar) {
      const shown = this.run.combo > 0 || this.run.fever;
      bar.hidden = !shown;
      const fill = bar.querySelector("i");
      if (fill) {
        const pct = this.run.fever ? 100 : Math.min(100, (this.run.combo / FEVER_AT) * 100);
        fill.style.width = `${pct}%`;
      }
    }
  }

  async finish() {
    this.synth.gameOver();
    const date = utcDateString();
    const prevBest = this.state.best || 0;
    const isPersonalBest = this.run.score > prevBest;
    const beaten =
      this.challenge && this.run.score > this.challenge.score
        ? this.challenge
        : null;
    const { state, coins } = recordRun(this.state, {
      score: this.run.score,
      mode: this.run.mode,
      date,
    });
    this.state = saveState(state);
    this.paintMeta();
    this.animateOverScore(this.run.score);
    $("over-best").textContent = `Best ${this.state.best.toLocaleString("en-US")}`;
    $("over-coins").textContent = `+${coins} coins`;
    $("over-rival").hidden = !this.challenge;
    if (this.challenge) {
      $("over-rival").textContent = beaten
        ? `You beat ${this.challenge.name}!`
        : `${this.challenge.score - this.run.score} short of ${this.challenge.name}`;
      $("over-rival").classList.toggle("win", Boolean(beaten));
    }
    $("over-dare").textContent = beaten
      ? "You beat them. Send it back."
      : this.run.score <= 0
        ? "Tap when the pulse hits the ring. Try again."
        : isPersonalBest
          ? "New best. Challenge a friend."
          : "Send this. They have to beat your score.";
    $("btn-share").textContent = beaten ? "Send it back" : "Challenge a friend";
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

  animateOverScore(score) {
    const el = $("over-score");
    window.cancelAnimationFrame(this._overAnim);
    if (score <= 0) {
      el.textContent = "0";
      return;
    }
    const start = performance.now();
    const dur = 520;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - (1 - t) * (1 - t);
      el.textContent = Math.round(score * eased).toLocaleString("en-US");
      if (t < 1) this._overAnim = window.requestAnimationFrame(tick);
    };
    this._overAnim = window.requestAnimationFrame(tick);
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
      const p = this.pulse;
      const durSec = p.dur / 1000;
      if (this.slowmo > 0) {
        p.t += dt / durSec;
      } else if (p.ctxStart != null && this.synth.ctx) {
        p.t = (this.synth.ctx.currentTime - p.ctxStart) / durSec;
      } else {
        p.t = (now - p.perfStart) / p.dur;
      }
      const r = pulseRadius(Math.min(1, p.t), p.from, p.to);
      p.trail = p.trail || [];
      p.trail.push(r);
      if (p.trail.length > 5) p.trail.shift();
      if (p.t >= 1) this.resolve("miss");
    }
    this.draw(dt);
    requestAnimationFrame((t) => this.loop(t));
  }

  draw(dt) {
    const ctx = this.ctx;
    const { w, h } = this.size();
    const skin = skinById(this.state.skin);
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 16, w * 0.5, h * 0.46, Math.max(w, h) * 0.85);
    bg.addColorStop(0, this.run?.fever && this.screen === "play" ? "#1a2a20" : "#10182c");
    bg.addColorStop(0.55, "#0a1020");
    bg.addColorStop(1, "#05060a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawStars(ctx, this.stars, w, h, dt);

    if (this.screen === "play" && this.pulse) {
      const p = this.pulse;
      const radius = pulseRadius(Math.min(1, p.t), p.from, p.to);
      drawPlayArena(ctx, { ...p, radius }, skin, this.run.fever, performance.now());
    } else if (this.screen === "menu" || this.screen === "over") {
      drawMenuRings(ctx, w, h, skin, performance.now());
    }

    drawVignette(ctx, w, h);
    this.fx.draw(ctx, w, h);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new PulseRush();
  app.start();
  window.PulseRushApp = app;
});
