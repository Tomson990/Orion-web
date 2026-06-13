import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const FEEDS = [
  { url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", source: "Rigzone" },
  { url: "https://oilprice.com/rss/main", source: "OilPrice" },
  { url: "https://www.naturalgasintel.com/feed/", source: "Natural Gas Intel" },
  { url: "https://www.rechargenews.com/rss", source: "Recharge News" },
  { url: "https://www.pv-magazine.com/feed/", source: "PV Magazine" },
  { url: "https://www.energymonitor.ai/feed/", source: "Energy Monitor" },
  { url: "https://cleantechnica.com/feed/", source: "CleanTechnica" },
  { url: "https://electrek.co/feed/", source: "Electrek" },
];

interface Article {
  title: string;
  source: string;
  summary: string;
  published_at: string;
}

async function fetchFeed(url: string, source: string): Promise<Article[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OrionBot/1.0)" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const text = await res.text();

    const items: Article[] = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const item of itemMatches.slice(0, 5)) {
      const title =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        item.match(/<title>(.*?)<\/title>/)?.[1] || "";
      const summary =
        item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
        item.match(/<description>(.*?)<\/description>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

      if (title) {
        items.push({
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
          source,
          summary: summary.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim().slice(0, 200),
          published_at: pubDate,
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function generateBriefing(articles: Article[]): Promise<string> {
  if (!ANTHROPIC_API_KEY) return "";

  const articlesText = articles
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}\n   ${a.summary}`)
    .join("\n\n");

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
const prompt =
  "Sos un analista de inteligencia de supply chain y sourcing para AES, empresa global de energia con operaciones en Estados Unidos, Mexico, Argentina, Chile, Colombia, Panama, Republica Dominicana, El Salvador y Brasil.\n\n" +
  "AES opera plantas de generacion termica, hidro, solar, eolica y almacenamiento de energia. Sus principales categorias de compra son: transformadores de potencia, cables electricos, acero estructural, paneles solares, aerogeneradores, equipos de almacenamiento (baterias), gas natural y LNG, servicios de O&M, materiales de MRO (mantenimiento, reparacion y operaciones).\n\n" +
  "Los commodities que mas impactan sus costos son: cobre (cables y transformadores), acero (estructuras), aluminio (cables), litio (baterias), gas natural (generacion termica), petroleo (logistica y operaciones).\n\n" +
  "Hoy es " + today + ".\n\n" +
  "Analiza estas noticias y genera un briefing de inteligencia accionable para el equipo de supply chain de AES:\n\n" +
  articlesText + "\n\n" +
  "Formato exacto:\n\n" +
  "ORION ENERGY INTELLIGENCE — AES\n" +
  today + "\n\n" +
  "## 1. [TITULO] - [ALTA/MEDIA/BAJA]\n\n" +
  "**Que esta pasando:** [2-3 oraciones]\n" +
  "**Impacto para AES:** [Como afecta especificamente a las operaciones o compras de AES en la region]\n" +
  "**Accion recomendada:** [Que deberia considerar el equipo de supply chain]\n\n" +
  "---\n\n" +
  "[Repetir para 3-4 narrativas mas relevantes para AES]\n\n" +
  "ALERTAS DE COSTO\n" +
  "[Movimientos de precio de commodities criticos para AES esta semana]\n\n" +
  "SINTESIS EJECUTIVA\n" +
  "[3-4 oraciones sobre el panorama para supply chain de AES hoy]\n\n" +
  "Prioriza noticias que afecten: precios de insumos criticos, disrupciones logisticas en Latinoamerica y Centroamerica, cambios regulatorios en los paises donde opera AES, proyectos de energia renovable en la region. Se directo y accionable. Responde en español.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return "";
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export async function GET() {
  try {
    const allArticles = (
      await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)))
    ).flat();

    if (allArticles.length === 0) {
      return NextResponse.json({ error: "No articles available" }, { status: 503 });
    }

    const briefing = await generateBriefing(allArticles.slice(0, 25));

    if (!briefing) {
      return NextResponse.json({ error: "Failed to generate briefing" }, { status: 503 });
    }

    return NextResponse.json(
      {
        briefing,
        generated_at: new Date().toISOString(),
        articles_analyzed: allArticles.length,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=1800",
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
