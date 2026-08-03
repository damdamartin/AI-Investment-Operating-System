/**
 * 로컬 머신에서 실행하는 Crypto Trading Engine
 * - 사용자의 고정 IP에서 요청 발생
 * - 업비트 IP 화이트리스트에 IP 등록하면 실거래 가능
 * - 매 1분마다 자동 실행
 *
 * 사용법:
 * 1. export UPBIT_ACCESS_KEY="your-key"
 * 2. export UPBIT_SECRET_KEY="your-secret"
 * 3. npm run crypto:trading:local
 */

import fs from "fs";
import path from "path";
import { UpbitClient } from "../crypto-engine/config/upbit-client.js";
import { MarketCache } from "../crypto-engine/market-data/market-cache.js";
import { UpbitWebSocketListener } from "../crypto-engine/market-data/websocket-listener.js";
import { CryptoSignalGenerator } from "../crypto-engine/strategy/signal-generator.js";

// .env 파일 로드
function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
  }
}

class LocalCryptoTradingEngine {
  private upbitClient: UpbitClient;
  private marketCache: MarketCache;
  private wsListener: UpbitWebSocketListener;
  private signalGenerator: CryptoSignalGenerator;
  private isRunning = false;
  private executionInterval: ReturnType<typeof setInterval> | null = null;
  private tradeCount = 0;

  constructor(accessKey: string, secretKey: string) {
    this.upbitClient = new UpbitClient({
      accessKey,
      secretKey
    });

    this.marketCache = new MarketCache();

    this.wsListener = new UpbitWebSocketListener(this.marketCache, {
      markets: ["KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-ADA"],
      reconnectDelayMs: 3000,
      maxReconnectAttempts: 10
    });

    this.signalGenerator = new CryptoSignalGenerator(this.marketCache);
  }

  async start(): Promise<void> {
    console.log("🚀 로컬 Crypto Trading Engine 시작...\n");

    try {
      // 1. API 인증 확인
      console.log("1️⃣ API 인증 확인...");
      const authValid = await this.upbitClient.testAuth();
      if (!authValid) {
        console.error("❌ API 인증 실패!");
        console.error("  - Upbit Access Key 확인");
        console.error("  - Upbit Secret Key 확인");
        process.exit(1);
      }
      console.log("✅ API 인증 성공!\n");

      // 2. 계좌 잔고 확인
      console.log("2️⃣ 계좌 잔고 확인...");
      const accounts = await this.upbitClient.getAccounts();
      const krwAccount = accounts.find((a) => a.currency === "KRW");
      if (!krwAccount) {
        console.error("❌ KRW 계좌 없음!");
        process.exit(1);
      }
      console.log(`✅ 현재 잔액: ₩${krwAccount.balance.toLocaleString()}\n`);

      // 3. WebSocket 연결
      console.log("3️⃣ WebSocket 연결 중...");
      await this.wsListener.connect();
      console.log("✅ WebSocket 연결 성공!\n");

      this.isRunning = true;

      // 4. 매 1분마다 거래 실행
      console.log("4️⃣ 거래 사이클 시작 (매 1분마다)\n");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📝 거래 기록:\n");

      // 첫 실행
      await this.executeTradingCycle();

      // 이후 매 1분마다 실행
      this.executionInterval = setInterval(async () => {
        await this.executeTradingCycle();
      }, 60000); // 60초 = 1분

    } catch (error) {
      console.error("❌ 시작 오류:", error);
      process.exit(1);
    }
  }

  private async executeTradingCycle(): Promise<void> {
    const timestamp = new Date().toLocaleTimeString("ko-KR");
    this.tradeCount++;

    try {
      console.log(`\n[${timestamp}] 사이클 #${this.tradeCount} 실행 중...`);

      // 신호 생성
      const markets = ["KRW-BTC", "KRW-ETH", "KRW-SOL", "KRW-ADA"];
      let signalCount = 0;

      for (const market of markets) {
        const ticker = this.marketCache.getTicker(market);
        if (!ticker) {
          console.log(`  ⏳ ${market}: 시세 대기 중...`);
          continue;
        }

        const signal = this.signalGenerator.generateSignal(market, { ticker });
        if (signal && signal.direction !== "HOLD") {
          signalCount++;
          console.log(`  📊 ${market}: ${signal.direction} (신뢰도: ${signal.confidence}%)`);

          // 실제 주문 실행
          try {
            const orderResult = await this.placeOrder(
              market,
              signal.direction as "BUY" | "SELL",
              ticker.trade_price
            );
            if (orderResult) {
              console.log(`     ✅ 주문 완료: ${orderResult}`);
            }
          } catch (error) {
            console.log(`     ⚠️ 주문 실패: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      if (signalCount === 0) {
        console.log(`  ℹ️ 신호 없음 (다음 사이클 대기...)`);
      } else {
        console.log(`  📈 총 ${signalCount}개 신호 생성`);
      }

    } catch (error) {
      console.error(`❌ 사이클 오류: ${error}`);
    }
  }

  private async placeOrder(
    market: string,
    direction: "BUY" | "SELL",
    price: number
  ): Promise<string | null> {
    try {
      const order = await this.upbitClient.placeOrder({
        market,
        side: direction,
        ord_type: "LIMIT",
        price: Math.floor(price), // 지정가는 정수
        volume: 10000 / price // ₩10,000 기준
      });

      return `${order.uuid.substring(0, 8)}... (상태: ${order.state})`;
    } catch (error) {
      if (error instanceof Error) {
        // IP 화이트리스트 에러 감지
        if (error.message.includes("ip") || error.message.includes("whitelist")) {
          console.log("\n⚠️  ⚠️  ⚠️  중요: IP 화이트리스트 오류 감지 ⚠️  ⚠️  ⚠️");
          console.log("업비트 API 설정에서 다음 IP를 화이트리스트에 추가하세요:");
          console.log("현재 요청 IP: " + this.getCurrentIP());
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        }
        throw error;
      }
      throw error;
    }
  }

  private getCurrentIP(): string {
    // 로컬에서 실행되므로 ISP 할당 IP 사용
    return "(업비트 거래 실패 시 로그에 표시될 예정)";
  }

  stop(): void {
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
    }
    this.wsListener.disconnect();
    this.isRunning = false;
    console.log("\n\n🛑 Crypto Trading Engine 중지됨");
  }
}

// 메인 실행
async function main() {
  // .env 파일 로드
  loadEnvFile();

  const accessKey = process.env.UPBIT_ACCESS_KEY;
  const secretKey = process.env.UPBIT_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.error("❌ 오류: 환경변수를 설정하세요");
    console.error("\n사용법:");
    console.error("  export UPBIT_ACCESS_KEY=\"your-access-key\"");
    console.error("  export UPBIT_SECRET_KEY=\"your-secret-key\"");
    console.error("  npm run crypto:trading:local");
    process.exit(1);
  }

  const engine = new LocalCryptoTradingEngine(accessKey, secretKey);

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n⏹️  종료 신호 수신. 정리 중...");
    engine.stop();
    process.exit(0);
  });

  await engine.start();
}

main().catch(console.error);
