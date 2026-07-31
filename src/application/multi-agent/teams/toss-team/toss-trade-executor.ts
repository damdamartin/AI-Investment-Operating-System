import { TossAnalysisResult } from "./toss-trading-agent.js";

/**
 * Toss Trade Executor
 *
 * Executes trading decisions from Toss Trading Agent using Toss Securities API.
 * Handles:
 * - Order placement (BUY/SELL)
 * - Position tracking
 * - Stop-loss and take-profit management
 * - Order status monitoring
 *
 * Note: Currently tracks orders in memory. In production, persist to database.
 */

export interface TossOrderRequest {
  symbol: string;
  quantity: number;
  orderType: "BUY" | "SELL";
  orderPrice?: number | undefined;
  stopLossPrice?: number | undefined;
  takeProfitPrice?: number | undefined;
}

export interface TossOrder {
  orderId: string;
  symbol: string;
  quantity: number;
  orderType: "BUY" | "SELL";
  orderPrice?: number | undefined;
  executionPrice?: number | undefined;
  status: "PENDING" | "FILLED" | "PARTIAL" | "CANCELLED" | "REJECTED";
  createdAt: Date;
  filledAt?: Date | undefined;
  reason?: string | undefined;
}

export interface TossPosition {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  pnl: number;
  pnlPercent: number;
  createdAt: Date;
  status: "OPEN" | "CLOSED" | "AT_STOP_LOSS" | "AT_TAKE_PROFIT";
}

export interface TossExecutionConfig {
  /** Maximum percentage of portfolio for a single position (default: 5%) */
  maxPositionSizePercent?: number;
  /** Maximum positions open at once (default: 10) */
  maxOpenPositions?: number;
  /** Minimum confidence score to execute (default: 0.6) */
  minConfidenceThreshold?: number;
  /** Base quantity for orders (default: 10 shares) */
  baseOrderQuantity?: number;
  /** API credentials for live trading */
  apiClientId?: string;
  apiClientSecret?: string;
  apiAccountRef?: string;
  apiBaseUrl?: string;
}

export class TossTradeExecutor {
  private orders: Map<string, TossOrder> = new Map();
  private positions: Map<string, TossPosition> = new Map();
  private config: {
    maxPositionSizePercent: number;
    maxOpenPositions: number;
    minConfidenceThreshold: number;
    baseOrderQuantity: number;
  };
  private portfolioValue: number = 10_000_000; // Default: ₩10M
  private apiClientId?: string;
  private apiClientSecret?: string;
  private apiAccountRef?: string;
  private apiBaseUrl: string = "https://openapi.tossinvest.com";

  constructor(config: TossExecutionConfig = {}) {
    this.config = {
      maxPositionSizePercent: config.maxPositionSizePercent ?? 5,
      maxOpenPositions: config.maxOpenPositions ?? 10,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.6,
      baseOrderQuantity: config.baseOrderQuantity ?? 10
    };

    // API credentials for live trading
    if (config.apiClientId) this.apiClientId = config.apiClientId;
    if (config.apiClientSecret) this.apiClientSecret = config.apiClientSecret;
    if (config.apiAccountRef) this.apiAccountRef = config.apiAccountRef;
    if (config.apiBaseUrl) this.apiBaseUrl = config.apiBaseUrl;
  }

