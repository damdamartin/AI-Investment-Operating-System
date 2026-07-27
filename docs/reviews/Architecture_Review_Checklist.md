# Architecture Review Checklist

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-28

## Purpose

This checklist is used during Codex architecture review and later human or AI review passes.

## Safety Boundary

- [ ] AI cannot directly place orders.
- [ ] Claude cannot call Toss Securities API directly.
- [ ] Dashboard cannot bypass Order Approval Engine.
- [ ] News cannot directly trigger orders.
- [ ] Signals cannot become broker orders without approval.
- [ ] Risk Engine has veto authority.
- [ ] Money Management Engine controls sizing and cash.
- [ ] Kill switch blocks new orders in scope.
- [ ] Unknown broker state blocks dependent trading.
- [ ] Unverified broker capability blocks production trading.

## Broker Execution

- [ ] Toss Securities Adapter is the only broker API boundary.
- [ ] Broker order submission requires OrderApproval.
- [ ] Blind retry of broker writes is forbidden.
- [ ] Idempotency or equivalent duplicate-order protection exists.
- [ ] Order status and fill reconciliation are required.
- [ ] Partial fills are modeled.
- [ ] Cancel and replace behavior requires capability verification.

## Data and Audit

- [ ] Money always includes currency.
- [ ] KRW and USD are not mixed without exchange rate.
- [ ] Strategy versions are immutable after approval.
- [ ] Production decisions are reconstructable.
- [ ] AI analyses used in decisions are stored or referenced.
- [ ] Broker responses are stored or referenced.
- [ ] Audit records are append-only.
- [ ] Domain events are append-only.

## AI

- [ ] AI outputs are structured for trading-relevant use.
- [ ] AI output schema validation is required.
- [ ] Low confidence cannot increase conviction.
- [ ] Contradictions trigger review or lower confidence.
- [ ] Prompt templates are versioned.
- [ ] Model changes require evaluation.
- [ ] AI costs are tracked.
- [ ] Secrets cannot enter prompts.

## Strategy Validation

- [ ] New strategies follow the validation ladder.
- [ ] Backtests include costs, taxes, slippage, and currency assumptions.
- [ ] Walk-forward validation is required.
- [ ] Shadow Portfolio uses no real capital.
- [ ] Paper Trading uses no real capital.
- [ ] Small-capital live trading has strict limits.
- [ ] Production promotion requires evidence.
- [ ] Overfitting checks are explicit.

## Operations

- [ ] System can run without local computer.
- [ ] Production trading is disabled by default.
- [ ] Monitoring covers broker, data, orders, AI, risk, and infrastructure.
- [ ] Alerts focus on exceptions.
- [ ] Backups are required.
- [ ] Restore testing is required.
- [ ] Incident response exists.
- [ ] Runbooks exist for critical failures.
- [ ] Recovery requires reconciliation before resuming trading.

## Security

- [ ] Secrets are not committed.
- [ ] Secrets are not logged.
- [ ] Secrets are not stored in raw payloads.
- [ ] API credentials are environment-specific.
- [ ] Access to production controls is restricted.
- [ ] Sensitive actions are audited.

## Claude Code Readiness

- [ ] Required reading is defined.
- [ ] Worktree strategy is defined.
- [ ] Module ownership is defined.
- [ ] Task format is defined.
- [ ] Testing standards are defined.
- [ ] Forbidden shortcuts are defined.
- [ ] Initial parallel development plan is defined.

## API Verification

- [ ] Toss Korean stock order support must be verified.
- [ ] Toss Korean ETF order support must be verified.
- [ ] Toss U.S. stock order support must be verified.
- [ ] Toss U.S. ETF order support must be verified.
- [ ] Toss fractional trading support must be verified.
- [ ] Toss extended-hours support must be verified.
- [ ] Toss order status and fill behavior must be verified.
- [ ] Naver U.S. stock news coverage must be measured.
- [ ] Claude model and rate limits must be verified.

## Final Review Gate

- [ ] Critical findings resolved.
- [ ] High findings resolved or explicitly accepted.
- [ ] Open questions recorded.
- [ ] Docs revised after review.
- [ ] Changelog updated.
- [ ] Phase 3 task generation approved.

