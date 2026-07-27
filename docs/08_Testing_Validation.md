# 08 Testing Validation

Version: 0.2.0
Status: Draft
Last Updated: 2026-07-28
Related Docs: 02_System_Architecture.md, 03_Domain_Model.md, 04_Database_Architecture.md, 05_API_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 09_Operation_Deployment.md, 10_Claude_Code_Guide.md, 11_AI_RULES.md, 13_Compliance_and_Legal_Review.md

## 1. Document Purpose

This document defines the testing and validation strategy for AI Investment Operating System.

It covers software tests, API tests, data quality validation, AI evaluation, strategy validation, backtesting, walk-forward validation, Shadow Portfolio, Paper Trading, small-capital live trading, production readiness, and regression testing.

The central principle is:

> Nothing touches production capital until it has passed the correct validation stage.

## 2. Testing Philosophy

The system handles real capital, so testing must focus on loss prevention, correctness, and auditability before return.

Testing priorities:

1. prevent unsafe orders
2. prevent duplicate orders
3. detect stale or invalid data
4. verify risk and money controls
5. verify broker state reconciliation
6. verify AI cannot bypass deterministic controls
7. verify strategy results after realistic costs
8. verify failures stop trading safely

A profitable backtest is not sufficient validation.

## 3. Validation Ladder

Every strategy or trading capability must move through a ladder.

```text
Unit Tests
-> Integration Tests
-> Contract Tests
-> Backtest
-> Walk-Forward Validation
-> Shadow Portfolio
-> Paper Trading
-> Small-Capital Live
-> Production
```

Skipping stages is not allowed unless the skipped stage is formally declared irrelevant and approved.

## 4. Test Categories

### 4.1 Unit Tests

Unit tests verify isolated logic.

Required targets:

- value objects
- money and currency arithmetic
- quantity precision
- market calendar logic
- asset tradability rules
- strategy scoring functions
- risk limit checks
- money management calculations
- order approval rules
- AI schema validation
- event classification mapping
- idempotency key generation
- state transition validation

Unit tests must not require external APIs.

### 4.2 Integration Tests

Integration tests verify components working together.

Required targets:

- signal to order intent
- order intent to risk check
- risk check to order approval
- order approval to execution command
- broker response to broker order state
- fill to position update
- news article to news event
- Claude output to AIAnalysis
- portfolio snapshot calculation
- alert generation

Integration tests may use local database and mocked external APIs.

### 4.3 Contract Tests

Contract tests verify adapter contracts.

Required adapters:

- TossSecuritiesAdapter
- NaverNewsAdapter
- ClaudeAIAdapter

Contract tests must verify:

- request mapping
- response normalization
- error normalization
- timeout behavior
- retry behavior
- rate limit behavior
- schema validation
- redaction
- raw payload handling

### 4.4 End-to-End Tests

End-to-end tests verify full workflows.

Required flows:

- news collection to event assessment
- signal generation to rejected order
- signal generation to approved simulated order
- approved order to mocked broker accepted state
- partial fill to reconciled position
- broker unknown state to blocked dependent order
- kill switch activation blocks approval
- AI invalid output blocks use
- stale market data blocks order approval

E2E tests should run without real broker orders unless explicitly marked as live verification.

## 5. Safety-Critical Test Cases

The following tests are mandatory before any live trading.

### 5.1 Duplicate Order Prevention

Scenarios:

- order submission times out
- worker retries
- broker accepted first request but response was lost
- same signal is processed twice
- scheduler runs same job twice

Expected behavior:

- no duplicate broker order
- ambiguous state triggers reconciliation
- dependent order is blocked
- alert is raised where needed

### 5.2 Stale Data Rejection

Scenarios:

- old market price
- old exchange rate
- old AI analysis
- old news article resurfacing
- market calendar missing

Expected behavior:

- live order approval blocked
- reason stored
- alert raised if operationally significant

### 5.3 Risk Limit Enforcement

Scenarios:

- daily loss limit reached
- monthly loss limit reached
- max drawdown breached
- order exceeds size limit
- sector concentration exceeded
- cash ratio would fall below minimum

Expected behavior:

- RiskCheck fails or blocks
- OrderApproval rejects
- Kill switch activates when policy requires

### 5.4 AI Boundary Enforcement

Scenarios:

- Claude output suggests buy
- Claude output includes malformed JSON
- Claude output confidence is low
- Claude output says direct action is required
- Claude output contradicts source data

Expected behavior:

- AI output stored only if valid
- AI cannot create BrokerOrder
- invalid output rejected
- low confidence cannot increase conviction
- contradictions trigger review

### 5.5 Broker State Uncertainty

Scenarios:

- order status query fails
- broker returns unknown status
- fill query unavailable
- position differs from internal state

Expected behavior:

- state becomes `UNKNOWN_REQUIRES_RECONCILIATION`
- related trading paused
- alert raised
- reconciliation job scheduled

## 6. Data Quality Validation

Data quality must be validated before use.

Required checks:

- asset has market, type, symbol, currency
- broker mapping is verified
- price has timestamp and source
- price currency matches asset currency
- market calendar exists
- news article has publication time
- AI output schema is valid
- strategy version status is allowed
- portfolio snapshot is fresh
- risk limits are active and versioned

