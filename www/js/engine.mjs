/** Pure PulseRush rules — no DOM. Safe to unit test in Node. */

export const WINDOWS = Object.freeze({ perfect: 0.045, great: 0.09, good: 0.155 });

export const POINTS = Object.freeze({ perfect: 100, great: 70, good: 40, miss: 0 });

export const START_LIVES = 3;
export const MAX_COMBO_DISPLAY = 99;
export const FEVER_AT = 8;
export const MIN_PULSE_MS = 430;
export const MAX_PULSE_MS = 1380;
export const CONTINUE_SLOWMO_MS = 900;

export function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed(dateStr = utcDateString()) {
  return hashString(`pulserush-daily-${dateStr}`);
}

export function judge(pulseR, targetR, windows = WINDOWS) {
  if (!Number.isFinite(pulseR) || !Number.isFinite(targetR) || targetR <= 0) {
    return "miss";
  }
  const err = Math.abs(pulseR - targetR) / targetR;
  if (err <= windows.perfect) return "perfect";
  if (err <= windows.great) return "great";
  if (err <= windows.good) return "good";
  return "miss";
}

export function comboAfter(grade, combo) {
  if (grade === "perfect" || grade === "great") return combo + 1;
  if (grade === "good") return combo;
  return 0;
}

export function scoreFor(grade, combo, fever) {
  const base = POINTS[grade] ?? 0;
  if (!base) return 0;
  const comboMul = 1 + Math.min(combo, 24) * 0.08;
  const feverMul = fever ? 2 : 1;
  return Math.round(base * comboMul * feverMul);
}

export function coinsForScore(score) {
  return Math.max(0, Math.floor(score / 12));
}

export function pulseDurationMs(hitIndex, rng) {
  const t = Math.min(1, hitIndex / 42);
  const base = MAX_PULSE_MS - (MAX_PULSE_MS - MIN_PULSE_MS) * (t * t);
  const jitter = 1 + (rng() - 0.5) * 0.08;
  return Math.round(Math.max(MIN_PULSE_MS, base * jitter));
}

export function nextPattern(hitIndex, rng) {
  const reverseChance = Math.min(0.42, 0.08 + hitIndex * 0.012);
  const expanding = rng() < reverseChance;
  const double = hitIndex > 18 && rng() < Math.min(0.22, (hitIndex - 18) * 0.012);
  return { expanding, double: Boolean(double) };
}

export function targetRadius(minDim, rng) {
  const u = 0.16 + rng() * 0.07;
  return minDim * u;
}

export function startRadius(minDim, expanding, targetR) {
  if (expanding) return Math.max(12, targetR * 0.18);
  return minDim * 0.46;
}

/**
 * Linear pulse for fair timing. t is 0..1.
 */
export function pulseRadius(t, fromR, toR) {
  const x = Math.min(1, Math.max(0, t));
  return fromR + (toR - fromR) * x;
}

/**
 * Progress (0..1) when the moving ring crosses the target ring.
 * Used to schedule the audio cue on the same instant as the visual hit.
 * Does not change scoring or judge windows.
 */
export function hitProgress(fromR, toR, targetR) {
  const span = toR - fromR;
  if (!Number.isFinite(span) || Math.abs(span) < 1e-6) return 0.5;
  if (!Number.isFinite(fromR) || !Number.isFinite(targetR)) return 0.5;
  const t = (targetR - fromR) / span;
  return Math.min(0.98, Math.max(0.02, t));
}

export function clampLives(n) {
  return Math.max(0, Math.min(START_LIVES, n | 0));
}

export function sanitizeName(raw, fallback = "Racer") {
  const s = String(raw || "")
    .replace(/[^\w\s\-_.]/g, "")
    .trim()
    .slice(0, 12);
  return s || fallback;
}

export function buildChallengeParams({ score, name, date, mode }) {
  const p = new URLSearchParams();
  p.set("c", String(Math.max(0, score | 0)));
  p.set("n", sanitizeName(name));
  p.set("d", date || utcDateString());
  p.set("m", mode === "daily" ? "daily" : "endless");
  p.set("v", "1");
  return p;
}

export function parseChallenge(search) {
  const q = typeof search === "string" ? new URLSearchParams(search) : search;
  const c = Number(q.get("c"));
  if (!Number.isFinite(c) || c <= 0) return null;
  return {
    score: Math.floor(c),
    name: sanitizeName(q.get("n"), "Rival"),
    date: q.get("d") || utcDateString(),
    mode: q.get("m") === "daily" ? "daily" : "endless",
  };
}

export function shareCopy({ score, name, url, beaten }) {
  const s = Number(score).toLocaleString("en-US");
  if (beaten) {
    return `I just beat ${sanitizeName(beaten.name)} (${beaten.score.toLocaleString("en-US")}) with ${s} on PulseRush. Your turn. ${url}`;
  }
  return `I scored ${s} on PulseRush. Beat me. ${url}`;
}

export const SKINS = Object.freeze([
  {
    id: "volt",
    name: "Volt",
    price: 0,
    target: "#39f6ff",
    pulse: "#ff3df0",
    perfect: "#ffe56a",
    glow: "#39f6ff",
  },
  {
    id: "ember",
    name: "Ember",
    price: 400,
    target: "#ff6b2d",
    pulse: "#ffd166",
    perfect: "#fff1a8",
    glow: "#ff6b2d",
  },
  {
    id: "ion",
    name: "Ion",
    price: 800,
    target: "#7cff6b",
    pulse: "#4de1ff",
    perfect: "#eaff6b",
    glow: "#7cff6b",
  },
  {
    id: "void",
    name: "Void",
    price: 1200,
    target: "#c084fc",
    pulse: "#67e8f9",
    perfect: "#f0abfc",
    glow: "#a78bfa",
  },
  {
    id: "gold",
    name: "Goldline",
    price: 2000,
    target: "#f5c542",
    pulse: "#fff6c2",
    perfect: "#ffffff",
    glow: "#f5c542",
  },
]);

export function skinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export function createRunState(mode, seed) {
  return {
    mode: mode === "daily" ? "daily" : "endless",
    seed: seed >>> 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: START_LIVES,
    hits: 0,
    perfects: 0,
    fever: false,
    continued: false,
    over: false,
    hitIndex: 0,
  };
}

export function applyTap(run, grade) {
  const next = { ...run };
  next.combo = comboAfter(grade, run.combo);
  next.bestCombo = Math.max(next.bestCombo, next.combo);
  next.fever = next.combo >= FEVER_AT;
  const gained = scoreFor(grade, run.combo, run.fever);
  next.score += gained;
  if (grade === "perfect") next.perfects += 1;
  if (grade === "miss") {
    next.lives = clampLives(run.lives - 1);
    next.fever = false;
    if (next.lives <= 0) next.over = true;
  } else {
    next.hits += 1;
  }
  next.hitIndex += 1;
  return { run: next, gained, grade };
}

export function grantContinue(run) {
  if (run.continued || !run.over) return run;
  return {
    ...run,
    lives: 1,
    over: false,
    continued: true,
    combo: 0,
    fever: false,
  };
}
