import { AlpacaMarketDataProvider } from "./alpaca-market-data-provider.js";
import { AlpacaTradingAgent, type AlpacaAnalysisResult } from "./alpaca-trading-agent.js";
import { AlpacaTradeExecutor, type AlpacaOrder } from "./alpaca-trade-executor.js";
import type { MarketDataSnapshot } from "../../../../domain/market-data/index.js";

export interface AlpacaTeamConfig {
  apiKey: string;
  secretKey: string;
  claudeApiKey: string;
  watchlist: string[];
  maxPositionSizePercent?: number;
  maxOpenPositions?: number;
  minConfidenceThreshold?: number;
  paperTrading?: boolean;
}

export interface AlpacaCycleSummary {
  timestamp: Date;
  analysisCount: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  ordersExecuted: number;
  openPositions: number;
  totalPnL: number;
  portfolioValue: number;
  errors: string[];
}

/**
 * Alpaca Team Orchestrator
 * Coordinates the Alpaca trading team for US stock trading
 *
 * Workflow:
 * 1. Fetch market data for watchlist symbols
 * 2. Analyze data with Claude AI
 * 3. Execute trades based on signals
 * 4. Monitor positions and P&L
 */
export class AlpacaTeamOrchestrator {
  private marketDataProvider: AlpacaMarketDataProvider;
  private tradingAgent: AlpacaTradingAgent;
  private tradeExecutor: AlpacaTradeExecutor;
  private watchlist: Set<string>;
  private lastAnalysisBySymbol: Map<string, AlpacaAnalysisResult> = new Map();
  private isRunning: boolean = false;

  constructor(config: AlpacaTeamConfig) {
    this.marketDataProvider = new AlpacaMarketDataProvider({
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      baseUrl: "https://api.alpaca.markets"
    });

    this.tradingAgent = new AlpacaTradingAgent(config.claudeApiKey);

    this.tradeExecutor = new AlpacaTradeExecutor({
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      baseUrl: "https://api.alpaca.markets",
      paperTrading: config.paperTrading ?? false,
      maxPositionSizePercent: config.maxPositionSizePercent ?? 10,
      maxOpenPositions: config.maxOpenPositions ?? 20,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 60
    });

    this.watchlist = new Set(config.watchlist);
    console.log(`[AlpacaTeamOrchestrator] Initialized with ${this.watchlist.size} symbols`);
  }

