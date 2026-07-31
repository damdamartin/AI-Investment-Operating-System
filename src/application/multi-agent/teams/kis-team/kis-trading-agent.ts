import Anthropic from "@anthropic-ai/sdk";
import { MarketDataSnapshot } from "../../../../domain/market-data/index.js";

/**
 * KIS Trading Agent
 *
 * Analyzes market data from Korea Investment & Securities API
 * and generates trading signals (BUY/SELL/HOLD) using Claude AI.
 *
 * Responsibilities:
 * - Fetch market data snapshots from KIS Market Data Provider
 * - Analyze price trends, volume, and sentiment
 * - Generate confident trading recommendations
 * - Calculate entry, stop-loss, and take-profit prices
 */

export interface KISAnalysisResult {
  symbol: string;
  recommendation: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-1
  reasoning: string;
  currentPrice: number;
  entryPrice: number;
  stopLossPrice: number; // -5%
  takeProfitPrice: number; // +10%
  timestamp: Date;
}

export interface KISMarketContext {
  symbol: string;
  currentPrice: number;
  previousPrice?: number | undefined;
  priceChange?: number | undefined;
  volume?: number | undefined;
  marketTrend?: "UPTREND" | "DOWNTREND" | "SIDEWAYS" | undefined;
  recentNews?: string | undefined;
}

export class KISTradingAgent {
  private claude: Anthropic;
  private analysisHistory: Map<string, KISAnalysisResult[]> = new Map();

  constructor(apiKey: string) {
    this.claude = new Anthropic({ apiKey });
  }

  /**
   * Analyze a single stock using KIS market data
   */
  async analyzeStock(context: KISMarketContext): Promise<KISAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(context);

    const response = await this.claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.type === "text" ? (response.content[0] as any).text : "";
    const json = this.parseJSON(text) as any;

    const result: KISAnalysisResult = {
      symbol: context.symbol,
      recommendation: (json.recommendation || "HOLD") as "BUY" | "SELL" | "HOLD",
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      reasoning: String(json.reasoning) || "Analysis inconclusive",
      currentPrice: context.currentPrice,
      entryPrice: Number(json.entryPrice) || context.currentPrice,
      stopLossPrice: Number(json.stopLossPrice) || context.currentPrice * 0.95,
      takeProfitPrice: Number(json.takeProfitPrice) || context.currentPrice * 1.1,
      timestamp: new Date()
    };

    // Store in history for reference
    if (!this.analysisHistory.has(context.symbol)) {
      this.analysisHistory.set(context.symbol, []);
    }
    this.analysisHistory.get(context.symbol)!.push(result);

    return result;
  }

  /**
   * Analyze multiple stocks and generate portfolio-level recommendations
   */
  async analyzePortfolio(
    contexts: KISMarketContext[]
  ): Promise<KISAnalysisResult[]> {
    return Promise.all(
      contexts.map(context => this.analyzeStock(context))
    );
  }

  /**
   * Convert MarketDataSnapshot to analysis context
   */
  convertSnapshotToContext(
    snapshot: MarketDataSnapshot,
    previousPrice?: number
  ): KISMarketContext {
    // Extract current price from bigint units
    const currentPrice = Number(snapshot.price?.units ?? 0) / 1_000_000; // 6 decimal places
    const priceChange = previousPrice && currentPrice
      ? ((currentPrice - previousPrice) / previousPrice) * 100
      : undefined;

    return {
      symbol: snapshot.symbol,
      currentPrice,
      previousPrice: previousPrice ?? undefined,
      priceChange: priceChange ?? undefined,
      volume: Number(snapshot.volume?.units ?? 0),
      marketTrend: undefined,
      recentNews: undefined // Can be added from news adapter
    };
  }

  /**
   * Get analysis history for a symbol
   */
  getAnalysisHistory(symbol: string, limit: number = 10): KISAnalysisResult[] {
    const history = this.analysisHistory.get(symbol) ?? [];
    return history.slice(-limit);
  }

  /**
   * Build comprehensive analysis prompt for Claude
   */
  private buildAnalysisPrompt(context: KISMarketContext): string {
    const marketContext = context.marketTrend
      ? `\nMarket Trend: ${context.marketTrend}`
      : "";
    const newsContext = context.recentNews
      ? `\nRecent News: ${context.recentNews}`
      : "";
    const volumeContext = context.volume
      ? `\nVolume: ${context.volume.toLocaleString()}`
      : "";
    const priceChangeContext = context.priceChange
      ? `\nPrice Change: ${context.priceChange.toFixed(2)}%`
      : "";

    return `You are a professional stock analyst for Korea Investment & Securities (KIS).
Analyze the stock: ${context.symbol}

Current Price: ${context.currentPrice.toLocaleString()} KRW
${context.previousPrice ? `Previous Price: ${context.previousPrice.toLocaleString()} KRW` : ""}
${priceChangeContext}${volumeContext}${marketContext}${newsContext}

Based on KIS market data analysis, provide a trading recommendation.

Focus on:
1. Price momentum and trend strength
2. Volume patterns and support/resistance
3. Risk/reward ratio
4. Technical levels

Return your analysis ONLY as valid JSON (no markdown, no code blocks):
{
  "recommendation": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-1>,
  "reasoning": "<2-3 sentence analysis>",
  "entryPrice": <number>,
  "stopLossPrice": <number, typically current * 0.95>,
  "takeProfitPrice": <number, typically current * 1.10>
}`;
  }

  /**
   * Parse JSON from Claude response
   */
  private parseJSON(text: string): Record<string, unknown> {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return {};
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Failed to parse JSON from Claude response:", error);
      return {};
    }
  }
}
