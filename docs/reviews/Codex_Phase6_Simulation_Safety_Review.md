# Codex Phase 6 Simulation Safety Review

Version: 1.0.0
Status: Complete
Review Date: 2026-07-29
Task: P6-004 Phase 6 Integration Safety Review
Assigned Engineer: Engineer 4

## Purpose

This document records the Phase 6 integration safety review after
P6-001 (paper order intent pipeline), P6-002 (reconciliation snapshot
review), and P6-003 (risk, kill switch, order approval, and broker write
guard) were merged into local `main`.

This review does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, or production capital use. It does not weaken any existing
fail-closed control, and none of the P6-001/002/003 changes reviewed here
weaken one either.

Merge commits reviewed (local `main`, never pushed to GitHub):

- `76515cd` — Merge Phase 6 Engineer 1: P6-001 paper order intent pipeline
- `e8855e7` — Merge Phase 6 Engineer 2: P6-002 reconciliation snapshot review
- `98955d5` — Merge Phase 6 Engineer 3: P6-003 risk kill-switch approval guard

Underlying feature commits: `2205c51` (P6-001), `c7a1851` (P6-002),
`3f12da0` (P6-003). Local `main` tip at review time: `98955d5`. This
review was produced from `phase6/p6-004-integration-safety-review` after
merging local `main` into it (merge commit `b79bef3`).

## Phase Status

- Phase 1 (scaffold and pre-merge regression-gap check): complete.
- Phase 2 (this content, full integration review): complete.

## Summary

P6-001, P6-002, and P6-003 merged into local `main` cleanly, with no
merge conflicts. All three branches strengthen existing safety
boundaries; none weaken or bypass one. `npm run check` passes cleanly
(typecheck plus 82 test files / 638 tests, all green) on the merged
branch. The paper order intent pipeline (P6-001) has no code path that
can produce a broker-write command of any kind. Reconciliation (P6-002)
remains strictly read-only and now hard-blocks any future live-readiness
signal on even minor unresolved discrepancies. The risk / kill-switch /
approval / broker-write-guard chain (P6-003) closed the exact staleness
gap flagged in this review's Phase 1 pass — `OrderApprovalEngine` and
`BrokerWriteCommandGuard` now both require proof of freshness and now
both consult kill-switch state, where previously neither did. Four
regression tests requested by Engineer 3 for this exact chain, plus two
requested implicitly by Engineer 4's own Phase 1 gap check, are now all
present in `tests/safety/safety-regression.test.ts` (16 tests total, all
passing) and use the real merged engines rather than hand-rolled stand-ins.

Live trading, and any real Toss broker write, remains fully blocked: no
`TossSecuritiesAdapter` or any Toss order-write implementation exists
anywhere in this repository (`TossWriteAdapter.submitOrder`/`cancelOrder`
are typed with an uncallable `command: never` parameter and have zero
implementations). Phase 5 no-write readiness commands were run on this
fresh worktree and either fail closed with sanitized reason codes
(readiness, doctor) or crash with an unhandled exception in a **pre-existing,
Phase-6-unrelated** script bug (preflight, completion) — see "Commands Run
and Results" below. In both cases, no network call occurred and no write
capability was reported anywhere.

## What Changed in P6-001 (Paper Order Intent)

Files: `src/application/paper-trading/paper-trading-engine.ts`,
`src/application/execution-simulation/order-execution-simulation-service.ts`,
plus their test files and `docs/phase6/paper-order-intent-pipeline.md`.

- Added `PaperOrderIntentPipeline`, a new class that takes a candidate
  `OrderIntent` plus optional `RiskCheck`/`MoneyCheck`/`BrokerAccount` and
  classifies the result as `ACCEPTED` / `REJECTED` / `DEFERRED`:
  - `ACCEPTED` only when both a passing risk check and a passing money
    check are present and no live-write-capable `BrokerAccount` is
    attached.
  - `REJECTED` when any supplied gate actively vetoes the candidate (a
    failing risk/money check, or — notably — a live-write-capable broker
    account attached to a *paper* candidate; this is always treated as an
    active safety violation, never as "missing information").
  - `DEFERRED` only when every present reason code reflects a genuinely
    missing input, never an active veto.
