import { ethers } from "ethers";
import {
  TREASURY_ETH_ADDRESS,
  RH_TOKEN_ADDRESSES,
} from "./constants";

// ERC20 ABI (minimal - transfer + balanceOf + decimals)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

/**
 * Get Robinhood Chain provider
 */
function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl =
    process.env.ETHEREUM_RPC_URL ||
    "https://robinhood-mainnet.g.alchemy.com/v2/YOUR_KEY";
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get treasury wallet signer on Robinhood Chain
 */
function getTreasurySigner(): ethers.Wallet {
  const privateKey = process.env.TREASURY_ETH_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("TREASURY_ETH_PRIVATE_KEY not configured");
  }
  return new ethers.Wallet(privateKey, getProvider());
}

/**
 * Fulfill an order by transferring stock tokens from treasury inventory to user.
 * 
 * Flow: $1 SOL in = $1 worth of stock tokens out
 * The caller provides the USD value and the stock price to calculate quantity.
 *
 * @param stockSymbol - The stock ticker (e.g. "TSLA")
 * @param usdValue - Dollar value the user paid (calculated from SOL amount * SOL price)
 * @param stockPrice - Current price per share of the stock
 * @param recipientAddress - User's EVM address on Robinhood chain
 * @returns Transaction hash and amount sent
 */
export async function executeSwap(
  stockSymbol: string,
  usdValue: number,
  recipientAddress: string
): Promise<{ txHash: string; amountOut: string }> {
  const signer = getTreasurySigner();

  const tokenAddress = RH_TOKEN_ADDRESSES[stockSymbol];
  if (!tokenAddress) {
    throw new Error(`No token address found for ${stockSymbol}`);
  }

  const provider = getProvider();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // Get token decimals
  let decimals: number;
  try {
    decimals = await tokenContract.decimals();
  } catch {
    decimals = 18; // default to 18 if call fails
  }

  // Calculate how many tokens to send
  // usdValue is already calculated by the caller (solAmount * solPrice)
  // stockQuantity = usdValue / stockPrice — but stockPrice is in the order already
  // The order stores stockQuantity, so we use usdValue as a proxy:
  // We need to figure out how many token units = stockQuantity shares
  // For Robinhood stock tokens, 1 token = 1 share typically (with decimals)
  
  // Fetch current asset price
  const { stocks, USDG_TOKEN } = await import("./constants");
  const stock = stocks.find((s) => s.sym === stockSymbol);
  const isUSDG = stockSymbol === "USDG";
  
  if (!stock && !isUSDG) {
    throw new Error(`Asset ${stockSymbol} not found`);
  }

  const assetPrice = isUSDG ? USDG_TOKEN.price : stock!.price;
  const stockQuantity = usdValue / assetPrice;
  
  // Convert to token units (accounting for decimals)
  const tokenAmount = ethers.parseUnits(stockQuantity.toFixed(decimals), decimals);

  // Check treasury has enough inventory
  const balance = await tokenContract.balanceOf(TREASURY_ETH_ADDRESS);
  if (balance < tokenAmount) {
    throw new Error(
      `Insufficient ${stockSymbol} inventory. Need ${stockQuantity.toFixed(4)} shares, treasury has ${ethers.formatUnits(balance, decimals)}`
    );
  }

  // Transfer stock tokens to user
  const tx = await tokenContract.transfer(recipientAddress, tokenAmount);
  const receipt = await tx.wait();

  if (!receipt || receipt.status === 0) {
    throw new Error("Transfer transaction reverted");
  }

  return {
    txHash: receipt.hash,
    amountOut: stockQuantity.toFixed(6),
  };
}

/**
 * Check treasury inventory for a specific stock token
 */
export async function getInventory(stockSymbol: string): Promise<number> {
  const tokenAddress = RH_TOKEN_ADDRESSES[stockSymbol];
  if (!tokenAddress) return 0;

  const provider = getProvider();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  try {
    const balance = await tokenContract.balanceOf(TREASURY_ETH_ADDRESS);
    const decimals = await tokenContract.decimals();
    return Number(ethers.formatUnits(balance, decimals));
  } catch {
    return 0;
  }
}

/**
 * Check treasury ETH balance on Robinhood Chain (for gas)
 */
export async function getTreasuryBalance(): Promise<number> {
  const provider = getProvider();
  const balance = await provider.getBalance(TREASURY_ETH_ADDRESS);
  return Number(ethers.formatEther(balance));
}
