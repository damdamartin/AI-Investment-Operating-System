# 03 Domain Model

Version: 0.2.0
Status: Draft
Last Updated: 2026-07-28
Related Docs: 01_Project_Vision.md, 02_System_Architecture.md, 04_Database_Architecture.md, 05_API_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 11_AI_RULES.md, 13_Compliance_and_Legal_Review.md

## 1. Document Purpose

This document defines the core domain model for AI Investment Operating System.

It establishes the vocabulary, entities, value objects, aggregates, domain services, and domain events that all implementation work must use consistently.

This document is not a database schema. Database tables, indexes, partitions, and storage-level constraints are defined in `04_Database_Architecture.md`.

## 2. Domain Modeling Principles

The domain model must protect the safety and audit goals of the system.

Core principles:

- Use explicit domain names instead of broker-specific names.
- Keep external API response structures outside the domain model.
- Represent money, quantity, currency, market, and order state with strong types.
- Treat strategy versions as immutable after approval.
- Treat audit records and domain events as append-only.
- Keep production trading state separate from research state.
- Store enough references to reconstruct why an order happened.
- Prefer no trade when a required domain object is incomplete or invalid.

## 3. Bounded Contexts

The system is divided into bounded contexts.

```text
Market Context
Asset Context
News and Event Context
AI Analysis Context
Strategy Context
Portfolio Context
Risk Context
Order and Execution Context
Research and Validation Context
Operation and Audit Context
```

Each context owns its terminology and invariants.

## 4. Common Value Objects

Value objects are immutable and compared by value.

### 4.1 Identifier

Generic identifier used for internal entities.

Required properties:

- value
- type

Examples:

- `asset_id`
- `strategy_id`
- `strategy_version_id`
- `order_request_id`
- `broker_order_id`
- `audit_record_id`

Rules:

- Internal IDs must not be derived from external broker IDs alone.
- External IDs may change format and must be stored separately.

### 4.2 MarketCode

Represents the market.

Allowed initial values:

```text
KR
US
```

Rules:

- Market-specific rules must branch from `MarketCode`.
- A missing market code makes an asset non-tradable.

### 4.3 AssetType

Represents the type of tradable asset.

Allowed initial values:

```text
STOCK
ETF
```

Explicitly excluded:

```text
CRYPTO
FUTURE
OPTION
MARGIN_PRODUCT
UNKNOWN
```

`UNKNOWN` may be used during ingestion, but unknown assets must not be traded.

### 4.4 CurrencyCode

Represents currency.

Allowed initial values:

```text
KRW
USD
```

Rules:

- Every money value must include currency.
- KRW and USD values must not be added without conversion.
- U.S. asset performance must track both USD return and KRW-converted return.

### 4.5 Money

Represents an amount in a specific currency.

Required properties:

- amount
- currency

Rules:

- `Money` must never be represented as a naked number.
- Arithmetic is allowed only between equal currencies unless an exchange rate value object is explicitly used.
- Negative money is allowed only where semantically valid, such as realized loss.

### 4.6 Quantity

Represents asset quantity.

Required properties:

- value
- precision

Rules:

- Fractional quantity support must be determined by market, asset, and Toss API capability.
- If fractional trading support is unknown, quantity must be integer-only.

### 4.7 Price

Represents a tradable price.

Required properties:

- amount
- currency
- timestamp
- source

Rules:

- Price must include timestamp and source.
- Stale price must not be used for order approval.

### 4.8 ExchangeRate

Represents currency conversion.

Required properties:

- base_currency
- quote_currency
- rate
- timestamp
- source

Rules:

- U.S. market performance must record the exchange rate used for KRW conversion.
- Stale exchange rate may block money management calculations.

### 4.9 TimeWindow

Represents a time interval.

Required properties:

- start_at
- end_at
- timezone

Rules:

- Market hours must use explicit timezones.
- U.S. market logic must account for daylight saving time.

### 4.10 Score

Represents an engine score.

Required properties:

- value
- min_value
- max_value
- engine_name
- generated_at

Rules:

- Scores from different engines must not be compared unless normalized.
- Every score used for order approval must be persisted.

### 4.11 Confidence

Represents confidence in an analysis or classification.

Suggested range:

```text
0.0 to 1.0
```

Rules:

- Low confidence AI analysis must not trigger trading.
- Missing confidence defaults to unusable for trading.

### 4.12 RiskLevel

Represents normalized risk severity.

Allowed values:

```text
LOW
MEDIUM
HIGH
CRITICAL
BLOCKED
```

Rules:

- `CRITICAL` and `BLOCKED` risk levels prevent new production orders.

## 5. Market Context

### 5.1 Market

Represents a supported trading market.

Required properties:

- market_code
- name
- timezone
- base_currency
- status
- regular_session
- supported_asset_types

Examples:

```text
KR market
US market
```

Rules:

- A market must define its calendar and trading sessions before live trading.
- Unsupported asset types must be rejected at universe creation.

### 5.2 MarketCalendar

Represents open and closed days.

Required properties:

- market_code
- date
- is_open
- open_time
- close_time
- session_type
- reason_if_closed

Rules:

- Trading jobs must check the relevant market calendar before generating orders.
- Calendar uncertainty blocks trading for that market.

### 5.3 TradingSession

Represents a market session.

Allowed initial values:

```text
REGULAR
PRE_MARKET
AFTER_HOURS
CLOSED
```

Rules:

- Initial production trading should default to `REGULAR` only unless extended-hours support is verified.
- Session availability depends on Toss API capability.

## 6. Asset Context

### 6.1 Asset

Represents a tradable or analyzable asset.

Required properties:

- asset_id
- market_code
- asset_type
- symbol
- display_name
- currency
- exchange
- tradability_status
- data_status
- created_at
- updated_at

Rules:

- `Asset` is an internal normalized object.
- Broker-specific symbol fields belong in `BrokerAssetMapping`.
- Assets with unknown tradability must not be traded.

### 6.2 BrokerAssetMapping

Maps internal assets to broker-specific identifiers.

Required properties:

- asset_id
- broker
- broker_symbol
- broker_market_code
- broker_asset_type
- orderable
- supports_fractional_quantity
- supports_market_order
- supports_limit_order
- verified_at

Rules:

- Toss Securities-specific identifiers must stay here.
- An asset cannot be sent to execution without a valid broker mapping.

### 6.3 AssetUniverse

Represents a filtered set of assets eligible for analysis or trading.

Required properties:

- universe_id
- name
- market_code
- asset_types
- filters
- generated_at
- asset_ids

Rules:

- Universe generation must exclude blocked assets.
- A strategy must declare which universe it uses.

### 6.4 TradabilityStatus

Allowed values:

```text
TRADABLE
NOT_TRADABLE
SUSPENDED
DELISTING_RISK
MANAGEMENT_ISSUE
UNKNOWN
```

Rules:

- Only `TRADABLE` assets are eligible for live orders.

## 7. News and Event Context

### 7.1 NewsArticle

Represents a collected news article or search result.

Required properties:

- news_article_id
- provider
- title
- summary
- original_url
- source_name
- published_at
- collected_at
- query
- language
- raw_provider_id

Rules:

- News articles are raw inputs, not trading signals.
- Duplicate or syndicated articles must be grouped before event impact analysis.

### 7.2 NewsCluster

Represents grouped articles describing the same event.

Required properties:

- news_cluster_id
- article_ids
- representative_title
- first_published_at
- latest_published_at
- related_asset_ids
- deduplication_method

Rules:

- Multiple articles about the same event must not multiply signal strength automatically.

### 7.3 NewsEvent

Represents an interpreted event affecting one or more assets.

Required properties:

- news_event_id
- related_asset_ids
- event_type
- event_direction
- importance_score
- confidence
- time_horizon
- source_cluster_id
- ai_analysis_id
- created_at

Allowed event types include:

```text
EARNINGS
GUIDANCE
CONTRACT
MERGER_ACQUISITION
REGULATION
LITIGATION
DIVIDEND
BUYBACK
MANAGEMENT_CHANGE
PRODUCT
ACCIDENT
MACRO
SECTOR
OTHER
```

Rules:

- NewsEvent may influence strategy scoring.
- NewsEvent alone must not create an executable order.

### 7.4 EventDirection

Allowed values:

```text
POSITIVE
NEGATIVE
MIXED
NEUTRAL
UNKNOWN
```

