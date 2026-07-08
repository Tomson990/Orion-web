"use client";

import { useEffect, useState } from "react";

const GITHUB_RAW = "https://raw.githubusercontent.com/Tomson990/Orion/main/orion/briefings";

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

export default function Home() {
  const [briefingText, setBriefingText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [tradeIndices, setTradeIndices] = useState<Record<string, TradeIndexData>>({});

  useEffect(() => {
    async function loadBriefing() {
      const today = getTodayFilename();
      setFilename(today);
      try {
        const res = await fetch(`${GITHUB_RAW}/${today}`);
        if (!res.ok) throw new Error("Briefing not available yet");
        const text = await res.text();
        setBriefingText(text);
      } catch {
        setError("Today's briefing is not available yet. Check back soon.");
      } finally {
        setLoading(false);
      }
    }

    async function loadPrices() {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        setPrices(data);
      } catch {
        // prices optional
      }
    }

    async function loadTradeIndices() {
      try {
        const res = await fetch("/api/trade-indices");
        const data = await res.json();
        setTradeIndices(data);
      } catch {
        // trade indices optional
      }
    }

    loadBriefing();
    loadPrices();
    loadTradeIndices();
  }, []);

  const bodyHtml = briefingText ? parseBriefingBody(briefingText) : "";
  const dateLabel = formatDate(filename);
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
            <div className="ticker-timestamp">
              {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} ET
            </div>
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

        {loading && (
          <div className="loading-state">Loading today's briefing...</div>
        )}

        {error && !loading && (
          <div className="loading-state">{error}</div>
        )}

        {!loading && !error && briefingText && (
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
