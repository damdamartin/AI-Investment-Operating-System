import { KISMarketDataProvider } from "../../../../adapters/kis/kis-market-data-provider.js";
import type { WatchlistAsset } from "../../../pipeline/market-data-provider.js";
import { MarketDataSnapshot } from "../../../../domain/market-data/index.js";
import { KISTradingAgent, KISAnalysisResult, KISMarketContext } from "./kis-trading-agent.js";
import { KISTradeExecutor, KISOrder, KISPosition, KISExecutionConfig } from "./kis-trade-executor.js";

/**
 * KIS Team Orchestrator
 *
 * Coordinates the KIS trading team:
 * 1. KIS Market Data Provider → fetches real-time prices
 * 2. KIS Trading Agent → analyzes data and generates signals
 * 3. KIS Trade Executor → executes trades based on signals
 *
 * Runs trading cycle: Analyze → Execute → Monitor
 */

export interface KISTeamConfig {
  appKey: string;
  appSecret: string;
  accountNumber?: string;
  apiKey: string; // Claude API key
  watchlist: string[]; // Stock symbols to monitor
  maxPositionSizePercent?: number;
  maxOpenPositions?: number;
  minConfidenceThreshold?: number;
}

export interface KISCycleSummary {
  timestamp: Date;
  analysisCount: number;
  buySignals: number;
  ordersExecuted: number;
  openPositions: number;
  totalPnL: number;
  portfolioValue: number;
  portfolio?: {
    krw: number; // Korean stock portfolio value
    usd: number; // US stock portfolio value
  };
}

export class KISTeamOrchestrator {
  private marketDataProvider: KISMarketDataProvider;
  private tradingAgent: KISTradingAgent;
  private tradeExecutor: KISTradeExecutor;
  private watchlist: Set<string>;
  private lastAnalysisBySymbol: Map<string, KISAnalysisResult> = new Map();
  private isRunning: boolean = false;
  private portfolioKRW: number = 0; // Korean won portfolio
  private portfolioUSD: number = 0; // US dollar portfolio

  constructor(config: KISTeamConfig) {
    // Initialize market data provider
    this.marketDataProvider = new KISMarketDataProvider({
      appKey: config.appKey,
      appSecret: config.appSecret,
      accountNumber: config.accountNumber
    });

    // Initialize trading agent
    this.tradingAgent = new KISTradingAgent(config.apiKey);

    // Initialize trade executor with optional config
    const executorConfig: KISExecutionConfig = {};
    if (config.maxPositionSizePercent !== undefined) {
      executorConfig.maxPositionSizePercent = config.maxPositionSizePercent;
    }
    if (config.maxOpenPositions !== undefined) {
      executorConfig.maxOpenPositions = config.maxOpenPositions;
    }
    if (config.minConfidenceThreshold !== undefined) {
      executorConfig.minConfidenceThreshold = config.minConfidenceThreshold;
    }
    this.tradeExecutor = new KISTradeExecutor(executorConfig);

    this.watchlist = new Set(config.watchlist);

    console.log(`[KISTeamOrchestrator] Initialized with ${this.watchlist.size} symbols`);
  }

  /**
   * Run a single trading cycle
   * @param krwBalance Portfolio value in Korean Won
   * @param usdBalance Optional portfolio value in US Dollars (for US stocks)
   */
  async runTradingCycle(krwBalance: number, usdBalance?: number): Promise<KISCycleSummary> {
    const startTime = Date.now();
    this.portfolioKRW = krwBalance;
    this.portfolioUSD = usdBalance ?? 0;

    console.log(`[KISTeamOrchestrator] Starting trading cycle at ${new Date().toISOString()}`);
    console.log(`[KISTeamOrchestrator] Portfolio: KRW=${krwBalance}, USD=${this.portfolioUSD}`);

    try {
      // Step 1: Fetch market data
      const snapshots = await this.fetchMarketData();
      console.log(`[KISTeamOrchestrator] Fetched ${snapshots.length} market snapshots`);

      // Step 2: Analyze stocks
      const analyses = await this.analyzeMarketData(snapshots);
      console.log(`[KISTeamOrchestrator] Completed ${analyses.length} analyses`);

      // Step 3: Execute trades (use appropriate balance by currency)
      const totalBalance = krwBalance + (this.portfolioUSD > 0 ? this.portfolioUSD * 1300 : 0); // Rough KRW conversion
      const orders = await this.executeTrades(analyses, totalBalance);
      console.log(`[KISTeamOrchestrator] Executed ${orders.length} orders`);

      // Step 4: Monitor positions
      this.monitorPositions(snapshots);

      // Generate summary
      const summary = this.generateCycleSummary(analyses, orders);

      const elapsed = Date.now() - startTime;
      console.log(`[KISTeamOrchestrator] Cycle completed in ${elapsed}ms`);

      return summary;
    } catch (error) {
      console.error(`[KISTeamOrchestrator] Error in trading cycle:`, error);
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
        console.error(`[KISTeamOrchestrator] Failed to fetch ${symbol}:`, error);
      }
    }

    return snapshots;
  }

  /**
   * Analyze market data using trading agent
   */
  private async analyzeMarketData(
    snapshots: MarketDataSnapshot[]
  ): Promise<KISAnalysisResult[]> {
    const analyses: KISAnalysisResult[] = [];

    for (const snapshot of snapshots) {
      if (snapshot.suspectReasons && snapshot.suspectReasons.length > 0) {
        console.log(
          `[KISTeamOrchestrator] Skipping ${snapshot.symbol}: suspect data (${snapshot.suspectReasons.join(", ")})`
        );
        continue;
      }

      try {
        const previousAnalysis = this.lastAnalysisBySymbol.get(snapshot.symbol);
        const context: KISMarketContext = this.tradingAgent.convertSnapshotToContext(
          snapshot,
          previousAnalysis?.currentPrice
        );

        const analysis = await this.tradingAgent.analyzeStock(context);
        analyses.push(analysis);
        this.lastAnalysisBySymbol.set(snapshot.symbol, analysis);
      } catch (error) {
        console.error(
          `[KISTeamOrchestrator] Failed to analyze ${snapshot.symbol}:`,
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
    analyses: KISAnalysisResult[],
    currentBalance: number
  ): Promise<KISOrder[]> {
    const orders: KISOrder[] = [];

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
          `[KISTeamOrchestrator] Failed to execute trade for ${analysis.symbol}:`,
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
    analyses: KISAnalysisResult[],
    orders: KISOrder[]
  ): KISCycleSummary {
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
      portfolioValue: summary.totalValue,
      portfolio: {
        krw: this.portfolioKRW,
        usd: this.portfolioUSD
      }
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
    console.log(`[KISTeamOrchestrator] Added ${symbol} to watchlist`);
  }

  /**
   * Remove symbol from watchlist
   */
  removeFromWatchlist(symbol: string): void {
    this.watchlist.delete(symbol);
    console.log(`[KISTeamOrchestrator] Removed ${symbol} from watchlist`);
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
  getOpenPositions(): KISPosition[] {
    return this.tradeExecutor.getOpenPositions();
  }

  /**
   * Get last analysis for a symbol
   */
  getLastAnalysis(symbol: string): KISAnalysisResult | undefined {
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
