import { NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/orders";
import { verifySolTransaction } from "@/lib/solana";
import { executeSwap } from "@/lib/ethereum";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// Lock to prevent concurrent processing of the same order
const processingOrders: Set<string> = new Set();

/**
 * POST /api/order/confirm
 * Body: { orderId, solTxSignature }
 *
 * Called after the user has sent SOL to our treasury.
 * Verifies the Solana transaction, then transfers stock tokens from inventory.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, solTxSignature } = body;

    if (!orderId || !solTxSignature) {
      return NextResponse.json(
        { error: "Missing orderId or solTxSignature" },
        { status: 400 }
      );
    }

    // SECURITY: Validate signature format (base58, 87-88 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(solTxSignature)) {
      return NextResponse.json(
        { error: "Invalid transaction signature format" },
        { status: 400 }
      );
    }

    const order = getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // SECURITY: Prevent double-processing
    if (order.status !== "pending_sol_payment") {
      return NextResponse.json(
        { error: `Order already processed (status: ${order.status})` },
        { status: 400 }
      );
    }

    // SECURITY: Prevent concurrent processing of same order
    if (processingOrders.has(orderId)) {
      return NextResponse.json(
        { error: "Order is currently being processed" },
        { status: 409 }
      );
    }
    processingOrders.add(orderId);

    try {
      // SECURITY: Check order isn't expired (max 10 minutes old)
      const tenMinutes = 10 * 60 * 1000;
      if (Date.now() - order.createdAt > tenMinutes) {
        updateOrderStatus(orderId, "failed", { error: "Order expired" });
        return NextResponse.json(
          { error: "Order expired. Please create a new order." },
          { status: 400 }
        );
      }

      // Step 1: Verify the Solana transaction
      const expectedLamports = Math.round(order.solAmount * LAMPORTS_PER_SOL);
      const verification = await verifySolTransaction(
        solTxSignature,
        expectedLamports
      );

      if (!verification.verified) {
        updateOrderStatus(orderId, "failed", {
          error: verification.error,
          solTxSignature,
        });
        return NextResponse.json(
          { error: `SOL verification failed: ${verification.error}` },
          { status: 400 }
        );
      }

      // Step 2: Mark as confirmed
      updateOrderStatus(orderId, "sol_confirmed", { solTxSignature });

      // Step 3: Transfer tokens from inventory
      updateOrderStatus(orderId, "executing_swap");

      const swapResult = await executeSwap(
        order.stockSymbol,
        order.usdValue,
        order.userEthAddress
      );

      // Step 4: Mark as complete
      updateOrderStatus(orderId, "complete", {
        ethTxHash: swapResult.txHash,
      });

      return NextResponse.json({
        success: true,
        orderId,
        status: "complete",
        ethTxHash: swapResult.txHash,
        stockQuantity: order.stockQuantity,
        stockSymbol: order.stockSymbol,
      });
    } catch (swapError) {
      const errorMsg =
        swapError instanceof Error ? swapError.message : "Fulfillment failed";
      updateOrderStatus(orderId, "failed", { error: errorMsg });
      return NextResponse.json(
        { error: `Swap failed: ${errorMsg}` },
        { status: 500 }
      );
    } finally {
      // Always release the lock
      processingOrders.delete(orderId);
    }
  } catch (err) {
    console.error("Order confirmation error:", err);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 }
    );
  }
}
