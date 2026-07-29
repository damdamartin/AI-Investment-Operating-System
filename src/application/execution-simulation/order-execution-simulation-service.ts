import type { OrderApproval, OrderSide } from "../../domain/orders/index.js";
import type { OutboxEventRecord, OutboxProcessingResult } from "../outbox/index.js";

export type SimulatedExecutionStatus = "ACCEPTED" | "REJECTED" | "PARTIALLY_FILLED" | "FILLED" | "UNKNOWN";

export interface SimulatedExecutionCommand {
  id: string;
  approvalId: string;
  orderIntentId: string;
  strategyVersionId: string;
  assetId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  limitPrice: number;
  currency: string;
  idempotencyKey: string;
  createdAt: Date;
  safetyType: "SIMULATED_EXECUTION_COMMAND_ONLY";
  liveBrokerWriteAllowed: false;
}

export interface SimulatedBrokerResponse {
  status: SimulatedExecutionStatus;
  simulatedBrokerOrderRef?: string | undefined;
  fillQuantity?: number | undefined;
  fillPrice?: number | undefined;
  reason?: string | undefined;
}

export interface SimulatedExecutionFill {
  quantity: number;
  price: number;
  safetyType: "SIMULATED_EXECUTION_FILL_ONLY";
}

export interface SimulatedExecutionRecord {
  commandId: string;
  approvalId: string;
  orderIntentId: string;
  status: SimulatedExecutionStatus;
  fills: SimulatedExecutionFill[];
  rejectionReasons: string[];
  blocksDependentActions: boolean;
  simulatedBrokerOrderRef: string | undefined;
  executedAt: Date;
  safetyType: "SIMULATED_EXECUTION_RECORD_ONLY";
  liveBrokerWriteAllowed: false;
}

export interface BuildExecutionCommandInput {
  commandId: string;
  approval: OrderApproval;
  idempotencyKey: string;
  createdAt: Date;
}

export type BuildExecutionCommandResult =
  | {
      ok: true;
      command: SimulatedExecutionCommand;
    }
  | {
      ok: false;
      reasons: string[];
      safetyType: "SIMULATED_EXECUTION_REFUSAL_ONLY";
    };

export class OrderExecutionSimulationService {
  buildCommand(input: BuildExecutionCommandInput): BuildExecutionCommandResult {
    if (!input.approval.isApproved()) {
      return {
        ok: false,
        reasons: ["order_approval_not_approved"],
        safetyType: "SIMULATED_EXECUTION_REFUSAL_ONLY"
      };
    }

    const intent = input.approval.orderIntent;
    return {
      ok: true,
      command: {
        id: input.commandId,
        approvalId: input.approval.id,
        orderIntentId: intent.id,
        strategyVersionId: intent.signal.strategyVersion.id,
        assetId: intent.signal.asset.id,
        symbol: intent.signal.asset.symbol,
        side: intent.side,
        quantity: Number(intent.quantity.toString()),
        limitPrice: priceToNumber(intent.limitPrice.toString()),
        currency: priceCurrency(intent.limitPrice.toString()),
        idempotencyKey: input.idempotencyKey,
        createdAt: input.createdAt,
        safetyType: "SIMULATED_EXECUTION_COMMAND_ONLY",
        liveBrokerWriteAllowed: false
      }
    };
  }

  simulate(command: SimulatedExecutionCommand, response: SimulatedBrokerResponse, executedAt: Date): SimulatedExecutionRecord {
    const fillQuantity = Math.max(0, Math.min(command.quantity, response.fillQuantity ?? 0));
    const fills = fillQuantity > 0 && response.fillPrice !== undefined
      ? [
          {
            quantity: fillQuantity,
            price: roundCurrency(response.fillPrice),
            safetyType: "SIMULATED_EXECUTION_FILL_ONLY" as const
          }
        ]
      : [];

    return {
      commandId: command.id,
      approvalId: command.approvalId,
      orderIntentId: command.orderIntentId,
      status: response.status,
      fills,
      rejectionReasons: response.status === "REJECTED" ? [response.reason ?? "simulated_broker_rejected"] : [],
      blocksDependentActions: response.status === "UNKNOWN",
      simulatedBrokerOrderRef: response.simulatedBrokerOrderRef,
      executedAt,
      safetyType: "SIMULATED_EXECUTION_RECORD_ONLY",
      liveBrokerWriteAllowed: false
    };
  }

  createOutboxEvent(input: {
    eventId: string;
    command: SimulatedExecutionCommand;
    createdAt: Date;
  }): OutboxEventRecord {
    return {
      id: input.eventId,
      eventType: "SIMULATED_ORDER_EXECUTION",
      aggregateType: "ORDER_APPROVAL",
      aggregateId: input.command.approvalId,
      payload: {
        command: input.command
      },
      idempotencyKey: input.command.idempotencyKey,
      status: "PENDING",
      attemptCount: 0,
      nextAttemptAt: undefined,
      lockedBy: undefined,
      lockedAt: undefined,
      lastError: undefined,
      createdAt: input.createdAt,
      processedAt: undefined
    };
  }

  fakeOutboxHandler(response: SimulatedBrokerResponse): (event: OutboxEventRecord) => Promise<OutboxProcessingResult> {
    return async () => {
      if (response.status === "UNKNOWN") {
        return {
          ok: false,
          error: {
            code: "UNKNOWN_BROKER_STATE",
            message: response.reason ?? "simulated broker state unknown",
            unknownBrokerState: true
          }
        };
      }

      return { ok: true };
    };
  }
}

function priceToNumber(value: string): number {
  return Number(value.split(" ")[0]);
}

function priceCurrency(value: string): string {
  return value.split(" ")[1] ?? "UNKNOWN";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
