import { TossMarketDataProvider } from "../../../../adapters/toss/toss-market-data-provider.js";
import type { WatchlistAsset } from "../../../pipeline/market-data-provider.js";
import { MarketDataSnapshot } from "../../../../domain/market-data/index.js";
import { TossTradingAgent, TossAnalysisResult, TossMarketContext } from "./toss-trading-agent.js";
import { TossTradeExecutor, TossOrder, TossPosition, TossExecutionConfig } from "./toss-trade-executor.js";

/**
 * Toss Team Orchestrator
 *
 * Coordinates the Toss trading team:
 * 1. Toss Market Data Provider → fetches real-time prices
 * 2. Toss Trading Agent → analyzes data and generates signals
 * 3. Toss Trade Executor → executes trades based on signals
 *
 * Runs trading cycle: Analyze → Execute → Monitor
 */

export interface TossTeamConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string; // Claude API key
  watchlist: string[]; // Stock symbols to monitor
  maxPositionSizePercent?: number;
  maxOpenPositions?: number;
  minConfidenceThreshold?: number;
}

export interface TossCycleSummary {
  timestamp: Date;
  analysisCount: number;
  buySignals: number;
  ordersExecuted: number;
  openPositions: number;
  totalPnL: number;
  portfolioValue: number;
}

export class TossTeamOrchestrator {
  private marketDataProvider: TossMarketDataProvider;
  private tradingAgent: TossTradingAgent;
  private tradeExecutor: TossTradeExecutor;
  private watchlist: Set<string>;
  private lastAnalysisBySymbol: Map<string, TossAnalysisResult> = new Map();
  private isRunning: boolean = false;

  constructor(config: TossTeamConfig) {
    // Initialize market data provider
    this.marketDataProvider = new TossMarketDataProvider({
      baseUrl: "https://openapi.tossinvest.com",
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });

    // Initialize trading agent
    this.tradingAgent = new TossTradingAgent(config.apiKey);

    // Initialize trade executor with optional config + API credentials
    const executorConfig: TossExecutionConfig = {
      apiClientId: config.clientId,
      apiClientSecret: config.clientSecret,
      apiAccountRef: "1" // From environment
    };
    if (config.maxPositionSizePercent !== undefined) {
      executorConfig.maxPositionSizePercent = config.maxPositionSizePercent;
    }
    if (config.maxOpenPositions !== undefined) {
      executorConfig.maxOpenPositions = config.maxOpenPositions;
    }
    if (config.minConfidenceThreshold !== undefined) {
      executorConfig.minConfidenceThreshold = config.minConfidenceThreshold;
    }
    this.tradeExecutor = new TossTradeExecutor(executorConfig);

    this.watchlist = new Set(config.watchlist);

    console.log(`[TossTeamOrchestrator] Initialized with ${this.watchlist.size} symbols`);
  }

  /**
   * Run a single trading cycle
   */
  async runTradingCycle(currentBalance: number): Promise<TossCycleSummary> {
    const startTime = Date.now();
    console.log(`[TossTeamOrchestrator] Starting trading cycle at ${new Date().toISOString()}`);

    try {
      // Step 1: Fetch market data
      const snapshots = await this.fetchMarketData();
      console.log(`[TossTeamOrchestrator] Fetched ${snapshots.length} market snapshots`);

      // Step 2: Analyze stocks
      const analyses = await this.analyzeMarketData(snapshots);
      console.log(`[TossTeamOrchestrator] Completed ${analyses.length} analyses`);

      // Step 3: Execute trades
      const orders = await this.executeTrades(analyses, currentBalance);
      console.log(`[TossTeamOrchestrator] Executed ${orders.length} orders`);

      // Step 4: Monitor positions
      this.monitorPositions(snapshots);

      // Generate summary
      const summary = this.generateCycleSummary(analyses, orders);

      const elapsed = Date.now() - startTime;
      console.log(`[TossTeamOrchestrator] Cycle completed in ${elapsed}ms`);

      return summary;
    } catch (error) {
      console.error(`[TossTeamOrchestrator] Error in trading cycle:`, error);
      throw error;
    }
  }

  /**
   * Fetch market data for all watchlist symbols
   */
  private async fetchMarketData(): Promise<MarketDataSnapshot[]> {
    const snapshots: MarketDataSnapshot[] = [];
    const now = new Date();

    for (const symbol of this.watchlist) {
      try {
        const asset: WatchlistAsset = {
          assetId: symbol,
          symbol,
          market: { code: this.getMarketCode(symbol) },
          assetType: { code: "STOCK" }
        };

        const data = await this.marketDataProvider.fetchRecentSnapshots(asset, now);
        snapshots.push(...data);
      } catch (error) {
        console.error(`[TossTeamOrchestrator] Failed to fetch ${symbol}:`, error);
      }
    }

    return snapshots;
  }

