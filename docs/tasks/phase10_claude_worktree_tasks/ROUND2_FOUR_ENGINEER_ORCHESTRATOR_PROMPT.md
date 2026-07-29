# Phase 10 Round 2 Four-Engineer Orchestrator Prompt

Paste this prompt into Claude Code.

```text
로컬 저장소 기준으로 작업해줘.

저장소 위치:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 10 round 2 human blocker evidence packet 작업을 4명의 엔지니어에게 병렬 분배해줘.

중요한 경계:
- Phase 10 round 2는 LCB-001~LCB-008 사람 검토용 증거 패킷을 만드는 단계다.
- 실주문, 주문취소, 주문정정/교체, 이체, 출금, 환전 구현 금지.
- callable TossSecuritiesAdapter write implementation 생성 금지.
- 실제 Toss order endpoint로 HTTP/fetch/axios/undici 호출 금지.
- 실제 Toss API 호출 금지.
- 실제 클라우드 배포 명령 실행 금지.
- .env와 tmp/phase5 실제 receipt 읽기/출력/커밋 금지.
- API 키, 토큰, 계좌번호, raw broker payload 출력 금지.
- liveBrokerWriteAllowed:true 런타임 경로 생성 금지.
- AI 단독 판단으로 LCB-001~LCB-008, compliance, human approval을 RESOLVED 처리 금지.
- docs/phase7/live-capable-blocker-register.md는 수정하지 말 것. 필요하면 변경 없음만 검증할 것.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋하고 GitHub push는 하지 말 것.

먼저 읽을 문서:
1. docs/phase10/human-blocker-evidence-workbook.md
2. docs/phase10/README.md
3. docs/tasks/phase10_claude_worktree_tasks/README.md
4. docs/phase7/live-capable-blocker-register.md
5. docs/phase10/live-operation-approval-packet.md
6. docs/phase10/first-trade-operating-protocol.md
7. docs/phase10/runtime-live-lock-gate.md
8. docs/13_Compliance_and_Legal_Review.md
9. docs/11_AI_RULES.md

엔지니어 배정:

Engineer 1:
- 작업지시서: docs/tasks/phase10_claude_worktree_tasks/P10-005_toss_compliance_evidence_packet.md
- 브랜치: phase10/p10-005-toss-compliance-evidence-packet
- 역할: LCB-001 Toss automated trading permission + LCB-005 compliance/legal evidence packet

Engineer 2:
- 작업지시서: docs/tasks/phase10_claude_worktree_tasks/P10-006_account_provisioning_evidence_packet.md
- 브랜치: phase10/p10-006-account-provisioning-evidence-packet
- 역할: LCB-002 account capability + LCB-003 credential provisioning evidence packet

Engineer 3:
- 작업지시서: docs/tasks/phase10_claude_worktree_tasks/P10-007_owner_risk_evidence_packet.md
- 브랜치: phase10/p10-007-owner-risk-evidence-packet
- 역할: LCB-004 human approval + LCB-006 small-capital operating limits evidence packet

Engineer 4:
- 작업지시서: docs/tasks/phase10_claude_worktree_tasks/P10-008_live_safety_review_packet.md
- 브랜치: phase10/p10-008-live-safety-review-packet
- 역할: LCB-007 live kill-switch/rollback + LCB-008 future write-adapter review packet, then integration review

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
- docs/phase7/live-capable-blocker-register.md 무변경 확인
- LCB-001~LCB-008별 인간이 아직 직접 해야 할 일
- GitHub push는 수행하지 않았다는 확인
```
