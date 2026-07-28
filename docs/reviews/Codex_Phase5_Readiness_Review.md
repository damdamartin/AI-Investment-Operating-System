# Codex Phase 5 Readiness Review

Version: 0.2.0
Status: Complete for round 3 (P5-007 through P5-011)
Review Date: 2026-07-28

## Document Purpose

This document is the Phase 5 round 3 readiness review (task P5-011). It was produced in two phases:

- Phase 1: read the round-3 task set, run a regression-gap check against the pre-merge codebase,
  close any genuine gaps found with narrow tests, and lay out a scaffold. No readiness content was
  written in phase 1 because Engineer 1 (P5-008), Engineer 2 (P5-009), and Engineer 3 (P5-010) had
  not yet been merged into `main`.
- Phase 2 (this content): after the orchestrator merged P5-008 (`278bf78`), P5-009 (`2e2df18`),
  and P5-010 (`21cc0af`) into local `main`, this section fills in every scaffold placeholder with
  real content based on reading the actual merged files, and re-runs the full verification suite
  against the merged state.

The phase 1 regression-gap check is preserved unchanged below, under "Phase 1 Regression Gap Check
(Pre-Merge Baseline)", because it documents what was true before P5-008/P5-009/P5-010 existed.

## Summary

Round 3 (P5-007 through P5-011) hardened Phase 5 tooling, policy, and documentation. It did not
collect any real Toss evidence and did not change the live-trading boundary.

- P5-008 gave the four Toss open questions (OQ-001 through OQ-004) an explicit seven-state evidence
  policy so that "evidence exists" can never be misread as "question resolved" or "live trading
  authorized."
- P5-009 added `TossReadOnlyOneCallHarness`, a no-network, review-only harness that proves the
  project can scope, validate, and prepare exactly one future read-only Toss call — and proves that
  a consumed approval cannot be reused.
- P5-010 rewrote the operator runbook and checklist into an explicit, numbered 12-step flow with
  documented expected fail-closed states at each step.
- P5-011 (this task) found and closed one narrow regression-test gap, wrote this review, and
  re-verified `npm run check` plus the four required Phase 5 commands against the merged codebase.

After all of round 3, in the default local state (no `.env`, no real credentials, no human-reviewed
evidence): `phase5:toss:preflight` and `phase5:toss:completion` both fail closed as expected, and
`liveBrokerWriteAllowed: false` / `networkCallsPerformed: false` hold in every report from every
command. OQ-001 through OQ-004 all remain `Status: OPEN` in `docs/open_questions.md` with
`Evidence status: NO_EVIDENCE`. Live trading remains fully blocked.

## What Changed in P5-008 (Open Question Evidence Policy)

Files added or changed (read directly from the merge): `docs/phase5/open-question-evidence-policy.md`
(new), `docs/open_questions.md`, `docs/phase5/README.md`,
`src/application/toss/open-question-evidence-tracker.ts`,
`tests/application/toss-open-question-evidence-tracker.test.ts`.

- `docs/phase5/open-question-evidence-policy.md` defines a seven-state model: `NO_EVIDENCE` ->
  `EVIDENCE_COLLECTED` -> `EVIDENCE_SANITIZED` -> `EVIDENCE_REVIEWED` (human only) ->
  `QUESTION_IN_REVIEW` (human only) -> `QUESTION_RESOLVED` (human only), plus a permanent parallel
  `LIVE_TRADING_STILL_BLOCKED` state that holds at every step, including after
  `QUESTION_RESOLVED`. Only the first three states can be computed by code
  (`TossOpenQuestionEvidenceTracker`); the last three require a human to record a reviewer name,
  reviewed date, and decision directly in `docs/open_questions.md`.
- `docs/open_questions.md` gained an "Evidence Status" block on each of OQ-001 through OQ-004
  (evidence status, evidence manifest reference, reviewer, reviewed date, decision, remaining
  blockers), plus a summary section pointing at the full policy. All four questions currently show
  `Status: OPEN` and `Evidence status: NO_EVIDENCE` — no human review has happened yet.
- `docs/phase5/README.md` gained an "Evidence Status Policy" section summarizing the same model and
  restating that sanitized evidence, and even a human `RESOLVED` decision, never by itself
  authorizes Toss order creation, cancellation, replacement, live capital use, or production
  reconciliation on unverified identifiers.
