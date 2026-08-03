---
name: crypto_team_collaboration_spec
description: 암호화폐 AI 매매 시스템 - 팀간 협업 명세서
metadata:
  type: integration
  status: 확정
  date: 2026-08-02
---

# 🤝 암호화폐 AI 매매 팀간 협업 명세서

## 개요

4인 에이전트팀의 명확한 인터페이스 정의로 병렬 개발 가능하도록 설계

```
팀원1 (시장분석)     팀원2 (전략·리스크)     팀원3 (실행·평가)     팀원4 (대시보드)
    ↓                    ↓                      ↓                    ↓
  시장 데이터  →  신호 생성 + 리스크  →  주문 실행  →  성과 표시
                  (필터링/승인)
```

---

## 📊 팀원1 → 팀원2: 시장 데이터 인터페이스

### 제공 데이터 (팀원1 → 팀원2)

**함수**: `UpbitTradingStrategy._analyze_markets()`에서 생성

**수신 데이터 구조**:
```python
signal_raw = {
    "market": "KRW-BTC",                    # 종목
    "current_price": 65000000.0,            # 현재가
    "recommendation": "BUY",                # Claude AI 추천 (BUY/SELL/HOLD)
    "confidence": 0.75,                     # 신뢰도 (0-1, 백분율)
    "entry_price": 64900000.0,              # 제안 진입가
    "stop_loss_price": 61750000.0,          # 제안 손절가
    "take_profit_price": 71500000.0,        # 제안 익절가
    "signal_strength": "강함",              # 신호 강도 (약함/중간/강함)
    "reasoning": "상승 추세 지속..."        # 분석 근거
}
```

**팀원2 활용 방법**:
- confidence 추출 → 70% 필터링
- recommendation 검증 → 시장상태 기반 신호 생성
- signal_strength 활용 → 호가 강도 조합

---

## 📊 팀원2 → 팀원3: 신호 포맷 명세

### 최종 신호 (팀원2 → 팀원3)

**함수**: `_execute_buy_order(signal, available_cash)`

**신호 구조**:
```python
final_signal = {
    # 1. 기본 정보
    "market": "KRW-BTC",
    "current_price": 65000000.0,
    "recommendation": "BUY",
    "confidence": 0.75,
    
    # 2. 팀원2 계산값
    "entry_price": 64900000.0,              # 조정된 진입가
    "take_profit_price": 71500000.0,        # 조정된 익절가
    "stop_loss_price": 61750000.0,          # 조정된 손절가
    "signal_strength": "강함",              # 원본
    "strategy": "상승세 추종 (UPTREND)",    # 팀원2 전략명
    
    # 3. 리스크 승인
    "risk_approved": True,                  # _check_risk_limits() 결과
    "adjusted_position_size": 0.05,         # Kelly Criterion 결과
    "kelly_size": "5.00%",                  # 설명용
    
    # 4. 리스크 상태
    "daily_loss_pct": -0.05,                # 일일 손실률
    "consecutive_losses": 0,                # 연속 손실 횟수
    "max_drawdown_pct": -0.08,              # 최대 드로우다운
}
```

### 주문 실행 프로세스

```
신호 입력 (_execute_buy_order)
    ↓
1. 리스크 체크 (_check_risk_limits)
    - 일일 -10% 한도 확인
    - 드로우다운 -20% 확인
    - 연속 손실 3회 확인
    - Kelly 사이징 계산
    → approved: True/False
    ↓
2. approved = True이면
    - 포지션 사이징: Kelly × 가용 현금
    - 주문 금액 계산: max(가용현금 × Kelly, ₩10,000)
    ↓
3. 주문 실행 (upbit.place_order)
    ↓
4. 거래 기록 저장 (_execute_buy_order)
    - trade_history에 기록 (OPEN 상태)
    ↓
5. 대시보드 업데이트 (dashboard_client)
    → send_trade_order(trade_data)
```

---

## 📊 팀원3 → 팀원2: 성과 피드백 인터페이스

### 매도 결과 (팀원3 → 팀원2)

**함수**: `_execute_sell_order(position)`

**피드백 데이터**:
```python
sell_result = {
    "market": "KRW-BTC",
    "exit_price": 68250000.0,              # 실제 매도가
    "pnl": 3250000.0,                       # 손익 (원화)
    "pnl_pct": 5.0,                         # 손익률 (%)
    "entry_price": 65000000.0,              # 진입가
    "quantity": 0.05,                       # 거래량
    "status": "CLOSED",                     # 포지션 상태
    "exit_time": "2026-08-02T14:32:00"     # 매도 시점
}
```

