-- Audit logging for stop-loss and take-profit triggers
-- Tracks all SL/TP events for monitoring and analytics

CREATE TABLE IF NOT EXISTS monitoring_logs (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('STOP_LOSS', 'TAKE_PROFIT')),
  entry_price REAL NOT NULL,
  trigger_price REAL NOT NULL,
  current_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  pnl REAL NOT NULL,
  pnl_percent REAL NOT NULL,
  broker TEXT NOT NULL DEFAULT 'KIS',
  team TEXT NOT NULL DEFAULT 'KIS',
  triggered_at TEXT NOT NULL,
  order_id TEXT,
  order_status TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_position ON monitoring_logs(position_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_symbol ON monitoring_logs(symbol);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_trigger ON monitoring_logs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_broker ON monitoring_logs(broker);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_team ON monitoring_logs(team);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_timestamp ON monitoring_logs(triggered_at);
