/**
 * Market Data Cache
 * 최신 시세를 메모리에 유지 (WebSocket으로부터 업데이트됨)
 * 신호 생성기가 매 1초마다 읽음
 */

import type { UpbitTicker } from "../config/upbit-client.js";

export interface MarketSnapshot {
  ticker: UpbitTicker;
  updatedAt: Date;
}

export class MarketCache {
  private cache: Map<string, MarketSnapshot> = new Map();

  /**
   * 시세 업데이트 (WebSocket에서 호출)
   */
  updateTicker(ticker: UpbitTicker): void {
    this.cache.set(ticker.market, {
      ticker,
      updatedAt: new Date()
    });
  }

  /**
   * 최신 시세 조회
   */
  getTicker(market: string): UpbitTicker | undefined {
    const snapshot = this.cache.get(market);
    return snapshot?.ticker;
  }

  /**
   * 여러 마켓의 시세 조회
   */
  getTickers(markets: string[]): Map<string, UpbitTicker> {
    const result = new Map<string, UpbitTicker>();
    for (const market of markets) {
      const ticker = this.getTicker(market);
      if (ticker) {
        result.set(market, ticker);
      }
    }
    return result;
  }

  /**
   * 캐시된 모든 시세
   */
  getAllTickers(): UpbitTicker[] {
    return Array.from(this.cache.values()).map((s) => s.ticker);
  }

  /**
   * 특정 마켓의 시세 업데이트 여부
   */
  hasRecentUpdate(market: string, maxAgeMs: number = 5000): boolean {
    const snapshot = this.cache.get(market);
    if (!snapshot) return false;
    return Date.now() - snapshot.updatedAt.getTime() < maxAgeMs;
  }

  /**
   * 캐시 크기
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 초기화
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 건강 상태 확인
   */
  getHealth(): {
    totalMarkets: number;
    recentUpdates: number;
  } {
    const recentUpdates = Array.from(this.cache.values()).filter((s) =>
      this.hasRecentUpdate(s.ticker.market, 5000)
    ).length;

    return {
      totalMarkets: this.cache.size,
      recentUpdates
    };
  }
}