- Deliberately does **not** call `OrderApprovalEngine`. The pipeline's own
  doc (`docs/phase6/paper-order-intent-pipeline.md`) explains why: that
  engine requires a live-write-capable `BrokerAccount` and verified Toss
  broker capability to approve anything, which is backwards for paper
  trading and would either block paper trading on live-broker readiness or
  risk a "paper approval" being confused with a live one. Instead it
  implements its own paper-appropriate gate directly against `RiskCheck`
  and `MoneyCheck`.
  I independently confirm this reasoning holds: reusing `OrderApprovalEngine`
  as it stands post-P6-003 (which now requires `killSwitchGate`,
  `reconciliation`, and `evaluatedAt` or else rejects) would have made an
  already-narrow paper-trading path depend on unrelated live-broker
  machinery. Keeping it separate is the safer design given both engines'
  current shapes.
- `PaperOrder`, `PaperTradingResult`, `SimulatedExecutionCommand`, and
  `SimulatedExecutionRecord` all carry a **literal** (not computed)
  `liveBrokerWriteAllowed: false` field — verified directly in the source
  (`paper-trading-engine.ts` lines 35, 80, and the corresponding fields on
  the pipeline result). `PaperOrderIntentPipelineResult` additionally
  carries literal `nonBrokerPaperOnly: true` and `notLiveExecutable: true`.
- Verified by direct inspection: no import of `BrokerWriteCommandGuard`,
  `TossSecuritiesAdapter`, or any HTTP client anywhere in
  `paper-trading-engine.ts` or `order-execution-simulation-service.ts`, and
  no code path constructs a `BrokerWriteCommandGuardInput` or a
  `SUBMIT_ORDER`/`CANCEL_ORDER`/`REPLACE_ORDER`-shaped object.
- One-line fixture fix in `tests/application/order-cancel-simulation-service.test.ts`
  (an unowned file) to keep it compiling after the `PaperOrder` type
  change. Confirmed this is a type-only fixture update, not a behavior
  change: the test still exercises the same cancel-simulation logic and
  still passes.

## What Changed in P6-002 (Reconciliation)

Files: `src/application/reconciliation/reconciliation-service.ts`,
`src/application/reconciliation/reconciliation-workflow-service.ts`, plus
test files and `docs/phase6/reconciliation-snapshot-review.md`.

- Every `ReconciliationIssue` now carries a deterministic
  `classification`: `INFORMATIONAL` (within-tolerance variance, audit
  visibility only), `BLOCKING` (tolerance-exceeded mismatch or unknown
  broker state, blocks dependent trading), or `REQUIRES_HUMAN_REVIEW`
  (one-sided structural gap — position or cash present on only one side —
  never auto-resolved, also blocks dependent trading). Confirmed in
  `reconciliation-service.ts` (`classificationFor`, lines ~207+) and its
  exhaustive issue-type mapping.
- `ReconciliationIssue.ref` replaced raw `internalValue`/`brokerValue`
  fields with a sanitized reference: masked broker symbol
  (`redactSecret`, first 2 / last 2 characters visible, full mask under 4
  characters) combined with non-sensitive classifier fields (market,
  asset type, currency for positions; currency only for cash). Verified no
  raw quantity, raw price, or raw account identifier appears in any issue;
  `reason` values are fixed reason codes, never a dump of compared values.
- Added `ReconciliationWorkflowResult.liveReadinessBlocked`, a **hard,
  non-overridable** computation (`severity !== "NONE"`) — confirmed in
  `reconciliation-workflow-service.ts` line 80. This is stricter than
  `blocksDependentTrading`, which only trips on `HIGH`/`CRITICAL`/`UNKNOWN`
  severity or staleness and otherwise allows a soft `WATCH` state. Even a
  `LOW`/`MEDIUM`-severity issue that only produces `WATCH` for day-to-day
  paper trading still sets `liveReadinessBlocked: true`. Clearing this
  gate never implies live trading is allowed — `liveBrokerWriteAllowed`
  and `correctiveTradingAllowed` stay hardcoded `false` regardless (lines
  50-51, 102-103, 224-225), including on a fully clean report.
- `ReconciliationReport.issueCounts` and `ReconciliationReport.liveBrokerWriteAllowed`
  were made optional (`?`) specifically so pre-existing P6-003 test
  fixtures (which predate these fields) keep compiling without P6-002
  needing to touch P6-003's owned test files. Confirmed this is
  backward-compatible: `reconcileSnapshots` (the only production
  constructor of a real report) always populates both fields; the
  optionality only affects hand-built literals in other engineers' tests.
- Verified no correction-command or broker-write payload shape exists
  anywhere in this module; `correctiveTradingAllowed` is hardcoded `false`
  and there is no code path that could set it otherwise.

