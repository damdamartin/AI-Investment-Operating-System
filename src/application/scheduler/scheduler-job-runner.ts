export type ScheduledJobKind =
  | "MARKET_CALENDAR_REFRESH"
  | "ASSET_UNIVERSE_REFRESH"
  | "MARKET_DATA_COLLECTION"
  | "ACCOUNT_SYNCHRONIZATION"
  | "NEWS_COLLECTION"
  | "AI_EVENT_ANALYSIS"
  | "SIGNAL_GENERATION"
  | "RECONCILIATION"
  | "AI_HEALTH_CHECK"
  | "BACKUP_VERIFICATION"
  | "METRIC_AGGREGATION"
  | "PHASE6_PAPER_SIMULATION_STATUS_REVIEW"
  | "PHASE6_RECONCILIATION_REVIEW"
  | "PHASE6_KILL_SWITCH_STATE_REVIEW"
  | "PHASE6_ALERT_REPORT_GENERATION"
  | "PHASE6_AUDIT_COVERAGE_REVIEW";

export type ScheduledJobRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";

/**
 * Phase 6 round 2 introduces five scheduler-safe review/report jobs. They
 * exist to give an operator repeatable, no-write visibility into
 * paper/simulation state. None of them may submit, cancel, or replace a
 * broker order, move money, or call a real Toss API endpoint -- see
 * `docs/phase6/phase6-scheduler-jobs.md` for the full per-job contract.
 */
export const PHASE6_SCHEDULER_JOB_KINDS: ReadonlySet<ScheduledJobKind> = new Set<ScheduledJobKind>([
  "PHASE6_PAPER_SIMULATION_STATUS_REVIEW",
  "PHASE6_RECONCILIATION_REVIEW",
  "PHASE6_KILL_SWITCH_STATE_REVIEW",
  "PHASE6_ALERT_REPORT_GENERATION",
  "PHASE6_AUDIT_COVERAGE_REVIEW"
]);

/**
 * Frozen safe defaults every scheduler job definition in this codebase must
 * match. This round does not add, and must never add, a scheduler job that
 * can submit an order, cancel an order, replace an order, transfer funds,
 * withdraw funds, or convert currency. Code that wires a job into a real
 * scheduler should import this constant instead of hand-building an
 * equivalent object that could typo its way into an unsafe value.
 */
export const PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY = Object.freeze({
  noWrite: true,
  callsBrokerApi: false,
  callsRealTossApi: false,
  submitsOrders: false,
  cancelsOrders: false,
  replacesOrders: false,
  transfersOrWithdraws: false,
  convertsCurrency: false
} as const);

export interface ScheduledJobDefinition {
  id: string;
  kind: ScheduledJobKind;
  name: string;
  singleton: boolean;
  enabled: boolean;
  tradingRelated: boolean;
  maxAttempts: number;
  scheduleExpression: string;
  /**
   * Must be `true`. The runner refuses to start any job where this is
   * `false`. A job marked `noWrite` never creates, updates, or deletes a
   * broker-facing record; it only reads already-computed state and reports
   * on it.
   */
  noWrite: boolean;
  /**
   * Must be `false`. The runner refuses to start any job where this is
   * `true`. No scheduler job defined in this codebase is permitted to call
   * a real (or simulated-live) broker API of any kind, including read-only
   * Toss verification -- that stays a human-operator-only, manually
   * triggered action per Phase 5's design.
   */
  callsBrokerApi: boolean;
  /**
   * Named local state inputs this job needs before it may run, for example
   * a reconciliation report snapshot, a kill-switch state snapshot, or a
   * flag describing whether local Phase 5 evidence files are present. The
   * runner never reads `.env`, `tmp/phase5/`, or any other file itself --
   * a caller supplies already-computed, sanitized booleans via
   * `StartScheduledJobInput.localStateAvailability`. Any name listed here
   * that is missing or not exactly `true` at start time fails the run
   * closed with a per-input reason code, mirroring the fail-closed pattern
   * `scripts/phase5-toss-doctor.mjs` uses for missing local files.
   */
  requiredLocalStateInputs: string[];
  safetyType: "SCHEDULED_JOB_DEFINITION_ONLY";
}

export interface ScheduledJobRun {
  id: string;
  jobId: string;
  status: ScheduledJobRunStatus;
  attempt: number;
  lockedBy?: string | undefined;
  lockedAt?: Date | undefined;
  startedAt?: Date | undefined;
  finishedAt?: Date | undefined;
  safeErrorSummary?: string | undefined;
  reasonCodes: string[];
  safetyType: "SCHEDULED_JOB_RUN_RECORD_ONLY";
}

