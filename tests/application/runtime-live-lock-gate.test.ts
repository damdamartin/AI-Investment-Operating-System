import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAccount,
  BrokerWriteCommandGuard,
  Currency,
  EngineScoreSet,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderIntent,
  PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY,
  PortfolioBrokerAccountLink,
  Price,
  Quantity,
  RiskCheck,
  RUNTIME_LIVE_LOCK_GATE_EVIDENCE_STATEMENT,
  Signal,
  StrategyVersion,
  TossCapabilityRegistry,
  evaluateRuntimeLiveLockGate,
  evaluateSmallCapitalEnablementGate,
  type RuntimeLiveLockGateApprovalSignal,
  type RuntimeLiveLockGateInput
} from "../../src/index.js";
import type { BrokerWriteCommandGuardResult } from "../../src/application/broker-write-guard/broker-write-command-guard.js";
import type { ReconciliationReport } from "../../src/application/reconciliation/reconciliation-service.js";
import {
  TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
  type TossFutureWriteAdapter
} from "../../src/adapters/toss-write-contract.js";
import {
  TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS,
  evaluateTossWritePreflight
} from "../../src/adapters/toss-write-preflight.js";
import type { TossWriteContractKillSwitchRecheck } from "../../src/adapters/toss-write-contract.js";
import type {
  TossWritePreflightErrorNormalizationPolicyEvidence,
  TossWritePreflightIdempotencyPolicyEvidence,
  TossWritePreflightLiveBlockerEvidenceSummary,
  TossWritePreflightRawPayloadPolicyEvidence,
  TossWritePreflightRedactionPolicyEvidence
} from "../../src/adapters/toss-write-preflight.js";

// SAFETY: this file makes no network call, reads no environment variable,
// reads no .env or tmp/phase5 file, and never sets `liveBrokerWriteAllowed`
// or `runtimeWriteLockEngaged` to anything other than their expected
// hardcoded values on a real, non-tampered evaluator output. Where a
// tampered value is constructed (e.g. `claimedLiveBrokerWriteAllowed: true`),
// it is only ever fed in as *input* to prove the gate detects and reports
// it -- never accepted as this gate's own output.

const NOW = new Date("2026-01-01T00:00:00.000Z");

// ---------------------------------------------------------------------------
// BrokerWriteCommandGuard fixtures (real guard, never mocked) -- mirrors the
// same helper shapes already established in tests/safety/safety-regression.test.ts,
// duplicated locally per this codebase's existing per-file fixture convention.
// ---------------------------------------------------------------------------

function signal(): Signal {
  return new Signal({
    id: "signal-1",
    strategyVersion: new StrategyVersion({
      id: "version-1",
      strategyId: "strategy-1",
      version: "1.0.0",
      definitionHash: "hash-1"
    }),
    asset: new Asset({
      id: "asset-1",
      symbol: "AAPL",
      name: "Apple",
      market: Market.from("US"),
      assetType: AssetType.from("STOCK"),
      tradingStatus: "TRADABLE"
    }),
    direction: "BUY",
    scoreSet: new EngineScoreSet([{ engine: "market", score: 80, confidence: 0.9 }], "score-v1"),
    generatedAt: NOW
  });
}

function approvedIntent(): OrderIntent {
  const usd = Currency.from("USD");
  return new OrderIntent({
    id: "intent-1",
    signal: signal(),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", usd),
    status: "MONEY_CHECKED"
  }).transitionTo("APPROVED");
}

function passingRiskCheck(): RiskCheck {
  return new RiskCheck({
    id: "risk-check-1",
    subjectType: "ORDER_INTENT",
    subjectId: "intent-1",
    result: "PASS",
    riskLevel: "LOW",
    checkedAt: NOW
  });
}

function passingMoneyCheck(): MoneyCheck {
  const usd = Currency.from("USD");
  return new MoneyCheck({
    id: "money-check-1",
    orderIntentId: "intent-1",
    result: "PASS",
    approvedQuantity: Quantity.from("1"),
    approvedAmount: Money.fromMajor("100.00", usd),
    cashAfterOrder: Money.fromMajor("900.00", usd),
    checkedAt: NOW
  });
}

function livePassingBrokerAccount(): BrokerAccount {
  return new BrokerAccount({
    id: "broker-account-1",
    broker: "TOSS_SECURITIES",
    externalAccountRef: "account-1",
    accountLabel: "Main",
    permissionStatus: "LIVE_TRADING_ALLOWED",
    readOnlyEnabled: true,
    liveTradingEnabled: true,
    status: "ACTIVE"
  });
}

