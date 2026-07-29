import { describe, expect, it } from "vitest";
import {
  TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS,
  evaluateTossWritePreflight
} from "../../src/adapters/toss-write-preflight.js";
import type {
  TossWritePreflightErrorNormalizationPolicyEvidence,
  TossWritePreflightIdempotencyPolicyEvidence,
  TossWritePreflightInput,
  TossWritePreflightLiveBlockerEvidenceSummary,
  TossWritePreflightLiveBlockerId,
  TossWritePreflightRawPayloadPolicyEvidence,
  TossWritePreflightRedactionPolicyEvidence
} from "../../src/adapters/toss-write-preflight.js";
import type { TossWriteContractKillSwitchRecheck } from "../../src/adapters/toss-write-contract.js";
import type { BrokerWriteCommandGuardResult } from "../../src/application/broker-write-guard/broker-write-command-guard.js";
import type { ReconciliationReport } from "../../src/application/reconciliation/reconciliation-service.js";

// SAFETY: this file makes no network call, reads no environment variable,
// reads no .env or tmp/phase5 file, and never sets `liveBrokerWriteAllowed`
// to `true` anywhere, including in "ready: true" fixtures below (the field
// is always the hardcoded literal `false`, asserted explicitly). It only
// exercises the pure evaluator in src/adapters/toss-write-preflight.ts with
// caller-supplied fixture data.

const NOW = new Date("2026-07-29T12:00:00.000Z");

function freshDate(offsetMs = -1000): Date {
  return new Date(NOW.getTime() + offsetMs);
}

function validGuardResult(overrides: Partial<BrokerWriteCommandGuardResult> = {}): BrokerWriteCommandGuardResult {
  return {
    allowed: true,
    commandType: "SUBMIT_ORDER",
    reasonCodes: [],
    safetyType: "BROKER_WRITE_COMMAND_GUARD_DECISION",
    ...overrides
  };
}

function validKillSwitch(overrides: Partial<TossWriteContractKillSwitchRecheck> = {}): TossWriteContractKillSwitchRecheck {
  return {
    checkedImmediatelyBeforeSubmission: true,
    active: false,
    scope: "GLOBAL",
    checkedAt: freshDate(-500),
    ...overrides
  };
}

function validReconciliation(overrides: Partial<ReconciliationReport> = {}): ReconciliationReport {
  return {
    id: "recon-1",
    status: "CLEAN",
    positionIssues: [],
    cashIssues: [],
    unknownReasons: [],
    blocksDependentTrading: false,
    checkedAt: freshDate(-1000),
    safetyType: "RECONCILIATION_READ_ONLY_REPORT",
    ...overrides
  };
}

function validLiveBlockerEvidence(
  overrides: Partial<Record<TossWritePreflightLiveBlockerId, Partial<TossWritePreflightLiveBlockerEvidenceSummary>>> = {}
): TossWritePreflightLiveBlockerEvidenceSummary[] {
  return TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS.map((blockerId) => ({
    blockerId,
    humanReviewed: true,
    reviewerRole: "Compliance/legal reviewer (human)",
    reviewedAt: freshDate(-2000),
    ...(overrides[blockerId] ?? {})
  }));
}

function validIdempotencyPolicy(
  overrides: Partial<TossWritePreflightIdempotencyPolicyEvidence> = {}
): TossWritePreflightIdempotencyPolicyEvidence {
  return {
    policyDocumented: true,
    deterministicPerApprovalPerOperation: true,
    uniqueConstraintEnforced: true,
    persistedBeforeNetworkAttempt: true,
    regeneratedPerNetworkAttempt: false,
    ...overrides
  };
}

function validRedactionPolicy(
  overrides: Partial<TossWritePreflightRedactionPolicyEvidence> = {}
): TossWritePreflightRedactionPolicyEvidence {
  return {
    policyDocumented: true,
    reusesSharedRedactObject: true,
    accountIdentifiersMaskedToLastFour: true,
    rawPayloadNeverLoggedInline: true,
    moneyAmountsCarryCurrency: true,
    ...overrides
  };
}

function validErrorNormalizationPolicy(
  overrides: Partial<TossWritePreflightErrorNormalizationPolicyEvidence> = {}
): TossWritePreflightErrorNormalizationPolicyEvidence {
  return {
    policyDocumented: true,
    usesSharedNormalizedResultTaxonomy: true,
    ambiguousOutcomeMapsToUnknown: true,
    blindRetryPermitted: false,
    requiresReconciliationForcedWhenAmbiguous: true,
    ...overrides
  };
}

