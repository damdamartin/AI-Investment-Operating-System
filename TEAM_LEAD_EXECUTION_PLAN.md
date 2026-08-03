# 🏆 팀장의 실행 계획
## AI 자동매매 시스템 - 완전한 작동까지의 구체적인 단계

**작성일**: 2026-08-02  
**목표**: 주식 관련 거래가 AI 시스템으로 스스로 작동하고 유의미한 성과를 낼 수 있을 때까지

---

## ✅ **Phase 1: 코드 통합 완료** (완료)

### 팀장이 수행한 개선사항

#### 1️⃣ 팀원1 개선 (리서치+분석팀)
```
✅ research_agent.py 개선
  - 데이터 소스 통합 (NewsDataSource)
  - API 래퍼 통합 (rate limiting, 재시도)
  - 비동기 처리 지원

✅ analysis_agent.py 개선
  - 현재가 자동 조회 (data_source에서)
  - 기술지표 자동 조회 (data_source에서)
  - 재무데이터 자동 조회 (data_source에서)
  - API 안정성 강화
```

#### 2️⃣ 팀원2 개선 (전략+리스트관리팀)
```
✅ strategy_agent.py 개선
  - 현재가 자동 조회
  - API 래퍼 통합
  - 비동기 처리 지원

✅ watchlist_manager.py 개선
  - API 래퍼 통합
  - 비동기 처리 지원
  - 에러 처리 강화
```

#### 3️⃣ 팀원3 개선 (주문실행+모니터링)
```
✅ realtime_monitor.py 개선
  - 데이터 소스 자동 연동
  - price_feed 자동 설정
```

#### 4️⃣ 팀장이 새로 추가한 모듈
```
✅ data_source_manager.py (NEW)
  - 모든 팀이 공유하는 중앙 데이터 소스
  - NewsDataSource, TechnicalIndicatorSource, FinancialDataSource
  - RealtimePriceFeed

✅ api_cost_manager.py (NEW)
  - RateLimiter: API 요청 비율 제한
  - TokenCounter: 토큰 사용량 추적
  - APIErrorHandler: 에러 처리 및 재시도
  - APICallWrapper: 안전한 호출 래퍼

✅ orchestrator_improved.py (NEW)
  - 모든 팀을 제대로 조율하는 Orchestrator
  - asyncio.gather()로 병렬 처리
  - 완전한 신호 흐름 통합
  - 성과 평가 통합
```

---

## 🎯 **Phase 2: 실제 API 연동** (지금 시작)

### Step 1: KIS API 연동 검증 (2-3일)

```python
# 1. KIS 클라이언트가 orchestrator에 주입되었는지 확인
kis_client = KISClient(api_key="...", account_id="...")
orchestrator = ImprovedAIOrchestrator(kis_client=kis_client)

# 2. 현재가 조회 테스트
price = await orchestrator.data_source.price_feed.get_price("005930")
print(f"삼성전자 현재가: {price}원")

# 3. 주문 실행 테스트
result = await orchestrator.order_engine.execute_order(
    symbol="005930",
    symbol_name="Samsung",
    market="KR",
    order_type="BUY",
    quantity=1,
    price=70000,
    stop_loss_price=68600,
    take_profit_price=72100
)
```

**체크리스트**:
- [ ] KIS API 키 환경변수 설정
- [ ] 현재가 조회 성공
- [ ] 주문 실행 성공 (실제 거래)
- [ ] 손절/익절 주문 설정 성공

### Step 2: 뉴스 데이터 API 연동 (2-3일)

```python
# 1. 뉴스 API 선택 및 구현
# 옵션:
#   - 금융감시위 공시 API (한국 주식 공시)
#   - 네이버 뉴스 API
#   - 한경 API
#   - 카카오 뉴스 API

# 2. NewsDataSource.get_recent_news() 구현
recent_news = await orchestrator.data_source.news.get_recent_news("005930")
print(recent_news)  # [뉴스 리스트]

# 3. 리서치팀 신호 검증
signal = await orchestrator.research_agent.analyze_symbol("005930", "Samsung")
print(signal)  # {'signal': 'BUY', 'confidence': 0.8, ...}
```

**체크리스트**:
- [ ] 뉴스 API 선정 및 키 발급
- [ ] NewsDataSource 구현
- [ ] 뉴스 조회 성공
- [ ] 리서치팀 신호 생성 성공

### Step 3: 기술지표 데이터 연동 (2-3일)

```python
# 1. KIS API에서 기술지표 조회
indicators = await orchestrator.data_source.indicators.get_indicators("005930")
print(indicators)  # {'RSI_14': 65, 'MACD': {...}, ...}

# 2. 분석팀 신호 검증
signal = await orchestrator.analysis_agent.analyze_symbol("005930", "Samsung")
print(signal)  # {'signal': 'BUY', 'confidence': 0.75, ...}

# 3. 통합 신호 검증
strategy = await orchestrator.strategy_agent.generate_trade_plan(
    symbol="005930",
    symbol_name="Samsung",
    market="KR",
    research_signal={'signal': 'BUY'},
    analysis_signal={'signal': 'BUY'},
    portfolio_value=1000000
)
print(strategy)  # {'action': 'BUY', 'quantity': 10, ...}
```