function activePortfolioLink(): PortfolioBrokerAccountLink {
  return new PortfolioBrokerAccountLink({
    id: "link-1",
    portfolioId: "portfolio-1",
    brokerAccountId: "broker-account-1",
    allowedMarkets: [Market.from("US")],
    allowedAssetTypes: [AssetType.from("STOCK")],
    status: "ACTIVE"
  });
}

function supportedCapabilityRegistry(): TossCapabilityRegistry {
  return new TossCapabilityRegistry([
    { capability: "US_STOCK_LIMIT_ORDER", status: "SUPPORTED", checkedAt: NOW }
  ]);
}

function cleanReconciliationReport(): ReconciliationReport {
  return {
    id: "reconciliation-1",
    status: "CLEAN",
    positionIssues: [],
    cashIssues: [],
    unknownReasons: [],
    blocksDependentTrading: false,
    checkedAt: NOW,
    safetyType: "RECONCILIATION_READ_ONLY_REPORT"
  };
}

/**
 * A `BrokerWriteCommandGuardResult` produced by the real
 * `BrokerWriteCommandGuard`, fed the safe Phase 6 default environment policy
 * (`PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY`) and nothing else. This
 * is guaranteed `allowed: false` -- it proves the guard currently denies
 * writes under the codebase's own safe-default environment, without this
 * test hand-authoring (mocking) the guard's decision.
 */
function currentlyDenyingGuardResult(): BrokerWriteCommandGuardResult {
  return new BrokerWriteCommandGuard().evaluate({
    commandType: "SUBMIT_ORDER",
    environment: PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY
  });
}

/**
 * The single most favorable `BrokerWriteCommandGuardResult` the real guard
 * can ever produce: every gate (approval, broker account, portfolio link,
 * compliance, capability, environment, kill switch, reconciliation) is fed a
 * genuinely passing fixture, using a fully permissive environment policy
 * (not the codebase's safe Phase 6 default). This is deliberately the
 * hardest case for `evaluateRuntimeLiveLockGate` to stay no-write against.
 */
function maximallyPermissiveGuardResult(): BrokerWriteCommandGuardResult {
  return new BrokerWriteCommandGuard().evaluate({
    commandType: "SUBMIT_ORDER",
    approval: new OrderApproval({
      id: "approval-1",
      orderIntent: approvedIntent(),
      riskCheck: passingRiskCheck(),
      moneyCheck: passingMoneyCheck(),
      status: "APPROVED",
      reasons: []
    }),
    brokerAccount: livePassingBrokerAccount(),
    portfolioLink: activePortfolioLink(),
    compliance: { allowed: true, reasons: [], limitations: [] },
    capabilityRegistry: supportedCapabilityRegistry(),
    requiredCapability: "US_STOCK_LIMIT_ORDER",
    environment: {
      environment: "production",
      liveBrokerWritesEnabled: true,
      allowedEnvironments: ["production"]
    },
    killSwitch: { active: false, scope: "GLOBAL" },
    reconciliation: cleanReconciliationReport(),
    now: NOW
  });
}

// ---------------------------------------------------------------------------
// Toss write preflight fixtures (Phase 9) -- mirrors
// tests/adapters/toss-write-preflight.test.ts's fixture shapes, duplicated
// locally per this codebase's existing per-file fixture convention.
// ---------------------------------------------------------------------------

function freshDate(offsetMs = -1000): Date {
  return new Date(NOW.getTime() + offsetMs);
}

function validKillSwitchRecheck(): TossWriteContractKillSwitchRecheck {
  return { checkedImmediatelyBeforeSubmission: true, active: false, scope: "GLOBAL", checkedAt: freshDate(-500) };
}

function validLiveBlockerEvidence(): TossWritePreflightLiveBlockerEvidenceSummary[] {
  return TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS.map((blockerId) => ({
    blockerId,
    humanReviewed: true,
    reviewerRole: "Compliance/legal reviewer (human)",
    reviewedAt: freshDate(-2000)
  }));
}

function validIdempotencyPolicy(): TossWritePreflightIdempotencyPolicyEvidence {
  return {
    policyDocumented: true,
    deterministicPerApprovalPerOperation: true,
    uniqueConstraintEnforced: true,
    persistedBeforeNetworkAttempt: true,
    regeneratedPerNetworkAttempt: false
  };
}

