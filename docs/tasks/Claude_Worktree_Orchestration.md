# Claude Code Worktree Orchestration Guide

Version: 0.3.3
Status: Draft
Last Updated: 2026-07-28

## 1. Purpose

This guide defines how to split the implementation backlog across multiple Claude Code worktree sessions.

The goal is to enable parallel development while preserving the system's safety architecture.

## 2. Universal Rule for Every Claude Code Session

Before implementation, every session must read:

1. `docs/01_Project_Vision.md`
2. `docs/02_System_Architecture.md`
3. `docs/10_Claude_Code_Guide.md`
4. `docs/11_AI_RULES.md`
5. the assigned task file
6. the architecture document directly related to the assigned task

No Claude Code session may weaken or bypass:

- AI is not the trader
- Signal is not Order
- News is not direct order trigger
- Risk Engine is mandatory
- Money Management Engine is mandatory
- Order Approval Engine is mandatory
- Broker Write Command Guard is mandatory
- live broker write operations remain blocked until all gates pass

## 3. Recommended Initial Parallel Sessions

### Session A: Foundation and Project Skeleton

Branch:

```text
feature/foundation-project-skeleton
```

Tasks:

- Task-001 Project Structure
- Task-002 Runtime Config and Secrets
- Task-020 CI Baseline

Primary files:

- project root
- config
- test setup
- CI setup

Avoid:

- trading logic
- external API calls
- database schema beyond baseline setup unless coordinated

### Session B: Core Domain

Branch:

```text
feature/core-domain-models
```

Tasks:

- Task-003 Core Value Objects
- Task-004 Market and Asset Model
- Task-005 Broker Account Model
- Task-006 Strategy and Signal Model
- Task-007 Order State Machines
- Task-008 Risk and Money Model

Primary files:

- domain models
- domain tests

Avoid:

- database migrations unless coordinated with Session C
- adapter implementation
- dashboard code

### Session C: Database Foundation

Branch:

```text
feature/database-foundation
```

Tasks:

- Task-009 Database Migration Framework
- Task-010 Core Database Schema
- Task-011 Historical Data Schema
- Task-012 Outbox Event Schema

Primary files:

- migrations
- database config
- repository interfaces if needed

Avoid:

- business logic beyond schema constraints
- external API calls

### Session D: Adapter Boundaries

Branch:

```text
feature/adapter-boundaries
```

Tasks:

- Task-013 Adapter Interface Contracts
- Task-014 Toss Read-Only Capability Discovery
- Task-015 Naver News Adapter
- Task-016 Claude Adapter Schema Validation

Primary files:

- adapter interfaces
- provider-specific adapters
- API fixtures
- schema validators

Avoid:

- Toss write methods
- strategy execution
- direct domain persistence unless coordinated

### Session E: Safety and Audit

Branch:

```text
feature/safety-audit-foundation
```

Tasks:

- Task-017 Compliance Gate Service
- Task-018 Audit Log Service
- Task-019 Safety Regression Test Harness
- Task-042 Broker Write Command Guard
- Task-047 Kill Switch Control Service

Primary files:

- safety services
- audit services
- safety tests

Avoid:

- real broker write calls
- dashboard controls unless coordinated with Session J

### Session F: Strategy Analysis Engines

Branch:

```text
feature/strategy-analysis-engines
```

Tasks:

- Task-021 Market Data Ingestion Read Model
- Task-022 News Event Normalization
- Task-023 AI Analysis Persistence
- Task-024 Market Engine Baseline
- Task-025 Fundamental Engine Interface
- Task-026 News Event Engine Baseline
- Task-027 Strategy Scoring Service

Primary files:

- analysis services
- scoring models
- fixtures

Avoid:

- OrderIntent creation
- broker execution

### Session G: Trading Approval and Simulation

Branch:

```text
feature/trading-approval-simulation
```

Tasks:

- Task-028 Risk Engine Baseline
- Task-029 Money Management Engine Baseline
- Task-030 Order Approval Engine Baseline
- Task-041 Outbox Worker Baseline
- Task-043 Order Execution Simulation
- Task-044 Order Cancel Simulation
- Task-045 Fill Processing and Position Update

Primary files:

- risk service
- money service
- order approval service
- simulated execution
- fill processing

Avoid:

- real Toss write methods
- production live mode

### Session H: Validation Environments

Branch:

```text
feature/validation-environments
```

Tasks:

- Task-031 Backtest Engine Baseline
- Task-032 Walk-Forward Validation
- Task-033 Shadow Portfolio Engine
- Task-034 Paper Trading Engine
- Task-035 Strategy Diversity Engine
- Task-036 Strategy Promotion Workflow

Primary files:

- validation engines
- strategy research models
- promotion workflow

Avoid:

- live capital use
- broker write calls

### Session I: Operations and Monitoring

Branch:

```text
feature/operations-monitoring
```

Tasks:

- Task-037 AI Health Check Baseline
- Task-038 Reconciliation Read-Only Baseline
- Task-040 Operational Alerting Baseline
- Task-046 Reconciliation Workflow
- Task-051 Scheduler and Job Runner Baseline
- Task-052 Data Quality Monitor
- Task-053 API Usage and Cost Monitor
- Task-057 Observability Metrics Baseline

Primary files:

- monitoring services
- job runner
- alert models
- metrics

Avoid:

- live corrective trading
- real broker write operations

### Session J: Dashboard and Access Control

Branch:

```text
feature/dashboard-control-plane
```

Tasks:

- Task-039 Dashboard Read-Only Status
- Task-048 Dashboard Sensitive Control Gate
- Task-049 Strategy Promotion Dashboard Workflow
- Task-050 Config Versioning Service
- Task-058 Security Access Control Baseline

Primary files:

- dashboard API or UI boundary
- access control
- read-only status views
- sensitive action gate

Avoid:

- raw broker API access
- live trading control without guard integration

### Session K: Deployment and Runbooks

Branch:

```text
feature/deployment-runbooks
```

Tasks:

- Task-054 Backup and Restore Runbook
- Task-055 Incident Runbook Set
- Task-056 Deployment Environment Skeleton

Primary files:

- deployment docs
- runbooks
- environment skeleton

Avoid:

- real production deployment
- storing production secrets

## 4. Recommended Merge Order

Merge in this order:

1. Session A: Foundation and Project Skeleton
2. Session B: Core Domain
3. Session C: Database Foundation
4. Session D: Adapter Boundaries
5. Session E: Safety and Audit
6. Session F: Strategy Analysis Engines
7. Session G: Trading Approval and Simulation
8. Session H: Validation Environments
9. Session I: Operations and Monitoring
10. Session J: Dashboard and Access Control
11. Session K: Deployment and Runbooks

If two sessions touch the same module, merge the lower-level dependency first.

## 5. Blocking Rules

The following work remains blocked:

- real Toss order creation
- real Toss order cancellation
- automatic live strategy promotion
- production capital expansion
- public multi-user service behavior
- third-party money management behavior

These require explicit architecture review, compliance review, and resolved open questions.

## 6. Final Instruction

Claude Code should optimize for small, reviewable pull requests.

When uncertain, preserve safety and ask for architecture review rather than guessing.
