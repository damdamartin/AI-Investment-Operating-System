# 12 Changelog

Version: 0.4.11
Status: Active
Last Updated: 2026-07-28
Related Docs: 01_Project_Vision.md, 10_Claude_Code_Guide.md, 11_AI_RULES.md, 13_Compliance_and_Legal_Review.md, 99_Development_Roadmap.md

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

## 0.4.11 - 2026-07-28

### Added

- Added baseline NewsEventEngine service.
- Added event importance, sentiment, and confidence score outputs.
- Added refusal paths for stale news events, invalid timestamps, missing AI analysis, untraceable AI analysis, and low AI confidence.
- Added contradiction penalties and review-required handling.
- Added tests for confidence thresholds, contradiction behavior, review-required analysis, stale events, and source analysis traceability.

### Changed

- Marked Task-026 as complete.
- Updated repository and package version to `0.4.11`.
- Increased Vitest timeout to reduce false failures from the existing PGlite migration smoke tests.

### Safety

- NewsEventEngine produces analysis scores only and does not create signals, orders, or broker commands.
- Review-required or contradictory analysis cannot become an automated trade candidate.
- Event scores reference source event and AI analysis IDs for auditability.

### Verification

- `npm run check` passed with 108 tests.

## 0.4.10 - 2026-07-28

### Added

- Added FundamentalEngine interface and placeholder implementation.
- Added FundamentalSnapshot and FundamentalMetric input models for future provider integration.
- Added versioned fundamental score output for growth, quality, and balance sheet analysis.
- Added refusal path for missing, incomplete, or invalid fundamental data.
- Added tests for complete data, partial data, required-complete-data refusal, missing snapshots, and invalid metrics.

### Changed

- Marked Task-025 as complete.
- Updated repository and package version to `0.4.10`.

### Safety

- FundamentalEngine does not invent missing financial values.
- Missing data lowers confidence when allowed and blocks scoring when complete data is required.
- FundamentalEngine produces analysis only and does not create orders.

### Verification

- `npm run check` passed with 103 tests.
- The first check run hit an existing migration test timeout, and the immediate rerun passed.

## 0.4.9 - 2026-07-28

### Added

- Added baseline MarketEngine service.
- Added deterministic trend, volume, and volatility placeholder scores.
- Added MarketEngine refusal path for stale, missing, suspect, or empty market data.
- Added score output with input references, scoring version, generated timestamp, and analysis-only safety marker.
- Added tests for scoring, stale data refusal, missing data refusal, empty input refusal, and signal/order separation.

### Changed

- Marked Task-024 as complete.
- Updated repository and package version to `0.4.9`.

### Safety

- MarketEngine produces analysis scores only and does not create Signal, OrderIntent, or broker commands.
- Stale or missing market data prevents score output.
- Score output keeps source input references for later audit and traceability.

### Verification

- `npm run check` passed with 98 tests.

## 0.4.8 - 2026-07-28

### Added

- Added AIAnalysisRecord for schema-valid Claude analysis outputs.
- Added AIAnalysisValidationFailureRecord for rejected Claude outputs.
- Added AIAnalysisRepository boundary and in-memory implementation.
- Added builders that preserve prompt template id, prompt template version, model, schema version, evidence, contradictions, risks, raw payload references, and input references.
- Added tests for valid persistence records, invalid output rejection, validation failure records, required input traceability, and separated repository paths.

### Changed

- Marked Task-023 as complete.
- Updated repository and package version to `0.4.8`.

### Safety

- Invalid Claude output cannot be stored as valid AI analysis.
- Valid analysis records are marked advisory-only.
- Validation failure records are stored separately from valid analyses.
- AI analysis records require traceable input references before they can be persisted.

### Verification

- `npm run check` passed with 94 tests.

## 0.4.7 - 2026-07-28

### Added

- Added NewsEventCandidate normalization service.
- Added duplicate article grouping by duplicate key.
- Added company reference extraction with resolved, ambiguous, and unresolved states.
- Added keyword reference extraction for news event metadata.
- Added stale news and invalid timestamp detection.
- Added tests for duplicate grouping, stale news, ambiguous symbol handling, invalid timestamps, and signal/order separation.

### Changed

- Marked Task-022 as complete.
- Updated repository and package version to `0.4.7`.

### Safety

- NewsEventCandidate is explicitly marked as candidate-only and does not include trading direction, signal, order, or broker command behavior.
- Ambiguous company references remain ambiguous instead of being guessed.
- Stale or invalid timestamp news can be flagged before later AI or strategy processing.

