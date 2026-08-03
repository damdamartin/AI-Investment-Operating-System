# 🚀 업비트 암호화폐 자동매매 엔진 가이드

## 📋 개요

이 가이드는 새로운 **Crypto Engine**을 사용해 업비트에서 자동으로 암호화폐를 매매하는 방법을 설명합니다.

### 주요 특징

✅ **실시간 시세 수신** (WebSocket)  
✅ **자동 신호 생성** (1초 주기)  
✅ **자동 주문 실행** (200ms 주기)  
✅ **체결 추적** (1초 주기)  
✅ **리스크 관리** (손실 한도, 킬 스위치)  
✅ **가상매매 모드** (실제 매매 없이 테스트)

---

## 🏗️ 아키텍처

### 실행 흐름

```
T=0s: 부팅
  ├─ API 인증 확인
  ├─ 계좌 잔고 확인
  ├─ WebSocket 연결
  └─ 4개의 타이머 시작

T=1s: 신호 생성 (1초 주기)
  ├─ 캐시에서 최신 시세 읽기
  ├─ 기술적 분석 (MA, 변동률)
  └─ BUY/SELL/HOLD 신호 생성

T=1.2s: 주문 큐 처리 (200ms 주기)
  ├─ 신호 → 주문 변환
  ├─ 리스크/자금 검증
  ├─ 중복 주문 확인
  └─ Upbit API 호출

T=2s: 체결 추적 (1초 주기)
  ├─ 주문 상태 조회
  ├─ 부분/완전 체결 감지
  └─ 포트폴리오 업데이트

T=10s: 건강 상태 보고 (10초 주기)
  └─ 시장 연결, 큐 크기, 추적 중인 주문 수
```

---

## 🔧 설정 (환경변수)

### `.env` 파일

```env
# 업비트 API
UPBIT_ACCESS_KEY=your_access_key
UPBIT_SECRET_KEY=your_secret_key

# 거래할 마켓 (쉼표로 구분)
CRYPTO_MARKETS=KRW-BTC,KRW-ETH,KRW-XRP

# 거래 모드
CRYPTO_TRADING_MODE=VIRTUAL  # VIRTUAL or LIVE

# 리스크 관리
CRYPTO_DAILY_LOSS_LIMIT=-0.02  # -2% (손실 한도)
CRYPTO_MAX_POSITION_PERCENT=0.1 # 10% (최대 포지션)
```

### 환경변수 설정 방법

```bash
# 1. 로컬 개발
export UPBIT_ACCESS_KEY=your_key
export UPBIT_SECRET_KEY=your_secret

# 2. Cloudflare Worker 배포
npx wrangler secret put UPBIT_ACCESS_KEY
npx wrangler secret put UPBIT_SECRET_KEY
```

---

## 🚀 시작하기

### Step 1: 마이그레이션 실행

```bash
# D1 데이터베이스 마이그레이션
npm run db:migrate
```

이렇게 하면 다음 테이블이 생성됩니다:
- `crypto_signals` - 신호 기록
- `crypto_orders` - 주문 기록
- `crypto_fills` - 체결 기록
- `crypto_portfolio_snapshots` - 포트폴리오 스냅샷

### Step 2: 엔진 초기화 및 시작

#### 로컬 테스트 (가상매매)

```typescript
import { CryptoEngine } from "./src/crypto-engine/bootstrap.js";
import { D1Database } from "@cloudflare/workers-types";

// 1. 엔진 생성 (가상매매 모드)
const engine = new CryptoEngine(
  {
    accessKey: process.env.UPBIT_ACCESS_KEY!,
    secretKey: process.env.UPBIT_SECRET_KEY!,
    markets: ["KRW-BTC", "KRW-ETH"],
    tradingMode: "VIRTUAL", // 실제 매매 안함
    dailyLossLimit: -0.02,  // -2%
    maxPositionPercent: 0.1  // 10%
  },
  db // D1 데이터베이스
);

// 2. 시작
await engine.start();

// 3. 상태 조회
console.log(engine.getStatus());

// 4. 종료
await engine.stop();
```

#### 프로덕션 배포 (실시간 매매)

```typescript
const engine = new CryptoEngine(
  {
    accessKey: env.UPBIT_ACCESS_KEY,
    secretKey: env.UPBIT_SECRET_KEY,
    markets: ["KRW-BTC", "KRW-ETH"],
    tradingMode: "LIVE",  // 실제 매매 시작!
    dailyLossLimit: -0.02,
    maxPositionPercent: 0.1
  },
  env.DB
);

await engine.start();
```

---

## 📊 신호 생성 로직

### 간단한 전략 (현재 구현)

신호는 다음 조건에 따라 생성됩니다:

#### BUY 신호
```
if (변동률 > +2%) {
  신뢰도 = 50% + (변동률 × 2)
  최대 95%
}
```

