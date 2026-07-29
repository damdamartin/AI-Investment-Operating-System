import { describe, expect, it } from "vitest";
import {
  LIVE_BLOCKER_CATALOG,
  LIVE_BLOCKER_IDS,
  LiveBlockerEvidenceRecordValidator,
  LiveBlockerEvidenceRegisterReviewer,
  REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION,
  type LiveBlockerEvidenceRecord,
  type LiveBlockerId
} from "../../src/index.js";

const NOW = new Date("2026-07-29T01:00:00Z");

function cleanRecord(overrides: Partial<LiveBlockerEvidenceRecord> = {}): LiveBlockerEvidenceRecord {
  return {
    blockerId: "LCB-001",
    evidenceSourceReferences: ["docs/phase5/toss-official-api-source-notes.md#automated-trading-clause"],
    result: "UNVERIFIED",
    limitations: "Covers KR market documentation only; US market terms not yet reviewed.",
    humanReviewerName: "Jun Kim",
    humanReviewerRole: "Compliance/legal reviewer",
    reviewDate: new Date("2026-07-20T00:00:00Z"),
    humanReviewed: true,
    humanReviewerAttestation: REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION,
    ...overrides
  };
}

describe("LIVE_BLOCKER_CATALOG", () => {
  it("has a catalog entry for every LCB id, LCB-001 through LCB-008", () => {
    expect(LIVE_BLOCKER_IDS).toEqual([
      "LCB-001",
      "LCB-002",
      "LCB-003",
      "LCB-004",
      "LCB-005",
      "LCB-006",
      "LCB-007",
      "LCB-008"
    ]);

    for (const id of LIVE_BLOCKER_IDS) {
      const entry = LIVE_BLOCKER_CATALOG[id];
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.humanOwnerRole.length).toBeGreaterThan(0);
      expect(entry.humanOwnerRole.toLowerCase()).toContain("human");
    }
  });
});

