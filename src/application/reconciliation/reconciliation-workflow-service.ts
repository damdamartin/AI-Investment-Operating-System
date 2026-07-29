import type { AuditRecordProps } from "../audit/index.js";
import { OperationalAlertingService, type AlertEvent, type OperationalEvent } from "../alerting/index.js";
import type { ReconciliationIssue, ReconciliationIssueCounts, ReconciliationReport } from "./reconciliation-service.js";

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
  issueCounts: ReconciliationIssueCounts;
  reasonCodes: string[];
  alertEvent: AlertEvent | undefined;
  operationalEvent: OperationalEvent | undefined;
  auditRecord: AuditRecordProps;
  /**
   * Hard gate for any future live-capable phase. `true` unless this
   * reconciliation is fully resolved: no blocking issues, no
   * human-review-required issues, no unknown broker state, and not stale.
   * Purely-informational issues (within-tolerance variance) do not clear
   * this gate by accident — only a genuinely clean, fresh report does.
   * This is a hard block, not a warning: it is never overridable by input,
   * policy, or caller-supplied flags.
   */
  liveReadinessBlocked: boolean;
  liveReadinessReasonCodes: string[];
  /**
   * Always `false`. Phase 6 never authorizes a live broker write, and this
   * field is not derived from reconciliation state — it stays `false` even
   * when reconciliation is fully clean.
   */
  liveBrokerWriteAllowed: false;
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
    const stale = input.evaluatedAt.getTime() - input.report.checkedAt.getTime() > policy.staleAfterMs;
    const significant = significantIssues(input.report);
    const issueCounts = summarizeIssueCounts(input.report);
    const severity = classifySeverity(input.report, significant, stale, policy);
    const blocksDependentTrading = severity === "HIGH" || severity === "CRITICAL" || severity === "UNKNOWN" || stale;
    const tradingSafetyState = blocksDependentTrading ? "BLOCKED" : severity === "LOW" || severity === "MEDIUM" ? "WATCH" : "CLEAR";
    const requiresHumanReview = blocksDependentTrading || severity === "MEDIUM";
    const reasonCodes = reasonCodesFor(input.report, severity, stale, significant.length, policy);
    const liveReadinessBlocked = severity !== "NONE";
    const liveReadinessReasonCodes = liveReadinessBlocked
      ? [...new Set(["reconciliation_not_fully_resolved", ...reasonCodes])].sort()
      : [];
    const operationalEvent = createOperationalEvent(input, severity, stale, reasonCodes, issueCounts);
    const alertEvent = operationalEvent ? this.alerting.classify(operationalEvent) : undefined;

    return {
      workflowId: input.workflowId,
      reportId: input.report.id,
      severity,
      tradingSafetyState,
      blocksDependentTrading,
      requiresHumanReview,
      stale,
      issueCounts,
      reasonCodes,
      alertEvent,
      operationalEvent,
      auditRecord: createAuditRecord(input, severity, tradingSafetyState, reasonCodes, liveReadinessBlocked, issueCounts),
      liveReadinessBlocked,
      liveReadinessReasonCodes,
      liveBrokerWriteAllowed: false,
      correctiveTradingAllowed: false,
      safetyType: "RECONCILIATION_WORKFLOW_RESULT_ONLY"
    };
  }
}

/** Issues that are not purely informational — i.e. issues that represent an unresolved discrepancy. */
function significantIssues(report: ReconciliationReport): ReconciliationIssue[] {
  return [...report.positionIssues, ...report.cashIssues].filter(
    (issue) => issue.classification !== "INFORMATIONAL"
  );
}

/**
 * Computes issue counts by classification directly from the report's issue
 * arrays rather than trusting `report.issueCounts` (which is optional and
 * may be absent on a report literal built outside this module).
 */
function summarizeIssueCounts(report: ReconciliationReport): ReconciliationIssueCounts {
  const all = [...report.positionIssues, ...report.cashIssues];
  return {
    informational: all.filter((issue) => issue.classification === "INFORMATIONAL").length,
    blocking: all.filter((issue) => issue.classification === "BLOCKING").length,
    requiresHumanReview: all.filter((issue) => issue.classification === "REQUIRES_HUMAN_REVIEW").length
  };
}

function classifySeverity(
  report: ReconciliationReport,
  significant: ReconciliationIssue[],
  stale: boolean,
  policy: ReconciliationWorkflowPolicy
): ReconciliationSeverity {
  if (report.status === "UNKNOWN" || report.unknownReasons.length > 0) return "UNKNOWN";
  if (stale) return "HIGH";
  if (significant.length === 0) return "NONE";

  const significantPositionIssues = significant.filter((issue) => report.positionIssues.includes(issue));
  const significantCashIssues = significant.filter((issue) => report.cashIssues.includes(issue));

  if (significant.some((issue) => policy.criticalIssueTypes.includes(issue.type))) return "CRITICAL";
  if (significant.length >= policy.severeIssueCount) return "HIGH";
  if (significantPositionIssues.length > 0 && significantCashIssues.length > 0) return "HIGH";
  if (significantCashIssues.length > 0) return "MEDIUM";
  return "LOW";
}

function reasonCodesFor(
  report: ReconciliationReport,
  severity: ReconciliationSeverity,
  stale: boolean,
  significantIssueCount: number,
  policy: ReconciliationWorkflowPolicy
): string[] {
  const reasons = new Set<string>();

  if (report.status === "CLEAN") reasons.add("reconciliation_clean");
  if (report.status === "UNKNOWN") reasons.add("reconciliation_unknown");
  if (stale) reasons.add("reconciliation_report_stale");
  if (significantIssueCount >= policy.severeIssueCount) reasons.add("reconciliation_issue_count_exceeds_threshold");
  if (severity === "CRITICAL") reasons.add("critical_reconciliation_issue_detected");

  for (const reason of report.unknownReasons) reasons.add(reason);
  for (const issue of [...report.positionIssues, ...report.cashIssues]) reasons.add(issue.reason);

  return [...reasons];
}

function createOperationalEvent(
  input: ReconciliationWorkflowInput,
  severity: ReconciliationSeverity,
  stale: boolean,
  reasonCodes: string[],
  issueCounts: ReconciliationIssueCounts
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
      issueCounts,
      unknownReasons: input.report.unknownReasons
    }
  };
}

function createAuditRecord(
  input: ReconciliationWorkflowInput,
  severity: ReconciliationSeverity,
  tradingSafetyState: ReconciliationTradingSafetyState,
  reasonCodes: string[],
  liveReadinessBlocked: boolean,
  issueCounts: ReconciliationIssueCounts
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
      issueCounts,
      unknownReasonCount: input.report.unknownReasons.length,
      liveReadinessBlocked,
      liveBrokerWriteAllowed: false,
      correctiveTradingAllowed: false
    },
    createdAt: input.evaluatedAt
  };
}
