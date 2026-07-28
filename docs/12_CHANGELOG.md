# 12 Changelog

Version: 0.5.3
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

## 0.5.3 - 2026-07-28

### Added

- Added `TossReadOnlyCredentialReadinessService` for safe local readiness checks before read-only Toss API calls.
- Added a Toss read-only verification checklist for local `.env` setup and allowed/blocked Phase 5 calls.
- Added tests for complete read-only config, missing fields, placeholder rejection, and live-write denial.

### Safety

- Readiness checks never return secret values.
- Readiness checks never approve live broker write operations.
- Phase 5 setup continues to require `LIVE_TRADING_ENABLED=false` and `TOSS_READ_ONLY_MODE=true`.

## 0.5.2 - 2026-07-28

### Added

- Added a Toss read-only evidence manifest model and validator.
- Added an evidence manifest template for sanitized Phase 5 evidence summaries.
- Added tests for sanitized manifest acceptance, unsanitized evidence rejection, credential rejection, live write evidence rejection, and open-question mapping.

### Safety

- Evidence manifests never enable live broker writes.
- Every manifest evidence item must map to an open question and remain sanitized.

## 0.5.1 - 2026-07-28

### Added

- Added `TossReadOnlyEvidenceRecorder` for creating sanitized read-only Toss evidence records.
- Added tests for sanitized records, sensitive-key redaction, known-secret redaction, account identifier detection, and live write command-shape detection.
- Expanded Phase 5 documentation with evidence recording rules.

### Safety

- Raw Toss API responses, request headers, access tokens, account numbers, and client secrets must not be committed as evidence.
- Evidence containing live write command shapes is flagged before it can be used for readiness review.

## 0.5.0 - 2026-07-28

### Added

- Started Phase 5 read-only evidence work.
- Added `TossReadOnlyEvidencePlan` for review-only Toss API evidence readiness.
- Added tests for missing read-only evidence, sanitized evidence acceptance, credential rejection, live write rejection, and stale evidence warnings.
- Added `TOSS_READ_ONLY_MODE` and `TOSS_API_BASE_URL` configuration fields.
- Added Phase 5 read-only evidence plan documentation.

### Safety

- `TOSS_READ_ONLY_MODE` must remain `true` until live trading gates are approved.
- Toss API evidence cannot enable live broker write operations.
- Evidence containing credentials, unsanitized payloads, or live write operations is rejected by the review model.

## 0.4.45 - 2026-07-28

### Added

- Added a review-only Phase 4 readiness model for implementation status, safety rule coverage, open question impact, and next-phase gating.
- Added tests confirming read-only next-phase approval, live broker write blocking, open question impact mapping, missing safety rule deferral, and incomplete-task deferral.
- Updated the Phase 4 readiness review document to reflect safe foundation completion and the next read-only evidence phase.

### Safety

- Reconfirmed that Phase 4 completion does not authorize live Toss order creation, live Toss order cancellation, production capital use, or automatic production strategy promotion.
- Mapped unresolved high-priority open questions to live-trading blockers.

## 0.4.44 - 2026-07-28

### Added

- Added a review-only Claude worktree orchestration validation service.
- Added tests for duplicate branch detection, duplicate worktree detection, duplicate task ownership, overlapping owned paths, required safety document checks, sensitive path blocking, and merge-readiness evaluation.
- Expanded the Claude worktree orchestration guide with pre-session review rules and merge readiness rules.

### Safety

- Confirmed every Claude Code session must read `docs/10_Claude_Code_Guide.md` and `docs/11_AI_RULES.md` before implementation.
- Blocked `.env`, secret, and live production credential paths from worktree ownership plans.
- Reconfirmed that live broker write work remains blocked during parallel Claude Code development.

Every entry should be understandable without reading the code diff.

## 7. Current Release

## 0.4.43 - 2026-07-28

### Added

- Added AccessControlService.
- Added actor, role, and permission model.
- Added roles for owner, operator, auditor, viewer, and system.
- Added sensitive production surface authorization checks.
- Added account identifier masking helper.
- Added tests for read-only/sensitive separation, production access, fail-closed actors, account masking, and command-surface separation.

### Changed

- Marked Task-058 as complete.
- Updated repository and package version to `0.4.43`.

