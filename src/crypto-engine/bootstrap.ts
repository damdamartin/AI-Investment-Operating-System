/**
 * Crypto Engine Bootstrap
 * 모든 컴포넌트를 초기화하고 실행 루프를 시작
 * 실제 매매가 이뤄지는 핵심 부분
 */

import type { D1Database } from "@cloudflare/workers-types";
import { UpbitClient } from "./config/upbit-client.js";
import { MarketCache } from "./market-data/market-cache.js";
import { UpbitWebSocketListener } from "./market-data/websocket-listener.js";
import { CryptoSignalGenerator } from "./strategy/signal-generator.js";
import { OrderExecutor } from "./order/order-executor.js";
import { RiskValidator } from "./order/risk-validator.js";
import { FillTracker } from "./fill-tracking/fill-tracker.js";

export interface CryptoEngineConfig {
  accessKey: string;
  secretKey: string;
  markets: string[];
  tradingMode: "VIRTUAL" | "LIVE";
  dailyLossLimit: number;
  maxPositionPercent: number;
}

export class CryptoEngine {
  private config: CryptoEngineConfig;
  private db: D1Database;

  // 컴포넌트들
  private upbitClient: UpbitClient;
  private marketCache: MarketCache;
  private webSocketListener: UpbitWebSocketListener;
  private signalGenerator: CryptoSignalGenerator;
  private orderExecutor: OrderExecutor;
  private riskValidator: RiskValidator;
  private fillTracker: FillTracker;

  // 타이머들
  private signalGeneratorTimer: ReturnType<typeof setInterval> | null = null;
  private orderQueueProcessorTimer: ReturnType<typeof setInterval> | null = null;
  private fillTrackerTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  // 상태
  private isRunning = false;
  private preflightChecksCompleted = false;

  constructor(config: CryptoEngineConfig, db: D1Database) {
    this.config = config;
    this.db = db;

    // 컴포넌트 초기화
    this.upbitClient = new UpbitClient({
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });

    this.marketCache = new MarketCache();

    this.webSocketListener = new UpbitWebSocketListener(this.marketCache, {
      markets: config.markets,
      reconnectDelayMs: 3000,
      maxReconnectAttempts: 10
    });

    this.signalGenerator = new CryptoSignalGenerator(this.marketCache);
    this.orderExecutor = new OrderExecutor(this.upbitClient, db);
    this.riskValidator = new RiskValidator(db);
    this.fillTracker = new FillTracker(this.upbitClient, db);

    // 리스크 제한 설정
    this.riskValidator.setLimits(config.dailyLossLimit, config.maxPositionPercent);
  }

  /**
   * 시스템 부팅
   * 모든 검증 통과 후 거래 시작
   */
  async start(): Promise<void> {
    console.log("[CryptoEngine] Starting bootstrap...");

    try {
      // 1. 사전 검증
      await this.runPreflightChecks();
      this.preflightChecksCompleted = true;

      // 2. WebSocket 연결
      console.log("[CryptoEngine] Connecting WebSocket...");
      await this.webSocketListener.connect();

      // 3. 타이머 시작
      this.startTimers();

      this.isRunning = true;
      console.log("[CryptoEngine] ✅ Crypto Engine started successfully");
      console.log(`[CryptoEngine] Mode: ${this.config.tradingMode}`);
      console.log(`[CryptoEngine] Markets: ${this.config.markets.join(", ")}`);
    } catch (error) {
      console.error(`[CryptoEngine] Bootstrap failed: ${error}`);
      await this.stop();
      throw error;
    }
  }

