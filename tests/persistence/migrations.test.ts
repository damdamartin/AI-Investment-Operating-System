import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyMigrations, loadMigrations } from "../../src/index.js";

describe("database migrations", () => {
  it("applies all migrations to a clean test database", async () => {
    const db = new PGlite();

    await applyMigrations((sql) => db.exec(sql));

    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
    );

    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "assets",
        "broker_accounts",
        "broker_asset_mappings",
        "portfolio_broker_account_links",
        "historical_price_bars",
        "corporate_actions",
        "cost_model_versions",
        "outbox_events",
        "audit_records"
      ])
    );
  });

  it("keeps broker account live trading blocked by default", async () => {
    const db = new PGlite();
    await applyMigrations((sql) => db.exec(sql));

    await db.query(
      "insert into broker_accounts (id, broker, external_account_ref, account_label, base_currency) values ('00000000-0000-0000-0000-000000000001', 'TOSS_SECURITIES', 'safe-ref', 'Main', 'KRW')"
    );
    const result = await db.query<{
      permission_status: string;
      live_trading_enabled: boolean;
      read_only_enabled: boolean;
    }>("select permission_status, live_trading_enabled, read_only_enabled from broker_accounts");

    expect(result.rows[0]).toEqual({
      permission_status: "UNVERIFIED",
      live_trading_enabled: false,
      read_only_enabled: false
    });
  });

  it("keeps portfolio-account links disabled by default", async () => {
    const db = new PGlite();
    await applyMigrations((sql) => db.exec(sql));

    await db.query(
      "insert into portfolios (id, name, portfolio_type, base_currency) values ('00000000-0000-0000-0000-000000000001', 'Production', 'PRODUCTION', 'KRW')"
    );
    await db.query(
      "insert into broker_accounts (id, broker, external_account_ref, account_label, base_currency) values ('00000000-0000-0000-0000-000000000002', 'TOSS_SECURITIES', 'safe-ref', 'Main', 'KRW')"
    );
    await db.query(
      "insert into portfolio_broker_account_links (id, portfolio_id, broker_account_id) values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')"
    );

    const result = await db.query<{ status: string }>("select status from portfolio_broker_account_links");

    expect(result.rows[0]?.status).toBe("DISABLED");
  });

  it("enforces outbox idempotency keys", async () => {
    const db = new PGlite();
    await applyMigrations((sql) => db.exec(sql));

    const insert =
      "insert into outbox_events (id, event_type, aggregate_type, aggregate_id, payload, idempotency_key) values ($1, 'SIMULATED_EVENT', 'ORDER', '00000000-0000-0000-0000-000000000001', '{}', 'same-key')";

    await db.query(insert, ["00000000-0000-0000-0000-000000000010"]);
    await expect(db.query(insert, ["00000000-0000-0000-0000-000000000011"])).rejects.toThrow();
  });

  it("loads migrations in filename order", async () => {
    const migrations = await loadMigrations();

    expect(migrations.map((migration) => migration.name)).toEqual([
      "0001_core_schema.sql",
      "0002_historical_data_schema.sql",
      "0003_outbox_events_schema.sql"
    ]);
  });
});