**팀원2 활용**:
- trade_history에서 해당 거래 찾아 손익 업데이트
- 연속 손실 추적 (pnl < 0이면 +1)
- daily_pnl 누적
- Kelly Criterion 재계산 (10거래 이상시)

---

## 📊 팀원2 → 팀원4: 대시보드 업데이트 명세

### 거래 주문 데이터 (팀원2 → 팀원4)

**함수**: `dashboard.send_trade_order(trade_data)`

**메시지 구조**:
```python
# 매수 주문
trade_data_buy = {
    "event": "BUY",
    "market": "KRW-BTC",
    "side": "BUY",
    "volume": 0.001,
    "price": 64900000.0,
    "amount": 64900.0,
    "order_uuid": "a1234-b5678",
    "status": "submitted",
    "confidence": 75,
    "kelly_size": 0.05,
    "entry_price": 64900000.0,
    "take_profit": 71500000.0,
    "stop_loss": 61750000.0,
    "strategy": "상승세 추종"
}

# 매도 주문
trade_data_sell = {
    "event": "SELL",
    "market": "KRW-BTC",
    "side": "SELL",
    "volume": 0.001,
    "price": 68250000.0,
    "amount": 68250.0,
    "order_uuid": "c9101-d1112",
    "status": "submitted",
    "pnl": 3250000.0,
    "pnl_pct": 5.0,
    "consecutive_losses": 0,
    "daily_pnl": 15780000.0
}
```

### 계좌 상태 데이터 (팀원2 → 팀원4)

**함수**: `dashboard.send_account_status(account_data)`

**메시지 구조**:
```python
account_data = {
    "event": "ACCOUNT_UPDATE",
    "krw_balance": 500000.0,                # 현금
    "krw_locked": 50000.0,                  # 예약금
    "total_assets": 2500000.0,              # 총 자산
    "total_buy_price": 1950000.0,           # 총 매수가
    "total_eval_price": 2000000.0,          # 총 평가가
    "total_gain": 50000.0,                  # 평가손익
    "total_return": 2.56,                   # 수익률 (%)
    "holdings": [
        {
            "market": "KRW-BTC",
            "quantity": 0.01,
            "avg_buy_price": 65000000.0,
            "current_price": 68250000.0,
            "buy_value": 650000.0,
            "eval_value": 682500.0,
            "gain": 32500.0,
            "gain_rate": 5.0
        }
    ],
    
    # 팀원2 추가 정보
    "daily_pnl": 15780000.0,
    "daily_pnl_pct": -1.58,
    "consecutive_losses": 0,
    "max_drawdown": -8.5
}
```

---

## 🔄 데이터 흐름 타임라인

### 분석 루프 (매 60초)

```
T+0초:   _analysis_loop() 시작
           ↓
T+1초:   _analyze_markets() 
           - 모든 마켓 분석 (Claude AI)
           - 신호 list 반환
           ↓
T+2초:   for signal in signals:
           - _check_risk_limits() 호출
           - approved 확인
           ↓
T+3초:   if approved:
           - _execute_buy_order() 호출
           - upbit.place_order() 실행
           - trade_history 저장
           - dashboard.send_trade_order() 호출
           ↓
T+4초:   계좌 상태 조회 및 업데이트
           - dashboard.send_account_status() 호출
           ↓
T+55초: _monitor_positions() (별도 백그라운드)
           - 모든 열린 포지션 확인
           - 손절/익절 조건 체크
           - _execute_sell_order() 호출시
           - trade_history 업데이트
           - consecutive_losses 갱신
           ↓
T+60초: 다음 루프 시작
```

---

## 📋 데이터 검증 규칙

### 팀원1 → 팀원2 검증

| 필드 | 타입 | 범위 | 검증 |
|------|------|------|------|
| market | str | KRW-* | 설정된 마켓만 |
| current_price | float | > 0 | 양수 |
| confidence | float | 0-1 | 70% 미만 필터링 |
| entry_price | float | > 0 | 현재가의 ±5% |
| recommendation | str | BUY/SELL/HOLD | 필수 |

### 팀원2 → 팀원3 검증

| 필드 | 타입 | 범위 | 검증 |
|------|------|------|------|
| risk_approved | bool | - | 필수 |
| adjusted_position_size | float | 0.01-0.3 | Kelly 계산값 |
| daily_loss_pct | float | -0.1 | -10% 한도 |

### 팀원3 → 팀원2 검증

