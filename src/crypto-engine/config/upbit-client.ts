/**
 * Upbit API Client
 * REST API 호출 for non-real-time operations
 * WebSocket은 별도 리스너에서 처리
 */

import crypto from "crypto";
import { promisify } from "util";

const generateSignature = promisify(crypto.generateHmac) as any;

export interface UpbitConfig {
  accessKey: string;
  secretKey: string;
}

export interface UpbitMarket {
  market: string; // "KRW-BTC"
  korean_name: string;
  english_name: string;
  market_event?: {
    warning: boolean;
    caution?: {
      type: string;
      period_type: string;
    };
  };
  suspended: boolean;
  closed: boolean;
  ttm: number | null;
}

export interface UpbitTicker {
  market: string;
  trade_date: string;
  trade_time: string;
  trade_timestamp: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  prev_closing_price: number;
  change: string; // "RISE" | "FALL" | "EVEN"
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_volume: number;
  acc_trade_price: number;
  acc_trade_price_24h: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  trade_status: string;
  market_order_enabled: boolean;
  ask_bid: string; // "ASK" | "BID"
  timestamp: number;
  stream_type: string;
}

export interface UpbitCandle {
  market: string;
  candle_date_time_utc: string;
  candle_date_time_kst: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  closing_price: number;
  acc_trade_price: number;
  acc_trade_volume: number;
  change: string;
  change_price: number;
  change_rate: number;
  timestamp: number;
}

export interface UpbitAccountBalance {
  currency: string;
  balance: number;
  locked: number;
  avg_buy_price: number;
  avg_buy_price_modified: boolean;
  unit_currency: string;
}

export interface PlaceOrderRequest {
  market: string;
  side: "BUY" | "SELL";
  volume?: number;
  price?: number;
  ord_type: "LIMIT" | "PRICE" | "MARKET";
  time_in_force?: "GTC" | "IOC" | "FOK";
}

export interface UpbitOrder {
  uuid: string;
  side: string;
  ord_type: string;
  price: number | null;
  state: "wait" | "done" | "cancel";
  market: string;
  created_at: string;
  volume: number | null;
  remaining_volume: number | null;
  reserved_fee: number;
  remaining_fee: number;
  paid_fee: number;
  locked: number;
  executed_volume: number;
  trades_count: number;
  trades?: Array<{
    market: string;
    uuid: string;
    price: number;
    volume: number;
    funds: number;
    side: string;
    created_at: string;
  }>;
}

export class UpbitClient {
  private config: UpbitConfig;
  private baseUrl = "https://api.upbit.com/v1";

  constructor(config: UpbitConfig) {
    this.config = config;
  }

  /**
   * 지원하는 마켓 목록 조회 (1회만 호출, 캐시 사용)
   */
  async getMarkets(): Promise<UpbitMarket[]> {
    const response = await this.makePublicRequest("/market/all", {
      isDetails: false
    });
    return response;
  }

  /**
   * 실시간 시세 조회 (WebSocket 사용 권장)
   * REST API는 최신 1개만 반환하므로 폴링에 부적합
   */
  async getTickers(markets: string[]): Promise<UpbitTicker[]> {
    if (markets.length === 0) return [];
    if (markets.length > 100) {
      throw new Error("Maximum 100 markets per request");
    }

    const response = await this.makePublicRequest("/ticker", {
      markets: markets.join(","),
      include_acc_trade_price: true,
      include_acc_trade_volume: true
    });
    return response;
  }

  /**
   * 단일 마켓 시세 조회
   */
  async getTicker(market: string): Promise<UpbitTicker> {
    const tickers = await this.getTickers([market]);
    return tickers[0];
  }

  /**
   * 캔들 조회 (분봉)
   */
  async getCandles(
    market: string,
    unit: 1 | 5 | 10 | 15 | 30 | 60 | 240,
    count: number = 100
  ): Promise<UpbitCandle[]> {
    if (count > 200) {
      throw new Error("Maximum 200 candles per request");
    }

    const response = await this.makePublicRequest(`/candles/minutes/${unit}`, {
      market,
      count
    });
    return response;
  }

  /**
   * 계좌 잔고 조회
   */
  async getAccounts(): Promise<UpbitAccountBalance[]> {
    const response = await this.makePrivateRequest("/accounts");
    return response;
  }

  /**
   * 주문 생성
   */
  async placeOrder(request: PlaceOrderRequest): Promise<UpbitOrder> {
    const payload: Record<string, any> = {
      market: request.market,
      side: request.side,
      ord_type: request.ord_type,
      time_in_force: request.time_in_force || "GTC"
    };

    if (request.ord_type === "LIMIT") {
      payload.price = request.price;
      payload.volume = request.volume;
    } else if (request.ord_type === "PRICE") {
      payload.price = request.price; // KRW 금액
    } else if (request.ord_type === "MARKET") {
      if (request.side === "BUY") {
        payload.price = request.price; // KRW 금액
      } else {
        payload.volume = request.volume;
      }
    }

    const response = await this.makePrivateRequest("/orders", payload, "POST");
    return response;
  }

  /**
   * 특정 주문 조회
   */
  async getOrder(uuid: string): Promise<UpbitOrder> {
    const response = await this.makePrivateRequest("/orders/" + uuid);
    return response;
  }

  /**
   * 주문 목록 조회
   */
  async getOrders(state: "wait" | "done" | "cancel" = "wait"): Promise<UpbitOrder[]> {
    const response = await this.makePrivateRequest("/orders", { state });
    return response;
  }

  /**
   * 주문 취소
   */
  async cancelOrder(uuid: string): Promise<UpbitOrder> {
    const response = await this.makePrivateRequest(`/orders/${uuid}`, {}, "DELETE");
    return response;
  }

  /**
   * API 인증 테스트
   */
  async testAuth(): Promise<boolean> {
    try {
      await this.getAccounts();
      return true;
    } catch {
      return false;
    }
  }

  // ======================== Private Methods ========================

  private async makePublicRequest(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Upbit API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async makePrivateRequest(
    endpoint: string,
    params?: Record<string, any>,
    method: "GET" | "POST" | "DELETE" = "GET"
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    const queryString = this.buildQueryString(params || {});

    // 서명 생성
    const message = queryString || "";
    const signature = crypto
      .createHmac("sha256", this.config.secretKey)
      .update(message)
      .digest("hex");

    const nonce = Date.now().toString();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.buildAuthorizationHeader(signature, nonce)}`,
      Accept: "application/json"
    };

    let fetchOptions: RequestInit = {
      method,
      headers
    };

    if (method === "GET" && queryString) {
      url.search = queryString;
    } else if (method === "POST" && params) {
      fetchOptions.body = JSON.stringify(params);
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Upbit API error: ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  private buildQueryString(params: Record<string, any>): string {
    if (Object.keys(params).length === 0) return "";
    const sorted = Object.keys(params)
      .sort()
      .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`);
    return sorted.join("&");
  }

  private buildAuthorizationHeader(signature: string, nonce: string): string {
    const payload = {
      access_key: this.config.accessKey,
      nonce,
      timestamp: Date.now(),
      signature
    };
    return JSON.stringify(payload);
  }
}
