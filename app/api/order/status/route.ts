import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";

/**
 * GET /api/order/status?id=<orderId>
 * Returns the current status of an order
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("id");

  if (!orderId) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const order = getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    stockSymbol: order.stockSymbol,
    stockQuantity: order.stockQuantity,
    usdValue: order.usdValue,
    solAmount: order.solAmount,
    solTxSignature: order.solTxSignature,
    ethTxHash: order.ethTxHash,
    error: order.error,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
}
