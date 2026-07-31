/**
 * KIS Team Integration Test
 *
 * Tests:
 * 1. KIS Market Data Provider - fetches real price data
 * 2. KIS Trading Agent - analyzes data and generates signals
 * 3. KIS Team Orchestrator - runs complete trading cycle
 */

import { KISMarketDataProvider } from "../../../../adapters/kis/kis-market-data-provider.js";
import { KISTradingAgent } from "./kis-trading-agent.js";
import { KISTeamOrchestrator } from "./kis-team-orchestrator.js";
import type { WatchlistAsset } from "../../../pipeline/market-data-provider.js";

async function testKISMarketDataProvider() {
  console.log("\n=== Testing KIS Market Data Provider ===\n");

  const provider = new KISMarketDataProvider({
    appKey: process.env.KIS_APP_KEY || "",
    appSecret: process.env.KIS_APP_SECRET || "",
    accountNumber: process.env.KIS_ACCOUNT_NUMBER || ""
  });

  // Test domestic stock (Samsung Electronics: 005930)
  const samsungAsset: WatchlistAsset = {
    assetId: "005930",
    symbol: "005930",
    market: { code: "KR" },
    assetType: { code: "STOCK" }
  };

  try {
    console.log("📍 Fetching domestic stock data (Samsung: 005930)...");
    const snapshots = await provider.fetchRecentSnapshots(samsungAsset, new Date());

    if (snapshots.length === 0) {
      console.log("❌ No snapshots returned");
      return;
    }

    const snapshot = snapshots[0]!;
    console.log("✅ Data fetched successfully!");
    console.log(`   Symbol: ${snapshot.symbol}`);
    console.log(`   Price: ${snapshot.price?.units ?? "N/A"} (units)`);
    console.log(`   Volume: ${snapshot.volume?.units ?? "N/A"}`);
    console.log(`   Market: ${snapshot.market.code}`);
    console.log(`   Suspect: ${snapshot.suspectReasons?.join(", ") || "None"}`);
  } catch (error) {
    console.error("❌ Error fetching domestic stock:", error);
    return;
  }

  // Test US stock (Apple: AAPL)
  const appleAsset: WatchlistAsset = {
    assetId: "AAPL",
    symbol: "AAPL",
    market: { code: "US" },
    assetType: { code: "STOCK" }
  };

  try {
    console.log("\n📍 Fetching US stock data (Apple: AAPL)...");
    const snapshots = await provider.fetchRecentSnapshots(appleAsset, new Date());

    if (snapshots.length === 0) {
      console.log("❌ No snapshots returned");
      return;
    }

    const snapshot = snapshots[0]!;
    console.log("✅ Data fetched successfully!");
    console.log(`   Symbol: ${snapshot.symbol}`);
    console.log(`   Price: ${snapshot.price?.units ?? "N/A"} (units)`);
    console.log(`   Volume: ${snapshot.volume?.units ?? "N/A"}`);
    console.log(`   Market: ${snapshot.market.code}`);
    console.log(`   Suspect: ${snapshot.suspectReasons?.join(", ") || "None"}`);
  } catch (error) {
    console.error("❌ Error fetching US stock:", error);
  }
}

async function testKISTradingAgent() {
  console.log("\n=== Testing KIS Trading Agent ===\n");

  const agent = new KISTradingAgent(process.env.CLAUDE_API_KEY || "");

  try {
    console.log("📍 Analyzing Samsung stock (005930)...");
    const analysis = await agent.analyzeStock({
      symbol: "005930",
      currentPrice: 70000, // Example price in KRW
      priceChange: 2.5,
      volume: 1_000_000,
      recentNews: "Strong earnings, tech sector rally"
    });

    console.log("✅ Analysis completed!");
    console.log(`   Recommendation: ${analysis.recommendation}`);
    console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
    console.log(`   Reasoning: ${analysis.reasoning.substring(0, 100)}...`);
    console.log(`   Entry Price: ${analysis.entryPrice}`);
    console.log(`   Stop Loss: ${analysis.stopLossPrice}`);
    console.log(`   Take Profit: ${analysis.takeProfitPrice}`);
  } catch (error) {
    console.error("❌ Error analyzing stock:", error);
  }
}

async function testKISTeamOrchestrator() {
  console.log("\n=== Testing KIS Team Orchestrator ===\n");

  try {
    const orchestrator = new KISTeamOrchestrator({
      appKey: process.env.KIS_APP_KEY || "",
      appSecret: process.env.KIS_APP_SECRET || "",
      accountNumber: process.env.KIS_ACCOUNT_NUMBER || "",
      apiKey: process.env.CLAUDE_API_KEY || "",
      watchlist: ["005930", "000660"], // Samsung, SK Hynix
      maxPositionSizePercent: 5,
      maxOpenPositions: 10,
      minConfidenceThreshold: 0.6
    });

    console.log("📍 Running KIS Team trading cycle...");
    console.log(`   Watchlist: ${orchestrator.getWatchlist().join(", ")}`);
    console.log(`   Healthy: ${orchestrator.isHealthy()}`);

    const summary = await orchestrator.runTradingCycle(10_000_000); // ₩10M balance

    console.log("\n✅ Trading cycle completed!");
    console.log(`   Timestamp: ${summary.timestamp.toISOString()}`);
    console.log(`   Analyses: ${summary.analysisCount}`);
    console.log(`   Buy Signals: ${summary.buySignals}`);
    console.log(`   Orders Executed: ${summary.ordersExecuted}`);
    console.log(`   Open Positions: ${summary.openPositions}`);
    console.log(`   Total PnL: ${summary.totalPnL}`);
    console.log(`   Portfolio Value: ${summary.portfolioValue}`);

    const positions = orchestrator.getOpenPositions();
    if (positions.length > 0) {
      console.log("\n📊 Open Positions:");
      for (const pos of positions) {
        console.log(`   ${pos.symbol}: ${pos.quantity} @ ${pos.entryPrice} (PnL: ${pos.pnl})`);
      }
    }
  } catch (error) {
    console.error("❌ Error running orchestrator:", error);
  }
}

async function main() {
  console.log("🧪 Starting KIS Team Integration Tests\n");
  console.log("Environment Check:");
  console.log(`  KIS_APP_KEY: ${process.env.KIS_APP_KEY ? "✅" : "❌"}`);
  console.log(`  KIS_APP_SECRET: ${process.env.KIS_APP_SECRET ? "✅" : "❌"}`);
  console.log(`  CLAUDE_API_KEY: ${process.env.CLAUDE_API_KEY ? "✅" : "❌"}`);

  await testKISMarketDataProvider();
  await testKISTradingAgent();
  await testKISTeamOrchestrator();

  console.log("\n✨ All tests completed!\n");
}

main().catch(console.error);
