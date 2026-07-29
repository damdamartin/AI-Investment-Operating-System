# Phase 9 Small-Capital Go/No-Go Checklist (P9-003)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase9_claude_worktree_tasks/P9-003_small_capital_enablement_gate.md`
Related Code: `src/application/live-readiness/small-capital-enablement-gate.ts`
Related Docs: `docs/phase9/small-capital-enablement-gate.md`,
`docs/phase7/small-capital-readiness-gates.md`,
`docs/phase7/live-capable-blocker-register.md`,
`docs/phase7/manual-live-approval-record.md`, `docs/phase8/README.md`,
`docs/11_AI_RULES.md`

## Read This First

> **`readyForSmallCapitalPreparation: true` is not permission to trade real
> money.** It means the preparation evidence this repository can check by
> code is currently clean. It says nothing about whether a human has
> reviewed the eight `LCB-*` blockers, whether Toss has confirmed automated
> trading is permitted, or whether any real broker-write adapter exists —
> none of that can exist in this phase (see `docs/phase9/README.md`,
> "Boundary"). This checklist exists to help a human operator read the
> `SmallCapitalEnablementGateReport` correctly, not to make that report
> mean something it structurally cannot mean.

This checklist is a reading guide for
`evaluateSmallCapitalEnablementGate`'s output
(`src/application/live-readiness/small-capital-enablement-gate.ts`). It is
not itself an approval process, and filling it out does not authorize
anything. The only thing that can authorize live trading is the process
already described in `docs/phase7/manual-live-approval-record.md` and the
human-reviewer sign-offs recorded in
`docs/phase7/live-capable-blocker-register.md` — neither of which this
checklist replaces, shortcuts, or substitutes for.

## How To Use This Checklist

1. Assemble a `SmallCapitalEnablementGateInput` from the latest real
   outputs of `evaluateSmallCapitalReadiness` (Phase 7),
   `OperationsStatusReadModel.buildStatus` mapped onto
   `SmallCapitalEnablementOperationsSignal` (Phase 8),
   `evaluateDeploymentReadiness` (Phase 8),
   `evaluateBackupRestoreDrill` (Phase 8), and the current
   `LiveBlockerEvidenceSummaryEntry[]` for `LCB-001`..`LCB-008` (Phase 9).
2. Call `evaluateSmallCapitalEnablementGate` and read the resulting
   `SmallCapitalEnablementGateReport`.
3. Walk the checklist below, top to bottom. Every item must be satisfied
   before a human even considers this a candidate for the *next* phase
   (not this one) — a future, separately reviewed live-implementation
   phase.
4. If any item fails, stop. Do not attempt to work around it in code. Fix
   the underlying gap (more evidence, a fixed operational issue, an actual
   human review) and re-run the gate from a clean state.

## Section A — Report-Level Checks

