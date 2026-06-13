"use client";

import { useEffect, useState } from "react";

const GITHUB_RAW = "https://raw.githubusercontent.com/Tomson990/Orion/main/orion";

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

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
}

function parseBriefingBody(text: string): string {
  // Normalizar separadores
  let cleaned = text
    .replace(/={3,}/g, "")
    .replace(/---/g, "\n---\n")
    .replace(/## /g, "\n## ")
    .replace(/\*\*([^*]+):\*\*/g, "\n**$1:**")

  const lines = cleaned.split(/\n/)
  let html = ""

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { html += "<br/>"; continue }

    if (trimmed.startsWith("## ")) {
      const content = trimmed.replace(/^## /, "")
      const levelMatch = content.match(/— NIVEL: (ALTA|MEDIA|BAJA)/i)
      const title = content.replace(/— NIVEL: (ALTA|MEDIA|BAJA)/i, "").trim()
      let badge = ""
      if (levelMatch) {
        const level = levelMatch[1].toLowerCase()
        badge = `<span class="level-${level}">${levelMatch[1]}</span>`
      }
      html += `<h2>${title}${badge}</h2>`
      continue
    }

    if (trimmed === "---") { html += "<hr/>"; continue }

    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      !trimmed.startsWith("**") &&
      !trimmed.match(/^\d/)
    ) {
      html += `<p class="section-title">${trimmed}</p>`
      continue
    }

    const boldLine = trimmed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    html += `<p>${boldLine}</p>`
  }

  return html
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 23) return `${Math.floor(h / 24)}d ago`;
    if (h > 0) return `${h}h ago`;
    return `${m}m ago`;
  } catch { return ""; }
}

export default function Home() {
  const [briefingText, setBriefingText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

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
      } catch { /* prices optional */ }
    }

    async function loadNews() {
      try {
        const res = await fetch("/api/news");
        const data = await res.json();
        setNews(data.news || data.articles || []);
      } catch { /* news optional */ }
    }

    loadBriefing();
    loadPrices();
    loadNews();
  }, []);

  const bodyHtml = briefingText ? parseBriefingBody(briefingText) : "";
  const dateLabel = formatDate(filename);

  return (
    <>
      {/* TICKER */}
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

      {/* HEADER */}
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-logo">ORION</a>
          <span className="site-tagline">Energy Intelligence</span>
        </div>
      </header>

      {/* MAIN — briefing */}
      <main className="main-content">
        {loading && <div className="loading-state">Loading today's briefing...</div>}
        {error && !loading && <div className="loading-state">{error}</div>}
        {!loading && !error && briefingText && (
          <>
            <div className="briefing-eyebrow">Daily Briefing</div>
            <h1 className="briefing-title">Global Energy Intelligence</h1>
            <div className="briefing-date">{dateLabel}</div>
            <div className="briefing-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </>
        )}
      </main>

      {/* NEWS — full width */}
      {news.length > 0 && (
        <section className="news-section">
          <div className="news-section-inner">
            <div className="news-header">
              <span className="news-eyebrow">Live Feed</span>
              <h2 className="news-title">Energy News</h2>
            </div>
            <div className="news-grid">
              {news.map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card"
                >
                  <div className="news-card-source">{item.source}</div>
                  <div className="news-card-title">{item.title}</div>
                  <div className="news-card-time">{timeAgo(item.published_at)}</div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="footer-text">ORION · Global Energy Intelligence · {new Date().getFullYear()}</span>
          <div className="footer-signal" title="Live" />
        </div>
      </footer>
    </>
  );
}
