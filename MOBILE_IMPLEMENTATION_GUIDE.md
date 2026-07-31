# 📱 모바일에서 AI 투자 운영체제 구현 가이드

**날짜**: 2026-07-30  
**상태**: API 설정 완료 → 코드 구현 단계  
**진행 방법**: Claude.ai 또는 Claude Code 웹

---

## 🎯 전체 구현 계획 (5-6시간)

| 순서 | 작업 | 소요시간 | 난도 |
|------|------|---------|------|
| 1️⃣ | 한국투자증권 API 클라이언트 | 1시간 | ★★★ |
| 2️⃣ | Claude AI API 어댑터 | 1시간 | ★★ |
| 3️⃣ | 네이버 뉴스 API 어댑터 | 1시간 | ★★ |
| 4️⃣ | PlaceholderMarketDataProvider 제거 | 30분 | ★ |
| 5️⃣ | Worker 업데이트 | 30분 | ★ |
| 6️⃣ | 빌드 & 배포 | 1시간 | ★ |

---

## 📋 이전 진행 상황 (완료됨)

```
✅ 매매원칙 수정 (docs/11_AI_RULES.md)
✅ 모든 API Secrets 설정 (Cloudflare Worker)
   - KIS_APP_KEY
   - KIS_APP_SECRET
   - KIS_ACCOUNT_NUMBER
   - CLAUDE_API_KEY
   - NAVER_CLIENT_ID
   - NAVER_CLIENT_SECRET
```

---

## 🔧 1️⃣ 한국투자증권 API 클라이언트 (1시간)

### 목표
Toss API 대신 한국투자증권 API 사용

### Claude.ai에서 이렇게 요청하세요

```
다음을 수행해줘:

1. 새 파일 생성: src/adapters/kis/kis-market-data-provider.ts

2. KISMarketDataProvider 클래스 구현:
   - MarketDataProvider 인터페이스 구현
   - KIS Open API를 사용하여 실시간 시장 데이터 조회
   - OAuth 토큰 관리
   - 가격, 거래량, 수익률 데이터 수집
   - 한국 주식 및 미국 주식 모두 지원
   - 에러 처리 및 재시도 로직

3. 사용할 환경변수:
   - KIS_APP_KEY
   - KIS_APP_SECRET
   - KIS_ACCOUNT_NUMBER

4. 반환 타입: MarketDataSnapshot[] (기존과 동일)

기존 PlaceholderMarketDataProvider와 동일한 인터페이스 유지
```

### 확인 사항
- KIS Open API REST 엔드포인트 사용
- 실제 시장 데이터 수집 (가짜 데이터 X)
- 에러 처리 완벽

---

## 🔧 2️⃣ Claude AI API 어댑터 (1시간)

### 목표
Claude API를 사용해 뉴스/시장 데이터 분석

### Claude.ai에서 이렇게 요청하세요

```
다음을 수행해줘:

1. 새 파일 생성: src/adapters/claude/claude-ai-adapter.ts

2. ClaudeAIAdapter 클래스 구현:
   - Claude API 호출 기능
   - 뉴스 이벤트 분석 (긍정/부정/중립)
   - 시장 데이터 분석
   - 신호 생성 지원
   
3. 주요 메서드:
   - analyzeNews(newsText): 감정점수 (-1 ~ 1)
   - analyzeMarketTrend(priceHistory): 상승/하강/횡보
   - generateSignalReasoning(marketData, news): 신호 근거

4. 사용할 환경변수:
   - CLAUDE_API_KEY
   
5. Model: claude-3-5-sonnet-20241022

6. 안전성:
   - 신호 생성 권한 없음 (분석만)
   - 추천은 자의적 판단 금지
   - 모든 분석은 이유(reasoning) 포함

타입스크립트, 완벽한 에러 처리
```

### 확인 사항
- Claude API 연결 정상
- 토큰 계산 포함
- 캐싱 지원 (선택사항)

---

## 🔧 3️⃣ 네이버 뉴스 API 어댑터 (1시간)

### 목표
네이버 뉴스에서 자동으로 뉴스 수집

### Claude.ai에서 이렇게 요청하세요

```
다음을 수행해줘:

1. 새 파일 생성: src/adapters/naver/naver-news-adapter.ts

2. NaverNewsAdapter 클래스 구현:
   - 네이버 뉴스 API 호출
   - 키워드로 뉴스 검색
   - 뉴스 중복 제거 (같은 내용 뉴스 필터링)
   - 뉴스 신선도 확인 (1시간 이내)

3. 주요 메서드:
   - searchNews(keywords: string[]): Promise<NewsEvent[]>
   - deduplicateNews(events): Promise<NewsEvent[]>
   - filterByTime(events, maxAgeMinutes): Promise<NewsEvent[]>

4. 사용할 환경변수:
   - NAVER_CLIENT_ID
   - NAVER_CLIENT_SECRET

5. 데이터 구조:
   interface NewsEvent {
     title: string
     content: string
     link: string
     source: string
     publishedAt: Date
     relevantAssets: string[] // 관련 종목 심볼
   }

6. 처리 규칙:
   - 중복 제거: 같은 기사 다중 출처는 하나만
   - 필터링: 광고/스팸 제거
   - 신선도: 최근 뉴스 우선

타입스크립트, 완벽한 에러 처리
```