function validRawPayloadPolicy(
  overrides: Partial<TossWritePreflightRawPayloadPolicyEvidence> = {}
): TossWritePreflightRawPayloadPolicyEvidence {
  return {
    policyDocumented: true,
    rawPayloadStorageAllowed: false,
    redactedBeforePersistence: true,
    ...overrides
  };
}

function fullyValidInput(overrides: Partial<TossWritePreflightInput> = {}): TossWritePreflightInput {
  return {
    now: NOW,
    commandType: "SUBMIT_ORDER",
    liveBlockerEvidence: validLiveBlockerEvidence(),
    guardResult: validGuardResult(),
    killSwitch: validKillSwitch(),
    reconciliation: validReconciliation(),
    idempotencyPolicy: validIdempotencyPolicy(),
    redactionPolicy: validRedactionPolicy(),
    errorNormalizationPolicy: validErrorNormalizationPolicy(),
    rawPayloadPolicy: validRawPayloadPolicy(),
    ...overrides
  };
}

describe("evaluateTossWritePreflight (no-write, Phase 9)", () => {
  it("is a pure synchronous function, not a Promise-returning or network-touching call", () => {
    const result = evaluateTossWritePreflight(fullyValidInput());
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe("object");
  });

  it("reports ready:true only when every supplied input satisfies every gate", () => {
    const result = evaluateTossWritePreflight(fullyValidInput());
    expect(result.blockingReasons).toEqual([]);
    expect(result.ready).toBe(true);
    expect(result.commandType).toBe("SUBMIT_ORDER");
  });

  it("always returns liveBrokerWriteAllowed: false, even when ready is true", () => {
    const ready = evaluateTossWritePreflight(fullyValidInput());
    expect(ready.liveBrokerWriteAllowed).toBe(false);

    const notReady = evaluateTossWritePreflight({ commandType: "SUBMIT_ORDER" });
    expect(notReady.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed on a completely empty input (no now, no evidence, no guard, nothing supplied)", () => {
    const result = evaluateTossWritePreflight({ commandType: "SUBMIT_ORDER" });

    expect(result.ready).toBe(false);
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        "missing_evaluation_time",
        "missing_live_blocker_evidence",
        "missing_broker_write_command_guard_result",
        "missing_kill_switch_recheck",
        "missing_reconciliation_state",
        "missing_idempotency_policy",
        "missing_redaction_policy",
        "missing_error_normalization_policy",
        "missing_raw_payload_policy"
      ])
    );
  });

  it("never throws on missing or malformed input; it reports blocking reasons instead", () => {
    expect(() => evaluateTossWritePreflight({ commandType: "SUBMIT_ORDER" })).not.toThrow();
    expect(() =>
      evaluateTossWritePreflight({
        commandType: "SUBMIT_ORDER",
        now: new Date("not-a-real-date")
      })
    ).not.toThrow();
  });

  it("treats an invalid `now` the same as a missing one", () => {
    const result = evaluateTossWritePreflight(
      fullyValidInput({ now: new Date("not-a-real-date") })
    );
    expect(result.blockingReasons).toContain("missing_evaluation_time");
    expect(result.ready).toBe(false);
  });

  describe("live blocker evidence (LCB-001..LCB-008)", () => {
    it("requires every LCB-* id to be present", () => {
      const evidence = validLiveBlockerEvidence().filter((entry) => entry.blockerId !== "LCB-004");
      const result = evaluateTossWritePreflight(fullyValidInput({ liveBlockerEvidence: evidence }));

      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContain("live_blocker_lcb-004_missing");
    });

    it("fails closed when a blocker's evidence is not marked human-reviewed", () => {
      const evidence = validLiveBlockerEvidence({ "LCB-002": { humanReviewed: false } });
      const result = evaluateTossWritePreflight(fullyValidInput({ liveBlockerEvidence: evidence }));

      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContain("live_blocker_lcb-002_not_human_reviewed");
    });

    it("fails closed when the reviewer role reads as AI-authored rather than human", () => {
      const evidence = validLiveBlockerEvidence({ "LCB-001": { reviewerRole: "Claude" } });
      const result = evaluateTossWritePreflight(fullyValidInput({ liveBlockerEvidence: evidence }));

      expect(result.ready).toBe(false);
      expect(result.blockingReasons).toContain("live_blocker_lcb-001_reviewer_role_not_human");
    });

    it("fails closed when reviewedAt is missing or in the future", () => {
      const missingDate = validLiveBlockerEvidence({
        "LCB-003": { reviewedAt: new Date("not-a-real-date") }
      });
      const futureDate = validLiveBlockerEvidence({
        "LCB-003": { reviewedAt: new Date(NOW.getTime() + 60_000) }
      });

      expect(
        evaluateTossWritePreflight(fullyValidInput({ liveBlockerEvidence: missingDate })).blockingReasons
      ).toContain("live_blocker_lcb-003_missing_reviewed_at");
      expect(
        evaluateTossWritePreflight(fullyValidInput({ liveBlockerEvidence: futureDate })).blockingReasons
      ).toContain("live_blocker_lcb-003_reviewed_at_in_future");
    });

    it("requires all eight LCB ids, matching the live-capable blocker register", () => {
      expect([...TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS].sort()).toEqual([
        "LCB-001",
        "LCB-002",
        "LCB-003",
        "LCB-004",
        "LCB-005",
        "LCB-006",
        "LCB-007",
        "LCB-008"
      ]);
    });
  });

  describe("BrokerWriteCommandGuard compatibility", () => {
    it("fails closed when the guard result is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ guardResult: undefined }));
      expect(result.blockingReasons).toContain("missing_broker_write_command_guard_result");
    });

    it("fails closed when the guard result is not allowed", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ guardResult: validGuardResult({ allowed: false, reasonCodes: ["missing_kill_switch_state"] }) })
      );
      expect(result.blockingReasons).toContain("guard_result_not_allowed");
    });

    it("fails closed when the guard result's commandType does not match the preflight commandType", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ commandType: "CANCEL_ORDER", guardResult: validGuardResult({ commandType: "SUBMIT_ORDER" }) })
      );
      expect(result.blockingReasons).toContain("guard_result_command_type_mismatch");
    });

    it("never re-derives or weakens the guard: an allowed:true result with leftover reasonCodes is rejected", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ guardResult: validGuardResult({ allowed: true, reasonCodes: ["some_reason"] }) })
      );
      expect(result.blockingReasons).toContain("guard_result_has_reason_codes");
    });
  });

  describe("kill-switch recheck", () => {
    it("fails closed when the kill switch recheck is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ killSwitch: undefined }));
      expect(result.blockingReasons).toContain("missing_kill_switch_recheck");
    });

    it("fails closed when the kill switch is active", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ killSwitch: validKillSwitch({ active: true, scope: "PORTFOLIO" }) })
      );
      expect(result.blockingReasons).toContain("kill_switch_active_portfolio");
    });

    it("fails closed when the recheck was not marked as immediately-before-submission", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({
          killSwitch: {
            ...validKillSwitch(),
            checkedImmediatelyBeforeSubmission: false as unknown as true
          }
        })
      );
      expect(result.blockingReasons).toContain("kill_switch_not_rechecked_immediately_before_submission");
    });

    it("fails closed when the kill-switch recheck is stale", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ killSwitch: validKillSwitch({ checkedAt: freshDate(-60_000) }) })
      );
      expect(result.blockingReasons).toContain("kill_switch_recheck_stale");
    });
  });

  describe("reconciliation freshness", () => {
    it("fails closed when reconciliation is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ reconciliation: undefined }));
      expect(result.blockingReasons).toContain("missing_reconciliation_state");
    });

    it("fails closed when reconciliation is not CLEAN", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ reconciliation: validReconciliation({ status: "MISMATCH" }) })
      );
      expect(result.blockingReasons).toContain("reconciliation_mismatch_not_clean");
    });

    it("fails closed when reconciliation blocks dependent trading even if status looks clean", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ reconciliation: validReconciliation({ blocksDependentTrading: true }) })
      );
      expect(result.blockingReasons).toContain("reconciliation_blocks_dependent_trading");
    });

    it("fails closed when reconciliation is stale", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ reconciliation: validReconciliation({ checkedAt: freshDate(-10 * 60 * 1000) }) })
      );
      expect(result.blockingReasons).toContain("reconciliation_stale");
    });
  });

  describe("idempotency / client order id policy", () => {
    it("fails closed when the policy is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ idempotencyPolicy: undefined }));
      expect(result.blockingReasons).toContain("missing_idempotency_policy");
    });

    it("fails closed when the policy allows regenerating the key per network attempt", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ idempotencyPolicy: validIdempotencyPolicy({ regeneratedPerNetworkAttempt: true }) })
      );
      expect(result.blockingReasons).toContain("idempotency_policy_regenerates_per_attempt");
    });

    it("fails closed when the unique constraint is not enforced", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ idempotencyPolicy: validIdempotencyPolicy({ uniqueConstraintEnforced: false }) })
      );
      expect(result.blockingReasons).toContain("idempotency_policy_unique_constraint_missing");
    });
  });

  describe("redaction policy", () => {
    it("fails closed when the policy is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ redactionPolicy: undefined }));
      expect(result.blockingReasons).toContain("missing_redaction_policy");
    });

    it("fails closed when the policy does not reuse the shared redaction path", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ redactionPolicy: validRedactionPolicy({ reusesSharedRedactObject: false }) })
      );
      expect(result.blockingReasons).toContain("redaction_policy_does_not_reuse_shared_redaction");
    });

    it("fails closed when money amounts might not carry currency", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ redactionPolicy: validRedactionPolicy({ moneyAmountsCarryCurrency: false }) })
      );
      expect(result.blockingReasons).toContain("redaction_policy_money_amounts_missing_currency");
    });
  });

  describe("timeout / error normalization policy", () => {
    it("fails closed when the policy is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ errorNormalizationPolicy: undefined }));
      expect(result.blockingReasons).toContain("missing_error_normalization_policy");
    });

    it("fails closed when blind retry is permitted", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({
          errorNormalizationPolicy: validErrorNormalizationPolicy({ blindRetryPermitted: true })
        })
      );
      expect(result.blockingReasons).toContain("error_normalization_policy_permits_blind_retry");
    });

    it("fails closed when ambiguous outcomes do not map to UNKNOWN", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({
          errorNormalizationPolicy: validErrorNormalizationPolicy({ ambiguousOutcomeMapsToUnknown: false })
        })
      );
      expect(result.blockingReasons).toContain("error_normalization_policy_ambiguous_outcome_not_mapped_to_unknown");
    });
  });

  describe("raw broker payload storage policy", () => {
    it("fails closed when the policy is missing", () => {
      const result = evaluateTossWritePreflight(fullyValidInput({ rawPayloadPolicy: undefined }));
      expect(result.blockingReasons).toContain("missing_raw_payload_policy");
    });

    it("fails closed (defensively, at runtime) even if a caller bypasses the type system to set rawPayloadStorageAllowed true", () => {
      const bypassed = {
        ...validRawPayloadPolicy(),
        rawPayloadStorageAllowed: true
      } as unknown as TossWritePreflightRawPayloadPolicyEvidence;

      const result = evaluateTossWritePreflight(fullyValidInput({ rawPayloadPolicy: bypassed }));
      expect(result.blockingReasons).toContain("raw_payload_storage_allowed");
      expect(result.ready).toBe(false);
    });

    it("fails closed when raw payloads are allegedly never stored but not redacted before persistence", () => {
      const result = evaluateTossWritePreflight(
        fullyValidInput({ rawPayloadPolicy: validRawPayloadPolicy({ redactedBeforePersistence: false }) })
      );
      expect(result.blockingReasons).toContain("raw_payload_policy_not_redacted_before_persistence");
    });
  });

  it("does not mutate its input and produces stable, repeatable output for the same input", () => {
    const input = fullyValidInput();
    const snapshotBefore = JSON.stringify(input);

    const first = evaluateTossWritePreflight(input);
    const second = evaluateTossWritePreflight(input);

    expect(JSON.stringify(input)).toBe(snapshotBefore);
    expect(first).toEqual(second);
  });

  it("exposes no callable adapter and no runtime construction of a live write path from this module", async () => {
    const moduleExports: Record<string, unknown> = await import("../../src/adapters/toss-write-preflight.js");

    for (const [name, value] of Object.entries(moduleExports)) {
      if (name === "evaluateTossWritePreflight") {
        expect(typeof value).toBe("function");
        continue;
      }
      // Every other export must be plain data (arrays/objects), never a
      // function, class, or anything that could stand in for a callable
      // adapter method such as submitOrder/cancelOrder/replaceOrder.
      expect(typeof value, `export "${name}" must not be a function`).not.toBe("function");
    }
  });
});