### Safety

- Unknown, missing, or unauthenticated actors fail closed.
- Production control surfaces require explicit production access.
- Account identifiers are masked before display.

### Verification

- Targeted Security Access Control tests passed with 5 tests.

## 0.4.42 - 2026-07-28

### Added

- Added ObservabilityMetricsService.
- Added baseline metric definitions for system, scheduler, API, trading safety, order, and validation categories.
- Added safe metric event emission with category, kind, value, labels, and payload.
- Added dashboard snapshot aggregation by category.
- Added tests for baseline coverage, metric emission, redaction, dashboard snapshots, and command-surface separation.

### Changed

- Marked Task-057 as complete.
- Updated repository and package version to `0.4.42`.

### Safety

- Metric labels and payloads are redacted before emission.
- Observability events do not expose account or credential data.
- Metrics do not expose broker order action commands.

### Verification

- Targeted Observability Metrics tests passed with 5 tests.

## 0.4.41 - 2026-07-28

### Added

- Added deployment environment skeleton.
- Added local, test, staging, and production environment example files.
- Added DeploymentEnvironmentSkeletonService.
- Added validation for required environments, disabled live trading defaults, test credential behavior, and secret reference safety.
- Added tests for deployment skeleton validation.

### Changed

- Marked Task-056 as complete.
- Updated repository and package version to `0.4.41`.

### Safety

- Live trading remains disabled in all generated environments.
- Test environment does not require real API credentials.
- Secret values are represented as placeholders or secret references only.

### Verification

- Targeted Deployment Environment Skeleton tests passed with 5 tests.

## 0.4.40 - 2026-07-28

### Added

- Added Incident Runbooks document.
- Added runbooks for broker API failure, unknown order state, reconciliation mismatch, Claude API failure, Naver API failure, and kill switch activation.
- Added IncidentRunbookReview.
- Added tests for required runbook sections, explicit restrictive trading safety state, no-trade preference, and required scenario coverage.

### Changed

- Marked Task-055 as complete.
- Updated repository and package version to `0.4.40`.

### Safety

- Incident runbooks prefer no trade over uncertain trade.
- Runbooks make trading safety state explicit for each scenario.
- Unknown order and reconciliation incidents require state verification before resume.

### Verification

- Targeted Incident Runbook Review tests passed with 5 tests.

## 0.4.39 - 2026-07-28

### Added

- Added Backup and Restore runbook.
- Added RestoreSafetyGate.
- Added post-restore checklist for backup manifest, schema version, config versions, audit continuity, separate secret handling, reconciliation, data quality, kill switch availability, and operator approval.
- Added tests for restore readiness, incomplete verification, separate secret handling, post-restore reconciliation/data quality blocking, and command-surface separation.

### Changed

- Marked Task-054 as complete.
- Updated repository and package version to `0.4.39`.

### Safety

- Trading remains disabled after restore until all restore safety checks pass.
- Secrets are documented as separate from normal data backup.
- Restore safety gate does not create corrective trading commands.

### Verification

- Targeted Restore Safety Gate tests passed with 5 tests.

## 0.4.38 - 2026-07-28

### Added

- Added ApiUsageMonitor.
- Added safe API usage record model for Toss Securities, Naver News, and Claude.
- Added provider and time-period usage aggregation.
- Added success, failure, retry, latency, and rate limit counters.
- Added Claude input token, output token, and estimated cost aggregation.
- Added tests for safe logging, provider aggregation, rate limit observability, Claude cost aggregation, and period filtering.

### Changed

- Marked Task-053 as complete.
- Updated repository and package version to `0.4.38`.

### Safety

- API usage metadata is redacted before storage.
- Usage logs and summaries do not expose credentials.
- Rate limit events are observable without triggering automatic trading behavior.

### Verification

- Targeted API Usage and Cost Monitor tests passed with 5 tests.

## 0.4.37 - 2026-07-28

### Added

- Added DataQualityMonitor.
- Added data quality statuses for `GREEN`, `YELLOW`, `RED`, and `BLOCKED`.
- Added market data freshness and missing data checks.
- Added news freshness and missing-count checks.
- Added AI validation failure-rate checks.
- Added alert hooks for critical stale market data and repeated Claude schema validation failures.
- Added tests for green status, stale market data, missing market data, stale news, and high AI validation failure rate.

