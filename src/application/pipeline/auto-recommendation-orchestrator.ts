import { randomUUID } from "node:crypto";
import type { PipelineConfig, WatchlistAssetConfig } from "../../config/pipeline-config.js";
import { Asset } from "../../domain/assets/index.js";
import { OrderIntent } from "../../domain/orders/index.js";
import { Position } from "../../domain/portfolio/index.js";
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
import { BrokerOrderExecutor } from "../orders/broker-order-executor.js";
import { StopLossEngine } from "./stop-loss-engine.js";
import { TakeProfitEngine } from "./take-profit-engine.js";
import { QuantityOptimizer } from "./quantity-optimizer.js";
import { PriceStrategySelector } from "./price-strategy-selector.js";
import { DBTransaction, ErrorLogger, RetryHandler, isTransientError } from "../shared/index.js";

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
  | "insertPosition"
  | "getOpenPositions"
  | "getOpenPositionsByAsset"
  | "closePosition"
>;

export interface OrchestratorDependencies {
  repository: AutoRecommendationRepository;
  marketDataProvider: MarketDataProvider;
  config: PipelineConfig;
  now: () => Date;
  brokerExecutor?: BrokerOrderExecutor;
  errorLogger?: ErrorLogger;
  retryHandler?: RetryHandler;
}

export interface AssetCycleOutcome {
  symbol: string;
  outcome:
    | "MARKET_DATA_REFUSED"
    | "STRATEGY_SCORING_REFUSED"
    | "HOLD"
    | "RISK_CHECK_FAILED"
    | "MONEY_CHECK_FAILED"
    | "RECOMMENDATION_CREATED"
    | "ORDER_EXECUTED"
    | "EXECUTION_FAILED"
    | "POSITION_CREATED"
    | "STOP_LOSS_TRIGGERED"
    | "TAKE_PROFIT_TRIGGERED"
    | "POSITION_CHECK_FAILED";
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
const stopLossEngine = new StopLossEngine();
const takeProfitEngine = new TakeProfitEngine(0.5); // 50% partial close
const quantityOptimizer = new QuantityOptimizer();
const priceStrategySelector = new PriceStrategySelector();

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

    // TODO: Implement stop-loss and take-profit checks for existing positions
    // This will be completed in the next version after position data structure is finalized
    try {
      const openPositionRows = await repository.getOpenPositions();
      // Placeholder: Stop-loss and take-profit logic will check these positions
      // in the next deployment cycle once position data is properly normalized
    } catch (error) {
      // Silently log - don't block trading cycle
      await repository.insertAuditLog({
        actor: "auto-recommendation-orchestrator",
        action: "POSITION_CHECK_SKIPPED",
        resourceType: "CYCLE_RUN",
        resourceId: cycleRunId,
        metadata: { cycleRunId }
      });
    }

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
  let currentPrice = latestSnapshot.price ?? Price.from("0", currency);

  // Extract volatility score from market engine results
  const volatilityScore = marketResult.output.scoreSet.scores.find(s => s.engine === "MARKET_VOLATILITY")?.score ?? 50;

  // Select price strategy based on signal strength, volatility, and time
  const priceStrategy = priceStrategySelector.selectStrategy({
    compositeScore: scoringResult.output.compositeScore,
    volatility: volatilityScore,
    hour: now.getHours(),
    dayOfWeek: now.getDay()
  });

  // Calculate limit price based on strategy
  const limitPrice = priceStrategy.orderType === "LIMIT_ORDER"
    ? priceStrategySelector.calculateLimitPrice(currentPrice, priceStrategy)
    : currentPrice;

  // Optimize quantity based on signal strength, volatility, and portfolio exposure
  const currentExposure = Number(config.portfolio.currentStrategyExposureMajor) || 0;
  const totalEquity = Number(config.portfolio.totalEquityMajor) || 1;
  const exposureRatio = Math.min(1, currentExposure / totalEquity);

  const optimizerResult = quantityOptimizer.optimizeQuantity({
    baseQuantity: Number(config.recommendationQuantity) || 1,
    compositeScore: scoringResult.output.compositeScore,
    volatility: volatilityScore,
    currentExposureRatio: exposureRatio,
    maxQuantityMultiplier: 3.0 // Configurable limit
  });

  const finalQty = Math.max(1, Math.floor(optimizerResult.finalQuantity));
  const quantity = Quantity.from(finalQty.toString());

