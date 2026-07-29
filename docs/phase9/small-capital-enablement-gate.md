# Phase 9 Small-Capital Enablement Gate (P9-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase9_claude_worktree_tasks/P9-003_small_capital_enablement_gate.md`
Related Code: `src/application/live-readiness/small-capital-enablement-gate.ts`,
`tests/application/small-capital-enablement-gate.test.ts`
Related Docs: `docs/phase9/README.md`,
`docs/phase9/small-capital-go-no-go-checklist.md`,
`docs/phase7/small-capital-readiness-gates.md`,
`docs/phase7/live-capable-blocker-register.md`,
`docs/phase8/README.md`, `docs/phase8/operations-status-api.md`,
`docs/phase8/deployment-readiness-gate.md`,
`docs/phase8/backup-restore-drill.md`, `docs/11_AI_RULES.md`

## Purpose

This document describes the Phase 9 small-capital enablement gate: a pure,
design-time evaluator that composes Phase 7 small-capital readiness, Phase 8
operations/deployment/backup-restore readiness, and Phase 9 live-capable
blocker evidence into a single go/no-go **preparation** report.

Per `docs/phase9/README.md`, Phase 9 round 1:

- does not authorize live trading
- does not implement a real Toss broker-write adapter
- does not place, cancel, replace, transfer, withdraw, or convert anything
- does not mark any `LCB-*` blocker `RESOLVED`
- must never set `liveBrokerWriteAllowed: true` in any runtime path

This gate is the final composition point for that boundary. Its single most
important property, restated three times in this document because it is
the entire reason this module exists, is:

> **This gate may report that all preparation evidence is present. It must
> never, under any input, flip live write authorization on.**

## Two Concepts That Must Never Be Conflated

Restating the same distinction already drawn by
`docs/phase8/deployment-readiness-gate.md` and by
`src/application/live-readiness/small-capital-readiness.ts`, one level
higher up the composition:

1. **Small-capital *preparation* readiness**
   (`readyForSmallCapitalPreparation`) — whether the evidence this gate can
   see (Phase 7 readiness, Phase 8 operations/deployment/backup readiness,
   Phase 9 live-blocker evidence intake) is currently clean and complete.
2. **Live-trading authorization** (`readyForLiveBrokerWrites` /
   `liveBrokerWriteAllowed`) — an entirely separate concept that this
   module cannot compute, grant, or imply under any circumstance. Both
   fields are literal `false` return values, never derived from (1), never
   derived from any upstream report, and never derived from any input
   combination whatsoever.

A clean `readyForSmallCapitalPreparation: true` reading is never, under any
input, a live-trading authorization.

## What The Evaluator Is

`evaluateSmallCapitalEnablementGate` (in
`src/application/live-readiness/small-capital-enablement-gate.ts`) is a
**pure function**: no network code, no filesystem access, no broker client,
and no side effects of any kind. It takes a plain data input composed of
already-computed upstream reports/signals and returns a plain data report.
It never constructs, submits, cancels, or replaces a broker order.

It is the top of the composition chain built across Phase 7–9:

```text
evaluateSmallCapitalReadiness (Phase 7, P7-003)          -> smallCapitalReadiness
OperationsStatusReadModel.buildStatus (Phase 8, P8-001)  -> operations (duck-typed signal)
evaluateDeploymentReadiness (Phase 8, P8-002)             -> deploymentReadiness
evaluateBackupRestoreDrill (Phase 8, P8-003)               -> backupRestoreDrill
P9-001-shaped evidence-intake output (Phase 9, P9-001)     -> liveBlockerEvidence
                                   |
                                   v
                  evaluateSmallCapitalEnablementGate (Phase 9, P9-003)
                                   |
                                   v
                  SmallCapitalEnablementGateReport
                  (readyForSmallCapitalPreparation only;
                   readyForLiveBrokerWrites / liveBrokerWriteAllowed
                   are always literal false)
```

## Why The Operations Input Is A Locally-Defined Shape, Not An Import

`src/application/operations/operations-status-read-model.ts` already
imports `SmallCapitalReadinessReport` from this module's sibling file
(`small-capital-readiness.ts`). Importing `OperationsStatusSummary` back
into `small-capital-enablement-gate.ts` would create an import cycle
(`live-readiness -> operations -> live-readiness`). This module instead
consumes a small, locally-defined, duck-typed
`SmallCapitalEnablementOperationsSignal` shape — the same import-cycle
avoidance rationale already used by `SmallCapitalOperatorSurfaceSignal` in
`small-capital-readiness.ts` and by `BackupRestoreDrillReconciliationSignal`
/ `BackupRestoreDrillDataQualitySignal` in `backup-restore-drill.ts`. Any
real `OperationsStatusSummary` (produced by `OperationsStatusReadModel`) is
structurally compatible with this shape; a caller assembling this gate's
input is expected to map the real read model output onto it.

