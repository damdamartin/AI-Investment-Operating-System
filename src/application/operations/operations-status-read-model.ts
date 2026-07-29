import type { AIHealthStatus } from "../ai-health-check/index.js";
import type { AlertCategory, AlertEvent, AlertSeverity } from "../alerting/index.js";
import type { DashboardReadOnlyStatus, DashboardSystemStatus, Phase6OperatorSafetyStatus } from "../dashboard/index.js";
import type { SmallCapitalReadinessReport } from "../live-readiness/index.js";
import {
  reviewPhase6SchedulerJobCatalogSafety,
  type ScheduledJobDefinition,
  type ScheduledJobRun,
  type ScheduledJobRunStatus
} from "../scheduler/index.js";
import { redactObject } from "../../config/index.js";

/**
 * Phase 8 (P8-001): operations status read model.
 *
 * This module is a PURE read model. It aggregates already-computed Phase
 * 6/7 outputs (`DashboardReadOnlyStatus`, `Phase6OperatorSafetyStatus`,
 * `SmallCapitalReadinessReport`, `AlertEvent[]`, scheduler job definitions
 * and runs) into a single sanitized, advisory-only status summary suitable
 * for dashboard/API consumption.
 *
 * It has no network code, no filesystem access, no `.env` or `tmp/phase5`
 * reads, and no command surface of any kind:
 *
 * - It exposes exactly one public method (`buildStatus`) that reads inputs
 *   and returns a report. There is no method on this class, and no
 *   exported function from this file, that can place, cancel, modify, or
 *   approve an order; activate or deactivate the kill switch; enable live
 *   trading; or mutate any of its inputs.
 * - Every input is consumed read-only. Arrays are copied, not mutated, and
 *   nothing this module returns can be fed back into a broker-write path.
 * - `liveBrokerWriteAllowed` is a literal `false` everywhere it appears in
 *   this file's output types. It is never computed from any input, and no
 *   combination of inputs can flip it to `true`.
 * - Every constructed output is passed through `redactObject` before being
 *   returned, matching the pattern already used by `ReadOnlyDashboardService`,
 *   `Phase6OperatorSafetyDashboardService`, `OperationalAlertingService`, and
 *   `ObservabilityMetricsService`.
 */

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type OperationsSystemHealthStatus = "OK" | "WARNING" | "ERROR" | "BLOCKED";
export type OperationsApiHealthStatus = "OK" | "DEGRADED" | "DOWN";

export interface OperationsKillSwitchStatusView {
  allowed: boolean;
  blocksNewOrders: boolean;
  reasonCodes: string[];
  safetyType: "OPERATIONS_KILL_SWITCH_STATUS_VIEW";
}

export interface OperationsReconciliationStatusView {
  status: DashboardReadOnlyStatus["reconciliation"];
  severity: Phase6OperatorSafetyStatus["reconciliationLiveReadiness"]["severity"];
  tradingSafetyState: Phase6OperatorSafetyStatus["reconciliationLiveReadiness"]["tradingSafetyState"];
  blocksDependentTrading: boolean;
  liveReadinessBlocked: boolean;
  reasonCodes: string[];
  safetyType: "OPERATIONS_RECONCILIATION_STATUS_VIEW";
}

export interface OperationsAiApiHealthView {
  ai: AIHealthStatus;
  api: OperationsApiHealthStatus;
  safetyType: "OPERATIONS_AI_API_HEALTH_VIEW";
}

export interface OperationsSchedulerJobHealthView {
  jobId: string;
  kind: string;
  enabled: boolean;
  noWrite: boolean;
  callsBrokerApi: boolean;
  lastRunStatus: ScheduledJobRunStatus | "NEVER_RUN";
  lastRunReasonCodes: string[];
  consecutiveFailureCount: number;
  safetyType: "OPERATIONS_SCHEDULER_JOB_HEALTH_VIEW";
}

