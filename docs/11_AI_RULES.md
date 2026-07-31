# 11 AI Rules

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-27  
Related Docs: 01_Project_Vision.md, 02_System_Architecture.md, 05_API_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 10_Claude_Code_Guide.md

## 1. Document Purpose

This document defines non-negotiable rules for all AI agents working on AI Investment Operating System.

These rules apply to:

- Claude API inside the product
- Claude Code implementation sessions
- Codex review and implementation sessions
- any future AI agent added to the project

The central rule is:

> AI may analyze, research, audit, and implement. AI must not bypass safety controls or directly control capital.

## 2. Rule Priority

If documents conflict, follow this priority:

1. `11_AI_RULES.md`
2. `01_Project_Vision.md`
3. `02_System_Architecture.md`
4. `07_Trading_System.md`
5. task-specific documents

If a task conflicts with this document, the task is invalid until reviewed.

## 3. Non-Negotiable Trading Rules

### Rule 1: AI Must Base All Orders on Data, Never on Arbitrary Judgment

AI may only generate trading signals and recommendations based on quantifiable data and pre-defined rules. AI must never make arbitrary, judgmental, or discretionary trading decisions.

**Forbidden (Arbitrary AI Decision-Making):**

```text
- AI feeling/intuition-based trading
- AI guessing market direction without data
- AI overriding risk rules based on confidence
- AI making discretionary allocation changes
- AI changing strategy parameters mid-trade
```

**Required (Data-Driven Decision-Making):**

```text
All signals must be generated from:
- Market data (price, volume, volatility)
- News analysis (quantified sentiment)
- Technical indicators (objective thresholds)
- Risk metrics (measured exposure)
- Portfolio state (current holdings)

Zero subjective override capability for AI.
```

**Technical Implementation:**

```text
Signal (Data-driven)
├─ Market: prices, volume, trend
├─ News: analyzed sentiment scores
├─ Technical: indicator thresholds
└─ Strategy: rule-based scoring

-> OrderIntent (Deterministic)
   ├─ quantity = f(risk_limits, portfolio_state)
   └─ price = market_price + defined_offset

-> RiskCheck (Objective)
   ├─ max_order_amount
   ├─ max_position_ratio
   ├─ max_portfolio_exposure
   └─ kill_switch_status

-> MoneyCheck (Deterministic)
   ├─ available_cash
   ├─ allocation_rules
   └─ settlement_state

-> OrderApproval (Automatic if all pass)

-> BrokerAdapter (Toss / Korean Investment)
```

**What This Means:**

✅ AI analyzes market data and generates signals
✅ AI follows pre-approved strategy rules
✅ AI respects risk limits without exception
✅ AI is fully auditable and traceable

❌ AI does NOT make subjective calls
❌ AI does NOT override risk rules
❌ AI does NOT use "confidence" to increase risk
❌ AI does NOT change strategy on the fly

### Rule 2: News Alone Must Never Trigger an Order

News may influence analysis and scoring.

News must not directly create an executable order.

Required:

- deduplication
- source review
- asset mapping
- AI or rule-based event assessment
- market confirmation
- strategy signal
- risk check
- money check
- order approval

### Rule 3: Signal Is Not Order

A signal is only a candidate action.

It must not be submitted to the broker.

### Rule 4: Every Order Must Pass Approval Gates

Every live order must pass:

1. Risk Engine
2. Money Management Engine
3. Order Approval Engine
4. Broker capability check
5. Reconciliation state check

If any gate is unavailable, the order is blocked.

### Rule 5: Risk Engine Has Veto Authority

Risk Engine may reject any signal regardless of:

- AI confidence
- backtest performance
- strategy score
- user preference
- recent profit

Capital protection overrides opportunity capture.

## 4. AI Analysis Rules

### Rule 6: AI Output Must Be Structured for Trading-Relevant Use

Trading-relevant AI output must pass schema validation.

Free-form prose alone cannot be used for order approval.

### Rule 7: Invalid AI Output Is Rejected

AI output is rejected when:

- JSON parsing fails
- schema validation fails
- required fields are missing
- confidence is missing
- data freshness is unclear
- output contains unsupported values

Rejected AI output may be stored for debugging but must not influence live trading.

### Rule 8: Low Confidence Cannot Increase Conviction

Low-confidence AI analysis may reduce confidence, trigger review, or block use.

It must not increase position size or trade urgency.

### Rule 9: AI Must Report Uncertainty

Prompts and schemas must require:

- confidence
- evidence
- risks
- contradictions
- unknowns
- requires_review flag

AI output that hides uncertainty is not suitable for trading use.

## 5. Strategy Rules

### Rule 10: Unverified Strategies Must Not Touch Production Capital

Every new or changed strategy must follow:

```text
Research
-> Backtest
-> Walk-Forward Validation
-> Shadow Portfolio
-> Paper Trading
-> Small-Capital Live
-> Production
```

No direct promotion to production is allowed.

### Rule 11: Strategy Versions Are Immutable After Approval

Approved strategy versions must not be edited in place.

Any change creates a new strategy version.

### Rule 12: AI May Propose Strategy Changes, Not Apply Them Directly

AI may generate:

- strategy hypotheses
- parameter candidates
- improvement suggestions
- promotion review summaries

AI must not directly:

- activate production strategy
- increase allocation
- increase risk limit
- skip validation

### Rule 13: Overfitting Must Be Actively Checked

AI-generated strategies must be checked for:

- too many parameters
- short-window overperformance
- sector-specific overfit
- sensitivity to small parameter changes
- performance disappearing after costs
- weak out-of-sample results

## 6. Broker and API Rules

### Rule 14: Broker Behavior Must Be Verified, Not Assumed

Any uncertain Toss Securities API capability must be marked:

```text
UNVERIFIED
```

Unverified capabilities cannot be used in production.

### Rule 15: No Blind Retry of Broker Writes

Order submit, cancel, and replace operations must not be blindly retried.

If broker state is uncertain:

```text
pause dependent trading
query broker state
run reconciliation
```

### Rule 16: Unknown Broker State Blocks Dependent Trading

Unknown broker state is not the same as failure.

It must be represented as:

```text
UNKNOWN_REQUIRES_RECONCILIATION
```

Related trading must pause until resolved.

### Rule 17: Toss Securities API Access Is Adapter-Only

Only `TossSecuritiesAdapter` may call Toss Securities API.

No domain, strategy, AI, dashboard, or task code may call Toss directly.

## 7. Data and Secret Rules

### Rule 18: Secrets Must Not Enter Git

Never commit:

- Toss API credentials
- Naver client secret
- Claude API key
- account passwords
- certificate files
- access tokens
- refresh tokens

### Rule 19: Secrets Must Not Enter AI Prompts

No prompt may include:

- API keys
- broker tokens
- account passwords
- authorization headers
- certificate data

### Rule 20: Money Must Include Currency

AI-generated code must not represent money as naked numbers.

Every money amount needs currency.

### Rule 21: Raw External Payloads Must Be Redacted

Logs and stored payloads must redact:

- authorization headers
- access tokens
- refresh tokens
- secrets
- unnecessary account identifiers

## 8. Operation Rules

### Rule 22: Fail Closed

When uncertain, the system must choose:

```text
no trade
pause
block
alert
reconcile
```

not:

```text
guess
continue
force order
ignore
```

### Rule 23: Kill Switch Must Not Be Bypassed

Active kill switch blocks new live orders in its scope.

No AI, user interface, strategy, or worker may bypass it.

### Rule 24: Normal Operation Should Be Quiet

AI must not design notification flows that spam the user during normal operation.

Immediate alerts should focus on exceptions:

- order failure
- broker uncertainty
- kill switch activation
- risk breach
- reconciliation mismatch
- system outage

### Rule 25: Recovery Requires Reconciliation

After serious failure or restart, production trading must remain disabled until:

- broker state is checked
- open orders are known
- fills are reconciled
- positions match
- cash balances match or mismatch is accepted by policy

## 9. Development Rules for AI Agents

### Rule 26: Read the Relevant Docs Before Coding

AI coding agents must read relevant docs before implementation.

Minimum:

- `01_Project_Vision.md`
- `02_System_Architecture.md`
- `11_AI_RULES.md`
- task-related docs

### Rule 27: Do Not Refactor Across Boundaries Without Permission

Broad refactors require explicit task scope.

Do not merge unrelated changes into safety-critical work.

### Rule 28: Add Tests for Safety Behavior

Any code touching trading, AI, API, risk, money, order, or broker behavior must include tests.

### Rule 29: Do Not Convert Warnings Into Silent Behavior

If behavior is unsafe or unknown, expose it.

Do not hide:

- failed checks
- rejected orders
- invalid AI output
- reconciliation mismatch
- unverified broker capability

### Rule 30: Do Not Optimize Away Auditability

Performance improvements must not remove:

- audit records
- domain events
- strategy version references
- order approval evidence
- AI analysis references
- raw payload references where needed

## 10. Enforcement

If an AI agent detects a rule violation, it must:

1. stop the unsafe work
2. explain the violated rule
3. propose a safe alternative
4. update docs or tests if needed

If code already violates a rule, the fix is higher priority than feature work.

## 11. Final AI Rule Statement

AI Investment Operating System may use AI deeply, but never blindly.

The safe structure is:

```text
AI proposes
systems validate
risk controls veto
approved adapters execute
audit remembers
```

Any design that gives AI unchecked authority over capital is outside the project.

