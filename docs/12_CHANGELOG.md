# 12 Changelog

Version: 0.1.1  
Status: Active  
Last Updated: 2026-07-28  
Related Docs: 01_Project_Vision.md, 10_Claude_Code_Guide.md, 11_AI_RULES.md, 99_Development_Roadmap.md

## 1. Document Purpose

This document records meaningful changes to AI Investment Operating System.

It covers:

- documentation changes
- architecture decisions
- API assumptions
- safety rule changes
- strategy governance changes
- implementation milestones
- production-impacting behavior changes

The changelog is not a replacement for Git history. It is a human-readable project history that explains what changed and why it matters.

## 2. Changelog Principles

Changes must be recorded when they affect:

- system architecture
- AI behavior
- trading safety
- broker integration
- risk management
- strategy promotion
- database design
- operation and deployment
- development workflow
- production readiness

Minor typo fixes do not need detailed changelog entries unless they correct a safety-relevant statement.

## 3. Versioning Policy

The project uses documentation and architecture versions before code releases.

Recommended version phases:

```text
0.1.x documentation foundation
0.2.x architecture review revisions
0.3.x development specification and task breakdown
0.4.x prototype implementation
0.5.x backtest and paper trading implementation
0.6.x small-capital live preparation
0.7.x small-capital live operation
0.8.x production hardening
0.9.x production candidate
1.0.0 first stable production architecture and implementation
```

Patch versions may be used for small documentation or implementation refinements.

## 4. Change Types

Use these categories:

```text
Added
Changed
Deprecated
Removed
Fixed
Security
Safety
Operations
Open Questions
```

Definitions:

- `Added`: new document, feature, rule, table, adapter, or workflow
- `Changed`: meaningful modification to existing behavior or design
- `Deprecated`: still present but planned for removal
- `Removed`: removed behavior, assumption, or feature
- `Fixed`: correction to an error
- `Security`: secrets, access, privacy, or vulnerability-related changes
- `Safety`: trading, risk, AI boundary, or fail-safe changes
- `Operations`: deployment, monitoring, backup, alerting, or incident changes
- `Open Questions`: unresolved items added or closed

## 5. Required Changelog Entries

Always add a changelog entry for:

- change to AI rules
- change to risk rules
- change to order approval flow
- change to broker adapter behavior
- change to strategy promotion criteria
- change to kill switch behavior
- change to database persistence of production decisions
- change to secret handling
- change to deployment or recovery process
- addition of live trading capability
- enabling any new market or asset type
- production incident or postmortem

## 6. Entry Format

Recommended format:

```markdown
## x.y.z - YYYY-MM-DD

### Added

- Added ...

### Changed

- Changed ...

### Safety

- Safety impact ...

### Open Questions

- Open question ...
```

Every entry should be understandable without reading the code diff.

## 7. Current Release

## 0.1.1 - 2026-07-28

### Added

- Drafted `99_Development_Roadmap.md` with phased roadmap from documentation scaffold through Codex review, development specification, Claude Code parallel implementation, safety controls, adapters, validation environments, operations, small-capital live trading, production hardening, and continuous strategy evolution.

### Changed

- Updated root README and docs index status to reflect the documentation foundation draft.

### Safety

- Added explicit roadmap gates preventing live broker write code before safety controls, small-capital live operation before readiness checklist completion, and production promotion before reviewed live validation evidence.

## 0.1.0 - 2026-07-27

### Added

