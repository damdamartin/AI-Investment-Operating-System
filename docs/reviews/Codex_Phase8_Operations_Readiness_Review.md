# Codex Phase 8 Operations Readiness Review

Version: 0.1.0
Status: Draft — Phase 1 of 2 (scaffold, baseline, pre-merge regression-gap check only)
Review Date: 2026-07-29
Task: P8-004 Phase 8 Integration Review
Assigned Engineer: Engineer 4

## Purpose

This document will record the Phase 8 integration and operations-readiness
review after P8-001 (operations status API), P8-002 (deployment readiness
gate), and P8-003 (backup/restore/rollback drills) are merged into local
`main`. It follows the same two-phase pattern used for
`docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md` and
`docs/reviews/Codex_Phase7_Live_Capable_Design_Readiness_Review.md`: Phase 1
(this content) establishes a pre-merge baseline (source scans, a
regression-gap check, and this scaffold); Phase 2 performs the full
integration review once P8-001/P8-002/P8-003 exist and are merged.

**This document does not authorize live trading, order creation, order
cancellation, order modification, transfer, withdrawal, currency
conversion, real cloud deployment, or production capital use — in either
phase.**

## Phase Status

- Phase 1 (scaffold, baseline source scans, pre-merge regression-gap
  check): complete.
- Phase 2 (full integration review after P8-001/P8-002/P8-003 merge):
  PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Summary

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## What Changed in P8-001 (Operations Status API)

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## What Changed in P8-002 (Deployment Readiness Gate)

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## What Changed in P8-003 (Backup, Restore, and Rollback Drills)

PENDING — awaiting P8-001/P8-002/P8-003 merge.

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

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Whether Dashboard/Status APIs Are Read-Only and Advisory

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Whether Deployment Readiness Keeps Production/Live Trading Disabled By Default

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Whether Backup/Restore/Rollback Drills Are Testable and Fail Closed

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Whether Any Task Introduced Network Calls/Real Deployment/Broker Write Capability

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Whether Local Secrets/Receipts Remain Untouched

PENDING — awaiting P8-001/P8-002/P8-003 merge.

## Whether Phase 8 Is Complete, Blocked, or Needs Another Round

PENDING — awaiting P8-001/P8-002/P8-003 merge.

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

## Phase 2 Scope Notes

PENDING — awaiting P8-001/P8-002/P8-003 merge.
