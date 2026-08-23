import { buildChallengeParams, sanitizeName, shareCopy, utcDateString } from "./engine.mjs";

export const DEFAULT_ORIGIN = "https://pulserush.vercel.app";

export function publicOrigin() {
  const cfg = window.PULSERUSH_ORIGIN;
  if (cfg) return cfg.replace(/\/$/, "");
  if (location.protocol.startsWith("http") && !/localhost|127\.0\.0\.1/i.test(location.host)) {
    return location.origin;
  }
  return DEFAULT_ORIGIN;
}

export function challengeUrl({ score, name, mode, date }) {
  const origin = publicOrigin();
  const q = buildChallengeParams({
    score,
    name,
    mode,
    date: date || utcDateString(),
  });
  return `${origin}/?${q.toString()}`;
}

export function drawShareCard(canvas, { score, name, best, streak, beaten, skin }) {
  const w = 1080;
  const h = 1350;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#05060d");
  g.addColorStop(0.45, "#0b1224");
  g.addColorStop(1, "#12061a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.55;
  const rg = ctx.createRadialGradient(w * 0.5, h * 0.38, 40, w * 0.5, h * 0.38, 520);
  rg.addColorStop(0, skin?.glow || "#39f6ff");
  rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.38, 520, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = skin?.target || "#39f6ff";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.38, 210, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = skin?.pulse || "#ff3df0";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.38, 300, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffe56a";
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.38, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9aa4c7";
  ctx.font = "700 42px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PULSERUSH", w / 2, 120);

  ctx.fillStyle = "#f4f7ff";
  ctx.font = "800 96px Trebuchet MS, sans-serif";
  ctx.fillText(sanitizeName(name).toUpperCase(), w / 2, 780);

  ctx.fillStyle = skin?.perfect || "#ffe56a";
  ctx.font = "900 160px Trebuchet MS, sans-serif";
  ctx.fillText(Number(score).toLocaleString("en-US"), w / 2, 960);

  ctx.fillStyle = "#9aa4c7";
  ctx.font = "600 36px Trebuchet MS, sans-serif";
  const sub = beaten
    ? `beat ${sanitizeName(beaten.name)} · ${beaten.score.toLocaleString("en-US")}`
    : `best ${Number(best || score).toLocaleString("en-US")}  ·  streak ${streak || 1}`;
  ctx.fillText(sub, w / 2, 1030);

  ctx.fillStyle = "#39f6ff";
  ctx.font = "800 40px Trebuchet MS, sans-serif";
  ctx.fillText("BEAT THIS SCORE", w / 2, 1170);
  ctx.fillStyle = "#c9d2f0";
  ctx.font = "600 28px Trebuchet MS, sans-serif";
  ctx.fillText("pulserush.vercel.app", w / 2, 1224);
}

export async function shareChallenge(payload) {
  const url = challengeUrl(payload);
  const text = shareCopy({ ...payload, url, beaten: payload.beaten });
  const canvas = document.createElement("canvas");
  drawShareCard(canvas, payload);

  let file = null;
  try {
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    if (blob) file = new File([blob], "pulserush-score.png", { type: "image/png" });
  } catch {
    file = null;
  }

  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: "PulseRush", text, url, dialogTitle: "Challenge a friend" });
      return { ok: true, url, via: "capacitor" };
    } catch {
      /* fall through */
    }
  }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: "PulseRush", text, url, files: [file] });
      return { ok: true, url, via: "files" };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, url, via: "abort" };
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: "PulseRush", text, url });
      return { ok: true, url, via: "share" };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, url, via: "abort" };
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, url, via: "clipboard" };
  } catch {
    return { ok: false, url, via: "none", text };
  }
}
