import { NextResponse } from "next/server";

const FEEDS = [
  {
    url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx",
    source: "Rigzone",
  },
  {
    url: "https://oilprice.com/rss/main",
    source: "OilPrice",
  },
  {
    url: "https://www.naturalgasintel.com/feed/",
    source: "Natural Gas Intel",
  },
  {
    url: "https://www.spglobal.com/commodityinsights/en/rss-feed/oil",
    source: "S&P Global",
  },
  {
    url: "https://feeds.reuters.com/reuters/businessNews",
    source: "Reuters Business",
  },
  { url: "https://www.rechargenews.com/rss", source: "Recharge News" },
{ url: "https://www.pv-magazine.com/feed/", source: "PV Magazine" },
{ url: "https://www.energymonitor.ai/feed/", source: "Energy Monitor" },
{ url: "https://cleantechnica.com/feed/", source: "CleanTechnica" },
{ url: "https://electrek.co/feed/", source: "Electrek" },
  // Logística y supply chain
{ url: "https://www.freightwaves.com/news/feed", source: "FreightWaves" },
{ url: "https://www.supplychaindive.com/feeds/news/", source: "Supply Chain Dive" },
{ url: "https://www.joc.com/rss/all", source: "Journal of Commerce" },

// Comercio exterior
{ url: "https://www.tradefinanceglobal.com/feed/", source: "Trade Finance Global" },
{ url: "https://www.globaltradereviews.com/feed", source: "Global Trade Review" },

// América Latina
{ url: "https://portalportuario.cl/feed/", source: "Portal Portuario" },
{ url: "https://www.valor.com.br/rss", source: "Valor Economico" },
];

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  summary: string;
}

function cleanHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const block = match[1];

    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       block.match(/<title>(.*?)<\/title>/);
    const linkMatch  = block.match(/<link>(.*?)<\/link>/) ||
                       block.match(/<guid>(.*?)<\/guid>/);
    const descMatch  = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                       block.match(/<description>(.*?)<\/description>/);
    const dateMatch  = block.match(/<pubDate>(.*?)<\/pubDate>/);

    const title = titleMatch ? cleanHtml(titleMatch[1]) : "";
    const url   = linkMatch  ? linkMatch[1].trim() : "";
    const summary = descMatch ? cleanHtml(descMatch[1]).slice(0, 200) : "";
    const published_at = dateMatch ? dateMatch[1].trim() : null;

    if (title && url) {
      items.push({ title, url, source, published_at, summary });
    }

    if (items.length >= 5) break; // máximo 5 por fuente
  }

  return items;
}

async function fetchFeed(feed: { url: string; source: string }): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 900 }, // cache 15 minutos
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml, feed.source);
  } catch {
    return [];
  }
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map((f) => fetchFeed(f))
  );

  const allNews: NewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allNews.push(...result.value);
    }
  }

  // Ordenar por fecha descendente
  allNews.sort((a, b) => {
    if (!a.published_at) return 1;
    if (!b.published_at) return -1;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  return NextResponse.json({
    updated_at: new Date().toISOString(),
    count: allNews.length,
    news: allNews.slice(0, 20), // máximo 20 noticias en total
  });
}
