import { put, list } from "@vercel/blob";
import { applyPulseEvent, emptyPulseState, normalizePulseEvent, summarizePulse } from "./pulse-lib.mjs";

const BLOB_PATH = "pulse-state.json";
const GIST_FILE = "pulserush-pulse.json";

function blobToken() {
  return String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
}
function gistId() {
  return String(process.env.PULSE_GIST_ID || "").trim();
}
function gistToken() {
  return String(process.env.PULSE_GIST_TOKEN || "").trim();
}
export function statsKeyOk(provided) {
  const expected = String(process.env.PULSERUSH_STATS_KEY || "").trim();
  if (!expected || !provided) return false;
  return expected === String(provided);
}
async function gistRequest(method, path, body) {
  const token = gistToken();
  const id = gistId();
  if (!token || !id) throw new Error("pulse store is not configured");
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "pulserush-pulse",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`gist ${res.status}: ${text.slice(0, 180)}`);
  }
  return res.json();
}
async function loadFromBlob() {
  const token = blobToken();
  const listed = await list({ prefix: BLOB_PATH, token, limit: 10 });
  const hit = (listed.blobs || []).find((b) => b.pathname === BLOB_PATH || b.pathname.endsWith("/" + BLOB_PATH));
  if (!hit?.url) return emptyPulseState();
  const res = await fetch(hit.url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return emptyPulseState();
  const parsed = await res.json();
  return parsed && typeof parsed === "object" ? parsed : emptyPulseState();
}
async function saveToBlob(state) {
  await put(BLOB_PATH, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken(),
    contentType: "application/json",
  });
}
export async function loadPulseState() {
  if (blobToken()) return loadFromBlob();
  const id = gistId();
  const data = await gistRequest("GET", `/gists/${id}`);
  const raw = data.files?.[GIST_FILE]?.content || data.files?.[Object.keys(data.files || {})[0]]?.content || "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return emptyPulseState();
}
export async function savePulseState(state) {
  if (blobToken()) {
    await saveToBlob(state);
    return;
  }
  const id = gistId();
  await gistRequest("PATCH", `/gists/${id}`, {
    files: { [GIST_FILE]: { content: JSON.stringify(state) } },
  });
}
export async function recordPulse(body, now = Date.now()) {
  const evt = normalizePulseEvent(body, now);
  if (!evt) return { ok: false, reason: "bad" };
  const state = applyPulseEvent(await loadPulseState(), evt);
  await savePulseState(state);
  return { ok: true, owner: evt.owner };
}
export async function readPulseSummary(now = Date.now()) {
  return summarizePulse(await loadPulseState(), now);
}
