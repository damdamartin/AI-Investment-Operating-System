# 99 Development Roadmap

Version: 0.4.16
Status: Draft
Last Updated: 2026-07-28
Related Docs: 01_Project_Vision.md, 02_System_Architecture.md, 08_Testing_Validation.md, 09_Operation_Deployment.md, 10_Claude_Code_Guide.md, 11_AI_RULES.md, 12_CHANGELOG.md, 13_Compliance_and_Legal_Review.md, open_questions.md

## 1. Document Purpose

This document defines the phased development roadmap for AI Investment Operating System.

It turns the architecture documents into an execution plan covering:

- documentation completion
- Codex technical review
- development specification
- Claude Code parallel implementation
- test and validation stages
- paper trading
- small-capital live trading
- production hardening
- continuous strategy evolution

The central roadmap principle is:

> Build the safety system before building the trading system.

## 2. Roadmap Overview

```text
Phase 0: Repository and documentation scaffold
Phase 1: Architecture documentation foundation
Phase 2: Codex architecture review
Phase 3: Development specification and task breakdown
Phase 4: Core implementation foundation
Phase 5: External adapters and data ingestion
Phase 6: Trading controls and approval pipeline
Phase 7: Research, backtest, Shadow Portfolio, and Paper Trading
Phase 8: Operations, dashboard, monitoring, and deployment
Phase 9: Small-capital live trading preparation
Phase 10: Small-capital live operation
Phase 11: Production candidate hardening
Phase 12: Continuous strategy evolution
```

## 3. Phase 0: Repository and Documentation Scaffold

Status:

```text
Completed
```

Goal:

Create the repository and documentation structure.

Completed items:

- repository initialized
- root README created
- MIT license added
- `.gitignore` added
- `docs` folder created
- documentation templates created
- initial documentation index created

Exit criteria:

- repository exists on GitHub
- initial commit exists
- docs folder structure exists

## 4. Phase 1: Architecture Documentation Foundation

Status:

```text
Completed
```

Goal:

Create the first complete documentation baseline.

Documents:

- `01_Project_Vision.md`
- `02_System_Architecture.md`
- `03_Domain_Model.md`
- `04_Database_Architecture.md`
- `05_API_Architecture.md`
- `06_AI_Architecture.md`
- `07_Trading_System.md`
- `08_Testing_Validation.md`
- `09_Operation_Deployment.md`
- `10_Claude_Code_Guide.md`
- `11_AI_RULES.md`
- `12_CHANGELOG.md`
- `99_Development_Roadmap.md`

Exit criteria:

- all listed documents have Draft status
- all placeholder documents are replaced
- changelog records all major documentation additions
- repository is pushed to GitHub

## 5. Phase 2: Codex Architecture Review

Status:

```text
Completed with required revisions
```

Goal:

Have Codex review the documentation set before implementation.

Review targets:

- logical consistency
- missing safety controls
- implementation risks
- API uncertainty
- data model gaps
- testing gaps
- production operation gaps
- Claude Code task readiness

Codex review prompt should ask for:

- findings by severity
- architectural contradictions
- missing requirements
- unsafe assumptions
- recommended revisions
- implementation order changes

Exit criteria:

- Codex review report exists
- critical findings resolved or explicitly accepted
- architecture documents revised to version `0.2.x`
- unresolved questions are captured

Current review report:

- `docs/reviews/Codex_Architecture_Review_2026-07-28.md`

Required Phase 2 revision themes:

- compliance and broker terms review requirements
- BrokerAccount model
- historical data and corporate action architecture
- cost, fee, tax, slippage, and currency conversion model ownership
- strategy promotion threshold defaults
- dashboard authentication and sensitive action controls
- outbox table and worker retry semantics
- central open questions tracker

## 6. Phase 3: Development Specification and Task Breakdown

Status:

```text
In progress
```

Goal:

Convert architecture documents into implementation-ready task documents.

Phase 3 may start after the 0.2.x revision set is reviewed. Critical open questions remain tracked in `docs/open_questions.md` and must be resolved before the affected live-trading tasks are implemented.

Deliverables:

- development specification
- module boundaries
- API interface contracts
- database migration plan
- initial folder structure
- coding standards
- task list
- acceptance criteria

Recommended task folder:

```text
docs/tasks/
```

Recommended task naming:

```text
Task-001_Project_Structure.md
Task-002_Core_Value_Objects.md
Task-003_Domain_State_Machines.md
```

Exit criteria:

- first 50-100 implementation tasks exist
- task dependencies are clear
- each task has tests and safety requirements
- Claude Code sessions can start without guessing architecture

Current task index:

- `docs/tasks/README.md`

Initial task batch:

- Task-001 through Task-020 cover project structure, config, value objects, domain models, broker account model, strategy/signal model, order state machines, risk and money model, database migrations, core schema, historical data schema, outbox schema, adapter contracts, read-only Toss capability discovery, Naver News adapter, Claude schema validation, compliance gate, audit logging, safety regression tests, and CI baseline.

Second task batch:

- Task-021 through Task-040 cover market data ingestion, news normalization, AI analysis persistence, baseline analysis engines, strategy scoring, risk, money management, order approval, backtest, walk-forward validation, Shadow Portfolio, Paper Trading, Strategy Diversity Engine, strategy promotion workflow, AI Health Check, read-only reconciliation, read-only dashboard status, and operational alerting.

Third task batch:

- Task-041 through Task-060 cover outbox worker processing, broker write command guarding, execution simulation, cancel simulation, fill processing, reconciliation workflow, kill switch controls, dashboard sensitive controls, promotion dashboard workflow, config versioning, scheduler and job runner, data quality monitor, API usage and cost monitor, backup and restore runbooks, incident runbooks, deployment skeleton, observability metrics, access control, Claude worktree orchestration, and Phase 4 readiness review.

Implementation planning documents:

- `docs/tasks/Claude_Worktree_Orchestration.md`
- `docs/tasks/Phase_4_Readiness_Review.md`

Phase 4 readiness decision:

```text
Approved for safe foundation implementation
```

Live broker write implementation remains blocked.

Safe foundation implementation status:

```text
Started
```

Completed in 0.4.0:

- Task-001 Project Structure
- Task-002 Runtime Config and Secrets
- Task-003 Core Value Objects

Completed in 0.4.1:

- Task-004 Market and Asset Model
- Task-005 Broker Account Model
- Task-006 Strategy and Signal Model
- Task-007 Order State Machines

Completed in 0.4.2:

- Task-008 Risk and Money Model
- Task-019 Safety Regression Test Harness
- Task-020 CI Baseline

Completed in 0.4.3:

- Task-009 Database Migration Framework
- Task-010 Core Database Schema
- Task-011 Historical Data Schema
- Task-012 Outbox Event Schema
- Task-013 Adapter Interface Contracts

Completed in 0.4.4:

- Task-014 Toss Read-Only Capability Discovery
- Task-017 Compliance Gate Service
- Task-018 Audit Log Service

Completed in 0.4.5:

- Task-015 Naver News Adapter
- Task-016 Claude Adapter Schema Validation

Completed in 0.4.6:

- Task-021 Market Data Ingestion Read Model

Completed in 0.4.7:

- Task-022 News Event Normalization

Completed in 0.4.8:

- Task-023 AI Analysis Persistence

Completed in 0.4.9:

- Task-024 Market Engine Baseline

Completed in 0.4.10:

- Task-025 Fundamental Engine Interface

Completed in 0.4.11:

- Task-026 News Event Engine Baseline

Completed in 0.4.12:

- Task-027 Strategy Scoring Service

Completed in 0.4.13:

- Task-028 Risk Engine Baseline

Completed in 0.4.14:

- Task-029 Money Management Engine Baseline

Completed in 0.4.15:

- Task-030 Order Approval Engine Baseline

Completed in 0.4.16:

- Task-031 Backtest Engine Baseline

Partially completed in 0.4.0:

- Task-020 CI Baseline

## 7. Phase 4: Core Implementation Foundation

Goal:

Build the project skeleton and core domain foundation.

Primary tasks:

- project structure
- language and framework selection
- package management
- configuration loading
- secret loading pattern
- structured logging
- test framework
- database migration framework
- core value objects
- domain entities
- state machines
- error model

Required tests:

- unit tests for value objects
- unit tests for state transitions
- secret redaction tests
- configuration tests
- database migration tests

Exit criteria:

- core project builds
- test suite runs
- no production secrets required
- domain model can represent assets, strategies, signals, orders, risk checks, and portfolios

## 8. Phase 5: External Adapters and Data Ingestion

Goal:

Implement safe read-first external integrations.

Primary modules:

- ClaudeAIAdapter
- NaverNewsAdapter
- TossSecuritiesAdapter read-only methods
- API capability registry
- API call logging
- raw payload redaction

Order of implementation:

1. Claude adapter with mocked responses
2. Claude schema validation
3. Naver news adapter with fixtures
4. Toss read-only adapter interface
5. Toss account and market data read tests
6. capability registry

Live broker write operations are not allowed in this phase.

Exit criteria:

- adapters pass contract tests
- API responses normalize into domain contracts
- secrets are not logged
- Toss read-only capability is verified where possible
- unverified capabilities remain blocked

## 9. Phase 6: Trading Controls and Approval Pipeline

Goal:

Build the controls that make live trading safe before any broker write operation exists.

Primary modules:

- Risk Engine
- Money Management Engine
- Order Approval Engine
- Kill Switch
- duplicate order prevention
- outbox pattern
- order lifecycle state machine
- audit records

Required tests:

- risk limit tests
- money check tests
- order approval reject tests
- kill switch tests
- stale data tests
- unknown broker state tests
- duplicate order tests

Exit criteria:

- Signal cannot become BrokerOrder directly
- failed RiskCheck blocks approval
- failed MoneyCheck blocks approval
- kill switch blocks approval
- unverified broker capability blocks production order approval
- all approval decisions are auditable

## 10. Phase 7: Research, Backtest, Shadow Portfolio, and Paper Trading

Goal:

Create non-production strategy validation environments.

Primary modules:

- Backtest Engine
- Walk-Forward Validation
- Shadow Portfolio
- Paper Trading
- Strategy Promotion Review
- Strategy Diversity Engine
- AI Health Check

Required capabilities:

- simulate orders without broker writes
- include fees, taxes, slippage, liquidity, and currency assumptions
- compare strategy versions
- record validation evidence
- reject overfit strategies

Exit criteria:

- candidate strategies can be tested without live capital
- Shadow Portfolio cannot call broker order APIs
- Paper Trading validates full order lifecycle
- strategy promotion requires evidence

## 11. Phase 8: Operations, Dashboard, Monitoring, and Deployment

Goal:

Prepare the system to run continuously.

Primary modules:

- dashboard status API
- dashboard UI
- scheduler
- worker system
- alerting
- monitoring metrics
- backup process
- restore process
- incident runbooks
- deployment pipeline

Required dashboard status:

- system status
- trading status
- kill switch state
- broker state
- data freshness
- reconciliation state
- AI Health Check state
- open alerts

Exit criteria:

- dashboard can show system health
- alerts work for exceptions
- backup can be restored
- deployment and rollback process exists
- production remains disabled by default

## 12. Phase 9: Small-Capital Live Trading Preparation

Goal:

Prepare for the first real but tightly limited broker write operations.

Prerequisites:

- all critical tests pass
- Toss order capabilities verified
- read-only reconciliation works
- order approval pipeline works
- kill switch works
- duplicate order prevention works
- alerting works
- operator runbooks exist
- small-capital limits configured

Allowed scope:

- minimal capital
- limited assets
- regular market hours only
- limit orders only
- no unverified ETF/fractional/extended-hours features

Exit criteria:

- production readiness checklist for small-capital mode passes
- manual approval received
- rollback plan exists

## 13. Phase 10: Small-Capital Live Operation

Goal:

Validate the system with real orders under strict limits.

Measure:

- order submission correctness
- fill reconciliation
- slippage
- fees
- taxes
- cash updates
- alert behavior
- dashboard accuracy
- broker API stability
- operator response process

