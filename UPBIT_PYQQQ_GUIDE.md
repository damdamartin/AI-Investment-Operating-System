# 🚀 Upbit PyQQQ 자동매매 시스템 가이드

> **로컬 머신에서 Python으로 실행하는 업비트 암호화폐 자동매매**

---

## 📋 시스템 요구사항

```bash
# Python 3.9+
python3 --version

# 필수 패키지
pip install aiohttp pydantic-settings python-dotenv
```

---

## 🔧 설정

### 1. 환경변수 확인 (.env 파일)

```bash
cat ~/Documents/Codex/AI-Investment-Operating-System/.env | grep UPBIT
```

출력:
```
UPBIT_ACCESS_KEY=iIclDMScT9W3oxkVHaMmphuxOneigilAxBqn0DSp
UPBIT_SECRET_KEY=RCbdIOgBJespPI4fbgkTnOswxexeiuHWPvYz8FuV
UPBIT_MARKETS=KRW-BTC,KRW-ETH,KRW-SOL,KRW-ADA
UPBIT_TRADING_ENABLED=true
```

### 2. API 키 재확인

- ✅ Access Key 유효한지 확인
- ✅ Secret Key 유효한지 확인
- ✅ IP 화이트리스트에 현재 IP 등록

```bash
# 현재 IP 확인
curl https://api.ipify.org
```

---

## ▶️ 실행

### 방법 1: 직접 실행 (로컬 테스트)

```bash
cd ~/Documents/Codex/AI-Investment-Operating-System

# 1. 의존성 설치
pip install aiohttp pydantic-settings python-dotenv

# 2. PyQQQ 전략 실행
python3 -m src.pyqqq.strategy_upbit
```

### 방법 2: 한 번만 실행 (테스트용)

```python
# test_upbit_strategy.py 생성
import asyncio
from src.pyqqq.strategy_upbit import UpbitTradingStrategy

async def test():
    strategy = UpbitTradingStrategy()
    await strategy.run(once=True)  # 한 번만 실행

asyncio.run(test())
```

```bash
python3 test_upbit_strategy.py
```

---

## 📊 실행 시 로그 예시

```
🚀 Upbit 암호화폐 자동매매 시작
🔐 거래 활성화: True
✅ Upbit API 인증 성공

[14:23:45] 거래 사이클 시작
💰 KRW 잔액: ₩100,000

📊 모니터링 마켓: KRW-BTC, KRW-ETH, KRW-SOL, KRW-ADA
📊 KRW-BTC: ₩45,000,000
📊 KRW-ETH: ₩2,500,000

🟢 KRW-BTC: BUY (신뢰도 78%, 진입가 ₩45,000,000)
✅ KRW-BTC 매수 주문 완료

🔍 포지션 모니터링: 1개
📈 KRW-BTC: +2.50% (현재가 ₩46,125,000)

============================================================
```

---

## ⚙️ 설정 변경

### 거래 활성화/비활성화

```bash
# 거래 활성화
UPBIT_TRADING_ENABLED=true

# 거래 비활성화 (신호 생성만)
UPBIT_TRADING_ENABLED=false
```

### 모니터링 마켓 변경

```bash
# .env 파일 수정
UPBIT_MARKETS=KRW-BTC,KRW-ETH,KRW-SOL,KRW-ADA
```

### 손절/익절 비율

```bash
# config.py에서 조정
stop_loss_pct: float = float(os.getenv("STOP_LOSS_PCT", "-5"))      # -5%
take_profit_pct: float = float(os.getenv("TAKE_PROFIT_PCT", "10"))  # +10%
```

---

## 🔍 파일 구조

```
src/pyqqq/
├── upbit_client.py          # Upbit API 클라이언트
├── strategy_upbit.py        # 자동매매 전략 (NEW!)
├── toss_client.py           # Toss API 클라이언트 (기존)
├── claude_analyzer.py       # Claude AI 분석
├── position_manager.py      # 포지션 관리
├── config.py                # 환경설정
└── __init__.py
```

---

## 🎯 주요 기능

### ✅ 완성된 기능

- Upbit API 인증 (JWT 기반)
- 실시간 시세 조회
- 신호 생성 (간단한 로직, Claude 미연동)
- 매수/매도 자동 실행
- 손절/익절 자동화
- 포지션 모니터링
- 포지션 저장/복원

### 🔄 다음 단계

- [ ] Claude AI 신호 분석 통합
- [ ] 고급 기술적 지표 추가
- [ ] Slack/이메일 알림
- [ ] 웹 대시보드
- [ ] 백테스트 기능

---

## 🚨 주의사항

### ⚠️ 거래 비활성화 상태에서 시작

```bash
# 처음에는 거래를 비활성화하고 신호만 확인
UPBIT_TRADING_ENABLED=false
```

### ⚠️ 작은 규모로 테스트

```bash
# .env에서 주문 금액 제한
# 현재: 가용 현금의 5%로 설정
# 필요시 조정 (strategy_upbit.py 라인 156 참조)
```

### ⚠️ 로그 확인

실시간으로 로그를 확인하여 매매가 정상 진행되는지 모니터링하세요.

---

## 💡 문제 해결

### Q1: "Upbit API 인증 실패"

**원인**: API 키가 유효하지 않음

**해결**:
```bash
# 1. API 키 확인
cat .env | grep UPBIT

# 2. 업비트에서 새 API 키 발급
# https://upbit.com/service_center/open_api_guide
```

### Q2: "주문이 실행되지 않음"

**원인**: UPBIT_TRADING_ENABLED=false

**해결**:
```bash
# .env 파일에서 변경
UPBIT_TRADING_ENABLED=true
```

### Q3: "IP 화이트리스트 오류"

**원인**: 등록된 IP와 다름

**해결**:
```bash
# 현재 IP 확인
curl https://api.ipify.org

# 업비트 API 설정에서 IP 등록
# https://upbit.com/service_center/open_api_guide
```

---

## 📊 포지션 저장 위치

```bash
# JSON 파일로 저장됨
ls -la positions_*.json
```

---

## 🎯 최종 체크리스트

- [ ] Python 3.9+ 설치
- [ ] 패키지 설치 (aiohttp, pydantic-settings)
- [ ] .env 파일 설정 확인
- [ ] API 키 유효성 확인
- [ ] 현재 IP 확인 및 업비트에 등록
- [ ] UPBIT_TRADING_ENABLED=false로 시작
- [ ] 첫 실행 테스트
- [ ] 로그 모니터링
- [ ] 신호 생성 확인
- [ ] 준비 완료시 UPBIT_TRADING_ENABLED=true 변경

---

## 🚀 시작하기

```bash
# 1. 프로젝트 디렉토리로 이동
cd ~/Documents/Codex/AI-Investment-Operating-System

# 2. 패키지 설치
pip install aiohttp pydantic-settings python-dotenv

# 3. 테스트 실행 (거래 비활성화)
# .env에서 UPBIT_TRADING_ENABLED=false 확인
python3 -m src.pyqqq.strategy_upbit

# 4. 로그 모니터링하며 신호 확인

# 5. 준비되면 UPBIT_TRADING_ENABLED=true로 변경 후 다시 실행
```

---

**이제 PyQQQ로 Upbit 자동매매가 준비되었습니다! 🎉**
