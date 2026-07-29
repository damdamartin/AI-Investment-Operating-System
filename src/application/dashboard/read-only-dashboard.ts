import type { AIHealthCheckRecord, AIHealthStatus } from "../ai-health-check/index.js";
import type {
  ReconciliationReport,
  ReconciliationSeverity,
  ReconciliationStatus,
  ReconciliationTradingSafetyState,
  ReconciliationWorkflowResult
} from "../reconciliation/index.js";
import type { BrokerAccount } from "../../domain/broker/index.js";
import type { BrokerWriteCommandGuardResult } from "../broker-write-guard/index.js";
import type { KillSwitchTradingGate } from "../kill-switch/index.js";
import type { OrderApprovalEngineOutput } from "../order-approval/index.js";
import type { PaperOrderIntentPipelineResult, PaperOrderStatus } from "../paper-trading/index.js";
import type { RiskEngineOutput } from "../risk-engine/index.js";
import type { RiskCheckResult, RiskLevel } from "../../domain/risk/index.js";
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

    // `generatedAt` is a Date instance and must not pass through
    // `redactObject`: redaction walks `Object.entries`, which sees zero
    // enumerable own properties on a Date and would collapse it into `{}`.
    // Redact everything else, then attach the real Date afterward.
    const redacted = redactObject({
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
      risk: { ...input.risk }
    });

    return {
      ...redacted,
      generatedAt: input.generatedAt,
      safetyType: "DASHBOARD_READ_ONLY_STATUS"
    };
  }
}

/**
 * Phase 6 round 2 (P6-005): operator-facing read model over the Phase 6
 * round 1 paper/simulation safety chain (paper order intent pipeline,
 * reconciliation live-readiness, risk veto, kill-switch gate, order
 * approval, and broker-write guard). This is a status surface only — it
 * has no method that can place, cancel, or modify an order, and no
 * live-trading-enable toggle exists anywhere in this module.
 *
 * Every field here is derived read-only from already-computed round 1
 * outputs supplied by the caller (real engines or in-memory test
 * fixtures). This service performs no network calls and never reads
 * `.env` or `tmp/phase5` receipts.
 */
export interface DashboardPaperOrderIntentStatusView {
  decision: PaperOrderIntentPipelineResult["decision"];
  paperOrderStatus: PaperOrderStatus;
  reasonCodes: string[];
  blocksDependentTrading: boolean;
  /**
   * Dashboard-level aggregation: true when the kill-switch gate blocks new
   * orders, even though `PaperOrderIntentPipeline` itself does not consult
   * kill-switch state (it is deliberately self-contained per
   * docs/phase6/paper-order-intent-pipeline.md). The dashboard is the
   * layer responsible for showing the operator the combined picture.
   */
  killSwitchBlocksPaperExecution: boolean;
  nonBrokerPaperOnly: true;
  liveBrokerWriteAllowed: false;
  safetyType: "DASHBOARD_PAPER_ORDER_INTENT_STATUS_VIEW";
}

export interface DashboardReconciliationLiveReadinessView {
  severity: ReconciliationSeverity;
  tradingSafetyState: ReconciliationTradingSafetyState;
  blocksDependentTrading: boolean;
  liveReadinessBlocked: boolean;
  liveReadinessReasonCodes: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "DASHBOARD_RECONCILIATION_LIVE_READINESS_VIEW";
}

export interface DashboardRiskVetoStatusView {
  result: RiskCheckResult;
  riskLevel: RiskLevel;
  vetoActive: boolean;
  reasonCodes: string[];
  safetyType: "DASHBOARD_RISK_VETO_STATUS_VIEW";
}

export interface DashboardKillSwitchGateStatusView {
  allowed: boolean;
  blocksNewOrders: boolean;
  reasonCodes: string[];
  safetyType: "DASHBOARD_KILL_SWITCH_GATE_STATUS_VIEW";
}

export interface DashboardApprovalGuardStatusView {
  approvalStatus: "APPROVED" | "REJECTED";
  approvalReasonCodes: string[];
  brokerWriteGuardAllowed: boolean;
  brokerWriteGuardReasonCodes: string[];
  liveBrokerWriteAllowed: false;
  safetyType: "DASHBOARD_APPROVAL_GUARD_STATUS_VIEW";
}

