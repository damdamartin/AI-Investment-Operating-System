# Codex Phase 5 Architecture Review

Version: 0.1.0
Status: Draft
Review Date: 2026-07-28
Reviewed Scope: `docs/`, `src/`, `scripts/`, `tests/`

## Executive Summary

Phase 5 is correctly framed as read-only external API evidence work, not live trading. The current documentation and implementation consistently block live Toss Securities write operations, keep secrets out of committed artifacts, and require sanitized evidence before further integration work.

The strongest parts of the design are:

- `docs/11_AI_RULES.md` establishes the highest-priority safety boundary.
- `docs/phase5/README.md` and related Phase 5 runbooks make Toss verification local, explicit, and evidence-based.
- The current Toss Phase 5 code performs local readiness, endpoint catalog, evidence intake, manifest, dry-run, preflight, call-gate, and completion checks without network calls.
- Broker write guarding and compliance gates already fail closed by default.

The main remaining risk is not that Phase 5 currently enables live trading. It does not. The risk is that long-term trading architecture, read-only verification, and future write-capable broker methods are still close enough in some documents that a parallel implementation session could pick the wrong scope unless the next tasks are tightly bounded.

## Phase 5 Decision

Phase 5 may continue only as read-only validation and evidence collection.

Allowed:

- local configuration readiness checks
- endpoint catalog validation
- sanitized evidence intake and manifest work
- dry-run request preparation
- one scoped read-only verification call after the call gate passes
- Naver News data quality measurement with safe fixtures or mocked fetch clients
- Claude structured-output validation with mocked generation or official SDK integration behind secrets

Blocked:

- Toss order creation
- Toss order cancellation
- Toss order replacement
- transfers, withdrawals, or money-moving currency conversion
- production capital use
- raw API response commits
- API keys, tokens, account numbers, or credential-bearing logs

## Findings

### H1: BrokerGateway Write Methods Are Documented Beside Phase 5 Read-Only Work

Severity: High
Files: `docs/05_API_Architecture.md`, `docs/phase5/README.md`, `src/adapters/contracts/toss.ts`

Issue:

`docs/05_API_Architecture.md` lists `submitOrder`, `cancelOrder`, and `replaceOrder` in the required `BrokerGateway` methods. That is valid for the full system, but Phase 5 is read-only. In a parallel development environment, a Claude Code session could interpret the full gateway list as current implementation scope.

Current code partially mitigates this by separating `TossReadOnlyAdapter` from `TossWriteAdapter`, with write commands typed as `never`.

Recommendation:

Add a Phase 5-specific adapter task rule: implement and test only read-only Toss interfaces. Keep write interfaces as compile-time placeholders or guards only. Do not create real HTTP clients for write endpoints.

### H2: Read-Only Endpoint Validation Uses Path Heuristics That May Reject Legitimate Read Endpoints or Miss Vendor-Specific Write Paths

Severity: High
Files: `src/application/toss/read-only-endpoint-catalog.ts`, `docs/phase5/toss-read-only-call-gate.md`

Issue:

The endpoint catalog validator blocks write-looking paths using a keyword pattern. This is useful as a safety screen, but real broker APIs may expose read endpoints whose paths include terms such as `orders` for order status queries. Conversely, a vendor-specific mutation path may not contain any current blocked keyword.

Recommendation:

Keep the heuristic, but require every endpoint item to include an explicit operation class:

- `AUTHENTICATION_READ`
- `ACCOUNT_READ`
- `POSITION_READ`
- `MARKET_DATA_READ`
- `ORDER_STATUS_READ`
- `FILL_READ`

Also require official-source evidence for method, path, request body policy, and mutation risk. The validator should fail closed when operation class and evidence disagree.

### H3: Phase 5 Completion Requires Open Question Evidence, but Open Questions Do Not Yet Distinguish Evidence From Resolution

Severity: High
Files: `docs/open_questions.md`, `docs/phase5/README.md`, `src/application/toss/open-question-evidence-tracker.ts`

Issue:

Phase 5 correctly requires evidence for OQ-001 through OQ-004. However, `docs/open_questions.md` tracks only question status. It does not define how sanitized Phase 5 evidence changes a question from `OPEN` to `IN_REVIEW` or `RESOLVED`.

Why it matters:

Evidence collection could be mistaken for resolution. For example, read-only account evidence can support OQ-002, but it does not by itself authorize live broker writes.

Recommendation:

Add evidence fields to each Phase 5-related open question:

- evidence status
- evidence manifest reference
- reviewer
- reviewed date
- decision
- remaining blockers

Make clear that Phase 5 evidence can move a question to `IN_REVIEW`, but live trading remains blocked until compliance and implementation gates are separately satisfied.

### H4: Toss Read-Only Verification Is Development-Feasible, but Actual Endpoint Paths Must Remain Unverified Until Official Evidence Exists

Severity: High
Files: `docs/05_API_Architecture.md`, `docs/phase5/toss-read-only-endpoints.example.json`

