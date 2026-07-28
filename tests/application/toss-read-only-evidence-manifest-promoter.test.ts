import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidenceManifestPromoter,
  type TossReadOnlyEvidenceIntake,
  type TossReadOnlyEvidenceIntakeItem
} from "../../src/index.js";

describe("TossReadOnlyEvidenceManifestPromoter", () => {
  it("promotes sanitized human-reviewed intake into a manifest without live writes", () => {
    const result = new TossReadOnlyEvidenceManifestPromoter().promote(
      intake([
        item({
          id: "terms",
          source: "TOSS_OFFICIAL_DOCS",
          kind: "API_TERMS_REVIEW",
          relatedOpenQuestion: "OQ-001"
        }),
        item({
          id: "account",
          source: "LOCAL_READ_ONLY_CHECK",
          kind: "ACCOUNT_SNAPSHOT_READ",
          relatedOpenQuestion: "OQ-002"
        })
      ]),
      { generatedAt: new Date("2026-07-28T01:00:00Z"), environment: "local" }
    );

    expect(result.promoted).toBe(true);
    expect(result.manifest?.evidence).toHaveLength(2);
    expect(result.manifest?.evidence[0]?.mode).toBe("DOCUMENTATION_REVIEW");
    expect(result.manifest?.evidence[1]?.mode).toBe("READ_ONLY_API_CALL");
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("does not promote unsafe intake", () => {
    const result = new TossReadOnlyEvidenceManifestPromoter().promote(
      intake([item({ id: "unsafe", rawPayloadIncluded: true })]),
      { generatedAt: new Date("2026-07-28T01:00:00Z"), environment: "local" }
    );

    expect(result.promoted).toBe(false);
    expect(result.manifest).toBeUndefined();
    expect(result.reasonCodes).toContain("intake_contains_raw_payload_unsafe");
  });
});

function intake(items: TossReadOnlyEvidenceIntakeItem[]): TossReadOnlyEvidenceIntake {
  return {
    intakeVersion: "1",
    preparedAt: new Date("2026-07-28T00:00:00Z"),
    preparedBy: "local-operator",
    items,
    notes: ["Sanitized local intake."]
  };
}

function item(overrides: Partial<TossReadOnlyEvidenceIntakeItem> = {}): TossReadOnlyEvidenceIntakeItem {
  return {
    id: "account",
    kind: "ACCOUNT_SNAPSHOT_READ",
    relatedOpenQuestion: "OQ-002",
    source: "TOSS_OFFICIAL_DOCS",
    sourceReference: "Official Toss read-only documentation reference.",
    sanitizedSummary: "Sanitized evidence summary that does not include credentials or account identifiers.",
    reviewedByHuman: true,
    rawPayloadIncluded: false,
    screenshotContainsSecrets: false,
    liveWriteOperation: false,
    ...overrides
  };
}
