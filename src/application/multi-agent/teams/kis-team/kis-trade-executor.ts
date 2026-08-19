import { KISAnalysisResult } from "./kis-trading-agent.js";

/**
 * KIS Trade Executor
 *
 * Executes trading decisions from KIS Trading Agent using KIS Open API.
 * Handles:
 * - Order placement (BUY/SELL)
 * - Position tracking
 * - Stop-loss and take-profit management
 * - Order status monitoring
 *
 * Note: Currently tracks orders in memory. In production, persist to database.
 */

export interface KISOrderRequest {
  symbol: string;
  quantity: number;
  orderType: "BUY" | "SELL";
  orderPrice?: number | undefined;
  stopLossPrice?: number | undefined;
  takeProfitPrice?: number | undefined;
}

export interface KISOrder {
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

export interface KISPosition {
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

export interface KISExecutionConfig {
  /** Maximum percentage of portfolio for a single position (default: 5%) */
  maxPositionSizePercent?: number;
  /** Maximum positions open at once (default: 10) */
  maxOpenPositions?: number;
  /** Minimum confidence score to execute (default: 0.6) */
  minConfidenceThreshold?: number;
  /** Base quantity for orders (default: 10 shares) */
  baseOrderQuantity?: number;
}

export class KISTradeExecutor {
  private orders: Map<string, KISOrder> = new Map();
  private positions: Map<string, KISPosition> = new Map();
  private config: Required<KISExecutionConfig>;
  private portfolioValue: number = 10_000_000; // Default: ₩10M

  constructor(config: KISExecutionConfig = {}) {
    this.config = {
      maxPositionSizePercent: config.maxPositionSizePercent ?? 5,
      maxOpenPositions: config.maxOpenPositions ?? 10,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 0.6,
      baseOrderQuantity: config.baseOrderQuantity ?? 10
    };
  }

