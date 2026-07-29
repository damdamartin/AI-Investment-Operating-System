import { randomUUID } from "node:crypto";
import type { PipelineConfig, WatchlistAssetConfig } from "../../config/pipeline-config.js";
import { Asset } from "../../domain/assets/index.js";
import { OrderIntent } from "../../domain/orders/index.js";
import { CashBalance } from "../../domain/portfolio/index.js";
import { KillSwitchState } from "../../domain/risk/index.js";
import { StrategyVersion } from "../../domain/strategy/index.js";
import { Currency, Money, Price, Quantity } from "../../domain/value-objects/index.js";
import { KillSwitchControlService } from "../kill-switch/index.js";
import { MoneyManagementEngine } from "../money-management/index.js";
import { MarketEngine } from "../market/index.js";
import type { PipelineRepository } from "../../persistence/pipeline-repository.js";
import { RiskEngine } from "../risk-engine/index.js";
import { StrategyScoringService } from "../strategy-scoring/index.js";
import type { MarketDataProvider } from "./market-data-provider.js";

/**
 * Narrow slice of `PipelineRepository` this orchestrator depends on, so
 * tests can supply an in-memory fake instead of a real D1-backed instance.
 */
export type AutoRecommendationRepository = Pick<
  PipelineRepository,
  | "createCycleRun"
  | "completeCycleRun"
  | "upsertAsset"
  | "upsertStrategyVersion"
  | "insertSignal"
  | "insertRiskCheck"
  | "insertMoneyCheck"
  | "insertOrderRecommendation"
  | "insertAuditLog"
>;

export interface OrchestratorDependencies {
  repository: AutoRecommendationRepository;
  marketDataProvider: MarketDataProvider;
  config: PipelineConfig;
  now: () => Date;
}

export interface AssetCycleOutcome {
  symbol: string;
  outcome:
    | "MARKET_DATA_REFUSED"
    | "STRATEGY_SCORING_REFUSED"
    | "HOLD"
    | "RISK_CHECK_FAILED"
    | "MONEY_CHECK_FAILED"
    | "RECOMMENDATION_CREATED";
  detail?: string[];
}

export interface CycleResult {
  cycleRunId: string;
  assetOutcomes: AssetCycleOutcome[];
}

const riskEngine = new RiskEngine();
const moneyEngine = new MoneyManagementEngine();
const marketEngine = new MarketEngine();
const strategyScoringService = new StrategyScoringService();
const killSwitchControlService = new KillSwitchControlService();

/**
 * Runs one full, unattended cycle of the recommendation pipeline: market
 * data -> strategy scoring -> risk check -> money check -> recommendation.
 *
 * This function never submits a real broker order. Its only externally
 * visible write is an `order_recommendations` row with status
 * PENDING_HUMAN_SUBMISSION - a human decides what happens next. See
 * docs/11_AI_RULES.md Rule 1 and Rule 22.
 */
