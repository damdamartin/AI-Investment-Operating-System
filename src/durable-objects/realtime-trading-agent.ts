/**
 * Realtime Trading Agent - Cloudflare Durable Object
 *
 * WebSocket 기반 실시간 시장 데이터 수신 및 자동 매매
 * - 실시간 가격 스트리밍 (Toss WebSocket)
 * - 5분마다 신호 생성
 * - Claude AI 검증
 * - 즉시 주문 실행 (KIS/Toss API)
 * - 실시간 손절/익절 모니터링
 */

import Anthropic from "@anthropic-ai/sdk";
import { LiveOrderExecutor, type BrokerConfig } from "../application/orders/live-order-executor.js";

interface WorkerEnv {
  DB: D1Database;
  CLAUDE_API_KEY: string;
  TOSS_CLIENT_ID: string;
  TOSS_CLIENT_SECRET: string;
  KIS_APP_KEY?: string;
  KIS_APP_SECRET?: string;
  KIS_ACCOUNT_NUMBER?: string;
  PIPELINE_WATCHLIST?: string;
}

interface PriceUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

interface PriceData {
  price: number;
  volume: number;
  timestamp: number;
}

interface TradeSignal {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reasoning: string;
  timestamp: number;
  indicators?: any;
}

interface TradeDecision {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  quantity: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  reasoning: string;
  confidence: number;
}

interface OrderResult {
  orderId: string;
  status: "PENDING" | "FILLED" | "REJECTED";
  executionPrice: number;
  executedAt: Date;
  symbol: string;
  quantity: number;
}

export class RealtimeTradingAgent {
  private state: DurableObjectState;
  private env: WorkerEnv;
  private claude: Anthropic;
  private orderExecutor: LiveOrderExecutor;
  private priceCache: Map<string, PriceData[]> = new Map();
  private signalCache: Map<string, TradeSignal> = new Map();
  private watchlist: string[] = [];
  private isRunning = false;
  private accessToken: string = "";
  private lastSignalTime: Map<string, number> = new Map();
  private initPromise: Promise<void>;
  private broker: "KIS" | "Toss" = "Toss";

  constructor(state: DurableObjectState, env: WorkerEnv) {
    this.state = state;
    this.env = env;
    this.claude = new Anthropic({ apiKey: env.CLAUDE_API_KEY });
    this.watchlist = (env.PIPELINE_WATCHLIST || "005930,000660").split(",").map(s => s.trim());

    // 증권사 선택 (DO 이름 또는 환경 변수에 따라)
    const hasTossConfig = env.TOSS_CLIENT_ID && env.TOSS_CLIENT_SECRET;
    const hasKISConfig = env.KIS_APP_KEY && env.KIS_APP_SECRET;

    // DO 이름으로 broker 강제 선택
    const doName = this.state.id.toString().toLowerCase();
    if (doName.includes("kis")) {
      this.broker = "KIS";
    } else if (doName.includes("toss")) {
      this.broker = "Toss";
    } else if (hasTossConfig && hasKISConfig) {
      this.broker = "Toss"; // 기본값: Toss 우선
    } else if (hasKISConfig) {
      this.broker = "KIS";
    } else if (hasTossConfig) {
      this.broker = "Toss";
    }

    // Order Executor 초기화
    const brokerConfig: BrokerConfig = {
      broker: this.broker,
      appKey: env.KIS_APP_KEY,
      appSecret: env.KIS_APP_SECRET,
      clientId: env.TOSS_CLIENT_ID,
      clientSecret: env.TOSS_CLIENT_SECRET,
      accountNumber: env.KIS_ACCOUNT_NUMBER,
    };

    this.orderExecutor = new LiveOrderExecutor(brokerConfig);

    console.log(`📍 Order Broker: ${this.broker}`);

    // 비동기 초기화 (병렬 실행)
    this.initPromise = this.initialize().catch(err => {
      console.error("❌ Initialization error:", err);
    });
  }

