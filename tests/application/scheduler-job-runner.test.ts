import { describe, expect, it } from "vitest";
import {
  createSchedulerJobStore,
  SchedulerJobRunner,
  type ScheduledJobDefinition,
  type SchedulerSafetyState
} from "../../src/index.js";

describe("SchedulerJobRunner", () => {
  it("starts and completes enabled singleton jobs", () => {
    const runner = new SchedulerJobRunner();
    const started = runner.start(createSchedulerJobStore([jobDefinition()]), {
      runId: "run-1",
      jobId: "job-reconciliation",
      workerId: "worker-1",
      now: now()
    });
    const completed = runner.succeed(started.store, "run-1", new Date("2026-01-01T00:01:00Z"));

    expect(started.ok).toBe(true);
    expect(started.run?.status).toBe("RUNNING");
    expect(started.run?.lockedBy).toBe("worker-1");
    expect(completed.run?.status).toBe("SUCCEEDED");
  });

  it("prevents overlapping singleton job runs", () => {
    const runner = new SchedulerJobRunner();
    const first = runner.start(createSchedulerJobStore([jobDefinition()]), {
      runId: "run-1",
      jobId: "job-reconciliation",
      workerId: "worker-1",
      now: now()
    });
    const second = runner.start(first.store, {
      runId: "run-2",
      jobId: "job-reconciliation",
      workerId: "worker-2",
      now: now()
    });

    expect(second.ok).toBe(false);
    expect(second.run?.status).toBe("SKIPPED");
    expect(second.reasonCodes).toContain("singleton_job_already_running");
  });

  it("records safe error summaries for failed jobs", () => {
    const runner = new SchedulerJobRunner();
    const started = runner.start(createSchedulerJobStore([jobDefinition()]), {
      runId: "run-1",
      jobId: "job-reconciliation",
      workerId: "worker-1",
      now: now()
    });
    const failed = runner.fail(
      started.store,
      "run-1",
      new Date("2026-01-01T00:01:00Z"),
      new Error("Claude token=secret-token and key sk-test-secret failed")
    );

    expect(failed.run?.status).toBe("FAILED");
    expect(failed.run?.safeErrorSummary).not.toContain("sk-test-secret");
    expect(failed.run?.safeErrorSummary).not.toContain("secret-token");
    expect(failed.reasonCodes).toContain("scheduled_job_failed");
  });

  it("disables trading-related jobs when safety state blocks trading", () => {
    const result = new SchedulerJobRunner().start(createSchedulerJobStore([jobDefinition({ tradingRelated: true })]), {
      runId: "run-1",
      jobId: "job-reconciliation",
      workerId: "worker-1",
      now: now(),
      safetyState: {
        ...safeTradingState(),
        killSwitchActive: true
      }
    });

    expect(result.ok).toBe(false);
    expect(result.run?.status).toBe("SKIPPED");
    expect(result.reasonCodes).toContain("kill_switch_blocks_trading_job");
  });

  it("requires explicit live broker write gates before trading jobs can run", () => {
    const runner = new SchedulerJobRunner();
    const blocked = runner.start(createSchedulerJobStore([jobDefinition({ tradingRelated: true })]), {
      runId: "run-1",
      jobId: "job-reconciliation",
      workerId: "worker-1",
      now: now()
    });
    const allowed = runner.start(createSchedulerJobStore([jobDefinition({ tradingRelated: true })]), {
      runId: "run-2",
      jobId: "job-reconciliation",
      workerId: "worker-1",
      now: now(),
      safetyState: safeTradingState()
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.reasonCodes).toContain("trading_safety_state_missing");
    expect(allowed.ok).toBe(true);
    expect(allowed.run?.status).toBe("RUNNING");
  });
});

function jobDefinition(overrides: Partial<ScheduledJobDefinition> = {}): ScheduledJobDefinition {
  return {
    id: "job-reconciliation",
    kind: "RECONCILIATION",
    name: "Reconciliation",
    singleton: true,
    enabled: true,
    tradingRelated: false,
    maxAttempts: 3,
    scheduleExpression: "*/5 * * * *",
    safetyType: "SCHEDULED_JOB_DEFINITION_ONLY",
    ...overrides
  };
}

function safeTradingState(): SchedulerSafetyState {
  return {
    killSwitchActive: false,
    reconciliationBlocksTrading: false,
    staleDataBlocksTrading: false,
    liveBrokerWriteGatesPermit: true
  };
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
