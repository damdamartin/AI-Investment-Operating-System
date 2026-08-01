-- Error logging table for comprehensive error tracking and diagnostics
-- Severity levels: INFO, WARN, ERROR, CRITICAL
-- CRITICAL errors trigger immediate admin notification

CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  context TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  metadata TEXT,
  resolved INTEGER DEFAULT 0,
  resolved_at TIMESTAMP,
  resolution_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookup of unresolved critical errors
CREATE INDEX error_logs_unresolved_critical_idx
  ON error_logs (severity, resolved, created_at)
  WHERE resolved = 0 AND severity = 'CRITICAL';

-- Index for chronological queries
CREATE INDEX error_logs_timestamp_idx
  ON error_logs (timestamp DESC);

-- Index for context-based filtering
CREATE INDEX error_logs_context_idx
  ON error_logs (context, created_at DESC);

-- Table to track which errors have triggered notifications
-- Prevents duplicate notifications for the same error
CREATE TABLE error_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  error_log_id INTEGER NOT NULL UNIQUE,
  notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notification_channel TEXT NOT NULL,
  notification_status TEXT NOT NULL CHECK (notification_status IN ('SENT', 'FAILED', 'PENDING')),
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  FOREIGN KEY (error_log_id) REFERENCES error_logs(id) ON DELETE CASCADE
);

-- Index for pending notifications
CREATE INDEX error_notifications_pending_idx
  ON error_notifications (notification_status, last_retry_at)
  WHERE notification_status IN ('FAILED', 'PENDING');

-- Transaction status tracking table
-- For debugging transaction issues and deadlock analysis
CREATE TABLE transaction_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,
  operation TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMMITTED', 'ROLLED_BACK', 'FAILED')),
  error_message TEXT,
  affected_tables TEXT,
  affected_rows_count INTEGER,
  duration_ms INTEGER
);

-- Index for ongoing transaction queries
CREATE INDEX transaction_logs_pending_idx
  ON transaction_logs (status, started_at)
  WHERE status = 'PENDING';

-- Index for performance analysis
CREATE INDEX transaction_logs_performance_idx
  ON transaction_logs (operation, duration_ms DESC)
  WHERE status = 'COMMITTED';
