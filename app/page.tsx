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

interface PriceItem {
  label: string;
  value: string;
  change: string;
  direction: "up" | "down" | "flat";
}

function parsePrices(text: string): PriceItem[] {
  const lines = text.split("\n");
  const pricesStart = lines.findIndex(l => l.includes("PRECIOS CLAVE HOY"));
  if (pricesStart === -1) return [];

  const items: PriceItem[] = [];
  for (let i = pricesStart + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("Se detectaron") || line.startsWith("ORION")) break;
    const match = line.match(/([^:]+):\s*([\d.]+)\s+([^\s]+)\s+([▲▼—])\s*([\d.]+)%/);
    if (match) {
      const dir = match[4] === "▲" ? "up" : match[4] === "▼" ? "down" : "flat";
      items.push({
        label: match[1].trim().replace(/_/g, " ").toUpperCase(),
        value: `${match[2]} ${match[3]}`,
        change: `${match[4]} ${match[5]}%`,
        direction: dir,
      });
    }
  }
  return items;
}

function parseBriefingBody(text: string): string {
  // Extract everything after the header line
  const lines = text.split("\n");
  const startIdx = lines.findIndex(l => l.includes("ORION ENERGY INTELLIGENCE"));
  if (startIdx === -1) return text;

  const bodyLines = lines.slice(startIdx + 2); // skip header + separator

  // Convert to HTML
  let html = "";
  for (const line of bodyLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      html += "<br/>";
      continue;
    }

    // Section headers like ## 1. TITLE — NIVEL: ALTA
    if (trimmed.startsWith("## ")) {
      const content = trimmed.replace(/^## /, "");
      const levelMatch = content.match(/— NIVEL: (ALTA|MEDIA|BAJA)/i);
      let title = content.replace(/— NIVEL: (ALTA|MEDIA|BAJA)/i, "").trim();
      let badge = "";
      if (levelMatch) {
        const level = levelMatch[1].toLowerCase();
        badge = `<span class="level-${level}">${levelMatch[1]}</span>`;
      }
      html += `<h2>${title}${badge}</h2>`;
      continue;
    }

    // Section labels like TENSIONES ACTIVAS, SÍNTESIS EJECUTIVA, PULSO DE MERCADO
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

    // Horizontal rule
    if (trimmed === "---") {
      html += "<hr/>";
      continue;
    }

    // Bold fields like **Qué está pasando:**
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
    loadBriefing();
  }, []);

  const prices = briefingText ? parsePrices(briefingText) : [];
  const bodyHtml = briefingText ? parseBriefingBody(briefingText) : "";
  const dateLabel = formatDate(filename);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <a href="/" className="site-logo">ORION</a>
          <span className="site-tagline">Energy Intelligence</span>
        </div>
      </header>

      <main className="main-content">
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

            {prices.length > 0 && (
              <div className="prices-bar">
                {prices.map((p, i) => (
                  <div className="price-item" key={i}>
                    <span className="price-label">{p.label}</span>
                    <span className="price-value">{p.value}</span>
                    <span className={`price-change ${p.direction}`}>{p.change}</span>
                  </div>
                ))}
              </div>
            )}

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
