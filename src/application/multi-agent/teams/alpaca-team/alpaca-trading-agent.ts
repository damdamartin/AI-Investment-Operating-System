import Anthropic from "@anthropic-ai/sdk";
import type { MarketDataSnapshot } from "../../../../domain/market-data/index.js";

export interface AlpacaMarketContext {
  symbol: string;
  currentPrice: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

export interface AlpacaAnalysisResult {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-100
  reasoning: string;
  targetPrice?: number | undefined;
  stopLoss?: number | undefined;
  takeProfit?: number | undefined;
  timestamp: Date;
}

/**
 * Alpaca Trading Agent
 * Uses Claude AI to analyze US stock market data and generate trading signals
 */
export class AlpacaTradingAgent {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze market data and generate trading signal
   */
  async analyzeMarket(snapshots: MarketDataSnapshot[]): Promise<AlpacaAnalysisResult[]> {
    if (snapshots.length === 0) {
      return [];
    }

    const results: AlpacaAnalysisResult[] = [];

    // Group snapshots by symbol
    const bySymbol = new Map<string, MarketDataSnapshot[]>();
    for (const snapshot of snapshots) {
      if (!bySymbol.has(snapshot.symbol)) {
        bySymbol.set(snapshot.symbol, []);
      }
      bySymbol.get(snapshot.symbol)!.push(snapshot);
    }

    // Analyze each symbol
    for (const [symbol, snaps] of bySymbol) {
      try {
        const analysis = await this.analyzeSymbol(symbol, snaps);
        results.push(analysis);
      } catch (error) {
        console.error(`[AlpacaTradingAgent] Error analyzing ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * Analyze a single symbol
   */
  private async analyzeSymbol(
    symbol: string,
    snapshots: MarketDataSnapshot[]
  ): Promise<AlpacaAnalysisResult> {
    const latest = snapshots[snapshots.length - 1]!;

    if (!latest.price) {
      return {
        symbol,
        signal: "HOLD",
        confidence: 0,
        reasoning: "No price data available",
        timestamp: new Date()
      };
    }

    // Extract numeric values from Price/Quantity objects
    const priceNum = Number(latest.price.units) / 1e6; // Price scale is 6
    const volumeNum = latest.volume ? Number(latest.volume.units) / 1e8 : 0; // Quantity scale is 8

    const ctx: AlpacaMarketContext = {
      symbol,
      currentPrice: priceNum,
      bid: priceNum * 0.999, // Approximate bid
      ask: priceNum * 1.001, // Approximate ask
      high: priceNum * 1.02, // Approximate high
      low: priceNum * 0.98, // Approximate low
      volume: volumeNum,
      timestamp: latest.lastTradeAt?.toISOString() ?? new Date().toISOString()
    };

    // Calculate technical indicators
    const indicators = this.calculateIndicators(snapshots);

    // Prepare analysis prompt
    const prompt = `
You are a professional stock analyst. Analyze this US stock and generate a trading signal.

Stock: ${ctx.symbol}
Current Price: $${ctx.currentPrice.toFixed(2)}
Bid: $${ctx.bid.toFixed(2)} | Ask: $${ctx.ask.toFixed(2)}
High (24h): $${ctx.high.toFixed(2)} | Low (24h): $${ctx.low.toFixed(2)}
Volume: ${ctx.volume.toLocaleString()} shares
Time: ${ctx.timestamp}

Technical Indicators:
- MA5: $${indicators.ma5.toFixed(2)}
- MA20: $${indicators.ma20.toFixed(2)}
- Price Change (5 bars): ${indicators.priceChange.toFixed(2)}%
- Volume Trend: ${indicators.volumeTrend > 0 ? "Increasing" : "Decreasing"}
- RSI (14): ${indicators.rsi.toFixed(1)}
- MACD: ${indicators.macd > 0 ? "Bullish" : "Bearish"}

Based on this data, provide:
1. Trading Signal: BUY, SELL, or HOLD
2. Confidence (0-100): Your confidence in this signal
3. Reasoning: Brief explanation of your analysis
4. Target Price: Where you expect it to go (if BUY/SELL)
5. Stop Loss: Recommended stop loss price
6. Take Profit: Recommended take profit price

Format your response as JSON:
{
  "signal": "BUY|SELL|HOLD",
  "confidence": <number>,
  "reasoning": "<string>",
  "targetPrice": <number or null>,
  "stopLoss": <number or null>,
  "takeProfit": <number or null>
}
`;

    try {
      const message = await this.client.messages.create({
        model: "claude-opus-4-1-20250805",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const responseText =
        message.content[0]?.type === "text" ? message.content[0].text : "";

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        signal: string;
        confidence: number;
        reasoning: string;
        targetPrice?: number;
        stopLoss?: number;
        takeProfit?: number;
      };

      return {
        symbol,
        signal: (parsed.signal as "BUY" | "SELL" | "HOLD") || "HOLD",
        confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
        reasoning: parsed.reasoning || "AI analysis",
        targetPrice: parsed.targetPrice,
        stopLoss: parsed.stopLoss,
        takeProfit: parsed.takeProfit,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`[AlpacaTradingAgent] API error for ${symbol}:`, error);
      // Return HOLD on error
      return {
        symbol,
        signal: "HOLD",
        confidence: 0,
        reasoning: "Error in analysis",
        timestamp: new Date()
      };
    }
  }

  /**
   * Calculate technical indicators
   */
  private calculateIndicators(
    snapshots: MarketDataSnapshot[]
  ): {
    ma5: number;
    ma20: number;
    priceChange: number;
    volumeTrend: number;
    rsi: number;
    macd: number;
  } {
    // Extract numeric prices (Price scale is 6)
    const prices = snapshots
      .map((s) => (s.price ? Number(s.price.units) / 1e6 : null))
      .filter((p): p is number => p !== null);

    // Extract numeric volumes (Quantity scale is 8)
    const volumes = snapshots
      .map((s) => (s.volume ? Number(s.volume.units) / 1e8 : null))
      .filter((v): v is number => v !== null);

    const ma5 = this.simpleMovingAverage(prices, 5);
    const ma20 = this.simpleMovingAverage(prices, 20);
    const priceChange =
      prices.length >= 2
        ? ((prices[prices.length - 1]! - prices[0]!) / prices[0]!) * 100
        : 0;
    const volumeTrend =
      volumes.length >= 2
        ? volumes[volumes.length - 1]! - volumes[0]!
        : 0;
    const rsi = this.calculateRSI(prices, 14);
    const macd = this.calculateMACD(prices);

    return {
      ma5,
      ma20,
      priceChange,
      volumeTrend,
      rsi,
      macd
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private simpleMovingAverage(data: number[], period: number): number {
    if (data.length < period) {
      const last = data[data.length - 1];
      return last !== undefined ? last : 0;
    }
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) {
      return 50; // Neutral
    }

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const current = prices[i];
      const prev = prices[i - 1];
      if (current !== undefined && prev !== undefined) {
        const change = current - prev;
        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      return 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(prices: number[]): number {
    const ema12 = this.exponentialMovingAverage(prices, 12);
    const ema26 = this.exponentialMovingAverage(prices, 26);
    return ema12 - ema26; // Positive = bullish, Negative = bearish
  }

  /**
   * Calculate Exponential Moving Average
   */
  private exponentialMovingAverage(data: number[], period: number): number {
    const last = data[data.length - 1];
    if (data.length < period) {
      return last !== undefined ? last : 0;
    }

    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      const val = data[i];
      if (val !== undefined) {
        ema = (val - ema) * multiplier + ema;
      }
    }

    return ema;
  }
}
