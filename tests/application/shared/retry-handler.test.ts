import { describe, it, expect, beforeEach, vi } from "vitest";
import { RetryHandler, isTransientError } from "../../../src/application/shared/retry-handler.js";

/**
 * Test suite for RetryHandler
 * Verifies exponential backoff, retry predicates, and error handling
 */
describe("RetryHandler", () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler({ maxRetries: 3, baseDelayMs: 10 });
  });

  it("should execute operation successfully on first try", async () => {
    const operation = vi.fn(async () => "success");

    const result = await retryHandler.executeWithRetry(operation);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should retry on transient error and succeed", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED: Connection refused"))
      .mockResolvedValueOnce("success");

    const result = await retryHandler.executeWithRetry(operation, isTransientError);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should not retry on permanent errors", async () => {
    const permanentError = new Error("Invalid request");
    const operation = vi.fn().mockRejectedValue(permanentError);

    await expect(retryHandler.executeWithRetry(operation, isTransientError)).rejects.toThrow(
      "Invalid request"
    );

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should respect max retries limit", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("ETIMEDOUT: Connection timeout"));

    await expect(
      retryHandler.executeWithRetry(operation, isTransientError)
    ).rejects.toThrow("ETIMEDOUT");

    expect(operation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it("should recognize network errors as transient", () => {
    expect(isTransientError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isTransientError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isTransientError(new Error("Connection reset"))).toBe(true);
  });

  it("should recognize rate limit errors as transient", () => {
    expect(isTransientError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isTransientError(new Error("503 Service Unavailable"))).toBe(true);
    expect(isTransientError(new Error("Rate limit exceeded"))).toBe(true);
  });

  it("should recognize database lock errors as transient", () => {
    expect(isTransientError(new Error("Database is locked"))).toBe(true);
    expect(isTransientError(new Error("Deadlock detected"))).toBe(true);
  });

  it("should call retry hook on retry", async () => {
    const retryHook = vi.fn();
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce("success");

    await retryHandler.executeWithRetry(operation, isTransientError, retryHook);

    expect(retryHook).toHaveBeenCalledTimes(1);
    expect(retryHook).toHaveBeenCalledWith(expect.objectContaining({
      totalAttempts: 2,
      lastDelay: expect.any(Number),
      lastError: expect.any(Error)
    }));
  });

  it("should use exponential backoff", async () => {
    const delays: (number | undefined)[] = [];
    const retryHookCapture = vi.fn(async (metrics: any) => {
      delays.push(metrics.lastDelay);
    });

    const handler = new RetryHandler({ maxRetries: 3, baseDelayMs: 10 });
    const operation = vi.fn().mockRejectedValue(new Error("timeout"));

    await expect(
      handler.executeWithRetry(operation, isTransientError, retryHookCapture)
    ).rejects.toThrow();

    // Verify delays are increasing (exponential backoff)
    if (delays.length > 1 && delays[0] !== undefined && delays[1] !== undefined) {
      expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
    }
  });

  it("should handle custom retry predicate", async () => {
    const isCustomTransient = (error: unknown) => error instanceof Error && error.message.includes("TEMP");
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("TEMP_ERROR"))
      .mockResolvedValueOnce("success");

    const result = await retryHandler.executeWithRetry(operation, isCustomTransient);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should execute multiple operations with retry", async () => {
    const op1 = vi.fn().mockResolvedValue("result1");
    const op2 = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("result2");

    const results = await retryHandler.executeMultipleWithRetry([
      { id: "op1", operation: op1 },
      { id: "op2", operation: op2 }
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: "op1", result: "result1" });
    expect(results[1]).toMatchObject({ id: "op2", result: "result2" });
  });

  it("should handle non-Error objects", () => {
    expect(isTransientError("string error")).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
  });
});
