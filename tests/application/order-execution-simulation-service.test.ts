import { describe, expect, it } from "vitest";
import {
  Asset,
  AssetType,
  Currency,
  defaultOutboxWorkerPolicy,
  EngineScoreSet,
  Market,
  Money,
  MoneyCheck,
  OrderApproval,
  OrderExecutionSimulationService,
  OrderIntent,
  OutboxWorkerService,
  Price,
  Quantity,
  RiskCheck,
  Signal,
  StrategyVersion
} from "../../src/index.js";

describe("OrderExecutionSimulationService", () => {
  it("builds a simulated execution command only from approved approvals", () => {
    const service = new OrderExecutionSimulationService();
    const result = service.buildCommand({
      commandId: "execution-command-1",
      approval: approvedOrderApproval(),
      idempotencyKey: "approval-1-submit",
      createdAt: now()
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.command.idempotencyKey).toBe("approval-1-submit");
    expect(result.ok && result.command.safetyType).toBe("SIMULATED_EXECUTION_COMMAND_ONLY");
    expect(result.ok && result.command).not.toHaveProperty("submitOrder");
  });

  it("refuses rejected approvals before simulated execution", () => {
    const result = new OrderExecutionSimulationService().buildCommand({
      commandId: "execution-command-1",
      approval: rejectedOrderApproval(),
      idempotencyKey: "approval-1-submit",
      createdAt: now()
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reasons).toContain("order_approval_not_approved");
  });

  it("records accepted, rejected, partial, and unknown simulated responses", () => {
    const service = new OrderExecutionSimulationService();
    const command = commandFixture();
    const accepted = service.simulate(command, { status: "ACCEPTED", simulatedBrokerOrderRef: "sim-order-1" }, now());
    const rejected = service.simulate(command, { status: "REJECTED", reason: "simulated_price_band" }, now());
    const partial = service.simulate(command, { status: "PARTIALLY_FILLED", fillQuantity: 0.4, fillPrice: 101.234 }, now());
    const unknown = service.simulate(command, { status: "UNKNOWN", reason: "simulated_timeout" }, now());

    expect(accepted.status).toBe("ACCEPTED");
    expect(rejected.rejectionReasons).toContain("simulated_price_band");
    expect(partial.fills[0]).toEqual({
      quantity: 0.4,
      price: 101.23,
      safetyType: "SIMULATED_EXECUTION_FILL_ONLY"
    });
    expect(unknown.blocksDependentActions).toBe(true);
    expect(unknown.safetyType).toBe("SIMULATED_EXECUTION_RECORD_ONLY");
  });

  it("creates an outbox event for fake execution handlers", async () => {
    const service = new OrderExecutionSimulationService();
    const command = commandFixture();
    const event = service.createOutboxEvent({
      eventId: "outbox-1",
      command,
      createdAt: now()
    });
    const result = await new OutboxWorkerService().run({
      events: [event],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process: service.fakeOutboxHandler({ status: "ACCEPTED", simulatedBrokerOrderRef: "sim-order-1" })
    });

    expect(event.eventType).toBe("SIMULATED_ORDER_EXECUTION");
    expect(event.idempotencyKey).toBe(command.idempotencyKey);
    expect(result.events[0]?.status).toBe("PROCESSED");
  });

  it("dead-letters unknown simulated broker state through outbox handling", async () => {
    const service = new OrderExecutionSimulationService();
    const result = await new OutboxWorkerService().run({
      events: [
        service.createOutboxEvent({
          eventId: "outbox-1",
          command: commandFixture(),
          createdAt: now()
        })
      ],
      workerId: "worker-1",
      now: now(),
      policy: defaultOutboxWorkerPolicy,
      process: service.fakeOutboxHandler({ status: "UNKNOWN", reason: "simulated timeout" })
    });

    expect(result.events[0]?.status).toBe("DEAD_LETTER");
    expect(result.deadLetterEventIds).toEqual(["outbox-1"]);
    expect(result.events[0]?.lastError).toContain("UNKNOWN_BROKER_STATE");
  });
});

function commandFixture() {
  const service = new OrderExecutionSimulationService();
  const result = service.buildCommand({
    commandId: "execution-command-1",
    approval: approvedOrderApproval(),
    idempotencyKey: "approval-1-submit",
    createdAt: now()
  });

  if (!result.ok) throw new Error("Expected command fixture to build.");
  return result.command;
}

function approvedOrderApproval(): OrderApproval {
  return new OrderApproval({
    id: "approval-1",
    orderIntent: approvedOrderIntent(),
    riskCheck: new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "PASS",
      riskLevel: "LOW",
      checkedAt: now()
    }),
    moneyCheck: new MoneyCheck({
      id: "money-check-1",
      orderIntentId: "intent-1",
      result: "PASS",
      approvedQuantity: Quantity.from("1"),
      approvedAmount: Money.fromMajor("100.00", Currency.from("USD")),
      cashAfterOrder: Money.fromMajor("900.00", Currency.from("USD")),
      checkedAt: now()
    }),
    status: "APPROVED",
    reasons: []
  });
}

function rejectedOrderApproval(): OrderApproval {
  return new OrderApproval({
    id: "approval-1",
    orderIntent: approvedOrderIntent(),
    riskCheck: new RiskCheck({
      id: "risk-check-1",
      subjectType: "ORDER_INTENT",
      subjectId: "intent-1",
      result: "PASS",
      riskLevel: "LOW",
      checkedAt: now()
    }),
    moneyCheck: new MoneyCheck({
      id: "money-check-1",
      orderIntentId: "intent-1",
      result: "PASS",
      approvedQuantity: Quantity.from("1"),
      approvedAmount: Money.fromMajor("100.00", Currency.from("USD")),
      cashAfterOrder: Money.fromMajor("900.00", Currency.from("USD")),
      checkedAt: now()
    }),
    status: "REJECTED",
    reasons: ["simulation_rejection"]
  });
}

function approvedOrderIntent(): OrderIntent {
  return new OrderIntent({
    id: "intent-1",
    signal: new Signal({
      id: "signal-1",
      strategyVersion: new StrategyVersion({
        id: "version-1",
        strategyId: "strategy-1",
        version: "1.0.0",
        definitionHash: "hash-1"
      }),
      asset: new Asset({
        id: "asset-aapl",
        symbol: "AAPL",
        name: "Apple",
        market: Market.from("US"),
        assetType: AssetType.from("STOCK"),
        tradingStatus: "TRADABLE"
      }),
      direction: "BUY",
      scoreSet: new EngineScoreSet([{ engine: "STRATEGY_COMPOSITE", score: 80, confidence: 0.8 }], "score-v1"),
      generatedAt: now()
    }),
    side: "BUY",
    quantity: Quantity.from("1"),
    limitPrice: Price.from("100.00", Currency.from("USD")),
    status: "MONEY_CHECKED"
  }).transitionTo("APPROVED");
}

function now(): Date {
  return new Date("2026-01-01T00:00:00Z");
}
