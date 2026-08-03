---
name: crypto_strategy_risk_implementation
description: 암호화폐 AI 매매 시스템 - 초단타 전략·리스크팀 완전 구현
metadata:
  node_type: implementation
  team: 전략·리스크팀 (Team 2)
  status: 완료
  date: 2026-08-02
---

# 🎯 암호화폐 초단타 전략·리스크팀 구현 완료

## 📋 개요

**담당 팀**: 전략·리스크팀 (AI/퀀트 모델링 엔지니어)
**구현 파일**: `/Users/mac/Documents/Codex/AI-Investment-Operating-System/src/pyqqq/strategy_upbit.py`
**상태**: ✅ 완료 (2026-08-02)
**코드 라인**: ~800줄 신규 구현

---

## ✅ 완료된 작업

### 1️⃣ 시장 상태 분석 (`_analyze_market_state()`)

**목표**: 시장 상태를 4가지로 분류하여 전략 기반 마련

```python
def _analyze_market_state(self, ohlc_data: List[Dict]) -> str
```

**입력**: OHLC 캔들 데이터 (분봉, 최소 5개)

**출력**: 시장 상태 플래그
- `UPTREND`: 연속 상승 (최근 5개 캔들 중 4개 이상 상승)
- `DOWNTREND`: 연속 하락 (최근 5개 캔들 중 1개 이하 상승)
- `VOLATILITY`: 변동성 급증 (표준편차 > 5%)
- `SIDEWAYS`: 횡보 (기타)

**구현 특징**:
- 최근 5개 캔들로 빠른 판단
- 변동성 계산으로 급등락 감지
- 매 신호 생성시마다 자동 업데이트

---

### 2️⃣ 호가·체결 분석 (`_analyze_orderbook()`)

**목표**: 매수/매도 강도를 정량화하여 신호 신뢰도 강화

```python
def _analyze_orderbook(self, orderbook_data: Optional[Dict]) -> Dict[str, float]
```

**입력**: 호가북 데이터 (bid/ask 잔량)

**출력**: 호가 분석 결과
```python
{
    "bid_strength": 0.0-1.0,      # 매수 강도 (상위 5개 호가 합계 비율)
    "ask_strength": 0.0-1.0,      # 매도 강도
    "pressure_ratio": 0.0-3.0     # 매집 신호 (bid/ask 비율)
}
```

**규칙**:
- 상위 5개 호가의 잔량만 분석 (빠른 계산)
- bid_strength + ask_strength = 1.0
- pressure_ratio > 1.5: 강한 매수 신호
- pressure_ratio < 0.7: 강한 매도 신호

**활용**:
- VOLATILITY 상황에서 bid_strength > 80%면 매수 진입
- 신호 생성의 confidence 보정

---

### 3️⃣ 초단타 전략 신호 생성 (`_generate_trading_signal()`)

**목표**: 시장 상태 기반 진입/익절/손절 가격 자동 결정

```python
def _generate_trading_signal(
    self,
    market: str,
    current_price: float,
    market_state: str,
    signal_strength: str,
    orderbook: Optional[Dict],
    confidence: int
) -> Optional[Dict]
```

**입력**:
- market_state: UPTREND/DOWNTREND/SIDEWAYS/VOLATILITY
- signal_strength: Claude AI 신호 강도
- orderbook: 호가북 데이터
- confidence: 신뢰도 (0-100%)

**출력**: 거래 신호
```python
{
    "entry_price": float,         # 진입가
    "take_profit": float,         # 익절가
    "stop_loss": float,           # 손절가
    "holding_time": int,          # 예상 보유시간 (초)
    "confidence": float (0-1),    # 신뢰도 (정규화)
    "strategy": str               # 전략 설명
}
```

**신호 규칙**:

| 시장상태 | 조건 | 익절(TP) | 손절(SL) | 보유시간 |
|---------|------|---------|---------|---------|
| **UPTREND** | confidence > 70% | +10% (적극) | -5% (적극) | 3분 |
| **VOLATILITY** | bid_strength > 80% | +5% (중간) | -2% (매우적극) | 2분 |
| **SIDEWAYS** | confidence > 85% + bid > 75% | +2% (보수) | -1% | 1분 |
| **DOWNTREND** | - | 진입 금지 | - | - |

