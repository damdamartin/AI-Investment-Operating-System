# Codex Phase 5 Round 5 Read-Only Expansion Review

Version: 0.1.0
Status: Scaffold (Phase 1 of 2)
Review Date: 2026-07-29

## Document Purpose

This document is the Phase 5 round 5 integration review (task P5-019). It is produced in two
phases, matching the precedent set by `docs/reviews/Codex_Phase5_Readiness_Review.md` (round 3)
and `docs/reviews/Codex_Phase5_First_Read_Only_Verification_Review.md` (round 4):

- Phase 1 (this content): read the round-5 task set (P5-016, P5-017, P5-018), run a
  regression-gap check against the pre-merge codebase, close any genuine gap found with a narrow
  test, and lay out this scaffold. No integration or readiness content is written in phase 1,
  because Engineer 1 (P5-016), Engineer 2 (P5-017), and Engineer 3 (P5-018) had not yet been
  merged into `main` at the time this phase was performed.
- Phase 2 (future): after the orchestrator merges P5-016, P5-017, and P5-018 into local `main`,
  every `PENDING` placeholder section below will be filled in with real content based on reading
  the actual merged files, and the full verification suite will be re-run against the merged
  state.

The phase 1 regression-gap check is preserved unchanged below, under "Phase 1 Regression Gap
Check (Pre-Merge Baseline)", once phase 2 content is added, because it documents what was true
before P5-016/P5-017/P5-018 existed.

## Summary

PENDING — awaiting P5-016/P5-017/P5-018 merge

## What Changed in P5-016 (Market-Prices)

PENDING — awaiting P5-016/P5-017/P5-018 merge

## What Changed in P5-017 (Evidence Receipts)

PENDING — awaiting P5-016/P5-017/P5-018 merge

## What Changed in P5-018 (Runbook/Status)

PENDING — awaiting P5-016/P5-017/P5-018 merge

## Commands Run and Results

PENDING — awaiting P5-016/P5-017/P5-018 merge

## Whether Market-Prices Remains Mock-Only Or Is Ready For One Human-Approved Attempt

PENDING — awaiting P5-016/P5-017/P5-018 merge

## Whether Evidence Receipts Remain Sanitized

PENDING — awaiting P5-016/P5-017/P5-018 merge

## Whether Docs Accurately Describe Accounts/Holdings Already Verified

PENDING — awaiting P5-016/P5-017/P5-018 merge

## Safety Invariant Status (liveBrokerWriteAllowed, rawPayloadStored, networkCallsPerformed)

PENDING — awaiting P5-016/P5-017/P5-018 merge

## Remaining Blockers Before The Next Human-Only Read-Only Call

PENDING — awaiting P5-016/P5-017/P5-018 merge

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
- Phase 2: PENDING — awaiting P5-016/P5-017/P5-018 merge
