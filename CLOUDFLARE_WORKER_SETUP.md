# Cloudflare Workers 자동화 설정 가이드

기존 GitHub Actions 대신 **Cloudflare Workers**를 사용하여 자동화 파이프라인을 실행합니다.

## 📋 개요

- **실행**: 평일(월-금) 02:00, 00:30, 06:00 UTC (약 11:00, 09:30, 15:00 KST)
- **플랫폼**: Cloudflare Workers
- **트리거**: Cron (스케줄)
- **데이터베이스**: Cloudflare D1 (이미 설정됨)
- **비용**: 무료 (월 10만 요청까지)

---

## 🚀 단계별 설정

### 1️⃣ wrangler 설치 및 Cloudflare 인증

```bash
# 패키지 설치
npm install

# Cloudflare에 로그인
npx wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 로그인하고 권한을 허용합니다.

---

### 2️⃣ D1 데이터베이스 ID 확인

기존 D1 데이터베이스가 이미 있으므로 ID를 확인합니다:

```bash
# D1 데이터베이스 목록 조회
npx wrangler d1 list
```

출력에서 찾을 내용:
```
┌─────────────────────────────────┬──────────────────────────────────┐
│ name                            │ id                               │
├─────────────────────────────────┼──────────────────────────────────┤
│ your-database-name              │ abc123def456...                  │
└─────────────────────────────────┴──────────────────────────────────┘
```

`wrangler.toml`에서 `database_id` 수정:
```toml
[[env.production.d1_databases]]
  binding = "DB"
  database_id = "YOUR_D1_ID_HERE"  # 위에서 조회한 ID
  preview_database_id = "YOUR_D1_PREVIEW_ID_HERE"  # 있으면 입력
```

---

### 3️⃣ 환경 변수(시크릿) 설정

```bash
# Toss API 자격증명
npm run worker:secret -- TOSS_CLIENT_ID
# 프롬프트: Toss OAuth2 Client ID 입력

npm run worker:secret -- TOSS_CLIENT_SECRET
# 프롬프트: Toss OAuth2 Client Secret 입력

# Cloudflare 자격증명 (기존과 동일)
npm run worker:secret -- CLOUDFLARE_ACCOUNT_ID
npm run worker:secret -- CLOUDFLARE_D1_DATABASE_ID
npm run worker:secret -- CLOUDFLARE_API_TOKEN

# 선택사항: 워치리스트 (기본값: Samsung + SK Hynix)
npm run worker:secret -- PIPELINE_WATCHLIST
# 포맷: "005930:Samsung Electronics:KR:STOCK,000660:SK Hynix:KR:STOCK"

# 선택사항: 킬스위치
npm run worker:secret -- PIPELINE_KILL_SWITCH_ACTIVE
npm run worker:secret -- PIPELINE_KILL_SWITCH_REASON
```

각 명령 후 값을 입력하고 엔터를 누릅니다.

---

### 4️⃣ 로컬에서 테스트 (선택사항)

Worker를 로컬에서 테스트할 수 있습니다:

```bash
# 로컬 개발 서버 시작
npm run worker:dev
```

출력:
```
⛅ wrangler 3.81.0
✨ Compiled in 1.23s.
Ready on http://localhost:8787
```

---

### 5️⃣ 배포

Worker를 Cloudflare에 배포합니다:

```bash
npm run deploy:cloudflare:worker
```

성공 메시지:
```
✨ Successfully published your Worker to
  https://trading-cycle.YOUR_ACCOUNT.workers.dev
```

---

## 📊 배포 후 모니터링

### Cloudflare 대시보드에서 확인

1. https://dash.cloudflare.com/ 방문
2. **Workers** → **ai-investment-trading-cycle** 선택
3. **Logs** 탭에서 실행 로그 확인
4. **Analytics** 탭에서 호출 통계 확인

### 로그 확인 (CLI)

```bash
# 최근 로그 조회
npx wrangler tail --env production

