# ⚡ Crypto Trading 로컬 실행 - 빠른 시작 가이드

> 🎯 **목표**: 로컬 머신의 고정 IP에서 업비트 실거래 자동 실행

---

## 🔴 중요: IP 화이트리스트 먼저 설정!

### Step 1: 현재 IP 확인
```bash
curl https://api.ipify.org
# 출력: 123.45.67.89
```

### Step 2: 업비트 API 설정에서 IP 등록
1. https://upbit.com/service_center/open_api_guide 접속
2. **API 권한 관리** → **IP 화이트리스트**
3. 위의 IP 주소 추가

---

## 🔑 API 키 설정

```bash
# 1. .env 파일 생성
cp .env.example .env

# 2. 텍스트 에디터에서 .env 수정:
#    UPBIT_ACCESS_KEY=your-key
#    UPBIT_SECRET_KEY=your-secret
```

---

## ▶️ 실행

```bash
# 1. 의존성 설치 (처음 한 번만)
npm install

# 2. 빌드
npm run build

# 3. 시작!
npm run crypto:trading:local
```

---

## ✅ 확인사항

### 콘솔에서 확인
```
✅ API 인증 성공!
✅ 현재 잔액: ₩100,000
✅ WebSocket 연결 성공!
✅ 주문 완료: ...
```

### 업비트 앱에서 확인
- 내 정보 → 자산 → 거래 기록 확인
- 포트폴리오 변화 확인

---

## ⏹️ 중지

```bash
# 터미널에서 Ctrl+C
^C
```

---

## 📚 자세한 가이드

더 자세한 설정/문제 해결은 `CRYPTO_TRADING_LOCAL.md` 참조!

**모든 거래는 실거래입니다. 신중히 진행하세요! 🚀**
