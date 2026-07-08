import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  "https://jmrwyluomrranyetgecw.supabase.co",
  "sb_publishable_WJtPwj9Ufax4Y9kZYSUhdA_qCvsb89-"
);

const GITHUB_RAW = "https://raw.githubusercontent.com/Tomson990/Orion/main/orion/briefings";

interface PriceData {
  key: string;
  name: string;
  unit: string;
  price: number;
  changePct: number;
}

interface TradeIndexData {
  valor: number;
  fecha: string;
}

const TRADE_INDEX_LABELS: Record<string, string> = {
  FBX00: "Freightos Baltic",
  WCI: "Drewry WCI",
  SCFI: "Shanghai SCFI",
  BAI00: "Freightos Air",
};

function getTodayFilename() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `briefing_${yyyy}-${mm}-${dd}.txt`;
}

function formatDate(filename: string) {
  const match = filename.match(/briefing_(\d{4}-\d{2}-\d{2})\.txt/);
  if (!match) return "";
  const [yyyy, mm, dd] = match[1].split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[parseInt(mm)-1]} ${parseInt(dd)}, ${yyyy}`;
}

function parseBriefingBody(text: string): string {
  const lines = text.split("\n");
  const startIdx = lines.findIndex(l => l.includes("ORION ENERGY INTELLIGENCE"));
  if (startIdx === -1) return text;

  const bodyLines = lines.slice(startIdx + 2);
  let html = "";

  for (const line of bodyLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      html += "<br/>";
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const content = trimmed.replace(/^## /, "");
      const levelMatch = content.match(/— NIVEL: (ALTA|MEDIA|BAJA)/i);
      const title = content.replace(/— NIVEL: (ALTA|MEDIA|BAJA)/i, "").trim();
      let badge = "";
      if (levelMatch) {
        const level = levelMatch[1].toLowerCase();
        badge = `<span class="level-${level}">${levelMatch[1]}</span>`;
      }
      html += `<h2>${title}${badge}</h2>`;
      continue;
    }

    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      !trimmed.startsWith("**") &&
      !trimmed.startsWith("-") &&
      !trimmed.match(/^\d/)
    ) {
      html += `<p class="section-title">${trimmed}</p>`;
      continue;
    }

    if (trimmed === "---") {
      html += "<hr/>";
      continue;
    }

    const boldLine = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html += `<p>${boldLine}</p>`;
  }

  return html;
}

async function getPrices(): Promise<PriceData[]> {
  const TICKERS = [
    { key: "brent", ticker: "BZ=F", name: "Brent Crude", unit: "USD/bbl" },
    { key: "wti", ticker: "CL=F", name: "WTI Crude", unit: "USD/bbl" },
    { key: "ttf", ticker: "TTF=F", name: "TTF Gas", unit: "EUR/MWh" },
    { key: "henry_hub", ticker: "NG=F", name: "Henry Hub", unit: "USD/MMBtu" },
    { key: "copper", ticker: "HG=F", name: "Copper", unit: "USD/lb" },
  ];

  const results = await Promise.all(
    TICKERS.map(async (t): Promise<PriceData | null> => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.ticker}?interval=1d&range=5d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          cache: "no-store",
        });
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;
        const closes = (result.indicators?.quote?.[0]?.close || []).filter(Boolean);
        if (closes.length < 2) return null;
        const price = closes[closes.length - 1];
        const prev = closes[closes.length - 2];
        const changePct = ((price - prev) / prev) * 100;
        return {
          key: t.key,
          name: t.name,
          unit: t.unit,
          price: Math.round(price * 100) / 100,
          changePct: Math.round(changePct * 10) / 10,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is PriceData => r !== null);
}

async function getTradeIndices(): Promise<Record<string, TradeIndexData>> {
  try {
    const { data, error } = await supabase
      .from("trade_indices")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(20);

    if (error || !data) return {};

    const latest: Record<string, TradeIndexData> = {};
    for (const row of data) {
      if (!latest[row.indicador]) {
        latest[row.indicador] = { valor: row.valor, fecha: row.fecha };
      }
    }
    return latest;
  } catch {
    return {};
  }
}

async function getBriefing(): Promise<{ text: string; filename: string; error: string }> {
  const today = getTodayFilename();
  try {
    const res = await fetch(`${GITHUB_RAW}/${today}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      return { text: "", filename: today, error: "Today's briefing is not available yet. Check back soon." };
    }
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);
    return { text, filename: today, error: "" };
  } catch {
    return { text: "", filename: today, error: "Today's briefing is not available yet. Check back soon." };
  }
}

export default async function Home() {
  const [prices, tradeIndices, briefingData] = await Promise.all([
    getPrices(),
    getTradeIndices(),
    getBriefing(),
  ]);

  const bodyHtml = briefingData.text ? parseBriefingBody(briefingData.text) : "";
  const dateLabel = formatDate(briefingData.filename);
  const tradeIndexEntries = Object.entries(tradeIndices);

  return (
    <>
      {prices.length > 0 && (
        <div className="ticker-bar">
          <div className="ticker-inner">
            {prices.map((p) => (
              <div className="ticker-item" key={p.key}>
                <span className="ticker-name">{p.name}</span>
                <span className="ticker-price">{p.price}</span>
                <span className={`ticker-change ${p.changePct >= 0 ? "up" : "down"}`}>
                  {p.changePct >= 0 ? "▲" : "▼"} {Math.abs(p.changePct)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-logo">ORION</a>
          <span className="site-tagline">Energy Intelligence</span>
        </div>
      </header>

      <main className="main-content">
        {tradeIndexEntries.length > 0 && (
          <div className="trade-indices-block">
            <div className="section-title">Comercio Internacional</div>
            <div className="trade-indices-grid">
              {tradeIndexEntries.map(([key, data]) => (
                <div className="trade-index-item" key={key}>
                  <span className="trade-index-label">
                    {TRADE_INDEX_LABELS[key] || key}
                  </span>
                  <span className="trade-index-value">{data.valor}</span>
                  <span className="trade-index-date">{data.fecha}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {briefingData.error && (
          <div className="loading-state">{briefingData.error}</div>
        )}

        {briefingData.text && (
          <>
            <div className="briefing-eyebrow">Daily Briefing</div>
            <h1 className="briefing-title">Global Energy Intelligence</h1>
            <div className="briefing-date">{dateLabel}</div>

            <div
              className="briefing-body"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </>
        )}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="footer-text">ORION · Global Energy Intelligence · {new Date().getFullYear()}</span>
          <div className="footer-signal" title="Live" />
        </div>
      </footer>
    </>
  );
}