export interface SchedulerSafetyState {
  killSwitchActive: boolean;
  reconciliationBlocksTrading: boolean;
  staleDataBlocksTrading: boolean;
  liveBrokerWriteGatesPermit: boolean;
}

export interface SchedulerJobStore {
  definitions: ScheduledJobDefinition[];
  runs: ScheduledJobRun[];
}

export interface StartScheduledJobInput {
  runId: string;
  jobId: string;
  workerId: string;
  now: Date;
  safetyState?: SchedulerSafetyState | undefined;
  /**
   * Sanitized, caller-computed availability flags for this job's
   * `requiredLocalStateInputs`. Never populate this from a raw read of
   * `.env` or `tmp/phase5/*` inside this codebase -- only pass booleans a
   * human-reviewed or otherwise sanitized process already computed.
   */
  localStateAvailability?: Record<string, boolean> | undefined;
}

export interface ScheduledJobRunnerResult {
  ok: boolean;
  store: SchedulerJobStore;
  run: ScheduledJobRun | undefined;
  reasonCodes: string[];
  safetyType: "SCHEDULED_JOB_RUNNER_RESULT_ONLY";
}

export class SchedulerJobRunner {
  start(store: SchedulerJobStore, input: StartScheduledJobInput): ScheduledJobRunnerResult {
    const nextStore = cloneStore(store);
    const definition = nextStore.definitions.find((job) => job.id === input.jobId);
    const reasonCodes: string[] = [];

    if (!definition) reasonCodes.push("scheduled_job_definition_not_found");
    if (definition && !definition.enabled) reasonCodes.push("scheduled_job_disabled");
    if (definition && !definition.noWrite) reasonCodes.push("scheduled_job_must_be_no_write");
    if (definition?.callsBrokerApi) reasonCodes.push("scheduled_job_must_not_call_broker_api");
    if (definition?.singleton && hasRunningRun(nextStore, definition.id)) {
      reasonCodes.push("singleton_job_already_running");
    }
    if (definition?.tradingRelated) {
      reasonCodes.push(...tradingSafetyRejections(input.safetyState));
    }
    if (definition) {
      reasonCodes.push(...missingLocalStateRejections(definition, input.localStateAvailability));
    }

    if (reasonCodes.length > 0) {
      const skipped = createRun(input, 0, "SKIPPED", reasonCodes);
      nextStore.runs.push(skipped);
      return result(false, nextStore, skipped, reasonCodes);
    }

    const previousAttempts = nextStore.runs.filter((run) => run.jobId === input.jobId).length;
    const run = createRun(input, previousAttempts + 1, "RUNNING", []);
    nextStore.runs.push(run);

    return result(true, nextStore, run, []);
  }

  succeed(store: SchedulerJobStore, runId: string, now: Date): ScheduledJobRunnerResult {
    return finish(store, runId, now, "SUCCEEDED", [], undefined);
  }

  fail(store: SchedulerJobStore, runId: string, now: Date, error: unknown): ScheduledJobRunnerResult {
    return finish(store, runId, now, "FAILED", ["scheduled_job_failed"], safeErrorSummary(error));
  }

  canRetry(definition: ScheduledJobDefinition, run: ScheduledJobRun): boolean {
    return run.status === "FAILED" && run.attempt < definition.maxAttempts;
  }
}

export function createSchedulerJobStore(
  definitions: ScheduledJobDefinition[] = [],
  runs: ScheduledJobRun[] = []
): SchedulerJobStore {
  return {
    definitions: definitions.map(cloneDefinition),
    runs: runs.map(cloneRun)
  };
}

/**
 * Builds the five canonical Phase 6 round 2 review/report jobs. Every job
 * this factory produces is `noWrite: true`, `callsBrokerApi: false`, and
 * `tradingRelated: false`.
 *
 * `tradingRelated` is deliberately `false` for all five: these are
 * observability jobs, not trading actions, and a status-review job must be
 * able to run precisely when trading is paused or blocked (for example the
 * kill-switch state review must still run while the kill switch is
 * active -- that is the whole point of the job). Gating them behind
 * `SchedulerSafetyState` the way trading jobs are gated would make the
 * monitor unable to observe the condition it exists to report on.
 *
 * Full per-job contract: `docs/phase6/phase6-scheduler-jobs.md`.
 */
