// S&P 500 quote. Tries Yahoo Finance first (has previous close), then Stooq (price only).
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  try {
    const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&range=1d", { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error("yahoo " + r.status);
    const m = (await r.json()).chart.result[0].meta;
    const p = m.regularMarketPrice, prev = m.chartPreviousClose;
    return res.status(200).json({ p, pct: prev ? ((p - prev) / prev) * 100 : null, t: m.regularMarketTime * 1000, src: "Yahoo Finance" });
  } catch (e) {
    try {
      const r = await fetch("https://stooq.com/q/l/?s=%5Espx&f=sd2t2ohlcv&h&e=csv");
      const row = (await r.text()).trim().split("\n")[1].split(",");
      const p = parseFloat(row[6]);
      if (!p) throw new Error("no price");
      return res.status(200).json({ p, pct: null, t: null, src: "Stooq" });
    } catch (e2) {
      return res.status(502).json({ error: String(e2.message || e2) });
    }
  }
};
