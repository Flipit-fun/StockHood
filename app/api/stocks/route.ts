import { NextResponse } from "next/server";

const SYMBOLS = ["AAPL", "TSLA", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AMD"];

const NAMES: Record<string, string> = {
  AAPL: "Apple",
  TSLA: "Tesla",
  MSFT: "Microsoft",
  NVDA: "Nvidia",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  META: "Meta Platforms",
  AMD: "AMD",
};

/**
 * GET /api/stocks
 * Fetches real-time prices from CoinGecko or Yahoo-like free APIs
 * Falls back to a secondary source if the primary fails
 */
export async function GET() {
  try {
    // Use Yahoo Finance v8 quote endpoint (free, no API key needed)
    const symbols = SYMBOLS.join(",");
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols}&range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 60 },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const stocks = SYMBOLS.map((sym) => {
        const spark = data[sym];
        if (spark && spark.close && spark.close.length > 0) {
          const price = spark.close[spark.close.length - 1];
          const prevClose = spark.previousClose || spark.close[0];
          const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
          return {
            sym,
            name: NAMES[sym],
            price: Math.round(price * 100) / 100,
            chg: Math.round(change * 100) / 100,
          };
        }
        return null;
      }).filter(Boolean);

      if (stocks.length > 0) {
        return NextResponse.json({ stocks });
      }
    }

    // Fallback: try Yahoo v7 quote summary
    const quoteRes = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 60 },
      }
    );

    if (quoteRes.ok) {
      const quoteData = await quoteRes.json();
      const results = quoteData.quoteResponse?.result || [];
      const stocks = results.map((q: Record<string, unknown>) => ({
        sym: q.symbol as string,
        name: NAMES[q.symbol as string] || q.shortName,
        price: Math.round((q.regularMarketPrice as number) * 100) / 100,
        chg:
          Math.round((q.regularMarketChangePercent as number) * 100) / 100,
      }));

      if (stocks.length > 0) {
        return NextResponse.json({ stocks });
      }
    }

    // If both fail, return null to signal frontend should use defaults
    return NextResponse.json({ stocks: null });
  } catch {
    return NextResponse.json({ stocks: null });
  }
}