- Created initial documentation scaffold.
- Added root README, MIT license, and Git ignore rules.
- Added official docs index.
- Added placeholder architecture, trading, AI, API, testing, operation, changelog, and roadmap documents.
- Added reusable documentation templates.
- Drafted `01_Project_Vision.md` with project philosophy, scope, AI role boundaries, strategy evolution vision, Shadow Portfolio vision, success criteria, and development principles.
- Drafted `02_System_Architecture.md` with layered architecture, core components, trading and research pipelines, adapter boundaries, event flows, state models, fail-safe principles, observability, deployment assumptions, and open architecture questions.
- Drafted `03_Domain_Model.md` with bounded contexts, value objects, market and asset models, news and AI analysis models, strategy and portfolio models, risk and order models, research validation models, aggregates, domain services, domain events, invariants, and glossary.
- Drafted `04_Database_Architecture.md` with PostgreSQL recommendation, persistence principles, schema groups, core table definitions, market/news/AI/strategy/portfolio/risk/execution/research/audit tables, indexing, partitioning, retention, backup, migrations, data quality, secret handling, read models, idempotency, and outbox pattern.
- Drafted `05_API_Architecture.md` with official API source references, external API boundaries, Toss Securities/Naver News/Claude adapter contracts, capability registry, normalized request and response models, error taxonomy, retry policy, rate limits, secret handling, logging, raw payload storage, adapter tests, failure behavior matrix, and open API questions.
- Drafted `06_AI_Architecture.md` with AI role boundaries, Claude usage rules, prompt template versioning, structured output schemas, news event assessment, strategy research, AI Health Check, continuous learning, Strategy Diversity Engine, Shadow Portfolio, promotion review support, overfitting control, cost management, privacy, failure handling, evaluation standards, model versioning, and human review policy.
- Drafted `07_Trading_System.md` with trading lifecycle, operating modes, market data processing, asset universe filtering, engine responsibilities, signal-to-order flow, Risk Engine, Money Management Engine, Order Approval Engine, broker capability checks, execution, Toss adapter boundary, order state lifecycle, reconciliation, duplicate order prevention, kill switch, position/cash management, order type policy, schedule, alerts, audit requirements, fail-safe behavior, small-capital live rules, and production readiness checklist.
- Drafted `08_Testing_Validation.md` with testing philosophy, validation ladder, unit/integration/contract/E2E tests, safety-critical cases, data quality checks, API validation, backtesting, walk-forward validation, Shadow Portfolio, Paper Trading, small-capital live validation, production promotion criteria, regression tests, test data strategy, AI evaluation, performance/security/disaster recovery testing, module acceptance criteria, CI requirements, manual gates, and production readiness checklist.
- Drafted `09_Operation_Deployment.md` with cloud runtime assumptions, environment strategy, deployment services, scheduler and worker policy, CI/CD, release strategy, monitoring, structured logging, exception-focused alerting, dashboard operations, secrets management, backup, disaster recovery, incident response, operational runbooks, startup and shutdown checklists, configuration management, access control, cost monitoring, operational metrics, and open operation questions.
- Drafted `10_Claude_Code_Guide.md` with required reading, development workflow, worktree strategy, branch naming, module ownership, task format, implementation and testing standards, safety rules, documentation and PR standards, review checklist, merge strategy, initial parallel development plan, task breakdown, commit standards, uncertainty handling, forbidden shortcuts, and completion definition.
- Drafted `11_AI_RULES.md` as the non-negotiable AI safety rulebook covering rule priority, trading rules, AI analysis rules, strategy rules, broker/API rules, data and secret rules, operation rules, development rules for AI agents, and enforcement behavior.
- Expanded `12_CHANGELOG.md` into a reusable project changelog with versioning policy, change types, required entries, and entry format.

### Safety

- Established that AI must not directly place broker orders.
- Established that news alone must never trigger orders.
- Established that every live order must pass Risk Engine, Money Management Engine, and Order Approval Engine.
- Established that unverified Toss Securities capabilities must remain blocked.
- Established that unknown broker order state must block dependent trading until reconciliation.

### Operations

- Established exception-focused notification policy.
- Established cloud or always-on runtime as the target for live operation.
- Established kill switch, backup, recovery, and incident response requirements.

### Open Questions

- Toss Securities API detailed capability verification remains open.
- Naver News API adequacy for U.S. stock coverage remains open.
- Claude model selection by analysis type remains open.
- Production cloud provider, queue system, monitoring stack, and database host remain open.
- Historical market data provider for backtesting remains open.

## 8. Future Changelog Responsibilities

When implementation begins, every pull request that changes safety-critical behavior should update this document.

Safety-critical behavior includes:

- order execution
- risk checks
- money checks
- order approval
- broker adapter behavior
- AI schema validation
- strategy promotion
- kill switch behavior
- reconciliation
- secrets handling
- production deployment

## 9. Final Changelog Statement

The changelog is part of the safety system.

It helps future developers and AI agents understand not only what exists, but how the system's rules evolved.

If a change affects capital, safety, AI authority, or production operation, it belongs here.
