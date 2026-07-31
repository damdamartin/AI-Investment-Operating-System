-- Dashboard configuration and status tables

create table dashboard_settings (
  id text primary key,
  portfolio_id text,
  trading_mode text not null default 'STABLE' check (trading_mode in ('AGGRESSIVE', 'STABLE', 'CONSERVATIVE')),
  emergency_action text not null default 'NONE' check (emergency_action in ('NONE', 'STOP', 'SELL_ALL', 'SELL_HALF')),
  cash_target_amount real default 0,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (portfolio_id)
);

create table system_status (
  id text primary key,
  portfolio_id text,
  status_light text not null default 'GREEN' check (status_light in ('GREEN', 'YELLOW', 'RED')),
  status_message text,
  toss_api_health integer default 0,
  claude_api_health integer default 0,
  database_health integer default 0,
  last_check_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (portfolio_id)
);

create table portfolio_daily_snapshot (
  id text primary key,
  portfolio_id text,
  snapshot_date text not null,
  total_value real not null,
  cash_balance real not null,
  invested_value real not null,
  daily_return real,
  cumulative_return real,
  created_at text not null default (datetime('now')),
  unique (portfolio_id, snapshot_date)
);

create table trading_actions_log (
  id text primary key,
  portfolio_id text,
  action_type text not null check (action_type in ('BUY', 'SELL', 'STOP', 'MODE_CHANGE')),
  action_details text not null default '{}',
  executed_at text not null default (datetime('now')),
  created_at text not null default (datetime('now'))
);

-- Indexes for better query performance
create index idx_dashboard_settings_portfolio on dashboard_settings(portfolio_id);
create index idx_system_status_portfolio on system_status(portfolio_id);
create index idx_portfolio_daily_snapshot_portfolio_date on portfolio_daily_snapshot(portfolio_id, snapshot_date);
create index idx_trading_actions_log_portfolio on trading_actions_log(portfolio_id);
