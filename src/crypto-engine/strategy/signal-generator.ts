/**
 * Crypto Trading Signal Generator
 * 매 1초마다 신호 생성
 * 간단한 기술적 분석 기반 신호
 */

import type { UpbitTicker, UpbitCandle } from "../config/upbit-client.js";
import type { MarketCache } from "../market-data/market-cache.js";

export type SignalDirection = "BUY" | "SELL" | "HOLD";

export interface CryptoSignal {
  id: string;
  market: string;
  direction: SignalDirection;
  confidence: number; // 0 ~ 1
  price: number;
  timestamp: Date;
  reason: string;
  idempotencyKey: string; // 5초 단위로 같은 key를 가짐
}

export interface SignalAnalysisInput {
  ticker: UpbitTicker;
  candles?: UpbitCandle[]; // 선택사항
  accountBalance?: number;
}

export class CryptoSignalGenerator {
  private cache: MarketCache;
  private lastGeneratedSignals: Map<string, CryptoSignal> = new Map();

  constructor(cache: MarketCache) {
    this.cache = cache;
  }

  /**
   * 신호 생성 (매 1초 호출)
   */
  generateSignal(market: string, input: SignalAnalysisInput): CryptoSignal | null {
    const ticker = input.ticker;

    // 1. 기본 검증
    if (!ticker || !ticker.market) {
      return null;
    }

    // 2. 기술적 분석
    const signal = this.analyzeMarket(ticker, input.candles);

    if (!signal) {
      return null;
    }

    // 3. Idempotency Key 설정 (5초 단위)
    signal.idempotencyKey = this.generateIdempotencyKey(market, signal.direction);

    // 4. 캐시에 저장
    this.lastGeneratedSignals.set(market, signal);

    return signal;
  }

  /**
   * 기술적 분석을 통한 신호 생성
   */
  private analyzeMarket(
    ticker: UpbitTicker,
    candles?: UpbitCandle[]
  ): CryptoSignal | null {
    const price = ticker.trade_price;
    const change = ticker.signed_change_rate;
    const changePrice = ticker.signed_change_price;

    // 간단한 전략: 변동성 + 방향성 기반
    // (실제 운영에서는 더 복잡한 기술적 지표 사용)

    let direction: SignalDirection = "HOLD";
    let confidence = 0;
    let reason = "";

    if (candles && candles.length >= 2) {
      // 캔들 데이터가 있으면 MA, RSI 등 활용 가능
      const shortMA = this.calculateMA(candles.slice(-5).map((c) => c.closing_price), 5);
      const longMA = this.calculateMA(candles.map((c) => c.closing_price), candles.length);

      if (shortMA > longMA && change > 0) {
        direction = "BUY";
        confidence = Math.min(0.95, 0.5 + Math.abs(change) * 2);
        reason = `Golden Cross: SMA5(${shortMA.toFixed(0)}) > SMA(${longMA.toFixed(0)}) + positive change(${(change * 100).toFixed(2)}%)`;
      } else if (shortMA < longMA && change < 0) {
        direction = "SELL";
        confidence = Math.min(0.95, 0.5 + Math.abs(change) * 2);
        reason = `Death Cross: SMA5(${shortMA.toFixed(0)}) < SMA(${longMA.toFixed(0)}) + negative change(${(change * 100).toFixed(2)}%)`;
      }
    } else {
      // 캔들 데이터 없이 틱 데이터만으로
      // 변화율이 크면 신호 생성
      if (change > 0.02 && changePrice > 0) {
        direction = "BUY";
        confidence = Math.min(0.85, 0.5 + change * 5);
        reason = `Positive momentum: change=${(change * 100).toFixed(2)}%, price=${price}`;
      } else if (change < -0.02 && changePrice < 0) {
        direction = "SELL";
        confidence = Math.min(0.85, 0.5 + Math.abs(change) * 5);
        reason = `Negative momentum: change=${(change * 100).toFixed(2)}%, price=${price}`;
      }
    }

    if (direction === "HOLD") {
      return null;
    }

    return {
      id: `sig-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      market: ticker.market,
      direction,
      confidence,
      price,
      timestamp: new Date(),
      reason,
      idempotencyKey: "" // 나중에 설정됨
    };
  }

  /**
   * Idempotency Key 생성 (5초 단위로 같은 key)
   */
  private generateIdempotencyKey(market: string, direction: SignalDirection): string {
    const timeBlock = Math.floor(Date.now() / 5000); // 5초 단위
    return `${market}-${direction}-${timeBlock}`;
  }

  /**
   * 마지막 신호 조회
   */
  getLastSignal(market: string): CryptoSignal | undefined {
    return this.lastGeneratedSignals.get(market);
  }

  /**
   * 모든 신호 조회
   */
  getAllSignals(): CryptoSignal[] {
    return Array.from(this.lastGeneratedSignals.values());
  }

  // ======================== Private Methods ========================

  private calculateMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / Math.min(period, prices.length);
  }
}
