import { describe, expect, it } from "vitest";
import {
  AssetType,
  BrokerAccount,
  DomainValidationError,
  Market,
  PortfolioBrokerAccountLink
} from "../../src/index.js";

describe("broker account domain model", () => {
  it("defaults broker accounts to unverified and live-write blocked", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "1234567890",
      accountLabel: "Main account"
    });

    expect(account.permissionStatus).toBe("UNVERIFIED");
    expect(account.canWriteLive()).toBe(false);
  });

  it("requires both broker permission and local live flag for live writes", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "1234567890",
      accountLabel: "Main account",
      permissionStatus: "LIVE_TRADING_ALLOWED",
      liveTradingEnabled: false,
      readOnlyEnabled: true
    });

    expect(account.canRead()).toBe(true);
    expect(account.canWriteLive()).toBe(false);
  });

  it("masks broker account references", () => {
    const account = new BrokerAccount({
      id: "broker-account-1",
      broker: "TOSS_SECURITIES",
      externalAccountRef: "1234567890",
      accountLabel: "Main account"
    });

    expect(account.maskedExternalRef()).toBe("12****90");
  });

  it("requires active portfolio-account links for allowed market and asset type", () => {
    const link = new PortfolioBrokerAccountLink({
      id: "link-1",
      portfolioId: "portfolio-1",
      brokerAccountId: "broker-account-1",
      allowedMarkets: [Market.from("US")],
      allowedAssetTypes: [AssetType.from("ETF")],
      status: "ACTIVE"
    });

    expect(link.allows(Market.from("US"), AssetType.from("ETF"))).toBe(true);
    expect(link.allows(Market.from("KR"), AssetType.from("ETF"))).toBe(false);
    expect(link.allows(Market.from("US"), AssetType.from("STOCK"))).toBe(false);
  });

  it("rejects links without allowed markets or asset types", () => {
    expect(
      () =>
        new PortfolioBrokerAccountLink({
          id: "link-1",
          portfolioId: "portfolio-1",
          brokerAccountId: "broker-account-1",
          allowedMarkets: [],
          allowedAssetTypes: [AssetType.from("ETF")]
        })
    ).toThrow(DomainValidationError);
  });
});
