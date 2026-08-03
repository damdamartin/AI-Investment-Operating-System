# 🚀 AI 자동매매 시스템 - 4인 에이전트 팀

## 📋 시스템 개요

완전히 자동화된 AI 기반 주식 자동매매 시스템입니다.
- **실거래만**: 모든 거래는 KIS/Toss 실제 계좌 연동
- **4인 에이전트 팀**: 병렬 분석으로 정확도 극대화
- **자동 학습**: 거래 결과 기반 프롬프트 자동 개선
- **실시간 모니터링**: 손절/익절 자동 실행

---

## 👥 4인 에이전트 팀 구성

### 🏆 팀장: AI 총괄 관리자 (Orchestrator)
```
파일: orchestrator.py + performance_evaluator.py
역할:
- 4팀의 신호를 수집하는 Orchestrator
- 다중 신호 앙상블 엔진
- 성과평가 및 프롬프트 개선
- 팀별 가중치 동적 조정
```

### 🔍 팀원1: 리서치팀 + 종목분석팀
```
파일: research_agent.py + analysis_agent.py
역할:
- 뉴스, 공시, 산업동향 분석 (리서치팀)
- 재무제표, 기술차트, 수급 분석 (종목분석팀)
- Claude API 기반 신호 생성
```

### 📊 팀원2: 매매전략팀 + 리스트관리팀
```
파일: strategy_agent.py + watchlist_manager.py
역할:
- 진입/손절/익절 가격 결정 (매매전략팀)
- 거래 종목 동적 관리 (리스트관리팀)
- 시장별 차별화 규칙 적용 (한국주식 보수, 미국주식 적극)
```

### ⚙️ 팀원3: 주문실행엔진 + 모니터링
```
파일: order_execution_engine.py + realtime_monitor.py
역할:
- KIS/Toss API를 통한 실제 거래 실행
- 보유 포지션 실시간 감시
- 손절/익절 자동 실행
- 포트폴리오 P&L 실시간 계산
```

---

## 🔄 거래 사이클 (매분)

```
[1] 신호 생성 (병렬 처리)
    ├─ 리서치팀 신호 (Claude)
    ├─ 종목분석팀 신호 (Claude)
    └─ 기존 기술적 분석
        ↓
[2] Orchestrator가 신호 통합
    └─ 가중 앙상블로 최종 신호 결정
        ↓
[3] 매매전략팀 결정
    └─ 진입/손절/익절 가격 설정
        ↓
[4] 주문실행엔진 실행
    └─ KIS/Toss API 호출 (실제 거래)
        ↓
[5] 실시간모니터링 감시
    ├─ 손절/익절 체크
    └─ 포지션 종료 시 자동 실행
        ↓
[6] 성과평가
    ├─ 신호 정확도 측정
    └─ 프롬프트 개선 제안
```

---

## 🛠️ 사용 방법

### 1. 시스템 시작

```python
from ai_auto_trading_system import AIAutoTradingSystem
import asyncio

async def main():
    system = AIAutoTradingSystem()
    await system.start()

asyncio.run(main())
```

### 2. 커스텀 설정

```python
config = {
    "update_interval_seconds": 60,  # 1분마다 사이클
    "watchlist": [
        {"code": "005930", "name": "Samsung", "market": "KR"},
        {"code": "AAPL", "name": "Apple", "market": "US"}
    ],
    "portfolio_value": 10000000,  # ₩1000만
    "max_positions": 5,
    "stop_loss_pct": {"KR": 0.02, "US": 0.05},
    "take_profit_pct": {"KR": 0.03, "US": 0.10}
}

system = AIAutoTradingSystem(config=config)
await system.start()
```

### 3. 시스템 상태 조회

```python
status = system.get_system_status()
print(status)
```

### 4. 리포트 생성

```python
system.generate_report("trading_report.json")
```

---

## 📊 팀별 프롬프트 구조

### 리서치팀 (research_agent.py)
```
입력: 종목코드, 종목명, 최신 뉴스
분석: 뉴스, 공시, 산업동향, 거시경제
출력: BUY/SELL/HOLD 신호 + 신뢰도
신뢰도 가중치: 25%
```

### 종목분석팀 (analysis_agent.py)
```
입력: 종목코드, 현재가, 기술지표, 재무데이터
분석: 차트, 지표, 재무상태, 수급
출력: BUY/SELL/HOLD + 목표가 + 손절가
신뢰도 가중치: 35%
```