`DeploymentReadinessReport` and `BackupRestoreDrillReport`, by contrast,
carry no dependency back on `live-readiness`, so this module imports those
two types directly from `../deployment/index.js` and
`../backup-restore/index.js` with no cycle risk.

## Why The Live-Blocker Evidence Input Is A Locally-Defined Shape, Not An Import

Engineer 1 (P9-001) is building `live-blocker-evidence-intake.ts` in
parallel, and it does not exist in this worktree. Per
`docs/tasks/phase9_claude_worktree_tasks/P9-003_small_capital_enablement_gate.md`,
this gate accepts a plain, locally-defined `LiveBlockerEvidenceSummaryEntry[]`
input parameter instead of importing that in-flight module, keeping both
tasks independently mergeable in either order:

```ts
type LiveBlockerReviewStatus = "NOT_STARTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED";

interface LiveBlockerEvidenceSummaryEntry {
  blockerId: string;             // one of "LCB-001".."LCB-008"
  status: LiveBlockerReviewStatus;
  humanReviewerName?: string;    // required to accept a HUMAN_REVIEWED entry
  humanReviewedAt?: Date;        // required to accept a HUMAN_REVIEWED entry
}
```

If the real P9-001 output shape does not line up exactly with this after
both branches merge, that mismatch is expected and will be reconciled in a
later, separately reviewed change. It does not block this task.

There is deliberately no `"RESOLVED"` member in `LiveBlockerReviewStatus`.
This gate never treats any `LCB-*` blocker as resolved — resolution can
only happen the way `docs/phase7/live-capable-blocker-register.md` already
requires: a human reviewer recording a reviewer name, reviewed date, and
decision directly in that register (or the artifact path it points to).

## Checks Performed

### 1. Phase 7 small-capital readiness

The caller supplies the already-computed
`evaluateSmallCapitalReadiness` output (`SmallCapitalReadinessReport`). A
missing report blocks (`missing_phase7_small_capital_readiness`); every
`blockingReasonCodes` entry on the upstream report is passed through,
namespaced `phase7_<code>`. Its `warnings` are passed through as
`phase7_<warning>` warnings on this gate's own report (never blocking).

### 2. Phase 8 operations readiness

The caller supplies a `SmallCapitalEnablementOperationsSignal` (see above).
A missing signal blocks (`missing_phase8_operations_signal`). Otherwise:

- `systemHealth !== "OK"` blocks
  (`phase8_operations_system_health_not_ok_<status>`).
- `liveReadinessBlocked` blocks (`phase8_operations_live_readiness_blocked`).
- `!killSwitchAllowed || killSwitchBlocksNewOrders` blocks
  (`phase8_operations_kill_switch_blocks_new_orders`).
- `hasOpenCriticalAlert` blocks
  (`phase8_operations_open_critical_alerts_present`).
- `unsafeSchedulerJobDefinitionCount > 0` blocks
  (`phase8_operations_unsafe_scheduler_job_definitions_present`).

### 3. Phase 8 deployment readiness

The caller supplies the already-computed `evaluateDeploymentReadiness`
output (`DeploymentReadinessReport`). A missing report blocks
(`missing_phase8_deployment_readiness`); every `blockingReasonCodes` entry
is passed through, namespaced `phase8_deployment_<code>`.

### 4. Phase 8 backup/restore/rollback drill readiness

The caller supplies the already-computed `evaluateBackupRestoreDrill`
output (`BackupRestoreDrillReport`). A missing report blocks
(`missing_phase8_backup_restore_drill`); every `blockingReasonCodes` entry
is passed through, namespaced `phase8_backup_restore_<code>`.

### 5. Phase 9 live-blocker evidence intake

The caller supplies `liveBlockerEvidence: LiveBlockerEvidenceSummaryEntry[]`.
A missing array blocks entirely (`missing_live_blocker_evidence_summary`)
and every one of the eight required `LCB-*` ids is treated as missing.
Otherwise, for each of `LCB-001`..`LCB-008` (fixed module constant,
`REQUIRED_LIVE_CAPABLE_BLOCKER_IDS`):

