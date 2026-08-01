-- Real-time price cache for KIS and Toss brokers
-- Caches current prices with TTL to reduce API calls and improve stop-loss/take-profit execution speed
-- TTL (time-to-live) in seconds determines when a price should be considered stale and re-fetched

create table price_cache (
  id text primary key,
  symbol text not null,
  broker text not null check (broker in ('KIS', 'TOSS')),
  price_major text not null,
  price_currency text not null check (price_currency in ('KRW', 'USD')),
  timestamp text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ttl_seconds integer not null default 60,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Index for fast lookups by symbol and broker (most common query)
create index idx_price_cache_symbol_broker on price_cache(symbol, broker);

-- Index for finding expired prices (for cleanup operations)
create index idx_price_cache_timestamp on price_cache(timestamp);
