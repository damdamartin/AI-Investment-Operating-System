import type { OrderIntent } from "../../domain/orders/index.js";
import { KillSwitchState, RiskCheck, type RiskLevel } from "../../domain/risk/index.js";
import type { Money } from "../../domain/value-objects/index.js";

export interface RiskEngineLimits {
  maxOrderAmount: Money;
  maxPositionExposureRatio: number;
  maxStrategyExposureRatio: number;
  maxMarketExposureRatio: number;
  maxDrawdownRatio: number;
}

export interface RiskEnginePortfolioState {
  totalEquity: Money;
  currentAssetExposure: Money;
  currentStrategyExposure: Money;
  currentMarketExposure: Money;
  currentDrawdownRatio: number;
}

export interface RiskEngineInput {
  riskCheckId: string;
  orderIntent: OrderIntent;
  orderAmount: Money;
  limits: RiskEngineLimits;
  portfolio: RiskEnginePortfolioState;
  killSwitches?: KillSwitchState[];
  checkedAt: Date;
}

export interface RiskEngineOutput {
  riskCheck: RiskCheck;
  reasonCodes: string[];
  safetyType: "RISK_ENGINE_CHECK_ONLY";
}

export class RiskEngine {
  evaluate(input: RiskEngineInput): RiskEngineOutput {
    const reasonCodes: string[] = [];
    const failedLimitIds: string[] = [];
    const activeKillSwitch = (input.killSwitches ?? []).find((killSwitch) => killSwitch.blocksOrders());

    if (activeKillSwitch) {
      reasonCodes.push("kill_switch_active");
      failedLimitIds.push(activeKillSwitch.id);
    }

    if (input.orderAmount.isGreaterThan(input.limits.maxOrderAmount)) {
      reasonCodes.push("max_order_amount_exceeded");
      failedLimitIds.push("max-order-amount");
    }

    if (exposureRatio(input.portfolio.currentAssetExposure.add(input.orderAmount), input.portfolio.totalEquity) > input.limits.maxPositionExposureRatio) {
      reasonCodes.push("max_position_exposure_exceeded");
      failedLimitIds.push("max-position-exposure");
    }

    if (
      exposureRatio(input.portfolio.currentStrategyExposure.add(input.orderAmount), input.portfolio.totalEquity) >
      input.limits.maxStrategyExposureRatio
    ) {
      reasonCodes.push("max_strategy_exposure_exceeded");
      failedLimitIds.push("max-strategy-exposure");
    }

    if (exposureRatio(input.portfolio.currentMarketExposure.add(input.orderAmount), input.portfolio.totalEquity) > input.limits.maxMarketExposureRatio) {
      reasonCodes.push("max_market_exposure_exceeded");
      failedLimitIds.push("max-market-exposure");
    }

    if (input.portfolio.currentDrawdownRatio > input.limits.maxDrawdownRatio) {
      reasonCodes.push("max_drawdown_exceeded");
      failedLimitIds.push("max-drawdown");
    }

    const blocked = activeKillSwitch !== undefined || input.portfolio.currentDrawdownRatio > input.limits.maxDrawdownRatio;
    const failed = reasonCodes.length > 0;
    const riskCheck = new RiskCheck({
      id: input.riskCheckId,
      subjectType: "ORDER_INTENT",
      subjectId: input.orderIntent.id,
      result: blocked ? "BLOCKED" : failed ? "FAIL" : "PASS",
      riskLevel: riskLevelFor(reasonCodes, blocked),
      failedLimitIds: failed ? [...new Set(failedLimitIds)] : [],
      warnings: [],
      checkedAt: input.checkedAt
    });

    return {
      riskCheck,
      reasonCodes,
      safetyType: "RISK_ENGINE_CHECK_ONLY"
    };
  }
}

function exposureRatio(exposure: Money, totalEquity: Money): number {
  if (totalEquity.minorUnits <= 0n) return Number.POSITIVE_INFINITY;
  return Number(exposure.minorUnits) / Number(totalEquity.minorUnits);
}

function riskLevelFor(reasonCodes: string[], blocked: boolean): RiskLevel {
  if (blocked) return "CRITICAL";
  if (reasonCodes.length >= 2) return "HIGH";
  if (reasonCodes.length === 1) return "MEDIUM";
  return "LOW";
}