- No matching entry blocks (`live_blocker_evidence_missing_<id>`).
- More than one entry for the same id blocks
  (`live_blocker_evidence_duplicate_entries_<id>`) rather than silently
  picking one, per `docs/11_AI_RULES.md` Rule 22 ("fail closed").
- An unrecognized `status` value blocks
  (`live_blocker_evidence_invalid_status_<id>`) rather than being trusted —
  this fails closed even if a caller widens the type at the JS boundary.
- `status: "NOT_STARTED"` blocks
  (`live_blocker_evidence_not_started_<id>`) — preparation cannot be called
  complete for a blocker no evidence-gathering has even begun on.
- `status: "READY_FOR_HUMAN_REVIEW"` does **not** block preparation
  readiness (evidence has been gathered; a human has not yet reviewed it —
  see "Preparation Readiness vs. Human-Review-Missing" below).
- `status: "HUMAN_REVIEWED"` requires a non-blank `humanReviewerName` and a
  valid `humanReviewedAt`; missing either blocks
  (`live_blocker_evidence_human_reviewed_missing_reviewer_name_<id>` /
  `live_blocker_evidence_human_reviewed_missing_reviewed_at_<id>`) — an
  unattributed or undated "reviewed" claim is not trusted.

## Preparation Readiness vs. Human-Review-Missing

`readyForSmallCapitalPreparation` intentionally does **not** require every
`LCB-*` blocker to be `HUMAN_REVIEWED`. Phase 9 round 1's purpose (per
`docs/phase9/README.md`) is building evidence intake, preflight, and
enablement gates — not obtaining eight human sign-offs, one of which
(`LCB-008`) is structurally impossible to satisfy in this phase at all,
because the real write adapter it would review must not exist yet (per
`docs/phase7/live-capable-blocker-register.md`, LCB-008's `BLOCKED`
status). Requiring full `HUMAN_REVIEWED` status for every blocker before
`readyForSmallCapitalPreparation` could ever be `true` would make the field
permanently, structurally `false` regardless of how much real preparation
work is done — which would make the field useless as a preparation signal.

Instead: `NOT_STARTED` blocks (evidence gathering has not even begun);
`READY_FOR_HUMAN_REVIEW` and `HUMAN_REVIEWED` do not block preparation
readiness. The separate `humanReviewMissingReasonCodes` array (and the
matching `SmallCapitalEnablementLiveBlockerView.humanReviewMissingReasonCodes`)
is populated for every blocker not yet genuinely `HUMAN_REVIEWED`,
independent of whether `readyForSmallCapitalPreparation` is `true` — so a
caller can never lose sight of "a human still needs to review these" just
because the gate otherwise looks clean. `tests/application/small-capital-enablement-gate.test.ts`
asserts both halves of this directly: a `READY_FOR_HUMAN_REVIEW`-only input
can be `readyForSmallCapitalPreparation: true` while still reporting eight
non-empty `humanReviewMissingReasonCodes`, and only a fully
`HUMAN_REVIEWED` input clears that array to empty.

## Defense In Depth: Upstream `false`-Literal Fields Are Re-Checked, Not Trusted