  /**
   * Execute a trading decision from analysis result
   */
  async executeAnalysis(
    analysis: TossAnalysisResult,
    currentBalance: number
  ): Promise<TossOrder | null> {
    // Validate confidence threshold
    if (analysis.confidence < this.config.minConfidenceThreshold) {
      console.log(
        `[TossTradeExecutor] Skipping ${analysis.symbol}: confidence ${analysis.confidence.toFixed(2)} below threshold ${this.config.minConfidenceThreshold}`
      );
      return null;
    }

    // Only execute BUY signals; SELL/HOLD are handled by stop-loss/take-profit
    if (analysis.recommendation !== "BUY") {
      return null;
    }

    // Validate position limits
    if (this.positions.size >= this.config.maxOpenPositions) {
      console.log(
        `[TossTradeExecutor] Cannot open new position: max ${this.config.maxOpenPositions} positions reached`
      );
      return null;
    }

    // Calculate order quantity
    const maxPositionValue =
      currentBalance * (this.config.maxPositionSizePercent / 100);
    const quantity = Math.floor(maxPositionValue / analysis.currentPrice);

    if (quantity <= 0) {
      console.log(
        `[TossTradeExecutor] Skipping ${analysis.symbol}: insufficient balance`
      );
      return null;
    }

    // Create order
    const order = await this.placeBuyOrder(
      {
        symbol: analysis.symbol,
        quantity,
        orderType: "BUY",
        orderPrice: analysis.entryPrice,
        stopLossPrice: analysis.stopLossPrice,
        takeProfitPrice: analysis.takeProfitPrice
      },
      analysis
    );

    return order;
  }

  /**
   * Place a BUY order (calls Toss API if credentials available)
   */
  async placeBuyOrder(
    request: TossOrderRequest,
    analysis: TossAnalysisResult
  ): Promise<TossOrder> {
    const orderId = this.generateOrderId();

    const order: TossOrder = {
      orderId,
      symbol: request.symbol,
      quantity: request.quantity,
      orderType: "BUY" as const,
      orderPrice: request.orderPrice ?? undefined,
      status: "PENDING",
      createdAt: new Date(),
      executionPrice: undefined,
      filledAt: undefined
    };

    this.orders.set(orderId, order);

    // Try to execute real order via Toss API
    if (this.apiClientId && this.apiClientSecret && this.apiAccountRef) {
      try {
        await this.executeTossOrder(request, orderId, analysis.entryPrice);
        console.log(
          `[TossTradeExecutor] Executed BUY order ${orderId} via Toss API: ${request.quantity} ${request.symbol} @ ${request.orderPrice}`
        );
      } catch (error) {
        console.error(`[TossTradeExecutor] Toss API order failed:`, error);
        order.status = "REJECTED";
        order.reason = String(error);
      }
    } else {
      // Fallback: simulate order execution
      setTimeout(() => {
        this.fillOrder(orderId, analysis.entryPrice);
      }, 1000);

      console.log(
        `[TossTradeExecutor] Simulated BUY order ${orderId}: ${request.quantity} ${request.symbol} @ ${request.orderPrice}`
      );
    }

    return order;
  }

  /**
   * Fill an order (simulate or real execution)
   */
  private fillOrder(orderId: string, executionPrice: number): void {
    const order = this.orders.get(orderId);
    if (!order) return;

    order.status = "FILLED";
    order.executionPrice = executionPrice;
    order.filledAt = new Date();

    // Create position
    const position: TossPosition = {
      symbol: order.symbol,
      quantity: order.quantity,
      entryPrice: executionPrice,
      currentPrice: executionPrice,
      stopLossPrice: executionPrice * 0.95, // -5%
      takeProfitPrice: executionPrice * 1.1, // +10%
      pnl: 0,
      pnlPercent: 0,
      createdAt: new Date(),
      status: "OPEN"
    };

    this.positions.set(order.symbol, position);

    console.log(
      `[TossTradeExecutor] Order ${orderId} filled: ${order.symbol} @ ${executionPrice.toLocaleString()}`
    );
  }

  /**
   * Monitor positions for stop-loss and take-profit
   */
  monitorPositions(currentPrices: Map<string, number>): void {
    for (const [symbol, position] of this.positions) {
      const currentPrice = currentPrices.get(symbol);
      if (!currentPrice) continue;

      position.currentPrice = currentPrice;
      position.pnl = (currentPrice - position.entryPrice) * position.quantity;
      position.pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      // Check stop-loss
      if (currentPrice <= position.stopLossPrice) {
        position.status = "AT_STOP_LOSS";
        this.closePosition(symbol, "STOP_LOSS");
      }

      // Check take-profit
      if (currentPrice >= position.takeProfitPrice) {
        position.status = "AT_TAKE_PROFIT";
        this.closePosition(symbol, "TAKE_PROFIT");
      }
    }
  }

