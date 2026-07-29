# Live Blocker Evidence Intake (P9-001)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase9_claude_worktree_tasks/P9-001_live_blocker_evidence_intake.md`
Related Code: `src/application/live-readiness/live-blocker-evidence-intake.ts`
Related Docs: `docs/phase7/live-capable-blocker-register.md`,
`docs/13_Compliance_and_Legal_Review.md`,
`docs/phase7/manual-live-approval-record.md`, `docs/11_AI_RULES.md`

## Purpose

This document describes `LiveBlockerEvidenceRecordValidator` and
`LiveBlockerEvidenceRegisterReviewer`: a pure, machine-checkable intake
shape for sanitized evidence covering the eight live-capable blockers
(`LCB-001` through `LCB-008`) defined in
`docs/phase7/live-capable-blocker-register.md`.

This module does not resolve, close, weaken, or advance any blocker. It
does not edit `docs/phase7/live-capable-blocker-register.md`. It exists so
a human can hand it a candidate evidence record and get back a structural
verdict: is this record shaped safely, and does it currently read as a
reviewer-drafted item (`READY_FOR_HUMAN_REVIEW`) or as a completed,
attested human review (`HUMAN_REVIEWED`)?

## Why This Never Reaches `RESOLVED`

The word `"RESOLVED"` does not appear anywhere in this module's status
types or return values. `LiveBlockerEvidenceStatus` is exactly
`"REJECTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED"`. The
register-level status type adds only `"MISSING"` and `"DUPLICATE"` on top
of that. There is no branch, default, or fallback anywhere in
`live-blocker-evidence-intake.ts` that can produce the string `"RESOLVED"`.

`RESOLVED` is, and remains, a status that only exists in
`docs/phase7/live-capable-blocker-register.md`, set by a human reviewer
recording a reviewer name, reviewed date, and decision directly in that
file. This module never reads, writes, or references that file's contents
at runtime.

`LiveBlockerEvidenceRegisterReview.blockerRegisterResolutionAllowed` is a
literal `false` on every report this module can produce, for the same
reason `SmallCapitalReadinessReport.liveBrokerWriteAllowed` is a literal
`false` in `small-capital-readiness.ts`: so no caller can mistake a clean
`allBlockersHumanReviewed: true` reading for permission to write
`RESOLVED` anywhere.

## Evidence Record Shape

Every `LiveBlockerEvidenceRecord` requires:

| Field | Type | Notes |
| --- | --- | --- |
| `blockerId` | `LCB-001` .. `LCB-008` | Must be one of the eight known ids. |
| `evidenceSourceReferences` | `string[]`, non-empty | Sanitized references only (doc paths, ticket ids, official source citations). Never secrets, account numbers, or raw payloads. |
| `result` | `"APPROVED" \| "APPROVED_WITH_LIMITATIONS" \| "REJECTED" \| "UNVERIFIED"` | Matches `docs/13_Compliance_and_Legal_Review.md` Section 5 result states. |
| `limitations` | `string`, non-empty | Explicit statement of scope, e.g. "Covers KR market only" or "None identified". Never blank or omitted. |
| `humanReviewerName` | `string`, non-empty | The reviewer's own name. Rejected if it looks AI/automated (for example "Claude", "AI Assistant"). |
| `humanReviewerRole` | `string`, non-empty | The reviewer's actual human role. Same AI/automated rejection applies. |
| `reviewDate` | `Date`, valid, not in the future | The date the human reviewer actually performed this review. |
| `aiGeneratedSummary` | `string`, optional | Context only. Never read when deciding `humanReviewed` status. Still scanned for prohibited content. |
| `humanReviewed` | `boolean` | Whether the record's preparer claims a human has completed and attested to this review. |
| `humanReviewerAttestation` | `string`, optional | Must equal `REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` verbatim to count as a genuine sign-off. |

## The Verbatim Attestation

Mirroring `ManualLiveApprovalRecord.acknowledgedRisksStatement` in
`small-capital-readiness.ts` / `docs/phase7/manual-live-approval-record.md`,
a boolean `humanReviewed` flag alone is trivial for anyone — human or AI —
to set without meaningfully reviewing anything. To reach `HUMAN_REVIEWED`,
`humanReviewerAttestation` must equal
`REQUIRED_LIVE_BLOCKER_EVIDENCE_REVIEWER_ATTESTATION` exactly:

```text
I am the named human reviewer for this blocker. I personally reviewed the
evidence source references above, they do not contain secrets, account
numbers, or raw broker payloads, and this record summarizes evidence only.
It does not resolve this blocker; only a human editing the canonical
blocker register can ever record a RESOLVED decision.
```

The attestation text itself states that the record does not resolve the
blocker, so a reviewer typing it cannot reasonably believe they are doing
more than summarizing evidence.

If `humanReviewed: true` is set but the attestation is missing or does not
match verbatim, the record stays at `READY_FOR_HUMAN_REVIEW` and a warning
(`human_reviewed_claimed_but_attestation_missing_or_mismatched`) is added —
per `docs/11_AI_RULES.md` Rule 29 ("do not convert warnings into silent
behavior"), this is never silently upgraded.

## Prohibited-Content Checks

Every free-text field (`evidenceSourceReferences`, `limitations`,
`humanReviewerName`, `humanReviewerRole`, `aiGeneratedSummary`) is scanned
for:

- secret-like content (tokens, client/app secrets, API keys, authorization
  headers, bearer values, passwords, private keys)
- account-identifier-like content (digit runs of 6 or more)
- raw-payload-like content (JSON response bodies, HTML documents, raw HTTP
  status lines)
- raw request-header-like content (`X-...` headers, cookies)

Any match is a blocking `reasonCode` (`evidence_may_contain_secret_*`,
`evidence_may_contain_account_identifier_*`,
`evidence_looks_like_raw_payload_*`,
`evidence_may_contain_request_header_*`), never a warning. A record with
any such match always reviews as `REJECTED`, regardless of how complete
its other fields are.

`humanReviewerName` and `humanReviewerRole` are additionally checked
against a pattern of AI/automated identity tokens (`ai`, `claude`,
`chatgpt`, `gpt`, `codex`, `anthropic`, `openai`, `copilot`, `assistant`,
`bot`, `automated`, `algorithm`). A match rejects the record
(`human_reviewer_name_looks_non_human`,
`human_reviewer_role_looks_non_human`). This never proves a human actually
reviewed anything — it only blocks the most obvious way an AI-generated
approval could be labeled as if it were human.

## Register-Level Review

`LiveBlockerEvidenceRegisterReviewer.review({ now, records })` takes an
array of evidence records (intended to be at most one per blocker id) and
returns a summary covering all eight `LIVE_BLOCKER_IDS`, in fixed order,
every time:

- a blocker with zero matching records is reported `MISSING`
  (`missing_blocker_evidence_LCB-0xx`)
- a blocker with more than one matching record is reported `DUPLICATE`
  (`duplicate_blocker_evidence_LCB-0xx`)
- otherwise the blocker's status is whatever
  `LiveBlockerEvidenceRecordValidator` returned for its one record

`allBlockersRepresented` is `true` only when every blocker has exactly one
record. `allBlockersHumanReviewed` is `true` only when every blocker's
status is `HUMAN_REVIEWED`. Neither flag, nor any other field on this
report, ever authorizes writing anything back into
`docs/phase7/live-capable-blocker-register.md` — that remains a human act,
performed directly in that file.

## Relationship to `docs/phase7/live-capable-blocker-register.md`

This module intentionally does not import, read, or modify
`docs/phase7/live-capable-blocker-register.md`. The register file remains
the single canonical source of truth for each blocker's `Current Status`.
`LIVE_BLOCKER_CATALOG` in this module is a small, static, informational
mirror of the register's "Summary Table" (blocker id, short title, human
owner role) used only for validation messages and completeness checks — it
carries no status field and cannot drift into claiming a blocker is
resolved.

## What This Module Does Not Do

- It does not resolve, close, or weaken any `LCB-*` blocker.
- It does not edit `docs/phase7/live-capable-blocker-register.md`.
- It does not accept AI-generated text as a substitute for human review.
  `aiGeneratedSummary` is never read when computing `humanReviewed` status.
- It does not implement any broker write, read, or network call of any
  kind. It is a pure function over its inputs.
- It does not weaken, replace, or duplicate the Phase 5 sanitized evidence
  flow (`src/application/toss/read-only-evidence-intake.ts`) — that module
  remains the intake path for Toss-specific read-only evidence
  (`docs/phase5/open-question-evidence-policy.md`). This module is a
  separate, blocker-shaped intake for the eight `LCB-*` items specifically.

## Example

See `docs/phase9/live-blocker-evidence-intake.example.json` for an
illustrative, fully synthetic evidence record. No real names, account
references, or production identifiers are used or should ever be used in
documentation, tests, or committed code.
