/**
 * Upbit WebSocket Listener
 * 실시간 시세 수신 (별도 스레드/워커에서 실행)
 * MarketCache로 업데이트
 */

import type { UpbitTicker } from "../config/upbit-client.js";
import type { MarketCache } from "./market-cache.js";

export interface WebSocketConfig {
  markets: string[];
  reconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

export class UpbitWebSocketListener {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private cache: MarketCache;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelayMs: number;

  constructor(cache: MarketCache, config: WebSocketConfig) {
    this.cache = cache;
    this.config = config;
    this.reconnectDelayMs = config.reconnectDelayMs || 3000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
  }

  /**
   * WebSocket 연결 시작
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket("wss://api.upbit.com/websocket/v1");

        this.ws.onopen = () => {
          console.log("[WebSocket] Connected");
          this.isRunning = true;
          this.reconnectAttempts = 0;

          // 마켓 구독
          this.subscribe(this.config.markets);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("[WebSocket] Error:", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log("[WebSocket] Disconnected");
          this.isRunning = false;
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 마켓 구독
   */
  subscribe(markets: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const message = {
      ticket: `upbit-crypto-${Date.now()}`,
      type: "ticker",
      codes: markets
    };

    this.ws.send(JSON.stringify([message]));
    console.log(`[WebSocket] Subscribed to ${markets.join(", ")}`);
  }

  /**
   * 마켓 구독 해제
   */
  unsubscribe(markets: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      ticket: `upbit-crypto-${Date.now()}`,
      type: "ticker",
      codes: markets,
      is_only_realtime: true
    };

    this.ws.send(JSON.stringify([message]));
    console.log(`[WebSocket] Unsubscribed from ${markets.join(", ")}`);
  }

  /**
   * 연결 종료
   */
  disconnect(): void {
    if (this.ws) {
      this.isRunning = false;
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 연결 상태
   */
  isConnected(): boolean {
    return this.isRunning && this.ws?.readyState === WebSocket.OPEN;
  }

  // ======================== Private Methods ========================

  private handleMessage(data: string | ArrayBufferLike): void {
    try {
      // Upbit WebSocket은 gzip 압축된 바이너리 데이터를 보냄
      // 따라서 브라우저 환경에서는 직접 처리 불가
      // 실제 구현에서는 pako(gzip) 라이브러리 사용 필요

      // 텍스트 데이터인 경우 (개발/테스트용)
      if (typeof data === "string") {
        const parsed = JSON.parse(data);
        this.updateCache(parsed);
      }
    } catch (error) {
      console.error("[WebSocket] Message parsing error:", error);
    }
  }

  private updateCache(ticker: UpbitTicker): void {
    this.cache.updateTicker(ticker);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error("[WebSocket] Reconnection failed:", error);
      });
    }, delay);
  }
}
