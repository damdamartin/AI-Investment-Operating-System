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

export interface TossApiError {
  code: string;
  message: string;
  requestId?: string;
  data?: Record<string, any>;
}

export interface TossOrderModifyRequest {
  orderType: "LIMIT" | "MARKET";
  price?: string;
  quantity?: string;
  confirmHighValueOrder?: boolean;
}

export interface TossOrderResponse {
  result: {
    orderId: string;
    clientOrderId?: string | null;
  };
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
  /**
   * Format price for Toss API (KR vs US market)
   * KR: integer (원 단위)
   * US: decimal (달러 단위, $1 미만: 소수점 4자리, $1 이상: 2자리)
   */
  private formatPrice(symbol: string, price: number): string {
    const isKRStock = /^\d+$/.test(symbol); // Numeric = KR

    if (isKRStock) {
      return Math.round(price).toString();
    } else {
      // US stock: format decimal
      if (price < 1) {
        return price.toFixed(4);
      } else {
        return price.toFixed(2);
      }
    }
  }

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

    // Place order via Toss Open API (POST /api/v1/orders)
    const orderUrl = `${this.apiBaseUrl}/api/v1/orders`;

    const price = request.orderPrice ?? executionPrice;
    const formattedPrice = this.formatPrice(request.symbol, price);
    const formattedQuantity = request.quantity.toString();

    const orderPayload = {
      // Required fields
      symbol: request.symbol,
      side: "BUY",
      orderType: "LIMIT", // Using LIMIT order
      price: formattedPrice,
      quantity: formattedQuantity,

      // Optional but recommended
      clientOrderId: orderId, // For idempotency
      timeInForce: "DAY", // Valid until end of day

      // Safety flag for high-value orders (1억원+)
      confirmHighValueOrder: false
    };

    console.log(
      `[TossTradeExecutor] Posting order to Toss API:`,
      { endpoint: orderUrl, payload: orderPayload }
    );

