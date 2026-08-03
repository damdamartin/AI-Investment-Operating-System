-- Crypto Engine Tables

-- 암호화폐 신호
CREATE TABLE IF NOT EXISTS crypto_signals (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('BUY', 'SELL', 'HOLD')),
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  price REAL NOT NULL,
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_signals_market ON crypto_signals(market);
CREATE INDEX IF NOT EXISTS idx_crypto_signals_idempotency_key ON crypto_signals(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_crypto_signals_generated_at ON crypto_signals(generated_at);

-- 암호화폐 주문
CREATE TABLE IF NOT EXISTS crypto_orders (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'FAILED', 'ERROR')),
  idempotency_key TEXT NOT NULL,
  upbit_order_id TEXT,
  error TEXT,
  submitted_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_orders_market ON crypto_orders(market);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_status ON crypto_orders(status);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_idempotency_key ON crypto_orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_upbit_order_id ON crypto_orders(upbit_order_id);
CREATE INDEX IF NOT EXISTS idx_crypto_orders_created_at ON crypto_orders(created_at);

-- 암호화폐 체결
CREATE TABLE IF NOT EXISTS crypto_fills (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  order_id TEXT NOT NULL,
  upbit_order_id TEXT NOT NULL,
  market TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
  volume REAL NOT NULL,
  price REAL NOT NULL,
  profit_loss REAL DEFAULT 0,
  filled_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES crypto_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_crypto_fills_order_id ON crypto_fills(order_id);
CREATE INDEX IF NOT EXISTS idx_crypto_fills_market ON crypto_fills(market);
CREATE INDEX IF NOT EXISTS idx_crypto_fills_filled_at ON crypto_fills(filled_at);
CREATE INDEX IF NOT EXISTS idx_crypto_fills_created_at ON crypto_fills(created_at);

-- 주문 상태 변경 기록
CREATE TABLE IF NOT EXISTS crypto_order_status_changes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  order_id TEXT NOT NULL,
  upbit_order_id TEXT,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES crypto_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_crypto_order_status_changes_order_id ON crypto_order_status_changes(order_id);
CREATE INDEX IF NOT EXISTS idx_crypto_order_status_changes_changed_at ON crypto_order_status_changes(changed_at);

-- 암호화폐 포트폴리오 스냅샷
CREATE TABLE IF NOT EXISTS crypto_portfolio_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  market TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_price REAL NOT NULL,
  total_value REAL NOT NULL,
  current_price REAL NOT NULL,
  unrealized_pl REAL,
  snapshot_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_portfolio_snapshots_market ON crypto_portfolio_snapshots(market);
CREATE INDEX IF NOT EXISTS idx_crypto_portfolio_snapshots_snapshot_at ON crypto_portfolio_snapshots(snapshot_at);

-- 암호화폐 성능 통계
CREATE TABLE IF NOT EXISTS crypto_performance_stats (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  date TEXT NOT NULL,
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0,
  total_profit_loss REAL DEFAULT 0,
  max_drawdown REAL DEFAULT 0,
  sharpe_ratio REAL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_crypto_performance_stats_date ON crypto_performance_stats(date);