- [ ] `report.safetyType === "SMALL_CAPITAL_ENABLEMENT_GATE_REPORT_EVIDENCE_ONLY"`
- [ ] `report.readyForLiveBrokerWrites === false` (always true by
      construction — if this is ever anything else, treat it as a critical
      bug and stop immediately; see `docs/phase9/small-capital-enablement-gate.md`,
      "How `readyForLiveBrokerWrites` / `liveBrokerWriteAllowed` Are Proven
      Unconditional")
- [ ] `report.liveBrokerWriteAllowed === false` (same as above)
- [ ] `report.evidenceOnlyStatement` is present and has been read by the
      human operator, not just machine-checked
- [ ] `report.blockingReasonCodes` is empty
- [ ] `report.readyForSmallCapitalPreparation === true`

If Section A does not fully pass, stop here. Nothing below matters yet.

## Section B — Phase 7 Small-Capital Readiness

- [ ] `report.phase7Readiness.status === "OK"`
- [ ] `report.phase7Readiness.readyForSmallCapitalLive === true`
- [ ] No `phase7_*` codes appear in `report.blockingReasonCodes`
- [ ] The underlying `ManualLiveApprovalRecord` behind this reading was
      signed by a human `OWNER`, with the verbatim
      `REQUIRED_MANUAL_APPROVAL_ATTESTATION`, and has not expired or been
      revoked (per `docs/phase7/manual-live-approval-record.md`) — the gate
      checks this structurally, but a human should still independently
      confirm the record they expect is the one that was actually used

## Section C — Phase 8 Operations Readiness

- [ ] `report.operationsReadiness.status === "OK"`
- [ ] `report.operationsReadiness.systemHealth === "OK"`
- [ ] No `phase8_operations_*` codes appear in `report.blockingReasonCodes`

## Section D — Phase 8 Deployment Readiness

- [ ] `report.deploymentReadiness.status === "OK"`
- [ ] `report.deploymentReadiness.readyToDeploy === true`
- [ ] No `phase8_deployment_*` codes appear in `report.blockingReasonCodes`

## Section E — Phase 8 Backup/Restore/Rollback Readiness

- [ ] `report.backupRestoreReadiness.status === "OK"`
- [ ] `report.backupRestoreReadiness.resumeAllowed === true`
- [ ] No `phase8_backup_restore_*` codes appear in
      `report.blockingReasonCodes`
- [ ] The rollback rehearsal behind this reading was actually rehearsed
      against mocked/simulated state per
      `docs/phase8/rollback-drill-runbook.md`, not just checked as a data
      flag

## Section F — Phase 9 Live-Capable Blocker Evidence

- [ ] `report.liveBlockerEvidence.status === "OK"` (no blocker is missing,
      duplicated, or `NOT_STARTED`)
- [ ] `report.liveBlockerEvidence.missingBlockerIds` is empty
- [ ] `report.liveBlockerEvidence.notStartedBlockerIds` is empty
- [ ] For every id in `report.liveBlockerEvidence.readyForHumanReviewBlockerIds`:
      a human with the reviewer role named in
      `docs/phase7/live-capable-blocker-register.md` for that specific
      blocker has actually looked at the evidence — this checklist item is
      **not** satisfied merely by the gate reporting
      `READY_FOR_HUMAN_REVIEW`; that status means evidence exists, not that
      a human has reviewed it
- [ ] `report.humanReviewMissingReasonCodes` — read this list even when
      Section A passed. Every code in this array (`human_review_missing_<id>`)
      names a blocker still awaiting genuine human review. A non-empty list
      here is normal and expected in Phase 9 round 1 (see
      `docs/phase9/small-capital-enablement-gate.md`, "Preparation Readiness
      vs. Human-Review-Missing") — it is not itself a failure of this
      checklist, but every entry in it must be tracked to closure before any
      future live-implementation phase begins
- [ ] For `LCB-004` (Human Approval Evidence) specifically: confirm this was
      never satisfied by AI-generated text presented as approval. Per
      `docs/phase7/live-capable-blocker-register.md`, "No AI agent,
      including this audit, can satisfy LCB-004 on a human's behalf."
- [ ] For `LCB-008` (Real Broker Write Adapter Review Evidence)
      specifically: confirm it is still `BLOCKED` in the register, not
      marked otherwise. It cannot legitimately be resolved until a later,
      separately scoped phase produces a reviewable real adapter — if this
      gate or any evidence summary ever claims otherwise, treat that as a
      critical finding, not as progress.

## Section G — What A Fully Passing Checklist Actually Means

Even with every box above checked:

- No real Toss API call has been made, or is possible from this codebase.
- No `TossSecuritiesAdapter` write implementation exists.
- No `LCB-*` blocker in `docs/phase7/live-capable-blocker-register.md` is
  `RESOLVED` merely because this checklist passed — resolution happens only
  in that register, by a human, per its own rules.
- The only thing this checklist and the underlying gate report establish is
  that **preparation** evidence is complete and current. The decision to
  begin a future, separately reviewed live-implementation phase remains
  entirely a human decision, made outside of this codebase, informed by —
  but never automated by — this report.

## Non-Goals Of This Checklist

- It is not a substitute for `docs/phase7/manual-live-approval-record.md`.
- It is not a substitute for compliance/legal review
  (`docs/13_Compliance_and_Legal_Review.md` Section 9).
- It does not grant, imply, or shortcut any approval.
- It cannot be completed by an AI agent on a human's behalf. Every checkbox
  above that references "a human has reviewed," "a human confirms," or "a
  human decision" requires an actual human, not a report reading `OK`.
