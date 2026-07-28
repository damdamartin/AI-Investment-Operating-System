import type { AuditRecordProps } from "../audit/index.js";
import type { SimulatedExecutionRecord } from "../execution-simulation/index.js";

export type SimulatedCancelStatus = "ACCEPTED" | "REJECTED" | "TOO_LATE" | "UNKNOWN";

export interface SimulatedCancelRequest {
  id: string;
  commandId: string;
  approvalId: string;
  orderIntentId: string;
  reason: string;
  requestedAt: Date;
  safetyType: "SIMULATED_CANCEL_REQUEST_ONLY";
}

export interface SimulatedCancelResponse {
  status: SimulatedCancelStatus;
  reason?: string | undefined;
}

export interface SimulatedCancelResult {
  request: SimulatedCancelRequest;
  status: SimulatedCancelStatus;
  reasons: string[];
  blocksDependentActions: boolean;
  audit: AuditRecordProps;
  safetyType: "SIMULATED_CANCEL_RESULT_ONLY";
}

export type BuildCancelRequestResult =
  | {
      ok: true;
      request: SimulatedCancelRequest;
    }
  | {
      ok: false;
      reasons: string[];
      safetyType: "SIMULATED_CANCEL_REFUSAL_ONLY";
    };

export class OrderCancelSimulationService {
  buildRequest(input: {
    requestId: string;
    execution: SimulatedExecutionRecord;
    reason: string;
    requestedAt: Date;
  }): BuildCancelRequestResult {
    if (input.execution.status === "FILLED") {
      return refused(["filled_order_cannot_be_cancelled"]);
    }

    if (input.execution.status === "REJECTED") {
      return refused(["rejected_order_cannot_be_cancelled"]);
    }

    if (input.execution.status === "UNKNOWN") {
      return refused(["unknown_order_state_requires_reconciliation_before_cancel"]);
    }

    return {
      ok: true,
      request: {
        id: input.requestId,
        commandId: input.execution.commandId,
        approvalId: input.execution.approvalId,
        orderIntentId: input.execution.orderIntentId,
        reason: input.reason,
        requestedAt: input.requestedAt,
        safetyType: "SIMULATED_CANCEL_REQUEST_ONLY"
      }
    };
  }

  simulate(request: SimulatedCancelRequest, response: SimulatedCancelResponse, simulatedAt: Date): SimulatedCancelResult {
    const reasons = response.status === "ACCEPTED" ? [] : [response.reason ?? defaultReason(response.status)];

    return {
      request,
      status: response.status,
      reasons,
      blocksDependentActions: response.status === "UNKNOWN",
      audit: {
        id: `audit-${request.id}`,
        actor: "system",
        action: `SIMULATED_CANCEL_${response.status}`,
        resourceType: "SIMULATED_ORDER_EXECUTION",
        resourceId: request.commandId,
        reason: request.reason,
        metadata: {
          cancelRequestId: request.id,
          approvalId: request.approvalId,
          orderIntentId: request.orderIntentId,
          status: response.status,
          reasons
        },
        createdAt: simulatedAt
      },
      safetyType: "SIMULATED_CANCEL_RESULT_ONLY"
    };
  }
}

function refused(reasons: string[]): BuildCancelRequestResult {
  return {
    ok: false,
    reasons,
    safetyType: "SIMULATED_CANCEL_REFUSAL_ONLY"
  };
}

function defaultReason(status: SimulatedCancelStatus): string {
  if (status === "REJECTED") return "simulated_cancel_rejected";
  if (status === "TOO_LATE") return "simulated_cancel_too_late";
  return "simulated_cancel_state_unknown";
}
