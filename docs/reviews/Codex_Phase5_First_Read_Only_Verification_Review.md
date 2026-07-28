# Codex Phase 5 First Read-Only Verification Review

Version: 0.2.0
Status: Complete for round 4 (P5-012 through P5-015)
Review Date: 2026-07-29

## Document Purpose

This document is the Phase 5 round 4 integration review (task P5-015). It was produced in two
phases:

- Phase 1: read the round-4 task set (P5-012, P5-013, P5-014), ran a regression-gap check against
  the pre-merge codebase, closed one genuine gap found with a narrow test, and laid out a scaffold.
  No integration or readiness content was written in phase 1, because Engineer 1 (P5-012) and
  Engineer 3 (P5-014) had not yet been merged into `main`, and Engineer 2 (P5-013) had not started
  at all — P5-013 depended on P5-012 and P5-014 merging first.
- Phase 2 (this content): after the orchestrator merged P5-012 (`76da4f2`), P5-014 (`5d1d85b`), and
  P5-013 (`78e8798`, current local `main` tip) into local `main`, this section fills in every
  scaffold placeholder with real content based on reading the actual merged files, and re-runs the
  full verification suite against the merged state.

The phase 1 regression-gap check and forward-looking assessment are preserved unchanged below,
under "Phase 1 Regression Gap Check (Pre-Merge Baseline)", because they document what was true
before P5-012/P5-013/P5-014 existed, matching the precedent set by
`docs/reviews/Codex_Phase5_Readiness_Review.md`'s round-3 phase 1 section.

## Summary

Round 4 (P5-012 through P5-015) added the first real Toss HTTP transport, the first script capable
of performing one real human-approved Toss read-only call, and strengthened the sanitized evidence
pipeline that accepts that script's output. It did not collect any real Toss evidence and did not
change the live-trading boundary.

- P5-012 added `TossReadOnlyHttpClient` (`src/adapters/toss/toss-read-only-http-client.ts`), a real
  HTTP transport limited to exactly three operations (`authenticate`, `getAccounts`,
  `getHoldings`) plus a hardcoded safety report, with no generic request escape hatch.
- P5-014 strengthened `read-only-evidence-intake.ts`, `read-only-evidence-manifest.ts`, and
  `open-question-evidence-tracker.ts` with canonical evidence-kind-to-open-question mapping,
  content-shape rejection (raw JSON/HTML, header-like text, account-number-like digit runs) beyond
  keyword matching, and a new `TossReadOnlyVerificationResultValidator` that accepts exactly the
  receipt shape a verification runner produces.
- P5-013 added `scripts/phase5-toss-read-only-verify.mjs`, the first script that can perform one
  real, human-approved Toss read-only call (`accounts` or `holdings`), gated by an exact-string
  approval flag, a live preflight run, a live call-gate run, and a defense-in-depth local readiness
  re-check, all before any network call happens.
- P5-015 (this task) merged all three, read every changed file directly, closed one further narrow
  static-test coverage gap in `tests/scripts/phase5-toss-network-safety-static.test.ts`, wrote this
  review, and re-verified `npm run check` plus the five required Phase 5 commands against the
  merged codebase.

After all of round 4, in the default local state of this worktree (no real `.env`, no verified
endpoint catalog entry, no human-reviewed evidence intake, no approval flag set): `phase5:toss:readiness`,
`phase5:toss:preflight`, and `phase5:toss:completion` all fail closed as expected (exit 1), and
`liveBrokerWriteAllowed: false` / `networkCallsPerformed: false` hold in every report from every
command. No `rawPayloadStored: true` value was observed or is reachable anywhere in the merged
code. Live trading remains fully blocked, and no real Toss API call has been made by any AI agent
at any point in this task.

## What Changed in P5-012 (HTTP Client)

Files added: `src/adapters/toss/toss-read-only-http-client.ts` (new, 557 lines),
`tests/adapters/toss-read-only-http-client.test.ts` (new, 13 tests). `src/adapters/toss/index.ts`
gained one export line for the new module (confirmed by reading the merge diff — no other change
to that file).

Read directly from source: `TossReadOnlyHttpClient` exposes exactly four public methods —
`authenticate()` (`POST /oauth2/token`), `getAccounts()` (`GET /api/v1/accounts`),
`getHoldings()` (`GET /api/v1/holdings`), and `getSafetyReport()`. There is no generic
`request(path, method, body)` method anywhere in the class, so no caller can construct a request
outside those three real operations through this client — order creation, cancellation,
modification, transfer, and withdrawal have no code path in this file at all. Credentials
(`#clientId`, `#clientSecret`), the cached token (`#cachedToken`), and internal helpers
(`#buildUrl`, `#ensureToken`, `#metadataFor`, `#errorResult`) are true ECMAScript private fields
(the `#` syntax), not just TypeScript `private` — they are unreachable, non-enumerable, and
unspoofable at runtime, not merely hidden at the type level. The client's own test
("has no public API surface capable of constructing a write-looking request") verifies this by
inspecting `Object.getOwnPropertyNames` on the class prototype.

