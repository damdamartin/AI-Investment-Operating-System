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
  | "METRIC_AGGREGATION";

export type ScheduledJobRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";

export interface ScheduledJobDefinition {
  id: string;
  kind: ScheduledJobKind;
  name: string;
  singleton: boolean;
  enabled: boolean;
  tradingRelated: boolean;
  maxAttempts: number;
  scheduleExpression: string;
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
    if (definition?.singleton && hasRunningRun(nextStore, definition.id)) {
      reasonCodes.push("singleton_job_already_running");
    }
    if (definition?.tradingRelated) {
      reasonCodes.push(...tradingSafetyRejections(input.safetyState));
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

function finish(
  store: SchedulerJobStore,
  runId: string,
  now: Date,
  status: "SUCCEEDED" | "FAILED",
  reasonCodes: string[],
  safeErrorSummary: string | undefined
): ScheduledJobRunnerResult {
  const nextStore = cloneStore(store);
  const run = nextStore.runs.find((item) => item.id === runId);

  if (!run) return result(false, nextStore, undefined, ["scheduled_job_run_not_found"]);
  if (run.status !== "RUNNING") return result(false, nextStore, run, ["scheduled_job_run_not_running"]);

  run.status = status;
  run.finishedAt = now;
  run.reasonCodes = reasonCodes;
  run.safeErrorSummary = safeErrorSummary;

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
  return { ...definition };
}

function cloneRun(run: ScheduledJobRun): ScheduledJobRun {
  return { ...run, reasonCodes: [...run.reasonCodes] };
}
