import type { WatchlistAsset } from "../../../pipeline/market-data-provider.js";
import { MarketDataSnapshot } from "../../../../domain/market-data/index.js";
import { Price, Currency, Quantity } from "../../../../domain/value-objects/index.js";

export interface AlpacaBar {
  t: string; // ISO timestamp
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  n?: number; // Trade count
  vw?: number; // Volume weighted average price
}

export interface AlpacaLatestTrade {
  t: string; // ISO timestamp
  ex: string; // Exchange
  p: number; // Price
  s: number; // Size
  c: string[]; // Conditions
  z: string; // Tape
}

export interface AlpacaLatestQuote {
  t: string; // ISO timestamp
  ax: string; // Ask exchange
  ap: number; // Ask price
  as: number; // Ask size
  bx: string; // Bid exchange
  bp: number; // Bid price
  bs: number; // Bid size
  c: string[]; // Conditions
  z: string; // Tape
}

export interface AlpacaMarketDataConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string; // https://api.alpaca.markets or paper trading endpoint
}

/**
 * Alpaca Market Data Provider
 * Fetches real-time and historical price data from Alpaca API
 */
export class AlpacaMarketDataProvider {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(config: AlpacaMarketDataConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl || "https://api.alpaca.markets";
  }

  /**
   * Fetch recent market snapshots for a US stock
   */
  async fetchRecentSnapshots(asset: WatchlistAsset, now: Date): Promise<MarketDataSnapshot[]> {
    try {
      // Get bars
      const bars = await this.fetchBars(asset.symbol, "1Min", 5); // 5 recent bars

      if (!bars || bars.length === 0) {
        return [];
      }

      // Convert to internal snapshot format
      const snapshots = bars.map((bar, idx) => {
        const timestamp = new Date(bar.t);
        const price = Price.from(bar.c.toString(), Currency.from("USD"));
        const volume = Quantity.from(Math.floor(bar.v).toString());

        return new MarketDataSnapshot({
          assetId: asset.symbol,
          symbol: asset.symbol,
          market: asset.market,
          assetType: asset.assetType,
          price,
          volume,
          lastTradeAt: timestamp,
          collectedAt: now,
          source: "UNKNOWN",
          suspectReasons: this.validateSnapshot({
            price: bar.c,
            volume: bar.v,
            timestamp
          })
        });
      });

      return snapshots;
    } catch (error) {
      console.error(`[AlpacaMarketDataProvider] Error fetching data for ${asset.symbol}:`, error);
      return [];
    }
  }

  /**
   * Fetch latest trade for a symbol
   */
  private async fetchLatestTrade(symbol: string): Promise<AlpacaLatestTrade | null> {
    try {
      const url = `${this.baseUrl}/v2/stocks/${symbol}/trades/latest`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        console.error(`[AlpacaMarketDataProvider] Failed to fetch latest trade for ${symbol}: ${response.statusText}`);
        return null;
      }

      const data = await response.json() as { trade?: AlpacaLatestTrade };
      return data.trade || null;
    } catch (error) {
      console.error(`[AlpacaMarketDataProvider] Error fetching latest trade for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch latest quote for a symbol
   */
  private async fetchLatestQuote(symbol: string): Promise<AlpacaLatestQuote | null> {
    try {
      const url = `${this.baseUrl}/v2/stocks/${symbol}/quotes/latest`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        console.error(`[AlpacaMarketDataProvider] Failed to fetch latest quote for ${symbol}: ${response.statusText}`);
        return null;
      }

      const data = await response.json() as { quote?: AlpacaLatestQuote };
      return data.quote || null;
    } catch (error) {
      console.error(`[AlpacaMarketDataProvider] Error fetching latest quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch historical bars (OHLCV data)
   */
  private async fetchBars(symbol: string, timeframe: string, limit: number): Promise<AlpacaBar[]> {
    try {
      const url = new URL(`${this.baseUrl}/v2/stocks/${symbol}/bars`);
      url.searchParams.append("timeframe", timeframe);
      url.searchParams.append("limit", limit.toString());
      url.searchParams.append("sort", "desc");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        console.error(`[AlpacaMarketDataProvider] Failed to fetch bars for ${symbol}: ${response.statusText}`);
        return [];
      }

      const data = await response.json() as { bars?: AlpacaBar[] };
      return (data.bars || []).reverse(); // Oldest first
    } catch (error) {
      console.error(`[AlpacaMarketDataProvider] Error fetching bars for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Validate snapshot quality
   */
  private validateSnapshot(data: { price: number; volume: number; timestamp: Date }): string[] {
    const reasons: string[] = [];

    if (data.price <= 0) {
      reasons.push("ZERO_OR_NEGATIVE_PRICE");
    }

    if (data.volume === 0) {
      reasons.push("ZERO_VOLUME");
    }

    // Check if data is too old (> 10 minutes)
    const ageMs = Date.now() - data.timestamp.getTime();
    if (ageMs > 10 * 60 * 1000) {
      reasons.push("STALE_DATA");
    }

    return reasons;
  }

  /**
   * Get account info (for validation)
   */
  async getAccountInfo(): Promise<{ equity: number; cash: number; buying_power: number } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/account`, {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { equity?: number; cash?: number; buying_power?: number };
      return {
        equity: data.equity || 0,
        cash: data.cash || 0,
        buying_power: data.buying_power || 0
      };
    } catch (error) {
      console.error("[AlpacaMarketDataProvider] Error fetching account info:", error);
      return null;
    }
  }
}
