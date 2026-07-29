# Phase 6 Four-Engineer Orchestrator Prompt

Copy this prompt into one Claude Code window. It assumes four coding engineers are available and the orchestrator can split work internally.

```text
로컬 저장소 기준으로 작업해줘.

로컬 저장소 경로:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 6의 첫 단계인 “paper/simulation + reconciliation + safety controls”를 4명의 코딩 엔지니어에게 병렬 분배해줘.

현재 상태:
- Phase 5 Toss read-only 검증은 종료됐다.
- accounts, holdings, market-prices read-only 검증이 human-operated 방식으로 완료됐다.
- 실제 `.env`와 `tmp/phase5` receipt 파일은 로컬 전용이며 gitignored다.
- Phase 6는 실거래가 아니라 paper trading, simulation, audit, reconciliation, kill switch, approval guard 강화 단계다.
- GitHub push는 하지 마라. 로컬 브랜치/커밋까지만 해라.

작업 전 확인:
1. cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
2. git status --short --branch
3. 작업트리가 깨끗하지 않으면 작업하지 말고 변경 파일을 보고해라.
4. origin/main 최신 상태를 기준으로 시작하되, push는 하지 마라.

공통 필수 문서:
- docs/11_AI_RULES.md
- docs/07_Trading_System.md
- docs/phase5/README.md
- docs/reviews/Codex_Phase5_Final_Closure_Review.md
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
- paper-trading-only order intent flow
- simulated execution records
- sanitized reconciliation summaries
- risk/kill-switch/approval guard 강화
- safety regression tests
- Phase 6 documentation and review

안전 불변식:
- Phase 6 output must not produce real broker write commands.
- paper/simulation output must be explicitly non-live.
- liveBrokerWriteAllowed must stay false wherever reported.
- BrokerWriteCommandGuard must reject write-looking/live commands.
- Kill switch, risk veto, and approval failure must block action.
- unresolved reconciliation must block any future live-readiness signal.

4명에게 다음처럼 분배해라.

Engineer 1:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-001_paper_order_intent_pipeline.md
- 브랜치: phase6/p6-001-paper-order-intent-pipeline
- 역할: paper-only order intent pipeline 강화
- 주의: output은 paper/simulation-only여야 하며 Toss order payload를 만들면 안 된다.

Engineer 2:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-002_reconciliation_snapshot_review.md
- 브랜치: phase6/p6-002-reconciliation-snapshot-review
- 역할: sanitized broker snapshot과 paper/simulation state reconciliation 강화
- 주의: 실제 tmp receipt를 읽지 말고 mock/sanitized fixture만 사용해라.

Engineer 3:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-003_risk_kill_switch_approval_guard.md
- 브랜치: phase6/p6-003-risk-kill-switch-approval-guard
- 역할: risk, kill switch, order approval, broker write guard control chain 강화
- 주의: guard 우회나 live write enable path를 만들면 안 된다.

Engineer 4:
- 작업지시서: docs/tasks/phase6_claude_worktree_tasks/P6-004_phase6_integration_safety_review.md
- 브랜치: phase6/p6-004-integration-safety-review
- 역할: 통합 안전 리뷰와 safety regression 보강
- 주의: 처음에는 scaffold와 regression gap 확인만 하고, 최종 리뷰는 1~3 병합 후 완성해라.

작업 방식:
- 각 엔지니어는 별도 브랜치 또는 worktree에서 작업해라.
- 각 엔지니어는 자기 작업지시서의 owned files 범위를 지켜라.
- 파일 충돌 가능성이 있으면 멈추고 소유자를 하나로 정해라.
- 각 엔지니어는 작업 후 npm run check를 실행해라.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋해라.

권장 병합 순서:
1. Engineer 1 / P6-001
2. Engineer 2 / P6-002
3. Engineer 3 / P6-003
4. Engineer 4 / P6-004

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
- paper/simulation-only 유지 확인
- real broker write command 생성 없음 확인
- 남은 수동 단계
```