export interface DashboardAuditCoverageStatusView {
  /** Whether this evaluation produced a sanitized audit context/lineage object at all. */
  auditContextPresent: boolean;
  /** Whether the caller confirms the corresponding audit record was actually persisted to the audit log sink. */
  auditTrailRecorded: boolean;
  safetyType: "DASHBOARD_AUDIT_COVERAGE_STATUS_VIEW";
}

export interface Phase6OperatorSafetyStatus {
  paperOrderIntent: DashboardPaperOrderIntentStatusView;
  reconciliationLiveReadiness: DashboardReconciliationLiveReadinessView;
  riskVeto: DashboardRiskVetoStatusView;
  killSwitchGate: DashboardKillSwitchGateStatusView;
  approvalGuard: DashboardApprovalGuardStatusView;
  auditCoverage: DashboardAuditCoverageStatusView;
  /**
   * True only when the paper/simulation execution path itself is healthy:
   * the paper order intent pipeline accepted the candidate, its resulting
   * paper order is not in an UNKNOWN broker state, the kill-switch gate is
   * not blocking new orders, and an audit trail exists and was recorded.
   * This is intentionally independent of `liveReadinessBlocked` — paper
   * trading can be ready even while live-readiness is blocked, because
   * Phase 6 never authorizes live trading regardless of either flag.
   */
  paperSimulationReady: boolean;
  /**
   * True whenever any part of the live-broker-write-readiness chain
   * (reconciliation, kill switch, risk veto, order approval, broker-write
   * guard) is not fully clear. This is a hard, non-overridable status
   * computed from the round 1 safety chain outputs — it never implies
   * live trading is allowed even when `false`; it only reports whether the
   * live-readiness chain currently has an open block.
   */
  liveReadinessBlocked: boolean;
  /**
   * Always literal `false`. Phase 6 never authorizes a live broker write,
   * and this field is not derived from any input above — it cannot be
   * flipped to `true` by any combination of inputs.
   */
  liveBrokerWriteAllowed: false;
  generatedAt: Date;
  safetyType: "DASHBOARD_PHASE6_OPERATOR_SAFETY_STATUS";
}

export interface Phase6OperatorSafetyStatusInput {
  paperOrderIntent: PaperOrderIntentPipelineResult;
  reconciliationWorkflow: ReconciliationWorkflowResult;
  riskEngineOutput: RiskEngineOutput;
  killSwitchGate: KillSwitchTradingGate;
  orderApproval: OrderApprovalEngineOutput;
  brokerWriteGuard: BrokerWriteCommandGuardResult;
  /** Caller-confirmed flag: did the audit record for this evaluation actually get persisted to the audit log sink? */
  auditTrailRecorded: boolean;
  generatedAt: Date;
}

export class Phase6OperatorSafetyDashboardService {
  buildSafetyStatus(input: Phase6OperatorSafetyStatusInput): Phase6OperatorSafetyStatus {
    const killSwitchGate = killSwitchGateView(input.killSwitchGate);
    const paperOrderIntent = paperOrderIntentView(input.paperOrderIntent, killSwitchGate);
    const reconciliationLiveReadiness = reconciliationLiveReadinessView(input.reconciliationWorkflow);
    const riskVeto = riskVetoView(input.riskEngineOutput);
    const approvalGuard = approvalGuardView(input.orderApproval, input.brokerWriteGuard);
    const auditCoverage = auditCoverageView(input.paperOrderIntent, input.auditTrailRecorded);

    const paperSimulationReady =
      paperOrderIntent.decision === "ACCEPTED" &&
      paperOrderIntent.paperOrderStatus !== "UNKNOWN" &&
      !paperOrderIntent.blocksDependentTrading &&
      !paperOrderIntent.killSwitchBlocksPaperExecution &&
      auditCoverage.auditContextPresent &&
      auditCoverage.auditTrailRecorded;

    // Deliberately does NOT factor in `approvalGuard.brokerWriteGuardAllowed`:
    // under Phase 6, BrokerWriteCommandGuard is always evaluated against
    // PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY, whose
    // `liveBrokerWritesEnabled` is permanently `false`, so that flag would
    // be `false` on every single evaluation regardless of any other input.
    // Folding it in here would make `liveReadinessBlocked` trivially always
    // `true` and erase the very distinction this field exists to show the
    // operator. That permanent phase-wide block is already reported,
    // unconditionally, via `liveBrokerWriteAllowed: false` below.
    // `liveReadinessBlocked` instead reports the state of the chain this
    // dashboard's caller does control: reconciliation, kill switch, risk,
    // and order approval.
    const liveReadinessBlocked =
      reconciliationLiveReadiness.liveReadinessBlocked ||
      !killSwitchGate.allowed ||
      riskVeto.vetoActive ||
      approvalGuard.approvalStatus !== "APPROVED";

    // See the comment in `ReadOnlyDashboardService.buildStatus` for why
    // `generatedAt` is attached after, not passed through, `redactObject`.
    const redacted = redactObject({
      paperOrderIntent,
      reconciliationLiveReadiness,
      riskVeto,
      killSwitchGate,
      approvalGuard,
      auditCoverage,
      paperSimulationReady,
      liveReadinessBlocked,
      liveBrokerWriteAllowed: false as const
    });

    return {
      ...redacted,
      generatedAt: input.generatedAt,
      safetyType: "DASHBOARD_PHASE6_OPERATOR_SAFETY_STATUS"
    };
  }
}