  /**
   * Execute a trading decision from analysis result
   */
  async executeAnalysis(
    analysis: KISAnalysisResult,
    currentBalance: number
  ): Promise<KISOrder | null> {
    // Validate confidence threshold
    if (analysis.confidence < this.config.minConfidenceThreshold) {
      console.log(
        `[KISTradeExecutor] Skipping ${analysis.symbol}: confidence ${analysis.confidence.toFixed(2)} below threshold ${this.config.minConfidenceThreshold}`
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
        `[KISTradeExecutor] Cannot open new position: max ${this.config.maxOpenPositions} positions reached`
      );
      return null;
    }

    // Calculate order quantity
    const maxPositionValue =
      currentBalance * (this.config.maxPositionSizePercent / 100);
    const quantity = Math.floor(maxPositionValue / analysis.currentPrice);

    if (quantity <= 0) {
      console.log(
        `[KISTradeExecutor] Skipping ${analysis.symbol}: insufficient balance`
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
   * Place a BUY order
   */
  async placeBuyOrder(
    request: KISOrderRequest,
    analysis: KISAnalysisResult
  ): Promise<KISOrder> {
    const orderId = this.generateOrderId();

    const order: KISOrder = {
      orderId,
      symbol: request.symbol,
      quantity: request.quantity,
      orderType: "BUY" as const,
      orderPrice: request.orderPrice ?? undefined,
      status: "PENDING",
      createdAt: new Date(),
      executionPrice: undefined,
      filledAt: undefined,
      reason: undefined
    };

    // Call actual KIS API for order execution
    const isProduction = process.env.KIS_ENV === "production";
    if (isProduction) {
      await this.executeKISOrder(order, analysis);
    } else {
      // Fall back to simulation for testing
      await this.simulateOrderExecution(order, analysis);
    }

    // Store order
    this.orders.set(orderId, order);

    return order;
  }

  /**
   * Place a SELL order
   */
  async placeSellOrder(
    symbol: string,
    quantity: number,
    price?: number
  ): Promise<KISOrder> {
    const orderId = this.generateOrderId();

    const order: KISOrder = {
      orderId,
      symbol,
      quantity,
      orderType: "SELL" as const,
      orderPrice: price ?? undefined,
      status: "PENDING",
      createdAt: new Date(),
      executionPrice: undefined,
      filledAt: undefined,
      reason: undefined
    };

    // Simulate order execution
    order.status = "FILLED";
    order.filledAt = new Date();
    order.executionPrice = price ?? undefined;

    this.orders.set(orderId, order);

    // Update or close position
    this.closePosition(symbol);

    return order;
  }

  /**
   * Monitor positions for stop-loss and take-profit
   */
  monitorPositions(currentPrices: Map<string, number>): void {
    for (const [symbol, position] of this.positions.entries()) {
      const currentPrice = currentPrices.get(symbol);
      if (!currentPrice) continue;

      position.currentPrice = currentPrice;
      position.pnl = (currentPrice - position.entryPrice) * position.quantity;
      position.pnlPercent =
        ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      // Check stop-loss
      if (currentPrice <= position.stopLossPrice) {
        console.log(
          `[KISTradeExecutor] Stop-loss triggered for ${symbol} at ${currentPrice}`
        );
        position.status = "AT_STOP_LOSS";
      }

      // Check take-profit
      if (currentPrice >= position.takeProfitPrice) {
        console.log(
          `[KISTradeExecutor] Take-profit triggered for ${symbol} at ${currentPrice}`
        );
        position.status = "AT_TAKE_PROFIT";
      }
    }
  }

  /**
   * Get all open positions
   */
  getOpenPositions(): KISPosition[] {
    return Array.from(this.positions.values()).filter(
      p => p.status === "OPEN"
    );
  }

  /**
   * Get position by symbol
   */
  getPosition(symbol: string): KISPosition | null {
    return this.positions.get(symbol) ?? null;
  }

  /**
   * Close a position
   */
  private closePosition(symbol: string): void {
    const position = this.positions.get(symbol);
    if (position) {
      position.status = "CLOSED";
    }
  }

  /**
   * Execute actual KIS API order
   */
  private async executeKISOrder(
    order: KISOrder,
    analysis: KISAnalysisResult
  ): Promise<void> {
    try {
      const appKey = process.env.KIS_APP_KEY;
      const appSecret = process.env.KIS_APP_SECRET;
      const accountNumber = process.env.KIS_ACCOUNT_NUMBER;

      if (!appKey || !appSecret || !accountNumber) {
        console.error("[KISTradeExecutor] Missing KIS credentials");
        throw new Error("KIS 자격증명이 설정되지 않았습니다");
      }

      // KIS API 호출 (실제 구현)
      // TODO: KIS API 엔드포인트 설정 후 구현
      // const response = await fetch("https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/trading/order-cash", {
      //   method: "POST",
      //   headers: {
      //     "Authorization": `Bearer ${accessToken}`,
      //     "appKey": appKey,
      //     "appSecret": appSecret,
      //     "tr_id": order.orderType === "BUY" ? "TTTC0802U" : "TTTC0801U"
      //   },
      //   body: JSON.stringify({
      //     CANO: accountNumber.split("-")[0],
      //     ACNT_PRDT_CD: "01",
      //     PDNO: order.symbol,
      //     ORD_QTY: order.quantity,
      //     ORD_UNPR: order.orderPrice || analysis.currentPrice,
      //     ORD_DVSN_CD: "00"
      //   })
      // });

      // 현재는 임시로 시뮬레이션 사용
      await this.simulateOrderExecution(order, analysis);
      console.log("[KISTradeExecutor] KIS order executed (API not yet fully configured)");
    } catch (error) {
      console.error("[KISTradeExecutor] KIS order execution failed:", error);
      order.status = "REJECTED";
      order.reason = String(error);
    }
  }

  /**
   * Simulate order execution (in production, call actual KIS API)
   */
  private async simulateOrderExecution(
    order: KISOrder,
    analysis: KISAnalysisResult
  ): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mark order as filled
    order.status = "FILLED";
    order.filledAt = new Date();
    order.executionPrice = analysis.currentPrice;

    // Create position
    const position: KISPosition = {
      symbol: order.symbol,
      quantity: order.quantity,
      entryPrice: order.executionPrice!,
      currentPrice: order.executionPrice!,
      stopLossPrice: analysis.stopLossPrice,
      takeProfitPrice: analysis.takeProfitPrice,
      pnl: 0,
      pnlPercent: 0,
      createdAt: order.filledAt,
      status: "OPEN"
    };

    this.positions.set(order.symbol, position);

    console.log(
      `[KISTradeExecutor] Order filled: ${order.quantity}x ${order.symbol} @ ${order.executionPrice}`
    );
  }

  /**
   * Set portfolio value for position sizing
   */
  setPortfolioValue(value: number): void {
    this.portfolioValue = value;
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
    const openPositions = this.getOpenPositions();
    const positionValue = openPositions.reduce(
      (sum, p) => sum + p.quantity * p.currentPrice,
      0
    );
    const cashValue = this.portfolioValue - positionValue;
    const totalPnL = openPositions.reduce((sum, p) => sum + p.pnl, 0);
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
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `KIS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
