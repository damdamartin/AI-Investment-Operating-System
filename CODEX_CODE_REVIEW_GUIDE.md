# 🔍 Codex 코드 리뷰 가이드

**작성일**: 2026-08-12  
**리뷰 목표**: Toss 미국주식 자동매매 시스템 코드 품질 검증  
**브랜치**: `team3/task3-4-test-automation`

---

## 📍 1. 개발 소스 위치

### 주요 디렉토리 구조
```
/Users/mac/Documents/Codex/AI-Investment-Operating-System/
├── src/pyqqq/                          ← 핵심 자동매매 엔진
│   ├── research_team_market_analyzer.py (★ 종목 선정)
│   ├── analysis_agent.py                (★ 기술분석)
│   ├── strategy_agent.py                (★ 매매전략)
│   ├── risk_agent.py                    (★ 위험관리)
│   ├── main_trading_system.py           (★ 통합 실행)
│   ├── toss_client.py                   (★ API 연동)
│   ├── kis_client.py                    (비활성화됨)
│   ├── kis_auto_trading.py              (비활성화됨)
│   ├── config.py                        (설정)
│   └── ... (20+ 지원 파일들)
│
├── us_market_auto_trader.py             ← 미국 시장 진입점
├── check_toss_account.py                ← 계좌 상태 확인
├── verify_kis_disabled.py               ← KIS 비활성화 검증
│
└── .env                                 ← 환경변수 (KIS 비활성화)
```

### 핵심 4팀 에이전트 위치
```
리서치팀  → src/pyqqq/research_team_market_analyzer.py
분석팀    → src/pyqqq/analysis_agent.py
전략팀    → src/pyqqq/strategy_agent.py
위험팀    → src/pyqqq/risk_agent.py
```

---

## 📊 2. 현재 상황

### 2-1. Git 상태
```
브랜치: team3/task3-4-test-automation
상태: Working directory에 변경사항 있음 (커밋 전)

수정된 파일:
  - src/pyqqq/analysis_agent.py
  - src/pyqqq/strategy_agent.py
  - src/pyqqq/toss_client.py
  - src/pyqqq/config.py
  + 다른 파일들

미추적 파일 (새로 생성됨):
  - us_market_auto_trader.py (★ 새 파일)
  - verify_kis_disabled.py
  - check_toss_account.py
  - 기타 배포/테스트 파일들
```

### 2-2. 주요 기능 상태

| 기능 | 상태 | 설명 |
|------|------|------|
| **Toss 한국주식 거래** | ⚠️ 정상 | 계좌 검증 완료, 현금 ₩109,932 |
| **Toss 미국주식 거래** | 🔄 준비 중 | 시장 오픈 대기, 현금 $151.01 |
| **KIS API** | 🔴 비활성화 | 환경변수 제거, 코드 차단 |
| **자동매매 엔진** | ✅ 활성화 | 4팀 파이프라인 구축 |
| **리스크 관리** | ✅ 활성화 | 손실 한도/주문 게이트 |

### 2-3. 최근 변경사항

```
1️⃣ KIS API 완전 비활성화
   ✅ .env에서 KIS_APP_KEY/SECRET 제거
   ✅ main_trading_system.py: kis_client 조건부 초기화
   ✅ kis_client.py: authenticate() 조기 반환
   ✅ kis_auto_trading.py: __init__에서 비활성화 체크

2️⃣ Toss-only 모드 구현
   ✅ MainTradingSystem(toss_only=True) 파라미터 추가
   ✅ us_market_auto_trader.py 생성 (시장 대기 + 자동매매)

3️⃣ 백그라운드 프로세스 제거
   ✅ VM strategy_upbit.py (PID 60595) 중지
   ✅ strategy_kis.py 비활성화
```

---

## ✅ 3. 점검해야 할 항목들

### 3-1. 🔴 **높은 우선순위 (Critical)**

#### ❌ 문제 1: 데이터 파이프라인 불완전

**위치**: `src/pyqqq/research_team_market_analyzer.py` (L20-48)

**현상**:
```python
self.us_stocks = [
    "AAPL", "MSFT", "GOOGL", "AMZN", 
    "NVDA", "TSLA", "META", "NFLX"
]  # ← 하드코딩된 8개만
```

**문제점**:
- ❌ 오늘의 시장 이슈 카테고리 미감지
- ❌ 실시간 거래량 데이터 없음
- ❌ 뉴스 기반 종목 선정 미구현

