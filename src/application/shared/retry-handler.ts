/**
 * RetryHandler: Implements exponential backoff retry logic for transient failures
 *
 * Features:
 * - Exponential backoff with configurable base delay
 * - Jitter to prevent thundering herd
 * - Max retries limit
 * - Conditional retry based on error type
 * - Detailed retry statistics
 *
 * Default behavior:
 * - 1st attempt: 1s delay
 * - 2nd attempt: 2s delay
 * - 3rd attempt: 4s delay
 *
 * Usage:
 *   const retry = new RetryHandler({ maxRetries: 3, baseDelayMs: 1000 });
 *   const result = await retry.executeWithRetry(
 *     async () => await api.fetchData(),
 *     (error) => error instanceof NetworkError
 *   );
 */

import { randomInt } from "node:crypto";

export interface RetryHandlerOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly jitterFactor?: number; // 0-1, default 0.1
}

export interface RetryMetrics {
  readonly totalAttempts: number;
  readonly lastDelay: number;
  readonly lastError?: unknown;
}

export type RetryPredicate = (error: unknown, attemptNumber: number) => boolean;

/**
 * Returns true for errors that are likely transient and worth retrying
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection")
  ) {
    return true;
  }

  // Rate limiting and temporary unavailability
  if (
    message.includes("429") ||
    message.includes("503") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable") ||
    message.includes("overloaded")
  ) {
    return true;
  }

  // Database locks
  if (message.includes("locked") || message.includes("deadlock")) {
    return true;
  }

  return false;
}

export class RetryHandler {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterFactor: number;

  constructor(options: RetryHandlerOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.jitterFactor = options.jitterFactor ?? 0.1;

    if (this.maxRetries < 0) throw new Error("maxRetries must be >= 0");
    if (this.baseDelayMs < 0) throw new Error("baseDelayMs must be >= 0");
    if (this.jitterFactor < 0 || this.jitterFactor > 1) {
      throw new Error("jitterFactor must be between 0 and 1");
    }
  }

  /**
   * Execute an operation with automatic retry on transient errors
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    shouldRetry: RetryPredicate = isTransientError,
    onRetry?: (metrics: RetryMetrics) => Promise<void>
  ): Promise<T> {
    let lastError: unknown;
    let totalAttempts = 0;
    let lastDelay = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        totalAttempts = attempt + 1;
        return await operation();
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt >= this.maxRetries || !shouldRetry(error, attempt + 1)) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        lastDelay = delay;

        const metrics: RetryMetrics = { totalAttempts: totalAttempts + 1, lastDelay: delay, lastError: error };

        // Call retry hook if provided
        if (onRetry) {
          await onRetry(metrics);
        }

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // This should never be reached due to throw in catch, but satisfy TS
    throw lastError ?? new Error("Retry exhausted with no error information");
  }

  /**
   * Execute multiple independent operations with retry
   */
  async executeMultipleWithRetry<T>(
    operations: Array<{ id: string; operation: () => Promise<T> }>,
    shouldRetry?: RetryPredicate
  ): Promise<Array<{ id: string; result?: T; error?: unknown }>> {
    const results = await Promise.allSettled(
      operations.map(async (op) => {
        try {
          const result = await this.executeWithRetry(op.operation, shouldRetry);
          return { id: op.id, result, error: undefined };
        } catch (error) {
          return { id: op.id, result: undefined, error };
        }
      })
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        return r.value;
      }
      return { id: operations[i]?.id ?? "unknown", error: r.status === "rejected" ? r.reason : "Unknown error" };
    });
  }

  /**
   * Get metrics for a completed retry sequence
   */
  getMetrics(totalAttempts: number, lastError?: unknown): RetryMetrics {
    return {
      totalAttempts,
      lastDelay: this.calculateDelay(totalAttempts - 1),
      lastError
    };
  }

  // ============= Private Methods =============

  private calculateDelay(attemptIndex: number): number {
    // Exponential backoff: 2^attemptIndex * baseDelay
    const exponentialDelay = Math.pow(2, attemptIndex) * this.baseDelayMs;
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter: ±jitterFactor * cappedDelay
    const jitterAmount = cappedDelay * this.jitterFactor;
    const jitter = randomInt(-Math.floor(jitterAmount), Math.ceil(jitterAmount));

    return Math.max(0, cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
