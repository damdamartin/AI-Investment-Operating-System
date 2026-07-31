-- Multi-Agent Trading System Tables
-- Supports: position tracking, agent decisions, stop-loss/take-profit monitoring

-- Stores open positions and their status
CREATE TABLE IF NOT EXISTS trading_positions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  entry_date TEXT NOT NULL,

  stop_loss_price REAL NOT NULL,
  take_profit_price REAL NOT NULL,

  current_price REAL,
  current_pnl REAL,
  current_pnl_percent REAL,

  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, STOPPED_OUT, TAKEN_PROFIT, CLOSED
  closed_at TEXT,
  close_reason TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (symbol) REFERENCES assets(symbol)
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON trading_positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON trading_positions(symbol);

-- Stores agent analysis opinions (Fundamental, Technical, Sentiment)
CREATE TABLE IF NOT EXISTS agent_opinions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  analyst_type TEXT NOT NULL, -- FUNDAMENTAL, TECHNICAL, SENTIMENT

  score INTEGER NOT NULL, -- 0-100
  confidence REAL NOT NULL, -- 0-1
  reasoning TEXT NOT NULL,
  metadata TEXT, -- JSON with additional details

  analyzed_at TEXT NOT NULL,

  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

-- Stores moderator's discussion synthesis
CREATE TABLE IF NOT EXISTS moderator_decisions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,

  recommendation TEXT NOT NULL, -- BUY, SELL, HOLD
  confidence REAL NOT NULL,
  key_reasons TEXT NOT NULL, -- JSON array
  risk_factors TEXT NOT NULL, -- JSON array
  discussion_summary TEXT, -- JSON array of discussion turns

  decided_at TEXT NOT NULL,

  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

-- Stores risk manager's assessment
CREATE TABLE IF NOT EXISTS risk_assessments (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,

  approved BOOLEAN NOT NULL,
  position_size INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss_price REAL NOT NULL,
  take_profit_price REAL NOT NULL,
  max_loss_amount REAL NOT NULL,

  reasoning TEXT NOT NULL,
  constraints TEXT, -- JSON array

  assessed_at TEXT NOT NULL,

  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

-- Stores final trading decisions
CREATE TABLE IF NOT EXISTS trading_decisions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,

  symbol TEXT NOT NULL,
  action TEXT NOT NULL, -- BUY, SELL, HOLD
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss_price REAL NOT NULL,
  take_profit_price REAL NOT NULL,
  confidence REAL NOT NULL,

  -- Full decision trace
  analyst_opinions TEXT NOT NULL, -- JSON
  moderator_consensus TEXT NOT NULL, -- JSON
  risk_assessment TEXT NOT NULL, -- JSON

  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_at TEXT,
  order_id TEXT, -- Link to actual broker order if executed

  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL,

  FOREIGN KEY (position_id) REFERENCES trading_positions(id),
  FOREIGN KEY (symbol) REFERENCES assets(symbol)
);

CREATE INDEX IF NOT EXISTS idx_decisions_status ON trading_decisions(executed);
CREATE INDEX IF NOT EXISTS idx_decisions_symbol ON trading_decisions(symbol);

-- Stores AI's recommended assets (for watchlist expansion)
CREATE TABLE IF NOT EXISTS asset_recommendations (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL, -- KR, US

  reason TEXT NOT NULL,
  urgency TEXT NOT NULL, -- HIGH, MEDIUM, LOW
  add_to_watchlist BOOLEAN NOT NULL,
  confidence REAL NOT NULL,

  recommended_at TEXT NOT NULL,
  acted_on BOOLEAN NOT NULL DEFAULT FALSE,
  acted_on_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_recommendations_symbol ON asset_recommendations(symbol);
CREATE INDEX IF NOT EXISTS idx_recommendations_urgency ON asset_recommendations(urgency);

-- Audit trail for position exits
CREATE TABLE IF NOT EXISTS position_exits (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,

  symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  exit_reason TEXT NOT NULL, -- STOP_LOSS, TAKE_PROFIT, MANUAL

  pnl REAL NOT NULL,
  pnl_percent REAL NOT NULL,

  exited_at TEXT NOT NULL,

  FOREIGN KEY (position_id) REFERENCES trading_positions(id),
  FOREIGN KEY (symbol) REFERENCES assets(symbol)
);

CREATE INDEX IF NOT EXISTS idx_exits_symbol ON position_exits(symbol);
CREATE INDEX IF NOT EXISTS idx_exits_reason ON position_exits(exit_reason);
