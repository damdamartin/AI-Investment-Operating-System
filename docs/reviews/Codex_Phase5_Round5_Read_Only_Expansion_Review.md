# Codex Phase 5 Round 5 Read-Only Expansion Review

Version: 0.2.0
Status: Complete for round 5 (P5-016 through P5-019)
Review Date: 2026-07-29

## Document Purpose

This document is the Phase 5 round 5 integration review (task P5-019). It was produced in two
phases, matching the precedent set by `docs/reviews/Codex_Phase5_Readiness_Review.md` (round 3)
and `docs/reviews/Codex_Phase5_First_Read_Only_Verification_Review.md` (round 4):

- Phase 1: read the round-5 task set (P5-016, P5-017, P5-018), ran a regression-gap check against
  the pre-merge codebase, found no genuine gap, and laid out a scaffold. No integration or
  readiness content was written in phase 1, because Engineer 1 (P5-016), Engineer 2 (P5-017), and
  Engineer 3 (P5-018) had not yet been merged into `main` at the time.
- Phase 2 (this content): after the orchestrator merged P5-016 (`71a32f1`), P5-017 (`efe0e0c`),
  and P5-018 (`f89cc36`, current local `main` tip) into local `main`, this section fills in every
  scaffold placeholder with real content based on reading the actual merged files, and re-runs the
  full verification suite against the merged state.

The phase 1 regression-gap check is preserved unchanged below, under "Phase 1 Regression Gap
Check (Pre-Merge Baseline)", because it documents what was true before P5-016/P5-017/P5-018
existed.

## Summary

Round 5 (P5-016 through P5-019) extended Toss read-only verification to a third target
(`market-prices`), strengthened the sanitized evidence pipeline to roll up multiple receipts per
open question, and updated operator documentation. It did not collect any real Toss evidence and
did not change the live-trading boundary.

- P5-016 added `getMarketPrices()` to `TossReadOnlyHttpClient` and a `market-prices` target to
  `scripts/phase5-toss-read-only-verify.mjs`, both intentionally count-only (never extracting a
  per-item symbol or price), plus a target-specific fail-closed gate that requires an explicitly
  `verified: true` `MARKET_DATA_READ` catalog entry before this target can proceed even after
  preflight and the call gate pass. Account/holdings behavior is unchanged and regression-tested.
- P5-017 made the evidence-kind-to-open-question mapping total (added `MARKET_DATA_READ: "OQ-004"`)
  and added `TossReadOnlyEvidenceReceiptValidator` /
  `TossReadOnlyEvidenceReceiptOperatorSummaryBuilder`, which roll up multiple sanitized receipts
  (e.g. one `accounts` receipt plus one `holdings` receipt) into a deterministic per-open-question
  summary without ever reading a receipt file from disk, and without any `reviewedByHuman` shortcut.
- P5-018 updated the runbook, verification checklist, completion checklist, and Phase 5 README with
  a "Current Status"/"Current Verification Status" section distinguishing `accounts`/`holdings`
  (completed by the human operator) from `market-prices` (described in the merged docs as
  "next pending target ... not yet available as a real call target on this branch" — see
  "Whether Docs Accurately Describe Accounts/Holdings Already Verified" below for why that specific
  wording is now stale after P5-016 merged in parallel, and what this task corrected).
- P5-019 (this task) merged all three, read every changed file directly, re-confirmed the phase-1
  static-test assessment against the real P5-016 diff (no test update needed — confirmed correct),
  corrected two now-stale sentences in this task's allowed-file docs, wrote this review, and
  re-verified `npm run check` plus the required Phase 5 commands against the merged codebase.

After all of round 5, in the default local state of this worktree (no real `.env`, no verified
endpoint catalog entry, no human-reviewed evidence intake, no approval flag set for the gated
commands): `phase5:toss:readiness`, `phase5:toss:preflight`, and
`PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true phase5:toss:completion` all fail closed as expected
(exit 1), and `liveBrokerWriteAllowed: false` / `networkCallsPerformed: false` hold in every
report from every command. No `rawPayloadStored: true` value was observed or is reachable anywhere
in the merged code. Live trading remains fully blocked, and no real Toss API call has been made by
any AI agent at any point in this task.

## What Changed in P5-016 (Market-Prices)

Files changed: `src/adapters/toss/toss-read-only-http-client.ts` (+98/-lines),
`scripts/phase5-toss-read-only-verify.mjs` (+84 lines), plus matching test files
(`tests/adapters/toss-read-only-http-client.test.ts`, +134 lines, now 17 tests;
`tests/scripts/phase5-toss-read-only-verify-script.test.ts`, +234 lines, now 18 tests).

