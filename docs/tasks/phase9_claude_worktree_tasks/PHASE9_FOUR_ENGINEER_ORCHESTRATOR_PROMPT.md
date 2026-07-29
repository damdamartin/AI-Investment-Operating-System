# Phase 9 Four-Engineer Orchestrator Prompt

Paste this prompt into Claude Code.

```text
로컬 저장소 기준으로 작업해줘.

저장소 위치:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 9 round 1 small-capital live trading preparation 작업을 4명의 엔지니어에게 병렬 분배해줘.

중요한 경계:
- Phase 9 round 1은 실거래 준비 단계이지 실주문 구현 단계가 아니다.
- 실주문, 주문취소, 주문정정/교체, 이체, 출금, 환전 구현 금지.
- callable TossSecuritiesAdapter write implementation 생성 금지.
- 실제 Toss order endpoint로 HTTP/fetch/axios/undici 호출 금지.
- 실제 클라우드 배포 명령 실행 금지.
- .env와 tmp/phase5 실제 receipt 읽기/출력/커밋 금지.
- API 키, 토큰, 계좌번호, raw broker payload 출력 금지.
- liveBrokerWriteAllowed:true 런타임 경로 생성 금지.
- AI 단독 판단으로 LCB-001~LCB-008, compliance, human approval을 RESOLVED 처리 금지.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋하고 GitHub push는 하지 말 것.

먼저 읽을 문서:
1. docs/phase9/README.md
2. docs/tasks/phase9_claude_worktree_tasks/README.md
3. docs/phase7/live-capable-blocker-register.md
4. docs/phase7/toss-write-contract-design.md
5. docs/phase7/small-capital-readiness-gates.md
6. docs/phase8/README.md
7. docs/13_Compliance_and_Legal_Review.md
8. docs/11_AI_RULES.md
9. docs/reviews/Codex_Phase8_Operations_Readiness_Review.md

엔지니어 배정:

Engineer 1:
- 작업지시서: docs/tasks/phase9_claude_worktree_tasks/P9-001_live_blocker_evidence_intake.md
- 브랜치: phase9/p9-001-live-blocker-evidence-intake
- 역할: LCB-001~LCB-008 evidence intake and human review validator

Engineer 2:
- 작업지시서: docs/tasks/phase9_claude_worktree_tasks/P9-002_toss_write_preflight_contract_guard.md
- 브랜치: phase9/p9-002-toss-write-preflight-contract-guard
- 역할: future Toss write preflight contract guard, still no-write

Engineer 3:
- 작업지시서: docs/tasks/phase9_claude_worktree_tasks/P9-003_small_capital_enablement_gate.md
- 브랜치: phase9/p9-003-small-capital-enablement-gate
- 역할: small-capital preparation go/no-go gate, evidence-only

Engineer 4:
- 작업지시서: docs/tasks/phase9_claude_worktree_tasks/P9-004_phase9_integration_review.md
- 브랜치: phase9/p9-004-integration-review
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
- LCB-001~LCB-008 상태 요약
- 남은 human-only blockers
- GitHub push는 수행하지 않았다는 확인
```
