# Codex Phase 8 Operations Readiness Review

Version: 1.0.0
Status: Complete
Review Date: 2026-07-29
Task: P8-004 Phase 8 Integration Review
Assigned Engineer: Engineer 4

## Purpose

This document records the Phase 8 integration and operations-readiness
review after P8-001 (operations status API), P8-002 (deployment readiness
gate), and P8-003 (backup/restore/rollback drills) were merged into local
`main`. It follows the same two-phase pattern used for
`docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md` and
`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`: Phase 1
established a pre-merge baseline (source scans, a regression-gap check,
and a scaffold); Phase 2 (this content) performs the full integration
review now that P8-001/P8-002/P8-003 exist and are merged.

Merge commits reviewed (local `main`, never pushed to GitHub):

- `8cf1af1` — Merge Phase 8 Engineer 1: P8-001 operations status API
- `9ae7056` — Merge Phase 8 Engineer 2: P8-002 deployment readiness gate
- `26d3e45` — Merge Phase 8 Engineer 3: P8-003 backup restore rollback
  drills

Local `main` tip at review time: `26d3e45`. This review was produced from
`phase8/p8-004-integration-review` after merging local `main` into it
(`git merge main`, merge commit `de5da4e`). Every claim below was checked
directly against the merged source in this worktree — the three new
source files, their test files, and their four new docs — not inferred
from the orchestrator's summary alone.

**This document does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, real cloud deployment, or production capital use — in either
phase.**

## Phase Status

- Phase 1 (scaffold, baseline source scans, pre-merge regression-gap
  check): complete.
- Phase 2 (full integration review after P8-001/P8-002/P8-003 merge):
  complete.

## Summary

P8-001, P8-002, and P8-003 merged into local `main` cleanly (merge commits
`8cf1af1`, `9ae7056`, `26d3e45`; tip `26d3e45`), and merged into this
review branch with no conflicts (`git merge main`, `ort` strategy, merge
commit `de5da4e`). `npm run check` passes cleanly on the merged branch:
typecheck clean, 87 test files, 818 tests, all passing (813 from merged
`main` plus 5 this branch already carried across its own two phases in
`tests/safety/safety-regression.test.ts` — 2 from Phase 1, 3 added in
Phase 2 below — for 25 tests total in that file).

All three branches add pure, side-effect-free evaluators/read-models on
top of the existing Phase 5/6/7 safety chain, exactly matching their task
docs' scope:

- **P8-001** (`src/application/operations/operations-status-read-model.ts`)
  aggregates already-computed Phase 6/7 outputs into a single sanitized,
  advisory-only `OperationsStatusSummary`. It exposes exactly one public
  method (`buildStatus`, enforced by a prototype-enumeration test), adds no
  command surface, and hardcodes `liveBrokerWriteAllowed: false` at both
  the top level and on the nested small-capital-readiness sub-summary,
  proven to stay `false` even when `readyForSmallCapitalLive: true`.
- **P8-002** (`src/application/deployment/deployment-readiness-gate.ts`)
  is a pure evaluator whose `DeploymentReadinessReport.liveBrokerWriteAllowed`
  is a hardcoded literal, never computed from input. It performs zero
  `process.env` reads, zero network/exec/cloud-CLI calls (grep-confirmed
  directly, not just per the task summary), and treats every secret input
  as a `{ name, reference }` pointer, never a value, actively blocking if a
  reference pattern-matches a real secret/token shape.
- **P8-003** (`src/application/backup-restore/backup-restore-drill.ts`) is
  a pure evaluator with zero database/ORM/SQL imports of any kind
  (grep-confirmed). It requires an explicit
  `reconciledAgainstBrokerSnapshot: boolean` attestation, distinct from a
  database-only check, and blocks resume when it is `false` or missing
  regardless of how clean everything else looks. `requestedResumeMode` is
  restricted to `"PAPER" | "SIMULATION"` at both the type and runtime
  level — no code path can produce or accept `"PRODUCTION"`. Both
  `liveBrokerWriteAllowed` and `correctiveTradingAllowed` on its report are
  hardcoded `false` literals.

None of the three branches weakens or bypasses an existing fail-closed
control, and none adds a code path capable of placing, cancelling, or
modifying a broker order, moving money, calling a real Toss API, or
running a real cloud deployment command. The post-merge source scans
(below) found 9 new matches in Scan 1 and 12 new matches in Scan 2 versus
the Phase 1 baseline, plus one benign regex false-positive (a property
access `input.environmentSkeletons` whose substring `input.env` matches
Scan 2's `\.env` pattern — confirmed by direct file reading, not a real
`.env` file reference) and one correction to my own Phase 1 baseline
transcription (a duplicated line with an incorrect path prefix that was
never a real second match — see "Post-Merge Source Scan Results" for the
full accounting). Every genuinely new match is a prohibition (doc prose or
doc-comment stating what the module does *not* do), or a safety assertion
(`expect(...).not.toHaveProperty(...)`, a test title describing a
`liveBrokerWriteAllowed: false` proof, or a `not.toMatch` regex check) —
none is a callable write path, a real network call, a real secret value,
or a `liveBrokerWriteAllowed: true` runtime value.

`docs/phase8/operations-status-api.md` (P8-001), `docs/phase8/deployment-readiness-gate.md`
(P8-002), and `docs/phase8/backup-restore-drill.md` /
`docs/phase8/rollback-drill-runbook.md` (P8-003) each explicitly restate,
in their own words, the same two-concepts-must-never-be-conflated
principle this review's Phase 7 predecessor established for small-capital
readiness: a clean `readyToDeploy: true` / `resumeAllowed: true` /
`readyForSmallCapitalLive: true` reading is never, under any input,
live-trading authorization or a real deployment/broker-write action.

