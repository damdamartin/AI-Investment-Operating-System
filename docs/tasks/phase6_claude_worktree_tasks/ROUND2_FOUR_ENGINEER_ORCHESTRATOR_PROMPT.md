# Phase 6 Round 2 Four-Engineer Orchestrator Prompt

Copy this prompt into one Claude Code window. It assumes four coding engineers are available and the orchestrator can split work internally.

```text
로컬 저장소 기준으로 작업해줘.

로컬 저장소 경로:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 6 라운드 2인 “operational visibility + alerts + scheduler/runbooks + integration review”를 4명의 코딩 엔지니어에게 병렬 분배해줘.

현재 상태:
- Phase 5 Toss read-only 검증은 종료됐다.
- Phase 6 라운드 1은 paper/simulation safety core를 완성했다.
- PaperOrderIntentPipeline, reconciliation live-readiness block, risk/kill-switch/approval/broker-write guard 강화가 local main에 병합되어 있다.
- 실제 `.env`와 `tmp/phase5` receipt 파일은 로컬 전용이며 gitignored다.
- Phase 6 라운드 2는 운영 가시화, 알림/리포트, scheduler-safe no-write jobs, operator runbook 단계다.
- GitHub push는 하지 마라. 로컬 브랜치/커밋까지만 해라.

작업 전 확인:
1. cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
2. git status --short --branch
3. 작업트리가 깨끗하지 않으면 작업하지 말고 변경 파일을 보고해라.
4. origin/main과 local main이 다를 수 있다. local main의 최신 커밋을 기준으로 시작하되, push는 하지 마라.

공통 필수 문서:
- docs/11_AI_RULES.md
- docs/07_Trading_System.md
- docs/phase5/README.md
- docs/phase6/README.md
- docs/reviews/Codex_Phase5_Final_Closure_Review.md
- docs/reviews/Codex_Phase6_Simulation_Safety_Review.md
- docs/tasks/phase6_claude_worktree_tasks/README.md

절대 금지:
- Toss 실주문 구현
- Toss 주문취소 구현
- Toss 주문정정/교체 구현
- 이체, 출금, 돈이 이동하는 환전 구현
- production capital 사용
- API 키, 토큰, 계좌번호, raw API 응답, raw request header 요청/출력/커밋
- `.env` 읽기/출력/커밋
- `tmp/phase5` 실제 receipt 읽기/출력/커밋
- 실제 Toss API 호출을 테스트에 넣기
- AI 엔지니어가 real Toss call을 직접 실행하기
- GitHub push

허용:
- pure unit tests
- mock-only integration tests
- dashboard read models
- sanitized operational alerts
- non-executing reports
- scheduler-safe no-write jobs
- operator runbooks/checklists
- safety regression tests

안전 불변식:
- Dashboard, alert, report, scheduler output must not produce real broker write commands.
- paper/simulation readiness must be separate from live readiness.
- liveBrokerWriteAllowed must stay false wherever reported.
- alerts must never trigger order execution.
- scheduler jobs must never call real Toss APIs or write endpoints.
- unresolved reconciliation must block any future live-readiness signal.

4명에게 다음처럼 분배해라.

Engineer 1:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-005_phase6_operator_dashboard.md
- 브랜치: phase6/p6-005-operator-dashboard
- 역할: Phase 6 operator dashboard read model
- 주의: dashboard는 controls가 아니라 read-only status surface다. live trading enable 버튼/토글 금지.

Engineer 2:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-006_phase6_alerting_and_reports.md
- 브랜치: phase6/p6-006-alerting-and-reports
- 역할: operational alerts, observability metrics, sanitized reports
- 주의: alert가 주문 실행/취소/수정으로 이어지면 안 된다.

Engineer 3:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-007_phase6_scheduler_and_runbooks.md
- 브랜치: phase6/p6-007-scheduler-and-runbooks
- 역할: scheduler-safe no-write jobs and operator runbooks
- 주의: scheduler에서 실제 Toss API 호출이나 broker-facing network call 금지.

Engineer 4:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-008_phase6_round2_integration_review.md
- 브랜치: phase6/p6-008-round2-operational-readiness-review
- 역할: 통합 안전 리뷰와 safety regression 보강
- 주의: 처음에는 scaffold와 regression gap 확인만 하고, 최종 리뷰는 1~3 병합 후 완성해라.

작업 방식:
- 각 엔지니어는 별도 브랜치 또는 worktree에서 작업해라.
- 각 엔지니어는 자기 작업지시서의 owned files 범위를 지켜라.
- 파일 충돌 가능성이 있으면 멈추고 소유자를 하나로 정해라.
- 각 엔지니어는 작업 후 npm run check를 실행해라.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋해라.

권장 병합 순서:
1. Engineer 1 / P6-005
2. Engineer 2 / P6-006
3. Engineer 3 / P6-007
4. Engineer 4 / P6-008

최종 통합 후 실행:
1. npm run check
2. npm run phase5:toss:readiness
3. npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
4. npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
5. PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json

Phase 5 local commands are allowed only as no-write readiness checks. Do not run real read-only verification calls and do not run any Toss write call.

최종 보고 형식:
- Engineer 1~4 각각의 branch, 변경 파일, 실행 테스트, safety 확인, blocker
- 최종 병합 commit SHA
- push는 하지 않았다고 명확히 보고
- 통과한 명령어와 fail-closed 명령어의 exit/status/reasonCodes
- 테스트에서 실제 Toss API 호출 없음 확인
- AI가 실제 Toss API를 호출하지 않았음 확인
- liveBrokerWriteAllowed:false 유지 확인
- dashboard/alert/report/scheduler가 no-write임 확인
- real broker write command 생성 없음 확인
- 남은 수동 단계
```