**특징**:
- 신뢰도 70% 이상만 진입
- 시장 상태별 적응형 목표 설정
- 호가 분석으로 신뢰도 보정
- 암호화폐 특성상 적극적 매매

---

### 4️⃣ Kelly Criterion 포지션 사이징 (`_calculate_kelly_criterion()`)

**목표**: 역사적 수익률 기반 최적 포지션 크기 계산

```python
def _calculate_kelly_criterion(
    self,
    win_rate: float,
    avg_win: float,
    avg_loss: float
) -> float
```

**공식**:
```
f = (bp*p - q) / b

f: 베팅 비율 (최적 포지션)
b: 배당률 (평균수익 / 평균손실)
p: 승률
q: 패율 (1-p)
```

**안전장치**:
- 최대 포지션: 50% (Kelly가 과도할 때 제한)
- 최소 포지션: 1% (변동성 대비 보호)
- 거래 기록 10개 미만: 기본값 5%

**효과**:
- 초기 거래: 보수적 5%
- 승률 60%, 평균 수익 1:0.5: ~11% 포지션
- 거래 기록 기반 동적 조정

---

### 5️⃣ 리스크 관리 체크 (`_check_risk_limits()`)

**목표**: 암호화폐 매매 규칙 강제 (일일 -10% 감수, Kelly 사이징, 연속 손실 제어)

```python
def _check_risk_limits(
    self,
    signal: Optional[Dict],
    current_balance: float,
    open_positions: List[Position],
    daily_pnl: float
) -> Dict
```

**입력**:
- signal: 거래 신호
- current_balance: 현금 잔액
- open_positions: 열린 포지션 목록
- daily_pnl: 일일 손익

**출력**:
```python
{
    "approved": bool,                    # 주문 승인 여부
    "adjusted_position_size": float,     # 조정된 포지션 비중
    "reason": str,                       # 거부/승인 사유
    "risk_status": {
        "daily_loss_pct": float,         # 일일 손실률
        "consecutive_losses": int,       # 연속 손실 횟수
        "max_drawdown_pct": float,       # 최대 드로우다운
        "portfolio_pnl": float           # 포트폴리오 손익
    }
}
```

#### 검사 규칙

**규칙 1: 일일 손실 한도 (-10%)**
```
IF 일일손실 <= -10% THEN 거부
영향: 충동적 손실 제한, 일부 수익성 포기
```

**규칙 2: 최대 드로우다운 (-20%)**
```
IF 드로우다운 <= -20% (최고가 대비) THEN 거부
영향: 포트폴리오 보호, 대형 손실 방지
```

**규칙 3: 연속 손실 제어 (3회)**
```
IF 연속손실 >= 3 THEN 거부 (심리 회복 대기)
영향: 심리적 흔들림 방지, 성공률 회복 대기
```

**규칙 4: 신뢰도 필터링 (70%)**
```
IF confidence < 70% THEN 거부
영향: 낮은 신뢰도 신호 차단
```

**규칙 5: Kelly Criterion 포지션 사이징**
```
position_size = Kelly계산값 × 기존포지션조정
최대: 30% (과도한 레버리지 방지)
영향: 동적 포지션 조정, 변동성 대응
```

#### 리스크 상태 추적

| 항목 | 초기값 | 계산 방법 |
|------|--------|---------|
| daily_pnl | 0.0 | 거래별 손익 누적 (자정 리셋) |
| consecutive_losses | 0 | 손실시 +1, 수익시 리셋 |
| max_portfolio_value | 초기자산 | 최고 포트폴리오 추적 |
| initial_portfolio_value | 초기자산 | 손실률 계산 기준값 |

---

### 6️⃣ 거래 기록 및 성과평가

**거래 기록 구조**:
```python
{
    "timestamp": "2026-08-02T14:30:00",
    "market": "KRW-BTC",
    "side": "BUY",
    "entry_price": 65000000.0,
    "quantity": 0.001,
    "amount": 65000.0,
    "confidence": 0.75,
    "pnl": 3250.0,              # 손익 (매도시 계산)
    "pnl_pct": 5.0,             # 손익률 (%)
    "status": "CLOSED",         # OPEN / CLOSED
    "exit_price": 68250000.0,   # 매도가
    "exit_time": "2026-08-02T14:32:00"
}
```

