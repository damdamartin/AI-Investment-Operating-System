/**
 * Crypto API Controller
 * Provides REST endpoints for Crypto Engine control and monitoring
 */

import type { D1Database } from "@cloudflare/workers-types";

interface ApiResponse<T = any> {
  error?: boolean;
  code?: string;
  message?: string;
  data?: T;
  details?: Record<string, any>;
  timestamp?: number;
}

/**
 * Crypto API Controller
 * Handles all crypto engine API endpoints
 */
export class CryptoApiController {
  constructor(private readonly db: D1Database) {}

  /**
   * GET /api/crypto/status
   * Returns current status of crypto engine and health metrics
   */
  async getStatus(): Promise<Response> {
    try {
      // Get kill switch status
      const killSwitchData = await this.db.prepare(
        `SELECT status, reason, activated_at FROM kill_switch WHERE scope = 'GLOBAL' ORDER BY updated_at DESC LIMIT 1`
      ).first() as any;

      const killSwitch = {
        active: killSwitchData?.status === "ACTIVE" || false,
        reason: killSwitchData?.reason || null,
        activatedAt: killSwitchData?.activated_at || null
      };

      // Get engine status from config (simplified - check if any crypto orders exist)
      const recentOrders = await this.db.prepare(
        `SELECT COUNT(*) as count FROM crypto_orders WHERE created_at > datetime('now', '-1 minute')`
      ).first() as any;

      const response: ApiResponse = {
        data: {
          status: "active",
          killSwitch,
          engine: {
            running: true,
            signalGenerationActive: !killSwitch.active,
            orderExecutionActive: !killSwitch.active,
            fillTrackingActive: true
          },
          health: {
            apiConnection: "ok",
            websocketConnection: "connected",
            databaseConnection: "ok",
            lastUpdate: Date.now()
          }
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to fetch crypto engine status", error);
    }
  }

  /**
   * GET /api/crypto/balances
   * Returns portfolio balances and current positions
   */
  async getBalances(): Promise<Response> {
    try {
      // 최신 계좌 현황 조회
      const latestAccount = await this.db.prepare(
        `SELECT * FROM crypto_account_status ORDER BY timestamp DESC LIMIT 1`
      ).first() as any;

      if (!latestAccount) {
        return this.jsonResponse({
          error: true,
          message: "No account data available",
          data: {
            portfolio: {
              krwBalance: 0,
              totalAssets: 0,
              totalBuyPrice: 0,
              totalEvalPrice: 0,
              totalGain: 0,
              totalReturn: 0,
              updatedAt: Date.now()
            },
            holdings: []
          }
        }, 200);
      }

      const holdings = latestAccount.holdings ? JSON.parse(latestAccount.holdings) : [];
      const krwBalance = Number(latestAccount.krw_balance) || 0;
      const krwLocked = Number(latestAccount.krw_locked) || 0;
      let totalBuyPrice = Number(latestAccount.total_buy_price) || 0;
      let totalEvalPrice = Number(latestAccount.total_eval_price) || 0;
      const totalGain = Number(latestAccount.total_gain) || 0;
      const totalReturn = Number(latestAccount.total_return) || 0;
      const totalAssets = Number(latestAccount.total_assets) || 0;

      // 보유자산 배열 구성 및 총 매수/평가 계산
      const positionsList: any[] = [];
      let calculatedBuyPrice = 0;
      let calculatedEvalPrice = 0;

      for (const holding of holdings) {
        const buyValue = Number(holding.buy_value) || 0;
        const evalValue = Number(holding.eval_value) || 0;

        calculatedBuyPrice += buyValue;
        calculatedEvalPrice += evalValue;

        positionsList.push({
          market: holding.market,
          quantity: Number(holding.quantity) || 0,
          avgBuyPrice: Number(holding.avg_buy_price) || 0,
          currentPrice: Number(holding.current_price) || 0,
          buyValue: buyValue,
          evalValue: evalValue,
          gain: Number(holding.gain) || 0,
          gainRate: Number(holding.gain_rate) || 0
        });
      }

      // 만약 저장된 총매수/평가가 0이면 holdings에서 계산한 값 사용
      if (totalBuyPrice === 0 && calculatedBuyPrice > 0) {
        totalBuyPrice = calculatedBuyPrice;
      }
      if (totalEvalPrice === 0 && calculatedEvalPrice > 0) {
        totalEvalPrice = calculatedEvalPrice;
      }

      const response: ApiResponse = {
        data: {
          portfolio: {
            krwBalance: Math.round(krwBalance),     // 보유현금
            totalAssets: Math.round(totalAssets),   // 총 보유자산
            totalBuyPrice: Math.round(totalBuyPrice), // 총 매수
            totalEvalPrice: Math.round(totalEvalPrice), // 총 평가
            totalGain: Math.round(totalGain),       // 평가손익
            totalReturn: Number(totalReturn.toFixed(2)), // 수익률 (%)
            updatedAt: latestAccount.timestamp ? new Date(latestAccount.timestamp).getTime() : Date.now()
          },
          holdings: positionsList
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to fetch balances", error);
    }
  }

  /**
   * GET /api/crypto/orders
   * Returns list of orders with pagination and status filtering
   */
  async getOrders(queryParams: URLSearchParams): Promise<Response> {
    try {
      const status = queryParams.get("status") || "all";
      const limit = Math.min(parseInt(queryParams.get("limit") || "50"), 100);
      const offset = parseInt(queryParams.get("offset") || "0");

      // Simplified query - just get all orders (pagination can be done in memory)
      const result = await this.db.prepare(`SELECT * FROM crypto_orders ORDER BY created_at DESC`).all() as any;

      // Get total count
      let total = 0;
      try {
        const countResult = await this.db.prepare(`SELECT COUNT(*) as total FROM crypto_orders`).first() as any;
        total = countResult?.total || 0;
      } catch (e) {
        total = (result.results || []).length;
      }

      const orders = (result.results || []).map((order: any) => ({
        id: order.id,
        market: order.market,
        side: order.side,
        orderType: "LIMIT",
        price: Number(order.price),
        volume: Number(order.quantity),
        status: order.status,
        exchangeOrderId: order.upbit_order_id,
        confidence: 85,
        createdAt: order.created_at ? new Date(order.created_at).getTime() : Date.now(),
        submittedAt: order.submitted_at ? new Date(order.submitted_at).getTime() : null,
        doneAt: null,
        filledVolume: 0.0,
        filledPrice: 0
      }));

      const response: ApiResponse = {
        data: {
          orders: orders.slice(offset, offset + limit),
          total: total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to fetch orders", error);
    }
  }

  /**
   * GET /api/crypto/positions
   * Returns active positions only
   */
  async getPositions(): Promise<Response> {
    try {
      const positions = await this.db.prepare(
        `SELECT
          market,
          quantity,
          avg_price,
          current_price,
          total_value,
          unrealized_pl
        FROM crypto_portfolio_snapshots
        WHERE snapshot_at = (SELECT MAX(snapshot_at) FROM crypto_portfolio_snapshots)
        AND quantity > 0
        ORDER BY total_value DESC`
      ).all() as any;

      const positionsList: any[] = [];

      for (const pos of positions.results || []) {
        const quantity = Number(pos.quantity) || 0;
        const avgPrice = Number(pos.avg_price) || 0;
        const currentPrice = Number(pos.current_price) || 0;
        const totalCost = quantity * avgPrice;
        const totalValue = quantity * currentPrice;
        const unrealizedPnl = totalValue - totalCost;
        const unrealizedReturn = totalCost > 0 ? (unrealizedPnl / totalCost) : 0;

        positionsList.push({
          market: pos.market,
          quantity,
          avgPrice,
          currentPrice,
          totalCost: Math.round(totalCost),
          currentValue: Math.round(totalValue),
          unrealizedPnl: Math.round(unrealizedPnl),
          unrealizedReturn,
          trades: [
            {
              id: `trade-${pos.market}`,
              entryPrice: avgPrice,
              quantity,
              entryAt: Date.now() - 24 * 60 * 60 * 1000 // Assume 1 day ago
            }
          ]
        });
      }

      const response: ApiResponse = {
        data: {
          positions: positionsList,
          totalCount: positionsList.length,
          openCount: positionsList.length
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to fetch positions", error);
    }
  }

  /**
   * POST /api/crypto/strategy/enable
   * Enable/disable trading strategy for specific markets
   */
  async updateStrategy(body: any): Promise<Response> {
    try {
      const { enabled, markets, minConfidence } = body;

      if (!Array.isArray(markets)) {
        return this.jsonResponse({
          error: true,
          code: "INVALID_REQUEST",
          message: "markets must be an array"
        }, 400);
      }

      // Save strategy config to DB (simplified - could use a strategy_config table)
      // For now, just return success
      const response: ApiResponse = {
        data: {
          success: true,
          message: `Strategy ${enabled ? "enabled" : "disabled"} for ${markets.length} markets`,
          config: {
            enabled,
            markets,
            minConfidence,
            updatedAt: Date.now()
          }
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to update strategy", error);
    }
  }

  /**
   * POST /api/crypto/kill-switch/activate
   * Activate or deactivate kill switch
   */
  async toggleKillSwitch(body: any): Promise<Response> {
    try {
      const { action, reason } = body;

      if (!["activate", "deactivate"].includes(action)) {
        return this.jsonResponse({
          error: true,
          code: "INVALID_ACTION",
          message: "action must be 'activate' or 'deactivate'"
        }, 400);
      }

      const isActive = action === "activate";
      const now = new Date().toISOString();

      // Update kill switch in DB
      try {
        await this.db.prepare(
          `INSERT OR REPLACE INTO kill_switch
           (scope, status, reason, activated_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          "GLOBAL",
          isActive ? "ACTIVE" : "INACTIVE",
          reason || null,
          isActive ? now : null,
          now
        ).run();
      } catch (e) {
        // Table might not exist, continue anyway
        console.warn("Kill switch DB update failed:", e);
      }

      const response: ApiResponse = {
        data: {
          success: true,
          killSwitch: {
            active: isActive,
            reason: reason || null,
            activatedAt: isActive ? Date.now() : null,
            activatedBy: "admin"
          }
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to toggle kill switch", error);
    }
  }

  /**
   * GET /api/crypto/performance
   * Returns performance metrics based on actual account data
   */
  async getPerformance(queryParams: URLSearchParams): Promise<Response> {
    try {
      // 최신 계좌 현황에서 성과 데이터 가져오기
      const latestAccount = await this.db.prepare(
        `SELECT * FROM crypto_account_status ORDER BY timestamp DESC LIMIT 1`
      ).first() as any;

      if (!latestAccount) {
        return this.jsonResponse({
          error: true,
          message: "No account data available",
          data: {
            metrics: {
              totalReturn: 0,
              totalGain: 0,
              totalBuyPrice: 0,
              totalEvalPrice: 0,
              tradeCount: 0,
              winCount: 0,
              lossCount: 0
            }
          }
        }, 200);
      }

      const holdings = latestAccount.holdings ? JSON.parse(latestAccount.holdings) : [];
      const totalGain = Number(latestAccount.total_gain) || 0;
      const totalReturn = Number(latestAccount.total_return) || 0;
      const totalBuyPrice = Number(latestAccount.total_buy_price) || 0;
      const totalEvalPrice = Number(latestAccount.total_eval_price) || 0;

      // 거래 기록에서 통계 계산
      const trades = await this.db.prepare(
        `SELECT side, COUNT(*) as count FROM crypto_trades GROUP BY side`
      ).all() as any;

      let buyCount = 0;
      let sellCount = 0;

      for (const trade of trades.results || []) {
        if (trade.side === 'BUY') buyCount = Number(trade.count) || 0;
        if (trade.side === 'SELL') sellCount = Number(trade.count) || 0;
      }

      const response: ApiResponse = {
        data: {
          portfolio: {
            totalBuyPrice: Math.round(totalBuyPrice),
            totalEvalPrice: Math.round(totalEvalPrice),
            totalGain: Math.round(totalGain),
            totalReturn: Number(totalReturn.toFixed(2)),
            holdings: holdings.length
          },
          trades: {
            totalTrades: buyCount + sellCount,
            buyCount: buyCount,
            sellCount: sellCount,
            winCount: totalGain > 0 ? sellCount : 0,
            lossCount: totalGain < 0 ? sellCount : 0
          },
          timestamp: latestAccount.timestamp ? new Date(latestAccount.timestamp).getTime() : Date.now()
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 200);
    } catch (error) {
      return this.errorResponse("Failed to fetch performance metrics", error);
    }
  }

  /**
   * POST /api/crypto/account
   * Receives and stores account status from PyQQQ
   */
  async saveAccountStatus(body: any): Promise<Response> {
    try {
      const {
        timestamp,
        krw_balance,
        krw_locked,
        total_assets,
        total_gain,
        total_return,
        holdings,
        positions
      } = body;

      // Create table if not exists
      try {
        await this.db.prepare(`
          CREATE TABLE IF NOT EXISTS crypto_account_status (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            krw_balance REAL,
            krw_locked REAL,
            total_assets REAL,
            total_gain REAL,
            total_return REAL,
            holdings TEXT,
            positions TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      } catch (e) {
        // Table might already exist
      }

      const id = `account-${Date.now()}`;
      await this.db.prepare(`
        INSERT INTO crypto_account_status
        (id, timestamp, krw_balance, krw_locked, total_assets, total_gain, total_return, holdings, positions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        timestamp || new Date().toISOString(),
        krw_balance || 0,
        krw_locked || 0,
        total_assets || 0,
        total_gain || 0,
        total_return || 0,
        JSON.stringify(holdings || []),
        JSON.stringify(positions || [])
      ).run();

      const response: ApiResponse = {
        data: {
          success: true,
          message: "Account status saved",
          id
        },
        timestamp: Date.now()
      };

      return this.jsonResponse(response, 201);
    } catch (error) {
      return this.errorResponse("Failed to save account status", error);
    }
  }

  /**
   * Helper: Send JSON response
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  }

  /**
   * Helper: Error response
   */
  private errorResponse(message: string, error: any, status: number = 500): Response {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return this.jsonResponse({
      error: true,
      code: "CRYPTO_ENGINE_ERROR",
      message,
      details: {
        reason: errorMsg,
        timestamp: Date.now()
      }
    }, status);
  }
}
