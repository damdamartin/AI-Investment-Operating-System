/**
 * TakeProfitMonitor
 *
 * Monitors open positions and executes take-profit orders when price reaches or exceeds take-profit level.
 * Uses price-cache for fast real-time lookups without hitting broker APIs repeatedly.
 *
 * Supports both full and partial take-profit scenarios:
 * - Full close: entire position is closed when TP is reached
 * - Partial close: 50% of position is closed, rest remains open (optional)
 *
 * Integration with trading-cycle-worker:
 * - Called every minute during cron execution
 * - Reads positions from trading_positions table
 * - Gets current prices from price_cache
 * - Executes SELL orders and records triggers in monitoring_logs
 */

import type { D1Database } from "@cloudflare/workers-types";
import { PriceCacheRepository, type Broker } from "../../persistence/price-cache-repository.js";
import { randomUUID } from "node:crypto";

export interface TakeProfitCheckResult {
  triggered: boolean;
  positionId?: string;
  symbol?: string;
  currentPrice?: number;
  triggerPrice?: number;
  pnl?: number;
  pnlPercent?: number;
  partialClose?: boolean;
  closeQuantity?: number;
  reason?: string;
}

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  entry_date: string;
  stop_loss_price: number;
  take_profit_price: number;
  status: string;
  broker: string;
  team: string;
  created_at: string;
  updated_at: string;
}

/**
 * TakeProfitMonitor: Real-time take-profit monitoring using price cache
 */
export class TakeProfitMonitor {
  private readonly db: D1Database;
  private readonly priceCache: PriceCacheRepository;
  private readonly partialCloseRatio: number; // Default 0.5 for 50% partial close

  constructor(db: D1Database, priceCache: PriceCacheRepository, partialCloseRatio: number = 1.0) {
    this.db = db;
    this.priceCache = priceCache;
    // Store ratio: 1.0 = full close (default), 0.5 = 50% partial close
    this.partialCloseRatio = Math.min(Math.max(partialCloseRatio, 0), 1);
  }

  /**
   * Monitor all open positions and trigger take-profit orders
   * Called every minute from trading-cycle-worker
   *
   * Flow:
   * 1. Fetch all OPEN positions
   * 2. Get current prices from cache (using broker info)
   * 3. Compare current price vs take_profit_price
   * 4. If triggered: Execute SELL order, record in monitoring_logs, close position
   * 5. Return results
   */
  async evaluatePositions(): Promise<TakeProfitCheckResult[]> {
    const results: TakeProfitCheckResult[] = [];

    try {
      // 1. Fetch all OPEN positions
      const positions = await this.db.prepare(
        `SELECT id, symbol, quantity, entry_price, entry_date, stop_loss_price,
                take_profit_price, status, broker, team, created_at, updated_at
         FROM trading_positions
         WHERE status = 'OPEN'`
      ).all() as any;

      if (!positions.results || positions.results.length === 0) {
        console.log("[TakeProfit Monitor] No open positions to check");
        return results;
      }

      console.log(`[TakeProfit Monitor] Checking ${positions.results.length} open positions`);

      // Group positions by broker for efficient price fetching
      const positionsByBroker = new Map<Broker, Position[]>();

      for (const row of positions.results) {
        const broker = (row.broker || "KIS") as Broker;
        if (!positionsByBroker.has(broker)) {
          positionsByBroker.set(broker, []);
        }
        positionsByBroker.get(broker)!.push({
          id: row.id,
          symbol: row.symbol,
          quantity: row.quantity,
          entry_price: row.entry_price,
          entry_date: row.entry_date,
          stop_loss_price: row.stop_loss_price,
          take_profit_price: row.take_profit_price,
          status: row.status,
          broker: row.broker,
          team: row.team,
          created_at: row.created_at,
          updated_at: row.updated_at
        });
      }

      // 2. Check each broker's positions
      for (const [broker, brokerPositions] of positionsByBroker) {
        console.log(`[TakeProfit Monitor] Checking ${brokerPositions.length} positions for ${broker}`);

        for (const position of brokerPositions) {
          try {
            const result = await this.checkPosition(position, broker);
            if (result.triggered) {
              results.push(result);
            }
          } catch (error) {
            console.error(`[TakeProfit Monitor] Error checking ${position.symbol}:`, error);
          }
        }
      }

      console.log(`[TakeProfit Monitor] Triggered ${results.length} take-profit(s)`);
      return results;
    } catch (error) {
      console.error("[TakeProfit Monitor] Fatal error:", error);
      return results;
    }
  }

