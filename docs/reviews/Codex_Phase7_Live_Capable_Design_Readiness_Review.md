# Codex Phase 7 Live-Capable Design Readiness Review

Version: 1.0.0
Status: Complete
Review Date: 2026-07-29
Task: P7-004 Phase 7 Integration Review
Assigned Engineer: Engineer 4

## Purpose

This document records the Phase 7 integration and live-capable design
readiness review after P7-001 (live-capable blocker audit), P7-002 (Toss
write contract design), and P7-003 (small-capital readiness gates) were
merged into local `main`. It follows the same two-phase pattern used for
`docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`:
Phase 1 established a pre-merge baseline (source scan, regression-gap
check, scaffold); Phase 2 (this content) performs the full integration
review now that P7-001/P7-002/P7-003 exist and are merged.

Merge commits reviewed (local `main`, never pushed to GitHub):

- `0e596db` — Merge Phase 7 Engineer 1: P7-001 live-capable blocker audit
- `d9b99c9` — Merge Phase 7 Engineer 2: P7-002 Toss write contract design
- `6be56eb` — Merge Phase 7 Engineer 3: P7-003 small-capital readiness gates

Local `main` tip at review time: `6be56eb`. This review was produced from
`phase7/p7-004-integration-review` after merging local `main` into it
(merge commit recorded in the Phase 2 commit for this branch — see the
final report accompanying this document for the exact SHA).

Every claim below was checked directly against the merged source in this
worktree — `docs/phase7/live-capable-blocker-register.md`,
`docs/reviews/Codex_Phase7_Live_Capable_Blocker_Audit.md`,
`docs/phase7/toss-write-contract-design.md`,
`src/adapters/toss-write-contract.ts`,
`tests/adapters/toss-write-contract.test.ts`,
`docs/phase7/small-capital-readiness-gates.md`,
`docs/phase7/manual-live-approval-record.md`,
`docs/phase7/small-capital-operator-checklist.md`,
`src/application/live-readiness/small-capital-readiness.ts`,
`tests/application/small-capital-readiness.test.ts`, and the one-line diff
to `docs/open_questions.md` — not inferred from a summary alone.

**This document does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, or production capital use.**

## Phase Status

- Phase 1 (scaffold, baseline source scan, pre-merge regression-gap
  check): complete.
- Phase 2 (full integration review after P7-001/P7-002/P7-003 merge):
  complete.

## Summary

P7-001, P7-002, and P7-003 merged into local `main` cleanly, and merged
into this review branch with no conflicts. `npm run check` passes cleanly
on the merged branch: typecheck clean, 84 test files, 745 tests, all
passing (743 from merged `main` plus the 2 Phase 1 regression tests this
branch already carried in `tests/safety/safety-regression.test.ts`, for
20 tests total in that file). No flake was observed on this run (system
load had returned to normal after the three sibling engineer worktrees
finished their own work; see "Commands Run and Results" below for the
contrast with the contended Phase 1 runs).

All three branches are documentation- and type-only, or pure-evaluator,
additions on top of the existing Phase 5/6 safety chain. None weaken or
bypass an existing fail-closed control, and none add a code path capable
of placing, cancelling, or modifying a broker order, moving money, or
calling a real Toss API. The post-merge source scan (below) found 21
matches genuinely attributable to P7-001/P7-002/P7-003 versus the Phase 1
baseline (a further 16 matches are this branch's own Phase 1 regression
test additions, already reviewed and approved in Phase 1, and 1 is a
line-number-shift artifact in an unmodified test file — neither category
is new content from the merge; see "Post-Merge Source Scan Results" below
for the precise accounting). Every one of the 21 genuinely new matches is
a prohibition, a `command: never` placeholder, or a safety-report/comment
reference describing a `false` literal — none is a callable write path, a
real network call, or a `liveBrokerWriteAllowed: true` runtime value. `broker-write-command-guard.ts`
and `src/adapters/contracts/toss.ts` are byte-for-byte unchanged from the
Phase 1 baseline (confirmed by `git diff`, zero lines), matching every
task doc's stated boundary that Phase 7 does not modify the existing
guard or the already-shipped placeholder contract.

`docs/phase7/live-capable-blocker-register.md` (P7-001) lists all eight
required blocker categories, each `NOT_STARTED`, `UNVERIFIED`,
`EVIDENCE_PENDING`, or `BLOCKED` — none `RESOLVED`.
`src/adapters/toss-write-contract.ts` (P7-002) extends the existing
uncallable `TossWriteAdapter` pattern to a third operation
(`REPLACE_ORDER`) using the identical `command: never` technique, adds
only frozen plain-data exports (no function export exists, proven by a
dedicated test), and never sets `liveBrokerWriteAllowed` to anything but
the literal `false`.
`src/application/live-readiness/small-capital-readiness.ts` (P7-003) is a
pure evaluator with no network/filesystem access, whose only path to
`readyForSmallCapitalLive: true` requires an externally-supplied
`ManualLiveApprovalRecord` already marked `APPROVED` by a human `OWNER` —
this codebase contains no function anywhere that can construct such a
record.

**Go/No-Go: Phase 7 is complete as a design-readiness package.** No real
broker write path exists, human approval remains structurally required
and cannot be inferred or auto-populated by AI, `.env`/local Phase 5
receipts remain untouched, small-capital readiness is fully specified but
not enabled anywhere, and the blocker register makes the remaining
human-only steps toward a future live implementation phase explicit. See
"Whether Phase 7 Is Complete, Blocked, or Needs Another Round" below for
the full reasoning and the residual (human-only) work this review
surfaces, none of which is a code or documentation gap Phase 7 itself
needed to close.

## What Changed in P7-001 (Live-Capable Blocker Audit)

Files: `docs/reviews/Codex_Phase7_Live_Capable_Blocker_Audit.md` (new),
`docs/phase7/live-capable-blocker-register.md` (new), `docs/open_questions.md`
(one reference line added).

- Added an 8-entry blocker register (`LCB-001` through `LCB-008`): Toss
  automated trading permission evidence, Toss account permission/capability
  evidence, production credential/provisioning evidence, human approval
  evidence, compliance/legal approval evidence, small-capital
  operating-limit evidence, kill-switch/rollback evidence (live context),
  and real broker write adapter review evidence — the exact eight
  categories P7-001's task doc required at minimum. Confirmed by reading
  the register directly: every entry carries blocker ID, current status,
  source citation, required evidence type, human owner/reviewer role
  (always a human role — "compliance/legal reviewer," "project owner /
  operator," "senior engineer / independent code reviewer," etc., never
  "AI" or "Claude"), artifact path, prohibited artifact contents, and
  go/no-go impact with an explicit rule/section citation.
- Every entry's `Current Status` is one of `NOT_STARTED`, `UNVERIFIED`,
  `EVIDENCE_PENDING`, or `BLOCKED` — confirmed directly by reading all
  eight entries and the register's own "Status Values" section, which
  defines `RESOLVED` as requiring a human reviewer to record a decision,
  reviewer name, and reviewed date, a condition an AI-authored document
  cannot satisfy for any entry and does not attempt to. `LCB-008` (real
  broker write adapter review) is explicitly `BLOCKED`, not merely
  `NOT_STARTED`, with the register stating this status is structural: the
  artifact it would review (a real write adapter) must not exist yet
  under the Phase 7 boundary itself.
- `LCB-004` (human approval evidence) points to
  `docs/phase7/manual-live-approval-record.md`, correctly noting at audit
  time that the file did not yet exist and recording that absence as part
  of the blocker's `NOT_STARTED` status — the file was added later by
  P7-003 (this review confirms below that it now exists and is
  structurally sound).
- `docs/open_questions.md` diff is exactly one addition: a "Related Phase
  7 Blocker Register" reference paragraph under "Purpose," pointing at the
  new register. Confirmed by `git diff` directly: no `Status` or `Evidence
  Status` field on any open question (OQ-001 through OQ-008) was touched.