**점검 항목**:
- [ ] `analyze_market_and_select_stocks()` 메소드 검증
- [ ] 종목 리스트가 정적인지 동적인지 확인
- [ ] 뉴스 데이터 수집 로직 확인 (NaverNewsClient)
- [ ] 거래량 기반 필터링 구현 여부

**개선 권장**:
```python
# 현재 (❌)
self.us_stocks = ["AAPL", "MSFT", ...]  # 고정

# 개선 (✅)
async def find_dynamic_us_stocks(self, limit=20):
    """
    1. 실시간 거래량 급증 종목 수집
    2. 섹터별 가중치 계산
    3. TOP 20 종목 반환
    """
```

---

#### ❌ 문제 2: 기술지표 분석 부실

**위치**: `src/pyqqq/analysis_agent.py` (L85-97)

**현상**:
```python
if not price_history or len(price_history) < 20:
    return {
        "signal": "HOLD",        # ← 항상 HOLD
        "confidence": 0.0
    }
```

**문제점**:
- ❌ 데이터 없으면 신호 생성 안 함
- ❌ 기술지표 (RSI, MACD) 부분 구현
- ❌ 차트 패턴 인식 없음

**점검 항목**:
- [ ] `analyze_symbol()` 메소드의 신호 생성 로직
- [ ] 기술지표 계산 함수들 검증
  - [ ] RSI (과매수/과매도)
  - [ ] MACD (추세 + 모멘텀)
  - [ ] Bollinger Bands (변동성)
- [ ] 데이터 부족 시 대체 전략 확인

**개선 권장**:
```python
# 현재 (❌)
if not price_history:
    return {"signal": "HOLD"}

# 개선 (✅)
# 최소 데이터로도 신호 생성 가능하게
# 또는 실시간 API에서 데이터 수집
```

---

#### ❌ 문제 3: 손절/익절가 과도하게 고정

**위치**: `src/pyqqq/strategy_agent.py` (L42-54)

**현상**:
```python
self.market_config = {
    "US": {
        "stop_loss_pct": 0.05,      # -5% (고정)
        "take_profit_pct": 0.10,    # +10% (고정)
    }
}
```

**문제점**:
- ❌ 기술적 레벨 무시하고 비율만 사용
- ❌ 변동성 높은 종목도 동일 비율
- ❌ 지지선/저항선 계산 부재

**점검 항목**:
- [ ] `_calculate_technical_levels()` 메소드 (L57-91)
  - [ ] 지지선 계산이 정말 기술적 레벨인지?
  - [ ] 저항선이 현재가 +4%로 고정되었는지?
- [ ] 손절/익절이 기술적 레벨을 고려하는지?

**개선 권간**:
```python
# 현재 (❌)
support_price = current_price * 0.97  # -3% 고정

# 개선 (✅)
# 실제 차트의 지지선 찾기
# 예: 최근 20일 최저가, 이동평균선 등
```

---

### 3-2. 🟡 **중간 우선순위 (High)**

#### ⚠️ 문제 4: 현금 활용도 낮음

**위치**: `src/pyqqq/strategy_agent.py` (L46)

**현상**:
```
보유 자금: USD $151.01
80% 활용 = USD $120.80
결과: 1-2개 종목만 거래 가능 → 포지션 너무 작음
```

**점검 항목**:
- [ ] `position_size_pct = 0.80` 이 적절한가?
- [ ] 소규모 계좌 ($151) 고려했는가?
- [ ] 동적 포지션 사이징 구현 여부
- [ ] 최소 주문 수량 (1주)로 충분한가?

---

#### ⚠️ 문제 5: 리스크 한도가 너무 강함

**위치**: `src/pyqqq/risk_agent.py` (L22)

**현상**:
```python
self.max_daily_loss_pct = 0.05  # 일일 손실 5%
```

**문제점**:
- ⚠️ 첫 거래 손절로 일일 한도 도달
- ⚠️ 변동성 높은 시장에서 거래 불가

**점검 항목**:
- [ ] 일일 손실 한도 5%가 현실적인가?
- [ ] 일일 주문 건수 제한 (50건) 검증
- [ ] 최소 현금 유지 5%가 적절한가?

---

#### ⚠️ 문제 6: Toss API 연동 완전성

**위치**: `src/pyqqq/toss_client.py`

**점검 항목**:
- [ ] `authenticate()` - OAuth2 흐름이 정상?
- [ ] `get_cash_balance()` - KRW/USD 분리 조회 정상?
- [ ] `get_holdings()` - `marketCountry` 필드 올바른가? (이전 "market" 버그 수정 확인)
- [ ] `place_order()` - 실제 거래 가능한가?
- [ ] 에러 처리 - API 오류 시 재시도 로직?

