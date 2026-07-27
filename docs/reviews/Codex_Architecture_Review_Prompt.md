# Codex Architecture Review Prompt

Version: 0.1.0  
Status: Draft  
Last Updated: 2026-07-28  
Related Docs: ../01_Project_Vision.md, ../02_System_Architecture.md, ../03_Domain_Model.md, ../04_Database_Architecture.md, ../05_API_Architecture.md, ../06_AI_Architecture.md, ../07_Trading_System.md, ../08_Testing_Validation.md, ../09_Operation_Deployment.md, ../10_Claude_Code_Guide.md, ../11_AI_RULES.md, ../99_Development_Roadmap.md

## Purpose

Use this prompt to ask Codex to perform a full architecture review before implementation begins.

## Prompt

You are reviewing the documentation foundation for `AI Investment Operating System`, a safety-first automated stock and ETF trading platform.

The system is intended to use:

- Toss Securities Open API for Korean and U.S. stock/ETF market data, account data, and order execution
- Naver News API for news collection
- Claude API for structured AI analysis, strategy research, AI Health Check, and auditing

Important project rules:

- AI must not directly place broker orders.
- Claude API must never call Toss Securities Open API directly.
- News analysis alone must never trigger an order.
- Every live order must pass Risk Engine, Money Management Engine, and Order Approval Engine.
- Unverified broker capabilities must remain blocked.
- Unknown broker order state must block dependent trading until reconciliation.
- Strategy versions are immutable after approval.
- Unverified strategies must not touch production capital.
- Secrets must not enter Git, logs, raw payloads, or AI prompts.
- The default behavior under uncertainty is no trade.

Please review all documentation files in `docs/`:

1. `01_Project_Vision.md`
2. `02_System_Architecture.md`
3. `03_Domain_Model.md`
4. `04_Database_Architecture.md`
5. `05_API_Architecture.md`
6. `06_AI_Architecture.md`
7. `07_Trading_System.md`
8. `08_Testing_Validation.md`
9. `09_Operation_Deployment.md`
10. `10_Claude_Code_Guide.md`
11. `11_AI_RULES.md`
12. `12_CHANGELOG.md`
13. `99_Development_Roadmap.md`

Review objectives:

1. Identify contradictions between documents.
2. Identify missing safety controls.
3. Identify unclear implementation boundaries.
4. Identify places where AI authority is too broad or ambiguous.
5. Identify places where broker execution could bypass risk controls.
6. Identify missing data model or audit requirements.
7. Identify missing tests or validation gates.
8. Identify operational weaknesses for 24/7 cloud operation.
9. Identify API assumptions that must be verified before implementation.
10. Identify documentation gaps that would confuse Claude Code parallel development.
11. Recommend changes before development begins.
12. Recommend the first implementation milestones and blockers.

Output format:

```markdown
# Codex Architecture Review

## Executive Summary

## Critical Findings

Findings that could lead to unsafe trading, uncontrolled orders, loss of auditability, secret exposure, or production instability.

For each finding:

- Severity: Critical
- File(s):
- Issue:
- Why it matters:
- Recommended fix:

## High Findings

Important architectural or implementation risks that should be fixed before coding.

## Medium Findings

Gaps, ambiguities, or maintainability risks.

## Low Findings

Minor improvements, clarity issues, naming consistency, or documentation polish.

## Cross-Document Contradictions

## Missing Requirements

## API Verification Required

## Safety Review

Check AI boundary, order approval boundary, risk controls, money controls, kill switch, reconciliation, and secret handling.

## Testing Review

Check unit, integration, contract, E2E, backtest, walk-forward, Shadow Portfolio, Paper Trading, and small-capital live validation.

## Operations Review

Check cloud runtime, monitoring, alerting, incident response, backup, restore, deployment, and rollback.

## Claude Code Readiness

Assess whether the docs are enough to create implementation tasks for parallel development.

## Recommended Document Revisions

## Recommended Implementation Order

## Open Questions

## Final Recommendation

State whether the project is ready to move from Phase 1 to Phase 3, or whether Phase 2 revisions are required first.
```

Review stance:

- Be strict.
- Prioritize safety over speed.
- Do not assume Toss Securities behavior that is not documented.
- Do not assume news quality is sufficient for U.S. stocks.
- Do not accept AI judgment as a substitute for deterministic controls.
- Treat incomplete auditability as a serious issue.
- Treat live broker writes as the highest-risk capability.

