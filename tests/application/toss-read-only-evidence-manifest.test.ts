import { describe, expect, it } from "vitest";
import {
  TossReadOnlyEvidenceManifestValidator,
  type TossReadOnlyEvidenceItem,
  type TossReadOnlyEvidenceManifest
} from "../../src/index.js";

describe("TossReadOnlyEvidenceManifestValidator", () => {
  it("accepts a sanitized manifest without enabling live broker writes", () => {
    const result = new TossReadOnlyEvidenceManifestValidator().review(
      manifest([evidence("terms", "API_TERMS_REVIEW", "OQ-001")])
    );

    expect(result.valid).toBe(true);
    expect(result.evidenceCount).toBe(1);
    expect(result.relatedOpenQuestions).toEqual(["OQ-001"]);
    expect(result.liveBrokerWriteAllowed).toBe(false);
  });

  it("rejects unsanitized evidence in a manifest", () => {
    const result = new TossReadOnlyEvidenceManifestValidator().review(
      manifest([
        evidence("account", "ACCOUNT_SNAPSHOT_READ", "OQ-002", {
          sanitized: false
        })
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("manifest_evidence_not_sanitized_account");
  });

  it("rejects evidence containing credentials", () => {
    const result = new TossReadOnlyEvidenceManifestValidator().review(
      manifest([
        evidence("auth", "AUTHENTICATION_READ", "OQ-001", {
          containsCredential: true
        })
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("manifest_evidence_contains_credential_auth");
  });

  it("rejects live write evidence in Phase 5 manifests", () => {
    const result = new TossReadOnlyEvidenceManifestValidator().review(
      manifest([
        evidence("write", "ORDER_STATUS_QUERY_READ", "OQ-003", {
          liveWriteOperation: true
        })
      ])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("manifest_evidence_contains_live_write_write");
  });

  it("requires evidence to map to an open question", () => {
    const result = new TossReadOnlyEvidenceManifestValidator().review(
      manifest([evidence("unmapped", "MARKET_DATA_READ", "missing")])
    );

    expect(result.valid).toBe(false);
    expect(result.reasonCodes).toContain("manifest_evidence_missing_open_question_unmapped");
  });
});

function manifest(evidenceItems: TossReadOnlyEvidenceItem[]): TossReadOnlyEvidenceManifest {
  return {
    manifestVersion: "1",
    generatedAt: new Date("2026-07-28T00:00:00Z"),
    environment: "local",
    evidence: evidenceItems,
    notes: ["Sanitized local read-only evidence."]
  };
}

function evidence(
  id: string,
  kind: TossReadOnlyEvidenceItem["kind"],
  relatedOpenQuestion: string,
  overrides: Partial<TossReadOnlyEvidenceItem> = {}
): TossReadOnlyEvidenceItem {
  return {
    id,
    kind,
    mode: "READ_ONLY_API_CALL",
    collectedAt: new Date("2026-07-28T00:00:00Z"),
    relatedOpenQuestion,
    summary: "Sanitized evidence summary.",
    sanitized: true,
    containsCredential: false,
    liveWriteOperation: false,
    ...overrides
  };
}
