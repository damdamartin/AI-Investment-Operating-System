import { describe, expect, it } from "vitest";
import {
  Currency,
  FIRST_TRADE_PROTOCOL_TOPICS,
  Money,
  REQUIRED_FIRST_TRADE_ATTESTATIONS,
  evaluateFirstTradeOperatingProtocol,
  type FirstTradeKillSwitchReadinessSignal,
  type FirstTradeOperatingProtocolInput,
  type FirstTradeProtocolAttestation,
  type FirstTradeProtocolTopic,
  type FirstTradeRollbackReconciliationRehearsalSignal,
  type FirstTradeStopCriteria
} from "../../src/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");
const KRW = Currency.from("KRW");

function krw(amount: string): Money {
  return Money.fromMajor(amount, KRW);
}

function cleanAttestation(topic: FirstTradeProtocolTopic, overrides: Partial<FirstTradeProtocolAttestation> = {}): FirstTradeProtocolAttestation {
  return {
    confirmed: true,
    statement: REQUIRED_FIRST_TRADE_ATTESTATIONS[topic],
    attestedByName: "Jun Kim",
    attestedByRole: "Operator/Owner",
    attestedAt: new Date("2026-07-28T00:00:00Z"),
    ...overrides
  };
}

function cleanAttestations(): FirstTradeOperatingProtocolInput["attestations"] {
  const attestations: FirstTradeOperatingProtocolInput["attestations"] = {};
  for (const topic of FIRST_TRADE_PROTOCOL_TOPICS) {
    attestations[topic] = cleanAttestation(topic);
  }
  return attestations;
}

function cleanKillSwitchReadiness(): FirstTradeKillSwitchReadinessSignal {
  return { allowed: true, blocksNewOrders: false, reasonCodes: [] };
}

function cleanRehearsal(): FirstTradeRollbackReconciliationRehearsalSignal {
  return { rehearsed: true, liveReadinessBlocked: false, stale: false, reasonCodes: [] };
}

function cleanStopCriteria(): FirstTradeStopCriteria {
  return {
    stopsAfterFirstTrade: true,
    description: "Trading halts automatically after the first fill; I personally review fills, reconciliation, and slippage before recording a decision to continue."
  };
}

function cleanInput(overrides: Partial<FirstTradeOperatingProtocolInput> = {}): FirstTradeOperatingProtocolInput {
  return {
    now: NOW,
    attestations: cleanAttestations(),
    maxTotalCapitalExposure: krw("3000000"),
    maxOrderAmount: krw("300000"),
    strategyIds: ["strategy-alpha"],
    killSwitchReadiness: cleanKillSwitchReadiness(),
    rollbackReconciliationRehearsal: cleanRehearsal(),
    stopCriteria: cleanStopCriteria(),
    ...overrides
  };
}