### Changed

- Marked Task-052 as complete.
- Updated repository and package version to `0.4.37`.

### Safety

- Suspect or missing market data blocks trading-dependent flows.
- Data quality output is dashboard-ready and does not generate trading signals.
- Critical data quality findings are exposed through operational alert hooks.

### Verification

- Targeted Data Quality Monitor tests passed with 5 tests.

## 0.4.36 - 2026-07-28

### Added

- Added SchedulerJobRunner.
- Added scheduled job definition and run record models.
- Added run states for `PENDING`, `RUNNING`, `SUCCEEDED`, `FAILED`, and `SKIPPED`.
- Added singleton job locking behavior.
- Added safe error summaries for failed jobs.
- Added trading job safety checks for kill switch, reconciliation, stale data, and broker write gates.
- Added tests for job start/completion, singleton overlap blocking, failure summaries, trading safety blocks, and required safety gate state.

### Changed

- Marked Task-051 as complete.
- Updated repository and package version to `0.4.36`.

### Safety

- Singleton jobs cannot overlap.
- Failed jobs store redacted safe error summaries.
- Trading-related jobs do not run unless safety state explicitly permits them.

### Verification

- Targeted Scheduler and Job Runner tests passed with 5 tests.

## 0.4.35 - 2026-07-28

### Added

- Added ConfigVersioningService.
- Added config categories for risk, strategy, market, and runtime settings.
- Added config version states for `DRAFT`, `APPROVED`, `ACTIVE`, and `RETIRED`.
- Added creation, approval, activation, and active-version lookup workflows.
- Added audit metadata for config creation, approval, and activation.
- Added tests for immutable versions, approval-before-activation, active version replacement, historical immutability, and required change metadata.

### Changed

- Marked Task-050 as complete.
- Updated repository and package version to `0.4.35`.

### Safety

- Active config versions are traceable.
- Approved historical versions are not mutated in place.
- Production-impacting config changes require actor and reason metadata.

### Verification

- Targeted Config Versioning Service tests passed with 5 tests.

## 0.4.34 - 2026-07-28

### Added

- Added StrategyPromotionDashboardWorkflow.
- Added read-only promotion evidence view for dashboard review.
- Added dashboard promotion decision boundary integrated with DashboardSensitiveControlGate.
- Added audit record output for dashboard promotion decisions.
- Added tests for evidence visibility, sensitive control gating, missing evidence blocking, accepted promotion, and command-surface separation.

### Changed

- Marked Task-049 as complete.
- Updated repository and package version to `0.4.34`.

### Safety

- Dashboard promotion requests cannot bypass StrategyPromotionWorkflow.
- Missing promotion evidence blocks the dashboard decision.
- Dashboard promotion decisions do not activate production or allocate capital directly.

### Verification

- Targeted Strategy Promotion Dashboard Workflow tests passed with 5 tests.

## 0.4.33 - 2026-07-28

### Added

- Added DashboardSensitiveControlGate.
- Added dashboard action classification for read-only and critical controls.
- Added placeholder dashboard actor permission model.
- Added step-up confirmation and reason requirements for critical dashboard actions.
- Added audit record output for allowed and blocked dashboard control decisions.
- Added tests for read-only actions, permission failures, confirmed critical actions, unknown auth state, and command-surface separation.

### Changed

- Marked Task-048 as complete.
- Updated repository and package version to `0.4.33`.

### Safety

- Sensitive dashboard actions fail closed when auth state is missing or unknown.
- Critical actions require elevated permission, reason, and confirmation.
- Dashboard gate decisions do not execute state mutation or broker write commands directly.

### Verification

- Targeted Dashboard Sensitive Control Gate tests passed with 5 tests.

## 0.4.32 - 2026-07-28

### Added

- Added KillSwitchControlService.
- Added kill switch control states for `INACTIVE`, `ACTIVE`, and `UNKNOWN`.
- Added activation and deactivation workflows with actor, reason, and timestamp metadata.
- Added trading gate evaluation for active, inactive, missing, and unknown kill switch state.
- Added operational alert hook for kill switch activation.
- Added tests for activation, deactivation, active-state blocking, fail-closed unknown state, and broker write guard integration.

