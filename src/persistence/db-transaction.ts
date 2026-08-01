/**
 * DBTransaction: Manages transactional integrity for database operations.
 * Provides automatic rollback on errors to ensure ACID compliance.
 *
 * Usage:
 *   const transaction = new DBTransaction(db);
 *   const result = await transaction.executeTransaction(async (db) => {
 *     await db.query('INSERT INTO orders ...', []);
 *     await db.query('UPDATE positions ...', []);
 *     return result;
 *   });
 */

import type { PipelineDatabase } from "./pipeline-repository.js";

export interface TransactionOptions {
  readonly isolationLevel?: "SERIALIZABLE" | "REPEATABLE READ" | "READ COMMITTED" | "READ UNCOMMITTED";
  readonly readonly?: boolean;
}

export class DBTransaction {
  constructor(private readonly db: PipelineDatabase) {}

  /**
   * Execute a callback within a database transaction.
   * Automatically rolls back on error, commits on success.
   */
  async executeTransaction<T>(
    callback: (db: PipelineDatabase) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const isolationLevel = options?.isolationLevel ?? "READ COMMITTED";
    const isReadOnly = options?.readonly ?? false;

    try {
      // Begin transaction with specified isolation level
      await this.db.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      if (isReadOnly) {
        await this.db.query("SET TRANSACTION READ ONLY");
      }

      // Execute user callback
      const result = await callback(this.db);

      // Commit transaction
      await this.db.query("COMMIT");

      return result;
    } catch (error) {
      // Rollback on any error
      try {
        await this.db.query("ROLLBACK");
      } catch (rollbackError) {
        // Log but don't throw rollback errors
        console.error("Rollback failed:", rollbackError);
      }

      // Re-throw original error
      throw error;
    }
  }

  /**
   * Execute multiple independent transactions sequentially.
   * Useful for batch operations where each operation must be atomic.
   */
  async executeSequentialTransactions<T>(
    callbacks: Array<(db: PipelineDatabase) => Promise<T>>,
    options?: TransactionOptions
  ): Promise<T[]> {
    const results: T[] = [];

    for (const callback of callbacks) {
      const result = await this.executeTransaction(callback, options);
      results.push(result);
    }

    return results;
  }
}
