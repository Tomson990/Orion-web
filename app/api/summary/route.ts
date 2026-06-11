import { NextResponse } from "next/server";

const TICKERS = [
  { key: "brent",     ticker: "BZ=F",   name: "Brent Crude",  unit: "USD/bbl" },
  { key: "wti",       ticker: "CL=F",   name: "WTI Crude",    unit: "USD/bbl" },
  { key: "ttf",       ticker: "TTF=F",  name: "TTF Gas",      unit: "EUR/MWh" },
  { key: "henry_hub", ticker: "NG=F",   name: "Henry Hub",    unit: "USD/MMBtu" },
  { key: "copper",    ticker: "HG=F",   name: "Copper",       unit: "USD/lb" },
];

async function fetchPrice(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
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
      price: Math.round(price * 100) / 100,
      changePct: Math.round(changePct * 10) / 10,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const now = new Date().toISOString();
  const results = await Promise.all(
    TICKERS.map(async (t) => {
      const data = await fetchPrice(t.ticker);
      return { ...t, price: data?.price ?? null, changePct: data?.changePct ?? null };
    })
  );

  const valid = results.filter((r) => r.price !== null);

  const brent = valid.find(r => r.key === "brent");
  const ttf = valid.find(r => r.key === "ttf");
  const copper = valid.find(r => r.key === "copper");

  let riskScore = 50;
  if (brent?.changePct && brent.changePct > 1) riskScore += 10;
  if (brent?.changePct && brent.changePct < -1) riskScore -= 10;
  if (ttf?.changePct && ttf.changePct > 2) riskScore += 15;
  if (ttf?.changePct && ttf.changePct < -2) riskScore -= 10;
  if (copper?.changePct && copper.changePct > 1.5) riskScore += 5;
  riskScore = Math.min(100, Math.max(0, riskScore));

  const riskLevel = riskScore >= 70 ? "ALTO" : riskScore >= 40 ? "MEDIO" : "BAJO";

  let text = `ORION Energy Intelligence - AES Supply Chain\n`;
  text += `Actualizado: ${now}\n\n`;
  text += `COMMODITIES:\n`;

  for (const r of valid) {
    const trend = r.changePct && r.changePct > 0 ? `↑ +${r.changePct}%` : `↓ ${r.changePct}%`;
    text += `${r.name}: ${r.price} ${r.unit} | ${trend}\n`;
  }

  text += `\nRISK PRESSURE INDEX: ${riskScore}/100 - ${riskLevel}\n`;
  text += `Drivers: variaciones en Brent, TTF y Copper en las últimas 24hs.\n\n`;
  text += `IMPACTO SUPPLY CHAIN AES:\n`;

  if (brent && brent.price) {
    if (brent.price > 90) text += `- Brent elevado: presion en costos logisticos y fletes internacionales.\n`;
    else text += `- Brent moderado: costos logisticos estables.\n`;
  }
  if (ttf && ttf.price) {
    if (ttf.price > 30) text += `- TTF alto: impacto en generacion y contratos de gas en Europa.\n`;
    else text += `- TTF moderado: costos de gas bajo control.\n`;
  }
  if (copper && copper.price) {
    text += `- Copper a ${copper.price} USD/lb: referencia para equipos electricos y transformadores.\n`;
  }

  return new NextResponse(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
