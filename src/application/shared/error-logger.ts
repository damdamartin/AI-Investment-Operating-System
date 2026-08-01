/**
 * ErrorLogger: Centralized error logging with persistence to D1 database
 *
 * Features:
 * - Persistent error storage with full stack traces
 * - Severity classification (INFO, WARN, ERROR, CRITICAL)
 * - Automatic CRITICAL error notification
 * - Error resolution tracking
 * - Context-based filtering and analysis
 *
 * Usage:
 *   const logger = new ErrorLogger(db);
 *   await logger.logError('order-execution', error, {
 *     orderId: '123',
 *     symbol: 'AAPL',
 *     quantity: 100
 *   });
 */

import type { PipelineDatabase } from "../../persistence/pipeline-repository.js";

export type ErrorSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface ErrorMetadata {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export interface LoggedError {
  readonly id: number;
  readonly timestamp: string;
  readonly context: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly metadata?: ErrorMetadata;
}

export interface ErrorNotificationHandler {
  notifyError(error: LoggedError): Promise<void>;
}

/**
 * Determines severity based on error type and message patterns
 */
function determineSeverity(error: unknown): ErrorSeverity {
  if (!(error instanceof Error)) {
    return "WARN";
  }

  const message = error.message.toLowerCase();

  // Critical patterns: data loss, security, transaction failure, rate limits
  if (
    message.includes("rollback") ||
    message.includes("transaction failed") ||
    message.includes("deadlock") ||
    message.includes("constraint violation") ||
    message.includes("authentication failed") ||
    message.includes("unauthorized") ||
    message.includes("rate limit") ||
    message.includes("connection refused")
  ) {
    return "CRITICAL";
  }

  // Error patterns: API failures, retry exhaustion
  if (
    message.includes("failed") ||
    message.includes("error") ||
    message.includes("timeout") ||
    message.includes("no retries")
  ) {
    return "ERROR";
  }

  // Warn patterns: degraded service, partial failures
  if (
    message.includes("warning") ||
    message.includes("deprecat") ||
    message.includes("slow") ||
    message.includes("retry")
  ) {
    return "WARN";
  }

  return "INFO";
}

export class ErrorLogger {
  private readonly notificationHandlers: Set<ErrorNotificationHandler> = new Set();

  constructor(private readonly db: PipelineDatabase) {}

  /**
   * Register a handler to be called when CRITICAL errors are logged
   */
  onCriticalError(handler: ErrorNotificationHandler): void {
    this.notificationHandlers.add(handler);
  }

  /**
   * Log an error with automatic severity detection
   */
  async logError(
    context: string,
    error: unknown,
    metadata?: ErrorMetadata,
    overrideSeverity?: ErrorSeverity
  ): Promise<LoggedError> {
    const severity = overrideSeverity ?? determineSeverity(error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const loggedError = await this.insertErrorLog(context, message, stack, severity, metadata);

    // Notify handlers for CRITICAL errors
    if (severity === "CRITICAL") {
      await this.notifyCriticalError(loggedError);
    }

    return loggedError;
  }

  /**
   * Log an info-level message
   */
  async logInfo(context: string, message: string, metadata?: ErrorMetadata): Promise<LoggedError> {
    return this.insertErrorLog(context, message, undefined, "INFO", metadata);
  }

  /**
   * Log a warning-level message
   */
  async logWarn(context: string, message: string, metadata?: ErrorMetadata): Promise<LoggedError> {
    return this.insertErrorLog(context, message, undefined, "WARN", metadata);
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(errorId: number, resolutionNote?: string): Promise<void> {
    await this.db.query(
      `UPDATE error_logs
       SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolution_note = ?
       WHERE id = ?`,
      [resolutionNote ?? null, errorId]
    );
  }

  /**
   * Get unresolved critical errors for manual intervention
   */
  async getUnresolvedCriticalErrors(limit = 100): Promise<LoggedError[]> {
    const result = await this.db.query(
      `SELECT id, timestamp, context, message, severity, metadata
       FROM error_logs
       WHERE resolved = 0 AND severity = 'CRITICAL'
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    );

    return result.results
      .filter((row): row is typeof row => row !== undefined)
      .map((row) => ({
        id: row.id as number,
        timestamp: row.timestamp as string,
        context: row.context as string,
        message: row.message as string,
        severity: row.severity as ErrorSeverity,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
      }));
  }

  /**
   * Get errors for a specific context
   */
  async getErrorsByContext(context: string, limit = 100, hoursBack = 24): Promise<LoggedError[]> {
    const result = await this.db.query(
      `SELECT id, timestamp, context, message, severity, metadata
       FROM error_logs
       WHERE context = ? AND datetime(timestamp) > datetime('now', '-' || ? || ' hours')
       ORDER BY timestamp DESC
       LIMIT ?`,
      [context, hoursBack, limit]
    );

    return result.results
      .filter((row): row is typeof row => row !== undefined)
      .map((row) => ({
        id: row.id as number,
        timestamp: row.timestamp as string,
        context: row.context as string,
        message: row.message as string,
        severity: row.severity as ErrorSeverity,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
      }));
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(hoursBack = 24): Promise<{
    total: number;
    byContext: Record<string, number>;
    bySeverity: Record<ErrorSeverity, number>;
  }> {
    const byContextResult = await this.db.query(
      `SELECT context, COUNT(*) as count
       FROM error_logs
       WHERE datetime(timestamp) > datetime('now', '-' || ? || ' hours')
       GROUP BY context
       ORDER BY count DESC`,
      [hoursBack]
    );

    const bySeverityResult = await this.db.query(
      `SELECT severity, COUNT(*) as count
       FROM error_logs
       WHERE datetime(timestamp) > datetime('now', '-' || ? || ' hours')
       GROUP BY severity`,
      [hoursBack]
    );

    const byContext: Record<string, number> = {};
    for (const row of byContextResult.results) {
      byContext[row.context as string] = row.count as number;
    }

    const bySeverity: Record<ErrorSeverity, number> = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRITICAL: 0
    };
    for (const row of bySeverityResult.results) {
      bySeverity[row.severity as ErrorSeverity] = row.count as number;
    }

    const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);

    return { total, byContext, bySeverity };
  }

  // ============= Private Methods =============

  private async insertErrorLog(
    context: string,
    message: string,
    stack: string | undefined,
    severity: ErrorSeverity,
    metadata?: ErrorMetadata
  ): Promise<LoggedError> {
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    const result = await this.db.query(
      `INSERT INTO error_logs (context, message, stack, severity, metadata)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, timestamp, context, message, severity, metadata`,
      [context, message, stack ?? null, severity, metadataJson]
    );

    const row = result.results[0];
    if (!row) {
      throw new Error("Failed to insert error log - no result returned");
    }

    return {
      id: row.id as number,
      timestamp: row.timestamp as string,
      context: row.context as string,
      message: row.message as string,
      severity: row.severity as ErrorSeverity,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    };
  }

  private async notifyCriticalError(loggedError: LoggedError): Promise<void> {
    const notificationPromises = Array.from(this.notificationHandlers).map((handler) =>
      handler.notifyError(loggedError).catch((error) => {
        console.error("Failed to notify critical error:", error);
      })
    );

    await Promise.all(notificationPromises);
  }
}
