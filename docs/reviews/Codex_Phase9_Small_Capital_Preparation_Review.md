# Codex Phase 9 Small-Capital Preparation Review

Version: 1.0.0
Status: Complete
Review Date: 2026-07-29
Task: P9-004 Phase 9 Integration Review
Assigned Engineer: Engineer 4

## Purpose

This document records the Phase 9 round 1 integration and
small-capital-preparation-safety review after P9-001 (live blocker
evidence intake), P9-002 (Toss write preflight contract guard), and
P9-003 (small-capital enablement gate) were merged into local `main`. It
follows the same two-phase pattern used for
`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md` and
`docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`: Phase 1
established a pre-merge baseline (source scans, a regression-gap check,
and a scaffold); Phase 2 (this content) performs the full integration
review now that P9-001/P9-002/P9-003 exist and are merged.

Merge commits reviewed (local `main`, never pushed to GitHub):

- `254a963` — Merge Phase 9 Engineer 1: P9-001 live blocker evidence
  intake
- `abe6d64` — Merge Phase 9 Engineer 2: P9-002 Toss write preflight
  contract guard
- `3d977aa` — Merge Phase 9 Engineer 3: P9-003 small-capital enablement
  gate (this merge had one real, expected conflict in
  `src/application/live-readiness/index.ts` — both Engineer 1 and
  Engineer 3 added a barrel-export line; the orchestrator resolved it by
  keeping both lines in alphabetical order, nothing else changed)

Local `main` tip at review time: `3d977aa`. This review was produced from
`phase9/p9-004-integration-review` after merging local `main` into it
(`git merge main`, merge commit `cb1f69f`, clean — no conflicts on this
branch). Every claim below was checked directly against the merged source
in this worktree — the three new source files and their test files — not
inferred from the orchestrator's summary alone.

**This document does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, real cloud deployment, or production capital use — in either
phase. It does not mark any `LCB-001` through `LCB-008` blocker,
compliance item, or human approval as resolved — that remains a
human-only decision in every phase.**

## Phase Status

- Phase 1 (scaffold, baseline source scans, pre-merge regression-gap
  check): complete.
- Phase 2 (full integration review after P9-001/P9-002/P9-003 merge):
  complete.

## Summary

P9-001, P9-002, and P9-003 merged into local `main` cleanly (merge
commits `254a963`, `abe6d64`, `3d977aa`; tip `3d977aa`; one expected
barrel-export conflict in `src/application/live-readiness/index.ts`,
resolved by the orchestrator by keeping both new export lines), and
merged into this review branch with no conflicts (`git merge main`,
`ort` strategy, merge commit `cb1f69f`). `npm run check` passes cleanly
on the merged branch: typecheck clean, 90 test files, 914 tests, all
passing (913 from merged `main` plus 1 this branch already carried
across its own Phase 1, in `tests/safety/safety-regression.test.ts`).

All three branches add pure, side-effect-free evaluators/validators on
top of the existing Phase 5/6/7/8 safety chain, exactly matching their
task docs' scope:

