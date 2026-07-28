import { describe, expect, it } from "vitest";
import { TossReadOnlyEvidenceRecorder } from "../../src/index.js";

describe("TossReadOnlyEvidenceRecorder", () => {
  it("creates sanitized read-only evidence records", () => {
    const record = new TossReadOnlyEvidenceRecorder().record({
      id: "account-snapshot",
      kind: "ACCOUNT_SNAPSHOT_READ",
      mode: "READ_ONLY_API_CALL",
      relatedOpenQuestion: "OQ-002",
      summary: "Account snapshot read completed.",
      payload: {
        permissionStatus: "READ_ONLY",
        balances: [{ currency: "KRW", amount: "100000" }]
      },
      collectedAt: new Date("2026-07-28T00:00:00Z")
    });

    expect(record.item.sanitized).toBe(true);
    expect(record.item.containsCredential).toBe(false);
    expect(record.item.liveWriteOperation).toBe(false);
    expect(record.safetyType).toBe("TOSS_READ_ONLY_EVIDENCE_RECORD_ONLY");
  });

  it("redacts sensitive keys in the preview", () => {
    const record = new TossReadOnlyEvidenceRecorder().record({
      id: "auth-read",
      kind: "AUTHENTICATION_READ",
      mode: "READ_ONLY_API_CALL",
      relatedOpenQuestion: "OQ-001",
      summary: "Authentication succeeded.",
      payload: {
        accessToken: "secret-token",
        expiresIn: 3600
      }
    });

    expect(record.item.sanitized).toBe(false);
    expect(record.item.containsCredential).toBe(true);
    expect(record.sanitizedPreview).toEqual({
      accessToken: "****",
      expiresIn: 3600
    });
  });

  it("redacts known secrets from summaries", () => {
    const record = new TossReadOnlyEvidenceRecorder().record({
      id: "summary",
      kind: "API_TERMS_REVIEW",
      mode: "DOCUMENTATION_REVIEW",
      relatedOpenQuestion: "OQ-001",
      summary: "Reviewed using client abcdef.",
      payload: { result: "terms reviewed" },
      knownSecrets: ["abcdef"]
    });

    expect(record.item.summary).toBe("Reviewed using client ab****ef.");
  });

  it("marks account identifiers as not sanitized", () => {
    const record = new TossReadOnlyEvidenceRecorder().record({
      id: "account-number",
      kind: "ACCOUNT_SNAPSHOT_READ",
      mode: "READ_ONLY_API_CALL",
      relatedOpenQuestion: "OQ-002",
      summary: "Account snapshot read.",
      payload: {
        accountNumber: "1234567890",
        permissionStatus: "READ_ONLY"
      }
    });

    expect(record.item.sanitized).toBe(false);
    expect(record.sanitizedPreview).toEqual({
      accountNumber: "****",
      permissionStatus: "READ_ONLY"
    });
  });

  it("flags live write operation shapes", () => {
    const record = new TossReadOnlyEvidenceRecorder().record({
      id: "write-shape",
      kind: "ORDER_STATUS_QUERY_READ",
      mode: "READ_ONLY_API_CALL",
      relatedOpenQuestion: "OQ-003",
      summary: "Unexpected command shape.",
      payload: {
        submitOrder: {
          symbol: "005930"
        }
      }
    });

    expect(record.item.liveWriteOperation).toBe(true);
  });
});