- `src/application/toss/open-question-evidence-tracker.ts` gained a computed `evidenceStatus` field
  per question (`NO_EVIDENCE` / `EVIDENCE_COLLECTED` / `EVIDENCE_SANITIZED`) and a hardcoded
  `liveTradingAuthorized: false` field on every review result, alongside the pre-existing
  `liveBrokerWriteAllowed: false`. The tracker performs no network calls and does not itself read or
  write `docs/open_questions.md`.

Per-question notes in the policy document are explicit that evidence for each OQ supports only
narrow, specific follow-on work (e.g. OQ-002 evidence supports `BrokerAccount`/`Portfolio` mapping
design, not production reconciliation; OQ-003 evidence supports idempotency design, not actual
reconciliation, which still requires `UNKNOWN_REQUIRES_RECONCILIATION` handling per
`docs/11_AI_RULES.md` Rule 16) — none of it authorizes a live broker write.

## What Changed in P5-009 (One-Call Harness)

Files added or changed: `src/application/toss/read-only-verification-planner.ts` (harness added
alongside the pre-existing `TossReadOnlyVerificationPlanner`),
`tests/application/toss-read-only-verification-planner.test.ts`,
`docs/phase5/toss-read-only-call-gate.md`, `docs/phase5/local-toss-read-only-runbook.md`.

Engineer 2's task note (confirmed by reading the code) found that the sanitized approval-record
machinery (`TossReadOnlyCallApprovalRecord` / `TossReadOnlyCallApprovalValidator` /
`TossReadOnlyCallApprovalLedger` in `src/application/toss/read-only-evidence-intake.ts`) already
existed on `main` from an earlier round, so P5-009's actual contribution was the missing piece: a
new `TossReadOnlyOneCallHarness` class that ties together:

- local credential readiness (`TossReadOnlyCredentialReadinessService`)
- endpoint catalog validation (`TossReadOnlyEndpointCatalogValidator`)
- a sanitized, single-use approval record (validated by `TossReadOnlyCallApprovalValidator`)
- catalog-entry resolution — the approval's `endpointCatalogReference` must resolve to exactly one
  verified catalog item
- an operation/evidence-kind cross-check — the endpoint's `operation` must equal
  `approval.approvedOperation`, and the endpoint's `evidenceKind` must equal
  `approval.expectedEvidenceKind`
- single-use ledger consumption (`TossReadOnlyCallApprovalLedger.consume`) — a second consumption
  attempt with the same approval id is rejected with `approval_already_consumed`
- preparation of exactly one sanitized, no-network dry-run request
  (`TossReadOnlyDryRunClient.prepare`)

Read directly from `src/application/toss/read-only-verification-planner.ts`: every return path of
`TossReadOnlyOneCallHarness.prepare()` — success or any failure branch — carries
`liveBrokerWriteAllowed: false` and `networkCallsPerformed: false` as literal (not computed)
values, and the harness never calls `fetch` or any network client; it only calls the dry-run
client's `prepare()` method, which builds a request object.

Test coverage (`tests/application/toss-read-only-verification-planner.test.ts`, `describe`d as
`TossReadOnlyOneCallHarness`, 10 test cases) proves, among other things: exactly one prepared
request is returned on success; a second `consume()` on the same approval id is rejected as
`approval_already_consumed`; an evidence-kind/operation mismatch between approval and catalog entry
is rejected; a write-scoped approval operation is rejected; secret configuration values (client
secret, account ref) never leak into the harness result; and network calls are never performed even
on a successful preparation (verified by a fetch-stub that must never be invoked).

## What Changed in P5-010 (Operator Runbook)

Files changed: `docs/phase5/local-toss-read-only-runbook.md`,
`docs/phase5/toss-read-only-verification-checklist.md`,
`docs/phase5/phase5-toss-completion-checklist.md`, `docs/phase5/toss-read-only-call-gate.md`.

