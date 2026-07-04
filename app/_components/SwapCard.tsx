"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { allAssets, TREASURY_SOL_ADDRESS } from "@/lib/constants";

type SwapStatus = "idle" | "creating" | "signing" | "confirming" | "complete" | "error";

interface TradeAsset {
  sym: string;
  name: string;
  price: number;
  available: boolean;
  isStablecoin: boolean;
}

export default function SwapCard() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  const availableAssets = allAssets.filter((a) => a.available);
  const [selectedAsset, setSelectedAsset] = useState<TradeAsset>(availableAssets[0]);
  const [solAmount, setSolAmount] = useState("1");
  const [solPrice, setSolPrice] = useState(150);
  const [robinhoodAddress, setRobinhoodAddress] = useState("");
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [ethTxHash, setEthTxHash] = useState("");

  // Derived values
  const solNum = parseFloat(solAmount) || 0;
  const usdValue = solNum * solPrice;
  const assetQuantity = usdValue / selectedAsset.price;

  // Fetch SOL price on mount
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch("/api/price?stock=" + selectedAsset.sym);
        const data = await res.json();
        if (data.solPriceUsd) setSolPrice(data.solPriceUsd);
      } catch {
        // Use fallback price
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [selectedAsset.sym]);

  // Validate Robinhood address
  const isValidEthAddress = /^0x[a-fA-F0-9]{40}$/.test(robinhoodAddress);

  const handleSwap = useCallback(async () => {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    if (!isValidEthAddress) {
      setStatus("error");
      setStatusMessage("Please enter a valid Robinhood chain address (0x...)");
      return;
    }

    if (solNum <= 0) {
      setStatus("error");
      setStatusMessage("Enter a valid SOL amount");
      return;
    }

    try {
      // Step 1: Create order
      setStatus("creating");
      setStatusMessage("Creating order...");

      const createRes = await fetch("/api/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userSolAddress: publicKey.toBase58(),
          userEthAddress: robinhoodAddress,
          stockSymbol: selectedAsset.sym,
          solAmount: solNum,
        }),
      });

      const orderData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // Step 2: Send SOL to treasury
      setStatus("signing");
      setStatusMessage("Please approve the SOL transaction in your wallet...");

      const treasuryPubkey = new PublicKey(TREASURY_SOL_ADDRESS);
      const lamports = Math.round(solNum * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasuryPubkey,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      // Step 3: Wait for confirmation
      setStatus("confirming");
      setStatusMessage(
        "SOL sent! Verifying transaction and executing swap..."
      );

      await connection.confirmTransaction(signature, "confirmed");

      // Step 4: Confirm with backend (triggers Uniswap swap)
      const confirmRes = await fetch("/api/order/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.orderId,
          solTxSignature: signature,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || "Swap execution failed");
      }

      // Success!
      setStatus("complete");
      setEthTxHash(confirmData.ethTxHash || "");
      setStatusMessage(
        `Success! ${confirmData.stockQuantity?.toFixed(4)} ${confirmData.stockSymbol} sent to your Robinhood address.`
      );
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        err instanceof Error ? err.message : "Transaction failed"
      );
    }
  }, [
    connected,
    publicKey,
    isValidEthAddress,
    solNum,
    selectedAsset.sym,
    robinhoodAddress,
    connection,
    sendTransaction,
    setVisible,
  ]);

  const buttonText = () => {
    if (!connected) return "Connect Solana Wallet";
    if (status === "creating") return "Creating Order...";
    if (status === "signing") return "Approve in Wallet...";
    if (status === "confirming") return "Executing Swap...";
    if (status === "complete") return "Swap Complete ✓";
    return "Swap SOL → Stock";
  };

  const isProcessing = ["creating", "signing", "confirming"].includes(status);

  return (
    <div className="swap-card">
      {/* YOU PAY */}
      <div className="swap-row">
        <div className="swap-label" style={{ fontFamily: "var(--font-space-mono)" }}>
          You Pay (SOL)
        </div>
        <div className="swap-line">
          <input
            className="swap-amt"
            style={{ fontFamily: "var(--font-space-mono)" }}
            type="text"
            value={solAmount}
            onChange={(e) => {
              setSolAmount(e.target.value);
              if (status === "error" || status === "complete") setStatus("idle");
            }}
            placeholder="0.0"
          />
          <span className="swap-token" style={{ fontFamily: "var(--font-space-mono)" }}>
            SOL
          </span>
        </div>
      </div>

      {/* ARROW */}
      <div className="swap-arrow">
        <span>↓</span>
      </div>

      {/* YOU RECEIVE */}
      <div className="swap-row">
        <div className="swap-label" style={{ fontFamily: "var(--font-space-mono)" }}>
          You Receive
        </div>
        <div className="swap-line">
          <input
            className="swap-amt"
            style={{ fontFamily: "var(--font-space-mono)" }}
            type="text"
            value={assetQuantity > 0 ? assetQuantity.toFixed(4) : "0"}
            readOnly
          />
          <select
            className="swap-token"
            style={{
              fontFamily: "var(--font-space-mono)",
              cursor: "pointer",
              background: "rgba(255,255,255,0.06)",
              color: "var(--paper)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            value={selectedAsset.sym}
            onChange={(e) => {
              const a = availableAssets.find((asset) => asset.sym === e.target.value);
              if (a) setSelectedAsset(a);
            }}
          >
            {availableAssets.map((a) => (
              <option key={a.sym} value={a.sym}>
                {a.sym}{a.isStablecoin ? " (Stablecoin)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* RATE INFO */}
      <div className="swap-meta" style={{ fontFamily: "var(--font-space-mono)" }}>
        <span>Rate</span>
        <span>
          1 SOL ≈ ${solPrice.toFixed(2)} | 1 {selectedAsset.sym} ≈ $
          {selectedAsset.price.toFixed(2)}
        </span>
      </div>

      {/* ROBINHOOD ADDRESS INPUT */}
      <div className="rh-address-row">
        <label
          className="rh-address-label"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Your Robinhood Chain Address (EVM)
        </label>
        <input
          className="rh-address-input"
          style={{ fontFamily: "var(--font-space-mono)" }}
          type="text"
          placeholder="0x... (where you'll receive the stock tokens)"
          value={robinhoodAddress}
          onChange={(e) => {
            setRobinhoodAddress(e.target.value);
            if (status === "error") setStatus("idle");
          }}
        />
      </div>

      {/* CTA BUTTON */}
      <button
        className="swap-cta"
        style={{ fontFamily: "var(--font-space-mono)" }}
        onClick={handleSwap}
        disabled={isProcessing}
      >
        {buttonText()}
      </button>

      {/* STATUS MESSAGE */}
      {status !== "idle" && statusMessage && (
        <div
          className={`swap-status ${
            status === "complete"
              ? "success"
              : status === "error"
                ? "error"
                : "pending"
          }`}
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {statusMessage}
          {ethTxHash && (
            <div style={{ marginTop: 6, fontSize: "0.7rem" }}>
              ETH Tx: {ethTxHash.slice(0, 10)}...{ethTxHash.slice(-8)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
