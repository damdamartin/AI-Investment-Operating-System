# 02 System Architecture

Version: 0.2.0
Status: Draft
Last Updated: 2026-07-28
Related Docs: 01_Project_Vision.md, 03_Domain_Model.md, 05_API_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 09_Operation_Deployment.md, 11_AI_RULES.md, 13_Compliance_and_Legal_Review.md

## 1. Document Purpose

This document defines the high-level system architecture for AI Investment Operating System.

It describes the major layers, components, adapters, data flows, decision flows, safety boundaries, and deployment assumptions needed to build the system consistently.

This document is intentionally technology-aware but not implementation-final. Exact frameworks, database schemas, API payloads, and task-level work items are defined in related documents.

## 2. Architectural Goal

The system must support automated investment operations while preventing uncontrolled trading behavior.

The architecture must make the following properties natural:

- AI can analyze, research, and audit.
- AI cannot directly execute broker orders.
- Every order passes deterministic approval layers.
- Broker-specific behavior is isolated behind adapters.
- Korean and U.S. markets share core logic but keep market-specific rules separate.
- Strategy changes are versioned, validated, and reversible.
- New strategies can evolve in isolated environments before using real capital.
- System failures reduce risk or stop trading.
- Every material decision is observable and auditable.

## 3. System Context

The system connects three primary external services:

| External Service | Role | Access Boundary |
|---|---|---|
| Toss Securities Open API | market data, account data, order execution | Toss Securities Adapter only |
| Naver News API | news search and article metadata | News Provider Adapter only |
| Claude API | analysis, structured reasoning, strategy research, health check | Claude AI Adapter only |

The system must not allow domain services, strategy logic, dashboard code, or AI prompts to call these external services directly.

## 4. Top-Level Architecture

```text
User / Operator
        |
        v
Dashboard and Control Plane
        |
        v
Application Services
        |
        +-------------------------+
        |                         |
        v                         v
Trading Decision Pipeline     Research and Validation Pipeline
        |                         |
        v                         v
Risk and Money Controls       Shadow / Backtest / Paper Engines
        |                         |
        +-----------+-------------+
                    |
                    v
Persistence, Audit, Metrics, Events
                    |
                    v
External Adapters
        +-----------+------------+-------------+
        |                        |             |
        v                        v             v
Toss Securities API       Naver News API    Claude API
```

The production trading path and research path must be separated. Research components may generate candidates and analysis, but production order execution requires approval from trading, risk, money management, and order approval components.

## 5. Architectural Layers

The system is divided into eight layers.

```text
Presentation Layer
Application Layer
Domain Layer
Decision Engine Layer
Risk and Approval Layer
Execution Adapter Layer
Persistence and Audit Layer
Infrastructure Layer
```

### 5.1 Presentation Layer

The Presentation Layer exposes the system to the user.

Responsibilities:

- dashboard views
- portfolio status
- strategy status
- risk status
- AI Health Check display
- exception and incident display
- kill switch control
- configuration review screens
- read-only operational history

Non-responsibilities:

- direct order creation
- direct broker API calls
- risk approval
- strategy promotion
- secret handling

### 5.2 Application Layer

The Application Layer coordinates use cases.

Responsibilities:

- run scheduled market scans
- initiate trading decision workflows
- initiate backtests
- initiate paper trading cycles
- coordinate strategy promotion workflow
- request AI analysis through the AI service boundary
- coordinate order lifecycle commands
- publish domain events

Non-responsibilities:

- implementing strategy scoring logic
- deciding final risk approval
- calling Toss API directly
- mutating strategy versions without audit records

### 5.3 Domain Layer

The Domain Layer contains the core business concepts.

Examples:

- Asset
- Market
- Portfolio
- Position
- Order
- Fill
- Strategy
- StrategyVersion
- Signal
- RiskLimit
- CashBalance
- NewsEvent
- AIAnalysis
- HealthCheck
- AuditRecord