## What Changed in P6-003 (Risk / Kill Switch / Approval / Guard)

Files: `src/application/risk-engine/risk-engine.ts`,
`src/application/kill-switch/kill-switch-control-service.ts`,
`src/application/order-approval/order-approval-engine.ts`,
`src/application/broker-write-guard/broker-write-command-guard.ts`, plus
test files and `docs/phase6/risk-kill-switch-approval-guard.md`.

This is the branch that closes the exact gap flagged in this review's own
Phase 1 pass: **there was no staleness/TTL concept for `OrderApproval`
anywhere in the codebase.** Verified directly against the merged source:

- `OrderApprovalEngine` (`order-approval-engine.ts`) now has new optional
  inputs `killSwitchGate: KillSwitchTradingGate`, `reconciliation:
  ReconciliationReport`, and `evaluatedAt: Date` (plus overridable
  `maxCheckAgeMs`, default 5 minutes = `DEFAULT_MAX_CHECK_AGE_MS`).
  Missing `killSwitchGate` → `missing_kill_switch_gate`; a blocked gate →
  the gate's own reason codes reused verbatim (e.g.
  `kill_switch_active_global`), so the approval layer can never disagree
  with the kill-switch control chain. Missing `reconciliation` →
  `missing_reconciliation_state`; blocking →
  `reconciliation_<status>_blocks_trading`. Missing `evaluatedAt` entirely
  → fails closed with `missing_evaluation_time` (not silent approval). A
  `RiskCheck`/`MoneyCheck` older than `maxCheckAgeMs` →
  `risk_check_stale`/`money_check_stale`; a future-dated (clock-skewed)
  check → `risk_check_timestamp_in_future`/`money_check_timestamp_in_future`.
  All new fields are TypeScript-optional to match the file's existing
  runtime-checked style, but omitting them now produces a `REJECTED`
  approval, not a silently `APPROVED` one — confirmed by reading
  `rejectionReasons()` and by the four new regression tests below.
- `BrokerWriteCommandGuard` (`broker-write-command-guard.ts`) gained
  optional `now: Date` and `maxApprovalAgeMs` (default 5 minutes =
  `DEFAULT_MAX_APPROVAL_AGE_MS`). Once `approval.isApproved()` is true,
  the guard checks the later of the approval's underlying `RiskCheck` /
  `MoneyCheck` `checkedAt` against `now`: too old →
  `order_approval_stale`; future-dated → `order_approval_timestamp_in_future`;
  missing `now` → fails closed with `missing_evaluation_time`. Also added
  exported frozen constant `PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY`
  (`liveBrokerWritesEnabled: false`, `allowedEnvironments: []`) so future
  Phase 6 wiring code has a safe default to import instead of hand-building
  an environment policy that could typo its way into a live-write-enabled
  state. No escape hatch, bypass flag, or "trusted caller" shortcut was
  added — confirmed by reading the full `rejectionReasons()` function; it
  is a strictly additive set of checks.
- `KillSwitchControlService` (`kill-switch-control-service.ts`) now
  rejects out-of-order `activate`/`deactivate` commands: a command whose
  `occurredAt` predates the state's `updatedAt` is rejected with
  `kill_switch_command_out_of_order` (`validateCommand`, lines 187-207),
  preventing a stale/replayed deactivation from silently re-opening
  trading after a more recent activation. Added
  `evaluateAggregateTradingGate(states[])`, which combines every scope
  (GLOBAL/MARKET/PORTFOLIO/STRATEGY/ASSET) that may apply to one order:
  ACTIVE beats UNKNOWN beats INACTIVE, and an empty array is treated the
  same as a missing state (fails closed).
- `RiskEngine` (`risk-engine.ts`) gained an optional second kill-switch
  source, `killSwitchGate: KillSwitchTradingGate`, in addition to the
  existing raw `killSwitches[]` array — when the gate is blocked, the risk
  engine reuses its reason codes verbatim instead of inventing a second
  vocabulary. This is additive; the existing hard-limit and drawdown logic
  is unchanged. `reasonCodes` and `RiskCheck.failedLimitIds` are now
  deduplicated and sorted for deterministic output.

Reason-code reference for all of the above: `docs/phase6/risk-kill-switch-approval-guard.md`,
"Reason Code Reference (new or changed this round)".

## Commands Run and Results