function killSwitchGateView(gate: KillSwitchTradingGate): DashboardKillSwitchGateStatusView {
  return {
    allowed: gate.allowed,
    blocksNewOrders: gate.blocksNewOrders,
    reasonCodes: [...gate.reasonCodes],
    safetyType: "DASHBOARD_KILL_SWITCH_GATE_STATUS_VIEW"
  };
}

function paperOrderIntentView(
  result: PaperOrderIntentPipelineResult,
  killSwitchGate: DashboardKillSwitchGateStatusView
): DashboardPaperOrderIntentStatusView {
  return {
    decision: result.decision,
    paperOrderStatus: result.paperTrading.order.status,
    reasonCodes: [...result.reasonCodes],
    blocksDependentTrading: result.paperTrading.blocksDependentTrading,
    killSwitchBlocksPaperExecution: !killSwitchGate.allowed,
    nonBrokerPaperOnly: true,
    liveBrokerWriteAllowed: false,
    safetyType: "DASHBOARD_PAPER_ORDER_INTENT_STATUS_VIEW"
  };
}

function reconciliationLiveReadinessView(
  workflow: ReconciliationWorkflowResult
): DashboardReconciliationLiveReadinessView {
  return {
    severity: workflow.severity,
    tradingSafetyState: workflow.tradingSafetyState,
    blocksDependentTrading: workflow.blocksDependentTrading,
    liveReadinessBlocked: workflow.liveReadinessBlocked,
    liveReadinessReasonCodes: [...workflow.liveReadinessReasonCodes],
    liveBrokerWriteAllowed: false,
    safetyType: "DASHBOARD_RECONCILIATION_LIVE_READINESS_VIEW"
  };
}

function riskVetoView(output: RiskEngineOutput): DashboardRiskVetoStatusView {
  return {
    result: output.riskCheck.result,
    riskLevel: output.riskCheck.riskLevel,
    vetoActive: output.riskCheck.result === "FAIL" || output.riskCheck.result === "BLOCKED",
    reasonCodes: [...output.reasonCodes],
    safetyType: "DASHBOARD_RISK_VETO_STATUS_VIEW"
  };
}

function approvalGuardView(
  approvalOutput: OrderApprovalEngineOutput,
  guardResult: BrokerWriteCommandGuardResult
): DashboardApprovalGuardStatusView {
  return {
    approvalStatus: approvalOutput.approval.status,
    approvalReasonCodes: [...approvalOutput.reasonCodes],
    brokerWriteGuardAllowed: guardResult.allowed,
    brokerWriteGuardReasonCodes: [...guardResult.reasonCodes],
    liveBrokerWriteAllowed: false,
    safetyType: "DASHBOARD_APPROVAL_GUARD_STATUS_VIEW"
  };
}

function auditCoverageView(
  paperOrderIntent: PaperOrderIntentPipelineResult,
  auditTrailRecorded: boolean
): DashboardAuditCoverageStatusView {
  return {
    auditContextPresent: paperOrderIntent.auditContext !== undefined,
    auditTrailRecorded,
    safetyType: "DASHBOARD_AUDIT_COVERAGE_STATUS_VIEW"
  };
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