### Changed

- Marked Task-047 as complete.
- Updated repository and package version to `0.4.32`.

### Safety

- Missing kill switch state fails closed.
- Unknown kill switch state fails closed.
- Deactivation requires explicit action metadata.
- Active kill switch state maps into BrokerWriteCommandGuard and blocks broker write decisions.

### Verification

- Targeted Kill Switch Control Service tests passed with 5 tests.

## 0.4.31 - 2026-07-28

### Added

- Added ReconciliationWorkflowService.
- Added reconciliation severity classification for clean, mismatch, stale, unknown, and critical missing-record states.
- Added trading safety states for `CLEAR`, `WATCH`, and `BLOCKED`.
- Added operational alert hooks for severe reconciliation mismatch and stale reconciliation reports.
- Added audit record output for reconciliation workflow evaluations.
- Added tests for match, severe mismatch, unknown broker state, stale report, and critical missing-record cases.

### Changed

- Marked Task-046 as complete.
- Updated repository and package version to `0.4.31`.

### Safety

- Unknown broker state blocks dependent trading.
- Stale reconciliation reports block dependent trading.
- Reconciliation mismatch handling does not create corrective broker orders.
- Workflow output explicitly sets `correctiveTradingAllowed` to `false`.

### Verification

- Targeted Reconciliation Workflow tests passed with 5 tests.

## 0.4.30 - 2026-07-28

### Added

- Added FillProcessingService for simulated and future reconciled fill application.
- Added internal ledger state models for cash balances, positions, applied fill IDs, realized PnL, and unrealized PnL placeholders.
- Added buy fill processing with weighted average price updates and reserved cash release.
- Added sell fill processing with position reduction, realized PnL updates, and cash proceeds.
- Added tests for buy fills, partial fills, sell fills, idempotency, and over-sell blocking.

### Changed

- Marked Task-045 as complete.
- Updated repository and package version to `0.4.30`.

### Safety

- Duplicate fill IDs do not double-update positions or cash.
- Sell fills that exceed the internal position quantity are blocked.
- Fill processing remains an internal ledger operation and does not expose live broker write commands.

### Verification

- Targeted Fill Processing tests passed with 5 tests.

## 0.4.29 - 2026-07-28

### Added

- Added OrderCancelSimulationService.
- Added simulated cancel request, response, and result models.
- Added accepted, rejected, too-late, and unknown simulated cancel states.
- Added audit record hooks for simulated cancel results.
- Added tests for cancellable states, non-cancellable states, cancel lifecycle states, and auditability.

### Changed

- Marked Task-044 as complete.
- Updated repository and package version to `0.4.29`.

### Safety

- Filled, rejected, and unknown execution records cannot create cancel requests.
- Unknown cancel state blocks dependent assumptions.
- Simulated cancel results do not expose live Toss cancel commands.

### Verification

- Targeted Order Cancel Simulation tests passed with 4 tests.

## 0.4.28 - 2026-07-28

### Added

- Added OrderExecutionSimulationService.
- Added simulated execution command model derived from approved `OrderApproval` records.
- Added simulated broker response and auditable execution record models.
- Added accepted, rejected, partially filled, filled, and unknown simulated execution states.
- Added simulated outbox event creation and fake execution handlers.
- Added tests for approved command creation, rejected approval refusal, lifecycle responses, outbox processing, and unknown broker state dead-letter handling.

### Changed

- Marked Task-043 as complete.
- Updated repository and package version to `0.4.28`.

### Safety

- Rejected approvals cannot enter simulated execution.
- Unknown simulated broker state blocks dependent actions and is dead-lettered through Outbox handling.
- Simulation code does not call Toss write methods.

### Verification

- Targeted Order Execution Simulation tests passed with 5 tests.

## 0.4.27 - 2026-07-28

### Added

- Added BrokerWriteCommandGuard.
- Added explicit broker write allowed/blocked decision model.
- Added guard checks for order approval, broker account permission, portfolio link, compliance, Toss capability, environment policy, kill switch state, reconciliation state, unresolved open questions, and forbidden AI broker command shapes.
- Added tests for default blocking, fully passing gates, individual blocking conditions, open-question blocks, portfolio link blocks, and Claude-shaped command bypass attempts.