### 매매전략팀 (strategy_agent.py)
```
입력: 리서치신호 + 분석신호 + 포트폴리오
분석: 진입/손절/익절 가격 결정
출력: 수량, 진입가, 손절가, 익절가, 위험수익비
신뢰도 가중치: 25%
```

### 기술 트렌드
```
입력: 시장 데이터
분석: 단기 추세
출력: 신호 조정값
신뢰도 가중치: 15%
```

---

## 📈 성과 평가

### 신호 정확도 추적
- 각 팀의 신호 정확도를 자동 측정
- 신뢰도 > 75%, 정확도 > 70% 목표

### 팀별 기여도
```
research:   정확도 %, 신호 수, 평균 수익률
analysis:   정확도 %, 신호 수, 평균 수익률
strategy:   정확도 %, 신호 수, 평균 수익률
```

### 자동 개선
- 정확도 < 60%: 프롬프트 개선 제안
- 정확도 > 75%: 가중치 증가
- 수익 음수: 손절/익절 규칙 재검토

---

## ⚠️ 주요 주의사항

### 1. 실거래만
```
✅ 모든 주문은 KIS/Toss 실제 계좌 연동
✅ 손실 발생 가능 - 충분한 테스트 후 시작
✅ 자동 손절로 손실 제한 (-2% ~ -5%)
```

### 2. 시장별 차별화
```
한국주식 (보수):
- 손절: -2%
- 익절: +3%
- 동시 진입: 최대 3개

미국주식 (적극):
- 손절: -5%
- 익절: +10%
- 동시 진입: 최대 5개
```

### 3. 리스크 관리
```
포트폴리오 비중:
- KR: 5% per 종목
- US: 8% per 종목

최대 손실: -2% ~ -5%/월
포트폴리오 드로다운: 15% 이하
```

---

## 📁 파일 구조

```
src/pyqqq/
├── ai_auto_trading_system.py    # 메인 통합 시스템
├── orchestrator.py               # AI 총괄 관리자 (팀장)
├── performance_evaluator.py      # 성과평가·학습
├── research_agent.py             # 리서치팀 에이전트 (팀원1)
├── analysis_agent.py             # 종목분석팀 에이전트 (팀원1)
├── strategy_agent.py             # 매매전략팀 에이전트 (팀원2)
├── watchlist_manager.py          # 리스트관리팀 에이전트 (팀원2)
├── order_execution_engine.py     # 주문실행엔진 (팀원3)
├── realtime_monitor.py           # 실시간모니터링 (팀원3)
└── README_AI_AUTO_TRADING.md    # 이 파일
```

---

## 🚀 시작하기

### Step 1: 환경 설정
```bash
export ANTHROPIC_API_KEY="your-key"
export KIS_API_KEY="your-key"
export TOSS_API_KEY="your-key"
```

### Step 2: 테스트 실행
```python
# 신호 생성 테스트
python research_agent.py
python analysis_agent.py
python strategy_agent.py
```

### Step 3: 시스템 시작
```python
python ai_auto_trading_system.py
```

### Step 4: 모니터링
```bash
# 대시보드에서 실시간 확인
# https://aios-trading.workers.dev/dashboard
```

---

## 📞 문제 해결

### 신호가 생성되지 않음
- Claude API 키 확인
- 네트워크 연결 확인
- 로그 파일 확인: `/tmp/ai_trading.log`

### 주문이 실행되지 않음
- KIS/Toss API 키 확인
- 계좌 상태 확인 (예수금 확인)
- 거래 가능 시간 확인 (09:00 ~ 15:30)

### 성과가 음수
- 손절가 기준 재검토
- 진입 타이밍 분석
- 프롬프트 개선 제안 확인

---

## 📊 예상 성과 (기준: 월단위)

| 지표 | 목표 | 기준 |
|------|-----|------|
| 신호 정확도 | >75% | 신호별 실제 결과 비교 |
| 수익률 | 월 +3~5% | 포트폴리오 성장 |
| 거래 성공률 | >60% | BUY 신호 → 익절 비율 |
| 손실 제한 | 월 -2% 이하 | 자동 손절 실행 확인 |
| 시스템 안정성 | >99.9% | API 오류율 |

---

## 🔗 관련 링크

- [AI Hedge Fund v2](https://github.com/virattt/ai-hedge-fund)
- [Anthropic Claude API](https://api.anthropic.com)
- [KIS API 문서](https://www.kis.com)
- [Toss API 문서](https://www.tosspay.com)

---

**만든이**: AI 4인 에이전트 팀  
**최종 수정**: 2026-08-02  
**버전**: 1.0.0