export interface OperationsSchedulerHealthSummary {
  jobs: OperationsSchedulerJobHealthView[];
  totalJobCount: number;
  failingJobCount: number;
  /**
   * Count of job definitions that fail the same no-write / no-broker-call
   * policy check `reviewPhase6SchedulerJobCatalogSafety` enforces. Should
   * always be `0` in a correctly configured catalog; a non-zero value here
   * is itself a reportable operational finding, not a silently-ignored
   * condition (see `docs/11_AI_RULES.md` Rule 29).
   */
  unsafeJobDefinitionCount: number;
  unsafeJobDefinitionReasonCodes: string[];
  safetyType: "OPERATIONS_SCHEDULER_HEALTH_SUMMARY";
}

export interface OperationsAlertSummary {
  openAlertCount: number;
  bySeverity: Record<AlertSeverity, number>;
  hasOpenCriticalAlert: boolean;
  safetyType: "OPERATIONS_ALERT_SUMMARY";
}

export interface OperationsSmallCapitalReadinessSummary {
  readyForSmallCapitalLive: boolean;
  blockingReasonCodeCount: number;
  blockingReasonCodes: string[];
  warningCount: number;
  /**
   * Always literal `false`. `readyForSmallCapitalLive: true` from the
   * underlying evaluator is design-time readiness evidence only, never
   * live-trading authorization -- restated here so a caller reading only
   * this summary cannot lose that distinction.
   */
  liveBrokerWriteAllowed: false;
  safetyType: "OPERATIONS_SMALL_CAPITAL_READINESS_SUMMARY";
}

