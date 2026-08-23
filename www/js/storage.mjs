import { SKINS, sanitizeName, utcDateString } from "./engine.mjs";

const KEY = "pulserush.v1";

const DEFAULTS = {
  name: "Racer",
  coins: 0,
  best: 0,
  bestDaily: 0,
  bestDailyDate: "",
  skin: "volt",
  owned: ["volt"],
  haptics: true,
  sound: true,
  adsRemoved: false,
  streak: 0,
  lastPlayDate: "",
  runs: 0,
  gamesSinceInterstitial: 0,
  history: [],
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, owned: [...DEFAULTS.owned] };
    const parsed = JSON.parse(raw);
    const owned = Array.isArray(parsed.owned) ? parsed.owned : ["volt"];
    if (!owned.includes("volt")) owned.unshift("volt");
    return {
      ...DEFAULTS,
      ...parsed,
      name: sanitizeName(parsed.name, "Racer"),
      owned: [...new Set(owned)].filter((id) => SKINS.some((s) => s.id === id)),
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : [],
    };
  } catch {
    return { ...DEFAULTS, owned: [...DEFAULTS.owned] };
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function touchStreak(state, today = utcDateString()) {
  const next = { ...state };
  if (next.lastPlayDate === today) return next;
  const y = new Date(`${today}T00:00:00.000Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  next.streak = next.lastPlayDate === yesterday ? next.streak + 1 : 1;
  next.lastPlayDate = today;
  if (next.streak === 1) next.coins += 15;
  else next.coins += Math.min(80, 10 + next.streak * 5);
  return next;
}

export function recordRun(state, { score, mode, date }) {
  const next = { ...state, runs: state.runs + 1, gamesSinceInterstitial: (state.gamesSinceInterstitial || 0) + 1 };
  next.best = Math.max(state.best, score);
  if (mode === "daily") {
    if (date !== state.bestDailyDate) {
      next.bestDaily = score;
      next.bestDailyDate = date;
    } else {
      next.bestDaily = Math.max(state.bestDaily, score);
    }
  }
  const coins = Math.max(0, Math.floor(score / 12));
  next.coins = state.coins + coins;
  next.history = [{ score, mode, date, at: Date.now() }, ...state.history].slice(0, 30);
  return { state: next, coins };
}

export function buySkin(state, skinId) {
  const skin = SKINS.find((s) => s.id === skinId);
  if (!skin) return { ok: false, reason: "missing", state };
  if (state.owned.includes(skinId)) {
    return { ok: true, state: { ...state, skin: skinId } };
  }
  if (state.coins < skin.price) return { ok: false, reason: "poor", state };
  return {
    ok: true,
    state: {
      ...state,
      coins: state.coins - skin.price,
      owned: [...state.owned, skinId],
      skin: skinId,
    },
  };
}
