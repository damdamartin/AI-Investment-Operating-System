# 🚀 Claude Code 새 세션 시작 가이드

**작성일**: 2026-07-30  
**상태**: API 설정 완료 → 코드 구현 단계  
**진행 방식**: Claude Code 웹 또는 CLI

---

## 📌 현재 상황 요약

### ✅ 이미 완료된 것
1. **매매원칙 수정** - `docs/11_AI_RULES.md` Rule 1 수정 완료
2. **모든 API Secrets 설정** - Cloudflare Worker에 저장됨
   - KIS_APP_KEY
   - KIS_APP_SECRET
   - KIS_ACCOUNT_NUMBER
   - CLAUDE_API_KEY
   - NAVER_CLIENT_ID
   - NAVER_CLIENT_SECRET

### ⏳ 이제 해야 할 것 (5-6시간)
코드 구현 5가지 단계 + 배포

---

## 🎯 프로젝트 정보

**프로젝트 경로:**
```
/Users/mac/Documents/Codex/AI-Investment-Operating-System
```

**프로젝트 구조:**
```
src/
├── workers/
│   └── trading-cycle-worker.ts (수정 필요)
├── adapters/
│   ├── toss/ (제거 대상)
│   ├── kis/ (신규 생성) ← KIS API 클라이언트
│   ├── claude/ (신규 생성) ← Claude AI 어댑터
│   └── naver/ (신규 생성) ← 네이버 뉴스 어댑터
├── application/
│   └── pipeline/
│       ├── auto-recommendation-orchestrator.ts
│       └── market-data-provider.ts (수정 필요)
└── ...
```

---

## 🔧 5가지 구현 단계

### 1️⃣ 한국투자증권 API 클라이언트 (1시간)

**생성 파일:** `src/adapters/kis/kis-market-data-provider.ts`

**요청:**
```
한국투자증권 Open Trading API를 사용하는 MarketDataProvider 구현:

1. 클래스명: KISMarketDataProvider
2. 인터페이스: MarketDataProvider 구현
3. 기능:
   - KIS Open API REST 호출
   - 실시간 시장 데이터 조회 (실제 데이터, 가짜 데이터 X)
   - OAuth 토큰 관리
   - 한국 주식 + 미국 주식 지원
   - 가격, 거래량, 수익률 데이터 반환

4. 환경변수 사용:
   - KIS_APP_KEY
   - KIS_APP_SECRET
   - KIS_ACCOUNT_NUMBER

5. 반환 타입: MarketDataSnapshot[] (기존과 동일)

6. 에러 처리: 완벽함
```

**확인:**
- ✅ 실제 시장 데이터 조회 (가짜 데이터 사용 금지)
- ✅ 에러 처리 완벽
- ✅ 타입 정의 정확

---

### 2️⃣ Claude AI API 어댑터 (1시간)

**생성 파일:** `src/adapters/claude/claude-ai-adapter.ts`

**요청:**
```
Claude API를 사용하는 시장/뉴스 분석 어댑터:

1. 클래스명: ClaudeAIAdapter
2. 기능:
   - Claude API 호출 (claude-3-5-sonnet-20241022)
   - 뉴스 이벤트 감정 분석 (-1 ~ 1 스코어)
   - 시장 데이터 분석
   - 신호 근거 생성

3. 주요 메서드:
   - analyzeNews(newsText: string): Promise<{sentiment: number, reasoning: string}>
   - analyzeMarketTrend(priceHistory: number[]): Promise<{trend: string, confidence: number}>
   - generateSignalReasoning(marketData, news): Promise<string>

4. 환경변수:
   - CLAUDE_API_KEY

5. 중요: 신호 생성 권한 없음 (분석만)

6. 안전성:
   - 자의적 판단 금지
   - 모든 분석에 이유(reasoning) 포함
```

**확인:**
- ✅ Claude API 정상 연결
- ✅ 토큰 계산 포함
- ✅ 에러 처리 완벽

---

### 3️⃣ 네이버 뉴스 API 어댑터 (1시간)

**생성 파일:** `src/adapters/naver/naver-news-adapter.ts`

**요청:**
```
네이버 뉴스 API를 사용하는 뉴스 수집 어댑터:

1. 클래스명: NaverNewsAdapter
2. 기능:
   - 네이버 뉴스 API 호출
   - 키워드 검색으로 뉴스 수집
   - 뉴스 중복 제거 (같은 기사 필터링)
   - 뉴스 신선도 확인 (1시간 이내)

3. 주요 메서드:
   - searchNews(keywords: string[]): Promise<NewsEvent[]>
   - deduplicateNews(events: NewsEvent[]): Promise<NewsEvent[]>
   - filterByTime(events: NewsEvent[], maxAgeMinutes: number): Promise<NewsEvent[]>

4. 환경변수:
   - NAVER_CLIENT_ID
   - NAVER_CLIENT_SECRET

5. 데이터 구조:
   interface NewsEvent {
     id: string
     title: string
     content: string
     link: string
     source: string
     publishedAt: Date
     relevantAssets?: string[]
   }

6. 처리 규칙:
   - 중복 제거: 같은 기사는 하나만 유지
   - 신선도: 최근 뉴스 우선
   - 필터링: 광고/스팸 제거
```