### 확인 사항
- 네이버 API 연결 정상
- 뉴스 중복 제거 로직 정상
- Rate limit 처리

---

## 🔧 4️⃣ PlaceholderMarketDataProvider 제거 (30분)

### Claude.ai에서 이렇게 요청하세요

```
다음을 수행해줘:

1. src/application/pipeline/market-data-provider.ts에서:
   - PlaceholderMarketDataProvider 클래스 완전히 삭제
   - 모든 주석에서 "placeholder" 관련 내용 삭제

2. src/workers/trading-cycle-worker.ts에서:
   - TossMarketDataProvider 제거
   - PlaceholderMarketDataProvider 제거
   - KISMarketDataProvider 추가:
   
   ```typescript
   const marketDataProvider = new KISMarketDataProvider({
     appKey: env.KIS_APP_KEY,
     appSecret: env.KIS_APP_SECRET,
     accountNumber: env.KIS_ACCOUNT_NUMBER
   })
   ```

3. import 문 업데이트:
   - KISMarketDataProvider import 추가
   - 불필요한 TossMarketDataProvider, PlaceholderMarketDataProvider import 제거

4. 확인:
   - 모든 import 정상
   - 타입 에러 없음
   - 빌드 가능한 상태
```

---

## 🔧 5️⃣ Worker 업데이트 (30분)

### Claude.ai에서 이렇게 요청하세요

```
src/workers/trading-cycle-worker.ts 업데이트:

1. 환경변수 타입 정의 추가:
   KIS_APP_KEY: string
   KIS_APP_SECRET: string
   KIS_ACCOUNT_NUMBER: string
   CLAUDE_API_KEY: string
   NAVER_CLIENT_ID: string
   NAVER_CLIENT_SECRET: string

2. scheduled() 함수에서:
   - 한국투자증권 provider 인스턴스 생성
   - Claude adapter 인스턴스 생성
   - Naver adapter 인스턴스 생성

3. 파이프라인에 전달:
   - marketDataProvider로 KISMarketDataProvider 사용
   - claudeAdapter, naverAdapter도 전달 (선택사항)

4. 로그 추가:
   - "KIS API 연결 성공" 메시지
   - Claude API 상태
   - 네이버 API 상태

완벽한 에러 처리
```

---

## 🚀 6️⃣ 빌드 & 배포 (1시간)

### Claude Code 웹에서 터미널 실행

```bash
# 1. 빌드
cd /Users/mac/Documents/Codex/AI-Investment-Operating-System
npm run build

# 2. 배포
npx wrangler deploy --env production

# 3. 상태 확인
curl -H "Authorization: Bearer 8b8ea7157834a2811877607bbb478301416402ab4b16e4c5a396690bfe29a580" \
  "https://ai-investment-trading-cycle-production.junkim-life360.workers.dev/api/status"
```

---

## 📱 모바일 작업 흐름

### 방법 A: Claude.ai 웹 (권장)
```
1. safari/chrome에서 claude.ai 열기
2. 새 대화 또는 이 대화 계속
3. 위의 요청 복사-붙여넣기
4. Claude가 코드 생성
5. 코드 검토 후 적용 요청
```

### 방법 B: Claude Code 웹 (고급)
```
1. https://claude.ai/code 접속
2. "Open Project" → 
   /Users/mac/Documents/Codex/AI-Investment-Operating-System
3. 파일 편집 + 터미널 명령어 모두 가능
```

---

## ⚠️ 주의사항

### ❌ 절대 금지
- API Key/Secret을 git에 커밋하지 말 것 (Secrets에 이미 저장됨)
- PlaceholderMarketDataProvider 남겨두지 말 것
- 가짜 데이터 사용 절대 금지

### ✅ 필수 확인
- 모든 파일이 타입스크립트로 작성되는가
- 에러 처리가 있는가
- 환경변수를 정확히 사용하는가

---

## 📞 막혔을 때

**문제**: "API 연결 실패"
→ Secrets이 정상적으로 설정되었는지 확인
→ 환경변수명 철자 확인

**문제**: "타입 에러"
→ MarketDataSnapshot 타입 확인
→ import 문 확인

**문제**: "빌드 실패"
→ 모든 import 가능한지 확인
→ 순환 참조 없는지 확인

---

## 🎯 완료 기준

모든 항목이 완료되면:
```
✅ 한국투자증권 API 클라이언트 작동
✅ Claude AI 분석 기능 작동
✅ 네이버 뉴스 수집 작동
✅ PlaceholderMarketDataProvider 제거
✅ Worker 배포 성공
✅ API /status 응답 정상
```

---

## 🚀 시작하기

모바일에서 이 말을 해주세요:

```
"AIOS 구현을 시작해줄래? 
1단계부터 시작하자: 한국투자증권 API 클라이언트"
```

그러면 바로 첫 번째 파일 생성을 도와드립니다! 💻