The Domain Layer must be independent of external API payloads.

### 5.4 Decision Engine Layer

The Decision Engine Layer evaluates assets and strategies.

Primary engines:

- Market Engine
- Fundamental Engine
- News and Event Engine
- Strategy Engine
- Strategy Diversity Engine
- AI Research Engine
- AI Health Check Engine

These engines may produce scores, signals, explanations, and recommendations.

They must not directly place orders.

### 5.5 Risk and Approval Layer

The Risk and Approval Layer is the gatekeeper between decision and execution.

Primary components:

- Risk Engine
- Money Management Engine
- Order Approval Engine
- Kill Switch
- Compliance and Safety Guard

This layer has final authority to reject orders.

If this layer is unavailable, production order execution must stop.

### 5.6 Execution Adapter Layer

The Execution Adapter Layer isolates external service integrations.

Adapters:

- Toss Securities Adapter
- Naver News Adapter
- Claude AI Adapter
- Future News Provider Adapters
- Future Market Data Adapters

Adapters must normalize external data into internal contracts before returning results to application or domain services.

### 5.7 Persistence and Audit Layer

The Persistence and Audit Layer stores durable state.

Responsibilities:

- asset master data
- market data snapshots
- news data
- AI analysis outputs
- strategy definitions
- strategy versions
- signals
- order requests
- order approvals
- broker order IDs
- fills
- positions
- balances
- risk state
- shadow portfolio state
- paper trading records
- audit logs
- health check history

All production-relevant decisions must be reconstructable from stored data.

### 5.8 Infrastructure Layer

The Infrastructure Layer provides runtime support.

Responsibilities:

- scheduler
- job runner
- queue or event bus
- secret management
- logging
- metrics
- alerting
- deployment
- backup
- disaster recovery

## 6. Core Component Map

```text
Core System
|
|-- Market Data Service
|-- Asset Universe Service
|-- News Collection Service
|-- AI Analysis Service
|-- Strategy Service
|-- Signal Service
|-- Portfolio Service
|-- Risk Service
|-- Money Management Service
|-- Order Approval Service
|-- Execution Service
|-- Reconciliation Service
|-- Backtest Service
|-- Shadow Portfolio Service
|-- Paper Trading Service
|-- Strategy Promotion Service
|-- AI Health Check Service
|-- Audit Service
|-- Alert Service
|-- Dashboard API
```

Each service owns a clear responsibility. Cross-service communication should use explicit contracts, not shared mutable state.

## 7. Trading Decision Pipeline

The live trading pipeline must follow this order:

```text
1. Load approved strategy version
2. Load asset universe
3. Collect market and account data
4. Collect relevant news and events
5. Normalize all inputs
6. Run Market Engine
7. Run Fundamental Engine
8. Run News and Event Engine
9. Run Strategy Engine
10. Produce candidate signal
11. Run Risk Engine
12. Run Money Management Engine
13. Run Order Approval Engine
14. Create broker order request
15. Submit through Toss Securities Adapter
16. Track order status
17. Reconcile fills and balances
18. Persist audit trail
19. Update metrics and dashboard
```

Any failure after candidate signal generation but before order submission must result in no order.

Any uncertainty after order submission must trigger reconciliation before another related order is allowed.

## 8. Research and Validation Pipeline

The research pipeline must be separate from production trading.

```text
1. Collect historical and live data
2. Generate strategy hypothesis
3. Create versioned candidate strategy
4. Run backtest
5. Run walk-forward validation
6. Run Shadow Portfolio
7. Run Paper Trading
8. Run small-capital live validation
9. Compare against baseline strategies
10. Produce promotion recommendation
11. Require configured approval policy
12. Promote or reject strategy version
```

Research may run continuously. Promotion must be controlled.

## 9. Multi-Market Architecture

The system supports Korean and U.S. markets through a common domain model with market-specific modules.

