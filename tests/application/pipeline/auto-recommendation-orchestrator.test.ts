import { describe, expect, it, vi } from "vitest";
import {
  AssetType,
  Currency,
  Market,
  MarketDataSnapshot,
  Price,
  Quantity
} from "../../../src/index.js";
import type { PipelineConfig } from "../../../src/config/pipeline-config.js";
import type {
  AutoRecommendationRepository,
  OrchestratorDependencies
} from "../../../src/application/pipeline/auto-recommendation-orchestrator.js";
import { runAutoRecommendationCycle } from "../../../src/application/pipeline/auto-recommendation-orchestrator.js";
import type { MarketDataProvider } from "../../../src/application/pipeline/market-data-provider.js";

const NOW = new Date("2026-07-30T09:00:00.000Z");

function fakeRepository(): AutoRecommendationRepository & {
  insertOrderRecommendation: ReturnType<typeof vi.fn>;
  insertRiskCheck: ReturnType<typeof vi.fn>;
  insertMoneyCheck: ReturnType<typeof vi.fn>;
} {
  return {
    createCycleRun: vi.fn(async () => "cycle-1"),
    completeCycleRun: vi.fn(async () => undefined),
    upsertAsset: vi.fn(async () => "asset-1"),
    upsertStrategyVersion: vi.fn(async () => "strategy-version-1"),
    insertSignal: vi.fn(async (signal) => signal.id),
    insertRiskCheck: vi.fn(async (riskCheck) => riskCheck.id),
    insertMoneyCheck: vi.fn(async (moneyCheck) => moneyCheck.id),
    insertOrderRecommendation: vi.fn(async () => "recommendation-1"),
    insertAuditLog: vi.fn(async () => "audit-1"),
    insertPosition: vi.fn(async (position) => position.id),
    getOpenPositions: vi.fn(async () => []),
    getOpenPositionsByAsset: vi.fn(async () => []),
    closePosition: vi.fn(async () => undefined)
  };
}

function trendingMarketDataProvider(direction: "UP" | "FLAT"): MarketDataProvider {
  return {
    async fetchRecentSnapshots(asset, now) {
      const krw = Currency.from("KRW");
      const startPrice = 50_000;
      const endPrice = direction === "UP" ? 65_000 : 50_000;
      const volume = "200000000000000"; // pushes MARKET_VOLUME score high

      return [
        new MarketDataSnapshot({
          assetId: asset.assetId,
          symbol: asset.symbol,
          market: asset.market,
          assetType: asset.assetType,
          price: Price.from(String(startPrice), krw),
          volume: Quantity.from(volume),
          lastTradeAt: new Date(now.getTime() - 60 * 60 * 1000),
          collectedAt: new Date(now.getTime() - 60 * 60 * 1000),
          source: "TEST_FIXTURE"
        }),
        new MarketDataSnapshot({
          assetId: asset.assetId,
          symbol: asset.symbol,
          market: asset.market,
          assetType: asset.assetType,
          price: Price.from(String(endPrice), krw),
          volume: Quantity.from(volume),
          lastTradeAt: now,
          collectedAt: now,
          source: "TEST_FIXTURE"
        })
      ];
    }
  };
}

function baseConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    watchlist: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: Market.from("KR"),
        assetType: AssetType.from("STOCK")
      }
    ],
    strategyName: "test-strategy",
    strategyVersion: "v1",
    scoringVersion: "scoring-v1",
    buyThreshold: 65,
    sellThreshold: 35,
    recommendationQuantity: "1",
    riskLimits: {
      maxOrderAmountMajor: "1000000",
      maxPositionExposureRatio: 0.2,
      maxStrategyExposureRatio: 0.5,
      maxMarketExposureRatio: 0.8,
      maxDrawdownRatio: 0.15
    },
    moneyLimits: {
      maxOrderAmountMajor: "1000000",
      maxStrategyAllocationMajor: "3000000",
      minCashAfterOrderMajor: "500000"
    },
    portfolio: {
      currency: "KRW",
      totalEquityMajor: "10000000",
      availableCashMajor: "10000000",
      currentAssetExposureMajor: "0",
      currentStrategyExposureMajor: "0",
      currentMarketExposureMajor: "0",
      currentDrawdownRatio: 0
    },
    killSwitchActive: false,
    killSwitchReason: undefined,
    d1: { accountId: "acct", databaseId: "db", apiToken: "token" },
    ...overrides
  };
}

