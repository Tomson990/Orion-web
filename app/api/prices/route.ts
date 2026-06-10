import { NextResponse } from "next/server";

const TICKERS = [
  { key: "brent",     ticker: "BZ=F",   name: "Brent",      unit: "USD" },
  { key: "wti",       ticker: "CL=F",   name: "WTI",        unit: "USD" },
  { key: "ttf",       ticker: "TTF=F",  name: "TTF Gas",    unit: "EUR" },
  { key: "henry_hub", ticker: "NG=F",   name: "Henry Hub",  unit: "USD" },
  { key: "copper",    ticker: "HG=F",   name: "Copper",     unit: "USD" },
];

async function fetchPrice(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 }, // cache 5 min
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
  const results = await Promise.all(
    TICKERS.map(async (t) => {
      const data = await fetchPrice(t.ticker);
      return {
        key: t.key,
        name: t.name,
        unit: t.unit,
        price: data?.price ?? null,
        changePct: data?.changePct ?? null,
      };
    })
  );

  return NextResponse.json(results.filter((r) => r.price !== null));
}