**매수 시점**: 거래 기록 생성 (pnl=0, status=OPEN)
**매도 시점**: 거래 기록 업데이트 (pnl 계산, 연속손실 추적)

**활용**:
- Kelly Criterion 재계산 (10거래 이상시)
- 전략별 성과 분석
- 신호 신뢰도 검증

---

### 7️⃣ 일일 손실 리셋 (_analysis_loop)

**구현**:
- 자정(00:00) 기준 date 변경 감지
- 변경시 daily_pnl, consecutive_losses 초기화
- 로그 기록으로 명확한 경계 표시

**효과**:
- 정확한 일일 손실 추적
- 일일 -10% 한도 정확한 적용
- 거래일 기준 위험 관리

---

## 🔄 데이터 흐름

```
시장 데이터 (WebSocket)
    ↓
1. _analyze_market_state()
   → UPTREND / DOWNTREND / SIDEWAYS / VOLATILITY
    ↓
2. Claude AI 분석 (기존)
   → confidence, signal_strength
    ↓
3. _analyze_orderbook()
   → bid_strength, pressure_ratio
    ↓
4. _generate_trading_signal()
   → entry_price, take_profit, stop_loss
    ↓
5. _check_risk_limits()
   ├─ 일일 손실 체크 (-10%)
   ├─ 드로우다운 체크 (-20%)
   ├─ 연속 손실 체크 (3회)
   ├─ Kelly 포지션 사이징
   └─ approved: True/False
    ↓
6. _execute_buy_order()
   → 거래 기록 저장 (trade_history)
    ↓
7. 포지션 모니터링
   → _monitor_positions()
   → 손절/익절 체크
    ↓
8. _execute_sell_order()
   → 손익 계산
   → 거래 기록 업데이트
   → 연속 손실 추적
   → daily_pnl 누적
    ↓
대시보드 업데이트
```

---

## 🎛️ 암호화폐 매매 규칙

### 설정값 (코드 상단)
```python
CRYPTO_TRADING_RULES = {
    "max_daily_loss": -0.10,              # 일일 -10% 감수
    "max_drawdown": -0.20,                # 최대 드로우다운 -20%
    "min_signal_confidence": 0.70,        # 신뢰도 70% 필터
    "consecutive_loss_threshold": 3,      # 연속 손실 3회 제어
    "position_sizing": "kelly",           # Kelly Criterion 적용
    "max_holding_time": 300,              # 최대 5분 보유
    "profit_targets": [0.02, 0.05, 0.10], # 수익 목표: 2%, 5%, 10%
    "stop_loss_levels": [0.02, 0.05, 0.10] # 손절 수준
}
```

### 주식 vs 암호화폐 비교

| 항목 | 주식 | 암호화폐 |
|------|------|--------|
| **일일 손실 한도** | -5% | **-10%** ✅ |
| **거래 빈도** | 저빈도 | **고빈도** ✅ |
| **보유시간** | 일~주 | **1-5분** ✅ |
| **수익 목표** | 5-10% | **2-10%** ✅ |
| **Kelly 적용** | X | **Yes** ✅ |
| **리스크 성향** | 보수적 | **적극적** ✅ |

---

## 🔧 API 인터페이스

### 신호 생성
```python
signal = self._generate_trading_signal(
    market="KRW-BTC",
    current_price=65000000.0,
    market_state="UPTREND",
    signal_strength="강함",
    orderbook=orderbook_data,
    confidence=78  # Claude AI
)
# 출력: {"entry_price": ..., "take_profit": ..., "stop_loss": ..., ...}
```

### 리스크 체크
```python
result = self._check_risk_limits(
    signal=signal,
    current_balance=1000000.0,
    open_positions=open_positions,
    daily_pnl=-50000.0
)
# 출력: {"approved": True/False, "adjusted_position_size": 0.05, "reason": "...", ...}
```

### 주문 실행 (리스크 체크 자동 포함)
```python
success = await self._execute_buy_order(signal, available_cash)
# 내부적으로 _check_risk_limits() 호출 후 주문 여부 결정
```