### Verification

- `npm run check` passed with 89 tests.

## 0.4.6 - 2026-07-28

### Added

- Added MarketDataSnapshot read model for normalized market data ingestion.
- Added freshness assessment for fresh, stale, missing, and suspect market data.
- Added persistence-ready MarketDataSnapshotRecord and repository boundary.
- Added tests for fresh data, stale data, missing data, suspect data, and source traceability.

### Changed

- Marked Task-021 as complete.
- Updated repository and package version to `0.4.6`.

### Safety

- Missing, stale, suspect, unknown-source, zero-price, or zero-volume market data blocks downstream trading decisions.
- Market data remains a read-side model and does not create signals, orders, or broker commands.

### Verification

- `npm run check` passed with 84 tests.

## 0.4.5 - 2026-07-28

### Added

- Added NaverNewsAdapter with fetch injection, HTML cleanup, normalized article output, duplicate key generation, and safe adapter errors.
- Added Claude analysis schema validator.
- Added ValidatingClaudeAdapter that rejects malformed Claude outputs before they can influence downstream logic.
- Added fixture tests for Naver article normalization, malformed news items, API errors, duplicate keys, Claude schema validation, forbidden broker command keys, and Claude adapter failure behavior.

### Changed

- Marked Task-015 and Task-016 as complete.
- Updated repository and package version to `0.4.5`.

### Safety

- News normalization creates articles only, not signals or orders.
- Malformed news items are skipped safely.
- Claude output containing broker command keys is rejected.
- Invalid Claude schema output returns a non-retryable validation error and cannot become valid analysis.

### Verification

- `npm run check` passed with 79 tests.

## 0.4.4 - 2026-07-28

### Added

- Added TossCapabilityRegistry for read-only capability discovery results.
- Added Compliance Gate service for live-trading review requirements and live-blocking open questions.
- Added AuditRecord, AuditLogService, and InMemoryAuditLogSink.
- Added application tests for Toss capability states, compliance gate outcomes, and audit redaction.

### Changed

- Marked Task-014, Task-017, and Task-018 as complete.
- Updated repository and package version to `0.4.4`.

### Safety

- Unknown Toss capabilities default to `UNVERIFIED`.
- Unsupported, partial, or unverified capabilities produce blocking reasons.
- Live trading compliance defaults to blocked when reviews are missing.
- Critical and high live-blocking open questions block compliance approval.
- Audit metadata is redacted before storage.

### Verification

- `npm run check` passed with 68 tests.

## 0.4.3 - 2026-07-28

### Added

- Added SQL migration framework and migration loader.
- Added core schema migration for assets, broker mappings, portfolios, broker accounts, strategies, signals, risk limits, and audit records.
- Added historical data schema migration for historical bars, corporate actions, cost model versions, and market calendars.
- Added outbox event schema migration with idempotency key support and retry state fields.
- Added adapter interface contracts for Toss read-only/write-separated adapters, Naver News adapter, Claude AI adapter, normalized adapter results, and adapter errors.
- Added migration smoke tests using a clean local Postgres-compatible test database.
- Added `npm run test:migrations`.

### Changed

- Marked Task-009, Task-010, Task-011, Task-012, and Task-013 as complete.
- Updated repository and package version to `0.4.3`.

### Safety

- Broker account schema defaults to `UNVERIFIED` and `live_trading_enabled = false`.
- Portfolio-broker account link schema defaults to `DISABLED`.
- Outbox events require unique idempotency keys.
- Toss write interface is separated from Toss read-only interface and has no usable command payload yet.
- Claude adapter contract returns advisory analysis only, not executable broker commands.

### Verification

- `npm run check` passed with 57 tests.

## 0.4.2 - 2026-07-28

### Added

- Added RiskLimit, RiskCheck, and KillSwitchState domain models.
- Added CashBalance and MoneyCheck domain models with cash reservation validation.
- Added safety regression test suite under `tests/safety`.
- Added tests proving failed risk checks and failed money checks cannot create approved OrderApproval records.

### Changed

- OrderApproval now requires RiskCheck and MoneyCheck references.
- Approved OrderApproval now requires both RiskCheck and MoneyCheck to allow approval.
- Marked Task-008, Task-019, and Task-020 as complete.
- Updated repository and package version to `0.4.2`.

### Safety

