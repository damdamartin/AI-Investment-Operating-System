# AI 투자 운영체제 - 개발 현황 정리

**최종 업데이트**: 2026-07-30

---

## 📁 프로젝트 위치

```
/Users/mac/Documents/Codex/AI-Investment-Operating-System
```

---

## 🔑 중요 인증정보 & 환경변수

### Toss 증권 API
```
TOSS_CLIENT_ID: tsck_live_xOGg7QZbI1Im34ldMpal9D
TOSS_CLIENT_SECRET: tssk_live_L33b3zbjbfYaLBxlqnvYVpG9QWJtIetvkeJ4ZmK6cctA
```

### Cloudflare
```
CLOUDFLARE_ACCOUNT_ID: 87b29e119026eda88a305476a9c28adb
CLOUDFLARE_D1_DATABASE_ID: 9d287512-e226-4d7f-b739-d54098b36e0d
D1 Database Name: aios-pipeline
```

### 대시보드 인증
```
API 토큰: 8b8ea7157834a2811877607bbb478301416402ab4b16e4c5a396690bfe29a580
토큰 저장 위치: Cloudflare Worker Secret (DASHBOARD_API_TOKEN)
```

---

## 🗄️ 데이터베이스 (D1)

### 테이블 구조

#### 1. 기본 테이블 (0001_core_schema.sql)
- `assets` - 주식/ETF 자산 정보
- `broker_accounts` - 증권사 계정
- `portfolios` - 포트폴리오
- `strategies` - 투자 전략
- `signals` - 매매 신호

#### 2. 대시보드 테이블 (0004_dashboard_schema.sql)
```sql
-- 운영 설정
dashboard_settings
├─ portfolio_id
├─ trading_mode (AGGRESSIVE/STABLE/CONSERVATIVE)
├─ emergency_action (NONE/STOP/SELL_ALL/SELL_HALF)
└─ cash_target_amount

-- 시스템 상태
system_status
├─ portfolio_id
├─ status_light (GREEN/YELLOW/RED)
├─ status_message
├─ toss_api_health
├─ claude_api_health
├─ database_health
└─ last_check_at

-- 포트폴리오 스냅샷 (일일)
portfolio_daily_snapshot
├─ portfolio_id
├─ snapshot_date
├─ total_value
├─ cash_balance
├─ invested_value
├─ daily_return
└─ cumulative_return

-- 거래 로그
trading_actions_log
├─ action_type (BUY/SELL/STOP/MODE_CHANGE)
├─ action_details (JSON)
└─ executed_at
```

---

## 🔗 API 엔드포인트

**Base URL**: `https://ai-investment-trading-cycle-production.junkim-life360.workers.dev`

### 공개 (인증 불필요)
```
GET  /dashboard         → 대시보드 HTML 페이지
```

### 보호됨 (Authorization: Bearer {TOKEN} 필요)
```
GET  /api/status        → 시스템 상태 조회
GET  /api/mode          → 현재 운영 모드 조회
POST /api/mode          → 운영 모드 변경
POST /api/action        → 응급 조치 실행
GET  /api/portfolio     → 포트폴리오 데이터 (30일)
GET  /api/settings      → 연동 상태 조회
POST /api/cash-target   → 현금 목표 설정
```

**요청 예시**:
```bash
curl -H "Authorization: Bearer 8b8ea7157834a2811877607bbb478301416402ab4b16e4c5a396690bfe29a580" \
  "https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/api/status"
```

---

## 📂 주요 소스 파일 경로

### Worker (메인 엔트리포인트)
```
src/workers/trading-cycle-worker.ts
├─ fetch()           → HTTP 요청 처리 (대시보드 + API)
├─ scheduled()       → 정기 실행 (주중 3회: 00:30, 02:00, 06:00 UTC)
└─ getDashboardHTML() → 대시보드 HTML 생성
```

### 설정 파일
```
wrangler.toml                     → Cloudflare Worker 설정
├─ main: src/workers/trading-cycle-worker.ts
├─ D1 Database Binding: DB
└─ Environment Variables:
    - ENVIRONMENT: production
    - CLOUDFLARE_ACCOUNT_ID
    - CLOUDFLARE_D1_DATABASE_ID
```

### 마이그레이션 (DB 스키마)
```
migrations/
├─ 0001_core_schema.sql          → 기본 테이블
├─ 0002_historical_data_schema.sql → 히스토리
├─ 0003_outbox_events_schema.sql  → 이벤트
└─ 0004_dashboard_schema.sql     → 대시보드 테이블 (신규)
```

### 비즈니스 로직
```
src/application/
├─ pipeline/                      → 추천 파이프라인
├─ ai/                           → Claude API 통합
├─ toss/                         → Toss API 통합
├─ risk-engine/                  → 리스크 관리
└─ ...기타 도메인들
```

---

## 🎨 대시보드 구조

### HTML 생성 (src/workers/trading-cycle-worker.ts)
```javascript
getDashboardHTML() → 단일 HTML 파일 반환
├─ 로그인 화면 (토큰 입력)
├─ 운영 모드 선택
├─ 응급 조치 버튼
├─ 포트폴리오 그래프
├─ 현금 확보 설정
└─ 연동 상태 표시
```

