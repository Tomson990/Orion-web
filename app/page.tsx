"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function getToday(): string {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function Home() {
  const [briefingText, setBriefingText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    async function loadBriefing() {
      try {
        const res = await fetch("/api/briefing");
        if (!res.ok) throw new Error("Briefing not available");
        const data = await res.json();
        setBriefingText(data.briefing || "");
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
        {loading && <div className="loading-state">Generating energy intelligence briefing...</div>}
        {error && !loading && <div className="loading-state">{error}</div>}
        {!loading && !error && briefingText && (
          <>
            <div className="briefing-eyebrow">Daily Briefing</div>
            <h1 className="briefing-title">Global Energy Intelligence</h1>
            <div className="briefing-date">{getToday()}</div>
            <div className="briefing-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {briefingText}
              </ReactMarkdown>
            </div>
          </>
        )}
      </main>

      {/* NEWS */}
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