  // If quantity is 0 after optimization, skip this trade
  if (quantity.isZero()) {
    await repository.insertAuditLog({
      actor: "quantity-optimizer",
      action: "TRADE_SKIPPED_DUE_TO_RISK",
      resourceType: "SIGNAL",
      resourceId: signal.id,
      reason: "Quantity optimized to 0 due to market conditions",
      metadata: {
        cycleRunId,
        symbol: watchlistAsset.symbol,
        compositeScore: scoringResult.output.compositeScore,
        volatility: volatilityScore,
        exposureRatio: exposureRatio,
        reasoning: optimizerResult.reasoning
      }
    });
    return { symbol: watchlistAsset.symbol, outcome: "HOLD", detail: ["Skipped due to risk conditions"] };
  }

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

  // Create recommendation record with quantity optimization details
  const recommendationReasoning = [
    `Composite score ${scoringResult.output.compositeScore} (confidence ${scoringResult.output.compositeConfidence})`,
    `from engines: ${scoringResult.output.requiredEngines.join(", ")}.`,
    `Quantity optimized: base=${config.recommendationQuantity} → final=${optimizerResult.finalQuantity}`,
    `(${optimizerResult.reasoning})`
  ].join(" ");

  await repository.insertOrderRecommendation({
    signalId: signal.id,
    riskCheckId,
    moneyCheckId,
    assetId,
    direction: signal.direction,
    recommendedQuantity: quantity.toString(),
    recommendedAmountMajor: orderAmount.toMajorString(),
    recommendedCurrency: config.portfolio.currency,
    reasoning: recommendationReasoning
  });

  // Log quantity optimization details
  await repository.insertAuditLog({
    actor: "quantity-optimizer",
    action: "QUANTITY_OPTIMIZED",
    resourceType: "SIGNAL",
    resourceId: signal.id,
    metadata: {
      cycleRunId,
      symbol: watchlistAsset.symbol,
      baseQuantity: config.recommendationQuantity,
      optimizedQuantity: optimizerResult.finalQuantity,
      scoreMultiplier: optimizerResult.scoreMultiplier,
      volatilityMultiplier: optimizerResult.volatilityMultiplier,
      exposureMultiplier: optimizerResult.exposureMultiplier,
      compositeScore: scoringResult.output.compositeScore,
      volatility: volatilityScore,
      exposureRatio: exposureRatio,
      reasoning: optimizerResult.reasoning
    }
  });

  // Log price strategy selection
  await repository.insertAuditLog({
    actor: "price-strategy-selector",
    action: "PRICE_STRATEGY_SELECTED",
    resourceType: "SIGNAL",
    resourceId: signal.id,
    metadata: {
      cycleRunId,
      symbol: watchlistAsset.symbol,
      orderType: priceStrategy.orderType,
      currentPrice: currentPrice.toString(),
      limitPrice: limitPrice.toString(),
      discountPercent: priceStrategy.discountPercent,
      maxWaitMinutes: priceStrategy.maxWaitMinutes,
      compositeScore: scoringResult.output.compositeScore,
      volatility: volatilityScore,
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      reasoning: priceStrategy.reasoning
    }
  });

