# 01 Project Vision

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-27  
Related Docs: 02_System_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 11_AI_RULES.md, 99_Development_Roadmap.md

## 1. Document Purpose

This document defines the vision, philosophy, boundaries, and success criteria of the AI Investment Operating System.

It is the highest-level project document. Every architecture decision, implementation task, AI behavior rule, and trading rule must be consistent with this document.

This document does not define detailed database schemas, API fields, or implementation tasks. Those details are handled by the related architecture and development documents.

## 2. Project Definition

AI Investment Operating System is a personal automated investment platform for Korean and U.S. stocks and ETFs.

The system is not designed as a simple trading bot that executes one fixed strategy. It is designed as an investment operating system that can:

- collect market, account, and news data
- evaluate assets through multiple independent engines
- manage portfolio risk
- execute orders through a broker adapter
- monitor system health
- record all decisions and trade results
- research and validate new strategies
- promote verified strategies through controlled stages
- continuously improve without bypassing safety rules

The system's initial external service configuration is:

| Area | Selected Service | Role |
|---|---|---|
| Broker, account, market data, order execution | Toss Securities Open API | Korean and U.S. stock/ETF trading |
| News collection | Naver News API | news search and event detection |
| AI analysis and strategy research | Claude API | structured analysis, health checks, research, and auditing |

## 3. Core Philosophy

The core philosophy is:

> Survival comes before profit.

The system must never treat short-term return as the highest goal. Its first goal is to avoid catastrophic loss, technical failure, uncontrolled orders, and emotional intervention.

The system is built around the following operating sequence:

```text
survival
-> risk control
-> verification
-> execution
-> measurement
-> improvement
-> gradual expansion
```

This sequence must not be reversed.

## 4. Investment Constitution

The following principles are the constitutional layer of the system. Lower-level trading rules may be modified through controlled review, but these principles define the spirit of the system.

### 4.1 Capital Protection Comes Before Return

The system must calculate possible loss before expected return.

No single trade, position, strategy, asset class, market, or external service may be allowed to create an unrecoverable account-level loss.

### 4.2 Do Not Trade Assets the System Cannot Understand

The system must not trade an asset unless it can identify:

- the market
- the asset type
- the currency
- the symbol
- the tradability status
- the main risk factors
- the applicable trading rules
- the available data sources

If the system cannot classify an asset confidently, the default action is no trade.

### 4.3 Diversification Must Reduce Real Risk

Diversification is not simply holding many symbols.

The system must evaluate concentration across:

- individual symbols
- sectors
- countries
- currencies
- strategies
- event types
- data sources
- correlation between strategies

If several strategies buy highly correlated assets at the same time, the system must treat them as concentrated risk.

### 4.4 Cash Is a Strategic Asset

Cash is not idle failure. Cash is a defensive and opportunistic asset.

The system must maintain minimum cash rules, including separate treatment for:

- KRW cash
- USD cash
- investable cash
- reserved cash
- emergency or business-use funds that must not be traded

### 4.5 Rules Must Defeat Emotion

The system exists partly to prevent human emotional errors:

- revenge trading
- panic selling
- chasing fast-rising assets
- manually overriding a strategy after short-term losses
- increasing risk after short-term gains
- changing rules immediately after an emotional event

Manual intervention must be restricted to operational safety actions, such as emergency stop, credential rotation, and system recovery.

### 4.6 Every Buy Must Have an Exit Logic

No buy order may be approved unless the system has a defined exit framework.

The exit framework may include:

- target profit logic
- stop loss logic
- time-based exit
- thesis invalidation
- trailing risk control
- portfolio rebalancing
- strategy downgrade
- liquidity or data quality failure

### 4.7 Stay in the Market Long Enough for Compounding

The system must not pursue returns in a way that threatens long-term survival.

A strategy that can destroy the account under realistic market stress is unacceptable, even if its backtest return looks attractive.

### 4.8 Protect Profits as Capital

Profits must not be treated as free money.

The system must protect realized gains with the same discipline used for original capital.

### 4.9 Admit That the System Can Be Wrong

Every model, rule, data source, and AI analysis can be wrong.

Therefore, the system must:

- measure real outcomes
- record failed assumptions
- detect drift
- compare live results against expected results
- downgrade or retire strategies when evidence requires it

### 4.10 The System Must Be Stronger Than Human Impulse

The system must prevent impulsive trading decisions.

However, the system must also recognize that software can fail mechanically. Therefore:

- arbitrary manual trading intervention is restricted
- emergency kill switch behavior is mandatory
- system changes must be logged and versioned
- strategy changes must follow review and validation
- technical faults must stop trading rather than continue with assumptions

### 4.11 Strategy Changes Are Trading Decisions

Changing a rule can be more dangerous than placing a trade.

The system must treat strategy changes as controlled events that require:

- versioning
- reason logging
- backtesting
- validation
- comparison against baseline
- rollback capability

### 4.12 Unverified Strategies Must Not Touch Production Capital