Rules:

- `UNKNOWN` direction cannot increase trade conviction.

## 8. AI Analysis Context

### 8.1 AIAnalysis

Represents a structured AI result.

Required properties:

- ai_analysis_id
- provider
- model
- prompt_template_id
- input_reference_ids
- raw_response_reference
- normalized_output
- schema_version
- schema_valid
- confidence
- created_at
- token_usage
- estimated_cost

Rules:

- AI analysis must be schema-validated before use.
- Invalid AI output cannot participate in order approval.
- Raw AI output may be stored separately from normalized output.

### 8.2 AIEventAssessment

Represents AI interpretation of a news or corporate event.

Required properties:

- ai_analysis_id
- asset_id
- event_type
- sentiment
- impact_score
- confidence
- time_horizon
- evidence
- risks
- contradictions
- requires_review

Rules:

- `requires_review = true` prevents automatic order use.
- Contradictions should reduce confidence or trigger additional checks.

### 8.3 AIHealthCheck

Represents AI-assisted system diagnosis.

Required properties:

- health_check_id
- period_start
- period_end
- status
- findings
- risk_flags
- suggested_actions
- created_at

Allowed statuses:

```text
GREEN
YELLOW
RED
BLOCKED
```

Rules:

- `RED` or `BLOCKED` may trigger risk reduction or trading pause depending on policy.
- AI Health Check suggests actions; deterministic operation rules execute them.

## 9. Strategy Context

### 9.1 Strategy

Represents a family of trading logic.

Required properties:

- strategy_id
- name
- strategy_family
- description
- owner
- status
- created_at

Strategy families include:

```text
VALUE
GROWTH
QUALITY
MOMENTUM
DIVIDEND
MEAN_REVERSION
EVENT_DRIVEN
SECTOR_ROTATION
LOW_VOLATILITY
ETF_ALLOCATION
MARKET_DEFENSE
CASH_EXPANSION
```

Rules:

- Strategy is a conceptual family.
- Executable behavior belongs to StrategyVersion.

### 9.2 StrategyVersion

Represents a specific immutable version of a strategy.

Required properties:

- strategy_version_id
- strategy_id
- version
- status
- parameters
- universe_id
- entry_rules
- exit_rules
- risk_profile
- created_at
- approved_at
- retired_at
- previous_version_id

Rules:

- Approved StrategyVersion must be immutable.
- Production trading may use only approved production versions.
- Changes require a new StrategyVersion.

### 9.3 StrategyStatus

Allowed values:

```text
DRAFT
BACKTESTING
BACKTEST_PASSED
SHADOW_RUNNING
SHADOW_PASSED
PAPER_RUNNING
PAPER_PASSED
SMALL_CAPITAL_LIVE
PRODUCTION_APPROVED
PRODUCTION_ACTIVE
PAUSED
DEPRECATED
RETIRED
REJECTED
```

Rules:

- State transitions must follow validation workflow.
- Direct promotion from `DRAFT` to `PRODUCTION_ACTIVE` is forbidden.

### 9.4 Signal

Represents a strategy-generated candidate action.

Required properties:

- signal_id
- strategy_version_id
- asset_id
- signal_type
- direction
- strength
- generated_at
- input_references
- engine_scores
- explanation

Allowed signal types:

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

- Signal is not an order.
- Signal requires risk and money checks before order approval.

### 9.5 EngineScoreSet

Represents the set of scores used by a signal.

Required properties:

- market_score
- fundamental_score
- news_event_score
- risk_score
- money_score
- total_score
- scoring_version
- generated_at

Rules:

- Score sets must be persisted for all production candidate signals.

## 10. Portfolio Context

### 10.0 BrokerAccount

Represents an actual broker account exposed through Toss Securities Open API.

Required properties:

- broker_account_id
- broker
- external_account_ref
- account_label
- base_currency
- supported_markets
- supported_asset_types
- permission_status
- live_trading_enabled
- read_only_enabled
- last_verified_at
- status

Permission status values:

```text
UNVERIFIED
READ_ONLY
PAPER_ONLY
LIVE_TRADING_ALLOWED
LIVE_TRADING_BLOCKED
SUSPENDED
```

