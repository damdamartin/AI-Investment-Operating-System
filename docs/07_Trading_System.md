# 07 Trading System

Version: 0.2.0
Status: Draft
Last Updated: 2026-07-28
Related Docs: 01_Project_Vision.md, 02_System_Architecture.md, 03_Domain_Model.md, 04_Database_Architecture.md, 05_API_Architecture.md, 06_AI_Architecture.md, 08_Testing_Validation.md, 09_Operation_Deployment.md, 11_AI_RULES.md, 13_Compliance_and_Legal_Review.md

## 1. Document Purpose

This document defines the trading system architecture for AI Investment Operating System.

It describes the full lifecycle from market data and signal generation to risk checks, money management, order approval, Toss Securities execution, fill reconciliation, portfolio update, kill switch behavior, and fail-safe operation.

The central rule is:

> A signal is not an order.

## 2. Trading System Goals

The trading system must:

- execute only approved orders
- prevent duplicate orders
- reject stale or incomplete data
- separate AI analysis from order execution
- enforce risk and money management
- reconcile broker state before assuming success
- maintain complete audit records
- stop trading when safety is uncertain

Profit is not the first goal of this layer. Safe and correct execution is.

## 3. Trading Lifecycle Overview

```text
Market and account data collection
-> Asset universe filtering
-> Engine evaluation
-> Signal generation
-> Order intent creation
-> Risk check
-> Money check
-> Order approval
-> Broker submission
-> Broker status tracking
-> Fill reconciliation
-> Position and cash update
-> Audit and metrics update
```

Every step must either produce a valid next-state record or stop safely.

## 4. Operating Modes

The trading system supports multiple modes.

### 4.1 Backtest Mode

Uses historical data. Sends no broker orders.

### 4.2 Shadow Portfolio Mode

Uses live or near-live data with simulated orders. Sends no broker orders.

### 4.3 Paper Trading Mode

Simulates full order lifecycle. Sends no broker orders.

### 4.4 Small-Capital Live Mode

Sends real broker orders under strict capital limits.

Purpose:

- validate broker integration
- validate operational behavior
- measure slippage and failures

### 4.5 Production Mode

Sends real broker orders under approved strategy versions and production risk limits.

Production mode requires:

- verified broker capabilities
- active strategy version
- active risk limits
- clean reconciliation state
- active monitoring
- kill switch available

## 5. Market Data Processing

Market data is collected through Toss Securities Adapter.

Required data for live order approval:

- asset id
- market code
- latest price
- price timestamp
- currency
- bid and ask if available
- volume or liquidity indicator
- market session
- data source

Rules:

- stale price blocks live order approval
- missing currency blocks order approval
- unknown market session blocks order approval
- unverified asset mapping blocks order approval
- abnormal price movement may trigger risk review

## 6. Asset Universe Filtering

The trading system must trade only assets in an approved universe.

Initial universe filters:

- supported market: `KR` or `US`
- supported asset type: `STOCK` or `ETF`
- broker mapping verified
- tradability status is `TRADABLE`
- sufficient liquidity
- normal market status
- not suspended
- not delisting risk
- not explicitly blocked by user or risk policy

For V1, cryptocurrency, futures, options, margin products, and short-selling instruments are excluded.

## 7. Engine Evaluation

Candidate assets are evaluated by multiple engines.

```text
Market Engine
Fundamental Engine
News and Event Engine
Strategy Engine
Risk Engine
Money Management Engine
```

Only the first four engines may contribute to candidate signals.

Risk Engine and Money Management Engine are approval gates, not signal boosters.

## 8. Market Engine

Purpose:

Evaluate price, volume, liquidity, and trend.

Inputs:

- price snapshots
- volume
- bid/ask spread
- moving averages
- volatility
- relative strength
- market session

Outputs:

- market score
- trend classification
- liquidity status
- volatility status
- warnings

Rules:

- poor liquidity may block trading
- abnormal spread may block trading
- extreme volatility may reduce position size or block trading

## 9. Fundamental Engine

Purpose:

Evaluate business and asset quality.

Inputs:

- financial metrics
- valuation metrics
- dividend data
- sector classification
- ETF classification
- long-term quality indicators

Outputs:

- fundamental score
- quality classification
- long-term suitability
- warnings

Rules:

- missing fundamentals may reduce score but does not always block short-term strategies
- long-term portfolio strategies require stronger fundamental support

