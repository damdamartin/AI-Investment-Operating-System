import { requireEntityId, type EntityId } from "../common/index.js";
import { AssetType, Market, Price, Quantity } from "../value-objects/index.js";

export type MarketDataSource = "TOSS_SECURITIES" | "TEST_FIXTURE" | "UNKNOWN";

export type MarketDataFreshnessStatus = "FRESH" | "STALE" | "MISSING" | "SUSPECT";

export interface MarketDataFreshnessPolicy {
  maxCollectedAgeMs: number;
  maxLastTradeAgeMs?: number;
  allowZeroVolume?: boolean;
}

export interface MarketDataFreshnessAssessment {
  status: MarketDataFreshnessStatus;
  reasons: string[];
  collectedAgeMs: number;
  lastTradeAgeMs: number | undefined;
  blocksTradingDecision: boolean;
}

export interface MarketDataSnapshotProps {
  assetId: string;
  symbol: string;
  market: Market;
  assetType: AssetType;
  price?: Price | undefined;
  volume?: Quantity | undefined;
  lastTradeAt?: Date | undefined;
  collectedAt: Date;
  source: MarketDataSource;
  sourceRequestId?: string | undefined;
  suspectReasons?: string[];
}

export interface MarketDataSnapshotRecord {
  assetId: string;
  symbol: string;
  market: string;
  assetType: string;
  price?: string | undefined;
  volume?: string | undefined;
  lastTradeAt?: string | undefined;
  collectedAt: string;
  source: MarketDataSource;
  sourceRequestId?: string | undefined;
  suspectReasons: string[];
}

export class MarketDataSnapshot {
  readonly assetId: EntityId;
  readonly symbol: EntityId;
  readonly market: Market;
  readonly assetType: AssetType;
  readonly price: Price | undefined;
  readonly volume: Quantity | undefined;
  readonly lastTradeAt: Date | undefined;
  readonly collectedAt: Date;
  readonly source: MarketDataSource;
  readonly sourceRequestId: string | undefined;
  readonly suspectReasons: string[];

  constructor(props: MarketDataSnapshotProps) {
    this.assetId = requireEntityId(props.assetId, "Market data asset id");
    this.symbol = requireEntityId(props.symbol, "Market data symbol");
    this.market = props.market;
    this.assetType = props.assetType;
    this.price = props.price;
    this.volume = props.volume;
    this.lastTradeAt = props.lastTradeAt;
    this.collectedAt = props.collectedAt;
    this.source = props.source;
    this.sourceRequestId = props.sourceRequestId;
    this.suspectReasons = props.suspectReasons ?? [];
  }

  assessFreshness(policy: MarketDataFreshnessPolicy, now: Date): MarketDataFreshnessAssessment {
    const reasons: string[] = [];
    const collectedAgeMs = now.getTime() - this.collectedAt.getTime();
    const lastTradeAgeMs = this.lastTradeAt ? now.getTime() - this.lastTradeAt.getTime() : undefined;

    if (!this.price) reasons.push("missing_price");
    if (!this.volume) reasons.push("missing_volume");
    if (!Number.isFinite(this.collectedAt.getTime())) reasons.push("invalid_collected_at");
    if (this.lastTradeAt && !Number.isFinite(this.lastTradeAt.getTime())) reasons.push("invalid_last_trade_at");

    if (this.price && this.price.units === 0n) reasons.push("zero_price");
    if (this.volume && this.volume.isZero() && policy.allowZeroVolume !== true) reasons.push("zero_volume");
    if (this.source === "UNKNOWN") reasons.push("unknown_source");
    if (this.suspectReasons.length > 0) reasons.push(...this.suspectReasons.map((reason) => `suspect_${reason}`));

    if (collectedAgeMs < 0) reasons.push("collected_at_in_future");
    if (lastTradeAgeMs !== undefined && lastTradeAgeMs < 0) reasons.push("last_trade_at_in_future");

    const missing = reasons.some((reason) => reason.startsWith("missing_") || reason.startsWith("invalid_"));
    if (missing) {
      return {
        status: "MISSING",
        reasons,
        collectedAgeMs,
        lastTradeAgeMs,
        blocksTradingDecision: true
      };
    }

    const suspect = reasons.length > 0;
    if (suspect) {
      return {
        status: "SUSPECT",
        reasons,
        collectedAgeMs,
        lastTradeAgeMs,
        blocksTradingDecision: true
      };
    }

    if (collectedAgeMs > policy.maxCollectedAgeMs) {
      return {
        status: "STALE",
        reasons: ["stale_collected_at"],
        collectedAgeMs,
        lastTradeAgeMs,
        blocksTradingDecision: true
      };
    }

    if (
      lastTradeAgeMs !== undefined &&
      policy.maxLastTradeAgeMs !== undefined &&
      lastTradeAgeMs > policy.maxLastTradeAgeMs
    ) {
      return {
        status: "STALE",
        reasons: ["stale_last_trade_at"],
        collectedAgeMs,
        lastTradeAgeMs,
        blocksTradingDecision: true
      };
    }

    return {
      status: "FRESH",
      reasons: [],
      collectedAgeMs,
      lastTradeAgeMs,
      blocksTradingDecision: false
    };
  }

  toRecord(): MarketDataSnapshotRecord {
    return {
      assetId: this.assetId,
      symbol: this.symbol,
      market: this.market.code,
      assetType: this.assetType.code,
      price: this.price?.toString(),
      volume: this.volume?.toString(),
      lastTradeAt: this.lastTradeAt?.toISOString(),
      collectedAt: this.collectedAt.toISOString(),
      source: this.source,
      sourceRequestId: this.sourceRequestId,
      suspectReasons: [...this.suspectReasons]
    };
  }
}

export interface MarketDataReadRepository {
  saveSnapshot(snapshot: MarketDataSnapshot): Promise<void>;
  findLatestSnapshot(assetId: EntityId): Promise<MarketDataSnapshot | undefined>;
}