All commands below were run from `/Users/mac/Documents/Codex/aios-phase6-worktrees/eng4`
on branch `phase6/p6-004-integration-safety-review` after merging local
`main` (merge commit `b79bef3`).

```bash
npm run check
```
Exit code `0`. Typecheck clean. `82` test files, `638` tests, all passing
— including the 16 tests in `tests/safety/safety-regression.test.ts`
(12 from Phase 1 plus the 4 new P6-003-requested regressions added in
Phase 2), and the expanded per-engine suites from all three merged
branches (`paper-trading-engine.test.ts` 15, `reconciliation-service.test.ts`
8, `reconciliation-workflow-service.test.ts` 9, `order-approval-engine.test.ts`
8, `kill-switch-control-service.test.ts` 7, `risk-engine.test.ts` 8,
`broker-write-command-guard.test.ts` 8). No flake was observed on this run.

```bash
npm run phase5:toss:readiness
```
Exit code `1` (fail closed, as expected on a fresh worktree with no
`.env`). Output:
```json
{
  "ready": false,
  "safeToAttemptReadOnlyCalls": false,
  "liveBrokerWriteAllowed": false,
  "missingFields": ["TOSS_API_BASE_URL", "TOSS_CLIENT_ID", "TOSS_CLIENT_SECRET", "TOSS_ACCOUNT_REF"],
  "reasonCodes": [
    "missing_or_placeholder_toss_account_ref",
    "missing_or_placeholder_toss_api_base_url",
    "missing_or_placeholder_toss_client_id",
    "missing_or_placeholder_toss_client_secret",
    "toss_read_only_mode_not_true"
  ],
  "safetyType": "TOSS_READ_ONLY_LOCAL_READINESS_REPORT"
}
```

```bash
npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Exit code `0` (this command reports state; it does not gate). Output
confirmed `readyForReadOnlyVerification: false`, `liveBrokerWriteAllowed:
false`, `networkCallsPerformed: false`, `preparedRequestCount: 0`, with
`blockingReasonCodes` including `endpoint_catalog_file_missing`,
`evidence_manifest_file_missing`, `evidence_intake_file_missing`,
`intake_has_no_items`, and the same four `missing_or_placeholder_toss_*`
readiness codes as above — all correct for a fresh worktree with none of
the operator's local files present.

```bash
npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Exit code `1`, but **not** a clean JSON fail-closed report — this command
crashed with an unhandled exception. Root cause (traced by reading the
stack trace and the referenced source): `scripts/validate-toss-evidence-intake.mjs`'s
`printReport()` function (line 114) does
`[...new Set([...reasonCodes, ...review.reasonCodes])]`, but the object
passed to it on the "intake file missing" and "intake JSON invalid" early-exit
paths (lines 11-17, 26-32) does not include a `reasonCodes` property, so
`review.reasonCodes` is `undefined` and the spread throws
`TypeError: review.reasonCodes is not iterable`. Because that subprocess
never prints valid JSON on this path, `phase5-toss-preflight.mjs`'s
`runJsonCommand()` helper (which shells out to `npm run phase5:toss:intake`
and parses its stdout) receives empty stdout and its own `JSON.parse("")`
throws `SyntaxError: Unexpected end of JSON input`, crashing preflight.

**This is a pre-existing bug, not a Phase 6 regression.** `git log --
scripts/validate-toss-evidence-intake.mjs scripts/phase5-toss-preflight.mjs`
shows both files were last touched by Phase 5 commits (`f00f940`,
`31616fc`, `711d82b`), all predating the Phase 6 baseline commit
`c090a0f` — none of P6-001/002/003 touched either file. It reproduces
specifically when an explicit intake path is supplied that does not
exist, which is exactly the fresh-checkout scenario these Phase 5 commands
are documented to "fail closed" on (`docs/phase5/README.md`), except the
failure here is a crash rather than a clean report. It is out of scope
for P6-004 to fix: `scripts/*.mjs` is not owned by any Phase 6 engineer in
either phase, and the bug predates all three Phase 6 branches.

Despite the crash, the safety invariants still hold: exit code is
non-zero (`1`, not accidentally `0`/success), no network call occurs
anywhere before or during the crash (the failure is pure local JSON
construction), and no write capability of any kind is exercised. This is
a tooling robustness gap, not a safety-boundary gap.

