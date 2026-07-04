// Stock data - mirrors Robinhood chain tokenized equities
export interface Stock {
  sym: string;
  name: string;
  price: number;
  chg: number;
  available: boolean; // whether we currently have inventory to sell
}

export const stocks: Stock[] = [
  { sym: "TSLA", name: "Tesla", price: 214.65, chg: -2.15, available: true },
  { sym: "AMD", name: "AMD", price: 118.6, chg: 0.34, available: true },
  { sym: "AAPL", name: "Apple", price: 214.32, chg: 1.24, available: false },
  { sym: "MSFT", name: "Microsoft", price: 441.58, chg: 0.62, available: false },
  { sym: "NVDA", name: "Nvidia", price: 135.92, chg: 3.41, available: false },
  { sym: "AMZN", name: "Amazon", price: 198.76, chg: -0.83, available: false },
  { sym: "GOOGL", name: "Alphabet", price: 176.44, chg: 1.05, available: false },
  { sym: "META", name: "Meta Platforms", price: 512.3, chg: -1.42, available: false },
];

// USDG stablecoin — also available for swap
export interface SwappableAsset {
  sym: string;
  name: string;
  price: number; // always 1 for stablecoin
  available: boolean;
  isStablecoin: boolean;
}

export const USDG_TOKEN: SwappableAsset = {
  sym: "USDG",
  name: "USDG Stablecoin",
  price: 1,
  available: true,
  isStablecoin: true,
};

// All tradeable assets (stocks + stablecoins)
export const allAssets = [
  { sym: "TSLA", name: "Tesla", price: 214.65, available: true, isStablecoin: false },
  { sym: "AMD", name: "AMD", price: 118.6, available: true, isStablecoin: false },
  { sym: "USDG", name: "USDG Stablecoin", price: 1, available: true, isStablecoin: true },
];

// Treasury wallet address on Robinhood Chain
export const TREASURY_ETH_ADDRESS =
  process.env.NEXT_PUBLIC_TREASURY_ETH_ADDRESS || "0x6bc4d64D1E1FDF96D4eA73AF4C9Db77630402cEC";

// Solana treasury address (receives SOL payments from users)
export const TREASURY_SOL_ADDRESS =
  process.env.NEXT_PUBLIC_TREASURY_SOL_ADDRESS || "YOUR_SOLANA_TREASURY_ADDRESS";

// Solana RPC endpoint
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// We use an inventory-based model:
// Treasury holds pre-bought stock tokens and transfers them to users on order fulfillment
// $1 of SOL in = $1 worth of stock tokens out

// Robinhood chain token addresses
export const RH_TOKEN_ADDRESSES: Record<string, string> = {
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
  AMD: "0x86923f96303D656E4aa86D9d42D1e57ad2023fdC",
  USDG: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
  // Coming soon — inventory not yet stocked
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  AMZN: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
  GOOGL: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
  META: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
};

// Order statuses
export type OrderStatus =
  | "pending_sol_payment"
  | "sol_confirmed"
  | "executing_swap"
  | "swap_complete"
  | "delivering"
  | "complete"
  | "failed";

export interface SwapOrder {
  id: string;
  userSolAddress: string;
  userEthAddress: string; // Robinhood chain address to receive tokens
  stockSymbol: string;
  solAmount: number;
  usdValue: number;
  stockQuantity: number;
  status: OrderStatus;
  solTxSignature?: string;
  ethTxHash?: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
}