#### SELL 신호
```
if (변동률 < -2%) {
  신뢰도 = 50% + (|변동률| × 2)
  최대 95%
}
```

### 신호 커스터마이징

더 복잡한 전략을 원한다면 `CryptoSignalGenerator.analyzeMarket()`을 수정하세요:

```typescript
// src/crypto-engine/strategy/signal-generator.ts

private analyzeMarket(
  ticker: UpbitTicker,
  candles?: UpbitCandle[]
): CryptoSignal | null {
  // RSI, MACD, 볼린저 밴드 등 추가 지표 구현
  
  // 예: RSI 기반 신호
  const rsi = this.calculateRSI(candles);
  if (rsi > 70) {
    return { direction: "SELL", confidence: 0.8, ... };
  }
  if (rsi < 30) {
    return { direction: "BUY", confidence: 0.8, ... };
  }
}
```

---

## 🛡️ 리스크 관리

### 1. 일일 손실 한도

매일 자정에 리셋되며, 일일 손실이 한도를 초과하면 거래가 중단됩니다.

```typescript
// 예: -2% 손실 한도 설정
validator.setLimits(
  dailyLossPercent: -0.02,  // -2%
  maxPositionPercent: 0.1   // 10%
);
```

### 2. 최대 포지션 크기

한 번에 계좌의 최대 10%까지만 투자합니다.

```typescript
// 계좌: 1,000,000 KRW
// 최대 포지션: 100,000 KRW
// BTC 가격: 50,000,000 KRW
// 최대 매수량: 0.002 BTC
```

### 3. 킬 스위치

리스크 한도 초과 시 자동으로 모든 거래를 중단합니다.

```typescript
validator.activateKillSwitch("Daily loss limit exceeded");
// 이후로는 주문이 생성되지 않음

// 수동으로 해제
validator.deactivateKillSwitch();
```

---

## 📈 모니터링 및 로깅

### 주요 로그

```
[CryptoEngine] Signal generator timer started (1s interval)
[CryptoEngine] Order queue processor timer started (200ms interval)
[CryptoEngine] Fill tracker timer started (1s interval)

[WebSocket] Connected
[WebSocket] Subscribed to KRW-BTC, KRW-ETH

[SignalGenerator] Generated BUY signal for KRW-BTC (confidence: 75%)
[OrderExecutor] Enqueued order: KRW-BTC BUY x0.1
[OrderExecutor] Order submitted: uuid-123 - KRW-BTC BUY x0.1

[FillTracker] Order partially filled: uuid-123 - 0.05 @ 50,500,000
[FillTracker] Order completed: uuid-123 - Status: FILLED

[CryptoEngine] Health: markets=2/2, queue=0, tracked=1, killSwitch=false
```

### 상태 조회 API

```typescript
const status = engine.getStatus();

// 반환값
{
  isRunning: true,
  preflightChecksCompleted: true,
  marketCache: {
    totalMarkets: 2,
    recentUpdates: 2  // 최근 5초 이내 업데이트
  },
  queueSize: 0,           // 대기 중인 주문
  trackedOrders: 1,       // 추적 중인 주문
  killSwitchActive: false
}
```

---

## 📊 데이터베이스 조회

### 최근 신호 조회

```sql
SELECT * FROM crypto_signals
WHERE market = 'KRW-BTC'
ORDER BY generated_at DESC
LIMIT 10;
```

### 일일 거래 실적

```sql
SELECT 
  DATE(filled_at) as date,
  COUNT(*) as trade_count,
  SUM(profit_loss) as daily_pnl
FROM crypto_fills
GROUP BY DATE(filled_at)
ORDER BY date DESC;
```

### 현재 포지션

```sql
SELECT 
  market,
  SUM(CASE WHEN side = 'BUY' THEN volume ELSE -volume END) as quantity,
  AVG(price) as avg_price
FROM crypto_fills
GROUP BY market
HAVING quantity > 0;
```

---

## 🧪 테스트

### 단위 테스트 실행

```bash
# 모든 테스트
npm test

# Crypto Engine 테스트만
npm test -- tests/crypto-engine/bootstrap.test.ts

# 감시 모드
npm run test:watch
```

### 가상매매 테스트 절차

1. 환경변수 설정: `CRYPTO_TRADING_MODE=VIRTUAL`
2. 엔진 시작: `await engine.start()`
3. 최소 1시간 실행해서 신호 생성 확인
4. 신호가 생성되고 있는지 로그 확인
5. 데이터베이스에 기록되는지 확인
6. `CRYPTO_TRADING_MODE=LIVE`로 변경해서 실제 매매 시작

---

## ⚠️ 주의사항

### 실제 매매 전 필수 확인

- [ ] API 키가 올바르게 설정됨
- [ ] 테스트 계좌에서 가상매매 최소 7일 실행
- [ ] 손실 한도가 적절히 설정됨 (권장: -2%)
- [ ] 최대 포지션이 적절히 설정됨 (권장: 5~10%)
- [ ] Upbit 앱에서 수동 거래를 하지 않음 (충돌 방지)
- [ ] 네트워크가 안정적임