Every successful result and every error carries `liveBrokerWriteAllowed: false` as a literal
(non-computed) value, set in `#metadataFor()` and `#errorResult()`, both of which hardcode the
literal directly rather than deriving it from any input. `getSafetyReport()` returns a fixed object
with `allowedOperations: ["AUTHENTICATION_READ", "ACCOUNT_SNAPSHOT_READ", "POSITION_QUERY_READ"]`
and the same hardcoded `liveBrokerWriteAllowed: false`. Base URL construction
(`normalizeBaseUrl()`) only accepts `https://` URLs, or `http://127.0.0.1` / `http://localhost`
solely so tests can point the client at a local mock server; any other value throws at
construction time before any network code runs. Account numbers, when present in a real Toss
response, are masked to at most the last 4 characters (`maskAccountNumber()`); the access token
itself is stored only in the private `#cachedToken` field and is never included in any returned
summary, error, or log line — confirmed by reading every return path in `authenticate()`,
`getAccounts()`, and `getHoldings()`.

Test coverage (13 tests, all passing, all against a local `node:http`-style fetch stub or mock
server — zero real network calls) proves, among other things: the safety metadata matches the
fixed allow-list; the client authenticates and never returns the raw token; account and holding
responses are sanitized and typed; a cached token is reused across `getAccounts`/`getHoldings`
instead of re-authenticating on every call; non-2xx responses at every endpoint fail closed with a
sanitized reason code (not a raw response body); a missing `access_token` field in the token
response fails closed; a non-`https`, non-local base URL is rejected at construction time; and the
client secret is never sent to the accounts or holdings endpoints (only the bearer token is).

## What Changed in P5-013 (First Verification Runner)

Files added: `scripts/phase5-toss-read-only-verify.mjs` (new, 360 lines),
`tests/scripts/phase5-toss-read-only-verify-script.test.ts` (new, 13 tests). `package.json` gained
one script entry, `"phase5:toss:verify-read-only": "node scripts/phase5-toss-read-only-verify.mjs"`.
`docs/phase5/local-toss-read-only-runbook.md` Step 9 and
`docs/phase5/toss-read-only-verification-checklist.md` item 9 were rewritten to describe the real
script and command instead of describing it as future work.