describe("evaluateFirstTradeOperatingProtocol", () => {
  it("reports READY_FOR_HUMAN_REVIEW when every checklist item is clean", () => {
    const report = evaluateFirstTradeOperatingProtocol(cleanInput());

    expect(report.status).toBe("READY_FOR_HUMAN_REVIEW");
    expect(report.readyForHumanReview).toBe(true);
    expect(report.blockingReasonCodes).toEqual([]);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.automaticFirstTradeAllowed).toBe(false);
    expect(report.safetyType).toBe("FIRST_TRADE_OPERATING_PROTOCOL_REPORT_EVALUATION_ONLY");
    expect(report.protocolStatement.length).toBeGreaterThan(0);
    expect(report.generatedAt).toEqual(NOW);
  });

  it("never sets liveBrokerWriteAllowed or automaticFirstTradeAllowed to true under any input", () => {
    const dirtyInput = cleanInput({ attestations: {}, killSwitchReadiness: undefined });
    const report = evaluateFirstTradeOperatingProtocol(dirtyInput);

    expect(report.readyForHumanReview).toBe(false);
    expect(report.liveBrokerWriteAllowed).toBe(false);
    expect(report.automaticFirstTradeAllowed).toBe(false);
  });

  it("never produces an executable broker command shape (symbol/quantity/side/price) anywhere in the report", () => {
    const report = evaluateFirstTradeOperatingProtocol(cleanInput());
    const serialized = JSON.stringify(report).toLowerCase();

    for (const forbiddenKey of ["symbol", "quantity", "side", "\"price\"", "ticker"]) {
      expect(serialized).not.toContain(forbiddenKey);
    }
  });

  it("fails closed when evaluation time is missing or invalid", () => {
    // @ts-expect-error deliberately invalid input for a fail-closed test
    const report = evaluateFirstTradeOperatingProtocol(cleanInput({ now: undefined }));
    expect(report.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
    expect(report.status).toBe("NOT_READY_FOR_HUMAN_REVIEW");
  });

  describe("per-topic attestations", () => {
    it.each(FIRST_TRADE_PROTOCOL_TOPICS)("blocks when the %s attestation is missing entirely", (topic) => {
      const attestations = cleanAttestations();
      delete attestations[topic];

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.readyForHumanReview).toBe(false);
      expect(report.blockingReasonCodes).toContain(`missing_attestation_${topic}`);
    });

    it.each(FIRST_TRADE_PROTOCOL_TOPICS)("blocks when the %s attestation is not confirmed", (topic) => {
      const attestations = cleanAttestations();
      attestations[topic] = cleanAttestation(topic, { confirmed: false });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain(`attestation_not_confirmed_${topic}`);
    });

    it.each(FIRST_TRADE_PROTOCOL_TOPICS)("blocks when the %s statement does not match verbatim", (topic) => {
      const attestations = cleanAttestations();
      attestations[topic] = cleanAttestation(topic, { statement: "I agree." });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain(`attestation_statement_mismatch_${topic}`);
    });

    it("blocks when an attester name is blank", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", { attestedByName: "   " });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain("attestation_missing_attester_name_kill_switch_readiness");
    });

    it("blocks when an attester role is blank", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", { attestedByRole: "" });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain("attestation_missing_attester_role_kill_switch_readiness");
    });

    it("blocks when the attested-at timestamp is missing or invalid", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", {
        attestedAt: new Date("not-a-date")
      });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain("attestation_missing_attested_at_kill_switch_readiness");
    });

    it("blocks when the attested-at timestamp is in the future relative to now", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", {
        attestedAt: new Date("2026-08-01T00:00:00Z")
      });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain("attestation_attested_at_in_future_kill_switch_readiness");
    });

    it("blocks when an attester name claims to be an AI system", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", { attestedByName: "Claude" });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain(
        "protocol_attester_identity_not_human_attester_name_kill_switch_readiness"
      );
    });

    it("blocks when an attester role claims to be an automated system", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", {
        attestedByRole: "Automated Agent"
      });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(report.blockingReasonCodes).toContain(
        "protocol_attester_identity_not_human_attester_role_kill_switch_readiness"
      );
    });

    it("blocks and flags secret-like content typed into an attester name", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", {
        attestedByName: "api_key=sk-live-abcdef123456"
      });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(
        report.blockingReasonCodes.some((code) => code.startsWith("protocol_input_may_contain_secret_"))
      ).toBe(true);
    });

    it("blocks and flags account-identifier-like content typed into an attester name", () => {
      const attestations = cleanAttestations();
      attestations.kill_switch_readiness = cleanAttestation("kill_switch_readiness", {
        attestedByName: "Reviewer 1234567890"
      });

      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ attestations }));

      expect(
        report.blockingReasonCodes.some((code) => code.startsWith("protocol_input_may_contain_account_identifier_"))
      ).toBe(true);
    });
  });

  describe("limited capital mode and maximum order amount policy", () => {
    it("blocks when maxTotalCapitalExposure is missing", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ maxTotalCapitalExposure: undefined }));
      expect(report.blockingReasonCodes).toContain("missing_max_total_capital_exposure");
    });

    it("blocks when maxTotalCapitalExposure is zero", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ maxTotalCapitalExposure: krw("0") }));
      expect(report.blockingReasonCodes).toContain("invalid_max_total_capital_exposure");
    });

    it("blocks when maxOrderAmount is missing", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ maxOrderAmount: undefined }));
      expect(report.blockingReasonCodes).toContain("missing_max_order_amount");
    });

    it("blocks when maxOrderAmount is negative", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ maxOrderAmount: krw("-100") }));
      expect(report.blockingReasonCodes).toContain("invalid_max_order_amount");
    });
  });

  describe("single-strategy or narrow strategy set", () => {
    it("blocks when strategyIds is missing", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ strategyIds: undefined }));
      expect(report.blockingReasonCodes).toContain("missing_strategy_set");
    });

    it("blocks when strategyIds is empty", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ strategyIds: [] }));
      expect(report.blockingReasonCodes).toContain("missing_strategy_set");
    });

    it("blocks when the strategy set is not narrow", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({ strategyIds: ["a", "b", "c", "d", "e"] })
      );
      expect(report.blockingReasonCodes).toContain("strategy_set_not_narrow");
    });

    it("blocks when the strategy set contains a duplicate id", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ strategyIds: ["alpha", "alpha"] }));
      expect(report.blockingReasonCodes).toContain("strategy_set_contains_duplicate_id");
    });

    it("blocks when the strategy set contains a blank id", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ strategyIds: ["alpha", "   "] }));
      expect(report.blockingReasonCodes).toContain("strategy_set_contains_blank_id");
    });

    it("allows exactly the narrow-strategy ceiling", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ strategyIds: ["a", "b", "c"] }));
      expect(report.blockingReasonCodes).not.toContain("strategy_set_not_narrow");
    });
  });

  describe("kill-switch readiness fails closed", () => {
    it("blocks when the kill-switch readiness signal is missing, even if the attestation is confirmed", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ killSwitchReadiness: undefined }));

      expect(report.blockingReasonCodes).toContain("missing_kill_switch_readiness_signal");
      expect(report.readyForHumanReview).toBe(false);
    });

    it("blocks when the kill switch does not allow trading", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({ killSwitchReadiness: { allowed: false, blocksNewOrders: true, reasonCodes: ["kill_switch_active_global"] } })
      );

      expect(report.blockingReasonCodes).toContain("kill_switch_not_ready_for_first_trade");
    });

    it("blocks when the kill switch blocks new orders even if allowed is true", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({ killSwitchReadiness: { allowed: true, blocksNewOrders: true, reasonCodes: [] } })
      );

      expect(report.blockingReasonCodes).toContain("kill_switch_not_ready_for_first_trade");
    });

    it("a confirmed attestation alone cannot substitute for a not-ready real signal", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({ killSwitchReadiness: { allowed: false, blocksNewOrders: true, reasonCodes: [] } })
      );

      // attestation itself is clean (from cleanInput), but the real signal still blocks
      expect(report.blockingReasonCodes).not.toContain("missing_attestation_kill_switch_readiness");
      expect(report.blockingReasonCodes).toContain("kill_switch_not_ready_for_first_trade");
      expect(report.readyForHumanReview).toBe(false);
    });
  });

  describe("rollback/reconciliation rehearsal commitment fails closed", () => {
    it("blocks when the rehearsal signal is missing, even if the attestation is confirmed", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ rollbackReconciliationRehearsal: undefined }));

      expect(report.blockingReasonCodes).toContain("missing_rollback_reconciliation_rehearsal_signal");
      expect(report.readyForHumanReview).toBe(false);
    });

    it("blocks when the rehearsal was not actually completed", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({
          rollbackReconciliationRehearsal: { rehearsed: false, liveReadinessBlocked: false, stale: false, reasonCodes: [] }
        })
      );

      expect(report.blockingReasonCodes).toContain("rollback_reconciliation_rehearsal_not_completed");
    });

    it("blocks when reconciliation is not fully resolved", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({
          rollbackReconciliationRehearsal: { rehearsed: true, liveReadinessBlocked: true, stale: false, reasonCodes: [] }
        })
      );

      expect(report.blockingReasonCodes).toContain("reconciliation_not_fully_resolved");
    });

    it("blocks when the reconciliation signal is stale", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({
          rollbackReconciliationRehearsal: { rehearsed: true, liveReadinessBlocked: false, stale: true, reasonCodes: [] }
        })
      );

      expect(report.blockingReasonCodes).toContain("reconciliation_stale");
    });
  });

  describe("stop criteria after first trade fails closed", () => {
    it("blocks when stop criteria is missing entirely, even if the attestation is confirmed", () => {
      const report = evaluateFirstTradeOperatingProtocol(cleanInput({ stopCriteria: undefined }));

      expect(report.blockingReasonCodes).toContain("missing_stop_criteria");
      expect(report.readyForHumanReview).toBe(false);
    });

    it("blocks when stopsAfterFirstTrade is not literally true", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({ stopCriteria: { stopsAfterFirstTrade: false, description: "We will keep trading." } })
      );

      expect(report.blockingReasonCodes).toContain("stop_criteria_does_not_stop_after_first_trade");
    });

    it("blocks when the stop criteria description is blank", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({ stopCriteria: { stopsAfterFirstTrade: true, description: "   " } })
      );

      expect(report.blockingReasonCodes).toContain("stop_criteria_missing_description");
    });

    it("blocks and flags secret-like content in the stop criteria description", () => {
      const report = evaluateFirstTradeOperatingProtocol(
        cleanInput({
          stopCriteria: {
            stopsAfterFirstTrade: true,
            description: "Reference access_token=abc123 in the incident channel."
          }
        })
      );

      expect(
        report.blockingReasonCodes.some((code) => code.startsWith("protocol_input_may_contain_secret_"))
      ).toBe(true);
    });
  });

  it("accumulates multiple independent blocking reasons at once", () => {
    const report = evaluateFirstTradeOperatingProtocol(
      cleanInput({
        attestations: {},
        maxTotalCapitalExposure: undefined,
        maxOrderAmount: undefined,
        strategyIds: undefined,
        killSwitchReadiness: undefined,
        rollbackReconciliationRehearsal: undefined,
        stopCriteria: undefined
      })
    );

    expect(report.status).toBe("NOT_READY_FOR_HUMAN_REVIEW");
    for (const topic of FIRST_TRADE_PROTOCOL_TOPICS) {
      expect(report.blockingReasonCodes).toContain(`missing_attestation_${topic}`);
    }
    expect(report.blockingReasonCodes).toContain("missing_max_total_capital_exposure");
    expect(report.blockingReasonCodes).toContain("missing_max_order_amount");
    expect(report.blockingReasonCodes).toContain("missing_strategy_set");
    expect(report.blockingReasonCodes).toContain("missing_kill_switch_readiness_signal");
    expect(report.blockingReasonCodes).toContain("missing_rollback_reconciliation_rehearsal_signal");
    expect(report.blockingReasonCodes).toContain("missing_stop_criteria");
  });
});