  /**
   * Check a single position against current price
   */
  private async checkPosition(position: Position, broker: Broker): Promise<TakeProfitCheckResult> {
    try {
      // Get current price from cache
      const cachedPrice = await this.priceCache.getCurrentPrice(position.symbol, broker);

      if (!cachedPrice) {
        // Price not in cache yet (too old or not fetched)
        console.log(`[TakeProfit Monitor] No cached price for ${position.symbol} (${broker})`);
        return { triggered: false };
      }

      const currentPrice = Number(cachedPrice.priceMajor);

      // Calculate P&L
      const pnl = (currentPrice - position.entry_price) * position.quantity;
      const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100;

      // Check if take-profit is triggered
      if (currentPrice >= position.take_profit_price) {
        console.log(
          `[TakeProfit Monitor] ✅ TRIGGERED for ${position.symbol}: ${currentPrice} >= ${position.take_profit_price}`
        );

        // Execute take-profit: Close position and log trigger
        const closeQuantity = Math.floor(position.quantity * this.partialCloseRatio);
        const isPartialClose = this.partialCloseRatio < 1.0;

        await this.executeSellOrder(
          position,
          currentPrice,
          pnl,
          pnlPercent,
          closeQuantity,
          isPartialClose
        );

        return {
          triggered: true,
          positionId: position.id,
          symbol: position.symbol,
          currentPrice,
          triggerPrice: position.take_profit_price,
          pnl,
          pnlPercent,
          partialClose: isPartialClose,
          closeQuantity,
          reason: isPartialClose
            ? `Take profit hit (partial close: ${(this.partialCloseRatio * 100).toFixed(0)}%)`
            : `Take profit hit (full close)`
        };
      } else {
        // Not triggered yet
        // (Optional: uncomment for verbose logging)
        // console.log(`[TakeProfit Monitor] ${position.symbol}: ${currentPrice} < ${position.take_profit_price} (OK)`);
      }

      return { triggered: false };
    } catch (error) {
      console.error(`[TakeProfit Monitor] Error in checkPosition:`, error);
      return { triggered: false };
    }
  }

  /**
   * Execute SELL order when take-profit is triggered
   * - Update position status to TAKEN_PROFIT (or reduce quantity if partial)
   * - Record trigger in monitoring_logs
   * - Record exit in position_exits
   */
  private async executeSellOrder(
    position: Position,
    exitPrice: number,
    pnl: number,
    pnlPercent: number,
    closeQuantity: number,
    isPartialClose: boolean
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const triggerId = randomUUID();

      // Calculate P&L for the closed quantity
      const closedPnl = (exitPrice - position.entry_price) * closeQuantity;
      const closedPnlPercent = ((exitPrice - position.entry_price) / position.entry_price) * 100;

      if (isPartialClose) {
        // Partial close: reduce quantity, keep position open
        const remainingQty = position.quantity - closeQuantity;
        await this.db.prepare(
          `UPDATE trading_positions
           SET quantity = ?, updated_at = ?
           WHERE id = ?`
        ).bind(remainingQty, now, position.id).run();

        console.log(
          `[TakeProfit Monitor] ✅ Partial close for ${position.symbol}: ` +
          `Closed ${closeQuantity} of ${position.quantity}, Remaining: ${remainingQty}`
        );
      } else {
        // Full close: close the position
        await this.db.prepare(
          `UPDATE trading_positions
           SET status = ?, closed_at = ?, close_reason = ?, updated_at = ?
           WHERE id = ?`
        ).bind("TAKEN_PROFIT", now, "TAKE_PROFIT", now, position.id).run();

        console.log(
          `[TakeProfit Monitor] ✅ Full close for ${position.symbol}: ` +
          `All ${position.quantity} shares closed`
        );
      }

      // Record in monitoring_logs (for dashboard display)
      await this.db.prepare(
        `INSERT INTO monitoring_logs
         (id, position_id, symbol, trigger_type, entry_price, trigger_price,
          current_price, quantity, pnl, pnl_percent, broker, team, triggered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        triggerId,
        position.id,
        position.symbol,
        "TAKE_PROFIT",
        position.entry_price,
        position.take_profit_price,
        exitPrice,
        closeQuantity,
        closedPnl,
        closedPnlPercent,
        position.broker,
        position.team,
        now
      ).run();

      // Record in position_exits (for trade history)
      const exitId = randomUUID();
      await this.db.prepare(
        `INSERT INTO position_exits
         (id, position_id, symbol, quantity, entry_price, exit_price, exit_reason, pnl, pnl_percent, exited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        exitId,
        position.id,
        position.symbol,
        closeQuantity,
        position.entry_price,
        exitPrice,
        "TAKE_PROFIT",
        closedPnl,
        closedPnlPercent,
        now
      ).run();

      console.log(
        `[TakeProfit Monitor] ✅ Recorded take-profit for ${position.symbol}: ` +
        `Exit @ ${exitPrice}, P&L: ₩${closedPnl.toLocaleString()} (${closedPnlPercent.toFixed(2)}%)`
      );
    } catch (error) {
      console.error(`[TakeProfit Monitor] Error executing sell order:`, error);
      throw error;
    }
  }

  /**
   * Get recent take-profit events for dashboard display
   * Returns the last N triggered take-profits
   */
  async getRecentTriggeredTakeProfits(limit: number = 20): Promise<any[]> {
    try {
      const result = await this.db.prepare(
        `SELECT id, position_id, symbol, trigger_type, entry_price, trigger_price,
                current_price, quantity, pnl, pnl_percent, broker, team, triggered_at
         FROM monitoring_logs
         WHERE trigger_type = 'TAKE_PROFIT'
         ORDER BY triggered_at DESC
         LIMIT ?`
      ).bind(limit).all() as any;

      return (result.results || []).map((row: any) => ({
        id: row.id,
        positionId: row.position_id,
        symbol: row.symbol,
        entryPrice: row.entry_price,
        triggerPrice: row.trigger_price,
        currentPrice: row.current_price,
        quantity: row.quantity,
        pnl: row.pnl,
        pnlPercent: row.pnl_percent,
        broker: row.broker,
        team: row.team,
        triggeredAt: row.triggered_at
      }));
    } catch (error) {
      console.error("[TakeProfit Monitor] Error fetching recent triggers:", error);
      return [];
    }
  }
}