| 필드 | 타입 | 범위 | 검증 |
|------|------|------|------|
| pnl | float | - | 손익 기록 |
| pnl_pct | float | - | 손익률 계산 |
| status | str | OPEN/CLOSED | 상태 변경 |

---

## 🚨 에러 처리 및 폴백

### 팀원1 데이터 부재시
```python
# 팀원2 폴백
if not signal:
    reason = "📊 신호 없음 - HOLD"
    return {"approved": False, "reason": reason}
```

### 호가북 데이터 부재시
```python
# 팀원2 폴백
orderbook_analysis = self._analyze_orderbook(None)
# → bid_strength: 0.5 (기본값)
```

### 거래 실패시
```python
# 팀원3 → 팀원2
if not order:
    logger.error(f"❌ {market} 주문 실패")
    return False
    # → trade_history에 미저장
    # → Kelly Criterion 계산 미포함
```

---

## 📡 통신 프로토콜

### 동기식 (동일 스레드)
- `_analyze_markets()` → signals list (즉시 반환)
- `_check_risk_limits()` → result dict (즉시 반환)
- `_calculate_kelly_criterion()` → kelly_size float (즉시 반환)

### 비동기식 (asyncio)
- `_execute_buy_order()` → await (1-2초)
- `_execute_sell_order()` → await (1-2초)
- `dashboard.send_*()` → fire-and-forget (0.1초)

### 상태 저장소
- `self.trade_history`: List[Dict] (메모리)
- `self.daily_pnl`: float (메모리)
- `self.consecutive_losses`: int (메모리)
- `positions.json`: File (디스크)

---

## 🔍 모니터링 및 알림

### 팀원2가 추적할 메트릭

```python
# _check_risk_limits()에서 반환
risk_status = {
    "daily_loss_pct": -0.05,         # 일일 손실률 추적
    "consecutive_losses": 2,          # 연속 손실 모니터링
    "max_drawdown_pct": -0.085,      # 최대 드로우다운 추적
    "portfolio_pnl": 15780.0         # 포트폴리오 손익
}

# 대시보드로 전송
dashboard.send_risk_status(risk_status)
```

### 알림 조건 (팀원2)

| 조건 | 알림 | 처리 |
|------|------|------|
| daily_loss ≤ -10% | 경고 | 모든 신규 주문 거부 |
| consecutive_losses ≥ 3 | 경고 | 3회 연속 손실시 대기 |
| max_drawdown ≤ -20% | 긴급 | 모든 주문 중단 |

---

## 📝 문서화 규칙

### 로그 메시지 형식

**신호 생성**:
```
✅ KRW-BTC 신호 생성: 📈 UPTREND: +10% 익절 / -5% 손절
```

**리스크 승인**:
```
✅ 리스크 승인: 신뢰도 75%, Kelly 5.0%, 일일손실 -2.3%
```

**리스크 거부**:
```
⛔ KRW-BTC 리스크 거부: ❌ 일일 손실 한도 도달 (-10.5% <= -10%)
```

**주문 실행**:
```
🔴 실거래 주문 실행 (업비트 실제 계좌에 반영됨)
   마켓: KRW-BTC
   방향: BUY (매수)
   금액: ₩64,900
   수량: 0.001
   가격: ₩64,900,000
```

**매도**:
```
✅ 실거래 주문 성공!
   손익: ₩3,250 (+5.00%)
   연속손실: 0
   일일손익: ₩15,780
```

---

## ✅ 체크리스트

### 팀원1 (시장분석)
- [ ] 신호 구조 확정
- [ ] confidence 계산 방식 명확화
- [ ] signal_strength 정의 (약함/중간/강함)
- [ ] 데이터 타입 검증

### 팀원2 (전략·리스크) ✅ 완료
- [x] 신호 생성 함수 구현
- [x] 리스크 체크 함수 구현
- [x] Kelly Criterion 구현
- [x] 거래 기록 저장
- [x] 연속 손실 추적
- [x] 일일 손실 리셋

### 팀원3 (실행·평가)
- [ ] 주문 실행 확인
- [ ] 손익 계산 방식 검증
- [ ] 슬리피지 측정
- [ ] 거래 수수료 반영

### 팀원4 (대시보드)
- [ ] 신호 표시 UI
- [ ] 리스크 상태 표시
- [ ] 거래 기록 표시
- [ ] 성과 분석 표시

---

**최종 확정**: 2026-08-02
**상태**: 팀원2 구현 완료, 팀원1-3-4 협업 대기