---

## 📊 로깅 및 모니터링

### 신호 생성 로그
```
✅ KRW-BTC 신호 생성: 📈 UPTREND: +10% 익절 / -5% 손절
✅ 리스크 승인: 신뢰도 78%, Kelly 5.2%, 일일손실 -2.3%, 드로우다운 -8.5%
📊 거래 기록 저장: KRW-BTC 매수 (Kelly 5.2%, 신뢰도 78%)
```

### 리스크 거부 로그
```
⛔ KRW-ETH 리스크 거부: ❌ 일일 손실 한도 도달 (-10.5% <= -10.0%)
⛔ KRW-SOL 리스크 거부: ⏸️  연속 손실 3회 - 대기 중
```

### 매도 로그
```
✅ 실거래 주문 성공!
   손익: ₩3,250 (+5.00%)
   연속손실: 0
   일일손익: ₩15,780
```

---

## ⚠️ 한계 및 주의사항

### 현재 제한사항
1. **호가북 데이터**: Upbit API 미지원시 기본값 사용
2. **거래 수수료**: 현재 미반영 (향후 추가)
3. **슬리피지**: 시장가 주문 기본값으로 계산
4. **공매도**: 암호화폐 규칙상 비활성화

### 모델 가정
- 신뢰도: Claude AI 분석 기반 (학습 데이터 의존)
- Kelly Criterion: 과거 10거래 기반 (샘플 편향 가능)
- 변동성: 5개 캔들 표준편차 (단기 보편성 가정)
- 시장 상태: 기술적 지표 기반 (펀더멘탈 무시)

### 개선 기회
1. 실시간 호가북 WebSocket 구독 추가
2. 거래 수수료 정확한 반영 (0.1%)
3. 슬리피지 실측 데이터 수집
4. 매크로 신호 (MACD, RSI) 추가
5. 머신러닝 신호 통합

---

## 📈 성과 검증 방법

### 성공 기준 (Phase 1)
- [x] 리스크 관리 구현: 일일 -10%, Kelly 사이징, 연속 손실 제어 ✅
- [x] 신호 생성 고도화: 시장 상태 기반 적응형 신호 ✅
- [x] 신뢰도 필터링: 70% 이상만 진입 ✅
- [x] 거래 기록: 완전한 손익 추적 ✅

### 검증 계획 (Phase 2)
1. **백테스트** (3개월 데이터)
   - 신호 정확도 검증
   - Kelly Criterion 효율성 평가
   - 일일 -10% 한도 준수율 확인

2. **라이브 테스트** (소자금 ₩100,000)
   - 실제 체결가 vs 예상가 비교
   - 슬리피지 측정
   - 거래 수수료 정확성 확인

3. **성과 분석**
   - Sharpe Ratio 계산
   - 최대 드로우다운 검증
   - Win Rate vs 예상 승률 비교

---

## 🚀 배포 및 사용

### 코드 위치
```
/Users/mac/Documents/Codex/AI-Investment-Operating-System/src/pyqqq/strategy_upbit.py
```

### 의존성
- `upbit_client.py`: Upbit API 통신
- `claude_analyzer.py`: Claude AI 신호 생성
- `position_manager.py`: 포지션 관리
- `dashboard_client.py`: 대시보드 업데이트

### 실행 방법
```python
strategy = UpbitTradingStrategy()
await strategy.run(once=False)  # WebSocket 기반 실시간 거래
```

---

## 📝 다음 단계

### 즉시 (1-2일)
1. 팀원1과 데이터 인터페이스 확정
2. 팀원3과 신호 포맷 검증
3. 팀원4와 대시보드 업데이트 테스트

### 단기 (1주)
1. 3개월 데이터 백테스트
2. Kelly Criterion 효율성 검증
3. 신호 신뢰도 보정

### 중기 (2-4주)
1. 호가북 분석 고도화 (매집 신호 개선)
2. 수수료 및 슬리피지 정확한 반영
3. 포트폴리오 수준의 리스크 관리 추가

---

**작성자**: AI/퀀트 모델링 엔지니어 (전략·리스크팀)
**완료일**: 2026-08-02
**코드 상태**: 테스트 준비 완료
