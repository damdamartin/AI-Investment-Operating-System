import type { AuditRecordProps } from "../audit/index.js";
import { OperationalAlertingService, type AlertEvent, type OperationalEvent } from "../alerting/index.js";
import type { ReconciliationIssue, ReconciliationReport } from "./reconciliation-service.js";

export type ReconciliationSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
export type ReconciliationTradingSafetyState = "CLEAR" | "WATCH" | "BLOCKED";

export interface ReconciliationWorkflowPolicy {
  staleAfterMs: number;
  severeIssueCount: number;
  criticalIssueTypes: ReconciliationIssue["type"][];
}

export interface ReconciliationWorkflowInput {
  workflowId: string;
  report: ReconciliationReport;
  evaluatedAt: Date;
  policy?: Partial<ReconciliationWorkflowPolicy> | undefined;
}

export interface ReconciliationWorkflowResult {
  workflowId: string;
  reportId: string;
  severity: ReconciliationSeverity;
  tradingSafetyState: ReconciliationTradingSafetyState;
  blocksDependentTrading: boolean;
  requiresHumanReview: boolean;
  stale: boolean;
  reasonCodes: string[];
  alertEvent: AlertEvent | undefined;
  operationalEvent: OperationalEvent | undefined;
  auditRecord: AuditRecordProps;
  correctiveTradingAllowed: false;
  safetyType: "RECONCILIATION_WORKFLOW_RESULT_ONLY";
}

export const defaultReconciliationWorkflowPolicy: ReconciliationWorkflowPolicy = {
  staleAfterMs: 5 * 60 * 1000,
  severeIssueCount: 3,
  criticalIssueTypes: [
    "BROKER_STATE_UNKNOWN",
    "POSITION_MISSING_INTERNAL",
    "POSITION_MISSING_BROKER",
    "CASH_MISSING_INTERNAL",
    "CASH_MISSING_BROKER"
  ]
};

export class ReconciliationWorkflowService {
  constructor(private readonly alerting = new OperationalAlertingService()) {}

  evaluate(input: ReconciliationWorkflowInput): ReconciliationWorkflowResult {
    const policy = { ...defaultReconciliationWorkflowPolicy, ...input.policy };
    const issueCount = input.report.positionIssues.length + input.report.cashIssues.length;
    const stale = input.evaluatedAt.getTime() - input.report.checkedAt.getTime() > policy.staleAfterMs;
    const severity = classifySeverity(input.report, issueCount, stale, policy);
    const blocksDependentTrading = severity === "HIGH" || severity === "CRITICAL" || severity === "UNKNOWN" || stale;
    const tradingSafetyState = blocksDependentTrading ? "BLOCKED" : severity === "LOW" || severity === "MEDIUM" ? "WATCH" : "CLEAR";
    const requiresHumanReview = blocksDependentTrading || severity === "MEDIUM";
    const reasonCodes = reasonCodesFor(input.report, severity, stale, issueCount, policy);
    const operationalEvent = createOperationalEvent(input, severity, stale, reasonCodes);
    const alertEvent = operationalEvent ? this.alerting.classify(operationalEvent) : undefined;

    return {
      workflowId: input.workflowId,
      reportId: input.report.id,
      severity,
      tradingSafetyState,
      blocksDependentTrading,
      requiresHumanReview,
      stale,
      reasonCodes,
      alertEvent,
      operationalEvent,
      auditRecord: createAuditRecord(input, severity, tradingSafetyState, reasonCodes),
      correctiveTradingAllowed: false,
      safetyType: "RECONCILIATION_WORKFLOW_RESULT_ONLY"
    };
  }
}

function classifySeverity(
  report: ReconciliationReport,
  issueCount: number,
  stale: boolean,
  policy: ReconciliationWorkflowPolicy
): ReconciliationSeverity {
  if (report.status === "UNKNOWN" || report.unknownReasons.length > 0) return "UNKNOWN";
  if (stale) return "HIGH";
  if (issueCount === 0) return "NONE";

  const allIssues = [...report.positionIssues, ...report.cashIssues];
  if (allIssues.some((issue) => policy.criticalIssueTypes.includes(issue.type))) return "CRITICAL";
  if (issueCount >= policy.severeIssueCount) return "HIGH";
  if (report.positionIssues.length > 0 && report.cashIssues.length > 0) return "HIGH";
  if (report.cashIssues.length > 0) return "MEDIUM";
  return "LOW";
}

function reasonCodesFor(
  report: ReconciliationReport,
  severity: ReconciliationSeverity,
  stale: boolean,
  issueCount: number,
  policy: ReconciliationWorkflowPolicy
): string[] {
  const reasons = new Set<string>();

  if (report.status === "CLEAN") reasons.add("reconciliation_clean");
  if (report.status === "UNKNOWN") reasons.add("reconciliation_unknown");
  if (stale) reasons.add("reconciliation_report_stale");
  if (issueCount >= policy.severeIssueCount) reasons.add("reconciliation_issue_count_exceeds_threshold");
  if (severity === "CRITICAL") reasons.add("critical_reconciliation_issue_detected");

  for (const reason of report.unknownReasons) reasons.add(reason);
  for (const issue of [...report.positionIssues, ...report.cashIssues]) reasons.add(issue.reason);

  return [...reasons];
}

function createOperationalEvent(
  input: ReconciliationWorkflowInput,
  severity: ReconciliationSeverity,
  stale: boolean,
  reasonCodes: string[]
): OperationalEvent | undefined {
  if (severity === "NONE" || severity === "LOW") return undefined;

  return {
    id: `reconciliation-workflow-${input.workflowId}`,
    type: stale ? "STALE_MARKET_DATA" : "RECONCILIATION_MISMATCH",
    occurredAt: input.evaluatedAt,
    source: "RECONCILIATION_WORKFLOW",
    payload: {
      workflowId: input.workflowId,
      reportId: input.report.id,
      reportStatus: input.report.status,
      severity,
      reasonCodes,
      positionIssueCount: input.report.positionIssues.length,
      cashIssueCount: input.report.cashIssues.length,
      unknownReasons: input.report.unknownReasons
    }
  };
}

function createAuditRecord(
  input: ReconciliationWorkflowInput,
  severity: ReconciliationSeverity,
  tradingSafetyState: ReconciliationTradingSafetyState,
  reasonCodes: string[]
): AuditRecordProps {
  return {
    id: `audit-${input.workflowId}`,
    actor: "reconciliation-workflow",
    action: "evaluate-reconciliation-report",
    resourceType: "reconciliation-report",
    resourceId: input.report.id,
    reason: reasonCodes.join(","),
    metadata: {
      workflowId: input.workflowId,
      severity,
      tradingSafetyState,
      blocksDependentTrading: tradingSafetyState === "BLOCKED",
      positionIssueCount: input.report.positionIssues.length,
      cashIssueCount: input.report.cashIssues.length,
      unknownReasonCount: input.report.unknownReasons.length,
      correctiveTradingAllowed: false
    },
    createdAt: input.evaluatedAt
  };
}