- **P9-001** (`src/application/live-readiness/live-blocker-evidence-intake.ts`)
  is a pure validator for sanitized `LCB-001`..`LCB-008` evidence
  records. All eight blocker ids are represented in a fixed, frozen
  catalog (`LIVE_BLOCKER_IDS`, `LIVE_BLOCKER_CATALOG`). The literal
  string `"RESOLVED"` does not appear anywhere in either status type
  this module can return (`LiveBlockerEvidenceStatus`:
  `"REJECTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED"`;
  `LiveBlockerEvidenceRegisterBlockerStatus` additionally adds
  `"MISSING"`/`"DUPLICATE"`) — confirmed by reading both type
  definitions directly (source lines 258 and 398) and by a dedicated
  test, "never produces the literal status RESOLVED under any input"
  (`tests/application/live-blocker-evidence-intake.test.ts:70-88`), that
  uses a `@ts-expect-error` cast to try to smuggle `result: "RESOLVED"`
  through the type system and confirms `review.status` is never
  `"RESOLVED"`. `LiveBlockerEvidenceRegisterReview.blockerRegisterResolutionAllowed`
  is a hardcoded `false` literal (source line 435), and a second test
  ("never exposes a RESOLVED status or a resolution-allowed flag
  anywhere in the register review", line 317) confirms the serialized
  JSON of a register review never contains the substring `"RESOLVED"`.
  `aiGeneratedSummary` is a distinct, optional field that no check
  reads when deciding `humanReviewed` status (confirmed by reading
  `LiveBlockerEvidenceRecordValidator.review` directly: the field is
  only scanned for prohibited content, never consulted for the
  `status` branch). Reviewer identity fields are checked against a
  disallowed-token pattern (`ai|artificial-intelligence|claude|chatgpt|
  gpt-\d*|codex|anthropic|openai|copilot|assistant|bot|automated|algorithm`)
  and rejected with `human_reviewer_name_looks_non_human` /
  `human_reviewer_role_looks_non_human` reason codes. Every free-text
  field (evidence source references, limitations, reviewer name/role,
  AI summary) is scanned for secret-like, account-identifier-like, raw
  JSON/HTML-payload-like, and HTTP-header-like content, and every match
  is a blocking `reasonCode`, never a warning (confirmed by reading
  `scanForProhibitedContent` directly — it only ever pushes to
  `reasonCodes`, never to `warnings`). The module never imports `fs`,
  never references a path for
  `docs/phase7/live-capable-blocker-register.md`, and performs no
  read/write of any kind against that file (grep-confirmed: zero
  filesystem imports in the source file).
- **P9-002** (`src/adapters/toss-write-preflight.ts`) is a pure,
  synchronous `evaluateTossWritePreflight` function. Fed a fully empty
  input, it returns `ready: false` with all nine `missing_*` reason
  codes populated (`missing_evaluation_time`,
  `missing_live_blocker_evidence`,
  `missing_broker_write_command_guard_result`,
  `missing_kill_switch_recheck`, `missing_reconciliation_state`,
  `missing_idempotency_policy`, `missing_redaction_policy`,
  `missing_error_normalization_policy`, `missing_raw_payload_policy`)
  and never throws — confirmed by reading each `*Reasons` helper
  function directly: every one of the nine checks returns an array
  literal starting with a `missing_*` code when its corresponding input
  is absent, and no branch anywhere in the file returns an empty
  `blockingReasons` array from undefined input. `liveBrokerWriteAllowed`
  is a hardcoded `false` literal in the single return statement (source
  line 210), never computed from `ready` or any other field — confirmed
  by reading the return statement directly, and by tests covering both
  a `ready: true`-shaped clean input and the fully-empty `ready: false`
  input, both asserting `liveBrokerWriteAllowed === false`.
  `git diff 1ed644d..3d977aa -- src/adapters/toss-write-contract.ts src/application/broker-write-guard/broker-write-command-guard.ts`
  returns zero lines — confirmed directly, not just per the task
  summary — both files are consumed only as read-only, type-only
  imports (`import type { ... } from "./toss-write-contract.js"` /
  `"../application/broker-write-guard/broker-write-command-guard.js"`).
  No barrel-export line was added for this module (it follows the
  sibling `toss-write-contract.ts` convention of direct relative-path
  imports — confirmed: `src/adapters/contracts/index.ts` and
  `src/index.ts` show no new export line for this file in the merge
  diff). Grep-confirmed directly across the entire file: zero `fetch`,
  `axios`, `undici`, `process.env`, or HTTP-client references — the
  only appearances of those words are in the module's own doc-comment
  prohibition list (lines 37-41).
- **P9-003** (`src/application/live-readiness/small-capital-enablement-gate.ts`)
  is a pure `evaluateSmallCapitalEnablementGate` function composing
  Phase 7 small-capital readiness, Phase 8 operations/deployment/backup
  readiness, and a Phase 9 live-blocker evidence summary into one
  report. `readyForLiveBrokerWrites` and `liveBrokerWriteAllowed` are
  typed as the TypeScript literal type `false` (not `boolean`) on
  `SmallCapitalEnablementGateReport` (source lines 258, 264) and written
  as bare literals at the single return site (lines 315, 317) — enforced
  at compile time, not just at runtime. A "maximally clean input" test
  (`tests/application/small-capital-enablement-gate.test.ts:350-368`)
  constructs every upstream signal passing and all 8 `LCB-*` blockers
  `HUMAN_REVIEWED` with reviewer name and date, confirms
  `readyForSmallCapitalPreparation: true`, and then confirms
  `readyForLiveBrokerWrites`/`liveBrokerWriteAllowed` are still `false`,
  including a `JSON.stringify(report)` scan for `"readyForLiveBrokerWrites":true`
  and `"liveBrokerWriteAllowed":true` substrings. A companion test
  (line 370) hand-mutates a report copy to `true` for both fields and
  confirms re-running the evaluator on the same clean input always
  re-derives literal `false`, demonstrating the guarantee is about the
  evaluator's own output, not merely an unenforced convention on the
  type. The module never constructs, mutates, or "upgrades" a
  `LiveBlockerEvidenceSummaryEntry.status` to `"HUMAN_REVIEWED"` — that
  value can only arrive as caller-supplied input (confirmed by reading
  `evaluateLiveBlockerEvidenceView` directly: it only ever reads
  `entry.status`, never writes it). Every upstream report's own
  `liveBrokerWriteAllowed` (and, for the backup/restore report,
  `correctiveTradingAllowed`) is defensively re-checked at runtime
  (`(report.liveBrokerWriteAllowed as unknown) !== false`) and treated
  as a blocking condition if tampered, even though this can never make
  *this* report's own literals `true` either way — confirmed by reading
  all four `evaluate*View` helper functions and by four dedicated
  "flags a tampered ... report" tests.

  **Evidence-vocabulary compatibility note (resolved by follow-up):**
  P9-003 originally accepted only
  `status: "NOT_STARTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED"`
  while P9-001's register-level status vocabulary also included
  `"MISSING"`, `"REJECTED"`, and `"DUPLICATE"`. This was safe because it
  failed closed, but it left unnecessary integration friction. A follow-up
  change now imports the P9-001 register blocker status type and treats
  `MISSING`, `REJECTED`, and `DUPLICATE` as explicit blocking preparation
  states. None can become `HUMAN_REVIEWED`, and `RESOLVED` remains outside
  the runtime status vocabulary. Flagging the original finding as a
  concrete follow-up item, not a blocker for Phase 9 round 1's own exit
  criteria (which only requires the two modules to each individually
  fail closed, which both do).

## Baseline Source Scan Results

This section is real — produced in Phase 1, against local `main` tip
`1ed644d` ("Add Phase 9 small-capital preparation task plan"), before any
of P9-001, P9-002, or P9-003 exist. This is the "before" picture Phase 2
must diff the post-merge scan against; any genuinely new match outside of
docs/tests prohibitions, redaction tests, or safety assertions found in
the post-merge scan is a real finding to flag in Phase 2.

Commands run (from
`/Users/mac/Documents/Codex/aios-phase9-worktrees/eng4`, branch
`phase9/p9-004-integration-review`, worktree base commit `1ed644d`,
after the Phase 1 regression-test addition to
`tests/safety/safety-regression.test.ts` described below — that addition
introduces no new match for either scan, confirmed separately by
re-grepping only the new test block for both scans' patterns before
recording these results):

### Scan 1 — order/adapter/network patterns

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase9
```

Full output (102 matches):

```text
docs/phase9/README.md:37:- a callable `TossSecuritiesAdapter` write implementation
docs/phase9/README.md:43:- setting `liveBrokerWriteAllowed: true` in any runtime path
src/adapters/toss/toss-read-only-http-client.ts:542:  return fetch(url, init);
src/adapters/toss-write-contract.ts:4: * This file specifies the future `TossSecuritiesAdapter` write contract as
src/adapters/toss-write-contract.ts:11: * (`submitOrder(command: never): Promise<never>`), extended here with a
src/adapters/toss-write-contract.ts:16: * - no `fetch`, HTTP client, axios, undici, or any network code;
src/adapters/toss-write-contract.ts:19: * - no `liveBrokerWriteAllowed: true` anywhere;
src/adapters/toss-write-contract.ts:48: * permanently out of scope for `TossSecuritiesAdapter`. This type exists so
src/adapters/toss-write-contract.ts:194:  submitOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:195:  cancelOrder(command: never): Promise<never>;
src/adapters/toss-write-contract.ts:196:  replaceOrder(command: never): Promise<never>;
src/adapters/contracts/toss.ts:47:  submitOrder(command: never): Promise<never>;
src/adapters/contracts/toss.ts:48:  cancelOrder(command: never): Promise<never>;
src/adapters/toss/toss-read-only-dry-run-client.ts:40:  "submitOrder",
src/adapters/toss/toss-read-only-dry-run-client.ts:41:  "cancelOrder",
src/adapters/naver/naver-news-adapter.ts:44:      const response = await this.options.fetch(url, {
src/adapters/claude/analysis-schema.ts:21:  "submitOrder",
src/adapters/claude/analysis-schema.ts:22:  "cancelOrder",
src/adapters/claude/analysis-schema.ts:23:  "replaceOrder",
src/application/toss/read-only-evidence-recorder.ts:48:const liveWritePattern = /(submitOrder|cancelOrder|placeOrder|modifyOrder|withdraw|transfer)/i;
src/application/broker-write-guard/broker-write-command-guard.ts:195:    "submitOrder",
src/application/broker-write-guard/broker-write-command-guard.ts:196:    "cancelOrder",
src/application/broker-write-guard/broker-write-command-guard.ts:197:    "replaceOrder",
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
tests/adapters/toss-write-contract.test.ts:14:// never sets `liveBrokerWriteAllowed: true`. It only inspects design-only
tests/adapters/toss-write-contract.test.ts:73:    const writeKeys: Array<keyof TossFutureWriteAdapter> = ["submitOrder", "cancelOrder", "replaceOrder"];
src/application/ai-health-check/ai-health-check-service.ts:86:  "submitOrder",
src/application/ai-health-check/ai-health-check-service.ts:87:  "cancelOrder",
tests/application/read-only-dashboard.test.ts:98:    expect(status).not.toHaveProperty("submitOrder");
tests/application/read-only-dashboard.test.ts:307:    const forbidden = ["submitOrder", "cancelOrder", "replaceOrder", "placeOrder", "activateKillSwitch", "deactivateKillSwitch", "approveOrder", "enableLiveTrading"];
tests/adapters/contracts.test.ts:53:    const writeKeys: Array<keyof TossWriteAdapter> = ["submitOrder", "cancelOrder"];
tests/safety/safety-regression.test.ts:620:          followUp: { recommendedNextStep: { submitOrder: { assetId: "asset-1", side: "BUY" } } }
tests/safety/safety-regression.test.ts:662:        cancelOrder: { orderId: "order-1" }
tests/safety/safety-regression.test.ts:745:        expect(encoded).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
tests/safety/safety-regression.test.ts:791:    // a future TossSecuritiesAdapter write contract on top of the existing
tests/safety/safety-regression.test.ts:793:    // whose `submitOrder`/`cancelOrder` parameters are typed `command:
tests/safety/safety-regression.test.ts:808:      submitOrder(_command: never): Promise<never> {
tests/safety/safety-regression.test.ts:810:          "TossWriteAdapter.submitOrder must never be called; Phase 7 keeps this contract uncallable by design."
tests/safety/safety-regression.test.ts:813:      cancelOrder(_command: never): Promise<never> {
tests/safety/safety-regression.test.ts:815:          "TossWriteAdapter.cancelOrder must never be called; Phase 7 keeps this contract uncallable by design."
tests/safety/safety-regression.test.ts:820:    it("rejects an order-shaped argument to submitOrder/cancelOrder at compile time (command: never)", () => {
tests/safety/safety-regression.test.ts:829:      // @ts-expect-error - TossWriteAdapter.submitOrder's parameter is typed
tests/safety/safety-regression.test.ts:838:      expect(() => adapter.submitOrder(orderShapedCommand)).toThrow(/must never be called/);
tests/safety/safety-regression.test.ts:840:      // @ts-expect-error - same proof for cancelOrder.
tests/safety/safety-regression.test.ts:841:      expect(() => adapter.cancelOrder(orderShapedCommand)).toThrow(/must never be called/);
tests/safety/safety-regression.test.ts:852:      expect(() => adapter.submitOrder(undefined as never)).toThrow(
tests/safety/safety-regression.test.ts:855:      expect(() => adapter.cancelOrder(undefined as never)).toThrow(
tests/application/backup-restore-drill.test.ts:249:    expect(report).not.toHaveProperty("submitOrder");
tests/adapters/toss-read-only-http-client.test.ts:72:    expect(publicMethodNames).not.toContain("submitOrder");
tests/adapters/toss-read-only-http-client.test.ts:73:    expect(publicMethodNames).not.toContain("cancelOrder");
tests/adapters/toss-read-only-http-client.test.ts:75:    expect((client as unknown as Record<string, unknown>)["submitOrder"]).toBeUndefined();
tests/adapters/toss-read-only-dry-run-client.test.ts:53:      body: { submitOrder: { symbol: "005930" } }
tests/application/restore-safety-gate.test.ts:71:    expect(result).not.toHaveProperty("submitOrder");
tests/application/access-control-service.test.ts:70:    expect(decision).not.toHaveProperty("submitOrder");
tests/application/toss-read-only-evidence-intake.test.ts:210:      verificationResult({ liveBrokerWriteAllowed: true as unknown as false })
tests/application/toss-read-only-evidence-intake.test.ts:352:      receiptRecord({ liveBrokerWriteAllowed: true as unknown as false })
tests/application/kill-switch-control-service.test.ts:29:    expect(result).not.toHaveProperty("submitOrder");
tests/application/paper-trading-engine.test.ts:155:    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/application/paper-trading-engine.test.ts:292:    for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/application/operations-status-read-model.test.ts:160:  it("never reports liveBrokerWriteAllowed: true even when every other signal is clean and small-capital readiness is ready", () => {
tests/application/operations-status-read-model.test.ts:419:    expect(summary).not.toHaveProperty("submitOrder");
tests/application/operations-status-read-model.test.ts:420:    expect(summary).not.toHaveProperty("cancelOrder");
tests/application/operations-status-read-model.test.ts:421:    expect(summary).not.toHaveProperty("replaceOrder");
tests/application/operations-status-read-model.test.ts:422:    expect(summary).not.toHaveProperty("placeOrder");
tests/application/operations-status-read-model.test.ts:429:    expect(serialized).not.toMatch(/submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter/i);
tests/application/outbox-worker-service.test.ts:127:    expect(result).not.toHaveProperty("submitOrder");
tests/application/ai-health-check-service.test.ts:35:      submitOrder: true
tests/application/ai-health-check-service.test.ts:43:        "forbidden_command_key_submitOrder"
tests/application/strategy-promotion-dashboard-workflow.test.ts:82:    expect(result).not.toHaveProperty("submitOrder");
tests/application/ai-analysis-persistence.test.ts:71:      brokerCommand: { submitOrder: true }
tests/application/ai-analysis-persistence.test.ts:136:        submitOrder: true
tests/application/ai-analysis-persistence.test.ts:152:      followUpSuggestion: { action: { replaceOrder: { orderId: "order-1" } } }
tests/application/dashboard-sensitive-control-gate.test.ts:81:    expect(decision).not.toHaveProperty("submitOrder");
tests/application/shadow-portfolio-engine.test.ts:144:    expect(result).not.toHaveProperty("submitOrder");
tests/application/broker-write-command-guard.test.ts:53:    expect(result).not.toHaveProperty("submitOrder");
tests/application/broker-write-command-guard.test.ts:135:          submitOrder: true
tests/application/reconciliation-service.test.ts:32:    expect(report).not.toHaveProperty("submitOrder");
tests/application/reconciliation-service.test.ts:167:    expect(adapter).not.toHaveProperty("submitOrder");
tests/application/toss-read-only-evidence-recorder.test.ts:91:        submitOrder: {
tests/application/order-execution-simulation-service.test.ts:36:    expect(result.ok && result.command).not.toHaveProperty("submitOrder");
tests/application/order-execution-simulation-service.test.ts:81:      for (const forbiddenKey of ["submitOrder", "cancelOrder", "replaceOrder", "tossRequest", "brokerCommand"]) {
tests/scripts/phase5-toss-network-safety-static.test.ts:27:  /\baxios\b/,
tests/scripts/phase5-toss-network-safety-static.test.ts:37:  /\bsubmitOrder\s*\(/,
tests/scripts/phase5-toss-network-safety-static.test.ts:38:  /\bcancelOrder\s*\(/,
tests/scripts/phase5-toss-network-safety-static.test.ts:39:  /\breplaceOrder\s*\(/
tests/application/order-cancel-simulation-service.test.ts:84:    expect(result).not.toHaveProperty("cancelOrder");
tests/application/reconciliation-workflow-service.test.ts:31:    expect(result).not.toHaveProperty("submitOrder");
tests/application/reconciliation-workflow-service.test.ts:202:      expect(serialized).not.toMatch(/submitOrder|cancelOrder|correctionCommand|brokerWritePayload|placeOrder/i);
tests/application/observability-metrics.test.ts:100:    expect(event).not.toHaveProperty("submitOrder");
tests/application/observability-metrics.test.ts:101:    expect(event).not.toHaveProperty("cancelOrder");
tests/application/operational-alerting-service.test.ts:71:    expect(alert).not.toHaveProperty("submitOrder");
tests/application/operational-alerting-service.test.ts:72:    expect(alert).not.toHaveProperty("cancelOrder");
tests/scripts/phase5-toss-read-only-verify-script.test.ts:99:  it.each(["createOrder", "cancelOrder", "modifyOrder", "orders/cancel", "withdraw", "transfer"])(
```

Note: `docs/phase9` at this baseline contains only `README.md`, which
contributes the two prohibition-statement lines listed above; no other
file under `docs/phase9` produced a Scan 1 match.

### Scan 2 — secret/env patterns

```bash
rg -n "\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase9
```

Full output (111 matches):

```text
docs/phase9/README.md:38:- reading or printing `.env`, `tmp/phase5`, local receipts, secrets, raw
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
src/application/broker-write-guard/broker-write-command-guard.ts:124:  if (!input.environment) {
src/application/broker-write-guard/broker-write-command-guard.ts:127:    if (!input.environment.liveBrokerWritesEnabled) reasons.push("environment_live_broker_writes_disabled");
src/application/broker-write-guard/broker-write-command-guard.ts:128:    if (!input.environment.allowedEnvironments.includes(input.environment.environment)) {
src/application/broker-write-guard/broker-write-command-guard.ts:129:      reasons.push(`environment_${input.environment.environment}_not_allowed_for_broker_writes`);
tests/application/scheduler-job-runner.test.ts:64:        "Claude token=secret-token and key sk-test-secret failed, bearer abc123token, account_number 12345678901, 계좌번호 98765432109"
tests/application/toss-read-only-verification-planner.test.ts:42:    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/application/incident-runbook-review.test.ts:63:      investigation: ["check logs for client_secret=abc123 and account_number 12345678901"]
tests/application/toss-read-only-evidence-recorder.test.ts:160:        operatorNote: "Approved using client_secret abc123 for this call."
tests/application/toss-read-only-credential-readiness.test.ts:50:    expect(result.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
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
tests/scripts/validate-toss-evidence-manifest-script.test.ts:74:      PATH: process.env.PATH
tests/scripts/phase5-toss-completion-script.test.ts:72:      env: { PATH: process.env.PATH, ...extraEnv },
src/adapters/toss-write-contract.ts:18: * - no `process.env` read;
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
src/application/development/claude-worktree-orchestration-guide.ts:181:  if (path === ".env" || path.startsWith(".env.")) return true;
src/application/development/claude-worktree-orchestration-guide.ts:184:  if (path.endsWith(".env") && !path.endsWith(".env.example")) return true;
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:37:    const env = readFileSync(join(dir, ".env"), "utf8");
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:60:    const env = readFileSync(join(dir, ".env"), "utf8");
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:74:      join(dir, ".env"),
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:92:        env: { PATH: process.env.PATH },
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:101:    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:110:    join(dir, ".env"),
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:138:          response.end(JSON.stringify({ access_token: "mock-access-token", token_type: "Bearer" }));
tests/scripts/phase5-toss-account-ref-setup-script.test.ts:173:      env: { PATH: process.env.PATH },
src/application/toss/read-only-evidence-intake.ts:234:        environment: options.environment,
src/application/toss/read-only-evidence-intake.ts:495:      if (path.includes(".env")) {
src/application/toss/read-only-evidence-intake.ts:577: * `tmp/phase5/`, git-ignored. This is distinct from
src/application/toss/read-only-evidence-intake.ts:725:      if (reference.includes(".env")) {
tests/scripts/report-toss-open-questions-script.test.ts:59:      PATH: process.env.PATH
tests/scripts/validate-toss-evidence-intake-script.test.ts:33:      sanitizedSummary: "This should fail because it includes client_secret=very-sensitive-value."
tests/scripts/phase5-toss-preflight-script.test.ts:19:        env: { PATH: process.env.PATH, ...missingCredentialEnv() }
tests/scripts/phase5-toss-preflight-script.test.ts:49:        env: { PATH: process.env.PATH, PHASE5_TOSS_READ_ONLY_CALL_APPROVED: "true" }
tests/scripts/phase5-toss-preflight-script.test.ts:114:        PATH: process.env.PATH,
tests/scripts/plan-toss-read-only-verification-script.test.ts:57:    expect(report.reasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/plan-toss-read-only-verification-script.test.ts:87:      PATH: process.env.PATH,
tests/scripts/plan-toss-read-only-verification-script.test.ts:88:      ...env
tests/scripts/phase5-toss-call-gate-script.test.ts:90:        PATH: process.env.PATH,
src/application/dashboard/read-only-dashboard.ts:143: * `.env` or `tmp/phase5` receipts.
tests/scripts/validate-toss-endpoints-script.test.ts:216:      PATH: process.env.PATH
src/application/deployment/deployment-readiness-gate.ts:13: * network code, no filesystem access, no `process.env` reads, no
src/application/deployment/deployment-readiness-gate.ts:119: * `src/config/environment.ts`. This gate never reads `process.env` and
src/application/deployment/deployment-readiness-gate.ts:217:  const skeletons = input.environmentSkeletons ?? deploymentEnvironmentSkeletons;
src/application/deployment/deployment-readiness-gate.ts:387: * never reads `process.env`, never reads a real secret, and only pattern
tests/scripts/check-toss-readiness-script.test.ts:79:      PATH: process.env.PATH,
tests/scripts/check-toss-readiness-script.test.ts:80:      ...env
src/application/operations/operations-status-read-model.ts:22: * It has no network code, no filesystem access, no `.env` or `tmp/phase5`
tests/scripts/phase5-toss-doctor-script.test.ts:52:    expect(report.blockingReasonCodes).toContain("missing_or_placeholder_toss_client_secret");
tests/scripts/phase5-toss-doctor-script.test.ts:91:            sanitizedSummary: `Reviewed evidence, access_token=${secretValue} was visible in the screenshot.`
tests/scripts/phase5-toss-doctor-script.test.ts:190:      PATH: process.env.PATH,
tests/scripts/phase5-toss-doctor-script.test.ts:191:      ...env
tests/scripts/phase5-toss-read-only-verify-script.test.ts:15: * modify this repository's real .env (there is none in this worktree; every
tests/scripts/phase5-toss-read-only-verify-script.test.ts:414:    PATH: process.env.PATH,
tests/scripts/phase5-toss-read-only-verify-script.test.ts:599:          response.end(JSON.stringify({ access_token: "mock-access-token", token_type: "Bearer", expires_in: 3600 }));
src/config/environment.ts:42:  env: NodeJS.ProcessEnv = process.env,
src/application/scheduler/scheduler-job-runner.ts:83:   * runner never reads `.env`, `tmp/phase5/`, or any other file itself --
src/application/scheduler/scheduler-job-runner.ts:129:   * `.env` or `tmp/phase5/*` inside this codebase -- only pass booleans a
src/application/scheduler/scheduler-job-runner.ts:398:    .replace(/account[_-]?number[^\s]*/gi, "account_number=[REDACTED]")
src/adapters/toss/toss-read-only-http-client.ts:206:      client_secret: this.#clientSecret
src/adapters/toss/toss-read-only-http-client.ts:237:    const accessToken = readStringField(payload, "access_token");
```

### Baseline Scan Interpretation

Every match falls into one of the accepted categories already
established by the Phase 7 and Phase 8 reviews (prohibition statement,
`never`-typed uncallable placeholder, redaction/rejection test fixture
using a fake/mock secret-shaped string, safety assertion proving
absence, or a harmless `process.env.PATH` pass-through used only so a
spawned child process in a script test can find binaries on `PATH`).
No real callable write path, real network call to a Toss order endpoint,
or real secret read exists at this baseline:

- Scan 1's 102 matches are unchanged in kind from the Phase 8 post-merge
  state (uncallable `command: never` contracts in
  `src/adapters/contracts/toss.ts` and `src/adapters/toss-write-contract.ts`,
  forbidden-key deny-lists in `BrokerWriteCommandGuard`,
  `analysis-schema.ts`, and `ai-health-check-service.ts`, the dry-run
  client's forbidden-operation list, the read-only Toss HTTP client's
  injected `fetch` transport restricted to read-only operations, the
  unrelated Naver news adapter's injected `fetch`, and a large set of
  `tests/**` assertions proving absence of a write-shaped capability) —
  as expected, since no Phase 9 branch has touched any of these files
  yet.
- `docs/phase9` contributes exactly the two prohibition-statement Scan 1
  matches quoted above (both from `docs/phase9/README.md`'s "Forbidden
  in Phase 9 round 1" list) and the one prohibition Scan 2 match (same
  file's "reading or printing `.env`, `tmp/phase5`..." line) — no other
  file exists under `docs/phase9` at this baseline.
- Scan 2's 111 matches are the same categories the Phase 8 review
  catalogued: prohibition prose, doc-comment prohibitions, a large set of
  `tests/**` fixtures and assertions that intentionally construct
  fake/mock secret-shaped strings specifically to prove a
  validator/redactor rejects or masks them, `PATH: process.env.PATH`
  pass-throughs in script-spawning tests, and a handful of `src/**`
  production lines that read the *field name* `access_token`/`client_secret`
  out of a Toss token-exchange response body inside the pre-existing,
  Phase-5, read-only-only `toss-read-only-http-client.ts` (this client
  exposes only `AUTHENTICATION_READ`, `ACCOUNT_SNAPSHOT_READ`,
  `POSITION_QUERY_READ`, and `MARKET_DATA_READ`, no order-write
  operation).
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
`/Users/mac/Documents/Codex/aios-phase9-worktrees/eng4`, branch
`phase9/p9-004-integration-review`, after `git merge main`, merged tip
`3d977aa`, merge commit into this branch `cb1f69f`):

```bash
rg -n "submitOrder|cancelOrder|replaceOrder|placeOrder|TossSecuritiesAdapter|liveBrokerWriteAllowed: true|fetch\(|axios|undici" src tests docs/phase9
rg -n "\.env|tmp/phase5|client_secret|access_token|account_number" src tests docs/phase9
```

Scan 1 returned 114 total matches (versus 102 in the Phase 1 baseline).
Scan 2 returned 118 total matches (versus 111 in the Phase 1 baseline).
Diffing with a sorted, line-content set comparison (`comm -13`/`comm -23`
on sorted baseline vs. sorted post-merge output, not a raw ordered
`diff`, since `rg`'s file-traversal order is not guaranteed stable
between runs) against the Phase 1 baseline yields:

- **Scan 1: 12 matches genuinely new** from the P9-001/P9-002/P9-003
  merge. 0 matches removed.
- **Scan 2: 7 matches genuinely new** from the P9-001/P9-002/P9-003
  merge. 0 matches removed.

### The 12 Matches Genuinely New From Scan 1

```text
docs/phase9/small-capital-enablement-gate.md:30:- must never set `liveBrokerWriteAllowed: true` in any runtime path
docs/phase9/small-capital-go-no-go-checklist.md:143:- No `TossSecuritiesAdapter` write implementation exists.
docs/phase9/toss-write-preflight-contract-guard.md:167:  `TossSecuritiesAdapter` or any write method.
docs/phase9/toss-write-preflight-contract-guard.md:21:before a **future, separately reviewed** `TossSecuritiesAdapter` write
src/adapters/toss-write-preflight.ts:34: *   ever produces `liveBrokerWriteAllowed: true`.
src/adapters/toss-write-preflight.ts:37: * - no `fetch`, HTTP client, axios, undici, or any network code;
src/adapters/toss-write-preflight.ts:41: * - no `liveBrokerWriteAllowed: true` anywhere;
src/adapters/toss-write-preflight.ts:8: * `TossSecuritiesAdapter` write implementation could legitimately become
tests/adapters/toss-write-preflight.test.ts:460:      // adapter method such as submitOrder/cancelOrder/replaceOrder.
tests/application/small-capital-enablement-gate.test.ts:375:        liveBrokerWriteAllowed: true
tests/application/small-capital-enablement-gate.test.ts:414:      const tamperedPhase7 = { ...cleanPhase7Report(), liveBrokerWriteAllowed: true as unknown as false };
tests/application/small-capital-enablement-gate.test.ts:477:        operations: { ...cleanOperationsSignal(), liveBrokerWriteAllowed: true }
```

**Interpretation — every match accepted:**

- `docs/phase9/small-capital-enablement-gate.md:30`,
  `docs/phase9/small-capital-go-no-go-checklist.md:143`,
  `docs/phase9/toss-write-preflight-contract-guard.md:21,167` — all four
  are prohibition-statement or design-scope prose (confirmed by reading
  each in context: "must never set `liveBrokerWriteAllowed: true` in
  any runtime path", "No `TossSecuritiesAdapter` write implementation
  exists", and two references describing the *future, not-yet-built*
  adapter this preflight checks prerequisites for). None is code.
- `src/adapters/toss-write-preflight.ts:8,34,37,41` — all four are the
  module's own doc-comment prohibition list, read in full context above
  ("What Changed in P9-002"). Confirmed by direct reading: no `fetch`,
  `axios`, `undici`, or HTTP-client code exists anywhere else in this
  431-line file.
- `tests/adapters/toss-write-preflight.test.ts:460` — a code comment
  referencing the forbidden method names by way of explaining what the
  file structurally cannot construct, not a call to any of them.
- `tests/application/small-capital-enablement-gate.test.ts:375,414,477`
  — all three are safety assertions, read in full context: line 375 is
  inside "cannot be forced to true even by a hand-constructed object
  that violates the report's own type" — a caller-side object spread
  that mutates a *copy* of the evaluator's output to prove the
  evaluator itself never produces that value (the test re-runs the
  evaluator on the same clean input immediately after and asserts it
  is still `false`); lines 414 and 477 are inside "flags a tampered
  Phase 7 report" / "flags a tampered operations signal" tests that
  hand-construct an upstream report with `liveBrokerWriteAllowed: true`
  specifically to prove P9-003's defensive re-check
  (`phase7_report_live_broker_write_allowed_not_false` /
  `phase8_operations_report_live_broker_write_allowed_not_false`)
  catches it and still returns `liveBrokerWriteAllowed: false` on its
  own report. None of the three is a runtime value the evaluator itself
  produces.

### The 7 Matches Genuinely New From Scan 2

```text
docs/phase9/small-capital-enablement-gate.md:313:- It does not read `.env`, `tmp/phase5`, or any real secret value; this
docs/phase9/toss-write-preflight-contract-guard.md:169:- It does not read `.env`, `tmp/phase5`, or any secret/credential material.
docs/phase9/toss-write-preflight-contract-guard.md:170:- It does not read `process.env`.
src/adapters/toss-write-preflight.ts:39: * - no `process.env` read;
src/adapters/toss-write-preflight.ts:40: * - no `.env` or `tmp/phase5` read;
tests/adapters/toss-write-preflight.test.ts:20:// reads no .env or tmp/phase5 file, and never sets `liveBrokerWriteAllowed`
tests/application/live-blocker-evidence-intake.test.ts:203:          evidenceSourceReferences: ["Note: client_secret was used to authenticate the developer console session."]
```

**Interpretation — every match accepted:**

- `docs/phase9/small-capital-enablement-gate.md:313`,
  `docs/phase9/toss-write-preflight-contract-guard.md:169-170` — three
  prohibition-statement prose lines, confirmed by reading each in
  context.
- `src/adapters/toss-write-preflight.ts:39-40` and
  `tests/adapters/toss-write-preflight.test.ts:20` — the module's own
  doc-comment prohibition and a matching test-file comment restating it.
  Grep-confirmed: zero `process.env`, `.env`, or `tmp/phase5` reads
  anywhere else in either file.
- `tests/application/live-blocker-evidence-intake.test.ts:203` — a test
  fixture string, `"Note: client_secret was used to authenticate the
  developer console session."`, deliberately constructed to prove
  `LiveBlockerEvidenceRecordValidator` rejects an evidence source
  reference that merely *mentions* the word `client_secret` in prose
  (not a real secret value) with `evidence_may_contain_secret_evidence_source_reference_0`.
  A redaction/rejection test, not a real secret.

### Overall Post-Merge Interpretation

**None of the 12 (Scan 1) + 7 (Scan 2) = 19 genuinely new matches is a
callable broker-write path, a real network call to a Toss order
endpoint, a real secret value, or a `liveBrokerWriteAllowed: true`
runtime value produced by any evaluator.** Every one is a prohibition
statement, a doc-comment restating a prohibition, a safety assertion
proving a tampering/smuggling attempt is caught, or a redaction-test
fixture using fake/mock secret-shaped text. This matches the same
discipline applied to the Phase 1 baseline and to the Phase 7 and
Phase 8 reviews' own post-merge scans. `.env` remains absent from this
worktree (confirmed by `ls -la .env` returning "No such file or
directory" — existence check only). `tmp/phase5/` now exists as an
**empty** directory (0 files; confirmed by `ls -la tmp/phase5/`),
created as a harmless side effect of running the existing Phase 5
script test suite during `npm run check` (several of those pre-existing
tests spawn local scripts that create and immediately clean up files
under this git-ignored path) — it was not read, printed, or inspected
beyond this existence/emptiness check, and it is `.gitignore`d
(`tmp/`) and was not staged or committed.

## Phase 1 Regression-Gap Check (Pre-Merge Baseline)

This section is real — produced in Phase 1.

**Question:** Does the current (pre-Phase-9) `tests/safety/safety-regression.test.ts`
already prove anything relevant to guarding against a "clean evidence
intake" or "clean preflight" result being mistaken for live-trading
authorization — mirroring the same "clean-looking report cannot satisfy
`BrokerWriteCommandGuard`" pattern already established for other
evaluators by the Phase 7 (`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`)
and Phase 8 (`docs/reviews/Codex_Phase8_Operations_Readiness_Review.md`)
reviews?

**Finding: one genuine, narrow gap found and closed.** The suite already
had:

- a "P6-003 chain hardening" block and top-level tests proving
  `RiskCheck`/`MoneyCheck` failures and kill-switch activation cascade
  into a blocked `BrokerWriteCommandGuard` decision;
- an "AI output stays advisory-only" block proving Claude analysis output
  cannot satisfy the guard;
- a "Dashboard operator surface stays advisory-only" block proving
  `ReadOnlyDashboardService`/`Phase6OperatorSafetyDashboardService`
  output cannot satisfy the guard;
- a "TossWriteAdapter placeholder contract stays structurally uncallable"
  block (Phase 7 pre-merge baseline);
- a "Pre-existing operational evaluators that Phase 8 will extend cannot
  themselves satisfy `BrokerWriteCommandGuard`" block (Phase 8 pre-merge
  baseline), proving clean `DeploymentEnvironmentSkeletonService.validate()`
  and `RestoreSafetyGate.evaluate()` results cannot satisfy the guard;
  and
- a "P8-001/P8-002/P8-003 outputs cannot themselves satisfy
  `BrokerWriteCommandGuard`" block (Phase 8 post-merge cross-module
  proof), proving clean `OperationsStatusReadModel.buildStatus()`,
  `evaluateDeploymentReadiness()`, and `evaluateBackupRestoreDrill()`
  outputs cannot satisfy the guard.

However, `evaluateSmallCapitalReadiness`
(`src/application/live-readiness/small-capital-readiness.ts`, already
merged in Phase 7) — the one existing evaluator that P9-003's own task
doc (`docs/tasks/phase9_claude_worktree_tasks/P9-003_small_capital_enablement_gate.md`)
names as a direct input to the future small-capital enablement gate, and
whose entire purpose (per `docs/phase7/small-capital-readiness-gates.md`)
is to report "design-time gates satisfied" evidence that must never be
mistaken for live-trading authorization — had **never** been fed through
the real `BrokerWriteCommandGuard` at this consolidated harness level.
Only its own per-module unit tests exist
(`tests/application/small-capital-readiness.test.ts`), and those do not
touch `BrokerWriteCommandGuard` at all. Since Phase 9 round 1 is
specifically about turning readiness/evidence signals like this one into
further evidence-intake and enablement layers (P9-001, P9-003) built on
top of it, this is exactly the kind of pre-existing input a future
Phase 9 module could be mistaken for satisfying the guard through — the
same shape of gap the Phase 8 review closed pre-merge for
`DeploymentEnvironmentSkeletonService` and `RestoreSafetyGate` before
P8-002/P8-003 built on top of them.

**Test added to close this gap:** a new `describe` block, "Pre-existing
small-capital readiness evaluator that Phase 9 will extend cannot itself
satisfy BrokerWriteCommandGuard (Phase 9 pre-merge baseline)", in
`tests/safety/safety-regression.test.ts`, containing one test: "does not
let a clean `evaluateSmallCapitalReadiness()` report
(`readyForSmallCapitalLive: true`) satisfy `BrokerWriteCommandGuard` on
its own". It constructs the evaluator's cleanest possible input (all
capital limits, a compliant proposed order, an `APPROVED` non-expired
`ManualLiveApprovalRecord` with the verbatim required attestation, clean
reconciliation, an unblocked kill switch, a healthy operator surface, and
an allowed compliance-gate result — the exact fixture shape already used
by `tests/application/small-capital-readiness.test.ts`'s own
`fullyCleanInput()`), confirms the report reads
`readyForSmallCapitalLive: true` with zero blocking reason codes and
`liveBrokerWriteAllowed: false`, then feeds that report as
`BrokerWriteCommandGuard`'s `aiContext` and confirms the guard still
returns `allowed: false` with the full set of missing-input reason codes
(`missing_order_approval`, `missing_broker_account`,
`missing_compliance_gate`, `missing_environment_policy`,
`missing_kill_switch_state`, `missing_reconciliation_state`) and does
not raise `ai_context_contains_forbidden_broker_command` (the report
contains no command-shaped key, so this would be a false positive if
raised).

This is a pure addition of coverage. No existing test was weakened,
removed, or had its assertions loosened.

**Local verification (Phase 1):**

```bash
npx vitest run tests/safety/safety-regression.test.ts
```

Result: 26 tests passed (25 pre-existing + 1 new), 0 failed. Full
`npm run check` result is recorded in "Required Checks" below.

## Whether All Eight LCB-* Blockers Are Represented

**Yes, in all three modules.** P9-001's `LIVE_BLOCKER_IDS` and
`LIVE_BLOCKER_CATALOG` are frozen constants listing exactly `LCB-001`
through `LCB-008`, matching `docs/phase7/live-capable-blocker-register.md`'s
summary table titles and human-owner roles verbatim in spirit (own
paraphrase, not a copy). `LiveBlockerEvidenceRegisterReviewer.review()`
always returns a `blockers[]` array of exactly these 8 ids, in this
fixed order, even when zero evidence records are supplied (each becomes
`status: "MISSING"`) — confirmed by reading
`LiveBlockerEvidenceRegisterReviewer.review` directly:
`blockers = LIVE_BLOCKER_IDS.map(...)` always iterates the full frozen
list, never a caller-supplied subset. P9-002's
`TOSS_WRITE_PREFLIGHT_REQUIRED_LIVE_BLOCKER_IDS` is the same frozen
8-id list, and `liveBlockerEvidenceReasons` iterates it unconditionally,
producing a `<blockerId>_missing` reason for any absent entry.
P9-003's `REQUIRED_LIVE_CAPABLE_BLOCKER_IDS` is again the same frozen
8-id list, and `evaluateLiveBlockerEvidenceView` iterates it
unconditionally. All three lists were compared line-by-line and are
identical in content (`LCB-001`..`LCB-008`) and order.

## Whether Any Task Incorrectly Marked A Human-Only Blocker Resolved

**No.** The literal string `"RESOLVED"` does not appear as a producible
value in any of the three new modules:

- P9-001: `LiveBlockerEvidenceStatus` and
  `LiveBlockerEvidenceRegisterBlockerStatus` both deliberately exclude
  it (confirmed by reading both type definitions); a dedicated test
  tries to smuggle it through via `@ts-expect-error` and fails;
  `blockerRegisterResolutionAllowed: false` is a hardcoded literal on
  every register-level report; the module never reads or writes
  `docs/phase7/live-capable-blocker-register.md`.
- P9-002: has no status vocabulary that includes "resolved" at all —
  its only output is `ready: boolean` plus `blockingReasons`, neither
  of which can encode a blocker resolution.
- P9-003: `LiveBlockerReviewStatus` is
  `"NOT_STARTED" | "READY_FOR_HUMAN_REVIEW" | "HUMAN_REVIEWED"` —
  no `"RESOLVED"` member, and no code path in the module can construct
  or upgrade an entry's `status` to `"HUMAN_REVIEWED"`; that value can
  only arrive as caller-supplied input.

No task edited `docs/phase7/live-capable-blocker-register.md` itself
(confirmed: `git diff 1ed644d..3d977aa -- docs/phase7/live-capable-blocker-register.md`
returns zero lines) — the file this review's own instructions and every
task doc treat as the sole place a human may ever record a `RESOLVED`
decision was not touched by any of the three merges.

## Whether Evidence Validators Reject Secrets/Raw Broker Identifiers

**Yes.** P9-001's `scanForProhibitedContent` runs four independent
pattern checks (secret-like: tokens/keys/passwords/bearer values;
account-identifier-like: 6+ digit runs; raw-payload-like: JSON/HTML/HTTP
response shapes; request-header-like: `x-*`/cookie/set-cookie headers)
against every free-text field on a record (evidence source references,
limitations, reviewer name, reviewer role, AI summary), and every match
produces a blocking `reasonCode`, never a warning — confirmed by reading
the function directly and by the test-fixture evidence
(`tests/application/live-blocker-evidence-intake.test.ts:203`, `"...
client_secret was used..."`) that the post-merge scan surfaced and this
review independently verified is a rejection-test fixture. P9-002's
`rawPayloadPolicyReasons` defensively re-checks
`policy.rawPayloadStorageAllowed` at runtime even though it is typed as
the literal `false` (guarding against an `as`-cast bypass). P9-003 does
not itself accept free-text evidence content (it consumes a narrow,
already-summarized `LiveBlockerEvidenceSummaryEntry` shape with no
free-text fields beyond a reviewer name), so raw-secret rejection at
that layer is P9-001's responsibility by design, and P9-001 covers it.

## Whether Future Write Preflight Remains No-Write

**Yes.** `src/adapters/toss-write-preflight.ts` contains zero `fetch`,
`axios`, `undici`, HTTP-client, `process.env`, or request-body-builder
code anywhere in its 442 lines (grep-confirmed directly; the only
appearances of those words are in the module's own doc-comment
prohibition list). `evaluateTossWritePreflight` is synchronous, takes
plain data, and returns plain data; it never constructs, returns, or
references anything resembling a callable adapter. `src/adapters/toss-write-contract.ts`
(the existing compile-time-uncallable `command: never` contract) is
untouched by this merge (`git diff` confirms zero lines changed), and
P9-002 does not weaken, bypass, or reimplement `BrokerWriteCommandGuard`
— it only ever consumes a caller-supplied `BrokerWriteCommandGuardResult`
as read-only input and adds its own additional checks on top
(`guard_result_not_allowed`, `guard_result_has_reason_codes`, etc.),
never relaxing what the guard itself requires.

## Whether Small-Capital Enablement Remains Evidence-Only

**Yes.** `readyForLiveBrokerWrites` and `liveBrokerWriteAllowed` on
`SmallCapitalEnablementGateReport` are typed as the TypeScript literal
type `false`, not `boolean`, and written as bare literals at the single
return site — there is no branch, ternary, ambient default, or expression
anywhere in the 597-line file that can produce `true` for either field
(confirmed by reading the full return statement and every helper
function that contributes to it). The "maximally clean input" test
proves this holds even when every upstream signal is clean and all 8
`LCB-*` blockers are `HUMAN_REVIEWED`. `SMALL_CAPITAL_ENABLEMENT_GATE_EVIDENCE_STATEMENT`
is a verbatim, human-readable restatement of this same guarantee,
attached to every report as data (`evidenceOnlyStatement`), not only as
documentation — so a caller reading only the JSON output still sees the
statement. The module never marks a live-blocker evidence entry
reviewed on a human's behalf (see the vocabulary-compatibility note
above) and never derives `readyForLiveBrokerWrites` from
`readyForSmallCapitalPreparation`.

## Whether Any Task Introduced Network Calls Or Callable Broker-Write Code

**No.** Across all three new source files
(`src/application/live-readiness/live-blocker-evidence-intake.ts`,
`src/adapters/toss-write-preflight.ts`,
`src/application/live-readiness/small-capital-enablement-gate.ts`) there
is zero `fetch`, `axios`, `undici`, `process.env`, filesystem (`fs`),
`child_process`, or cloud-CLI reference of any kind (grep-confirmed
directly against each file, not merely accepted by pattern-category from
the scan). None of the three exports a callable `submitOrder`,
`cancelOrder`, `replaceOrder`, or any other order-mutating method — all
three are pure evaluators/validators returning plain report objects.
`src/adapters/toss-write-contract.ts` and
`src/application/broker-write-guard/broker-write-command-guard.ts`, the
two files where a callable write path or a weakened guard would most
plausibly appear, are both confirmed byte-for-byte unchanged by this
merge (`git diff 1ed644d..3d977aa` on each returns zero lines).

## Whether Phase 9 Round 1 Is Complete, Blocked, Or Needs Another Round

**Go — Phase 9 round 1 is complete as an evidence-and-gate preparation
package.** Every exit criterion in `docs/phase9/README.md` is satisfied
by the merged code:

- Every `LCB-*` blocker has a machine-checkable evidence-intake shape
  (P9-001) — confirmed above.
- Evidence validators fail closed on missing human-reviewer fields and
  reject secret/account/payload/header-like content as blocking, never
  advisory (P9-001) — confirmed above.
- The future write-adapter preflight remains no-write and cannot call a
  broker; it does not weaken `BrokerWriteCommandGuard` (P9-002) —
  confirmed above.
- Small-capital enablement remains structurally separated from
  live-trading authorization, even under a maximally clean input
  (P9-003) — confirmed above.
- No runtime output enables live broker writes: `liveBrokerWriteAllowed`
  is a hardcoded `false` literal everywhere it appears across all three
  new modules, and every genuinely new source-scan match is a
  prohibition, doc-comment, or safety assertion, never a real value or
  callable path.
- `npm run check` passes: 90 test files, 914 tests, 0 failures.

**This completion is preparation-evidence readiness only. It is not
approval for live trading, for any real Toss API call, or for enabling
`liveBrokerWriteAllowed` anywhere.** The human-only next steps remain
exactly those already listed in
`docs/phase7/live-capable-blocker-register.md` — all eight `LCB-001`
through `LCB-008` entries remain not-`RESOLVED` in that register (Phase
9 does not touch that register's `Current Status` field at all; the
register itself was confirmed byte-for-byte unchanged by this merge).
The one concrete, non-blocking follow-up item this review surfaces is
the P9-001/P9-003 evidence-vocabulary reconciliation noted above — now
closed by a follow-up integration fix, not a re-run of Phase 9 round 1.

### LCB-001..008 Status Summary (unchanged by Phase 9, per the canonical register)

All eight remain exactly as recorded in
`docs/phase7/live-capable-blocker-register.md` (untouched by this
phase): `LCB-001` UNVERIFIED, `LCB-002` NOT_STARTED, `LCB-003`
NOT_STARTED, `LCB-004` NOT_STARTED, `LCB-005` UNVERIFIED, `LCB-006`
NOT_STARTED, `LCB-007` EVIDENCE_PENDING, `LCB-008` BLOCKED. None is
`RESOLVED`. Phase 9 round 1 gives a human reviewer the machine-checkable
tools (P9-001 evidence intake, P9-002 preflight, P9-003 enablement gate)
to eventually work these blockers — it does not itself advance any of
their statuses, and no code in this repository can.

### Remaining Human-Only Blockers

Unchanged from Phase 7/8, restated here for continuity: a human must
still (1) obtain and record Toss's actual written position on automated
trading permission (`LCB-001`); (2) perform and record sanitized
account-permission verification (`LCB-002`); (3) document and review a
real production credential-provisioning process (`LCB-003`); (4) record
an explicit, human-signed live-trading-progression approval with
residual-risk acknowledgment (`LCB-004`, permanent per Rule 12); (5)
complete and record the six-item compliance/legal review
(`LCB-005`); (6) set and sign off on numeric/procedural small-capital
operating limits (`LCB-006`); (7) produce a live-context
rollback/incident procedure once a real adapter exists (`LCB-007`,
partially evidence-pending); and (8) commission an independent human
code review of a real write adapter once one is built in a later,
separately scoped phase (`LCB-008`, structurally `BLOCKED` until then).
No AI agent, including this review, can satisfy any of these on a
human's behalf.

## Required Checks (Phase 2)

```bash
npm run check
```

Result: **PASS.** Typecheck clean. 90 test files, 914 tests, 0
failures. Full output captured during this review session (foreground
run, no backgrounding).

## What This Review Does Not Do

- It does not authorize live trading, a real Toss API call, a real
  cloud deployment, or production capital use.
- It does not resolve, advance, or change the status of any `LCB-001`
  through `LCB-008` entry in
  `docs/phase7/live-capable-blocker-register.md` — confirmed that file
  is byte-for-byte unchanged by this merge.
- It does not mark any compliance item or human approval as resolved.
- It does not read, print, or inspect any real `.env` file or real
  `tmp/phase5/` receipt file — `.env` remains absent from this worktree;
  `tmp/phase5/` exists only as an empty, git-ignored directory created
  as a harmless side effect of running the pre-existing Phase 5 script
  test suite, confirmed empty and untouched beyond an existence/emptiness
  check.
- It does not perform any real Toss API call, real cloud deployment
  command, or real broker write, and adds no real network call to any
  test.

## What Phase 1 Of This Review Did Not Do

- It did not review, summarize, or characterize any content from
  P9-001, P9-002, or P9-003 — none of those branches existed yet from
  that worktree's point of view at the time.
- It did not resolve, advance, or change the status of any `LCB-001`
  through `LCB-008` entry in
  `docs/phase7/live-capable-blocker-register.md`.
- It did not mark any compliance item or human approval as resolved.
- It did not modify `docs/tasks/phase9_claude_worktree_tasks/README.md`
  or `docs/phase9/README.md` — those were reserved for Phase 2, and even
  then only for status/link updates.
- It does not read, print, or inspect any real `.env` file or real
  `tmp/phase5/` receipt file — both were confirmed absent from this
  worktree by an existence check only.
- It does not perform any real Toss API call, real cloud deployment
  command, or real broker write, and adds no real network call to any
  test.