export function createPhase6SchedulerJobCatalog(): ScheduledJobDefinition[] {
  return [
    phase6JobDefinition({
      id: "phase6-paper-simulation-status-review",
      kind: "PHASE6_PAPER_SIMULATION_STATUS_REVIEW",
      name: "Phase 6 Paper/Simulation Status Review",
      scheduleExpression: "*/15 * * * *",
      requiredLocalStateInputs: ["paperTradingStateSnapshot"]
    }),
    phase6JobDefinition({
      id: "phase6-reconciliation-review",
      kind: "PHASE6_RECONCILIATION_REVIEW",
      name: "Phase 6 Reconciliation Review",
      scheduleExpression: "*/15 * * * *",
      requiredLocalStateInputs: ["reconciliationReportSnapshot"]
    }),
    phase6JobDefinition({
      id: "phase6-kill-switch-state-review",
      kind: "PHASE6_KILL_SWITCH_STATE_REVIEW",
      name: "Phase 6 Kill Switch State Review",
      scheduleExpression: "*/5 * * * *",
      requiredLocalStateInputs: ["killSwitchStateSnapshot"]
    }),
    phase6JobDefinition({
      id: "phase6-alert-report-generation",
      kind: "PHASE6_ALERT_REPORT_GENERATION",
      name: "Phase 6 Alert and Report Generation",
      scheduleExpression: "0 * * * *",
      requiredLocalStateInputs: ["alertFeedSnapshot"]
    }),
    phase6JobDefinition({
      id: "phase6-audit-coverage-review",
      kind: "PHASE6_AUDIT_COVERAGE_REVIEW",
      name: "Phase 6 Audit Coverage Review",
      scheduleExpression: "0 6 * * *",
      requiredLocalStateInputs: ["auditLogSnapshot", "phase5LocalEvidenceStateKnown"]
    })
  ];
}

/**
 * Pure, store-independent safety review of a Phase 6 scheduler job catalog.
 * Used by tests and can be used by an operator script to prove, without
 * starting any job, that every defined job is no-write, never calls a
 * broker API, and carries no secret-like or raw-broker-data text in its
 * name.
 */
export function reviewPhase6SchedulerJobCatalogSafety(
  definitions: ScheduledJobDefinition[]
): { ok: boolean; reasonCodes: string[] } {
  const reasonCodes: string[] = [];

  for (const definition of definitions) {
    if (!definition.noWrite) reasonCodes.push(`job_not_no_write_${definition.id}`);
    if (definition.callsBrokerApi) reasonCodes.push(`job_calls_broker_api_${definition.id}`);
    if (PHASE6_SCHEDULER_JOB_KINDS.has(definition.kind) && definition.tradingRelated) {
      reasonCodes.push(`phase6_review_job_should_not_be_trading_gated_${definition.id}`);
    }
    if (containsSecretLikeOrRawBrokerData(definition.name)) {
      reasonCodes.push(`job_name_may_contain_secret_or_raw_broker_data_${definition.id}`);
    }
    if (containsSecretLikeOrRawBrokerData(definition.scheduleExpression)) {
      reasonCodes.push(`job_schedule_expression_may_contain_secret_or_raw_broker_data_${definition.id}`);
    }
  }

  return { ok: reasonCodes.length === 0, reasonCodes: [...new Set(reasonCodes)].sort() };
}

/**
 * Heuristic scan for secret-like text (API keys, tokens, authorization
 * headers) or raw-broker-data-shaped text (long digit runs that look like
 * an account number) in a short string. Mirrors the intake-validator
 * pattern already used in `scripts/validate-toss-evidence-intake.mjs` for
 * Phase 5 evidence, generalized for scheduler and runbook output.
 */
export function containsSecretLikeOrRawBrokerData(text: string): boolean {
  const secretLikePattern =
    /(access[_-]?token|refresh[_-]?token|client[_-]?secret|app[_-]?secret|api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]+|계좌번호|account[_-]?number)/i;
  const rawIdentifierPattern = /\d{8,}/;
  return secretLikePattern.test(text) || rawIdentifierPattern.test(text);
}

function phase6JobDefinition(overrides: {
  id: string;
  kind: ScheduledJobKind;
  name: string;
  scheduleExpression: string;
  requiredLocalStateInputs: string[];
}): ScheduledJobDefinition {
  return {
    id: overrides.id,
    kind: overrides.kind,
    name: overrides.name,
    singleton: true,
    enabled: true,
    tradingRelated: false,
    maxAttempts: 2,
    scheduleExpression: overrides.scheduleExpression,
    noWrite: true,
    callsBrokerApi: false,
    requiredLocalStateInputs: overrides.requiredLocalStateInputs,
    safetyType: "SCHEDULED_JOB_DEFINITION_ONLY"
  };
}

