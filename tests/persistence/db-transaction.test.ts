import { describe, it, expect, beforeEach, vi } from "vitest";
import { DBTransaction } from "../../src/persistence/db-transaction.js";
import type { PipelineDatabase } from "../../src/persistence/pipeline-repository.js";

/**
 * Test suite for DBTransaction
 * Verifies transaction lifecycle, rollback on error, and atomic operations
 */
describe("DBTransaction", () => {
  let mockDb: PipelineDatabase;
  let transaction: DBTransaction;
  let querySpy: any;

  beforeEach(() => {
    querySpy = vi.fn(async (sql: string) => ({ results: [] }));
    mockDb = { query: querySpy };
    transaction = new DBTransaction(mockDb);
  });

  it("should execute transaction successfully", async () => {
    const callback = vi.fn(async () => "result");

    const result = await transaction.executeTransaction(callback);

    expect(result).toBe("result");
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining("BEGIN"), []);
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining("COMMIT"), []);
  });

  it("should rollback on callback error", async () => {
    const testError = new Error("Operation failed");
    const callback = vi.fn(async () => {
      throw testError;
    });

    await expect(transaction.executeTransaction(callback)).rejects.toThrow("Operation failed");

    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining("BEGIN"), []);
    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining("ROLLBACK"), []);
    expect(querySpy).not.toHaveBeenCalledWith(expect.stringContaining("COMMIT"), expect.anything());
  });

  it("should use specified isolation level", async () => {
    const callback = vi.fn(async () => "result");

    await transaction.executeTransaction(callback, { isolationLevel: "SERIALIZABLE" });

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining("SERIALIZABLE"),
      []
    );
  });

  it("should set read-only mode when specified", async () => {
    const callback = vi.fn(async () => "result");

    await transaction.executeTransaction(callback, { readonly: true });

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining("SET TRANSACTION READ ONLY"),
      []
    );
  });

  it("should pass database instance to callback", async () => {
    const callback = vi.fn(async (db: PipelineDatabase) => {
      expect(db).toBe(mockDb);
      return "result";
    });

    await transaction.executeTransaction(callback);

    expect(callback).toHaveBeenCalledWith(mockDb);
  });

  it("should handle rollback errors gracefully", async () => {
    const testError = new Error("Operation failed");
    querySpy.mockImplementationOnce(async (sql: string) => {
      if (sql.includes("ROLLBACK")) {
        throw new Error("Rollback failed");
      }
      return { results: [] };
    });

    const callback = vi.fn(async () => {
      throw testError;
    });

    // Should rethrow original error, not rollback error
    await expect(transaction.executeTransaction(callback)).rejects.toThrow("Operation failed");
  });

  it("should execute sequential transactions", async () => {
    const callback1 = vi.fn(async () => "result1");
    const callback2 = vi.fn(async () => "result2");

    const results = await transaction.executeSequentialTransactions([callback1, callback2]);

    expect(results).toEqual(["result1", "result2"]);
    expect(querySpy).toHaveBeenCalledTimes(6); // 3 calls per transaction
  });

  it("should stop sequential transactions on error", async () => {
    const callback1 = vi.fn(async () => "result1");
    const callback2 = vi.fn(async () => {
      throw new Error("Second transaction failed");
    });
    const callback3 = vi.fn(async () => "result3");

    await expect(
      transaction.executeSequentialTransactions([callback1, callback2, callback3])
    ).rejects.toThrow("Second transaction failed");

    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
    expect(callback3).not.toHaveBeenCalled();
  });

  it("should handle multiple database operations in transaction", async () => {
    const callback = vi.fn(async (db: PipelineDatabase) => {
      await db.query("INSERT INTO positions ...", []);
      await db.query("UPDATE assets ...", []);
      return "success";
    });

    const result = await transaction.executeTransaction(callback);

    expect(result).toBe("success");
    expect(querySpy).toHaveBeenCalledTimes(4); // BEGIN + 2 ops + COMMIT
  });

  it("should default to READ COMMITTED isolation level", async () => {
    const callback = vi.fn(async () => "result");

    await transaction.executeTransaction(callback);

    expect(querySpy).toHaveBeenCalledWith(
      expect.stringContaining("READ COMMITTED"),
      []
    );
  });

  it("should default to read-write mode", async () => {
    const callback = vi.fn(async () => "result");

    await transaction.executeTransaction(callback);

    // Should not include "SET TRANSACTION READ ONLY"
    const calls = querySpy.mock.calls;
    const hasReadOnlyCall = calls.some((call: any[]) =>
      call[0]?.includes("READ ONLY")
    );

    expect(hasReadOnlyCall).toBe(false);
  });
});
