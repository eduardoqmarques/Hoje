const BASE = "https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1";
const SAO_SEBASTIAO = "38";
let cached = { token: null, expires: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.expires) return cached.token;
  const r = await fetch("https://api.metrolisboa.pt:8243/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(process.env.ML_KEY + ":" + process.env.ML_SECRET).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("Token request failed: " + r.status + " | key length " + (process.env.ML_KEY || "").length + ", secret length " + (process.env.ML_SECRET || "").length + " | " + (await r.text()).slice(0, 200));
  const j = await r.json();
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 };
  return cached.token;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const dir = req.query.dir === "ae" ? "ae" : "ss";
    const auth = { headers: { Authorization: "Bearer " + (await getToken()) } };
    const [w, s] = await Promise.all([
      fetch(BASE + "/tempoEspera/Estacao/OL", auth),
      fetch(BASE + "/estadoLinha/Vermelha", auth),
    ]);
    if (!w.ok) throw new Error("Waiting times failed: " + w.status);
    const waits = await w.json();
    const status = s.ok ? await s.json() : null;
    const list = waits.resposta || [];
    const p = list.find((x) => (dir === "ss" ? x.destino === SAO_SEBASTIAO : x.destino !== SAO_SEBASTIAO));
    const secs = p ? [p.tempoChegada1, p.tempoChegada2, p.tempoChegada3].filter((n) => typeof n === "number" && n >= 0) : [];
    const out = { dir, destino: p ? p.destino : null, secs, updated: p ? p.hora : null, status };
    if (req.query.debug) out.raw = waits;
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
