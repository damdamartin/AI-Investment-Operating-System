/**
 * D1PriceCacheAdapter
 *
 * Adapts Cloudflare D1Database to PriceCacheDatabase interface
 * Allows PriceCacheRepository to work directly with D1 without requiring D1HttpClient
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { PriceCacheDatabase, D1QueryResultRow } from "./price-cache-repository.js";

export class D1PriceCacheAdapter implements PriceCacheDatabase {
  constructor(private readonly db: D1Database) {}

  async query(
    sql: string,
    params?: ReadonlyArray<string | number | boolean | null>
  ): Promise<{ results: D1QueryResultRow[] }> {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? await stmt.bind(...params).all() : await stmt.all();

      return {
        results: (result.results as D1QueryResultRow[]) || []
      };
    } catch (error) {
      console.error("[D1PriceCacheAdapter] Query error:", sql, params, error);
      throw error;
    }
  }
}