**체크리스트**:
- [ ] KIS API 기술지표 조회 성공
- [ ] 분석팀 신호 생성 성공
- [ ] 전략팀 의사결정 성공

---

## 📊 **Phase 3: 종이 거래 (모의거래)** (1주)

### 목표
실제 거래는 하지 않고, 신호 생성과 시뮬레이션만 진행해서 정확도 검증

### 실행 방법

```python
# 1주일간 매일 오전 9:00에 사이클 실행
# 신호는 생성하지만, 실제 주문은 보내지 않음

async def paper_trading():
    watchlist = [
        {"code": "005930", "name": "Samsung", "market": "KR"},
        {"code": "000660", "name": "SK Hynix", "market": "KR"},
        {"code": "051910", "name": "LG Chemistry", "market": "KR"},
    ]

    # 매일 실행
    for day in range(7):
        print(f"\n[Day {day+1}] 종이 거래 시작")

        # 신호 생성
        result = await orchestrator.run_trading_cycle(watchlist)

        # 결과 기록
        trade_log.append({
            "date": datetime.now().date(),
            "signals": result["final_signals"],
            "executed": result["executed_trades"],
            "performance": result["performance"]
        })

        print(f"신호: {len(result['final_signals'])}, 거래: {len(result['executed_trades'])}")

        # 다음날까지 대기
        await asyncio.sleep(86400)  # 24시간

    # 1주 성과 분석
    analyze_paper_trading_results(trade_log)
```

**성과 지표**:
- 신호 정확도: 신호 방향 vs 실제 가격 변동
- 거래 성공률: BUY 신호 후 익절 도달 %
- 평균 수익률: 신호당 평균 수익 %
- 신호 신뢰도: 각 팀의 신뢰도 vs 실제 정확도

**체크리스트**:
- [ ] 1주일 종이 거래 완료
- [ ] 신호 정확도 > 60% 달성
- [ ] 거래 성공률 > 50% 달성
- [ ] 프롬프트 개선 방안 도출

---

## 💰 **Phase 4: 소액 실거래 시작** (2주)

### 목표
실제 자금을 투입해서 수익 생성 검증

### 초기 자금 설정

```
총 포트폴리오: ₩1,000,000
├─ KIS (한국주식): ₩300,000
├─ Toss (미국주식): ₩300,000
├─ Upbit (암호화폐): ₩300,000
└─ 예비 자금: ₩100,000
```

### 거래 규칙

```
1주차: 테스트 거래
  - 강한 신호(신뢰도 > 80%)만 거래
  - 최소 거래액 (1주 200-400만원)
  - 손절: -2%, 익절: +3%

2주차: 정상 거래
  - 신뢰도 > 70% 신호 거래
  - 일일 최대 손실: -1%
  - 월 목표: +3~5%
```

### 성과 추적

```python
# 매일 성과 리포트
daily_report = {
    "date": today,
    "trades": len(executed_trades),
    "winning_trades": len([t for t in executed_trades if t['pnl'] > 0]),
    "win_rate": winning_trades / total_trades,
    "total_pnl": sum(t['pnl'] for t in executed_trades),
    "portfolio_value": calculate_portfolio_value(),
    "daily_return": daily_pnl / prev_portfolio_value
}

# 누적 성과
monthly_stats = {
    "total_return": (portfolio_value - initial_value) / initial_value,
    "avg_daily_return": sum(daily_returns) / len(daily_returns),
    "best_day": max(daily_returns),
    "worst_day": min(daily_returns),
    "max_drawdown": calculate_max_drawdown(),
    "sharpe_ratio": calculate_sharpe_ratio()
}
```

**체크리스트**:
- [ ] 1주차 테스트 거래 완료 (손절/익절 작동 검증)
- [ ] 2주차 정상 거래 시작
- [ ] 주간 수익률 > 0% 달성
- [ ] 월 수익률 > 1% 달성

---

## 🎯 **Phase 5: 최적화 및 확대** (지속)

### 신호 정확도 개선
```
1. 팀별 정확도 분석
   - 리서치팀: 뉴스 감정 분석 정확도
   - 분석팀: 기술지표 신뢰도
   - 전략팀: 진입/손절/익절 정확도

2. 프롬프트 개선
   - 정확도 < 60%인 팀의 프롬프트 개선
   - 정확도 > 75%인 팀의 가중치 증가

3. 가중치 동적 조정
   - 주 1회 성과평가에 따라 가중치 조정
   - 우수 팀의 신호에 더 높은 가중치
```

### 거래 규모 확대
```
월 성과별 자금 추가:
- 월 +3~5%: 자금 10% 추가 (₩1M → ₩1.1M)
- 월 +5% 이상: 자금 20% 추가
- 월 -2% 이하: 자금 10% 감소

최종 목표: 연 +50~100% (월평 +4~8%)
```

