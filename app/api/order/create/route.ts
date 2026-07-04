import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createOrder } from "@/lib/orders";
import { getSolPrice } from "@/lib/solana";
import { stocks, SwapOrder, allAssets } from "@/lib/constants";

// Simple rate limiter: max 5 orders per IP per minute
const rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (entry.count >= 5) {
    return false;
  }
  
  entry.count++;
  return true;
}

/**
 * POST /api/order/create
 * Body: { userSolAddress, userEthAddress, stockSymbol, solAmount }
 */
export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { userSolAddress, userEthAddress, stockSymbol, solAmount } = body;

    // Validate inputs
    if (!userSolAddress || !userEthAddress || !stockSymbol || !solAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SECURITY: Validate SOL amount is reasonable (min 0.01, max 100 SOL)
    const parsedSolAmount = Number(solAmount);
    if (isNaN(parsedSolAmount) || parsedSolAmount <= 0.01 || parsedSolAmount > 100) {
      return NextResponse.json(
        { error: "Invalid SOL amount. Min: 0.01, Max: 100 SOL" },
        { status: 400 }
      );
    }

    // Validate ETH address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userEthAddress)) {
      return NextResponse.json(
        { error: "Invalid Robinhood/Ethereum address format" },
        { status: 400 }
      );
    }

    // SECURITY: Validate Solana address format (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(userSolAddress)) {
      return NextResponse.json(
        { error: "Invalid Solana address format" },
        { status: 400 }
      );
    }

    // Validate asset is available for trading
    const asset = allAssets.find((a) => a.sym === stockSymbol && a.available);
    if (!asset) {
      // Check if it exists but is unavailable
      const stock = stocks.find((s) => s.sym === stockSymbol);
      if (stock && !stock.available) {
        return NextResponse.json(
          { error: `${stockSymbol} is currently out of stock. Coming soon.` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Unknown or unavailable asset: ${stockSymbol}` },
        { status: 400 }
      );
    }

    const assetPrice = asset.price;

    // Calculate USD value and asset quantity
    const solPrice = await getSolPrice();
    const usdValue = parsedSolAmount * solPrice;
    const stockQuantity = usdValue / assetPrice;

    // SECURITY: Sanity check — don't process orders worth more than $15,000
    if (usdValue > 15000) {
      return NextResponse.json(
        { error: "Order too large. Maximum $15,000 per transaction." },
        { status: 400 }
      );
    }

    const order: SwapOrder = {
      id: uuidv4(),
      userSolAddress,
      userEthAddress,
      stockSymbol,
      solAmount: parsedSolAmount,
      usdValue,
      stockQuantity,
      status: "pending_sol_payment",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    createOrder(order);

    return NextResponse.json({
      orderId: order.id,
      solAmount: order.solAmount,
      usdValue: order.usdValue,
      stockQuantity: order.stockQuantity,
      stockSymbol: order.stockSymbol,
      status: order.status,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
