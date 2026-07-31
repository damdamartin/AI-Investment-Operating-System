/**
 * Claude-based Trading Analyst
 *
 * Single Claude instance that acts as multiple analysts:
 * - Fundamental, Technical, Sentiment analysis
 * - Asset selection
 * - Risk assessment
 *
 * Simpler alternative to multi-file agent architecture
 */

import Anthropic from "@anthropic-ai/sdk";

export interface AnalysisResult {
  symbol: string;
  recommendation: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-1
  reasoning: string;
  entryPrice?: number;
  stopLossPrice?: number; // -5%
  takeProfitPrice?: number; // +10%
}

export interface AssetRecommendation {
  symbol: string;
  name: string;
  market: "KR" | "US";
  reason: string;
  confidence: number;
}

export class ClaudeTradingAnalyst {
  private claude: Anthropic;

  constructor(apiKey: string) {
    this.claude = new Anthropic({ apiKey });
  }

  /**
   * Analyze a single stock
   */
  async analyzeStock(data: {
    symbol: string;
    currentPrice: number;
    recentNews?: string;
    priceChange?: number; // percentage
    volume?: number;
  }): Promise<AnalysisResult> {
    const prompt = `You are a professional stock analyst. Analyze ${data.symbol}:
Current Price: ${data.currentPrice}
Recent Change: ${data.priceChange?.toFixed(2) ?? "N/A"}%
Volume: ${data.volume ?? "N/A"}
${data.recentNews ? `Recent News: ${data.recentNews}` : ""}

Provide analysis as JSON:
{
  "recommendation": "BUY|SELL|HOLD",
  "confidence": <0-1>,
  "reasoning": "<your analysis>",
  "entryPrice": <price>,
  "stopLossPrice": <current * 0.95>,
  "takeProfitPrice": <current * 1.10>
}`;

    const response = await this.claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.type === "text" ? (response.content[0] as any).text : "";
    const json = this.parseJSON(text) as any;

    return {
      symbol: data.symbol,
      recommendation: (json.recommendation || "HOLD") as "BUY" | "SELL" | "HOLD",
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      reasoning: String(json.reasoning) || "Analysis inconclusive",
      entryPrice: Number(json.entryPrice) || data.currentPrice,
      stopLossPrice: Number(json.stopLossPrice) || data.currentPrice * 0.95,
      takeProfitPrice: Number(json.takeProfitPrice) || data.currentPrice * 1.1
    };
  }

  /**
   * Recommend new assets to add to watchlist
   */
  async recommendAssets(currentWatchlist: string[]): Promise<AssetRecommendation[]> {
    const prompt = `You are an asset selection analyst. Find 2-3 promising stocks NOT in this list: ${currentWatchlist.join(", ")}

Consider: trending sectors, recent earnings, news catalysts, technical breakouts
Focus on liquid, established companies (market cap > 1B)

Return JSON array:
[
  {
    "symbol": "ticker",
    "name": "Company Name",
    "market": "KR|US",
    "reason": "why it's attractive now",
    "confidence": 0.8
  }
]

Return empty array if no good opportunities.`;

    const response = await this.claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.type === "text" ? (response.content[0] as any).text : "";
    const array = this.parseJSONArray(text) as any[];

    return array.filter(
      (item: any) =>
        item &&
        item.symbol &&
        !currentWatchlist.includes(item.symbol)
    ) as AssetRecommendation[];
  }

  private parseJSON(text: string): Record<string, unknown> {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return {};
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }

  private parseJSONArray(text: string): unknown[] {
    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      return JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
}
