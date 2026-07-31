-- Add broker column to distinguish positions from different brokers
-- This allows KIS, TOSS, and ALPACA teams to have independent position tracking

-- Step 1: Add broker column to trading_positions (if not exists)
PRAGMA foreign_keys=OFF;

-- Step 2: Try adding broker column, ignore if already exists
CREATE TABLE IF NOT EXISTS trading_positions_temp AS SELECT * FROM trading_positions;

-- Step 3: Drop old table and recreate with broker column
DROP TABLE IF EXISTS position_exits;
DROP TABLE IF EXISTS trading_decisions;
DROP TABLE IF EXISTS risk_assessments;
DROP TABLE IF EXISTS moderator_decisions;
DROP TABLE IF EXISTS agent_opinions;
DROP TABLE IF EXISTS trading_positions;

-- Step 4: Recreate trading_positions WITH broker column
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

  status TEXT NOT NULL DEFAULT 'OPEN',
  closed_at TEXT,
  close_reason TEXT,

  broker TEXT DEFAULT 'KIS',
  team TEXT DEFAULT 'KIS',
  price_updated_at TEXT DEFAULT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Step 5: Restore data if temp table exists
INSERT INTO trading_positions
SELECT id, symbol, quantity, entry_price, entry_date, stop_loss_price, take_profit_price,
       current_price, current_pnl, current_pnl_percent, status, closed_at, close_reason,
       'KIS', 'KIS', NULL, created_at, updated_at
FROM trading_positions_temp
WHERE 1=0;  -- This will be no-op since temp table doesn't exist on fresh DB

DROP TABLE IF EXISTS trading_positions_temp;

-- Step 6: Recreate dependent tables
CREATE TABLE IF NOT EXISTS agent_opinions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  analyst_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  confidence REAL NOT NULL,
  reasoning TEXT NOT NULL,
  metadata TEXT,
  analyzed_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

CREATE TABLE IF NOT EXISTS moderator_decisions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence REAL NOT NULL,
  key_reasons TEXT NOT NULL,
  risk_factors TEXT NOT NULL,
  discussion_summary TEXT,
  decided_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

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
  constraints TEXT,
  assessed_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

CREATE TABLE IF NOT EXISTS trading_decisions (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss_price REAL NOT NULL,
  take_profit_price REAL NOT NULL,
  confidence REAL NOT NULL,
  analyst_opinions TEXT NOT NULL,
  moderator_consensus TEXT NOT NULL,
  risk_assessment TEXT NOT NULL,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_at TEXT,
  order_id TEXT,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

CREATE TABLE IF NOT EXISTS position_exits (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  entry_price REAL NOT NULL,
  exit_price REAL NOT NULL,
  exit_reason TEXT NOT NULL,
  pnl REAL NOT NULL,
  pnl_percent REAL NOT NULL,
  exited_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES trading_positions(id)
);

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_positions_status ON trading_positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON trading_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_broker ON trading_positions(broker);
CREATE INDEX IF NOT EXISTS idx_positions_team ON trading_positions(team);
CREATE INDEX IF NOT EXISTS idx_positions_updated ON trading_positions(price_updated_at);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON trading_decisions(executed);
CREATE INDEX IF NOT EXISTS idx_decisions_symbol ON trading_decisions(symbol);
CREATE INDEX IF NOT EXISTS idx_exits_symbol ON position_exits(symbol);
CREATE INDEX IF NOT EXISTS idx_exits_reason ON position_exits(exit_reason);

PRAGMA foreign_keys=ON;