Issue:

The architecture is implementable, but not enough official Toss endpoint details are present in the repository to safely implement real calls. This is intentional in Phase 5, but task instructions must preserve it.

Recommendation:

Do not ask Claude Code to guess Toss endpoint paths. Build endpoint catalog tooling, fixtures, redaction, and one-call execution harness only after operator approval and official evidence are available.

### M1: Naver News Adapter Is Feasible, but Data Quality Work Needs Separate Measurement Tasks

Severity: Medium
Files: `docs/05_API_Architecture.md`, `docs/06_AI_Architecture.md`, `src/adapters/naver/naver-news-adapter.ts`

Issue:

The Naver News adapter shape is feasible and already normalizes basic fields, strips simple HTML entities, and produces duplicate keys. Phase 5 still needs data quality measurement for duplicate rates, resurfaced old articles, source consistency, and U.S. stock coverage.

Recommendation:

Create a separate read-only measurement task using fixtures and, later, sanitized result summaries. Do not let news quality measurement create signals or orders.

### M2: Claude Adapter Is Feasible, but Production Integration Needs Prompt and Model Version Evidence

Severity: Medium
Files: `docs/06_AI_Architecture.md`, `docs/05_API_Architecture.md`, `src/adapters/claude/claude-adapter.ts`

Issue:

The Claude adapter is development-feasible because the current implementation accepts an injected `generate` function and validates structured output. For production use, the project still needs prompt template version records, model availability evidence, rate-limit behavior, token usage logging, and privacy/data-retention review.

Recommendation:

Keep Phase 5 Claude work fixture-first. If a real Claude API integration is added later, it must use local secrets, never send broker secrets or account identifiers, and record only sanitized metadata.

### M3: Evidence Sanitization Rules Are Strong, but Raw Payload Storage Policy Needs a Phase 5 Exception

Severity: Medium
Files: `docs/05_API_Architecture.md`, `docs/phase5/README.md`

Issue:

The general API architecture allows raw payload storage after redaction. Phase 5 says raw Toss responses must not be committed. Both are reasonable, but the priority should be explicit: Phase 5 uses summaries and sanitized previews only.

Recommendation:

Add a note to the API raw payload section that Phase 5 Toss evidence is stricter than the general future production policy.

### M4: Completion Gate Requires Operator Approval, but the Approval Artifact Is Environment-Only

Severity: Medium
Files: `docs/phase5/toss-read-only-call-gate.md`, `scripts/phase5-toss-call-gate.mjs`

Issue:

The call gate uses `PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true`. That is good for local fail-closed behavior, but the approval event should also have a sanitized audit note so future reviewers know who approved the one scoped call and why.

Recommendation:

Add an optional sanitized approval record schema that excludes secrets and account numbers. Keep it local or public-safe only.

## API Development Feasibility

### Toss Securities API

Feasible with constraints.

The current Phase 5 implementation is safe because it does not call the network and does not implement real write calls. A real read-only call harness is feasible only after:

- local secrets are configured outside Git
- endpoint catalog entries are backed by official evidence
- preflight passes
- call gate passes
- the next task is limited to exactly one documented read-only call
- sanitized evidence is recorded

Not feasible yet:

- live order submission
- live order cancellation
- live order replacement
- money movement
- production reconciliation based on unverified Toss identifiers

### Naver News API

Feasible.

The current adapter boundary is implementable with a fetch-compatible client and fixture tests. Remaining Phase 5 work should focus on quality measurement, not trading decisions:

- duplicate rate
- old article resurfacing
- source consistency
- Korean company ambiguity
- U.S. stock and ETF coverage quality
- rate-limit and error-format behavior

### Claude API

Feasible.

The current adapter shape is appropriate for safe development because generation is injected and outputs are schema-validated. Remaining Phase 5 work should focus on:

- schema fixture coverage
- prompt template version references
- invalid-output rejection
- token usage metadata
- cost metadata
- privacy redaction before prompts

Claude must not receive Toss secrets, account identifiers, or raw broker payloads.

## Recommended Claude Code Task Split

Create narrowly owned tasks under `docs/tasks/phase5_claude_worktree_tasks/`.

Recommended order:

1. Task P5-001: Phase 5 scope clarification and open-question evidence policy
2. Task P5-002: Toss read-only endpoint catalog hardening
3. Task P5-003: Toss sanitized approval and one-call evidence harness design
4. Task P5-004: Naver News data quality measurement fixtures
5. Task P5-005: Claude structured-output evaluation fixtures
6. Task P5-006: Phase 5 preflight and completion regression coverage

These tasks can run in parallel if each session owns only its assigned files and does not touch real secrets or broker write operations.

## Required Checks

After any task:

```bash
npm run check
```

Additional useful local checks:

```bash
npm run phase5:toss:preflight
npm run phase5:toss:doctor
npm run phase5:toss:completion
```

These commands must not perform network calls.

