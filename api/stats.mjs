import { readPulseSummary, statsKeyOk } from "./pulse-store.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ ok: false });
    return;
  }
  const url = new URL(req.url, "https://pulserush-six.vercel.app");
  if (!statsKeyOk(url.searchParams.get("k"))) {
    res.status(401).json({ ok: false, error: "bad key" });
    return;
  }
  try {
    const summary = await readPulseSummary();
    res.status(200).json({ ok: true, ...summary });
  } catch {
    res.status(500).json({ ok: false, error: "store" });
  }
}