Read directly from source: `TossReadOnlyHttpClient` gained a fourth public method,
`getMarketPrices()` (`GET /api/v1/prices`, `MARKET_DATA_READ`), added to
`TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS` alongside the three pre-existing operations. There
is still no generic `request(path, method, body)` method anywhere in the class — the public surface
remains exactly `authenticate`/`getAccounts`/`getHoldings`/`getMarketPrices`/`getSafetyReport`.
`getMarketPrices()` is deliberately *stricter* than `getAccounts()`/`getHoldings()`: its return
type, `TossReadOnlyMarketDataSummary`, is `{ itemCount: number }` only — the method never extracts
a symbol, price, or any other per-item field from the response, unlike the account/holdings methods
which do normalize per-item fields (masked account number, symbol, quantity). The code comment
directly on the method explains why: the real `/api/v1/prices` response body's field names are not
yet officially confirmed for this repository, so rather than guess at field names, the method
counts items and discards the rest. Every result carries the same hardcoded (non-computed)
`liveBrokerWriteAllowed: false` via the shared `#metadataFor()`/`#errorResult()` helpers, unchanged
from before this task.

`scripts/phase5-toss-read-only-verify.mjs` gained a third entry in `ALLOWED_TARGETS`,
`"market-prices"` (mapping to `MARKET_DATA_READ` / path `/api/v1/prices`), with one additional
field other targets do not have: `requiresVerifiedEndpointCatalogEntry: true`. Read directly from
`main()`: after the shared approval/preflight/call-gate checks (steps 1-4, unchanged and shared
across all three targets), a new step 4b runs only for targets carrying that flag —
`isMarketDataEndpointVerified()` re-reads the endpoint catalog file directly (no network call) and
requires an item with `operation === "MARKET_DATA_READ"`, `path === "/api/v1/prices"`, and
`verified === true`; any read or parse failure, or the absence of such an item, is treated as "not
verified" (fails closed), never as "verified" by default. This is deliberately stricter than the
generic preflight/doctor readiness checks, which only require *some* verified endpoint to exist
anywhere in the catalog — a catalog with only a verified `ACCOUNT_SNAPSHOT_READ` entry is enough to
pass generic preflight, but is not enough to let `market-prices` proceed. `accounts` and `holdings`
do not set this flag, so this new check never runs for them — confirmed both by reading the code
and by the pre-existing `accounts`/`holdings` tests continuing to pass unmodified.

Test coverage (5 new/changed test cases in the HTTP client file, 7 new test cases in the script
file, all passing, all against a local mock server or fetch stub — zero real network calls) proves,
among other things: a market-prices response is sanitized to an item count only, with the raw
symbols/prices from a realistic fixture (`005930`, `AAPL`, `MSFT`, `71000`, `150.25`) never
appearing anywhere in stdout or the written evidence file; a non-2xx or invalid-shape market-prices
response fails closed with a sanitized reason code; only the bearer token (no account-scoped
header) is sent to `/api/v1/prices`; a cached token is reused across all three read operations; an
unapproved or preflight/call-gate-not-ready market-prices attempt performs no network call; the new
`market_data_endpoint_not_verified_in_catalog` gate fires even when preflight and the call gate
both report ready (proving it is a genuine independent gate, not inherited from generic readiness);
and a real approved mock-server market-prices call writes only `{ operation, evidenceKind,
collectedAt, itemCount, liveBrokerWriteAllowed: false, networkCallsPerformed: true,
rawPayloadStored: false, safetyType }` to `tmp/phase5/`, which is then fed directly into P5-017's
real, merged `TossReadOnlyVerificationResultValidator` and asserts `acceptedForIntakeDraft: true` —
proving the P5-016 output shape and the P5-017 validator genuinely agree end-to-end, not just that
each was tested in isolation.

One minor, non-functional observation: the new market-prices test in
`tests/scripts/phase5-toss-read-only-verify-script.test.ts` contains a comment stating
"`MARKET_DATA_READ` intentionally has no canonical open-question mapping." Reading
`src/application/toss/read-only-evidence-intake.ts` directly shows this is no longer accurate as of
the same round's P5-017 merge — `evidenceKindOpenQuestionMap` now maps `MARKET_DATA_READ: "OQ-004"`,
and `TossReadOnlyVerificationResultValidator.review()` does return a `suggestedRelatedOpenQuestion`
of `"OQ-004"` for a market-prices result (confirmed by reading `openQuestionForEvidenceKind()`'s
call site at line 512 of that file). The test itself does not assert on this value, so nothing is
functionally wrong or unsafe — this is a stale code comment from when P5-016 and P5-017 were
developed in parallel without seeing each other's final diff, not a safety or correctness gap. It
is called out here for whichever engineer next touches that test file, not fixed in this task
(the file belongs to P5-016/Engineer 1's ownership, not P5-019's).

## What Changed in P5-017 (Evidence Receipts)

Files changed: `src/application/toss/read-only-evidence-intake.ts` (+335 lines), plus matching test
files (`tests/application/toss-read-only-evidence-intake.test.ts`, +299 lines, now 49 tests;
`tests/application/toss-read-only-evidence-manifest.test.ts`, +31 lines, now 12 tests).

