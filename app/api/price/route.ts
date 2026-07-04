import { NextResponse } from "next/server";
import { getSolPrice } from "@/lib/solana";
import { stocks } from "@/lib/constants";

/**
 * GET /api/price?stock=TSLA
 * Returns current SOL price and stock price so frontend can calculate amounts
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stockSymbol = searchParams.get("stock");

  const solPrice = await getSolPrice();

  const stock = stocks.find((s) => s.sym === stockSymbol);
  if (!stock && stockSymbol) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  return NextResponse.json({
    solPriceUsd: solPrice,
    stock: stock
      ? { symbol: stock.sym, name: stock.name, priceUsd: stock.price }
      : null,
  });
}