```bash
PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
```
Exit code `1`. Crashed for the identical underlying reason: `completion`
chains through `call-gate` → `preflight` → `intake`, and the same
unhandled exception in `validate-toss-evidence-intake.mjs` propagates all
the way up (confirmed via the four-stage stack trace: `intake` →
`preflight`'s `runJsonCommand` → `call-gate`'s `runPreflight` →
`completion`'s `runCallGate`). Even with
`PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true` set, no network call occurred,
no live broker write was attempted, and the crash happened before any
approval flag was even consulted — the approval flag never had a chance
to matter, which is itself consistent with fail-closed behavior even
though the failure mode (crash vs. clean report) is not ideal.

**Recommendation:** file a follow-up (non-Phase-6, Phase-5-tooling) fix
for `validate-toss-evidence-intake.mjs`'s `printReport()` to pass its own
`reasonCodes` array (or default to `[]`) on the missing-file and
invalid-JSON paths, so `preflight`/`call-gate`/`completion` degrade to a
clean JSON fail-closed report instead of an uncaught exception on a fresh
checkout. Not fixed here because it is outside every Phase 6 engineer's
file ownership and unrelated to P6-001/002/003.

## Whether Paper Intent Remains Non-Broker And Simulation-Only

**Yes.** Confirmed by direct source inspection of
`src/application/paper-trading/paper-trading-engine.ts` and
`src/application/execution-simulation/order-execution-simulation-service.ts`:

- Zero imports of `BrokerWriteCommandGuard`, `TossSecuritiesAdapter`, or
  any HTTP/network client in either file.
- Zero code paths that construct a `BrokerWriteCommandGuardInput` or any
  `SUBMIT_ORDER`/`CANCEL_ORDER`/`REPLACE_ORDER`-shaped object.
- Every output type (`PaperOrder`, `PaperFill`, `PaperOrderEvent`,
  `PaperTradingResult`, `PaperOrderIntentAuditContext`,
  `PaperOrderIntentPipelineResult`) carries a literal (not computed)
  `safetyType` tag and, where applicable, a literal `liveBrokerWriteAllowed:
  false` — not derived from any condition that could evaluate to `true`.
- A live-write-capable `BrokerAccount` attached to a paper candidate is
  always `REJECTED`, never silently accepted or merely deferred.
- Repository-wide: `grep -rn "TossSecuritiesAdapter" src/` returns zero
  matches, and `TossWriteAdapter.submitOrder`/`cancelOrder`
  (`src/adapters/contracts/toss.ts`) are typed with an uncallable
  `command: never` parameter — this interface exists only as a documented
  placeholder and has no implementing class anywhere in the repository.

## Whether Reconciliation Remains Read-Only And Blocks Unresolved Discrepancies

**Yes.** Confirmed by direct source inspection of
`src/application/reconciliation/reconciliation-service.ts` and
`reconciliation-workflow-service.ts`:

- No correction-command or broker-write payload shape exists anywhere in
  either file; `correctiveTradingAllowed` is hardcoded `false` in every
  return path.
- `liveBrokerWriteAllowed` is hardcoded `false` in every return path,
  including on a fully clean, fresh report — it is never derived from
  reconciliation cleanliness.
- Unresolved discrepancies are blocked at two levels: `blocksDependentTrading`
  (immediate pause for `HIGH`/`CRITICAL`/`UNKNOWN` severity or a stale
  report) and the stricter `liveReadinessBlocked` (blocks on **any**
  unresolved issue, including `LOW`/`MEDIUM` severity that only produces a
  `WATCH` state for day-to-day paper trading). Only a fully clean, fresh
  report (`severity === "NONE"`) clears `liveReadinessBlocked`.
  `REQUIRES_HUMAN_REVIEW` issues (one-sided structural gaps) are never
  auto-resolved by the system.
- All comparisons operate on already-adapted `TossPositionSnapshot`/
  `BrokerCashSnapshot` values from the existing read-only adapter contract
  (unchanged by P6-002) or on synthetic test fixtures (`SYNT`, `SYN-A`,
  etc.) — never real captured broker payloads. Sanitized `ref` values
  never carry a raw unmasked symbol, raw quantity, raw price, or raw
  account identifier.

## Whether Risk/Kill-Switch/Approval/Guard Controls Preserve The Broker-Write Boundary

**Yes.** Confirmed by direct source inspection and by the 16-test
`tests/safety/safety-regression.test.ts` suite (including the 4 new
regressions added this phase, all using the real merged
`RiskEngine`/`KillSwitchControlService`/`OrderApprovalEngine`/
`BrokerWriteCommandGuard`, not stand-ins):

- All changes in this chain are strictly additive new checks (kill-switch
  gate consultation, staleness/freshness checks, out-of-order command
  rejection) — no existing check was removed, loosened, or given a bypass
  path. Confirmed by reading every changed file's full diff against the
  Phase 1 baseline.
- `BrokerWriteCommandGuard` still has zero code paths that call a real
  broker API; it only classifies whether a hypothetical write command
  would be allowed, and it has no escape hatch, bypass flag, or "trusted
  caller" shortcut.
- Kill-switch state is now consulted at three independent layers (risk
  engine, order approval engine, broker-write guard) and all three reuse
  the same `KillSwitchControlService`-originated reason-code vocabulary,
  so they cannot silently drift apart.
- An `OrderApproval`, even if genuinely `APPROVED`, can no longer
  authorize a broker-write command if it is stale (`order_approval_stale`)
  or if `now`/`evaluatedAt` was never supplied (`missing_evaluation_time`,
  fail closed rather than silently trusting an unproven-fresh approval).
- `KillSwitchControlService.deactivate` can no longer be used to silently
  re-open trading via a replayed or out-of-order command
  (`kill_switch_command_out_of_order`).
- `PHASE6_NO_LIVE_BROKER_WRITE_ENVIRONMENT_POLICY` gives future Phase 6
  wiring code a safe, frozen default that cannot be typo'd into enabling
  live writes.

## Whether Tests And Docs Prove Live Trading Remains Blocked

**Yes, with the tooling caveat noted above.** `npm run check` passes
cleanly (typecheck + 638 tests). `tests/safety/safety-regression.test.ts`
now proves, using real merged engines end-to-end: a signal is not an
order; a failing risk or money check blocks `OrderApproval` construction;
a `RiskEngine` veto cascades through `OrderApprovalEngine` into a blocked
`BrokerWriteCommandGuard` decision; an active kill switch blocks the
guard even when every other gate passes; `OrderApprovalEngine` rejects
when the kill-switch gate is omitted or blocked; `OrderApprovalEngine`
rejects a stale risk/money check pair; `BrokerWriteCommandGuard` rejects a
broker write built on a stale approval; `KillSwitchControlService.deactivate`
rejects an out-of-order command; broker accounts stay live-write-blocked
under every combination of missing/false/suspended state and only pass
when every field agrees; and AI analysis output — even high-confidence,
schema-valid, review-clean output — can never by itself satisfy a broker
write decision, and a forbidden nested broker-command shape in AI context
is explicitly rejected. `docs/phase6/*.md` (one doc per P6-001/002/003
branch) accurately describes each branch's behavior — verified by reading
the actual merged source against each doc's claims, not just trusting the
doc text. The one caveat is the pre-existing Phase 5 script crash
documented above under "Commands Run and Results": it is a tooling
robustness gap in fail-closed *reporting*, not a gap in the fail-closed
behavior itself (no network call, no write capability, non-zero exit in
every observed case).

## Remaining Blockers Before Any Future Live-Capable Design Phase

These are the concrete items that must be resolved — by human review,
not by any AI agent — before Phase 6 could even be considered for
extension toward a live-capable design phase. None of this is resolved
by this review; this review is a design-and-simulation-phase safety
check, not a live-trading authorization.

1. **No real `TossSecuritiesAdapter` or broker-write implementation
   exists.** `TossWriteAdapter` is an uncallable placeholder interface.
   Building a real implementation, and re-reviewing it, is unstarted work.
2. **Phase 5 evidence and open-question resolution remain human-only
   steps**, per `docs/phase5/README.md`'s "Open Question Evidence Policy":
   `TossOpenQuestionEvidenceTracker` can only compute the first evidence
   states automatically; `EVIDENCE_REVIEWED`, `QUESTION_IN_REVIEW`, and
   `QUESTION_RESOLVED` require a human reviewer name, date, and recorded
   decision in `docs/open_questions.md`. This has not happened for
   OQ-001 through OQ-004 as part of Phase 6.
3. **No production credential, compliance, or broker-account
   provisioning work has occurred.** `BrokerAccount.canWriteLive()`
   requires `status === "ACTIVE"`, `liveTradingEnabled === true`, and
   `permissionStatus === "LIVE_TRADING_ALLOWED"` all agreeing — none of
   which exist for any real account in this codebase; only test fixtures
   construct such an account.
4. **The Phase 5 script robustness bug** (`validate-toss-evidence-intake.mjs`
   crashing instead of cleanly fail-closing when an explicit intake path
   is missing) should be fixed before any operator relies on
   `preflight`/`call-gate`/`completion` for a real go/no-go decision on a
   fresh machine. It does not currently allow anything unsafe, but a crash
   is a worse failure mode for an operator to interpret correctly than a
   clean, sanitized "not ready" report.
5. **No load-bearing decision in this review, or in P6-001/002/003, has
   been made by an AI agent alone.** Per `docs/11_AI_RULES.md` Rule 12 and
   Rule 26 through 30, any actual promotion toward live capability
   requires explicit human review and sign-off — this review cannot and
   does not provide that sign-off; it only reports the current, verified
   state of the simulation-only system.
6. **Small-capital live readiness (docs/07_Trading_System.md section 30)
   is entirely unaddressed by Phase 6**, by design — Phase 6 is
   simulation-only per `docs/tasks/phase6_claude_worktree_tasks/README.md`,
   "Phase 6 Boundary". Items like real broker order-type verification,
   real slippage measurement, and real fee/tax exposure remain untouched
   and unverified.

## Appendix: Phase 1 Regression-Gap Check (Pre-Merge Baseline)

This appendix records the Phase 1 work only: a review of the
pre-P6-001/002/003 state of the risk, kill-switch, order-approval, and
broker-write-guard chain, and of `tests/safety/safety-regression.test.ts`
against that baseline. It is not the Phase 6 integration review itself.

Baseline commit reviewed: `c090a0f` ("Add Phase 6 Claude task plan"),
local `main` tip at the start of Phase 6, before any of P6-001, P6-002,
or P6-003 were merged.

Files read as the safety-critical baseline:

- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `src/application/risk-engine/risk-engine.ts`
- `src/application/kill-switch/kill-switch-control-service.ts`
- `src/application/order-approval/order-approval-engine.ts`

### Gap Check Findings

1. Kill-switch blocks action — confirmed at the unit level
   (`tests/application/kill-switch-control-service.test.ts`,
   `tests/application/risk-engine.test.ts`), but the consolidated
   `tests/safety/safety-regression.test.ts` harness did not previously
   exercise `KillSwitchControlService` or feed a real kill-switch trading
   gate into `BrokerWriteCommandGuard`. Closed in this phase by adding an
   end-to-end regression test that activates a kill switch through
   `KillSwitchControlService`, takes its real `evaluateTradingGate(...)`
   output, and proves `BrokerWriteCommandGuard` rejects the command with
   `kill_switch_active_global` even when every other gate passes.

2. Risk veto blocks action — confirmed at the unit level
   (`tests/application/risk-engine.test.ts`,
   `tests/application/order-approval-engine.test.ts`), but the
   consolidated safety-regression harness never previously instantiated
   `RiskEngine` or `OrderApprovalEngine`; it only tested the `OrderApproval`
   domain constructor's invariant. Closed in this phase by adding an
   end-to-end regression test that runs `RiskEngine.evaluate(...)` to a
   `FAIL` result, feeds that real `RiskCheck` into `OrderApprovalEngine`
   (producing a `REJECTED` approval with `risk_check_not_passing`), and
   then feeds that real rejected `OrderApproval` into
   `BrokerWriteCommandGuard`, proving it is blocked with
   `order_approval_not_approved`.

3. Missing/unapproved approval blocks action — already proven both in
   `tests/application/broker-write-command-guard.test.ts` (missing
   approval) and by the new end-to-end test added in this phase
   (unapproved/rejected approval). No further gap found.

   Note: the current codebase has no staleness/TTL/expiry concept for
   `OrderApproval` at all (no timestamp field on the domain object, no
   staleness check in `BrokerWriteCommandGuard` or
   `OrderApprovalEngine`). "Stale approval" is therefore not a behavior
   that exists to be tested yet — only "missing" and "not approved"
   are enforced today. Adding that behavior would be an implementation
   change to files owned by P6-003
   (`order-approval-engine.ts`, `broker-write-command-guard.ts`), which is
   out of scope for this Phase 1 pass. This is flagged here so Phase 2
   can check whether P6-003 introduced approval freshness/TTL handling,
   and so it can be raised as a candidate remaining blocker if not.

   **Phase 2 update:** P6-003 closed this exact gap. `OrderApprovalEngine`
   now requires `evaluatedAt` and rejects a stale/future-dated
   `RiskCheck`/`MoneyCheck` pair (`risk_check_stale` /
   `money_check_stale` / `*_timestamp_in_future`), and
   `BrokerWriteCommandGuard` now requires `now` and rejects a broker write
   built on a stale `OrderApproval` (`order_approval_stale`). Engineer 3
   explicitly credited this Phase 1 finding in
   `docs/phase6/risk-kill-switch-approval-guard.md` and left four
   recommended regression tests for Engineer 4 to add in Phase 2 — all four
   are now in `tests/safety/safety-regression.test.ts` and passing against
   the real merged engines (see "P6-003 Regressions Added In Phase 2" below).

4. AI output alone cannot approve execution — already proven in the
   existing `tests/safety/safety-regression.test.ts` "AI output stays
   advisory-only" test group (forbidden nested broker command rejected;
   clean, high-confidence, review-clean AI analysis alone still fails
   every deterministic gate; invalid Claude output cannot even build an
   analysis record). No gap found.

