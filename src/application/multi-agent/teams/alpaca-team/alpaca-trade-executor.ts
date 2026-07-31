export interface AlpacaOrderRequest {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  time_in_force: "day" | "gtc" | "opg" | "cls";
  limit_price?: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  failed_at?: string;
  replaced_at?: string;
  replaced_by?: string;
  replaces?: string;
  asset_id: string;
  symbol: string;
  asset_class: string;
  qty: string;
  filled_qty: string;
  filled_avg_price?: string;
  order_class?: string;
  order_type: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price?: string;
  stop_price?: string;
  status: string;
  extended_hours?: boolean;
  legs?: AlpacaOrder[];
  trail_percent?: string;
  trail_price?: string;
  hwm?: string;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: string;
  qty: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_gain: string;
  unrealized_gain_pct: string;
  unrealized_intraday_gain: string;
  unrealized_intraday_gain_pct: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export interface AlpacaExecutionConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  paperTrading?: boolean;
  maxPositionSizePercent?: number;
  maxOpenPositions?: number;
  minConfidenceThreshold?: number;
}

/**
 * Alpaca Trade Executor
 * Executes buy/sell orders on Alpaca
 */
export class AlpacaTradeExecutor {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private paperTrading: boolean;
  private maxPositionSizePercent: number;
  private maxOpenPositions: number;
  private minConfidenceThreshold: number;

  constructor(config: AlpacaExecutionConfig) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl || "https://api.alpaca.markets";
    this.paperTrading = config.paperTrading ?? true;
    this.maxPositionSizePercent = config.maxPositionSizePercent ?? 10;
    this.maxOpenPositions = config.maxOpenPositions ?? 20;
    this.minConfidenceThreshold = config.minConfidenceThreshold ?? 60;
  }

  /**
   * Place a market order
   */
  async placeOrder(request: AlpacaOrderRequest): Promise<AlpacaOrder | null> {
    try {
      console.log(`[AlpacaTradeExecutor] Placing ${request.side} order for ${request.symbol} qty=${request.qty}`);

      const url = `${this.baseUrl}/v2/orders`;
      const body = {
        symbol: request.symbol,
        qty: request.qty,
        side: request.side,
        type: request.type,
        time_in_force: request.time_in_force || "day",
        ...(request.limit_price && { limit_price: request.limit_price })
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[AlpacaTradeExecutor] Order failed: ${response.statusText} - ${error}`);
        return null;
      }

      const order = await response.json() as AlpacaOrder;
      console.log(`[AlpacaTradeExecutor] Order placed successfully: ${order.id}`);
      return order;
    } catch (error) {
      console.error("[AlpacaTradeExecutor] Error placing order:", error);
      return null;
    }
  }

  /**
   * Get open positions
   */
  async getOpenPositions(): Promise<AlpacaPosition[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/positions`, {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        console.error(`[AlpacaTradeExecutor] Failed to get positions: ${response.statusText}`);
        return [];
      }

      const positions = await response.json() as AlpacaPosition[];
      return positions || [];
    } catch (error) {
      console.error("[AlpacaTradeExecutor] Error fetching positions:", error);
      return [];
    }
  }

  /**
   * Close a position
   */
  async closePosition(symbol: string): Promise<AlpacaOrder | null> {
    try {
      console.log(`[AlpacaTradeExecutor] Closing position for ${symbol}`);

      const url = `${this.baseUrl}/v2/positions/${symbol}`;
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        console.error(`[AlpacaTradeExecutor] Failed to close position: ${response.statusText}`);
        return null;
      }

      const order = await response.json() as AlpacaOrder;
      console.log(`[AlpacaTradeExecutor] Position closed: ${order.id}`);
      return order;
    } catch (error) {
      console.error("[AlpacaTradeExecutor] Error closing position:", error);
      return null;
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<AlpacaOrder | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
        method: "GET",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      if (!response.ok) {
        return null;
      }

      const order = await response.json() as AlpacaOrder;
      return order;
    } catch (error) {
      console.error(`[AlpacaTradeExecutor] Error fetching order status:`, error);
      return null;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          "APCA-API-KEY-ID": this.apiKey,
          "APCA-API-SECRET-KEY": this.secretKey
        }
      });

      const success = response.ok || response.status === 204;
      if (!success) {
        console.error(`[AlpacaTradeExecutor] Failed to cancel order: ${response.statusText}`);
      }
      return success;
    } catch (error) {
      console.error("[AlpacaTradeExecutor] Error canceling order:", error);
      return false;
    }
  }

  /**
   * Validate position size against limits
   */
  validatePositionSize(qty: number, currentPrice: number, totalEquity: number): boolean {
    const positionValue = qty * currentPrice;
    const positionPercent = (positionValue / totalEquity) * 100;
    return positionPercent <= this.maxPositionSizePercent;
  }

  /**
   * Check if we can open more positions
   */
  canOpenMorePositions(currentPositionCount: number): boolean {
    return currentPositionCount < this.maxOpenPositions;
  }

  /**
   * Get minimum confidence threshold for trading
   */
  getMinConfidenceThreshold(): number {
    return this.minConfidenceThreshold;
  }
}