- Failed or blocked risk checks prevent order approval.
- Failed or blocked money checks prevent order approval.
- Active kill switch state is represented as blocking orders.
- Cash reservation cannot use unsettled or unavailable cash.
- Safety regression tests now cover signal/order separation, risk failure, money failure, and unverified broker account live-write blocking.

### Verification

- `npm run check` passed with 48 tests.

## 0.4.1 - 2026-07-28

### Added

- Added internal asset, broker asset mapping, and market session domain models.
- Added first-class BrokerAccount and PortfolioBrokerAccountLink domain models.
- Added strategy, strategy version, engine score set, and signal domain models.
- Added order intent, order approval, broker order, and fill state models.
- Added domain tests for asset tradability, broker account permissions, strategy transitions, signal/order separation, and order state rules.

### Changed

- Marked Task-004, Task-005, Task-006, and Task-007 as complete.
- Updated repository and package version to `0.4.1`.

### Safety

- Unknown or unverified assets default to not tradable.
- Broker accounts default to `UNVERIFIED` and live-write blocked.
- Portfolio-account links default to disabled.
- Signal remains separate from OrderIntent.
- BrokerOrder cannot be created from a rejected approval.
- Unknown broker order state is represented as blocking dependent trading.

### Verification

- `npm run check` passed with 35 tests.

## 0.4.0 - 2026-07-28

### Added

- Added TypeScript project foundation with strict type checking and Vitest.
- Added local development guide in `DEVELOPMENT.md`.
- Added CI workflow for type checks and tests.
- Added safe runtime configuration loader with live trading disabled by default.
- Added secret redaction helpers for text and objects.
- Added core value objects for currency, money, quantity, price, percent, market, asset type, and time range.
- Added tests for configuration, redaction, and core value objects.

### Changed

- Updated repository status to `Safe Foundation Implementation Started`.
- Marked Task-001, Task-002, and Task-003 as complete.
- Marked Task-020 as partial because the safety regression suite remains pending until Task-019.

### Safety

- No live broker write code was added.
- `LIVE_TRADING_ENABLED=true` is rejected outside production.
- Production config requires Toss, Naver, and Claude secret names to be present when secret enforcement is enabled.
- Secret-like object fields are redacted before safe diagnostic use.

### Verification

- `npm run check` passed.

## 0.3.3 - 2026-07-28

### Added

- Added `docs/tasks/Claude_Worktree_Orchestration.md` with recommended Claude Code parallel sessions, branch names, task groupings, merge order, and blocked live-trading work.
- Added `docs/tasks/Phase_4_Readiness_Review.md` with implementation readiness status, safe implementation scope, blocked scope, open question impact, and recommended implementation waves.

### Changed

- Updated repository status to `Ready for Safe Foundation Implementation`.
- Updated task index to reference orchestration and readiness planning documents.

### Safety

- Confirmed the project is ready only for safe foundation implementation, not live trading.
- Reconfirmed that real Toss order creation, real Toss cancellation, automatic production strategy promotion, and production capital expansion remain blocked.

## 0.3.2 - 2026-07-28

### Added

- Added Phase 3 operations and controlled execution implementation tasks `Task-041` through `Task-060`.
- Added task specifications for outbox workers, broker write command guard, order execution simulation, order cancel simulation, fill processing, reconciliation workflow, kill switch control, dashboard sensitive control gate, strategy promotion dashboard workflow, config versioning, scheduler and job runner, data quality monitoring, API usage and cost monitoring, backup and restore runbook, incident runbooks, deployment environment skeleton, observability metrics, security access control, Claude worktree orchestration, and Phase 4 readiness review.

### Changed

- Updated `docs/tasks/README.md` to include the Phase 3 task index.
- Updated repository documentation version to `0.3.2`.

### Safety

- Added a dedicated Broker Write Command Guard task that defaults to blocking all broker write commands unless every live-trading gate passes.
- Kept real Toss broker write implementation out of this batch.
- Required simulation, cancellation, reconciliation, dashboard, scheduler, and deployment tasks to preserve live-trading disabled defaults.

## 0.3.1 - 2026-07-28

### Added

- Added Phase 2 engine and validation implementation tasks `Task-021` through `Task-040`.
- Added task specifications for market data ingestion, news event normalization, AI analysis persistence, market/fundamental/news engines, strategy scoring, risk engine, money management engine, order approval engine, backtest engine, walk-forward validation, Shadow Portfolio, Paper Trading, Strategy Diversity Engine, strategy promotion workflow, AI Health Check, read-only reconciliation, read-only dashboard status, and operational alerting.