5. `BrokerWriteCommandGuard` rejects write-looking commands — already
   proven in `tests/safety/safety-regression.test.ts` (nested
   `submitOrder` forbidden-command test) and in
   `tests/application/broker-write-command-guard.test.ts` (default-block
   test, Claude-shaped `brokerCommand` test). No gap found.

### Tests Added In Phase 1

Both added to `tests/safety/safety-regression.test.ts`:

- "lets a RiskEngine veto cascade through OrderApprovalEngine into a
  blocked BrokerWriteCommandGuard decision"
- "blocks the BrokerWriteCommandGuard when the kill switch is active even
  though every other gate passes"

Both tests use the real `RiskEngine`, `OrderApprovalEngine`, and
`KillSwitchControlService` implementations (not hand-rolled stand-ins),
chained into `BrokerWriteCommandGuard`, so they double as an
integration-level regression net across module boundaries. No existing
test was weakened, removed, or loosened to make these pass.

### P6-003 Regressions Added In Phase 2

After merging P6-003, `docs/phase6/risk-kill-switch-approval-guard.md`'s
"For Engineer 4 (P6-004 Phase 2 Integration)" section requested four
specific regression tests. All four were added to
`tests/safety/safety-regression.test.ts` in a new nested `describe("P6-003
chain hardening ...")` block, using the real merged
`OrderApprovalEngine`/`KillSwitchControlService`/`BrokerWriteCommandGuard`:

1. "OrderApprovalEngine rejects when the kill-switch gate is omitted or
   blocked" — proves both the omitted case (`missing_kill_switch_gate`)
   and the actively-blocked case (a real activated kill switch's gate
   reused verbatim as `kill_switch_active_global`).
2. "OrderApprovalEngine rejects a stale RiskCheck/MoneyCheck pair" —
   evaluates 20 minutes after both checks, past the 5-minute default,
   and proves both `risk_check_stale` and `money_check_stale` appear.
3. "BrokerWriteCommandGuard rejects a broker write command built on a
   stale OrderApproval" — proves `order_approval_stale` blocks an
   otherwise-fully-passing broker write.
4. "KillSwitchControlService.deactivate rejects an out-of-order command
   that predates a more recent activation" — activates at T+10m, then
   attempts to deactivate with a command timestamped T+5m, and proves the
   deactivation is rejected (`kill_switch_command_out_of_order`) and the
   switch remains `ACTIVE`.

None of these four duplicated the two tests already added in Phase 1: the
Phase 1 tests proved risk-veto-cascades-to-guard-rejection and
kill-switch-active-blocks-guard using the *pre-P6-003* engine shapes; these
four specifically exercise the *new* P6-003 behavior (kill-switch gate
consultation inside `OrderApprovalEngine`, and staleness on both
`OrderApprovalEngine` and `BrokerWriteCommandGuard`) that did not exist
before P6-003 merged. `tests/safety/safety-regression.test.ts` now has 16
tests total, all passing.

### Phase 1 Commands Run

```bash
npx vitest run tests/safety/safety-regression.test.ts
npm run check
```

Both passed. `npm run check` ran typecheck plus the full test suite
(82 test files, 605 tests, all passing) with no regressions introduced.

### Phase 1 Scope Notes

- No implementation files owned by Engineer 1, Engineer 2, or Engineer 3
  were modified.
- No real Toss API call was made, simulated, or coded.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed.
- `docs/tasks/phase6_claude_worktree_tasks/README.md` was not modified.