Invalid data may be quarantined for debugging, but must not reach order approval.

## 7. API Validation

### 7.1 Toss Securities API Validation

Before live use, verify:

- authentication
- token refresh
- account query
- cash balance query
- position query
- market data query
- tradable asset query
- buying power query
- sellable quantity query
- order submit
- order cancel
- order replace if supported
- order status query
- fill query
- partial fill behavior
- ETF support
- U.S. market support
- rate limits
- error formats

All capabilities must be recorded in the capability registry.

### 7.2 Naver News API Validation

Verify:

- query behavior
- pagination
- date sorting
- duplicate rate
- daily limit behavior
- error format
- timestamp reliability
- Korean company matching
- U.S. ticker and company coverage

### 7.3 Claude API Validation

Verify:

- request format
- selected model availability
- schema validity rate
- retryable errors
- timeout behavior
- token usage logging
- cost estimation
- prompt template consistency
- structured output parsing

## 8. Backtesting

Backtesting evaluates a strategy using historical data.

Required inputs:

- strategy version
- historical market data
- asset universe
- market calendar
- costs
- taxes
- slippage assumptions
- currency assumptions

Required outputs:

- cumulative return
- annualized return
- maximum drawdown
- volatility
- Sharpe Ratio
- Sortino Ratio
- win rate
- average win
- average loss
- profit factor
- turnover
- cost impact
- benchmark comparison

Rules:

- no future data leakage
- all costs must be included
- assumptions must be stored
- backtest results attach to exact strategy version
- backtest success does not allow production promotion

## 9. Walk-Forward Validation

Walk-forward validation tests robustness outside the training period.

Process:

```text
train on period A
validate on period B
roll forward
repeat
aggregate results
```

Required checks:

- performance stability
- parameter sensitivity
- drawdown consistency
- market regime robustness
- cost-adjusted performance
- degradation from backtest

Failure signs:

- strategy works only in training window
- small parameter change destroys results
- performance disappears after costs
- validation drawdown exceeds allowed limits

## 10. Shadow Portfolio Validation

Shadow Portfolio uses live or near-live data with virtual capital.

Required behavior:

- no real broker orders
- realistic order simulation
- slippage modeling
- fee and tax modeling
- liquidity constraints
- market session constraints
- currency conversion
- partial fill simulation
- failed order simulation

Promotion from Shadow requires:

- minimum runtime
- minimum signal count
- no critical operational errors
- performance compared against baseline
- drawdown within limits
- no evidence of data leakage

Suggested initial minimum:

```text
at least 1-3 months or enough signals for statistical review
```

The exact threshold may vary by strategy family.

## 11. Paper Trading Validation

Paper Trading validates operational order lifecycle without real capital.

Required checks:

- order intent creation
- risk checks
- money checks
- order approval
- simulated broker submission
- simulated status updates
- simulated fills
- position updates
- cash updates
- reconciliation
- alerts
- kill switch

Paper Trading answers:

- Does the system behave correctly?
- Are orders sized correctly?
- Are records complete?
- Are alerts useful?
- Does reconciliation work?

Paper Trading does not prove the strategy will make money.

## 12. Small-Capital Live Validation

Small-capital live validation uses real orders under strict limits.

Entry requirements:

- unit, integration, contract, and E2E tests pass
- Toss capabilities verified
- strategy passed required validation
- kill switch tested
- reconciliation tested
- alerting tested
- operator emergency procedure understood

Initial constraints:

- small total capital
- small per-order amount
- limited strategies
- limit orders only
- regular session only
- no unverified ETF or fractional features
- no automatic strategy promotion

Exit requirements:

- no duplicate orders
- no unresolved broker state
- fills reconcile correctly
- cash balances reconcile
- real slippage measured
- fees and taxes recorded
- alerts behave correctly

## 13. Production Promotion Criteria

Production promotion requires evidence.

Required evidence:

- backtest result
- walk-forward result
- Shadow Portfolio result
- Paper Trading result
- small-capital live result where applicable
- risk review
- cost review
- strategy diversity review
- AI Health Check status
- rollback plan

A strategy must not be promoted based only on:

- strong backtest
- short-term profit
- AI confidence
- user excitement
- recent market trend

### 13.1 Default Strategy Promotion Gate v0.2

The following default thresholds apply until a strategy-specific promotion policy is approved.

Minimum evidence:

- backtest covers multiple market regimes
- walk-forward validation passes without material degradation
- Shadow Portfolio runs for at least 30 trading days or 30 generated signals
- Paper Trading runs for at least 30 trading days or 30 order lifecycle simulations
- small-capital live stage is completed before production capital expansion
- all tests use approved cost model versions
- historical data includes required corporate action handling
- AI Health Check is green or explicitly reviewed

Default rejection conditions:

- maximum drawdown exceeds the approved strategy risk limit
- live or paper slippage is materially worse than modeled assumptions
- trade count is too low to evaluate
- results rely on one symbol, sector, event, or short date range
- benchmark-relative performance is negative after costs
- strategy correlation with existing production strategies is too high without diversification benefit
- required Toss Securities capability or account permission remains unverified
- compliance, data licensing, tax, or broker terms review is incomplete for the target use