Read directly from source: `evidenceKindOpenQuestionMap` (the canonical evidence-kind-to-open-
question mapping introduced in round 4's P5-014) gained `MARKET_DATA_READ: "OQ-004"`, making the
map total across every member of the `TossEvidenceKind` union instead of partial — the code comment
explicitly frames this as matching the convention already recorded in
`docs/phase5/toss-official-api-source-notes.md` ("Current price lookup | GET | /api/v1/prices |
MARKET_DATA_READ, OQ-004"), and notes this mapping does not, by itself, mark OQ-004 resolved or
trading safe.

The substantial new addition is a receipt-level validation and rollup layer, distinct from the
pre-existing intake-item and manifest validators: `TossReadOnlyEvidenceReceiptRecord` (a receipt
paired with a `sourceReference` string, never read from disk), `TossReadOnlyEvidenceReceiptValidator`
(reviews one receipt: rejects a non-read-only or write-looking operation, an unknown evidence kind,
`liveBrokerWriteAllowed !== false`, `rawPayloadStored !== false`, a non-boolean
`networkCallsPerformed`, an invalid `itemCount`, a missing/invalid `collectedAt`, secret-like/
account-identifier-like/raw-response-like/header-like content in any receipt field, and
path-traversal/remote-URL/`.env`-referencing/unsafe-content in the source reference — the same
defense-in-depth philosophy as the pre-existing manifest validator's "never trust self-declared
safety flags alone" comment), and `TossReadOnlyEvidenceReceiptOperatorSummaryBuilder` (rolls up a
list of receipts into a summary always listing all four open questions in fixed OQ-001..OQ-004
order, even with zero receipts; de-duplicates a receipt whose `sourceReference` repeats in the same
batch rather than double-counting it; and is proven order-independent by a dedicated test that
summarizes the same two receipts in both orders and asserts identical output).

Confirmed by reading the type definition directly: `TossReadOnlyEvidenceReceipt`'s shape —
`{ operation, evidenceKind, collectedAt (ISO string), itemCount, liveBrokerWriteAllowed: false,
networkCallsPerformed: boolean, rawPayloadStored: false, safetyType }` — is exactly the shape
`writeSanitizedEvidence()` in P5-016's `scripts/phase5-toss-read-only-verify.mjs` writes to
`tmp/phase5/` (confirmed field-by-field against that function). No further alignment work between
P5-016 and P5-017 is needed for this receipt shape; it is already resolved, not an open integration
point.

No `reviewedByHuman` field or concept exists anywhere on `TossReadOnlyEvidenceReceipt`,
`TossReadOnlyEvidenceReceiptRecord`, or the summary types — confirmed by reading every interface in
this new section of the file. Promotion into an intake item that could eventually be marked
reviewed remains a separate, human-only step through the pre-existing
`TossReadOnlyVerificationResultValidator.draftIntakeItem()` (round 4), which still hardcodes
`reviewedByHuman: false` on every draft it produces. `liveTradingAuthorized: false` and
`liveBrokerWriteAllowed: false` are literal fields on `TossReadOnlyEvidenceReceiptOperatorSummary`,
not computed from input.

Test coverage (proven directly, not merely read) includes: a distinct `ACCOUNT_SNAPSHOT_READ`
receipt and a `POSITION_QUERY_READ` receipt both count toward OQ-002 without conflict
(`receiptCount: 2`, `validReceiptCount: 2`, `evidenceKinds: ["ACCOUNT_SNAPSHOT_READ",
"POSITION_QUERY_READ"]`); a duplicate `sourceReference` in the same batch is excluded from the
valid count and surfaces a `receipt_duplicate_source_reference_*` reason code; an unsafe receipt
(`rawPayloadStored: true`) is rejected and kept out of the valid count without throwing, while a
sibling valid OQ-002 receipt in the same batch still counts — proving one bad receipt cannot corrupt
the whole summary — and the summary explicitly has no `reviewedByHuman` or `resolved` property at
all (asserted directly with `not.toHaveProperty`).

## What Changed in P5-018 (Runbook/Status)

Files changed: `docs/phase5/README.md` (+12/-2 lines), `docs/phase5/local-toss-read-only-runbook.md`
(+35/-4 lines), `docs/phase5/phase5-toss-completion-checklist.md` (+12/-2 lines),
`docs/phase5/toss-read-only-verification-checklist.md` (+16/-2 lines). No code file was touched
(confirmed: `src/application/read-only-dashboard.ts`, `tests/application/read-only-dashboard.test.ts`,
`scripts/phase5-toss-completion.mjs`, and `tests/scripts/phase5-toss-completion-script.test.ts` all
show zero diff between the pre-round-5 tree and the merged state).

Read directly from the diff: `docs/phase5/local-toss-read-only-runbook.md` gained a "Current
Verification Status" section listing `accounts` and `holdings` as **COMPLETED** ("the human operator
has run Step 9 for this target at least once, reviewed the sanitized evidence file it wrote
locally, and carried it through Step 10 intake") and `market-prices` as **PENDING** ("This is the
next target. Support for it is being added as a separate, parallel effort and is not yet available
as a real call target from this branch"). A parallel "Expected Fail-Closed States After `npm run
check`" section was added, listing the expected fail-closed report shape for every gated command on
a fresh checkout, and explicitly noting that `npm run check` passing says nothing about local
`.env`/endpoint/evidence readiness. `docs/phase5/phase5-toss-completion-checklist.md` and
`docs/phase5/toss-read-only-verification-checklist.md` gained matching "Current Status" sections
with the same accounts/holdings-completed, market-prices-pending framing and cross-references back
to the runbook. `docs/phase5/README.md` gained a short "Current Read-Only Target Status" summary
pointing at the runbook for full detail. No real operator-machine values (timestamps, item counts,
account references, tokens) were added anywhere — confirmed by reading every changed line; the
runbook's own new text explicitly instructs using only generic placeholder language (e.g.
`2026-XX-XXTXX:XX:XXZ`, `N items`) when describing what a receipt looks like. No live-trading-
implying language was added — every new sentence in this diff either restates or narrows the
existing safety boundary.

## Commands Run and Results

All commands below were run in this worktree
(`/Users/mac/Documents/Codex/aios-phase5-worktrees/round5-eng4`) after `git merge main` (merge
commit `0230255`, bringing in P5-016 `71a32f1`, P5-017 `efe0e0c`, P5-018 `f89cc36`), with no real
`.env` file present in this worktree (confirmed: only `.env.example` exists). Local
`tmp/phase5/*.local.json` template files were generated for this review by running
`npm run phase5:toss:local-setup -- --templates-only`, which — read directly from
`scripts/phase5-toss-local-setup.mjs` — skips the entire `.env`-writing branch of the script (no
prompt, no read, no write to `.env`) and only writes local template JSON files under `tmp/phase5/`;
this performed no network call and did not touch any real credential.

```text
$ npm run check
```
Real exit code: **0**. `tsc -p tsconfig.json --noEmit` reported zero errors. `vitest run` reported
**82 test files passed, 603 tests passed, 0 failed** (matching the orchestrator's reported merged-
main numbers exactly). An earlier `npm run check` run in this same worktree, taken *before* this
merge while three other engineers' worktrees were running their own test suites in parallel on the
same machine, showed one unrelated flaky failure
(`tests/persistence/migrations.test.ts > applies all migrations to a clean test database`, a PGlite
startup timeout under CPU contention, confirmed unrelated to any Phase 5/Toss file and confirmed to
pass cleanly — in under half the time — when run against the original non-worktree repository path
at the same moment). That flake did not recur in this final, uncontended run.

```text
$ npm run phase5:toss:readiness
```
Real exit code: **1**. `{"ready": false, "safeToAttemptReadOnlyCalls": false,
"liveBrokerWriteAllowed": false, "missingFields": ["TOSS_API_BASE_URL", "TOSS_CLIENT_ID",
"TOSS_CLIENT_SECRET", "TOSS_ACCOUNT_REF"], "reasonCodes": ["missing_or_placeholder_toss_account_ref",
"missing_or_placeholder_toss_api_base_url", "missing_or_placeholder_toss_client_id",
"missing_or_placeholder_toss_client_secret", "toss_read_only_mode_not_true"], "safetyType":
"TOSS_READ_ONLY_LOCAL_READINESS_REPORT"}`. Fails closed because no real `.env` exists in this
worktree. No secret value appears in the output (there is none to leak).

```text
$ npm run phase5:toss:endpoints -- tmp/phase5/toss-read-only-endpoints.local.json
```
Real exit code: **0**. `{"valid": true, "itemCount": 4, "verifiedEndpointCount": 0, "reasonCodes":
[], "warnings": ["endpoint_not_verified_official-accounts-read-candidate",
"endpoint_not_verified_official-auth-token-read-candidate",
"endpoint_not_verified_official-holdings-read-candidate",
"endpoint_not_verified_official-market-prices-read-candidate"], "liveBrokerWriteAllowed": false,
"safetyType": "TOSS_READ_ONLY_ENDPOINT_CATALOG_LOCAL_REPORT"}`. The catalog structure is valid (4
candidate entries, including a market-prices candidate seeded by the local-setup helper from
official docs), but every entry — including the market-prices one — is `verified: false`, so P5-016's
`market_data_endpoint_not_verified_in_catalog` gate would correctly block a real market-prices
attempt in this environment right now.

```text
$ npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Real exit code: **0** (doctor is a diagnostic report, not a gate, so it always exits 0).
`readyForReadOnlyVerification: false`. Blocking reason codes list the same missing/placeholder
credential fields as readiness, plus four `intake_not_human_reviewed_*` codes for the example
intake worksheet's four template items. `liveBrokerWriteAllowed: false`,
`networkCallsPerformed: false`, `preparedRequestCount: 0`.

```text
$ npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Real exit code: **1** (fails closed, as expected in this state). `readyForReadOnlyCall: false`,
`readyForOpenQuestionReview: false`, `commandCount: 6`. `reasonCodes` aggregate the same
missing/placeholder credentials, unreviewed intake items, and
`openQuestions_missing_valid_evidence_oq-001/002/003/004` (all four — this environment's evidence
manifest is empty). `liveBrokerWriteAllowed: false`, `networkCallsPerformed: false` held.

```text
$ PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Real exit code: **1** (fails closed, as expected in this state — the approval flag alone does not
make underlying readiness real). `phase5TossPreparationComplete: false`,
`readyForFirstRealReadOnlyCall: false`, `nextAction: "Finish local .env setup, official endpoint
verification, sanitized evidence intake, preflight, and call-gate approval first."`. `reasonCodes`
are the full `call_gate_preflight_*` chain (credentials, intake, open-question evidence) plus
`read_only_call_gate_not_ready`. **`liveBrokerWriteAllowed: false` and `networkCallsPerformed: false`
both held even with the approval flag set** — confirming this command performs no network call
regardless of the flag, exactly as expected: `phase5:toss:completion` is a local diagnostic that
composes preflight/call-gate child-process reports, not a call-performing command.

No command run in this review performed a real network call. Every report above carries
`networkCallsPerformed: false` (or, for `endpoints`, no such field, because its validator opens no
connection — confirmed by source review, unchanged from prior rounds); the static source scan in
`tests/scripts/phase5-toss-network-safety-static.test.ts` (46 tests, unchanged from before this
round, all passing) locks every listed script's source against `fetch(`/`https.request`/`axios`/
etc.; and this review did not separately invoke `scripts/phase5-toss-read-only-verify.mjs` itself
(with or without the approval flag) for any target — that script was exercised only inside its own
mock-server test suite as part of `npm run check`, never against this worktree's real (nonexistent)
credentials or the real Toss API, per this task's explicit instruction to never perform, simulate,
or approve a real Toss call in any phase.

## Whether Market-Prices Remains Mock-Only Or Is Ready For One Human-Approved Attempt

**Mock-only in this environment, but the machinery for a human-approved attempt is now built,
merged, and tested for the first time this round.**

What is new and verified in round 5: `TossReadOnlyHttpClient.getMarketPrices()` and
`scripts/phase5-toss-read-only-verify.mjs`'s `market-prices` target are real, working code — not a
design — proven end-to-end against a mock server to require approval, require a passing preflight
and call gate, require an *additional*, market-prices-specific verified-endpoint-catalog check that
`accounts`/`holdings` do not need, perform exactly one call, and write only a sanitized item count
(never a raw symbol or price) to `tmp/phase5/`. `TossReadOnlyVerificationResultValidator` (round 4,
unchanged) is proven in this round's own test suite to accept that exact market-prices receipt
shape.

What is still missing and makes an actual market-prices attempt unsafe right now, confirmed by
running the real commands above against this worktree (not assumed): no real `.env` credentials
exist here (`phase5:toss:readiness` reports `ready: false`, exit 1); the market-prices endpoint
catalog entry is `verified: false` in the local template catalog (`verifiedEndpointCount: 0`), so
P5-016's own additional gate (`market_data_endpoint_not_verified_in_catalog`) would independently
block the attempt even if generic preflight somehow passed; the evidence intake worksheet is
entirely unreviewed placeholder text; the evidence manifest is empty
(`openQuestions_missing_valid_evidence_oq-001/002/003/004`, all four); `phase5:toss:preflight` fails
closed (exit 1); and `PHASE5_TOSS_READ_ONLY_CALL_APPROVED` was never set to `"true"` for any command
that would actually attempt a network call in this review.

In short: `market-prices` is at the same readiness stage `accounts` and `holdings` were at the end
of round 4 — real, tested, gated code with no real-world attempt made yet. It is *not* yet ready for
a human-approved real attempt in this specific environment (no credentials, no verified endpoint, no
reviewed evidence), but the code path itself is no longer hypothetical.

## Whether Evidence Receipts Remain Sanitized

Yes, confirmed by direct source reading and by the tests summarized above. Every receipt field is
screened by `TossReadOnlyEvidenceReceiptValidator` against the same secret-like, account-identifier-
like, raw-response-like, and request-header-like patterns already used elsewhere in this file, plus
new source-reference checks (path traversal, remote URL scheme, `.env` reference). `rawPayloadStored
!== false` and `liveBrokerWriteAllowed !== false` are both outright rejected, not merely warned
about. Neither `TossReadOnlyEvidenceReceiptRecord` nor any type in this new section ever reads
`sourceReference` from disk — the reference is a string used only for path-shape screening and
duplicate detection, never dereferenced. No new code path was found anywhere in this round's diff
that could write, log, or return a raw response body, raw symbol, raw price, header, token, or
account identifier.

## Whether Docs Accurately Describe Accounts/Holdings Already Verified

Mostly yes, with one stale detail this task corrected. P5-018's runbook, checklist, and README
changes correctly describe `accounts` and `holdings` as completed by the human operator, correctly
state that real receipts live only in git-ignored `tmp/phase5/` and `.env`, and correctly avoid any
real operator-machine value.

However, because P5-016 and P5-018 ran in parallel this round without seeing each other's final
diff, P5-018's merged text describes `market-prices` as: "This is the next target. Support for it is
being added as a separate, parallel effort and is not yet available as a real call target from this
branch" (`docs/phase5/local-toss-read-only-runbook.md`, "Current Verification Status") and,
similarly, in `docs/phase5/phase5-toss-completion-checklist.md`: "It is not yet available as a real
call target on this branch — support for it is being added as a separate, parallel effort." Both
statements were accurate when P5-018 was written, but are no longer accurate after P5-016 merged:
`market-prices` **is** now available as a real call target on this branch (implemented, mock-tested,
merged) — it has simply not yet been attempted for real by a human operator, which is a different
and more specific state than "not yet available."

Because `docs/phase5/local-toss-read-only-runbook.md` and `docs/phase5/phase5-toss-completion-checklist.md`
are both explicitly listed as allowed supporting files for this task (P5-019), this task corrected
both sentences narrowly — see "Change Log" below for the exact edits — to distinguish three states
instead of two: **COMPLETED** (accounts, holdings — real operator receipt exists),
**IMPLEMENTED, MOCK-TESTED, AWAITING HUMAN ATTEMPT** (market-prices — real code exists and is
merged, but no real receipt exists yet), and there is currently no target in the third state,
**NOT YET IMPLEMENTED**. No other content in either file was changed; the safety boundary, the
fail-closed language, and every other section are unchanged from P5-018's merged version.
`docs/phase5/README.md` and `docs/phase5/toss-read-only-verification-checklist.md` contain the same
kind of stale wording but are not in this task's allowed-file list (they belong to P5-018/Engineer 3
alone) and were left untouched; they are noted here for whichever future task next has permission to
touch them.

