# Round 3 Four-Engineer Orchestrator Prompt

Copy this prompt into one Claude Code window. It assumes four coding engineers are available.

```text
로컬 저장소 기준으로 작업해줘.

로컬 저장소 경로:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 5 read-only 검증 준비의 다음 라운드를 4명의 코딩 엔지니어에게 병렬 분배해줘.

중요:
- GitHub 기준으로 시작하지 마라.
- 로컬 저장소 현재 파일을 기준으로 작업해라.
- GitHub push는 하지 마라.
- 실제 Toss API 호출은 하지 마라.
- Phase 5는 읽기 전용 검증 준비까지만 허용한다.

작업 전 확인:
1. cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
2. git status --short --branch
3. 작업트리가 깨끗하지 않으면 작업하지 말고 변경 파일을 보고해라.
4. main이 origin/main과 맞는지 확인해라. 맞지 않으면 작업하지 말고 보고해라.

공통 필수 문서:
- docs/11_AI_RULES.md
- docs/phase5/README.md
- docs/phase5/toss-read-only-call-gate.md
- docs/reviews/Codex_Phase5_Architecture_Review.md

절대 금지:
- Toss 실주문 구현
- Toss 주문취소 구현
- Toss 주문정정 구현
- 이체, 출금, 돈이 이동하는 환전 구현
- production capital 사용
- API 키, 토큰, 계좌번호, raw API 응답, raw request header 요청/출력/커밋
- .env 변경
- 테스트에 실제 네트워크 호출 추가
- fail-closed blocker를 억지로 제거해서 preflight를 통과시키기
- GitHub push

안전 불변식:
- 모든 Phase 5 report는 liveBrokerWriteAllowed:false 를 유지해야 한다.
- no-network 명령은 networkCallsPerformed:false 를 유지해야 한다.
- preflight/completion은 기본 로컬 상태에서 fail-closed일 수 있으며, 이는 정상일 수 있다.

4명에게 다음처럼 분배해라.

Engineer 1:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-008_open_question_evidence_policy.md
- 브랜치: phase5/p5-008-open-question-evidence-policy
- 역할: OQ-001~OQ-004 evidence status policy 정리
- 주의: open question을 resolved로 바꾸지 마라. live trading 승인 금지.

Engineer 2:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-009_read_only_one_call_harness.md
- 브랜치: phase5/p5-009-read-only-one-call-harness
- 역할: no-network one-call readiness harness 구현
- 주의: 실제 HTTP client나 Toss API 호출 구현 금지.

Engineer 3:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-010_phase5_local_runbook_and_operator_checklist.md
- 브랜치: phase5/p5-010-local-runbook-operator-checklist
- 역할: local operator runbook/checklist 정리
- 주의: 실제 credential 예시, raw payload 예시, write endpoint 허용 문구 금지.

Engineer 4:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-011_phase5_readiness_review_and_cleanup.md
- 브랜치: phase5/p5-011-readiness-review-cleanup
- 역할: P5-008~P5-010 결과를 기다렸다가 최종 readiness review와 통합 검증
- 주의: 처음에는 review scaffold와 regression gap 확인만 하고, 최종 보고서는 1~3 병합 후 완성해라.

작업 방식:
- 각 엔지니어는 별도 브랜치 또는 worktree에서 작업해라.
- 각 엔지니어는 자기 작업지시서의 owned files 범위를 지켜라.
- 파일 충돌 가능성이 있으면 멈추고 소유자를 하나로 정해라.
- 각 엔지니어는 작업 후 npm run check를 실행해라.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋해라.

병합 순서:
1. Engineer 1 / P5-008
2. Engineer 2 / P5-009
3. Engineer 3 / P5-010
4. Engineer 4 / P5-011

최종 통합 후 실행:
1. npm run check
2. npm run phase5:toss:endpoints
3. npm run phase5:toss:doctor
4. npm run phase5:toss:preflight
5. npm run phase5:toss:completion

preflight와 completion은 기본 로컬 상태에서 fail-closed일 수 있다. 이 경우 liveBrokerWriteAllowed:false, networkCallsPerformed:false이면 정상으로 보고해라.

최종 보고 형식:
- Engineer 1~4 각각의 branch, 변경 파일, 실행 테스트, safety 확인, blocker
- 최종 병합 commit SHA
- push는 하지 않았다고 명확히 보고
- 통과한 명령어와 fail-closed 명령어의 exit/status
- 실제 Toss API 호출 없음 확인
- liveBrokerWriteAllowed:false 유지 확인
- networkCallsPerformed:false 유지 확인
- 남은 수동 단계
```

