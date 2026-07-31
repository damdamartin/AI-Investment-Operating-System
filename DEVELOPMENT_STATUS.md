# AI Investment Operating System - 개발 현황 정리

**업데이트 날짜:** 2026-07-30  
**진행 상황:** Cloudflare Workers 배포 완료 → 대시보드 구현 필요

---

## 🎯 프로젝트 개요

AI 투자 운영 체제로, **Toss Securities API**를 통해 시세 데이터를 수집하고 투자 신호를 생성하는 자동화 파이프라인입니다.

---

## 📁 개발 소스 위치

**프로젝트 디렉토리:**
```
/Users/mac/Documents/Codex/AI-Investment-Operating-System/
```

**주요 파일:**
- `src/workers/trading-cycle-worker.ts` - Cloudflare Worker 메인 로직
- `src/adapters/toss/toss-market-data-provider.ts` - Toss API 연동 (현재 403 에러 해결됨)
- `src/config/pipeline-config.ts` - 설정 관리
- `wrangler.toml` - Cloudflare Worker 설정
- `CLOUDFLARE_WORKER_SETUP.md` - Worker 배포 가이드

---

## 🌐 배포된 사이트/서비스

| 항목 | URL/정보 | 상태 |
|------|---------|------|
| **Cloudflare Worker** | https://ai-investment-trading-cycle-production.junkim-life360.workers.dev | ✅ 배포 완료 |
| **D1 Database** | ID: 9d287512-e226-4d7f-b739-d54098b36e0d | ✅ 연동 완료 |
| **Worker Schedule** | 평일 00:30, 02:00, 06:00 UTC | ✅ 설정 완료 |
| **대시보드** | 위 URL에서 제공되어야 함 | ❌ **미구현** |

---

## 📊 데이터베이스 구조

**D1 테이블:**
```
✅ cycle_runs           - 스케줄 실행 기록
✅ assets              - 감시 자산 (Samsung 005930, SK Hynix 000660)
✅ signals             - 투자 신호 (현재 0개)
✅ order_recommendations - 추천 주문 (현재 0개)
✅ risk_checks         - 리스크 체크 결과
✅ money_checks        - 자금 체크 결과
✅ audit_log           - 감사 로그
```

---

## 🔴 현재 이슈사항

### Issue 1: Toss API 403 Forbidden ✅ 해결됨
**상태:** RESOLVED  
**원인:** GitHub Actions IP + Cloudflare IP가 Toss 포털에서 차단됨  
**해결:** Toss 포털에서 Cloudflare IP 화이트리스트 추가  
**확인:** 다음 평일 자동 실행 후 signals 생성 여부로 확인 예정

### Issue 2: Worker가 HTTP 요청을 처리하지 못함 ⚠️
**상태:** ACTIVE  
**증상:** Worker URL (https://...) 접근 시 error 1101 (Blocked)  
**원인:** Worker가 스케줄된 이벤트(scheduled)만 처리하도록 설계됨  
**필요 조치:** Worker에 HTTP 요청 핸들러(fetch) 추가 필요

### Issue 3: 대시보드 미구현 ⚠️
**상태:** BACKLOG  
**요구사항:**
- [ ] 운영 모드 설정 페이지
- [ ] 계좌 현황 조회
- [ ] 신호/추천사항 실시간 조회
- [ ] 시세 데이터 조회
- [ ] 자동매매 상태 모니터링

### Issue 4: 스케줄 설정 확인 필요 ⚠️
**상태:** PENDING  
**현재 설정:** 평일(월-금) 00:30, 02:00, 06:00 UTC (하루 3회)  
**질문:** 이 설정이 맞는지? 더 자주 실행되어야 하는지?

---

## 📋 현재 자동화 파이프라인 동작

```
[매 스케줄 시간마다]
  ↓
[Cloudflare Worker 실행]
  ↓
[Toss API 시세 데이터 수집]
  ↓
[투자 신호 생성 (signals)]
  ↓
[리스크/자금 체크]
  ↓
[주문 추천사항 생성 (order_recommendations)]
  ↓
[D1 데이터베이스에 저장]
```

**상태:** ✅ 구현 완료, ⏳ 다음 평일 실행 대기

---

## 🔑 환경 변수 (Cloudflare Secrets 설정됨)

```
✅ TOSS_CLIENT_ID
✅ TOSS_CLIENT_SECRET
✅ CLOUDFLARE_ACCOUNT_ID
✅ CLOUDFLARE_D1_DATABASE_ID
✅ CLOUDFLARE_API_TOKEN
✅ PIPELINE_WATCHLIST (Samsung, SK Hynix)
```

---

## 📈 다음 단계 (우선순위)

### 1️⃣ 대시보드 구현 (고) 🚨
**작업:**
- Worker에 HTTP 요청 핸들러 추가 (fetch method)
- HTML/CSS/JavaScript 대시보드 UI 작성
- D1 데이터 조회 API 엔드포인트 구현

**예상 시간:** 2-3시간

### 2️⃣ 스케줄 설정 확인 (중)
**작업:**
- 사용자 요구사항 확인
- 필요시 wrangler.toml 수정
- 재배포

**예상 시간:** 30분

### 3️⃣ 실시간 모니터링 (중)
**작업:**
- 다음 평일 자동 실행 후 signals 데이터 확인
- Toss API 정상 작동 검증
- 로그 분석

**예상 시간:** 실행 후 5분 확인

---

## 🚀 배포 및 관리 명령어

**로컬 빌드:**
```bash
npm run build
```

**Worker 배포:**
```bash
npm run deploy:cloudflare:worker
```

**로그 모니터링:**
```bash
npx wrangler tail --env production
```

**D1 데이터 조회:**
```bash
npx wrangler d1 execute aios-pipeline --remote --command "SELECT * FROM signals;"
```

---

## 📞 핵심 연락처/리소스

| 항목 | 정보 |
|------|------|
| **Cloudflare 대시보드** | https://dash.cloudflare.com/ |
| **Toss API 포털** | https://developer.tossinvest.com/ |
| **GitHub 저장소** | (로컬 개발, git 설정 필요) |
| **D1 데이터베이스** | aios-pipeline (9d287512-e226-4d7f-b739-d54098b36e0d) |

---

## 📝 마지막 커밋/배포 정보

- **마지막 배포:** 2026-07-30 04:33:55 UTC
- **Worker 버전 ID:** 41f53d39-51f0-4bf6-9402-729ec420f604
- **상태:** ✅ 배포 완료, ⏳ 다음 실행 대기

---

**새 창에서 계속 개발할 때 참고하세요!** 🚀