Rules:

- Production orders must resolve to exactly one verified BrokerAccount.
- Unknown permission status blocks broker write operations.
- BrokerAccount must not expose raw account numbers in logs or dashboards.
- Multiple logical portfolios may map to one BrokerAccount only through explicit allocation rules.

### 10.0.1 PortfolioBrokerAccountLink

Represents the controlled mapping between an internal logical portfolio and an actual broker account.

Required properties:

- portfolio_broker_account_link_id
- portfolio_id
- broker_account_id
- allocation_policy
- allowed_markets
- allowed_asset_types
- max_capital_allocation
- status
- created_at
- updated_at

Rules:

- Shadow, Paper, and Backtest portfolios must not link to live broker write permissions.
- Production and Small-Capital Live portfolios require an active link before order approval.
- A disabled link blocks new orders without deleting historical portfolio records.

### 10.1 Portfolio

Represents a logical portfolio.

Required properties:

- portfolio_id
- name
- portfolio_type
- base_currency
- status
- created_at

Portfolio types:

```text
PRODUCTION
SMALL_CAPITAL_LIVE
PAPER
SHADOW
BACKTEST
```

Rules:

- Production and Shadow portfolios must be separate.
- Strategy performance must be measured per portfolio type.

### 10.2 Position

Represents current or historical asset holding.

Required properties:

- position_id
- portfolio_id
- asset_id
- quantity
- average_price
- market_value
- unrealized_pnl
- realized_pnl
- opened_at
- updated_at

Rules:

- Broker positions and internal positions must be reconciled.
- Unknown broker state may mark position status as uncertain.

### 10.3 CashBalance

Represents cash held in a portfolio or account.

Required properties:

- cash_balance_id
- portfolio_id
- currency
- available_amount
- reserved_amount
- unsettled_amount
- updated_at

Rules:

- Available cash, reserved cash, and unsettled cash must not be mixed.
- Orders must reserve cash or quantity before submission where applicable.

### 10.4 PortfolioSnapshot

Represents portfolio state at a point in time.

Required properties:

- portfolio_snapshot_id
- portfolio_id
- captured_at
- total_value
- cash_values
- position_values
- exposure_by_market
- exposure_by_sector
- exposure_by_strategy
- drawdown

Rules:

- Risk decisions should use snapshots with known freshness.

## 11. Risk Context

### 11.1 RiskLimit

Represents a configured risk rule.

Required properties:

- risk_limit_id
- scope
- limit_type
- threshold
- action
- status
- version
- effective_from
- effective_to

Scopes:

```text
ACCOUNT
PORTFOLIO
MARKET
STRATEGY
ASSET
SECTOR
CURRENCY
ORDER
DAY
WEEK
MONTH
```

Limit types:

```text
MAX_POSITION_SIZE
MAX_ORDER_AMOUNT
MAX_DAILY_LOSS
MAX_WEEKLY_LOSS
MAX_MONTHLY_LOSS
MAX_DRAWDOWN
MIN_CASH_RATIO
MAX_CORRELATION
MAX_CONSECUTIVE_LOSSES
MAX_TURNOVER
```

Rules:

- Active risk limits are versioned.
- Production risk limit changes require audit records.

### 11.2 RiskCheck

Represents the result of checking a candidate signal or order.

Required properties:

- risk_check_id
- subject_type
- subject_id
- result
- risk_level
- failed_limits
- warnings
- checked_at

Allowed results:

```text
PASS
PASS_WITH_WARNING
FAIL
BLOCKED
```

Rules:

- `FAIL` or `BLOCKED` prevents order approval.

### 11.3 KillSwitchState

Represents emergency trading stop state.

Required properties:

- kill_switch_id
- scope
- active
- reason
- activated_at
- activated_by
- deactivated_at
- deactivated_by

Rules:

- Active kill switch prevents new orders within its scope.
- Deactivation must be audited.

## 12. Order and Execution Context

### 12.1 OrderIntent

Represents the intention to trade before approval.

Required properties:

- order_intent_id
- signal_id
- portfolio_id
- asset_id
- side
- intended_quantity
- intended_order_type
- limit_price
- reason
- created_at

Rules:

- OrderIntent is not sent to broker.
- OrderIntent must go through risk and money checks.

