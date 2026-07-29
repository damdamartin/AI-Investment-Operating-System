# Phase 8 Deployment Readiness Gate (P8-002)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Task: `docs/tasks/phase8_claude_worktree_tasks/P8-002_deployment_readiness_gate.md`
Related Code: `src/application/deployment/deployment-readiness-gate.ts`,
`src/application/deployment/deployment-environment-skeleton.ts`,
`tests/application/deployment-readiness-gate.test.ts`
Related Docs: `docs/phase8/README.md`, `docs/09_Operation_Deployment.md`,
`docs/11_AI_RULES.md`, `docs/phase7/live-capable-blocker-register.md`,
`src/application/live-readiness/small-capital-readiness.ts`

## Purpose

This document describes the Phase 8 deployment readiness gate: a pure,
design-time evaluator that reports whether the repository's code and
documentation are in a no-write, OPERATIONAL deployment-ready state. It
does not deploy anything, does not call any cloud provider, and does not
authorize live trading.

Per `docs/phase8/README.md`, Phase 8:

- does not authorize live trading
- does not implement a real Toss broker-write adapter
- does not perform a real deployment to a cloud provider from Claude/Codex
- defines deployment readiness gates that keep production disabled by
  default

## Two Concepts That Must Never Be Conflated

1. **Operational deployment readiness** (`readyToDeploy`) — whether the
   code and documentation referenced by the evaluator's inputs are in a
   deployable state: the environment skeleton exists and validates, all
   required runbooks are referenced and resolve, a rollback plan is
   referenced, a backup/restore gate is referenced, an
   observability/alerting status is referenced, and all secrets appear
   only as references (never values).
2. **Live-trading authorization** — an entirely separate concept, governed
   by `src/application/live-readiness/small-capital-readiness.ts` and
   ultimately by human-recorded decisions in
   `docs/phase7/live-capable-blocker-register.md` and
   `docs/phase7/manual-live-approval-record.md`.

`evaluateDeploymentReadiness` cannot compute, return, or imply the second
concept. Its report always carries `liveBrokerWriteAllowed: false` as a
literal value, matching the same field on `ReconciliationWorkflowResult`,
`Phase6OperatorSafetyStatus`, `AlertEvent`, and `SmallCapitalReadinessReport`
elsewhere in this codebase. A clean `readyToDeploy: true` reading is never,
under any input, a live-trading authorization.

## What The Evaluator Is

`evaluateDeploymentReadiness` (in
`src/application/deployment/deployment-readiness-gate.ts`) is a **pure
function**: no network code, no filesystem access, no `process.env` reads,
no subprocess/exec calls, and no side effects. It takes a plain data input
describing the target environment and a set of caller-supplied reference
facts, and returns a plain data report. It never runs `kubectl`,
`terraform`, a cloud CLI, `docker push`, or any other real deployment
command — this repository contains no such commands anywhere, and this
gate does not add any.

Because it performs no filesystem or network I/O itself, every "does this
reference exist" fact (a runbook, the rollback plan, the backup/restore
gate, the observability/alerting status) is supplied by the **caller** as
a plain boolean fact (`{ reference: string; exists: boolean }`). This
evaluator only validates the *shape* of what it is given — non-blank,
not secret-looking, matching the fixed required catalog below — and fails
closed whenever a fact is missing, blank, or marked as not resolving.
Determining those facts against the real repository (for example, by
checking whether a runbook file exists on disk) is intentionally left to
whatever process assembles the input to this evaluator; that process is
out of scope for this pure, design-time checker.

## Checks Performed

### 1. Environment skeleton exists and validates

The evaluator looks up the target environment
(`development` | `test` | `staging` | `production`) in the supplied
`environmentSkeletons` list (defaulting to the real
`deploymentEnvironmentSkeletons` catalog from
`deployment-environment-skeleton.ts`), and runs the skeleton's own
`DeploymentEnvironmentSkeletonService.validate()` over the full list.
A missing skeleton for the target environment, or any skeleton validation
failure (for example `liveTradingEnabled` not `false`, or a secret
reference that looks like a real secret value), blocks readiness.

### 2. Live trading is disabled by default

The caller supplies a `liveTradingSignal` (`{ liveTradingEnabled: boolean;
appEnv }`). Readiness blocks unless `liveTradingEnabled === false` and the
signal's environment matches the target environment. This gate cannot
flip that value — the check only ever *reads* the supplied value and
blocks on anything other than `false`.

### 3. Production deployment has explicit blocker status

For `targetEnvironment === "production"` only, the caller must supply a
`productionBlockerStatus` whose `reference` string contains
`live-capable-blocker-register` (i.e. is recognizably a reference to
`docs/phase7/live-capable-blocker-register.md`) and whose
`openBlockerCount` is a valid non-negative number. This evaluator does not
read the register itself and does not decide whether any blocker is
resolved — it only requires that a production deployment target names an
explicit, recognizable blocker-status reference rather than silence. Non-
production targets are not required to supply this (a missing/incomplete
reference on a non-production target produces a warning only, never a
block).

### 4. Required runbooks exist by reference

