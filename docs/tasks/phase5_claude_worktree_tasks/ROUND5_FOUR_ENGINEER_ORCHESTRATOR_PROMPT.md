# Round 5 Four-Engineer Orchestrator Prompt

Copy this prompt into one Claude Code window. It assumes four coding engineers are available and the orchestrator can split work internally.

```text
로컬 저장소 기준으로 작업해줘.

로컬 저장소 경로:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 5의 다음 단계인 “accounts/holdings 실검증 이후 read-only 확장”을 4명의 코딩 엔지니어에게 병렬 분배해줘.

현재 상태:
- GitHub에는 accounts와 holdings read-only 검증을 가능하게 한 코드가 push된 상태다.
- 로컬 operator machine에서는 accounts read-only 검증과 holdings read-only 검증이 성공했을 수 있다.
- 실제 `.env`와 `tmp/phase5` receipt 파일은 로컬 전용이며 gitignored다.
- 다음 개발 목표는 market-prices read-only 확장, sanitized evidence 정리, operator 문서/상태 가시화, 안전 회귀 리뷰다.
- GitHub push는 하지 마라. 로컬 브랜치/커밋까지만 해라.

작업 전 확인:
1. cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
2. git status --short --branch
3. 작업트리가 깨끗하지 않으면 작업하지 말고 변경 파일을 보고해라.
4. origin/main 최신 상태를 기준으로 시작하되, push는 하지 마라.

공통 필수 문서:
- docs/11_AI_RULES.md
- docs/phase5/README.md
- docs/phase5/local-toss-read-only-runbook.md
- docs/phase5/toss-read-only-call-gate.md
- docs/phase5/toss-official-api-source-notes.md
- docs/phase5/open-question-evidence-policy.md
- docs/reviews/Codex_Phase5_Architecture_Review.md
- docs/reviews/Codex_Phase5_Readiness_Review.md
- docs/reviews/Codex_Phase5_First_Read_Only_Verification_Review.md

절대 금지:
- Toss 실주문 구현
- Toss 주문취소 구현
- Toss 주문정정 구현
- 이체, 출금, 돈이 이동하는 환전 구현
- production capital 사용
- API 키, 토큰, 계좌번호, raw API 응답, raw request header 요청/출력/커밋
- `.env` 읽기/출력/커밋
- `tmp/phase5` 실제 receipt 커밋
- GitHub push
- preflight/completion 안전장치를 약화해서 억지로 통과시키기
- 실제 Toss API 호출을 테스트에 넣기
- AI 엔지니어가 real Toss call을 직접 실행하기

허용:
- mock 서버 기반 테스트
- official Toss docs 기반 read-only endpoint 정리
- human-approved one-call runner의 안전한 확장
- sanitized evidence schema/test 강화
- operator runbook/checklist/status 문서화

안전 불변식:
- 모든 Phase 5 report는 liveBrokerWriteAllowed:false 를 유지해야 한다.
- no-network 명령은 networkCallsPerformed:false 를 유지해야 한다.
- real read-only runner만 operator approval 후 networkCallsPerformed:true가 가능하다.
- rawPayloadStored:false 를 유지해야 한다.
- 주문/취소/정정/이체/환전 경로는 코드에 추가하지 않는다.

4명에게 다음처럼 분배해라.

Engineer 1:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-016_market_prices_read_only_verification.md
- 브랜치: phase5/p5-016-market-prices-read-only-verification
- 역할: Toss market-prices read-only client/runner 확장
- 주의: tests는 mock 서버만 사용. 실제 Toss API 호출 금지. raw prices/symbols 저장 금지.

Engineer 2:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-017_read_only_evidence_receipts_and_operator_report.md
- 브랜치: phase5/p5-017-read-only-evidence-receipts
- 역할: accounts/holdings/future market-prices sanitized receipt evidence pipeline 강화
- 주의: 실제 tmp receipt나 raw payload를 읽거나 커밋하지 마라.

Engineer 3:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-018_phase5_operator_runbook_and_status_visibility.md
- 브랜치: phase5/p5-018-operator-runbook-status-visibility
- 역할: operator runbook/checklist/status visibility 업데이트
- 주의: 로컬 실검증 결과의 raw 값, item count, timestamp, account ref 등은 문서에 넣지 마라.

Engineer 4:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-019_round5_integration_safety_review.md
- 브랜치: phase5/p5-019-round5-integration-safety-review
- 역할: 통합 안전 리뷰와 static safety regression 보강
- 주의: 처음에는 scaffold와 regression gap 확인만 하고, 최종 리뷰는 1~3 병합 후 완성해라.

작업 방식:
- 각 엔지니어는 별도 브랜치 또는 worktree에서 작업해라.
- 각 엔지니어는 자기 작업지시서의 owned files 범위를 지켜라.
- 파일 충돌 가능성이 있으면 멈추고 소유자를 하나로 정해라.
- 각 엔지니어는 작업 후 npm run check를 실행해라.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋해라.

권장 병합 순서:
1. Engineer 1 / P5-016
2. Engineer 2 / P5-017
3. Engineer 3 / P5-018
4. Engineer 4 / P5-019

최종 통합 후 실행:
1. npm run check
2. npm run phase5:toss:readiness
3. npm run phase5:toss:endpoints -- tmp/phase5/toss-read-only-endpoints.local.json
4. npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
5. npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
6. PHASE5_TOSS_READ_ONLY_CALL_APPROVED=true npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json

readiness/preflight/completion은 operator local files 상태에 따라 fail-closed일 수 있다. 이 경우 liveBrokerWriteAllowed:false, rawPayloadStored:false, 예상된 networkCallsPerformed 값이 유지되면 정상으로 보고해라.

최종 보고 형식:
- Engineer 1~4 각각의 branch, 변경 파일, 실행 테스트, safety 확인, blocker
- 최종 병합 commit SHA
- push는 하지 않았다고 명확히 보고
- 통과한 명령어와 fail-closed 명령어의 exit/status/reasonCodes
- 테스트에서 실제 Toss API 호출 없음 확인
- AI가 실제 Toss API를 호출하지 않았음 확인
- liveBrokerWriteAllowed:false 유지 확인
- rawPayloadStored:false 유지 확인
- 남은 수동 단계
```
