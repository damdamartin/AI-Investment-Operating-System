# 🚀 로컬 머신에서 Crypto Trading 실행 가이드

> **사용자의 고정 IP에서 요청 발생 → 업비트 IP 화이트리스트에 등록하면 실거래 가능**

## 📋 목표
- ✅ 업비트 실거래 자동 실행
- ✅ 매 1분마다 신호 생성 및 거래
- ✅ 사용자의 등록된 IP에서만 거래 (IP 화이트리스트 우회)
- ✅ ₩100,000 초기 자금, -10% 일일 손실 제한

---

## 🔧 1단계: 업비트 API 설정

### 1.1 API 키 생성
1. [업비트 API 가이드](https://upbit.com/service_center/open_api_guide) 접속
2. **개인 API 관리** → **Open API 신청**
3. 심사 완료 후 **Access Key**, **Secret Key** 복사

### 1.2 IP 화이트리스트 등록 (중요!)
1. 업비트 API 설정 페이지에서 **API 권한 관리**
2. **IP 화이트리스트** 섹션에서 현재 PC의 IP 추가

**현재 IP 확인 방법:**
```bash
# 터미널에서 실행
curl https://api.ipify.org
```

---

## 🔑 2단계: 환경변수 설정

### 2.1 `.env` 파일 생성
```bash
# 프로젝트 루트에서
cp .env.example .env
```

### 2.2 `.env` 파일 수정
```bash
# .env 파일을 텍스트 에디터로 열고:

# 1. Upbit Access Key 입력
UPBIT_ACCESS_KEY=your-actual-access-key

# 2. Upbit Secret Key 입력
UPBIT_SECRET_KEY=your-actual-secret-key

# 3. (선택) 거래 모드 설정
CRYPTO_TRADING_MODE=LIVE

# 4. (선택) 일일 최대 손실 제한
CRYPTO_DAILY_LOSS_LIMIT=-0.10

# 5. (선택) 최대 포지션 비율
CRYPTO_MAX_POSITION_PERCENT=0.20
```

---

## 🚀 3단계: 로컬 스크립트 실행

### 3.1 빌드 및 시작
```bash
# 프로젝트 루트에서:

# 1단계: 의존성 설치 (처음 한 번만)
npm install

# 2단계: TypeScript 빌드
npm run build

# 3단계: Crypto Trading 엔진 시작
npm run crypto:trading:local
```

### 3.2 예상 출력
```
🚀 로컬 Crypto Trading Engine 시작...

1️⃣ API 인증 확인...
✅ API 인증 성공!

2️⃣ 계좌 잔고 확인...
✅ 현재 잔액: ₩100,000

3️⃣ WebSocket 연결 중...
✅ WebSocket 연결 성공!

4️⃣ 거래 사이클 시작 (매 1분마다)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 거래 기록:

[14:23:45] 사이클 #1 실행 중...
  📊 KRW-BTC: BUY (신뢰도: 78%)
     ✅ 주문 완료: abc12345... (상태: pending)
  📊 KRW-ETH: SELL (신뢰도: 65%)
     ✅ 주문 완료: def67890... (상태: pending)
  ℹ️ KRW-SOL: 신호 없음 (다음 사이클 대기...)
  ℹ️ KRW-ADA: 신호 없음 (다음 사이클 대기...)
  📈 총 2개 신호 생성
```

---

## ⚠️ 문제 해결

### Q1: "IP 화이트리스트 오류"가 나옴
**원인:** 업비트 API에 현재 PC IP가 등록되지 않음

**해결:**
1. `curl https://api.ipify.org` 실행으로 IP 확인
2. 업비트 API 설정 → IP 화이트리스트에 추가
3. 스크립트 재시작

### Q2: "API 인증 실패"
**원인:** Upbit Access Key 또는 Secret Key 오류

**확인:**
```bash
# .env 파일에서:
# 1. API 키가 정확히 복사되었는지 확인
# 2. 공백/줄바꿈 없는지 확인
# 3. 따옴표 없이 입력되었는지 확인
```

### Q3: "WebSocket 연결 실패"
**원인:** 네트워크 연결 문제 (간헐적)

**해결:**
- 스크립트가 자동으로 3초마다 재연결 시도
- 최대 10회까지 재시도 후 실패

### Q4: 주문이 체결되지 않음
**원인:** 지정가 주문이 매칭되지 않음

**확인:**
- 업비트 앱에서 **미체결 주문** 확인
- 시장가 주문으로 변경 필요시 알려주세요

---

## 📱 실시간 모니터링

### 🔍 거래 현황 확인
```bash
# 다른 터미널 창에서:
# 1. 업비트 앱 → 내 정보 → 자산 확인
# 2. 로컬 스크립트의 콘솔 로그 모니터링
```

### ⏹️ 스크립트 중지
```bash
# 터미널에서 Ctrl+C 입력
^C

# 또는:
# 터미널 창 닫기
```

---

## 🔄 자동 실행 설정 (선택)

### macOS - Launchd 사용
```bash
# 1. 스크립트 생성
cat > ~/Library/LaunchAgents/com.crypto-trading.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.crypto-trading.local</string>
  <key>ProgramArguments</key>
  <array>
    <string>bash</string>
    <string>-c</string>
    <string>cd /Users/mac/Documents/Codex/AI-Investment-Operating-System && npm run crypto:trading:local</string>
  </array>
  <key>StandardOutPath</key>
  <string>/tmp/crypto-trading.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/crypto-trading-error.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>UPBIT_ACCESS_KEY</key>
    <string>your-access-key</string>
    <key>UPBIT_SECRET_KEY</key>
    <string>your-secret-key</string>
  </dict>
</dict>
</plist>
PLIST

# 2. 자동 실행 활성화
launchctl load ~/Library/LaunchAgents/com.crypto-trading.plist

# 3. 로그 확인
tail -f /tmp/crypto-trading.log
```

### Linux - Cron 사용
```bash
# 1. crontab 편집
crontab -e

# 2. 추가 (매일 09:00 시작)
0 9 * * * cd /Users/mac/Documents/Codex/AI-Investment-Operating-System && npm run crypto:trading:local >> /tmp/crypto-trading.log 2>&1
```

---

## 📊 다음 단계

### ✅ 완료 후 확인사항
- [ ] 업비트 앱에서 거래 기록 확인
- [ ] 로컬 스크립트 콘솔에서 주문 로그 확인
- [ ] 포트폴리오 변화 모니터링

### 🎯 추가 최적화
- 신호 생성 알고리즘 개선 (팩터 추가)
- 리스크 관리 고도화 (손절/익절)
- 성과 측정 대시보드 통합

---

## 💬 지원

질문이나 문제가 발생하면 알려주세요!
- 스크립트 오류 → 콘솔 로그 공유
- 업비트 API 문제 → API 응답 메시지 공유
- 기타 → 설명 및 시도한 사항 공유

**기억: 모든 거래는 실거래입니다. 신중히 진행하세요! 🚀**