# 특정 환경의 로그
npx wrangler tail --env production --format json
```

---

## 🔄 업데이트

코드를 수정 후 다시 배포:

```bash
npm run build
npm run deploy:cloudflare:worker
```

또는 한 번에:

```bash
npm run deploy:cloudflare:worker
```

---

## 🛠️ 문제 해결

### "D1 데이터베이스를 찾을 수 없음" 에러

```bash
# wrangler.toml에 database_id가 올바른지 확인
npx wrangler d1 list

# 미리보기 데이터베이스도 확인 (있으면 preview_database_id 추가)
```

### "인증 실패" 에러

```bash
# Cloudflare 재인증
npx wrangler login
```

### Toss API 여전히 403 에러

- **원인**: Cloudflare IP도 차단될 수 있음
- **해결**: Toss Securities 포털에서 Cloudflare IP 범위를 화이트리스트에 추가
  - Cloudflare IP 범위: https://www.cloudflare.com/ips/

### Worker 실행 안 됨

```bash
# 로컬 테스트
npm run worker:dev

# 시크릿 확인 (현재 값은 표시 안 됨, 설정만 확인)
npx wrangler secret list --env production
```

---

## 📝 시크릿 재설정

시크릿을 변경해야 할 경우:

```bash
# 시크릿 삭제 후 다시 설정
npx wrangler secret delete TOSS_CLIENT_ID --env production
npm run worker:secret -- TOSS_CLIENT_ID

# 또는 직접 설정
echo "new_value" | npx wrangler secret put TOSS_CLIENT_ID --env production
```

---

## 🔒 보안 고려사항

- ✅ Cloudflare Workers는 자동으로 HTTPS 사용
- ✅ 시크릿은 암호화되어 저장됨
- ✅ Worker 코드는 전체 소스 노출 없음 (컴파일됨)
- ⚠️ Cloudflare API 토큰은 최소 필요 권한만 부여

---

## 📅 스케줄 변경

`wrangler.toml`의 cron 트리거 수정:

```toml
[env.production.triggers.crons]
  # 현재 설정: 평일 02:00, 00:30, 06:00 UTC
  crons = [
    "0 2 * * 1-5",     # Mon-Fri at 02:00 UTC
    "30 0 * * 1-5",    # Mon-Fri at 00:30 UTC
    "0 6 * * 1-5"      # Mon-Fri at 06:00 UTC
  ]

# 변경 후 다시 배포
npm run deploy:cloudflare:worker
```

Cron 포맷: `분 시간 일 월 요일` (UTC)
- 요일: 0=일, 1=월, ..., 5=금, 6=토

---

## ✅ 체크리스트

- [ ] wrangler 설치 완료
- [ ] `npx wrangler login` 실행
- [ ] D1 데이터베이스 ID 확인 (`npx wrangler d1 list`)
- [ ] `wrangler.toml`의 `database_id` 수정
- [ ] 시크릿 6개 설정 (Toss 2개 + Cloudflare 3개 + 선택 1개)
- [ ] `npm run deploy:cloudflare:worker` 실행
- [ ] Cloudflare 대시보드에서 배포 확인
- [ ] 첫 스케줄 실행 후 로그 확인

---

## 📞 다음 단계

1. **배포 후 24시간 대기** - 첫 번째 자동 실행 확인
2. **로그 모니터링** - Cloudflare 대시보드에서 실행 상황 확인
3. **결과 검토** - D1 데이터베이스에 기록된 추천사항 확인

---

**기존 GitHub Actions 워크플로우는 더 이상 필요 없으므로 비활성화 할 수 있습니다.**

```bash
# GitHub Actions 워크플로우 비활성화 (선택사항)
git rm .github/workflows/trading-cycle.yml .github/workflows/check-toss-api.yml
git commit -m "Remove GitHub Actions workflows - replaced with Cloudflare Workers"
git push
```
