-- Performance Analytics Schema
-- Tables for tracking trading performance, daily metrics, and historical analysis

-- 1. Daily Trading Performance Summary
CREATE TABLE IF NOT EXISTS trading_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trading_date DATE NOT NULL,
  broker TEXT NOT NULL CHECK (broker IN ('KIS', 'TOSS')),

  -- Transaction counts
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,

  -- Profitability metrics
  total_pnl REAL DEFAULT 0,           -- P&L amount in base currency
  total_pnl_percent REAL DEFAULT 0,   -- P&L percentage
  avg_win REAL DEFAULT 0,             -- Average winning trade amount
  avg_loss REAL DEFAULT 0,            -- Average losing trade amount (absolute)
  win_rate REAL DEFAULT 0,            -- Win rate percentage (0-100)

  -- Risk metrics
  max_drawdown REAL DEFAULT 0,        -- Maximum drawdown percentage

  -- Efficiency metrics
  sharpe_ratio REAL DEFAULT 0,        -- Sharpe ratio
  profit_factor REAL DEFAULT 0,       -- Gross profit / Gross loss ratio

  -- Signal execution metrics
  sl_triggered_count INTEGER DEFAULT 0,   -- Stop loss trigger count
  tp_triggered_count INTEGER DEFAULT 0,   -- Take profit trigger count

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trading_perf_date_broker
  ON trading_performance(trading_date, broker);
CREATE INDEX IF NOT EXISTS idx_trading_perf_date ON trading_performance(trading_date);
CREATE INDEX IF NOT EXISTS idx_trading_perf_broker ON trading_performance(broker);

-- 2. Monthly Performance Summary
CREATE TABLE IF NOT EXISTS monthly_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  broker TEXT NOT NULL CHECK (broker IN ('KIS', 'TOSS')),

  total_pnl REAL NOT NULL,
  roi_percent REAL NOT NULL,
  win_rate REAL NOT NULL,
  max_drawdown REAL NOT NULL,
  sharpe_ratio REAL NOT NULL,
  trades_count INTEGER NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_perf_year_month_broker
  ON monthly_performance(year, month, broker);

-- 3. Symbol-Level Performance
CREATE TABLE IF NOT EXISTS symbol_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  broker TEXT NOT NULL CHECK (broker IN ('KIS', 'TOSS')),

  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  avg_win REAL DEFAULT 0,
  avg_loss REAL DEFAULT 0,
  win_rate REAL DEFAULT 0,
  total_pnl REAL DEFAULT 0,
  roi_percent REAL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_symbol_perf_symbol ON symbol_performance(symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_perf_broker ON symbol_performance(broker);
CREATE UNIQUE INDEX IF NOT EXISTS idx_symbol_perf_unique
  ON symbol_performance(symbol, broker);

-- 4. Exit/Close Event Tracking
CREATE TABLE IF NOT EXISTS position_closed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  exit_reason TEXT NOT NULL CHECK (exit_reason IN ('STOP_LOSS', 'TAKE_PROFIT', 'MANUAL', 'EXPIRED')),
  pnl REAL NOT NULL,
  pnl_percent REAL NOT NULL,
  broker TEXT NOT NULL CHECK (broker IN ('KIS', 'TOSS')),
  exited_at TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_closed_events_symbol ON position_closed_events(symbol);
CREATE INDEX IF NOT EXISTS idx_closed_events_broker ON position_closed_events(broker);
CREATE INDEX IF NOT EXISTS idx_closed_events_exit_reason ON position_closed_events(exit_reason);
CREATE INDEX IF NOT EXISTS idx_closed_events_exited_at ON position_closed_events(exited_at);

-- 5. Trade Signal Metrics
CREATE TABLE IF NOT EXISTS trade_signal_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('BUY', 'SELL')),
  confidence REAL NOT NULL,
  entry_price REAL,
  stop_loss REAL,
  take_profit REAL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'CANCELLED', 'EXPIRED')),
  broker TEXT NOT NULL CHECK (broker IN ('KIS', 'TOSS')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_metrics_symbol ON trade_signal_metrics(symbol);
CREATE INDEX IF NOT EXISTS idx_signal_metrics_status ON trade_signal_metrics(status);
CREATE INDEX IF NOT EXISTS idx_signal_metrics_broker ON trade_signal_metrics(broker);
