import { describe, expect, it } from "vitest";
import {
  Currency,
  Money,
  OWNER_RISK_EVIDENCE_PACKET_TOPICS,
  REQUIRED_OWNER_RISK_ATTESTATIONS,
  REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION,
  evaluateOwnerRiskEvidencePacket,
  type OwnerRiskDailyReviewCommitment,
  type OwnerRiskEvidencePacketDecision,
  type OwnerRiskEvidencePacketHumanReviewer,
  type OwnerRiskEvidencePacketInput,
  type OwnerRiskEvidencePacketTopic,
  type OwnerRiskPacketAttestation,
  type OwnerRiskStopCriteria
} from "../../src/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");
const KRW = Currency.from("KRW");

function krw(amount: string): Money {
  return Money.fromMajor(amount, KRW);
}

function cleanAttestation(topic: OwnerRiskEvidencePacketTopic, overrides: Partial<OwnerRiskPacketAttestation> = {}): OwnerRiskPacketAttestation {
  return {
    confirmed: true,
    statement: REQUIRED_OWNER_RISK_ATTESTATIONS[topic],
    attestedByName: "Jun Kim",
    attestedByRole: "Project owner",
    attestedAt: new Date("2026-07-28T00:00:00Z"),
    ...overrides
  };
}

function cleanAttestations(): OwnerRiskEvidencePacketInput["attestations"] {
  const attestations: OwnerRiskEvidencePacketInput["attestations"] = {};
  for (const topic of OWNER_RISK_EVIDENCE_PACKET_TOPICS) {
    attestations[topic] = cleanAttestation(topic);
  }
  return attestations;
}

function cleanDailyReviewCommitment(): OwnerRiskDailyReviewCommitment {
  return {
    commitsToDailyReview: true,
    description: "I personally reconcile positions, cash, and open orders every trading day before market open."
  };
}

function cleanStopCriteria(): OwnerRiskStopCriteria {
  return {
    stopsForReviewOnBreach: true,
    description: "Trading halts automatically if any declared limit is breached; I personally review before resuming."
  };
}

function cleanReviewer(overrides: Partial<OwnerRiskEvidencePacketHumanReviewer> = {}): OwnerRiskEvidencePacketHumanReviewer {
  return {
    name: "Jun Kim",
    role: "Project owner / risk owner",
    reviewDate: new Date("2026-07-28T00:00:00Z"),
    decision: "READY_FOR_HUMAN_REVIEW",
    limitations: "Covers KR market only; US market limits not yet declared.",
    expirationOrNextReviewDate: new Date("2026-08-28T00:00:00Z"),
    ...overrides
  };
}

function cleanInput(overrides: Partial<OwnerRiskEvidencePacketInput> = {}): OwnerRiskEvidencePacketInput {
  return {
    now: NOW,
    packetId: "owner-risk-packet-example-001",
    evidenceSourceReferences: ["docs/phase7/manual-live-approval-record.md", "docs/phase7/small-capital-readiness-gates.md"],
    attestations: cleanAttestations(),
    maxTotalCapitalPolicy: krw("3000000"),
    maxPerOrderPolicy: krw("300000"),
    allowedStrategyIds: ["strategy-alpha"],
    dailyReviewCommitment: cleanDailyReviewCommitment(),
    stopCriteria: cleanStopCriteria(),
    humanReviewer: cleanReviewer(),
    prohibitedContentConfirmedByPreparer: true,
    ...overrides
  };
}

