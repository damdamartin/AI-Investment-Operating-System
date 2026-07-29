import { ConfigurationError } from "../shared/errors.js";
import { AssetType, Market } from "../domain/value-objects/index.js";

export interface WatchlistAssetConfig {
  symbol: string;
  name: string;
  market: Market;
  assetType: AssetType;
}

export interface PipelineRiskLimitsConfig {
  maxOrderAmountMajor: string;
  maxPositionExposureRatio: number;
  maxStrategyExposureRatio: number;
  maxMarketExposureRatio: number;
  maxDrawdownRatio: number;
}

export interface PipelineMoneyLimitsConfig {
  maxOrderAmountMajor: string;
  maxStrategyAllocationMajor: string;
  minCashAfterOrderMajor: string;
}

export interface PipelinePortfolioStateConfig {
  currency: "KRW" | "USD";
  totalEquityMajor: string;
  availableCashMajor: string;
  currentAssetExposureMajor: string;
  currentStrategyExposureMajor: string;
  currentMarketExposureMajor: string;
  currentDrawdownRatio: number;
}

export interface PipelineConfig {
  watchlist: WatchlistAssetConfig[];
  strategyName: string;
  strategyVersion: string;
  scoringVersion: string;
  buyThreshold: number;
  sellThreshold: number;
  recommendationQuantity: string;
  riskLimits: PipelineRiskLimitsConfig;
  moneyLimits: PipelineMoneyLimitsConfig;
  portfolio: PipelinePortfolioStateConfig;
  killSwitchActive: boolean;
  killSwitchReason: string | undefined;
  d1: {
    accountId: string;
    databaseId: string;
    apiToken: string;
  };
}

const DEFAULT_WATCHLIST = "005930:Samsung Electronics:KR:STOCK,000660:SK Hynix:KR:STOCK";

/**
 * Loads configuration for the automated recommendation pipeline (see
 * src/application/pipeline/auto-recommendation-orchestrator.ts). This is
 * separate from `loadAppConfig` (src/config/environment.ts), which governs
 * the older, broker-write-oriented config and its `LIVE_TRADING_ENABLED`
 * guard. This pipeline never places a real order, so it has no such flag.
 */
export function loadPipelineConfig(env: NodeJS.ProcessEnv = process.env): PipelineConfig {
  const watchlistRaw = env.PIPELINE_WATCHLIST?.trim() || DEFAULT_WATCHLIST;
  const watchlist = parseWatchlist(watchlistRaw);

  const d1AccountId = requireEnv(env, "CLOUDFLARE_ACCOUNT_ID");
  const d1DatabaseId = requireEnv(env, "CLOUDFLARE_D1_DATABASE_ID");
  const d1ApiToken = requireEnv(env, "CLOUDFLARE_API_TOKEN");

  return {
    watchlist,
    strategyName: env.PIPELINE_STRATEGY_NAME?.trim() || "baseline-market-trend",
    strategyVersion: env.PIPELINE_STRATEGY_VERSION?.trim() || "v1",
    scoringVersion: env.PIPELINE_SCORING_VERSION?.trim() || "scoring-v1",
    buyThreshold: readNumber(env.PIPELINE_BUY_THRESHOLD, 65),
    sellThreshold: readNumber(env.PIPELINE_SELL_THRESHOLD, 35),
    recommendationQuantity: env.PIPELINE_RECOMMENDATION_QUANTITY?.trim() || "1",
    riskLimits: {
      maxOrderAmountMajor: env.PIPELINE_RISK_MAX_ORDER_AMOUNT?.trim() || "1000000",
      maxPositionExposureRatio: readNumber(env.PIPELINE_RISK_MAX_POSITION_EXPOSURE_RATIO, 0.2),
      maxStrategyExposureRatio: readNumber(env.PIPELINE_RISK_MAX_STRATEGY_EXPOSURE_RATIO, 0.5),
      maxMarketExposureRatio: readNumber(env.PIPELINE_RISK_MAX_MARKET_EXPOSURE_RATIO, 0.8),
      maxDrawdownRatio: readNumber(env.PIPELINE_RISK_MAX_DRAWDOWN_RATIO, 0.15)
    },
    moneyLimits: {
      maxOrderAmountMajor: env.PIPELINE_MONEY_MAX_ORDER_AMOUNT?.trim() || "1000000",
      maxStrategyAllocationMajor: env.PIPELINE_MONEY_MAX_STRATEGY_ALLOCATION?.trim() || "3000000",
      minCashAfterOrderMajor: env.PIPELINE_MONEY_MIN_CASH_AFTER_ORDER?.trim() || "500000"
    },
    portfolio: {
      currency: env.PIPELINE_PORTFOLIO_CURRENCY === "USD" ? "USD" : "KRW",
      totalEquityMajor: env.PIPELINE_PORTFOLIO_TOTAL_EQUITY?.trim() || "10000000",
      availableCashMajor: env.PIPELINE_PORTFOLIO_AVAILABLE_CASH?.trim() || "10000000",
      currentAssetExposureMajor: env.PIPELINE_PORTFOLIO_ASSET_EXPOSURE?.trim() || "0",
      currentStrategyExposureMajor: env.PIPELINE_PORTFOLIO_STRATEGY_EXPOSURE?.trim() || "0",
      currentMarketExposureMajor: env.PIPELINE_PORTFOLIO_MARKET_EXPOSURE?.trim() || "0",
      currentDrawdownRatio: readNumber(env.PIPELINE_PORTFOLIO_DRAWDOWN_RATIO, 0)
    },
    killSwitchActive: readBoolean(env.PIPELINE_KILL_SWITCH_ACTIVE, false),
    killSwitchReason: env.PIPELINE_KILL_SWITCH_REASON?.trim() || undefined,
    d1: {
      accountId: d1AccountId,
      databaseId: d1DatabaseId,
      apiToken: d1ApiToken
    }
  };
}

function parseWatchlist(raw: string): WatchlistAssetConfig[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const parts = entry.split(":");
      if (parts.length !== 4) {
        throw new ConfigurationError(
          `PIPELINE_WATCHLIST entry "${entry}" must have the form SYMBOL:NAME:MARKET:ASSET_TYPE.`
        );
      }
      const [symbol, name, marketCode, assetTypeCode] = parts as [string, string, string, string];
      return {
        symbol,
        name,
        market: Market.from(marketCode),
        assetType: AssetType.from(assetTypeCode)
      };
    });
}

function readNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ConfigurationError(`Expected a numeric value but received "${value}".`);
  }
  return parsed;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ConfigurationError(`Expected "true" or "false" but received "${value}".`);
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value || value.trim() === "") {
    throw new ConfigurationError(`${name} is required.`);
  }
  return value;
}
