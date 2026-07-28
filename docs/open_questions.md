# Open Questions

Version: 0.3.0
Status: Active
Last Updated: 2026-07-28

## Purpose

This document tracks unresolved architecture, API, data, compliance, testing, and operation questions.

Questions in this document should be resolved before related implementation tasks are assigned.

## Phase 5 Evidence Status Fields (OQ-001 through OQ-004)

OQ-001 through OQ-004 carry an additional `Evidence Status` block. This
exists because Phase 5 collects sanitized read-only Toss evidence for these
four questions, and evidence must never be confused with resolution.

Full policy, the seven-state model, and per-question notes on what evidence
does and does not authorize:

- `docs/phase5/open-question-evidence-policy.md`

Short version:

- `Evidence status` here is one of `NO_EVIDENCE`, `EVIDENCE_COLLECTED`, `EVIDENCE_SANITIZED` (computed by `TossOpenQuestionEvidenceTracker`), or `EVIDENCE_REVIEWED` (recorded by a human only, after actually reading sanitized evidence).
- `Status` (`OPEN` / `IN_REVIEW` / `RESOLVED`) at the top of each question may only move to `IN_REVIEW` after a human has recorded `Evidence status: EVIDENCE_REVIEWED` with a reviewer and reviewed date, and may only move to `RESOLVED` after an explicit recorded decision.
- No amount of sanitized evidence, by itself, authorizes Toss order creation, Toss order cancellation, Toss order replacement, live capital use, or production reconciliation based on unverified identifiers. Live trading remains blocked regardless of `Status` on these four questions; see `docs/11_AI_RULES.md`.

## Status Values

```text
OPEN
IN_REVIEW
RESOLVED
DEFERRED
BLOCKED
```

## Priority Values

```text
CRITICAL
HIGH
MEDIUM
LOW
```

## Questions

### OQ-001: Toss Securities Automated Trading Permission

Priority: CRITICAL
Status: OPEN
Related Docs: 13_Compliance_and_Legal_Review.md, 05_API_Architecture.md, 07_Trading_System.md

Question:

Does Toss Securities permit the intended API-based automated trading behavior, including unattended cloud execution?

Blocks:

- live broker write operations
- small-capital live trading

Evidence Status:

```text
Evidence status: NO_EVIDENCE
Evidence manifest reference: none
Reviewer: none
Reviewed date: none
Decision: none
Remaining blockers: live broker write operations remain blocked regardless of evidence status; see docs/11_AI_RULES.md and docs/phase5/open-question-evidence-policy.md
```

### OQ-002: Toss Account and Permission Model

Priority: HIGH
Status: OPEN
Related Docs: 03_Domain_Model.md, 04_Database_Architecture.md, 07_Trading_System.md

Question:

What Toss account identifiers and permission states are exposed through the API, and how should they map to internal `BrokerAccount` and logical `Portfolio` records?

Blocks:

- production reconciliation
- live order execution

Evidence Status:

```text
Evidence status: NO_EVIDENCE
Evidence manifest reference: none
Reviewer: none
Reviewed date: none
Decision: none
Remaining blockers: production reconciliation and live order execution remain blocked regardless of evidence status; see docs/11_AI_RULES.md and docs/phase5/open-question-evidence-policy.md
```

### OQ-003: Toss Order and Fill Identifiers

Priority: HIGH
Status: OPEN
Related Docs: 05_API_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md

Question:

Does Toss provide stable order and fill identifiers suitable for idempotency, duplicate prevention, and reconciliation?

Blocks:

- broker write retry policy
- reconciliation design

Evidence Status:

```text
Evidence status: NO_EVIDENCE
Evidence manifest reference: none
Reviewer: none
Reviewed date: none
Decision: none
Remaining blockers: broker write retry policy and reconciliation design remain blocked regardless of evidence status; see docs/11_AI_RULES.md and docs/phase5/open-question-evidence-policy.md
```

### OQ-004: Toss ETF, Fractional, and Extended-Hours Support

Priority: HIGH
Status: OPEN
Related Docs: 05_API_Architecture.md, 07_Trading_System.md

Question:

Which Korean ETF, U.S. ETF, fractional, and extended-hours order features are supported and permitted?

Blocks:

- ETF production trading
- fractional orders
- extended-hours trading

Evidence Status:

```text
Evidence status: NO_EVIDENCE
Evidence manifest reference: none
Reviewer: none
Reviewed date: none
Decision: none
Remaining blockers: ETF production trading, fractional orders, and extended-hours trading remain blocked regardless of evidence status; see docs/11_AI_RULES.md and docs/phase5/open-question-evidence-policy.md
```

### OQ-005: Historical Market Data Provider

Priority: HIGH
Status: OPEN
Related Docs: 04_Database_Architecture.md, 08_Testing_Validation.md, 99_Development_Roadmap.md

Question:

Which provider will supply historical price, volume, dividend, split, and corporate action data for backtesting and walk-forward validation?

Blocks:

- credible backtesting
- walk-forward validation

### OQ-006: Corporate Action Normalization

Priority: HIGH
Status: OPEN
Related Docs: 03_Domain_Model.md, 04_Database_Architecture.md, 08_Testing_Validation.md

Question:

How will splits, reverse splits, dividends, ETF distributions, symbol changes, mergers, delistings, and trading halts be represented and applied?

Blocks:

- adjusted backtesting
- accurate live portfolio history

### OQ-007: Tax and Fee Assumption Source

Priority: HIGH
Status: OPEN
Related Docs: 04_Database_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 13_Compliance_and_Legal_Review.md

Question:

What fee, tax, withholding, and FX assumptions should be used for Korean and U.S. stocks and ETFs?

Blocks:

- cost-adjusted strategy validation
- accurate PnL reporting

### OQ-008: Strategy Promotion Thresholds

Priority: HIGH
Status: OPEN
Related Docs: 06_AI_Architecture.md, 08_Testing_Validation.md, 99_Development_Roadmap.md

Question:

What are the default minimum sample size, validation duration, maximum drawdown, performance degradation, and correlation thresholds for each strategy family?

Blocks:

- automatic or semi-automatic promotion
- production strategy activation

### OQ-009: Dashboard Authentication

Priority: MEDIUM
Status: OPEN
Related Docs: 09_Operation_Deployment.md

Question:

Which authentication method, MFA policy, session timeout, and sensitive action confirmation flow will be used for the dashboard?

Blocks:

- production dashboard control actions

### OQ-010: Queue and Outbox Implementation

Priority: MEDIUM
Status: OPEN
Related Docs: 04_Database_Architecture.md, 09_Operation_Deployment.md

Question:

Which queue and outbox implementation will be used, and what retry semantics apply by event type?

Blocks:

- production execution workers

## Final Note

Questions marked `CRITICAL` or `HIGH` must be resolved or explicitly accepted before related development tasks are assigned.