describe("LiveBlockerEvidenceRecordValidator", () => {
  it("marks a fully sanitized, correctly attested record HUMAN_REVIEWED", () => {
    const review = new LiveBlockerEvidenceRecordValidator().review(cleanRecord(), NOW);

    expect(review.status).toBe("HUMAN_REVIEWED");
    expect(review.reasonCodes).toEqual([]);
    expect(review.liveBrokerWriteAllowed).toBe(false);
  });

  it("marks a sanitized but unattested record READY_FOR_HUMAN_REVIEW, never HUMAN_REVIEWED", () => {
    const review = new LiveBlockerEvidenceRecordValidator().review(
      cleanRecord({ humanReviewed: false, humanReviewerAttestation: undefined }),
      NOW
    );

    expect(review.status).toBe("READY_FOR_HUMAN_REVIEW");
    expect(review.reasonCodes).toEqual([]);
  });

  it("never produces the literal status RESOLVED under any input", () => {
    // Exhaustively try every field combination that might plausibly be
    // mistaken for "resolved" and confirm the status is never that word.
    const attempts: LiveBlockerEvidenceRecord[] = [
      cleanRecord({ result: "APPROVED" }),
      cleanRecord({ result: "APPROVED_WITH_LIMITATIONS" }),
      cleanRecord({ humanReviewed: true }),
      cleanRecord({
        humanReviewed: true,
        humanReviewerAttestation: REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION
      }),
      // @ts-expect-error deliberately probing an out-of-union value to prove
      // even a hand-edited/untyped caller cannot smuggle "RESOLVED" through.
      cleanRecord({ result: "RESOLVED" })
    ];

    for (const record of attempts) {
      const review = new LiveBlockerEvidenceRecordValidator().review(record, NOW);
      expect(review.status).not.toBe("RESOLVED");
      expect(["REJECTED", "READY_FOR_HUMAN_REVIEW", "HUMAN_REVIEWED"]).toContain(review.status);
    }
  });

  it("claiming humanReviewed without the verbatim attestation warns but does not upgrade status", () => {
    const review = new LiveBlockerEvidenceRecordValidator().review(
      cleanRecord({ humanReviewed: true, humanReviewerAttestation: "I reviewed this, trust me." }),
      NOW
    );

    expect(review.status).toBe("READY_FOR_HUMAN_REVIEW");
    expect(review.warnings).toContain("human_reviewed_claimed_but_attestation_missing_or_mismatched");
  });

  describe("fails closed on missing human-reviewer fields", () => {
    it("rejects a record with a missing/blank humanReviewerName", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({ humanReviewerName: "   " }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_human_reviewer_name");
    });

    it("rejects a record with a missing humanReviewerRole", () => {
      // @ts-expect-error intentionally omitting a required field to prove
      // the validator fails closed at runtime, not just at compile time.
      const record = cleanRecord({ humanReviewerRole: undefined });
      const review = new LiveBlockerEvidenceRecordValidator().review(record, NOW);

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_human_reviewer_role");
    });

    it("rejects a record with a missing/invalid reviewDate", () => {
      // An invalid date string still produces a well-typed `Date` instance
      // (with `NaN` internally), so this is a runtime check, not a
      // compile-time one.
      const record = cleanRecord({ reviewDate: new Date("not-a-date") });
      const review = new LiveBlockerEvidenceRecordValidator().review(record, NOW);

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_or_invalid_review_date");
    });

    it("rejects a record whose reviewDate is in the future", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({ reviewDate: new Date("2099-01-01T00:00:00Z") }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("review_date_in_future");
    });

    it("rejects a record missing evidenceSourceReferences", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({ evidenceSourceReferences: [] }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_evidence_source_references");
    });

    it("rejects a record missing limitations", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(cleanRecord({ limitations: "" }), NOW);

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_limitations");
    });

    it("rejects a record missing or with an invalid result", () => {
      // @ts-expect-error intentionally supplying an invalid result value.
      const record = cleanRecord({ result: "MAYBE" });
      const review = new LiveBlockerEvidenceRecordValidator().review(record, NOW);

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_or_invalid_result");
    });

    it("rejects a record with an unknown blockerId", () => {
      // @ts-expect-error intentionally supplying an id outside the LCB-001..008 union.
      const record = cleanRecord({ blockerId: "LCB-999" });
      const review = new LiveBlockerEvidenceRecordValidator().review(record, NOW);

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("unknown_blocker_id");
      expect(review.blockerId).toBeUndefined();
    });

    it("an AI-generated summary alone never substitutes for the required human-reviewer fields", () => {
      const record = cleanRecord({
        humanReviewerName: "",
        humanReviewerRole: "",
        humanReviewed: false,
        humanReviewerAttestation: undefined,
        aiGeneratedSummary:
          "Automated research summary: Toss API terms appear to permit read-only automated queries."
      });

      const review = new LiveBlockerEvidenceRecordValidator().review(record, NOW);

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("missing_human_reviewer_name");
      expect(review.reasonCodes).toContain("missing_human_reviewer_role");
    });
  });

  describe("rejects secret-like, account-like, and raw-payload-like content", () => {
    it("rejects an evidence source reference containing a client secret", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({
          evidenceSourceReferences: ["Note: client_secret was used to authenticate the developer console session."]
        }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("evidence_may_contain_secret_evidence_source_reference_0");
    });

    it("rejects a bearer token in limitations", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({ limitations: "Verified using Authorization: Bearer abcDEF123.token-value in a test call." }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("evidence_may_contain_secret_limitations");
    });

    it("rejects an account-number-like digit run in an evidence source reference", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({
          evidenceSourceReferences: ["Account snapshot referenced account 1234567890 during the read-only check."]
        }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("evidence_may_contain_account_identifier_evidence_source_reference_0");
    });

    it("rejects a sanitized summary shaped like a raw JSON API response payload", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({
          limitations: 'Response observed: {"accountStatus":"ACTIVE","balanceCurrency":"KRW"} during the check.'
        }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("evidence_looks_like_raw_payload_limitations");
    });

    it("rejects a raw HTTP request header line pasted into a source reference", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({
          evidenceSourceReferences: ["Request included header X-Toss-Client-Id: abc123-client-id-value"]
        }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("evidence_may_contain_request_header_evidence_source_reference_0");
    });

    it("rejects secret-like content even when only present in the optional AI-generated summary", () => {
      const review = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({
          aiGeneratedSummary: "Draft note: found an api_key value while scanning the console screenshot."
        }),
        NOW
      );

      expect(review.status).toBe("REJECTED");
      expect(review.reasonCodes).toContain("evidence_may_contain_secret_ai_generated_summary");
    });

    it("rejects a reviewer name or role that looks AI/automated rather than human", () => {
      const nameReview = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({ humanReviewerName: "Claude" }),
        NOW
      );
      expect(nameReview.status).toBe("REJECTED");
      expect(nameReview.reasonCodes).toContain("human_reviewer_name_looks_non_human");

      const roleReview = new LiveBlockerEvidenceRecordValidator().review(
        cleanRecord({ humanReviewerRole: "AI Assistant" }),
        NOW
      );
      expect(roleReview.status).toBe("REJECTED");
      expect(roleReview.reasonCodes).toContain("human_reviewer_role_looks_non_human");
    });
  });

  it("warns, but does not block, on a stale review date", () => {
    const review = new LiveBlockerEvidenceRecordValidator().review(
      cleanRecord({ reviewDate: new Date("2025-01-01T00:00:00Z") }),
      NOW
    );

    expect(review.status).toBe("HUMAN_REVIEWED");
    expect(review.warnings).toContain("review_date_stale_recommend_re_review");
  });
});

