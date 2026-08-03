/**
 * Fill Tracker
 * 1초 주기로 체결 상태 확인
 * Upbit API를 통해 주문 상태 조회
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { UpbitClient, UpbitOrder } from "../config/upbit-client.js";

export interface TrackedOrder {
  id: string;
  market: string;
  upbitOrderId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  submittedAt: Date;
  lastCheckAt: Date;
  status: "SUBMITTED" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "FAILED";
  executedVolume: number;
  executedPrice: number;
}

export interface FillEvent {
  trackedOrderId: string;
  upbitOrderId: string;
  market: string;
  side: "BUY" | "SELL";
  executedVolume: number;
  executedPrice: number;
  filledAt: Date;
}

export class FillTracker {
  private upbitClient: UpbitClient;
  private db: D1Database;
  private trackedOrders: Map<string, TrackedOrder> = new Map();
  private fillEvents: FillEvent[] = [];

  constructor(upbitClient: UpbitClient, db: D1Database) {
    this.upbitClient = upbitClient;
    this.db = db;
  }

  /**
   * 추적할 주문 등록
   */
  trackOrder(order: TrackedOrder): void {
    this.trackedOrders.set(order.upbitOrderId, order);
    console.log(`[FillTracker] Tracking order: ${order.upbitOrderId} - ${order.market} ${order.side}`);
  }

  /**
   * 모든 추적 주문의 체결 상태 확인 (1초 주기)
   */
  async checkAllFills(): Promise<void> {
    if (this.trackedOrders.size === 0) {
      return;
    }

    const orderIds = Array.from(this.trackedOrders.keys());

    for (const upbitOrderId of orderIds) {
      try {
        await this.checkFill(upbitOrderId);
      } catch (error) {
        console.error(`[FillTracker] Check error for ${upbitOrderId}: ${error}`);
      }
    }
  }

  /**
   * 개별 주문의 체결 상태 확인
   */
  private async checkFill(upbitOrderId: string): Promise<void> {
    const tracked = this.trackedOrders.get(upbitOrderId);
    if (!tracked) {
      return;
    }

    try {
      const upbitOrder = await this.upbitClient.getOrder(upbitOrderId);

      // 체결 상태 업데이트
      const previousStatus = tracked.status;
      const previousVolume = tracked.executedVolume;

      tracked.lastCheckAt = new Date();
      tracked.status = this.mapOrderStatus(upbitOrder);
      tracked.executedVolume = upbitOrder.executed_volume || 0;
      tracked.executedPrice = this.calculateAvgPrice(upbitOrder);

      // 체결 이벤트 발생
      if (upbitOrder.executed_volume && upbitOrder.executed_volume > previousVolume) {
        const newVolume = upbitOrder.executed_volume - previousVolume;
        const fillEvent: FillEvent = {
          trackedOrderId: tracked.id,
          upbitOrderId: upbitOrder.uuid,
          market: tracked.market,
          side: tracked.side,
          executedVolume: newVolume,
          executedPrice: tracked.executedPrice,
          filledAt: new Date()
        };

        this.fillEvents.push(fillEvent);
        await this.recordFill(fillEvent);

        console.log(
          `[FillTracker] Order partially filled: ${upbitOrderId} - ${newVolume} @ ${tracked.executedPrice}`
        );
      }

      // 주문 완료 또는 취소
      if (tracked.status === "FILLED" || tracked.status === "CANCELED") {
        console.log(`[FillTracker] Order completed: ${upbitOrderId} - Status: ${tracked.status}`);
        this.trackedOrders.delete(upbitOrderId);
      }

      // 상태 변경 기록
      if (previousStatus !== tracked.status) {
        await this.recordStatusChange(tracked, previousStatus, tracked.status);
      }
    } catch (error) {
      console.error(`[FillTracker] Error checking order ${upbitOrderId}: ${error}`);
    }
  }

  /**
   * 체결 기록
   */
  private async recordFill(fill: FillEvent): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        INSERT INTO crypto_fills
        (order_id, upbit_order_id, market, side, volume, price, filled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          fill.trackedOrderId,
          fill.upbitOrderId,
          fill.market,
          fill.side,
          fill.executedVolume,
          fill.executedPrice,
          fill.filledAt.toISOString()
        )
        .run();
    } catch (error) {
      console.error(`[FillTracker] Recording fill error: ${error}`);
    }
  }

  /**
   * 상태 변경 기록
   */
  private async recordStatusChange(
    order: TrackedOrder,
    previousStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        INSERT INTO crypto_order_status_changes
        (order_id, upbit_order_id, previous_status, new_status, changed_at)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .bind(order.id, order.upbitOrderId, previousStatus, newStatus, new Date().toISOString())
        .run();
    } catch (error) {
      console.error(`[FillTracker] Recording status change error: ${error}`);
    }
  }

  /**
   * 추적 중인 주문 조회
   */
  getTrackedOrders(): TrackedOrder[] {
    return Array.from(this.trackedOrders.values());
  }

  /**
   * 최근 체결 이벤트 조회
   */
  getRecentFillEvents(limit: number = 50): FillEvent[] {
    return this.fillEvents.slice(-limit);
  }

  // ======================== Private Methods ========================

  private mapOrderStatus(upbitOrder: UpbitOrder): "SUBMITTED" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "FAILED" {
    switch (upbitOrder.state) {
      case "wait":
        return upbitOrder.executed_volume ? "PARTIALLY_FILLED" : "SUBMITTED";
      case "done":
        return upbitOrder.executed_volume ? "FILLED" : "CANCELED";
      case "cancel":
        return "CANCELED";
      default:
        return "FAILED";
    }
  }

  private calculateAvgPrice(upbitOrder: UpbitOrder): number {
    if (!upbitOrder.trades || upbitOrder.trades.length === 0) {
      return upbitOrder.price || 0;
    }

    const totalFunds = upbitOrder.trades.reduce((sum, trade) => sum + trade.funds, 0);
    const totalVolume = upbitOrder.trades.reduce((sum, trade) => sum + trade.volume, 0);

    return totalVolume > 0 ? totalFunds / totalVolume : upbitOrder.price || 0;
  }
}