### 12.2 OrderApproval

Represents approval or rejection of an OrderIntent.

Required properties:

- order_approval_id
- order_intent_id
- risk_check_id
- money_check_id
- approval_result
- rejection_reasons
- approved_quantity
- approved_order_type
- approved_limit_price
- approved_at

Rules:

- Broker submission requires approved OrderApproval.
- Approval details must match the broker order request.

### 12.3 BrokerOrder

Represents an order submitted to the broker.

Required properties:

- broker_order_record_id
- order_approval_id
- broker
- broker_order_id
- broker_request
- broker_response
- order_state
- submitted_at
- last_checked_at

Rules:

- BrokerOrder links internal approval with broker state.
- Unknown state blocks dependent trading until reconciliation.

### 12.4 Fill

Represents executed quantity.

Required properties:

- fill_id
- broker_order_record_id
- asset_id
- quantity
- price
- fee
- tax
- filled_at

Rules:

- Fills update positions only through reconciliation.
- Partial fills must be represented explicitly.

### 12.5 OrderState

Allowed states:

```text
DRAFT
CANDIDATE
RISK_CHECKED
MONEY_CHECKED
APPROVED
SUBMITTED
BROKER_ACCEPTED
PARTIALLY_FILLED
FILLED
REJECTED
CANCELLED
EXPIRED
FAILED
UNKNOWN_REQUIRES_RECONCILIATION
```

Rules:

- State transitions must be monotonic except through explicit correction records.

## 13. Research and Validation Context

### 13.1 BacktestRun

Represents a historical strategy test.

Required properties:

- backtest_run_id
- strategy_version_id
- market_code
- asset_universe_id
- period_start
- period_end
- assumptions
- result_summary
- created_at

Rules:

- Backtests must include costs, taxes, slippage assumptions, and currency assumptions when applicable.

### 13.2 WalkForwardRun

Represents out-of-sample validation.

Required properties:

- walk_forward_run_id
- strategy_version_id
- training_windows
- validation_windows
- result_summary
- created_at

Rules:

- Walk-forward validation is required before Shadow Portfolio promotion.

### 13.3 ShadowPortfolioRun

Represents live-simulation strategy evaluation.

Required properties:

- shadow_run_id
- strategy_version_id
- portfolio_id
- started_at
- ended_at
- status
- result_summary

Rules:

- Shadow Portfolio uses no real capital.
- Shadow results must model realistic execution constraints.

### 13.4 PaperTradingRun

Represents simulated order lifecycle operation.

Required properties:

- paper_run_id
- strategy_version_id
- portfolio_id
- started_at
- ended_at
- operational_errors
- result_summary

Rules:

- Paper Trading validates operational behavior, not just returns.

### 13.5 StrategyPromotionReview

Represents review for promoting a strategy version.

Required properties:

- promotion_review_id
- strategy_version_id
- from_status
- target_status
- evidence_references
- comparison_baseline
- decision
- decided_at
- decided_by

Rules:

- Promotion evidence must include objective validation results.
- Early operation may require human approval for promotion.

## 14. Operation and Audit Context

### 14.1 AuditRecord

Represents an immutable audit entry.

Required properties:

- audit_record_id
- actor_type
- actor_id
- action
- subject_type
- subject_id
- before_reference
- after_reference
- reason
- created_at

Actor types:

```text
SYSTEM
USER
AI
SCHEDULER
BROKER_ADAPTER
```

Rules:

- Audit records are append-only.
- Production configuration changes require audit records.

### 14.2 Alert

Represents a user-visible exception or operational notification.

Required properties:

- alert_id
- severity
- category
- title
- message
- related_entity_type
- related_entity_id
- status
- created_at
- resolved_at

Allowed severities:

```text
INFO
WARNING
ERROR
CRITICAL
```

Rules:

- Normal successful trades do not require push alerts by default.
- Exceptions and risk breaches must produce alerts.

### 14.3 SystemIncident

Represents an operational incident.

Required properties:

- incident_id
- severity
- status
- started_at
- resolved_at
- root_cause
- affected_components
- mitigation_actions

Rules:

- Incidents affecting order state must trigger reconciliation workflow.

## 15. Aggregates

