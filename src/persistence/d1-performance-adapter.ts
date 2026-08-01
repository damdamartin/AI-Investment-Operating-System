/**
 * D1 Performance Database Adapter
 * Adapts Cloudflare D1Database to PerformanceDatabase interface
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { PerformanceDatabase } from "./performance-repository.js";
import type { D1QueryResultRow } from "./d1-http-client.js";

export class D1PerformanceDatabaseAdapter implements PerformanceDatabase {
  constructor(private readonly db: D1Database) {}

  async query(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): Promise<{ results: D1QueryResultRow[] }> {
    try {
      const stmt = this.db.prepare(sql);
      const boundStmt = params ? stmt.bind(...params) : stmt;
      const result = await boundStmt.all() as any;

      // D1 returns { results: [...], success: boolean }
      return {
        results: (result.results || []).map((row: any) => {
          // Convert snake_case DB columns to the expected format
          const converted: D1QueryResultRow = {};
          for (const [key, value] of Object.entries(row || {})) {
            converted[key] = value as string | number | boolean | null;
          }
          return converted;
        }),
      };
    } catch (error) {
      console.error(`[D1PerformanceAdapter] Query error: ${sql}`, error);
      return { results: [] };
    }
  }
}