function validRedactionPolicy(): TossWritePreflightRedactionPolicyEvidence {
  return {
    policyDocumented: true,
    reusesSharedRedactObject: true,
    accountIdentifiersMaskedToLastFour: true,
    rawPayloadNeverLoggedInline: true,
    moneyAmountsCarryCurrency: true
  };
}

function validErrorNormalizationPolicy(): TossWritePreflightErrorNormalizationPolicyEvidence {
  return {
    policyDocumented: true,
    usesSharedNormalizedResultTaxonomy: true,
    ambiguousOutcomeMapsToUnknown: true,
    blindRetryPermitted: false,
    requiresReconciliationForcedWhenAmbiguous: true
  };
}

function validRawPayloadPolicy(): TossWritePreflightRawPayloadPolicyEvidence {
  return { policyDocumented: true, rawPayloadStorageAllowed: false, redactedBeforePersistence: true };
}

function readyTossWritePreflightResult() {
  return evaluateTossWritePreflight({
    now: NOW,
    commandType: "SUBMIT_ORDER",
    liveBlockerEvidence: validLiveBlockerEvidence(),
    guardResult: { allowed: true, commandType: "SUBMIT_ORDER", reasonCodes: [], safetyType: "BROKER_WRITE_COMMAND_GUARD_DECISION" },
    killSwitch: validKillSwitchRecheck(),
    reconciliation: cleanReconciliationReport(),
    idempotencyPolicy: validIdempotencyPolicy(),
    redactionPolicy: validRedactionPolicy(),
    errorNormalizationPolicy: validErrorNormalizationPolicy(),
    rawPayloadPolicy: validRawPayloadPolicy()
  });
}

// ---------------------------------------------------------------------------
// evaluateRuntimeLiveLockGate
// ---------------------------------------------------------------------------