export interface OperationsStatusSummary {
  systemHealth: OperationsSystemHealthStatus;
  paperSimulationReady: boolean;
  liveReadinessBlocked: boolean;
  killSwitch: OperationsKillSwitchStatusView;
  reconciliation: OperationsReconciliationStatusView;
  aiApiHealth: OperationsAiApiHealthView;
  scheduler: OperationsSchedulerHealthSummary;
  alerts: OperationsAlertSummary;
  smallCapitalReadiness: OperationsSmallCapitalReadinessSummary;
  /**
   * Always literal `false`. This read model has no path -- structural or
   * computed -- to ever report `true`. It exists so a caller cannot mistake
   * an otherwise-clean operations status summary (for example
   * `systemHealth: "OK"` and `smallCapitalReadiness.readyForSmallCapitalLive:
   * true`) for live-trading authorization.
   */
  liveBrokerWriteAllowed: false;
  generatedAt: Date;
  safetyType: "OPERATIONS_STATUS_SUMMARY_READ_MODEL";
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface OperationsStatusReadModelInput {
  /** Already-computed Phase 5/6 read-only dashboard status. */
  dashboardStatus: DashboardReadOnlyStatus;
  /** Already-computed Phase 6 round 2 operator safety status (paper/live-readiness chain). */
  phase6SafetyStatus: Phase6OperatorSafetyStatus;
  /** Already-computed Phase 7 small-capital readiness report. */
  smallCapitalReadiness: SmallCapitalReadinessReport;
  /** Currently open alerts, as produced by `OperationalAlertingService`. */
  openAlerts: AlertEvent[];
  /** The scheduler job catalog, as produced by the scheduler module. */
  schedulerDefinitions: ScheduledJobDefinition[];
  /** All known scheduler job runs, as produced by `SchedulerJobRunner`. */
  schedulerRuns: ScheduledJobRun[];
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export class OperationsStatusReadModel {
  /**
   * Builds a single sanitized, advisory-only operations status summary from
   * already-computed Phase 6/7 outputs. This is the only public method on
   * this class. It has no side effects, performs no network or filesystem
   * access, and cannot mutate any of its inputs.
   */
  buildStatus(input: OperationsStatusReadModelInput): OperationsStatusSummary {
    const killSwitch = killSwitchView(input.phase6SafetyStatus);
    const reconciliation = reconciliationView(input.dashboardStatus, input.phase6SafetyStatus);
    const aiApiHealth = aiApiHealthView(input.dashboardStatus, input.openAlerts);
    const scheduler = schedulerHealthSummary(input.schedulerDefinitions, input.schedulerRuns);
    const alerts = alertSummary(input.openAlerts);
    const smallCapitalReadiness = smallCapitalReadinessSummary(input.smallCapitalReadiness);

    const systemHealth = overallSystemHealth({
      dashboardSystem: input.dashboardStatus.system,
      killSwitch,
      reconciliation,
      aiApiHealth,
      scheduler
    });

    // `generatedAt` is a Date instance and must not pass through
    // `redactObject`: redaction walks `Object.entries`, which sees zero
    // enumerable own properties on a Date and would collapse it into `{}`.
    // Redact everything else, then attach the real Date afterward, matching
    // the pattern used by `ReadOnlyDashboardService.buildStatus` and
    // `Phase6OperatorSafetyDashboardService.buildSafetyStatus`.
    const redacted = redactObject({
      systemHealth,
      paperSimulationReady: input.phase6SafetyStatus.paperSimulationReady,
      liveReadinessBlocked: input.phase6SafetyStatus.liveReadinessBlocked,
      killSwitch,
      reconciliation,
      aiApiHealth,
      scheduler,
      alerts,
      smallCapitalReadiness,
      liveBrokerWriteAllowed: false as const
    });

    return {
      ...redacted,
      generatedAt: input.generatedAt,
      safetyType: "OPERATIONS_STATUS_SUMMARY_READ_MODEL"
    };
  }
}

// ---------------------------------------------------------------------------
// View builders
// ---------------------------------------------------------------------------

function killSwitchView(status: Phase6OperatorSafetyStatus): OperationsKillSwitchStatusView {
  return {
    allowed: status.killSwitchGate.allowed,
    blocksNewOrders: status.killSwitchGate.blocksNewOrders,
    reasonCodes: [...status.killSwitchGate.reasonCodes],
    safetyType: "OPERATIONS_KILL_SWITCH_STATUS_VIEW"
  };
}

function reconciliationView(
  dashboardStatus: DashboardReadOnlyStatus,
  phase6SafetyStatus: Phase6OperatorSafetyStatus
): OperationsReconciliationStatusView {
  const liveReadiness = phase6SafetyStatus.reconciliationLiveReadiness;
  return {
    status: dashboardStatus.reconciliation,
    severity: liveReadiness.severity,
    tradingSafetyState: liveReadiness.tradingSafetyState,
    blocksDependentTrading: liveReadiness.blocksDependentTrading,
    liveReadinessBlocked: liveReadiness.liveReadinessBlocked,
    reasonCodes: [...liveReadiness.liveReadinessReasonCodes],
    safetyType: "OPERATIONS_RECONCILIATION_STATUS_VIEW"
  };
}

const apiRelevantAlertCategories: ReadonlySet<AlertCategory> = new Set<AlertCategory>([
  "API_FAILURE",
  "API_USAGE_WARNING",
  "BROKER_UNAVAILABLE"
]);

function aiApiHealthView(dashboardStatus: DashboardReadOnlyStatus, openAlerts: AlertEvent[]): OperationsAiApiHealthView {
  const relevant = openAlerts.filter((alert) => apiRelevantAlertCategories.has(alert.category));
  const api: OperationsApiHealthStatus = relevant.some((alert) => alert.severity === "CRITICAL")
    ? "DOWN"
    : relevant.length > 0
      ? "DEGRADED"
      : "OK";

  return {
    ai: dashboardStatus.aiHealth,
    api,
    safetyType: "OPERATIONS_AI_API_HEALTH_VIEW"
  };
}

function schedulerHealthSummary(
  definitions: ScheduledJobDefinition[],
  runs: ScheduledJobRun[]
): OperationsSchedulerHealthSummary {
  const safety = reviewPhase6SchedulerJobCatalogSafety(definitions);
  const jobs = definitions.map((definition) => schedulerJobHealthView(definition, runs));

  return {
    jobs,
    totalJobCount: jobs.length,
    failingJobCount: jobs.filter((job) => job.lastRunStatus === "FAILED").length,
    unsafeJobDefinitionCount: safety.ok ? 0 : safety.reasonCodes.length,
    unsafeJobDefinitionReasonCodes: [...safety.reasonCodes],
    safetyType: "OPERATIONS_SCHEDULER_HEALTH_SUMMARY"
  };
}

function schedulerJobHealthView(
  definition: ScheduledJobDefinition,
  runs: ScheduledJobRun[]
): OperationsSchedulerJobHealthView {
  const jobRuns = runs
    .filter((run) => run.jobId === definition.id)
    .slice()
    .sort((a, b) => runOrderKey(a) - runOrderKey(b) || a.attempt - b.attempt);

  const lastRun = jobRuns[jobRuns.length - 1];

  return {
    jobId: definition.id,
    kind: definition.kind,
    enabled: definition.enabled,
    noWrite: definition.noWrite,
    callsBrokerApi: definition.callsBrokerApi,
    lastRunStatus: lastRun ? lastRun.status : "NEVER_RUN",
    lastRunReasonCodes: lastRun ? [...lastRun.reasonCodes] : [],
    consecutiveFailureCount: countTrailingFailures(jobRuns),
    safetyType: "OPERATIONS_SCHEDULER_JOB_HEALTH_VIEW"
  };
}

function runOrderKey(run: ScheduledJobRun): number {
  const timestamp = run.startedAt ?? run.finishedAt ?? run.lockedAt;
  return timestamp ? timestamp.getTime() : 0;
}

function countTrailingFailures(jobRunsAscending: ScheduledJobRun[]): number {
  let count = 0;
  for (let index = jobRunsAscending.length - 1; index >= 0; index -= 1) {
    if (jobRunsAscending[index]?.status !== "FAILED") break;
    count += 1;
  }
  return count;
}

function alertSummary(openAlerts: AlertEvent[]): OperationsAlertSummary {
  const bySeverity: Record<AlertSeverity, number> = { INFO: 0, WARNING: 0, ERROR: 0, CRITICAL: 0 };
  for (const alertEvent of openAlerts) {
    bySeverity[alertEvent.severity] += 1;
  }

  return {
    openAlertCount: openAlerts.length,
    bySeverity,
    hasOpenCriticalAlert: bySeverity.CRITICAL > 0,
    safetyType: "OPERATIONS_ALERT_SUMMARY"
  };
}

function smallCapitalReadinessSummary(report: SmallCapitalReadinessReport): OperationsSmallCapitalReadinessSummary {
  return {
    readyForSmallCapitalLive: report.readyForSmallCapitalLive,
    blockingReasonCodeCount: report.blockingReasonCodes.length,
    blockingReasonCodes: [...report.blockingReasonCodes],
    warningCount: report.warnings.length,
    liveBrokerWriteAllowed: false,
    safetyType: "OPERATIONS_SMALL_CAPITAL_READINESS_SUMMARY"
  };
}

const healthRank: Record<OperationsSystemHealthStatus, number> = { OK: 0, WARNING: 1, ERROR: 2, BLOCKED: 3 };

function worseHealth(
  a: OperationsSystemHealthStatus,
  b: OperationsSystemHealthStatus
): OperationsSystemHealthStatus {
  return healthRank[b] > healthRank[a] ? b : a;
}

function overallSystemHealth(input: {
  dashboardSystem: DashboardSystemStatus;
  killSwitch: OperationsKillSwitchStatusView;
  reconciliation: OperationsReconciliationStatusView;
  aiApiHealth: OperationsAiApiHealthView;
  scheduler: OperationsSchedulerHealthSummary;
}): OperationsSystemHealthStatus {
  let status: OperationsSystemHealthStatus = input.dashboardSystem;

  const killSwitchDerived: OperationsSystemHealthStatus =
    !input.killSwitch.allowed || input.killSwitch.blocksNewOrders ? "BLOCKED" : "OK";
  status = worseHealth(status, killSwitchDerived);

  const reconciliationDerived: OperationsSystemHealthStatus = input.reconciliation.blocksDependentTrading
    ? "BLOCKED"
    : input.reconciliation.liveReadinessBlocked
      ? "WARNING"
      : "OK";
  status = worseHealth(status, reconciliationDerived);

  const apiDerived: OperationsSystemHealthStatus =
    input.aiApiHealth.api === "DOWN" ? "ERROR" : input.aiApiHealth.api === "DEGRADED" ? "WARNING" : "OK";
  status = worseHealth(status, apiDerived);

  const schedulerDerived: OperationsSystemHealthStatus =
    input.scheduler.unsafeJobDefinitionCount > 0 ? "BLOCKED" : input.scheduler.failingJobCount > 0 ? "WARNING" : "OK";
  status = worseHealth(status, schedulerDerived);

  return status;
}
