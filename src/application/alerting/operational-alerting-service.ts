import type { AIHealthCheckRecord } from "../ai-health-check/index.js";
import { redactObject } from "../../config/index.js";

export type AlertSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type AlertCategory =
  | "NORMAL_TRADING"
  | "API_FAILURE"
  | "BROKER_UNAVAILABLE"
  | "ORDER_FAILURE"
  | "UNKNOWN_BROKER_STATE"
  | "RECONCILIATION_MISMATCH"
  | "DUPLICATE_ORDER_RISK"
  | "KILL_SWITCH"
  | "RISK_LIMIT"
  | "STALE_DATA"
  | "AI_HEALTH"
  | "CLAUDE_SCHEMA_FAILURE"
  | "DATABASE_BACKUP_FAILURE"
  | "WORKER_DOWN";

export type OperationalEventType =
  | "NORMAL_BUY"
  | "NORMAL_SELL"
  | "NORMAL_FILL"
  | "DAILY_PROFIT"
  | "DAILY_LOSS_WITHIN_LIMIT"
  | "ROUTINE_HEALTH_GREEN"
  | "API_AUTH_FAILURE"
  | "BROKER_UNAVAILABLE"
  | "ORDER_SUBMISSION_FAILURE"
  | "UNKNOWN_BROKER_ORDER_STATE"
  | "RECONCILIATION_MISMATCH"
  | "DUPLICATE_ORDER_RISK"
  | "KILL_SWITCH_ACTIVATED"
  | "DAILY_LOSS_LIMIT_BREACH"
  | "MONTHLY_LOSS_LIMIT_BREACH"
  | "MAX_DRAWDOWN_BREACH"
  | "STALE_MARKET_DATA"
  | "AI_HEALTH_RED"
  | "AI_HEALTH_BLOCKED"
  | "REPEATED_CLAUDE_SCHEMA_FAILURE"
  | "DATABASE_BACKUP_FAILURE"
  | "PRODUCTION_WORKER_DOWN";

export interface OperationalEvent {
  id: string;
  type: OperationalEventType;
  occurredAt: Date;
  source: string;
  payload?: Record<string, unknown> | undefined;
}

export interface AlertEvent {
  id: string;
  sourceEventId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  immediateNotification: boolean;
  payload: Record<string, unknown>;
  createdAt: Date;
  safetyType: "OPERATIONAL_ALERT_EVENT_ONLY";
}

export class OperationalAlertingService {
  classify(event: OperationalEvent): AlertEvent | undefined {
    const classification = classificationFor(event.type);
    if (!classification) return undefined;

    return {
      id: `alert-${event.id}`,
      sourceEventId: event.id,
      category: classification.category,
      severity: classification.severity,
      title: classification.title,
      message: classification.message,
      immediateNotification: classification.severity === "ERROR" || classification.severity === "CRITICAL",
      payload: redactObject(event.payload ?? {}),
      createdAt: event.occurredAt,
      safetyType: "OPERATIONAL_ALERT_EVENT_ONLY"
    };
  }

  fromAIHealthCheck(record: AIHealthCheckRecord): AlertEvent | undefined {
    if (record.status !== "RED" && record.status !== "BLOCKED") return undefined;

    return this.classify({
      id: record.id,
      type: record.status === "BLOCKED" ? "AI_HEALTH_BLOCKED" : "AI_HEALTH_RED",
      occurredAt: record.createdAt,
      source: "AI_HEALTH_CHECK",
      payload: {
        healthCheckId: record.id,
        status: record.status,
        summary: record.summary,
        findings: record.findings,
        requiresTradingPause: record.requiresTradingPause,
        requiresHumanReview: record.requiresHumanReview
      }
    });
  }
}

function classificationFor(type: OperationalEventType): {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
} | undefined {
  switch (type) {
    case "NORMAL_BUY":
    case "NORMAL_SELL":
    case "NORMAL_FILL":
    case "DAILY_PROFIT":
    case "DAILY_LOSS_WITHIN_LIMIT":
    case "ROUTINE_HEALTH_GREEN":
      return undefined;
    case "API_AUTH_FAILURE":
      return alert("API_FAILURE", "CRITICAL", "API authentication failure", "An API authentication failure requires attention.");
    case "BROKER_UNAVAILABLE":
      return alert("BROKER_UNAVAILABLE", "CRITICAL", "Broker unavailable", "Broker access is unavailable.");
    case "ORDER_SUBMISSION_FAILURE":
      return alert("ORDER_FAILURE", "ERROR", "Order submission failure", "A simulated or live order submission path failed.");
    case "UNKNOWN_BROKER_ORDER_STATE":
      return alert("UNKNOWN_BROKER_STATE", "CRITICAL", "Unknown broker order state", "Broker order state is uncertain and needs reconciliation.");
    case "RECONCILIATION_MISMATCH":
      return alert("RECONCILIATION_MISMATCH", "ERROR", "Reconciliation mismatch", "Internal and broker state do not match.");
    case "DUPLICATE_ORDER_RISK":
      return alert("DUPLICATE_ORDER_RISK", "CRITICAL", "Duplicate order risk", "Duplicate order risk was detected.");
    case "KILL_SWITCH_ACTIVATED":
      return alert("KILL_SWITCH", "CRITICAL", "Kill switch activated", "A kill switch has been activated.");
    case "DAILY_LOSS_LIMIT_BREACH":
    case "MONTHLY_LOSS_LIMIT_BREACH":
    case "MAX_DRAWDOWN_BREACH":
      return alert("RISK_LIMIT", "CRITICAL", "Risk limit breached", "A configured loss or drawdown limit was breached.");
    case "STALE_MARKET_DATA":
      return alert("STALE_DATA", "ERROR", "Stale market data", "Stale market data is affecting trading decisions.");
    case "AI_HEALTH_RED":
      return alert("AI_HEALTH", "ERROR", "AI Health Check red", "AI Health Check reported red status.");
    case "AI_HEALTH_BLOCKED":
      return alert("AI_HEALTH", "CRITICAL", "AI Health Check blocked", "AI Health Check reported blocked status.");
    case "REPEATED_CLAUDE_SCHEMA_FAILURE":
      return alert("CLAUDE_SCHEMA_FAILURE", "ERROR", "Repeated Claude schema failures", "Claude output schema validation is repeatedly failing.");
    case "DATABASE_BACKUP_FAILURE":
      return alert("DATABASE_BACKUP_FAILURE", "ERROR", "Database backup failure", "Database backup verification failed.");
    case "PRODUCTION_WORKER_DOWN":
      return alert("WORKER_DOWN", "CRITICAL", "Production worker down", "A production worker is down.");
  }
}

function alert(category: AlertCategory, severity: AlertSeverity, title: string, message: string) {
  return {
    category,
    severity,
    title,
    message
  };
}
