# Claude Code Orchestrator Prompt For Four Engineers

Use this prompt in one Claude Code window. The orchestrator should split the work across four coding engineers and coordinate their results.

```text
You are working in the AI-Investment-Operating-System repository.

Repository:
https://github.com/damdamartin/AI-Investment-Operating-System

Local path:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

Goal:
Coordinate four pure coding engineers to implement Phase 5 read-only validation improvements in parallel.

Primary instruction:
Do not start live trading work. Phase 5 is read-only validation only.

Required reading before assigning work:
1. docs/11_AI_RULES.md
2. docs/phase5/README.md
3. docs/phase5/toss-read-only-call-gate.md
4. docs/reviews/Codex_Phase5_Architecture_Review.md
5. docs/tasks/phase5_claude_worktree_tasks/README.md
6. docs/tasks/phase5_claude_worktree_tasks/FOUR_ENGINEER_PARALLEL_PLAN.md
7. docs/tasks/phase5_claude_worktree_tasks/P5-001_scope_and_open_question_evidence.md
8. docs/tasks/phase5_claude_worktree_tasks/P5-002_toss_endpoint_catalog_hardening.md
9. docs/tasks/phase5_claude_worktree_tasks/P5-003_toss_approval_and_evidence_harness.md
10. docs/tasks/phase5_claude_worktree_tasks/P5-004_naver_news_quality_fixtures.md
11. docs/tasks/phase5_claude_worktree_tasks/P5-005_claude_structured_output_evaluation.md
12. docs/tasks/phase5_claude_worktree_tasks/P5-006_phase5_regression_checks.md

Universal safety rules for all engineers:
- Never request, print, commit, or paste API keys, client secrets, access tokens, refresh tokens, account numbers, raw broker API responses, or raw request headers.
- Do not implement Toss order creation.
- Do not implement Toss order cancellation.
- Do not implement Toss order replacement.
- Do not implement transfers, withdrawals, or currency conversion that moves money.
- Do not implement production capital use.
- Do not add real network calls to tests.
- Do not change .env files.
- Do not guess Toss endpoint paths without official or local verification evidence.
- Every Phase 5 report must keep liveBrokerWriteAllowed: false.
- Where applicable, no-network commands must keep networkCallsPerformed: false.

Before splitting work:
1. Run git status --short --branch.
2. Confirm the worktree is clean.
3. Confirm main is up to date with origin/main.
4. If not clean or not up to date, stop and report the issue.

Create or coordinate four separate branches/worktrees:

Engineer 1 branch:
phase5/eng1-toss-endpoint-catalog

Engineer 1 task:
Implement Toss endpoint catalog hardening.

Engineer 1 owns:
- src/application/toss/read-only-endpoint-catalog.ts
- tests/application/toss-read-only-endpoint-catalog.test.ts
- docs/phase5/toss-read-only-endpoints.example.json

Engineer 1 must avoid:
- src/application/toss/read-only-evidence-intake.ts
- src/application/toss/read-only-evidence-recorder.ts
- src/adapters/naver/*
- src/adapters/claude/*
- docs/open_questions.md

Engineer 1 completion criteria:
- Add or refine explicit read-only operation classification.
- Validate method, operation, evidence kind, and source consistency.
- Keep non-authentication POST blocked.
- Keep mutation-looking endpoints blocked unless explicitly represented as safe order-status or fill read operations.
- Add positive and negative tests.
- Run npm run check.
- Do not add write endpoints or real Toss calls.

Engineer 2 branch:
phase5/eng2-toss-evidence-approval

Engineer 2 task:
Implement Toss evidence approval and sanitization harness.

Engineer 2 owns:
- src/application/toss/read-only-evidence-intake.ts
- src/application/toss/read-only-evidence-recorder.ts
- tests/application/toss-read-only-evidence-intake.test.ts
- tests/application/toss-read-only-evidence-recorder.test.ts
- docs/phase5/toss-read-only-call-gate.md
- optionally docs/phase5/read-only-call-approval.example.json

Engineer 2 must avoid:
- src/application/toss/read-only-endpoint-catalog.ts
- tests/application/toss-read-only-endpoint-catalog.test.ts
- src/adapters/naver/*
- src/adapters/claude/*
- docs/open_questions.md

Engineer 2 completion criteria:
- Define a sanitized approval record shape for one scoped future read-only call.
- Reject approval records containing secret-like text or account identifiers.
- Reject approval records for write operations.
- Ensure approval does not authorize multiple calls.
- Ensure evidence recorder still rejects live write command shapes.
- Run npm run check.
- Do not implement a network client.

Engineer 3 branch:
phase5/eng3-naver-news-quality

Engineer 3 task:
Implement Naver News quality fixtures and read-only quality measurement.

Engineer 3 owns:
- src/adapters/naver/naver-news-adapter.ts
- tests/adapters/naver-news-adapter.test.ts
- new module under src/application/news-quality/ if needed
- new tests under tests/application/ if needed
- optionally docs/phase5/naver-news-quality-notes.md

Engineer 3 must avoid:
- src/application/toss/*
- src/adapters/claude/*
- docs/open_questions.md
- order, risk, money, and broker write guard modules

Engineer 3 completion criteria:
- Add fixture-based quality metrics for duplicate articles.
- Detect malformed or missing publication dates.
- Flag old resurfaced articles.
- Flag weak source or URL consistency.
- Add warning examples for Korean company ambiguity and U.S. coverage gaps.
- Keep output as analysis metadata only.
- Run npm run check.
- Do not create signals, orders, or broker calls.

Engineer 4 branch:
phase5/eng4-claude-eval-regression

Engineer 4 task:
Implement Claude structured-output evaluation fixtures and Phase 5 regression checks.

Engineer 4 owns:
- src/adapters/claude/analysis-schema.ts
- src/adapters/claude/claude-adapter.ts
- src/application/ai/*
- tests/adapters/claude-adapter.test.ts
- tests/application/ai-analysis-persistence.test.ts
- tests/safety/safety-regression.test.ts
- tests/scripts/*phase5*
- tests/scripts/*toss*
- optionally docs/phase5/claude-structured-output-evaluation.md

Engineer 4 must avoid:
- src/application/toss/read-only-endpoint-catalog.ts
- src/application/toss/read-only-evidence-intake.ts
- src/application/toss/read-only-evidence-recorder.ts
- src/adapters/naver/*
- docs/open_questions.md

Engineer 4 completion criteria:
- Add fixtures for invalid Claude output rejection.
- Reject missing confidence or unsupported values.
- Test requires_review, contradictions, and unknown fields.
- Ensure Claude output cannot contain executable broker commands.
- Strengthen regression tests that preflight, doctor, completion, and call gate do not perform network calls.
- Confirm call gate fails closed by default.
- Confirm approval never permits live broker writes.
- Run npm run check.
- Do not send secrets to Claude prompts or tests.

Coordination rules:
- Keep each engineer inside their owned files unless a dependency requires coordination.
- If two engineers need the same file, pause and decide one owner.
- Each engineer must commit only their own changes.
- Use commit message format:
  Phase 5: <short task summary>
- Do not push until all local checks pass.

Recommended merge order:
1. Engineer 1
2. Engineer 2
3. Engineer 3
4. Engineer 4

After merging all four branches into main:
1. Run npm run check.
2. Run npm run phase5:toss:doctor.
3. Run npm run phase5:toss:preflight.
4. Confirm no .env or secret file is staged.
5. Confirm no raw real API response file is staged.
6. Confirm no Toss write endpoint or write HTTP client was implemented.
7. Confirm every Phase 5 report still says liveBrokerWriteAllowed: false.

Final response format:
Report by engineer:
- branch
- files changed
- tests run
- safety confirmation
- open questions or blockers

Then report:
- final merged commit SHA if merged
- whether push was performed
- exact commands that passed

If any engineer cannot complete safely, stop that engineer's task and report the blocker. Do not weaken safety rules to make tests pass.
```

