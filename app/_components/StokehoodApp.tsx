"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import WalletProvider from "./WalletProvider";
import SwapCard from "./SwapCard";
import { stocks as defaultStocks, type Stock } from "@/lib/constants";

// --- Helpers ---

function seedRand(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function () {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function sparkPath(sym: string, up: boolean) {
  const rand = seedRand(sym);
  const points = 22;
  const w = 300,
    h = 64;
  let vals: number[] = [];
  let v = 30 + rand() * 10;
  for (let i = 0; i < points; i++) {
    v += (rand() - 0.48) * 9;
    v = Math.max(6, Math.min(58, v));
    vals.push(v);
  }
  const drift = (up ? -1 : 1) * 0.9;
  vals = vals.map((val, i) => val + drift * (i / points) * 14);
  vals = vals.map((val) => Math.max(6, Math.min(58, val)));
  const step = w / (points - 1);
  let d = `M0,${(h - vals[0]).toFixed(1)}`;
  vals.forEach((val, i) => {
    if (i > 0) d += ` L${(i * step).toFixed(1)},${(h - val).toFixed(1)}`;
  });
  const area = d + ` L${w},${h} L0,${h} Z`;
  return { line: d, area };
}

export default function StokehoodApp() {
  return (
    <WalletProvider>
      <StokehoodContent />
    </WalletProvider>
  );
}

function StokehoodContent() {
  const [loaderHidden, setLoaderHidden] = useState(false);
  const [statCount, setStatCount] = useState(0);
  const [activeSym, setActiveSym] = useState("AAPL");
  const [stocks, setStocks] = useState<Stock[]>(defaultStocks);
  const storyRef = useRef<HTMLElement>(null);
  const storyTextRef = useRef<HTMLParagraphElement>(null);
  const stockGridRef = useRef<HTMLDivElement>(null);

  // Loader
  useEffect(() => {
    const timer = setTimeout(() => setLoaderHidden(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  // Fetch real-time stock prices
  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch("/api/stocks");
        const data = await res.json();
        if (data.stocks && data.stocks.length > 0) {
          setStocks(data.stocks);
        }
      } catch {
        // Keep default prices
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Stat counter animation
  useEffect(() => {
    const target = stocks.length * 40;
    let n = 0;
    const iv = setInterval(() => {
      n += Math.ceil(target / 40);
      if (n >= target) {
        n = target;
        clearInterval(iv);
      }
      setStatCount(n);
    }, 30);
    return () => clearInterval(iv);
  }, []);

  // Story scroll reveal
  useEffect(() => {
    const text =
      "Every stock listed on the Robinhood chain now lives here too. Real prices, real charts, no brokerage, no paperwork. Connect a Solana wallet, swap in, own the share.";
    const highlight = new Set(["Robinhood", "Solana", "wallet,", "share."]);
    const el = storyTextRef.current;
    if (!el) return;

    el.innerHTML = text
      .split(" ")
      .map((word) => {
        const cls = highlight.has(word) ? "w hi" : "w";
        return `<span class="${cls}">${word}</span>`;
      })
      .join(" ");

    const words = el.querySelectorAll(".w");
    const section = storyRef.current;

    function onScroll() {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      let progress = -rect.top / total;
      progress = Math.max(0, Math.min(1, progress));
      const activeCount = Math.round(progress * words.length);
      words.forEach((w, i) =>
        w.classList.toggle("active", i < activeCount)
      );
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Stock card reveal on intersection
  useEffect(() => {
    const grid = stockGridRef.current;
    if (!grid) return;
    const cards = grid.querySelectorAll(".stock-card");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("reveal");
        });
      },
      { threshold: 0.15 }
    );
    cards.forEach((el, i) => {
      (el as HTMLElement).style.transitionDelay = `${(i % 3) * 0.06}s`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Load TradingView chart
  const loadChart = useCallback((sym: string) => {
    setActiveSym(sym);
    const frame = document.getElementById("chartFrame");
    if (!frame) return;
    frame.innerHTML = "";

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.height = "100%";
    container.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: `NASDAQ:${sym}`,
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
    container.appendChild(script);
    frame.appendChild(container);
  }, []);

  useEffect(() => {
    loadChart("AAPL");
  }, [loadChart]);

  // Ticker data (duplicate for infinite scroll)
  const tickerItems = [...stocks, ...stocks, ...stocks, ...stocks];

  return (
    <>
      {/* NAV */}
      <nav>
        <Image src="/logo.png" alt="Stokehood" width={140} height={40} style={{ objectFit: "contain" }} />
        <div className="nav-links">
          <a href="#stocks">Stocks</a>
          <a href="#chart">Charts</a>
          <a href="#buy">Buy</a>
        </div>
        <a
          href="#buy"
          className="nav-cta"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Launch App
        </a>
      </nav>

      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {tickerItems.map((s, i) => {
            const up = s.chg >= 0;
            return (
              <div
                className="ticker-item"
                key={`${s.sym}-${i}`}
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                <b>{s.sym}</b>
                <span>${s.price.toFixed(2)}</span>
                <span className={up ? "up" : "down"}>
                  {up ? "▲" : "▼"} {Math.abs(s.chg).toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="hero-glass">
          <div className="eyebrow" style={{ fontFamily: "var(--font-space-mono)" }}>
            On-Chain Equities
          </div>
          <h1 style={{ fontFamily: "var(--font-unbounded)", textAlign: "left" }}>
            <span className="line">
              <span className="word" style={{ animationDelay: ".05s" }}>Stocks</span>{" "}
              <span className="word" style={{ animationDelay: ".12s" }}>from</span>{" "}
              <span className="word" style={{ animationDelay: ".19s" }}>Robinhood,</span>
            </span>
            <span className="line">
              <span className="word" style={{ animationDelay: ".26s" }}>Settled</span>{" "}
              <span className="word" style={{ animationDelay: ".33s" }}>in</span>{" "}
              <span className="word" style={{ animationDelay: ".40s" }}>Solana.</span>
            </span>
          </h1>
          <p>
            Tokenized stocks and USDG stablecoin from the Robinhood chain,
            settled with Solana. Pay with SOL, receive assets directly
            to your Robinhood chain wallet.
          </p>
          <div className="hero-actions">
            <a
              href="#stocks"
              className="btn btn-solid"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              Explore Stocks
            </a>
            <a
              href="#buy"
              className="btn btn-ghost"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              How It Works
            </a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <b style={{ fontFamily: "var(--font-space-mono)" }}>{statCount}+</b>
            <span>Tokenized Assets</span>
          </div>
          <div className="hero-stat">
            <b style={{ fontFamily: "var(--font-space-mono)" }}>SOL</b>
            <span>Payment Currency</span>
          </div>
          <div className="hero-stat">
            <b style={{ fontFamily: "var(--font-space-mono)" }}>TSLA · AMD · USDG</b>
            <span>Available Now</span>
          </div>
        </div>
      </section>

      {/* STORY */}
      <section className="story-section" id="story" ref={storyRef}>
        <div className="story-sticky">
          <div className="story-glass">
            <p
              className="story-text"
              ref={storyTextRef}
              style={{ fontFamily: "var(--font-unbounded)" }}
            ></p>
          </div>
        </div>
      </section>

      {/* STOCK GRID */}
      <section className="section" id="stocks">
        <div className="section-head">
          <div className="eyebrow" style={{ fontFamily: "var(--font-space-mono)" }}>
            The Board
          </div>
          <h2 style={{ fontFamily: "var(--font-unbounded)" }}>Listed on Stokehood</h2>
          <p>
            Every name on this board is tokenized and tradable on-chain,
            tracking its real-world price feed.
          </p>
        </div>
        <div className="stock-grid" ref={stockGridRef}>
          {stocks.map((s) => {
            const up = s.chg >= 0;
            const paths = sparkPath(s.sym, up);
            const color = up ? "var(--lime)" : "var(--loss)";
            return (
              <Link href={`/stock/${s.sym}`} key={s.sym} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="stock-card">
                  <div className="stock-top">
                    <div>
                      <div
                        className="stock-sym"
                        style={{ fontFamily: "var(--font-unbounded)" }}
                      >
                        {s.sym}
                      </div>
                      <div className="stock-name">{s.name}</div>
                    </div>
                    <div
                      className={`stock-chg ${up ? "up" : "down"}`}
                      style={{ fontFamily: "var(--font-space-mono)" }}
                    >
                      {up ? "+" : ""}
                      {s.chg.toFixed(2)}%
                    </div>
                  </div>
                  <svg
                    className="spark"
                    viewBox="0 0 300 64"
                    preserveAspectRatio="none"
                  >
                    <path d={paths.area} fill={color} opacity="0.12" />
                    <path
                      d={paths.line}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="stock-bottom">
                    <div
                      className="stock-price"
                      style={{ fontFamily: "var(--font-space-mono)" }}
                    >
                      ${s.price.toFixed(2)}
                    </div>
                    <button
                      className="stock-buy"
                      style={{ fontFamily: "var(--font-space-mono)" }}
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById("buy")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CHART */}
      <section className="section chart-section" id="chart">
        <div className="section-head">
          <div className="eyebrow" style={{ fontFamily: "var(--font-space-mono)" }}>
            Live Feed
          </div>
          <h2 style={{ fontFamily: "var(--font-unbounded)" }}>
            Real Charts, Not Approximations
          </h2>
          <p>Pulled straight from the market. Switch tickers below.</p>
        </div>
        <div className="chart-tabs">
          {stocks.map((s) => (
            <button
              key={s.sym}
              className={`chart-tab ${activeSym === s.sym ? "active" : ""}`}
              style={{ fontFamily: "var(--font-space-mono)" }}
              onClick={() => loadChart(s.sym)}
            >
              {s.sym}
            </button>
          ))}
        </div>
        <div className="chart-glass">
          <div className="chart-frame" id="chartFrame"></div>
        </div>
      </section>

      {/* BUY / SWAP SECTION */}
      <section className="section buy-section" id="buy">
        <div className="section-head">
          <div className="eyebrow" style={{ fontFamily: "var(--font-space-mono)" }}>
            Get In
          </div>
          <h2 style={{ fontFamily: "var(--font-unbounded)" }}>
            Swap SOL for Stocks & USDG
          </h2>
          <p>
            Pay with SOL from your Solana wallet. Receive tokenized stocks
            or USDG stablecoin directly to your Robinhood chain address.
            Currently available: TSLA, AMD, and USDG. More stocks coming soon.
          </p>
        </div>

        <SwapCard />

        <div className="steps">
          <div className="step">
            <div className="num" style={{ fontFamily: "var(--font-space-mono)" }}>
              01
            </div>
            <h3>Connect Solana wallet</h3>
            <p>Phantom, Solflare, or any Solana wallet. No sign-up needed.</p>
          </div>
          <div className="step">
            <div className="num" style={{ fontFamily: "var(--font-space-mono)" }}>
              02
            </div>
            <h3>Enter your Robinhood address</h3>
            <p>
              Your EVM address on the Robinhood chain where you&apos;ll receive
              the tokenized stock.
            </p>
          </div>
          <div className="step">
            <div className="num" style={{ fontFamily: "var(--font-space-mono)" }}>
              03
            </div>
            <h3>Swap and hold</h3>
            <p>
              SOL goes in, our treasury executes the Uniswap swap, and the
              share lands in your Robinhood wallet.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-glass">
          <Image src="/logo.png" alt="Stokehood" width={140} height={40} style={{ objectFit: "contain", marginBottom: 18 }} />
          <p>
            Stokehood is an independent interface for trading tokenized equities
            on-chain. Not affiliated with Robinhood Markets, Inc.
          </p>
          <div className="foot-links">
            <a href="#stocks">Stocks</a>
            <a href="#chart">Charts</a>
            <a href="#buy">Buy</a>
            <a href="#">Docs</a>
          </div>
          <div
            className="foot-fine"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            &copy; 2026 STOKEHOOD — TOKENIZED EQUITIES, ON-CHAIN
          </div>
        </div>
      </footer>
    </>
  );
}