  /**
   * Analyze market data using trading agent
   */
  private async analyzeMarketData(
    snapshots: MarketDataSnapshot[]
  ): Promise<TossAnalysisResult[]> {
    const analyses: TossAnalysisResult[] = [];

    for (const snapshot of snapshots) {
      if (snapshot.suspectReasons && snapshot.suspectReasons.length > 0) {
        console.log(
          `[TossTeamOrchestrator] Skipping ${snapshot.symbol}: suspect data (${snapshot.suspectReasons.join(", ")})`
        );
        continue;
      }

      try {
        const previousAnalysis = this.lastAnalysisBySymbol.get(snapshot.symbol);
        const context: TossMarketContext = this.tradingAgent.convertSnapshotToContext(
          snapshot,
          previousAnalysis?.currentPrice
        );

        const analysis = await this.tradingAgent.analyzeStock(context);
        analyses.push(analysis);
        this.lastAnalysisBySymbol.set(snapshot.symbol, analysis);
      } catch (error) {
        console.error(
          `[TossTeamOrchestrator] Failed to analyze ${snapshot.symbol}:`,
          error
        );
      }
    }

    return analyses;
  }

  /**
   * Execute trades based on analysis results
   */
  private async executeTrades(
    analyses: TossAnalysisResult[],
    currentBalance: number
  ): Promise<TossOrder[]> {
    const orders: TossOrder[] = [];

    for (const analysis of analyses) {
      try {
        const order = await this.tradeExecutor.executeAnalysis(
          analysis,
          currentBalance
        );

        if (order) {
          orders.push(order);
        }
      } catch (error) {
        console.error(
          `[TossTeamOrchestrator] Failed to execute trade for ${analysis.symbol}:`,
          error
        );
      }
    }

    return orders;
  }

  /**
   * Monitor open positions for stop-loss and take-profit
   */
  private monitorPositions(snapshots: MarketDataSnapshot[]): void {
    const currentPrices = new Map<string, number>();

    for (const snapshot of snapshots) {
      if (snapshot.price) {
        // Extract price from bigint units (6 decimal places)
        const priceValue = Number(snapshot.price.units) / 1_000_000;
        currentPrices.set(snapshot.symbol, priceValue);
      }
    }

    this.tradeExecutor.monitorPositions(currentPrices);
  }

  /**
   * Generate trading cycle summary
   */
  private generateCycleSummary(
    analyses: TossAnalysisResult[],
    orders: TossOrder[]
  ): TossCycleSummary {
    const buySignals = analyses.filter(a => a.recommendation === "BUY").length;
    const positions = this.tradeExecutor.getOpenPositions();
    const summary = this.tradeExecutor.getPortfolioSummary();

    return {
      timestamp: new Date(),
      analysisCount: analyses.length,
      buySignals,
      ordersExecuted: orders.length,
      openPositions: positions.length,
      totalPnL: summary.totalPnL,
      portfolioValue: summary.totalValue
    };
  }

  /**
   * Get market code from symbol (KR for Korean, US for US)
   */
  private getMarketCode(symbol: string): "KR" | "US" {
    // Simple heuristic: if symbol is all numeric, it's Korean stock code
    return /^\d+$/.test(symbol) ? "KR" : "US";
  }

  /**
   * Add symbol to watchlist
   */
  addToWatchlist(symbol: string): void {
    this.watchlist.add(symbol);
    console.log(`[TossTeamOrchestrator] Added ${symbol} to watchlist`);
  }

  /**
   * Remove symbol from watchlist
   */
  removeFromWatchlist(symbol: string): void {
    this.watchlist.delete(symbol);
    console.log(`[TossTeamOrchestrator] Removed ${symbol} from watchlist`);
  }

  /**
   * Get current watchlist
   */
  getWatchlist(): string[] {
    return Array.from(this.watchlist);
  }

  /**
   * Get open positions
   */
  getOpenPositions(): TossPosition[] {
    return this.tradeExecutor.getOpenPositions();
  }

  /**
   * Get last analysis for a symbol
   */
  getLastAnalysis(symbol: string): TossAnalysisResult | undefined {
    return this.lastAnalysisBySymbol.get(symbol);
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary() {
    return this.tradeExecutor.getPortfolioSummary();
  }

  /**
   * Update portfolio value
   */
  setPortfolioValue(value: number): void {
    this.tradeExecutor.setPortfolioValue(value);
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.watchlist.size > 0;
  }
}