---

## 📋 **팀장의 일일 체크리스트**

### 매일 오전 9:00 (거래 시작 전)
```
□ 시스템 상태 확인
  - Orchestrator 정상 작동?
  - API 연결 상태?
  - 데이터 소스 정상?

□ 신호 생성 테스트
  - 리서치팀 신호 생성?
  - 분석팀 신호 생성?
  - 전략팀 의사결정?

□ 위험 요소 점검
  - 포트폴리오 드로다운 < 5%?
  - 일일 손실 한도 내?
  - 현금 보유 충분?

□ 거래 실행 승인
  - 신호가 명확한가?
  - 리스크가 관리 가능한가?
  - 실행하기?
```

### 매일 오후 4:00 (거래 종료 후)
```
□ 거래 결과 분석
  - 몇 건이 거래됐는가?
  - 성공률은?
  - 수익/손실은?

□ 신호 정확도 추적
  - 리서치팀 정확도: ?%
  - 분석팀 정확도: ?%
  - 전략팀 정확도: ?%

□ 손절/익절 실행 확인
  - 자동 손절 작동?
  - 자동 익절 작동?
  - 포지션 종료됐나?

□ 에러/이슈 로깅
  - API 오류는 없었나?
  - 신호 생성 실패?
  - 주문 실행 실패?
```

### 매주 금요일 (주간 평가)
```
□ 주간 성과 분석
  - 총 거래: ?건
  - 승률: ?%
  - 수익률: ?%
  - 최대 드로다운: ?%

□ 팀별 성과 평가
  - 리서치팀: 신뢰도 변화?
  - 분석팀: 신호 정확도?
  - 전략팀: 의사결정 질?

□ 프롬프트 개선
  - 어떤 팀이 개선 필요?
  - 프롬프트 변경 사항?
  - 가중치 조정?

□ 다음주 계획
  - 목표 수익률?
  - 테스트 항목?
  - 위험 조정?
```

### 매월 말일 (월간 평가)
```
□ 월간 성과 보고서
  - 총 수익률: ?%
  - 거래 건수: ?
  - 최대 수익/손실: ?
  - Sharpe Ratio: ?

□ 시스템 개선사항
  - 어떤 부분을 개선했나?
  - 개선 후 성과 변화?
  - 다음달 개선 과제?

□ 팀별 기여도 분석
  - 리서치팀 기여도: ?%
  - 분석팀 기여도: ?%
  - 전략팀 기여도: ?%
  - 가중치 조정 필요?

□ 자금 관리
  - 포트폴리오 성장: ?%
  - 손실률: 관리 범위 내?
  - 차월 자금 규모?
```

---

## 🚨 **팀장이 주의할 사항**

### 1. 실제 거래의 위험성
```
⚠️ 손실 가능성
- 시스템 오류로 손실 발생 가능
- AI 신호가 틀릴 수 있음
- 시장 급변에 대응 못할 수 있음

✅ 대응 방안
- 초기 자금 최소화 (₩300K~500K)
- 종이 거래 충분히 실행 (1-2주)
- 손절 자동화 100% 검증
- 일일 손실 한도 설정 (1%)
- 매주 성과 평가 및 조정
```

### 2. API 비용 관리
```
⚠️ 예상 비용
- Claude API: 월 ~₩500,000
- KIS API: 월 ~₩100,000
- 기타 API: 월 ~₩100,000
- 총 월 ~₩700,000

✅ 최적화
- API 토큰 제한 설정
- 캐싱으로 중복 호출 방지
- 배치 처리로 효율화
- 월 예산 초과 알림 설정
```

### 3. 시스템 장애 대응
```
⚠️ 가능한 장애
- API 연결 끊김
- 데이터 소스 실패
- 주문 실행 실패
- 신호 생성 오류

✅ 대응 계획
- 자동 재시도 로직 (exponential backoff)
- Fallback 데이터 소스
- 에러 로깅 및 알림
- 긴급 중지 버튼 (모든 포지션 청산)
```

---

## ✨ **최종 목표**

### 3개월 후
- ✅ 자동 거래 시스템 정상 작동
- ✅ 월 수익률 +3~5% 달성
- ✅ 신호 정확도 > 70%
- ✅ 포트폴리오 ₩1M → ₩1.3M

### 6개월 후
- ✅ 자동 거래 시스템 완전 자율화
- ✅ 월 수익률 +5~7% 달성
- ✅ 신호 정확도 > 75%
- ✅ 포트폴리오 ₩1M → ₩1.8M

### 12개월 후
- ✅ 자동 거래 시스템 성숙화
- ✅ 월 수익률 +4~6% 달성 (안정화)
- ✅ 신호 정확도 > 80%
- ✅ 포트폴리오 ₩1M → ₩2.5M 이상

---

**팀장의 다짐**: 이제부터 매일 이 체크리스트를 실행하고, 시스템이 유의미한 성과를 낼 때까지 끝까지 책임지겠습니다! 🏆