`docs/phase5/local-toss-read-only-runbook.md` was rewritten into an explicit, numbered 12-step
operator flow: (1) local-only `.env` setup, (2) secret handling boundaries, (3) endpoint catalog
validation, (4) approval artifact preparation, (5) dry-run plan, (6) doctor, (7) preflight, (8) the
read-only call gate, (9) exactly one future real read-only call (explicitly deferred to a separate,
later task — this runbook does not perform it), (10) sanitized evidence intake, (11) manifest
promotion, (12) open question review. Each step that is expected to fail closed on a fresh checkout
(steps 1, 5, 6, 7, 8, 10) is annotated with an explicit "Expected fail-closed state" note explaining
why, so a fail-closed result is not mistaken for a bug. A "Stop Conditions" section lists concrete
triggers (e.g. `LIVE_TRADING_ENABLED=true`, an unmasked account number or token in output, a request
path suggesting order mutation) that mean stop immediately rather than continue or "fix" the check.
`docs/phase5/toss-read-only-verification-checklist.md` was restructured to mirror the same 12 steps.
`docs/phase5/phase5-toss-completion-checklist.md` and `docs/phase5/toss-read-only-call-gate.md`
gained cross-references tying them back to the runbook's step numbers. No safety rule was changed,
and no real credentials, real endpoint paths, or secret-shaped example values were added — confirmed
by reading the merged files directly (all example values remain placeholders such as `<local
secret>` and `<official Toss API base URL>`).

## Commands Run and Results

All commands below were run in this worktree (`/Users/mac/Documents/Codex/aios-phase5-worktrees/round3-eng4`)
after `git merge main` (merge commit brings in P5-008 `278bf78`, P5-009 `2e2df18`, P5-010 `21cc0af`),
with no `.env` file present (default fresh-checkout state — the same state any new clone or CI run
would start from).