Aggregates define consistency boundaries.

### 15.1 Strategy Aggregate

Root:

- Strategy

Contained objects:

- StrategyVersion
- StrategyPromotionReview

Invariants:

- Approved versions are immutable.
- Production version must pass required validation states.
- A strategy may have at most one active production version per portfolio scope unless explicitly allowed.

### 15.2 Portfolio Aggregate

Root:

- Portfolio

Contained objects:

- Position
- CashBalance
- PortfolioSnapshot

Invariants:

- Cash and positions must reconcile with broker data for production portfolios.
- Portfolio total value must include currency conversion rules.

### 15.3 Order Aggregate

Root:

- OrderIntent

Contained objects:

- OrderApproval
- BrokerOrder
- Fill

Invariants:

- BrokerOrder cannot exist without OrderApproval.
- Fill cannot exist without BrokerOrder.
- Unknown broker order state blocks dependent trading.

### 15.4 Risk Aggregate

Root:

- RiskLimitSet

Contained objects:

- RiskLimit
- RiskCheck
- KillSwitchState

Invariants:

- Active kill switch blocks orders in scope.
- Failed active risk limit blocks order approval.

### 15.5 Research Run Aggregate

Root:

- StrategyVersion

Contained objects:

- BacktestRun
- WalkForwardRun
- ShadowPortfolioRun
- PaperTradingRun

Invariants:

- Later validation stages require successful earlier stages.
- Validation results must be linked to the exact strategy version tested.

## 16. Domain Services

Domain services represent business logic that does not naturally belong to one entity.

### 16.1 AssetUniverseService

Responsibilities:

- create tradable universe
- exclude blocked assets
- map broker symbols
- apply liquidity filters
- apply market and asset type filters

### 16.2 SymbolMappingService

Responsibilities:

- connect news mentions to internal assets
- resolve duplicate or ambiguous names
- map Toss broker symbols to internal assets

### 16.3 StrategyScoringService

Responsibilities:

- combine engine scores
- apply strategy-specific weights
- produce signals

### 16.4 RiskEvaluationService

Responsibilities:

- evaluate risk limits
- detect concentration
- detect drawdown breaches
- produce RiskCheck

### 16.5 MoneyManagementService

Responsibilities:

- calculate available capital
- reserve cash or quantity
- enforce cash ratio
- enforce strategy allocation
- calculate approved order size

### 16.6 OrderApprovalService

Responsibilities:

- combine signal, risk check, and money check
- approve or reject order intent
- create auditable approval record

### 16.7 ReconciliationService

Responsibilities:

- compare internal order state with broker state
- resolve partial fills
- update positions and balances
- mark unknown state when unresolved

### 16.8 StrategyPromotionService

Responsibilities:

- verify validation evidence
- compare candidate with baseline
- create promotion review
- transition strategy state

### 16.9 AIAnalysisValidationService

Responsibilities:

- validate AI output schema
- reject malformed analysis
- detect low confidence
- flag contradictions

## 17. Domain Events

Domain events are immutable facts.

### 17.1 Market Events

- MarketCalendarUpdated
- MarketSessionOpened
- MarketSessionClosed
- MarketDataSnapshotCreated
- AssetTradabilityChanged

### 17.2 News and AI Events

- NewsArticleCollected
- NewsClusterCreated
- NewsEventClassified
- AIAnalysisRequested
- AIAnalysisCompleted
- AIAnalysisRejected
- AIHealthCheckCompleted

### 17.3 Strategy Events

- StrategyCreated
- StrategyVersionCreated
- StrategyBacktestCompleted
- StrategyWalkForwardCompleted
- StrategyEnteredShadowPortfolio
- StrategyEnteredPaperTrading
- StrategyEnteredSmallCapitalLive
- StrategyPromotionRequested
- StrategyPromoted
- StrategyPaused
- StrategyRetired

### 17.4 Signal and Order Events

- SignalGenerated
- OrderIntentCreated
- RiskCheckPassed
- RiskCheckFailed
- MoneyCheckPassed
- MoneyCheckFailed
- OrderApproved
- OrderRejected
- OrderSubmitted
- BrokerOrderAccepted
- BrokerOrderRejected
- OrderPartiallyFilled
- OrderFilled
- OrderCancelled
- OrderStateUnknown
- OrderReconciled

