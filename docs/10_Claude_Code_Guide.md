# 10 Claude Code Guide

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-27  
Related Docs: 01_Project_Vision.md, 02_System_Architecture.md, 03_Domain_Model.md, 04_Database_Architecture.md, 05_API_Architecture.md, 06_AI_Architecture.md, 07_Trading_System.md, 08_Testing_Validation.md, 09_Operation_Deployment.md, 11_AI_RULES.md, 99_Development_Roadmap.md

## 1. Document Purpose

This document defines how Claude Code sessions should implement AI Investment Operating System.

It is designed for parallel development using independent worktrees and branches while preserving architecture, safety boundaries, testing requirements, and documentation consistency.

The central rule is:

> Claude Code may implement modules, but it must not weaken the safety architecture.

## 2. Required Reading Before Implementation

Before implementing a task, each Claude Code session must read:

1. `01_Project_Vision.md`
2. `02_System_Architecture.md`
3. `11_AI_RULES.md`
4. the document directly related to the task
5. the task specification assigned to that session

Examples:

- Toss adapter task: read `05_API_Architecture.md`, `07_Trading_System.md`, `08_Testing_Validation.md`
- Risk engine task: read `03_Domain_Model.md`, `07_Trading_System.md`, `08_Testing_Validation.md`
- Claude adapter task: read `05_API_Architecture.md`, `06_AI_Architecture.md`, `11_AI_RULES.md`

## 3. Development Workflow

Recommended workflow:

```text
select task
-> read required docs
-> create worktree branch
-> implement smallest safe slice
-> add or update tests
-> run checks
-> update docs if needed
-> commit
-> open pull request
-> review
-> merge
```

Claude Code must not start broad refactors without a task that explicitly permits them.

## 4. Worktree Strategy

Use independent branches for parallel sessions.

Recommended command style:

```bash
claude --worktree feature/toss-adapter
```

or if supported:

```bash
claude -w feature/toss-adapter
```

Each session should own a narrow module or task group.

Do not run multiple Claude Code sessions on the same branch unless explicitly coordinated.

## 5. Branch Naming

Branch format:

```text
feature/<module-or-task>
fix/<bug-or-safety-issue>
docs/<document-name>
test/<test-area>
infra/<infra-area>
```

Examples:

```text
feature/toss-adapter-readonly
feature/risk-engine-core
feature/claude-schema-validation
feature/news-adapter-naver
test/order-lifecycle-e2e
docs/api-architecture-review
```

## 6. Module Ownership

Parallel sessions should be split by module boundaries.

Recommended initial modules:

| Module | Scope |
|---|---|
| Core Domain | value objects, entities, state machines |
| Database | migrations, repositories, persistence tests |
| Toss Adapter | broker API contracts and mock integration |
| Naver Adapter | news API ingestion and normalization |
| Claude Adapter | prompt templates, schema validation, AIAnalysis |
| Strategy Engine | signal generation and scoring |
| Risk Engine | risk limits and veto logic |
| Money Management | cash, allocation, sizing |
| Order Approval | approval records and rejection logic |
| Execution | order submission workflow and outbox |
| Reconciliation | broker status, fills, positions, cash sync |
| Backtest | historical strategy validation |
| Shadow Portfolio | live simulation without real capital |
| Paper Trading | simulated order lifecycle |
| Dashboard | status and control UI |
| Operations | monitoring, alerts, deployment |

Avoid cross-module edits unless the task explicitly requires them.

## 7. Task Format

Every implementation task should follow this structure:

```markdown
# Task-000: Short Title

## Objective

What to build.

## Context

Relevant documents and architectural constraints.

## Scope

Included work.

## Out of Scope

Excluded work.

## Inputs

Expected inputs or dependencies.

## Outputs

Expected files, interfaces, behaviors, or docs.

## Acceptance Criteria

Concrete completion criteria.

## Tests Required

Required unit, integration, contract, or E2E tests.

## Safety Requirements

Rules that must not be violated.

## Dependencies

Prerequisite tasks.
```

Use `docs/templates/Task_Template.md` as the reusable template.

## 8. Implementation Standards

General standards:

- implement the smallest safe increment
- prefer explicit types for money, currency, quantity, market, and order state
- keep external API payloads outside domain models
- keep adapters thin and well-tested
- keep strategy logic separate from execution logic
- make failure behavior explicit
- log safe diagnostic information
- do not log secrets
- add tests with every behavior change

Production-trading-related code must be conservative by default.

## 9. Safety Rules for Claude Code

Claude Code must not:

- add code that lets Claude API call Toss API
- create direct order APIs from dashboard to broker
- bypass Risk Engine
- bypass Money Management Engine
- bypass Order Approval Engine
- treat AI output as order approval
- treat news as direct order trigger
- add secrets to repository
- silently retry broker order submission
- remove audit records
- mutate approved strategy versions in place
- enable unverified broker capabilities
- default to market orders
- enable production mode by default

If a task appears to require any of these, stop and request architecture review.

## 10. Testing Standards

Every task must include relevant tests.

Minimum expectations:

- domain logic: unit tests
- adapters: contract and fixture tests
- trading flows: integration tests
- safety boundaries: regression tests
- database changes: migration tests
- AI prompts: schema validation tests
- execution logic: duplicate-order and unknown-state tests

No task touching trading, risk, AI, or broker behavior is complete without tests.

## 11. Documentation Standards

Update documentation when:

- architecture changes
- public internal interface changes
- data model changes
- safety rule changes
- API assumptions change
- broker capability is verified
- operational behavior changes

Documentation updates should be committed with the related code change unless they are large enough for a separate docs task.

## 12. Pull Request Standards

Each pull request should include:

- summary
- scope
- safety impact
- tests run
- docs updated
- open questions
- rollback considerations

Suggested PR body:

```markdown
## Summary

## Scope

## Safety Impact

## Tests

## Docs

## Open Questions

## Rollback
```

## 13. Review Checklist

Reviewers must check:

- follows architecture docs
- does not violate AI rules
- tests are meaningful
- errors fail safely
- no secrets included
- broker writes are controlled
- audit records are preserved
- unverified capabilities remain blocked
- docs are updated where needed
- no broad unrelated refactor

## 14. Merge Strategy

Preferred merge style:

- small PRs
- one module or task per PR
- squash or merge commit based on repository policy
- no direct production branch changes without review

Before merge:

- all required checks pass
- conflicts resolved
- changelog updated if needed
- architecture impacts reviewed

## 15. Initial Parallel Development Plan

After architecture documents are reviewed, initial parallel sessions may be:

| Session | Branch | Task Area |
|---|---|---|
| 1 | `feature/core-domain` | value objects, entities, state machines |
| 2 | `feature/database-foundation` | database migrations and repositories |
| 3 | `feature/claude-adapter` | Claude adapter and schema validation |
| 4 | `feature/naver-news-adapter` | Naver news ingestion |
| 5 | `feature/toss-readonly-adapter` | Toss read-only API integration |
| 6 | `feature/risk-engine` | risk limits and checks |
| 7 | `feature/money-management` | cash and sizing rules |
| 8 | `feature/order-approval` | order approval pipeline |
| 9 | `feature/testing-harness` | shared tests and fixtures |

Do not start live order submission implementation until read-only broker integration, risk engine, money management, order approval, and test harness are in place.

## 16. Suggested Task Breakdown

### Phase 1: Foundations

- Task-001: project structure
- Task-002: core value objects
- Task-003: domain state machines
- Task-004: database migration framework
- Task-005: configuration and secret loading
- Task-006: structured logging
- Task-007: test harness

### Phase 2: External Adapters

- Task-020: ClaudeAIAdapter mock and schema validation
- Task-021: NaverNewsAdapter fixture tests
- Task-022: TossSecuritiesAdapter read-only interface
- Task-023: API capability registry
- Task-024: API call logging

### Phase 3: Trading Controls

- Task-040: Risk Engine
- Task-041: Money Management Engine
- Task-042: Order Approval Engine
- Task-043: Kill Switch
- Task-044: duplicate order prevention

### Phase 4: Research and Simulation

- Task-060: Backtest framework
- Task-061: Shadow Portfolio
- Task-062: Paper Trading
- Task-063: strategy promotion review

### Phase 5: Execution

- Task-080: execution outbox
- Task-081: broker order status tracking
- Task-082: fill reconciliation
- Task-083: small-capital live safeguards

### Phase 6: Operations

- Task-100: dashboard status API
- Task-101: alerts
- Task-102: monitoring metrics
- Task-103: backup and restore scripts
- Task-104: operational runbooks

## 17. Commit Standards

Commit messages should be concise and scoped.

Examples:

```text
Add Money value object
Implement risk limit checks
Add Claude schema validation fixtures
Draft order approval pipeline
```

Avoid vague messages:

```text
update
fix stuff
changes
```

## 18. Handling Uncertainty

If Claude Code encounters uncertainty:

1. check the relevant docs
2. check existing code patterns
3. choose the most conservative safe behavior
4. document the assumption
5. add an open question if needed

For broker behavior uncertainty, do not guess. Mark as `UNVERIFIED`.

## 19. Forbidden Shortcuts

Forbidden:

- implementing live order submission before approval pipeline
- adding direct broker calls in strategy code
- adding direct broker calls in AI code
- using raw numbers for money without currency
- storing secrets in `.env` examples with real values
- skipping tests because logic is simple
- making strategy versions mutable
- collapsing unknown broker state into failed state
- allowing dashboard order buttons to call broker directly

## 20. Completion Definition

A Claude Code task is complete only when:

- scope is implemented
- tests pass
- safety requirements are met
- docs updated if needed
- no secrets introduced
- no architecture rule violated
- commit created
- PR or merge path is ready

For trading-related tasks, completion also requires:

- failure behavior tested
- audit behavior tested
- no unsafe default enabled

## 21. Final Claude Code Statement

Claude Code is a development accelerator, not an architecture authority.

It must implement within the documented system:

```text
docs define the rules
tasks define the scope
tests define acceptance
reviews protect safety
```

When speed conflicts with safety, safety wins.