function deps(overrides: {
  config?: Partial<PipelineConfig>;
  marketDataProvider?: MarketDataProvider;
  repository?: AutoRecommendationRepository;
}): { deps: OrchestratorDependencies; repository: ReturnType<typeof fakeRepository> } {
  const repository = (overrides.repository as ReturnType<typeof fakeRepository>) ?? fakeRepository();
  return {
    repository,
    deps: {
      repository,
      marketDataProvider: overrides.marketDataProvider ?? trendingMarketDataProvider("UP"),
      config: baseConfig(overrides.config),
      now: () => NOW
    }
  };
}

describe("runAutoRecommendationCycle", () => {
  it("creates a PENDING_HUMAN_SUBMISSION recommendation when risk, money, and kill-switch checks all pass", async () => {
    const { deps: d, repository } = deps({});

    const result = await runAutoRecommendationCycle(d);

    expect(result.assetOutcomes).toEqual([{ symbol: "005930", outcome: "RECOMMENDATION_CREATED" }]);
    expect(repository.insertOrderRecommendation).toHaveBeenCalledTimes(1);
    expect(repository.insertOrderRecommendation.mock.calls[0]![0]).toMatchObject({ direction: "BUY" });
  });

  it("never creates a recommendation when the signal is HOLD", async () => {
    const { deps: d, repository } = deps({ marketDataProvider: trendingMarketDataProvider("FLAT") });

    const result = await runAutoRecommendationCycle(d);

    expect(result.assetOutcomes).toEqual([{ symbol: "005930", outcome: "HOLD" }]);
    expect(repository.insertOrderRecommendation).not.toHaveBeenCalled();
    expect(repository.insertRiskCheck).not.toHaveBeenCalled();
    expect(repository.insertMoneyCheck).not.toHaveBeenCalled();
  });

  it("blocks the recommendation when the risk engine fails the order", async () => {
    const { deps: d, repository } = deps({
      config: { riskLimits: { ...baseConfig().riskLimits, maxOrderAmountMajor: "1" } }
    });

    const result = await runAutoRecommendationCycle(d);

    expect(result.assetOutcomes).toEqual([{ symbol: "005930", outcome: "RISK_CHECK_FAILED", detail: expect.arrayContaining(["max_order_amount_exceeded"]) }]);
    expect(repository.insertOrderRecommendation).not.toHaveBeenCalled();
    expect(repository.insertMoneyCheck).not.toHaveBeenCalled();
  });

  it("blocks the recommendation when the money management engine fails the order", async () => {
    const { deps: d, repository } = deps({
      config: {
        moneyLimits: { ...baseConfig().moneyLimits, minCashAfterOrderMajor: "9999999" }
      }
    });

    const result = await runAutoRecommendationCycle(d);

    expect(result.assetOutcomes).toEqual([
      { symbol: "005930", outcome: "MONEY_CHECK_FAILED", detail: expect.arrayContaining(["minimum_cash_after_order_breached"]) }
    ]);
    expect(repository.insertOrderRecommendation).not.toHaveBeenCalled();
  });

  it("blocks the recommendation when the kill switch is active, even if money limits would otherwise pass", async () => {
    // The risk engine folds the kill-switch gate into its own BLOCKED
    // result (defense in depth - see risk-engine.ts), so an active kill
    // switch surfaces as RISK_CHECK_FAILED with a kill_switch_active_*
    // reason code, not a separate outcome category.
    const { deps: d, repository } = deps({ config: { killSwitchActive: true, killSwitchReason: "manual test halt" } });

    const result = await runAutoRecommendationCycle(d);

    expect(result.assetOutcomes).toEqual([
      { symbol: "005930", outcome: "RISK_CHECK_FAILED", detail: expect.arrayContaining(["kill_switch_active_global"]) }
    ]);
    expect(repository.insertOrderRecommendation).not.toHaveBeenCalled();
  });

  it("marks the cycle run COMPLETED on success", async () => {
    const { deps: d, repository } = deps({});

    await runAutoRecommendationCycle(d);

    expect(repository.completeCycleRun).toHaveBeenCalledWith("cycle-1", NOW, "COMPLETED");
  });
});