### Changed

- Marked Task-042 as complete.
- Updated repository and package version to `0.4.27`.

### Safety

- Default state blocks all broker write commands.
- Unknown or missing gates block broker writes.
- Guard decisions do not execute broker commands.
- Claude output cannot bypass the broker write guard.

### Verification

- Targeted Broker Write Command Guard tests passed with 6 tests.

## 0.4.26 - 2026-07-28

### Added

- Added OutboxWorkerService.
- Added outbox event model with pending, processing, processed, failed, and dead-letter states.
- Added worker lock metadata, attempt count updates, retry scheduling, success transition, failure transition, and dead-letter transition.
- Added idempotency key preservation in worker state transitions.
- Added tests for successful processing, active worker lock skipping, retry failure, retry exhaustion, unknown broker state dead-lettering, and idempotency key handling.

### Changed

- Marked Task-041 as complete.
- Updated repository and package version to `0.4.26`.

### Safety

- Unknown broker state is dead-lettered rather than blindly retried.
- Non-retryable error codes can be configured as dead-letter conditions.
- Outbox worker output is state-transition-only and does not expose broker write helpers.

### Verification

- Targeted Outbox Worker tests passed with 6 tests.

## 0.4.25 - 2026-07-28

### Added

- Added OperationalAlertingService.
- Added alert event model with category, severity, immediate notification flag, and redacted payload.
- Added classification for API failures, broker outages, order failures, unknown broker state, reconciliation mismatches, duplicate order risk, kill switch activation, risk limit breaches, stale market data, AI Health Check red/blocked, Claude schema failures, backup failures, and worker outages.
- Added AI Health Check red and blocked alert hooks.
- Added tests for normal event suppression, critical classification, AI Health Check hooks, green/yellow suppression, payload redaction, and command-free alerts.

### Changed

- Marked Task-040 as complete.
- Updated repository and package version to `0.4.25`.

### Safety

- Normal buys, sells, fills, profits, and routine green health checks do not trigger immediate alerts by default.
- Alert events are exception-focused and record-only.
- Alert payloads are redacted before output.
- Alert events do not expose order, cancel, or manual intervention commands.

### Verification

- Targeted Operational Alerting tests passed with 6 tests.

## 0.4.24 - 2026-07-28

### Added

- Added ReadOnlyDashboardService.
- Added read-only dashboard status model for system, trading, broker, data freshness, reconciliation, AI health, portfolio, strategy, and risk views.
- Added broker account masking for dashboard output.
- Added dashboard output redaction before return.
- Added tests for OK status, broker identifier masking, reconciliation blocking, AI health red status, and sensitive key redaction.

### Changed

- Marked Task-039 as complete.
- Updated repository and package version to `0.4.24`.

### Safety

- Dashboard status output is read-only and does not expose order, kill switch, or strategy promotion controls.
- Broker external account references are masked.
- Sensitive keys are redacted from dashboard output.
- No dashboard path calls Toss write methods.

### Verification

- Targeted Dashboard Read-Only tests passed with 5 tests.

## 0.4.23 - 2026-07-28

### Added

- Added ReconciliationService.
- Added reconciliation status model for `CLEAN`, `MISMATCH`, and `UNKNOWN`.
- Added internal vs broker position comparison.
- Added internal vs broker cash comparison.
- Added issue classifications for mismatched, missing internal, missing broker, and unknown broker states.
- Added read-only adapter reconciliation path using account snapshot and position reads.
- Added tests for match, mismatch, missing, unknown, and read-only adapter behavior.

### Changed

- Marked Task-038 as complete.
- Updated repository and package version to `0.4.23`.

### Safety

- Reconciliation is read-only and does not place corrective trades.
- Unknown broker read state blocks dependent trading.
- Reconciliation reports do not include submit, cancel, or allocation commands.

### Verification

- Targeted Reconciliation tests passed with 5 tests.

## 0.4.22 - 2026-07-28

### Added