  /**
   * 시스템 종료
   */
  async stop(): Promise<void> {
    console.log("[CryptoEngine] Stopping...");

    this.isRunning = false;

    // 타이머 중지
    if (this.signalGeneratorTimer) {
      clearInterval(this.signalGeneratorTimer);
    }
    if (this.orderQueueProcessorTimer) {
      clearInterval(this.orderQueueProcessorTimer);
    }
    if (this.fillTrackerTimer) {
      clearInterval(this.fillTrackerTimer);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // WebSocket 종료
    this.webSocketListener.disconnect();

    console.log("[CryptoEngine] ✅ Stopped");
  }

  /**
   * 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      preflightChecksCompleted: this.preflightChecksCompleted,
      marketCache: this.marketCache.getHealth(),
      queueSize: this.orderExecutor.getQueueSize(),
      trackedOrders: this.fillTracker.getTrackedOrders().length,
      killSwitchActive: this.riskValidator.isKillSwitchActive()
    };
  }

  // ======================== Private Methods ========================

  /**
   * 부팅 전 검증
   */
  private async runPreflightChecks(): Promise<void> {
    console.log("[CryptoEngine] Running preflight checks...");

    // 1. API 인증 확인
    console.log("[CryptoEngine] Checking API authentication...");
    const authValid = await this.upbitClient.testAuth();
    if (!authValid) {
      throw new Error("API authentication failed");
    }
    console.log("[CryptoEngine] ✅ API authentication passed");

    // 2. 계좌 잔고 확인
    console.log("[CryptoEngine] Checking account balance...");
    const accounts = await this.upbitClient.getAccounts();
    const krwAccount = accounts.find((a) => a.currency === "KRW");
    if (!krwAccount || krwAccount.balance < 10000) {
      throw new Error("Insufficient KRW balance (minimum 10,000 KRW required)");
    }
    console.log(`[CryptoEngine] ✅ Account balance check passed: ${krwAccount.balance.toFixed(0)} KRW`);

    // 3. 마켓 정보 조회 (캐시)
    console.log("[CryptoEngine] Fetching market information...");
    try {
      const markets = await this.upbitClient.getMarkets();
      const supportedMarkets = markets.filter((m) =>
        this.config.markets.some((cm) => m.market === cm)
      );
      if (supportedMarkets.length !== this.config.markets.length) {
        console.warn(
          `[CryptoEngine] Some markets not found: requested ${this.config.markets.length}, found ${supportedMarkets.length}`
        );
      }
      console.log(
        `[CryptoEngine] ✅ Market information loaded: ${supportedMarkets.map((m) => m.market).join(", ")}`
      );
    } catch (error) {
      throw new Error(`Market information fetch failed: ${error}`);
    }

    // 4. 데이터베이스 연결 확인
    console.log("[CryptoEngine] Checking database connection...");
    try {
      await this.db.prepare("SELECT COUNT(*) as count FROM crypto_orders LIMIT 1").first<{ count: number }>();
      console.log("[CryptoEngine] ✅ Database connection check passed");
    } catch (error) {
      throw new Error(`Database check failed: ${error}`);
    }

    // 5. 가상매매 모드 검증 (필요시)
    if (this.config.tradingMode === "VIRTUAL") {
      console.log("[CryptoEngine] Running in VIRTUAL mode (no real trades)");
    } else {
      console.log("[CryptoEngine] Running in LIVE mode (real trading enabled)");
    }

    console.log("[CryptoEngine] ✅ All preflight checks passed");
  }

  /**
   * 실행 타이머 시작
   * - 1초: 신호 생성
   * - 200ms: 주문 큐 처리
   * - 1초: 체결 추적
   * - 10초: 건강 상태 확인
   */
  private startTimers(): void {
    console.log("[CryptoEngine] Starting execution timers...");

    // 1️⃣ 신호 생성 (1초 주기)
    this.signalGeneratorTimer = setInterval(() => {
      this.runSignalGeneration();
    }, 1000);
    console.log("[CryptoEngine] ✅ Signal generator timer started (1s interval)");

    // 2️⃣ 주문 큐 처리 (200ms 주기)
    this.orderQueueProcessorTimer = setInterval(() => {
      this.processOrderQueue();
    }, 200);
    console.log("[CryptoEngine] ✅ Order queue processor timer started (200ms interval)");

    // 3️⃣ 체결 추적 (1초 주기)
    this.fillTrackerTimer = setInterval(() => {
      this.trackFills();
    }, 1000);
    console.log("[CryptoEngine] ✅ Fill tracker timer started (1s interval)");

    // 4️⃣ 건강 상태 확인 (10초 주기)
    this.healthCheckTimer = setInterval(() => {
      this.reportHealth();
    }, 10000);
    console.log("[CryptoEngine] ✅ Health check timer started (10s interval)");
  }

  /**
   * 신호 생성 (1초 주기)
   */
  private async runSignalGeneration(): Promise<void> {
    if (!this.isRunning) return;

    try {
      for (const market of this.config.markets) {
        const ticker = this.marketCache.getTicker(market);
        if (!ticker) {
          continue; // 아직 시세 수신 안됨
        }

        const signal = this.signalGenerator.generateSignal(market, { ticker });
        if (!signal) {
          continue;
        }

        // 신호가 생성됨 → 주문 생성 검토
        await this.processSignal(signal);
      }
    } catch (error) {
      console.error(`[CryptoEngine] Signal generation error: ${error}`);
    }
  }

  /**
   * 신호를 주문으로 변환
   */
  private async processSignal(signal: any): Promise<void> {
    try {
      // 수량 결정 (간단한 예시: 계정의 1% 사용)
      const accounts = await this.upbitClient.getAccounts();
      const krwAccount = accounts.find((a) => a.currency === "KRW");
      if (!krwAccount) return;

      const accountValue = krwAccount.balance;
      const investAmount = accountValue * 0.01; // 1%
      const quantity = investAmount / signal.price;

      // 리스크 검증
      const riskCheck = await this.riskValidator.validateRisk(signal, quantity, accountValue);
      if (!riskCheck.passed) {
        console.warn(`[CryptoEngine] Risk check failed for ${signal.market}: ${riskCheck.reasons.join(", ")}`);
        if (riskCheck.killSwitchActive) {
          this.riskValidator.activateKillSwitch("Risk check triggered kill switch");
        }
        return;
      }

      // 자금 검증
      const moneyCheck = await this.riskValidator.validateMoney(quantity, signal.price, accounts);
      if (!moneyCheck.passed) {
        console.warn(
          `[CryptoEngine] Money check failed for ${signal.market}: ${moneyCheck.reasons.join(", ")}`
        );
        return;
      }

      // 주문 생성
      const order = {
        id: `ord-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        signal,
        quantity,
        limitPrice: signal.price,
        riskCheckPassed: riskCheck.passed,
        moneyCheckPassed: moneyCheck.passed
      };

      // 주문 큐에 추가
      this.orderExecutor.enqueue(order);
    } catch (error) {
      console.error(`[CryptoEngine] Signal processing error: ${error}`);
    }
  }

  /**
   * 주문 큐 처리 (200ms 주기)
   */
  private async processOrderQueue(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // 가상매매 모드 확인
      if (this.config.tradingMode === "VIRTUAL") {
        // 가상매매 모드에서는 주문을 제출하지 않음
        return;
      }

      await this.orderExecutor.processQueue();
    } catch (error) {
      console.error(`[CryptoEngine] Order queue processing error: ${error}`);
    }
  }

  /**
   * 체결 추적 (1초 주기)
   */
  private async trackFills(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.fillTracker.checkAllFills();
    } catch (error) {
      console.error(`[CryptoEngine] Fill tracking error: ${error}`);
    }
  }

  /**
   * 건강 상태 보고
   */
  private reportHealth(): void {
    const status = this.getStatus();
    console.log(
      `[CryptoEngine] Health: markets=${status.marketCache.recentUpdates}/${status.marketCache.totalMarkets}, queue=${status.queueSize}, tracked=${status.trackedOrders}, killSwitch=${status.killSwitchActive}`
    );
  }
}
