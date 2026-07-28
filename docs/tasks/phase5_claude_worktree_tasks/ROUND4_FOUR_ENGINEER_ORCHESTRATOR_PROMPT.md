# Round 4 Four-Engineer Orchestrator Prompt

Copy this prompt into one Claude Code window. It assumes four coding engineers are available and the orchestrator can split work internally.

```text
로컬 저장소 기준으로 작업해줘.

로컬 저장소 경로:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 5의 다음 단계인 “첫 실제 Toss read-only 검증 호출을 안전하게 기록할 수 있는 개발”을 4명의 코딩 엔지니어에게 병렬 분배해줘.

현재 상태:
- Toss `.env` 로컬 준비와 `TOSS_ACCOUNT_REF` 조회는 완료된 상태일 수 있다.
- `npm run phase5:toss:readiness`가 operator machine에서는 `ready:true`일 수 있다.
- 그러나 open-question evidence, sanitized manifest, verified endpoint approval, preflight/completion은 아직 남아 있다.
- GitHub push는 하지 마라. 로컬 브랜치/커밋까지만 해라.

작업 전 확인:
1. cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
2. git status --short --branch
3. 작업트리가 깨끗하지 않으면 작업하지 말고 변경 파일을 보고해라.
4. main이 origin/main과 다를 수 있다. 로컬 main의 최신 커밋을 기준으로 시작하되, push는 하지 마라.

공통 필수 문서:
- docs/11_AI_RULES.md
- docs/phase5/README.md
- docs/phase5/local-toss-read-only-runbook.md
- docs/phase5/toss-read-only-call-gate.md
- docs/phase5/toss-official-api-source-notes.md
- docs/reviews/Codex_Phase5_Architecture_Review.md
- docs/reviews/Codex_Phase5_Readiness_Review.md

절대 금지:
- Toss 실주문 구현
- Toss 주문취소 구현
- Toss 주문정정 구현
- 이체, 출금, 돈이 이동하는 환전 구현
- production capital 사용
- API 키, 토큰, 계좌번호, raw API 응답, raw request header 요청/출력/커밋
- .env 읽기/출력/커밋
- GitHub push
- preflight/completion 안전장치를 약화해서 억지로 통과시키기
- 실제 Toss API 호출을 테스트에 넣기

허용:
- mock 서버 기반 테스트
- operator가 명시적으로 승인한 경우에만 실행되는 real read-only runner 개발
- 실제 runner는 기본 상태에서 fail-closed
- 실제 네트워크 가능 스크립트는 출력이 sanitized이고 approval gate가 있어야 함

안전 불변식:
- 모든 Phase 5 report는 liveBrokerWriteAllowed:false 를 유지해야 한다.
- no-network 명령은 networkCallsPerformed:false 를 유지해야 한다.
- real read-only runner만 approval 후 networkCallsPerformed:true가 가능하다.
- rawPayloadStored:false 를 유지해야 한다.
- 주문/취소/정정/이체/환전 경로는 코드에 추가하지 않는다.

4명에게 다음처럼 분배해라.

Engineer 1:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-012_toss_read_only_http_client.md
- 브랜치: phase5/p5-012-toss-read-only-http-client
- 역할: Toss read-only HTTP client 구현
- 주의: tests는 mock 서버만 사용. 실제 Toss API 호출 금지. 주문/write 경로 금지.

Engineer 2:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-013_first_read_only_verification_runner.md
- 브랜치: phase5/p5-013-first-read-only-verification-runner
- 역할: human-approved one-call read-only verification runner 구현
- 주의: P5-012 client를 기다리거나 interface만 맞춰라. approval 없으면 network call 금지.

Engineer 3:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-014_sanitized_evidence_pipeline.md
- 브랜치: phase5/p5-014-sanitized-evidence-pipeline
- 역할: sanitized evidence intake/manifest/open-question pipeline 강화
- 주의: raw payload, token, account number, request header, real response fixture 금지.

Engineer 4:
- 작업지시서: docs/tasks/phase5_claude_worktree_tasks/P5-015_phase5_read_only_integration_review.md
- 브랜치: phase5/p5-015-read-only-integration-review
- 역할: P5-012~P5-014 통합 리뷰와 최종 operator handoff 작성
- 주의: 처음에는 review scaffold와 regression gap 확인만 하고, 최종 보고서는 1~3 병합 후 완성해라.

작업 방식:
- 각 엔지니어는 별도 브랜치 또는 worktree에서 작업해라.
- 각 엔지니어는 자기 작업지시서의 owned files 범위를 지켜라.
- 파일 충돌 가능성이 있으면 멈추고 소유자를 하나로 정해라.
- 각 엔지니어는 작업 후 npm run check를 실행해라.
- 각 엔지니어는 자기 브랜치에만 로컬 커밋해라.

권장 병합 순서:
1. Engineer 1 / P5-012
2. Engineer 3 / P5-014
3. Engineer 2 / P5-013
4. Engineer 4 / P5-015

최종 통합 후 실행:
1. npm run check
2. npm run phase5:toss:readiness
3. npm run phase5:toss:endpoints -- tmp/phase5/toss-read-only-endpoints.local.json
4. npm run phase5:toss:doctor -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
5. npm run phase5:toss:preflight -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json
6. npm run phase5:toss:completion -- tmp/phase5/toss-read-only-endpoints.local.json tmp/phase5/evidence-manifest.local.json tmp/phase5/evidence-intake.local.json

preflight와 completion은 evidence/approval이 아직 완성되지 않았으면 fail-closed일 수 있다. 이 경우 liveBrokerWriteAllowed:false, networkCallsPerformed:false이면 정상으로 보고해라.

최종 보고 형식:
- Engineer 1~4 각각의 branch, 변경 파일, 실행 테스트, safety 확인, blocker
- 최종 병합 commit SHA
- push는 하지 않았다고 명확히 보고
- 통과한 명령어와 fail-closed 명령어의 exit/status
- 테스트에서 실제 Toss API 호출 없음 확인
- 실제 네트워크 가능 runner가 approval gate 뒤에만 있는지 확인
- liveBrokerWriteAllowed:false 유지 확인
- rawPayloadStored:false 유지 확인
- 남은 수동 단계
```