describe("LiveBlockerEvidenceRegisterReviewer", () => {
  function humanReviewedRecordFor(blockerId: LiveBlockerId): LiveBlockerEvidenceRecord {
    return cleanRecord({ blockerId });
  }

  it("represents all 8 LCB blockers and reports allBlockersHumanReviewed when every record is complete", () => {
    const review = new LiveBlockerEvidenceRegisterReviewer().review({
      now: NOW,
      records: LIVE_BLOCKER_IDS.map((id) => humanReviewedRecordFor(id))
    });

    expect(review.blockers.map((summary) => summary.blockerId)).toEqual(LIVE_BLOCKER_IDS as unknown as string[]);
    expect(review.allBlockersRepresented).toBe(true);
    expect(review.allBlockersHumanReviewed).toBe(true);
    expect(review.reasonCodes).toEqual([]);
    expect(review.liveBrokerWriteAllowed).toBe(false);
    expect(review.blockerRegisterResolutionAllowed).toBe(false);
  });

  it("never exposes a RESOLVED status or a resolution-allowed flag anywhere in the register review", () => {
    const review = new LiveBlockerEvidenceRegisterReviewer().review({
      now: NOW,
      records: LIVE_BLOCKER_IDS.map((id) => humanReviewedRecordFor(id))
    });

    const serialized = JSON.stringify(review);
    expect(serialized).not.toContain("RESOLVED");
    expect(review.blockerRegisterResolutionAllowed).toBe(false);
  });

  it("fails closed when a blocker has no evidence record at all", () => {
    const recordsMissingOne = LIVE_BLOCKER_IDS.filter((id) => id !== "LCB-008").map((id) =>
      humanReviewedRecordFor(id)
    );

    const review = new LiveBlockerEvidenceRegisterReviewer().review({ now: NOW, records: recordsMissingOne });

    expect(review.allBlockersRepresented).toBe(false);
    expect(review.allBlockersHumanReviewed).toBe(false);
    expect(review.reasonCodes).toContain("missing_blocker_evidence_LCB-008");
    const lcb008Summary = review.blockers.find((summary) => summary.blockerId === "LCB-008");
    expect(lcb008Summary?.status).toBe("MISSING");
  });

  it("fails closed when a blocker has more than one evidence record", () => {
    const records = [
      ...LIVE_BLOCKER_IDS.map((id) => humanReviewedRecordFor(id)),
      humanReviewedRecordFor("LCB-001")
    ];

    const review = new LiveBlockerEvidenceRegisterReviewer().review({ now: NOW, records });

    expect(review.allBlockersRepresented).toBe(false);
    expect(review.reasonCodes).toContain("duplicate_blocker_evidence_LCB-001");
    const lcb001Summary = review.blockers.find((summary) => summary.blockerId === "LCB-001");
    expect(lcb001Summary?.status).toBe("DUPLICATE");
  });

  it("reports allBlockersRepresented true but allBlockersHumanReviewed false when a blocker is only READY_FOR_HUMAN_REVIEW", () => {
    const records = LIVE_BLOCKER_IDS.map((id) =>
      id === "LCB-004"
        ? humanReviewedRecordFor(id) // will be overridden below to be unattested
        : humanReviewedRecordFor(id)
    ).map((record) =>
      record.blockerId === "LCB-004"
        ? { ...record, humanReviewed: false, humanReviewerAttestation: undefined }
        : record
    );

    const review = new LiveBlockerEvidenceRegisterReviewer().review({ now: NOW, records });

    expect(review.allBlockersRepresented).toBe(true);
    expect(review.allBlockersHumanReviewed).toBe(false);
    const lcb004Summary = review.blockers.find((summary) => summary.blockerId === "LCB-004");
    expect(lcb004Summary?.status).toBe("READY_FOR_HUMAN_REVIEW");
  });

  it("propagates a rejected blocker's reason codes into the register-level reasonCodes, prefixed by blockerId", () => {
    const records = LIVE_BLOCKER_IDS.map((id) =>
      id === "LCB-005" ? { ...humanReviewedRecordFor(id), limitations: "" } : humanReviewedRecordFor(id)
    );

    const review = new LiveBlockerEvidenceRegisterReviewer().review({ now: NOW, records });

    expect(review.allBlockersHumanReviewed).toBe(false);
    expect(review.reasonCodes).toContain("LCB-005_missing_limitations");
    const lcb005Summary = review.blockers.find((summary) => summary.blockerId === "LCB-005");
    expect(lcb005Summary?.status).toBe("REJECTED");
  });
});
