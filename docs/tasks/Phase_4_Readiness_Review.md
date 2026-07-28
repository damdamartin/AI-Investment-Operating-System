# Phase 4 Readiness Review

Version: 0.3.3
Status: Draft
Last Updated: 2026-07-28

## 1. Purpose

This document determines whether the project is ready to move from documentation and task planning into implementation.

Phase 4 means implementation of the safe foundation begins. It does not mean live trading begins.

## 2. Current Readiness Summary

Status:

```text
READY FOR SAFE FOUNDATION IMPLEMENTATION
```

The project is ready to implement foundation, domain, database, adapter boundary, safety, simulation, validation, monitoring, and dashboard-read-only work.

The project is not ready for real live broker write operations.

## 3. Documents Available

Required architecture documents exist:

- `docs/01_Project_Vision.md`
- `docs/02_System_Architecture.md`
- `docs/03_Domain_Model.md`
- `docs/04_Database_Architecture.md`
- `docs/05_API_Architecture.md`
- `docs/06_AI_Architecture.md`
- `docs/07_Trading_System.md`
- `docs/08_Testing_Validation.md`
- `docs/09_Operation_Deployment.md`
- `docs/10_Claude_Code_Guide.md`
- `docs/11_AI_RULES.md`
- `docs/12_CHANGELOG.md`
- `docs/13_Compliance_and_Legal_Review.md`
- `docs/99_Development_Roadmap.md`
- `docs/open_questions.md`

Implementation tasks available:

- `Task-001` through `Task-060`

## 4. Safe Implementation Scope

The following may begin:

- project skeleton
- config and secret loading pattern
- value objects
- domain models
- database migrations
- adapter interfaces
- read-only Toss capability discovery
- Naver News adapter
- Claude schema validation
- compliance gate
- audit logging
- safety regression tests
- market/news/AI read models
- analysis engines
- risk and money checks
- order approval engine
- execution simulation
- backtest
- walk-forward validation
- Shadow Portfolio
- Paper Trading
- AI Health Check
- read-only reconciliation
- read-only dashboard
- operational alerts
- runbooks
- deployment skeleton

## 5. Blocked Implementation Scope

The following must not begin yet:

- real Toss live order creation
- real Toss live order cancellation
- automatic production strategy promotion
- automatic production capital increase
- production dashboard control for live trading
- trading with unresolved broker state
- trading based only on news or AI output
- any feature that manages third-party funds or offers public investment advice

## 6. Critical Open Questions

The following open questions block live broker write work:

- OQ-001 Toss automated trading permission
- OQ-002 Toss account and permission model
- OQ-003 Toss order and fill identifiers
- OQ-004 Toss ETF, fractional, and extended-hours support
- OQ-005 Historical market data provider
- OQ-006 Corporate action normalization
- OQ-007 Tax and fee assumption source
- OQ-008 Strategy promotion thresholds

Medium-priority questions may be handled during safe foundation work:

- OQ-009 Dashboard authentication
- OQ-010 Queue and outbox implementation

## 7. First Implementation Wave

Recommended first wave:

1. Task-001 Project Structure
2. Task-002 Runtime Config and Secrets
3. Task-003 Core Value Objects
4. Task-004 Market and Asset Model
5. Task-005 Broker Account Model
6. Task-006 Strategy and Signal Model
7. Task-007 Order State Machines
8. Task-008 Risk and Money Model
9. Task-009 Database Migration Framework
10. Task-019 Safety Regression Test Harness
11. Task-020 CI Baseline

Reason:

These tasks establish the foundation and safety test harness before any complex behavior is introduced.

## 8. Second Implementation Wave

Recommended second wave:

1. Task-010 Core Database Schema
2. Task-011 Historical Data Schema
3. Task-012 Outbox Event Schema
4. Task-013 Adapter Interface Contracts
5. Task-017 Compliance Gate Service
6. Task-018 Audit Log Service
7. Task-042 Broker Write Command Guard
8. Task-047 Kill Switch Control Service

Reason:

These tasks convert architecture rules into enforceable persistence and safety boundaries.

## 9. Third Implementation Wave

Recommended third wave:

1. Task-014 Toss Read-Only Capability Discovery
2. Task-015 Naver News Adapter
3. Task-016 Claude Adapter Schema Validation
4. Task-021 Market Data Ingestion Read Model
5. Task-022 News Event Normalization
6. Task-023 AI Analysis Persistence
7. Task-024 Market Engine Baseline
8. Task-025 Fundamental Engine Interface
9. Task-026 News Event Engine Baseline
10. Task-027 Strategy Scoring Service

Reason:

These tasks add data and analysis without allowing direct trading.

## 10. Fourth Implementation Wave

Recommended fourth wave:

1. Task-028 Risk Engine Baseline
2. Task-029 Money Management Engine Baseline
3. Task-030 Order Approval Engine Baseline
4. Task-031 Backtest Engine Baseline
5. Task-032 Walk-Forward Validation
6. Task-033 Shadow Portfolio Engine
7. Task-034 Paper Trading Engine
8. Task-035 Strategy Diversity Engine
9. Task-036 Strategy Promotion Workflow

Reason:

These tasks prepare strategy validation and simulated operation before live execution.

## 11. Fifth Implementation Wave

Recommended fifth wave:

1. Task-037 AI Health Check Baseline
2. Task-038 Reconciliation Read-Only Baseline
3. Task-039 Dashboard Read-Only Status
4. Task-040 Operational Alerting Baseline
5. Task-041 Outbox Worker Baseline
6. Task-043 Order Execution Simulation
7. Task-044 Order Cancel Simulation
8. Task-045 Fill Processing and Position Update
9. Task-046 Reconciliation Workflow

Reason:

These tasks verify operational behavior in safe simulated and read-only modes.

## 12. Sixth Implementation Wave

Recommended sixth wave:

1. Task-048 Dashboard Sensitive Control Gate
2. Task-049 Strategy Promotion Dashboard Workflow
3. Task-050 Config Versioning Service
4. Task-051 Scheduler and Job Runner Baseline
5. Task-052 Data Quality Monitor
6. Task-053 API Usage and Cost Monitor
7. Task-054 Backup and Restore Runbook
8. Task-055 Incident Runbook Set
9. Task-056 Deployment Environment Skeleton
10. Task-057 Observability Metrics Baseline
11. Task-058 Security Access Control Baseline

Reason:

These tasks harden operations and control surfaces.

## 13. Phase 4 Entry Decision

Decision:

```text
APPROVED FOR SAFE FOUNDATION IMPLEMENTATION
```

Conditions:

- no live broker write implementation
- no production capital use
- no real automatic order submission
- no strategy auto-promotion to production
- every Claude Code session follows `docs/11_AI_RULES.md`
- unresolved live-trading questions stay tracked in `docs/open_questions.md`

## 14. Final Review Statement

The project may now move from document planning into safe foundation implementation.

The correct next step is not live trading. The correct next step is building the foundation that makes unsafe live trading impossible by default.
