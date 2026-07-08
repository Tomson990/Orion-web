import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://jmrwyluomrranyetgecw.supabase.co",
  "sb_publishable_WJtPwj9Ufax4Y9kZYSUhdA_qCvsb89-"
);

const GITHUB_RAW = "https://raw.githubusercontent.com/Tomson990/Orion/main/orion/briefings";

function getTodayFilename() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `briefing_${yyyy}-${mm}-${dd}.txt`;
}

async function getPrices() {
  const TICKERS = [
    { key: "brent", ticker: "BZ=F", name: "Brent Crude", unit: "USD/bbl" },
    { key: "wti", ticker: "CL=F", name: "WTI Crude", unit: "USD/bbl" },
    { key: "ttf", ticker: "TTF=F", name: "TTF Gas", unit: "EUR/MWh" },
    { key: "henry_hub", ticker: "NG=F", name: "Henry Hub", unit: "USD/MMBtu" },
    { key: "copper", ticker: "HG=F", name: "Copper", unit: "USD/lb" },
  ];

  const results = await Promise.all(
    TICKERS.map(async (t) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t.ticker}?interval=1d&range=5d`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) return null;
        const closes = (result.indicators?.quote?.[0]?.close || []).filter(Boolean);
        if (closes.length < 2) return null;
        const price = closes[closes.length - 1];
        const prev = closes[closes.length - 2];
        const changePct = ((price - prev) / prev) * 100;
        return {
          name: t.name,
          precio: Math.round(price * 100) / 100,
          unidad: t.unit,
          variacion_pct: Math.round(changePct * 10) / 10,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r) => r !== null);
}

async function getTradeIndices() {
  try {
    const { data, error } = await supabase
      .from("trade_indices")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(20);

    if (error || !data) return {};

    const latest: Record<string, { valor: number; fecha: string }> = {};
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

async function getBriefing() {
  try {
    const today = getTodayFilename();
    const res = await fetch(`${GITHUB_RAW}/${today}`);
    if (!res.ok) return "Briefing de hoy aún no disponible.";
    return await res.text();
  } catch {
    return "Briefing de hoy aún no disponible.";
  }
}

export async function GET() {
  const [precios, comercioInternacional, briefing] = await Promise.all([
    getPrices(),
    getTradeIndices(),
    getBriefing(),
  ]);

  const fecha = new Date().toISOString().split("T")[0];

  return NextResponse.json(
    {
      fecha,
      precios_commodities: precios,
      comercio_internacional: comercioInternacional,
      briefing_completo: briefing,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=900",
      },
    }
  );
}