  /**
   * Close a position
   */
  private closePosition(symbol: string, reason: string): void {
    const position = this.positions.get(symbol);
    if (!position) return;

    position.status = "CLOSED";
    console.log(
      `[TossTradeExecutor] Closed position ${symbol}: ${reason} with P&L ${position.pnl.toLocaleString()}`
    );
  }

  /**
   * Get open positions
   */
  getOpenPositions(): TossPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === "OPEN");
  }

  /**
   * Get all positions (including closed)
   */
  getAllPositions(): TossPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary(): {
    totalValue: number;
    positionValue: number;
    cashValue: number;
    totalPnL: number;
    totalPnLPercent: number;
  } {
    const openPositions = Array.from(this.positions.values()).filter(p => p.status === "OPEN");
    const positionValue = openPositions.reduce(
      (sum, p) => sum + p.currentPrice * p.quantity,
      0
    );
    const totalPnL = openPositions.reduce((sum, p) => sum + p.pnl, 0);
    const cashValue = this.portfolioValue - positionValue;
    const totalPnLPercent =
      this.portfolioValue > 0 ? (totalPnL / this.portfolioValue) * 100 : 0;

    return {
      totalValue: this.portfolioValue,
      positionValue,
      cashValue,
      totalPnL,
      totalPnLPercent
    };
  }

  /**
   * Set portfolio value (e.g., initial balance)
   */
  setPortfolioValue(value: number): void {
    this.portfolioValue = value;
  }

  /**
   * Execute order via Toss API
   */
  private async executeTossOrder(
    request: TossOrderRequest,
    orderId: string,
    executionPrice: number
  ): Promise<void> {
    if (!this.apiClientId || !this.apiClientSecret || !this.apiAccountRef) {
      throw new Error("Missing Toss API credentials");
    }

    // Get access token
    const accessToken = await this.getTossAccessToken();

    // Place order via Toss API
    const orderUrl = `${this.apiBaseUrl}/api/v1/accounts/${this.apiAccountRef}/orders`;

    const orderPayload = {
      symbol: request.symbol,
      quantity: request.quantity,
      orderType: "LIMIT_ORDER",
      orderPrice: Math.round(request.orderPrice ?? executionPrice),
      side: "BUY"
    };

    const response = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-tossinvest-account": this.apiAccountRef
      },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Toss API order failed (${response.status}): ${errorText}`
      );
    }

    const result = await response.json() as any;
    console.log(`[TossTradeExecutor] Toss API response:`, result);

    // Mark order as filled
    const order = this.orders.get(orderId);
    if (order) {
      order.status = "FILLED";
      order.executionPrice = executionPrice;
      order.filledAt = new Date();

      // Create position
      const position: TossPosition = {
        symbol: request.symbol,
        quantity: request.quantity,
        entryPrice: executionPrice,
        currentPrice: executionPrice,
        stopLossPrice: executionPrice * 0.95,
        takeProfitPrice: executionPrice * 1.1,
        pnl: 0,
        pnlPercent: 0,
        createdAt: new Date(),
        status: "OPEN"
      };

      this.positions.set(request.symbol, position);
    }
  }

  /**
   * Get Toss API access token via OAuth2
   */
  private async getTossAccessToken(): Promise<string> {
    if (!this.apiClientId || !this.apiClientSecret) {
      throw new Error("Missing Toss API credentials");
    }

    const tokenUrl = `${this.apiBaseUrl}/oauth2/token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.apiClientId,
        client_secret: this.apiClientSecret,
        scope: "read write"
      }).toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get Toss access token (${response.status}): ${errorText}`
      );
    }

    const tokenData = await response.json() as any;
    return tokenData.access_token;
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `TOSS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
