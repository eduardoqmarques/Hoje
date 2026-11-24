// Stores check-ins and lessons in Upstash Redis (added from the Vercel Storage tab).
// Needs the APP_PIN environment variable; the app sends it in the x-pin header.
const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const cmd = async (c) => {
  const r = await fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(c) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
};
const records = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push(JSON.parse(a[i + 1])); return o; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.APP_PIN || !U || !T) return res.status(500).json({ error: "not configured" });
  if (req.headers["x-pin"] !== process.env.APP_PIN) return res.status(401).json({ error: "bad pin" });
  try {
    if (req.method === "GET") {
      const [c, l] = await Promise.all([cmd(["HGETALL", "hoje:checkins"]), cmd(["HGETALL", "hoje:lessons"])]);
      return res.status(200).json({ checkins: records(c), lessons: records(l) });
    }
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const list = (b.records || []).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(x.d));
      if (!list.length) return res.status(400).json({ error: "no valid records" });
      const key = b.type === "lesson" ? "hoje:lessons" : "hoje:checkins";
      await cmd(["HSET", key, ...list.flatMap((x) => [x.d, JSON.stringify(x)])]);
      return res.status(200).json({ ok: list.length });
    }
    res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
