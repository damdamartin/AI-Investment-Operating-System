import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidencePlan,
  type TossReadOnlyEvidenceItem
} from "../../src/index.js";

describe("TossReadOnlyEvidencePlan", () => {
  it("requires the minimum read-only evidence set before integration", () => {
    const plan = new TossReadOnlyEvidencePlan();
    const result = plan.review([]);

    expect(result.readyForReadOnlyIntegration).toBe(false);
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.missingEvidenceKinds).toContain("API_TERMS_REVIEW");
    expect(result.missingEvidenceKinds).toContain("ACCOUNT_SNAPSHOT_READ");
  });

  it("accepts sanitized read-only evidence without enabling broker writes", () => {
    const plan = new TossReadOnlyEvidencePlan();
    const result = plan.review(
      [
        evidence("terms", "API_TERMS_REVIEW", "DOCUMENTATION_REVIEW"),
        evidence("auth", "AUTHENTICATION_READ", "READ_ONLY_API_CALL"),
        evidence("account", "ACCOUNT_SNAPSHOT_READ", "READ_ONLY_API_CALL"),
        evidence("positions", "POSITION_QUERY_READ", "READ_ONLY_API_CALL"),
        evidence("market", "MARKET_DATA_READ", "READ_ONLY_API_CALL")
      ],
      new Date("2026-07-28T00:00:00Z")
    );

    expect(result.readyForReadOnlyIntegration).toBe(true);
    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.blockedOpenQuestions).toContain("OQ-001");
    expect(result.safetyType).toBe("TOSS_READ_ONLY_EVIDENCE_REVIEW_ONLY");
  });

  it("rejects evidence that includes credentials or unsanitized payloads", () => {
    const plan = new TossReadOnlyEvidencePlan();
    const result = plan.review([
      evidence("unsafe", "API_TERMS_REVIEW", "DOCUMENTATION_REVIEW", {
        sanitized: false,
        containsCredential: true
      })
    ]);

    expect(result.reasonCodes).toContain("evidence_not_sanitized_unsafe");
    expect(result.reasonCodes).toContain("evidence_contains_credential_unsafe");
  });

  it("rejects any live write operation evidence during Phase 5", () => {
    const plan = new TossReadOnlyEvidencePlan();
    const result = plan.review([
      evidence("write", "ORDER_STATUS_QUERY_READ", "READ_ONLY_API_CALL", {
        liveWriteOperation: true
      })
    ]);

    expect(result.liveBrokerWriteAllowed).toBe(false);
    expect(result.reasonCodes).toContain("evidence_contains_live_write_operation_write");
  });

  it("warns when evidence is older than thirty days", () => {
    const plan = new TossReadOnlyEvidencePlan();
    const result = plan.review(
      [evidence("old", "MARKET_DATA_READ", "READ_ONLY_API_CALL")],
      new Date("2026-09-01T00:00:00Z")
    );

    expect(result.warnings).toContain("evidence_stale_old");
  });
});

function evidence(
  id: string,
  kind: TossReadOnlyEvidenceItem["kind"],
  mode: TossReadOnlyEvidenceItem["mode"],
  overrides: Partial<TossReadOnlyEvidenceItem> = {}
): TossReadOnlyEvidenceItem {
  return {
    id,
    kind,
    mode,
    collectedAt: new Date("2026-07-28T00:00:00Z"),
    relatedOpenQuestion: "OQ-001",
    summary: "Sanitized read-only evidence summary.",
    sanitized: true,
    containsCredential: false,
    liveWriteOperation: false,
    ...overrides
  };
}
