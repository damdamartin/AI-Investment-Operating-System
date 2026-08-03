import { describe, it, expect, beforeEach, vi } from "vitest";
import { MarketCache } from "../../src/crypto-engine/market-data/market-cache.js";
import { CryptoSignalGenerator } from "../../src/crypto-engine/strategy/signal-generator.js";
import { RiskValidator } from "../../src/crypto-engine/order/risk-validator.js";
import type { UpbitTicker } from "../../src/crypto-engine/config/upbit-client.js";

describe("Crypto Engine - Market Cache", () => {
  let cache: MarketCache;

  beforeEach(() => {
    cache = new MarketCache();
  });

  it("should update and retrieve ticker", () => {
    const ticker: UpbitTicker = {
      market: "KRW-BTC",
      trade_date: "2026-08-01",
      trade_time: "18:30:00",
      trade_timestamp: 1722534600000,
      opening_price: 50000000,
      high_price: 51000000,
      low_price: 49000000,
      trade_price: 50500000,
      prev_closing_price: 50000000,
      change: "RISE",
      change_price: 500000,
      change_rate: 0.01,
      signed_change_price: 500000,
      signed_change_rate: 0.01,
      trade_volume: 0.5,
      acc_trade_price: 25000000,
      acc_trade_price_24h: 25000000000,
      acc_trade_volume: 500,
      acc_trade_volume_24h: 50000,
      highest_52_week_price: 60000000,
      highest_52_week_date: "2026-01-01",
      lowest_52_week_price: 40000000,
      lowest_52_week_date: "2026-06-01",
      trade_status: "ACTIVE",
      market_order_enabled: true,
      ask_bid: "ASK",
      timestamp: Date.now(),
      stream_type: "REALTIME"
    };

    cache.updateTicker(ticker);
    const retrieved = cache.getTicker("KRW-BTC");

    expect(retrieved).toBeDefined();
    expect(retrieved?.market).toBe("KRW-BTC");
    expect(retrieved?.trade_price).toBe(50500000);
  });

  it("should check recent updates", () => {
    const ticker: UpbitTicker = {
      market: "KRW-ETH",
      trade_date: "2026-08-01",
      trade_time: "18:30:00",
      trade_timestamp: 1722534600000,
      opening_price: 3000000,
      high_price: 3100000,
      low_price: 2900000,
      trade_price: 3050000,
      prev_closing_price: 3000000,
      change: "RISE",
      change_price: 50000,
      change_rate: 0.0166,
      signed_change_price: 50000,
      signed_change_rate: 0.0166,
      trade_volume: 5,
      acc_trade_price: 15000000,
      acc_trade_price_24h: 15000000000,
      acc_trade_volume: 5000,
      acc_trade_volume_24h: 500000,
      highest_52_week_price: 4000000,
      highest_52_week_date: "2026-01-01",
      lowest_52_week_price: 2000000,
      lowest_52_week_date: "2026-06-01",
      trade_status: "ACTIVE",
      market_order_enabled: true,
      ask_bid: "ASK",
      timestamp: Date.now(),
      stream_type: "REALTIME"
    };

    cache.updateTicker(ticker);
    const hasRecent = cache.hasRecentUpdate("KRW-ETH", 5000);

    expect(hasRecent).toBe(true);
  });
});

