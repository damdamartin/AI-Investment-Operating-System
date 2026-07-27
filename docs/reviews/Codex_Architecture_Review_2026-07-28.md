# Codex Architecture Review

Version: 0.1.0  
Status: Draft  
Review Date: 2026-07-28  
Reviewed Scope: `docs/*.md`, `docs/reviews/*.md`

## Executive Summary

The documentation foundation is strong enough to move into a formal revision phase before implementation. The core safety posture is consistent across the documents:

- AI is not the trader.
- News is not a direct order trigger.
- Signal is not order.
- Every live order must pass Risk Engine, Money Management Engine, and Order Approval Engine.
- Toss Securities access is adapter-only.
- Unknown broker state blocks dependent trading.
- Shadow Portfolio and Paper Trading do not use real capital.
- The default under uncertainty is no trade.

No critical contradiction was found in the core order execution safety boundary.

However, the project should not move directly into implementation yet. Several high-priority architecture gaps should be addressed in a `0.2.x` documentation revision before generating Claude Code implementation tasks.

The most important missing areas are:

1. legal, regulatory, and broker terms-of-service review requirements
2. explicit broker account model
3. historical market data provider strategy
4. corporate actions and dividends
5. strategy promotion thresholds
6. tax and fee modeling
7. dashboard access control and operator security

## Critical Findings

No critical findings were identified.

The current documents consistently prevent the most dangerous architecture failures:

- direct AI-to-broker order execution
- direct news-to-order execution
- strategy signal bypassing risk and money controls
- unverified broker capability being treated as production-ready
- unknown broker state being treated as ordinary failure

## High Findings

### H1: Legal, Regulatory, and Broker Terms Review Is Not a First-Class Workstream

Severity: High  
Files: `01_Project_Vision.md`, `09_Operation_Deployment.md`, `99_Development_Roadmap.md`

Issue:

The project explicitly handles live automated stock and ETF trading, but there is no dedicated compliance or legal review phase. The documents say this is a personal system and not public advisory, but they do not require verification of:

- Toss Securities API terms of use
- automated trading restrictions
- domestic and overseas securities trading requirements
- tax reporting obligations
- data provider licensing constraints
- whether strategy outputs could become regulated investment advice if shared

Why it matters:

The system may be technically safe but still operationally invalid if it violates broker terms, data licensing terms, or regulatory requirements. This is especially important before live trading or cloud deployment.

Recommended fix:

Add a new compliance section to `01_Project_Vision.md`, `09_Operation_Deployment.md`, and `99_Development_Roadmap.md`.

Add a Phase gate:

```text
No live broker write operation until broker API terms, account permissions, tax implications, and personal-use boundaries are reviewed.
```

Consider adding:

```text
13_Compliance_and_Legal_Review.md
```

or include compliance as a required section in Phase 9 before small-capital live trading.

### H2: Broker Account Model Is Underdefined

Severity: High  
Files: `03_Domain_Model.md`, `04_Database_Architecture.md`, `07_Trading_System.md`

Issue:

The documents model `Portfolio`, `CashBalance`, `Position`, and broker orders, but they do not define a first-class `BrokerAccount` or `BrokerAccountMapping`.

Current portfolio modeling leaves an open question:

> Should a portfolio map one-to-one with a broker account or support virtual sub-portfolios?

Why it matters:

For real trading, the system must know which Toss account is being queried or traded against. Virtual portfolios, production portfolios, paper portfolios, and shadow portfolios should not blur the real broker account boundary.

Missing account boundaries can cause:

- incorrect buying power calculations
- incorrect reconciliation
- unsafe multi-account extension later
- difficulty redacting account identifiers
- confusion between virtual and real portfolios

Recommended fix:

Add domain objects:

```text
BrokerAccount
BrokerAccountMapping
BrokerAccountPermission
```

Add database tables:

```text
broker_accounts
portfolio_broker_account_links
broker_account_permissions
```

Clarify:

- one real Toss account can have multiple logical portfolios only through virtual allocation
- production order execution must always resolve to one verified BrokerAccount
- shadow, paper, and backtest portfolios must never resolve to live broker write permissions

### H3: Historical Market Data and Corporate Actions Are Not Sufficiently Specified

Severity: High  
Files: `03_Domain_Model.md`, `04_Database_Architecture.md`, `08_Testing_Validation.md`, `99_Development_Roadmap.md`

Issue:

Backtesting and walk-forward validation are central to the system, but the architecture does not yet define how historical market data will be sourced, normalized, adjusted, or audited.

It also lacks explicit handling for corporate actions:

- stock splits
- reverse splits
- dividends
- ETF distributions
- symbol changes
- mergers
- delistings
- trading halts

Why it matters:

Backtest results can become misleading if historical prices are not adjusted correctly. Production position tracking can also break when splits, symbol changes, or distributions occur.

Recommended fix:

Add domain and database models:

```text
HistoricalPriceBar
CorporateAction
DividendDistribution
SymbolChange
TradingHalt
AdjustmentFactor
```

Add a historical data provider adapter concept, separate from Toss read APIs unless Toss is verified to provide all required history.

