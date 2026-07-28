import { describe, expect, it } from "vitest";
import {
  CashBalance,
  Currency,
  DomainValidationError,
  KillSwitchState,
  Money,
  MoneyCheck,
  Percent,
  Quantity,
  RiskCheck,
  RiskLimit
} from "../../src/index.js";

describe("risk and money domain model", () => {
  it("requires failed risk checks to identify failed limits", () => {
    expect(
      () =>
        new RiskCheck({
          id: "risk-check-1",
          subjectType: "ORDER_INTENT",
          subjectId: "intent-1",
          result: "FAIL",
          riskLevel: "HIGH",
          checkedAt: new Date("2026-01-01T00:00:00Z")
        })
    ).toThrow(DomainValidationError);
  });

  it("treats pass and warning risk checks as approval-eligible only", () => {
    const pass = new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "PASS_WITH_WARNING",
      riskLevel: "MEDIUM",
      warnings: ["near_limit"],
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });
    const blocked = new RiskCheck({
      id: "risk-check-2",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "BLOCKED",
      riskLevel: "CRITICAL",
      failedLimitIds: ["kill-switch"],
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(pass.allowsApproval()).toBe(true);
    expect(blocked.allowsApproval()).toBe(false);
  });

  it("keeps risk limits version-ready and time bounded", () => {
    const limit = new RiskLimit({
      id: "limit-1",
      scope: "ORDER",
      limitType: "MAX_ORDER_AMOUNT",
      threshold: Money.fromMajor("1000.00", Currency.from("USD")),
      action: "REJECT",
      status: "ACTIVE",
      version: "risk-v1",
      effectiveFrom: new Date("2026-01-01T00:00:00Z")
    });

    expect(limit.isActiveAt(new Date("2026-01-02T00:00:00Z"))).toBe(true);
  });

  it("requires active kill switch reasons and blocks orders", () => {
    expect(
      () =>
        new KillSwitchState({
          id: "kill-switch-1",
          scope: "ACCOUNT",
          active: true
        })
    ).toThrow(DomainValidationError);

    expect(
      new KillSwitchState({
        id: "kill-switch-1",
        scope: "ACCOUNT",
        active: true,
        reason: "manual emergency stop"
      }).blocksOrders()
    ).toBe(true);
  });

  it("keeps available, reserved, and unsettled cash separate", () => {
    const usd = Currency.from("USD");
    const balance = new CashBalance({
      id: "cash-1",
      portfolioId: "portfolio-1",
      currency: usd,
      available: Money.fromMajor("1000.00", usd),
      reserved: Money.zero(usd),
      unsettled: Money.fromMajor("50.00", usd),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    });
    const reserved = balance.reserve(Money.fromMajor("100.00", usd), new Date("2026-01-01T01:00:00Z"));

    expect(reserved.available.toMajorString()).toBe("900.00");
    expect(reserved.reserved.toMajorString()).toBe("100.00");
    expect(reserved.unsettled.toMajorString()).toBe("50.00");
  });

  it("blocks cash reservation when available cash is insufficient", () => {
    const usd = Currency.from("USD");
    const balance = new CashBalance({
      id: "cash-1",
      portfolioId: "portfolio-1",
      currency: usd,
      available: Money.fromMajor("10.00", usd),
      reserved: Money.zero(usd),
      unsettled: Money.zero(usd),
      updatedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(() => balance.reserve(Money.fromMajor("10.01", usd), new Date("2026-01-01T01:00:00Z"))).toThrow(
      DomainValidationError
    );
  });

  it("requires passing money checks to include approved sizing and cash after order", () => {
    expect(
      () =>
        new MoneyCheck({
          id: "money-check-1",
          orderIntentId: "intent-1",
          result: "PASS",
          checkedAt: new Date("2026-01-01T00:00:00Z")
        })
    ).toThrow(DomainValidationError);

    const usd = Currency.from("USD");
    const check = new MoneyCheck({
      id: "money-check-1",
      orderIntentId: "intent-1",
      result: "PASS",
      approvedQuantity: Quantity.from("1"),
      approvedAmount: Money.fromMajor("100.00", usd),
      cashAfterOrder: Money.fromMajor("900.00", usd),
      checkedAt: new Date("2026-01-01T00:00:00Z")
    });

    expect(check.allowsApproval()).toBe(true);
  });

  it("supports percent thresholds for risk configuration", () => {
    const limit = new RiskLimit({
      id: "limit-1",
      scope: "PORTFOLIO",
      limitType: "MIN_CASH_RATIO",
      threshold: Percent.fromPercent("40.0000"),
      action: "BLOCK",
      status: "ACTIVE",
      version: "risk-v1",
      effectiveFrom: new Date("2026-01-01T00:00:00Z")
    });

    expect(limit.limitType).toBe("MIN_CASH_RATIO");
  });
});
