# Codex Phase 5 First Read-Only Verification Review

Version: 0.1.0 (scaffold)
Status: Phase 1 of 2 — scaffold only, no readiness content yet
Review Date: 2026-07-28

## Document Purpose

This document is the Phase 5 round 4 integration review (task P5-015). It is produced in two
phases:

- Phase 1 (this content): read the round-4 task set (P5-012, P5-013, P5-014), run a
  regression-gap check against the pre-merge codebase, close any genuine gaps found with narrow
  tests, and lay out this scaffold. No integration or readiness content is written in phase 1,
  because Engineer 1 (P5-012, Toss read-only HTTP client) and Engineer 3 (P5-014, sanitized
  evidence pipeline) have not yet been merged into `main`, and Engineer 2 (P5-013, first read-only
  verification runner) has not started at all — P5-013 depends on P5-012 and P5-014 merging first.
- Phase 2 (future content): after the orchestrator merges P5-012, P5-013, and P5-014 into local
  `main`, this section will fill in every placeholder below with real content based on reading the
  actual merged files, and will re-run the full verification suite against the merged state.

Every section below marked `PENDING — awaiting P5-012/P5-013/P5-014 merge` is a placeholder. It
does not describe real code, real test results, or a real readiness determination. It must not be
treated as a review conclusion until phase 2 replaces it.

## Summary

PENDING — awaiting P5-012/P5-013/P5-014 merge

## What Changed in P5-012 (HTTP Client)

PENDING — awaiting P5-012/P5-013/P5-014 merge

## What Changed in P5-013 (First Verification Runner)

PENDING — awaiting P5-012/P5-013/P5-014 merge

## What Changed in P5-014 (Evidence Pipeline)

PENDING — awaiting P5-012/P5-013/P5-014 merge

## Commands Run and Results

PENDING — awaiting P5-012/P5-013/P5-014 merge

## Mock-Test Coverage

PENDING — awaiting P5-012/P5-013/P5-014 merge

## Real-Network-Capable Scripts And Their Approval Gates

PENDING — awaiting P5-012/P5-013/P5-014 merge

Note for phase 2 (not a conclusion, a pointer to verify): this repository already contains one
precedent script that legitimately performs real network calls today,
`scripts/phase5-toss-account-ref-setup.mjs` (`POST /oauth2/token`, `GET /api/v1/accounts`, see
`docs/phase5/local-toss-read-only-runbook.md` Step 1). It is deliberately excluded from the
no-network static scan in `tests/scripts/phase5-toss-network-safety-static.test.ts` and instead
has its own dedicated mock-server behavioral test file,
`tests/scripts/phase5-toss-account-ref-setup-script.test.ts`. Phase 2 should confirm whether
P5-013's new runner (`scripts/phase5-toss-read-only-verify.mjs`) follows the same pattern.

## liveBrokerWriteAllowed Status

PENDING — awaiting P5-012/P5-013/P5-014 merge

## rawPayloadStored Status

PENDING — awaiting P5-012/P5-013/P5-014 merge

## Remaining Manual Operator Steps

PENDING — awaiting P5-012/P5-013/P5-014 merge

## Is It Safe To Attempt One Human-Approved Real Read-Only Call

PENDING — awaiting P5-012/P5-013/P5-014 merge

This question is not answered in phase 1. It depends on reading the actual merged P5-012, P5-013,
and P5-014 code, running the full local command chain against that merged state, and confirming
every safety property (fail-closed defaults, `liveBrokerWriteAllowed: false`,
`rawPayloadStored: false`, single-use approval consumption, no secret leakage) holds. That
determination belongs to phase 2 of this review, and the decision to actually attempt the call
remains the orchestrator's and the human operator's, never an AI agent's, regardless of what phase
2 concludes.

## Phase 1 Regression Gap Check (Pre-Merge Baseline)

This section records the phase-1 regression-gap check against the current (pre-P5-012/P5-013/P5-014)
state of the repository, as required by task P5-015. It documents what was true before those three
tasks existed and will be left unchanged from phase 1, matching the precedent set by
`docs/reviews/Codex_Phase5_Readiness_Review.md`'s round-3 phase 1 section.

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
purely adds coverage.

No other gap was found in this pre-merge baseline. `tests/scripts/phase5-toss-preflight-script.test.ts`
already covers: default fail-closed state with sanitized blockers, fail-closed with
`liveBrokerWriteAllowed: false` / `networkCallsPerformed: false` even when the human approval flag
is set, and a full pass path using local (non-committed-example) endpoint/manifest/intake fixtures.
`tests/scripts/phase5-toss-completion-script.test.ts` already covers: default fail-closed state,
fail-closed with the approval flag set (with the call-gate reason code chain surfacing through),
the `PHASE5_TOSS_COMPLETION_LOCAL_REPORT` safety type, and a full pass path with explicit approval
and local fixtures. Neither file needed a change.

## Assessment: Will `phase5-toss-network-safety-static.test.ts` Need To Change For P5-013

Not written as a conclusion — this is the phase-1 forward-looking note the task asked for, to be
confirmed or revised in phase 2 once the actual P5-013 script exists.

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

That is "explicitly exclude/allow," not "weaken." The existing static test's blanket assertion
would stay true for every script it actually claims to cover; the new script would simply not be
one of the scripts it claims network-freedom for, exactly as `phase5-toss-account-ref-setup.mjs`
already is not. Phase 2 must verify this against the actual merged P5-013 code rather than assume
it.

## Change Log

- Phase 1 (this content): scaffold created, regression-gap check performed against the pre-merge
  baseline, one narrow static-test coverage gap closed in
  `tests/scripts/phase5-toss-network-safety-static.test.ts`. No integration or readiness content
  written. `docs/tasks/phase5_claude_worktree_tasks/README.md` was not touched.
- Phase 2: not yet started.