describe("evaluateOwnerRiskEvidencePacket", () => {
  it("reports packetEvidenceComplete when every field is clean and decision is READY_FOR_HUMAN_REVIEW", () => {
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput());

    expect(packet.packetEvidenceComplete).toBe(true);
    expect(packet.blockingReasonCodes).toEqual([]);
    expect(packet.coveredBlockerIds).toEqual(["LCB-004", "LCB-006"]);
    expect(packet.decision).toBe("READY_FOR_HUMAN_REVIEW");
    expect(packet.liveBrokerWriteAllowed).toBe(false);
    expect(packet.safetyType).toBe("OWNER_RISK_EVIDENCE_PACKET_EVIDENCE_ONLY");
    expect(packet.packetStatement.length).toBeGreaterThan(0);
    expect(packet.generatedAt).toEqual(NOW);
  });

  it("never uses the literal RESOLVED anywhere in its serialized output", () => {
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput());
    const serialized = JSON.stringify(packet);
    expect(serialized).not.toContain("RESOLVED");
  });

  it("never produces an executable broker command shape (symbol/quantity/side/price) anywhere in the report", () => {
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput());
    const serialized = JSON.stringify(packet).toLowerCase();

    for (const forbiddenKey of ["symbol", "quantity", "\"side\"", "\"price\"", "ticker"]) {
      expect(serialized).not.toContain(forbiddenKey);
    }
  });

  it("never sets liveBrokerWriteAllowed to true under any input, even a maximally clean one", () => {
    const packet = evaluateOwnerRiskEvidencePacket(
      cleanInput({ humanReviewer: cleanReviewer({ decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS", reviewerAttestation: REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION }) })
    );

    expect(packet.liveBrokerWriteAllowed).toBe(false);
  });

  it("fails closed when evaluation time is missing or invalid", () => {
    // @ts-expect-error deliberately invalid input for a fail-closed test
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ now: undefined }));
    expect(packet.blockingReasonCodes).toContain("missing_or_invalid_evaluation_time");
    expect(packet.packetEvidenceComplete).toBe(false);
  });

  it("blocks when packetId is missing", () => {
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ packetId: "   " }));
    expect(packet.blockingReasonCodes).toContain("missing_packet_id");
  });

  it("blocks when evidenceSourceReferences is empty", () => {
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ evidenceSourceReferences: [] }));
    expect(packet.blockingReasonCodes).toContain("missing_evidence_source_references");
  });

  it("blocks and flags an evidence source reference that looks like a secret", () => {
    const packet = evaluateOwnerRiskEvidencePacket(
      cleanInput({ evidenceSourceReferences: ["client_secret: abc123def456"] })
    );
    expect(packet.blockingReasonCodes).toContain("packet_input_may_contain_secret_evidence_source_reference_0");
  });

  it("blocks and flags an evidence source reference that looks like an account number", () => {
    const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ evidenceSourceReferences: ["account ref 1234567890"] }));
    expect(packet.blockingReasonCodes).toContain("packet_input_may_contain_account_identifier_evidence_source_reference_0");
  });

  describe("per-topic attestations", () => {
    it.each(OWNER_RISK_EVIDENCE_PACKET_TOPICS)("blocks when the %s attestation is missing entirely", (topic) => {
      const attestations = cleanAttestations();
      delete attestations[topic];

      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ attestations }));

      expect(packet.packetEvidenceComplete).toBe(false);
      expect(packet.blockingReasonCodes).toContain(`missing_attestation_${topic}`);
    });

    it.each(OWNER_RISK_EVIDENCE_PACKET_TOPICS)("blocks when the %s attestation is not confirmed", (topic) => {
      const attestations = cleanAttestations();
      attestations[topic] = cleanAttestation(topic, { confirmed: false });

      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ attestations }));

      expect(packet.blockingReasonCodes).toContain(`attestation_not_confirmed_${topic}`);
    });

    it.each(OWNER_RISK_EVIDENCE_PACKET_TOPICS)("blocks when the %s statement does not match verbatim", (topic) => {
      const attestations = cleanAttestations();
      attestations[topic] = cleanAttestation(topic, { statement: "I agree." });

      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ attestations }));

      expect(packet.blockingReasonCodes).toContain(`attestation_statement_mismatch_${topic}`);
    });

    it("blocks when an attester name is blank", () => {
      const attestations = cleanAttestations();
      attestations.human_approval_intent = cleanAttestation("human_approval_intent", { attestedByName: "   " });

      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ attestations }));

      expect(packet.blockingReasonCodes).toContain("attestation_missing_attester_name_human_approval_intent");
    });

    it("blocks when an attester identity claims to be an AI/automated system", () => {
      const attestations = cleanAttestations();
      attestations.human_approval_intent = cleanAttestation("human_approval_intent", { attestedByName: "Claude (AI Assistant)" });

      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ attestations }));

      expect(packet.blockingReasonCodes).toContain("packet_identity_not_human_attester_name_human_approval_intent");
    });

    it("blocks when an attestation is attested in the future", () => {
      const attestations = cleanAttestations();
      attestations.human_approval_intent = cleanAttestation("human_approval_intent", {
        attestedAt: new Date("2099-01-01T00:00:00Z")
      });

      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ attestations }));

      expect(packet.blockingReasonCodes).toContain("attestation_attested_at_in_future_human_approval_intent");
    });
  });

  describe("capital policy declarations", () => {
    it("blocks and reports MISSING when maxTotalCapitalPolicy is absent", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ maxTotalCapitalPolicy: undefined }));

      expect(packet.blockingReasonCodes).toContain("missing_max_total_capital_policy");
      expect(packet.maxTotalCapitalPolicy.status).toBe("MISSING");
      expect(packet.maxTotalCapitalPolicy.declaredValue).toBeNull();
    });

    it("blocks when maxPerOrderPolicy is zero", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ maxPerOrderPolicy: krw("0") }));

      expect(packet.blockingReasonCodes).toContain("invalid_max_per_order_policy");
      expect(packet.maxPerOrderPolicy.status).toBe("MISSING");
    });

    it("blocks when maxTotalCapitalPolicy is negative", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ maxTotalCapitalPolicy: krw("-1") }));

      expect(packet.blockingReasonCodes).toContain("invalid_max_total_capital_policy");
    });

    it("reports declared values verbatim without inventing or defaulting a number", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ maxTotalCapitalPolicy: krw("3000000"), maxPerOrderPolicy: krw("300000") }));

      expect(packet.maxTotalCapitalPolicy.declaredValue).toEqual({ amountMajor: "3000000", currency: "KRW" });
      expect(packet.maxPerOrderPolicy.declaredValue).toEqual({ amountMajor: "300000", currency: "KRW" });
    });

    it("reports PROPOSED_PENDING_HUMAN_DECISION when the value is valid but the reviewer decision is READY_FOR_HUMAN_REVIEW", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput());

      expect(packet.maxTotalCapitalPolicy.status).toBe("PROPOSED_PENDING_HUMAN_DECISION");
      expect(packet.maxPerOrderPolicy.status).toBe("PROPOSED_PENDING_HUMAN_DECISION");
    });

    it("reports PROPOSED_PENDING_HUMAN_DECISION -- never HUMAN_APPROVED -- when decision claims approval but the reviewer attestation is missing", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({ humanReviewer: cleanReviewer({ decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS" }) })
      );

      expect(packet.blockingReasonCodes).toContain("human_reviewer_attestation_mismatch");
      expect(packet.maxTotalCapitalPolicy.status).toBe("PROPOSED_PENDING_HUMAN_DECISION");
      expect(packet.maxPerOrderPolicy.status).toBe("PROPOSED_PENDING_HUMAN_DECISION");
    });

    it("reports HUMAN_APPROVED_WITH_LIMITATIONS only once the reviewer record is fully valid and attested", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({
          humanReviewer: cleanReviewer({
            decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS",
            reviewerAttestation: REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION
          })
        })
      );

      expect(packet.blockingReasonCodes).toEqual([]);
      expect(packet.maxTotalCapitalPolicy.status).toBe("HUMAN_APPROVED_WITH_LIMITATIONS");
      expect(packet.maxPerOrderPolicy.status).toBe("HUMAN_APPROVED_WITH_LIMITATIONS");
      expect(packet.packetEvidenceComplete).toBe(true);
    });

    it("reports HUMAN_REJECTED when decision is HUMAN_REVIEWED_REJECTED and the reviewer record is valid", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({
          humanReviewer: cleanReviewer({
            decision: "HUMAN_REVIEWED_REJECTED",
            reviewerAttestation: REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION
          })
        })
      );

      expect(packet.maxTotalCapitalPolicy.status).toBe("HUMAN_REJECTED");
    });

    it("reports HUMAN_MARKED_UNVERIFIED when decision is HUMAN_REVIEWED_UNVERIFIED and the reviewer record is valid", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({
          humanReviewer: cleanReviewer({
            decision: "HUMAN_REVIEWED_UNVERIFIED",
            reviewerAttestation: REQUIRED_OWNER_RISK_REVIEWER_ATTESTATION
          })
        })
      );

      expect(packet.maxTotalCapitalPolicy.status).toBe("HUMAN_MARKED_UNVERIFIED");
    });
  });

  describe("allowed strategy set", () => {
    it("blocks when the strategy set is empty", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ allowedStrategyIds: [] }));
      expect(packet.blockingReasonCodes).toContain("missing_allowed_strategy_set");
    });

    it("blocks when the strategy set exceeds the narrow-set ceiling", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({ allowedStrategyIds: ["strategy-a", "strategy-b", "strategy-c", "strategy-d"] })
      );
      expect(packet.blockingReasonCodes).toContain("allowed_strategy_set_not_narrow");
    });

    it("blocks when the strategy set contains a duplicate id", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ allowedStrategyIds: ["strategy-a", "strategy-a"] }));
      expect(packet.blockingReasonCodes).toContain("allowed_strategy_set_contains_duplicate_id");
    });
  });

  describe("daily review commitment and stop criteria", () => {
    it("blocks when daily review commitment is missing", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ dailyReviewCommitment: undefined }));
      expect(packet.blockingReasonCodes).toContain("missing_daily_review_commitment");
    });

    it("blocks when daily review commitment is not confirmed", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({ dailyReviewCommitment: { ...cleanDailyReviewCommitment(), commitsToDailyReview: false } })
      );
      expect(packet.blockingReasonCodes).toContain("daily_review_commitment_not_confirmed");
    });

    it("blocks when stop criteria does not stop for review on breach", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ stopCriteria: { ...cleanStopCriteria(), stopsForReviewOnBreach: false } }));
      expect(packet.blockingReasonCodes).toContain("stop_criteria_does_not_stop_for_review");
    });

    it("blocks when stop criteria description is blank", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ stopCriteria: { ...cleanStopCriteria(), description: "" } }));
      expect(packet.blockingReasonCodes).toContain("stop_criteria_missing_description");
    });
  });

  describe("human reviewer", () => {
    it("blocks when the human reviewer record is entirely missing", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ humanReviewer: undefined }));
      expect(packet.blockingReasonCodes).toContain("missing_human_reviewer");
      expect(packet.decision).toBeUndefined();
    });

    it("blocks when the reviewer decision is not one of the five allowed values", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({ humanReviewer: cleanReviewer({ decision: "APPROVED" as OwnerRiskEvidencePacketDecision }) })
      );
      expect(packet.blockingReasonCodes).toContain("missing_or_invalid_decision");
    });

    it("blocks when limitations are missing", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ humanReviewer: cleanReviewer({ limitations: "" }) }));
      expect(packet.blockingReasonCodes).toContain("missing_limitations");
    });

    it("blocks when expirationOrNextReviewDate is not after reviewDate", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({
          humanReviewer: cleanReviewer({
            reviewDate: new Date("2026-07-28T00:00:00Z"),
            expirationOrNextReviewDate: new Date("2026-07-01T00:00:00Z")
          })
        })
      );
      expect(packet.blockingReasonCodes).toContain("expiration_or_next_review_date_not_after_review_date");
    });

    it("blocks when reviewer name claims to be an AI/automated system", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ humanReviewer: cleanReviewer({ name: "Codex Review Bot" }) }));
      expect(packet.blockingReasonCodes).toContain("packet_identity_not_human_human_reviewer_name");
    });

    it("requires reviewerAttestation verbatim for HUMAN_REVIEWED_* decisions but not for READY_FOR_HUMAN_REVIEW or NEEDS_MORE_EVIDENCE", () => {
      const readyPacket = evaluateOwnerRiskEvidencePacket(cleanInput({ humanReviewer: cleanReviewer({ decision: "READY_FOR_HUMAN_REVIEW" }) }));
      expect(readyPacket.blockingReasonCodes).not.toContain("human_reviewer_attestation_mismatch");

      const needsMorePacket = evaluateOwnerRiskEvidencePacket(cleanInput({ humanReviewer: cleanReviewer({ decision: "NEEDS_MORE_EVIDENCE" }) }));
      expect(needsMorePacket.blockingReasonCodes).not.toContain("human_reviewer_attestation_mismatch");

      const rejectedWithoutAttestation = evaluateOwnerRiskEvidencePacket(
        cleanInput({ humanReviewer: cleanReviewer({ decision: "HUMAN_REVIEWED_REJECTED" }) })
      );
      expect(rejectedWithoutAttestation.blockingReasonCodes).toContain("human_reviewer_attestation_mismatch");
    });
  });

  describe("prohibited content confirmation", () => {
    it("blocks when prohibitedContentConfirmedByPreparer is not exactly true", () => {
      const packet = evaluateOwnerRiskEvidencePacket(cleanInput({ prohibitedContentConfirmedByPreparer: false }));
      expect(packet.blockingReasonCodes).toContain("prohibited_content_confirmation_missing");
    });

    it("still blocks on an automatic scan match even when the preparer confirmation is true", () => {
      const packet = evaluateOwnerRiskEvidencePacket(
        cleanInput({
          prohibitedContentConfirmedByPreparer: true,
          humanReviewer: cleanReviewer({ limitations: "api_key: sk-1234567890abcdef" })
        })
      );
      expect(packet.blockingReasonCodes).toContain("packet_input_may_contain_secret_limitations");
    });
  });
});