**확인:**
- ✅ 네이버 API 연결 정상
- ✅ 중복 제거 로직 정상
- ✅ Rate limit 처리

---

### 4️⃣ PlaceholderMarketDataProvider 제거 (30분)

**파일:**
- `src/application/pipeline/market-data-provider.ts`
- `src/workers/trading-cycle-worker.ts`

**요청:**
```
PlaceholderMarketDataProvider 제거 및 KIS로 전환:

1. src/application/pipeline/market-data-provider.ts:
   - PlaceholderMarketDataProvider 클래스 완전 삭제
   - 모든 주석에서 "placeholder" 관련 삭제

2. src/workers/trading-cycle-worker.ts:
   - Toss API 관련 코드 제거
   - PlaceholderMarketDataProvider 제거
   - KISMarketDataProvider 추가:
   
   const marketDataProvider = new KISMarketDataProvider({
     appKey: env.KIS_APP_KEY,
     appSecret: env.KIS_APP_SECRET,
     accountNumber: env.KIS_ACCOUNT_NUMBER
   })

3. import 문 정리:
   - KISMarketDataProvider 추가
   - Toss/Placeholder 제거

4. 확인:
   - 타입 에러 없음
   - 모든 import 가능
```

**확인:**
- ✅ 빌드 가능한 상태
- ✅ 가짜 데이터 완전 제거

---

### 5️⃣ Worker 업데이트 (30분)

**파일:** `src/workers/trading-cycle-worker.ts`

**요청:**
```
Worker 환경변수 및 초기화 코드 업데이트:

1. WorkerEnv 인터페이스에 추가:
   KIS_APP_KEY: string
   KIS_APP_SECRET: string
   KIS_ACCOUNT_NUMBER: string
   CLAUDE_API_KEY: string
   NAVER_CLIENT_ID: string
   NAVER_CLIENT_SECRET: string

2. scheduled() 함수에서:
   - KISMarketDataProvider 인스턴스 생성
   - ClaudeAIAdapter 인스턴스 생성
   - NaverNewsAdapter 인스턴스 생성
   - 파이프라인에 전달

3. 로그 추가:
   - "KIS API 연결 성공" 또는 실패
   - 각 API 상태 체크

4. 에러 처리:
   - 완벽한 try-catch
```

---

## 🚀 빌드 & 배포

터미널에서 실행 (Claude Code 웹의 터미널 이용):

```bash
# 1. 프로젝트 폴더로 이동
cd /Users/mac/Documents/Codex/AI-Investment-Operating-System

# 2. 빌드
npm run build

# 3. 배포 (production 환경)
npx wrangler deploy --env production

# 4. 상태 확인
curl -H "Authorization: Bearer 8b8ea7157834a2811877607bbb478301416402ab4b16e4c5a396690bfe29a580" \
  "https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/api/status"
```

---

## 📋 참고 문서

이미 작성된 가이드 (프로젝트 폴더에 있음):
- `MOBILE_IMPLEMENTATION_GUIDE.md` - 상세한 단계별 가이드
- `DEVELOPMENT_SUMMARY.md` - 프로젝트 전체 현황
- `docs/11_AI_RULES.md` - 매매원칙 (수정 완료)

---

## 🔑 필수 정보 (이미 설정됨)

모두 Cloudflare Secrets에 저장되어 있음. 코드에서는 환경변수명만 사용:

```
한국투자증권:
- KIS_APP_KEY
- KIS_APP_SECRET  
- KIS_ACCOUNT_NUMBER

Claude:
- CLAUDE_API_KEY

네이버:
- NAVER_CLIENT_ID
- NAVER_CLIENT_SECRET
```

---

## ⚠️ 주의사항

### ❌ 절대 금지
- API Key/Secret을 코드에 하드코딩 금지
- git에 credentials 커밋 금지
- PlaceholderMarketDataProvider 남겨두기 금지
- 가짜 데이터 사용 금지

### ✅ 필수 확인
- 모든 파일 TypeScript 작성
- 에러 처리 완벽
- 타입 정의 정확
- import 경로 정확

---

## 🎯 완료 기준

모든 항목이 완료되면:
```
✅ 한국투자증권 API 클라이언트 작동
✅ Claude AI 분석 기능 작동  
✅ 네이버 뉴스 수집 작동
✅ PlaceholderMarketDataProvider 완전 제거
✅ Worker 배포 성공
✅ API /status 응답 정상
✅ cycle_runs 데이터 저장됨
✅ signals 데이터 저장됨
```

---

## 🚀 시작하기

Claude Code에서 다음을 실행하세요:

```
1. 이 파일 읽기 완료
2. MOBILE_IMPLEMENTATION_GUIDE.md도 참고
3. 1단계부터 시작: KIS API 클라이언트 생성
```

첫 번째 요청:
```
"1단계: 한국투자증권 API 클라이언트 구현해줄래?
MOBILE_IMPLEMENTATION_GUIDE.md의 1️⃣ 섹션 참고해서
src/adapters/kis/kis-market-data-provider.ts 만들어줘"
```

---

## 📱 온라인 리소스

**한국투자증권 Open Trading API:**
https://github.com/koreainvestment/open-trading-api

**프로젝트:**
```
/Users/mac/Documents/Codex/AI-Investment-Operating-System
```

---

**준비 완료! 시작하세요! 🚀**

