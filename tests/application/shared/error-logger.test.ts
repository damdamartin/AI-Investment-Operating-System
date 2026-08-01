import { describe, it, expect, beforeEach, vi } from "vitest";
import { ErrorLogger, ErrorSeverity } from "../../../src/application/shared/error-logger.js";
import type { PipelineDatabase } from "../../../src/persistence/pipeline-repository.js";

/**
 * Test suite for ErrorLogger
 * Verifies error persistence, severity classification, and notification
 */
describe("ErrorLogger", () => {
  let mockDb: PipelineDatabase;
  let errorLogger: ErrorLogger;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      query: vi.fn(async (sql: string, params?: any[]) => {
        // Mock insert returning
        if (sql.includes("RETURNING")) {
          // Determine severity from params (4th parameter)
          const severity = params && params[3] ? params[3] : "ERROR";
          return {
            results: [
              {
                id: 1,
                timestamp: new Date().toISOString(),
                context: params && params[0] ? params[0] : "test",
                message: params && params[1] ? params[1] : "Test error",
                severity: severity,
                metadata: null
              }
            ]
          };
        }
        // Mock select queries
        return { results: [] };
      })
    };

    errorLogger = new ErrorLogger(mockDb);
  });

  it("should log error with automatic severity detection", async () => {
    const error = new Error("Connection refused");
    const logged = await errorLogger.logError("connection", error);

    expect(logged.message).toBe("Connection refused");
    expect(logged.severity).toBe("CRITICAL");
    expect(mockDb.query).toHaveBeenCalled();
  });

  it("should log info level messages", async () => {
    const logged = await errorLogger.logInfo("startup", "Application started", { version: "1.0" });

    expect(logged.severity).toBe("INFO");
    expect(logged.message).toBe("Application started");
  });

  it("should log warn level messages", async () => {
    const logged = await errorLogger.logWarn("deprecation", "Using deprecated API", { endpoint: "/v1/data" });

    expect(logged.severity).toBe("WARN");
  });

  it("should classify timeout errors as ERROR", async () => {
    const error = new Error("Request timeout");
    const logged = await errorLogger.logError("api", error);

    expect(logged.severity).toBe("ERROR");
  });

  it("should classify rate limit errors as CRITICAL", async () => {
    const error = new Error("Rate limit exceeded (429)");
    const logged = await errorLogger.logError("api", error);

    expect(logged.severity).toBe("CRITICAL");
  });

  it("should support custom severity override", async () => {
    const error = new Error("Minor issue");
    const logged = await errorLogger.logError("app", error, undefined, "WARN");

    expect(logged.severity).toBe("WARN");
  });

  it("should include metadata in error log", async () => {
    const error = new Error("Order failed");
    const metadata = { orderId: "123", symbol: "AAPL", quantity: 100 };

    await errorLogger.logError("order-execution", error, metadata);

    expect(mockDb.query).toHaveBeenCalled();
  });

  it("should resolve errors", async () => {
    await errorLogger.resolveError(1, "Fixed in v1.1");

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE error_logs"),
      expect.any(Array)
    );
  });

  it("should retrieve error statistics", async () => {
    const stats = await errorLogger.getErrorStatistics(24);

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("byContext");
    expect(stats).toHaveProperty("bySeverity");
  });
});