describe("Crypto Engine - Signal Generator", () => {
  let generator: CryptoSignalGenerator;
  let cache: MarketCache;

  beforeEach(() => {
    cache = new MarketCache();
    generator = new CryptoSignalGenerator(cache);
  });

  it("should generate BUY signal on positive momentum", () => {
    const ticker: UpbitTicker = {
      market: "KRW-BTC",
      trade_date: "2026-08-01",
      trade_time: "18:30:00",
      trade_timestamp: 1722534600000,
      opening_price: 50000000,
      high_price: 51000000,
      low_price: 49000000,
      trade_price: 50500000,
      prev_closing_price: 50000000,
      change: "RISE",
      change_price: 500000,
      change_rate: 0.03, // 3% 상승
      signed_change_price: 500000,
      signed_change_rate: 0.03,
      trade_volume: 0.5,
      acc_trade_price: 25000000,
      acc_trade_price_24h: 25000000000,
      acc_trade_volume: 500,
      acc_trade_volume_24h: 50000,
      highest_52_week_price: 60000000,
      highest_52_week_date: "2026-01-01",
      lowest_52_week_price: 40000000,
      lowest_52_week_date: "2026-06-01",
      trade_status: "ACTIVE",
      market_order_enabled: true,
      ask_bid: "ASK",
      timestamp: Date.now(),
      stream_type: "REALTIME"
    };

    const signal = generator.generateSignal("KRW-BTC", { ticker });

    expect(signal).toBeDefined();
    expect(signal?.direction).toBe("BUY");
    expect(signal?.confidence).toBeGreaterThan(0.5);
    expect(signal?.price).toBe(50500000);
  });

  it("should generate SELL signal on negative momentum", () => {
    const ticker: UpbitTicker = {
      market: "KRW-BTC",
      trade_date: "2026-08-01",
      trade_time: "18:30:00",
      trade_timestamp: 1722534600000,
      opening_price: 50000000,
      high_price: 51000000,
      low_price: 49000000,
      trade_price: 49500000,
      prev_closing_price: 50000000,
      change: "FALL",
      change_price: -500000,
      change_rate: -0.03, // 3% 하락
      signed_change_price: -500000,
      signed_change_rate: -0.03,
      trade_volume: 0.5,
      acc_trade_price: 25000000,
      acc_trade_price_24h: 25000000000,
      acc_trade_volume: 500,
      acc_trade_volume_24h: 50000,
      highest_52_week_price: 60000000,
      highest_52_week_date: "2026-01-01",
      lowest_52_week_price: 40000000,
      lowest_52_week_date: "2026-06-01",
      trade_status: "ACTIVE",
      market_order_enabled: true,
      ask_bid: "BID",
      timestamp: Date.now(),
      stream_type: "REALTIME"
    };

    const signal = generator.generateSignal("KRW-BTC", { ticker });

    expect(signal).toBeDefined();
    expect(signal?.direction).toBe("SELL");
    expect(signal?.confidence).toBeGreaterThan(0.5);
  });

  it("should not generate signal on low momentum", () => {
    const ticker: UpbitTicker = {
      market: "KRW-BTC",
      trade_date: "2026-08-01",
      trade_time: "18:30:00",
      trade_timestamp: 1722534600000,
      opening_price: 50000000,
      high_price: 50100000,
      low_price: 49900000,
      trade_price: 50000000,
      prev_closing_price: 50000000,
      change: "EVEN",
      change_price: 0,
      change_rate: 0,
      signed_change_price: 0,
      signed_change_rate: 0,
      trade_volume: 0.1,
      acc_trade_price: 5000000,
      acc_trade_price_24h: 5000000000,
      acc_trade_volume: 100,
      acc_trade_volume_24h: 10000,
      highest_52_week_price: 60000000,
      highest_52_week_date: "2026-01-01",
      lowest_52_week_price: 40000000,
      lowest_52_week_date: "2026-06-01",
      trade_status: "ACTIVE",
      market_order_enabled: true,
      ask_bid: "ASK",
      timestamp: Date.now(),
      stream_type: "REALTIME"
    };

    const signal = generator.generateSignal("KRW-BTC", { ticker });

    expect(signal).toBeNull();
  });

  it("should generate idempotency key", () => {
    const ticker: UpbitTicker = {
      market: "KRW-BTC",
      trade_date: "2026-08-01",
      trade_time: "18:30:00",
      trade_timestamp: 1722534600000,
      opening_price: 50000000,
      high_price: 51000000,
      low_price: 49000000,
      trade_price: 50500000,
      prev_closing_price: 50000000,
      change: "RISE",
      change_price: 500000,
      change_rate: 0.03,
      signed_change_price: 500000,
      signed_change_rate: 0.03,
      trade_volume: 0.5,
      acc_trade_price: 25000000,
      acc_trade_price_24h: 25000000000,
      acc_trade_volume: 500,
      acc_trade_volume_24h: 50000,
      highest_52_week_price: 60000000,
      highest_52_week_date: "2026-01-01",
      lowest_52_week_price: 40000000,
      lowest_52_week_date: "2026-06-01",
      trade_status: "ACTIVE",
      market_order_enabled: true,
      ask_bid: "ASK",
      timestamp: Date.now(),
      stream_type: "REALTIME"
    };

    const signal1 = generator.generateSignal("KRW-BTC", { ticker });
    const signal2 = generator.generateSignal("KRW-BTC", { ticker });

    expect(signal1?.idempotencyKey).toBe(signal2?.idempotencyKey);
  });
});

describe("Crypto Engine - Risk Validator", () => {
  let validator: RiskValidator;

  beforeEach(() => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total_loss: 0 })
        })
      })
    };
    validator = new RiskValidator(mockDb as any);
  });

  it("should pass money check with sufficient balance", async () => {
    const result = await validator.validateMoney(0.5, 50000000, [
      { currency: "KRW", balance: 100000000 }
    ]);

    expect(result.passed).toBe(true);
    expect(result.availableBalance).toBe(100000000);
  });

  it("should fail money check with insufficient balance", async () => {
    const result = await validator.validateMoney(0.5, 50000000, [
      { currency: "KRW", balance: 10000000 }
    ]);

    expect(result.passed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("should activate and deactivate kill switch", () => {
    expect(validator.isKillSwitchActive()).toBe(false);

    validator.activateKillSwitch("Test activation");
    expect(validator.isKillSwitchActive()).toBe(true);

    validator.deactivateKillSwitch();
    expect(validator.isKillSwitchActive()).toBe(false);
  });
});