## Safety Invariant Status (liveBrokerWriteAllowed, rawPayloadStored, networkCallsPerformed)

**`liveBrokerWriteAllowed`** is `false` in every report produced in this review: `readiness`,
`endpoints`, `doctor`, `preflight`, `completion` (including with the approval flag set). Read
directly from source, it is also a literal (non-computed) `false` on: every return path of
`TossReadOnlyHttpClient`, including the new `getMarketPrices()` (via the unchanged
`#metadataFor()`/`#errorResult()` helpers); the P5-016 runner's report object and its market-prices
code path specifically (3 literal occurrences in `scripts/phase5-toss-read-only-verify.mjs`,
confirmed by direct grep); and every field and method result in the P5-017 receipt pipeline
(`TossReadOnlyEvidenceReceiptReview`, `TossReadOnlyEvidenceReceiptOperatorSummary`). No code path
found in this review computes this field from any input, including a set human approval flag, a
passing preflight, a passing call gate, a passing market-prices-specific endpoint-verification gate,
or a successful real call — it is hardcoded `false` everywhere it appears across all of round 5.

**`rawPayloadStored`** is `false` as a hardcoded literal in the P5-016 runner's report object and in
every evidence file it writes for every target including market-prices, and is independently
rejected if not exactly `false` by both the round-4 `TossReadOnlyVerificationResultValidator` and
the new round-5 `TossReadOnlyEvidenceReceiptValidator`. Consistent with this,
`TossReadOnlyHttpClient.getMarketPrices()` and the script's `fetchTargetItemCount()` both extract
only an item count from a real response and discard the parsed payload immediately afterward — there
is no code path in either file that could write a raw payload to disk even if the hardcoded literal
were removed. No raw payload storage was observed, and none is reachable in the merged code.