### 기술 스택
- **프론트엔드**: HTML + CSS + Chart.js
- **백엔드**: Cloudflare Worker (TypeScript)
- **DB**: SQLite (D1)
- **인증**: Bearer Token (localStorage)
- **배포**: Cloudflare Pages/Workers

---

## 🚀 배포 정보

### Worker 배포
```bash
cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
npx wrangler deploy --env production
```

### Worker URL
```
https://ai-investment-trading-cycle-production.junkim-life360.workers.dev
```

### 현재 배포 상태
- ✅ Worker 배포됨
- ✅ D1 데이터베이스 생성됨
- ✅ 환경 변수 설정됨
- ✅ 모든 마이그레이션 적용됨

---

## 📋 현재 완성 기능

### 1️⃣ 대시보드
- ✅ 신호등 (상태 표시)
- ✅ 운영 모드 선택 (공격적/안정적/보수적)
- ✅ 응급 조치 (운영멈춤/전량매도/일부매도)
- ✅ 포트폴리오 그래프 (수익률/잔고)
- ✅ 현금 확보 설정
- ✅ 연동 상태 표시

### 2️⃣ 보안
- ✅ API 토큰 인증
- ✅ localStorage 토큰 저장
- ✅ 자동 로그아웃 (401 응답 시)

### 3️⃣ 반응형 디자인
- ✅ 데스크톱 최적화
- ✅ 모바일 최적화
- ✅ 모든 기기 지원

### 4️⃣ Toss 증권 연동
- ✅ 인증정보 설정
- ✅ API 상태 표시

---

## 🔄 자동 실행 스케줄

### Cron 설정 (평일만)
```
00:30 UTC (09:30 KST) - 아침 장 전
02:00 UTC (11:00 KST) - 오전 장 중
06:00 UTC (15:00 KST) - 종장 후
```

**동작**: `src/workers/trading-cycle-worker.ts` → `runAutoRecommendationCycle()`

---

## 🎯 다음 개발 사항

### 우선순위 1️⃣ (즉시 필요)
- [ ] DB에 샘플 포트폴리오 데이터 추가
- [ ] system_status 테이블에 초기값 insert
- [ ] dashboard_settings 테이블에 기본값 설정

### 우선순위 2️⃣ (1주 내)
- [ ] Toss API로 실시간 거래 데이터 조회
- [ ] 포트폴리오 일일 스냅샷 자동 생성
- [ ] 운영 모드별 매매 로직 구현

### 우선순위 3️⃣ (2주 내)
- [ ] 응급 조치 액션 실행 (Toss API 통합)
- [ ] 현금 확보 자동 매도
- [ ] 알림 기능 (Discord/Slack)

### 우선순위 4️⃣ (나중에)
- [ ] 다크모드
- [ ] 성과 분석 리포트
- [ ] 포트폴리오 백테스트 연동

---

## 💡 개발 팁

### Claude.ai에서 빠른 개발
1. **API 테스트**: curl 명령어 복사해서 시도
2. **DB 쿼리**: SQLite 문법 사용 (PostgreSQL X)
3. **Worker 수정**: 
   ```bash
   npm run build
   npx wrangler deploy --env production
   ```
4. **대시보드 테스트**: 브라우저에서 토큰 입력 후 확인

### 자주 쓸 명령어
```bash
# 빌드
npm run build

# 배포
npx wrangler deploy --env production

# 환경 변수 설정
echo "VALUE" | npx wrangler secret put KEY_NAME --env production

# D1 쿼리 실행
npx wrangler d1 execute aios-pipeline --remote --file query.sql

# API 테스트
curl -H "Authorization: Bearer 8b8ea7157834a2811877607bbb478301416402ab4b16e4c5a396690bfe29a580" \
  "https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/api/status"
```

---

## 🔗 빠른 링크

| 항목 | 링크/경로 |
|------|---------|
| **프로젝트** | `/Users/mac/Documents/Codex/AI-Investment-Operating-System` |
| **대시보드** | `https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/dashboard` |
| **API 기본 URL** | `https://ai-investment-trading-cycle-production.junkim-life360.workers.dev` |
| **Worker 코드** | `src/workers/trading-cycle-worker.ts` |
| **마이그레이션** | `migrations/` |
| **개발 상태** | `DEVELOPMENT_STATUS.md` |

---

## ⚠️ 중요 주의사항

1. **인증정보 보관**: 토큰과 API KEY는 절대 공개하지 말 것
2. **DB 백업**: D1은 자동 백업되지 않으니 중요 데이터는 별도 저장
3. **Rate Limit**: Toss API는 시간당 요청 제한 있음 (확인 필요)
4. **환경 변수**: 새 머신에서 개발할 때는 `wrangler secret put`으로 다시 설정해야 함
5. **배포 확인**: 배포 후 15초 정도 후에 변경사항 적용됨

---

이 정보를 Claude.ai에서 참고하면서 개발하면 됩니다! 🚀