  private async initialize() {
    console.log(`🚀 [${new Date().toISOString()}] RealtimeTradingAgent initialized`);
    console.log(`📊 Watchlist: ${this.watchlist.join(", ")}`);

    // 토큰 갱신 (선택적, 실패해도 계속)
    if (this.env.TOSS_CLIENT_ID && this.env.TOSS_CLIENT_SECRET) {
      try {
        await this.refreshTossAccessToken();
        console.log("✅ Toss token refreshed");
      } catch (error) {
        console.warn("⚠️ Toss token refresh failed (continuing without it):", error);
        // 토큰 없이도 계속 진행
      }
    }

    // 실시간 스트리밍 시작 (항상)
    this.startRealtimeStreaming();

    // 신호 생성 루프 시작 (항상)
    this.startSignalGenerationLoop();

    // 포지션 모니터링 루프 시작 (항상)
    this.startPositionMonitoringLoop();

    this.isRunning = true;
    console.log("✅ RealtimeTradingAgent is running");
  }

  // Step 1️⃣: Toss 토큰 갱신
  private async refreshTossAccessToken() {
    try {
      const response = await fetch("https://openapi.tossinvest.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: this.env.TOSS_CLIENT_ID,
          client_secret: this.env.TOSS_CLIENT_SECRET,
        }),
      });

      if (!response.ok) {
        throw new Error(`Toss token error: ${response.status}`);
      }

      const data = (await response.json()) as any;
      this.accessToken = data.access_token;
      console.log("✅ Toss access token refreshed");
    } catch (error) {
      console.error("❌ Failed to refresh Toss token:", error);
      throw error;
    }
  }

  // Step 2️⃣: 실시간 WebSocket 스트리밍 시작
  private async startRealtimeStreaming() {
    try {
      console.log("🔌 Starting Toss WebSocket connection...");

      // Toss API WebSocket 연결
      const wsUrl = "wss://streaming.tossinvest.com/stomp";

      // Note: Cloudflare Workers에서는 fetch 기반 WebSocket 사용 불가
      // 대신 HTTP 기반 폴링으로 대체 (5초 간격)
      console.log("⚠️  Using HTTP polling instead of WebSocket (Cloudflare limitation)");
      this.startPollingPrices();
    } catch (error) {
      console.error("❌ WebSocket streaming error:", error);
      // Continue with polling as fallback
      this.startPollingPrices();
    }
  }

  // Step 3️⃣: HTTP 폴링으로 가격 데이터 수신
  private startPollingPrices() {
    setInterval(async () => {
      try {
        for (const symbol of this.watchlist) {
          await this.fetchAndUpdatePrice(symbol);
        }
      } catch (error) {
        console.error("❌ Polling error:", error);
      }
    }, 5000); // 5초마다 가격 업데이트
  }

  // Step 4️⃣: Toss API로 실시간 가격 조회
  private async fetchAndUpdatePrice(symbol: string): Promise<void> {
    try {
      // Toss API의 실시간 가격 조회 엔드포인트
      const response = await fetch(
        `https://openapi.tossinvest.com/v1/stock/${symbol}/current-price`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.warn(`⚠️  Price fetch failed for ${symbol}: ${response.status}`);
        return;
      }

      const data = (await response.json()) as any;
      const currentPrice = Number(data.price) || 0;
      const volume = Number(data.volume) || 0;

      if (currentPrice > 0) {
        this.onPriceUpdate({
          symbol,
          price: currentPrice,
          volume,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error(`❌ Price fetch error for ${symbol}:`, error);
    }
  }

  // Step 5️⃣: 가격 업데이트 처리
  private onPriceUpdate(data: PriceUpdate) {
    const { symbol, price, volume, timestamp } = data;

    // 캐시에 추가
    if (!this.priceCache.has(symbol)) {
      this.priceCache.set(symbol, []);
    }

    const prices = this.priceCache.get(symbol)!;
    prices.push({ price, volume, timestamp });

    // 최근 1시간 데이터만 유지
    const oneHourAgo = Date.now() - 3600000;
    this.priceCache.set(
      symbol,
      prices.filter(p => p.timestamp > oneHourAgo)
    );

    console.log(`📊 [${symbol}] 가격 업데이트: ₩${price.toLocaleString()}`);
  }

  // Step 6️⃣: 신호 생성 루프 (5분마다)
  private startSignalGenerationLoop() {
    setInterval(async () => {
      try {
        for (const symbol of this.watchlist) {
          await this.generateSignalIfReady(symbol);
        }
      } catch (error) {
        console.error("❌ Signal generation loop error:", error);
      }
    }, 300000); // 5분 (300초)
  }

  // Step 7️⃣: 신호 생성 (5분마다 1번)
  private async generateSignalIfReady(symbol: string): Promise<void> {
    // 5분마다 1번만 신호 생성
    const lastSignal = this.lastSignalTime.get(symbol);
    if (lastSignal && Date.now() - lastSignal < 300000) {
      return;
    }

    const prices = this.priceCache.get(symbol) || [];
    if (prices.length < 10) {
      console.log(`⏳ [${symbol}] Insufficient data (${prices.length}/10)`);
      return;
    }

    try {
      // 기술적 지표 계산
      const indicators = this.calculateIndicators(symbol, prices);

      // Claude AI로 신호 생성
      const claudeSignal = await this.generateSignalWithClaude(
        symbol,
        indicators,
        prices
      );

      // 캐시에 저장
      const action = (claudeSignal.action as "BUY" | "SELL" | "HOLD") || "HOLD";
      this.signalCache.set(symbol, {
        symbol,
        action,
        confidence: claudeSignal.confidence,
        reasoning: claudeSignal.reasoning,
        timestamp: Date.now(),
        indicators,
      });

      this.lastSignalTime.set(symbol, Date.now());

      console.log(
        `📈 [${symbol}] 신호: ${claudeSignal.action} (신뢰도: ${(claudeSignal.confidence * 100).toFixed(1)}%)`
      );

      // 신호 실행 (신뢰도 >= 65%)
      if (claudeSignal.action === "BUY" && claudeSignal.confidence >= 0.65) {
        await this.executeBuySignal(symbol, claudeSignal);
      }
    } catch (error) {
      console.error(`❌ Signal generation error for ${symbol}:`, error);
    }
  }

  // Step 8️⃣: 기술적 지표 계산
  private calculateIndicators(symbol: string, prices: PriceData[]): any {
    const priceValues = prices.map(p => p.price);
    const volumes = prices.map(p => p.volume);

    return {
      currentPrice: priceValues[priceValues.length - 1],
      ma5: this.calculateMA(priceValues, 5),
      ma20: this.calculateMA(priceValues, 20),
      ma50: this.calculateMA(priceValues, 50),
      rsi: this.calculateRSI(priceValues, 14),
      macd: this.calculateMACD(priceValues),
      volume: this.analyzeVolume(volumes),
      volatility: this.calculateVolatility(priceValues),
    };
  }

  // 이동평균 계산
  private calculateMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  // RSI 계산
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = Math.max(1, prices.length - period); i < prices.length; i++) {
      const current = prices[i] ?? 0;
      const prev = prices[i - 1] ?? 0;
      const change = current - prev;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 1);
    return 100 - 100 / (1 + rs);
  }

  // MACD 계산
  private calculateMACD(prices: number[]): { value: number; signal: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return {
      value: ema12 - ema26,
      signal: (ema12 - ema26) * 0.7, // Simplified signal line
    };
  }

  // EMA 계산
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      const price = prices[i] ?? 0;
      ema = price * multiplier + ema * (1 - multiplier);
    }

    return ema;
  }

  // 거래량 분석
  private analyzeVolume(volumes: number[]): number {
    if (volumes.length === 0) return 0;
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1] || 0;
    return currentVolume / (avgVolume || 1);
  }

  // 변동성 계산
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const current = prices[i] ?? 0;
      const prev = prices[i - 1] ?? 0;
      if (prev !== 0) {
        returns.push((current - prev) / prev);
      }
    }

    if (returns.length === 0) return 0;
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((acc, r) => acc + Math.pow(r - avg, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // Step 9️⃣: Claude AI로 신호 생성
  private async generateSignalWithClaude(
    symbol: string,
    indicators: any,
    prices: PriceData[]
  ): Promise<{ action: string; confidence: number; reasoning: string }> {
    const prompt = `당신은 AI 트레이딩 봇입니다. 실시간 거래 신호를 생성합니다.

종목: ${symbol}
현재 가격: ₩${indicators.currentPrice.toLocaleString()}

기술적 지표:
- MA5: ₩${indicators.ma5.toLocaleString()}
- MA20: ₩${indicators.ma20.toLocaleString()}
- MA50: ₩${indicators.ma50.toLocaleString()}
- RSI: ${indicators.rsi.toFixed(1)}
- MACD: ${indicators.macd.value.toFixed(2)} (Signal: ${indicators.macd.signal.toFixed(2)})
- 거래량 변화: ${indicators.volume.toFixed(2)}배
- 변동성: ${(indicators.volatility * 100).toFixed(2)}%

지난 24시간 가격 범위: ₩${Math.min(...prices.map(p => p.price)).toLocaleString()} ~ ₩${Math.max(...prices.map(p => p.price)).toLocaleString()}

신호 기준:
- BUY: MA 정렬(5>20>50), RSI<70, MACD 양수, 거래량 증가
- SELL: MA 역정렬(5<20<50), RSI>30, MACD 음수, 거래량 증가
- HOLD: 위 조건 미충족

JSON으로만 응답하세요:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0 ~ 1.0,
  "reasoning": "이유"
}`;

    try {
      const response = await this.claude.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0]?.type === "text" ? (response.content[0] as any).text : "{}";
      const result = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

      return {
        action: result.action || "HOLD",
        confidence: Number(result.confidence) || 0.5,
        reasoning: result.reasoning || "Analysis complete",
      };
    } catch (error) {
      console.error(`❌ Claude API error for ${symbol}:`, error);
      return {
        action: "HOLD",
        confidence: 0,
        reasoning: "API error",
      };
    }
  }

  // Step 🔟: BUY 신호 실행
  private async executeBuySignal(
    symbol: string,
    signal: { action: string; confidence: number; reasoning: string }
  ) {
    try {
      // 동적 수량 계산 (신뢰도 기반)
      const quantity = Math.ceil(signal.confidence * 5); // 1~5주

      // 현재 가격
      const currentPrice =
        (this.priceCache.get(symbol)?.[this.priceCache.get(symbol)!.length - 1]?.price) || 0;

      if (currentPrice <= 0) {
        console.warn(`⚠️  Invalid price for ${symbol}`);
        return;
      }

      const decision: TradeDecision = {
        symbol,
        action: "BUY",
        quantity,
        entryPrice: currentPrice,
        stopLossPrice: currentPrice * 0.95, // -5%
        takeProfitPrice: currentPrice * 1.1, // +10%
        reasoning: signal.reasoning,
        confidence: signal.confidence,
      };

      // DB에 주문 기록
      await this.recordOrder(decision);
      console.log(
        `✅ [${symbol}] BUY 주문 실행: ${quantity}주 @ ₩${currentPrice.toLocaleString()}`
      );
    } catch (error) {
      console.error(`❌ Execute buy signal error for ${symbol}:`, error);
    }
  }

  // Step 1️⃣1️⃣: 실제 주문 실행 및 DB 기록
  private async recordOrder(decision: TradeDecision) {
    try {
      // 1️⃣ 실제 주문 실행 (KIS 또는 Toss API)
      const orderResult = await this.orderExecutor.executeBuyOrder(
        decision.symbol,
        decision.quantity,
        decision.entryPrice
      );

      if (!orderResult.success) {
        console.error(`❌ 주문 실패: ${orderResult.message}`);
        // 실패해도 DB에 기록 (추적용)
      }

      // 2️⃣ DB에 포지션 기록 (실제 주문 결과 포함)
      const positionId = crypto.randomUUID();
      const now = new Date().toISOString();

      await this.env.DB.prepare(
        `INSERT INTO trading_positions
          (id, symbol, quantity, entry_price, entry_date, stop_loss_price, take_profit_price, status, created_at, updated_at, broker, order_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          positionId,
          decision.symbol,
          decision.quantity,
          decision.entryPrice,
          now,
          decision.stopLossPrice,
          decision.takeProfitPrice,
          orderResult.success ? "OPEN" : "FAILED",
          now,
          now,
          orderResult.broker,
          orderResult.orderId || null
        )
        .run();

      console.log(`✅ [${orderResult.broker}] 주문 ${orderResult.success ? "성공" : "실패"}: ${positionId}`);
      console.log(`   ${orderResult.message}`);
    } catch (error) {
      console.error("❌ Record order error:", error);
    }
  }

  // Step 1️⃣2️⃣: 포지션 모니터링 루프 (10초마다)
  private startPositionMonitoringLoop() {
    setInterval(async () => {
      try {
        await this.monitorOpenPositions();
      } catch (error) {
        console.error("❌ Position monitoring error:", error);
      }
    }, 10000); // 10초마다
  }

  // Step 1️⃣3️⃣: 열린 포지션 모니터링 (손절/익절)
  private async monitorOpenPositions() {
    try {
      const positions = (await this.env.DB.prepare(
        `SELECT id, symbol, quantity, entry_price, stop_loss_price, take_profit_price FROM trading_positions WHERE status = 'OPEN'`
      ).all()) as any;

      for (const pos of positions.results || []) {
        const priceData = this.priceCache.get(pos.symbol);
        const latestPrice = priceData?.[priceData.length - 1]?.price;
        const currentPrice = latestPrice || Number(pos.entry_price);

        const pnlPercent = ((currentPrice - Number(pos.entry_price)) / Number(pos.entry_price)) * 100;

        // 손절 확인
        if (currentPrice <= Number(pos.stop_loss_price)) {
          await this.closePosition(pos.id, pos.symbol, currentPrice, "STOP_LOSS", pnlPercent);
        }
        // 익절 확인
        else if (currentPrice >= Number(pos.take_profit_price)) {
          await this.closePosition(pos.id, pos.symbol, currentPrice, "TAKE_PROFIT", pnlPercent);
        }
      }
    } catch (error) {
      console.error("❌ Monitor positions error:", error);
    }
  }

  // Step 1️⃣4️⃣: 포지션 종료 (손절/익절) - 실제 주문 실행
  private async closePosition(
    positionId: string,
    symbol: string,
    exitPrice: number,
    reason: "STOP_LOSS" | "TAKE_PROFIT",
    pnlPercent: number
  ) {
    try {
      // 포지션 데이터 조회
      const position = await this.env.DB.prepare(
        `SELECT quantity FROM trading_positions WHERE id = ?`
      )
        .bind(positionId)
        .first() as any;

      if (!position) {
        console.warn(`⚠️ Position not found: ${positionId}`);
        return;
      }

      const quantity = Number(position.quantity);

      // 1️⃣ 실제 매도 주문 실행 (손절/익절)
      const sellResult = await this.orderExecutor.executeSellOrder(
        symbol,
        quantity,
        exitPrice
      );

      if (!sellResult.success) {
        console.error(`❌ 매도 주문 실패: ${sellResult.message}`);
      }

      // 2️⃣ 포지션 상태 업데이트
      const now = new Date().toISOString();
      await this.env.DB.prepare(
        `UPDATE trading_positions
         SET status = ?, closed_at = ?, close_reason = ?, closing_price = ?, pnl_percent = ?, sell_order_id = ?, updated_at = ?
         WHERE id = ?`
      )
        .bind(
          reason === "STOP_LOSS" ? "STOPPED_OUT" : "TAKEN_PROFIT",
          now,
          reason,
          exitPrice,
          pnlPercent,
          sellResult.orderId || null,
          now,
          positionId
        )
        .run();

      console.log(
        `🛑 [${symbol}] ${reason}: 매도 ₩${exitPrice.toLocaleString()} (${pnlPercent.toFixed(2)}%) - ${sellResult.broker}`
      );
      console.log(`   주문ID: ${sellResult.orderId}`);
    } catch (error) {
      console.error("❌ Close position error:", error);
    }
  }

  // HTTP 요청 처리 (상태 조회용)
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      // 초기화 완료 대기 (최대 5초)
      await Promise.race([
        this.initPromise,
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);

      return new Response(
        JSON.stringify({
          isRunning: this.isRunning,
          watchlist: this.watchlist,
          priceCache: Object.fromEntries(
            Array.from(this.priceCache.entries()).map(([k, v]) => [
              k,
              { count: v.length, latest: v[v.length - 1] },
            ])
          ),
          lastSignals: Object.fromEntries(this.signalCache),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }
}