### 17.5 Risk and Operation Events

- RiskLimitChanged
- KillSwitchActivated
- KillSwitchDeactivated
- AlertRaised
- AlertResolved
- IncidentOpened
- IncidentResolved

## 18. Invariants and Safety Rules

The following invariants must hold across the system:

1. AIAnalysis cannot become BrokerOrder.
2. Signal cannot become BrokerOrder without OrderIntent, RiskCheck, MoneyCheck, and OrderApproval.
3. BrokerOrder cannot exist without approved OrderApproval.
4. Production StrategyVersion cannot be modified in place.
5. Unknown Asset cannot be traded.
6. Unknown MarketCalendar blocks trading for that market.
7. Stale Price cannot be used for live order approval.
8. Invalid AIAnalysis cannot influence live order approval.
9. Active KillSwitch blocks new orders in scope.
10. Failed RiskCheck blocks order approval.
11. Failed MoneyCheck blocks order approval.
12. Unknown broker order state blocks dependent trading.
13. Shadow Portfolio must not send real broker orders.
14. Paper Trading must not send real broker orders.
15. Backtest must not use future information.

## 19. Domain Object Lifecycle Summary

### 19.1 Asset Lifecycle

```text
Discovered
-> Mapped
-> Verified
-> Tradable
-> Blocked or Retired
```

### 19.2 Strategy Version Lifecycle

```text
Draft
-> Backtesting
-> BacktestPassed
-> ShadowRunning
-> ShadowPassed
-> PaperRunning
-> PaperPassed
-> SmallCapitalLive
-> ProductionApproved
-> ProductionActive
-> Paused / Retired
```

### 19.3 Order Lifecycle

```text
Signal
-> OrderIntent
-> RiskCheck
-> MoneyCheck
-> OrderApproval
-> BrokerOrder
-> Fill
-> Reconciliation
-> PositionUpdate
```

## 20. Glossary

### Asset

An internal representation of a stock or ETF.

### Broker Asset Mapping

The mapping between internal asset identity and Toss Securities API identity.

### Broker Account

The internal representation of a real Toss Securities account and its verified permission state.

### Corporate Action

An event such as a split, dividend, distribution, symbol change, merger, delisting, or trading halt that can change historical price interpretation or portfolio accounting.

### Cost Model

A versioned model for fees, taxes, slippage, spread, and currency conversion assumptions used in backtests, paper trading, Shadow Portfolio, and live performance analysis.

### Signal

A strategy recommendation. It is not an order.

### Order Intent

A pre-approval request to place an order.

### Order Approval

The internal approval record required before broker submission.

### Broker Order

An order submitted to Toss Securities API.

### Fill

An executed portion of a broker order.

### Shadow Portfolio

A realistic virtual portfolio for testing candidate strategies without real capital.

### Paper Trading

A simulated trading mode that validates operational order lifecycle behavior without real capital.

### Strategy Version

An immutable executable definition of a strategy at a specific point in time.

### AI Analysis

A structured AI output that has been schema-validated and stored.

## 21. Open Domain Questions

The following questions must be resolved in later documents or implementation discovery:

- What exact Toss Securities asset identifiers are available for Korean stocks, Korean ETFs, U.S. stocks, and U.S. ETFs?
- Does Toss Securities expose a stable order id suitable for idempotency and reconciliation?
- Are fractional quantities supported for U.S. stocks or ETFs?
- Should a portfolio map one-to-one with a broker account or support virtual sub-portfolios?
- How should unsettled cash be modeled for Korean and U.S. markets?
- How should taxes be estimated before execution versus recorded after execution?
- Which sector classification source should be used for Korean and U.S. assets?
- What minimum fields must be retained from raw AI outputs for audit without storing unnecessary sensitive data?

## 22. Final Domain Statement

The domain model exists to keep the system honest.

It separates:

- assets from broker symbols
- signals from orders
- AI analysis from execution authority
- strategies from strategy versions
- research portfolios from production portfolios
- requested order state from broker order state
- normal operation from audited incidents

These distinctions are not cosmetic. They are the safety rails that allow the system to automate trading while remaining explainable, testable, reversible, and controlled.
