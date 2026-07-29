# Toss And Compliance Evidence Packet (P10-005)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase10_claude_worktree_tasks/P10-005_toss_compliance_evidence_packet.md`
Related Code: `src/application/live-readiness/toss-compliance-evidence-packet.ts`,
`tests/application/toss-compliance-evidence-packet.test.ts`
Related Docs: `docs/phase10/human-blocker-evidence-workbook.md`,
`docs/phase7/live-capable-blocker-register.md` (read-only, not edited by this
document or its code), `docs/13_Compliance_and_Legal_Review.md`,
`docs/open_questions.md` (OQ-001), `docs/11_AI_RULES.md`,
`src/application/live-readiness/live-blocker-evidence-intake.ts` (Phase 9,
read-only reference)

## 1. Purpose And Boundary

This document, and the optional pure validator it describes, exist to tell a
**human** compliance/legal reviewer exactly what evidence to gather and
record before `LCB-001` (Toss automated trading permission evidence) and
`LCB-005` (compliance/legal approval evidence) can be resolved — the two
blockers grouped together as the "Toss/compliance packet" in
`docs/phase10/human-blocker-evidence-workbook.md`.

This document and its code:

- do **not** resolve `LCB-001` or `LCB-005`
- do **not** authorize live trading
- do **not** browse, fetch, or call any Toss API or any network endpoint
- do **not** request, print, or store secrets, account identifiers, raw
  contract text containing personal information, raw broker payloads, or
  local receipts
- do **not** edit `docs/phase7/live-capable-blocker-register.md` — that file
  is the sole canonical source of blocker status, editable only by a human
  reviewer following its own rules
- do **not** treat an AI-generated summary as human approval

> **A structurally complete packet is evidence that a human reviewer's own
> record is shaped safely and completely. It is never itself a decision, and
> it is never itself authorization to trade.**

## 2. What This Packet Covers

| Blocker | Title | Human Owner |
| --- | --- | --- |
| `LCB-001` | Toss automated trading permission evidence | Compliance/legal reviewer (human) |
| `LCB-005` | Compliance/legal approval evidence | Compliance/legal reviewer (human) |

Both blockers share the same human-owner role
(`docs/phase7/live-capable-blocker-register.md`), which is why the workbook
groups them into a single packet rather than two separate ones. The packet
still keeps LCB-001-specific evidence (the Toss permission result) and
LCB-005-specific evidence (the seven-item compliance review scope)
structurally distinct, because they are two different bodies of evidence
tracing back to two different register entries and two different downstream
artifact paths (`docs/open_questions.md` OQ-001 for LCB-001, a future
`compliance_reviews` record per `docs/13_Compliance_and_Legal_Review.md`
Section 10 for LCB-005).

## 3. Required Fields

