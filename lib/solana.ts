import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { SOLANA_RPC_URL, TREASURY_SOL_ADDRESS } from "./constants";

// Track used signatures to prevent replay attacks
const usedSignatures: Set<string> = new Set();

/**
 * Create a Solana connection
 */
export function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

/**
 * Build a SOL transfer transaction from user to treasury
 */
export async function buildSolTransferTx(
  fromPubkey: PublicKey,
  solAmount: number
): Promise<Transaction> {
  const connection = getConnection();
  const treasuryPubkey = new PublicKey(TREASURY_SOL_ADDRESS);

  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey: treasuryPubkey,
      lamports,
    })
  );

  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  return transaction;
}

/**
 * Verify a Solana transaction was confirmed and sent to our treasury.
 * Includes replay protection — a signature can only be used once.
 */
export async function verifySolTransaction(
  signature: string,
  expectedLamports: number
): Promise<{ verified: boolean; error?: string }> {
  try {
    // SECURITY: Prevent replay attacks — same tx signature can't be used twice
    if (usedSignatures.has(signature)) {
      return { verified: false, error: "Transaction signature already used" };
    }

    const connection = getConnection();
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { verified: false, error: "Transaction not found" };
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed on-chain" };
    }

    // SECURITY: Check transaction is recent (within last 5 minutes)
    const txTime = tx.blockTime;
    if (txTime) {
      const now = Math.floor(Date.now() / 1000);
      const fiveMinutes = 300;
      if (now - txTime > fiveMinutes) {
        return { verified: false, error: "Transaction is too old" };
      }
    }

    // Check that the treasury received the expected amount
    const treasuryPubkey = new PublicKey(TREASURY_SOL_ADDRESS);
    const postBalances = tx.meta?.postBalances || [];
    const preBalances = tx.meta?.preBalances || [];
    const accountKeys = tx.transaction.message.getAccountKeys().staticAccountKeys;

    let treasuryIdx = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys[i].equals(treasuryPubkey)) {
        treasuryIdx = i;
        break;
      }
    }

    if (treasuryIdx === -1) {
      return { verified: false, error: "Treasury not found in transaction" };
    }

    const received = postBalances[treasuryIdx] - preBalances[treasuryIdx];
    // SECURITY: Strict check — must receive at least 99% of expected (accounts for rounding)
    if (received < expectedLamports * 0.99) {
      return {
        verified: false,
        error: `Insufficient amount: expected ${expectedLamports} lamports, got ${received}`,
      };
    }

    // Mark signature as used (replay protection)
    usedSignatures.add(signature);

    // Cleanup old signatures (keep last 10,000)
    if (usedSignatures.size > 10000) {
      const entries = Array.from(usedSignatures);
      for (let i = 0; i < 5000; i++) {
        usedSignatures.delete(entries[i]);
      }
    }

    return { verified: true };
  } catch (err) {
    return {
      verified: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get current SOL price in USD (using CoinGecko)
 */
export async function getSolPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 30 } }
    );
    const data = await res.json();
    return data.solana.usd;
  } catch {
    // SECURITY: Fallback price — in production use multiple oracles
    // Using a conservative fallback to avoid overpaying
    return 75;
  }
}