- Added AIHealthCheckService.
- Added AI health status model for `GREEN`, `YELLOW`, `RED`, and `BLOCKED`.
- Added deterministic health metrics input model and default health policy.
- Added Claude health check schema validation.
- Added audit-only health check record output for future dashboard and alerting use.
- Added tests for valid Claude output, invalid Claude output rejection, deterministic fallback status, blocked broker state, and deterministic red status precedence.

### Changed

- Marked Task-037 as complete.
- Updated repository and package version to `0.4.22`.

### Safety

- AI Health Check remains auditor-only and does not trigger trades.
- Invalid Claude health output is rejected.
- Claude output cannot downgrade deterministic `RED` or `BLOCKED` status.
- `BLOCKED` status requires trading pause and human review flags in the health record.

### Verification

- Targeted AI Health Check tests passed with 6 tests.

## 0.4.21 - 2026-07-28

### Added

- Added StrategyPromotionWorkflow.
- Added promotion evidence model with pass, warn, fail, and unverified states.
- Added default promotion gate v0.2 requirements for validation stages.
- Added rejection reason model for missing evidence, failed evidence, unverified evidence, compliance blocks, open questions, and human approval requirements.
- Added rollback plan reference capture.
- Added tests for staged promotion, skipped-stage rejection, backtest-only production rejection, compliance and open-question blocks, human approval requirement, and decision-only production approval.

### Changed

- Marked Task-036 as complete.
- Updated repository and package version to `0.4.21`.

### Safety

- Strategies cannot skip validation stages.
- Backtest-only promotion to production is rejected.
- Production approval requires human approval during early operation.
- Promotion decisions remain decision-only and do not activate production or allocate capital.

### Verification

- Targeted Strategy Promotion tests passed with 6 tests.

## 0.4.20 - 2026-07-28

### Added

- Added StrategyDiversityEngine.
- Added strategy category model for baseline diversity reviews.
- Added holdings overlap metric.
- Added signal timing similarity calculation.
- Added return correlation threshold behavior.
- Added defensive diversification candidate detection.
- Added tests for overlap detection, correlation threshold behavior, defensive candidates, recent-winner concentration warning, and signal timing similarity.

### Changed

- Marked Task-035 as complete.
- Updated repository and package version to `0.4.20`.

### Safety

- Strategy diversity reviews are review-only and do not allocate capital or promote strategies.
- Recent high return alone now produces a concentration warning instead of supporting automatic allocation.
- Highly overlapping or highly correlated strategies can be flagged before promotion.

### Verification

- Targeted Strategy Diversity tests passed with 5 tests.

## 0.4.19 - 2026-07-28

### Added

- Added PaperTradingEngine.
- Added paper-only order, fill, event, and result records.
- Added simulated order lifecycle handling for submitted, accepted, partially filled, filled, canceled, rejected, and unknown states.
- Added tests for paper order submission, lifecycle simulation, rejected approvals, live broker account blocking, and unknown state handling.

### Changed

- Marked Task-034 as complete.
- Updated repository and package version to `0.4.19`.

### Safety

- Paper Trading is simulation-only and does not call Toss write methods.
- Paper records do not include broker order references or broker account identifiers.
- Live write-enabled broker accounts are rejected from Paper Trading.
- Unknown paper broker state blocks dependent trading.

### Verification

- Targeted Paper Trading tests passed with 5 tests.

## 0.4.18 - 2026-07-28

### Added

- Added ShadowPortfolioEngine.
- Added virtual portfolio state for candidate strategies.
- Added simulated buy and sell fills with commission and slippage assumptions.
- Added shadow trade and performance records.
- Added tests for virtual portfolio creation, simulated buys, simulated sells, candidate isolation, and HOLD behavior.

### Changed

- Marked Task-033 as complete.
- Updated repository and package version to `0.4.18`.

### Safety

- Shadow portfolios are virtual-only and do not include broker account IDs or live trading permissions.
- Shadow trades are simulation-only and do not contain broker order references.
- Shadow Portfolio engine does not call Toss write methods or create real broker orders.

### Verification

- `npm run check` passed with 141 tests.

## 0.4.17 - 2026-07-28

### Added

- Added WalkForwardValidationService.
- Added walk-forward window construction helper.
- Added train/validation window metadata and validation result comparison.
- Added degradation flags for return degradation and drawdown increase.
- Added tests for window construction, passing validation, degradation detection, overlapping window refusal, and missing window refusal.

