# Phase 7 Four-Engineer Orchestrator Prompt

Paste this prompt into Claude Code.

```text
로컬 저장소 기준으로 작업해줘.

저장소 위치:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 7 live-capable design readiness 작업을 4명의 엔지니어에게 병렬 분배해줘.

중요한 경계:
- Phase 7은 실거래 구현 단계가 아니다.
- 실주문, 주문취소, 주문정정/교체, 이체, 출금, 환전 구현 금지.
- 실제 Toss order endpoint로 HTTP/fetch/axios/undici 호출 금지.
- .env와 tmp/phase5 실제 receipt 읽기/출력/커밋 금지.
- API 키, 토큰, 계좌번호, raw broker payload 출력 금지.
- liveBrokerWriteAllowed:true 런타임 경로 생성 금지.
- AI 단독 판단으로 open question, compliance, human approval을 resolved 처리 금지.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋하고 GitHub push는 하지 말 것.

먼저 읽을 문서:
1. docs/phase7/README.md
2. docs/tasks/phase7_claude_worktree_tasks/README.md
3. docs/11_AI_RULES.md
4. docs/07_Trading_System.md
5. docs/08_Testing_Validation.md
6. docs/13_Compliance_and_Legal_Review.md
7. docs/open_questions.md
8. docs/reviews/Codex_Phase6_Round2_Operational_Readiness_Review.md

엔지니어 배정:

Engineer 1:
- 작업지시서: docs/tasks/phase7_claude_worktree_tasks/P7-001_live_capable_blocker_audit.md
- 브랜치: phase7/p7-001-live-capable-blocker-audit
- 역할: live-capable blocker audit and evidence register

Engineer 2:
- 작업지시서: docs/tasks/phase7_claude_worktree_tasks/P7-002_toss_write_contract_design.md
- 브랜치: phase7/p7-002-toss-write-contract-design
- 역할: Toss write contract design without callable implementation

Engineer 3:
- 작업지시서: docs/tasks/phase7_claude_worktree_tasks/P7-003_small_capital_readiness_gates.md
- 브랜치: phase7/p7-003-small-capital-readiness-gates
- 역할: small-capital readiness gates and manual approval records

Engineer 4:
- 작업지시서: docs/tasks/phase7_claude_worktree_tasks/P7-004_phase7_integration_review.md
- 브랜치: phase7/p7-004-integration-review
- 역할: integration review and safety regression review after Engineers 1-3

작업 순서:
1. 각 엔지니어가 자기 브랜치에서 작업하고 로컬 커밋한다.
2. Engineer 4는 가능하면 먼저 현재 main 기준의 safety baseline을 확인한다.
3. Engineer 1-3 결과가 준비되면 main에 순서대로 병합한다.
4. Engineer 4가 최종 통합 리뷰를 완료하고 로컬 커밋한다.
5. 최종 main에서 npm run check를 실행한다.

최종 보고 형식:
- Engineer별 브랜치/커밋/변경 요약
- 통합 main 최종 커밋 SHA
- npm run check 결과
- source scan 결과
- 남은 blockers
- GitHub push는 수행하지 않았다는 확인
```
