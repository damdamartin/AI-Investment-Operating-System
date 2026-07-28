import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  BrokerAssetMapping,
  Currency,
  DomainValidationError,
  Market,
  MarketSession,
  TimeRange
} from "../../src/index.js";

describe("asset domain model", () => {
  it("defaults assets to unverified and not tradable", () => {
    const asset = new Asset({
      id: "asset-1",
      symbol: "AAPL",
      name: "Apple",
      market: Market.from("US"),
      assetType: AssetType.from("STOCK")
    });

    expect(asset.tradingStatus).toBe("UNVERIFIED");
    expect(asset.isTradable()).toBe(false);
  });

  it("allows explicit tradable stocks and ETFs without assuming all ETFs are tradable", () => {
    const stock = new Asset({
      id: "asset-1",
      symbol: "005930",
      name: "Samsung Electronics",
      market: Market.from("KR"),
      assetType: AssetType.from("STOCK"),
      tradingStatus: "TRADABLE"
    });

    const etf = new Asset({
      id: "asset-2",
      symbol: "SPY",
      name: "SPDR S&P 500 ETF",
      market: Market.from("US"),
      assetType: AssetType.from("ETF")
    });

    expect(stock.isTradable()).toBe(true);
    expect(etf.isTradable()).toBe(false);
  });

  it("keeps broker asset mapping separate from internal asset identity", () => {
    const mapping = new BrokerAssetMapping({
      id: "mapping-1",
      assetId: "asset-1",
      broker: "TOSS_SECURITIES",
      brokerSymbol: "AAPL",
      market: Market.from("US"),
      assetType: AssetType.from("STOCK"),
      orderable: true
    });

    expect(mapping.assetId).toBe("asset-1");
    expect(mapping.canBeUsedForOrders()).toBe(false);
  });

  it("requires verified broker mapping before order use", () => {
    const mapping = new BrokerAssetMapping({
      id: "mapping-1",
      assetId: "asset-1",
      broker: "TOSS_SECURITIES",
      brokerSymbol: "AAPL",
      market: Market.from("US"),
      assetType: AssetType.from("STOCK"),
      orderable: true,
      verifiedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(mapping.canBeUsedForOrders()).toBe(true);
  });

  it("represents unknown market sessions as not allowing regular orders", () => {
    const session = new MarketSession({ market: Market.from("US") });

    expect(session.allowsRegularOrders()).toBe(false);
    expect(() => session.assertKnown()).toThrow(DomainValidationError);
  });

  it("supports explicit session windows", () => {
    const session = new MarketSession({
      market: Market.from("US"),
      status: "OPEN",
      range: TimeRange.from(new Date("2026-01-01T14:30:00Z"), new Date("2026-01-01T21:00:00Z"))
    });

    expect(session.allowsRegularOrders()).toBe(true);
    expect(session.range?.contains(new Date("2026-01-01T15:00:00Z"))).toBe(true);
  });

  it("does not use currency as asset identity", () => {
    expect(Currency.from("USD").code).toBe("USD");
  });
});