```text
Common Core
        |
        v
Market Rule Layer
        |
        +-- KR Market Rules
        +-- US Market Rules
```

Common model fields:

```text
market: KR | US
asset_type: STOCK | ETF
currency: KRW | USD
symbol: internal normalized symbol
broker: TOSS_SECURITIES
```

Market-specific handling includes:

| Area | KR Market | US Market |
|---|---|---|
| Currency | KRW | USD |
| Symbol format | Korean stock code | U.S. ticker |
| Trading calendar | KRX calendar | U.S. exchange calendar |
| Market hours | Korean regular session | U.S. regular session, with optional extended hours if supported |
| Disclosure source | DART and Korean sources | SEC and U.S. sources |
| News coverage | Korean news sources | initially Naver News API, expandable |
| Profit measurement | KRW | USD and KRW-converted |
| Risk model | KR limits | US limits plus FX impact |

The system must not assume a strategy validated in one market is valid in another market.

## 10. Adapter Architecture

External service access must use adapter boundaries.

```text
Domain / Application Services
        |
        v
Internal Interface
        |
        v
Adapter Implementation
        |
        v
External API
```

### 10.1 Toss Securities Adapter

The Toss Securities Adapter owns all broker communication.

Responsibilities:

- authentication and token refresh
- account query
- balance query
- position query
- market data query
- tradable asset query
- buying power query
- sellable quantity query
- order submission
- order correction
- order cancellation
- order status query
- fill query
- error normalization
- rate limit handling
- idempotency support where possible

Forbidden:

- strategy scoring
- AI reasoning
- portfolio optimization
- bypassing Order Approval Engine
- accepting raw natural language commands as orders

### 10.2 Naver News Adapter

The Naver News Adapter owns Naver News API communication.

Responsibilities:

- authentication header management
- query construction
- pagination
- rate limit handling
- response normalization
- HTML tag cleanup
- timestamp normalization
- source metadata extraction
- duplicate article support
- error normalization

The News Engine must not depend directly on Naver-specific response fields.

### 10.3 Claude AI Adapter

The Claude AI Adapter owns Claude API communication.

Responsibilities:

- prompt assembly from approved templates
- model configuration
- structured output request
- JSON parsing
- schema validation
- retry policy for recoverable failures
- cost and token logging
- safety classification of outputs
- storing raw and normalized AI output where allowed

Forbidden:

- broker order execution
- credential access for Toss Securities
- unstructured production decisions
- silent fallback to stale AI output

## 11. Event-Driven Architecture

The system should use events for important state transitions.

Example event categories:

- MarketDataUpdated
- NewsCollected
- NewsEventClassified
- SignalGenerated
- RiskCheckPassed
- RiskCheckFailed
- OrderApproved
- OrderRejected
- OrderSubmitted
- OrderAcceptedByBroker
- OrderPartiallyFilled
- OrderFilled
- OrderCancelled
- OrderFailed
- PositionUpdated
- BalanceUpdated
- StrategyCandidateCreated
- StrategyBacktestCompleted
- ShadowPortfolioUpdated
- StrategyPromotionRequested
- StrategyPromoted
- KillSwitchActivated
- HealthCheckCompleted
- AlertRaised

Events should be immutable after creation.

Production-critical events must be persisted before downstream side effects whenever practical.

## 12. State Model

The system must distinguish between desired state, requested state, broker state, and reconciled state.

### 12.1 Order State

```text
Draft
-> Candidate
-> RiskChecked
-> MoneyChecked
-> Approved
-> Submitted
-> BrokerAccepted
-> PartiallyFilled
-> Filled
```

Alternative terminal states:

```text
Rejected
Cancelled
Expired
Failed
UnknownRequiresReconciliation
```

No new dependent order may be submitted while a related order is in `UnknownRequiresReconciliation`.