Add tests for:

- split-adjusted backtest
- dividend-inclusive return
- symbol change mapping
- ETF distribution accounting
- delisting or suspended asset behavior

### H4: Strategy Promotion Criteria Are Too Qualitative

Severity: High  
Files: `06_AI_Architecture.md`, `08_Testing_Validation.md`, `99_Development_Roadmap.md`

Issue:

The documents correctly require backtest, walk-forward validation, Shadow Portfolio, Paper Trading, and small-capital live validation. However, they do not define even conservative default numeric thresholds.

Open questions remain for:

- minimum trade count
- minimum Shadow Portfolio duration
- minimum Paper Trading duration
- maximum allowed drawdown
- maximum strategy correlation
- minimum cost-adjusted performance
- acceptable live-vs-backtest degradation

Why it matters:

Without default thresholds, Claude Code may implement a promotion system that is structurally correct but unable to make consistent decisions.

Recommended fix:

Add a default `Strategy Promotion Gate v0.1` section to `08_Testing_Validation.md`.

Example placeholders:

```text
minimum sample size: TBD by strategy family, default blocked until specified
maximum drawdown: strategy-specific, default blocked until specified
live degradation threshold: default blocked until specified
minimum Shadow Portfolio period: default 1-3 months unless strategy family requires longer
manual approval: required for all production promotions in v1
```

The values can remain conservative placeholders, but the policy should say that missing thresholds block promotion.

### H5: Tax and Fee Modeling Is Mentioned but Not Architecturally Owned

Severity: High  
Files: `04_Database_Architecture.md`, `07_Trading_System.md`, `08_Testing_Validation.md`

Issue:

Fees, taxes, and currency effects are repeatedly required, but no dedicated ownership is defined. There is no `CostModel`, `TaxModel`, or `FeeSchedule` component.

Why it matters:

Strategy validation and order sizing depend on realistic costs. U.S. and Korean stocks/ETFs have different fee, tax, withholding, and currency implications.

Recommended fix:

Add components:

```text
CostModel
FeeModel
TaxModel
SlippageModel
CurrencyConversionModel
```

Add database support for versioned assumptions:

```text
fee_schedules
tax_rules
slippage_assumptions
currency_conversion_assumptions
```

Backtest, Shadow Portfolio, Paper Trading, and live reporting should reference exact cost model versions.

## Medium Findings

### M1: Dashboard Access Control Needs More Concrete Requirements

Severity: Medium  
Files: `09_Operation_Deployment.md`, `11_AI_RULES.md`

Issue:

Roles are defined as `OWNER`, `OPERATOR`, `VIEWER`, and `SYSTEM`, but authentication, session security, and control confirmation requirements are still broad.

Recommended fix:

Define minimum controls:

- strong password or OAuth provider
- optional MFA for production controls
- session timeout
- audit record for sensitive actions
- separate confirmation for kill switch deactivation
- read-only dashboard mode by default

### M2: Outbox and Job Queue Design Is Conceptual but Not Yet Task-Ready

Severity: Medium  
Files: `04_Database_Architecture.md`, `09_Operation_Deployment.md`, `10_Claude_Code_Guide.md`

Issue:

The outbox pattern is recommended, but table structure and worker semantics are not defined enough for implementation.

Recommended fix:

Add an `outbox_events` table definition:

```text
id
event_type
payload
status
available_at
attempt_count
last_error
created_at
processed_at
```

Define retry policy by event type, especially for broker write commands.

### M3: Market Regime Model Is Referenced but Not Defined

Severity: Medium  
Files: `06_AI_Architecture.md`, `07_Trading_System.md`, `99_Development_Roadmap.md`

Issue:

Market regime is referenced for strategy fit and Strategy Diversity Engine, but there is no domain object or classification method.

Recommended fix:

Add:

```text
MarketRegime
MarketRegimeClassifier
```

Start with a conservative manual or rule-based model before AI-assisted classification.

### M4: Data Licensing Is Not Distinguished From API Access

Severity: Medium  
Files: `05_API_Architecture.md`, `08_Testing_Validation.md`, `09_Operation_Deployment.md`

Issue:

Naver, Toss, and future historical data providers may have access terms that differ from technical API availability.

Recommended fix:

Add a `Data License and Usage Constraints` section to API and operation docs.

### M5: Development Tasks Are Not Yet Generated

Severity: Medium  
Files: `10_Claude_Code_Guide.md`, `99_Development_Roadmap.md`

Issue:

The guide defines task format and first sessions, but `docs/tasks/` does not exist yet.

Recommended fix:

After Phase 2 revisions, generate `docs/tasks/` with the first 50-100 tasks and dependencies.

## Low Findings

### L1: Version Numbers Are Document-Wide but Not Yet Per-Document Lifecycle Managed

Severity: Low  
Files: all docs

Issue:

Most docs are `Version: 0.1.0`, while `12_CHANGELOG.md` is `0.1.1`. This is acceptable for now, but future revisions should clarify whether versions are per-document or release-wide.

Recommended fix:

Add a short versioning note in `docs/README.md`.

### L2: Some Open Questions Are Repeated Across Documents