**검증 방법**:
```bash
# 실행해서 확인
python3 /Users/mac/Documents/Codex/AI-Investment-Operating-System/check_toss_account.py
```

---

### 3-3. 🟢 **낮은 우선순위 (Medium)**

#### ℹ️ 확인 항목 7: 로깅/모니터링

**위치**: `src/pyqqq/decision_logger.py`, `src/pyqqq/main_trading_system.py`

**점검 항목**:
- [ ] 매매 결정 로깅 정상?
- [ ] 에러 로그 수집 완전?
- [ ] 대시보드 업데이트 정상?

---

#### ℹ️ 확인 항목 8: 백테스트 시스템

**위치**: `/tests/` 디렉토리

**점검 항목**:
- [ ] 단위 테스트 커버리지?
- [ ] 통합 테스트 있는가?
- [ ] 실제 거래로 검증했는가?

---

## 🎯 4. 리뷰 체크리스트

### Phase 1: 자동매매 엔진 검증 (필수)

```markdown
## Research Team (종목 선정)
- [ ] 종목 선정 로직이 동적인가?
- [ ] 뉴스 데이터 수집 정상?
- [ ] 현금 필터링 정상?

## Analysis Agent (기술분석)
- [ ] 기술지표 계산 정상?
- [ ] 신호 생성 로직 검증
- [ ] 데이터 부족 시 대체 전략?

## Strategy Agent (매매 전략)
- [ ] 진입/손절/익절가 계산 정상?
- [ ] 포지션 사이징 적절?
- [ ] 기술적 레벨 사용?

## Risk Agent (위험관리)
- [ ] 주문 승인 로직 정상?
- [ ] 현금 검증 정상?
- [ ] 손실 한도 작동?
```

### Phase 2: Toss API 연동 검증

```markdown
## Toss Client
- [ ] 인증 흐름 정상?
- [ ] KRW/USD 분리 조회 정상?
- [ ] 주문 실행 가능?
- [ ] 에러 처리 완전?

## 실전 거래 테스트
- [ ] check_toss_account.py 실행 결과
- [ ] 실제 소액 거래 테스트
- [ ] 손절/익절 작동 확인
```

### Phase 3: 미국 시장 진입 검증

```markdown
## 미국 시장 타이밍
- [ ] us_market_auto_trader.py 작동?
- [ ] 시장 시간 감지 정상?
- [ ] 자동 거래 시작?

## 첫 거래 검증
- [ ] 종목 선정 정상?
- [ ] 주문 실행됨?
- [ ] 손절/익절 설정됨?
- [ ] 사용자 알림 받음? (첫 거래만)
```

---

## 📈 5. 코드 리뷰 체크시트 (Codex)

```
리뷰 대상 파일:
✅ src/pyqqq/research_team_market_analyzer.py (★ 높은 우선순위)
✅ src/pyqqq/analysis_agent.py (★ 높은 우선순위)
✅ src/pyqqq/strategy_agent.py (★ 높은 우선순위)
✅ src/pyqqq/risk_agent.py (중간 우선순위)
✅ src/pyqqq/toss_client.py (중간 우선순위)
✅ src/pyqqq/main_trading_system.py (전체 통합)
✅ us_market_auto_trader.py (새 파일 검증)

검토 포인트:
□ 코드 품질 (가독성, 구조)
□ 에러 처리 (예외 상황)
□ 성능 (응답 시간, 메모리)
□ 보안 (API 키, 인증)
□ 테스트 커버리지
□ 문서화
```

---

## 🚀 6. 리뷰 후 Action Items

### Immediate (이번 주)
```
1. 데이터 파이프라인 강화
   - 실시간 거래량 수집
   - 뉴스 기반 섹터 분석
   
2. 기술지표 고도화
   - RSI/MACD/BB 완전 구현
   - 차트 패턴 인식
   
3. Toss API 완전 검증
   - 실제 거래 테스트
   - 에러 처리 강화
```

### Short-term (2주)
```
1. 백테스트 시스템 구축
2. 포지션 사이징 동적화
3. 트레일링 손절 구현
```

---

## 📞 연락처 / 질문 사항

**리뷰 중 질문 사항**:
- 코드 구조 관련: 참고 문서 확인
- 배포 관련: `/Users/mac/Documents/Codex/AI-Investment-Operating-System/BOOSTER_SETUP_GUIDE.md`
- VM 상태: `junkim_life360@aios-booster`

---

**작성**: Claude Code  
**마지막 업데이트**: 2026-08-12 18:00 KST
