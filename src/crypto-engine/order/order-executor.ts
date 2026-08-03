/**
 * Order Executor
 * 200ms 주기로 주문 큐를 처리
 * 실제 Upbit API 호출
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { UpbitClient, PlaceOrderRequest, UpbitOrder } from "../config/upbit-client.js";
import type { CryptoSignal } from "../strategy/signal-generator.js";

export interface CryptoOrderRequest {
  id: string;
  signal: CryptoSignal;
  quantity: number;
  limitPrice: number;
  riskCheckPassed: boolean;
  moneyCheckPassed: boolean;
}

export interface OrderExecutionResult {
  id: string;
  orderId?: string; // Upbit UUID
  signal: CryptoSignal;
  quantity: number;
  limitPrice: number;
  status: "PENDING" | "SUBMITTED" | "FAILED" | "ERROR";
  error?: string;
  submittedAt?: Date;
  upbitOrder?: UpbitOrder;
}

export class OrderExecutor {
  private upbitClient: UpbitClient;
  private db: D1Database;
  private queue: CryptoOrderRequest[] = [];
  private executionHistory: Map<string, OrderExecutionResult> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(upbitClient: UpbitClient, db: D1Database) {
    this.upbitClient = upbitClient;
    this.db = db;
  }

  /**
   * 주문 큐에 추가
   */
  enqueue(orderRequest: CryptoOrderRequest): void {
    console.log(
      `[OrderExecutor] Enqueued order: ${orderRequest.signal.market} ${orderRequest.signal.direction} x${orderRequest.quantity}`
    );
    this.queue.push(orderRequest);
  }

  /**
   * 주문 큐 처리 (200ms 주기로 호출)
   */
  async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const ordersToProcess = [...this.queue];
    this.queue = [];

    for (const orderRequest of ordersToProcess) {
      try {
        await this.executeOrder(orderRequest);
      } catch (error) {
        console.error(`[OrderExecutor] Processing error: ${error}`);
      }
    }
  }

  /**
   * 개별 주문 실행
   */
  private async executeOrder(orderRequest: CryptoOrderRequest): Promise<void> {
    const result: OrderExecutionResult = {
      id: orderRequest.id,
      signal: orderRequest.signal,
      quantity: orderRequest.quantity,
      limitPrice: orderRequest.limitPrice,
      status: "PENDING"
    };

    try {
      // 1. 위험 검증
      if (!orderRequest.riskCheckPassed) {
        result.status = "FAILED";
        result.error = "Risk check failed";
        await this.recordExecution(result);
        console.warn(`[OrderExecutor] Risk check failed for order ${orderRequest.id}`);
        return;
      }

      // 2. 자금 검증
      if (!orderRequest.moneyCheckPassed) {
        result.status = "FAILED";
        result.error = "Insufficient balance";
        await this.recordExecution(result);
        console.warn(`[OrderExecutor] Money check failed for order ${orderRequest.id}`);
        return;
      }

      // 3. 중복 주문 확인 (데이터베이스)
      const isDuplicate = await this.checkDuplicate(orderRequest.signal.idempotencyKey);
      if (isDuplicate) {
        result.status = "FAILED";
        result.error = "Duplicate order detected";
        await this.recordExecution(result);
        console.warn(`[OrderExecutor] Duplicate order detected: ${orderRequest.signal.idempotencyKey}`);
        return;
      }

      // 4. 주문 생성 및 전송
      const placeOrderRequest: PlaceOrderRequest = {
        market: orderRequest.signal.market,
        side: orderRequest.signal.direction === "BUY" ? "BUY" : "SELL",
        ord_type: "LIMIT",
        price: orderRequest.limitPrice,
        volume: orderRequest.quantity
      };

      const upbitOrder = await this.submitOrderWithRetry(placeOrderRequest, orderRequest.id);

      if (upbitOrder) {
        result.status = "SUBMITTED";
        result.orderId = upbitOrder.uuid;
        result.upbitOrder = upbitOrder;
        result.submittedAt = new Date();

        // 5. 데이터베이스 저장
        await this.recordExecution(result);

        console.log(
          `[OrderExecutor] Order submitted: ${upbitOrder.uuid} - ${orderRequest.signal.market} ${orderRequest.signal.direction} x${orderRequest.quantity}`
        );
      } else {
        result.status = "FAILED";
        result.error = "Failed to submit order after retries";
        await this.recordExecution(result);
        console.error(
          `[OrderExecutor] Failed to submit order after ${this.maxRetries} attempts: ${orderRequest.id}`
        );
      }
    } catch (error) {
      result.status = "ERROR";
      result.error = error instanceof Error ? error.message : String(error);
      await this.recordExecution(result);
      console.error(`[OrderExecutor] Order execution error: ${result.error}`);
    }
  }

  /**
   * 재시도 로직과 함께 주문 제출
   */
  private async submitOrderWithRetry(
    request: PlaceOrderRequest,
    orderId: string
  ): Promise<UpbitOrder | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.upbitClient.placeOrder(request);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[OrderExecutor] Submission attempt ${attempt}/${this.maxRetries} failed: ${lastError.message}`
        );

        // 지수 백오프
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`[OrderExecutor] Order submission failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    return null;
  }

  /**
   * 중복 주문 확인
   */
  private async checkDuplicate(idempotencyKey: string): Promise<boolean> {
    try {
      const result = await this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM crypto_orders
        WHERE idempotency_key = ? AND status IN ('SUBMITTED', 'PARTIALLY_FILLED', 'FILLED')
        LIMIT 1
      `
        )
        .bind(idempotencyKey)
        .first<{ count: number }>();

      return (result?.count ?? 0) > 0;
    } catch (error) {
      console.error(`[OrderExecutor] Duplicate check error: ${error}`);
      return false;
    }
  }

  /**
   * 주문 실행 결과 기록
   */
  private async recordExecution(result: OrderExecutionResult): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        INSERT INTO crypto_orders
        (id, market, side, quantity, price, status, idempotency_key, upbit_order_id, error, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          result.id,
          result.signal.market,
          result.signal.direction,
          result.quantity,
          result.limitPrice,
          result.status,
          result.signal.idempotencyKey,
          result.orderId || null,
          result.error || null,
          result.submittedAt?.toISOString() || null
        )
        .run();

      this.executionHistory.set(result.id, result);
    } catch (error) {
      console.error(`[OrderExecutor] Recording error: ${error}`);
    }
  }

  /**
   * 실행 기록 조회
   */
  getExecutionHistory(limit: number = 100): OrderExecutionResult[] {
    return Array.from(this.executionHistory.values()).slice(-limit);
  }

  /**
   * 큐 상태
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}