Promotion records must store the evidence, thresholds, decision, reviewer or approval mode, rollback plan, and strategy version.

## 14. Regression Testing

Regression tests prevent old safety guarantees from breaking.

Regression suite must include:

- AI cannot place orders
- signal is not order
- risk failure blocks approval
- money failure blocks approval
- kill switch blocks approval
- stale data blocks approval
- unknown broker state blocks dependent trading
- invalid Claude output is rejected
- unverified broker capability blocks production
- strategy version immutability
- secrets are not logged

Regression suite must run before merging implementation branches that affect trading, risk, AI, API, or database behavior.

## 15. Test Data Strategy

Test data categories:

- synthetic market data
- historical market data
- mocked Toss responses
- mocked Naver responses
- mocked Claude responses
- invalid payload fixtures
- edge case portfolios
- edge case risk limits
- partial fill fixtures
- API timeout fixtures

Test data must include failure cases, not only happy paths.

## 16. AI Evaluation

AI evaluation is separate from trading strategy evaluation.

Metrics:

- schema validation rate
- classification consistency
- evidence quality
- contradiction detection
- confidence calibration
- false positive news impact
- false negative news impact
- token cost
- latency
- prompt regression stability

Required eval sets:

- news event classification fixtures
- malformed article fixtures
- ambiguous company name fixtures
- contradictory news fixtures
- strategy explanation fixtures
- AI Health Check fixtures

AI evaluation failure may block AI-dependent trading features.

## 17. Performance and Load Testing

Performance tests should verify:

- market scan runtime
- news collection runtime
- AI analysis queue throughput
- database query latency
- dashboard response time
- order approval latency
- reconciliation runtime
- scheduled job overlap behavior

Trading safety is more important than speed. If load increases uncertainty, the system should reduce activity.

## 18. Security Testing

Security checks:

- secrets not committed
- secrets not logged
- API keys not sent to Claude
- authorization headers redacted
- production controls protected
- audit records created for sensitive actions
- dependency vulnerability scan
- environment separation

Security failure may block deployment.

## 19. Disaster Recovery Testing

Required recovery tests:

- restore database backup
- resume after worker crash
- resume after broker API outage
- reconcile after unknown order state
- restart with active kill switch
- recover from failed migration
- recover from partial external API outage

Production trading must remain disabled after recovery until state is confirmed.

## 20. Acceptance Criteria by Module

### 20.1 TossSecuritiesAdapter

Must pass:

- read contract tests
- write contract tests in mock or verified safe environment
- error normalization tests
- timeout tests
- redaction tests
- capability registry tests

### 20.2 NaverNewsAdapter

Must pass:

- query tests
- pagination tests
- response normalization tests
- duplicate handling tests
- rate limit tests
- timestamp tests

### 20.3 ClaudeAIAdapter

Must pass:

- prompt template tests
- schema validation tests
- malformed output tests
- token/cost logging tests
- redaction tests

### 20.4 Risk Engine

Must pass:

- all limit type tests
- concentration tests
- drawdown tests
- kill switch tests
- stale data tests

### 20.5 Order Approval Engine

Must pass:

- approval happy path
- rejection paths
- broker capability blocks
- unknown state blocks
- audit record tests

### 20.6 Reconciliation Service

Must pass:

- full fill
- partial fill
- cancelled order
- rejected order
- unknown state
- broker/internal mismatch

## 21. CI Requirements

Continuous integration should run:

- formatting
- linting
- type checks
- unit tests
- integration tests with mocks
- schema validation tests
- migration tests
- secret scanning
- dependency scanning

Live broker tests must not run automatically in normal CI.

## 22. Manual Test Gates

Manual review is required before:

- enabling live broker write operations
- increasing capital limits
- promoting production strategy
- enabling new market or asset type
- changing risk limit defaults
- changing kill switch behavior
- changing order retry logic

## 23. Production Readiness Checklist

Before production:

1. all critical tests pass
2. broker capabilities verified
3. strategy validation evidence stored
4. kill switch tested
5. duplicate order prevention tested
6. reconciliation tested
7. alerting tested
8. backup restore tested
9. secrets configured securely
10. dashboard shows system status
11. operator emergency process documented
12. small-capital live validation completed
13. AI Health Check is operational
14. rollback plan exists

## 24. Open Testing Questions

Open questions:

- What historical data provider will be used for reliable backtests?
- What minimum trade count is required by strategy family?
- How long should Shadow Portfolio run for each strategy family?
- What is the minimum small-capital live duration?
- How should statistical significance be measured for low-frequency strategies?
- Which CI platform will be used?
- Will Toss provide a test environment or must mock testing plus small live tests be used?
- How should production-like market data be replayed in tests?

## 25. Final Testing Statement

Testing is the system's permission structure.

The system earns the right to move from one stage to the next only by producing evidence:

```text
code evidence
-> data evidence
-> strategy evidence
-> operational evidence
-> live safety evidence
```

Without evidence, the correct state is no trade.
