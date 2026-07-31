import type { MarketDataSnapshot } from "../../domain/market-data/index.js";
import type { AssetType, Market } from "../../domain/value-objects/index.js";

export interface WatchlistAsset {
  assetId: string;
  symbol: string;
  market: Market;
  assetType: AssetType;
}

export interface MarketDataProvider {
  /** Returns the most recent snapshots for one asset, oldest first. */
  fetchRecentSnapshots(asset: WatchlistAsset, now: Date): Promise<MarketDataSnapshot[]>;
}