Every new or modified strategy must pass staged validation:

```text
research
-> backtest
-> walk-forward validation
-> shadow portfolio
-> paper trading
-> small-capital live trading
-> production promotion
```

Skipping stages is not allowed.

## 5. Product Vision

The project should become a personal AI investment operating system with five major capabilities.

### 5.1 Automated Trading Execution

The system can execute orders automatically through Toss Securities Open API only after all approval layers pass.

Execution must include:

- order creation
- order correction
- order cancellation
- order status tracking
- fill reconciliation
- balance synchronization
- duplicate order prevention
- failure recovery

### 5.2 Multi-Engine Asset Evaluation

The system does not rely on one AI model or one indicator.

It evaluates assets through multiple engines:

- Market Engine
- Fundamental Engine
- News and Event Engine
- Risk Engine
- Money Management Engine
- Strategy Engine
- Order Approval Engine

AI may assist analysis, but deterministic approval layers control whether an order can be sent.

### 5.3 AI Research and Auditing

Claude API is used as:

- analyst
- researcher
- auditor
- health checker
- explanation generator
- anomaly detector

Claude API is not used as an unrestricted trader.

### 5.4 Continuous Strategy Improvement

The system should continuously evaluate strategy performance and research improvements.

When performance deteriorates, the system should:

- identify possible causes
- compare affected strategies with baselines
- generate improvement candidates
- test candidates in non-production environments
- promote only verified improvements

### 5.5 Quiet Operations

The system should not constantly notify the user about normal events.

Normal buy, sell, and profit events should be available through the dashboard, but notifications should focus on exceptions:

- API failure
- order failure
- server failure
- kill switch activation
- risk limit breach
- abnormal account state
- unexpected strategy behavior

The guiding principle is:

> A good automated investment system should usually be quiet.

## 6. Target Markets and Assets

The initial target markets are:

- Korean market
- U.S. market

The initial target assets are:

- Korean stocks
- Korean ETFs
- U.S. stocks
- U.S. ETFs

Cryptocurrency trading is explicitly out of scope.

Other asset classes may be considered in the future only if they pass separate architectural, regulatory, API, and risk reviews.

## 7. System Scope

### 7.1 In Scope

The following capabilities are in scope for the platform:

- Toss Securities Open API adapter
- Korean and U.S. market handling
- stock and ETF asset model
- Naver News API adapter
- Claude API adapter
- market data ingestion
- account and position synchronization
- news collection and deduplication
- AI news and event analysis
- strategy research
- backtesting
- walk-forward validation
- shadow portfolio
- paper trading
- small-capital live trading
- production strategy promotion
- risk management
- money management
- order approval
- order execution
- trade reconciliation
- AI Health Check
- dashboard status model
- exception-only alerting
- audit logs
- strategy version management
- documentation-driven development

### 7.2 Out of Scope

The following are out of scope for the initial system:

- cryptocurrency trading
- futures and options trading
- leverage trading unless separately approved
- margin trading
- short selling
- fully discretionary AI trading
- AI direct broker access
- manual day-trading tools
- social trading
- public investment advisory service
- multi-user brokerage operations
- fund management for third parties
- guaranteed return claims

## 8. AI Role Definition

AI must be used carefully because it can produce plausible but wrong conclusions.

The system uses AI for analysis and research, not direct authority.

### 8.1 Allowed AI Roles

AI may:

- summarize news
- classify events
- identify possible impact
- compare conflicting evidence
- generate structured analysis
- explain why a signal appeared
- analyze strategy performance
- detect possible drift
- propose strategy improvements
- generate candidate strategies
- produce health check reports
- assist documentation and development

### 8.2 Forbidden AI Roles

AI must not:

- directly call Toss Securities Open API
- place orders directly
- bypass Risk Engine
- bypass Money Management Engine
- bypass Order Approval Engine
- promote unverified strategies to production
- reuse stale analysis as if it were current
- treat one news article as sufficient order justification
- modify production risk limits without controlled approval
- hide uncertainty or missing data

## 9. Strategy Evolution Vision

The system should evolve, but evolution must be controlled.

The target model is not:

```text
AI changes live strategy whenever performance is bad
```

The target model is:

```text
AI observes performance
-> AI researches alternatives
-> alternatives run in Shadow Portfolio
-> validated candidates enter Paper Trading
-> candidates pass small-capital live trading
-> only then can they be promoted
```

This structure protects the live account while allowing continuous improvement.

## 10. Strategy Diversity Vision

The system must avoid depending on a single market assumption.

The Strategy Diversity Engine will research and evaluate multiple strategy families, including:

- value
- growth
- quality
- momentum
- dividend
- mean reversion
- event-driven
- sector rotation
- low volatility
- ETF allocation
- market defense
- cash expansion

The goal is not to run every strategy at all times. The goal is to maintain a research and validation environment where multiple independent strategy families can be measured, compared, promoted, reduced, or retired.

## 11. Shadow Portfolio Vision

Shadow Portfolio is a core safety system.