Per `docs/phase10/human-blocker-evidence-workbook.md` ("Required Fields Per
Packet"), every packet must record:

| Workbook Field | Where It Lives In This Packet |
| --- | --- |
| packet id | `packetId` |
| covered blocker ids | `coveredBlockerIds` — always exactly `LCB-001`, `LCB-005` |
| evidence source references | `tossPermission.sourceReferences` (LCB-001) and `complianceSourceDocumentsReviewed` (LCB-005) |
| human reviewer name | `humanReviewerName` |
| human reviewer role | `humanReviewerRole` |
| review date | `reviewDate` |
| decision/result | `decision` (see Section 5) |
| limitations or restrictions | `limitations` and `requiredSystemRestrictions` |
| expiration or next review date | `nextReviewDate` |
| prohibited-content confirmation | `prohibitedContentConfirmed` |
| statement that this is not live-trading authorization | `notLiveTradingAuthorizationStatement` in every review output, verbatim |

Two additional, LCB-001-and-LCB-005-specific fields the workbook's generic
field list does not spell out but the P10-005 task's "Output" section
requires by name:

- **Toss automated trading permission result** — `tossPermission.result`,
  one of the four values from `docs/13_Compliance_and_Legal_Review.md`
  Section 5 (`APPROVED`, `APPROVED_WITH_LIMITATIONS`, `REJECTED`,
  `UNVERIFIED`). Default assumption is `UNVERIFIED`; nothing in this packet
  ever infers a more favorable value.
- **Compliance/legal review scope** — `complianceReviewScope`, the seven
  items in `docs/13_Compliance_and_Legal_Review.md` Section 9 (Toss API
  terms reviewed, broker account permissions reviewed, data licensing
  reviewed, AI data handling reviewed, tax recording assumptions
  documented, personal-use boundary confirmed, operator accepts residual
  risk). Section 9 states plainly: "If any item is `UNVERIFIED`, live
  broker writes remain blocked."

## 4. Sanitization Rules

Every free-text field (source references, notes, limitations, required
system restrictions, reviewer name, reviewer role, compliance scope item
notes, and any optional AI-generated summary) must never contain:

- API keys, client secrets, tokens, passwords, private keys, bearer values
- account numbers or other long digit-run identifiers
- raw JSON/HTTP response bodies or raw HTTP headers
- full contract text containing personally identifying information
- raw broker payloads or local receipt contents

Only sanitized citations, clause summaries, ticket/reference ids, dated
notes, and the fixed result/decision vocabularies below are permitted. A
human preparing this packet by hand should apply the same discipline even
without running the optional validator described in Section 6.

Reviewer name and role are additionally checked against text that would
suggest an AI or automated system is claiming to be the human reviewer (for
example "reviewed by: Claude", "role: AI Assistant"). This never proves a
human actually performed the review — only the human reviewer's own
integrity does that — but it structurally blocks the most obvious way an
AI-generated approval could be passed off as a human's.

## 5. Decision Vocabulary

Only these five values are allowed, verbatim from
`docs/phase10/human-blocker-evidence-workbook.md`:

```text
READY_FOR_HUMAN_REVIEW
HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS
HUMAN_REVIEWED_REJECTED
HUMAN_REVIEWED_UNVERIFIED
NEEDS_MORE_EVIDENCE
```

`RESOLVED` is never a valid value here, in any form. `RESOLVED` belongs
exclusively to `docs/phase7/live-capable-blocker-register.md`, set only by a
human editing that file directly, after independently confirming the
underlying evidence and decision recorded in this packet (and in
`docs/open_questions.md` OQ-001 for LCB-001, and in a future
`compliance_reviews` record for LCB-005).

A `HUMAN_REVIEWED_*` decision additionally requires a verbatim attestation
(see Section 7) — a bare decision string is not itself proof a human review
happened.

## 6. Optional Pure Validator

`TossCompliancePacketValidator` (in
`src/application/live-readiness/toss-compliance-evidence-packet.ts`) is a
pure, synchronous class. It has no network code, no filesystem access, no
broker client, and no side effects. Given a caller-supplied
`TossCompliancePacketRecord`, `.review(record, now)` returns a
`TossCompliancePacketReview` describing:

- `structurallyComplete` — `true` only when every required field above is
  present, non-blank, sanitized, and internally consistent. This is a
  **structural** completeness check only — it can never verify that the
  human reviewer actually did the underlying review, only that the record
  they produced is shaped safely and completely.
- `decision` — the caller-supplied decision if it is one of the five
  allowed values, otherwise the literal `"INVALID"`. Never `"RESOLVED"`.
- `humanReviewClaimed` / `humanReviewAttested` — whether the decision claims
  a completed human review, and whether that claim is backed by the
  required verbatim attestation.
- `complianceScopeFullyReviewed` — `true` only when all seven compliance
  scope items are present and each individually marked `reviewed: true`.
- `blockingReasonCodes` / `warnings` — every structural problem found.
  Missing fields, invalid values, prohibited content, and an unattested
  `HUMAN_REVIEWED_*` claim are always blocking, never warnings, per
  `docs/11_AI_RULES.md` Rule 29 ("do not convert warnings into silent
  behavior"). Only staleness (review date more than 180 days old, or next
  review date already passed) is a non-blocking warning.
- `liveBrokerWriteAllowed: false` and `blockerRegisterResolutionAllowed:
  false` — hardcoded literals, explained in Section 8.
- `notLiveTradingAuthorizationStatement` — the verbatim not-authorization
  statement, included on every review so a caller reading only the JSON
  output still sees it.

### Missing Reviewer/Date/Decision Fields Remain Blocking

This is checked explicitly by the validator (and asserted by
`tests/application/toss-compliance-evidence-packet.test.ts`, "fails closed
on a fully empty input" and "blocks when reviewer name, review date, or
decision are missing"):

- a missing or blank `humanReviewerName` → `missing_human_reviewer_name`
- a missing or blank `humanReviewerRole` → `missing_human_reviewer_role`
- a missing, invalid, or future `reviewDate` →
  `missing_or_invalid_review_date` / `review_date_in_future`
- a missing, invalid, or not-after-`reviewDate` `nextReviewDate` →
  `missing_or_invalid_next_review_date` /
  `next_review_date_not_after_review_date`
- a missing or invalid `decision` (including any value outside the five
  allowed ones, such as `RESOLVED`) → `missing_or_invalid_decision`, and the
  reported `decision` becomes the literal `"INVALID"`

Any one of these keeps `structurallyComplete` at `false`. There is no
fallback path that treats a missing reviewer, date, or decision as
acceptable.

### Consistency Checks (Not Just Shape Checks)

The validator also checks that a reviewer's own `decision` is internally
consistent with the evidence they supplied — it never upgrades a decision
toward approval, it only ever adds a blocking reason code when the two
disagree:

- `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS` requires
  `complianceScopeFullyReviewed: true` (all seven Section 9 items reviewed),
  otherwise `decision_approved_but_compliance_scope_incomplete`.
- `HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS` requires
  `tossPermission.result` to be `APPROVED` or `APPROVED_WITH_LIMITATIONS`,
  otherwise `decision_approved_but_toss_permission_not_approved`.

## 7. Required Verbatim Attestation

For a `HUMAN_REVIEWED_*` decision to be treated as attested
(`humanReviewAttested: true`), `reviewerAttestation` must equal, verbatim:

```text
I am the named human reviewer for this Toss/compliance evidence packet covering LCB-001 and
LCB-005. I personally reviewed the evidence source references above, confirmed they contain no
secrets, account numbers, or raw broker payloads, and this record summarizes evidence only. It
does not resolve LCB-001 or LCB-005; only a human editing
docs/phase7/live-capable-blocker-register.md directly, following that file's own rules, can ever
record a RESOLVED decision. This packet is not authorization to begin live trading.
```

(Exported as `REQUIRED_TOSS_COMPLIANCE_PACKET_REVIEWER_ATTESTATION`.) A
missing or mismatched attestation on a `HUMAN_REVIEWED_*` decision is always
blocking (`decision_claims_human_reviewed_but_attestation_missing_or_mismatched`),
never silently accepted.

## 8. Why `liveBrokerWriteAllowed` And `blockerRegisterResolutionAllowed` Are Always `false`

Both fields are written once, as the bare literal `false`, in the
validator's single return statement. There is no branch, ternary, or
expression anywhere in `toss-compliance-evidence-packet.ts` that can produce
`true` for either field — not even for the maximally clean fixture used in
`tests/application/toss-compliance-evidence-packet.test.ts` ("marks a fully
sanitized, correctly attested, internally consistent record structurally
complete"), which that same test file also checks via a raw
`JSON.stringify` scan for the literal substrings `"liveBrokerWriteAllowed":true`
and `"blockerRegisterResolutionAllowed":true`.

This mirrors the same convention already established by
`live-blocker-evidence-intake.ts`, `live-operation-approval-packet.ts`,
`first-trade-operating-protocol.ts`, and `runtime-live-lock-gate.ts`: a
clean report from any of these evaluators is evidence completeness, never
live-trading authorization.

## 9. How A Human Should Use This

1. Personally read `docs/13_Compliance_and_Legal_Review.md` Sections 5 and
   9–11, and `docs/phase7/live-capable-blocker-register.md` LCB-001 and
   LCB-005, before recording anything.
2. Gather the Toss automated trading permission evidence: an official Toss
   API terms-of-use clause citation, a developer console capability
   description, or a written support/account-manager confirmation. Record
   a sanitized reference to each source (never the full raw text), and
   record the result as one of `APPROVED`, `APPROVED_WITH_LIMITATIONS`,
   `REJECTED`, or `UNVERIFIED`.
3. Work through all seven compliance review scope items in
   `docs/13_Compliance_and_Legal_Review.md` Section 9, recording a sanitized
   note and a `reviewed: true/false` for each.
4. Record the compliance source documents actually reviewed (a document
   path or citation per item, not the documents themselves).
5. Record the required system restrictions that must hold given the
   evidence (for example "limit orders only", "KR market only until US
   review completed").
6. Record `limitations` — an explicit, honest statement of what the
   evidence does and does not cover. Never leave this blank or vague.
7. Record `reviewDate` (today, the actual date of review) and
   `nextReviewDate` (a future date; per
   `docs/13_Compliance_and_Legal_Review.md` Section 11, re-review is
   required sooner if Toss API terms change, broker account permissions
   change, or capital size materially increases — whichever trigger
   applies first).
8. Record your own real name and real role as `humanReviewerName` and
   `humanReviewerRole`. Never write "AI", "Claude", "Codex", or similar.
9. Personally confirm the entire record contains no secrets, account
   numbers, raw broker payloads, or personally identifying contract text,
   then set `prohibitedContentConfirmed: true`.
10. Choose your own `decision` from the five allowed values. If you choose
    a `HUMAN_REVIEWED_*` value, type the required attestation from Section 7
    verbatim as `reviewerAttestation`.
11. Optionally run `TossCompliancePacketValidator` to check the record's
    shape and internal consistency. A `structurallyComplete: true` result
    means the record is shaped safely and completely — it is not proof the
    underlying review actually happened, and it is never authorization to
    trade.
12. If you decide `LCB-001` and/or `LCB-005` should move toward `RESOLVED`,
    that decision is recorded **only** by editing
    `docs/phase7/live-capable-blocker-register.md` directly, following that
    file's own rules — never by this packet, and never by an AI agent.

## 10. Illustrative Example (Synthetic — Not Real Evidence)

The following uses placeholder values only and does not represent any real
Toss account, real reviewer, or real compliance finding:

```text
packetId: "toss-compliance-2026-07"
coveredBlockerIds: ["LCB-001", "LCB-005"]
tossPermission:
  result: "APPROVED_WITH_LIMITATIONS"
  sourceReferences: ["docs/phase5/toss-official-api-source-notes.md#automated-trading-clause"]
  distinguishesAutomatedTradingModes: "YES"
  notes: "Terms permit API trading with rate limits; unattended cloud execution not explicitly addressed."
complianceReviewScope: [7 items, each with reviewed: true/false and a sanitized note]
complianceSourceDocumentsReviewed: ["docs/13_Compliance_and_Legal_Review.md", "docs/phase5/toss-official-api-source-notes.md"]
requiredSystemRestrictions: ["limit orders only", "KR market only until US review completed"]
limitations: "Covers KR market documentation only; US market terms not yet reviewed."
reviewDate: 2026-07-20
nextReviewDate: 2026-10-20
humanReviewerName: "Jane Reviewer"
humanReviewerRole: "Compliance/legal reviewer"
decision: "HUMAN_REVIEWED_APPROVED_WITH_LIMITATIONS"
prohibitedContentConfirmed: true
reviewerAttestation: "<verbatim text from Section 7>"
```

## 11. Non-Goals

- This packet does not resolve `LCB-001` or `LCB-005`.
- It is not a substitute for the human-reviewed decision recorded in
  `docs/open_questions.md` OQ-001, or for a future `compliance_reviews`
  record per `docs/13_Compliance_and_Legal_Review.md` Section 10.
- It does not grant, imply, or shortcut any approval.
- It cannot be completed by an AI agent on a human's behalf — every
  required field that matters (reviewer name, role, date, decision,
  attestation) must be typed by the human reviewer themselves, and an
  `aiGeneratedSummary` field, if used at all, never substitutes for any of
  them.
- It does not implement, call, or reference any real Toss API endpoint.
