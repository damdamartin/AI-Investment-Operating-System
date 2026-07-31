-- Add positions table to track open positions for stop-loss and take-profit management
-- Positions are created when an order is executed, and closed when SL/TP is triggered or manually closed

create table positions (
  id text primary key,
  asset_id text not null references assets(id),
  order_recommendation_id text not null references order_recommendations(id),
  quantity text not null,
  entry_price_major text not null,
  entry_price_currency text not null check (entry_price_currency in ('KRW', 'USD')),
  entry_date text not null,

  -- Stop Loss and Take Profit prices
  stop_loss_major text not null,
  stop_loss_currency text not null check (stop_loss_currency in ('KRW', 'USD')),
  take_profit_major text not null,
  take_profit_currency text not null check (take_profit_currency in ('KRW', 'USD')),

  -- Position status
  status text not null check (status in ('OPEN', 'CLOSED')) default 'OPEN',
  close_reason text check (close_reason in ('STOP_LOSS', 'TAKE_PROFIT', 'SIGNAL', 'MANUAL', 'PARTIAL')),

  -- Execution tracking
  last_check_at text,
  closed_at text,

  -- Metadata
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Track stop-loss and take-profit triggers
create table position_triggers (
  id text primary key,
  position_id text not null references positions(id),
  trigger_type text not null check (trigger_type in ('STOP_LOSS', 'TAKE_PROFIT')),
  triggered_price_major text not null,
  triggered_price_currency text not null check (triggered_price_currency in ('KRW', 'USD')),
  triggered_at text not null,
  close_quantity text not null,
  close_reason text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index positions_asset_idx on positions(asset_id);
create index positions_status_idx on positions(status);
create index position_triggers_position_idx on position_triggers(position_id);
create index position_triggers_type_idx on position_triggers(trigger_type);