A Phase 2 regression check (below) found one genuine, narrow gap — none of
the three new modules' outputs had been fed through the real
`BrokerWriteCommandGuard` at the consolidated `tests/safety/safety-regression.test.ts`
harness level, the cross-module proof already applied to the Dashboard
operator surface, Claude AI output, and (as of this task's own Phase 1)
the two pre-existing evaluators these modules build on. Closed in this
phase by adding three tests; see "Phase 2 Regression Check" below.

**Go/No-Go: Phase 8 is complete as an operations-readiness package.** No
real broker write path, real deployment command, or real network call
exists anywhere in the merged code. Production and live trading remain
disabled by default in every new evaluator. Local secrets and Phase 5
receipts remain untouched. See "Whether Phase 8 Is Complete, Blocked, or
Needs Another Round" below for the full reasoning and the residual
human-only steps this review surfaces (all pre-existing from Phase 7,
none newly introduced by Phase 8).

## What Changed in P8-001 (Operations Status API)

Files: `src/application/operations/operations-status-read-model.ts` (new,
386 lines), `src/application/operations/index.ts` (new, one re-export
line), `tests/application/operations-status-read-model.test.ts` (new, 454
lines), `docs/phase8/operations-status-api.md` (new, 192 lines).
`src/index.ts` gained one new, alphabetically-placed re-export line
(`export * from "./application/operations/index.js";`), confirmed by
`git diff` to be the only change to that file from this task.

- `OperationsStatusReadModel` exposes exactly one public method,
  `buildStatus(input)`, confirmed by a dedicated test that enumerates
  `Object.getOwnPropertyNames` on the class prototype and asserts the
  result equals exactly `["buildStatus"]` (excluding `constructor`) — not
  just a manual read, an automated, reusable proof that a future edit
  cannot silently add a second public method without failing this test.
- It aggregates five already-computed Phase 6/7 inputs — `DashboardReadOnlyStatus`
  (`ReadOnlyDashboardService`), `Phase6OperatorSafetyStatus`
  (`Phase6OperatorSafetyDashboardService`), `SmallCapitalReadinessReport`
  (`evaluateSmallCapitalReadiness`), `AlertEvent[]`
  (`OperationalAlertingService`), and the scheduler's job
  definitions/runs — into the nine required areas: system health,
  paper/simulation readiness, live-readiness-blocked status, kill-switch
  state, reconciliation state, AI/API health, scheduler job health, open
  alert counts, and small-capital readiness evidence status. Confirmed by
  reading the file directly: every one of these five input types is
  imported from its real source module (not a locally-defined duck type),
  so `npm run check`'s `tsc` pass itself proves structural compatibility
  with the real merged Phase 6/7 output shapes on every run.
- `liveBrokerWriteAllowed: false` is a literal on both the top-level
  `OperationsStatusSummary` and the nested `OperationsSmallCapitalReadinessSummary`
  — confirmed by reading the return statements directly (lines 117 and
  138 of the source file use the literal type `false`, not `boolean`) —
  and by a dedicated test ("never reports liveBrokerWriteAllowed: true even
  when every other signal is clean and small-capital readiness is ready")
  that sets `readyForSmallCapitalLive: true` on the input and confirms
  both fields still read `false`.
- `systemHealth` is a deterministic worst-of ranking (`OK < WARNING < ERROR
  < BLOCKED`) across the dashboard system status, kill-switch gate,
  reconciliation live-readiness, derived API health, and scheduler safety.
  Confirmed by reading `overallSystemHealth` directly: it only ever widens
  the status via `worseHealth`, never narrows it, and a scheduler catalog
  that fails the existing `reviewPhase6SchedulerJobCatalogSafety` no-write
  policy check is deliberately treated as `BLOCKED`, not silently ignored
  or downgraded to a warning, matching `docs/11_AI_RULES.md` Rule 29 ("Do
  Not Convert Warnings Into Silent Behavior"). Small-capital readiness is
  deliberately excluded from `systemHealth` — the module's own doc comment
  and `docs/phase8/operations-status-api.md` both explain this is to avoid
  making `systemHealth` trivially and permanently degraded (since
  small-capital readiness defaults to blocked in essentially every real
  deployment per the still-`RESOLVED`-free `LCB-001` through `LCB-008`
  register), which would erase the operationally useful distinction
  between paper/simulation health and live readiness.
- Every constructed output is passed through the existing `redactObject`
  helper before being returned (the same mechanism already used by
  `ReadOnlyDashboardService`, `Phase6OperatorSafetyDashboardService`,
  `OperationalAlertingService`, and `ObservabilityMetricsService`), with
  `generatedAt` reattached after redaction — confirmed by reading the
  `buildStatus` method directly, and by two dedicated tests: "never exposes
  a command-shaped key anywhere in the built summary" (checks for
  `submitOrder`/`cancelOrder`/`replaceOrder`/`placeOrder`/`activateKillSwitch`/
  `deactivateKillSwitch`/`approveOrder`/`enableLiveTrading`, plus a
  serialized regex check) and "never contains secret-like or raw broker
  payload text in its serialized output."
- No mutation of any input: confirmed by reading every view-builder
  function (each returns a new object; arrays are always copied with
  `[...array]` or `.map`/`.filter`, never mutated in place) and by a
  dedicated test ("does not mutate any of its inputs").
- `docs/phase8/operations-status-api.md` documents the same "forbidden and
  confirmed absent" list this review independently re-verified: no command
  handlers, no state-mutating dashboard action, no real broker calls or
  network code (`fetch`/`axios`/`undici`/`process.env`), no `.env`/`tmp/phase5`
  reads, no account numbers/tokens/secrets/raw payloads, no
  `liveBrokerWriteAllowed: true`.
- Grep-confirmed directly (not just per the orchestrator's summary): zero
  `fetch`/`axios`/`undici`/`process.env` references in
  `operations-status-read-model.ts`.

## What Changed in P8-002 (Deployment Readiness Gate)

Files: `src/application/deployment/deployment-readiness-gate.ts` (new, 396
lines), `src/application/deployment/index.ts` (modified, one new
re-export line added), `tests/application/deployment-readiness-gate.test.ts`
(new, 297 lines), `docs/phase8/deployment-readiness-gate.md` (new, 238
lines). `src/application/deployment/deployment-environment-skeleton.ts`
was read-only consumed (imported, called via
`DeploymentEnvironmentSkeletonService().validate(...)`), never modified —
confirmed by `git diff 6a33cc0..9ae7056 -- src/application/deployment/deployment-environment-skeleton.ts`
returning zero lines.

- `evaluateDeploymentReadiness` is a pure function: it takes a plain data
  `DeploymentReadinessInput` and returns a plain data `DeploymentReadinessReport`.
  Confirmed by reading the file directly: no class instantiation beyond the
  read-only `DeploymentEnvironmentSkeletonService().validate(...)` call, no
  `process.env`, no `fetch`/`axios`/`undici`, no `child_process`/`exec`/`spawn`,
  no `kubectl`/`terraform`/cloud-CLI invocation of any kind anywhere in the
  file (grep-confirmed).
- `DeploymentReadinessReport.liveBrokerWriteAllowed` is a hardcoded literal
  `false` in the return statement (line 237 of the source file), never a
  computed pass-through of any input — confirmed by reading the return
  statement directly, and by a dedicated test ("always returns
  liveBrokerWriteAllowed: false, even when readyToDeploy is true") that
  constructs a fully clean, all-gates-passing input and confirms the field
  is still `false`.
- The module's own doc comment and `docs/phase8/deployment-readiness-gate.md`
  both explicitly separate two concepts that must never be conflated:
  "operational deployment readiness" (`readyToDeploy`, about code and
  documentation state only) and "live-trading authorization" (governed
  entirely by `small-capital-readiness.ts` and the still-unresolved
  `docs/phase7/live-capable-blocker-register.md` entries) — this evaluator
  exports no type or function that can grant, compute, or imply the
  second.
- Secrets are handled only as `{ name, reference }` string pairs (for
  example `"secret-ref:claude-api-key-production"`), matching the
  convention `deployment-environment-skeleton.ts` already established. A
  `looksLikeSecretValue` heuristic (matching API-key-shaped strings,
  `token=`/`password=`/`bearer ...` patterns, and long base64-like blobs)
  actively blocks readiness if any reference or secret entry looks like a
  real value rather than a pointer — confirmed by reading `checkReferenceFact`
  and `checkSecretReferences` directly, and by three dedicated tests
  covering a secret-shaped runbook reference, a secret-shaped secret
  reference, and (implicitly, by construction) that a real reference string
  passes.
- Every check fails closed on a missing or malformed input: missing
  evaluation time, missing/live-trading-enabled-by-default environment
  skeleton, missing or environment-enabled live-trading signal, missing or
  unrecognized production blocker-status reference (required only for a
  `production` target), every one of the 15 required runbook references
  from `REQUIRED_DEPLOYMENT_RUNBOOK_IDS` (verbatim match to
  `docs/09_Operation_Deployment.md` Section 18), missing rollback-plan /
  backup-restore-gate / observability-alerting references, and every one
  of the 6 required secret references from `REQUIRED_DEPLOYMENT_SECRET_NAMES`
  — confirmed directly by reading `evaluateDeploymentReadiness` and its
  eight `check*` helper functions, and by 24 tests in
  `tests/application/deployment-readiness-gate.test.ts` covering each
  fail-closed path individually plus determinism (sorted reason codes) and
  purity.
- `REQUIRED_DEPLOYMENT_RUNBOOK_IDS` and `REQUIRED_DEPLOYMENT_SECRET_NAMES`
  are frozen module constants (`Object.freeze`), not caller-supplied
  policy — confirmed by reading the source directly — so a caller cannot
  weaken the gate by supplying a shorter required list.
- Grep-confirmed directly across the entire file: zero `process.env`
  reads, zero `fetch`/`axios`/`undici` references, zero
  `child_process`/`exec`/`spawn` references, zero `kubectl`/`terraform`/
  `aws `/`gcloud`/`docker` references.

## What Changed in P8-003 (Backup, Restore, and Rollback Drills)

Files: `src/application/backup-restore/backup-restore-drill.ts` (new, 625
lines), `src/application/backup-restore/index.ts` (modified, one new
re-export line added), `tests/application/backup-restore-drill.test.ts`
(new, 360 lines), `docs/phase8/backup-restore-drill.md` (new, 260 lines),
`docs/phase8/rollback-drill-runbook.md` (new, 186 lines).
`src/application/backup-restore/restore-safety-gate.ts` was read-only
consumed (referenced conceptually as a sibling evaluator, per the module's
own doc comment "alongside (not a replacement for) `RestoreSafetyGate`"),
never modified — confirmed by `git diff 6a33cc0..26d3e45 -- src/application/backup-restore/restore-safety-gate.ts`
returning zero lines.

- `evaluateBackupRestoreDrill` (plus a thin `BackupRestoreDrill` class
  wrapper mirroring `RestoreSafetyGate`'s instance-method call shape) is
  structurally incapable of database access: grep-confirmed zero database
  client, ORM, or SQL-string imports or references anywhere in the file —
  this is enforced by the file containing no such import at all, not
  merely by convention or a runtime check.
- `requestedResumeMode` is restricted to `"PAPER" | "SIMULATION"` both at
  the type level (`BackupRestoreDrillOperationMode`, derived from the
  frozen `BACKUP_RESTORE_DRILL_ALLOWED_RESUME_MODES` constant, which has
  deliberately no `"PRODUCTION"`/`"LIVE"` member) and at runtime (the
  evaluator checks `.includes(input.requestedResumeMode)` against that same
  frozen array and blocks with a `resume_mode_not_allowed_*` reason code
  otherwise) — confirmed by reading the source directly, and by a
  dedicated test ("never accepts a live/production resume mode, even if
  forced past the type system") that casts `"PRODUCTION"` past the type
  system and confirms the evaluator still blocks it.
- `reconciledAgainstBrokerSnapshot: boolean` is a required attestation
  field on `BackupRestoreDrillReconciliationSignal`, structurally distinct
  from the real `ReconciliationWorkflowResult` type (this module
  deliberately does not import that type directly, to stay
  import-cycle-free and to make explicit that the drill only *consumes* a
  result, matching the same duck-typed-signal pattern
  `SmallCapitalReconciliationSignal` already established in Phase 7). If
  this attestation is `false` or the whole reconciliation signal is
  missing, the drill blocks with `reconciliation_not_confirmed_against_broker_snapshot`
  regardless of how clean every other check looks — confirmed by reading
  `checkPostRestoreReconciliation` directly (its own comment identifies
  this as "the single most important reason code in this module") and by a
  dedicated test ("blocks resume when reconciliation is not confirmed
  against a broker snapshot, even if otherwise clean").
- `report.liveBrokerWriteAllowed` and `report.correctiveTradingAllowed` are
  both hardcoded `false` literals in the return statement (lines 328-329
  of the source file), never computed — confirmed by reading the return
  statement directly, and by a dedicated test ("does not expose any
  corrective trading, broker order, or live-enable commands") that also
  checks for absence of `submitOrder`/`correctiveTrade`/`disableKillSwitch`/
  `enableLiveTrading` keys on the report.
- The drill covers all ten required areas from the task doc — backup
  manifest verification, schema/config version verification, audit
  continuity, secrets handled separately (a reference/flag only, never
  actual secret content — confirmed by a dedicated test "never reads actual
  secret content — only a reference/flag is checked"), post-restore
  reconciliation, data quality, kill-switch availability, operator
  approval before resume (restricted to `OWNER`/`OPERATOR` roles via the
  frozen `BACKUP_RESTORE_DRILL_APPROVAL_ALLOWED_ROLES` constant), and a
  7-step rollback rehearsal (`REQUIRED_ROLLBACK_REHEARSAL_STEPS`, a frozen
  constant mirroring the same seven-step procedure
  `docs/phase7/small-capital-readiness-gates.md` Section 11 already
  established) — with an evidence reference required for every individual
  check, validated by `collectEvidence` for a non-blank description,
  non-blank and length-bounded locator, and a valid `capturedAt` timestamp.
  Confirmed directly by reading all nine `check*` helper functions and by
  25 tests in `tests/application/backup-restore-drill.test.ts` covering
  each fail-closed path, evidence validation, and the class-wrapper
  parity.
- `docs/phase8/rollback-drill-runbook.md` documents the same seven-step
  rehearsal procedure as an executable runbook, separate from the
  evaluator's own reason-code output, for a human operator to follow under
  stress.
- Grep-confirmed directly across the entire file: zero database/ORM/SQL
  imports, zero `fetch`/`axios`/`undici`/`process.env` references, zero
  filesystem access.

## Baseline Source Scan Results

This section is real — produced in Phase 1, against local `main` tip
`e3347f2` ("Add Phase 8 operations readiness task plan"), before any of
P8-001, P8-002, or P8-003 exist. This is the "before" picture Phase 2 must
diff the post-merge scan against; any genuinely new match outside of
docs/tests prohibitions, redaction tests, or safety assertions found in the
post-merge scan is a real finding to flag in Phase 2.

Commands run (from
`/Users/mac/Documents/Codex/aios-phase8-worktrees/eng4`, branch
`phase8/p8-004-integration-review`, worktree base commit `e3347f2`, before
the Phase 1 regression-test commit below was made):

### Scan 1 — order/adapter/network patterns

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase8
```

Full output (93 matches):

```text
tests/adapters/toss-write-contract.test.ts:14:// never sets `liveBrokerWriteAllowed: true`. It only inspects design-only
tests/adapters/toss-write-contract.test.ts:73:    const writeKeys: Array<keyof TossFutureWriteAdapter> = ["submitOrder", "cancelOrder", "replaceOrder"];
tests/application/read-only-dashboard.test.ts:98:    expect(status).not.toHaveProperty("submitOrder");
tests/application/read-only-dashboard.test.ts:307:    const forbidden = ["submitOrder", "cancelOrder", "replaceOrder", "placeOrder", "activateKillSwitch", "deactivateKillSwitch", "approveOrder", "enableLiveTrading"];
tests/adapters/claude-adapter.test.ts:49:        submitOrder: true
tests/adapters/claude-adapter.test.ts:231:            submitOrder: { assetId: "asset-1", side: "BUY" }
tests/adapters/claude-adapter.test.ts:237:      expect(result.errors).toContain("forbidden_command_key_submitOrder");
tests/adapters/claude-adapter.test.ts:240:    it("rejects a forbidden replaceOrder key at any nesting depth", () => {
tests/adapters/claude-adapter.test.ts:243:        analysisMeta: { followUp: { replaceOrder: { orderId: "order-1" } } }
tests/adapters/claude-adapter.test.ts:247:      expect(result.errors).toContain("forbidden_command_key_replaceOrder");
tests/adapters/claude-adapter.test.ts:254:        relatedActions: [{ cancelOrder: { orderId: "order-1" } }]
tests/adapters/claude-adapter.test.ts:258:      expect(result.errors).toContain("forbidden_command_key_cancelOrder");
tests/adapters/claude-adapter.test.ts:285:        submitOrder: true
tests/adapters/claude-adapter.test.ts:353:      expect(result.data).not.toHaveProperty("submitOrder");
tests/adapters/contracts.test.ts:53:    const writeKeys: Array<keyof TossWriteAdapter> = ["submitOrder", "cancelOrder"];
tests/safety/safety-regression.test.ts:596:          followUp: { recommendedNextStep: { submitOrder: { assetId: "asset-1", side: "BUY" } } }
tests/safety/safety-regression.test.ts:638:        cancelOrder: { orderId: "order-1" }
tests/safety/safety-regression.test.ts:721:        expect(encoded).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
tests/safety/safety-regression.test.ts:767:    // a future TossSecuritiesAdapter write contract on top of the existing
tests/safety/safety-regression.test.ts:769:    // whose `submitOrder`/`cancelOrder` parameters are typed `command:
tests/safety/safety-regression.test.ts:784:      submitOrder(_command: never): Promise<never> {
tests/safety/safety-regression.test.ts:786:          "TossWriteAdapter.submitOrder must never be called; Phase 7 keeps this contract uncallable by design."
tests/safety/safety-regression.test.ts:789:      cancelOrder(_command: never): Promise<never> {
tests/safety/safety-regression.test.ts:791:          "TossWriteAdapter.cancelOrder must never be called; Phase 7 keeps this contract uncallable by design."
tests/safety/safety-regression.test.ts:796:    it("rejects an order-shaped argument to submitOrder/cancelOrder at compile time (command: never)", () => {
tests/safety/safety-regression.test.ts:805:      // @ts-expect-error - TossWriteAdapter.submitOrder's parameter is typed
tests/safety/safety-regression.test.ts:814:      expect(() => adapter.submitOrder(orderShapedCommand)).toThrow(/must never be called/);
tests/safety/safety-regression.test.ts:816:      // @ts-expect-error - same proof for cancelOrder.
tests/safety/safety-regression.test.ts:817:      expect(() => adapter.cancelOrder(orderShapedCommand)).toThrow(/must never be called/);
tests/safety/safety-regression.test.ts:828:      expect(() => adapter.submitOrder(undefined as never)).toThrow(
tests/safety/safety-regression.test.ts:831:      expect(() => adapter.cancelOrder(undefined as never)).toThrow(
tests/adapters/toss-read-only-http-client.test.ts:72:    expect(publicMethodNames).not.toContain("submitOrder");
tests/adapters/toss-read-only-http-client.test.ts:73:    expect(publicMethodNames).not.toContain("cancelOrder");
tests/adapters/toss-read-only-http-client.test.ts:75:    expect((client as unknown as Record<string, unknown>)["submitOrder"]).toBeUndefined();
tests/adapters/toss-read-only-dry-run-client.test.ts:53:      body: { submitOrder: { symbol: "005930" } }
tests/application/toss-read-only-evidence-intake.test.ts:210:      verificationResult({ liveBrokerWriteAllowed: true as unknown as false })
tests/application/toss-read-only-evidence-intake.test.ts:352:      receiptRecord({ liveBrokerWriteAllowed: true as unknown as false })
tests/application/access-control-service.test.ts:70:    expect(decision).not.toHaveProperty("submitOrder");
src/adapters/toss-write-contract.ts:4: * This file specifies the future `TossSecuritiesAdapter` write contract as
src/adapters/toss-write-contract.ts:11: * (`submitOrder(command: never): Promise<never>`), extended here with a
src/adapters/toss-write-contract.ts:16: * - no `fetch`, HTTP client, axios, undici, or any network code;
src/adapters/toss-write-contract.ts:19: * - no `liveBrokerWriteAllowed: true` anywhere;
src/adapters/toss-write-contract.ts:48: * permanently out of scope for `TossSecuritiesAdapter`. This type exists so
src/adapters/toss-write-contract.ts:194:  submitOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:195:  cancelOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:196:  replaceOrder(command: never): Promise<never>;
tests/application/ai-health-check-service.test.ts:35:      submitOrder: true
tests/application/ai-health-check-service.test.ts:43:        "forbidden_command_key_submitOrder"
src/adapters/naver/naver-news-adapter.ts:44:      const response = await this.options.fetch(url, {
tests/scripts/phase5-toss-network-safety-static.test.ts:27:  /\baxios\b/,
tests/scripts/phase5-toss-network-safety-static.test.ts:37:  /\bsubmitOrder\s*\(/,
tests/scripts/phase5-toss-network-safety-static.test.ts:38:  /\bcancelOrder\s*\(/,
tests/scripts/phase5-toss-network-safety-static.test.ts:39:  /\breplaceOrder\s*\(/
tests/application/restore-safety-gate.test.ts:71:    expect(result).not.toHaveProperty("submitOrder");
tests/application/shadow-portfolio-engine.test.ts:144:    expect(result).not.toHaveProperty("submitOrder");
tests/application/paper-trading-engine.test.ts:155:    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/application/paper-trading-engine.test.ts:292:    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
src/application/broker-write-guard/broker-write-command-guard.ts:195:    "submitOrder",
src/application/broker-write-guard/broker-write-command-guard.ts:196:    "cancelOrder",
src/application/broker-write-guard/broker-write-command-guard.ts:197:    "replaceOrder",
tests/application/kill-switch-control-service.test.ts:29:    expect(result).not.toHaveProperty("submitOrder");
src/adapters/claude/analysis-schema.ts:21:  "submitOrder",
src/adapters/claude/analysis-schema.ts:22:  "cancelOrder",
src/adapters/claude/analysis-schema.ts:23:  "replaceOrder",
tests/application/strategy-promotion-dashboard-workflow.test.ts:82:    expect(result).not.toHaveProperty("submitOrder");
tests/application/ai-analysis-persistence.test.ts:71:      brokerCommand: { submitOrder: true }
tests/application/ai-analysis-persistence.test.ts:136:        submitOrder: true
tests/application/ai-analysis-persistence.test.ts:152:      followUpSuggestion: { action: { replaceOrder: { orderId: "order-1" } } }
tests/scripts/phase5-toss-read-only-verify-script.test.ts:99:  it.each(["createOrder", "cancelOrder", "modifyOrder", "orders/cancel", "withdraw", "transfer"])(
tests/application/dashboard-sensitive-control-gate.test.ts:81:    expect(decision).not.toHaveProperty("submitOrder");
tests/application/outbox-worker-service.test.ts:127:    expect(result).not.toHaveProperty("submitOrder");
src/adapters/contracts/toss.ts:47:  submitOrder(command: never): Promise<never>;
src/adapters/contracts/toss.ts:48:  cancelOrder(command: never): Promise<never>;
tests/application/reconciliation-service.test.ts:32:    expect(report).not.toHaveProperty("submitOrder");
tests/application/reconciliation-service.test.ts:167:    expect(adapter).not.toHaveProperty("submitOrder");
tests/application/toss-read-only-evidence-recorder.test.ts:91:        submitOrder: {
tests/application/order-cancel-simulation-service.test.ts:84:    expect(result).not.toHaveProperty("cancelOrder");
src/adapters/toss/toss-read-only-http-client.ts:542:  return fetch(url, init);
tests/application/observability-metrics.test.ts:100:    expect(event).not.toHaveProperty("submitOrder");
tests/application/observability-metrics.test.ts:101:    expect(event).not.toHaveProperty("cancelOrder");
src/adapters/toss/toss-read-only-dry-run-client.ts:40:  "submitOrder",
src/adapters/toss/toss-read-only-dry-run-client.ts:41:  "cancelOrder",
tests/application/order-execution-simulation-service.test.ts:36:    expect(result.ok && result.command).not.toHaveProperty("submitOrder");
tests/application/order-execution-simulation-service.test.ts:81:      for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/application/operational-alerting-service.test.ts:71:    expect(alert).not.toHaveProperty("submitOrder");
tests/application/operational-alerting-service.test.ts:72:    expect(alert).not.toHaveProperty("cancelOrder");
tests/application/reconciliation-workflow-service.test.ts:31:    expect(result).not.toHaveProperty("submitOrder");
tests/application/reconciliation-workflow-service.test.ts:202:      expect(serialized).not.toMatch(/submitOrder|cancelOrder|correctionCommand|brokerWritePayload|placeOrder/i);
src/application/toss/read-only-evidence-recorder.ts:48:const liveWritePattern = /(submitOrder|cancelOrder|placeOrder|modifyOrder|withdraw|transfer)/i;
src/application/ai-health-check/ai-health-check-service.ts:86:  "submitOrder",
src/application/ai-health-check/ai-health-check-service.ts:87:  "cancelOrder",
tests/application/broker-write-command-guard.test.ts:53:    expect(result).not.toHaveProperty("submitOrder");
tests/application/broker-write-command-guard.test.ts:135:          submitOrder: true
```

Note: `docs/phase8` only contains `README.md` at this baseline, and it
produced zero matches for Scan 1 (confirmed separately; the `rg` output
above contains no `docs/phase8/` lines).

### Scan 2 — secret/env patterns

```bash
rg -n "\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase8
```

Full output:

```text
docs/phase8/README.md:43:- reading or printing `.env`, `tmp/phase5`, local receipts, secrets, or raw
src/adapters/toss-write-contract.ts:18: * - no `process.env` read;
tests/application/read-only-dashboard.test.ts:300:    expect(serialized).not.toMatch(/accessToken|access_token/i);
tests/application/read-only-dashboard.test.ts:301:    expect(serialized).not.toMatch(/clientSecret|client_secret/i);
tests/application/claude-worktree-orchestration-guide.test.ts:120:          ownedPaths: [".env", "deployment/production.env"]
tests/application/claude-worktree-orchestration-guide.test.ts:126:    expect(result.reasonCodes).toContain("sensitive_path_owned_session-a_.env");
tests/application/claude-worktree-orchestration-guide.test.ts:128:      "sensitive_path_owned_session-a_deployment/production.env"
tests/application/toss-read-only-evidence-intake.test.ts:39:          sanitizedSummary: "This summary accidentally mentions client_secret and must be rejected."
tests/application/toss-read-only-evidence-intake.test.ts:228:      verificationResult({ sanitizedEvidencePath: "tmp/phase5/access_token-dump.json" })
tests/application/toss-read-only-evidence-intake.test.ts:234:      verificationResult({ sanitizedEvidencePath: "tmp/phase5/account-1234567890.json" })
tests/application/toss-read-only-evidence-intake.test.ts:244:      verificationResult({ sanitizedEvidencePath: "tmp/phase5/../../etc/passwd" })
tests/application/toss-read-only-evidence-intake.test.ts:263:    expect(draft.sourceReference).toBe("tmp/phase5/account-snapshot-result.json");
tests/application/toss-read-only-evidence-intake.test.ts:289:    sanitizedEvidencePath: "tmp/phase5/account-snapshot-result.json",
tests/application/toss-read-only-evidence-intake.test.ts:311:        "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:323:        "tmp/phase5/read-only-verify-market-data-read-2026-07-28T00-10-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:396:      receiptRecord({ safetyType: "leaked client_secret abc123 during capture" })
tests/application/toss-read-only-evidence-intake.test.ts:420:  it("rejects a source reference with path traversal, a remote URL, or a .env reference", () => {
tests/application/toss-read-only-evidence-intake.test.ts:422:      receiptRecord({}, "tmp/phase5/../../etc/passwd")
tests/application/toss-read-only-evidence-intake.test.ts:433:    const envFile = new TossReadOnlyEvidenceReceiptValidator().review(receiptRecord({}, "tmp/phase5/.env.copy.json"));
tests/application/toss-read-only-evidence-intake.test.ts:440:      receiptRecord({}, "tmp/phase5/access_token-dump.json")
tests/application/toss-read-only-evidence-intake.test.ts:446:      receiptRecord({}, "tmp/phase5/account-1234567890.json")
tests/application/toss-read-only-evidence-intake.test.ts:459:          "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:463:          "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:496:      "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:500:      "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:512:    const duplicateReference = "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json";
tests/application/toss-read-only-evidence-intake.test.ts:528:        "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:532:        "tmp/phase5/read-only-verify-position-query-read-2026-07-28T00-05-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:540:        "tmp/phase5/read-only-verify-market-data-read-2026-07-28T00-10-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:568:  sourceReference = "tmp/phase5/read-only-verify-account-snapshot-read-2026-07-28T00-00-00-000Z.json"
tests/application/toss-read-only-evidence-intake.test.ts:598:        operatorNote: "Approved after confirming client_secret abc123 still works."
tests/application/toss-read-only-evidence-intake.test.ts:690:      operatorNote: "Contains an access_token by mistake."
tests/application/scheduler-job-runner.test.ts:64:        "Claude token=secret-token and key sk-test-secret failed, bearer abc123token, account_number 12345678901, 계좌번호 98765432109"
src/adapters/toss/toss-read-only-http-client.ts:206:      client_secret: this.#clientSecret
src/adapters/toss/toss-read-only-http-client.ts:237:    const accessToken = readStringField(payload, "access_token");
tests/application/toss-read-only-verification-planner.test.ts:42:    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/application/incident-runbook-review.test.ts:63:      investigation: ["check logs for client_secret=abc123 and account_number 12345678901"]
tests/application/toss-read-only-evidence-recorder.test.ts:160:        operatorNote: "Approved using client_secret abc123 for this call."
tests/application/toss-read-only-credential-readiness.test.ts:50:    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
src/config/environment.ts:42:  env: NodeJS.ProcessEnv = process.env,
tests/scripts/validate-toss-evidence-manifest-script.test.ts:74:      PATH: process.env.PATH
tests/scripts/phase5-toss-completion-script.test.ts:72:      env: { PATH: process.env.PATH, ...extraEnv },
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:37:    const env = readFileSync(join(dir, ".env"), "utf8");
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:60:    const env = readFileSync(join(dir, ".env"), "utf8");
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:74:      join(dir, ".env"),
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:92:        env: { PATH: process.env.PATH },
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:101:    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:110:    join(dir, ".env"),
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:138:          response.end(JSON.stringify({ access_token: "mock-access-token", token_type: "Bearer" }));
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:173:      env: { PATH: process.env.PATH },
src/application/broker-write-guard/broker-write-command-guard.ts:124:  if (!input.environment) {
src/application/broker-write-guard/broker-write-command-guard.ts:127:    if (!input.environment.liveBrokerWritesEnabled) reasons.push("environment_live_broker_writes_disabled");
src/application/broker-write-guard/broker-write-command-guard.ts:128:    if (!input.environment.allowedEnvironments.includes(input.environment.environment)) {
src/application/broker-write-guard/broker-write-command-guard.ts:129:      reasons.push(`environment_${input.environment.environment}_not_allowed_for_broker_writes`);
tests/scripts/validate-toss-evidence-intake-script.test.ts:33:      sanitizedSummary: "This should fail because it includes client_secret=very-sensitive-value."
tests/scripts/plan-toss-read-only-verification-script.test.ts:57:    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/plan-toss-read-only-verification-script.test.ts:87:      PATH: process.env.PATH,
tests/scripts/plan-toss-read-only-verification-script.test.ts:88:      ...env
src/application/scheduler/scheduler-job-runner.ts:83:   * runner never reads `.env`, `tmp/phase5/`, or any other file itself --
src/application/scheduler/scheduler-job-runner.ts:129:   * `.env` or `tmp/phase5/*` inside this codebase -- only pass booleans a
src/application/scheduler/scheduler-job-runner.ts:398:    .replace(/account[_-]?number[^\s]*/gi, "account_number=[REDACTED]")
tests/scripts/validate-toss-endpoints-script.test.ts:216:      PATH: process.env.PATH
src/application/development/claude-worktree-orchestration-guide.ts:181:  if (path === ".env" || path.startsWith(".env.")) return true;
src/application/development/claude-worktree-orchestration-guide.ts:184:  if (path.endsWith(".env") && !path.endsWith(".env.example")) return true;
tests/scripts/phase5-toss-doctor-script.test.ts:52:    expect(report.blockingReasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/phase5-toss-doctor-script.test.ts:91:            sanitizedSummary: `Reviewed evidence, access_token=${secretValue} was visible in the screenshot.`
tests/scripts/phase5-toss-doctor-script.test.ts:190:      PATH: process.env.PATH,
tests/scripts/phase5-toss-doctor-script.test.ts:191:      ...env
tests/scripts/check-toss-readiness-script.test.ts:79:      PATH: process.env.PATH,
tests/scripts/check-toss-readiness-script.test.ts:80:      ...env
tests/scripts/phase5-toss-read-only-verify-script.test.ts:15: * modify this repository's real .env (there is none in this worktree; every
tests/scripts/phase5-toss-read-only-verify-script.test.ts:414:    PATH: process.env.PATH,
tests/scripts/phase5-toss-read-only-verify-script.test.ts:599:          response.end(JSON.stringify({ access_token: "mock-access-token", token_type: "Bearer", expires_in: 3600 }));
src/application/toss/read-only-evidence-intake.ts:234:        environment: options.environment,
src/application/toss/read-only-evidence-intake.ts:495:      if (path.includes(".env")) {
src/application/toss/read-only-evidence-intake.ts:577: * `tmp/phase5/`, git-ignored. This is distinct from
src/application/toss/read-only-evidence-intake.ts:725:      if (reference.includes(".env")) {
tests/scripts/phase5-toss-local-setup-script.test.ts:13:      env: { PATH: process.env.PATH },
tests/scripts/phase5-toss-local-setup-script.test.ts:20:    expect(report.envWritten).toBe(false);
tests/scripts/phase5-toss-local-setup-script.test.ts:21:    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/toss-read-only-endpoints.local.json"));
tests/scripts/phase5-toss-local-setup-script.test.ts:22:    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/evidence-intake.local.json"));
tests/scripts/phase5-toss-local-setup-script.test.ts:23:    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/evidence-manifest.local.json"));
tests/scripts/phase5-toss-local-setup-script.test.ts:24:    expect(report.filesPrepared).toContain(join(repoRoot, "tmp/phase5/read-only-call-approval.local.json"));
tests/scripts/phase5-toss-local-setup-script.test.ts:35:      env: { PATH: process.env.PATH },
tests/scripts/phase5-toss-local-setup-script.test.ts:50:    expect(report.envWritten).toBe(false);
tests/scripts/phase5-toss-local-setup-script.test.ts:61:      env: { PATH: process.env.PATH },
tests/scripts/phase5-toss-local-setup-script.test.ts:74:    expect(report.envWritten).toBe(false);
tests/scripts/phase5-toss-local-setup-script.test.ts:76:    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/report-toss-open-questions-script.test.ts:59:      PATH: process.env.PATH
src/application/toss-read-only-verification-planner.test.ts:42:    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/phase5-toss-preflight-script.test.ts:19:        env: { PATH: process.env.PATH, ...missingCredentialEnv() }
tests/scripts/phase5-toss-preflight-script.test.ts:49:        env: { PATH: process.env.PATH, PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true" }
tests/scripts/phase5-toss-preflight-script.test.ts:114:        PATH: process.env.PATH,
tests/adapters/toss-read-only-http-client.test.ts:8:// contacts the real Toss Securities API or the real internet. No `.env` file
tests/adapters/toss-read-only-http-client.test.ts:81:      tokenBody: { access_token: "mock-access-token-should-never-leak", token_type: "Bearer", expires_in: 3600 },
tests/adapters/toss-read-only-http-client.test.ts:109:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:140:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:167:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:190:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:224:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:246:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:268:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:315:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:335:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
tests/adapters/toss-read-only-http-client.test.ts:398:      tokenBody: { access_token: "mock-access-token", token_type: "Bearer" },
src/application/dashboard/read-only-dashboard.ts:143: * `.env` or `tmp/phase5` receipts.
tests/scripts/phase5-toss-call-gate-script.test.ts:90:        PATH: process.env.PATH,
```

### Baseline Scan Interpretation

Every match falls into one of the accepted categories (prohibition,
`never`-typed placeholder, redaction/rejection test, safety assertion, or a
harmless `process.env.PATH` pass-through used only to let a spawned child
process find binaries on `PATH` when a script test shells out — never a
secret-value read). No real callable write path, real network call to a
Toss order endpoint, or real secret read exists at this baseline:

- Scan 1 matches are the same categories the Phase 7 review already
  catalogued in detail (uncallable `command: never` contracts in
  `src/adapters/contracts/toss.ts` and `src/adapters/toss-write-contract.ts`,
  forbidden-key deny-lists in `BrokerWriteCommandGuard`,
  `analysis-schema.ts`, and `ai-health-check-service.ts`, the dry-run
  client's own forbidden-operation list, the read-only Toss HTTP client's
  injected `fetch` transport restricted to 4 read-only operations, the
  unrelated Naver news adapter's injected `fetch`, and a large set of
  `tests/**` assertions of the form
  `expect(x).not.toHaveProperty("submitOrder")` or
  `forbidden_command_key_*` proving absence, not presence, of a
  write-shaped capability) — unchanged from the Phase 7 post-merge state,
  as expected, since no Phase 8 branch has touched any of these files yet.
- `docs/phase8` contributes zero Scan-1 matches at this baseline (the
  directory currently contains only `README.md`, and `docs/phase7/README.md`'s
  two prohibition-statement matches from the Phase 7 baseline are outside
  this scan's `docs/phase8` scope, so they correctly do not appear here).
- Scan 2 matches are: one prohibition line in `docs/phase8/README.md`
  itself ("reading or printing `.env`, `tmp/phase5`, local receipts,
  secrets, or raw ..." — a forbidden-actions statement, not a secret);
  one doc-comment prohibition in `src/adapters/toss-write-contract.ts`
  ("no `process.env` read"); a large set of `tests/**` fixtures and
  assertions that intentionally construct fake/mock secret-shaped strings
  (`client_secret abc123`, `access_token=...`, `account_number
  12345678901`, mock `.env` file paths inside a test's own temp directory)
  specifically to prove a validator/redactor rejects or masks them, never
  to use a real value; `PATH: process.env.PATH` pass-throughs in
  script-spawning tests (needed only so the spawned child process can find
  system binaries, never a credential); and a handful of `src/**`
  production lines that read the *field name* `access_token`/`client_secret`
  out of a Toss token-exchange response body inside the pre-existing,
  Phase-5, read-only-only `toss-read-only-http-client.ts` (confirmed
  unchanged from the Phase 7 baseline: this client exposes only
  `AUTHENTICATION_READ`, `ACCOUNT_SNAPSHOT_READ`, `POSITION_QUERY_READ`,
  and `MARKET_DATA_READ`, no order-write operation, per the Phase 7
  review's own baseline interpretation of the same file).
- `.env` and `tmp/phase5/` do not exist in this worktree (confirmed by
  `ls -la .env` and `ls -la tmp/phase5` returning "No such file or
  directory" — existence check only; neither was read, printed, or
  inspected beyond that check, per this task's universal safety rules).

**No match in either baseline scan represents a callable broker-write
path, a real network call to a Toss order endpoint, a real secret value,
or a `liveBrokerWriteAllowed: true` runtime value.** This baseline is the
reference point Phase 2's post-merge scans will be diffed against; any
genuinely new match outside the accepted categories above is a real
finding to flag in Phase 2.

## Post-Merge Source Scan Results

Commands run (from
`/Users/mac/Documents/Codex/aios-phase8-worktrees/eng4`, branch
`phase8/p8-004-integration-review`, after `git merge main`, merged tip
`26d3e45`):

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase8
rg -n "\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase8
```

Scan 1 returned 102 total matches (versus 93 in the Phase 1 baseline).
Scan 2 returned 118 total matches (versus 107 lines in the Phase 1
baseline document, one of which was a transcription duplicate — see
below — so 106 genuinely distinct baseline matches). Diffing (sorted,
line-content comparison) against the Phase 1 baseline yields:

- **Scan 1: 9 matches genuinely new** from the P8-001/P8-002/P8-003 merge.
  0 matches removed.
- **Scan 2: 12 matches genuinely new** from the P8-001/P8-002/P8-003
  merge. 1 line no longer appears verbatim, but this is **not a real
  removal** — see "Baseline Transcription Correction" below.

### The 9 Matches Genuinely New From Scan 1

```text
docs/phase8/operations-status-api.md:173:- No real broker calls or network code. No `fetch`, `axios`, `undici`, or
docs/phase8/operations-status-api.md:179:- No `liveBrokerWriteAllowed: true` anywhere. It is a literal on every
tests/application/backup-restore-drill.test.ts:249:    expect(report).not.toHaveProperty("submitOrder");
tests/application/operations-status-read-model.test.ts:160:  it("never reports liveBrokerWriteAllowed: true even when every other signal is clean and small-capital readiness is ready", () => {
tests/application/operations-status-read-model.test.ts:419:    expect(summary).not.toHaveProperty("submitOrder");
tests/application/operations-status-read-model.test.ts:420:    expect(summary).not.toHaveProperty("cancelOrder");
tests/application/operations-status-read-model.test.ts:421:    expect(summary).not.toHaveProperty("replaceOrder");
tests/application/operations-status-read-model.test.ts:422:    expect(summary).not.toHaveProperty("placeOrder");
tests/application/operations-status-read-model.test.ts:429:    expect(serialized).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
```

**Interpretation — every match accepted:**

- `docs/phase8/operations-status-api.md:173,179` — prohibition-statement
  prose under the doc's "Forbidden (and Confirmed Absent)" heading. Read
  in full context directly (`sed -n '172,180p'`): "No real broker calls or
  network code. No `fetch`, `axios`, `undici`, or `process.env` reference
  exists anywhere in this module... No `liveBrokerWriteAllowed: true`
  anywhere. It is a literal on every output type that carries it." A
  prohibition, not code.
- `tests/application/backup-restore-drill.test.ts:249` — `expect(report).not.toHaveProperty("submitOrder")`
  inside the "does not expose any corrective trading, broker order, or
  live-enable commands" test. A safety assertion.
- `tests/application/operations-status-read-model.test.ts:160,419-422,429`
  — a test title describing a `liveBrokerWriteAllowed: false` proof (not a
  runtime `true` value — the colon-form scan pattern
  `liveBrokerWriteAllowed: true` did not match anywhere in this file,
  confirmed separately), four `not.toHaveProperty` assertions in "never
  exposes a command-shaped key anywhere in the built summary", and one
  `not.toMatch` regex assertion on the serialized summary. All five are
  safety assertions proving absence, not presence, of a write-shaped
  capability.

### The 12 Matches Genuinely New From Scan 2

```text
docs/phase8/deployment-readiness-gate.md:175:evaluator never reads `process.env`, never accepts an actual secret value,
docs/phase8/deployment-readiness-gate.md:208:- It does not read `process.env`, `.env`, or any real secret value.
docs/phase8/deployment-readiness-gate.md:209:- It does not read or inspect `tmp/phase5/` receipts.
docs/phase8/deployment-readiness-gate.md:56:function**: no network code, no filesystem access, no `process.env` reads,
docs/phase8/operations-status-api.md:174:  `process.env` reference exists anywhere in this module.
docs/phase8/operations-status-api.md:175:- No `.env` or `tmp/phase5` reads.
docs/phase8/operations-status-api.md:33:- no reads of `.env` or `tmp/phase5/*`
src/application/deployment/deployment-readiness-gate.ts:119: * `src/config/environment.ts`. This gate never reads `process.env` and
src/application/deployment/deployment-readiness-gate.ts:13: * network code, no filesystem access, no `process.env` reads, no
src/application/deployment/deployment-readiness-gate.ts:217:  const skeletons = input.environmentSkeletons ?? deploymentEnvironmentSkeletons;
src/application/deployment/deployment-readiness-gate.ts:387: * never reads `process.env`, never reads a real secret, and only pattern
src/application/operations/operations-status-read-model.ts:22: * It has no network code, no filesystem access, no `.env` or `tmp/phase5`
```

**Interpretation — every match accepted, one flagged and explained rather
than waved through:**

- `docs/phase8/deployment-readiness-gate.md:56,175,208,209` and
  `docs/phase8/operations-status-api.md:33,174,175` — all seven are
  prohibition-statement prose (confirmed by reading each in context: "no
  network code, no filesystem access, no `process.env` reads",
  "It does not read `process.env`, `.env`, or any real secret value",
  "It does not read or inspect `tmp/phase5/` receipts", "no reads of
  `.env` or `tmp/phase5/*`"). None is a real secret read.
- `src/application/deployment/deployment-readiness-gate.ts:13,119,387` and
  `src/application/operations/operations-status-read-model.ts:22` — all
  four are doc-comment prose stating the same prohibitions, read in full
  context above ("What Changed in P8-002", "What Changed in P8-001").
- **`src/application/deployment/deployment-readiness-gate.ts:217` is a
  regex false positive, not a real `.env` reference — flagged explicitly
  rather than accepted by pattern-category alone.** The actual line is
  `const skeletons = input.environmentSkeletons ?? deploymentEnvironmentSkeletons;`
  — a plain property access. Scan 2's `\.env` pattern matches *any*
  literal substring "`.env`" anywhere in a line, and `input.environmentSkeletons`
  contains that exact four-character substring as the start of
  `.environmentSkeletons` (`input` + `.` + `env` + `ironmentSkeletons`).
  Confirmed by reading the file directly (`sed -n '217p'`): this line
  reads a caller-supplied `DeploymentEnvironmentSkeleton[]` array
  parameter, or falls back to the existing `deploymentEnvironmentSkeletons`
  constant already reviewed and accepted in the Phase 1 baseline — it
  performs no filesystem access, no `.env` file read, and no
  `process.env` read of any kind. This is the same category of discipline
  the Phase 7 review modeled ("the scan is a starting point, not a
  substitute for reading the merged files") applied to a different kind of
  false positive (there, an assignment-syntax match the scan pattern
  missed; here, a substring match the scan pattern over-caught).

### Baseline Transcription Correction

One line from the Phase 1 baseline scan 2 output no longer appears
verbatim in the post-merge diff:
`src/application/toss-read-only-verification-planner.test.ts:42`. This is
**not a real removal** — it is a correction to a transcription error in my
own Phase 1 scaffold. The real file is
`tests/application/toss-read-only-verification-planner.test.ts` (confirmed:
`find . -name "toss-read-only-verification-planner.test.ts"` returns
exactly one file, under `tests/application/`, both at the Phase 1 baseline
and now). My Phase 1 document accidentally pasted this line twice — once
with the correct `tests/application/` prefix and once with an incorrect
`src/application/` prefix that was never real `rg` output. The correctly-prefixed
line (`tests/application/toss-read-only-verification-planner.test.ts:42`)
is present, unchanged, in both the Phase 1 baseline and the post-merge
scan. No content was actually removed from the repository between Phase 1
and Phase 2; this is a documentation correction only, noted here for
accuracy rather than silently fixed, per `docs/11_AI_RULES.md` Rule 29
("Do Not Convert Warnings Into Silent Behavior").

### Overall Post-Merge Interpretation

**None of the 9 (Scan 1) + 12 (Scan 2) = 21 genuinely new matches is a
callable broker-write path, a real network call to a Toss order endpoint,
a real secret value, a real deployment command, or a
`liveBrokerWriteAllowed: true` runtime value.** Every one is a prohibition
statement, a doc-comment restating a prohibition, a safety assertion
proving absence of a write-shaped capability, or (in one case, explicitly
flagged rather than silently accepted) a regex false-positive confirmed
harmless by direct file reading. This matches the same discipline applied
to the Phase 1 baseline and to the Phase 7 review's own post-merge scan.

## Whether Dashboard/Status APIs Are Read-Only and Advisory

**Yes.** `OperationsStatusReadModel` (P8-001) exposes exactly one public
method (`buildStatus`), enforced by a prototype-enumeration test that
would fail if a second public method were ever added. Every helper
function it calls is a pure transformation with no side effects; no input
is mutated (confirmed by direct reading and by a dedicated "does not
mutate any of its inputs" test). It never computes a new safety decision —
every field is either copied directly from an already-computed Phase 6/7
output or is a simple, deterministic, tested aggregation (worst-of-severity
ranking, counting, filtering) over those outputs. `liveBrokerWriteAllowed:
false` is a literal at both the top level and on the nested small-capital
sub-summary, proven to stay `false` even when the underlying
`readyForSmallCapitalLive` is `true` — so a caller cannot mistake an
otherwise-clean status summary for live-trading authorization. Output
passes through the existing `redactObject` mechanism, and a dedicated test
confirms no command-shaped key (`submitOrder`, `cancelOrder`,
`activateKillSwitch`, `enableLiveTrading`, etc.) or secret-like substring
ever appears in the serialized summary.

## Whether Deployment Readiness Keeps Production/Live Trading Disabled By Default

**Yes.** `evaluateDeploymentReadiness` (P8-002) is a pure function with no
network, filesystem, `process.env`, or subprocess/exec code anywhere in
the file (grep-confirmed directly). `DeploymentReadinessReport.liveBrokerWriteAllowed`
is a hardcoded `false` literal in the return statement, never a computed
pass-through — a dedicated test proves it stays `false` even when
`readyToDeploy: true` on a fully clean input. The evaluator's own doc
comment and `docs/phase8/deployment-readiness-gate.md` explicitly separate
"operational deployment readiness" from "live-trading authorization" as
two concepts that must never be conflated, and the evaluator exports no
type or function that can grant, compute, or imply the second. Every check
fails closed on a missing or malformed input (missing environment
skeleton, live-trading-enabled-by-default skeleton, missing/enabled
live-trading signal, missing production-blocker-status reference for a
production target, any of the 15 required runbook references, missing
rollback/backup-restore/observability references, or any of the 6 required
secret references) — confirmed by 24 tests each covering one fail-closed
path. Secrets are validated as `{ name, reference }` pointers only, with an
active heuristic block against any reference that looks like a real
secret/token value. This evaluator never runs a real cloud deployment
command; the repository contains no `kubectl`/`terraform`/cloud-CLI
invocation code anywhere, confirmed by this task's own repo-wide grep, not
just within the new file.

## Whether Backup/Restore/Rollback Drills Are Testable and Fail Closed

**Yes.** `evaluateBackupRestoreDrill` (P8-003) is a pure function with zero
database/ORM/SQL imports anywhere in the file — structurally, not just by
convention, incapable of touching a real database. `requestedResumeMode`
is restricted to `"PAPER" | "SIMULATION"` at both the type and runtime
level, with a dedicated test proving a `"PRODUCTION"` cast past the type
system is still rejected. The single most safety-critical check —
`reconciledAgainstBrokerSnapshot: boolean` — cannot be satisfied by a
database-only read; it is a caller-supplied attestation distinct from the
real `ReconciliationWorkflowResult` shape, and the drill blocks resume with
`reconciliation_not_confirmed_against_broker_snapshot` whenever it is
`false` or missing, regardless of how clean every other check looks. Every
one of the nine checks (backup manifest, schema/config version, audit
continuity, secrets-handled-separately, post-restore reconciliation, data
quality, kill switch, operator approval, rollback rehearsal) fails closed
on a missing input and requires a validated evidence reference
(non-blank description, non-blank and length-bounded locator, valid
timestamp) — confirmed by 25 tests covering each fail-closed path
individually. `report.liveBrokerWriteAllowed` and
`report.correctiveTradingAllowed` are both hardcoded `false` literals,
proven to stay `false` on the cleanest possible passing input by a
dedicated test, and a separate test confirms the report never exposes a
corrective-trade, broker-order, or live-enable key.

## Whether Any Task Introduced Network Calls/Real Deployment/Broker Write Capability

**No.** Verified three independent ways across all three tasks, not just
by the source scan:

1. **Grep-confirmed directly, across every new file added by
   P8-001/P8-002/P8-003:** zero `fetch`/`axios`/`undici`/`http.request`/`https.request`
   references, zero `process.env` reads, zero `child_process`/`exec`/`spawn`
   references, zero `kubectl`/`terraform`/`aws `/`gcloud`/`docker`
   references, and zero database client/ORM/SQL-string references. The
   only `fetch` references anywhere in the merged `src/` tree remain the
   two pre-existing ones already reviewed and accepted in the Phase 1 and
   Phase 7 baselines (the read-only Toss HTTP client, restricted to 4
   read-only operations, and the unrelated Naver news adapter) — unchanged
   by this merge.
2. **Every new report type hardcodes `liveBrokerWriteAllowed: false` (and,
   for P8-003, `correctiveTradingAllowed: false`) as a literal in its
   return statement**, not a computed value — confirmed by reading all
   three return statements directly, and by a dedicated test per module
   proving the literal stays `false` even on each module's own cleanest,
   most "authorization-looking" passing input.
3. **No new module reads, mutates, or depends on any existing broker-write
   contract, guard, or adapter.** `BrokerWriteCommandGuard` and
   `src/adapters/contracts/toss.ts` were not touched by any of the three
   merges (confirmed by `git diff` scoped to each merge commit); the two
   pre-existing evaluators P8-002 and P8-003 extend
   (`DeploymentEnvironmentSkeletonService`, `RestoreSafetyGate`) were
   read-only consumed, never modified (confirmed by `git diff` returning
   zero lines against each file across the relevant merge range).

A Phase 2 regression check (below) additionally proves, using the real
`BrokerWriteCommandGuard`, that even each new module's cleanest possible
output (`readyToDeploy: true`, `resumeAllowed: true`,
`readyForSmallCapitalLive: true` folded into a clean operations summary)
cannot satisfy the guard on its own — the guard still requires an
`OrderApproval`, a `BrokerAccount`, a `ComplianceGateResult`, a capability
match, an enabled environment policy, an inactive kill switch, and a clean
reconciliation report, none of which any of the three new outputs supplies
or resembles.

## Whether Local Secrets/Receipts Remain Untouched

**Yes.** `.env` does not exist in this worktree (confirmed:
`ls -la .env` returns "No such file or directory", both before and after
the Phase 2 merge). `tmp/phase5/` is an empty, gitignored directory
(confirmed: `ls -la tmp/phase5` shows only `.`/`..`, no files) — it is
git-ignored (`tmp/` in `.gitignore`) and was not created or populated by
any P8-001/P8-002/P8-003 file; it is a transient artifact of running the
local test suite (some pre-existing Phase 5 script tests write to `tmp/`
during execution), consistent with the same observation the Phase 7 review
made about this same directory. Neither path was read, printed, inspected
beyond an existence check, or committed, at any point in either phase of
this task. Grep across every file added by P8-001/P8-002/P8-003 for
`process.env`, `.env`, or `tmp/phase5` references found only prohibition
prose and doc comments (see "Post-Merge Source Scan Results" above),
including the one flagged-and-explained regex false positive on
`input.environmentSkeletons`. No secret value, credential, or raw broker
payload was introduced by any of the three tasks.

## Whether Phase 8 Is Complete, Blocked, or Needs Another Round

**Phase 8 is complete as an operations-readiness package.** Every exit
criterion in `docs/phase8/README.md` is satisfied by the merged state:

- "dashboard/status output can summarize the existing safety chain without
  enabling actions" — satisfied by `OperationsStatusReadModel` (P8-001);
  see "Whether Dashboard/Status APIs Are Read-Only and Advisory" above.
- "deployment readiness fails closed and keeps production/live trading
  disabled by default" — satisfied by `evaluateDeploymentReadiness`
  (P8-002); see "Whether Deployment Readiness Keeps Production/Live
  Trading Disabled By Default" above.
- "backup/restore and rollback drills have explicit, testable gates" —
  satisfied by `evaluateBackupRestoreDrill` (P8-003); see "Whether
  Backup/Restore/Rollback Drills Are Testable and Fail Closed" above.
- "observability and alert summaries remain sanitized" — satisfied;
  P8-001 passes every output through `redactObject` and a dedicated test
  proves no secret-like or raw-broker-payload substring ever appears in
  the serialized summary.
- "all new runtime outputs keep `liveBrokerWriteAllowed: false` where
  relevant" — satisfied; confirmed as a hardcoded literal (never computed)
  on all three new report types.
- "safety regression tests still prove no callable broker-write path
  exists" — satisfied; `tests/safety/safety-regression.test.ts` (25 tests,
  all passing) proves this across the pre-existing Phase 6/7 chain, the
  two pre-existing evaluators P8-002/P8-003 build on (Phase 1 addition to
  this file), and all three new P8-001/P8-002/P8-003 outputs directly
  (Phase 2 addition, below) — none was weakened to get there.
- "`npm run check` passes" — confirmed below: exit code `0`, 87 test
  files, 818 tests, zero failures.

This review does not find a code, documentation, or safety gap that
requires another Phase 8 round. It does not find a real broker-write path,
a real network call to any external service, a real cloud deployment
command, a real secret value, or a `liveBrokerWriteAllowed: true` runtime
value anywhere in the merged code.

**As with every prior phase review, this is operations-readiness evidence
only — it is not approval for live trading, and it is not a deployment
approval.** Per `docs/phase8/README.md`'s own exit-criteria statement:
"Phase 8 completion is operational readiness evidence only. It is not
approval for Phase 9 small-capital live preparation." Nothing in this
review, including P8-002's `readyToDeploy: true` capability, authorizes an
actual deployment to a real cloud provider, an actual database restore, or
live trading of any kind — every one of these remains a separate,
human-only decision gated by evidence this evaluator can report on but
never itself produce or authorize.

The human-only next steps this review surfaces are **entirely inherited
from Phase 7**, not newly introduced by Phase 8: `docs/phase7/live-capable-blocker-register.md`'s
`LCB-001` through `LCB-008` remain exactly as they were at the end of
Phase 7 (none `RESOLVED`) — Phase 8 does not touch that register, and none
of P8-001/P8-002/P8-003 resolves, advances, or references changing any
entry's status. Phase 8 additionally makes explicit (via P8-002's
`REQUIRED_DEPLOYMENT_RUNBOOK_IDS` and P8-003's evidence-reference
requirements) exactly what operational evidence a human operator would
still need to assemble before a real deployment or a real restore drill
could be run for the first time — but assembling and verifying that
evidence against the real repository, and deciding to run a real
deployment or restore, are both human-only actions outside this evaluator
and outside this review's scope.

## Phase 2 Regression Check

Per this task's instruction to add regression coverage if a gap is found,
I checked whether `tests/safety/safety-regression.test.ts` needs new
cross-module coverage now that P8-001/P8-002/P8-003 are merged, following
directly from the Phase 1 gap-check finding above, which explicitly
flagged this as something "Phase 2 must re-check."

**A genuine gap was found and closed.** Each of the three new modules
already has its own per-module proof that its output contains no
command-shaped key — `operations-status-read-model.test.ts`'s "never
exposes a command-shaped key anywhere in the built summary" and
`backup-restore-drill.test.ts`'s "does not expose any corrective trading,
broker order, or live-enable commands" — but `deployment-readiness-gate.test.ts`
has no equivalent test at all (grep-confirmed: no `toHaveProperty` or
command-key check anywhere in that file), and none of the three per-module
test files feeds its module's output through the real
`BrokerWriteCommandGuard`. This is exactly the same shape of gap the Phase
1 addition to this file closed for the two pre-existing evaluators
(`DeploymentEnvironmentSkeletonService`, `RestoreSafetyGate`) these three
modules build on, and the same shape of gap the P7-004 Phase 1 review
closed for the `TossWriteAdapter` placeholder contract before P7-002
existed.

By inspection, the practical risk is low — `containsForbiddenAICommand`
inside `BrokerWriteCommandGuard` only flags a small, fixed set of key
names (`order`, `orders`, `brokerCommand`, `submitOrder`, `cancelOrder`,
`replaceOrder`, `tossRequest`), and none of the three new report shapes
(`OperationsStatusSummary`, `DeploymentReadinessReport`,
`BackupRestoreDrillReport`) contains any of them, confirmed by reading all
three type definitions directly. But "low risk by inspection" is exactly
the category of property this consolidated harness exists to convert into
an automated, reusable proof rather than leaving it as a one-time manual
read — the same reasoning already applied to the Dashboard operator
surface, Claude AI output, and the Phase 1 addition for the two
pre-existing evaluators.

Closed in this phase by adding three tests to
`tests/safety/safety-regression.test.ts`, under a new
`describe("P8-001/P8-002/P8-003 outputs cannot themselves satisfy
BrokerWriteCommandGuard (Phase 8 post-merge cross-module proof)", ...)`
block, each using the real evaluator/read-model (not a stand-in) fed a
fully clean, all-checks-passing input — the case most likely to be
mistaken for an authorization, if any case were:

1. "does not let a clean `OperationsStatusReadModel.buildStatus()` summary
   satisfy `BrokerWriteCommandGuard` on its own" — builds a fully clean
   `OperationsStatusReadModelInput` (including
   `smallCapitalReadiness.readyForSmallCapitalLive: true`, the single most
   "authorization-looking" value this input can carry) and confirms the
   real `BrokerWriteCommandGuard.evaluate({ commandType: "SUBMIT_ORDER",
   aiContext: summary })` still returns `allowed: false` with all six
   structurally-required-and-missing reason codes present.
2. "does not let a clean `evaluateDeploymentReadiness()` report
   (`readyToDeploy: true`) satisfy `BrokerWriteCommandGuard` on its own" —
   same pattern, using a fully clean `DeploymentReadinessInput` (every
   required runbook and secret reference present and resolving) that
   produces `readyToDeploy: true`, `blockingReasonCodes: []`.
3. "does not let a clean `evaluateBackupRestoreDrill()` report
   (`resumeAllowed: true`) satisfy `BrokerWriteCommandGuard` on its own" —
   same pattern, using a fully clean `BackupRestoreDrillInput` (all nine
   checks passing with evidence) that produces `status: "READY"`,
   `resumeAllowed: true`.

All three assert the same six reason codes (`missing_order_approval`,
`missing_broker_account`, `missing_compliance_gate`,
`missing_environment_policy`, `missing_kill_switch_state`,
`missing_reconciliation_state`) and assert
`ai_context_contains_forbidden_broker_command` is absent (confirming the
block comes from the guard's other required-input checks, not a
false-positive on the forbidden-key scan).

No existing test was weakened, removed, or loosened to add this coverage.
No implementation file was modified (only the shared
`tests/safety/safety-regression.test.ts` file, which this task explicitly
owns). No file owned by Engineer 1 (P8-001), Engineer 2 (P8-002), or
Engineer 3 (P8-003) was modified.

`tests/safety/safety-regression.test.ts` now has 25 tests total (20
inherited from Phase 6/Phase 7, 2 added in this task's own Phase 1, 3
added here in Phase 2), all passing, confirmed by direct
`npx vitest run tests/safety/safety-regression.test.ts` runs (25/25) and
by `npm run typecheck` passing cleanly.

## Phase 1 Regression-Gap Check (Pre-Merge Baseline)

This section records the Phase 1 work only: a review of the current,
pre-P8-001/P8-002/P8-003 state of the safety chain against the
consolidated `tests/safety/safety-regression.test.ts` harness, following
the same Phase 1 pattern used for P7-004 in
`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`,
"Phase 1 Regression-Gap Check (Pre-Merge Baseline)", and for P6-008 before
it. It is not the Phase 8 integration review itself, and it does not
describe any P8-001/P8-002/P8-003 content, since none of those branches
exist yet at the time this section was written.

Baseline commit reviewed: `e3347f2` ("Add Phase 8 operations readiness task
plan"), local `main` tip at the start of Phase 8, before any of P8-001,
P8-002, or P8-003 were merged.

Files read as the baseline safety chain:

- `docs/phase8/README.md`
- `docs/tasks/phase8_claude_worktree_tasks/README.md`
- `docs/09_Operation_Deployment.md`
- `docs/11_AI_RULES.md`
- `docs/phase6/README.md`
- `docs/phase7/README.md`
- `docs/phase7/live-capable-blocker-register.md`
- `docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`
- `docs/tasks/phase8_claude_worktree_tasks/P8-001_operations_status_api.md`
- `docs/tasks/phase8_claude_worktree_tasks/P8-002_deployment_readiness_gate.md`
- `docs/tasks/phase8_claude_worktree_tasks/P8-003_backup_restore_and_rollback_drills.md`
- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `src/application/deployment/deployment-environment-skeleton.ts`
- `src/application/backup-restore/restore-safety-gate.ts`
- `src/application/live-readiness/small-capital-readiness.ts`
- `tests/application/deployment-environment-skeleton.test.ts`
- `tests/application/restore-safety-gate.test.ts`
- `tests/safety/safety-regression.test.ts` (pre-Phase-8 state: 20 tests,
  all inherited from Phase 6 and Phase 7)

### Gap Check Finding

Phase 8's inputs (`docs/phase8/README.md`, P8-002's and P8-003's task
files) center on two "readiness gate"-shaped evaluators that are expected
to be designed on top of pre-existing pure evaluators already in this
codebase: `DeploymentEnvironmentSkeletonService`
(`src/application/deployment/deployment-environment-skeleton.ts`, whose
`validate()` method already returns `{ ok: true, reasonCodes: [] }` under
clean input) and `RestoreSafetyGate`
(`src/application/backup-restore/restore-safety-gate.ts`, whose
`evaluate()` method already returns `{ status: "READY",
tradingResumeAllowed: true }` under a clean checklist). P8-002's task doc
explicitly requires "coordinate before changing
`deployment-environment-skeleton.ts`", and P8-003's requires "coordinate
before changing `restore-safety-gate.ts`" — both are expected inputs, not
files Phase 8 replaces from scratch.

The consolidated `tests/safety/safety-regression.test.ts` harness already
proves, for two other "produces an advisory-looking, sometimes
fully-permissive-looking result" surfaces, that the result cannot itself
satisfy `BrokerWriteCommandGuard`:

- the "Dashboard operator surface stays advisory-only ..." block proves
  this for `DashboardSensitiveControlGate`'s most privileged decision
  (`ENABLE_PRODUCTION_MODE`, `allowed: true`, `mutatesState: true`);
- the "AI output stays advisory-only ..." block proves the equivalent
  property for Claude analysis output.

Until this phase, the harness had never asserted the same property for
`DeploymentEnvironmentSkeletonService.validate()`'s clean `ok: true`
result or `RestoreSafetyGate.evaluate()`'s clean `tradingResumeAllowed:
true` result — the only existing coverage was per-module
(`tests/application/deployment-environment-skeleton.test.ts`,
`tests/application/restore-safety-gate.test.ts`), and neither of those
files imports or exercises `BrokerWriteCommandGuard` at all (confirmed by
reading both files directly).

This is a genuine, narrow gap. It does not indicate any current unsafe
behavior — by inspection, `BrokerWriteCommandGuard.evaluate()` requires an
`OrderApproval`, a `BrokerAccount`, a `ComplianceGateResult`, a capability
registry match, an enabled `BrokerWriteEnvironmentPolicy`, an inactive
kill switch, and a clean `ReconciliationReport` before it returns
`allowed: true`, none of which either evaluator's output resembles or
supplies. But it means the exact property P8-002 and P8-003 must not
violate — that a "deployment is ready" or "restore drill passed" result,
however clean, stays structurally unable to stand in for, or leak into, a
real `BrokerWriteCommandGuard` authorization — had no automated, reusable,
cross-module proof in the harness the way the equivalent property already
exists for the dashboard and AI-output surfaces. Given P8-002 and P8-003
are about to build directly on top of these two evaluators, closing this
gap now, before either branch exists, produces a clean pre-merge baseline
test that Phase 2 can compare against after the merge (i.e., it must still
pass afterward, unmodified in intent, regardless of whatever new
deployment-readiness-gate or backup-restore-drill file P8-002/P8-003 add
alongside them).

This finding is the pre-merge analogue of the same category of gap the
P7-004 Phase 1 review found and closed for the `TossWriteAdapter`
placeholder contract before P7-002 existed.

Closed in this phase by adding two new tests to
`tests/safety/safety-regression.test.ts`, under a new
`describe("Pre-existing operational evaluators that Phase 8 will extend
cannot themselves satisfy BrokerWriteCommandGuard (Phase 8 pre-merge
baseline)", ...)` block:

1. "does not let a clean `DeploymentEnvironmentSkeletonService.validate()`
   result satisfy `BrokerWriteCommandGuard` on its own" — calls the real
   `validate()` with its own built-in default skeletons (no mocking),
   confirms it returns `ok: true`, then feeds that exact result object as
   `aiContext` into a real `BrokerWriteCommandGuard.evaluate({
   commandType: "SUBMIT_ORDER", aiContext: validation })` call and asserts
   `allowed: false` with all six structurally-required-and-missing reason
   codes present (`missing_order_approval`, `missing_broker_account`,
   `missing_compliance_gate`, `missing_environment_policy`,
   `missing_kill_switch_state`, `missing_reconciliation_state`), and that
   the AI-context forbidden-key scan does not fire (the object contains no
   forbidden key, so it should not fire, and the point of this assertion is
   that the *other* six required-input checks are what block it, not a
   false-positive on the forbidden-key scan).
2. "does not let a clean `RestoreSafetyGate.evaluate()` result
   (`tradingResumeAllowed: true`) satisfy `BrokerWriteCommandGuard` on its
   own" — same pattern, using a fully-clean `RestoreSafetyChecklist` (every
   boolean `true`) fed into the real `RestoreSafetyGate`, confirming
   `status: "READY"` and `tradingResumeAllowed: true`, then the same
   `BrokerWriteCommandGuard` cross-check and reason-code assertions.

No existing test was weakened, removed, or loosened to add this coverage.
No implementation file was modified (only the shared
`tests/safety/safety-regression.test.ts` file, which this task explicitly
owns). No file owned by Engineer 1 (P8-001), Engineer 2 (P8-002), or
Engineer 3 (P8-003) was created or modified.

Other candidate gap areas were considered and found not yet applicable at
the Phase 1 baseline, because the modules P8-001/P8-002/P8-003 are
expected to add do not exist yet:

- `src/application/operations/operations-status-read-model.ts` (P8-001) —
  does not exist at this baseline; no regression test can meaningfully
  target content that has not been written yet. `docs/phase8/README.md`'s
  own "Allowed in Phase 8" list already requires this future module to
  stay read-only and advisory, and the pre-existing read-only surfaces it
  is expected to aggregate
  (`src/application/dashboard/read-only-dashboard.ts`,
  `src/application/alerting/operational-alerting-service.ts`,
  `src/application/observability/observability-metrics.ts`,
  `src/application/live-readiness/small-capital-readiness.ts`) are already
  each individually covered by the existing dashboard/AI-output
  cross-module proofs in this harness (small-capital-readiness's own
  36-test suite separately proves it never sets
  `liveBrokerWriteAllowed: true`, per the Phase 7 review) — Phase 2 must
  re-check whether the new aggregator itself needs an equivalent
  cross-module proof once it exists.
- `src/application/deployment/deployment-readiness-gate.ts` (P8-002) —
  does not exist at this baseline; the pre-existing
  `DeploymentEnvironmentSkeletonService` it is expected to build on is
  covered by the new test above.
- `src/application/backup-restore/backup-restore-drill.ts` (P8-003) — does
  not exist at this baseline; the pre-existing `RestoreSafetyGate` it is
  expected to build on is covered by the new test above.

Phase 2 must re-check the actual P8-001/P8-002/P8-003 post-merge state and
add further regression coverage if a similar cross-module gap is found for
the new aggregator/gate/drill outputs themselves (not just the pre-existing
evaluators underneath them), the same way Phase 2 of the Phase 7 review
re-checked its own flagged-but-not-yet-applicable areas once P7-002/P7-003
landed.

### Tests Added in Phase 1

Both added to `tests/safety/safety-regression.test.ts`, under a new
`describe("Pre-existing operational evaluators that Phase 8 will extend
cannot themselves satisfy BrokerWriteCommandGuard (Phase 8 pre-merge
baseline)", ...)` block:

- "does not let a clean `DeploymentEnvironmentSkeletonService.validate()`
  result satisfy `BrokerWriteCommandGuard` on its own"
- "does not let a clean `RestoreSafetyGate.evaluate()` result
  (`tradingResumeAllowed: true`) satisfy `BrokerWriteCommandGuard` on its
  own"

`tests/safety/safety-regression.test.ts` now has 22 tests total (20
inherited from Phase 6/Phase 7, plus these 2), all passing, confirmed by
direct `npx vitest run tests/safety/safety-regression.test.ts` runs.

### Phase 1 Commands Run

```bash
npx vitest run tests/safety/safety-regression.test.ts
npm run check
```

`npx vitest run tests/safety/safety-regression.test.ts` passed cleanly (22
tests, 22 passed).

`npm run check` (typecheck plus the full test suite) passed cleanly: exit
code `0`, `84` test files, `750` tests, all passing (748 inherited from the
Phase 7 baseline plus these 2 new tests).

### Phase 1 Scope Notes

- No implementation file owned by a future Engineer 1 (P8-001), Engineer 2
  (P8-002), or Engineer 3 (P8-003) was created or modified.
- No real Toss API call was made, simulated, or coded.
- No real cloud deployment command was made, simulated, or coded.
- No real broker write of any kind was performed, simulated, or coded.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed — only checked for existence with `ls`, per the universal
  safety rules for this task; neither exists in this worktree.
- `docs/tasks/phase8_claude_worktree_tasks/README.md` was not modified in
  this phase.
- `docs/phase8/README.md` was not modified in this phase.
- Live trading and deployment approval were not marked ready anywhere in
  this document, including in the placeholder sections above.
- No open question was resolved and no human approval was implied by this
  phase's work.

## Commands Run and Results (Phase 2)

All commands below were run from
`/Users/mac/Documents/Codex/aios-phase8-worktrees/eng4` on branch
`phase8/p8-004-integration-review` after `git merge main` (merge commit
`de5da4e`). Local `main` tip merged: `26d3e45`.

```bash
git merge main --no-edit
```
Clean merge, no conflicts (`ort` strategy). 14 files changed, 3,394
insertions, 0 deletions — all new files plus two one-line re-export
additions (`src/application/deployment/index.ts`,
`src/application/backup-restore/index.ts`) and one one-line re-export
addition to `src/application/operations/index.ts` (new file) plus one line
to `src/index.ts`, all already accounted for in "What Changed in
P8-001/P8-002/P8-003" above.

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase8
rg -n "\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase8
```
102 and 118 total matches respectively; 9 and 12 genuinely new versus the
Phase 1 baseline, all accepted categories (one explicitly flagged as a
regex false positive and confirmed harmless by direct reading) — see
"Post-Merge Source Scan Results" above for the full listing and per-match
interpretation.

```bash
npx vitest run tests/safety/safety-regression.test.ts
```
25/25 tests passing, after adding the 3 Phase 2 cross-module tests
described in "Phase 2 Regression Check" above.

```bash
npm run typecheck
```
Clean, no errors — including for the three new fixture-construction blocks
added in this phase, which import and structurally satisfy the real
`OperationsStatusReadModelInput`, `DeploymentReadinessInput`, and
`BackupRestoreDrillInput` types from the merged P8-001/P8-002/P8-003
modules.

```bash
npm run check
```
Exit code `0`. Typecheck clean. `87` test files, `818` tests, all
passing — the `813` tests present on merged `main` plus the `5` tests this
branch carries in `tests/safety/safety-regression.test.ts` (2 from this
task's own Phase 1, 3 from Phase 2).

```bash
ls -la .env
ls -la tmp/phase5
```
`.env`: "No such file or directory". `tmp/phase5`: empty directory
(only `.`/`..`), gitignored, not tracked by `git status`. Existence checks
only, per this task's universal safety rules — neither was read, printed,
or inspected beyond this.

## Phase 2 Scope Notes

- No implementation file owned by Engineer 1 (P8-001), Engineer 2
  (P8-002), or Engineer 3 (P8-003) was modified — this review only reads
  and reports on their merged content, and adds regression coverage only
  to the shared `tests/safety/safety-regression.test.ts` file this task
  explicitly owns.
- `docs/tasks/phase8_claude_worktree_tasks/README.md` and
  `docs/phase8/README.md` were updated in Phase 2 for status/link updates
  only, per this task's file-ownership rules, which explicitly permit that
  in Phase 2 (unlike Phase 1, where both were off-limits) — see the
  separate diffs to those two files for the exact changes.
- No real Toss API call was made, simulated, or coded, in either phase.
- No real broker write of any kind was performed, simulated, or coded, in
  either phase.
- No real cloud deployment command was made, simulated, or coded, in
  either phase.
- No real database backup, restore, or destructive operation was
  performed, simulated, or coded, in either phase.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed at any point in Phase 2 — confirmed by `ls`-only existence
  checks; `.env` does not exist in this worktree and `tmp/phase5/` is an
  empty, gitignored directory.
- No blocker in `docs/phase7/live-capable-blocker-register.md` was marked
  `RESOLVED` by this review, and this review does not have the authority
  to mark one `RESOLVED` — that requires a human reviewer per the
  register's own rules. Phase 8 does not touch that register at all.
- No open question in `docs/open_questions.md` was created, resolved, or
  modified by this review.
- Live trading and deployment approval were not marked ready anywhere in
  this document. Phase 8's completion, as concluded above, is explicitly
  not live-trading authorization and not a deployment approval, per
  `docs/phase8/README.md`'s own exit-criteria statement, quoted directly in
  "Whether Phase 8 Is Complete, Blocked, or Needs Another Round" above.
- No open question was resolved and no human approval was implied,
  claimed, or inferred by this review, in either phase.