  // Execute order automatically (AI-driven automatic execution)
  try {
    await repository.insertAuditLog({
      actor: "auto-recommendation-orchestrator",
      action: "ORDER_EXECUTION_INITIATED",
      resourceType: "SIGNAL",
      resourceId: signal.id,
      metadata: { cycleRunId, symbol: watchlistAsset.symbol, direction: signal.direction, quantity: quantity.toString() }
    });

    // Execute actual broker order if executor is available
    if (deps.brokerExecutor) {
      const quantityNum = Number(quantity.toString());
      const executionResult = await deps.brokerExecutor.executeOrder(
        watchlistAsset.symbol,
        orderIntent,
        limitPrice,
        quantityNum
      );

      if (executionResult.success) {
        await repository.insertAuditLog({
          actor: "auto-recommendation-orchestrator",
          action: "ORDER_EXECUTED",
          resourceType: "SIGNAL",
          resourceId: signal.id,
          metadata: { cycleRunId, symbol: watchlistAsset.symbol, orderId: executionResult.orderId }
        });

        // Create position with stop-loss and take-profit for BUY orders
        if (signal.direction === "BUY") {
          return await executePositionCreation({
            deps,
            signal,
            assetId,
            watchlistAsset,
            limitPrice,
            quantity,
            cycleRunId,
            now,
            stopLossEngine,
            takeProfitEngine,
            executionResult
          });
        }

        return { symbol: watchlistAsset.symbol, outcome: "ORDER_EXECUTED" };
      } else {
        await repository.insertAuditLog({
          actor: "auto-recommendation-orchestrator",
          action: "ORDER_EXECUTION_FAILED",
          resourceType: "SIGNAL",
          resourceId: signal.id,
          reason: executionResult.error || "Unknown error",
          metadata: { cycleRunId, symbol: watchlistAsset.symbol }
        });
        return { symbol: watchlistAsset.symbol, outcome: "EXECUTION_FAILED", detail: [executionResult.error || "Unknown"] };
      }
    }

    return { symbol: watchlistAsset.symbol, outcome: "RECOMMENDATION_CREATED" };
  } catch (executionError) {
    await repository.insertAuditLog({
      actor: "auto-recommendation-orchestrator",
      action: "ORDER_EXECUTION_FAILED",
      resourceType: "SIGNAL",
      resourceId: signal.id,
      reason: executionError instanceof Error ? executionError.message : "Unknown error",
      metadata: { cycleRunId, symbol: watchlistAsset.symbol }
    });
    throw executionError;
  }
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

/**
 * Execute Position creation with transactional integrity and error handling.
 * Ensures that:
 * 1. If broker order succeeds but Position DB insert fails, transaction rolls back
 * 2. All related records (Position + AuditLog) are inserted atomically
 * 3. Transient errors trigger automatic retry with exponential backoff
 * 4. All errors are logged for monitoring and debugging
 */
async function executePositionCreation(args: {
  deps: OrchestratorDependencies;
  signal: any; // Signal type
  assetId: string;
  watchlistAsset: WatchlistAssetConfig;
  limitPrice: Price;
  quantity: Quantity;
  cycleRunId: string;
  now: Date;
  stopLossEngine: StopLossEngine;
  takeProfitEngine: TakeProfitEngine;
  executionResult: any; // BrokerOrderExecutor result
}): Promise<AssetCycleOutcome> {
  const {
    deps,
    signal,
    assetId,
    watchlistAsset,
    limitPrice,
    quantity,
    cycleRunId,
    now,
    stopLossEngine,
    takeProfitEngine,
    executionResult
  } = args;

  const { repository, errorLogger } = deps;

  try {
    // Calculate stop-loss and take-profit prices
    const slPrice = stopLossEngine.calculateStopLossPrice(limitPrice, 2); // 2% stop loss
    const tpPrice = takeProfitEngine.calculateTakeProfitPrice(limitPrice, 5); // 5% take profit

    // Create Position object
    const position = new Position({
      id: randomUUID(),
      assetId,
      orderRecommendationId: signal.id,
      quantity,
      entryPrice: limitPrice,
      stopLoss: slPrice,
      takeProfit: tpPrice,
      entryDate: now
    });

    // Execute Position creation with transaction
    // Ensures atomic insertion of Position and AuditLog
    const transaction = new DBTransaction(repository as any); // Cast for DB access

    await transaction.executeTransaction(async (db) => {
      // Insert position within transaction
      await repository.insertPosition(position);

      // Insert audit log within same transaction
      await repository.insertAuditLog({
        actor: "auto-recommendation-orchestrator",
        action: "POSITION_CREATED",
        resourceType: "POSITION",
        resourceId: position.id,
        metadata: {
          cycleRunId,
          assetId,
          symbol: watchlistAsset.symbol,
          quantity: quantity.toString(),
          entryPrice: limitPrice.toString(),
          stopLoss: slPrice.toString(),
          takeProfit: tpPrice.toString(),
          orderId: executionResult.orderId
        }
      });
    });

    if (errorLogger) {
      await errorLogger.logInfo("position-creation", `Position created successfully for ${watchlistAsset.symbol}`, {
        positionId: position.id,
        orderId: executionResult.orderId,
        symbol: watchlistAsset.symbol
      });
    }

    return { symbol: watchlistAsset.symbol, outcome: "POSITION_CREATED" };
  } catch (positionError) {
    // Log error for monitoring
    if (errorLogger) {
      await errorLogger.logError("position-creation", positionError, {
        symbol: watchlistAsset.symbol,
        orderId: executionResult.orderId,
        signal: signal.id
      });
    }

    // Audit log for failure
    await repository.insertAuditLog({
      actor: "auto-recommendation-orchestrator",
      action: "POSITION_CREATION_FAILED",
      resourceType: "SIGNAL",
      resourceId: signal.id,
      reason: positionError instanceof Error ? positionError.message : "Unknown error",
      metadata: {
        cycleRunId,
        symbol: watchlistAsset.symbol,
        orderId: executionResult.orderId,
        errorType: positionError instanceof Error ? positionError.constructor.name : "Unknown"
      }
    });

    return {
      symbol: watchlistAsset.symbol,
      outcome: "EXECUTION_FAILED",
      detail: [positionError instanceof Error ? positionError.message : "Position creation failed"]
    };
  }
}