### Changed

- Updated `docs/tasks/README.md` to include the Phase 2 task index.
- Updated repository documentation version to `0.3.1`.

### Safety

- Kept broker execution write tasks out of this batch.
- Required Order Approval Engine work to depend on risk, money, broker account, compliance, and capability checks.
- Required Shadow Portfolio, Paper Trading, reconciliation, and dashboard tasks to avoid live Toss write methods.

## 0.3.0 - 2026-07-28

### Added

- Added `docs/tasks/README.md` as the implementation task index.
- Added initial Phase 1 foundation implementation tasks `Task-001` through `Task-020`.
- Added task specifications for project structure, runtime config and secrets, core value objects, market and asset model, broker account model, strategy and signal model, order state machines, risk and money model, database migrations, core schema, historical data schema, outbox event schema, adapter contracts, read-only Toss capability discovery, Naver News adapter, Claude schema validation, compliance gate service, audit log service, safety regression test harness, and CI baseline.

### Changed

- Updated the roadmap Phase 3 status to `In progress`.
- Updated the docs index to point to the implementation task folder.

### Safety

- Kept live broker write tasks out of the initial task batch.
- Marked Toss work as read-only capability discovery only.
- Required safety regression tests before trading execution implementation.

## 0.2.0 - 2026-07-28

### Added

- Added `13_Compliance_and_Legal_Review.md` as the formal gate for broker terms, compliance, data licensing, tax, AI provider, personal-use, and live trading readiness review.
- Added `open_questions.md` to track unresolved architecture, API, data, and implementation questions before task generation.
- Added first-class `BrokerAccount` and `PortfolioBrokerAccountLink` concepts to the domain model.
- Added database table candidates for broker accounts, portfolio-account links, historical price bars, corporate actions, cost model versions, and outbox events.
- Added default strategy promotion thresholds for backtest, walk-forward validation, Shadow Portfolio, Paper Trading, small-capital live validation, cost models, corporate action handling, and account permission checks.
- Added minimum dashboard security requirements for authentication, sensitive action authorization, re-authentication, audit logging, masked broker identifiers, and fail-closed behavior.

### Changed

- Updated root README, docs index, project vision, system architecture, domain model, database architecture, trading system, testing validation, operation deployment, roadmap, and changelog documents to the 0.2.x architecture review revision set.
- Updated Phase 3 roadmap status from blocked to ready after 0.2.x revision acceptance.

### Safety

- Blocked live broker write operations until compliance, broker terms, account permission, data licensing, tax/fee/currency assumptions, and strategy promotion gates are satisfied.
- Required production and small-capital live orders to resolve to exactly one verified Toss Securities BrokerAccount through an active portfolio-account link.
- Required historical strategy validation to account for corporate actions and versioned cost assumptions.
- Required outbox semantics for production-critical external side effects where practical.

### Open Questions

- Created central open question records for Toss automated trading permission, account permission model, broker identifiers, ETF and fractional support, historical data provider, corporate actions, tax and fee sources, strategy promotion thresholds, dashboard authentication, and queue/outbox implementation.

## 0.1.1 - 2026-07-28

### Added

- Drafted `99_Development_Roadmap.md` with phased roadmap from documentation scaffold through Codex review, development specification, Claude Code parallel implementation, safety controls, adapters, validation environments, operations, small-capital live trading, production hardening, and continuous strategy evolution.
- Added `docs/reviews/Codex_Architecture_Review_Prompt.md` for Phase 2 architecture review.
- Added `docs/reviews/Architecture_Review_Checklist.md` for safety, broker execution, data, AI, strategy validation, operations, security, Claude Code readiness, and API verification review.
- Added `docs/reviews/Codex_Architecture_Review_2026-07-28.md` with Phase 2 architecture review findings.

### Changed

- Updated root README and docs index status to reflect the documentation foundation draft.
- Updated docs index to reference the reviews folder.
- Updated roadmap to mark Phase 2 as completed with required revisions and Phase 3 as blocked until Phase 2 revisions are complete.

### Safety

- Added explicit roadmap gates preventing live broker write code before safety controls, small-capital live operation before readiness checklist completion, and production promotion before reviewed live validation evidence.
- Identified required safety revisions before task generation: compliance gate, BrokerAccount model, historical data and corporate actions, cost/tax/fee model ownership, strategy promotion thresholds, dashboard control security, outbox semantics, and central open questions tracking.

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
