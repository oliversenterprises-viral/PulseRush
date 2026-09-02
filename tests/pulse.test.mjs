import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPulseEvent,
  emptyPulseState,
  normalizePulseEvent,
  summarizePulse,
} from "../api/pulse-lib.mjs";
import { statsKeyOk } from "../api/pulse-store.mjs";
import statsHandler from "../api/stats.mjs";
import pulseHandler from "../api/pulse.mjs";

function mockRes() {
  const out = { statusCode: 200, body: null, headers: {}, ended: false };
  return {
    out,
    setHeader(k, v) {
      out.headers[k] = v;
    },
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(body) {
      out.body = body;
      out.ended = true;
      return this;
    },
    end() {
      out.ended = true;
      return this;
    },
  };
}

test("normalizePulseEvent accepts play/over/share/heart", () => {
  const now = 1_700_000_000_000;
  assert.equal(normalizePulseEvent({ type: "play", sid: "abc" }, now).type, "play");
  assert.equal(normalizePulseEvent({ type: "over", sid: "abc", score: 12 }, now).score, 12);
  assert.equal(normalizePulseEvent({ type: "share", sid: "abc" }, now).type, "share");
  assert.equal(normalizePulseEvent({ type: "heart", sid: "abc" }, now).type, "heart");
  assert.equal(normalizePulseEvent({ type: "play" }, now), null);
  assert.equal(normalizePulseEvent({ type: "hack", sid: "abc" }, now), null);
});

test("summarizePulse excludes owner devices", () => {
  const now = 1_700_000_000_000;
  let state = emptyPulseState();
  state = applyPulseEvent(state, normalizePulseEvent({ type: "play", sid: "owner", owner: 1 }, now));
  state = applyPulseEvent(state, normalizePulseEvent({ type: "play", sid: "p1" }, now));
  state = applyPulseEvent(state, normalizePulseEvent({ type: "over", sid: "p1", score: 80 }, now));
  state = applyPulseEvent(state, normalizePulseEvent({ type: "share", sid: "p2" }, now));
  state = applyPulseEvent(state, normalizePulseEvent({ type: "heart", sid: "p2" }, now));
  const summary = summarizePulse(state, now);
  assert.equal(summary.playingNow, 2);
  assert.equal(summary.uniqueOthers24h, 2);
  assert.equal(summary.otherRuns24h, 1);
  assert.equal(summary.otherShares24h, 1);
  assert.equal(summary.uniqueOthers7d, 2);
  assert.ok(summary.recentOthers.some((row) => row.type === "over" && row.score === 80));
  assert.ok(!summary.recentOthers.some((row) => row.type === "heart"));
});

test("statsKeyOk requires env key", () => {
  const prev = process.env.PULSERUSH_STATS_KEY;
  delete process.env.PULSERUSH_STATS_KEY;
  assert.equal(statsKeyOk("x"), false);
  process.env.PULSERUSH_STATS_KEY = "secret";
  assert.equal(statsKeyOk("secret"), true);
  assert.equal(statsKeyOk("nope"), false);
  assert.equal(statsKeyOk(""), false);
  if (prev == null) delete process.env.PULSERUSH_STATS_KEY;
  else process.env.PULSERUSH_STATS_KEY = prev;
});

test("GET /api/stats without key is 401", async () => {
  const res = mockRes();
  await statsHandler({ method: "GET", url: "/api/stats" }, res);
  assert.equal(res.out.statusCode, 401);
  assert.equal(res.out.body.ok, false);
  assert.equal(res.out.headers["Cache-Control"], "no-store");
});

test("POST /api/pulse rejects a bad body with 400", async () => {
  const res = mockRes();
  await pulseHandler({ method: "POST", body: { type: "nope" } }, res);
  assert.equal(res.out.statusCode, 400);
});
