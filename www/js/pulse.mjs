const SID_KEY = "pulserush.sid";
const OWNER_KEY = "pulserush.owner";

function randomSid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function sessionId() {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = randomSid();
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

export function markOwnerFromUrl(search = location.search) {
  try {
    const q = new URLSearchParams(search);
    if (q.get("owner") === "1") localStorage.setItem(OWNER_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isOwner() {
  try {
    return localStorage.getItem(OWNER_KEY) === "1";
  } catch {
    return false;
  }
}

export function sendPulse(type, extra = {}) {
  const payload = {
    type,
    sid: sessionId(),
    owner: isOwner(),
    t: Date.now(),
    ...extra,
  };
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/pulse", blob)) return;
  } catch {
    /* fall through */
  }
  try {
    fetch("/api/pulse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