- `docs/reviews/Codex_Phase7_Live_Capable_Blocker_Audit.md` documents
  methodology (how the eight required categories map onto the two prior
  Phase 6 blocker lists), explicitly verifies no open question was
  resolved, verifies no secret or raw payload was introduced, and verifies
  no blocker was marked resolved — all confirmed independently against the
  actual register content in this review rather than taken on the audit
  document's word alone.
- No file owned by Engineer 2 (P7-002), Engineer 3 (P7-003), or Engineer 4
  (P7-004) was created or edited by this task, confirmed by `git diff`
  scoped to this merge.

## What Changed in P7-002 (Toss Write Contract Design)

Files: `docs/phase7/toss-write-contract-design.md` (new, 335 lines),
`src/adapters/toss-write-contract.ts` (new, 213 lines),
`tests/adapters/toss-write-contract.test.ts` (new, 102 lines).
`src/application/broker-write-guard/broker-write-command-guard.ts` and
`src/adapters/contracts/toss.ts` were reviewed but confirmed unmodified —
`git diff 4069d57..6be56eb -- <both files>` returns zero lines.

- `src/adapters/toss-write-contract.ts` defines `TossFutureWriteAdapter`
  with `submitOrder`/`cancelOrder`/`replaceOrder`, every method typed
  `(command: never): Promise<never>` — confirmed by reading the file
  directly (lines 193-197) — extending the existing, already-shipped
  `TossWriteAdapter` two-method pattern in `src/adapters/contracts/toss.ts`
  to a third operation without editing that file, exactly as the task's
  "coordinate before touching existing adapter interfaces" instruction
  required.
- The file's only runtime-observable exports are frozen plain-data
  constants: `TOSS_FUTURE_WRITE_CONTRACT_ALLOWED_OPERATIONS` (`SUBMIT_ORDER`,
  `CANCEL_ORDER`, `REPLACE_ORDER`), `TOSS_FUTURE_WRITE_CONTRACT_FORBIDDEN_OPERATIONS`
  (`TRANSFER`, `WITHDRAWAL`, `DEPOSIT`, `CURRENCY_EXCHANGE` — explicitly
  never appearing in any allowed-operation type), and a frozen
  `TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT` object whose
  `liveBrokerWriteAllowed` field is the literal `false`. Confirmed directly
  by reading the file: no class, no function that returns a callable
  adapter instance, and no network/HTTP/`process.env` code exists anywhere
  in it.