export async function runAutoRecommendationCycle(deps: OrchestratorDependencies): Promise<CycleResult> {
  const now = deps.now();
  const { repository, config } = deps;
  const cycleRunId = await repository.createCycleRun(now);
  const assetOutcomes: AssetCycleOutcome[] = [];

  try {
    const killSwitchReason = config.killSwitchReason ?? "manual_kill_switch";
    const activeKillSwitchState = config.killSwitchActive
      ? new KillSwitchState({
          id: "pipeline-global-kill-switch",
          scope: "ACCOUNT",
          active: true,
          reason: killSwitchReason,
          activatedAt: now
        })
      : undefined;
    // Always pass an explicit state, even when inactive: an empty array
    // reads to KillSwitchControlService as "no state available", which it
    // correctly treats as UNKNOWN and blocks trading (fail closed). Only an
    // explicit INACTIVE state actually allows trading to proceed.
    const killSwitchGate = killSwitchControlService.evaluateAggregateTradingGate([
      activeKillSwitchState
        ? {
            id: activeKillSwitchState.id,
            scope: "GLOBAL",
            status: "ACTIVE",
            reason: killSwitchReason,
            updatedAt: now,
            safetyType: "KILL_SWITCH_CONTROL_STATE_ONLY"
          }
        : {
            id: "pipeline-global-kill-switch",
            scope: "GLOBAL",
            status: "INACTIVE",
            updatedAt: now,
            safetyType: "KILL_SWITCH_CONTROL_STATE_ONLY"
          }
    ]);

    const strategyVersionId = await repository.upsertStrategyVersion(config.strategyName, config.strategyVersion, {
      buyThreshold: config.buyThreshold,
      sellThreshold: config.sellThreshold
    });
    const strategyVersion = new StrategyVersion({
      id: strategyVersionId,
      strategyId: strategyVersionId,
      version: config.strategyVersion,
      status: "PAPER",
      definitionHash: `${config.strategyName}:${config.strategyVersion}`
    });

    for (const watchlistAsset of config.watchlist) {
      const outcome = await runOneAsset({
        deps,
        watchlistAsset,
        cycleRunId,
        strategyVersion,
        strategyVersionId,
        killSwitchActive: config.killSwitchActive,
        killSwitchAllowed: killSwitchGate.allowed,
        killSwitchReasonCodes: killSwitchGate.reasonCodes,
        now
      });
      assetOutcomes.push(outcome);
    }

    await repository.completeCycleRun(cycleRunId, deps.now(), "COMPLETED");
    return { cycleRunId, assetOutcomes };
  } catch (error) {
    await repository.completeCycleRun(cycleRunId, deps.now(), "FAILED", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function runOneAsset(args: {
  deps: OrchestratorDependencies;
  watchlistAsset: WatchlistAssetConfig;
  cycleRunId: string;
  strategyVersion: StrategyVersion;
  strategyVersionId: string;
  killSwitchActive: boolean;
  killSwitchAllowed: boolean;
  killSwitchReasonCodes: string[];
  now: Date;
}): Promise<AssetCycleOutcome> {
  const { deps, watchlistAsset, cycleRunId, strategyVersion, killSwitchAllowed, killSwitchReasonCodes, now } = args;
  const { repository, config } = deps;

  const assetId = await repository.upsertAsset({
    symbol: watchlistAsset.symbol,
    name: watchlistAsset.name,
    market: watchlistAsset.market,
    assetType: watchlistAsset.assetType
  });
  const asset = new Asset({
    id: assetId,
    symbol: watchlistAsset.symbol,
    name: watchlistAsset.name,
    market: watchlistAsset.market,
    assetType: watchlistAsset.assetType,
    tradingStatus: "TRADABLE"
  });

  const snapshots = await deps.marketDataProvider.fetchRecentSnapshots(
    { assetId, symbol: watchlistAsset.symbol, market: watchlistAsset.market, assetType: watchlistAsset.assetType },
    now
  );

  const marketResult = marketEngine.evaluate({
    snapshots,
    freshnessPolicy: { maxCollectedAgeMs: 6 * 60 * 60 * 1000, allowZeroVolume: false },
    now,
    scoringVersion: config.scoringVersion
  });

  if (!marketResult.ok) {
    await repository.insertAuditLog({
      actor: "auto-recommendation-orchestrator",
      action: "MARKET_DATA_REFUSED",
      resourceType: "ASSET",
      resourceId: assetId,
      reason: marketResult.refusal.reasons.join(","),
      metadata: { cycleRunId }
    });
    return { symbol: watchlistAsset.symbol, outcome: "MARKET_DATA_REFUSED", detail: marketResult.refusal.reasons };
  }

  const scoringResult = strategyScoringService.score({
    asset,
    strategyVersion,
    signalId: randomUUID(),
    market: marketResult.output,
    requiredEngines: ["MARKET"],
    weights: { MARKET: 1 },
    buyThreshold: config.buyThreshold,
    sellThreshold: config.sellThreshold,
    scoringVersion: config.scoringVersion,
    now
  });

  if (!scoringResult.ok) {
    await repository.insertAuditLog({
      actor: "auto-recommendation-orchestrator",
      action: "STRATEGY_SCORING_REFUSED",
      resourceType: "ASSET",
      resourceId: assetId,
      reason: scoringResult.refusal.reasons.join(","),
      metadata: { cycleRunId }
    });
    return { symbol: watchlistAsset.symbol, outcome: "STRATEGY_SCORING_REFUSED", detail: scoringResult.refusal.reasons };
  }

  const signal = scoringResult.output.signal;
  await repository.insertSignal(signal, cycleRunId, args.strategyVersionId, assetId);

  if (signal.direction === "HOLD") {
    return { symbol: watchlistAsset.symbol, outcome: "HOLD" };
  }

  const currency = Currency.from(config.portfolio.currency);
  const latestSnapshot = snapshots[snapshots.length - 1]!;
  const limitPrice = latestSnapshot.price ?? Price.from("0", currency);
  const quantity = Quantity.from(config.recommendationQuantity);
  const orderIntent = new OrderIntent({
    id: randomUUID(),
    signal,
    side: signal.direction,
    quantity,
    limitPrice
  });

  const orderAmount = computeOrderAmount(quantity, limitPrice, currency);

  const riskOutput = riskEngine.evaluate({
    riskCheckId: randomUUID(),
    orderIntent,
    orderAmount,
    limits: {
      maxOrderAmount: Money.fromMajor(config.riskLimits.maxOrderAmountMajor, currency),
      maxPositionExposureRatio: config.riskLimits.maxPositionExposureRatio,
      maxStrategyExposureRatio: config.riskLimits.maxStrategyExposureRatio,
      maxMarketExposureRatio: config.riskLimits.maxMarketExposureRatio,
      maxDrawdownRatio: config.riskLimits.maxDrawdownRatio
    },
    portfolio: {
      totalEquity: Money.fromMajor(config.portfolio.totalEquityMajor, currency),
      currentAssetExposure: Money.fromMajor(config.portfolio.currentAssetExposureMajor, currency),
      currentStrategyExposure: Money.fromMajor(config.portfolio.currentStrategyExposureMajor, currency),
      currentMarketExposure: Money.fromMajor(config.portfolio.currentMarketExposureMajor, currency),
      currentDrawdownRatio: config.portfolio.currentDrawdownRatio
    },
    killSwitches: args.killSwitchActive
      ? [new KillSwitchState({ id: "pipeline-global-kill-switch", scope: "ACCOUNT", active: true, reason: "manual_kill_switch" })]
      : [],
    killSwitchGate: {
      allowed: killSwitchAllowed,
      blocksNewOrders: !killSwitchAllowed,
      reasonCodes: killSwitchReasonCodes,
      brokerWriteGate: { active: !killSwitchAllowed, scope: "GLOBAL" },
      safetyType: "KILL_SWITCH_TRADING_GATE_ONLY"
    },
    checkedAt: now
  });

  const riskCheckId = await repository.insertRiskCheck(riskOutput.riskCheck, signal.id);

  if (!riskOutput.riskCheck.allowsApproval()) {
    return { symbol: watchlistAsset.symbol, outcome: "RISK_CHECK_FAILED", detail: riskOutput.reasonCodes };
  }

  const moneyOutput = moneyEngine.evaluate({
    moneyCheckId: randomUUID(),
    orderIntent,
    requestedAmount: orderAmount,
    state: {
      cashBalance: new CashBalance({
        id: "pipeline-portfolio-cash",
        portfolioId: "pipeline-portfolio",
        currency,
        available: Money.fromMajor(config.portfolio.availableCashMajor, currency),
        reserved: Money.zero(currency),
        unsettled: Money.zero(currency),
        updatedAt: now
      }),
      currentStrategyAllocation: Money.fromMajor(config.portfolio.currentStrategyExposureMajor, currency)
    },
    limits: {
      maxOrderAmount: Money.fromMajor(config.moneyLimits.maxOrderAmountMajor, currency),
      maxStrategyAllocation: Money.fromMajor(config.moneyLimits.maxStrategyAllocationMajor, currency),
      minCashAfterOrder: Money.fromMajor(config.moneyLimits.minCashAfterOrderMajor, currency)
    },
    checkedAt: now
  });

  const moneyCheckId = await repository.insertMoneyCheck(moneyOutput.moneyCheck, signal.id);

  if (!moneyOutput.moneyCheck.allowsApproval()) {
    return { symbol: watchlistAsset.symbol, outcome: "MONEY_CHECK_FAILED", detail: moneyOutput.reasonCodes };
  }

  // No separate kill-switch branch here: `riskEngine.evaluate` above already
  // folds `killSwitchGate` into its own BLOCKED result (see risk-engine.ts),
  // so an active kill switch is always caught by the RISK_CHECK_FAILED
  // return above, with `kill_switch_active_*` in its reason codes. This is
  // the defense-in-depth behavior documented on `RiskEngineInput.killSwitchGate`.

  await repository.insertOrderRecommendation({
    signalId: signal.id,
    riskCheckId,
    moneyCheckId,
    assetId,
    direction: signal.direction,
    recommendedQuantity: quantity.toString(),
    recommendedAmountMajor: orderAmount.toMajorString(),
    recommendedCurrency: config.portfolio.currency,
    reasoning: `Composite score ${scoringResult.output.compositeScore} (confidence ${scoringResult.output.compositeConfidence}) from engines: ${scoringResult.output.requiredEngines.join(", ")}.`
  });

  await repository.insertAuditLog({
    actor: "auto-recommendation-orchestrator",
    action: "ORDER_RECOMMENDATION_CREATED",
    resourceType: "SIGNAL",
    resourceId: signal.id,
    metadata: { cycleRunId, symbol: watchlistAsset.symbol, direction: signal.direction }
  });

  return { symbol: watchlistAsset.symbol, outcome: "RECOMMENDATION_CREATED" };
}

/**
 * Simplified major-unit multiplication (quantity * price) suitable for
 * whole-share KRW positions in this pipeline's small-capital scope. Not a
 * general-purpose decimal-safe money multiplier.
 */
function computeOrderAmount(quantity: Quantity, price: Price, currency: Currency): Money {
  const quantityMajor = Number(quantity.toString());
  const priceMajor = Number(price.toString().split(" ")[0]);
  const amount = Math.round(quantityMajor * priceMajor * 10 ** currency.exponent) / 10 ** currency.exponent;
  return Money.fromMajor(amount.toFixed(currency.exponent), currency);
}