Every upstream report this gate consumes
(`SmallCapitalReadinessReport.liveBrokerWriteAllowed`,
`DeploymentReadinessReport.liveBrokerWriteAllowed`,
`BackupRestoreDrillReport.liveBrokerWriteAllowed`,
`BackupRestoreDrillReport.correctiveTradingAllowed`, and the operations
signal's `liveBrokerWriteAllowed`) already carries its own hardcoded
`false` literal, per each module's own design. This gate additionally
re-checks every one of those fields at runtime and treats anything other
than a strict `false` as its own blocking condition (for example
`phase7_report_live_broker_write_allowed_not_false`). This can never be
triggered by a genuine upstream report — it exists purely as a structural
tripwire against a hand-constructed or tampered input object that violates
its own declared type at the JavaScript boundary (TypeScript's compile-time
literal type checking does not protect against that). It does not, and
cannot, change this gate's own output either way: `readyForLiveBrokerWrites`
and `liveBrokerWriteAllowed` on *this* report remain hardcoded literals
regardless of what this check finds.

## Fail-Closed Behavior

Every check above fails closed: a missing, blank, duplicated, or malformed
input is always treated as blocking, never as "assume ready."
`readyForSmallCapitalPreparation` is only `true` when `blockingReasonCodes`
is empty. The evaluator never throws for a missing or malformed input — it
always returns a report.

## Report Shape

```ts
interface SmallCapitalEnablementGateReport {
  readyForSmallCapitalPreparation: boolean;
  readyForLiveBrokerWrites: false;   // always literal false
  liveBrokerWriteAllowed: false;     // always literal false
  blockingReasonCodes: string[];
  humanReviewMissingReasonCodes: string[];
  warnings: string[];
  phase7Readiness: SmallCapitalEnablementPhase7View;
  operationsReadiness: SmallCapitalEnablementOperationsView;
  deploymentReadiness: SmallCapitalEnablementDeploymentView;
  backupRestoreReadiness: SmallCapitalEnablementBackupRestoreView;
  liveBlockerEvidence: SmallCapitalEnablementLiveBlockerView;
  evidenceOnlyStatement: string;     // verbatim SMALL_CAPITAL_ENABLEMENT_GATE_EVIDENCE_STATEMENT
  generatedAt: Date;
  safetyType: "SMALL_CAPITAL_ENABLEMENT_GATE_REPORT_EVIDENCE_ONLY";
}
```

`evidenceOnlyStatement` is the exported constant
`SMALL_CAPITAL_ENABLEMENT_GATE_EVIDENCE_STATEMENT`, restated as data on
every report (not only in this document) so a caller reading only the JSON
output — a dashboard, a log line, an operator terminal — still sees the
evidence-not-authorization statement directly.

## How `readyForLiveBrokerWrites` / `liveBrokerWriteAllowed` Are Proven Unconditional

Both fields are written as the bare literal `false` at the evaluator's
single return statement — there is no branch, ternary, ternary chain, or
expression anywhere in `small-capital-enablement-gate.ts` that can produce
`true` for either field. This is verified two ways:

1. **By the type system.** Both fields are typed as the TypeScript literal
   type `false` (not `boolean`), so any attempt to return a computed
   `boolean` expression for them is a compile error.
2. **By a dedicated test.** `tests/application/small-capital-enablement-gate.test.ts`
   constructs a `maximallyCleanInput()` fixture — every upstream report
   clean (`readyForSmallCapitalLive: true`, `readyToDeploy: true`,
   `resumeAllowed: true`, `systemHealth: "OK"`) **and** every one of the
   eight `LCB-*` blockers `HUMAN_REVIEWED` with a valid reviewer name and
   date — and asserts `readyForSmallCapitalPreparation: true` while
   `readyForLiveBrokerWrites` and `liveBrokerWriteAllowed` are still
   `false`, plus a `JSON.stringify` scan proving neither field serializes
   as `true` anywhere in the report.

## What This Gate Does Not Do

- It does not construct, submit, cancel, or replace a broker order of any
  kind, including an unused or example type.
- It does not make any network call.
- It does not read `.env`, `tmp/phase5`, or any real secret value; this
  module performs no filesystem or environment access at all.
- It does not resolve, advance, or close any entry in
  `docs/phase7/live-capable-blocker-register.md`. It only reads a
  caller-supplied summary of that register's review status.
- It does not construct or accept a `LiveBlockerEvidenceSummaryEntry` whose
  `status` is `"HUMAN_REVIEWED"` from anywhere inside this codebase — that
  value must arrive as caller-supplied input, populated by a human
  reviewer, exactly like `ManualLiveApprovalRecord.approvalStatus:
  "APPROVED"` in `small-capital-readiness.ts` already requires.
- It does not modify `small-capital-readiness.ts`,
  `operations-status-read-model.ts`, `deployment-readiness-gate.ts`, or
  `backup-restore-drill.ts` — all four are consumed read-only, by public
  type shape.
- It does not weaken any existing safety check, guard, or test assertion.
- `readyForSmallCapitalPreparation: true` from this evaluator is evidence
  that preparation-time gates are currently satisfied. It is not, and can
  never become, live-trading authorization on its own.

## Relationship To Other Phase 9 Work

- P9-001 (`live-blocker-evidence-intake.ts`, not present in this worktree)
  is expected to be the natural real-world producer of the
  `liveBlockerEvidence` input, once merged and once its output shape is
  reconciled against `LiveBlockerEvidenceSummaryEntry` above.
- P9-002 (`toss-write-preflight.ts`, not owned by this task) hardens the
  contract of a future write adapter; this gate does not import from it and
  is not a prerequisite for it.
- P9-004 performs the full Phase 9 integration review after all four Phase
  9 tasks are merged, including this gate.
- For the operator-facing checklist version of everything this document
  describes, see `docs/phase9/small-capital-go-no-go-checklist.md`.