```text
$ npm run check
```
Result: PASS. `tsc -p tsconfig.json --noEmit` reported zero errors. `vitest run` reported
**78 test files passed, 510 tests passed, 0 failed**. (509 tests come from the merged main tip plus
the 1 additional regression test added in this task's phase 1.)

```text
$ npm run phase5:toss:endpoints
```
Result: exit code 0. `{"valid": true, "itemCount": 1, "verifiedEndpointCount": 0, "reasonCodes": [],
"warnings": ["endpoint_not_verified_account-snapshot-example"], "liveBrokerWriteAllowed": false,
"safetyType": "TOSS_READ_ONLY_ENDPOINT_CATALOG_LOCAL_REPORT"}`. The catalog structure is valid, but
the one example entry is unverified (it is only a template), so zero endpoints are usable for a real
call yet.

```text
$ npm run phase5:toss:doctor
```
Result: exit code 0 (doctor is a diagnostic report, not a gate, so it always exits 0).
`readyForReadOnlyVerification: false`. Blocking reason codes list missing/placeholder
`TOSS_API_BASE_URL`, `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `TOSS_ACCOUNT_REF`,
`toss_read_only_mode_not_true`, and four `intake_not_human_reviewed_*` codes for the example intake
worksheet's four template items. `liveBrokerWriteAllowed: false`, `networkCallsPerformed: false`.

```text
$ npm run phase5:toss:preflight
```
Result: exit code 1 (fails closed, as expected in this state). `readyForReadOnlyCall: false`,
`readyForOpenQuestionReview: false`, `commandCount: 6`. `reasonCodes` aggregate the same missing
credentials, unreviewed intake items, and `openQuestions_missing_valid_evidence_oq-002/003/004`
(OQ-001 alone shows `readyForReview: true` in the open-questions sub-report, but only because the
committed example evidence manifest, `docs/phase5/evidence-manifest.example.json`, contains one
template item whose summary literally reads "Sanitized summary only. Do not include..." — this is
fixture/template data, not real Toss evidence, and it does not make OQ-001 reviewed; `docs/open_questions.md`
correctly still shows `Status: OPEN` / `Evidence status: NO_EVIDENCE` for OQ-001). `liveBrokerWriteAllowed: false`,
`networkCallsPerformed: false` held.

```text
$ npm run phase5:toss:completion
```
Result: exit code 1 (fails closed, as expected in this state). `phase5TossPreparationComplete: false`,
`readyForFirstRealReadOnlyCall: false`, `nextAction: "Finish local .env setup, official endpoint
verification, sanitized evidence intake, preflight, and call-gate approval first."`. `reasonCodes`
include `read_only_call_gate_not_ready`, `call_gate_human_read_only_call_approval_missing`, and the
full chain of `call_gate_preflight_*` codes propagated from the preflight run above.
`liveBrokerWriteAllowed: false`, `networkCallsPerformed: false` held.

No command in this run performed a network call (confirmed both by each report's
`networkCallsPerformed: false` field and by the earlier phase-1 grep of `scripts/` and
`src/application/toss/` for `fetch(`/`http.request`/`https.request`/`axios`/`XMLHttpRequest`, which
returned no matches — that grep result is unaffected by the P5-008/009/010 merge since none of those
tasks touched network-calling code).

## liveBrokerWriteAllowed Status

`liveBrokerWriteAllowed` is `false` in every report produced in this review: `phase5:toss:endpoints`,
`phase5:toss:doctor`, `phase5:toss:preflight`, `phase5:toss:completion`, and — read directly from
source — as a literal (non-computed) value on every return path of the new
`TossReadOnlyOneCallHarness.prepare()` in `src/application/toss/read-only-verification-planner.ts`,
and as the new `liveTradingAuthorized: false` field added by P5-008 to
`TossOpenQuestionEvidenceTracker.review()`. Test coverage in
`tests/scripts/phase5-toss-preflight-script.test.ts` (including the test added in this task's phase 1),
`tests/scripts/phase5-toss-completion-script.test.ts`, `tests/scripts/phase5-toss-call-gate-script.test.ts`,
and `tests/application/toss-read-only-verification-planner.test.ts` all assert this holds even when
`PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true` is set, when an approval is otherwise valid, and when an
approval is replayed a second time. No code path found in this review computes this field from any
input — it is hardcoded `false` everywhere it appears.

## networkCallsPerformed Status

`networkCallsPerformed` is `false` in every report produced in this review (`doctor`, `preflight`,
`completion`; `endpoints` does not carry this field but its validator does not open any network
connection, confirmed by source review and by the network-call grep above). It is also a literal
`false` on every return path of `TossReadOnlyOneCallHarness.prepare()` and
`TossReadOnlyVerificationPlanner.plan()`. `tests/application/toss-read-only-verification-planner.test.ts`
includes a dedicated test, `"performs no network calls even when preparation succeeds"`, which stubs
`fetch` and asserts it is never called. No real Toss API call was made at any point during this
review.

## Remaining Blockers

Before a future, separately-approved single read-only verification call could actually be attempted:

1. A local `.env` file with real (non-placeholder) `TOSS_API_BASE_URL`, `TOSS_CLIENT_ID`,
   `TOSS_CLIENT_SECRET`, and `TOSS_ACCOUNT_REF` does not exist in this environment, and must never be
   created by an AI agent — only by the human operator, locally, per
   `docs/phase5/local-toss-read-only-runbook.md` Steps 1-2.
2. `TOSS_READ_ONLY_MODE` is not currently set to `true` locally (no `.env` present at all).
3. Zero endpoint catalog entries are verified (`verifiedEndpointCount: 0`). The one example entry is
   an unverified template; a real entry needs official Toss documentation, developer console
   evidence, or prior local read-only verification per Step 3 of the runbook.
4. No approval artifact has been prepared or submitted (Step 4) — `docs/phase5/read-only-call-approval.example.json`
   remains an unedited template.
5. All four items in the example evidence intake worksheet remain unreviewed
   (`reviewedByHuman: false`), so `phase5:toss:intake` and, transitively, `doctor`/`preflight`/`completion`
   fail closed on those items.
6. OQ-002, OQ-003, and OQ-004 have zero valid evidence items (`missing_valid_evidence_oq-002/003/004`).
   OQ-001 has only the template fixture item described above, which is not real evidence and has not
   been human-reviewed; `docs/open_questions.md` correctly still lists `Status: OPEN` for all four.
7. `PHASE5_TOSS_READ_ONLY_CALL_APPROVED` is not set, so the call gate fails closed independently of
   preflight state.
8. Consequently `phase5:toss:preflight` (exit 1) and `phase5:toss:completion` (exit 1) both fail
   closed, which is the expected and required state until items 1-7 above are resolved by a human
   operator outside any AI session.

None of these are code defects. They are the intended fail-closed state of a system that has not yet
received real credentials, real verified endpoints, or real human-reviewed evidence — exactly what
`docs/phase5/local-toss-read-only-runbook.md`'s "Final Rule" describes as expected, not a bug to work
around.

## Readiness For a Future Human-Approved Single Read-Only Verification Attempt

The **scaffolding** for a future single read-only verification attempt is in place and has been
proven safe in this review:

- The one-call harness (P5-009) proves the project can scope, validate, and prepare exactly one
  read-only request without any network call, and proves an approval cannot be reused.
- The call gate, preflight, and completion chain (pre-existing, re-verified in this review) fail
  closed by default and stay fail-closed even when an approval flag is set but underlying readiness
  is incomplete.
- The operator runbook (P5-010) gives a human a concrete, ordered, 12-step path with documented
  expected fail-closed states, so a human operator does not need to guess what "normal" looks like.
- The evidence policy (P5-008) prevents evidence collection from being mistaken for authorization at
  any of its seven states.

The system is **not yet operationally ready** to attempt that call, because none of the human-only
prerequisites exist yet in this environment: no real `.env` credentials, no officially verified
endpoint catalog entry, no prepared approval artifact, and no human-reviewed evidence intake. This is
consistent with Phase 5's design — those prerequisites are explicitly human, local, and outside any
AI agent's authority to create (see `docs/phase5/local-toss-read-only-runbook.md` Step 2 and
`docs/11_AI_RULES.md` Rule 18/19).

In short: the machinery a human would use to safely attempt one read-only call is built and tested;
the human has not yet supplied the credentials, verified endpoint, and reviewed evidence that
machinery requires before it will allow that attempt.

## Live Trading Is Still Blocked

Live trading is still blocked. Nothing in P5-007, P5-008, P5-009, P5-010, or this P5-011 review
authorizes Toss order creation, order cancellation, order replacement, any transfer, withdrawal, or
money-moving currency conversion, or any other use of production capital. `liveBrokerWriteAllowed`
and (where applicable) `liveTradingAuthorized` are hardcoded `false` throughout every Phase 5 script
and service reviewed here, with no input — including a set human approval flag, a consumed approval
record, or a `QUESTION_RESOLVED` open question — able to flip that value. Live broker write
authorization remains a separate decision gated by `docs/11_AI_RULES.md` (Rules 1, 4, 14, 17, 22,
23), the risk engine, the money management engine, the order approval engine, and explicit
compliance sign-off — none of which Phase 5 implements or bypasses.

## Phase 1 Regression Gap Check (Pre-Merge Baseline)

This section records the phase-1 regression-gap check against the current (pre-P5-008/009/010)
state of the repository, as required by task P5-011. It documents what was true before
P5-008/P5-009/P5-010 existed and is left unchanged from phase 1.

Scope reviewed:

- `tests/safety/safety-regression.test.ts`
- `tests/scripts/phase5-toss-preflight-script.test.ts`
- `tests/scripts/phase5-toss-completion-script.test.ts`

Checked for gaps in proving:

- preflight and completion perform no network calls
- preflight and completion fail closed by default
- `liveBrokerWriteAllowed` stays `false` under every input, including approval flags
- secret-looking values are rejected or masked in script output

Gap found and closed: `tests/scripts/phase5-toss-preflight-script.test.ts` proved fail-closed
behavior and `liveBrokerWriteAllowed: false` / `networkCallsPerformed: false` in the default
example state, and the sibling call-gate and completion script tests separately proved those same
two fields stay `false` even when `PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true` is set — but the
preflight script test did not exercise that approval-flag input itself. A new test case was added
to close that gap for the preflight script specifically. No implementation file was modified.

No other gap was found in this pre-merge baseline. `tests/safety/safety-regression.test.ts`
already covers signal-is-not-order, risk/money gate enforcement, live-write blocking across every
combination of account status/liveTradingEnabled/permissionStatus, and AI-advisory-only behavior
including forbidden nested broker commands. `tests/scripts/phase5-toss-completion-script.test.ts`
already covers default fail-closed state, fail-closed with approval flag set, and safety-type
reporting.

## Change Log

- Phase 1: scaffold created, regression-gap check performed, one narrow test gap closed in
  `tests/scripts/phase5-toss-preflight-script.test.ts`. No readiness content written.
- Phase 2: merged local `main` (P5-008 `278bf78`, P5-009 `2e2df18`, P5-010 `21cc0af`) into this
  branch; replaced all placeholder sections with content based on direct reading of the merged
  files; re-ran `npm run check` and the four required Phase 5 commands against the merged state and
  recorded exact results above; updated `docs/tasks/phase5_claude_worktree_tasks/README.md` with the
  round-3 task index and merge summary.
