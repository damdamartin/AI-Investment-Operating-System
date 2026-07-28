import type { AIHealthCheckRecord, AIHealthStatus } from "../ai-health-check/index.js";
import type { ReconciliationReport, ReconciliationStatus } from "../reconciliation/index.js";
import type { BrokerAccount } from "../../domain/broker/index.js";
import { redactObject } from "../../config/index.js";

export type DashboardSystemStatus = "OK" | "WARNING" | "ERROR" | "BLOCKED";
export type DashboardTradingStatus = "ENABLED" | "PAUSED" | "BLOCKED";
export type DashboardBrokerStatus = "OK" | "DEGRADED" | "DOWN";
export type DashboardDataFreshnessStatus = "FRESH" | "STALE";

export interface DashboardBrokerAccountView {
  id: string;
  broker: string;
  maskedExternalRef: string;
  accountLabel: string;
  permissionStatus: string;
  readOnlyEnabled: boolean;
  liveTradingEnabled: boolean;
  status: string;
}

export interface DashboardPortfolioStatusView {
  portfolioId: string;
  brokerAccounts: DashboardBrokerAccountView[];
  cashSummary: Array<{
    currency: "KRW" | "USD";
    available: number;
    reserved: number;
    unsettled: number;
  }>;
}

export interface DashboardStrategyStatusView {
  activeStrategyCount: number;
  candidateStrategyCount: number;
  blockedStrategyCount: number;
}

export interface DashboardRiskStatusView {
  dailyLossLimitBreached: boolean;
  monthlyLossLimitBreached: boolean;
  maxDrawdownBreached: boolean;
  openRiskIssueCount: number;
}

export interface DashboardReadOnlyStatus {
  system: DashboardSystemStatus;
  trading: DashboardTradingStatus;
  broker: DashboardBrokerStatus;
  dataFreshness: DashboardDataFreshnessStatus;
  reconciliation: ReconciliationStatus;
  aiHealth: AIHealthStatus;
  openAlertCount: number;
  portfolio: DashboardPortfolioStatusView;
  strategies: DashboardStrategyStatusView;
  risk: DashboardRiskStatusView;
  generatedAt: Date;
  safetyType: "DASHBOARD_READ_ONLY_STATUS";
}

export interface DashboardReadOnlyInput {
  portfolioId: string;
  brokerAccounts: BrokerAccount[];
  cashSummary: DashboardPortfolioStatusView["cashSummary"];
  aiHealthCheck: AIHealthCheckRecord;
  reconciliationReport: ReconciliationReport;
  strategies: DashboardStrategyStatusView;
  risk: DashboardRiskStatusView;
  openAlertCount: number;
  staleData: boolean;
  brokerUnavailable: boolean;
  generatedAt: Date;
}

export class ReadOnlyDashboardService {
  buildStatus(input: DashboardReadOnlyInput): DashboardReadOnlyStatus {
    const broker = brokerStatus(input);
    const dataFreshness: DashboardDataFreshnessStatus = input.staleData ? "STALE" : "FRESH";
    const trading = tradingStatus(input);
    const system = systemStatus(input, broker, dataFreshness, trading);

    return redactObject({
      system,
      trading,
      broker,
      dataFreshness,
      reconciliation: input.reconciliationReport.status,
      aiHealth: input.aiHealthCheck.status,
      openAlertCount: input.openAlertCount,
      portfolio: {
        portfolioId: input.portfolioId,
        brokerAccounts: input.brokerAccounts.map((account) => ({
          id: account.id,
          broker: account.broker,
          maskedExternalRef: account.maskedExternalRef(),
          accountLabel: account.accountLabel,
          permissionStatus: account.permissionStatus,
          readOnlyEnabled: account.readOnlyEnabled,
          liveTradingEnabled: account.liveTradingEnabled,
          status: account.status
        })),
        cashSummary: input.cashSummary.map((cash) => ({ ...cash }))
      },
      strategies: { ...input.strategies },
      risk: { ...input.risk },
      generatedAt: input.generatedAt,
      safetyType: "DASHBOARD_READ_ONLY_STATUS"
    });
  }
}

function brokerStatus(input: DashboardReadOnlyInput): DashboardBrokerStatus {
  if (input.brokerUnavailable) return "DOWN";
  if (input.reconciliationReport.status === "UNKNOWN") return "DEGRADED";
  if (input.brokerAccounts.some((account) => !account.canRead())) return "DEGRADED";
  return "OK";
}

function tradingStatus(input: DashboardReadOnlyInput): DashboardTradingStatus {
  if (
    input.reconciliationReport.blocksDependentTrading ||
    input.aiHealthCheck.status === "BLOCKED" ||
    input.risk.dailyLossLimitBreached ||
    input.risk.monthlyLossLimitBreached ||
    input.risk.maxDrawdownBreached
  ) {
    return "BLOCKED";
  }

  if (input.aiHealthCheck.status === "RED" || input.staleData || input.risk.openRiskIssueCount > 0) {
    return "PAUSED";
  }

  return "ENABLED";
}

function systemStatus(
  input: DashboardReadOnlyInput,
  broker: DashboardBrokerStatus,
  dataFreshness: DashboardDataFreshnessStatus,
  trading: DashboardTradingStatus
): DashboardSystemStatus {
  if (trading === "BLOCKED" || input.aiHealthCheck.status === "BLOCKED") return "BLOCKED";
  if (broker === "DOWN" || input.aiHealthCheck.status === "RED") return "ERROR";
  if (
    trading === "PAUSED" ||
    broker === "DEGRADED" ||
    dataFreshness === "STALE" ||
    input.reconciliationReport.status === "MISMATCH" ||
    input.aiHealthCheck.status === "YELLOW" ||
    input.openAlertCount > 0
  ) {
    return "WARNING";
  }

  return "OK";
}
