import { describe, expect, it } from "vitest";
import {
  createInternalPositionLedgerState,
  FillApplication,
  FillProcessingService,
  InternalPositionLedgerPosition
} from "../../src/index.js";

describe("FillProcessingService", () => {
  it("applies a buy fill and releases reserved cash safely", () => {
    const service = new FillProcessingService();
    const state = createInternalPositionLedgerState("portfolio-1", {
      USD: { currency: "USD", available: 900, reserved: 100, unsettled: 0 }
    });

    const result = service.applyFill(state, buyFill({ fillId: "fill-1", quantity: 0.5, price: 100 }));

    expect(result.applied).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.state.positions["asset-aapl"]).toMatchObject({
      quantity: 0.5,
      averagePrice: 100
    });
    expect(result.state.cash.USD).toEqual({ currency: "USD", available: 950, reserved: 0, unsettled: 0 });
    expect(result.cashAdjustments[0]).toEqual({
      currency: "USD",
      availableDelta: 50,
      reservedDelta: -100,
      unsettledDelta: 0
    });
  });

  it("updates partial buy fills with weighted average price", () => {
    const service = new FillProcessingService();
    const first = service.applyFill(
      createInternalPositionLedgerState("portfolio-1", {
        USD: { currency: "USD", available: 1_000, reserved: 0, unsettled: 0 }
      }),
      buyFill({ fillId: "fill-1", quantity: 1, price: 100, reservedCashRelease: 0 })
    );
    const second = service.applyFill(
      first.state,
      buyFill({ fillId: "fill-2", quantity: 2, price: 130, reservedCashRelease: 0 })
    );

    expect(second.state.positions["asset-aapl"]).toMatchObject({
      quantity: 3,
      averagePrice: 120
    });
    expect(second.state.cash.USD?.available).toBe(640);
  });

  it("applies a sell fill, reduces position, and records realized pnl", () => {
    const service = new FillProcessingService();
    const state = stateWithPosition({
      quantity: 3,
      averagePrice: 100,
      realizedPnl: 0
    });

    const result = service.applyFill(state, {
      ...sellFill({ fillId: "sell-fill-1", quantity: 1, price: 125 }),
      fee: 1
    });

    expect(result.applied).toBe(true);
    expect(result.state.positions["asset-aapl"]).toMatchObject({
      quantity: 2,
      averagePrice: 100,
      realizedPnl: 24
    });
    expect(result.state.cash.USD?.available).toBe(624);
    expect(result.cashAdjustments[0]?.availableDelta).toBe(124);
  });

  it("does not apply the same fill id twice", () => {
    const service = new FillProcessingService();
    const state = createInternalPositionLedgerState("portfolio-1", {
      USD: { currency: "USD", available: 1_000, reserved: 0, unsettled: 0 }
    });
    const fill = buyFill({ fillId: "fill-1", quantity: 1, price: 100, reservedCashRelease: 0 });
    const first = service.applyFill(state, fill);
    const second = service.applyFill(first.state, fill);

    expect(second.idempotentSkip).toBe(true);
    expect(second.applied).toBe(false);
    expect(second.state.positions["asset-aapl"]?.quantity).toBe(1);
    expect(second.state.cash.USD?.available).toBe(900);
  });

  it("blocks sell fills that exceed the internal position quantity", () => {
    const result = new FillProcessingService().applyFill(
      stateWithPosition({ quantity: 1, averagePrice: 100, realizedPnl: 0 }),
      sellFill({ fillId: "sell-fill-1", quantity: 2, price: 110 })
    );

    expect(result.blocked).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.reasonCodes).toContain("sell_fill_exceeds_position_quantity");
    expect(result.state.positions["asset-aapl"]?.quantity).toBe(1);
  });
});

function buyFill(overrides: Partial<FillApplication> = {}): FillApplication {
  return {
    fillId: "fill-1",
    orderIntentId: "intent-1",
    assetId: "asset-aapl",
    symbol: "AAPL",
    side: "BUY",
    quantity: 1,
    price: 100,
    currency: "USD",
    reservedCashRelease: 100,
    fee: 0,
    filledAt: now(),
    source: "SIMULATED_EXECUTION",
    ...overrides
  };
}

function sellFill(overrides: Partial<FillApplication> = {}): FillApplication {
  return {
    ...buyFill(overrides),
    side: "SELL"
  };
}

function stateWithPosition(position: Pick<InternalPositionLedgerPosition, "quantity" | "averagePrice" | "realizedPnl">) {
  return createInternalPositionLedgerState(
    "portfolio-1",
    {
      USD: { currency: "USD", available: 500, reserved: 0, unsettled: 0 }
    },
    {
      "asset-aapl": {
        assetId: "asset-aapl",
        symbol: "AAPL",
        currency: "USD",
        unrealizedPnlPlaceholder: 0,
        ...position
      }
    }
  );
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