`REQUIRED_DEPLOYMENT_RUNBOOK_IDS` is a fixed, non-caller-configurable list
matching `docs/09_Operation_Deployment.md` Section 18 ("Operational
Runbooks") exactly:

```text
activate_global_kill_switch
deactivate_kill_switch
handle_unknown_broker_order_state
handle_duplicate_order_risk
handle_toss_api_outage
handle_naver_api_outage
handle_claude_api_outage
handle_stale_market_data
handle_reconciliation_mismatch
rotate_api_secret
restore_database_backup
rollback_deployment
pause_strategy
retire_strategy
increase_capital_limit
```

Every one of these must have a corresponding `DeploymentReadinessRunbookReference`
entry with a non-blank, non-secret-looking `reference` and `exists: true`.
A missing entry, a blank reference, a reference that looks like a secret
value, or `exists: false` all block readiness — each with its own
reason code, so a caller can see exactly which runbook is missing.

### 5. Rollback plan reference exists

A single `rollbackPlanReference` (`{ reference, exists }`) is required,
validated the same way as a runbook reference.

### 6. Backup/restore gate reference exists

A single `backupRestoreGateReference` is required. This is expected to
point at the P8-003 backup/restore drill evaluator and its documentation
(`docs/phase8/backup-restore-drill.md`, once that task lands) but this
module does not import from `src/application/backup-restore/*` — it only
validates the reference fact it is given, to avoid coupling to a sibling
engineer's in-flight module.

### 7. Observability/alerting status reference exists

A single `observabilityAlertingReference` is required, expected to point
at the operations status/observability surface (for example
`docs/phase8/operations-status-api.md`, once P8-001 lands, or existing
`docs/phase6` alerting documentation).

### 8. Secrets are references only, not values

`REQUIRED_DEPLOYMENT_SECRET_NAMES` mirrors `ExternalSecrets` in
`src/config/environment.ts` (`TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`,
`TOSS_ACCOUNT_REF`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`,
`CLAUDE_API_KEY`). For any environment whose skeleton has
`requiresRealSecrets: true` (`staging` and `production` by default;
`development` and `test` do not require this), the caller must supply a
`DeploymentReadinessSecretReference` for every required name. Each entry's
`reference` must be non-blank and must not look like an actual secret
value (API key, bearer token, password, or long base64-like blob) — the
same heuristic already used by `deployment-environment-skeleton.ts`. This
evaluator never reads `process.env`, never accepts an actual secret value,
and never reports one; it only checks that a reference *string* (for
example `"secret-ref:claude-api-key-production"`) is present and does not
itself look like a leaked value.

## Fail-Closed Behavior

Every check above fails closed: a missing, blank, or malformed input is
always treated as blocking, never as "assume ready." `readyToDeploy` is
only `true` when `blockingReasonCodes` is empty. The evaluator never
throws for a missing or malformed input — it always returns a report.

## Report Shape

```ts
interface DeploymentReadinessReport {
  readyToDeploy: boolean;
  targetEnvironment: AppEnvironment;
  blockingReasonCodes: string[];
  warnings: string[];
  liveBrokerWriteAllowed: false; // always literal false
  generatedAt: Date;
  safetyType: "DEPLOYMENT_READINESS_REPORT_EVALUATION_ONLY";
}
```

## What This Gate Does Not Do

- It does not run any real deployment command (no `kubectl`, no
  `terraform apply`, no `aws`/`gcloud`/`az` CLI call, no `docker push` to a
  real registry, no subprocess/exec of any kind). No such command exists
  anywhere in this module or this task's changes.
- It does not make any network call.
- It does not read `process.env`, `.env`, or any real secret value.
- It does not read or inspect `tmp/phase5/` receipts.
- It does not enable live trading, and it cannot flip
  `liveBrokerWriteAllowed` to `true` under any input — that field is a
  hardcoded literal in the implementation, not a computed pass-through.
- It does not change, weaken, or bypass any existing safety check.
- It does not resolve, advance, or close any entry in
  `docs/phase7/live-capable-blocker-register.md` or
  `docs/open_questions.md`.
- It does not certify that live trading is safe. That determination
  belongs entirely to the small-capital readiness gate
  (`src/application/live-readiness/small-capital-readiness.ts`) and the
  human reviewers named in the blocker register.

## Relationship To Other Phase 8 Work

- `src/application/deployment/deployment-environment-skeleton.ts` (prior
  phase, not modified by this task) defines the per-environment skeleton
  this gate validates against.
- P8-001 (`src/application/operations/*`,
  `docs/phase8/operations-status-api.md`) is expected to be a natural
  source for the `observabilityAlertingReference` input, once merged. This
  module does not import from it to avoid coupling to in-flight sibling
  work.
- P8-003 (`src/application/backup-restore/*`,
  `docs/phase8/backup-restore-drill.md`,
  `docs/phase8/rollback-drill-runbook.md`) is expected to be the natural
  source for the `backupRestoreGateReference` and `rollbackPlanReference`
  inputs, once merged. Same non-coupling rationale.
- P8-004 performs the full Phase 8 integration review after all four
  Phase 8 tasks are merged, including this gate.