    const response = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Tossinvest-Account": this.apiAccountRef
      },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `Toss API order failed (${response.status}): ${errorText}`;
      console.error(`[TossTradeExecutor] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const result = await response.json() as any;
    const serverOrderId = result?.result?.orderId;
    const clientOrderId = result?.result?.clientOrderId;

    console.log(
      `[TossTradeExecutor] Toss API order created:`,
      { serverOrderId, clientOrderId, symbol: request.symbol, quantity: formattedQuantity }
    );

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
   * Modify an existing order (주문 정정)
   * KR: Can modify quantity
   * US: Can only modify price (not quantity)
   */
  async modifyOrder(orderId: string, modification: TossOrderModifyRequest): Promise<string> {
    if (!this.apiClientId || !this.apiClientSecret || !this.apiAccountRef) {
      throw new Error("Missing Toss API credentials");
    }

    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const accessToken = await this.getTossAccessToken();
    const modifyUrl = `${this.apiBaseUrl}/api/v1/orders/${orderId}`;

    const modifyPayload = {
      orderType: modification.orderType,
      ...(modification.price && { price: modification.price }),
      ...(modification.quantity && { quantity: modification.quantity }),
      confirmHighValueOrder: modification.confirmHighValueOrder ?? false
    };

    console.log(
      `[TossTradeExecutor] Modifying order ${orderId}:`,
      modifyPayload
    );

    const response = await fetch(modifyUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Tossinvest-Account": this.apiAccountRef
      },
      body: JSON.stringify(modifyPayload)
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      this.handleTossApiError(errorData);
    }

    const result = await response.json() as TossOrderResponse;
    const newOrderId = result.result.orderId;

    console.log(
      `[TossTradeExecutor] Order modified: ${orderId} → ${newOrderId}`
    );

    // Update local order tracking
    order.status = "PENDING";

    return newOrderId;
  }

  /**
   * Cancel an order (주문 취소)
   * Note: Cannot cancel filled orders
   */
  async cancelOrder(orderId: string): Promise<void> {
    if (!this.apiClientId || !this.apiClientSecret || !this.apiAccountRef) {
      throw new Error("Missing Toss API credentials");
    }

    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status === "FILLED") {
      throw new Error(`Cannot cancel filled order: ${orderId}`);
    }

    const accessToken = await this.getTossAccessToken();
    const cancelUrl = `${this.apiBaseUrl}/api/v1/orders/${orderId}`;

    console.log(`[TossTradeExecutor] Cancelling order ${orderId}`);

    const response = await fetch(cancelUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Tossinvest-Account": this.apiAccountRef
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      this.handleTossApiError(errorData);
    }

    const result = await response.json() as TossOrderResponse;
    const cancelledOrderId = result.result.orderId;

    console.log(
      `[TossTradeExecutor] Order cancelled: ${orderId} → ${cancelledOrderId}`
    );

    // Update local order tracking
    order.status = "CANCELLED";
  }

  /**
   * Get order status by orderId (특정 주문 조회)
   */
  async getOrderStatus(orderId: string): Promise<any> {
    if (!this.apiClientId || !this.apiClientSecret || !this.apiAccountRef) {
      throw new Error("Missing Toss API credentials");
    }

    const accessToken = await this.getTossAccessToken();
    const statusUrl = `${this.apiBaseUrl}/api/v1/orders/${orderId}`;

    console.log(`[TossTradeExecutor] Fetching order status: ${orderId}`);

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "X-Tossinvest-Account": this.apiAccountRef
      }
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      this.handleTossApiError(errorData);
    }

    const result = await response.json() as any;
    console.log(`[TossTradeExecutor] Order status:`, result);

    return result.result;
  }

  /**
   * Get all orders with optional filters (모든 주문 조회)
   */
  async getAllOrders(filters?: {
    symbol?: string;
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    if (!this.apiClientId || !this.apiClientSecret || !this.apiAccountRef) {
      throw new Error("Missing Toss API credentials");
    }

    const accessToken = await this.getTossAccessToken();
    const params = new URLSearchParams();

    if (filters?.symbol) params.append("symbol", filters.symbol);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const allOrdersUrl = `${this.apiBaseUrl}/api/v1/orders?${params.toString()}`;

    console.log(`[TossTradeExecutor] Fetching all orders:`, allOrdersUrl);

    const response = await fetch(allOrdersUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "X-Tossinvest-Account": this.apiAccountRef
      }
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      this.handleTossApiError(errorData);
    }

    const result = await response.json() as any;
    console.log(`[TossTradeExecutor] Retrieved ${result.result?.length || 0} orders`);

    return result.result || [];
  }

  /**
   * Parse Toss API error response
   */
  private async parseErrorResponse(response: Response): Promise<TossApiError> {
    try {
      const errorBody = await response.json() as any;
      return {
        code: errorBody.error?.code || "unknown-error",
        message: errorBody.error?.message || `HTTP ${response.status}`,
        requestId: errorBody.error?.requestId,
        data: errorBody.error?.data
      };
    } catch {
      return {
        code: "http-error",
        message: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  }

  /**
   * Handle Toss API errors with specific error codes
   */
  private handleTossApiError(error: TossApiError): never {
    const errorMap: Record<string, { message: string; retryable: boolean }> = {
      "invalid-request": {
        message: "Invalid request parameters",
        retryable: false
      },
      "confirm-high-value-required": {
        message: "Order exceeds ₩100M - confirmation flag required",
        retryable: false
      },
      "order-not-found": {
        message: "Order does not exist",
        retryable: false
      },
      "us-modify-quantity-not-supported": {
        message: "US stocks: cannot modify quantity (price only)",
        retryable: false
      },
      "fractional-quantity-outside-regular-hours": {
        message: "Fractional quantity orders only during regular hours",
        retryable: true
      },
      "amount-order-outside-regular-hours": {
        message: "Amount-based orders only during regular hours",
        retryable: true
      },
      "order-already-filled": {
        message: "Cannot modify/cancel already-filled orders",
        retryable: false
      },
      "insufficient-balance": {
        message: "Insufficient account balance",
        retryable: false
      },
      "max-order-amount-exceeded": {
        message: "Order amount exceeds ₩300B limit",
        retryable: false
      },
      "rate-limit-exceeded": {
        message: "Rate limit exceeded - try again later",
        retryable: true
      }
    };

    const errorInfo = errorMap[error.code] || {
      message: error.message,
      retryable: false
    };

    const fullMessage = `[TossTradeExecutor] ${error.code}: ${errorInfo.message}`;
    if (error.requestId) {
      console.error(`${fullMessage} (RequestId: ${error.requestId})`);
    } else {
      console.error(fullMessage);
    }

    if (error.data) {
      console.error(`Error details:`, error.data);
    }

    // Add retry hint
    if (errorInfo.retryable) {
      const retryAfter = error.data?.retryAfterSeconds || error.data?.retryAfterAt;
      if (retryAfter) {
        console.error(`Retry after: ${retryAfter}`);
      }
    }

    throw new Error(fullMessage);
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