## 10. News and Event Engine

Purpose:

Convert news and events into structured inputs for strategy scoring.

Inputs:

- news clusters
- news events
- Claude event assessment
- source reliability
- event freshness
- related asset mapping

Outputs:

- event score
- event direction
- event confidence
- time horizon
- review flags

Rules:

- news alone cannot create an executable order
- duplicate news does not multiply score automatically
- low confidence events cannot increase trade conviction
- `requires_review` blocks automatic use
- stale news cannot create a fresh signal

## 11. Strategy Engine

Purpose:

Generate candidate signals from approved strategy versions.

Inputs:

- approved strategy version
- asset universe
- market score
- fundamental score
- news event score
- portfolio state
- market regime

Outputs:

- Signal
- EngineScoreSet
- explanation
- input references

Signal types:

```text
ENTRY
EXIT
REDUCE
INCREASE
REBALANCE
HOLD
NO_TRADE
```

Rules:

- only approved strategy versions can run in live modes
- signals must reference the exact strategy version
- signal generation must be deterministic for the same inputs where practical
- `NO_TRADE` should be recorded when useful for analysis, but not every non-event needs a record

## 12. Signal to Order Intent

A Signal may create an OrderIntent only if:

- signal type requires action
- asset is tradable
- strategy version is live-approved for the mode
- portfolio is active
- market session allows trading
- required data is fresh
- kill switch is not active

OrderIntent includes:

- signal id
- portfolio id
- asset id
- side
- intended quantity
- intended order type
- limit price if applicable
- reason

OrderIntent is not submitted to broker.

## 13. Risk Engine

Purpose:

Decide whether a candidate trade is allowed from a risk perspective.

Risk checks:

- per-order maximum amount
- per-trade maximum loss
- daily loss limit
- weekly loss limit
- monthly loss limit
- total drawdown limit
- position concentration
- sector concentration
- market concentration
- currency concentration
- strategy concentration
- correlation with existing positions
- volatility threshold
- liquidity threshold
- consecutive loss rule
- active kill switch

Outputs:

- RiskCheck
- result
- failed limits
- warnings

Allowed results:

```text
PASS
PASS_WITH_WARNING
FAIL
BLOCKED
```

Rules:

- `FAIL` blocks order approval
- `BLOCKED` blocks order approval and may raise alert
- Risk Engine has veto authority over all signals

## 14. Money Management Engine

Purpose:

Determine whether the portfolio can afford the trade and what size is allowed.

Checks:

- available cash
- reserved cash
- unsettled cash
- sellable quantity
- strategy allocation limit
- portfolio allocation limit
- market allocation limit
- minimum cash ratio
- currency availability
- estimated fees and taxes
- expected cash after order

Outputs:

- MoneyCheck
- approved quantity
- approved amount
- cash after order
- allocation after order
- warnings

Rules:

- intended order size may be reduced
- insufficient cash blocks buy orders
- insufficient sellable quantity blocks sell orders
- USD orders require USD cash or verified conversion behavior
- minimum cash ratio is enforced after order

## 15. Order Approval Engine

Purpose:

Create the final approval or rejection record.

Inputs:

- OrderIntent
- RiskCheck
- MoneyCheck
- current kill switch state
- broker capability status
- broker account permission status
- market session status
- latest reconciliation status

Outputs:

- OrderApproval

Rules:

- approval requires passing risk check
- approval requires passing money check
- approval requires verified broker capability
- approval requires exactly one verified BrokerAccount
- approval requires clean reconciliation state
- approval result must be stored before broker submission
- rejected orders are stored with reasons

## 16. Broker Capability Check

Before approval, required broker capabilities must be `SUPPORTED`.

Examples:

- `KR_STOCK_LIMIT_ORDER`
- `KR_ETF_LIMIT_ORDER`
- `US_STOCK_LIMIT_ORDER`
- `US_ETF_LIMIT_ORDER`
- `ORDER_CANCEL`
- `ORDER_STATUS_QUERY`
- `FILL_QUERY`

If required capability is:

```text
UNVERIFIED
UNSUPPORTED
PARTIAL
```

then production approval is blocked unless a specific safe exception exists.

### 16.1 Broker Account Check

Before production or small-capital live approval, the system must resolve the OrderIntent to exactly one BrokerAccount through an active PortfolioBrokerAccountLink.

Required checks:

- BrokerAccount exists.
- BrokerAccount broker is `TOSS_SECURITIES`.
- BrokerAccount status is active.
- BrokerAccount permission status allows the requested operation.
- Local `live_trading_enabled` flag is true for live trading.
- PortfolioBrokerAccountLink is active.
- Requested market and asset type are allowed by the link.
- Account capability was verified recently enough for the configured environment.

Blocking conditions:

```text
missing broker account
multiple broker accounts resolved
unverified permission status
read-only account
disabled portfolio-account link
market not allowed
asset type not allowed
stale capability verification
```

If any blocking condition exists, the order is rejected before broker submission.

## 17. Execution Engine

Purpose:

Submit approved orders to Toss Securities Adapter and track broker state.

Execution flow:

```text
load approved OrderApproval
-> create client_order_id
-> persist execution command or outbox record
-> submit through TossSecuritiesAdapter
-> store broker response
-> update BrokerOrder state
-> schedule status checks
```

Rules:

- Execution Engine accepts only approved OrderApproval
- no natural language order requests
- no direct AI-originated orders
- no submission if kill switch activated after approval but before submission
- no blind retry after ambiguous submission

## 18. Toss Securities Execution Adapter

TossSecuritiesAdapter is the only component that calls Toss order APIs.

Responsibilities:

- translate approved internal request to Toss request
- submit order
- cancel order
- replace order if supported
- query order status
- query fills
- normalize broker response
- normalize broker errors
- redact payloads
- log API calls

Rules:

- adapter must not approve orders
- adapter must not resize orders
- adapter must not infer missing strategy context
- adapter must return `UNKNOWN` when broker state is ambiguous

## 19. Order State Lifecycle

```text
DRAFT
-> CANDIDATE
-> RISK_CHECKED
-> MONEY_CHECKED
-> APPROVED
-> SUBMITTED
-> BROKER_ACCEPTED
-> PARTIALLY_FILLED
-> FILLED
```

Terminal alternatives:

```text
REJECTED
CANCELLED
EXPIRED
FAILED
UNKNOWN_REQUIRES_RECONCILIATION
```

Rules:

- state transitions must be stored
- unknown state must not be collapsed into failed
- partial fill must be explicit
- dependent trades must wait for reconciliation if state is unknown

## 20. Reconciliation

Purpose:

Ensure internal state matches broker reality.

Reconciliation checks:

- submitted orders
- open orders
- cancelled orders
- rejected orders
- partial fills
- full fills
- positions
- cash balances
- fees and taxes
- currency balances

Reconciliation flow:

```text
query broker order status
-> query fills
-> query positions
-> query cash
-> compare with internal records
-> update BrokerOrder
-> create Fill records
-> update Position
-> update CashBalance
-> create audit records
```

Rules:

- fills update positions only through reconciliation
- unresolved mismatch raises alert
- unresolved broker state blocks related new orders
- reconciliation must run after order submission and periodically during live operation

## 21. Duplicate Order Prevention

Duplicate order prevention is mandatory.

Controls:

- unique internal order intent id
- unique order approval id
- client order id or idempotency key where supported
- database unique constraints
- outbox pattern
- no blind retry after timeout
- broker state query before retry
- portfolio-level reservation of cash or quantity
- related-order lock by portfolio and asset

Duplicate order risk must produce:

- blocked execution
- alert
- reconciliation task

## 22. Kill Switch

Kill switch scopes:

```text
GLOBAL
MARKET
PORTFOLIO
STRATEGY
ASSET
```

Kill switch actions:

- block new signals from becoming order intents
- block new approvals
- block not-yet-submitted approved orders
- optionally cancel open orders depending on policy
- raise alert
- require audited deactivation

Activation triggers:

- manual emergency stop
- daily loss limit breach
- monthly loss limit breach
- maximum drawdown breach
- broker API uncertainty
- duplicate order detection
- reconciliation failure
- abnormal market data
- repeated order failures
- AI Health Check `BLOCKED`

Rules:

- kill switch is a safety tool, not a market timing tool
- deactivation must be audited
- live trading cannot continue if global kill switch is active

## 23. Position Management

Position state must be updated from reconciled fills and broker account data.

Position fields:

- quantity
- average price
- market value
- unrealized PnL
- realized PnL
- fees
- taxes
- currency
- strategy attribution

Rules:

- internal position cannot drift silently from broker position
- unexplained differences raise alert
- uncertain position state blocks dependent trading

## 24. Cash and Currency Management

Cash is tracked by currency.

Required balances:

- KRW available
- KRW reserved
- KRW unsettled
- USD available
- USD reserved
- USD unsettled

U.S. trading requires:

- USD cash availability or verified Toss conversion behavior
- exchange rate capture
- USD PnL
- KRW-converted PnL

Rules:

- KRW and USD are never mixed without explicit exchange rate
- unknown exchange rate may block KRW risk reporting
- minimum cash reserve must be enforced

## 25. Order Type Policy

Initial recommended policy:

- use limit orders by default
- avoid market orders until explicitly verified and approved
- extended-hours orders disabled until verified
- fractional orders disabled until verified

Market orders may be allowed later only with:

- explicit risk policy
- verified broker support
- slippage limit
- emergency liquidation rules
- audit record

## 26. Trading Schedule

Trading jobs must respect:

- market calendar
- market session
- data freshness
- broker availability
- strategy schedule
- risk state
- kill switch state

No trading job should assume that today is an open market day without checking the market calendar.

## 27. Alerts

Normal events visible in dashboard:

- order submitted
- order filled
- strategy signal generated
- portfolio value changed

Default push or email alerts should focus on exceptions:

- order failed
- order state unknown
- broker API failure
- kill switch activated
- risk limit breached
- reconciliation mismatch
- duplicate order risk
- stale data
- repeated AI schema failure

This follows the principle that normal automation should be quiet.

## 28. Audit Requirements

Every production order must be reconstructable.

Required evidence:

- strategy version
- signal
- engine scores
- AI analysis references if used
- market data reference
- news event reference if used
- risk check
- money check
- order approval
- broker request
- broker response
- fill records
- reconciliation records

If an order cannot be explained later, the trading system is not compliant with project architecture.

## 29. Fail-Safe Behavior

Default behavior is no trade.

Trading must stop or block when:

- strategy version is not approved
- asset is not tradable
- broker capability is unverified
- market data is stale
- market calendar is unknown
- risk engine is unavailable
- money engine is unavailable
- order approval engine is unavailable
- kill switch is active
- broker API auth fails
- broker order state is unknown
- reconciliation mismatch exists
- duplicate order risk exists
- account data is inconsistent

## 30. Small-Capital Live Rules

Small-capital live mode is required before production.

Suggested constraints:

- strict maximum total capital
- strict maximum order amount
- limited number of strategies
- limit orders only
- no extended-hours trading
- no fractional orders unless verified
- no automatic strategy promotion
- full alerting on order failures
- daily review of reconciliation

Purpose:

- validate system mechanics
- measure real slippage
- verify broker behavior
- confirm monitoring and alerts

## 31. Production Readiness Checklist

Before production trading:

1. Toss read APIs verified
2. Toss order APIs verified
3. order status query verified
4. fill query verified
5. broker capability registry populated
6. market calendar available
7. asset universe verified
8. Risk Engine implemented and tested
9. Money Management Engine implemented and tested
10. Order Approval Engine implemented and tested
11. kill switch implemented and tested
12. duplicate order prevention tested
13. reconciliation tested
14. audit reconstruction tested
15. alerting tested
16. paper trading completed
17. small-capital live completed
18. strategy version approved
19. backup and recovery tested
20. operator understands emergency procedure

## 32. Open Trading Questions

The following questions remain open:

- What exact order types does Toss support for each market and asset type?
- Does Toss support idempotency keys or client order IDs?
- How quickly can Toss order status be queried after submission?
- How are partial fills represented?
- How are fees and taxes exposed?
- Is U.S. extended-hours trading available through API?
- Is U.S. fractional trading available through API?
- Does Toss support automatic currency conversion through API?
- What minimum order sizes apply by market?
- What are practical rate limits during live trading?
- How should sell priority work when cash target rules are introduced?

## 33. Final Trading Statement

The trading system is the capital-control layer of AI Investment Operating System.

It must convert research and analysis into orders only through a controlled path:

```text
Signal
-> OrderIntent
-> RiskCheck
-> MoneyCheck
-> OrderApproval
-> BrokerOrder
-> Fill
-> Reconciliation
```

Any shortcut around this path is a system violation.

The system may automate trading only because it refuses to trade when required evidence, approval, or reconciliation is missing.
