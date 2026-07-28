create table historical_price_bars (
  id uuid primary key,
  asset_id uuid not null references assets(id),
  market text not null check (market in ('KR', 'US')),
  timeframe text not null,
  bar_time timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric not null,
  adjustment_method text not null check (adjustment_method in ('RAW', 'SPLIT_ADJUSTED', 'TOTAL_RETURN', 'PROVIDER_ADJUSTED')),
  source text not null,
  quality_status text not null default 'UNVERIFIED' check (quality_status in ('VALID', 'SUSPECT', 'MISSING', 'UNVERIFIED')),
  created_at timestamptz not null default now(),
  unique (asset_id, timeframe, bar_time, adjustment_method, source)
);

create table corporate_actions (
  id uuid primary key,
  asset_id uuid not null references assets(id),
  action_type text not null check (action_type in ('SPLIT', 'DIVIDEND', 'DISTRIBUTION', 'MERGER', 'SYMBOL_CHANGE', 'DELISTING', 'HALT')),
  effective_date date not null,
  declared_at timestamptz,
  value jsonb not null default '{}'::jsonb,
  source text not null,
  quality_status text not null default 'UNVERIFIED' check (quality_status in ('VALID', 'SUSPECT', 'UNVERIFIED')),
  created_at timestamptz not null default now()
);

create table cost_model_versions (
  id uuid primary key,
  model_name text not null,
  version text not null,
  market text not null check (market in ('KR', 'US', 'GLOBAL')),
  asset_type text not null check (asset_type in ('STOCK', 'ETF', 'ALL')),
  assumptions jsonb not null,
  source_note text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'RETIRED')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (model_name, version, market, asset_type)
);

create table market_calendars (
  id uuid primary key,
  market text not null check (market in ('KR', 'US')),
  session_date date not null,
  session_status text not null check (session_status in ('OPEN', 'CLOSED', 'PARTIAL')),
  source text not null,
  created_at timestamptz not null default now(),
  unique (market, session_date)
);