It allows the system to test new strategies in realistic market conditions without risking production capital.

Shadow Portfolio must account for:

- real market prices
- estimated fills
- slippage
- fees
- taxes
- liquidity
- partial fills
- failed orders
- currency conversion
- market hours
- data availability

Shadow results must be stored and compared against production strategies before promotion decisions.

## 12. Operating Modes

The system should support multiple operating modes.

### 12.1 Research Mode

No live orders. Used for strategy design, data exploration, and simulations.

### 12.2 Backtest Mode

No live orders. Uses historical data to evaluate a strategy.

### 12.3 Shadow Portfolio Mode

No live orders. Uses live or near-live data to simulate strategy decisions and realistic execution.

### 12.4 Paper Trading Mode

No live orders. Produces full order lifecycle simulation and operational logs.

### 12.5 Small-Capital Live Mode

Live orders allowed, but only under strict capital limits.

This stage validates operational behavior, not just strategy performance.

### 12.6 Production Mode

Live orders allowed under approved strategy versions and risk rules.

Production mode must remain observable, reversible, and controlled.

## 13. Success Criteria

The project is successful only if it satisfies operational, safety, and learning criteria. Profit alone is not enough.

### 13.1 Architecture Success Criteria

- Major components are separated by clear boundaries.
- Broker APIs are accessed only through adapters.
- AI components do not have direct trading authority.
- Risk and money management rules are deterministic and testable.
- Strategy versions are auditable and reversible.

### 13.2 Safety Success Criteria

- Duplicate order prevention works.
- Kill switch behavior works.
- API failure stops unsafe trading.
- Stale data is rejected.
- Order and fill reconciliation works.
- Secrets are never stored in source code.
- Production changes are logged.

### 13.3 Strategy Success Criteria

- Strategies can be compared against baselines.
- Strategy performance is measured after fees, taxes, slippage, and currency effects.
- Backtest, shadow, paper, small-capital live, and production results are separately stored.
- Strategy promotion requires objective evidence.

### 13.4 Operational Success Criteria

- The system can run without the user's personal computer being on.
- Normal operation is quiet.
- Exceptional conditions notify the user.
- Dashboard status is understandable.
- Failure states are diagnosable from logs and audit records.

### 13.5 Documentation Success Criteria

- Codex can review the architecture from the docs.
- Claude Code can implement modules from task documents.
- Future AI agents can read the documentation and follow the same rules.
- Major decisions are documented before implementation.

## 14. Non-Success Criteria

The project must not be judged successful merely because:

- a backtest shows high return
- one short live test was profitable
- AI produced confident analysis
- a strategy worked in one market regime
- the system can place orders
- the dashboard looks complete

A trading system that can place orders but cannot explain, limit, audit, and recover from its own behavior is not successful.

## 15. Risk Posture

The system must assume that failures will happen.

Expected failure types include:

- broker API outage
- authentication failure
- stale market data
- duplicate news
- incorrect symbol mapping
- wrong AI classification
- sudden market crash
- exchange holiday mismatch
- currency conversion error
- partial fill mismatch
- order status uncertainty
- strategy drift
- overfitting
- excessive API cost
- unexpected user intervention

The default response to uncertainty is to reduce risk or stop trading.

## 16. Development Philosophy

The project follows documentation-driven development.

The desired flow is:

```text
vision
-> architecture
-> domain model
-> API contracts
-> data model
-> AI rules
-> trading rules
-> development tasks
-> implementation
-> tests
-> paper trading
-> live validation
```

Implementation must not run ahead of the safety model.

## 17. Repository Philosophy

The repository is the shared memory of the project.

It must contain:

- official documentation
- architecture decisions
- AI safety rules
- implementation tasks
- code
- tests
- operational runbooks
- changelog

The repository must never contain:

- API keys
- account passwords
- certificate files
- broker credentials
- private financial statements unless intentionally encrypted and excluded from Git
- undocumented production changes

## 18. Initial Product Name

The working product name is:

```text
AI Investment Operating System
```

Short name:

```text
AI-IOS
```

The short name is only a project abbreviation and is not related to Apple's iOS.

## 19. Initial Development Path

The initial development path is:

1. Complete documentation structure.
2. Draft Project Vision.
3. Draft System Architecture.
4. Draft AI Rules.
5. Draft Trading System.
6. Draft API Architecture.
7. Draft Testing and Validation.
8. Request Codex architecture review.
9. Incorporate review feedback.
10. Generate Claude Code development tasks.
11. Implement modules through parallel worktree sessions.
12. Run backtesting and paper trading.
13. Start small-capital live trading only after validation.

## 20. Final Guiding Statement

AI Investment Operating System is not a machine for forcing profit out of the market.

It is a disciplined investment platform designed to:

- survive adverse conditions
- reduce emotional decisions
- evaluate strategies objectively
- trade only through controlled approval layers
- learn from evidence
- improve gradually
- preserve auditability

The system may pursue returns only after safety, verification, and control are in place.