Severity: Low  
Files: multiple docs

Issue:

Open questions about Toss capabilities, Naver U.S. coverage, Claude models, and historical data appear in several documents.

Recommended fix:

Create a central:

```text
docs/open_questions.md
```

or move them into review output and roadmap tracking.

## Cross-Document Contradictions

No major contradictions were found.

Minor consistency note:

- `99_Development_Roadmap.md` lists Phase 1 completed, while individual documents remain `Status: Draft`. This is not a contradiction if Phase 1 means "draft foundation completed." Keep this language explicit.

## Missing Requirements

The following requirements should be added before implementation:

1. Compliance and broker terms review gate.
2. BrokerAccount domain model.
3. Corporate actions and historical data adjustment model.
4. Cost, tax, fee, slippage, and currency conversion model ownership.
5. Default strategy promotion gate policy.
6. Dashboard authentication and sensitive action control requirements.
7. Outbox table and worker retry semantics.
8. Market regime model.
9. Data licensing constraints.

## API Verification Required

Toss Securities:

- account identity and account permission model
- Korean stock order lifecycle
- Korean ETF order lifecycle
- U.S. stock order lifecycle
- U.S. ETF order lifecycle
- order status timing
- fill representation
- partial fill behavior
- stable order and fill identifiers
- cancellation and replacement behavior
- market, limit, fractional, and extended-hours support
- fee, tax, buying power, sellable quantity, and currency conversion support

Naver:

- U.S. stock coverage
- duplicate rate
- old article resurfacing behavior
- date sorting reliability
- quota behavior
- source metadata quality

Claude:

- model choice by task
- schema reliability by prompt
- latency
- cost budget
- data retention settings
- prompt caching and batch support

Historical data provider:

- source not yet selected
- licensing not yet reviewed
- corporate action adjustment not yet defined

## Safety Review

Strengths:

- AI boundary is strong.
- Broker adapter boundary is strong.
- Order approval path is explicit.
- Risk and money controls are mandatory.
- Unknown broker state handling is strong.
- Kill switch is consistently present.
- Shadow and Paper modes are separated from live capital.

Weaknesses:

- compliance/legal gate missing
- strategy promotion thresholds too qualitative
- account model not explicit enough
- corporate action handling missing
- tax and fee ownership unclear

## Testing Review

Strengths:

- test ladder is well-defined
- duplicate order prevention tests are explicit
- stale data tests are explicit
- AI boundary tests are explicit
- broker uncertainty tests are explicit

Needed additions:

- corporate action test cases
- account mapping and redaction tests
- tax and fee model tests
- data licensing review checklist
- strategy promotion threshold tests

## Operations Review

Strengths:

- cloud runtime requirement is clear
- exception-focused alerting is clear
- runbooks are listed
- backup and recovery requirements exist
- post-recovery reconciliation is required

Needed additions:

- dashboard authentication details
- production control MFA or equivalent protection
- outbox worker operational metrics
- compliance review before live operation

## Claude Code Readiness

The docs are close to Claude Code readiness but should not yet generate implementation tasks until high findings are addressed.

Claude Code would likely implement the safety boundary correctly, but could stumble on:

- missing BrokerAccount model
- missing historical data provider model
- missing corporate actions
- missing cost/tax/fee model ownership
- ambiguous strategy promotion thresholds
- broad outbox and queue semantics

## Recommended Document Revisions

Recommended `0.2.x` revisions:

1. Add compliance and legal review requirements.
2. Add BrokerAccount and broker account permission model.
3. Add historical data and corporate action architecture.
4. Add cost, fee, tax, slippage, and currency conversion model ownership.
5. Add explicit strategy promotion gate defaults.
6. Add dashboard authentication and sensitive action controls.
7. Add outbox table and queue semantics.
8. Add central open questions tracker.
9. Update roadmap to include these revisions before task generation.

## Recommended Implementation Order

Do not begin code implementation yet.

Recommended next sequence:

```text
1. Apply Phase 2 review revisions to docs.
2. Create central open questions tracker.
3. Create compliance review placeholder or document.
4. Update domain and database docs for BrokerAccount and corporate actions.
5. Update testing docs with new test requirements.
6. Update roadmap gates.
7. Then generate docs/tasks/ implementation tasks.
```

## Open Questions

- Will this system remain strictly personal, or could outputs be shared with others?
- Does Toss permit the intended form of automated trading under its API terms?
- What historical data provider will be used?
- How will Korean and U.S. corporate actions be normalized?
- What tax assumptions are acceptable for backtest and live PnL?
- Will production dashboard require MFA?
- What is the minimum strategy promotion threshold by strategy family?

## Final Recommendation

Do not move directly to Phase 3 task generation yet.

Move to a Phase 2 revision pass first:

```text
Phase 2A: Resolve high documentation findings.
Phase 2B: Update roadmap and changelog.
Phase 2C: Re-review only changed areas.
Phase 3: Generate development specification and Claude Code tasks.
```

The foundation is solid. The next move is not more architecture expansion for its own sake, but closing the few gaps that would otherwise become expensive or risky during implementation.

