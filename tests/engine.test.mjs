import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTap,
  buildChallengeParams,
  coinsForScore,
  comboAfter,
  createRunState,
  grantContinue,
  judge,
  parseChallenge,
  pulseRadius,
  sanitizeName,
  scoreFor,
  shareCopy,
  utcDateString,
} from "../www/js/engine.mjs";

test("judge windows", () => {
  assert.equal(judge(100, 100), "perfect");
  assert.equal(judge(104, 100), "perfect");
  assert.equal(judge(108, 100), "great");
  assert.equal(judge(114, 100), "good");
  assert.equal(judge(140, 100), "miss");
  assert.equal(judge(NaN, 100), "miss");
});

test("combo and scoring", () => {
  assert.equal(comboAfter("perfect", 3), 4);
  assert.equal(comboAfter("good", 3), 3);
  assert.equal(comboAfter("miss", 9), 0);
  assert.ok(scoreFor("perfect", 10, true) > scoreFor("perfect", 0, false));
  assert.equal(coinsForScore(120), 10);
});

test("run applyTap miss ends at 0 lives", () => {
  let run = createRunState("endless", 1);
  for (let i = 0; i < 3; i++) {
    run = applyTap(run, "miss").run;
  }
  assert.equal(run.lives, 0);
  assert.equal(run.over, true);
  const revived = grantContinue(run);
  assert.equal(revived.lives, 1);
  assert.equal(revived.over, false);
  assert.equal(revived.continued, true);
  assert.equal(grantContinue(revived).continued, true);
});

test("pulseRadius interpolates", () => {
  assert.equal(pulseRadius(0, 10, 20), 10);
  assert.equal(pulseRadius(1, 10, 20), 20);
  assert.equal(pulseRadius(0.5, 10, 20), 15);
});

test("challenge parse and copy", () => {
  const q = buildChallengeParams({ score: 2847, name: "Nova!!", date: "2026-08-23", mode: "daily" });
  const parsed = parseChallenge(q);
  assert.equal(parsed.score, 2847);
  assert.equal(parsed.name, "Nova");
  assert.equal(parsed.mode, "daily");
  assert.equal(parseChallenge("?x=1"), null);
  const text = shareCopy({ score: 2847, name: "Nova", url: "https://pulserush.vercel.app/?c=2847" });
  assert.match(text, /2,847/);
  assert.match(text, /Beat me/);
});

test("sanitizeName", () => {
  assert.equal(sanitizeName(""), "Racer");
  assert.equal(sanitizeName("abcdefghijklmnop"), "abcdefghijkl");
});

test("utcDateString shape", () => {
  assert.match(utcDateString(new Date("2026-08-23T12:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});