### 12.2 Strategy State

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
```

Alternative states:

```text
Rejected
Paused
Deprecated
Retired
RollbackTarget
```

## 13. Data Flow

### 13.1 Market and Account Data Flow

```text
Toss Securities API
-> Toss Securities Adapter
-> Normalized Market / Account Contracts
-> Persistence
-> Engines
-> Dashboard
```

### 13.2 News Data Flow

```text
Naver News API
-> Naver News Adapter
-> Normalized Article Records
-> Deduplication
-> Symbol Mapping
-> Claude Analysis
-> News Event Records
-> Strategy and Risk Engines
```

### 13.3 AI Analysis Flow

```text
Approved prompt template
-> Claude AI Adapter
-> Claude API
-> Raw response
-> Schema validation
-> Normalized AIAnalysis record
-> Decision engines or reports
```

### 13.4 Order Flow

```text
Signal
-> RiskCheck
-> MoneyCheck
-> OrderApproval
-> ExecutionCommand
-> Toss Securities Adapter
-> BrokerOrder
-> Reconciliation
-> Position and Balance Update
```

## 14. Safety Boundaries

The system must enforce strict boundaries.

### 14.1 AI Boundary

AI output is advisory unless converted into a validated internal contract and passed through deterministic checks.

AI cannot hold broker credentials.

AI cannot directly produce an executable broker request.

### 14.2 Broker Boundary

Only Execution Service may request order submission.

Only Toss Securities Adapter may call broker endpoints.

Order Approval Engine must create an approval record before any broker order is submitted.

### 14.3 Strategy Boundary

Only approved strategy versions may run in production.

Candidate strategies may run only in research, backtest, shadow, paper, or configured small-capital live modes.

### 14.4 Configuration Boundary

Risk limits, capital limits, strategy weights, and production mode changes must be versioned and auditable.

### 14.5 Compliance Boundary

The Compliance and Safety Guard is a hard production boundary.

It must block live broker write operations when:

- broker terms review is not completed
- automated trading permission is unknown
- account permission state is unknown
- data licensing is unclear for the intended use
- tax, fee, slippage, or currency conversion assumptions are missing for the target market
- the system is outside the documented personal-use scope

This boundary is not an investment decision layer. It prevents the system from operating outside reviewed legal, broker, data, and account constraints.

## 15. Fail-Safe Principles

The system must prefer no trade over unsafe trade.

Trading must stop or reduce when:

- broker API is unavailable
- authentication fails
- market data is stale
- account data is inconsistent
- order state is unknown
- duplicate order risk is detected
- AI output fails schema validation
- news data is required but unavailable
- risk engine is unavailable
- money management engine is unavailable
- kill switch is active
- daily, weekly, monthly, or total drawdown limits are breached

## 16. Observability Architecture

The system must expose enough information to understand what happened and why.

Observability includes:

- structured logs
- metrics
- audit events
- order lifecycle records
- strategy version records
- AI request and response metadata
- API latency and failure rates
- dashboard status
- alert history

Every production order must be explainable after the fact.

The explanation must include:

- strategy version
- input data references
- engine scores
- AI analysis references if used
- risk checks
- money checks
- approval record
- broker response
- fill and reconciliation result

## 17. Deployment Architecture

The target production deployment should run independently of the user's personal computer.

Recommended deployment shape:

```text
Cloud Runtime
|
|-- Application API
|-- Scheduled Workers
|-- Job Queue
|-- Database
|-- Secret Manager
|-- Monitoring
|-- Dashboard
```

Initial local development can run on a personal machine, but live trading must be designed for cloud operation with controlled secrets and monitoring.

## 18. Configuration Architecture

Configuration must be separated into categories.

```text
static config
runtime config
secret config
strategy config
risk config
market config
environment config
```

Rules:

- secrets must not be committed to Git
- production config changes must be auditable
- risk config changes must be versioned
- strategy config changes must be tied to strategy versions
- default config should be conservative

## 19. Security Architecture

Security is a core system property.

Minimum requirements:

- no API keys in source code
- environment-specific secrets
- least privilege access
- secret rotation support
- encrypted storage where needed
- no sensitive data in logs
- protected production controls
- audit trail for operator actions
- separation between read-only analysis and write-capable execution

## 20. Extension Architecture

The system should support future extension without rewriting core logic.

Possible future extensions:

- additional news provider
- additional broker adapter
- additional market data provider
- additional AI model
- additional asset class after separate approval
- portfolio optimizer
- tax reporting module
- mobile dashboard

Extension must happen through interfaces and adapters, not direct coupling.

### 20.1 Historical Data and Corporate Action Architecture

Backtesting, walk-forward validation, Shadow Portfolio, and strategy promotion require a dedicated historical data path.

The historical data path must include:

- historical price bars
- corporate action records
- split and reverse split adjustments
- dividend and distribution records
- delisting and trading halt records where available
- market calendar and session metadata
- cost, fee, tax, slippage, and FX model versions

Historical data must be normalized before strategy validation. A strategy cannot be promoted when its performance depends on unadjusted split data, missing dividends, missing delisting events, or undefined trading cost assumptions.

The live market data path and historical validation path may share normalized asset identifiers, but they must keep source, timestamp, adjustment method, and quality metadata separate.

## 21. Key Architecture Decisions

### 21.1 AI Is Not the Trader

Decision:

Claude API is an analyst, researcher, and auditor. It is not the order executor.

Reason:

AI output can be wrong, stale, or overconfident. Production orders require deterministic checks.

### 21.2 Toss Securities API Is Isolated Behind One Adapter

Decision:

All Toss Securities calls go through Toss Securities Adapter.

Reason:

Broker behavior, authentication, market differences, and error formats must not leak into the core domain.

### 21.3 Research and Production Are Separate Pipelines

Decision:

New strategies must be developed and validated outside the production trading path.

Reason:

Strategy evolution is valuable only if it cannot accidentally destabilize live capital.

### 21.4 Risk Engine Has Veto Authority

Decision:

Risk Engine can reject any order regardless of signal score or AI analysis.

Reason:

Capital protection has priority over opportunity capture.

### 21.5 Unknown Broker State Blocks Dependent Trading

Decision:

If the system cannot determine whether an order was accepted, filled, rejected, or cancelled, related trading pauses until reconciliation completes.

Reason:

Unknown order state is a major source of duplicate orders and incorrect exposure.

## 22. Architecture Quality Attributes

The architecture must optimize for:

- safety
- auditability
- testability
- modularity
- reversibility
- explainability
- operational stability
- conservative failure behavior
- future extension

It must not optimize primarily for:

- fastest possible order execution
- maximum short-term profit
- unrestricted AI autonomy
- minimum code complexity at the expense of safety
- hidden strategy mutation

## 23. Open Architecture Questions

The following questions require later validation:

- Does Toss Securities Open API support all required Korean and U.S. ETF order types?
- Does Toss Securities Open API support fractional U.S. stock or ETF orders?
- Does Toss Securities Open API support extended-hours U.S. trading?
- Does Toss Securities Open API expose exchange rate and currency conversion APIs?
- Does Toss Securities Open API provide a test or mock trading environment?
- What are the actual API rate limits for market data, account queries, and orders?
- Is Naver News API sufficient for U.S. stock news coverage?
- Which database engine should be used for initial production?
- Which scheduler and queue architecture should be used?
- Which deployment provider should host the first live environment?

These questions must be resolved in the relevant API, database, testing, and operation documents.

## 24. Final Architecture Statement

AI Investment Operating System is a safety-first, document-driven, multi-engine investment platform.

Its architecture separates:

- analysis from execution
- research from production
- broker integration from domain logic
- AI reasoning from deterministic approval
- candidate strategies from approved strategies
- normal operation from exception handling

This separation is the main mechanism that allows the system to improve over time without giving uncontrolled authority to any single AI model, strategy, API, or human impulse.