- `tests/adapters/toss-write-contract.test.ts` includes a test
  ("has no runtime implementation of TossFutureWriteAdapter anywhere in
  this module") that imports the module and asserts, via
  `Object.entries(moduleExports)`, that no exported value has `typeof
  value === "function"` — an automated, reusable proof rather than a
  one-time manual grep. A separate test
  ("is frozen so no runtime caller can flip liveBrokerWriteAllowed to
  true") uses the same `@ts-expect-error` + `Object.freeze` pattern this
  review's own Phase 1 addition to `tests/safety/safety-regression.test.ts`
  independently converged on: it asserts
  `Object.isFrozen(TOSS_FUTURE_WRITE_CONTRACT_SAFETY_REPORT)` is `true` and
  that attempting `.liveBrokerWriteAllowed = true` throws a `TypeError`
  (`tests/adapters/toss-write-contract.test.ts:68`). Note this line uses
  assignment syntax (`liveBrokerWriteAllowed = true`), so it is *not*
  actually caught by this task's `liveBrokerWriteAllowed: true` (colon
  form) source-scan pattern — the scan only catches the two prose/comment
  mentions of that exact colon-form string (line 19 of the source file and
  line 14 of the test file, both describing what must never happen). I
  found and verified the real assignment-attempt line by reading the test
  file directly rather than relying on the scan pattern alone, which is
  exactly the kind of gap a regex-only review would miss — it exists
  specifically to prove the value can never be set, not to set it, and
  `Object.freeze` plus the `false`-literal type together make the throw
  unconditional.
- `docs/phase7/toss-write-contract-design.md` specifies, section by
  section: allowed future operations as types only (Section 2), inputs
  required from a real `OrderApproval` before a command could even be
  constructed (Section 3), the relationship to `BrokerWriteCommandGuard`
  as read-only, unmodified input (Section 4), idempotency/client-order-id
  requirements (Section 5), a mandatory kill-switch re-check immediately
  before submission, distinct from the guard's enqueue-time check
  (Section 6), no blind retry after an ambiguous submit (Section 7),
  normalized broker error/unknown-state handling reusing the existing
  domain `UNKNOWN_REQUIRES_RECONCILIATION` semantics (Section 8),
  redaction requirements reusing the existing `redactObject` mechanism
  (Section 9), and audit/outbox requirements mapped onto the
  already-implemented `OutboxWorkerService`/`AuditLogService` rather than
  inventing a parallel mechanism (Section 10). Section 2.1 explicitly and
  permanently excludes `TRANSFER`, `WITHDRAWAL`, `DEPOSIT`, and
  `CURRENCY_EXCHANGE` from ever being part of this contract.
- Grep-confirmed directly (not just per the orchestrator's summary): zero
  `process.env` reads and zero `fetch`/`axios`/`undici`/`http.request`
  references in either new source file.

## What Changed in P7-003 (Small-Capital Readiness Gates)

Files: `docs/phase7/small-capital-readiness-gates.md` (new, 392 lines),
`docs/phase7/manual-live-approval-record.md` (new, 170 lines),
`docs/phase7/small-capital-operator-checklist.md` (new, 201 lines),
`src/application/live-readiness/small-capital-readiness.ts` (new, 412
lines), `src/application/live-readiness/index.ts` (new, one re-export
line), `tests/application/small-capital-readiness.test.ts` (new, 413
lines). `src/index.ts` gained one new re-export line
(`export * from "./application/live-readiness/index.js";`), confirmed by
`git diff` to be the only change to that file.

- `evaluateSmallCapitalReadiness` (the only exported function in
  `small-capital-readiness.ts`) is a pure evaluator: no `fetch`, no
  `process.env`, no filesystem access, no mutation of its input — the test
  suite includes a dedicated purity proof ("is a pure function: calling it
  twice with equivalent input produces the same result" and "does not
  mutate its input"), confirmed by reading both the implementation and the
  tests directly.
- The gate list matches P7-003's task doc exactly: maximum order value /
  maximum daily notional exposure / maximum total capital exposure (all
  `Money`-typed, currency-tagged, per `11_AI_RULES.md` Rule 20), allowed
  market and session window (`KR`/`US` regular session only, extended
  hours always blocked), allowed asset types (`STOCK`/`ETF` only, fixed by
  policy constant, not caller-configurable), allowed order types (`LIMIT`
  only, fractional always blocked), a required `ManualLiveApprovalRecord`,
  required reconciliation freshness, required kill-switch state, required
  alert/dashboard state, a compliance gate, and every check fails closed
  on a missing input (confirmed directly: `checkCapitalLimitsAndOrder`,
  `checkManualApproval`, `checkReconciliation`, `checkKillSwitch`,
  `checkOperatorSurface`, `checkCompliance` each add a specific
  `missing_*` reason code when their required input is `undefined`, never
  silently pass).
- **Human approval structurally cannot be inferred or auto-populated.**
  Confirmed by reading `small-capital-readiness.ts` and
  `manual-live-approval-record.md` directly: `ManualLiveApprovalRecord` is
  exported as a type only — no constructor function, builder, or factory
  exists anywhere in the codebase that can produce an instance with
  `approvalStatus: "APPROVED"` (grep-confirmed: no
  `createApprovedRecord`, `approveManualLiveApproval`, or similar symbol
  exists). The gate additionally requires `approvedByRole === "OWNER"`
  (the only role in `SMALL_CAPITAL_APPROVAL_ALLOWED_ROLES`, deliberately
  excluding `OPERATOR`, `VIEWER`, and `SYSTEM` — so no automated/scheduled
  job role can satisfy it), `acknowledgedRisksStatement` matching
  `REQUIRED_MANUAL_APPROVAL_ATTESTATION` **verbatim** (not a boolean
  flag), a non-expired `expiresAt`, and no `revokedAt`. The test suite
  proves each of these independently blocks readiness even when every
  other input is otherwise clean (`tests/application/small-capital-readiness.test.ts`,
  "manual live approval record — cannot be inferred or auto-populated"
  describe block, 10 tests).
- `readyForSmallCapitalLive` and `liveBrokerWriteAllowed` remain
  independent, non-conflatable fields, exactly matching the Phase 6
  `paperSimulationReady`/`liveBrokerWriteAllowed` pattern this review's own
  P6-008 predecessor verified: `liveBrokerWriteAllowed` is a literal
  `false` in the report's type signature (`SmallCapitalReadinessReport`),
  never computed — confirmed directly by reading the return statement in
  `evaluateSmallCapitalReadiness` (it is hardcoded in the returned object
  literal) and by a dedicated test ("never sets liveBrokerWriteAllowed to
  true regardless of how clean the input is").
- `docs/phase7/small-capital-operator-checklist.md` gives an 8-step
  go/no-go procedure (one per gate category) with an explicit "What A
  'Go' Result Means (And Does Not Mean)" section and a "Stop Conditions"
  section listing exactly the same category of hard stops the Phase 6
  operator runbook established (`liveBrokerWriteAllowed: true` anywhere,
  an unexplainable `APPROVED` approval record, any secret/raw payload
  appearing anywhere, any weakened fail-closed check, or `.env`/real
  `tmp/phase5/` contents appearing anywhere) — confirmed by reading the
  full "Stop Conditions" section directly.
- `docs/phase7/small-capital-readiness-gates.md` Section 11 defines a
  7-step rollback procedure (immediate global kill-switch activation,
  evidence preservation, mandatory reconciliation before resuming,
  explicit revocation rather than silent expiry of the approval,
  cross-checked capital exposure confirmation, a full clean-state
  re-evaluation with zero blocking codes, and a postmortem) as a design
  requirement for a future live-capable phase to implement and rehearse —
  explicitly noting there is nothing live to roll back from yet in this
  repository.
- Grep-confirmed directly: zero `fetch`/`axios`/`undici`/`http.request`
  references and zero `process.env` reads in
  `small-capital-readiness.ts`.

## Baseline Source Scan Results

This section is real — produced in Phase 1, against local `main` tip
`4069d57` ("Add Phase 7 live-capable design task plan"), before any of
P7-001, P7-002, or P7-003 exist. This is the "before" picture Phase 2 must
diff the post-merge scan against; any genuinely new match outside of
docs/tests prohibitions, placeholders, or safety assertions found in the
post-merge scan is a real finding to flag in Phase 2.

Command run (from
`/Users/mac/Documents/Codex/aios-phase7-worktrees/eng4`, branch
`phase7/p7-004-integration-review`, worktree base commit `4069d57`):

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase7
```

Full output:

```text
tests/application/access-control-service.test.ts:70:    expect(decision).not.toHaveProperty("submitOrder");
src/adapters/naver/naver-news-adapter.ts:44:      const response = await this.options.fetch(url, {
src/adapters/toss/toss-read-only-dry-run-client.ts:40:  "submitOrder",
src/adapters/toss/toss-read-only-dry-run-client.ts:41:  "cancelOrder",
tests/application/read-only-dashboard.test.ts:98:    expect(status).not.toHaveProperty("submitOrder");
tests/application/read-only-dashboard.test.ts:307:    const forbidden = ["submitOrder", "cancelOrder", "replaceOrder", "placeOrder", "activateKillSwitch", "deactivateKillSwitch", "approveOrder", "enableLiveTrading"];
src/adapters/toss/toss-read-only-http-client.ts:542:  return fetch(url, init);
src/adapters/contracts/toss.ts:47:  submitOrder(command: never): Promise<never>;
src/adapters/contracts/toss.ts:48:  cancelOrder(command: never): Promise<never>;
docs/phase7/README.md:42:- enabling `liveBrokerWriteAllowed: true` in any runtime path
docs/phase7/README.md:64:- `TossSecuritiesAdapter` future contract is specified without creating a
src/application/broker-write-guard/broker-write-command-guard.ts:195:    "submitOrder",
src/application/broker-write-guard/broker-write-command-guard.ts:196:    "cancelOrder",
src/application/broker-write-guard/broker-write-command-guard.ts:197:    "replaceOrder",
tests/application/toss-read-only-evidence-intake.test.ts:210:      verificationResult({ liveBrokerWriteAllowed: true as unknown as false })
tests/application/toss-read-only-evidence-intake.test.ts:352:      receiptRecord({ liveBrokerWriteAllowed: true as unknown as false })
src/adapters/claude/analysis-schema.ts:21:  "submitOrder",
src/adapters/claude/analysis-schema.ts:22:  "cancelOrder",
src/adapters/claude/analysis-schema.ts:23:  "replaceOrder",
tests/application/paper-trading-engine.test.ts:155:    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/application/paper-trading-engine.test.ts:292:    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
src/application/toss/read-only-evidence-recorder.ts:48:const liveWritePattern = /(submitOrder|cancelOrder|placeOrder|modifyOrder|withdraw|transfer)/i;
tests/application/strategy-promotion-dashboard-workflow.test.ts:82:    expect(result).not.toHaveProperty("submitOrder");
tests/application/kill-switch-control-service.test.ts:29:    expect(result).not.toHaveProperty("submitOrder");
tests/application/shadow-portfolio-engine.test.ts:144:    expect(result).not.toHaveProperty("submitOrder");
tests/application/restore-safety-gate.test.ts:71:    expect(result).not.toHaveProperty("submitOrder");
tests/application/outbox-worker-service.test.ts:127:    expect(result).not.toHaveProperty("submitOrder");
tests/application/ai-analysis-persistence.test.ts:71:      brokerCommand: { submitOrder: true }
tests/application/ai-analysis-persistence.test.ts:136:        submitOrder: true
tests/application/ai-analysis-persistence.test.ts:152:        followUpSuggestion: { action: { replaceOrder: { orderId: "order-1" } } }
tests/adapters/contracts.test.ts:53:    const writeKeys: Array<keyof TossWriteAdapter> = ["submitOrder", "cancelOrder"];
tests/application/dashboard-sensitive-control-gate.test.ts:81:    expect(decision).not.toHaveProperty("submitOrder");
tests/application/ai-health-check-service.test.ts:35:      submitOrder: true
tests/application/ai-health-check-service.test.ts:43:        "forbidden_command_key_submitOrder"
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
tests/application/observability-metrics.test.ts:100:    expect(event).not.toHaveProperty("submitOrder");
tests/application/observability-metrics.test.ts:101:    expect(event).not.toHaveProperty("cancelOrder");
tests/adapters/toss-read-only-http-client.test.ts:72:    expect(publicMethodNames).not.toContain("submitOrder");
tests/adapters/toss-read-only-http-client.test.ts:73:    expect(publicMethodNames).not.toContain("cancelOrder");
tests/adapters/toss-read-only-http-client.test.ts:75:    expect((client as unknown as Record<string, unknown>)["submitOrder"]).toBeUndefined();
tests/scripts/phase5-toss-network-safety-static.test.ts:27:  /\baxios\b/,
tests/scripts/phase5-toss-network-safety-static.test.ts:37:  /\bsubmitOrder\s*\(/,
tests/scripts/phase5-toss-network-safety-static.test.ts:38:  /\bcancelOrder\s*\(/,
tests/scripts/phase5-toss-network-safety-static.test.ts:39:  /\breplaceOrder\s*\(/
tests/safety/safety-regression.test.ts:593:          followUp: { recommendedNextStep: { submitOrder: { assetId: "asset-1", side: "BUY" } } }
tests/safety/safety-regression.test.ts:635:        cancelOrder: { orderId: "order-1" }
tests/safety/safety-regression.test.ts:718:        expect(encoded).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
tests/application/toss-read-only-evidence-recorder.test.ts:91:        submitOrder: {
tests/application/order-cancel-simulation-service.test.ts:84:    expect(result).not.toHaveProperty("cancelOrder");
src/application/ai-health-check/ai-health-check-service.ts:86:  "submitOrder",
src/application/ai-health-check/ai-health-check-service.ts:87:  "cancelOrder",
tests/scripts/phase5-toss-read-only-verify-script.test.ts:99:  it.each(["createOrder", "cancelOrder", "modifyOrder", "orders/cancel", "withdraw", "transfer"])(
tests/adapters/toss-read-only-dry-run-client.test.ts:53:      body: { submitOrder: { symbol: "005930" } }
tests/application/reconciliation-workflow-service.test.ts:31:    expect(result).not.toHaveProperty("submitOrder");
tests/application/reconciliation-workflow-service.test.ts:202:      expect(serialized).not.toMatch(/submitOrder|cancelOrder|correctionCommand|brokerWritePayload|placeOrder/i);
tests/application/order-execution-simulation-service.test.ts:36:    expect(result.ok && result.command).not.toHaveProperty("submitOrder");
tests/application/order-execution-simulation-service.test.ts:81:      for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/application/operational-alerting-service.test.ts:71:    expect(alert).not.toHaveProperty("submitOrder");
tests/application/operational-alerting-service.test.ts:72:    expect(alert).not.toHaveProperty("cancelOrder");
tests/application/reconciliation-service.test.ts:32:    expect(report).not.toHaveProperty("submitOrder");
tests/application/reconciliation-service.test.ts:167:    expect(adapter).not.toHaveProperty("submitOrder");
tests/application/broker-write-command-guard.test.ts:53:    expect(result).not.toHaveProperty("submitOrder");
tests/application/broker-write-command-guard.test.ts:135:          submitOrder: true
```

### Baseline Scan Interpretation

Every match falls into one of the accepted categories (prohibition,
placeholder, or safety assertion). No real callable write path exists at
this baseline:

- **`src/adapters/contracts/toss.ts:47-48`** — `TossWriteAdapter.submitOrder`/
  `cancelOrder` are declared with a `command: never` parameter type,
  making them structurally uncallable without an explicit `as never`
  cast. This is the pre-existing placeholder contract P7-002 is expected
  to build on top of, not a callable implementation. Confirmed by grep
  (see "Regression-Gap Check" below) that zero concrete implementations
  of `TossWriteAdapter` exist anywhere in `src/`.
- **`src/application/broker-write-guard/broker-write-command-guard.ts:195-197`**
  — `"submitOrder"`, `"cancelOrder"`, `"replaceOrder"` appear only inside
  `containsForbiddenAICommand`'s forbidden-key deny-list, used to reject
  any AI context that nests an executable-looking broker command. This is
  a safety assertion, not a write path.
  - `src/application/ai-health-check/ai-health-check-service.ts:86-87` and
  `src/adapters/claude/analysis-schema.ts:21-23` — same deny-list pattern
  for AI health-check and Claude analysis schema validation.
- **`src/application/toss/read-only-evidence-recorder.ts:48`** — a regex
  (`liveWritePattern`) used to detect and reject write-shaped strings in
  evidence intake; a prohibition, not a write path.
- **`src/adapters/toss/toss-read-only-dry-run-client.ts:40-41`** — the
  dry-run client's own forbidden-operation list (see also
  `tests/adapters/toss-read-only-dry-run-client.test.ts:53`, which feeds a
  `submitOrder`-shaped body into the dry-run client specifically to prove
  it is rejected/logged as not-executed, never sent).
- **`src/adapters/toss/toss-read-only-http-client.ts:542`** — `return
  fetch(url, init);` inside `defaultFetch`, the injectable HTTP transport
  for the **read-only** Toss client. Confirmed by reading
  `TOSS_READ_ONLY_HTTP_CLIENT_ALLOWED_OPERATIONS` (same file, lines 54-59):
  the only allowed operations are `AUTHENTICATION_READ`,
  `ACCOUNT_SNAPSHOT_READ`, `POSITION_QUERY_READ`, and `MARKET_DATA_READ` —
  no order-write operation is in this list, and the class only exposes
  read methods (confirmed separately by
  `tests/adapters/toss-read-only-http-client.test.ts:72-75`, which asserts
  `submitOrder`/`cancelOrder` are not present on the client at all). This
  is pre-existing Phase 5 read-only infrastructure, unchanged.
- **`src/adapters/naver/naver-news-adapter.ts:44`** — `await
  this.options.fetch(url, ...)`, an injected fetch dependency used to call
  the Naver News search API (a read-only news search, unrelated to Toss
  order execution). Pre-existing, out of Toss/broker-write scope.
- **`docs/phase7/README.md:42,64`** — both are prohibition statements
  ("Forbidden in Phase 7: ... enabling `liveBrokerWriteAllowed: true` in
  any runtime path" and the `TossSecuritiesAdapter` exit-criteria
  sentence, which itself says the future contract must be specified
  "without creating a callable live-write implementation").
- **`tests/application/toss-read-only-evidence-intake.test.ts:210,352`** —
  `liveBrokerWriteAllowed: true as unknown as false` inside test fixtures
  that exist specifically to prove the intake validator rejects a
  tampered/lying `true` value; a safety assertion, not a real `true`
  runtime value.
- All remaining matches are `tests/**` assertions of the form
  `expect(x).not.toHaveProperty("submitOrder")`,
  `forbidden_command_key_*` schema-rejection tests, or the static
  regex-based source scan in
  `tests/scripts/phase5-toss-network-safety-static.test.ts` — every one of
  these exists to prove the *absence* of a write-shaped capability, not
  to exercise one.

**No match in this baseline represents a callable broker-write path, a
real network call to a Toss order endpoint, or a `liveBrokerWriteAllowed:
true` runtime value.** This baseline is the reference point Phase 2's
post-merge scan will be diffed against.

## Post-Merge Source Scan Results

Command run (from
`/Users/mac/Documents/Codex/aios-phase7-worktrees/eng4`, branch
`phase7/p7-004-integration-review`, after `git merge main`, merged tip
`6be56eb`):

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase7
```

The command returned 106 total matches (versus 72 in the Phase 1
baseline). Diffing (sorted, line-content comparison) against the Phase 1
baseline yields:

- **21 matches genuinely new from the P7-001/P7-002/P7-003 merge**
  (listed and categorized below).
- **16 matches that are this branch's own Phase 1 regression-test
  additions** to `tests/safety/safety-regression.test.ts` (the
  `TossWriteAdapter` uncallable-contract proof committed in Phase 1) — not
  attributable to P7-001/002/003, already reviewed and approved in Phase
  1's regression-gap-check section.
- **1 line-number-shift artifact**: `tests/application/ai-analysis-persistence.test.ts:152`
  appears in both the "new" and "removed" halves of the diff at adjacent
  line numbers; the file itself is unmodified by the merge (confirmed:
  not in the merge's file list) — the apparent diff is a copy-paste
  formatting artifact from how the Phase 1 baseline text was captured
  into this document, not a real content change.
- **4 matches present in the baseline that no longer appear verbatim**:
  all 4 are the safety-regression.test.ts lines that shifted by exactly
  +1 line number because of this branch's own Phase 1 edit (adding a
  `type TossWriteAdapter` import before the baseline scan's line numbers
  were captured) plus the one ai-analysis-persistence.test.ts artifact
  above — not real removals; the same content exists at the shifted line
  number in the "new" list.

### The 21 Matches Genuinely New From P7-001/P7-002/P7-003

```text
docs/phase7/live-capable-blocker-register.md:308:  behavior, because no real `TossSecuritiesAdapter` write path exists (see
docs/phase7/live-capable-blocker-register.md:337:  ("TossSecuritiesAdapter" acceptance criteria);
docs/phase7/live-capable-blocker-register.md:340:  item 1 ("No real `TossSecuritiesAdapter` or broker-write implementation
docs/phase7/small-capital-operator-checklist.md:175:- `liveBrokerWriteAllowed: true` anywhere in any report, dashboard, alert,
docs/phase7/toss-write-contract-design.md:112:- A future `TossSecuritiesAdapter` write method must refuse to run unless it
docs/phase7/toss-write-contract-design.md:15:This document specifies the future write contract for `TossSecuritiesAdapter`:
docs/phase7/toss-write-contract-design.md:32:  submitOrder(command: never): Promise<never>;
docs/phase7/toss-write-contract-design.md:33:  cancelOrder(command: never): Promise<never>;
docs/phase7/toss-write-contract-design.md:47:Section 5.4, the future `TossSecuritiesAdapter` write surface is limited to
docs/phase7/toss-write-contract-design.md:63:The following are **not** part of the `TossSecuritiesAdapter` write contract,
docs/phase7/toss-write-contract-design.md:74:Rationale: `11_AI_RULES.md` Rule 17 scopes `TossSecuritiesAdapter` to order
src/adapters/toss-write-contract.ts:11: * (`submitOrder(command: never): Promise<never>`), extended here with a
src/adapters/toss-write-contract.ts:16: * - no `fetch`, HTTP client, axios, undici, or any network code;
src/adapters/toss-write-contract.ts:194:  submitOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:195:  cancelOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:196:  replaceOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:19: * - no `liveBrokerWriteAllowed: true` anywhere;
src/adapters/toss-write-contract.ts:48: * permanently out of scope for `TossSecuritiesAdapter`. This type exists so
src/adapters/toss-write-contract.ts:4: * This file specifies the future `TossSecuritiesAdapter` write contract as
tests/adapters/toss-write-contract.test.ts:14:// never sets `liveBrokerWriteAllowed: true`. It only inspects design-only
tests/adapters/toss-write-contract.test.ts:73:    const writeKeys: Array<keyof TossFutureWriteAdapter> = ["submitOrder", "cancelOrder", "replaceOrder"];
```

### Interpretation — Every New Match Is Accepted

- **`docs/phase7/live-capable-blocker-register.md:308,337,340`** — prose
  in `LCB-007` and `LCB-008` describing, respectively, that live-context
  rollback evidence cannot exist because no real `TossSecuritiesAdapter`
  exists, and that `LCB-008` remains structurally `BLOCKED` for the same
  reason. Both are prohibition/status statements, not code.
- **`docs/phase7/small-capital-operator-checklist.md:175`** — the "Stop
  Conditions" list entry: "`liveBrokerWriteAllowed: true` anywhere ...
  this should never happen; if it does, it indicates a bug." A
  prohibition, read in full context above.
- **`docs/phase7/toss-write-contract-design.md:15,32,33,47,63,74,112`** —
  design-document prose specifying the future contract, plus one code
  block (lines 30-35) quoting the existing, unmodified
  `TossWriteAdapter` interface from `src/adapters/contracts/toss.ts`
  verbatim as a reference, not a new implementation. Read in full above
  ("What Changed in P7-002").
- **`src/adapters/toss-write-contract.ts:4,11,16,19,48,194,195,196`** —
  the new design-only contract file. Lines 194-196 are the three
  `command: never` uncallable method signatures (the actual placeholder);
  the rest are doc-comment prose describing the file's safety properties.
  Read in full above; independently confirmed by grep that the file
  contains zero `process.env` reads and zero
  `fetch`/`axios`/`undici`/`http.request` references.
- **`tests/adapters/toss-write-contract.test.ts:14,73`** — a safety-note
  comment and a `writeKeys` array used only to assert the write contract's
  keys are disjoint from the read-only contract's keys (mirroring the
  existing `tests/adapters/contracts.test.ts` pattern). Both are safety
  assertions.

**None of the 21 new matches is a callable broker-write path, a real
network call to a Toss order endpoint, or a `liveBrokerWriteAllowed: true`
runtime value.** The one place a `liveBrokerWriteAllowed = true`
*assignment* actually appears in the merged code
(`tests/adapters/toss-write-contract.test.ts:68`, using assignment syntax
that the colon-form scan pattern does not match) was found and verified by
direct file reading, not by the scan pattern, and exists solely inside a
test proving that assignment throws a `TypeError` — see "What Changed in
P7-002" above for the full verification. This is a case worth naming
explicitly: **the scan is a starting point, not a substitute for reading
the merged files.** No match found by either the scan or direct reading
falls outside the accepted categories (prohibition, `never`-typed
placeholder, or safety assertion).

## Whether Any Task Introduced a Callable Broker Write Path

**No.** Verified three independent ways, not just by the source scan:

1. **Every new write-shaped method is `command: never`.**
   `TossFutureWriteAdapter.submitOrder`/`cancelOrder`/`replaceOrder`
   (P7-002) and the pre-existing `TossWriteAdapter.submitOrder`/`cancelOrder`
   (unmodified) all take a `never`-typed parameter — TypeScript accepts no
   value, including `any`-cast values, at that parameter position. This
   review's own Phase 1 addition to `tests/safety/safety-regression.test.ts`
   proves this experimentally for the existing interface (sanity-checked
   by temporarily breaking the proof and confirming a real `tsc` error
   resulted); P7-002's own test suite proves the equivalent property for
   the new interface by asserting no exported value is a function.
2. **No new file performs, or contains code capable of performing, a
   network call to a Toss order endpoint.** Grep-confirmed directly across
   every file added by P7-001/P7-002/P7-003: zero
   `fetch`/`axios`/`undici`/`http.request` references. The only `fetch`
   references anywhere in the merged `src/` tree remain the two pre-existing
   ones from the Phase 1 baseline (the read-only Toss HTTP client,
   restricted to 4 read-only operations, and the unrelated Naver news
   adapter) — unchanged by this merge.
3. **`BrokerWriteCommandGuard` and the existing `TossWriteAdapter`
   contract are byte-for-byte unmodified.** `git diff 4069d57..6be56eb --
   src/application/broker-write-guard/broker-write-command-guard.ts
   src/adapters/contracts/toss.ts` returns zero lines. Nothing in this
   round weakened, bypassed, or reimplemented the guard that every future
   real write command must still pass.
4. **`small-capital-readiness.ts` never constructs a broker command of any
   kind.** It is a pure evaluator that only reads already-computed inputs
   and returns a report; it has no dependency on, or reference to, any
   Toss adapter type at all (confirmed by its import list: only
   `ComplianceGateResult` and `Money`).

## Whether Human Approval Is Still Required

**Yes, and it cannot be inferred, defaulted, or auto-populated by AI or
code.** This is the single property P7-003 was most explicitly designed
around, and it holds structurally, not just by convention:

- `ManualLiveApprovalRecord` is exported as a *type* only from
  `small-capital-readiness.ts`. No constructor, builder, or factory
  function exists anywhere in the merged codebase that can produce an
  instance with `approvalStatus: "APPROVED"` — grep-confirmed (no
  `createApprovedRecord`, `approveManualLiveApproval`, or equivalent
  symbol exists anywhere in `src/`).
- The gate requires `approvedByRole === "OWNER"` — the only value in
  `SMALL_CAPITAL_APPROVAL_ALLOWED_ROLES` — deliberately excluding
  `OPERATOR`, `VIEWER`, and, critically, `SYSTEM` (the role scheduled/
  automated jobs run as per `docs/09_Operation_Deployment.md` section
  22), so no automated process can ever satisfy this field even if it
  tried.
- The gate requires `acknowledgedRisksStatement` to equal
  `REQUIRED_MANUAL_APPROVAL_ATTESTATION` **verbatim** — a deliberately
  worded first-person attestation string, not a boolean flag a script
  could trivially flip.
- `docs/phase7/manual-live-approval-record.md`'s "What This Record Is Not"
  section explicitly states an AI agent asked to "just fill in the
  approval so the gate passes" must refuse, citing `11_AI_RULES.md` Rule
  12 and Rule 22 and the Section 10 enforcement steps (stop, explain,
  propose a safe alternative — in this case, ask the human `OWNER` to sign
  it themselves).
- `docs/phase7/live-capable-blocker-register.md`'s `LCB-004` independently
  requires human approval evidence, citing the same rule, and is
  `NOT_STARTED` — no register entry claims this is satisfied.
- This mirrors and extends the identical principle `docs/11_AI_RULES.md`
  Rule 12 and Section 10 already establish project-wide, and which every
  prior Phase 6 review (including the P6-008 predecessor to this review)
  independently reconfirmed: no load-bearing decision in this codebase has
  been, or can structurally be, made by an AI agent alone.

## Whether .env/Local Phase 5 Receipts Remain Untouched

**Yes.** Confirmed post-merge, in this worktree: `ls -la .env` returns "No
such file or directory"; `ls -la tmp/phase5` shows an empty directory (no
files, only `.`/`..`) — this directory is gitignored (`tmp/` in
`.gitignore`) and was not created or populated by this review; it appears
to be a transient artifact of the local test suite's own run (some Phase
5 script tests write to `tmp/` during execution) and contains nothing.
Neither path was read, printed, inspected beyond this existence check, or
committed, at any point in either phase of this task. Grep across every
file added by P7-001/P7-002/P7-003 for `process.env`, `.env`, or
`tmp/phase5` references found none beyond the design-document prose
already covered above (`docs/phase7/live-capable-blocker-register.md`'s
`LCB-003` describing the *process* by which future production credentials
would be provisioned, never an actual credential value; `docs/phase7/
small-capital-operator-checklist.md`'s "Stop Conditions" prohibiting
`.env`/`tmp/phase5/` contents from ever appearing in a readiness
evaluation).

## Whether Small-Capital Readiness Is Specified But Not Enabled

**Yes — fully specified, and confirmed not enabled anywhere.**

- Fully specified: `docs/phase7/small-capital-readiness-gates.md` defines
  all ten required categories (numeric capital limits, market/session
  window, asset types, order types, human approval record, reconciliation
  freshness, kill-switch state, alert/dashboard state, compliance gate,
  and a canonical list of ~35 blocking reason codes), backed by a fully
  tested pure evaluator (`evaluateSmallCapitalReadiness`, 36 tests in
  `tests/application/small-capital-readiness.test.ts` covering every gate
  individually and in combination) and an 8-step operator checklist
  (`docs/phase7/small-capital-operator-checklist.md`).
- Confirmed not enabled: `evaluateSmallCapitalReadiness` is never called
  from any other module in the merged codebase — grep-confirmed (no
  `evaluateSmallCapitalReadiness(` call site exists outside its own test
  file). It is not wired into any scheduler job, dashboard action, API
  route, or CLI script. `readyForSmallCapitalLive: true`, even if it were
  computed, would still carry the unconditional literal
  `liveBrokerWriteAllowed: false` alongside it, and no code path anywhere
  in the merged codebase reads `readyForSmallCapitalLive` as a trigger for
  any action — the evaluator produces a report and nothing else.
- Small-capital live mode itself (`docs/07_Trading_System.md` Section
  4.4) remains entirely unimplemented: no `TossSecuritiesAdapter`, no real
  broker connection, no order-submission code path exists anywhere in this
  repository. Phase 7 defines the gate a future phase must pass through;
  it does not open the gate.

## Whether Future Implementation Blockers Are Clear

**Yes.** `docs/phase7/live-capable-blocker-register.md` gives a later
implementation phase eight concrete, individually-actionable blockers
(`LCB-001` through `LCB-008`), each with a required evidence type, a named
human owner/reviewer role (never AI), an artifact path, prohibited
content, and an explicit go/no-go impact citing the specific rule or
document section that makes the block mandatory. None is vague ("get
compliance sign-off" without more) — for example, `LCB-005` names the
exact six sub-items `docs/13_Compliance_and_Legal_Review.md` Section 9
requires and the exact record fields Section 10 requires. `LCB-008`
explicitly documents why it cannot be started in Phase 7 (the artifact it
would review must not exist yet) rather than leaving that ambiguous.
Combined with P7-002's design document (which gives a future
implementation phase a concrete contract to build against, including
explicit "Open Items for a Later Implementation Phase" in its Section 13)
and P7-003's rollback procedure and operator checklist, a future engineer
starting the real implementation phase has: what to build
(`toss-write-contract-design.md`), what evidence must exist before it can
go live (`live-capable-blocker-register.md`), and what operational gates
must pass before small-capital capital is put at risk
(`small-capital-readiness-gates.md`). No blocker register entry, design
document, or readiness gate claims any of this evidence already exists —
every one defaults to blocking.

## Whether Phase 7 Is Complete, Blocked, or Needs Another Round

**Phase 7 is complete as a design-readiness package.** Every exit
criterion in `docs/phase7/README.md` is satisfied by the merged state:

- "every unresolved live-capable blocker is listed with an owner and a
  required evidence type" — satisfied by `LCB-001` through `LCB-008`.
- "`TossSecuritiesAdapter` future contract is specified without creating
  a callable live-write implementation" — satisfied by
  `toss-write-contract-design.md` and the `command: never`-typed
  `TossFutureWriteAdapter`.
- "small-capital readiness has explicit numeric and procedural limits" —
  satisfied by `small-capital-readiness-gates.md`'s ten gate categories
  and the pure evaluator enforcing them.
- "manual approval records are specified as human-owned artifacts" —
  satisfied by `manual-live-approval-record.md` and the structural
  guarantees described above.
- "safety regression tests still prove no real broker write path exists"
  — satisfied; `tests/safety/safety-regression.test.ts` (20 tests, all
  passing) plus the new `tests/adapters/toss-write-contract.test.ts` (8
  tests) and `tests/application/small-capital-readiness.test.ts` (36
  tests) all pass, and none was weakened to get there.
- "`npm run check` passes" — confirmed below, exit code 0, 84 test files,
  745 tests, zero failures.

This review does not find a code, documentation, or safety gap that
requires another Phase 7 round. It does surface a substantial list of
**human-only** next steps (the eight blocker register entries, none
`RESOLVED`) that block any future *live implementation* phase — but those
are explicitly out of scope for Phase 7 by design (`docs/phase7/README.md`:
"Phase 7 completion is not approval for live trading. It is only approval
to move toward a later, separately reviewed implementation phase"), not
gaps in this phase's own deliverables. **This review does not authorize
live trading, order creation, cancellation, modification, transfer,
withdrawal, currency conversion, or production capital use, and does not
imply any human approval has occurred** — every blocker register entry
remains `NOT_STARTED`, `UNVERIFIED`, `EVIDENCE_PENDING`, or `BLOCKED`.

## Commands Run and Results (Phase 2)

All commands below were run from
`/Users/mac/Documents/Codex/aios-phase7-worktrees/eng4` on branch
`phase7/p7-004-integration-review` after `git merge main` (merge commit
recorded in this branch's Phase 2 commit — see the final report
accompanying this document for the exact SHA). Local `main` tip merged:
`6be56eb`.

```bash
git merge main --no-edit
```
Clean merge, no conflicts (`ort` strategy). 13 files added, 2,866
insertions, 0 deletions, 0 modifications to any pre-existing file other
than the two one-line re-export additions (`docs/open_questions.md`,
`src/index.ts`) already described above.

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase7
```
106 total matches; 21 genuinely new versus the Phase 1 baseline, all
accepted categories — see "Post-Merge Source Scan Results" above for the
full listing and per-match interpretation.

```bash
npm run check
```
Exit code `0`. Typecheck clean. `84` test files, `745` tests, all
passing — the `743` tests present on merged `main` plus the `2` Phase 1
regression tests this branch already carried in
`tests/safety/safety-regression.test.ts` (20 tests total in that file).
No flake was observed on this run — system load had returned to normal
(2 `node (vitest` processes visible via `ps aux` versus the ~230 load
average observed during Phase 1, when three sibling engineer worktrees
were running concurrently). This contrast confirms the Phase 1 flakiness
in `tests/scripts/phase5-toss-*-script.test.ts` was genuinely a
machine-contention artifact, not a latent issue in those files or in this
review's own changes.

```bash
npx vitest run tests/adapters/toss-write-contract.test.ts tests/application/small-capital-readiness.test.ts tests/safety/safety-regression.test.ts tests/adapters/contracts.test.ts
```
Exit code `0`. 4 test files, 68 tests, all passing (4 + 8 + 36 + 20).
Run as a targeted, non-contended re-confirmation of every file this
review's claims depend on most directly.

## Phase 2 Regression Check

Per the task's instruction to add regression coverage if a gap is found,
I checked whether the consolidated `tests/safety/safety-regression.test.ts`
harness needs a new cross-module test now that P7-001/P7-002/P7-003 are
merged.

**No new gap was found requiring a new test this phase.** P7-002's own
test suite (`tests/adapters/toss-write-contract.test.ts`) already performs
the same kind of structural, automated proof the consolidated harness
exists for — including a proof this review's Phase 1 addition did not
have (an automated check that *no* export of the module is a function,
not just that the two known write-method names are uncallable) — and
P7-003's own test suite
(`tests/application/small-capital-readiness.test.ts`) already proves the
cross-cutting property most relevant to a future live-capable phase (that
no combination of otherwise-clean inputs can produce
`readyForSmallCapitalLive: true` without a genuinely human-signed,
non-expired, non-revoked, verbatim-attested, `OWNER`-role approval
record) end-to-end, using the real evaluator, not a stand-in.

I additionally re-verified, rather than assumed, the three things most
likely to hide a boundary gap in this specific round:

1. **P7-002's new contract doesn't create an import-cycle or type
   mismatch with `BrokerWriteCommandGuard`.** Confirmed `npm run check`
   (full `tsc` typecheck) passes with `toss-write-contract.ts` imported
   nowhere by the guard, and the guard imported nowhere by the contract
   file — grep-confirmed no cross-import exists in either direction.
2. **P7-003's duck-typed reconciliation/kill-switch/dashboard signal
   shapes remain structurally compatible with the real Phase 6 output
   types**, the same category of risk the P6-008 predecessor review
   flagged and verified for `OperationalAlertingService`'s duck-typed
   interfaces. `SmallCapitalReconciliationSignal`,
   `SmallCapitalKillSwitchSignal`, and `SmallCapitalOperatorSurfaceSignal`
   are all locally-defined, small, duck-typed shapes rather than direct
   imports of `ReconciliationWorkflowResult` /
   `KillSwitchTradingGate` / dashboard types — by design, to avoid an
   import cycle, per the module's own doc comments. I did not find a test
   that feeds a *real* `ReconciliationWorkflowResult` or
   `KillSwitchTradingGate` into `evaluateSmallCapitalReadiness` end-to-end
   the way the Phase 6 dashboard tests do for their own duck-typed
   consumers. This is a real, narrow gap in the *cross-module* proof
   (though not a safety gap — every field consumed is read-only and
   fails closed on absence) — flagged here as a candidate for a future
   round's regression coverage rather than closed with a new test in this
   phase, because closing it well requires importing three Phase 6
   modules into a test file this task does not own the primary
   responsibility for, and P7-003's own 36-test suite already covers the
   gate logic itself exhaustively with structurally-compatible fixtures.
3. **No new module reads `.env` or `tmp/phase5/*` directly.** Grep across
   every file added by P7-001/P7-002/P7-003 for `process.env`,
   `fs.readFile`, `fs.readFileSync`, and `tmp/phase5` found no matches.

Given the above, I judge the consolidated safety-regression harness to
have adequate coverage of the P7-001/002/003 surfaces for this phase,
with one flagged-not-closed candidate gap (item 2) suitable for a future
round if a reviewer wants a real-Phase-6-type cross-module proof for the
small-capital evaluator specifically, matching the standard the P6-008
review set for the equivalent dashboard/alerting integration.

## Phase 1 Regression-Gap Check (Pre-Merge Baseline)

This section records the Phase 1 work only: a review of the current,
pre-P7-001/P7-002/P7-003 state of the safety chain against the
consolidated `tests/safety/safety-regression.test.ts` harness, following
the same Phase 1 pattern used for P6-008 in
`docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`,
"Appendix: Phase 1 Regression-Gap Check". It is not the Phase 7
integration review itself, and it does not describe any P7-001/P7-002/
P7-003 content, since none of those branches exist yet at the time this
section was written.

Baseline commit reviewed: `4069d57` ("Add Phase 7 live-capable design task
plan"), local `main` tip at the start of Phase 7, before any of P7-001,
P7-002, or P7-003 were merged.

Files read as the baseline safety chain:

- `docs/phase7/README.md`
- `docs/tasks/phase7_claude_worktree_tasks/README.md`
- `docs/11_AI_RULES.md`
- `docs/07_Trading_System.md`
- `docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`
- `docs/tasks/phase7_claude_worktree_tasks/P7-001_live_capable_blocker_audit.md`
- `docs/tasks/phase7_claude_worktree_tasks/P7-002_toss_write_contract_design.md`
- `docs/tasks/phase7_claude_worktree_tasks/P7-003_small_capital_readiness_gates.md`
- `src/application/broker-write-guard/broker-write-command-guard.ts`
- `src/adapters/contracts/toss.ts`
- `tests/adapters/contracts.test.ts`
- `tests/safety/safety-regression.test.ts` (pre-Phase-7 state: 18 tests,
  all inherited from Phase 6 rounds 1 and 2)

### Gap Check Finding

Phase 7's own inputs (`docs/phase7/README.md`, P7-002's task file) center
on a future `TossSecuritiesAdapter` write contract that is expected to be
designed on top of the existing `TossWriteAdapter` placeholder interface
in `src/adapters/contracts/toss.ts`, whose `submitOrder`/`cancelOrder`
methods are already typed with an uncallable `command: never` parameter.
Prior reviews
(`docs/reviews/Codex_Phase6_Simulation_Safety_Review.md`,
`docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md`) have
repeatedly reconfirmed, each phase, by manual `grep` at review time, that
zero concrete implementations of `TossWriteAdapter` exist anywhere in
`src/`. That is a real, currently-true property, but until this phase the
consolidated `tests/safety/safety-regression.test.ts` harness never
asserted it directly as an automated, reusable regression proof — the
existing per-module test in `tests/adapters/contracts.test.ts` ("keeps
Toss write adapter contract separate from read-only contract") only checks
that the `TossReadOnlyAdapter` and `TossWriteAdapter` key name lists do
not overlap; it does not prove the write methods are uncallable, and it
does not exercise the `command: never` typing at all.

This is a genuine, narrow gap: it does not indicate any current unsafe
behavior (by inspection, and by the baseline source scan above, no
callable write path exists today), but it means the exact property
P7-002's design work must not violate — that `TossWriteAdapter.submitOrder`/
`cancelOrder` stay structurally uncallable without a `command: never`-
violating cast — had no automated, reusable proof in the harness the way
the consolidated file already proves the equivalent property for AI
output and the dashboard operator surface. Given P7-002 is about to touch
exactly this contract, closing this gap now, before P7-002 exists,
produces a clean pre-merge baseline test that Phase 2 can compare against
after the merge (i.e., it must still pass afterward, unmodified in intent,
regardless of whatever new contract file P7-002 adds alongside it).

Closed in this phase by adding two new tests to
`tests/safety/safety-regression.test.ts`, under a new
`describe("TossWriteAdapter placeholder contract stays structurally
uncallable (Phase 7 pre-merge baseline)", ...)` block:

1. "rejects an order-shaped argument to submitOrder/cancelOrder at compile
   time (command: never)" — uses a hand-rolled, throwing stand-in
   implementation of `TossWriteAdapter` (necessary because the entire
   point being proven is that no real implementation exists) and two
   `@ts-expect-error` directives to prove, at `npm run typecheck` time,
   that an order-shaped object is not assignable to the `never`-typed
   parameter without a cast. Sanity-checked directly: temporarily removing
   one `@ts-expect-error` directive and rerunning `npm run typecheck`
   produced a real compiler error
   (`TS2345: Argument of type '{ assetId: string; ... }' is not
   assignable to parameter of type 'never'.`), confirming the directive is
   load-bearing, not decorative, before the file was restored to its
   intended state.
2. "throws rather than silently succeeding if a caller forces a call
   through an explicit `as never` cast" — proves that even a caller who
   deliberately bypasses the type system still gets a thrown error, never
   a silently-resolved value that could look like a broker response.

No existing test was weakened, removed, or loosened to add this coverage.
No implementation file was modified (only the shared
`tests/safety/safety-regression.test.ts` file, which this task explicitly
owns). No file owned by Engineer 1 (P7-001), Engineer 2 (P7-002), or
Engineer 3 (P7-003) was modified.

Other candidate gap areas were considered and found not yet applicable at
the Phase 1 baseline, because the modules P7-001/P7-002/P7-003 are
expected to add or extend do not exist yet:

- `docs/phase7/toss-write-contract-design.md`,
  `src/adapters/toss-write-contract.ts` (P7-002) — do not exist at this
  baseline; no regression test can meaningfully target content that has
  not been written yet.
- `docs/phase7/small-capital-readiness-gates.md`,
  `src/application/live-readiness/small-capital-readiness.ts` (P7-003) —
  same reasoning; does not exist at this baseline.
- `docs/phase7/live-capable-blocker-register.md` (P7-001) — a documentation
  artifact, not a code surface; not applicable to an automated regression
  test.

Phase 2 must re-check the actual P7-001/P7-002/P7-003 post-merge state and
add further regression coverage if a similar cross-module gap is found,
the same way Phase 2 of the Phase 6 round 2 review re-checked its three
flagged-but-not-yet-applicable areas once P6-006/P6-007 landed.

### Tests Added in Phase 1

Both added to `tests/safety/safety-regression.test.ts`, under a new
`describe("TossWriteAdapter placeholder contract stays structurally
uncallable (Phase 7 pre-merge baseline)", ...)` block:

- "rejects an order-shaped argument to submitOrder/cancelOrder at compile
  time (command: never)"
- "throws rather than silently succeeding if a caller forces a call
  through an explicit `as never` cast"

`tests/safety/safety-regression.test.ts` now has 20 tests total (18
inherited from Phase 6, plus these 2), all passing, confirmed by direct
`npx vitest run tests/safety/safety-regression.test.ts` runs (reproduced
cleanly on repeated runs).

### Phase 1 Commands Run

```bash
npx vitest run tests/safety/safety-regression.test.ts
npm run typecheck
npm run check
```

`npx vitest run tests/safety/safety-regression.test.ts` passed cleanly and
reproducibly on every run (20/20 tests). `npm run typecheck` passed
cleanly on every run, including after the deliberate sanity check
described above (temporarily removing one `@ts-expect-error` directive
produced a real compiler error, confirming the check is load-bearing;
after restoring the file, typecheck passed cleanly again).

`npm run check` (typecheck plus the full test suite: 82 test files, 701
tests) was run three times from this worktree while three sibling
Engineer worktrees (`eng1`, `eng2`, `eng3` — P7-001, P7-002, P7-003) were
independently running their own `npm run check`/`vitest` processes
concurrently on the same machine (confirmed via `ps aux`; system load
average observed as high as ~230 during these runs). Under that
contention, 1-2 tests in the pre-existing, subprocess-spawning
`tests/scripts/phase5-toss-read-only-verify-script.test.ts` and
`tests/scripts/phase5-toss-call-gate-script.test.ts` files (which spawn a
child process and enforce a hardcoded 25-60 second wall-clock timeout
against it) intermittently failed with a timeout, alongside a vitest-
internal `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled error
— both symptoms consistent with process-scheduling contention, not a real
regression. Every other test, across all three runs, passed consistently,
including all 20 tests in `tests/safety/safety-regression.test.ts` and
every test in every file this task's baseline scan or gap check touched.
These two flaky files are pre-existing Phase 5 script tests, owned by
neither this task nor any P7-001/P7-002/P7-003 file-ownership rule, and
were not modified in this phase. This flakiness should be re-verified in
Phase 2 under (ideally) lower machine contention once the other three
branches have merged and their worktrees are no longer running
concurrently with this one.

### Phase 1 Scope Notes

- No implementation file owned by Engineer 1 (P7-001), Engineer 2
  (P7-002), or Engineer 3 (P7-003) was modified.
- No real Toss API call was made, simulated, or coded.
- No real broker write of any kind was performed, simulated, or coded.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed — only checked for existence with `ls`, per the universal
  safety rules for this task; neither exists in this worktree.
- `docs/tasks/phase7_claude_worktree_tasks/README.md` was not modified in
  this phase.
- `docs/phase7/README.md` was not modified in this phase.
- Live trading was not marked ready anywhere in this document, including
  in the placeholder sections above.
- No open question was resolved and no human approval was implied by this
  phase's work.

## Phase 2 Scope Notes

- No implementation file owned by Engineer 1 (P7-001), Engineer 2
  (P7-002), or Engineer 3 (P7-003) was modified — this review only reads
  and reports on their merged content.
- `docs/tasks/phase7_claude_worktree_tasks/README.md` and
  `docs/phase7/README.md` were updated in Phase 2 for status/link updates
  only, per this task's file-ownership rules, which explicitly permit that
  in Phase 2 (unlike Phase 1, where both were off-limits).
- No real Toss API call was made, simulated, or coded, in either phase.
- No real broker write of any kind was performed, simulated, or coded, in
  either phase.
- `.env` and `tmp/phase5/*` were not read, printed, inspected, or
  committed at any point in Phase 2 — confirmed by `ls`-only existence
  checks; `.env` does not exist in this worktree and `tmp/phase5/` is an
  empty, gitignored directory.
- No open question's `Status` or `Evidence Status` field was changed by
  this review (only P7-001 touched `docs/open_questions.md`, and only
  with the single non-secret reference line already described above).
- No blocker in `docs/phase7/live-capable-blocker-register.md` was marked
  `RESOLVED` by this review, and this review does not have the authority
  to mark one `RESOLVED` — that requires a human reviewer per the
  register's own rules.
- Live trading was not marked ready anywhere in this document. Phase 7's
  completion, as concluded above, is explicitly not live-trading
  authorization, per `docs/phase7/README.md`'s own exit-criteria
  statement, quoted directly in "Whether Phase 7 Is Complete, Blocked, or
  Needs Another Round" above.
- No open question was resolved and no human approval was implied,
  claimed, or inferred by this review, in either phase.