Read directly from source: like `scripts/phase5-toss-account-ref-setup.mjs`, this is a plain
`.mjs` script with no TypeScript import — this repository has no build step or `ts-node`/`tsx`
dependency, so a `.mjs` script cannot import a `.ts` module directly. The script mirrors
`TossReadOnlyHttpClient`'s safety shape (fixed operation set, hardcoded `liveBrokerWriteAllowed:
false`, no generic request path) rather than importing it. It supports exactly two targets,
`accounts` and `holdings`, defined in a fixed `ALLOWED_TARGETS` object — there is no way to reach
an order, cancel, modify, transfer, or withdrawal path through this script's argument parsing, and
an unrecognized or missing target fails closed before anything else runs.

The gate sequence, read directly from `main()`: (1) reject unknown/missing targets; (2) require
`PHASE5_TOSS_READ_ONLY_CALL_APPROVED` to equal the exact string `"true"` — no other truthy-looking
value is accepted; (3) run `npm run phase5:toss:preflight` as a real child process and fail closed
if it does not report `readyForReadOnlyCall: true`; (4) run `npm run phase5:toss:call-gate` as a
real child process and fail closed if it does not report `readyToAttemptRealReadOnlyCall: true`;
(5) re-validate local `.env` readiness directly in-process (live-trading-disabled, read-only-mode,
all four required credential fields present and non-placeholder) as defense in depth, independent
of the child-process results; only after all five checks pass does step (6) call
`performApprovedCall()`, which authenticates once and performs exactly one target read — no loop,
no retry, no second target. `networkCallsPerformed` starts `false` in the report object and is
only set to `true` inside `issueAccessToken()`, immediately before the first real `fetch()` call —
so it is `false` on every fail-closed path traced above and only becomes `true` once a network
call is actually attempted.

The script never extracts or stores per-item fields from a real response: `fetchTargetItemCount()`
reads only `items.length` from the parsed response body and discards everything else. Sanitized
evidence is written to `tmp/phase5/read-only-verify-<operation>-<timestamp>.json` (git-ignored)
containing only `operation`, `evidenceKind`, `collectedAt`, `itemCount`,
`liveBrokerWriteAllowed: false`, `networkCallsPerformed: true`, and `rawPayloadStored: false` — no
account numbers, symbols, quantities, tokens, or raw response bodies. The printed stdout report
matches this same sanitized shape plus `preflight`/`callGate` sub-reports and `reasonCodes`.

Test coverage (13 tests, all passing, all against a local mock `node:http` server, confirmed by
reading the test file — zero real network calls) proves: no approval means no network call; an
unknown or missing target means no network call; only the exact string `"true"` is accepted for
approval (not `"1"`, `"TRUE"`, `"yes"`); preflight/call-gate not being ready blocks the call even
with approval set; and — the most direct proof of end-to-end integration — an approved `accounts`
call against a mock server writes sanitized evidence only (no `mock-access-token`, no
`123-456-SECRET-9012` account-number fixture value, no `accountSeq`/`accountNo` field name
anywhere in stdout or the written evidence file), and the same test then feeds the script's exact
printed report into P5-014's real, merged `TossReadOnlyVerificationResultValidator` and asserts
`acceptedForIntakeDraft: true` with `suggestedRelatedOpenQuestion: "OQ-002"` — proving the P5-013
output shape and the P5-014 validator genuinely agree, not just that each was tested in isolation.
An equivalent `holdings` test proves the same for `POSITION_QUERY_READ`.

## What Changed in P5-014 (Evidence Pipeline)

Files changed: `src/application/toss/read-only-evidence-intake.ts` (+233 lines),
`src/application/toss/read-only-evidence-manifest.ts` (+54 lines),
`src/application/toss/open-question-evidence-tracker.ts` (+28/-4 lines), plus matching test files
(`tests/application/toss-read-only-evidence-intake.test.ts`, 32 tests;
`tests/application/toss-read-only-evidence-manifest.test.ts`, 9 tests;
`tests/application/toss-open-question-evidence-tracker.test.ts`, 8 tests).

Read directly from source: a new `openQuestionForEvidenceKind()` function in
`read-only-evidence-intake.ts` defines a canonical, fixed mapping from Toss evidence kind to open
question — `ACCOUNT_SNAPSHOT_READ` and `POSITION_QUERY_READ` both map to `OQ-002`,
`AUTHENTICATION_READ`/`API_TERMS_REVIEW` to `OQ-001`, `ORDER_STATUS_QUERY_READ`/`FILL_QUERY_READ`
to `OQ-003`, and the three ETF/fractional/extended-hours documentation kinds to `OQ-004`
(`MARKET_DATA_READ` intentionally has no canonical mapping). This mapping is now enforced, not just
advisory: `TossReadOnlyEvidenceIntakeValidator.review()` rejects an item whose declared
`relatedOpenQuestion` disagrees with its kind's canonical mapping
(`intake_open_question_mismatch_<id>`); `TossReadOnlyEvidenceManifestValidator.review()` does the
same for manifest entries (`manifest_evidence_open_question_mismatch_<id>`); and
`TossOpenQuestionEvidenceTracker.review()` now excludes mismatched evidence from an open question's
count entirely (rather than trusting the item's self-declared `relatedOpenQuestion`) and surfaces
`evidence_open_question_mismatch_<id>` reason codes for any such item. This closes exactly the gap
the round-3 review anticipated: evidence can no longer silently pad the wrong open question's
count.

Both `read-only-evidence-intake.ts` and `read-only-evidence-manifest.ts` gained content-shape
rejection patterns beyond the pre-existing keyword-based secret scan: `accountIdentifierLikePattern`
rejects long digit runs (6+ digits) that look like account or card numbers; `rawResponseLikePattern`
rejects text shaped like a raw JSON body, a JSON array of objects, an HTML document, or an HTTP
status line; `requestHeaderLikePattern` rejects text shaped like a raw header or cookie line. The
manifest validator applies these even when an item's own `sanitized: true` / `containsCredential:
false` flags claim it is already safe — read directly from the code comment: "a manifest can be
hand-authored or loaded from JSON outside the intake pipeline, so the boolean flags alone must
never be trusted as the only safety check."

The most significant new piece is `TossReadOnlyVerificationResultValidator` (new class in
`read-only-evidence-intake.ts`), built specifically to accept the receipt shape a verification
runner produces: `{ operation, evidenceKind, sanitizedEvidencePath, liveBrokerWriteAllowed: false,
networkCallsPerformed, rawPayloadStored: false }`. Its `review()` method rejects a write-scoped
operation (by allow-list and by a `writeOperationPattern` regex), rejects `rawPayloadStored: true`
or `liveBrokerWriteAllowed: true` outright, rejects an evidence path containing `..` (path
traversal), a remote URL scheme, a reference to `.env`, or secret/account-identifier/raw-response-shaped
text. Its `draftIntakeItem()` method builds an intake item stub from an accepted result, but always
sets `reviewedByHuman: false` and `sanitizedSummary: ""` — it never reads the referenced evidence
file itself and never auto-promotes anything; a human still has to open the file, write a real
summary, and mark the item reviewed before `TossReadOnlyEvidenceIntakeValidator` will accept it.
No open question was marked resolved by any part of this change — read directly from
`open-question-evidence-tracker.ts`, `liveTradingAuthorized: false` remains a hardcoded literal on
every review result, unchanged by this task.

Test coverage (32 + 9 + 8 = 49 tests, all passing, all pure in-memory unit tests with no network
and no file I/O beyond what vitest itself does) proves: sanitized account evidence can be
promoted; raw response examples are rejected; account-number-like strings are rejected in intake,
manifest, and verification-result paths; source references cannot contain bearer tokens or request
headers; open-question status changes only when evidence is valid, sanitized, and correctly mapped
to its canonical open question; and — cross-tested directly against P5-013's script in
`tests/scripts/phase5-toss-read-only-verify-script.test.ts` — a real script-produced report is
accepted by this validator end to end.

## Commands Run and Results

All commands below were run in this worktree
(`/Users/mac/Documents/Codex/aios-phase5-worktrees/round4-eng4`) after `git merge main` (merge
commit brings in P5-012 `76da4f2`, P5-014 `5d1d85b`, P5-013 `78e8798`), with no real `.env` file
present in this worktree (confirmed by `ls -la` showing only `.env.example`; the actual state
tested is a fresh-checkout-equivalent state, not a configured operator machine). Local
`tmp/phase5/*.local.json` template files (endpoint catalog candidates, an unreviewed example
evidence intake worksheet, an empty evidence manifest) were present from earlier `npm run check`
runs — the local-setup script's own test suite runs it for real against this worktree's `tmp/`
directory as part of its test coverage — and were read directly to confirm they contain only
placeholder/template content (`verified: false` on every endpoint candidate,
`reviewedByHuman: false` on every intake item, "Replace with..." placeholder text) before being
used as the paths the required commands below reference.

```text
$ npm run check
```
Real exit code: **0**. `tsc -p tsconfig.json --noEmit` reported zero errors. `vitest run` reported
**82 test files passed, 574 tests passed, 0 failed** (572 tests come from the merged main tip plus
the 2 additional static-scan regression tests added in this task's phase 1 and phase 2).

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
[], "warnings": ["endpoint_not_verified_official-accounts-read-candidate", "...auth-token...",
"...holdings...", "...market-prices..."], "liveBrokerWriteAllowed": false, "safetyType":
"TOSS_READ_ONLY_ENDPOINT_CATALOG_LOCAL_REPORT"}`. The catalog structure is valid (4 candidate
entries seeded from official docs by the local-setup helper), but every entry is `verified: false`
— zero endpoints are usable for a real call yet.

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
`readyForOpenQuestionReview: false`, `commandCount: 6`. `reasonCodes` aggregate missing/placeholder
credentials, unreviewed intake items, and `openQuestions_missing_valid_evidence_oq-001/002/003/004`
(all four, not just three — this environment's evidence manifest is empty, unlike round 3's example
manifest which had one template item). `liveBrokerWriteAllowed: false`,
`networkCallsPerformed: false` held.

```text
$ npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Real exit code: **1** (fails closed, as expected in this state). `phase5TossPreparationComplete: false`,
`readyForFirstRealReadOnlyCall: false`, `nextAction: "Finish local .env setup, official endpoint
verification, sanitized evidence intake, preflight, and call-gate approval first."`. `reasonCodes`
include `read_only_call_gate_not_ready`, `call_gate_human_read_only_call_approval_missing`, and the
full chain of `call_gate_preflight_*` codes propagated from the preflight run above.
`liveBrokerWriteAllowed: false`, `networkCallsPerformed: false` held.

No command run in this review performed a real network call. This is confirmed three independent
ways: every report above carries `networkCallsPerformed: false` (or, for `endpoints`, no network
field because its validator opens no connection); the static source scan in
`tests/scripts/phase5-toss-network-safety-static.test.ts` (46 tests, all passing) locks every
listed script's source against `fetch(`/`https.request`/`axios`/etc., correctly excluding only the
two scripts that legitimately perform real calls under human approval
(`phase5-toss-account-ref-setup.mjs`, `phase5-toss-read-only-verify.mjs`); and this review did not
separately invoke `scripts/phase5-toss-read-only-verify.mjs` itself (with or without the approval
flag) — that script was exercised only inside its own mock-server test suite, never against this
worktree's real (nonexistent) credentials or the real Toss API, per this task's explicit
instruction not to attempt or simulate the real call.

## Mock-Test Coverage

Every test added or changed in round 4 uses a mock HTTP transport (a local `node:http` server bound
to `127.0.0.1`, or an injected fetch stub) or pure in-memory validation — none contacts the real
Toss API. Counts below were confirmed by running each file directly with vitest, not merely by
reading task documents:

| File | Tests | What it proves |
|---|---:|---|
| `tests/adapters/toss-read-only-http-client.test.ts` | 13 | `TossReadOnlyHttpClient` transport safety (P5-012) |
| `tests/scripts/phase5-toss-read-only-verify-script.test.ts` | 13 | End-to-end runner gating and evidence writing (P5-013) |
| `tests/application/toss-read-only-evidence-intake.test.ts` | 32 | Intake validator, approval validator/ledger, verification-result validator (P5-014) |
| `tests/application/toss-read-only-evidence-manifest.test.ts` | 9 | Manifest content-shape and open-question-mapping rejection (P5-014) |
| `tests/application/toss-open-question-evidence-tracker.test.ts` | 8 | Open-question evidence counting with mismatch exclusion (P5-014) |
| `tests/scripts/phase5-toss-network-safety-static.test.ts` | 46 | Static source-level lock (P5-006/P5-011/P5-015) |

Full suite: **82 test files, 574 tests, 0 failed** (`npm run check`).

## Real-Network-Capable Scripts And Their Approval Gates

Two scripts in this repository can perform a real network call. Neither can do so without an
explicit precondition that fails closed by default:

1. **`scripts/phase5-toss-account-ref-setup.mjs`** (pre-existing, not part of round 4). Gate: runs
   only when `LIVE_TRADING_ENABLED` is not `"true"`, `TOSS_READ_ONLY_MODE` is `"true"`, and
   `TOSS_API_BASE_URL`/`TOSS_CLIENT_ID`/`TOSS_CLIENT_SECRET` are all present and non-placeholder in
   local `.env`. No separate human-approval flag is required — this script's own local-credential
   check is its only gate, by design (its purpose is a one-time account-ref lookup during initial
   setup, before the full preflight/call-gate chain is meaningful). Confirmed excluded from the
   no-network static scan and included in the `liveBrokerWriteAllowed: false` static scan in
   `tests/scripts/phase5-toss-network-safety-static.test.ts`.
2. **`scripts/phase5-toss-read-only-verify.mjs`** (new in P5-013). Gate, in order: (a) a known
   target (`accounts` or `holdings`); (b) `PHASE5_TOSS_READ_ONLY_CALL_APPROVED` equal to the exact
   string `"true"`; (c) a live `phase5:toss:preflight` child-process run reporting
   `readyForReadOnlyCall: true`; (d) a live `phase5:toss:call-gate` child-process run reporting
   `readyToAttemptRealReadOnlyCall: true`; (e) an in-process re-check of local `.env` readiness as
   defense in depth. All five must pass before the first `fetch()` call happens. This is
   substantially more heavily gated than the account-ref script, appropriate to it being the script
   that touches account/position data rather than only an account-reference lookup. Now confirmed
   included in both the no-network-scan exclusion and the `liveBrokerWriteAllowed: false` static
   scan (fixed in this task — see "Follow-Up on the Phase 1 Assessment" below).

Both scripts are excluded from `allPhase5TossScripts` (the no-network-call static scan) and from
`scriptsWithNetworkCallsFlag` (the hardcoded-`networkCallsPerformed:false` static scan) in
`tests/scripts/phase5-toss-network-safety-static.test.ts`, with comments in that file explaining
why for each. Every other script in `scripts/` remains fully covered by both static scans,
unchanged.

## liveBrokerWriteAllowed Status

`liveBrokerWriteAllowed` is `false` in every report produced in this review: `readiness`,
`endpoints`, `doctor`, `preflight`, `completion`. Read directly from source, it is also a literal
(non-computed) `false` on: every return path of `TossReadOnlyHttpClient` (P5-012, via
`#metadataFor()` and `#errorResult()`), every field and method result in the P5-014 evidence
pipeline (`TossReadOnlyEvidenceIntakeReview`, `TossReadOnlyEvidenceManifestPromotion`,
`TossReadOnlyCallApprovalReview`, `TossReadOnlyCallApprovalConsumption`,
`TossReadOnlyVerificationResultReview`, and `TossOpenQuestionEvidenceTracker`'s pre-existing
`liveTradingAuthorized: false`), and the P5-013 runner's report object (initialized `false` and
never reassigned anywhere in `scripts/phase5-toss-read-only-verify.mjs`). No code path found in
this review computes this field from any input, including a set human approval flag, a passing
preflight, a passing call gate, or a successful real call — it is hardcoded `false` everywhere it
appears across all of round 4.

## rawPayloadStored Status

`rawPayloadStored` is a field new to round 4 (it did not exist before P5-013/P5-014). It is `false`
as a hardcoded literal in the P5-013 runner's report object and in every evidence file it writes
(`writeSanitizedEvidence()` sets `rawPayloadStored: false` directly, never computed from response
content). `TossReadOnlyVerificationResultValidator.review()` (P5-014) rejects any input where
`rawPayloadStored !== false` outright (`verification_result_raw_payload_stored_must_be_false`), so
even a hand-edited or maliciously modified receipt claiming `rawPayloadStored: true` cannot be
accepted into the evidence intake pipeline. Consistent with this, `fetchTargetItemCount()` in the
P5-013 runner extracts only `items.length` from a real response and discards the parsed payload
immediately afterward — there is no code path in the runner that could write a raw payload to disk
even if the `rawPayloadStored: false` literal were removed. No raw payload storage was observed,
and none is reachable in the merged code.

## Remaining Manual Operator Steps

Before a human operator could actually attempt the one real approved call, the following remain
true in this environment and can only be done by the operator, locally, never by an AI agent (per
`docs/phase5/local-toss-read-only-runbook.md` Steps 1-8 and `docs/11_AI_RULES.md` Rules 18/19):

1. Create a real local `.env` with real (non-placeholder) `TOSS_API_BASE_URL`, `TOSS_CLIENT_ID`,
   `TOSS_CLIENT_SECRET`, and `TOSS_ACCOUNT_REF`, keeping `LIVE_TRADING_ENABLED=false` and
   `TOSS_READ_ONLY_MODE=true`. No real `.env` exists in this worktree.
2. Verify at least one endpoint catalog entry against official Toss documentation or developer
   console evidence and set its `verified: true` (all 4 candidate entries in
   `tmp/phase5/toss-read-only-endpoints.local.json` are currently `verified: false`).
3. Prepare a Step-4 approval artifact (`docs/phase5/read-only-call-approval.example.json` as the
   template) scoped to the one operation being attempted.
4. Review and sanitize at least the relevant evidence intake item(s) and set
   `reviewedByHuman: true` (all 4 example intake items are currently unreviewed placeholder text).
5. Run `npm run phase5:toss:preflight` and confirm `readyForReadOnlyCall: true`.
6. Run `PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:call-gate` and confirm
   `readyToAttemptRealReadOnlyCall: true`.
7. Only then, run exactly one of:
   ```bash
   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- accounts
   ```
   or
   ```bash
   PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:verify-read-only -- holdings
   ```
8. After the call, manually review the sanitized evidence file written under `tmp/phase5/`, copy a
   real sanitized summary into an evidence intake item, mark it `reviewedByHuman: true`, run
   `npm run phase5:toss:promote-intake`, then `npm run phase5:toss:open-questions` to see whether
   OQ-002 now has enough evidence for human review — this still does not resolve the open question;
   a human must separately update `docs/open_questions.md`.

None of these are code defects. They are the intended fail-closed state of a system that has not
yet received real credentials, a real verified endpoint, a real approval artifact, or real
human-reviewed evidence — exactly what `docs/phase5/local-toss-read-only-runbook.md`'s "Final Rule"
describes as expected, not a bug to work around.

## Is It Safe To Attempt One Human-Approved Real Read-Only Call

**Not yet, in this environment — but the machinery to do so safely is now complete and tested for
the first time in round 4.**

What is new and verified in this round: the full path from human approval to a real network call
to sanitized evidence now exists as working, tested code, not just a design (P5-009's harness in
round 3 was explicitly review-only and never made a request). `TossReadOnlyHttpClient` (P5-012) is
a real, safety-bounded transport. `scripts/phase5-toss-read-only-verify.mjs` (P5-013) is a real,
gated runner, proven end-to-end against a mock server to require approval, require passing
preflight and call-gate, perform exactly one call, and write only sanitized evidence.
`TossReadOnlyVerificationResultValidator` (P5-014) is proven to accept that exact runner's output
and correctly map it to OQ-002. Every one of these hardcodes `liveBrokerWriteAllowed: false`, and
`rawPayloadStored: false` is enforced both by the runner's own code and independently by the
validator that would receive its output.

What is still missing and makes an actual attempt unsafe right now, confirmed by running the real
commands against this worktree (not assumed): no real `.env` credentials exist here
(`phase5:toss:readiness` reports `ready: false`, exit 1); zero endpoint catalog entries are
verified (`verifiedEndpointCount: 0`); the evidence intake worksheet is entirely unreviewed
placeholder text (`intake_not_human_reviewed_*` × 4); the evidence manifest is empty
(`openQuestions_missing_valid_evidence_oq-001/002/003/004`, all four); `phase5:toss:preflight`
fails closed (exit 1, `readyForReadOnlyCall: false`); `phase5:toss:completion` fails closed (exit
1, `readyForFirstRealReadOnlyCall: false`); and `PHASE5_TOSS_READ_ONLY_CALL_APPROVED` was never set
to `"true"` in any command run in this review, so the call gate and the verify-read-only runner's
own approval check would both refuse to proceed even if everything else were ready.

In short: the tooling a human operator would use to safely attempt one real read-only call is
built, merged, and proven safe by 574 passing tests and by direct reading of the merged source. The
human has not yet supplied the credentials, verified endpoint, prepared approval artifact, and
reviewed evidence that tooling requires before it will allow that attempt — and per this task's
explicit instructions, no AI agent performed, simulated, or is recommending performing that call in
this session. The decision to attempt it belongs to the human operator, using the exact command in
"Remaining Manual Operator Steps" step 7 above, whenever they choose to complete steps 1-6 first.

## Live Trading Is Still Blocked

Live trading is still blocked. Nothing in P5-012, P5-013, P5-014, or this P5-015 review authorizes
Toss order creation, order cancellation, order replacement, any transfer, withdrawal, or
money-moving currency conversion, or any other use of production capital.
`liveBrokerWriteAllowed` is hardcoded `false` throughout every Phase 5 script and service reviewed
here — in the new HTTP client, the new verification runner, and the strengthened evidence pipeline
alike — with no input, including a set human approval flag, a passing preflight, a passing call
gate, or a successfully completed real read-only call, able to flip that value. Live broker write
authorization remains a separate decision gated by `docs/11_AI_RULES.md` (Rules 1, 4, 14, 17, 22,
23), the risk engine, the money management engine, the order approval engine, and explicit
compliance sign-off — none of which Phase 5 implements or bypasses.

## Phase 1 Regression Gap Check (Pre-Merge Baseline)

This section records the phase-1 regression-gap check against the current (pre-P5-012/P5-013/P5-014)
state of the repository, as required by task P5-015. It documents what was true before those three
tasks existed and is left unchanged from phase 1.

Scope reviewed:

- `tests/scripts/phase5-toss-network-safety-static.test.ts`
- `tests/scripts/phase5-toss-preflight-script.test.ts`
- `tests/scripts/phase5-toss-completion-script.test.ts`

Checked for gaps in proving:

- the static network-safety scan correctly scopes its "no fetch / no `http.request` / no axios"
  assertion to only the Phase 5 Toss scripts that are supposed to be network-free, and does not
  silently claim network-freedom for a script that legitimately performs real calls
- preflight and completion perform no network calls and fail closed by default
- `liveBrokerWriteAllowed` stays `false` under every input, including approval flags
- secret-looking values are rejected or masked in script output

Finding: `tests/scripts/phase5-toss-network-safety-static.test.ts` scans a hardcoded array of
filenames (`allPhase5TossScripts`), not a directory glob, so it is inherently scoped to only the
scripts explicitly listed there. That is the correct design — it does not accidentally sweep in a
future script. Cross-checking that array against the actual contents of `scripts/` found that
`scripts/phase5-toss-account-ref-setup.mjs` is (correctly) absent from the network-forbidden-patterns
list, because it already performs real `fetch()` calls to `POST /oauth2/token` and
`GET /api/v1/accounts` today (confirmed by reading the script directly; this script and its
network-calling behavior already existed on `main` before this round, added in a prior commit, not
part of P5-012/P5-013/P5-014). That real-network behavior is already proven safe by its own
dedicated mock-server test file, `tests/scripts/phase5-toss-account-ref-setup-script.test.ts`
(fails closed without credentials, never logs secrets or account numbers, hardcodes
`liveBrokerWriteAllowed: false`).

Gap found and closed: `phase5-toss-account-ref-setup.mjs` was correctly excluded from the
no-network-call scan, but it was also missing from the separate
`scriptsWithLiveBrokerWriteFlag` static lock in the same test file, which checks that
`liveBrokerWriteAllowed: false` appears as a literal in each listed script's source. The script
does hardcode that literal (confirmed by reading `scripts/phase5-toss-account-ref-setup.mjs` line
15), so this was a real, narrow gap: a future edit could silently turn that literal into a computed
value and no static test would catch it. A single line was added to
`scriptsWithLiveBrokerWriteFlag` in `tests/scripts/phase5-toss-network-safety-static.test.ts`,
with a comment explaining why the script belongs in that list but not in the
network-forbidden-patterns list or the `networkCallsPerformed: false` list (its
`networkCallsPerformed` value is genuinely computed to `true` once a call is attempted, not a
hardcoded `false`). No implementation file was modified. No safety behavior was weakened; this
purely added coverage.

No other gap was found in this pre-merge baseline. `tests/scripts/phase5-toss-preflight-script.test.ts`
already covered: default fail-closed state with sanitized blockers, fail-closed with
`liveBrokerWriteAllowed: false` / `networkCallsPerformed: false` even when the human approval flag
is set, and a full pass path using local (non-committed-example) endpoint/manifest/intake fixtures.
`tests/scripts/phase5-toss-completion-script.test.ts` already covered: default fail-closed state,
fail-closed with the approval flag set (with the call-gate reason code chain surfacing through),
the `PHASE5_TOSS_COMPLETION_LOCAL_REPORT` safety type, and a full pass path with explicit approval
and local fixtures. Neither file needed a change.

### Phase 1 Forward-Looking Assessment (Written Before P5-013 Existed)

P5-013 will add `scripts/phase5-toss-read-only-verify.mjs`, which the P5-013 task document
requires to legitimately perform exactly one real network call when explicitly approved
(`networkCallsPerformed: true` is a required report field on the approved path). Based on the
precedent already established in this codebase by `phase5-toss-account-ref-setup.mjs`, the correct
integration is almost certainly:

- do **not** add `phase5-toss-read-only-verify.mjs` to `allPhase5TossScripts` (the
  no-network-call scan) or to `scriptsWithNetworkCallsFlag` (the hardcoded-`networkCallsPerformed:
  false` scan) — both would be false claims about a script that must legitimately call the network
  under approval;
- do consider adding it to `scriptsWithLiveBrokerWriteFlag` if (and only if) the merged script
  hardcodes `liveBrokerWriteAllowed: false` as a literal, matching every other Phase 5 Toss script;
- prove its network-call gating (no approval -> no call, wrong operation -> no call, approved ->
  exactly one call) with its own dedicated mock-HTTP-server behavioral test file, which the P5-013
  task document already requires (`tests/scripts/phase5-toss-read-only-verify-script.test.ts`).

## Follow-Up on the Phase 1 Assessment (Phase 2)

The phase-1 prediction above was correct. After merging P5-013, `phase5-toss-read-only-verify.mjs`
did **not** appear in `tests/scripts/phase5-toss-network-safety-static.test.ts` at all — Engineer 2
did not modify that file (confirmed: the `git merge main` diff for this task touched no test file
under `tests/scripts/` other than adding the new
`tests/scripts/phase5-toss-read-only-verify-script.test.ts`). That left it correctly, if only
passively, excluded from the no-network scan (an absent entry cannot fail a scan it isn't part of),
but it was also absent from `scriptsWithLiveBrokerWriteFlag`, even though the script does hardcode
`liveBrokerWriteAllowed: false` as a literal (confirmed by reading
`scripts/phase5-toss-read-only-verify.mjs` line 72). This is this task's file to own per the P5-015
task document's allowed-files list, so it was fixed directly: one line was added to
`scriptsWithLiveBrokerWriteFlag`, with a comment mirroring the existing
`phase5-toss-account-ref-setup.mjs` comment and explaining why the script belongs there but not in
the no-network-call scan or the `networkCallsPerformed:false` scan. No other script's coverage was
touched or weakened; the static test file now locks 46 assertions (up from 45 after phase 1, 44
before phase 1) instead of loosening any of them.

## Change Log

- Phase 1: scaffold created, regression-gap check performed, one narrow test gap closed in
  `tests/scripts/phase5-toss-network-safety-static.test.ts` (added
  `phase5-toss-account-ref-setup.mjs` to the `liveBrokerWriteAllowed` static lock). No integration
  or readiness content written. `docs/tasks/phase5_claude_worktree_tasks/README.md` was not
  touched.
- Phase 2: merged local `main` (P5-012 `76da4f2`, P5-014 `5d1d85b`, P5-013 `78e8798`) into this
  branch; replaced all placeholder sections with content based on direct reading of the merged
  files; closed one further narrow gap in `tests/scripts/phase5-toss-network-safety-static.test.ts`
  (added `phase5-toss-read-only-verify.mjs` to the `liveBrokerWriteAllowed` static lock); re-ran
  `npm run check` and the five required Phase 5 commands against the merged state with real exit
  codes recorded above; updated `docs/tasks/phase5_claude_worktree_tasks/README.md` with the round-4
  merge summary. No real Toss API call was performed, simulated, or recommended for immediate
  execution at any point in this task.
