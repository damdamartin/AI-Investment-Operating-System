-- KIS Token Cache Table
-- Purpose: Cache OAuth tokens to avoid rate limit (1 token per minute)

CREATE TABLE IF NOT EXISTS kis_token_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_kis_token_cache_expires_at ON kis_token_cache(expires_at);