### 운영 중 주의

- 일일 손실 한도 초과 시 거래 자동 중단
- 킬 스위치 활성화 시 수동으로 해제 필요
- 시스템 종료 전 미처리 주문 확인
- 정기적인 건강 상태 모니터링

---

## 🔄 배포 및 운영

### Cloudflare Worker 배포

```bash
# 빌드
npm run build

# 배포
npx wrangler deploy --env production
```

### 스케줄 설정 (Cron 트리거)

```toml
# wrangler.toml
[env.production]
triggers.crons = ["*/1 * * * *"]  # 매 1분마다 실행
```

### 모니터링

```bash
# Worker 로그 확인
npx wrangler tail --env production

# D1 쿼리
npx wrangler d1 execute aios-pipeline --remote \
  "SELECT COUNT(*) FROM crypto_orders WHERE DATE(created_at) = CURRENT_DATE"
```

---

## 🐛 문제 해결

### WebSocket 연결 안됨

```
[WebSocket] Connection refused
```

**원인**: Upbit 서버 점검 또는 네트워크 문제  
**해결**: 5초마다 재연결 시도 (자동)

### 신호가 생성되지 않음

```
[SignalGenerator] No signals generated
```

**확인사항**:
- WebSocket이 연결되어 있는지 확인
- 시세 변동률이 ±2% 이상인지 확인
- 마켓 이름이 정확한지 확인

### 주문이 실행되지 않음

```
[OrderExecutor] Order execution error
```

**확인사항**:
- 계좌에 충분한 잔금이 있는지 확인
- API 키가 주문 권한을 가지는지 확인 (Upbit 앱에서 확인)
- 거래 가능 시간인지 확인

---

## 📚 API 레퍼런스

### CryptoEngine

```typescript
class CryptoEngine {
  // 시작
  async start(): Promise<void>

  // 종료
  async stop(): Promise<void>

  // 상태 조회
  getStatus(): {
    isRunning: boolean
    marketCache: { totalMarkets: number; recentUpdates: number }
    queueSize: number
    trackedOrders: number
    killSwitchActive: boolean
  }
}
```

### MarketCache

```typescript
class MarketCache {
  updateTicker(ticker: UpbitTicker): void
  getTicker(market: string): UpbitTicker | undefined
  getTickers(markets: string[]): Map<string, UpbitTicker>
  hasRecentUpdate(market: string, maxAgeMs?: number): boolean
  getHealth(): { totalMarkets: number; recentUpdates: number }
}
```

### CryptoSignalGenerator

```typescript
class CryptoSignalGenerator {
  generateSignal(market: string, input: SignalAnalysisInput): CryptoSignal | null
  getLastSignal(market: string): CryptoSignal | undefined
  getAllSignals(): CryptoSignal[]
}
```

### OrderExecutor

```typescript
class OrderExecutor {
  enqueue(orderRequest: CryptoOrderRequest): void
  async processQueue(): Promise<void>
  getExecutionHistory(limit?: number): OrderExecutionResult[]
  getQueueSize(): number
}
```

### FillTracker

```typescript
class FillTracker {
  trackOrder(order: TrackedOrder): void
  async checkAllFills(): Promise<void>
  getTrackedOrders(): TrackedOrder[]
  getRecentFillEvents(limit?: number): FillEvent[]
}
```

### RiskValidator

```typescript
class RiskValidator {
  async validateRisk(...): Promise<RiskCheckResult>
  async validateMoney(...): Promise<MoneyCheckResult>
  activateKillSwitch(reason: string): void
  deactivateKillSwitch(): void
  isKillSwitchActive(): boolean
  setLimits(dailyLoss: number, maxPosition: number): void
}
```

---

## 🎯 다음 단계

### 신호 알고리즘 개선

- [ ] RSI, MACD, 볼린저 밴드 추가
- [ ] 다중 시간대 분석 (1분, 5분, 15분)
- [ ] AI 모델 기반 신호 (Claude API)
- [ ] 머신 러닝 신호 최적화

### 리스크 관리 강화

- [ ] 동적 손실 한도 조정
- [ ] 승률 기반 수익 금액 조정
- [ ] 상관관계 분석 (여러 마켓 간)

### 운영 자동화

- [ ] Slack 알림 통합
- [ ] 일일/주간 성과 리포트
- [ ] 자동 손절매 설정
- [ ] 배치 정산 작업

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. **로그 확인**: `npx wrangler tail`
2. **데이터베이스 쿼리**: 거래 기록 확인
3. **Upbit 문서**: https://docs.upbit.com
4. **이 가이드 재검토**: 해결책이 있을 수 있습니다.

---

**마지막 업데이트**: 2026-08-01  
**버전**: 1.0.0