function finish(
  store: SchedulerJobStore,
  runId: string,
  now: Date,
  status: "SUCCEEDED" | "FAILED",
  reasonCodes: string[],
  safeErrorSummaryText: string | undefined
): ScheduledJobRunnerResult {
  const nextStore = cloneStore(store);
  const run = nextStore.runs.find((item) => item.id === runId);

  if (!run) return result(false, nextStore, undefined, ["scheduled_job_run_not_found"]);
  if (run.status !== "RUNNING") return result(false, nextStore, run, ["scheduled_job_run_not_running"]);

  run.status = status;
  run.finishedAt = now;
  run.reasonCodes = reasonCodes;
  run.safeErrorSummary = safeErrorSummaryText;

  return result(status === "SUCCEEDED", nextStore, run, reasonCodes);
}

function tradingSafetyRejections(safetyState: SchedulerSafetyState | undefined): string[] {
  if (!safetyState) return ["trading_safety_state_missing"];

  const reasonCodes: string[] = [];
  if (safetyState.killSwitchActive) reasonCodes.push("kill_switch_blocks_trading_job");
  if (safetyState.reconciliationBlocksTrading) reasonCodes.push("reconciliation_blocks_trading_job");
  if (safetyState.staleDataBlocksTrading) reasonCodes.push("stale_data_blocks_trading_job");
  if (!safetyState.liveBrokerWriteGatesPermit) reasonCodes.push("live_broker_write_gates_do_not_permit_job");
  return reasonCodes;
}

function missingLocalStateRejections(
  definition: ScheduledJobDefinition,
  localStateAvailability: Record<string, boolean> | undefined
): string[] {
  const reasonCodes: string[] = [];
  for (const inputName of definition.requiredLocalStateInputs) {
    if (localStateAvailability?.[inputName] !== true) {
      reasonCodes.push(`required_local_state_missing_${inputName}`);
    }
  }
  return reasonCodes;
}

function hasRunningRun(store: SchedulerJobStore, jobId: string): boolean {
  return store.runs.some((run) => run.jobId === jobId && run.status === "RUNNING");
}

function createRun(
  input: StartScheduledJobInput,
  attempt: number,
  status: ScheduledJobRunStatus,
  reasonCodes: string[]
): ScheduledJobRun {
  return {
    id: input.runId,
    jobId: input.jobId,
    status,
    attempt,
    lockedBy: status === "RUNNING" ? input.workerId : undefined,
    lockedAt: status === "RUNNING" ? input.now : undefined,
    startedAt: status === "RUNNING" ? input.now : undefined,
    finishedAt: status === "SKIPPED" ? input.now : undefined,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    safetyType: "SCHEDULED_JOB_RUN_RECORD_ONLY"
  };
}

function safeErrorSummary(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/token[:=][A-Za-z0-9_-]+/gi, "token=[REDACTED]")
    .replace(/bearer\s+[A-Za-z0-9._-]+/gi, "bearer [REDACTED]")
    .replace(/(access|refresh)[_-]?token[^\s]*/gi, "$1_token=[REDACTED]")
    .replace(/(client|app)[_-]?secret[^\s]*/gi, "$1_secret=[REDACTED]")
    .replace(/account[_-]?number[^\s]*/gi, "account_number=[REDACTED]")
    .replace(/계좌번호[^\s]*/g, "계좌번호=[REDACTED]")
    .replace(/\d{8,}/g, "[REDACTED_NUMBER]")
    .slice(0, 240);
}

function result(
  ok: boolean,
  store: SchedulerJobStore,
  run: ScheduledJobRun | undefined,
  reasonCodes: string[]
): ScheduledJobRunnerResult {
  return {
    ok,
    store,
    run,
    reasonCodes: [...new Set(reasonCodes)].sort(),
    safetyType: "SCHEDULED_JOB_RUNNER_RESULT_ONLY"
  };
}

function cloneStore(store: SchedulerJobStore): SchedulerJobStore {
  return {
    definitions: store.definitions.map(cloneDefinition),
    runs: store.runs.map(cloneRun)
  };
}

function cloneDefinition(definition: ScheduledJobDefinition): ScheduledJobDefinition {
  return { ...definition, requiredLocalStateInputs: [...definition.requiredLocalStateInputs] };
}

function cloneRun(run: ScheduledJobRun): ScheduledJobRun {
  return { ...run, reasonCodes: [...run.reasonCodes] };
}
