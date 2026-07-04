"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";

interface StockDetailProps {
  symbol: string;
}

export default function StockDetail({ symbol }: StockDetailProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const container = chartRef.current;
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    wrapper.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: `NASDAQ:${symbol}`,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#0A0A0A",
      gridColor: "rgba(140,140,126,0.08)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      support_host: "https://www.tradingview.com",
    });
    wrapper.appendChild(script);
    container.appendChild(wrapper);
  }, [symbol]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", padding: "20px 5vw" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Link
          href="/#stocks"
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: "0.82rem",
            color: "var(--lime)",
            border: "1px solid var(--lime)",
            padding: "10px 18px",
            borderRadius: 10,
            textTransform: "uppercase",
            transition: ".2s",
          }}
        >
          ← Back
        </Link>
        <h1
          style={{
            fontFamily: "var(--font-unbounded)",
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            fontWeight: 800,
            color: "var(--paper)",
          }}
        >
          {symbol}
        </h1>
      </div>

      {/* Full Chart */}
      <div
        style={{
          background: "var(--glass-dark)",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--glass-border)",
          borderRadius: 22,
          padding: 6,
          overflow: "hidden",
          boxShadow: "0 8px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div
          ref={chartRef}
          style={{
            height: "70vh",
            borderRadius: 18,
            overflow: "hidden",
            background: "var(--ink)",
          }}
        />
      </div>

      {/* Buy button */}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link
          href="/#buy"
          style={{
            fontFamily: "var(--font-space-mono)",
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            background: "var(--lime)",
            color: "var(--ink)",
            padding: "16px 40px",
            borderRadius: 14,
            fontWeight: 700,
            display: "inline-block",
            transition: ".2s",
          }}
        >
          Buy {symbol} with SOL
        </Link>
      </div>
    </div>
  );
}