Rules:

- no automatic capital increase
- no automatic strategy promotion
- daily review during early period
- unresolved broker state blocks trading
- any severe incident returns system to Paper Trading

Exit criteria:

- no duplicate orders
- no unresolved reconciliation issues
- actual fills match internal records
- alerts are actionable
- system can run without local computer
- results support or reject production expansion

## 14. Phase 11: Production Candidate Hardening

Goal:

Harden the system for larger but still controlled production operation.

Work items:

- performance tuning
- security review
- recovery drill
- extended monitoring
- risk parameter review
- strategy allocation review
- production incident simulation
- documentation update
- Codex review

Exit criteria:

- production candidate review completed
- critical and high-severity findings resolved
- rollback process verified
- operator is comfortable with emergency procedures

## 15. Phase 12: Continuous Strategy Evolution

Goal:

Operate the system as a learning investment platform.

Ongoing loops:

```text
production results
-> AI Health Check
-> performance analysis
-> candidate strategy generation
-> backtest
-> walk-forward validation
-> Shadow Portfolio
-> Paper Trading
-> small-capital live
-> promotion review
```

Rules:

- production strategies remain controlled
- candidate strategies run separately
- Shadow Portfolio is always separated from real capital
- promotion requires evidence
- risk limits remain conservative

## 16. Suggested Timeline

This timeline is directional, not a promise.

| Period | Focus |
|---|---|
| Week 1 | finish documentation foundation and Codex review |
| Week 2 | development specification and task breakdown |
| Weeks 3-4 | core domain, database, config, logging, test harness |
| Weeks 5-6 | Claude, Naver, and Toss read-only adapters |
| Weeks 7-8 | risk, money, order approval, kill switch |
| Weeks 9-10 | backtest, Shadow Portfolio, Paper Trading |
| Weeks 11-12 | dashboard, monitoring, alerts, deployment |
| Month 4 | small-capital live preparation and operation |
| Month 5+ | production candidate hardening and continuous strategy evolution |

Schedule may change after Codex review.

## 17. Risk-Based Priority

Highest priority:

- AI safety boundary
- risk engine
- money management
- order approval
- duplicate order prevention
- reconciliation
- kill switch
- secrets management
- audit trail

Lower priority until core safety exists:

- advanced dashboard design
- strategy optimization
- automatic strategy promotion
- extended-hours trading
- fractional trading
- complex AI strategy generation

## 18. First Claude Code Parallel Session Plan

After Phase 3, start with these sessions:

| Session | Branch | Goal |
|---|---|---|
| 1 | `feature/project-foundation` | project skeleton, config, logging, tests |
| 2 | `feature/core-domain` | value objects and domain state machines |
| 3 | `feature/database-foundation` | migrations and repositories |
| 4 | `feature/claude-adapter` | Claude schema validation and adapter |
| 5 | `feature/naver-news-adapter` | news ingestion and normalization |
| 6 | `feature/toss-readonly-adapter` | Toss read-only gateway |
| 7 | `feature/risk-engine` | risk limits and checks |
| 8 | `feature/testing-harness` | fixtures, mocks, regression tests |

Do not start live execution branch until the approval pipeline is complete.

## 19. Roadmap Gates

Gate rules:

- no Phase 4 until Phase 2 review is complete or explicitly deferred
- no live broker write code until Phase 6 controls exist
- no small-capital live until Phase 9 checklist passes
- no production candidate until Phase 10 results are reviewed
- no automatic strategy promotion until manual promotion process has proven safe

## 20. Roadmap Maintenance

Update this roadmap when:

- Codex review changes priorities
- API verification changes scope
- development tasks are generated
- a phase completes
- a phase is blocked
- production safety assumptions change
- new major module is added

Roadmap updates should be recorded in `12_CHANGELOG.md`.

## 21. Final Roadmap Statement

The roadmap exists to prevent the project from rushing into live trading.

The correct order is:

```text
document
review
specify
build controls
test
simulate
validate small
expand slowly
```

If a shortcut threatens safety, the roadmap says no.
