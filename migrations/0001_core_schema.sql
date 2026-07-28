create table assets (
  id uuid primary key,
  symbol text not null,
  name text not null,
  market text not null check (market in ('KR', 'US')),
  asset_type text not null check (asset_type in ('STOCK', 'ETF')),
  trading_status text not null default 'UNVERIFIED' check (trading_status in ('UNKNOWN', 'TRADABLE', 'HALTED', 'DELISTED', 'BLOCKED', 'UNVERIFIED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, symbol)
);

create table broker_asset_mappings (
  id uuid primary key,
  asset_id uuid not null references assets(id),
  broker text not null check (broker in ('TOSS_SECURITIES')),
  broker_symbol text not null,
  market text not null check (market in ('KR', 'US')),
  asset_type text not null check (asset_type in ('STOCK', 'ETF')),
  orderable boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broker, market, broker_symbol)
);

create table portfolios (
  id uuid primary key,
  name text not null,
  portfolio_type text not null check (portfolio_type in ('PRODUCTION', 'SMALL_CAPITAL_LIVE', 'PAPER', 'SHADOW', 'BACKTEST')),
  base_currency text not null check (base_currency in ('KRW', 'USD')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'CLOSED')),
  created_at timestamptz not null default now()
);

create table broker_accounts (
  id uuid primary key,
  broker text not null check (broker in ('TOSS_SECURITIES')),
  external_account_ref text not null,
  account_label text not null,
  base_currency text not null check (base_currency in ('KRW', 'USD')),
  supported_markets jsonb not null default '[]'::jsonb,
  supported_asset_types jsonb not null default '[]'::jsonb,
  permission_status text not null default 'UNVERIFIED' check (
    permission_status in ('UNVERIFIED', 'READ_ONLY', 'PAPER_ONLY', 'LIVE_TRADING_ALLOWED', 'LIVE_TRADING_BLOCKED', 'SUSPENDED')
  ),
  live_trading_enabled boolean not null default false,
  read_only_enabled boolean not null default false,
  last_verified_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portfolio_broker_account_links (
  id uuid primary key,
  portfolio_id uuid not null references portfolios(id),
  broker_account_id uuid not null references broker_accounts(id),
  allocation_policy jsonb not null default '{}'::jsonb,
  allowed_markets jsonb not null default '[]'::jsonb,
  allowed_asset_types jsonb not null default '[]'::jsonb,
  max_capital_allocation numeric,
  status text not null default 'DISABLED' check (status in ('ACTIVE', 'DISABLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, broker_account_id)
);

create table strategies (
  id uuid primary key,
  name text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'RESEARCH', 'VALIDATING', 'APPROVED', 'ACTIVE', 'RETIRED')),
  created_at timestamptz not null default now()
);

create table strategy_versions (
  id uuid primary key,
  strategy_id uuid not null references strategies(id),
  version text not null,
  status text not null default 'DRAFT' check (
    status in ('DRAFT', 'BACKTESTED', 'WALK_FORWARD_VALIDATED', 'SHADOW', 'PAPER', 'SMALL_CAPITAL_LIVE', 'PRODUCTION_APPROVED', 'PRODUCTION_ACTIVE', 'RETIRED')
  ),
  definition_hash text not null,
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (strategy_id, version)
);

create table signals (
  id uuid primary key,
  strategy_version_id uuid not null references strategy_versions(id),
  asset_id uuid not null references assets(id),
  direction text not null check (direction in ('BUY', 'SELL', 'HOLD')),
  score_set jsonb not null,
  scoring_version text not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table risk_limits (
  id uuid primary key,
  scope text not null,
  limit_type text not null,
  threshold jsonb not null,
  action text not null check (action in ('WARN', 'REJECT', 'BLOCK')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  version text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create table audit_records (
  id uuid primary key,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
