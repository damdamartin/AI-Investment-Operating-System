# Paper Order Intent Pipeline (P6-001)

Version: 0.1.0
Status: Draft
Last Updated: 2026-07-29
Related Docs: 07_Trading_System.md, 11_AI_RULES.md, docs/reviews/Codex_Phase5_Final_Closure_Review.md, docs/tasks/phase6_claude_worktree_tasks/P6-001_paper_order_intent_pipeline.md

## Purpose

This document describes the paper-only order intent pipeline implemented for
Phase 6 task P6-001. It connects a candidate strategy decision (an
`OrderIntent` built from a `Signal`) to the paper-trading simulation lifecycle
without ever creating, or being able to create, a real broker write command.

## Scope

Implemented in:

- `src/application/paper-trading/paper-trading-engine.ts`
  - `PaperTradingEngine` (existing, strengthened)
  - `PaperOrderIntentPipeline` (new)
- `src/application/execution-simulation/order-execution-simulation-service.ts`
  - `OrderExecutionSimulationService` (existing, strengthened)

This pipeline is paper-only. It does not call `OrderApprovalEngine` (the
live-oriented broker-write approval gate owned by Phase 6 task P6-003) because
that engine requires a live-write-capable `BrokerAccount` and verified Toss
broker capability to approve anything. Reusing it here would either make paper
trading depend on live broker readiness, or create a path where a "paper
approval" could be confused with a live one. Instead, `PaperOrderIntentPipeline`
implements its own paper-appropriate gate directly against `RiskCheck` and
`MoneyCheck`, and explicitly rejects (never approves) any candidate that
carries a live-write-capable `BrokerAccount`.

## Flow

```text
Signal (strategy decision)
-> OrderIntent (candidate, CREATED)
-> PaperOrderIntentPipeline.evaluate()
     - risk check present and passing?
     - money check present and passing?
     - no live-write-capable broker account attached?
-> decision: ACCEPTED | REJECTED | DEFERRED
-> PaperTradingEngine.submit() (paper order, never a broker order)
-> PaperOrderIntentAuditContext (decision lineage, sanitized)
```

## Decision Categories

- `ACCEPTED`: risk check and money check are both present and passing, and no
  live-write-capable broker account was attached. A paper order is submitted
  into the simulated lifecycle (`PaperOrder.status = "SUBMITTED"`).
- `REJECTED`: at least one supplied gate actively vetoed the candidate — a
  present risk check that fails, a present money check that fails, or a
  live-write-capable broker account. This is a hard stop with a concrete
  reason code and must never be silently retried.
- `DEFERRED`: every reason code present reflects a *missing* input
  (`missing_risk_check` and/or `missing_money_check`) and nothing else. The
  candidate has not been actively vetoed; it simply cannot be decided until
  the missing check is supplied.

Reason codes are always returned as an explicit array (`reasonCodes`) on both
the top-level pipeline result and the sanitized audit context, so a caller can
always answer "why was this accepted, rejected, or deferred?"

## Safety Guarantees

- Every output type in this pipeline carries a literal `liveBrokerWriteAllowed: false`
  field (not a computed boolean) — `PaperOrder`, `PaperTradingResult`,
  `SimulatedExecutionCommand`, `SimulatedExecutionRecord`, and
  `PaperOrderIntentPipelineResult` / `PaperOrderIntentAuditContext`. This
  mirrors the existing convention used throughout the Phase 5 read-only Toss
  code (see `src/application/toss/*`).
- `PaperOrderIntentPipelineResult` additionally carries `nonBrokerPaperOnly: true`
  and `notLiveExecutable: true`.
- There is no code path in `paper-trading-engine.ts` or
  `order-execution-simulation-service.ts` that constructs a
  `BrokerWriteCommandGuardInput`, a `SUBMIT_ORDER` / `CANCEL_ORDER` /
  `REPLACE_ORDER` command, or any object shaped like a Toss order request
  (no account number, no order-type field, no submit/cancel/replace verb).
  Making it "impossible", not merely "rejected", follows from the fact that
  the pipeline never imports `BrokerWriteCommandGuard`, `TossSecuritiesAdapter`,
  or any HTTP client, and never accepts a generic/parameterizable command
  shape a caller could repurpose into one.
- A live-write-capable `BrokerAccount` attached to a candidate always produces
  `REJECTED`, never `ACCEPTED` or `DEFERRED` — an active safety violation
  attempt is never treated as merely "awaiting more information."

## Audit Context

`PaperOrderIntentAuditContext` preserves enough decision lineage to
reconstruct why a candidate was accepted, rejected, or deferred:

- candidate id, order intent id, approval id
- strategy id and strategy version id
- asset id, symbol, side, signal direction
- decision and reason codes
- risk check result and money check result (result enum only, not full check
  payloads)
- a masked broker account reference (`BrokerAccount.maskedExternalRef()`),
  never the raw external account reference
- evaluation timestamp

It deliberately excludes secrets, access tokens, raw broker payloads, and raw
account identifiers, and is safe to pass through `AuditLogService`, which
additionally redacts any accidental secret-shaped keys before storage.

## Out of Scope

This pipeline does not implement, and must never be extended to implement:

- real Toss order submission, cancellation, or replacement
- any HTTP or network call
- a generic/parameterizable broker write command shape
- production capital use