describe("evaluateRuntimeLiveLockGate (Phase 10, P10-003)", () => {
  it("is a pure synchronous function, not a Promise-returning or network-touching call", () => {
    const report = evaluateRuntimeLiveLockGate({ now: NOW });
    expect(report).not.toBeInstanceOf(Promise);
    expect(typeof report).toBe("object");
  });

  it("fails closed on a fully empty input", () => {
    const report = evaluateRuntimeLiveLockGate({ now: NOW });

    expect(report.blockingAnomalyReasonCodes).toEqual(
      expect.arrayContaining([
        "missing_broker_write_guard_result",
        "missing_toss_future_write_contract_safety_report"
      ])
    );
    // Still hardcoded no-write, even on a fully empty (maximally dirty) input.
    expect(report.runtimeWriteLockEngaged).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it("rejects a missing or invalid evaluation time", () => {
    const report = evaluateRuntimeLiveLockGate({ now: new Date(Number.NaN) });
    expect(report.blockingAnomalyReasonCodes).toContain("missing_or_invalid_evaluation_time");
  });

  it("confirms the real BrokerWriteCommandGuard currently denies writes under the codebase's safe default environment policy", () => {
    const report = evaluateRuntimeLiveLockGate({
      now: NOW,
      brokerWriteGuardResult: currentlyDenyingGuardResult(),
      tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT
    });

    expect(report.auditSummary.brokerWriteGuardCurrentlyDenies).toBe(true);
    expect(report.blockingAnomalyReasonCodes).not.toContain("broker_write_guard_currently_allows_writes");
    expect(report.blockingAnomalyReasonCodes).toEqual([]);
    expect(report.runtimeWriteLockEngaged).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it("confirms the real, hardcoded TossFutureWriteContractSafetyReport is recognized as non-callable evidence", () => {
    const report = evaluateRuntimeLiveLockGate({
      now: NOW,
      brokerWriteGuardResult: currentlyDenyingGuardResult(),
      tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT
    });

    expect(report.auditSummary.tossFutureWriteContractNonCallableConfirmed).toBe(true);
    expect(report.blockingAnomalyReasonCodes).toEqual([]);
  });

  describe("runtimeWriteLockEngaged and liveBrokerWriteAllowed can never become false / true respectively", () => {
    it("(a) stay hard no-write even when every upstream readiness signal is maximally clean, including a real guard result that itself legitimately evaluates to allowed: true", () => {
      const permissiveGuardResult = maximallyPermissiveGuardResult();
      // Sanity: prove this really is the most favorable guard result the
      // real, non-mocked guard can produce for this command.
      expect(permissiveGuardResult.allowed).toBe(true);
      expect(permissiveGuardResult.reasonCodes).toEqual([]);

      const cleanPreflight = readyTossWritePreflightResult();
      expect(cleanPreflight.ready).toBe(true);
      expect(cleanPreflight.liveBrokerWriteAllowed).toBe(false);

      // The enablement gate's own liveBrokerWriteAllowed / readyForLiveBrokerWrites
      // fields are hardcoded literal `false` in every code path regardless of
      // how clean or dirty its input is (see small-capital-enablement-gate.ts
      // and tests/application/small-capital-enablement-gate.test.ts's own
      // "maximally clean input" proof) -- a minimal, real (non-mocked) call is
      // therefore already the strongest evidence available for this field.
      const enablementReport = evaluateSmallCapitalEnablementGate({ now: NOW });
      expect(enablementReport.liveBrokerWriteAllowed).toBe(false);
      expect(enablementReport.readyForLiveBrokerWrites).toBe(false);

      const report = evaluateRuntimeLiveLockGate({
        now: NOW,
        brokerWriteGuardResult: permissiveGuardResult,
        tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        tossWritePreflightResult: cleanPreflight,
        smallCapitalEnablementReport: enablementReport
      });

      // The property under test: even fed the single most favorable,
      // genuinely-computed (not mocked, not hand-authored) signal the real
      // guard can produce, this gate's own output never flips.
      expect(report.runtimeWriteLockEngaged).toBe(true);
      expect(report.liveBrokerWriteAllowed).toBe(false);
      expect(JSON.stringify(report)).not.toMatch(/"liveBrokerWriteAllowed":true/);
      expect(JSON.stringify(report)).not.toMatch(/"runtimeWriteLockEngaged":false/);

      // The permissive guard result is still surfaced for human review, per
      // docs/11_AI_RULES.md Rule 29 (do not hide unsafe/unknown behavior) --
      // it is reported, not silently accepted, but it never changes the
      // gate's own hardcoded output above.
      expect(report.blockingAnomalyReasonCodes).toContain("broker_write_guard_currently_allows_writes");
    });

    it("(b) detects a tampered liveBrokerWriteAllowed: true-shaped TossFutureWriteContractSafetyReport as blocking, not trusted", () => {
      const tamperedContractReport = {
        ...TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        liveBrokerWriteAllowed: true
      } as unknown as typeof TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT;

      const report = evaluateRuntimeLiveLockGate({
        now: NOW,
        brokerWriteGuardResult: currentlyDenyingGuardResult(),
        tossFutureWriteContractSafetyReport: tamperedContractReport
      });

      expect(report.blockingAnomalyReasonCodes).toContain(
        "toss_future_write_contract_report_live_broker_write_allowed_not_false"
      );
      expect(report.auditSummary.tossFutureWriteContractNonCallableConfirmed).toBe(false);
      // Still hard no-write, precisely because the tampered claim is detected
      // and rejected rather than trusted.
      expect(report.runtimeWriteLockEngaged).toBe(true);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("(b) detects a tampered liveBrokerWriteAllowed: true-shaped runtime approval signal (an 'everything is resolved' claim) as blocking, not trusted", () => {
      const tamperedApprovalSignal: RuntimeLiveLockGateApprovalSignal = {
        claimedLiveBrokerWriteAllowed: true,
        claimedFullyResolved: true
      };

      const input: RuntimeLiveLockGateInput = {
        now: NOW,
        brokerWriteGuardResult: currentlyDenyingGuardResult(),
        tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        runtimeApprovalSignals: [tamperedApprovalSignal]
      };

      const report = evaluateRuntimeLiveLockGate(input);

      expect(report.blockingAnomalyReasonCodes).toContain(
        "approval_signal_0_claims_live_broker_write_allowed_not_false"
      );
      expect(report.warnings).toContain("approval_signal_0_claims_fully_resolved");
      expect(report.auditSummary.approvalSignalCount).toBe(1);
      expect(report.auditSummary.tamperedApprovalSignalCount).toBe(1);
      // The tampered, "everything is resolved"-claiming approval signal is
      // detected and reported -- it never flips this gate's own output.
      expect(report.runtimeWriteLockEngaged).toBe(true);
      expect(report.liveBrokerWriteAllowed).toBe(false);
    });

    it("does not let a genuinely clean (non-tampered) runtime approval signal produce any blocking anomaly", () => {
      const genuineSignal: RuntimeLiveLockGateApprovalSignal = { claimedLiveBrokerWriteAllowed: false };

      const report = evaluateRuntimeLiveLockGate({
        now: NOW,
        brokerWriteGuardResult: currentlyDenyingGuardResult(),
        tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        runtimeApprovalSignals: [genuineSignal]
      });

      expect(report.blockingAnomalyReasonCodes).toEqual([]);
      expect(report.auditSummary.tamperedApprovalSignalCount).toBe(0);
    });

    it("cannot be forced to unlock even by a hand-constructed object that violates the report's own type", () => {
      const tampered = {
        ...evaluateRuntimeLiveLockGate({
          now: NOW,
          brokerWriteGuardResult: currentlyDenyingGuardResult(),
          tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT
        }),
        runtimeWriteLockEngaged: false,
        liveBrokerWriteAllowed: true
      };
      // This assignment only proves the *report shape* can be mutated by a
      // careless caller after the fact -- the evaluator itself never
      // produces this. Re-running the evaluator on the same input always
      // re-derives the hardcoded literals, which is the actual guarantee.
      expect(tampered.liveBrokerWriteAllowed).toBe(true); // caller-side mutation, not evaluator output
      const rerun = evaluateRuntimeLiveLockGate({
        now: NOW,
        brokerWriteGuardResult: currentlyDenyingGuardResult(),
        tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT
      });
      expect(rerun.runtimeWriteLockEngaged).toBe(true);
      expect(rerun.liveBrokerWriteAllowed).toBe(false);
    });
  });

  it("is frozen so no runtime caller can flip liveBrokerWriteAllowed or runtimeWriteLockEngaged in place", () => {
    const report = evaluateRuntimeLiveLockGate({
      now: NOW,
      brokerWriteGuardResult: currentlyDenyingGuardResult(),
      tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT
    });

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.auditSummary)).toBe(true);

    expect(() => {
      // @ts-expect-error liveBrokerWriteAllowed is a `false` literal type;
      // this line exists to prove both the type system and Object.freeze
      // reject an attempt to set it true.
      report.liveBrokerWriteAllowed = true;
    }).toThrow(TypeError);

    expect(() => {
      // @ts-expect-error runtimeWriteLockEngaged is a `true` literal type;
      // same proof for the lock-engaged flag.
      report.runtimeWriteLockEngaged = false;
    }).toThrow(TypeError);
  });

  it("includes the evidence-not-authorization statement verbatim", () => {
    const report = evaluateRuntimeLiveLockGate({ now: NOW });
    expect(report.evidenceOnlyStatement).toBe(RUNTIME_LIVE_LOCK_GATE_EVIDENCE_STATEMENT);
    expect(report.evidenceOnlyStatement).toMatch(/not, and can never become, authorization/i);
  });

  it("produces a sanitized, evidence-only audit summary that never carries a function value", () => {
    const report = evaluateRuntimeLiveLockGate({
      now: NOW,
      brokerWriteGuardResult: currentlyDenyingGuardResult(),
      tossFutureWriteContractSafetyReport: TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
      tossWritePreflightResult: readyTossWritePreflightResult(),
      smallCapitalEnablementReport: evaluateSmallCapitalEnablementGate({ now: NOW }),
      runtimeApprovalSignals: [{ claimedLiveBrokerWriteAllowed: false }]
    });

    for (const value of Object.values(report.auditSummary)) {
      expect(typeof value).not.toBe("function");
      expect(typeof value === "object" && value !== null).toBe(false);
    }
    expect(report.auditSummary.safetyType).toBe("RUNTIME_LIVE_LOCK_GATE_AUDIT_SUMMARY_EVIDENCE_ONLY");
  });

  it("rejects a wrong-safetyType guard result, contract report, preflight result, and enablement report as blocking anomalies", () => {
    const report = evaluateRuntimeLiveLockGate({
      now: NOW,
      brokerWriteGuardResult: {
        allowed: false,
        commandType: "SUBMIT_ORDER",
        reasonCodes: [],
        safetyType: "NOT_A_REAL_GUARD_DECISION"
      } as unknown as BrokerWriteCommandGuardResult,
      tossFutureWriteContractSafetyReport: {
        ...TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
        safetyType: "NOT_A_REAL_CONTRACT_REPORT"
      } as unknown as typeof TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT,
      tossWritePreflightResult: {
        ...readyTossWritePreflightResult(),
        safetyType: "NOT_A_REAL_PREFLIGHT_RESULT"
      } as unknown as ReturnType<typeof evaluateTossWritePreflight>,
      smallCapitalEnablementReport: {
        ...evaluateSmallCapitalEnablementGate({ now: NOW }),
        safetyType: "NOT_A_REAL_ENABLEMENT_REPORT"
      } as unknown as ReturnType<typeof evaluateSmallCapitalEnablementGate>
    });

    expect(report.blockingAnomalyReasonCodes).toEqual(
      expect.arrayContaining([
        "broker_write_guard_result_wrong_safety_type",
        "toss_future_write_contract_report_wrong_safety_type",
        "toss_write_preflight_result_wrong_safety_type",
        "small_capital_enablement_report_wrong_safety_type"
      ])
    );
    expect(report.runtimeWriteLockEngaged).toBe(true);
    expect(report.liveBrokerWriteAllowed).toBe(false);
  });

  it("exposes no network-capable, order-shaped, or otherwise callable runtime value from this module", async () => {
    const moduleExports: Record<string, unknown> = await import(
      "../../src/application/live-readiness/runtime-live-lock-gate.js"
    );

    for (const [name, value] of Object.entries(moduleExports)) {
      if (typeof value === "function") {
        expect(name).toBe("evaluateRuntimeLiveLockGate");
      }
    }

    expect(JSON.stringify(Object.keys(moduleExports))).not.toMatch(
      /submitOrder|cancelOrder|replaceOrder|placeOrder|fetch|axios|undici/i
    );
  });
});

// ---------------------------------------------------------------------------
// Future Toss write contract stays structurally uncallable from this
// module's own vantage point, duplicating (not replacing) the proof already
// established in tests/adapters/toss-write-contract.test.ts, so a regression
// that widens `command: never` is caught here too.
// ---------------------------------------------------------------------------

describe("TossFutureWriteAdapter stays structurally uncallable (re-checked from the P10-003 runtime lock gate's test suite)", () => {
  class ThrowingTossFutureWriteAdapter implements TossFutureWriteAdapter {
    submitOrder(_command: never): Promise<never> {
      throw new Error("TossFutureWriteAdapter.submitOrder must never be called; still design-only in Phase 10.");
    }
    cancelOrder(_command: never): Promise<never> {
      throw new Error("TossFutureWriteAdapter.cancelOrder must never be called; still design-only in Phase 10.");
    }
    replaceOrder(_command: never): Promise<never> {
      throw new Error("TossFutureWriteAdapter.replaceOrder must never be called; still design-only in Phase 10.");
    }
  }

  it("rejects an order-shaped argument to submitOrder/cancelOrder/replaceOrder at compile time (command: never)", () => {
    const adapter: TossFutureWriteAdapter = new ThrowingTossFutureWriteAdapter();
    const orderShapedCommand = { assetId: "asset-1", side: "BUY", quantity: "1", orderType: "LIMIT" };

    // @ts-expect-error - TossFutureWriteAdapter.submitOrder's parameter is
    // typed `never`; no order-shaped value is assignable to it without an
    // explicit `as never` cast. If a future change ever widens this
    // parameter type to something callable, this directive becomes "unused"
    // and `npm run typecheck` fails, catching the regression at the exact
    // boundary Phase 10 must not cross.
    expect(() => adapter.submitOrder(orderShapedCommand)).toThrow(/must never be called/);
    // @ts-expect-error - same proof for cancelOrder.
    expect(() => adapter.cancelOrder(orderShapedCommand)).toThrow(/must never be called/);
    // @ts-expect-error - same proof for replaceOrder.
    expect(() => adapter.replaceOrder(orderShapedCommand)).toThrow(/must never be called/);
  });

  it("throws rather than silently succeeding if a caller forces a call through an explicit `as never` cast", () => {
    const adapter: TossFutureWriteAdapter = new ThrowingTossFutureWriteAdapter();

    expect(() => adapter.submitOrder(undefined as never)).toThrow(/must never be called/);
    expect(() => adapter.cancelOrder(undefined as never)).toThrow(/must never be called/);
    expect(() => adapter.replaceOrder(undefined as never)).toThrow(/must never be called/);
  });
});