### Changed

- Marked Task-032 as complete.
- Updated repository and package version to `0.4.17`.

### Safety

- Walk-forward validation refuses overlapping training and validation windows.
- Validation output is validation-only and cannot promote a strategy by itself.
- Input references from training and validation results are preserved for audit.

### Verification

- `npm run check` passed with 136 tests.

## 0.4.16 - 2026-07-28

### Added

- Added baseline BacktestEngine.
- Added historical data loading boundary model, cost model version requirement, strategy evaluation loop, simulated trade records, and result metrics.
- Added result evidence fields for data range and input references.
- Added tests for cost model application, missing cost model refusal, missing corporate action warning/blocking, and max drawdown calculation.

### Changed

- Marked Task-031 as complete.
- Updated repository and package version to `0.4.16`.

### Safety

- Backtest results are simulation-only and cannot promote a strategy.
- Backtest requires an explicit cost model version.
- Missing corporate action data can warn or block according to configuration.

### Verification

- `npm run check` passed with 131 tests.

## 0.4.15 - 2026-07-28

### Added

- Added baseline OrderApprovalEngine service.
- Added approval prerequisite checks for RiskCheck, MoneyCheck, BrokerAccount, compliance gate, and Toss capability registry.
- Added rejection reason codes for missing or failed approval dependencies.
- Added tests for approval path, missing risk and money checks, failed risk checks, broker/compliance/capability rejection, and AI-shaped non-dependencies.

### Changed

- Marked Task-030 as complete.
- Updated repository and package version to `0.4.15`.

### Safety

- Order approval is rejected when any dependency is missing, failed, blocked, or unverified.
- Approved OrderApproval remains separate from BrokerOrder and does not submit to Toss.
- AI output cannot stand in for RiskCheck or MoneyCheck.

### Verification

- `npm run check` passed with 126 tests.

## 0.4.14 - 2026-07-28

### Added

- Added baseline MoneyManagementEngine service.
- Added checks for available cash, per-order cap, per-strategy allocation cap, and minimum cash after order.
- Added MoneyCheck integration with explicit reason codes.
- Added tests for available cash, reserved and unsettled cash separation, order caps, strategy allocation caps, and minimum cash rule.

### Changed

- Marked Task-029 as complete.
- Updated repository and package version to `0.4.14`.

### Safety

- Reserved and unsettled cash are not treated as available buying power.
- Failed money checks do not include approved quantity, approved amount, or cash after order.
- No order may assume buying power without a passing MoneyCheck.

### Verification

- `npm run check` passed with 122 tests.

## 0.4.13 - 2026-07-28

### Added

- Added baseline RiskEngine service.
- Added hard checks for max order amount, position exposure, strategy exposure, market exposure, drawdown gate, and kill switch state.
- Added RiskCheck integration with reason codes and failed limit IDs.
- Added tests for pass behavior, hard rule vetoes, kill switch blocking, and drawdown blocking.

### Changed

- Marked Task-028 as complete.
- Updated repository and package version to `0.4.13`.

### Safety

- Any hard risk rule failure returns a non-approval RiskCheck.
- Active kill switch and drawdown gate produce BLOCKED risk checks.
- Risk Engine output is a check only and does not submit broker orders.

### Verification

- `npm run check` passed with 117 tests.

## 0.4.12 - 2026-07-28

### Added

- Added StrategyScoringService for combining market, fundamental, and news event engine outputs.
- Added strategy-specific engine weights and required engine checks.
- Added weighted composite score and composite confidence calculation.
- Added Signal creation after required scoring inputs pass.
- Added tests for weighted scoring, missing required engine blocking, review-required news blocking, HOLD/SELL thresholds, and signal/order separation.

### Changed

- Marked Task-027 as complete.
- Updated repository and package version to `0.4.12`.

### Safety

- Strategy scoring can create a Signal only after required engine outputs are present.
- Review-required news event scores are not considered available for automated scoring.
- Signal remains separate from OrderIntent and does not contain side, quantity, limit price, or broker order behavior.
- Engine scores still cannot bypass Risk Engine, Money Management Engine, or Order Approval Engine.

### Verification

- `npm run check` passed with 112 tests.

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