  /**
   * Run a single trading cycle
   */
  async runTradingCycle(): Promise<AlpacaCycleSummary> {
    if (this.isRunning) {
      console.log("[AlpacaTeamOrchestrator] Cycle already running, skipping");
      return {
        timestamp: new Date(),
        analysisCount: 0,
        buySignals: 0,
        sellSignals: 0,
        holdSignals: 0,
        ordersExecuted: 0,
        openPositions: 0,
        totalPnL: 0,
        portfolioValue: 0,
        errors: ["Cycle already running"]
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log(
        `[AlpacaTeamOrchestrator] Starting trading cycle at ${new Date().toISOString()}`
      );

      // Step 1: Verify account connectivity
      const accountInfo = await this.marketDataProvider.getAccountInfo();
      if (!accountInfo) {
        throw new Error("Failed to connect to Alpaca account");
      }
      console.log(
        `[AlpacaTeamOrchestrator] Account verified: Equity=${accountInfo.equity}, Cash=${accountInfo.cash}`
      );

      // Step 2: Fetch market data
      const snapshots = await this.fetchMarketData();
      if (snapshots.length === 0) {
        throw new Error("Failed to fetch market data");
      }
      console.log(`[AlpacaTeamOrchestrator] Fetched ${snapshots.length} market snapshots`);

      // Step 3: Analyze stocks
      const analyses = await this.tradingAgent.analyzeMarket(snapshots);
      console.log(`[AlpacaTeamOrchestrator] Completed ${analyses.length} analyses`);

      // Update last analyses
      for (const analysis of analyses) {
        this.lastAnalysisBySymbol.set(analysis.symbol, analysis);
      }

      // Step 4: Execute trades
      const { orders, executed } = await this.executeTrades(analyses, accountInfo.cash);
      console.log(`[AlpacaTeamOrchestrator] Executed ${executed} of ${orders.length} orders`);

      // Step 5: Get current positions
      const positions = await this.tradeExecutor.getOpenPositions();
      console.log(`[AlpacaTeamOrchestrator] Current open positions: ${positions.length}`);

      // Generate summary
      const summary = this.generateCycleSummary(analyses, orders, positions, accountInfo);

      const elapsed = Date.now() - startTime;
      console.log(`[AlpacaTeamOrchestrator] Cycle completed in ${elapsed}ms`);

      return { ...summary, errors };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AlpacaTeamOrchestrator] Cycle error: ${errorMsg}`);
      errors.push(errorMsg);

      return {
        timestamp: new Date(),
        analysisCount: 0,
        buySignals: 0,
        sellSignals: 0,
        holdSignals: 0,
        ordersExecuted: 0,
        openPositions: 0,
        totalPnL: 0,
        portfolioValue: 0,
        errors
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch market data for all watchlist symbols
   */
  private async fetchMarketData(): Promise<MarketDataSnapshot[]> {
    const snapshots: MarketDataSnapshot[] = [];
    const now = new Date();
    const { Market, AssetType } = await import("../../../../domain/value-objects/index.js");

    for (const symbol of this.watchlist) {
      try {
        const asset = {
          assetId: symbol,
          symbol,
          market: Market.from("US"),
          assetType: AssetType.from("STOCK")
        };

        const data = await this.marketDataProvider.fetchRecentSnapshots(asset, now);
        snapshots.push(...data);
      } catch (error) {
        console.error(`[AlpacaTeamOrchestrator] Failed to fetch ${symbol}:`, error);
      }
    }

    return snapshots;
  }

  /**
   * Execute trades based on analysis results
   */
  private async executeTrades(
    analyses: AlpacaAnalysisResult[],
    cashAvailable: number
  ): Promise<{ orders: AlpacaOrder[]; executed: number }> {
    const orders: AlpacaOrder[] = [];
    let executed = 0;

    // Get current positions
    const positions = await this.tradeExecutor.getOpenPositions();
    const positionCount = positions.length;

    for (const analysis of analyses) {
      try {
        // Skip low confidence signals
        if (analysis.confidence < this.tradeExecutor.getMinConfidenceThreshold()) {
          console.log(
            `[AlpacaTeamOrchestrator] Skipping ${analysis.symbol} - confidence ${analysis.confidence} below threshold`
          );
          continue;
        }

        // Skip if we can't open more positions
        if (
          analysis.signal === "BUY" &&
          !this.tradeExecutor.canOpenMorePositions(positionCount)
        ) {
          console.log(
            `[AlpacaTeamOrchestrator] Skipping ${analysis.symbol} - max positions reached`
          );
          continue;
        }

        if (analysis.signal === "BUY") {
          // Calculate position size
          const qty = Math.floor(cashAvailable / (analysis.targetPrice || 100) / 10);
          if (qty > 0) {
            const order = await this.tradeExecutor.placeOrder({
              symbol: analysis.symbol,
              qty,
              side: "buy",
              type: "market",
              time_in_force: "day"
            });

            if (order) {
              orders.push(order);
              executed++;
            }
          }
        } else if (analysis.signal === "SELL") {
          // Close existing position
          const position = positions.find((p) => p.symbol === analysis.symbol);
          if (position && Number(position.qty) > 0) {
            const order = await this.tradeExecutor.closePosition(analysis.symbol);
            if (order) {
              orders.push(order);
              executed++;
            }
          }
        }
      } catch (error) {
        console.error(
          `[AlpacaTeamOrchestrator] Error executing ${analysis.symbol}:`,
          error
        );
      }
    }

    return { orders, executed };
  }

  /**
   * Generate cycle summary
   */
  private generateCycleSummary(
    analyses: AlpacaAnalysisResult[],
    orders: AlpacaOrder[],
    positions: any[],
    accountInfo: { equity: number; cash: number; buying_power: number }
  ): AlpacaCycleSummary {
    const buySignals = analyses.filter((a) => a.signal === "BUY").length;
    const sellSignals = analyses.filter((a) => a.signal === "SELL").length;
    const holdSignals = analyses.filter((a) => a.signal === "HOLD").length;

    let totalPnL = 0;
    for (const position of positions) {
      const gain = Number(position.unrealized_gain) || 0;
      totalPnL += gain;
    }

    return {
      timestamp: new Date(),
      analysisCount: analyses.length,
      buySignals,
      sellSignals,
      holdSignals,
      ordersExecuted: orders.filter((o) => o.status === "filled").length,
      openPositions: positions.length,
      totalPnL,
      portfolioValue: accountInfo.equity,
      errors: []
    };
  }

  /**
   * Get last analysis for a symbol
   */
  getLastAnalysis(symbol: string): AlpacaAnalysisResult | undefined {
    return this.lastAnalysisBySymbol.get(symbol);
  }

  /**
   * Get all last analyses
   */
  getLastAnalyses(): Map<string, AlpacaAnalysisResult> {
    return new Map(this.lastAnalysisBySymbol);
  }

  /**
   * Update watchlist
   */
  updateWatchlist(symbols: string[]): void {
    this.watchlist = new Set(symbols);
    console.log(`[AlpacaTeamOrchestrator] Watchlist updated to ${this.watchlist.size} symbols`);
  }

  /**
   * Get current watchlist
   */
  getWatchlist(): string[] {
    return Array.from(this.watchlist);
  }
}
