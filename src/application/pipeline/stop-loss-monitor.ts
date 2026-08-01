/**
 * StopLossMonitor
 *
 * Monitors open positions and executes stop-loss orders when price falls below stop-loss level.
 * Uses price-cache for fast real-time lookups without hitting broker APIs repeatedly.
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

export interface StopLossCheckResult {
  triggered: boolean;
  positionId?: string;
  symbol?: string;
  currentPrice?: number;
  triggerPrice?: number;
  pnl?: number;
  pnlPercent?: number;
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
 * StopLossMonitor: Real-time stop-loss monitoring using price cache
 */
export class StopLossMonitor {
  private readonly db: D1Database;
  private readonly priceCache: PriceCacheRepository;

  constructor(db: D1Database, priceCache: PriceCacheRepository) {
    this.db = db;
    this.priceCache = priceCache;
  }

  /**
   * Monitor all open positions and trigger stop-loss orders
   * Called every minute from trading-cycle-worker
   *
   * Flow:
   * 1. Fetch all OPEN positions
   * 2. Get current prices from cache (using broker info)
   * 3. Compare current price vs stop_loss_price
   * 4. If triggered: Execute SELL order, record in monitoring_logs, close position
   * 5. Return results
   */
  async evaluatePositions(): Promise<StopLossCheckResult[]> {
    const results: StopLossCheckResult[] = [];

    try {
      // 1. Fetch all OPEN positions
      const positions = await this.db.prepare(
        `SELECT id, symbol, quantity, entry_price, entry_date, stop_loss_price,
                take_profit_price, status, broker, team, created_at, updated_at
         FROM trading_positions
         WHERE status = 'OPEN'`
      ).all() as any;

      if (!positions.results || positions.results.length === 0) {
        console.log("[StopLoss Monitor] No open positions to check");
        return results;
      }

      console.log(`[StopLoss Monitor] Checking ${positions.results.length} open positions`);

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
        console.log(`[StopLoss Monitor] Checking ${brokerPositions.length} positions for ${broker}`);

        for (const position of brokerPositions) {
          try {
            const result = await this.checkPosition(position, broker);
            if (result.triggered) {
              results.push(result);
            }
          } catch (error) {
            console.error(`[StopLoss Monitor] Error checking ${position.symbol}:`, error);
          }
        }
      }

      console.log(`[StopLoss Monitor] Triggered ${results.length} stop-loss(es)`);
      return results;
    } catch (error) {
      console.error("[StopLoss Monitor] Fatal error:", error);
      return results;
    }
  }

  /**
   * Check a single position against current price
   */
  private async checkPosition(position: Position, broker: Broker): Promise<StopLossCheckResult> {
    try {
      // Get current price from cache
      const cachedPrice = await this.priceCache.getCurrentPrice(position.symbol, broker);

      if (!cachedPrice) {
        // Price not in cache yet (too old or not fetched)
        console.log(`[StopLoss Monitor] No cached price for ${position.symbol} (${broker})`);
        return { triggered: false };
      }

      const currentPrice = Number(cachedPrice.priceMajor);

      // Calculate P&L
      const pnl = (currentPrice - position.entry_price) * position.quantity;
      const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100;

      // Check if stop-loss is triggered
      if (currentPrice <= position.stop_loss_price) {
        console.log(
          `[StopLoss Monitor] ✅ TRIGGERED for ${position.symbol}: ${currentPrice} <= ${position.stop_loss_price}`
        );

        // Execute stop-loss: Close position and log trigger
        await this.executeSellOrder(position, currentPrice, pnl, pnlPercent);

        return {
          triggered: true,
          positionId: position.id,
          symbol: position.symbol,
          currentPrice,
          triggerPrice: position.stop_loss_price,
          pnl,
          pnlPercent,
          reason: `Stop loss hit at ${currentPrice}`
        };
      } else {
        // Not triggered yet, but log the price check
        // (Optional: uncomment for verbose logging)
        // console.log(`[StopLoss Monitor] ${position.symbol}: ${currentPrice} > ${position.stop_loss_price} (OK)`);
      }

      return { triggered: false };
    } catch (error) {
      console.error(`[StopLoss Monitor] Error in checkPosition:`, error);
      return { triggered: false };
    }
  }

  /**
   * Execute SELL order when stop-loss is triggered
   * - Update position status to STOPPED_OUT
   * - Record trigger in monitoring_logs
   * - Record exit in position_exits
   */
  private async executeSellOrder(
    position: Position,
    exitPrice: number,
    pnl: number,
    pnlPercent: number
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const triggerId = randomUUID();

      // 1. Update position status to STOPPED_OUT
      await this.db.prepare(
        `UPDATE trading_positions
         SET status = ?, closed_at = ?, close_reason = ?, updated_at = ?
         WHERE id = ?`
      ).bind("STOPPED_OUT", now, "STOP_LOSS", now, position.id).run();

      // 2. Record in monitoring_logs (for dashboard display)
      await this.db.prepare(
        `INSERT INTO monitoring_logs
         (id, position_id, symbol, trigger_type, entry_price, trigger_price,
          current_price, quantity, pnl, pnl_percent, broker, team, triggered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        triggerId,
        position.id,
        position.symbol,
        "STOP_LOSS",
        position.entry_price,
        position.stop_loss_price,
        exitPrice,
        position.quantity,
        pnl,
        pnlPercent,
        position.broker,
        position.team,
        now
      ).run();

      // 3. Record in position_exits (for trade history)
      const exitId = randomUUID();
      await this.db.prepare(
        `INSERT INTO position_exits
         (id, position_id, symbol, quantity, entry_price, exit_price, exit_reason, pnl, pnl_percent, exited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        exitId,
        position.id,
        position.symbol,
        position.quantity,
        position.entry_price,
        exitPrice,
        "STOP_LOSS",
        pnl,
        pnlPercent,
        now
      ).run();

      console.log(
        `[StopLoss Monitor] ✅ Executed stop-loss for ${position.symbol}: ` +
        `Exit @ ${exitPrice}, P&L: ₩${pnl.toLocaleString()} (${pnlPercent.toFixed(2)}%)`
      );
    } catch (error) {
      console.error(`[StopLoss Monitor] Error executing sell order:`, error);
      throw error;
    }
  }

  /**
   * Get recent stop-loss events for dashboard display
   * Returns the last N triggered stop-losses
   */
  async getRecentTriggeredStopLosses(limit: number = 20): Promise<any[]> {
    try {
      const result = await this.db.prepare(
        `SELECT id, position_id, symbol, trigger_type, entry_price, trigger_price,
                current_price, quantity, pnl, pnl_percent, broker, team, triggered_at
         FROM monitoring_logs
         WHERE trigger_type = 'STOP_LOSS'
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
      console.error("[StopLoss Monitor] Error fetching recent triggers:", error);
      return [];
    }
  }
}
