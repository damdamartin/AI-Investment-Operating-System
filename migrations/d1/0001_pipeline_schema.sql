-- SQLite / Cloudflare D1 schema for the automated recommendation pipeline.
-- This is distinct from migrations/000x_*.sql (the PostgreSQL schema described
-- in docs/04_Database_Architecture.md). D1 has no uuid/jsonb/timestamptz
-- types, so ids are stored as text (uuid strings), timestamps as ISO-8601
-- text, and structured payloads as JSON text.
--
-- Money is always stored as a (amount_major TEXT, currency TEXT) pair, never
-- a bare number, per docs/04_Database_Architecture.md 4.1.
--
-- This schema stops at "order_recommendations": there is no orders/fills/
-- broker_accounts table here, because this pipeline never submits a real
-- broker order. A recommendation's lifecycle ends when a human marks it
-- SUBMITTED_BY_HUMAN (after placing the order themselves) or DISMISSED.

create table cycle_runs (
  id text primary key,
  started_at text not null,
  finished_at text,
  status text not null check (status in ('RUNNING', 'COMPLETED', 'FAILED')),
  error text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table assets (
  id text primary key,
  symbol text not null,
  name text not null,
  market text not null check (market in ('KR', 'US')),
  asset_type text not null check (asset_type in ('STOCK', 'ETF')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (market, symbol)
);

create table strategy_versions (
  id text primary key,
  strategy_name text not null,
  version text not null,
  definition_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (strategy_name, version)
);

create table signals (
  id text primary key,
  cycle_run_id text not null references cycle_runs(id),
  strategy_version_id text not null references strategy_versions(id),
  asset_id text not null references assets(id),
  direction text not null check (direction in ('BUY', 'SELL', 'HOLD')),
  score_set_json text not null,
  scoring_version text not null,
  generated_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table risk_checks (
  id text primary key,
  signal_id text not null references signals(id),
  result text not null check (result in ('PASS', 'PASS_WITH_WARNING', 'FAIL', 'BLOCKED')),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  failed_limit_ids_json text not null default '[]',
  warnings_json text not null default '[]',
  checked_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table money_checks (
  id text primary key,
  signal_id text not null references signals(id),
  result text not null check (result in ('PASS', 'PASS_WITH_ADJUSTMENT', 'FAIL', 'BLOCKED')),
  approved_quantity text,
  approved_amount_major text,
  approved_currency text check (approved_currency in ('KRW', 'USD')),
  reasons_json text not null default '[]',
  warnings_json text not null default '[]',
  checked_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A recommendation is the pipeline's final output. It is never auto-submitted
-- to a broker; a human reads it and decides. See docs/07_Trading_System.md
-- and 11_AI_RULES.md Rule 1 ("AI Must Not Directly Place Broker Orders").
create table order_recommendations (
  id text primary key,
  signal_id text not null references signals(id),
  risk_check_id text not null references risk_checks(id),
  money_check_id text not null references money_checks(id),
  asset_id text not null references assets(id),
  direction text not null check (direction in ('BUY', 'SELL')),
  recommended_quantity text not null,
  recommended_amount_major text not null,
  recommended_currency text not null check (recommended_currency in ('KRW', 'USD')),
  status text not null default 'PENDING_HUMAN_SUBMISSION' check (
    status in ('PENDING_HUMAN_SUBMISSION', 'ACKNOWLEDGED', 'SUBMITTED_BY_HUMAN', 'DISMISSED', 'EXPIRED')
  ),
  reasoning text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at text,
  decided_by text
);

create table audit_log (
  id text primary key,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  reason text,
  metadata_json text not null default '{}',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index signals_cycle_run_idx on signals(cycle_run_id);
create index order_recommendations_status_idx on order_recommendations(status);
create index audit_log_resource_idx on audit_log(resource_type, resource_id);
