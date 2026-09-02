const TYPES = new Set(["play", "over", "share", "heart"]);
const MAX_EVENTS = 4000;
const LIVE_MS = 2 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function emptyPulseState() {
  return { events: [] };
}

export function normalizePulseEvent(body, now = Date.now()) {
  if (!body || typeof body !== "object") return null;
  const type = String(body.type || "").trim().toLowerCase();
  if (!TYPES.has(type)) return null;
  const sid = String(body.sid || "").trim().slice(0, 80);
  if (!sid) return null;
  const owner = body.owner === true || body.owner === 1 || body.owner === "1";
  const scoreRaw = Number(body.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(1e9, Math.floor(scoreRaw))) : 0;
  const mode = String(body.mode || "").trim().slice(0, 16);
  const tRaw = Number(body.t);
  const t = Number.isFinite(tRaw) ? Math.min(now + 5000, Math.max(0, tRaw)) : now;
  return { type, sid, owner, score, mode, t };
}

export function applyPulseEvent(state, evt) {
  const events = Array.isArray(state?.events) ? state.events.slice() : [];
  events.push(evt);
  const cutoff = (evt?.t || Date.now()) - WEEK_MS - DAY_MS;
  const kept = events.filter((e) => Number(e?.t) >= cutoff);
  if (kept.length > MAX_EVENTS) kept.splice(0, kept.length - MAX_EVENTS);
  return { events: kept };
}

export function summarizePulse(state, now = Date.now()) {
  const events = Array.isArray(state?.events) ? state.events : [];
  const others = events.filter((e) => e && !e.owner);
  const liveFrom = now - LIVE_MS;
  const from24h = now - DAY_MS;
  const from7d = now - WEEK_MS;
  const last24 = others.filter((e) => e.t >= from24h);
  const last7 = others.filter((e) => e.t >= from7d);
  const liveSids = new Set();
  for (const e of others) {
    if (e.t >= liveFrom && (e.type === "heart" || e.type === "play")) liveSids.add(e.sid);
  }
  const unique = (list) => new Set(list.map((e) => e.sid)).size;
  const recentOthers = others
    .filter((e) => e.type !== "heart")
    .slice(-24)
    .reverse()
    .map((e) => ({
      type: e.type,
      score: e.score,
      mode: e.mode,
      t: e.t,
    }));
  return {
    playingNow: liveSids.size,
    uniqueOthers24h: unique(last24),
    otherRuns24h: last24.filter((e) => e.type === "play").length,
    otherShares24h: last24.filter((e) => e.type === "share").length,
    uniqueOthers7d: unique(last7),
    recentOthers,
  };
}
