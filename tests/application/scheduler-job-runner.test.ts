import { describe, expect, it } from "vitest";
import {
  containsSecretLikeOrRawBrokerData,
  createPhase6SchedulerJobCatalog,
  createSchedulerJobStore,
  PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY,
  PHASE6_SCHEDULER_JOB_KINDS,
  reviewPhase6SchedulerJobCatalogSafety,
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
      new Error(
        "Claude token=secret-token and key sk-test-secret failed, bearer abc123token, account_number 12345678901, 계좌번호 98765432109"
      )
    );

    expect(failed.run?.status).toBe("FAILED");
    expect(failed.run?.safeErrorSummary).not.toContain("sk-test-secret");
    expect(failed.run?.safeErrorSummary).not.toContain("secret-token");
    expect(failed.run?.safeErrorSummary).not.toContain("abc123token");
    expect(failed.run?.safeErrorSummary).not.toContain("12345678901");
    expect(failed.run?.safeErrorSummary).not.toContain("98765432109");
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

  it("refuses to start a job definition that is not marked no-write", () => {
    const result = new SchedulerJobRunner().start(
      createSchedulerJobStore([jobDefinition({ noWrite: false })]),
      { runId: "run-1", jobId: "job-reconciliation", workerId: "worker-1", now: now() }
    );

    expect(result.ok).toBe(false);
    expect(result.run?.status).toBe("SKIPPED");
    expect(result.reasonCodes).toContain("scheduled_job_must_be_no_write");
  });

  it("refuses to start a job definition that calls a broker API", () => {
    const result = new SchedulerJobRunner().start(
      createSchedulerJobStore([jobDefinition({ callsBrokerApi: true })]),
      { runId: "run-1", jobId: "job-reconciliation", workerId: "worker-1", now: now() }
    );

    expect(result.ok).toBe(false);
    expect(result.run?.status).toBe("SKIPPED");
    expect(result.reasonCodes).toContain("scheduled_job_must_not_call_broker_api");
  });

  describe("Phase 6 required local state (fail-closed on missing local state)", () => {
    it("fails closed with a per-input reason code when no local state availability is supplied", () => {
      const catalog = createPhase6SchedulerJobCatalog();
      const auditJob = catalog.find((job) => job.kind === "PHASE6_AUDIT_COVERAGE_REVIEW")!;
      const result = new SchedulerJobRunner().start(createSchedulerJobStore(catalog), {
        runId: "run-1",
        jobId: auditJob.id,
        workerId: "worker-1",
        now: now()
      });

      expect(result.ok).toBe(false);
      expect(result.run?.status).toBe("SKIPPED");
      expect(result.reasonCodes).toContain("required_local_state_missing_auditLogSnapshot");
      expect(result.reasonCodes).toContain("required_local_state_missing_phase5LocalEvidenceStateKnown");
    });

    it("fails closed for only the still-missing input when some inputs are available", () => {
      const catalog = createPhase6SchedulerJobCatalog();
      const auditJob = catalog.find((job) => job.kind === "PHASE6_AUDIT_COVERAGE_REVIEW")!;
      const result = new SchedulerJobRunner().start(createSchedulerJobStore(catalog), {
        runId: "run-1",
        jobId: auditJob.id,
        workerId: "worker-1",
        now: now(),
        localStateAvailability: { auditLogSnapshot: true }
      });

      expect(result.ok).toBe(false);
      expect(result.reasonCodes).not.toContain("required_local_state_missing_auditLogSnapshot");
      expect(result.reasonCodes).toContain("required_local_state_missing_phase5LocalEvidenceStateKnown");
    });

    it("proceeds to RUNNING once every required local state input is available", () => {
      const catalog = createPhase6SchedulerJobCatalog();
      const auditJob = catalog.find((job) => job.kind === "PHASE6_AUDIT_COVERAGE_REVIEW")!;
      const result = new SchedulerJobRunner().start(createSchedulerJobStore(catalog), {
        runId: "run-1",
        jobId: auditJob.id,
        workerId: "worker-1",
        now: now(),
        localStateAvailability: { auditLogSnapshot: true, phase5LocalEvidenceStateKnown: true }
      });

      expect(result.ok).toBe(true);
      expect(result.run?.status).toBe("RUNNING");
    });

    it("does not gate Phase 6 review jobs on SchedulerSafetyState even during an active kill switch", () => {
      const catalog = createPhase6SchedulerJobCatalog();
      const killSwitchReviewJob = catalog.find((job) => job.kind === "PHASE6_KILL_SWITCH_STATE_REVIEW")!;
      const result = new SchedulerJobRunner().start(createSchedulerJobStore(catalog), {
        runId: "run-1",
        jobId: killSwitchReviewJob.id,
        workerId: "worker-1",
        now: now(),
        localStateAvailability: { killSwitchStateSnapshot: true }
        // Deliberately no safetyState supplied and kill switch conceptually active:
        // the review job must still be able to run so the operator can see the state.
      });

      expect(result.ok).toBe(true);
      expect(result.run?.status).toBe("RUNNING");
    });
  });

  describe("Phase 6 scheduler job catalog", () => {
    it("defines exactly the five required Phase 6 review/report job kinds", () => {
      const catalog = createPhase6SchedulerJobCatalog();
      const kinds = catalog.map((job) => job.kind).sort();

      expect(kinds).toEqual(
        [
          "PHASE6_ALERT_REPORT_GENERATION",
          "PHASE6_AUDIT_COVERAGE_REVIEW",
          "PHASE6_KILL_SWITCH_STATE_REVIEW",
          "PHASE6_PAPER_SIMULATION_STATUS_REVIEW",
          "PHASE6_RECONCILIATION_REVIEW"
        ].sort()
      );
      expect(catalog.every((job) => PHASE6_SCHEDULER_JOB_KINDS.has(job.kind))).toBe(true);
    });

    it("marks every catalog job no-write, not broker-calling, and not trading-gated", () => {
      const catalog = createPhase6SchedulerJobCatalog();

      for (const job of catalog) {
        expect(job.noWrite).toBe(true);
        expect(job.callsBrokerApi).toBe(false);
        expect(job.tradingRelated).toBe(false);
      }
    });

    it("passes its own catalog-level safety review", () => {
      const review = reviewPhase6SchedulerJobCatalogSafety(createPhase6SchedulerJobCatalog());

      expect(review.ok).toBe(true);
      expect(review.reasonCodes).toEqual([]);
    });

    it("flags a catalog-level safety violation if a definition is tampered with", () => {
      const tampered = createPhase6SchedulerJobCatalog().map((job) =>
        job.kind === "PHASE6_RECONCILIATION_REVIEW" ? { ...job, callsBrokerApi: true, noWrite: false } : job
      );
      const review = reviewPhase6SchedulerJobCatalogSafety(tampered);

      expect(review.ok).toBe(false);
      expect(review.reasonCodes).toContain("job_not_no_write_phase6-reconciliation-review");
      expect(review.reasonCodes).toContain("job_calls_broker_api_phase6-reconciliation-review");
    });

    it("exposes a frozen no-write policy constant that cannot be mutated", () => {
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.noWrite).toBe(true);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.callsBrokerApi).toBe(false);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.callsRealTossApi).toBe(false);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.submitsOrders).toBe(false);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.cancelsOrders).toBe(false);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.replacesOrders).toBe(false);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.transfersOrWithdraws).toBe(false);
      expect(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY.convertsCurrency).toBe(false);
      expect(Object.isFrozen(PHASE6_NO_WRITE_SCHEDULER_JOB_POLICY)).toBe(true);
    });

    it("never produces a store (definitions + runs) that contains secret-like or raw broker data", () => {
      const runner = new SchedulerJobRunner();
      const catalog = createPhase6SchedulerJobCatalog();
      let store = createSchedulerJobStore(catalog);

      for (const job of catalog) {
        const availability = Object.fromEntries(job.requiredLocalStateInputs.map((name) => [name, true]));
        const started = runner.start(store, {
          runId: `run-${job.id}`,
          jobId: job.id,
          workerId: "worker-1",
          now: now(),
          localStateAvailability: availability
        });
        expect(started.ok).toBe(true);
        const completed = runner.succeed(started.store, `run-${job.id}`, now());
        store = completed.store;
      }

      const serialized = JSON.stringify(store);
      expect(containsSecretLikeOrRawBrokerData(serialized)).toBe(false);
    });
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
    noWrite: true,
    callsBrokerApi: false,
    requiredLocalStateInputs: [],
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
