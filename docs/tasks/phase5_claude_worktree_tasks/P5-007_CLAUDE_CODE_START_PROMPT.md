# P5-007 Claude Code Start Prompt

Copy this prompt into one Claude Code window.

```text
로컬 저장소 기준으로 작업해줘.

로컬 저장소 경로:
/Users/mac/Documents/Codex/AI-Investment-Operating-System

목표:
Phase 5 Toss endpoint validation script와 TypeScript validator의 규칙 드리프트를 해소해줘.

가장 먼저 읽을 작업지시서:
docs/tasks/phase5_claude_worktree_tasks/P5-007_toss_endpoint_script_validator_alignment.md

반드시 함께 읽을 문서와 파일:
- docs/11_AI_RULES.md
- docs/phase5/README.md
- docs/phase5/toss-read-only-call-gate.md
- docs/reviews/Codex_Phase5_Architecture_Review.md
- src/application/toss/read-only-endpoint-catalog.ts
- scripts/validate-toss-endpoints.mjs
- tests/application/toss-read-only-endpoint-catalog.test.ts
- tests/scripts/validate-toss-endpoints-script.test.ts

작업 전 확인:
1. cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
2. git status --short --branch
3. 작업트리가 깨끗하지 않으면 작업하지 말고 변경 파일을 보고해라.

브랜치:
phase5/p5-007-toss-endpoint-script-alignment

수정 범위:
- scripts/validate-toss-endpoints.mjs
- tests/scripts/validate-toss-endpoints-script.test.ts
- 필요할 경우에만 src/application/toss/read-only-endpoint-catalog.ts
- 필요할 경우에만 tests/application/toss-read-only-endpoint-catalog.test.ts
- 필요할 경우에만 docs/phase5/toss-read-only-endpoints.example.json

구현 요구:
- CLI script가 TypeScript TossReadOnlyEndpointCatalogValidator와 같은 read-only safety 규칙을 적용하게 해라.
- invalid method, missing operation, missing source evidence, operation/evidence mismatch, hard mutation path, unsafe order/fill path를 script-level test로 검증해라.
- verified order-status/fill read path와 matching evidence가 있는 경우만 허용되는 테스트도 추가해라.
- output에는 항상 liveBrokerWriteAllowed: false 를 유지해라.

절대 금지:
- Toss API 호출
- 실제 네트워크 호출 추가
- Toss 주문 생성/취소/정정 구현
- 이체/출금/돈이 이동하는 환전 구현
- API 키, 토큰, 계좌번호, raw API 응답, raw request header 요청/출력/커밋
- .env 변경
- TypeScript validator를 약화해서 script와 맞추기

검증:
1. npm run check
2. npm run phase5:toss:endpoints
3. 가능하면 npm run phase5:toss:doctor
4. 가능하면 npm run phase5:toss:preflight

preflight는 기본 로컬 상태에서 fail-closed일 수 있다. 이 경우 liveBrokerWriteAllowed:false, networkCallsPerformed:false이면 정상으로 보고해라.

최종 보고:
- 브랜치명
- 변경 파일
- 실행한 테스트와 결과
- liveBrokerWriteAllowed:false 유지 여부
- network call 추가 없음 여부
- Toss write endpoint/write HTTP client 구현 없음 여부
- 남은 blocker

GitHub push는 하지 마라.
```