**`networkCallsPerformed`** is `false` in every report produced in this review (`doctor`, `preflight`,
including `completion` with the approval flag explicitly set — confirmed directly above, not
assumed). It remains a literal `false` on `scripts/phase5-toss-read-only-verify.mjs`'s initial report
object and only becomes `true` inside `issueAccessToken()` immediately before the first real
`fetch()` call, for any target including market-prices — unchanged in shape from round 4, just now
also correct for the third target. No real Toss API call was made at any point during this review.

## Remaining Blockers Before The Next Human-Only Read-Only Call

Before a human operator could actually attempt a real `market-prices` call (or a repeat `accounts`/
`holdings` call), the following remain true in this environment and can only be done by the
operator, locally, never by an AI agent (per `docs/phase5/local-toss-read-only-runbook.md` Steps 1-8
and `docs/11_AI_RULES.md` Rules 18/19):

1. Create or update a real local `.env` with real (non-placeholder) `TOSS_API_BASE_URL`,
   `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, and `TOSS_ACCOUNT_REF`, keeping
   `LIVE_TRADING_ENABLED=false` and `TOSS_READ_ONLY_MODE=true`. No real `.env` exists in this
   worktree.
2. Verify the `MARKET_DATA_READ` / `/api/v1/prices` endpoint catalog entry specifically against
   official Toss documentation or developer console evidence and set `verified: true` — this is a
   distinct, additional requirement from the generic "at least one verified endpoint" that
   `accounts`/`holdings` rely on, enforced independently by P5-016's own
   `isMarketDataEndpointVerified()` gate. All 4 candidate entries in
   `tmp/phase5/toss-read-only-endpoints.local.json` are currently `verified: false`.
3. Prepare a Step-4 approval artifact scoped to whichever single operation (`MARKET_DATA_READ` or
   otherwise) is being attempted.
4. Review and sanitize the relevant evidence intake item(s) and set `reviewedByHuman: true` (all 4
   example intake items are currently unreviewed placeholder text).
5. Run `npm run phase5:toss:preflight` and confirm `readyForReadOnlyCall: true`.
6. Run `PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:call-gate` and confirm
   `readyToAttemptRealReadOnlyCall: true`.
7. Only then, run exactly one of:
   ```bash
   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- accounts
   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- holdings
   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- market-prices
   ```
8. After the call, manually review the sanitized evidence file written under `tmp/phase5/`, copy a
   real sanitized summary into an evidence intake item, mark it `reviewedByHuman: true`, run
   `npm run phase5:toss:promote-intake`, then `npm run phase5:toss:open-questions` to see whether
   the relevant open question (OQ-002 for accounts/holdings, OQ-004 for market-prices) now has
   enough evidence for human review — this still does not resolve the open question; a human must
   separately update `docs/open_questions.md`.

None of these are code defects. They are the intended fail-closed state of a system that has not yet
received real credentials, a real verified market-data endpoint, a real approval artifact, or real
human-reviewed evidence — exactly what `docs/phase5/local-toss-read-only-runbook.md`'s "Final Rule"
describes as expected, not a bug to work around.

## Live Trading Is Still Blocked

Live trading is still blocked. Nothing in P5-016, P5-017, P5-018, or this P5-019 review authorizes
Toss order creation, order cancellation, order replacement, any transfer, withdrawal, or
money-moving currency conversion, or any other use of production capital. `liveBrokerWriteAllowed`
is hardcoded `false` throughout every Phase 5 script and service reviewed here — in the extended
HTTP client, the extended verification runner, and the strengthened receipt pipeline alike — with no
input, including a set human approval flag, a passing preflight, a passing call gate, a passing
market-prices-specific endpoint-verification gate, or a successfully completed real read-only call,
able to flip that value. Live broker write authorization remains a separate decision gated by
`docs/11_AI_RULES.md` (Rules 1, 4, 14, 17, 22, 23), the risk engine, the money management engine, the
order approval engine, and explicit compliance sign-off — none of which Phase 5 implements or
bypasses.

## Phase 1 Regression Gap Check (Pre-Merge Baseline)

This section records the phase-1 regression-gap check against the current
(pre-P5-016/P5-017/P5-018) state of the repository, as required by task P5-019. It documents what
was true before those three tasks existed. Per the P5-019 task document, this round's phase-1
regression scope is `tests/scripts/phase5-toss-network-safety-static.test.ts` specifically, and
the check below is scoped to that file plus the current shape of the script it locks.

### Scope Reviewed

- `tests/scripts/phase5-toss-network-safety-static.test.ts` (current pre-merge state, 46 tests)
- `scripts/phase5-toss-read-only-verify.mjs` (current pre-merge state, already supports `accounts`
  and `holdings` targets; already includes a real fix commit `6d6308b` "Fix Toss holdings
  read-only verification" that predates this round and is already part of the local `main` tip
  this worktree branched from)
- All other scripts under `scripts/*.mjs` referenced anywhere in the static test file's coverage
  arrays

### Question Asked By The Task

P5-016 is expected to add a market-prices target inside the *same, already-existing*
`scripts/phase5-toss-read-only-verify.mjs` file (per the P5-016 task document, which lists that
file and `src/adapters/toss/toss-read-only-http-client.ts` as primary files to modify, not new
files to create). The question for phase 1 is whether the *current* structure of
`tests/scripts/phase5-toss-network-safety-static.test.ts` already correctly tracks this script as
network-capable-but-approval-gated, such that a same-shape addition (a third fixed target added to
an already-included, already-excluded-from-the-no-network-scan file) would not require any test
update — or whether the current test structure has a genuine gap today, independent of guessing
at P5-016's actual diff.

### Finding: Current Coverage Is Already File-Level, Not Target-Level

Read directly from `tests/scripts/phase5-toss-network-safety-static.test.ts`:

- `allPhase5TossScripts` (the no-network-call static scan, 12 entries) does **not** include
  `phase5-toss-read-only-verify.mjs`. It is correctly and already excluded, with an inline
  comment explaining why (it legitimately performs real network calls once approved).
- `scriptsWithNetworkCallsFlag` (the hardcoded-`networkCallsPerformed:false` scan, 8 entries) also
  does **not** include `phase5-toss-read-only-verify.mjs`, correctly, because that script's
  `networkCallsPerformed` value is genuinely computed (starts `false`, becomes `true` once a call
  is attempted), not a hardcoded literal.
- `scriptsWithLiveBrokerWriteFlag` (the hardcoded-`liveBrokerWriteAllowed:false` scan, 14 entries)
  **does** include `phase5-toss-read-only-verify.mjs`, with an inline comment explaining why it
  belongs in this list specifically and not the other two.

All three of these checks operate on the *entire file's source text* via `readFileSync` plus a
single `RegExp.test()` call — they do not parse per-target code blocks, do not count occurrences,
and do not require every occurrence of a pattern to match a specific target. A regex `test()` call
returns `true` on the first match anywhere in the file. This means the check is inherently
file-level: it asks "does this file, as a whole, ever contain a network-call pattern" (for the
no-network scan) or "does this file, as a whole, contain the literal `liveBrokerWriteAllowed:
false` at least once" (for the write-flag scan) — not "does every code path in this file satisfy
this property individually."

Confirmed directly: `scripts/phase5-toss-read-only-verify.mjs` already contains **three**
occurrences of the literal `liveBrokerWriteAllowed: false` today (verified with
`grep -c`), one more than a single-target script would need, because the script already handles
two targets (`accounts`, `holdings`) plus a shared safety-report shape. The existing test only
asserts the pattern matches *at least once*, so this multiplicity already exists today and the
test already tolerates it.

### Conclusion: No Test Update Required For A Same-Shape P5-016 Addition

Given the file-level (not target-level) design above, adding a third fixed target
(`market-prices`) to the same, already-covered `scripts/phase5-toss-read-only-verify.mjs` file —
provided P5-016 keeps the target inside a fixed allow-list (as its task document requires: "Market-
prices target is available only through a fixed read-only allow-list") and keeps hardcoding
`liveBrokerWriteAllowed: false` somewhere in the file (as every other Phase 5 Toss script already
does) — requires **no change** to
`tests/scripts/phase5-toss-network-safety-static.test.ts`. The file would remain correctly
excluded from the no-network scan, remain correctly excluded from the
hardcoded-`networkCallsPerformed:false` scan, and continue to satisfy the
`liveBrokerWriteAllowed: false` literal-presence check, exactly as it does today with two targets.

This assessment is intentionally scoped to *whether the current test structure needs updating for
a change of this shape* — it is not a claim about what P5-016's actual diff will contain, and it
does not inspect or assume any P5-016 code, which does not exist yet at the time of this phase-1
check. If P5-016's actual merged diff turns out to introduce a new script file (rather than
extending the existing one), removes the existing hardcoded `liveBrokerWriteAllowed: false`
literal in favor of a computed value, or introduces a new network-call pattern not already covered
by `forbiddenNetworkPatterns`, phase 2 of this review will re-examine that specific diff and close
any gap found at that time — but none of that can be verified or assumed now.

### Additional Checks Performed (No Gap Found)

To confirm the file-level design above is not already hiding a different, genuine gap today, the
following were also checked directly against the pre-merge codebase:

- Every `.mjs` file under `scripts/` (14 total) was cross-referenced against
  `allPhase5TossScripts` (12 entries) plus the two explicitly-excluded network-capable scripts
  (`phase5-toss-account-ref-setup.mjs`, `phase5-toss-read-only-verify.mjs`). All 14 files are
  accounted for; no script is silently missing from every coverage list.
- All 14 scripts were grepped for the literal `liveBrokerWriteAllowed: false`; all 14 contain it
  at least once, matching all 14 entries in `scriptsWithLiveBrokerWriteFlag`.
- The four scripts absent from `scriptsWithNetworkCallsFlag`
  (`check-toss-readiness.mjs`, `report-toss-open-questions.mjs`, `validate-toss-endpoints.mjs`,
  `validate-toss-evidence-manifest.mjs`) were confirmed by direct grep to not contain a
  `networkCallsPerformed` field at all — their absence from that list is correct, not a gap.
- `scripts/*.mjs` were grepped for bare (non-`node:`-prefixed) `http`/`https`/`net`/`tls`/`dns`
  imports that could bypass the `forbidden network patterns` regex set (which matches
  `node:https?` specifically). No such bare import exists anywhere in `scripts/`.
- `npx vitest run tests/scripts/phase5-toss-network-safety-static.test.ts` was run directly against
  the current pre-merge worktree state (which already includes the pre-existing, out-of-round fix
  commit `6d6308b`): **46 tests passed, 0 failed**.

### Result

No genuine current gap was found in `tests/scripts/phase5-toss-network-safety-static.test.ts`.
No test was added or modified in this phase. This differs from round 3 (P5-011, which closed a
gap in preflight-script approval-flag coverage) and round 4 (P5-015, which closed a gap in
`scriptsWithLiveBrokerWriteFlag` coverage for two scripts) — this round's phase-1 check found the
file already correctly structured for the specific shape of change P5-016 is expected to make.

## Change Log

- Phase 1: scaffold created, regression-gap check performed against the pre-merge codebase (no
  gap found; no test added or modified). No integration or readiness content written.
  `docs/tasks/phase5_claude_worktree_tasks/README.md` was not touched in this phase.
- Phase 2: merged local `main` (P5-016 `71a32f1`, P5-017 `efe0e0c`, P5-018 `f89cc36`) into this
  branch; replaced all placeholder sections with content based on direct reading of the merged
  files; re-confirmed the phase-1 static-test assessment against the real P5-016 diff (no test
  update needed, confirmed by running `tests/scripts/phase5-toss-network-safety-static.test.ts`
  directly against the merged state: still 46/46 passing, file unchanged since round 4); corrected
  two stale sentences describing `market-prices` as "not yet available as a real call target on
  this branch" in `docs/phase5/local-toss-read-only-runbook.md` ("Current Verification Status")
  and `docs/phase5/phase5-toss-completion-checklist.md` ("Current Status") — both allowed
  supporting files for this task — to instead distinguish "completed" (accounts, holdings) from
  "implemented, mock-tested, awaiting human attempt" (market-prices), since P5-016 merged the
  actual implementation in parallel with P5-018 writing that now-stale wording; re-ran `npm run
  check` and the required Phase 5 commands against the merged state with real exit codes recorded
  above; updated `docs/tasks/phase5_claude_worktree_tasks/README.md` with the round-5 merge
  summary. No real Toss API call was performed, simulated, or recommended for immediate execution
  at any point in this task.
